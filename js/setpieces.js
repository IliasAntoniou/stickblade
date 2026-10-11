// setpieces.js: the things in a district that react. A mission (missions.js) lists them in its district's
// `things`; they are built when the stage they belong to begins and all taken away when the mission ends, so
// every attempt starts with them fresh.
//   keg       = a powder keg. Break it and, a moment later, it explodes: it hurts everyone near (the player
//               too), leaves fire on the ground, breaks barricades and cracked walls, and sets off other kegs.
//   lever     = hit it once and it fires its trigger (also the crane's bell-pull and the gallows rope).
//   cage      = someone is locked in. Break it open and they thank you: some health back.
//   door      = a wall that goes away when its trigger fires (`opens`), or when a keg goes off beside it (`cracked`).
//   load      = a crate hanging in the air. When its trigger fires it falls, crushes what is under it, and stays
//               as a low pile that can be stepped over.
//   pad       = a market awning: land on it and it throws you up and along.
//   trap      = a strip of ground that burns (or steams) on a cycle, with a warning first.
//   page      = a page of the Hand's ledger to find: a piece of the story.
//   hourglass = more time on the clock.
// Kegs, levers and cages are dummies with a `look` (dummies.js, skins.js), so every sword, skill, mount and
// element already works on them; the rest are checked against where the player stands.
// A TRIGGER is just a name: 'lever:crane' (that lever was hit), 'load:crane' (that load has landed),
// 'stage:3' (stage 3 has begun). fire() announces one; doors and loads listen, and a stage can wait for one.
// Owns: the list of things in the world, and which triggers have fired this mission.
// Used by: missions.js (buildThings, clearThings, updateThings, fire, wasFired), main.js (the test handle).

import * as THREE from 'three';
import { V3, _fx } from './util.js';
import { scene } from './core.js';
import { addBox, removeBox, boxGeo, lam, COL } from './world.js';
import { glowTex, ringGeo, spawnRing, spawnGlow, spawnText, burst, shake, say } from './fx.js';
import { makeStickman, applyPose, addRim, BASE } from './stickman.js';
import { T, P, setHitSrc } from './state.js';
import { spawnDummy, removeDummy, hitArea } from './dummies.js';
import { hurtPlayer, depenetrate } from './player.js';
import { addZone } from './elements.js';
import { style } from './styles.js';
import { foundPage, addTime } from './missions.js';

// Powder kegs. Distances are world units, times are seconds.
const KEG_HP = 30;         // a keg's health: one or two sword hits
const KEG_FUSE = 0.6;      // seconds between breaking a keg and the blast: just enough to dash clear
const KEG_CHAIN = 0.18;    // the same for a keg set off by another keg, so a row of them goes off as a ripple
const KEG_RADIUS = 5.5;    // how far the blast reaches
const KEG_DAMAGE = 140;    // to enemies at the centre; half of that at the edge
const KEG_HURT = 18;       // to the player, anywhere inside most of the radius
const KEG_FIRE = { radius: 3, time: 5, dps: 30 };    // the patch of fire it leaves behind
// A falling load.
const LOAD_GRAVITY = 40;   // how fast it speeds up as it falls
const LOAD_DAMAGE = 500;   // to enemies under it: enough for any ordinary fighter
const LOAD_HURT = 25;      // to the player, if standing under it
const CAGE_HP = 40;
const CAGE_HEAL = 0.2;     // share of full health given back for freeing someone
const PAD_AGAIN = 0.5;     // seconds before the same awning throws again
const TRAP_AGAIN = 0.7;    // seconds before the same trap can hurt again
const PICKUP_REACH = 1.8;  // how close the player has to come to pick something up
const AWNING = 0xb5483a;   // the red cloth of a market awning

// Every thing standing in the world right now, and the names of the triggers fired so far this mission.
export const things = [];
const fired = new Set();
// The district's square, kept from buildThings: where its centre is, and what its dummies are kept inside.
let home = null;

const pageMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0b0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
const glassMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x35e0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
const ropeMat = new THREE.MeshBasicMaterial({ color: 0x2a2520 });
const prisonerMat = addRim(new THREE.MeshLambertMaterial({ color: 0xc9b48a }));
// How someone sits in a cage: on their knees, hands on the bars.
const CAGED_POSE = { ...BASE, bodyY: 0.55, spineX: 0.25, hipLX: 0.15, kneeL: 1.75, hipRX: 0.15, kneeR: 1.75, shLX: -1.1, elL: -0.9, shRX: -1.1, elR: -0.9 };

const _at = new V3();

// ---------- triggers ----------
// Announce that something has happened. Doors that were waiting for it open; loads that were waiting fall.
export function fire(name) {
  if (fired.has(name)) return;
  fired.add(name);
  for (const thing of things) {
    if (thing.done) continue;
    if (thing.kind === 'door' && thing.spec.opens === name) openDoor(thing);
    if (thing.kind === 'load' && thing.spec.drops === name && thing.state === 'hang') thing.state = 'fall';
  }
}
export const wasFired = name => fired.has(name);

// ---------- building ----------
// A thing that is a dummy underneath (a keg, a lever, a cage): stands still, is not a person.
function propDummy(look, hp, pos) {
  return spawnDummy('basic', pos.x, pos.y, pos.z, { gang: true, prop: true, fixed: true, look, hp, zone: home });
}
// A glowing dot hanging in the air, with a ring under it, for something to pick up.
function pickupSprite(mat, pos) {
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(1.5);
  sprite.position.copy(pos);
  const halo = new THREE.Mesh(ringGeo, haloMat);
  halo.scale.setScalar(0.55);
  halo.position.y = -0.9;
  sprite.add(halo);
  scene.add(sprite);
  return sprite;
}
// Put into the world every thing of this district that belongs to the stage now beginning (stageNumber counts
// from 1; a thing with no `stage` belongs to stage 1). area = the district's square. list = its `things`.
// found = which ledger pages have already been found (they are not put out again).
export function buildThings(area, list, stageNumber, found) {
  home = area;
  let pageIndex = -1;
  for (const spec of list || []) {
    if (spec.kind === 'page') pageIndex++;
    if ((spec.stage || 1) !== stageNumber) continue;
    if (spec.kind === 'page' && found.includes(pageIndex)) continue;
    const thing = { kind: spec.kind, spec, done: false };
    if (spec.at) thing.pos = new V3(area.cx + spec.at[0], spec.at[1], area.cz + spec.at[2]);
    if (spec.kind === 'keg') {
      thing.d = propDummy('keg', KEG_HP, thing.pos);
      thing.fuse = -1;    // seconds until the blast; below 0 = not lit
    } else if (spec.kind === 'lever') {
      thing.d = propDummy('lever', 1, thing.pos);
    } else if (spec.kind === 'cage') {
      thing.d = propDummy('cage', CAGE_HP, thing.pos);
      thing.figure = makeStickman(prisonerMat, null, false);
      applyPose(thing.figure, CAGED_POSE);
      thing.figure.root.position.copy(thing.pos);
      scene.add(thing.figure.root);
    } else if (spec.kind === 'door' || spec.kind === 'pad') {
      const [x, y, z, w, h, d, colour] = spec.box;
      thing.pos = new V3(area.cx + x, y, area.cz + z);
      thing.size = new V3(w, h, d);
      thing.mesh = addBox(thing.pos.x, y, thing.pos.z, w, h, d, spec.kind === 'pad' ? AWNING : COL[colour] || COL.wall);
      thing.again = 0;
    } else if (spec.kind === 'load') {
      const [w, h, d] = spec.size;
      thing.size = new V3(w, h, d);
      thing.state = 'hang';
      thing.speed = 0;
      thing.mesh = new THREE.Mesh(boxGeo, lam(COL.crate));
      thing.mesh.scale.set(w, h, d);
      thing.mesh.position.set(thing.pos.x, thing.pos.y + h / 2, thing.pos.z);
      // the rope it hangs from, up to the height given
      thing.rope = new THREE.Mesh(boxGeo, ropeMat);
      const ropeLength = spec.rope - (thing.pos.y + h);
      thing.rope.scale.set(0.12, ropeLength, 0.12);
      thing.rope.position.set(thing.pos.x, thing.pos.y + h + ropeLength / 2, thing.pos.z);
      scene.add(thing.mesh, thing.rope);
    } else if (spec.kind === 'trap') {
      const [w, d] = spec.size;
      thing.size = new V3(w, 0, d);
      thing.again = 0;
      // each trap has a material of its own, because each one brightens and fades at its own time
      thing.mesh = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: spec.color || 0xff5a1a, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      thing.mesh.position.copy(thing.pos);
      thing.mesh.raycast = () => {};    // the camera, the crosshair and the hook look straight through it
      scene.add(thing.mesh);
    } else if (spec.kind === 'page') {
      thing.index = pageIndex;
      thing.mesh = pickupSprite(pageMat, thing.pos);
    } else if (spec.kind === 'hourglass') {
      thing.mesh = pickupSprite(glassMat, thing.pos);
    } else continue;
    things.push(thing);
    // a thing whose trigger has already fired (it belongs to a later stage) starts in its fired state
    if (thing.kind === 'door' && fired.has(spec.opens)) openDoor(thing);
  }
}
// Take one thing out of the world, whatever it is made of.
function removeThing(thing) {
  thing.done = true;
  if (thing.d && !thing.d.removed) {
    removeDummy(thing.d);
    thing.d.removed = true;
  }
  if (thing.figure) scene.remove(thing.figure.root);
  if (thing.rope) scene.remove(thing.rope);
  if (thing.box) removeBox(thing.box);
  thing.box = null;
  if (!thing.mesh) return;
  if (thing.kind === 'door' || thing.kind === 'pad') removeBox(thing.mesh);
  else scene.remove(thing.mesh);
  if (thing.kind === 'trap') thing.mesh.material.dispose();
  thing.mesh = null;
}
// Take everything away and forget every trigger (the mission is over).
export function clearThings() {
  for (const thing of things) removeThing(thing);
  things.length = 0;
  fired.clear();
}

