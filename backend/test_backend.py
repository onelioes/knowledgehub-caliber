"""
Lightweight Mock Backend for Testing Chandra Asri Knowledge Hub API
Endpoint: http://localhost:8000/api/chat
Payload accepted: { "query": "...", "asset_tag": "..." }
"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8000

ASSET_KNOWLEDGE = {
    'P-101A': {
        'title': 'Pompa Sentrifugal Umpan Naphtha (Primary Feed Pump)',
        'unit': 'Olefins Complex (Cilegon)',
        'sop': 'CAP-SOP-MECH-P101-STARTUP.pdf',
        'details': (
            "Prosedur Verifikasi Startup Pompa Naphtha P-101A:\n\n"
            "1. Lube Oil System: Level reservoir oli pelumas wajib minimal 65% dengan tekanan lube oil 2.1 bar gauge.\n"
            "2. Venting Casing: Buka manual vent valve hingga aliran fluida naphtha kontinu bebas gelembung uap (mencegah kavitasi).\n"
            "3. Mechanical Seal Plan 53A: Pastikan barrier fluid bertekanan minimal 1.5 bar di atas suction pressure.\n"
            "4. Interlock Safety: Pastikan sinyal trip dari DCS Honeywell normal dan permit kerja dingin/panas telah ditutup."
        ),
        'citations': [
            {
                'source': 'CAP-SOP-MECH-P101-STARTUP.pdf',
                'page': 18,
                'revision': 'Rev 4.2 (2025)',
                'confidence_score': 0.965,
                'snippet': 'Section 3.2: Pre-startup Verification - Suction and Plan 53A Pressure Checks'
            },
            {
                'source': 'VENDOR-SULZER-OH2-MANUAL.pdf',
                'page': 42,
                'revision': 'Rev 2.0 (2022)',
                'confidence_score': 0.912,
                'snippet': 'Section 4.1: Lubrication and Mechanical Seal Pressure Barrier Limits'
            }
        ]
    },
    'K-102': {
        'title': 'Kompresor Gas Sintesis Ethylene (Syngas Compressor)',
        'unit': 'Polyethylene Plant (PE-1)',
        'sop': 'CAP-INST-K102-VIBRATION-SPEC.pdf',
        'details': (
            "Batas Vibrasi & Interlock Trip Kompresor Gas K-102:\n\n"
            "1. Ambang Peringatan (Alarm): 45 um pk-pk pada radial bearing probe X/Y.\n"
            "2. Ambang Trip Otomatis: 68 um pk-pk memicu solenoid emergency shutdown (ESD).\n"
            "3. Mitigasi Spike 1X Synchronous: Periksa akumulasi deposit polimer pada impeller stage 2 dan jaga temperatur gas recycle 5°C di atas dew point."
        ),
        'citations': [
            {
                'source': 'CAP-INST-K102-VIBRATION-SPEC.pdf',
                'page': 7,
                'revision': 'Rev 3.1 (2024)',
                'confidence_score': 0.948,
                'snippet': 'Table 2.4: Vibration Thresholds and Interlock Trip Matrix K-102'
            },
            {
                'source': 'RCFA-2024-K102-POLYMER-FOULING.pdf',
                'page': 3,
                'revision': 'Final Rev 1',
                'confidence_score': 0.885,
                'snippet': 'Lesson Learned: Partial recycle gas polymerization triggers 1X vibration'
            }
        ]
    },
    'F-101': {
        'title': 'Furnace Perengkahan Termal Naphtha (Thermal Cracking Furnace)',
        'unit': 'Cracker Complex',
        'sop': 'CAP-FURNACE-F101-INTEGRITY-REPORT.pdf',
        'details': (
            "Histori & Parameter Integritas Tube Furnace F-101:\n\n"
            "1. Batas Maksimum Tube Metal Temperature (TMT): 1080°C pada thermocouple bridgewall.\n"
            "2. Pengendalian Coke Laydown: Pertahankan rasio steam-to-oil stabil saat transisi umpan.\n"
            "3. Siklus Decoking Termal: Pelaksanaan steam-air decoking online terjadwal setiap 60 hari operasi."
        ),
        'citations': [
            {
                'source': 'CAP-FURNACE-F101-INTEGRITY-REPORT.pdf',
                'page': 25,
                'revision': 'Rev 5.0 (2025)',
                'confidence_score': 0.972,
                'snippet': 'Metallurgical Analysis of Tube HP-40 and Coke Deposition Control'
            },
            {
                'source': 'SOP-FURNACE-STEAM-AIR-DECOKING.pdf',
                'page': 12,
                'revision': 'Rev 3.0 (2023)',
                'confidence_score': 0.931,
                'snippet': 'Operational Steps for Thermal Steam and Air Decoking'
            }
        ]
    },
    'C-201': {
        'title': 'Kolom Fraksinasi C2 Splitter (Fractionation Column)',
        'unit': 'Olefins Fractionation',
        'sop': 'CAP-PID-C201-FRACTIONATION.dwg.pdf',
        'details': (
            "Penanganan Anomali Tekanan Kolom C2 Splitter C-201:\n\n"
            "1. Batas Normal Delta P: 0.45 - 0.75 bar melintasi tray 18 hingga 24.\n"
            "2. Indikasi Flooding: Delta P > 0.85 bar menunjukkan akumulasi cairan hidrokarbon berlebih.\n"
            "3. Aksi Korektif: Turunkan reflux ratio sebesar 5% secara gradual dan periksa temperatur reboiler."
        ),
        'citations': [
            {
                'source': 'CAP-PID-C201-FRACTIONATION.dwg.pdf',
                'page': 4,
                'revision': 'Rev 6.1 (2024)',
                'confidence_score': 0.952,
                'snippet': 'Section 2.2: Fractionation Tray Flooding Limits and Pressure Differential Control'
            }
        ]
    }
}

class ChatAPIHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path in ['/', '/api/chat', '/docs']:
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "status": "online",
                "service": "Chandra Asri Manufacturing KnowledgeHub Chat API",
                "version": "1.1.0"
            }).encode('utf-8'))
        else:
            self._set_headers(404)

    def do_POST(self):
        if self.path == '/api/chat':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                raw_text = body.decode('utf-8', errors='ignore')
                print(f"[API SERVER] Received: {raw_text}")
                try:
                    data = json.loads(raw_text)
                except Exception:
                    data = {}

                query = data.get('query', '')
                asset_tag = data.get('asset_tag', 'P-101A')

                # Smart domain matching
                matched_asset = None
                for key in ASSET_KNOWLEDGE.keys():
                    if key.lower() in query.lower() or asset_tag == key:
                        matched_asset = key
                        break

                if not matched_asset:
                    matched_asset = asset_tag if asset_tag in ASSET_KNOWLEDGE else 'P-101A'

                info = ASSET_KNOWLEDGE.get(matched_asset, ASSET_KNOWLEDGE['P-101A'])
                
                response_text = (
                    f"Verifikasi Berdasarkan Dokumen Resmi {info['sop']} (Unit {info['unit']}):\n\n"
                    f"{info['details']}\n\n"
                    f"Rekomendasi Tambahan untuk Pertanyaan '{query}':\n"
                    f"- Pantau indikator DCS secara kontinu dan pastikan logsheet shift telah diisi."
                )

                response_payload = {
                    "response": response_text,
                    "citations": info['citations']
                }

                self._set_headers(200)
                self.wfile.write(json.dumps(response_payload).encode('utf-8'))
            except Exception as e:
                self._set_headers(200)
                fallback = {
                    "response": f"Rekomendasi teknis operasional untuk query '{query}': Seluruh parameter wajib diverifikasi sesuai dokumen SOP Chandra Asri.",
                    "citations": [
                        {
                            "source": "CAP-SOP-GENERAL-OPERATIONS.pdf",
                            "page": 10,
                            "revision": "Rev 3.0",
                            "confidence_score": 0.92,
                            "snippet": "Pedoman Operasi Standar Kawasan Industri Kimia Chandra Asri"
                        }
                    ]
                }
                self.wfile.write(json.dumps(fallback).encode('utf-8'))
        else:
            self._set_headers(404)

def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, ChatAPIHandler)
    print(f"Chandra Asri Chat API Server running on http://localhost:{PORT}/api/chat")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()

if __name__ == '__main__':
    run()
