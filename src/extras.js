import * as THREE from 'three';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';
import { NEON, col } from './palette.js';
import { RNG } from './rng.js';

// Sky spectacle: giant holographic koi, sweeping searchlights, advertising
// blimps and spinning holo crowns on the tallest towers.
export function buildExtras({ scene, buildings, stations }) {
  const rng = new RNG(99);
  const updaters = [];
  const group = new THREE.Group();
  scene.add(group);

  // --- tallest towers (away from stations) ---
  const tops = buildings.boxes
    .map((b) => ({ x: b.cx, z: b.cz, top: b.cy + b.sy / 2, w: Math.min(b.sx, b.sz) }))
    .filter((t) => stations.every((s) => Math.hypot(s.position.x - t.x, s.position.z - t.z) > 120))
    .sort((a, b) => b.top - a.top);
  const picks = [];
  for (const t of tops) {
    if (picks.every((p) => Math.hypot(p.x - t.x, p.z - t.z) > 220)) picks.push(t);
    if (picks.length >= 10) break;
  }

  // --- holographic koi ---
  const koiGeo = (() => {
    const body = new THREE.SphereGeometry(0.5, 20, 12);
    body.scale(0.22, 0.2, 1);
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, -0.45, 0, 0.22, -0.85, 0, -0.05, -0.62,
      0, 0, -0.45, 0, -0.22, -0.85, 0, 0.05, -0.62,
      0, 0.08, 0.05, 0, 0.2, -0.2, 0, 0.09, -0.25,
      0.08, -0.04, 0.2, 0.3, -0.1, 0.05, 0.09, -0.05, 0.05,
      -0.08, -0.04, 0.2, -0.3, -0.1, 0.05, -0.09, -0.05, 0.05,
    ], 3));
    tail.computeVertexNormals();
    const merged = new THREE.BufferGeometry();
    const p1 = body.toNonIndexed().attributes.position.array;
    const n1 = body.toNonIndexed().attributes.normal.array;
    const p2 = tail.attributes.position.array, n2 = tail.attributes.normal.array;
    const pos = new Float32Array(p1.length + p2.length), nor = new Float32Array(n1.length + n2.length);
    pos.set(p1); pos.set(p2, p1.length); nor.set(n1); nor.set(n2, n1.length);
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return merged;
  })();
  const koiMat = (color) => makeShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPhase: { value: rng.next() * 10 } },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform float uPhase;
      varying vec3 vN; varying vec3 vV; varying float vZ; varying float vFog; varying float vY;
      void main(){
        vec3 p = position;
        float sw = sin(p.z * 5.0 - uTime * 2.4 + uPhase) * 0.12 * (0.6 - p.z);
        p.x += sw;
        vZ = p.z; vY = p.y;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vec4 mv = viewMatrix * wp;
        vFog = fogAmount(-mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV; varying float vZ; varying float vFog; varying float vY;
      void main(){
        float rim = 1.0 - abs(dot(normalize(vN), vV));
        float scan = 0.6 + 0.4 * sin(vY * 140.0 - uTime * 6.0);
        float spots = step(0.6, fract(sin(floor(vZ * 9.0) * 13.1) * 43758.5));
        vec3 c = uColor * (0.15 + rim * 1.1) * scan;
        c = mix(c, vec3(1.0, 0.95, 0.9) * (0.2 + rim), spots * 0.4);
        gl_FragColor = vec4(c * (1.0 - vFog), 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const kois = [];
  const centre = picks[0] || { x: 0, z: 0, top: 300 };
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(koiGeo, koiMat(i === 1 ? 0x30c0ff : 0xff7a20));
    m.scale.setScalar(70 - i * 12);
    m.frustumCulled = false;
    m.renderOrder = 4;
    group.add(m);
    kois.push({ m, r: 150 + i * 70, y: centre.top * 0.55 + 60 + i * 45, speed: 0.05 - i * 0.008, ph: i * 2.1 });
  }
  updaters.push((t) => {
    for (const k of kois) {
      const a = t * k.speed + k.ph;
      const x = centre.x + Math.cos(a) * k.r, z = centre.z + Math.sin(a) * k.r;
      const y = k.y + Math.sin(t * 0.3 + k.ph) * 12;
      k.m.position.set(x, y, z);
      k.m.lookAt(centre.x + Math.cos(a + 0.05) * k.r, y + Math.cos(t * 0.3 + k.ph) * 0.6, centre.z + Math.sin(a + 0.05) * k.r);
    }
  });

  // --- searchlights ---
  const beamGeo = new THREE.CylinderGeometry(28, 1.5, 800, 24, 1, true);
  beamGeo.translate(0, 400, 0);
  const beamMat = makeShaderMaterial({
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){
        vH = position.y / 800.0;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(normalize(vN), vV)), 2.0);
        float a = (1.0 - vH) * (1.0 - vH) * edge * 0.12;
        gl_FragColor = vec4(vec3(0.75, 0.8, 1.0) * a, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beams = [];
  for (let i = 1; i < Math.min(picks.length, 7); i++) {
    const p = picks[i];
    const m = new THREE.Mesh(beamGeo, beamMat);
    m.position.set(p.x, p.top, p.z);
    m.frustumCulled = false;
    m.renderOrder = 4;
    group.add(m);
    beams.push({ m, ph: rng.next() * 10, sp: rng.float(0.15, 0.3) });
  }
  updaters.push((t) => {
    for (const b of beams) {
      b.m.rotation.set(Math.sin(t * b.sp + b.ph) * 0.45, 0, Math.cos(t * b.sp * 0.8 + b.ph) * 0.45);
    }
  });

  // --- holo crowns on tall towers ---
  const crownMat = (c) => new THREE.MeshBasicMaterial({ color: col(c, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const crowns = [];
  for (let i = 0; i < Math.min(picks.length, 5); i++) {
    const p = picks[i];
    const c = [NEON.cyan, NEON.magenta, NEON.yellow, NEON.purple, NEON.green][i];
    const g = new THREE.Group();
    g.position.set(p.x, p.top + 25, p.z);
    const r = Math.max(12, p.w * 0.45);
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (1 - k * 0.2), 0.5, 6, 48), crownMat(c));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = k * 8;
      g.add(ring);
    }
    group.add(g);
    crowns.push(g);
  }
  updaters.push((t) => {
    crowns.forEach((g, i) => {
      g.children.forEach((ring, k) => {
        ring.rotation.y = Math.sin(t * 0.4 + k + i) * 0.3;
        ring.position.y = k * 8 + Math.sin(t * 0.8 + k * 1.3 + i) * 3;
      });
    });
  });

  // --- blimps with scrolling ad tickers ---
  const tickerCanvas = document.createElement('canvas');
  tickerCanvas.width = 2048;
  tickerCanvas.height = 256;
  const ctx = tickerCanvas.getContext('2d');
  ctx.fillStyle = '#05010a';
  ctx.fillRect(0, 0, 2048, 256);
  ctx.font = '900 150px "Arial Black", "Roboto", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 20;
  const msgs = [['KAIJU COLA', '#fcee0a'], ['DRINK THE FUTURE', '#ff2a6d'], ['NEOTEK', '#00f0ff']];
  let x = 40;
  for (const [m, c] of msgs) {
    ctx.fillStyle = c;
    ctx.shadowColor = c;
    ctx.fillText(m, x, 135);
    x += ctx.measureText(m).width + 120;
  }
  const tickerTex = new THREE.CanvasTexture(tickerCanvas);
  tickerTex.colorSpace = THREE.SRGBColorSpace;
  tickerTex.wrapS = THREE.RepeatWrapping;
  const blimps = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 0x14121c }));
    body.scale.set(18, 18, 70);
    g.add(body);
    for (const s of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(90, 11), new THREE.MeshBasicMaterial({ map: tickerTex }));
      pl.position.set(s * 18.3, 0, 0);
      pl.rotation.y = s * Math.PI / 2;
      g.add(pl);
    }
    for (const [px, py, pz, c] of [[0, -18, 0, 0xff2a6d], [0, 0, 70, 0xffffff], [0, 0, -70, 0xff1020]]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: c }));
      l.position.set(px, py, pz);
      g.add(l);
    }
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1, 22, 16), new THREE.MeshBasicMaterial({ color: 0x1c1a26 }));
    fin.position.set(0, 10, -60);
    g.add(fin);
    group.add(g);
    blimps.push({ g, r: 900 + i * 250, y: 380 + i * 60, sp: 0.012 - i * 0.004, ph: i * 3 });
  }
  updaters.push((t) => {
    tickerTex.offset.x = (t * 0.03) % 1;
    for (const b of blimps) {
      const a = t * b.sp + b.ph;
      b.g.position.set(Math.cos(a) * b.r, b.y + Math.sin(t * 0.1) * 5, Math.sin(a) * b.r);
      b.g.lookAt(Math.cos(a + 0.01) * b.r, b.y, Math.sin(a + 0.01) * b.r);
    }
  });

  return { group, update: (t) => updaters.forEach((u) => u(t)) };
}
