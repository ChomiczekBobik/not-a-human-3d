// store.js — «Бедронка»: полки, холодильники, касса, Людмила. Масло по скидке.
import * as THREE from 'three';
import { mat, matTex, box, plane, tex } from './mats.js';
import { createHumanoid } from './rig.js';
import { pose, resetPose } from './anim.js';
import { loadModel, groundAndScale, enableShadows } from './models.js';
import { batchStaticMeshes } from './static_batch.js';

export function createStore() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101216);
  scene.fog = new THREE.FogExp2(0x14161c, 0.02);

  const bounds = { minX: -6.4, maxX: 6.4, minZ: -5.2, maxZ: 5.6 };
  const colliders = [];

  const floorMat = matTex('assets/tex/store_floor.jpg', 6, 5, 0xb8b6ae, 0.68, { bump: 0.012 });
  const wallMat = matTex('assets/tex/wall_store.jpg', 3, 1.2, 0xd8d4c8, 0.95, { bump: 0.008 });
  // Потолок магазина: в кадр попадает только нижняя грань, бетонная текстура там
  // не читается на высоте 3+ м — плоский цвет, без карты и без bump-выборки.
  const ceilMat = mat(0x9a9a94, 0.96);
  const shelfMat = matTex('assets/tex/shelf_metal.jpg', 1, 1, 0xb0b4b8, 0.6, { metalness: 0.3, bump: 0.008 });

  // ---------- оболочка ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(13, 11), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.2);
  floor.receiveShadow = true;
  scene.add(floor);
  plane(scene, 13, 11, ceilMat, 0, 3.15, 0.2, 0, Math.PI / 2); // потолок — одна грань вниз
  // стены
  box(scene, 0.2, 3.2, 11, wallMat, -6.5, 1.6, 0.2);
  box(scene, 0.2, 3.2, 11, wallMat, 6.5, 1.6, 0.2);
  box(scene, 13, 3.2, 0.2, wallMat, 0, 1.6, -5.4);
  // передняя стена с входом (две части)
  box(scene, 5.4, 3.2, 0.2, wallMat, -3.8, 1.6, 5.7);
  box(scene, 5.4, 3.2, 0.2, wallMat, 3.8, 1.6, 5.7);
  box(scene, 2.6, 1.0, 0.2, wallMat, 0, 2.7, 5.7);
  // входная дверь и тамбур
  box(scene, 1.4, 2.3, 0.12, mat(0x22262c, 0.4, { metalness: 0.3 }), 0, 1.15, 5.65);
  const doorGlass = new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0x8fb0d8, emissiveIntensity: 0.7, roughness: 0.1 });
  plane(scene, 0.6, 1.2, doorGlass, -0.25, 1.5, 5.58, Math.PI);
  plane(scene, 0.6, 1.2, doorGlass, 0.25, 1.5, 5.58, Math.PI);

  // ---------- полки ----------
  // Три островных ряда. Длина 4.5 м: сзади остаётся 2.4 м до стены и 1.1 м
  // до холодильников, спереди — 4.1 м свободного кассового холла. Ряды больше
  // не «протыкают» вход и не зажимают покупателя у прилавка.
  const shelfRows = [-4.7, -1.9, 0.9];
  const SHELF_Z = -0.75;
  const SHELF_LEN = 4.5;
  const canGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8);
  const productMats = [
    mat(0xc85040, 0.6), mat(0xd8b040, 0.6), mat(0x5a8a4a, 0.6),
    mat(0x4a6a9a, 0.6), mat(0xd8d0c0, 0.7), mat(0x8a5a3a, 0.7),
    mat(0xb85a78, 0.6), mat(0x6a7a5a, 0.7)
  ];
  for (const sx of shelfRows) {
    box(scene, 0.9, 1.75, SHELF_LEN, shelfMat, sx, 0.875, SHELF_Z);
    // тёмный цоколь визуально «ставит» стеллаж на пол и прячет стык
    box(scene, 0.94, 0.12, SHELF_LEN, mat(0x3a3d42, 0.72), sx, 0.06, SHELF_Z, { cast: false });
    // полки
    for (const y of [0.45, 0.85, 1.25, 1.65]) {
      box(scene, 0.96, 0.04, SHELF_LEN + 0.04, shelfMat, sx, y, SHELF_Z, { cast: false });
    }
    // товары на обеих сторонах; 12 позиций по длине, чтобы не вылезать за торец
    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        const z = -2.82 + i * 0.36;
        const y = [0.45, 0.85, 1.25, 1.65][i % 4];
        if (Math.random() < 0.12) continue; // пустые места — полки неполные
        if (Math.random() < 0.5) {
          box(scene, 0.16, 0.22, 0.14, productMats[Math.floor(Math.random() * 8)], sx + side * 0.32, y + 0.13, z);
        } else {
          const can = new THREE.Mesh(canGeo, productMats[Math.floor(Math.random() * 8)]);
          can.position.set(sx + side * 0.3, y + 0.09, z + 0.1);
          can.castShadow = true;
          scene.add(can);
        }
      }
    }
    colliders.push({ minX: sx - 0.5, maxX: sx + 0.5, minZ: -3.05, maxZ: 1.55 });
  }

  // ---------- холодильники вдоль задней стены ----------
  const fridgeMat = matTex('assets/tex/shelf_metal.jpg', 1, 1, 0xd8dce2, 0.35, { metalness: 0.4, bump: 0.006 });
  const fridgeGlow = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, emissive: 0x7ea8c8, emissiveIntensity: 1.1, roughness: 0.15, transparent: true, opacity: 0.85 });
  for (const fx of [-5.4, -4.4, -3.4]) {
    box(scene, 0.95, 2.2, 1.1, fridgeMat, fx, 1.1, -4.75);
    plane(scene, 0.8, 1.9, fridgeGlow, fx, 1.15, -4.18, 0);
    // полки внутри и бутылки
    for (let i = 0; i < 4; i++) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 10), mat(0xd8e4f0, 0.2, { transparent: true, opacity: 0.75 }));
      bottle.position.set(fx - 0.25 + (i % 2) * 0.5, 0.5 + Math.floor(i / 2) * 0.6, -4.6);
      scene.add(bottle);
    }
  }
  colliders.push({ minX: -6.0, maxX: -2.9, minZ: -5.2, maxZ: -4.1 });

  // ---------- хлебная витрина (сдвинута вплотную к правой стене) ----------
  // У стены 0.2 м, между витриной и стеллажами справа — свободный прямой проход.
  const breadMat = matTex('assets/tex/wood_dark.jpg', 1, 1, 0xa08a6a, 0.8, { bump: 0.015 });
  box(scene, 0.75, 0.85, 1.6, breadMat, 6.02, 0.42, 3.45);
  for (let i = 0; i < 5; i++) {
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.12, 4, 8), mat(0xc09a60, 0.85));
    loaf.rotation.z = Math.PI / 2;
    loaf.position.set(6.02 + (i % 2) * 0.22 - 0.11, 0.92, 2.85 + i * 0.3);
    loaf.castShadow = true;
    scene.add(loaf);
  }
  colliders.push({ minX: 5.6, maxX: 6.45, minZ: 2.6, maxZ: 4.3 });

  // ---------- прилавок и касса ----------
  // прилавок Г-образный
  box(scene, 2.9, 1.0, 0.75, matTex('assets/tex/wood_dark.jpg', 2, 1, 0x9a8468, 0.7, { bump: 0.015 }), 4.55, 0.5, 1.5);
  box(scene, 0.01, 0.02, 0.76, mat(0x2a2c30, 0.5), 4.55, 1.01, 1.5, { cast: false });
  colliders.push({ minX: 3.1, maxX: 6.0, minZ: 1.1, maxZ: 1.9 });
  // кассовый аппарат
  box(scene, 0.42, 0.2, 0.34, mat(0x2a2e34, 0.4), 4.9, 1.11, 1.55);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0a2a12, emissive: 0x40ff70, emissiveIntensity: 0.8, roughness: 0.3 }));
  screen.position.set(4.9, 1.24, 1.38);
  screen.rotation.x = -0.5;
  scene.add(screen);
  // лента и корзинки
  box(scene, 1.1, 0.06, 0.5, mat(0x1a1a1c, 0.6), 3.9, 1.03, 1.45);
  for (let i = 0; i < 3; i++) {
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.18, 12, 1, true), mat(0xc84a3a, 0.7));
    basket.position.set(1.85 + (i % 2) * 0.3, 0.18 + Math.floor(i / 2) * 0.2, 5.15);
    scene.add(basket);
  }
  // витрина со сгущёнкой у кассы
  box(scene, 0.7, 1.1, 0.5, mat(0xb8b4aa, 0.6), 6.0, 0.55, 0.4);
  for (let i = 0; i < 6; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), mat(0xd8d0b8, 0.5));
    jar.position.set(6.0, 1.18, 0.2 + (i % 3) * 0.16);
    scene.add(jar);
  }
  colliders.push({ minX: 5.6, maxX: 6.4, minZ: 0.1, maxZ: 0.7 });

  // ---------- Людмила ----------
  // процедурный риг — плейсхолдер и фолбэк, если GLB не загрузился
  const lyudmila = createHumanoid({
    height: 1.62, girth: 1.22, skin: 0xc09a76, headScale: 1.02,
    cloth: 0x6a2a34, cloth2: 0x3a2028, coatColor: 0x6a2a34,
    hat: false, bald: false, mouth: 'none', eyeColor: 0x1a1410,
    fingers: 4, shadow: true
  });
  lyudmila.root.position.set(4.55, 0, 0.75);
  lyudmila.root.rotation.y = 0;
  scene.add(lyudmila.root);
  // лёгкая GLB-модель (1024 tri) — настоящая Людмила-продавщица за кассой
  const LYUD_YAW = 0;
  const lyudmilaRef = { rig: lyudmila, model: null };
  loadModel('assets/models/tripo_light.glb').then((gltf) => {
    const model = groundAndScale(gltf.scene, 1.62);
    enableShadows(model);
    model.position.set(4.55, model.position.y, 0.75); // y — от groundAndScale, ноги на полу
    model.rotation.y = LYUD_YAW;
    scene.add(model);
    scene.remove(lyudmila.root);
    lyudmilaRef.model = model;
    lyudmilaRef.baseY = model.position.y;
  }).catch((e) => console.warn('GLB Людмилы не загрузился, остаётся процедурная:', e));

  // ---------- постеры и ценники ----------
  const posterMat = (p) => new THREE.MeshStandardMaterial({
    map: tex(p), roughness: 0.85
  });
  plane(scene, 1.7, 1.06, posterMat('assets/tex/poster_butter.png'), -4.6, 2.45, -5.25, 0);
  plane(scene, 1.5, 0.94, posterMat('assets/tex/poster_bread.png'), 5.6, 2.2, 3.45, -Math.PI / 2);
  plane(scene, 0.9, 0.34, posterMat('assets/tex/sign_open.png'), -0.9, 2.15, 5.58, Math.PI);
  // ценники на полках и витринах — все совпадают с новыми позициями товаров
  const tag = (p, x, y, z, ry = 0) => {
    const t = plane(scene, 0.3, 0.19, posterMat(p), x, y, z, ry);
    t.castShadow = false;
    return t;
  };
  tag('assets/tex/tag_butter.png', -4.2, 1.1, -2.6, Math.PI / 2);
  tag('assets/tex/tag_tushonka.png', -2.45, 1.1, -1.0, -Math.PI / 2);
  tag('assets/tex/tag_sguschenka.png', 0.35, 1.1, -2.0, -Math.PI / 2);
  tag('assets/tex/tag_bread.png', 5.6, 1.15, 3.45, -Math.PI / 2);
  tag('assets/tex/tag_krupa.png', -1.35, 1.35, 0.75, Math.PI / 2);
  tag('assets/tex/tag_tea.png', 1.35, 1.35, -2.7, Math.PI / 2);
  tag('assets/tex/tag_socks.png', -4.2, 0.95, -0.9, Math.PI / 2);
  tag('assets/tex/tag_geiger.png', 3.45, 1.35, 1.9, Math.PI);
  tag('assets/tex/tag_matches.png', 5.45, 1.2, 1.9, Math.PI);
  tag('assets/tex/tag_meds.png', 5.4, 1.18, 2.3, -Math.PI / 2);

  // Акцентные упаковки ровно под ценниками: подсветка [E] теперь обводит
  // реальный товар, а не пустую точку в проходе.
  box(scene, 0.17, 0.13, 0.3, mat(0xf0d25a, 0.55), -4.21, 0.99, -2.6);
  const tush = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 12), mat(0x9a4a34, 0.55));
  tush.position.set(-2.38, 1.04, -1.0);
  scene.add(tush);
  const sgush = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12), mat(0xd8c8a0, 0.45));
  sgush.position.set(0.38, 1.05, -2.0);
  scene.add(sgush);
  box(scene, 0.2, 0.28, 0.18, mat(0x6a7a5a, 0.8), -4.2, 1.0, -0.9);
  box(scene, 0.18, 0.24, 0.14, mat(0xd8b040, 0.7), 1.2, 1.13, -2.7);
  // афиши «жёлтые ценники» и «сдавайте металлолом»
  plane(scene, 1.5, 0.94, posterMat('assets/tex/poster_yellow.png'), -6.38, 2.1, 0.4, Math.PI / 2);
  plane(scene, 1.2, 0.75, posterMat('assets/tex/poster_basement.png'), 6.38, 1.9, -2.2, -Math.PI / 2);
  // ---------- стойка с лекарствами (угловой «аптечный» эндкап у кассы) ----------
  // Стоит у правой стены между прилавком и хлебной витриной: главный проход
  // от входа к кассе не пересекает.
  box(scene, 0.6, 1.3, 0.65, mat(0x8a8f96, 0.5, { metalness: 0.3 }), 5.75, 0.65, 2.3);
  for (let i = 0; i < 4; i++) {
    box(scene, 0.16, 0.22, 0.1, mat(0xd8dce4, 0.6), 5.6 + (i % 2) * 0.3, 1.36, 2.15 + Math.floor(i / 2) * 0.2);
  }
  // белый ценник-крест читается как аптека даже без иконок
  plane(scene, 0.34, 0.16, mat(0xdfe6ec, 0.4), 5.46, 1.18, 2.3, -Math.PI / 2);
  colliders.push({ minX: 5.4, maxX: 6.1, minZ: 1.95, maxZ: 2.65 });

  // ---------- морозильный ларь (слева у входа) ----------
  box(scene, 1.3, 0.9, 2.2, matTex('assets/tex/shelf_metal.jpg', 1, 2, 0xe0e2e6, 0.35, { metalness: 0.35, bump: 0.006 }), -5.75, 0.45, 2.3);
  const frostTop = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x9ab4c8, emissive: 0x6a90b0, emissiveIntensity: 0.5, roughness: 0.15, transparent: true, opacity: 0.75 }));
  frostTop.rotation.x = -Math.PI / 2;
  frostTop.position.set(-5.75, 0.91, 2.3);
  scene.add(frostTop);
  // иней по краю
  const frostRim = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.0),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/frost.png'), transparent: true, roughness: 0.7, depthWrite: false, opacity: 0.9 }));
  frostRim.rotation.x = -Math.PI / 2;
  frostRim.position.set(-5.75, 0.915, 2.3);
  scene.add(frostRim);
  // пакеты внутри
  for (let i = 0; i < 5; i++) {
    box(scene, 0.3, 0.1, 0.24, mat([0xd8c060, 0xc85a4a, 0xd8d0c0][i % 3], 0.55), -5.95 + (i % 2) * 0.34, 0.86, 1.6 + Math.floor(i / 2) * 0.5);
  }
  colliders.push({ minX: -6.45, maxX: -5.05, minZ: 1.1, maxZ: 3.5 });

  // ---------- колбасный прилавок (правая стена, ближе к входу) ----------
  // Ориентирован вдоль стены: не перекрывает вход и не подставляет торец в проход.
  box(scene, 0.85, 0.95, 1.55, matTex('assets/tex/shelf_metal.jpg', 1, 2, 0xb8bcc0, 0.4, { metalness: 0.3, bump: 0.006 }), 5.9, 0.47, 4.8);
  box(scene, 0.9, 0.05, 1.6, mat(0xd8dce0, 0.25, { metalness: 0.5 }), 5.9, 0.97, 4.8, { cast: false });
  // кольца колбасы
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.055, 8, 16), mat(0x8a4030, 0.7));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(5.95, 1.02, 4.25 + i * 0.55);
    ring.castShadow = true;
    scene.add(ring);
  }
  // весы
  box(scene, 0.3, 0.14, 0.34, mat(0xe8e8e4, 0.4), 5.9, 1.06, 5.28);
  const wscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x0a2a12, emissive: 0x40ff70, emissiveIntensity: 0.5 }));
  wscreen.position.set(5.7, 1.12, 5.28);
  wscreen.rotation.x = -0.4;
  wscreen.rotation.y = -Math.PI / 2;
  scene.add(wscreen);
  colliders.push({ minX: 5.4, maxX: 6.4, minZ: 4.0, maxZ: 5.6 });

  // ---------- указатели рядов под потолком ----------
  const aisleMat = (p) => new THREE.MeshStandardMaterial({ map: tex(p), roughness: 0.8, side: THREE.DoubleSide });
  for (const [ax, texName] of [[-4.7, 'assets/tex/aisle_1.png'], [-1.9, 'assets/tex/aisle_2.png'], [0.9, 'assets/tex/aisle_3.png']]) {
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.45), aisleMat(texName));
    sgn.position.set(ax, 2.55, -1.0);
    scene.add(sgn);
    box(scene, 0.03, 0.35, 0.03, mat(0x8a8f96, 0.5), ax, 2.85, -1.0, { cast: false });
  }
  // таблички над кассой и выходом
  const kassaSign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.36), aisleMat('assets/tex/sign_kassa.png'));
  kassaSign.position.set(4.7, 2.6, 2.2);
  kassaSign.rotation.y = Math.PI;
  scene.add(kassaSign);
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/sign_exit.png'), emissive: 0x2a6a3a, emissiveIntensity: 0.7, roughness: 0.6 }));
  exitSign.position.set(0, 2.5, 5.55);
  exitSign.rotation.y = Math.PI;
  scene.add(exitSign);

  // ---------- газетная стойка ----------
  box(scene, 0.7, 1.1, 0.4, mat(0x6a6e74, 0.5, { metalness: 0.4 }), -1.9, 0.55, 4.7);
  for (let i = 0; i < 3; i++) {
    const np = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44),
      new THREE.MeshStandardMaterial({ map: tex('assets/tex/newspaper.jpg'), roughness: 0.95 }));
    np.position.set(-2.08 + i * 0.18, 0.86, 4.66);
    np.rotation.x = -0.35;
    scene.add(np);
  }
  colliders.push({ minX: -2.3, maxX: -1.55, minZ: 4.45, maxZ: 4.95 });

  // ---------- коробки с нормальными этикетками ----------
  const boxed = [
    ['assets/tex/box_tea.jpg', 1.22, 1.3, -2.7],
    ['assets/tex/box_krupa.jpg', -1.22, 1.3, 0.65],
    ['assets/tex/box_cookies.jpg', -4.22, 0.9, -0.9],
    ['assets/tex/box_soap.jpg', 0.58, 0.5, -2.9],
    ['assets/tex/box_candles.jpg', 1.22, 1.7, -1.5],
    ['assets/tex/box_matches.jpg', 5.45, 1.08, 1.5]
  ];
  for (const [p, x, y, z] of boxed) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.16),
      new THREE.MeshStandardMaterial({ map: tex(p), roughness: 0.75 }));
    b.position.set(x, y, z);
    b.castShadow = true;
    scene.add(b);
  }

  // ---------- фото Марека у кассы ----------
  box(scene, 0.16, 0.2, 0.02, mat(0x3a2a1e, 0.6), 4.0, 1.09, 1.25);
  plane(scene, 0.12, 0.16, new THREE.MeshStandardMaterial({ map: tex('assets/tex/photo_marek.jpg'), roughness: 0.6 }),
    4.0, 1.09, 1.235, Math.PI);

  // ---------- дозиметр в витрине на прилавке ----------
  box(scene, 0.42, 0.06, 0.34, mat(0x2a2e33, 0.5, { metalness: 0.4 }), 3.45, 1.04, 1.5);
  box(scene, 0.3, 0.11, 0.2, mat(0x4a4f56, 0.45, { metalness: 0.3 }), 3.45, 1.12, 1.5);
  const geigerScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x0a2a12, emissive: 0x55ff88, emissiveIntensity: 0.9, roughness: 0.3 }));
  geigerScreen.rotation.x = -Math.PI / 2;
  geigerScreen.position.set(3.45, 1.181, 1.5);
  scene.add(geigerScreen);
  // стеклянный колпак витрины
  const geigerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xbfe0ef, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false }));
  geigerGlass.position.set(3.45, 1.25, 1.5);
  scene.add(geigerGlass);

  // ---------- Зося в очереди ----------
  const zosia = createHumanoid({
    height: 1.52, girth: 1.28, skin: 0xb89a7e, headScale: 1.05,
    cloth: 0x5a5a48, cloth2: 0x3a3a2e, coatColor: 0x5e5e4a,
    hat: true, hatColor: 0x6a5a4a, mouth: 'none', eyeColor: 0x1a1612,
    fingers: 4, shadow: true
  });
  // Зося — в короткой очереди сбоку от кассового холла, не посреди прохода
  zosia.root.position.set(2.55, 0, 2.45);
  zosia.root.rotation.y = -2.35;
  scene.add(zosia.root);

  // ---------- батчинг статики: сотни боксов -> инстансы ----------
  const batched = batchStaticMeshes(scene, [lyudmila.root, zosia.root, lyudmilaRef.model]);
  console.log('[store] batched:', batched.batched, 'of', batched.groups, 'groups');

  // ---------- свет ----------
  scene.add(new THREE.HemisphereLight(0xdfe8f4, 0x3a3a38, 1.25));
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf0f6ff, emissiveIntensity: 1.5, roughness: 0.4 });
  const panels = [];
  for (const pz of [-3.4, -0.6, 2.2]) {
    for (const px of [-3.4, 0.4]) {
      const p = box(scene, 2.2, 0.06, 0.5, panelMat, px, 3.12, pz, { cast: false, receive: false });
      panels.push(p);
    }
  }
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

  // ---------- обновление ----------
  let t = 0;
  let poseTick = -1;
  function update(dt) {
    t += dt;
    if (lyudmilaRef.model) {
      // GLB-Людмила: тихое живое покачивание за кассой
      lyudmilaRef.model.rotation.y = LYUD_YAW + Math.sin(t * 0.5) * 0.045;
      lyudmilaRef.model.position.y = (lyudmilaRef.baseY || 0) + Math.sin(t * 1.5) * 0.004;
    } else {
      resetPose(lyudmila);
      pose.idle(lyudmila, t * 0.8);
    }
    // Зося: 20 Гц хватит
    const tick = Math.floor(t * 20);
    if (tick !== poseTick) {
      poseTick = tick;
      resetPose(zosia);
      pose.idle(zosia, t * 0.55 + 2);
      zosia.joints.hips.rotation.y = Math.sin(t * 0.8) * 0.08;
    }
    // одна лампа помаргивает
    const f = Math.sin(t * 7.3) > -0.7 ? 1 : 0.45;
    panels[1].material.emissiveIntensity = 1.5 * f;
    shopLight1.intensity = 16 * (0.96 + Math.sin(t * 40) * 0.04) * f;
    lyudmila.eyeMeshes.forEach(() => {});
  }

  return {
    scene, bounds, colliders, lyudmila, zosia, lyudmilaRef,
    anchors: {
      exit: { x: 0, z: 5.0 },
      checkout: { x: 4.5, z: 2.55, r: 1.35, hl: [4.55, 0.6, 1.5, 3.0, 1.25, 0.85] },
      lyudmila: { x: 4.55, z: 0.75, r: 2.2 },
      zosia: { x: 2.55, z: 2.75, r: 1.15, hl: [2.55, 0.95, 2.45, 0.8, 1.85, 0.7] },
      news: { x: -1.9, z: 4.0, r: 1.3, hl: [-1.9, 0.8, 4.7, 1.0, 1.6, 0.5] },
      butter: { x: -3.95, z: -2.6, r: 1.35, hl: [-4.21, 1.0, -2.6, 0.3, 0.32, 0.42] },
      tushonka: { x: -2.75, z: -1.0, r: 1.25, hl: [-2.38, 1.04, -1.0, 0.24, 0.34, 0.28] },
      sguschenka: { x: 0.0, z: -2.0, r: 1.25, hl: [0.38, 1.05, -2.0, 0.22, 0.34, 0.26] },
      krupa: { x: -1.0, z: 0.75, r: 1.25, hl: [-1.22, 1.3, 0.65, 0.3, 0.38, 0.26] },
      tea: { x: 1.8, z: -2.7, r: 1.25, hl: [1.22, 1.3, -2.7, 0.3, 0.38, 0.26] },
      socks: { x: -3.95, z: -0.9, r: 1.25, hl: [-4.2, 1.0, -0.9, 0.34, 0.44, 0.3] },
      bread: { x: 5.15, z: 3.45, r: 1.3, hl: [6.02, 0.7, 3.45, 0.85, 1.0, 1.7] },
      kolbasa: { x: 5.0, z: 4.8, r: 1.3, hl: [5.9, 0.7, 4.8, 0.95, 1.1, 1.65] },
      meds: { x: 5.0, z: 2.9, r: 1.2, hl: [5.75, 0.82, 2.3, 0.75, 1.5, 0.75] },
      geiger: { x: 3.3, z: 2.35, r: 1.15, hl: [3.45, 1.12, 1.5, 0.5, 0.4, 0.42] },
      matches: { x: 5.25, z: 2.3, r: 1.0, hl: [5.45, 1.1, 1.5, 0.3, 0.34, 0.24] }
    },
    update
  };
}
