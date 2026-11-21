// highlight.js — контур интерактива по реальной видимой геометрии.
// Никаких «приблизительных коллизионных кубов», если рядом есть меш: выбираем
// конкретный Mesh или конкретный экземпляр InstancedMesh и строим EdgesGeometry.
import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _instance = new THREE.Matrix4();

function visibleInTree(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Найти примитив, который действительно нарисован около старой hl-области. */
export function resolveGeometryTarget(scene, hl) {
  if (!scene || !hl) return null;
  const wanted = new THREE.Vector3(hl[0], hl[1], hl[2]);
  const expected = new THREE.Vector3(Math.abs(hl[3]), Math.abs(hl[4]), Math.abs(hl[5]));
  const expectedDiag = Math.max(0.08, expected.length());
  let best = null;
  let bestScore = Infinity;

  function consider(geometry, matrixWorld, material) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
    // Стекло витрин и иней не должны перехватывать контур товара/окна.
    if (material && material.transparent && material.opacity < 0.5) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    _box.copy(geometry.boundingBox).applyMatrix4(matrixWorld);
    if (_box.isEmpty()) return;
    _box.getCenter(_center);
    _box.getSize(_size);
    const distance = _center.distanceTo(wanted);
    const actualDiag = Math.max(0.02, _size.length());
    // Не тащим контур на дальнюю стену/пол: искомый объект лежит рядом с hl.
    if (distance > Math.max(0.9, expectedDiag * 1.35)) return;
    const sizeMismatch = Math.abs(Math.log(actualDiag / expectedDiag));
    // Центр важнее размера; слишком большие стены проигрывают маленьким предметам.
    const score = distance + sizeMismatch * 0.30 + (actualDiag > expectedDiag * 2.4 ? 0.35 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = { geometry, matrixWorld: matrixWorld.clone() };
    }
  }

  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || !visibleInTree(o) || o.userData.noHighlight) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, _instance);
        const world = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, _instance);
        consider(o.geometry, world, materials[0]);
      }
    } else {
      consider(o.geometry, o.matrixWorld, materials[0]);
    }
  });
  return best;
}

export class GeometryHighlight {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'geometry-highlight';
    this.root.visible = false;
    this.root.userData.noHighlight = true;
    this.material = new THREE.LineBasicMaterial({
      color: 0xffd27a, transparent: true, opacity: 0.88,
      depthWrite: false, depthTest: true
    });
    // У сферы нет острых рёбер для EdgesGeometry. Для таких гладких мешей
    // используем inverted hull: та же геометрия, расширенная по нормалям на 8 мм.
    this.hullMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd27a, side: THREE.BackSide,
      depthWrite: false, depthTest: true, toneMapped: false
    });
    this.entries = [];
    this.objectTarget = null;
    this.primitiveTarget = null;
  }

  clear() {
    for (const e of this.entries) {
      this.root.remove(e.line);
      e.line.geometry.dispose();
    }
    this.entries.length = 0;
    this.objectTarget = null;
    this.primitiveTarget = null;
    this.root.visible = false;
  }

  _add(geometry, matrixWorld, source = null, instanceId = -1) {
    // 35°: силуэт и настоящие рёбра, без триангуляционной «паутины» на моделях.
    const edges = new THREE.EdgesGeometry(geometry, 35);
    let outline;
    if (edges.attributes.position && edges.attributes.position.count > 0) {
      outline = new THREE.LineSegments(edges, this.material);
    } else {
      // Гладкая сфера/обтекаемая модель: контур строится по её реальным вершинам,
      // а не по AABB. Оригинал закрывает центр, BackSide-оболочка оставляет только ободок.
      edges.dispose();
      const hull = geometry.clone();
      const p = hull.attributes.position, n = hull.attributes.normal;
      if (!p || !n) { hull.dispose(); return; }
      for (let i = 0; i < p.count; i++) {
        p.setXYZ(i,
          p.getX(i) + n.getX(i) * 0.008,
          p.getY(i) + n.getY(i) * 0.008,
          p.getZ(i) + n.getZ(i) * 0.008);
      }
      p.needsUpdate = true;
      hull.computeBoundingSphere();
      outline = new THREE.Mesh(hull, this.hullMaterial);
    }
    outline.matrixAutoUpdate = false;
    outline.matrix.copy(matrixWorld);
    outline.renderOrder = 8;
    outline.userData.noHighlight = true;
    this.root.add(outline);
    this.entries.push({ line: outline, source, instanceId });
  }

  setPrimitive(target) {
    this.clear();
    if (!target) return;
    this.primitiveTarget = target;
    this._add(target.geometry, target.matrixWorld);
    this.root.visible = this.entries.length > 0;
  }

  setObject(object) {
    this.clear();
    if (!object) return;
    this.objectTarget = object;
    object.updateWorldMatrix(true, true);
    object.traverse((o) => {
      if (!o.isMesh || !o.geometry || !visibleInTree(o) || o.userData.noHighlight) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      if (materials[0] && materials[0].transparent && materials[0].opacity < 0.5) return;
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, _instance);
          const world = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, _instance);
          this._add(o.geometry, world, o, i);
        }
      } else {
        this._add(o.geometry, o.matrixWorld, o);
      }
    });
    this.root.visible = this.entries.length > 0;
  }

  setLegacyBox(hl) {
    this.clear();
    if (!hl) return;
    const geo = new THREE.BoxGeometry(Math.abs(hl[3]), Math.abs(hl[4]), Math.abs(hl[5]));
    const matrix = new THREE.Matrix4().makeTranslation(hl[0], hl[1], hl[2]);
    this._add(geo, matrix);
    geo.dispose();
    this.root.visible = this.entries.length > 0;
  }

  /** Динамические группы (гости, Людмила, дверь) двигаются вместе с контуром. */
  sync() {
    if (!this.objectTarget || !this.root.visible) return;
    this.objectTarget.updateWorldMatrix(true, true);
    for (const e of this.entries) {
      if (!e.source) continue;
      if (e.instanceId >= 0) {
        e.source.getMatrixAt(e.instanceId, _instance);
        e.line.matrix.multiplyMatrices(e.source.matrixWorld, _instance);
      } else {
        e.line.matrix.copy(e.source.matrixWorld);
      }
      e.line.matrixWorldNeedsUpdate = true;
    }
  }
}
