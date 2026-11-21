// mine.js — шахта «Величка-6»: четыре горизонта под домом Хомки.
// Вся геометрия и текстуры создаются кодом, внешних моделей и сборки не требуется.
import * as THREE from 'three';
import { mat, box, plane, pbrMat, tex } from './mats.js';
import { batchStaticMeshes, mergeStaticMeshes } from './static_batch.js';
import { addMineDecals } from './mine_details.js';

const LEVELS = {
  1: {
    name: 'ВЕРХНИЙ ГОРИЗОНТ', depth: '−12 М', bg: 0x111411, fog: 0x171b16,
    fogDensity: 0.035, light: 0xffc47a, intensity: 8.5, hemi: 0x6a725c,
    airRate: 0.10, wall: 0x777466, floor: 0x5d5c52
  },
  2: {
    name: 'ЗАТОПЛЕННЫЙ ГОРИЗОНТ', depth: '−38 М', bg: 0x071216, fog: 0x0b2027,
    fogDensity: 0.055, light: 0x82b9c5, intensity: 5.2, hemi: 0x385761,
    airRate: 0.20, wall: 0x52666a, floor: 0x3b5054
  },
  3: {
    name: 'ЧЁРНЫЙ ГОРИЗОНТ', depth: '−71 М', bg: 0x090d08, fog: 0x142013,
    fogDensity: 0.068, light: 0x9dbd65, intensity: 4.8, hemi: 0x3f5431,
    airRate: 0.42, wall: 0x4e5540, floor: 0x3d4034
  },
  4: {
    name: 'НУЛЕВОЙ ГОРИЗОНТ', depth: 'ГЛУБИНА НЕ ИЗМЕРЯЕТСЯ', bg: 0x080609, fog: 0x1b0b16,
    fogDensity: 0.085, light: 0xd47791, intensity: 3.1, hemi: 0x4c293f,
    airRate: 0.70, wall: 0x493a43, floor: 0x30282f
  }
};

function dynamic(parent, name) {
  const g = new THREE.Group();
  g.name = name;
  g.userData.dynamic = true;
  parent.add(g);
  return g;
}

function signMaterial(lines, fg = '#d8cfb4', bg = '#20231f') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 488, 232);
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rows = String(lines).split('\n');
  const size = rows.length > 3 ? 35 : 43;
  ctx.font = `bold ${size}px "Courier New", monospace`;
  rows.forEach((row, i) => ctx.fillText(row, 256, 128 + (i - (rows.length - 1) / 2) * (size + 10), 465));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, color: 0xffffff });
}

function addSign(scene, lines, x, y, z, ry = 0, w = 1.45, h = 0.7, fg, bg) {
  const backingMat = pbrMat('Metal032', 1, 1, { color: 0x484a43, roughness: 0.82, normalScale: 0.4 });
  const backing = box(scene, w + 0.06, h + 0.06, 0.035, backingMat, x, y, z, { ry, cast: false });
  const p = plane(scene, w, h, signMaterial(lines, fg, bg), x, y, z, ry);
  // Сдвиг вдоль локальной нормали, чтобы печать не совпадала с подложкой.
  p.position.x += Math.sin(ry) * 0.021;
  p.position.z += Math.cos(ry) * 0.021;
  return { backing, plane: p };
}

function addDocument(scene, targets, id, lines, x, y, z, ry) {
  const g = dynamic(scene, `mine-${id}`);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  box(g, 0.48, 0.64, 0.018, mat(0x332f28, 0.95), 0, 0, 0, { cast: false });
  plane(g, 0.44, 0.60, signMaterial(lines, '#3a3328', '#b8ad91'), 0, 0, 0.012);
  targets[id] = g;
  return g;
}

function addLamp(scene, targets, x, y, z) {
  const g = dynamic(scene, 'mine-lamp-item');
  g.position.set(x, y, z);
  const steel = pbrMat('Metal032', 1, 1, { color: 0x858c84, roughness: 0.58, normalScale: 0.45 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.10, 14), steel);
  base.position.y = 0.05;
  g.add(base);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.18, 14),
    new THREE.MeshStandardMaterial({ color: 0xffd68c, emissive: 0xffb341, emissiveIntensity: 2.8, roughness: 0.25 }));
  glass.position.y = 0.19;
  g.add(glass);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.065, 0.07, 14), steel);
  cap.position.y = 0.315;
  g.add(cap);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 7, 18, Math.PI), steel);
  handle.position.y = 0.35;
  g.add(handle);
  targets.lamp = g;
}

function addKey(scene, targets, x, y, z) {
  const g = dynamic(scene, 'mine-foreman-key');
  g.position.set(x, y, z);
  g.rotation.x = -Math.PI / 2;
  const brass = pbrMat('Metal032', 1, 1, { color: 0xc09a50, roughness: 0.48, normalScale: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 7, 16), brass);
  ring.position.y = 0.09;
  g.add(ring);
  box(g, 0.025, 0.20, 0.018, brass, 0, -0.035, 0);
  box(g, 0.075, 0.025, 0.018, brass, 0.025, -0.13, 0);
  box(g, 0.025, 0.045, 0.018, brass, 0.055, -0.11, 0);
  targets.key = g;
}

function addFuse(scene, targets, x, y, z) {
  const g = dynamic(scene, 'mine-ceramic-fuse');
  g.position.set(x, y, z);
  g.rotation.z = Math.PI / 2;
  const ceramic = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.18, 12), mat(0xd0c8aa, 0.55));
  g.add(ceramic);
  for (const cy of [-0.11, 0.11]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.045, 12),
      pbrMat('Metal032', 1, 1, { color: 0xa0a59f, roughness: 0.5, normalScale: 0.35 }));
    cap.position.y = cy;
    g.add(cap);
  }
  targets.fuse = g;
}

function addFilter(scene, targets, id, x, y, z) {
  const g = dynamic(scene, `mine-${id}`);
  g.position.set(x, y, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.20, 14),
    pbrMat('Metal032', 1, 1, { color: 0x7b846c, roughness: 0.76, normalScale: 0.4 }));
  body.position.y = 0.10;
  g.add(body);
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.009, 5, 14), mat(0x272c25, 0.7));
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 0.035 + i * 0.034;
    g.add(rib);
  }
  targets[id] = g;
}

function addCrowbar(scene, targets, x, y, z) {
  const g = dynamic(scene, 'mine-crowbar');
  g.position.set(x, y, z);
  g.rotation.z = 0.28;
  const red = pbrMat('Metal032', 1, 2, { color: 0xa14f41, roughness: 0.66, normalScale: 0.45 });
  box(g, 0.035, 0.55, 0.035, red, 0, 0.27, 0);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 12, Math.PI * 0.65), red);
  hook.position.set(0.055, 0.55, 0);
  hook.rotation.z = -0.3;
  g.add(hook);
  targets.crowbar = g;
}

function addMiner(scene, targets) {
  const g = dynamic(scene, 'mine-foreman-stefan');
  g.position.set(3.15, 0, 0.25);
  g.rotation.y = -0.65;
  const cloth = mat(0x414a43, 0.95);
  const skin = mat(0x827b69, 0.95);
  box(g, 0.44, 0.65, 0.25, cloth, 0, 1.05, 0);
  box(g, 0.18, 0.72, 0.20, cloth, -0.13, 0.38, 0);
  box(g, 0.18, 0.72, 0.20, cloth, 0.13, 0.38, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
  head.position.set(0, 1.55, 0);
  g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    pbrMat('Metal032', 1, 1, { color: 0x8a784c, roughness: 0.72, normalScale: 0.4 }));
  helmet.position.set(0, 1.60, 0);
  g.add(helmet);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.045, 10),
    new THREE.MeshStandardMaterial({ color: 0xffd794, emissive: 0xffc15c, emissiveIntensity: 2.5 }));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 1.64, 0.17);
  g.add(lamp);
  targets.foreman = g;
}

