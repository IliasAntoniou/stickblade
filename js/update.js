// update.js: one step of the game. Read input, start actions, run the player's current state, then move everything.
// Order inside update(): timers > Master Sen and dialog > read keys > start actions > the big switch on P.state >
// basic attack > integrate (movement and collision) > dummies, projectiles, challenge, story.
// The switch has one case per state, grouped by class. (These move into the class files in the skill-states phase.)

import { V3, TAU, clamp, lerp, damp, angDamp, _a, _b, _c, _d, _fx } from './util.js';
import { spawnRing, spawnGhost, centerMsg } from './fx.js';
import { T, P, CL, dlg, chal, TUNE, addT, tickCombo, resetDamage, setHitSrc } from './state.js';
import { skillReady } from './progress.js';
import { reach, styleSpeed, updateTake, takeWith } from './styles.js';
import { dummies, hitDummy } from './dummies.js';
import { updateProjs } from './projectiles.js';
import { player, FLIP_T, LOCKED, integrate, setState, startAttack, attackHits, attackVfx, startDash, startSlide, groundImpact } from './player.js';
import { camFwdH, camRight, camFacingYaw, setScope } from './camera.js';
import { mageShot, mageSnipe, updateMage, BARRAGE_GAP } from './classes/mage.js';
import { master, openDlg, closeDlg, updateMaster, updateGrab, strikeMaster } from './master.js';
import { endChallenge, updateChallenge } from './challenges.js';
import { keys, pressed, mouseL, mouseR } from './input.js';
import { updateQuests } from './quests.js';
import { mission, updateMissions, abandonMission, MISSION_REGEN } from './missions.js';
import { toggleMount, updateMounted } from './mounts.js';
import { hasDashForm } from './dashfx.js';
import { power, spinSpeed, spinSteer, spinTick, spinHit, spinPull, slamPower, slamLanded, updateElements, skillStrike } from './elements.js';

// This frame's input. inDir = the direction the movement keys point, in the world. hasIn = a movement key is held.
// inX, inZ = raw -1..1. hsp = horizontal speed. inputOn = false during a dialog or countdown.
export const inDir = new V3();
export let hasIn = false, inX = 0, inZ = 0, hsp = 0, inputOn = true;

