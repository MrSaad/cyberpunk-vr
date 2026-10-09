import * as THREE from 'three';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';

// Camera-facing additive glow sprites. This is how we fake bloom: every bright
// light source gets a soft halo instead of a full-screen post-process pass.
// Modes: 0 steady, 1 aviation blink, 2 neon flicker, 3 slow pulse, 4 rising steam
export class Halos {
  constructor() {
    this.items = [];
  }

  add(pos, color, size, mode = 0, phase = Math.random()) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.items.push(pos.x, pos.y, pos.z, size, c.r, c.g, c.b, mode, phase);
  }

  build() {
    const n = this.items.length / 9;
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
    geo.setAttribute('position', new THREE.BufferAttribute(quad, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const a = new Float32Array(n * 4), b = new Float32Array(n * 3), c = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      a.set([this.items[o], this.items[o + 1], this.items[o + 2], this.items[o + 3]], i * 4);
      b.set([this.items[o + 4], this.items[o + 5], this.items[o + 6]], i * 3);
      c.set([this.items[o + 7], this.items[o + 8]], i * 2);
    }
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(a, 4));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(b, 3));
    geo.setAttribute('aAnim', new THREE.InstancedBufferAttribute(c, 2));
    geo.instanceCount = n;
    const mat = makeShaderMaterial({
      vertexShader: /* glsl */ `
        ${GLSL_COMMON}
        attribute vec4 aPos; attribute vec3 aColor; attribute vec2 aAnim;
        varying vec2 vUv; varying vec3 vCol;
        void main(){
          vec3 p = aPos.xyz;
          float k = 1.0;
          float m = aAnim.x;
          if (m > 0.5 && m < 1.5) k = smoothstep(0.0, 0.08, fract(uTime*0.6 + aAnim.y)) * (1.0 - smoothstep(0.25, 0.4, fract(uTime*0.6 + aAnim.y)));
          else if (m > 1.5 && m < 2.5) { float f = hash11(floor(uTime*14.0) + aAnim.y*91.0); k = f > 0.12 ? 0.85 + 0.15*f : 0.15; }
          else if (m > 2.5 && m < 3.5) k = 0.6 + 0.4*sin(uTime*1.7 + aAnim.y*6.283);
          float s = aPos.w;
          if (m > 3.5) {
            float t = fract(uTime*0.25 + aAnim.y);
            p.y += t * 3.5; p.x += sin(t*6.0 + aAnim.y*20.0)*0.3;
            s *= 0.6 + t*1.6; k = sin(t*3.14159);
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          mv.xy += position.xy * s;
          vUv = position.xy;
          float fog = fogAmount(-mv.z);
          vCol = aColor * k * (1.0 - fog);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vCol;
        void main(){
          float d = dot(vUv, vUv);
          if (d > 1.0) discard;
          float a = exp(-d*5.0) * (1.0 - d);
          gl_FragColor = vec4(vCol * a, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    return mesh;
  }
}