function addPanel(scene, targets) {
  const g = dynamic(scene, 'mine-power-panel');
  g.position.set(4.83, 1.20, -8.2);
  g.rotation.y = -Math.PI / 2;
  const panelMetal = pbrMat('Metal032', 1, 1, { color: 0x657275, roughness: 0.68, normalScale: 0.45 });
  box(g, 0.72, 0.95, 0.18, panelMetal, 0, 0, 0);
  box(g, 0.54, 0.57, 0.025, mat(0x1b2426, 0.75), 0, 0.03, 0.105);
  const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x7d2824, emissive: 0xa92922, emissiveIntensity: 2.0 });
  const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), indicatorMat);
  indicator.position.set(0.19, 0.31, 0.14);
  g.add(indicator);
  const toggleMetal = pbrMat('Metal032', 1, 1, { color: 0xc0bcaa, roughness: 0.58, normalScale: 0.35 });
  for (const x of [-0.16, 0, 0.16]) box(g, 0.07, 0.22, 0.05, toggleMetal, x, -0.12, 0.14);
  targets.panel = g;
  return indicatorMat;
}

function addValve(scene, targets, id, x, z, ry) {
  const g = dynamic(scene, `mine-${id}`);
  g.position.set(x, 1.12, z);
  g.rotation.y = ry;
  const pipeMat = pbrMat('Metal032', 1, 2, { color: 0x737d70, roughness: 0.66, normalScale: 0.5 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.40, 10), pipeMat);
  pipe.rotation.x = Math.PI / 2;
  g.add(pipe);
  const wheelMat = pbrMat('Metal032', 1, 1, { color: 0xa65b48, roughness: 0.64, normalScale: 0.45 });
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.025, 8, 22), wheelMat);
  wheel.position.z = 0.23;
  g.add(wheel);
  for (const a of [0, Math.PI / 2]) box(g, 0.43, 0.025, 0.025, pipeMat, 0, 0, 0.23, { rz: a });
  targets[id] = g;
}

function addLadder(scene, targets) {
  const g = dynamic(scene, 'mine-up-ladder');
  g.position.set(0, 0, 5.62);
  const steel = pbrMat('Metal032', 1, 4, { color: 0x7d8580, roughness: 0.62, normalScale: 0.45 });
  box(g, 0.055, 2.65, 0.055, steel, -0.38, 1.32, 0);
  box(g, 0.055, 2.65, 0.055, steel, 0.38, 1.32, 0);
  for (let i = 0; i < 9; i++) box(g, 0.78, 0.035, 0.045, steel, 0, 0.18 + i * 0.28, 0);
  targets.up = g;
}

function addLift(scene, targets) {
  const g = dynamic(scene, 'mine-down-lift');
  g.position.set(0, 0, -18.25);
  const steel = pbrMat('Metal032', 1, 4, { color: 0x69716c, roughness: 0.68, normalScale: 0.5 });
  box(g, 0.12, 2.55, 0.16, steel, -1.0, 1.27, 0);
  box(g, 0.12, 2.55, 0.16, steel, 1.0, 1.27, 0);
  box(g, 2.12, 0.12, 0.16, steel, 0, 2.49, 0);
  for (let i = -4; i <= 4; i++) box(g, 0.025, 2.30, 0.035, steel, i * 0.21, 1.18, 0.02, { cast: false });
  box(g, 2.0, 0.06, 1.0, steel, 0, 0.03, -0.25);
  targets.down = g;
}

// ---------- головоломки горизонтов ----------
// Верхний: три заслонки газовой перемычки. Порядок ВЕРХ · НИЗ · ВЕРХ написан на щите.
function addGasPanel(scene, targets, anchors) {
  const g = dynamic(scene, 'mine-gas-panel');
  const plateMat = pbrMat('Metal032', 1, 1, { color: 0x596057, roughness: 0.70, normalScale: 0.42 });
  const handleMat = pbrMat('Metal032', 1, 1, { color: 0xb08a4e, roughness: 0.52, normalScale: 0.35 });
  box(g, 0.10, 0.92, 1.94, plateMat, 7.86, 1.38, -9.20, { cast: false });
  const levers = [];
  const lamps = [];
  for (let i = 0; i < 3; i++) {
    const z = -9.85 + i * 0.65;
    const lever = dynamic(g, `mine-lever-${i}`);
    lever.position.set(7.72, 1.52, z);
    const arm = box(lever, 0.055, 0.52, 0.055, handleMat, 0, -0.24, 0);
    arm.castShadow = false;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), handleMat);
    knob.position.set(0, -0.50, 0);
    lever.add(knob);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x4a2420, emissive: 0x6d2a22, emissiveIntensity: 0.6, roughness: 0.5 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), lampMat);
    lamp.position.set(7.665, 1.78, z);
    g.add(lamp);
    lamps.push(lampMat);
    targets['lever' + i] = lever;
    anchors['lever' + i] = { x: 6.86, z, r: 0.56 };
    levers.push(lever);
  }
  addSign(scene, 'ЗАСЛОНКИ\n↑ ВЕРХ · ↓ НИЗ\n↑ ВЕРХ', 7.96, 2.12, -9.20, -Math.PI / 2, 1.16, 0.56);
  return {
    set(values) {
      for (let i = 0; i < 3; i++) {
        const up = !!values[i];
        levers[i].rotation.x = up ? -0.62 : 0.62;
        lamps[i].emissive.set(up ? 0x6fae62 : 0x6d2a22);
        lamps[i].color.set(up ? 0x33502c : 0x4a2420);
      }
    }
  };
}

// Затопленный: три насоса. Порядок 1 → 3 → 2; вода уходит только после всей серии.
function addPumpRig(scene, targets, anchors) {
  const g = dynamic(scene, 'mine-pumps');
  const metal = pbrMat('Metal032', 1, 1, { color: 0x60787c, roughness: 0.74, normalScale: 0.5 });
  const wheelMat = pbrMat('Metal032', 1, 1, { color: 0x9a5a48, roughness: 0.62, normalScale: 0.42 });
  const wheels = [];
  const lamps = [];
  const zs = [-1.0, -2.6, -4.2];
  zs.forEach((z, i) => {
    box(g, 0.46, 0.86, 0.46, metal, -7.36, 0.43, z);
    const wheel = dynamic(g, `mine-pump-${i + 1}`);
    wheel.position.set(-7.36, 1.16, z);
    wheel.rotation.y = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 22), wheelMat);
    wheel.add(rim);
    for (const a of [0, Math.PI / 2]) box(wheel, 0.50, 0.03, 0.03, wheelMat, 0, 0, 0, { rz: a });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 10), wheelMat);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, emissive: 0x5a2a1e, emissiveIntensity: 0.5, roughness: 0.55 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), lampMat);
    lamp.position.set(-7.07, 1.55, z);
    g.add(lamp);
    lamps.push(lampMat);
    targets['pump' + (i + 1)] = wheel;
    anchors['pump' + (i + 1)] = { x: -6.46, z, r: 0.72 };
    addSign(scene, String(i + 1), -4.34, 1.92, z, Math.PI / 2, 0.26, 0.26);
    wheels.push(wheel);
  });
  addSign(scene, 'НАСОСЫ\n1 → 3\nПОТОМ 2', -7.96, 2.05, 0.55, Math.PI / 2, 1.10, 0.62);
  let running = false;
  let partial = [];
  return {
    set(on, order = []) {
      running = !!on;
      partial = order.slice();
      for (let i = 0; i < 3; i++) {
        const started = on || order.includes(i);
        if (!started) wheels[i].rotation.z = 0;
        lamps[i].emissive.set(started ? 0x4f8f6a : 0x5a2a1e);
        lamps[i].color.set(started ? 0x274a38 : 0x3a2a20);
        lamps[i].emissiveIntensity = started ? 1.4 : 0.5;
      }
    },
    tick(dt) {
      if (!running) return;
      for (const wheel of wheels) wheel.rotation.z += dt * 7.5;
    }
  };
}

// Чёрный: два вентиля с давлением 0–3. Сумма должна быть ровно 4 атм.
function addPressureGauge(scene, targets, id, x, z, ry) {
  const g = dynamic(scene, 'mine-gauge-' + id);
  const metal = pbrMat('Metal032', 1, 1, { color: 0x6d7260, roughness: 0.66, normalScale: 0.4 });
  box(g, 0.34, 0.86, 0.08, metal, x, 1.72, z, { ry });
  const lamps = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x2c2a24, emissive: 0x14120e, emissiveIntensity: 0.5, roughness: 0.5 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 9, 7), m);
    bulb.position.set(x + Math.sin(ry) * 0.06, 1.42 + i * 0.18, z + Math.cos(ry) * 0.06);
    g.add(bulb);
    lamps.push(m);
  }
  targets['gauge' + id] = g;
  return {
    set(v) {
      for (let i = 0; i < 4; i++) {
        const on = i < v;
        lamps[i].emissive.set(on ? 0x7fc06a : 0x14120e);
        lamps[i].color.set(on ? 0x3f5c34 : 0x2c2a24);
        lamps[i].emissiveIntensity = on ? 1.5 : 0.5;
      }
    }
  };
}

