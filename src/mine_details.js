// Static, surface-aligned wear details for the basement and mine scenes.
import * as THREE from 'three';
import { tex } from './mats.js';

const decalGeometry = new THREE.PlaneGeometry(1, 1);
const planeNormal = new THREE.Vector3(0, 0, 1);
const N_LEFT = [1, 0, 0];
const N_RIGHT = [-1, 0, 0];
const N_BACK = [0, 0, 1];
const N_FRONT = [0, 0, -1];

function decalMaterial(name, opacity, roughness = 0.96) {
  const map = tex(`assets/tex/generated/${name}.png`);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness,
    metalness: 0,
    transparent: true,
    opacity,
    alphaTest: 0.02,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.FrontSide
  });
}

function d(kind, point, normal, w, h, roll = 0) {
  return { kind, point, normal, w, h, roll };
}

// Coordinates reference the actual inner faces of the 0.35 m mine walls.
const MX = 5.005;
const MZ_BACK = -12.005;
const MINE_DECALS = {
  1: [
    d('rust_drips', [-MX, 1.40, 3.0], N_LEFT, 0.65, 1.10),
    d('scratches', [MX, 1.25, 0.8], N_RIGHT, 1.10, 0.70, -0.08),
    d('mold', [-MX, 0.75, -5.0], N_LEFT, 1.25, 1.10),
    d('rust_drips', [3.0, 1.45, MZ_BACK], N_BACK, 0.75, 1.15)
  ],
  2: [
    d('mold', [-MX, 0.85, 3.4], N_LEFT, 1.25, 1.35),
    d('rust_drips', [MX, 1.30, 2.8], N_RIGHT, 0.70, 1.25),
    d('scratches', [-MX, 1.35, -2.8], N_LEFT, 1.20, 0.80, 0.10),
    d('mold', [MX, 0.80, -5.6], N_RIGHT, 1.40, 1.30),
    d('rust_drips', [-MX, 1.35, -8.6], N_LEFT, 0.75, 1.30),
    d('scratches', [-2.7, 1.30, MZ_BACK], N_BACK, 1.25, 0.80, -0.06)
  ],
  3: [
    d('mold', [-MX, 0.90, 3.8], N_LEFT, 1.45, 1.50),
    d('rust_drips', [MX, 1.35, 3.4], N_RIGHT, 0.75, 1.25),
    d('mold', [MX, 0.75, -0.8], N_RIGHT, 1.30, 1.25),
    d('scratches', [-MX, 1.30, -2.1], N_LEFT, 1.20, 0.80, -0.12),
    d('rust_drips', [-MX, 1.40, -4.0], N_LEFT, 0.75, 1.30),
    d('mold', [MX, 0.90, -6.0], N_RIGHT, 1.50, 1.50),
    d('rust_drips', [MX, 1.35, -7.7], N_RIGHT, 0.70, 1.25),
    d('mold', [2.6, 0.85, MZ_BACK], N_BACK, 1.60, 1.40)
  ],
  4: [
    d('mold', [-MX, 1.00, 4.0], N_LEFT, 1.65, 1.75),
    d('rust_drips', [MX, 1.35, 3.7], N_RIGHT, 0.90, 1.50),
    d('scratches', [-MX, 1.30, 1.7], N_LEFT, 1.35, 0.90, 0.14),
    d('mold', [MX, 0.85, 0.7], N_RIGHT, 1.65, 1.50),
    d('mold', [-MX, 0.85, -1.4], N_LEFT, 1.55, 1.55),
    d('rust_drips', [MX, 1.35, -2.4], N_RIGHT, 0.85, 1.45),
    d('scratches', [MX, 1.40, -4.4], N_RIGHT, 1.40, 0.90, -0.16),
    d('mold', [-MX, 1.00, -6.3], N_LEFT, 1.80, 1.80),
    d('rust_drips', [-MX, 1.45, -9.0], N_LEFT, 0.95, 1.55),
    d('mold', [2.4, 1.00, MZ_BACK], N_BACK, 1.90, 1.80)
  ]
};

// The basement's visible faces are x +/-2.9/6.5 and z -2.2/2.45.
const BASEMENT_DECALS = [
  d('mold', [-2.9, 1.80, 1.75], N_LEFT, 0.85, 1.00),
  d('rust_drips', [-1.25, 1.50, -2.2], N_BACK, 0.70, 1.15),
  d('scratches', [-1.75, 1.30, 2.45], N_FRONT, 0.95, 0.70, -0.12),
  d('mold', [2.9, 1.65, 1.35], N_RIGHT, 0.85, 1.00),
  d('rust_drips', [2.9, 1.45, -1.25], N_RIGHT, 0.55, 1.05),
  d('mold', [3.65, 1.35, -2.2], N_BACK, 1.00, 1.15),
  d('rust_drips', [6.5, 1.55, -0.9], N_RIGHT, 0.65, 1.15),
  d('scratches', [4.15, 1.25, 2.45], N_FRONT, 1.15, 0.75, 0.08)
];

function addDecalSet(scene, specs, wear = 2) {
  const materials = {
    mold: decalMaterial('mold', Math.min(0.82, 0.48 + wear * 0.07)),
    rust_drips: decalMaterial('rust_drips', Math.min(0.78, 0.46 + wear * 0.065), 0.90),
    scratches: decalMaterial('scratches', Math.min(0.62, 0.34 + wear * 0.055), 0.86)
  };

  for (const spec of specs) {
    const normal = new THREE.Vector3().fromArray(spec.normal).normalize();
    const decal = new THREE.Mesh(decalGeometry, materials[spec.kind]);
    decal.name = `surface-${spec.kind}-decal`;
    // 18 mm is enough to avoid z-fighting without visibly floating off the wall.
    decal.position.fromArray(spec.point).addScaledVector(normal, 0.018);
    decal.quaternion.setFromUnitVectors(planeNormal, normal);
    if (spec.roll) decal.rotateZ(spec.roll);
    decal.scale.set(spec.w, spec.h, 1);
    decal.castShadow = false;
    decal.receiveShadow = false;
    decal.renderOrder = 1;
    scene.add(decal);
  }
}

export function addMineDecals(scene, level) {
  addDecalSet(scene, MINE_DECALS[level], level);
}

export function addBasementDecals(scene) {
  addDecalSet(scene, BASEMENT_DECALS, 2.5);
}
