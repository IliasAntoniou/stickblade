// classes/blade.js: Blademaster, sword and grapple hook.
// Functions here START a skill. A skill that lasts a while carries on in update.js (the case named after its state)
// and gets its pose in anim.js.
// This is the first class with progression: Q, E and R start locked and every skill has three ranks, earned through
// the trials listed at the bottom (progress.js runs them). The numbers for each rank are in the class table.

import { _a, _b, _c, _fx } from '../util.js';
import { solidMeshes } from '../world.js';
import { spawnRing, spawnSwirl } from '../fx.js';
import { P, CL, CLASSES, setHitSrc } from '../state.js';
import { dummies, hitDummy } from '../dummies.js';
import { depenetrate, ropeMesh, hookMesh, setState, startAttack, teleTrail } from '../player.js';
import { camDir, camFwdH, facing, camFacingYaw, lockTarget, aimHit, raycaster, setCamYaw } from '../camera.js';
import { inDir, hasIn } from '../update.js';
import { style, slashColor, reach, blinkSource, startTake } from '../styles.js';
import { dojo } from '../dojo.js';

// ---------- Blademaster ----------
// RMB: pull towards the locked dummy, or the wall under the crosshair.
export function bmGrapple() {
  if (P.state === 'grapple') return;
  if (lockTarget && lockTarget.pos.distanceTo(P.pos) < 45) { P.gTarget = lockTarget; lockTarget.chest(P.gPoint); }
  else if (aimHit) { P.gTarget = null; P.gPoint.copy(aimHit); }
  else return;
  P.atk.on = false; setState('grapple'); P.airJumps = P.airJumpsMax;
  ropeMesh.visible = hookMesh.visible = true;
  if (P.grounded) P.vel.y = Math.max(P.vel.y, 6);
}
// Q: teleport behind the locked dummy and strike. With no target, blink 14 units forward.
// Aimed at a lit fire, it blinks into the flames instead, which is how the Flame style is taken (styles.js).
export function bmBlink() {
  const S = CL.skills.q;
  P.cd.q = S.cd;
  _a.copy(P.pos);
  const fire = blinkSource(P.pos, camDir(_b), 14);
  if (fire) {
    teleTrail(_a, fire.pos, 5);
    startTake(fire);
    return;
  }
  if (lockTarget) {
    const d = lockTarget;
    _c.set(d.pos.x - Math.sin(d.yaw) * 1.4, d.pos.y, d.pos.z - Math.cos(d.yaw) * 1.4); // behind the target
    teleTrail(_a, _c);
    P.pos.copy(_c); depenetrate(); P.vel.set(0, 0, 0);
    P.yaw = P.yawT = Math.atan2(d.pos.x - P.pos.x, d.pos.z - P.pos.z);
    setCamYaw(P.yaw + Math.PI);
    setState('blinkStrike');
    startAttack(2); P.atk.hit.add(d);
    P.atk.src = 'q';    // the follow-up swing counts as Blink Strike too
    facing(_b);
    setHitSrc('q');
    hitDummy(d, S.dmg, _b.x * 4, _b.z * 4, 7.5, true, 0.1);
    if (S.refund && d.dead) P.cd.q = 0;    // rank III: a knockout gives the skill straight back
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
// E: spinning dash that hits repeatedly. P.castN numbers each use, so a trial can tell one spin from the next.
export function bmCyclone() {
  P.cd.e = CL.skills.e.cd; P.atk.on = false;
  P.castN++;
  if (hasIn) P.skDir.copy(inDir); else camFwdH(P.skDir);
  setState('cyclone'); P.tick = 0; P.ghostT = 0;
  // the whirlpool: a painted swirl that stays on the player for as long as the spin lasts
  spawnSwirl(P.pos, CL.skills.e.rad * reach(), slashColor(), CL.skills.e.dur + 0.12, 17, 0, P.pos, 1.0);
  P.yaw = P.yawT = Math.atan2(P.skDir.x, P.skDir.z);
}
// R: hop (if on the ground), then dive and blast. P.castY remembers the height it was started from.
export function bmSlam() {
  P.cd.r = CL.skills.r.cd; P.atk.on = false;
  P.castN++;
  P.castY = P.pos.y;
  if (P.grounded) { setState('slamUp'); P.vel.y = 13; } else setState('slamDown');
}
// F: uppercut that launches dummies into the air.
export function bmRising() {
  const S = CL.skills.f;
  P.cd.f = S.cd; P.atk.on = false;
  P.yaw = P.yawT = camFacingYaw(); facing(_a);
  setState('rising'); P.vel.y = 16; P.vel.x *= 0.4; P.vel.z *= 0.4; P.airJumps = P.airJumpsMax;
  const fx = _a.x, fz = _a.z;
  setHitSrc('f');
  for (const d of dummies) {
    if (d.dead) continue;
    const dx = d.pos.x - P.pos.x, dz = d.pos.z - P.pos.z, dist = Math.hypot(dx, dz), dy = d.pos.y - P.pos.y;
    const inFront = (dx * fx + dz * fz) > -0.3;    // rank III hits all around
    if (dist < S.rad && dy > -1.5 && dy < 2.2 && (S.around || inFront)) hitDummy(d, S.dmg, fx * 1.5, fz * 1.5, 17.5, true);
  }
}

// The class definition. run = running speed, airJumps = extra jumps in the air.
// atk = the basic combo, one row per hit: dur = length of the swing (s), a0..a1 = the part of it that can hit,
//   dmg = damage, kb = knockback, off = how far in front the hit is centred, rad = its radius, heavy = finisher, lunge = step forward.
// skills: n = name on the HUD, cd = cooldown (s), fn = runs when the key is pressed,
//   alt = HUD label while a second press does something else, hold = the button is held, not tapped.
// Skills with progression also have:
//   start = the rank a new player has (0 = locked),
//   lv = the skill's numbers at rank I, II and III. The current rank's row is copied onto the skill (applyRanks in progress.js),
//        so code reads CL.skills.q.dmg and always gets the right value. Every row must list every key.
//   perks = what each rank gives, as shown by Master Sen.
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
    q: {
      n: 'Blink Strike', fn: bmBlink, start: 0,
      lv: [
        { cd: 4, dmg: 34, refund: false },
        { cd: 3.5, dmg: 44, refund: false },
        { cd: 3.5, dmg: 44, refund: true },
      ],
      perks: ['Teleport behind a target and strike', 'More damage, shorter cooldown', 'A knockout gives the skill straight back'],
    },
    e: {
      n: 'Cyclone', fn: bmCyclone, start: 0,
      // dmg = per hit (one hit every 0.075 s), rad = reach, dur = how long the spin lasts (s)
      lv: [
        { cd: 5, dmg: 8, rad: 2.9, dur: 0.45 },
        { cd: 5, dmg: 10, rad: 3.3, dur: 0.45 },
        { cd: 5, dmg: 10, rad: 3.3, dur: 0.7 },
      ],
      perks: ['Spinning dash that hits everything it passes', 'More damage, wider reach', 'The spin lasts longer and travels further'],
    },
    r: {
      n: 'Meteor Slam', fn: bmSlam, start: 0,
      // rad = blast radius, stun = seconds fighters are stunned
      lv: [
        { cd: 6, dmg: 55, rad: 7.5, stun: 0 },
        { cd: 6, dmg: 70, rad: 9, stun: 0 },
        { cd: 6, dmg: 70, rad: 9, stun: 2 },
      ],
      perks: ['Dive down and blast everything around', 'More damage, bigger blast', 'The blast stuns fighters'],
    },
    f: {
      n: 'Rising Slash', fn: bmRising, start: 1,
      // around = hits behind you as well
      lv: [
        { cd: 3, dmg: 20, rad: 3.4, around: false },
        { cd: 2.5, dmg: 28, rad: 3.4, around: false },
        { cd: 2.5, dmg: 28, rad: 4.4, around: true },
      ],
      perks: ['Uppercut that launches dummies', 'More damage, shorter cooldown', 'Wider, and hits all around you'],
    },
  },
};