// Нулевой: четыре эхо-плиты и пульт. Порядок не написан — его слушают.
function addEchoArray(scene, targets, anchors) {
  const g = dynamic(scene, 'mine-echo-array');
  const dark = pbrMat('Metal032', 1, 1, { color: 0x4d3a49, roughness: 0.62, normalScale: 0.4 });
  const spots = [
    { i: 0, x: -2.25, z: -3.85 }, { i: 1, x: 2.25, z: -3.85 },
    { i: 2, x: -2.25, z: -7.20 }, { i: 3, x: 2.25, z: -7.20 }
  ];
  const mats = [];
  for (const s of spots) {
    const plate = dynamic(g, `mine-echo-${s.i}`);
    plate.position.set(s.x, 0, s.z);
    box(plate, 0.20, 1.05, 0.20, dark, 0, 0.525, 0);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x6b5568, emissive: 0x8a4a72, emissiveIntensity: 0.55, roughness: 0.34, metalness: 0.15
    });
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.08), faceMat);
    face.position.set(0, 1.12, 0);
    plate.add(face);
    mats.push(faceMat);
    targets['echo' + s.i] = plate;
    anchors['echo' + s.i] = { x: s.x + (s.x < 0 ? 0.95 : -0.95), z: s.z, r: 0.82 };
  }
  // Пульт прослушивания стоит у входа, чтобы порядок можно было повторить.
  const consoleG = dynamic(g, 'mine-echo-console');
  consoleG.position.set(1.55, 0, -1.25);
  box(consoleG, 0.72, 0.92, 0.46, dark, 0, 0.46, 0);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x7a2e50, emissive: 0xa8477c, emissiveIntensity: 1.3, roughness: 0.35 });
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.06, 14), btnMat);
  btn.position.set(0, 0.97, 0);
  consoleG.add(btn);
  targets.echoPanel = consoleG;
  anchors.echoPanel = { x: 1.55, z: -0.10, r: 0.85 };
  addSign(scene, 'ЭХО\nСЛУШАЙ\nИ ПОВТОРИ', -7.96, 1.85, -1.6, Math.PI / 2, 0.95, 0.62);
  return {
    mats,
    pulse(i) {
      const m = mats[i];
      if (!m) return;
      m.emissiveIntensity = 4.2;
    },
    setOpen(on) {
      for (const m of mats) {
        m.emissive.set(on ? 0xd8b6d2 : 0x8a4a72);
        m.emissiveIntensity = on ? 1.7 : 0.55;
      }
    },
    decay(dt) {
      for (const m of mats) {
        if (m.emissiveIntensity > 0.6) m.emissiveIntensity = Math.max(0.6, m.emissiveIntensity - dt * 5.2);
      }
    }
  };
}

// Чёрный горизонт: запорный рычаг. Вентили только выставляют давление, рычаг фиксирует.
function addPressureLock(scene, targets, anchors) {
  const g = dynamic(scene, 'mine-pressure-lock');
  const metal = pbrMat('Metal032', 1, 1, { color: 0x6b705c, roughness: 0.64, normalScale: 0.4 });
  box(g, 0.34, 0.78, 0.28, metal, 1.25, 0.39, -9.55);
  const pivot = dynamic(g, 'mine-pressure-lock-handle');
  pivot.position.set(1.25, 0.92, -9.55);
  const arm = box(pivot, 0.06, 0.55, 0.06, metal, 0, 0.26, 0);
  arm.castShadow = false;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, emissive: 0x5a2a1e, emissiveIntensity: 0.5, roughness: 0.55 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), lampMat);
  lamp.position.set(1.25, 1.06, -9.30);
  g.add(lamp);
  targets.pressureLock = pivot;
  anchors.pressureLock = { x: 0.55, z: -9.35, r: 0.78 };
  return {
    set(on) {
      pivot.rotation.x = on ? -0.55 : 0.45;
      lampMat.emissive.set(on ? 0x6fae62 : 0x5a2a1e);
      lampMat.color.set(on ? 0x33502c : 0x3a2a20);
      lampMat.emissiveIntensity = on ? 1.5 : 0.5;
    }
  };
}


// ---------- шахтный антураж: простор, крепь, кабели, бочки, кости ----------
function addMineDressing(scene, level) {
  let seed = 911 + level * 37;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const metal = pbrMat('Metal032', 1, 1, { color: 0x5d635c, roughness: 0.74, normalScale: 0.45 });
  const wood = pbrMat('Wood051', 1, 2, { color: level === 4 ? 0x6a5663 : 0x7d684c, normalScale: 0.6 });
  const boneMat = mat(0xd6cdb8, 0.9);

  // Боковые ниши: второй ряд стоек и глухие карманы между ними.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = 1.2 - i * 5.2;
      box(scene, 0.18, 2.4, 0.22, wood, side * 6.55, 1.2, z, { rz: side * 0.03 });
      box(scene, 0.18, 2.4, 0.22, wood, side * 6.55, 1.2, z - 2.4, { rz: side * 0.03 });
      box(scene, 0.18, 0.18, 2.6, wood, side * 6.55, 2.35, z - 1.2);
      // дощатый настил в кармане
      box(scene, 1.15, 0.08, 2.3, wood, side * 7.35, 0.05, z - 1.2, { cast: false });
    }
  }

  // Провисшие кабели под кровлей.
  for (let i = 0; i < 9; i++) {
    const z = 5.0 - i * 2.7;
    const x = (i % 2 ? 1 : -1) * (1.4 + (i % 3) * 1.1);
    box(scene, 0.035, 0.035, 2.1, metal, x, 2.62, z, { rx: 0.22 });
    box(scene, 0.035, 0.035, 1.4, metal, x + 0.7, 2.35, z - 1.2, { rx: -0.5 });
  }

  // Бочки, ящики и обломки крепи у стен.
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (5.4 + rnd() * 1.4);
    const z = 4.2 - rnd() * 20;
    if (i % 3 === 0) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.82, 12), metal);
      barrel.position.set(x, 0.41, z);
      barrel.rotation.y = rnd() * 3;
      scene.add(barrel);
    } else {
      box(scene, 0.62 + rnd() * 0.4, 0.5 + rnd() * 0.3, 0.55, wood, x, 0.3, z, { ry: rnd() * 1.2 });
    }
  }

  // Кости и белая шерсть — следы того, что живёт глубже смены.
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (4.6 + rnd() * 2.2), z = 3.4 - rnd() * 19;
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.34 + rnd() * 0.3, 5), boneMat);
    bone.position.set(x, 0.05, z);
    bone.rotation.set(Math.PI / 2, rnd() * 3, rnd() * 0.4);
    scene.add(bone);
  }
  if (level >= 3) {
    const furMat = mat(0xe8e5dc, 0.95);
    for (let i = 0; i < 25; i++) {
      const x = (rnd() - 0.5) * 12, z = 3.0 - rnd() * 20;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.05 + rnd() * 0.05, 6, 5), furMat);
      tuft.position.set(x, 0.04, z);
      tuft.scale.y = 0.35;
      scene.add(tuft);
    }
  }
  addSign(scene, level === 3 ? 'НЕ КОРМИТЬ\nОНО СЛЫШИТ' : level === 2 ? 'ВОДА ДО 38 М\nДАЛЬШЕ НЕ СУЙСЯ' : 'СМЕНА 6\nВНИЗ ТОЛЬКО\nС ЛАМПОЙ',
    level % 2 ? -7.96 : 7.96, 1.8, -14.6, level % 2 ? Math.PI / 2 : -Math.PI / 2, 1.35, 0.72);
}

