// state.js: game state that many files share. No logic of its own.
// P = the player (filled in by player.js).  CL = the class being played.  T = game time in seconds.
// Other files can READ T, CL, combo... directly, but must call the setter functions at the bottom to CHANGE them.

import { V3 } from './util.js';

// ================= shared state =================
// Seconds of game time so far. Stops while paused and runs slowly during hitstop.
export let T = 0;
export const P = {};          // player
export let CL = null;         // current class
// dlg = Master Sen's dialog. chal = the running challenge; phase is 'none' | 'count' (3-2-1) | 'run'.
export const dlg = { open: false, page: 'main', opts: [] };
export const chal = { cur: null, phase: 'none', t: 0, ring: 0, kos: 0 };
// Where the player starts and respawns.
export const SPAWN = new V3(0, 0, 14);
// combo = hits in the current chain. comboT = seconds before the chain drops. totalDmg and dmgLog feed the stats line.
export let combo = 0, comboT = 0, totalDmg = 0;
export const dmgLog = [];
export const CLASSES = {};    // filled in by the files in classes/

// setters for other modules (an imported `let` is read-only)
export function addT(dt) { T += dt; }
export function setCL(c) { CL = c; }
export function addHit(dmg) { combo++; comboT = 1.8; totalDmg += dmg; dmgLog.push({ t: T, d: dmg }); }
export function resetCombo() { combo = 0; comboT = 0; }
export function tickCombo(dt) { comboT -= dt; if (comboT <= 0) combo = 0; }
export function resetDamage() { dmgLog.length = 0; totalDmg = 0; }
