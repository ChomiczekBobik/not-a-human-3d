# -*- coding: utf-8 -*-
"""Сектор взгляда обрезается стенами и укрытиями.

Было: веер радиусом 8.6 м уходил сквозь стены и стеллажи, поэтому на полу
читалось просто светлое пятно, а не конус обзора. Теперь вершины веера
считаются по реальной дистанции до стены или укрытия, а боковые лучи
масштабируются до той же дистанции.
"""
import io, sys

PATH = 'src/store.js'
s = io.open(PATH, encoding='utf-8').read()
orig = s

def sub(old, new, label):
    global s
    n = s.count(old)
    if n == 0:
        print('MISS:', label)
        sys.exit(1)
    if n > 1:
        print('MULTI:', label, n)
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('ok:', label)

# ---------- 1. веер вместо круга ----------
old_fill = """  const gazeGeo = new THREE.CircleGeometry(GAZE_RANGE, 30, -GAZE_HALF, GAZE_HALF * 2);
  gazeGeo.rotateX(-Math.PI / 2);
  // Пол в «Бедронке» и так светлый: аддитивный блендинг выжигал его в белое.
  // Поэтому зона — мягкая янтарная тонировка, а читается она по кромке.
  const gazeMat = new THREE.MeshBasicMaterial({
    color: 0xe8b25a, transparent: true, opacity: 0.15, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });
  const gazeMesh = new THREE.Mesh(gazeGeo, gazeMat);
  gazeMesh.renderOrder = 2;
  gazeMesh.userData.noHighlight = true;
  gazeGroup.add(gazeMesh);
"""
new_fill = """  // Сектор — не просто веер на полу: он обрезается стенами и укрытиями.
  // Иначе свет уходил бы сквозь стеллажи и стены и читался как пятно.
  const FAN_SEG = 40;
  const fanPos = new Float32Array((FAN_SEG + 2) * 3);
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPos, 3));
  const fanIndex = [];
  for (let i = 0; i < FAN_SEG; i++) fanIndex.push(0, i + 1, i + 2);
  fanGeo.setIndex(fanIndex);
  // Пол в «Бедронке» и так светлый: аддитивный блендинг выжигал его в белое.
  // Поэтому зона — мягкая янтарная тонировка.
  const gazeMat = new THREE.MeshBasicMaterial({
    color: 0xe8b25a, transparent: true, opacity: 0.15, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });
  const gazeMesh = new THREE.Mesh(fanGeo, gazeMat);
  gazeMesh.frustumCulled = false;
  gazeMesh.renderOrder = 2;
  gazeMesh.userData.noHighlight = true;
  gazeGroup.add(gazeMesh);
"""
sub(old_fill, new_fill, 'gaze fan fill')

# ---------- 2. только лучи, край-дуга уходит ----------
a = s.find('  // Кромка сектора: дуга по дальнему краю')
b = s.find('  // Пятно у ног: тёплый круг')
assert a != -1 and b != -1 and a < b, 'rays block not found'
old_rays = s[a:b]
new_rays = """  // Лучи по краям сектора: именно они читаются на светлом полу.
  // Длина луча упирается в первую стену или укрытие.
  const RAY_W = 0.12;
  const rayGeo = new THREE.PlaneGeometry(1, RAY_W);
  rayGeo.translate(0.5, 0, 0);
  rayGeo.rotateX(-Math.PI / 2);
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0x9a6620, transparent: true, opacity: 0.26, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });
  const gazeRays = [];
  for (const side of [-1, 1]) {
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.rotation.y = GAZE_HALF * side;
    ray.position.y = 0.002;
    ray.renderOrder = 3;
    ray.userData.noHighlight = true;
    gazeGroup.add(ray);
    gazeRays.push(ray);
  }

"""
s = s[:a] + new_rays + s[b:]
print('ok: gaze side rays')

