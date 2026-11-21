# -*- coding: utf-8 -*-
"""Патч store.js: стелс-механика «Бедронки».
- сектор взгляда Людмилы на полу + медленное сканирование зала;
- паллеты с коробками как укрытия (блокируют линию взгляда);
- API stealth.sees(x,z) / setAlert(v);
- из якорей убраны hl у людей (контур больше не рисуется на Людмиле и Зосе).
"""
import io, sys

PATH = r'C:\Users\user\not-a-human-3d\src\store.js'
s = io.open(PATH, encoding='utf-8').read()
orig = s

def sub(old, new, label):
    global s
    if old not in s:
        print('MISS:', label)
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('ok:', label)

# 1. Холодильники — сплошные, за ними можно укрыться.
sub(
    "  colliders.push({ minX: -6.0, maxX: -2.9, minZ: -5.2, maxZ: -4.1 });",
    "  colliders.push({ minX: -6.0, maxX: -2.9, minZ: -5.2, maxZ: -4.1, blocksSight: true });",
    'fridge blocks sight'
)

# 2. Паллеты-укрытия после хлебной витрины.
anchor = """  colliders.push({ minX: 5.6, maxX: 6.45, minZ: 2.6, maxZ: 4.3 });
"""
add = """  colliders.push({ minX: 5.6, maxX: 6.45, minZ: 2.6, maxZ: 4.3 });

  // ---------- паллеты с коробками: за ними прячутся ----------
  // Магазин заставлен не только стеллажами: три штабеля дают реальные
  // укрытия. Они же блокируют линию взгляда Людмилы.
  const palletWood = pbrMat('Wood051', 1, 1, { color: 0x7d6a4e, normalScale: 0.55, roughness: 0.94 });
  const crateMatA = mat(0xb08a56, 0.82);
  const crateMatB = mat(0x8d7350, 0.86);
  const crateBand = mat(0x5c4a33, 0.9);
  const addPallet = (x, z, w, d) => {
    box(scene, w, 0.14, d, palletWood, x, 0.07, z);
    for (let i = 0; i < 3; i++) {
      const ww = w * (0.92 - i * 0.06);
      const dd = d * (0.92 - i * 0.05);
      const ox = i % 2 ? 0.03 : -0.02;
      const y = 0.21 + i * 0.44;
      box(scene, ww, 0.42, dd, i % 2 ? crateMatB : crateMatA, x + ox, y, z);
      box(scene, ww + 0.02, 0.045, dd + 0.02, crateBand, x + ox, y + 0.19, z, { cast: false });
      box(scene, 0.05, 0.42, dd + 0.025, crateBand, x + ox - ww / 2 + 0.05, y, z, { cast: false });
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, blocksSight: true });
  };
  addPallet(-3.9, 3.35, 1.25, 1.15);
  addPallet(1.55, 3.7, 1.05, 1.0);
  addPallet(-5.6, -0.6, 0.95, 1.7);
"""
sub(anchor, add, 'pallet cover')

# 3. Смотровой сектор и API — после света, перед update.
anchor2 = """  let t = 0;
  let poseTick = -1;
"""
add2 = """  // ---------- взгляд Людмилы ----------
  // Полупрозрачный сектор на полу — это не декор, а реальная зона обзора.
  // Людмила медленно переводит взгляд: пауза -> поворот -> пауза.
  const LYUD_X = 4.55, LYUD_Z = 0.75;
  const GAZE_HALF = 0.58;
  const GAZE_RANGE = 8.6;
  const GAZE_STOPS = [
    { yaw: 0.16, hold: 4.2 },   // смотрит на прилавок и вход
    { yaw: -0.55, hold: 2.6 },  // зал
    { yaw: -1.35, hold: 2.2 },  // середина
    { yaw: -2.05, hold: 3.8 },  // дальние стеллажи
    { yaw: -1.35, hold: 2.0 },
    { yaw: -0.55, hold: 3.0 }
  ];
  const gaze = {
    yaw: GAZE_STOPS[0].yaw, target: GAZE_STOPS[0].yaw,
    stop: 0, wait: GAZE_STOPS[0].hold, moving: false, alert: 0
  };
  const gazeGroup = new THREE.Group();
  gazeGroup.position.set(LYUD_X, 0.028, LYUD_Z);
  gazeGroup.userData.noHighlight = true;
  scene.add(gazeGroup);
  const gazeGeo = new THREE.CircleGeometry(GAZE_RANGE, 30, -GAZE_HALF, GAZE_HALF * 2);
  gazeGeo.rotateX(-Math.PI / 2);
  const gazeMat = new THREE.MeshBasicMaterial({
    color: 0xffdf9a, transparent: true, opacity: 0.10, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
  });
  const gazeMesh = new THREE.Mesh(gazeGeo, gazeMat);
  gazeMesh.renderOrder = 2;
  gazeMesh.userData.noHighlight = true;
  gazeGroup.add(gazeMesh);
  const GAZE_SAFE = new THREE.Color(0xffdf9a);
  const GAZE_DANGER = new THREE.Color(0xff5a3c);

  // Пересечение отрезка (взгляд) с прямоугольником укрытия.
  function segmentHitsBox(x1, z1, x2, z2, c) {
    const dx = x2 - x1, dz = z2 - z1;
    let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[x1, dx, c.minX, c.maxX], [z1, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) return false;
        continue;
      }
      const inv = 1 / d;
      let a = (lo - p) * inv, b = (hi - p) * inv;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return false;
    }
    return t0 > 0.02 && t1 < 0.98;
  }
  function blocksSight(x1, z1, x2, z2) {
    for (const c of colliders) {
      if (!c.blocksSight) continue;
      if (segmentHitsBox(x1, z1, x2, z2, c)) return true;
    }
    return false;
  }
  function sees(x, z) {
    const dx = x - LYUD_X, dz = z - LYUD_Z;
    if (dx * dx + dz * dz > GAZE_RANGE * GAZE_RANGE) return false;
    const ang = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(ang - gaze.yaw), Math.cos(ang - gaze.yaw));
    if (Math.abs(diff) > GAZE_HALF) return false;
    return !blocksSight(LYUD_X, LYUD_Z, x, z);
  }

  let t = 0;
  let poseTick = -1;
"""
sub(anchor2, add2, 'gaze sector + api')

