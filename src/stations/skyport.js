import * as THREE from 'three';
import { buildPlatform, glassWallA, glassWallZ } from './common.js';
import { NEON, col } from '../palette.js';
import { makeCarMesh } from '../traffic.js';

// Flying-car port: a big landing deck with two pads, a waiting lounge and a
// small control tower. Cars arrive, land, wait, and take off on a loop.
export function buildSkyport(ctx) {
  const { solid: b, glass: g, glow } = ctx;
  const H = ctx.H;
  const r = ctx.env.people.rng;
  const pads = [[30, -12], [48, 12]];

  for (const [a, z] of pads) {
    ctx.light(a, 3, z, NEON.cyan, 0.7, 9);
  }
  for (let a = 16; a <= 60; a += 11) for (const z of [-24, 24]) ctx.light(a, 5, z, 0xffe0c0, 0.5, 8);
  ctx.light(14, 2.5, -18, 0xffd2a0, 0.8, 6);

  buildPlatform(ctx, { openings: [[-4, 4]], accent: NEON.cyan });

  // deck
  b.boxMM(9.95, -1.2, -30, 62, 0, 30, 0x2a2834);
  b.boxMM(10, 0, -29.9, 61.9, 0.01, 29.9, 0x302d3a);
  // walkway markings
  b.boxMM(10.5, 0.01, -1.6, 61, 0.02, -1.5, col(NEON.yellow, 0.8), { emissive: true });
  b.boxMM(10.5, 0.01, 1.5, 61, 0.02, 1.6, col(NEON.yellow, 0.8), { emissive: true });
  for (const [a, z] of pads) {
    b.cylinder(a, 0.02, z, 8, 8, 0.03, 0x22202a, { radial: 32 });
    b.torus(a, 0.05, z, 7.6, 0.08, col(NEON.cyan, 1.3), { seg: 48 });
    b.torus(a, 0.05, z, 5.2, 0.05, col(NEON.cyan, 0.8), { seg: 40 });
    // "H" marking
    b.boxMM(a - 2, 0.04, z - 0.25, a + 2, 0.06, z + 0.25, col(NEON.yellow, 1.1), { emissive: true });
    b.boxMM(a - 2, 0.04, z - 2, a - 1.5, 0.06, z + 2, col(NEON.yellow, 1.1), { emissive: true });
    b.boxMM(a + 1.5, 0.04, z - 2, a + 2, 0.06, z + 2, col(NEON.yellow, 1.1), { emissive: true });
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const pa = a + Math.cos(ang) * 8.2, pz = z + Math.sin(ang) * 8.2;
      b.cylinder(pa, 0.1, pz, 0.12, 0.15, 0.2, col(NEON.cyan, 1.3), { emissive: true, radial: 6 });
      ctx.halo(pa, 0.3, pz, col(NEON.cyan, 0.6), 1.0, 1);
    }
    glow.cylinder(a, 0.6, z, 7.8, 7.8, 1.2, col(NEON.cyan, 0.05), { open: true, radial: 40 });
  }
  // deck edge railings
  const railC = new THREE.Color(0.5, 0.85, 1.0);
  const rail = (a0, a1, z0, z1) => {
    g.boxMM(a0, 0, z0, a1, 1.1, z1, railC);
    b.boxMM(a0 - 0.03, 1.1, z0 - 0.03, a1 + 0.03, 1.16, z1 + 0.03, col(NEON.cyan, 1.2), { emissive: true });
  };
  rail(61.9, 62, -30, 30);
  rail(10, 62, -30, -29.9);
  rail(10, 62, 29.9, 30);
  rail(10, 10.05, -30, -22);
  rail(10, 10.05, 22, 30);
  b.boxMM(62, -1.2, -30, 62.1, -1.0, 30, col(NEON.cyan, 1.3), { emissive: true });

  // waiting lounge (covered, glass)
  const L = { a0: 10.4, a1: 20, z0: -28, z1: -8, h: 3.4 };
  b.boxMM(L.a0 - 0.2, L.h, L.z0 - 0.2, L.a1 + 0.2, L.h + 0.3, L.z1 + 0.2, 0x1e1c26);
  b.boxMM(L.a1 + 0.15, L.h - 0.05, L.z0, L.a1 + 0.22, L.h + 0.3, L.z1, col(NEON.cyan, 1.3), { emissive: true });
  for (const a of [12.5, 17]) b.boxMM(a - 0.1, L.h - 0.05, L.z0 + 1, a + 0.1, L.h, L.z1 - 1, col(0xffffff, 1.0), { emissive: true });
  glassWallA(ctx, L.a1, L.z0, L.z1 - 3, 0, L.h, 2.5);
  glassWallZ(ctx, L.z0, L.a0, L.a1, 0, L.h, 2.5);
  for (const z of [-24, -19, -14]) {
    b.boxMM(11, 0, z - 1.2, 11.8, 0.45, z + 1.2, 0x3a3048);
    ctx.blocker(10.9, 11.9, z - 1.25, z + 1.25);
    ctx.person([11.4, 0, z - 0.5], [15, 0, z - 0.5], 2);
  }
  ctx.screen(10.45, 2.0, -18, Math.PI / 2, 3.6, 2.0, 6 + 15, NEON.cyan, NEON.purple);
  ctx.blocker(19.9, 20.1, L.z0, L.z1 - 3);
  ctx.blocker(L.a0, L.a1, L.z0 - 0.1, L.z0 + 0.1);
  ctx.shelter(L.a0, L.a1, 0, L.h, L.z0, L.z1);

  // control tower
  b.boxMM(54, 0, -28, 60, 6, -22, 0x24222c);
  b.boxMM(53.6, 6, -28.4, 60.4, 9, -21.6, 0x1a1822);
  g.boxMM(53.5, 6.3, -28.5, 60.5, 8.7, -21.5, new THREE.Color(0.3, 0.9, 1.0));
  b.boxMM(53.6, 9, -28.4, 60.4, 9.3, -21.6, col(NEON.cyan, 1.2), { emissive: true });
  b.box(57, 12, -25, 0.4, 6, 0.4, 0x2a2a35);
  ctx.halo(57, 15, -25, new THREE.Color(1, 0.05, 0.05), 2.5, 1);
  ctx.blocker(53.8, 60.2, -28.2, -21.8);
  ctx.sign(56.95, 4, -21.9, 0, 5, 1.1, ctx.st.cell, NEON.cyan);

  // fuel/charging stations next to the pads
  for (const [a, z] of [[38, -22], [40, 22]]) {
    b.boxMM(a - 0.6, 0, z - 0.4, a + 0.6, 1.8, z + 0.4, 0x2a2733);
    b.boxMM(a - 0.5, 1.2, z - 0.42, a + 0.5, 1.6, z - 0.41, col(NEON.green, 1.2), { emissive: true });
    ctx.blocker(a - 0.7, a + 0.7, z - 0.5, z + 0.5);
  }

  // ground crew + travellers
  ctx.person([30, 0, -2.5], [30, 0, -8], 3, { jacket: 0xc86400, visor: 1, neon: NEON.orange });
  ctx.person([48, 0, 3], [48, 0, 8], 3, { jacket: 0xc86400, visor: 1, neon: NEON.orange });
  for (let i = 0; i < 6; i++) {
    const z = r.float(-1.2, 1.2);
    ctx.person([r.float(11, 20), 0, z], [r.float(40, 58), 0, z], 0, { speed: r.float(1.0, 1.4) });
  }
  for (let i = 0; i < 4; i++) ctx.person([61, 0, r.float(-26, 26)], [70, 0, r.float(-26, 26)], 3);

  // animated landing cars
  const cars = [];
  const colors = [[0xc8b000, NEON.cyan], [0x5a0a1a, NEON.pink], [0x1a1a1f, NEON.green]];
  for (let i = 0; i < 3; i++) {
    const m = makeCarMesh(colors[i][0], colors[i][1]);
    m.scale.setScalar(1.15);
    ctx.group.add(m);
    cars.push({ mesh: m, pad: pads[i % 2], offset: i * 22, dir: i % 2 ? 1 : -1 });
  }
  const tmp = new THREE.Vector3();
  const period = 66;
  const ease = (x) => x * x * (3 - 2 * x);
  ctx.updaters.push((t) => {
    for (const c of cars) {
      let ph = ((t + c.offset) % period) / period * 44; // 44 "seconds" of choreography
      const [pa, pz] = c.pad;
      const far1 = ctx.v(pa + 260, 40, pz + c.dir * 200);
      const far2 = ctx.v(pa + 260, 70, pz - c.dir * 220);
      const above = ctx.v(pa, 14, pz);
      const down = ctx.v(pa, 0.55, pz);
      let pos, look = null;
      if (ph < 12) {
        const k = ease(ph / 12);
        pos = tmp.copy(far1).lerp(above, k);
        look = above;
      } else if (ph < 17) {
        pos = tmp.copy(above).lerp(down, ease((ph - 12) / 5));
      } else if (ph < 27) {
        pos = tmp.copy(down);
      } else if (ph < 32) {
        pos = tmp.copy(down).lerp(above, ease((ph - 27) / 5));
      } else if (ph < 44) {
        const k = ease((ph - 32) / 12);
        pos = tmp.copy(above).lerp(far2, k);
        look = far2;
      }
      c.mesh.position.copy(pos);
      if (look) {
        const dx = look.x - pos.x, dz = look.z - pos.z;
        if (dx * dx + dz * dz > 1) c.mesh.rotation.y = Math.atan2(dx, dz);
      }
      c.mesh.visible = ph < 44;
    }
  });

  // tower
  ctx.tower(8, 64, -32, 32, -H, -1.2, [3, 91, 0.5, 1]);

  ctx.rect(10.3, 61.8, -29.8, 29.8, 0);
  ctx.rect(9.5, 10.8, -4, 4, 0);
  ctx.zone(4, 68, -36, 36, { yMin: 0, yMax: H + 20 });
  ctx.obstacle(10, 400, -60, 60, -10, 120);
  // keep the approach corridor clear of tall buildings
  ctx.zone(64, 300, -240, 240, { kind: 'cap', maxH: H + 5 });
}
