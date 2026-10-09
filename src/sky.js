import * as THREE from 'three';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';
import { getNoiseTexture } from './textures.js';

// Sky dome: dusk turning to night, an orange afterglow on the western horizon,
// a dark drifting cloud deck and a few faint stars. Follows the camera so it never clips.
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
        float sd = max(0.0, dot(d, uSunDir));
        // how far round the horizon we are facing the set sun (1 = toward it)
        float az = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz)) * 0.5 + 0.5;
        float sunSide = pow(az, 2.5);
        // night gradient: dark haze at the horizon -> deep indigo -> near-black zenith
        vec3 low = vec3(0.022, 0.018, 0.038);
        vec3 zenith = vec3(0.003, 0.004, 0.011);
        vec3 c = mix(uFogColor, low, smoothstep(0.0, 0.15, h));
        c = mix(c, zenith, smoothstep(0.12, 0.7, h));
        // afterglow of the set sun: an orange band hugging the horizon,
        // strongest toward the west and fading round to the east
        float band = (1.0 - smoothstep(0.0, 0.22, h)) * (0.08 + 0.92 * sunSide);
        c += vec3(0.75, 0.26, 0.06) * band * band * 0.9;
        c += uSunColor * (pow(sd, 8.0) * 0.4 + pow(sd, 60.0) * 0.5) * (1.0 - smoothstep(0.0, 0.3, h));
        if (h > 0.0) {
          // faint stars through the thin smog, only high up
          vec2 sc = floor(d.xz / (h + 0.2) * 260.0);
          float star = step(0.998, hash21(sc)) * smoothstep(0.25, 0.6, h);
          c += vec3(0.55, 0.6, 0.75) * star * (0.4 + 0.6 * hash21(sc + 7.0));
          // dark cloud deck, under-lit orange only low toward the sunset
          vec2 uv = d.xz / (h + 0.1) * vec2(0.08, 0.2);
          float n1 = texture2D(uNoise, uv + vec2(uTime * 0.0015, 0.0)).r;
          float n2 = texture2D(uNoise, uv * 2.3 - vec2(uTime * 0.002, 0.0)).g;
          float cl = smoothstep(0.38, 0.75, n1 * 0.75 + n2 * 0.4) * smoothstep(0.0, 0.06, h);
          vec3 shadow = vec3(0.025, 0.022, 0.035);
          float glow = sunSide * (1.0 - smoothstep(0.02, 0.3, h));
          vec3 lit = vec3(0.8, 0.3, 0.1) * glow * (0.5 + pow(sd, 3.0));
          float rimK = smoothstep(0.35, 0.8, n2);
          vec3 cloudC = shadow + lit * rimK;
          c = mix(c, cloudC, cl * 0.8);
        } else {
          c = mix(uFogColor, uFogColor * 0.75, smoothstep(0.0, -0.2, h));
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
    // Read the position straight from matrixWorld. getWorldPosition() would call
    // updateWorldMatrix(), which on the parentless per-eye XR cameras rebuilds
    // their view matrix from the raw headset pose and drops the player rig.
    mesh.position.setFromMatrixPosition(camera.matrixWorld);
    mesh.updateMatrixWorld();
  };
  return mesh;
}

// Low-lying smog layer between the street canyons and the upper city.
export function buildSmog() {
  const geo = new THREE.PlaneGeometry(3200, 3200, 40, 40);
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
        float a = smoothstep(0.25, 0.8, n * 0.8 + n2 * 0.4) * 0.25;
        float dc = distance(cameraPosition, vW);
        a *= smoothstep(15.0, 120.0, dc);
        vec3 c = mix(vec3(0.13, 0.09, 0.11), vec3(0.09, 0.07, 0.1), n2);
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
        vec3 c = vec3(0.05, 0.035, 0.03) + wc * lit * 0.25 * inA;
        float crown = step(h - 2.0, y) * inA;
        c += vec3(0.6, 0.2, 0.1) * crown * step(0.6, hash11(id * 3.3));
        float haze = 0.45 + 0.3 * (1.0 - smoothstep(0.0, 400.0, y));
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
