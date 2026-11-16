// basement.js — подвал Хомки: котёл, койки, полки. Сюда уходят радиоактивные — полечиться.
import * as THREE from 'three';
import { mat, matTex, box, plane, tex } from './mats.js';
import { batchStaticMeshes } from './static_batch.js';

export function createBasement() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060608);
  scene.fog = new THREE.FogExp2(0x0a0a0c, 0.05);

  const bounds = { minX: -2.9, maxX: 6.5, minZ: -2.1, maxZ: 2.4 };
  const colliders = [];

  const concMat = matTex('assets/tex/concrete.jpg', 2, 1.2, 0x8a8c90, 0.98);
  const floorMat = matTex('assets/tex/concrete.jpg', 2.4, 2.0, 0x787a7e, 0.95);
  const wood = matTex('assets/tex/wood_dark.jpg', 1, 1, 0x8a7a64, 0.9);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  plane(scene, 6.4, 5, mat(0x2a2a2e, 0.95), 0, 2.4, 0.1, 0, Math.PI / 2); // потолок зала — плоскость вниз
  box(scene, 0.2, 2.5, 5, concMat, -3.0, 1.25, 0.1);
  // правая стена зала с проёмом в лазарет (z -0.6..0.4)
  box(scene, 0.2, 2.5, 1.5, concMat, 3.0, 1.25, -1.35);
  box(scene, 0.2, 2.5, 2.0, concMat, 3.0, 1.25, 1.4);
  box(scene, 0.2, 0.6, 1.0, concMat, 3.0, 2.2, -0.1);
  colliders.push({ minX: 2.9, maxX: 3.1, minZ: -2.1, maxZ: -0.6 });
  colliders.push({ minX: 2.9, maxX: 3.1, minZ: 0.4, maxZ: 2.4 });
  box(scene, 6.4, 2.5, 0.2, concMat, 0, 1.25, -2.3);
  // задняя стена с проёмом-лестницей
  box(scene, 2.4, 2.5, 0.2, concMat, -2.0, 1.25, 2.55);
  box(scene, 2.4, 2.5, 0.2, concMat, 2.0, 1.25, 2.55);
  box(scene, 1.6, 0.5, 0.2, concMat, 0, 2.25, 2.55);
  // ступени вверх (декор, игрок туда не ходит)
  for (let i = 0; i < 3; i++) {
    box(scene, 1.5, 0.18, 0.3, wood, 0, 0.09 + i * 0.18, 2.3 - i * 0.28);
  }

  // ---------- котёл ----------
  box(scene, 1.1, 1.4, 0.8, mat(0x3a3230, 0.6, { metalness: 0.5 }), -2.3, 0.7, -1.8);
  colliders.push({ minX: -2.9, maxX: -1.75, minZ: -2.1, maxZ: -1.35 });
  // дверца с углями
  const coals = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x201008, emissive: 0xff5a10, emissiveIntensity: 2.2, roughness: 0.8 }));
  coals.position.set(-2.3, 0.55, -1.38);
  scene.add(coals);
  const boilerLight = new THREE.PointLight(0xff7a20, 9, 8, 2);
  boilerLight.position.set(-2.3, 0.9, -1.3);
  scene.add(boilerLight);
  // труба
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 10), mat(0x2e2a26, 0.5, { metalness: 0.6 }));
  pipe.position.set(-2.3, 2.0, -1.8);
  scene.add(pipe);

  // ---------- койки (правая стена) ----------
  const cotSpots = [];
  const cotMat = mat(0x4a4a52, 0.5, { metalness: 0.4 });
  const mattressMat = mat(0x6a6258, 0.95);
  const blanketColors = [0x5a3a3a, 0x3a4a5a, 0x4a5a3a];
  for (let i = 0; i < 3; i++) {
    const cz = -1.6 + i * 1.7;
    // рама
    box(scene, 0.85, 0.32, 1.7, cotMat, 2.4, 0.22, cz);
    box(scene, 0.85, 0.08, 1.7, mattressMat, 2.4, 0.42, cz);
    // ноги
    for (const [dx, dz] of [[-0.35, -0.78], [0.35, -0.78], [-0.35, 0.78], [0.35, 0.78]]) {
      box(scene, 0.05, 0.24, 0.05, cotMat, 2.4 + dx, 0.12, cz + dz, { cast: false });
    }
    // одеяло
    box(scene, 0.8, 0.06, 1.0, mat(blanketColors[i], 0.95), 2.4, 0.49, cz + 0.3);
    cotSpots.push({ x: 2.4, y: 0.5, z: cz, ry: -Math.PI / 2 });
  }
  colliders.push({ minX: 1.95, maxX: 2.85, minZ: -2.1, maxZ: 2.4 });

  // ---------- ЛАЗАРЕТ: вторая камера подвала ----------
  const floor2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.5), floorMat);
  floor2.rotation.x = -Math.PI / 2;
  floor2.position.set(4.8, 0.001, 0.1);
  floor2.receiveShadow = true;
  scene.add(floor2);
  plane(scene, 3.6, 4.5, mat(0x26262a, 0.95), 4.8, 2.4, 0.1, 0, Math.PI / 2); // потолок лазарета — плоскость вниз
  box(scene, 0.2, 2.5, 5, concMat, 6.6, 1.25, 0.1);
  colliders.push({ minX: 6.5, maxX: 6.7, minZ: -2.1, maxZ: 2.4 });
  box(scene, 3.6, 2.5, 0.2, concMat, 4.8, 1.25, -2.3);
  colliders.push({ minX: 3.0, maxX: 6.7, minZ: -2.4, maxZ: -2.2 });
  box(scene, 3.6, 2.5, 0.2, concMat, 4.8, 1.25, 2.55);
  colliders.push({ minX: 3.0, maxX: 6.7, minZ: 2.45, maxZ: 2.65 });

  // лампа лазарета
  const medBulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc8ffd8, emissive: 0x8ae0a8, emissiveIntensity: 2.4 }));
  medBulb.position.set(4.8, 2.05, 0.1);
  scene.add(medBulb);
  const medWire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), mat(0x1a1a1a, 0.6));
  medWire.position.set(4.8, 2.25, 0.1);
  scene.add(medWire);
  const medLight = new THREE.PointLight(0xa8e8c0, 6, 8, 2);
  medLight.position.set(4.8, 1.9, 0.1);
  scene.add(medLight);

  // две койки вдоль правой стены лазарета
  for (const cz of [-1.5, -0.3]) {
    box(scene, 0.85, 0.32, 1.7, cotMat, 5.9, 0.22, cz);
    box(scene, 0.85, 0.08, 1.7, mattressMat, 5.9, 0.42, cz);
    for (const [dx, dz] of [[-0.35, -0.78], [0.35, -0.78], [-0.35, 0.78], [0.35, 0.78]]) {
      box(scene, 0.05, 0.24, 0.05, cotMat, 5.9 + dx, 0.12, cz + dz, { cast: false });
    }
    box(scene, 0.8, 0.06, 1.0, mat(0x3a5a4a, 0.95), 5.9, 0.49, cz + 0.3);
    cotSpots.push({ x: 5.9, y: 0.5, z: cz, ry: -Math.PI / 2 });
  }
  colliders.push({ minX: 5.45, maxX: 6.4, minZ: -2.4, maxZ: 0.55 });

  // полка с бинтами, йодом и углём
  for (const y of [0.8, 1.25]) {
    box(scene, 0.35, 0.04, 1.6, wood, 4.9, y, -1.4);
  }
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 10), mat(0x7a4a3a, 0.4));
      jar.position.set(4.9, 0.86 + (i > 2 ? 0.45 : 0), -2.0 + (i % 3) * 0.3);
      scene.add(jar);
    } else {
      box(scene, 0.12, 0.14, 0.1, mat(0xd8dce4, 0.6), 4.9, 0.87 + (i > 2 ? 0.45 : 0), -2.0 + (i % 3) * 0.3);
    }
  }
  colliders.push({ minX: 4.7, maxX: 5.1, minZ: -2.2, maxZ: -0.6 });

  // плакат и лужа
  plane(scene, 1.1, 0.7,
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/poster_basement.png'), roughness: 0.95, color: 0xb8b0a0 }),
    4.6, 1.6, -2.18, 0);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), mat(0x2a2c30, 0.25));
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(4.2, 0.004, 1.0);
  scene.add(puddle);

  // ---------- полки с хламом (левая стена) ----------
  for (const y of [0.5, 0.95, 1.4]) {
    box(scene, 0.4, 0.04, 2.2, wood, -2.75, y, 0.6);
  }
  const junkColors = [0x6a5a3a, 0x4a5a6a, 0x5a5a52, 0x7a4a3a];
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const y = [0.5, 0.95, 1.4][i % 3];
    if (rnd() < 0.4) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), mat(junkColors[Math.floor(rnd() * 4)], 0.4));
      jar.position.set(-2.75, y + 0.09, -0.3 + rnd() * 1.8);
      scene.add(jar);
    } else {
      box(scene, 0.14, 0.16, 0.14, mat(junkColors[Math.floor(rnd() * 4)], 0.7), -2.75, y + 0.1, -0.3 + rnd() * 1.8);
    }
  }
  colliders.push({ minX: -3.0, maxX: -2.5, minZ: -0.5, maxZ: 1.7 });
  // велосипедное колесо
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 24), mat(0x3a3a40, 0.4, { metalness: 0.6 }));
  wheel.position.set(-2.55, 1.5, 1.9);
  wheel.rotation.y = Math.PI / 2;
  scene.add(wheel);

  // ---------- лампочка ----------
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd8a0, emissive: 0xffc060, emissiveIntensity: 3.5 }));
  bulb.position.set(0, 2.1, 0.1);
  scene.add(bulb);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6), mat(0x1a1a1a, 0.6));
  wire.position.set(0, 2.3, 0.1);
  scene.add(wire);
  const bulbLight = new THREE.PointLight(0xffc878, 8, 9, 2);
  bulbLight.position.set(0, 1.95, 0.1);
  scene.add(bulbLight);

  scene.add(new THREE.HemisphereLight(0x3a3630, 0x0e0c0a, 0.9));

  // мокрое пятно
  const stain = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), mat(0x24262a, 0.3));
  stain.rotation.x = -Math.PI / 2;
  stain.position.set(-0.5, 0.004, 0.8);
  scene.add(stain);
  // плакат «сдавайте металлолом» и кровавый след у койки
  plane(scene, 1.1, 0.7,
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/poster_basement.png'), roughness: 0.95, color: 0xb8b0a0 }),
    -0.4, 1.75, -2.18, 0);
  const bloodP = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/blood_decal.png'), transparent: true, roughness: 0.95, depthWrite: false }));
  bloodP.rotation.x = -Math.PI / 2;
  bloodP.rotation.z = 1.2;
  bloodP.position.set(1.8, 0.006, 0.2);
  scene.add(bloodP);
  // дозиметр на полке
  box(scene, 0.14, 0.1, 0.06, mat(0x3a4038, 0.5), -2.72, 1.46, 0.9, { cast: false });

  // ---------- обновление ----------
  let t = 0;
  // ---------- батчинг статики ----------
  batchStaticMeshes(scene);

  function update(dt) {
    t += dt;
    coals.material.emissiveIntensity = 2.0 + Math.sin(t * 7.7) * 0.4 + Math.sin(t * 17.3) * 0.2;
    boilerLight.intensity = 8.5 + Math.sin(t * 8.3) * 1.4 + Math.sin(t * 23.1) * 0.5;
    bulbLight.intensity = 7.6 + Math.sin(t * 13.7) * 0.25 + (Math.sin(t * 0.9) > 0.97 ? -3 : 0);
    bulb.material.emissiveIntensity = 3.2 + Math.sin(t * 13.7) * 0.1;
    medLight.intensity = 5.6 + Math.sin(t * 5.3) * 0.35;
    medBulb.material.emissiveIntensity = 2.3 + Math.sin(t * 5.3) * 0.12;
  }

  return {
    scene, bounds, colliders, cotSpots,
    anchors: {
      exit: { x: 0, z: 1.9 },
      patients: cotSpots
    },
    update
  };
}
