// styles.js: sword styles. A style is a temporary change to the character: a new colour and painted look for the
// slashes, an outfit, and one extra effect on top of the normal moves. It lasts STYLE_TIME seconds.
// Styles are taken from places in the world ("sources"): Meteor Slam into a pool for Water, Blink Strike into a
// fire for Flame. Taking one plays a short scene: the character goes under the water or stands burning in the
// fire, a close-up of his eyes blazing in the style's colour cuts across the screen (cutin.js), and he comes out
// dressed for it: Water Tribe blue with wave patterns, or Fire Nation red with flame patterns.
// A source does nothing until its style has been unlocked by passing its trial (progress.js); until then the pool
// is still and grey and the fire is out.
// Dying, teleporting, changing class and starting a trial all end the current style, so trials start plain.

import * as THREE from 'three';
import { V3, clamp, easeOut, _fx } from './util.js';
import { scene } from './core.js';
import { glowTex, spawnRing, spawnSwirl, burst, toast, setTrailPaint } from './fx.js';
import { addRim } from './stickman.js';
import { P, CL } from './state.js';
import { player, playerMat, bladeMat, bladeGlow, setState } from './player.js';
import { styleUnlocked } from './progress.js';
import { playCutin } from './cutin.js';

export const STYLE_TIME = 20;    // seconds a style lasts once taken
const PLAIN_SKIN = 0xeef1f8;     // the player's normal body colour (matches playerMat in player.js)

// The styles. color = slash and blade colour. paint = which painted look the slash uses (see setTrailPaint in fx.js).
// cloth = colour of the arms, legs and body while the style lasts (the head stays skin). trim = colour of the
// headband and bracers. The patterned parts of the outfit are drawn further down (clothTex).
// reach = multiplies how far sword attacks, Cyclone and Meteor Slam reach.
// how = how to take it, perk = what it does (both shown to the player).
export const STYLES = {
  water: {
    id: 'water', name: 'Water', color: 0x2f8fff, paint: 'water', reach: 1.2,
    cloth: 0x2a5cb8, trim: 0xeaf4ff,
    flow: 0.12,        // seconds taken off every cooldown each time a hit lands
    how: 'Meteor Slam into a pool', perk: 'Slashes reach further, and every hit shortens your cooldowns',
  },
  flame: {
    id: 'flame', name: 'Flame', color: 0xff5a1a, paint: 'flame', reach: 1,
    cloth: 0x7c1616, trim: 0xf2b632,
    burnTime: 4,       // seconds a target keeps burning after the last hit
    burnDps: 14,       // burn damage per second
    how: 'Lock on to a fire and Blink Strike into it', perk: 'Every hit sets the target burning',
  },
};

// The style in use right now: cur = one of STYLES or null, left = seconds remaining.
export const style = { cur: null, left: 0 };

// The colour slashes and sword effects should be: the style's, or the class's when there is none.
export function slashColor() { return style.cur ? style.cur.color : CL.color; }
// Multiplier for how far sword attacks reach.
export function reach() { return style.cur ? style.cur.reach : 1; }

// ---------- the outfit ----------
// The cloth patterns, each drawn once. They wrap around the tunic and the robe.
// Water: rows of overlapping wave arcs (the traditional Japanese wave pattern), white on blue, with a white hem.
// Flame: tongues of fire rising from a gold hem, gold and orange on dark red.
function clothTex(kind) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  if (kind === 'water') {
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#1c489c');
    g.addColorStop(1, '#2d74d8');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 128);
    x.lineWidth = 2;
    for (let row = 0; row < 6; row++) {
      for (let col = -1; col < 9; col++) {
        const cx = col * 32 + (row % 2 ? 16 : 0), cy = 22 + row * 16;
        for (const [r, color] of [[15, '#eaf4ff'], [10, '#9cc9ff'], [5, '#eaf4ff']]) {
          x.strokeStyle = color;
          x.beginPath();
          x.arc(cx, cy, r, Math.PI, 0);
          x.stroke();
        }
      }
    }
    x.fillStyle = '#eaf4ff';
    x.fillRect(0, 116, 256, 12);
  } else {
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#5a0d0d');
    g.addColorStop(1, '#a01c16');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 128);
    x.lineWidth = 2;
    x.strokeStyle = '#1a0606';
    for (let i = 0; i < 8; i++) {
      // one tongue of fire, with a smaller brighter one inside it
      const bx = i * 32 + 16, top = 34 + (i % 3) * 14;
      for (const [w, h, color] of [[13, 118 - top, '#f2a21e'], [7, (118 - top) * 0.62, '#ffe27a']]) {
        x.fillStyle = color;
        x.beginPath();
        x.moveTo(bx - w, 118);
        x.bezierCurveTo(bx - w * 1.5, 118 - h * 0.5, bx - w * 0.2, 118 - h * 0.6, bx + w * 0.5, 118 - h);
        x.bezierCurveTo(bx + w * 0.1, 118 - h * 0.55, bx + w * 1.5, 118 - h * 0.45, bx + w, 118);
        x.closePath();
        x.fill();
        x.stroke();
      }
    }
    x.fillStyle = '#f2b632';
    x.fillRect(0, 116, 256, 12);
    x.fillStyle = '#1a0606';
    x.fillRect(0, 113, 256, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
const clothMats = {
  water: new THREE.MeshLambertMaterial({ map: clothTex('water'), side: THREE.DoubleSide }),
  flame: new THREE.MeshLambertMaterial({ map: clothTex('flame'), side: THREE.DoubleSide }),
};
const trimMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
// The head keeps a skin colour of its own while the rest of the body takes the cloth colour.
const skinMat = addRim(new THREE.MeshLambertMaterial({ color: PLAIN_SKIN, transparent: true }));

// The pieces of the outfit, each a simple open tube. They are attached to the player's body the first time a
// style is worn (attachOutfit) and simply hidden the rest of the time.
//   tunic: around the chest.   robe: flares out from the waist over the legs.   mantle: a short collar over the shoulders.
//   band: around the forehead.   bracers: on both forearms.
const tube = (top, bottom, height, mat) => new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 16, 1, true), mat);
export const outfit = {
  tunic: tube(0.15, 0.19, 0.56, clothMats.water),
  robe: tube(0.2, 0.36, 0.46, clothMats.water),
  mantle: tube(0.11, 0.24, 0.13, trimMat),
  band: tube(0.176, 0.176, 0.055, trimMat),
  bracerL: tube(0.078, 0.066, 0.17, trimMat),
  bracerR: tube(0.078, 0.066, 0.17, trimMat),
  attached: false,
};
const OUTFIT_PARTS = ['tunic', 'robe', 'mantle', 'band', 'bracerL', 'bracerR'];
function attachOutfit() {
  outfit.tunic.position.y = 0.3;      player.spine.add(outfit.tunic);
  outfit.robe.position.y = -0.2;      player.body.add(outfit.robe);
  outfit.mantle.position.y = -0.02;   player.chest.add(outfit.mantle);
  outfit.band.position.y = 0.06;      player.head.add(outfit.band);
  outfit.bracerL.position.y = -0.2;   player.elL.add(outfit.bracerL);
  outfit.bracerR.position.y = -0.2;   player.elR.add(outfit.bracerR);
  for (const k of OUTFIT_PARTS) outfit[k].castShadow = true;
  outfit.attached = true;
}

