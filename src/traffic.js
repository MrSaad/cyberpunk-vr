import * as THREE from 'three';
import { RNG } from './rng.js';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';
import { NEON_LIST } from './palette.js';
import { BLOCK, CITY_RADIUS, polysOverlap } from './city.js';

// Flying car shape, local forward = +Z. slot: 0 body, 1 glass, 2 head, 3 tail, 4 neon, 5 metal
const CAR_PARTS = [
  [0, 0.3, 0, 2.0, 0.6, 4.8, 0],
  [0, 0.25, 2.7, 1.8, 0.35, 0.8, 0],
  [0, 0.86, -0.2, 1.6, 0.55, 2.3, 1],
  [0, 0.38, 3.11, 1.6, 0.1, 0.05, 2],
  [0, 0.45, -2.42, 1.9, 0.1, 0.05, 3],
  [0, -0.02, 0, 1.6, 0.05, 3.8, 4],
];

function carGeometry(instanced) {
  const pos = [], nor = [], slot = [];
  for (const [x, y, z, sx, sy, sz, s] of CAR_PARTS) {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    g.translate(x, y, z);
    const a = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < a.count; i++) {
      pos.push(a.getX(i), a.getY(i), a.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      slot.push(s);
    }
  }
  const geo = instanced ? new THREE.InstancedBufferGeometry() : new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aSlot', new THREE.Float32BufferAttribute(slot, 1));
  return geo;
}

