// post.js — пост-обработка в стиле Fears to Fathom:
// bloom (гало ламп) -> единый выходной проход (ACES, sRGB, зерно, аберрация, виньетка).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tBloom: { value: null },
    uBloomStrength: { value: 0 },
    toneMappingExposure: { value: 1 },
    uTime: { value: 0 },
    uGrain: { value: 0.032 },       // сила зерна
    uAberration: { value: 0.0025 }, // хроматическая аберрация (доля радиуса)
    uVignette: { value: 0.26 },     // затемнение краёв
    uSat: { value: 0.92 }           // насыщенность
  },
  // RawShaderMaterial: как и в штатном OutputPass, сами объявляем GLSL-окружение.
  // Это исключает неявные флаги tone mapping/color space у ShaderMaterial:
  // ACES и sRGB ниже выполняются ровно один раз и с корректной экспозицией.
  vertexShader: `
    precision highp float;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uSat;
    uniform sampler2D tBloom;
    uniform float uBloomStrength;
    varying vec2 vUv;
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>

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
      vec3 hdr;
      hdr.r = texture2D(tDiffuse, uv - off).r;
      hdr.g = texture2D(tDiffuse, uv).g;
      hdr.b = texture2D(tDiffuse, uv + off).b;
      hdr += texture2D(tBloom, uv).rgb * uBloomStrength;

      // Раньше это делали отдельные composite + OutputPass. Один проход
      // сохраняет HDR до ACES, затем переводит в sRGB и применяет грейд.
      gl_FragColor = vec4(hdr, 1.0);
      gl_FragColor.rgb = ACESFilmicToneMapping(gl_FragColor.rgb);
      gl_FragColor = sRGBTransferOETF(gl_FragColor);
      vec3 col = gl_FragColor.rgb;

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

// Пять low-res draw'ев: extract → H/V → H/V. Композиция не требует отдельного
// прохода и выполняется в OutputGradePass. Размытие идёт в четверти разрешения,
// второй спред расширяет гало без пяти mip-уровней. HDR сохраняется до грейда.
const BLOOM_SPREAD = [1, 2.35];

class AtmosphericBloomPass extends Pass {
  constructor(strength = 0.28, radius = 1, threshold = 0.9) {
    super();
    this.strength = strength;
    this.radius = radius;
    this.threshold = threshold;
    // Проход меняет только четверть-размерную bloom-текстуру; HDR-кадр
    // остаётся в readBuffer и сразу попадает в финальный OutputGradePass.
    this.needsSwap = false;
    const options = {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false
    };
    this.rtA = new THREE.WebGLRenderTarget(2, 2, options);
    this.rtB = new THREE.WebGLRenderTarget(2, 2, options);
    this.rtA.texture.name = 'atmosphere-bloom-a';
    this.rtB.texture.name = 'atmosphere-bloom-b';
    const vertexShader = `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `;
    this.extract = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        tDiffuse: { value: null }, uThreshold: { value: threshold },
        uTexel: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uThreshold;
        uniform vec2 uTexel;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb * 0.5;
          c += texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb * 0.125;
          c += texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb * 0.125;
          c += texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb * 0.125;
          c += texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb * 0.125;
          float b = max(c.r, max(c.g, c.b));
          float knee = 0.25;
          float soft = clamp(b - uThreshold + knee, 0.0, 2.0 * knee);
          soft = soft * soft / (4.0 * knee + 0.0001);
          float contribution = max(soft, b - uThreshold) / max(b, 0.0001);
          gl_FragColor = vec4(c * contribution, 1.0);
        }
      `
    });
    this.blur = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: null }, uDirection: { value: new THREE.Vector2() } },
      vertexShader,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uDirection;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
          c += texture2D(tDiffuse, vUv + uDirection * 1.384615).rgb * 0.316216;
          c += texture2D(tDiffuse, vUv - uDirection * 1.384615).rgb * 0.316216;
          c += texture2D(tDiffuse, vUv + uDirection * 3.230769).rgb * 0.070270;
          c += texture2D(tDiffuse, vUv - uDirection * 3.230769).rgb * 0.070270;
          gl_FragColor = vec4(c, 1.0);
        }
      `
    });
    this.quad = new FullScreenQuad(this.extract);
  }

  setSize(width, height) {
    this.width = Math.max(2, Math.floor(width / 4));
    this.height = Math.max(2, Math.floor(height / 4));
    this.rtA.setSize(this.width, this.height);
    this.rtB.setSize(this.width, this.height);
  }

  render(renderer, writeBuffer, readBuffer) {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    this.extract.uniforms.tDiffuse.value = readBuffer.texture;
    this.extract.uniforms.uThreshold.value = this.threshold;
    this.extract.uniforms.uTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height);
    this.quad.material = this.extract;
    renderer.setRenderTarget(this.rtA);
    this.quad.render(renderer);

    for (const spread of BLOOM_SPREAD) {
      this.quad.material = this.blur;
      this.blur.uniforms.tDiffuse.value = this.rtA.texture;
      this.blur.uniforms.uDirection.value.set(spread * this.radius / this.width, 0);
      renderer.setRenderTarget(this.rtB);
      this.quad.render(renderer);
      this.blur.uniforms.tDiffuse.value = this.rtB.texture;
      this.blur.uniforms.uDirection.value.set(0, spread * this.radius / this.height);
      renderer.setRenderTarget(this.rtA);
      this.quad.render(renderer);
    }

    renderer.autoClear = oldAutoClear;
  }

  dispose() {
    this.rtA.dispose(); this.rtB.dispose();
    this.extract.dispose(); this.blur.dispose();
    this.quad.dispose();
  }
}

class OutputGradePass extends Pass {
  constructor(bloom) {
    super();
    this.bloom = bloom;
    this.needsSwap = false;
    this.uniforms = THREE.UniformsUtils.clone(GradeShader.uniforms);
    this.material = new THREE.RawShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GradeShader.vertexShader,
      fragmentShader: GradeShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.tBloom.value = this.bloom.rtA.texture;
    this.uniforms.uBloomStrength.value = this.bloom.enabled ? this.bloom.strength : 0;
    this.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }

  dispose() { this.material.dispose(); this.quad.dispose(); }
}

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // Сила подобрана к двум узким размытиям: светятся лампы и аварийные швы,
  // а средние тона и текстуры остаются чёткими.
  const bloom = new AtmosphericBloomPass(0.34, 1.0, 0.9);
  composer.addPass(bloom);
  const grade = new OutputGradePass(bloom);
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
      // AtmosphericBloomPass сам получает effective size от composer и
      // выделяет четверть разрешения без второго скрытого деления.
    }
  };
}
