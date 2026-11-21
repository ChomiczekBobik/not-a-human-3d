# -*- coding: utf-8 -*-
import io
p = r'C:\Users\user\not-a-human-3d\src\debug.js'
s = io.open(p, encoding='utf-8').read()
old = "    const sc = app.scenes[app.mode];\n    const loc = sc && (sc.title || app.mode);\n    statusEl.textContent = `день ${game.day} · ${game.phase} · ${app.mode}${loc && loc !== app.mode ? ' · ' + loc : ''}` +"
new = "    const sc = app.scenes[app.mode];\n    const loc = sc && sc.title;\n    statusEl.textContent = `день ${game.day} · ${game.phase} · ${app.mode}${loc ? ' · ' + loc : ''}` +"
if old not in s:
    print('MISS')
    raise SystemExit(1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new, 1))
print('ok debug status')