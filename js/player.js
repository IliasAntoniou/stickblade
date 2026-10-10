// player.js: the player's body and everything every class shares. Collision with the world, taking damage,
// the basic attack combo, dash and slide. Class-specific skills are in classes/.
// P.state says what the player is doing ('normal', 'dash', 'slide' or a skill name). update.js runs the matching block each frame.

import * as THREE from 'three';
import { V3, clamp, _a, _b, _c, _fx, _hp } from './util.js';
import { scene } from './core.js';
import { solids, area, makeShadow } from './world.js';
import { makeStickman, setWeapon, BASE, addRim, castShadows } from './stickman.js';
import { glowTex, spawnSwirl, spawnArc, ringGeo, spawnRing, burst, spawnGhost, beamGeo, spawnBeam, spawnText, centerMsg, shake, addHitstop, flashHurt } from './fx.js';
import { T, P, CL, dlg, chal, SPAWN, combo, TUNE, setHitSrc } from './state.js';
import { dummies, hitDummy, hitArea } from './dummies.js';
import { killProj } from './projectiles.js';
import { camDir, facing, camFacingYaw, setCamYaw, setCamPitch } from './camera.js';
import { removeClone } from './classes/ninja.js';
import { endChallenge } from './challenges.js';
import { reach, slashColor, clearStyle, slamSources } from './styles.js';
import { strikeMaster } from './master.js';
import { questEvent } from './quests.js';
import { stowMount } from './mounts.js';
import { inDir, hasIn, inX, inZ, hsp } from './update.js';

// ================= player =================
// A pale body so the player stands out against the dusk; the weapon is pure unlit colour so it looks like it glows.
export const playerMat = addRim(new THREE.MeshLambertMaterial({ color: 0xeef1f8, emissive: 0x000000, transparent: true }));
export const bladeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, toneMapped: false });
export const player = makeStickman(playerMat, bladeMat, true); scene.add(player.root);
castShadows(player);
// A faint halo that rides on the weapon hand: one extra draw call. Kept weak on purpose. setClass tints it to the class colour.
export const bladeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x00e5ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.2, toneMapped: false }));
bladeGlow.position.set(0, 0, 0.55);
bladeGlow.scale.setScalar(0.9);
player.wrist.add(bladeGlow);
export const playerShadow = makeShadow();
// ninja shadow clone
export const cloneMat = new THREE.MeshBasicMaterial({ color: 0x4b2a80, transparent: true, opacity: 0.75 });
export const cloneSm = makeStickman(cloneMat, cloneMat, true); cloneSm.root.visible = false; scene.add(cloneSm.root);
// lancer dive marker
export const diveMark = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
diveMark.visible = false; scene.add(diveMark);

// Everything about the player. The main ones:
// pos, vel = position and speed.  yaw = facing angle (yawT = the angle being turned towards).
// state, st = current state and seconds spent in it.  cd = seconds left on each cooldown.  atk = the basic combo in progress.
// iframes = seconds of invulnerability left.
Object.assign(P, {
  pos: SPAWN.clone(), vel: new V3(), yaw: Math.PI, yawT: Math.PI, grounded: false, justLanded: false,
  airJumps: 1, airJumpsMax: 1, run: 9.5, dashCharges: 2, dashRecharge: 0, state: 'normal', st: 0, grav: 0,
  coyote: 0, jumpBuf: 0, wallN: new V3(), wallT: 0, wallrunCd: 0, flip: 0, spin: 0, runPhase: 0, ghostT: 0,
  dashDir: new V3(), skDir: new V3(), gPoint: new V3(), gTarget: null, tick: 0, skHit: new Set(), dragged: [], dTarget: new V3(),
  cd: { m2: 0, q: 0, e: 0, r: 0, f: 0, x: 0 },
  atk: { on: false, t: 0, combo: 0, hit: new Set(), queued: false, lastEnd: -9, lastCombo: 0, vfx: false },
  hp: 100, maxHp: 100, hurtT: 99, iframes: 0, blocking: false, blockStart: -9,
  sink: 0,    // how far the body is drawn below where it stands (going under the water of a pool, see styles.js)
  seat: 0,    // how far the body is drawn above where it stands (sitting on a mount, see mounts.js)
  castN: 0, castY: 0,    // castN counts skill uses, castY is the height the last slam started from (trials read these)
  smokeT: 0, dmgMult: 1, floatT: 0, clone: null, mark: null, jav: null, lmbHeld: 0, kunaiT: 0, chargeK: 0,
});
// Jump, gravity, dash and health numbers are in TUNE (state.js) so the tuning panel can change them.
// PR, PH = the player's collision radius and height.  FLIP_T = length of a somersault.
export const PR = 0.32, PH = 1.75, FLIP_T = 0.42;
// States that other actions cannot cancel.
export const LOCKED = new Set(['slamUp', 'slamDown', 'dragoonUp', 'dragoonDown', 'submerge', 'ignite', 'storm', 'grabbed']);
// pose = what the player looks like now. tp = the pose being blended towards (see anim.js).
export const pose = { ...BASE }, tp = { ...BASE };

