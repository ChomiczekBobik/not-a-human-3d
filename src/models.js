// models.js — единый загрузчик GLB для игры (кэш, прогресс, посадка на пол).
// Используется для гостей и посетителей, если владелец присылает модели.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map(); // url -> Promise<gltf>

/** Загрузить GLB с кэшированием. Возвращает gltf (scene, animations). */
export function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url).catch((e) => {
      cache.delete(url);
      throw e;
    }));
  }
  return cache.get(url);
}

/** Посадить объект на пол, при необходимости масштабировать до targetH метров. */
export function groundAndScale(object, targetH = 1.75) {
  const wrap = new THREE.Group();
  wrap.add(object);
  if (targetH) {
    const box = new THREE.Box3().setFromObject(object);
    const h = box.getSize(new THREE.Vector3()).y;
    if (h > 0.01) wrap.scale.setScalar(targetH / h);
  }
  wrap.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(wrap);
  wrap.position.y -= b.min.y;
  return wrap;
}

/** Включить тени у всех мешей модели. */
export function enableShadows(object, cast = true) {
  object.traverse((n) => {
    if (n.isMesh) { n.castShadow = cast; n.receiveShadow = true; }
  });
}

/** Освободить модель (геометрия + материалы). */
export function disposeModel(root) {
  root.traverse((n) => {
    if (n.isMesh) {
      n.geometry.dispose();
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      for (const m of mats) {
        for (const key of Object.keys(m)) {
          const v = m[key];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    }
  });
  if (root.parent) root.parent.remove(root);
}
