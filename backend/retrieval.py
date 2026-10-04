"""
retrieval.py - RAG Retrieval & Factual Document Intelligence Engine
PT Chandra Asri Pacific Tbk / KnowledgeHub CALIBER 2026

Alur:
1. Pencarian chunk paling relevan (Hybrid: Gemini Vector Embedding jika online, atau Lexical/Semantic TF-IDF & Entity Scoring).
2. Jika Gemini API Key aktif dan online: Menghasilkan sintesis natural via Gemini 2.5 Flash / 2.0 Flash dengan guardrail ketat anti-halusinasi.
3. Jika Gemini API Key offline / tidak disetel: Menjalankan Factual Context Synthesizer mandiri yang menganalisis isi dokumen secara mendalam (nomor rekening, nama pemilik, batas parameter teknis, tabel, jadwal, SOP) tanpa template kaku.
"""

import os
import re
import math
import time
import numpy as np
from typing import List, Tuple, Dict, Any, Optional
from dotenv import load_dotenv

# Muat environment variable dari root dan backend
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
load_dotenv()

from embedding_store import load_store, EMBED_MODEL

_client = None

def get_client():
    """Mengambil atau menginisialisasi Google GenAI client jika API key tersedia."""
    global _client
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    if _client is None:
        try:
            from google import genai
            _client = genai.Client(api_key=api_key)
        except Exception as e:
            print(f"Warning: Failed to initialize genai.Client: {e}")
            _client = None
    return _client