// ---------- погоня: белый жирный хомяк ----------
function addHamster(scene, targets) {
  const g = dynamic(scene, 'mine-hamster');
  g.visible = false;
  g.position.set(0, 0, -17.2);

  let seed = 4241;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const furCanvas = document.createElement('canvas');
  furCanvas.width = furCanvas.height = 128;
  const fctx = furCanvas.getContext('2d');
  fctx.fillStyle = '#7f7f7f';
  fctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4200; i++) {
    const x = rnd() * 128, y = rnd() * 128;
    const l = Math.round(74 + rnd() * 108);
    fctx.strokeStyle = `rgba(${l},${l},${l},0.42)`;
    fctx.lineWidth = 0.7 + rnd() * 0.9;
    fctx.beginPath();
    fctx.moveTo(x, y);
    fctx.lineTo(x + (rnd() - 0.5) * 2.4, y + 1.6 + rnd() * 5.2);
    fctx.stroke();
  }
  const furBump = new THREE.CanvasTexture(furCanvas);
  furBump.wrapS = furBump.wrapT = THREE.RepeatWrapping;
  furBump.repeat.set(5, 5);

  const fur = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.94, bumpMap: furBump, bumpScale: 0.048, emissive: 0x6e6a5f, emissiveIntensity: 0.40 });
  const furBelly = new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.93, bumpMap: furBump, bumpScale: 0.034, emissive: 0x67635a, emissiveIntensity: 0.36 });
  const furDirty = new THREE.MeshStandardMaterial({ color: 0x9d907a, roughness: 1.0, bumpMap: furBump, bumpScale: 0.05 });
  const furPink = new THREE.MeshStandardMaterial({ color: 0xd8a49c, roughness: 0.92, emissive: 0x33120f, emissiveIntensity: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x080605, roughness: 0.42 });
  const tooth = new THREE.MeshStandardMaterial({ color: 0xd6c9ac, roughness: 0.62, emissive: 0x2a261d, emissiveIntensity: 0.28 });
  const whiskerMat = new THREE.MeshStandardMaterial({ color: 0xc9c0aa, roughness: 0.7 });
  const drool = new THREE.MeshStandardMaterial({ color: 0xd6e0d0, roughness: 0.16, transparent: true, opacity: 0.46 });

  // туша: низкая, тяжёлая, прижата к полу
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 20), fur);
  body.scale.set(1.42, 1.02, 1.62);
  body.position.y = 1.04;
  g.add(body);

  const hump = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), fur);
  hump.scale.set(1.06, 0.84, 1.02);
  hump.position.set(0, 1.60, -0.52);
  g.add(hump);

  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), fur);
  rump.scale.set(1.10, 0.92, 0.96);
  rump.position.set(0, 1.10, -1.22);
  g.add(rump);

  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), fur);
  shoulderL.scale.set(1.0, 0.9, 1.0);
  shoulderL.position.set(-0.86, 1.44, 0.62);
  g.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.86;
  g.add(shoulderR);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), furBelly);
  belly.scale.set(1.02, 0.50, 1.18);
  belly.position.set(0, 0.50, 0.52);
  g.add(belly);

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 9), furPink);
  tail.position.set(0, 0.72, -2.00);
  tail.scale.set(0.62, 0.5, 1.15);
  g.add(tail);

  // передние лапы с предплечьями, чтобы не висели в воздухе
  for (const s2 of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.72, 12), fur);
    arm.position.set(s2 * 0.82, 0.52, 1.10);
    arm.rotation.x = 0.22;
    arm.rotation.z = -s2 * 0.14;
    g.add(arm);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), fur);
    paw.position.set(s2 * 0.88, 0.15, 1.42);
    paw.scale.set(1.0, 0.42, 1.58);
    g.add(paw);
    for (let c = 0; c < 4; c++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.17, 5), tooth);
      claw.position.set(s2 * (0.72 + c * 0.105), 0.09, 1.82 + (c % 2) * 0.03);
      claw.rotation.x = -1.22;
      claw.rotation.z = s2 * 0.07;
      g.add(claw);
    }
    const backPaw = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 9), fur);
    backPaw.position.set(s2 * 1.10, 0.17, -1.10);
    backPaw.scale.set(1.0, 0.40, 1.52);
    g.add(backPaw);
    for (let c = 0; c < 3; c++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.14, 5), tooth);
      claw.position.set(s2 * (0.94 + c * 0.10), 0.10, -0.62 - (c % 2) * 0.04);
      claw.rotation.x = 1.32;
      g.add(claw);
    }
  }

  // голова
  const headGrp = dynamic(g, 'mine-hamster-head');
  headGrp.position.set(0, 1.72, 1.20);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.74, 24, 18), fur);
  head.scale.set(1.0, 0.92, 0.96);
  headGrp.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.60, 18, 14), fur);
  skull.scale.set(1.10, 0.82, 0.92);
  skull.position.set(0, 0.30, -0.30);
  headGrp.add(skull);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 14), fur);
  muzzle.scale.set(0.94, 0.70, 1.14);
  muzzle.position.set(0, -0.12, 0.56);
  headGrp.add(muzzle);

  for (const s2 of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), fur);
    cheek.scale.set(1.0, 0.86, 0.94);
    cheek.position.set(s2 * 0.46, -0.20, 0.30);
    headGrp.add(cheek);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 9), furPink);
  nose.scale.set(1.24, 0.76, 0.80);
  nose.position.set(0, 0.02, 1.04);
  headGrp.add(nose);

  for (const s2 of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.020, 6, 5), dark);
    nostril.position.set(s2 * 0.040, 0.03, 1.085);
    headGrp.add(nostril);
  }

  // уши: небольшие, прижаты к затылку
  for (const s2 of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), fur);
    ear.scale.set(1.0, 0.98, 0.32);
    ear.position.set(s2 * 0.44, 0.50, -0.02);
    ear.rotation.set(-0.30, s2 * 0.34, s2 * 0.20);
    headGrp.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), new THREE.MeshStandardMaterial({ color: 0x6f3f3a, roughness: 0.95 }));
    inner.scale.set(1.0, 0.94, 0.14);
    inner.position.copy(ear.position);
    inner.position.x += s2 * 0.012;
    inner.position.z += 0.082;
    inner.rotation.copy(ear.rotation);
    headGrp.add(inner);
  }

  // глаза: глубокая чёрная глазница и маленький горящий зрачок
  for (const s2 of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 11), dark);
    socket.scale.set(1.0, 1.0, 0.72);
    socket.position.set(s2 * 0.325, 0.20, 0.545);
    headGrp.add(socket);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff8a72, emissive: 0xff2c14, emissiveIntensity: 3.4, roughness: 0.34 }));
    pupil.position.set(s2 * 0.325, 0.20, 0.645);
    headGrp.add(pupil);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 9), fur);
    lid.scale.set(1.04, 0.40, 0.58);
    lid.position.set(s2 * 0.325, 0.295, 0.545);
    lid.rotation.z = -s2 * 0.14;
    headGrp.add(lid);
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 9), furDirty);
    brow.scale.set(1.34, 0.32, 0.52);
    brow.position.set(s2 * 0.325, 0.365, 0.60);
    brow.rotation.z = -s2 * 0.30;
    headGrp.add(brow);
  }

  // пасть
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.40, 18, 12), dark);
  maw.scale.set(0.86, 0.42, 0.48);
  maw.position.set(0, -0.28, 0.78);
  headGrp.add(maw);

  const jawGrp = dynamic(headGrp, 'mine-hamster-jaw');
  jawGrp.position.set(0, -0.40, 0.62);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), fur);
  jaw.scale.set(0.98, 0.30, 0.66);
  jaw.position.set(0, 0, 0);
  jawGrp.add(jaw);

  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 9), furPink);
  tongue.scale.set(0.86, 0.28, 0.80);
  tongue.position.set(0, 0.04, 0.32);
  jawGrp.add(tongue);

  const lip = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 9), dark);
  lip.scale.set(0.98, 0.22, 0.38);
  lip.position.set(0, 0.11, 0.28);
  jawGrp.add(lip);

  // резцы: четыре сверху, четыре снизу, плотно
  for (const s2 of [-1, 1]) {
    for (const k of [0, 1]) {
      const dx = s2 * (0.048 + k * 0.088);
      const len = 0.20 - k * 0.03;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.090, len, 0.055), tooth);
      upper.position.set(dx, -0.12 - len / 2, 1.00 - k * 0.01);
      upper.rotation.x = 0.09;
      upper.rotation.z = s2 * 0.03;
      headGrp.add(upper);
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.105, 0.044), tooth);
      lower.position.set(dx, 0.05, 0.34 - k * 0.01);
      lower.rotation.x = -0.05;
      jawGrp.add(lower);
    }
  }

  // усы
  for (const s2 of [-1, 1]) {
    for (let w = 0; w < 3; w++) {
      const len = 0.20 + w * 0.035;
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0014, len, 4), whiskerMat);
      whisker.position.set(s2 * 0.54, -0.06 + w * 0.10, 0.82);
      whisker.rotation.z = s2 * (Math.PI / 2 - 0.30 + w * 0.16);
      whisker.rotation.y = s2 * -0.26;
      headGrp.add(whisker);
    }
  }

  // слюна
  const drips = [];
  for (const [dx, len, ph] of [[0.09, 0.40, 0], [0.16, 0.28, 1.7], [-0.08, 0.32, 3.1]]) {
    const strand = new THREE.Mesh(new THREE.BoxGeometry(0.024, len, 0.024), drool);
    strand.position.set(dx, -0.44 - len / 2, 0.96);
    headGrp.add(strand);
    drips.push({ mesh: strand, len, ph });
  }

  // грязные клочья
  for (const [x, y, z, r] of [[0.92, 1.42, 0.20, 0.38], [-1.02, 1.02, -0.62, 0.44], [0.22, 2.02, -0.78, 0.30], [-0.48, 0.72, 0.92, 0.26], [0.28, 2.10, 1.20, 0.20]]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), furDirty);
    patch.position.set(x, y, z);
    patch.scale.set(1, 0.52, 1);
    g.add(patch);
  }

  const fill = new THREE.PointLight(0xf4f7ff, 2.40, 9.5, 1.1);
  fill.position.set(0, 3.05, 0.85);
  g.add(fill);

  const rim = new THREE.PointLight(0x9fc4d8, 0.85, 6.5, 1.2);
  rim.position.set(0, 1.75, -2.55);
  g.add(rim);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const sctx = shadowCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.26)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, 0.035, -0.2);
  blob.renderOrder = 1;
  g.add(blob);

  let tt = 0;
  return {
    group: g,
    update(dt, moving) {
      tt += dt;
      const breath = Math.sin(tt * (moving ? 5.6 : 2.2));
      body.scale.y = 1.02 + breath * (moving ? 0.055 : 0.018);
      hump.position.y = 1.60 + breath * 0.02;
      headGrp.position.y = 1.72 + breath * 0.035;
      headGrp.position.z = 1.20 + (moving ? 0.05 : 0);
      headGrp.rotation.y = Math.sin(tt * 0.8) * 0.06;
      headGrp.rotation.x = moving ? 0.06 + Math.sin(tt * 4.4) * 0.02 : 0.03;
      headGrp.rotation.z = Math.sin(tt * 1.5) * 0.035;
      const chew = Math.max(0, Math.sin(tt * (moving ? 6.4 : 2.2)));
      maw.scale.y = 0.42 + chew * (moving ? 0.20 : 0.05);
      jawGrp.position.y = -0.40 - chew * (moving ? 0.095 : 0.028);
      jawGrp.rotation.x = chew * (moving ? 0.10 : 0.03);
      tongue.position.y = 0.04 - chew * 0.035;
      for (const d of drips) {
        d.mesh.scale.y = 0.7 + Math.abs(Math.sin(tt * 1.25 + d.ph)) * 0.55;
        d.mesh.position.y = -0.44 - (d.len * d.mesh.scale.y) / 2;
      }
      fill.intensity = moving ? 2.55 : 2.15;
      rim.intensity = moving ? 0.95 : 0.72;
    }
  };
}

