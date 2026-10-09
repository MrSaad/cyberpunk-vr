import * as THREE from 'three';
import { MeshBuilder, materials, builderMesh } from '../builder.js';
import { TextPanel } from '../textures.js';
import { DOOR_Z, DOOR_WIDTH } from '../route.js';
import { NEON, col } from '../palette.js';

// Station-local coordinates: +z runs along the track (direction of travel),
// `a` is the distance from the track centreline toward the platform side.
// Everything is written in (a, y, z) and mirrored to the actual side.
export class StationContext {
  constructor(station, env) {
    this.st = station;
    this.env = env;
    this.side = station.sideSign;
    this.group = new THREE.Group();
    this.group.name = `station-${station.id}`;
    this.group.position.copy(station.position);
    this.group.quaternion.copy(station.quaternion);
    this.group.updateMatrixWorld(true);
    this.yaw = new THREE.Euler().setFromQuaternion(station.quaternion, 'YXZ').y;
    this.H = station.position.y;
    const amb = new THREE.Color(0.2, 0.17, 0.27);
    this.solid = new MeshBuilder({ ambient: amb, maxSeg: 1.6 });
    this.solid.mirrorX = this.side;
    this.glass = new MeshBuilder({ maxSeg: 1e9 });
    this.glass.mirrorX = this.side;
    this.glow = new MeshBuilder({ maxSeg: 1e9 });
    this.glow.mirrorX = this.side;
    this.updaters = [];
    this.spawn = null;
  }

  v(a, y, z) {
    return new THREE.Vector3(a * this.side, y, z);
  }
  world(a, y, z) {
    return this.v(a, y, z).applyMatrix4(this.group.matrixWorld);
  }
  // world matrix for a plane at (a,y,z) facing local direction `yaw` (0 = +z, PI/2 = +a)
  matrixAt(a, y, z, yaw, pitch = 0) {
    const m = new THREE.Matrix4();
    const e = new THREE.Euler(pitch, yaw * this.side, 0, 'YXZ');
    m.makeRotationFromEuler(e).setPosition(this.v(a, y, z));
    return new THREE.Matrix4().multiplyMatrices(this.group.matrixWorld, m);
  }
  sign(a, y, z, yaw, w, h, cell, color, opts = {}) {
    this.env.signs.add(this.matrixAt(a, y, z, yaw), w, h, cell, color, opts);
  }
  screen(a, y, z, yaw, w, h, cell, ca, cb) {
    this.env.screens.add(this.matrixAt(a, y, z, yaw), w, h, cell, ca, cb, Math.random());
  }
  halo(a, y, z, color, size, mode = 0) {
    this.env.halos.add(this.world(a, y, z), new THREE.Color(color), size, mode, Math.random());
  }
  light(a, y, z, color, intensity = 1, range = 6) {
    this.solid.addLight(a, y, z, color, intensity, range);
  }
  person(a, b, pose = 0, opts = {}) {
    this.env.people.add({ a: this.world(...a), b: this.world(...b), pose, ...opts });
  }
  rect(a0, a1, z0, z1, y0 = 0, y1 = y0, axis = 'z') {
    return this.env.nav.addRectM(this.group, this.side, a0, a1, z0, z1, y0, y1, axis);
  }
  blocker(a0, a1, z0, z1, yMin = -0.5, yMax = 2.5) {
    return this.env.nav.addBlockerM(this.group, this.side, a0, a1, z0, z1, yMin, yMax);
  }
  poly(a0, a1, z0, z1) {
    return [[a0, z0], [a1, z0], [a1, z1], [a0, z1]].map(([a, z]) => {
      const w = this.world(a, 0, z);
      return [w.x, w.z];
    });
  }
  // keep generated city buildings out of (or below) this footprint
  zone(a0, a1, z0, z1, { kind = 'exclude', maxH = 0, yMin = -1e9, yMax = 1e9 } = {}) {
    this.env.zones.push({ kind, maxH, poly: this.poly(a0, a1, z0, z1) });
    if (kind === 'exclude') this.env.obstacles.push({ poly: this.poly(a0, a1, z0, z1), yMin, yMax });
  }
  obstacle(a0, a1, z0, z1, yMin, yMax) {
    this.env.obstacles.push({ poly: this.poly(a0, a1, z0, z1), yMin: this.H + yMin, yMax: this.H + yMax });
  }
  // A procedural-shader tower aligned with the station (y relative to platform)
  tower(a0, a1, z0, z1, y0, y1, style) {
    const c = this.world((a0 + a1) / 2, 0, (z0 + z1) / 2);
    this.env.buildings.addBox(c.x, this.H + y0, c.z, Math.abs(a1 - a0), y1 - y0, Math.abs(z1 - z0), this.yaw, style);
  }
  shelter(a0, a1, y0, y1, z0, z1) {
    const c = this.v((a0 + a1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.env.rain.addShelter(this.group, c, new THREE.Vector3(Math.abs(a1 - a0) / 2, (y1 - y0) / 2, Math.abs(z1 - z0) / 2));
  }
  textPanel(a, y, z, yaw, w, h, pw = 512, ph = 256) {
    const panel = new TextPanel(pw, ph);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: panel.texture }));
    m.position.copy(this.v(a, y, z));
    m.rotation.set(0, yaw * this.side, 0);
    this.group.add(m);
    return panel;
  }
  finish() {
    const s = builderMesh(this.solid);
    if (s) this.group.add(s);
    const g = builderMesh(this.glass, materials.glass);
    if (g) { g.renderOrder = 3; this.group.add(g); }
    const gl = builderMesh(this.glow, materials.additive);
    if (gl) { gl.renderOrder = 4; this.group.add(gl); }
    this.env.scene.add(this.group);
  }
}

