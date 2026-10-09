import * as THREE from 'three';
import { MeshBuilder, materials } from './builder.js';
import { TextPanel } from './textures.js';
import { DOOR_Z, DOOR_WIDTH, TRAIN_COUNT } from './route.js';
import { People } from './people.js';
import { NEON } from './palette.js';

const HALF_L = 15;
const HALF_W = 1.8;
const BENCHES = [[-13.6, -9.9], [-8.1, -0.9], [0.9, 8.1], [9.9, 11.2]];

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function buildCarGeometry() {
  const b = new MeshBuilder({ ambient: new THREE.Color(0.3, 0.27, 0.24), maxSeg: 1.2 });
  for (const z of [-12, -6, 0, 6, 12]) b.addLight(0, 2.5, z, 0xd8f4ff, 0.9, 3.2);
  b.addLight(0, 1.0, 14, 0xd0607a, 0.4, 3);
  b.addLight(0, 1.0, -14, 0x6fb3b8, 0.4, 3);
  const body = 0x22202c, hull = 0xd8d4e0, trim = 0x14121a;
  const gl = new MeshBuilder({ maxSeg: 1e9 });

  // underbody & floor
  b.boxMM(-HALF_W, -0.6, -HALF_L, HALF_W, -0.02, HALF_L, hull);
  b.boxMM(-HALF_W + 0.05, -0.04, -HALF_L + 0.05, HALF_W - 0.05, 0, HALF_L - 0.05, 0x2c2834);
  b.boxMM(-HALF_W - 0.02, -0.5, -HALF_L, -HALF_W, -0.38, HALF_L, new THREE.Color(0x6fb3b8).multiplyScalar(1.3), { emissive: true });
  b.boxMM(HALF_W, -0.5, -HALF_L, HALF_W + 0.02, -0.38, HALF_L, new THREE.Color(0x6fb3b8).multiplyScalar(1.3), { emissive: true });
  // aisle floor light strips
  b.boxMM(-1.15, 0, -HALF_L + 0.5, -1.1, 0.01, HALF_L - 0.5, new THREE.Color(0xd0607a).multiplyScalar(0.6), { emissive: true });
  b.boxMM(1.1, 0, -HALF_L + 0.5, 1.15, 0.01, HALF_L - 0.5, new THREE.Color(0xd0607a).multiplyScalar(0.6), { emissive: true });

  // side walls with door openings
  const doorEdges = [];
  for (const dz of DOOR_Z) doorEdges.push([dz - DOOR_WIDTH / 2, dz + DOOR_WIDTH / 2]);
  const solidSpans = [];
  let z = -HALF_L;
  for (const [a, c] of doorEdges) { solidSpans.push([z, a]); z = c; }
  solidSpans.push([z, HALF_L]);
  for (const sx of [-1, 1]) {
    const xo = sx * HALF_W, xi = sx * (HALF_W - 0.08);
    for (const [z0, z1] of solidSpans) {
      b.boxMM(xi, 0, z0, xo, 0.78, z1, body);
      b.boxMM(xo, 0, z0, xo + sx * 0.02, 0.78, z1, hull);
      // window pillars every ~3.6 m
      const n = Math.max(1, Math.round((z1 - z0) / 3.6));
      for (let i = 0; i <= n; i++) {
        const pz = z0 + ((z1 - z0) * i) / n;
        b.box((xi + xo) / 2, 1.62, pz, 0.1, 1.7, 0.14, trim);
      }
      gl.boxMM(xo - sx * 0.02, 0.78, z0, xo, 2.46, z1, new THREE.Color(0.62, 0.62, 0.6));
    }
    // above doors
    for (const [a, c] of doorEdges) {
      b.boxMM(xi, 2.3, a, xo, 2.46, c, body);
      b.boxMM(xo, 2.32, a, xo + sx * 0.02, 2.36, c, new THREE.Color(NEON.yellow).multiplyScalar(1.2), { emissive: true });
    }
    b.boxMM(xi, 2.46, -HALF_L, xo, 2.8, HALF_L, body);
    b.boxMM(xo, 2.46, -HALF_L, xo + sx * 0.02, 2.8, HALF_L, hull);
    // stripe along the side
    b.boxMM(xo + sx * 0.02, 0.6, -HALF_L, xo + sx * 0.03, 0.68, HALF_L, new THREE.Color(NEON.magenta).multiplyScalar(1.4), { emissive: true });
  }
  // roof & ceiling
  b.boxMM(-HALF_W, 2.8, -HALF_L, HALF_W, 3.05, HALF_L, hull);
  b.boxMM(-HALF_W + 0.1, 2.72, -HALF_L, HALF_W - 0.1, 2.8, HALF_L, 0x38343f);
  b.boxMM(-0.08, 3.05, -HALF_L + 1, 0.08, 3.1, HALF_L - 1, new THREE.Color(NEON.magenta).multiplyScalar(1.4), { emissive: true });
  for (const x of [-0.65, 0.65]) b.boxMM(x - 0.06, 2.68, -HALF_L + 0.6, x + 0.06, 2.72, HALF_L - 0.6, new THREE.Color(0.75, 0.82, 0.9), { emissive: true });
  // overhead grab rails & poles
  for (const x of [-0.95, 0.95]) {
    b.boxMM(x - 0.02, 2.05, -HALF_L + 1, x + 0.02, 2.09, HALF_L - 1, 0xb8b8c8);
    for (const dz of DOOR_Z) for (const o of [-1.3, 1.3]) b.cylinder(x, 1.36, dz + o, 0.025, 0.025, 2.72, 0xc8c8d8, { radial: 6 });
  }
  // benches
  for (const sx of [-1, 1]) {
    for (const [z0, z1] of BENCHES) {
      b.boxMM(sx * 1.22, 0, z0, sx * 1.72, 0.4, z1, 0x1e1b26);
      b.boxMM(sx * 1.2, 0.4, z0, sx * 1.72, 0.5, z1, 0x5a2a7a);
      b.boxMM(sx * 1.62, 0.5, z0, sx * 1.74, 0.98, z1, 0x4a2266);
    }
  }
  // ends: windshields + nose fairings
  for (const sz of [-1, 1]) {
    const ze = sz * HALF_L;
    b.boxMM(-HALF_W, 0, ze, HALF_W, 0.78, ze + sz * 0.08, body);
    b.boxMM(-HALF_W, 2.46, ze, HALF_W, 3.05, ze + sz * 0.08, hull);
    for (const x of [-1.74, 1.74]) b.box(x, 1.62, ze + sz * 0.04, 0.12, 1.7, 0.08, trim);
    gl.boxMM(-HALF_W, 0.78, ze, HALF_W, 2.46, ze + sz * 0.02, new THREE.Color(0.62, 0.62, 0.6));
    // nose
    b.boxMM(-HALF_W, -0.6, ze, HALF_W, 0.7, ze + sz * 1.2, hull);
    b.boxMM(-HALF_W + 0.2, -0.6, ze + sz * 1.2, HALF_W - 0.2, 0.25, ze + sz * 2.3, hull);
    b.boxMM(-HALF_W + 0.5, -0.55, ze + sz * 2.3, HALF_W - 0.5, -0.1, ze + sz * 2.8, hull);
    const lc = sz > 0 ? new THREE.Color(2, 2, 1.8) : new THREE.Color(2, 0.05, 0.1);
    b.boxMM(-1.4, 0.3, ze + sz * 1.21, -0.7, 0.45, ze + sz * 1.23, lc, { emissive: true });
    b.boxMM(0.7, 0.3, ze + sz * 1.21, 1.4, 0.45, ze + sz * 1.23, lc, { emissive: true });
    b.boxMM(-HALF_W + 0.5, -0.1, ze + sz * 2.3, HALF_W - 0.5, -0.04, ze + sz * 2.32, new THREE.Color(NEON.cyan).multiplyScalar(1.4), { emissive: true });
  }
  return { solid: b.build(), glass: gl.build() };
}

