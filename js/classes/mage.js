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
// it lands (skillStrike in elements.js; Force Nova has its own, NOVA below) and shows another name (`el` on the skill).
// Owns: the conjured crossbow (and archer) and machine gun, the comet waiting to land, and its mark on the ground.
// Used by: update.js (mageShot, mageSnipe, updateMage), player.js (mageBolt for the basic attack, clearMage).

import * as THREE from 'three';
import { V3, clamp, lerp, _a, _b, _c, _fx } from '../util.js';
import { scene, camera } from '../core.js';
import { makeStickman, applyPose, BASE } from '../stickman.js';
import { solidMeshes, groundAt } from '../world.js';
import { ringGeo, spawnRing, spawnSwirl, spawnBeam, spawnGlow, burst, shake } from '../fx.js';
import { T, P, CL, CLASSES, setHitSrc } from '../state.js';
import { dummies, hitDummy, hitArea } from '../dummies.js';
import { fireBolt } from '../projectiles.js';
import { player, setState } from '../player.js';
import { camDir, camFacingYaw, lockTarget, aimPoint, raycaster } from '../camera.js';
import { style, slashColor } from '../styles.js';
import { elName, skillStrike } from '../elements.js';
import { master, strikeMaster } from '../master.js';

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
  flame: { speed: 34, size: 1.7, turn: 2, pierce: 0, splash: 2.6, fall: 0.8, spark: 0 },       // fire: slow, big, and it bursts
  thunder: { speed: 95, size: 0.7, turn: 6, pierce: 2, splash: 0, fall: 0.3, spark: 3 },       // a streak: goes through two more enemies
  water: { speed: 40, size: 1.25, turn: 8, pierce: 0, splash: 0, fall: 0.7, spark: 2 },        // an orb that bends hard: it hardly misses
};
const SPLASH_SHARE = 0.5;
const SNIPE_RANGE = 90;     // how far a sniping shot reaches
// An enemy's size for the sniping shot, for one drawn at normal size. Bigger enemies (a brute, a boss) are
// drawn scaled up, and these are scaled with them, or a shot at a brute's head would pass over it.
const SNIPE_WIDTH = 0.42;   // how close to an enemy's middle the shot has to pass to hit it (a body is about that wide)
const BODY_HEIGHT = 2.05;   // the top of its head
const HEAD_HEIGHT = 1.5;    // a shot that lands this far up it or higher is a headshot
const SEN_WIDTH = 0.75, SEN_HEIGHT = 3.2;    // how wide and how tall Master Sen is, for a shot at him
const SHOT_GAP = 0.11;      // seconds between the missiles of a Barrage
const COMET_RANGE = 40;     // how far away a comet can be called down
const boltLook = () => BOLTS[style.cur ? style.cur.id : 'plain'];

