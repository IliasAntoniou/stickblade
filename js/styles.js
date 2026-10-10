// styles.js: sword styles. A style is a temporary change to the sword: a new colour and painted look for the
// slashes, plus one extra effect on top of the normal moves. It lasts STYLE_TIME seconds.
// Styles are taken from objects in the world ("sources"): slam into a pool for Water, strike a brazier for Flame.
// A source does nothing until its style has been unlocked by passing its trial (progress.js); until then it sits dark.
// Dying, teleporting, changing class and starting a trial all end the current style, so trials start plain.

import * as THREE from 'three';
import { V3, _fx } from './util.js';
import { scene } from './core.js';
import { addBox, removeBox, COL } from './world.js';
import { glowTex, spawnRing, spawnSwirl, burst, toast, setTrailPaint } from './fx.js';
import { P, CL } from './state.js';
import { bladeMat, bladeGlow } from './player.js';
import { styleUnlocked } from './progress.js';

export const STYLE_TIME = 20;    // seconds a style lasts once taken

// The styles. color = slash and blade colour. paint = which painted look the slash uses (see setTrailPaint in fx.js).
// reach = multiplies how far sword attacks, Cyclone and Meteor Slam reach.
// how = how to take it, perk = what it does (both shown to the player).
export const STYLES = {
  water: {
    id: 'water', name: 'Water', color: 0x2f8fff, paint: 'water', reach: 1.2,
    flow: 0.12,        // seconds taken off every cooldown each time a hit lands
    how: 'Meteor Slam into a pool', perk: 'Slashes reach further, and every hit shortens your cooldowns',
  },
  flame: {
    id: 'flame', name: 'Flame', color: 0xff5a1a, paint: 'flame', reach: 1,
    burnTime: 4,       // seconds a target keeps burning after the last hit
    burnDps: 14,       // burn damage per second
    how: 'Strike a brazier with your sword', perk: 'Every hit sets the target burning',
  },
};

// The style in use right now: cur = one of STYLES or null, left = seconds remaining.
export const style = { cur: null, left: 0 };

// The colour slashes and sword effects should be: the style's, or the class's when there is none.
export function slashColor() { return style.cur ? style.cur.color : CL.color; }
// Multiplier for how far sword attacks reach.
export function reach() { return style.cur ? style.cur.reach : 1; }

// Make the sword look like the current style (or plain again).
function applyLook() {
  if (!CL) return;
  bladeMat.color.setHex(slashColor());
  bladeGlow.material.color.setHex(slashColor());
  setTrailPaint(style.cur ? style.cur.paint : 'plain');
}
// Take a style. Returns false if it has not been unlocked. Taking it again refills the time.
export function giveStyle(id) {
  if (!STYLES[id] || !styleUnlocked(id)) return false;
  style.cur = STYLES[id];
  style.left = STYLE_TIME;
  applyLook();
  _fx.copy(P.pos).setY(P.pos.y + 0.1);
  spawnRing(_fx, 0.4, 4.5, 0.45, style.cur.color);
  spawnSwirl(_fx, 2.4, style.cur.color, 0.6, 9, 0.5);
  burst(_fx.setY(P.pos.y + 1), 18, 8);
  toast(`<b>${style.cur.name} style</b> for ${STYLE_TIME} seconds. ${style.cur.perk}.`, 3.5);
  return true;
}
// Testing only (tests/poses.js): put a style on without it being unlocked, and without touching the save.
export function forceStyle(id) {
  style.cur = STYLES[id] || null;
  style.left = STYLE_TIME;
  applyLook();
}
// End the current style, if any.
export function clearStyle() {
  style.cur = null;
  style.left = 0;
  applyLook();
}
// Called by hitDummy for every hit that lands: the style's extra effect.
export function onStyleHit(ev) {
  const s = style.cur;
  if (!s) return;
  if (s.burnTime) {
    ev.d.burnT = s.burnTime;
    ev.d.burnDps = s.burnDps;
  }
  if (s.flow) {
    for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - s.flow);
  }
}