// ================= update =================
export function update(dt) {
  addT(dt); P.st += dt;
  setHitSrc('other');
  // Cooldowns tick faster or slower with TUNE.cdMult; at 0 they clear at once.
  const cdStep = TUNE.cdMult > 0 ? dt / TUNE.cdMult : Infinity;
  for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - cdStep);
  if (P.dashCharges < TUNE.dashCharges) { P.dashRecharge -= dt; if (P.dashRecharge <= 0) { P.dashCharges++; P.dashRecharge = P.dashCharges < TUNE.dashCharges ? TUNE.dashCd : 0; } }
  P.iframes = Math.max(0, P.iframes - dt);
  // Health comes back by itself 3 s after the last hit; much more slowly during a mission, so damage adds up there.
  P.hurtT += dt;
  if (P.hurtT > 3 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + TUNE.hpRegen * (mission.cur ? MISSION_REGEN : 1) * dt);

  // master / dialog
  const mdx = P.pos.x - master.pos.x, mdz = P.pos.z - master.pos.z;
  master.near = Math.hypot(mdx, mdz) < 4.2 && Math.abs(P.pos.y - master.pos.y) < 2 && !chal.cur;
  if (dlg.open) {
    for (let i = 0; i < dlg.opts.length; i++) if (pressed.has('Digit' + (i + 1)) || pressed.has('Numpad' + (i + 1))) { dlg.opts[i].act(); break; }
    if (dlg.open && (pressed.has('KeyG') || pressed.has('Backspace') || !master.near)) closeDlg();
  } else if (master.near && pressed.has('KeyG')) openDlg();
  if (chal.cur && pressed.has('KeyP')) { endChallenge(); centerMsg('Challenge ended', 1.2); }
  else if (mission.cur && pressed.has('KeyP')) abandonMission();

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
    // Q, E and R first ask whether they are being used to take a sword style (at a fire, in a storm, in a pool):
    // if so that happens and the skill itself does not (takeWith in styles.js; the Blademaster's skills do it themselves)
    if (pressed.has('KeyQ') && P.cd.q <= 0 && skillReady('q') && !takeWith('q')) S.q.fn();
    if (pressed.has('KeyE') && P.cd.e <= 0 && skillReady('e') && !takeWith('e')) S.e.fn();
    if (pressed.has('KeyR') && P.cd.r <= 0 && skillReady('r') && !takeWith('r')) S.r.fn();
    if (pressed.has('KeyF') && P.cd.f <= 0 && skillReady('f')) S.f.fn();
    if (pressed.has('M2') && P.cd.m2 <= 0 && S.m2.fn && skillReady('m2')) S.m2.fn();
    if (pressed.has('KeyX') && P.cd.x <= 0) toggleMount();    // get on or off the mount (mounts.js)
    if (pressed.has('M0') && P.state !== 'cyclone' && P.state !== 'channel' && P.state !== 'aim') {
      if (P.atk.on) { if (P.atk.t > 0.06) P.atk.queued = true; } else startAttack();
    }
    if ((pressed.has('KeyC') || (keys.has('KeyC') && P.justLanded)) && P.state === 'normal' && P.grounded) startSlide();
  }
  P.justLanded = false;

  // ----- states -----
  switch (P.state) {
    case 'normal': {
      let hx = P.vel.x, hz = P.vel.z; const spd = hsp;
      const run = P.run * TUNE.runMult * styleSpeed();
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
        } else if (P.airJumps > 0 && CL.hover) {
          // the Mage has no second jump: it hangs in the air for a while (the P.floatT lines above hold it up)
          P.airJumps--;
          P.vel.y = Math.max(P.vel.y, 3);
          P.floatT = CL.hover;
          spawnRing(_fx.copy(P.pos), 0.2, 1.8, 0.3, CL.color);
        } else if (P.airJumps > 0) {
          P.airJumps--; P.vel.y = TUNE.airJump; P.floatT = 0;
          if (hasIn) { const s = Math.max(run, hsp); P.vel.x = inDir.x * s; P.vel.z = inDir.z * s; }
          P.flip = FLIP_T; spawnRing(_fx.copy(P.pos), 0.2, 1.4, 0.25, CL.color);
        } else jumped = false;
        if (jumped) { P.jumpBuf = 0; P.coyote = 0; P.grounded = false; }
      }
      break;
    }
    // taking a sword style: under the water of a pool, standing in a fire, or spinning in a storm (the scene is in styles.js)
    case 'submerge':
    case 'ignite':
    case 'storm': {
      updateTake();
      break;
    }
    // riding a mount (mounts.js)
    case 'mounted': {
      updateMounted(dt);
      break;
    }
    // held up by the neck by Master Sen, then slammed (master.js)
    case 'grabbed': {
      updateGrab();
      break;
    }
    case 'dash': {
      P.vel.copy(P.dashDir).multiplyScalar(TUNE.dashSpeed); P.grav = 0;
      // Afterimages, unless a sword style is turning the player into its element for the dash (dashfx.js).
      P.ghostT -= dt;
      if (P.ghostT <= 0 && !hasDashForm()) { P.ghostT = 0.028; spawnGhost(player, CL.color); }
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
      const E = CL.skills.e;    // dmg, rad and dur depend on the skill's rank
      const eRad = E.rad * reach();
      // The sword style changes the spin (elements.js): Thunder is faster and can be steered, Water drags enemies
      // in, Flame leaves fire along the path.
      spinSteer(dt);
      spinPull(dt, eRad);
      const travel = spinSpeed();
      P.vel.set(P.skDir.x * travel, 0, P.skDir.z * travel); P.grav = 0; P.spin += dt * 30;
      P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = 0.04; spawnGhost(player, CL.color, null, 0.2); }
      P.tick -= dt;
      if (P.tick <= 0) {
        P.tick = 0.075;
        spinTick();
        setHitSrc('e');
        strikeMaster(P.pos.x, P.pos.y, P.pos.z, eRad);    // spinning into Master Sen counts as hitting him
        for (const d of dummies) {
          if (d.dead) continue;
          const dx = d.pos.x - P.pos.x, dz = d.pos.z - P.pos.z, dy = d.pos.y - P.pos.y;
          if (dx * dx + dz * dz < eRad * eRad && dy > -1.8 && dy < 2.2) {
            setHitSrc('e');    // again for each enemy: a hit can set off effects that change it
            if (hitDummy(d, E.dmg, P.skDir.x * 2.5, P.skDir.z * 2.5, d.grounded ? 0 : 4, false, 0.015)) spinHit(d);
          }
        }
      }
      if (P.st > E.dur) { setState('normal'); P.vel.set(P.skDir.x * 12, 0, P.skDir.z * 12); }
      break;
    }
    case 'slamUp': {
      P.grav = TUNE.gravity; P.vel.x *= Math.exp(-6 * dt); P.vel.z *= Math.exp(-6 * dt);
      if (P.st > 0.24) setState('slamDown');
      break;
    }
    case 'slamDown': {
      if (P.grounded && P.st > 0) {
        // The sword style changes the blast (elements.js): Thunder stuns, Water is a wide wave that shoves and
        // heals, Flame leaves a burning crater. The style is read first, because landing in a pool changes it.
        const R = CL.skills.r;
        const element = power();
        const blast = slamPower();
        const blastRad = R.rad * blast.rad * reach();
        groundImpact(R.rad * blast.rad, R.dmg, CL.color, Math.max(R.stun, blast.stun), blast.knock);
        slamLanded(element, blastRad);
        break;
      }
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
    // ----- mage -----
    // casting: a moment standing still with the staff out while the spell leaves ('invoke' is the longer one,
    // staff raised, for calling a comet)
    case 'cast':
    case 'invoke': {
      P.grav = TUNE.gravity; P.vel.x *= Math.exp(-10 * dt); P.vel.z *= Math.exp(-10 * dt);
      if (P.st > (P.state === 'invoke' ? 0.35 : 0.22)) setState('normal');
      break;
    }
    // Arcane Snipe: the right mouse button is held. The shot charges and the scope closes in (camera.js); the
    // Mage can only creep. Letting go fires it (mageSnipe); a dash or being hit breaks it off.
    case 'aim': {
      P.grav = TUNE.gravity;
      const ease = 1 - Math.exp(-12 * dt);
      P.vel.x = lerp(P.vel.x, inDir.x * 2.5, ease);
      P.vel.z = lerp(P.vel.z, inDir.z * 2.5, ease);
      P.yaw = P.yawT = camFacingYaw();
      P.aimK = clamp(P.st / CL.skills.m2.charge, 0, 1);
      setScope(P.aimK);
      if (!rmb) mageSnipe();
      break;
    }
    // Arcane Barrage: rooted to the spot, one missile after another until they have all gone (a dash breaks it off)
    case 'channel': {
      P.grav = TUNE.gravity; P.vel.x *= Math.exp(-10 * dt); P.vel.z *= Math.exp(-10 * dt);
      P.yaw = P.yawT = camFacingYaw();
      P.tick -= dt;
      if (P.tick <= 0) {
        P.tick = BARRAGE_GAP;
        if (mageShot()) setState('normal');
      }
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
  if (P.state === 'normal' && !a.on && hasIn) P.yawT = Math.atan2(inDir.x, inDir.z);
  P.yaw = angDamp(P.yaw, P.yawT, 14, dt);

  integrate(dt);

  for (const d of dummies) d.update(dt);
  updateProjs(dt);
  updateMage(dt);
  tickCombo(dt);
  updateElements(dt);
  updateChallenge(dt);
  updateQuests();
  updateMissions(dt);

  // master idle
  updateMaster(dt);
}
