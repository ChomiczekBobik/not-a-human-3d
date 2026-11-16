#!/usr/bin/env python3
"""measure.py — прогон замеров calls/tris/fps по всем сценам через CDP.

Запуск Chrome (обязательно свежий user-data-dir, иначе кэш модулей отдаёт старые файлы):
  chrome.exe --headless=new --remote-debugging-port=9339 --user-data-dir=<temp> \
      --window-size=1920,1080 --use-angle=default about:blank

  set CDP_PORT=9339 & python tools/measure.py

Переменные: CDP_PORT (порт), APP_URL (страница, по умолчанию http://127.0.0.1:8080/#scene-home)
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import DEBUG, WS, http_json  # noqa: E402

URL = os.environ.get("APP_URL", "http://127.0.0.1:8080/#scene-home")

MEASURE = r"""
(async () => {
  const app = window.__app, r = app.renderer;
  const poses = {
    home:     { x: 0,   z: 1.6, yaw: 0 },
    street:   { x: 0,   z: 1.6, yaw: 0 },
    store:    { x: 0,   z: 4.6, yaw: 0 },
    basement: { x: 0,   z: 1.6, yaw: 0 }
  };
  const out = [];
  for (const id of ['home', 'street', 'store', 'basement']) {
    if (app.mode !== id) {
      const p = poses[id];
      app.goto(id, p, p.yaw);
      await new Promise(res => setTimeout(res, 1500));
    }
    await new Promise(res => setTimeout(res, 800));
    r.info.autoReset = false;
    r.info.reset();
    let frames = 0;
    const t0 = performance.now();
    await new Promise(res => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 < 1800) requestAnimationFrame(tick);
        else res();
      };
      requestAnimationFrame(tick);
    });
    const dt = (performance.now() - t0) / 1000;
    out.push({
      id, mode: app.mode,
      calls: +(r.info.render.calls / frames).toFixed(1),
      tris: Math.round(r.info.render.triangles / frames),
      fps: +(frames / dt).toFixed(1),
      pr: r.getPixelRatio(),
      perf: window.__perf ? window.__perf() : null
    });
    r.info.autoReset = true;
  }
  return out;
})()
"""


def main():
    target = http_json("PUT", DEBUG + "/json/new?" + urllib.parse.quote(URL, safe=""))
    ws = WS(target["webSocketDebuggerUrl"])
    ws.call("Runtime.enable")
    ws.call("Page.enable")

    t0 = time.time()
    while time.time() - t0 < 60:
        r = ws.call("Runtime.evaluate", {"expression": "!!window.__game", "returnByValue": True})
        if r.get("result", {}).get("result", {}).get("value") is True:
            break
        time.sleep(0.5)

    # ждём старт игры (#scene-home кликает start-btn и прыгает в локацию)
    time.sleep(3.5)

    gpu = ws.call("Runtime.evaluate", {
        "expression": "(()=>{try{const gl=window.__app.renderer.getContext();"
                      "const e=gl.getExtension('WEBGL_debug_renderer_info');"
                      "return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'n/a';}catch(x){return 'err:'+x}})()",
        "returnByValue": True})
    print("GPU:", gpu.get("result", {}).get("result", {}).get("value"))

    size = ws.call("Runtime.evaluate", {
        "expression": "window.innerWidth+'x'+window.innerHeight+' dpr='+window.devicePixelRatio",
        "returnByValue": True})
    print("WIN:", size.get("result", {}).get("result", {}).get("value"))

    res = ws.call("Runtime.evaluate", {
        "expression": MEASURE, "awaitPromise": True, "returnByValue": True, "timeout": 90000})
    print(json.dumps(res.get("result", {}), ensure_ascii=False, indent=1))

    try:
        urllib.request.urlopen(
            urllib.request.Request(DEBUG + "/json/close/" + target["id"], method="PUT"), timeout=10)
    except Exception:
        pass


if __name__ == "__main__":
    main()
