// mounts.js: the mount, called with X. Something to ride that is much faster than running and knocks aside
// whatever it runs into. Which one appears depends on the sword style in use:
//   no style = a car,  Flame = a fire horse,  Thunder = a lightning lion,  Water = a war elephant.
// Riding is a player state ('mounted'). Anything that puts the player in another state (a skill, a dash, an
// attack, being hit, a respawn) also takes them off the mount: setState() in player.js calls stowMount().
// Owns: the four models (built once by initMounts, hidden until used), the numbers in MOUNTS, how riding moves.
// Used by: update.js (the X key and the 'mounted' case), player.js (stowMount), anim.js (the riding pose reads
// P.seat and mountSit()), hud.js (the name on the X slot), main.js (initMounts, animateMount).

import * as THREE from 'three';
import { clamp, lerp, damp, _fx } from './util.js';
import { scene } from './core.js';
import { addRim } from './stickman.js';
import { spawnRing, burst } from './fx.js';
import { T, P, CL, TUNE, setHitSrc } from './state.js';
import { joined } from './skins.js';
import { dummies, hitDummy } from './dummies.js';
import { setState } from './player.js';
import { style } from './styles.js';
import { inDir, hasIn } from './update.js';

export const MOUNT_CD = 1;    // seconds before X works again, so one press cannot mount and dismount at once
const HIP_HEIGHT = 0.93;      // how far a standing stick figure's hips are above its feet (BASE.bodyY in stickman.js)
const RAM_AGAIN = 0.7;        // seconds before the same enemy can be rammed again

// The mounts. Speeds are units per second (the Blademaster runs at 9.5, a dash is 34).
//   style  = the sword style that turns the mount into this one (none = the plain one)
//   speed  = top speed.   grip = how quickly it reaches the direction and speed asked for (higher = turns tighter)
//   jump   = jump height as a share of the player's own jump
//   ram, push, lift, heavy = running into an enemy: damage, knockback, upward launch, and whether it counts as
//            a heavy hit (interrupts a fighter's attack)
//   reach, width = how far ahead of the rider the front of the mount is, and how wide it is (for ramming)
//   seat   = height of the rider's hips.   sit = 'astride' (legs either side) or 'seated' (legs forward, in a car)
//   stride = how fast the legs or wheels turn for a given speed
export const MOUNTS = {
  car: { name: 'Car', speed: 21, grip: 5, jump: 0.75, ram: 8, push: 9, lift: 4, heavy: false, reach: 1.5, width: 1.0, seat: 0.82, sit: 'seated', stride: 2.5 },
  horse: { name: 'Fire Horse', style: 'flame', speed: 27, grip: 6, jump: 1.15, ram: 10, push: 10, lift: 5, heavy: false, reach: 1.3, width: 0.8, seat: 1.62, sit: 'astride', stride: 0.55 },
  lion: { name: 'Lightning Lion', style: 'thunder', speed: 24, grip: 9, jump: 1.5, ram: 12, push: 9, lift: 6, heavy: false, reach: 1.4, width: 0.9, seat: 1.4, sit: 'astride', stride: 0.6 },
  elephant: { name: 'War Elephant', style: 'water', speed: 16, grip: 3.5, jump: 0.6, ram: 28, push: 17, lift: 8, heavy: true, reach: 2.3, width: 1.5, seat: 2.74, sit: 'astride', stride: 0.32 },
};

// mount.cur = the entry of MOUNTS being ridden (null on foot). mount.phase drives the legs and wheels.
export const mount = { cur: null, phase: 0 };
// The built models, by id: { root, legs, wheels, flames }. Filled in by initMounts().
const models = {};

// ---------- building the models ----------
// Every model faces +z, stands with its feet at y = 0, and is made of as few separate pieces as possible: one
// joined shape for the body, one for everything that glows, and one piece per leg or axle (those have to move).
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h) => new THREE.ConeGeometry(r, h, 6);
// A leg that swings from its top end: the shape hangs below the point it is placed at.
const legGeo = (w, h) => box(w, h, w).translate(0, -h / 2, 0);
const bodyMat = color => addRim(new THREE.MeshLambertMaterial({ color }));
// Parts that are meant to look like light (fire, lightning, glowing trim): unlit and not dulled by tone mapping.
const glowMat = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });

