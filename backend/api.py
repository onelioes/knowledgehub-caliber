"""
api.py - REST API untuk KnowledgeHub POC RAG Pipeline

Fitur & Keamanan:
1. POST /upload: Upload dokumen (multipart/form-data) dengan 2-phase consent detection.
   - Pembatasan ukuran file maksimal 25 MB (HTTP 413 Payload Too Large jika melebihi batas).
   - Jika dokumen bebas PII dan tidak butuh OCR: langsung selesai (status: "completed").
   - Jika dokumen terdeteksi PII atau butuh OCR: simpan state dan kembalikan pending_id (status: "pending_consent").
2. POST /upload/{pending_id}/confirm: Konfirmasi keputusan user (consent_processing, consent_ocr, allow_raw_pii).
   - Atomic pop untuk mencegah race condition & double-submit (panggilan kedua otomatis 404).
   - Pengecekan TTL/Expiry (30 menit). Jika kedaluwarsa, file sementara dihapus dan mengembalikan 404.
3. Background Task Cleanup: Pembersihan otomatis periodik di background untuk entri pending yang kedaluwarsa.
4. POST /ask: Tanya jawab dokumen dengan query rewriting, similarity threshold, dan anti-halusinasi guardrails.
5. GET /documents: List seluruh dokumen tersimpan di vector store lengkap dengan jumlah chunk dan waktu proses.
6. GET /health: Health check endpoint untuk liveness & monitoring.
"""

import os
import sys
import re
import time
import uuid
import json
import shutil
import asyncio
import tempfile
import zipfile
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional, Any, Dict

# Pastikan modul backend dapat diimpor langsung saat dijalankan dari root repositori
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from chunking import (
    SUPPORTED_EXTENSIONS,
    extract_digital_text,
    extract_text,
    chunk_text,
)
from pii_detector import (
    detect_pii,
    redact_pii,
    HIGH_RISK_CATEGORIES,
    MEDIUM_RISK_CATEGORIES,
)
from embedding_store import (
    embed_chunks,
    save_store,
    list_stored_docs,
    load_store,
)
from retrieval import answer_question, find_relevant_chunks, CHAT_MODELS
from main import (
    record_consent_audit,
    MAX_ZIP_FILES,
    MAX_ZIP_UNCOMPRESSED_BYTES,
)

load_dotenv()

# Konfigurasi Keamanan & Batasan
MAX_UPLOAD_SIZE_MB = 25
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024  # 25 MB
PENDING_TTL_SECONDS = 1800  # 30 menit kedaluwarsa

UPLOAD_STAGING_DIR = os.path.join(tempfile.gettempdir(), "knowledgehub_api_uploads")
os.makedirs(UPLOAD_STAGING_DIR, exist_ok=True)

# TODO (Production Architecture / Scaling):
# Penyimpanan state sementara PENDING_UPLOADS saat ini menggunakan dictionary in-memory Python.
# Jika server dijalankan dengan multiple Uvicorn worker processes (misal uvicorn --workers 4)
# atau di-scale horizontal di dalam Kubernetes / Cloud Run, dictionary ini HARUS diganti
# dengan shared persistent store seperti Redis atau database (PostgreSQL), serta file
# sementara disimpan di Object Storage (Google Cloud Storage / AWS S3) agar state pending
# tidak hilang saat restart dan dapat diakses oleh worker manapun.
PENDING_UPLOADS: Dict[str, Dict[str, Any]] = {}


def purge_expired_pending_uploads() -> List[str]:
    """
    Fungsi pembersih entri PENDING_UPLOADS yang kedaluwarsa beserta file staging sementaranya.
    Dapat dipanggil langsung oleh background task ataupun test suite tanpa melalui HTTP.
    """
    now = time.time()
    expired_ids = [
        pid for pid, it in list(PENDING_UPLOADS.items())
        if now - it.get("created_at", now) > PENDING_TTL_SECONDS
    ]
    for pid in expired_ids:
        it = PENDING_UPLOADS.pop(pid, None)
        if it:
            fp = it.get("file_path")
            if fp and os.path.exists(fp):
                try:
                    os.remove(fp)
                except Exception:
                    pass
            td = it.get("temp_extract_dir")
            if td and os.path.exists(td):
                try:
                    shutil.rmtree(td, ignore_errors=True)
                except Exception:
                    pass
    return expired_ids