// ---------- trials ----------
// One trial per rank of each skill. progress.js runs them; Master Sen offers the next one for each skill.
//   slot, rank = which skill, and the rank passing it gives.   time = seconds allowed.   goal = the number st.n must reach.
//   allow = the only hit sources that can damage dummies during the trial ('q' 'e' 'r' 'f' = skills, 'atk' = basic attack).
//           Leave it out to allow everything.
//   onHit(st, ev) runs for every hit that lands. ev = { d (the dummy), dmg, src, ko, targetAir, interrupted }.
//   tick(st, dt) runs every frame (optional).   st is the trial's own scratch space; st.n is the progress shown on screen.
//   arena = how the training hall is dressed for the trial (dojo.js builds it): props = boxes [x, y, z, width, height, depth, colour],
//           spawn = dummies [type, x, y, z, options], start = where the player begins. Coordinates are relative to the centre
//           of the hall; the player normally starts at z = 18 looking towards -z; y is the bottom of a box.
// A rank-I trial lends the skill for its duration. All numbers here are first guesses and are meant to be tuned by playing.

// How many different dummies the current use of a skill has hit so far.
function hitsThisCast(st, ev) {
  if (st.cast !== P.castN) { st.cast = P.castN; st.seen = new Set(); }
  st.seen.add(ev.d);
  return st.seen.size;
}
function countFlying(st, ev) {
  if (ev.src !== 'q' || ev.d.type !== 'flying') return;
  st.seen.add(ev.d);
  st.n = st.seen.size;
}
function mostInOneCyclone(st, ev) {
  if (ev.src === 'e') st.n = Math.max(st.n, hitsThisCast(st, ev));
}
function cycloneDamage(st, ev) {
  if (ev.src === 'e') st.n += ev.dmg;
}
function mostInOneSlam(st, ev) {
  if (ev.src === 'r') st.n = Math.max(st.n, hitsThisCast(st, ev));
}
// Air combo: Rising Slash picks the target, then every further hit on it counts until it lands.
function airCombo(st, ev) {
  if (ev.src === 'f') { st.target = ev.d; st.count = 0; st.air = 0; }
  else if (ev.d === st.target) { st.count++; st.n = Math.max(st.n, st.count); }
}
function airComboTick(st, dt) {
  if (!st.target) return;
  st.air += dt;
  const landed = st.air > 0.3 && st.target.grounded;    // the 0.3 s gives the launch time to lift it off the ground
  if (landed || st.target.dead) st.target = null;
}

