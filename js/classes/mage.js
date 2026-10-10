// classes/mage.js: Mage, a staff and spells. Slow on foot and with no real jump in the air, but the hardest
// hitter against one target, most of all with the right mouse button: a shot that is charged while a scope
// closes in, aimed by hand, and let go. To get about it has a hover in the air.
// Functions here START a skill. A skill that lasts a while carries on in update.js (the case named after its
// state) and gets its pose in anim.js.
// Progression works as it does for the Blademaster (see blade.js): Q, E and R start locked, every skill has
// three ranks, and the trials that earn them are listed at the bottom, written as data (progress.js counts them).
// Sword styles: the Mage takes them like anyone (R in a pool, Q at a fire, E in a storm: takeWith in styles.js).
// Under one, every missile flies differently (BOLTS below: a slow bursting fireball, a streak that goes
// through enemies, an orb that bends after its target), every hit does what that style's sword does (burning,
// jumping lightning, shorter cooldowns: onStyleHit in styles.js), and each skill adds the style's strike where
// it lands (skillStrike in elements.js) and shows another name (`el` on the skill).
// Owns: the comet waiting to land, and its mark on the ground.
// Used by: update.js (mageShot, mageSnipe, updateMage), player.js (mageBolt for the basic attack, clearMage).

import * as THREE from 'three';
import { V3, lerp, _a, _b, _c, _fx } from '../util.js';
import { scene, camera } from '../core.js';
import { solidMeshes, groundAt } from '../world.js';
import { ringGeo, spawnRing, spawnBeam, spawnGlow, burst, shake } from '../fx.js';
import { T, P, CL, CLASSES, setHitSrc } from '../state.js';
import { dummies, hitDummy, hitArea } from '../dummies.js';
import { fireBolt } from '../projectiles.js';
import { player, setState } from '../player.js';
import { camDir, camFacingYaw, lockTarget, aimPoint, raycaster } from '../camera.js';
import { style, slashColor } from '../styles.js';
import { elName, skillStrike } from '../elements.js';
import { strikeMaster } from '../master.js';

// ---------- how a missile flies ----------
// One row per sword style ('plain' = none). Speeds are units per second (the Mage runs at 8).
//   speed  = how fast it flies.          size = how big it is drawn (1 = normal).
//   turn   = how hard it bends after a locked-on target (higher = tighter).
//   pierce = how many enemies it goes on through after the first.
//   splash = it bursts where it lands, hitting everything within this far for SPLASH_SHARE of its damage (0 = no burst).
//   fall   = seconds between calling a comet and it landing.
//   spark  = which kind of spark it sheds (see burst in fx.js).
const BOLTS = {
  plain: { speed: 46, size: 1, turn: 3, pierce: 0, splash: 0, fall: 0.7, spark: 2 },
  flame: { speed: 34, size: 1.7, turn: 2, pierce: 0, splash: 2.6, fall: 0.8, spark: 0 },       // a fireball: slow, big, and it bursts
  thunder: { speed: 95, size: 0.7, turn: 6, pierce: 2, splash: 0, fall: 0.3, spark: 3 },       // a streak: goes through two more enemies
  water: { speed: 40, size: 1.25, turn: 8, pierce: 0, splash: 0, fall: 0.7, spark: 2 },        // an orb that bends hard: it hardly misses
};
const SPLASH_SHARE = 0.5;
const SNIPE_RANGE = 90;     // how far a sniping shot reaches
const SNIPE_WIDTH = 0.42;   // how close to an enemy's middle the shot has to pass to hit it (a body is about that wide)
const HEAD_HEIGHT = 1.5;    // a shot that lands this far up an enemy or higher is a headshot
const SHOT_GAP = 0.11;      // seconds between the missiles of a Barrage
const COMET_RANGE = 40;     // how far away a comet can be called down
const boltLook = () => BOLTS[style.cur ? style.cur.id : 'plain'];

