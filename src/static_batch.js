// static_batch.js — авто-инстансер статики: все статичные меши с одинаковой
// геометрией (по ПАРАМЕТРАМ, не по uuid) и материалом собираются в InstancedMesh.
// Дополнительно каждая группа делится на пространственные корзины (~6 м),
// поэтому на улице/в коридоре фрустум-каллинг отбрасывает целые инстанс-проходы.
// Порядок прозрачных объектов сохраняется (их не батчим), динамические — в skip.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Размер корзины по XZ, м: чем мельче, тем точнее фрустум-каллинг инстансов
// («не рисуем, куда не смотрим»), но больше проходов, когда сцена целиком в кадре.
// Баланс из замеров на Full HD: 4 м. Тюнится параметром ?bin=N (для замеров).
const BIN = Math.max(2, Math.min(12,
  parseInt(new URLSearchParams(location.search).get('bin') || '4', 10) || 4));

export function batchStaticMeshes(scene, skipRoots = []) {
  const skip = new Set(skipRoots.filter(Boolean));
  const byKey = new Map();
  const toRemove = [];

  scene.traverse((node) => {
    if (!node.isMesh || node.isInstancedMesh || !node.geometry || !node.material) return;
    if (Array.isArray(node.material)) return;
    const mat = node.material;
    if (mat.transparent || mat.opacity < 1 || mat.alphaTest > 0) return;
    if (node.userData.dynamic || node.visible === false) return;
    for (let p = node; p; p = p.parent) {
      if (skip.has(p) || p.userData.dynamic) return;
    }
    // Ключ геометрии по параметрам: все боксы с общим юнит-боксом, одинаковые
    // цилиндры/плоскости, созданные отдельно, склеиваются в один инстанс-проход.
    const gp = node.geometry.parameters;
    const gkey = gp ? node.geometry.type + JSON.stringify(gp) : node.geometry.uuid;
    const key = [gkey, mat.uuid, node.castShadow, node.receiveShadow].join('|');
    let arr = byKey.get(key);
    if (!arr) { arr = []; byKey.set(key, arr); }
    const pos = node.getWorldPosition(new THREE.Vector3());
    arr.push({ node, pos });
  });

  let saved = 0;
  const matrix = new THREE.Matrix4();

  for (const [, items] of byKey) {
    if (items.length < 3) continue;
    const g = items[0].node.geometry;
    const m = items[0].node.material;
    const cast = items[0].node.castShadow;
    const receive = items[0].node.receiveShadow;

    // Пространственные корзины: каждый бин — отдельный InstancedMesh со своей
    // bounding sphere, поэтому дальние бины не рендерятся, когда не видны.
    const bins = new Map();
    for (const it of items) {
      const bk = `${Math.floor(it.pos.x / BIN)}|${Math.floor(it.pos.z / BIN)}`;
      let arr = bins.get(bk);
      if (!arr) { arr = []; bins.set(bk, arr); }
      arr.push(it);
    }

    const leftover = [];
    for (const [, bin] of bins) {
      if (bin.length < 3) { leftover.push(...bin); continue; }
      batchBin(bin);
    }
    // корзины могли разъехаться по одному объекту (редкие окна на улице):
    // не теряем батчинг — всё, что не набрало корзину, клеим одним общим инстансом
    if (leftover.length >= 3) batchBin(leftover);

    function batchBin(bin) {
      const inst = new THREE.InstancedMesh(g, m, bin.length);
      inst.castShadow = cast;
      inst.receiveShadow = receive;
      inst.frustumCulled = true;
      for (let i = 0; i < bin.length; i++) {
        bin[i].node.updateWorldMatrix(true, false);
        matrix.copy(bin[i].node.matrixWorld);
        inst.setMatrixAt(i, matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      scene.add(inst);
      for (const it of bin) toRemove.push(it.node);
      saved += bin.length - 1;
    }
  }
  for (const n of toRemove) if (n.parent) n.parent.remove(n);
  return { batched: saved, groups: byKey.size };
}

/**
 * Объединяет оставшуюся статику с общим материалом, даже если исходные
 * геометрии разные. root может быть dynamic: это граница батча, а не причина
 * пропустить его. Вложенные dynamic-группы и интерактивные дочерние объекты
 * сохраняются. Декали объединяются только при includeDecals=true: у них общий
 * renderOrder, нет depthWrite и одинаковый материал, поэтому порядок внутри
 * непересекающихся плоскостей не влияет на изображение.
 */
export function mergeStaticMeshes(root, { includeDecals = false, binSize = 0 } = {}) {
  root.updateWorldMatrix(true, true);
  const rootInverse = root.matrixWorld.clone().invert();
  const groups = new Map();

  root.traverse((node) => {
    if (node === root || !node.isMesh || node.isInstancedMesh || !node.geometry || !node.material) return;
    if (Array.isArray(node.material) || node.visible === false || node.userData.dynamic) return;
    for (let p = node.parent; p && p !== root; p = p.parent) {
      if (p.userData.dynamic) return;
    }
    const material = node.material;
    const decal = includeDecals && node.userData.decal && material.alphaTest > 0 && !material.depthWrite;
    if (!decal && (material.transparent || material.opacity < 1 || material.alphaTest > 0)) return;
    const geometry = node.geometry;
    if (!geometry.attributes.position || Object.keys(geometry.morphAttributes || {}).length) return;

    const attributes = Object.keys(geometry.attributes).sort().map((name) => {
      const a = geometry.attributes[name];
      return `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
    }).join(',');
    const world = node.matrixWorld;
    const e = world.elements;
    const bin = binSize > 0 ? `${Math.floor(e[12] / binSize)}|${Math.floor(e[14] / binSize)}` : 'all';
    const key = [material.uuid, node.castShadow, node.receiveShadow, node.renderOrder,
      node.layers.mask, attributes, !!geometry.index, bin].join('|');
    let entries = groups.get(key);
    if (!entries) { entries = []; groups.set(key, entries); }
    entries.push(node);
  });

  let merged = 0;
  let mergeGroups = 0;
  for (const nodes of groups.values()) {
    if (nodes.length < 2) continue;
    const geometries = nodes.map((node) => {
      const relative = new THREE.Matrix4().multiplyMatrices(rootInverse, node.matrixWorld);
      return node.geometry.clone().applyMatrix4(relative);
    });
    let geometry = null;
    try { geometry = mergeGeometries(geometries, false); } catch (_) { /* несовместимая группа остаётся как есть */ }
    for (const clone of geometries) clone.dispose();
    if (!geometry) continue;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const first = nodes[0];
    const mesh = new THREE.Mesh(geometry, first.material);
    mesh.name = `static-merge-${mergeGroups}`;
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.layers.mask = first.layers.mask;
    mesh.userData.merged = true;
    root.add(mesh);
    for (const node of nodes) if (node.parent) node.parent.remove(node);
    merged += nodes.length - 1;
    mergeGroups++;
  }
  return { merged, mergeGroups, candidates: groups.size };
}
