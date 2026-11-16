// rig.js — процедурный человекоид: иерархия суставов + примитивы.
// Модель не скиннинговая: каждый сегмент — меш, прикреплённый к своему суставу.
// Плюс: без весов, без GLTF, нулевой размер ассетов, любая форма на лету.
// Оси: +Y вверх, +Z — лицом вперёд, +X — вправо.

import * as THREE from 'three';

export const DIM = {
  hips: 0.94,
  spine: 0.20,
  chest: 0.26,
  neck: 0.09,
  upperArm: 0.30,
  foreArm: 0.27,
  hand: 0.10,
  thigh: 0.46,
  shin: 0.44
};

function joint(parent, name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  g.userData.base = g.position.clone();
  parent.add(g);
  return g;
}

function seg(parent, length, radius, material, opts = {}) {
  const cyl = Math.max(0.005, length - radius * 2);
  const geo = new THREE.CapsuleGeometry(radius, cyl, 4, 10);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = -length / 2;
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function box(parent, w, h, d, material, x = 0, y = 0, z = 0, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * createHumanoid(opts) -> rig
 * rig = { root, body, joints, extraArms, options, eyeMeshes }
 */
export function createHumanoid(options = {}) {
  const o = Object.assign({
    height: 1.78,
    girth: 1.0,
    headScale: 1.0,
    skin: 0xb98c6b,
    cloth: 0x252a35,
    cloth2: 0x171b23,
    hat: false,
    hatColor: 0x11141a,
    coat: false,
    coatColor: 0x2b2f3a,
    extraArms: 0,
    eyeCount: 2,
    eyeColor: 0x15181f,
    eyeGlow: 0.0,
    mouth: 'none',      // 'none' | 'smile' | 'wide' | 'stitched'
    fingers: 4,
    shadow: true,
    bald: false
  }, options);

  const root = new THREE.Group();
  root.name = 'humanoid';
  const body = new THREE.Group();
  body.scale.setScalar(o.height / 1.78);
  root.add(body);

  const skinMat = new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.88, metalness: 0.0 });
  const clothMat = new THREE.MeshStandardMaterial({ color: o.cloth, roughness: 0.95 });
  const cloth2Mat = new THREE.MeshStandardMaterial({ color: o.cloth2, roughness: 0.95 });
  const coatMat = new THREE.MeshStandardMaterial({ color: o.coatColor, roughness: 0.92 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 1.0 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: o.eyeColor, emissive: o.eyeColor, emissiveIntensity: o.eyeGlow, roughness: 0.25, metalness: 0.1
  });

  const joints = {};
  const add = (parent, name, x, y, z) => (joints[name] = joint(parent, name, x, y, z));
  const g = o.girth;

  // --- таз / ноги ---
  const hips = add(body, 'hips', 0, DIM.hips, 0);
  box(hips, 0.30 * g, 0.19, 0.19 * g, clothMat, 0, 0.0, 0);

  const legX = 0.10 * g;
  const hipL = add(hips, 'hipL', -legX, -0.04, 0);
  const hipR = add(hips, 'hipR', legX, -0.04, 0);
  seg(hipL, DIM.thigh, 0.075 * g, clothMat);
  seg(hipR, DIM.thigh, 0.075 * g, clothMat);
  const kneeL = add(hipL, 'kneeL', 0, -DIM.thigh, 0);
  const kneeR = add(hipR, 'kneeR', 0, -DIM.thigh, 0);
  seg(kneeL, DIM.shin, 0.062 * g, clothMat);
  seg(kneeR, DIM.shin, 0.062 * g, clothMat);
  const footL = add(kneeL, 'footL', 0, -DIM.shin, 0);
  const footR = add(kneeR, 'footR', 0, -DIM.shin, 0);
  box(footL, 0.105, 0.075, 0.24, cloth2Mat, 0, -0.035, 0.05);
  box(footR, 0.105, 0.075, 0.24, cloth2Mat, 0, -0.035, 0.05);

  // --- торс ---
  const spine = add(hips, 'spine', 0, 0.10, 0);
  const chest = add(spine, 'chest', 0, DIM.spine, 0);
  box(chest, 0.34 * g, DIM.chest + 0.06, 0.21 * g, clothMat, 0, DIM.chest * 0.5, 0);
  // воротник
  box(chest, 0.20 * g, 0.05, 0.16 * g, cloth2Mat, 0, DIM.chest + 0.05, 0);

  if (o.coat) {
    const coatGeo = new THREE.CylinderGeometry(0.19 * g, 0.27 * g, 0.95, 12, 1, true);
    const coatMesh = new THREE.Mesh(coatGeo, coatMat);
    coatMesh.position.y = 0.22;
    coatMesh.material.side = THREE.DoubleSide;
    coatMesh.castShadow = true;
    chest.add(coatMesh);
  }

  // --- руки ---
  const shX = 0.20 * g;
  const shoulderL = add(chest, 'shoulderL', -shX, DIM.chest + 0.02, 0);
  const shoulderR = add(chest, 'shoulderR', shX, DIM.chest + 0.02, 0);
  for (const [sh, side] of [[shoulderL, -1], [shoulderR, 1]]) {
    seg(sh, DIM.upperArm, 0.055 * g, clothMat);
    const el = joint(sh, side < 0 ? 'elbowL' : 'elbowR', 0, -DIM.upperArm, 0);
    joints[el.name] = el;
    seg(el, DIM.foreArm, 0.048 * g, o.coat ? coatMat : clothMat);
    const hand = joint(el, side < 0 ? 'handL' : 'handR', 0, -DIM.foreArm, 0);
    joints[hand.name] = hand;
    const palm = box(hand, 0.075, 0.10, 0.045, skinMat, 0, -0.045, 0);
    palm.castShadow = o.shadow;
    // пальцы — счётный признак для игрока
    const n = Math.max(0, Math.min(7, o.fingers));
    for (let i = 0; i < n; i++) {
      const f = box(hand, 0.014, 0.06, 0.016, skinMat, (i - (n - 1) / 2) * 0.017, -0.125, 0);
      f.castShadow = false;
    }
  }

  // --- шея / голова ---
  const neck = add(chest, 'neck', 0, DIM.chest + 0.03, 0);
  seg(neck, DIM.neck + 0.04, 0.045 * g, skinMat);
  const head = add(neck, 'head', 0, DIM.neck + 0.02, 0);
  const hs = 0.115 * o.headScale;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(hs, 20, 16), skinMat);
  skull.scale.set(0.92, 1.12, 1.0);
  skull.position.y = hs * 1.05;
  skull.castShadow = o.shadow;
  skull.receiveShadow = true;
  head.add(skull);
  if (!o.bald) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(hs * 1.02, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.scale.set(0.95, 1.12, 1.02);
    hair.position.y = hs * 1.10;
    hair.castShadow = false;
    head.add(hair);
  }

  // глаза: раскладка по количеству
  const eyeMeshes = [];
  const eyeY = hs * 1.12;
  const eyeZ = hs * 0.84;
  const layout = {
    0: [],
    1: [[0, 0]],
    2: [[-0.42, 0], [0.42, 0]],
    3: [[-0.45, -0.12], [0.45, -0.12], [0, 0.5]],
    4: [[-0.42, 0.18], [0.42, 0.18], [-0.42, -0.28], [0.42, -0.28]],
    6: [[-0.5, 0.25], [0, 0.25], [0.5, 0.25], [-0.5, -0.3], [0, -0.3], [0.5, -0.3]]
  };
  const lay = layout[o.eyeCount] || layout[2];
  for (const [ex, ey] of lay) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(hs * 0.17, 10, 8), eyeMat);
    e.position.set(ex * hs * 0.9, eyeY + ey * hs * 0.6, eyeZ);
    head.add(e);
    eyeMeshes.push(e);
  }

  // рот
  if (o.mouth !== 'none') {
    const mw = o.mouth === 'wide' ? hs * 0.9 : hs * 0.55;
    const mh = o.mouth === 'wide' ? hs * 0.5 : hs * 0.09;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(mw, mh, hs * 0.12),
      new THREE.MeshStandardMaterial({ color: 0x0a0608, roughness: 0.6 })
    );
    m.position.set(0, hs * 0.72, hs * 0.86);
    head.add(m);
  }

  if (o.hat) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(hs * 1.7, hs * 1.7, 0.012, 20), cloth2Mat);
    brim.position.y = hs * 1.95;
    brim.castShadow = false;
    head.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(hs * 0.95, hs * 1.0, hs * 0.85, 16), cloth2Mat);
    crown.position.y = hs * 2.35;
    crown.castShadow = false;
    head.add(crown);
  }

  // --- дополнительные руки (для нелюдей) ---
  const extraArms = [];
  for (let i = 0; i < o.extraArms; i++) {
    const ang = (i / Math.max(1, o.extraArms)) * Math.PI;
    const sx = Math.cos(ang) * 0.19 * g;
    const sz = Math.sin(ang) * 0.10 * g;
    const sh = joint(chest, 'extraShoulder' + i, sx, DIM.chest - 0.02 - i * 0.06, sz);
    sh.rotation.z = sx > 0 ? -0.35 : 0.35;
    sh.userData.base.rotation = sh.rotation.clone();
    seg(sh, DIM.upperArm * 0.9, 0.05 * g, skinMat);
    const el = joint(sh, 'extraElbow' + i, 0, -DIM.upperArm * 0.9, 0);
    seg(el, DIM.foreArm * 0.85, 0.043 * g, skinMat);
    const hand = joint(el, 'extraHand' + i, 0, -DIM.foreArm * 0.85, 0);
    box(hand, 0.07, 0.09, 0.04, skinMat, 0, -0.04, 0);
    extraArms.push(sh);
    joints[sh.name] = sh;
    joints[el.name] = el;
    joints[hand.name] = hand;
  }

  if (!o.shadow) {
    root.traverse((n) => { if (n.isMesh) n.castShadow = false; });
  }

  return { root, body, joints, extraArms, options: o, eyeMeshes };
}

export function disposeHumanoid(rig) {
  rig.root.traverse((n) => {
    if (n.isMesh) {
      n.geometry.dispose();
      if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
      else n.material.dispose();
    }
  });
  if (rig.root.parent) rig.root.parent.remove(rig.root);
}
