// styles.js: sword styles. A style is a temporary change to the character: a new colour and painted look for the
// slashes, a suit of armour, and one extra effect on top of the normal moves. It lasts STYLE_TIME seconds.
// Styles are taken from places in the world ("sources"): Meteor Slam into a pool for Water, Blink Strike into a
// fire for Flame. Taking one plays a short scene: the character goes under the water or stands burning in the
// fire, a close-up of his eyes blazing in the style's colour cuts across the screen (cutin.js), and he comes out
// in a suit of dark armour that glows with the style's colour.
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
// The suit worn under a style is the same dark armour for all of them; these colour what glows on it:
//   glow, core = the cracks in the armour and coat (a wide soft line and its bright centre), as CSS colours.
//   glowHex = the same glow as a number, for the halo round the eyes, the haze round the body and the wisps on the sword.
//   eyes = the two small points of light where his eyes are.
//   spark = which kind of spark drifts off the body (see burst() in fx.js).
// reach = multiplies how far sword attacks, Cyclone and Meteor Slam reach.
// how = how to take it, perk = what it does (both shown to the player).
export const STYLES = {
  water: {
    id: 'water', name: 'Water', color: 0x2f8fff, paint: 'water', reach: 1.2,
    glow: '#2f8fff', core: '#dff3ff', glowHex: 0x2f8fff, eyes: 0xbfe6ff, spark: 2,
    flow: 0.12,        // seconds taken off every cooldown each time a hit lands
    how: 'Meteor Slam into a pool', perk: 'Slashes reach further, and every hit shortens your cooldowns',
  },
  flame: {
    id: 'flame', name: 'Flame', color: 0xff5a1a, paint: 'flame', reach: 1,
    glow: '#ff5a1a', core: '#ffe6a0', glowHex: 0xff5a1a, eyes: 0xffc24a, spark: 0,
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

// ---------- the suit ----------
// Taking a style puts the character in a suit of dark armour that glows with the style's colour: a wide straw sun
// hat painted with the style's symbol, a chest plate, spiked shoulder guards, gauntlets and greaves split by
// glowing cracks, a long ragged coat open at the front, and a torn cape. Thin wisps of the same colour run along the sword.
// Everything here is built once, attached to the player's body the first time a style is worn, and hidden otherwise.
const ARMOUR = 0x17151c;    // the dark colour of the suit, and of the limbs under it

// Jagged lines climbing a picture, like cracks with light behind them: a wide soft line in the style's colour
// with a thin bright core. Used for the armour and the coat. fromY, toY = where they start and how high they reach.
function drawCracks(x, w, color, core, count, fromY, toY) {
  const paths = [];
  for (let i = 0; i < count; i++) {
    let px = Math.random() * w, py = fromY;
    const path = [[px, py]];
    while (py > toY) {
      px += (Math.random() - 0.5) * 34;
      py -= 8 + Math.random() * 20;
      path.push([px, py]);
      // now and then a short branch splits off sideways
      if (Math.random() < 0.3) paths.push([[px, py], [px + (Math.random() - 0.5) * 50, py - 10 - Math.random() * 22]]);
    }
    paths.push(path);
  }
  x.lineJoin = 'bevel';
  for (const [stroke, width, blur] of [[color, 7, 12], [core, 2.2, 0]]) {
    x.strokeStyle = stroke; x.lineWidth = width; x.shadowColor = color; x.shadowBlur = blur;
    for (const path of paths) {
      x.beginPath();
      for (const [qx, qy] of path) x.lineTo(qx, qy);
      x.stroke();
    }
  }
  x.shadowBlur = 0;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
// The dull surface of the armour: dark plates with seams and rivets. The same for every style.
const plateTex = canvasTex(128, 128, x => {
  x.fillStyle = '#211e27'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#0c0b10'; x.lineWidth = 3;
  for (const y of [42, 86]) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); }
  for (const px of [32, 96]) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, 128); x.stroke(); }
  x.fillStyle = '#3a3644';
  for (let i = 0; i < 12; i++) x.fillRect(8 + (i % 4) * 32, 8 + Math.floor(i / 4) * 44, 4, 4);
});
// What glows on the armour: cracks from top to bottom. Black everywhere else, so only the cracks give light.
const armourGlow = s => canvasTex(256, 256, x => {
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  drawCracks(x, 256, s.glow, s.core, 7, 256, 0);
});
// The coat and cape. Two pictures: the cloth itself, with a ragged hem cut out of the bottom edge, and what glows
// on it: veins climbing from the hem, most of the way up.
const coatCloth = () => canvasTex(256, 256, x => {
  x.fillStyle = '#16141b'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3;
  for (let px = 10; px < 256; px += 22) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px + 6, 256); x.stroke(); }    // folds
  x.globalCompositeOperation = 'destination-out';    // from here on, drawing cuts holes
  for (let px = 0; px < 256;) {
    const w = 10 + Math.random() * 20, h = 18 + Math.random() * 58;
    x.beginPath(); x.moveTo(px, 256); x.lineTo(px + w * 0.5, 256 - h); x.lineTo(px + w, 256); x.closePath(); x.fill();
    px += w * 0.8;
  }
});
const coatGlow = s => canvasTex(256, 256, x => {
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  drawCracks(x, 256, s.glow, s.core, 9, 250, 70);
});

