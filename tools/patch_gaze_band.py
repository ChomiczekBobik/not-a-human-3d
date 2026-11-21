# -*- coding: utf-8 -*-
"""Сектор взгляда Людмилы: линия в WebGL всегда 1px и теряется на светлом полу.
Делаем настоящую кромку — плоскую дугу-полосу и два луча, плюс чуть плотнее заливка."""
import io, sys

P = 'src/store.js'
s = io.open(P, encoding='utf-8').read()
orig = s


def sub(old, new, label):
    global s
    n = s.count(old)
    if n == 0:
        print('skip (already applied):', label)
        return
    if n > 1:
        print('MULTI:', label, n)
        sys.exit(1)
    s = s.replace(old, new, 1)
    print('ok:', label)


anchor = """  const gazeEdge = new THREE.LineSegments(edgeGeo, gazeEdgeMat);
  gazeEdge.renderOrder = 3;
  gazeEdge.userData.noHighlight = true;
  gazeGroup.add(gazeEdge);
"""
band = anchor + """
  // Линия в WebGL всегда 1px: на светлом полу её почти не видно.
  // Поэтому граница сектора — плоская дуга-полоса и два луча по краям.
  const ARC_W = 0.17;
  const bandGeo = new THREE.RingGeometry(
    GAZE_RANGE - ARC_W, GAZE_RANGE, 30, 1, -GAZE_HALF, GAZE_HALF * 2
  );
  bandGeo.rotateX(-Math.PI / 2);
  const bandMat = new THREE.MeshBasicMaterial({
    color: 0x9a6620, transparent: true, opacity: 0.3, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });
  const gazeBand = new THREE.Mesh(bandGeo, bandMat);
  gazeBand.position.y = 0.002;
  gazeBand.renderOrder = 3;
  gazeBand.userData.noHighlight = true;
  gazeGroup.add(gazeBand);

  const RAY_W = 0.12;
  const rayGeo = new THREE.PlaneGeometry(GAZE_RANGE - ARC_W * 0.4, RAY_W);
  rayGeo.translate((GAZE_RANGE - ARC_W * 0.4) / 2, 0, 0);
  rayGeo.rotateX(-Math.PI / 2);
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0x9a6620, transparent: true, opacity: 0.26, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });
  for (const side of [-1, 1]) {
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.rotation.y = GAZE_HALF * side;
    ray.position.y = 0.002;
    ray.renderOrder = 3;
    ray.userData.noHighlight = true;
    gazeGroup.add(ray);
  }
"""
sub(anchor, band, 'gaze edge band + rays')

sub("""  const GAZE_SAFE = new THREE.Color(0xe8b25a);""",
    """  const GAZE_SAFE = new THREE.Color(0xd9a75e);""",
    'gaze safe color')

sub("""    gazeMat.opacity = 0.13 + gaze.alert * 0.15;""",
    """    gazeMat.opacity = 0.2 + gaze.alert * 0.16;""",
    'gaze fill opacity')

sub("""    gazeEdgeMat.opacity = 0.5 + gaze.alert * 0.4
      + (gaze.moving ? 0.06 : 0) + Math.sin(t * 2.6) * 0.035;""",
    """    gazeEdgeMat.opacity = 0.5 + gaze.alert * 0.4
      + (gaze.moving ? 0.06 : 0) + Math.sin(t * 2.6) * 0.035;
    bandMat.color.copy(GAZE_EDGE_SAFE).lerp(GAZE_EDGE_DANGER, gaze.alert);
    bandMat.opacity = 0.26 + gaze.alert * 0.3 + Math.sin(t * 2.6) * 0.03;
    rayMat.color.copy(GAZE_EDGE_SAFE).lerp(GAZE_EDGE_DANGER, gaze.alert);
    rayMat.opacity = 0.2 + gaze.alert * 0.26;""",
    'gaze band pulse')

if s == orig:
    print('nothing to do')
else:
    io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
    print('store.js bytes:', len(s.encode('utf-8')))