function addLocker(scene, targets, anchors, i, x, z, ry) {
  const g = dynamic(scene, 'mine-locker-' + i);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  const metal = pbrMat('Metal032', 1, 1, { color: 0x49524d, roughness: 0.72, normalScale: 0.42 });
  box(g, 1.0, 2.05, 0.66, metal, 0, 1.02, 0);
  for (const y of [0.55, 1.45]) box(g, 0.98, 0.03, 0.68, metal, 0, y, 0, { cast: false });
  const door = dynamic(g, 'mine-locker-door-' + i);
  door.position.set(-0.49, 0, 0.34);
  const panel = box(door, 0.96, 1.94, 0.05, metal, 0.48, 1.02, 0);
  panel.castShadow = false;
  box(door, 0.05, 0.28, 0.06, metal, 0.86, 1.02, 0.07);
  for (let k = 0; k < 4; k++) box(door, 0.30, 0.025, 0.03, metal, 0.48, 0.35 + k * 0.12, -0.04, { cast: false });
  targets['locker' + i] = door;
  anchors['locker' + i] = { x: x + (ry < 0 ? -1.0 : 1.0), z, r: 0.86 };
  return {
    setHidden(on) { door.rotation.y = on ? -0.12 : -1.75; }
  };
}

function addChaseDoor(scene, targets, anchors, id, z) {
  const g = dynamic(scene, 'mine-chase-door-' + id);
  g.position.set(0, 0, z);
  const metal = pbrMat('Metal032', 1, 2, { color: 0x555d58, roughness: 0.68, normalScale: 0.5 });
  for (const x of [-3.45, 3.45]) box(g, 0.22, 2.85, 0.22, metal, x, 1.42, 0);
  box(g, 7.1, 0.2, 0.24, metal, 0, 2.78, 0);
  const hinge = dynamic(g, 'mine-chase-door-panel-' + id);
  hinge.position.set(-3.3, 0, 0);
  const panel = box(hinge, 6.6, 2.5, 0.16, metal, 3.3, 1.25, 0);
  for (let i = 0; i < 5; i++) box(hinge, 0.08, 2.2, 0.20, metal, 0.6 + i * 1.25, 1.3, 0.02, { cast: false });
  box(hinge, 0.12, 0.6, 0.12, metal, 6.2, 1.2, 0.18);
  targets[id] = hinge;
  anchors[id] = { x: 3.7, z, r: 0.95 };
  let closed = false;
  return {
    z,
    get closed() { return closed; },
    setClosed(v) {
      closed = !!v;
      hinge.rotation.y = closed ? 0 : -1.45;
    }
  };
}

