// styles.js: sword styles. A style is a temporary change to the character: a new colour and painted look for the
// slashes, a new skin, and one extra effect on top of the normal moves. It lasts STYLE_TIME seconds.
// Styles are taken from places in the world ("sources"): Meteor Slam into a pool for Water, Blink Strike into a
// fire for Flame. Taking one plays a short scene: the character goes under the water or stands burning in the
// fire, a close-up of his eyes changing colour cuts across the screen (cutin.js), and he comes out changed.
// A source does nothing until its style has been unlocked by passing its trial (progress.js); until then the pool
// is still and grey and the fire is out.
// Dying, teleporting, changing class and starting a trial all end the current style, so trials start plain.

import * as THREE from 'three';
import { V3, clamp, easeOut, _fx } from './util.js';
import { scene } from './core.js';
import { glowTex, spawnRing, spawnSwirl, burst, toast, setTrailPaint } from './fx.js';
import { P, CL } from './state.js';
import { player, playerMat, bladeMat, bladeGlow, setState } from './player.js';
import { styleUnlocked } from './progress.js';
import { playCutin } from './cutin.js';

export const STYLE_TIME = 20;    // seconds a style lasts once taken
const PLAIN_SKIN = 0xeef1f8;     // the player's normal body colour (matches playerMat in player.js)

// The styles. color = slash and blade colour. paint = which painted look the slash uses (see setTrailPaint in fx.js).
// skin = body colour while the style lasts. ember = a colour the body glows with, pulsing (0 = none).
// reach = multiplies how far sword attacks, Cyclone and Meteor Slam reach.
// how = how to take it, perk = what it does (both shown to the player).
export const STYLES = {
  water: {
    id: 'water', name: 'Water', color: 0x2f8fff, paint: 'water', reach: 1.2,
    skin: 0x3d8ef0, ember: 0x0b3fae,
    flow: 0.12,        // seconds taken off every cooldown each time a hit lands
    how: 'Meteor Slam into a pool', perk: 'Slashes reach further, and every hit shortens your cooldowns',
  },
  flame: {
    id: 'flame', name: 'Flame', color: 0xff5a1a, paint: 'flame', reach: 1,
    skin: 0x2a1512, ember: 0xff4a00,    // a dark body lit from within: on screen it reads as glowing ember red
    burnTime: 4,       // seconds a target keeps burning after the last hit
    burnDps: 14,       // burn damage per second
    how: 'Blink Strike into a fire', perk: 'Every hit sets the target burning',
  },
};

// The style in use right now: cur = one of STYLES or null, left = seconds remaining.
export const style = { cur: null, left: 0 };

// The colour slashes and sword effects should be: the style's, or the class's when there is none.
export function slashColor() { return style.cur ? style.cur.color : CL.color; }
// Multiplier for how far sword attacks reach.
export function reach() { return style.cur ? style.cur.reach : 1; }

// Make the character look like the current style (or plain again): blade, slash and skin.
function applyLook() {
  if (!CL) return;
  bladeMat.color.setHex(slashColor());
  bladeGlow.material.color.setHex(slashColor());
  setTrailPaint(style.cur ? style.cur.paint : 'plain');
  playerMat.color.setHex(style.cur ? style.cur.skin : PLAIN_SKIN);
  if (!style.cur) playerMat.emissive.setHex(0);
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
  P.sink = 0;
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

// ---------- textures, each drawn once ----------
// Water: a round picture that is dark in the middle and lighter at the edge, which reads as depth.
const depthTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, '#061a4a');
  g.addColorStop(0.55, '#0e3f9a');
  g.addColorStop(0.9, '#2f8fff');
  g.addColorStop(1, '#9fd0ff');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
// Water: pale wavy lines that drift across the surface, like light on ripples. Repeats in both directions.
const rippleTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,255,255,0.55)';
  x.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const px = Math.random() * 256, py = Math.random() * 256, len = 14 + Math.random() * 30;
    x.lineWidth = 1.5 + Math.random() * 2.5;
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo(px + len * 0.5, py - 5 - Math.random() * 6, px + len, py);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
})();
// Fire: one tongue of flame, white-yellow at the base through orange to red at the tip.
const flameTex = (() => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,250,210,1)');
  g.addColorStop(0.25, 'rgba(255,205,80,1)');
  g.addColorStop(0.6, 'rgba(255,110,25,0.9)');
  g.addColorStop(1, 'rgba(200,30,10,0)');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(32, 2);
  x.bezierCurveTo(54, 50, 62, 92, 44, 124);
  x.quadraticCurveTo(32, 130, 20, 124);
  x.bezierCurveTo(2, 92, 16, 56, 32, 2);
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
function flameSprite(scale) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  m.center.set(0.5, 0.05);    // scales from its base, so it grows upwards
  m.scale.set(scale * 0.55, scale, 1);
  m.userData.size = scale;
  return m;
}

