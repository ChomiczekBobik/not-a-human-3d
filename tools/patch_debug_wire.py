# -*- coding: utf-8 -*-
"""Подключение debug.js, app.crouched, подсказка F2 в настройках, стили панели."""
import io, sys

def patch(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new, label in pairs:
        if old not in s:
            print('MISS:', path, label); sys.exit(1)
        s = s.replace(old, new, 1)
        print('ok:', label)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('written:', path, len(s))

patch(r'C:\Users\user\not-a-human-3d\src\main.js', [
    ("import { TouchControls, detectTouchDevice } from './touch_controls.js';",
     "import { TouchControls, detectTouchDevice } from './touch_controls.js';\nimport { createDebug } from './debug.js';",
     'import debug'),
    ("const game = new Game(app);\nwindow.__game = game;\nwindow.__app = app;",
     "const game = new Game(app);\nwindow.__game = game;\nwindow.__app = app;\nconst debugPanel = createDebug(app, game);\napp.debug = debugPanel;",
     'create debug'),
    ("  game.update(dt);",
     "  app.crouched = crouched;\n  game.update(dt);",
     'expose crouch'),
    ("// #autostart — сразу начать игру\nif (location.hash === '#autostart') {",
     "// #debug — сразу начать игру и открыть панель разработчика\nif (location.hash === '#debug') {\n  setTimeout(() => { document.getElementById('start-btn').click(); }, 300);\n}\n// #autostart — сразу начать игру\nif (location.hash === '#autostart') {",
     'debug hash')
])

patch(r'C:\Users\user\not-a-human-3d\index.html', [
    ("""      <button id="settings-back" class="title-secondary" type="button">НАЗАД</button>""",
     """      <small class="debug-hint">F2 в игре — панель разработчика: переходы по этапам, ночи, шахта и план.</small>
      <button id="settings-back" class="title-secondary" type="button">НАЗАД</button>""",
     'settings F2 hint')
])

patch(r'C:\Users\user\not-a-human-3d\css\style.css', [
    ("#chase-vignette {",
     """/* Панель разработчика (F2): компактная, поверх HUD, не мешает сцене. */
#debug-panel {
  position: fixed; top: 50%; right: 14px; transform: translateY(-50%);
  z-index: 70; width: 318px; max-height: 86vh; overflow-y: auto;
  padding: 12px 13px 10px; color: #cfd6c8;
  background: linear-gradient(150deg, rgba(16, 22, 21, .97), rgba(7, 11, 12, .97));
  border: 1px solid rgba(168, 148, 96, .5);
  box-shadow: 0 10px 40px rgba(0, 0, 0, .55), inset 0 0 0 3px rgba(0, 0, 0, .3);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 11px; line-height: 1.45;
}
#debug-panel.hidden { display: none; }
#debug-head { display: flex; justify-content: space-between; align-items: center; color: #d8c58c; letter-spacing: 2px; font-size: 10px; }
#debug-close { width: 26px; height: 24px; border: 1px solid rgba(180, 154, 92, .45); background: #121815; color: #d8c58c; cursor: pointer; font-size: 16px; line-height: 1; }
#debug-status { margin: 7px 0 10px; color: #7f9086; font-size: 9px; letter-spacing: .4px; }
.debug-group { margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(168, 148, 96, .25); }
.debug-group h3 { margin: 0 0 6px; color: #a89a76; font-size: 9px; font-weight: normal; letter-spacing: 2px; }
.debug-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.debug-grid.wide { grid-template-columns: repeat(2, 1fr); margin-top: 4px; }
.debug-grid button {
  padding: 5px 4px; color: #cbd3c6; background: #151d1a; border: 1px solid #3a453c;
  font: inherit; font-size: 10px; cursor: pointer; text-align: center;
}
.debug-grid button:hover { border-color: #a08a52; color: #f0e2b4; background: #1d2620; }
.debug-grid button:active { transform: translateY(1px); }
#debug-plan { margin: 0; padding-left: 16px; color: #9aa79b; font-size: 9.5px; line-height: 1.5; }
#debug-plan li { margin-bottom: 4px; }
#debug-plan b { color: #d0bd88; font-weight: normal; }
#debug-foot { margin-top: 10px; color: #66736b; font-size: 8px; letter-spacing: .4px; }
.debug-hint { display: block; margin-top: 10px; color: #7d8577; font-size: 10px; line-height: 1.4; }
@media (max-width: 680px) {
  #debug-panel { right: 6px; width: min(318px, calc(100vw - 12px)); max-height: 90vh; }
}

#chase-vignette {""",
     'debug css')
])
print('done')