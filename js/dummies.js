// dummies.js: the things you hit. One Dummy class for every type; `type` switches the behaviour:
//   basic = stands still, shield = blocks hits from the front, flying = circles in the air, fighter = attacks the player.
// A dummy made with the option `gang` is a real enemy from the story (quests.js): it hunts the player across the
// whole arena, never heals, and once knocked out it stays down and is taken out of the world. Missions (missions.js)
// give gang members more options: a place they are kept inside (zone), their own speed and size, an element they
// are weak to, and barricades that stand still and only break when a mount rams them.
// Also the damage functions every attack goes through: hitDummy (one target) and hitArea (everything in a circle).
// NOTE: per-type behaviour is still if-checks inside Dummy. It moves into DTYPE in the dummy-types phase.

import * as THREE from 'three';
import { V3, TAU, clamp, damp, angDiff, angDamp, _hv, _dv } from './util.js';
import { scene, camera } from './core.js';
import { solids, boxGeo, edgeGeo, edgeMat, lam, groundAt, makeShadow, placeShadow, ARENA } from './world.js';
import { addRim, castShadows, makeStickman, POSE_KEYS, DUMMY_POSE, F_IDLE, F_SLAM, F_LWIND, F_LUNGE, F_STUN, applyPose } from './stickman.js';
import { ringGeo, spawnRing, burst, spawnText, shake, addHitstop } from './fx.js';
import { T, P, dlg, chal, TUNE, hitSrc, addHit } from './state.js';
import { hitAllowed, onHit } from './progress.js';
import { onStyleHit } from './styles.js';
import { strikeMaster } from './master.js';
import { dressDummy } from './skins.js';
import { questEvent } from './quests.js';
import { SOAK } from './elements.js';
import { style } from './styles.js';
import { tp, hurtPlayer } from './player.js';
import { update } from './update.js';

// ================= dummies =================
export const barBgGeo = new THREE.PlaneGeometry(1.24, 0.15);
export const barFgGeo = new THREE.PlaneGeometry(1, 0.1).translate(0.5, 0, 0);
export const barBgMat = new THREE.MeshBasicMaterial({ color: 0x14171c, transparent: true, opacity: 0.7, depthWrite: false });
// Colour and health per type.
export const DTYPE = {
  basic: { color: 0xd8573c, hp: 600 },
  shield: { color: 0x8796a8, hp: 700 },
  flying: { color: 0x2fa4d9, hp: 400 },
  fighter: { color: 0xa070ff, hp: 900 },
};
const GANG_SIGHT = 80;     // how far away a gang member notices the player (the arena is 120 across)
const WEAK_BONUS = 1.6;    // damage multiplier when an enemy is hit under the sword style it is weak to
const RAM_BONUS = 3;       // damage multiplier for a mount ramming something that only ramming can break
const YARD = { cx: 0, cz: 0, half: ARENA };    // the main arena, where gang members are kept unless told otherwise
const GANG_SPEED = 5.2;    // how fast it walks, units per second. A training fighter does 3.4; the player runs at about 9.5
// True if a dummy standing at p would be inside a wall.
export function dummyBlocked(p) {
  for (const s of solids) if (p.x + 0.3 > s.min.x && p.x - 0.3 < s.max.x && p.z + 0.3 > s.min.z && p.z - 0.3 < s.max.z && p.y + 1.8 > s.min.y && p.y + 0.4 < s.max.y) return true;
  return false;
}

