# -*- coding: utf-8 -*-
"""Диагностика сектора: почему веер не видно. Верхний план + параметры меша."""
import base64, json, os, sys, time
sys.path.insert(0, r"C:\Users\user\not-a-human-3d\tools")
from cdp import WS, http_json, DEBUG

OUT = r"C:\Users\user\not-a-human-3d\shots"
URL = "http://127.0.0.1:8080/"

target = http_json("PUT", DEBUG + "/json/new?" + URL)
ws = WS(target["webSocketDebuggerUrl"])
ws.call("Runtime.enable"); ws.call("Page.enable")
ws.call("Emulation.setDeviceMetricsOverride", {"width": 1600, "height": 900, "deviceScaleFactor": 1, "mobile": False})

def ev(expr):
    r = ws.call("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True, "userGesture": True, "timeout": 60000})
    res = r.get("result", {})
    if "exceptionDetails" in res:
        print("EXC", res["exceptionDetails"].get("exception", {}).get("description", "")[:500])
    return res.get("result", {}).get("value")

started = time.time(); ok = False
while time.time() - started < 90:
    if ev("!!(window.__game && window.__app && window.__app.scenes && Object.keys(window.__app.scenes).length === 9)"):
        ok = True; break
    time.sleep(.4)
print("ready", ok)
ev("document.getElementById('start-btn').click(); true")
time.sleep(1.4)
ev("""(()=>{const a=window.__app,g=window.__game;
  document.getElementById('title').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  a.transitioning=false; g.phase='store'; g.day=1; g.cart.length=0;
  a.goto('store',{seamless:true}); window.__fan=null; return a.mode;})()""")
time.sleep(1.0)

print(ev("""(()=>{const a=window.__app,s=a.scenes.store;
  let fan=null, rays=[];
  s.scene.traverse(o=>{
    if(o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position && o.geometry.attributes.position.count===42) fan=o;
    if(o.isMesh && o.geometry && o.geometry.type==='PlaneGeometry' && o.geometry.attributes.position.count===4) rays.push(o);
  });
  window.__fan=fan;
  if(!fan) return JSON.stringify({fan:false});
  fan.updateWorldMatrix(true,false);
  const p=fan.geometry.attributes.position, V=fan.position.constructor;
  let out=[];
  for(let i=0;i<p.count;i+=8){ const w=fan.localToWorld(new V().fromBufferAttribute(p,i)); out.push([+w.x.toFixed(2),+w.y.toFixed(2),+w.z.toFixed(2)]); }
  let visChain=true, n=fan;
  while(n){ if(!n.visible) visChain=false; n=n.parent; }
  return JSON.stringify({fan:true, pos:fan.position.toArray().map(n=>+n.toFixed(2)), vis:fan.visible, op:fan.material.opacity,
    col:fan.material.color.getHexString(), side:fan.material.side, dep:fan.material.depthWrite, ro:fan.renderOrder,
    visChain:visChain, inScene:!!fan.parent&&fan.parent.parent===s.scene, rays:rays.length,
    world:out, parent:fan.parent.type, grp:fan.parent.position.toArray().map(n=>+n.toFixed(3))});})()"""))

def shot(name):
    time.sleep(.5)
    img = ws.call("Page.captureScreenshot", {"format": "png"})
    p = os.path.join(OUT, name)
    open(p, "wb").write(base64.b64decode(img["result"]["data"]))
    print(p)

def cam(x, y, z, lx, ly, lz):
    ev(f"""(()=>{{const a=window.__app;const c=a.camera;c.position.set({x},{y},{z});
      c.lookAt({lx},{ly},{lz});if(a.controls&&a.controls.target){{a.controls.target.set({lx},{ly},{lz});a.controls.update&&a.controls.update();}}
      return 1;}})()""")

# верхний план строго над сектором
cam(1.0, 8.5, 2.6, 3.4, 0, 1.6); shot("gaze3_top.png")
# вид сбоку-сверху на пол перед прилавком
cam(2.6, 3.4, 6.2, 4.2, 0, 1.2); shot("gaze3_side.png")

# форсируем яркость и поднимаем над полом
ev("""(()=>{const f=window.__fan; if(!f) return 0; f.material.opacity=0.85; f.material.color.set(0xff0000);
  f.parent.position.y=0.12; f.parent.updateMatrixWorld(true); return 1;})()""")
cam(1.0, 8.5, 2.6, 3.4, 0, 1.6); shot("gaze3_top_force.png")
print("done")