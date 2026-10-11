// styles.js: sword styles. A style is a temporary change to the character: a new colour and painted look for the
// slashes, a suit of armour, and one extra effect on top of the normal moves. It lasts STYLE_TIME seconds.
// What each style does to the four skills (its job as a power) is in elements.js.
// Styles are taken from places in the world ("sources"): Meteor Slam into a pool for Water, Blink Strike into a
// fire for Flame, Cyclone inside a storm for Thunder. Taking one plays a short scene: the character goes under the
// water, stands burning in the fire or spins under the lightning, a close-up of his eyes blazing in the style's
// colour cuts across the screen (cutin.js), and he comes out in a suit of dark armour that glows with that colour.
// A source does nothing until its style has been unlocked by passing its trial (progress.js); until then the pool
// is still and grey, the fire is out and the storm is a thin quiet cloud.
// Dying, teleporting, changing class and starting a trial all end the current style, so trials start plain.

import * as THREE from 'three';
import { V3, clamp, damp, easeOut, _fx } from './util.js';
import { scene } from './core.js';
import { glowTex, spawnRing, spawnSwirl, spawnBeam, spawnText, burst, toast, setTrailPaint } from './fx.js';
import { P, CL } from './state.js';
import { player, playerMat, bladeMat, bladeGlow, setState, teleTrail } from './player.js';
import { lockFire } from './camera.js';
import { styleUnlocked, onHit } from './progress.js';
import { dummies } from './dummies.js';
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
// perk = what it does (shown to the player). How it is taken depends on the class: see styleHow() below.
export const STYLES = {
  water: {
    id: 'water', name: 'Water', color: 0x2f8fff, paint: 'water', reach: 1.2,
    glow: '#2f8fff', core: '#dff3ff', glowHex: 0x2f8fff, eyes: 0xbfe6ff, spark: 2,
    flow: 0.12,        // seconds taken off every cooldown each time a hit lands
    perk: 'Control and survival: your skills drag enemies in, shove them away and heal you. Slashes reach further and hits shorten cooldowns',
  },
  flame: {
    id: 'flame', name: 'Flame', color: 0xff5a1a, paint: 'flame', reach: 1,
    glow: '#ff5a1a', core: '#ffe6a0', glowHex: 0xff5a1a, eyes: 0xffc24a, spark: 0,
    burnTime: 4,       // seconds a target keeps burning after the last hit
    burnDps: 14,       // burn damage per second
    perk: 'Destruction: every hit sets the target burning, and your skills leave fire behind',
  },
  thunder: {
    id: 'thunder', name: 'Thunder', color: 0xffe24a, paint: 'thunder', reach: 1,
    glow: '#ffe24a', core: '#ffffff', glowHex: 0xffe24a, eyes: 0xfff6b0, spark: 3,
    chain: 0.4,        // share of each hit's damage that jumps on to one more enemy
    chainRange: 6,     // how far that jump can reach
    speed: 1.15,       // multiplies running speed
    perk: 'Speed and stuns: your skills jump between enemies and freeze them. Hits arc to a second enemy and you run faster',
  },
};

// The style in use right now: cur = one of STYLES or null, left = seconds remaining.
export const style = { cur: null, left: 0 };

// The colour slashes and sword effects should be: the style's, or the class's when there is none.
export function slashColor() { return style.cur ? style.cur.color : CL.color; }
// Multiplier for how far sword attacks reach.
export function reach() { return style.cur ? style.cur.reach : 1; }
// How the class being played takes a style, in words (shown by a source, by Master Sen and when it is unlocked).
// Every class uses the same three keys: R for water, Q for fire, E for the storm.
export function styleHow(id) {
  const S = CL.skills;
  if (id === 'water') return CL.id === 'blade' ? `${S.r.n} into a pool` : `Use ${S.r.n} while standing in a pool`;
  if (id === 'flame') return CL.id === 'blade' ? `Lock on to a fire and ${S.q.n} into it` : `Lock on to a fire and use ${S.q.n}`;
  return `Use ${S.e.n} inside a storm`;
}
// Multiplier for running speed.
export function styleSpeed() { return style.cur && style.cur.speed ? style.cur.speed : 1; }