// One set of materials per style. Lambert materials can carry a second picture that gives off light of its own
// (emissiveMap), which is how the cracks glow while the plates around them stay dark.
function suitMats(s) {
  return {
    armour: new THREE.MeshLambertMaterial({ map: plateTex, emissive: 0xffffff, emissiveMap: armourGlow(s) }),
    // alphaTest makes the cut-out hem really see-through; DoubleSide because the coat is seen from inside too
    coat: new THREE.MeshLambertMaterial({ map: coatCloth(), emissive: 0xffffff, emissiveMap: coatGlow(s), alphaTest: 0.5, side: THREE.DoubleSide }),
  };
}
let mats = null;    // { water: {armour, coat}, flame: {...} }, made the first time a style is worn
// The hat: a plain wide sun hat, a low cone of woven straw, with the style's symbol painted on it front and back
// (a flame, or a drop of water). The picture wraps once around the cone: left to right is around the hat, top to
// bottom is from the point down to the brim.
function hatTex(s) {
  return canvasTex(512, 128, x => {
    x.fillStyle = '#c9ad74';
    x.fillRect(0, 0, 512, 128);
    // the weave: fine lines running from point to brim, and a few rings
    x.strokeStyle = 'rgba(90,62,24,0.35)';
    x.lineWidth = 1;
    for (let px = 0; px < 512; px += 6) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, 128); x.stroke(); }
    for (const py of [34, 68, 98]) { x.beginPath(); x.moveTo(0, py); x.lineTo(512, py); x.stroke(); }
    x.fillStyle = '#5a3e1c';
    x.fillRect(0, 116, 512, 12);    // a dark band round the brim
    // the symbol, once at the front (which sits on the seam of the picture, so it is drawn at both ends) and
    // once at the back
    for (const cx of [0, 256, 512]) {
      x.save();
      x.translate(cx, 72);
      x.fillStyle = '#1a1410';
      x.beginPath(); x.arc(0, 0, 31, 0, Math.PI * 2); x.fill();
      x.strokeStyle = s.glow; x.lineWidth = 3;
      x.beginPath(); x.arc(0, 0, 27, 0, Math.PI * 2); x.stroke();
      x.fillStyle = s.glow;
      x.beginPath();
      if (s.id === 'flame') {
        // a flame: a tall tongue with a smaller one beside it
        x.moveTo(0, -22);
        x.bezierCurveTo(6, -8, 18, -4, 16, 10);
        x.bezierCurveTo(15, 20, 6, 22, 0, 22);
        x.bezierCurveTo(-8, 22, -17, 18, -16, 8);
        x.bezierCurveTo(-15, 0, -9, -2, -8, -10);
        x.bezierCurveTo(-4, -4, 0, -8, 0, -22);
      } else {
        // a drop of water
        x.moveTo(0, -22);
        x.bezierCurveTo(4, -8, 17, 0, 17, 9);
        x.bezierCurveTo(17, 18, 9, 23, 0, 23);
        x.bezierCurveTo(-9, 23, -17, 18, -17, 9);
        x.bezierCurveTo(-17, 0, -4, -8, 0, -22);
      }
      x.fill();
      x.fillStyle = s.core;    // a small bright centre
      x.beginPath(); x.arc(0, 10, 5, 0, Math.PI * 2); x.fill();
      x.restore();
    }
  });
}
const hatUnderMat = new THREE.MeshLambertMaterial({ color: 0x6a5230 });    // the shaded underside of the brim
let hatMats = null;    // { water, flame }: the top of the hat with each style's symbol, made with the suit
// Wisps for the sword: a strip of fine wavy lines, mostly along its two long edges, that repeats end to end.
const wispTex = canvasTex(256, 64, x => {
  x.lineCap = 'round';
  // each wisp: how far across the strip it sits (0..64), how many waves it makes, how high they are, how bright it is
  for (const [y, waves, height, alpha] of [[9, 3, 5, 1], [15, 5, 4, 0.75], [21, 2, 6, 0.5], [55, 4, 5, 1], [49, 6, 4, 0.75], [43, 3, 6, 0.5], [32, 2, 3, 0.25]]) {
    for (const [width, a] of [[3.4, alpha * 0.35], [1.1, alpha]]) {    // a soft line, then its bright core
      x.strokeStyle = `rgba(255,255,255,${a})`;
      x.lineWidth = width;
      x.beginPath();
      for (let px = 0; px <= 256; px += 4) x.lineTo(px, y + Math.sin(px / 256 * Math.PI * 2 * waves + y) * height);
      x.stroke();
    }
  }
});
const wispMat = new THREE.MeshBasicMaterial({ map: wispTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const metalMat = new THREE.MeshLambertMaterial({ color: 0x2a2732 });
// The head keeps its skin colour while the rest of the body turns dark, so it has a material of its own.
// (It still fades in and out with the body.)
const faceMat = new THREE.MeshLambertMaterial({ color: PLAIN_SKIN, transparent: true });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const haloMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, toneMapped: false });
const auraMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.2, toneMapped: false });