export class Trains {
  constructor(route, nav, rain, scene) {
    this.route = route;
    this.trains = [];
    const { solid, glass } = buildCarGeometry();
    const doorGeo = new THREE.BoxGeometry(0.05, 2.3, DOOR_WIDTH / 2);
    doorGeo.translate(0, 1.15, 0);
    const doorMat = new THREE.MeshBasicMaterial({ color: 0x3a3548 });
    const doorEdge = new THREE.BoxGeometry(0.06, 2.2, 0.04);
    doorEdge.translate(0, 1.15, 0);
    for (let k = 0; k < TRAIN_COUNT; k++) {
      const group = new THREE.Group();
      group.name = `train${k}`;
      const s = new THREE.Mesh(solid, materials.solid);
      const g = new THREE.Mesh(glass, materials.glass);
      g.renderOrder = 3;
      group.add(s, g);
      const doors = new THREE.InstancedMesh(doorGeo, doorMat, DOOR_Z.length * 4);
      doors.frustumCulled = false;
      group.add(doors);
      const edges = new THREE.InstancedMesh(doorEdge, new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON.cyan).multiplyScalar(1.3) }), DOOR_Z.length * 4);
      edges.frustumCulled = false;
      group.add(edges);

      // next-stop displays
      const panel = new TextPanel(512, 128);
      const dispMat = new THREE.MeshBasicMaterial({ map: panel.texture });
      for (const [z, ry] of [[10.6, Math.PI], [-10.6, 0]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), dispMat);
        m.position.set(0, 2.4, z);
        m.rotation.y = ry;
        group.add(m);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.48, 0.06), new THREE.MeshBasicMaterial({ color: 0x0c0a12 }));
        back.position.set(0, 2.4, z + (ry === 0 ? -0.04 : 0.04));
        group.add(back);
      }

      // head/tail light glows
      for (const [x, zz, c] of [[-1.05, 16.3, 0xffffff], [1.05, 16.3, 0xffffff], [-1.05, -16.3, 0xff1030], [1.05, -16.3, 0xff1030]]) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.scale.set(2.2, 2.2, 1);
        sp.position.set(x, 0.38, zz);
        group.add(sp);
      }

      // passengers
      const ppl = new People(900 + k);
      const r = ppl.rng;
      for (const sx of [-1, 1]) {
        for (const [z0, z1] of BENCHES) {
          for (let z = z0 + 0.4; z < z1 - 0.3; z += 0.7) {
            if (r.chance(0.28)) ppl.add({ a: new THREE.Vector3(sx * 1.48, 0, z), b: new THREE.Vector3(0, 0, z), pose: 2 });
          }
        }
      }
      for (let i = 0; i < 3; i++) {
        const z = r.float(-12, 12);
        ppl.add({ a: new THREE.Vector3(r.float(-0.7, 0.7), 0, z), b: new THREE.Vector3(r.float(-2, 2), 0, z + r.sign() * 3), pose: r.chance(0.5) ? 1 : 3 });
      }
      group.add(ppl.build());
      scene.add(group);

      // walkable areas inside the car
      nav.addRect(group, -1.68, 1.68, -HALF_L + 0.15, HALF_L - 0.15, 0);
      for (const sx of [-1, 1]) for (const [z0, z1] of BENCHES) nav.addBlocker(group, sx * 1.15, sx * 1.8, z0, z1, -0.5, 2.5);
      const doorRects = { '1': [], '-1': [] };
      for (const sx of [-1, 1]) {
        for (const dz of DOOR_Z) {
          const rr = nav.addRect(group, sx * 1.0, sx * 2.4, dz - DOOR_WIDTH / 2, dz + DOOR_WIDTH / 2, 0);
          rr.enabled = false;
          doorRects[sx].push(rr);
        }
      }
      rain.addShelter(group, new THREE.Vector3(0, 1.3, 0), new THREE.Vector3(1.95, 1.9, 17.5));

      this.trains.push({ k, group, doors, edges, panel, doorRects, lastDoor: -1, state: null });
    }
    this._front = new THREE.Vector3();
    this._rear = new THREE.Vector3();
    this._m = new THREE.Matrix4();
  }

  update(t) {
    for (const tr of this.trains) {
      const st = this.route.trainState(tr.k, t);
      tr.state = st;
      this.route.pointAt(st.s + HALF_L, this._front);
      this.route.pointAt(st.s - HALF_L, this._rear);
      tr.group.position.addVectors(this._front, this._rear).multiplyScalar(0.5);
      tr.group.lookAt(this._front);
      tr.group.updateMatrixWorld(true);

      const side = st.docked ? st.docked.sideSign : 1;
      const open = st.door;
      if (open !== tr.lastDoor || side !== tr.lastSide) {
        tr.lastDoor = open;
        tr.lastSide = side;
        let i = 0;
        for (const sx of [-1, 1]) {
          const o = sx === side ? open : 0;
          for (const dz of DOOR_Z) {
            for (const dir of [-1, 1]) {
              const zc = dz + dir * (DOOR_WIDTH / 4 + o * (DOOR_WIDTH / 2 - 0.02));
              this._m.makeTranslation(sx * (HALF_W - 0.02 + o * 0.05), 0, zc);
              tr.doors.setMatrixAt(i, this._m);
              this._m.makeTranslation(sx * (HALF_W + 0.01 + o * 0.05), 0, zc - dir * (DOOR_WIDTH / 4 - 0.02));
              tr.edges.setMatrixAt(i, this._m);
              i++;
            }
          }
        }
        tr.doors.instanceMatrix.needsUpdate = true;
        tr.edges.instanceMatrix.needsUpdate = true;
        for (const sx of [-1, 1]) for (const rr of tr.doorRects[sx]) rr.enabled = sx === side && open > 0.85;
      }

      if (tr.lastPanel !== undefined && Math.abs(t - tr.lastPanel) < 0.5) continue;
      tr.lastPanel = t;
      const lines = st.docked
        ? [{ text: `NOW ▸ ${st.docked.name}`, color: '#e0a84e', size: 44 }, { text: `NEXT ▸ ${st.next.name}`, color: '#6fb3b8', size: 34 }]
        : [{ text: `NEXT ▸ ${st.next.name}`, color: '#e0a84e', size: 44 }, { text: `${Math.round(st.speed * 3.6)} km/h · ${Math.ceil(st.arriveIn)}s`, color: '#d0607a', size: 34 }];
      tr.panel.draw(lines, { accent: '#d0607a' });
    }
  }
}
