// world.js: the level. Every solid box, the ground, and helpers that answer "what is under this point?".
// Owns solids (collision boxes), solidMeshes (the same boxes as visible objects) and the blob shadows.
// Used by player.js (collision), dummies.js, projectiles.js and camera.js (so the camera stays out of walls).
// The whole world is boxes lined up with the axes. There are no slopes or rotated shapes, and the collision code relies on that.
// The boxes are DRAWN as chipped rocks (rockGeo), but collide as the plain boxes they really are.

import * as THREE from 'three';
import { V3, clamp } from './util.js';
import { scene } from './core.js';

// ================= world =================
// solids[i] = { min, max } corners, used for collision. solidMeshes[i] = the matching visible box, used for ray tests.
export const solids = [], solidMeshes = [];
export const boxGeo = new THREE.BoxGeometry(1, 1, 1);
// Fake ambient shading, baked into the one shared box shape: every corner at the bottom is darker than at the top.
// Stretched over a box this reads as "grounded and solid", and costs nothing while playing.
{
  const pos = boxGeo.attributes.position;
  const shade = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getY(i) > 0 ? 1 : 0.5;    // 1 = full colour at the top, 0.5 = half as bright at the base
    shade[i * 3] = v;
    shade[i * 3 + 1] = v;
    shade[i * 3 + 2] = v;
  }
  boxGeo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
}
export const edgeGeo = new THREE.EdgesGeometry(boxGeo);
// Thin light outline on every box edge, so shapes stay readable in the dark.
export const edgeMat = new THREE.LineBasicMaterial({ color: 0xffe2c4, transparent: true, opacity: 0.2 });
export const matCache = {};
// lam(colour): one shared material per colour, so fifty boxes of one colour cost a single material.
// vertexColors makes the material use the baked shading above. Only use lam() on boxGeo: any other shape has no
// baked shading and would come out black.
export const lam = c => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c, vertexColors: true }));
// Rock colours: grey stone for the big shapes and walls, sandstone for the platforms, a brown boulder colour for the
// small blocks, and a mossy green for the stairs.
export const COL = { stone: 0x9a96a2, pillar: 0x878c9c, plat: 0xb09a78, wall: 0x73747e, green: 0x74916a, crate: 0x9a8470 };

