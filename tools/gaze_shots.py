# -*- coding: utf-8 -*-
"""Прицельные снимки сектора взгляда: сверху, сбоку и в тревоге."""
import base64, os, sys, time
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
    if "exceptionDetails" in r.get("result", {}):
        print("EXC", r["result"]["exceptionDetails"].get("exception", {}).get("description", "")[:400])
    return r.get("result", {}).get("result", {}).get("value")

started = time.time(); ok = False
while time.time() - started < 60:
    if ev("!!(window.__game && window.__app && window.__app.scenes && Object.keys(window.__app.scenes).length === 9)"):
        ok = True; break
    time.sleep(.4)
print("ready", ok)
ev("document.getElementById('start-btn').click(); true")
time.sleep(1.2)
ev("""(()=>{const a=window.__app,g=window.__game;
  document.getElementById('title').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  a.transitioning=false; g.phase='store'; g.day=1; g.cart.length=0;
  a.goto('store',{seamless:true}); return a.mode;})()""")
time.sleep(1.0)

def shot(name):
    time.sleep(.5)
    img = ws.call("Page.captureScreenshot", {"format": "png"})
    open(os.path.join(OUT, name), "wb").write(base64.b64decode(img["result"]["data"]))
    print(os.path.join(OUT, name))

def cam(x, y, z, lx, ly, lz):
    ev(f"""(()=>{{const a=window.__app;const c=a.camera;c.position.set({x},{y},{z});
      c.lookAt({lx},{ly},{lz});if(a.controls&&a.controls.target){{a.controls.target.set({lx},{ly},{lz});a.controls.update&&a.controls.update();}}
      return 1;}})()""")

# сверху: видно всю зону обзора
cam(4.0, 7.6, 4.4, 4.5, 0, 3.4); shot("gaze_top.png")
# от кассы в зал
cam(2.2, 1.7, 4.9, 5.4, 0.1, 2.2); shot("gaze_front.png")
# тревога: зона краснеет
ev("(()=>{const a=window.__app,g=window.__game;g.storeSuspicion=72;a.scenes.store.stealth.setAlert(.72);a.ui.setStealth(true,72,true);return 1;})()")
cam(4.0, 7.6, 4.4, 4.5, 0, 3.4); shot("gaze_top_danger.png")
ev("(()=>{const a=window.__app,g=window.__game;g.storeSuspicion=0;a.scenes.store.stealth.setAlert(0);a.ui.setStealth(false,0,false);return 1;})()")
# ценники «бери тихо»
cam(2.6, 1.65, -1.2, 5.5, 0.9, -2.4); shot("tags_beri_tiho.png")
print("done")