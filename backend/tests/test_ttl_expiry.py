"""
tests/test_ttl_expiry.py - Verifikasi Mekanisme TTL Expiry Tanpa Mengekspos Endpoint Testing Publik

Pendekatan Pengujian:
1. Tidak ada endpoint HTTP /expire-test maupun query parameter ?ttl_seconds= pada API publik.
2. Pengujian TTL dilakukan melalui TestClient FastAPI dengan memanipulasi state in-memory
   api.PENDING_UPLOADS secara langsung di level Python / test suite.
3. Menguji pembersihan file staging saat confirm mendeteksi dokumen telah kedaluwarsa.
4. Menguji fungsi purge_expired_pending_uploads() yang dipakai oleh background cleanup task.
5. Memverifikasi bahwa endpoint /expire-test dan query parameter ?ttl_seconds= benar-benar
   tidak ada / diabaikan pada kontrak API publik.
"""

import os
import sys
import time
from fastapi.testclient import TestClient

# Pastikan path modul utama terbaca
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api import (
    app,
    PENDING_UPLOADS,
    PENDING_TTL_SECONDS,
    purge_expired_pending_uploads,
)


def simulate_pending_expiry(pending_id: str, offset_seconds: float = 3600) -> bool:
    """
    Fungsi helper khusus testing internal:
    Memanipulasi created_at pada dictionary in-memory PENDING_UPLOADS secara langsung.
    Tidak ada HTTP endpoint publik yang terlibat.
    """
    if pending_id in PENDING_UPLOADS:
        PENDING_UPLOADS[pending_id]["created_at"] = time.time() - offset_seconds
        return True
    return False