// ---------------------------------------------------------------------------
// Shared skytrain platform: deck, canopy, screen doors, displays, signs.
// Platform spans a = 1.95 .. 9.95 and z = -22 .. 22 at floor height 0.
// openings: z ranges along the back edge (a = 9.95) that lead somewhere.
// ---------------------------------------------------------------------------
export function buildPlatform(ctx, { openings = [], accent = NEON.magenta, supports = true, endGap = null } = {}) {
  const { solid: b, glass: g } = ctx;
  const st = ctx.st;
  const A0 = 1.95, A1 = 9.95, Z = 22;
  const acc = new THREE.Color(accent);
  // lights must exist before geometry: they are baked into vertex colours
  for (let zz = -Z + 2; zz <= Z - 2; zz += 8) ctx.light(5.8, 3.2, zz, 0xfff0e0, 0.9, 5);
  ctx.light(2.3, 2.5, 0, accent, 0.5, 8);
  b.boxMM(A0, -0.7, -Z, A1, 0, Z, 0x2a2733);
  b.boxMM(A0 + 0.05, 0, -Z + 0.05, A1 - 0.05, 0.01, Z - 0.05, 0x3a3644);
  // safety strip
  b.boxMM(2.45, 0.01, -Z + 0.3, 2.6, 0.02, Z - 0.3, col(NEON.yellow, 0.9), { emissive: true });
  // edge glow under the deck
  b.boxMM(A0 - 0.02, -0.5, -Z, A0, -0.4, Z, acc.clone().multiplyScalar(1.2), { emissive: true });
  b.boxMM(A1, -0.5, -Z, A1 + 0.02, -0.4, Z, acc.clone().multiplyScalar(1.2), { emissive: true });

  // platform screen doors
  const gaps = DOOR_Z.map((dz) => [dz - DOOR_WIDTH / 2, dz + DOOR_WIDTH / 2]);
  let z = -Z + 0.5;
  const spans = [];
  for (const [a, c] of gaps) { spans.push([z, a]); z = c; }
  spans.push([z, Z - 0.5]);
  for (const [z0, z1] of spans) {
    g.boxMM(2.06, 0, z0, 2.1, 2.1, z1, new THREE.Color(0.55, 0.85, 1.0));
    b.boxMM(2.03, 2.1, z0, 2.13, 2.2, z1, 0x24222c);
  }
  for (const [a, c] of gaps) {
    for (const zz of [a, c]) b.box(2.08, 1.2, zz, 0.12, 2.4, 0.12, 0x24222c);
    b.boxMM(2.02, 2.25, a, 2.14, 2.4, c, 0x24222c);
    b.boxMM(2.01, 2.27, a + 0.1, 2.02, 2.38, c - 0.1, col(NEON.yellow, 1.1), { emissive: true });
  }
  b.boxMM(2.02, 2.2, -Z + 0.5, 2.14, 2.4, Z - 0.5, 0x1e1c26);

  // door leaves (animated)
  const leafGeo = new THREE.BoxGeometry(0.04, 2.05, DOOR_WIDTH / 2);
  leafGeo.translate(0, 1.04, 0);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshBasicMaterial({ color: 0x5a7a90, transparent: true, opacity: 0.45, depthWrite: false }), DOOR_Z.length * 2);
  leaves.renderOrder = 3;
  leaves.frustumCulled = false;
  ctx.group.add(leaves);
  const gapRects = DOOR_Z.map((dz) => {
    const r = ctx.rect(1.8, 3.0, dz - DOOR_WIDTH / 2, dz + DOOR_WIDTH / 2, 0);
    r.enabled = false;
    return r;
  });
  const m = new THREE.Matrix4();
  let lastOpen = -1;
  const setDoors = (open) => {
    if (open === lastOpen) return;
    lastOpen = open;
    let i = 0;
    for (const dz of DOOR_Z) {
      for (const dir of [-1, 1]) {
        m.makeTranslation(2.08 * ctx.side, 0, dz + dir * (DOOR_WIDTH / 4 + open * (DOOR_WIDTH / 2 - 0.05)));
        leaves.setMatrixAt(i++, m);
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    for (const r of gapRects) r.enabled = open > 0.85;
  };
  setDoors(0);

  // canopy
  const CH = 3.7;
  b.boxMM(A0 - 0.2, CH, -Z, A1 + 0.3, CH + 0.25, Z, 0x1d1b24);
  b.boxMM(A0 - 0.2, CH - 0.02, -Z, A0 - 0.05, CH + 0.25, Z, acc.clone().multiplyScalar(1.3), { emissive: true });
  for (const a of [4.2, 7.4]) b.boxMM(a - 0.1, CH - 0.06, -Z + 1, a + 0.1, CH, Z - 1, new THREE.Color(1.0, 0.95, 0.9), { emissive: true });
  for (let zz = -Z + 2; zz <= Z - 2; zz += 8) b.box(9.55, CH / 2, zz, 0.25, CH, 0.25, 0x2d2a36);

  // back railing (except openings)
  const openSpans = [...openings].sort((p, q) => p[0] - q[0]);
  let zr = -Z;
  const rail = [];
  for (const [a, c] of openSpans) { rail.push([zr, a]); zr = c; }
  rail.push([zr, Z]);
  for (const [z0, z1] of rail) {
    if (z1 - z0 < 0.05) continue;
    g.boxMM(9.85, 0, z0, 9.9, 1.1, z1, new THREE.Color(0.5, 0.8, 1.0));
    b.boxMM(9.82, 1.1, z0, 9.93, 1.16, z1, acc.clone().multiplyScalar(1.1), { emissive: true });
  }
  for (const zz of [-Z, Z]) {
    const segs = zz > 0 && endGap ? [[A0, endGap[0]], [endGap[1], A1]] : [[A0, A1]];
    for (const [s0, s1] of segs) {
      if (s1 - s0 < 0.05) continue;
      g.boxMM(s0, 0, zz - 0.03, s1, 1.1, zz + 0.03, new THREE.Color(0.5, 0.8, 1.0));
      b.boxMM(s0, 1.1, zz - 0.05, s1, 1.16, zz + 0.05, acc.clone().multiplyScalar(1.1), { emissive: true });
    }
  }

  // benches
  for (const zz of [-16, -4, 4, 16]) {
    if (openSpans.some(([a, c]) => zz > a - 2 && zz < c + 2)) continue;
    b.boxMM(8.6, 0, zz - 1.5, 9.4, 0.45, zz + 1.5, 0x3a3048);
    ctx.blocker(8.5, 9.95, zz - 1.55, zz + 1.55);
  }

  // station name signs: one facing the track (readable from the train), one on the platform
  ctx.sign(2.15, 3.05, -8, -Math.PI / 2, 5.6, 1.1, st.cell, accent);
  ctx.sign(2.15, 3.05, 8, -Math.PI / 2, 5.6, 1.1, st.cell, accent);
  ctx.sign(2.25, 3.05, -8, Math.PI / 2, 5.6, 1.1, st.cell, accent);
  ctx.sign(2.25, 3.05, 8, Math.PI / 2, 5.6, 1.1, st.cell, accent);

  // departure boards
  const boards = [];
  for (const zz of [-12.5, 12.5]) {
    b.boxMM(5.3, 2.4, zz - 0.06, 7.7, 3.7, zz + 0.06, 0x101018);
    boards.push(ctx.textPanel(6.5, 2.8, zz + 0.07, 0, 2.2, 0.75, 512, 192));
    boards.push(ctx.textPanel(6.5, 2.8, zz - 0.07, Math.PI, 2.2, 0.75, 512, 192));
  }

  // supports under the track and platform
  if (supports) {
    const depth = ctx.H - 0.7;
    for (const zz of [-18, 18]) {
      b.box(0, -0.7 - depth / 2, zz, 3.2, depth, 3.2, 0x2b2933, { seg: 1e9 });
      b.box(6, -0.7 - depth / 2, zz, 2.6, depth, 2.6, 0x2b2933, { seg: 1e9 });
      b.box(1.62, -0.7 - depth / 2, zz, 0.06, depth, 0.5, acc.clone().multiplyScalar(1.2), { emissive: true, seg: 1e9 });
    }
    b.boxMM(-1.8, -2.4, -22, 9.95, -0.7, 22, 0x24222c);
  }

  // nav + rain + zoning
  ctx.rect(2.35, 9.95, -Z + 0.1, Z - 0.1, 0);
  ctx.shelter(A0 - 0.2, A1 + 0.3, 0, CH, -Z, Z);
  ctx.zone(-6, 12, -45, 45, { yMin: ctx.H - 30, yMax: ctx.H + 10 });

  // a few waiting commuters
  const r = ctx.env.people.rng;
  for (let i = 0; i < 4; i++) {
    const zz = r.float(-19, 19);
    ctx.person([r.float(3.2, 8.5), 0, zz], [2, 0, zz + r.float(-3, 3)], r.chance(0.6) ? 1 : 3);
  }

  ctx.updaters.push((t, trains) => {
    let open = 0;
    for (const tr of trains.trains) if (tr.state && tr.state.docked === st) open = Math.max(open, tr.state.door);
    setDoors(open);
  });
  let lastBoard = -1;
  ctx.updaters.push((t) => {
    if (Math.abs(t - lastBoard) < 0.5) return;
    lastBoard = t;
    const s = ctx.env.route.stationStatus(st, t);
    const lines = s.boarding != null
      ? [{ text: 'SKYTRAIN · LOOP', color: accent instanceof THREE.Color ? '#fcee0a' : '#' + new THREE.Color(accent).getHexString(), size: 34 },
         { text: `▸ ${s.next.name}`, color: '#ffffff', size: 40 },
         { text: `BOARDING · ${Math.ceil(s.boarding)}s`, color: '#05ffa1', size: 34 }]
      : [{ text: 'SKYTRAIN · LOOP', color: '#' + new THREE.Color(accent).getHexString(), size: 34 },
         { text: `▸ ${s.next.name}`, color: '#ffffff', size: 40 },
         { text: `NEXT TRAIN ${fmt(s.wait)}`, color: '#fcee0a', size: 34 }];
    for (const p of boards) p.draw(lines, { accent: '#' + new THREE.Color(accent).getHexString() });
  });
}

function fmt(s) {
  s = Math.ceil(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Glass wall helper with mullions (a-axis wall at fixed a, spanning z)
export function glassWallA(ctx, a, z0, z1, y0, y1, mullion = 3, frame = 0x1a1820) {
  ctx.glass.boxMM(a - 0.02, y0, z0, a + 0.02, y1, z1, new THREE.Color(0.45, 0.7, 0.95));
  const n = Math.max(1, Math.round((z1 - z0) / mullion));
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    ctx.solid.box(a, (y0 + y1) / 2, z, 0.1, y1 - y0, 0.1, frame);
  }
  ctx.solid.boxMM(a - 0.06, y0, z0, a + 0.06, y0 + 0.08, z1, frame);
  ctx.solid.boxMM(a - 0.06, y1 - 0.08, z0, a + 0.06, y1, z1, frame);
}
// Glass wall at fixed z, spanning a
export function glassWallZ(ctx, z, a0, a1, y0, y1, mullion = 3, frame = 0x1a1820) {
  ctx.glass.boxMM(a0, y0, z - 0.02, a1, y1, z + 0.02, new THREE.Color(0.45, 0.7, 0.95));
  const n = Math.max(1, Math.round(Math.abs(a1 - a0) / mullion));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    ctx.solid.box(a, (y0 + y1) / 2, z, 0.1, y1 - y0, 0.1, frame);
  }
  ctx.solid.boxMM(a0, y0, z - 0.06, a1, y0 + 0.08, z + 0.06, frame);
  ctx.solid.boxMM(a0, y1 - 0.08, z - 0.06, a1, y1, z + 0.06, frame);
}

// Sliding glass door in a wall at fixed `a`, spanning z0..z1. Opens when the
// player comes close.
const doorMat = new THREE.MeshBasicMaterial({ color: 0x6a8aa8, transparent: true, opacity: 0.35, depthWrite: false });
export function autoDoor(ctx, a, z0, z1, h = 2.6, color = NEON.cyan) {
  const w = (z1 - z0) / 2;
  const geo = new THREE.BoxGeometry(0.05, h, w);
  geo.translate(0, h / 2, 0);
  const left = new THREE.Mesh(geo, doorMat);
  const right = new THREE.Mesh(geo, doorMat);
  left.renderOrder = right.renderOrder = 3;
  ctx.group.add(left, right);
  ctx.solid.boxMM(a - 0.15, h, z0 - 0.1, a + 0.15, h + 0.12, z1 + 0.1, col(color, 1.2), { emissive: true });
  for (const z of [z0, z1]) ctx.solid.box(a, h / 2, z, 0.3, h, 0.1, col(color, 1.2), { emissive: true });
  const centre = ctx.world(a, 1, (z0 + z1) / 2);
  let open = 0;
  const place = () => {
    left.position.copy(ctx.v(a, 0, z0 + w / 2 - open * w * 0.95));
    right.position.copy(ctx.v(a, 0, z1 - w / 2 + open * w * 0.95));
  };
  place();
  ctx.updaters.push((t, trains, player, dt) => {
    const target = player && player.distanceTo(centre) < 3.6 ? 1 : 0;
    const next = open + Math.sign(target - open) * Math.min(Math.abs(target - open), dt * 2.5);
    if (next !== open) { open = next; place(); }
  });
}