// A regular (CPU-placed) car mesh with baked colours, used by the skyport.
export function makeCarMesh(body, neon) {
  const geo = carGeometry(false);
  const b = new THREE.Color(body), ne = new THREE.Color(neon);
  const slots = geo.attributes.aSlot, nor = geo.attributes.normal;
  const colors = [];
  for (let i = 0; i < slots.count; i++) {
    const s = slots.getX(i);
    const l = 0.35 + 0.45 * Math.max(0, nor.getY(i)) + 0.2 * Math.abs(nor.getX(i));
    let c;
    if (s === 0) c = b.clone().multiplyScalar(l);
    else if (s === 1) c = new THREE.Color(0.02, 0.03, 0.06).addScalar(0.04 * l);
    else if (s === 2) c = new THREE.Color(2, 2, 1.8);
    else if (s === 3) c = new THREE.Color(2, 0.05, 0.1);
    else if (s === 4) c = ne.clone().multiplyScalar(0.7);
    else c = new THREE.Color(0.08, 0.08, 0.1).multiplyScalar(l * 1.5);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

const MOTION = /* glsl */ `
  attribute vec4 aLane; attribute vec4 aMove;
  vec3 carPos(out float fade, out vec2 dir){
    float s = mod(aMove.z + uTime * aMove.y, aMove.x);
    dir = vec2(sin(aLane.w), cos(aLane.w));
    vec3 p = aLane.xyz + vec3(dir.x, 0.0, dir.y) * s;
    p.y += sin(uTime * 0.8 + aMove.w * 20.0) * 0.6;
    fade = smoothstep(0.0, 60.0, s) * (1.0 - smoothstep(aMove.x - 60.0, aMove.x, s));
    return p;
  }
  vec3 toWorld(vec3 p, vec2 dir){ return vec3(p.x * dir.y + p.z * dir.x, p.y, -p.x * dir.x + p.z * dir.y); }
`;

export function buildTraffic({ obstacles, route, stations }) {
  const rng = new RNG(808);
  const lanes = [];
  const N = Math.floor(CITY_RADIUS / BLOCK) - 1;

  const blocked = (poly, y) => {
    for (const o of obstacles) {
      if (y > o.yMin - 6 && y < o.yMax + 6 && polysOverlap(poly, o.poly)) return true;
    }
    return false;
  };
  const crossesTrack = (axis, c, y) => {
    for (const p of route.samples) {
      const lat = axis === 0 ? Math.abs(p.x - c) : Math.abs(p.z - c);
      if (lat < 10 && Math.abs(p.y - y) < 9) return true;
    }
    return false;
  };

  for (let axis = 0; axis < 2; axis++) {
    for (let k = -N; k <= N; k++) {
      const c = k * BLOCK;
      const half = Math.sqrt(Math.max(0, CITY_RADIUS * CITY_RADIUS - c * c));
      if (half < 200) continue;
      const levels = [];
      const nLevels = rng.int(2, 4);
      for (let i = 0; i < nLevels; i++) levels.push(rng.float(30, 380));
      // extra low/mid lane near the closest station's height so traffic zips past platforms
      let best = null, bd = Infinity;
      for (const st of stations) {
        const d = Math.abs((axis === 0 ? st.position.x : st.position.z) - c);
        if (d < bd) { bd = d; best = st; }
      }
      if (bd < 260) levels.push(best.position.y + rng.float(6, 26), best.position.y - rng.float(8, 20));
      for (const y0 of levels) {
        for (const dirSign of [1, -1]) {
          const y = y0 + dirSign * 2;
          const off = dirSign * 4.5;
          const lc = c + off;
          const poly = axis === 0
            ? [[lc - 2, -half], [lc + 2, -half], [lc + 2, half], [lc - 2, half]]
            : [[-half, lc - 2], [half, lc - 2], [half, lc + 2], [-half, lc + 2]];
          if (y < 20 || blocked(poly, y) || crossesTrack(axis, lc, y)) continue;
          const len = half * 2;
          const speed = rng.float(18, 44);
          const cars = rng.int(1, 4);
          // axis 0: x fixed, move along z. angle 0 => +z
          const ang = axis === 0 ? (dirSign > 0 ? 0 : Math.PI) : (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2);
          const ox = axis === 0 ? lc : -half * dirSign;
          const oz = axis === 0 ? -half * dirSign : lc;
          for (let i = 0; i < cars; i++) {
            lanes.push({
              lane: [ox, y, oz, ang],
              move: [len, speed * rng.float(0.9, 1.1), rng.float(0, len), rng.next()],
              body: new THREE.Color(rng.pick([0x1a1a1f, 0x2a2a35, 0x5a0a1a, 0x0a2a3a, 0xc8b000, 0x404048, 0x101010, 0x6a6a72])),
              neon: NEON_LIST[rng.int(0, 7)],
            });
          }
        }
      }
    }
  }

  const n = lanes.length;
  const L = new Float32Array(n * 4), M = new Float32Array(n * 4), CB = new Float32Array(n * 3), CN = new Float32Array(n * 3);
  lanes.forEach((l, i) => {
    L.set(l.lane, i * 4);
    M.set(l.move, i * 4);
    CB.set([l.body.r, l.body.g, l.body.b], i * 3);
    CN.set([l.neon.r, l.neon.g, l.neon.b], i * 3);
  });

  // car bodies
  const geo = carGeometry(true);
  geo.setAttribute('aLane', new THREE.InstancedBufferAttribute(L, 4));
  geo.setAttribute('aMove', new THREE.InstancedBufferAttribute(M, 4));
  geo.setAttribute('aBody', new THREE.InstancedBufferAttribute(CB, 3));
  geo.setAttribute('aNeon', new THREE.InstancedBufferAttribute(CN, 3));
  geo.instanceCount = n;
  const mat = makeShaderMaterial({
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      ${MOTION}
      attribute float aSlot; attribute vec3 aBody; attribute vec3 aNeon;
      varying vec3 vCol; varying float vFog;
      void main(){
        float fade; vec2 dir;
        vec3 base = carPos(fade, dir);
        vec3 p = toWorld(position * fade, dir) + base;
        vec3 n = toWorld(normal, dir);
        float l = 0.35 + 0.45 * max(0.0, n.y) + 0.2 * abs(n.x);
        vec3 c;
        if (aSlot < 0.5) c = aBody * l + uSunColor * 0.05 * max(0.0, dot(n, uSunDir));
        else if (aSlot < 1.5) c = vec3(0.02, 0.03, 0.06) + 0.04 * l;
        else if (aSlot < 2.5) c = vec3(2.0, 2.0, 1.8);
        else if (aSlot < 3.5) c = vec3(2.0, 0.05, 0.1);
        else if (aSlot < 4.5) c = desat(aNeon, 0.6) * 0.7;
        else c = vec3(0.08, 0.08, 0.1) * l * 1.5;
        vCol = c;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vFog = fogAmount(-mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec3 vCol; varying float vFog;
      void main(){ gl_FragColor = vec4(mix(vCol, uFogColor, vFog), 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const cars = new THREE.Mesh(geo, mat);
  cars.frustumCulled = false;

  // light halos: 2 per car (head + tail), share lane motion
  const hgeo = new THREE.InstancedBufferGeometry();
  hgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  hgeo.setIndex([0, 1, 2, 0, 2, 3]);
  const HL = new Float32Array(n * 2 * 4), HM = new Float32Array(n * 2 * 4), HO = new Float32Array(n * 2 * 4), HC = new Float32Array(n * 2 * 3);
  lanes.forEach((l, i) => {
    for (let j = 0; j < 2; j++) {
      const k = i * 2 + j;
      HL.set(l.lane, k * 4);
      HM.set(l.move, k * 4);
      HO.set(j === 0 ? [0, 0.4, 3.3, 1.7] : [0, 0.45, -2.6, 1.2], k * 4);
      HC.set(j === 0 ? [0.8, 0.78, 0.7] : [0.55, 0.02, 0.04], k * 3);
    }
  });
  hgeo.setAttribute('aLane', new THREE.InstancedBufferAttribute(HL, 4));
  hgeo.setAttribute('aMove', new THREE.InstancedBufferAttribute(HM, 4));
  hgeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(HO, 4));
  hgeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(HC, 3));
  hgeo.instanceCount = n * 2;
  const hmat = makeShaderMaterial({
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      ${MOTION}
      attribute vec4 aOff; attribute vec3 aCol;
      varying vec2 vUv; varying vec3 vCol;
      void main(){
        float fade; vec2 dir;
        vec3 base = carPos(fade, dir);
        vec3 p = toWorld(aOff.xyz, dir) + base;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float size = aOff.w * (1.0 + clamp(-mv.z / 500.0, 0.0, 1.0));
        mv.xy += position.xy * size * fade;
        vUv = position.xy;
        vCol = aCol * 0.75 * (1.0 - fogAmount(-mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vCol;
      void main(){
        float d = dot(vUv, vUv);
        if (d > 1.0) discard;
        gl_FragColor = vec4(vCol * exp(-d * 6.0) * (1.0 - d), 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lights = new THREE.Mesh(hgeo, hmat);
  lights.frustumCulled = false;
  lights.renderOrder = 5;

  const group = new THREE.Group();
  group.add(cars, lights);
  group.userData.count = n;
  return group;
}
