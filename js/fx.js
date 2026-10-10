// fx.js: visual effects and on-screen messages. Slash arcs, shockwave rings, sparks, afterimages, beams, damage numbers,
// screen shake and hitstop.
// Every effect is a POOL: a fixed number of objects made once at startup and reused. spawnX() takes the next one,
// updateFx() fades it and hides it again. Nothing is created while playing, which keeps the frame rate steady.

import * as THREE from 'three';
import { V3, lerp, easeOut, _bv, UP, $ } from './util.js';
import { scene, camera } from './core.js';
import { makeStickman, copyPose } from './stickman.js';
import { P, TUNE } from './state.js';

// ================= FX =================
// Effects are drawn "additively": their colour is added on top of what is behind them, which makes them look like
// light. toneMapped: false keeps them pure and vivid. Both are free.
// glowTex = a soft round blob, used for every fake-bloom halo (here, on the weapon in player.js).
export const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
// Pool of halos that flash and fade: fake bloom on impacts and slashes. Like the other pools, nothing is created while playing.
export const glows = [];
for (let i = 0; i < 12; i++) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false }));
  m.visible = false;
  scene.add(m);
  glows.push({ m, life: 0, max: 0.2, size: 1 });
}
export let glowIdx = 0;
// A halo at pos that swells a little and fades over dur seconds.
export function spawnGlow(pos, color, size = 2, dur = 0.2) {
  const g = glows[glowIdx = (glowIdx + 1) % glows.length];
  g.m.position.copy(pos);
  g.m.material.color.setHex(color);
  g.life = g.max = dur;
  g.size = size;
  g.m.visible = true;
}
export const arcH = new THREE.RingGeometry(1.0, 2.4, 28, 1, Math.PI, Math.PI);
export const arcV = new THREE.RingGeometry(0.9, 2.3, 28, 1, -Math.PI / 3, 5 * Math.PI / 6);
export const arcs = [];
for (let i = 0; i < 8; i++) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const m = new THREE.Mesh(arcH, new THREE.MeshBasicMaterial({ color: 0x00d8f0, blending: THREE.AdditiveBlending, toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  g.add(m); g.visible = false; scene.add(g); arcs.push({ g, m, life: 0, max: 0.18, base: 1 });
}
export let arcIdx = 0;
// Slash arc. type 0 / 1 = flat swing tilted one way / the other, 2 = vertical swing.
export function spawnArc(type, pos, yaw, color = 0x00d8f0, scale = 1) {
  const a = arcs[arcIdx = (arcIdx + 1) % arcs.length];
  a.g.position.copy(pos); a.g.rotation.set(0, yaw, type === 0 ? 0.28 : type === 1 ? -0.28 : 0);
  if (type === 2) { a.m.geometry = arcV; a.m.rotation.set(0, -Math.PI / 2, 0); }
  else { a.m.geometry = arcH; a.m.rotation.set(-Math.PI / 2, 0, 0); }
  a.m.material.color.setHex(color); a.life = a.max; a.base = scale; a.g.visible = true;
  spawnGlow(pos, color, 2.6 * scale, 0.16);
}
export const ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
export const rings = [];
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  m.visible = false; scene.add(m); rings.push({ m, life: 0, max: 0.3, s0: 0, s1: 1 });
}
export let ringIdx = 0;
// Flat ring that grows from size s0 to s1 over dur seconds (landings, shockwaves).
export function spawnRing(pos, s0, s1, dur, color = 0xffffff) {
  const r = rings[ringIdx = (ringIdx + 1) % rings.length];
  r.m.position.copy(pos); r.life = r.max = dur; r.s0 = s0; r.s1 = s1; r.m.material.color.setHex(color); r.m.visible = true;
}
export const partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
export const partMats = [new THREE.MeshBasicMaterial({ color: 0xffc23d, toneMapped: false }), new THREE.MeshBasicMaterial({ color: 0xaab2c4 })];
export const parts = [];
for (let i = 0; i < 110; i++) { const m = new THREE.Mesh(partGeo, partMats[0]); m.visible = false; scene.add(m); parts.push({ m, v: new V3(), life: 0 }); }
export let partIdx = 0;
// n small cubes flying out from pos. mat 0 = orange sparks, 1 = grey dust.
export function burst(pos, n, speed = 8, mat = 0) {
  for (let i = 0; i < n; i++) {
    const p = parts[partIdx = (partIdx + 1) % parts.length];
    p.m.material = partMats[mat];
    p.m.position.copy(pos); p.v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    p.life = 0.35 + Math.random() * 0.2; p.m.visible = true;
  }
  // a burst of sparks also flashes a halo; bigger bursts flash bigger
  if (mat === 0 && n >= 6) spawnGlow(pos, 0xffb24a, 1.6 + n * 0.09, 0.18);
}
export const ghosts = [];
for (let i = 0; i < 18; i++) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, blending: THREE.AdditiveBlending, toneMapped: false, transparent: true, opacity: 0.4, depthWrite: false });
  const sm = makeStickman(mat, mat, true); sm.root.visible = false; scene.add(sm.root);
  ghosts.push({ sm, mat, life: 0, max: 0.3 });
}
export let ghostIdx = 0;
// Afterimage: a see-through copy of a stickman's current pose that fades over dur seconds.
export function spawnGhost(src, color, pos = null, dur = 0.28) {
  const g = ghosts[ghostIdx = (ghostIdx + 1) % ghosts.length];
  copyPose(src, g.sm);
  if (pos) g.sm.root.position.copy(pos);
  g.mat.color.setHex(color); g.life = g.max = dur; g.sm.root.visible = true;
}
// beams (thrust streaks, chains)
export const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5).translate(0, 0.5, 0);
// Stretch a thin cylinder from point a to point b.
export function setBeam(m, a, b, w = 1) {
  _bv.copy(b).sub(a); const l = _bv.length();
  m.position.copy(a); m.scale.set(w, l, w); m.quaternion.setFromUnitVectors(UP, _bv.divideScalar(l || 1));
}
export const beams = [];
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
  m.visible = false; scene.add(m); beams.push({ m, life: 0, max: 0.15 });
}
export let beamIdx = 0;
export function spawnBeam(a, b, color, dur = 0.14, w = 1) {
  const o = beams[beamIdx = (beamIdx + 1) % beams.length];
  setBeam(o.m, a, b, w); o.m.material.color.setHex(color); o.life = o.max = dur; o.m.visible = true;
}
// floating text (DOM)
export const dmgLayer = $('dmg');
export const dns = [];
for (let i = 0; i < 40; i++) { const el = document.createElement('div'); el.className = 'dn'; dmgLayer.appendChild(el); dns.push({ el, pos: new V3(), life: 0, max: 1, vx: 0 }); }
export let dnIdx = 0;
// Floating text at a place in the world (damage numbers).
// cls picks the look: '' | big | ko | block | dodge | hurt | gold. The styles are in index.html (.dn).
export function spawnText(pos, text, cls = '') {
  const d = dns[dnIdx = (dnIdx + 1) % dns.length];
  d.el.textContent = text; d.el.className = 'dn ' + cls; d.el.style.display = 'block';
  d.pos.copy(pos); d.pos.y += 0.3; d.life = (cls === 'ko' || cls === 'gold') ? 1.1 : 0.75; d.max = d.life; d.vx = (Math.random() - 0.5) * 1.5;
}
// screen messages
export const centerEl = $('center'), toastEl = $('toast');
export let centerT = 0, toastT = 0;
// Big text in the middle of the screen (countdown, "DEFEATED").
export function centerMsg(html, dur = 1.5) { centerEl.innerHTML = html; centerEl.style.opacity = 1; centerT = dur; }
// Small message near the top of the screen.
export function toast(html, dur = 3.5) { toastEl.innerHTML = html; toastEl.style.opacity = 1; toastT = dur; }

