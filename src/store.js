// store.js — «Бедронка»: опрятные стеллажи, товары на реальных опорах,
// отдельные динамические экземпляры для взятия [E] и возврата [Q].
import * as THREE from 'three';
import { mat, matTex, box, plane, tex, pbrMat } from './mats.js';
import { decal, organicFloorMaterial } from './details.js';
import { createHumanoid } from './rig.js';
import { pose, resetPose } from './anim.js';
import { loadModel, groundAndScale, enableShadows } from './models.js';
import { batchStaticMeshes } from './static_batch.js';
import { createSlidingDoor } from './doors.js';
import { ITEMS } from './story.js';

export function createStore() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101216);
  scene.fog = new THREE.FogExp2(0x14161c, 0.02);

  const bounds = { minX: -6.4, maxX: 6.4, minZ: -5.2, maxZ: 5.6 };
  const colliders = [];
  const targets = {};

  const floorMat = pbrMat('Concrete034', 6, 5, { color: 0xa4a49e, normalScale: 0.2, roughness: 0.72 });
  const wallMat = pbrMat('Concrete034', 3, 1.2, { color: 0xc0bcb2, normalScale: 0.24, roughness: 0.96 });
  const ceilMat = mat(0x9a9a94, 0.96);
  const shelfMat = pbrMat('Metal032', 1, 1, { color: 0xa2a7aa, normalScale: 0.32, roughness: 0.65 });
  const shelfDark = pbrMat('Metal032', 1, 1, { color: 0x404448, normalScale: 0.38, roughness: 0.76 });
  const shelfEdge = pbrMat('Metal032', 1, 1, { color: 0xc4c8c7, normalScale: 0.24, roughness: 0.55 });

  // ---------- помещение ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(13, 11), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.2);
  floor.receiveShadow = true;
  scene.add(floor);
  plane(scene, 13, 11, ceilMat, 0, 3.15, 0.2, 0, Math.PI / 2);
  box(scene, 0.2, 3.2, 11, wallMat, -6.5, 1.6, 0.2);
  box(scene, 0.2, 3.2, 11, wallMat, 6.5, 1.6, 0.2);
  box(scene, 13, 3.2, 0.2, wallMat, 0, 1.6, -5.4);
  box(scene, 5.4, 3.2, 0.2, wallMat, -3.8, 1.6, 5.7);
  box(scene, 5.4, 3.2, 0.2, wallMat, 3.8, 1.6, 5.7);
  box(scene, 2.6, 1.0, 0.2, wallMat, 0, 2.7, 5.7);
  const entranceDoor = createSlidingDoor(scene, { x: 0, z: 5.65, width: 1.5 });
  targets.exit = entranceDoor.target;
  decal(scene, 'assets/tex/generated/mold.png', 0.84, 1.36,
    -5.62, 0.78, -5.282, 0, 0, 0.42, 0x77806c);
  decal(scene, 'assets/tex/generated/rust_drips.png', 0.68, 1.48,
    5.72, 0.86, -5.282, 0, 0, 0.38, 0x8a6c58);
  plane(scene, 1.68, 0.78, organicFloorMaterial(1.8, 1, 0x51544c),
    0, 0.014, 4.72, 0, -Math.PI / 2);

  const posterMat = (p) => new THREE.MeshStandardMaterial({ map: tex(p), roughness: 0.85 });
  const productMatCache = new Map();
  const productMat = (p) => {
    if (!productMatCache.has(p)) {
      productMatCache.set(p, new THREE.MeshStandardMaterial({ map: tex(p), roughness: 0.72 }));
    }
    return productMatCache.get(p);
  };
  const textTag = (title, status, x, y, z, ry = 0, w = 0.36, h = 0.18) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e9e3d2'; ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#aaa18c'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 250, 122);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#292824'; ctx.font = 'bold 29px sans-serif'; ctx.fillText(title, 128, 42);
    ctx.fillStyle = '#9a352d'; ctx.font = 'bold 35px sans-serif'; ctx.fillText(status, 128, 88);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    return plane(scene, w, h, material, x, y, z, ry);
  };
  const dynamicGroup = (key) => {
    const g = new THREE.Group();
    g.name = `store-${key}`;
    g.userData.dynamic = true;
    scene.add(g);
    targets[key] = g;
    return g;
  };
  const texturedPack = (parent, path, w, h, d, x, baseY, z) =>
    box(parent, w, h, d, productMat(path), x, baseY + h / 2, z);

  // ---------- островные стеллажи ----------
  // Открытый металлический каркас вместо сплошного ящика. Полка шире товара:
  // упаковка стоит на ней всей нижней гранью и не свисает за переднюю кромку.
  const shelfRows = [-4.7, -1.9, 0.9];
  const SHELF_Z = -0.75;
  const SHELF_LEN = 4.5;
  const SHELF_LEVELS = [0.18, 0.62, 1.06, 1.50];
  const SHELF_THICKNESS = 0.04;
  const STOCK_X = 0.37;
  const stockZ = Array.from({ length: 11 }, (_, i) => -2.62 + i * 0.39);
  const productMats = [
    mat(0xb94b3f, 0.68), mat(0xd1a43d, 0.68), mat(0x668451, 0.68),
    mat(0x4f6f94, 0.68), mat(0xd3c9b5, 0.72), mat(0x8b5c42, 0.72),
    mat(0xa75b73, 0.68), mat(0x71806a, 0.72)
  ];
  const canGeometry = new THREE.CylinderGeometry(0.07, 0.07, 0.18, 12);

  const shelfSpot = (key, sx, side, level, z) => ({
    key, sx, side, level, z,
    x: sx + side * STOCK_X,
    baseY: SHELF_LEVELS[level] + SHELF_THICKNESS / 2,
    anchorX: sx + side * 1.03
  });
  const spots = {
    butter: shelfSpot('butter', -4.7, 1, 1, stockZ[0]),
    socks: shelfSpot('socks', -4.7, 1, 3, stockZ[6]),
    tushonka: shelfSpot('tushonka', -1.9, -1, 2, stockZ[4]),
    krupa: shelfSpot('krupa', -1.9, 1, 1, stockZ[9]),
    sguschenka: shelfSpot('sguschenka', 0.9, -1, 2, stockZ[3]),
    tea: shelfSpot('tea', 0.9, 1, 1, stockZ[1])
  };
  const isHeroSlot = (sx, side, level, z) => Object.values(spots).some((s) =>
    s.sx === sx && s.side === side && s.level === level && Math.abs(s.z - z) < 0.02);

  for (let row = 0; row < shelfRows.length; row++) {
    const sx = shelfRows[row];
    box(scene, 1.18, 0.12, SHELF_LEN + 0.08, shelfDark, sx, 0.06, SHELF_Z);
    box(scene, 0.08, 1.70, SHELF_LEN - 0.08, shelfDark, sx, 0.93, SHELF_Z, { cast: false });
    for (const px of [-0.52, 0.52]) {
      for (const pz of [-2.94, 1.44]) {
        box(scene, 0.045, 1.88, 0.045, shelfMat, sx + px, 0.94, pz);
      }
    }
    for (let level = 0; level < SHELF_LEVELS.length; level++) {
      const sy = SHELF_LEVELS[level];
      box(scene, 1.16, SHELF_THICKNESS, SHELF_LEN, shelfMat, sx, sy, SHELF_Z, { cast: false });
      // Тонкие светлые кромки визуально отделяют этажи и держат ценники.
      for (const side of [-1, 1]) {
        box(scene, 0.025, 0.065, SHELF_LEN, shelfEdge,
          sx + side * 0.579, sy - 0.006, SHELF_Z, { cast: false });
      }
    }

    for (const side of [-1, 1]) {
      for (let level = 0; level < SHELF_LEVELS.length; level++) {
        const baseY = SHELF_LEVELS[level] + SHELF_THICKNESS / 2;
        for (let i = 0; i < stockZ.length; i++) {
          const z = stockZ[i];
          if (isHeroSlot(sx, side, level, z)) continue;
          const x = sx + side * STOCK_X;
          const material = productMats[(row * 3 + level * 2 + i + (side > 0 ? 1 : 0)) % productMats.length];
          if (level === 0 || level === 2) {
            const can = new THREE.Mesh(canGeometry, material);
            can.position.set(x, baseY + 0.09, z);
            can.castShadow = true;
            can.receiveShadow = true;
            scene.add(can);
          } else {
            const h = level === 3 ? 0.25 : 0.29;
            box(scene, 0.24, h, 0.20, material, x, baseY + h / 2, z);
          }
        }
      }
    }
    colliders.push({ minX: sx - 0.61, maxX: sx + 0.61, minZ: -3.06, maxZ: 1.56 });
  }

  // Ценники «бери тихо» закреплены на вертикальных кромках, а не висят рядом с товаром.
  const shelfTag = (key) => {
    const s = spots[key];
    textTag(ITEMS[key].name, 'БЕРИ ТИХО', s.sx + s.side * 0.595, SHELF_LEVELS[s.level] - 0.006, s.z,
      s.side * Math.PI / 2, 0.34, 0.15);
  };
  for (const key of ['butter', 'socks', 'tushonka', 'krupa', 'sguschenka', 'tea']) shelfTag(key);

  // ---------- интерактивные товары на стеллажах ----------
  {
    const s = spots.butter;
    const g = dynamicGroup('butter');
    box(g, 0.24, 0.15, 0.29, mat(0xf0d25a, 0.55), s.x, s.baseY + 0.075, s.z);
    box(g, 0.242, 0.035, 0.292, mat(0xe8e0c0, 0.65), s.x, s.baseY + 0.075, s.z, { cast: false });
  }
  {
    const s = spots.socks;
    const g = dynamicGroup('socks');
    box(g, 0.22, 0.25, 0.18, mat(0x6a7a5a, 0.8), s.x, s.baseY + 0.125, s.z);
    box(g, 0.224, 0.055, 0.184, mat(0xd8d0b8, 0.8), s.x, s.baseY + 0.12, s.z, { cast: false });
  }
  {
    const s = spots.tushonka;
    const g = dynamicGroup('tushonka');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.18, 16), mat(0x9a4a34, 0.55));
    body.position.set(s.x, s.baseY + 0.09, s.z);
    body.castShadow = true;
    g.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.012, 16), mat(0xb8b9b2, 0.38, { metalness: 0.5 }));
    lid.position.set(s.x, s.baseY + 0.186, s.z);
    g.add(lid);
  }
  {
    const s = spots.sguschenka;
    const g = dynamicGroup('sguschenka');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.20, 16), mat(0xd8c8a0, 0.45));
    body.position.set(s.x, s.baseY + 0.10, s.z);
    body.castShadow = true;
    g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.07, 16), mat(0x56769a, 0.55));
    band.position.set(s.x, s.baseY + 0.10, s.z);
    g.add(band);
  }
  {
    const s = spots.krupa;
    texturedPack(dynamicGroup('krupa'), 'assets/tex/box_krupa.jpg', 0.24, 0.30, 0.20, s.x, s.baseY, s.z);
  }
  {
    const s = spots.tea;
    texturedPack(dynamicGroup('tea'), 'assets/tex/box_tea.jpg', 0.24, 0.30, 0.18, s.x, s.baseY, s.z);
  }

  // ---------- холодильники: открытый корпус, полки и видимые бутылки ----------
  const fridgeMat = matTex('assets/tex/shelf_metal.jpg', 1, 1, 0xd8dce2, 0.35, { metalness: 0.4, bump: 0.006 });
  const fridgeInside = mat(0x27333c, 0.75);
  const fridgeGlow = new THREE.MeshStandardMaterial({
    color: 0xa8c4d6, emissive: 0x6d96b2, emissiveIntensity: 0.22,
    roughness: 0.12, transparent: true, opacity: 0.18, depthWrite: false
  });
  const bottleGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.26, 10);
  const bottleMats = [mat(0xa8c8d8, 0.32), mat(0x92ac78, 0.4), mat(0xd2c9a8, 0.38)];
  for (const fx of [-5.4, -4.4, -3.4]) {
    box(scene, 0.95, 2.2, 0.07, fridgeInside, fx, 1.1, -5.24);
    for (const dx of [-0.445, 0.445]) box(scene, 0.06, 2.2, 1.04, fridgeMat, fx + dx, 1.1, -4.75);
    for (const fy of [0.05, 2.15]) box(scene, 0.95, 0.10, 1.04, fridgeMat, fx, fy, -4.75);
    for (const sy of [0.46, 1.00, 1.54]) {
      box(scene, 0.80, 0.025, 0.84, fridgeMat, fx, sy, -4.72, { cast: false });
      const baseY = sy + 0.0125;
      for (let i = 0; i < 4; i++) {
        const bottle = new THREE.Mesh(bottleGeo, bottleMats[(i + Math.round(sy * 10)) % bottleMats.length]);
        bottle.position.set(fx - 0.20 + (i % 2) * 0.40, baseY + 0.13,
          -4.48 - Math.floor(i / 2) * 0.31);
        bottle.castShadow = true;
        scene.add(bottle);
      }
    }
    plane(scene, 0.80, 1.90, fridgeGlow, fx, 1.15, -4.205, 0);
    for (const dx of [-0.42, 0.42]) box(scene, 0.035, 1.98, 0.035, shelfEdge, fx + dx, 1.14, -4.19, { cast: false });
  }
  colliders.push({ minX: -6.0, maxX: -2.9, minZ: -5.2, maxZ: -4.1, blocksSight: true });

  // ---------- хлебная витрина ----------
  const breadMat = matTex('assets/tex/wood_dark.jpg', 1, 1, 0xa08a6a, 0.8, { bump: 0.015 });
  box(scene, 0.75, 0.85, 1.6, breadMat, 6.02, 0.425, 3.45);
  const breadTarget = dynamicGroup('bread');
  const loafGeo = new THREE.CapsuleGeometry(0.09, 0.12, 4, 8);
  const loafMat = mat(0xc09a60, 0.85);
  const loafPositions = [
    [5.86, 2.95], [6.16, 2.95], [5.86, 3.38],
    [6.16, 3.38], [5.86, 3.81], [6.16, 3.81]
  ];
  loafPositions.forEach(([x, z], i) => {
    const loaf = new THREE.Mesh(loafGeo, loafMat);
    loaf.rotation.z = Math.PI / 2;
    loaf.position.set(x, 0.85 + 0.09, z); // нижняя точка капсулы = верх витрины 0.85 м
    loaf.castShadow = true;
    (i === 0 ? breadTarget : scene).add(loaf);
  });
  textTag(ITEMS.bread.name, 'БЕРИ ТИХО', 5.635, 0.69, 3.45, -Math.PI / 2, 0.38, 0.17);
  colliders.push({ minX: 5.6, maxX: 6.45, minZ: 2.6, maxZ: 4.3 });

  // ---------- паллеты с коробками: за ними прячутся ----------
  // Магазин заставлен не только стеллажами: три штабеля дают реальные
  // укрытия. Они же блокируют линию взгляда Людмилы.
  const palletWood = pbrMat('Wood051', 1, 1, { color: 0x7d6a4e, normalScale: 0.55, roughness: 0.94 });
  const crateMatA = mat(0xb08a56, 0.82);
  const crateMatB = mat(0x8d7350, 0.86);
  const crateBand = mat(0x5c4a33, 0.9);
  const addPallet = (x, z, w, d) => {
    box(scene, w, 0.14, d, palletWood, x, 0.07, z);
    for (let i = 0; i < 3; i++) {
      const ww = w * (0.92 - i * 0.06);
      const dd = d * (0.92 - i * 0.05);
      const ox = i % 2 ? 0.03 : -0.02;
      const y = 0.21 + i * 0.44;
      box(scene, ww, 0.42, dd, i % 2 ? crateMatB : crateMatA, x + ox, y, z);
      box(scene, ww + 0.02, 0.045, dd + 0.02, crateBand, x + ox, y + 0.19, z, { cast: false });
      box(scene, 0.05, 0.42, dd + 0.025, crateBand, x + ox - ww / 2 + 0.05, y, z, { cast: false });
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, blocksSight: true });
  };
  addPallet(-3.9, 3.35, 1.25, 1.15);
  addPallet(1.55, 3.7, 1.05, 1.0);
  addPallet(-5.6, -0.6, 0.95, 1.7);

  // ---------- кассовый прилавок ----------
  box(scene, 2.9, 1.0, 0.75, matTex('assets/tex/wood_dark.jpg', 2, 1, 0x9a8468, 0.7, { bump: 0.015 }), 4.55, 0.5, 1.5);
  box(scene, 0.01, 0.02, 0.76, mat(0x2a2c30, 0.5), 4.55, 1.01, 1.5, { cast: false });
  colliders.push({ minX: 3.1, maxX: 6.0, minZ: 1.1, maxZ: 1.9 });
  box(scene, 0.42, 0.2, 0.34, mat(0x2a2e34, 0.4), 4.9, 1.10, 1.55);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0a2a12, emissive: 0x40ff70, emissiveIntensity: 0.8, roughness: 0.3 }));
  screen.position.set(4.9, 1.23, 1.38);
  screen.rotation.x = -0.5;
  scene.add(screen);
  box(scene, 1.1, 0.06, 0.5, mat(0x1a1a1c, 0.6), 3.9, 1.03, 1.45);
  for (let i = 0; i < 3; i++) {
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.18, 12, 1, true), mat(0xc84a3a, 0.7));
    basket.position.set(1.85 + (i % 2) * 0.3, 0.09 + Math.floor(i / 2) * 0.18, 5.15);
    scene.add(basket);
  }

  // Спички лежат плоско на прилавке; второй коробки на стеллаже больше нет.
  const matchesTarget = dynamicGroup('matches');
  texturedPack(matchesTarget, 'assets/tex/box_matches.jpg', 0.20, 0.12, 0.14, 5.43, 1.0, 1.50);
  textTag(ITEMS.matches.name, 'БЕРИ ТИХО', 5.43, 0.88, 1.882, 0, 0.32, 0.14);

  // ---------- дозиметр на ленте у кассы ----------
  const geigerTarget = dynamicGroup('geiger');
  box(geigerTarget, 0.42, 0.06, 0.34, mat(0x2a2e33, 0.5, { metalness: 0.4 }), 3.45, 1.09, 1.5);
  box(geigerTarget, 0.30, 0.11, 0.20, mat(0x4a4f56, 0.45, { metalness: 0.3 }), 3.45, 1.175, 1.5);
  const geigerScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x0a2a12, emissive: 0x55ff88, emissiveIntensity: 0.9, roughness: 0.3 }));
  geigerScreen.rotation.x = -Math.PI / 2;
  geigerScreen.position.set(3.45, 1.232, 1.5);
  geigerTarget.add(geigerScreen);
  // Открытая витринная рамка: стекло не проходит сквозь прибор.
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbfe0ef, transparent: true, opacity: 0.13, roughness: 0.08,
    metalness: 0.05, depthWrite: false, side: THREE.DoubleSide
  });
  plane(scene, 0.46, 0.38, glassMat, 3.45, 1.43, 1.5, 0, -Math.PI / 2);
  for (const gx of [3.21, 3.69]) plane(scene, 0.38, 0.34, glassMat, gx, 1.25, 1.5, Math.PI / 2);
  textTag(ITEMS.geiger.name, 'БЕРИ ТИХО', 3.45, 0.88, 1.882, 0, 0.38, 0.15);

  // ---------- лекарства на настенной витрине ----------
  // Отдельная тумба у кассы убрана: она перекрывала подход к спичкам.
  const medsTarget = dynamicGroup('meds');
  const medMat = mat(0xd8dce4, 0.6);
  const medPositions = [[5.85, 0.27], [6.10, 0.27], [5.85, 0.51], [6.10, 0.51]];
  medPositions.forEach(([x, z], i) => {
    box(i === 0 ? medsTarget : scene, 0.16, 0.22, 0.10, medMat, x, 1.10 + 0.11, z);
  });
  textTag(ITEMS.meds.name, 'БЕРИ ТИХО', 5.638, 0.96, 0.4, -Math.PI / 2, 0.36, 0.16);

  // ---------- колбасная витрина ----------
  box(scene, 0.85, 0.95, 1.55, matTex('assets/tex/shelf_metal.jpg', 1, 2, 0xb8bcc0, 0.4, { metalness: 0.3, bump: 0.006 }), 5.9, 0.475, 4.8);
  box(scene, 0.9, 0.05, 1.6, mat(0xd8dce0, 0.25, { metalness: 0.5 }), 5.9, 0.97, 4.8, { cast: false });
  const kolbasaTarget = dynamicGroup('kolbasa');
  const sausageGeo = new THREE.TorusGeometry(0.13, 0.055, 8, 20);
  const sausageMat = mat(0x8a4030, 0.7);
  [4.30, 4.80, 5.25].forEach((z, i) => {
    const ring = new THREE.Mesh(sausageGeo, sausageMat);
    ring.rotation.x = -Math.PI / 2; // кольцо лежит на столешнице, а не стоит ребром
    ring.position.set(5.82, 0.995 + 0.055, z);
    ring.castShadow = true;
    (i === 0 ? kolbasaTarget : scene).add(ring);
  });
  box(scene, 0.3, 0.14, 0.34, mat(0xe8e8e4, 0.4), 6.18, 1.065, 5.28);
  const wscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x0a2a12, emissive: 0x40ff70, emissiveIntensity: 0.5 }));
  wscreen.position.set(6.024, 1.15, 5.28);
  wscreen.rotation.x = -0.4;
  wscreen.rotation.y = -Math.PI / 2;
  scene.add(wscreen);
  textTag(ITEMS.kolbasa.name, 'БЕРИ ТИХО', 5.438, 0.77, 4.75, -Math.PI / 2);
  colliders.push({ minX: 5.4, maxX: 6.4, minZ: 4.0, maxZ: 5.6 });

  // ---------- настенная витрина для лекарств ----------
  box(scene, 0.7, 1.1, 0.5, mat(0xb8b4aa, 0.6), 6.0, 0.55, 0.4);
  colliders.push({ minX: 5.6, maxX: 6.4, minZ: 0.1, maxZ: 0.7 });

  // ---------- морозильный ларь ----------
  const freezerMat = matTex('assets/tex/shelf_metal.jpg', 1, 2, 0xe0e2e6, 0.35, { metalness: 0.35, bump: 0.006 });
  box(scene, 1.3, 0.68, 2.2, freezerMat, -5.75, 0.34, 2.3);
  box(scene, 1.16, 0.04, 2.02, mat(0xc6d0d5, 0.55), -5.75, 0.72, 2.3, { cast: false });
  for (const fx of [-6.36, -5.14]) box(scene, 0.08, 0.26, 2.2, freezerMat, fx, 0.81, 2.3);
  for (const fz of [1.24, 3.36]) box(scene, 1.3, 0.26, 0.08, freezerMat, -5.75, 0.81, fz);
  for (let i = 0; i < 5; i++) {
    box(scene, 0.30, 0.10, 0.24, mat([0xd8c060, 0xc85a4a, 0xd8d0c0][i % 3], 0.55),
      -5.95 + (i % 2) * 0.38, 0.74 + 0.05, 1.60 + Math.floor(i / 2) * 0.50);
  }
  const frostTop = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x9ab4c8, emissive: 0x6a90b0, emissiveIntensity: 0.25, roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false }));
  frostTop.rotation.x = -Math.PI / 2;
  frostTop.position.set(-5.75, 0.945, 2.3);
  scene.add(frostTop);
  const frostRim = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.0),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/frost.png'), transparent: true, roughness: 0.7, depthWrite: false, opacity: 0.72 }));
  frostRim.rotation.x = -Math.PI / 2;
  frostRim.position.set(-5.75, 0.951, 2.3);
  scene.add(frostRim);
  colliders.push({ minX: -6.45, maxX: -5.05, minZ: 1.1, maxZ: 3.5 });

  // ---------- Людмила ----------
  const lyudmila = createHumanoid({
    height: 1.62, girth: 1.22, skin: 0xc09a76, headScale: 1.02,
    cloth: 0x6a2a34, cloth2: 0x3a2028, coatColor: 0x6a2a34,
    hat: false, bald: false, mouth: 'none', eyeColor: 0x1a1410,
    fingers: 4, shadow: true
  });
  lyudmila.root.position.set(4.55, 0, 0.75);
  lyudmila.root.rotation.y = 0;
  scene.add(lyudmila.root);
  const LYUD_YAW = 0;
  const lyudmilaRef = { rig: lyudmila, model: null };
  loadModel('assets/models/tripo_light.glb').then((gltf) => {
    const model = groundAndScale(gltf.scene, 1.62);
    enableShadows(model);
    model.position.set(4.55, model.position.y, 0.75);
    model.rotation.y = LYUD_YAW;
    scene.add(model);
    scene.remove(lyudmila.root);
    lyudmilaRef.model = model;
    lyudmilaRef.baseY = model.position.y;
  }).catch((e) => console.warn('GLB Людмилы не загрузился, используется риг:', e));

  // ---------- настенная графика ----------
  plane(scene, 1.7, 1.06, posterMat('assets/tex/poster_butter.png'), -4.6, 2.45, -5.285, 0);
  plane(scene, 1.5, 0.94, posterMat('assets/tex/poster_bread.png'), 6.388, 2.2, 3.45, -Math.PI / 2);
  plane(scene, 0.9, 0.34, posterMat('assets/tex/sign_open.png'), -0.9, 2.38, 5.58, Math.PI);
  plane(scene, 1.5, 0.94, posterMat('assets/tex/poster_yellow.png'), -6.388, 2.1, 0.4, Math.PI / 2);
  plane(scene, 1.2, 0.75, posterMat('assets/tex/poster_basement.png'), 6.388, 1.9, -2.2, -Math.PI / 2);

  // ---------- таблички ----------
  const aisleMat = (p) => new THREE.MeshStandardMaterial({ map: tex(p), roughness: 0.8, side: THREE.DoubleSide });
  for (const [ax, texName] of [[-4.7, 'assets/tex/aisle_1.png'], [-1.9, 'assets/tex/aisle_2.png'], [0.9, 'assets/tex/aisle_3.png']]) {
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.45), aisleMat(texName));
    sgn.position.set(ax, 2.55, -1.0);
    scene.add(sgn);
    box(scene, 0.03, 0.35, 0.03, mat(0x8a8f96, 0.5), ax, 2.85, -1.0, { cast: false });
  }
  const kassaSign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.36), aisleMat('assets/tex/sign_kassa.png'));
  kassaSign.position.set(4.7, 2.6, 2.2);
  kassaSign.rotation.y = Math.PI;
  scene.add(kassaSign);
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/sign_exit.png'), emissive: 0x2a6a3a, emissiveIntensity: 0.7, roughness: 0.6 }));
  exitSign.position.set(0, 2.5, 5.55);
  exitSign.rotation.y = Math.PI;
  scene.add(exitSign);

  // ---------- газетный стенд ----------
  box(scene, 0.7, 1.1, 0.4, mat(0x6a6e74, 0.5, { metalness: 0.4 }), -1.9, 0.55, 4.7);
  const newsTarget = dynamicGroup('news');
  for (let i = 0; i < 3; i++) {
    const np = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44),
      new THREE.MeshStandardMaterial({ map: tex('assets/tex/newspaper.jpg'), roughness: 0.95 }));
    np.position.set(-2.02 + i * 0.12, 1.112 + i * 0.008, 4.68 + i * 0.014);
    np.rotation.x = -Math.PI / 2;
    np.rotation.z = -0.12 + i * 0.12;
    np.castShadow = false;
    newsTarget.add(np);
  }
  colliders.push({ minX: -2.3, maxX: -1.55, minZ: 4.45, maxZ: 4.95 });

  // ---------- фото сына Людмилы ----------
  box(scene, 0.16, 0.2, 0.02, mat(0x3a2a1e, 0.6), 4.0, 1.10, 1.25);
  plane(scene, 0.12, 0.16, new THREE.MeshStandardMaterial({ map: tex('assets/tex/photo_marek.jpg'), roughness: 0.6 }),
    4.0, 1.10, 1.262, 0);

  // ---------- Зося ----------
  const zosia = createHumanoid({
    height: 1.52, girth: 1.28, skin: 0xb89a7e, headScale: 1.05,
    cloth: 0x5a5a48, cloth2: 0x3a3a2e, coatColor: 0x5e5e4a,
    hat: true, hatColor: 0x6a5a4a, mouth: 'none', eyeColor: 0x1a1612,
    fingers: 4, shadow: true
  });
  zosia.root.position.set(2.55, 0, 2.45);
  zosia.root.rotation.y = -2.35;
  scene.add(zosia.root);

  // ---------- свет ----------
  scene.add(new THREE.HemisphereLight(0xdfe8f4, 0x3a3a38, 1.25));
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf0f6ff, emissiveIntensity: 1.5, roughness: 0.4 });
  const panels = [];
  for (const pz of [-3.4, -0.6, 2.2]) {
    for (const px of [-3.4, 0.4]) {
      panels.push(box(scene, 2.2, 0.06, 0.5, panelMat, px, 3.12, pz, { cast: false, receive: false }));
    }
  }
  // Панели создаются до общего батча: шесть одинаковых светильников становятся
  // одним InstancedMesh. Материал общий, поэтому мерцание panels[1] сохраняется.
  const batched = batchStaticMeshes(scene, [lyudmila.root, zosia.root, lyudmilaRef.model]);
  console.log('[store] batched:', batched.batched, 'of', batched.groups, 'groups');
  const shopLight1 = new THREE.PointLight(0xe8f0ff, 16, 16, 2);
  shopLight1.position.set(-2, 2.9, -1.5);
  scene.add(shopLight1);
  const shopLight2 = new THREE.PointLight(0xe8f0ff, 14, 15, 2);
  shopLight2.position.set(2.5, 2.9, 1.8);
  scene.add(shopLight2);
  const fridgeLight = new THREE.PointLight(0x8ec0e8, 10, 8, 2);
  fridgeLight.position.set(-4.4, 1.6, -3.9);
  scene.add(fridgeLight);
  const cashLight = new THREE.PointLight(0xffe0b0, 8, 7, 2);
  cashLight.position.set(4.6, 2.5, 1.6);
  scene.add(cashLight);

  // ---------- взгляд Людмилы ----------
  // Полупрозрачный сектор на полу — это не декор, а реальная зона обзора.
  // Людмила медленно переводит взгляд: пауза -> поворот -> пауза.
  const LYUD_X = 4.55, LYUD_Z = 0.75;
  const GAZE_HALF = 0.58;
  const GAZE_RANGE = 8.6;
  const GAZE_STOPS = [
    { yaw: 0.16, hold: 4.2 },   // смотрит на прилавок и вход
    { yaw: -0.55, hold: 2.6 },  // зал
    { yaw: -1.35, hold: 2.2 },  // середина
    { yaw: -2.05, hold: 3.8 },  // дальние стеллажи
    { yaw: -1.35, hold: 2.0 },
    { yaw: -0.55, hold: 3.0 }
  ];
  const gaze = {
    yaw: GAZE_STOPS[0].yaw, target: GAZE_STOPS[0].yaw,
    stop: 0, wait: GAZE_STOPS[0].hold, moving: false, alert: 0
  };
  const gazeGroup = new THREE.Group();
  gazeGroup.position.set(LYUD_X, 0.028, LYUD_Z);
  gazeGroup.userData.noHighlight = true;
  scene.add(gazeGroup);
  // Сектор — не просто веер на полу: он обрезается стенами и укрытиями.
  // Иначе свет уходил бы сквозь стеллажи и стены и читался как пятно.
  const FAN_SEG = 40;
  const fanPos = new Float32Array((FAN_SEG + 2) * 3);
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPos, 3));
  const fanIndex = [];
  for (let i = 0; i < FAN_SEG; i++) fanIndex.push(0, i + 1, i + 2);
  fanGeo.setIndex(fanIndex);
  // Пол в «Бедронке» и так светлый: аддитивный блендинг выжигал его в белое.
  // Поэтому зона — мягкая янтарная тонировка.
  const gazeMat = new THREE.MeshBasicMaterial({
    color: 0xe8b25a, transparent: true, opacity: 0.15, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });
  const gazeMesh = new THREE.Mesh(fanGeo, gazeMat);
  gazeMesh.frustumCulled = false;
  gazeMesh.renderOrder = 2;
  gazeMesh.userData.noHighlight = true;
  gazeGroup.add(gazeMesh);

  // Лучи по краям сектора: именно они читаются на светлом полу.
  // Длина луча упирается в первую стену или укрытие.
  const RAY_W = 0.12;
  const rayGeo = new THREE.PlaneGeometry(1, RAY_W);
  rayGeo.translate(0.5, 0, 0);
  rayGeo.rotateX(-Math.PI / 2);
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0x9a6620, transparent: true, opacity: 0.26, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });
  const gazeRays = [];
  for (const side of [-1, 1]) {
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.rotation.y = GAZE_HALF * side;
    ray.position.y = 0.002;
    ray.renderOrder = 3;
    ray.userData.noHighlight = true;
    gazeGroup.add(ray);
    gazeRays.push(ray);
  }

  // Пятно у ног: тёплый круг, чтобы источник сектора читался сразу.
  const eyeGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xffe2ae, transparent: true, opacity: 0.26, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    })
  );
  eyeGlow.position.y = 0.004;
  eyeGlow.renderOrder = 3;
  eyeGlow.userData.noHighlight = true;
  gazeGroup.add(eyeGlow);
  const GAZE_SAFE = new THREE.Color(0xd9a75e);
  const GAZE_DANGER = new THREE.Color(0xd2452a);
  const GAZE_EDGE_SAFE = new THREE.Color(0x9a6620);
  const GAZE_EDGE_DANGER = new THREE.Color(0x8f2416);

  // Пересечение отрезка (взгляд) с прямоугольником укрытия.
  function segmentHitsBox(x1, z1, x2, z2, c) {
    const dx = x2 - x1, dz = z2 - z1;
    let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[x1, dx, c.minX, c.maxX], [z1, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) return false;
        continue;
      }
      const inv = 1 / d;
      let a = (lo - p) * inv, b = (hi - p) * inv;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return false;
    }
    return t0 > 0.02 && t1 < 0.98;
  }
  function blocksSight(x1, z1, x2, z2) {
    for (const c of colliders) {
      if (!c.blocksSight) continue;
      if (segmentHitsBox(x1, z1, x2, z2, c)) return true;
    }
    return false;
  }
  // Насколько далеко достаёт взгляд в направлении angle: ближайшая стена
  // зала или укрытие с blocksSight.
  function rayBoxDistance(x, z, dx, dz, c) {
    let t0 = 0, t1 = Infinity;
    for (const [p, d, lo, hi] of [[x, dx, c.minX, c.maxX], [z, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) return Infinity;
        continue;
      }
      const inv = 1 / d;
      let a = (lo - p) * inv, b = (hi - p) * inv;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return Infinity;
    }
    return t0 > 0.04 ? t0 : Infinity;
  }
  function gazeReach(angle) {
    const dx = Math.sin(angle), dz = Math.cos(angle);
    let reach = GAZE_RANGE;
    let wall = Infinity;
    if (dx > 1e-6) wall = Math.min(wall, (bounds.maxX - LYUD_X) / dx);
    else if (dx < -1e-6) wall = Math.min(wall, (bounds.minX - LYUD_X) / dx);
    if (dz > 1e-6) wall = Math.min(wall, (bounds.maxZ - LYUD_Z) / dz);
    else if (dz < -1e-6) wall = Math.min(wall, (bounds.minZ - LYUD_Z) / dz);
    if (wall < reach) reach = wall;
    for (const c of colliders) {
      if (!c.blocksSight) continue;
      const hit = rayBoxDistance(LYUD_X, LYUD_Z, dx, dz, c);
      if (hit < reach) reach = hit;
    }
    return Math.max(0.5, reach - 0.04);
  }
  function refreshGazeShape() {
    let o = 0;
    fanPos[o++] = 0; fanPos[o++] = 0; fanPos[o++] = 0;
    for (let i = 0; i <= FAN_SEG; i++) {
      const a = -GAZE_HALF + (GAZE_HALF * 2) * (i / FAN_SEG);
      const d = gazeReach(gaze.yaw + a);
      fanPos[o++] = Math.cos(a) * d;
      fanPos[o++] = 0;
      fanPos[o++] = -Math.sin(a) * d;
    }
    fanGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      gazeRays[i].scale.x = gazeReach(gaze.yaw + GAZE_HALF * side);
    }
  }
  function sees(x, z) {
    const dx = x - LYUD_X, dz = z - LYUD_Z;
    if (dx * dx + dz * dz > GAZE_RANGE * GAZE_RANGE) return false;
    const ang = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(ang - gaze.yaw), Math.cos(ang - gaze.yaw));
    if (Math.abs(diff) > GAZE_HALF) return false;
    return !blocksSight(LYUD_X, LYUD_Z, x, z);
  }

  let t = 0;
  let poseTick = -1;
  function update(dt) {
    t += dt;
    // Сканирование зала: пауза -> медленный поворот -> пауза.
    if (gaze.moving) {
      const d = gaze.target - gaze.yaw;
      const step = 0.82 * dt;
      if (Math.abs(d) <= step) {
        gaze.yaw = gaze.target;
        gaze.moving = false;
        gaze.wait = GAZE_STOPS[gaze.stop].hold;
      } else {
        gaze.yaw += Math.sign(d) * step;
      }
    } else {
      gaze.wait -= dt;
      if (gaze.wait <= 0) {
        gaze.stop = (gaze.stop + 1) % GAZE_STOPS.length;
        gaze.target = GAZE_STOPS[gaze.stop].yaw;
        gaze.moving = true;
      }
    }
    gazeGroup.rotation.y = gaze.yaw - Math.PI / 2;
    refreshGazeShape();
    gazeMat.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    gazeMat.opacity = 0.24 + gaze.alert * 0.18 + Math.sin(t * 2.6) * 0.012;
    rayMat.color.copy(GAZE_EDGE_SAFE).lerp(GAZE_EDGE_DANGER, gaze.alert);
    rayMat.opacity = 0.42 + gaze.alert * 0.34 + (gaze.moving ? 0.05 : 0)
      + Math.sin(t * 2.6) * 0.03;
    eyeGlow.material.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    eyeGlow.material.opacity = 0.22 + gaze.alert * 0.3;
    if (lyudmilaRef.model) {
      lyudmilaRef.model.rotation.y = gaze.yaw;
      lyudmilaRef.model.position.y = (lyudmilaRef.baseY || 0) + Math.sin(t * 1.5) * 0.004;
    } else {
      resetPose(lyudmila);
      lyudmila.root.rotation.y = gaze.yaw;
      pose.idle(lyudmila, t * 0.8);
    }
    const tick = Math.floor(t * 20);
    if (tick !== poseTick) {
      poseTick = tick;
      resetPose(zosia);
      pose.idle(zosia, t * 0.55 + 2);
      zosia.joints.hips.rotation.y = Math.sin(t * 0.8) * 0.08;
    }
    const f = Math.sin(t * 7.3) > -0.7 ? 1 : 0.45;
    panels[1].material.emissiveIntensity = 1.5 * f;
    shopLight1.intensity = 16 * (0.96 + Math.sin(t * 40) * 0.04) * f;
  }

  const shelfAnchor = (key, r = 1.08) => {
    const s = spots[key];
    return {
      x: s.anchorX, z: s.z, r,
      hl: [s.x, s.baseY + 0.14, s.z, 0.32, 0.34, 0.32]
    };
  };

  return {
    scene, bounds, colliders, lyudmila, zosia, lyudmilaRef, targets,
    stealth: {
      sees, range: GAZE_RANGE, half: GAZE_HALF,
      eye: { x: LYUD_X, z: LYUD_Z },
      setAlert(v) { gaze.alert = Math.max(0, Math.min(1, Number(v) || 0)); },
      get yaw() { return gaze.yaw; },
      get scanning() { return gaze.moving; }
    },
    surfaceDoors: [{ id: 'store-exit', x: 0, z: 5.65, radius: 2.1, ...entranceDoor, get openAmount() { return entranceDoor.openAmount; } }],
    anchors: {
      exit: { x: 0, z: 5.0 },
      checkout: { x: 4.35, z: 2.55, r: 1.3 },
      lyudmila: { x: 4.55, z: 0.75, r: 2.2 },
      zosia: { x: 2.55, z: 2.75, r: 1.2 },
      news: { x: -1.9, z: 4.0, r: 1.3, hl: [-1.9, 0.8, 4.7, 1.0, 1.6, 0.5] },
      butter: shelfAnchor('butter', 1.15),
      tushonka: shelfAnchor('tushonka'),
      sguschenka: shelfAnchor('sguschenka'),
      krupa: shelfAnchor('krupa'),
      tea: shelfAnchor('tea'),
      socks: shelfAnchor('socks'),
      bread: { x: 5.03, z: 3.05, r: 1.08, hl: [5.86, 0.94, 2.95, 0.35, 0.20, 0.20] },
      kolbasa: { x: 5.02, z: 4.30, r: 1.05, hl: [5.82, 1.05, 4.30, 0.40, 0.13, 0.40] },
      meds: { x: 5.08, z: 0.42, r: 1.0, hl: [5.85, 1.21, 0.27, 0.20, 0.25, 0.14] },
      geiger: { x: 3.25, z: 2.35, r: 1.0, hl: [3.45, 1.16, 1.5, 0.48, 0.28, 0.40] },
      matches: { x: 5.25, z: 2.22, r: 0.82, hl: [5.43, 1.06, 1.5, 0.24, 0.16, 0.18] }
    },
    update
  };
}
