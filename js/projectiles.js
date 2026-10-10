// projectiles.js: the Mage's missiles. A missile is a glowing ball that flies in a line, can bend after a
// target, and hits the first enemy or wall it meets. A pool of 24, like the effects in fx.js: none is ever
// created while playing.
// What a missile looks like and how it flies is decided by whoever fires it (classes/mage.js), through the
// options given to fireBolt.
// Used by: classes/mage.js (fireBolt), update.js (updateProjs every frame), player.js (clearProjs on a respawn).

import * as THREE from 'three';
import { V3, _pv } from './util.js';
import { scene } from './core.js';
import { solids } from './world.js';
import { glowTex, burst } from './fx.js';
import { setHitSrc } from './state.js';
import { dummies, hitDummy } from './dummies.js';

// ================= projectiles =================
const ballGeo = new THREE.SphereGeometry(0.16, 10, 8);
export const projs = [];
for (let i = 0; i < 24; i++) {
  // each missile has materials of its own, because each can be a different colour at the same time
  const ball = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
  halo.scale.setScalar(1.1);
  ball.add(halo);
  ball.visible = false;
  scene.add(ball);
  projs.push({ ball, halo, active: false, pos: new V3(), vel: new V3(), life: 0, o: null, pierce: 0, struck: new Set(), sparkT: 0 });
}
const _want = new V3();

// Fire one. from = where it starts, dir = which way (length 1). Returns it, or null if all 24 are in the air.
//   o.speed  = units per second.            o.life = seconds before it fades out.
//   o.dmg    = damage.  o.heavy = a big hit (interrupts fighters).
//   o.src    = which attack its hit belongs to ('atk', 'q', 'e'...: see hitSrc in state.js), so a trial can tell.
//   o.color, o.size = its look (size 1 is a ball about 0.3 across).  o.spark = which kind of spark it sheds (see burst in fx.js).
//   o.homing = a dummy it bends towards, or null.  o.turn = how hard it bends (higher = tighter).
//   o.pierce = how many enemies it goes on through after the first.
//   o.onHit(p, d) = called when it hits: d is the dummy, or null when it hit a wall or the ground.
export function fireBolt(from, dir, o) {
  const p = projs.find(candidate => !candidate.active);
  if (!p) return null;
  p.pos.copy(from);
  p.vel.copy(dir).multiplyScalar(o.speed);
  p.life = o.life;
  p.o = o;
  p.pierce = o.pierce || 0;
  p.struck.clear();
  p.sparkT = 0;
  p.active = true;
  p.ball.material.color.setHex(o.color);
  p.halo.material.color.setHex(o.color);
  p.ball.scale.setScalar(o.size || 1);
  p.ball.position.copy(from);
  p.ball.visible = true;
  return p;
}
export function killProj(p) {
  p.active = false;
  p.ball.visible = false;
}
// Take every missile out of the air (the player respawned or changed class).
export function clearProjs() {
  for (const p of projs) killProj(p);
}
// A missile has reached something. d = the dummy it hit, or null for a wall or the ground.
// Returns true if the missile is finished.
function arrive(p, d) {
  if (d) {
    p.struck.add(d);
    setHitSrc(p.o.src || 'other');
    hitDummy(d, p.o.dmg, p.vel.x * 0.04, p.vel.z * 0.04, d.grounded ? 0 : 3, !!p.o.heavy, 0.02, p.pos);
  }
  burst(p.pos, 6, 6, p.o.spark || 0);
  if (p.o.onHit) p.o.onHit(p, d);
  if (d && p.pierce > 0) {
    p.pierce--;
    return false;    // it carries on through
  }
  killProj(p);
  return true;
}
// Move every missile, in small steps so a fast one cannot skip through a dummy or wall.
export function updateProjs(dt) {
  for (const p of projs) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { killProj(p); continue; }
    // bending after its target: the direction turns towards it, the speed stays the same
    const target = p.o.homing;
    if (target && !target.dead && !p.struck.has(target)) {
      const speed = p.vel.length();
      target.chest(_want).sub(p.pos).normalize().multiplyScalar(speed);
      p.vel.lerp(_want, 1 - Math.exp(-(p.o.turn || 3) * dt)).setLength(speed);
    }
    const steps = Math.max(1, Math.ceil(p.vel.length() * dt / 0.4)), h = dt / steps;
    step: for (let i = 0; i < steps; i++) {
      p.pos.addScaledVector(p.vel, h);
      for (const d of dummies) {
        if (d.dead || p.struck.has(d)) continue;
        const dx = p.pos.x - d.pos.x, dz = p.pos.z - d.pos.z, dy = p.pos.y - d.pos.y;
        if (dx * dx + dz * dz < 0.36 && dy > -0.1 && dy < 2.1 && arrive(p, d)) break step;
      }
      if (p.pos.y <= 0.02) { p.pos.y = 0.02; arrive(p, null); break; }
      for (const s of solids) {
        if (!s.phase && p.pos.x > s.min.x && p.pos.x < s.max.x && p.pos.y > s.min.y && p.pos.y < s.max.y && p.pos.z > s.min.z && p.pos.z < s.max.z) {
          arrive(p, null);
          break step;
        }
      }
    }
    if (!p.active) continue;
    p.ball.position.copy(p.pos);
    // a thin trail of sparks behind it
    p.sparkT -= dt;
    if (p.sparkT <= 0) {
      p.sparkT = 0.03;
      burst(_pv.copy(p.pos), 1, 1.5, p.o.spark || 0);
    }
  }
}