async def cleanup_expired_pending_task():
    """Background task periodik untuk membersihkan entri PENDING_UPLOADS yang kedaluwarsa."""
    while True:
        try:
            await asyncio.sleep(60)
            purge_expired_pending_uploads()
        except asyncio.CancelledError:
            break
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Mulai task pembersih kedaluwarsa di background
    cleanup_task = asyncio.create_task(cleanup_expired_pending_task())
    yield
    cleanup_task.cancel()


app = FastAPI(
    title="KnowledgeHub RAG API",
    description="REST API untuk KnowledgeHub POC RAG Pipeline dengan PII Consent Gate & Audit Log Compliance",
    version="1.0.0",
    lifespan=lifespan,
)

# Konfigurasi CORS: Izinkan origin localhost untuk pengembangan frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Schemas ---

class ConfirmRequest(BaseModel):
    consent_processing: bool = Field(
        ...,
        description="True untuk menyetujui pemrosesan dokumen yang mengandung PII, False untuk membatalkan.",
    )
    consent_ocr: bool = Field(
        True,
        description="True untuk mengizinkan pengiriman gambar/scan ke Gemini Vision OCR eksternal.",
    )
    allow_raw_pii: bool = Field(
        False,
        description="True untuk menyimpan data PII risiko tinggi secara mentah (unredacted), False untuk redaksi aman default.",
    )
    keep_dob: bool = Field(
        False,
        description="True untuk membiarkan tanggal lahir tetap mentah tanpa menyentuh kategori risiko tinggi.",
    )


class AskRequest(BaseModel):
    question: str = Field(
        ...,
        description="Pertanyaan yang ingin diajukan ke basis pengetahuan KnowledgeHub.",
        example="Berapa alokasi RAM per worker node dan kemana backup disimpan?",
    )
    chat_history: Optional[List[List[str]]] = Field(
        None,
        description="Riwayat percakapan sebelumnya dalam format list pasang: [[pertanyaan_user, jawaban_asisten], ...].",
    )
    top_k: int = Field(
        12,
        description="Jumlah chunk paling mirip yang diambil dari vector store.",
        ge=1,
        le=30,
    )
    similarity_threshold: float = Field(
        0.58,
        description="Ambang batas kemiripan kosinus minimum untuk mengeliminasi chunk tidak relevan.",
    )
    doc_filter: Optional[str] = Field(
        None,
        description="Filter opsional untuk membatasi pencarian ke dokumen sumber tertentu.",
    )


class ChatAPIRequest(BaseModel):
    query: str = Field(
        ...,
        description="Pertanyaan teknis operasional dari frontend AI Copilot.",
        example="Berapa batas vibrasi kompresor K-102?",
    )
    asset_tag: Optional[str] = Field(
        None,
        description="Tag aset opsional (contoh: P-101A, K-102, F-101, C-201, dll).",
        example="P-101A",
    )
    grounded_doc: Optional[str] = None
    user_id: Optional[str] = None
    check_sensitive: Optional[bool] = False
    deep_analysis: Optional[bool] = False
    chat_history: Optional[List[List[str]]] = None
    model_config = {"extra": "ignore"}


# --- Endpoints ---

