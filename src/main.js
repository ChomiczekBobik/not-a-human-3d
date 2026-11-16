// main.js — точка входа «Нет, я не величанин»: рендерер, камера FPS, менеджер сцен,
// интерактивы, переходы между локациями, холод, звук шагов.

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildScenes } from './scenes.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';
import { createPost } from './post.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Теневая карта статичной квартиры не обновляется 60 раз/сек:
// autoUpdate off + needsUpdate ~15 Гц или при событиях/смене качества.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.9;

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 90);
camera.position.set(-0.3, 1.62, 1.6);

const scenes = buildScenes();
const ui = new UI();
const sfx = new Sfx();
const controls = new PointerLockControls(camera, document.body);
const post = createPost(renderer, scenes.home.scene, camera);
post.setScene(scenes.home.scene);
const EYE_Y = 1.62;

// Жёлтый контур-ободок на объекте под прицелом: линии по рёбрам бокса, один draw call.
const hlBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.55 })
);
hlBox.visible = false;
hlBox.renderOrder = 5;

// ---------- адаптивное качество (для слабых ноутов) ----------
// Full HD-профиль: физический бэкбуфер не делаем больше 1920x1080,
// даже если экран/масштаб Windows просят supersampling.
const targetPR = () => Math.min(
  window.devicePixelRatio || 1,
  1920 / Math.max(1, window.innerWidth),
  1080 / Math.max(1, window.innerHeight)
);
let BASE_PR = targetPR();
renderer.setPixelRatio(BASE_PR);
// Слабое железо стартует сразу на пониженном уровне, а не ждёт просадки FPS.
const WEAK = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
let qLevel = WEAK ? 2 : 0; // лестница 0..5, см. QK в applyQuality
let qAcc = 0, qN = 0, qCool = 0;

// URL-ручки: ?q=0..5 фиксирует качество, ?fps=30|0 ограничивает кадры
const params = new URLSearchParams(location.search);
const qParam = parseInt(params.get('q'), 10);
const adaptive = !params.has('q') || !(qParam >= 0 && qParam <= 5);
if (!adaptive) qLevel = Math.min(5, Math.max(0, qParam));
const fpsParam = parseFloat(params.get('fps'));
let frameMs = Number.isFinite(fpsParam) ? (fpsParam > 0 ? 1000 / fpsParam : 0) : 1000 / 60;

let shadowsOn = true;
function setShadowsEnabled(on) {
  if (shadowsOn === on) return;
  shadowsOn = on;
  renderer.shadowMap.enabled = on;
  if (on) renderer.shadowMap.needsUpdate = true;
  // смена shadowMap требует перекомпиляции материалов — делаем это один раз
  for (const s of Object.values(scenes)) {
    if (!s || !s.scene) continue;
    s.scene.traverse((o) => {
      if (!o.material) return;
      const mm = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mm) m.needsUpdate = true;
    });
  }
}

// Мелкая лестница: на Full HD шаг 15% — это 300 тыс. пикселей, поэтому качество
// сползает ступенями по 8–10%, не выключая блум и тени до самого низа.
const QK = [1, 0.9, 0.82, 0.74, 0.66, 0.58];
function applyQuality() {
  const k = QK[qLevel];
  renderer.setPixelRatio(BASE_PR * k);
  // важно: композер пост-обработки должен получить новый pixel ratio,
  // иначе «снижение разрешения» не снижает цену блума/грейда
  // блум уходит только на низах лестницы (q4+), тени — на самом дне (q5)
  post.setBloomEnabled(qLevel < 4);
  setShadowsEnabled(qLevel < 5);
  post.setSize(window.innerWidth, window.innerHeight);
}
applyQuality();