function addPiece(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
// Four legs at the corners: (side, height of the hip, front z, back z). Order: front left, front right, back left, back right.
function addLegs(root, mat, w, h, side, front, back) {
  const geo = legGeo(w, h);
  return [[side, front], [-side, front], [side, back], [-side, back]].map(([x, z]) => addPiece(root, geo, mat, x, h, z));
}

function buildCar() {
  const root = new THREE.Group();
  const paint = bodyMat(0x2d3440);
  addPiece(root, joined([
    [box(1.5, 0.42, 3.0), 0, 0.62, 0],                 // the floor and sides
    [box(1.5, 0.3, 1.05), 0, 0.95, 0.98],              // the bonnet
    [box(1.5, 0.3, 0.6), 0, 0.95, -1.2],               // the boot
    [box(1.36, 0.42, 0.07), 0, 1.3, 0.5, -0.45],       // the windscreen
    [box(1.5, 0.07, 0.4), 0, 1.36, -1.4],              // a spoiler
    [box(0.08, 0.28, 0.08), 0.6, 1.2, -1.4], [box(0.08, 0.28, 0.08), -0.6, 1.2, -1.4],
  ]), paint);
  // the trim takes the colour of the class being played (set in showMount)
  const trim = addPiece(root, joined([
    [box(0.3, 0.02, 1.05), 0, 1.11, 0.98],                                       // a stripe down the bonnet
    [box(0.3, 0.12, 0.05), 0.5, 0.92, 1.51], [box(0.3, 0.12, 0.05), -0.5, 0.92, 1.51],    // headlights
    [box(0.4, 0.1, 0.05), 0.48, 0.92, -1.51], [box(0.4, 0.1, 0.05), -0.48, 0.92, -1.51],  // tail lights
  ]), glowMat(0x00e5ff));
  // each axle is one piece: two wheels that turn together
  const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10).rotateZ(Math.PI / 2);
  const axle = joined([[wheel, 0.82, 0, 0], [wheel, -0.82, 0, 0]]);
  const tyre = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const wheels = [addPiece(root, axle, tyre, 0, 0.42, 1.0), addPiece(root, axle, tyre, 0, 0.42, -1.0)];
  return { root, legs: [], wheels, flames: [], trim };
}

function buildHorse() {
  const root = new THREE.Group();
  const hide = bodyMat(0x2a1210);
  addPiece(root, joined([
    [box(0.6, 0.65, 1.7), 0, 1.3, 0],                  // the body
    [box(0.36, 0.95, 0.42), 0, 1.85, 0.88, 0.55],      // the neck, reaching forward
    [box(0.3, 0.34, 0.72), 0, 2.2, 1.34, 0.45],        // the head
    [cone(0.05, 0.16), 0.1, 2.48, 1.1], [cone(0.05, 0.16), -0.1, 2.48, 1.1],    // ears
  ]), hide);
  const legs = addLegs(root, hide, 0.17, 1.02, 0.2, 0.65, -0.65);
  const fire = glowMat(0xff7a1f);
  // the mane: tongues of flame along the top of the neck, leaning back
  const mane = addPiece(root, joined([
    [cone(0.13, 0.55), 0, 2.5, 0.98, -0.5], [cone(0.14, 0.62), 0, 2.32, 0.76, -0.7], [cone(0.14, 0.62), 0, 2.08, 0.56, -0.8],
    [cone(0.13, 0.55), 0, 1.86, 0.38, -0.9], [cone(0.1, 0.4), 0, 2.56, 1.2, -0.2],
    [box(0.07, 0.07, 0.04), 0.13, 2.26, 1.5], [box(0.07, 0.07, 0.04), -0.13, 2.26, 1.5],    // burning eyes
  ]), fire);
  // the tail: a plume of flame streaming out behind
  const tail = addPiece(root, joined([
    [cone(0.16, 0.9), 0, 0, -0.4, -1.9], [cone(0.11, 0.7), 0.08, 0.12, -0.35, -1.6], [cone(0.11, 0.7), -0.08, -0.1, -0.35, -2.2],
  ]), fire, 0, 1.5, -0.85);
  return { root, legs, wheels: [], flames: [mane, tail] };
}

function buildLion() {
  const root = new THREE.Group();
  const hide = bodyMat(0x5a4718);
  addPiece(root, joined([
    [box(0.8, 0.7, 1.7), 0, 1.05, 0],                  // the body
    [box(0.62, 0.62, 0.56), 0, 1.55, 1.05],            // the head
    [box(0.34, 0.26, 0.26), 0, 1.42, 1.42],            // the muzzle
    [box(0.1, 0.1, 0.9), 0, 1.5, -1.2, 0.6],           // the tail, held up
  ]), hide);
  const legs = addLegs(root, hide, 0.24, 0.72, 0.28, 0.6, -0.6);
  const bolt = glowMat(0xffe14a);
  // the mane: a ring of spikes standing out all round the head, and a ridge of them down the back
  const spikes = [];
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    spikes.push([cone(0.1, 0.55), Math.sin(angle) * 0.42, 1.55 + Math.cos(angle) * 0.42, 0.84, 0, 0, -angle]);
  }
  for (let i = 0; i < 4; i++) spikes.push([cone(0.08, 0.34), 0, 1.5, 0.4 - i * 0.36, -0.5]);
  spikes.push([box(0.09, 0.07, 0.04), 0.16, 1.62, 1.34], [box(0.09, 0.07, 0.04), -0.16, 1.62, 1.34]);    // eyes
  spikes.push([new THREE.SphereGeometry(0.13, 6, 5), 0, 1.86, -1.44]);    // a spark at the tip of the tail
  const mane = addPiece(root, joined(spikes), bolt);
  return { root, legs, wheels: [], flames: [mane] };
}

