import * as THREE from 'three';
import { V3, clamp, damp, _a, _b, _c, _d, _e, _pv } from './util.js';
import { camera } from './core.js';
import { solidMeshes } from './world.js';
import { shakeAmt, decayShake } from './fx.js';
import { P } from './state.js';
import { dummies } from './dummies.js';
import { player } from './player.js';

// camera helpers
export let camYaw = 0, camPitch = -0.12, camDist = 5.4;
export const camPivot = new V3(0, 1.55, 14);
export let camH = 1.55, fov = 72;
export const camDir = out => { const cp = Math.cos(camPitch); return out.set(-Math.sin(camYaw) * cp, Math.sin(camPitch), -Math.cos(camYaw) * cp); };
export const camFwdH = out => out.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
export const camRight = out => out.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
export const facing = (out, yaw = P.yaw) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
export const camFacingYaw = () => Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
export let lockTarget = null, aimHit = null, aimRaw = null;
export const raycaster = new THREE.Raycaster();
// world point under the crosshair
export function aimPoint(out) {
  if (lockTarget) return lockTarget.chest(out);
  if (aimRaw) return out.copy(aimRaw);
  camDir(_pv);
  if (_pv.y < -0.02) { const t = -camera.position.y / _pv.y; if (t < 90) return out.copy(camera.position).addScaledVector(_pv, t); }
  return out.copy(camera.position).addScaledVector(_pv, 70);
}
export function handPos(out) { return player.handR.getWorldPosition(out); }

// ================= camera =================
export function updateCamera(rdt) {
  camH = damp(camH, P.state === 'slide' ? 1.0 : 1.55, 10, rdt);
  _a.set(P.pos.x, P.pos.y + camH, P.pos.z);
  camPivot.x = damp(camPivot.x, _a.x, 20, rdt); camPivot.z = damp(camPivot.z, _a.z, 20, rdt); camPivot.y = damp(camPivot.y, _a.y, 14, rdt);
  if (camPivot.distanceTo(_a) > 8) camPivot.copy(_a);
  camDir(_b); camRight(_c);
  _d.copy(camPivot).addScaledVector(_c, 0.6);
  let dist = camDist;
  raycaster.set(_d, _e.copy(_b).negate()); raycaster.far = dist;
  const h = raycaster.intersectObjects(solidMeshes, false)[0];
  if (h) dist = Math.max(0.6, h.distance - 0.3);
  camera.position.copy(_d).addScaledVector(_b, -dist);
  if (camera.position.y < 0.3) camera.position.y = 0.3;
  if (shakeAmt > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt; camera.position.y += (Math.random() - 0.5) * shakeAmt; camera.position.z += (Math.random() - 0.5) * shakeAmt;
    decayShake(rdt);
  }
  camera.lookAt(_e.copy(_d).addScaledVector(_b, 10));
  const spd = (P.state === 'dash' || P.state === 'dragonKick') ? 30 : Math.hypot(P.vel.x, P.vel.z);
  fov = damp(fov, 72 + clamp((spd - 9.5) * 0.7, 0, 16), 6, rdt);
  camera.fov = fov; camera.updateProjectionMatrix();

  // what the crosshair is pointing at
  raycaster.set(camera.position, _b); raycaster.far = 90;
  aimHit = null; aimRaw = null;
  for (const hit of raycaster.intersectObjects(solidMeshes, false)) {
    if (hit.distance < dist + 0.5) continue;
    aimRaw = hit.point.clone();
    if (aimRaw.distanceTo(P.pos) < 50) aimHit = aimRaw;
    break;
  }
  lockTarget = null; let bestA = 0.2;
  for (const d of dummies) {
    if (d.dead) continue;
    d.chest(_a); if (_a.distanceTo(P.pos) > 40) continue;
    _a.sub(camera.position); const len = _a.length();
    const ang = Math.acos(clamp(_a.dot(_b) / len, -1, 1));
    if (ang < bestA) { bestA = ang; lockTarget = d; }
  }
}

// setters for other modules (an imported `let` is read-only)
export function setCamYaw(v) { camYaw = v; }
export function setCamPitch(v) { camPitch = v; }
export function setCamDist(v) { camDist = v; }
