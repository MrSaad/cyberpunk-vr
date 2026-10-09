import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Accumulates many small primitives into one vertex-coloured geometry.
// Lighting is baked into the vertex colours at build time (no runtime lights),
// which keeps everything to a single cheap draw call per builder.
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _d = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _nm = new THREE.Matrix3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export class MeshBuilder {
  constructor({ ambient = new THREE.Color(0.18, 0.14, 0.24), maxSeg = 1.5 } = {}) {
    this.positions = [];
    this.colors = [];
    this.indices = [];
    this.vcount = 0;
    this.lights = [];
    this.ambient = ambient;
    this.maxSeg = maxSeg;
    this.mirrorX = 1; // stations mirror their layout depending on platform side
  }

  addLight(x, y, z, color, intensity = 1, range = 6) {
    this.lights.push({ pos: new THREE.Vector3(x * this.mirrorX, y, z), color: new THREE.Color(color), intensity, range });
  }

  shade(p, n, albedo, out) {
    // hemisphere-ish ambient: surfaces facing up get a little more
    const hemi = 0.75 + 0.25 * n.y;
    let r = this.ambient.r * hemi;
    let g = this.ambient.g * hemi;
    let b = this.ambient.b * hemi;
    for (const L of this.lights) {
      _d.subVectors(L.pos, p);
      const dist = _d.length() + 1e-4;
      _d.multiplyScalar(1 / dist);
      const ndl = Math.max(0, n.dot(_d) * 0.8 + 0.2);
      const x = dist / L.range;
      const att = (L.intensity * ndl) / (1 + x * x * 2.5);
      r += L.color.r * att;
      g += L.color.g * att;
      b += L.color.b * att;
    }
    out.r = albedo.r * r;
    out.g = albedo.g * g;
    out.b = albedo.b * b;
    return out;
  }

  // Append an arbitrary THREE geometry with a matrix and colour.
  addGeometry(geo, matrix, color, emissive = false) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    _nm.getNormalMatrix(matrix);
    const base = this.vcount;
    const out = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      this.positions.push(_v.x, _v.y, _v.z);
      if (emissive || !nor) {
        this.colors.push(c.r, c.g, c.b);
      } else {
        _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
        this.shade(_v, _n, c, out);
        this.colors.push(out.r, out.g, out.b);
      }
    }
    if (geo.index) {
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i++) this.indices.push(base + idx[i]);
    } else {
      for (let i = 0; i < pos.count; i++) this.indices.push(base + i);
    }
    this.vcount += pos.count;
    geo.dispose();
  }

  // Axis-aligned box given centre + size (in builder space; x mirrored for stations).
  box(cx, cy, cz, sx, sy, sz, color, { emissive = false, rotY = 0, rotX = 0, rotZ = 0, seg = this.maxSeg } = {}) {
    const g = new THREE.BoxGeometry(
      sx, sy, sz,
      Math.min(12, Math.max(1, Math.ceil(sx / seg))),
      Math.min(12, Math.max(1, Math.ceil(sy / seg))),
      Math.min(12, Math.max(1, Math.ceil(sz / seg)))
    );
    _e.set(rotX, rotY * this.mirrorX, rotZ * this.mirrorX);
    _q.setFromEuler(_e);
    _m.compose(_p.set(cx * this.mirrorX, cy, cz), _q, _s.set(1, 1, 1));
    this.addGeometry(g, _m, color, emissive);
  }

  // Box defined by min/max corners (x in builder space before mirroring).
  boxMM(x0, y0, z0, x1, y1, z1, color, opts) {
    this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color, opts);
  }

  cylinder(cx, cy, cz, rTop, rBot, h, color, { emissive = false, radial = 10, rotX = 0, rotZ = 0, open = false } = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, radial, Math.max(1, Math.ceil(h / 2)), open);
    _e.set(rotX, 0, rotZ * this.mirrorX);
    _q.setFromEuler(_e);
    _m.compose(_p.set(cx * this.mirrorX, cy, cz), _q, _s.set(1, 1, 1));
    this.addGeometry(g, _m, color, emissive);
  }

  sphere(cx, cy, cz, r, color, { emissive = false, sx = 1, sy = 1, sz = 1, detail = 1 } = {}) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    _m.compose(_p.set(cx * this.mirrorX, cy, cz), _q.identity(), _s.set(sx, sy, sz));
    this.addGeometry(g, _m, color, emissive);
  }

  cone(cx, cy, cz, r, h, color, { emissive = false, radial = 7 } = {}) {
    const g = new THREE.ConeGeometry(r, h, radial);
    _m.compose(_p.set(cx * this.mirrorX, cy, cz), _q.identity(), _s.set(1, 1, 1));
    this.addGeometry(g, _m, color, emissive);
  }

  torus(cx, cy, cz, r, tube, color, { emissive = true, rotX = Math.PI / 2, seg = 32 } = {}) {
    const g = new THREE.TorusGeometry(r, tube, 6, seg);
    _e.set(rotX, 0, 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(cx * this.mirrorX, cy, cz), _q, _s.set(1, 1, 1));
    this.addGeometry(g, _m, color, emissive);
  }

  // Flat quad facing +Y (floor decal), or any orientation via rot.
  plane(cx, cy, cz, w, h, color, { emissive = false, rotX = -Math.PI / 2, rotY = 0 } = {}) {
    const g = new THREE.PlaneGeometry(w, h, Math.max(1, Math.ceil(w / this.maxSeg)), Math.max(1, Math.ceil(h / this.maxSeg)));
    _e.set(rotX, rotY * this.mirrorX, 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(cx * this.mirrorX, cy, cz), _q, _s.set(1, 1, 1));
    this.addGeometry(g, _m, color, emissive);
  }

  // A raw matrix-placed geometry (already world/builder-space; not mirrored).
  addRaw(geo, matrix, color, emissive = false) {
    this.addGeometry(geo, matrix, color, emissive);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    if (this.vcount > 65535) g.setIndex(new THREE.Uint32BufferAttribute(this.indices, 1));
    else g.setIndex(new THREE.Uint16BufferAttribute(this.indices, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  get empty() {
    return this.vcount === 0;
  }
}

export const materials = {
  solid: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glass: new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
  additive: new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  }),
};

export function builderMesh(builder, material = materials.solid) {
  if (builder.empty) return null;
  const mesh = new THREE.Mesh(builder.build(), material);
  mesh.matrixAutoUpdate = false;
  return mesh;
}

export { mergeGeometries };
