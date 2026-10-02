"""
Ubah tiap chunk teks jadi vector (embedding) pakai Gemini API,
lalu simpan hasilnya ke file JSON sebagai penyimpanan sementara.

Ini BUKAN vector database beneran -- cuma buat validasi pipeline
dulu. Nanti di tahap lanjut, ini diganti Qdrant/vector DB lain.
"""

import json
import os
from dotenv import load_dotenv
from google import genai

# Muat .env dari repo root maupun backend dir
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
load_dotenv()

_client = None

def get_client():
    global _client
    if _client is None:
        _client = genai.Client()
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
    result = client.models.embed_content(model=EMBED_MODEL, contents=chunks)
    return [e.values for e in result.embeddings]


def save_store(chunks: list[str], vectors: list[list[float]], source_file: str):
    """
    Simpan chunk + vector-nya ke file JSON, sekalian nyimpen nama file
    sumber -- ini yang nanti dipakai buat kasih citation ke user.
    """
    data = []
    if os.path.exists(STORE_PATH):
        with open(STORE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

    # Hapus data lama dari source_file yang sama jika ada (deduplikasi)
    data = [item for item in data if item.get("source") != source_file]

    for chunk, vector in zip(chunks, vectors):
        data.append({
            "source": source_file,
            "text": chunk,
            "embedding": vector,
        })

    with open(STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Tersimpan {len(chunks)} chunk dari '{source_file}' ke {STORE_PATH}")


def load_store() -> list[dict]:
    """Baca semua chunk + vector yang udah pernah disimpan."""
    if not os.path.exists(STORE_PATH):
        return []
    with open(STORE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def reset_store():
    """Hapus seluruh database vektor agar kembali fresh/bersih dari nol."""
    if os.path.exists(STORE_PATH):
        os.remove(STORE_PATH)
        print(f"✅ Database '{STORE_PATH}' berhasil direset/dikosongkan.")
    else:
        print(f"ℹ️ Database '{STORE_PATH}' sudah dalam keadaan kosong.")


def delete_doc_from_store(source_file: str):
    """Hapus chunk dari satu dokumen spesifik dari database."""
    data = load_store()
    initial_len = len(data)
    data = [item for item in data if item.get("source") != source_file]
    if len(data) < initial_len:
        with open(STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ Dokumen '{source_file}' berhasil dihapus ({initial_len - len(data)} chunk dihapus).")
    else:
        print(f"ℹ️ Dokumen '{source_file}' tidak ditemukan di database.")


def list_stored_docs() -> dict[str, int]:
    """Tampilkan daftar semua file dokumen yang tersimpan beserta jumlah chunk-nya."""
    data = load_store()
    summary = {}
    for item in data:
        src = item.get("source", "unknown")
        summary[src] = summary.get(src, 0) + 1
    return summary
