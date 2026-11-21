// expansion.js — детали мира и полевой архив пасхалок.
// Модуль не меняет игровые коллайдеры и координаты старых интерактивов.
import * as THREE from 'three';
import { mat, box, plane, tex, pbrMat } from './mats.js';
import { decal } from './details.js';
import { batchStaticMeshes, mergeStaticMeshes } from './static_batch.js';
import { SECRET_DEFS, SECRET_BY_ID } from './secrets_story.js';

const EXP = 'assets/tex/expansion';
const materialCache = new Map();
const textCache = new Map();

function surface(name, rx = 1, ry = 1, color = 0xffffff, roughness = 0.9) {
  const key = `${name}|${rx}|${ry}|${color}|${roughness}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const material = new THREE.MeshStandardMaterial({
    map: tex(`${EXP}/${name}_color.jpg`, rx, ry),
    normalMap: tex(`${EXP}/${name}_normal.jpg`, rx, ry, false),
    normalScale: new THREE.Vector2(0.55, 0.55),
    color, roughness, metalness: name === 'enamel' ? 0.28 : 0.02
  });
  materialCache.set(key, material);
  return material;
}

function textMaterial(lines, options = {}) {
  const key = JSON.stringify([lines, options]);
  if (textCache.has(key)) return textCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = options.bg || '#b9ad8b';
  ctx.fillRect(0, 0, 768, 512);
  const rng = (i) => ((i * 16807) % 2147483647) / 2147483647;
  for (let i = 1; i < 160; i++) {
    ctx.fillStyle = `rgba(52,43,28,${0.015 + rng(i) * 0.035})`;
    ctx.fillRect(rng(i * 3) * 768, rng(i * 7) * 512, 1 + rng(i * 11) * 6, 1 + rng(i * 13) * 4);
  }
  ctx.strokeStyle = options.fg || '#39372c';
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 5;
  ctx.strokeRect(20, 20, 728, 472);
  ctx.globalAlpha = 1;
  ctx.fillStyle = options.fg || '#39372c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rows = Array.isArray(lines) ? lines : String(lines).split('\n');
  const fontSize = options.size || (rows.length > 6 ? 42 : 50);
  ctx.font = `${options.bold === false ? '' : 'bold '}${fontSize}px "Courier New", monospace`;
  rows.forEach((row, i) => ctx.fillText(row, 384, 256 + (i - (rows.length - 1) / 2) * (fontSize + 15), 690));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.96, color: 0xffffff });
  textCache.set(key, material);
  return material;
}

function dynamic(parent, name) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.dynamic = true;
  parent.add(group);
  return group;
}

function cylinder(parent, rt, rb, height, material, x, y, z, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function framedPhoto(parent, path, w, h) {
  const frame = pbrMat('Wood051', 1, 1, { color: 0x4b3c2d, roughness: 0.91, normalScale: 0.42 });
  box(parent, w + 0.09, h + 0.09, 0.035, frame, 0, 0, 0, { cast: false });
  plane(parent, w, h, new THREE.MeshStandardMaterial({
    map: tex(path), roughness: 0.57, color: 0xf0e4cc
  }), 0, 0, 0.021);
}

function addSeal(group, seals, id) {
  const seal = new THREE.Mesh(new THREE.CircleGeometry(0.037, 12), new THREE.MeshStandardMaterial({
    color: 0xc0a36a, emissive: 0x5b3e17, emissiveIntensity: 0.35,
    roughness: 0.48, metalness: 0.72, depthWrite: false
  }));
  seal.position.set(-0.23, -0.22, 0.055);
  seal.visible = false;
  seal.name = `archive-seal-${id}`;
  group.add(seal);
  seals[id] = seal;
}

export function buildWorldExpansion(scenes) {
  const secrets = {};
  const seals = {};
  const roots = {};
  const animated = {};
  const stats = {};

  for (const [sceneId, data] of Object.entries(scenes)) {
    const root = new THREE.Group();
    root.name = `world-expansion-${sceneId}`;
    data.scene.add(root);
    roots[sceneId] = root;
  }

  function secret(sceneId, id, x, y, z, ry, ax, az, r = 1.0) {
    const group = dynamic(roots[sceneId], `secret-${id}`);
    group.position.set(x, y, z);
    group.rotation.y = ry;
    addSeal(group, seals, id);
    secrets[id] = { ...SECRET_BY_ID[id], x: ax, z: az, r, target: group };
    return group;
  }

  // ---------- ДОМ: старые обои, книги, паутина и часы 03:17 ----------
  {
    const root = roots.home;
    const wallpaper = surface('wallpaper', 1.2, 2.4, 0xb7b09a, 0.97);
    plane(root, 1.05, 1.92, wallpaper, 2.181, 1.24, 0.38, -Math.PI / 2);
    decal(root, `${EXP}/cobweb.png`, 0.82, 0.82, -2.17, 2.05, 1.96, Math.PI / 2, 0, 0.55);
    const bookColors = [0x5e4b3a, 0x3f5750, 0x695338, 0x4a414e];
    for (let i = 0; i < 4; i++) {
      const book = box(root, 0.19, 0.29 + i * 0.018, 0.065,
        mat(bookColors[i], 0.91), 2.0, 1.665 + i * 0.009, -1.91 + i * 0.078, { cast: false });
      book.rotation.x = (i - 1.5) * 0.025;
    }
    const clock = secret('home', 'home-clock', 2.145, 1.46, 0.17, -Math.PI / 2, 1.46, 0.17, 1.05);
    const clockWood = pbrMat('Wood051', 1, 1, { color: 0x594733, roughness: 0.86, normalScale: 0.5 });
    box(clock, 0.48, 0.74, 0.09, clockWood, 0, -0.06, 0);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.205, 32), surface('ceramic', 1, 1, 0xe0d7ba, 0.55));
    face.position.set(0, 0.095, 0.052);
    clock.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.213, 0.018, 8, 32), pbrMat('Metal032', 1, 1, {
      color: 0x9d8354, roughness: 0.48, normalScale: 0.3
    }));
    rim.position.set(0, 0.095, 0.063);
    clock.add(rim);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const tick = box(clock, 0.009, i % 3 === 0 ? 0.033 : 0.021, 0.008, mat(0x3d382c, 0.8),
        Math.sin(a) * 0.169, 0.095 + Math.cos(a) * 0.169, 0.066, { cast: false });
      tick.rotation.z = -a;
    }
    const hour = box(clock, 0.018, 0.103, 0.009, mat(0x29271f, 0.65), -0.038, 0.133, 0.073, { cast: false });
    hour.rotation.z = 0.98;
    const minute = box(clock, 0.013, 0.145, 0.009, mat(0x29271f, 0.65), 0.052, 0.047, 0.075, { cast: false });
    minute.rotation.z = -0.68;
    const pendulum = dynamic(clock, 'home-clock-pendulum');
    pendulum.position.set(0, -0.20, 0.056);
    box(pendulum, 0.015, 0.25, 0.012, mat(0x9b8150, 0.42, { metalness: 0.65 }), 0, -0.10, 0, { cast: false });
    const bob = new THREE.Mesh(new THREE.CircleGeometry(0.052, 18), mat(0xae935a, 0.38, { metalness: 0.72 }));
    bob.position.set(0, -0.23, 0.009);
    pendulum.add(bob);
    animated.clockPendulum = pendulum;
  }

  // ---------- УЛИЦА: сугробы, следы, провода, лента и объявление ----------
  {
    const root = roots.street;
    const snowGeo = new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    const snowMat = surface('ceramic', 2, 2, 0xaebdc8, 0.98);
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? -1 : 1;
      const drift = new THREE.Mesh(snowGeo, snowMat);
      drift.position.set(side * (2.85 + (i % 3) * 0.24), -0.03, 0.5 - i * 3.75);
      drift.scale.set(0.65 + (i % 4) * 0.16, 0.19 + (i % 3) * 0.05, 0.82 + (i % 5) * 0.17);
      drift.receiveShadow = true;
      root.add(drift);
    }
    for (let i = 0; i < 12; i++) {
      decal(root, `${EXP}/footprints.png`, 0.44, 0.72,
        (i % 2 ? -0.23 : 0.23), 0.020, -3.5 - i * 4.8,
        i % 2 ? 0.08 : -0.08, -Math.PI / 2, 0.62, 0x75818a);
    }
    const wireMat = mat(0x171d20, 0.82, { metalness: 0.35 });
    for (const [z, y] of [[-13, 5.2], [-37, 5.8], [-55, 4.9]]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-5.2, y + 0.45, z),
        new THREE.Vector3(0, y - 0.45, z - 0.35),
        new THREE.Vector3(5.2, y + 0.15, z)
      ]);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.014, 4, false), wireMat);
      wire.castShadow = false;
      root.add(wire);
    }
    const ribbon = secret('street', 'street-ribbon', 1.515, 1.13, -10.10, -Math.PI / 2, 0.93, -10.1, 1.10);
    const redCloth = new THREE.MeshStandardMaterial({ color: 0x8f2928, roughness: 0.96, side: THREE.DoubleSide });
    box(ribbon, 0.24, 0.035, 0.035, mat(0x343a3c, 0.55, { metalness: 0.65 }), 0, 0.08, 0);
    const ribbonTails = [];
    for (let i = 0; i < 3; i++) {
      const tail = plane(ribbon, 0.065, 0.55 + i * 0.08, redCloth,
        (i - 1) * 0.065, -0.19 - i * 0.025, 0.026 + i * 0.004);
      tail.rotation.z = (i - 1) * 0.20;
      tail.userData.dynamic = true;
      ribbonTails.push(tail);
    }
    animated.ribbonTails = ribbonTails;
    const notice = secret('street', 'street-notice', -2.205, 1.30, -26.0, Math.PI / 2, -1.58, -26.0, 1.0);
    plane(notice, 0.40, 0.53, textMaterial([
      'ZAGINĄŁ CZŁOWIEK', 'ПРОПАЛ ЧЕЛОВЕК', 'ОСОБАЯ ПРИМЕТА:', 'ЧИТАЕТ ЭТУ БУМАЖКУ', 'ДОМ ХОМКИ · В-6', 'НЕ ОТВЕЧАТЬ ЭХУ'
    ], { size: 39 }), 0, 0, 0.025);
    box(notice, 0.44, 0.025, 0.018, mat(0x5e513e, 0.94), 0, 0.277, 0.012, { cast: false });
    const birds = dynamic(root, 'street-distant-birds');
    for (let i = 0; i < 3; i++) {
      const bird = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.20, 0, 0), new THREE.Vector3(0, 0.07, 0), new THREE.Vector3(0.20, 0, 0)
      ]), new THREE.LineBasicMaterial({ color: 0x111820 }));
      bird.position.set((i - 1) * 1.4, i * 0.3, -i * 2.0);
      birds.add(bird);
    }
    birds.position.set(0, 6.5, -38);
    animated.birds = birds;
  }

  // ---------- МАГАЗИН: служебная дверь, следы, зеркало и фото ----------
  {
    const root = roots.store;
    const enamel = surface('enamel', 1.2, 2.2, 0x91a5a0, 0.64);
    plane(root, 1.05, 2.12, enamel, 4.95, 1.06, -5.278);
    plane(root, 0.66, 0.23, textMaterial(['PERSONEL', 'НЕ ВЫХОДИТЬ'], { bg: '#314c49', fg: '#d4d1b7', size: 62 }),
      4.95, 1.68, -5.254);
    box(root, 0.04, 0.19, 0.035, pbrMat('Metal032', 1, 1, { color: 0x9c9c8d, roughness: 0.5 }),
      5.35, 1.0, -5.22, { cast: false });
    for (let i = 0; i < 4; i++) {
      decal(root, `${EXP}/footprints.png`, 0.34, 0.56,
        -0.22 + (i % 2) * 0.35, 0.018, 4.2 - i * 0.63,
        i % 2 ? 0.06 : -0.06, -Math.PI / 2, 0.30, 0x4c5150);
    }
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x9fb1b4, roughness: 0.13, metalness: 0.92 });
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.30, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mirrorMat);
    mirror.scale.y = 0.32;
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(5.98, 2.63, -4.98);
    root.add(mirror);
    const photo = secret('store', 'store-photo', 2.05, 1.47, -5.265, 0, 2.05, -4.25, 1.05);
    framedPhoto(photo, `${EXP}/staff_photo.jpg`, 0.70, 0.45);
    plane(photo, 0.49, 0.12, textMaterial(['СМЕНА 08.08', 'ТРЕТИЙ — ПО СПИСКУ'], { size: 54 }),
      0, -0.36, 0.018);
  }

  // ---------- ЛИЦЕЙ: детский рисунок, изморозь, журавлики и фото 2-Б ----------
  {
    const root = roots.lyceum;
    plane(root, 0.70, 0.70, new THREE.MeshStandardMaterial({
      map: tex(`${EXP}/children_drawing.jpg`), roughness: 0.93, color: 0xd0c5a5
    }), 2.132, 1.48, 1.95, -Math.PI / 2);
    decal(root, `${EXP}/frost_lace.png`, 1.30, 1.48, 4.607, 1.85, -4.35, -Math.PI / 2, 0, 0.64);
    decal(root, `${EXP}/cobweb.png`, 1.05, 1.05, -4.61, 2.08, -9.23, Math.PI / 2, 0, 0.42);
    const paper = mat(0xc8c0a5, 0.96);
    for (let i = 0; i < 3; i++) {
      const crane = new THREE.Mesh(new THREE.TetrahedronGeometry(0.10 + i * 0.012, 0), paper);
      crane.scale.set(1.5, 0.55, 0.72);
      crane.position.set(-0.45 + i * 0.28, 0.89, -8.82 + (i % 2) * 0.10);
      crane.rotation.set(0.15, i * 0.9, 0.12);
      root.add(crane);
    }
    const photo = secret('lyceum', 'lyceum-photo', -4.612, 1.54, -8.28, Math.PI / 2, -3.83, -8.28, 1.05);
    framedPhoto(photo, `${EXP}/class_photo.jpg`, 0.78, 0.50);
    plane(photo, 0.60, 0.14, textMaterial(['2-Б · 30 УЧЕНИКОВ', '31 ТЕНЬ'], { size: 55 }), 0, -0.38, 0.018);
  }

  // ---------- ПОДВАЛ: зарубки, шланг, эмаль и паутина ----------
  {
    const root = roots.basement;
    decal(root, `${EXP}/cobweb.png`, 0.92, 0.92, -2.88, 1.79, -2.17, 0, 0, 0.47);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 28), mat(0x282d29, 0.93));
    hose.position.set(1.85, 1.18, -2.175);
    root.add(hose);
    plane(root, 0.48, 0.64, surface('enamel', 1, 1, 0x858e7f, 0.75), 1.85, 1.20, -2.19);
    const tally = secret('basement', 'basement-tally', 0.82, 1.35, -2.185, 0, 0.82, -1.32, 1.05);
    plane(tally, 0.95, 0.82, new THREE.MeshStandardMaterial({
      map: tex(`${EXP}/chalk_tally.png`), transparent: true, alphaTest: 0.02,
      depthWrite: false, roughness: 0.99, polygonOffset: true, polygonOffsetFactor: -1
    }), 0, 0, 0.018);
  }

  // ---------- ШАХТА: пласты породы и четыре находки ----------
  for (let level = 1; level <= 4; level++) {
    const sceneId = `mine${level}`;
    const root = roots[sceneId];
    const strata = surface('strata', 1.3, 1.9,
      [0x9c9681, 0x728b8c, 0x777b5e, 0x826778][level - 1], 0.98);
    for (const [x, y, z, ry] of [
      [-4.984, 1.20, 3.55, Math.PI / 2],
      [4.984, 1.10, level === 4 ? -1.10 : -4.30, -Math.PI / 2],
      [-4.984, 1.22, -10.65, Math.PI / 2]
    ]) {
      plane(root, 1.75, 1.95, strata, x, y, z, ry);
    }
    const boltMat = pbrMat('Metal032', 1, 1, { color: 0x77776a, roughness: 0.65, normalScale: 0.4 });
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? -1 : 1;
      const bolt = cylinder(root, 0.035, 0.035, 0.035, boltMat,
        side * 4.24, 1.55 + (i % 3) * 0.30, 4.2 - Math.floor(i / 2) * 3.0, 8);
      bolt.rotation.z = Math.PI / 2;
    }
  }
  {
    const tag = secret('mine1', 'mine1-tag', -4.94, 1.36, -4.05, Math.PI / 2, -3.96, -4.05, 1.0);
    box(tag, 0.34, 0.46, 0.025, surface('enamel', 1, 1, 0x8a886f, 0.64), 0, 0, 0);
    plane(tag, 0.29, 0.34, textMaterial(['ХОМКА', 'ЧЕЛОВЕК', 'ВОЗВРАТ ВЕЛИЧКЕ', 'В-6 / 000'], { size: 49, bg: '#77755f', fg: '#252920' }), 0, 0, 0.017);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 16), mat(0x9c8c61, 0.45, { metalness: 0.65 }));
    ring.position.set(0, 0.27, 0.005);
    tag.add(ring);
  }
  {
    const bell = secret('mine2', 'mine2-bell', 4.88, 1.58, -0.10, -Math.PI / 2, 3.92, -0.10, 1.0);
    box(bell, 0.055, 0.055, 0.38, mat(0x4c5754, 0.67, { metalness: 0.58 }), 0, 0.46, -0.13);
    const bellPivot = dynamic(bell, 'mine2-secret-bell-pivot');
    bellPivot.position.set(0, 0.41, 0.02);
    const profile = [
      new THREE.Vector2(0.03, 0.20), new THREE.Vector2(0.08, 0.15),
      new THREE.Vector2(0.11, 0.02), new THREE.Vector2(0.17, -0.15), new THREE.Vector2(0.20, -0.18)
    ];
    const bellMesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), pbrMat('Metal032', 1, 1, {
      color: 0x8b8060, roughness: 0.49, normalScale: 0.38
    }));
    bellPivot.add(bellMesh);
    cylinder(bellPivot, 0.012, 0.012, 0.44, mat(0x5b5040, 0.96), 0, -0.35, 0, 6);
    animated.bellPivot = bellPivot;
  }
  {
    const cage = secret('mine3', 'mine3-cage', -4.86, 1.14, -1.65, Math.PI / 2, -3.87, -1.65, 1.0);
    const cageMetal = pbrMat('Metal032', 1, 1, { color: 0x625f4e, roughness: 0.72, normalScale: 0.45 });
    box(cage, 0.64, 0.045, 0.44, cageMetal, 0, -0.35, 0);
    box(cage, 0.64, 0.035, 0.44, cageMetal, 0, 0.35, 0);
    for (let i = 0; i < 9; i++) {
      cylinder(cage, 0.009, 0.009, 0.70, cageMetal, -0.30 + i * 0.075, 0, 0.20, 6);
      cylinder(cage, 0.009, 0.009, 0.70, cageMetal, -0.30 + i * 0.075, 0, -0.20, 6);
    }
    for (const x of [-0.30, 0.30]) for (const z of [-0.10, 0, 0.10]) {
      cylinder(cage, 0.009, 0.009, 0.70, cageMetal, x, 0, z, 6);
    }
    const bird = dynamic(cage, 'mine3-uncertain-bird');
    const birdBody = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshStandardMaterial({
      color: 0xb5aa58, emissive: 0x4a451c, emissiveIntensity: 0.30, roughness: 0.89
    }));
    birdBody.scale.set(1.25, 0.85, 0.85);
    bird.add(birdBody);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 5), mat(0x7c6942, 0.8));
    beak.rotation.z = -Math.PI / 2;
    beak.position.x = 0.11;
    bird.add(beak);
    bird.position.set(0, -0.16, 0.02);
    animated.cageBird = bird;
  }
  {
    const door = secret('mine4', 'mine4-door', 4.92, 0, -5.55, -Math.PI / 2, 3.85, -5.55, 1.10);
    const impossibleWood = pbrMat('Wood051', 1.2, 2.4, { color: 0x5e4b52, roughness: 0.89, normalScale: 0.64 });
    box(door, 1.10, 2.25, 0.10, impossibleWood, 0, 1.13, 0);
    const frame = surface('strata', 1, 2, 0x6e5968, 0.92);
    box(door, 0.16, 2.46, 0.19, frame, -0.63, 1.22, -0.01);
    box(door, 0.16, 2.46, 0.19, frame, 0.63, 1.22, -0.01);
    box(door, 1.42, 0.16, 0.19, frame, 0, 2.39, -0.01);
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0xc795a9, emissive: 0xc0648a, emissiveIntensity: 0.85, roughness: 0.42
    });
    box(door, 0.018, 2.12, 0.012, seamMat, 0.47, 1.13, 0.058, { cast: false, receive: false });
    plane(door, 0.70, 0.30, textMaterial(['WYJŚCIE DLA LUDZI', 'ВЫХОД ДЛЯ ЛЮДЕЙ', 'КУХНЯ — БЛИЖАЙШИЙ', 'ГОРИЗОНТ'], { size: 42, bg: '#4b3843', fg: '#dac5c8' }),
      0, 1.60, 0.061);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), mat(0xa28267, 0.37, { metalness: 0.70 }));
    handle.position.set(0.37, 1.03, 0.095);
    door.add(handle);
    animated.zeroSeam = seamMat;
  }

  // Статика каждой добавленной группы батчится отдельно; пасхалки и анимации
  // помечены dynamic и остаются настоящей геометрией для GeometryHighlight.
  // Секрет остаётся самостоятельной dynamic-целью GeometryHighlight, но его
  // неподвижные части объединяются внутри: 24 прута клетки — один draw call.
  // Вложенные анимированные группы и отдельные хвосты ленты не затрагиваются.
  const secretMerges = {};
  for (const [id, data] of Object.entries(secrets)) {
    const result = mergeStaticMeshes(data.target, { includeDecals: true });
    secretMerges[id] = result.merged;
  }
  for (const [sceneId, root] of Object.entries(roots)) {
    const result = batchStaticMeshes(root);
    const merged = mergeStaticMeshes(root, { includeDecals: true, binSize: sceneId === 'street' ? 12 : 0 });
    stats[sceneId] = {
      batched: result.batched, groups: result.groups,
      merged: merged.merged, mergeGroups: merged.mergeGroups,
      secretMerges: Object.entries(secretMerges)
        .filter(([id]) => SECRET_BY_ID[id].scene === sceneId)
        .reduce((sum, [, count]) => sum + count, 0)
    };
  }

  let t = 0;
  let foundRef = null;
  let foundSize = -1;
  function syncFound(found) {
    if (!found || (found === foundRef && found.size === foundSize)) return;
    foundRef = found;
    foundSize = found.size;
    for (const [id, seal] of Object.entries(seals)) seal.visible = found.has(id);
  }

  function update(dt, camera, mode, found) {
    syncFound(found);
    t += dt;
    if (mode === 'home' && animated.clockPendulum) {
      animated.clockPendulum.rotation.z = Math.sin(t * 1.65) * 0.16;
    } else if (mode === 'street') {
      if (animated.birds) {
        animated.birds.position.x = Math.sin(t * 0.055) * 4.2;
        animated.birds.position.z = -38 + Math.cos(t * 0.055) * 5;
      }
      if (animated.ribbonTails) {
        animated.ribbonTails.forEach((tail, i) => { tail.rotation.z = (i - 1) * 0.20 + Math.sin(t * 2.2 + i) * 0.055; });
      }
    } else if (mode === 'mine2' && animated.bellPivot) {
      const near = camera ? Math.max(0, 1 - Math.hypot(camera.position.x - 3.92, camera.position.z + 0.10) / 4) : 0;
      animated.bellPivot.rotation.z = Math.sin(t * 1.4) * (0.018 + near * 0.045);
    } else if (mode === 'mine3' && animated.cageBird) {
      animated.cageBird.visible = !found?.has('mine3-cage') && Math.sin(t * 0.71) > -0.18;
      animated.cageBird.position.y = -0.16 + Math.sin(t * 3.1) * 0.012;
    } else if (mode === 'mine4' && animated.zeroSeam) {
      animated.zeroSeam.emissiveIntensity = (found?.size === SECRET_DEFS.length ? 2.8 : 0.85) + Math.sin(t * 2.3) * 0.18;
    }
  }

  return {
    roots, secrets, seals, stats,
    secretCount: SECRET_DEFS.length,
    syncFound, update,
    getSecret(id) { return secrets[id]; }
  };
}
