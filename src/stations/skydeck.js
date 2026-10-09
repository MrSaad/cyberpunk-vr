import * as THREE from 'three';
import { buildPlatform, glassWallA, glassWallZ } from './common.js';
import { NEON, NEON_LIST, col } from '../palette.js';
import { SIGN_CELLS } from '../textures.js';

// Open-air observation deck with a neon garden on top of a tower. The highest
// point on the loop. Deck spans a = 10..50, z = -28..28.
export function buildSkydeck(ctx) {
  const { solid: b, glass: g, glow } = ctx;
  const H = ctx.H;
  const r = ctx.env.people.rng;

  for (let a = 16; a <= 46; a += 10) for (const z of [-18, 0, 18]) ctx.light(a, 3.5, z, 0xc8e8ff, 0.35, 7);
  for (const [a, z, c] of [[20, -20, NEON.green], [20, 20, NEON.pink], [40, -20, NEON.cyan], [40, 20, NEON.purple]]) ctx.light(a, 1.2, z, c, 0.8, 5);
  ctx.light(30, 5, 0, NEON.green, 0.6, 9);

  buildPlatform(ctx, { openings: [[-6, 6]], accent: NEON.green });

  // deck slab
  b.boxMM(9.95, -1.0, -28, 50, 0, 28, 0x2a2834);
  b.boxMM(10, 0, -27.9, 49.9, 0.01, 27.9, 0x34313f);
  for (let a = 15; a < 50; a += 5) b.boxMM(a - 0.04, 0.01, -27, a + 0.04, 0.02, 27, col(NEON.green, 0.35), { emissive: true });
  b.boxMM(49.9, -1.0, -28, 50.05, -0.8, 28, col(NEON.green, 1.3), { emissive: true });

  // railings around the deck (platform side has an opening)
  const railC = new THREE.Color(0.62, 0.62, 0.6);
  const rail = (a0, a1, z0, z1) => {
    g.boxMM(a0, 0, z0, a1, 1.2, z1, railC);
    b.boxMM(a0 - 0.03, 1.2, z0 - 0.03, a1 + 0.03, 1.26, z1 + 0.03, col(NEON.green, 1.2), { emissive: true });
  };
  rail(49.85, 49.9, -28, 28);
  rail(10, 49.9, -28, -27.95);
  rail(10, 49.9, 27.95, 28);
  rail(10, 10.05, -28, -22);
  rail(10, 10.05, 22, 28);

  // viewing podium + ramp
  b.boxMM(38, 0, -8, 48, 1.5, 8, 0x2e2b38);
  b.boxMM(38, 1.5, -8, 48, 1.52, 8, 0x3c3848);
  b.boxMM(37.95, 1.45, -8, 38.0, 1.5, 8, col(NEON.cyan, 1.2), { emissive: true });
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a0 = 30 + (8 * i) / steps;
    b.boxMM(a0, 0, -3, a0 + 8 / steps + 0.01, (1.5 * (i + 1)) / steps, 3, 0x2e2b38);
  }
  for (const z of [-3, 3]) b.boxMM(30, 0.02, z - 0.03, 38, 0.06, z + 0.03, col(NEON.cyan, 1.1), { emissive: true });
  rail(47.9, 47.95, -8, 8);
  ctx.rect(30, 38.2, -3, 3, 0, 1.5, 'x');
  ctx.rect(37.8, 47.8, -7.9, 7.9, 1.5);
  ctx.blocker(31.6, 38, -3.2, 3.2, -0.5, 0.25);
  ctx.blocker(38, 48, -8.1, 8.1, -0.5, 1.0);
  ctx.blocker(37.8, 38.2, -8.1, -3.0, 1.2, 2.5);
  ctx.blocker(37.8, 38.2, 3.0, 8.1, 1.2, 2.5);

  // neon garden planters
  const plant = (a, z, color) => {
    b.boxMM(a - 1.6, 0, z - 1.6, a + 1.6, 0.6, z + 1.6, 0x25232c);
    b.boxMM(a - 1.62, 0.55, z - 1.62, a + 1.62, 0.6, z + 1.62, col(color, 1.0), { emissive: true });
    b.boxMM(a - 1.5, 0.6, z - 1.5, a + 1.5, 0.62, z + 1.5, 0x101418);
    const n = r.int(2, 4);
    for (let i = 0; i < n; i++) {
      const pa = a + r.float(-0.9, 0.9), pz = z + r.float(-0.9, 0.9);
      const h = r.float(1.6, 3.4);
      b.cylinder(pa, 0.6 + h / 2, pz, 0.05, 0.08, h, 0x1a1a22, { radial: 5 });
      const fc = col(color, r.float(0.3, 0.55));
      b.sphere(pa, 0.6 + h, pz, r.float(0.5, 0.9), fc, { emissive: true, sy: 0.7, detail: 0 });
      glow.sphere(pa, 0.6 + h, pz, 1.4, col(color, 0.035), { emissive: true, detail: 1 });
    }
    for (let i = 0; i < 6; i++) b.cone(a + r.float(-1.2, 1.2), 0.85, z + r.float(-1.2, 1.2), 0.18, 0.5, col(color, 0.6), { emissive: true, radial: 5 });
    ctx.blocker(a - 1.7, a + 1.7, z - 1.7, z + 1.7);
  };
  const cols = [NEON.green, NEON.pink, NEON.cyan, NEON.purple];
  let ci = 0;
  for (const a of [18, 26, 34, 44]) for (const z of [-20, 20]) plant(a, z, cols[ci++ % 4]);
  plant(18, -10, NEON.green);
  plant(18, 10, NEON.pink);

  // benches facing outward
  for (const z of [-14, 14]) {
    for (const a of [26, 34]) {
      b.boxMM(a - 2, 0, z - 0.4, a + 2, 0.45, z + 0.4, 0x3a3048);
      ctx.blocker(a - 2.05, a + 2.05, z - 0.45, z + 0.45);
    }
  }
  // coin telescopes at the far railing
  for (const z of [-20, -12, 12, 20]) {
    b.cylinder(48.6, 0.55, z, 0.08, 0.12, 1.1, 0x55556a, { radial: 8 });
    b.box(48.6, 1.25, z, 0.5, 0.3, 0.3, 0x707088, { rotZ: -0.3 });
    b.box(48.85, 1.33, z, 0.04, 0.12, 0.2, col(NEON.yellow, 1.2), { emissive: true });
    ctx.blocker(48.3, 48.9, z - 0.3, z + 0.3);
  }

  // kiosk bar
  b.boxMM(12, 0, 22, 18, 1.05, 26, 0x1e1b26);
  b.boxMM(11.9, 1.05, 21.9, 18.1, 1.12, 26.1, 0x5a4a6a);
  b.boxMM(12, 0.1, 21.88, 18, 0.16, 21.9, col(NEON.pink, 1.4), { emissive: true });
  b.boxMM(12, 2.8, 21.5, 18, 3.0, 26.5, 0x2a2733);
  for (const [a, z] of [[12.1, 21.6], [17.9, 21.6], [12.1, 26.4], [17.9, 26.4]]) b.box(a, 1.4, z, 0.12, 2.8, 0.12, 0x2a2733);
  ctx.sign(15, 3.4, 21.5, Math.PI, 4.5, 1.0, 6 + 14, NEON.pink);
  ctx.blocker(11.8, 18.2, 21.8, 26.6);
  ctx.person([15, 0, 25], [15, 0, 20], 3, { jacket: 0x101010, neon: NEON.pink });
  ctx.shelter(11.5, 18.5, 0, 2.8, 21.5, 26.5);

  // central hologram sculpture
  const rings = [];
  const ringMat = (c) => new THREE.MeshBasicMaterial({ color: col(c, 0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const [rad, c] of [[2.6, NEON.green], [2.0, NEON.cyan], [1.4, NEON.pink]]) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.05, 6, 48), ringMat(c));
    m.position.copy(ctx.v(28, 5.5, 0));
    ctx.group.add(m);
    rings.push(m);
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshBasicMaterial({ color: col(NEON.green, 0.4), wireframe: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.copy(ctx.v(28, 5.5, 0));
  ctx.group.add(core);
  b.cylinder(28, 0.3, 0, 1.4, 1.6, 0.6, 0x22202a, { radial: 20 });
  b.torus(28, 0.62, 0, 1.45, 0.04, col(NEON.green, 1.3));
  glow.cylinder(28, 3.0, 0, 0.6, 1.3, 4.8, col(NEON.green, 0.12), { open: true, radial: 20 });
  ctx.blocker(26.4, 29.6, -1.6, 1.6);
  ctx.halo(28, 5.5, 0, col(NEON.green, 0.25), 6, 3);
  ctx.updaters.push((t) => {
    rings[0].rotation.set(t * 0.5, t * 0.3, 0);
    rings[1].rotation.set(-t * 0.4, 0, t * 0.6);
    rings[2].rotation.set(0, t * 0.8, t * 0.35);
    core.rotation.set(t * 0.2, t * 0.5, 0);
    core.position.y = 5.5 + Math.sin(t * 0.8) * 0.3;
  });

  // big sign on the deck edge facing the city
  ctx.sign(50.2, -4, 0, Math.PI / 2, 26, 5.4, ctx.st.cell, NEON.green);
  // visitors
  for (let i = 0; i < 6; i++) {
    const z = r.float(-26, 26);
    ctx.person([49.2, 0, z], [55, 0, z + r.float(-3, 3)], 3);
  }
  for (let i = 0; i < 4; i++) {
    const z = r.float(-6, 6);
    ctx.person([47, 1.5, z], [55, 1.5, z], r.chance(0.5) ? 1 : 3);
  }
  for (let i = 0; i < 7; i++) {
    const z = r.float(-12, 12);
    ctx.person([r.float(12, 22), 0, z], [r.float(40, 46), 0, z + r.float(-4, 4)], 0, { speed: r.float(0.8, 1.2) });
  }
  for (const z of [-14, 14]) ctx.person([26.5, 0.0, z], [26.5, 0, z + Math.sign(z) * 3], 2);

  // tower + mast
  ctx.tower(8, 52, -30, 30, -H, -1.0, [2, 77, 0.4, 7]);
  b.box(46, 12, -24, 0.8, 24, 0.8, 0x2a2a35);
  ctx.halo(46, 24, -24, new THREE.Color(1, 0.05, 0.05), 3, 1);

  ctx.rect(10.3, 49.75, -27.8, 27.8, 0);
  ctx.rect(9.5, 10.8, -6, 6, 0);
  ctx.zone(4, 56, -34, 34, { yMin: 0, yMax: H + 30 });
}
