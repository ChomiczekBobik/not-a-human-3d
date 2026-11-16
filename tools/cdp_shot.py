#!/usr/bin/env python3
"""cdp_shot.py — снимок страницы через CDP.
python tools/cdp_shot.py <url> <js-после-загрузки или -> <out.png> [settle_sec]
"""
import base64
import sys
import time

from cdp import DEBUG, WS, http_json
import urllib.parse

url = sys.argv[1]
expr = sys.argv[2]
out = sys.argv[3]
settle = float(sys.argv[4]) if len(sys.argv) > 4 else 3.0

target = http_json("PUT", DEBUG + "/json/new?" + urllib.parse.quote(url, safe=""))
ws = WS(target["webSocketDebuggerUrl"])
ws.call("Runtime.enable")
ws.call("Page.enable")

t0 = time.time()
while time.time() - t0 < 45:
    r = ws.call("Runtime.evaluate", {"expression": "!!window.__game", "returnByValue": True})
    if r.get("result", {}).get("result", {}).get("value") is True:
        break
    time.sleep(0.5)

if expr and expr != "-":
    r = ws.call("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True, "timeout": 120000})
    print("expr:", str(r.get("result", {}).get("result", {}))[:200])
time.sleep(settle)

shot = ws.call("Page.captureScreenshot", {"format": "png"})
if "result" not in shot:
    print("SCREENSHOT ERROR:", shot)
    sys.exit(2)
data = base64.b64decode(shot["result"]["data"])
open(out, "wb").write(data)
print("saved:", out, len(data), "bytes")
try:
    import urllib.request
    urllib.request.urlopen(urllib.request.Request(DEBUG + "/json/close/" + target["id"]), timeout=10)
except Exception:
    pass