function buildElephant() {
  const root = new THREE.Group();
  const hide = bodyMat(0x5a6470);
  addPiece(root, joined([
    [box(1.6, 1.5, 2.5), 0, 1.9, 0],                   // the body
    [box(1.1, 1.15, 0.9), 0, 2.1, 1.6],                // the head
    [box(0.38, 0.75, 0.38), 0, 1.5, 2.12, -0.25],      // the trunk, in three pieces curling down and forward
    [box(0.32, 0.65, 0.32), 0, 0.95, 2.26, 0.1],
    [box(0.26, 0.26, 0.5), 0, 0.62, 2.42],
    [box(0.1, 1.1, 0.85), 0.72, 2.15, 1.35, 0, 0.55], [box(0.1, 1.1, 0.85), -0.72, 2.15, 1.35, 0, -0.55],    // ears
    [box(0.08, 0.5, 0.08), 0, 2.1, -1.3, -0.3],        // a small tail
  ]), hide);
  const legs = addLegs(root, hide, 0.5, 1.18, 0.5, 0.85, -0.85);
  // war gear, glowing the blue of Water: a blanket over the back with drapes down each side, a plate on the forehead
  const gear = addPiece(root, joined([
    [box(1.7, 0.1, 1.5), 0, 2.7, -0.1],
    [box(0.06, 0.75, 1.4), 0.83, 2.3, -0.1], [box(0.06, 0.75, 1.4), -0.83, 2.3, -0.1],
    [box(0.6, 0.6, 0.06), 0, 2.3, 2.07],
  ]), glowMat(0x2f8fff));
  // tusks, curving forward and up
  addPiece(root, joined([
    [cone(0.09, 0.9), 0.34, 1.5, 2.3, 1.95], [cone(0.09, 0.9), -0.34, 1.5, 2.3, 1.95],
  ]), glowMat(0xf2f6ff));
  return { root, legs, wheels: [], flames: [gear] };
}

// Called once from main.js: build the four models and hide them. Done in a function, not at the top of the file,
// because it uses joined() from skins.js (see the layout rules: only the base files may be used at top level).
export function initMounts() {
  const builders = { car: buildCar, horse: buildHorse, lion: buildLion, elephant: buildElephant };
  for (const id in MOUNTS) {
    MOUNTS[id].id = id;
    models[id] = builders[id]();
    models[id].root.visible = false;
    scene.add(models[id].root);
  }
}

// ---------- getting on and off ----------
// Which mount X would call right now: the one that belongs to the sword style in use, or the car.
export function mountFor() {
  if (style.cur) {
    for (const id in MOUNTS) {
      if (MOUNTS[id].style === style.cur.id) return MOUNTS[id];
    }
  }
  return MOUNTS.car;
}
// A puff where the mount appears or disappears, in its own colour.
function poof(m) {
  const color = m.style && style.cur ? style.cur.color : CL.color;
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.4, m.width * 2.6, 0.4, color);
  burst(_fx.setY(P.pos.y + 1), 18, 8);
}
// Put a mount under the player (also used to swap one mount for another mid-ride).
function showMount(m) {
  if (mount.cur) models[mount.cur.id].root.visible = false;
  mount.cur = m;
  models[m.id].root.visible = true;
  if (m.id === 'car') models.car.trim.material.color.setHex(CL.color);
  P.seat = m.seat - HIP_HEIGHT;
  poof(m);
}
// Hide the mount. Called by setState() in player.js whenever the player leaves the 'mounted' state, for any reason.
export function stowMount() {
  if (!mount.cur) return;
  poof(mount.cur);
  models[mount.cur.id].root.visible = false;
  mount.cur = null;
  P.seat = 0;
}
// The X key: get on, or get off with a small hop that keeps the speed.
export function toggleMount() {
  P.cd.x = MOUNT_CD;
  if (P.state === 'mounted') {
    setState('normal');
    P.vel.y = Math.max(P.vel.y, 6);
    return;
  }
  P.atk.on = false;
  setState('mounted');
  showMount(mountFor());
}
// How the rider sits on the current mount ('astride' or 'seated'), for anim.js.
export const mountSit = () => (mount.cur ? mount.cur.sit : 'astride');

