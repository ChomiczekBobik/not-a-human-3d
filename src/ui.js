// ui.js — DOM-обвязка: титры, подсказки, диалоги, счётчики, затемнение переходов.

const $ = (id) => document.getElementById(id);

function text(el, value) {
  const next = String(value);
  if (el && el.textContent !== next) el.textContent = next;
}

function hidden(el, value) {
  if (el && el.classList.contains('hidden') !== value) el.classList.toggle('hidden', value);
}

export class UI {
  constructor() {
    this.el = {
      crosshair: $('crosshair'),
      hud: $('hud'), tasksDay: $('tasks-day'), tasksClock: $('tasks-clock'),
      meter: $('meter'), hearts: $('hearts'), supplies: $('supplies'), meds: $('meds'), tea: $('tea'),
      cart: $('cart'), cartCount: $('cart-count'), cartStatus: $('cart-status'),
      stealth: $('stealth'), stealthEye: $('stealth-eye'), stealthState: $('stealth-state'),
      stealthBar: $('stealth-bar'), stealthFill: $('stealth-fill'),
      warmth: $('warmth'), warmthFill: $('warmth-fill'), tasksBtn: $('tasks-btn'),
      air: $('air'), airFill: $('air-fill'), airValue: $('air-value'), inventoryBtn: $('inventory-btn'),
      prompt: $('prompt'), subtitle: $('subtitle'),
      dialogue: $('dialogue'), npcName: $('npc-name'), npcLine: $('npc-line'),
      choices: $('choices'), bigtext: $('bigtext'),
      title: $('title'), startBtn: $('start-btn'),
      gameover: $('gameover'), goTitle: $('go-title'), goText: $('go-text'), goBtn: $('go-btn'),
      flash: $('flash'), fade: $('fade')
    };
    this.el.fade.style.opacity = '1';
  }

  showHUD(n, time, hearts) {
    this.el.hud.classList.remove('hidden');
    this.el.meter.classList.remove('hidden');
    this.el.tasksBtn.classList.remove('hidden');
    this.el.inventoryBtn.classList.remove('hidden');
    this.setDay(n, time);
    this.setHearts(hearts);
    this.el.crosshair.classList.remove('hidden');
  }

  setDay(n, time, label) {
    text(this.el.tasksDay, label || `ДЕНЬ ${n}`);
    text(this.el.tasksClock, time);
  }

  setHearts(v) {
    text(this.el.hearts, '♥'.repeat(Math.max(0, v)) + '♡'.repeat(Math.max(0, 3 - v)));
  }

  setSupplies(v) { text(this.el.supplies, v); }
  setMeds(v) {
    text(this.el.meds, v);
    text(this.el.tea, window.__game ? window.__game.tea : 0);
  }

  setCart(count, pending, visible, limit = 3) {
    const key = `${count}|${pending}|${visible}|${limit}`;
    if (this._cartKey === key) return;
    this._cartKey = key;
    this.el.cart.classList.toggle('hidden', !visible);
    this.el.cart.classList.toggle('empty', count === 0);
    text(this.el.cartCount, `${count}/${limit}`);
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
  }

  showWarmth(on) { hidden(this.el.warmth, !on); }
  setWarmth(v) {
    const p = Math.max(0, Math.min(100, v));
    const q = Math.round(p);
    if (q === this._warmQ) return; // школа целыми процентами: лишний reflow не нужен
    this._warmQ = q;
    this.el.warmthFill.style.width = q + '%';
    if (q < 30 !== this._warmCold) {
      this._warmCold = q < 30;
      this.el.warmthFill.style.background = this._warmCold
        ? 'linear-gradient(90deg, #8c3d3d, #d8a0a0)'
        : 'linear-gradient(90deg, #3d5a8c, #a8c8f0)';
    }
  }

  setAir(v, visible) {
    const q = Math.max(0, Math.min(100, Math.round(v)));
    const key = `${q}|${!!visible}`;
    if (this._airKey === key) return;
    this._airKey = key;
    this.el.air.classList.toggle('hidden', !visible);
    this.el.airFill.style.width = `${q}%`;
    this.el.airValue.textContent = `${q}%`;
    this.el.air.classList.toggle('low', q < 30);
  }

  prompt(text) {
    // один и тот же промпт приходит много раз подряд — не дёргаем DOM
    const key = text || '';
    if (this._lastPrompt === key) return;
    this._lastPrompt = key;
    if (text) {
      // kbd сохраняет исходный textContent '[E] ...' для игровых проверок.
      this.el.prompt.innerHTML = text.replace(/\[([EQ])\]/g, '<kbd class="prompt-key prompt-key-$1">[$1]</kbd>');
      this.el.prompt.classList.remove('hidden');
    } else {
      this.el.prompt.classList.add('hidden');
    }
  }

  subtitle(text, ms = 0) {
    if (!text) { this.el.subtitle.classList.add('hidden'); return; }
    this.el.subtitle.textContent = text;
    this.el.subtitle.classList.remove('hidden');
    if (this._subT) clearTimeout(this._subT);
    if (ms > 0) {
      this._subT = setTimeout(() => this.el.subtitle.classList.add('hidden'), ms);
    }
  }

  bigtext(text, ms = 2600) {
    const e = this.el.bigtext;
    if (!text) { e.classList.add('hidden'); return; }
    e.textContent = text;
    e.classList.remove('hidden');
    if (this._bigT) clearTimeout(this._bigT);
    this._bigT = setTimeout(() => e.classList.add('hidden'), ms);
  }

  dialogue(name, line, choices = []) {
    const d = this.el.dialogue;
    if (!name && !line) { d.classList.add('hidden'); return; }
    d.classList.remove('hidden');
    this.el.npcName.textContent = name || '';
    this.el.npcLine.textContent = line || '';
    this.el.choices.innerHTML = '';
    for (const c of choices) {
      const b = document.createElement('button');
      b.textContent = c.label;
      if (c.cls) b.className = c.cls;
      b.onclick = () => { if (this.onClick) this.onClick(); if (c.cb) c.cb(); };
      this.el.choices.appendChild(b);
    }
  }

  say(name, line, choices = []) { this.dialogue(name, line, choices); }

  fade(on) { this.el.fade.style.opacity = on ? '1' : '0'; }

  showTitle(cb) {
    this.el.title.classList.remove('hidden');
    this.el.gameover.classList.add('hidden');
    const main = $('title-main'), settings = $('settings-panel'), button = $('settings-btn');
    if (main) main.classList.remove('hidden');
    if (settings) settings.classList.add('hidden');
    if (button) button.setAttribute('aria-expanded', 'false');
    this.el.startBtn.onclick = cb;
  }

  hideTitle() { this.el.title.classList.add('hidden'); }

  showGameOver(title, text, cb) {
    this.dialogue(null, null, []);
    this.prompt(null);
    this.subtitle(null);
    this.el.gameover.classList.remove('hidden');
    this.el.goTitle.textContent = title;
    this.el.goText.textContent = text;
    this.el.goBtn.onclick = cb;
  }

  hideGameOver() { this.el.gameover.classList.add('hidden'); }

  flashRed(ms = 400) {
    this.el.flash.style.opacity = '0.85';
    setTimeout(() => { this.el.flash.style.opacity = '0'; }, ms);
  }
}