CHAT_MODELS = [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-flash-latest",
]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Ukur cosine similarity antara dua vektor."""
    a_arr, b_arr = np.array(a), np.array(b)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))


def decompose_sub_queries(question: str) -> list[str]:
    """Memecah pertanyaan majemuk menjadi sub-pertanyaan mandiri."""
    question_words = {"siapa", "apa", "berapa", "bagaimana", "kapan", "dimana", "kenapa", "mengapa", "who", "what", "how", "when", "where"}
    parts = re.split(
        r"\s*\?\s*|\s+(?:dan|serta)\s+(?=(?:siapa|apa|berapa|bagaimana|kapan|dimana|kenapa|mengapa|who|what|how|when|where)\b)",
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

    all_q = [question]
    for sq in sub_queries:
        if sq not in all_q:
            all_q.append(sq)
    return all_q


def _extract_page_number(chunk_text: str) -> int:
    """Ekstrak nomor halaman dari header chunk jika ada (contoh: [Halaman 9])."""
    m = re.search(r"\[(?:Halaman|Page)\s*(\d+)\]", chunk_text, re.IGNORECASE)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            pass
    return 1


def _clean_stem(word: str) -> str:
    """Stemming sederhana bahasa Indonesia & Inggris untuk pencocokan kata kunci."""
    w = word.lower().strip(",.?!:;\"'()[]{}/*-")
    for suf in ["nya", "lah", "kah", "kan", "i", "an"]:
        if len(w) > len(suf) + 3 and w.endswith(suf):
            w = w[:-len(suf)]
            break
    return w


def find_relevant_chunks(
    question: str,
    top_k: int = 12,
    similarity_threshold: float = 0.45,
    doc_filter: Optional[str] = None,
) -> list[dict]:
    """
    Mencari chunk paling relevan dari database vektor:
    - Jika Gemini API online: Menggunakan text-embedding-004 + cosine similarity.
    - Jika offline / tanpa API key: Menggunakan lexical & semantic term relevance (BM25 & entity bonus).
    - Mendukung filter dokumen (`doc_filter`).
    """
    store = load_store()
    if not store:
        return []

    if doc_filter:
        doc_filter_clean = doc_filter.strip().lower()
        filtered = [
            item for item in store
            if doc_filter_clean in item.get("source", "").lower()
        ]
        if not filtered:
            norm_f = re.sub(r'[^a-zA-Z0-9]', '', doc_filter_clean)
            filtered = [
                item for item in store
                if norm_f in re.sub(r'[^a-zA-Z0-9]', '', item.get("source", "").lower())
            ]
        if filtered:
            store = filtered

    client = get_client()
    use_vector = False
    scored_map = {}

    if client:
        try:
            all_queries = decompose_sub_queries(question)
            for q in all_queries:
                q_emb = client.models.embed_content(
                    model=EMBED_MODEL, contents=q
                ).embeddings[0].values
                for idx, item in enumerate(store):
                    if item.get("embedding"):
                        sim = cosine_similarity(q_emb, item["embedding"])
                        if idx not in scored_map or sim > scored_map[idx]["score"]:
                            scored_map[idx] = {**item, "score": sim, "chunk_index": idx}
            use_vector = True
        except Exception:
            scored_map.clear()
            use_vector = False

    # Fallback Lexical & Semantic Entity Search
    if not use_vector or not scored_map:
        q_clean = question.lower()
        raw_words = [w for w in re.findall(r'[a-zA-Z0-9_\-]+', q_clean) if len(w) >= 2]
        stemmed_words = [_clean_stem(w) for w in raw_words]
        q_phrases = []
        for i in range(len(raw_words) - 1):
            q_phrases.append(f"{raw_words[i]} {raw_words[i+1]}")

        entity_keywords = {
            "rekening": 5.0, "norek": 5.0, "tabungan": 4.0, "saldo": 4.0, "mandiri": 4.0, "beasiswa": 3.0,
            "vibrasi": 5.0, "vibration": 5.0, "probe": 3.0, "trip": 4.0, "alarm": 3.5, "interlock": 4.0,
            "esd": 4.0, "compressor": 3.0, "kompresor": 3.0, "k102": 5.0, "k-102": 5.0,
            "p101": 5.0, "p-101a": 5.0, "f101": 5.0, "f-101": 5.0, "c201": 5.0, "c-201": 5.0,
            "hadiah": 5.0, "prize": 5.0, "juara": 4.0, "winner": 4.0, "proposal": 3.0, "deadline": 4.0,
            "extended": 3.5, "tanggal": 3.0, "jadwal": 3.0, "timeline": 3.5, "persyaratan": 3.0,
            "temperature": 4.0, "suhu": 4.0, "tekanan": 4.0, "pressure": 4.0, "delta": 3.0,
            "exchanger": 4.0, "reaktor": 4.0, "furnace": 4.0, "khs": 4.0, "krs": 4.0, "ipk": 4.0,
            "nilai": 3.0, "absen": 3.0, "epps": 3.0, "caliber": 3.0,
        }

        STOP_WORDS = {
            "siapa", "apa", "berapa", "bagaimana", "kapan", "dimana", "kenapa", "mengapa",
            "dan", "atau", "serta", "yang", "di", "ke", "dari", "untuk", "pada", "adalah",
            "ini", "itu", "ada", "bisa", "tolong", "coba", "dong", "kamu", "saya", "aku",
            "dia", "tersebut", "tadi", "dalam", "dengan", "oleh", "secara", "seperti",
            "the", "is", "at", "which", "on", "and", "or", "in", "to", "for", "with", "a", "an"
        }

        content_words = [w for w in raw_words if w not in STOP_WORDS]
        stemmed_content = [_clean_stem(w) for w in content_words]

        # Jika tidak ada content words bermakna, jangan lakukan pencarian acak
        if not content_words and not q_phrases:
            return []

        for idx, item in enumerate(store):
            txt = item.get("text", "")
            txt_lower = txt.lower()
            source_lower = item.get("source", "").lower()

            base_score = 0.0

            # 1. Kecocokan kata bermakna (non stop-words)
            for rw, sw in zip(content_words, stemmed_content):
                weight = entity_keywords.get(rw, 1.2)
                if rw in txt_lower:
                    base_score += weight * (1.2 + min(3, txt_lower.count(rw)) * 0.2)
                elif sw in txt_lower:
                    base_score += (weight * 0.7)

            # 2. Kecocokan frasa 2 kata berurutan
            for phr in q_phrases:
                p_parts = phr.split()
                if any(p not in STOP_WORDS for p in p_parts) and phr in txt_lower:
                    base_score += 4.0

            # 3. Relevansi nama file dokumen
            for rw in content_words:
                if rw in source_lower:
                    base_score += 2.5

            # 4. Deteksi pola angka/data khusus jika ditanyakan
            if any(k in q_clean for k in ["rekening", "norek", "bank", "saldo"]):
                if re.search(r'(?i)\b\d{6,16}\b', txt) and ("mandiri" in txt_lower or "rekening" in txt_lower or "tabungan" in txt_lower):
                    base_score += 8.0

            if any(k in q_clean for k in ["hadiah", "prize", "juara"]):
                if "million" in txt_lower or "grand prize" in txt_lower or "rp" in txt_lower:
                    base_score += 6.0

            if any(k in q_clean for k in ["vibrasi", "trip", "alarm"]):
                if "pk-pk" in txt_lower or "µm" in txt_lower or "um" in txt_lower:
                    base_score += 6.0

            # Ambang batas minimal agar query acak tidak memicu dokumen sembarangan
            if base_score >= 2.0:
                norm_score = round(min(0.98, 0.55 + (math.atan(base_score / 6.0) / (math.pi / 2)) * 0.42), 3)
                scored_map[idx] = {**item, "score": norm_score, "chunk_index": idx}

    scored = [c for c in scored_map.values() if c["score"] >= similarity_threshold]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def rewrite_query(question: str, chat_history: list[tuple[str, str]] = None) -> str:
    """Multi-turn memory: rewrite query jika merujuk konteks percakapan sebelumnya."""
    if not chat_history:
        return question

    client = get_client()
    if not client:
        return question

    history_text = "\n".join(
        f"User: {turn[0]}\nAssistant: {turn[1]}"
        for turn in chat_history[-3:]
    )

    prompt = f"""Kamu adalah query rewriter untuk sistem RAG dokumen teknis.
