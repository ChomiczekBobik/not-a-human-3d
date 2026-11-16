// home.js — квартира Хомки: базовая world.js + кухня, ружьё, дверь в подвал, фото, полки.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { mat, matTex, box, plane, tex } from './mats.js';
import { batchStaticMeshes } from './static_batch.js';

export function createHome() {
  const w = createWorld();
  const scene = w.scene;
  const colliders = w.colliders;
  const wood = matTex('assets/tex/wood_dark.jpg', 1, 1, 0xb0a08c, 0.8);
  const darkWood = matTex('assets/tex/wood_dark.jpg', 1, 1, 0x7a6a58, 0.85);
  const metal = mat(0x8a8f96, 0.4, { metalness: 0.6 });
  const blackMetal = mat(0x1c1e22, 0.5, { metalness: 0.5 });

  // ---------- кухонный угол (левая стена) ----------
  box(scene, 0.58, 0.9, 1.7, wood, -1.9, 0.45, 0.95);
  box(scene, 0.62, 0.05, 1.76, mat(0x9a938a, 0.6), -1.9, 0.925, 0.95);
  colliders.push({ minX: -2.2, maxX: -1.55, minZ: 0.05, maxZ: 1.85 });
  // плита
  box(scene, 0.5, 0.02, 0.5, blackMetal, -1.9, 0.96, 0.5);
  for (const dz of [-0.12, 0.12]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), mat(0x111114, 0.35));
    b.position.set(-1.9, 0.975, 0.5 + dz);
    scene.add(b);
  }
  // чайник
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), mat(0x9aa2aa, 0.3, { metalness: 0.75 }));
  kettle.scale.y = 0.85;
  kettle.position.set(-1.88, 1.045, 0.5);
  scene.add(kettle);
  box(scene, 0.02, 0.05, 0.09, blackMetal, -1.88, 1.13, 0.5, { cast: false });
  // раковина
  box(scene, 0.42, 0.03, 0.4, mat(0x6e747c, 0.3, { metalness: 0.6 }), -1.9, 0.955, 1.42);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), metal);
  tap.position.set(-2.05, 1.05, 1.42);
  scene.add(tap);
  // полка с банками
  box(scene, 0.28, 0.03, 1.5, darkWood, -2.02, 1.62, 0.95);
  for (let i = 0; i < 6; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.13 + (i % 3) * 0.03, 12),
      mat([0x7a6a42, 0x5c6a4a, 0x6a4a3a, 0x808a92, 0x5a5a66, 0x726246][i], 0.35));
    jar.position.set(-2.02, 1.62 + 0.085, 0.35 + i * 0.22);
    jar.castShadow = true;
    scene.add(jar);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.014, 12), mat(0x9a8a6a, 0.5));
    lid.position.set(-2.02, jar.position.y + 0.075, 0.35 + i * 0.22);
    scene.add(lid);
  }
  // свисающие кружки
  for (let i = 0; i < 3; i++) {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 12), mat(0x8a8578, 0.4));
    mug.position.set(-2.02, 1.45, 0.6 + i * 0.35);
    scene.add(mug);
  }

  // ---------- ружьё на стене у двери ----------
  const rifle = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 10), blackMetal);
  barrel.position.set(0, 0.42, 0);
  rifle.add(barrel);
  const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), blackMetal);
  barrel2.position.set(0, 0.4, 0.03);
  rifle.add(barrel2);
  box(rifle, 0.045, 0.5, 0.05, wood, 0, 0.02, 0);
  box(rifle, 0.04, 0.22, 0.075, darkWood, 0, -0.3, 0.02, { rz: 0.12 });
  const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), metal);
  bolt.position.set(0.03, 0.14, 0.03);
  rifle.add(bolt);
  rifle.position.set(-1.35, 1.15, -2.38);
  rifle.rotation.z = -0.06;
  scene.add(rifle);
  // крюки
  box(scene, 0.03, 0.05, 0.06, metal, -1.35, 1.55, -2.4, { cast: false });
  box(scene, 0.03, 0.05, 0.06, metal, -1.35, 1.0, -2.4, { cast: false });

  // ---------- дверь в подвал (задняя стена слева) ----------
  const bx = -1.75, bz = 2.52;
  box(scene, 0.9, 2.0, 0.08, mat(0x2e2a26, 0.7), bx, 1.0, bz);
  const bd = box(scene, 0.8, 1.94, 0.06, matTex('assets/tex/shelf_metal.jpg', 1, 2, 0x5c6066, 0.7), bx, 0.99, bz + 0.03);
  const bHandle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), metal);
  bHandle.position.set(bx + 0.28, 1.0, bz + 0.08);
  scene.add(bHandle);
  // ступеньки на стене? нет — табличка и крюк с ключом
  box(scene, 0.3, 0.12, 0.015, mat(0x3a3c40, 0.8), bx, 1.95, bz + 0.06, { cast: false });

  // ---------- фотографии в спальне (над столом с радио) ----------
  const photos = [
    { x: -0.55, y: 1.75, w: 0.42, h: 0.52, t: 'assets/tex/photo_family.jpg' },
    { x: 1.35, y: 1.75, w: 0.52, h: 0.42, t: 'assets/tex/photo_town.jpg' }
  ];
  for (const p of photos) {
    box(scene, p.w + 0.06, p.h + 0.06, 0.03, darkWood, p.x, p.y, 6.56, { cast: false });
    plane(scene, p.w, p.h,
      new THREE.MeshStandardMaterial({ map: tex(p.t), roughness: 0.6, color: 0xffffff }),
      p.x, p.y, 6.54, Math.PI);
  }
  // фартук из плитки за кухонным углом
  plane(scene, 1.8, 0.75,
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/tiles_kitchen.jpg', 1.4, 0.6), roughness: 0.5, color: 0xd8d4c8 }),
    -2.185, 1.25, 0.95, Math.PI / 2);
  // постер «СЛУШАЙТЕ РАДИО» в спальне
  plane(scene, 0.62, 0.4,
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/poster_radio.png'), roughness: 0.9 }),
    -2.185, 1.6, 4.9, Math.PI / 2);

  // ---------- полка с запасами (правая стена, у двери) ----------
  box(scene, 0.3, 0.04, 1.1, darkWood, 2.0, 1.1, -1.6);
  box(scene, 0.3, 0.04, 1.1, darkWood, 2.0, 1.5, -1.6);
  const canColors = [0x8a4a3a, 0x4a6a8a, 0x6a7a4a, 0xa08a4a, 0x7a5a7a, 0x4a7a6a, 0x9a6a4a, 0x6a6a7a];
  for (let i = 0; i < 4; i++) {
    for (const y of [1.1, 1.5]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), mat(canColors[(i * 2 + (y > 1.3 ? 1 : 0)) % 8], 0.5, { metalness: 0.25 }));
      can.position.set(2.0, y + 0.08, -2.0 + i * 0.26);
      can.castShadow = true;
      scene.add(can);
    }
  }

  // ---------- свеча на столе (эмиссия + блум) ----------
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.12, 10), mat(0xd8cfb8, 0.6));
  candle.position.set(-1.28, 0.51, -0.38);
  scene.add(candle);
  // пламя анимируется масштабом каждый кадр — не отдаём его в статик-батч
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc060, emissive: 0xffa030, emissiveIntensity: 4.0 }));
  flame.position.set(-1.28, 0.59, -0.38);
  flame.userData.dynamic = true;
  scene.add(flame);

  // постер «не выходите без надобности» в коридоре
  plane(scene, 0.42, 0.26,
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/poster_nuke.png'), roughness: 0.9 }),
    1.6, 1.5, -4.55, 0);

  // обновление: свеча мерцает
  const baseUpdate = w.update;
  let t = 0;
  function update(dt) {
    t += dt;
    baseUpdate(dt);
    flame.scale.setScalar(0.9 + Math.sin(t * 9.3) * 0.12 + Math.sin(t * 17.1) * 0.06);
  }

  // ---------- батчинг статики: сотни боксов -> инстансы ----------
  // rifle не батчим: его клонируют в катсцене выстрела; flame — анимация масштаба.
  batchStaticMeshes(scene, [rifle, flame, w.door && w.door.pivot]);

  return {
    world: w,
    scene,
    colliders,
    room: w.room,
    flat: w.flat,
    rifle,
    anchors: {
      exitDoor: { x: 0, z: -2.1 },
      basementDoor: { x: bx, z: 2.05 },
      rifle: { x: -1.35, z: -2.0 },
      peephole: w.peepholePos,
      peepholeView: w.peepholeViewPos,
      visitor: w.visitorAnchor,
      stove: { x: -1.55, z: 0.55 },
      bed: w.bedPos,
      radio: w.radioPos,
      mirror: w.mirrorPos,
      note: w.notePos
    },
    update
  };
}