// ---------- what each thing does ----------
// A door opens: it breaks apart and is gone.
function openDoor(thing) {
  if (thing.done) return;
  _at.set(thing.pos.x, thing.pos.y + thing.size.y / 2, thing.pos.z);
  burst(_at, 26, 11, 1);
  spawnRing(_fx.set(thing.pos.x, thing.pos.y + 0.05, thing.pos.z), 0.5, Math.max(thing.size.x, thing.size.z), 0.5, 0xd8c8a8);
  removeThing(thing);
}
// True if the player stands within a rectangle on the ground: centre pos, full size w by d, grown by `margin`.
function playerInside(pos, w, d, margin) {
  return Math.abs(P.pos.x - pos.x) < w / 2 + margin && Math.abs(P.pos.z - pos.z) < d / 2 + margin;
}
// A keg goes off.
function explode(thing) {
  const pos = thing.pos;
  removeThing(thing);
  setHitSrc('blast');    // lets a barricade and an armoured enemy tell a blast from a sword (dummies.js)
  hitArea(pos.x, pos.y, pos.z, KEG_RADIUS, KEG_DAMAGE, 12, 8, true, 0.1, true, 0.5);
  setHitSrc('other');
  const reach = Math.hypot(P.pos.x - pos.x, P.pos.z - pos.z);
  if (reach < KEG_RADIUS * 0.8 && Math.abs(P.pos.y - pos.y) < 3) hurtPlayer(KEG_HURT, pos);
  addZone(pos, KEG_FIRE.radius, KEG_FIRE.time, KEG_FIRE.dps);
  spawnRing(_fx.copy(pos).setY(pos.y + 0.08), 0.6, KEG_RADIUS, 0.4, 0xff7a1f);
  spawnGlow(_fx.setY(pos.y + 1), 0xffa040, 10, 0.4);
  burst(_fx, 34, 15);
  shake(0.7);
  for (const other of things) {
    if (other.done) continue;
    // the blast has just broken the kegs around it: they follow quickly
    if (other.kind === 'keg' && other.d.dead && other.fuse < 0) other.fuse = KEG_CHAIN;
    // a cracked wall near enough comes down
    if (other.kind === 'door' && other.spec.cracked) {
      const gap = Math.hypot(Math.max(0, Math.abs(other.pos.x - pos.x) - other.size.x / 2), Math.max(0, Math.abs(other.pos.z - pos.z) - other.size.z / 2));
      if (gap < KEG_RADIUS * 0.7) openDoor(other);
    }
  }
}
// A load has reached the ground.
function landLoad(thing) {
  const pos = thing.pos, size = thing.size;
  scene.remove(thing.mesh, thing.rope);
  thing.mesh = null;
  thing.rope = null;
  thing.state = 'down';
  // what is left of it: a low pile, solid, that can be stepped over
  thing.box = addBox(pos.x, 0, pos.z, size.x, thing.spec.rubble || 1.2, size.z, COL.crate);
  setHitSrc('blast');
  hitArea(pos.x, 0, pos.z, Math.max(size.x, size.z) * 0.9, LOAD_DAMAGE, 10, 9, true, 0.12, true);
  setHitSrc('other');
  if (playerInside(pos, size.x, size.z, 0.6) && P.pos.y < size.y) {
    hurtPlayer(LOAD_HURT, pos);
    depenetrate();    // the pile is now where the player stood: push them out of it
  }
  spawnRing(_fx.set(pos.x, 0.08, pos.z), 0.6, Math.max(size.x, size.z) * 1.6, 0.5, 0xd8c8a8);
  burst(_fx.setY(1), 40, 14, 1);
  shake(0.9);
  fire('load:' + thing.spec.name);
}

