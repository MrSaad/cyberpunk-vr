import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// VRChat-style locomotion: left stick = smooth move relative to where you look,
// right stick = smooth turn around your head. Desktop fallback: WASD + mouse.
const WALK_SPEED = 2.6;
const SPRINT_MULT = 2.0;
const TURN_SPEED = THREE.MathUtils.degToRad(140);
const DEADZONE = 0.15;
const EYE_HEIGHT = 1.65;

const _head = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _target = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

function axis(v) {
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  const t = (a - DEADZONE) / (1 - DEADZONE);
  return Math.sign(v) * t * t * (3 - 2 * t) * 0.35 + Math.sign(v) * t * 0.65;
}

export class Player {
  constructor(renderer, camera, nav, scene) {
    this.renderer = renderer;
    this.camera = camera;
    this.nav = nav;
    this.scene = scene;
    this.rig = new THREE.Group();
    this.rig.name = 'playerRig';
    this.rig.add(camera);
    camera.position.set(0, EYE_HEIGHT, 0);
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.sprint = false;
    this.snapTurn = false;
    this.snapReady = true;
    this.prevButtons = {};
    this.pointerLocked = false;
    this.onTeleportKey = null;

    // controllers (visible models)
    const factory = new XRControllerModelFactory();
    for (let i = 0; i < 2; i++) {
      const grip = renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      this.rig.add(grip);
    }

    renderer.xr.addEventListener('sessionstart', () => {
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
    });
    renderer.xr.addEventListener('sessionend', () => {
      camera.position.set(0, EYE_HEIGHT, 0);
      camera.rotation.set(this.pitch, 0, 0);
    });

    const dom = renderer.domElement;
    dom.addEventListener('click', () => {
      if (!renderer.xr.isPresenting) dom.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.turnPending = (this.turnPending || 0) - e.movementX * 0.0022;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - e.movementY * 0.0022));
    });
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (/^Digit[1-6]$/.test(e.code) && this.onTeleportKey) this.onTeleportKey(parseInt(e.code.slice(5), 10) - 1);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  // Place the player standing at a local point of `object`, facing local yaw.
  spawn(object, local, yaw) {
    object.add(this.rig);
    this.rig.position.copy(local);
    this.rig.rotation.set(0, yaw, 0);
    this.rig.updateMatrixWorld(true);
    this.currentObject = object;
  }

  readInput() {
    let mx = 0, my = 0, turn = 0;
    const session = this.renderer.xr.getSession();
    if (session && this.renderer.xr.isPresenting) {
      for (const src of session.inputSources) {
        const gp = src.gamepad;
        if (!gp) continue;
        const ax = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0], gp.axes[1]];
        const prev = this.prevButtons[src.handedness] || [];
        const pressed = (i) => gp.buttons[i] && gp.buttons[i].pressed && !prev[i];
        if (src.handedness === 'left') {
          mx += axis(ax[0]);
          my += axis(ax[1]);
          if (pressed(3)) this.sprint = !this.sprint;
        } else if (src.handedness === 'right') {
          turn += axis(ax[0]);
          if (pressed(5)) this.snapTurn = !this.snapTurn;
        }
        this.prevButtons[src.handedness] = gp.buttons.map((b) => b.pressed);
      }
      if (Math.hypot(mx, my) < 0.05) this.sprint = false;
    } else {
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
      if (k.has('KeyA')) mx -= 1;
      if (k.has('KeyD')) mx += 1;
      if (k.has('ArrowLeft') || k.has('KeyQ')) turn -= 1;
      if (k.has('ArrowRight') || k.has('KeyE')) turn += 1;
      this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    return { mx, my, turn };
  }

  update(dt) {
    const { mx, my, turn } = this.readInput();
    const cam = this.camera;
    const xr = this.renderer.xr.isPresenting;
    if (!xr) cam.rotation.set(this.pitch, 0, 0);

    // --- turning (around the head so you don't swing around the room) ---
    let dYaw = 0;
    if (this.snapTurn && xr) {
      if (Math.abs(turn) > 0.6 && this.snapReady) {
        dYaw = -Math.sign(turn) * THREE.MathUtils.degToRad(30);
        this.snapReady = false;
      } else if (Math.abs(turn) < 0.3) this.snapReady = true;
    } else {
      dYaw = -turn * TURN_SPEED * dt;
    }
    if (this.turnPending) { dYaw += this.turnPending; this.turnPending = 0; }
    if (dYaw !== 0) {
      cam.getWorldPosition(_head);
      const parent = this.rig.parent;
      const headLocal = parent.worldToLocal(_head.clone());
      _q.setFromAxisAngle(_up, dYaw);
      this.rig.position.sub(headLocal).applyQuaternion(_q).add(headLocal);
      this.rig.rotation.y += dYaw;
    }
    this.rig.updateMatrixWorld(true);

    // --- movement on the floor plane of whatever we stand on (station or train) ---
    const parent = this.rig.parent;
    cam.getWorldPosition(_head);
    cam.getWorldDirection(_fwd);
    parent.getWorldQuaternion(_q).invert();
    _fwd.applyQuaternion(_q);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.crossVectors(_fwd, _up).normalize();
    const speed = WALK_SPEED * (this.sprint ? SPRINT_MULT : 1);
    const headLocal = parent.worldToLocal(_tmp.copy(_head));
    _target.copy(headLocal)
      .addScaledVector(_fwd, -my * speed * dt)
      .addScaledVector(_right, mx * speed * dt);
    _target.y = this.rig.position.y; // compare at feet height
    parent.localToWorld(_target);

    const res = this.nav.resolve(_target, this.rig.parent);
    if (!res) return;
    const obj = res.rect.object;
    if (obj !== this.rig.parent) {
      obj.attach(this.rig);
      // keep the rig upright relative to its new parent
      const e = new THREE.Euler().setFromQuaternion(this.rig.quaternion, 'YXZ');
      this.rig.rotation.set(0, e.y, 0);
      this.rig.updateMatrixWorld(true);
      this.currentObject = obj;
    }
    cam.getWorldPosition(_head);
    const hl = obj.worldToLocal(_head.clone());
    this.rig.position.x += res.local.x - hl.x;
    this.rig.position.z += res.local.z - hl.z;
    // ease vertical changes a touch (stairs), snap if far
    const dy = res.local.y - this.rig.position.y;
    this.rig.position.y += Math.abs(dy) > 0.6 ? dy : dy * Math.min(1, dt * 14);
    this.rig.updateMatrixWorld(true);
  }

  worldPosition(target = new THREE.Vector3()) {
    return this.camera.getWorldPosition(target);
  }
}
