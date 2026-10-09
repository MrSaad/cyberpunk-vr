import * as THREE from 'three';

// Night City-ish neon palette (sRGB hex, converted to linear by THREE.Color).
export const NEON = {
  yellow: 0xfcee0a,
  cyan: 0x00f0ff,
  magenta: 0xff2a6d,
  pink: 0xff00a0,
  red: 0xff1744,
  purple: 0xb026ff,
  orange: 0xff8a00,
  green: 0x05ffa1,
};

export const NEON_LIST = Object.values(NEON).map((h) => new THREE.Color(h));

export const FOG_COLOR = new THREE.Color(0x2a1440);
export const FOG_DENSITY = 0.00125;

export function col(hex, mul = 1) {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(mul);
}
