// elements.js: what makes each sword style a different power, not just a different colour. A style (styles.js)
// gives every hit a small extra effect; this file gives each element a JOB and changes what the Blademaster's four
// skills do while the style is on:
//   Flame   = destruction: the most damage, over an area and over time. Fire is left behind and keeps burning.
//   Thunder = speed and stuns: jumps from enemy to enemy and freezes them for a moment.
//   Water   = control and survival: drags enemies in, shoves them away, weakens them, and heals the player.
// The numbers are all in POWERS. The skills themselves stay where they are (classes/blade.js, update.js) and ask
// this file what the element changes: blinkPower, spinSpeed, spinSteer, spinTick, spinHit, spinPull, slamPower,
// slamLanded, risingPower, risingCast, risingHit.
// Owns: POWERS, the patches of fire left on the ground ("zones"), and things set to happen a moment later.
// The Mage has no powers written skill by skill. For it a style adds one thing to every skill,
// at the place where it lands: STRIKES and skillStrike() at the bottom of this file.
// Used by: classes/blade.js, classes/mage.js, update.js, dummies.js (SOAK), hud.js (skillAlt names the skills), player.js (clearElements),
// setpieces.js (addZone: a powder keg leaves fire behind).

import * as THREE from 'three';
import { V3, _fx } from './util.js';
import { scene } from './core.js';
import { glowTex, spawnRing, spawnBeam, spawnText, spawnGlow, burst, shake } from './fx.js';
import { T, P, CL, setHitSrc } from './state.js';
import { style } from './styles.js';
import { dummies, hitDummy, hitArea, dummyBlocked } from './dummies.js';
import { depenetrate, teleTrail } from './player.js';
import { setCamYaw } from './camera.js';
import { inDir, hasIn } from './update.js';

// Every number an element changes. Distances are world units, times are seconds; a "share" is a part of the
// skill's own number (0.6 = 60% of it), so the powers grow with the skill's rank.
//   role  = the element's job in a few words (shown to the player).
//   names = what each skill is called on the skill bar while the style is on (q, e, r, f = the skill keys).
export const POWERS = {
  flame: {
    role: 'Destruction',
    names: { q: 'Fire Burst', e: 'Fire Tornado', r: 'Burning Crater', f: 'Pillar of Fire' },
    // Blink Strike: an explosion where you arrive. Radius, and its damage as a share of Blink Strike's.
    burstRad: 4.2, burstShare: 0.6,
    // Cyclone: drops a patch of fire this often along its path. Each patch: radius, how long it burns, burn damage per second.
    trailEvery: 0.09, trailRad: 1.7, trailTime: 4, trailDps: 14,
    // Meteor Slam: leaves a crater of fire. Its size as a share of the blast, how long it burns, burn damage per second.
    craterShare: 0.6, craterTime: 6, craterDps: 24,
    // Rising Slash: a pillar of fire. Multiplies its reach and its damage; it hits all around.
    pillarRad: 1.4, pillarDmg: 1.5,
  },
  thunder: {
    role: 'Speed and stuns',
    names: { q: 'Chain Blink', e: 'Storm Spin', r: 'Thunderclap', f: 'Skybolt' },
    // Blink Strike: after the first target you jump on to this many more, each within this range of the last,
    // hitting for this share of the damage and stunning for this long.
    jumps: 2, jumpRange: 10, jumpShare: 0.7, jumpStun: 0.6,
    // Cyclone: faster (plain is 22), can be steered with the movement keys (higher = turns quicker), every hit stuns.
    spinSpeed: 30, spinSteer: 6, spinStun: 0.3,
    // Meteor Slam: everything in the blast is stunned.
    clapStun: 1.5,
    // Rising Slash: a bolt comes down on each launched enemy after this delay, for this damage, and holds it in the air this long.
    boltDelay: 0.4, boltDmg: 30, boltHold: 0.8,
  },
  water: {
    role: 'Control and survival',
    names: { q: 'Drenching Strike', e: 'Whirlpool', r: 'Tidal Slam', f: 'Geyser' },
    // Blink Strike: the target is soaked for this long (see SOAK for what that does).
    soakTime: 5,
    // Cyclone: drags in enemies from this many times the spin's own reach, at this speed.
    pullRange: 2.4, pullSpeed: 15,
    // Meteor Slam: a wave. Multiplies the blast radius, replaces its knockback (plain is 9), and heals this much
    // for every enemy hit, up to healMax.
    waveRad: 1.3, waveKnock: 24, waveHeal: 6, healMax: 30,
    // Rising Slash: a geyser. Multiplies its reach, hits all around, holds enemies in the air this long, heals per enemy.
    geyserRad: 1.3, geyserHold: 1.2, geyserHeal: 4,
  },
};
// Soaked (Water's Blink Strike): the enemy takes dmg times as much from every hit, and a fighter moves and
// readies its attacks at slow times its normal pace. Read by dummies.js.
export const SOAK = { dmg: 1.3, slow: 0.5 };

