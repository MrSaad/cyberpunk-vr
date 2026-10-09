import * as THREE from 'three';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';
import { getNoiseTexture } from './textures.js';

// Sky dome: light-polluted horizon, drifting cloud deck lit from below by the
// city, a hazy moon. Follows the camera so it never clips.
export function buildSky() {
  const geo = new THREE.SphereGeometry(3000, 48, 24);
  const mat = makeShaderMaterial({
    uniforms: { uNoise: { value: getNoiseTexture() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform sampler2D uNoise;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zenith = vec3(0.012, 0.006, 0.03);
        vec3 mid = vec3(0.08, 0.025, 0.12);
        vec3 c = mix(uFogColor, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, zenith, smoothstep(0.15, 0.7, h));
        // warm glow in the direction of downtown haze
        c += vec3(0.12, 0.03, 0.06) * pow(max(0.0, 1.0 - abs(h) * 3.0), 3.0) * (0.6 + 0.4 * d.x);
        // clouds
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 0.12;
          float n1 = texture2D(uNoise, uv + vec2(uTime * 0.002, uTime * 0.001)).r;
          float n2 = texture2D(uNoise, uv * 2.7 - vec2(uTime * 0.003, 0.0)).g;
          float cl = smoothstep(0.38, 0.75, n1 * 0.7 + n2 * 0.45);
          vec3 lit = mix(vec3(0.28, 0.07, 0.24), vec3(0.06, 0.12, 0.22), smoothstep(0.05, 0.5, h));
          c = mix(c, lit, cl * smoothstep(0.0, 0.08, h) * 0.85);
          // moon
          vec3 md = normalize(vec3(-0.5, 0.42, -0.75));
          float m = dot(d, md);
          c += vec3(0.8, 0.85, 1.0) * smoothstep(0.9994, 0.9997, m) * (1.0 - cl * 0.7);
          c += vec3(0.25, 0.2, 0.35) * pow(max(0.0, m), 300.0);
          // sparse stars through gaps
          vec2 sp = floor(d.xz / (h + 0.3) * 400.0);
          float st = step(0.997, hash21(sp)) * (1.0 - cl) * smoothstep(0.3, 0.6, h);
          c += vec3(st) * 0.6;
        } else {
          c = mix(uFogColor, uFogColor * 0.6, smoothstep(0.0, -0.2, h));
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (renderer, scene, camera) => {
    camera.getWorldPosition(mesh.position);
    mesh.updateMatrixWorld();
  };
  return mesh;
}

// Low-lying smog layer between the street canyons and the upper city.
export function buildSmog() {
  const geo = new THREE.PlaneGeometry(3200, 3200);
  geo.rotateX(-Math.PI / 2);
  const mat = makeShaderMaterial({
    uniforms: { uNoise: { value: getNoiseTexture() } },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec3 vW; varying float vFog;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vFog = fogAmount(-mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform sampler2D uNoise;
      varying vec3 vW; varying float vFog;
      void main(){
        float n = texture2D(uNoise, vW.xz / 900.0 + uTime * 0.003).r;
        float n2 = texture2D(uNoise, vW.xz / 300.0 - uTime * 0.004).g;
        float a = smoothstep(0.25, 0.8, n * 0.8 + n2 * 0.4) * 0.45;
        float dc = distance(cameraPosition, vW);
        a *= smoothstep(15.0, 120.0, dc);
        vec3 c = mix(vec3(0.35, 0.08, 0.3), vec3(0.1, 0.2, 0.35), n2);
        gl_FragColor = vec4(mix(c, uFogColor, vFog * 0.6), a * (1.0 - vFog * 0.5));
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 42;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return mesh;
}

// Distant skyline band: building silhouettes with lit windows on a cylinder
// far beyond the generated city, so the city never visibly ends.
export function buildSkyline() {
  const R = 2350;
  const geo = new THREE.CylinderGeometry(R, R, 700, 160, 1, true);
  geo.translate(0, 300, 0);
  const mat = makeShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec3 vW;
      float heightAt(float id){
        float h = 40.0 + 220.0 * pow(hash11(id * 1.37), 2.2);
        if (hash11(id * 7.1) > 0.93) h += 180.0;
        return h;
      }
      void main(){
        float u = atan(vW.z, vW.x) * ${R.toFixed(1)};
        float y = vW.y;
        float w = 38.0;
        float id = floor(u / w);
        float fu = fract(u / w);
        float h = heightAt(id);
        // second, offset row of buildings for depth
        float id2 = floor((u + 17.0) / 27.0);
        float h2 = heightAt(id2 + 500.0) * 0.7;
        float inA = step(y, h) * step(0.06, fu) * step(fu, 0.94);
        float inB = step(y, h2);
        if (inA + inB < 0.5) discard;
        vec2 cell = floor(vec2(u / 3.0, y / 4.0));
        float lit = step(0.72, hash21(cell + id));
        vec3 wc = mix(vec3(1.0, 0.7, 0.4), vec3(0.5, 0.8, 1.0), hash21(cell * 1.3));
        vec3 c = vec3(0.03, 0.02, 0.05) + wc * lit * 0.5 * inA;
        float crown = step(h - 2.0, y) * inA;
        c += vec3(1.0, 0.1, 0.4) * crown * step(0.6, hash11(id * 3.3));
        float haze = 0.55 + 0.35 * (1.0 - smoothstep(0.0, 400.0, y));
        gl_FragColor = vec4(mix(c, uFogColor, haze), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  return mesh;
}
