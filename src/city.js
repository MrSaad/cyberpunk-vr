import * as THREE from 'three';
import { RNG } from './rng.js';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';
import { NEON_LIST } from './palette.js';
import { MeshBuilder, materials, builderMesh } from './builder.js';
import { SIGN_CELLS } from './textures.js';

export const BLOCK = 100; // street grid pitch
export const STREET = 24; // street width
export const CITY_RADIUS = 1650;

// ---------------------------------------------------------------------------
// 2D helpers for zone tests (convex quads as arrays of [x, z]).
// ---------------------------------------------------------------------------
function project(poly, ax, az) {
  let mn = Infinity, mx = -Infinity;
  for (const [x, z] of poly) {
    const d = x * ax + z * az;
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  }
  return [mn, mx];
}
export function polysOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, z0] = poly[i];
      const [x1, z1] = poly[(i + 1) % poly.length];
      const ax = -(z1 - z0), az = x1 - x0;
      const [a0, a1] = project(a, ax, az);
      const [b0, b1] = project(b, ax, az);
      if (a1 < b0 || b1 < a0) return false;
    }
  }
  return true;
}
const rectPoly = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

// ---------------------------------------------------------------------------
// Building instances (boxes + cylinders) rendered with one procedural shader.
// ---------------------------------------------------------------------------
const BUILDING_VERT = /* glsl */ `
  ${GLSL_COMMON}
  attribute vec4 aStyle;
  varying vec3 vW; varying vec3 vN; varying vec4 vStyle; varying vec3 vL; varying float vFog; varying vec3 vSize;
  void main(){
    mat4 im = instanceMatrix;
    vec4 wp = modelMatrix * im * vec4(position, 1.0);
    vW = wp.xyz; vL = position; vStyle = aStyle;
    vN = normalize(mat3(modelMatrix * im) * normal);
    vSize = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
    vec4 mv = viewMatrix * wp;
    vFog = fogAmount(-mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const BUILDING_FRAG = /* glsl */ `
  ${GLSL_COMMON}
  uniform vec3 uAccents[8];
  varying vec3 vW; varying vec3 vN; varying vec4 vStyle; varying vec3 vL; varying float vFog; varying vec3 vSize;
  void main(){
    vec3 n = normalize(vN);
    float seed = vStyle.y;
    float style = vStyle.x;
    vec3 accent = uAccents[int(vStyle.w + 0.5)];
    vec3 wall = vec3(0.022, 0.02, 0.036) + hash11(seed * 31.0) * vec3(0.02, 0.016, 0.03);
    if (style > 3.5) wall = vec3(0.05, 0.012, 0.016); // corporate red-black
    vec3 c;
    if (abs(n.y) > 0.5) {
      c = wall * (n.y > 0.0 ? 0.9 : 0.4);
      // rooftop light grid hint
      vec2 r = fract(vW.xz / 6.0);
      c += accent * 0.05 * step(0.94, max(r.x, r.y));
    } else {
#ifdef CYLINDER
      float u = atan(vL.z, vL.x) * vSize.x * 0.5;
#else
      vec2 tang = normalize(vec2(-n.z, n.x));
      float u = dot(vW.xz, tang);
#endif
      float v = vW.y;
      float floorH = style > 2.5 && style < 3.5 ? 3.0 : 3.6;
      float winW = mix(2.0, 4.2, hash11(seed * 7.0));
      vec2 cell = vec2(u / winW, v / floorH);
      vec2 id = floor(cell);
      vec2 f = fract(cell);
      vec2 fw = fwidth(cell);
      float detail = 1.0 - smoothstep(0.1, 0.32, max(fw.x, fw.y));
      float fx = style > 2.5 && style < 3.5 ? 0.04 : 0.14;
      float wx = smoothstep(fx - fw.x, fx + fw.x, f.x) * (1.0 - smoothstep(1.0 - fx - fw.x, 1.0 - fx + fw.x, f.x));
      float wy = smoothstep(0.18 - fw.y, 0.18 + fw.y, f.y) * (1.0 - smoothstep(0.82 - fw.y, 0.82 + fw.y, f.y));
      float win = wx * wy;
      float r = hash21(id + seed * 17.0);
      float lit = step(r, vStyle.z);
      float flipT = floor(uTime * 0.04 + r * 7.0);
      lit = abs(lit - step(0.985, hash21(id * 1.3 + flipT)));
      vec3 wc = mix(vec3(1.0, 0.68, 0.38), vec3(0.55, 0.75, 1.0), step(0.55, hash21(id * 1.7 + seed)));
      wc = mix(wc, accent, step(0.92, hash21(id * 2.3 + seed)));
      wc *= 0.35 + 0.75 * hash21(id * 3.1 + 0.5);
      vec3 glass = vec3(0.02, 0.025, 0.05) + accent * 0.015;
      vec3 nearC = mix(wall, mix(glass, wc, lit), win);
      float area = (1.0 - 2.0 * fx) * 0.64;
      vec3 avgWin = vec3(0.62, 0.58, 0.55) * 0.85;
      vec3 farC = wall * (1.0 - area) + area * (glass * (1.0 - vStyle.z) + avgWin * vStyle.z);
      c = mix(farC, nearC, detail);

      // style 1: horizontal neon bands, style 2: vertical LED stripes
      if (style > 0.5 && style < 1.5) {
        float bv = abs(fract(v / (floorH * 4.0)) - 0.5) * floorH * 4.0;
        float bw = fwidth(v);
        float band = 1.0 - smoothstep(0.15, 0.15 + bw * 1.5, bv);
        c = mix(c, accent * 1.1, mix(0.08, band, detail));
      } else if (style > 1.5 && style < 2.5) {
        float su = abs(fract(u / 7.0) - 0.5) * 7.0;
        float bw = fwidth(u);
        float stripe = 1.0 - smoothstep(0.18, 0.18 + bw * 1.5, su);
        float pulse = 0.6 + 0.4 * sin(v * 0.05 - uTime * 2.0 + seed * 10.0);
        c = mix(c, accent * pulse, mix(0.07, stripe, detail));
      } else if (style > 3.5) {
        float bv = abs(fract(v / 18.0) - 0.5) * 18.0;
        float band = 1.0 - smoothstep(0.25, 0.25 + fwidth(v) * 1.5, bv);
        c = mix(c, vec3(1.0, 0.06, 0.1), mix(0.06, band, detail));
      }
      // street-level shopfronts
      if (v < 6.5) {
        float shop = floor(u / 9.0);
        vec3 sc = uAccents[int(mod(shop + seed * 5.0, 8.0))];
        float fu = fract(u / 9.0);
        float frame = step(0.06, fu) * step(fu, 0.94);
        float fv = fract(u / 1.5);
        vec3 shopC = mix(vec3(0.02), sc * 0.22 + vec3(0.06, 0.05, 0.04), step(0.08, fv));
        c = mix(c, shopC, frame * step(0.4, v) * step(v, 4.2));
        c = mix(c, sc * 0.9, step(4.6, v) * step(v, 5.1) * frame);
      }
      // glowing crown near the top of some towers
      float topDist = vSize.y * 0.5 - vL.y * vSize.y;
      if (hash11(seed * 3.3) > 0.55) c = mix(c, accent, (1.0 - smoothstep(0.4, 0.9, topDist)) * 0.9);
      // low smog glow
      c += vec3(0.05, 0.015, 0.06) * (1.0 - smoothstep(0.0, 90.0, v));
    }
    gl_FragColor = vec4(mix(c, uFogColor, vFog), 1.0);
    #include <colorspace_fragment>
  }`;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);

export class BuildingSet {
  constructor() {
    this.boxes = [];
    this.cyls = [];
  }
  // centre-x, base-y, centre-z, size, yaw; style = [style, seed, lit, accentIdx]
  addBox(cx, y0, cz, sx, sy, sz, rotY, style) {
    this.boxes.push({ cx, cy: y0 + sy / 2, cz, sx, sy, sz, rotY, style });
  }
  addCylinder(cx, y0, cz, r, h, style) {
    this.cyls.push({ cx, cy: y0 + h / 2, cz, sx: r * 2, sy: h, sz: r * 2, rotY: 0, style });
  }
  _mesh(list, geo, defines) {
    const mesh = new THREE.InstancedMesh(geo, null, list.length);
    const st = new Float32Array(list.length * 4);
    list.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.rotY);
      _m.compose(_p.set(b.cx, b.cy, b.cz), _q, _s.set(b.sx, b.sy, b.sz));
      mesh.setMatrixAt(i, _m);
      st.set(b.style, i * 4);
    });
    geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(st, 4));
    mesh.material = makeShaderMaterial({
      defines,
      uniforms: { uAccents: { value: NEON_LIST } },
      vertexShader: BUILDING_VERT,
      fragmentShader: BUILDING_FRAG,
    });
    mesh.computeBoundingSphere();
    mesh.frustumCulled = false;
    return mesh;
  }
  build() {
    const group = new THREE.Group();
    if (this.boxes.length) group.add(this._mesh(this.boxes, new THREE.BoxGeometry(1, 1, 1), {}));
    if (this.cyls.length) group.add(this._mesh(this.cyls, new THREE.CylinderGeometry(0.5, 0.5, 1, 28, 1), { CYLINDER: '' }));
    return group;
  }
}

// ---------------------------------------------------------------------------
// Ground with streets, lamps and street-level traffic light streaks.
// ---------------------------------------------------------------------------
function buildGround() {
  const geo = new THREE.PlaneGeometry(6000, 6000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = makeShaderMaterial({
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec3 vW; varying float vFog;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vFog = fogAmount(-mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec3 vW; varying float vFog;
      const float P = ${BLOCK.toFixed(1)};
      const float HS = ${(STREET / 2).toFixed(1)};
      vec3 streetAlong(float off, float along, float lineId){
        // off: signed offset from centreline, along: coordinate along the street
        vec3 c = vec3(0.0);
        float ao = abs(off);
        float fa = fwidth(along) + 1e-4;
        float vis = 1.0 - smoothstep(0.6, 3.0, fa);
        // traffic light streaks (white one way, red the other)
        float dir = sign(off);
        float lane = step(2.0, ao) * step(ao, 9.0);
        float ph = fract((along * dir - uTime * (14.0 + 6.0 * hash11(lineId + dir))) / 19.0 + hash11(lineId * 3.7 + floor(ao / 3.5)));
        float dash = smoothstep(0.0, 0.02, ph) * (1.0 - smoothstep(0.05, 0.08, ph));
        vec3 lc = dir > 0.0 ? vec3(1.0, 0.85, 0.7) : vec3(1.0, 0.08, 0.12);
        c += lc * dash * lane * mix(0.12, 1.0, vis) * step(1.0, abs(mod(ao, 3.5) - 1.75) + 1.0);
        // centre line
        c += vec3(0.6, 0.5, 0.1) * (1.0 - smoothstep(0.08, 0.08 + fwidth(off) * 2.0, ao)) * step(0.5, fract(along / 6.0)) * vis * 0.5;
        // lamps along sidewalks
        float la = mod(along, 22.0) - 11.0;
        float d = length(vec2(ao - (HS + 1.5), la));
        c += vec3(1.0, 0.6, 0.3) * exp(-d * d * 0.05) * 0.5;
        return c;
      }
      void main(){
        vec2 w = vW.xz;
        vec2 g = mod(w + P * 0.5, P) - P * 0.5;
        vec2 lineId = floor((w + P * 0.5) / P);
        vec3 c = vec3(0.028, 0.026, 0.04);
        float sx = step(abs(g.x), HS), sz = step(abs(g.y), HS);
        float side = (step(abs(g.x), HS + 4.0) + step(abs(g.y), HS + 4.0));
        c = mix(c, vec3(0.06, 0.055, 0.075), min(1.0, side));
        if (sx + sz > 0.0) {
          c = vec3(0.018, 0.018, 0.026);
          // wet sheen: faint neon tint varying across the street
          c += vec3(0.04, 0.0, 0.05) * (0.5 + 0.5 * sin(w.x * 0.05 + w.y * 0.03));
          if (sx > 0.0) c += streetAlong(g.x, w.y, lineId.x);
          if (sz > 0.0) c += streetAlong(-g.y, -w.x, lineId.y + 50.0);
        }
        c += vec3(0.08, 0.03, 0.09) * 0.4;
        gl_FragColor = vec4(mix(c, uFogColor, vFog), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Procedural city generation.
// ---------------------------------------------------------------------------
export function buildCity({ route, zones, buildings, signs, screens, halos, people }) {
  const rng = new RNG(20770);
  const group = new THREE.Group();
  const trims = new MeshBuilder({ maxSeg: 1000 });
  const props = new MeshBuilder({ ambient: new THREE.Color(0.55, 0.45, 0.7), maxSeg: 1000 });

  // spatial hash of track samples
  const grid = new Map();
  const key = (i, j) => i * 10007 + j;
  for (const p of route.samples) {
    const k = key(Math.floor(p.x / 50), Math.floor(p.z / 50));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  }
  const trackCap = (x0, z0, x1, z1, clearance) => {
    let cap = Infinity;
    for (let i = Math.floor((x0 - 30) / 50); i <= Math.floor((x1 + 30) / 50); i++) {
      for (let j = Math.floor((z0 - 30) / 50); j <= Math.floor((z1 + 30) / 50); j++) {
        const list = grid.get(key(i, j));
        if (!list) continue;
        for (const p of list) {
          const dx = Math.max(x0 - p.x, 0, p.x - x1);
          const dz = Math.max(z0 - p.z, 0, p.z - z1);
          if (dx * dx + dz * dz < clearance * clearance) cap = Math.min(cap, p.y - 16);
        }
      }
    }
    return cap;
  };

  const excluded = (poly, h) => {
    for (const z of zones) {
      if (z.kind === 'exclude' && polysOverlap(poly, z.poly)) return { exclude: true };
    }
    let cap = h;
    for (const z of zones) {
      if (z.kind === 'cap' && polysOverlap(poly, z.poly)) cap = Math.min(cap, z.maxH);
    }
    return { exclude: false, cap };
  };

  const N = Math.ceil(CITY_RADIUS / BLOCK);
  const accentIdx = () => rng.int(0, 7);
  let count = 0;

  const addSignsForFace = (fx, fz, nx, nz, faceW, h, near, tierTop) => {
    // fx,fz: face centre; (nx,nz): outward normal
    const tx = -nz, tz = nx;
    const nBlade = rng.chance(near ? 0.75 : 0.3) ? rng.int(1, near ? 3 : 2) : 0;
    for (let i = 0; i < nBlade; i++) {
      const sh = rng.float(6, 16), sw = rng.float(1.6, 2.6);
      const y = rng.float(5, Math.max(6, Math.min(h - sh - 2, near ? 90 : 60)));
      const u = rng.float(-0.45, 0.45) * faceW;
      const px = fx + tx * u + nx * (sw / 2 + 0.35), pz = fz + tz * u + nz * (sw / 2 + 0.35);
      const yaw = Math.atan2(tx, tz);
      _m.makeRotationY(yaw).setPosition(px, y + sh / 2, pz);
      const color = NEON_LIST[rng.int(0, 7)];
      signs.add(_m, sw, sh, SIGN_CELLS.verticalBase + rng.int(0, SIGN_CELLS.verticalCount - 1), color, {
        vertical: true, flicker: rng.chance(0.12) ? 1 : 0, doubleSided: true,
      });
      if (rng.chance(0.35)) halos.add(new THREE.Vector3(px, y + sh / 2, pz), color.clone().multiplyScalar(0.25), sh * 0.7, 0);
    }
    if (rng.chance(near ? 0.6 : 0.25) && faceW > 12) {
      const sw = rng.float(8, Math.min(26, faceW * 0.8)), sh = sw * rng.float(0.2, 0.28);
      const y = rng.float(5, Math.max(6, Math.min(h - sh - 4, 55)));
      const u = rng.float(-0.5, 0.5) * (faceW - sw);
      const px = fx + tx * u + nx * 0.3, pz = fz + tz * u + nz * 0.3;
      _m.makeRotationY(Math.atan2(nx, nz)).setPosition(px, y + sh / 2, pz);
      const color = NEON_LIST[rng.int(0, 7)];
      signs.add(_m, sw, sh, 6 + rng.int(0, SIGN_CELLS.horizontalCount - 7), color, { flicker: rng.chance(0.1) ? 1 : 0 });
      if (rng.chance(0.4)) halos.add(new THREE.Vector3(px + nx * 2, y + sh / 2, pz + nz * 2), color.clone().multiplyScalar(0.22), sw * 0.6, 0);
    }
    if (h > 60 && faceW > 24 && rng.chance(near ? 0.35 : 0.18)) {
      const vertical = rng.chance(0.3);
      let sw = rng.float(18, Math.min(60, faceW * 0.85));
      let sh = vertical ? sw * 1.6 : sw * 0.5625;
      if (sh > h * 0.6) { sh = h * 0.6; sw = vertical ? sh / 1.6 : sh / 0.5625; }
      const y = rng.float(sh / 2 + 15, Math.max(sh / 2 + 16, tierTop - sh / 2 - 8));
      const u = rng.float(-0.5, 0.5) * Math.max(0, faceW - sw);
      _m.makeRotationY(Math.atan2(nx, nz)).setPosition(fx + tx * u + nx * 0.4, y, fz + tz * u + nz * 0.4);
      const ca = NEON_LIST[rng.int(0, 7)], cb = NEON_LIST[rng.int(0, 7)];
      screens.add(_m, sw, sh, 6 + rng.int(0, SIGN_CELLS.horizontalCount - 7), ca, cb, rng.next());
    }
  };

  for (let bx = -N; bx < N; bx++) {
    for (let bz = -N; bz < N; bz++) {
      const x0 = bx * BLOCK + STREET / 2, x1 = (bx + 1) * BLOCK - STREET / 2;
      const z0 = bz * BLOCK + STREET / 2, z1 = (bz + 1) * BLOCK - STREET / 2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const d = Math.hypot(cx, cz);
      if (d > CITY_RADIUS) continue;
      // lot subdivision
      const lots = [];
      const split = rng.float();
      const alley = 6;
      if (split < 0.3) lots.push([x0, z0, x1, z1]);
      else if (split < 0.6) {
        const m = rng.float(0.35, 0.65);
        if (rng.chance(0.5)) {
          const xm = x0 + (x1 - x0) * m;
          lots.push([x0, z0, xm - alley / 2, z1], [xm + alley / 2, z0, x1, z1]);
        } else {
          const zm = z0 + (z1 - z0) * m;
          lots.push([x0, z0, x1, zm - alley / 2], [x0, zm + alley / 2, x1, z1]);
        }
      } else {
        const xm = x0 + (x1 - x0) * rng.float(0.4, 0.6), zm = z0 + (z1 - z0) * rng.float(0.4, 0.6);
        lots.push(
          [x0, z0, xm - alley / 2, zm - alley / 2], [xm + alley / 2, z0, x1, zm - alley / 2],
          [x0, zm + alley / 2, xm - alley / 2, z1], [xm + alley / 2, zm + alley / 2, x1, z1]
        );
      }
      const blockTowers = [];
      for (const lot of lots) {
        const mg = rng.float(0.5, 3);
        const lx0 = lot[0] + mg, lz0 = lot[1] + mg, lx1 = lot[2] - mg, lz1 = lot[3] - mg;
        if (lx1 - lx0 < 8 || lz1 - lz0 < 8) continue;
        const t = Math.min(1, d / 1250);
        const base = 340 * (1 - t) ** 1.3 + 40;
        let h = base * rng.float(0.35, 1.15);
        if (d < 650 && rng.chance(0.07)) h = rng.float(460, 640);
        h = Math.max(h, 16);
        const poly = rectPoly(lx0, lz0, lx1, lz1);
        const ex = excluded(poly, h);
        if (ex.exclude) continue;
        h = Math.min(h, ex.cap);
        const cap = trackCap(lx0, lz0, lx1, lz1, 14);
        const capped = cap < h;
        if (capped) h = cap;
        if (h < 10) continue;
        const w = lx1 - lx0, dd = lz1 - lz0;
        const mx = (lx0 + lx1) / 2, mz = (lz0 + lz1) / 2;
        const style = [rng.int(0, 3), rng.float(0, 100), rng.float(0.22, 0.6), accentIdx()];
        const near = d < 700 || cap < Infinity;
        count++;

        // tiers
        let tiers = [];
        if (!capped && h > 200 && Math.abs(w - dd) < 12 && rng.chance(0.15)) {
          const r = Math.min(w, dd) / 2;
          buildings.addBox(mx, 0, mz, w, h * 0.18, dd, 0, style);
          buildings.addCylinder(mx, h * 0.18, mz, r * 0.92, h * 0.82, style);
          tiers = [{ w, d: dd, y0: 0, y1: h * 0.18 }, { w: r * 1.84, d: r * 1.84, y0: h * 0.18, y1: h, cyl: true }];
        } else if (h > 110 && rng.chance(0.65)) {
          const h1 = h * rng.float(0.4, 0.7);
          buildings.addBox(mx, 0, mz, w, h1, dd, 0, style);
          const s2 = rng.float(0.6, 0.85);
          const style2 = rng.chance(0.5) ? style : [rng.int(0, 3), style[1] + 1, style[2], accentIdx()];
          buildings.addBox(mx, h1, mz, w * s2, h - h1, dd * s2, 0, style2);
          tiers = [{ w, d: dd, y0: 0, y1: h1 }, { w: w * s2, d: dd * s2, y0: h1, y1: h }];
          if (h > 380) {
            const s3 = s2 * 0.6;
            const h3 = rng.float(25, 60);
            buildings.addBox(mx, h, mz, w * s3, h3, dd * s3, 0, style2);
            tiers.push({ w: w * s3, d: dd * s3, y0: h, y1: h + h3 });
            h += h3;
          }
        } else {
          buildings.addBox(mx, 0, mz, w, h, dd, 0, style);
          tiers = [{ w, d: dd, y0: 0, y1: h }];
        }
        blockTowers.push({ x0: lx0, z0: lz0, x1: lx1, z1: lz1, h: tiers[0].y1 });

        // neon trims on corners + roof rims
        const top = tiers[tiers.length - 1];
        const accent = NEON_LIST[style[3]];
        if (!top.cyl && rng.chance(style[0] === 1 || style[0] === 2 ? 0.45 : 0.15)) {
          const hw = top.w / 2 + 0.2, hd = top.d / 2 + 0.2;
          const th = top.y1 - top.y0;
          for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            trims.box(mx + sx * hw, top.y0 + th / 2, mz + sz * hd, 0.5, th, 0.5, accent, { emissive: true, seg: 1e9 });
          }
          trims.box(mx, top.y1 + 0.2, mz - hd, top.w + 0.9, 0.4, 0.4, accent, { emissive: true, seg: 1e9 });
          trims.box(mx, top.y1 + 0.2, mz + hd, top.w + 0.9, 0.4, 0.4, accent, { emissive: true, seg: 1e9 });
          trims.box(mx - hw, top.y1 + 0.2, mz, 0.4, 0.4, top.d + 0.9, accent, { emissive: true, seg: 1e9 });
          trims.box(mx + hw, top.y1 + 0.2, mz, 0.4, 0.4, top.d + 0.9, accent, { emissive: true, seg: 1e9 });
        }
        // antenna + aviation lights
        if (h > 120 && !capped) {
          if (rng.chance(0.6)) {
            const ah = rng.float(10, h > 400 ? 70 : 35);
            props.box(mx, h + ah / 2, mz, 0.8, ah, 0.8, 0x2a2a35, { seg: 1e9 });
            halos.add(new THREE.Vector3(mx, h + ah, mz), new THREE.Color(1, 0.05, 0.05), 3.5, 1, rng.next());
          }
          const hw = top.w / 2, hd = top.d / 2;
          for (const [sx, sz] of [[-1, -1], [1, 1]]) {
            halos.add(new THREE.Vector3(mx + sx * hw, h + 0.6, mz + sz * hd), new THREE.Color(1, 0.08, 0.05), 2.4, 1, rng.next());
          }
        } else if (!capped && h < 140) {
          // rooftop clutter seen from the skytrain
          const n = rng.int(1, 4);
          for (let i = 0; i < n; i++) {
            const sx = rng.float(2, 6), sy = rng.float(1.5, 4), sz = rng.float(2, 6);
            const px = mx + rng.float(-0.35, 0.35) * (top.w - sx), pz = mz + rng.float(-0.35, 0.35) * (top.d - sz);
            props.box(px, h + sy / 2, pz, sx, sy, sz, rng.pick([0x3a3644, 0x2c3038, 0x403a3a]), { seg: 1e9 });
          }
          if (rng.chance(0.25)) {
            // rooftop sign
            const sw = rng.float(14, Math.min(34, w * 1.1)), sh = sw * 0.24;
            const nf = rng.int(0, 3);
            const ang = (nf * Math.PI) / 2;
            const nx = Math.sin(ang), nz = Math.cos(ang);
            const px = mx, pz = mz;
            props.box(px - Math.cos(ang) * sw * 0.3, h + 2, pz + Math.sin(ang) * sw * 0.3, 0.4, 4, 0.4, 0x222228, { seg: 1e9 });
            props.box(px + Math.cos(ang) * sw * 0.3, h + 2, pz - Math.sin(ang) * sw * 0.3, 0.4, 4, 0.4, 0x222228, { seg: 1e9 });
            _m.makeRotationY(ang).setPosition(px + nx * 0.3, h + 4 + sh / 2, pz + nz * 0.3);
            const color = NEON_LIST[rng.int(0, 7)];
            signs.add(_m, sw, sh, 6 + rng.int(0, SIGN_CELLS.horizontalCount - 7), color, { doubleSided: true, flicker: rng.chance(0.15) ? 1 : 0 });
            halos.add(new THREE.Vector3(px, h + 4 + sh / 2, pz), color.clone().multiplyScalar(0.25), sw * 0.55, 0);
          }
        }
        // signs and screens on the lowest tier faces
        const t0 = tiers[0];
        const faces = [
          [mx, mz + t0.d / 2, 0, 1, t0.w],
          [mx, mz - t0.d / 2, 0, -1, t0.w],
          [mx + t0.w / 2, mz, 1, 0, t0.d],
          [mx - t0.w / 2, mz, -1, 0, t0.d],
        ];
        for (const [fx, fz, nx, nz, fw] of faces) addSignsForFace(fx, fz, nx, nz, fw, t0.y1, near, t0.y1);
        if (tiers[1] && !tiers[1].cyl && rng.chance(0.35)) {
          const t1 = tiers[1];
          const f = rng.pick([
            [mx, mz + t1.d / 2, 0, 1, t1.w],
            [mx + t1.w / 2, mz, 1, 0, t1.d],
            [mx, mz - t1.d / 2, 0, -1, t1.w],
            [mx - t1.w / 2, mz, -1, 0, t1.d],
          ]);
          const sw = Math.min(f[4] * 0.85, rng.float(30, 70));
          const vertical = rng.chance(0.5);
          const sh = Math.min(vertical ? sw * 1.7 : sw * 0.56, (t1.y1 - t1.y0) * 0.7);
          const swa = vertical ? sh / 1.7 : sh / 0.56;
          const y = t1.y0 + (t1.y1 - t1.y0) * rng.float(0.35, 0.65);
          _m.makeRotationY(Math.atan2(f[2], f[3])).setPosition(f[0] + f[2] * 0.4, y, f[1] + f[3] * 0.4);
          screens.add(_m, swa, sh, 6 + rng.int(0, SIGN_CELLS.horizontalCount - 7), NEON_LIST[rng.int(0, 7)], NEON_LIST[rng.int(0, 7)], rng.next());
        }
      }
      // skybridges between towers in the same block
      if (blockTowers.length >= 2 && rng.chance(0.35)) {
        const a = blockTowers[0], b = blockTowers[1];
        const hb = Math.min(a.h, b.h) - 12;
        if (hb > 30) {
          const y = rng.float(25, hb);
          const ax = (a.x0 + a.x1) / 2, az = (a.z0 + a.z1) / 2, bxm = (b.x0 + b.x1) / 2, bzm = (b.z0 + b.z1) / 2;
          if (Math.abs(ax - bxm) > Math.abs(az - bzm)) {
            const xa = Math.min(a.x1, b.x1), xb = Math.max(a.x0, b.x0);
            const zc = (Math.max(a.z0, b.z0) + Math.min(a.z1, b.z1)) / 2;
            if (xb > xa) {
              props.box((xa + xb) / 2, y, zc, xb - xa + 1, 4, 6, 0x24222e, { seg: 1e9 });
              trims.box((xa + xb) / 2, y - 2.1, zc, xb - xa + 1, 0.3, 0.3, NEON_LIST[rng.int(0, 7)], { emissive: true, seg: 1e9 });
            }
          } else {
            const za = Math.min(a.z1, b.z1), zb = Math.max(a.z0, b.z0);
            const xc = (Math.max(a.x0, b.x0) + Math.min(a.x1, b.x1)) / 2;
            if (zb > za) {
              props.box(xc, y, (za + zb) / 2, 6, 4, zb - za + 1, 0x24222e, { seg: 1e9 });
              trims.box(xc, y - 2.1, (za + zb) / 2, 0.3, 0.3, zb - za + 1, NEON_LIST[rng.int(0, 7)], { emissive: true, seg: 1e9 });
            }
          }
        }
      }
    }
  }

  // street-level pedestrians along sidewalks in the denser areas
  if (people) {
    for (let i = 0; i < 140; i++) {
      const along = rng.chance(0.5);
      const line = rng.int(-6, 6) * BLOCK + rng.sign() * (STREET / 2 + rng.float(0.8, 3.2));
      const s0 = rng.float(-650, 650);
      const len = rng.float(30, 90);
      const a = along ? new THREE.Vector3(line, 0, s0) : new THREE.Vector3(s0, 0, line);
      const b = along ? new THREE.Vector3(line, 0, s0 + len) : new THREE.Vector3(s0 + len, 0, line);
      people.add({ a, b, pose: 0, speed: rng.float(1.1, 1.6) });
    }
  }

  group.add(buildGround());
  const tm = builderMesh(trims);
  if (tm) group.add(tm);
  const pm = builderMesh(props);
  if (pm) group.add(pm);
  group.userData.count = count;
  return group;
}
