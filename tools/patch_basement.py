# patch_basement.py — второй зал подвала (лазарет на 2 койки)
import io, os
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'basement.js')
s = io.open(p, encoding='utf-8').read()

old_bounds = "  const bounds = { minX: -2.9, maxX: 2.9, minZ: -2.1, maxZ: 2.4 };"
new_bounds = "  const bounds = { minX: -2.9, maxX: 6.5, minZ: -2.1, maxZ: 2.4 };"
assert old_bounds in s
s = s.replace(old_bounds, new_bounds)

old_wall = "  box(scene, 0.2, 2.5, 5, concMat, 3.0, 1.25, 0.1);"
new_wall = """  // правая стена зала с проёмом в лазарет (z -0.6..0.4)
  box(scene, 0.2, 2.5, 1.5, concMat, 3.0, 1.25, -1.35);
  box(scene, 0.2, 2.5, 2.0, concMat, 3.0, 1.25, 1.4);
  box(scene, 0.2, 0.6, 1.0, concMat, 3.0, 2.2, -0.1);
  colliders.push({ minX: 2.9, maxX: 3.1, minZ: -2.1, maxZ: -0.6 });
  colliders.push({ minX: 2.9, maxX: 3.1, minZ: 0.4, maxZ: 2.4 });"""
assert old_wall in s
s = s.replace(old_wall, new_wall)

anchor = "  colliders.push({ minX: 1.95, maxX: 2.85, minZ: -2.1, maxZ: 2.4 });"
assert anchor in s

chamber = anchor + """

  // ---------- ЛАЗАРЕТ: вторая камера подвала ----------
  const floor2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.5), floorMat);
  floor2.rotation.x = -Math.PI / 2;
  floor2.position.set(4.8, 0.001, 0.1);
  floor2.receiveShadow = true;
  scene.add(floor2);
  box(scene, 3.6, 0.1, 4.5, mat(0x26262a, 0.95), 4.8, 2.45, 0.1, { cast: false });
  box(scene, 0.2, 2.5, 5, concMat, 6.6, 1.25, 0.1);
  colliders.push({ minX: 6.5, maxX: 6.7, minZ: -2.1, maxZ: 2.4 });
  box(scene, 3.6, 2.5, 0.2, concMat, 4.8, 1.25, -2.3);
  colliders.push({ minX: 3.0, maxX: 6.7, minZ: -2.4, maxZ: -2.2 });
  box(scene, 3.6, 2.5, 0.2, concMat, 4.8, 1.25, 2.55);
  colliders.push({ minX: 3.0, maxX: 6.7, minZ: 2.45, maxZ: 2.65 });

  // лампа лазарета
  const medBulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc8ffd8, emissive: 0x8ae0a8, emissiveIntensity: 2.4 }));
  medBulb.position.set(4.8, 2.05, 0.1);
  scene.add(medBulb);
  const medWire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), mat(0x1a1a1a, 0.6));
  medWire.position.set(4.8, 2.25, 0.1);
  scene.add(medWire);
  const medLight = new THREE.PointLight(0xa8e8c0, 6, 8, 2);
  medLight.position.set(4.8, 1.9, 0.1);
  scene.add(medLight);

  // две койки вдоль правой стены лазарета
  for (const cz of [-1.5, -0.3]) {
    box(scene, 0.85, 0.32, 1.7, cotMat, 5.9, 0.22, cz);
    box(scene, 0.85, 0.08, 1.7, mattressMat, 5.9, 0.42, cz);
    for (const [dx, dz] of [[-0.35, -0.78], [0.35, -0.78], [-0.35, 0.78], [0.35, 0.78]]) {
      box(scene, 0.05, 0.24, 0.05, cotMat, 5.9 + dx, 0.12, cz + dz, { cast: false });
    }
    box(scene, 0.8, 0.06, 1.0, mat(0x3a5a4a, 0.95), 5.9, 0.49, cz + 0.3);
    cotSpots.push({ x: 5.9, y: 0.5, z: cz, ry: -Math.PI / 2 });
  }
  colliders.push({ minX: 5.45, maxX: 6.4, minZ: -2.4, maxZ: 0.55 });

  // полка с бинтами, йодом и углём
  for (const y of [0.8, 1.25]) {
    box(scene, 0.35, 0.04, 1.6, wood, 4.9, y, -1.4);
  }
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 10), mat(0x7a4a3a, 0.4));
      jar.position.set(4.9, 0.86 + (i > 2 ? 0.45 : 0), -2.0 + (i % 3) * 0.3);
      scene.add(jar);
    } else {
      box(scene, 0.12, 0.14, 0.1, mat(0xd8dce4, 0.6), 4.9, 0.87 + (i > 2 ? 0.45 : 0), -2.0 + (i % 3) * 0.3);
    }
  }
  colliders.push({ minX: 4.7, maxX: 5.1, minZ: -2.2, maxZ: -0.6 });

  // плакат и лужа
  plane(scene, 1.1, 0.7,
    new THREE.MeshStandardMaterial({ map: tex('assets/tex/poster_basement.png'), roughness: 0.95, color: 0xb8b0a0 }),
    4.6, 1.6, -2.18, 0);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), mat(0x2a2c30, 0.25));
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(4.2, 0.004, 1.0);
  scene.add(puddle);"""

s = s.replace(anchor, chamber)

# амбиент-лампа в update
old_upd = "    bulb.material.emissiveIntensity = 3.2 + Math.sin(t * 13.7) * 0.1;"
new_upd = old_upd + """
    medLight.intensity = 5.6 + Math.sin(t * 5.3) * 0.35;
    medBulb.material.emissiveIntensity = 2.3 + Math.sin(t * 5.3) * 0.12;"""
assert old_upd in s
s = s.replace(old_upd, new_upd)

io.open(p, 'w', encoding='utf-8').write(s)
print('basement patched', len(s))