// Sword style trials: counts how many dummies one swing of the sword hits while Water is active.
function mostInOneWaterSwing(st, ev) {
  if (ev.src !== 'atk' || !style.cur || style.cur.id !== 'water') return;
  if (st.swing !== P.atk.n) { st.swing = P.atk.n; st.seen = new Set(); }
  st.seen.add(ev.d);
  st.n = Math.max(st.n, st.seen.size);
}

// A trial with `style` unlocks that sword style (styles.js) where the others raise a skill's rank.
//   needs = skill ranks that must already be earned, for example { r: 1 } = Meteor Slam learned.
//   arena.sources = the style objects to place in the hall: [style id, x, z].
// The style can be taken from its source during its own trial, which is how the trial teaches it.
CLASSES.blade.trials = [
  { id: 'blade-water', style: 'water', needs: { r: 1 }, name: 'Trial: Water style', desc: 'Meteor Slam into the pool to take Water, then hit 4 dummies with one swing of your sword', time: 60, goal: 4,
    onHit: mostInOneWaterSwing,
    // four dummies in a row, a little too wide for a plain swing: only Water's longer reach catches all of them
    arena: { sources: [['water', 0, 9]], spawn: [['basic', -2.55, 0, -2.9], ['basic', -0.85, 0, -2.9], ['basic', 0.85, 0, -2.9], ['basic', 2.55, 0, -2.9]] } },
  { id: 'blade-flame', style: 'flame', needs: { q: 1 }, name: 'Trial: Flame style', desc: 'Blink Strike into the fire to take Flame, then have 3 dummies burning at the same time', time: 60, goal: 3,
    tick(st) { st.n = dojo.spawned.filter(d => d.burnT > 0 && !d.dead).length; },
    // spread out, so all three have to be reached before the first stops burning
    arena: { sources: [['flame', 0, 12]], spawn: [['basic', -7, 0, -3], ['basic', 0, 0, -8], ['basic', 7, 0, -3]] } },

  { id: 'blade-q1', slot: 'q', rank: 1, name: 'Trial: Blink Strike', desc: 'Land Blink Strike on all 3 flying dummies', time: 60, goal: 3, allow: ['q'], onHit: countFlying,
    arena: { spawn: [['flying', -10, 6, -4, { radius: 4 }], ['flying', 10, 8, -4, { radius: 4 }], ['flying', 0, 11, -14, { radius: 5 }]],
      props: [[-15, 0, -12, 3, 14, 3, 'pillar'], [15, 0, -12, 3, 14, 3, 'pillar']] } },
  { id: 'blade-q2', slot: 'q', rank: 2, name: 'Blink Strike II', desc: "Interrupt a fighter's attack with Blink Strike, twice", time: 120, goal: 2,
    onHit(st, ev) { if (ev.src === 'q' && ev.interrupted) st.n++; },
    arena: { spawn: [['fighter', 0, 0, -2]], props: [[-8, 0, 4, 2, 2, 2, 'crate'], [9, 0, -8, 2, 1.4, 3, 'crate']] } },
  { id: 'blade-q3', slot: 'q', rank: 3, name: 'Blink Strike III', desc: 'Land Blink Strike on all 4 flying dummies, fast', time: 25, goal: 4, allow: ['q'], onHit: countFlying,
    arena: { spawn: [['flying', -14, 7, 0, { radius: 3 }], ['flying', 14, 7, 0, { radius: 3 }], ['flying', -8, 13, -16, { radius: 4 }], ['flying', 8, 13, -16, { radius: 4 }]],
      props: [[0, 0, -8, 3, 16, 3, 'pillar']] } },

  { id: 'blade-e1', slot: 'e', rank: 1, name: 'Trial: Cyclone', desc: 'Hit 3 dummies with a single Cyclone', time: 45, goal: 3, allow: ['e'], onHit: mostInOneCyclone,
    arena: { spawn: [['basic', -3, 0, -2], ['basic', 0, 0, -2], ['basic', 3, 0, -2]] } },
  { id: 'blade-e2', slot: 'e', rank: 2, name: 'Cyclone II', desc: 'Deal 600 damage using only Cyclone', time: 30, goal: 600, allow: ['e'], onHit: cycloneDamage,
    arena: { spawn: [['basic', -3, 0, 2], ['basic', 0, 0, 2], ['basic', 3, 0, 2], ['basic', -3, 0, -12], ['basic', 0, 0, -12], ['basic', 3, 0, -12]] } },
  { id: 'blade-e3', slot: 'e', rank: 3, name: 'Cyclone III', desc: 'Deal 800 damage using only Cyclone. The shield blocks from the front', time: 30, goal: 800, allow: ['e'], onHit: cycloneDamage,
    arena: { spawn: [['basic', -5, 0, -2], ['basic', -2.5, 0, -2], ['shield', 0, 0, -2], ['basic', 2.5, 0, -2], ['basic', 5, 0, -2]] } },

  { id: 'blade-r1', slot: 'r', rank: 1, name: 'Trial: Meteor Slam', desc: 'Start a slam at least 5 high and hit 3 dummies with it', time: 75, goal: 3, allow: ['r'],
    onHit(st, ev) { if (P.castY - P.pos.y >= 5) mostInOneSlam(st, ev); },
    // a step up to a platform, with the dummies on the floor in front of it
    arena: { start: [0, 0, 20], props: [[0, 0, 14, 4, 2.5, 4, 'crate'], [0, 5, 8, 6, 0.8, 6, 'plat']],
      spawn: [['basic', -2.5, 0, 0], ['basic', 2.5, 0, 0], ['basic', 0, 0, -3]] } },
  { id: 'blade-r2', slot: 'r', rank: 2, name: 'Meteor Slam II', desc: 'Hit all 3 dummies and the fighter with one slam', time: 90, goal: 4, allow: ['r'], onHit: mostInOneSlam,
    arena: { spawn: [['basic', 0, 0, -7], ['basic', -4.3, 0, 0.5], ['basic', 4.3, 0, 0.5], ['fighter', 0, 0, -13]] } },
  { id: 'blade-r3', slot: 'r', rank: 3, name: 'Meteor Slam III', desc: 'Hit all 3 dummies and both fighters with one slam', time: 120, goal: 5, allow: ['r'], onHit: mostInOneSlam,
    arena: { spawn: [['basic', 0, 0, -8], ['basic', -5.2, 0, 1], ['basic', 5.2, 0, 1], ['fighter', -10, 0, -13], ['fighter', 10, 0, -13]] } },

  { id: 'blade-f2', slot: 'f', rank: 2, name: 'Rising Slash II', desc: 'Launch the dummy, then hit it 6 more times before it lands', time: 90, goal: 6, onHit: airCombo, tick: airComboTick,
    arena: { spawn: [['basic', 0, 0, 0]] } },
  { id: 'blade-f3', slot: 'f', rank: 3, name: 'Rising Slash III', desc: 'Launch the fighter, then hit it 8 more times before it lands', time: 120, goal: 8, onHit: airCombo, tick: airComboTick,
    arena: { spawn: [['fighter', 0, 0, -2]] } },
];
