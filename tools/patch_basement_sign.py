# -*- coding: utf-8 -*-
"""Явный вход в подвал: исправленная фурнитура на лицевой стороне двери,
тёплая лампа, табличка «ПОДВАЛ ↓ ВНИЗ» и стрелка на полу."""
import io, sys

P = r'C:\Users\user\not-a-human-3d\src\home.js'
s = io.open(P, encoding='utf-8').read()

old = """  const bHandle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), metal);
  bHandle.position.set(bx + 0.28, 1.0, bz + 0.08);
  scene.add(bHandle);
  // ступеньки на стене? нет — табличка и крюк с ключом
  box(scene, 0.3, 0.12, 0.015, mat(0x3a3c40, 0.8), bx, 1.95, bz + 0.06, { cast: false });
"""
new = """  // Фурнитура — на лицевой стороне (игрок подходит из комнаты, z < bz).
  const bHandle = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), metal);
  bHandle.position.set(bx + 0.28, 1.0, bz - 0.07);
  scene.add(bHandle);
  box(scene, 0.22, 0.03, 0.02, metal, bx + 0.28, 1.0, bz - 0.052, { cast: false });
  box(scene, 0.1, 0.16, 0.02, blackMetal, bx + 0.28, 0.48, bz - 0.052, { cast: false });
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8), mat(0x1a1a18, 0.4, { metalness: 0.5 }));
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(bx + 0.28, 1.06, bz - 0.06);
  scene.add(keyhole);

  // Тёплая лампа над дверью: единственный жёлтый свет в этой части коридора,
  // поэтому вход видно сразу.
  const cellarLamp = new THREE.PointLight(0xffc783, 5.5, 5.2, 2);
  cellarLamp.position.set(bx + 0.05, 2.12, bz - 0.5);
  scene.add(cellarLamp);
  const cellarBulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff3d4, emissive: 0xffb95e, emissiveIntensity: 2.6, roughness: 0.4 }));
  cellarBulb.position.set(bx + 0.05, 2.2, bz - 0.5);
  scene.add(cellarBulb);
  const cellarCord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.34, 6), mat(0x241f1a, 0.9));
  cellarCord.position.set(bx + 0.05, 2.42, bz - 0.5);
  scene.add(cellarCord);
  const cellarShade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a332a, roughness: 0.7, metalness: 0.25, side: THREE.DoubleSide }));
  cellarShade.position.set(bx + 0.05, 2.27, bz - 0.5);
  scene.add(cellarShade);

  // Табличка на стене над дверью — читается издалека.
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512; signCanvas.height = 200;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#d9cca6'; sctx.fillRect(0, 0, 512, 200);
  sctx.strokeStyle = '#3a3126'; sctx.lineWidth = 14; sctx.strokeRect(7, 7, 498, 186);
  sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillStyle = '#2b2318'; sctx.font = 'bold 78px sans-serif';
  sctx.fillText('ПОДВАЛ', 256, 66);
  sctx.fillStyle = '#8a3a2a'; sctx.font = 'bold 58px sans-serif';
  sctx.fillText('↓ ВНИЗ', 256, 142);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = plane(scene, 0.62, 0.24, new THREE.MeshStandardMaterial({
    map: signTex, roughness: 0.62, emissive: 0x2a1f10, emissiveIntensity: 0.55
  }), bx, 2.3, bz - 0.045, Math.PI);
  sign.renderOrder = 1;

  // Стрелка на полу ведёт от кухни к двери.
  const arrowCanvas = document.createElement('canvas');
  arrowCanvas.width = 128; arrowCanvas.height = 256;
  const actx = arrowCanvas.getContext('2d');
  actx.clearRect(0, 0, 128, 256);
  actx.fillStyle = 'rgba(236, 222, 178, 0.62)';
  actx.textAlign = 'center'; actx.textBaseline = 'middle';
  actx.font = 'bold 34px sans-serif';
  actx.fillText('ВНИЗ', 64, 42);
  actx.lineWidth = 17;
  actx.strokeStyle = 'rgba(236, 222, 178, 0.62)';
  actx.beginPath(); actx.moveTo(64, 86); actx.lineTo(64, 186); actx.stroke();
  actx.beginPath(); actx.moveTo(30, 156); actx.lineTo(64, 206); actx.lineTo(98, 156);
  actx.lineWidth = 17; actx.lineJoin = 'round'; actx.lineCap = 'round'; actx.stroke();
  const arrowTex = new THREE.CanvasTexture(arrowCanvas);
  arrowTex.colorSpace = THREE.SRGBColorSpace;
  const floorArrow = plane(scene, 0.5, 1.0, new THREE.MeshBasicMaterial({
    map: arrowTex, transparent: true, opacity: 0.6, depthWrite: false
  }), bx, 0.016, 1.98, 0, -Math.PI / 2);
  floorArrow.renderOrder = 1;
  floorArrow.userData.noHighlight = true;

  // Ключ на гвозде сбоку от двери.
  const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.007, 6, 12), metal);
  keyRing.position.set(bx - 0.56, 1.6, bz - 0.05);
  scene.add(keyRing);
  const keyStem = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.012), metal);
  keyStem.position.set(bx - 0.56, 1.53, bz - 0.05);
  scene.add(keyStem);
  box(scene, 0.02, 0.02, 0.04, blackMetal, bx - 0.56, 1.66, bz - 0.05, { cast: false });
"""
if old not in s:
    print('MISS home door anchor'); sys.exit(1)
s = s.replace(old, new, 1)
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('home.js patched, bytes:', len(s))

# game.js: заметнее подпись и радиус
P2 = r'C:\Users\user\not-a-human-3d\src\game.js'
g = io.open(P2, encoding='utf-8').read()
pairs = [
    ("        out.push({ x: home.anchors.basementDoor.x, z: home.anchors.basementDoor.z, r: 1.2, hl: [-1.75, 1.05, 2.3, 1.0, 2.1, 0.3], target: home.world.targets.basementDoor, label: '[E] Спуститься в подвал', action: () => this.goBasement() });",
     "        out.push({ x: home.anchors.basementDoor.x, z: home.anchors.basementDoor.z, r: 1.55, hl: [-1.75, 1.05, 2.3, 1.0, 2.1, 0.3], target: home.world.targets.basementDoor, label: '[E] Открыть дверь в подвал — жёлтая лампа слева', action: () => this.goBasement() });",
     'day basement label'),
    ("        out.push({ x: home.anchors.basementDoor.x, z: home.anchors.basementDoor.z, r: 1.2, target: home.world.targets.basementDoor, label: this.mineUnlocked ? '[E] В подвал — к открытому шахтному люку' : '[E] Спуститься в подвал', action: () => this.goBasement() });",
     "        out.push({ x: home.anchors.basementDoor.x, z: home.anchors.basementDoor.z, r: 1.55, target: home.world.targets.basementDoor, label: this.mineUnlocked ? '[E] В подвал — к открытому шахтному люку' : '[E] Спуститься в подвал — жёлтая лампа слева', action: () => this.goBasement() });",
     'night basement label'),
]
for old, new, label in pairs:
    if old not in g:
        print('MISS game:', label); sys.exit(1)
    g = g.replace(old, new, 1)
    print('ok:', label)
io.open(P2, 'w', encoding='utf-8', newline='\n').write(g)
print('game.js basement labels patched, bytes:', len(g))