# 4. update(): вместо покачивания — реальный поворот корпуса и сектора.
old_update = """    t += dt;
    if (lyudmilaRef.model) {
      lyudmilaRef.model.rotation.y = LYUD_YAW + Math.sin(t * 0.5) * 0.045;
      lyudmilaRef.model.position.y = (lyudmilaRef.baseY || 0) + Math.sin(t * 1.5) * 0.004;
    } else {
      resetPose(lyudmila);
      pose.idle(lyudmila, t * 0.8);
    }
"""
new_update = """    t += dt;
    // Сканирование зала: пауза -> медленный поворот -> пауза.
    if (gaze.moving) {
      const d = gaze.target - gaze.yaw;
      const step = 0.82 * dt;
      if (Math.abs(d) <= step) {
        gaze.yaw = gaze.target;
        gaze.moving = false;
        gaze.wait = GAZE_STOPS[gaze.stop].hold;
      } else {
        gaze.yaw += Math.sign(d) * step;
      }
    } else {
      gaze.wait -= dt;
      if (gaze.wait <= 0) {
        gaze.stop = (gaze.stop + 1) % GAZE_STOPS.length;
        gaze.target = GAZE_STOPS[gaze.stop].yaw;
        gaze.moving = true;
      }
    }
    gazeGroup.rotation.y = gaze.yaw - Math.PI / 2;
    gazeMat.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    gazeMat.opacity = 0.085 + gaze.alert * 0.15;
    if (lyudmilaRef.model) {
      lyudmilaRef.model.rotation.y = gaze.yaw;
      lyudmilaRef.model.position.y = (lyudmilaRef.baseY || 0) + Math.sin(t * 1.5) * 0.004;
    } else {
      resetPose(lyudmila);
      lyudmila.root.rotation.y = gaze.yaw;
      pose.idle(lyudmila, t * 0.8);
    }
"""
sub(old_update, new_update, 'gaze update')

# 5. Убираем контурные hl у живых людей из якорей.
sub(
    "      checkout: { x: 4.35, z: 2.55, r: 1.25, hl: [4.55, 0.6, 1.5, 3.0, 1.25, 0.85] },",
    "      checkout: { x: 4.35, z: 2.55, r: 1.3 },",
    'checkout anchor without hl'
)
sub(
    "      zosia: { x: 2.55, z: 2.75, r: 1.15, hl: [2.55, 0.95, 2.45, 0.8, 1.85, 0.7] },",
    "      zosia: { x: 2.55, z: 2.75, r: 1.2 },",
    'zosia anchor without hl'
)

# 6. API наружу.
sub(
    "  return {\n    scene, bounds, colliders, lyudmila, zosia, lyudmilaRef, targets,",
    "  return {\n    scene, bounds, colliders, lyudmila, zosia, lyudmilaRef, targets,\n    stealth: {\n      sees, range: GAZE_RANGE, half: GAZE_HALF,\n      eye: { x: LYUD_X, z: LYUD_Z },\n      setAlert(v) { gaze.alert = Math.max(0, Math.min(1, Number(v) || 0)); },\n      get yaw() { return gaze.yaw; },\n      get scanning() { return gaze.moving; }\n    },",
    'export stealth api'
)

if s == orig:
    print('nothing changed')
    sys.exit(1)
io.open(PATH, 'w', encoding='utf-8', newline='\n').write(s)
print('store.js patched, bytes:', len(s))