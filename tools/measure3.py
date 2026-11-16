#!/usr/bin/env python3
"""measure3.py — раскладка стоимости кадра на Full HD (?q=0, pr=1.0):
главный проход (без теней) / тени (15 Гц) / блум. Плюс инвентарь сцены:
сколько светильников, сколько мешей реально рисуется в главном проходе.
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
  const snap = async (label, ms) => {
    await new Promise(res => setTimeout(res, 400));
    r.info.autoReset = false;
    r.info.reset();
    let frames = 0;
    const t0 = performance.now();
    await new Promise(res => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 < (ms || 2200)) requestAnimationFrame(tick);
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
  const inventory = (scene) => {
    let lights = 0, meshes = 0, inst = 0, points = 0, tris = 0;
    scene.traverse(o => {
      if (o.isLight) lights++;
      if (o.isInstancedMesh) { inst++; tris += (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3) * o.count; }
      else if (o.isMesh) { meshes++; tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; }
      if (o.isPoints) points++;
    });
    return { lights, meshes, inst, points, sceneTris: Math.round(tris) };
  };
  const out = [];
  for (const id of ['home', 'street', 'store', 'basement']) {
    if (app.mode !== id) {
      const p = poses[id];
      app.goto(id, p, p.yaw);
      await new Promise(res => setTimeout(res, 1500));
    }
    const inv = inventory(app.scenes[id].scene);
    post.bloom.enabled = true;
    r.shadowMap.enabled = true;
    const r1 = await snap(id + ' bloom+shadow');
    out.push({ ...r1, inv });
    post.bloom.enabled = false;
    out.push(await snap(id + ' shadow only'));
    r.shadowMap.enabled = false;
    // материал пересобирается с нуля без теней — даём кадру «устояться»
    await new Promise(res => setTimeout(res, 600));
    out.push(await snap(id + ' main pass only'));
    // главный проход без теней — точный счётчик вызовов одного прохода
    out.push({ label: id + ' one-frame', calls: r.info.render.calls, tris: r.info.render.triangles });
    r.shadowMap.enabled = true;
    post.bloom.enabled = true;
  }
  return { win: innerWidth + 'x' + innerHeight, pr: r.getPixelRatio(), runs: out };
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
        "expression": MEASURE, "awaitPromise": True, "returnByValue": True, "timeout": 180000})
    print(json.dumps(res.get("result", {}), ensure_ascii=False, indent=1))

    try:
        urllib.request.urlopen(
            urllib.request.Request(DEBUG + "/json/close/" + target["id"], method="PUT"), timeout=10)
    except Exception:
        pass


if __name__ == "__main__":
    main()
