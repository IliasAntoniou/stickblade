import * as THREE from 'three';
import { V3, _pv } from './util.js';
import { scene } from './core.js';
import { solids } from './world.js';
import { SG } from './stickman.js';
import { dummies, hitDummy } from './dummies.js';

// ================= projectiles =================
export const projMat = new THREE.MeshLambertMaterial({ color: 0x1b1d22 });
export const projAccent = new THREE.MeshBasicMaterial({ color: 0xffffff });
export const projs = [];
for (let i = 0; i < 16; i++) {
  const g = new THREE.Group();
  const k = new THREE.Mesh(SG.kunai, projMat);
  const s = new THREE.Group(); s.add(new THREE.Mesh(SG.shaft, projMat)); s.add(new THREE.Mesh(SG.spearHead, projAccent));
  g.add(k); g.add(s); g.visible = false; scene.add(g);
  projs.push({ g, k, s, active: false, pos: new V3(), vel: new V3(), off: new V3(), dir: new V3(), stuck: null, life: 0, grav: 0, o: null });
}
export function fireProj(kind, from, dir, speed, grav, o) {
  const p = projs.find(p => !p.active); if (!p) return null;
  p.k.visible = kind !== 'spear'; p.s.visible = kind === 'spear';
  p.pos.copy(from); p.vel.copy(dir).multiplyScalar(speed); p.dir.copy(dir); p.grav = grav; p.life = o.life; p.o = o; p.stuck = null;
  p.active = true; p.g.visible = true; p.g.position.copy(from); p.g.lookAt(_pv.copy(from).add(dir));
  return p;
}
export function killProj(p) { p.active = false; p.g.visible = false; }
export function updateProjs(dt) {
  for (const p of projs) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { killProj(p); if (p.o.onExpire) p.o.onExpire(p); continue; }
    if (p.stuck) {
      if (p.stuck !== 'solid') { if (p.stuck.dead) p.stuck = 'solid'; else p.pos.copy(p.stuck.pos).add(p.off); }
      p.g.position.copy(p.pos); continue;
    }
    const n = Math.max(1, Math.ceil(p.vel.length() * dt / 0.4)), h = dt / n;
    step: for (let i = 0; i < n; i++) {
      p.vel.y -= p.grav * h; p.pos.addScaledVector(p.vel, h);
      for (const d of dummies) {
        if (d.dead) continue;
        const dx = p.pos.x - d.pos.x, dz = p.pos.z - d.pos.z, dy = p.pos.y - d.pos.y;
        if (dx * dx + dz * dz < 0.3 && dy > -0.1 && dy < 2.1) {
          hitDummy(d, p.o.dmg, p.vel.x * 0.04, p.vel.z * 0.04, d.grounded ? 0 : 3, !!p.o.heavy, 0.02, p.pos);
          if (p.o.stick && !d.dead) { p.stuck = d; p.off.copy(p.pos).sub(d.pos); } else if (p.o.stick) p.stuck = 'solid'; else killProj(p);
          break step;
        }
      }
      if (p.pos.y <= 0.02) { p.pos.y = 0.02; if (p.o.stick) p.stuck = 'solid'; else killProj(p); break; }
      for (const s of solids) {
        if (p.pos.x > s.min.x && p.pos.x < s.max.x && p.pos.y > s.min.y && p.pos.y < s.max.y && p.pos.z > s.min.z && p.pos.z < s.max.z) {
          if (p.o.stick) p.stuck = 'solid'; else killProj(p);
          break step;
        }
      }
    }
    if (p.vel.lengthSq() > 0.01) p.dir.copy(p.vel).normalize();
    p.g.position.copy(p.pos);
    if (!p.stuck) p.g.lookAt(_pv.copy(p.pos).add(p.vel));
  }
}
