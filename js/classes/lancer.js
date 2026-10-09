import { _a, _b, _c, _fx } from '../util.js';
import { groundAt } from '../world.js';
import { setWeapon } from '../stickman.js';
import { spawnRing, burst, shake } from '../fx.js';
import { P, CL, CLASSES } from '../state.js';
import { hitArea } from '../dummies.js';
import { fireProj, killProj } from '../projectiles.js';
import { player, depenetrate, setState, teleTrail } from '../player.js';
import { camFwdH, camFacingYaw, lockTarget, aimPoint, handPos } from '../camera.js';
import { inDir, hasIn, hsp } from '../update.js';

// ---------- Lancer ----------
export function lnVault() {
  if (!(P.grounded || P.coyote > 0)) return;
  P.cd.m2 = CL.skills.m2.cd; P.atk.on = false;
  if (hasIn) _a.copy(inDir); else camFwdH(_a);
  const s = Math.max(hsp, 10);
  setState('vault'); P.vel.set(_a.x * s, 24, _a.z * s); P.coyote = 0; P.grounded = false;
  P.yaw = P.yawT = Math.atan2(_a.x, _a.z);
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.3, 2.2, 0.3, CL.color); burst(_fx, 8, 6, 1);
}
export function lnJavelin() {
  if (P.jav) {
    const m = P.jav; _a.copy(P.pos);
    if (m.stuck && m.stuck !== 'solid') { const d = m.stuck; _c.set(d.pos.x - Math.sin(d.yaw) * 1.2, d.pos.y, d.pos.z - Math.cos(d.yaw) * 1.2); }
    else { _c.copy(m.pos).addScaledVector(m.dir, -0.7); _c.y = Math.max(0, _c.y - 0.6); }
    teleTrail(_a, _c); P.pos.copy(_c); depenetrate();
    killProj(m); P.jav = null; setWeapon(player, CL.weapon); P.cd.q = CL.skills.q.cd;
    P.atk.on = false; setState('normal'); P.vel.set(0, 5, 0); P.airJumps = P.airJumpsMax; P.iframes = 0.3;
    spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.3), 0.4, 4.6, 0.35, CL.color); burst(_fx, 14, 10); shake(0.4);
    hitArea(P.pos.x, P.pos.y, P.pos.z, 4.6, 30, 7, 10, true, 0.08, true);
  } else {
    handPos(_a); aimPoint(_b).sub(_a).normalize();
    P.yaw = P.yawT = camFacingYaw(); P.atk.on = false;
    P.jav = fireProj('spear', _a, _b, 54, 7, { life: 6, dmg: 25, heavy: true, stick: true, onExpire: () => { P.jav = null; P.cd.q = CL.skills.q.cd; setWeapon(player, CL.weapon); } });
    if (P.jav) setWeapon(player, 'none');
  }
}
export function lnCharge() {
  P.cd.e = CL.skills.e.cd; P.atk.on = false;
  if (hasIn) P.skDir.copy(inDir); else camFwdH(P.skDir);
  setState('pcharge'); P.ghostT = 0;
  P.yaw = P.yawT = Math.atan2(P.skDir.x, P.skDir.z);
}
export function lnDragoon() {
  P.cd.r = CL.skills.r.cd; P.atk.on = false;
  setState('dragoonUp'); P.vel.y = 26; P.vel.x *= 0.3; P.vel.z *= 0.3; P.grounded = false;
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.3, 2.5, 0.3, CL.color);
}
export function diveTarget(out) {
  if (lockTarget) out.copy(lockTarget.pos); else aimPoint(out);
  const dx = out.x - P.pos.x, dz = out.z - P.pos.z, d = Math.hypot(dx, dz);
  if (d > 38) { out.x = P.pos.x + dx / d * 38; out.z = P.pos.z + dz / d * 38; out.y = groundAt(out.x, out.z, P.pos.y); }
  return out;
}
export function lnSweep() {
  P.cd.f = CL.skills.f.cd; P.atk.on = false; setState('sweep');
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 1.1), 1, 3.9, 0.25, CL.color);
  hitArea(P.pos.x, P.pos.y, P.pos.z, 3.9, 16, 3, 12.5, false, 0.05, false);
}

CLASSES.lancer = {
  id: 'lancer', name: 'Lancer', color: 0x3ddc84, weapon: 'spear', style: 'thrust', run: 9.5, airJumps: 1,
  desc: 'Long spear, pole vault and huge leaps.', quote: 'Reach further. Then leap further still.', lmb: 'Thrust',
  atk: [
    { dur: 0.30, a0: 0.07, a1: 0.17, dmg: 13, kb: 3, off: 2.0, rad: 1.9 },
    { dur: 0.30, a0: 0.07, a1: 0.17, dmg: 13, kb: 3, off: 2.0, rad: 1.9 },
    { dur: 0.42, a0: 0.12, a1: 0.24, dmg: 26, kb: 10, off: 2.3, rad: 2.0, heavy: true, lunge: 10 },
  ],
  skills: {
    m2: { n: 'Pole Vault', cd: 2.5, fn: lnVault },
    q: { n: 'Javelin', cd: 5, fn: lnJavelin, alt: () => P.jav ? 'RECALL' : null },
    e: { n: 'Piercing Charge', cd: 6, fn: lnCharge },
    r: { n: 'Dragoon Dive', cd: 7, fn: lnDragoon },
    f: { n: 'Sweep', cd: 4, fn: lnSweep },
  },
};
