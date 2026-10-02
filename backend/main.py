"""
main.py - Pipeline RAG Ingestion dengan PII Consent Gate & Audit Log Compliance

Kebijakan Privasi (Default):
1. Redaksi WAJIB DEFAULT untuk kategori Risiko Tinggi (NIK, KK, Rekening, NPWP) dan Risiko Sedang (Tanggal Lahir).
2. Opsi `--allow-raw-pii`: Jika diaktifkan, memunculkan konfirmasi risiko tambahan sebelum data mentah disimpan.
3. Pre-OCR Scan Consent Gate: Secara eksplisit memperingatkan bahwa SELURUH ISI VISUAL gambar akan dikirim ke Gemini API.
4. Post-OCR PII Consent Gate: Menangkap PII baru yang terungkap dari hasil pindaian scan.
5. Pencatatan Audit Log ke `consent_log.json` dengan field `raw_pii_allowed` dan `redacted`.
"""

import sys
import os
import json
import argparse
from datetime import datetime
from chunking import (
    extract_digital_text,
    extract_text,
    chunk_text,
    SUPPORTED_EXTENSIONS,
)
from embedding_store import (
    embed_chunks,
    save_store,
    reset_store,
    delete_doc_from_store,
    list_stored_docs,
)
from pii_detector import (
    detect_pii,
    redact_pii,
    HIGH_RISK_CATEGORIES,
    MEDIUM_RISK_CATEGORIES,
)

CONSENT_LOG_PATH = os.environ.get(
    "CONSENT_LOG_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "consent_log.json")
    if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "consent_log.json"))
    else "consent_log.json",
)