// shakeAmt = how hard the camera is shaking.  hitstop = seconds of slow motion left after a hit (the impact freeze).
// hurtFlash = strength of the red screen edge when the player is hit.
export let shakeAmt = 0, hitstop = 0, hurtFlash = 0;
export const shake = v => { shakeAmt = Math.max(shakeAmt, v * TUNE.shakeMult); };

// ================= fx update =================
export const projV = new V3();
// Age every active effect. Runs once per frame while playing.
export function updateFx(dt) {
  for (const a of arcs) {
    if (a.life <= 0) continue;
    a.life -= dt; const t = 1 - a.life / a.max;
    a.m.material.opacity = 0.85 * (1 - t); a.g.scale.setScalar(a.base * (0.85 + t * 0.3));
    if (a.life <= 0) a.g.visible = false;
  }
  for (const r of rings) {
    if (r.life <= 0) continue;
    r.life -= dt; const t = 1 - r.life / r.max;
    r.m.scale.setScalar(lerp(r.s0, r.s1, easeOut(t))); r.m.material.opacity = 0.8 * (1 - t);
    if (r.life <= 0) r.m.visible = false;
  }
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt; p.v.y -= 25 * dt; p.m.position.addScaledVector(p.v, dt);
    p.m.scale.setScalar(Math.max(0.01, p.life * 2.2));
    if (p.life <= 0) p.m.visible = false;
  }
  for (const g of ghosts) {
    if (g.life <= 0) continue;
    g.life -= dt; g.mat.opacity = 0.42 * (g.life / g.max);
    if (g.life <= 0) g.sm.root.visible = false;
  }
  for (const g of glows) {
    if (g.life <= 0) continue;
    g.life -= dt;
    const t = 1 - g.life / g.max;
    g.m.material.opacity = 0.7 * (1 - t);
    g.m.scale.setScalar(g.size * (0.7 + t * 0.6));
    if (g.life <= 0) g.m.visible = false;
  }
  for (const b of beams) {
    if (b.life <= 0) continue;
    b.life -= dt; b.m.material.opacity = 0.9 * Math.max(0, b.life / b.max);
    if (b.life <= 0) b.m.visible = false;
  }
}
// The same for the HTML effects (floating text, messages, red edge). Uses real time, so they keep moving during hitstop.
export function updateDomFx(rdt) {
  const W = innerWidth, H = innerHeight;
  for (const d of dns) {
    if (d.life <= 0) continue;
    d.life -= rdt; d.pos.y += rdt * 1.4; d.pos.x += d.vx * rdt;
    if (d.life <= 0) { d.el.style.display = 'none'; continue; }
    projV.copy(d.pos).project(camera);
    if (projV.z > 1) { d.el.style.opacity = 0; continue; }
    const t = 1 - d.life / d.max, sc = t < 0.12 ? 1.6 - t * 5 : 1;
    d.el.style.transform = `translate(${(projV.x * 0.5 + 0.5) * W}px,${(-projV.y * 0.5 + 0.5) * H}px) translate(-50%,-50%) scale(${sc})`;
    d.el.style.opacity = t > 0.6 ? (1 - t) / 0.4 : 1;
  }
  if (centerT > 0) { centerT -= rdt; if (centerT <= 0) centerEl.style.opacity = 0; }
  if (toastT > 0) { toastT -= rdt; if (toastT <= 0) toastEl.style.opacity = 0; }
  if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - rdt * 2.5);
  if (flashT > 0) {
    flashT = Math.max(0, flashT - rdt * 1.5);
    flashEl.style.opacity = flashT;
  }
  hurtEl.style.opacity = Math.max(hurtFlash, P.hp < 35 ? 0.35 : 0);
}
export const hurtEl = $('hurt');
// White screen flash that fades out (teleports). flashT is its strength, 1 = full white.
export const flashEl = $('flash');
export let flashT = 0;
export function flash(strength = 1) {
  flashT = strength;
  flashEl.style.opacity = strength;
}

// setters for other modules (an imported `let` is read-only)
export function addHitstop(v) { hitstop = Math.max(hitstop, v * TUNE.hitstopMult); }
export function tickHitstop(rdt) { hitstop -= rdt; }
export function decayShake(rdt) { shakeAmt *= Math.exp(-10 * rdt); }
export function flashHurt() { hurtFlash = 1; }