export class Dummy {
  constructor(type, x, y, z, o = {}) {
    this.type = type; const D = DTYPE[type];
    // Story enemies (quests.js). gang = one of the Ash Hand, boss = their leader in a fight (bigger, dressed heavier).
    this.gang = !!o.gang;
    this.boss = !!o.boss;
    this.gone = false;               // a gang member that has been knocked out and is waiting to be removed
    this.zone = o.zone || YARD;      // the square it is kept inside: { cx, cz, half }
    this.speed = o.speed || GANG_SPEED;    // how fast a gang member walks
    this.size = o.size || 1;         // how big it is drawn (1 = normal)
    // weak = the sword style that hurts it most (WEAK_BONUS). tough = what every other hit is multiplied by:
    // an enemy with a weakness shrugs off part of anything else.
    this.weak = o.weak || null;
    this.tough = o.tough ?? (o.weak ? 0.6 : 1);
    // look = a shape it is drawn as in place of a person ('barricade'). fixed = it never moves or turns.
    // ramOnly = only a mount running into it can damage it.
    this.look = o.look || null;
    this.fixed = !!o.fixed;
    this.ramOnly = !!o.ramOnly;
    this.baseHp = o.hp || D.hp;      // health before the tuning panel's multiplier
    this.color = o.color ?? D.color;
    this.mat = addRim(new THREE.MeshLambertMaterial({ color: this.color, emissive: 0x000000 }));
    this.sm = makeStickman(this.mat, null, false); scene.add(this.sm.root);
    castShadows(this.sm);
    this.pose = { ...(type === 'fighter' ? F_IDLE : DUMMY_POSE) }; applyPose(this.sm, this.pose);
    this.base = new V3(x, y, z); this.anchor = this.base.clone();
    this.patrol = o.patrol || 0; this.radius = o.radius || 0; this.phase = Math.random() * TAU;
    this.pos = this.anchor.clone(); this.vel = new V3();
    this.maxHp = this.baseHp; this.hp = this.maxHp;
    this.sinceHit = 99; this.flash = 0; this.rage = 0; this.tx = 0; this.tz = 0; this.tvx = 0; this.tvz = 0;
    this.yaw = 0; this.dead = false; this.deadT = 0; this.spin = 0; this.grounded = true;
    this.floatT = 0; this.stunT = 0; this.pinned = false; this.engaged = false;
    // Burning (Flame style): burnT = seconds left, burnDps = damage per second, burnTick = time to the next tick.
    this.burnT = 0; this.burnDps = 0; this.burnTick = 0;
    // Soaked (Water's Blink Strike, elements.js): seconds left. A soaked enemy takes more damage and a fighter is slowed.
    this.soakT = 0;
    if (type === 'shield') {
      const sh = new THREE.Mesh(boxGeo, lam(0x5d6b7a)); sh.scale.set(1.15, 1.5, 0.12); sh.position.set(0, 1.1, 0.45);
      sh.add(new THREE.LineSegments(edgeGeo, edgeMat)); this.sm.root.add(sh);
    }
    if (type === 'flying') {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 20), new THREE.MeshBasicMaterial({ color: 0x9be3ff }));
      halo.rotation.x = Math.PI / 2; halo.position.y = 0.62; this.sm.chest.add(halo);
      this.halo = halo;
    }
    if (type === 'fighter') {
      this.ai = 'idle'; this.aiT = 0; this.aiCd = 1; this.lungeDir = new V3(); this.lungeHit = false;
      this.warnRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
      this.warnLine = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }));
      this.warnRing.visible = this.warnLine.visible = false; scene.add(this.warnRing); scene.add(this.warnLine);
    }
    this.bar = new THREE.Group();
    this.bar.add(new THREE.Mesh(barBgGeo, barBgMat));
    this.fgMat = new THREE.MeshBasicMaterial({ color: 0x5ee08a, depthWrite: false });
    this.fg = new THREE.Mesh(barFgGeo, this.fgMat); this.fg.position.set(-0.6, 0, 0.001); this.bar.add(this.fg);
    scene.add(this.bar);
    this.shadow = makeShadow();
    dressDummy(this);    // the shapes that make each type look like what it is (skins.js)
    if (type === 'flying') this.path(this.pos);
  }
  // Take this dummy out of the world for good (trial dummies, when their trial ends). Does not touch the dummies list.
  dispose() {
    this.dead = true;    // anything still holding on to it (grapple, a stuck kunai) lets go of dead dummies
    scene.remove(this.sm.root);
    scene.remove(this.bar);
    scene.remove(this.shadow);
    this.mat.dispose();
    this.fgMat.dispose();
    if (this.halo) {
      this.halo.geometry.dispose();
      this.halo.material.dispose();
    }
    if (this.warnRing) {
      scene.remove(this.warnRing);
      scene.remove(this.warnLine);
      this.warnRing.material.dispose();
      this.warnLine.material.dispose();
    }
  }
  // A point at chest height: where hits land and where lock-on aims.
  chest(out) { return out.set(this.pos.x, this.pos.y + 1.25, this.pos.z); }
  // Flying dummies: where on its circle it should be right now.
  path(out) {
    const a = T * 0.5 + this.phase;
    return out.set(this.base.x + Math.cos(a) * this.radius, this.base.y + Math.sin(a * 2.2) * 0.8, this.base.z + Math.sin(a) * this.radius);
  }
  // Fighters: drop the current attack and hide the red warning marks.
  cancelAtk() { if (this.type !== 'fighter') return; this.ai = 'idle'; this.aiCd = 1.2; this.warnRing.visible = this.warnLine.visible = false; }
  // Cannot act for t seconds.
  stun(t) { this.stunT = Math.max(this.stunT, t); this.cancelAtk(); }
  // A heavy hit during a fighter's wind-up cancels the attack.
  interrupt() {
    if (this.type !== 'fighter' || (this.ai !== 'windSlam' && this.ai !== 'windLunge')) return false;
    this.stun(0.7); this.chest(_dv); _dv.y += 0.7; spawnText(_dv, 'INTERRUPTED', 'dodge');
    return true;
  }
  // Thrown hard into a wall: extra damage.
  splat() {
    if (this.dead) return;
    dealDamage(this, 20, true, 0.06, 'SPLAT');
    if (this.hp <= 0) this.ko(-this.vel.x, -this.vel.z);
  }
  // Knocked out: fly off in direction (kx, kz), come back 1.8 s later.
  ko(kx, kz) {
    this.dead = true; this.deadT = 1.8; this.hp = 0; this.floatT = 0; this.cancelAtk();
    const l = Math.hypot(kx, kz) || 1;
    this.vel.set(kx / l * 9, 13, kz / l * 9); this.spin = 0;
    this.chest(_dv); _dv.y += 0.6; spawnText(_dv, 'K.O.', 'ko'); burst(_dv, 20, 12); shake(0.4);
    if (chal.phase === 'run') chal.kos++;
    questEvent('ko', { d: this });    // the story counts knockouts (quests.js)
  }
  // Back to full health at its home spot. poof = show the ring effect.
  respawn(poof = true) {
    if (this.gang) return;    // a gang member never comes back or heals; the story spawns a fresh group if it needs one
    this.dead = false; this.hp = this.maxHp; this.vel.set(0, 0, 0);
    if (this.type === 'flying') this.path(this.pos); else this.pos.copy(this.anchor);
    this.sinceHit = 99; this.tx = this.tz = this.tvx = this.tvz = 0; this.spin = 0; this.floatT = 0; this.stunT = 0; this.burnT = 0; this.soakT = 0; this.cancelAtk();
    if (poof) spawnRing(_dv.copy(this.pos).setY(this.pos.y + 0.05), 0.2, 2.2, 0.35, this.color);
  }
  // Once per frame: movement, gravity, drifting back to its spot, healing, health bar, shadow.
  update(dt) {
    const ty = this.type, flying = ty === 'flying';
    if (this.patrol) this.anchor.x = this.base.x + Math.sin(T * 0.55) * this.patrol;
    const gy = groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.dead) {
      this.deadT -= dt; this.vel.y -= 30 * dt; this.pos.addScaledVector(this.vel, dt); this.spin += dt * 9;
      if (this.pos.y < gy) { this.pos.y = gy; this.vel.y = Math.abs(this.vel.y) * 0.3; this.vel.x *= 0.6; this.vel.z *= 0.6; }
      if (this.deadT <= 0) {
        if (this.gang) this.gone = true;    // quests.js takes it out of the world after this frame
        else this.respawn();
      }
    } else {
      this.sinceHit += dt; this.stunT = Math.max(0, this.stunT - dt);
      this.soakT = Math.max(0, this.soakT - dt);
      if (this.burnT > 0) {
        // Burning: a small hit of damage twice a second. Quiet on purpose: no hitstop, shake or combo.
        this.burnT -= dt;
        this.burnTick -= dt;
        if (this.burnTick <= 0) {
          this.burnTick = 0.5;
          const dmg = Math.round(this.burnDps * 0.5);
          this.hp -= dmg;
          this.chest(_dv); spawnText(_dv, dmg, 'burn'); burst(_dv, 2, 4);
          if (this.hp <= 0) this.ko(0, 0);
        }
      }
      if (this.floatT > 0) {
        this.floatT -= dt; this.vel.y = damp(this.vel.y, 0, 4, dt);
        const f = Math.exp(-3 * dt); this.vel.x *= f; this.vel.z *= f;
      } else if (flying && this.sinceHit >= 0.9) {
        this.path(_dv); this.pos.lerp(_dv, 1 - Math.exp(-2.5 * dt)); this.vel.multiplyScalar(Math.exp(-4 * dt));
      } else this.vel.y -= (this.sinceHit < 0.6 ? 15 : 32) * dt;
      if (this.fixed) { this.vel.x = 0; this.vel.z = 0; }    // a barricade is not pushed about
      const ox = this.pos.x, oz = this.pos.z;
      this.pos.addScaledVector(this.vel, dt);
      if (!this.pinned && dummyBlocked(this.pos)) {
        const sp = Math.hypot(this.vel.x, this.vel.z);
        this.pos.x = ox; this.pos.z = oz; this.vel.x *= -0.25; this.vel.z *= -0.25;
        if (sp > 11 && this.sinceHit < 1.5) this.splat();
      }
      if (this.pos.y <= gy) {
        this.pos.y = gy; if (this.vel.y < 0) this.vel.y = 0;
        const f = Math.exp(-9 * dt); this.vel.x *= f; this.vel.z *= f; this.grounded = true;
      } else { const f = Math.exp(-1.2 * dt); this.vel.x *= f; this.vel.z *= f; this.grounded = false; }
      if (!this.dead && !flying && !this.gang && this.grounded && this.sinceHit > 1 && !(ty === 'fighter' && this.engaged)) {
        if (Math.abs(gy - this.anchor.y) < 0.05) {
          const k = this.patrol ? 6 : 3;
          this.pos.x = damp(this.pos.x, this.anchor.x, k, dt); this.pos.z = damp(this.pos.z, this.anchor.z, k, dt);
        } else if (this.sinceHit > 2.2) this.respawn();
      }
      if (this.gang) {
        // Nothing pulls a gang member back to a home spot, so keep it inside the walls of its zone where it can be reached.
        this.pos.x = clamp(this.pos.x, this.zone.cx - this.zone.half + 1, this.zone.cx + this.zone.half - 1);
        this.pos.z = clamp(this.pos.z, this.zone.cz - this.zone.half + 1, this.zone.cz + this.zone.half - 1);
      }
      if (TUNE.dummyRegen && !this.gang && this.sinceHit > 4 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.5);
      if (!this.dead) {
        const want = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
        if (ty === 'shield') this.yaw += clamp(angDiff(this.yaw, want), -2.2 * dt, 2.2 * dt);
        else if (ty !== 'fighter' && !this.fixed) this.yaw = angDamp(this.yaw, want, 3, dt);
        if (ty === 'fighter') this.fighterAI(dt, gy);
      }
    }
    this.tvx += (-90 * this.tx - 9 * this.tvx) * dt; this.tx = clamp(this.tx + this.tvx * dt, -1.3, 1.3);
    this.tvz += (-90 * this.tz - 9 * this.tvz) * dt; this.tz = clamp(this.tz + this.tvz * dt, -1.3, 1.3);
    this.flash = Math.max(0, this.flash - dt * 7);
    const fire = this.burnT > 0 && !this.dead ? 0.45 + Math.sin(T * 18) * 0.15 : 0;    // a burning dummy glows and flickers orange
    const wet = this.soakT > 0 && !this.dead ? 0.5 : 0;    // a soaked enemy is tinted blue
    this.mat.emissive.setRGB(this.flash * 0.9 + this.rage * 0.9 + fire, this.flash * 0.9 + fire * 0.3 + wet * 0.3, this.flash * 0.9 + wet);
    this.sm.root.position.copy(this.pos); this.sm.root.rotation.y = this.yaw;
    if (ty === 'fighter') {
      applyPose(this.sm, this.pose);
      this.sm.body.rotation.x += this.tx + (this.dead ? this.spin : 0); this.sm.body.rotation.z += this.tz;
    } else this.sm.body.rotation.set(this.tx + (this.dead ? this.spin : 0), 0, this.tz);
    const r = clamp(this.hp / this.maxHp, 0, 1);
    this.fg.scale.x = Math.max(0.001, 1.2 * r);
    this.fgMat.color.setHex(r > 0.5 ? 0x5ee08a : r > 0.25 ? 0xf2c14e : 0xff4d4d);
    this.bar.position.set(this.pos.x, this.pos.y + 2.25, this.pos.z);
    this.bar.quaternion.copy(camera.quaternion);
    this.bar.visible = !this.dead;
    if (this.wings) {
      // winged dummies flap; faster while they are being knocked about
      const flap = 0.55 + Math.sin(T * (this.sinceHit < 1 ? 26 : 11) + this.phase) * 0.55;
      this.wings[0].rotation.y = -flap;
      this.wings[1].rotation.y = flap;
    }
    placeShadow(this.shadow, this.pos.x, this.pos.y, this.pos.z);
  }
  // Fighter brain. A small state machine kept in this.ai:
  //   idle -> windSlam (red ring, 0.75 s) -> recover               when the player is close
  //   idle -> windLunge (red line, 0.6 s) -> lunge -> recover      when the player is further away
  // The red marks are the warning. Damage only happens when the wind-up ends.
  fighterAI(dt, gy) {
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, dist = Math.hypot(dx, dz) || 0.001, dy = P.pos.y - this.pos.y;
    const leash = Math.hypot(this.pos.x - this.anchor.x, this.pos.z - this.anchor.z);
    // A training fighter guards its own patch. A gang member has come for the player: it sees right across the
    // arena, at any height, and has no home to stay near.
    const inSight = this.gang ? dist < GANG_SIGHT : dist < 14 && Math.abs(dy) < 4 && leash < 18;
    const canSee = TUNE.fightersAttack && P.smokeT <= 0 && !dlg.open && chal.phase !== 'count' && inSight;
    const pace = this.soakT > 0 ? SOAK.slow : 1;    // soaked: slower to walk and slower to ready an attack
    this.aiCd -= dt * pace; this.rage = 0;
    let tp = F_IDLE;
    if (this.stunT > 0 || !this.grounded || this.floatT > 0) {
      if (this.ai !== 'idle') this.cancelAtk();
      tp = F_STUN;
    } else switch (this.ai) {
      case 'idle': {
        this.engaged = canSee;
        if (!canSee) { this.yaw = angDamp(this.yaw, Math.atan2(dx, dz), 2, dt); break; }
        this.yaw = angDamp(this.yaw, Math.atan2(dx, dz), 8, dt);
        if (this.aiCd <= 0) {
          if (dist < 3.4) { this.ai = 'windSlam'; this.aiT = 0.75; }
          else if (dist < 10) { this.ai = 'windLunge'; this.aiT = 0.6; this.lungeDir.set(dx / dist, 0, dz / dist); this.yaw = Math.atan2(dx, dz); }
        }
        if (this.ai === 'idle' && dist > 2.6 && this.sinceHit > 0.4) {
          const ox = this.pos.x, oz = this.pos.z;
          const stride = (this.gang ? this.speed : 3.4) * pace * dt;
          this.pos.x += dx / dist * stride; this.pos.z += dz / dist * stride;
          if (dummyBlocked(this.pos)) {
            this.pos.x = ox; this.pos.z = oz;
            if (this.gang) {
              // A rock is in the way. Slide along it (sideways first, then forwards) so it does not stand stuck behind it.
              this.pos.x = ox + Math.sign(dx) * stride;
              if (dummyBlocked(this.pos)) {
                this.pos.x = ox;
                this.pos.z = oz + Math.sign(dz) * stride;
                if (dummyBlocked(this.pos)) this.pos.z = oz;
              }
            }
          }
        }
        break;
      }
      case 'windSlam': {
        this.aiT -= dt; const k = 1 - this.aiT / 0.75; this.rage = k; tp = F_SLAM;
        this.warnRing.visible = true; this.warnRing.position.set(this.pos.x, gy + 0.04, this.pos.z);
        this.warnRing.scale.setScalar(3.7); this.warnRing.material.opacity = 0.2 + 0.6 * k;
        if (this.aiT <= 0) {
          this.warnRing.visible = false;
          spawnRing(_dv.set(this.pos.x, gy + 0.05, this.pos.z), 0.5, 3.9, 0.3, 0xff2244); shake(0.3);
          this.ai = 'recover'; this.aiT = 0.7; this.aiCd = 1.6;
          if (dist < 3.7 && dy > -1.5 && dy < 2.5) hurtPlayer(15, this.pos, this);
        }
        break;
      }
      case 'windLunge': {
        this.aiT -= dt; this.rage = 1 - this.aiT / 0.6; tp = F_LWIND;
        const L = this.warnLine; L.visible = true;
        L.position.set(this.pos.x + this.lungeDir.x * 4.6, gy + 0.04, this.pos.z + this.lungeDir.z * 4.6);
        L.rotation.y = Math.atan2(this.lungeDir.x, this.lungeDir.z); L.scale.set(1.0, 0.03, 9);
        L.material.opacity = 0.15 + 0.5 * this.rage;
        if (this.aiT <= 0) { L.visible = false; this.ai = 'lunge'; this.aiT = 0.3; this.lungeHit = false; }
        break;
      }
      case 'lunge': {
        this.aiT -= dt; this.rage = 1; tp = F_LUNGE;
        const ox = this.pos.x, oz = this.pos.z;
        this.pos.addScaledVector(this.lungeDir, 30 * dt);
        if (dummyBlocked(this.pos)) { this.pos.x = ox; this.pos.z = oz; this.aiT = 0; }
        if (!this.lungeHit && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 1.5 && Math.abs(dy) < 2) { this.lungeHit = true; hurtPlayer(12, this.pos, this); }
        if (this.aiT <= 0 && this.ai === 'lunge') { this.ai = 'recover'; this.aiT = 0.6; this.aiCd = 1.4; }
        break;
      }
      case 'recover': { this.aiT -= dt; if (this.aiT <= 0) this.ai = 'idle'; break; }
    }
    const k = 1 - Math.exp(-16 * dt);
    for (const key of POSE_KEYS) this.pose[key] += (tp[key] - this.pose[key]) * k;
  }
}

