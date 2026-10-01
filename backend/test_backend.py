"""
Lightweight Mock Backend for Testing Chandra Asri Knowledge Hub API
Endpoint: http://localhost:8000/api/chat
Payload accepted: { "query": "...", "asset_tag": "..." }
"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8000

class ChatAPIHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        # Enable CORS so the frontend on any port can call this backend
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
                "version": "1.0.0"
            }).encode('utf-8'))
        else:
            self._set_headers(404)

    def do_POST(self):
        if self.path == '/api/chat':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                raw_text = body.decode('utf-8', errors='ignore')
                print(f"[API SERVER] Raw body: {raw_text}")
                data = json.loads(raw_text)
                query = data.get('query', '')
                asset_tag = data.get('asset_tag', 'GENERAL')
                print(f"[API SERVER] Query for [{asset_tag}]: {query}")
                
                # Sample domain response
                response_text = (
                    f"Berdasarkan verifikasi dokumen teknis pabrik Chandra Asri untuk unit {asset_tag}:\n\n"
                    f"Pertanyaan: \"{query}\"\n\n"
                    f"1. Seluruh parameter operasi {asset_tag} wajib dipantau sesuai batas aman di DCS.\n"
                    f"2. Verifikasi posisi valve dan pastikan interlock safety aktif sebelum intervensi teknis.\n"
                    f"3. Catat anomali getaran atau deviasi tekanan pada logsheet per shift."
                )

                response_payload = {
                    "response": response_text,
                    "citations": [
                        {
                            "source": f"CAP-SOP-{asset_tag}-MAINTENANCE.pdf",
                            "page": 24,
                            "revision": "Rev 3.2 (2025)",
                            "confidence_score": 0.958,
                            "snippet": f"Prosedur Verifikasi Operasional & Standar Keselamatan Aset {asset_tag}"
                        },
                        {
                            "source": "CAP-CHANDRA-ASRI-PLANT-GUIDELINES.pdf",
                            "page": 5,
                            "revision": "Rev 4.0",
                            "confidence_score": 0.914,
                            "snippet": "Pedoman Pengoperasian Peralatan Kritis di Kawasan Industri Cilegon"
                        }
                    ]
                }

                self._set_headers(200)
                self.wfile.write(json.dumps(response_payload).encode('utf-8'))
            except Exception as e:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self._set_headers(404)

def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, ChatAPIHandler)
    print(f"Chandra Asri Chat API Mock Server running on http://localhost:{PORT}/api/chat")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()

if __name__ == '__main__':
    run()
