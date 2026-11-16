// gltf_test.js — тестовая подсцена: GLB-модели в квартире рядами ×10 + замер FPS.
// API: testScene.loadGLB(url, slot, opts); testScene.clearSlot(slot);
//      testScene.stress(url, count); testScene.runReport();
// Автотест: #autoglb — грузит обе модели ×10 и печатает сравнение в console.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// 5 колонок × 2 ряда на ковре
function slotPos(i) {
  const col = i % 5, row = Math.floor(i / 5);
  return new THREE.Vector3(-1.6 + col * 0.8, 0, -0.6 + row * 1.1);
}

export class TestScene {
  constructor(app) {
    this.app = app;
    this.slots = [];
    this.fpsSamples = [];
    this._overlay = null;
    this._acc = 0;
  }

  _ensureOverlay() {
    if (this._overlay) return this._overlay;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:50;' +
      'background:rgba(0,0,0,.72);color:#8fe08f;font:12px/1.5 monospace;padding:6px 10px;' +
      'border:1px solid #2a3a2a;border-radius:3px;white-space:pre;pointer-events:none';
    document.body.appendChild(d);
    this._overlay = d;
    return d;
  }

  showOverlay(text) { this._ensureOverlay().textContent = text; }
  hideOverlay() { if (this._overlay) this._overlay.remove(); this._overlay = null; }

  _groundToFloor(object, targetH = null) {
    const wrap = new THREE.Group();
    wrap.add(object);
    if (targetH) {
      const box = new THREE.Box3().setFromObject(object);
      const h = box.getSize(new THREE.Vector3()).y;
      if (h > 0.01) wrap.scale.setScalar(targetH / h);
    }
    wrap.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(wrap);
    wrap.position.y -= b.min.y;
    return wrap;
  }

  async loadGLB(url, slot, { targetH = 1.75 } = {}) {
    const gltf = await loader.loadAsync(url);
    const obj = this._groundToFloor(gltf.scene, targetH);
    obj.position.copy(slotPos(slot));
    obj.traverse((n) => {
      if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = true; }
    });
    this.clearSlot(slot);
    this.slots[slot] = obj;
    this.app.scene.add(obj);
    return obj;
  }

  async stress(url, count, opts = {}) {
    const gltf = await loader.loadAsync(url);
    const arr = [];
    for (let i = 0; i < Math.min(count, this.slots.length || 10); i++) {
      const inst = i === 0 ? gltf.scene : gltf.scene.clone(true);
      const obj = this._groundToFloor(inst, opts.targetH ?? 1.75);
      obj.position.copy(slotPos(i));
      obj.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      this.clearSlot(i);
      this.slots[i] = obj;
      this.app.scene.add(obj);
      arr.push(obj);
    }
    return arr;
  }

  clearSlot(slot) {
    if (this.slots[slot]) {
      this.app.scene.remove(this.slots[slot]);
      this.slots[slot].traverse((n) => {
        if (n.isMesh) { n.geometry.dispose(); }
      });
      this.slots[slot] = null;
    }
  }

  clear() { for (let i = 0; i < this.slots.length; i++) this.clearSlot(i); }

  frame(dt) {
    if (dt > 0) this.fpsSamples.push(1 / dt);
    if (this.fpsSamples.length > 600) this.fpsSamples.shift();
    this._acc += dt;
    if (this._acc > 0.25 && this.slots.some(Boolean)) {
      this._acc = 0;
      const s = this.stats();
      this.showOverlay(
        `FPS ${s.fpsAvg}   draw calls ${s.drawCalls}   tri ${s.triangles.toLocaleString('ru-RU')}\n` +
        `geometries ${s.geometries}   textures ${s.textures}   объектов ${this.slots.filter(Boolean).length}`
      );
    }
  }

  stats() {
    const info = this.app.renderer.info;
    const s = [...this.fpsSamples].sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
    return {
      fpsAvg: Math.round(avg),
      fpsP1: Math.round(s[Math.floor(s.length * 0.01)] || 0),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures
    };
  }

  resetFps() { this.fpsSamples.length = 0; }

  async runReport() {
    const files = [
      { label: 'ЛЁГКАЯ  (1024 tri)', url: 'assets/models/tripo_light.glb' },
      { label: 'ТЯЖЁЛАЯ (1 944 686 tri)', url: 'assets/models/tripo_heavy.glb' }
    ];
    const out = [];
    for (const f of files) {
      this.clear();
      this.resetFps();
      console.log(`[AUTOTEST] loading ${f.url}`);
      try { await this.stress(f.url, 10); }
      catch (e) { console.error('[AUTOTEST] load failed', f.url, e); out.push({ label: f.label, error: String(e) }); continue; }
      console.log(`[AUTOTEST] loaded ${f.url}`);
      this.showOverlay(`[AUTOTEST] ${f.label}: модели загружены, замер 2.5с`);
      this.resetFps();
      await new Promise((r) => setTimeout(r, 2500));
      const st = this.stats();
      const row = { label: f.label, count: 10, ...st };
      out.push(row);
      console.log('[AUTOTEST]', JSON.stringify(row));
    }
    this.clear();
    console.log('[AUTOTEST] RESULT ' + JSON.stringify(out));
    this.hideOverlay();
    try {
      await fetch('/report', { method: 'POST', body: JSON.stringify(out) });
    } catch (e) { /* отчёт необязателен */ }
    return out;
  }
}
