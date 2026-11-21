// home.js — квартира Хомки: базовая world.js + кухня, ружьё, дверь в подвал, фото, полки.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { mat, matTex, box, plane, tex, pbrMat } from './mats.js';
import { decal, organicFloorMaterial } from './details.js';
import { batchStaticMeshes } from './static_batch.js';

export function createHome() {
  const w = createWorld();
  const scene = w.scene;
  const colliders = w.colliders;
  const wood = pbrMat('Wood051', 1, 1, { color: 0x9a8972, normalScale: 0.48, roughness: 0.9 });
  const darkWood = pbrMat('Wood051', 1, 1, { color: 0x655747, normalScale: 0.58, roughness: 0.96 });
  const metal = pbrMat('Metal032', 1, 1, { color: 0x92989d, normalScale: 0.34, roughness: 0.62 });
  const blackMetal = pbrMat('Metal032', 1, 1, { color: 0x383b3e, normalScale: 0.4, roughness: 0.76 });

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
  kettle.name = 'home-kettle';
  kettle.userData.dynamic = true;
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
  bd.name = 'home-basement-door';
  bd.userData.dynamic = true;
  // Фурнитура — на лицевой стороне (игрок подходит из комнаты, z < bz).
  const bHandle = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), metal);
  bHandle.position.set(bx + 0.28, 1.0, bz - 0.07);
  scene.add(bHandle);
  box(scene, 0.22, 0.03, 0.02, metal, bx + 0.28, 1.0, bz - 0.052, { cast: false });
  box(scene, 0.1, 0.16, 0.02, blackMetal, bx + 0.28, 0.48, bz - 0.052, { cast: false });
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8), mat(0x1a1a18, 0.4, { metalness: 0.5 }));
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(bx + 0.28, 1.06, bz - 0.06);
  scene.add(keyhole);

  // Тёплая лампа над дверью: единственный жёлтый свет в этой части коридора,
  // поэтому вход видно сразу.
  const cellarLamp = new THREE.PointLight(0xffc783, 5.5, 5.2, 2);
  cellarLamp.position.set(bx + 0.05, 2.12, bz - 0.5);
  scene.add(cellarLamp);
  const cellarBulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff3d4, emissive: 0xffb95e, emissiveIntensity: 2.6, roughness: 0.4 }));
  cellarBulb.position.set(bx + 0.05, 2.2, bz - 0.5);
  scene.add(cellarBulb);
  const cellarCord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.34, 6), mat(0x241f1a, 0.9));
  cellarCord.position.set(bx + 0.05, 2.42, bz - 0.5);
  scene.add(cellarCord);
  const cellarShade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a332a, roughness: 0.7, metalness: 0.25, side: THREE.DoubleSide }));
  cellarShade.position.set(bx + 0.05, 2.27, bz - 0.5);
  scene.add(cellarShade);

  // Табличка на стене над дверью — читается издалека.
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512; signCanvas.height = 200;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#d9cca6'; sctx.fillRect(0, 0, 512, 200);
  sctx.strokeStyle = '#3a3126'; sctx.lineWidth = 14; sctx.strokeRect(7, 7, 498, 186);
  sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillStyle = '#2b2318'; sctx.font = 'bold 78px sans-serif';
  sctx.fillText('ПОДВАЛ', 256, 66);
  sctx.fillStyle = '#8a3a2a'; sctx.font = 'bold 58px sans-serif';
  sctx.fillText('↓ ВНИЗ', 256, 142);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = plane(scene, 0.62, 0.24, new THREE.MeshStandardMaterial({
    map: signTex, roughness: 0.62, emissive: 0x2a1f10, emissiveIntensity: 0.55
  }), bx, 2.3, bz - 0.045, Math.PI);
  sign.renderOrder = 1;

  // Стрелка на полу ведёт от кухни к двери.
  const arrowCanvas = document.createElement('canvas');
  arrowCanvas.width = 128; arrowCanvas.height = 256;
  const actx = arrowCanvas.getContext('2d');
  actx.clearRect(0, 0, 128, 256);
  actx.fillStyle = 'rgba(236, 222, 178, 0.62)';
  actx.textAlign = 'center'; actx.textBaseline = 'middle';
  actx.font = 'bold 34px sans-serif';
  actx.fillText('ВНИЗ', 64, 42);
  actx.lineWidth = 17;
  actx.strokeStyle = 'rgba(236, 222, 178, 0.62)';
  actx.beginPath(); actx.moveTo(64, 86); actx.lineTo(64, 186); actx.stroke();
  actx.beginPath(); actx.moveTo(30, 156); actx.lineTo(64, 206); actx.lineTo(98, 156);
  actx.lineWidth = 17; actx.lineJoin = 'round'; actx.lineCap = 'round'; actx.stroke();
  const arrowTex = new THREE.CanvasTexture(arrowCanvas);
  arrowTex.colorSpace = THREE.SRGBColorSpace;
  const floorArrow = plane(scene, 0.5, 1.0, new THREE.MeshBasicMaterial({
    map: arrowTex, transparent: true, opacity: 0.6, depthWrite: false
  }), bx, 0.016, 1.98, 0, -Math.PI / 2);
  floorArrow.renderOrder = 1;
  floorArrow.userData.noHighlight = true;

  // Ключ на гвозде сбоку от двери.
  const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.007, 6, 12), metal);
  keyRing.position.set(bx - 0.56, 1.6, bz - 0.05);
  scene.add(keyRing);
  const keyStem = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.012), metal);
  keyStem.position.set(bx - 0.56, 1.53, bz - 0.05);
  scene.add(keyStem);
  box(scene, 0.02, 0.02, 0.04, blackMetal, bx - 0.56, 1.66, bz - 0.05, { cast: false });

  // ---------- фотографии в спальне (над столом с радио) ----------
  const photos = [
    { x: -0.55, y: 1.75, w: 0.42, h: 0.52, t: 'assets/tex/photo_family.jpg' },
    { x: 1.35, y: 1.75, w: 0.52, h: 0.42, t: 'assets/tex/photo_town.jpg' }
  ];
  for (const p of photos) {
    box(scene, p.w + 0.06, p.h + 0.06, 0.03, darkWood, p.x, p.y, 6.56, { cast: false });
    plane(scene, p.w, p.h,
      new THREE.MeshStandardMaterial({ map: tex(p.t), roughness: 0.6, color: 0xffffff }),
      p.x, p.y, 6.532, Math.PI); // 13 мм перед рамкой — без z-fighting
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

  // Следы сырости — тонкие декали перед реальной стеной, не coplanar-постеры.
  decal(scene, 'assets/tex/generated/mold.png', 0.72, 1.18,
    1.28, 0.69, -2.482, 0, 0, 0.68, 0x78806a);
  decal(scene, 'assets/tex/generated/rust_drips.png', 0.46, 0.92,
    -2.182, 1.02, -0.92, Math.PI / 2, 0, 0.58, 0x8c715e);
  decal(w.door.pivot, 'assets/tex/generated/scratches.png', 0.74, 1.46,
    0.5, 1.02, 0.057, 0, 0, 0.72, 0xb8aa91);
  // Грязный входной коврик — самостоятельная ткань на полу, выше него на 13 мм.
  plane(scene, 1.18, 0.72, organicFloorMaterial(1.4, 1, 0x3d4138),
    0, 0.014, -1.62, 0, -Math.PI / 2);

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
  w.targets.basementDoor = bd;
  w.targets.stove = kettle;
  w.targets.rifle = rifle;

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
