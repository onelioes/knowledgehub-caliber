# Chandra Asri Manufacturing Knowledge Hub (CALIBER 2026)

Industrial Plant Intelligence & Operational Knowledge Hub web application for Chandra Asri Pacific petrochemical operations.
Dilengkapi dengan **FastAPI Real RAG Engine (Google Gemini Embedding & Generation)**, sistem **PII & OCR Consent Gate**, **WORM Audit Trail**, serta antarmuka web modern responsif.

---

## 🏗️ Arsitektur Proyek

```
knowledgehub-caliber/
├── backend/
│   ├── api.py               # REST API Server FastAPI (RAG pipeline, PII gate, TTL cleaner)
│   ├── retrieval.py         # Gemini RAG Engine (similarity retrieval, guardrails, query rewriting)
│   ├── embedding_store.py   # Embedding Store (Google text-embedding-004 vector pipeline)
│   ├── chunking.py          # Multimodal Document Parser (11 format: PDF, DOCX, TXT, XLSX, PPTX, OCR)
│   ├── pii_detector.py      # Presidio & Regex Indonesian PII Detection & Redaction
│   ├── main.py              # CLI & ISO 27001 Audit Trail logger
│   ├── requirements.txt     # Python Dependencies
│   ├── vector_store.json    # Pre-indexed Chandra Asri Technical Plant Documents
│   ├── consent_log.json     # Audit log persetujuan & privasi
│   ├── test_backend.py      # Mock REST API Server (legacy fallback)
│   └── tests/
│       └── test_ttl_expiry.py # Unit & TTL Expiry Test Suite (clean OpenAPI contract)
│
├── frontend/
│   ├── index.html           # Main Application UI (Dashboard, Chat, Search, Safety Log)
│   ├── styles.css           # Modern Chandra Asri Theme Styling
│   └── app.js               # Dynamic Frontend Logic, Multi-turn Chat, Backend Healthcheck
│
├── .env.example             # Template konfigurasi environment key
├── .gitignore
└── README.md
```

---

## ⚙️ Analisis Port & Endpoint

| Komponen | Port Default | URL Lokal | Endpoint / Fungsi |
| :--- | :--- | :--- | :--- |
| **Unified Backend & UI** | `8000` | `http://localhost:8000` | `GET /` (Melayani UI Web Langsung)<br>`POST /api/chat` (AI Copilot RAG Adapter)<br>`POST /ask` (Core RAG Engine)<br>`POST /upload` (2-Phase Ingestion & PII Gate)<br>`POST /upload/{id}/confirm` (Atomic TTL Consent)<br>`GET /documents` (Daftar Dokumen Pabrik)<br>`GET /health` (Status & Liveness)<br>`GET /docs` (Swagger UI Documentation) |
| **Frontend Mandiri (Opsional)** | `3000` / `5500` | `http://localhost:3000` | Static Web App jika dijalankan terpisah |

> **Catatan CORS**: Backend dilengkapi konfigurasi CORS dinamis untuk seluruh port localhost dan 127.0.0.1, sehingga frontend dapat diakses langsung dari port `8000` atau server terpisah (`3000`, `5500`, VS Code Live Server) tanpa kendala CORS.

---

## 🚀 Cara Menjalankan Secara Lokal (Localhost)

### 1. Prasyarat & Instalasi Dependensi
Pastikan Python 3.10+ terinstal.

```bash
# Buat virtual environment (opsional namun disarankan)
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# atau: .\venv\Scripts\activate  # Windows

# Install dependensi backend
pip install -r backend/requirements.txt
```

### 2. Konfigurasi Environment Variable
Salin `.env.example` ke `.env` dan masukkan API Key Gemini Anda:
```bash
cp .env.example .env
```
Isi di dalam `.env`:
```ini
GEMINI_API_KEY=AIzaSy...
```

### 3. Jalankan Server Terpadu (Port 8000)
Jalankan server dari direktori root proyek:
```bash
uvicorn backend.api:app --host 0.0.0.0 --port 8000 --reload
```
Akses sistem di browser:
- **Aplikasi Web**: [http://localhost:8000](http://localhost:8000)
- **Dokumentasi API Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)

*(Opsional: Jika ingin menjalankan frontend terpisah di port 3000, Anda dapat menjalankan `python -m http.server 3000 --directory frontend`)*

---

## 🧪 Menjalankan Pengujian (Testing Suite)

Untuk memverifikasi mekanisme TTL Expiry, perlindungan double-submit, dan kontrak OpenAPI tanpa testing backdoor:
```bash
python backend/tests/test_ttl_expiry.py
```

---

## 📡 API Specification Ringkas

### 1. Chat AI Copilot: `POST /api/chat`
* **Request Body:**
```json
{
  "query": "Berapa batas vibrasi kompresor K-102?",
  "asset_tag": "K-102"
}
```
* **Response Body:**
```json
{
  "response": "Batas vibrasi kompresor K-102 menurut Tabel 2.4 adalah 45 um pk-pk (alert) dan 68 um pk-pk (trip)...",
  "citations": [
    {
      "source": "CAP-INST-K102-VIBRATION-SPEC.pdf",
      "page": 1,
      "revision": "Rev 3.1 (2024)",
      "confidence_score": 0.794,
      "snippet": "SPESIFIKASI INSTRUMENTASI & INTERLOCK TRIP VIBRASI..."
    }
  ]
}
```

### 2. Dokumen Pabrik Terindeks: `GET /documents`
Mengembalikan status seluruh dokumen teknik yang telah diindeks ke dalam vector store beserta jumlah chunk dan stempel waktu.