// The shape of one rock: a block of the given size with its sides chipped and uneven, so it reads as stone and
// not as a building. What matters for play stays exact: the TOP is perfectly flat and at full height, because it
// is walked on, and nothing ever sticks out past the block's true size, because collision uses the plain box.
// salt = any number; it makes two blocks of the same size come out differently.
const CHIP = 0.22;    // the most a side is pushed in, in world units (less on small blocks)
function rockGeo(w, h, d, salt) {
  const cuts = n => clamp(Math.round(n / 2.6), 1, 5);    // how many pieces each edge is cut into: bigger block, more facets
  const cw = cuts(w), ch = cuts(h), cd = cuts(d);
  const box = new THREE.BoxGeometry(w, h, d, cw, ch, cd);
  const pos = box.attributes.position, hw = w / 2, hh = h / 2, hd = d / 2, EDGE = 1e-4;
  const inX = Math.min(CHIP, w * 0.15), inZ = Math.min(CHIP, d * 0.15);
  // A repeatable "random" number 0..1 from a position. The corners of a box are stored once per face; because the
  // number depends only on where the corner is, every copy of a corner moves the same way and no gaps open up.
  const rnd = (x, y, z, k) => {
    const v = Math.sin(Math.round(x * 1000) * 0.012989 + Math.round(y * 1000) * 0.078233 + Math.round(z * 1000) * 0.037719 + k * 4.137 + salt) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const onX = Math.abs(Math.abs(x) - hw) < EDGE, onZ = Math.abs(Math.abs(z) - hd) < EDGE;
    const onTopOrBottom = Math.abs(Math.abs(y) - hh) < EDGE;
    let nx = x, ny = y, nz = z;
    if (onX) nx -= Math.sign(x) * inX * rnd(x, y, z, 1);          // sides are pushed inwards by differing amounts
    else nx += (rnd(x, y, z, 2) - 0.5) * (w / cw) * 0.35;         // other corners slide about a little
    if (onZ) nz -= Math.sign(z) * inZ * rnd(x, y, z, 3);
    else nz += (rnd(x, y, z, 4) - 0.5) * (d / cd) * 0.35;
    if (!onTopOrBottom) ny += (rnd(x, y, z, 5) - 0.5) * (h / ch) * 0.4;    // top and bottom stay level
    pos.setXYZ(i, nx, ny, nz);
  }
  // Give every triangle its own flat face (that is what makes it look cut from stone), and its own slight shade,
  // darker towards the base.
  const geo = box.toNonIndexed();
  box.dispose();
  geo.computeVertexNormals();
  const p = geo.attributes.position, shade = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    const tone = 0.8 + 0.2 * rnd(p.getX(i) + p.getX(i + 1), p.getY(i) + p.getY(i + 2), p.getZ(i + 1) + p.getZ(i + 2), 6);
    for (let k = i; k < i + 3; k++) {
      const v = tone * (0.55 + 0.45 * (p.getY(k) + hh) / h);
      shade[k * 3] = v; shade[k * 3 + 1] = v; shade[k * 3 + 2] = v;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  return geo;
}

// Add a solid block, drawn as a rock. x, z = centre. y = the BOTTOM of the block. w, h, d = size along x, y, z. c = colour.
export function addBox(x, y, z, w, h, d, c = COL.stone) {
  const m = new THREE.Mesh(rockGeo(w, h, d, x * 0.37 + z * 0.91 + y * 0.53), lam(c));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;    // only has an effect on High quality (real shadows)
  scene.add(m); solidMeshes.push(m);
  solids.push({ min: new V3(x - w / 2, y, z - d / 2), max: new V3(x + w / 2, y + h, z + d / 2) });
  return m;
}

// Floor tiles: one small picture of a single tile, drawn here once and repeated across every floor.
const TILE = 4;    // world units per tile
export const tileTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#8f93a6';                 // the seam between tiles
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#c3c6d4';                 // the tile itself
  x.fillRect(3, 3, 122, 122);
  for (let i = 0; i < 260; i++) {          // faint speckles so it is not perfectly flat
    x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    x.fillRect(3 + Math.random() * 118, 3 + Math.random() * 118, 4, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;                      // keeps the tiles sharp when seen at a shallow angle
  return tex;
})();
// Grass for the arena floor: a picture of many short strokes in several greens, repeated like the tiles.
export const grassTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#44702f';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {           // soft darker and lighter patches
    x.fillStyle = Math.random() < 0.5 ? 'rgba(20,45,15,0.16)' : 'rgba(150,190,90,0.12)';
    x.beginPath();
    x.arc(Math.random() * 256, Math.random() * 256, 14 + Math.random() * 30, 0, Math.PI * 2);
    x.fill();
  }
  x.lineCap = 'round';
  const greens = ['#2f5a24', '#3d6f2b', '#5a933c', '#74ad4c', '#8fbf5a'];
  for (let i = 0; i < 2600; i++) {         // the blades
    const px = Math.random() * 256, py = Math.random() * 256, len = 4 + Math.random() * 9;
    x.strokeStyle = greens[Math.floor(Math.random() * greens.length)];
    x.lineWidth = 1 + Math.random() * 1.2;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + (Math.random() - 0.5) * 5, py - len);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
})();
// A square floor of the given size, tinted with a colour: tiles by default, or another repeating picture.
// Not added to the scene; the caller places it.
export function makeFloor(size, tint, tex = tileTex) {
  const geo = new THREE.PlaneGeometry(size, size);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / TILE, uv.getY(i) * size / TILE);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, color: tint }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}
export const ground = makeFloor(400, 0xa3b48e, grassTex);    // the tint mutes the green a little for dusk
scene.add(ground);

// Half the size of the playable square: it runs from -60 to +60 on x and z. The four boxes below are its walls.
export const ARENA = 60;
// The square the player is kept inside right now: centre (cx, cz) and half-width. The main arena by default;
// dojo.js switches it to the training hall and back.
export const area = { cx: 0, cz: 0, half: ARENA };
export function setArea(cx, cz, half) {
  area.cx = cx;
  area.cz = cz;
  area.half = half;
}
addBox(0, 0, -ARENA - 0.5, ARENA * 2 + 2, 6, 1, COL.wall);
addBox(0, 0, ARENA + 0.5, ARENA * 2 + 2, 6, 1, COL.wall);
addBox(-ARENA - 0.5, 0, 0, 1, 6, ARENA * 2, COL.wall);
addBox(ARENA + 0.5, 0, 0, 1, 6, ARENA * 2, COL.wall);

