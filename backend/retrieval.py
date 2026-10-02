"""
Cari chunk yang paling relevan sama pertanyaan user (retrieval),
lalu kirim ke Gemini buat dijawab berdasarkan chunk itu aja,
lengkap dengan sumbernya -- supaya jawaban tidak mengarang.
"""

import os
import time
import numpy as np
from dotenv import load_dotenv
from google import genai
from google.genai import types
from embedding_store import load_store, EMBED_MODEL

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

CHAT_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Ukur seberapa mirip dua vector -- makin dekat ke 1, makin mirip maknanya."""
    a_arr, b_arr = np.array(a), np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))


def decompose_sub_queries(question: str) -> list[str]:
    """
    Memecah pertanyaan majemuk (mengandung 'dan', 'serta', 'atau', '?')
    menjadi sub-pertanyaan mandiri HANYA jika berupa klausa pertanyaan utuh,
    bukan frasa kata benda majemuk (seperti 'resep dan bumbu').
    """
    import re
    question_words = {"siapa", "apa", "berapa", "bagaimana", "kapan", "dimana", "kenapa", "mengapa"}

    # Pecah jika ada tanda tanya '?' atau 'dan/serta' yang diikuti kata tanya
    parts = re.split(
        r"\s*\?\s*|\s+(?:dan|serta)\s+(?=(?:siapa|apa|berapa|bagaimana|kapan|dimana|kenapa|mengapa)\b)",
        question,
        flags=re.IGNORECASE,
    )

    sub_queries = []
    for p in parts:
        p_clean = p.strip()
        words = p_clean.split()
        if len(words) >= 4 and any(w.lower() in question_words for w in words):
            if p_clean.lower() != question.lower():
                sub_queries.append(p_clean)

    # Hilangkan duplikat dengan mempertahankan urutan
    all_q = [question]
    for sq in sub_queries:
        if sq not in all_q:
            all_q.append(sq)
    return all_q


def find_relevant_chunks(
    question: str,
    top_k: int = 12,
    similarity_threshold: float = 0.58,
    doc_filter: str = None,
) -> list[dict]:
    """
    Embed pertanyaan user dan cari chunk yang mirip di database vektor.
    - Mendukung Sub-Query Decomposition untuk pertanyaan majemuk.
    - Mendukung Similarity Threshold (chunk di bawah threshold dieliminasi).
    - Mendukung Metadata Filtering (--doc).
    """
    store = load_store()
    if not store:
        raise ValueError(
            "Belum ada data tersimpan. Jalankan `python main.py path/ke/file.pdf` dulu."
        )

    # TODO (Security / Multi-Tenant Architecture):
    # Saat fitur ini dibungkus menjadi REST API publik atau aplikasi multi-user,
    # parameter `doc_filter` HARUS divalidasi dan dibatasi berdasarkan hak akses (ACL/RBAC)
    # serta kepemilikan dokumen user yang sedang login (misal: user_id atau tenant_id).
    # JANGAN pernah menerima nama dokumen secara bebas mentah-mentah dari payload request client,
    # untuk mencegah celah keamanan IDOR (Insecure Direct Object Reference) dan kebocoran dokumen antar-tenant.
    if doc_filter:
        store = [
            item for item in store
            if doc_filter.lower() in item.get("source", "").lower()
        ]
        if not store:
            return []

    all_queries = decompose_sub_queries(question)

    scored_map = {}
    for q in all_queries:
        q_emb = get_client().models.embed_content(
            model=EMBED_MODEL, contents=q
        ).embeddings[0].values
        for idx, item in enumerate(store):
            sim = cosine_similarity(q_emb, item["embedding"])
            if idx not in scored_map or sim > scored_map[idx]["score"]:
                scored_map[idx] = {**item, "score": sim}

    # Filter berdasarkan similarity_threshold yang ditentukan secara empiris
    scored = [c for c in scored_map.values() if c["score"] >= similarity_threshold]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def rewrite_query(question: str, chat_history: list[tuple[str, str]] = None) -> str:
    """
    Multi-Turn Memory: Menulis ulang pertanyaan lanjutan yang menggunakan kata ganti
    (misal: 'dia', 'itu', 'tersebut', 'tadi') menjadi pertanyaan mandiri yang utuh
    sebelum dilakukan embedding/retrieval.
    """
    if not chat_history:
        return question

    history_text = "\n".join(
        f"User: {turn[0]}\nAssistant: {turn[1]}"
        for turn in chat_history[-3:]  # Ambil maksimal 3 giliran terakhir
    )

    prompt = f"""Kamu adalah query rewriter untuk sistem RAG dokumen.