// Flames on the player's own body: big while he stands in the fire, small while the Flame style lasts.
const bodyFire = new THREE.Group();
for (const [x, y, z, size] of [[0, 0.1, 0, 2.3], [0.22, 0.9, 0.05, 1.3], [-0.2, 1.1, -0.05, 1.2], [0, 1.6, 0, 1.0]]) {
  const f = flameSprite(size);
  f.position.set(x, y, z);
  bodyFire.add(f);
}
bodyFire.visible = false;

// ---------- sources: the places a style is taken from ----------
const POOL_RADIUS = 3.2, FIRE_RADIUS = 1.1;
const poolGeo = new THREE.CircleGeometry(POOL_RADIUS, 40).rotateX(-Math.PI / 2);
// A low stone ring: the rim of the pool and the edge of the fire pit. Few sides, so it looks like set stones.
const rimGeo = (radius, thick) => new THREE.TorusGeometry(radius, thick, 5, 14).rotateX(-Math.PI / 2);
const poolRimGeo = rimGeo(POOL_RADIUS + 0.12, 0.26), fireRimGeo = rimGeo(FIRE_RADIUS, 0.24);
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a8496 });
export const sources = [];

// Put a source in the world. id = the style it gives ('water' makes a pool, 'flame' a fire pit). Returns the source.
export function addSource(id, x, y, z) {
  const s = { id, pos: new V3(x, y, z), group: new THREE.Group(), emberT: 0 };
  s.group.position.set(x, y, z);
  if (id === 'water') {
    s.depth = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ map: depthTex, transparent: true, opacity: 0.94, depthWrite: false }));
    s.depth.position.y = 0.03;
    s.ripples = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ map: rippleTex, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    s.ripples.position.y = 0.045;
    const rim = new THREE.Mesh(poolRimGeo, stoneMat);
    rim.position.y = 0.05;
    s.group.add(s.depth); s.group.add(s.ripples); s.group.add(rim);
  } else {
    const rim = new THREE.Mesh(fireRimGeo, stoneMat);
    rim.position.y = 0.08;
    s.group.add(rim);
    // s.fire holds everything that only shows while the fire is lit
    s.fire = new THREE.Group();
    for (const [fx, fz, size] of [[0, 0, 2.6], [0.38, 0.2, 1.7], [-0.36, 0.14, 1.9], [0.05, -0.4, 1.5]]) {
      const f = flameSprite(size);
      f.position.set(fx, 0.05, fz);
      s.fire.add(f);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7a22, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5, toneMapped: false }));
    glow.position.y = 0.9;
    glow.scale.setScalar(4.2);
    glow.userData.glow = true;
    s.fire.add(glow);
    s.group.add(s.fire);
  }
  scene.add(s.group);
  sources.push(s);
  return s;
}
export function removeSource(s) {
  const i = sources.indexOf(s);
  if (i >= 0) sources.splice(i, 1);
  scene.remove(s.group);
}

// Called by groundImpact (player.js) when a slam lands: landing in a pool starts the Water scene.
export function slamSources() {
  for (const s of sources) {
    if (s.id !== 'water' || !styleUnlocked('water')) continue;
    if (Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z) < POOL_RADIUS + 0.4 && Math.abs(s.pos.y - P.pos.y) < 1.5) startTake(s);
  }
}
// Called by Blink Strike (classes/blade.js) before it does anything else. origin = where the blink starts,
// dir = where the camera looks, range = how far a blink goes. Returns a lit fire the blink is aimed at, or null.
// Only the direction along the ground is compared, so the crosshair does not have to be exactly on the flames.
export function blinkSource(origin, dir, range) {
  const len = Math.hypot(dir.x, dir.z) || 1, dx = dir.x / len, dz = dir.z / len;
  for (const s of sources) {
    if (s.id !== 'flame' || !styleUnlocked('flame')) continue;
    const ox = s.pos.x - origin.x, oz = s.pos.z - origin.z;
    const along = ox * dx + oz * dz;                  // how far ahead the fire is
    const aside = Math.abs(ox * dz - oz * dx);        // how far off to the side of the line of the blink
    if (along > 0.5 && along < range + 1.5 && aside < 1.9 && Math.abs(s.pos.y - origin.y) < 3) return s;
  }
  return null;
}

