import { _a, _b, _c, _fx } from '../util.js';
import { solidMeshes } from '../world.js';
import { spawnArc, spawnRing } from '../fx.js';
import { P, CL, CLASSES } from '../state.js';
import { dummies, hitDummy } from '../dummies.js';
import { depenetrate, ropeMesh, hookMesh, setState, startAttack, teleTrail } from '../player.js';
import { camDir, camFwdH, facing, camFacingYaw, lockTarget, aimHit, raycaster, setCamYaw } from '../camera.js';
import { inDir, hasIn } from '../update.js';

// ---------- Blademaster ----------
export function bmGrapple() {
  if (P.state === 'grapple') return;
  if (lockTarget && lockTarget.pos.distanceTo(P.pos) < 45) { P.gTarget = lockTarget; lockTarget.chest(P.gPoint); }
  else if (aimHit) { P.gTarget = null; P.gPoint.copy(aimHit); }
  else return;
  P.atk.on = false; setState('grapple'); P.airJumps = P.airJumpsMax;
  ropeMesh.visible = hookMesh.visible = true;
  if (P.grounded) P.vel.y = Math.max(P.vel.y, 6);
}
export function bmBlink() {
  P.cd.q = CL.skills.q.cd;
  _a.copy(P.pos);
  if (lockTarget) {
    const d = lockTarget;
    _c.set(d.pos.x - Math.sin(d.yaw) * 1.4, d.pos.y, d.pos.z - Math.cos(d.yaw) * 1.4); // behind the target
    teleTrail(_a, _c);
    P.pos.copy(_c); depenetrate(); P.vel.set(0, 0, 0);
    P.yaw = P.yawT = Math.atan2(d.pos.x - P.pos.x, d.pos.z - P.pos.z);
    setCamYaw(P.yaw + Math.PI);
    setState('blinkStrike');
    startAttack(2); P.atk.hit.add(d);
    facing(_b);
    hitDummy(d, 34, _b.x * 4, _b.z * 4, 7.5, true, 0.1);
  } else {
    camDir(_b);
    raycaster.set(_c.copy(P.pos).setY(P.pos.y + 1), _b); raycaster.far = 14;
    const h = raycaster.intersectObjects(solidMeshes, false)[0];
    const dist = h ? Math.max(0, h.distance - 0.7) : 14;
    _c.copy(P.pos).addScaledVector(_b, dist);
    teleTrail(_a, _c, 5);
    P.pos.copy(_c); depenetrate();
    P.vel.copy(_b).multiplyScalar(10); P.vel.y = Math.max(P.vel.y, 2);
    setState('normal'); P.iframes = 0.2;
  }
  P.airJumps = P.airJumpsMax;
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 1), 0.3, 2, 0.25, CL.color);
}
export function bmCyclone() {
  P.cd.e = CL.skills.e.cd; P.atk.on = false;
  if (hasIn) P.skDir.copy(inDir); else camFwdH(P.skDir);
  setState('cyclone'); P.tick = 0; P.ghostT = 0;
  P.yaw = P.yawT = Math.atan2(P.skDir.x, P.skDir.z);
}
export function bmSlam() {
  P.cd.r = CL.skills.r.cd; P.atk.on = false;
  if (P.grounded) { setState('slamUp'); P.vel.y = 13; } else setState('slamDown');
}
export function bmRising() {
  P.cd.f = CL.skills.f.cd; P.atk.on = false;
  P.yaw = P.yawT = camFacingYaw(); facing(_a);
  setState('rising'); P.vel.y = 16; P.vel.x *= 0.4; P.vel.z *= 0.4; P.airJumps = P.airJumpsMax;
  spawnArc(2, _b.copy(P.pos).setY(P.pos.y + 1.1), P.yaw, 0xffd23f, 1.1);
  const fx = _a.x, fz = _a.z;
  for (const d of dummies) {
    if (d.dead) continue;
    const dx = d.pos.x - P.pos.x, dz = d.pos.z - P.pos.z, dist = Math.hypot(dx, dz), dy = d.pos.y - P.pos.y;
    if (dist < 3.4 && dy > -1.5 && dy < 2.2 && (dx * fx + dz * fz) > -0.3) hitDummy(d, 20, fx * 1.5, fz * 1.5, 17.5, true);
  }
}

CLASSES.blade = {
  id: 'blade', name: 'Blademaster', color: 0x00e5ff, weapon: 'sword', style: 'slash', run: 9.5, airJumps: 1,
  desc: 'Sword and grapple hook. The all-rounder.', quote: 'The sword is simple. That is why it is hard.', lmb: 'Slash',
  atk: [
    { dur: 0.26, a0: 0.05, a1: 0.15, dmg: 12, kb: 3, off: 1.1, rad: 2.4 },
    { dur: 0.26, a0: 0.05, a1: 0.15, dmg: 14, kb: 3, off: 1.1, rad: 2.4 },
    { dur: 0.38, a0: 0.10, a1: 0.22, dmg: 24, kb: 9, off: 1.1, rad: 2.4, heavy: true, lunge: 9 },
  ],
  skills: {
    m2: { n: 'Grapple', cd: 0.5, fn: bmGrapple },
    q: { n: 'Blink Strike', cd: 4, fn: bmBlink },
    e: { n: 'Cyclone', cd: 5, fn: bmCyclone },
    r: { n: 'Meteor Slam', cd: 6, fn: bmSlam },
    f: { n: 'Rising Slash', cd: 3, fn: bmRising },
  },
};
