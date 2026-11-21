# -*- coding: utf-8 -*-
import io, sys
P = r'C:\Users\user\not-a-human-3d\src\audio.js'
s = io.open(P, encoding='utf-8').read()
old = """  // Эхо-плиты нулевого горизонта: четыре коротких тона, чтобы порядок можно было
"""
new = """  // Тревожный блип стелса: два коротких нисходящих тона.
  alert(vol = 0.5) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator();
      o.type = 'triangle';
      const at = t0 + i * 0.11;
      o.frequency.setValueAtTime(880 - i * 180, at);
      o.frequency.exponentialRampToValueAtTime(560 - i * 120, at + 0.09);
      const g = c.createGain();
      this._env(g, at, 0.004, 0.1 * vol, 0.1);
      o.connect(g); g.connect(this.master);
      o.start(at); o.stop(at + 0.12);
    }
  }

  // Эхо-плиты нулевого горизонта: четыре коротких тона, чтобы порядок можно было
"""
if old not in s:
    print('MISS alert anchor'); sys.exit(1)
s = s.replace(old, new, 1)
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('audio.js patched, bytes:', len(s))