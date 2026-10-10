// stickman.js: builds a stick figure and poses it. Used for the player, dummies, Master Sen, afterimages and the ninja clone.
// A pose is a plain object of joint angles in radians (see POSE_KEYS). Animating = blending the current pose towards a target pose.

import * as THREE from 'three';

// ================= stickman =================
// Shared shapes. Every stickman reuses these, so forty stickmen do not mean forty copies.
export const SG = {
  limb: new THREE.CylinderGeometry(0.05, 0.05, 1, 6).translate(0, -0.5, 0),
  joint: new THREE.SphereGeometry(0.06, 8, 6),
  head: new THREE.SphereGeometry(0.17, 14, 10),
  blade: new THREE.BoxGeometry(0.04, 0.1, 1.05).translate(0, 0, 0.62),
  guard: new THREE.BoxGeometry(0.26, 0.05, 0.05),
  dagger: new THREE.BoxGeometry(0.035, 0.08, 0.5).translate(0, 0, 0.3),
  shaft: new THREE.BoxGeometry(0.05, 0.05, 2.6).translate(0, 0, 0.4),
  spearHead: new THREE.BoxGeometry(0.04, 0.14, 0.36).translate(0, 0, 1.86),
  kunai: new THREE.BoxGeometry(0.05, 0.05, 0.45),
};

// Build one stickman. mat = body material, accentMat = blade material, weapons = true to attach all three weapons
// (only one shows at a time, see setWeapon). Returns the joints so they can be turned:
// body > spine > chest > head; shoulders (shL, shR) > elbows (elL, elR) > hands; hips > knees.
export function makeStickman(mat, accentMat, weapons) {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.95; body.rotation.order = 'YXZ'; root.add(body);
  const spine = new THREE.Group(); spine.rotation.order = 'YXZ'; body.add(spine);
  const torso = new THREE.Mesh(SG.limb, mat); torso.scale.y = 0.58; torso.rotation.x = Math.PI; spine.add(torso);
  const chest = new THREE.Group(); chest.position.y = 0.58; spine.add(chest);
  const neck = new THREE.Mesh(SG.limb, mat); neck.scale.y = 0.15; neck.rotation.x = Math.PI; chest.add(neck);
  const head = new THREE.Mesh(SG.head, mat); head.position.y = 0.3; chest.add(head);
  const mk = (parent, x, y, l1, l2) => {
    const a = new THREE.Group(); a.position.set(x, y, 0); parent.add(a);
    const u = new THREE.Mesh(SG.limb, mat); u.scale.y = l1; a.add(u);
    const j = new THREE.Mesh(SG.joint, mat); j.position.y = -l1; a.add(j);
    const b = new THREE.Group(); b.position.y = -l1; a.add(b);
    const l = new THREE.Mesh(SG.limb, mat); l.scale.y = l2; b.add(l);
    const end = new THREE.Group(); end.position.y = -l2; b.add(end);
    return [a, b, end];
  };
  const [shL, elL, handL] = mk(chest, 0.04, -0.02, 0.34, 0.32);
  const [shR, elR, handR] = mk(chest, -0.04, -0.02, 0.34, 0.32);
  const [hipL, kneeL] = mk(body, 0.09, 0, 0.47, 0.47);
  const [hipR, kneeR] = mk(body, -0.09, 0, 0.47, 0.47);
  let wrist = null, wristL = null, W = null;
  if (weapons) {
    wrist = new THREE.Group(); handR.add(wrist);
    wristL = new THREE.Group(); handL.add(wristL);
    const sword = new THREE.Group(); sword.add(new THREE.Mesh(SG.blade, accentMat));
    const guard = new THREE.Mesh(SG.guard, mat); guard.position.z = 0.08; sword.add(guard); wrist.add(sword);
    const dagR = new THREE.Mesh(SG.dagger, accentMat); wrist.add(dagR);
    const dagL = new THREE.Mesh(SG.dagger, accentMat); wristL.add(dagL);
    const spear = new THREE.Group(); spear.add(new THREE.Mesh(SG.shaft, mat)); spear.add(new THREE.Mesh(SG.spearHead, accentMat)); wrist.add(spear);
    W = { sword, dagR, dagL, spear };
  }
  const nodes = []; root.traverse(o => nodes.push(o));
  return { root, body, spine, chest, head, shL, elL, handL, shR, elR, handR, wrist, wristL, W, hipL, kneeL, hipR, kneeR, nodes };
}
// Show one weapon and hide the rest. w = 'sword' | 'daggers' | 'spear' | 'none'.
export function setWeapon(sm, w) {
  if (!sm.W) return;
  sm.W.sword.visible = w === 'sword'; sm.W.dagR.visible = sm.W.dagL.visible = w === 'daggers'; sm.W.spear.visible = w === 'spear';
}

// Every number in a pose. X / Y / Z = the axis the joint turns around; L / R = left / right.
// Roughly: X swings forward and back, Z swings out to the side, Y twists. bodyY is the hip height, not an angle.
export const POSE_KEYS = ['bodyY', 'bodyPitch', 'bodyRoll', 'spineX', 'spineY', 'spineZ', 'hipLX', 'hipLZ', 'kneeL', 'hipRX', 'hipRZ', 'kneeR', 'shLX', 'shLZ', 'elL', 'shRX', 'shRY', 'shRZ', 'elR', 'wrist', 'wristL'];
// BASE = relaxed standing pose. Every other pose starts from it and overrides a few joints.
export const BASE = { bodyY: 0.93, bodyPitch: 0, bodyRoll: 0, spineX: 0.08, spineY: 0, spineZ: 0, hipLX: -0.05, hipLZ: 0.12, kneeL: 0.12, hipRX: 0.05, hipRZ: -0.12, kneeR: 0.12,
  shLX: 0.1, shLZ: 0.28, elL: -0.3, shRX: -0.35, shRY: 0, shRZ: -0.25, elR: -0.7, wrist: 0.5, wristL: 0.5 };
