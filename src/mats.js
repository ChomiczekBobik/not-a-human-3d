// mats.js — кэш текстур и общие материалы. Текстуры лежат в assets/tex (PIL).
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();
const matCache = new Map();   // переиспользование материалов: меньше программ/батчей
const matTexCache = new Map();
const pbrCache = new Map();
const planeGeoCache = new Map(); // общие геометрии плоскостей

/** Загрузить текстуру с повтором. srgb=false для карт шероховатости/нормалей. */
export function tex(path, rx = 1, ry = 1, srgb = true) {
  const key = `${path}|${rx}|${ry}|${srgb}`;
  if (cache.has(key)) return cache.get(key);
  const t = loader.load(path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 2; // 4x на встроенной графике не окупается — только жрёт bandwidth
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Простой стандартный материал. Одноцветные вызовы с одинаковыми аргументами
 *  переиспользуют один материал — это напрямую множит эффект батчера. */
export function mat(color, rough = 0.9, extra = {}) {
  if (!extra || Object.keys(extra).length === 0) {
    const key = `${color}|${rough}`;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.0 });
      matCache.set(key, m);
    }
    return m;
  }
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.0, ...extra });
}

/** Материал с текстурой. extra.bump — сила рельефа (bumpMap из той же текстуры). */
export function matTex(path, rx, ry, color = 0xffffff, rough = 0.92, extra = {}) {
  const key = `${path}|${rx}|${ry}|${color}|${rough}|${JSON.stringify(extra)}`;
  const cached = matTexCache.get(key);
  if (cached) return cached;
  const { bump = 0, ...rest } = extra;
  const params = { color, roughness: rough, metalness: 0.0, map: tex(path, rx, ry), ...rest };
  if (bump > 0) {
    params.bumpMap = tex(path, rx, ry, false);
    params.bumpScale = bump;
  }
  const m = new THREE.MeshStandardMaterial(params);
  matTexCache.set(key, m);
  return m;
}

/** ambientCG PBR-материал из локальных 1K JPG-карт.
 * options — overrides для MeshStandardMaterial; числовой normalScale задаёт обе оси. */
export function pbrMat(asset, rx, ry, options = {}) {
  // Одинаковые PBR-наборы реально делят материал: меньше программ, памяти и
  // исходных мешей для батчера. Texture/Vector2 сериализуем по смыслу, а не в JSON.
  const optionKey = Object.keys(options).sort().map((key) => {
    const value = options[key];
    if (value && value.isTexture) return `${key}:texture:${value.uuid}`;
    if (value && value.isVector2) return `${key}:vector:${value.x},${value.y}`;
    if (value && value.isColor) return `${key}:color:${value.getHex()}`;
    if (value && typeof value === 'object') return `${key}:${JSON.stringify(value)}`;
    return `${key}:${String(value)}`;
  }).join('|');
  const cacheKey = `${asset}|${rx}|${ry}|${optionKey}`;
  const cached = pbrCache.get(cacheKey);
  if (cached) return cached;

  const base = `assets/tex/pbr/${asset}_1K-JPG`;
  const isMetal = asset === 'Metal032';
  const { normalScale = 0.8, ...overrides } = options;
  const params = {
    color: 0xffffff,
    map: tex(`${base}_Color.jpg`, rx, ry, true),
    normalMap: tex(`${base}_NormalGL.jpg`, rx, ry, false),
    normalScale: typeof normalScale === 'number'
      ? new THREE.Vector2(normalScale, normalScale)
      : normalScale,
    roughness: 1.0,
    roughnessMap: tex(`${base}_Roughness.jpg`, rx, ry, false),
    metalness: isMetal ? 1.0 : 0.0,
    ...overrides,
  };

  // У Metal032 карта обязательна даже при overrides; остальные заданные материалы неметаллы.
  if (isMetal) {
    params.metalnessMap = tex(`${base}_Metalness.jpg`, rx, ry, false);
  } else if (asset === 'Wood051' || asset === 'Concrete034') {
    params.metalness = 0.0;
  }
  const material = new THREE.MeshStandardMaterial(params);
  pbrCache.set(cacheKey, material);
  return material;
}

/** Диагностика фактического переиспользования ресурсов в browser QA. */
export function materialStats() {
  return {
    textures: cache.size,
    plainMaterials: matCache.size,
    texturedMaterials: matTexCache.size,
    pbrMaterials: pbrCache.size,
    planeGeometries: planeGeoCache.size
  };
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

/** Быстрый бокс: размеры + позиция + материал. */
export function box(scene, w, h, d, m, x, y, z, opts = {}) {
  const mesh = new THREE.Mesh(boxGeo, m);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.rz) mesh.rotation.z = opts.rz;
  scene.add(mesh);
  return mesh;
}

/** Плоский прямоугольник (постер, ценник, экран). Геометрия кэшируется по размеру. */
export function plane(scene, w, h, m, x, y, z, ry = 0, rx = 0) {
  const gkey = `${w}|${h}`;
  let geo = planeGeoCache.get(gkey);
  if (!geo) {
    geo = new THREE.PlaneGeometry(w, h);
    planeGeoCache.set(gkey, geo);
  }
  const p = new THREE.Mesh(geo, m);
  p.position.set(x, y, z);
  p.rotation.set(rx, ry, 0);
  scene.add(p);
  return p;
}
