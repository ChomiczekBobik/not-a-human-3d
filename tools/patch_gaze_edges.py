# -*- coding: utf-8 -*-
"""Сектор взгляда Людмилы: ярче заливка + светящаяся кромка и лучи."""
import io

P = r'C:\Users\user\not-a-human-3d\src\store.js'
s = io.open(P, encoding='utf-8').read()


def sub(old, new, label):
    global s
    if s.count(old) != 1:
        print('MISS:', label, s.count(old))
        raise SystemExit(1)
    s = s.replace(old, new, 1)
    print('ok:', label)


sub(
    """  const gazeMat = new THREE.MeshBasicMaterial({
    color: 0xffdf9a, transparent: true, opacity: 0.10, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
  });
  const gazeMesh = new THREE.Mesh(gazeGeo, gazeMat);
  gazeMesh.renderOrder = 2;
  gazeMesh.userData.noHighlight = true;
  gazeGroup.add(gazeMesh);""",
    """  const gazeMat = new THREE.MeshBasicMaterial({
    color: 0xffdf9a, transparent: true, opacity: 0.17, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
  });
  const gazeMesh = new THREE.Mesh(gazeGeo, gazeMat);
  gazeMesh.renderOrder = 2;
  gazeMesh.userData.noHighlight = true;
  gazeGroup.add(gazeMesh);

  // Кромка сектора: дуга по дальнему краю и два луча из-под ног Людмилы.
  // Без неё на светлом полу зона обзора читалась только по шкале в HUD.
  const edgePts = [];
  const ARC_SEG = 26;
  const R_EDGE = GAZE_RANGE - 0.06;
  for (let i = 0; i < ARC_SEG; i++) {
    const a0 = -GAZE_HALF + (GAZE_HALF * 2) * (i / ARC_SEG);
    const a1 = -GAZE_HALF + (GAZE_HALF * 2) * ((i + 1) / ARC_SEG);
    edgePts.push(
      new THREE.Vector3(Math.cos(a0) * R_EDGE, Math.sin(a0) * R_EDGE, 0),
      new THREE.Vector3(Math.cos(a1) * R_EDGE, Math.sin(a1) * R_EDGE, 0)
    );
  }
  edgePts.push(
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(-GAZE_HALF) * R_EDGE, Math.sin(-GAZE_HALF) * R_EDGE, 0),
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(GAZE_HALF) * R_EDGE, Math.sin(GAZE_HALF) * R_EDGE, 0)
  );
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
  edgeGeo.rotateX(-Math.PI / 2);
  const gazeEdgeMat = new THREE.LineBasicMaterial({
    color: 0xffe2ae, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  });
  const gazeEdge = new THREE.LineSegments(edgeGeo, gazeEdgeMat);
  gazeEdge.renderOrder = 3;
  gazeEdge.userData.noHighlight = true;
  gazeGroup.add(gazeEdge);

  // Пятно у ног: тёплый круг, чтобы источник сектора читался сразу.
  const eyeGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xffe2ae, transparent: true, opacity: 0.26, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    })
  );
  eyeGlow.position.y = 0.004;
  eyeGlow.renderOrder = 3;
  eyeGlow.userData.noHighlight = true;
  gazeGroup.add(eyeGlow);""",
    'gaze edge'
)

sub(
    """    gazeGroup.rotation.y = gaze.yaw - Math.PI / 2;
    gazeMat.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    gazeMat.opacity = 0.085 + gaze.alert * 0.15;""",
    """    gazeGroup.rotation.y = gaze.yaw - Math.PI / 2;
    gazeMat.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    gazeMat.opacity = 0.15 + gaze.alert * 0.18;
    gazeEdgeMat.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    gazeEdgeMat.opacity = 0.42 + gaze.alert * 0.42
      + (gaze.moving ? 0.08 : 0) + Math.sin(t * 2.6) * 0.04;
    eyeGlow.material.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    eyeGlow.material.opacity = 0.22 + gaze.alert * 0.3;""",
    'gaze pulse'
)

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('store.js', len(s))