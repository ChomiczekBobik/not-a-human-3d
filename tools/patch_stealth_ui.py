# -*- coding: utf-8 -*-
"""UI стелса: разметка внутри панели «карманы», метод setStealth, стили."""
import io, sys

def patch(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    before = s
    for old, new, label in pairs:
        if old not in s:
            print('MISS:', path, label)
            sys.exit(1)
        s = s.replace(old, new, 1)
        print('ok:', label)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('written:', path, len(s), 'bytes (was', len(before), ')')

# ---------- index.html ----------
patch(r'C:\Users\user\not-a-human-3d\index.html', [
    (
        '<link rel="stylesheet" href="css/style.css?v=7" />',
        '<link rel="stylesheet" href="css/style.css?v=9" />',
        'css version'
    ),
    (
        """  <div id="cart" class="hidden" aria-live="polite">
    <div id="cart-heading"><span>ВЫДАЧА НА ДЕНЬ</span><b id="cart-count">0/3</b></div>
    <div id="cart-status">МИНИМУМ: 1 ПРЕДМЕТ</div>
    <div id="cart-help">
      <span class="desktop-only"><kbd>E</kbd> — взять · <kbd>Q</kbd> — вернуть</span>
      <span class="touch-only">ДЕЙСТВИЕ — взять · ВЕРНУТЬ — положить обратно</span>
    </div>
  </div>""",
        """  <div id="cart" class="hidden" aria-live="polite">
    <div id="cart-heading"><span>КАРМАНЫ</span><b id="cart-count">0/3</b></div>
    <div id="cart-status">ПУСТО</div>
    <div id="stealth">
      <div id="stealth-head"><span><i id="stealth-eye" aria-hidden="true">◉</i> ВНИМАНИЕ</span><b id="stealth-state">НЕ СМОТРИТ</b></div>
      <div id="stealth-bar" role="progressbar" aria-label="Внимание Людмилы" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="stealth-fill"></div></div>
      <div id="stealth-note">Держись вне жёлтого сектора · <kbd>C</kbd> — присесть тише</div>
    </div>
    <div id="cart-help">
      <span class="desktop-only"><kbd>E</kbd> — взять · <kbd>Q</kbd> — вернуть · <kbd>C</kbd> — присесть</span>
      <span class="touch-only">ДЕЙСТВИЕ — взять · ВЕРНУТЬ — обратно · ПРИСЕСТЬ — тише</span>
    </div>
  </div>""",
        'cart markup'
    )
])

# ---------- ui.js ----------
patch(r'C:\Users\user\not-a-human-3d\src\ui.js', [
    (
        "      cart: $('cart'), cartCount: $('cart-count'), cartStatus: $('cart-status'),",
        "      cart: $('cart'), cartCount: $('cart-count'), cartStatus: $('cart-status'),\n      stealth: $('stealth'), stealthEye: $('stealth-eye'), stealthState: $('stealth-state'),\n      stealthBar: $('stealth-bar'), stealthFill: $('stealth-fill'),",
        'ui refs'
    ),
    (
        """    text(this.el.cartCount, `${count}/${limit}`);
    text(this.el.cartStatus, pending > 0 ? `К ОФОРМЛЕНИЮ: ${pending}` : count > 0 ? 'ОФОРМЛЕНО' : 'МИНИМУМ: 1 ПРЕДМЕТ');
  }""",
        """    text(this.el.cartCount, `${count}/${limit}`);
    text(this.el.cartStatus, count >= limit ? 'ПОРА УХОДИТЬ' : count > 0 ? 'ДОБЫЧА' : 'ПУСТО');
  }

  // Шкала внимания Людмилы. Держим отдельный key, чтобы не дёргать DOM каждый кадр.
  setStealth(seen, value, carrying) {
    const q = Math.max(0, Math.min(100, Math.round(value || 0)));
    const key = `${seen ? 1 : 0}|${q}|${carrying ? 1 : 0}`;
    if (this._stealthKey === key) return;
    this._stealthKey = key;
    if (!this.el.stealth) return;
    this.el.stealth.classList.toggle('seen', !!seen);
    this.el.stealth.classList.toggle('danger', q >= 60);
    this.el.stealth.classList.toggle('carrying', !!carrying);
    this.el.stealthFill.style.width = `${q}%`;
    this.el.stealthBar.setAttribute('aria-valuenow', String(q));
    this.el.stealthEye.textContent = seen ? '◉' : '◎';
    this.el.stealthState.textContent = seen
      ? (q >= 60 ? 'СЕЙЧАС ЗАМЕТИТ' : 'ВИДИТ ТЕБЯ')
      : (q > 0 ? 'ПРИСМАТРИВАЕТСЯ' : 'НЕ СМОТРИТ');
  }""",
        'setStealth'
    )
])

# ---------- css ----------
patch(r'C:\Users\user\not-a-human-3d\css\style.css', [
    (
        "#cart.empty #cart-status { color: #858b80; }",
        """#cart.empty #cart-status { color: #858b80; }

/* Стелс-блок внутри «карманов»: глаз, шкала внимания, подсказка. */
#stealth {
  margin-top: 10px; padding-top: 9px;
  border-top: 1px dashed rgba(168, 148, 96, .28);
}
#stealth-head {
  display: flex; justify-content: space-between; gap: 10px; align-items: baseline;
  color: #9aa48f; font-size: 9px; letter-spacing: 1.6px;
}
#stealth-head i { font-style: normal; color: #8fb0a2; margin-right: 4px; }
#stealth-head b { color: #9aa48f; font-size: 9px; font-weight: normal; letter-spacing: 1px; }
#stealth-bar {
  position: relative; overflow: hidden; height: 9px; margin-top: 6px;
  background: #0a1012; border: 1px solid rgba(127, 151, 145, .28);
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, .75);
}
#stealth-bar::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(90deg, transparent 0 calc(20% - 1px), rgba(4, 10, 11, .72) calc(20% - 1px) 20%);
}
#stealth-fill {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, #4a6f62, #a8cbb6);
  box-shadow: 0 0 8px rgba(118, 173, 145, .28);
  transition: width .16s linear, background .2s linear;
}
#stealth-note { margin-top: 6px; color: #74806f; font-size: 8px; letter-spacing: .3px; line-height: 1.45; }
#stealth-note kbd {
  display: inline-block; min-width: 13px; padding: 1px 3px; text-align: center;
  color: #c8b97f; background: #141a17; border: 1px solid #61553a; border-radius: 2px; font-size: .95em;
}
#stealth.seen #stealth-fill { background: linear-gradient(90deg, #8a5a33, #e0b070); }
#stealth.seen #stealth-head b { color: #e0b070; }
#stealth.seen #stealth-head i { color: #e0b070; }
#stealth.danger #stealth-fill { background: linear-gradient(90deg, #8c2f24, #e0705a); box-shadow: 0 0 10px rgba(210, 80, 60, .45); }
#stealth.danger #stealth-head b { color: #e5836f; }
#stealth.danger { animation: stealth-pulse 1.1s ease-in-out infinite; }
@keyframes stealth-pulse { 50% { border-top-color: rgba(224, 112, 90, .55); } }
#stealth.carrying #stealth-head span { color: #c4b58d; }""",
        'stealth css'
    )
])
print('ui/html/css done')