// Once per frame while a mission runs (missions.js).
export function updateThings(dt) {
  // a plain loop by number: a keg going off, or a lever being hit, can open doors and so change other things
  for (let i = 0; i < things.length; i++) {
    const thing = things[i];
    if (thing.done) continue;
    const spec = thing.spec, pos = thing.pos;
    if (thing.kind === 'keg') {
      if (thing.d.dead && thing.fuse < 0) thing.fuse = KEG_FUSE;
      if (thing.fuse < 0) continue;
      thing.fuse -= dt;
      thing.d.sm.root.scale.setScalar(1 + Math.sin(T * 40) * 0.08);    // it shudders while the fuse burns
      if (Math.random() < dt * 20) burst(_fx.copy(pos).setY(pos.y + 1.4), 1, 5);
      if (thing.fuse <= 0) explode(thing);
    } else if (thing.kind === 'lever') {
      if (!thing.d.dead) continue;
      spawnRing(_fx.copy(pos).setY(pos.y + 0.08), 0.3, 3, 0.4, 0xffd23f);
      burst(_fx.setY(pos.y + 1.5), 14, 8, 3);
      removeThing(thing);
      fire('lever:' + spec.name);
    } else if (thing.kind === 'cage') {
      if (!thing.d.dead) continue;
      const gained = Math.min(P.maxHp * CAGE_HEAL, P.maxHp - P.hp);
      P.hp += gained;
      if (gained > 0) spawnText(_fx.set(P.pos.x, P.pos.y + 2.1, P.pos.z), '+' + Math.round(gained), 'heal');
      burst(_fx.copy(pos).setY(pos.y + 1.2), 22, 9, 1);
      if (spec.line) say(spec.who || 'Docker', spec.line);
      removeThing(thing);
    } else if (thing.kind === 'load') {
      if (thing.state !== 'fall') continue;
      thing.speed += LOAD_GRAVITY * dt;
      pos.y = Math.max(0, pos.y - thing.speed * dt);
      thing.mesh.position.y = pos.y + thing.size.y / 2;
      thing.rope.visible = false;
      if (pos.y <= 0) landLoad(thing);
    } else if (thing.kind === 'pad') {
      thing.again -= dt;
      const top = pos.y + thing.size.y;
      if (thing.again > 0 || !P.grounded || Math.abs(P.pos.y - top) > 0.2 || !playerInside(pos, thing.size.x, thing.size.z, 0)) continue;
      thing.again = PAD_AGAIN;
      P.vel.y = spec.up;
      P.vel.x = spec.push[0];
      P.vel.z = spec.push[1];
      P.grounded = false;
      P.coyote = 0;
      spawnRing(_fx.set(P.pos.x, top + 0.05, P.pos.z), 0.3, 2.6, 0.3, 0xffe0c0);
    } else if (thing.kind === 'trap') {
      updateTrap(thing, dt);
    } else if (thing.kind === 'page' || thing.kind === 'hourglass') {
      thing.mesh.position.y = pos.y + Math.sin(T * 2.4 + pos.x) * 0.18;
      if (Math.hypot(P.pos.x - pos.x, P.pos.y + 1 - pos.y, P.pos.z - pos.z) > PICKUP_REACH) continue;
      if (thing.kind === 'page') foundPage(thing.index, spec.text);
      else if (addTime(spec.secs)) spawnText(_fx.copy(pos), '+' + spec.secs + ' s', 'gold');
      else continue;    // no clock is running: leave the hourglass where it is
      spawnRing(_fx.copy(pos).setY(pos.y - 0.8), 0.2, 2.2, 0.35, thing.kind === 'page' ? 0xfff0b0 : 0x35e0ff);
      removeThing(thing);
    }
  }
}
// A trap's cycle: quiet, then a warning that brightens, then on (and hurting), then quiet again.
//   every = seconds for the whole cycle.  warn, on = how long the warning and the burning last.
//   offset = shifts the cycle, so two traps do not fire together.  quench = a Water dash through it puts it out.
function updateTrap(thing, dt) {
  const spec = thing.spec, pos = thing.pos, material = thing.mesh.material;
  const phase = (T + (spec.offset || 0)) % spec.every;
  const burning = phase >= spec.warn && phase < spec.warn + spec.on;
  const inside = playerInside(pos, thing.size.x, thing.size.z, 0.2) && P.pos.y - pos.y < 2.6 && P.pos.y - pos.y > -0.5;
  thing.again -= dt;
  if (spec.quench && inside && P.state === 'dash' && style.cur && style.cur.id === 'water') {
    spawnText(_fx.set(P.pos.x, P.pos.y + 2, P.pos.z), 'PUT OUT', 'heal');
    burst(_fx.copy(pos).setY(pos.y + 0.6), 24, 8, 2);
    removeThing(thing);
    return;
  }
  // flat and faint when quiet, flat and brightening as a warning, and a wall of it while on
  const height = burning ? 2.6 : 0.06;
  thing.mesh.scale.set(thing.size.x, height, thing.size.z);
  thing.mesh.position.y = pos.y + height / 2 + 0.03;
  if (burning) material.opacity = 0.3 + Math.sin(T * 30) * 0.08;
  else if (phase < spec.warn) material.opacity = 0.1 + 0.4 * (phase / spec.warn);
  else material.opacity = 0.05;
  if (!burning) return;
  if (Math.random() < dt * 30) burst(_fx.set(pos.x + (Math.random() - 0.5) * thing.size.x, pos.y + 0.3, pos.z + (Math.random() - 0.5) * thing.size.z), 1, 6);
  if (inside && thing.again <= 0) {
    thing.again = TRAP_AGAIN;
    hurtPlayer(spec.dmg, pos);
  }
}
