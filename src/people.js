import * as THREE from 'three';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';
import { RNG } from './rng.js';
import { NEON_LIST } from './palette.js';

// GPU-animated crowd. Each person is one instance of a low-poly humanoid whose
// limbs are swung in the vertex shader. Poses: 0 walk (ping-pong A<->B),
// 1 stand facing B, 2 sit facing B, 3 lean on railing / chat (idle + gestures).
const PART = { body: 0, thighL: 1, shinL: 2, thighR: 3, shinR: 4, armL: 5, armR: 6 };
const SLOT = { skin: 0, jacket: 1, pants: 2, neon: 3, shoes: 4, hair: 5, visor: 6 };

function humanoidGeometry() {
  const pos = [], nor = [], part = [], slot = [];
  const add = (cx, cy, cz, sx, sy, sz, p, s) => {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    g.translate(cx, cy, cz);
    const a = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < a.count; i++) {
      pos.push(a.getX(i), a.getY(i), a.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      part.push(p);
      slot.push(s);
    }
  };
  for (const [side, thigh, shin, arm] of [[-1, PART.thighL, PART.shinL, PART.armL], [1, PART.thighR, PART.shinR, PART.armR]]) {
    const x = side * 0.1;
    add(x, 0.25, 0.02, 0.12, 0.5, 0.16, shin, SLOT.pants);
    add(x, 0.73, 0, 0.15, 0.46, 0.16, thigh, SLOT.pants);
    add(side * 0.27, 1.26, 0, 0.1, 0.52, 0.11, arm, SLOT.jacket);
    add(side * 0.27, 0.95, 0, 0.08, 0.12, 0.09, arm, SLOT.skin);
  }
  add(0, 0.97, 0, 0.34, 0.16, 0.2, PART.body, SLOT.pants);
  add(0, 1.26, 0, 0.42, 0.56, 0.23, PART.body, SLOT.jacket);
  add(0, 1.3, 0.118, 0.04, 0.42, 0.01, PART.body, SLOT.neon);
  add(0, 1.5, 0, 0.44, 0.06, 0.25, PART.body, SLOT.neon);
  add(0, 1.73, 0, 0.2, 0.24, 0.22, PART.body, SLOT.skin);
  add(0, 1.86, -0.01, 0.22, 0.07, 0.24, PART.body, SLOT.hair);
  add(0, 1.75, 0.112, 0.21, 0.05, 0.015, PART.body, SLOT.visor);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  geo.setAttribute('aSlot', new THREE.Float32BufferAttribute(slot, 1));
  return geo;
}

const JACKETS = [0x1a1a22, 0x2b1d3a, 0x3a1020, 0x0e2a33, 0x40381a, 0x222222, 0x5a1a40, 0x1b2f1f, 0x6a5a40, 0x101820];
const PANTS = [0x101014, 0x1c1c26, 0x26222a, 0x0c1a24, 0x302820];

export class People {
  constructor(seed = 7) {
    this.rng = new RNG(seed);
    this.list = [];
  }

  add({ a, b, pose = 0, speed = 1.3, height, jacket, pants, neon, visor, phase }) {
    const r = this.rng;
    const B = b || a.clone().add(new THREE.Vector3(0, 0, 1));
    this.list.push({
      a, b: B, pose, speed,
      phase: phase ?? r.next(),
      height: height ?? r.float(0.9, 1.08),
      width: r.float(0.9, 1.15),
      visor: visor ?? (r.chance(0.25) ? 1 : 0),
      jacket: new THREE.Color(jacket ?? r.pick(JACKETS)),
      pants: new THREE.Color(pants ?? r.pick(PANTS)),
      neon: neon ? new THREE.Color(neon) : NEON_LIST[r.int(0, 7)],
    });
  }