// The comet that has been called and not yet landed (on = there is one), and the ring that shows where.
const comet = { on: false, pos: new V3(), t: 0, rad: 0, dmg: 0, stun: 0 };
const cometMark = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
cometMark.visible = false;
scene.add(cometMark);

// The top of the staff, where spells leave from.
function staffTip(out) {
  return player.wrist.localToWorld(out.set(0, 0, 1.5));
}
// Send one missile from the staff at the locked-on enemy, or at whatever is under the crosshair.
//   src = which attack it belongs to.  dmg, heavy = its hit.  scale = how big it is next to a plain bolt.
//   landed(p, d) = called when it hits (d = the dummy, or null for a wall).
function missile(src, dmg, heavy, scale, landed) {
  const look = boltLook();
  staffTip(_a);
  aimPoint(_b).sub(_a).normalize();
  return fireBolt(_a, _b, {
    speed: look.speed, life: 2.2, dmg, heavy, src, color: slashColor(), size: look.size * scale, spark: look.spark,
    homing: lockTarget, turn: look.turn, pierce: look.pierce,
    onHit(p, d) {
      if (look.splash > 0) {
        // the fireball bursts: everything close is hit as well, the one it struck included
        const y = d ? d.pos.y : p.pos.y;
        spawnRing(_fx.set(p.pos.x, y + 0.1, p.pos.z), 0.3, look.splash + 0.4, 0.3, 0xff6a1f);
        spawnGlow(p.pos, 0xff7a1f, look.splash * 1.4, 0.25);
        setHitSrc(src);
        hitArea(p.pos.x, y, p.pos.z, look.splash, dmg * SPLASH_SHARE, 4, 3, false, 0.02, true);
      }
      if (landed) landed(p, d);
    },
  });
}
// The basic attack (player.js calls this at the moment each swing of the combo would land): a bolt from the staff.
export function mageBolt() {
  const row = CL.atk[P.atk.combo];
  missile(P.atk.src || 'atk', row.dmg, !!row.heavy, row.heavy ? 1.3 : 1, null);
}
// Stop to cast: face where the camera looks and hold the casting pose for a moment.
function startCast(state) {
  P.atk.on = false;
  P.yaw = P.yawT = camFacingYaw();
  setState(state);
}

