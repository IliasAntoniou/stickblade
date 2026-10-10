// dojo.js: the training hall, a separate walled room far from the main arena where skill trials take place.
// Master Sen teleports the player (and himself) here. When a trial starts the hall is dressed for it: the trial's
// `arena` data (in the class file) lists the boxes to build and the dummies to spawn. When the trial ends, by
// passing, failing or quitting, everything it added is removed again.
// The hall sits at x = 300, far enough that fog hides the main arena. Trial layouts use coordinates relative to
// the centre of the hall, with the player arriving at z = +18 and looking towards -z.

import * as THREE from 'three';
import { V3, _fx } from './util.js';
import { scene } from './core.js';
import { addBox, removeBox, setArea, makeFloor, ARENA, COL } from './world.js';
import { spawnRing, burst, toast, flash } from './fx.js';
import { P, SPAWN } from './state.js';
import { spawnDummy, removeDummy } from './dummies.js';
import { respawnPlayer } from './player.js';
import { master, moveMaster } from './master.js';
import { addSource, removeSource, clearStyle } from './styles.js';

// Centre of the hall and half its width.
export const DOJO = { cx: 300, cz: 0, half: 24 };
// inside = the player is in the hall. props and spawned = what the running trial added, so it can be removed.
export const dojo = { inside: false, props: [], spawned: [], sources: [] };

const HUB = new V3(DOJO.cx, 0, DOJO.cz + 18);                 // where the player arrives
const MASTER_SPOT = new V3(DOJO.cx - 3, 0, DOJO.cz + 20);     // where Master Sen waits: within talking distance of the arrival point
const ARENA_SPAWN = SPAWN.clone();                            // the main arena's start point, to go back to

// ---------- the room itself (built once, never removed) ----------
{
  const size = DOJO.half * 2;
  // Warm wood tones, so the hall feels like a different place from the cool stone arena.
  const floor = makeFloor(size + 2, 0xc9976a);
  floor.position.set(DOJO.cx, 0, DOJO.cz);
  scene.add(floor);
  const wall = 0x8a5f48, h = 9, edge = DOJO.half + 0.5;
  addBox(DOJO.cx, 0, DOJO.cz - edge, size + 2, h, 1, wall);
  addBox(DOJO.cx, 0, DOJO.cz + edge, size + 2, h, 1, wall);
  addBox(DOJO.cx - edge, 0, DOJO.cz, 1, h, size, wall);
  addBox(DOJO.cx + edge, 0, DOJO.cz, 1, h, size, wall);
}

// The "teleport stuff": effects where the player leaves, a white flash, and effects where they arrive.
// respawnPlayer does the actual move (to SPAWN) and also resets health, speed and the direction faced.
function teleportTo(spot) {
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.3, 4.5, 0.5, 0xffd23f);
  burst(_fx.setY(P.pos.y + 1), 26, 9);
  SPAWN.copy(spot);
  respawnPlayer();
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.3, 4.5, 0.6, 0xffd23f);
  burst(_fx.setY(P.pos.y + 1), 26, 9);
  flash();
}

// Master Sen brings the player to the hall.
export function enterDojo() {
  if (dojo.inside) return;
  dojo.inside = true;
  setArea(DOJO.cx, DOJO.cz, DOJO.half);
  moveMaster(MASTER_SPOT.x, MASTER_SPOT.y, MASTER_SPOT.z);
  teleportTo(HUB);
  toast('The training hall. Talk to <b>Master Sen</b> (<b>G</b>) to choose a trial, or to go back.', 5);
}
// Back to the main arena.
export function leaveDojo() {
  if (!dojo.inside) return;
  clearTrial();
  dojo.inside = false;
  setArea(0, 0, ARENA);
  moveMaster(master.home.x, master.home.y, master.home.z);
  teleportTo(ARENA_SPAWN);
}

// Dress the hall for a trial. t.arena = { props: [[x, y, z, w, h, d, colour name]], spawn: [[type, x, y, z, options]],
// sources: [[style id, x, z]] (pools and braziers, see styles.js), start: [x, y, z] }.
// All coordinates are relative to the centre of the hall. y is the bottom of a box, as in addBox.
export function setupTrial(t) {
  clearTrial();
  const a = t.arena || {};
  for (const [x, y, z, w, h, d, col] of a.props || []) {
    dojo.props.push(addBox(DOJO.cx + x, y, DOJO.cz + z, w, h, d, COL[col] || COL.stone));
  }
  for (const [type, x, y, z, options] of a.spawn || []) {
    const d = spawnDummy(type, DOJO.cx + x, y, DOJO.cz + z, options);
    dojo.spawned.push(d);
    spawnRing(_fx.copy(d.pos).setY(d.pos.y + 0.05), 0.2, 2.2, 0.4, 0xffd23f);
  }
  for (const [id, x, z] of a.sources || []) dojo.sources.push(addSource(id, DOJO.cx + x, 0, DOJO.cz + z));
  // The player starts the trial (and comes back after a defeat) here.
  if (a.start) SPAWN.set(DOJO.cx + a.start[0], a.start[1], DOJO.cz + a.start[2]);
  else SPAWN.copy(HUB);
}
// Remove everything the last trial added.
export function clearTrial() {
  for (const m of dojo.props) removeBox(m);
  for (const d of dojo.spawned) removeDummy(d);
  for (const s of dojo.sources) removeSource(s);
  clearStyle();    // whatever sword style the trial gave ends with it
  dojo.props.length = 0;
  dojo.spawned.length = 0;
  dojo.sources.length = 0;
  if (dojo.inside) SPAWN.copy(HUB);
}