# ---------- 3. обрезка по стенам и укрытиям ----------
old_sees = """  function sees(x, z) {
"""
new_sees = """  // Насколько далеко достаёт взгляд в направлении angle: ближайшая стена
  // зала или укрытие с blocksSight.
  function rayBoxDistance(x, z, dx, dz, c) {
    let t0 = 0, t1 = Infinity;
    for (const [p, d, lo, hi] of [[x, dx, c.minX, c.maxX], [z, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) return Infinity;
        continue;
      }
      const inv = 1 / d;
      let a = (lo - p) * inv, b = (hi - p) * inv;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return Infinity;
    }
    return t0 > 0.04 ? t0 : Infinity;
  }
  function gazeReach(angle) {
    const dx = Math.sin(angle), dz = Math.cos(angle);
    let reach = GAZE_RANGE;
    let wall = Infinity;
    if (dx > 1e-6) wall = Math.min(wall, (bounds.maxX - LYUD_X) / dx);
    else if (dx < -1e-6) wall = Math.min(wall, (bounds.minX - LYUD_X) / dx);
    if (dz > 1e-6) wall = Math.min(wall, (bounds.maxZ - LYUD_Z) / dz);
    else if (dz < -1e-6) wall = Math.min(wall, (bounds.minZ - LYUD_Z) / dz);
    if (wall < reach) reach = wall;
    for (const c of colliders) {
      if (!c.blocksSight) continue;
      const hit = rayBoxDistance(LYUD_X, LYUD_Z, dx, dz, c);
      if (hit < reach) reach = hit;
    }
    return Math.max(0.5, reach - 0.04);
  }
  function refreshGazeShape() {
    let o = 0;
    fanPos[o++] = 0; fanPos[o++] = 0; fanPos[o++] = 0;
    for (let i = 0; i <= FAN_SEG; i++) {
      const a = -GAZE_HALF + (GAZE_HALF * 2) * (i / FAN_SEG);
      const d = gazeReach(gaze.yaw + a);
      fanPos[o++] = Math.cos(a) * d;
      fanPos[o++] = 0;
      fanPos[o++] = -Math.sin(a) * d;
    }
    fanGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      gazeRays[i].scale.x = gazeReach(gaze.yaw + GAZE_HALF * side);
    }
  }
  function sees(x, z) {
"""
sub(old_sees, new_sees, 'gaze reach + refresh')

# ---------- 4. update(): перестроить форму, убрать старые материалы ----------
old_up = """    gazeGroup.rotation.y = gaze.yaw - Math.PI / 2;
    gazeMat.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    gazeMat.opacity = 0.2 + gaze.alert * 0.16;
    gazeEdgeMat.color.copy(GAZE_EDGE_SAFE).lerp(GAZE_EDGE_DANGER, gaze.alert);
    gazeEdgeMat.opacity = 0.5 + gaze.alert * 0.4
      + (gaze.moving ? 0.06 : 0) + Math.sin(t * 2.6) * 0.035;
    bandMat.color.copy(GAZE_EDGE_SAFE).lerp(GAZE_EDGE_DANGER, gaze.alert);
    bandMat.opacity = 0.26 + gaze.alert * 0.3 + Math.sin(t * 2.6) * 0.03;
    rayMat.color.copy(GAZE_EDGE_SAFE).lerp(GAZE_EDGE_DANGER, gaze.alert);
    rayMat.opacity = 0.2 + gaze.alert * 0.26;
"""
new_up = """    gazeGroup.rotation.y = gaze.yaw - Math.PI / 2;
    refreshGazeShape();
    gazeMat.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    gazeMat.opacity = 0.24 + gaze.alert * 0.18 + Math.sin(t * 2.6) * 0.012;
    rayMat.color.copy(GAZE_EDGE_SAFE).lerp(GAZE_EDGE_DANGER, gaze.alert);
    rayMat.opacity = 0.42 + gaze.alert * 0.34 + (gaze.moving ? 0.05 : 0)
      + Math.sin(t * 2.6) * 0.03;
"""
sub(old_up, new_up, 'gaze update')

if s == orig:
    print('nothing changed')
    sys.exit(1)

io.open(PATH, 'w', encoding='utf-8', newline='\n').write(s)
print('store.js bytes:', len(s.encode('utf-8')))