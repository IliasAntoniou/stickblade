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
export const edgeGeo = new THREE.EdgesGeometry(boxGeo);
export const edgeMat = new THREE.LineBasicMaterial({ color: 0x4a545d, transparent: true, opacity: 0.35 });
export const matCache = {};
// lam(colour): one shared material per colour, so fifty boxes of one colour cost a single material.
export const lam = c => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c }));
export const COL = { stone: 0xe6e0d2, pillar: 0xb9c7d4, plat: 0xf0c27a, wall: 0xd5dde4, green: 0x9cc9b0, crate: 0xd9b48f };

// Add a solid box. x, z = centre. y = the BOTTOM of the box. w, h, d = size along x, y, z. c = colour.
export function addBox(x, y, z, w, h, d, c = COL.stone) {
  const m = new THREE.Mesh(boxGeo, lam(c));
  m.scale.set(w, h, d); m.position.set(x, y + h / 2, z);
  m.add(new THREE.LineSegments(edgeGeo, edgeMat));
  scene.add(m); solidMeshes.push(m);
  solids.push({ min: new V3(x - w / 2, y, z - d / 2), max: new V3(x + w / 2, y + h, z + d / 2) });
  return m;
}

export const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0xb4bfc8 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
export const grid = new THREE.GridHelper(120, 60, 0x8d99a3, 0x9da9b2); grid.position.y = 0.01; scene.add(grid);

// Half the size of the playable square: it runs from -60 to +60 on x and z. The four boxes below are its walls.
export const ARENA = 60;
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
  const pole = new THREE.Mesh(boxGeo, lam(0x4a545d)); pole.scale.set(0.1, 2.4, 0.1); pole.position.set(0, 27.2, -46); scene.add(pole);
  const flag = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff3d6a })); flag.scale.set(1.1, 0.6, 0.05); flag.position.set(0.6, 28, -46); scene.add(flag);
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
