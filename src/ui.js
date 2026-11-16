// ui.js — DOM-обвязка: титры, подсказки, диалоги, счётчики, затемнение переходов.

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      crosshair: $('crosshair'),
      hud: $('hud'), night: $('night-label'), clock: $('clock-label'),
      meter: $('meter'), hearts: $('hearts'), supplies: $('supplies'), money: $('money'), meds: $('meds'), tea: $('tea'),
      warmth: $('warmth'), warmthFill: $('warmth-fill'), tasksBtn: $('tasks-btn'),
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
    this.setDay(n, time);
    this.setHearts(hearts);
    this.el.crosshair.classList.remove('hidden');
  }

  setDay(n, time, label) {
    this.el.night.textContent = label || `ДЕНЬ ${n}`;
    this.el.clock.textContent = time;
  }

  setHearts(v) {
    this.el.hearts.textContent = '♥'.repeat(Math.max(0, v)) + '♡'.repeat(Math.max(0, 3 - v));
  }

  setSupplies(v) { this.el.supplies.textContent = String(v); }
  setMoney(v) { this.el.money.textContent = String(Math.round(v * 100) / 100); }
  setMeds(v) { this.el.meds.textContent = String(v); this.el.tea.textContent = String(window.__game ? window.__game.tea : 0); }

  showWarmth(on) { this.el.warmth.classList.toggle('hidden', !on); }
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

  prompt(text) {
    // один и тот же промпт приходит много раз подряд — не дёргаем DOM
    const key = text || '';
    if (this._lastPrompt === key) return;
    this._lastPrompt = key;
    if (text) {
      this.el.prompt.innerHTML = text;
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
