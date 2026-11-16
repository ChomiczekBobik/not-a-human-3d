// post.js — пост-обработка в стиле Fears to Fathom:
// bloom (гало ламп) -> OutputPass (тон-маппинг) -> грейд (зерно, аберрация, виньетка, сплит-тон).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.032 },       // сила зерна
    uAberration: { value: 0.0025 }, // хроматическая аберрация (доля радиуса)
    uVignette: { value: 0.26 },     // затемнение краёв
    uSat: { value: 0.92 }           // насыщенность
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uSat;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);

      // хроматическая аберрация: радиальная, сильнее к краям
      vec2 off = d * uAberration * (0.4 + r2 * 3.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv - off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + off).b;

      // цветокор: приглушение, мягкая S-кривая
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, uSat);
      col = col * col * (3.0 - 2.0 * col) * 0.25 + col * 0.75;
      // сплит-тонинг: холодные тени, тёплые света
      float l = clamp(lum, 0.0, 1.0);
      col *= mix(vec3(0.74, 0.85, 1.0), vec3(1.06, 1.0, 0.92), l);
      // холодок в тенях
      col += vec3(0.008, 0.012, 0.018);
      col = clamp(col, 0.0, 1.0);

      // виньетка
      float vig = 1.0 - uVignette * smoothstep(0.12, 0.6, r2);
      col *= vig;

      // зерно, живое по кадрам
      float g = hash(uv * 913.0 + fract(uTime * 13.7) * 91.7);
      col += (g - 0.5) * uGrain;

      gl_FragColor = vec4(col, 1.0);
    }`
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // Bloom-цепь на четверти бэкбуфера: каскад из ~10 размытий дешевеет в ~4 раза,
  // а мягкое гало разницы не видит. Внутри UnrealBloomPass делит размер пополам,
  // поэтому сюда идёт половина композера; радиус поделён вдвое под новое разрешение.
  const pr0 = renderer.getPixelRatio();
  const bloomRes = new THREE.Vector2(
    Math.max(160, Math.floor(window.innerWidth * pr0 / 4)),
    Math.max(120, Math.floor(window.innerHeight * pr0 / 4))
  );
  const bloom = new UnrealBloomPass(
    bloomRes,
    0.28,   // strength (чуть выше обычного: даунсэмплинг съедает мелкие яркости)
    0.22,   // radius (ниже обычного: цепь вдвое плотнее в экранных пикселях)
    0.9     // threshold (не размывать средние тона)
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return {
    composer, grade, bloom, renderPass,
    render(dt) {
      grade.uniforms.uTime.value += dt;
      composer.render();
    },
    setScene(scene) { renderPass.scene = scene; },
    setCamera(cam) { renderPass.camera = cam; },
    setBloomEnabled(on) { bloom.enabled = on; },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      // composer пересчитает bloom под ПОЛОВИНУ бэкбуфера — давим до четверти
      const p = renderer.getPixelRatio();
      bloom.setSize(Math.max(2, (w * p) / 2), Math.max(2, (h * p) / 2));
    }
  };
}
