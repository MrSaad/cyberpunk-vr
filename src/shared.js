import * as THREE from 'three';
import { FOG_COLOR, FOG_DENSITY, SUN_DIR, SUN_COLOR } from './palette.js';

// Uniforms shared by every custom shader. Updated once per frame.
export const shared = {
  uTime: { value: 0 },
  uFogColor: { value: FOG_COLOR.clone() },
  uFogDensity: { value: FOG_DENSITY },
  uSunDir: { value: SUN_DIR.clone() },
  uSunColor: { value: SUN_COLOR.clone() },
};

// GLSL helpers injected in custom shaders.
export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
vec3 desat(vec3 c, float k){ return mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, k); }
float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 hash23(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
float fogAmount(float depth){ float f = uFogDensity*depth; return 1.0 - exp(-f*f); }
`;

export function linearToOutput() {
  return '#include <colorspace_fragment>';
}

export function makeShaderMaterial(opts) {
  const m = new THREE.ShaderMaterial({
    ...opts,
    uniforms: { ...shared, ...(opts.uniforms || {}) },
  });
  return m;
}
