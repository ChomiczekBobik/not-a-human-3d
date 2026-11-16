// anim.js — процедурные позы поверх рига. Никаких анимационных клипов:
// каждая поза — функция (rig, t, params), которая выставляет повороты суставов.
// Вызывается каждый кадр после resetPose.

export function resetPose(rig) {
  const j = rig.joints;
  for (const name in j) {
    const o = j[name];
    if (!o || !o.isObject3D) continue;
    o.rotation.set(0, 0, 0);
    if (o.userData.base) o.position.copy(o.userData.base);
  }
  for (const e of rig.extraArms || []) {
    e.rotation.set(0, 0, 0);
    if (e.userData.base && e.userData.base.rotation) e.rotation.copy(e.userData.base.rotation);
  }
}

const R = (j, x = 0, y = 0, z = 0) => { if (j) j.rotation.set(x, y, z); };

export const pose = {
  // спокойное стояние, дыхание, мелкое покачивание
  idle(rig, t, p = {}) {
    const j = rig.joints;
    const a = p.amp ?? 1;
    const br = Math.sin(t * 1.5) * a;
    R(j.spine, br * 0.018, 0, Math.sin(t * 0.4) * 0.01);
    R(j.chest, -0.02 + br * 0.022, Math.sin(t * 0.35) * 0.05, 0);
    R(j.neck, 0, Math.sin(t * 0.3) * 0.14, 0);
    R(j.head, Math.sin(t * 0.55) * 0.05, Math.sin(t * 0.27) * 0.18, Math.sin(t * 0.5) * 0.03);
    R(j.shoulderL, 0.03, 0, 0.09 + br * 0.012);
    R(j.shoulderR, 0.03, 0, -0.09 - br * 0.012);
    R(j.elbowL, -0.14, 0, 0);
    R(j.elbowR, -0.14, 0, 0);
    if (j.hips && j.hips.userData.base) j.hips.position.y = j.hips.userData.base.y + br * 0.005;
    this._extras(rig, t, 0.06, a);
  },

  // ходьба: фаза ph = t*speed*6
  walk(rig, t, p = {}) {
    const j = rig.joints;
    const sp = p.speed ?? 1;
    const ph = t * 6 * sp;
    R(j.hipL, -Math.sin(ph) * 0.55, 0, 0);
    R(j.hipR, Math.sin(ph) * 0.55, 0, 0);
    R(j.kneeL, Math.max(0, Math.sin(ph + 1.1)) * 0.95, 0, 0);
    R(j.kneeR, Math.max(0, Math.sin(ph + 1.1 + Math.PI)) * 0.95, 0, 0);
    R(j.footL, -0.08, 0, 0);
    R(j.footR, -0.08, 0, 0);
    R(j.spine, 0.05, Math.sin(ph) * 0.04, 0);
    R(j.chest, 0.02, -Math.sin(ph) * 0.06, 0);
    R(j.head, -0.03, 0, 0);
    R(j.shoulderL, Math.sin(ph) * 0.42, 0, 0.09);
    R(j.shoulderR, -Math.sin(ph) * 0.42, 0, -0.09);
    R(j.elbowL, -0.3, 0, 0);
    R(j.elbowR, -0.3, 0, 0);
    if (j.hips && j.hips.userData.base) {
      j.hips.position.y = j.hips.userData.base.y + Math.abs(Math.sin(ph)) * 0.018 - 0.01;
    }
    this._extras(rig, t, 0.25, 1);
  },

  // стук в дверь: правый кулак бьёт по двери, фаза 0..1
  knock(rig, t, p = {}) {
    const j = rig.joints;
    const cycle = 1.15;
    const ph = ((p.phase ?? t) % cycle) / cycle;
    const hit = ph < 0.18 ? Math.sin((ph / 0.18) * Math.PI) : 0;
    R(j.shoulderR, -1.05 - hit * 0.5, 0.12, -0.22);
    R(j.elbowR, -1.5 + hit * 0.95, 0, 0);
    R(j.handR, 0.2 - hit * 0.4, 0, 0);
    R(j.chest, 0.05 + hit * 0.06, -0.1, 0);
    R(j.spine, 0.03, -0.05, 0);
    R(j.head, 0.06 + hit * 0.05, 0.04, 0.02);
    R(j.shoulderL, 0.08, 0, 0.11);
    R(j.elbowL, -0.22, 0, 0);
    if (j.hips && j.hips.userData.base) j.hips.position.y = j.hips.userData.base.y;
    this._extras(rig, t, 0.1, 0.6);
    return hit;
  },

  // наклон к глазку
  lean(rig, t, p = {}) {
    const j = rig.joints;
    const k = p.amount ?? 1;
    R(j.spine, 0.16 * k, 0, 0);
    R(j.chest, 0.2 * k, 0, 0);
    R(j.neck, 0.12 * k, 0, 0);
    R(j.head, 0.1 * k + Math.sin(t * 0.8) * 0.02, Math.sin(t * 0.6) * 0.05, 0.04);
    R(j.shoulderL, -0.55 * k, 0, 0.16);
    R(j.shoulderR, -0.55 * k, 0, -0.16);
    R(j.elbowL, -1.1 * k, 0, 0);
    R(j.elbowR, -1.1 * k, 0, 0);
    this._extras(rig, t, 0.2, 0.5);
  },

  // «нечеловеческое»: слишком ровно, слишком резко
  creepy(rig, t, p = {}) {
    const j = rig.joints;
    const snap = Math.sin(t * 0.7) > 0.985 ? 1 : 0;
    R(j.spine, 0, 0, 0);
    R(j.chest, 0, Math.sin(t * 0.18) * 0.03, 0);
    R(j.neck, 0, 0, 0);
    R(j.head, 0.05 + snap * 0.1, Math.sin(t * 0.23) * 0.55, 0.32 + snap * 0.1);
    R(j.shoulderL, 0, 0, 0.02);
    R(j.shoulderR, 0, 0, -0.02);
    R(j.elbowL, 0, 0, 0);
    R(j.elbowR, 0, 0, 0);
    if (j.hips && j.hips.userData.base) j.hips.position.y = j.hips.userData.base.y;
    this._extras(rig, t, 0.02, 0.3);
  },

  // разговор: кивки, жесты
  talk(rig, t, p = {}) {
    const j = rig.joints;
    const a = p.amp ?? 1;
    R(j.spine, 0.02 + Math.sin(t * 3.1) * 0.02 * a, 0, 0);
    R(j.chest, 0, Math.sin(t * 1.7) * 0.06 * a, 0);
    R(j.neck, Math.sin(t * 4.2) * 0.07 * a, 0, 0);
    R(j.head, Math.sin(t * 4.2) * 0.1 * a, Math.sin(t * 2.3) * 0.2 * a, Math.sin(t * 1.3) * 0.05);
    R(j.shoulderL, -0.25 + Math.sin(t * 2.1) * 0.15 * a, 0, 0.14);
    R(j.elbowL, -0.85 + Math.sin(t * 2.7) * 0.25 * a, 0, 0);
    R(j.shoulderR, 0.02, 0, -0.1);
    R(j.elbowR, -0.2, 0, 0);
    this._extras(rig, t, 0.15, a);
  },

  // сидячая поза: на стуле или на диване
  sit(rig, t, p = {}) {
    const j = rig.joints;
    R(j.hipL, -1.52, 0, 0.04);
    R(j.hipR, -1.52, 0, -0.04);
    R(j.kneeL, 1.5, 0, 0);
    R(j.kneeR, 1.5, 0, 0);
    R(j.footL, 0.12, 0, 0);
    R(j.footR, 0.12, 0, 0);
    R(j.spine, 0.03 + Math.sin(t * 1.4) * 0.015, 0, 0);
    R(j.chest, -0.02, Math.sin(t * 0.3) * 0.03, 0);
    R(j.neck, 0, 0, 0);
    R(j.head, 0.02 + Math.sin(t * 0.6) * 0.03, Math.sin(t * 0.27) * 0.15, 0);
    R(j.shoulderL, 0.04, 0, 0.1);
    R(j.shoulderR, 0.04, 0, -0.1);
    R(j.elbowL, -0.4, 0, 0);
    R(j.elbowR, -0.4, 0, 0);
    if (j.hips && j.hips.userData.base) j.hips.position.y = j.hips.userData.base.y - 0.44;
    this._extras(rig, t, 0.03, 0.3);
  },

  // обмякшее тело: для падения после выстрела (само падение крутит root)
  limp(rig, t) {
    const j = rig.joints;
    R(j.spine, 0.12, 0.06, 0.1);
    R(j.chest, 0.08, 0.04, 0.06);
    R(j.neck, 0.3, 0.2, 0.1);
    R(j.head, 0.35, 0.25, 0.15);
    R(j.shoulderL, -0.5, 0, 0.2);
    R(j.shoulderR, -0.35, 0, -0.3);
    R(j.elbowL, -0.9, 0, 0);
    R(j.elbowR, -0.6, 0, 0);
    R(j.hipL, -0.12, 0, 0.1);
    R(j.hipR, 0.05, 0, -0.12);
    R(j.kneeL, 0.2, 0, 0);
    R(j.kneeR, 0.1, 0, 0);
    if (j.hips && j.hips.userData.base) j.hips.position.y = j.hips.userData.base.y - 0.05;
    this._extras(rig, t, 0.01, 0.1);
  },

  // лежит на койке в подвале: root повёрнут на -90° по X снаружи
  lying(rig, t) {
    const j = rig.joints;
    const br = Math.sin(t * 1.1);
    R(j.spine, 0, 0, 0);
    R(j.chest, br * 0.02, 0, 0);
    R(j.neck, 0, 0, 0);
    R(j.head, 0, Math.sin(t * 0.4) * 0.2, 0);
    R(j.shoulderL, 0, 0, 0.08);
    R(j.shoulderR, 0, 0, -0.08);
    R(j.elbowL, -0.1, 0, 0);
    R(j.elbowR, -0.1, 0, 0);
    R(j.hipL, 0.02, 0, 0.03);
    R(j.hipR, 0.02, 0, -0.03);
    if (j.hips && j.hips.userData.base) j.hips.position.y = j.hips.userData.base.y;
    this._extras(rig, t, 0.01, 0.1);
  },

  // полная заморозка (для скримера)
  freeze(rig) {    const j = rig.joints;
    for (const name in j) {
      if (j[name] && j[name].isObject3D) j[name].rotation.set(0, 0, 0);
    }
  },

  _extras(rig, t, amp, scale = 1) {
    const list = rig.extraArms || [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const base = e.userData.base && e.userData.base.rotation ? e.userData.base.rotation : { z: 0 };
      e.rotation.set(
        Math.sin(t * 1.4 + i) * amp,
        Math.sin(t * 0.9 + i * 1.7) * amp * 0.6,
        base.z + Math.sin(t * 1.1 + i * 2.1) * amp * scale
      );
    }
  }
};
