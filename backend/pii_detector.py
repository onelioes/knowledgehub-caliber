"""
pii_detector.py - Deteksi Data Pribadi (PII) Lokal & Redaksi Berbasis Konteks
100% Offline via Pattern Matching / Regex (Tanpa API Eksternal).

Kategori yang dideteksi (Wajib memiliki kata kunci konteks di sekitarnya):
- RISIKO TINGGI:
  * NIK: 16 digit yang didahului konteks NIK, KTP, atau No. Identitas.
  * Nomor Kartu Keluarga / KK: 16 digit yang didahului konteks KK / Kartu Keluarga.
  * Nomor Rekening Bank: 6-16 digit yang didahului konteks Rekening / Account Number / Tabungan.
  * NPWP: Format resmi XX.XXX.XXX.X-XXX.XXX atau didahului konteks NPWP.
- RISIKO SEDANG:
  * Tanggal Lahir: Format tanggal (DD/MM/YYYY, DD-MM-YYYY, teks) yang didahului konteks Lahir / TTL / DOB.
"""

import re
from typing import List

# Definisi Tingkat Risiko
HIGH_RISK_CATEGORIES = [
    "NIK (KTP)",
    "Nomor Kartu Keluarga (KK)",
    "Nomor Rekening Bank",
    "NPWP",
]
MEDIUM_RISK_CATEGORIES = [
    "Tanggal Lahir",
]

# 1. Regex Patterns Berbasis Konteks

# NIK: 16 digit yang WAJIB didahului kata kunci konteks (NIK, KTP, No. Identitas)
REGEX_NIK = re.compile(
    r"(?i)\b(?:nik|no\.?\s*ktp|nomor\s*ktp|ktp|no\.?\s*identitas|nomor\s*identitas)"
    r"(?:[^\n\d]{0,25})"
    r"[:.\-]?\s*"
    r"([1-9]\d{15})\b"
)

# Nomor KK: 16 digit yang didahului kata kunci KK / Kartu Keluarga
REGEX_KK = re.compile(
    r"(?i)\b(?:no\.?\s*kk|nomor\s*kk|kartu\s*keluarga)"
    r"(?:[^\n\d]{0,25})"
    r"[:.\-]?\s*"
    r"([1-9]\d{15})\b"
)

# Nomor Rekening: 6-16 digit angka yang didahului konteks perbankan/rekening
# (Mendukung rekening pendek seperti 1234567 maupun standar 10-16 digit)
REGEX_REKENING = re.compile(
    r"(?i)\b(?:rekening|no\.?\s*rek(?:ening)?|norek|account\s*(?:no\.?|number)|no\.?\s*acc|tabungan|livin)"
    r"(?:[^\n\d]{0,35})"
    r"[:.\-]?\s*"
    r"([0-9]{6,16})\b"
)

# Rekening dengan pemisah strip/spasi
REGEX_REKENING_HYPHEN = re.compile(
    r"(?i)\b(?:rekening|no\.?\s*rek(?:ening)?|norek|account\s*(?:no\.?|number)|no\.?\s*acc|tabungan)"
    r"(?:[^\n\d]{0,35})"
    r"[:.\-]?\s*"
    r"(\d{3,5}[-\s]\d{3,6}[-\s]\d{3,6})\b"
)

# NPWP: format resmi XX.XXX.XXX.X-XXX.XXX atau didahului kata kunci NPWP
REGEX_NPWP_FORMAT = re.compile(r"\b\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}\b")
REGEX_NPWP_CONTEXT = re.compile(
    r"(?i)\bnpwp\s*[:.\-]?\s*(\d{15,16}|\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3})\b"
)