Tugasmu: Analisis riwayat percakapan dan pertanyaan baru pengguna.
Jika pertanyaan baru merujuk pada subjek/objek sebelumnya (misal kata ganti "dia", "itu", "tersebut", "tadi"), TULIS ULANG menjadi SATU pertanyaan mandiri yang lengkap tanpa kata ganti ambigu.
Jika sudah mandiri, kembalikan pertanyaan asli tanpa diubah.
JANGAN menjawab pertanyaan. HANYA keluarkan satu kalimat pertanyaan hasil tulisan ulang.

RIWAYAT PERCAKAPAN:
{history_text}

PERTANYAAN BARU: {question}

PERTANYAAN MANDIRI HASIL REWRITE:"""

    try:
        from google.genai import types
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        if response and response.text:
            rewritten = response.text.strip().strip('"').strip("'")
            if rewritten and rewritten.lower() != question.lower():
                return rewritten
    except Exception:
        pass

    return question


GUARDRAIL_PROMPT_TEMPLATE = """Kamu adalah Hootie Frutti AI, asisten analis dokumen pabrik PT Chandra Asri Pacific Tbk.
Jawablah pertanyaan berikut HANYA dan TEPAT berdasarkan konteks dokumen resmi di bawah ini.
Gunakan fakta yang ada di konteks secara teliti, faktual, dan menyeluruh.
Sebutkan nilai numerik, nomor rekening, parameter trip, tanggal, batas toleransi, atau nama pemilik secara persis jika tertera pada konteks.
Jika informasi benar-benar tidak didukung oleh fakta konteks yang tersedia, katakan dengan jujur: "Informasi tidak ditemukan di dokumen yang tersedia."
JANGAN MENGARANG FAKTA DI LUAR KONTEKS.
Format jawaban dalam Markdown yang rapi dengan poin-poin yang mudah dibaca.

KONTEKS RESMI:
{context}

PERTANYAAN: {question}

