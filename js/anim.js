// anim.js: the player's pose each frame. Picks a target pose (tp) from the current state, then blends the real pose towards it.
// Purely visual. Nothing here affects gameplay.

import { TAU, clamp, lerp, damp, easeOut, _a } from './util.js';
import { placeShadow } from './world.js';
import { POSE_KEYS, BASE, GUARD, applyPose } from './stickman.js';
import { setBeam } from './fx.js';
import { T, P, CL } from './state.js';
import { playerMat, bladeMat, player, playerShadow, cloneMat, cloneSm, FLIP_T, pose, tp, ropeMesh, hookMesh } from './player.js';
import { camPitch } from './camera.js';

// ================= player animation =================
export function animatePlayer(dt) {
  Object.assign(tp, BASE);
  const hs = Math.hypot(P.vel.x, P.vel.z);
  let xp = 0, xs = 0;
  const st = P.state, id = CL.id;
  // class idle stance
  if (id === 'ninja') Object.assign(tp, { shLX: -0.2, shLZ: 0.35, elL: -0.9, wristL: 0.4, shRX: -0.2, shRZ: -0.35, elR: -0.9, wrist: 0.4, spineX: 0.18, bodyY: 0.88, kneeL: 0.3, kneeR: 0.3, hipLX: -0.2, hipRX: -0.1 });
  else if (id === 'monk') Object.assign(tp, GUARD, { hipLX: -0.25, hipRX: 0.15, kneeL: 0.25, kneeR: 0.25 });
  let spearUp = id === 'lancer';

  const runCycle = (speed, amp) => {
    P.runPhase += speed * dt * 1.25;
    const s = Math.sin(P.runPhase), c = Math.cos(P.runPhase);
    tp.hipLX = -s * 0.9 * amp; tp.hipRX = s * 0.9 * amp;
    tp.kneeL = 0.2 + Math.max(0, -s) * 1.4 * amp; tp.kneeR = 0.2 + Math.max(0, s) * 1.4 * amp;
    tp.hipLZ = 0.05; tp.hipRZ = -0.05;
    tp.spineX = 0.15 + 0.2 * amp; tp.bodyY = 0.9 + Math.abs(c) * 0.07;
    return s;
  };

  if (st === 'slide') {
    Object.assign(tp, { bodyY: 0.45, bodyPitch: -0.65, spineX: 0.45, hipLX: -1.0, kneeL: 0.1, hipLZ: 0.1, hipRX: -0.1, kneeR: 1.9,
      shLX: 0.5, shLZ: 0.9, elL: 0, shRX: -0.5, shRZ: -0.4, elR: -0.4, wrist: 0.8 }); spearUp = false;
  } else if (st === 'dash') {
    Object.assign(tp, { bodyPitch: clamp(1.15 * (1 - P.dashDir.y * 1.3), 0.1, 1.6), spineX: 0.1, hipLX: 0.3, kneeL: 0.5, hipRX: 0.05, kneeR: 0.2,
      shLX: 1.3, shLZ: 0.25, elL: 0, shRX: 1.2, shRZ: -0.25, elR: 0, wrist: 1.5, wristL: 1.5 }); spearUp = false;
  } else if (st === 'grapple') {
    Object.assign(tp, { bodyPitch: 0.35, shLX: -2.5, shLZ: 0.1, elL: 0, shRX: 0.6, shRZ: -0.4, elR: -0.3, wrist: 1.2, hipLX: -0.6, kneeL: 1.0, hipRX: 0.3, kneeR: 0.5 });
  } else if (st === 'cyclone' || st === 'sweep') {
    Object.assign(tp, { bodyPitch: 0.25, shLX: 0, shLZ: 1.4, elL: 0, shRX: 0, shRZ: -1.4, elR: 0, wrist: 1.5, hipLX: -0.5, kneeL: 1.1, hipRX: 0.2, kneeR: 0.7 });
    xs = P.spin; spearUp = false;
  } else if (st === 'slamUp') {
    Object.assign(tp, { hipLX: -1.5, kneeL: 2.0, hipRX: -1.5, kneeR: 2.0, shLX: -2.9, elL: 0, shRX: -2.9, shRZ: 0, elR: 0, wrist: 1.4, spineX: -0.2 });
    xp = -(P.st / 0.24) * TAU;
  } else if (st === 'slamDown') {
    Object.assign(tp, { bodyPitch: 0.35, hipLX: -0.3, kneeL: 0.3, hipRX: 0.3, kneeR: 0.3, shLX: -2.6, shLZ: 0.2, elL: 0, shRX: -2.6, shRZ: 0, elR: 0, wrist: 1.4, spineX: 0.3 });
  } else if (st === 'rising') {
    Object.assign(tp, { shRX: -2.9, shRZ: -0.2, elR: 0, wrist: 1.45, spineX: -0.3, hipLX: -1.1, kneeL: 1.5, hipRX: 0.3, kneeR: 0.3, shLZ: 0.9, shLX: 0.3 });
    xs = clamp(P.st / 0.3, 0, 1) * TAU;
  } else if (st === 'wallrun') {
    const s = Math.sin(P.runPhase);
    tp.hipLX = -s * 0.9; tp.hipRX = s * 0.9; tp.kneeL = 0.2 + Math.max(0, -s) * 1.4; tp.kneeR = 0.2 + Math.max(0, s) * 1.4;
    tp.shLX = s * 0.8; tp.shRX = -s * 0.8;
    if (camPitch > 0.5) tp.bodyPitch = -0.5;
    else { const rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw); tp.bodyRoll = -(P.wallN.x * rx + P.wallN.z * rz) * 0.55; tp.spineX = 0.3; }
  } else if (st === 'dragonKick') {
    Object.assign(tp, { bodyPitch: -0.9, hipRX: -1.65, kneeR: 0, hipLX: 0.2, kneeL: 1.7, shLX: 0.6, shLZ: 0.6, elL: -0.4, shRX: 0.6, shRZ: -0.6, elR: -0.4, spineX: 0.3 });
  } else if (st === 'charge') {
    Object.assign(tp, { bodyY: 0.78, kneeL: 0.6, kneeR: 0.6, hipLX: -0.5, hipRX: 0.1, spineY: -0.6, shRX: 0.5, shRZ: -0.2, elR: -1.5, shLX: -1.3, shLZ: 0.1, elL: -0.3 });
  } else if (st === 'palm') {
    Object.assign(tp, { bodyY: 0.82, kneeL: 0.5, kneeR: 0.3, hipLX: -0.7, hipRX: 0.4, spineY: 0.6, spineX: 0.25, shRX: -1.55, shRZ: 0, elR: 0, shLX: 0.5, elL: -1.2 });
  } else if (st === 'kicks') {
    const s = Math.sin(P.st * 60);
    Object.assign(tp, { bodyPitch: -0.3, hipRX: -1.45 + s * 0.35, kneeR: 0.15 + (s < 0 ? 0.9 : 0), hipLX: -0.9 - s * 0.5, kneeL: 0.9 + (s > 0 ? 0.6 : 0) });
  } else if (st === 'vault') {
    Object.assign(tp, { hipLX: -1.3, kneeL: 1.6, hipRX: -1.1, kneeR: 1.6, shLX: -0.4, shRX: 0.3, elR: -0.2, wrist: 2.4, spineX: 0.2 }); spearUp = false;
  } else if (st === 'pcharge') {
    runCycle(26, 1.1);
    Object.assign(tp, { bodyPitch: 0.45, shRX: -1.2, shRZ: -0.1, elR: -0.2, wrist: 1.4, shLX: -1.2, shLZ: -0.2, elL: -0.5 }); spearUp = false;
  } else if (st === 'dragoonUp') {
    Object.assign(tp, { hipLX: -1.4, kneeL: 1.9, hipRX: -1.2, kneeR: 1.9, shLX: -2.7, elL: -0.2, shRX: -2.7, shRZ: 0, elR: -0.2, wrist: 2.9 + 1.57, spineX: -0.15 }); spearUp = false;
  } else if (st === 'dragoonDown') {
    Object.assign(tp, { bodyPitch: 0.7, hipLX: 0.2, kneeL: 0.2, hipRX: 0.4, kneeR: 0.5, shLX: -1.3, elL: -0.3, shRX: -1.3, shRZ: 0, elR: -0.3, wrist: 1.6 + 1.2, spineX: 0.2 }); spearUp = false;
  } else if (!P.grounded) {
    if (P.vel.y > 0) Object.assign(tp, { hipLX: -0.9, kneeL: 1.3, hipRX: 0.3, kneeR: 0.6, shLZ: 0.7, shRZ: -0.5, shRX: -0.6 });
    else Object.assign(tp, { hipLX: -0.4, kneeL: 0.6, hipRX: 0.25, kneeR: 0.5, shLZ: 1.1, shLX: -0.2, shRZ: -0.9, shRX: -0.3 });
    if (P.flip > 0) {
      Object.assign(tp, { hipLX: -1.6, kneeL: 2.1, hipRX: -1.5, kneeR: 2.1, shLX: -0.8, shRX: -0.8 });
      xp = easeOut(1 - P.flip / FLIP_T) * TAU;
    }
  } else if (hs > 0.6) {
    const amp = clamp(hs / 9.5, 0.3, 1.2), s = runCycle(hs, amp);
    if (hs > 12.5 || id === 'ninja') { tp.shLX = 1.3; tp.shLZ = 0.2; tp.elL = 0; tp.shRX = 1.15; tp.shRZ = -0.2; tp.elR = -0.1; tp.wrist = 1.4; tp.wristL = 1.4; tp.spineX = 0.5; spearUp = false; }
    else if (id !== 'monk') { tp.shLX = s * 0.8 * amp; tp.elL = -0.6; tp.shRX = -0.35 - s * 0.5 * amp; }
  } else {
    tp.bodyY += Math.sin(T * 2.5) * 0.01;
  }
  if (P.blocking) { Object.assign(tp, { shLX: -1.5, shLZ: -0.35, elL: -1.5, shRX: -1.5, shRZ: 0.35, elR: -1.5, spineX: 0.2, bodyY: 0.86, kneeL: 0.4, kneeR: 0.4 }); }

  // attack overlay
  const a = P.atk;
  if (a.on) {
    const A = CL.atk[a.combo], e = easeOut(clamp(a.t / (A.a1 + 0.03), 0, 1)), last = a.combo === CL.atk.length - 1;
    spearUp = false;
    switch (CL.style) {
      case 'slash':
        tp.elR = -0.1; tp.wrist = 1.45; tp.shLX = -0.3; tp.shLZ = 0.7; tp.elL = -0.4;
        if (a.combo === 0) { tp.spineY = lerp(-1.2, 1.2, e); tp.shRX = -1.45; tp.shRZ = -0.15; tp.spineX = 0.15; }
        else if (a.combo === 1) { tp.spineY = lerp(1.2, -1.2, e); tp.shRX = -1.35; tp.shRZ = -0.55; tp.spineX = 0.15; }
        else { tp.shRX = lerp(-3.0, -0.4, e); tp.shRZ = -0.1; tp.spineX = lerp(-0.35, 0.65, e); tp.spineY = 0.2; }
        break;
      case 'dagger':
        if (last) { tp.shRX = tp.shLX = lerp(-2.9, -0.5, e); tp.elR = tp.elL = -0.1; tp.wrist = tp.wristL = 1.45; tp.spineX = lerp(-0.3, 0.6, e); tp.shLZ = 0.1; tp.shRZ = -0.1; }
        else if (a.combo % 2 === 0) { tp.spineY = lerp(-0.9, 0.9, e); tp.shRX = -1.4; tp.shRZ = -0.2; tp.elR = -0.1; tp.wrist = 1.45; tp.shLX = -0.5; tp.elL = -1.2; }
        else { tp.spineY = lerp(0.9, -0.9, e); tp.shLX = -1.4; tp.shLZ = 0.2; tp.elL = -0.1; tp.wristL = 1.45; tp.shRX = -0.5; tp.elR = -1.2; }
        break;
      case 'punch':
        Object.assign(tp, GUARD);
        if (last) { tp.hipRX = lerp(0.2, -1.7, e); tp.kneeR = lerp(1.6, 0, e); tp.spineX = -0.25; tp.bodyPitch = -0.15; }
        else if (a.combo % 2 === 0) { tp.shRX = lerp(-0.7, -1.6, e); tp.elR = lerp(-2.0, 0, e); tp.spineY = lerp(-0.2, 0.55, e); }
        else { tp.shLX = lerp(-0.9, -1.6, e); tp.elL = lerp(-2.0, 0, e); tp.spineY = lerp(0.2, -0.55, e); }
        break;
      case 'thrust':
        tp.shRX = lerp(-0.9, -1.5, e); tp.shRZ = -0.1; tp.elR = lerp(-1.4, 0, e); tp.wrist = -(tp.shRX + tp.elR);
        tp.shLX = -1.2; tp.shLZ = -0.1; tp.elL = -0.6; tp.spineX = lerp(0, 0.35, e); if (last) tp.spineY = lerp(-0.6, 0.3, e);
        break;
    }
  }
  if (spearUp) tp.wrist = -1.57 - (tp.shRX + tp.elR);   // lancer carries the spear upright

  const rate = (a.on || st !== 'normal') ? 28 : 13;
  for (const k of POSE_KEYS) pose[k] = damp(pose[k], tp[k], rate, dt);
  player.root.position.copy(P.pos);
  player.root.rotation.y = P.yaw;
  applyPose(player, pose, xp, xs);
  player.root.updateMatrixWorld(true);
  placeShadow(playerShadow, P.pos.x, P.pos.y, P.pos.z);

  const op = P.smokeT > 0 ? 0.22 : (P.iframes > 0 && Math.sin(T * 60) > 0 ? 0.5 : 1);
  playerMat.opacity = op; bladeMat.opacity = op;

  if (P.clone) { cloneSm.root.position.copy(P.clone.pos); cloneMat.opacity = 0.45 + Math.sin(T * 8) * 0.2; }
  if (P.state === 'grapple') {
    player.handL.getWorldPosition(_a);
    setBeam(ropeMesh, _a, P.gPoint); hookMesh.position.copy(P.gPoint);
  }
}
