# Chandra Asri Manufacturing Knowledge Hub (CALIBER 2026)

Industrial Plant Intelligence & Operational Knowledge Hub web application for Chandra Asri Pacific petrochemical operations.

---

## 🏗️ Arsitektur Proyek

```
knowledgehub caliber/
│
├── backend/
│   └── test_backend.py      # Python HTTP Server (Mock REST API & CORS enabled)
│
├── frontend/
│   ├── index.html           # Main Application UI (Dashboard, Chat, Search, Safety Log)
│   ├── styles.css           # Modern Chandra Asri Theme Styling
│   └── app.js               # Dynamic Frontend Logic, Multi-turn Chat, Offline Fallback
│
├── .gitignore
└── README.md
```

---

## ⚙️ Analisis Port & Endpoint

| Komponen | Port Default | URL Lokal | Endpoint / Fungsi |
| :--- | :--- | :--- | :--- |
| **Backend API** | `8000` | `http://localhost:8000` | `POST /api/chat`<br>`GET /docs`<br>`GET /` |
| **Frontend Web** | `3000` / `5500` / `8080` | `http://localhost:3000` | Static Web App |

> **Catatan CORS**: Backend sudah dilengkapi header `Access-Control-Allow-Origin: *`, sehingga frontend dapat dijalankan pada port berapapun (`3000`, `5500`, `8080`, atau via VS Code Live Server) tanpa kendala CORS.

---

## 🚀 Cara Menjalankan Secara Lokal (Localhost)

### 1. Jalankan Backend (Port 8000)

Buka terminal dan jalankan:
```bash
python backend/test_backend.py
```
Backend akan aktif di: **`http://localhost:8000`**

### 2. Jalankan Frontend

Anda dapat membuka file `frontend/index.html` langsung di browser, atau menggunakan server lokal ringan:

**Menggunakan Python HTTP Server (Port 3000):**
```bash
python -m http.server 3000 --directory frontend
```
Akses web melalui: **`http://localhost:3000`**

**Atau menggunakan Node.js (npx serve / live-server):**
```bash
npx serve frontend -p 3000
```

---

## 📡 API Specification

### Endpoint Chat: `POST /api/chat`
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
  "response": "Penjelasan rekomendasi operasional dan mitigasi...",
  "citations": [
    {
      "source": "CAP-INST-K102-VIBRATION-SPEC.pdf",
      "page": 7,
      "revision": "Rev 3.1 (2024)",
      "confidence_score": 0.948,
      "snippet": "Tabel 2.4: Vibration Thresholds & Interlock Trip Matrix K-102"
    }
  ]
}
```

---

## 🔄 Mode Offline & Fallback
Frontend dilengkapi dengan knowledge base statis untuk unit **P-101A**, **K-102**, dan **F-101**. Jika backend lokal sedang offline, UI akan otomatis beralih ke mode offline simulator sehingga pengujian interaksi antarmuka tetap berjalan mulus.
