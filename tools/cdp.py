#!/usr/bin/env python3
"""cdp.py — управление headless Chrome через DevTools Protocol без внешних зависимостей.

Запуск Chrome (отдельно):
  chrome.exe --headless=new --remote-debugging-port=9222 --user-data-dir=<профиль> about:blank

Использование:
  python tools/cdp.py <url> <js-expression> [timeout_sec]
Пример:
  python tools/cdp.py "http://127.0.0.1:8080/" "window.__test.runReport()" 120
"""

import base64
import json
import os
import socket
import struct
import sys
import time
import urllib.parse
import urllib.request

DEBUG = "http://127.0.0.1:" + os.environ.get("CDP_PORT", "9222")


def http_json(method, url):
    req = urllib.request.Request(url, method=method)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


class WS:
    def __init__(self, url):
        rest = url[5:]
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=20)
        self.sock.settimeout(180)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        data = b""
        while b"\r\n\r\n" not in data:
            data += self.sock.recv(4096)
        if b"101" not in data.split(b"\r\n")[0]:
            raise RuntimeError("WS handshake failed: " + data[:200].decode("latin1"))
        self.buf = data.split(b"\r\n\r\n", 1)[1]
        self._id = 0

    def send(self, obj):
        payload = json.dumps(obj).encode()
        header = bytearray([0x81])
        n = len(payload)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        mask = os.urandom(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def _read_exact(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("socket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv_msg(self):
        payload = b""
        while True:
            b1, b2 = self._read_exact(2)
            fin, opcode = b1 & 0x80, b1 & 0x0F
            masked, ln = b2 & 0x80, b2 & 0x7F
            if ln == 126:
                ln = struct.unpack(">H", self._read_exact(2))[0]
            elif ln == 127:
                ln = struct.unpack(">Q", self._read_exact(8))[0]
            mask = self._read_exact(4) if masked else None
            data = self._read_exact(ln)
            if mask:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            if opcode == 0x9:  # ping
                pong = bytearray([0x8A, 0x80]) + os.urandom(4)
                self.sock.sendall(bytes(pong))
                continue
            if opcode == 0x8:
                raise ConnectionError("ws close")
            payload += data
            if fin:
                return payload

    def call(self, method, params=None):
        self._id += 1
        mid = self._id
        self.send({"id": mid, "method": method, "params": params or {}})
        while True:
            msg = json.loads(self.recv_msg())
            if msg.get("id") == mid:
                return msg


def main():
    url = sys.argv[1]
    expr = sys.argv[2]
    timeout = int(sys.argv[3]) if len(sys.argv) > 3 else 120

    target = http_json("PUT", DEBUG + "/json/new?" + urllib.parse.quote(url, safe=""))
    ws = WS(target["webSocketDebuggerUrl"])
    ws.call("Runtime.enable")
    ws.call("Page.enable")

    # ждём инициализации страницы и window.__test
    t0 = time.time()
    while time.time() - t0 < 45:
        r = ws.call("Runtime.evaluate", {"expression": "!!window.__game", "returnByValue": True})
        if r.get("result", {}).get("result", {}).get("value") is True:
            break
        time.sleep(0.5)

    gpu = ws.call("Runtime.evaluate", {
        "expression": "(()=>{try{const gl=window.__app.renderer.getContext();"
                      "const e=gl.getExtension('WEBGL_debug_renderer_info');"
                      "return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'n/a';}catch(x){return 'err:'+x}})()",
        "returnByValue": True})
    print("GPU:", gpu.get("result", {}).get("result", {}).get("value"))

    print("EVAL:", expr[:120])
    res = ws.call("Runtime.evaluate", {
        "expression": expr, "awaitPromise": True, "returnByValue": True,
        "userGesture": True,  # автотесты WebAudio могут вызывать resume() как реальный клик
        "timeout": timeout * 1000})
    print(json.dumps(res.get("result", {}), ensure_ascii=False, indent=1)[:8000])

    # Chrome может вернуть пустой ответ на /json/close — это нормально
    try:
        req = urllib.request.Request(DEBUG + "/json/close/" + target["id"], method="PUT")
        with urllib.request.urlopen(req, timeout=10) as r:
            r.read()
    except Exception:
        pass


if __name__ == "__main__":
    main()
