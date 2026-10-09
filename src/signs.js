import * as THREE from 'three';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';
import { getSignAtlas, ATLAS_COLS, ATLAS_ROWS } from './textures.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

const VERT = /* glsl */ `
  ${GLSL_COMMON}
  attribute vec4 aData; attribute vec3 aColA; attribute vec3 aColB;
  varying vec2 vUv; varying vec4 vData; varying vec3 vA; varying vec3 vB; varying float vFog; varying float vAspect;
  void main(){
    vUv = uv; vData = aData; vA = aColA; vB = aColB;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    vFog = fogAmount(-mv.z);
    vAspect = length(instanceMatrix[0].xyz) / max(0.001, length(instanceMatrix[1].xyz));
    gl_Position = projectionMatrix * mv;
  }`;

const ATLAS_FN = /* glsl */ `
  uniform sampler2D uAtlas;
  float atlas(float cell, vec2 cuv){
    cuv = clamp(cuv, 0.0, 1.0);
    float col = mod(cell, ${ATLAS_COLS}.0), row = floor(cell / ${ATLAS_COLS}.0);
    vec2 a = vec2((col + 0.01 + cuv.x*0.98) / ${ATLAS_COLS}.0, 1.0 - (row + 1.0 - (0.02 + cuv.y*0.96)) / ${ATLAS_ROWS}.0);
    return texture2D(uAtlas, a).r;
  }`;

// ---------------------------------------------------------------------------
// Neon text signs. aData = (cell, vertical, flickerMode, phase)
// ---------------------------------------------------------------------------
export class Signs {
  constructor() {
    this.list = [];
  }

  // matrix: world placement of the sign's centre; plane faces +Z of the matrix.
  add(matrix, w, h, cell, color, { vertical = false, flicker = 0, bg = null, doubleSided = false } = {}) {
    const c = new THREE.Color(color);
    const b = bg ? new THREE.Color(bg) : c.clone().multiplyScalar(0.06);
    this.list.push({ matrix: matrix.clone(), w, h, cell, c, b, vertical, flicker, phase: Math.random() });
    if (doubleSided) {
      const back = matrix.clone().multiply(new THREE.Matrix4().makeRotationY(Math.PI));
      this.list.push({ matrix: back, w, h, cell, c, b, vertical, flicker, phase: Math.random() });
    }
  }