// Arms straight out, for practice dummies.
export const DUMMY_POSE = { ...BASE, bodyY: 0.94, spineX: 0, hipLX: 0, hipRX: 0, hipLZ: 0.07, hipRZ: -0.07, kneeL: 0, kneeR: 0, shLX: 0, shLZ: 1.35, elL: 0, shRX: 0, shRZ: -1.35, elR: 0 };
// GUARD = fists up (monk, fighter). F_* = fighter dummy poses: idle, slam wind-up, lunge wind-up, lunge, stunned.
export const GUARD = { shLX: -0.9, shLZ: 0.25, elL: -2.0, shRX: -0.7, shRZ: -0.25, elR: -2.0, spineX: 0.12 };
export const F_IDLE = { ...BASE, ...GUARD, hipLX: -0.25, hipRX: 0.15, kneeL: 0.25, kneeR: 0.25 };
export const F_SLAM = { ...BASE, shLX: -2.9, shLZ: 0.1, elL: -0.1, shRX: -2.9, shRZ: -0.1, elR: -0.1, spineX: -0.25, kneeL: 0.5, kneeR: 0.5, bodyY: 0.85 };
export const F_LWIND = { ...BASE, bodyPitch: 0.3, shLX: 0.8, shRX: 0.8, elL: -1, elR: -1, kneeL: 0.9, kneeR: 0.9, bodyY: 0.75, hipLX: -0.7, hipRX: -0.7 };
export const F_LUNGE = { ...BASE, bodyPitch: 0.9, shLX: -2.0, shRX: -2.0, elL: 0, elR: 0, hipLX: 0.3, hipRX: 0.1 };
export const F_STUN = { ...BASE, spineX: 0.6, shLX: 0.2, shRX: 0.2, elL: -0.2, elR: -0.2, kneeL: 0.4, kneeR: 0.4, bodyY: 0.85 };

// Copy a pose onto a stickman. xp = extra forward flip, xs = extra spin (somersaults and spin attacks).
export function applyPose(sm, p, xp = 0, xs = 0) {
  sm.body.position.y = p.bodyY;
  sm.body.rotation.set(p.bodyPitch + xp, xs, p.bodyRoll);
  sm.spine.rotation.set(p.spineX, p.spineY, p.spineZ);
  sm.hipL.rotation.set(p.hipLX, 0, p.hipLZ); sm.kneeL.rotation.x = p.kneeL;
  sm.hipR.rotation.set(p.hipRX, 0, p.hipRZ); sm.kneeR.rotation.x = p.kneeR;
  sm.shL.rotation.set(p.shLX, 0, p.shLZ); sm.elL.rotation.x = p.elL;
  sm.shR.rotation.set(p.shRX, p.shRY, p.shRZ); sm.elR.rotation.x = p.elR;
  if (sm.wrist) { sm.wrist.rotation.x = p.wrist; sm.wristL.rotation.x = p.wristL; }
}
// Make dst look exactly like src right now (afterimages, the ninja clone).
export function copyPose(src, dst) {
  const n = src.nodes, d = dst.nodes;
  for (let i = 0; i < n.length; i++) { d[i].position.copy(n[i].position); d[i].quaternion.copy(n[i].quaternion); d[i].scale.copy(n[i].scale); d[i].visible = n[i].visible; }
}

// Rim light: brighten the parts of a character that face sideways to the camera, so its outline stays visible against
// a dark scene. Done by adding a few lines to the material's own shader, so it costs no extra objects or draw calls.
// mat must be a MeshLambertMaterial. The brighter the colour, the stronger the rim.
const RIM_COLOR = new THREE.Color(0xc4d2ff).multiplyScalar(0.4);
export function addRim(mat) {
  mat.onBeforeCompile = shader => {
    shader.uniforms.rimColor = { value: RIM_COLOR };
    // vertex shader: pass on the direction from this point to the camera
    shader.vertexShader = 'varying vec3 vRimView;\n' + shader.vertexShader
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvRimView = -mvPosition.xyz;');
    // pixel shader: the more a surface is turned away from the camera, the more rim colour it gets
    shader.fragmentShader = 'varying vec3 vRimView;\nuniform vec3 rimColor;\n' + shader.fragmentShader
      .replace('#include <opaque_fragment>',
        'float rimAmount = pow(1.0 - clamp(dot(normalize(normal), normalize(vRimView)), 0.0, 1.0), 2.0);\n'
        + '\toutgoingLight += rimColor * rimAmount;\n\t#include <opaque_fragment>');
  };
  // Tells three.js that materials with a rim share one compiled shader, separate from plain ones.
  mat.customProgramCacheKey = () => 'rim';
  return mat;
}
// Let every part of a stickman cast a real shadow. Only matters on High quality.
export function castShadows(sm) {
  sm.root.traverse(o => {
    if (o.isMesh) o.castShadow = true;
  });
}