// ---------- sources: the objects a style is taken from ----------
const POOL_RADIUS = 3.2;
const poolGeo = new THREE.CircleGeometry(POOL_RADIUS, 40).rotateX(-Math.PI / 2);
const poolRimGeo = new THREE.RingGeometry(POOL_RADIUS, POOL_RADIUS + 0.28, 40).rotateX(-Math.PI / 2);
const flameGeo = new THREE.ConeGeometry(0.4, 1.05, 8);
export const sources = [];

// Put a source in the world. id = the style it gives ('water' makes a pool, 'flame' a brazier). Returns the source.
export function addSource(id, x, y, z) {
  const s = { id, pos: new V3(x, y, z), group: new THREE.Group(), box: null, open: null };
  s.group.position.set(x, y, z);
  if (id === 'water') {
    s.surface = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ color: 0x2f8fff, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
    s.surface.position.y = 0.03;
    const rim = new THREE.Mesh(poolRimGeo, new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    rim.position.y = 0.035;
    s.group.add(s.surface);
    s.group.add(rim);
  } else {
    s.box = addBox(x, y, z, 1, 1.1, 1, COL.stone);    // the stand: solid, so it can be walked into and stood on
    s.fire = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xff7a1f, toneMapped: false }));
    s.fire.position.y = 1.65;
    s.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45, toneMapped: false }));
    s.glow.position.y = 1.7;
    s.glow.scale.setScalar(2.4);
    s.group.add(s.fire);
    s.group.add(s.glow);
  }
  scene.add(s.group);
  sources.push(s);
  return s;
}
export function removeSource(s) {
  const i = sources.indexOf(s);
  if (i >= 0) sources.splice(i, 1);
  scene.remove(s.group);
  if (s.box) removeBox(s.box);
}

// Called by attackHits (player.js) with the circle a sword swing covers: a swing that reaches a brazier takes Flame.
export function strikeSources(cx, cz, rad) {
  for (const s of sources) {
    if (s.id !== 'flame') continue;
    const near = Math.hypot(s.pos.x - cx, s.pos.z - cz) < rad + 0.5 && Math.abs(s.pos.y - P.pos.y) < 2;
    if (near && (!style.cur || style.cur.id !== 'flame' || style.left < STYLE_TIME - 1)) giveStyle('flame');
  }
}
// Called by groundImpact (player.js) when a slam lands: landing in a pool takes Water.
export function slamSources() {
  for (const s of sources) {
    if (s.id !== 'water') continue;
    if (Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z) < POOL_RADIUS + 0.4 && Math.abs(s.pos.y - P.pos.y) < 1.5) giveStyle('water');
  }
}

// The line of help shown when the player stands near a source, or null.
export function sourceHint() {
  for (const s of sources) {
    const dist = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z);
    if (dist > (s.id === 'water' ? POOL_RADIUS + 2.5 : 4) || Math.abs(s.pos.y - P.pos.y) > 3) continue;
    const st = STYLES[s.id], thing = s.id === 'water' ? 'Water pool' : 'Brazier';
    if (!styleUnlocked(s.id)) return `${thing} · you cannot draw on it yet. <b>Master Sen</b> can teach you.`;
    return `${thing} · ${st.how} to take <b>${st.name}</b> for ${STYLE_TIME}s`;
  }
  return null;
}

// Once per frame (main.js): run down the style's time, and show each source as live or dark.
export function updateStyles(dt) {
  if (style.cur) {
    style.left -= dt;
    if (style.left <= 0) clearStyle();
  }
  const t = performance.now() / 1000;
  for (const s of sources) {
    const open = styleUnlocked(s.id);
    if (s.id === 'water') {
      s.surface.material.color.setHex(open ? 0x2f8fff : 0x6b7386);
      s.surface.material.opacity = open ? 0.62 + Math.sin(t * 2.2) * 0.1 : 0.22;
    } else {
      s.fire.visible = s.glow.visible = open;    // an unlit brazier until the style is unlocked
      s.fire.scale.y = 1 + Math.sin(t * 9 + s.pos.x) * 0.14;
      s.fire.rotation.y = t * 2;
    }
  }
}

// The sources in the main arena. (Trials add their own to the training hall through dojo.js.)
addSource('water', -17, 0, 12);
addSource('flame', 15, 0, 14);