// The pieces. suit.parts is all of them (to show and hide together); the named ones are swapped between styles.
export const outfit = { parts: [], armoured: [], coats: [], hat: null, coat: null, chest: null, attached: false };
function attachOutfit() {
  mats = { water: suitMats(STYLES.water), flame: suitMats(STYLES.flame) };
  // put a piece on a part of the body and remember it. kind says which material set it follows.
  const add = (mesh, parent, x, y, z, kind) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    outfit.parts.push(mesh);
    if (kind === 'armour') outfit.armoured.push(mesh);
    if (kind === 'coat') outfit.coats.push(mesh);
    return mesh;
  };
  const armour = mats.water.armour, coat = mats.water.coat;
  const tube = (top, bottom, height, mat, open = true) => new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 14, 1, open), mat);

  // chest plate: broad at the shoulders, narrow at the waist
  outfit.chest = add(tube(0.18, 0.13, 0.51, armour, false), player.spine, 0, 0.33, 0, 'armour');
  // shoulder guards with a spike each. A stick figure's arms start at its centre line; these give it shoulders.
  for (const side of [1, -1]) {
    const guard = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), armour);
    guard.scale.set(1.28, 0.85, 1.12);
    add(guard, player.chest, 0.185 * side, 0.0, 0, 'armour');
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.041, 0.195, 6), metalMat);
    spike.rotation.z = -0.75 * side;
    add(spike, player.chest, 0.26 * side, 0.1, 0);
  }
  // gauntlets and greaves
  add(tube(0.078, 0.064, 0.21, armour), player.elL, 0, -0.2, 0, 'armour');
  add(tube(0.078, 0.064, 0.21, armour), player.elR, 0, -0.2, 0, 'armour');
  add(tube(0.076, 0.061, 0.31, armour), player.kneeL, 0, -0.24, 0, 'armour');
  add(tube(0.076, 0.061, 0.31, armour), player.kneeR, 0, -0.24, 0, 'armour');
  // belt, with a buckle that glows
  add(tube(0.168, 0.168, 0.068, metalMat), player.body, 0, 0.03, 0);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.06, 0.03), eyeMat);
  add(buckle, player.body, 0, 0.03, 0.168);
  // the coat: a long flared tube from the waist almost to the ground, with a gap left open down the front so the
  // legs show. The last two numbers are where around the body the cloth starts and how far round it goes.
  const GAP = 0.6;    // half the width of the opening, in radians
  outfit.coat = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.38, 0.965, 20, 1, true, GAP, Math.PI * 2 - GAP * 2), coat), player.body, 0, -0.435, 0, 'coat');
  // the cape: a torn sheet hanging from the shoulders down the back, leaning away from the body
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 1.2), coat);
  cape.rotation.x = 0.18;
  add(cape, player.chest, 0, -0.6, -0.17, 'coat');
  // The hat: a low wide cone sitting on the head, tipped back a little. A cone has two surfaces, its sloping top
  // and its flat underside, so it takes two materials.
  hatMats = { water: new THREE.MeshLambertMaterial({ map: hatTex(STYLES.water) }), flame: new THREE.MeshLambertMaterial({ map: hatTex(STYLES.flame) }) };
  outfit.hat = add(new THREE.Mesh(new THREE.ConeGeometry(0.37, 0.17, 28), [hatMats.water, hatUnderMat]), player.head, 0, 0.19, 0);
  outfit.hat.rotation.x = -0.1;
  // the eyes: two small points of light in the style's colour, each with a faint halo
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), eyeMat);
    add(eye, player.head, 0.062 * side, 0.02, 0.158);
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(0.11);
    add(halo, player.head, 0.062 * side, 0.02, 0.19);
  }
  // a faint glow hanging around the whole body
  const aura = new THREE.Sprite(auraMat);
  aura.scale.set(2.25, 3.15, 1);
  add(aura, player.root, 0, 1.0, 0);
  // The sword: thin wisps of the style's colour running along both edges of the blade and flowing towards the
  // tip (a picture of fine wavy lines that slides along, see wispTex). Two flat strips at right angles, so the
  // wisps show from any side. Much finer than a flame shape: the blade looks hot, not on fire.
  for (const turn of [0, Math.PI / 2]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3).rotateY(Math.PI / 2).rotateZ(turn), wispMat);
    add(strip, player.wrist, 0, 0, 0.66);
    strip.castShadow = false;
  }
  for (const m of outfit.parts) { if (m.isSprite) m.castShadow = false; }
  outfit.attached = true;
}

