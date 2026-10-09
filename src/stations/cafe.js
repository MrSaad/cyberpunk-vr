import * as THREE from 'three';
import { buildPlatform, glassWallA, glassWallZ, autoDoor } from './common.js';
import { NEON, col } from '../palette.js';
import { SIGN_CELLS } from '../textures.js';

// Kafe 22: a cosy neon coffee bar halfway up a tower, glass on three sides.
// Interior spans a = 10.4..26, z = -12..12.
export function buildCafe(ctx) {
  const { solid: b, glow } = ctx;
  const H = ctx.H;
  const r = ctx.env.people.rng;
  const CEIL = 3.8;
  const TABLES = [[22.5, -6], [22.5, -1], [22.5, 4], [17, 3], [17, 8], [22.5, 9]];

  // lights
  for (const [a, z] of TABLES) ctx.light(a, 2.6, z, 0xffb070, 0.7, 2.8);
  for (const a of [13, 16, 19]) ctx.light(a, 3.2, -9, 0xffd0a0, 0.6, 3.5);
  ctx.light(11, 2.4, 6, NEON.purple, 0.8, 5);
  ctx.light(27, 2, 0, NEON.pink, 0.5, 10);
  ctx.light(16, 0.5, -9.3, NEON.purple, 0.6, 2.5);

  buildPlatform(ctx, { openings: [[-1.2, 1.2]], accent: NEON.purple });

  // shell
  b.boxMM(10, -0.4, -12.4, 26.4, 0, 12.4, 0x2a2026);
  b.boxMM(10.4, 0, -12, 26, 0.01, 12, 0x3a2a2a);
  // checker tiles near the counter
  for (let a = 11; a < 20; a += 1) for (let z = -8.6; z < -6; z += 1) if ((Math.floor(a) + Math.floor(z)) % 2 === 0) b.boxMM(a, 0.01, z, a + 1, 0.015, z + 1, 0x4a3a3a, { seg: 1e9 });
  b.boxMM(10, CEIL, -12.4, 26.4, CEIL + 0.4, 12.4, 0x221a20);
  b.boxMM(10, 0, -12.4, 10.4, CEIL, -1.2, 0x2a2230);
  b.boxMM(10, 0, 1.2, 10.4, CEIL, 12.4, 0x2a2230);
  b.boxMM(10, 2.6, -1.2, 10.4, CEIL, 1.2, 0x2a2230);
  autoDoor(ctx, 10.2, -1.2, 1.2, 2.6, NEON.purple);
  b.boxMM(10.4, 0, -12.4, 26, CEIL, -12, 0x2e2428);
  glassWallA(ctx, 26.2, -12.4, 12.4, 0, CEIL, 2.5, 0x1a1418);
  glassWallZ(ctx, 12.2, 10.4, 26.2, 0, CEIL, 2.5, 0x1a1418);
  // neon ceiling trim
  b.boxMM(10.5, CEIL - 0.06, -11.9, 25.9, CEIL, -11.8, col(NEON.purple, 1.3), { emissive: true });
  b.boxMM(25.8, CEIL - 0.06, -11.9, 25.9, CEIL, 11.9, col(NEON.pink, 1.3), { emissive: true });

  // counter + back bar
  b.boxMM(12, 0, -11, 20, 1.05, -9.4, 0x2a1a22);
  b.boxMM(11.9, 1.05, -11.05, 20.1, 1.12, -9.3, 0xd8c8b8);
  b.boxMM(12, 0.12, -9.39, 20, 0.18, -9.37, col(NEON.purple, 1.4), { emissive: true });
  b.boxMM(10.4, 0, -12, 21, 0.9, -11.4, 0x1a1418);
  b.boxMM(10.4, 1.6, -12, 21, 1.65, -11.6, 0x6a4a3a);
  b.boxMM(10.4, 2.2, -12, 21, 2.25, -11.6, 0x6a4a3a);
  // bottles / cups on shelves
  for (let a = 10.8; a < 20.8; a += 0.35) {
    const c = r.pick([0x3a8a5a, 0x8a3a2a, 0xb08030, 0x404090, 0xd0d0d0]);
    b.cylinder(a, 1.78, -11.8, 0.07, 0.07, 0.26, c, { radial: 6 });
    if (r.chance(0.6)) b.cylinder(a + 0.1, 2.32, -11.8, 0.06, 0.06, 0.16, 0xe0e0e8, { radial: 6 });
  }
  // espresso machines
  for (const a of [13.2, 16.5]) {
    b.boxMM(a - 0.6, 1.12, -10.9, a + 0.6, 1.62, -10.2, 0xb8b8c4);
    b.boxMM(a - 0.62, 1.62, -10.92, a + 0.62, 1.68, -10.18, 0x303038);
    b.boxMM(a - 0.5, 1.45, -10.19, a + 0.5, 1.5, -10.18, col(NEON.cyan, 1.4), { emissive: true });
    ctx.halo(a, 1.9, -10.5, new THREE.Color(0.15, 0.14, 0.16), 0.6, 4);
  }
  ctx.blocker(10.3, 20.2, -12.1, -9.25);
  // stools at the counter
  for (let a = 12.8; a <= 19.4; a += 1.3) {
    b.cylinder(a, 0.35, -8.6, 0.04, 0.06, 0.7, 0x9a9aa8, { radial: 6 });
    b.cylinder(a, 0.72, -8.6, 0.2, 0.2, 0.06, 0x7a2a5a, { radial: 10 });
  }
  ctx.person([15, 0, -10.6], [15, 0, -5], 3, { jacket: 0x1a1a1a, neon: NEON.purple });
  ctx.person([18.5, 0, -10.6], [18.5, 0, -5], 1, { jacket: 0x2a1a10, neon: NEON.orange });
  for (const a of [12.8, 15.4, 18.0]) if (r.chance(0.8)) ctx.person([a, 0.25, -8.4], [a, 0, -12], 2);

  // menu boards
  ctx.sign(13.5, 2.95, -11.95, 0, 3.4, 0.8, 6 + 16, NEON.yellow, { bg: 0x0a0806 });
  ctx.sign(17.6, 2.95, -11.95, 0, 3.4, 0.8, SIGN_CELLS.verticalBase + 16, NEON.cyan, { bg: 0x0a0806 });
  ctx.sign(10.45, 2.1, 7, Math.PI / 2, 4.2, 1.0, ctx.st.cell, NEON.pink);
  ctx.halo(11, 2.1, 7, col(NEON.pink, 0.25), 3.5);

  // tables with pendant lamps
  for (const [a, z] of TABLES) {
    b.cylinder(a, 0.37, z, 0.06, 0.25, 0.74, 0x1a1a1f, { radial: 8 });
    b.cylinder(a, 0.76, z, 0.55, 0.55, 0.04, 0x5a3a2a, { radial: 16 });
    b.cylinder(a, (CEIL + 1.9) / 2, z, 0.008, 0.008, CEIL - 1.9, 0x111111, { radial: 4 });
    b.cone(a, 2.0, z, 0.25, 0.25, col(0xffa060, 0.8), { emissive: true, radial: 10 });
    ctx.halo(a, 1.85, z, col(0xffa050, 0.35), 1.1);
    ctx.blocker(a - 0.6, a + 0.6, z - 0.6, z + 0.6);
    for (const dz of [-0.95, 0.95]) {
      b.boxMM(a - 0.25, 0, z + dz - 0.22, a + 0.25, 0.45, z + dz + 0.22, 0x3a2030);
      if (r.chance(0.65)) ctx.person([a, 0, z + dz], [a, 0, z], 2);
    }
    b.sphere(a + 0.15, 0.85, z + 0.1, 0.06, 0xe8e0d8, { sy: 1.4, detail: 0 });
  }
  // window ledge with stools, people looking out
  b.boxMM(25.4, 1.0, -11, 26, 1.06, 11, 0x5a3a2a);
  ctx.blocker(25.3, 26.1, -11, 11, -0.5, 2.5);
  for (const z of [-9, -3.5, 7]) ctx.person([25.0, 0.3, z], [30, 0, z], 2);

  // plants + neon art
  for (const [a, z] of [[25.5, 11.4], [10.9, 11.4], [25.5, -11.4]]) {
    b.cylinder(a, 0.35, z, 0.3, 0.25, 0.7, 0x2a2a30, { radial: 8 });
    b.sphere(a, 1.1, z, 0.5, 0x1e4a2a, { sy: 1.3 });
    ctx.blocker(a - 0.4, a + 0.4, z - 0.4, z + 0.4);
  }
  glow.torus(10.5, 2.6, 2.5, 0.5, 0.03, col(NEON.cyan, 0.9), { rotX: 0 });

  // exterior signage + tower
  ctx.sign(9.9, 4.6, 0, -Math.PI / 2, 8, 1.8, ctx.st.cell, NEON.purple);
  ctx.sign(26.5, 5, 0, Math.PI / 2, 12, 2.6, ctx.st.cell, NEON.purple);
  ctx.halo(28, 5, 0, col(NEON.purple, 0.25), 9);
  ctx.tower(8, 28, -14, 14, -H, -0.4, [0, 55, 0.5, 4]);
  ctx.tower(8, 28, -14, 14, CEIL + 0.4, CEIL + 90, [2, 56, 0.45, 4]);

  ctx.rect(10.45, 25.9, -11.9, 11.9, 0);
  ctx.rect(9.5, 10.9, -1.15, 1.15, 0);
  ctx.shelter(10, 26.4, 0, CEIL, -12.4, 12.4);
  ctx.zone(4, 34, -20, 20, { yMin: 0, yMax: H + 100 });
}