@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint untuk monitoring dan kesiapan service."""
    return {
        "status": "ok",
        "service": "KnowledgeHub RAG API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/documents", tags=["Documents"])
def get_documents():
    """
    Menampilkan daftar seluruh dokumen yang tersimpan di vector_store.json,
    jumlah chunk masing-masing, serta metadata waktu pemrosesan terakhir dari consent_log.json.
    """
    docs_summary = list_stored_docs()

    # Ambil catatan waktu terakhir dari consent_log.json jika ada
    last_processed_map: Dict[str, str] = {}
    if os.path.exists("consent_log.json"):
        try:
            with open("consent_log.json", "r", encoding="utf-8") as f:
                logs = json.load(f)
                for entry in logs:
                    fn = entry.get("file")
                    ts = entry.get("timestamp")
                    if fn and ts:
                        last_processed_map[fn] = ts
        except Exception:
            pass

    items = []
    for doc_name, chunk_count in docs_summary.items():
        items.append({
            "source": doc_name,
            "chunks_count": chunk_count,
            "last_processed": last_processed_map.get(doc_name, None),
        })

    return {
        "total_documents": len(items),
        "total_chunks": sum(d["chunks_count"] for d in items),
        "documents": items,
    }


@app.post("/upload", tags=["Ingestion"])
async def upload_document(
    file: UploadFile = File(...),
):
    """
    Tahap 1 Alur Ingestion:
    - Menerima file upload (multipart/form-data).
    - Membatasi ukuran file maksimal 25 MB (HTTP 413 jika melebihi batas).
    - Memeriksa ekstensi file (mendukung 11 tipe).
    - Melakukan ekstraksi teks digital lokal secara offline dan deteksi PII lokal.
    - Jika TIDAK ada PII dan TIDAK perlu OCR: dokumen langsung diproses tuntas (status: completed).
    - Jika ADA PII atau PERLU OCR: proses dijeda dan menghasilkan pending_id (status: pending_consent).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nama file tidak valid.")

    safe_filename = os.path.basename(file.filename)
    ext = os.path.splitext(safe_filename)[1].lower()

    upload_id = str(uuid.uuid4())
    temp_file_path = os.path.join(UPLOAD_STAGING_DIR, f"{upload_id}_{safe_filename}")

    CHUNK_SIZE = 1024 * 1024  # 1 MB chunk
    total_bytes = 0
    chunks_data = []

    try:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail=f"Ukuran file ({total_bytes / (1024 * 1024):.1f} MB) melebihi batas maksimum {MAX_UPLOAD_SIZE_MB} MB. Silakan unggah dokumen yang lebih kecil.",
                )
            chunks_data.append(chunk)

        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="File yang diunggah kosong (0 bytes).")

        if ext not in SUPPORTED_EXTENSIONS:
            supported_str = ", ".join(sorted(SUPPORTED_EXTENSIONS))
            raise HTTPException(
                status_code=400,
                detail=f"Tipe file '{ext}' belum didukung. Format yang didukung saat ini: {supported_str}",
            )

        content = b"".join(chunks_data)
        with open(temp_file_path, "wb") as f:
            f.write(content)
    except HTTPException:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan file upload: {str(e)}")

    # 1. PENANGANAN FILE ARSIP .ZIP
    if ext == ".zip":
        try:
            zf = zipfile.ZipFile(temp_file_path, "r")
        except Exception as e:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            raise HTTPException(status_code=400, detail=f"File ZIP rusak atau tidak valid: {str(e)}")

        with zf:
            infolist = zf.infolist()
            # Zip Bomb: Cek jumlah file
            if len(infolist) > MAX_ZIP_FILES:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                raise HTTPException(
                    status_code=400,
                    detail=f"Potensi Zip Bomb: Jumlah entri ({len(infolist)}) melebihi batas aman ({MAX_ZIP_FILES} file).",
                )

            # Zip Bomb: Cek total ukuran uncompressed
            total_uncompressed = sum(info.file_size for info in infolist)
            if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
                size_mb = total_uncompressed / (1024 * 1024)
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                raise HTTPException(
                    status_code=400,
                    detail=f"Potensi Zip Bomb: Total ukuran uncompressed ({size_mb:.2f} MB) melebihi batas aman (100 MB).",
                )

            temp_extract_dir = tempfile.mkdtemp(prefix="knowledgehub_api_zip_")
            # Zip Slip / Path Traversal Check
            for info in infolist:
                target_p = os.path.abspath(os.path.join(temp_extract_dir, info.filename))
                if not target_p.startswith(os.path.abspath(temp_extract_dir) + os.sep) and target_p != os.path.abspath(temp_extract_dir):
                    shutil.rmtree(temp_extract_dir, ignore_errors=True)
                    if os.path.exists(temp_file_path):
                        os.remove(temp_file_path)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Potensi serangan Zip Slip / Path Traversal terdeteksi pada entri: '{info.filename}'",
                    )

            zf.extractall(temp_extract_dir)

        # Kumpulkan semua file di dalam zip
        extracted_files = []
        for root, dirs, files in os.walk(temp_extract_dir):
            for f in files:
                full_p = os.path.join(root, f)
                rel_p = os.path.relpath(full_p, temp_extract_dir)
                extracted_files.append((full_p, rel_p))

        extracted_files.sort(key=lambda x: x[1])
        inner_supported = SUPPORTED_EXTENSIONS - {".zip"}

        zip_pii_detected = []
        zip_requires_ocr = False
        valid_files_count = 0

        for full_p, rel_p in extracted_files:
            inner_ext = os.path.splitext(rel_p)[1].lower()
            if inner_ext in inner_supported:
                valid_files_count += 1
                try:
                    d_text, sc_pages = extract_digital_text(full_p)
                    pii_cats = detect_pii(d_text)
                    for cat in pii_cats:
                        if cat not in zip_pii_detected:
                            zip_pii_detected.append(cat)
                    if sc_pages or inner_ext in (".jpg", ".jpeg", ".png"):
                        zip_requires_ocr = True
                except Exception:
                    pass

        if valid_files_count == 0:
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            raise HTTPException(status_code=400, detail="Tidak ada file yang didukung di dalam arsip ZIP.")

        # Jika ada PII atau butuh OCR di dalam arsip ZIP -> jeda ke tahap consent
        if zip_pii_detected or zip_requires_ocr:
            pending_id = str(uuid.uuid4())
            PENDING_UPLOADS[pending_id] = {
                "pending_id": pending_id,
                "file_name": safe_filename,
                "file_path": temp_file_path,
                "temp_extract_dir": temp_extract_dir,
                "is_zip": True,
                "detected_pii": zip_pii_detected,
                "requires_ocr": zip_requires_ocr,
                "scanned_pages": [],
                "created_at": time.time(),
                "created_at_iso": datetime.now().isoformat(),
            }
            return {
                "status": "pending_consent",
                "pending_id": pending_id,
                "file_name": safe_filename,
                "detected_pii": zip_pii_detected,
                "requires_ocr": zip_requires_ocr,
                "scanned_pages": [],
                "ttl_seconds": PENDING_TTL_SECONDS,
                "message": "Arsip ZIP memuat file dengan data pribadi (PII) atau gambar scan yang memerlukan konfirmasi sebelum diproses.",
                "available_actions": {
                    "consent_processing": "True untuk menyetujui pemrosesan dokumen, False untuk membatalkan",
                    "consent_ocr": "True untuk mengizinkan Vision OCR gambar scan ke Gemini API",
                    "allow_raw_pii": "True untuk menyimpan PII risiko tinggi secara mentah, False untuk redaksi default",
                },
            }

        # Jika arsip ZIP bebas PII dan tidak butuh OCR -> selesaikan langsung
        try:
            saved_count = 0
            for full_p, rel_p in extracted_files:
                inner_ext = os.path.splitext(rel_p)[1].lower()
                if inner_ext in inner_supported:
                    comb_source = f"{safe_filename}/{rel_p}"
                    f_text = extract_text(full_p, allow_ocr=False)
                    if f_text.strip():
                        chunks = chunk_text(f_text)
                        vectors = embed_chunks(chunks)
                        save_store(chunks, vectors, source_file=comb_source)
                        record_consent_audit(
                            file_name=comb_source,
                            detected_pii=[],
                            consent=True,
                            action="NO_PII_DETECTED",
                            raw_pii_allowed=False,
                            redacted=False,
                        )
                        saved_count += 1
            return {
                "status": "completed",
                "file_name": safe_filename,
                "files_processed": saved_count,
                "detected_pii": [],
                "requires_ocr": False,
                "message": f"Arsip ZIP '{safe_filename}' ({saved_count} file) berhasil diproses dan disimpan ke database vektor.",
            }
        finally:
            shutil.rmtree(temp_extract_dir, ignore_errors=True)
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    # 2. PENANGANAN DOKUMEN TUNGGAL (PDF, DOCX, TXT, MD, CSV, PPTX, XLSX, JPG, PNG)
    is_standalone_image = ext in (".jpg", ".jpeg", ".png")

    try:
        digital_text, scanned_pages = extract_digital_text(temp_file_path)
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(status_code=400, detail=f"Gagal mengekstrak teks digital: {str(e)}")

    detected_pii_initial = detect_pii(digital_text)
    requires_ocr = bool(scanned_pages) or is_standalone_image

    # Jika terdeteksi PII atau memerlukan OCR -> Simpan state dan tunggu konfirmasi
    if detected_pii_initial or requires_ocr:
        pending_id = str(uuid.uuid4())
        PENDING_UPLOADS[pending_id] = {
            "pending_id": pending_id,
            "file_name": safe_filename,
            "file_path": temp_file_path,
            "is_zip": False,
            "is_image": is_standalone_image,
            "digital_text": digital_text,
            "scanned_pages": scanned_pages if not is_standalone_image else [1],
            "detected_pii": detected_pii_initial,
            "requires_ocr": requires_ocr,
            "created_at": time.time(),
            "created_at_iso": datetime.now().isoformat(),
        }

        reasons = []
        if detected_pii_initial:
            reasons.append(f"Data pribadi terdeteksi: {', '.join(detected_pii_initial)}")
        if is_standalone_image:
            reasons.append("File berupa gambar berdiri sendiri yang perlu ditranskripsi via Vision OCR API")
        elif scanned_pages:
            reasons.append(f"Dokumen memuat {len(scanned_pages)} halaman berupa gambar scan (Halaman {', '.join(str(p) for p in scanned_pages)}) yang perlu OCR API")

        return {
            "status": "pending_consent",
            "pending_id": pending_id,
            "file_name": safe_filename,
            "detected_pii": detected_pii_initial,
            "requires_ocr": requires_ocr,
            "scanned_pages": scanned_pages if not is_standalone_image else [1],
            "ttl_seconds": PENDING_TTL_SECONDS,
            "message": "Dokumen memerlukan persetujuan pengguna sebelum diproses lebih lanjut: " + "; ".join(reasons) + ".",
            "available_actions": {
                "consent_processing": "True untuk menyetujui pemrosesan dokumen, False untuk membatalkan",
                "consent_ocr": "True untuk mengizinkan pengiriman gambar ke Gemini Vision OCR eksternal",
                "allow_raw_pii": "True untuk menyimpan PII risiko tinggi secara mentah, False untuk redaksi default",
            },
        }

    # Jika dokumen bebas PII dan tidak ada gambar scan -> Lanjut otomatis sampai selesai
    try:
        chunks = chunk_text(digital_text)
        if not chunks:
            raise HTTPException(status_code=400, detail="Tidak ada teks bermakna yang dapat di-chunk dari dokumen ini.")

        vectors = embed_chunks(chunks)
        save_store(chunks, vectors, source_file=safe_filename)

        record_consent_audit(
            file_name=safe_filename,
            detected_pii=[],
            consent=True,
            action="NO_PII_DETECTED",
            raw_pii_allowed=False,
            redacted=False,
        )

        return {
            "status": "completed",
            "file_name": safe_filename,
            "chunks_count": len(chunks),
            "detected_pii": [],
            "requires_ocr": False,
            "redacted": False,
            "message": f"Dokumen '{safe_filename}' bebas PII dan berhasil disimpan ke database vektor.",
        }
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.post("/upload/{pending_id}/confirm", tags=["Ingestion"])
def confirm_upload(pending_id: str, req: ConfirmRequest):
    """
    Tahap 2 Alur Ingestion:
    - Mengambil dan menghapus (atomic pop) state dari PENDING_UPLOADS untuk mencegah race condition & double-submit.
    - Memeriksa apakah pending_id telah kedaluwarsa (TTL).
    - Melanjutkan ekstraksi OCR (jika disetujui), redaksi data pribadi, dan penyimpanan vektor.
    - Mengembalikan status akhir ("completed" atau "rejected").
    """
    # 1. ATOMIC POP: Menghapus entri seketika agar pemanggilan kedua (double-submit) langsung mendapatkan 404
    item = PENDING_UPLOADS.pop(pending_id, None)
    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Pending upload ID '{pending_id}' tidak ditemukan atau telah kedaluwarsa/diproses.",
        )

    # 2. PENGECEKAN KEDALUWARSA (TTL EXPIRY)
    created_at = item.get("created_at", time.time())
    if time.time() - created_at > PENDING_TTL_SECONDS:
        file_path = item.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        temp_dir = item.get("temp_extract_dir")
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        raise HTTPException(
            status_code=404,
            detail=f"Pending upload ID '{pending_id}' telah kedaluwarsa (melebihi batas waktu {PENDING_TTL_SECONDS // 60} menit). Silakan unggah ulang dokumen.",
        )

    file_name = item["file_name"]
    file_path = item["file_path"]

    # 3. JIKA PENGGUNA MENOLAK PEMROSESAN
    if not req.consent_processing:
        record_consent_audit(
            file_name=file_name,
            detected_pii=item.get("detected_pii", []),
            consent=False,
            action="REJECTED_BY_USER",
            raw_pii_allowed=False,
            redacted=False,
        )
        if item.get("is_zip") and item.get("temp_extract_dir") and os.path.exists(item["temp_extract_dir"]):
            shutil.rmtree(item["temp_extract_dir"], ignore_errors=True)
        if os.path.exists(file_path):
            os.remove(file_path)

        return {
            "status": "rejected",
            "pending_id": pending_id,
            "file_name": file_name,
            "message": f"Pemrosesan dokumen '{file_name}' dibatalkan sesuai keputusan pengguna. Tidak ada data yang disimpan.",
        }

    # 4. JIKA PENGGUNA MENYETUJUI PEMROSESAN
    # Kasus A: Arsip ZIP yang tertunda
    if item.get("is_zip"):
        temp_extract_dir = item.get("temp_extract_dir")
        try:
            extracted_files = []
            for root, dirs, files in os.walk(temp_extract_dir):
                for f in files:
                    full_p = os.path.join(root, f)
                    rel_p = os.path.relpath(full_p, temp_extract_dir)
                    extracted_files.append((full_p, rel_p))

            extracted_files.sort(key=lambda x: x[1])
            inner_supported = SUPPORTED_EXTENSIONS - {".zip"}
            saved_count = 0

            for full_p, rel_p in extracted_files:
                inner_ext = os.path.splitext(rel_p)[1].lower()
                if inner_ext in inner_supported:
                    comb_source = f"{file_name}/{rel_p}"
                    full_text = extract_text(full_p, allow_ocr=req.consent_ocr)
                    if not full_text.strip():
                        continue

                    pii_found = detect_pii(full_text)
                    is_redacted = False
                    if pii_found and not req.allow_raw_pii:
                        full_text = redact_pii(
                            full_text,
                            redact_high_risk=True,
                            redact_medium_risk=not req.keep_dob,
                        )
                        is_redacted = True

                    chunks = chunk_text(full_text)
                    vectors = embed_chunks(chunks)
                    save_store(chunks, vectors, source_file=comb_source)

                    action_str = "PROCESSED_WITH_REDACTION" if is_redacted else (
                        "PROCESSED_RAW_PII" if req.allow_raw_pii and pii_found else "NO_PII_DETECTED"
                    )
                    record_consent_audit(
                        file_name=comb_source,
                        detected_pii=pii_found,
                        consent=True,
                        action=action_str,
                        raw_pii_allowed=req.allow_raw_pii,
                        redacted=is_redacted,
                    )
                    saved_count += 1

            return {
                "status": "completed",
                "pending_id": pending_id,
                "file_name": file_name,
                "files_processed": saved_count,
                "raw_pii_allowed": req.allow_raw_pii,
                "message": f"Arsip ZIP '{file_name}' ({saved_count} file) berhasil diproses dan disimpan sesuai preferensi persetujuan.",
            }
        finally:
            if temp_extract_dir and os.path.exists(temp_extract_dir):
                shutil.rmtree(temp_extract_dir, ignore_errors=True)
            if os.path.exists(file_path):
                os.remove(file_path)

    # Kasus B: Dokumen Tunggal yang tertunda
    try:
        if item.get("is_image") and not req.consent_ocr:
            record_consent_audit(
                file_name=file_name,
                detected_pii=[],
                consent=False,
                action="REJECTED_STANDALONE_IMAGE_GATE",
                raw_pii_allowed=False,
                redacted=False,
            )
            return {
                "status": "rejected",
                "pending_id": pending_id,
                "file_name": file_name,
                "message": "Dokumen berupa gambar berdiri sendiri tidak dapat diproses tanpa izin OCR Vision.",
            }

        full_text = extract_text(file_path, allow_ocr=req.consent_ocr)
        if not full_text.strip():
            raise HTTPException(status_code=400, detail="Tidak ada teks yang berhasil diekstraksi dari dokumen.")

        all_detected_pii = detect_pii(full_text)
        high_risk_detected = [c for c in all_detected_pii if c in HIGH_RISK_CATEGORIES]
        medium_risk_detected = [c for c in all_detected_pii if c in MEDIUM_RISK_CATEGORIES]

        raw_pii_allowed = False
        is_redacted = False

        if req.allow_raw_pii:
            raw_pii_allowed = True
            action_status = "PROCESSED_RAW_PII"
        else:
            redact_high = bool(high_risk_detected)
            redact_medium = bool(medium_risk_detected) and not req.keep_dob
            if redact_high or redact_medium:
                full_text = redact_pii(
                    full_text,
                    redact_high_risk=redact_high,
                    redact_medium_risk=redact_medium,
                )
                is_redacted = True
                action_status = "PROCESSED_WITH_REDACTION"
            elif all_detected_pii:
                action_status = "PROCESSED_WITHOUT_REDACTION"
            else:
                action_status = "NO_PII_DETECTED"

        chunks = chunk_text(full_text)
        if not chunks:
            raise HTTPException(status_code=400, detail="Gagal membagi dokumen menjadi chunk teks.")

        vectors = embed_chunks(chunks)
        save_store(chunks, vectors, source_file=file_name)

        record_consent_audit(
            file_name=file_name,
            detected_pii=all_detected_pii,
            consent=True,
            action=action_status,
            raw_pii_allowed=raw_pii_allowed,
            redacted=is_redacted,
        )

        return {
            "status": "completed",
            "pending_id": pending_id,
            "file_name": file_name,
            "chunks_count": len(chunks),
            "detected_pii": all_detected_pii,
            "redacted": is_redacted,
            "raw_pii_allowed": raw_pii_allowed,
            "message": f"Dokumen '{file_name}' berhasil diproses dan disimpan ke database vektor.",
        }
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@app.post("/ask", tags=["Query & RAG"])
def ask_question_endpoint(req: AskRequest):
    """
    Endpoint RAG QA:
    - Menerima pertanyaan dan riwayat percakapan opsional (multi-turn memory).
    - Menjalankan Query Rewriting secara otomatis jika ada riwayat percakapan.
    - Mencari chunk relevan dengan ambang kemiripan (Similarity Threshold & Doc Filter).
    - Memanggil model Gemini dengan prompt guardrail anti-halusinasi ketat.
    - Mengembalikan jawaban, sitasi sumber, dan metrik latensi.
    """
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Parameter 'question' tidak boleh kosong.")

    formatted_history = None
    if req.chat_history:
        formatted_history = [
            (turn[0], turn[1])
            for turn in req.chat_history
            if isinstance(turn, (list, tuple)) and len(turn) >= 2
        ]

    try:
        answer, metrics = answer_question(
            question=req.question.strip(),
            top_k=req.top_k,
            similarity_threshold=req.similarity_threshold,
            doc_filter=req.doc_filter,
            chat_history=formatted_history,
            return_metrics=True,
        )
        return {
            "question": req.question.strip(),
            "answer": answer,
            "sources": metrics.get("sources", []),
            "metrics": metrics,
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan internal saat memproses jawaban: {str(e)}",
        )


