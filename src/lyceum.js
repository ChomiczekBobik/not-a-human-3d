// lyceum.js — ЛИЦЕЙ «ВЕЛИЧКА» на улице Велички (экстерьер, вид с улицы).
// Главный герой учится здесь; со второго дня сюда пойдёт сюжет — поэтому модуль
// отдельный: интерьер дня 2 (пустой и мрачный) будет собираться в этом же файле.
// Расположение: правая сторона улицы, двор z −14.5..−30.5, фасад смотрит на улицу (−x).
import * as THREE from 'three';
import { mat, matTex, box, plane, tex, pbrMat } from './mats.js';
import { decal, dampPaperMaterial, organicFloorMaterial } from './details.js';
import { batchStaticMeshes } from './static_batch.js';
import { createDoubleDoor } from './doors.js';

export function buildLyceumStreet(scene) {
  const Z = -22.5; // ось двора и вестибюля

  // ---------- материалы ----------
  const wallMat = pbrMat('Concrete034', 3, 2.4, { color: 0x929089, normalScale: 0.4, roughness: 0.97 });
  const trimMat = mat(0xd8d4ca, 0.85);     // карниз
  const plinthMat = pbrMat('Concrete034', 1, 1, { color: 0x45484e, normalScale: 0.55, roughness: 0.98 });
  const doorMat = pbrMat('Wood051', 1, 2, { color: 0x34302d, normalScale: 0.54, roughness: 0.94 });
  const fenceMat = pbrMat('Metal032', 1, 2, { color: 0x3b4147, normalScale: 0.5, roughness: 0.78 });
  const stepsMat = pbrMat('Concrete034', 1, 1, { color: 0x82827e, normalScale: 0.44, roughness: 0.96 });
  const woodMat = pbrMat('Wood051', 1, 0.5, { color: 0x625444, normalScale: 0.55, roughness: 0.95 });
  const winDead = matTex('assets/tex/win_dead.png', 1, 1, 0xb8bec8, 0.4);
  const winLit = new THREE.MeshStandardMaterial({
    map: tex('assets/tex/win_lit.png'), emissive: 0xffc878,
    emissiveMap: tex('assets/tex/win_lit.png'), emissiveIntensity: 1.25, roughness: 0.5
  });
  const winBoard = matTex('assets/tex/win_board.png', 1, 1, 0xa8a49a, 0.9);
  const signMat = new THREE.MeshStandardMaterial({
    map: tex('assets/tex/sign_lyceum.png'), emissive: 0xffffff,
    emissiveMap: tex('assets/tex/sign_lyceum.png'), emissiveIntensity: 0.85, roughness: 0.5
  });
  const glowMat = new THREE.MeshBasicMaterial({
    map: tex('assets/tex/glow_spill.png'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  });

  // ---------- корпус ----------
  box(scene, 8, 9.6, 16, wallMat, 8.2, 4.8, Z);          // главный блок, фасад на x=4.2
  box(scene, 1.1, 6.2, 5.2, wallMat, 3.75, 3.1, Z);      // вестибюль, фасад на x=3.2
  box(scene, 0.25, 0.14, 16.2, trimMat, 4.08, 9.72, Z);  // карниз по фасаду
  box(scene, 0.18, 0.5, 16.2, plinthMat, 4.08, 0.25, Z); // цоколь
  box(scene, 0.8, 0.6, 0.8, plinthMat, 7.4, 9.9, -18.8); // крышный блок
  box(scene, 0.5, 1.1, 0.5, plinthMat, 9.6, 10.15, -27); // труба

  // ---------- окна (рамки нарисованы в текстуре — ноль лишних мешей) ----------
  const winGeo = new THREE.PlaneGeometry(1.2, 1.5);
  const addWin = (m, y, z) => {
    const w = new THREE.Mesh(winGeo, m);
    w.position.set(4.18, y, z);
    w.rotation.y = -Math.PI / 2;
    scene.add(w);
  };
  const cols = [-28.9, -26.2, -23.6, -20.9, -18.3, -15.6];
  for (let r = 0; r < 3; r++) {
    const y = 2.0 + r * 2.6;
    for (const z of cols) {
      if (r < 2 && z > -25.4 && z < -19.6) continue; // за вестибюлем
      if (r === 0 && z === -28.9) { addWin(winBoard, y, z); continue; }
      const lit = (r === 0 && z === -15.6) || (r === 1 && z === -26.2) || (r === 2 && z === -18.3);
      addWin(lit ? winLit : winDead, y, z);
    }
  }
  // окно вестибюля над входом
  const wv = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2), winDead);
  wv.position.set(3.13, 4.5, Z);
  wv.rotation.y = -Math.PI / 2;
  scene.add(wv);

  // ---------- вход ----------
  const entranceDoor = createDoubleDoor(scene, {
    x: 3.16, z: Z, rotationY: Math.PI / 2, width: 1.5, height: 2.2,
    material: doorMat
  });
  decal(scene, 'assets/tex/generated/mold.png', 0.88, 1.52,
    3.178, 0.82, Z + 1.58, -Math.PI / 2, 0, 0.74, 0x68715f);
  box(scene, 0.9, 0.09, 3.4, plinthMat, 3.15, 3.35, Z);           // козырёк
  for (const [sx, sy, sw] of [[3.35, 0.06, 2.0], [3.2, 0.16, 1.8], [3.05, 0.26, 1.6]]) {
    box(scene, 0.4, 0.12, sw, stepsMat, sx - 0.1, sy, Z);          // ступени к улице
  }
  const porchMat = new THREE.MeshStandardMaterial({ color: 0xffd8a0, emissive: 0xffc070, emissiveIntensity: 2.2 });
  const porch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), porchMat);
  porch.position.set(3.05, 3.55, Z);
  scene.add(porch);
  // вывеска
  // Нижний край вывески выше окна (его верх y=5.1): раньше плоскости
  // перекрывались на одном x=3.13 и давали цветную рябь в перекрытии.
  plane(scene, 3.4, 0.85, signMat, 3.13, 5.65, Z, -Math.PI / 2);
  // пятна света на снегу (добавка, не источники света)
  plane(scene, 3.2, 3.2, glowMat, 3.0, 0.02, Z, 0, -Math.PI / 2);
  plane(scene, 1.7, 1.7, glowMat, 3.95, 0.018, -15.6, 0, -Math.PI / 2);
  plane(scene, 1.7, 1.7, glowMat, 3.95, 0.018, -26.2, 0, -Math.PI / 2);

  // ---------- флагшток ----------
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 5.4, 8), fenceMat);
  pole.position.set(3.7, 6.2 + 2.7, Z);
  scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.72),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/flag_lyceum.png'), side: THREE.DoubleSide, roughness: 0.9 }));
  flag.position.set(3.7, 10.6, Z + 0.4);
  flag.rotation.set(0, -Math.PI / 2, 0.12);
  scene.add(flag);

  // ---------- ограда двора (фронт x=3.3, калитка у вестибюля) ----------
  const segs = [[-30.5, -23.7], [-21.3, -14.5]]; // пролёты по z (между ними калитка 2.4 м)
  for (const [z0, z1] of segs) {
    const zm = (z0 + z1) / 2, len = z1 - z0;
    box(scene, 0.05, 0.05, len, fenceMat, 3.3, 0.55, zm);
    box(scene, 0.05, 0.05, len, fenceMat, 3.3, 1.45, zm);
    box(scene, 0.09, 1.85, 0.09, fenceMat, 3.3, 0.93, z0);
    box(scene, 0.09, 1.85, 0.09, fenceMat, 3.3, 0.93, z1);
    const n = Math.floor(len / 0.5);
    for (let i = 1; i < n; i++) box(scene, 0.03, 1.6, 0.03, fenceMat, 3.3, 0.8, z0 + i * 0.5, { cast: false });
  }
  // калитка — обе створки приоткрыты
  const g1 = box(scene, 0.05, 1.4, 1.1, fenceMat, 3.3, 0.75, -21.85, { ry: -0.55 });
  const g2 = box(scene, 0.05, 1.4, 1.1, fenceMat, 3.3, 0.75, -23.15, { ry: 0.55 });

  // ---------- лавка и урна у двора ----------
  box(scene, 0.45, 0.06, 1.5, woodMat, 3.75, 0.42, -18.2);
  box(scene, 0.08, 0.4, 1.5, woodMat, 3.95, 0.62, -18.2);
  for (const [lx, lz] of [[3.6, -17.6], [3.9, -17.6], [3.6, -18.8], [3.9, -18.8]]) {
    box(scene, 0.05, 0.4, 0.05, fenceMat, lx, 0.2, lz, { cast: false });
  }
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.7, 10), plinthMat);
  bin.position.set(3.6, 0.35, -26.6);
  scene.add(bin);

  return { signMat, porchMat, gateZ: Z, entranceDoor };
}

