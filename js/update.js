// update.js: one step of the game. Read input, start actions, run the player's current state, then move everything.
// Order inside update(): timers > Master Sen and dialog > read keys > start actions > the big switch on P.state >
// basic attack > integrate (movement and collision) > dummies, projectiles, challenge.
// The switch has one case per state, grouped by class. (These move into the class files in the skill-states phase.)

import { V3, TAU, clamp, lerp, damp, angDamp, _a, _b, _c, _d, _fx } from './util.js';
import { spawnArc, spawnRing, burst, spawnGhost, centerMsg } from './fx.js';
import { T, P, CL, dlg, chal, TUNE, addT, tickCombo, resetDamage } from './state.js';
import { dummies, hitDummy } from './dummies.js';
import { updateProjs } from './projectiles.js';
import { playerMat, player, diveMark, FLIP_T, LOCKED, integrate, setState, startAttack, attackHits, attackVfx, startDash, startSlide, doRewind, groundImpact } from './player.js';
import { camPitch, camFwdH, camRight, facing, camFacingYaw } from './camera.js';
import { removeClone, throwKunai } from './classes/ninja.js';
import { mkPalmRelease } from './classes/monk.js';
import { diveTarget } from './classes/lancer.js';
import { master, openDlg, closeDlg } from './master.js';
import { endChallenge, updateChallenge } from './challenges.js';
import { keys, pressed, mouseL, mouseR } from './input.js';

// This frame's input. inDir = the direction the movement keys point, in the world. hasIn = a movement key is held.
// inX, inZ = raw -1..1. hsp = horizontal speed. inputOn = false during a dialog or countdown.
export const inDir = new V3();
export let hasIn = false, inX = 0, inZ = 0, hsp = 0, inputOn = true;

