# -*- coding: utf-8 -*-
"""Свежие снимки стелса в «Бедронке», нового входа в подвал и панели F2."""
import base64, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, r'C:\Users\user\not-a-human-3d\tools')
from cdp import DEBUG, WS, http_json

OUT = r'C:\Users\user\not-a-human-3d\shots'
os.makedirs(OUT, exist_ok=True)
url = 'http://127.0.0.1:8080/?q=0&fps=0'
target = http_json('PUT', DEBUG + '/json/new?' + urllib.parse.quote(url, safe=''))
ws = WS(target['webSocketDebuggerUrl'])
ws.call('Runtime.enable')
ws.call('Page.enable')
ws.call('Network.enable')
ws.call('Network.setCacheDisabled', {'cacheDisabled': True})
ws.call('Emulation.setDeviceMetricsOverride',
        {'width': 1600, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})


def ev(expr):
    return ws.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})


t0 = time.time()
while time.time() - t0 < 50:
    r = ev("!!(window.__game && window.__app && window.__app.renderer)")
    if r.get('result', {}).get('result', {}).get('value'):
        break
    time.sleep(.3)
ev("document.getElementById('start-btn').click()")
time.sleep(2.6)
ev("""(()=>{const t=document.getElementById('title');if(t){t.classList.add('hidden');t.style.display='none';}
  window.__game.ui.subtitle(null);window.__game.ui.bigtext(null);return true;})()""")


def shot(name):
    time.sleep(.55)
    img = ws.call('Page.captureScreenshot', {'format': 'png'})
    path = os.path.join(OUT, name)
    open(path, 'wb').write(base64.b64decode(img['result']['data']))
    print(path)


def scene_setup(mode, x, z, look=None, yaw=None):
    ev(f"""(()=>{{const a=window.__app,g=window.__game,c=a.camera;
      g.clearTimers();g.ui.dialogue(null,null,[]);g.ui.prompt(null);g.ui.fade(false);a.transitioning=false;
      a.setMode('{mode}');a.post.setScene(a.scenes['{mode}'].scene);
      c.position.set({x},1.62,{z});""" +
       (f"c.rotation.set(0,{yaw},0);" if yaw is not None else
        f"c.lookAt({look[0]},{look[1]},{look[2]});") +
       """g.updateCart();g.hud();return true;})()""")


# --- Бедронка: сектор обзора и укрытия
ev("""(()=>{const g=window.__game;g.phase='store';g.day=1;g.storeTripDone=false;g.cart=[];
  g.storePurchased.clear();g.storeSuspicion=0;g.storeCaught=0;g.storeWarned=0;
  g.syncStoreItems();g.updateCart();return true;})()""")
scene_setup('store', 0.2, 5.1, look=(3.9, 0.02, 1.15))
shot('stealth_gaze_from_door.png')
scene_setup('store', -3.4, 3.4, look=(3.0, 0.02, 1.0))
shot('stealth_gaze_side.png')
scene_setup('store', -1.35, 4.15, look=(-3.95, 0.45, 3.15))
shot('stealth_cover_pallets.png')
scene_setup('store', 2.4, 3.3, look=(4.55, 1.05, 0.85))
shot('stealth_lyudmila_no_outline.png')

# --- HUD внимания: видит и несёт добычу
ev("""(()=>{const g=window.__game,a=window.__app,c=a.camera,gaze=a.scenes.store.stealth;
  g.phase='store';g.cart=['butter','tea'];g.syncStoreItems();g.updateCart();
  const y=gaze.yaw;c.position.set(gaze.eye.x+Math.sin(y)*3.3,1.62,gaze.eye.z+Math.cos(y)*3.3);
  c.lookAt(gaze.eye.x-0.4,0.55,gaze.eye.z-0.6);
  g.storeSuspicion=63;gaze.setAlert(.63);a.ui.setStealth(true,63,true);return true;})()""")
shot('stealth_hud_seen.png')

# --- Поимка
ev("""(()=>{const g=window.__game;g.cart=['tushonka','sguschenka'];g.syncStoreItems();g.updateCart();g.caughtStealing();return true;})()""")
shot('stealth_caught.png')

# --- Дом: вход в подвал
ev("""(()=>{const g=window.__game;g.phase='day';g.cart=[];g.storeTripDone=true;g.ui.dialogue(null,null,[]);return true;})()""")
scene_setup('home', -0.3, 3.6, look=(-1.75, 1.25, 2.35))
shot('home_basement_door.png')
scene_setup('home', 1.15, 4.35, look=(-1.7, 1.0, 2.2))
shot('home_basement_wide.png')

# --- Debug-панель
ev("""(()=>{const a=window.__app,g=window.__game;g.clearTimers();a.transitioning=false;
  a.setMode('store');a.post.setScene(a.scenes.store.scene);
  a.camera.position.set(0.4,1.62,4.9);a.camera.lookAt(4.4,0.4,0.9);
  g.phase='store';g.cart=['butter'];g.storeSuspicion=42;g.updateCart();
  document.dispatchEvent(new KeyboardEvent('keydown',{code:'F2',key:'F2',bubbles:true}));
  return true;})()""")
time.sleep(.45)
shot('debug_panel.png')
ev("document.dispatchEvent(new KeyboardEvent('keydown',{code:'F2',key:'F2',bubbles:true}))")

try:
    urllib.request.urlopen(urllib.request.Request(DEBUG + '/json/close/' + target['id'], method='PUT'), timeout=10)
except Exception:
    pass
print('done')