// collision
// Would the player's box at (x, y, z) overlap solid s?
export function overl(s, x, y, z) { return x + PR > s.min.x && x - PR < s.max.x && z + PR > s.min.z && z - PR < s.max.z && y + PH > s.min.y && y < s.max.y; }
export function anyOverlap(x, y, z) { for (const s of solids) if (overl(s, x, y, z)) return s; return null; }
// Move along ONE axis ('x', 'y' or 'z') by d, then push back out of anything hit. Doing one axis at a time is
// what makes sliding along walls work. Also steps up small ledges (up to 0.55 high) and remembers the wall just
// touched (wallN, wallT) for wall jumps.
export function moveAxis(ax, d) {
  if (d === 0) return;
  P.pos[ax] += d;
  for (const s of solids) {
    if (!overl(s, P.pos.x, P.pos.y, P.pos.z)) continue;
    if (ax === 'y') {
      if (d < 0) { P.pos.y = s.max.y; if (P.vel.y < 0) P.vel.y = 0; P.grounded = true; }
      else { P.pos.y = s.min.y - PH - 1e-4; if (P.vel.y > 0) P.vel.y = 0; }
    } else {
      const rise = s.max.y - P.pos.y;
      if (rise > 0 && rise <= 0.55 && (P.grounded || P.vel.y <= 0) && !anyOverlap(P.pos.x, s.max.y + 0.001, P.pos.z)) { P.pos.y = s.max.y; continue; }
      P.pos[ax] = d > 0 ? s.min[ax] - PR - 1e-4 : s.max[ax] + PR + 1e-4;
      P.vel[ax] = 0;
      if (!P.grounded) { P.wallN.set(ax === 'x' ? -Math.sign(d) : 0, 0, ax === 'z' ? -Math.sign(d) : 0); P.wallT = 0.18; }
    }
  }
}
// After a teleport: if the player ended up inside a box, push out the shortest way.
export function depenetrate() {
  if (P.pos.y < 0) P.pos.y = 0;
  for (let it = 0; it < 5; it++) {
    const s = anyOverlap(P.pos.x, P.pos.y, P.pos.z); if (!s) break;
    const opts = [['x', s.min.x - PR - P.pos.x], ['x', s.max.x + PR - P.pos.x], ['z', s.min.z - PR - P.pos.z], ['z', s.max.z + PR - P.pos.z], ['y', s.max.y - P.pos.y], ['y', s.min.y - PH - P.pos.y]];
    let best = opts[0]; for (const o of opts) if (Math.abs(o[1]) < Math.abs(best[1])) best = o;
    P.pos[best[0]] += best[1] + Math.sign(best[1]) * 0.002;
  }
  if (P.pos.y < 0) P.pos.y = 0;
}
// Apply speed and gravity for this frame, in slices of at most 1/120 s so fast moves cannot pass through thin platforms.
export function integrate(dt) {
  const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
  const was = P.grounded;
  for (let i = 0; i < n; i++) {
    P.vel.y = Math.max(P.vel.y - P.grav * h, -60);
    moveAxis('x', P.vel.x * h); moveAxis('z', P.vel.z * h);
    P.grounded = false;
    const dy = P.vel.y * h; moveAxis('y', dy <= 0 ? Math.min(dy, -0.0005) : dy);
    if (P.pos.y <= 0) { P.pos.y = 0; if (P.vel.y < 0) P.vel.y = 0; P.grounded = true; }
  }
  const lim = area.half - PR - 0.05;
  P.pos.x = clamp(P.pos.x, area.cx - lim, area.cx + lim); P.pos.z = clamp(P.pos.z, area.cz - lim, area.cz + lim);
  if (P.grounded) {
    P.coyote = 0.1; P.airJumps = P.airJumpsMax;
    if (!was) { P.justLanded = true; spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.2, 1.1, 0.22, 0xffffff); }
  }
}