// ================= update =================
export function update(dt) {
  addT(dt); P.st += dt;
  // Cooldowns tick faster or slower with TUNE.cdMult; at 0 they clear at once.
  const cdStep = TUNE.cdMult > 0 ? dt / TUNE.cdMult : Infinity;
  for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - cdStep);
  if (P.dashCharges < TUNE.dashCharges) { P.dashRecharge -= dt; if (P.dashRecharge <= 0) { P.dashCharges++; P.dashRecharge = P.dashCharges < TUNE.dashCharges ? TUNE.dashCd : 0; } }
  P.iframes = Math.max(0, P.iframes - dt); P.wallrunCd = Math.max(0, P.wallrunCd - dt);
  P.hurtT += dt; if (P.hurtT > 3 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + TUNE.hpRegen * dt);
  if (P.smokeT > 0) { P.smokeT -= dt; if (P.smokeT <= 0) P.dmgMult = 1; }
  if (P.clone) { P.clone.life -= dt; if (P.clone.life <= 0) { burst(_fx.copy(P.clone.pos).setY(P.clone.pos.y + 1), 8, 4, 1); removeClone(); P.cd.q = CL.skills.q.cd; } }

  // master / dialog
  const mdx = P.pos.x - master.pos.x, mdz = P.pos.z - master.pos.z;
  master.near = Math.hypot(mdx, mdz) < 4.2 && Math.abs(P.pos.y - master.pos.y) < 2 && !chal.cur;
  if (dlg.open) {
    for (let i = 0; i < dlg.opts.length; i++) if (pressed.has('Digit' + (i + 1)) || pressed.has('Numpad' + (i + 1))) { dlg.opts[i].act(); break; }
    if (dlg.open && (pressed.has('KeyG') || pressed.has('Backspace') || !master.near)) closeDlg();
  } else if (master.near && pressed.has('KeyG')) openDlg();
  if (chal.cur && pressed.has('KeyP')) { endChallenge(); centerMsg('Challenge ended', 1.2); }

  inputOn = !dlg.open && chal.phase !== 'count';
  camFwdH(_a); camRight(_b);
  inX = inputOn ? (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) : 0;
  inZ = inputOn ? (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) : 0;
  inDir.set(0, 0, 0).addScaledVector(_a, inZ).addScaledVector(_b, inX);
  hasIn = inDir.lengthSq() > 0; if (hasIn) inDir.normalize();
  if (inputOn && pressed.has('Space')) P.jumpBuf = 0.13; else P.jumpBuf -= dt;
  P.coyote -= dt; P.wallT -= dt; P.flip = Math.max(0, P.flip - dt);
  hsp = Math.hypot(P.vel.x, P.vel.z);
  const rmb = inputOn && mouseR, lmb = inputOn && mouseL;

  if (inputOn && pressed.has('KeyT') && !chal.cur) { for (const d of dummies) d.respawn(); resetDamage(); }

  // ----- actions -----
  if (inputOn && !LOCKED.has(P.state)) {
    const S = CL.skills;
    if ((pressed.has('ShiftLeft') || pressed.has('ShiftRight')) && P.dashCharges > 0) startDash();
    if (pressed.has('KeyQ') && P.cd.q <= 0) S.q.fn();
    if (pressed.has('KeyE') && P.cd.e <= 0) S.e.fn();
    if (pressed.has('KeyR') && P.cd.r <= 0 && P.state !== 'charge') S.r.fn();
    if (pressed.has('KeyF') && P.cd.f <= 0) S.f.fn();
    if (pressed.has('M2') && P.cd.m2 <= 0 && S.m2.fn) S.m2.fn();
    if (pressed.has('KeyX') && P.cd.x <= 0 && P.history.length > 4) doRewind();
    if (pressed.has('M0') && P.state !== 'cyclone' && P.state !== 'kicks' && P.state !== 'sweep' && P.state !== 'pcharge' && P.state !== 'dragonKick') {
      if (P.state === 'charge') setState('normal');
      if (P.atk.on) { if (P.atk.t > 0.06) P.atk.queued = true; } else startAttack();
    }
    if ((pressed.has('KeyC') || (keys.has('KeyC') && P.justLanded)) && P.state === 'normal' && P.grounded) startSlide();
  }
  P.justLanded = false;
  // ninja: hold LMB to throw kunai
  if (CL.id === 'ninja' && lmb && (P.state === 'normal' || P.state === 'wallrun')) {
    P.lmbHeld += dt;
    if (P.lmbHeld > 0.32) { P.kunaiT -= dt; if (P.kunaiT <= 0) { P.kunaiT = 0.13; P.atk.on = false; P.atk.queued = false; throwKunai(); } }
  } else { P.lmbHeld = 0; P.kunaiT = 0; }
  P.blocking = CL.id === 'monk' && rmb && P.state === 'normal';

  // ----- states -----
  switch (P.state) {
    case 'normal': {
      let hx = P.vel.x, hz = P.vel.z; const spd = hsp;
      const run = P.run * TUNE.runMult * (P.smokeT > 0 ? 1.35 : 1) * (P.blocking ? 0.35 : 1);
      if (P.grounded) {
        if (spd > run + 0.3 && !P.atk.on) {
          const m = damp(spd, run, hasIn ? 2.2 : 6, dt);
          if (hasIn) { const k = 1 - Math.exp(-8 * dt); hx = lerp(hx, inDir.x * m, k); hz = lerp(hz, inDir.z * m, k); }
          else { hx *= m / spd; hz *= m / spd; }
        } else {
          const tgt = run * (P.atk.on ? 0.25 : 1), k = 1 - Math.exp(-14 * dt);
          hx = lerp(hx, inDir.x * tgt, k); hz = lerp(hz, inDir.z * tgt, k);
        }
      } else if (hasIn) {
        const m = Math.max(run, spd), k = 1 - Math.exp(-(spd > run ? 2.2 : 5) * dt);
        hx = lerp(hx, inDir.x * m, k); hz = lerp(hz, inDir.z * m, k);
      }
      P.vel.x = hx; P.vel.z = hz;
      let g = TUNE.gravity * (P.vel.y < 0 ? 1.35 : 1);
      if (P.atk.on && !P.grounded) { g *= 0.25; if (P.vel.y < -2) P.vel.y = -2; }
      if (P.wallT > 0 && !P.grounded && P.vel.y < -5) P.vel.y = -5;
      if (P.floatT > 0) { P.floatT -= dt; g = 0; P.vel.y = damp(P.vel.y, 0, 4, dt); if (P.grounded) P.floatT = 0; }
      P.grav = g;
      if (P.jumpBuf > 0) {
        let jumped = true;
        if (P.grounded || P.coyote > 0) { P.vel.y = TUNE.jump; }
        else if (P.wallT > 0) {
          P.vel.x = P.wallN.x * 11 + (hasIn ? inDir.x * 3 : 0); P.vel.z = P.wallN.z * 11 + (hasIn ? inDir.z * 3 : 0); P.vel.y = 13.5;
          P.yaw = P.yawT = Math.atan2(P.vel.x, P.vel.z); P.flip = FLIP_T; P.wallT = 0;
          spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.9).addScaledVector(P.wallN, -0.3), 0.2, 1, 0.2);
        } else if (P.airJumps > 0) {
          P.airJumps--; P.vel.y = TUNE.airJump; P.floatT = 0;
          if (hasIn) { const s = Math.max(run, hsp); P.vel.x = inDir.x * s; P.vel.z = inDir.z * s; }
          P.flip = FLIP_T; spawnRing(_fx.copy(P.pos), 0.2, 1.4, 0.25, CL.color);
        } else jumped = false;
        if (jumped) { P.jumpBuf = 0; P.coyote = 0; P.grounded = false; }
      }
      if (CL.id === 'ninja' && rmb && !P.grounded && P.wallT > 0 && P.wallrunCd <= 0 && P.state === 'normal') { setState('wallrun'); P.airJumps = P.airJumpsMax; P.atk.on = false; }
      break;
    }
    case 'dash': {
      P.vel.copy(P.dashDir).multiplyScalar(TUNE.dashSpeed); P.grav = 0;
      P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = 0.028; spawnGhost(player, CL.color); }
      if (P.jumpBuf > 0 && (P.grounded || P.coyote > 0 || P.airJumps > 0)) {
        if (!(P.grounded || P.coyote > 0)) P.airJumps--;
        setState('normal'); P.vel.copy(P.dashDir).multiplyScalar(19);
        P.vel.y = TUNE.jump; P.jumpBuf = 0; P.coyote = 0; P.flip = FLIP_T;
      } else if (P.st >= TUNE.dashTime) {
        setState('normal'); P.vel.copy(P.dashDir).multiplyScalar(15); if (P.vel.y > 0) P.vel.y *= 0.55;
      }
      break;
    }
    case 'slide': {
      P.grav = TUNE.gravity;
      const s = hsp * Math.exp(-0.9 * dt);
      _c.set(P.vel.x, 0, P.vel.z).normalize();
      if (hasIn) _c.lerp(inDir, 1 - Math.exp(-2.5 * dt)).normalize();
      P.vel.x = _c.x * s; P.vel.z = _c.z * s; P.yawT = Math.atan2(_c.x, _c.z);
      P.ghostT -= dt; if (P.ghostT <= 0 && s > 12) { P.ghostT = 0.06; spawnGhost(player, CL.color, null, 0.18); }
      if (P.jumpBuf > 0 && (P.grounded || P.coyote > 0)) {
        const m = Math.min(s * 1.1, 26); P.vel.x = _c.x * m; P.vel.z = _c.z * m; P.vel.y = TUNE.jump;
        P.jumpBuf = 0; P.coyote = 0; setState('normal');
      } else if ((!keys.has('KeyC') && P.st > 0.25) || P.st > 1.1 || s < 3.5 || (!P.grounded && P.coyote <= 0)) setState('normal');
      break;
    }
    // ----- blademaster -----
    case 'grapple': {
      if (P.gTarget) { if (P.gTarget.dead) { setState('normal'); break; } P.gTarget.chest(P.gPoint); }
      _c.copy(P.gPoint).sub(_d.copy(P.pos).setY(P.pos.y + 1));
      const dist = _c.length(); _c.divideScalar(dist || 1);
      P.vel.addScaledVector(_c, 85 * dt).multiplyScalar(Math.exp(-1.0 * dt));
      if (P.vel.length() > 40) P.vel.setLength(40);
      P.grav = TUNE.gravity * 0.3; P.yawT = Math.atan2(_c.x, _c.z);
      if (P.jumpBuf > 0) { setState('normal'); P.vel.y = Math.max(P.vel.y, 0) + 9; P.jumpBuf = 0; P.flip = FLIP_T; }
      else if (dist < (P.gTarget ? 2.4 : 1.6)) { const t = P.gTarget; setState('normal'); if (t) P.vel.multiplyScalar(0.25); P.vel.y = Math.max(P.vel.y, 6); }
      else if (!rmb || P.st > 2.5) setState('normal');
      break;
    }
    case 'cyclone': {
      P.vel.set(P.skDir.x * 22, 0, P.skDir.z * 22); P.grav = 0; P.spin += dt * 30;
      P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = 0.04; spawnGhost(player, CL.color, null, 0.2); }
      P.tick -= dt;
      if (P.tick <= 0) {
        P.tick = 0.075;
        spawnRing(_fx.copy(P.pos).setY(P.pos.y + 1.1), 1.2, 2.8, 0.15, CL.color);
        for (const d of dummies) {
          if (d.dead) continue;
          const dx = d.pos.x - P.pos.x, dz = d.pos.z - P.pos.z, dy = d.pos.y - P.pos.y;
          if (dx * dx + dz * dz < 2.9 * 2.9 && dy > -1.8 && dy < 2.2) hitDummy(d, 8, P.skDir.x * 2.5, P.skDir.z * 2.5, d.grounded ? 0 : 4, false, 0.015);
        }
      }
      if (P.st > 0.45) { setState('normal'); P.vel.set(P.skDir.x * 12, 0, P.skDir.z * 12); }
      break;
    }
    case 'slamUp': {
      P.grav = TUNE.gravity; P.vel.x *= Math.exp(-6 * dt); P.vel.z *= Math.exp(-6 * dt);
      if (P.st > 0.24) setState('slamDown');
      break;
    }
    case 'slamDown': {
      if (P.grounded && P.st > 0) { groundImpact(7.5, 55, CL.color); break; }
      camFwdH(_c); P.vel.set(_c.x * 8, -50, _c.z * 8); P.grav = 0;
      P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = 0.03; spawnGhost(player, CL.color, null, 0.22); }
      break;
    }
    case 'rising': {
      P.grav = TUNE.gravity * 0.9; P.vel.x *= Math.exp(-3 * dt); P.vel.z *= Math.exp(-3 * dt);
      if (P.st > 0.32) setState('normal');
      break;
    }
    case 'blinkStrike': {
      P.vel.set(0, 0, 0); P.grav = 0;
      if (P.st > 0.2) setState('normal');
      break;
    }
    // ----- ninja -----
    case 'wallrun': {
      const n = P.wallN, climb = camPitch > 0.5;
      _c.set(-n.z, 0, n.x); camFwdH(_d); if (_c.dot(_d) < 0) _c.negate();
      if (climb) { P.vel.set(-n.x * 3, 10.5, -n.z * 3); P.yawT = Math.atan2(-n.x, -n.z); }
      else { P.vel.set(_c.x * 14 - n.x * 3, lerp(3.5, -2, clamp(P.st / 1.6, 0, 1)), _c.z * 14 - n.z * 3); P.yawT = Math.atan2(_c.x, _c.z); }
      P.grav = 0; P.runPhase += dt * 18;
      if (P.jumpBuf > 0) {
        const t = climb ? 0 : 9;
        setState('normal'); P.vel.set(n.x * 10 + _c.x * t, 13.5, n.z * 10 + _c.z * t);
        P.yaw = P.yawT = Math.atan2(P.vel.x, P.vel.z); P.flip = FLIP_T; P.jumpBuf = 0; P.wallT = 0;
      } else if (!rmb || P.wallT <= 0 || (P.grounded && P.st > 0.1) || P.st > (climb ? 0.95 : 1.7)) setState('normal');
      break;
    }
    // ----- monk -----
    case 'dragonKick': {
      P.vel.copy(P.skDir).multiplyScalar(32); P.grav = 0;
      P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = 0.03; spawnGhost(player, CL.color, null, 0.22); }
      for (const d of dummies) {
        if (d.dead || P.skHit.has(d)) continue;
        if (d.chest(_a).distanceTo(_b.copy(P.pos).setY(P.pos.y + 1)) < 2.1) { P.skHit.add(d); hitDummy(d, 22, P.skDir.x * 12, P.skDir.z * 12, 5, true, 0.05); }
      }
      if (P.st > 0.35) { setState('normal'); P.vel.copy(P.skDir).multiplyScalar(12); }
      break;
    }
    case 'charge': {
      P.chargeK = clamp(P.st / 1.2, 0, 1); P.grav = TUNE.gravity;
      const k = 1 - Math.exp(-12 * dt);
      P.vel.x = lerp(P.vel.x, inDir.x * 3, k); P.vel.z = lerp(P.vel.z, inDir.z * 3, k);
      P.yawT = camFacingYaw();
      playerMat.emissive.setRGB(P.chargeK * 1.0, P.chargeK * 0.5, 0);
      if (Math.random() < P.chargeK * 0.5) burst(_fx.copy(P.pos).setY(P.pos.y + 1), 1, 3);
      if (!keys.has('KeyR') || P.st > 1.6) mkPalmRelease();
      break;
    }
    case 'palm': {
      P.grav = TUNE.gravity; P.vel.x *= Math.exp(-8 * dt); P.vel.z *= Math.exp(-8 * dt);
      if (P.st > 0.25) setState('normal');
      break;
    }
    case 'kicks': {
      P.vel.x *= Math.exp(-10 * dt); P.vel.z *= Math.exp(-10 * dt); P.vel.y = 0; P.grav = 0;
      P.yaw = P.yawT = camFacingYaw();
      P.tick -= dt;
      if (P.tick <= 0) {
        P.tick = 0.06; facing(_a);
        const fx = _a.x, fz = _a.z, cx = P.pos.x + fx * 1.2, cz = P.pos.z + fz * 1.2;
        spawnArc(Math.random() < 0.5 ? 0 : 1, _b.set(cx, P.pos.y + 0.9 + Math.random() * 0.6, cz), P.yaw, CL.color, 0.4);
        for (const d of dummies) {
          if (d.dead) continue;
          const dx = d.pos.x - cx, dz = d.pos.z - cz, dy = d.pos.y - P.pos.y;
          if (dx * dx + dz * dz < 2.0 * 2.0 && dy > -1.8 && dy < 2.2) hitDummy(d, 4, fx * 0.4, fz * 0.4, d.grounded ? 0 : 2.5, false, 0.01);
        }
      }
      if (P.st > 1.0) setState('normal');
      break;
    }
    // ----- lancer -----
    case 'vault': {
      P.grav = TUNE.gravity;
      if (P.st > 0.3) { setState('normal'); P.flip = FLIP_T; }
      break;
    }
    case 'pcharge': {
      P.vel.x = P.skDir.x * 26; P.vel.z = P.skDir.z * 26; P.grav = TUNE.gravity;
      P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = 0.04; spawnGhost(player, CL.color, null, 0.2); }
      const cx = P.pos.x + P.skDir.x * 1.3, cz = P.pos.z + P.skDir.z * 1.3;
      for (const d of dummies) {
        if (d.dead || d.pinned) continue;
        const dx = d.pos.x - cx, dz = d.pos.z - cz, dy = d.pos.y - P.pos.y;
        if (dx * dx + dz * dz < 1.9 * 1.9 && dy > -1.8 && dy < 2.2 && hitDummy(d, 12, 0, 0, 0, false, 0.03, P.pos, true) && !d.dead) { d.pinned = true; P.dragged.push(d); }
      }
      P.dragged.forEach((d, i) => {
        if (d.dead) { d.pinned = false; return; }
        const side = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5;
        d.pos.set(P.pos.x + P.skDir.x * 1.5 - P.skDir.z * side, P.pos.y + 0.1, P.pos.z + P.skDir.z * 1.5 + P.skDir.x * side);
        d.vel.set(0, 0, 0); d.sinceHit = 0;
      });
      if (P.st >= 0.5) { setState('normal'); P.vel.x = P.skDir.x * 8; P.vel.z = P.skDir.z * 8; }
      break;
    }
    case 'dragoonUp': {
      P.grav = TUNE.gravity; diveTarget(P.dTarget);
      diveMark.visible = true; diveMark.position.set(P.dTarget.x, P.dTarget.y + 0.06, P.dTarget.z); diveMark.scale.setScalar(2 + Math.sin(T * 12) * 0.2);
      if (P.st > 0.45 && P.vel.y < 8) setState('dragoonDown');
      break;
    }
    case 'dragoonDown': {
      _c.copy(P.dTarget).sub(P.pos); const dist = _c.length();
      if ((P.grounded && P.st > 0.03) || dist < 1.0 || P.st > 1.3) { diveMark.visible = false; groundImpact(5.5, 48, CL.color); break; }
      _c.divideScalar(dist); P.vel.copy(_c).multiplyScalar(50); P.grav = 0; P.yawT = Math.atan2(_c.x, _c.z);
      P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = 0.03; spawnGhost(player, CL.color, null, 0.22); }
      break;
    }
    case 'sweep': {
      P.grav = TUNE.gravity * 0.6; P.vel.x *= Math.exp(-5 * dt); P.vel.z *= Math.exp(-5 * dt);
      P.spin = (P.st / 0.32) * TAU;
      if (P.st > 0.32) setState('normal');
      break;
    }
  }

  // ----- attack -----
  const a = P.atk;
  if (a.on) {
    a.t += dt; const A = CL.atk[a.combo];
    if (!a.vfx && a.t >= A.a0) { a.vfx = true; attackVfx(); }
    if (a.t >= A.a0 && a.t <= A.a1) attackHits();
    if (a.t >= A.dur) { a.on = false; a.lastEnd = T; a.lastCombo = a.combo; if (a.queued && inputOn) startAttack(); }
  }

  // facing
  if (P.state === 'normal' && !a.on && hasIn && !P.blocking) P.yawT = Math.atan2(inDir.x, inDir.z);
  if (P.blocking) P.yawT = camFacingYaw();
  P.yaw = angDamp(P.yaw, P.yawT, 14, dt);

  integrate(dt);

  P.histT -= dt;
  if (P.histT <= 0) { P.histT = 0.05; P.history.push(P.pos.clone()); if (P.history.length > 40) P.history.shift(); }

  for (const d of dummies) d.update(dt);
  updateProjs(dt);
  tickCombo(dt);
  updateChallenge(dt);

  // master idle
  master.yaw = angDamp(master.yaw, Math.atan2(mdx, mdz), 4, dt);
  master.sm.root.rotation.y = master.yaw;
  master.sm.body.position.y = 0.93 + Math.sin(T * 2) * 0.012 + (dlg.open ? Math.abs(Math.sin(T * 9)) * 0.02 : 0);
  master.mark.position.y = 2.75 + Math.sin(T * 3) * 0.12; master.mark.rotation.y = T * 2; master.mark.visible = !dlg.open && !chal.cur;
}