// ---------- the suit ----------
// Taking a style puts the character in a suit of dark armour that glows with the style's colour: hair made of the
// element itself (fire, or long running water), a chest plate, spiked shoulder guards, gauntlets and greaves split by
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
let mats = null;    // one { armour, coat } per style, made the first time a style is worn
// ---------- hair ----------
// A style gives the character hair made of its element.
//   Flame: tongues of fire standing up and back from the head, each one flickering on its own.
//   Water: long hair of running water that hangs down the back, sways, and streams out behind when he moves.
//   Thunder: sharp spikes standing straight out from the head, twitching, with small arcs jumping between them.
// Both sit on the head and are hidden until that style is worn. updateHair() moves them every frame.

// One tongue of fire: a cone standing on its base, pale yellow at the root through orange to red at the tip.
const tongueGeo = (() => {
  const HEIGHT = 0.36;
  const geo = new THREE.ConeGeometry(0.075, HEIGHT, 7, 3).translate(0, HEIGHT / 2, 0);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const root = new THREE.Color('#fff3b8'), mid = new THREE.Color('#ffae28'), tip = new THREE.Color('#ff3a0a'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / HEIGHT;
    if (t < 0.4) c.copy(root).lerp(mid, t / 0.4); else c.copy(mid).lerp(tip, (t - 0.4) / 0.6);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
})();
const fireHairMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
// Where each tongue stands on the head: x, y, z, how far it leans back, how far to the side, and its size.
const TONGUES = [
  [0, 0.15, 0.03, -0.2, 0, 1.25], [0.09, 0.13, 0.01, -0.3, -0.45, 1.05], [-0.09, 0.13, 0.01, -0.3, 0.45, 1.05],
  [0, 0.14, -0.08, -0.75, 0, 1.3], [0.11, 0.09, -0.07, -0.8, -0.6, 1.0], [-0.11, 0.09, -0.07, -0.8, 0.6, 1.0],
  [0.05, 0.06, -0.15, -1.3, -0.25, 1.15], [-0.05, 0.06, -0.15, -1.3, 0.25, 1.15], [0, -0.02, -0.17, -1.75, 0, 0.95],
];
// A cap over the top and back of the head, so there is something for the hair to grow from.
const hairCapGeo = new THREE.SphereGeometry(0.183, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);

// One spike of the lightning hair: longer and sharper than a tongue of fire, yellow at the root and white at the tip.
const spikeGeo = (() => {
  const HEIGHT = 0.42;
  const geo = new THREE.ConeGeometry(0.045, HEIGHT, 5, 2).translate(0, HEIGHT / 2, 0);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const root = new THREE.Color('#ffd42a'), tip = new THREE.Color('#ffffff'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(root).lerp(tip, pos.getY(i) / HEIGHT);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
})();
// Where each spike stands: x, y, z, how far it leans back, how far to the side, and its size. They fan out like a
// starburst, where the fire leans back together.
const SPIKES = [
  [0, 0.15, 0.02, 0.05, 0, 1.2], [0.08, 0.14, 0.02, -0.05, -0.7, 1.05], [-0.08, 0.14, 0.02, -0.05, 0.7, 1.05],
  [0.13, 0.08, 0, -0.1, -1.25, 0.95], [-0.13, 0.08, 0, -0.1, 1.25, 0.95], [0, 0.14, -0.08, -0.7, 0, 1.15],
  [0.1, 0.1, -0.1, -0.85, -0.75, 1.0], [-0.1, 0.1, -0.1, -0.85, 0.75, 1.0], [0.05, 0.03, -0.16, -1.5, -0.3, 0.95], [-0.05, 0.03, -0.16, -1.5, 0.3, 0.95],
];
const ARC_POINTS = 5;       // how many corners one of the little arcs between spikes has
let arcT = 0;               // seconds until the arcs jump somewhere new

// Water hair is made of flat strands. A strand is a ribbon of STRAND_CUTS pieces, rebuilt every frame so it can flow.
const STRAND_CUTS = 12;
// Each strand: which side of the head it hangs on (-1, 0, 1), its width at the root, its length, and a number that
// puts its swaying out of step with the others.
const STRANDS = [[0, 0.13, 1.05, 0], [1, 0.095, 0.9, 1.7], [-1, 0.095, 0.9, 3.1]];
// The surface of the water: a mid blue with lighter and darker lines running down it. It slides down the strand
// (see updateHair), which is what makes the hair look as if it is pouring.
const waterHairTex = canvasTex(64, 256, x => {
  x.fillStyle = '#4f9df0';
  x.fillRect(0, 0, 64, 256);
  x.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const px = Math.random() * 64, py = Math.random() * 256, len = 30 + Math.random() * 70;
    x.strokeStyle = Math.random() < 0.6 ? 'rgba(225,244,255,0.75)' : 'rgba(20,70,170,0.5)';
    x.lineWidth = 1.5 + Math.random() * 2.5;
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo(px + (Math.random() - 0.5) * 10, py + len * 0.5, px, py + len);
    x.stroke();
  }
});
waterHairTex.wrapT = THREE.RepeatWrapping;
const waterHairMat = new THREE.MeshBasicMaterial({ map: waterHairTex, vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.94, toneMapped: false });
function strandGeo() {
  const count = (STRAND_CUTS + 1) * 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const uv = new Float32Array(count * 2), col = new Float32Array(count * 3), idx = [];
  for (let i = 0; i <= STRAND_CUTS; i++) {
    const along = i / STRAND_CUTS;
    uv.set([0, along * 1.5, 1, along * 1.5], i * 4);
    // deeper blue at the root, almost white at the tip
    const shade = [0.5 + 0.5 * along, 0.68 + 0.32 * along, 1];
    col.set([...shade, ...shade], i * 6);
    if (i < STRAND_CUTS) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
// How the player is moving, in his own terms (forwards, sideways, up), smoothed. The water hair trails against it.
const hairFlow = { ahead: 0, aside: 0, up: 0 };
// Once per frame while a style is worn (from updateStyles). t = seconds, for the flicker and sway.
function updateHair(t, dt) {
  if (outfit.flameHair.visible) {
    outfit.flameHair.children.forEach((tongue, i) => {
      if (!tongue.userData.tongue) return;
      const [, , , , lean, size] = tongue.userData.tongue;
      // each tongue stretches and shrinks at its own pace, and wavers from side to side
      const stretch = 1 + Math.sin(t * (7 + i * 1.3) + i * 2.1) * 0.2 + Math.sin(t * 21 + i * 4.7) * 0.08;
      tongue.scale.set(size / Math.sqrt(stretch), size * stretch, size / Math.sqrt(stretch));
      tongue.rotation.z = lean + Math.sin(t * 5.5 + i * 1.9) * 0.13;
    });
  }
  if (outfit.waterHair.visible) {
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    hairFlow.ahead = damp(hairFlow.ahead, P.vel.x * sin + P.vel.z * cos, 7, dt);
    hairFlow.aside = damp(hairFlow.aside, P.vel.x * cos - P.vel.z * sin, 7, dt);
    hairFlow.up = damp(hairFlow.up, P.vel.y, 7, dt);
    // how far the tip is carried: back when running forwards, up when falling, sideways against a strafe
    const back = clamp(hairFlow.ahead * 0.03, -0.12, 0.65), lift = clamp(-hairFlow.up * 0.03, -0.2, 0.6), drift = clamp(-hairFlow.aside * 0.025, -0.3, 0.3);
    for (const strand of outfit.waterHair.children) {
      if (!strand.userData.strand) continue;
      const [side, width, length, phase] = strand.userData.strand;
      const pos = strand.geometry.attributes.position;
      for (let i = 0; i <= STRAND_CUTS; i++) {
        const along = i / STRAND_CUTS, tipward = along * along;    // the further down the strand, the more it moves
        const x = side * (0.07 + 0.05 * along) + Math.sin(t * 2.6 + along * 5 + phase) * 0.045 * along + drift * tipward;
        const y = 0.1 - along * length + lift * tipward;
        const z = -0.15 - 0.2 * Math.sin(along * 1.4) - back * tipward;
        const half = width * (1 - 0.7 * along);
        pos.setXYZ(i * 2, x - half, y, z);
        pos.setXYZ(i * 2 + 1, x + half, y, z);
      }
      pos.needsUpdate = true;
    }
    waterHairTex.offset.y = -t * 0.55;
  }
  if (outfit.thunderHair.visible) {
    // the spikes twitch: a small random change every frame, which reads as crackling
    for (const spike of outfit.thunderHair.children) {
      if (!spike.userData.spike) continue;
      const [, , , back, lean, size] = spike.userData.spike;
      spike.scale.set(size, size * (0.92 + Math.random() * 0.2), size);
      spike.rotation.set(back + (Math.random() - 0.5) * 0.07, 0, lean + (Math.random() - 0.5) * 0.07);
    }
    // every so often each arc jumps to a new pair of spike tips
    arcT -= dt;
    if (arcT <= 0) {
      arcT = 0.05 + Math.random() * 0.06;
      for (const arc of outfit.thunderArcs) {
        const a = outfit.thunderTips[Math.floor(Math.random() * outfit.thunderTips.length)];
        const b = outfit.thunderTips[Math.floor(Math.random() * outfit.thunderTips.length)];
        const pos = arc.geometry.attributes.position;
        for (let i = 0; i < ARC_POINTS; i++) {
          const k = i / (ARC_POINTS - 1), wobble = i === 0 || i === ARC_POINTS - 1 ? 0 : 0.07;
          pos.setXYZ(i, a.x + (b.x - a.x) * k + (Math.random() - 0.5) * wobble, a.y + (b.y - a.y) * k + (Math.random() - 0.5) * wobble, a.z + (b.z - a.z) * k + (Math.random() - 0.5) * wobble);
        }
        pos.needsUpdate = true;
        arc.visible = a !== b;
      }
    }
  }
}
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
export const wispMat = new THREE.MeshBasicMaterial({ map: wispTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const metalMat = new THREE.MeshLambertMaterial({ color: 0x2a2732 });
// The head keeps its skin colour while the rest of the body turns dark, so it has a material of its own.
// (It still fades in and out with the body.)
const faceMat = new THREE.MeshLambertMaterial({ color: PLAIN_SKIN, transparent: true });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const haloMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, toneMapped: false });
const auraMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.2, toneMapped: false });

// The pieces. suit.parts is all of them (to show and hide together); the named ones are swapped between styles.
export const outfit = { parts: [], armoured: [], coats: [], plates: [], cloth: [], staffHeads: {}, flameHair: null, waterHair: null, thunderHair: null, thunderTips: [], thunderArcs: [],
  coat: null, chest: null, attached: false };
function attachOutfit() {
  mats = {};
  for (const id in STYLES) mats[id] = suitMats(STYLES[id]);
  // put a piece on a part of the body and remember it. kind says which material set it follows.
  const add = (mesh, parent, x, y, z, kind) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    // the Mage's robes are kept out of parts: parts is what every class wears under a style
    if (kind !== 'cloth' && kind !== 'trim') outfit.parts.push(mesh);
    if (kind === 'armour') outfit.armoured.push(mesh);
    if (kind === 'coat' || kind === 'cloth') outfit.coats.push(mesh);
    // plate = the hard pieces only the armoured look shows. cloth = the pieces only the Mage's robes show.
    if (kind === 'armour' || kind === 'plate') outfit.plates.push(mesh);
    if (kind === 'cloth' || kind === 'trim') outfit.cloth.push(mesh);
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
    add(spike, player.chest, 0.26 * side, 0.1, 0, 'plate');
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
  // The Mage's robes, worn in place of the plate: a pointed hat with a wide brim and a glowing band, wide
  // sleeves that flare towards the hands, and a short mantle over the shoulders. All of it is the coat's cloth,
  // so it carries the same glowing cracks in the style's colour. The coat and the cape are shared.
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.52, 12), coat);
  hat.rotation.x = -0.22;    // the point leans back a little
  add(hat, player.head, 0, 0.36, -0.04, 'cloth');
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.025, 18), coat), player.head, 0, 0.12, 0, 'cloth');
  add(tube(0.172, 0.19, 0.05, eyeMat, false), player.head, 0, 0.155, 0, 'trim');
  add(tube(0.065, 0.14, 0.3, coat), player.elL, 0, -0.17, 0, 'cloth');
  add(tube(0.065, 0.14, 0.3, coat), player.elR, 0, -0.17, 0, 'cloth');
  add(tube(0.09, 0.25, 0.2, coat), player.chest, 0, -0.09, 0, 'cloth');
  // The staff's head: one shape for each style, round the orb at the top of the staff. Only the one for the
  // style in use shows (and only a Mage holds the staff at all).
  const flameHead = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff9a2a, toneMapped: false }));
  flameHead.position.z = 1.76;
  const waterHead = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 20), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, toneMapped: false }));
  waterHead.position.z = 1.5;
  const thunderHead = new THREE.Group();
  const forkMat = new THREE.MeshBasicMaterial({ color: 0xffe24a, toneMapped: false });
  for (let i = 0; i < 3; i++) {
    const fork = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.34, 5).rotateX(Math.PI / 2).translate(0, 0.13, 0.12), forkMat);
    fork.rotation.z = i / 3 * Math.PI * 2;
    thunderHead.add(fork);
  }
  thunderHead.position.z = 1.5;
  outfit.staffHeads = { flame: flameHead, water: waterHead, thunder: thunderHead };
  for (const id in outfit.staffHeads) player.W.staff.add(outfit.staffHeads[id]);
  // The hair. Each style's is a group of its own on the head, shown only for that style (they are kept out of
  // outfit.parts, which is everything that shows for every style).
  outfit.flameHair = new THREE.Group();
  const fireCap = new THREE.Mesh(hairCapGeo, new THREE.MeshBasicMaterial({ color: 0xff9a2a, toneMapped: false }));
  fireCap.rotation.x = -0.45;
  outfit.flameHair.add(fireCap);
  for (const spec of TONGUES) {
    const tongue = new THREE.Mesh(tongueGeo, fireHairMat);
    tongue.position.set(spec[0], spec[1], spec[2]);
    tongue.rotation.set(spec[3], 0, spec[4]);
    tongue.userData.tongue = spec;
    outfit.flameHair.add(tongue);
  }
  outfit.waterHair = new THREE.Group();
  const waterCap = new THREE.Mesh(hairCapGeo, new THREE.MeshBasicMaterial({ color: 0x3a86e6, toneMapped: false }));
  waterCap.rotation.x = -0.45;
  outfit.waterHair.add(waterCap);
  for (const spec of STRANDS) {
    const strand = new THREE.Mesh(strandGeo(), waterHairMat);
    strand.frustumCulled = false;    // its shape changes every frame
    strand.userData.strand = spec;
    outfit.waterHair.add(strand);
  }
  outfit.thunderHair = new THREE.Group();
  const boltCap = new THREE.Mesh(hairCapGeo, new THREE.MeshBasicMaterial({ color: 0xffd42a, toneMapped: false }));
  boltCap.rotation.x = -0.45;
  outfit.thunderHair.add(boltCap);
  const spikeMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const upright = new THREE.Vector3(), turn = new THREE.Euler();
  for (const spec of SPIKES) {
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set(spec[0], spec[1], spec[2]);
    spike.rotation.set(spec[3], 0, spec[4]);
    spike.userData.spike = spec;
    outfit.thunderHair.add(spike);
    // remember where its tip is, for the arcs to jump between
    upright.set(0, 0.4 * spec[5], 0).applyEuler(turn.set(spec[3], 0, spec[4]));
    outfit.thunderTips.push(new V3(spec[0] + upright.x, spec[1] + upright.y, spec[2] + upright.z));
  }
  const arcMat = new THREE.LineBasicMaterial({ color: 0xffffff, toneMapped: false });
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_POINTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const arc = new THREE.Line(g, arcMat);
    arc.frustumCulled = false;
    outfit.thunderArcs.push(arc);
    outfit.thunderHair.add(arc);
  }
  player.head.add(outfit.flameHair);
  player.head.add(outfit.waterHair);
  player.head.add(outfit.thunderHair);
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
  // The Mage wears robes and a hat where the Blademaster wears plate and hair made of the element.
  const mage = CL.weapon === 'staff';
  for (const m of outfit.parts) m.visible = !!s;
  for (const m of outfit.plates) m.visible = !!s && !mage;
  for (const m of outfit.cloth) m.visible = !!s && mage;
  outfit.flameHair.visible = !!s && !mage && s.id === 'flame';
  outfit.waterHair.visible = !!s && !mage && s.id === 'water';
  outfit.thunderHair.visible = !!s && !mage && s.id === 'thunder';
  for (const id in outfit.staffHeads) outfit.staffHeads[id].visible = !!s && s.id === id;
  if (s) {
    for (const m of outfit.armoured) m.material = mats[s.id].armour;
    for (const m of outfit.coats) m.material = mats[s.id].coat;
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
  if (s.chain && ev.src !== 'chain') chainLightning(ev, s);
}
// Thunder: part of a hit's damage jumps to the nearest other enemy in range, along a bolt.
const _from = new V3(), _to = new V3();
function chainLightning(ev, s) {
  let next = null, nearest = s.chainRange;
  for (const d of dummies) {
    if (d === ev.d || d.dead) continue;
    const dist = d.pos.distanceTo(ev.d.pos);
    if (dist < nearest) { nearest = dist; next = d; }
  }
  const dmg = Math.round(ev.dmg * s.chain);
  if (!next || dmg < 1) return;
  next.hp -= dmg;
  next.flash = 0.8;
  next.sinceHit = 0;
  ev.d.chest(_from); next.chest(_to);
  spawnBeam(_from, _to, 0xfff3a0, 0.16, 2.2);
  spawnText(_to, dmg, 'burn');
  burst(_to, 4, 6, 3);
  if (next.hp <= 0) next.ko(next.pos.x - ev.d.pos.x, next.pos.z - ev.d.pos.z);
  // tell a running trial about it, marked as a jump so that it does not jump again
  onHit({ d: next, dmg, src: 'chain', ko: next.dead, targetAir: !next.grounded, interrupted: false });
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

// The storm: a dark cloud hanging over a scorched circle, with lightning striking down inside it.
const STORM_RADIUS = 3.6, CLOUD_HEIGHT = 9, BOLT_CUTS = 9, BOLT_TIME = 0.13;
const cloudGeo = new THREE.SphereGeometry(1, 9, 7);
const cloudMat = new THREE.MeshLambertMaterial({ color: 0x34313f });
const scorchGeo = new THREE.CircleGeometry(STORM_RADIUS, 36).rotateX(-Math.PI / 2);
const stormRimGeo = new THREE.RingGeometry(STORM_RADIUS - 0.12, STORM_RADIUS + 0.08, 40).rotateX(-Math.PI / 2);
// One bolt: a thin jagged strip from the cloud to the ground, drawn twice at right angles so it shows from any side.
function makeBolt(group) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((BOLT_CUTS + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < BOLT_CUTS; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff6b8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const a = new THREE.Mesh(geo, mat), b = new THREE.Mesh(geo, mat);
  b.rotation.y = Math.PI / 2;
  a.frustumCulled = b.frustumCulled = false;
  a.visible = b.visible = false;
  group.add(a); group.add(b);
  return { geo, mat, meshes: [a, b], life: 0 };
}
// Make a storm's next free bolt strike the ground at (x, z), given relative to the middle of the storm.
function strike(s, x, z) {
  const bolt = s.bolts[s.nextBolt = (s.nextBolt + 1) % s.bolts.length];
  const pos = bolt.geo.attributes.position;
  for (let i = 0; i <= BOLT_CUTS; i++) {
    const k = i / BOLT_CUTS, sway = i === BOLT_CUTS ? 0 : (Math.random() - 0.5) * 1.1;    // jagged on the way down, exact where it lands
    // both copies of the strip are drawn around the storm's own centre, so the strip is built standing on that
    // centre and the whole bolt is moved to where it strikes
    pos.setXYZ(i * 2, sway - 0.07, CLOUD_HEIGHT * (1 - k), 0);
    pos.setXYZ(i * 2 + 1, sway + 0.07, CLOUD_HEIGHT * (1 - k), 0);
  }
  pos.needsUpdate = true;
  for (const m of bolt.meshes) { m.position.set(x, 0, z); m.visible = true; }
  bolt.life = BOLT_TIME;
  burst(_fx.set(s.pos.x + x, s.pos.y + 0.2, s.pos.z + z), 3, 5, 3);
}
// Once per frame for each storm: lightning now and then while it is live, and fading the bolts already struck.
function updateStorm(s, open, dt) {
  s.rim.visible = open;
  s.cloud.scale.setScalar(open ? 1 : 0.6);    // a thin grey wisp of cloud until the style is unlocked
  if (open) {
    s.strikeT -= dt;
    if (s.strikeT <= 0) {
      s.strikeT = 0.16 + Math.random() * 0.42;
      const angle = Math.random() * Math.PI * 2, out = Math.sqrt(Math.random()) * (STORM_RADIUS - 0.4);
      strike(s, Math.cos(angle) * out, Math.sin(angle) * out);
    }
  }
  for (const bolt of s.bolts) {
    if (bolt.life <= 0) continue;
    bolt.life -= dt;
    bolt.mat.opacity = Math.max(0, bolt.life / BOLT_TIME);
    if (bolt.life <= 0) { for (const m of bolt.meshes) m.visible = false; }
  }
}
// Is this spot inside a live storm? Returns the storm, or null. Called by Cyclone (classes/blade.js).
export function stormAt(pos) {
  for (const s of sources) {
    if (s.id !== 'thunder' || !styleUnlocked('thunder')) continue;
    if (Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z) < STORM_RADIUS && Math.abs(s.pos.y - pos.y) < 2) return s;
  }
  return null;
}

// Put a source in the world. id = the style it gives ('water' makes a pool, 'flame' a fire pit, 'thunder' a storm).
// Returns the source.
export function addSource(id, x, y, z) {
  const s = { id, pos: new V3(x, y, z), group: new THREE.Group(), emberT: 0 };
  s.group.position.set(x, y, z);
  if (id === 'thunder') {
    s.scorch = new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({ color: 0x100e16, transparent: true, opacity: 0.6, depthWrite: false }));
    s.scorch.position.y = 0.03;
    s.rim = new THREE.Mesh(stormRimGeo, new THREE.MeshBasicMaterial({ color: 0xffe24a, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    s.rim.position.y = 0.04;
    // the cloud: a few flattened balls bunched together overhead
    s.cloud = new THREE.Group();
    for (const [cx, cy, cz, size] of [[0, 0, 0, 2.6], [1.9, 0.2, 0.6, 1.9], [-1.8, -0.1, -0.5, 2.0], [0.4, 0.3, -1.7, 1.7], [-0.5, 0.1, 1.6, 1.8]]) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set(cx, cy, cz);
      puff.scale.set(size, size * 0.42, size);
      s.cloud.add(puff);
    }
    s.cloud.position.y = CLOUD_HEIGHT;
    s.group.add(s.scorch); s.group.add(s.rim); s.group.add(s.cloud);
    s.bolts = [makeBolt(s.group), makeBolt(s.group), makeBolt(s.group)];
    s.nextBolt = 0;
    s.strikeT = 0.3;
  } else if (id === 'water') {
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
  if (s.bolts) {    // each bolt has a shape and a material of its own
    for (const bolt of s.bolts) { bolt.geo.dispose(); bolt.mat.dispose(); }
  }
}

// Called by groundImpact (player.js) when a slam lands: landing in a pool starts the Water scene.
export function slamSources() {
  for (const s of sources) {
    if (s.id !== 'water' || !styleUnlocked('water')) continue;
    if (Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z) < POOL_RADIUS + 0.4 && Math.abs(s.pos.y - P.pos.y) < 1.5) startTake(s);
  }
}
// The Mage takes a style by pressing a skill key at its source: Q with a fire locked on
// (it is carried into it), E inside a storm, R while standing in a pool. Called by update.js when a skill key
// is pressed, before the skill itself. Returns true if a style is being taken, in which case the skill does not
// happen (its cooldown starts all the same). The Blademaster's own skills do this themselves, so for that class
// it always returns false.
export function takeWith(slot) {
  if (CL.id === 'blade') return false;
  let source = null;
  if (slot === 'q') source = lockFire;
  else if (slot === 'e') source = stormAt(P.pos);
  else if (slot === 'r') {
    source = sources.find(s => s.id === 'water' && styleUnlocked('water') && Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z) < POOL_RADIUS + 0.4 && Math.abs(s.pos.y - P.pos.y) < 1.5) || null;
  }
  if (!source) return false;
  P.cd[slot] = CL.skills[slot].cd;
  if (slot === 'q') teleTrail(_from.copy(P.pos), source.pos, 5);
  startTake(source);
  return true;
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
  } else if (s.id === 'thunder') {
    setState('storm');
    P.takeSrc = s;
    P.takeTick = -1;
    spawnRing(_fx, 0.4, STORM_RADIUS + 1, 0.45, STYLES.thunder.color);
    burst(_fx.setY(s.pos.y + 1), 20, 10, 3);
  } else {
    setState('ignite');
    spawnRing(_fx, 0.4, 3.2, 0.4, STYLES.flame.color);
    burst(_fx.setY(s.pos.y + 0.8), 24, 9);
  }
}
// Runs every frame of the 'submerge', 'ignite' and 'storm' states (from the state switch in update.js).
export function updateTake() {
  const id = { submerge: 'water', ignite: 'flame', storm: 'thunder' }[P.state], water = id === 'water';
  if (id === 'thunder') {
    // spinning in the middle of the storm while bolt after bolt comes down on him
    const tick = Math.floor(P.st / 0.07);
    if (tick !== P.takeTick && P.takeSrc) { P.takeTick = tick; strike(P.takeSrc, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5); }
  }
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
    const st = STYLES[s.id], thing = { water: 'Pool', flame: 'Fire pit', thunder: 'Storm' }[s.id];
    if (!styleUnlocked(s.id)) return `${thing} · you cannot draw on it yet. <b>Master Sen</b> can teach you.`;
    return `${thing} · ${styleHow(s.id)} to take <b>${st.name}</b> for ${STYLE_TIME}s`;
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
    if (s.id === 'thunder') { updateStorm(s, open, dt); continue; }
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
    updateHair(t, dt);
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
addSource('thunder', 0, 0, 28);
