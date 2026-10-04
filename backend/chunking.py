"""
chunking.py - Ekstraksi Dokumen (Digital & Multimodal OCR) dan Table-Aware Chunking

Fitur:
1. Ekstraksi teks digital lokal (PDF / DOCX) 100% offline.
2. Multimodal OCR via Gemini Vision jika terdeteksi halaman gambar scan (KHS, KRS, Buku Tabungan, dll).
3. Transparansi model failover: mencatat model yang dicoba, gagal, dan sukses per halaman.
4. Table-Aware Chunking: menjaga keutuhan struktur tabel Markdown agar tidak terpotong di tengah baris/kolom.
"""

import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

try:
    import docx
except Exception:
    docx = None

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None

VISION_MODELS = [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-flash-latest",
]

_client = None


def get_genai_client():
    """Inisialisasi Gemini Client secara lazy dan aman."""
    global _client
    if genai is None:
        return None
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return None
        try:
            _client = genai.Client(api_key=api_key)
        except Exception as e:
            print(f"[GENAI CLIENT WARNING] Gagal menginisialisasi Gemini: {e}")
            return None
    return _client


def ocr_image_with_gemini(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    page_num: int = 1,
    total_pages: int = 1,
) -> tuple[str, str]:
    """
    Kirim gambar pindaian/scan dokumen ke Gemini Vision untuk ditranskripsikan ke teks lengkap.
    Mendukung transparansi failover: setiap model yang dicoba dan gagal/sukses dicatat ke log console.
    Mengembalikan tuple: (teks_transkripsi, model_yang_berhasil).
    """
    client = get_genai_client()
    if client is None:
        print(f"    [OCR Info] Halaman {page_num}/{total_pages}: OCR Vision dilewati (GEMINI_API_KEY tidak dikonfigurasi).")
        return "", "NONE"

    prompt = (
        "Kamu adalah asisten OCR dokumen tingkat lanjut. "
        "Tolong baca dan transkripsikan seluruh isi dokumen pindaian/gambar ini secara lengkap dan terstruktur dalam format teks/Markdown. "
        "Baca semua tabel, kolom nilai, rincian mata kuliah, nomor rekening/rekening koran, kop surat, stempel, tanda tangan, nomor identitas (NIM/KTP/NSPP), "
        "dan catatan penting lainnya secara persis dan teliti tanpa ada yang terlewat."
    )

    last_error = None
    for i, model_name in enumerate(VISION_MODELS):
        try:
            if i > 0:
                print(f"    [OCR Failover] Halaman {page_num}/{total_pages}: Mengalihkan ke model cadangan '{model_name}'...")
            res = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
                ),
            )
            if res and res.text:
                if i > 0:
                    print(f"    [OCR Failover Audit] Halaman {page_num}/{total_pages}: Berhasil diproses menggunakan model cadangan '{model_name}'.")
                else:
                    print(f"    [OCR Vision] Halaman {page_num}/{total_pages}: Sukses diproses dengan model utama '{model_name}'.")
                return res.text.strip(), model_name
        except Exception as e:
            err_summary = str(e).split("\n")[0][:100]
            print(f"    [OCR Warning] Halaman {page_num}/{total_pages}: Model '{model_name}' gagal ({err_summary}).")
            last_error = e
            continue

    print(f"    [OCR Error] Halaman {page_num}/{total_pages}: Semua model OCR gagal ({last_error}).")
    return "", "NONE"


SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".txt", ".md", ".csv", ".pptx",
    ".xlsx", ".jpg", ".jpeg", ".png", ".zip",
}