  build() {
    const n = this.list.length;
    const geo = new THREE.PlaneGeometry(1, 1);
    const data = new Float32Array(n * 4), ca = new Float32Array(n * 3), cb = new Float32Array(n * 3);
    const mesh = new THREE.InstancedMesh(geo, null, n);
    this.list.forEach((it, i) => {
      _m.copy(it.matrix).multiply(new THREE.Matrix4().makeScale(it.w, it.h, 1));
      mesh.setMatrixAt(i, _m);
      data.set([it.cell, it.vertical ? 1 : 0, it.flicker, it.phase], i * 4);
      ca.set([it.c.r, it.c.g, it.c.b], i * 3);
      cb.set([it.b.r, it.b.g, it.b.b], i * 3);
    });
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    geo.setAttribute('aColA', new THREE.InstancedBufferAttribute(ca, 3));
    geo.setAttribute('aColB', new THREE.InstancedBufferAttribute(cb, 3));
    mesh.material = makeShaderMaterial({
      uniforms: { uAtlas: { value: getSignAtlas() } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMON}
        ${ATLAS_FN}
        varying vec2 vUv; varying vec4 vData; varying vec3 vA; varying vec3 vB; varying float vFog; varying float vAspect;
        void main(){
          vec2 cuv = vData.y > 0.5 ? vec2(1.0 - vUv.y, vUv.x) : vUv;
          float m = atlas(vData.x, cuv);
          float k = 1.0;
          if (vData.z > 0.5) {
            float f = hash11(floor(uTime*12.0) + vData.w*113.0);
            float burst = step(0.82, hash11(floor(uTime*0.7) + vData.w*57.0));
            k = mix(1.0, f > 0.4 ? 1.0 : 0.08, burst);
          }
          vec2 e = min(vUv, 1.0 - vUv) * vec2(vAspect, 1.0);
          float border = 1.0 - smoothstep(0.02, 0.05, min(e.x, e.y));
          vec3 A = desat(vA, 0.75);
          vec3 c = vB + A * (m * 1.15 + border * 0.45) * k;
          gl_FragColor = vec4(mix(c, uFogColor, vFog), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    mesh.frustumCulled = false;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

// ---------------------------------------------------------------------------
// Animated advertising screens (procedural ads + brand text overlay).
// aData = (seed, cell, unused, unused)
// ---------------------------------------------------------------------------
export class Screens {
  constructor() {
    this.list = [];
  }

  add(matrix, w, h, cell, colA, colB, seed = Math.random()) {
    this.list.push({ matrix: matrix.clone(), w, h, cell, a: new THREE.Color(colA), b: new THREE.Color(colB), seed });
  }

  build() {
    const n = this.list.length;
    const geo = new THREE.PlaneGeometry(1, 1);
    const data = new Float32Array(n * 4), ca = new Float32Array(n * 3), cb = new Float32Array(n * 3);
    const mesh = new THREE.InstancedMesh(geo, null, n);
    this.list.forEach((it, i) => {
      _m.copy(it.matrix).multiply(new THREE.Matrix4().makeScale(it.w, it.h, 1));
      mesh.setMatrixAt(i, _m);
      data.set([it.seed, it.cell, 0, 0], i * 4);
      ca.set([it.a.r, it.a.g, it.a.b], i * 3);
      cb.set([it.b.r, it.b.g, it.b.b], i * 3);
    });
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    geo.setAttribute('aColA', new THREE.InstancedBufferAttribute(ca, 3));
    geo.setAttribute('aColB', new THREE.InstancedBufferAttribute(cb, 3));
    mesh.material = makeShaderMaterial({
      uniforms: { uAtlas: { value: getSignAtlas() } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMON}
        ${ATLAS_FN}
        varying vec2 vUv; varying vec4 vData; varying vec3 vA; varying vec3 vB; varying float vFog; varying float vAspect;
        void main(){
          float seed = vData.x;
          float t = uTime * 0.11 + seed * 7.0;
          float slot = floor(t), ft = fract(t);
          float type = mod(slot + floor(seed * 13.0), 5.0);
          vec2 uv = vUv;
          // glitch transition between ads
          float g = step(0.965, ft);
          uv.x += g * (hash11(floor(uv.y * 24.0) + floor(uTime * 20.0)) - 0.5) * 0.3;
          vec3 A = vA, B = vB;
          if (mod(slot, 2.0) > 0.5) { A = vB; B = vA; }
          vec2 p = (uv - 0.5) * vec2(vAspect, 1.0);
          vec3 c;
          if (type < 1.0) {
            float s = step(0.5, fract((p.x + p.y) * 3.0 - uTime * 0.5));
            c = mix(A * 0.15, A, s);
          } else if (type < 2.0) {
            float d = length(p);
            c = B * (0.5 + 0.5 * sin(d * 28.0 - uTime * 4.0)) * (1.2 - d);
          } else if (type < 3.0) {
            float bx = floor(uv.x * 14.0);
            float hgt = 0.45 + 0.4 * sin(uTime * 3.0 + bx * 1.7 + seed * 5.0);
            c = mix(A * 0.08, mix(A, B, uv.y), step(uv.y, hgt) * step(0.18, fract(uv.x * 14.0)));
          } else if (type < 4.0) {
            c = mix(A, B, 0.5 + 0.5 * sin(p.x * 5.0 + uTime * 1.3)) * (0.55 + 0.45 * sin(p.y * 9.0 - uTime * 2.0));
          } else {
            float d = length(p);
            float blink = step(0.06, abs(fract(uTime * 0.2 + seed) - 0.5));
            c = B * smoothstep(0.42, 0.4, d) * (0.35 + 0.65 * smoothstep(0.14, 0.16, d));
            c += A * smoothstep(0.12, 0.1, d) * 1.5;
            c *= mix(step(0.06, abs(p.y)), 1.0, blink);
          }
          // brand text band
          float band = vAspect >= 1.0 ? 0.32 : 0.16;
          vec2 tuv = vec2(uv.x, (uv.y - 0.08) / band);
          if (vAspect < 1.0) tuv = vec2((uv.x - 0.05) / 0.9, (uv.y - 0.06) / (0.9 / vAspect * 0.25));
          float inBand = step(0.0, tuv.y) * step(tuv.y, 1.0);
          float m = atlas(vData.y, tuv) * inBand;
          c = mix(c * (1.0 - 0.6 * inBand), vec3(1.0), m);
          c *= 0.8 + 0.2 * sin(vUv.y * 500.0);
          c += g * vec3(0.3, 0.0, 0.4);
          vec2 e = min(vUv, 1.0 - vUv) * vec2(vAspect, 1.0);
          c *= smoothstep(0.01, 0.025, min(e.x, e.y));
          c = desat(c, 0.65) * 0.62;
          gl_FragColor = vec4(mix(c, uFogColor, vFog), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    mesh.frustumCulled = false;
    return mesh;
  }
}
