import * as THREE from 'three';
import { GLSL_COMMON, makeShaderMaterial } from './shared.js';

// GPU rain: streaks tiled in a box that wraps around the viewer. Drops inside
// any registered "shelter" box (rooms, train cars, canopies) are hidden, so it
// never rains indoors.
const MAX_SHELTERS = 16;

export class Rain {
  constructor(count = 7000) {
    this.shelters = []; // { object: Object3D, half: Vector3, center: Vector3 }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) off.set([Math.random(), Math.random(), Math.random(), 0.7 + Math.random() * 0.6], i * 4);
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    geo.instanceCount = count;
    this.inv = [];
    this.half = [];
    for (let i = 0; i < MAX_SHELTERS; i++) {
      this.inv.push(new THREE.Matrix4());
      this.half.push(new THREE.Vector3());
    }
    this.material = makeShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector3() },
        uInv: { value: this.inv },
        uHalf: { value: this.half },
        uCount: { value: 0 },
      },
      vertexShader: /* glsl */ `
        ${GLSL_COMMON}
        uniform vec3 uCenter;
        uniform mat4 uInv[${MAX_SHELTERS}];
        uniform vec3 uHalf[${MAX_SHELTERS}];
        uniform int uCount;
        attribute vec4 aOff;
        varying float vA; varying float vY;
        const vec3 BOX = vec3(70.0, 46.0, 70.0);
        void main(){
          vec3 p = aOff.xyz * BOX;
          p.y -= uTime * 22.0 * aOff.w;
          p.x += uTime * 2.5 * aOff.w;
          vec3 w = uCenter + mod(p - uCenter, BOX) - BOX * 0.5;
          bool hidden = false;
          for (int i = 0; i < ${MAX_SHELTERS}; i++) {
            if (i >= uCount) break;
            vec3 l = (uInv[i] * vec4(w, 1.0)).xyz;
            if (all(lessThan(abs(l), uHalf[i]))) hidden = true;
          }
          vec3 toCam = cameraPosition - w;
          float dist = length(toCam);
          vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)) * 0.012 * (1.0 + dist * 0.02);
          vec3 fall = normalize(vec3(-0.11, 1.0, 0.0)) * 0.9 * aOff.w;
          vec3 v = w + side * position.x + fall * position.y;
          vA = hidden ? 0.0 : smoothstep(1.2, 4.0, dist) * (1.0 - smoothstep(20.0, 35.0, dist));
          vY = position.y;
          gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(v, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vY;
        void main(){
          gl_FragColor = vec4(vec3(0.7, 0.6, 0.5) * vA * 0.13 * vY, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  // object's local space box centred at `center` with half extents `half`
  addShelter(object, center, half) {
    this.shelters.push({ object, center: center.clone(), half: half.clone() });
  }

  update(cameraWorldPos) {
    this.material.uniforms.uCenter.value.copy(cameraWorldPos);
    // pick nearest shelters
    const list = this.shelters
      .map((s) => {
        const wp = s.object.localToWorld(s.center.clone());
        return { s, d: wp.distanceToSquared(cameraWorldPos) };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_SHELTERS);
    const m = new THREE.Matrix4();
    list.forEach(({ s }, i) => {
      m.copy(s.object.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(s.center.x, s.center.y, s.center.z));
      this.inv[i].copy(m).invert();
      this.half[i].copy(s.half);
    });
    this.material.uniforms.uCount.value = list.length;
  }
}