// grapple rope
export const ropeMesh = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xdfe4ee }));
ropeMesh.visible = false; scene.add(ropeMesh);
export const hookMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
hookMesh.visible = false; scene.add(hookMesh);

// Lancer charge: let go of the dummies being pushed. full = the charge ran its course, so launch them.
export function releaseDrag(full) {
  for (const d of P.dragged) {
    d.pinned = false;
    if (full) hitDummy(d, 18, P.skDir.x * 16, P.skDir.z * 16, 7, true, 0.06, P.pos, true); else d.vel.set(0, 0, 0);
  }
  P.dragged.length = 0;
}
// Switch state. The ifs tidy up after the state being left (hide the rope, start a cooldown...).
export function setState(s) {
  const o = P.state;
  if (o === 'grapple' && s !== 'grapple') { ropeMesh.visible = hookMesh.visible = false; P.cd.m2 = CL.skills.m2.cd; }
  if (o === 'wallrun') P.wallrunCd = 0.35;
  if (o === 'pcharge') releaseDrag(P.st >= 0.5);
  if (o === 'charge') { P.chargeK = 0; playerMat.emissive.setHex(0); }
  if (o === 'dragoonUp' || o === 'dragoonDown') diveMark.visible = s === 'dragoonDown';
  if (o === 'mounted' && s !== 'mounted') stowMount();    // any other state means the player is off the mount
  if (s !== 'cyclone' && s !== 'sweep') P.spin = 0;
  P.state = s; P.st = 0;
}

// ---------- taking damage ----------
// Hits pass through the player while this is true.
export function isInvuln() { return P.iframes > 0 || P.state === 'dash' || P.state === 'blinkStrike' || P.state === 'dragonKick' || P.state === 'submerge' || P.state === 'ignite' || P.state === 'storm' || P.state === 'grabbed'; }
// The player is hit for dmg from position src. attacker (optional) is the dummy, needed for the monk's parry.
export function hurtPlayer(dmg, src, attacker) {
  if (dlg.open || chal.phase === 'count') return;
  if (TUNE.god) return;
  _hp.copy(P.pos); _hp.y += 1.5;
  if (isInvuln()) { spawnText(_hp, 'DODGE', 'dodge'); return; }
  if (P.blocking) {
    if (T - P.blockStart < 0.3 && attacker) { parry(attacker); return; }
    dmg *= 0.2; spawnText(_hp, 'BLOCK', 'block');
  }
  dmg = Math.round(dmg * TUNE.dmgTaken);
  P.hp -= dmg; P.hurtT = 0; flashHurt(); shake(0.45);
  _hp.y += 0.3; spawnText(_hp, '-' + dmg, 'hurt');
  const dx = P.pos.x - src.x, dz = P.pos.z - src.z, l = Math.hypot(dx, dz) || 1;
  const kb = P.blocking ? 3 : 9;
  P.vel.x = dx / l * kb; P.vel.z = dz / l * kb; if (!P.blocking) P.vel.y = Math.max(P.vel.y, 7);
  if (!LOCKED.has(P.state) && !P.blocking) setState('normal');
  P.atk.on = false;
  if (P.hp <= 0) playerDefeated();
}
// Monk blocked at the last moment: appear behind the attacker, stun it and hit back.
export function parry(d) {
  P.iframes = 0.6;
  const fx = Math.sin(d.yaw), fz = Math.cos(d.yaw);
  spawnGhost(player, CL.color, null, 0.35);
  P.pos.set(d.pos.x - fx * 1.5, d.pos.y, d.pos.z - fz * 1.5); depenetrate(); P.vel.set(0, 0, 0);
  P.yaw = P.yawT = d.yaw; setCamYaw(P.yaw + Math.PI);
  d.stun(1.8);
  _hp.copy(P.pos); _hp.y += 2; spawnText(_hp, 'PARRY!', 'gold');
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 1), 0.3, 2.5, 0.3, 0xffd23f);
  hitDummy(d, 25, fx * 4, fz * 4, 4, true, 0.16);
}
// Health ran out: end any challenge and go back to the start.
export function playerDefeated() {
  centerMsg('DEFEATED<small>Master Sen drags you back to the start</small>', 2);
  if (chal.cur) endChallenge();
  respawnPlayer();
  for (const d of dummies) { d.cancelAtk(); if (d.type === 'fighter') d.aiCd = 3; }
  questEvent('defeated');    // a story task with enemies starts over (quests.js)
}
export function respawnPlayer() {
  cleanupClassObjects();
  P.pos.copy(SPAWN); P.vel.set(0, 0, 0); P.hp = P.maxHp; P.atk.on = false;
  setState('normal'); P.yaw = P.yawT = Math.PI; setCamYaw(0); setCamPitch(-0.12); P.iframes = 1;
}

