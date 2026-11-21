// game.js — «Нет, я не величанин». Цикл: день (допрос → Бедронка) → ночь (стуки → впустить/нет).
// Вердикты: ОСТАВИТЬ / ЗАСТРЕЛИТЬ / В ПОДВАЛ. Ошибки имеют цену. Семь дней, семь концовок.

import * as THREE from 'three';
import { createHumanoid, disposeHumanoid } from './rig.js';
import { pose, resetPose } from './anim.js';
import { GUESTS, DAYS, ITEMS, LYUDMILA, ZOSIA, RADIO, NEWS, MIRROR, TEXTS, ENDINGS, STORE_DAILY_LIMIT, LYCEUM } from './story.js';
import { MINE_ITEMS, MINE_TEXT, MINER_DIALOGUE, CORE_DIALOGUE, MINE_ENDINGS, LYUDMILA_MINE, ZOSIA_MINE } from './mine_story.js';
import { SECRET_DEFS, SECRET_BY_ID } from './secrets_story.js';

// места для сидящих гостей: диван, стул у стола, табурет у кухни, пол у печи
const GUEST_SPOTS = [
  { x: 0.85, y: 0.0, z: 0.85, ry: Math.PI },
  { x: 1.35, y: 0.0, z: 0.85, ry: Math.PI },
  { x: 1.85, y: 0.0, z: 0.85, ry: Math.PI },
  { x: -0.6, y: 0.0, z: 1.35, ry: Math.PI * 0.75 },
  { x: -1.15, y: 0.0, z: 0.15, ry: Math.PI * 0.55 },
  { x: 1.15, y: -0.38, z: 1.95, ry: -Math.PI * 0.8 },
  { x: -1.55, y: -0.38, z: 2.0, ry: Math.PI * 0.7 },
  { x: 0.3, y: -0.38, z: 2.1, ry: Math.PI }
];

const GIFTS = {
  'baba-galya': { supplies: 2, text: 'Баба Галя отсыпала Хомке стакан семечек. «Ешь, а то худой».' },
  'pan-vladek': { supplies: 1, text: 'Пан Владек нарубил доску на растопку. Печь гудит довольная.' },
  'malysh-kuba': { hearts: 1, text: 'Куба нашёл за диваном вашу старую игрушку. Хомке стало тепло.' },
  'pani-danuta': { hearts: 1, text: 'Пани Данута зашила порванную занавеску. В комнате стало уютнее.' },
  'ded-mieczyslaw': { supplies: 2, text: 'Дед Мечислав выложил на стол две банки тушёнки: «На крышу. Не спорь».' }
};

export class Game {
  constructor(app) {
    this.app = app;
    this.ui = app.ui;
    this.sfx = app.sfx;
    this.t = 0;
    this.timers = [];
    this.geigerT = 0;
    this.reset();
  }

  reset() {
    this.day = 1;
    this.hearts = 3;
    this.supplies = 4;
    this.meds = 0;
    this.tea = 0;
    this.hasSocks = false;
    this.hasGeiger = false;
    this.timeMinutes = 9 * 60;
    this._lastClockMinute = -1;
    this.inventory = { lamp: 0, key: 0, fuse: 0, filter: 0, crowbar: 0, echo: 0 };
    this.mineUnlocked = false;
    this.mineLevel = 0;
    this.mineAir = 100;
    this.minePower = false;
    this.mineValves = new Set();
    this.mineLevers = [false, false, false];
    this.mineLeversTouched = new Set();
    this.mineGasFixed = false;
    this.minePumpOrder = [];
    this.minePumpsOn = false;
    this.minePressure = { valveA: 0, valveB: 0 };
    this.minePressureOk = false;
    this.mineEchoSeq = [];
    this.mineEchoInput = [];
    this.mineEchoSolved = false;
    this.mineEchoPlaying = false;
    this.mineChase = false;
    this.mineChaseDone = false;
    this.mineChaseGrace = 0;
    this.mineHidden = false;
    this.mineHideIndex = -1;
    this._lastRoar = -Infinity;
    this.mineCollected = new Set();
    this.mineChoice = 'none';
    this.mineResolved = false;
    this.mineAsked = new Set();
    this.mineRead = new Set();
    this.coreAsked = new Set();
    this.minerRemembered = false;
    this.shopMineStage = 0;
    this.secretFound = new Set();
    this.secretLast = null;
    this.teaUsedDay = 0;
    this.warmth = 100;
    this.collapseUsed = false;
    this.phase = 'title';
    this.residents = [];      // принятые и оставленные (сидят в доме)
    this.pending = [];        // впущены ночью, ждут вердикта
    this.patients = [];       // в подвале
    this.nightQueue = [];
    this.doorGuest = null;
    this.cart = [];
    this.storePurchased = new Set();
    this.talkedShop = false;
    this.storeTripDone = false;
    this.storeCurfewWarned = false;
    this.storeSuspicion = 0;      // 0..100, растёт, когда Людмила видит краденое
    this.storeCaught = 0;         // сколько раз попался за день
    this.storeSeen = false;
    this.storeWarned = 0;
    this._surfaceLockNoticeAt = -Infinity;
    this._surfaceLockNoticeText = '';
    this.lyceumDone = false;
    this.lyceumStudied = false;
    this.skipNextNight = false;
    this.finalDay = false;
    this.flags = { shotInnocents: 0, keptKrakov: 0, keptRad: 0, cured: 0, keptVel: 0, marek: 'none', betray: 0 };
    this.usedSpots = new Set();
    this.walkers = [];
    this.corpses = [];
    this.cutscene = null;
    this.visitorRig = null;
    this.visitorBreath = 0;
    this.poseDirty = false;
    this.syncStoreItems();
    this.syncMineItems();
    this.syncMineAccess();
    if (this.app.worldExpansion) this.app.worldExpansion.syncFound(this.secretFound);
  }

  // ---------- утилиты ----------
  after(sec, fn) { this.timers.push({ at: this.t + sec, fn }); }
  clearTimers() { this.timers.length = 0; }
  hud(time) {
    const night = this.phase === 'night' || this.phase === 'sleep' || this.phase === 'nightfall';
    const label = this.finalDay ? 'УТРО ВОСЬМОГО' : `${night ? 'НОЧЬ' : 'ДЕНЬ'} ${this.day}${this.skipNextNight ? ' ·zzz' : ''}`;
    this.ui.setDay(this.day, time || this.clockText(), label);
    this.ui.setHearts(this.hearts);
    this.ui.setSupplies(this.supplies);
    this.ui.setMeds(this.meds);
    this.ui.setAir(this.mineAir, this.isMineMode());
    this.updateCart();
  }
  msg(text, ms = 6000) { this.ui.subtitle(text, ms); }

