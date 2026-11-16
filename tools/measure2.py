#!/usr/bin/env python3
"""measure2.py — изоляция стоимости кадра на Full HD (?q=0: pr=1.0, адаптив выключен).

Меряет каждую сцену дважды: как есть и без блума (post.bloom.enabled=false),
плюс отдельно проверяет отсечение подъезда (corridor.visible) в квартире.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import DEBUG, WS, http_json  # noqa: E402

URL = os.environ.get("APP_URL", "http://127.0.0.1:8080/?q=0#scene-home")

MEASURE = r"""
(async () => {
  const app = window.__app, r = app.renderer, post = app.post;
  const poses = {
    home:     { x: 0,   z: 1.6, yaw: 0 },
    street:   { x: 0,   z: 1.6, yaw: 0 },
    store:    { x: 0,   z: 4.6, yaw: 0 },
    basement: { x: 0,   z: 1.6, yaw: 0 }
  };
  const snap = async (label) => {
    await new Promise(res => setTimeout(res, 500));
    r.info.autoReset = false;
    r.info.reset();
    let frames = 0;
    const t0 = performance.now();
    await new Promise(res => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 < 1600) requestAnimationFrame(tick);
        else res();
      };
      requestAnimationFrame(tick);
    });
    const dt = (performance.now() - t0) / 1000;
    const o = { label, calls: +(r.info.render.calls / frames).toFixed(1),
                tris: Math.round(r.info.render.triangles / frames),
                fps: +(frames / dt).toFixed(1) };
    r.info.autoReset = true;
    return o;
  };
  const out = [];
  for (const id of ['home', 'street', 'store', 'basement']) {
    if (app.mode !== id) {
      const p = poses[id];
      app.goto(id, p, p.yaw);
      await new Promise(res => setTimeout(res, 1500));
    }
    const bloomWas = post.bloom.enabled;
    post.bloom.enabled = true;
    out.push(await snap(id + ' bloom'));
    post.bloom.enabled = false;
    out.push(await snap(id + ' nobloom'));
    post.bloom.enabled = bloomWas;
  }
  // отсечение подъезда: тот же взгляд на дверь, коридор включён принудительно
  const corr = app.scenes.home.world && app.scenes.home.world.corridor;
  if (corr) {
    if (app.mode !== 'home') { const p = poses.home; app.goto('home', p, p.yaw); await new Promise(res => setTimeout(res, 1500)); }
    corr.visible = false;
    out.push(await snap('home corridor off'));
    corr.visible = true;
    out.push(await snap('home corridor ON'));
    corr.visible = false;
  }
  return { win: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio,
           pr: r.getPixelRatio(), perf: window.__perf(), runs: out };
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
    time.sleep(3.5)

    res = ws.call("Runtime.evaluate", {
        "expression": MEASURE, "awaitPromise": True, "returnByValue": True, "timeout": 120000})
    print(json.dumps(res.get("result", {}), ensure_ascii=False, indent=1))

    try:
        urllib.request.urlopen(
            urllib.request.Request(DEBUG + "/json/close/" + target["id"], method="PUT"), timeout=10)
    except Exception:
        pass


if __name__ == "__main__":
    main()
