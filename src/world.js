// world.js — квартира Хомки: гостиная, прихожая, спальня, ванная + подъезд за дверью.
// Всё из примитивов. Стены — коллайдеры, проёмы между комнатами открыты.
// Возвращает сцену, коллайдеры, дверь с петлёй, глазок, якоря для интерактивов.

import * as THREE from 'three';
import { tex, box, mat, plane } from './mats.js';

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a12);
  scene.fog = new THREE.FogExp2(0x0d1220, 0.028);

  const ROOM = { minX: -2.2, maxX: 2.2, minZ: -2.5, maxZ: 2.6, h: 2.72 };
  // полные границы квартиры (ванная выступает вправо)
  const FLAT = { minX: -2.2, maxX: 3.8, minZ: -2.5, maxZ: 6.6 };
  const colliders = [];

  // mat() импортирован: кэш материалов из mats.js + батчер дают минимум draw calls.
  const slab = (w, h, d, m, x, y, z, cast = false) => box(scene, w, h, d, m, x, y, z, { cast });

  // стена = slab + коллайдер (чтобы не пройти сквозь неё)
  const wall = (w, h, d, m, x, y, z) => {
    const mesh = slab(w, h, d, m, x, y, z);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  };

  // ---------- материалы ----------
  const wallMat = mat(0x8f8a82, 0.95, { map: tex('assets/tex/wall_plaster_home.jpg', 2.4, 1.2), bumpMap: tex('assets/tex/wall_plaster_home.jpg', 2.4, 1.2, false), bumpScale: 0.008 });
  const bedroomMat = mat(0xb0a090, 0.95, { map: tex('assets/tex/wallpaper.jpg', 2, 1), bumpMap: tex('assets/tex/wallpaper.jpg', 2, 1, false), bumpScale: 0.006 });
  const bathMat = mat(0xc8c4b8, 0.6, { map: tex('assets/tex/tiles_kitchen.jpg', 2, 2), bumpMap: tex('assets/tex/tiles_kitchen.jpg', 2, 2, false), bumpScale: 0.01 });
  const floorMat = mat(0xb0a08c, 0.85, { map: tex('assets/tex/floor_wood.jpg', 2.5, 3.0), bumpMap: tex('assets/tex/floor_wood.jpg', 2.5, 3.0, false), bumpScale: 0.014 });
  const ceilMat = mat(0x1c1d22);
  // Подъезд виден только через глазок (125° угол, за стеклом) — bump там не читается,
  // а стоил второй выборки текстуры на каждый пиксель: оставлена только карта цвета.
  const corrWallMat = mat(0x6f7480, 0.95, { map: tex('assets/tex/wall_plaster_cold.jpg', 3.2, 1.2) });
  const corrFloorMat = mat(0x55585e, 0.85, { map: tex('assets/tex/wall_plaster_cold.jpg', 3, 1) });
  const bathFloorMat = mat(0x9a968c, 0.7, { map: tex('assets/tex/tiles_kitchen.jpg', 2, 2), bumpMap: tex('assets/tex/tiles_kitchen.jpg', 2, 2, false), bumpScale: 0.01 });

  const H = ROOM.h;
  const mkFloor = (x0, x1, z0, z1, m, y = 0.001) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    p.rotation.x = -Math.PI / 2;
    p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    p.receiveShadow = true;
    scene.add(p);
    return p;
  };

  // ---------- полы ----------
  mkFloor(ROOM.minX, ROOM.maxX, ROOM.minZ, ROOM.maxZ, floorMat);           // гостиная
  mkFloor(-2.2, 2.2, 2.6, 4.0, floorMat);                                 // прихожая
  mkFloor(-2.2, 2.2, 4.0, 6.6, mat(0xa89484, 0.9, { map: tex('assets/tex/floor_wood.jpg', 2, 2) })); // спальня
  mkFloor(2.2, 3.8, 2.6, 4.6, bathFloorMat, 0.002);                       // ванная

  // ---------- потолок (единый) ----------
  // Потолок — плоскость вниз: верхняя грань бокса не видна никогда, а от потолка
  // в кадре нужна только внутренняя сторона. Плоский цвет уже без текстуры.
  const flatCeil = plane(scene, FLAT.maxX - FLAT.minX + 0.2, FLAT.maxZ - FLAT.minZ + 0.2, ceilMat,
    (FLAT.minX + FLAT.maxX) / 2, H, (FLAT.minZ + FLAT.maxZ) / 2, 0, Math.PI / 2);
  flatCeil.receiveShadow = true;

  // ---------- наружные стены ----------
  wall(0.1, H, 6.6 - (-2.5), wallMat, -2.25, H / 2, 2.05);                  // левая, вся длина
  wall(0.1, H, 2.6 - (-2.5), wallMat, 2.25, H / 2, 0.05);                   // правая гостиной (с окном ниже)
  wall(0.1, H, 2.0, wallMat, 2.25, H / 2, 5.6);                             // правая спальни
  wall(0.1, H, 2.0, bathMat, 3.85, H / 2, 3.6);                             // правая ванной
  wall(6.0, H, 0.1, bedroomMat, -0.8 + 3.0 - 2.2, H / 2, 6.65);             // задняя спальни
  wall(1.6, H, 0.1, bathMat, 3.0, H / 2, 2.55);                             // ванная, передняя
  wall(1.6, H, 0.1, bathMat, 3.0, H / 2, 4.65);                             // ванная, задняя

  // ---------- передняя стена гостиной с входной дверью ----------
  const doorW = 1.0;
  const sideW = (4.4 - doorW) / 2;
  wall(sideW, H, 0.1, wallMat, -2.2 + sideW / 2, H / 2, -2.55);
  wall(sideW, H, 0.1, wallMat, 2.2 - sideW / 2, H / 2, -2.55);
  slab(doorW, H - 2.06, 0.1, wallMat, 0, 2.06 + (H - 2.06) / 2, -2.55); // над дверью

  // ---------- стена гостиная ↔ прихожая (проём x 0.35..1.35) ----------
  wall(2.55, H, 0.1, wallMat, -2.2 + 2.55 / 2, H / 2, 2.65);                // левая часть (ТВ, подвал)
  wall(0.85, H, 0.1, wallMat, 1.35 + 0.85 / 2, H / 2, 2.65);                // правая часть
  slab(1.0, H - 2.06, 0.1, wallMat, 0.85, 2.06 + (H - 2.06) / 2, 2.65);     // перемычка

  // ---------- стена прихожая ↔ спальня (проём x 0.4..1.4) ----------
  wall(2.6, H, 0.1, wallMat, -2.2 + 2.6 / 2, H / 2, 4.05);
  wall(0.8, H, 0.1, wallMat, 1.4 + 0.8 / 2, H / 2, 4.05);
  slab(1.0, H - 2.06, 0.1, wallMat, 0.9, 2.06 + (H - 2.06) / 2, 4.05);
  // обратная сторона — обои спальни (тонкие панели поверх)
  slab(2.6, H, 0.02, bedroomMat, -2.2 + 2.6 / 2, H / 2, 4.12, false);
  slab(0.8, H, 0.02, bedroomMat, 1.4 + 0.8 / 2, H / 2, 4.12, false);

  // ---------- стена прихожая ↔ ванная (проём z 2.9..3.9) ----------
  wall(0.1, H, 0.3, bathMat, 2.25, H / 2, 2.75);
  wall(0.1, H, 0.7, bathMat, 2.25, H / 2, 4.25);
  slab(0.1, H - 2.06, 1.0, bathMat, 2.25, 2.06 + (H - 2.06) / 2, 3.4);

  // ---------- подъезд (декор за входной дверью) ----------
  const CORR = { x0: -6, x1: 6, z0: -4.6, z1: -2.5, h: 2.6 };
  // Подъезд за входной дверью: дверь в игре не открывается, единственный взгляд —
  // через глазок (125° камера). Вся геометрия подъезда живёт в отдельной группе,
  // выключенной до входа в глазок: эти ~15 мешей не тратят fill rate за дверью
  // в самом частом кадре игры (взгляд на входную дверь).
  const corridorGroup = new THREE.Group();
  corridorGroup.userData.dynamic = true; // не отдавать в статик-батч: группе нужно гаснуть целиком
  corridorGroup.visible = false;
  scene.add(corridorGroup);
  // Недосягаемые поверхности — плоскости одной гранью вместо боксов (2 тр. вместо 12,
  // нет невидимых сторон): пол смотрит вверх, потолок вниз, стены внутрь подъезда.
  const cplane = (w, h, m, x, y, z, ry = 0, rx = 0) => plane(corridorGroup, w, h, m, x, y, z, ry, rx);
  const dustGeo = new THREE.BufferGeometry();
  const dustN = 140;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 2.6;
    dustPos[i * 3 + 1] = Math.random() * 2.4;
    dustPos[i * 3 + 2] = CORR.z0 + Math.random() * (CORR.z1 - CORR.z0) * 0.5;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xbfd4ff, size: 0.012, transparent: true, opacity: 0.35,
    sizeAttenuation: true, depthWrite: false
  }));
  corridorGroup.add(dust);
  cplane(CORR.x1 - CORR.x0, CORR.z1 - CORR.z0, corrFloorMat,
    (CORR.x0 + CORR.x1) / 2, 0, (CORR.z0 + CORR.z1) / 2, 0, -Math.PI / 2); // пол
  cplane(CORR.x1 - CORR.x0, CORR.z1 - CORR.z0, ceilMat,
    (CORR.x0 + CORR.x1) / 2, CORR.h, (CORR.z0 + CORR.z1) / 2, 0, Math.PI / 2); // потолок (плоский, без текстуры)
  cplane(CORR.x1 - CORR.x0, CORR.h, corrWallMat,
    (CORR.x0 + CORR.x1) / 2, CORR.h / 2, CORR.z0); // задняя стена
  cplane(CORR.z1 - CORR.z0, CORR.h, corrWallMat, CORR.x0, CORR.h / 2, (CORR.z0 + CORR.z1) / 2, Math.PI / 2);
  cplane(CORR.z1 - CORR.z0, CORR.h, corrWallMat, CORR.x1, CORR.h / 2, (CORR.z0 + CORR.z1) / 2, -Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const dx = -4.4 + i * 2.2;
    cplane(0.95, 2.0, mat(0x23262e), dx, 1.0, CORR.z0 + 0.03); // дверь соседа — плоскость
    cplane(0.14, 0.03, mat(0x7a6a50, 0.5), dx + 0.32, 1.02, CORR.z0 + 0.12); // почтовый ящик
  }
  const lampGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.05, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x8899bb, emissive: 0xbfd4ff, emissiveIntensity: 1.6 })
  );
  lampGlass.position.set(0, CORR.h - 0.06, (CORR.z0 + CORR.z1) / 2);
  corridorGroup.add(lampGlass);
  const corrLight = new THREE.PointLight(0xbfd4ff, 5.5, 9, 1.8);
  corrLight.position.set(0, CORR.h - 0.25, (CORR.z0 + CORR.z1) / 2);
  scene.add(corrLight);

  // ---------- входная дверь ----------
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-doorW / 2, 0, -2.5);
  scene.add(doorPivot);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.02, 2.02, 0.06), mat(0x4a3626, 0.7));
  doorMesh.position.set(doorW / 2, 1.01, 0);
  doorMesh.castShadow = true;
  doorMesh.receiveShadow = true;
  doorPivot.add(doorMesh);
  for (const fy of [0.55, 1.35]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.6, 0.02), mat(0x3e2d20, 0.7));
    p.position.set(doorW / 2, fy, 0.04);
    doorPivot.add(p);
  }
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat(0xb8a878, 0.3, { metalness: 0.8 }));
  handle.position.set(doorW - 0.08, 1.02, 0.07);
  doorPivot.add(handle);
  const peepholeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), mat(0xc8b060, 0.25, { metalness: 0.9 }));
  peepholeDisc.rotation.x = Math.PI / 2;
  peepholeDisc.position.set(doorW / 2, 1.52, -0.045);
  doorPivot.add(peepholeDisc);
  // внутренняя оправа: латунное кольцо и тёмная линза со стороны квартиры
  const peepRing = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.014, 14), mat(0xc8a858, 0.22, { metalness: 0.92 }));
  peepRing.rotation.x = Math.PI / 2;
  peepRing.position.set(doorW / 2, 1.52, 0.038);
  doorPivot.add(peepRing);
  const peepLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.006, 14),
    new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.12, metalness: 0.4, emissive: 0x0d1622, emissiveIntensity: 0.5 })
  );
  peepLens.rotation.x = Math.PI / 2;
  peepLens.position.set(doorW / 2, 1.52, 0.047);
  doorPivot.add(peepLens);
  // наличник: три планки, а не сплошная плита — иначе дверь и глазок скрыты
  const trimMat = mat(0x241a12);
  slab(doorW + 0.12, 0.06, 0.16, trimMat, 0, 2.11, -2.5);
  slab(0.06, 2.14, 0.16, trimMat, -(doorW / 2 + 0.03), 1.07, -2.5);
  slab(0.06, 2.14, 0.16, trimMat, doorW / 2 + 0.03, 1.07, -2.5);

  // ---------- гостиная: мебель ----------
  const sofaMat = mat(0x39323a, 0.95);
  slab(1.9, 0.42, 0.85, sofaMat, 1.35, 0.21, 0.9, true);
  slab(1.9, 0.55, 0.22, sofaMat, 1.35, 0.62, 1.24, true);
  slab(0.22, 0.6, 0.85, sofaMat, 0.42, 0.3, 0.9, true);
  slab(0.22, 0.6, 0.85, sofaMat, 2.28, 0.3, 0.9, true);
  // подушки
  slab(0.4, 0.16, 0.4, mat(0x5a3a3a, 1), 0.75, 0.5, 1.05, true);
  slab(0.4, 0.16, 0.4, mat(0x3a4a54, 1), 1.85, 0.5, 1.05, true);
  colliders.push({ minX: 0.35, maxX: 2.35, minZ: 0.45, maxZ: 1.35 });

  // Журнальный столик у левой стены: центр комнаты и путь от двери остаются свободными.
  slab(0.9, 0.06, 0.5, mat(0x2f241a, 0.7), -1.5, 0.42, -0.45, true);
  for (const [lx, lz] of [[-1.88, -0.65], [-1.12, -0.65], [-1.88, -0.25], [-1.12, -0.25]]) {
    slab(0.06, 0.4, 0.06, mat(0x2f241a, 0.7), lx, 0.2, lz, false);
  }
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.08, 14), mat(0x8a8578, 0.4));
  cup.position.set(-1.65, 0.49, -0.5);
  cup.castShadow = true;
  scene.add(cup);
  // газета на журнальном столике
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/newspaper.jpg'), roughness: 0.95 }));
  paper.rotation.x = -Math.PI / 2;
  paper.rotation.z = 0.3;
  paper.position.set(-1.3, 0.455, -0.42);
  scene.add(paper);
  colliders.push({ minX: -1.95, maxX: -1.05, minZ: -0.7, maxZ: -0.2 });

  // телевизор — сдвинут влево от проёма в прихожую
  const tvX = -0.9;
  slab(1.1, 0.62, 0.07, mat(0x0c0e11, 0.5), tvX, 1.35, ROOM.maxZ - 0.12, true);
  const tvScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.53),
    new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.2, metalness: 0.4 })
  );
  tvScreen.position.set(tvX, 1.35, ROOM.maxZ - 0.155);
  tvScreen.rotation.y = Math.PI;
  scene.add(tvScreen);
  slab(1.3, 0.06, 0.45, mat(0x241c14, 0.7), tvX, 0.55, ROOM.maxZ - 0.25, true);
  slab(0.08, 0.5, 0.08, mat(0x241c14, 0.7), tvX - 0.4, 0.27, ROOM.maxZ - 0.2, false);
  slab(0.08, 0.5, 0.08, mat(0x241c14, 0.7), tvX + 0.4, 0.27, ROOM.maxZ - 0.2, false);
  colliders.push({ minX: tvX - 0.7, maxX: tvX + 0.3, minZ: 2.15, maxZ: 2.45 });

  // торшер
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 1.5, 10), mat(0x22201c, 0.5, { metalness: 0.5 }));
  lampPole.position.set(-1.75, 0.75, -1.7);
  lampPole.castShadow = true;
  scene.add(lampPole);
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 0.24, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xc9b27a, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffc37a, emissiveIntensity: 0.8 })
  );
  lampShade.position.set(-1.75, 1.55, -1.7);
  scene.add(lampShade);
  // тень: один направленный источник вместо point — раньше было 6 кубомап-проходов
  const lampShadow = new THREE.DirectionalLight(0xffa04f, 1.4);
  lampShadow.position.set(-2.6, 3.6, -2.6);
  lampShadow.target.position.set(1.2, 0, 1.6);
  lampShadow.castShadow = true;
  lampShadow.shadow.mapSize.set(512, 512); // 512² хватает для мягких теней квартиры, в 4 раза дешевле 1024²
  lampShadow.shadow.camera.left = -4;
  lampShadow.shadow.camera.right = 4;
  lampShadow.shadow.camera.top = 4;
  lampShadow.shadow.camera.bottom = -4;
  lampShadow.shadow.camera.near = 0.5;
  lampShadow.shadow.camera.far = 12;
  lampShadow.shadow.bias = -0.0015;
  lampShadow.shadow.normalBias = 0.02;
  scene.add(lampShadow);
  scene.add(lampShadow.target);
  const lampLight = new THREE.PointLight(0xffa04f, 30, 9, 2);
  lampLight.position.set(-1.75, 1.42, -1.7);
  scene.add(lampLight);
  colliders.push({ minX: -2.0, maxX: -1.55, minZ: -1.95, maxZ: -1.45 });

  // ковёр с орнаментом
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2),
    mat(0xa08880, 1.0, { map: tex('assets/tex/rug.jpg') }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0.6);
  rug.receiveShadow = true;
  scene.add(rug);

  // .clone() — материал мутирует только этот постер, кэш не трогаем
  const poster = slab(0.7, 0.95, 0.02, mat(0x1c2436, 0.8).clone(), ROOM.minX + 0.08, 1.6, -0.8, false);
  poster.material.emissive = new THREE.Color(0x0a1430);
  poster.material.emissiveIntensity = 0.35;

  // ---------- окно гостиной (с инеем) ----------
  slab(0.08, H, 0.5, wallMat, ROOM.maxX + 0.05, H / 2, 0.4);
  slab(0.08, H, 0.5, wallMat, ROOM.maxX + 0.05, H / 2, 1.7);
  slab(0.08, 0.62, 0.85, wallMat, ROOM.maxX + 0.05, 2.42, 1.05);
  slab(0.08, 0.9, 0.85, wallMat, ROOM.maxX + 0.05, 0.45, 1.05);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x2a4666, emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.1 })
  );
  glass.rotation.y = -Math.PI / 2;
  glass.position.set(ROOM.maxX + 0.01, 1.55, 1.05);
  scene.add(glass);
  const frostLiving = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/frost.png'), transparent: true, roughness: 0.6, depthWrite: false }));
  frostLiving.rotation.y = -Math.PI / 2;
  frostLiving.position.set(ROOM.maxX - 0.005, 1.55, 1.05);
  scene.add(frostLiving);
  slab(0.06, 1.24, 0.06, mat(0x14161a), ROOM.maxX + 0.04, 1.55, 1.05);
  slab(0.06, 0.06, 0.84, mat(0x14161a), ROOM.maxX + 0.04, 1.55, 1.05);
  const moon = new THREE.DirectionalLight(0x8fb0e0, 0.4);
  moon.position.set(6, 4.5, 1.6);
  moon.target.position.set(0, 0.8, 0.8);
  scene.add(moon);
  scene.add(moon.target);
  const spill = new THREE.SpotLight(0x7a9cc8, 5, 9, 0.7, 0.6, 2);
  spill.position.set(ROOM.maxX + 0.6, 2.1, 1.05);
  spill.target.position.set(-0.4, 0, 1.1);
  scene.add(spill);
  scene.add(spill.target);
  scene.add(new THREE.HemisphereLight(0x44587a, 0x181310, 1.95));
  // общий ambient из HemisphereLight + основной торшер; отдельный ceilFill не нужен
  // tvLight выключен всегда — не создаём: каждый PointLight удорожает шейдер всех материалов

  // ---------- ПРИХОЖАЯ ----------
  // лампочка под потолком
  const hallBulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd8a0, emissive: 0xffc060, emissiveIntensity: 2.6 }));
  hallBulb.position.set(-0.6, 2.5, 3.3);
  scene.add(hallBulb);
  const hallLight = new THREE.PointLight(0xffc878, 7, 6.5, 2);
  hallLight.position.set(-0.6, 2.35, 3.3);
  scene.add(hallLight);
  // вешалка с пальто (левая стена)
  slab(0.06, 0.06, 1.2, mat(0x4a3a2a, 0.7), -2.14, 1.7, 3.3, false);
  const coatCols = [0x3a4048, 0x4a3a2e, 0x2e3a2e];
  for (let i = 0; i < 3; i++) {
    const cz = 2.9 + i * 0.4;
    slab(0.16, 0.85, 0.28, mat(coatCols[i], 1), -2.1, 1.2, cz, true);
    const hook = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mat(0x8a8a80, 0.4, { metalness: 0.6 }));
    hook.position.set(-2.12, 1.68, cz);
    scene.add(hook);
  }
  colliders.push({ minX: -2.2, maxX: -1.95, minZ: 2.7, maxZ: 3.9 });
  // полка для обуви
  slab(0.34, 0.05, 1.2, mat(0x3a2e22, 0.8), -1.98, 0.22, 3.3, true);
  for (let i = 0; i < 3; i++) {
    slab(0.26, 0.12, 0.11, mat(0x2a2622, 0.8), -1.98, 0.31, 2.9 + i * 0.35, true);
    slab(0.26, 0.12, 0.11, mat(0x2a2622, 0.8), -1.98, 0.31, 2.9 + i * 0.35 + 0.13, true);
  }
  colliders.push({ minX: -2.2, maxX: -1.78, minZ: 2.7, maxZ: 3.95 });
  // коврик у проёма
  const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), mat(0x4a3a30, 1));
  mat2.rotation.x = -Math.PI / 2;
  mat2.position.set(0.85, 0.012, 3.0);
  scene.add(mat2);
  // записка на стене (правый простенок прихожей)
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.17),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/note_paper.png'), roughness: 0.95 }));
  note.position.set(1.85, 1.5, 2.72);
  note.rotation.y = Math.PI;
  note.rotation.z = -0.05;
  scene.add(note);

  // ---------- СПАЛЬНЯ ----------
  // кровать (левая стена, изголовьем к задней)
  const bedWood = mat(0x4a3626, 0.75);
  const blanket = mat(0x4a5a6a, 1);
  slab(1.1, 0.28, 2.0, bedWood, -1.45, 0.2, 5.45, true);
  slab(1.05, 0.14, 1.95, mat(0x8a8272, 1), -1.45, 0.41, 5.45, true);
  slab(1.06, 0.08, 1.35, blanket, -1.45, 0.5, 5.15, true);
  slab(1.1, 0.6, 0.08, bedWood, -1.45, 0.55, 6.45, true);  // изголовье
  slab(0.5, 0.1, 0.32, mat(0xc8c0ac, 1), -1.45, 0.53, 6.15, true); // подушка
  colliders.push({ minX: -2.0, maxX: -0.9, minZ: 4.45, maxZ: 6.5 });
  // тумбочка с книгами
  slab(0.4, 0.45, 0.35, bedWood, -0.65, 0.225, 6.3, true);
  slab(0.24, 0.05, 0.2, mat(0x6a3a3a, 0.8), -0.65, 0.48, 6.3, true);
  slab(0.22, 0.04, 0.18, mat(0x3a4a6a, 0.8), -0.65, 0.52, 6.3, true);
  colliders.push({ minX: -0.85, maxX: -0.45, minZ: 6.12, maxZ: 6.48 });
  // шкаф (правая стена)
  slab(0.6, 2.0, 1.1, mat(0x3e2e20, 0.8), 1.85, 1.0, 5.6, true);
  slab(0.02, 1.8, 0.5, mat(0x4e3a28, 0.8), 1.53, 1.0, 5.32, false);
  slab(0.02, 1.8, 0.5, mat(0x4e3a28, 0.8), 1.53, 1.0, 5.88, false);
  slab(0.04, 0.12, 0.03, mat(0xb8a878, 0.4, { metalness: 0.7 }), 1.51, 1.05, 5.55, false);
  slab(0.04, 0.12, 0.03, mat(0xb8a878, 0.4, { metalness: 0.7 }), 1.51, 1.05, 5.65, false);
  colliders.push({ minX: 1.5, maxX: 2.2, minZ: 5.05, maxZ: 6.15 });
  // стол с радио (у задней стены, под окном)
  slab(1.2, 0.05, 0.55, bedWood, 0.35, 0.78, 6.25, true);
  for (const [lx, lz] of [[-0.15, 6.05], [0.85, 6.05], [-0.15, 6.45], [0.85, 6.45]]) {
    slab(0.05, 0.76, 0.05, bedWood, lx, 0.38, lz, false);
  }
  colliders.push({ minX: -0.25, maxX: 0.95, minZ: 5.95, maxZ: 6.55 });
  // радиоприёмник «ВЭФ»
  const radio = new THREE.Group();
  const rbody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.16), mat(0x5a4a36, 0.6));
  radio.add(rbody);
  const rscale = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x2a2010, emissive: 0xd8a040, emissiveIntensity: 0.9, roughness: 0.4 }));
  rscale.position.set(-0.04, 0.03, -0.081);
  rscale.rotation.y = Math.PI;
  radio.add(rscale);
  for (const kx of [0.12, 0.17]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), mat(0x2a241c, 0.4));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(kx, -0.04, -0.09);
    radio.add(knob);
  }
  const rant = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.4, 6), mat(0x9a9a9a, 0.3, { metalness: 0.8 }));
  rant.position.set(0.16, 0.3, 0.02);
  rant.rotation.z = -0.3;
  radio.add(rant);
  radio.position.set(0.2, 0.93, 6.28);
  scene.add(radio);
  // лампа на столе
  const deskShade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.1, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a6a4a, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x2a6a3a, emissiveIntensity: 0.5 }));
  deskShade.position.set(0.72, 1.06, 6.28);
  scene.add(deskShade);
  slab(0.03, 0.24, 0.03, mat(0x2a2a26, 0.5, { metalness: 0.6 }), 0.72, 0.9, 6.28, false);
  const deskLight = new THREE.PointLight(0xd8c890, 5, 4.5, 2);
  deskLight.position.set(0.72, 1.0, 6.2);
  scene.add(deskLight);
  // стул
  slab(0.4, 0.05, 0.4, bedWood, 0.35, 0.45, 5.7, true);
  slab(0.4, 0.45, 0.05, bedWood, 0.35, 0.72, 5.52, true);
  for (const [lx, lz] of [[0.18, 5.55], [0.52, 5.55], [0.18, 5.85], [0.52, 5.85]]) {
    slab(0.04, 0.43, 0.04, bedWood, lx, 0.215, lz, false);
  }
  colliders.push({ minX: 0.12, maxX: 0.58, minZ: 5.5, maxZ: 5.9 });
  // окно спальни с инеем
  const bglass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x24405e, emissiveIntensity: 0.6, roughness: 0.1 }));
  bglass.position.set(0.35, 1.7, 6.59);
  bglass.rotation.y = Math.PI;
  scene.add(bglass);
  const bfrost = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/frost.png'), transparent: true, roughness: 0.6, depthWrite: false }));
  bfrost.position.set(0.35, 1.7, 6.575);
  bfrost.rotation.y = Math.PI;
  scene.add(bfrost);
  slab(1.2, 0.06, 0.06, mat(0x2a2018), 0.35, 1.7, 6.57, false);
  slab(0.06, 1.2, 0.06, mat(0x2a2018), 0.35, 1.7, 6.57, false);
  // рама вокруг
  slab(1.26, 0.08, 0.1, mat(0x2a2018), 0.35, 2.3, 6.57, false);
  slab(1.26, 0.08, 0.1, mat(0x2a2018), 0.35, 1.1, 6.57, false);
  // шторы
  slab(0.22, 1.4, 0.06, mat(0x4a3a44, 1), -0.4, 1.7, 6.5, false);
  slab(0.22, 1.4, 0.06, mat(0x4a3a44, 1), 1.1, 1.7, 6.5, false);
  // фотографии над столом (перенесены из гостиной)
  // (сами фото добавляет home.js — у него рамки)
  // коврик у кровати
  const brug = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), mat(0xa08880, 1, { map: tex('assets/tex/rug.jpg') }));
  brug.rotation.x = -Math.PI / 2;
  brug.position.set(-0.3, 0.012, 5.2);
  scene.add(brug);

  // ---------- ВАННАЯ ----------
  // ванна с занавеской (дальний правый угол)
  const enamel = mat(0xd8d4c8, 0.35);
  slab(0.75, 0.55, 1.5, enamel, 3.35, 0.28, 3.8, true);
  slab(0.65, 0.06, 1.4, mat(0x8a94a0, 0.2), 3.35, 0.5, 3.8, false); // вода
  colliders.push({ minX: 2.95, maxX: 3.8, minZ: 3.05, maxZ: 4.55 });
  // штанга и занавеска (полуоткрыта)
  slab(0.03, 0.03, 1.6, mat(0x9a9a92, 0.4, { metalness: 0.7 }), 2.95, 1.95, 3.8, false);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.5, 8, 1),
    new THREE.MeshStandardMaterial({ color: 0x7a8a94, roughness: 0.95, side: THREE.DoubleSide }));
  const cpos = curtain.geometry.attributes.position;
  for (let i = 0; i < cpos.count; i++) {
    cpos.setZ(i, Math.sin(cpos.getX(i) * 12) * 0.04);
  }
  curtain.position.set(2.96, 1.18, 3.42);
  curtain.rotation.y = Math.PI / 2;
  scene.add(curtain);
  // раковина + зеркало (передняя стена)
  slab(0.5, 0.12, 0.4, enamel, 2.75, 0.85, 2.85, true);
  slab(0.12, 0.5, 0.12, enamel, 2.75, 0.45, 2.85, false);
  const tapB = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), mat(0xb8bcc0, 0.25, { metalness: 0.8 }));
  tapB.position.set(2.75, 0.99, 2.68);
  scene.add(tapB);
  colliders.push({ minX: 2.5, maxX: 3.0, minZ: 2.6, maxZ: 3.05 });
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x6a7a86, roughness: 0.08, metalness: 0.9, emissive: 0x1a2430, emissiveIntensity: 0.4 }));
  mirror.position.set(2.75, 1.45, 2.61);
  scene.add(mirror);
  // полка с банками над раковиной
  slab(0.5, 0.03, 0.16, mat(0x8a8478, 0.7), 2.75, 1.85, 2.7, false);
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), mat([0x7a8a6a, 0xa8988a, 0x6a7a8a][i], 0.4));
    jar.position.set(2.6 + i * 0.14, 1.92, 2.7);
    scene.add(jar);
  }
  // унитаз (задняя стена, слева от ванны)
  const wc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.4, 14), enamel);
  wc.position.set(2.55, 0.2, 4.35);
  wc.castShadow = true;
  scene.add(wc);
  slab(0.34, 0.06, 0.3, enamel, 2.55, 0.43, 4.35, true);
  slab(0.36, 0.4, 0.14, enamel, 2.55, 0.6, 4.52, true);
  colliders.push({ minX: 2.35, maxX: 2.75, minZ: 4.15, maxZ: 4.6 });
  // полотенце
  slab(0.03, 0.03, 0.5, mat(0x9a9a92, 0.4, { metalness: 0.7 }), 3.78, 1.4, 2.9, false);
  slab(0.02, 0.4, 0.3, mat(0x8a6a5a, 1), 3.77, 1.2, 2.9, false);
  // лампочка ванной
  const bathLight = new THREE.PointLight(0xc8d4e0, 4, 4, 2);
  bathLight.position.set(3.0, 2.3, 3.5);
  scene.add(bathLight);
  const bathBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8e0ea, emissive: 0xc8d8ea, emissiveIntensity: 2.0 }));
  bathBulb.position.set(3.0, 2.45, 3.5);
  scene.add(bathBulb);
  // коврик
  const bmat2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), mat(0x4a5a62, 1));
  bmat2.rotation.x = -Math.PI / 2;
  bmat2.position.set(2.75, 0.014, 3.15);
  scene.add(bmat2);

  // ---------- ключевые точки ----------
  const door = {
    pivot: doorPivot,
    pos: new THREE.Vector3(0, 0, ROOM.minZ),
    openAngle: 0,
    targetAngle: 0,
    setOpen(v) { this.targetAngle = v ? -1.85 : 0; }
  };

  const peepholePos = new THREE.Vector3(0, 1.52, ROOM.minZ + 0.07);
  // точка камеры внутри стекла глазка: чуть снаружи полотна двери
  const peepholeViewPos = new THREE.Vector3(0, 1.52, ROOM.minZ - 0.12);
  const visitorAnchor = new THREE.Vector3(0.15, 0, -3.25);

  // ---------- обновление ----------
  let t = 0;
  function update(dt) {
    t += dt;
    tvScreen.material.emissiveIntensity = 0;
    lampLight.intensity = 29 + Math.sin(t * 3.7) * 1.2;
    lampShade.material.emissiveIntensity = 0.72 + Math.sin(t * 3.7) * 0.04;
    const cl = Math.sin(t * 2.1) + Math.sin(t * 13.7) * 0.4 + Math.sin(t * 0.31);
    const corrOn = cl > -0.15 ? 1 : 0.25;
    corrLight.intensity = 9.0 * corrOn * (0.9 + Math.sin(t * 47.0) * 0.06);
    if (corridorGroup.visible) { // пыль в подъезде анимируется только в глазке
      dust.rotation.y = t * 0.02;
      dust.material.opacity = 0.25 + Math.sin(t * 1.3) * 0.1;
      lampGlass.material.emissiveIntensity = 1.5 * corrOn;
    }
    // прихожая: редкое подрагивание
    hallLight.intensity = 6.6 + Math.sin(t * 9.1) * 0.3 + (Math.sin(t * 0.63) > 0.985 ? -2.5 : 0);
    hallBulb.material.emissiveIntensity = 2.5 + Math.sin(t * 9.1) * 0.1;
    // радио-шкала дышит
    rscale.material.emissiveIntensity = 0.8 + Math.sin(t * 2.3) * 0.15;
    door.openAngle += (door.targetAngle - door.openAngle) * Math.min(1, dt * 3.2);
    doorPivot.rotation.y = door.openAngle;
  }

  return {
    scene, colliders, room: ROOM, flat: FLAT,
    door, peepholePos, peepholeViewPos, visitorAnchor, corridorMid: new THREE.Vector3(0, 0, -3.5),
    corridor: corridorGroup,
    radioPos: { x: 0.2, z: 5.95 },
    bedPos: { x: -0.6, z: 4.8 },
    mirrorPos: { x: 2.75, z: 3.1 },
    notePos: { x: 1.85, z: 3.1 },
    update
  };
}
