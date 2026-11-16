// game.js — «Нет, я не величанин». Цикл: день (допрос → Бедронка) → ночь (стуки → впустить/нет).
// Вердикты: ОСТАВИТЬ / ЗАСТРЕЛИТЬ / В ПОДВАЛ. Ошибки имеют цену. Семь дней, семь концовок.

import * as THREE from 'three';
import { createHumanoid, disposeHumanoid } from './rig.js';
import { pose, resetPose } from './anim.js';
import { GUESTS, DAYS, ITEMS, LYUDMILA, ZOSIA, RADIO, NEWS, MIRROR, TEXTS, ENDINGS, CART_MAX, DAILY_PAY, LYCEUM } from './story.js';

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
  'ded-mieczyslaw': { money: 8, text: 'Дед Мечислав выложил на стол 8 злотых: «За крышу. Не спорь».' }
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
    this.money = 30;
    this.meds = 0;
    this.tea = 0;
    this.hasSocks = false;
    this.hasGeiger = false;
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
    this.talkedShop = false;
    this.storeTripDone = false;
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
  }

  // ---------- утилиты ----------
  after(sec, fn) { this.timers.push({ at: this.t + sec, fn }); }
  clearTimers() { this.timers.length = 0; }
  hud(time) {
    const label = this.finalDay ? 'УТРО ВОСЬМОГО' : `ДЕНЬ ${this.day}${this.skipNextNight ? ' ·zzz' : ''}`;
    this.ui.setDay(this.day, time || (this.phase === 'night' ? '01:00' : '09:00'), label);
    this.ui.setHearts(this.hearts);
    this.ui.setSupplies(this.supplies);
    this.ui.setMoney(this.money);
    this.ui.setMeds(this.meds);
  }
  msg(text, ms = 6000) { this.ui.subtitle(text, ms); }

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
    this.sfx.roomTone(true);
    // меловой крест на доме — с четвёртого дня
    const st = this.app.scenes.street;
    if (st && st.cross) st.cross.visible = this.day >= 4;
    this.cart = [];
    this.talkedShop = false;
    this.storeTripDone = false;
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
        if (g.money) this.money += g.money;
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

  startNight() {
    const d = DAYS[this.day - 1];
    this.phase = 'night';
    this.hud('01:00');
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
    this.hud('01:00');
    this.ui.bigtext(`НОЧЬ ${this.day}`, 3000);
    this.msg('Хомка сидит у двери. Ружьё — на коленях. Печь гудит.', 5000);
    this.nightQueue = d.night.map((id) => GUESTS[id]);
    this.after(5, () => this.nextKnock());
  }

  nextKnock() {
    if (this.phase !== 'night') return;
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
      this.hud('01:00');
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
  goStreet(fromStore) {
    if (fromStore) this.warmth = 100; // в «Бедронке» тепло — выходим согревшимися
    this.app.goto('street', fromStore ? { x: 0, z: -64 } : { x: 0, z: 1.6 }, fromStore ? Math.PI : 0);
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
  }

  goHome() {
    this.sfx.windStop();
    this.sfx.doorClose(0.8);
    this.sfx.roomTone(true);
    this.ui.showWarmth(false);
    this.app.goto('home', { x: -0.3, z: 1.6 }, 0);
    if (this.storeTripDone && !this.eveningStarted) {
      this.eveningStarted = true;
      this.msg('Дом. Тепло. Спать — в спальне, кровать у стены.', 5000);
      this.ui.prompt('[E] у кровати в спальне — лечь спать');
    }
  }

  goStore() {
    if (this.day === 2 && !this.lyceumDone) {
      this.msg('Сначала лицей. Потом магазин — он не закроется за десять минут.', 4500);
      return;
    }
    this.sfx.windStop();
    this.sfx.shopBell(0.55);
    this.sfx.doorOpen(0.5);
    this.sfx.roomTone(true);
    this.ui.showWarmth(false);
    this.app.goto('store', { x: 0, z: 4.6 }, 0);
    this.msg('«Бедронка». Светло, тепло, пахнет хлебом и сигаретами Людмилы.', 5000);
  }

  enterLyceum() {
    if (this.day !== 2) {
      this.msg(LYCEUM.closed, 4500);
      return;
    }
    this.lyceumDone = true;
    this.sfx.windStop();
    this.sfx.doorOpen(0.85);
    this.sfx.roomTone(true);
    this.ui.showWarmth(false);
    this.app.goto('lyceum', { x: 0, z: 3.55 }, 0);
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

  leaveLyceum() {
    this.sfx.doorClose(0.85);
    this.sfx.roomTone(false);
    this.app.goto('street', { x: 1.45, z: -22.5 }, Math.PI / 2);
    this.ui.showWarmth(true);
    this.ui.setWarmth(this.warmth);
    this.sfx.windStart(0.16);
    this.msg(LYCEUM.leave, 6500);
    this.ui.prompt('Теперь — в «Бедронку».');
  }

  goBasement() {
    this.sfx.doorClose(0.6);
    this.sfx.creak(1.3);
    this.sfx.roomTone(false);
    this.app.goto('basement', { x: 0, z: 1.6 }, 0);
    this.msg('Подвал. Котёл гудит. Сюда Хомка убирает тех, кто фонит.', 5000);
  }

  // ---------- магазин ----------
  pickup(itemKey) {
    const item = ITEMS[itemKey];
    if (item.gear === 'socks' && this.hasSocks) { this.msg('Носки уже на ногах. Вторая пара — роскошь.', 3000); return; }
    if (item.gear === 'geiger' && this.hasGeiger) { this.msg('Дозиметр уже в кармане. Он уже щёлкает.', 3000); return; }
    if (this.cart.length >= CART_MAX) { this.msg('Больше не унести. Руки — две.', 3000); return; }
    this.cart.push(itemKey);
    this.sfx.beep();
    this.msg(`${item.name} — в корзину. (${this.cart.length}/${CART_MAX})`, 2500);
  }

  lyudmilaTalk() {
    const l = LYUDMILA[this.day - 1];
    this.shopTopic = 0;
    const build = () => {
      const choices = [];
      if (this.shopTopic < l.topics.length) {
        choices.push({ label: '(слушать)', cb: () => { this.sfx.chime(); this.ui.say('Людмила', l.topics[this.shopTopic++], build()); } });
      }
      if (this.cart.length > 0) {
        const sum = this.cart.reduce((s, k) => s + ITEMS[k].price, 0);
        choices.push({ label: `РАССЧИТАТЬСЯ (${sum.toFixed(2)} zł)`, cls: 'decide-open', cb: () => this.checkout() });
      }
      choices.push({ label: '(уйти)', cb: () => { this.ui.dialogue(null, null, []); this.phase = 'store'; } });
      return choices;
    };
    this.phase = 'shoptalk';
    this.ui.say('Людмила', l.hello, build());
  }

  checkout() {
    const l = LYUDMILA[this.day - 1];
    const sum = this.cart.reduce((s, k) => s + ITEMS[k].price, 0);
    if (sum > this.money) {
      this.ui.say('Людмила', 'Не хватает, Хомка. Что-нибудь выложи. Масло оставь — оно по скидке, его все берут.', this.shopBack());
      return;
    }
    this.money -= sum;
    let got = [];
    let flavor = '';
    for (const k of this.cart) {
      const it = ITEMS[k];
      this.supplies += it.supplies || 0;
      if (it.meds) this.meds += it.meds;
      if (it.heals) this.tea += it.heals;
      if (it.gear === 'socks') { this.hasSocks = true; flavor += ' Носки шерстяные — теперь дорога вдвое теплей.'; }
      if (it.gear === 'geiger') { this.hasGeiger = true; flavor += ' Дозиметр — это глаза, у которых нет мнения.'; }
      if (k === 'matches') flavor += ' Спички оставь себе, Хомка. Своим — они дороже.'; // Людмила не берёт
      got.push(it.name.toLowerCase());
    }
    this.cart = [];
    this.storeTripDone = true;
    this.money += DAILY_PAY;
    this.sfx.kassa();
    this.hud();
    this.ui.say('Людмила', `Взял: ${got.join(', ')}. ${l.pay}${flavor}`, this.shopBack());
  }

  shopBack() {
    return [{ label: '(уйти)', cb: () => { this.ui.dialogue(null, null, []); this.phase = 'store'; this.ui.prompt('Выход — за спиной. Снег не ждёт.'); } }];
  }

  // ---------- концовки ----------
  finalEnding() {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    const f = this.flags;
    let key;
    if (f.shotInnocents >= 2) key = 'executioner';
    else if (f.marek === 'shot') key = 'marekShot';
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
    this.app.setMode('cut');
    this.app.unlockPointer();
    const e = ENDINGS[key];
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
  getTasks() {
    const out = [];
    if (this.phase === 'done') { out.push({ text: 'Смена закончена. Можно начать заново.', done: true }); return out; }
    if (this.phase === 'night') {
      out.push({ text: 'Ночь ' + this.day + ': не открывать чужим' });
      out.push({ text: 'Впустить своих — разобраться днём' });
      out.push({ text: 'Дожить до утра' });
      return out;
    }
    if (this.pending.length) out.push({ text: 'Поговорить с гостями [E] — ' + this.pending.length + ' шт.' });
    if (this.day === 2 && !this.lyceumDone) out.push({ text: 'Сходить в лицей на занятия' });
    if (!this.storeTripDone) out.push({ text: '«Бедронка»: купить запасы' });
    else out.push({ text: 'Лечь спать [E] — кровать в спальне' });
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
          out.push({ x: s ? s.x : p.rig.root.position.x, z: s ? s.z : p.rig.root.position.z, r: 1.5, label: `[E] Поговорить: ${p.guest.name}`, action: () => this.interrogate(p) });
        }
        if (this.pending.length === 0) {
          if (!this.finalDay) {
            out.push({
              x: home.anchors.exitDoor.x, z: home.anchors.exitDoor.z, r: 1.1,
              hl: [0, 1.05, -2.35, 1.1, 2.15, 0.3],
              label: this.day === 2 && !this.lyceumDone ? '[E] Выйти на улицу — к лицею' : '[E] Выйти на улицу — в «Бедронку»',
              action: () => this.goStreet(false)
            });
          }
          out.push({
            x: home.anchors.bed.x, z: home.anchors.bed.z, r: 1.5,
            hl: [-1.45, 0.5, 5.45, 1.25, 0.95, 2.1],
            label: this.storeTripDone ? '[E] Лечь спать' : '[E] Лечь спать (без похода в магазин)',
            action: () => { this.eveningStarted = false; this.ui.prompt(null); this.startNight(); }
          });
        }
        out.push({ x: home.anchors.basementDoor.x, z: home.anchors.basementDoor.z, r: 1.2, hl: [-1.75, 1.05, 2.3, 1.0, 2.1, 0.3], label: '[E] Спуститься в подвал', action: () => this.goBasement() });
        // чайник на плите
        out.push({
          x: home.anchors.stove.x, z: home.anchors.stove.z, r: 1.1,
          hl: [-1.55, 0.55, 0.55, 0.75, 1.15, 0.7],
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
          hl: [3.08, 1.55, 3.1, 0.12, 0.85, 0.7],
          label: '[E] Зеркало',
          action: () => {
            this.sfx.whisper();
            this.msg(MIRROR[Math.min(this.day, MIRROR.length) - 1], 6500);
          }
        });
        // записка в прихожей
        out.push({
          x: home.anchors.note.x, z: home.anchors.note.z, r: 1.0,
          hl: [1.85, 1.3, 3.3, 0.3, 0.25, 0.08],
          label: '[E] Записка',
          action: () => {
            this.sfx.chime();
            this.msg(TEXTS.note, 7000);
          }
        });
      } else if (this.phase === 'night' && this.doorGuest && this.doorState !== 'none') {
        out.push({ x: 0, z: -2.1, r: 1.3, label: '[E] Глазок — кто там', action: () => this.lookPeephole() });
      }
    } else if (m === 'street') {
      const st = this.app.scenes.street;
      out.push({ x: st.anchors.barrel.x, z: st.anchors.barrel.z, r: st.anchors.barrel.r, hl: [1.6, 0.55, -33, 0.9, 1.2, 0.9], label: '[E] Погреться у бочки', action: () => { this.warmth = 100; this.sfx.chime(); this.msg('Руки отошли. Можно дальше.', 2500); } });
      if (this.day === 2) {
        out.push({
          x: st.anchors.lyceum.x, z: st.anchors.lyceum.z, r: st.anchors.lyceum.r,
          hl: [2.3, 1.2, -22.8, 2.2, 2.4, 0.4],
          label: this.lyceumDone ? '[E] Лицей — пусто' : '[E] Войти в лицей — сегодня занятия',
          action: () => {
            if (this.lyceumDone) this.msg(LYCEUM.closed, 3500);
            else this.enterLyceum();
          }
        });
      }
      out.push({ x: st.anchors.toStore.x, z: st.anchors.toStore.z, r: 2.2, hl: [0, 1.1, -66.3, 1.6, 2.2, 0.3], label: '[E] Войти в «Бедронку»', action: () => this.goStore() });
      out.push({ x: st.anchors.toHome.x, z: st.anchors.toHome.z, r: 1.8, hl: [0, 1.05, 2.3, 1.3, 2.1, 0.3], label: '[E] Вернуться домой', action: () => this.goHome() });
    } else if (m === 'lyceum') {
      const ly = this.app.scenes.lyceum;
      out.push({ x: ly.anchors.exit.x, z: ly.anchors.exit.z, r: ly.anchors.exit.r, hl: [0, 1.1, 3.55, 1.3, 2.2, 0.35], label: '[E] Выйти на улицу', action: () => this.leaveLyceum() });
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
      for (const key of Object.keys(ITEMS)) {
        const a = so.anchors[ITEMS[key].anchor];
        const it = ITEMS[key];
        out.push({ x: a.x, z: a.z, r: a.r, hl: a.hl || [a.x, 1.15, a.z, 0.55, 0.55, 0.5], label: `[E] Взять: ${it.name} — ${it.price} zł (${it.note})`, action: () => this.pickup(key) });
      }
      const co = so.anchors.checkout;
      out.push({ x: co.x, z: co.z, r: co.r, hl: co.hl, label: '[E] К кассе — Людмила', action: () => this.lyudmilaTalk() });
      const zosiaA = so.anchors.zosia;
      out.push({
        x: zosiaA.x, z: zosiaA.z, r: zosiaA.r,
        hl: zosiaA.hl,
        label: `[E] ${TEXTS.zosiaTitle}`,
        action: () => {
          this.sfx.chime();
          const z = ZOSIA[Math.min(this.day, ZOSIA.length) - 1];
          this.ui.say(TEXTS.zosiaTitle, z, [{ label: '(отойти)', cb: () => this.ui.dialogue(null, null, []) }]);
        }
      });
      const newsA = so.anchors.news;
      out.push({
        x: newsA.x, z: newsA.z, r: 1.3,
        hl: newsA.hl,
        label: '[E] Газета «Величанский вестник»',
        action: () => {
          this.sfx.whisper();
          const n = NEWS[Math.min(this.day, NEWS.length) - 1];
          this.ui.say('ВЕЛИЧАНСКИЙ ВЕСТНИК', n, [{ label: '(положить на место)', cb: () => this.ui.dialogue(null, null, []) }]);
        }
      });
      out.push({ x: so.anchors.exit.x, z: so.anchors.exit.z, r: 1.4, hl: [0, 1.1, 5.55, 1.5, 2.2, 0.3], label: '[E] Выйти на улицу', action: () => { this.ui.dialogue(null, null, []); this.sfx.doorClose(0.7); this.phase = 'street'; this.goStreet(true); } });
    } else if (m === 'basement') {
      const b = this.app.scenes.basement;
      out.push({ x: b.anchors.exit.x, z: b.anchors.exit.z, r: 1.4, hl: [b.anchors.exit.x, 1.05, b.anchors.exit.z, 1.1, 2.1, 0.35], label: '[E] Наверх', action: () => { this.sfx.doorOpen(0.6); this.sfx.roomTone(true); this.app.goto('home', { x: -1.2, z: 1.8 }, Math.PI); } });
      for (const p of this.patients) {
        out.push({ x: p.cot.x, z: p.cot.z, r: 1.2, label: `[E] ${p.guest.name}${p.cured ? ' — уже не фонит' : ' (лечится)'}`, action: () => this.msg(p.cured ? p.guest.curedLine : 'Счётчик трещит. Ещё день-два под котлом.', 3500) });
      }
    }
    return out.filter((i) => i);
  }

  // ---------- покадровое обновление ----------
  update(dt) {
    this.t += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.t >= this.timers[i].at) {
        const fn = this.timers[i].fn;
        this.timers.splice(i, 1);
        try { fn(); } catch (e) { console.error(e); }
      }
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
