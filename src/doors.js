// doors.js — живые наземные двери. Все корни dynamic: статик-батчер не должен
// запечь створки в InstancedMesh. Поворот/раздвижение обновляются только в активной сцене.
import * as THREE from 'three';
import { box, mat, pbrMat } from './mats.js';

function finish(group, panels, kind) {
  group.userData.dynamic = true;
  let current = 0;
  let target = 0;
  return {
    target: group,
    kind,
    setOpen(v) { target = v ? 1 : 0; },
    get openAmount() { return current; },
    update(dt) {
      current += (target - current) * Math.min(1, dt * 6.5);
      if (Math.abs(target - current) < 0.001) current = target;
      for (const apply of panels) apply(current);
    }
  };
}

function doorMaterial() {
  return pbrMat('Wood051', 1.2, 2.4, {
    color: 0x615247,
    normalScale: 0.52,
    roughness: 0.93
  });
}

function metalMaterial() {
  return pbrMat('Metal032', 1, 2, {
    color: 0x77716a,
    normalScale: 0.42,
    roughness: 0.8
  });
}

/** Одностворчатая дверь вдоль локальной оси X, толщина по Z. */
export function createSingleDoor(scene, {
  x = 0, z = 0, rotationY = 0, width = 1, height = 2.04,
  openSign = -1, material = null
} = {}) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotationY;
  scene.add(root);
  const pivot = new THREE.Group();
  pivot.position.x = -width / 2;
  root.add(pivot);
  const wood = material || doorMaterial();
  box(pivot, width - 0.025, height, 0.065, wood, width / 2, height / 2, 0);
  const trim = mat(0x29241f, 0.88);
  for (const py of [0.55, 1.35]) {
    box(pivot, width * 0.64, 0.54, 0.022, trim, width / 2, py, 0.045, { cast: false });
  }
  const handleMat = metalMaterial();
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), handleMat);
  handle.position.set(width - 0.1, 1.02, 0.075);
  pivot.add(handle);
  const result = finish(root, [(v) => { pivot.rotation.y = openSign * v * 1.72; }], 'single');
  result.pivot = pivot;
  return result;
}

/** Двустворчатая дверь: полотна уходят от центра, проём не перекрывается. */
export function createDoubleDoor(scene, {
  x = 0, z = 0, rotationY = 0, width = 1.84, height = 2.3,
  material = null, glass = false
} = {}) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotationY;
  scene.add(root);
  const half = width / 2;
  const panelMat = material || (glass ? metalMaterial() : doorMaterial());
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x26343c, emissive: 0x617782, emissiveIntensity: 0.16,
    roughness: 0.2, metalness: 0.16
  });
  const pivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.x = side * half;
    root.add(pivot);
    const cx = -side * half / 2;
    box(pivot, half - 0.018, height, 0.07, panelMat, cx, height / 2, 0);
    if (glass) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(half * 0.62, height * 0.46), glassMat);
      pane.position.set(cx, height * 0.62, 0.041);
      pivot.add(pane);
    }
    box(pivot, 0.035, 0.34, 0.065, metalMaterial(), -side * (half - 0.11), 1.08, 0.065, { cast: false });
    pivots.push({ pivot, side });
  }
  const result = finish(root, pivots.map(({ pivot, side }) =>
    (v) => { pivot.rotation.y = side * v * 1.53; }), 'double');
  result.pivots = pivots.map((p) => p.pivot);
  return result;
}

/** Магазинные раздвижные двери: плавный автоматический проход без разворота камеры. */
export function createSlidingDoor(scene, {
  x = 0, z = 0, rotationY = 0, width = 1.5, height = 2.3
} = {}) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.rotation.y = rotationY;
  scene.add(root);
  const half = width / 2;
  const frame = metalMaterial();
  const glass = new THREE.MeshStandardMaterial({
    color: 0x263943, emissive: 0x91b4c4, emissiveIntensity: 0.18,
    roughness: 0.16, metalness: 0.24
  });
  const panels = [];
  for (const side of [-1, 1]) {
    const panel = new THREE.Group();
    root.add(panel);
    box(panel, half - 0.025, height, 0.065, frame, 0, height / 2, 0);
    box(panel, half - 0.13, height - 0.34, 0.072, glass, 0, height / 2 + 0.03, 0.006, { cast: false });
    box(panel, 0.026, 0.52, 0.09, frame, -side * (half / 2 - 0.09), 1.04, 0.055, { cast: false });
    panels.push({ panel, side });
  }
  const result = finish(root, panels.map(({ panel, side }) =>
    (v) => { panel.position.x = side * (half / 2 + v * half * 0.94); }), 'sliding');
  result.panels = panels.map((p) => p.panel);
  return result;
}