  build() {
    const n = this.list.length;
    const geo = humanoidGeometry();
    const A = new Float32Array(n * 4), Bv = new Float32Array(n * 4), C = new Float32Array(n * 4);
    const c1 = new Float32Array(n * 3), c2 = new Float32Array(n * 3), c3 = new Float32Array(n * 3);
    this.list.forEach((p, i) => {
      A.set([p.a.x, p.a.y, p.a.z, p.speed], i * 4);
      Bv.set([p.b.x, p.b.y, p.b.z, p.phase], i * 4);
      C.set([p.pose, p.height, p.width, p.visor], i * 4);
      c1.set([p.jacket.r, p.jacket.g, p.jacket.b], i * 3);
      c2.set([p.pants.r, p.pants.g, p.pants.b], i * 3);
      c3.set([p.neon.r, p.neon.g, p.neon.b], i * 3);
    });
    geo.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4));
    geo.setAttribute('aB', new THREE.InstancedBufferAttribute(Bv, 4));
    geo.setAttribute('aC', new THREE.InstancedBufferAttribute(C, 4));
    geo.setAttribute('aCol1', new THREE.InstancedBufferAttribute(c1, 3));
    geo.setAttribute('aCol2', new THREE.InstancedBufferAttribute(c2, 3));
    geo.setAttribute('aCol3', new THREE.InstancedBufferAttribute(c3, 3));
    geo.instanceCount = n;
    const mat = makeShaderMaterial({
      vertexShader: /* glsl */ `
        ${GLSL_COMMON}
        attribute float aPart; attribute float aSlot;
        attribute vec4 aA; attribute vec4 aB; attribute vec4 aC;
        attribute vec3 aCol1; attribute vec3 aCol2; attribute vec3 aCol3;
        varying vec3 vCol; varying float vFog;
        vec3 rotX(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, v.y*c - v.z*s, v.y*s + v.z*c); }
        void main(){
          vec3 A = aA.xyz, B = aB.xyz;
          float pose = aC.x, H = aC.y, phase = aB.w;
          vec3 base; vec2 fwd; float walk = 0.0;
          float hipL = 0.0, hipR = 0.0, kneeL = 0.0, kneeR = 0.0, armL = 0.0, armR = 0.0, lower = 0.0, bob = 0.0;
          if (pose < 0.5) {
            float len = max(0.01, distance(A.xz, B.xz));
            float dist = uTime * aA.w + phase * len * 2.0;
            float ph = fract(dist / (2.0 * len));
            float k = ph < 0.5 ? ph * 2.0 : 2.0 - ph * 2.0;
            base = mix(A, B, k);
            fwd = normalize(B.xz - A.xz + 1e-4) * (ph < 0.5 ? 1.0 : -1.0);
            walk = dist / 1.5 * 6.2832;
            hipL = -sin(walk) * 0.42; hipR = sin(walk) * 0.42;
            kneeL = (0.5 + 0.5 * sin(walk + 1.3)) * 0.65;
            kneeR = (0.5 + 0.5 * sin(walk + 1.3 + 3.1416)) * 0.65;
            armL = sin(walk) * 0.38; armR = -sin(walk) * 0.38;
            bob = abs(cos(walk)) * 0.035;
          } else {
            base = A;
            fwd = normalize(B.xz - A.xz + 1e-4);
            float t = uTime + phase * 40.0;
            if (pose > 1.5 && pose < 2.5) {
              hipL = hipR = -1.5708; kneeL = kneeR = 1.5708; lower = 0.46 * H;
              armL = -0.55 + sin(t * 0.7) * 0.05; armR = -0.5 - max(0.0, sin(t * 0.4)) * 0.6;
            } else {
              armL = sin(t * 1.1) * 0.05;
              float gest = max(0.0, sin(t * 0.35 + phase * 6.0));
              armR = -gest * (pose > 2.5 ? 1.3 : 0.5) + sin(t * 2.3) * 0.08 * gest;
              hipL = sin(t * 0.5) * 0.04;
              bob = sin(t * 0.9) * 0.008;
            }
          }
          vec3 p = position;
          vec3 nrm = normal;
          p.y *= H; p.x *= aC.z;
          float part = aPart;
          bool left = part < 2.5;
          float hip = left ? hipL : hipR, knee = left ? kneeL : kneeR;
          vec3 hipP = vec3(left ? -0.1 : 0.1, 0.95 * H, 0.0);
          vec3 kneeP = vec3(hipP.x, 0.5 * H, 0.0);
          if (part > 1.5 && part < 2.5 || part > 3.5 && part < 4.5) { p = rotX(p - kneeP, knee) + kneeP; nrm = rotX(nrm, knee); }
          if (part > 0.5 && part < 4.5) { p = rotX(p - hipP, hip) + hipP; nrm = rotX(nrm, hip); }
          if (part > 4.5) {
            float arm = part < 5.5 ? armL : armR;
            vec3 sh = vec3(sign(p.x) * 0.27 * aC.z, 1.5 * H, 0.0);
            p = rotX(p - sh, arm) + sh; nrm = rotX(nrm, arm);
          }
          p.y += bob - lower;
          vec3 wp = vec3(base.x + p.x * fwd.y + p.z * fwd.x, base.y + p.y, base.z - p.x * fwd.x + p.z * fwd.y);
          vec3 wn = vec3(nrm.x * fwd.y + nrm.z * fwd.x, nrm.y, -nrm.x * fwd.x + nrm.z * fwd.y);
          vec4 world = modelMatrix * vec4(wp, 1.0);
          wn = normalize(mat3(modelMatrix) * wn);

          float s = aSlot;
          float hsh = hash11(phase * 97.0);
          vec3 skin = mix(vec3(0.95, 0.72, 0.58), vec3(0.32, 0.2, 0.13), hsh);
          vec3 c;
          bool glow = false;
          if (s < 0.5) c = skin;
          else if (s < 1.5) c = aCol1;
          else if (s < 2.5) c = aCol2;
          else if (s < 3.5) { c = aCol3 * 1.4; glow = true; }
          else if (s < 4.5) c = vec3(0.03);
          else if (s < 5.5) { float hh = hash11(phase * 31.0); c = hh > 0.75 ? aCol3 * 0.9 : mix(vec3(0.02), vec3(0.35, 0.22, 0.1), hh); }
          else { if (aC.w > 0.5) { c = aCol3 * 1.6; glow = true; } else c = skin; }
          if (!glow) {
            float l = 0.32 + 0.4 * max(0.0, wn.y) + 0.35 * max(0.0, dot(wn, normalize(vec3(0.4, 0.3, 0.8))));
            c = c * l + aCol3 * 0.12 * (1.0 - abs(wn.y));
          }
          vCol = c;
          vec4 mv = viewMatrix * world;
          vFog = fogAmount(-mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMON}
        varying vec3 vCol; varying float vFog;
        void main(){
          gl_FragColor = vec4(mix(vCol, uFogColor, vFog), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }
}