// ---------- Mage ----------
// RMB (hold): Arcane Snipe. Raise the staff and take aim: a scope closes in over about a second while the shot
// charges. Let go to fire. Nothing guides it: it goes exactly where the crosshair points, and only what the
// crosshair is on gets hit. The charging itself is the 'aim' case in update.js, which calls mageSnipe on release.
export function mgAim() {
  if (P.state !== 'normal') return;
  P.atk.on = false;
  P.aimK = 0;
  setState('aim');
}
// The shot. P.aimK (0..1) is how far it was charged: the damage runs from the skill's min to its max with it.
// A straight line from the eye through the crosshair, stopped by the first wall. It hits the first enemy on
// that line (under Thunder it goes on through two more), harder for a hit to the head.
export function mageSnipe() {
  const S = CL.skills.m2, look = boltLook(), charge = P.aimK, color = slashColor();
  const full = charge >= 1;
  const dmg = lerp(S.min, S.max, charge);
  P.cd.m2 = S.cd;
  P.castN++;
  setState('cast');
  camDir(_b);
  // The camera sits behind the player, so the line starts there: ignore whatever is nearer than the player is.
  const skip = camera.position.distanceTo(_a.set(P.pos.x, P.pos.y + 1.4, P.pos.z));
  raycaster.set(camera.position, _b);
  raycaster.far = SNIPE_RANGE;
  let reach = SNIPE_RANGE;
  for (const hit of raycaster.intersectObjects(solidMeshes, false)) {
    if (hit.distance < skip) continue;
    reach = hit.distance;
    break;
  }
  // every enemy the line passes through before the wall, nearest first
  const flat = Math.hypot(_b.x, _b.z);
  const onLine = [];
  for (const d of dummies) {
    if (d.dead || flat < 0.05) continue;
    const along = ((d.pos.x - camera.position.x) * _b.x + (d.pos.z - camera.position.z) * _b.z) / (flat * flat);
    if (along < skip || along > reach) continue;
    const x = camera.position.x + _b.x * along, y = camera.position.y + _b.y * along, z = camera.position.z + _b.z * along;
    const height = y - d.pos.y;
    if (Math.hypot(x - d.pos.x, z - d.pos.z) > SNIPE_WIDTH || height < -0.05 || height > 2) continue;
    onLine.push({ d, along, height });
  }
  onLine.sort((one, other) => one.along - other.along);
  const struck = onLine.slice(0, 1 + look.pierce);
  if (struck.length && look.pierce === 0) reach = struck[0].along;    // it stops in the first one, unless it goes through
  for (const { d, height } of struck) {
    const head = height >= HEAD_HEIGHT;
    setHitSrc('m2');    // for each enemy: a hit can set off effects that change it
    hitDummy(d, dmg * (head ? S.head : 1), _b.x * 8 * charge, _b.z * 8 * charge, 0, charge > 0.6, 0.09);
    if (head) spawnGlow(d.chest(_c).setY(d.pos.y + 1.75), 0xffffff, 1.6, 0.2);
    if (look.splash > 0) {
      setHitSrc('m2');
      hitArea(d.pos.x, d.pos.y, d.pos.z, look.splash, dmg * SPLASH_SHARE, 4, 3, false, 0.02, true);    // Flame: it bursts
    }
    if (full) skillStrike('m2', d.pos.x, d.pos.y, d.pos.z, 2.5, dmg);    // a full charge carries the sword style's strike
  }
  // the streak: from the staff to where the shot ended
  staffTip(_a);
  _c.copy(camera.position).addScaledVector(_b, reach);
  spawnBeam(_a, _c, color, 0.22, 2 + charge * 5);
  spawnRing(_fx.copy(_c), 0.2, 1 + charge * 1.5, 0.25, color);
  burst(_c, 6 + Math.round(charge * 14), 9, look.spark);
  shake(0.15 + charge * 0.45);
  return struck.length;
}
// Q: Arcane Lance. One big missile at one enemy: the Mage's hardest single hit.
export function mgLance() {
  const S = CL.skills.q;
  P.cd.q = S.cd;
  P.castN++;    // numbers each use, so a trial can tell one cast from the next
  startCast('cast');
  missile('q', S.dmg, true, 1.6, (p, d) => {
    if (!d) return;
    if (S.refund && d.dead) P.cd.q = 0;    // rank III: a knockout gives the skill straight back
    skillStrike('q', d.pos.x, d.pos.y, d.pos.z, 2.5, S.dmg);    // what the sword style adds (elements.js)
  });
}
// E: Arcane Barrage. Stand and pour a stream of small missiles at one enemy. The stream itself is the
// 'channel' case in update.js, which calls mageShot for each missile.
export function mgBarrage() {
  P.cd.e = CL.skills.e.cd;
  P.castN++;
  startCast('channel');
  P.tick = 0;
  P.shots = 0;
}
// One missile of the Barrage. Returns true once the last one has gone.
export function mageShot() {
  const S = CL.skills.e;
  P.shots++;
  const last = P.shots >= S.shots;
  missile('e', S.dmg, false, 0.75, (p, d) => {
    // only the last missile carries the sword style's strike, or a Barrage would be a dozen of them
    if (d && last) skillStrike('e', d.pos.x, d.pos.y, d.pos.z, 2.5, S.dmg * 3);
  });
  return last;
}
export const BARRAGE_GAP = SHOT_GAP;
// R: Comet. Call something down out of the sky onto the locked-on enemy, or the spot under the crosshair. It
// lands a moment later (updateMage below), so a moving enemy has to be led or held still.
export function mgComet() {
  const S = CL.skills.r;
  P.cd.r = S.cd;
  P.castN++;
  startCast('invoke');
  if (lockTarget) comet.pos.copy(lockTarget.pos); else aimPoint(comet.pos);
  const dx = comet.pos.x - P.pos.x, dz = comet.pos.z - P.pos.z, far = Math.hypot(dx, dz);
  if (far > COMET_RANGE) {
    comet.pos.x = P.pos.x + dx / far * COMET_RANGE;
    comet.pos.z = P.pos.z + dz / far * COMET_RANGE;
  }
  comet.pos.y = groundAt(comet.pos.x, comet.pos.z, comet.pos.y + 0.5);
  comet.on = true;
  comet.t = boltLook().fall;
  comet.rad = S.rad;
  comet.dmg = S.dmg;
  comet.stun = S.stun;
  cometMark.material.color.setHex(slashColor());
  cometMark.visible = true;
}
// The comet lands.
function cometLands() {
  const c = comet.pos, color = slashColor();
  comet.on = false;
  cometMark.visible = false;
  spawnBeam(_a.set(c.x + 3, c.y + 28, c.z + 1), _b.set(c.x, c.y + 0.2, c.z), color, 0.3, 7);
  spawnRing(_fx.set(c.x, c.y + 0.08, c.z), 0.5, comet.rad + 1.5, 0.45, color);
  spawnGlow(_fx.setY(c.y + 1), color, comet.rad * 2.4, 0.35);
  burst(_fx, 30, 14, boltLook().spark);
  shake(0.6);
  strikeMaster(c.x, c.y, c.z, comet.rad);    // calling one down on Master Sen has consequences (master.js)
  setHitSrc('r');
  hitArea(c.x, c.y, c.z, comet.rad, comet.dmg, 6, 9, true, 0.08, true, 0.3);
  if (comet.stun > 0) {
    // rank III: what it lands on is stunned
    for (const d of dummies) {
      if (!d.dead && Math.hypot(d.pos.x - c.x, d.pos.z - c.z) < comet.rad && Math.abs(d.pos.y - c.y) < 3) d.stun(comet.stun);
    }
  }
  skillStrike('r', c.x, c.y, c.z, comet.rad, comet.dmg);    // what the sword style adds (elements.js)
}
// F: Force Nova. A ring of force that throws back everything around the Mage: room to breathe.
export function mgNova() {
  const S = CL.skills.f;
  P.cd.f = S.cd;
  P.castN++;
  startCast('cast');
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.9), 0.5, S.rad, 0.3, slashColor());
  shake(0.3);
  strikeMaster(P.pos.x, P.pos.y, P.pos.z, S.rad);
  setHitSrc('f');
  hitArea(P.pos.x, P.pos.y, P.pos.z, S.rad, S.dmg, S.knock, 6, true, 0.05, true);
  skillStrike('f', P.pos.x, P.pos.y, P.pos.z, S.rad, S.dmg);    // what the sword style adds (elements.js)
}

