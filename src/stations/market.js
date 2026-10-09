import * as THREE from 'three';
import { buildPlatform } from './common.js';
import { NEON, NEON_LIST, col } from '../palette.js';
import { SIGN_CELLS } from '../textures.js';

// Night market: a low platform above a street canyon running beneath the
// track. Stairs lead down from the platform end to the street, which is
// packed with food stalls, lanterns, blade signs and crowds.
export function buildMarket(ctx) {
  const { solid: b, glow } = ctx;
  const H = ctx.H;
  const r = ctx.env.people.rng;
  const SY = -H + 0.05; // street level in station space (just above the ground plane)
  const A0 = -8.5, A1 = 20.5, Z = 70;
  const STALLS = [];
  for (const side of [-1, 1]) {
    for (let z = -64; z <= 64; z += 5.5) {
      if (side === 1 && z > 14 && z < 50) continue;
      if (r.chance(0.12)) continue;
      STALLS.push({ a: side < 0 ? -6.5 : 18.5, z, side, color: NEON_LIST[r.int(0, 7)] });
    }
  }

  // --- lights first (baked into vertex colours) ---
  for (const s of STALLS) ctx.light(s.a - s.side * 1.6, SY + 2.6, s.z, s.color, 0.9, 4.5);
  for (let z = -60; z <= 60; z += 20) ctx.light(6, SY + 7, z, 0xff8a40, 0.6, 12);
  ctx.light(6, SY + 10, 34, NEON.yellow, 0.6, 10);

  buildPlatform(ctx, { openings: [], accent: NEON.yellow, supports: false, endGap: [5.5, 9.5] });

  // --- platform end opening + stairs down to the street ---
  const steps = 48;
  const S0 = 22, S1 = 46;
  for (let i = 0; i < steps; i++) {
    const z0 = S0 + ((S1 - S0) * i) / steps;
    const y = -(H - 0.05) * ((i + 1) / steps);
    b.boxMM(5.5, y, z0, 9.5, y + 0.3, z0 + (S1 - S0) / steps + 0.02, 0x2e2b36, { seg: 1e9 });
    b.boxMM(5.5, y + 0.28, z0, 9.5, y + 0.3, z0 + 0.04, col(NEON.yellow, 0.7), { emissive: true, seg: 1e9 });
  }
  // stair stringers + handrails
  for (const a of [5.4, 9.6]) {
    for (let i = 0; i < 8; i++) {
      const z0 = S0 + ((S1 - S0) * i) / 8, z1 = S0 + ((S1 - S0) * (i + 1)) / 8;
      const y0 = -(H - 0.05) * (i / 8), y1 = -(H - 0.05) * ((i + 1) / 8);
      b.boxMM(a - 0.1, Math.min(y0, y1) - 0.5, z0, a + 0.1, Math.max(y0, y1) + 1.0, z1, 0x24222c, { seg: 1e9 });
      b.boxMM(a - 0.05, Math.max(y0, y1) + 1.0, z0, a + 0.05, Math.max(y0, y1) + 1.06, z1, col(NEON.yellow, 1.0), { emissive: true, seg: 1e9 });
    }
  }
  b.box(7.5, SY + 3, 34, 2.2, 6, 0.8, 0x24222c);
  ctx.rect(5.6, 9.4, 21.6, 46.4, 0, SY, 'z');
  ctx.rect(5.6, 9.4, 21.2, 22.6, 0);
  ctx.blocker(5.5, 9.5, 30, 42, SY - 0.5, SY + 2.2);
  ctx.blocker(5.2, 5.5, 42, 46, SY - 0.5, SY + 1.5);
  ctx.blocker(9.5, 9.8, 42, 46, SY - 0.5, SY + 1.5);
  // gap in the platform end railing is implied: the rect above links deck to stairs

  // --- street ---
  b.boxMM(A0, SY - 0.3, -Z, A1, SY, Z, 0x17151d);
  for (let z = -Z; z < Z; z += 6) b.boxMM(5.9, SY, z, 6.1, SY + 0.01, z + 3, col(0xffffff, 0.2), { emissive: true, seg: 1e9 });
  // puddles reflecting neon
  for (let i = 0; i < 40; i++) {
    const a = r.float(-5, 17), z = r.float(-66, 66);
    const c = NEON_LIST[r.int(0, 7)];
    glow.plane(a, SY + 0.03, z, r.float(1, 3), r.float(1, 4), col(c, 0.18), { emissive: true });
  }

  // track supports standing in the street
  const depth = H - 0.7;
  for (const zz of [-18, 18]) {
    b.box(0, -0.7 - depth / 2, zz, 3.2, depth, 3.2, 0x2b2933, { seg: 1e9 });
    b.box(1.62, -0.7 - depth / 2, zz, 0.06, depth, 0.5, col(NEON.yellow, 1.2), { emissive: true, seg: 1e9 });
    b.box(6, -0.7 - depth / 2, zz, 2.2, depth, 2.2, 0x2b2933, { seg: 1e9 });
    ctx.blocker(-1.7, 1.7, zz - 1.7, zz + 1.7, SY - 1, SY + 3);
    ctx.blocker(4.8, 7.2, zz - 1.2, zz + 1.2, SY - 1, SY + 3);
  }
  for (const zz of [-50, 50]) {
    b.box(0, -0.7 - depth / 2, zz, 2.6, depth, 2.6, 0x2b2933, { seg: 1e9 });
    ctx.blocker(-1.4, 1.4, zz - 1.4, zz + 1.4, SY - 1, SY + 3);
  }
  b.boxMM(-1.8, -2.4, -22, 9.95, -0.7, 22, 0x24222c);

  // --- stalls ---
  for (const s of STALLS) {
    const { a, z, side, color } = s;
    const front = a - side * 1.5; // customer side
    b.boxMM(a - 1.5, SY, z - 2.2, a + 1.5, SY + 1.0, z + 2.2, 0x2a2228, { seg: 1e9 });
    b.boxMM(front - 0.05, SY + 1.0, z - 2.3, front + 0.05, SY + 1.06, z + 2.3, col(color, 1.2), { emissive: true, seg: 1e9 });
    b.boxMM(a - 1.6, SY + 1.0, z - 2.25, a + 1.6, SY + 1.08, z + 2.25, 0x4a3a40, { seg: 1e9 });
    // goods / pots
    for (let i = 0; i < 3; i++) b.cylinder(a + r.float(-0.8, 0.8), SY + 1.2, z + r.float(-1.5, 1.5), 0.2, 0.2, 0.25, r.pick([0x8a8a90, 0x6a3a2a, 0x2a4a3a]), { radial: 8 });
    // posts and awning
    for (const dz of [-2.1, 2.1]) b.box(a + side * 1.4, SY + 1.4, z + dz, 0.1, 2.8, 0.1, 0x1a1a1f, { seg: 1e9 });
    for (const dz of [-2.1, 2.1]) b.box(front, SY + 1.25, z + dz, 0.08, 2.5, 0.08, 0x1a1a1f, { seg: 1e9 });
    b.box(a - side * 0.3, SY + 2.85, z, 3.8, 0.08, 4.6, col(color, 0.35), { rotZ: side * 0.18, seg: 1e9 });
    b.boxMM(front - side * 0.5 - 0.05, SY + 2.45, z - 2.3, front - side * 0.5 + 0.05, SY + 2.55, z + 2.3, col(color, 1.4), { emissive: true, seg: 1e9 });
    // sign over the stall
    const cell = r.chance(0.5) ? SIGN_CELLS.verticalBase + r.int(0, SIGN_CELLS.verticalCount - 1) : 6 + r.int(14, 21);
    ctx.sign(front - side * 0.45, SY + 3.4, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, 3.6, 0.9, cell, color, { flicker: r.chance(0.15) ? 1 : 0 });
    if (r.chance(0.5)) ctx.halo(front - side * 1.2, SY + 3.4, z, col(color, 0.18), 3.2);
    // hanging bulbs
    for (const dz of [-1.4, 0, 1.4]) {
      b.sphere(front - side * 0.3, SY + 2.3, z + dz, 0.08, col(0xffc070, 1.6), { emissive: true, detail: 0 });
    }
    ctx.halo(front - side * 0.3, SY + 2.3, z, col(0xffa050, 0.25), 2.2);
    if (r.chance(0.45)) ctx.halo(a, SY + 1.4, z + r.float(-1, 1), new THREE.Color(0.18, 0.16, 0.2), 0.9, 4);
    ctx.blocker(Math.min(a - 1.6, front), Math.max(a + 1.6, front), z - 2.3, z + 2.3, SY - 1, SY + 3);
    // vendor + customers
    ctx.person([a + side * 0.6, SY, z + r.float(-1, 1)], [a - side * 5, SY, z], r.chance(0.5) ? 3 : 1);
    if (r.chance(0.6)) ctx.person([front - side * 0.7, SY, z + r.float(-1.5, 1.5)], [a, SY, z], r.chance(0.5) ? 1 : 3);
  }

  // --- lantern strings across the street ---
  for (let z = -62; z <= 62; z += 9) {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = A0 + 1 + ((A1 - A0 - 2) * i) / n;
      const sag = Math.sin((i / n) * Math.PI) * 0.9;
      const y = SY + 7.6 - sag;
      const c = i % 3 === 0 ? 0xff3020 : i % 3 === 1 ? 0xff9020 : 0xffd040;
      b.sphere(a, y, z, 0.22, col(c, 1.5), { emissive: true, sy: 1.3, detail: 0 });
      if (i % 2 === 0) ctx.halo(a, y, z, col(c, 0.22), 1.5, 3);
    }
    b.boxMM(A0 + 1, SY + 7.8, z - 0.01, A1 - 1, SY + 7.82, z + 0.01, 0x111111, { seg: 1e9 });
  }

  // --- buildings lining the canyon ---
  const lineSide = (a0, a1, faceA, faceYaw) => {
    let z = -Z - 2;
    while (z < Z + 2) {
      const len = r.float(14, 26);
      const h = r.float(28, 95);
      ctx.tower(a0, a1, z, Math.min(z + len, Z + 2), SY - 0.05, SY + h, [r.int(0, 2), r.float(0, 100), r.float(0.4, 0.7), r.int(0, 7)]);
      // dense blade signs
      const n = r.int(2, 5);
      for (let i = 0; i < n; i++) {
        const sh = r.float(4, 12), zz = z + r.float(2, len - 2);
        const y = SY + r.float(4.5, Math.min(h - sh - 2, 30)) + sh / 2;
        const c = NEON_LIST[r.int(0, 7)];
        ctx.sign(faceA + Math.sign(faceA - (a0 + a1) / 2) * 1.2, y, zz, 0, 1.6 + r.next(), sh, SIGN_CELLS.verticalBase + r.int(0, SIGN_CELLS.verticalCount - 1), c, { vertical: true, doubleSided: true, flicker: r.chance(0.12) ? 1 : 0 });
        if (r.chance(0.5)) ctx.halo(faceA + Math.sign(faceA - (a0 + a1) / 2) * 1.5, y, zz, col(c, 0.2), sh * 0.6);
      }
      if (r.chance(0.5)) {
        const sw = r.float(6, 12), y = SY + r.float(8, 22);
        ctx.sign(faceA + Math.sign(faceA - (a0 + a1) / 2) * 0.15, y, z + len / 2, faceYaw, sw, sw * 0.25, 6 + r.int(0, SIGN_CELLS.horizontalCount - 7), NEON_LIST[r.int(0, 7)]);
      }
      if (h > 50 && r.chance(0.5)) {
        ctx.screen(faceA + Math.sign(faceA - (a0 + a1) / 2) * 0.3, SY + h * 0.6, z + len / 2, faceYaw, Math.min(len * 0.8, 16), 9, 6 + r.int(0, 25), NEON_LIST[r.int(0, 7)], NEON_LIST[r.int(0, 7)]);
      }
      z += len + r.float(0, 1.5);
    }
  };
  lineSide(-34, -9, -9, Math.PI / 2);
  lineSide(21, 46, 21, -Math.PI / 2);
  // close off both ends of the street
  for (const zz of [Z + 1, -Z - 1]) {
    const z0 = zz > 0 ? zz : zz - 22, z1 = zz > 0 ? zz + 22 : zz;
    ctx.tower(-9, 21, z0, z1, SY - 0.05, SY + r.float(40, 80), [1, r.float(0, 100), 0.5, r.int(0, 7)]);
    ctx.screen(6, SY + 21, zz > 0 ? zz - 0.3 : zz + 0.3, zz > 0 ? Math.PI : 0, 18, 10, 4, NEON.yellow, NEON.pink);
  }
  ctx.sign(6, SY + 10.5, Z - 1, Math.PI, 14, 3, ctx.st.cell, NEON.yellow, { doubleSided: true });
  ctx.sign(6, SY + 10.5, -Z + 1, 0, 14, 3, SIGN_CELLS.verticalBase + 15, NEON.red);

  // --- crowd ---
  for (let i = 0; i < 110; i++) {
    const a0 = r.float(-3.5, 15.5);
    const z0 = r.float(-66, 66);
    const len = r.float(10, 50) * r.sign();
    const z1 = Math.max(-67, Math.min(67, z0 + len));
    if ((a0 > -1.8 && a0 < 1.8) || (a0 > 4.6 && a0 < 7.4)) continue; // avoid support columns
    ctx.person([a0, SY, z0], [a0 + r.float(-1, 1), SY, z1], 0, { speed: r.float(0.9, 1.5) });
  }
  for (let i = 0; i < 18; i++) {
    const a = r.float(-3, 15), z = r.float(-60, 60);
    ctx.person([a, SY, z], [a + r.float(-2, 2), SY, z + r.float(-2, 2)], r.chance(0.5) ? 1 : 3);
  }

  ctx.rect(A0, A1, -Z, Z, SY);
  ctx.zone(-40, 52, -96, 96, { yMin: 0, yMax: 100 });
  ctx.shelter(-1.8, 9.95, SY, -0.7, -22, 22);
}
