// world.js: the level. Every solid box, the ground, and helpers that answer "what is under this point?".
// Owns solids (collision boxes), solidMeshes (the same boxes as visible objects) and the blob shadows.
// Used by player.js (collision), dummies.js, projectiles.js and camera.js (so the camera stays out of walls).
// The whole world is boxes lined up with the axes. There are no slopes or rotated shapes, and the collision code relies on that.

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
// Box colours, chosen for dusk: muted cool stone and walls, with warm amber platforms and crates as the accents.
export const COL = { stone: 0xa9a2b4, pillar: 0x8f9bbd, plat: 0xe09a55, wall: 0x74788f, green: 0x6fb09d, crate: 0xb9835a };

// Add a solid box. x, z = centre. y = the BOTTOM of the box. w, h, d = size along x, y, z. c = colour.
export function addBox(x, y, z, w, h, d, c = COL.stone) {
  const m = new THREE.Mesh(boxGeo, lam(c));
  m.scale.set(w, h, d); m.position.set(x, y + h / 2, z);
  m.add(new THREE.LineSegments(edgeGeo, edgeMat));
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
// A square tiled floor of the given size, tinted with a colour. Not added to the scene; the caller places it.
export function makeFloor(size, tint) {
  const geo = new THREE.PlaneGeometry(size, size);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / TILE, uv.getY(i) * size / TILE);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tileTex, color: tint }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}
export const ground = makeFloor(400, 0x7c7e99);
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

// Take a box added with addBox out of the world again (m = what addBox returned).
export function removeBox(m) {
  const i = solidMeshes.indexOf(m);
  if (i < 0) return;
  solidMeshes.splice(i, 1);
  solids.splice(i, 1);    // solids and solidMeshes are kept in the same order
  scene.remove(m);
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