Tugasmu: Analisis riwayat percakapan dan pertanyaan baru pengguna.
Jika pertanyaan baru merujuk pada subjek/objek sebelumnya (misal menggunakan kata ganti "dia", "itu", "tersebut", "tadi", atau kalimat elipsis), TULIS ULANG menjadi SATU pertanyaan mandiri yang lengkap tanpa kata ganti ambigu.
Jika pertanyaan baru sudah mandiri dan jelas, kembalikan teks aslinya tanpa diubah.
JANGAN menjawab pertanyaan. HANYA keluarkan satu kalimat pertanyaan hasil tulisan ulang.

RIWAYAT PERCAKAPAN:
{history_text}

PERTANYAAN BARU: {question}

PERTANYAAN MANDIRI HASIL REWRITE:"""

    try:
        response = get_client().models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        if response and response.text:
            rewritten = response.text.strip().strip('"').strip("'")
            if rewritten and rewritten.lower() != question.lower():
                print(f"  🔄 [Query Rewrite] '{question}' -> '{rewritten}'")
                return rewritten
    except Exception:
        pass

    return question


GUARDRAIL_PROMPT_TEMPLATE = """Kamu adalah asisten yang menjawab HANYA berdasarkan konteks di bawah ini.
Gunakan fakta yang ada di konteks secara teliti dan menyeluruh.
Kamu diperbolehkan melakukan penalaran logis yang didukung langsung oleh fakta konteks (misalnya: menghubungkan tahun angkatan dengan kode semester pada KHS/KRS, atau menghubungkan nama pemilik rekening dengan nomor rekening di lampiran dokumen yang sama).
Namun, jika informasi benar-benar tidak didukung oleh fakta konteks yang tersedia, katakan dengan jujur "Informasi tidak ditemukan di dokumen yang tersedia" -- JANGAN mengarang jawaban di luar fakta dokumen.
Selalu sebutkan dari file/sumber mana jawabanmu berasal (sertakan nomor halaman, nomor slide, atau nama sheet jika ada di konteks).

KONTEKS:
{context}

PERTANYAAN: {question}