# Tanggal Lahir: WAJIB didahului konteks lahir, TTL, DOB, birth date
REGEX_TGL_LAHIR = re.compile(
    r"(?i)\b(?:tgl\.?\s*lahir|tanggal\s*lahir|tempat[,\s/]+(?:tgl\.?|tanggal)?\s*lahir|ttl|d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date)"
    r"(?:[^\n\d]{0,35})"
    r"[:.\-]?\s*"
    r"([0-3]?\d[-/.][01]?\d[-/.](?:19|20)\d\d|[0-3]?\d\s+(?:Jan(?:uari)?|Feb(?:ruari)?|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Agu(?:stus)?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Des(?:ember)?)\s+(?:19|20)\d\d)\b"
)


def detect_pii(text: str) -> List[str]:
    """
    Mendeteksi apakah terdapat data pribadi (PII) sensitif dalam teks.
    
    PENTING:
    - Fungsi ini berjalan 100% lokal memakai regex berbasis kata kunci konteks.
    - TIDAK mengirim data ke API eksternal manapun.
    - Mengembalikan HANYA daftar KATEGORI PII yang terdeteksi (bukan nilai mentahnya),
      sehingga aman untuk ditampilkan ke user/log tanpa membocorkan data.
    """
    detected_categories = []

    # 1. Deteksi Nomor Kartu Keluarga (KK)
    kk_matches = set(REGEX_KK.findall(text))
    if kk_matches:
        detected_categories.append("Nomor Kartu Keluarga (KK)")

    # 2. Deteksi NIK (16 digit dengan konteks KTP/NIK/Identitas)
    nik_matches = set(REGEX_NIK.findall(text))
    # Filter jika ada yang tumpang tindih dengan KK
    nik_only = nik_matches - kk_matches
    if nik_only:
        detected_categories.append("NIK (KTP)")

    # 3. Deteksi Nomor Rekening Bank
    rek_matches = REGEX_REKENING.findall(text) or REGEX_REKENING_HYPHEN.findall(text)
    if rek_matches:
        detected_categories.append("Nomor Rekening Bank")

    # 4. Deteksi NPWP
    npwp_matches = REGEX_NPWP_FORMAT.findall(text) or REGEX_NPWP_CONTEXT.findall(text)
    if npwp_matches:
        detected_categories.append("NPWP")

    # 5. Deteksi Tanggal Lahir (Hanya yang memiliki konteks lahir)
    if REGEX_TGL_LAHIR.search(text):
        detected_categories.append("Tanggal Lahir")

    return sorted(list(set(detected_categories)))


def redact_pii(
    text: str,
    redact_high_risk: bool = True,
    redact_medium_risk: bool = True,
) -> str:
    """
    Mengaburkan / memask data pribadi sensitif yang terdeteksi dalam teks.
    
    Aturan Kebijakan Privasi:
    - Default Wajib: Data Risiko Tinggi & Sedang otomatis disamarkan.
    - Opsi `--allow-raw-pii`: Jika diaktifkan dan dikonfirmasi user, `redact_high_risk=False`.
    
    Aturan masking:
    - NIK:   3201123456785678 -> 3201********5678
    - KK:    3201987654321098 -> 3201********1098
    - Rek:   1234567890123    -> 1234*******23
             1234567 (< 8 dig)-> 12***67 (tetap di-mask, tidak ada celah lolos)
    - NPWP:  01.234.567.8-901.000 -> 01.234.***.*-***.***
    - Tgl:   15/04/1998      -> **/**/1998
             20 Mei 1995     -> ** ** 1995
    """
    result = text

    if redact_high_risk:
        # Redaksi Nomor Kartu Keluarga (KK)
        def mask_kk(m):
            full_str = m.group(0)
            digits = m.group(1)
            masked_digits = digits[:4] + ("*" * 8) + digits[-4:]
            return full_str.replace(digits, masked_digits)

        result = REGEX_KK.sub(mask_kk, result)

        # Redaksi NIK
        def mask_nik(m):
            full_str = m.group(0)
            digits = m.group(1)
            if "*" in digits:
                return full_str
            masked_digits = digits[:4] + ("*" * 8) + digits[-4:]
            return full_str.replace(digits, masked_digits)

        result = REGEX_NIK.sub(mask_nik, result)

        # Redaksi Nomor Rekening Bank (Fix Bug Rekening Pendek)
        def mask_rek(m):
            full_str = m.group(0)
            digits = m.group(1)
            if len(digits) >= 8:
                masked_digits = digits[:4] + ("*" * (len(digits) - 6)) + digits[-2:]
            elif len(digits) >= 4:
                # Rekening pendek (4-7 digit, e.g. 1234567 -> 12***67)
                masked_digits = digits[:2] + ("*" * (len(digits) - 4)) + digits[-2:]
            else:
                masked_digits = "*" * len(digits)
            return full_str.replace(digits, masked_digits)

        result = REGEX_REKENING.sub(mask_rek, result)

        # Redaksi NPWP
        result = REGEX_NPWP_FORMAT.sub(lambda m: m.group(0)[:6] + ".***.*-***.***", result)

    if redact_medium_risk:
        # Redaksi Tanggal Lahir
        def mask_tgl_lahir(m):
            full_str = m.group(0)
            dob_str = m.group(1)
            parts = re.split(r"[-/.]", dob_str)
            if len(parts) == 3:
                masked_dob = f"**/**/{parts[2]}"
                return full_str.replace(dob_str, masked_dob)
            words = dob_str.split()
            if len(words) == 3:
                masked_dob = f"** ** {words[2]}"
                return full_str.replace(dob_str, masked_dob)
            return full_str.replace(dob_str, "**/**/****")

        result = REGEX_TGL_LAHIR.sub(mask_tgl_lahir, result)

    return result


