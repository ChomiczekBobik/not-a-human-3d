# -*- coding: utf-8 -*-
"""Сектор взгляда: не пересвечивать пол — мягкая тонировка + тёмная кромка."""
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
    color: 0xffdf9a, transparent: true, opacity: 0.17, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
  });""",
    """  // Пол в «Бедронке» и так светлый: аддитивный блендинг выжигал его в белое.
  // Поэтому зона — мягкая янтарная тонировка, а читается она по кромке.
  const gazeMat = new THREE.MeshBasicMaterial({
    color: 0xe8b25a, transparent: true, opacity: 0.15, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });""",
    'gaze fill blend'
)

sub(
    """  const gazeEdgeMat = new THREE.LineBasicMaterial({
    color: 0xffe2ae, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  });""",
    """  const gazeEdgeMat = new THREE.LineBasicMaterial({
    color: 0x9a6620, transparent: true, opacity: 0.55, depthWrite: false, fog: false
  });""",
    'gaze edge blend'
)

sub(
    """    gazeMat.opacity = 0.15 + gaze.alert * 0.18;
    gazeEdgeMat.color.copy(GAZE_SAFE).lerp(GAZE_DANGER, gaze.alert);
    gazeEdgeMat.opacity = 0.42 + gaze.alert * 0.42
      + (gaze.moving ? 0.08 : 0) + Math.sin(t * 2.6) * 0.04;""",
    """    gazeMat.opacity = 0.13 + gaze.alert * 0.15;
    gazeEdgeMat.color.copy(GAZE_EDGE_SAFE).lerp(GAZE_EDGE_DANGER, gaze.alert);
    gazeEdgeMat.opacity = 0.5 + gaze.alert * 0.4
      + (gaze.moving ? 0.06 : 0) + Math.sin(t * 2.6) * 0.035;""",
    'gaze opacity'
)

sub(
    """  const GAZE_SAFE = new THREE.Color(0xffdf9a);
  const GAZE_DANGER = new THREE.Color(0xff5a3c);""",
    """  const GAZE_SAFE = new THREE.Color(0xe8b25a);
  const GAZE_DANGER = new THREE.Color(0xd2452a);
  const GAZE_EDGE_SAFE = new THREE.Color(0x9a6620);
  const GAZE_EDGE_DANGER = new THREE.Color(0x8f2416);""",
    'gaze colors'
)

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('store.js', len(s))