import * as THREE from 'three';
import { buildPlatform, glassWallA, autoDoor } from './common.js';
import { NEON, col } from '../palette.js';

// Kurogane Tower: a cavernous megacorp lobby with a giant rotating hologram,
// polished black floors and red light. Lobby spans a = 10.4..60, z = -25..25.
export function buildAtrium(ctx) {
  const { solid: b, glow } = ctx;
  const H = ctx.H;
  const r = ctx.env.people.rng;
  const TOP = 24;
  const RED = NEON.red;

  for (let a = 16; a <= 56; a += 10) for (const z of [-16, 0, 16]) ctx.light(a, 20, z, 0xfff4f0, 0.4, 12);
  ctx.light(35, 3, 0, RED, 1.4, 12);
  for (const z of [-23, 23]) for (let a = 16; a <= 56; a += 10) ctx.light(a, 3, z, RED, 0.5, 5);
  ctx.light(60, 6, 0, 0x6040ff, 0.5, 18);

  buildPlatform(ctx, { openings: [[-3, 3]], accent: RED });

  // floor with red light grid
  b.boxMM(10, -0.5, -25.4, 60.4, 0, 25.4, 0x08080b);
  b.boxMM(10.4, 0, -25, 60, 0.01, 25, 0x0e0d12);
  for (let a = 15; a < 60; a += 5) b.boxMM(a - 0.03, 0.01, -24.8, a + 0.03, 0.02, 24.8, col(RED, 0.45), { emissive: true });
  for (let z = -20; z <= 20; z += 5) b.boxMM(10.6, 0.01, z - 0.03, 59.8, 0.02, z + 0.03, col(RED, 0.45), { emissive: true });
  // ceiling with light panels
  b.boxMM(10, TOP, -25.4, 60.4, TOP + 0.6, 25.4, 0x141218);
  for (let a = 15; a < 60; a += 7) for (let z = -20; z <= 20; z += 8) b.boxMM(a - 1.4, TOP - 0.05, z - 1.4, a + 1.4, TOP, z + 1.4, col(0xffe0c0, 0.55), { emissive: true });
  // walls
  b.boxMM(10, 0, -25.4, 10.4, TOP, -3, 0x1a1820);
  b.boxMM(10, 0, 3, 10.4, TOP, 25.4, 0x1a1820);
  b.boxMM(10, 3.0, -3, 10.4, TOP, 3, 0x1a1820);
  autoDoor(ctx, 10.2, -3, 3, 3.0, RED);
  for (const z of [-25.2, 25.2]) {
    b.boxMM(10.4, 0, z - 0.2, 60, TOP, z + 0.2, 0x16141c);
    // elevator banks
    for (let a = 16; a <= 54; a += 6.5) {
      const zz = z - Math.sign(z) * 0.22;
      b.boxMM(a - 1, 0, zz - 0.02, a + 1, 2.8, zz + 0.02, 0x2a2630);
      b.boxMM(a - 1.1, 2.8, zz - 0.03, a + 1.1, 2.9, zz + 0.03, col(RED, 1.3), { emissive: true });
      b.boxMM(a - 0.02, 0, zz - 0.03, a + 0.02, 2.8, zz + 0.03, 0x0a0a0c);
    }
  }
  glassWallA(ctx, 60, -25.4, 25.4, 0, TOP, 4, 0x101014);

  // corp branding
  ctx.sign(10.5, 15, 0, Math.PI / 2, 26, 5, ctx.st.cell, RED, { bg: 0x050000 });
  ctx.halo(12, 15, 0, col(RED, 0.25), 16);
  for (const z of [-24.9, 24.9]) {
    const yaw = z < 0 ? 0 : Math.PI;
    ctx.screen(23, 12, z, yaw, 9, 15, 6 + 24, RED, NEON.purple);
    ctx.screen(47, 12, z, yaw, 9, 15, 6 + 4, RED, NEON.yellow);
  }

  // columns
  for (const a of [22, 48]) {
    for (const z of [-14, 14]) {
      b.cylinder(a, TOP / 2, z, 1.2, 1.2, TOP, 0x1a181f, { radial: 16 });
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
        b.box(a + Math.cos(ang) * 1.2, TOP / 2, z + Math.sin(ang) * 1.2, 0.08, TOP, 0.08, col(RED, 1.4), { emissive: true });
      }
      ctx.blocker(a - 1.4, a + 1.4, z - 1.4, z + 1.4);
    }
  }

  // reception desk
  b.boxMM(16, 0, 10, 19, 1.1, 18, 0x101014);
  b.boxMM(15.95, 1.1, 9.95, 19.05, 1.16, 18.05, 0x2a2830);
  b.boxMM(18.98, 0.2, 10, 19.0, 0.3, 18, col(RED, 1.4), { emissive: true });
  ctx.blocker(15.9, 19.1, 9.9, 18.1);
  ctx.person([17, 0, 12], [22, 0, 12], 1, { jacket: 0x101012, visor: 1, neon: RED });
  ctx.person([17, 0, 16], [22, 0, 16], 3, { jacket: 0x101012, visor: 1, neon: RED });

  // central hologram
  const C = [35, 0];
  b.cylinder(C[0], 0.35, C[1], 4.2, 4.6, 0.7, 0x111015, { radial: 32 });
  b.torus(C[0], 0.72, C[1], 4.0, 0.06, col(RED, 1.5), { seg: 48 });
  b.torus(C[0], 0.72, C[1], 2.4, 0.04, col(RED, 1.2), { seg: 40 });
  glow.cylinder(C[0], 9, C[1], 2.2, 3.6, 16, col(RED, 0.08), { open: true, radial: 28 });
  ctx.blocker(C[0] - 4.4, C[0] + 4.4, C[1] - 4.4, C[1] + 4.4);
  const holo = new THREE.Group();
  holo.position.copy(ctx.v(C[0], 10, C[1]));
  ctx.group.add(holo);
  const add = (geo, color, wire = false) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: col(color, 0.4), wireframe: wire, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    holo.add(m);
    return m;
  };
  const core = add(new THREE.IcosahedronGeometry(3.2, 1), RED, true);
  const inner = add(new THREE.OctahedronGeometry(1.6, 0), NEON.yellow, true);
  const ringA = add(new THREE.TorusGeometry(6, 0.08, 6, 64), RED);
  const ringB = add(new THREE.TorusGeometry(7.2, 0.05, 6, 64), NEON.purple);
  const ringC = add(new THREE.TorusGeometry(4.6, 0.12, 6, 48), RED);
  // segmented logo ring of glowing panels
  const panels = [];
  for (let i = 0; i < 12; i++) {
    const p = add(new THREE.PlaneGeometry(1.6, 3), RED);
    const ang = (i / 12) * Math.PI * 2;
    p.position.set(Math.cos(ang) * 9, -3, Math.sin(ang) * 9);
    p.lookAt(0, -3, 0);
    p.material.opacity = 0.35;
    p.material.color.multiplyScalar(0.4);
    panels.push(p);
  }
  ctx.halo(C[0], 10, C[1], col(RED, 0.35), 18, 3);
  ctx.updaters.push((t) => {
    core.rotation.set(t * 0.15, t * 0.25, 0);
    inner.rotation.set(0, -t * 0.6, t * 0.3);
    ringA.rotation.set(Math.PI / 2 + Math.sin(t * 0.3) * 0.3, 0, t * 0.2);
    ringB.rotation.set(Math.PI / 2 + 0.5, t * 0.15, 0);
    ringC.rotation.set(t * 0.4, Math.PI / 2, 0);
    holo.rotation.y = t * 0.12;
    holo.position.y = 10 + Math.sin(t * 0.5) * 0.4;
    const flick = Math.random() > 0.985 ? 0.3 : 1;
    core.material.opacity = flick;
  });

  // seating by the window
  for (const z of [-18, -6, 6, 18]) {
    b.boxMM(55.5, 0, z - 2, 57, 0.45, z + 2, 0x2a1418);
    ctx.blocker(55.4, 57.1, z - 2.05, z + 2.05);
    if (r.chance(0.7)) ctx.person([56.3, 0, z - 0.8], [50, 0, z - 0.8], 2, { jacket: r.pick([0x111111, 0x202028, 0x2a0a10]) });
    if (r.chance(0.5)) ctx.person([56.3, 0, z + 0.9], [62, 0, z + 0.9], 2, { jacket: r.pick([0x111111, 0x202028]) });
  }
  // guards at the entrance + office workers crossing
  ctx.person([12.5, 0, -4.5], [20, 0, -4.5], 1, { jacket: 0x0a0a0a, visor: 1, neon: RED, height: 1.08 });
  ctx.person([12.5, 0, 4.5], [20, 0, 4.5], 1, { jacket: 0x0a0a0a, visor: 1, neon: RED, height: 1.08 });
  for (let i = 0; i < 16; i++) {
    const a0 = r.float(13, 25), z0 = r.chance(0.5) ? r.float(-22, -6) : r.float(6, 22);
    ctx.person([a0, 0, z0], [r.float(42, 55), 0, r.float(-22, 22)], 0, { jacket: r.pick([0x111111, 0x202028, 0x2a2a30, 0x3a0a10]), speed: r.float(1.1, 1.5) });
  }
  for (let i = 0; i < 5; i++) {
    const a = r.float(28, 44), z = r.chance(0.5) ? -8 : 8;
    ctx.person([a, 0, z + r.float(-1.5, 1.5)], [C[0], 10, C[1]], 1);
  }

  // megacorp tower: below the lobby and soaring above it
  const corp = [4, 13, 0.35, 4];
  ctx.tower(8, 62.4, -27.4, 27.4, -H, -0.5, corp);
  ctx.tower(8, 62.4, -27.4, 27.4, TOP + 0.6, 300, corp);
  ctx.tower(16, 54, -20, 20, 300, 430, corp);
  ctx.sign(62.6, 200, 0, Math.PI / 2, 50, 10, ctx.st.cell, RED, { bg: 0x080000 });
  ctx.halo(66, 200, 0, col(RED, 0.3), 40);
  ctx.halo(35, 432, 0, new THREE.Color(1, 0.05, 0.05), 5, 1);

  ctx.rect(10.45, 59.8, -24.8, 24.8, 0);
  ctx.rect(9.5, 10.9, -2.9, 2.9, 0);
  ctx.shelter(10, 60.4, 0, TOP, -25.4, 25.4);
  ctx.zone(4, 68, -33, 33, { yMin: 0, yMax: H + 440 });
}