// ---------- riding ----------
// Runs every frame of the 'mounted' state (from the state switch in update.js): steering, speed, jumping, and
// knocking aside whatever is in the way.
export function updateMounted(dt) {
  // The sword style changed or ran out mid-ride: the mount changes with it.
  const wanted = mountFor();
  if (wanted !== mount.cur) showMount(wanted);
  const m = mount.cur;
  const top = m.speed * TUNE.runMult;
  // Steer towards where the movement keys point. With no key held it rolls on and slows down.
  const grip = (P.grounded ? m.grip : m.grip * 0.3) * (hasIn ? 1 : 0.45);
  const blend = 1 - Math.exp(-grip * dt);
  P.vel.x = lerp(P.vel.x, hasIn ? inDir.x * top : 0, blend);
  P.vel.z = lerp(P.vel.z, hasIn ? inDir.z * top : 0, blend);
  P.grav = TUNE.gravity * (P.vel.y < 0 ? 1.35 : 1);
  if (P.jumpBuf > 0 && (P.grounded || P.coyote > 0)) {
    P.vel.y = TUNE.jump * m.jump;
    P.jumpBuf = 0;
    P.coyote = 0;
    P.grounded = false;
  }
  const speed = Math.hypot(P.vel.x, P.vel.z);
  if (speed > 1) P.yawT = Math.atan2(P.vel.x, P.vel.z);    // the mount faces the way it is going
  // Ramming: anything just ahead of a mount moving at a fair pace is hit and thrown aside.
  if (speed < top * 0.45) return;
  const dirX = P.vel.x / speed, dirZ = P.vel.z / speed;
  const frontX = P.pos.x + dirX * m.reach, frontZ = P.pos.z + dirZ * m.reach;
  for (const d of dummies) {
    if (d.dead || T - (d.ramT ?? -9) < RAM_AGAIN) continue;
    const dy = d.pos.y - P.pos.y;
    if (Math.hypot(d.pos.x - frontX, d.pos.z - frontZ) > m.width + 0.5 || dy < -1.5 || dy > m.seat + 0.6) continue;
    d.ramT = T;
    setHitSrc('ram');    // lets a barricade tell a ram from a sword: one ram from any mount breaks it (dummies.js)
    hitDummy(d, m.ram, dirX * m.push, dirZ * m.push, m.lift, m.heavy);
  }
}

// Once per frame (main.js, after the player has been posed): place the mount under the rider and move its legs,
// wheels and flames. Purely visual.
export function animateMount(dt) {
  const m = mount.cur;
  if (!m) return;
  const model = models[m.id];
  const speed = Math.hypot(P.vel.x, P.vel.z);
  const pace = clamp(speed / m.speed, 0, 1);    // 0 standing, 1 at full speed
  mount.phase += speed * m.stride * dt;
  const swing = Math.sin(mount.phase);
  model.root.position.copy(P.pos);
  model.root.rotation.y = P.yaw;
  if (model.legs.length) {
    // A trot: legs on opposite corners move together. In the air all four stretch out, front forward and back behind.
    const reach = 0.75 * pace;
    const air = P.grounded ? 0 : 0.7;
    model.legs[0].rotation.x = damp(model.legs[0].rotation.x, swing * reach - air, 20, dt);
    model.legs[3].rotation.x = damp(model.legs[3].rotation.x, swing * reach + air, 20, dt);
    model.legs[1].rotation.x = damp(model.legs[1].rotation.x, -swing * reach - air, 20, dt);
    model.legs[2].rotation.x = damp(model.legs[2].rotation.x, -swing * reach + air, 20, dt);
    model.root.position.y += Math.abs(Math.cos(mount.phase)) * 0.07 * pace;    // the body bobs with each stride
  }
  for (const wheel of model.wheels) wheel.rotation.x = mount.phase;
  // fire, lightning and glowing gear never hold still
  model.flames.forEach((flame, i) => {
    const flicker = m.id === 'elephant' ? 0.03 : 0.16;
    flame.scale.y = 1 + Math.sin(T * (m.id === 'lion' ? 31 : 17) + i * 2.1) * flicker;
    if (m.id === 'horse' && i === 1) flame.rotation.x = -0.25 * pace + Math.sin(T * 9) * 0.08;    // the tail lifts and streams with speed
  });
}