// pillars
addBox(-20, 0, -22, 3, 18, 3, COL.pillar);
addBox(20, 0, -22, 3, 18, 3, COL.pillar);
addBox(-28, 0, 18, 3, 16, 3, COL.pillar);
addBox(28, 0, 18, 3, 16, 3, COL.pillar);
addBox(0, 0, -46, 5, 26, 5, COL.pillar);
// floating platforms
addBox(-12, 4, -4, 6, 0.8, 6, COL.plat);
addBox(12, 7, -12, 5, 0.8, 5, COL.plat);
addBox(6, 10, -22, 4, 0.8, 4, COL.plat);
addBox(0, 12, -30, 6, 0.8, 6, COL.plat);
addBox(-8, 18, -40, 4, 0.8, 4, COL.plat);
addBox(-22, 9, 2, 4, 0.8, 4, COL.plat);
addBox(18, 13, 4, 4, 0.8, 4, COL.plat);
// tower + big block
addBox(-38, 0, -38, 9, 14, 9, COL.stone);
addBox(25, 0, -40, 10, 6, 10, COL.stone);
// staircase to a ledge
for (let i = 0; i < 10; i++) addBox(40, 0, 24 - i * 1.4, 6, (i + 1) * 0.45, 1.4, COL.green);
addBox(40, 0, 7.35, 10, 4.5, 6.7, COL.green);
// wall-jump chimney + reward platform
addBox(-44, 0, 30, 1, 14, 12, COL.wall);
addBox(-38, 0, 30, 1, 14, 12, COL.wall);
addBox(-41, 16, 40, 7, 0.8, 5, COL.plat);
// crates / cover
addBox(8, 0, 8, 2, 2, 2, COL.crate);
addBox(10.2, 0, 9.4, 1.4, 1.4, 1.4, COL.crate);
addBox(-9, 0, 10, 2, 1, 4, COL.crate);
addBox(-16, 0, 32, 8, 3, 2, COL.stone);
addBox(16, 0, 32, 2, 5, 8, COL.stone);
addBox(-4, 0, 36, 3, 8, 3, COL.pillar);
addBox(4, 0, 44, 3, 12, 3, COL.pillar);
// summit flag (decoration)
{
  const pole = new THREE.Mesh(boxGeo, lam(0xb9bfd6)); pole.scale.set(0.1, 2.4, 0.1); pole.position.set(0, 27.2, -46); scene.add(pole);
  const flag = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff3d6a, toneMapped: false })); flag.scale.set(1.1, 0.6, 0.05); flag.position.set(0.6, 28, -46); scene.add(flag);
}

// A curtain of light: it blocks like a wall, except that the player goes straight through it while dashing
// (player.js skips solids marked `phase` during a dash). Used by missions for gates only a dash can pass.
// The camera, the crosshair and the grappling hook all look straight through it, so it never pulls the view in.
// Never pass one to removeBox: its shape is shared.
const phaseMat = new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
export function addPhaseWall(x, y, z, w, h, d) {
  const m = new THREE.Mesh(boxGeo, phaseMat);
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  m.raycast = () => {};
  scene.add(m);
  solidMeshes.push(m);    // kept in step with solids, which removeBox relies on
  solids.push({ min: new V3(x - w / 2, y, z - d / 2), max: new V3(x + w / 2, y + h, z + d / 2), phase: true });
  return m;
}

// Take a box added with addBox out of the world again (m = what addBox returned).
export function removeBox(m) {
  const i = solidMeshes.indexOf(m);
  if (i < 0) return;
  solidMeshes.splice(i, 1);
  solids.splice(i, 1);    // solids and solidMeshes are kept in the same order
  scene.remove(m);
  m.geometry.dispose();    // every rock has a shape of its own
}

// Height of the highest surface under (x, z) that is not above y. Used to stand dummies and shadows on things.
// The 0.35 lets something sunk slightly into a surface still count as standing on it.
export function groundAt(x, z, y) {
  let g = 0;
  for (const s of solids) {
    if (x > s.min.x - 0.1 && x < s.max.x + 0.1 && z > s.min.z - 0.1 && z < s.max.z + 0.1 && s.max.y <= y + 0.35 && s.max.y > g) g = s.max.y;
  }
  return g;
}

// blob shadows
export const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
export const shadowGeo = new THREE.PlaneGeometry(1, 1); shadowGeo.rotateX(-Math.PI / 2);
export const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
// Fake shadow: a soft dark circle on the surface below a character. Real shadows cost far more to draw.
export function makeShadow() { const m = new THREE.Mesh(shadowGeo, shadowMat); scene.add(m); return m; }
// Put a shadow under (x, y, z). It shrinks as the character gets higher.
export function placeShadow(m, x, y, z) {
  const g = groundAt(x, z, y + 0.05); const s = clamp(1.2 - (y - g) * 0.05, 0.35, 1.2);
  m.position.set(x, g + 0.025, z); m.scale.set(s, 1, s);
}