def run_all_ttl_tests():
    client = TestClient(app)
    sample_file_path = "test_doc_pii_approved.txt"
    if not os.path.exists(sample_file_path):
        with open(sample_file_path, "w", encoding="utf-8") as f:
            f.write("Kontrak Karyawan:\nNama: Budi Santoso\nNIK: 3201012005900001\nEmail: budi@corp.id\n")

    print("\n" + "=" * 70)
    print("=== PENGUJIAN TTL EXPIRY BERSIH (TANPA ENDPOINT / PARAMETER PUBLIK) ===")
    print("=" * 70)

    # -------------------------------------------------------------
    # Test 1: Upload dengan PII -> Simulasi Expiry -> Confirm -> 404
    # -------------------------------------------------------------
    print("\n[TEST 1] Upload dokumen PII -> Simulasi Expiry Langsung di Python -> Confirm")
    with open(sample_file_path, "rb") as f:
        resp = client.post("/upload", files={"file": (sample_file_path, f, "text/plain")})
    assert resp.status_code == 200, f"Upload gagal: {resp.text}"
    data = resp.json()
    assert data["status"] == "pending_consent"
    pending_id = data["pending_id"]
    print(f"  -> Upload berhasil: pending_id={pending_id}")
    print(f"  -> TTL tertera di response metadata: {data.get('ttl_seconds')} detik (tetap 30 menit)")

    # Periksa keberadaan file staging di disk
    staging_file = PENDING_UPLOADS[pending_id]["file_path"]
    assert os.path.exists(staging_file), "File staging sementara harus ada sebelum expiry."
    print(f"  -> File staging sementara terkonfirmasi ada di disk: {staging_file}")

    # Simulasi expiry: mundurkan created_at sejauh 3600 detik (1 jam yang lalu)
    mutated = simulate_pending_expiry(pending_id, offset_seconds=PENDING_TTL_SECONDS + 60)
    assert mutated, "Gagal memanipulasi created_at pada PENDING_UPLOADS."
    print(f"  -> created_at dimundurkan secara in-memory (simulasi expiry: {PENDING_TTL_SECONDS + 60}s yang lalu)")

    # Panggil /confirm
    confirm_resp = client.post(
        f"/upload/{pending_id}/confirm",
        json={"consent_processing": True, "consent_ocr": False, "allow_raw_pii": False},
    )
    print(f"  -> HTTP Response Code: {confirm_resp.status_code}")
    print(f"  -> Response Body: {confirm_resp.json()}")

    assert confirm_resp.status_code == 404, f"Harus 404 tapi dapat: {confirm_resp.status_code}"
    assert "telah kedaluwarsa" in confirm_resp.json()["detail"], "Pesan error harus menyebut kedaluwarsa."
    assert not os.path.exists(staging_file), "File staging sementara HARUS dibersihkan setelah kedaluwarsa!"
    print(f"  -> File staging terkonfirmasi telah dibersihkan otomatis dari disk: {not os.path.exists(staging_file)}")
    print("  [HASIL TEST 1: PASSED]")

    # -------------------------------------------------------------
    # Test 2: Purge Task Membersihkan Entri Kedaluwarsa Otomatis
    # -------------------------------------------------------------
    print("\n[TEST 2] Verifikasi fungsi purge_expired_pending_uploads() (Background Cleaner)")
    with open(sample_file_path, "rb") as f:
        resp2 = client.post("/upload", files={"file": (sample_file_path, f, "text/plain")})
    assert resp2.status_code == 200
    pending_id2 = resp2.json()["pending_id"]
    staging_file2 = PENDING_UPLOADS[pending_id2]["file_path"]

    simulate_pending_expiry(pending_id2, offset_seconds=PENDING_TTL_SECONDS + 120)
    print(f"  -> Dibuat pending_id2={pending_id2}, created_at dimundurkan.")

    purged_ids = purge_expired_pending_uploads()
    print(f"  -> purge_expired_pending_uploads() dijalankan, IDs dibersihkan: {purged_ids}")
    assert pending_id2 in purged_ids, "pending_id2 harus masuk dalam list purged."
    assert pending_id2 not in PENDING_UPLOADS, "pending_id2 harus hilang dari PENDING_UPLOADS."
    assert not os.path.exists(staging_file2), "File staging pending_id2 harus terhapus."
    print("  [HASIL TEST 2: PASSED]")

    # -------------------------------------------------------------
    # Test 3: Endpoint Testing /expire-test Benar-Benar Dihapus (404 Not Found)
    # -------------------------------------------------------------
    print("\n[TEST 3] Verifikasi endpoint /upload/{pending_id}/expire-test TIDAK ADA di API")
    resp_expire_test = client.post(f"/upload/{pending_id}/expire-test")
    print(f"  -> POST /upload/{pending_id}/expire-test -> HTTP {resp_expire_test.status_code}")
    print(f"  -> Response: {resp_expire_test.json()}")
    assert resp_expire_test.status_code == 404, "Endpoint /expire-test harus menghasilkan 404 Not Found!"
    assert resp_expire_test.json().get("detail") == "Not Found", "Detail harus standard FastAPI Not Found route."
    print("  [HASIL TEST 3: PASSED - Endpoint backdoor testing terbukti hilang]")

    # -------------------------------------------------------------
    # Test 4: Parameter Query ?ttl_seconds= Diabaikan Sama Sekali
    # -------------------------------------------------------------
    print("\n[TEST 4] Verifikasi query parameter ?ttl_seconds= tidak mempengaruhi durasi TTL")
    with open(sample_file_path, "rb") as f:
        # Client mencoba inject query param ttl_seconds=1
        resp_inj = client.post("/upload?ttl_seconds=1", files={"file": (sample_file_path, f, "text/plain")})
    assert resp_inj.status_code == 200
    pending_id3 = resp_inj.json()["pending_id"]
    # Periksa apakah di dictionary internal ada ttl_seconds=1
    stored_entry = PENDING_UPLOADS[pending_id3]
    assert "ttl_seconds" not in stored_entry, "stored_entry tidak boleh menyimpan ttl_seconds dari query client!"
    print(f"  -> State internal PENDING_UPLOADS[pending_id3]: {stored_entry.get('file_name')} (tidak ada key ttl_seconds)")

    # Tunggu 2 detik untuk membuktikan bahwa pending upload TIDAK kedaluwarsa setelah 1 detik
    print("  -> Menunggu 2 detik untuk membuktikan upload TIDAK kedaluwarsa...")
    time.sleep(2)
    confirm_inj = client.post(
        f"/upload/{pending_id3}/confirm",
        json={"consent_processing": False},  # Reject untuk bersihkan
    )
    assert confirm_inj.status_code == 200, "Upload tidak boleh kedaluwarsa hanya karena client mengirim ?ttl_seconds=1!"
    print(f"  -> Confirm berhasil diproses (status: {confirm_inj.json()['status']}), membuktikan TTL tidak dapat disetel client.")
    print("  [HASIL TEST 4: PASSED]")

    # -------------------------------------------------------------
    # Test 5: Scan OpenAPI Specification (Kontrak API Publik)
    # -------------------------------------------------------------
    print("\n[TEST 5] Verifikasi Dokumen OpenAPI Schema (/openapi.json)")
    openapi_resp = client.get("/openapi.json")
    assert openapi_resp.status_code == 200
    schema = openapi_resp.json()
    paths = schema.get("paths", {})

    print(f"  -> Total endpoints terdaftar: {len(paths)}")
    for p in paths:
        methods = list(paths[p].keys())
        print(f"     * {methods[0].upper()} {p}")

    assert "/upload/{pending_id}/expire-test" not in paths, "Backdoor endpoint /expire-test masih ada di OpenAPI!"

    # Cek parameter pada POST /upload
    upload_params = paths.get("/upload", {}).get("post", {}).get("parameters", [])
    param_names = [p.get("name") for p in upload_params]
    assert "ttl_seconds" not in param_names, f"Parameter ttl_seconds masih ada di /upload: {param_names}"
    print(f"  -> Parameter di /upload: {param_names} (ttl_seconds bersih/tidak ada)")
    print("  [HASIL TEST 5: PASSED - OpenAPI schema bersih dari testing surface]")

    print("\n" + "=" * 70)
    print("=== SELURUH PENGUJIAN TTL EXPIRY BERHASIL 100% ===")
    print("=" * 70)


if __name__ == "__main__":
    run_all_ttl_tests()
