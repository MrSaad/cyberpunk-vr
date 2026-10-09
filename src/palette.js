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

// Late dusk turning to night: a thin dark plum haze over the distance.
export const FOG_COLOR = new THREE.Color(0x2a2230);
export const FOG_DENSITY = 0.0011;
// Sun just setting toward the west, leaving an orange glow on the horizon.
export const SUN_DIR = new THREE.Vector3(-0.86, 0.03, -0.5).normalize();
export const SUN_COLOR = new THREE.Color(0xe0703c);

export function col(hex, mul = 1) {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(mul);
}
