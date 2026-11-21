// main.js — точка входа «Нет, я не величанин»: рендерер, камера FPS, менеджер сцен,
// интерактивы, переходы между локациями, холод, звук шагов.

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildScenes } from './scenes.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';
import { createPost } from './post.js';
import { GeometryHighlight, resolveGeometryTarget } from './highlight.js';
import { buildWorldExpansion } from './expansion.js';
import { materialStats } from './mats.js';
import { TouchControls, detectTouchDevice } from './touch_controls.js';
import { createDebug } from './debug.js';

const touchMode = detectTouchDevice();
document.body.classList.toggle('touch-mode', touchMode);
document.body.dataset.input = touchMode ? 'touch' : 'desktop';
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
const worldExpansion = buildWorldExpansion(scenes);
const ui = new UI();
const sfx = new Sfx();
const controls = new PointerLockControls(camera, document.body);
const post = createPost(renderer, scenes.home.scene, camera);
post.setScene(scenes.home.scene);
const EYE_Y = 1.62;

// Жёлтый контур строится по геометрии видимого предмета. Для статики после
// batchStaticMeshes берётся конкретный экземпляр InstancedMesh, для NPC/дверей —
// живая группа; старые hl-размеры остаются только подсказкой и запасным вариантом.
const highlight = new GeometryHighlight();
let highlightKey = '';
function clearHighlight() {
  if (!highlightKey && !highlight.root.visible) return;
  highlight.clear();
  highlightKey = '';
}

// ---------- адаптивное качество (для слабых ноутов) ----------
// Full HD-профиль: физический бэкбуфер не делаем больше 1920x1080,
// даже если экран/масштаб Windows просят supersampling.
const targetPR = () => Math.min(
  window.devicePixelRatio || 1,
  (touchMode ? 1280 : 1920) / Math.max(1, window.innerWidth),
  (touchMode ? 900 : 1080) / Math.max(1, window.innerHeight)
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
const SETTINGS_KEY = 'not-a-human.settings.v1';
let savedSettings = {};
try { savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) { /* приватный режим */ }
let qualityPreference = ['auto', '0', '2', '4', '5'].includes(String(savedSettings.quality))
  ? String(savedSettings.quality) : 'auto';
let volumeSetting = Number.isFinite(Number(savedSettings.volume))
  ? Math.max(0, Math.min(1, Number(savedSettings.volume))) : 0.6;
let lookSensitivity = Number.isFinite(Number(savedSettings.sensitivity))
  ? Math.max(0.35, Math.min(2, Number(savedSettings.sensitivity))) : 1;
let adaptive = qualityPreference === 'auto';
if (!adaptive) qLevel = Number(qualityPreference);
// Явный URL ?q=0..5 имеет приоритет для воспроизводимых QA-замеров.
if (qParam >= 0 && qParam <= 5) { adaptive = false; qLevel = qParam; }
controls.pointerSpeed = lookSensitivity;
sfx.setVolume(volumeSetting);
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

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      quality: qualityPreference,
      volume: volumeSetting,
      sensitivity: lookSensitivity
    }));
  } catch (_) { /* настройки работают и без доступа к localStorage */ }
}

function setQualityPreference(value) {
  const next = String(value);
  if (!['auto', '0', '2', '4', '5'].includes(next)) return false;
  qualityPreference = next;
  adaptive = next === 'auto';
  if (!adaptive) qLevel = Number(next);
  qAcc = 0; qN = 0; qCool = 0;
  applyQuality();
  syncSettingsUI();
  saveSettings();
  return true;
}