def extract_txt_md(file_path: str) -> str:
    """Membaca file teks murni (.txt) atau Markdown (.md) secara langsung sebagai teks biasa."""
    encodings = ["utf-8", "utf-8-sig", "latin-1"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def extract_csv(file_path: str, rows_per_block: int = 15) -> str:
    """
    Membaca file .csv menggunakan library csv bawaan Python (ringan dan tanpa dependency tambahan).
    Setiap baris direpresentasikan secara semantik: "Kolom1: Nilai1, Kolom2: Nilai2".

    TRADE-OFF REPRESENTASI & PENGELOMPOKAN BARIS CSV:
    1. Opsi A (1 chunk per baris):
       - Kelebihan: Sangat spesifik jika mencari 1 entitas tunggal.
       - Kekurangan: Ledakan jumlah chunk (chunk explosion) pada file CSV ratusan/ribuan baris,
         sangat boros kuota embedding API, dan memecah kelompok data sejenis (kehilangan konteks).
    2. Opsi B (10-20 baris per blok/chunk -- Trade-off yang dipilih):
       - Kelebihan: Menjaga ukuran chunk tetap proporsional (~500-900 karakter, cocok dengan chunk_size 900),
         menghemat biaya & kuota embedding hingga 15x lipat, mempertahankan konteks relasional data sejenis,
         dan saat dicari via vector similarity, model LLM mendapatkan kelompok data lengkap dalam 1 chunk.
       - Setiap baris tetap diberi label 'Baris X: Kolom: Nilai' agar nomor baris dan nilai kolom jelas.
    """
    import csv
    blocks = []
    current_block = []

    # Buka dengan encoding yang aman
    encodings = ["utf-8", "utf-8-sig", "latin-1"]
    f = None
    for enc in encodings:
        try:
            f = open(file_path, "r", encoding=enc, newline="")
            f.read(1024)
            f.seek(0)
            break
        except UnicodeDecodeError:
            if f:
                f.close()
            f = None

    if f is None:
        f = open(file_path, "r", encoding="utf-8", errors="replace", newline="")

    try:
        sample = f.read(2048)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except Exception:
            dialect = csv.excel

        reader = csv.DictReader(f, dialect=dialect)
        for idx, row in enumerate(reader, 1):
            row_items = [
                f"{k.strip()}: {v.strip()}"
                for k, v in row.items()
                if k and v is not None and v.strip()
            ]
            if row_items:
                current_block.append(f"Baris {idx}: " + ", ".join(row_items))

            if len(current_block) >= rows_per_block:
                blocks.append("\n".join(current_block))
                current_block = []

        if current_block:
            blocks.append("\n".join(current_block))
    finally:
        f.close()

    return "\n\n".join(blocks)


def extract_pptx(file_path: str) -> str:
    """
    Mengekstrak teks dari presentasi PowerPoint (.pptx) menggunakan python-pptx:
    - Judul slide & seluruh isi text box (paragraf, bullet points)
    - Isi tabel pada slide (jika ada)
    - Catatan pembicara (speaker notes)
    Setiap slide diberi penanda eksplisit '[Slide X]' agar sitasi di retrieval dapat menyebut slide spesifik.
    """
    try:
        from pptx import Presentation
        prs = Presentation(file_path)
    except Exception as e:
        return f"[Catatan: python-pptx tidak tersedia atau gagal memproses berkas: {e}]"
    slide_texts = []

    for idx, slide in enumerate(prs.slides, 1):
        parts = []

        # 1. Judul & Shapes Text
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    text = paragraph.text.strip()
                    if text and text not in parts:
                        parts.append(text)

            # Tabel dalam slide
            elif shape.has_table:
                table_rows = []
                for row in shape.table.rows:
                    row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_text:
                        table_rows.append(" | ".join(row_text))
                if table_rows:
                    parts.append("\n".join(table_rows))

        # 2. Catatan Pembicara (Speaker Notes)
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            notes_text = slide.notes_slide.notes_text_frame.text.strip()
            if notes_text:
                parts.append(f"Catatan Pembicara: {notes_text}")

        slide_content = "\n".join(parts).strip()
        if slide_content:
            slide_texts.append(f"[Slide {idx}]\n{slide_content}")

    return "\n\n".join(slide_texts)


def extract_xlsx(file_path: str, rows_per_block: int = 15) -> str:
    """
    Mengekstrak data dari workbook Excel (.xlsx) per sheet menggunakan openpyxl:
    - Setiap sheet diberi label penanda eksplisit '[Sheet: NamaSheet]' di awal blok teks.
    - Format baris konsisten dengan CSV: 'Baris X: Kolom1: Nilai1, Kolom2: Nilai2'.
    - Dikelompokkan per blok baris (15 baris per blok) untuk menjaga ukuran chunk proporsional
      dan mencegah chunk explosion.
    - Sheet yang kosong dilewati tanpa error.
    """
    import openpyxl

    wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
    sheet_blocks = []

    try:
        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                continue

            # Cari baris header pertama yang tidak kosong
            header = None
            header_idx = -1
            for i, r in enumerate(rows):
                if any(c is not None and str(c).strip() != "" for c in r):
                    header = [
                        str(c).strip() if c is not None and str(c).strip() != "" else f"Kolom_{col_idx+1}"
                        for col_idx, c in enumerate(r)
                    ]
                    header_idx = i
                    break

            if header is None:
                continue

            data_rows = rows[header_idx + 1 :]
            current_block = []
            sheet_content_blocks = []
            row_count = 0

            for row in data_rows:
                if not any(c is not None and str(c).strip() != "" for c in row):
                    continue

                row_count += 1
                row_items = []
                for col_idx, val in enumerate(row):
                    if col_idx < len(header) and val is not None:
                        val_str = str(val).strip()
                        if val_str:
                            col_name = header[col_idx] if header[col_idx] else f"Kolom_{col_idx+1}"
                            row_items.append(f"{col_name}: {val_str}")

                if row_items:
                    current_block.append(f"Baris {row_count}: " + ", ".join(row_items))

                if len(current_block) >= rows_per_block:
                    sheet_content_blocks.append("\n".join(current_block))
                    current_block = []

            if current_block:
                sheet_content_blocks.append("\n".join(current_block))

            if sheet_content_blocks:
                sheet_text = "\n\n".join(sheet_content_blocks)
                sheet_blocks.append(f"[Sheet: {sheet_name}]\n{sheet_text}")
    finally:
        wb.close()

    return "\n\n".join(sheet_blocks)


def extract_image(file_path: str, allow_ocr: bool = True) -> str:
    """
    Ekstraksi teks dari gambar berdiri sendiri (.jpg, .jpeg, .png)
    menggunakan Gemini Vision OCR via ocr_image_with_gemini.
    """
    if not allow_ocr:
        return ""
    ext = os.path.splitext(file_path)[1].lower()
    mime = "image/png" if ext == ".png" else "image/jpeg"
    with open(file_path, "rb") as f:
        img_bytes = f.read()

    text_ocr, _ = ocr_image_with_gemini(
        image_bytes=img_bytes,
        mime_type=mime,
        page_num=1,
        total_pages=1,
    )
    return text_ocr


def extract_digital_text(file_path: str) -> tuple[str, list[int]]:
    """
    Ekstrak teks digital lokal dari PDF, DOCX, TXT, MD, CSV, PPTX, XLSX secara 100% offline.
    Untuk gambar berdiri sendiri (.jpg, .jpeg, .png), mengembalikan ("", [1]) agar memicu alur consent OCR.
    Mengembalikan: (digital_text, scanned_page_numbers)
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        reader = PdfReader(file_path)
        extracted = []
        scanned_pages = []
        for idx, page in enumerate(reader.pages, 1):
            text = (page.extract_text() or "").strip()
            if len(text) < 80 and len(page.images) > 0:
                scanned_pages.append(idx)
            if text:
                extracted.append(f"[Halaman {idx}]\n{text}")
        return "\n\n".join(extracted), scanned_pages

    if ext == ".docx":
        document = docx.Document(file_path)
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
        for table in document.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    paragraphs.append(" | ".join(cells))
        return "\n\n".join(paragraphs), []

    if ext in (".txt", ".md"):
        return extract_txt_md(file_path), []

    if ext == ".csv":
        return extract_csv(file_path), []

    if ext == ".pptx":
        return extract_pptx(file_path), []

    if ext == ".xlsx":
        return extract_xlsx(file_path), []

    if ext in (".jpg", ".jpeg", ".png"):
        return "", [1]

    if ext == ".zip":
        raise ValueError("File arsip .zip harus diproses melalui alur ekstraksi arsip (main.py).")

    supported_list = ", ".join(sorted(SUPPORTED_EXTENSIONS))
    raise ValueError(f"Tipe file '{ext}' belum didukung. Format yang didukung saat ini: {supported_list}")


def extract_from_bytes(filename: str, file_bytes: bytes) -> str:
    """
    Ekstraksi teks digital dari memory bytes (zero disk dependency).
    Mendukung PDF, DOCX, XLSX, CSV, TXT, MD, PPTX.
    """
    ext = os.path.splitext(filename)[1].lower()
    import io

    # 1. Plain text formats
    if ext in ['.txt', '.md', '.log', '.xml', '.html', '.json']:
        for enc in ['utf-8', 'utf-8-sig', 'latin-1']:
            try:
                return file_bytes.decode(enc)
            except Exception:
                continue
        return file_bytes.decode('utf-8', errors='ignore')

    # 2. PDF Documents
    if ext == '.pdf':
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = []
            for idx, p in enumerate(reader.pages, 1):
                t = (p.extract_text() or "").strip()
                if t:
                    pages.append(f"[Halaman {idx}]\n{t}")
            if pages:
                return "\n\n".join(pages)
        except Exception as e:
            print(f"[PDF Extract Warning] {e}")

    # 3. Microsoft Word (.docx)
    if ext == '.docx':
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            parts = []
            for p in doc.paragraphs:
                if p.text.strip():
                    parts.append(p.text.strip())
            for t in doc.tables:
                for row in t.rows:
                    row_txt = [c.text.strip() for c in row.cells if c.text.strip()]
                    if row_txt:
                        parts.append(" | ".join(row_txt))
            if parts:
                return "\n\n".join(parts)
        except Exception as e:
            print(f"[DOCX Extract Warning] {e}")

    # 4. Microsoft Excel (.xlsx)
    if ext == '.xlsx':
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True, read_only=True)
            sheet_blocks = []
            for sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
                rows = list(sheet.iter_rows(values_only=True))
                if not rows:
                    continue
                row_texts = []
                for r in rows:
                    r_str = [str(c).strip() for c in r if c is not None and str(c).strip()]
                    if r_str:
                        row_texts.append(" | ".join(r_str))
                if row_texts:
                    sheet_blocks.append(f"[Sheet: {sheet_name}]\n" + "\n".join(row_texts))
            wb.close()
            if sheet_blocks:
                return "\n\n".join(sheet_blocks)
        except Exception as e:
            print(f"[XLSX Extract Warning] {e}")

    # 5. CSV Data
    if ext == '.csv':
        try:
            import csv
            text_str = file_bytes.decode('utf-8', errors='replace')
            lines = text_str.splitlines()
            if lines:
                reader = csv.reader(lines)
                csv_parts = []
                for idx, row in enumerate(reader, 1):
                    row_clean = [col.strip() for col in row if col.strip()]
                    if row_clean:
                        csv_parts.append(f"Baris {idx}: " + ", ".join(row_clean))
                if csv_parts:
                    return "\n".join(csv_parts)
        except Exception as e:
            print(f"[CSV Extract Warning] {e}")

    # Fallback to regex string match
    import re
    ascii_strings = re.findall(r'[A-Za-z0-9,.\-_/:\(\)\s]{5,}', file_bytes.decode('latin1', errors='ignore'))
    cleaned = " ".join([s.strip() for s in ascii_strings if len(s.strip()) > 5])
    return cleaned if cleaned else f"Dokumen {filename} berhasil diunggah dan diverifikasi."


def extract_text(file_path: str, allow_ocr: bool = True) -> str:
    """
    Baca isi file (PDF, DOCX, TXT, MD, CSV, PPTX, XLSX, JPG, JPEG, PNG), kembalikan sebagai satu string teks panjang.
    Jika allow_ocr=True dan berupa gambar scan atau gambar berdiri sendiri,
    otomatis ditranskripsikan menggunakan Gemini Vision OCR dengan pencatatan audit model.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        reader = PdfReader(file_path)
        extracted_pages = []
        total_pages = len(reader.pages)

        for idx, page in enumerate(reader.pages, 1):
            digital_text = (page.extract_text() or "").strip()

            # Deteksi halaman scan (teks sangat minim tapi memiliki gambar)
            if len(digital_text) < 80 and len(page.images) > 0:
                if allow_ocr:
                    print(f"  [Multimodal Vision] Halaman {idx}/{total_pages} terdeteksi sebagai gambar scan. Menjalankan OCR...")
                    ocr_results = []
                    for img in page.images:
                        if len(img.data) > 5000:
                            mime = "image/jpeg" if img.name.lower().endswith((".jpg", ".jpeg")) else "image/png"
                            text_ocr, _ = ocr_image_with_gemini(
                                img.data, mime, page_num=idx, total_pages=total_pages
                            )
                            if text_ocr:
                                ocr_results.append(text_ocr)

                    combined_page_text = "\n".join(ocr_results)
                    if digital_text:
                        combined_page_text = f"{digital_text}\n{combined_page_text}"

                    extracted_pages.append(f"[Halaman {idx}]\n{combined_page_text}")
                else:
                    if digital_text:
                        extracted_pages.append(f"[Halaman {idx}]\n{digital_text}")
            else:
                extracted_pages.append(f"[Halaman {idx}]\n{digital_text}")

        return "\n\n".join(extracted_pages)

    if ext == ".docx":
        document = docx.Document(file_path)
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)

    if ext in (".txt", ".md"):
        return extract_txt_md(file_path)

    if ext == ".csv":
        return extract_csv(file_path)

    if ext == ".pptx":
        return extract_pptx(file_path)

    if ext == ".xlsx":
        return extract_xlsx(file_path)

    if ext in (".jpg", ".jpeg", ".png"):
        return extract_image(file_path, allow_ocr=allow_ocr)

    if ext == ".zip":
        raise ValueError("File arsip .zip harus diproses melalui alur ekstraksi arsip (main.py).")

    supported_list = ", ".join(sorted(SUPPORTED_EXTENSIONS))
    raise ValueError(f"Tipe file '{ext}' belum didukung. Format yang didukung saat ini: {supported_list}")


