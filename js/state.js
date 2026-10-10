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
export const CLASSES = {};

// TUNE: the numbers the tuning panel (tuning.js) can change while playing. The game reads them live.
// TUNE_DEFAULTS is what "Reset all" goes back to. To make a tested value permanent, change it here.
// Distances are world units (a stickman is about 1.9 tall), speeds are units per second, times are seconds.
export const TUNE_DEFAULTS = {
  runMult: 1,           // multiplies every class's run speed
  jump: 13,             // upward speed of a ground jump (higher = jumps higher)
  airJump: 12.5,        // upward speed of a jump in the air
  gravity: 36,          // pull downwards (higher = snappier, shorter jumps)
  extraAirJumps: 0,     // added to every class's air jumps
  dashSpeed: 34,        // dashSpeed x dashTime = dash distance
  dashTime: 0.17,
  dashCd: 1.1,          // seconds to regain a dash charge
  dashCharges: 2,
  maxHp: 100,           // player health
  hpRegen: 12,          // health per second, starting 3 s after the last hit
  dmgTaken: 1,          // multiplies damage the player takes
  god: false,           // true = the player cannot be hit
  cdMult: 1,            // multiplies skill cooldowns (0 = no cooldowns)
  dmgMult: 1,           // multiplies damage the player deals
  kbMult: 1,            // multiplies knockback on dummies
  hitstopMult: 1,       // multiplies the slow-motion freeze when a hit lands
  shakeMult: 1,         // multiplies screen shake
  dummyHpMult: 1,       // multiplies every dummy's health
  dummyRegen: true,     // dummies heal when left alone
  fightersAttack: true, // false = purple fighters stay passive
  timeScale: 1,         // game speed (0.5 = slow motion)
};
export const TUNE = { ...TUNE_DEFAULTS };    // filled in by the files in classes/

// setters for other modules (an imported `let` is read-only)
export function addT(dt) { T += dt; }
// hitSrc = which attack the hits happening right now belong to: 'atk' (basic attack), 'q' 'e' 'r' 'f' (skills) or 'other'.
// Code that deals damage sets it just before; hitDummy reads it. update() puts it back to 'other' every frame.
export let hitSrc = 'other';
export function setHitSrc(s) { hitSrc = s; }
export function setCL(c) { CL = c; }
export function addHit(dmg) { combo++; comboT = 1.8; totalDmg += dmg; dmgLog.push({ t: T, d: dmg }); }
export function resetCombo() { combo = 0; comboT = 0; }
export function tickCombo(dt) { comboT -= dt; if (comboT <= 0) combo = 0; }
export function resetDamage() { dmgLog.length = 0; totalDmg = 0; }
