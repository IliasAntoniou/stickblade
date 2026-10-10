// util.js: small helpers used everywhere (maths, shared scratch vectors, page lookup, the save file).
// Owns nothing in the game world. Used by almost every file.

import * as THREE from 'three';

// ================= utils =================
export const V3 = THREE.Vector3;
export const TAU = Math.PI * 2;
// clamp(v, a, b): keep v between a and b.
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// lerp(a, b, t): blend from a (t = 0) to b (t = 1).
export const lerp = (a, b, t) => a + (b - a) * t;
// damp(a, b, k, dt): move a towards b smoothly; bigger k = faster.
// Unlike a plain lerp it behaves the same at 30 and at 144 frames per second.
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
// easeOut(t): takes 0..1, returns 0..1, fast at the start and slow at the end.
export const easeOut = t => 1 - Math.pow(1 - t, 3);
// pick(arr): a random element.
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// Shortest signed turn from angle a to angle b, in radians (copes with wrapping past a full circle).
export function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
// damp() for angles: always turns the short way round.
export const angDamp = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
// Scratch vectors. Making a new Vector3 every frame causes stutter (the browser has to clean them up),
// so code borrows these instead.
// TRAP: they are shared. Any function you call may overwrite them, so never expect one to keep its value across a call.
// _a.._e: general use.  _hv, _dv: dummies.  _pv: projectiles and aiming.  _fx: effect positions.  _bv: beams.  _hp: hurtPlayer.
export const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3();
export const _hv = new V3(), _dv = new V3(), _pv = new V3(), _fx = new V3(), _bv = new V3(), _hp = new V3();
export const UP = new V3(0, 1, 0);
// $('id'): shorthand for document.getElementById.
export const $ = id => document.getElementById(id);
// The value of ?debug in the address, or null when it is absent (normal play). See main.js for what the values do.
export const DEBUG = new URLSearchParams(location.search).get('debug');

// saved progress
// Kept in the browser's localStorage: the chosen class and best challenge times.
// Only change SAVE_KEY if the shape of the data changes (old saves are then ignored).
export const SAVE_KEY = 'stickblade.v2';
export const save = { cls: 'blade', best: {}, quality: 'low' };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') { if (s.cls) save.cls = s.cls; if (s.best) save.best = s.best; if (s.quality === 'high') save.quality = 'high'; } } catch (e) {}
// Write the save. The try/catch is there because storage can be blocked (private windows).
export function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