// ================= actions =================
// Start the next hit of the basic combo (CL.atk). force = begin at a given step.
export function startAttack(force = -1) {
  const a = P.atk, n = CL.atk.length;
  let c = 0; if (T - a.lastEnd < 0.4 && a.lastCombo < n - 1) c = a.lastCombo + 1;
  if (force >= 0) c = force;
  a.on = true; a.t = 0; a.combo = c; a.hit.clear(); a.queued = false; a.vfx = false;
  a.src = null;    // a skill that starts a swing (Blink Strike) sets this so the swing counts as that skill
  a.n = (a.n || 0) + 1;    // counts swings, so a trial can tell one swing from the next
  P.yaw = P.yawT = camFacingYaw(); facing(_a);
  const lunge = CL.atk[c].lunge ?? 6;
  const along = P.vel.x * _a.x + P.vel.z * _a.z;
  if (along < lunge) { P.vel.x += _a.x * (lunge - along); P.vel.z += _a.z * (lunge - along); }
  if (!P.grounded) P.vel.y = Math.max(P.vel.y, 3);
  if (P.state === 'dash' || P.state === 'slide' || P.state === 'mounted') setState('normal');    // attacking gets off a mount
}
// Runs every frame of the hit window. Each dummy can be hit once per swing (a.hit remembers who).
export function attackHits() {
  const a = P.atk, A = CL.atk[a.combo]; facing(_a);
  setHitSrc(a.src || 'atk');
  const cx = P.pos.x + _a.x * A.off, cz = P.pos.z + _a.z * A.off;
  const rad = A.rad * reach();    // a sword style can widen the swing
  strikeMaster(cx, P.pos.y, cz, rad);    // swinging at Master Sen has consequences (master.js)
  for (const d of dummies) {
    if (d.dead || a.hit.has(d)) continue;
    const dx = d.pos.x - cx, dz = d.pos.z - cz, dy = d.pos.y - P.pos.y;
    if (dx * dx + dz * dz < rad * rad && dy > -1.8 && dy < 2.2) {
      a.hit.add(d);
      const up = !P.grounded ? 6 : (A.heavy ? 3 : 0);
      hitDummy(d, A.dmg, _a.x * A.kb, _a.z * A.kb, up, !!A.heavy);
    }
  }
}
// The swing's visual, chosen by the class's style.
export function attackVfx() {
  const a = P.atk, c = a.combo, last = c === CL.atk.length - 1; facing(_a);
  _b.copy(P.pos).addScaledVector(_a, 0.2).setY(P.pos.y + 1.15);
  switch (CL.style) {
    // Swords and daggers get no ready-made shape here: their slash is the ribbon drawn from the blade's real path
    // (updateTrail in fx.js, fed from anim.js), so it can never be out of line with the weapon.
    case 'slash': break;
    case 'dagger': break;
    case 'punch': spawnArc(last ? 2 : c % 2, _b, P.yaw, CL.color, last ? 0.75 : 0.5); break;
    case 'thrust': {
      const A = CL.atk[c];
      _b.copy(P.pos).addScaledVector(_a, 0.6).setY(P.pos.y + 1.3);
      _c.copy(P.pos).addScaledVector(_a, A.off + A.rad).setY(P.pos.y + 1.3);
      spawnBeam(_b, _c, CL.color, 0.14, last ? 5 : 3);
      break;
    }
  }
}
// Dash towards the movement keys, or where the camera looks if none are held (so looking up dashes upward).
export function startDash() {
  if (hasIn && !(inZ > 0 && inX === 0)) P.dashDir.copy(inDir);
  else { camDir(P.dashDir); P.dashDir.y = clamp(P.dashDir.y, -0.5, 0.6); if (P.grounded && P.dashDir.y < 0) P.dashDir.y = 0; P.dashDir.normalize(); }
  if (P.dashCharges === TUNE.dashCharges) P.dashRecharge = TUNE.dashCd;
  P.dashCharges--; P.atk.on = false;
  setState('dash'); P.ghostT = 0;
  P.yaw = P.yawT = Math.atan2(P.dashDir.x, P.dashDir.z);
  shake(0.08);
}
// Slide: a speed boost that fades. Needs some speed to start.
export function startSlide() {
  if (hsp < 2.5) return;
  const boost = Math.min(hsp + 6, 23);
  if (hasIn) _a.copy(inDir); else _a.set(P.vel.x / hsp, 0, P.vel.z / hsp);
  P.vel.x = _a.x * boost; P.vel.z = _a.z * boost;
  P.yaw = P.yawT = Math.atan2(_a.x, _a.z);
  P.atk.on = false; setState('slide');
}
// A row of afterimages between two points, for teleports.
export function teleTrail(from, to, n = 6) {
  for (let i = 1; i <= n; i++) { player.root.position.lerpVectors(from, to, i / (n + 1)); spawnGhost(player, CL.color, player.root.position, 0.35); }
}
// Shared landing blast for Meteor Slam and Dragoon Dive. stun = seconds everything in the blast is stunned (0 = none).
export function groundImpact(rad, dmg, color, stun = 0) {
  rad *= reach();
  color = slashColor();
  _fx.copy(P.pos).setY(P.pos.y + 0.05);
  spawnRing(_fx, 0.5, rad + 1.5, 0.4, color);
  spawnSwirl(_fx.setY(P.pos.y + 0.12), rad * 0.5, color, 0.5, 2.5, 1);    // a painted wave rolling outwards
  burst(_fx.setY(P.pos.y + 0.3), 18, 12); shake(0.7); addHitstop(0.06);
  setHitSrc('r');
  hitArea(P.pos.x, P.pos.y, P.pos.z, rad, dmg, 9, 13, true, 0.07, true, 0.75);
  if (stun > 0) {
    for (const d of dummies) {
      if (!d.dead && Math.hypot(d.pos.x - P.pos.x, d.pos.z - P.pos.z) < rad) d.stun(stun);
    }
  }
  setState('normal'); P.vel.set(0, 0, 0);
  slamSources();    // landing in a pool starts the Water scene (after this slam, so the slam itself is still plain)
}
// Remove whatever a class left in the world (clone, kunai, javelin) when changing class or respawning.
export function cleanupClassObjects() {
  if (P.clone) removeClone();
  if (P.mark) { killProj(P.mark); P.mark = null; }
  if (P.jav) { killProj(P.jav); P.jav = null; }
  P.smokeT = 0; P.dmgMult = 1; P.floatT = 0; P.blocking = false;
  clearStyle();    // a sword style does not survive a respawn, a teleport, a class change or the start of a trial
  if (CL) setWeapon(player, CL.weapon);
}
