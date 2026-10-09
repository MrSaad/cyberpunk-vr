import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { shared } from './shared.js';
import { FOG_COLOR, FOG_DENSITY } from './palette.js';
import { Route } from './route.js';
import { Nav } from './nav.js';
import { Signs, Screens } from './signs.js';
import { Halos } from './halos.js';
import { People } from './people.js';
import { BuildingSet, buildCity } from './city.js';
import { buildTrack } from './track.js';
import { Trains } from './train.js';
import { buildTraffic } from './traffic.js';
import { buildSky, buildSmog, buildSkyline } from './sky.js';
import { Rain } from './rain.js';
import { buildExtras } from './extras.js';
import { Player } from './player.js';
import { StationContext } from './stations/common.js';
import { buildHome } from './stations/home.js';
import { buildSkydeck } from './stations/skydeck.js';
import { buildSkyport } from './stations/skyport.js';
import { buildAtrium } from './stations/atrium.js';
import { buildMarket } from './stations/market.js';
import { buildCafe } from './stations/cafe.js';

const BUILDERS = {
  home: buildHome,
  skydeck: buildSkydeck,
  skyport: buildSkyport,
  atrium: buildAtrium,
  market: buildMarket,
  cafe: buildCafe,
};

const params = new URLSearchParams(location.search);

// --- renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1.0);
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
scene.background = FOG_COLOR.clone();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 3500);

// --- world ---
const buildStart = performance.now();
const route = new Route();
const nav = new Nav();
const signs = new Signs();
const screens = new Screens();
const halos = new Halos();
const people = new People(31);
const buildings = new BuildingSet();
const rain = new Rain(params.has('norain') ? 0 : 7000);
const env = { scene, nav, signs, screens, halos, people, buildings, zones: [], obstacles: [], rain, route };

const stations = route.stations.map((st) => {
  const ctx = new StationContext(st, env);
  BUILDERS[st.id](ctx);
  ctx.finish();
  return ctx;
});

scene.add(buildCity({ route, zones: env.zones, buildings, signs, screens, halos, people }));
scene.add(buildings.build());
scene.add(buildTrack(route, route.stations));
const trains = new Trains(route, nav, rain, scene);
scene.add(buildTraffic({ obstacles: env.obstacles, route, stations: route.stations }));
const extras = buildExtras({ scene, buildings, stations: route.stations });
scene.add(signs.build(), screens.build(), halos.build(), people.build(), rain.mesh, buildSky(), buildSmog(), buildSkyline());
scene.updateMatrixWorld(true);
console.info(`[cyberpunk-vr] world generated in ${Math.round(performance.now() - buildStart)} ms`);

// --- player ---
const player = new Player(renderer, camera, nav, scene);
const home = stations.find((s) => s.st.id === 'home');
const teleport = (i) => {
  const ctx = stations[i];
  if (!ctx) return;
  if (ctx.spawn) player.spawn(ctx.group, ctx.spawn.local, ctx.spawn.yaw);
  else player.spawn(ctx.group, ctx.v(6, 0, 0), ctx.side * Math.PI / 2);
};
player.onTeleportKey = teleport;
const startAt = params.get('station');
if (startAt && stations.some((s) => s.st.id === startAt)) teleport(stations.findIndex((s) => s.st.id === startAt));
else player.spawn(home.group, home.spawn.local, home.spawn.yaw);

// --- loop ---
const clock = new THREE.Clock();
const timeOffset = parseFloat(params.get('t') || '0');
let elapsed = 0;
const camPos = new THREE.Vector3();
let first = true;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const t = elapsed + timeOffset;
  shared.uTime.value = t % 7200;
  trains.update(t);
  camera.getWorldPosition(camPos);
  for (const s of stations) for (const u of s.updaters) u(t, trains, camPos, dt);
  player.update(dt);
  camera.getWorldPosition(camPos);
  rain.update(camPos);
  extras.update(t);
  renderer.render(scene, camera);
  if (first) {
    first = false;
    document.getElementById('loading')?.remove();
  }
}
renderer.setAnimationLoop(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.xr.addEventListener('sessionstart', () => {
  document.getElementById('overlay')?.style.setProperty('display', 'none');
});
renderer.xr.addEventListener('sessionend', () => {
  document.getElementById('overlay')?.style.removeProperty('display');
});

// handy for debugging from the console
window.__app = { scene, camera, renderer, player, route, trains, stations, nav, teleport, skip: (s) => { elapsed += s; } };