const app = {
  mode: 'title',
  camera, scenes, ui, sfx, renderer,
  post, // диагностика: замеры со/без блума без перезагрузки
  scene: scenes.home.scene,
  transitioning: false,
  setMode(m) {
    this.mode = m;
    if (m === 'home' || m === 'street' || m === 'store' || m === 'basement' || m === 'lyceum') {
      this.scene = scenes[m].scene;
    }
  },
  goto(id, pos, yaw = 0) {
    if (this.transitioning) return;
    this.transitioning = true;
    ui.fade(true);
    setTimeout(() => {
      this.setMode(id);
      post.setScene(scenes[id].scene);
      camera.position.set(pos.x, EYE_Y, pos.z);
      camera.rotation.set(0, yaw, 0);
      this.transitioning = false;
      ui.fade(false);
      this.lockPointer();
    }, 420);
  },
  peephole: false,
  peepholeCamera: null,
  peepholeSaved: null,
  enterPeephole() {
    if (this.peephole) return;
    const home = scenes.home;
    const p = home.anchors.peepholeView;
    const target = new THREE.Vector3(home.anchors.visitor.x, 1.28, home.anchors.visitor.z);
    this.peepholeCamera = new THREE.PerspectiveCamera(125, window.innerWidth / window.innerHeight, 0.03, 25);
    this.peepholeCamera.position.copy(p);
    this.peepholeCamera.lookAt(target);
    this.peepholeSaved = { pos: camera.position.clone(), rot: camera.rotation.clone() };
    this.peephole = true;
    this.unlockPointer();
    // подъезд рисуется только здесь (дверь не открывается в игре)
    if (home.world && home.world.corridor) home.world.corridor.visible = true;
    post.setCamera(this.peepholeCamera);
    document.getElementById('peephole-mask').classList.remove('hidden');
    document.getElementById('crosshair').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('meter').classList.add('hidden');
  },
  exitPeephole() {
    if (!this.peephole) return;
    this.peephole = false;
    if (scenes.home.world && scenes.home.world.corridor) scenes.home.world.corridor.visible = false;
    if (this.peepholeSaved) {
      camera.position.copy(this.peepholeSaved.pos);
      camera.rotation.copy(this.peepholeSaved.rot);
    }
    post.setCamera(camera);
    this.peepholeCamera = null;
    this.peepholeSaved = null;
    document.getElementById('peephole-mask').classList.add('hidden');
    document.getElementById('crosshair').classList.remove('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('meter').classList.remove('hidden');
  },
  lockPointer() {
    try {
      if (controls.isLocked) return;
      // requestPointerLock в Chrome возвращает промис: без жеста он реджектится.
      // controls.lock() промис наружу не отдаёт, поэтому ловим его сами.
      const req = controls.domElement.requestPointerLock();
      if (req && req.catch) req.catch(() => {});
    } catch (e) { /* без жеста не сработает */ }
  },
  unlockPointer() {
    try { if (controls.isLocked) controls.unlock(); } catch (e) { /* noop */ }
  }
};

const game = new Game(app);
window.__game = game;
window.__app = app;
// диагностика на ноуте: __perf() в консоли покажет активный уровень
window.__perf = () => ({
  qLevel,
  adaptive,
  pixelRatio: renderer.getPixelRatio(),
  shadows: renderer.shadowMap.enabled,
  bloom: app.post ? app.post.bloom.enabled : qLevel < 4,
  fpsCapMs: frameMs,
  mode: app.mode
});
window.__setQuality = (v) => {
  qLevel = Math.min(5, Math.max(0, v | 0));
  applyQuality();
  return window.__perf();
};

// ---------- ввод ----------
const keys = {};
// Чит HOMKA читается по физическим клавишам, поэтому работает и в русской раскладке.
const CHEAT_HOMKA_CODE = ['KeyH', 'KeyO', 'KeyM', 'KeyK', 'KeyA'];
const CHEAT_HOMKA_EN = ['h', 'o', 'm', 'k', 'a'];
const CHEAT_HOMKA_RU = ['р', 'щ', 'ь', 'л', 'ф'];
let cheatHomkaPos = 0;
let bobPhase = 0;
let stepTimer = 0;
let breathTimer = 4 + Math.random() * 4; // первая отдышка после 4–8 с бега
let crouched = false;
let eyeYCur = EYE_Y;
let currentInteract = null;

document.addEventListener('keydown', (e) => {
  // Стрелки/пробел не должны скроллить страницу — в игре они не используются.
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'PageUp' || e.code === 'PageDown' || e.code === 'Home' || e.code === 'End') {
    e.preventDefault();
  }
  keys[e.code] = true;
  // Чит HOMKA: засчитываем и физические клавиши, и напечатанные символы (homka / рщьлф).
  if (!e.ctrlKey && !e.altKey && !e.metaKey) {
    const ch = (e.key || '').toLowerCase();
    const i = cheatHomkaPos;
    const hit = e.code === CHEAT_HOMKA_CODE[i] || ch === CHEAT_HOMKA_EN[i] || ch === CHEAT_HOMKA_RU[i];
    const first = e.code === CHEAT_HOMKA_CODE[0] || ch === CHEAT_HOMKA_EN[0] || ch === CHEAT_HOMKA_RU[0];
    cheatHomkaPos = hit ? i + 1 : (first ? 1 : 0);
    if (cheatHomkaPos === CHEAT_HOMKA_CODE.length) {
      cheatHomkaPos = 0;
      game.skipNight();
    }
  }
  if (e.code === 'KeyC' && walkable()) {
    crouched = !crouched;
    sfx.crouch();
    return;
  }
  if (e.code === 'Tab') { e.preventDefault(); toggleTasks(); return; }
  if (e.code === 'Escape' && !dialogueHidden()) {
    game.ui.dialogue(null, null, []); // диалог не должен запирать ходьбу и [E]
    return;
  }
  if (app.peephole && (e.code === 'KeyE' || e.code === 'Escape')) {
    game.closePeephole();
    return;
  }
  if (e.code === 'KeyE' && currentInteract && dialogueHidden()) {
    currentInteract.action();
    currentInteract = null;
  }
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Страховка: страница никогда не должна прокручиваться (любой скролл сразу сбрасываем).
window.addEventListener('scroll', () => { window.scrollTo(0, 0); });

// ---------- Список дел (TAB): кнопка слева + панель ----------
const tasksBtn = document.getElementById('tasks-btn');
const tasksPanel = document.getElementById('tasks-panel');
const tasksList = document.getElementById('tasks-list');
let tasksOpen = false;
let taskT = 0;
function renderTasks() {
  const items = game.getTasks();
  tasksList.textContent = '';
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'task' + (it.done ? ' done' : '');
    row.textContent = (it.done ? '✓ ' : '▢ ') + it.text;
    tasksList.appendChild(row);
  }
}
function toggleTasks(force) {
  tasksOpen = typeof force === 'boolean' ? force : !tasksOpen;
  tasksPanel.classList.toggle('hidden', !tasksOpen);
  tasksBtn.classList.toggle('active', tasksOpen);
  if (tasksOpen) renderTasks();
}
tasksBtn.addEventListener('click', (e) => { e.stopPropagation(); sfx.uiClick(); toggleTasks(); });
ui.onClick = () => sfx.uiClick();

canvas.addEventListener('click', () => {
  if (walkable() && !controls.isLocked) app.lockPointer();
});

controls.addEventListener('unlock', () => {
  if (walkable()) ui.prompt('Клик — продолжить');
});

function dialogueHidden() {
  return document.getElementById('dialogue').classList.contains('hidden');
}

function walkable() {
  return (app.mode === 'home' || app.mode === 'street' || app.mode === 'store' || app.mode === 'basement' || app.mode === 'lyceum')
    && !app.transitioning && !app.peephole && game.phase !== 'done' && game.phase !== 'cutscene';
}

ui.showTitle(() => {
  sfx.init();
  ui.hideTitle();
  game.start();
});
ui.fade(false);

// ---------- коллизии ----------
function clampMove(p, sc) {
  const r = 0.32;
  const b = sc.bounds;
  p.x = Math.max(b.minX + r, Math.min(b.maxX - r, p.x));
  p.z = Math.max(b.minZ + r, Math.min(b.maxZ - r, p.z));
  for (const c of sc.colliders) {
    const ex = c.minX - r, ey = c.maxX + r, ez = c.minZ - r, ew = c.maxZ + r;
    if (p.x > ex && p.x < ey && p.z > ez && p.z < ew) {
      const dxl = p.x - ex, dxr = ey - p.x, dzl = p.z - ez, dzr = ew - p.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x = ex;
      else if (m === dxr) p.x = ey;
      else if (m === dzl) p.z = ez;
      else p.z = ew;
    }
  }
  p.y = EYE_Y;
}

// ---------- главный цикл ----------
const clock = new THREE.Clock();
let hintT = 0;
let lastFrame = performance.now();
let shadowT = -1;

function animate() {
  requestAnimationFrame(animate);
  // кадровый лимит: 60 fps в игре (30 в меню). На 120/144-Гц ноутах это
  // минус половина GPU-нагрузки и нагрева без потери плавности.
  const now = performance.now();
  const capMs = app.mode === 'title' ? 1000 / 30 : frameMs;
  if (capMs > 0 && now - lastFrame < capMs - 0.75) return;
  lastFrame = now;

  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // тени: не чаще 10 Гц — хватает для двери/посетителей, экономит целый проход
  // (кубическая карта point-света = 6 граней 512², это ~6 мс/кадр в квартире)
  if (renderer.shadowMap.enabled && t - shadowT > 1 / 10) {
    renderer.shadowMap.needsUpdate = true;
    shadowT = t;
  }

  // мониторинг FPS: хуже 42 — режем разрешение/блум/тени, лучше 57 — возвращаем
  if (adaptive && app.mode !== 'title') {
    qAcc += dt; qN++;
    if (qAcc >= 2) {
      const fps = qN / qAcc;
      qAcc = 0; qN = 0;
      if (qCool > 0) qCool -= 2;
      else if (fps < 42 && qLevel < 5) { qLevel++; applyQuality(); qCool = 4; }
      else if (fps > 57 && qLevel > 0) { qLevel--; applyQuality(); qCool = 2; }
    }
  }

  const dlgOpen = !dialogueHidden();
  if (dlgOpen) app.unlockPointer();

  if (walkable() && !dlgOpen) {
    const sc = scenes[app.mode];
    const run = (keys.ShiftLeft || keys.ShiftRight) && !crouched;
    const spd = crouched ? 1.05 : (run ? 3.4 : 2.1);
    const sp = spd * dt;
    let moving = false;
    if (keys.KeyW) { controls.moveForward(sp); moving = true; }
    if (keys.KeyS) { controls.moveForward(-sp); moving = true; }
    if (keys.KeyA) { controls.moveRight(-sp); moving = true; }
    if (keys.KeyD) { controls.moveRight(sp); moving = true; }
    clampMove(camera.position, sc);
    if (moving) {
      bobPhase += dt * spd * 3.4;
      stepTimer -= dt;
      if (stepTimer <= 0) {
        stepTimer = run ? 0.3 : (crouched ? 0.6 : 0.45);
        if (app.mode === 'street') sfx.snowStep(crouched ? 0.3 : 0.6);
        else sfx.step(crouched ? 0.18 : 0.35);
      }
      // Отдышка: только на бегу с шагами, изредка — раз в 7–13 секунд.
      if (run) {
        breathTimer -= dt;
        if (breathTimer <= 0) {
          breathTimer = 7 + Math.random() * 6;
          sfx.breath(0.9);
        }
      }
    } else if (breathTimer < 2.5) {
      breathTimer = 2.5; // после остановки отдышка не начинается сразу
    }
    const targetEye = crouched ? 0.98 : EYE_Y;
    eyeYCur += (targetEye - eyeYCur) * Math.min(1, dt * 9);
    camera.position.y = eyeYCur + (moving ? Math.sin(bobPhase * 2) * 0.024 : Math.sin(t * 1.3) * 0.004);
  }

  // интерактивы
  hintT += dt;
  if (hintT > 0.15) {
    hintT = 0;
    currentInteract = null;
    if (walkable() && dlgOpen === false) {
      let best = null, bestD = 1e9;
      for (const it of game.getInteractables()) {
        const dx = camera.position.x - it.x;
        const dz = camera.position.z - it.z;
        const d = Math.hypot(dx, dz);
        if (d < it.r && d < bestD) { best = it; bestD = d; }
      }
      currentInteract = best;
      if (best && best.hl) {
        hlBox.visible = true;
        hlBox.position.set(best.hl[0], best.hl[1], best.hl[2]);
        hlBox.scale.set(best.hl[3], best.hl[4], best.hl[5]);
      } else {
        hlBox.visible = false;
      }
      if (best) ui.prompt(best.label);
      else if (controls.isLocked) ui.prompt(null);
    }
    if (!currentInteract) hlBox.visible = false;
  }

  // обновление активной сцены (камера нужна уличному пулу света)
  if (scenes[app.mode] && scenes[app.mode].update) scenes[app.mode].update(dt, camera);
  const activeScene = scenes[app.mode] && scenes[app.mode].scene;
  if (activeScene && hlBox.parent !== activeScene) activeScene.add(hlBox);
  if (tasksOpen) { taskT += dt; if (taskT > 1) { taskT = 0; renderTasks(); } }
  game.update(dt);
  post.render(dt);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (app.peepholeCamera) {
    app.peepholeCamera.aspect = window.innerWidth / window.innerHeight;
    app.peepholeCamera.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Full HD-профиль пересчитывается на каждый resize: окно может уехать за 1920x1080
  BASE_PR = targetPR();
  applyQuality();
});

// вкладка скрыта — рендер и игровые таймеры не тикают (экономия батареи/нагрева)
document.addEventListener('visibilitychange', () => {
  clock.getDelta();
  lastFrame = performance.now();
});

animate();

// ---------- headless-отладка ----------
// #autostart — сразу начать игру
if (location.hash === '#autostart') {
  setTimeout(() => { document.getElementById('start-btn').click(); }, 300);
}
// #scene-store / #scene-street / #scene-basement / #scene-lyceum / #scene-home — прыжок в локацию
if (location.hash.startsWith('#scene-')) {
  const id = location.hash.replace('#scene-', '');
  setTimeout(() => { document.getElementById('start-btn').click(); }, 300);
  setTimeout(() => {
    if (scenes[id]) {
      const poses = {
        store: { x: 0, z: 4.6, yaw: 0 },
        street: { x: 0, z: 1.6, yaw: 0 },
        basement: { x: 0, z: 1.6, yaw: 0 },
        lyceum: { x: 0, z: 3.55, yaw: 0 },
        home: { x: -0.3, z: 1.6, yaw: 0 }
      };
      app.goto(id, poses[id] || poses.home, (poses[id] || poses.home).yaw);
      game.phase = 'debug';
    }
  }, 1500);
}