@app.post("/api/chat", tags=["Frontend Adapter"])
def chat_api_endpoint(req: ChatAPIRequest):
    """
    Adapter endpoint RAG riil untuk frontend Chandra Asri Knowledge Hub (CALIBER 2026):
    - Menerima: { "query": "...", "asset_tag": "..." }
    - Menjalankan pipeline RAG nyata (answer_question & find_relevant_chunks)
    - Mengembalikan format respon kaya dengan citation cards.
    """
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Parameter 'query' tidak boleh kosong.")

    formatted_history = None
    if req.chat_history:
        formatted_history = [
            (turn[0], turn[1])
            for turn in req.chat_history
            if isinstance(turn, (list, tuple)) and len(turn) >= 2
        ]

    # 1. Matching dokumen berdasarkan grounded_doc atau asset_tag jika ada
    is_explicit_grounded = bool(req.grounded_doc and req.grounded_doc.strip())
    matched_doc_filter = None
    if is_explicit_grounded:
        matched_doc_filter = req.grounded_doc.strip()
    elif req.asset_tag and req.asset_tag.upper() not in ("GENERAL", "GEN-PLANT", "ALL", ""):
        stored_docs = list_stored_docs()
        clean_tag = req.asset_tag.replace("-", "").upper()
        for doc_name in stored_docs.keys():
            if req.asset_tag.upper() in doc_name.upper() or clean_tag in doc_name.replace("-", "").upper():
                matched_doc_filter = doc_name
                break

    # 1b. Jika tanpa filter eksplisit, namun query menanyakan isi dokumen ("ini isinya apa", dsb.)
    if not matched_doc_filter:
        from retrieval import is_overview_or_summary_query
        if is_overview_or_summary_query(req.query):
            stored_docs = list_stored_docs()
            if stored_docs:
                doc_keys = list(stored_docs.keys())
                # Prioritaskan dokumen aktif/terbaru yang diunggah
                matched_doc_filter = doc_keys[-1] if doc_keys else None

    try:
        # 2. Eksekusi Answer Question via Gemini RAG / Factual Synthesizer
        answer, metrics = answer_question(
            question=req.query.strip(),
            top_k=8,
            similarity_threshold=0.45,
            doc_filter=matched_doc_filter,
            chat_history=formatted_history,
            return_metrics=True,
        )

        # 3. Fallback pencarian tanpa filter aset HANYA jika bukan grounded_doc eksplisit
        # Jika pengguna memilih Dokumen A, sistem WAJIB strictly menganalisis Dokumen A saja tanpa kontaminasi dokumen lain.
        if not is_explicit_grounded and matched_doc_filter and "informasi tidak ditemukan" in answer.lower() and not formatted_history:
            alt_answer, alt_metrics = answer_question(
                question=req.query.strip(),
                top_k=8,
                similarity_threshold=0.45,
                doc_filter=None,
                chat_history=formatted_history,
                return_metrics=True,
            )
            if "informasi tidak ditemukan" not in alt_answer.lower():
                answer = alt_answer
                metrics = alt_metrics
                matched_doc_filter = None

        if is_explicit_grounded and "informasi tidak ditemukan" in answer.lower():
            answer = f"Berdasarkan dokumen terpilih **{matched_doc_filter}**, informasi spesifik terkait topik tersebut tidak ditemukan di dalam isi dokumen ini."

        # 4. Ambil chunk relevan untuk membentuk kartu sitasi (confidence score & snippet)
        relevant_chunks = find_relevant_chunks(
            question=req.query.strip(),
            top_k=3,
            similarity_threshold=0.45,
            doc_filter=matched_doc_filter,
        )
        if not is_explicit_grounded and not relevant_chunks and matched_doc_filter:
            relevant_chunks = find_relevant_chunks(
                question=req.query.strip(),
                top_k=3,
                similarity_threshold=0.45,
            )

        citations = []
        for chk in relevant_chunks:
            src = chk.get("source", "Dokumen Teknis Chandra Asri")
            score = round(float(chk.get("score", 0.92)), 3)
            txt_content = chk.get("text", "")
            
            # Cari nomor halaman asli dari tag [Halaman X]
            page_idx = chk.get("chunk_index", 0) + 1
            m_pg = re.search(r"\[(?:Halaman|Page)\s*(\d+)\]", txt_content, re.IGNORECASE)
            if m_pg:
                try:
                    page_idx = int(m_pg.group(1))
                except Exception:
                    pass

            rev = "Rev 1.0"
            if "P101" in src:
                rev = "Rev 4.2 (2025)"
            elif "K102" in src:
                rev = "Rev 3.1 (2024)"
            elif "F101" in src:
                rev = "Rev 5.0 (2025)"
            elif "C201" in src:
                rev = "Rev 6.1 (2024)"
            elif "CALIBER" in src:
                rev = "Final (2026)"

            clean_snippet = txt_content.replace("\n", " ").strip()
            if len(clean_snippet) > 175:
                clean_snippet = clean_snippet[:172] + "..."

            citations.append({
                "source": src,
                "page": page_idx,
                "revision": rev,
                "confidence_score": score,
                "snippet": clean_snippet,
            })

        return {
            "response": answer,
            "citations": citations,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memproses query chat: {str(e)}",
        )