// Once per frame (update.js): count down the comet that is on its way, and pulse its mark.
export function updateMage(dt) {
  if (!comet.on) return;
  comet.t -= dt;
  cometMark.position.set(comet.pos.x, comet.pos.y + 0.07, comet.pos.z);
  cometMark.scale.setScalar(comet.rad * (0.85 + Math.sin(T * 22) * 0.08));
  if (comet.t <= 0) cometLands();
}
// Forget a comet that has not landed (the player respawned or changed class).
export function clearMage() {
  comet.on = false;
  cometMark.visible = false;
}

// Class definition. The fields are explained in blade.js. More here:
//   hover = seconds the jump in the air holds the Mage up (it has no real second jump).
//   atk   = the three bolts of the basic attack. off and rad are not used (nothing is swung); lunge 0 = no step forward.
//   el    = what the skill is called under each sword style.
CLASSES.mage = {
  id: 'mage', name: 'Mage', color: 0xb07cff, weapon: 'staff', style: 'cast', run: 8, airJumps: 1, hover: 1.6,
  desc: 'A staff and spells. Slow on foot, but nothing hits one enemy harder. Snipes and hovers.', quote: 'Why walk to a fight you can end from here?', lmb: 'Arcane Bolt',
  atk: [
    { dur: 0.30, a0: 0.10, a1: 0.12, dmg: 14, kb: 2, off: 0, rad: 0, lunge: 0 },
    { dur: 0.30, a0: 0.10, a1: 0.12, dmg: 14, kb: 2, off: 0, rad: 0, lunge: 0 },
    { dur: 0.48, a0: 0.18, a1: 0.20, dmg: 30, kb: 6, off: 0, rad: 0, heavy: true, lunge: 0 },
  ],
  skills: {
    // min, max = damage with no charge and with a full one. charge = seconds to charge it fully.
    // head = what a hit to the head is multiplied by.
    m2: { n: 'Arcane Snipe', cd: 4, hold: true, fn: mgAim, min: 30, max: 150, charge: 1.2, head: 1.5 },
    q: {
      n: 'Arcane Lance', fn: mgLance, start: 0, alt: () => elName('q'),
      el: { flame: 'Fireball', thunder: 'Lightning Lance', water: 'Water Lance' },
      lv: [
        { cd: 5, dmg: 70, refund: false },
        { cd: 4.5, dmg: 90, refund: false },
        { cd: 4.5, dmg: 90, refund: true },
      ],
      perks: ['One great missile at one enemy', 'More damage, shorter cooldown', 'A knockout gives the skill straight back'],
    },
    e: {
      n: 'Arcane Barrage', fn: mgBarrage, start: 0, alt: () => elName('e'),
      el: { flame: 'Ember Barrage', thunder: 'Spark Barrage', water: 'Rain Barrage' },
      // dmg = each missile. shots = how many (one every 0.11 s; you stand still while they go)
      lv: [
        { cd: 7, dmg: 12, shots: 6 },
        { cd: 6, dmg: 14, shots: 8 },
        { cd: 6, dmg: 14, shots: 12 },
      ],
      perks: ['Stand and pour a stream of missiles at one enemy', 'More and stronger missiles, shorter cooldown', 'Half as many missiles again'],
    },
    r: {
      n: 'Comet', fn: mgComet, start: 0, alt: () => elName('r'),
      el: { flame: 'Meteor', thunder: 'Thunderbolt', water: 'Tidal Crash' },
      // rad = how wide it lands (small: this is for one enemy). stun = seconds what it lands on is stunned
      lv: [
        { cd: 9, dmg: 110, rad: 3.2, stun: 0 },
        { cd: 8, dmg: 140, rad: 3.2, stun: 0 },
        { cd: 8, dmg: 140, rad: 3.2, stun: 2 },
      ],
      perks: ['Call a comet down on an enemy. It lands a moment later', 'More damage, shorter cooldown', 'What it lands on is stunned'],
    },
    f: {
      n: 'Force Nova', fn: mgNova, start: 1, alt: () => elName('f'),
      el: { flame: 'Fire Nova', thunder: 'Shock Nova', water: 'Tidal Nova' },
      // rad = how far it reaches. knock = how hard it throws them back
      lv: [
        { cd: 5, dmg: 15, rad: 5, knock: 16 },
        { cd: 4, dmg: 22, rad: 5, knock: 16 },
        { cd: 4, dmg: 22, rad: 6.5, knock: 22 },
      ],
      perks: ['Throw back everything around you', 'More damage, shorter cooldown', 'Reaches further and throws harder'],
    },
  },
};

