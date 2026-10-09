import * as THREE from 'three';

// Night City-ish neon palette (sRGB hex, converted to linear by THREE.Color).
export const NEON = {
  yellow: 0xe0a84e,
  cyan: 0x6fb3b8,
  magenta: 0xd0607a,
  pink: 0xc87890,
  red: 0xd04a32,
  purple: 0x9a7aa8,
  orange: 0xf08a40,
  green: 0x8ab89a,
};

export const NEON_LIST = Object.values(NEON).map((h) => new THREE.Color(h));

// Blade Runner style dusk: thick warm haze that swallows the distance.
export const FOG_COLOR = new THREE.Color(0x9c5c38);
export const FOG_DENSITY = 0.00145;
// Low sun sitting in the haze toward the west.
export const SUN_DIR = new THREE.Vector3(-0.86, 0.07, -0.5).normalize();
export const SUN_COLOR = new THREE.Color(0xffa060);

export function col(hex, mul = 1) {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(mul);
}