// Every dummy on the map: type, x, y, z, options (patrol = side-to-side distance, radius = size of a flying circle).
export const dummies = [
  new Dummy('basic', -5, 0, -4), new Dummy('basic', 0, 0, -7), new Dummy('basic', 5, 0, -4),
  new Dummy('basic', 0, 0, -17, { patrol: 10 }),
  new Dummy('shield', -10, 0, -11), new Dummy('shield', 10, 0, -11),
  new Dummy('basic', -12, 4.8, -4), new Dummy('basic', 12, 7.8, -12), new Dummy('basic', 0, 12.8, -30),
  new Dummy('basic', -38, 14, -38), new Dummy('basic', 25, 6, -40), new Dummy('basic', 40, 4.5, 7),
  new Dummy('basic', -41, 16.8, 40), new Dummy('basic', 18, 13.8, 4),
  new Dummy('flying', -8, 7, 26, { radius: 6 }), new Dummy('flying', 14, 10, 22, { radius: 4 }), new Dummy('flying', -30, 12, -18, { radius: 5 }),
  new Dummy('fighter', -26, 0, -4), new Dummy('fighter', 30, 0, -18),
];

// Take health off a dummy and play the feedback (number, sparks, hitstop, shake, combo).
// Call hitDummy instead unless you really want to skip blocking and knockback.
export function dealDamage(d, dmg, heavy, stop, label) {
  d.hp -= dmg; d.sinceHit = 0; d.flash = 1;
  d.chest(_hv); spawnText(_hv, label ? label + ' ' + dmg : dmg, heavy ? 'big' : ''); burst(_hv, heavy ? 14 : 7, heavy ? 11 : 8);
  addHitstop(stop ?? (heavy ? 0.08 : 0.04)); shake(heavy ? 0.35 : 0.12);
  addHit(dmg);
}
// Hit one dummy. kx, kz = knockback push. up = upward launch speed. heavy = big hit (interrupts fighters).
// stop = hitstop seconds (null = default). src = where the hit comes from (for shield blocking). top = true ignores shields.
// returns true if the hit landed (shield dummies block from the front)
export function hitDummy(d, dmg, kx, kz, up, heavy = false, stop = null, src = P.pos, top = false) {
  if (d.dead) return false;
  // During a trial only the attacks it allows can hurt dummies.
  if (!hitAllowed()) {
    d.chest(_hv);
    spawnText(_hv, 'IMMUNE', 'block');
    return false;
  }
  // A barricade: swords and skills bounce off. Only a mount running into it does anything (mounts.js sets 'ram').
  if (d.ramOnly && hitSrc !== 'ram') {
    d.chest(_hv);
    spawnText(_hv, 'RAM IT (X)', 'block');
    d.flash = 0.4;
    return false;
  }
  if (d.type === 'shield' && !top && src.y < d.pos.y + 1.3) {
    const tx = src.x - d.pos.x, tz = src.z - d.pos.z, l = Math.hypot(tx, tz) || 1;
    if ((tx * Math.sin(d.yaw) + tz * Math.cos(d.yaw)) / l > 0.25) {
      d.chest(_hv); spawnText(_hv, 'BLOCK', 'block'); burst(_hv, 4, 5, 1); addHitstop(0.03); d.flash = 0.4;
      if (src === P.pos) { P.vel.x += tx / l * 5; P.vel.z += tz / l * 5; }
      return false;
    }
  }
  kx *= TUNE.kbMult;
  kz *= TUNE.kbMult;
  up *= TUNE.kbMult;
  dmg = Math.round(dmg * TUNE.dmgMult * (0.9 + Math.random() * 0.2) * (d.soakT > 0 ? SOAK.dmg : 1));
  let label = null;
  if (d.ramOnly) dmg *= RAM_BONUS;
  // An enemy with a weakness: the right sword style cuts deep, anything else is partly shrugged off.
  if (d.weak) {
    if (style.cur && style.cur.id === d.weak) { dmg = Math.round(dmg * WEAK_BONUS); label = 'WEAK'; }
    else dmg = Math.round(dmg * d.tough);
  }
  if (P.dmgMult > 1) { dmg *= P.dmgMult; P.dmgMult = 1; P.smokeT = Math.min(P.smokeT, 0.01); label = 'AMBUSH'; heavy = true; }
  d.vel.x += kx; d.vel.z += kz; if (up > 0) d.vel.y = Math.max(d.vel.y, up);
  const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
  const lx = kx * c - kz * s, lz = kx * s + kz * c;
  d.tvx += clamp(lz, -10, 10) * 1.3; d.tvz -= clamp(lx, -10, 10) * 1.3;
  const targetAir = !d.grounded;
  dealDamage(d, dmg, heavy, stop, label);
  const interrupted = heavy && d.interrupt();
  if (d.hp <= 0) d.ko(kx, kz);
  const ev = { d, dmg, src: hitSrc, ko: d.dead, targetAir, interrupted };
  onStyleHit(ev);    // the sword style's extra effect (burning, shorter cooldowns)
  onHit(ev);         // lets a running trial count it
  return true;
}
// hit everything in a circle around a point
// rad = radius, kb = knockback, falloff 0..1 = how much weaker the hit is at the edge of the circle.
export function hitArea(cx, cy, cz, rad, dmg, kb, up, heavy, stop, top, falloff = 0) {
  strikeMaster(cx, cy, cz, rad);    // a blast that reaches Master Sen counts as hitting him
  for (const d of dummies) {
    if (d.dead) continue;
    const dx = d.pos.x - cx, dz = d.pos.z - cz, dist = Math.hypot(dx, dz), dy = d.pos.y - cy;
    if (dist < rad && dy > -2.2 && dy < 3) {
      const l = dist || 1;
      hitDummy(d, dmg * (1 - falloff * dist / rad), dx / l * kb, dz / l * kb, up, heavy, stop, P.pos, top);
    }
  }
}

// Add a dummy while the game is running (the training hall does this for each trial). Same arguments as new Dummy.
export function spawnDummy(type, x, y, z, options) {
  const d = new Dummy(type, x, y, z, options);
  d.maxHp = d.baseHp * TUNE.dummyHpMult;
  d.hp = d.maxHp;
  dummies.push(d);
  d.update(0);    // place its model, health bar and shadow straight away
  return d;
}
// Remove a dummy added with spawnDummy.
export function removeDummy(d) {
  const i = dummies.indexOf(d);
  if (i >= 0) dummies.splice(i, 1);
  d.dispose();
}