def record_consent_audit(
    file_name: str,
    detected_pii: list[str],
    consent: bool,
    action: str,
    raw_pii_allowed: bool,
    redacted: bool,
):
    """
    Mencatat setiap keputusan persetujuan/penolakan ke file audit log JSON untuk compliance.
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "file": file_name,
        "detected_pii": detected_pii,
        "user_consent": consent,
        "action": action,
        "raw_pii_allowed": raw_pii_allowed,
        "redacted": redacted,
    }

    logs = []
    if os.path.exists(CONSENT_LOG_PATH):
        try:
            with open(CONSENT_LOG_PATH, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except Exception:
            logs = []

    logs.append(log_entry)

    with open(CONSENT_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)

    print(f"  [Audit Log] Dicatat ke '{CONSENT_LOG_PATH}' ({action} | raw_pii_allowed={raw_pii_allowed} | redacted={redacted}).")


def prompt_user_consent(prompt_text: str) -> bool:
    """Membaca input persetujuan pengguna (y/n) dengan aman."""
    try:
        ans = input(prompt_text).strip().lower()
        return ans in ("y", "ya", "yes")
    except (KeyboardInterrupt, EOFError):
        print("\nInput dibatalkan.")
        return False


MAX_ZIP_FILES = 100
MAX_ZIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024  # 100 MB


def process_zip_file(zip_path: str, allow_raw_pii: bool = False, keep_dob: bool = False):
    """
    Memproses file arsip (.zip):
    1. Validasi keamanan arsip (Zip Bomb & Zip Slip Path Traversal).
    2. Ekstrak ke folder sementara (tempfile).
    3. Proses setiap file di dalamnya yang didukung satu per satu.
    4. Setiap file diberi nama source gabungan: 'nama_zip.zip/rel_path' untuk sitasi presisi.
    5. File dengan format tidak didukung dilewati dengan pesan peringatan per file (tidak menggagalkan seluruh proses).
    6. Alur consent PII dijalankan per file di dalam zip.
    7. Pembersihan folder sementara dijamin di blok `finally:`.
    """
    import zipfile
    import tempfile
    import shutil

    print(f"\n========================================================")
    print(f"Membuka Arsip ZIP: {zip_path}")
    print(f"========================================================")

    if not os.path.exists(zip_path):
        print(f"[Error] File zip tidak ditemukan: {zip_path}")
        return

    try:
        zf = zipfile.ZipFile(zip_path, "r")
    except Exception as e:
        print(f"[Error] Gagal membuka file zip: {e}")
        return

    with zf:
        infolist = zf.infolist()

        # 1. Zip Bomb Check: Jumlah File
        if len(infolist) > MAX_ZIP_FILES:
            print(f"\n[Error] Potensi Zip Bomb terdeteksi!")
            print(f"Jumlah entri di dalam arsip ({len(infolist)}) melebihi batas aman ({MAX_ZIP_FILES} file).")
            print("Pemrosesan file zip dibatalkan demi keamanan sistem.\n")
            return

        # 2. Zip Bomb Check: Total Ukuran Uncompressed
        total_uncompressed = sum(info.file_size for info in infolist)
        if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
            size_mb = total_uncompressed / (1024 * 1024)
            limit_mb = MAX_ZIP_UNCOMPRESSED_BYTES / (1024 * 1024)
            print(f"\n[Error] Potensi Zip Bomb terdeteksi!")
            print(f"Total ukuran uncompressed ({size_mb:.2f} MB) melebihi batas aman ({limit_mb:.0f} MB).")
            print("Pemrosesan file zip dibatalkan demi keamanan sistem.\n")
            return

        # Folder sementara via tempfile
        temp_dir = tempfile.mkdtemp(prefix="knowledgehub_zip_")
        print(f"  [Folder Sementara] Dibuat di: {temp_dir}")

        try:
            # 3. Zip Slip (Path Traversal) Check
            for info in infolist:
                target_path = os.path.abspath(os.path.join(temp_dir, info.filename))
                if not target_path.startswith(os.path.abspath(temp_dir) + os.sep) and target_path != os.path.abspath(temp_dir):
                    print(f"\n[Error] Potensi serangan Zip Slip / Path Traversal terdeteksi pada entri: '{info.filename}'")
                    print("Pemrosesan file zip dibatalkan demi keamanan sistem.\n")
                    return

            zf.extractall(temp_dir)
            print(f"  [Ekstraksi ZIP] Berhasil mengekstrak {len(infolist)} entri ke folder sementara.")

            # Kumpulkan semua file di dalam folder sementara secara rekursif
            extracted_files = []
            for root, dirs, files in os.walk(temp_dir):
                for f in files:
                    full_p = os.path.join(root, f)
                    rel_p = os.path.relpath(full_p, temp_dir)
                    extracted_files.append((full_p, rel_p))

            extracted_files.sort(key=lambda x: x[1])

            zip_basename = os.path.basename(zip_path)
            processed_count = 0
            cancelled_count = 0
            skipped_count = 0

            inner_supported = SUPPORTED_EXTENSIONS - {".zip"}

            for full_p, rel_p in extracted_files:
                inner_ext = os.path.splitext(rel_p)[1].lower()
                combined_source = f"{zip_basename}/{rel_p}"

                if inner_ext in (".zip", ""):
                    print(f"\n  [Peringatan Arsip] Melewati '{rel_p}': Berkas tanpa ekstensi atau nested ZIP tidak didukung.")
                    skipped_count += 1
                    continue

                if inner_ext not in inner_supported:
                    print(f"\n  [Peringatan Arsip] Melewati '{rel_p}': Tipe file '{inner_ext}' belum didukung.")
                    skipped_count += 1
                    continue

                print(f"\n>>> Memproses file arsip: {combined_source} <<<")
                success = process_file(
                    full_p,
                    allow_raw_pii=allow_raw_pii,
                    keep_dob=keep_dob,
                    source_name=combined_source,
                )
                if success:
                    processed_count += 1
                else:
                    cancelled_count += 1

            print(f"\n========================================================")
            print(f"SELESAI MEMPROSES ARSIP: {zip_path}")
            print(f"File tersimpan: {processed_count} | File ditolak/batal: {cancelled_count} | File dilewati: {skipped_count}")
            print(f"========================================================")

        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
            is_cleaned = not os.path.exists(temp_dir)
            print(f"  [Pembersihan Sementara] Folder '{temp_dir}' berhasil dihapus: {is_cleaned}\n")


def process_file(
    file_path: str,
    allow_raw_pii: bool = False,
    keep_dob: bool = False,
    source_name: str = None,
):
    actual_source = source_name or file_path
    print(f"\n========================================================")
    print(f"Memproses Dokumen: {actual_source}")
    print(f"Kebijakan Redaksi : WAJIB DEFAULT (Aktif Otomatis)")
    print(f"Opsi Allow Raw PII: {'AKTIF' if allow_raw_pii else 'NONAKTIF'}")
    print(f"========================================================")

    if not os.path.exists(file_path):
        print(f"[Error] File tidak ditemukan: {file_path}")
        return False

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        supported_str = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        print(f"\n[Error] Tipe file '{ext}' belum didukung.")
        print(f"Format yang didukung saat ini: {supported_str}\n")
        return False

    # Khusus file arsip .zip: delegasikan ke process_zip_file
    if ext == ".zip":
        process_zip_file(file_path, allow_raw_pii=allow_raw_pii, keep_dob=keep_dob)
        return True

    is_standalone_image = ext in (".jpg", ".jpeg", ".png")

    # TAHAP 1: Ekstraksi Teks Digital Lokal (100% Offline Tanpa AI/API)
    print("\n[Tahap 1] Ekstraksi teks digital lokal secara offline...")
    try:
        digital_text, scanned_pages = extract_digital_text(file_path)
    except ValueError as ve:
        print(f"\n[Error] {ve}\n")
        return False

    # TAHAP 2: Deteksi PII Lokal Awal (pada teks digital)
    detected_pii_initial = detect_pii(digital_text)

    if detected_pii_initial:
        print("\n" + "!" * 58)
        print("PERINGATAN: DATA PRIBADI (PII) TERDETEKSI!")
        print("!" * 58)
        print(f"Dokumen   : {actual_source}")
        print("Kategori PII yang ditemukan pada teks digital:")
        for cat in detected_pii_initial:
            risk_label = "[RISIKO TINGGI]" if cat in HIGH_RISK_CATEGORIES else "[RISIKO SEDANG]"
            print(f"  * {risk_label} {cat}")
        print("-" * 58)
        print("Kebijakan Privasi: Secara default, seluruh data pribadi")
        print("akan DI-REDAKSI (disamarkan) otomatis sebelum disimpan.")
        print("!" * 58)

        approved = prompt_user_consent("Apakah Anda menyetujui pemrosesan dokumen ini? (y/n): ")
        if not approved:
            print("\n[DIBATALKAN] Pemrosesan dihentikan sesuai keputusan pengguna.")
            print("Tidak ada data yang dikirim ke API atau disimpan ke database vektor.")
            record_consent_audit(
                file_name=actual_source,
                detected_pii=detected_pii_initial,
                consent=False,
                action="REJECTED_PRE_OCR_PII",
                raw_pii_allowed=False,
                redacted=False,
            )
            return False

        print("-> Persetujuan pemrosesan awal diberikan oleh pengguna.")

    # TAHAP 3: Consent Gate Khusus Gambar (PRE-OCR)
    if is_standalone_image:
        print("\n" + "=" * 60)
        print("[PERSETUJUAN PENGIRIMAN GAMBAR KE GEMINI API (PRE-OCR)]")
        print("=" * 60)
        print(f"File ini adalah gambar berdiri sendiri: {actual_source}")
        print("yang akan dikirim ke Gemini API (pihak ketiga) untuk dibaca via Vision OCR.")
        print("\nPENTING (KEBIJAKAN PRIVASI):")
        print("SELURUH ISI VISUAL gambar ini akan dikirim ke API eksternal,")
        print("bukan cuma bagian yang nanti terdeteksi sebagai teks sensitif --")
        print("karena elemen visual seperti foto wajah, tanda tangan basah, cap/stempel,")
        print("atau metadata visual TIDAK BISA dideteksi/disaring regex lokal sebelum di-OCR.")
        print("=" * 60)

        ocr_approved = prompt_user_consent("Lanjutkan pengiriman dan pembacaan gambar via Gemini Vision OCR? (y/n): ")
        if not ocr_approved:
            print("\n[DIBATALKAN] Pengguna menolak pengiriman file gambar ke Gemini API.")
            print("Pemrosesan dibatalkan. Tidak ada data gambar yang dikirim ke API eksternal.")
            record_consent_audit(
                file_name=actual_source,
                detected_pii=[],
                consent=False,
                action="REJECTED_STANDALONE_IMAGE_GATE",
                raw_pii_allowed=False,
                redacted=False,
            )
            return False

        print("-> Persetujuan OCR gambar berdiri sendiri diberikan oleh pengguna.")

    elif scanned_pages:
        n_scanned = len(scanned_pages)
        pages_str = ", ".join(str(p) for p in scanned_pages)
        print("\n" + "=" * 60)
        print("[PERSETUJUAN PENGIRIMAN GAMBAR SCAN KE GEMINI API]")
        print("=" * 60)
        print(f"Dokumen ini memiliki {n_scanned} halaman berupa gambar scan (Halaman {pages_str})")
        print("yang akan dikirim ke Gemini API (pihak ketiga) untuk dibaca.")
        print("\nPENTING (KEBIJAKAN PRIVASI):")
        print("SELURUH ISI VISUAL gambar akan dikirim ke API pihak ketiga,")
        print("bukan cuma bagian yang nanti terdeteksi sebagai teks sensitif --")
        print("karena elemen visual seperti tanda tangan basah, cap/stempel,")
        print("atau pas foto TIDAK BISA dideteksi atau disaring oleh regex lokal.")
        print("=" * 60)

        ocr_approved = prompt_user_consent("Lanjutkan pengiriman dan pembacaan gambar scan? (y/n): ")
        if not ocr_approved:
            print("\n[DIBATALKAN] Pengguna menolak pengiriman halaman scan ke Gemini API.")
            print("Pemrosesan dokumen dihentikan. Tidak ada gambar yang dikirim ke API eksternal.")
            record_consent_audit(
                file_name=actual_source,
                detected_pii=detected_pii_initial,
                consent=False,
                action="REJECTED_OCR_SCAN_GATE",
                raw_pii_allowed=False,
                redacted=False,
            )
            return False

        print(f"-> Persetujuan OCR diberikan oleh pengguna untuk {n_scanned} halaman scan.")

    # TAHAP 4: Ekstraksi Lengkap (Gemini Vision OCR dijalankan jika ada gambar)
    print("\n[Tahap 2] Membaca isi dokumen lengkap (OCR jika ada gambar)...")
    full_text = extract_text(file_path, allow_ocr=True)

    if not full_text.strip():
        print(f"[Peringatan] Tidak ada teks yang berhasil diekstraksi dari '{actual_source}'.")
        return False

    # TAHAP 5: Consent Gate Lapis Kedua (Post-OCR: Jika hasil OCR memuat PII baru)
    detected_pii_full = detect_pii(full_text)
    new_categories = [c for c in detected_pii_full if c not in detected_pii_initial]

    if new_categories:
        print("\n" + "!" * 58)
        print("PERINGATAN (LAPIS 2): DATA PRIBADI TERDETEKSI DARI GAMBAR SCAN/OCR!")
        print("!" * 58)
        print(f"Dokumen   : {actual_source}")
        print("Kategori baru yang ditemukan dari hasil scan:")
        for cat in new_categories:
            risk_label = "[RISIKO TINGGI]" if cat in HIGH_RISK_CATEGORIES else "[RISIKO SEDANG]"
            print(f"  * {risk_label} {cat}")
        print("-" * 58)
        print("Kebijakan Privasi: Data ini otomatis disamarkan (redacted) secara default.")
        print("!" * 58)

        post_approved = prompt_user_consent(
            "Apakah Anda menyetujui data hasil scan ini di-embed dan disimpan? (y/n): "
        )
        if not post_approved:
            print("\n[DIBATALKAN] Pemrosesan dihentikan setelah hasil OCR terdeteksi memuat data pribadi.")
            print("Tidak ada data yang disimpan ke vector_store.json.")
            record_consent_audit(
                file_name=actual_source,
                detected_pii=detected_pii_full,
                consent=False,
                action="REJECTED_POST_OCR_PII",
                raw_pii_allowed=False,
                redacted=False,
            )
            return False

        print("-> Persetujuan pasca-OCR diberikan oleh pengguna.")

    # TAHAP 6: Evaluasi Kebijakan Redaksi Default vs Opsi --allow-raw-pii
    all_detected_pii = detected_pii_full
    high_risk_detected = [c for c in all_detected_pii if c in HIGH_RISK_CATEGORIES]
    medium_risk_detected = [c for c in all_detected_pii if c in MEDIUM_RISK_CATEGORIES]

    raw_pii_allowed = False
    redact_high_risk = bool(high_risk_detected)
    redact_medium_risk = bool(medium_risk_detected)

    # Jika user mengaktifkan flag --allow-raw-pii
    if allow_raw_pii:
        if high_risk_detected:
            # Langkah konfirmasi tambahan khusus risiko tinggi
            kategori_str = ", ".join(high_risk_detected)
            print("\n" + "=" * 60)
            print("[KONFIRMASI KHUSUS: PENYIMPANAN DATA MENTAH RISIKO TINGGI]")
            print("=" * 60)
            print(f"Kamu memilih menyimpan {kategori_str} dalam bentuk tidak disamarkan.")
            print("Data ini akan tersimpan utuh di database dan bisa muncul di jawaban pencarian.")
            print("=" * 60)

            confirm_raw = prompt_user_consent("Lanjutkan? (y/n): ")
            if confirm_raw:
                raw_pii_allowed = True
                redact_high_risk = False
                redact_medium_risk = False
                print("-> [Konfirmasi Diterima] Data risiko tinggi akan disimpan secara mentah (unmasked).")
            else:
                raw_pii_allowed = False
                redact_high_risk = True
                redact_medium_risk = bool(medium_risk_detected)
                print("-> [Dibatalkan User] Beralih ke kebijakan aman: Seluruh data pribadi otomatis disamarkan (redacted).")
        else:
            raw_pii_allowed = True
            redact_medium_risk = False
    elif keep_dob:
        redact_medium_risk = False

    # TAHAP 7: Eksekusi Redaksi
    is_redacted = False
    if redact_high_risk or redact_medium_risk:
        full_text = redact_pii(
            full_text,
            redact_high_risk=redact_high_risk,
            redact_medium_risk=redact_medium_risk,
        )
        is_redacted = True
        print("\n[Tahap 3] Menjalankan redaksi default (masking data sensitif)...")
        if redact_high_risk:
            print("  -> Kategori Risiko Tinggi (NIK, KK, Rekening, NPWP) disamarkan.")
        if redact_medium_risk:
            print("  -> Kategori Risiko Sedang (Tanggal Lahir) disamarkan.")
    elif all_detected_pii:
        print("\n[Tahap 3] Melewati redaksi (data mentah disimpan sesuai konfirmasi pengguna)...")

    # Catat audit log keputusan akhir
    action_status = "PROCESSED_WITH_REDACTION" if is_redacted else (
        "PROCESSED_RAW_PII" if raw_pii_allowed else "NO_PII_DETECTED"
    )
    record_consent_audit(
        file_name=actual_source,
        detected_pii=all_detected_pii,
        consent=True,
        action=action_status,
        raw_pii_allowed=raw_pii_allowed,
        redacted=is_redacted,
    )

    # TAHAP 8: Table-Aware Chunking
    print("\n[Tahap 4] Pemecahan teks menjadi chunk (Table-Aware Chunking)...")
    chunks = chunk_text(full_text)
    print(f"  -> Dokumen berhasil dipecah menjadi {len(chunks)} chunk.")

    # TAHAP 9: Embedding via Gemini API
    print("\n[Tahap 5] Membuat vektor embedding via Gemini Embedding API...")
    vectors = embed_chunks(chunks)
    print(f"  -> Berhasil membuat {len(vectors)} vektor embedding.")

    # TAHAP 10: Penyimpanan ke Database Vektor
    print("\n[Tahap 6] Menyimpan ke database vektor...")
    save_store(chunks, vectors, source_file=actual_source)

    print("\n========================================================")
    print("PROSES SELESAI!")
    print(f"Dokumen '{actual_source}' siap untuk ditanya via `python retrieval.py`.")
    print("========================================================\n")
    return True


def sanitize_argv(argv: list[str]) -> list[str]:
    """
    Menangani kasus di mana pengguna mengetik nama file ber-spasi tanpa tanda kutip,
    misalnya: python main.py The Case - CALIBER 2026.pdf
    Jika bagian-bagian argumen dapat digabungkan menjadi file yang valid di disk,
    maka otomatis disatukan menjadi satu argumen utuh.
    """
    known_flags = {"--status", "--reset", "--allow-raw-pii", "--keep-dob", "-h", "--help"}
    new_argv = []
    file_parts = []
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in known_flags:
            new_argv.append(arg)
            i += 1
        elif arg == "--remove":
            new_argv.append(arg)
            if i + 1 < len(argv):
                new_argv.append(argv[i + 1])
                i += 2
            else:
                i += 1
        else:
            file_parts.append(arg)
            i += 1

    if file_parts:
        candidate = " ".join(file_parts)
        if os.path.exists(candidate):
            new_argv.append(candidate)
        else:
            new_argv.extend(file_parts)
    return new_argv


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="KnowledgeHub RAG Ingestion & Database Management"
    )
    parser.add_argument("file_path", nargs="?", help="Path ke file (PDF, DOCX, TXT, MD, CSV, PPTX, XLSX, JPG, JPEG, PNG, ZIP) yang ingin diproses/diupdate")
    parser.add_argument(
        "--status",
        action="store_true",
        help="Tampilkan ringkasan dokumen yang tersimpan di memori AI",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Kosongkan seluruh database vektor AI (mulai fresh dari nol)",
    )
    parser.add_argument(
        "--remove",
        type=str,
        help="Hapus dokumen tertentu dari database vektor",
    )
    parser.add_argument(
        "--allow-raw-pii",
        action="store_true",
        help="Izinkan penyimpanan data pribadi mentah tanpa redaksi (memerlukan konfirmasi risiko tambahan untuk kategori tinggi)",
    )
    parser.add_argument(
        "--keep-dob",
        action="store_true",
        help="Toggle khusus untuk membiarkan tanggal lahir tetap mentah tanpa menyentuh kategori risiko tinggi",
    )

    args = parser.parse_args(sanitize_argv(sys.argv[1:]))

    if args.status:
        docs = list_stored_docs()
        print("\n=== STATUS DATABASE VEKTOR KNOWLEDGEHUB ===")
        if not docs:
            print("Database kosong. Belum ada dokumen yang tersimpan.")
        else:
            total_chunks = sum(docs.values())
            print(f"Total dokumen: {len(docs)} | Total chunk: {total_chunks}")
            for doc, count in docs.items():
                print(f"  📄 {doc}: {count} chunk")
        print("===========================================\n")
        sys.exit(0)

    if args.reset:
        confirm = input("⚠️ Yakin ingin MENGHAPUS SEMUA dokumen di database AI? (y/n): ").strip().lower()
        if confirm == "y":
            reset_store()
        else:
            print("Aksi reset dibatalkan.")
        sys.exit(0)

    if args.remove:
        delete_doc_from_store(args.remove)
        sys.exit(0)

    if not args.file_path:
        parser.print_help()
        sys.exit(1)

    process_file(
        args.file_path,
        allow_raw_pii=args.allow_raw_pii,
        keep_dob=args.keep_dob,
    )
