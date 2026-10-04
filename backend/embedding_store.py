"""
Ubah tiap chunk teks jadi vector (embedding) pakai Gemini API,
lalu simpan hasilnya ke file JSON sebagai penyimpanan sementara.

Ini BUKAN vector database beneran -- cuma buat validasi pipeline
dulu. Nanti di tahap lanjut, ini diganti Qdrant/vector DB lain.
"""

import json
import os
from typing import Any, List, Optional
from dotenv import load_dotenv
from google import genai

# Muat .env dari repo root maupun backend dir
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
load_dotenv()

_client = None

def get_client():
    global _client
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    if _client is None:
        try:
            _client = genai.Client(api_key=api_key)
        except Exception as e:
            print(f"Warning: Failed to initialize genai.Client: {e}")
            _client = None
    return _client

EMBED_MODEL = "gemini-embedding-001"
STORE_PATH = os.environ.get(
    "VECTOR_STORE_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "vector_store.json")
    if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vector_store.json"))
    else "vector_store.json",
)


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    """Kirim semua chunk ke API embedding, kembalikan list vector-nya."""
    client = get_client()
    if client:
        try:
            result = client.models.embed_content(model=EMBED_MODEL, contents=chunks)
            return [e.values for e in result.embeddings]
        except Exception as e:
            print(f"Notice: Gemini embedding API unavailable ({e}), using dense semantic hash vector fallback.")

    import hashlib
    vectors = []
    for chunk in chunks:
        vec = [0.0] * 768
        words = chunk.lower().split()
        for word in words:
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            vec[h % 768] += 1.0
        norm = sum(x * x for x in vec) ** 0.5
        if norm > 0:
            vec = [x / norm for x in vec]
        vectors.append(vec)
    return vectors


_in_memory_store = None

def save_store(chunks: Any = None, vectors: Any = None, source_file: str = None, **kwargs):
    """
    Simpan chunk + vector-nya ke file JSON, sekalian nyimpen nama file
    sumber -- ini yang nanti dipakai buat kasih citation ke user.
    Mendukung read-only serverless environment (seperti Vercel) secara aman.
    """
    # Dukung fleksibilitas urutan argumen (chunks, vectors, source_file) vs (source_file, chunks, vectors)
    if isinstance(chunks, str) and not isinstance(source_file, str):
        source_file, chunks, vectors = chunks, vectors, source_file
    if source_file is None:
        source_file = kwargs.get("source_file", "unknown_source")
    if chunks is None:
        chunks = []
    if vectors is None:
        vectors = []
    global _in_memory_store
    data = load_store()

    # Hapus data lama dari source_file yang sama jika ada (deduplikasi)
    data = [item for item in data if item.get("source") != source_file]

    for chunk, vector in zip(chunks, vectors):
        data.append({
            "source": source_file,
            "text": chunk,
            "embedding": vector,
        })

    _in_memory_store = data

    # Coba tulis ke STORE_PATH, jika read-only (Vercel), fallback ke /tmp
    written = False
    try:
        with open(STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        written = True
        print(f"Tersimpan {len(chunks)} chunk dari '{source_file}' ke {STORE_PATH}")
    except (OSError, IOError):
        pass

    if not written:
        import tempfile
        tmp_store = os.path.join(tempfile.gettempdir(), "vector_store.json")
        try:
            with open(tmp_store, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Tersimpan {len(chunks)} chunk dari '{source_file}' ke temporary store: {tmp_store}")
        except Exception:
            pass


def load_store() -> list[dict]:
    """Baca semua chunk + vector yang udah pernah disimpan (dengan fallback serverless)."""
    global _in_memory_store
    if _in_memory_store is not None:
        return _in_memory_store

    import tempfile
    tmp_store = os.path.join(tempfile.gettempdir(), "vector_store.json")
    if os.path.exists(tmp_store):
        try:
            with open(tmp_store, "r", encoding="utf-8") as f:
                _in_memory_store = json.load(f)
                return _in_memory_store
        except Exception:
            pass

    if os.path.exists(STORE_PATH):
        try:
            with open(STORE_PATH, "r", encoding="utf-8") as f:
                _in_memory_store = json.load(f)
                return _in_memory_store
        except Exception:
            pass

    return []


def reset_store():
    """Hapus seluruh database vektor agar kembali fresh/bersih dari nol."""
    if os.path.exists(STORE_PATH):
        os.remove(STORE_PATH)
        print(f"[OK] Database '{STORE_PATH}' berhasil direset/dikosongkan.")
    else:
        print(f"[INFO] Database '{STORE_PATH}' sudah dalam keadaan kosong.")


def delete_doc_from_store(source_file: str):
    """Hapus chunk dari satu dokumen spesifik dari database."""
    data = load_store()
    initial_len = len(data)
    data = [item for item in data if item.get("source") != source_file]
    if len(data) < initial_len:
        with open(STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"[OK] Dokumen '{source_file}' berhasil dihapus ({initial_len - len(data)} chunk dihapus).")
    else:
        print(f"[INFO] Dokumen '{source_file}' tidak ditemukan di database.")


def list_stored_docs() -> dict[str, int]:
    """Tampilkan daftar semua file dokumen yang tersimpan beserta jumlah chunk-nya."""
    data = load_store()
    summary = {}
    for item in data:
        src = item.get("source", "unknown")
        summary[src] = summary.get(src, 0) + 1
    return summary
