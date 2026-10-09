import { _a, _b, _c, _d, _fx } from '../util.js';
import { copyPose } from '../stickman.js';
import { spawnArc, spawnRing, burst, spawnBeam, shake } from '../fx.js';
import { P, CL, CLASSES } from '../state.js';
import { hitDummy, hitArea } from '../dummies.js';
import { fireProj, killProj } from '../projectiles.js';
import { player, cloneSm, depenetrate, setState, teleTrail } from '../player.js';
import { facing, camFacingYaw, lockTarget, aimPoint, handPos, setCamYaw } from '../camera.js';

// ---------- Shadow Ninja ----------
export function removeClone() { P.clone = null; cloneSm.root.visible = false; }
export function njClone() {
  if (P.clone) {
    _a.copy(P.pos);
    burst(_fx.copy(P.pos).setY(P.pos.y + 1), 14, 6, 1);
    teleTrail(_a, P.clone.pos, 4);
    P.pos.copy(P.clone.pos); depenetrate(); P.vel.set(0, 3, 0);
    removeClone(); P.cd.q = CL.skills.q.cd; P.iframes = 0.35; P.airJumps = P.airJumpsMax;
    P.atk.on = false; setState('normal');
    spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.9), 0.3, 3.4, 0.3, CL.color);
    burst(_fx, 14, 7, 1); shake(0.2);
    hitArea(P.pos.x, P.pos.y, P.pos.z, 3.4, 22, 5, 5, true, 0.06, false);
  } else {
    copyPose(player, cloneSm); cloneSm.root.visible = true;
    P.clone = { pos: P.pos.clone(), life: 7 };
    burst(_fx.copy(P.pos).setY(P.pos.y + 1), 10, 5, 1);
    spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.2, 1.6, 0.3, CL.color);
  }
}
export function njMark() {
  if (P.mark) {
    const m = P.mark; _a.copy(P.pos);
    if (m.stuck && m.stuck !== 'solid') {
      const d = m.stuck;
      _c.set(d.pos.x - Math.sin(d.yaw) * 1.3, d.pos.y, d.pos.z - Math.cos(d.yaw) * 1.3);
      teleTrail(_a, _c); P.pos.copy(_c); depenetrate();
      P.yaw = P.yawT = Math.atan2(d.pos.x - P.pos.x, d.pos.z - P.pos.z); setCamYaw(P.yaw + Math.PI);
      facing(_b); hitDummy(d, 26, _b.x * 4, _b.z * 4, 6, true, 0.1);
      spawnArc(2, _d.copy(P.pos).setY(P.pos.y + 1.1), P.yaw, CL.color, 0.8);
    } else {
      _c.copy(m.pos).addScaledVector(m.dir, -0.6); _c.y = Math.max(0, _c.y - 0.9);
      teleTrail(_a, _c); P.pos.copy(_c); depenetrate();
    }
    killProj(m); P.mark = null; P.cd.e = CL.skills.e.cd;
    P.vel.set(0, 3, 0); P.airJumps = P.airJumpsMax; P.iframes = 0.25; P.atk.on = false; setState('normal');
    spawnRing(_fx.copy(P.pos).setY(P.pos.y + 1), 0.3, 2, 0.25, CL.color);
  } else {
    handPos(_a); aimPoint(_b).sub(_a).normalize();
    P.yaw = P.yawT = camFacingYaw();
    P.mark = fireProj('kunai', _a, _b, 50, 5, { life: 4.5, dmg: 10, stick: true, onExpire: () => { P.mark = null; P.cd.e = CL.skills.e.cd; } });
  }
}
export function throwKunai() {
  handPos(_a); aimPoint(_b).sub(_a).normalize();
  _b.x += (Math.random() - 0.5) * 0.04; _b.y += (Math.random() - 0.5) * 0.04; _b.z += (Math.random() - 0.5) * 0.04; _b.normalize();
  fireProj('kunai', _a, _b, 56, 3, { life: 1.4, dmg: 5, stick: false });
  P.yawT = camFacingYaw();
}
export function njSmoke() {
  P.cd.r = CL.skills.r.cd; P.smokeT = 3.5; P.dmgMult = 3;
  burst(_fx.copy(P.pos).setY(P.pos.y + 1), 24, 7, 1);
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.3, 3, 0.4, 0x8b95a1);
}
export function njChain() {
  const d = lockTarget; if (!d || d.pos.distanceTo(P.pos) > 30) return;
  P.cd.f = CL.skills.f.cd;
  const dx = P.pos.x - d.pos.x, dz = P.pos.z - d.pos.z, dy = P.pos.y - d.pos.y, dist = Math.hypot(dx, dz) || 1;
  handPos(_a); d.chest(_b); spawnBeam(_a, _b, CL.color, 0.3, 1.2);
  P.yaw = P.yawT = Math.atan2(-dx, -dz);
  if (hitDummy(d, 8, 0, 0, 0, false, 0.05, P.pos, true)) {
    const pull = Math.max(0, dist - 1.8);
    d.vel.set(dx / dist * pull * 2.4, Math.max(6, dy * 2.2 + 6), dz / dist * pull * 2.4);
    d.sinceHit = 0; d.stun(0.8);
  }
}

CLASSES.ninja = {
  id: 'ninja', name: 'Shadow Ninja', color: 0xb07cff, weapon: 'daggers', style: 'dagger', run: 11.5, airJumps: 1,
  desc: 'Fast daggers, wall running, teleports. Runs faster.', quote: 'Be where they are not looking.', lmb: 'Daggers',
  atk: [
    { dur: 0.17, a0: 0.03, a1: 0.10, dmg: 7, kb: 1.5, off: 1.0, rad: 2.1, lunge: 5 },
    { dur: 0.17, a0: 0.03, a1: 0.10, dmg: 7, kb: 1.5, off: 1.0, rad: 2.1, lunge: 5 },
    { dur: 0.17, a0: 0.03, a1: 0.10, dmg: 8, kb: 1.5, off: 1.0, rad: 2.1, lunge: 5 },
    { dur: 0.30, a0: 0.07, a1: 0.17, dmg: 16, kb: 6, off: 1.0, rad: 2.2, heavy: true, lunge: 8 },
  ],
  skills: {
    m2: { n: 'Wall Run', cd: 0, hold: true },
    q: { n: 'Shadow Clone', cd: 5, fn: njClone, alt: () => P.clone ? 'SWAP' : null },
    e: { n: 'Kunai Mark', cd: 4, fn: njMark, alt: () => P.mark ? 'WARP' : null },
    r: { n: 'Smoke Vanish', cd: 9, fn: njSmoke },
    f: { n: 'Chain Pull', cd: 3, fn: njChain },
  },
};