// ---------- trials ----------
// One trial per rank of each skill, written as data: progress.js counts them (see countHit there for what
// count, by, only and when mean). The other fields are explained above the Blademaster's trials in blade.js.
// The three sword style trials are the common ones, added by progress.js.
// All numbers here are first guesses and are meant to be tuned by playing.
CLASSES.mage.trials = [
  { id: 'mage-q1', slot: 'q', rank: 1, name: 'Trial: Arcane Lance', desc: 'Hit all 3 flying dummies with Arcane Lance', time: 75, goal: 3, allow: ['q'], count: 'targets', by: 'q', only: 'flying',
    arena: { spawn: [['flying', -9, 5, -4, { radius: 3 }], ['flying', 9, 6, -4, { radius: 3 }], ['flying', 0, 8, -12, { radius: 4 }]] } },
  { id: 'mage-q2', slot: 'q', rank: 2, name: 'Arcane Lance II', desc: 'Deal 400 damage with Arcane Lance', time: 60, goal: 400, allow: ['q'], count: 'damage', by: 'q',
    arena: { spawn: [['basic', -6, 0, 0], ['basic', 6, 0, 0], ['basic', 0, 0, -8]] } },
  // dummies with only 80 health: one Lance puts one down
  { id: 'mage-q3', slot: 'q', rank: 3, name: 'Arcane Lance III', desc: 'Knock out 4 dummies with Arcane Lance', time: 60, goal: 4, allow: ['q'], count: 'kos', by: 'q',
    arena: { spawn: [['basic', -8, 0, 2, { hp: 80 }], ['basic', 8, 0, 2, { hp: 80 }], ['basic', -5, 0, -10, { hp: 80 }], ['basic', 5, 0, -10, { hp: 80 }]] } },

  { id: 'mage-e1', slot: 'e', rank: 1, name: 'Trial: Arcane Barrage', desc: 'Deal 200 damage with Arcane Barrage', time: 60, goal: 200, allow: ['e'], count: 'damage', by: 'e',
    arena: { spawn: [['basic', -5, 0, 0], ['basic', 5, 0, 0], ['basic', 0, 0, -8]] } },
  { id: 'mage-e2', slot: 'e', rank: 2, name: 'Arcane Barrage II', desc: 'Hit the flying dummies 12 times with Arcane Barrage', time: 75, goal: 12, allow: ['e'], count: 'hits', by: 'e', only: 'flying',
    arena: { spawn: [['flying', -8, 6, -4, { radius: 3 }], ['flying', 8, 7, -4, { radius: 3 }]] } },
  { id: 'mage-e3', slot: 'e', rank: 3, name: 'Arcane Barrage III', desc: 'Deal 450 damage with Arcane Barrage', time: 75, goal: 450, allow: ['e'], count: 'damage', by: 'e',
    arena: { spawn: [['basic', -5, 0, 0], ['basic', 5, 0, 0], ['basic', 0, 0, -8]] } },

  { id: 'mage-r1', slot: 'r', rank: 1, name: 'Trial: Comet', desc: 'Hit 3 dummies with one Comet', time: 60, goal: 3, allow: ['r'], count: 'most', by: 'r',
    arena: { spawn: [['basic', -1.4, 0, 0], ['basic', 1.4, 0, 0], ['basic', 0, 0, -2.2]] } },
  { id: 'mage-r2', slot: 'r', rank: 2, name: 'Comet II', desc: 'Land a Comet on the fighter, twice. It will not stand still for you', time: 120, goal: 2, allow: ['r'], count: 'hits', by: 'r', only: 'fighter',
    arena: { spawn: [['fighter', 0, 0, -4]] } },
  { id: 'mage-r3', slot: 'r', rank: 3, name: 'Comet III', desc: 'Deal 600 damage with Comet', time: 75, goal: 600, allow: ['r'], count: 'damage', by: 'r',
    arena: { spawn: [['basic', -1.4, 0, 0], ['basic', 1.4, 0, 0], ['basic', 0, 0, -2.2]] } },

  { id: 'mage-f2', slot: 'f', rank: 2, name: 'Force Nova II', desc: 'Throw back 4 dummies with one Force Nova', time: 60, goal: 4, allow: ['f'], count: 'most', by: 'f',
    arena: { spawn: [['basic', -3, 0, 0], ['basic', 3, 0, 0], ['basic', 0, 0, -3], ['basic', 0, 0, 3]] } },
  { id: 'mage-f3', slot: 'f', rank: 3, name: 'Force Nova III', desc: "Interrupt a fighter's attack with Force Nova, twice", time: 120, goal: 2, count: 'hits', by: 'f', when: 'interrupt',
    arena: { spawn: [['fighter', 0, 0, -2]] } },
];
