# -*- coding: utf-8 -*-
"""Снимки обрезанного сектора: широкий план, кран под потолком, тревога, ценники."""
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
        print("EXC", res["exceptionDetails"].get("exception", {}).get("description", "")[:400])
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
  a.goto('store',{seamless:true}); return a.mode;})()""")
time.sleep(1.0)

print(ev("""(()=>{const a=window.__app,s=a.scenes.store;
  return JSON.stringify({mode:a.mode,yaw:+s.stealth.yaw.toFixed(2),alert:0,
    eyes:s.stealth.eye, sceneKids:s.scene.children.length});})()"""))

def shot(name):
    time.sleep(.6)
    img = ws.call("Page.captureScreenshot", {"format": "png"})
    p = os.path.join(OUT, name)
    open(p, "wb").write(base64.b64decode(img["result"]["data"]))
    print(p)

def cam(x, y, z, lx, ly, lz):
    ev(f"""(()=>{{const a=window.__app;const c=a.camera;c.position.set({x},{y},{z});
      c.lookAt({lx},{ly},{lz});if(a.controls&&a.controls.target){{a.controls.target.set({lx},{ly},{lz});a.controls.update&&a.controls.update();}}
      return 1;}})()""")

def freeze(yaw):
    """Ставим взгляд в понятное положение: сканирование не мешает кадру."""
    ev(f"""(()=>{{const a=window.__app,g=window.__game,s=a.scenes.store;
      const st=s.stealth; st.setAlert(0); g.storeSuspicion=0; a.ui.setStealth(false,0,false);
      let gr=null; s.scene.traverse(o=>{{ if(!gr && o.type==='Group' && o.userData.noHighlight && o.children.length) gr=o; }});
      return 1;}})()""")

# 1. широкий план от входа: видно, как сектор упирается в стены и паллеты
freeze(0.16)
cam(-5.2, 1.75, 4.9, 3.9, 0.05, 1.1); shot("gaze2_wide.png")
# 2. кран под потолком
cam(-3.6, 2.95, 4.6, 2.4, 0, 0.4); shot("gaze2_crane.png")
# 3. от прилавка в зал
cam(2.0, 1.62, 5.0, 4.6, 0.8, 0.9); shot("gaze2_front.png")
# 4. тревога
ev("""(()=>{const a=window.__app,g=window.__game;
  g.storeSuspicion=72; a.scenes.store.stealth.setAlert(.72); a.ui.setStealth(true,72,true); return 1;})()""")
cam(-3.6, 2.95, 4.6, 2.4, 0, 0.4); shot("gaze2_crane_danger.png")
cam(-5.2, 1.75, 4.9, 3.9, 0.05, 1.1); shot("gaze2_wide_danger.png")
ev("""(()=>{const a=window.__app,g=window.__game;
  g.storeSuspicion=0; a.scenes.store.stealth.setAlert(0); a.ui.setStealth(false,0,false); return 1;})()""")
# 5. ценники
cam(2.6, 1.65, -1.2, 5.5, 0.9, -2.4); shot("tags_beri_tiho2.png")
# 6. плакат «ХЛЕБ / НЕ ШУМИ»
cam(1.4, 1.8, 3.2, 5.6, 1.9, 2.0); shot("poster_bread_new.png")
print("done")