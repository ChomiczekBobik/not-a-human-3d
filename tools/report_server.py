#!/usr/bin/env python3
"""report_server.py — http.server на 8080 + приём POST /report (JSON -> /tmp/report.json)."""
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

REPORT_PATH = "/tmp/report.json"


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/report":
            n = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(n)
            try:
                json.loads(body)  # валидация
                with open(REPORT_PATH, "wb") as f:
                    f.write(body)
                self.send_response(200)
            except Exception:
                self.send_response(400)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8080), Handler).serve_forever()