function addChaseSet(scene, targets, anchors) {
  const hamster = addHamster(scene, targets);
  const lockers = [
    addLocker(scene, targets, anchors, 0, -7.05, -3.5, Math.PI / 2),
    addLocker(scene, targets, anchors, 1, 7.05, -8.5, -Math.PI / 2),
    addLocker(scene, targets, anchors, 2, -7.05, -14.5, Math.PI / 2)
  ];
  const doors = {
    doorA: addChaseDoor(scene, targets, anchors, 'doorA', -5.9),
    doorB: addChaseDoor(scene, targets, anchors, 'doorB', -12.4)
  };
  let active = false;
  let hidden = false;
  let stun = 0;
  let doorCool = 0;
  let hiddenLocker = -1;
  let t = 0;
  const pos = new THREE.Vector3(0, 0, -17.0);
  const lastSeen = new THREE.Vector3(0, 0, -8.0);
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  return {
    start() {
      active = true;
      hidden = false;
      stun = 1.0;
      doorCool = 0;
      pos.set(0, 0, -17.0);
      lastSeen.set(0, 0, -10.0);
      hamster.group.visible = true;
      hamster.group.position.copy(pos);
      for (const l of lockers) l.setHidden(false);
      doors.doorA.setClosed(false);
      doors.doorB.setClosed(false);
    },
    stop() {
      active = false;
      hidden = false;
      hamster.group.visible = false;
      for (const l of lockers) l.setHidden(false);
    },
    setHidden(on) {
      hidden = !!on;
      if (!hidden) lockers.forEach((l) => l.setHidden(false));
    },
    setLockerHidden(i, on) {
      hiddenLocker = on ? i : -1;
      lockers.forEach((l, k) => l.setHidden(!!on && k === i));
    },
    setDoor(id, closedV) {
      if (doors[id]) doors[id].setClosed(closedV);
    },
    isDoorClosed(id) { return !!(doors[id] && doors[id].closed); },
    isActive() { return active; },
    isHidden() { return hidden; },
    distance(camera) {
      return Math.hypot(hamster.group.position.x - camera.position.x, hamster.group.position.z - camera.position.z);
    },
    tick(dt, camera) {
      if (!active) { hamster.group.visible = false; return; }
      t += dt;
      stun = Math.max(0, stun - dt);
      doorCool = Math.max(0, doorCool - dt);
      const targetX = hidden ? lastSeen.x : camera.position.x;
      const targetZ = hidden ? lastSeen.z : camera.position.z;
      if (!hidden) lastSeen.set(camera.position.x, 0, camera.position.z);
      const dx = targetX - pos.x;
      const dz = targetZ - pos.z;
      const d = Math.hypot(dx, dz);
      let moving = false;
      if (stun <= 0 && d > 0.75) {
        const step = Math.min(d, 4.0 * dt);
        pos.x += (dx / d) * step;
        pos.z += (dz / d) * step;
        hamster.group.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
      pos.x = clamp(pos.x, -7.0, 7.0);
      pos.z = clamp(pos.z, -18.3, 6.3);
      hamster.group.position.set(pos.x, 0, pos.z);
      for (const door of Object.values(doors)) {
        if (!door.closed || doorCool > 0) continue;
        if (Math.abs(pos.z - door.z) < 0.62) {
          stun = 2.25;
          doorCool = 4.0;
          pos.z += pos.z > door.z ? 0.9 : -0.9;
          hamster.group.position.z = pos.z;
        }
      }
      hamster.update(dt, moving);
      if (hidden && d < 1.25) {
        // оно обнюхивает шкаф, но не открывает
        lastSeen.x += Math.sin(t * 1.7) * 0.004;
      }
    }
  };
}

function addCore(scene, targets) {
  const pedestal = dynamic(scene, 'mine-zero-core');
  pedestal.position.set(0, 0, -7.4);
  const pedestalMetal = pbrMat('Metal032', 1, 1, { color: 0x574c58, roughness: 0.58, normalScale: 0.45 });
  box(pedestal, 1.2, 0.72, 1.2, pedestalMetal, 0, 0.36, 0);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xe4d9e6, emissive: 0xd783ae, emissiveIntensity: 3.8, roughness: 0.18, metalness: 0.15 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.43, 1), coreMat);
  core.position.y = 1.36;
  pedestal.add(core);
  const rings = [];
  const ringMetal = pbrMat('Metal032', 1, 1, { color: 0xa57a98, roughness: 0.45, normalScale: 0.35 });
  for (const r of [0.62, 0.82]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 7, 38), ringMetal);
    ring.position.y = 1.36;
    ring.rotation.x = 0.65 + r;
    pedestal.add(ring);
    rings.push(ring);
  }
  const light = new THREE.PointLight(0xee8ab9, 10, 8, 2);
  light.position.y = 1.5;
  pedestal.add(light);
  targets.core = pedestal;
  return { core, rings, light };
}

