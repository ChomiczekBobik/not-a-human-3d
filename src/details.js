// details.js — локальные процедурные следы времени. Декаль всегда ставится
// на 12–25 мм перед поверхностью; это не второй coplanar-слой и не collision box.
import * as THREE from 'three';
import { tex, plane, matTex } from './mats.js';

const decalMaterials = new Map();

export function decal(parent, path, w, h, x, y, z, ry = 0, rx = 0, opacity = 0.8, color = 0xffffff) {
  const key = `${path}|${opacity}|${color}`;
  let material = decalMaterials.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      map: tex(path), color, roughness: 0.98, metalness: 0,
      transparent: true, opacity, alphaTest: 0.02, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      side: THREE.FrontSide
    });
    decalMaterials.set(key, material);
  }
  const mesh = plane(parent, w, h, material, x, y, z, ry, rx);
  mesh.name = `decal-${path.split('/').pop().replace('.png', '')}`;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  mesh.userData.decal = true;
  return mesh;
}

export function dampPaperMaterial(rx = 1, ry = 1, color = 0xc4b99d) {
  return matTex('assets/tex/generated/damp_paper.png', rx, ry, color, 0.98);
}

export function organicFloorMaterial(rx = 2, ry = 2, color = 0x5c6256) {
  return matTex('assets/tex/generated/organic_grime.png', rx, ry, color, 0.99, { bump: 0.012 });
}
