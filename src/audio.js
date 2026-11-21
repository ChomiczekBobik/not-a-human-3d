// audio.js — локальные CC0 OGG в assets/sfx + WebAudio-синтез как фолбэк.
// Вызывать init() после жеста пользователя (клик по старту).

export class Sfx {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this.heartbeatTimer = null;
    this.samples = new Map(); // реальные записи (CC0): шаги, двери, ветер, ткань
    this._nightBuf = null;    // декодированный буфер ночного эмбиента (текущий)
    this._nightIdx = 0;       // какая часть (1..4)
    this._nightWanted = 0;    // 0 = ничего не играет, иначе 1..4
    this._nightSrc = null;    // {src,g} текущего источника
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    // Клик по «Начать» — жест, но не во всех браузерах контекст стартует
    // синхронно (и синтетический клик в тестах его не разблокирует).
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this._noiseBuf = this._makeNoise(1.5);
    // Постоянного синтезированного фона нет: ночной эмбиент и эффекты среды
    // запускаются только своими игровыми состояниями и имеют явный stop.
    this.loadSamples();
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (!this.master || !this.ctx) return this.volume;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.volume, now, 0.025);
    return this.volume;
  }

  // ---------- реальные сэмплы (assets/sfx, лицензия CC0) ----------
  loadSamples() {
    if (this._samplesRequested || !this.ctx) return;
    this._samplesRequested = true;
    const names = [
      'step_wood_0', 'step_wood_1', 'step_wood_2', 'step_wood_3', 'step_wood_4',
      'step_snow_0', 'step_snow_1', 'step_snow_2', 'step_snow_3', 'step_snow_4',
      'knock_0', 'knock_1', 'knock_2',
      'door_open', 'door_close', 'creak', 'crouch',
      'coins', 'shop_bell', 'click', 'ambient_1', 'ambient_2'
    ];
    for (const n of names) {
      fetch('assets/sfx/' + n + '.ogg')
        .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audio) => { this.samples.set(n, audio); })
        .catch(() => {}); // сэмпл не загрузился — остаётся синтез, игра работает
    }
  }

  _pick(prefix, n) { return prefix + '_' + Math.floor(Math.random() * n); }

  _sample(name, { vol = 1, rate = 1, loop = false, at = 0 } = {}) {
    const buf = this.samples.get(name);
    if (!buf || !this.ctx) return null;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = c.createGain();
    g.gain.value = vol;
    src.loop = loop;
    src.connect(g); g.connect(this.master);
    src.start(c.currentTime + at);
    return { src, g };
  }

  // ---------- двери / мир ----------
  doorOpen(vol = 0.9) {
    if (this._sample('door_open', { vol })) return;
    this.creak(1.2);
  }

  doorClose(vol = 0.9) {
    if (this._sample('door_close', { vol })) return;
    this.knock(vol * 0.6, 1);
  }

  shopBell(vol = 0.7) {
    if (this._sample('shop_bell', { vol, rate: 1.35 })) return;
    this.bell();
  }

  crouch(vol = 0.65) {
    if (this._sample('crouch', { vol })) return;
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = c.createGain();
    this._env(g, t0, 0.03, 0.12 * vol, 0.18);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(t0); n.stop(t0 + 0.3);
  }

  uiClick(vol = 0.5) {
    if (this._sample('click', { vol, rate: 1.1 })) return;
    this.beep();
  }

  // Комнатный тон (квартира/магазин): тихий воздух помещения, отдельно от ветра улицы.
  roomTone(on) {
    if (!on) {
      if (this._roomTone) {
        try { this._roomTone.g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.6); } catch (e) {}
        const r = this._roomTone;
        setTimeout(() => { try { r.src.stop(); } catch (e) {} }, 900);
        this._roomTone = null;
      }
      return;
    }
    if (this._roomTone) return;
    const s = this._sample('ambient_2', { vol: 0.07, loop: true, rate: 1 });
    if (s) { s.g.gain.value = 0.07; this._roomTone = s; }
  }

  // ---------- ночной эмбиент (assets/sfx/night_1..4.ogg, бесшовные петли) ----------
  // night_1 = 0:00-5:00 трека, night_2 = 5-10, night_3 = 10-15, night_4 = 15-20:49.
  // Петля запечена кроссфейдом, поэтому BufferSource(loop=true) играет без щелчков.
  // Ночи 5-7 идут по кругу с первой части. Буфер грузится лениво, держится один.
  nightAmbience(day) {
    if (!this.ctx) return;
    const idx = ((Math.max(1, day | 0) - 1) % 4) + 1;
    this.nightAmbienceStop();
    this._nightWanted = idx;
    const play = (buf) => {
      if (this._nightWanted !== idx || !this.ctx) return;
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true; // запечённая петля — стык не слышен
      const g = c.createGain();
      const t = c.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 4);
      src.connect(g); g.connect(this.master);
      src.start();
      this._nightSrc = { src, g };
    };
    if (this._nightBuf && this._nightIdx === idx) { play(this._nightBuf); return; }
    fetch('assets/sfx/night_' + idx + '.ogg')
      .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
      .then((ab) => this.ctx.decodeAudioData(ab))
      .then((buf) => {
        if (this._nightBuf === null || this._nightIdx !== idx) {
          this._nightPrev = null; // старый большой буфер отпускаем на GC
        }
        this._nightBuf = buf;
        this._nightIdx = idx;
        play(buf);
      })
      .catch(() => {});
  }

  nightAmbienceStop() {
    this._nightWanted = 0;
    const s = this._nightSrc;
    if (!s) return;
    this._nightSrc = null;
    try {
      const t = this.ctx.currentTime;
      s.g.gain.cancelScheduledValues(t);
      s.g.gain.setTargetAtTime(0.0001, t, 0.5);
      s.src.stop(t + 2.8);
    } catch (e) {}
  }



  _makeNoise(dur) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _env(node, t0, a, peak, dec) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }

  // стук по дереву: бум + шумовой щелчок, count ударов с паузой
  knock(vol = 1, count = 3) {
    if (!this.ctx) return;
    if (this.samples.has('knock_0')) {
      for (let i = 0; i < count; i++) {
        this._sample(this._pick('knock', 3), { vol: 1.25 * vol, at: i * 0.42, rate: 0.9 });
      }
      return;
    }
    const c = this.ctx;
    for (let i = 0; i < count; i++) {
      const t0 = c.currentTime + i * 0.42;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(95, t0);
      o.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
      const og = c.createGain();
      this._env(og, t0, 0.004, 0.5 * vol, 0.16);
      o.connect(og); og.connect(this.master);
      o.start(t0); o.stop(t0 + 0.3);

      const n = c.createBufferSource();
      n.buffer = this._noiseBuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 1.4;
      const ng = c.createGain();
      this._env(ng, t0, 0.002, 0.28 * vol, 0.05);
      n.connect(bp); bp.connect(ng); ng.connect(this.master);
      n.start(t0); n.stop(t0 + 0.1);
    }
  }

  heartbeats(duration = 4, rate = 1.1) {
    if (!this.ctx) return;
    const c = this.ctx;
    this.stopHeartbeat();
    const beat = () => {
      const t0 = c.currentTime;
      for (const [dt, v] of [[0, 0.32], [0.17, 0.2]]) {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(70, t0 + dt);
        o.frequency.exponentialRampToValueAtTime(40, t0 + dt + 0.12);
        const g = c.createGain();
        this._env(g, t0 + dt, 0.005, v, 0.14);
        o.connect(g); g.connect(this.master);
        o.start(t0 + dt); o.stop(t0 + dt + 0.3);
      }
    };
    beat();
    this.heartbeatTimer = setInterval(beat, 1100 / (rate || 1));
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  creak(dur = 1.1) {
    if (!this.ctx) return;
    // Реальная запись скрипа; синтез ниже — страховка при отсутствии файла.
    if (this._sample('creak', { vol: 0.8, rate: 0.9 })) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 9;
    bp.frequency.setValueAtTime(320, t0);
    bp.frequency.exponentialRampToValueAtTime(190, t0 + dur);
    const g = c.createGain();
    this._env(g, t0, 0.15, 0.12, dur);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    n.start(t0); n.stop(t0 + dur + 0.3);
  }

  whisper() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(2400, t0);
    bp.frequency.linearRampToValueAtTime(1400, t0 + 1.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.06, t0 + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 1.7);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    n.start(t0); n.stop(t0 + 1.8);
  }

  // скример: рев
  sting() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    for (const f of [160, 220, 311]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.5, t0);
      o.frequency.exponentialRampToValueAtTime(f * 2.2, t0 + 0.55);
      const g = c.createGain();
      this._env(g, t0, 0.01, 0.22, 1.1);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 1.4);
    }
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    const g = c.createGain();
    this._env(g, t0, 0.01, 0.3, 1.0);
    n.connect(g); g.connect(this.master);
    n.start(t0); n.stop(t0 + 1.3);
  }

  chime() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    for (const [i, f] of [660, 495, 330].entries()) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = c.createGain();
      this._env(g, t0 + i * 0.16, 0.005, 0.14, 0.5);
      o.connect(g); g.connect(this.master);
      o.start(t0 + i * 0.16); o.stop(t0 + i * 0.16 + 0.7);
    }
  }

  // школьный звонок: резкий зуммер, обрывающийся в пустом коридоре
  bell() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(1180, t0);
    const trem = c.createOscillator();
    trem.type = 'sine';
    trem.frequency.value = 18;
    const tremG = c.createGain();
    tremG.gain.value = 0.09;
    const g = c.createGain();
    g.gain.value = 0.0001;
    trem.connect(tremG);
    tremG.connect(g.gain);
    this._env(g, t0, 0.008, 0.16, 1.05);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 1.25);
    trem.start(t0); trem.stop(t0 + 1.25);
  }

  // выстрел из ружья: громкий хлопок + низкий удар + эхо
  shoot() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(9000, t0);
    lp.frequency.exponentialRampToValueAtTime(220, t0 + 0.5);
    const g = c.createGain();
    this._env(g, t0, 0.002, 0.9, 0.55);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(t0); n.stop(t0 + 0.9);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + 0.4);
    const og = c.createGain();
    this._env(og, t0, 0.002, 0.7, 0.5);
    o.connect(og); og.connect(this.master);
    o.start(t0); o.stop(t0 + 0.6);
    // эхо
    const n2 = c.createBufferSource();
    n2.buffer = this._noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    const g2 = c.createGain();
    this._env(g2, t0 + 0.35, 0.05, 0.12, 0.8);
    n2.connect(bp); bp.connect(g2); g2.connect(this.master);
    n2.start(t0 + 0.35); n2.stop(t0 + 1.5);
  }

  // ветер: зацикленный фильтрованный шум, gain управляется снаружи
  windStart(level = 0.14) {
    if (!this.ctx) return;
    if (this._wind) { this._wind.level = level; return; }
    // реальный ветер (запись, CC0): предпочтительнее синтеза
    const s = this._sample('ambient_1', { vol: level * 2.6, loop: true, rate: 1 });
    if (s) {
      const c = this.ctx;
      s.g.gain.setValueAtTime(0.0001, c.currentTime);
      s.g.gain.linearRampToValueAtTime(level * 2.6, c.currentTime + 1.5);
      this._wind = { sample: s, level };
      return;
    }
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.6;
    const lfo = c.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.23;
    const lfoG = c.createGain(); lfoG.gain.value = 160;
    lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
    const g = c.createGain(); g.gain.value = level;
    n.connect(bp); bp.connect(g); g.connect(this.master);
    n.start();
    this._wind = { n, g, lfo, level };
  }

  windStop() {
    if (!this._wind) return;
    const w = this._wind;
    try {
      if (w.sample) {
        w.sample.g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
        setTimeout(() => { try { w.sample.src.stop(); } catch (e) {} }, 1000);
      } else {
        w.g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
        setTimeout(() => { try { w.n.stop(); w.lfo.stop(); } catch (e) {} }, 1000);
      }
    } catch (e) {}
    this._wind = null;
  }

  // шаг по снегу: короткий хруст
  snowStep(vol = 0.5) {
    if (!this.ctx) return;
    if (this._sample(this._pick('step_snow', 5), { vol: vol * 1.6 })) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    n.playbackRate.value = 0.7 + Math.random() * 0.4;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 500 + Math.random() * 300; bp.Q.value = 1.1;
    const g = c.createGain();
    this._env(g, t0, 0.004, 0.22 * vol, 0.14);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    n.start(t0); n.stop(t0 + 0.25);
  }

  // счётчик Гейгера: треск, rate — щелчков в секунду
  // Криповая отдышка на бегу: 3 цикла «выдох–вдох». Выдох — шум через bandpass
  // со спуском частоты + низкий хрип; вдох — короче, выше и тише.
  breath(vol = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    let t0 = c.currentTime + 0.03;
    for (let i = 0; i < 3; i++) {
      const exLen = 0.55 + Math.random() * 0.2;
      // выдох
      const n = c.createBufferSource();
      n.buffer = this._noiseBuf; n.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 1.1;
      const f0 = 700 + Math.random() * 150;
      bp.frequency.setValueAtTime(f0, t0);
      bp.frequency.exponentialRampToValueAtTime(f0 * 0.55, t0 + exLen);
      const g = c.createGain();
      this._env(g, t0, 0.09, (0.16 - i * 0.03) * vol, exLen);
      n.connect(bp); bp.connect(g); g.connect(this.master);
      n.start(t0); n.stop(t0 + exLen + 0.15);
      // хриплый низ на выдохе
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(85 + Math.random() * 20, t0);
      o.frequency.exponentialRampToValueAtTime(60, t0 + exLen);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 240;
      const og = c.createGain();
      this._env(og, t0, 0.08, 0.035 * vol, exLen);
      o.connect(lp); lp.connect(og); og.connect(this.master);
      o.start(t0); o.stop(t0 + exLen + 0.1);
      t0 += exLen + 0.08;
      // вдох: короче и выше
      const inLen = 0.3 + Math.random() * 0.1;
      const n2 = c.createBufferSource();
      n2.buffer = this._noiseBuf; n2.loop = true;
      const bp2 = c.createBiquadFilter();
      bp2.type = 'bandpass'; bp2.Q.value = 1.6;
      bp2.frequency.setValueAtTime(1000, t0);
      bp2.frequency.exponentialRampToValueAtTime(1500, t0 + inLen);
      const g2 = c.createGain();
      this._env(g2, t0, 0.06, 0.07 * vol, inLen);
      n2.connect(bp2); bp2.connect(g2); g2.connect(this.master);
      n2.start(t0); n2.stop(t0 + inLen + 0.12);
      t0 += inLen + 0.35 + Math.random() * 0.25;
    }
  }

  geiger(rate = 2, duration = 2.5) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    let t = 0;
    while (t < duration) {
      t += -Math.log(1 - Math.random()) / Math.max(0.3, rate);
      if (t > duration) break;
      const n = c.createBufferSource();
      n.buffer = this._noiseBuf;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 3000;
      const g = c.createGain();
      this._env(g, t0 + t, 0.001, 0.16, 0.03);
      n.connect(hp); hp.connect(g); g.connect(this.master);
      n.start(t0 + t); n.stop(t0 + t + 0.05);
    }
  }

  // кассовый писк при сканировании товара
  beep() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = 1760;
    const g = c.createGain();
    this._env(g, t0, 0.004, 0.08, 0.09);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.12);
  }

  // Тревожный блип стелса: два коротких нисходящих тона.
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
  // повторить на слух. Это событийный звук, а не постоянный фон.
  echoTone(i = 0) {
    if (!this.ctx) return;
    const freq = [392, 466.16, 523.25, 622.25][((i % 4) + 4) % 4];
    const c = this.ctx;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    o.type = 'sine';
    o2.type = 'triangle';
    o.frequency.value = freq;
    o2.frequency.value = freq * 2.01;
    const g = c.createGain();
    this._env(g, t0, 0.012, 0.16, 0.55);
    const g2 = c.createGain();
    g2.gain.value = 0.24;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.master);
    o.start(t0); o2.start(t0);
    o.stop(t0 + 0.62); o2.stop(t0 + 0.62);
  }

  // Низкий рык белого хомяка: короткий событийный выдох, не постоянный фон.
  roar(vol = 0.8) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    n.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, t0);
    lp.frequency.exponentialRampToValueAtTime(90, t0 + 1.1);
    const ng = c.createGain();
    this._env(ng, t0, 0.09, 0.34 * vol, 1.15);
    n.connect(lp); lp.connect(ng); ng.connect(this.master);
    n.start(t0); n.stop(t0 + 1.35);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(52, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + 1.0);
    const og = c.createGain();
    this._env(og, t0, 0.06, 0.11 * vol, 1.05);
    const olp = c.createBiquadFilter();
    olp.type = 'lowpass'; olp.frequency.value = 160;
    o.connect(olp); olp.connect(og); og.connect(this.master);
    o.start(t0); o.stop(t0 + 1.2);
  }

  // касса: писк + стук ящика
  kassa() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    this.beep();
    this._sample('coins', { vol: 0.8, at: 0.15 }); // звон монет на кассе
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t0 + 0.25);
    o.frequency.exponentialRampToValueAtTime(90, t0 + 0.4);
    const g = c.createGain();
    this._env(g, t0 + 0.25, 0.005, 0.25, 0.2);
    o.connect(g); g.connect(this.master);
    o.start(t0 + 0.25); o.stop(t0 + 0.5);
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 2;
    const ng = c.createGain();
    this._env(ng, t0 + 0.25, 0.003, 0.18, 0.08);
    n.connect(bp); bp.connect(ng); ng.connect(this.master);
    n.start(t0 + 0.25); n.stop(t0 + 0.4);
  }

  // шаги в подъезде: глухой бетонный удар
  step(vol = 0.3) {
    if (!this.ctx) return;
    if (this._sample(this._pick('step_wood', 5), { vol: vol * 2.2 })) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(60, t0 + 0.08);
    const g = c.createGain();
    this._env(g, t0, 0.003, 0.12 * vol, 0.1);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.15);
  }

  // старое радио: шум эфира + морзянка, 3.2 секунды
  radio() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuf;
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.055, t0 + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 3.2);
    // «речь» — амплитудная рябь
    const lfo = c.createOscillator();
    lfo.frequency.value = 4.2;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    lfo.start(t0);
    lfo.stop(t0 + 3.4);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    n.start(t0); n.stop(t0 + 3.4);
    // позывные
    const beep = (at, dur) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = 880;
      const og = c.createGain();
      this._env(og, at, 0.01, 0.05, dur);
      o.connect(og); og.connect(this.master);
      o.start(at); o.stop(at + dur + 0.1);
    };
    beep(t0 + 0.7, 0.12); beep(t0 + 1.0, 0.12); beep(t0 + 1.3, 0.24);
  }
}