// The powers of the style in use, or null when the sword is plain.
export const power = () => (style.cur ? POWERS[style.cur.id] || null : null);
// What a skill is called right now (hud.js shows it in gold on the skill bar), or null for its normal name.
export function skillAlt(slot) {
  const p = power();
  return p ? p.names[slot] : null;
}

// ---------- things that happen a moment later ----------
const pending = [];
function later(delay, fn) { pending.push({ at: T + delay, fn }); }

// ---------- healing ----------
const _text = new V3();
function heal(amount) {
  const gained = Math.min(amount, P.maxHp - P.hp);
  if (gained <= 0) return;
  P.hp += gained;
  spawnText(_text.set(P.pos.x, P.pos.y + 2.1, P.pos.z), '+' + Math.round(gained), 'heal');
}

// ---------- fire left on the ground ----------
// A zone is a round patch of fire. Anything standing in it is set burning, at the zone's damage per second, for
// as long as it stays (the burning itself is done by the Dummy, the same as Flame's burn on a hit).
const zoneGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
const zones = [];
for (let i = 0; i < 16; i++) {
  const m = new THREE.Mesh(zoneGeo, new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff6a1f, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  m.visible = false;
  scene.add(m);
  zones.push({ m, pos: new V3(), rad: 1, life: 0, max: 1, dps: 0, seed: i * 1.7 });
}
let zoneIdx = 0;
// pos = centre, rad = radius, time = seconds it burns, dps = damage per second to whatever stands in it.
export function addZone(pos, rad, time, dps) {
  const z = zones[zoneIdx = (zoneIdx + 1) % zones.length];    // when all are in use the oldest is replaced
  z.pos.copy(pos);
  z.rad = rad;
  z.life = z.max = time;
  z.dps = dps;
  z.m.position.set(pos.x, pos.y + 0.07, pos.z);
  z.m.scale.setScalar(rad * 1.35);    // the picture fades towards its edge, so it is drawn a little larger than the patch
  z.m.visible = true;
}
// How many patches of fire are burning (for tests).
export const zoneCount = () => zones.filter(z => z.life > 0).length;

// Once per frame (update.js, after the dummies have moved): run delayed effects, and burn what stands in fire.
export function updateElements(dt) {
  for (let i = pending.length - 1; i >= 0; i--) {
    if (T < pending[i].at) continue;
    const { fn } = pending[i];
    pending.splice(i, 1);
    fn();
  }
  for (const z of zones) {
    if (z.life <= 0) continue;
    z.life -= dt;
    if (z.life <= 0) { z.m.visible = false; continue; }
    // flickers while it burns, and dies down over its last second
    z.m.material.opacity = (0.55 + Math.sin(T * 19 + z.seed) * 0.15) * Math.min(1, z.life);
    if (Math.random() < dt * 6) burst(_fx.set(z.pos.x + (Math.random() - 0.5) * z.rad, z.pos.y + 0.2, z.pos.z + (Math.random() - 0.5) * z.rad), 1, 3);
    for (const d of dummies) {
      if (d.dead || Math.abs(d.pos.y - z.pos.y) > 2 || Math.hypot(d.pos.x - z.pos.x, d.pos.z - z.pos.z) > z.rad) continue;
      d.burnT = Math.max(d.burnT, 0.6);
      d.burnDps = Math.max(d.burnDps, z.dps);
    }
  }
}
// Put out every fire and drop everything waiting to happen. Called when the player respawns (player.js), so
// nothing from one fight or trial carries into the next.
export function clearElements() {
  pending.length = 0;
  for (const z of zones) { z.life = 0; z.m.visible = false; }
}

// ---------- Blink Strike (Q) ----------
const _from = new V3(), _to = new V3();
// Called by bmBlink after it has struck its target. first = that target, S = the skill (S.dmg is its damage).
export function blinkPower(first, S) {
  const p = power();
  if (!p) return;
  setHitSrc('q');
  if (p === POWERS.flame) {
    // an explosion round the point of arrival; everything it reaches is set burning by the style
    first.chest(_from);
    spawnRing(_fx.set(first.pos.x, first.pos.y + 0.1, first.pos.z), 0.4, p.burstRad + 0.6, 0.35, 0xff6a1f);
    spawnGlow(_from, 0xff7a1f, 4.5, 0.25);
    burst(_from, 26, 13);
    shake(0.5);
    hitArea(first.pos.x, first.pos.y, first.pos.z, p.burstRad, S.dmg * p.burstShare, 7, 5, true, 0.05, true, 0.3);
  } else if (p === POWERS.thunder) {
    // jump on from enemy to enemy, arriving behind each, and finish behind the last one
    const struck = new Set([first]);
    let last = first;
    first.stun(p.jumpStun);
    for (let n = 0; n < p.jumps; n++) {
      let next = null, nearest = p.jumpRange;
      for (const d of dummies) {
        if (d.dead || struck.has(d)) continue;
        const dist = d.pos.distanceTo(last.pos);
        if (dist < nearest) { nearest = dist; next = d; }
      }
      if (!next) break;
      last.chest(_from); next.chest(_to);
      spawnBeam(_from, _to, 0xfff3a0, 0.22, 3);
      _from.copy(P.pos);
      _to.set(next.pos.x - Math.sin(next.yaw) * 1.4, next.pos.y, next.pos.z - Math.cos(next.yaw) * 1.4);
      teleTrail(_from, _to, 3);
      P.pos.copy(_to);
      hitDummy(next, S.dmg * p.jumpShare, 0, 0, 6, true, 0.05);
      next.stun(p.jumpStun);
      struck.add(next);
      last = next;
    }
    if (last !== first) {
      depenetrate();
      P.yaw = P.yawT = Math.atan2(last.pos.x - P.pos.x, last.pos.z - P.pos.z);
      setCamYaw(P.yaw + Math.PI);
    }
  } else if (p === POWERS.water) {
    first.soakT = p.soakTime;
    first.chest(_from);
    spawnText(_from.setY(_from.y + 0.9), 'SOAKED', 'dodge');
    spawnRing(_fx.set(first.pos.x, first.pos.y + 0.1, first.pos.z), 0.3, 2.6, 0.4, 0x2f8fff);
    burst(_from, 12, 6, 2);
  }
}

// ---------- Cyclone (E) ----------
// How fast the spin travels.
export const spinSpeed = () => (power() === POWERS.thunder ? POWERS.thunder.spinSpeed : 22);
// Thunder: the spin bends towards where the movement keys point. Runs every frame of the spin.
export function spinSteer(dt) {
  const p = power();
  if (p !== POWERS.thunder || !hasIn) return;
  P.skDir.lerp(inDir, 1 - Math.exp(-p.spinSteer * dt)).setY(0).normalize();
  P.yawT = Math.atan2(P.skDir.x, P.skDir.z);
}
let lastPatch = -9;
// Flame: drop fire along the path. Runs every time the spin hits (about 13 times a second).
export function spinTick() {
  const p = power();
  if (p !== POWERS.flame || T - lastPatch < p.trailEvery) return;
  lastPatch = T;
  addZone(P.pos, p.trailRad, p.trailTime, p.trailDps);
}
// Thunder: every enemy the spin hits is frozen for a moment.
export function spinHit(d) {
  const p = power();
  if (p === POWERS.thunder) d.stun(p.spinStun);
}
// Water: a whirlpool. Enemies on the ground well outside the spin's own reach are dragged towards the player.
// Runs every frame of the spin. spinRad = the spin's reach.
export function spinPull(dt, spinRad) {
  const p = power();
  if (p !== POWERS.water) return;
  for (const d of dummies) {
    if (d.dead || d.type === 'flying' || d.pinned || Math.abs(d.pos.y - P.pos.y) > 2.2) continue;
    const dx = P.pos.x - d.pos.x, dz = P.pos.z - d.pos.z, dist = Math.hypot(dx, dz);
    if (dist > spinRad * p.pullRange || dist < spinRad * 0.5) continue;
    const ox = d.pos.x, oz = d.pos.z;
    d.pos.x += dx / dist * p.pullSpeed * dt;
    d.pos.z += dz / dist * p.pullSpeed * dt;
    if (dummyBlocked(d.pos)) { d.pos.x = ox; d.pos.z = oz; }    // never dragged into a rock
  }
}

// ---------- Meteor Slam (R) ----------
// What the element changes about the blast: rad multiplies its radius, knock is its knockback, stun stuns what it hits.
export function slamPower() {
  const p = power();
  if (p === POWERS.thunder) return { rad: 1, knock: 9, stun: p.clapStun };
  if (p === POWERS.water) return { rad: p.waveRad, knock: p.waveKnock, stun: 0 };
  return { rad: 1, knock: 9, stun: 0 };
}
// Called right after the blast. p is passed in because landing in a pool can change the style during the blast;
// rad = the blast's real radius.
export function slamLanded(p, rad) {
  if (!p) return;
  if (p === POWERS.flame) {
    addZone(P.pos, rad * p.craterShare, p.craterTime, p.craterDps);
    spawnGlow(_fx.set(P.pos.x, P.pos.y + 0.6, P.pos.z), 0xff7a1f, rad * 0.9, 0.3);
    return;
  }
  // which enemies the blast reached: the ones hit this very frame
  const reached = dummies.filter(d => d.sinceHit === 0 && Math.hypot(d.pos.x - P.pos.x, d.pos.z - P.pos.z) < rad + 0.5);
  if (p === POWERS.thunder) {
    for (const d of reached) {
      d.chest(_to);
      spawnBeam(_from.set(_to.x + 0.6, _to.y + 13, _to.z), _to, 0xfff3a0, 0.24, 3.4);    // a bolt out of the sky onto each
      burst(_to, 5, 7, 3);
    }
  } else if (p === POWERS.water) {
    spawnRing(_fx.set(P.pos.x, P.pos.y + 0.08, P.pos.z), 1, rad + 2.5, 0.6, 0x9fd0ff);    // the wave rolling out
    heal(Math.min(p.healMax, reached.length * p.waveHeal));
  }
}

// ---------- Rising Slash (F) ----------
// What the element changes: rad and dmg multiply the skill's own, around = it hits behind the player too.
export function risingPower() {
  const p = power();
  if (p === POWERS.flame) return { rad: p.pillarRad, dmg: p.pillarDmg, around: true };
  if (p === POWERS.water) return { rad: p.geyserRad, dmg: 1, around: true };
  return { rad: 1, dmg: 1, around: false };
}
// The look of the cast: a column of rings climbing from the ground (fire or water). rad = the skill's real reach.
export function risingCast(rad) {
  const p = power();
  if (p !== POWERS.flame && p !== POWERS.water) return;
  const color = p === POWERS.flame ? 0xff6a1f : 0x2f8fff;
  const x = P.pos.x, y = P.pos.y, z = P.pos.z;
  for (let i = 0; i < 5; i++) {
    later(i * 0.05, () => spawnRing(_fx.set(x, y + 0.2 + i * 1.1, z), rad * 0.3, rad * (1 - i * 0.12), 0.32, color));
  }
  spawnGlow(_fx.set(x, y + 1.5, z), color, rad * 1.1, 0.3);
}
// Called for every enemy the uppercut launched.
export function risingHit(d) {
  const p = power();
  if (p === POWERS.thunder) {
    // a bolt comes down on it near the top of its flight, hits again and holds it there
    later(p.boltDelay, () => {
      if (d.dead) return;
      d.chest(_to);
      spawnBeam(_from.set(_to.x + 0.5, _to.y + 13, _to.z), _to, 0xfff3a0, 0.26, 3.6);
      spawnGlow(_to, 0xffe14a, 2.6, 0.2);
      setHitSrc('f');
      hitDummy(d, p.boltDmg, 0, 0, 3, true, 0.06, P.pos, true);
      if (!d.dead) { d.floatT = p.boltHold; d.stun(p.boltHold); }
    });
  } else if (p === POWERS.water) {
    // the geyser carries it up and holds it at the top; the hold starts once it has risen
    later(0.3, () => { if (!d.dead) d.floatT = p.geyserHold; });
    heal(p.geyserHeal);
  }
}
// ---------- the Mage ----------
// What a style adds to every one of the Mage's skills, at the place where the skill lands:
//   Flame   = fire is left there. fireShare = the patch's radius as a share of the skill's own reach (never
//             smaller than fireMin); fireTime = seconds it burns; fireDps = burn damage per second.
//   Thunder = a bolt comes down on everything the skill reached: it is stunned for `stun` seconds and hit again
//             for boltShare of the skill's damage.
//   Water   = everything within `pull` times the skill's reach is dragged towards that place at pullSpeed and
//             soaked for `soak` seconds (see SOAK); the player is healed `heal` for each, up to healMax.
export const STRIKES = {
  flame: { fireShare: 0.6, fireMin: 1.6, fireTime: 4, fireDps: 16 },
  thunder: { stun: 0.8, boltShare: 0.4 },
  water: { pull: 1.8, pullSpeed: 9, soak: 3, heal: 4, healMax: 20 },
};
// What one of the Mage's skills is called on the skill bar under the style in use (the skill's `el` in the
// class file), or null with a plain weapon.
export function elName(slot) {
  const names = CL.skills[slot].el;
  return style.cur && names ? names[style.cur.id] : null;
}
// Called by a Mage skill at the moment it lands. slot = which skill ('q' 'e' 'r' 'f'); x, y, z =
// where; rad = how far the skill reaches from there; dmg = what it hits for. Does nothing with a plain weapon.
export function skillStrike(slot, x, y, z, rad, dmg) {
  if (!style.cur) return;
  const s = STRIKES[style.cur.id];
  if (style.cur.id === 'flame') {
    const fireRad = Math.max(s.fireMin, rad * s.fireShare);
    addZone(_to.set(x, y, z), fireRad, s.fireTime, s.fireDps);
    spawnGlow(_fx.set(x, y + 0.6, z), 0xff7a1f, fireRad * 1.6, 0.25);
    return;
  }
  const water = style.cur.id === 'water';
  const reachOut = water ? rad * s.pull : rad;
  let reached = 0;
  for (const d of dummies) {
    if (d.dead || d.prop || Math.abs(d.pos.y - y) > 3) continue;
    const dx = x - d.pos.x, dz = z - d.pos.z, dist = Math.hypot(dx, dz);
    if (dist > reachOut) continue;
    reached++;
    if (water) {
      d.soakT = Math.max(d.soakT, s.soak);
      if (!d.fixed && !d.pinned && d.type !== 'flying' && dist > 0.8) {
        d.vel.x += dx / dist * s.pullSpeed;
        d.vel.z += dz / dist * s.pullSpeed;
      }
    } else {
      d.chest(_to);
      spawnBeam(_from.set(_to.x + 0.5, _to.y + 13, _to.z), _to, 0xfff3a0, 0.24, 3.2);    // a bolt out of the sky
      burst(_to, 5, 7, 3);
      setHitSrc(slot);    // for each enemy: a hit can set off effects that change it
      hitDummy(d, dmg * s.boltShare, 0, 0, 2, false, 0.02, P.pos, true);
      if (!d.dead) d.stun(s.stun);
    }
  }
  if (water) {
    spawnRing(_fx.set(x, y + 0.08, z), reachOut, 0.6, 0.45, 0x2f8fff);    // a ring closing in
    heal(Math.min(s.healMax, reached * s.heal));
  }
}
// Used by tests: how many delayed effects are waiting.
export const pendingCount = () => pending.length;