// What Q conjures to loose its arrow: 'crossbow' (a big crossbow of light that hangs in the air above and in
// front of the Mage) or 'archer' (a figure of light that steps out beside the Mage, draws a longbow and
// shoots). Both are kept so that either can be tried: change this one word.
export const CONJURE = 'crossbow';
// The conjured thing: on = it is out, t = seconds since it appeared, loosed = its arrow has gone.
const bow = { on: false, t: 0, loosed: false };
// How long each takes to draw before the arrow leaves (seconds), how long it takes to fade afterwards, and
// how big the crossbow is drawn (1 = about a metre long). Long enough for the draw to be seen.
const BOW_DRAW = 0.3;
const BOW_FADE = 0.4;
const BOW_SIZE = 2.6;
// Where the crossbow hangs, measured from the Mage's feet: this far ahead and this high. Above the head and
// out in front, so that it is in plain view over the Mage's shoulder and not hidden behind the body.
const BOW_AHEAD = 1.7, BOW_UP = 2.7;
// Where the archer stands, measured from the Mage: this far to the left, and this far ahead.
const ARCHER_SIDE = 1.5, ARCHER_AHEAD = 0.5;
// Everything conjured is made of light: one glowing see-through material for the crossbow, the archer and
// its longbow, so they take the sword style's colour and fade together.
const bowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
// The crossbow, built pointing along +z: a stock, two swept-back limbs, a string (in a group of its own, so it
// can be drawn back), and a ring of light at the muzzle that spins.
const bowModel = new THREE.Group();
const bowString = new THREE.Group();
const bowRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 24), bowMat);
{
  bowModel.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 1.0), bowMat));
  for (const side of [1, -1]) {
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.06), bowMat);
    limb.position.set(0.27 * side, 0, 0.3);
    limb.rotation.y = 0.5 * side;    // swept back from the middle
    bowModel.add(limb);
    // each half of the string: from the tip of a limb to the middle
    const half = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.015, 0.015), bowMat);
    half.position.set(0.27 * side, 0, 0.16);
    bowString.add(half);
  }
  bowRing.position.z = 0.56;
  bowModel.add(bowString, bowRing);
  bowModel.visible = false;
  scene.add(bowModel);
}
// The archer: a stick figure of light, and the longbow it holds. The longbow is built upright, shooting along
// +z: a grip, two limbs that sweep back towards the archer, and a string in a group of its own.
const archer = makeStickman(bowMat, null, false);
archer.root.visible = false;
scene.add(archer.root);
const longbow = new THREE.Group();
const longString = new THREE.Group();
{
  longbow.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), bowMat));
  for (const side of [1, -1]) {
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.66, 0.05), bowMat);
    limb.position.set(0, 0.45 * side, -0.1);
    limb.rotation.x = 0.32 * side;    // the tips lean back
    longbow.add(limb);
    const half = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.74, 0.014), bowMat);
    half.position.set(0, 0.37 * side, -0.21);
    longString.add(half);
  }
  longbow.add(longString);
  longbow.visible = false;
  scene.add(longbow);
}
// The archer's poses: reaching for the string, at full draw (the string hand back at the cheek), and just
// after the arrow has gone (the string hand flung open behind). The bow arm stays straight out throughout.
const ARCHER_STANCE = { ...BASE, spineY: 0.5, hipLX: -0.3, kneeL: 0.25, hipRX: 0.35, kneeR: 0.2, shLX: -1.55, shLZ: -0.05, elL: 0 };
const ARCHER_REACH = { ...ARCHER_STANCE, shRX: -1.45, shRZ: 0.1, elR: -0.3 };
const ARCHER_DRAWN = { ...ARCHER_STANCE, shRX: -1.45, shRZ: -0.35, elR: -2.3 };
const ARCHER_LOOSED = { ...ARCHER_STANCE, shRX: -1.0, shRZ: -0.9, elR: -0.6 };
const archerPose = { ...ARCHER_REACH };
const _aim = new V3(), _hand = new V3();
// The conjured machine gun (Arcane Barrage): on = it is out, t = seconds since it appeared, fade = seconds since
// the Barrage ended (below 0 while it is still firing), spin = how far its barrels have turned.
const gun = { on: false, t: 0, fade: -1, spin: 0 };
const GUN_FADE = 0.35;      // seconds it takes to fade away after the last missile
const GUN_SIZE = 1.6;       // how big it is drawn (1 = barrels about a metre long)
// Where it hangs, measured from the Mage's feet: this far ahead, this far to the right, and this high.
const GUN_AHEAD = 1.3, GUN_SIDE = 0.75, GUN_UP = 1.55;
const GUN_MUZZLE = 0.95;    // how far in front of its middle the missiles leave from (before GUN_SIZE)
// It is made of light, like the crossbow, but in a material of its own so the two can fade separately. Built
// pointing along +z: a body, a ring of six barrels in a group of their own (so they can spin), a band round
// the muzzle, and a drum of missiles underneath.
const gunMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const gunModel = new THREE.Group();
const gunBarrels = new THREE.Group();
{
  gunModel.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.5).translate(0, 0, -0.35), gunMat));
  const barrel = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6).rotateX(Math.PI / 2).translate(0, 0, 0.4);
  for (let i = 0; i < 6; i++) {
    const one = new THREE.Mesh(barrel, gunMat);
    const turn = i / 6 * Math.PI * 2;
    one.position.set(Math.cos(turn) * 0.09, Math.sin(turn) * 0.09, 0);
    gunBarrels.add(one);
  }
  gunBarrels.add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 16).translate(0, 0, 0.85), gunMat));
  gunBarrels.add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 16).translate(0, 0, 0.3), gunMat));
  gunModel.add(gunBarrels);
  gunModel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 10).rotateZ(Math.PI / 2).translate(0, -0.24, -0.3), gunMat));
  gunModel.visible = false;
  scene.add(gunModel);
}
// The comet that has been called and not yet landed (on = there is one), and the ring that shows where.
const comet = { on: false, pos: new V3(), t: 0, rad: 0, dmg: 0, stun: 0 };
const cometMark = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
cometMark.visible = false;
scene.add(cometMark);

