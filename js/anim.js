// anim.js: the player's pose each frame. Picks a target pose (tp) from the current state, then blends the real pose towards it.
// Purely visual. Nothing here affects gameplay.

import { TAU, clamp, lerp, damp, easeOut, angDiff, _a, _b } from './util.js';
import { placeShadow } from './world.js';
import { POSE_KEYS, BASE, GUARD, applyPose } from './stickman.js';
import { setBeam, updateTrail } from './fx.js';
import { T, P, CL } from './state.js';
import { playerMat, bladeMat, bladeGlow, player, playerShadow, cloneMat, cloneSm, FLIP_T, pose, tp, ropeMesh, hookMesh } from './player.js';
import { camPitch } from './camera.js';
import { slashColor, reach as styleReach } from './styles.js';

// ================= player animation =================
// How the body moves between poses. Every joint is on a SPRING: it is pulled towards its target, picks up speed,
// swings a little past and settles. That overshoot is what gives follow-through and makes the motion flow, where a
// plain "slide towards the target" always looks like it is braking. poseVel holds each joint's current speed.
//   stiffness = how hard a joint is pulled (higher = snappier).   bounce = 1 means no overshoot at all, lower = more.
const poseVel = {};
for (const k of POSE_KEYS) poseVel[k] = 0;
const SPRING_ACTION = { stiffness: 900, bounce: 0.62 };    // attacks and skills: fast, with a visible follow-through
const SPRING_CALM = { stiffness: 210, bounce: 0.78 };      // standing, running, landing: softer
// Remembered from the last frame, to notice landings, take-offs, turning and speeding up.
let wasGrounded = true, lastYaw = 0, lastSpeed = 0, turnLean = 0, speedLean = 0;
// The wrist angle that makes the blade point in a given direction whatever the arm is doing.
// aim = 0 points it straight ahead, negative tilts the tip up, around 2.8 points it back behind the player.
const bladeAim = (pose, aim) => aim - (pose.shRX + pose.elR);
// The painted slash is a ribbon stretched between the places the blade has just been, so it always follows the
// weapon's real path. These are its two edges, measured along the blade from the hand: it starts partway up the
// blade and carries on past the tip, like a wave thrown off the edge. Fists have none.
const WEAPON_REACH = { sword: [0.35, 2.3], daggers: [0.1, 1.25], spear: [1.3, 2.9] };
// The blade has to be moving at least this fast (units per second) to leave a slash. Stops a ribbon being drawn
// while the sword is just being held, and makes the slash end exactly when the swing does.
const SLASH_SPEED = 5;
// How long a swing spends drawing the weapon back before the cut starts (seconds). It ends just before the attack
// can first hit, so the visible cut and the damage happen together. The slash is not drawn during it, otherwise
// the ribbon would trace the sword going back up as well as coming down.
const coilTime = A => Math.max(0.03, A.a0 - 0.02);
const lastTip = _b.clone();
let bladeFast = false;
// States in which the weapon is swinging even though no basic attack is running.
const TRAIL_STATES = new Set(['cyclone', 'rising', 'slamDown', 'blinkStrike', 'sweep', 'pcharge', 'dragoonDown']);
export function animatePlayer(dt) {
  Object.assign(tp, BASE);
  const hs = Math.hypot(P.vel.x, P.vel.z);
  let xp = 0, xs = 0;
  const st = P.state, id = CL.id;
  // class idle stance
  if (id === 'ninja') Object.assign(tp, { shLX: -0.2, shLZ: 0.35, elL: -0.9, wristL: 0.4, shRX: -0.2, shRZ: -0.35, elR: -0.9, wrist: 0.4, spineX: 0.18, bodyY: 0.88, kneeL: 0.3, kneeR: 0.3, hipLX: -0.2, hipRX: -0.1 });
  else if (id === 'monk') Object.assign(tp, GUARD, { hipLX: -0.25, hipRX: 0.15, kneeL: 0.25, kneeR: 0.25 });
  else if (id === 'blade') {
    // Ready stance (chudan, the basic middle guard of Japanese swordsmanship): both hands on the hilt in front of
    // the body, tip pointing at the opponent's eyes, right foot forward, left foot back, knees soft.
    Object.assign(tp, { bodyY: 0.87, spineX: 0.1, spineY: -0.22,
      hipRX: -0.32, kneeR: 0.38, hipLX: 0.3, kneeL: 0.42, hipLZ: 0.1, hipRZ: -0.1,
      shRX: -0.78, shRZ: 0.14, elR: -0.95, shLX: -0.7, shLZ: -0.2, elL: -1.05 });
    tp.wrist = bladeAim(tp, -0.3);
  }
  let spearUp = id === 'lancer';

  const runCycle = (speed, amp) => {
    P.runPhase += speed * dt * 1.25;
    const s = Math.sin(P.runPhase), c = Math.cos(P.runPhase);
    tp.hipLX = -s * 0.9 * amp; tp.hipRX = s * 0.9 * amp;
    tp.kneeL = 0.2 + Math.max(0, -s) * 1.4 * amp; tp.kneeR = 0.2 + Math.max(0, s) * 1.4 * amp;
    tp.hipLZ = 0.05; tp.hipRZ = -0.05;
    tp.spineX = 0.15 + 0.2 * amp; tp.bodyY = 0.9 + Math.abs(c) * 0.07;
    tp.spineY = -s * 0.16 * amp;      // shoulders turn against the hips with every step
    tp.bodyRoll = s * 0.045 * amp;    // and the weight rocks from foot to foot
    return s;
  };

  if (st === 'slide') {
    Object.assign(tp, { bodyY: 0.45, bodyPitch: -0.65, spineX: 0.45, hipLX: -1.0, kneeL: 0.1, hipLZ: 0.1, hipRX: -0.1, kneeR: 1.9,
      shLX: 0.5, shLZ: 0.9, elL: 0, shRX: -0.5, shRZ: -0.4, elR: -0.4, wrist: 0.8 }); spearUp = false;
  } else if (st === 'dash') {
    Object.assign(tp, { bodyPitch: clamp(1.15 * (1 - P.dashDir.y * 1.3), 0.1, 1.6), spineX: 0.1, hipLX: 0.3, kneeL: 0.5, hipRX: 0.05, kneeR: 0.2,
      shLX: 1.3, shLZ: 0.25, elL: 0, shRX: 1.2, shRZ: -0.25, elR: 0, wrist: 1.5, wristL: 1.5 }); spearUp = false;
  } else if (st === 'grapple') {
    Object.assign(tp, { bodyPitch: 0.35, shLX: -2.5, shLZ: 0.1, elL: 0, shRX: 0.6, shRZ: -0.4, elR: -0.3, wrist: 1.2, hipLX: -0.6, kneeL: 1.0, hipRX: 0.3, kneeR: 0.5 });
  } else if (st === 'cyclone' || st === 'sweep') {
    Object.assign(tp, { bodyPitch: 0.25, shLX: 0, shLZ: 1.4, elL: 0, shRX: 0, shRZ: -1.4, elR: 0, wrist: 1.5, hipLX: -0.5, kneeL: 1.1, hipRX: 0.2, kneeR: 0.7 });
    xs = P.spin; spearUp = false;
  } else if (st === 'slamUp') {
    Object.assign(tp, { hipLX: -1.5, kneeL: 2.0, hipRX: -1.5, kneeR: 2.0, shLX: -2.9, elL: 0, shRX: -2.9, shRZ: 0, elR: 0, wrist: 1.4, spineX: -0.2 });
    xp = -(P.st / 0.24) * TAU;
  } else if (st === 'slamDown') {
    Object.assign(tp, { bodyPitch: 0.35, hipLX: -0.3, kneeL: 0.3, hipRX: 0.3, kneeR: 0.3, shLX: -2.6, shLZ: 0.2, elL: 0, shRX: -2.6, shRZ: 0, elR: 0, wrist: 1.4, spineX: 0.3 });
  } else if (st === 'rising') {
    Object.assign(tp, { shRX: -2.9, shRZ: -0.2, elR: 0, wrist: 1.45, spineX: -0.3, hipLX: -1.1, kneeL: 1.5, hipRX: 0.3, kneeR: 0.3, shLZ: 0.9, shLX: 0.3 });
    xs = clamp(P.st / 0.3, 0, 1) * TAU;
  } else if (st === 'wallrun') {
    const s = Math.sin(P.runPhase);
    tp.hipLX = -s * 0.9; tp.hipRX = s * 0.9; tp.kneeL = 0.2 + Math.max(0, -s) * 1.4; tp.kneeR = 0.2 + Math.max(0, s) * 1.4;
    tp.shLX = s * 0.8; tp.shRX = -s * 0.8;
    if (camPitch > 0.5) tp.bodyPitch = -0.5;
    else { const rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw); tp.bodyRoll = -(P.wallN.x * rx + P.wallN.z * rz) * 0.55; tp.spineX = 0.3; }
  } else if (st === 'grabbed') {
    // held off the ground by the throat: hands up at the neck, legs kicking
    const kick = Math.sin(T * 16);
    Object.assign(tp, { spineX: -0.28, shLX: -2.3, shLZ: -0.25, elL: -1.9, shRX: -2.3, shRZ: 0.25, elR: -1.9,
      hipLX: -0.3 + kick * 0.4, kneeL: 0.55 - kick * 0.3, hipRX: -0.1 - kick * 0.4, kneeR: 0.55 + kick * 0.3 });
    if (P.thrown) xp = T * 13;    // thrown: tumbling end over end through the air
  } else if (st === 'ignite') {
    // standing in the fire: head back, chest out, arms flung wide
    Object.assign(tp, { spineX: -0.32, shLX: -0.2, shLZ: 1.15, elL: -0.25, shRX: -0.2, shRZ: -1.15, elR: -0.25, hipLZ: 0.2, hipRZ: -0.2, bodyY: 0.96 });
    tp.wrist = bladeAim(tp, 1.2);
  } else if (st === 'submerge') {
    // dropping under the water: knees tucked, arms up
    Object.assign(tp, { hipLX: -1.2, kneeL: 1.7, hipRX: -1.0, kneeR: 1.6, shLX: -2.4, shLZ: 0.3, elL: -0.3, shRX: -2.4, shRZ: -0.3, elR: -0.3, spineX: 0.25 });
  } else if (st === 'dragonKick') {
    Object.assign(tp, { bodyPitch: -0.9, hipRX: -1.65, kneeR: 0, hipLX: 0.2, kneeL: 1.7, shLX: 0.6, shLZ: 0.6, elL: -0.4, shRX: 0.6, shRZ: -0.6, elR: -0.4, spineX: 0.3 });
  } else if (st === 'charge') {
    Object.assign(tp, { bodyY: 0.78, kneeL: 0.6, kneeR: 0.6, hipLX: -0.5, hipRX: 0.1, spineY: -0.6, shRX: 0.5, shRZ: -0.2, elR: -1.5, shLX: -1.3, shLZ: 0.1, elL: -0.3 });
  } else if (st === 'palm') {
    Object.assign(tp, { bodyY: 0.82, kneeL: 0.5, kneeR: 0.3, hipLX: -0.7, hipRX: 0.4, spineY: 0.6, spineX: 0.25, shRX: -1.55, shRZ: 0, elR: 0, shLX: 0.5, elL: -1.2 });
  } else if (st === 'kicks') {
    const s = Math.sin(P.st * 60);
    Object.assign(tp, { bodyPitch: -0.3, hipRX: -1.45 + s * 0.35, kneeR: 0.15 + (s < 0 ? 0.9 : 0), hipLX: -0.9 - s * 0.5, kneeL: 0.9 + (s > 0 ? 0.6 : 0) });
  } else if (st === 'vault') {
    Object.assign(tp, { hipLX: -1.3, kneeL: 1.6, hipRX: -1.1, kneeR: 1.6, shLX: -0.4, shRX: 0.3, elR: -0.2, wrist: 2.4, spineX: 0.2 }); spearUp = false;
  } else if (st === 'pcharge') {
    runCycle(26, 1.1);
    Object.assign(tp, { bodyPitch: 0.45, shRX: -1.2, shRZ: -0.1, elR: -0.2, wrist: 1.4, shLX: -1.2, shLZ: -0.2, elL: -0.5 }); spearUp = false;
  } else if (st === 'dragoonUp') {
    Object.assign(tp, { hipLX: -1.4, kneeL: 1.9, hipRX: -1.2, kneeR: 1.9, shLX: -2.7, elL: -0.2, shRX: -2.7, shRZ: 0, elR: -0.2, wrist: 2.9 + 1.57, spineX: -0.15 }); spearUp = false;
  } else if (st === 'dragoonDown') {
    Object.assign(tp, { bodyPitch: 0.7, hipLX: 0.2, kneeL: 0.2, hipRX: 0.4, kneeR: 0.5, shLX: -1.3, elL: -0.3, shRX: -1.3, shRZ: 0, elR: -0.3, wrist: 1.6 + 1.2, spineX: 0.2 }); spearUp = false;
  } else if (!P.grounded) {
    // In the air the pose follows the vertical speed: tucked while rising, opening out as the fall begins.
    const rise = clamp(0.5 + P.vel.y / 14, 0, 1);    // 1 = going up fast, 0 = falling fast
    tp.hipLX = lerp(-0.4, -0.95, rise); tp.kneeL = lerp(0.55, 1.35, rise);
    tp.hipRX = lerp(0.3, 0.25, rise); tp.kneeR = lerp(0.45, 0.65, rise);
    tp.shLZ = lerp(1.15, 0.65, rise); tp.shLX = lerp(-0.25, 0, rise);
    tp.shRZ = lerp(-0.9, -0.5, rise); tp.shRX = lerp(-0.3, -0.6, rise);
    tp.spineX = lerp(-0.08, 0.2, rise);
    if (P.flip > 0) {
      Object.assign(tp, { hipLX: -1.6, kneeL: 2.1, hipRX: -1.5, kneeR: 2.1, shLX: -0.8, shRX: -0.8 });
      xp = easeOut(1 - P.flip / FLIP_T) * TAU;
    }
  } else if (hs > 0.6) {
    const amp = clamp(hs / 9.5, 0.3, 1.2), s = runCycle(hs, amp);
    if (hs > 12.5 || id === 'ninja') { tp.shLX = 1.3; tp.shLZ = 0.2; tp.elL = 0; tp.shRX = 1.15; tp.shRZ = -0.2; tp.elR = -0.1; tp.wrist = 1.4; tp.wristL = 1.4; tp.spineX = 0.5; spearUp = false; }
    else if (id === 'blade') {
      // Running with the sword held low and trailing behind on the right, body leaning in, left arm pumping.
      tp.spineX = 0.32 + 0.14 * amp; tp.spineY = 0.25 - s * 0.16 * amp;
      tp.shRX = 0.55 + s * 0.12 * amp; tp.shRZ = -0.32; tp.elR = -0.35;
      tp.wrist = bladeAim(tp, 2.75);
      tp.shLX = s * 0.9 * amp; tp.shLZ = 0.2; tp.elL = -0.9;
    }
    else if (id !== 'monk') { tp.shLX = s * 0.8 * amp; tp.elL = -0.6; tp.shRX = -0.35 - s * 0.5 * amp; }
  } else {
    // Standing still is never frozen: slow breathing through the chest and shoulders, and the weight easing
    // from one foot to the other.
    const breath = Math.sin(T * 1.7), shift = Math.sin(T * 0.75);
    tp.bodyY += breath * 0.012;
    tp.spineX += breath * 0.035;
    tp.shRX += breath * 0.03; tp.shLX += breath * 0.03;
    tp.spineY += shift * 0.05;
    tp.bodyRoll += shift * 0.022;
    tp.wrist += Math.sin(T * 1.7 + 0.8) * 0.05;    // the sword tip drifts with the breath
  }
  if (P.blocking) { Object.assign(tp, { shLX: -1.5, shLZ: -0.35, elL: -1.5, shRX: -1.5, shRZ: 0.35, elR: -1.5, spineX: 0.2, bodyY: 0.86, kneeL: 0.4, kneeR: 0.4 }); }

  // attack overlay
  const a = P.atk;
  if (a.on) {
    const A = CL.atk[a.combo], e = easeOut(clamp(a.t / (A.a1 + 0.03), 0, 1)), last = a.combo === CL.atk.length - 1;
    spearUp = false;
    switch (CL.style) {
      case 'slash':
        // Two-handed cuts. The whole body does the work: the hips and chest turn through the cut (spineY), the
        // stance drops and leans into it, and the swing carries well past the target (the follow-through is what
        // sells the weight, since a game swing has no time for a wind-up). e runs 0..1 through the cut.
        tp.elR = -0.12; tp.elL = -0.5;
        // cut = 0..1 through the swing itself. It waits for the coil first (see coilTime), so the body draws
        // back before it whips through. drift = 0..1 over the time after the cut: the swing keeps easing onwards
        // there, so the pose is never held still.
        const COIL = coilTime(A);
        const cut = easeOut(clamp((a.t - COIL) / (A.a1 + 0.03 - COIL), 0, 1));
        const drift = clamp((a.t - A.a1) / (A.dur - A.a1 + 0.12), 0, 1);
        if (a.combo < 2) {
          const dir = a.combo === 0 ? 1 : -1;    // first cut goes right to left, the second comes back
          tp.spineY = (lerp(-1.5, 1.45, cut) + 0.35 * drift) * dir;
          tp.bodyRoll = lerp(0.22, -0.2, cut) * dir;
          tp.spineX = 0.22 + 0.08 * drift; tp.bodyY = 0.8 - 0.03 * drift;
          tp.shRX = -1.42; tp.shRZ = 0.12; tp.shLX = -1.3; tp.shLZ = -0.3;
          // a deep lunging stance, front knee bent, back leg long
          tp.hipRX = -0.75; tp.kneeR = 0.8; tp.hipLX = 0.6; tp.kneeL = 0.25;
          tp.wrist = bladeAim(tp, -0.08);
        } else {
          // Finisher: from high overhead (jodan) straight down, ending low with the knees deeply bent.
          tp.shRX = lerp(-3.05, -0.55, cut); tp.shLX = lerp(-2.95, -0.5, cut);
          tp.shRZ = 0.1; tp.shLZ = -0.22;
          tp.spineX = lerp(-0.4, 0.8, cut) + 0.1 * drift; tp.spineY = 0.12;
          tp.bodyY = lerp(0.95, 0.7, cut) - 0.04 * drift;
          tp.hipRX = lerp(-0.2, -0.95, cut); tp.kneeR = lerp(0.2, 1.1, cut); tp.hipLX = lerp(0.1, 0.55, cut); tp.kneeL = lerp(0.15, 0.7, cut);
          tp.wrist = bladeAim(tp, lerp(-1.2, 0.35, cut) + 0.2 * drift);
        }
        break;
      case 'dagger':
        if (last) { tp.shRX = tp.shLX = lerp(-2.9, -0.5, e); tp.elR = tp.elL = -0.1; tp.wrist = tp.wristL = 1.45; tp.spineX = lerp(-0.3, 0.6, e); tp.shLZ = 0.1; tp.shRZ = -0.1; }
        else if (a.combo % 2 === 0) { tp.spineY = lerp(-0.9, 0.9, e); tp.shRX = -1.4; tp.shRZ = -0.2; tp.elR = -0.1; tp.wrist = 1.45; tp.shLX = -0.5; tp.elL = -1.2; }
        else { tp.spineY = lerp(0.9, -0.9, e); tp.shLX = -1.4; tp.shLZ = 0.2; tp.elL = -0.1; tp.wristL = 1.45; tp.shRX = -0.5; tp.elR = -1.2; }
        break;
      case 'punch':
        Object.assign(tp, GUARD);
        if (last) { tp.hipRX = lerp(0.2, -1.7, e); tp.kneeR = lerp(1.6, 0, e); tp.spineX = -0.25; tp.bodyPitch = -0.15; }
        else if (a.combo % 2 === 0) { tp.shRX = lerp(-0.7, -1.6, e); tp.elR = lerp(-2.0, 0, e); tp.spineY = lerp(-0.2, 0.55, e); }
        else { tp.shLX = lerp(-0.9, -1.6, e); tp.elL = lerp(-2.0, 0, e); tp.spineY = lerp(0.2, -0.55, e); }
        break;
      case 'thrust':
        tp.shRX = lerp(-0.9, -1.5, e); tp.shRZ = -0.1; tp.elR = lerp(-1.4, 0, e); tp.wrist = -(tp.shRX + tp.elR);
        tp.shLX = -1.2; tp.shLZ = -0.1; tp.elL = -0.6; tp.spineX = lerp(0, 0.35, e); if (last) tp.spineY = lerp(-0.6, 0.3, e);
        break;
    }
  }
  if (spearUp) tp.wrist = -1.57 - (tp.shRX + tp.elR);   // lancer carries the spear upright

  // ----- weight: lean into turns and into speeding up, dip on landing, stretch on take-off -----
  if (dt > 0.004) {    // skipped during hitstop, when dt is almost nothing and these rates would be meaningless
    const turnRate = angDiff(lastYaw, P.yaw) / dt;    // radians per second, positive = turning left
    const pickup = (hs - lastSpeed) / dt;             // change of running speed, per second
    turnLean = damp(turnLean, clamp(-turnRate * 0.035, -0.28, 0.28), 9, dt);
    speedLean = damp(speedLean, clamp(pickup * 0.004, -0.14, 0.2), 9, dt);
    if (P.grounded && !wasGrounded) {
      // landing: the body sinks into the knees and springs back up
      poseVel.bodyY -= 2.4;
      poseVel.kneeL += 7; poseVel.kneeR += 7;
      poseVel.spineX += 2.5;
    } else if (!P.grounded && wasGrounded && P.vel.y > 4) {
      poseVel.bodyY += 1.6;    // take-off: a quick stretch upwards
    }
    lastYaw = P.yaw; lastSpeed = hs; wasGrounded = P.grounded;
  }
  if (P.grounded && st === 'normal') {
    tp.bodyRoll += turnLean;
    tp.bodyPitch += speedLean;
  }

  // ----- move every joint towards its target on its spring -----
  const spring = (a.on || st !== 'normal') ? SPRING_ACTION : SPRING_CALM;
  const pull = spring.stiffness, drag = 2 * Math.sqrt(spring.stiffness) * spring.bounce;
  // Small time slices keep the springs stable when a frame is long.
  const slices = Math.max(1, Math.ceil(dt * 120)), h = dt / slices;
  for (let n = 0; n < slices; n++) {
    for (const k of POSE_KEYS) {
      poseVel[k] += ((tp[k] - pose[k]) * pull - poseVel[k] * drag) * h;
      pose[k] += poseVel[k] * h;
    }
  }
  player.root.position.copy(P.pos);
  player.root.position.y -= P.sink;    // going under the water of a pool; 0 the rest of the time
  playerShadow.visible = P.sink < 0.3;
  player.root.rotation.y = P.yaw;
  applyPose(player, pose, xp, xs);
  player.root.updateMatrixWorld(true);
  placeShadow(playerShadow, P.pos.x, P.pos.y, P.pos.z);

  const op = P.smokeT > 0 ? 0.22 : (P.iframes > 0 && Math.sin(T * 60) > 0 ? 0.5 : 1);
  playerMat.opacity = op; bladeMat.opacity = op;
  bladeGlow.material.opacity = op * 0.2;

  // the painted slash: drawn from the blade's own positions (see WEAPON_REACH)
  const reach = WEAPON_REACH[CL.weapon];
  if (reach) {
    player.wrist.localToWorld(_a.set(0, 0, reach[0]));
    player.wrist.localToWorld(_b.set(0, 0, reach[1] * styleReach()));
    if (dt > 0.004) {    // not during hitstop, when dt is almost nothing
      bladeFast = _b.distanceTo(lastTip) / dt > SLASH_SPEED;
      lastTip.copy(_b);
    }
    // Only during an attack or a sword skill, after the coil back, and only while the blade is really moving.
    const attacking = (a.on && a.t >= coilTime(CL.atk[a.combo])) || TRAIL_STATES.has(st);
    updateTrail(dt, attacking && bladeFast && P.smokeT <= 0, _a, _b, slashColor());
  } else updateTrail(dt, false, _a, _b, slashColor());

  if (P.clone) { cloneSm.root.position.copy(P.clone.pos); cloneMat.opacity = 0.45 + Math.sin(T * 8) * 0.2; }
  if (P.state === 'grapple') {
    player.handL.getWorldPosition(_a);
    setBeam(ropeMesh, _a, P.gPoint); hookMesh.position.copy(P.gPoint);
  }
}
