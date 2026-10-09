import * as THREE from 'three';

// Walkable areas are axis-aligned rectangles in the local space of an
// Object3D (a station group, a train car...). The player is kept inside the
// union of enabled rectangles and pushed out of blocker boxes. When the
// rectangle the player stands in belongs to a moving object (a train), the
// player rig is re-parented to it so they ride along.
export const PLAYER_RADIUS = 0.22;
const STEP_TOLERANCE = 0.9;

const _l = new THREE.Vector3();
const _w = new THREE.Vector3();

export class NavRect {
  // y0/y1: floor height at z0/z1 (slopes along z), or slopeAxis 'x' for x
  constructor(object, x0, x1, z0, z1, y0 = 0, y1 = y0, slopeAxis = 'z') {
    this.object = object;
    this.x0 = Math.min(x0, x1);
    this.x1 = Math.max(x0, x1);
    this.z0 = Math.min(z0, z1);
    this.z1 = Math.max(z0, z1);
    const flip = slopeAxis === 'z' ? z0 > z1 : x0 > x1;
    this.y0 = flip ? y1 : y0;
    this.y1 = flip ? y0 : y1;
    this.slopeAxis = slopeAxis;
    this.enabled = true;
    this.inv = new THREE.Matrix4();
  }
  floorAt(x, z) {
    if (this.y0 === this.y1) return this.y0;
    const t = this.slopeAxis === 'z' ? (z - this.z0) / (this.z1 - this.z0) : (x - this.x0) / (this.x1 - this.x0);
    return this.y0 + (this.y1 - this.y0) * Math.min(1, Math.max(0, t));
  }
}

export class NavBlocker {
  constructor(object, x0, x1, z0, z1, yMin = -0.5, yMax = 2.5) {
    this.object = object;
    this.x0 = Math.min(x0, x1);
    this.x1 = Math.max(x0, x1);
    this.z0 = Math.min(z0, z1);
    this.z1 = Math.max(z0, z1);
    this.yMin = yMin;
    this.yMax = yMax;
    this.enabled = true;
  }
}

export class Nav {
  constructor() {
    this.rects = [];
    this.blockers = [];
  }

  addRect(...args) {
    const r = new NavRect(...args);
    this.rects.push(r);
    return r;
  }

  // Mirror helper for station layouts where the platform side flips.
  addRectM(object, side, a0, a1, z0, z1, y0 = 0, y1 = y0, slopeAxis = 'z') {
    if (slopeAxis === 'x' && side < 0) return this.addRect(object, side * a0, side * a1, z0, z1, y0, y1, 'x');
    return this.addRect(object, side * a0, side * a1, z0, z1, y0, y1, slopeAxis);
  }

  addBlocker(...args) {
    const b = new NavBlocker(...args);
    this.blockers.push(b);
    return b;
  }

  addBlockerM(object, side, a0, a1, z0, z1, yMin, yMax) {
    return this.addBlocker(object, side * a0, side * a1, z0, z1, yMin, yMax);
  }

  // Find the closest valid standing point to `target` (world, at feet height).
  // Returns { rect, local: Vector3 (in rect.object space, y = floor) } or null.
  resolve(target, currentObject) {
    const r = PLAYER_RADIUS;
    let best = null, bestD = Infinity;
    const cache = new Map();
    for (const rect of this.rects) {
      if (!rect.enabled) continue;
      let inv = cache.get(rect.object);
      if (!inv) {
        inv = rect.inv.copy(rect.object.matrixWorld).invert();
        cache.set(rect.object, inv.clone());
      }
      _l.copy(target).applyMatrix4(inv);
      const cx = Math.min(Math.max(_l.x, rect.x0 + r), rect.x1 - r);
      const cz = Math.min(Math.max(_l.z, rect.z0 + r), rect.z1 - r);
      const fy = rect.floorAt(cx, cz);
      if (Math.abs(_l.y - fy) > STEP_TOLERANCE) continue;
      let d = (cx - _l.x) ** 2 + (cz - _l.z) ** 2;
      if (rect.object === currentObject) d -= 1e-6;
      if (d < bestD) {
        bestD = d;
        best = { rect, local: new THREE.Vector3(cx, fy, cz) };
      }
    }
    if (!best) return null;
    // push out of blockers living in the same object space
    for (let iter = 0; iter < 2; iter++) {
      for (const b of this.blockers) {
        if (!b.enabled || b.object !== best.rect.object) continue;
        const p = best.local;
        if (p.y < b.yMin || p.y > b.yMax) continue;
        const x0 = b.x0 - r, x1 = b.x1 + r, z0 = b.z0 - r, z1 = b.z1 + r;
        if (p.x <= x0 || p.x >= x1 || p.z <= z0 || p.z >= z1) continue;
        const dx0 = p.x - x0, dx1 = x1 - p.x, dz0 = p.z - z0, dz1 = z1 - p.z;
        const m = Math.min(dx0, dx1, dz0, dz1);
        if (m === dx0) p.x = x0;
        else if (m === dx1) p.x = x1;
        else if (m === dz0) p.z = z0;
        else p.z = z1;
      }
    }
    return best;
  }

  worldOf(res) {
    return _w.copy(res.local).applyMatrix4(res.rect.object.matrixWorld);
  }
}