function createMineLevel(level) {
  const cfg = LEVELS[level];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.bg);
  scene.fog = new THREE.FogExp2(cfg.fog, cfg.fogDensity);
  const bounds = { minX: -8, maxX: 8, minZ: -19, maxZ: 7 };
  const colliders = [];
  const targets = {};
  const wallMat = pbrMat('Concrete034', 3.5, 1.4, { color: cfg.wall, normalScale: 0.8 });
  const floorOptions = { color: cfg.floor, normalScale: 0.65 };
  if (level === 4) {
    // Real floor albedo, not an opaque overlay; Concrete034 still supplies relief/roughness.
    floorOptions.map = tex('assets/tex/generated/organic_grime.png', 4, 7);
    floorOptions.color = 0x9b8794;
  }
  const floorMat = pbrMat('Concrete034', 5.5, 8, floorOptions);
  const timber = pbrMat('Wood051', 1, 3, {
    color: level === 4 ? 0x75606d : 0x8b7658,
    normalScale: 0.65
  });
  const railMat = pbrMat('Metal032', 1, 6, { color: 0x747a75, roughness: 0.72, normalScale: 0.5 });

  // Просторный штрек: 16 × 26 м вместо прежней узкой галереи. Боковые ниши,
  // второй ряд крепи и глубокая тень дают ощущение настоящей выработки.
  plane(scene, 16.4, 26.6, floorMat, 0, 0, -6, 0, -Math.PI / 2);
  plane(scene, 16.4, 26.6, mat(0x1b1d1a, 0.98), 0, 3.05, -6, 0, Math.PI / 2);
  box(scene, 0.40, 3.2, 26.9, wallMat, -8.18, 1.50, -6);
  box(scene, 0.40, 3.2, 26.9, wallMat, 8.18, 1.50, -6);
  box(scene, 16.8, 3.2, 0.40, wallMat, 0, 1.50, 7.18);
  box(scene, 16.8, 3.2, 0.40, wallMat, 0, 1.50, -19.18);

  // Крепь становится всё более покорёженной с глубиной.
  for (let i = 0; i < 9; i++) {
    const z = 5.4 - i * 3.0;
    const lean = level === 4 ? (i % 2 ? 0.13 : -0.11) : (level === 3 && i % 3 === 0 ? 0.075 : 0);
    box(scene, 0.26, 2.72, 0.30, timber, -7.36, 1.36, z, { rz: lean });
    box(scene, 0.26, 2.72, 0.30, timber, 7.36, 1.36, z, { rz: -lean });
    box(scene, 14.95, 0.24, 0.32, timber, 0, 2.70, z, { rz: lean * 0.4 });
    colliders.push({ minX: -7.52, maxX: -7.18, minZ: z - 0.22, maxZ: z + 0.22 });
    colliders.push({ minX: 7.18, maxX: 7.52, minZ: z - 0.22, maxZ: z + 0.22 });
  }

  if (level < 4) {
    for (const x of [-0.46, 0.46]) box(scene, 0.065, 0.055, 25.6, railMat, x, 0.035, -6.0, { cast: false });
    for (let i = 0; i < 23; i++) box(scene, 1.25, 0.045, 0.13, timber, 0, 0.022, 5.8 - i * 1.12, { cast: false });
  } else {
    // Рельсы нулевого горизонта обрываются и уходят вверх — ориентир перестаёт работать.
    box(scene, 0.065, 0.055, 7.0, railMat, -0.46, 0.035, 1.4, { cast: false, rz: 0.015 });
    box(scene, 0.065, 0.055, 5.2, railMat, 0.46, 0.24, 0.3, { cast: false, rx: -0.10 });
    for (let i = 0; i < 7; i++) box(scene, 1.25, 0.045, 0.13, timber, 0, 0.022 + i * 0.025, 4.5 - i * 1.0, { cast: false, rz: (i - 3) * 0.035 });
  }

  // Световые точки: исправные сверху, редкие и больные внизу.
  const pointLights = [];
  const bulbMaterials = [];
  for (let i = 0; i < 5; i++) {
    const z = 4.6 - i * 5.6;
    const bm = new THREE.MeshStandardMaterial({ color: cfg.light, emissive: cfg.light, emissiveIntensity: level === 4 ? 1.4 : 2.8 });
    bulbMaterials.push(bm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), bm);
    bulb.position.set(i % 2 ? 2.4 : -2.4, 2.55, z);
    scene.add(bulb);
    box(scene, 0.015, 0.48, 0.015, railMat, bulb.position.x, 2.82, z, { cast: false });
    const light = new THREE.PointLight(cfg.light, cfg.intensity * (i >= 3 && level > 1 ? 0.55 : 1), 11, 2);
    light.position.set(bulb.position.x, 2.35, z);
    scene.add(light);
    pointLights.push(light);
  }
  scene.add(new THREE.HemisphereLight(cfg.hemi, 0x080908, level === 1 ? 1.35 : 0.86));
  scene.add(new THREE.AmbientLight(cfg.hemi, level === 4 ? 0.18 : 0.22));

  addLadder(scene, targets);
  addLift(scene, targets);
  // Корни остаются живыми целями взаимодействия/подсветки, а их неподвижные
  // прутья объединяются локально: 24 меша превращаются в три color-pass draw call.
  mergeStaticMeshes(targets.up);
  mergeStaticMeshes(targets.down);
  addSign(scene, `${cfg.name}\n${cfg.depth}`, -2.65, 1.65, 5.97, Math.PI, 2.25, 0.75,
    level >= 3 ? '#c6b2a9' : '#d8cfb4', level === 4 ? '#29151f' : '#252720');

  const anchors = {
    up: { x: 0, z: 4.65, r: 1.15 },
    down: { x: 0, z: -17.25, r: 1.45 }
  };
  let gasPanel = null;
  let pumpRig = null;
  let echoArray = null;
  let water = null;
  let waterTarget = 0.055;
  let pressureA = 0;
  let pressureB = 0;
  let gaugeA = null;
  let gaugeB = null;
  let pressureLock = null;
  let chaseSet = null;
  const emergency = [];

  if (level === 1) {
    // Стол ламповщика и контора сменщика.
    box(scene, 1.55, 0.10, 0.75, timber, -3.25, 0.79, 2.0);
    for (const dx of [-0.63, 0.63]) box(scene, 0.10, 0.75, 0.55, timber, -3.25 + dx, 0.375, 2.0);
    colliders.push({ minX: -4.1, maxX: -2.4, minZ: 1.55, maxZ: 2.45 });
    addLamp(scene, targets, -3.25, 0.84, 2.0);
    anchors.lamp = { x: -2.25, z: 2.0, r: 1.05 };

    box(scene, 1.35, 0.10, 0.85, timber, 3.15, 0.78, -5.6);
    box(scene, 1.25, 0.72, 0.72, mat(0x3c3e35, 0.75), 3.15, 0.38, -5.6);
    colliders.push({ minX: 2.4, maxX: 3.9, minZ: -6.1, maxZ: -5.1 });
    addKey(scene, targets, 3.12, 0.8417, -5.55);
    anchors.key = { x: 2.2, z: -5.55, r: 1.10 };

    addCrowbar(scene, targets, -3.55, 0.00964, -7.8);
    anchors.crowbar = { x: -3.35, z: -7.65, r: 0.95 };
    addDocument(scene, targets, 'shiftLog', 'СМЕНА 6\nНЕ СПУСКАТЬСЯ\nНИЖЕ 38 М\nСТЕФАН', -7.96, 1.5, -1.8, Math.PI / 2);
    anchors.shiftLog = { x: -6.9, z: -1.8, r: 1.0 };
    addDocument(scene, targets, 'townMap', 'ВЕЛИЧКА\n7 ДОМОВ\nШАХТА\n8-Й ДОМ', 7.96, 1.45, 3.0, -Math.PI / 2);
    anchors.townMap = { x: 6.9, z: 3.0, r: 1.0 };
    addMiner(scene, targets);
    anchors.foreman = { x: 2.65, z: 0.35, r: 1.35 };
    gasPanel = addGasPanel(scene, targets, anchors);

    // Забитая вагонетка: рядовой рабочий вид верхнего этажа.
    const cartMetal = pbrMat('Metal032', 1, 1, { color: 0x747d72, roughness: 0.72, normalScale: 0.55 });
    box(scene, 1.25, 0.62, 1.45, cartMetal, 2.95, 0.57, -2.4);
    for (const dx of [-0.48, 0.48]) for (const dz of [-0.48, 0.48]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.09, 12), railMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(2.95 + dx, 0.20, -2.4 + dz);
      scene.add(wheel);
    }
    colliders.push({ minX: 2.2, maxX: 3.7, minZ: -3.25, maxZ: -1.55 });
  }

  let powerIndicator = null;
  if (level === 2) {
    water = plane(scene, 9.95, 17.7,
      new THREE.MeshStandardMaterial({ color: 0x1c4a57, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.42, depthWrite: false }),
      0, 0.055, -3.0, 0, -Math.PI / 2);
    water.name = 'mine-flood-water';
    box(scene, 1.6, 0.10, 0.75, timber, -3.3, 0.82, -5.9);
    const pumpMetal = pbrMat('Metal032', 1, 1, { color: 0x60787c, roughness: 0.75, normalScale: 0.5 });
    box(scene, 1.45, 0.78, 0.65, pumpMetal, -3.3, 0.40, -5.9);
    colliders.push({ minX: -4.15, maxX: -2.45, minZ: -6.35, maxZ: -5.45 });
    addFuse(scene, targets, -3.3, 0.928, -5.9);
    anchors.fuse = { x: -2.25, z: -5.9, r: 1.05 };
    powerIndicator = addPanel(scene, targets);
    anchors.panel = { x: 3.85, z: -8.2, r: 1.15 };
    box(scene, 1.1, 0.65, 0.8, timber, 3.45, 0.33, 2.1);
    colliders.push({ minX: 2.85, maxX: 4.05, minZ: 1.65, maxZ: 2.55 });
    addFilter(scene, targets, 'filter2', 3.45, 0.655, 2.1);
    anchors.filter2 = { x: 2.65, z: 2.1, r: 1.0 };
    pumpRig = addPumpRig(scene, targets, anchors);
    addDocument(scene, targets, 'floodNote', 'ВОДА ИДЁТ\nСВЕРХУ\nЛЕВЫЙ → ПРАВЫЙ\nПОТОМ СРЕДНИЙ', -7.96, 1.45, 0.0, Math.PI / 2);
    anchors.floodNote = { x: -6.9, z: 0.0, r: 1.0 };
    addDocument(scene, targets, 'krakowOrder', 'ОБЪЕКТ 6\nПЕРЕДАТЬ\nКРАКОВУ\nНЕ ВСКРЫВАТЬ', 7.96, 1.5, -2.8, -Math.PI / 2);
    anchors.krakowOrder = { x: 6.9, z: -2.8, r: 1.0 };
    // Трубы и обрушенная порода перекрывают края, но не центральный маршрут.
    for (const x of [-4.65, 4.65]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 15.5, 10), railMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, 1.85, -2.5);
      scene.add(pipe);
    }
    for (let i = 0; i < 9; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34 + (i % 3) * 0.10, 0), mat(0x3d4b4d, 0.98));
      rock.position.set((i % 2 ? -1 : 1) * (3.3 + (i % 3) * 0.25), 0.25, -9.5 + (i % 4) * 0.55);
      rock.rotation.set(i * 0.3, i * 0.7, 0);
      scene.add(rock);
    }
  }

  if (level === 3) {
    addValve(scene, targets, 'valveA', -7.82, -3.8, Math.PI / 2);
    addValve(scene, targets, 'valveB', 7.82, -7.6, -Math.PI / 2);
    anchors.valveA = { x: -6.85, z: -3.8, r: 1.10 };
    anchors.valveB = { x: 6.85, z: -7.6, r: 1.10 };
    gaugeA = addPressureGauge(scene, targets, 'A', -7.90, -4.55, Math.PI / 2);
    gaugeB = addPressureGauge(scene, targets, 'B', 7.90, -6.85, -Math.PI / 2);
    addSign(scene, 'ДАВЛЕНИЕ\n5 АТМ\nЗАЖМИ ЗАПОР', -7.96, 2.05, -5.55, Math.PI / 2, 0.92, 0.58);
    pressureLock = addPressureLock(scene, targets, anchors);
    chaseSet = addChaseSet(scene, targets, anchors);
    box(scene, 1.15, 0.62, 0.82, timber, -3.45, 0.31, 2.0);
    colliders.push({ minX: -4.1, maxX: -2.8, minZ: 1.55, maxZ: 2.45 });
    addFilter(scene, targets, 'filter3', -3.45, 0.62, 2.0);
    anchors.filter3 = { x: -2.65, z: 2.0, r: 1.0 };
    addDocument(scene, targets, 'blackNote', 'СЧЁТЧИК МОЛЧИТ\nНЕ ВЕРЬ ЕМУ\nМОЛЧАНИЕ\nТОЖЕ ФОН', -7.96, 1.45, -8.7, Math.PI / 2);
    anchors.blackNote = { x: -6.9, z: -8.7, r: 1.0 };
    addDocument(scene, targets, 'namesNote', 'СТЕФАН\nМАРЕК\nХОМКА\n— ВСЕ В СМЕНЕ', 7.96, 1.48, 1.8, -Math.PI / 2);
    anchors.namesNote = { x: 6.9, z: 1.8, r: 1.0 };
    for (const [ex, ez] of [[-2.8, -3.6], [2.8, -9.2], [-2.8, -15.2]]) {
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x5a1712, emissive: 0xff4a38, emissiveIntensity: 2.4, roughness: 0.4 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lampMat);
      lamp.position.set(ex, 2.35, ez);
      scene.add(lamp);
      const glow = new THREE.PointLight(0xff5a44, 3.4, 9, 2);
      glow.position.set(ex, 2.1, ez);
      scene.add(glow);
      emergency.push({ light: glow, mat: lampMat, phase: ez * 0.7 });
    }
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x51703a, emissive: 0x3d6126, emissiveIntensity: 1.05, roughness: 0.5 });
    for (let i = 0; i < 22; i++) {
      const h = 0.24 + (i % 5) * 0.11;
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.10 + (i % 3) * 0.035, h, 5), crystalMat);
      const side = i % 2 ? -1 : 1;
      crystal.position.set(side * (5.9 + (i % 4) * 0.26), h / 2, 4.2 - Math.floor(i / 2) * 1.45);
      crystal.rotation.z = side * (0.10 + (i % 3) * 0.10);
      scene.add(crystal);
    }
  }

  let coreAnim = null;
  if (level === 4) {
    coreAnim = addCore(scene, targets);
    echoArray = addEchoArray(scene, targets, anchors);
    anchors.core = { x: 0, z: -5.65, r: 1.45 };
    colliders.push({ minX: -0.72, maxX: 0.72, minZ: -8.12, maxZ: -6.68 });
    addDocument(scene, targets, 'zeroNote', 'ДЕНЬ 8\nСМЕНА КОНЧИЛАСЬ\nДОМ ОСТАЛСЯ\nНАВЕРХУ', -7.96, 1.48, -3.4, Math.PI / 2);
    anchors.zeroNote = { x: -6.9, z: -3.4, r: 1.0 };
    addDocument(scene, targets, 'lastLetter', 'МАМА\nЯ ДОШЁЛ\nНЕ СТУЧУ\nЧТОБЫ НЕ БУДИТЬ', 7.96, 1.45, -9.0, -Math.PI / 2);
    anchors.lastLetter = { x: 6.9, z: -9.0, r: 1.0 };
    const rockMat = mat(0x3c2d39, 0.90, { metalness: 0.08 });
    for (let i = 0; i < 18; i++) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + (i % 4) * 0.18, 0), rockMat);
      const side = i % 2 ? -1 : 1;
      rock.position.set(side * (4.25 + (i % 3) * 0.30), 0.5 + (i % 5) * 0.48, 4.5 - Math.floor(i / 2) * 1.85);
      rock.scale.set(1.2, 0.75 + (i % 3) * 0.2, 1.0);
      rock.rotation.set(i * 0.41, i * 0.27, i * 0.15);
      scene.add(rock);
    }
    const snowCount = 170;
    const pos = new Float32Array(snowCount * 3);
    let seed = 6143;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < snowCount; i++) {
      pos[i * 3] = (rnd() - 0.5) * 9.5;
      pos[i * 3 + 1] = rnd() * 2.8;
      pos[i * 3 + 2] = 5.5 - rnd() * 17;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xe6d5e1, size: 0.026, transparent: true, opacity: 0.65, depthWrite: false }));
    snow.userData.dynamic = true;
    scene.add(snow);
    coreAnim.snow = snow;
  }

  const playerLight = new THREE.PointLight(0xffd49a, 0.8, 7, 2);
  scene.add(playerLight);

  // Мелкая пыль, детерминированная для повторяемых кадров.
  if (level < 4) {
    const count = 90;
    const pos = new Float32Array(count * 3);
    let seed = 7919 + level * 101;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 9.5;
      pos[i * 3 + 1] = 0.15 + rnd() * 2.5;
      pos[i * 3 + 2] = 5.5 - rnd() * 17;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: cfg.light, size: 0.018, transparent: true, opacity: 0.28, depthWrite: false }));
    dust.userData.dynamic = true;
    dust.name = 'mine-dust';
    scene.add(dust);
  }

  addMineDressing(scene, level);
  addMineDecals(scene, level);

  batchStaticMeshes(scene);

  let t = 0;
  let powered = false;
  function update(dt, camera) {
    t += dt;
    if (chaseSet) chaseSet.tick(dt, camera);
    if (pumpRig) pumpRig.tick(dt);
    for (const e of emergency) {
      const k = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.1 + e.phase));
      e.light.intensity = 3.4 * k;
      e.mat.emissiveIntensity = 2.4 * k;
    }
    if (echoArray) echoArray.decay(dt);
    if (water) {
      water.position.y += (waterTarget - water.position.y) * Math.min(1, dt * 1.7);
      const k = Math.max(0, Math.min(1, (water.position.y + 0.30) / 0.355));
      water.material.opacity = 0.42 * k;
    }
    playerLight.position.copy(camera.position);
    playerLight.position.y -= 0.18;
    for (let i = 0; i < pointLights.length; i++) {
      const base = cfg.intensity * (i === 2 && level > 1 ? 0.65 : 1);
      const flicker = level === 1 ? 0.05 : 0.16 + level * 0.06;
      const powerK = level === 2 && !powered ? 0.24 : 1;
      pointLights[i].intensity = base * powerK * (1 + Math.sin(t * (8.3 + i * 2.1)) * flicker + (Math.sin(t * 1.7 + i) > 0.985 ? -0.65 : 0));
      bulbMaterials[i].emissiveIntensity = 2.5 * powerK;
    }
    if (coreAnim) {
      coreAnim.core.rotation.y += dt * 0.38;
      coreAnim.core.position.y = 1.36 + Math.sin(t * 1.2) * 0.08;
      coreAnim.rings[0].rotation.y += dt * 0.42;
      coreAnim.rings[1].rotation.z -= dt * 0.31;
      coreAnim.light.intensity = 9 + Math.sin(t * 2.7) * 2;
      const attr = coreAnim.snow.geometry.attributes.position;
      for (let i = 0; i < attr.count; i++) {
        let y = attr.getY(i) + dt * (0.08 + (i % 5) * 0.018);
        if (y > 2.85) y = 0.02;
        attr.setY(i, y);
      }
      attr.needsUpdate = true;
    }
  }

  return {
    id: `mine${level}`, level, scene, bounds, colliders, targets, anchors,
    spawn: { x: 0, z: 3.9 }, airRate: cfg.airRate, title: cfg.name, depth: cfg.depth,
    playerLight, update,
    setLamp(on) { playerLight.intensity = on ? 7.5 : 0.65; playerLight.distance = on ? 10 : 4; },
    setPower(on) {
      powered = !!on;
      if (powerIndicator) {
        powerIndicator.color.set(on ? 0x6ca66b : 0x7d2824);
        powerIndicator.emissive.set(on ? 0x66d879 : 0xa92922);
      }
    },
    setValve(id, pos) {
      const valve = targets[id];
      if (valve) valve.rotation.z = (Number(pos) || 0) * Math.PI * 0.5;
    },
    setLevers(values) {
      if (gasPanel) gasPanel.set(values);
    },
    setPumps(on, order) {
      if (pumpRig) pumpRig.set(on, order);
    },
    setWater(drained) {
      waterTarget = drained ? -0.30 : 0.055;
    },
    setPressure(a, b) {
      pressureA = Number(a) || 0;
      pressureB = Number(b) || 0;
      if (gaugeA) gaugeA.set(pressureA);
      if (gaugeB) gaugeB.set(pressureB);
    },
    setPressureLock(on) {
      if (pressureLock) pressureLock.set(on);
    },
    setEchoOpen(on) {
      if (echoArray) echoArray.setOpen(on);
    },
    pulseEcho(i) {
      if (echoArray) echoArray.pulse(i);
    },
    startChase() { if (chaseSet) chaseSet.start(); },
    stopChase() { if (chaseSet) chaseSet.stop(); },
    setChaseHidden(on) { if (chaseSet) chaseSet.setHidden(on); },
    setChaseLocker(i, on) { if (chaseSet) chaseSet.setLockerHidden(i, on); },
    setChaseDoor(id, closed) { if (chaseSet) chaseSet.setDoor(id, closed); },
    isChaseDoorClosed(id) { return !!(chaseSet && chaseSet.isDoorClosed(id)); },
    isChaseActive() { return !!(chaseSet && chaseSet.isActive()); },
    chaseDistance(camera) { return chaseSet ? chaseSet.distance(camera) : Infinity; }
  };
}

export function buildMineScenes() {
  return {
    mine1: createMineLevel(1),
    mine2: createMineLevel(2),
    mine3: createMineLevel(3),
    mine4: createMineLevel(4)
  };
}