// ---------- the scene played when a style is taken ----------
const SINK_DEPTH = 2.2;        // how far under the surface the character goes
const TAKE_CUTIN_AT = 0.3;     // seconds into the scene when the close-up of the eyes starts
const TAKE_END = 0.62;         // seconds into the scene when the character comes out, changed
// Begin it: the player is put in the middle of the source and held there. State 'submerge' or 'ignite'.
export function startTake(s) {
  P.pos.x = s.pos.x; P.pos.z = s.pos.z; P.pos.y = s.pos.y;
  P.vel.set(0, 0, 0);
  P.atk.on = false;
  P.takeCut = false;
  _fx.copy(s.pos).setY(s.pos.y + 0.1);
  if (s.id === 'water') {
    setState('submerge');
    spawnRing(_fx, 0.6, POOL_RADIUS + 1.5, 0.5, 0x9fd0ff);
    spawnSwirl(_fx, POOL_RADIUS * 0.7, STYLES.water.color, 0.7, 5, 0.6);
    burst(_fx.setY(s.pos.y + 0.4), 22, 10, 1);
  } else {
    setState('ignite');
    spawnRing(_fx, 0.4, 3.2, 0.4, STYLES.flame.color);
    burst(_fx.setY(s.pos.y + 0.8), 24, 9);
  }
}
// Runs every frame of the 'submerge' and 'ignite' states (from the state switch in update.js).
export function updateTake() {
  const water = P.state === 'submerge', id = water ? 'water' : 'flame';
  P.vel.set(0, 0, 0);
  P.grav = 0;
  if (water) P.sink = SINK_DEPTH * easeOut(clamp(P.st / 0.26, 0, 1));
  if (P.st >= TAKE_CUTIN_AT && !P.takeCut) {
    P.takeCut = true;
    playCutin(STYLES[id].color);
  }
  if (P.st >= TAKE_END) {
    P.sink = 0;
    setState('normal');
    giveStyle(id);
    if (water) P.vel.y = 13;    // he bursts back out of the water
    P.iframes = 0.4;
  }
}

// The line of help shown when the player stands near a source, or null.
export function sourceHint() {
  for (const s of sources) {
    const dist = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z);
    if (dist > (s.id === 'water' ? POOL_RADIUS + 2.5 : 5) || Math.abs(s.pos.y - P.pos.y) > 3) continue;
    const st = STYLES[s.id], thing = s.id === 'water' ? 'Pool' : 'Fire pit';
    if (!styleUnlocked(s.id)) return `${thing} · you cannot draw on it yet. <b>Master Sen</b> can teach you.`;
    return `${thing} · ${st.how} to take <b>${st.name}</b> for ${STYLE_TIME}s`;
  }
  return null;
}

// Once per frame (main.js): run down the style's time, animate the water and the fires, and the player's skin.
export function updateStyles(dt) {
  if (style.cur) {
    style.left -= dt;
    if (style.left <= 0) clearStyle();
  }
  const t = performance.now() / 1000;
  rippleTex.offset.set(t * 0.035, t * 0.022);    // the ripples drift
  for (const s of sources) {
    const open = styleUnlocked(s.id);
    if (s.id === 'water') {
      // locked: still, grey and dull. unlocked: deep blue with moving light on it.
      s.depth.material.color.setHex(open ? 0xffffff : 0x5a5f6e);
      s.ripples.visible = open;
      s.ripples.material.opacity = 0.42 + Math.sin(t * 1.7) * 0.1;
    } else {
      s.fire.visible = open;    // an unlit pit until the style is unlocked
      if (!open) continue;
      for (const f of s.fire.children) {
        if (f.userData.glow) { f.material.opacity = 0.42 + Math.sin(t * 11 + s.pos.x) * 0.1; continue; }
        // each flame flickers at its own pace: taller and thinner, then shorter and wider
        const flick = 1 + Math.sin(t * (9 + f.userData.size * 3) + f.position.x * 7) * 0.16 + Math.sin(t * 23 + f.position.z * 5) * 0.07;
        f.scale.set(f.userData.size * 0.55 / flick, f.userData.size * flick, 1);
      }
      s.emberT -= dt;
      if (s.emberT <= 0) {    // a spark jumps out every so often
        s.emberT = 0.12 + Math.random() * 0.2;
        burst(_fx.set(s.pos.x + (Math.random() - 0.5) * 0.8, s.pos.y + 0.9 + Math.random(), s.pos.z + (Math.random() - 0.5) * 0.8), 1, 3);
      }
    }
  }
  // the player's body: flames while burning, a pulsing glow from the skin while a style lasts
  if (!bodyFire.parent) player.root.add(bodyFire);
  const igniting = P.state === 'ignite';
  bodyFire.visible = igniting || (style.cur !== null && style.cur.id === 'flame');
  if (bodyFire.visible) {
    const strength = igniting ? 1 : 0.42;
    for (const f of bodyFire.children) {
      const flick = 1 + Math.sin(t * (10 + f.userData.size * 4) + f.position.y * 5) * 0.2;
      f.scale.set(f.userData.size * 0.55 * strength / flick, f.userData.size * strength * flick, 1);
    }
  }
  if (style.cur) playerMat.emissive.setHex(style.cur.ember).multiplyScalar(0.3 + Math.sin(t * 7) * 0.12);
}

// The sources in the main arena. (Trials add their own to the training hall through dojo.js.)
addSource('water', -17, 0, 12);
addSource('flame', 15, 0, 14);