const app = {
  mode: 'title',
  inputMode: touchMode ? 'touch' : 'desktop',
  camera, scenes, worldExpansion, ui, sfx, renderer, highlight,
  post, // диагностика: замеры со/без блума без перезагрузки
  scene: scenes.home.scene,
  transitioning: false,
  surfaceCooldown: 0,
  surfaceTransitions: 0,
  lastSurfaceTransition: null,
  setMode(m) {
    this.mode = m;
    renderer.shadowMap.needsUpdate = true;
    if (m === 'home' || m === 'street' || m === 'store' || m === 'basement' || m === 'lyceum' || /^mine[1-4]$/.test(m)) {
      this.scene = scenes[m].scene;
    }
    const locations = {
      home: ['ДОМ ХОМКИ', 'УРОВЕНЬ ±00 М'],
      street: ['УЛИЦА ВЕЛИЧКИ', '49°59′N / 20°03′E'],
      store: ['БЕДРОНКА', 'ТЕПЛО · +18°C'],
      basement: ['ПОДВАЛ', 'УРОВЕНЬ −03 М'],
      lyceum: ['ЛИЦЕЙ «ВЕЛИЧКА»', 'АРХИВ · КРЫЛЬЦО 2-Б']
    };
    const mine = scenes[m];
    const info = locations[m] || (mine && mine.level
      ? [`ШАХТА · ${mine.title}`, mine.depth]
      : ['ВЕЛИЧКА', '49°59′N / 20°03′E']);
    const loc = document.querySelector('.hud-location');
    if (loc) {
      const text = Array.from(loc.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
      if (text) text.textContent = `${info[0]} `;
      const span = loc.querySelector('span');
      if (span) span.textContent = info[1];
    }
    document.body.dataset.location = m;
    if (window.__game) {
      window.__game.syncEnvironment();
      window.__game.updateCart();
    }
  },
  goto(id, pos, yaw = 0, options = {}) {
    if (this.transitioning) return false;
    const seamless = options.seamless === true;
    if (seamless) {
      if (this.surfaceCooldown > 0) return false;
      const from = this.mode;
      this.surfaceCooldown = 0.65;
      this.setMode(id);
      post.setScene(scenes[id].scene);
      camera.position.set(pos.x, EYE_Y, pos.z);
      camera.rotation.set(0, yaw, 0);
      eyeYCur = EYE_Y;
      renderer.shadowMap.needsUpdate = true;
      this.surfaceTransitions++;
      this.lastSurfaceTransition = { from, to: id, at: performance.now() };
      currentInteract = null;
      clearHighlight();
      ui.prompt(null);
      this.lockPointer();
      return true;
    }
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
    return true;
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
    if (touchMode) return; // на телефоне обзор идёт свайпом, pointer lock не нужен
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
const debugPanel = createDebug(app, game);
app.debug = debugPanel;
// диагностика на ноуте: __perf() в консоли покажет активный уровень
window.__perf = () => ({
  qLevel,
  qualityPreference,
  adaptive,
  pixelRatio: renderer.getPixelRatio(),
  bufferWidth: renderer.domElement.width,
  bufferHeight: renderer.domElement.height,
  volume: volumeSetting,
  sensitivity: lookSensitivity,
  shadows: renderer.shadowMap.enabled,
  bloom: app.post ? app.post.bloom.enabled : qLevel < 4,
  fpsCapMs: frameMs,
  mode: app.mode,
  resources: materialStats(),
  prewarm: app.prewarm || null
});
window.__setQuality = (v) => {
  qLevel = Math.min(5, Math.max(0, v | 0));
  applyQuality();
  return window.__perf();
};

// Прогрев шейдеров остальных сцен идёт по одному и не блокирует ввод. Это убирает
// первый компиляционный рывок при бесшовном входе в магазин/лицей и спуске в шахту.
app.prewarm = { done: 0, total: Object.keys(scenes).length, complete: false, errors: [] };
async function prewarmScenes() {
  for (const [id, data] of Object.entries(scenes)) {
    if (!data || !data.scene) continue;
    try {
      if (typeof renderer.compileAsync === 'function') await renderer.compileAsync(data.scene, camera);
      else renderer.compile(data.scene, camera);
    } catch (error) {
      app.prewarm.errors.push({ id, error: String(error) });
    }
    app.prewarm.done++;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  app.prewarm.complete = true;
}
setTimeout(prewarmScenes, 600);

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
let inventoryOpen = false;
let settingsOpen = false;
let inventoryRenderT = 0;
let inventoryDetailStatus = '';
const inventoryBtn = document.getElementById('inventory-btn');
const inventoryPanel = document.getElementById('inventory-panel');
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryDetail = document.getElementById('inventory-detail');

let inventoryContentKey = '';
function renderInventory(status) {
  if (!inventoryOpen) return;
  const items = game.getInventory();
  const contentKey = JSON.stringify(items.map((item) => [item.id, item.count, item.usable, item.name, item.desc]));
  if (contentKey !== inventoryContentKey) {
    const oldScroll = inventoryPanel.scrollTop;
    inventoryContentKey = contentKey;
    inventoryGrid.textContent = '';
    for (const item of items) {
      const button = document.createElement('button');
      button.className = `inventory-item${item.usable ? ' usable' : ''}`;
      button.dataset.item = item.id;
      const icon = document.createElement('span');
      icon.className = 'inventory-icon';
      icon.textContent = item.icon;
      const name = document.createElement('span');
      name.className = 'inventory-name';
      name.textContent = item.name;
      const count = document.createElement('span');
      count.className = 'inventory-count';
      count.textContent = `×${item.count}`;
      const desc = document.createElement('span');
      desc.className = 'inventory-desc';
      desc.textContent = item.desc;
      button.append(icon, name, count, desc);
      if (item.usable) {
        const use = document.createElement('span');
        use.className = 'inventory-use';
        use.textContent = item.id === 'filter' ? 'ИСПОЛЬЗОВАТЬ · +55% ВОЗДУХА' : 'ИСПОЛЬЗОВАТЬ · +1 СЕРДЦЕ';
        button.appendChild(use);
      }
      button.addEventListener('click', () => {
        sfx.uiClick();
        const wasUsable = item.usable;
        const used = game.useInventory(item.id);
        renderInventory(wasUsable && used ? `${item.name}: использовано.` : item.desc);
      });
      inventoryGrid.appendChild(button);
    }
    inventoryPanel.scrollTop = Math.min(oldScroll, inventoryPanel.scrollHeight - inventoryPanel.clientHeight);
  }
  if (typeof status === 'string') inventoryDetailStatus = status;
  const detail = inventoryDetailStatus || (game.isMineMode()
    ? `Горизонт ${game.mineLevel}/4 · воздух ${Math.ceil(game.mineAir)}% · фильтр используется из этого экрана.`
    : (touchMode ? 'Кнопка «Закрыть» — выйти из инвентаря.' : 'I / Esc — закрыть инвентарь'));
  if (inventoryDetail.textContent !== detail) inventoryDetail.textContent = detail;
}

function toggleInventory(force) {
  const next = typeof force === 'boolean' ? force : !inventoryOpen;
  if (next && (game.phase === 'title' || game.phase === 'done' || game.phase === 'cutscene' || !dialogueHidden())) return;
  if (next && tasksOpen) toggleTasks(false);
  inventoryOpen = next;
  inventoryPanel.classList.toggle('hidden', !inventoryOpen);
  inventoryBtn.classList.toggle('active', inventoryOpen);
  ui.prompt(null);
  clearHighlight();
  currentInteract = null;
  if (inventoryOpen) {
    app.unlockPointer();
    inventoryDetailStatus = '';
    renderInventory();
    inventoryPanel.focus({ preventScroll: true });
  } else if (walkable()) {
    app.lockPointer();
  }
}

inventoryBtn.addEventListener('click', (e) => { e.stopPropagation(); sfx.uiClick(); toggleInventory(); });
document.getElementById('inventory-close').addEventListener('click', () => { sfx.uiClick(); toggleInventory(false); });

document.addEventListener('keydown', (e) => {
  // Поля настроек и прокручиваемые панели получают свои нативные клавиши.
  if (settingsOpen) {
    if (e.code === 'Escape') { e.preventDefault(); setSettingsOpen(false); }
    return;
  }
  const scrollKey = e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'PageUp' || e.code === 'PageDown' || e.code === 'Home' || e.code === 'End';
  const inScrollPanel = e.target instanceof Element && !!e.target.closest('#tasks-panel,#inventory-panel,#dialogue,#npc-line');
  if (scrollKey && !inScrollPanel) e.preventDefault();
  keys[e.code] = true;
  if (inventoryOpen) {
    if (e.code === 'KeyI' || e.code === 'Escape') { e.preventDefault(); toggleInventory(false); }
    else if (!scrollKey) e.preventDefault();
    return;
  }
  if (e.code === 'KeyI') { e.preventDefault(); toggleInventory(true); return; }
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
    toggleCrouch();
    return;
  }
  if (e.code === 'Tab') { e.preventDefault(); toggleTasks(); return; }
  if (e.code === 'Escape' && !dialogueHidden()) {
    if (game.phase === 'verdict') game.phase = 'day';
    else if (game.phase === 'shoptalk') game.phase = 'store';
    game.ui.dialogue(null, null, []); // диалог не должен запирать ходьбу и [E]
    game.syncMineItems();
    game.hud();
    return;
  }
  if (app.peephole && (e.code === 'KeyE' || e.code === 'Escape')) {
    game.closePeephole();
    return;
  }
  if (e.code === 'KeyQ' && app.mode === 'store' && walkable() && dialogueHidden()) {
    if (e.repeat) return;
    returnSelectedItem();
    return;
  }
  if (e.code === 'KeyE' && currentInteract && dialogueHidden()) {
    performAction();
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
let tasksContentKey = '';
function renderTasks() {
  const items = game.getTasks();
  const archive = Object.values(app.worldExpansion.secrets);
  const found = game.secretFound || new Set();
  const contentKey = JSON.stringify([
    items.map((it) => [it.text, !!it.done]),
    archive.map((entry) => found.has(entry.id))
  ]);
  if (contentKey === tasksContentKey) return;
  const oldScroll = tasksPanel.scrollTop;
  tasksContentKey = contentKey;
  tasksList.textContent = '';
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'task' + (it.done ? ' done' : '');
    row.textContent = (it.done ? '✓ ' : '▢ ') + it.text;
    tasksList.appendChild(row);
  }
  const head = document.createElement('div');
  head.className = 'archive-heading';
  head.textContent = `ПОЛЕВОЙ АРХИВ · ${found.size}/${archive.length}`;
  tasksList.appendChild(head);
  for (const entry of archive) {
    const row = document.createElement('div');
    const isFound = found.has(entry.id);
    row.className = `archive-entry${isFound ? ' found' : ''}`;
    row.dataset.secret = entry.id;
    row.textContent = isFound ? `✓ ${entry.title}` : `○ ${entry.hint}`;
    tasksList.appendChild(row);
  }
  tasksPanel.scrollTop = Math.min(oldScroll, tasksPanel.scrollHeight - tasksPanel.clientHeight);
}
function toggleTasks(force) {
  const next = typeof force === 'boolean' ? force : !tasksOpen;
  if (next && (inventoryOpen || game.phase === 'title' || game.phase === 'done')) return;
  tasksOpen = next;
  tasksPanel.classList.toggle('hidden', !tasksOpen);
  tasksBtn.classList.toggle('active', tasksOpen);
  ui.prompt(null);
  clearHighlight();
  currentInteract = null;
  if (tasksOpen) {
    app.unlockPointer();
    renderTasks();
    tasksPanel.focus({ preventScroll: true });
  } else if (walkable()) {
    app.lockPointer();
  }
}
tasksBtn.addEventListener('click', (e) => { e.stopPropagation(); sfx.uiClick(); toggleTasks(); });
ui.onClick = () => sfx.uiClick();

canvas.addEventListener('click', () => {
  if (walkable() && !controls.isLocked) app.lockPointer();
});

controls.addEventListener('unlock', () => {
  if (!touchMode && walkable()) ui.prompt('Клик — продолжить');
});

function dialogueHidden() {
  return document.getElementById('dialogue').classList.contains('hidden');
}

function walkable() {
  return (app.mode === 'home' || app.mode === 'street' || app.mode === 'store' || app.mode === 'basement' || app.mode === 'lyceum' || /^mine[1-4]$/.test(app.mode))
    && !app.transitioning && !app.peephole && !inventoryOpen && !tasksOpen && game.phase !== 'done' && game.phase !== 'cutscene';
}

function toggleCrouch() {
  if (!walkable()) return;
  crouched = !crouched;
  sfx.crouch();
  touch.setCrouched(crouched);
}

function returnSelectedItem() {
  if (app.mode !== 'store' || !walkable() || !dialogueHidden()) return false;
  const key = currentInteract && currentInteract.itemKey && game.cart.includes(currentInteract.itemKey)
    ? currentInteract.itemKey
    : null;
  const returned = game.returnItem(key);
  currentInteract = null;
  clearHighlight();
  return returned;
}

function performAction() {
  if (app.peephole) {
    game.closePeephole();
    return;
  }
  if (!currentInteract || !dialogueHidden() || !walkable()) return;
  const action = currentInteract.action;
  currentInteract = null;
  clearHighlight();
  action();
}

const touch = new TouchControls({
  canvas,
  onAction: performAction,
  onReturn: returnSelectedItem,
  onCrouch: toggleCrouch,
  canLook: () => walkable() && dialogueHidden()
});
app.touchControls = touch;

function syncSettingsUI() {
  const quality = document.getElementById('setting-quality');
  const volume = document.getElementById('setting-volume');
  const sensitivity = document.getElementById('setting-sensitivity');
  quality.value = qualityPreference;
  volume.value = String(Math.round(volumeSetting * 100));
  sensitivity.value = String(Math.round(lookSensitivity * 100));
  document.getElementById('setting-volume-value').value = `${volume.value}%`;
  document.getElementById('setting-sensitivity-value').value = `${sensitivity.value}%`;
}

function setSettingsOpen(open) {
  settingsOpen = !!open && app.mode === 'title';
  document.getElementById('title-main').classList.toggle('hidden', settingsOpen);
  document.getElementById('settings-panel').classList.toggle('hidden', !settingsOpen);
  document.getElementById('settings-btn').setAttribute('aria-expanded', String(settingsOpen));
  if (settingsOpen) {
    syncSettingsUI();
    document.getElementById('setting-quality').focus({ preventScroll: true });
  } else {
    document.getElementById('settings-btn').focus({ preventScroll: true });
  }
}

function setVolumeSetting(value) {
  volumeSetting = Math.max(0, Math.min(1, Number(value) || 0));
  sfx.setVolume(volumeSetting);
  syncSettingsUI();
  saveSettings();
}

function setSensitivitySetting(value) {
  lookSensitivity = Math.max(0.35, Math.min(2, Number(value) || 1));
  controls.pointerSpeed = lookSensitivity;
  syncSettingsUI();
  saveSettings();
}

document.getElementById('settings-btn').addEventListener('click', () => setSettingsOpen(true));
document.getElementById('settings-back').addEventListener('click', () => setSettingsOpen(false));
document.getElementById('setting-quality').addEventListener('change', (event) => setQualityPreference(event.target.value));
document.getElementById('setting-volume').addEventListener('input', (event) => setVolumeSetting(Number(event.target.value) / 100));
document.getElementById('setting-sensitivity').addEventListener('input', (event) => setSensitivitySetting(Number(event.target.value) / 100));
app.settings = {
  setQuality: setQualityPreference,
  setVolume: setVolumeSetting,
  setSensitivity: setSensitivitySetting,
  get pointerSpeed() { return controls.pointerSpeed; }
};
syncSettingsUI();

ui.showTitle(() => {
  sfx.init();
  ui.hideTitle();
  game.start();
});
ui.fade(false);

// ---------- бесшовные наземные проёмы ----------
// Пределы лежат внутри достижимых bounds: движение проверяется ДО clampMove.
// yawOffset сохраняет взгляд при входе спиной; у лицея учитывается поворот фасада.
const SURFACE_PORTALS = [
  { mode: 'home', id: 'home-exit', axis: 'z', cross: 'z', threshold: -2.04, sign: -1, lateral: 'x', center: 0, width: 0.44, yawOffset: 0 },
  { mode: 'street', id: 'street-home', axis: 'z', cross: 'z', threshold: 2.02, sign: 1, lateral: 'x', center: 0, width: 0.44, yawOffset: 0 },
  { mode: 'street', id: 'street-store', axis: 'z', cross: 'z', threshold: -66.0, sign: -1, lateral: 'x', center: 0, width: 0.58, yawOffset: 0 },
  { mode: 'store', id: 'store-exit', axis: 'z', cross: 'z', threshold: 5.02, sign: 1, lateral: 'x', center: 0, width: 0.58, yawOffset: 0 },
  { mode: 'street', id: 'street-lyceum', axis: 'x', cross: 'x', threshold: 2.93, sign: 1, lateral: 'z', center: -22.5, width: 0.64, yawOffset: Math.PI / 2 },
  { mode: 'lyceum', id: 'lyceum-exit', axis: 'z', cross: 'z', threshold: 3.70, sign: 1, lateral: 'x', center: 0, width: 0.62, yawOffset: -Math.PI / 2 }
];

function updateSurfaceDoors(dt) {
  const sc = scenes[app.mode];
  if (!sc || !sc.surfaceDoors) return;
  for (const door of sc.surfaceDoors) {
    const near = Math.hypot(camera.position.x - door.x, camera.position.z - door.z) < door.radius;
    door.setOpen(near && game.canUseSurfaceDoor(door.id));
    if (typeof door.update === 'function') door.update(dt);
  }
}

function trySurfacePortal(dx, dz) {
  if (app.surfaceCooldown > 0 || Math.hypot(dx, dz) < 0.0001) return false;
  for (const portal of SURFACE_PORTALS) {
    if (portal.mode !== app.mode) continue;
    const p = camera.position[portal.axis];
    const delta = portal.axis === 'x' ? dx : dz;
    if (Math.sign(delta) !== portal.sign) continue;
    if ((p - portal.threshold) * portal.sign <= 0) continue;
    if (Math.abs(camera.position[portal.lateral] - portal.center) > portal.width) continue;
    // Даже закрытый сюжетом портал получает попытку перехода: Game покажет причину
    // и не даст ни [E], ни бесшовному проходу обойти правила магазина.
    const crossed = game.crossSurfaceDoor(portal.id, { yawOffset: portal.yawOffset });
    if (crossed) {
      app.lastSurfaceTransition.door = portal.id;
      return true;
    }
  }
  return false;
}

// ---------- коллизии ----------
function clampMove(p, sc) {
  const r = 0.32;
  const b = sc.bounds;
  // У лицея есть локальный тамбур до x=3.45 только на ширине калитки.
  // Остальная улица сохраняет прежний фасадный предел x=2.6.
  const maxX = sc.id === 'street' && p.z > -23.35 && p.z < -21.65 ? 3.45 : b.maxX;
  p.x = Math.max(b.minX + r, Math.min(maxX - r, p.x));
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
let lastShadowDoorAngle = 0;
let lastShadowMotion = false;
// Горячий цикл не создаёт временные объекты для сенсорного ввода на desktop.
const touchLookDelta = { x: 0, y: 0 };
const touchFrameState = {
  visible: false, walking: false, peephole: false, store: false,
  canAction: false, canReturn: false, crouched: false
};
let bodyPeephole = null;

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
  app.surfaceCooldown = Math.max(0, app.surfaceCooldown - dt);
  updateSurfaceDoors(dt);

  // Кубическая тень квартиры дорогая: во время движения двери/NPC — 12 Гц,
  // в статичной сцене не перерисовывается. В остальных сценах достаточно 1 Гц;
  // смена сцены и качества всегда явно помечает shadowMap.needsUpdate.
  const doorAngle = scenes.home.world && scenes.home.world.door ? scenes.home.world.door.openAngle : 0;
  const shadowMotion = game.walkers.length > 0 || !!game.visitorRig || Math.abs(doorAngle - lastShadowDoorAngle) > 0.0005;
  lastShadowDoorAngle = doorAngle;
  if (lastShadowMotion && !shadowMotion) renderer.shadowMap.needsUpdate = true;
  lastShadowMotion = shadowMotion;
  const shadowInterval = app.mode === 'home' ? (shadowMotion ? 1 / 12 : Infinity) : 1;
  if (renderer.shadowMap.enabled && t - shadowT > shadowInterval) {
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

  if (touchMode) {
    touch.consumeLook(touchLookDelta);
    if (walkable() && !dlgOpen && (touchLookDelta.x || touchLookDelta.y)) {
      camera.rotation.order = 'YXZ';
      const touchLookSpeed = 0.0032 * lookSensitivity;
      camera.rotation.y -= touchLookDelta.x * touchLookSpeed;
      camera.rotation.x = Math.max(-Math.PI / 2 + 0.04, Math.min(Math.PI / 2 - 0.04, camera.rotation.x - touchLookDelta.y * touchLookSpeed));
    }
  }

  if (walkable() && !dlgOpen && !game.mineHidden) {
    const sc = scenes[app.mode];
    const run = (keys.ShiftLeft || keys.ShiftRight || touch.running) && !crouched;
    const spd = crouched ? 1.05 : (run ? 3.4 : 2.1);
    const sp = spd * dt;
    let moving = false;
    const oldX = camera.position.x, oldZ = camera.position.z;
    if (keys.KeyW) { controls.moveForward(sp); moving = true; }
    if (keys.KeyS) { controls.moveForward(-sp); moving = true; }
    if (keys.KeyA) { controls.moveRight(-sp); moving = true; }
    if (keys.KeyD) { controls.moveRight(sp); moving = true; }
    if (touchMode && Math.abs(touch.moveForward) > 0.015) {
      controls.moveForward(touch.moveForward * sp);
      moving = true;
    }
    if (touchMode && Math.abs(touch.moveX) > 0.015) {
      controls.moveRight(touch.moveX * sp);
      moving = true;
    }
    const crossed = moving && trySurfacePortal(camera.position.x - oldX, camera.position.z - oldZ);
    if (!crossed) clampMove(camera.position, sc);
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

  const activeScene = scenes[app.mode] && scenes[app.mode].scene;
  if (activeScene && highlight.root.parent !== activeScene) {
    activeScene.add(highlight.root);
    clearHighlight();
  }

  // интерактивы: контур перестраивается только при смене предмета, а не каждый кадр.
  hintT += dt;
  if (hintT > 0.15) {
    hintT = 0;
    currentInteract = null;
    let best = null;
    if (walkable() && !dlgOpen) {
      let bestD = 1e9;
      for (const it of game.getInteractables()) {
        const dx = camera.position.x - it.x;
        const dz = camera.position.z - it.z;
        const d = Math.hypot(dx, dz);
        if (d < it.r && d < bestD) { best = it; bestD = d; }
      }
      currentInteract = best;
      if (best) ui.prompt(best.label);
      else if (controls.isLocked || touchMode) ui.prompt(null);
    }

    const target = best && (typeof best.target === 'function' ? best.target() : best.target);
    const nextKey = best
      ? `${app.mode}|${best.label}|${target ? target.uuid : (best.hl ? best.hl.join(',') : 'none')}`
      : '';
    if (nextKey !== highlightKey) {
      highlight.clear();
      highlightKey = nextKey;
      if (target) {
        highlight.setObject(target);
      } else if (best && best.hl && activeScene) {
        const primitive = resolveGeometryTarget(activeScene, best.hl);
        if (primitive) highlight.setPrimitive(primitive);
        else highlight.setLegacyBox(best.hl); // только для интерактива без геометрии
      }
    }
    if (!best) clearHighlight();
  }

  // обновление активной сцены (камера нужна уличному пулу света)
  worldExpansion.update(dt, camera, app.mode, game.secretFound);
  if (scenes[app.mode] && scenes[app.mode].update) scenes[app.mode].update(dt, camera);
  if (app.mode === 'home' && scenes.home.world) {
    const w = scenes.home.world;
    w.corridor.visible = app.peephole || Math.abs(w.door.openAngle) > 0.035;
  }
  highlight.sync();
  if (tasksOpen) { taskT += dt; if (taskT > 1) { taskT = 0; renderTasks(); } }
  if (inventoryOpen && (game.phase === 'done' || game.phase === 'title')) toggleInventory(false);
  if (inventoryOpen) { inventoryRenderT += dt; if (inventoryRenderT > 1) { inventoryRenderT = 0; renderInventory(); } }
  app.crouched = crouched;
  game.update(dt);
  if (touchMode) {
    const touchVisible = !inventoryOpen && !tasksOpen && game.phase !== 'title' && game.phase !== 'done' && game.phase !== 'cutscene';
    touchFrameState.visible = touchVisible;
    touchFrameState.walking = touchVisible && walkable() && dialogueHidden();
    touchFrameState.peephole = app.peephole;
    touchFrameState.store = app.mode === 'store';
    touchFrameState.canAction = !!currentInteract && dialogueHidden();
    touchFrameState.canReturn = app.mode === 'store' && game.cart.length > 0;
    touchFrameState.crouched = crouched;
    touch.update(touchFrameState);
  }
  if (bodyPeephole !== app.peephole) {
    bodyPeephole = app.peephole;
    document.body.classList.toggle('peephole-open', app.peephole);
  }
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
  if (document.hidden) {
    for (const code of Object.keys(keys)) keys[code] = false;
    touch.reset();
  }
});
window.addEventListener('blur', () => {
  for (const code of Object.keys(keys)) keys[code] = false;
  touch.reset();
});

animate();

// ---------- headless-отладка ----------
// #debug — сразу начать игру и открыть панель разработчика
if (location.hash === '#debug') {
  setTimeout(() => { document.getElementById('start-btn').click(); }, 300);
}
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
      game.clearTimers();
      const poses = {
        store: { x: 0, z: 4.6, yaw: 0 },
        street: { x: 0, z: 1.6, yaw: 0 },
        basement: { x: 0, z: 1.6, yaw: 0 },
        lyceum: { x: 0, z: 3.55, yaw: 0 },
        home: { x: -0.3, z: 1.6, yaw: 0 }
      };
      if (/^mine[1-4]$/.test(id)) {
        game.day = Math.max(3, game.day);
        game.mineUnlocked = true;
        game.mineLevel = Number(id.slice(-1));
        game.phase = 'night';
        game.syncMineAccess();
      } else {
        game.phase = 'debug';
      }
      const fallback = scenes[id].spawn || poses.home;
      app.goto(id, poses[id] || fallback, (poses[id] || fallback).yaw || 0);
    }
  }, 1500);
}
