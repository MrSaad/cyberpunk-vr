import * as THREE from 'three';
import { buildPlatform, glassWallA, glassWallZ, autoDoor } from './common.js';
import { NEON, col } from '../palette.js';
import { SIGN_CELLS } from '../textures.js';

// Penthouse on the top floor of a residential tower, opening straight onto a
// private skytrain platform. Interior spans a = 10.4..33.6, z = -14.6..14.6.
export function buildHome(ctx) {
  const { solid: b, glow } = ctx;
  const H = ctx.H;
  const CEIL = 4.6;

  // --- lights (baked) ---
  for (const a of [15, 22, 29]) for (const z of [-10, 0, 10]) ctx.light(a, 4.2, z, 0xffd2a0, 0.55, 4.5);
  ctx.light(36, 2.5, 0, 0xc040ff, 0.7, 14);
  ctx.light(36, 2.5, -12, 0xff2a6d, 0.5, 10);
  ctx.light(36, 2.5, 12, 0x00f0ff, 0.5, 10);
  ctx.light(25.3, 0.3, -12.5, 0xb026ff, 0.9, 2.5);
  ctx.light(11.2, 1.8, -8, 0x00f0ff, 0.6, 4);
  ctx.light(16, 0.5, 8, 0xff2a6d, 0.6, 3);
  ctx.light(27.2, 1.2, -2, 0x00f0ff, 0.5, 3);

  buildPlatform(ctx, { openings: [[-1.2, 1.2]], accent: NEON.magenta });

  // --- shell ---
  b.boxMM(10, -0.4, -15, 34, 0, 15, 0x221d28);
  b.boxMM(10.4, 0, -14.6, 33.6, 0.01, 14.6, 0x2c2530);
  b.boxMM(10, CEIL, -15, 34, CEIL + 0.5, 15, 0x26222e);
  // perimeter cove lighting
  b.boxMM(33.4, CEIL - 0.06, -14.6, 33.5, CEIL, 14.6, col(0xffc890, 0.55), { emissive: true });
  b.boxMM(16, CEIL - 0.08, 14.2, 33.5, CEIL, 14.5, col(0xffc890, 0.55), { emissive: true });
  b.boxMM(16, CEIL - 0.08, -14.5, 33.5, CEIL, -14.2, col(0xffc890, 0.55), { emissive: true });
  // platform-side wall with door
  b.boxMM(10, 0, -15, 10.4, CEIL, -1.2, 0x3a3440);
  b.boxMM(10, 0, 1.2, 10.4, CEIL, 15, 0x3a3440);
  b.boxMM(10, 2.6, -1.2, 10.4, CEIL, 1.2, 0x3a3440);
  autoDoor(ctx, 10.2, -1.2, 1.2, 2.6, NEON.cyan);
  // side walls: solid near the entrance, glass toward the view
  b.boxMM(10.4, 0, 14.6, 16, CEIL, 15, 0x3a3440);
  b.boxMM(10.4, 0, -15, 16, CEIL, -14.6, 0x3a3440);
  glassWallA(ctx, 33.8, -15, 15, 0, CEIL, 3);
  glassWallZ(ctx, 14.8, 16, 34, 0, CEIL, 3);
  glassWallZ(ctx, -14.8, 16, 34, 0, CEIL, 3);

  // --- living area (couch faces the windows) ---
  b.boxMM(26.2, 0.01, -7.5, 31.8, 0.03, 3.5, 0x3a1f4a);
  b.boxMM(24.0, 0, -6, 25.3, 0.42, 2, 0x221b2b);
  b.boxMM(24.1, 0.42, -5.9, 25.2, 0.55, 1.9, 0x5a3478);
  b.boxMM(23.8, 0, -6, 24.3, 1.05, 2, 0x4a2a66);
  b.boxMM(24.0, 0, 2, 27.0, 0.42, 3.2, 0x221b2b);
  b.boxMM(24.1, 0.42, 2.1, 26.9, 0.55, 3.1, 0x5a3478);
  b.boxMM(23.8, 0, 3.0, 27.0, 1.05, 3.4, 0x4a2a66);
  b.boxMM(24.0, 0.02, -6, 24.05, 0.05, 3.2, col(NEON.purple, 1.3), { emissive: true });
  ctx.blocker(23.7, 25.4, -6.1, 2.1);
  ctx.blocker(23.7, 27.1, 1.9, 3.5);
  // coffee table with holo display
  b.boxMM(26.6, 0, -3.6, 28.2, 0.3, -0.4, 0x15131a);
  b.boxMM(26.55, 0.3, -3.65, 28.25, 0.34, -0.35, 0x2a2a3a);
  b.boxMM(26.55, 0.28, -3.66, 28.25, 0.3, -3.64, col(NEON.cyan, 1.2), { emissive: true });
  b.boxMM(26.55, 0.28, -0.36, 28.25, 0.3, -0.34, col(NEON.cyan, 1.2), { emissive: true });
  ctx.blocker(26.5, 28.3, -3.7, -0.3);
  glow.cylinder(27.4, 0.8, -2, 0.35, 0.5, 0.9, col(NEON.cyan, 0.18), { open: true, radial: 16 });
  const holo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 1),
    new THREE.MeshBasicMaterial({ color: col(NEON.cyan, 1.2), wireframe: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  holo.position.copy(ctx.v(27.4, 1.15, -2));
  ctx.group.add(holo);
  ctx.updaters.push((t) => { holo.rotation.y = t * 0.6; holo.rotation.x = Math.sin(t * 0.4) * 0.4; });

  // --- media wall ---
  b.boxMM(10.4, 0, -11, 11.0, 0.5, -5, 0x16141c);
  b.boxMM(11.0, 0.05, -11, 11.02, 0.1, -5, col(NEON.cyan, 1.2), { emissive: true });
  ctx.blocker(10.3, 11.1, -11.1, -4.9);
  ctx.screen(10.45, 2.1, -8, Math.PI / 2, 4.6, 2.6, 6 + 3, NEON.cyan, NEON.pink);

  // --- kitchen ---
  b.boxMM(10.4, 0, 4, 11.1, 0.92, 13, 0x1c1a22);
  b.boxMM(10.4, 0.92, 4, 11.15, 0.97, 13, 0xd8d0e0);
  b.boxMM(10.4, 1.7, 4, 10.8, 2.6, 13, 0x24202c);
  b.boxMM(10.8, 1.68, 4, 10.82, 1.7, 13, col(0xffffff, 1.0), { emissive: true });
  b.boxMM(10.4, 0, 13, 11.3, 2.3, 14.6, 0x8a8a98);
  ctx.blocker(10.3, 11.4, 3.9, 14.7);
  b.boxMM(14, 0, 7, 18, 0.9, 9, 0x1c1a22);
  b.boxMM(13.9, 0.9, 6.9, 18.1, 0.96, 9.1, 0xe8e0f0);
  b.boxMM(14, 0.04, 6.95, 18, 0.08, 6.97, col(NEON.magenta, 1.3), { emissive: true });
  ctx.blocker(13.8, 18.2, 6.8, 9.2);
  for (const a of [14.8, 16, 17.2]) {
    b.cylinder(a, 0.35, 6.2, 0.04, 0.04, 0.7, 0x9a9aa8, { radial: 6 });
    b.cylinder(a, 0.72, 6.2, 0.22, 0.22, 0.06, 0x4a2a66, { radial: 12 });
  }
  // pendant lamps over the island
  for (const a of [14.8, 17.2]) {
    b.cylinder(a, 3.6, 8, 0.01, 0.01, 2, 0x111111, { radial: 4 });
    b.sphere(a, 2.55, 8, 0.16, col(0xffd2a0, 1.4), { emissive: true });
    ctx.halo(a, 2.55, 8, col(0xffb070, 0.35), 0.9);
  }

  // --- bedroom nook behind a partition ---
  b.boxMM(23.8, 0, -15, 24.1, 3.0, -8.5, 0x3a3440);
  b.boxMM(24.1, 0, -13.8, 26.6, 0.5, -11.2, 0x1a1720);
  b.boxMM(24.2, 0.5, -13.7, 26.5, 0.68, -11.3, 0xcac0d8);
  b.boxMM(24.1, 0, -13.8, 24.4, 1.2, -11.2, 0x2a2232);
  b.boxMM(24.1, 0.02, -13.82, 26.6, 0.06, -13.8, col(NEON.purple, 1.4), { emissive: true });
  ctx.blocker(23.7, 26.7, -15, -11.1);
  ctx.blocker(23.7, 24.2, -15, -8.4);
  ctx.sign(24.12, 1.9, -10.2, Math.PI / 2, 0.5, 2.0, SIGN_CELLS.verticalBase + 3, NEON.pink, { vertical: true, bg: 0x000000 });
  ctx.halo(24.6, 1.9, -10.2, col(NEON.pink, 0.25), 1.6);

  // --- plants & lamp ---
  for (const [a, z] of [[32.8, 13.8], [32.8, -7.8], [11.2, 2.4], [21, 13.9]]) {
    b.cylinder(a, 0.3, z, 0.32, 0.26, 0.6, 0x2a2a30, { radial: 10 });
    b.sphere(a, 1.0, z, 0.45, 0x1e4a2a, { sy: 1.4 });
    b.sphere(a + 0.15, 1.45, z - 0.1, 0.3, 0x2a5a32);
    ctx.blocker(a - 0.4, a + 0.4, z - 0.4, z + 0.4);
  }
  b.cylinder(31.8, 0.9, 10.5, 0.03, 0.03, 1.8, 0x999999, { radial: 6 });
  b.sphere(31.8, 1.85, 10.5, 0.2, col(0xffd2a0, 1.3), { emissive: true });
  ctx.halo(31.8, 1.85, 10.5, col(0xffb070, 0.3), 1.0);

  // --- roof crown & tower ---
  const style = [1, 42, 0.45, 0];
  ctx.tower(9.9, 34.1, -15.1, 15.1, -H, -0.4, style);
  ctx.tower(10, 34, -15, 15, CEIL + 0.5, CEIL + 9, [0, 43, 0.2, 0]);
  b.boxMM(9.9, CEIL + 0.45, -15.1, 34.1, CEIL + 0.6, 15.1, col(NEON.magenta, 1.2), { emissive: true });
  ctx.sign(34.2, CEIL + 6, 0, Math.PI / 2, 16, 3.6, 6 + 24, NEON.magenta, { flicker: 0 });
  ctx.halo(36, CEIL + 6, 0, col(NEON.magenta, 0.25), 12);
  ctx.halo(22, CEIL + 14, 0, new THREE.Color(1, 0.05, 0.05), 3, 1);

  // nav
  ctx.rect(10.45, 33.7, -14.7, 14.7, 0);
  ctx.rect(9.5, 10.9, -1.15, 1.15, 0);
  ctx.shelter(10, 34, 0, CEIL, -15, 15);
  ctx.zone(6, 40, -20, 20, { yMin: 0, yMax: H + 20 });
  // keep the view toward downtown open
  ctx.zone(34, 220, -140, 140, { kind: 'cap', maxH: H - 35 });

  ctx.spawn = { local: ctx.v(29, 0, 4), yaw: -ctx.side * Math.PI / 2 };
}