// The top of the staff, where spells leave from.
function staffTip(out) {
  return player.wrist.localToWorld(out.set(0, 0, 1.5));
}
// The point a spell should be sent at: the locked-on enemy, or whatever is under the crosshair. That is
// aimPoint (camera.js) with one addition: Master Sen. He is neither an enemy nor a rock, so aimPoint looks
// straight through him to whatever is behind, and a missile that starts off to one side (the archer's arrow)
// would pass him by. If the crosshair is on him, and he is nearer than what aimPoint found, the point is on
// him, and onSen is set so that the missile is not bent away after an enemy behind him.
const _look = new V3();
let onSen = false;
function castPoint(out) {
  aimPoint(out);
  onSen = false;
  camDir(_look);
  const flat = Math.hypot(_look.x, _look.z);
  if (flat < 0.05) return out;
  const along = ((master.pos.x - camera.position.x) * _look.x + (master.pos.z - camera.position.z) * _look.z) / (flat * flat);
  if (along < 1 || along > camera.position.distanceTo(out)) return out;
  const x = camera.position.x + _look.x * along, y = camera.position.y + _look.y * along, z = camera.position.z + _look.z * along;
  if (Math.hypot(x - master.pos.x, z - master.pos.z) > SEN_WIDTH || y < master.pos.y || y > master.pos.y + SEN_HEIGHT) return out;
  onSen = true;
  return out.set(x, y, z);
}
// Send one missile at the locked-on enemy, or at whatever is under the crosshair.
//   src = which attack it belongs to.  dmg, heavy = its hit.  scale = how big it is next to a plain bolt.
//   landed(p, d) = called when it hits (d = the dummy, or null for a wall).
//   from = where it leaves from (left out: the top of the staff).  arrow = draw it as an arrow (the crossbow's).
function missile(src, dmg, heavy, scale, landed, from = null, arrow = false) {
  const look = boltLook();
  if (from) _a.copy(from); else staffTip(_a);
  castPoint(_b).sub(_a).normalize();
  return fireBolt(_a, _b, {
    speed: look.speed, life: 2.2, dmg, heavy, src, color: slashColor(), size: look.size * scale, spark: look.spark,
    homing: onSen ? null : lockTarget, turn: look.turn, pierce: look.pierce, arrow, wisps: arrow && !!style.cur,
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
    const size = d.sm.root.scale.y;    // how big it is drawn: 1 for a practice dummy, 1.16 for a brute, more for a boss
    const height = (y - d.pos.y) / size;    // how far up its body, as if it were normal size
    if (Math.hypot(x - d.pos.x, z - d.pos.z) > SNIPE_WIDTH * size || height < -0.05 || height > BODY_HEIGHT) continue;
    onLine.push({ d, along, height });
  }
  onLine.sort((one, other) => one.along - other.along);
  const struck = onLine.slice(0, 1 + look.pierce);
  if (struck.length && look.pierce === 0) reach = struck[0].along;    // it stops in the first one, unless it goes through
  // Master Sen can be shot too, if the line gets as far as him. It does him no harm, and he answers it as he
  // answers any other blow (master.js): a warning the first time.
  if (flat >= 0.05) {
    const along = ((master.pos.x - camera.position.x) * _b.x + (master.pos.z - camera.position.z) * _b.z) / (flat * flat);
    const x = camera.position.x + _b.x * along, y = camera.position.y + _b.y * along, z = camera.position.z + _b.z * along;
    const height = y - master.pos.y;
    if (along > skip && along <= reach && Math.hypot(x - master.pos.x, z - master.pos.z) < SEN_WIDTH && height > 0 && height < SEN_HEIGHT) {
      if (look.pierce === 0) reach = along;
      strikeMaster(master.pos.x, master.pos.y, master.pos.z, 0.1);
    }
  }
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
// Q: Arcane Crossbow. A big crossbow made of light appears in the air above and in front of the Mage, draws,
// and looses one great arrow at one enemy: the Mage's hardest single hit. (With CONJURE set to 'archer' it is
// an archer of light at the Mage's side that does it.) Under a sword style the archer takes its colour and the arrow
// is wrapped in the same wisps that run along the Blademaster's sword.
// This only conjures it; updateBow (below) holds it in place, looses the arrow, and lets it fade.
export function mgCrossbow() {
  const S = CL.skills.q;
  P.cd.q = S.cd;
  P.castN++;    // numbers each use, so a trial can tell one cast from the next
  startCast('bow');
  bow.on = true;
  bow.t = 0;
  bow.loosed = false;
  bowMat.color.setHex(slashColor());
  bowMat.opacity = 0.9;
  if (CONJURE === 'archer') {
    archer.root.visible = true;
    longbow.visible = true;
    placeArcher(-BOW_DRAW);
    spawnRing(_fx.copy(archer.root.position).setY(archer.root.position.y + 0.06), 0.2, 1.6, 0.3, slashColor());
  } else bowModel.visible = true;
}
// Take away whatever was conjured.
function dismissBow() {
  bow.on = false;
  bowModel.visible = false;
  archer.root.visible = false;
  longbow.visible = false;
}
// The arrow leaves the bow. from = where the bow is.
function looseArrow(from) {
  const S = CL.skills.q;
  bow.loosed = true;
  spawnRing(_fx.copy(from), 0.2, 1.4, 0.2, slashColor());
  shake(0.25);
  missile('q', S.dmg, true, 1.6, (p, d) => {
    if (!d) return;
    if (S.refund && d.dead) P.cd.q = 0;    // rank III: a knockout gives the skill straight back
    skillStrike('q', d.pos.x, d.pos.y, d.pos.z, 2.5, S.dmg);    // what the sword style adds (elements.js)
  }, from, true);
}
// The crossbow: hanging in the air above and in front of the Mage, pointing at the target.
// after = seconds since the arrow went (negative while still drawing). Returns where it is.
function placeCrossbow(after) {
  const kick = after > 0 ? Math.max(0, 0.5 - after * 2.5) : 0;    // it jumps back as it looses
  const ahead = BOW_AHEAD - kick;
  bowModel.position.set(P.pos.x + Math.sin(P.yaw) * ahead, P.pos.y + BOW_UP, P.pos.z + Math.cos(P.yaw) * ahead);
  bowModel.lookAt(castPoint(_aim));
  bowModel.scale.setScalar(Math.min(1, bow.t / 0.08) * BOW_SIZE);    // it grows out of nothing in a blink
  bowRing.rotation.z += 0.15;
  // the string is drawn back further and further, then snaps forward
  bowString.position.z = after < 0 ? -0.34 * (1 + after / BOW_DRAW) : 0;
  return bowModel.position;
}
// The archer: standing to the Mage's left, turned towards the target, drawing and then loosing. after = seconds
// since the arrow went (negative while still drawing). Returns where its bow is.
function placeArcher(after) {
  const root = archer.root;
  root.position.set(P.pos.x + Math.cos(P.yaw) * ARCHER_SIDE + Math.sin(P.yaw) * ARCHER_AHEAD, P.pos.y, P.pos.z - Math.sin(P.yaw) * ARCHER_SIDE + Math.cos(P.yaw) * ARCHER_AHEAD);
  castPoint(_aim);
  root.rotation.y = Math.atan2(_aim.x - root.position.x, _aim.z - root.position.z);
  root.scale.setScalar(Math.min(1, bow.t / 0.08));    // it rises out of nothing in a blink
  // the string hand: from reaching forward to full draw, then flung open once the arrow has gone
  const drawn = clamp(1 + after / BOW_DRAW, 0, 1);
  const from = after < 0 ? ARCHER_REACH : ARCHER_DRAWN, to = after < 0 ? ARCHER_DRAWN : ARCHER_LOOSED;
  const blend = after < 0 ? drawn : clamp(after / 0.08, 0, 1);
  for (const key in archerPose) archerPose[key] = lerp(from[key], to[key], blend);
  applyPose(archer, archerPose);
  root.updateMatrixWorld(true);
  // the longbow sits in the bow hand, upright, pointing at the target
  archer.handL.getWorldPosition(_hand);
  longbow.position.copy(_hand);
  longbow.lookAt(_aim);
  longbow.scale.copy(root.scale);
  longString.position.z = after < 0 ? -0.42 * drawn : 0;
  return longbow.position;
}
// Every frame while something conjured is out: hold it in place, loose the arrow when it is drawn, then let it fade.
function updateBow(dt) {
  bow.t += dt;
  // being hit or dashing away before the arrow is loosed breaks the spell: it is gone and no arrow flies
  if (!bow.loosed && P.state !== 'bow') {
    dismissBow();
    return;
  }
  const after = bow.t - BOW_DRAW;
  const from = CONJURE === 'archer' ? placeArcher(after) : placeCrossbow(after);
  bowMat.opacity = after < 0 ? 0.9 : 0.9 * Math.max(0, 1 - after / BOW_FADE);
  if (!bow.loosed && after >= 0) looseArrow(from);
  if (after > BOW_FADE) dismissBow();
}
// E: Arcane Barrage. A machine gun made of light appears beside the Mage and pours a stream of small missiles
// at one enemy while the Mage stands and directs it. The stream itself is the
// 'channel' case in update.js, which calls mageShot for each missile.
export function mgBarrage() {
  P.cd.e = CL.skills.e.cd;
  P.castN++;
  startCast('channel');
  P.tick = 0;
  P.shots = 0;
  // the machine gun of light that does the firing: it appears beside the Mage and stays until the stream ends
  gun.on = true;
  gun.t = 0;
  gun.fade = -1;
  gunMat.color.setHex(slashColor());
  gunMat.opacity = 0.9;
  gunModel.visible = true;
  placeGun();
}
// Hold the machine gun in its place beside the Mage, pointing at the target. Writes where its muzzle is into _c.
function placeGun() {
  gunModel.position.set(
    P.pos.x + Math.sin(P.yaw) * GUN_AHEAD - Math.cos(P.yaw) * GUN_SIDE,
    P.pos.y + GUN_UP,
    P.pos.z + Math.cos(P.yaw) * GUN_AHEAD + Math.sin(P.yaw) * GUN_SIDE);
  gunModel.lookAt(castPoint(_aim));
  gunModel.scale.setScalar(Math.min(1, gun.t / 0.08 + 0.2) * GUN_SIZE);    // it grows out of nothing in a blink
  gunBarrels.rotation.z = gun.spin;
  gunModel.updateMatrixWorld(true);
  return gunModel.localToWorld(_c.set(0, 0, GUN_MUZZLE));
}
// Every frame while the machine gun is out: its barrels spin (fast while it fires, running down afterwards),
// and once the Barrage is over it fades away.
function updateGun(dt) {
  gun.t += dt;
  const firing = P.state === 'channel';
  if (!firing && gun.fade < 0) gun.fade = 0;
  if (gun.fade >= 0) gun.fade += dt;
  const left = gun.fade < 0 ? 1 : Math.max(0, 1 - gun.fade / GUN_FADE);
  gun.spin += dt * 34 * left;
  gunMat.opacity = 0.9 * left;
  placeGun();
  if (left <= 0) {
    gun.on = false;
    gunModel.visible = false;
  }
}
// One missile of the Barrage. Returns true once the last one has gone.
export function mageShot() {
  const S = CL.skills.e;
  P.shots++;
  const last = P.shots >= S.shots;
  // it leaves from the muzzle of the machine gun, with a flash
  const muzzle = placeGun();
  spawnGlow(muzzle, slashColor(), 1.1, 0.08);
  missile('e', S.dmg, false, 0.75, (p, d) => {
    // only the last missile carries the sword style's strike, or a Barrage would be a dozen of them
    if (d && last) skillStrike('e', d.pos.x, d.pos.y, d.pos.z, 2.5, S.dmg * 3);
  }, muzzle);
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
// F: Force Nova. The Mage's way out: the staff is driven into the ground and a ring of force hurls back
// everything around. It is meant to make room, not to hurt: the damage is small on purpose, so that the Mage
// stays a class that kills one enemy at a time.
// A sword style changes what kind of room it makes (NOVA below) and nothing else: this skill does not get the
// style's usual strike, because fire on the ground or a bolt on everyone would make it an attack on a crowd.
//   Flame   = everything thrown is singed: it burns, but only for `singe` seconds.
//   Thunder = everything thrown is stunned for `stun` seconds longer.
//   Water   = a wave: it throws `knock` times as hard, and soaks what it throws for `soak` seconds.
const NOVA = {
  flame: { singe: 1 },
  thunder: { stun: 0.8 },
  water: { knock: 1.3, soak: 3 },
};
const NOVA_LIFT = 8;    // upward speed given to what is thrown: off the ground it flies much further
export function mgNova() {
  const S = CL.skills.f, color = slashColor();
  const element = style.cur ? NOVA[style.cur.id] : null;
  const knock = S.knock * (element && element.knock ? element.knock : 1);
  P.cd.f = S.cd;
  P.castN++;
  startCast('smack');
  _fx.copy(P.pos).setY(P.pos.y + 0.08);
  spawnRing(_fx, 0.5, S.rad + 1, 0.4, color);
  spawnSwirl(_fx.setY(P.pos.y + 0.12), S.rad * 0.5, color, 0.45, 2.5, 1);    // a painted wave rolling outwards
  burst(_fx.setY(P.pos.y + 0.3), 18, 12, boltLook().spark);
  shake(0.5);
  strikeMaster(P.pos.x, P.pos.y, P.pos.z, S.rad);
  setHitSrc('f');
  hitArea(P.pos.x, P.pos.y, P.pos.z, S.rad, S.dmg, knock, NOVA_LIFT, true, 0.05, true);
  // what was thrown: the ones hit this very frame
  for (const d of dummies) {
    if (d.dead || d.sinceHit !== 0 || Math.hypot(d.pos.x - P.pos.x, d.pos.z - P.pos.z) > S.rad + 0.5) continue;
    d.stun(S.stun + (element && element.stun ? element.stun : 0));
    if (element && element.singe) d.burnT = Math.min(d.burnT, element.singe);
    if (element && element.soak) d.soakT = Math.max(d.soakT, element.soak);
  }
}

// The conjured models, for tests.
export const mageModels = { bow: bowModel, archer: archer.root, gun: gunModel };
// Once per frame (update.js): work the crossbow and the machine gun if they are out, count down the comet that is on its way, and pulse its mark.
export function updateMage(dt) {
  if (bow.on) updateBow(dt);
  if (gun.on) updateGun(dt);
  if (!comet.on) return;
  comet.t -= dt;
  cometMark.position.set(comet.pos.x, comet.pos.y + 0.07, comet.pos.z);
  cometMark.scale.setScalar(comet.rad * (0.85 + Math.sin(T * 22) * 0.08));
  if (comet.t <= 0) cometLands();
}
// Forget a comet that has not landed and anything conjured that is still out (the player respawned or changed class).
export function clearMage() {
  comet.on = false;
  cometMark.visible = false;
  dismissBow();
  gun.on = false;
  gunModel.visible = false;
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
      n: 'Arcane Crossbow', fn: mgCrossbow, start: 0, alt: () => elName('q'),
      el: { flame: 'Flame Arrow', thunder: 'Lightning Arrow', water: 'Tide Arrow' },
      lv: [
        { cd: 5, dmg: 70, refund: false },
        { cd: 4.5, dmg: 90, refund: false },
        { cd: 4.5, dmg: 90, refund: true },
      ],
      perks: ['Conjure a great crossbow that looses one arrow at one enemy', 'More damage, shorter cooldown', 'A knockout gives the skill straight back'],
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
      perks: ['Conjure a machine gun that pours a stream of missiles at one enemy', 'More and stronger missiles, shorter cooldown', 'Half as many missiles again'],
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
      // rad = how far it reaches. knock = how hard it throws them back (a sword's heaviest hit is 9).
      // stun = seconds they cannot act afterwards. dmg stays small at every rank: this is not an attack.
      lv: [
        { cd: 5, dmg: 8, rad: 5, knock: 26, stun: 0.4 },
        { cd: 4, dmg: 10, rad: 5, knock: 30, stun: 0.4 },
        { cd: 4, dmg: 10, rad: 6.5, knock: 36, stun: 1 },
      ],
      perks: ['Smack the ground and hurl back everything around you', 'Throws harder, shorter cooldown', 'Reaches further, and what it throws is stunned for a second'],
    },
  },
};

// ---------- trials ----------
// One trial per rank of each skill, written as data: progress.js counts them (see countHit there for what
// count, by, only and when mean). The other fields are explained above the Blademaster's trials in blade.js.
// The three sword style trials are the common ones, added by progress.js.
// All numbers here are first guesses and are meant to be tuned by playing.
CLASSES.mage.trials = [
  { id: 'mage-q1', slot: 'q', rank: 1, name: 'Trial: Arcane Crossbow', desc: 'Hit all 3 flying dummies with Arcane Crossbow', time: 75, goal: 3, allow: ['q'], count: 'targets', by: 'q', only: 'flying',
    arena: { spawn: [['flying', -9, 5, -4, { radius: 3 }], ['flying', 9, 6, -4, { radius: 3 }], ['flying', 0, 8, -12, { radius: 4 }]] } },
  { id: 'mage-q2', slot: 'q', rank: 2, name: 'Arcane Crossbow II', desc: 'Deal 400 damage with Arcane Crossbow', time: 60, goal: 400, allow: ['q'], count: 'damage', by: 'q',
    arena: { spawn: [['basic', -6, 0, 0], ['basic', 6, 0, 0], ['basic', 0, 0, -8]] } },
  // dummies with only 80 health: one Lance puts one down
  { id: 'mage-q3', slot: 'q', rank: 3, name: 'Arcane Crossbow III', desc: 'Knock out 4 dummies with Arcane Crossbow', time: 60, goal: 4, allow: ['q'], count: 'kos', by: 'q',
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