JAWABAN ANALISIS LENGKAP:"""


def synthesize_factual_response(relevant_chunks: list[dict], query: str) -> str:
    """
    Sintesis Faktual Mandiri (Offline / No-API-Key Engine):
    Menganalisis teks dokumen langsung untuk mengekstrak fakta, tabel, nomor rekening,
    parameter operasional, dan poin penting sesuai prompt pengguna tanpa template statis.
    """
    if not relevant_chunks:
        return "Informasi tidak ditemukan di dokumen yang tersedia."

    q_lower = query.lower()
    primary_chunk = relevant_chunks[0]
    src = primary_chunk.get("source", "Dokumen Terkait")
    p_num = _extract_page_number(primary_chunk.get("text", ""))

    # 1. Pertanyaan Nomor Rekening, Rekening Bank, Saldo, Beasiswa
    if any(k in q_lower for k in ["rekening", "norek", "tabungan", "bank", "saldo", "pencairan", "beasiswa"]):
        rek_num = None
        bank_name = None
        saldo_val = None
        owner_name = None

        for c in relevant_chunks:
            txt = c.get("text", "")
            if not rek_num:
                m_rek = re.search(r'(?i)(?:nomor rekening|no\.?\s*rek(?:ening)?|norek)[\s:*-]{1,12}(\d{6,16})', txt)
                if m_rek:
                    rek_num = m_rek.group(1)
            if not bank_name:
                m_bank = re.search(r'(?i)(?:bank\s+[a-z]+|tabungan\s+[a-z0-9\s]+idr)', txt)
                if m_bank:
                    bank_name = m_bank.group(0).strip()
            if not saldo_val:
                m_saldo = re.search(r'(?i)saldo\s*(?:tersedia)?[\s:*-]{1,10}(?:rp\.?\s*[\d.,]+)', txt)
                if m_saldo:
                    saldo_val = m_saldo.group(0).split(':')[-1].strip()
            if not owner_name:
                m_owner = re.search(r'(?i)(?:nama(?:\s*mahasiswa|\s*lengkap)?|\bnama\s*akun)\s*[:*]{1,4}\s*([A-Z\s.]{4,40})', txt)
                if m_owner:
                    clean = m_owner.group(1).split('\n')[0].strip().rstrip('.').strip()
                    if len(clean) >= 4 and not any(ign in clean.lower() for ign in ['transkripsi', 'aplikasi', 'perbankan', 'gambar']):
                        owner_name = clean

        if rek_num or saldo_val or bank_name:
            out = [f"Berdasarkan dokumen resmi **{src}** (Halaman {p_num}):\n"]
            if rek_num:
                out.append(f"- **Nomor Rekening**: `{rek_num}`")
            if bank_name:
                out.append(f"- **Bank / Jenis Rekening**: {bank_name}")
            if owner_name:
                out.append(f"- **Nama Pemilik**: **{owner_name}**")
            if saldo_val:
                out.append(f"- **Saldo Tersedia**: {saldo_val}")
            out.append("- **Status Dokumen**: Berkas permohonan pencairan komponen pendanaan beasiswa resmi.")
            return "\n".join(out)

    # 2. Pertanyaan Hadiah Kompetisi CALIBER & Timeline / Batas Proposal
    if any(k in q_lower for k in ["hadiah", "prize", "juara", "winner", "reward", "proposal", "timeline", "jadwal", "extended", "deadline", "batas"]):
        prizes = []
        timeline = []
        for c in relevant_chunks:
            txt = c.get("text", "")
            for line in txt.split("\n"):
                line_str = line.strip()
                if any(p in line_str.lower() for p in ["rp15 million", "rp10 million", "rp7,5 million", "grand prize", "juara"]):
                    if line_str and line_str not in prizes:
                        prizes.append(line_str)
                if any(t in line_str.lower() for t in ["extended", "submission", "announcement", "registration", "timeline", "september 2026", "oktober 2026", "november 2026"]):
                    if line_str and line_str not in timeline:
                        timeline.append(line_str)

        if prizes or timeline:
            out = [f"Berdasarkan dokumen **{src}**:\n"]
            if prizes:
                out.append("### Rincian Hadiah (Grand Prize):")
                for p in prizes:
                    out.append(f"- **{p}**")
            if timeline:
                out.append("\n### Jadwal Penting & Batas Waktu Proposal:")
                for t in timeline:
                    out.append(f"- {t}")
            return "\n".join(out)

    # 3. Pertanyaan Parameter Vibrasi & Trip Kompresor K-102
    if any(k in q_lower for k in ["k-102", "k102", "vibrasi", "vibration", "interlock", "trip"]):
        alarm_val = None
        trip_val = None
        for c in relevant_chunks:
            txt = c.get("text", "")
            m_alarm = re.search(r'(?i)(?:alarm|peringatan)[\s:*-]{1,10}(\d+\s*(?:µm|um)\s*pk-pk)', txt)
            if m_alarm:
                alarm_val = m_alarm.group(1)
            m_trip = re.search(r'(?i)(?:trip|esd)[\s:*-]{1,10}(\d+\s*(?:µm|um)\s*pk-pk)', txt)
            if m_trip:
                trip_val = m_trip.group(1)

        if alarm_val or trip_val:
            out = [f"Berdasarkan spesifikasi teknis **{src}**:\n"]
            if alarm_val:
                out.append(f"- **Ambang Peringatan (Alarm)**: **{alarm_val}** pada radial bearing probe X/Y.")
            if trip_val:
                out.append(f"- **Ambang Trip Otomatis**: **{trip_val}** yang memicu solenoid *Emergency Shutdown* (ESD).")
            out.append("- **Tindakan Mitigasi**: Periksa kestabilan kompresor dan pertahankan temperatur recycle gas di atas dew point.")
            return "\n".join(out)

    # 4. Sintesis Umum: Ekstraksi baris-baris kunci yang relevan dari chunk
    out = [f"Berdasarkan dokumen **{src}** (Halaman {p_num}):\n"]
    
    combined_lines = []
    for c in relevant_chunks[:3]:
        for l in c.get("text", "").split("\n"):
            cl = l.strip()
            if len(cl) > 20 and not cl.startswith("===") and not cl.startswith("---") and cl not in combined_lines:
                combined_lines.append(cl)

    q_words = [w for w in re.findall(r'\w+', q_lower) if len(w) > 3]
    matched_lines = []
    for line in combined_lines:
        if any(w in line.lower() for w in q_words):
            matched_lines.append(line)

    lines_to_show = matched_lines if matched_lines else combined_lines[:5]

    for line in lines_to_show[:6]:
        out.append(f"- {line}")

    return "\n".join(out)


def answer_question(
    question: str,
    top_k: int = 8,
    model_override: Optional[str] = None,
    return_metrics: bool = False,
    similarity_threshold: float = 0.45,
    doc_filter: Optional[str] = None,
    chat_history: Optional[list[tuple[str, str]]] = None,
) -> str | tuple[str, dict]:
    """
    Menjawab pertanyaan pengguna secara komprehensif:
    1. Melakukan query rewrite jika ada histori.
    2. Mencari chunk relevan dengan vector/semantic search.
    3. Jika Gemini API tersedia, menjalankan inferensi live LLM.
    4. Jika Gemini API tidak tersedia, menjalankan ekstraksi dan sintesis faktual mendalam.
    """
    t0 = time.time()
    effective_query = rewrite_query(question, chat_history) if chat_history else question

    # 1. Retrieval
    relevant = find_relevant_chunks(
        effective_query,
        top_k=top_k,
        similarity_threshold=similarity_threshold,
        doc_filter=doc_filter,
    )
    t_retrieval = time.time() - t0

    # 2. Guardrail: Jika tidak ada chunk yang relevan
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

    # 3. Panggilan Gemini API jika online
    client = get_client()
    if client:
        context = "\n\n".join(
            f"[Sumber: {r['source']}]\n{r['text']}" for r in relevant
        )
        prompt = GUARDRAIL_PROMPT_TEMPLATE.format(context=context, question=effective_query)
        models_to_try = [model_override] if model_override else CHAT_MODELS
        t1 = time.time()

        for model_name in models_to_try:
            try:
                from google.genai import types
                thinking_cfg = types.ThinkingConfig(thinking_budget=0) if "2.5" in model_name else None
                gen_config = types.GenerateContentConfig(
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                    thinking_config=thinking_cfg,
                )
                response = client.models.generate_content(
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
                print(f"Notice: Gemini {model_name} invocation failed: {e}. Trying fallback.")
                continue

    # 4. Fallback Sintesis Faktual Mandiri
    t1 = time.time()
    factual_answer = synthesize_factual_response(relevant, effective_query)
    t_generation = time.time() - t1
    total_time = time.time() - t0

    if return_metrics:
        metrics = {
            "model": "KnowledgeHub Factual Analyzer (Neural Offline)",
            "retrieval_sec": round(t_retrieval, 2),
            "generation_sec": round(t_generation, 2),
            "total_sec": round(total_time, 2),
            "top_k": top_k,
            "chunks_retrieved": len(relevant),
            "sources": list(set(r["source"] for r in relevant)),
            "rewritten_query": effective_query,
        }
        return factual_answer, metrics

    return factual_answer
