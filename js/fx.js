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
// A few effects (afterimages, beams, impact halos) are drawn "additively": their colour is added on top of what
// is behind them, which makes them look like light. It is kept subtle on purpose: slashes are painted, not glowing.
// toneMapped: false keeps an effect's colour pure. Both are free.
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
// ---------- painted slashes ----------
// The look comes from Japanese woodblock prints of waves (the style the anime Demon Slayer uses for its sword
// techniques): a flat crescent of colour with a dark ink outline and white foam along its leading edge. It is drawn,
// not lit, so there is no glow. Each slash is two flat layers sharing one shape: the BODY, which takes the class
// colour, and the INK (outline, foam, streaks), which stays dark and white whatever the colour.
// A slash also moves "on twos": its animation advances in a few visible steps, like hand-drawn frames.
const INK = '#0a1030';
const PAINT_W = 512, PAINT_H = 192;
const PEN = PAINT_W / 256;    // pen sizes below are written for a 256-wide picture and scaled by this
// Draw one layer of a crescent onto a canvas and return it as a texture.
//   outer(u), inner(u) = where the two edges of the shape are, 0..1 across the strip, for u = 0..1 along it.
//   foamFrom, foamTo = the part of the outer edge that gets foam.
function paintCrescent(layer, outer, inner, foamFrom, foamTo) {
  const canvas = document.createElement('canvas');
  canvas.width = PAINT_W;
  canvas.height = PAINT_H;
  const ctx = canvas.getContext('2d');
  const px = u => u * PAINT_W;
  const py = v => (1 - v) * PAINT_H;    // v = 1 is the top of the picture
  const STEPS = 64;
  const outline = () => {
    ctx.beginPath();
    for (let k = 0; k <= STEPS; k++) ctx.lineTo(px(k / STEPS), py(outer(k / STEPS)));
    for (let k = STEPS; k >= 0; k--) ctx.lineTo(px(k / STEPS), py(inner(k / STEPS)));
    ctx.closePath();
  };
  // A line that follows the shape, a fraction f of the way from the inner edge to the outer one.
  const flowLine = (f, from, to) => {
    ctx.beginPath();
    for (let k = 0; k <= STEPS; k++) {
      const u = from + (to - from) * k / STEPS;
      ctx.lineTo(px(u), py(inner(u) + (outer(u) - inner(u)) * f));
    }
    ctx.stroke();
  };
  if (layer === 'body') {
    // White at the leading edge down to mid grey at the trailing edge. Multiplied by the class colour later,
    // this gives a light tone and a deep tone of that colour.
    const g = ctx.createLinearGradient(0, py(0.95), 0, py(0.15));
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#6f6f6f');
    ctx.fillStyle = g;
    outline();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 4 * PEN;
    flowLine(0.28, 0.08, 0.95);
    flowLine(0.58, 0.12, 0.95);
  } else {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3 * PEN;
    outline();
    ctx.stroke();
    // white streaks flowing along the inside
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2 * PEN;
    flowLine(0.44, 0.2, 0.9);
    flowLine(0.74, 0.3, 0.96);
    // foam: a row of white blobs with ink outlines along the leading edge, bigger where the shape is thicker
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2 * PEN;
    for (let u = foamFrom; u <= foamTo; u += 0.036) {
      const thick = outer(u) - inner(u);
      const r = (3 + 9 * thick * (0.7 + Math.random() * 0.6)) * PEN;
      ctx.beginPath();
      ctx.arc(px(u), py(outer(u)) + r * 0.25, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // spray: a few loose droplets beyond the foam
    for (let k = 0; k < 14; k++) {
      const u = foamFrom + (foamTo - foamFrom) * Math.random();
      ctx.beginPath();
      ctx.arc(px(u), py(Math.min(0.99, outer(u) + 0.03 + Math.random() * 0.07)), (1.5 + Math.random() * 1.5) * PEN, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
// The two materials for a painted shape. Each object gets its own pair so it can fade and be coloured on its own.
function paintMats(texBody, texInk) {
  const common = { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false };
  return [new THREE.MeshBasicMaterial({ map: texBody, ...common }), new THREE.MeshBasicMaterial({ map: texInk, ...common })];
}
// A flat curved strip: part of a ring from radius r0 to r1, starting at angle a0 and spanning len (radians).
// Unlike three.js's own ring, the picture runs ALONG the curve (u) and ACROSS it (v), which the crescents need.
function arcGeo(r0, r1, a0, len, repeatU = 1) {
  const SEG = 36, pos = [], uv = [], idx = [];
  for (let k = 0; k <= SEG; k++) {
    const a = a0 + len * k / SEG, c = Math.cos(a), sn = Math.sin(a);
    pos.push(c * r0, sn * r0, 0, c * r1, sn * r1, 0);
    uv.push(k / SEG * repeatU, 0, k / SEG * repeatU, 1);
    if (k < SEG) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// The crescent: pointed at both ends, fattest a little towards the leading end (u = 1).
const crescentThick = u => Math.pow(Math.sin(Math.PI * Math.pow(u, 1.4)), 0.55);
const crescentOuter = u => 0.88 - 0.08 * (1 - crescentThick(u));
const crescentInner = u => crescentOuter(u) - 0.72 * crescentThick(u);
const crescentBody = paintCrescent('body', crescentOuter, crescentInner, 0.25, 0.97);
const crescentInk = paintCrescent('ink', crescentOuter, crescentInner, 0.25, 0.97);

// Slash arcs. arcH = the half circle in front of the player for sideways swings, arcV = the tall one for overhead swings.
export const arcH = arcGeo(1.0, 2.5, Math.PI, Math.PI);
export const arcV = arcGeo(0.9, 2.4, -Math.PI / 3, 5 * Math.PI / 6);
export const arcs = [];
const ARC_FRAMES = 7;    // how many visible steps a slash's animation has
for (let i = 0; i < 8; i++) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const piv = new THREE.Group();
  const [bodyMat, inkMat] = paintMats(crescentBody, crescentInk);
  const body = new THREE.Mesh(arcH, bodyMat), ink = new THREE.Mesh(arcH, inkMat);
  ink.renderOrder = 1;    // the ink is always drawn over the colour
  piv.add(body); piv.add(ink);
  g.add(piv); g.visible = false; scene.add(g);
  arcs.push({ g, piv, body, ink, life: 0, max: 0.26, base: 1, yaw: 0, dir: 1, sweep: 0 });
}
export let arcIdx = 0;
// Slash arc. type 0 / 1 = sideways swing right-to-left / left-to-right, 2 = vertical swing.
export function spawnArc(type, pos, yaw, color = 0x00d8f0, scale = 1) {
  const a = arcs[arcIdx = (arcIdx + 1) % arcs.length];
  a.g.position.copy(pos); a.g.rotation.set(0, yaw, type === 0 ? 0.28 : type === 1 ? -0.28 : 0);
  const geo = type === 2 ? arcV : arcH;
  a.body.geometry = geo; a.ink.geometry = geo;
  if (type === 2) a.piv.rotation.set(0, -Math.PI / 2, 0); else a.piv.rotation.set(-Math.PI / 2, 0, 0);
  a.piv.scale.x = type === 1 ? -1 : 1;    // mirrored for the swing going the other way
  a.yaw = yaw;
  a.dir = type === 1 ? -1 : 1;
  a.sweep = type === 2 ? 0 : 0.9;         // sideways slashes start turned back and swing round into place
  a.body.material.color.setHex(color); a.life = a.max; a.base = scale; a.g.visible = true;
}

// Swirls: a full ring of two crescents chasing each other, lying flat. Used for the Cyclone whirlpool and the wave
// that rolls out from a Meteor Slam.
const swirlGeo = arcGeo(0.42, 1, 0, Math.PI * 2, 2);
export const swirls = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const [bodyMat, inkMat] = paintMats(crescentBody, crescentInk);
  const body = new THREE.Mesh(swirlGeo, bodyMat), ink = new THREE.Mesh(swirlGeo, inkMat);
  body.rotation.x = ink.rotation.x = -Math.PI / 2;
  ink.renderOrder = 1;
  g.add(body); g.add(ink); g.visible = false; scene.add(g);
  swirls.push({ g, body, ink, life: 0, max: 0.4, radius: 1, spin: 0, grow: 0, follow: null, lift: 0 });
}
export let swirlIdx = 0;
// radius = size, dur = seconds, spin = turning speed (radians per second), grow = how much bigger it gets (1 = doubles).
// follow (optional) = a position to stay on, such as P.pos, with lift = height above it.
export function spawnSwirl(pos, radius, color, dur, spin = 12, grow = 0, follow = null, lift = 0) {
  const w = swirls[swirlIdx = (swirlIdx + 1) % swirls.length];
  w.g.position.copy(pos);
  w.body.material.color.setHex(color);
  w.life = w.max = dur; w.radius = radius; w.spin = spin; w.grow = grow; w.follow = follow; w.lift = lift;
  w.g.rotation.y = Math.random() * Math.PI * 2;
  w.g.visible = true;
}

// Weapon trail: a painted ribbon stretched between where the blade was over the last moments.
// trailPts holds recent blade positions (base and tip), newest first. The strip is rebuilt from them every frame.
const TRAIL_MAX = 18;       // most positions remembered
const TRAIL_LIFE = 0.17;    // seconds a position stays part of the ribbon
const trailOuter = () => 0.9;
const trailInner = u => Math.min(0.88, 0.08 + 0.82 * Math.pow(u, 1.25));    // full width at the blade, a point at the tail
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 6), 3).setUsage(THREE.DynamicDrawUsage));
trailGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 4), 2).setUsage(THREE.DynamicDrawUsage));
{
  const idx = [];
  for (let k = 0; k < TRAIL_MAX - 1; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
  trailGeo.setIndex(idx);
}
const [trailBodyMat, trailInkMat] = paintMats(paintCrescent('body', trailOuter, trailInner, 0.02, 0.6), paintCrescent('ink', trailOuter, trailInner, 0.02, 0.6));
trailBodyMat.opacity = 0.92; trailInkMat.opacity = 1;
export const trail = new THREE.Group();
{
  const body = new THREE.Mesh(trailGeo, trailBodyMat), ink = new THREE.Mesh(trailGeo, trailInkMat);
  body.frustumCulled = ink.frustumCulled = false;    // its shape changes every frame, so skip the "is it on screen" test
  ink.renderOrder = 1;
  trail.add(body); trail.add(ink);
}
trail.visible = false; scene.add(trail);
const trailPts = [];
for (let i = 0; i < TRAIL_MAX; i++) trailPts.push({ base: new V3(), tip: new V3(), age: 0 });
let trailCount = 0;
// Once per frame (anim.js). emitting = the weapon is swinging right now; base and tip = the two ends of the blade.
export function updateTrail(dt, emitting, base, tip, color) {
  for (let i = 0; i < trailCount; i++) trailPts[i].age += dt;
  while (trailCount > 0 && trailPts[trailCount - 1].age > TRAIL_LIFE) trailCount--;
  // A jump of many units in one frame is a teleport, not a swing: start the ribbon again instead of stretching it there.
  if (emitting && trailCount > 0 && trailPts[0].tip.distanceTo(tip) > 14) trailCount = 0;
  if (emitting) {
    // put the newest position first by recycling the oldest slot
    const p = trailPts.pop();
    trailPts.unshift(p);
    p.base.copy(base); p.tip.copy(tip); p.age = 0;
    trailCount = Math.min(TRAIL_MAX, trailCount + 1);
    trailBodyMat.color.setHex(color);
  }
  trail.visible = trailCount >= 2;
  if (!trail.visible) return;
  const pos = trailGeo.attributes.position, uv = trailGeo.attributes.uv;
  for (let i = 0; i < trailCount; i++) {
    const p = trailPts[i], u = Math.min(1, p.age / TRAIL_LIFE);
    pos.setXYZ(i * 2, p.base.x, p.base.y, p.base.z);
    pos.setXYZ(i * 2 + 1, p.tip.x, p.tip.y, p.tip.z);
    uv.setXY(i * 2, u, 0);
    uv.setXY(i * 2 + 1, u, 1);
  }
  pos.needsUpdate = true; uv.needsUpdate = true;
  trailGeo.setDrawRange(0, (trailCount - 1) * 6);
}
export const ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
export const rings = [];
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
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
  // only a big burst (a heavy hit) flashes a small halo
  if (mat === 0 && n >= 14) spawnGlow(pos, 0xffb24a, 1.2 + n * 0.05, 0.16);
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
    a.life -= dt;
    // t goes 0..1 over the slash's life, but in a few steps, so it moves like hand-drawn frames
    const t = Math.floor((1 - a.life / a.max) * ARC_FRAMES) / ARC_FRAMES;
    const swing = easeOut(Math.min(1, t / 0.45));
    a.g.rotation.y = a.yaw - a.dir * a.sweep * (1 - swing);
    a.g.scale.setScalar(a.base * (0.82 + 0.22 * swing));
    const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;    // fully painted for the first half, then gone quickly
    a.body.material.opacity = 0.92 * fade; a.ink.material.opacity = fade;
    if (a.life <= 0) a.g.visible = false;
  }
  for (const w of swirls) {
    if (w.life <= 0) continue;
    w.life -= dt;
    const t = 1 - w.life / w.max;
    if (w.follow) w.g.position.copy(w.follow).y += w.lift;
    w.g.rotation.y += w.spin * dt;
    w.g.scale.setScalar(w.radius * (1 + w.grow * easeOut(t)));
    const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    w.body.material.opacity = 0.92 * fade; w.ink.material.opacity = fade;
    if (w.life <= 0) w.g.visible = false;
  }
  for (const r of rings) {
    if (r.life <= 0) continue;
    r.life -= dt; const t = 1 - r.life / r.max;
    r.m.scale.setScalar(lerp(r.s0, r.s1, easeOut(t))); r.m.material.opacity = 0.6 * (1 - t);
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
    g.life -= dt; g.mat.opacity = 0.24 * (g.life / g.max);
    if (g.life <= 0) g.sm.root.visible = false;
  }
  for (const g of glows) {
    if (g.life <= 0) continue;
    g.life -= dt;
    const t = 1 - g.life / g.max;
    g.m.material.opacity = 0.4 * (1 - t);
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
