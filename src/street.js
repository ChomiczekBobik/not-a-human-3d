// street.js — улица Велички: ядерный снег, руины, бочка с огнём, светящаяся «БЕДРОНКА» в конце.
import * as THREE from 'three';
import { mat, matTex, box, plane, tex } from './mats.js';
import { batchStaticMeshes } from './static_batch.js';
import { buildLyceumStreet } from './lyceum.js';

export function createStreet() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141e30);
  scene.fog = new THREE.FogExp2(0x1a2434, 0.032);

  const bounds = { minX: -2.6, maxX: 2.6, minZ: -66.5, maxZ: 2.5 };
  const colliders = [];

  // ---------- земля и дорога ----------
  const snowMat = matTex('assets/tex/snow.jpg', 6, 40, 0xcfd6e2, 0.95, { bump: 0.016 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 76), snowMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -31);
  ground.receiveShadow = true;
  scene.add(ground);
  // утоптанная тропа — темнее
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 76), matTex('assets/tex/snow.jpg', 1, 40, 0x9aa2b2, 0.98, { bump: 0.012 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.004, -31);
  path.receiveShadow = true;
  scene.add(path);

  // ---------- дом Хомки позади ----------
  const homeMat = matTex('assets/tex/wall_plaster_home.jpg', 2, 1.6, 0x6a655e, 0.95, { bump: 0.01 });
  box(scene, 7, 3.4, 0.4, homeMat, 0, 1.7, 3.2);
  // подъезд
  box(scene, 1.4, 2.3, 0.5, mat(0x2c2824, 0.9), 0, 1.15, 2.95);
  box(scene, 1.0, 2.0, 0.1, mat(0x241f1a, 0.8), 0, 1.0, 2.7, { cast: false });
  // тёплый свет над дверью
  const porchLight = new THREE.PointLight(0xffa050, 6, 7, 2);
  porchLight.position.set(0, 2.3, 2.5);
  scene.add(porchLight);
  const porchShade = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc080, emissive: 0xffa050, emissiveIntensity: 3 }));
  porchShade.position.set(0, 2.3, 2.55);
  scene.add(porchShade);
  // меловой крест на доме (появляется с 4-го дня — включает game)
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/chalk_cross.png'), transparent: true, roughness: 1, depthWrite: false }));
  cross.position.set(-0.9, 1.1, 2.99);
  cross.visible = false;
  scene.add(cross);
  // забитые досками соседские двери
  const boardMat = matTex('assets/tex/wood_dark.jpg', 1, 0.4, 0x6a5540, 0.9);
  box(scene, 1.3, 2.2, 0.2, mat(0x241f1a, 0.85), -2.4, 1.1, 3.2);
  for (const [ry, by] of [[0.35, 1.4], [-0.3, 0.9], [0.2, 1.9]]) {
    const b = box(scene, 1.5, 0.18, 0.06, boardMat, -2.4, by, 3.32);
    b.rotation.z = ry;
  }
  // обгоревшая машина силуэтом
  const carMat = mat(0x1c1e20, 0.5, { metalness: 0.4 });
  box(scene, 1.7, 0.5, 3.4, carMat, 2.4, 0.45, -10);
  box(scene, 1.6, 0.45, 1.7, carMat, 2.4, 0.9, -10.4);
  for (const [wx, wz] of [[1.6, -8.7], [3.2, -8.7], [1.6, -11.3], [3.2, -11.3]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12), mat(0x0e0f11, 0.7));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.3, wz);
    wheel.castShadow = true;
    scene.add(wheel);
  }
  colliders.push({ minX: 1.4, maxX: 3.4, minZ: -11.9, maxZ: -9.0 });

  // ---------- руины и дома по сторонам ----------
  const ruinMats = [
    matTex('assets/tex/wall_plaster_cold.jpg', 2, 1, 0x4e5560, 0.95, { bump: 0.01 }),
    matTex('assets/tex/wall_plaster_cold.jpg', 2, 1, 0x3e444e, 0.95, { bump: 0.01 }),
    matTex('assets/tex/wall_plaster_home.jpg', 2, 1, 0x565049, 0.95, { bump: 0.01 })
  ];
  // Окна: рама, крестовина и подоконник нарисованы в текстуре — ноль лишних мешей
  // на фасаде. Три состояния: светлое, тёмное, забитое досками.
  const windowLit = new THREE.MeshStandardMaterial({
    map: tex('assets/tex/win_lit.png'),
    emissive: 0xffc878, emissiveMap: tex('assets/tex/win_lit.png'),
    emissiveIntensity: 1.2, roughness: 0.5
  });
  const windowDead = matTex('assets/tex/win_dead.png', 1, 1, 0xb0b6c0, 0.45);
  const windowBoard = matTex('assets/tex/win_board.png', 1, 1, 0xa8a49a, 0.9);
  // «телевизор» за окном: единственное живое окно на сторону
  const tvMat = new THREE.MeshStandardMaterial({ color: 0x0a0c12, emissive: 0x8fa8d8, emissiveIntensity: 1.3, roughness: 0.4 });
  // антураж фасадов: карниз, цоколь, подъезд с козырьком и номером, трубы, антенны
  const corniceMat = mat(0x8a8e96, 0.88);
  const plinthMat = mat(0x3a3d44, 0.95);
  const houseDoorMat = mat(0x25282e, 0.9);
  const canopyMat = mat(0x3c4048, 0.9);
  const plaqueMat = new THREE.MeshStandardMaterial({ color: 0x101418, emissive: 0x9ab8e8, emissiveIntensity: 1.05, roughness: 0.6 });
  const antennaMat = mat(0x2a2d33, 0.6, { metalness: 0.5 });
  const winGeo = new THREE.PlaneGeometry(0.55, 0.75);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let houseIdx = 0;
  for (const side of [-1, 1]) {
    let z = -4;
    while (z > -64) {
      const w = 5 + rnd() * 5;
      // двор лицея занимает правую сторону z −14.5..−30.5: дома туда не ставим
      if (side === 1 && z > -30.5 && z - w < -14.5) { z = -32.2; continue; }
      const h = 2.5 + rnd() * 4.5;
      const d = 2.5 + rnd() * 2;
      const x = side * (4.6 + rnd() * 1.6);
      const m = ruinMats[Math.floor(rnd() * 3)];
      const b = box(scene, d, h, w, m, x, h / 2, z - w / 2);
      if (rnd() < 0.4) b.rotation.z = side * (rnd() - 0.5) * 0.06; // лёгкий завал
      const fx = x - side * (d / 2 + 0.02); // плоскость фасада к улице
      // карниз и цоколь: силуэт перестаёт быть голой коробкой, верх читается на фоне неба
      box(scene, 0.16, 0.14, w + 0.1, corniceMat, fx - side * 0.02, h - 0.07, z - w / 2, { cast: false });
      box(scene, 0.1, 0.4, w + 0.06, plinthMat, fx - side * 0.01, 0.2, z - w / 2, { cast: false });
      // труба/антенна на крыше — рваный силуэт
      if (rnd() < 0.6) {
        box(scene, 0.5, 0.9 + rnd() * 0.6, 0.5, plinthMat,
          x + (rnd() - 0.5) * d * 0.5, h + 0.5, z - w * (0.2 + rnd() * 0.5));
      }
      if (rnd() < 0.35) {
        const ax = x + (rnd() - 0.5) * d * 0.6, az = z - w * (0.2 + rnd() * 0.6);
        box(scene, 0.03, 1.4, 0.03, antennaMat, ax, h + 0.7, az, { cast: false });
        box(scene, 0.5, 0.03, 0.03, antennaMat, ax, h + 1.2, az, { cast: false });
      }
      // подъезд с козырьком и светящимся номером дома — тёплая точка на тёмном фасаде
      if (houseIdx % 3 === 0) {
        const dz = z - w * (0.3 + rnd() * 0.4);
        box(scene, 0.08, 2.0, 0.95, houseDoorMat, fx - side * 0.04, 1.0, dz, { cast: false });
        box(scene, 0.55, 0.07, 1.3, canopyMat, fx - side * 0.3, 2.3, dz);
        plane(scene, 0.34, 0.16, plaqueMat, fx - side * 0.03, 2.6, dz, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      // окна
      const floors = Math.floor(h / 2.2);
      const cols = Math.floor(w / 1.6);
      for (let f = 0; f < floors; f++) {
        for (let cw = 0; cw < cols; cw++) {
          const roll = rnd();
          const isTV = (side === 1 && houseIdx === 1 && f === 0 && cw === 1)
            || (side === -1 && houseIdx === 4 && f === 1 && cw === 0);
          const lit = roll < 0.17;
          const wm = isTV ? tvMat : lit ? windowLit : (roll > 0.9 ? windowBoard : windowDead);
          const win = new THREE.Mesh(winGeo, wm);
          win.position.set(fx, 1.4 + f * 2.2, z - 0.9 - cw * 1.6);
          win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          scene.add(win);
        }
      }
      // обломки у подножия
      if (rnd() < 0.5) box(scene, 0.8 + rnd(), 0.5, 0.8 + rnd(), m, side * 3.2, 0.25, z - rnd() * w);
      houseIdx++;
      z -= w + 1.2 + rnd() * 3;
    }
  }

  // ---------- фонари ----------
  // Световой пул: всего 2 PointLight на 3 фонаря. Огни «перепрыгивают» на два
  // ближайших к игроку столба — на экране разницы нет, а тяжёлых источников меньше.
  const lampPool = [0, 1].map(() => {
    const l = new THREE.PointLight(0x8fb0e0, 12, 13, 2);
    scene.add(l);
    return l;
  });
  const lampPosts = [];
  for (const lz of [-8, -26, -46]) {
    box(scene, 0.12, 4.4, 0.12, mat(0x2a2d33, 0.6, { metalness: 0.5 }), -2.3, 2.2, lz);
    box(scene, 0.9, 0.1, 0.1, mat(0x2a2d33, 0.6, { metalness: 0.5 }), -1.95, 4.4, lz);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x88a0c0, emissive: 0x8fb0e0, emissiveIntensity: 1.6 }));
    head.position.set(-1.6, 4.32, lz);
    scene.add(head);
    lampPosts.push({ x: -1.6, y: 4.1, z: lz, head, flicker: Math.random() * 10 });
    colliders.push({ minX: -2.45, maxX: -2.15, minZ: lz - 0.15, maxZ: lz + 0.15 });
  }
  // Пятна света фонарей на снегу (additive-плоскости): снег перестаёт быть чёрным
  // даже там, где реального PointLight нет — пул из двух источников на три столба.
  const lampGlowMat = new THREE.MeshBasicMaterial({
    map: tex('assets/tex/glow_spill.png'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  for (const lz of [-8, -26, -46]) {
    plane(scene, 4.4, 4.4, lampGlowMat, -1.6, 0.016, lz, 0, -Math.PI / 2);
  }

  // ---------- бочка с огнём (середина пути) ----------
  const barrelZ = -33;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.32, 0.95, 14), mat(0x5a3a28, 0.7, { metalness: 0.4 }));
  barrel.position.set(1.6, 0.48, barrelZ);
  barrel.castShadow = true;
  scene.add(barrel);
  colliders.push({ minX: 1.2, maxX: 2.0, minZ: barrelZ - 0.45, maxZ: barrelZ + 0.45 });
  const fire = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 - i * 0.008, 0.3 + Math.random() * 0.25, 6),
      new THREE.MeshStandardMaterial({
        color: 0xff9030, emissive: 0xff7010, emissiveIntensity: 3.2,
        transparent: true, opacity: 0.9
      }));
    f.position.set((Math.random() - 0.5) * 0.3, 1.05 + Math.random() * 0.15, barrelZ + (Math.random() - 0.5) * 0.3 - (barrelZ - barrelZ));
    f.position.z = barrelZ + (Math.random() - 0.5) * 0.3;
    fire.add(f);
  }
  fire.position.set(1.6, 0, 0);
  scene.add(fire);
  const fireLight = new THREE.PointLight(0xff8020, 14, 10, 2);
  fireLight.position.set(1.6, 1.5, barrelZ);
  scene.add(fireLight);

  // ---------- ЛИЦЕЙ «ВЕЛИЧКА» (правая сторона, двор z −14.5..−30.5) ----------
  // Сюда герой пойдёт учиться со второго дня — здание отдельным модулем, интерьер
  // того дня будет собираться в lyceum.js.
  const lyc = buildLyceumStreet(scene);

  // ---------- «БЕДРОНКА» в конце ----------
  const storeZ = -68;
  const storeWall = matTex('assets/tex/wall_store.jpg', 3, 1.4, 0xb8b4a8, 0.9);
  box(scene, 11, 4.2, 0.5, storeWall, 0, 2.1, storeZ - 0.5);
  // витрины: тёплый свет изнутри
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x201a10, emissive: 0xffd890, emissiveIntensity: 1.5, roughness: 0.1, metalness: 0.2 });
  for (const gx of [-3.2, -1.4, 1.4, 3.2]) {
    plane(scene, 1.5, 1.7, glassMat, gx, 1.35, storeZ - 0.23, 0);
  }
  // вход
  box(scene, 1.3, 2.3, 0.3, mat(0x2a2c30, 0.5), 0, 1.15, storeZ - 0.2);
  // вывеска
  const sign = plane(scene, 6.5, 1.6,
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/sign_biedronka.png'), emissive: 0xffffff, emissiveMap: tex('assets/tex/sign_biedronka.png'), emissiveIntensity: 0.9, roughness: 0.6 }),
    0, 3.4, storeZ - 0.2, 0);
  // один источник вместо двух (вывеска + дверь): минус PointLight в шейдере всех материалов улицы
  const storeLight = new THREE.PointLight(0xffd890, 12, 16, 2);
  storeLight.position.set(0, 2.4, storeZ + 0.9);
  scene.add(storeLight);

  // ---------- снег ----------
  // GPU-снег: позиция считается в вершинном шейдере по uTime.
  // Ноль работы CPU в кадре (раньше — 1200 частиц * 30 Гц на JS + upload буфера).
  const N = 1200;
  const pos = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  const phase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = Math.random() * 7;
    pos[i * 3 + 2] = 4 - Math.random() * 76;
    speed[i] = 1.1 + Math.random() * 1.2;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  snowGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  snowGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const snowFxMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: window.innerHeight * (window.devicePixelRatio || 1) * 0.5 },
      uColor: { value: new THREE.Color(0xd8e2f0) },
      uOpacity: { value: 0.85 }
    },
    vertexShader: `
      attribute float aSpeed;
      attribute float aPhase;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * aSpeed, 7.0);
        p.x += sin(uTime * 0.9 + aPhase) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(0.038 * uScale / -mv.z, 1.0, 14.0);
        vA = 0.6 + 0.4 * sin(aPhase * 7.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.28, d) * uOpacity * vA;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor, a);
      }`
  });
  const snow = new THREE.Points(snowGeo, snowFxMat);
  snow.frustumCulled = false; // частицы пересчитываются в шейдере, bounding sphere неактуальна
  scene.add(snow);

  // общее холодное освещение
  scene.add(new THREE.HemisphereLight(0x6680a8, 0x1a1c20, 2.3));
  const moonLight = new THREE.DirectionalLight(0x7a92b8, 0.95);
  moonLight.position.set(-6, 12, -20);
  scene.add(moonLight);
  const fill = new THREE.PointLight(0x8fb0e0, 12, 30, 1.6);
  fill.position.set(0, 6, -18);
  scene.add(fill);

  // ---------- батчинг статики: руины/фонари/дома -> инстансы ----------
  batchStaticMeshes(scene, [fire]);

  // ---------- обновление ----------
  let t = 0;
  function update(dt, camera) {
    t += dt;
    // снег целиком на GPU
    snowFxMat.uniforms.uTime.value = t;
    snowFxMat.uniforms.uScale.value = window.innerHeight * (window.devicePixelRatio || 1) * 0.5;
    // огонь бочки
    fire.children.forEach((f, i) => {
      f.scale.y = 0.8 + Math.sin(t * 11 + i * 1.7) * 0.3 + Math.sin(t * 23 + i) * 0.15;
      f.rotation.y = t * (0.6 + i * 0.2);
    });
    fireLight.intensity = 13 + Math.sin(t * 9.7) * 2.5 + Math.sin(t * 27.3) * 1.2;
    // световой пул фонарей: два ближайших к игроку столба получают реальные PointLight
    let i1 = 0, i2 = Math.min(1, lampPosts.length - 1);
    if (camera) {
      const pz = camera.position.z;
      let d1 = Infinity, d2 = Infinity;
      for (let i = 0; i < lampPosts.length; i++) {
        const d = Math.abs(lampPosts[i].z - pz);
        if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = i; }
        else if (d < d2) { d2 = d; i2 = i; }
      }
    }
    for (let i = 0; i < lampPosts.length; i++) {
      const o = lampPosts[i];
      const on = i === 2 ? (Math.sin(t * 2.9 + o.flicker) > -0.2 ? 1 : 0.15) : 1;
      o.head.material.emissiveIntensity = 1.6 * on;
      const pool = i === i1 ? lampPool[0] : (i === i2 ? lampPool[1] : null);
      if (pool) {
        pool.position.set(o.x, o.y, o.z);
        pool.intensity = 12 * on * (0.92 + Math.sin(t * 31 + o.flicker) * 0.08);
      }
    }
    // вывеска подмигивает
    const sf = Math.sin(t * 0.7) > -0.92 ? 1 : 0.4;
    sign.material.emissiveIntensity = 0.9 * sf;
    storeLight.intensity = 12 * sf;
    porchLight.intensity = 6 + Math.sin(t * 5.1) * 0.4;
    // «телевизор» за окном: рваное мерцание, сцены меняются
    tvMat.emissiveIntensity = 1.1 + Math.abs(Math.sin(t * 7.3)) * 0.7 + Math.sin(t * 31.0) * 0.15;
    // лицей: вывеска и лампа над входом дышат еле заметно
    lyc.signMat.emissiveIntensity = 0.85 + Math.sin(t * 1.7) * 0.03;
    lyc.porchMat.emissiveIntensity = 2.2 + Math.sin(t * 9.3) * 0.25;
  }

  return {
    scene, bounds, colliders, cross,
    anchors: {
      toHome: { x: 0, z: 2.2 },
      toStore: { x: 0, z: -66.0 },
      barrel: { x: 1.6, z: barrelZ, r: 3.2 },
      // калитка лицея: сюда придёт переход «второй день → школа»
      lyceum: { x: 2.3, z: lyc.gateZ, r: 3.4 }
    },
    update
  };
}
