import * as THREE from 'three';
import { RNG } from './rng.js';

// ---------------------------------------------------------------------------
// The skytrain loop: a closed spline through six stations around downtown.
// Stations sit on short straight, level sections so platforms line up with
// the train doors exactly.
// ---------------------------------------------------------------------------
export const RING_RADIUS = 760;
export const TRAIN_LENGTH = 30; // car spans z -15..15 in local space
export const DOOR_Z = [-9, 0, 9];
export const DOOR_WIDTH = 1.6;
export const DWELL = 22;
export const VMAX = 62;
export const ACCEL = 4.2;
export const TRAIN_COUNT = 4;

// Order around the loop (counter-clockwise). `side` is which side of the
// track the platform is on: 'in' = toward downtown, 'out' = away from it.
export const STATION_DEFS = [
  { id: 'home', name: 'HOME', cell: 0, height: 170, angle: 0, side: 'in', accent: '#d0607a' },
  { id: 'skydeck', name: 'SKYDECK', cell: 1, height: 205, angle: 60, side: 'in', accent: '#8ab89a' },
  { id: 'skyport', name: 'SKYPORT', cell: 2, height: 140, angle: 120, side: 'out', accent: '#6fb3b8' },
  { id: 'atrium', name: 'KUROGANE TOWER', cell: 3, height: 62, angle: 180, side: 'in', accent: '#d04a32' },
  { id: 'market', name: 'NIGHT MARKET', cell: 4, height: 14, angle: 240, side: 'out', accent: '#e0a84e' },
  { id: 'cafe', name: 'KAFE 22', cell: 5, height: 96, angle: 300, side: 'out', accent: '#9a7aa8' },
];

export class Route {
  constructor() {
    const rng = new RNG(4242);
    const pts = [];
    const deg = Math.PI / 180;
    const n = STATION_DEFS.length;
    this.stations = [];
    STATION_DEFS.forEach((def, i) => {
      const th = def.angle * deg;
      const c = new THREE.Vector3(Math.cos(th) * RING_RADIUS, def.height, Math.sin(th) * RING_RADIUS);
      const t = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      for (const o of [-60, -30, 0, 30, 60]) pts.push(c.clone().addScaledVector(t, o));
      this.stations.push({ ...def, index: i, center: c, heading: t });
      // two wandering intermediate points before the next station
      const next = STATION_DEFS[(i + 1) % n];
      for (const f of [0.33, 0.66]) {
        const a = th + (60 * f) * deg;
        const r = RING_RADIUS + rng.float(-120, 120);
        const k = f;
        const y = def.height + (next.height - def.height) * k;
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
    });
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.curve.arcLengthDivisions = 8000;
    this.length = this.curve.getLength();

    // locate each station's arc-length parameter precisely
    const N = 4000;
    const tmp = new THREE.Vector3();
    for (const st of this.stations) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < N; i++) {
        const d = this.curve.getPointAt(i / N, tmp).distanceToSquared(st.center);
        if (d < bestD) { bestD = d; best = i / N; }
      }
      let lo = best - 1.5 / N, hi = best + 1.5 / N;
      const f = (u) => this.curve.getPointAt(((u % 1) + 1) % 1, tmp).distanceToSquared(st.center);
      for (let it = 0; it < 60; it++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (f(m1) < f(m2)) hi = m2; else lo = m1;
      }
      st.u = ((((lo + hi) / 2) % 1) + 1) % 1;
      st.s = st.u * this.length;
      st.position = this.curve.getPointAt(st.u);
      st.tangent = this.curve.getTangentAt(st.u);
      // which local side faces downtown?
      const group = new THREE.Object3D();
      group.position.copy(st.position);
      group.lookAt(st.position.clone().add(st.tangent));
      group.updateMatrixWorld();
      const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(group.quaternion);
      const toCenter = new THREE.Vector3(-st.position.x, 0, -st.position.z);
      const inSign = localX.dot(toCenter) > 0 ? 1 : -1;
      st.sideSign = st.side === 'in' ? inSign : -inSign;
      st.quaternion = group.quaternion.clone();
    }
    this.order = [...this.stations].sort((a, b) => a.u - b.u);

