import * as THREE from 'three';

// ================= utils =================
export const V3 = THREE.Vector3;
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export const angDamp = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
export const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3();
export const _hv = new V3(), _dv = new V3(), _pv = new V3(), _fx = new V3(), _bv = new V3(), _hp = new V3();
export const UP = new V3(0, 1, 0);
export const $ = id => document.getElementById(id);

// saved progress
export const SAVE_KEY = 'stickblade.v2';
export const save = { cls: 'blade', best: {} };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') { if (s.cls) save.cls = s.cls; if (s.best) save.best = s.best; } } catch (e) {}
export function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