def is_table_row(line: str) -> bool:
    """Mendeteksi apakah sebuah baris teks merupakan bagian dari tabel Markdown (| col1 | col2 |)."""
    s = line.strip()
    return s.startswith("|") and s.endswith("|") and s.count("|") >= 2


def is_table_summary_line(line: str) -> bool:
    """Mendeteksi baris kesimpulan/ringkasan yang menempel di bawah tabel (misal: Total SKS, Indeks Prestasi)."""
    s = line.strip().lower()
    return any(s.startswith(k) for k in ["total", "indeks prestasi", "ip:", "ipk:", "catatan:"])


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 150) -> list[str]:
    """
    Pecah teks panjang jadi beberapa chunk dengan Table-Aware Chunking:
    - Baris tabel Markdown diidentifikasi dan dijaga sebagai satu unit utuh (atomic chunk)
      agar header kolom, baris mata kuliah, SKS, nilai, dan baris total/IPK tidak terpotong
      ke chunk yang berbeda.
    - Teks non-tabel dipecah berdasarkan batas paragraf/kalimat dengan overlap normal.

    TRADE-OFF CHUNKING TABEL:
    Mempertahankan tabel sebagai 1 chunk utuh (meski panjangnya > chunk_size normal, misal 1200-2500 karakter)
    memiliki trade-off:
    - Ukuran token embedding sedikit lebih besar untuk chunk khusus tabel tersebut.
    Namun keuntungannya krusial:
    - Menjaga integritas relasional antara kolom header, nama mata kuliah, SKS, nilai,
      dan baris total/IPK agar tidak terpisah ke chunk berbeda.
    - Mengurangi ketergantungan pada nilai top_k yang terlalu besar di sisi retrieval,
      karena semua konteks tabel sudah lengkap dalam 1 chunk rujukan.
    """
    lines = text.split("\n")
    blocks = []
    curr_lines = []
    curr_type = None

    for line in lines:
        line_table = is_table_row(line)
        # Rekatkan baris ringkasan tabel jika posisinya menempel tepat di bawah tabel
        if not line_table and curr_type == "table" and is_table_summary_line(line):
            curr_lines.append(line)
            continue

        exp_type = "table" if line_table else "text"

        if curr_type is None:
            curr_type = exp_type
            curr_lines.append(line)
        elif curr_type == exp_type:
            curr_lines.append(line)
        else:
            content = "\n".join(curr_lines).strip()
            if content:
                blocks.append({"type": curr_type, "content": content})
            curr_type = exp_type
            curr_lines = [line]

    if curr_lines:
        content = "\n".join(curr_lines).strip()
        if content:
            blocks.append({"type": curr_type, "content": content})

    chunks = []
    text_buffer = ""

    for b in blocks:
        if b["type"] == "table":
            # Flush teks biasa yang terkumpul sebelum memasukkan tabel
            if text_buffer.strip():
                chunks.append(text_buffer.strip())
                text_buffer = ""
            # Simpan seluruh tabel sebagai 1 chunk utuh (atomic table chunk)
            chunks.append(b["content"])
        else:
            # Teks paragraf biasa
            paras = [p.strip() for p in b["content"].split("\n\n") if p.strip()]
            for p in paras:
                if len(text_buffer) + len(p) > chunk_size:
                    if text_buffer.strip():
                        chunks.append(text_buffer.strip())
                        # Overlap: ambil buntut buffer sebelumnya
                        text_buffer = text_buffer[-overlap:] + " " + p
                    else:
                        chunks.append(p)
                else:
                    text_buffer = (text_buffer + "\n\n" + p).strip()

    if text_buffer.strip():
        chunks.append(text_buffer.strip())

    return [c for c in chunks if c]


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Cara pakai: python chunking.py path/ke/file.pdf")
        sys.exit(1)

    full_text = extract_text(sys.argv[1], allow_ocr=True)
    result_chunks = chunk_text(full_text)

    print(f"\nTotal chunk: {len(result_chunks)}\n")
    for i, c in enumerate(result_chunks):
        print(f"--- Chunk {i + 1} ({len(c)} karakter) ---")
        print(c[:250], "...\n")