JAWABAN:"""


def answer_question(
    question: str,
    top_k: int = 12,
    model_override: str = None,
    return_metrics: bool = False,
    similarity_threshold: float = 0.58,
    doc_filter: str = None,
    chat_history: list[tuple[str, str]] = None,
) -> str | tuple[str, dict]:
    """
    Alur terpadu satu pintu (Single Source of Truth) untuk menjawab pertanyaan:
    1. Query Rewriting jika ada riwayat percakapan (Multi-Turn Memory)
    2. Cari chunk relevan dengan ambang batas (Similarity Threshold & Doc Filter)
    3. Bypass LLM jika tidak ada chunk yang lolos threshold (Hemat biaya & waktu)
    4. Format prompt dengan guardrail ketat anti-halusinasi
    5. Kirim ke LLM dengan batasan konteks dokumen
    """
    import time
    t0 = time.time()

    # 1. Multi-turn Query Rewriting
    effective_query = rewrite_query(question, chat_history) if chat_history else question

    # 2. Vector Retrieval
    relevant = find_relevant_chunks(
        effective_query,
        top_k=top_k,
        similarity_threshold=similarity_threshold,
        doc_filter=doc_filter,
    )
    t_retrieval = time.time() - t0

    # 3. PENANGANAN SEMUA CHUNK DI BAWAH THRESHOLD:
    # Langsung jawab tanpa memanggil generate_content API (Bypass LLM)
    if not relevant:
        msg = "Informasi tidak ditemukan di dokumen yang tersedia."
        if return_metrics:
            return msg, {
                "model": "BYPASS_LLM (NO_CHUNKS_ABOVE_THRESHOLD)",
                "retrieval_sec": round(t_retrieval, 2),
                "generation_sec": 0.0,
                "total_sec": round(time.time() - t0, 2),
                "top_k": top_k,
                "chunks_retrieved": 0,
                "sources": [],
                "rewritten_query": effective_query,
            }
        return msg

    context = "\n\n".join(
        f"[Sumber: {r['source']}]\n{r['text']}" for r in relevant
    )

    prompt = GUARDRAIL_PROMPT_TEMPLATE.format(context=context, question=effective_query)

    models_to_try = [model_override] if model_override else CHAT_MODELS
    last_error = None
    t1 = time.time()
    for model_name in models_to_try:
        try:
            # Matikan thinking budget agar latensi instan (~1.5s - 2s)
            thinking_cfg = types.ThinkingConfig(thinking_budget=0) if any(v in model_name for v in ["2.5", "3.1", "3-flash"]) else None
            gen_config = types.GenerateContentConfig(
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                thinking_config=thinking_cfg,
            )
            response = get_client().models.generate_content(
                model=model_name,
                contents=prompt,
                config=gen_config,
            )
            t_generation = time.time() - t1
            total_time = time.time() - t0
            if response and response.text:
                if return_metrics:
                    metrics = {
                        "model": model_name,
                        "retrieval_sec": round(t_retrieval, 2),
                        "generation_sec": round(t_generation, 2),
                        "total_sec": round(total_time, 2),
                        "top_k": top_k,
                        "chunks_retrieved": len(relevant),
                        "sources": list(set(r["source"] for r in relevant)),
                        "rewritten_query": effective_query,
                    }
                    return response.text, metrics
                return response.text
        except Exception as e:
            last_error = e
            continue

    err_msg = f"Gagal mendapatkan jawaban dari server AI: {last_error}"
    if return_metrics:
        return err_msg, {
            "model": None,
            "error": str(last_error),
            "retrieval_sec": round(t_retrieval, 2),
            "generation_sec": round(time.time() - t1, 2),
            "total_sec": round(time.time() - t0, 2),
            "top_k": top_k,
            "chunks_retrieved": len(relevant),
            "rewritten_query": effective_query,
        }
    return err_msg


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="KnowledgeHub RAG QA Interactive System")
    parser.add_argument("--doc", type=str, help="Filter pencarian hanya pada dokumen tertentu")
    parser.add_argument("--threshold", type=float, default=0.58, help="Ambang batas cosine similarity (default: 0.58)")
    parser.add_argument("--top-k", type=int, default=12, help="Jumlah chunk maksimal (default: 12)")
    args = parser.parse_args()

    print("=== KnowledgeHub RAG QA System ===")
    if args.doc:
        print(f"Filter Dokumen Aktif: '{args.doc}'")
    print(f"Similarity Threshold: {args.threshold} | Top-K: {args.top_k}")
    print("Ketik pertanyaan Anda (atau ketik 'keluar' / 'exit' untuk selesai):\n")

    history: list[tuple[str, str]] = []

    while True:
        try:
            q = input("\n[Pertanyaan]: ").strip()
            if not q:
                continue
            if q.lower() in ("exit", "keluar", "q"):
                print("Sampai jumpa!")
                break
            print("\n[Jawaban]:")
            answer = answer_question(
                q,
                top_k=args.top_k,
                similarity_threshold=args.threshold,
                doc_filter=args.doc,
                chat_history=history,
            )
            print(answer)
            history.append((q, answer))
        except (KeyboardInterrupt, EOFError):
            print("\nSampai jumpa!")
            break
        except Exception as err:
            print(f"\n[Error]: {err}. Silakan coba lagi.")
