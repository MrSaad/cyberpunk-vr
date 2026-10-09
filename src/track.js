import * as THREE from 'three';
import { MeshBuilder, builderMesh } from './builder.js';
import { BLOCK, STREET } from './city.js';
import { col } from './palette.js';

// Elevated guideway: a box-section beam swept along the route spline with
// glowing edge rails, plus support pillars down to street level.
export function buildTrack(route, stations) {
  const pos = [], colors = [], idx = [];
  const step = 3;
  const n = Math.ceil(route.length / step);
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3(), nup = new THREE.Vector3();
  // cross-section in (side, up) coordinates + colour; consecutive pairs form faces
  const W = 1.55;
  const profile = [
    // [x, y, r, g, b]
    [-W, -0.8, 0.06, 0.06, 0.08],
    [W, -0.8, 0.06, 0.06, 0.08],
    [W, -0.8, 0.0, 0.94, 1.0],
    [W, -1.05, 0.0, 0.94, 1.0],
    [W, -1.05, 0.035, 0.03, 0.05],
    [W * 0.8, -2.2, 0.02, 0.02, 0.03],
    [W * 0.8, -2.2, 0.02, 0.02, 0.03],
    [0.15, -2.2, 0.02, 0.02, 0.03],
    [0.15, -2.2, 1.0, 0.16, 0.43],
    [-0.15, -2.2, 1.0, 0.16, 0.43],
    [-0.15, -2.2, 0.02, 0.02, 0.03],
    [-W * 0.8, -2.2, 0.02, 0.02, 0.03],
    [-W * 0.8, -2.2, 0.035, 0.03, 0.05],
    [-W, -1.05, 0.035, 0.03, 0.05],
    [-W, -1.05, 0.0, 0.94, 1.0],
    [-W, -0.8, 0.0, 0.94, 1.0],
  ];
  const linear = profile.map(([x, y, r, g, b]) => [x, y, new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace)]);
  const P = linear.length;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) % 1;
    route.curve.getPointAt(u, p);
    route.curve.getTangentAt(u, t);
    side.crossVectors(t, up).normalize();
    nup.crossVectors(side, t).normalize();
    for (const [x, y, c] of linear) {
      pos.push(p.x + side.x * x + nup.x * y, p.y + side.y * x + nup.y * y, p.z + side.z * x + nup.z * y);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < P; j += 2) {
      const a = i * P + j, b = i * P + j + 1, c = (i + 1) * P + j, d = (i + 1) * P + j + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  beam.frustumCulled = false;

  // pillars
  const b = new MeshBuilder({ ambient: new THREE.Color(0.5, 0.42, 0.62), maxSeg: 1e9 });
  const spacing = 65;
  for (let s = 0; s < route.length; s += spacing) {
    route.pointAt(s, p);
    // keep streets clear for flying traffic, and stations have their own supports
    const gx = Math.abs(((p.x % BLOCK) + BLOCK * 1.5) % BLOCK - BLOCK / 2);
    const gz = Math.abs(((p.z % BLOCK) + BLOCK * 1.5) % BLOCK - BLOCK / 2);
    if (gx < STREET / 2 + 3 || gz < STREET / 2 + 3) continue;
    if (stations.some((st) => st.position.distanceTo(p) < 70)) continue;
    const top = p.y - 2.2;
    if (top < 6) continue;
    b.box(p.x, top / 2, p.z, 2.4, top, 2.4, 0x2b2933);
    b.box(p.x, top - 0.6, p.z, 4.2, 1.2, 4.2, 0x353340);
    b.box(p.x + 1.22, top / 2, p.z, 0.08, top, 0.4, col(0xff2a6d, 1.2), { emissive: true });
    b.box(p.x - 1.22, top / 2, p.z, 0.08, top, 0.4, col(0x00f0ff, 1.2), { emissive: true });
  }
  const pillars = builderMesh(b);
  const group = new THREE.Group();
  group.add(beam);
  if (pillars) group.add(pillars);
  return group;
}