if __name__ == "__main__":
    sample_text = """
    DATA PRIBADI:
    NIK: 3175061203980001
    No. KK: 3175062409010002
    Tanggal Lahir: 15/04/1998
    TTL: Bandung, 20 Mei 1995
    NPWP: 01.234.567.8-901.000
    No. Rekening Standar: 1710001234567
    No. Rekening Pendek Dummy: 1234567

    BUKAN DATA PRIBADI (Harus Diabaikan):
    No. Invoice: 9876543210987654
    Kode Tracking Pengiriman: 1234567890123456
    Tanggal Surat: 08-09-2026
    Jakarta, 8 September 2026
    Batas Akhir Pencairan: 31-10-2026
    NIM: 1710624160
    NSPP: 510035280388
    """

    print("=== TEST DETEKSI PII ===")
    found = detect_pii(sample_text)
    print("Kategori PII terdeteksi:", found)
    assert "NIK (KTP)" in found
    assert "Nomor Kartu Keluarga (KK)" in found
    assert "Nomor Rekening Bank" in found
    assert "NPWP" in found
    assert "Tanggal Lahir" in found

    # Uji coba teks yang murni non-PII
    non_pii_text = """
    No. Invoice: 9876543210987654
    Kode Tracking: 1234567890123456
    Tanggal Surat: 08-09-2026
    Jakarta, 8 September 2026
    """
    found_non_pii = detect_pii(non_pii_text)
    print("Deteksi pada teks non-PII:", found_non_pii)
    assert len(found_non_pii) == 0, f"Error! False positive pada non-PII: {found_non_pii}"
    print("-> Semua assertion berhasil! Tidak ada false positive pada invoice dan tanggal surat.")

    print("\n=== TEST REDAKSI DEFAULT (Semua Disamarkan) ===")
    redacted_default = redact_pii(sample_text)
    print(redacted_default)
    assert "12***67" in redacted_default, "Bug mask_rek belum teratasi!"
    assert "3175********0001" in redacted_default
    print("-> Verifikasi rekening pendek berhasil: 1234567 ter-mask menjadi 12***67!")

    print("\n=== TEST ALLOW RAW HIGH RISK (redact_high_risk=False) ===")
    raw_high = redact_pii(sample_text, redact_high_risk=False, redact_medium_risk=True)
    assert "3175061203980001" in raw_high
    assert "1234567" in raw_high
    assert "**/**/1998" in raw_high
    print("-> Berhasil: NIK dan Rekening tetap mentah, Tanggal Lahir tetap disamarkan!")
