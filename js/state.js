import { V3 } from './util.js';

// ================= shared state =================
export let T = 0;
export const P = {};          // player
export let CL = null;         // current class
export const dlg = { open: false, page: 'main', opts: [] };
export const chal = { cur: null, phase: 'none', t: 0, ring: 0, kos: 0 };
export const SPAWN = new V3(0, 0, 14);
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