// Текстовые таблички рисуются в canvas: не нужны внешние картинки и шрифты.
function textMaterial(lines, opts = {}) {
  const w = opts.w || 1024;
  const h = opts.h || 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = opts.bg || '#17231f';
  ctx.fillRect(0, 0, w, h);
  if (opts.border !== false) {
    ctx.strokeStyle = opts.borderColor || 'rgba(220,230,215,0.25)';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, w - 28, h - 28);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = opts.y || 80;
  for (const raw of lines) {
    const line = typeof raw === 'string' ? { text: raw } : raw;
    const size = line.size || 46;
    ctx.font = `${line.bold ? '700' : '500'} ${size}px Arial, sans-serif`;
    ctx.fillStyle = line.color || opts.fg || '#d6ddd2';
    ctx.fillText(line.text, w / 2, y);
    y += line.gap || size * 1.35;
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 2;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0 });
}

// Интерьер дня 2: вестибюль → коридор → пустой класс. Людей здесь нет.
export function buildLyceumInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1015);
  scene.fog = new THREE.FogExp2(0x11171c, 0.032);

  const bounds = { minX: -4.85, maxX: 4.85, minZ: -9.9, maxZ: 4.3 };
  const colliders = [];
  const wallMat = pbrMat('Concrete034', 4, 1.6, { color: 0x70756f, normalScale: 0.46, roughness: 0.98 });
  const floorMat = pbrMat('Concrete034', 4, 7, { color: 0x5c635e, normalScale: 0.38, roughness: 0.95 });
  const ceilMat = mat(0x3d4243, 0.96);
  const doorMat = pbrMat('Wood051', 1, 2, { color: 0x303230, normalScale: 0.58, roughness: 0.94 });
  const woodMat = pbrMat('Wood051', 1, 1, { color: 0x625544, normalScale: 0.52, roughness: 0.94 });
  const metalMat = pbrMat('Metal032', 1, 1, { color: 0x596268, normalScale: 0.42, roughness: 0.72 });
  const darkMat = mat(0x14191c, 0.88);

  // Коридор x=-2.1..2.1, z=-3..4. Класс x=-4.6..4.6, z=-9.6..-3.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.7, 14.0), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -2.8);
  floor.receiveShadow = true;
  scene.add(floor);
  plane(scene, 9.7, 14.0, ceilMat, 0, 3.08, -2.8, 0, Math.PI / 2);

  // Стены коридора.
  box(scene, 0.2, 3.1, 7.4, wallMat, -2.25, 1.55, 0.55);
  box(scene, 0.2, 3.1, 7.4, wallMat, 2.25, 1.55, 0.55);
  colliders.push(
    { minX: -2.35, maxX: -2.12, minZ: -3.2, maxZ: 4.25 },
    { minX: 2.12, maxX: 2.35, minZ: -3.2, maxZ: 4.25 }
  );
  // Стены класса и боковые фрагменты у входа в класс.
  box(scene, 0.2, 3.1, 6.8, wallMat, -4.75, 1.55, -6.4);
  box(scene, 0.2, 3.1, 6.8, wallMat, 4.75, 1.55, -6.4);
  box(scene, 2.5, 3.1, 0.2, wallMat, -3.55, 1.55, -3.0);
  box(scene, 2.5, 3.1, 0.2, wallMat, 3.55, 1.55, -3.0);
  box(scene, 9.7, 3.1, 0.2, wallMat, 0, 1.55, -9.8);
  colliders.push(
    { minX: -4.86, maxX: -4.62, minZ: -9.9, maxZ: -2.9 },
    { minX: 4.62, maxX: 4.86, minZ: -9.9, maxZ: -2.9 },
    { minX: -4.8, maxX: -2.2, minZ: -3.12, maxZ: -2.88 },
    { minX: 2.2, maxX: 4.8, minZ: -3.12, maxZ: -2.88 },
    { minX: -4.85, maxX: 4.85, minZ: -9.92, maxZ: -9.62 }
  );

  // Вход: створки на пружине открываются у игрока; старый сплошной коллайдер
  // удалён, иначе он останавливал камеру в 0.7 м перед реальным проёмом.
  box(scene, 1.35, 3.1, 0.2, wallMat, -1.65, 1.55, 4.2);
  box(scene, 1.35, 3.1, 0.2, wallMat, 1.65, 1.55, 4.2);
  box(scene, 2.0, 0.7, 0.2, wallMat, 0, 2.73, 4.2);
  const entranceDoor = createDoubleDoor(scene, {
    x: 0, z: 4.12, width: 1.84, height: 2.3, material: doorMat
  });
  for (const pivot of entranceDoor.pivots) {
    decal(pivot, 'assets/tex/generated/scratches.png', 0.56, 1.35,
      pivot.position.x < 0 ? 0.46 : -0.46, 1.08, -0.041, Math.PI, 0, 0.66, 0xa9a18e);
  }
  plane(scene, 0.65, 0.26, new THREE.MeshStandardMaterial({ map: tex('assets/tex/sign_exit.png'), emissive: 0x90ffb0, emissiveIntensity: 0.65 }), 0, 2.57, 4.02, Math.PI);

  // Шкафчики в коридоре: один открыт, внутри пусто.
  for (let i = 0; i < 4; i++) {
    const z = 0.95 - i * 0.78;
    box(scene, 0.46, 2.0, 0.72, metalMat, -2.0, 1.0, z);
    box(scene, 0.03, 1.84, 0.64, i === 2 ? darkMat : metalMat, -1.75, 1.0, z, { cast: false });
    box(scene, 0.03, 0.08, 0.04, metalMat, -1.72, 1.05, z + 0.22, { cast: false });
  }
  colliders.push({ minX: -2.26, maxX: -1.7, minZ: -1.75, maxZ: 1.35 });
  decal(scene, 'assets/tex/generated/mold.png', 0.72, 1.24,
    -2.132, 0.72, 3.52, Math.PI / 2, 0, 0.76, 0x65705d);
  decal(scene, 'assets/tex/generated/rust_drips.png', 0.62, 1.35,
    2.132, 0.82, 2.72, -Math.PI / 2, 0, 0.62, 0x866b58);
  decal(scene, 'assets/tex/generated/mold.png', 1.12, 1.68,
    -4.632, 0.88, -6.48, Math.PI / 2, 0, 0.78, 0x5d6957);
  plane(scene, 1.42, 0.72, organicFloorMaterial(1.6, 1, 0x41483e),
    0, 0.014, 3.12, 0, -Math.PI / 2);

  // Радиатор: трубы холодные, один клапан сорван.
  box(scene, 0.18, 0.08, 2.1, metalMat, 2.08, 0.45, 0.1, { cast: false });
  for (let i = 0; i < 7; i++) {
    box(scene, 0.18, 0.55, 0.12, metalMat, 2.08, 0.65, -0.75 + i * 0.28, { cast: false });
  }
  colliders.push({ minX: 1.88, maxX: 2.26, minZ: -1.05, maxZ: 1.25 });

  // Расписание у входа.
  const scheduleMat = textMaterial([
    { text: 'ЛИЦЕЙ «ВЕЛИЧКА»', size: 58, bold: true, gap: 88 },
    { text: 'РАСПИСАНИЕ • ВТОРНИК', size: 42, gap: 64 },
    { text: '1. ПОЛЬСКИЙ — КАБ. 2-Б', size: 36, gap: 54 },
    { text: '2. ИСТОРИЯ — КАБ. 2-Б', size: 36, gap: 54 },
    { text: '3. ФИЗИКА — ОТМЕНЕНА', size: 36, color: '#bd8c80', gap: 60 },
    { text: 'НЕ ОПАЗДЫВАТЬ', size: 32, color: '#aaa99a' }
  ], { w: 768, h: 512, bg: '#b7b0a0', fg: '#2c302c', borderColor: '#66665a', y: 58 });
  plane(scene, 0.9, 0.65, scheduleMat, -2.13, 1.65, 2.35, Math.PI / 2);

  // Две закрытые двери кабинетов по правой стене.
  for (const z of [-0.7, -2.05]) {
    plane(scene, 1.0, 2.1, doorMat, 2.13, 1.05, z, -Math.PI / 2);
    box(scene, 0.05, 0.06, 0.08, metalMat, 2.08, 1.0, z - 0.32, { cast: false });
  }

  // Пустой класс: доска с незаконченным уроком.
  const boardMat = textMaterial([
    { text: 'ВТОРНИК • 2-Б', size: 44, gap: 76 },
    { text: 'ТЕМА: ЧЕЛОВЕК И ОБЩЕСТВО', size: 46, bold: true, gap: 92 },
    { text: 'УРОКИ ПЕРЕНЕСЕНЫ.', size: 54, color: '#e0dfd0', gap: 86 },
    { text: 'ДАТА НЕИЗВЕСТНА', size: 40, color: '#b8b9aa', gap: 70 },
    { text: 'Не приходите сюда', size: 34, color: '#bd8c80' }
  ], { w: 1200, h: 560, bg: '#13231d', fg: '#d6ddd2', y: 62 });
  plane(scene, 4.3, 1.75, boardMat, 0, 1.72, -9.68, 0);
  box(scene, 4.5, 0.08, 0.08, woodMat, 0, 0.8, -9.58, { cast: false });

  const classSignMat = textMaterial([
    { text: '2-Б', size: 96, bold: true }
  ], { w: 384, h: 256, bg: '#ddd6bf', fg: '#33352e', borderColor: '#6d6b5d', y: 128 });
  plane(scene, 0.6, 0.4, classSignMat, 2.85, 1.85, -9.68, 0);

  // Окна: одно заколочено, за остальными только серый двор.
  const winDead = matTex('assets/tex/win_dead.png', 1, 1, 0x93a4b5, 0.65, { emissive: 0x607488, emissiveIntensity: 0.24 });
  const winBoard = matTex('assets/tex/win_board.png', 1, 1, 0x80766a, 0.9);
  for (let i = 0; i < 3; i++) {
    const z = -4.35 - i * 1.9;
    plane(scene, 1.35, 1.55, i === 1 ? winBoard : winDead, 4.63, 1.85, z, -Math.PI / 2);
  }

  // Стол учителя. Стул отодвинут, никто не пришёл.
  // Между последним рядом и столом оставлено 0.84 м: с учётом радиуса игрока
  // остаётся проход 0.20 м для центра камеры, ведущий к боковым рядам и окнам.
  box(scene, 2.0, 0.08, 0.72, woodMat, 0, 0.78, -8.87);
  for (const [x, z] of [[-0.85, -9.14], [0.85, -9.14], [-0.85, -8.60], [0.85, -8.60]]) {
    box(scene, 0.06, 0.76, 0.06, metalMat, x, 0.38, z, { cast: false });
  }
  box(scene, 0.46, 0.06, 0.42, woodMat, 1.25, 0.46, -9.17);
  box(scene, 0.46, 0.55, 0.06, woodMat, 1.25, 0.74, -9.34);
  colliders.push({ minX: -1.05, maxX: 1.05, minZ: -9.30, maxZ: -8.44 });

  // Парты и стулья. Между рядами можно пройти; один стол перевёрнут.
  const deskXs = [-3.25, -1.08, 1.08, 3.25];
  const deskZs = [-4.45, -5.85, -7.25];
  for (let rz = 0; rz < deskZs.length; rz++) {
    for (let ix = 0; ix < deskXs.length; ix++) {
      const x = deskXs[ix];
      const z = deskZs[rz];
      const flipped = rz === 0 && ix === 3;
      if (!flipped) {
        box(scene, 0.95, 0.07, 0.55, woodMat, x, 0.74, z);
        for (const [lx, lz] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]]) {
          box(scene, 0.045, 0.72, 0.045, metalMat, x + lx, 0.36, z + lz, { cast: false });
        }
        // Стул стоит за партой; места пустые.
        box(scene, 0.44, 0.05, 0.4, woodMat, x, 0.43, z + 0.52);
        box(scene, 0.44, 0.5, 0.05, woodMat, x, 0.7, z + 0.72);
        box(scene, 0.04, 0.42, 0.04, metalMat, x - 0.17, 0.21, z + 0.45, { cast: false });
        box(scene, 0.04, 0.42, 0.04, metalMat, x + 0.17, 0.21, z + 0.45, { cast: false });
      } else {
        const top = box(scene, 0.95, 0.07, 0.55, woodMat, x + 0.2, 0.38, z);
        top.rotation.z = 1.2;
        box(scene, 0.05, 0.72, 0.05, metalMat, x + 0.5, 0.32, z - 0.2, { rz: 1.1 });
        box(scene, 0.05, 0.72, 0.05, metalMat, x + 0.5, 0.32, z + 0.2, { rz: 1.1 });
      }
      // Парта Хомки: единственная приготовленная — тетрадь и карандаш ждут хозяина.
      if (rz === 1 && ix === 2) {
        box(scene, 0.3, 0.025, 0.21, mat(0xbcb6a6, 0.98), x + 0.08, 0.79, z + 0.03, { cast: false });
        box(scene, 0.018, 0.018, 0.26, mat(0xc7a23f, 0.75), x - 0.22, 0.79, z - 0.08, { ry: 0.35, cast: false });
      }
      colliders.push({ minX: x - 0.58, maxX: x + 0.58, minZ: z - 0.35, maxZ: z + 0.8 });
    }
  }

  // Один рюкзак и разбросанные тетради — признаки того, что класс бросили в спешке.
  box(scene, 0.36, 0.45, 0.2, mat(0x333d4b, 0.92), -3.0, 0.24, -5.12);
  box(scene, 0.28, 0.05, 0.04, metalMat, -3.0, 0.49, -5.13, { cast: false });
  const paperMat = dampPaperMaterial(1, 1, 0xb9b09a);
  for (const [x, z, ry] of [[-2.55, -4.95, 0.4], [0.3, -5.3, -0.8], [2.4, -6.1, 0.9], [-0.4, -7.8, 0.1]]) {
    plane(scene, 0.32, 0.23, paperMat, x, 0.012, z, ry, -Math.PI / 2);
  }

  // Люминесцентные светильники: один почти не работает.
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xdcecff, emissive: 0xbfdcff, emissiveIntensity: 1.15, roughness: 0.5 });
  const deadTubeMat = mat(0x555d62, 0.65);
  box(scene, 1.65, 0.045, 0.13, tubeMat, 0, 2.96, 2.0, { cast: false, receive: false });
  const flickMat = tubeMat.clone();
  const flickTube = box(scene, 1.65, 0.045, 0.13, flickMat, 0, 2.96, -1.0, { cast: false, receive: false });
  box(scene, 1.65, 0.045, 0.13, tubeMat, -1.9, 2.96, -5.5, { cast: false, receive: false });
  box(scene, 1.65, 0.045, 0.13, deadTubeMat, 1.9, 2.96, -7.6, { cast: false, receive: false });

  scene.add(new THREE.HemisphereLight(0xaebfd0, 0x161918, 0.58));
  const entranceLight = new THREE.PointLight(0xb9cee8, 5.5, 7.5, 2);
  entranceLight.position.set(0, 2.65, 2.1);
  scene.add(entranceLight);
  const flickLight = new THREE.PointLight(0xc9dcf4, 6.5, 8.5, 2);
  flickLight.position.set(0, 2.65, -1.0);
  scene.add(flickLight);
  const classLight = new THREE.PointLight(0xc2d4e8, 5.0, 9.5, 2);
  classLight.position.set(-1.4, 2.7, -6.0);
  scene.add(classLight);

  const batched = batchStaticMeshes(scene, [flickTube]);
  console.log('[lyceum] batched:', batched.batched, 'of', batched.groups, 'groups');

  let t = 0;
  function update(dt) {
    t += dt;
    // Неровный контакт: короткие провалы, а не плавное «красивое» мерцание.
    const pulse = Math.sin(t * 19.0) > -0.55 ? 1 : 0.08;
    const jitter = 0.9 + Math.sin(t * 47.0) * 0.1;
    flickTube.material.emissiveIntensity = 1.15 * pulse * jitter;
    flickLight.intensity = 6.5 * (0.25 + pulse * 0.75) * jitter;
  }

  return {
    scene, bounds, colliders,
    targets: { exit: entranceDoor.target },
    surfaceDoors: [{ id: 'lyceum-exit', x: 0, z: 4.12, radius: 1.9, ...entranceDoor, get openAmount() { return entranceDoor.openAmount; } }],
    anchors: {
      exit: { x: 0, z: 3.55, r: 1.25 },
      schedule: { x: -1.55, z: 2.35, r: 1.2 },
      board: { x: 0, z: -8.0, r: 1.8 },
      desk: { x: -3.0, z: -4.8, r: 1.35 },
      seat: { x: 1.08, z: -5.0, r: 1.15 },
      window: { x: 4.0, z: -6.25, r: 1.25 }
    },
    update
  };
}