    // timetable
    this.legs = this.order.map((st, i) => {
      const nx = this.order[(i + 1) % this.order.length];
      const d = ((nx.s - st.s) % this.length + this.length) % this.length;
      return { from: st, to: nx, d, time: travelTime(d) };
    });
    this.period = this.legs.reduce((acc, l) => acc + DWELL + l.time, 0);
    let acc = 0;
    this.legs.forEach((l) => { l.start = acc; acc += DWELL + l.time; });
    const home = this.order.findIndex((s) => s.id === 'home');
    this.trainOffset = this.legs[home].start - 25; // a train pulls in ~25s after load

    // polyline samples for collision tests by the city generator
    this.samples = [];
    const step = 8;
    for (let s = 0; s < this.length; s += step) {
      const p = this.curve.getPointAt(s / this.length);
      this.samples.push(p);
    }
  }

  pointAt(s, target = new THREE.Vector3()) {
    const u = (((s / this.length) % 1) + 1) % 1;
    return this.curve.getPointAt(u, target);
  }

  // State of train k at global time t.
  trainState(k, t) {
    let tau = (((t + this.trainOffset + (k * this.period) / TRAIN_COUNT) % this.period) + this.period) % this.period;
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      if (tau < DWELL) {
        const open = smooth(1.0, 2.6, tau) * (1 - smooth(DWELL - 4.2, DWELL - 2.6, tau));
        return { s: leg.from.s, docked: leg.from, door: open, next: leg.to, speed: 0, departIn: DWELL - tau };
      }
      tau -= DWELL;
      if (tau < leg.time) {
        const { dist, v } = profile(leg.d, tau);
        return { s: leg.from.s + dist, docked: null, door: 0, next: leg.to, speed: v, arriveIn: leg.time - tau };
      }
      tau -= leg.time;
    }
    return { s: 0, docked: null, door: 0, next: this.order[0], speed: 0 };
  }

  // Seconds until the next train arrives at a station (0 if one is boarding).
  stationStatus(station, t) {
    const idx = this.order.indexOf(station);
    const start = this.legs[idx].start;
    let best = Infinity, boarding = null;
    for (let k = 0; k < TRAIN_COUNT; k++) {
      const tau = (((t + this.trainOffset + (k * this.period) / TRAIN_COUNT) % this.period) + this.period) % this.period;
      const into = tau - start;
      if (into >= 0 && into < DWELL) boarding = DWELL - into;
      const wait = (((start - tau) % this.period) + this.period) % this.period;
      best = Math.min(best, wait);
    }
    return { boarding, wait: best, next: this.legs[idx].to };
  }
}

function travelTime(d) {
  const ta = VMAX / ACCEL;
  const da = 0.5 * ACCEL * ta * ta;
  if (d >= 2 * da) return 2 * ta + (d - 2 * da) / VMAX;
  return 2 * Math.sqrt(d / ACCEL);
}

function profile(d, t) {
  const ta = VMAX / ACCEL;
  const da = 0.5 * ACCEL * ta * ta;
  if (d >= 2 * da) {
    const tc = (d - 2 * da) / VMAX;
    const total = 2 * ta + tc;
    if (t < ta) return { dist: 0.5 * ACCEL * t * t, v: ACCEL * t };
    if (t < ta + tc) return { dist: da + VMAX * (t - ta), v: VMAX };
    const r = total - t;
    return { dist: d - 0.5 * ACCEL * r * r, v: ACCEL * r };
  }
  const th = Math.sqrt(d / ACCEL);
  if (t < th) return { dist: 0.5 * ACCEL * t * t, v: ACCEL * t };
  const r = 2 * th - t;
  return { dist: d - 0.5 * ACCEL * r * r, v: ACCEL * r };
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
