import { clamp, _a, _b, _fx } from '../util.js';
import { spawnArc, spawnRing, shake } from '../fx.js';
import { T, P, CL, CLASSES } from '../state.js';
import { dummies, hitDummy } from '../dummies.js';
import { setState } from '../player.js';
import { camDir, facing, camFacingYaw } from '../camera.js';

// ---------- Monk ----------
export function mkBlock() { P.blockStart = T; }
export function mkDragonKick() {
  P.cd.q = CL.skills.q.cd; P.atk.on = false;
  camDir(P.skDir); P.skDir.y = clamp(P.skDir.y, -0.45, 0.45); if (P.grounded && P.skDir.y < 0) P.skDir.y = 0; P.skDir.normalize();
  setState('dragonKick'); P.skHit.clear(); P.ghostT = 0;
  P.yaw = P.yawT = Math.atan2(P.skDir.x, P.skDir.z);
}
export function mkJuggle() {
  P.cd.e = CL.skills.e.cd;
  for (const d of dummies) {
    if (d.dead) continue;
    if (d.chest(_a).distanceTo(_b.copy(P.pos).setY(P.pos.y + 1.2)) < 5.5) { d.floatT = 2.4; d.vel.set(0, 9, 0); d.sinceHit = 0; d.stun(2.4); }
  }
  P.floatT = 2.4; P.vel.y = 9.5; P.airJumps = P.airJumpsMax;
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.5, 5.5, 0.4, CL.color);
}
export function mkCharge() { P.atk.on = false; setState('charge'); P.chargeK = 0; }
export function mkPalmRelease() {
  const c = P.chargeK;
  P.cd.r = CL.skills.r.cd;
  P.yaw = P.yawT = camFacingYaw(); facing(_a);
  const fx = _a.x, fz = _a.z;
  setState('palm');
  spawnRing(_fx.copy(P.pos).addScaledVector(_a, 1.2).setY(P.pos.y + 0.1), 0.3, 2 + c * 3, 0.3, CL.color);
  spawnArc(0, _b.copy(P.pos).setY(P.pos.y + 1.2), P.yaw, CL.color, 0.7 + c * 0.6);
  shake(0.2 + c * 0.5);
  const cx = P.pos.x + fx * 1.4, cz = P.pos.z + fz * 1.4;
  for (const d of dummies) {
    if (d.dead) continue;
    const dx = d.pos.x - cx, dz = d.pos.z - cz, dy = d.pos.y - P.pos.y;
    if (dx * dx + dz * dz < 2.3 * 2.3 && dy > -1.8 && dy < 2.2) hitDummy(d, 18 + 62 * c, fx * (12 + 30 * c), fz * (12 + 30 * c), 3 + c * 3, true, 0.06 + c * 0.1);
  }
}
export function mkKicks() {
  P.cd.f = CL.skills.f.cd; P.atk.on = false;
  P.yaw = P.yawT = camFacingYaw(); setState('kicks'); P.tick = 0;
}

CLASSES.monk = {
  id: 'monk', name: 'Monk', color: 0xff9f1c, weapon: 'none', style: 'punch', run: 10, airJumps: 2,
  desc: 'Bare fists, parries and air juggles. Has a triple jump.', quote: 'Empty hands hold everything.', lmb: 'Punches',
  atk: [
    { dur: 0.15, a0: 0.03, a1: 0.09, dmg: 6, kb: 1, off: 0.9, rad: 1.7, lunge: 4 },
    { dur: 0.15, a0: 0.03, a1: 0.09, dmg: 6, kb: 1, off: 0.9, rad: 1.7, lunge: 4 },
    { dur: 0.15, a0: 0.03, a1: 0.09, dmg: 7, kb: 1, off: 0.9, rad: 1.7, lunge: 4 },
    { dur: 0.15, a0: 0.03, a1: 0.09, dmg: 7, kb: 1, off: 0.9, rad: 1.7, lunge: 4 },
    { dur: 0.32, a0: 0.08, a1: 0.18, dmg: 18, kb: 10, off: 1.0, rad: 1.9, heavy: true, lunge: 7 },
  ],
  skills: {
    m2: { n: 'Block / Parry', cd: 0, hold: true, fn: mkBlock },
    q: { n: 'Dragon Kick', cd: 4, fn: mkDragonKick },
    e: { n: 'Air Juggle', cd: 7, fn: mkJuggle },
    r: { n: 'Charged Palm', cd: 6, fn: mkCharge, alt: () => P.state === 'charge' ? 'RELEASE' : null },
    f: { n: 'Hundred Kicks', cd: 6, fn: mkKicks },
  },
};