  clockText() {
    const mins = ((Math.floor(this.timeMinutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  isMineMode(mode = this.app.mode) { return /^mine[1-4]$/.test(mode); }

  advanceTime(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    this.timeMinutes += minutes;
    if (this.timeMinutes >= 1440) this.timeMinutes -= 1440;
    this.hud();
    this.syncEnvironment();
  }

  // День плавно уходит в сумерки, интерьерные лампы и огни бочек не затрагиваются.
  syncEnvironment() {
    if (!this.app.scenes) return;
    const h = this.timeMinutes / 60;
    let daylight;
    if (this.phase === 'night' || this.phase === 'sleep' || h >= 22 || h < 6) daylight = 0.06;
    else if (h >= 17) daylight = Math.max(0.10, 1 - (h - 17) / 5 * 0.90);
    else daylight = 1;
    for (const id of ['home', 'street', 'store', 'lyceum']) {
      const sc = this.app.scenes[id];
      if (!sc || !sc.scene) continue;
      const scene = sc.scene;
      if (!scene.userData.cycleBackground && scene.background && scene.background.isColor) {
        scene.userData.cycleBackground = scene.background.clone();
      }
      if (scene.userData.cycleBackground) {
        scene.background.copy(scene.userData.cycleBackground).multiplyScalar(0.18 + daylight * 0.82);
      }
      if (scene.fog && scene.fog.color) {
        if (!scene.userData.cycleFog) scene.userData.cycleFog = scene.fog.color.clone();
        scene.fog.color.copy(scene.userData.cycleFog).multiplyScalar(0.20 + daylight * 0.80);
      }
      scene.traverse((o) => {
        if (!o.isLight || !(o.isHemisphereLight || o.isDirectionalLight || o.isAmbientLight)) return;
        if (o.userData.cycleBase === undefined) o.userData.cycleBase = o.intensity;
        o.intensity = o.userData.cycleBase * (0.22 + daylight * 0.78);
      });
    }
  }

  // ---------- старт ----------
  start() {
    this.clearTimers();
    this.reset();
    this.ui.showHUD(1, '09:00', 3);
    this.hud('09:00');
    this.app.goto('home', { x: -0.3, z: 1.6 }, 0);
    this.phase = 'intro';
    this.ui.bigtext('НЕТ, Я НЕ ВЕЛИЧАНИН', 3400);
    this.ui.subtitle(TEXTS.gameIntro, 9000);
    this.after(9.2, () => this.startDay());
  }

  // ---------- ДЕНЬ ----------
  startDay() {
    const d = DAYS[this.day - 1];
    this.phase = 'day';
    this.timeMinutes = 9 * 60;
    this._lastClockMinute = -1;
    this.mineLevel = 0;
    this.mineAir = 100;
    this.syncMineAccess();
    this.syncEnvironment();
    this.sfx.nightAmbienceStop();
    this.sfx.roomTone(true);
    // меловой крест на доме — с четвёртого дня
    const st = this.app.scenes.street;
    if (st && st.cross) st.cross.visible = this.day >= 4;
    this.cart = [];
    this.storePurchased.clear();
    this.syncStoreItems();
    this.talkedShop = false;
    this.storeTripDone = false;
    this.storeCurfewWarned = false;
    this.storeSuspicion = 0;
    this.storeCaught = 0;
    this.storeSeen = false;
    this.storeWarned = 0;
    this.collapseUsed = false;
    this.warmth = 100;
    this.ui.showWarmth(false);
    this.hud('09:00');
    this.ui.bigtext(d.intro, 3600);
    this.msg(d.morning, 7000);
    this.morningEvents();
    this.after(7.5, () => {
      if (this.phase !== 'day') return;
      if (this.day === 2 && !this.lyceumDone) {
        this.ui.prompt('Сначала — лицей на улице, справа. Потом — «Бедронка».');
      } else if (this.pending.length > 0) {
        this.ui.prompt('Поговорите с гостями. Потом — в «Бедронку».');
      } else {
        this.ui.prompt('Дорога в «Бедронку». Дверь — впереди.');
      }
    });
  }

  // утренние события: кормление, болезни, подарки, лечение в подвале
  morningEvents() {
    const notes = [];
    // лечение в подвале
    for (const p of this.patients) {
      p.daysLeft -= 1;
      if (this.meds > 0) {
        this.meds -= 1;
        p.daysLeft -= 1;
        notes.push('Лекарства пошли в дело: ' + p.guest.name + ' идёт на поправку быстрее.');
      }
      if (p.daysLeft <= 0 && !p.cured) {
        p.cured = true;
        this.flags.cured += 1;
        notes.push(TEXTS.cured + ' — ' + p.guest.name + '.');
        this.curePatient(p);
      }
    }
    // подарки от оставленных величан (один раз)
    for (const r of this.residents) {
      if (r.gifted) continue;
      const g = GIFTS[r.guest.id];
      if (g) {
        r.gifted = true;
        if (g.supplies) this.supplies += g.supplies;
        if (g.hearts) this.hearts = Math.min(3, this.hearts + g.hearts);
        notes.push(g.text);
      }
    }
    // кормление: Хомка + все жильцы (кроме подвала — там своя норма)
    const mouths = 1 + this.residents.length;
    if (this.supplies >= mouths) {
      this.supplies -= mouths;
    } else {
      this.supplies = 0;
      this.hearts -= 1;
      notes.push(TEXTS.feedFail);
      if (this.hearts <= 0) { this.after(4, () => this.gameOver('starve')); }
    }
    this.hud('09:00');
    let delay = 7.5;
    for (const n of notes) {
      this.after(delay, () => this.msg(n, 5000));
      delay += 5.2;
    }
  }

  curePatient(p) {
    // снимаем свечение, гость поднимается из подвала и садится в доме
    const pi = this.patients.indexOf(p);
    if (pi >= 0) this.patients.splice(pi, 1);
    const rig = p.rig;
    rig.eyeMeshes.forEach((e) => { e.material.emissiveIntensity = 0; });
    const spot = this.freeSpot();
    const home = this.app.scenes.home;
    home.scene.add(rig.root);
    rig.root.rotation.set(0, 0, 0);
    if (spot) {
      rig.root.position.set(spot.x, spot.y, spot.z);
      rig.root.rotation.y = spot.ry;
      this.residents.push({ guest: p.guest, rig, spot, cured: true, gifted: true, seated: true });
    } else {
      this.app.scenes.basement.scene.remove(rig.root);
      disposeHumanoid(rig);
    }
  }

  freeSpot() {
    for (const s of GUEST_SPOTS) {
      const key = s.x + ',' + s.z;
      if (!this.usedSpots.has(key)) { this.usedSpots.add(key); return s; }
    }
    return null;
  }

  // ---------- допрос ----------
  interrogate(entry) {
    if (this.phase !== 'day') return;
    this.phase = 'verdict';
    const g = entry.guest;
    this.current = entry;
    entry.asked = entry.asked || new Set();
    this.ui.say(g.name, g.sitLine || g.doorLines[0], this.verdictChoices());
  }

  verdictChoices() {
    const g = this.current.guest;
    const out = [];
    g.questions.forEach((q, i) => {
      if (this.current.asked.has(i)) return;
      out.push({ label: `— ${q.q}`, cb: () => this.ask(i) });
    });
    if (!this.current.looked) {
      out.push({ label: '🔍 Осмотреть', cb: () => this.lookAt() });
    }
    if (this.hasGeiger && !this.current.geigered) {
      out.push({ label: '📟 Проверить дозиметром', cb: () => this.geigerCheck() });
    }
    out.push({ label: 'ОСТАВИТЬ', cls: 'verdict-keep', cb: () => this.verdict('keep') });
    out.push({ label: 'ЗАСТРЕЛИТЬ', cls: 'verdict-shoot', cb: () => this.verdict('shoot') });
    out.push({ label: 'В ПОДВАЛ', cls: 'verdict-basement', cb: () => this.verdict('basement') });
    return out;
  }

  ask(i) {
    const g = this.current.guest;
    this.current.asked.add(i);
    this.sfx.chime();
    this.ui.say(g.name, g.answers[i], this.verdictChoices());
  }

  lookAt() {
    this.current.looked = true;
    this.sfx.whisper();
    this.ui.say(this.current.guest.name, this.current.guest.examine, this.verdictChoices());
  }

  geigerCheck() {
    const g = this.current.guest;
    this.current.geigered = true;
    let rate, text;
    if (g.id === 'ded-mieczyslaw') { rate = 4; text = 'Дозиметр щёлкает тепло и редко — оранжевым. Это не фон. Это уголь в крови, светящий, как жар. Счётчик на такое не злится.'; }
    else if (g.type === 'radioactive') { rate = 14; text = 'Дозиметр захлёбывается. Стрелка уходит за шкалу и не думает возвращаться. Вот кто фонит по-настоящему.'; }
    else if (g.type === 'krakovianin') { rate = 0.6; text = 'Тишина. Совершенная чистота — как из мытарни. В Величке так не бывает: даже стены тут фонят. Либо прибор сломан, либо человек из той машины, где не бывает грязи.'; }
    else { rate = 2; text = 'Редкие щелчки — как у Хомки у самого. Норма Велички: чуть выше мирной, чуть ниже страшной. Свой фон.'; }
    this.sfx.geiger(rate, 2.6);
    this.ui.say('(дозиметр)', text, this.verdictChoices());
  }

  verdict(kind) {
    const entry = this.current;
    const g = entry.guest;
    this.ui.dialogue(null, null, []);
    const correct =
      (kind === 'keep' && g.type === 'velichanin') ||
      (kind === 'shoot' && g.type === 'krakovianin') ||
      (kind === 'basement' && g.type === 'radioactive');

    if (kind === 'keep') {
      if (g.type === 'krakovianin') {
        this.flags.keptKrakov += 1;
        entry.keptBad = true;
        this.msg('Хомка оставил гостя. Тот сел у окна и стал смотреть на улицу.', 5000);
      } else if (g.type === 'radioactive') {
        this.flags.keptRad += 1;
        entry.keptBad = true;
        this.msg('Гость остался в комнате. От него идёт тепло — слишком ровное, чтобы быть хорошим.', 5000);
      } else {
        this.flags.keptVel += 1;
        this.msg(g.keepLine, 5000);
        this.sfx.chime();
      }
      if (g.special === 'marek') this.flags.marek = 'alive';
      this.pending.splice(this.pending.indexOf(entry), 1);
      this.residents.push(entry);
      this.phase = 'day';
      this.checkVerdictsDone();
      return;
    }

    if (kind === 'shoot') {
      if (g.type !== 'krakovianin') {
        // Хомка не теряет «сердце» — он его находит. В этом и ужас.
        this.flags.shotInnocents += 1;
        this.msg(TEXTS.wrongShoot, 5000);
        if (g.special === 'marek') this.flags.marek = 'shot';
      } else {
        this.msg(TEXTS.correctShoot, 5000);
        if (g.id === 'pan-jacek') { this.supplies += 2; this.after(5.2, () => this.msg('В сумке Яцека — мясо. Хомка забрал его. +2 запаса.', 5000)); }
        if (g.id === 'pani-bozena') { this.meds += 1; this.after(5.2, () => this.msg('Ампулы Божены пригодятся. +1 лекарства.', 5000)); }
        if (g.special === 'marek') { this.flags.marek = 'shot'; this.after(5.2, () => this.msg(TEXTS.marekShot, 6000)); }
      }
      this.pending.splice(this.pending.indexOf(entry), 1);
      this.corpses.push(entry);
      this.stopWalker(entry.rig);
      this.hud();
      this.shootCutscene(entry);
      return;
    }

    // подвал
    if (g.type === 'radioactive') {
      this.msg(g.basementLine, 5000);
    } else if (g.type === 'krakovianin') {
      this.msg(g.basementLine, 5000);
      entry.escapeRisk = true;
    } else {
      this.msg(TEXTS.velBasement, 5000);
      entry.escapeRisk = true;
    }
    if (g.special === 'marek') this.flags.marek = 'alive';
    this.pending.splice(this.pending.indexOf(entry), 1);
    this.stopWalker(entry.rig);
    this.sendToBasement(entry, correct);
    this.phase = 'day';
    this.checkVerdictsDone();
  }

  checkVerdictsDone() {
    if (this.pending.length === 0) {
      if (this.finalDay) {
        this.after(4, () => this.finalEnding());
      } else {
        this.after(2.5, () => this.ui.prompt('Дорога в «Бедронку». Дверь — впереди.'));
      }
    } else {
      this.after(2.5, () => this.ui.prompt('Осталось гостей: ' + this.pending.length));
    }
  }

  stopWalker(rig) {
    this.walkers = this.walkers.filter((w) => w.entry.rig !== rig);
  }

  // ---------- ружьё: катсцена ----------
  shootCutscene(entry) {
    const home = this.app.scenes.home;
    const rig = entry.rig;
    const cam = this.app.camera;
    this.phase = 'cutscene';
    this.app.setMode('cut');
    this.app.unlockPointer();

    // ружьё в руках: клонируем проп со стены
    const hands = home.rifle.clone();
    hands.position.set(0.28, -0.32, -0.55);
    hands.rotation.set(0.15, Math.PI, 0.05);
    cam.add(hands);

    const head = new THREE.Vector3();
    rig.joints.head.getWorldPosition(head);
    const eye = head.clone().add(new THREE.Vector3(Math.sin(rig.root.rotation.y), 0, Math.cos(rig.root.rotation.y)).multiplyScalar(1.3));
    eye.y = 1.62;

    const startPos = cam.position.clone();
    const startRot = cam.rotation.clone();
    this.sfx.heartbeats(3, 1.2);
    this.cutscene = {
      t: 0, rig, hands, startPos, startRot, eye, head,
      step: (dt, c) => {
        if (c.t < 1.1) {
          cam.position.lerpVectors(c.startPos, c.eye, Math.min(1, c.t / 1.1));
          cam.lookAt(c.head);
        } else if (c.t < 1.9) {
          cam.position.copy(c.eye);
          cam.lookAt(c.head);
        } else if (c.t < 2.0 && !c.shot) {
          c.shot = true;
          this.sfx.shoot();
          this.sfx.stopHeartbeat();
          this.ui.flashRed(500);
          this.corpseFall(c.rig);
          this.dropDecal(c.rig);
        } else if (c.t > 3.2 && !c.done) {
          c.done = true;
          cam.remove(c.hands);
          this.after(0.8, () => {
            this.msg(entry.guest.shootLine, 5000);
            this.after(2.2, () => {
              disposeHumanoid(c.rig);
              this.corpses = this.corpses.filter((x) => x.rig !== c.rig);
              this.app.setMode('home');
              this.app.lockPointer();
              this.phase = 'day';
              this.cutscene = null;
              this.checkVerdictsDone();
              if (this.hearts <= 0) this.gameOver('starve');
            });
          });
        }
      }
    };
  }

  corpseFall(rig) {
    rig.dead = true;
    rig.deadT = 0;
  }

  dropDecal(rig) {
    const home = this.app.scenes.home;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.MeshStandardMaterial({
        map: new THREE.TextureLoader().load('assets/tex/blood_decal.png'),
        transparent: true, roughness: 0.95, depthWrite: false, color: 0xffffff
      })
    );
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.random() * 6.28;
    decal.position.set(rig.root.position.x, 0.006, rig.root.position.z + 0.4);
    home.scene.add(decal);
  }

  // ---------- подвал ----------
  sendToBasement(entry, correct) {
    const b = this.app.scenes.basement;
    const rig = entry.rig;
    const free = b.cotSpots.filter((c) => !this.patients.some((p) => p.cot === c));
    const cot = free[0];
    if (!cot) {
      // подвал полон — гость уходит
      disposeHumanoid(rig);
      this.msg('В подвале нет места. Гость ушёл в снег.', 5000);
      return;
    }
    b.scene.add(rig.root);
    rig.root.position.set(cot.x, cot.y, cot.z - 0.75);
    rig.root.rotation.set(-Math.PI / 2, 0, 0);
    this.patients.push({
      guest: entry.guest, rig, cot,
      daysLeft: entry.guest.cureDays || 2,
      cured: false,
      fake: entry.guest.type !== 'radioactive'
    });
  }

  // ---------- НОЧЬ ----------
  // Чит HOMKA: ночью — пропустить текущую ночь, днём — зарядить пропуск следующей.
  skipNight() {
    if (this.phase === 'night') {
      this.clearTimers();
      this.skipNextNight = false;
      this.nightQueue.length = 0;
      this.doorGuest = null;
      this.doorState = 'none';
      if (this.app.peephole) this.app.exitPeephole();
      this.sfx.stopHeartbeat();
      this.clearDoorVisitor();
      this.ui.dialogue(null, null, []);
      this.ui.bigtext('HOMKA: НОЧЬ ПРОПУЩЕНА', 1800);
      this.msg('Чит HOMKA принят. Эту ночь Хомка проспит.', 3500);
      this.sleep();
      return true;
    }
    if (this.phase === 'done' || this.phase === 'sleep') return false;
    this.skipNextNight = true;
    this.hud();
    this.msg('HOMKA: пропуск ночи включён. Ложись спать [E] у кровати в спальне — ночь пролетит мгновенно.', 5500);
    return true;
  }

  requestSleep() {
    if (this.finalDay) {
      this.eveningStarted = false;
      this.ui.prompt(null);
      this.finalEnding();
      return true;
    }
    if (!this.storeTripDone || this.cart.length > 0) {
      this.msg(this.cart.length > 0
        ? 'Сначала выйди из «Бедронки» с добычей: домой с полными карманами не пройти.'
        : 'Сначала сходи в «Бедронку»: возьми 1–3 предмета, пока Людмила не смотрит, и уйди.', 6000);
      this.ui.prompt(this.cart.length > 0
        ? 'Вернись в «Бедронку» и выйди через дверь — с добычей, но незамеченным.'
        : 'Дорога в «Бедронку». Возьми 1–3 предмета и уйди незамеченным.');
      return false;
    }
    this.eveningStarted = false;
    this.ui.prompt(null);
    this.startNight();
    return true;
  }

  startNight() {
    if (this.finalDay || this.day > DAYS.length) {
      this.finalDay = true;
      this.phase = 'day';
      this.timeMinutes = 8 * 60;
      this._lastClockMinute = -1;
      this.hud('08:00');
      this.checkVerdictsDone();
      return;
    }
    const d = DAYS[this.day - 1];
    this.phase = 'night';
    this.timeMinutes = 23 * 60;
    this._lastClockMinute = -1;
    this.mineLevel = 0;
    this.mineAir = 100;
    const mineJustOpened = this.day === 3 && !this.mineUnlocked;
    if (this.day >= 3) this.mineUnlocked = true;
    this.syncMineAccess();
    this.syncEnvironment();
    this.hud();
    if (this.skipNextNight) {
      this.skipNextNight = false;
      this.nightQueue.length = 0;
      this.doorGuest = null;
      this.doorState = 'none';
      this.ui.dialogue(null, null, []);
      this.ui.bigtext('HOMKA: НОЧЬ ПРОПУЩЕНА', 1800);
      this.msg('Чит HOMKA сработал заранее. Ночь закрыта без стука.', 3500);
      this.sleep();
      return;
    }
    this.hud();
    this.ui.bigtext(`НОЧЬ ${this.day}`, 3000);
    this.msg(mineJustOpened ? MINE_TEXT.unlock : 'Хомка сидит у двери. Ружьё — на коленях. Печь гудит.', mineJustOpened ? 10000 : 5000);
    this.sfx.nightAmbience(this.day);
    this.nightQueue = d.night.map((id) => GUESTS[id]);
    this.after(5, () => this.nextKnock());
  }

  nextKnock() {
    if (this.phase !== 'night') return;
    // Ночь не заканчивается под землёй или в дороге: утро ждёт возвращения в дом.
    if (this.app.mode !== 'home') { this.after(5, () => this.nextKnock()); return; }
    if (this.nightQueue.length === 0) { this.sleep(); return; }
    this.clearDoorVisitor();
    this.doorGuest = this.nightQueue.shift();
    this.doorState = 'knock';
    this.doorKnockT = this.t;
    this.spawnDoorVisitor();
    this.sfx.knock(0.9, 2);
    this.setDoorGlow(this.doorGuest.type);
    this.msg(this.doorGuest.nightHint, 6000);
    this.after(6.5, () => {
      if (this.doorGuest && this.doorState === 'knock') {
        this.doorState = 'waiting';
        this.ui.prompt('[E] у двери — кто там?');
      }
    });
  }

  // гость стоит в подъезде за дверью — его видно только через глазок
  spawnDoorVisitor() {
    if (!this.doorGuest) return;
    const home = this.app.scenes.home;
    const rig = createHumanoid(this.doorGuest.rig);
    rig.root.position.set(home.anchors.visitor.x, 0, home.anchors.visitor.z);
    rig.root.rotation.y = 0.04;
    home.scene.add(rig.root);
    this.visitorRig = rig;
    this.visitorBreath = 0;
  }

  clearDoorVisitor() {
    if (!this.visitorRig) return;
    disposeHumanoid(this.visitorRig);
    this.visitorRig = null;
  }

  // подойти к двери и посмотреть в глазок: настоящая камера + настоящий гость
  lookPeephole() {
    if (!this.doorGuest) return;
    this.doorLooked = true;
    if (this.doorState === 'knock') this.doorState = 'waiting';
    this.sfx.whisper();
    this.app.enterPeephole();
    this.ui.say('ГЛАЗОК', this.doorGuest.examine, [
      { label: 'Говорить через дверь', cb: () => this.doorTalk() },
      { label: 'Отойти от двери', cb: () => this.closePeephole() }
    ]);
  }

  closePeephole() {
    this.app.exitPeephole();
    this.ui.dialogue(null, null, []);
    this.ui.prompt(null);
    this.app.lockPointer();
  }

  setDoorGlow(type) {
    const home = this.app.scenes.home;
    if (!this.doorGlow) {
      this.doorGlow = new THREE.PointLight(0x66ff66, 0, 3, 2);
      this.doorGlow.position.set(0, 0.12, -2.4);
      home.scene.add(this.doorGlow);
    }
    if (type === 'radioactive') { this.doorGlow.color.set(0x7dff7a); this.doorGlow.intensity = 5; }
    else if (type === 'velichanin') { this.doorGlow.color.set(0xffa050); this.doorGlow.intensity = 2; }
    else { this.doorGlow.intensity = 0; }
  }

  doorTalk() {
    if (!this.doorGuest) return;
    const fromDoor = this.doorState !== 'talk';
    this.doorState = 'talk';
    const g = this.doorGuest;
    if (fromDoor) {
      this.doorAsked = new Set();
      this.doorLooked = false;
      this.sfx.creak(0.7);
    }
    if (this.app.peephole) this.app.exitPeephole();
    this.ui.say(g.name, g.doorLines[0], this.doorChoices());
  }

  doorChoices() {
    const g = this.doorGuest;
    const out = [];
    if (!this.doorAsked.has(0)) out.push({ label: `— ${g.questions[0].q}`, cb: () => { this.doorAsked.add(0); this.sfx.chime(); this.ui.say(g.name, g.answers[0], this.doorChoices()); } });
    if (!this.doorAsked.has(1)) out.push({ label: `— ${g.questions[1].q}`, cb: () => { this.doorAsked.add(1); this.sfx.chime(); this.ui.say(g.name, g.answers[1], this.doorChoices()); } });
    if (!this.doorLooked) out.push({ label: '🔍 Посмотреть в глазок', cb: () => this.lookPeephole() });
    out.push({ label: 'ВПУСТИТЬ', cls: 'decide-open', cb: () => this.enterHouse() });
    out.push({ label: 'НЕ ОТКРЫВАТЬ', cls: 'decide-close', cb: () => this.refuse() });
    return out;
  }

  enterHouse() {
    const g = this.doorGuest;
    this.ui.dialogue(null, null, []);
    this.setDoorGlow('none');
    if (this.app.peephole) this.app.exitPeephole();
    this.clearDoorVisitor();
    const home = this.app.scenes.home;
    const rig = createHumanoid(g.rig);
    rig.root.position.set(0, 0, -2.3);
    home.scene.add(rig.root);
    this.sfx.creak(1.0);
    const spot = this.freeSpot() || { x: 0.4, y: -0.38, z: -1.2, ry: Math.PI * 0.9 };
    const entry = { guest: g, rig, spot, asked: new Set(), looked: false, seated: false };
    this.walkers.push({ entry, t: 0 });
    this.pending.push(entry);
    this.doorGuest = null;
    this.doorState = 'none';
    this.after(2.2, () => {
      this.msg(g.doorLines[1] || 'Гость вошёл и сел.', 5000);
      this.after(4.5, () => this.nextKnock());
    });
  }

  refuse() {
    const g = this.doorGuest;
    this.ui.dialogue(null, null, []);
    this.setDoorGlow('none');
    if (this.app.peephole) this.app.exitPeephole();
    this.clearDoorVisitor();
    this.doorGuest = null;
    this.doorState = 'none';
    if (g.type === 'krakovianin') {
      this.msg('Хомка не открыл. За дверью постояли, подумали и ушли. Чистые ботинки — по чистому снегу.', 6000);
      this.sfx.chime();
    } else {
      this.hearts -= 1;
      this.advanceTime(30);
      this.msg('Хомка не открыл своему. Шаги ушли в снег. Сердце стало тяжелее ружья.', 6000);
      this.sfx.heartbeats(4, 1.3);
      this.after(4.5, () => this.sfx.stopHeartbeat());
      if (this.hearts <= 0) { this.after(5, () => this.gameOver('starve')); return; }
    }
    this.after(6, () => this.nextKnock());
  }

  // ---------- сон и ночные события ----------
  sleep() {
    this.phase = 'sleep';
    this.sfx.nightAmbienceStop();
    this.clearDoorVisitor();
    this.ui.prompt(null);
    const notes = [];
    // предательства: оставленные краковяне
    const traitors = this.residents.filter((r) => r.keptBad && r.guest.type === 'krakovianin');
    for (const tr of traitors) {
      this.flags.betray += 1;
      this.supplies = Math.max(0, this.supplies - 3);
      this.hearts -= 1;
      notes.push(tr.guest.betray);
      this.removeResident(tr);
      if (this.flags.betray >= 2) {
        this.after(3, () => this.gameOver('betrayed'));
        return;
      }
    }
    // радиоактивный в комнате
    const rads = this.residents.filter((r) => r.keptBad && r.guest.type === 'radioactive');
    for (const r of rads) {
      this.supplies = Math.max(0, this.supplies - 2);
      notes.push(TEXTS.radioKept);
      this.removeResident(r);
    }
    // побег из подвала (неверно отправленные)
    for (const p of this.patients.filter((x) => x.fake)) {
      notes.push(TEXTS.escapeBasement + ' — ' + p.guest.name + '.');
      this.removePatient(p);
    }
    this.ui.fade(true);
    this.after(1.2, () => {
      this.day += 1;
      this.ui.fade(false);
      if (this.day > DAYS.length) {
        this.finalDay = true;
        this.ui.bigtext('УТРО ВОСЬМОГО', 3400);
        this.msg('Последнее утро. Осталось разобраться с теми, кто пришёл ночью.', 6000);
        this.phase = 'day';
        this.timeMinutes = 8 * 60;
        this._lastClockMinute = -1;
        this.syncEnvironment();
        this.hud('08:00');
        this.morningEvents();
        this.after(7, () => this.checkVerdictsDone());
        return;
      }
      this.startDay();
    });
    let d = 3;
    for (const n of notes) { this.after(d, () => this.msg(n, 7000)); d += 7.5; }
  }

  removeResident(r) {
    const i = this.residents.indexOf(r);
    if (i >= 0) this.residents.splice(i, 1);
    if (r.spot) this.usedSpots.delete(r.spot.x + ',' + r.spot.z);
    disposeHumanoid(r.rig);
  }

  removePatient(p) {
    const i = this.patients.indexOf(p);
    if (i >= 0) this.patients.splice(i, 1);
    disposeHumanoid(p.rig);
  }

  // ---------- переходы ----------
  // Наземные двери используют ту же сюжетную логику, что и [E]. Портал лишь
  // вызывает эти методы при физическом пересечении проёма, без второго списания времени.
  surfaceReady() {
    return !this.app.transitioning && !(this.app.surfaceCooldown > 0);
  }

  surfaceGoto(id, pos, yaw, options = {}) {
    if (!this.surfaceReady()) return false;
    const actualYaw = Number.isFinite(options.yawOffset)
      ? this.app.camera.rotation.y + options.yawOffset
      : yaw;
    return this.app.goto(id, pos, actualYaw, { seamless: true });
  }

  surfaceLockText(id) {
    if (id === 'store-exit' && this.cart.length === 0 && !this.storeTripDone) {
      return 'С пустыми руками не уйти: дома ждут. Возьми 1–3 предмета, пока Людмила не смотрит.';
    }
    if (id === 'street-home' && !this.finalDay) {
      if (!this.storeTripDone) return 'Домой — только после «Бедронки». Возьми 1–3 предмета и уйди незамеченным.';
    }
    return '';
  }

  notifySurfaceLock(id) {
    const text = this.surfaceLockText(id);
    if (!text) return false;
    // Портал проверяется каждый кадр: подсказку показываем заново не чаще 1,2 с.
    if (text !== this._surfaceLockNoticeText || this.t - this._surfaceLockNoticeAt >= 1.2) {
      this._surfaceLockNoticeText = text;
      this._surfaceLockNoticeAt = this.t;
      this.msg(text, 6000);
    }
    return true;
  }

  canUseSurfaceDoor(id) {
    const phase = this.phase;
    if (id === 'home-exit') {
      return (phase === 'day' || phase === 'verdict' || phase === 'debug')
        && this.pending.length === 0 && !this.finalDay;
    }
    if (id === 'street-home') return this.finalDay || (this.storeTripDone && this.cart.length === 0);
    if (id === 'store-exit') return this.cart.length > 0 || this.storeTripDone;
    if (id === 'lyceum-exit') return true;
    if (id === 'street-store') return !(this.day === 2 && !this.lyceumDone);
    if (id === 'street-lyceum') return this.day === 2 && !this.lyceumDone;
    return false;
  }

  crossSurfaceDoor(id, options = {}) {
    if (!this.surfaceReady()) return false;
    if (!this.canUseSurfaceDoor(id)) {
      this.notifySurfaceLock(id);
      return false;
    }
    if (id === 'home-exit') return this.goStreet(false, options);
    if (id === 'street-home') return this.goHome(options);
    if (id === 'street-store') return this.goStore(options);
    if (id === 'store-exit') return this.leaveStore(options);
    if (id === 'street-lyceum') return this.enterLyceum(options);
    if (id === 'lyceum-exit') return this.leaveLyceum(options);
    return false;
  }

  leaveStore(options = {}) {
    if (!this.surfaceReady()) return false;
    if (this.cart.length === 0 && !this.storeTripDone) {
      this.notifySurfaceLock('store-exit');
      return false;
    }
    let loot = [];
    if (this.cart.length > 0) {
      loot = this.stashLoot(true);
      this.msg(`Дверь. Никто не крикнул вслед. Добыча: ${loot.join(', ')}.`, 5200);
    }
    this.storeSuspicion = 0;
    this.storeWarned = 0;
    this.ui.setStealth(false, 0, false);
    this.ui.dialogue(null, null, []);
    this.sfx.doorClose(0.7);
    this.phase = 'street';
    return this.goStreet(true, options);
  }

  goStreet(fromStore, options = {}) {
    if (!this.surfaceReady()) return false;
    this.advanceTime(fromStore ? 15 : 20);
    if (fromStore) this.warmth = 100; // в «Бедронке» тепло — выходим согревшимися
    this.surfaceGoto('street', fromStore ? { x: 0, z: -65.55 } : { x: 0, z: 1.45 }, fromStore ? Math.PI : 0, options);
    this.ui.showWarmth(true);
    this.ui.setWarmth(this.warmth);
    this.sfx.roomTone(false);
    if (!fromStore) this.sfx.doorOpen(0.8);
    this.sfx.windStart(0.16);
    this.msg(
      fromStore
        ? 'Обратно — тот же путь. Бочка посередине греет.'
        : (this.day === 2 && !this.lyceumDone
          ? 'Снег по щиколотку. Лицей — справа, за открытой калиткой. Сначала туда, потом в магазин.'
          : 'Снег по щиколотку. До бедронки — прямо, через бочку с огнём.'),
      6000
    );
    return true;
  }

  goHome(options = {}) {
    if (!this.surfaceReady()) return false;
    if (!this.finalDay && (!this.storeTripDone || this.cart.length > 0)) {
      this.notifySurfaceLock('street-home');
      return false;
    }
    this.advanceTime(20);
    this.sfx.windStop();
    this.sfx.doorClose(0.8);
    this.sfx.roomTone(true);
    this.ui.showWarmth(false);
    this.phase = 'day';
    this.surfaceGoto('home', { x: 0, z: -1.5 }, Math.PI, options);
    if (this.storeTripDone && !this.eveningStarted) {
      this.eveningStarted = true;
      this.msg('Дом. Тепло. Дверь в подвал — слева от кухни, под жёлтой лампой и табличкой «ПОДВАЛ». Спать — в спальне, кровать у стены.', 6500);
      this.ui.prompt('[E] у кровати в спальне — лечь спать');
    }
    return true;
  }

  goStore(options = {}) {
    if (!this.surfaceReady()) return false;
    if (this.day === 2 && !this.lyceumDone) {
      this.msg('Сначала лицей. Потом магазин — он не закроется за десять минут.', 4500);
      return;
    }
    this.advanceTime(15);
    this.sfx.windStop();
    this.sfx.shopBell(0.55);
    this.sfx.doorOpen(0.5);
    this.sfx.roomTone(true);
    this.ui.showWarmth(false);
    this.phase = 'store';
    this.surfaceGoto('store', { x: 0, z: 4.55 }, 0, options);
    this.msg('«Бедронка». Людмила за кассой, смотрит в зал — но не всегда. Возьми 1–3 предмета, пока она отвернулась. C — присесть, чтобы быть тише.', 7000);
    return true;
  }

  enterLyceum(options = {}) {
    if (!this.surfaceReady()) return false;
    if (this.day !== 2) {
      this.msg(LYCEUM.closed, 4500);
      return;
    }
    this.lyceumDone = true;
    this.advanceTime(20);
    this.sfx.windStop();
    this.sfx.doorOpen(0.85);
    this.sfx.roomTone(true);
    this.ui.showWarmth(false);
    this.surfaceGoto('lyceum', { x: 0, z: 3.25 }, 0, options);
    this.ui.bigtext(LYCEUM.title, 3600);
    this.msg(LYCEUM.enter, 7000);
    this.after(7.0, () => {
      if (this.app.mode === 'lyceum') this.msg(LYCEUM.echo, 6500);
    });
    this.after(13.8, () => {
      if (this.app.mode === 'lyceum') {
        this.msg(LYCEUM.emptyClass, 6500);
        this.ui.prompt('[E] Парта Хомки — сесть и учиться');
      }
    });
    return true;
  }

  studyLyceum() {
    if (this.lyceumStudied) {
      this.msg(LYCEUM.lessonAgain, 4500);
      return;
    }
    this.lyceumStudied = true;
    this.sfx.step(0.18);
    this.ui.say('УРОК БЕЗ УЧИТЕЛЯ', LYCEUM.lesson, [
      {
        label: 'Остаться до звонка',
        cb: () => {
          this.ui.dialogue(null, null, []);
          this.ui.fade(true);
          this.after(0.85, () => {
            this.ui.fade(false);
            if (this.app.mode !== 'lyceum') return;
            this.advanceTime(45);
            this.sfx.bell();
            this.msg(LYCEUM.lessonStay, 7000);
          });
        }
      },
      {
        label: 'Закрыть тетрадь',
        cb: () => {
          this.ui.dialogue(null, null, []);
          this.msg(LYCEUM.lessonSkip, 6000);
        }
      }
    ]);
  }

  leaveLyceum(options = {}) {
    if (!this.surfaceReady()) return false;
    this.advanceTime(15);
    this.sfx.doorClose(0.85);
    this.sfx.roomTone(false);
    this.surfaceGoto('street', { x: 1.8, z: -22.5 }, Math.PI / 2, options);
    this.ui.showWarmth(true);
    this.ui.setWarmth(this.warmth);
    this.sfx.windStart(0.16);
    this.msg(LYCEUM.leave, 6500);
    this.ui.prompt('Теперь — в «Бедронку».');
    return true;
  }

  goBasement() {
    this.advanceTime(5);
    this.sfx.doorClose(0.6);
    this.sfx.creak(1.3);
    this.sfx.roomTone(false);
    this.app.goto('basement', { x: 0, z: 1.6 }, 0);
    this.syncMineAccess();
    this.msg(this.mineUnlocked && this.phase === 'night'
      ? 'Подвал. Люк у дальней стены открыт. За ним слышна лестница — хотя под домом должна быть только земля.'
      : 'Подвал. Котёл гудит. Сюда Хомка убирает тех, кто фонит.', 6000);
  }

  // ---------- инвентарь и шахта «Величка-6» ----------
  syncMineAccess() {
    if (!this.app.scenes) return;
    const basement = this.app.scenes.basement;
    const open = !!(this.mineUnlocked && (this.phase === 'night' || this.isMineMode()));
    if (basement && basement.setMineHatch) basement.setMineHatch(open);
    for (let level = 1; level <= 4; level++) {
      const sc = this.app.scenes[`mine${level}`];
      if (!sc) continue;
      if (sc.setLamp) sc.setLamp(this.inventory.lamp > 0);
      if (sc.setPower) sc.setPower(this.minePower);
      if (sc.setValve) for (const [id, v] of Object.entries(this.minePressure)) sc.setValve(id, v);
      if (sc.setLevers) sc.setLevers(this.mineLevers);
      if (sc.setPumps) sc.setPumps(this.minePumpsOn, this.minePumpOrder);
      if (sc.setWater) sc.setWater(this.minePumpsOn);
      if (sc.setPressure) sc.setPressure(this.minePressure.valveA, this.minePressure.valveB);
      if (sc.setPressureLock) sc.setPressureLock(this.minePressureOk);
      if (sc.setEchoOpen) sc.setEchoOpen(this.mineEchoSolved);
    }
  }

  syncMineItems() {
    if (!this.app.scenes) return;
    const foreman = this.app.scenes.mine1 && this.app.scenes.mine1.targets.foreman;
    if (foreman) foreman.visible = !this.minerRemembered;
    for (const [id, target] of Object.entries({
      lamp: this.app.scenes.mine1 && this.app.scenes.mine1.targets.lamp,
      key: this.app.scenes.mine1 && this.app.scenes.mine1.targets.key,
      crowbar: this.app.scenes.mine1 && this.app.scenes.mine1.targets.crowbar,
      fuse: this.app.scenes.mine2 && this.app.scenes.mine2.targets.fuse,
      filter2: this.app.scenes.mine2 && this.app.scenes.mine2.targets.filter2,
      filter3: this.app.scenes.mine3 && this.app.scenes.mine3.targets.filter3
    })) {
      if (target) target.visible = !this.mineCollected.has(id);
    }
  }

  getInventory() {
    const out = [
      { id: 'supplies', icon: '▤', name: 'ПРОДОВОЛЬСТВИЕ', count: this.supplies, desc: 'Общие запасы дома. Утром каждый жилец съедает одну порцию. Можно съесть порцию самому, чтобы восстановить сердце.', usable: this.supplies > 0 && this.hearts < 3 },
      { id: 'meds', icon: '✚', name: 'АПТЕЧКА', count: this.meds, desc: 'Бинт, йод и уголь. Утром ускоряет лечение пациентов подвала. Можно использовать на себе.', usable: this.meds > 0 && this.hearts < 3 },
      { id: 'tea', icon: '♨', name: 'ЧАЙ', count: this.tea, desc: 'Крепкий чай Людмилы. Восстанавливает одно сердце, не чаще одного раза в день.', usable: this.tea > 0 && this.hearts < 3 && this.teaUsedDay !== this.day }
    ];
    if (this.hasSocks) out.push({ id: 'socks', icon: '∪', name: 'ШЕРСТЯНЫЕ НОСКИ', count: 1, desc: 'Носки Зоси. Уменьшают потерю тепла на улице на 20%.', usable: false });
    if (this.hasGeiger) out.push({ id: 'geiger', icon: '⌁', name: 'ДОЗИМЕТР', count: 1, desc: 'Позволяет проверять гостей. На глубине молчание прибора не означает безопасность.', usable: false });
    for (const [id, def] of Object.entries(MINE_ITEMS)) {
      const count = this.inventory[id] || 0;
      if (!count) continue;
      out.push({ id, icon: def.icon, name: def.name, count, desc: def.desc, usable: id === 'filter' && this.isMineMode() && this.mineAir < 96 });
    }
    return out;
  }

  useInventory(id) {
    if (id === 'filter') {
      if (!this.isMineMode()) { this.msg('Фильтр пригодится в шахте. На поверхности воздух уже есть.', 3000); return false; }
      if (this.inventory.filter <= 0 || this.mineAir >= 96) return false;
      this.inventory.filter -= 1;
      this.mineAir = Math.min(100, this.mineAir + 55);
      this.sfx.chime();
      this.msg(MINE_TEXT.filterUsed, 4000);
    } else if (['supplies', 'meds', 'tea'].includes(id)) {
      if (this.hearts >= 3 || this[id] <= 0) return false;
      if (id === 'tea' && this.teaUsedDay === this.day) { this.msg(TEXTS.stoveUsed, 3500); return false; }
      this[id] -= 1;
      if (id === 'tea') this.teaUsedDay = this.day;
      this.hearts = Math.min(3, this.hearts + 1);
      this.sfx.chime();
      this.msg(id === 'supplies' ? 'Холодная еда, зато своя. Хомка съедает порцию и чувствует силы.' : id === 'meds' ? 'Бинт затянут, йод жжёт. Сердце продолжает работу.' : TEXTS.stoveTea, 4500);
    } else {
      const def = MINE_ITEMS[id];
      if (def) this.msg(def.desc, 4500);
      else return false;
    }
    this.hud();
    return true;
  }

  addMineItem(id) {
    if (this.mineCollected.has(id)) return false;
    const inventoryId = id === 'filter2' || id === 'filter3' ? 'filter' : id;
    if (!MINE_ITEMS[inventoryId]) return false;
    this.mineCollected.add(id);
    this.inventory[inventoryId] += 1;
    this.syncMineItems();
    this.syncMineAccess();
    this.sfx.chime();
    this.hud();
    this.msg(`${MINE_ITEMS[inventoryId].name} — в инвентарь [I]. ${MINE_ITEMS[inventoryId].desc}`, 6500);
    return true;
  }

  enterMine(level, fromSurface = false) {
    const id = `mine${level}`;
    const sc = this.app.scenes[id];
    if (!sc) return false;
    if (level === 1 && fromSurface && !(this.mineUnlocked && this.phase === 'night')) {
      this.msg(this.day < 3 ? MINE_TEXT.lockedEarly : MINE_TEXT.lockedDay, 6000);
      return false;
    }
    this.sfx.windStop();
    this.sfx.roomTone(false);
    this.ui.showWarmth(false);
    this.mineLevel = level;
    if (fromSurface) this.mineAir = 100;
    sc.setLamp(this.inventory.lamp > 0);
    if (sc.setPower) sc.setPower(this.minePower);
    this.syncMineAccess();
    this.app.goto(id, sc.spawn, 0);
    this.ui.bigtext(`${sc.title}\n${sc.depth}`, 3600);
    this.msg(fromSurface ? `${MINE_TEXT.enter} ${MINE_TEXT[`level${level}`]}` : MINE_TEXT[`level${level}`], 9000);
    if (level === 3) this.sfx.geiger(0.2, 1.8);
    this.advanceTime(level === 1 && fromSurface ? 12 : 18);
    this.ui.setAir(this.mineAir, true);
    if (level === 3 && this.minePressureOk && !this.mineChaseDone) this.after(1.2, () => this.startMineChase());
    return true;
  }

  leaveMine() {
    if (!this.isMineMode()) return;
    if (this.mineLevel === 3) this.stopMineChase(true);
    if (this.mineLevel > 1) { this.enterMine(this.mineLevel - 1); return; }
    this.mineLevel = 0;
    this.mineAir = 100;
    this.ui.setAir(100, false);
    this.app.goto('basement', { x: 0, z: 0.55 }, Math.PI);
    this.sfx.roomTone(false);
    this.msg(MINE_TEXT.returnHome, 6000);
    this.advanceTime(10);
    this.syncMineAccess();
  }

  descendMine() {
    const level = this.mineLevel;
    if (level === 3) this.stopMineChase(true);
    if (level === 1) {
      if (!this.inventory.lamp) { this.msg(MINE_TEXT.noLamp, 4500); return; }
      if (!this.inventory.key) { this.msg(MINE_TEXT.noKey, 4500); return; }
      if (!this.mineGasFixed) { this.msg('Подъёмник заперт газовой перемычкой. Три заслонки у правой стены: ВЕРХ · НИЗ · ВЕРХ.', 6000); return; }
    } else if (level === 2 && !this.minePumpsOn) {
      this.msg('Вода держит клеть. Сначала насосы у левой стены: 1 → 3 → 2.', 6000); return;
    } else if (level === 2 && !this.minePower) {
      this.msg(MINE_TEXT.noPower, 5000); return;
    } else if (level === 3 && !this.minePressureOk) {
      this.msg(`Вентиляция не уравновешена: ${this.minePressure.valveA + this.minePressure.valveB}/5 атм. Выставь оба вентиля и зажми запор у подъёмника.`, 6000); return;
    } else if (level >= 4) {
      this.msg('Ниже только белое. Не геометрия шахты — отсутствие места. Хомка больше не проверяет.', 4500); return;
    }
    this.enterMine(level + 1);
  }

  mineDocument(id) {
    const text = MINE_TEXT[id];
    if (!text) return;
    this.mineRead.add(id);
    this.sfx.whisper();
    this.ui.say('ДОКУМЕНТ ШАХТЫ «В-6»', text, [{ label: '(сложить и запомнить)', cb: () => this.ui.dialogue(null, null, []) }]);
  }

  minePanel() {
    if (this.minePower) { this.msg('Щит гудит ровно. Зелёная лампа показывает: питание идёт вниз.', 3500); return; }
    if (!this.minePumpsOn) { this.msg('Щит мёртв: насосы не запущены. Сначала осуши воду — 1 → 3 → 2.', 5500); return; }
    if (!this.inventory.fuse) { this.msg(MINE_TEXT.noFuse, 5000); return; }
    this.inventory.fuse -= 1;
    this.minePower = true;
    this.syncMineAccess();
    this.advanceTime(10);
    this.sfx.chime();
    this.hud();
    this.ui.say('ЩИТ ГОРИЗОНТА −38 М', MINE_TEXT.powerOn, [{ label: '(к подъёмнику)', cb: () => this.ui.dialogue(null, null, []) }]);
  }

  // Верхний горизонт: три заслонки. Верная комбинация — ВЕРХ · НИЗ · ВЕРХ.
  mineLever(i) {
    if (this.mineGasFixed) { this.msg('Перемычка открыта. Заслонки стоят на упорах.', 3000); return; }
    if (![0, 1, 2].includes(i)) return;
    this.mineLevers[i] = !this.mineLevers[i];
    this.mineLeversTouched.add(i);
    const sc = this.app.scenes.mine1;
    if (sc && sc.setLevers) sc.setLevers(this.mineLevers);
    this.hud();
    if (this.mineLevers[0] && !this.mineLevers[1] && this.mineLevers[2]) {
      this.mineGasFixed = true;
      this.syncMineAccess();
      this.sfx.chime();
      this.ui.bigtext('ПЕРЕМЫЧКА ОТКРЫТА', 2400);
      this.msg('Газ ушёл в старую выработку. Подъёмник вниз свободен — если в кармане лампа и ключ сменщика.', 7000);
      return;
    }
    if (this.mineLeversTouched.size === 3) {
      this.mineAir = Math.max(1, this.mineAir - 4);
      this.mineLevers = [false, false, false];
      this.mineLeversTouched.clear();
      this.syncMineAccess();
      this.hud();
      this.sfx.creak(1.1);
      this.msg('Смесь пошла в лицо. Заслонки сорвало вниз. Воздух −4. Смотри на щит: ВЕРХ · НИЗ · ВЕРХ.', 6500);
      return;
    }
    this.sfx.beep();
    this.msg(`Заслонка ${i + 1}: ${this.mineLevers[i] ? 'ВЕРХ' : 'НИЗ'}. Нужно три положения.`, 3000);
  }

  // Затопленный горизонт: насосы запускаются строго 1 → 3 → 2.
  minePump(i) {
    if (this.minePumpsOn) { this.msg('Насосы работают. Вода уже ниже настила.', 3000); return; }
    const expected = [0, 2, 1];
    this.minePumpOrder.push(i);
    const prefixOk = this.minePumpOrder.every((v, k) => expected[k] === v);
    const sc = this.app.scenes.mine2;
    if (!prefixOk) {
      this.minePumpOrder = [];
      this.mineAir = Math.max(1, this.mineAir - 5);
      if (sc) { sc.setPumps(false, []); sc.setWater(false); }
      this.hud();
      this.sfx.creak(1.2);
      this.msg('Не тот насос. Вода ударила обратно, воздух −5. Порядок: 1 → 3 → 2.', 5500);
      return;
    }
    if (this.minePumpOrder.length === 3) {
      this.minePumpsOn = true;
      if (sc) { sc.setPumps(true, []); sc.setWater(true); }
      this.syncMineAccess();
      this.sfx.chime();
      this.ui.bigtext('ВОДА УХОДИТ', 2400);
      this.msg('Три насоса взяли. Вода уходит в старую штольню, щит у дальней стены больше не залит.', 6500);
      return;
    }
    if (sc) sc.setPumps(false, this.minePumpOrder);
    this.sfx.beep();
    this.msg(`Насос ${i + 1} взял. Следующий — ${expected[this.minePumpOrder.length] + 1}.`, 3500);
  }

  // Чёрный горизонт: давление. Вентили выставляют 0–3, запор фиксирует сумму 5.
  minePressureValve(id) {
    if (!['valveA', 'valveB'].includes(id)) return;
    if (this.minePressureOk) { this.msg('Вентиляция заперта. Стрелки стоят на пяти.', 3000); return; }
    const current = this.minePressure[id] || 0;
    this.minePressure[id] = (current + 1) % 4;
    const a = this.minePressure.valveA;
    const b = this.minePressure.valveB;
    if (a > 0) this.mineValves.add('valveA'); else this.mineValves.delete('valveA');
    if (b > 0) this.mineValves.add('valveB'); else this.mineValves.delete('valveB');
    const sc = this.app.scenes.mine3;
    if (sc) {
      sc.setValve(id, this.minePressure[id]);
      sc.setPressure(a, b);
    }
    this.hud();
    this.sfx.beep();
    this.msg(`Вентиль ${id === 'valveA' ? 'A' : 'B'}: ${this.minePressure[id]} атм. Сумма ${a + b}/5. Запор — у подъёмника.`, 3500);
  }

  minePressureLock() {
    if (this.minePressureOk) { this.msg('Вентиляция уже заперта на пяти. Горизонт дышит.', 3000); return; }
    const a = this.minePressure.valveA;
    const b = this.minePressure.valveB;
    const sum = a + b;
    if (a > 0 && b > 0 && sum === 5) {
      this.minePressureOk = true;
      this.syncMineAccess();
      this.sfx.chime();
      this.ui.bigtext('ВЕНТИЛЯЦИЯ ЗАПЕРТА', 2400);
      this.msg('Запор щёлкнул: 5 атм, оба вентиля держат. Чёрный горизонт дышит, подъёмник вниз открыт.', 6500);
      this.after(2.2, () => this.startMineChase());
      return;
    }
    if (sum > 5) {
      this.mineAir = Math.max(1, this.mineAir - 8);
      this.sfx.creak(1.15);
      this.hud();
      this.msg(`Перебор: ${a}+${b}=${sum} атм. Клапан сорвало, воздух −8. Нужно ровно 5 и оба вентиля.`, 6000);
      return;
    }
    this.sfx.creak(0.9);
    this.msg(`Мало давления: ${a}+${b}=${sum}/5. Запор не держит. Крути вентили дальше.`, 4500);
  }

  // ---------- погоня белого хомяка (чёрный горизонт) ----------
  startMineChase() {
    if (this.mineLevel !== 3 || this.mineChaseDone || this.mineChase) return false;
    const sc = this.app.scenes.mine3;
    if (!sc || !sc.startChase) return false;
    this.mineChase = true;
    this.mineHidden = false;
    this.mineHideIndex = -1;
    this.mineChaseGrace = 1.2;
    sc.startChase();
    this.sfx.roar(1.0);
    this.sfx.heartbeats(1, 1.35);
    this.ui.bigtext('ОНО ПРОСНУЛОСЬ', 2800);
    this.msg('Из глубины поднимается белое. Слишком большое для хомяка. Беги к лестнице: двери можно захлопнуть, в шкафах — переждать.', 8500);
    const v = document.getElementById('chase-vignette');
    if (v) v.classList.remove('hidden');
    this.hud();
    return true;
  }

  stopMineChase(done = false) {
    const sc = this.app.scenes.mine3;
    if (sc && sc.stopChase) sc.stopChase();
    this.mineChase = false;
    this.mineHidden = false;
    this.mineHideIndex = -1;
    this.sfx.stopHeartbeat();
    const v = document.getElementById('chase-vignette');
    if (v) v.classList.add('hidden');
    if (done) this.mineChaseDone = true;
    if (this.mineLevel === 3) this.ui.prompt(null);
  }

  mineHide(i) {
    if (this.mineLevel !== 3) return;
    const sc = this.app.scenes.mine3;
    if (!sc) return;
    if (this.mineHidden) { this.unhideMine(); return; }
    this.mineHidden = true;
    this.mineHideIndex = i;
    if (sc.setChaseHidden) sc.setChaseHidden(true);
    if (sc.setChaseLocker) sc.setChaseLocker(i, true);
    this.sfx.doorClose(0.35);
    this.ui.prompt('[E] Выйти из шкафа');
    this.msg('Шкаф пахнет ржавчиной и старой одеждой. Снаружи — шаги. Не дыши.', 6000);
    this.hud();
  }

  unhideMine() {
    const sc = this.app.scenes.mine3;
    if (sc) {
      if (sc.setChaseHidden) sc.setChaseHidden(false);
      if (sc.setChaseLocker && this.mineHideIndex >= 0) sc.setChaseLocker(this.mineHideIndex, false);
    }
    this.mineHidden = false;
    this.mineHideIndex = -1;
    this.sfx.doorOpen(0.3);
    this.msg('Хомка вылез из шкафа. Коридор пуст — но это ничего не значит.', 3500);
    this.ui.prompt(null);
    this.hud();
  }

  mineChaseDoor(id) {
    const sc = this.app.scenes.mine3;
    if (!sc || !sc.setChaseDoor) return;
    const closed = sc.isChaseDoorClosed(id);
    sc.setChaseDoor(id, !closed);
    if (closed) this.sfx.doorOpen(0.7); else this.sfx.doorClose(0.85);
    this.msg(closed
      ? 'Створка пошла вверх. Проход открыт — и для Хомки, и для того, что идёт следом.'
      : 'Тяжёлая створка рухнула. Оно задержит его на пару секунд — не больше.', 5000);
  }

  mineCaught() {
    if (!this.mineChase) return;
    this.mineChaseGrace = 3.0;
    this.hearts -= 1;
    this.sfx.roar(1.0);
    this.ui.bigtext('ОНО ДОГНАЛО', 1800);
    this.hud();
    if (this.hearts <= 0) { this.gameOver('hamster'); return; }
    this.stopMineChase(false);
    this.msg('Белая шерсть прошла сквозь Хомку. Он очнулся у лестницы: сердце −1, лампа цела. Оно ещё здесь.', 7500);
    this.app.goto('mine3', this.app.scenes.mine3.spawn, 0);
    this.after(2.6, () => { if (this.mineLevel === 3 && !this.mineChaseDone) this.startMineChase(); });
  }

  // Нулевой горизонт: эхо. Сначала слушаем пульт, затем повторяем четырьмя плитами.
  mineEchoListen() {
    if (this.mineEchoSolved) { this.msg('Эхо уже совпало. Шов открыт.', 3000); return; }
    if (this.mineEchoPlaying) return;
    const seq = [2, 0, 3, 1];
    this.mineEchoSeq = seq;
    this.mineEchoInput = [];
    this.mineEchoPlaying = true;
    const sc = this.app.scenes.mine4;
    this.msg('Слушай: четыре удара. Потом повтори их плитами.', 4500);
    seq.forEach((plate, i) => this.after(0.8 + i * 0.85, () => {
      if (sc && sc.pulseEcho) sc.pulseEcho(plate);
      if (this.sfx.echoTone) this.sfx.echoTone(plate);
    }));
    this.after(0.8 + seq.length * 0.85, () => {
      this.mineEchoPlaying = false;
      this.msg('Эхо кончилось. Теперь плиты: та же последовательность.', 4500);
    });
  }

  mineEchoPlate(i) {
    if (this.mineEchoSolved) { this.msg('Шов открыт. Плиты молчат.', 2500); return; }
    if (this.mineEchoPlaying) { this.msg('Не перебивай эхо. Дослушай.', 2200); return; }
    if (!this.mineEchoSeq.length) { this.msg('Сначала послушай эхо у пульта у входа.', 3500); return; }
    const sc = this.app.scenes.mine4;
    if (sc && sc.pulseEcho) sc.pulseEcho(i);
    if (this.sfx.echoTone) this.sfx.echoTone(i);
    this.mineEchoInput.push(i);
    const k = this.mineEchoInput.length - 1;
    if (this.mineEchoSeq[k] !== i) {
      this.mineEchoInput = [];
      this.mineAir = Math.max(1, this.mineAir - 6);
      this.sfx.creak(1.1);
      this.hud();
      this.msg('Не тот удар. Эхо сбилось, воздух −6. Послушай пульт ещё раз.', 5000);
      return;
    }
    if (this.mineEchoInput.length === this.mineEchoSeq.length) {
      this.mineEchoSolved = true;
      this.syncMineAccess();
      this.sfx.chime();
      this.ui.bigtext('ЭХО СОВПАЛО', 2600);
      this.msg('Четыре плиты ответили в один голос. Белый шов раскрылся — можно коснуться.', 6500);
      return;
    }
    this.msg(`Плита ${i + 1}. Эхо держится: ${this.mineEchoInput.length}/${this.mineEchoSeq.length}.`, 2500);
  }

  talkMiner() {
    const build = () => {
      const choices = [];
      MINER_DIALOGUE.questions.forEach((entry, i) => {
        if (!this.mineAsked.has(i)) choices.push({ label: `— ${entry.q}`, cb: () => {
          this.mineAsked.add(i);
          this.sfx.chime();
          this.ui.say('СТЕФАН · СМЕНЩИК', entry.a, build());
        } });
      });
      if (this.mineResolved && !this.minerRemembered) choices.push({ label: '— Я был в нулевом. Смена закончилась.', cb: () => {
        this.minerRemembered = true;
        this.hearts = Math.min(3, this.hearts + 1);
        this.syncMineItems();
        this.hud();
        this.ui.say('СТЕФАН · СМЕНЩИК', MINER_DIALOGUE.remembered, [{ label: '(отпустить смену)', cb: () => {
          this.ui.dialogue(null, null, []);
          const target = this.app.scenes.mine1.targets.foreman;
          if (target) target.visible = false;
          this.msg(MINE_TEXT.foremanGone, 6500);
        } }]);
      } });
      choices.push({ label: '(отойти)', cb: () => { this.ui.dialogue(null, null, []); this.msg(MINER_DIALOGUE.farewell, 6500); } });
      return choices;
    };
    this.ui.say('СТЕФАН · СМЕНЩИК', MINER_DIALOGUE.intro, build());
  }

  talkCore() {
    if (!this.mineEchoSolved) {
      this.msg('Белый шов не отвечает. Четыре эхо-плиты ждут, пока Хомка повторит порядок. Пульт — у входа на горизонт.', 6500);
      return;
    }
    if (this.mineResolved) {
      this.ui.say('НУЛЕВОЙ ГОРИЗОНТ', this.mineChoice === 'echo' ? CORE_DIALOGUE.echo : CORE_DIALOGUE.sealed, [{ label: '(отойти)', cb: () => this.ui.dialogue(null, null, []) }]);
      return;
    }
    const build = () => {
      const choices = [];
      CORE_DIALOGUE.questions.forEach((entry, i) => {
        if (!this.coreAsked.has(i)) choices.push({ label: `— ${entry.q}`, cb: () => {
          this.coreAsked.add(i);
          this.sfx.whisper();
          this.ui.say('ГОЛОС ПОД ВЕЛИЧКОЙ', entry.a, build());
        } });
      });
      choices.push({ label: 'ЗАБРАТЬ БЕЛЫЙ ОСКОЛОК', cls: 'decide-open', cb: () => this.resolveMine('echo') });
      if (this.inventory.crowbar) choices.push({ label: 'ЛОМОМ ЗАКРЫТЬ НУЛЕВОЙ СТВОЛ', cls: 'decide-close', cb: () => this.resolveMine('sealed') });
      choices.push({ label: '(пока не решать)', cb: () => this.ui.dialogue(null, null, []) });
      return choices;
    };
    this.sfx.heartbeats(2, 1.5);
    this.ui.say('ГОЛОС ПОД ВЕЛИЧКОЙ', CORE_DIALOGUE.intro, build());
  }

  resolveMine(choice) {
    if (this.mineResolved) return;
    this.mineResolved = true;
    this.mineChoice = choice;
    if (choice === 'echo') {
      this.inventory.echo = 1;
      this.flags.mineTruth = 1;
    } else {
      this.flags.mineSealed = 1;
      this.hearts = Math.min(3, this.hearts + 1);
    }
    this.mineAir = 100;
    this.sfx.chime();
    this.hud();
    this.ui.say('РЕШЕНИЕ ХОМКИ', choice === 'echo' ? CORE_DIALOGUE.echo : CORE_DIALOGUE.sealed, [{ label: '(вернуться к лестнице)', cb: () => {
      this.ui.dialogue(null, null, []);
      this.msg('Теперь можно подниматься. Ночь наверху ещё не закончилась.', 5000);
    } }]);
  }

  getMineInteractables() {
    const sc = this.app.scenes[this.app.mode];
    if (!sc) return [];
    const a = sc.anchors, t = sc.targets, out = [];
    if (this.mineHidden) {
      const i = this.mineHideIndex;
      const lockerA = a['locker' + i];
      const lockerT = t['locker' + i];
      return lockerA ? [{ ...lockerA, target: lockerT, label: '[E] Выйти из шкафа', action: () => this.unhideMine() }] : [];
    }
    out.push({ ...a.up, target: t.up, label: this.mineLevel === 1 ? '[E] Подняться в подвал' : `[E] Вернуться на горизонт ${this.mineLevel - 1}`, action: () => this.leaveMine() });
    if (this.mineLevel < 4) {
      let label = '[E] Спуститься глубже';
      if (this.mineLevel === 1 && (!this.inventory.lamp || !this.inventory.key)) label = '[E] Подъёмник — лампа и ключ сменщика';
      else if (this.mineLevel === 1 && !this.mineGasFixed) label = '[E] Подъёмник — газовая перемычка';
      if (this.mineLevel === 2 && !this.minePumpsOn) label = '[E] Подъёмник — вода, насосы 1 → 3 → 2';
      else if (this.mineLevel === 2 && !this.minePower) label = '[E] Подъёмник — нет питания';
      if (this.mineLevel === 3 && !this.minePressureOk) label = `[E] Подъёмник — давление ${this.minePressure.valveA + this.minePressure.valveB}/5, зажми запор`;
      out.push({ ...a.down, target: t.down, label, action: () => this.descendMine() });
    }
    const names = {
      lamp: 'Взять карбидную лампу', key: 'Взять ключ сменщика', crowbar: 'Взять шахтёрский лом',
      fuse: 'Взять керамический предохранитель', filter2: 'Взять фильтр респиратора', filter3: 'Взять фильтр респиратора',
      shiftLog: 'Нарядная книга смены 6', townMap: 'План жилого кольца', floodNote: 'Отчёт гидролога',
      krakowOrder: 'Приказ гуманитарной колонны', blackNote: 'Записка шахтного врача', namesNote: 'Список меняющейся смены',
      zeroNote: 'Последняя страница Стефана', lastLetter: 'Непочтовый конверт Марека'
    };
    for (const [id, name] of Object.entries(names)) {
      if (!a[id] || !t[id]) continue;
      if (this.mineCollected.has(id)) continue;
      const isDocument = !MINE_ITEMS[id] && id !== 'filter2' && id !== 'filter3';
      out.push({ ...a[id], target: t[id], label: `[E] ${isDocument ? 'Читать: ' : ''}${name}`, action: () => isDocument ? this.mineDocument(id) : this.addMineItem(id) });
    }
    if (a.foreman && t.foreman && t.foreman.visible) out.push({ ...a.foreman, target: t.foreman, label: '[E] Поговорить со сменщиком Стефаном', action: () => this.talkMiner() });
    if (a.panel) out.push({ ...a.panel, target: t.panel, label: this.minePower ? '[E] Щит — питание включено' : this.minePumpsOn ? '[E] Открыть электрический щит' : '[E] Щит — сначала осушить воду насосами', action: () => this.minePanel() });
    if (this.mineLevel === 1) {
      for (let i = 0; i < 3; i++) {
        const id = 'lever' + i;
        if (!a[id]) continue;
        out.push({ ...a[id], target: t[id], label: this.mineGasFixed ? `[E] Заслонка ${i + 1} — в норме` : `[E] Заслонка ${i + 1}: ${this.mineLevers[i] ? 'ВЕРХ' : 'НИЗ'} · нужно ВЕРХ·НИЗ·ВЕРХ`, action: () => this.mineLever(i) });
      }
    }
    if (this.mineLevel === 2) {
      for (let i = 0; i < 3; i++) {
        const id = 'pump' + (i + 1);
        if (!a[id]) continue;
        const started = this.minePumpsOn || this.minePumpOrder.includes(i);
        out.push({ ...a[id], target: t[id], label: started ? `[E] Насос ${i + 1} — работает` : `[E] Запустить насос ${i + 1}`, action: () => this.minePump(i) });
      }
    }
    for (const id of ['valveA', 'valveB']) {
      if (!a[id]) continue;
      const v = this.minePressure[id] || 0;
      out.push({ ...a[id], target: t[id], label: this.minePressureOk ? `[E] Вентиль ${id === 'valveA' ? 'A' : 'B'} — 5 атм` : `[E] Вентиль ${id === 'valveA' ? 'A' : 'B'}: ${v} атм · провернуть`, action: () => this.minePressureValve(id) });
    }
    if (a.pressureLock) {
      out.push({ ...a.pressureLock, target: t.pressureLock, label: this.minePressureOk ? '[E] Запор давления — заперт на 5' : `[E] Зажать запор давления (${this.minePressure.valveA + this.minePressure.valveB}/5)`, action: () => this.minePressureLock() });
    }
    if (a.echoPanel) out.push({ ...a.echoPanel, target: t.echoPanel, label: this.mineEchoSolved ? '[E] Пульт эха — шов открыт' : '[E] Пульт эха — послушать порядок', action: () => this.mineEchoListen() });
    for (let i = 0; i < 4; i++) {
      const id = 'echo' + i;
      if (!a[id]) continue;
      out.push({ ...a[id], target: t[id], label: this.mineEchoSolved ? `[E] Эхо-плита ${i + 1} — совпала` : `[E] Эхо-плита ${i + 1}`, action: () => this.mineEchoPlate(i) });
    }
    if (a.core) out.push({ ...a.core, target: t.core, label: this.mineResolved ? '[E] Нулевой горизонт — решение принято' : this.mineEchoSolved ? '[E] Коснуться белого света' : '[E] Белый шов — сначала повтори эхо', action: () => this.talkCore() });
    if (this.mineLevel === 3) {
      for (let i = 0; i < 3; i++) {
        const la = a['locker' + i];
        if (!la) continue;
        out.push({ ...la, target: t['locker' + i], label: '[E] Спрятаться в шкаф', action: () => this.mineHide(i) });
      }
      for (const id of ['doorA', 'doorB']) {
        if (!a[id]) continue;
        const closed = sc.isChaseDoorClosed ? sc.isChaseDoorClosed(id) : false;
        out.push({ ...a[id], target: t[id], label: closed ? '[E] Поднять тяжёлую дверь' : '[E] Захлопнуть тяжёлую дверь', action: () => this.mineChaseDoor(id) });
      }
    }
    return out;
  }

  // ---------- магазин ----------
  updateCart() {
    this.ui.setCart(
      this.cart.length,
      0,
      this.app.mode === 'store' && this.phase !== 'done',
      STORE_DAILY_LIMIT
    );
  }

  // Видит ли Людмила Хомку прямо сейчас (сектор + укрытия в store.js).
  storeSightNow() {
    if (this.app.mode !== 'store') return false;
    const so = this.app.scenes && this.app.scenes.store;
    const st = so && so.stealth;
    if (!st) return false;
    const cam = this.app.camera.position;
    return st.sees(cam.x, cam.z);
  }

  // Выложить добычу в дом: предметы превращаются в запасы, лекарства, носки.
  stashLoot(silent = false) {
    const got = [];
    let flavor = '';
    for (const k of this.cart) {
      const it = ITEMS[k];
      if (!it) continue;
      this.supplies += it.supplies || 0;
      if (it.meds) this.meds += it.meds;
      if (it.heals) this.tea += it.heals;
      if (it.gear === 'socks') { this.hasSocks = true; flavor += ' Носки шерстяные — дорога станет теплей.'; }
      if (it.gear === 'geiger') { this.hasGeiger = true; flavor += ' Дозиметр — это глаза, у которых нет мнения.'; }
      if (k === 'matches') flavor += ' Спички оставь себе, Хомка. Своим — они дороже.';
      got.push(it.name.toLowerCase());
      this.storePurchased.add(k);
    }
    this.cart = [];
    this.storeTripDone = true;
    this.storeSuspicion = 0;
    this.storeWarned = 0;
    this.syncStoreItems();
    this.hud();
    if (!silent) this.msg(`В карманах: ${got.join(', ')}.${flavor}`, 5200);
    return got;
  }

  // Попалась: Людмила отбирает всё и выставляет к двери. День продолжается.
  caughtStealing() {
    const got = this.cart.map((k) => ITEMS[k] && ITEMS[k].name.toLowerCase()).filter(Boolean);
    this.cart = [];
    this.storeCaught += 1;
    this.storeSuspicion = 0;
    this.storeWarned = 0;
    this.storeSeen = false;
    this.syncStoreItems();
    this.updateCart();
    this.hud();
    this.sfx.alert(1);
    this.phase = 'caught';
    const cam = this.app.camera;
    cam.position.set(0, 1.62, 4.45);
    cam.rotation.set(0, Math.PI, 0);
    this.ui.bigtext('ПОЙМАНА', 2100);
    this.ui.say('Людмила', `Так. ${got.length ? `«${got.join(', ')}» — обратно на полку. ` : ''}Я бы тебе и так всё отдала, Хомка. Зачем ты как вор? Иди, я не видела. И больше не при ней.`, [
      { label: '(виновато отойти)', cb: () => { this.ui.dialogue(null, null, []); this.phase = 'store'; } }
    ]);
  }

  storeSuspicionStep(dt) {
    if (this.app.mode !== 'store' || this.phase !== 'store') return;
    const so = this.app.scenes.store;
    const st = so && so.stealth;
    if (!st) return;
    const cam = this.app.camera.position;
    const seen = st.sees(cam.x, cam.z);
    this.storeSeen = seen;
    const carrying = this.cart.length > 0;
    if (seen && carrying) {
      const dist = Math.hypot(cam.x - st.eye.x, cam.z - st.eye.z);
      const near = dist < 3.2 ? 1.35 : 1;
      const crouch = this.app.crouched ? 0.5 : 1;
      const rate = 21 * crouch * (1 + this.storeCaught * 0.3) * near;
      this.storeSuspicion = Math.min(100, this.storeSuspicion + rate * dt);
    } else if (seen) {
      this.storeSuspicion = Math.max(0, this.storeSuspicion - 8 * dt);
    } else {
      this.storeSuspicion = Math.max(0, this.storeSuspicion - 15 * dt);
    }
    st.setAlert(this.storeSuspicion / 100);
    this.ui.setStealth(seen, this.storeSuspicion, carrying);
    if (this.storeSuspicion >= 100) { this.caughtStealing(); return; }
    if (this.storeSuspicion > 78 && this.storeWarned < 2) {
      this.storeWarned = 2;
      this.sfx.alert(0.8);
      this.msg('Людмила: «Хомка, ты что это делаешь?»', 2600);
    } else if (this.storeSuspicion > 52 && this.storeWarned < 1) {
      this.storeWarned = 1;
      this.sfx.alert(0.45);
      this.msg('Людмила хмурится: «Хомка?..»', 2600);
    }
  }

  syncStoreItems() {
    const so = this.app.scenes && this.app.scenes.store;
    if (!so || !so.targets) return;
    for (const key of Object.keys(ITEMS)) {
      const target = so.targets[key];
      if (!target) continue;
      const owned = (key === 'socks' && this.hasSocks) || (key === 'geiger' && this.hasGeiger);
      target.visible = !owned && !this.storePurchased.has(key) && !this.cart.includes(key);
    }
  }

  pickup(itemKey) {
    const item = ITEMS[itemKey];
    if (!item || this.cart.includes(itemKey) || this.storePurchased.has(itemKey)) return false;
    if (this.storeTripDone) { this.msg('На сегодня хватит: карманы уже набиты, иди домой.', 3000); return false; }
    if (item.gear === 'socks' && this.hasSocks) { this.msg('Носки уже на ногах. Вторая пара — роскошь.', 3000); return false; }
    if (item.gear === 'geiger' && this.hasGeiger) { this.msg('Дозиметр уже в кармане. Он уже щёлкает.', 3000); return false; }
    if (this.cart.length >= STORE_DAILY_LIMIT) {
      this.msg(`Больше ${STORE_DAILY_LIMIT} за раз не унести. Выходи с добычей.`, 3200);
      return false;
    }
    const seen = this.storeSightNow();
    this.cart.push(itemKey);
    this.syncStoreItems();
    this.updateCart();
    if (seen) {
      this.storeSuspicion = Math.min(100, this.storeSuspicion + 44);
      this.sfx.alert(0.7);
      this.msg(`${item.name} — в кармане. Но она смотрит прямо на тебя!`, 2600);
      if (this.storeSuspicion >= 100) { this.caughtStealing(); return false; }
    } else {
      this.sfx.beep();
      this.msg(`${item.name} — за пазуху. ${this.cart.length}/${STORE_DAILY_LIMIT} · [Q] вернуть · уходи, пока не заметила`, 3200);
    }
    return true;
  }

  returnItem(itemKey = null) {
    if (this.cart.length === 0) {
      this.msg('Корзина пуста. Сначала возьми товар кнопкой [E].', 2500);
      return false;
    }
    const key = itemKey && this.cart.includes(itemKey) ? itemKey : this.cart[this.cart.length - 1];
    const index = this.cart.lastIndexOf(key);
    if (index < 0) return false;
    this.cart.splice(index, 1);
    this.syncStoreItems();
    this.updateCart();
    this.sfx.beep();
    this.msg(`${ITEMS[key].name} — обратно на полку. В карманах: ${this.cart.length}/${STORE_DAILY_LIMIT}`, 3000);
    return true;
  }

  lyudmilaTalk() {
    const l = LYUDMILA[this.day - 1];
    this.shopTopic = 0;
    const build = () => {
      const choices = [];
      if (this.day >= 3 && this.shopMineStage === 0) {
        choices.push({ label: `— ${LYUDMILA_MINE.question}`, cb: () => {
          this.shopMineStage = 1;
          this.sfx.whisper();
          this.ui.say('Людмила', LYUDMILA_MINE.text, build());
        } });
      } else if (this.day >= 3 && this.shopMineStage === 1) {
        choices.push({ label: '— Кто такой Стефан? И при чём тут Марек?', cb: () => {
          this.shopMineStage = 2;
          this.sfx.chime();
          this.ui.say('Людмила', LYUDMILA_MINE.follow, build());
        } });
      }
      if (this.mineResolved && this.shopMineStage >= 2 && this.shopMineStage < 3) {
        choices.push({ label: '— Я был на нулевом горизонте.', cb: () => {
          this.shopMineStage = 3;
          this.sfx.whisper();
          this.ui.say('Людмила', this.mineChoice === 'echo' ? LYUDMILA_MINE.afterEcho : LYUDMILA_MINE.afterSeal, build());
        } });
      }
      if (this.shopTopic < l.topics.length) {
        choices.push({ label: '(слушать)', cb: () => { this.sfx.chime(); this.ui.say('Людмила', l.topics[this.shopTopic++], build()); } });
      }
      choices.push({ label: '(уйти)', cb: () => { this.ui.dialogue(null, null, []); this.phase = 'store'; } });
      return choices;
    };
    this.phase = 'shoptalk';
    this.ui.say('Людмила', l.hello, build());
  }

  // Старое имя оставлено для внешних проверок: теперь это просто «выложить добычу».
  checkout() {
    if (this.cart.length === 0) return false;
    this.stashLoot(false);
    return true;
  }

  shopBack() {
    return [{ label: '(уйти)', cb: () => {
      this.ui.dialogue(null, null, []);
      this.phase = 'store';
      this.ui.prompt(this.storeTripDone
        ? `Добыча в карманах: ${this.storePurchased.size}/${STORE_DAILY_LIMIT}. Иди к двери, пока Людмила не передумала.`
        : this.cart.length > 0
          ? 'Выйди через дверь с добычей — или верни лишнее [Q] / «ВЕРНУТЬ».'
          : `Возьми 1–${STORE_DAILY_LIMIT} предмета, пока Людмила не смотрит.`);
    } }];
  }

  // ---------- концовки ----------
  finalEnding() {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    const f = this.flags;
    let key;
    if (f.shotInnocents >= 2) key = 'executioner';
    else if (f.marek === 'shot') key = 'marekShot';
    else if (this.mineChoice === 'echo') key = 'deepEcho';
    else if (this.mineChoice === 'sealed') key = 'deepSeal';
    else if (f.marek === 'alive') key = 'secret';
    else if (f.shotInnocents === 0 && f.cured >= 2 && f.keptVel >= 3) key = 'good';
    else key = 'ok';
    this.after(2, () => this.gameOver(key));
  }

  gameOver(key) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.clearTimers();
    this.sfx.stopHeartbeat();
    this.sfx.windStop();
    this.ui.showWarmth(false);
    this.ui.setAir(0, false);
    this.app.setMode('cut');
    this.app.unlockPointer();
    const e = ENDINGS[key] || MINE_ENDINGS[key];
    this.ui.showGameOver(e.title, e.text, () => this.restart());
  }

  restart() {
    // убрать всех персонажей
    for (const r of this.residents) disposeHumanoid(r.rig);
    for (const p of this.patients) disposeHumanoid(p.rig);
    for (const w of this.walkers) disposeHumanoid(w.rig);
    if (this.doorGuest) this.doorGuest = null;
    this.clearDoorVisitor();
    this.ui.hideGameOver();
    this.ui.dialogue(null, null, []);
    this.usedSpots.clear();
    this.start();
  }

  // ---------- интерактивы ----------
  // ---------- список дел (TAB) ----------
  // ---------- полевой архив: находки не меняют экономику и основные концовки ----------
  discoverSecret(id) {
    const entry = this.app.worldExpansion && this.app.worldExpansion.secrets[id];
    const def = SECRET_BY_ID[id];
    if (!entry || !def || this.app.mode !== def.scene) return false;
    const first = !this.secretFound.has(id);
    this.secretFound.add(id);
    this.secretLast = id;
    this.app.worldExpansion.syncFound(this.secretFound);
    if (first) this.sfx.chime();
    else this.sfx.whisper();
    const complete = this.secretFound.size === SECRET_DEFS.length;
    const ending = complete
      ? '\n\nАрхив сошёлся. Все десять записей описывают одну квартиру с разных сторон. На нулевом горизонте дверной шов стал ярче: теперь он знает, что Хомка читал.'
      : '';
    this.ui.say(
      `${def.title} · АРХИВ ${this.secretFound.size}/${SECRET_DEFS.length}`,
      def.text + ending,
      [{ label: first ? '(сделать запись и отойти)' : '(закрыть запись)', cb: () => this.ui.dialogue(null, null, []) }]
    );
    return first;
  }

  getSecretInteractables(mode) {
    if (!this.app.worldExpansion) return [];
    const out = [];
    for (const def of SECRET_DEFS) {
      if (def.scene !== mode) continue;
      const entry = this.app.worldExpansion.secrets[def.id];
      if (!entry || !entry.target) continue;
      const found = this.secretFound.has(def.id);
      out.push({
        x: entry.x, z: entry.z, r: entry.r,
        target: entry.target,
        secretId: def.id,
        label: found ? `[E] Перечитать: ${def.title}` : `[E] ${def.label}`,
        action: () => this.discoverSecret(def.id)
      });
    }
    return out;
  }

  getTasks() {
    const out = [];
    if (this.phase === 'done') { out.push({ text: 'Смена закончена. Можно начать заново.', done: true }); return out; }
    if (this.phase === 'night') {
      out.push({ text: 'Ночь ' + this.day + ': не открывать чужим' });
      out.push({ text: 'Впустить своих — разобраться днём' });
      if (this.mineUnlocked) {
        out.push({ text: this.mineResolved ? 'Шахта «В-6»: решение принято' : 'Шахта: люк в подвале открыт [I] — инвентарь', done: this.mineResolved });
        if (!this.mineResolved && this.mineLevel > 0) out.push({ text: `Горизонт ${this.mineLevel}/4 · воздух ${Math.ceil(this.mineAir)}%` });
        if (this.mineLevel === 1 && !this.mineGasFixed) out.push({ text: 'Верхний горизонт: заслонки ВЕРХ · НИЗ · ВЕРХ' });
        if (this.mineLevel === 2 && !this.minePumpsOn) out.push({ text: 'Затопленный горизонт: насосы 1 → 3 → 2' });
        else if (this.mineLevel === 2 && !this.minePower) out.push({ text: 'Затопленный горизонт: вставить предохранитель в щит' });
        if (this.mineLevel === 3 && !this.minePressureOk) out.push({ text: `Чёрный горизонт: выставить 5 атм и зажать запор (${this.minePressure.valveA + this.minePressure.valveB}/5)` });
        if (this.mineLevel === 4 && !this.mineEchoSolved) out.push({ text: 'Нулевой горизонт: послушать эхо и повторить четырьмя плитами' });
        if (this.mineChase) out.push({ text: this.mineHidden ? 'В шкафу: переждать и выйти' : 'БЕЛОЕ ИДЁТ: беги к лестнице, закрывай двери, прячься в шкафах' });
      }
      out.push({ text: 'Дожить до утра' });
      return out;
    }
    if (this.pending.length) out.push({ text: 'Поговорить с гостями [E] — ' + this.pending.length + ' шт.' });
    if (this.day === 2 && !this.lyceumDone) out.push({ text: 'Сходить в лицей на занятия' });
    const storeCount = this.cart.length;
    if (!this.storeTripDone) {
      out.push({ text: storeCount > 0
        ? `Уйти из «Бедронки» с добычей: ${storeCount}/${STORE_DAILY_LIMIT} · не попасться Людмиле`
        : `«Бедронка»: взять 1–${STORE_DAILY_LIMIT} предмета, пока Людмила не смотрит` });
      out.push({ text: 'Шкала ВНИМАНИЕ заполнится — она отберёт всё и выставит к двери. C — присесть и идти тише.' });
      if (storeCount > 0) out.push({ text: 'Вернуть лишнее — [Q] / «ВЕРНУТЬ». Выйти можно только с 1–3 предметами.' });
    } else {
      out.push({ text: `Добыча в карманах · ${this.storePurchased.size}/${STORE_DAILY_LIMIT}. Вернуться домой и лечь спать [E]` });
    }
    if (this.hearts < 3 && this.tea > 0) out.push({ text: 'Заварить чай [E] у плиты (+1 ♥)' });
    return out;
  }

  getInteractables() {
    const m = this.app.mode;
    const out = [];
    const home = this.app.scenes.home;
    if (m === 'home') {
      if (this.phase === 'day' || this.phase === 'verdict') {
        for (const p of this.pending) {
          const s = p.spot;
          out.push({ x: s ? s.x : p.rig.root.position.x, z: s ? s.z : p.rig.root.position.z, r: 1.5, target: p.rig.root, label: `[E] Поговорить: ${p.guest.name}`, action: () => this.interrogate(p) });
        }
        if (this.pending.length === 0) {
          if (!this.finalDay) {
            out.push({
              x: home.anchors.exitDoor.x, z: home.anchors.exitDoor.z, r: 1.1,
              hl: [0, 1.05, -2.35, 1.1, 2.15, 0.3],
              target: home.world.targets.door,
              label: this.day === 2 && !this.lyceumDone ? '[E] Выйти на улицу — к лицею' : '[E] Выйти на улицу — в «Бедронку»',
              action: () => this.goStreet(false)
            });
          }
          out.push({
            x: home.anchors.bed.x, z: home.anchors.bed.z, r: 1.5,
            hl: [-1.45, 0.5, 5.45, 1.25, 0.95, 2.1],
            target: home.world.targets.bed,
            label: this.finalDay ? '[E] Дождаться утреннего итога' : this.storeTripDone && this.cart.length === 0 ? '[E] Лечь спать' : this.cart.length > 0 ? '[E] Кровать — сначала вынести добычу' : '[E] Кровать — сперва загляни в «Бедронку»',
            action: () => this.requestSleep()
          });
        }
        out.push({ x: home.anchors.basementDoor.x, z: home.anchors.basementDoor.z, r: 1.55, hl: [-1.75, 1.05, 2.3, 1.0, 2.1, 0.3], target: home.world.targets.basementDoor, label: '[E] Открыть дверь в подвал — жёлтая лампа слева', action: () => this.goBasement() });
        // чайник на плите
        out.push({
          x: home.anchors.stove.x, z: home.anchors.stove.z, r: 1.1,
          hl: [-1.55, 0.55, 0.55, 0.75, 1.15, 0.7],
          target: home.world.targets.stove,
          label: this.tea > 0 ? `[E] Заварить чай (${this.tea})` : '[E] Плита',
          action: () => {
            if (this.tea <= 0) { this.msg(TEXTS.stoveNoTea, 4500); return; }
            if (this.teaUsedDay === this.day) { this.msg(TEXTS.stoveUsed, 4000); return; }
            if (this.hearts >= 3) { this.msg(TEXTS.stoveFull, 4000); return; }
            this.tea -= 1;
            this.teaUsedDay = this.day;
            this.hearts += 1;
            this.sfx.chime();
            this.hud();
            this.msg(TEXTS.stoveTea, 5500);
          }
        });
        // радио в спальне
        out.push({
          x: home.anchors.radio.x, z: home.anchors.radio.z, r: 0.95,
          hl: [0.2, 0.97, 6.28, 0.55, 0.4, 0.3],
          target: home.world.targets.radio,
          label: '[E] Послушать радио',
          action: () => {
            this.sfx.radio();
            const r = RADIO[Math.min(this.day, RADIO.length) - 1];
            this.ui.say('РАДИО «ВЭФ»', r, [{ label: '(выключить)', cb: () => this.ui.dialogue(null, null, []) }]);
          }
        });
        // зеркало в ванной
        out.push({
          x: home.anchors.mirror.x, z: home.anchors.mirror.z, r: 1.0,
          hl: [2.75, 1.45, 2.61, 0.44, 0.6, 0.02],
          target: home.world.targets.mirror,
          label: '[E] Зеркало',
          action: () => {
            this.sfx.whisper();
            this.msg(MIRROR[Math.min(this.day, MIRROR.length) - 1], 6500);
          }
        });
        // записка в прихожей
        out.push({
          x: home.anchors.note.x, z: home.anchors.note.z, r: 1.0,
          hl: [1.85, 1.5, 2.712, 0.22, 0.17, 0.02],
          target: home.world.targets.note,
          label: '[E] Записка',
          action: () => {
            this.sfx.chime();
            this.msg(TEXTS.note, 7000);
          }
        });
      } else if (this.phase === 'night') {
        if (this.doorGuest && this.doorState !== 'none') out.push({ x: 0, z: -2.1, r: 1.3, target: home.world.targets.door, label: '[E] Глазок — кто там', action: () => this.lookPeephole() });
        out.push({ x: home.anchors.basementDoor.x, z: home.anchors.basementDoor.z, r: 1.55, target: home.world.targets.basementDoor, label: this.mineUnlocked ? '[E] В подвал — к открытому шахтному люку' : '[E] Спуститься в подвал — жёлтая лампа слева', action: () => this.goBasement() });
      }
    } else if (m === 'street') {
      const st = this.app.scenes.street;
      out.push({ x: st.anchors.barrel.x, z: st.anchors.barrel.z, r: st.anchors.barrel.r, hl: [1.6, 0.55, -33, 0.9, 1.2, 0.9], target: st.targets.barrel, label: '[E] Погреться у бочки', action: () => { this.warmth = 100; this.sfx.chime(); this.msg('Руки отошли. Можно дальше.', 2500); } });
      if (this.day === 2) {
        out.push({
          x: st.anchors.lyceum.x, z: st.anchors.lyceum.z, r: st.anchors.lyceum.r,
          hl: [2.3, 1.2, -22.8, 2.2, 2.4, 0.4],
          target: st.targets.lyceum,
          label: this.lyceumDone ? '[E] Лицей — пусто' : '[E] Войти в лицей — сегодня занятия',
          action: () => {
            if (this.lyceumDone) this.msg(LYCEUM.closed, 3500);
            else this.enterLyceum();
          }
        });
      }
      out.push({ x: st.anchors.toStore.x, z: st.anchors.toStore.z, r: 2.2, hl: [0, 1.1, -66.3, 1.6, 2.2, 0.3], target: st.targets.toStore, label: '[E] Войти в «Бедронку»', action: () => this.goStore() });
      out.push({ x: st.anchors.toHome.x, z: st.anchors.toHome.z, r: 1.8, hl: [0, 1.05, 2.3, 1.3, 2.1, 0.3], target: st.targets.toHome, label: this.storeTripDone && this.cart.length === 0 ? '[E] Вернуться домой' : '[E] Домой — сперва загляни в «Бедронку»', action: () => this.goHome() });
    } else if (m === 'lyceum') {
      const ly = this.app.scenes.lyceum;
      out.push({ x: ly.anchors.exit.x, z: ly.anchors.exit.z, r: ly.anchors.exit.r, hl: [0, 1.1, 3.55, 1.3, 2.2, 0.35], target: ly.targets.exit, label: '[E] Выйти на улицу', action: () => this.leaveLyceum() });
      out.push({
        x: ly.anchors.schedule.x, z: ly.anchors.schedule.z, r: ly.anchors.schedule.r,
        hl: [-1.55, 1.6, 2.35, 0.7, 0.9, 0.12],
        label: '[E] Расписание',
        action: () => {
          this.sfx.chime();
          this.ui.say('РАСПИСАНИЕ', LYCEUM.schedule, [{ label: '(отойти)', cb: () => this.ui.dialogue(null, null, []) }]);
        }
      });
      out.push({
        x: ly.anchors.board.x, z: ly.anchors.board.z, r: ly.anchors.board.r,
        hl: [0, 1.5, -9.55, 2.6, 1.2, 0.12],
        label: '[E] Доска класса 2-Б',
        action: () => {
          this.sfx.whisper();
          this.ui.say('ДОСКА КЛАССА 2-Б', LYCEUM.board, [{ label: '(отойти)', cb: () => this.ui.dialogue(null, null, []) }]);
        }
      });
      out.push({
        x: ly.anchors.desk.x, z: ly.anchors.desk.z, r: ly.anchors.desk.r,
        hl: [-3.2, 0.4, -4.8, 1.3, 0.85, 0.7],
        label: '[E] Брошенная парта',
        action: () => {
          this.sfx.whisper();
          this.ui.say('БРОШЕННАЯ ПАРТА', LYCEUM.desk, [{ label: '(отойти)', cb: () => this.ui.dialogue(null, null, []) }]);
        }
      });
      out.push({
        x: ly.anchors.seat.x, z: ly.anchors.seat.z, r: ly.anchors.seat.r,
        hl: [1.08, 0.45, -5.0, 0.9, 0.85, 0.65],
        label: this.lyceumStudied ? '[E] Парта Хомки — урок записан' : '[E] Сесть за парту — учиться',
        action: () => this.studyLyceum()
      });
      out.push({
        x: ly.anchors.window.x, z: ly.anchors.window.z, r: ly.anchors.window.r,
        hl: [4.55, 1.5, -6.25, 0.12, 1.3, 1.4],
        label: '[E] Окно в коридор',
        action: () => {
          this.sfx.whisper();
          this.msg(LYCEUM.window, 5000);
        }
      });
    } else if (m === 'store') {
      const so = this.app.scenes.store;
      const count = this.cart.length;
      const seen = this.storeSeen;
      for (const key of Object.keys(ITEMS)) {
        const a = so.anchors[ITEMS[key].anchor];
        const it = ITEMS[key];
        const target = so.targets[ITEMS[key].anchor];
        const inCart = this.cart.includes(key);
        if (!inCart && (!target || !target.visible)) continue;
        out.push({
          x: a.x, z: a.z, r: a.r,
          hl: inCart ? null : (a.hl || [a.x, 1.15, a.z, 0.55, 0.55, 0.5]),
          target: () => inCart ? null : target,
          itemKey: key,
          label: inCart
            ? `[Q] Вернуть: ${it.name} · в карманах ${count}/${STORE_DAILY_LIMIT}`
            : count >= STORE_DAILY_LIMIT
              ? `[E] Больше не унести: ${STORE_DAILY_LIMIT} предмета`
              : this.storeTripDone
                ? `[E] ${it.name} — на сегодня хватит`
                : `[E] Взять: ${it.name}${seen ? ' — она смотрит!' : ' · пока не видит'}`,
          action: () => {
            if (this.cart.includes(key)) this.msg(`${it.name} уже за пазухой. [Q] — вернуть на полку.`, 2500);
            else this.pickup(key);
          }
        });
      }
      // У людей контур не рисуем: это живые, а не предметы.
      const co = so.anchors.checkout;
      out.push({ x: co.x, z: co.z, r: co.r, label: '[E] Людмила — поговорить', action: () => this.lyudmilaTalk() });
      const zosiaA = so.anchors.zosia;
      out.push({
        x: zosiaA.x, z: zosiaA.z, r: zosiaA.r,
        label: `[E] ${TEXTS.zosiaTitle}`,
        action: () => {
          this.sfx.chime();
          const z = this.mineResolved ? ZOSIA_MINE : ZOSIA[Math.min(this.day, ZOSIA.length) - 1];
          this.ui.say(TEXTS.zosiaTitle, z, [{ label: '(отойти)', cb: () => this.ui.dialogue(null, null, []) }]);
        }
      });
      const newsA = so.anchors.news;
      out.push({
        x: newsA.x, z: newsA.z, r: 1.3,
        hl: newsA.hl,
        target: so.targets.news,
        label: '[E] Газета «Величанский вестник»',
        action: () => {
          this.sfx.whisper();
          const n = NEWS[Math.min(this.day, NEWS.length) - 1];
          this.ui.say('ВЕЛИЧАНСКИЙ ВЕСТНИК', n, [{ label: '(положить на место)', cb: () => this.ui.dialogue(null, null, []) }]);
        }
      });
      out.push({ x: so.anchors.exit.x, z: so.anchors.exit.z, r: 1.5, hl: [0, 1.1, 5.55, 1.5, 2.2, 0.3], target: so.targets.exit, label: this.cart.length > 0 ? '[E] Уйти с добычей' : this.storeTripDone ? '[E] Выйти на улицу' : '[E] Выйти — сначала возьми 1–3 предмета', action: () => this.leaveStore() });
    } else if (m === 'basement') {
      const b = this.app.scenes.basement;
      out.push({ x: b.anchors.exit.x, z: b.anchors.exit.z, r: 1.4, hl: [b.anchors.exit.x, 1.05, b.anchors.exit.z, 1.1, 2.1, 0.35], label: '[E] Наверх', action: () => { this.sfx.doorOpen(0.6); this.sfx.roomTone(true); this.app.goto('home', { x: -1.2, z: 1.8 }, Math.PI); } });
      const mineA = b.anchors.mine;
      const mineOpen = this.mineUnlocked && this.phase === 'night';
      out.push({
        ...mineA, target: b.targets && b.targets.mineHatch,
        label: mineOpen ? '[E] Открыть люк шахты «Величка-6»' : '[E] Заваренный шахтный люк',
        action: () => {
          if (!mineOpen) { this.msg(this.day < 3 ? MINE_TEXT.lockedEarly : MINE_TEXT.lockedDay, 6500); return; }
          this.enterMine(1, true);
        }
      });
      for (const p of this.patients) {
        out.push({ x: p.cot.x, z: p.cot.z, r: 1.2, target: p.rig.root, label: `[E] ${p.guest.name}${p.cured ? ' — уже не фонит' : ' (лечится)'}`, action: () => this.msg(p.cured ? p.guest.curedLine : 'Счётчик трещит. Ещё день-два под котлом.', 3500) });
      }
    } else if (this.isMineMode(m)) {
      out.push(...this.getMineInteractables());
    }
    if (!this.mineHidden) out.push(...this.getSecretInteractables(m));
    return out.filter((i) => i);
  }

  // ---------- покадровое обновление ----------
  update(dt) {
    this.t += dt;
    // Корзина обновляется событиями pickup/return/hud/setMode, а не каждый кадр.
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.t >= this.timers[i].at) {
        const fn = this.timers[i].fn;
        this.timers.splice(i, 1);
        try { fn(); } catch (e) { console.error(e); }
      }
    }

    // Живой календарь: минуты идут и во время осмотра, но не на экранах сна/концовки.
    const dayClock = ['day', 'verdict', 'store', 'shoptalk', 'street', 'debug'].includes(this.phase);
    const nightClock = this.phase === 'night';
    if (dayClock || nightClock) {
      this.timeMinutes += dt * (nightClock ? 0.12 : 0.25);
      if (this.timeMinutes >= 1440) this.timeMinutes -= 1440;
      const minute = Math.floor(this.timeMinutes);
      if (minute !== this._lastClockMinute) {
        this._lastClockMinute = minute;
        this.hud();
        if (minute % 5 === 0) this.syncEnvironment();
      }
      if (dayClock && !this.finalDay && this.timeMinutes >= 22 * 60 && !this.app.transitioning) {
        if (!this.storeTripDone || this.cart.length > 0) {
          // Ночь не обходит магазин: часы ждут на 21:59, пока Хомка не вынесет
          // хотя бы один предмет из «Бедронки».
          this.timeMinutes = 22 * 60 - 0.05;
          if (!this.storeCurfewWarned) {
            this.storeCurfewWarned = true;
            this.ui.bigtext('СНАЧАЛА — «БЕДРОНКА»', 2600);
            this.msg(this.cart.length > 0
              ? '22:00. Выйди из «Бедронки» через дверь с добычей — домой с полными карманами не пройти.'
              : `22:00. Возьми в «Бедронке» 1–${STORE_DAILY_LIMIT} предмета, пока Людмила не смотрит, и уйди. Без этого ночь не начнётся.`, 7500);
            this.ui.prompt(this.cart.length > 0
              ? 'Иди к двери «Бедронки» и выйди с добычей.'
              : `«Бедронка»: взять 1–${STORE_DAILY_LIMIT} предмета → выйти через дверь → домой.`);
            this.hud();
          }
        } else {
          this.phase = 'nightfall';
          this.ui.dialogue(null, null, []);
          this.ui.bigtext('НОЧЬ НАД ВЕЛИЧКОЙ', 2600);
          this.msg('Десять вечера. Дом сам напоминает Хомке про ружьё и цепочку.', 5000);
          if (this.app.mode !== 'home') {
            this.sfx.windStop();
            this.app.goto('home', { x: -0.3, z: 1.6 }, 0);
          }
          this.after(1.2, () => this.startNight());
        }
      }
    }

    // Стелс в «Бедронке»: взгляд Людмилы, шкала внимания, поимка.
    this.storeSuspicionStep(dt);

    // Погоня: расстояние, рык и захват. Проверка только на чёрном горизонте.
    if (this.mineChase && this.mineLevel === 3) {
      const sc = this.app.scenes.mine3;
      this.mineChaseGrace = Math.max(0, this.mineChaseGrace - dt);
      if (!this.mineHidden && this.mineChaseGrace <= 0 && sc && sc.chaseDistance && sc.chaseDistance(this.app.camera) < 1.15) {
        this.mineCaught();
      } else if (!this.mineHidden && this.t - this._lastRoar > 5.5) {
        this._lastRoar = this.t;
        this.sfx.roar(0.35);
      }
    }

    // Воздух — отдельный ресурс шахты. Чем глубже, тем быстрее портится фильтр.
    if (this.isMineMode() && this.phase !== 'done') {
      const sc = this.app.scenes[this.app.mode];
      if (!this.app.transitioning) this.mineAir = Math.max(0, this.mineAir - dt * (sc ? sc.airRate : 0.2));
      this.ui.setAir(this.mineAir, true);
      if (this.mineAir <= 0 && !this.app.transitioning) {
        this.hearts -= 1;
        if (this.hearts <= 0) { this.hud(); this.gameOver('mineLost'); }
        else {
          this.mineAir = 55;
          this.enterMine(1);
          this.msg(MINE_TEXT.airOut, 7000);
          this.hud();
        }
      }
    } else {
      this.ui.setAir(this.mineAir, false);
    }

    // в «Бедронке» тепло: пока ходишь между полками, Хомка отогревается
    if (this.app.mode === 'store' && this.warmth < 100) {
      this.warmth = Math.min(100, this.warmth + dt * 26);
      this.ui.showWarmth(true);
      this.ui.setWarmth(this.warmth);
      if (this.warmth >= 100) this.ui.showWarmth(false);
    }

    // холод на улице (носки шерстяные заметно спасают)
    if (this.app.mode === 'street') {
      const d = DAYS[Math.min(this.day, DAYS.length) - 1];
      this.warmth -= dt * 3.0 * (d ? d.cold : 1) * (this.hasSocks ? 0.8 : 1);
      this.ui.setWarmth(this.warmth);
      if (this.warmth <= 0) {
        if (!this.collapseUsed) {
          this.collapseUsed = true;
          this.warmth = 45;
          this.app.goto('street', { x: 0, z: -33 }, 0);
          this.msg('Хомка упал в снег — и очнулся у бочки. Кто-то дотащил. Или дополз сам. Второй раз так не повезёт.', 6000);
        } else {
          this.gameOver('frozen');
        }
      }
    }

    // гости идут к своим местам
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      const entry = w.entry;
      const rig = entry.rig;
      if (rig.dead) { this.walkers.splice(i, 1); continue; }
      const s = entry.spot;
      const dx = s.x - rig.root.position.x;
      const dz = s.z - rig.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.06) {
        resetPose(rig);
        pose.walk(rig, this.t, { speed: 0.85 });
        const sp = Math.min(dist, dt * 1.1);
        rig.root.position.x += (dx / dist) * sp;
        rig.root.position.z += (dz / dist) * sp;
        rig.root.rotation.y = Math.atan2(dx, dz);
      } else {
        rig.root.rotation.y = s.ry;
        rig.root.position.y = s.y;
        entry.seated = true;
        this.walkers.splice(i, 1);
      }
    }

    // трупы падают
    for (const c of this.corpses) {
      const rig = c.rig;
      rig.deadT = (rig.deadT || 0) + dt;
      const k = Math.min(1, rig.deadT / 0.7);
      rig.root.rotation.x = (Math.PI / 2) * k * k;
      rig.root.position.y = Math.max(0.02, (c.spot ? c.spot.y : 0) - k * 0.1);
      resetPose(rig);
      pose.limp(rig, this.t);
    }

    // сидячие/лежачие позы + гость у двери: достаточно 12 Гц
    const poseTick = Math.floor(this.t * 12);
    if (poseTick !== this._poseTick) {
      this._poseTick = poseTick;
      for (const r of [...this.pending, ...this.residents]) {
        if (r.rig.dead || !r.seated) continue;
        resetPose(r.rig);
        pose.sit(r.rig, this.t);
      }
      for (const p of this.patients) {
        resetPose(p.rig);
        pose.lying(p.rig, this.t);
      }
      if (this.visitorRig) {
        resetPose(this.visitorRig);
        const leanIn = this.doorState === 'knock' ? 0.55 : 0.2;
        pose.lean(this.visitorRig, this.t, { amount: leanIn });
        this.visitorRig.root.rotation.y = 0.04 + Math.sin(this.t * 0.4) * 0.06;
      }
    }

    // катсцена выстрела
    if (this.cutscene) {
      this.cutscene.t += dt;
      this.cutscene.step(dt, this.cutscene);
    }

    // счётчик Гейгера: амбиент подвала, если есть пациенты
    if (this.app.mode === 'basement' && this.patients.length > 0 && this.t - this.geigerT > 3.5) {
      this.geigerT = this.t;
      this.sfx.geiger(1.2 + this.patients.length * 1.2, 1.1);
    }

    // повторный стук, если игрок тянет
    if (this.doorGuest && this.doorState === 'knock' && this.t - this.doorKnockT > 4) {
      this.doorKnockT = this.t;
      this.sfx.knock(0.9, 2);
    }
    if (this.doorGuest && this.doorState === 'waiting' && this.t - this.doorKnockT > 12) {
      this.doorKnockT = this.t;
      this.sfx.knock(0.8, 1);
      this.ui.prompt('[E] у двери — кто там?');
    }
  }
}