# --- Settings & API Key Configuration Endpoints ---
class SettingsUpdateRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    user_profile: Optional[Dict[str, Any]] = None
    model_config = {"extra": "ignore"}


@app.get("/api/settings", tags=["Settings"])
def get_settings():
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    has_key = bool(api_key)
    masked = f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else ("Configured" if has_key else "Not Configured")
    return {
        "gemini_configured": has_key,
        "key_display": masked,
        "active_models": CHAT_MODELS,
    }


@app.post("/api/settings", tags=["Settings"])
def update_settings(req: SettingsUpdateRequest):
    import retrieval, embedding_store

    saved_key = False
    if req.gemini_api_key is not None:
        new_key = req.gemini_api_key.strip()
        os.environ["GEMINI_API_KEY"] = new_key

        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        lines = []
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

        found = False
        new_lines = []
        for line in lines:
            if line.strip().startswith("GEMINI_API_KEY="):
                new_lines.append(f"GEMINI_API_KEY={new_key}\n")
                found = True
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(f"GEMINI_API_KEY={new_key}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        retrieval._client = None
        embedding_store._client = None
        saved_key = True

    return {
        "status": "success",
        "message": "Settings and Gemini API configuration updated successfully.",
        "gemini_active": bool(os.environ.get("GEMINI_API_KEY", "").strip()),
    }


# --- Static Frontend Delivery (Chandra Asri Knowledge Hub Web App) ---
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

if os.path.exists(FRONTEND_DIR):
    from fastapi.responses import FileResponse

    NO_CACHE_HEADERS = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"), headers=NO_CACHE_HEADERS)

    @app.get("/styles.css", include_in_schema=False)
    def serve_styles():
        return FileResponse(os.path.join(FRONTEND_DIR, "styles.css"), headers=NO_CACHE_HEADERS)

    @app.get("/app.js", include_in_schema=False)
    def serve_app_js():
        return FileResponse(os.path.join(FRONTEND_DIR, "app.js"), headers=NO_CACHE_HEADERS)

    @app.get("/{filename:path}", include_in_schema=False)
    def serve_static(filename: str):
        file_path = os.path.join(FRONTEND_DIR, filename)
        if os.path.isfile(file_path):
            return FileResponse(file_path, headers=NO_CACHE_HEADERS)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"), headers=NO_CACHE_HEADERS)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