// Make the character look like the current style (or plain again): blade, slash, cloth colour and outfit.
function applyLook() {
  if (!CL) return;
  if (!outfit.attached) attachOutfit();
  const s = style.cur;
  bladeMat.color.setHex(slashColor());
  bladeGlow.material.color.setHex(slashColor());
  setTrailPaint(s ? s.paint : 'plain');
  playerMat.color.setHex(s ? s.cloth : PLAIN_SKIN);
  player.head.material = s ? skinMat : playerMat;
  for (const k of OUTFIT_PARTS) outfit[k].visible = !!s;
  if (s) {
    outfit.tunic.material = outfit.robe.material = clothMats[s.id];
    trimMat.color.setHex(s.trim);
  }
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

// ---------- textures for the water and the fire, each drawn once ----------
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

// Flames on the player's own body, only while he stands in the fire during the scene.
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
// A fire can be locked on to, exactly like a dummy, so the ring on screen says where a Blink Strike will go.
// Called by updateCamera (camera.js) after it has picked the dummy nearest the crosshair.
//   camPos, dir = where the camera is and where it looks.   bestAngle = how far off the crosshair that dummy is
//   (radians; 0.2 if there is none). Returns a lit fire that is nearer the crosshair than that, and close enough
//   to the player for a blink to reach, or null.
export const FIRE_LOCK_RANGE = 15;
const _aim = new V3();
export function aimedFire(camPos, dir, bestAngle) {
  let found = null;
  for (const s of sources) {
    if (s.id !== 'flame' || !styleUnlocked('flame')) continue;
    if (Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z) > FIRE_LOCK_RANGE || Math.abs(s.pos.y - P.pos.y) > 4) continue;
    _aim.set(s.pos.x, s.pos.y + 1, s.pos.z).sub(camPos);
    const angle = Math.acos(clamp(_aim.dot(dir) / _aim.length(), -1, 1));
    if (angle < bestAngle) { bestAngle = angle; found = s; }
  }
  return found;
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
    if (dist > (s.id === 'water' ? POOL_RADIUS + 2.5 : 7) || Math.abs(s.pos.y - P.pos.y) > 3) continue;
    const st = STYLES[s.id], thing = s.id === 'water' ? 'Pool' : 'Fire pit';
    if (!styleUnlocked(s.id)) return `${thing} · you cannot draw on it yet. <b>Master Sen</b> can teach you.`;
    return `${thing} · ${st.how} to take <b>${st.name}</b> for ${STYLE_TIME}s`;
  }
  return null;
}

// Once per frame (main.js): run down the style's time, and animate the water and the fires.
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
  // the player's body is on fire only while he stands in the flames
  if (!bodyFire.parent) player.root.add(bodyFire);
  bodyFire.visible = P.state === 'ignite';
  if (bodyFire.visible) {
    for (const f of bodyFire.children) {
      const flick = 1 + Math.sin(t * (10 + f.userData.size * 4) + f.position.y * 5) * 0.2;
      f.scale.set(f.userData.size * 0.55 / flick, f.userData.size * flick, 1);
    }
  }
  // the head's own material fades in and out with the rest of the body (dodging, being hit)
  skinMat.opacity = playerMat.opacity;
}

// The sources in the main arena. (Trials add their own to the training hall through dojo.js.)
addSource('water', -17, 0, 12);
addSource('flame', 15, 0, 14);