// Make the character look like the current style (or plain again): blade, slash, and the suit.
function applyLook() {
  if (!CL) return;
  if (!outfit.attached) attachOutfit();
  const s = style.cur;
  bladeMat.color.setHex(slashColor());
  bladeGlow.material.color.setHex(slashColor());
  setTrailPaint(s ? s.paint : 'plain');
  playerMat.color.setHex(s ? ARMOUR : PLAIN_SKIN);
  player.head.material = s ? faceMat : playerMat;
  for (const m of outfit.parts) m.visible = !!s;
  if (s) {
    for (const m of outfit.armoured) m.material = mats[s.id].armour;
    for (const m of outfit.coats) m.material = mats[s.id].coat;
    outfit.hat.material = [hatMats[s.id], hatUnderMat];
    eyeMat.color.setHex(s.eyes);
    haloMat.color.setHex(s.glowHex);
    auraMat.color.setHex(s.glowHex);
    wispMat.color.setHex(s.glowHex);
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
let sparkT = 0;    // seconds until the next spark drifts off a player wearing a style

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
  // the face's own material fades in and out with the rest of the body (dodging, being hit)
  faceMat.opacity = playerMat.opacity;
  if (style.cur) {
    // the wisps on the sword flow along the blade, and now and then a spark drifts off the body
    wispTex.offset.x = -t * 1.5;
    sparkT -= dt;
    if (sparkT <= 0) {
      sparkT = 0.09 + Math.random() * 0.12;
      burst(_fx.set(P.pos.x + (Math.random() - 0.5) * 0.7, P.pos.y + 0.3 + Math.random() * 1.4, P.pos.z + (Math.random() - 0.5) * 0.7), 1, 2.2, style.cur.spark);
    }
  }
}

// The sources in the main arena. (Trials add their own to the training hall through dojo.js.)
addSource('water', -17, 0, 12);
addSource('flame', 15, 0, 14);
