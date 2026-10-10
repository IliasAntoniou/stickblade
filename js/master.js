// master.js: Master Sen. The towering figure next to the start, his menu (change class, go and train, take a
// challenge, get a tip), and what happens to anyone who hits him.
// The menu is a window of cards that can be clicked: opening it frees the mouse, closing it captures it again.
// It can also be driven with the number keys. The window's HTML is in index.html (#dlg) and so is its look.

import * as THREE from 'three';
import { V3, pick, $, save, damp, clamp, angDiff, angDamp, DEBUG, _fx } from './util.js';
import { scene, renderer } from './core.js';
import { boxGeo, lam, makeShadow, placeShadow } from './world.js';
import { SG, makeStickman, BASE, POSE_KEYS, applyPose, addRim, castShadows } from './stickman.js';
import { ringGeo, glowTex, centerMsg, shake, spawnRing, burst, spawnText, flashHurt, addHitstop } from './fx.js';
import { T, P, CL, dlg, chal, CLASSES } from './state.js';
import { LOCKED, setState } from './player.js';
import { CLASS_ORDER, setClass } from './classes/index.js';
import { CH, startChallenge } from './challenges.js';
import { trainingList, styleList, startTrial, ROMAN } from './progress.js';
import { isTuned, resetTuning } from './tuning.js';
import { dojo, enterDojo, leaveDojo } from './dojo.js';

// ================= the figure =================
// His poses. Each lists only the joints that differ from the standing pose.
//   IDLE: arms folded across the chest, feet planted wide, leaning slightly over whoever he is talking to.
//   WARN: one arm thrust out, pointing at the player.
//   GRAB: right arm up and forward, holding the player off the ground by the neck.
//   SLAM: bent over with that arm driven down into the ground.
const POSE_IDLE = { ...BASE, bodyY: 0.93, spineX: 0.12, shLX: -0.85, shLZ: -0.55, elL: -1.85, shRX: -0.7, shRZ: 0.55, elR: -1.95,
  hipLZ: 0.24, hipRZ: -0.24, hipLX: 0, hipRX: 0, kneeL: 0.05, kneeR: 0.05 };
const POSE_WARN = { ...POSE_IDLE, spineX: 0.2, spineY: -0.35, shRX: -1.55, shRZ: 0.05, elR: -0.05, shLX: 0.25, shLZ: 0.5, elL: -1.2 };
const POSE_GRAB = { ...POSE_IDLE, spineX: -0.08, spineY: 0.2, shRX: -2.05, shRZ: 0.3, elR: -0.1, shLX: 0.2, shLZ: 0.45, elL: -0.9 };
const POSE_SLAM = { ...POSE_IDLE, spineX: 0.85, bodyY: 0.74, shRX: -0.75, shRZ: 0.25, elR: -0.05, shLX: 0.5, shLZ: 0.6, elL: -0.6, kneeL: 0.8, kneeR: 0.8, hipLX: -0.6, hipRX: -0.6 };
const SEN_HEIGHT = 1.45;    // how many times the size of the player he is

export const master = (() => {
  // Master Sen is built from the same stick figure as everyone else, then bulked out: a towering, heavily
  // muscled man with wild dark hair and eyes that glow red. He is meant to be intimidating.
  const mat = addRim(new THREE.MeshLambertMaterial({ color: 0x4d362e }));
  const sm = makeStickman(mat, null, false);
  // Widen the rod-thin parts of a limb. group = a shoulder, elbow, hip or knee; width = how many times thicker.
  const bulk = (group, width) => {
    for (const part of group.children) {
      if (part.isMesh) { part.scale.x = width; part.scale.z = width; }
    }
  };
  bulk(sm.shL, 3.6); bulk(sm.shR, 3.6);        // upper arms
  bulk(sm.elL, 3.0); bulk(sm.elR, 3.0);        // forearms
  bulk(sm.hipL, 3.8); bulk(sm.hipR, 3.8);      // thighs
  bulk(sm.kneeL, 3.0); bulk(sm.kneeR, 3.0);    // calves
  bulk(sm.spine, 3.0);                         // the core
  sm.chest.children[0].scale.x = sm.chest.children[0].scale.z = 3.0;    // a thick neck
  // A stick figure's shoulders and hips sit almost on its centre line. Push them out for a broad frame.
  sm.shL.position.x = 0.4; sm.shR.position.x = -0.4;
  sm.hipL.position.x = 0.19; sm.hipR.position.x = -0.19;
  // Slabs of muscle: chest, belly, and a round shoulder over each arm.
  const slab = (parent, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(boxGeo, lam(0x4d362e));
    m.scale.set(w, h, d); m.position.set(x, y, z);
    parent.add(m);
  };
  slab(sm.chest, 0.9, 0.46, 0.44, 0, -0.16, 0.02);
  slab(sm.spine, 0.62, 0.36, 0.36, 0, 0.2, 0.01);
  for (const side of [1, -1]) {
    const shoulder = new THREE.Mesh(SG.joint, mat);
    shoulder.scale.setScalar(3.6);
    shoulder.position.set(0.42 * side, -0.02, 0);
    sm.chest.add(shoulder);
  }
  // The face: a heavy brow sloping inwards (a scowl) and two glowing eyes, each with a halo so they show from far off.
  const browMat = new THREE.MeshLambertMaterial({ color: 0x1c1413 });
  const eyes = [];
  for (const side of [1, -1]) {
    const brow = new THREE.Mesh(boxGeo, browMat);
    brow.scale.set(0.13, 0.035, 0.06); brow.position.set(0.065 * side, 0.072, 0.15); brow.rotation.z = -0.38 * side;
    sm.head.add(brow);
    const eye = new THREE.Mesh(SG.joint, new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
    eye.scale.setScalar(0.5); eye.position.set(0.065 * side, 0.02, 0.158);
    sm.head.add(eye);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff2a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7, toneMapped: false }));
    halo.scale.setScalar(0.2); halo.position.set(0.065 * side, 0.02, 0.19);
    sm.head.add(halo);
    eyes.push({ eye, halo });
  }
  // Hair: a dark cap over the top and back of the head with spikes standing out of it. Nothing comes forward of
  // the forehead, so the eyes are never covered, whatever angle he is seen from.
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x0f0c0d });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.186, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
  cap.rotation.x = -0.5;    // tipped back, off the brow
  sm.head.add(cap);
  const spikeGeo = new THREE.ConeGeometry(0.062, 0.26, 6);
  // each spike: where it sits on the head, and how far it leans back (x) and to the side (z)
  for (const [x, y, z, back, lean] of [[0, 0.2, -0.02, -0.25, 0], [0.09, 0.17, -0.03, -0.35, -0.5], [-0.09, 0.17, -0.03, -0.35, 0.5],
    [0.05, 0.13, -0.13, -1.0, -0.3], [-0.05, 0.13, -0.13, -1.0, 0.3], [0.13, 0.08, -0.1, -0.9, -0.9], [-0.13, 0.08, -0.1, -0.9, 0.9],
    [0, 0.02, -0.19, -1.7, 0], [0.09, -0.03, -0.17, -1.9, -0.4], [-0.09, -0.03, -0.17, -1.9, 0.4]]) {
    const spike = new THREE.Mesh(spikeGeo, hairMat);
    spike.position.set(x, y, z); spike.rotation.set(back, 0, lean);
    sm.head.add(spike);
  }
  sm.head.rotation.order = 'YXZ';    // the head turns left and right first, then tilts
  castShadows(sm);
  sm.root.scale.setScalar(SEN_HEIGHT);
  const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffd23f })); sm.root.add(mark);
  const mat2 = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  mat2.scale.setScalar(2.2); mat2.position.set(-5, 0.03, 18); scene.add(mat2);
  applyPose(sm, POSE_IDLE);
  sm.root.position.set(-5, 0, 18); scene.add(sm.root);
  const sh = makeShadow(); placeShadow(sh, -5, 0, 18);
  // pad = the gold ring he stands on, shadow = his blob shadow, home = his place in the main arena.
  // pose = the pose he is in now, poseTo = the one he is moving into, poseT = seconds before he folds his arms again.
  // warnT = seconds left of the warning (hit him again before it runs out and he kills you). hitCd stops one swing counting twice.
  // headYaw, headPitch = where his head is turned, on top of where his body faces.
  return { sm, mark, eyes, pad: mat2, shadow: sh, pos: new V3(-5, 0, 18), home: new V3(-5, 0, 18), yaw: 0, near: false,
    pose: { ...POSE_IDLE }, poseTo: POSE_IDLE, poseT: 0, warnT: 0, hitCd: 0, headYaw: 0, headPitch: 0,
    // the grab: where the player was caught, where they are slammed from and to, and whether the slam has begun
    grabFrom: new V3(), slamFrom: new V3(), slamTo: new V3(), slamming: false };
})();

// Move Master Sen, his gold ring and his shadow to another spot (the training hall and back).
export function moveMaster(x, y, z) {
  master.pos.set(x, y, z);
  master.sm.root.position.set(x, y, z);
  master.pad.position.set(x, y + 0.03, z);
  placeShadow(master.shadow, x, y, z);
}

// Once per frame (update.js): he turns to face the player, his head and eyes follow them wherever they are,
// and his timers run down.
export function updateMaster(dt) {
  const dx = P.pos.x - master.pos.x, dz = P.pos.z - master.pos.z;
  const toPlayer = Math.atan2(dx, dz);
  master.yaw = angDamp(master.yaw, toPlayer, 4, dt);
  master.sm.root.rotation.y = master.yaw;
  master.hitCd = Math.max(0, master.hitCd - dt);
  master.warnT = Math.max(0, master.warnT - dt);
  master.poseT -= dt;
  if (master.poseT <= 0 && P.state !== 'grabbed') master.poseTo = POSE_IDLE;
  if (P.state !== 'grabbed') master.sm.root.position.y = master.pos.y;    // feet on the ground unless he is mid-jump with the player
  for (const k of POSE_KEYS) master.pose[k] = damp(master.pose[k], master.poseTo[k], 12, dt);
  applyPose(master.sm, master.pose);
  master.sm.body.position.y += Math.sin(T * 2) * 0.012;    // slow breathing
  // The body turns slowly; the head snaps the rest of the way and tilts, so the eyes are always on the player.
  const eyeHeight = master.pos.y + 1.83 * SEN_HEIGHT;
  const wantPitch = Math.atan2(P.pos.y + 1.7 - eyeHeight, Math.max(Math.hypot(dx, dz), 0.6));
  master.headYaw = damp(master.headYaw, clamp(angDiff(master.yaw, toPlayer), -1.2, 1.2), 14, dt);
  master.headPitch = damp(master.headPitch, clamp(wantPitch, -1, 0.9), 14, dt);
  master.sm.head.rotation.set(-master.headPitch, master.headYaw, 0);
  // His eyes burn brighter while a warning is running.
  const angry = master.warnT > 0 ? 1 : 0;
  for (const { eye, halo } of master.eyes) {
    eye.scale.setScalar(0.5 + angry * (0.14 + Math.sin(T * 14) * 0.05));
    halo.scale.setScalar(0.2 + angry * (0.22 + Math.sin(T * 14) * 0.06));
  }
  master.mark.position.y = 2.75 + Math.sin(T * 3) * 0.12; master.mark.rotation.y = T * 2; master.mark.visible = !dlg.open && !chal.cur;
}

// ---------- hitting him ----------
const WARNING_TIME = 10;    // seconds the warning lasts. A second hit inside it gets you grabbed
// Called by anything that hits an area (sword swings, slams, spins): did it reach Master Sen?
// cx, cz = centre of the hit, cy = its height, rad = its radius.
export function strikeMaster(cx, cy, cz, rad) {
  if (master.hitCd > 0 || dlg.open || P.state === 'grabbed') return;
  if (Math.hypot(master.pos.x - cx, master.pos.z - cz) > rad + 0.75 || Math.abs(cy - master.pos.y) > 3.2) return;
  master.hitCd = 0.6;
  _fx.set(master.pos.x, master.pos.y + 2, master.pos.z);
  burst(_fx, 10, 7);
  if (master.warnT > 0) grabPlayer(); else warnPlayer();
}
// First hit: he points at the player, says his piece, and throws them back.
function warnPlayer() {
  master.warnT = WARNING_TIME;
  master.poseTo = POSE_WARN; master.poseT = 2;
  const dx = P.pos.x - master.pos.x, dz = P.pos.z - master.pos.z, len = Math.hypot(dx, dz) || 1;
  P.vel.set(dx / len * 15, 8, dz / len * 15);
  P.atk.on = false;
  if (!LOCKED.has(P.state)) setState('normal');
  spawnRing(_fx.set(master.pos.x, master.pos.y + 0.1, master.pos.z), 0.5, 5, 0.4, 0xff2a1a);
  shake(0.55);
  centerMsg(`"Touch me again and I break you."<small>Master Sen · ${WARNING_TIME} seconds</small>`, 2.6);
}
// Second hit inside the warning: he catches the player by the neck, holds them off the ground, leaps into the
// air with them, and slams them down from the top of the jump. It costs most of their health but never the last of it.
// The times are seconds since the grab began.
const GRAB_PULL = 0.18;     // the player has been hauled into his hand
const GRAB_HOLD = 0.6;      // he stops holding them up and jumps
const GRAB_APEX = 1.0;      // he is at the top of the jump
const GRAB_SLAM = 1.2;      // he lands, and the player hits the ground
const JUMP_HEIGHT = 4.4;    // how high he leaps
const SLAM_DAMAGE = 0.6;    // share of the player's full health the slam takes
const NECK_HEIGHT = 1.5;    // how far above the player's feet their neck is
const _hold = new V3();
function grabPlayer() {
  master.warnT = 0;
  master.slamming = false;
  master.poseTo = POSE_GRAB;
  master.grabFrom.copy(P.pos);
  // he turns on the player at once, not at his usual unhurried pace
  master.yaw = Math.atan2(P.pos.x - master.pos.x, P.pos.z - master.pos.z);
  master.sm.root.rotation.y = master.yaw;
  P.atk.on = false;
  P.vel.set(0, 0, 0);
  setState('grabbed');
  shake(0.45);
  centerMsg('"I warned you."<small>Master Sen</small>', 1.5);
}
// Runs every frame of the player's 'grabbed' state (from the state switch in update.js).
export function updateGrab() {
  const t = P.st;
  P.vel.set(0, 0, 0);
  P.grav = 0;
  P.yaw = P.yawT = Math.atan2(master.pos.x - P.pos.x, master.pos.z - P.pos.z);    // face him
  // Where the player belongs while held: hanging from his raised hand by the neck.
  master.sm.handR.getWorldPosition(_hold);
  _hold.y -= NECK_HEIGHT;
  if (t < GRAB_PULL) {
    P.pos.lerpVectors(master.grabFrom, _hold, t / GRAB_PULL);
  } else if (t < GRAB_APEX) {
    // held up by the neck; then, from GRAB_HOLD, carried up as he leaps (the player hangs from his hand, so
    // moving him moves them)
    const up = clamp((t - GRAB_HOLD) / (GRAB_APEX - GRAB_HOLD), 0, 1);
    master.sm.root.position.y = master.pos.y + JUMP_HEIGHT * (1 - (1 - up) * (1 - up));    // fast off the ground, slowing at the top
    P.pos.copy(_hold);
    P.pos.x += Math.sin(T * 38) * 0.012;    // struggling
  } else if (t < GRAB_SLAM) {
    if (!master.slamming) {
      master.slamming = true;
      master.poseTo = POSE_SLAM;
      master.slamFrom.copy(P.pos);
      // the ground a little in front of where he took off
      master.slamTo.set(master.pos.x + Math.sin(master.yaw) * 2, master.pos.y, master.pos.z + Math.cos(master.yaw) * 2);
    }
    // both come down together: slowly at first, then driven into the ground
    const k = (t - GRAB_APEX) / (GRAB_SLAM - GRAB_APEX);
    master.sm.root.position.y = master.pos.y + JUMP_HEIGHT * (1 - k * k);
    P.pos.lerpVectors(master.slamFrom, master.slamTo, k * k);
  } else {
    // impact: he lands, and the player goes into the ground
    master.sm.root.position.y = master.pos.y;
    spawnRing(_fx.set(master.pos.x, master.pos.y + 0.1, master.pos.z), 0.6, 9, 0.55, 0xffffff);
    P.pos.copy(master.slamTo);
    const dmg = Math.min(P.hp - 1, Math.round(P.maxHp * SLAM_DAMAGE));    // never the last point of health
    P.hp -= dmg;
    P.hurtT = 0;
    _fx.copy(P.pos).setY(P.pos.y + 0.1);
    spawnRing(_fx, 0.4, 7, 0.5, 0xff2a1a);
    spawnRing(_fx, 0.2, 3.5, 0.35, 0xffffff);
    burst(_fx.setY(P.pos.y + 0.5), 34, 14);
    burst(_fx, 16, 9, 1);
    spawnText(_fx.setY(P.pos.y + 1.6), '-' + dmg, 'hurt');
    shake(1.3); addHitstop(0.12); flashHurt();
    setState('normal');
    P.vel.set(Math.sin(master.yaw) * 5, 5, Math.cos(master.yaw) * 5);    // a small bounce away from him
    P.iframes = 1.2;
    master.slamming = false;
    master.poseT = 0.8;     // he stays bent over the crater for a moment
    master.hitCd = 1.5;     // and cannot be provoked again straight away
  }
}

// ================= the menu =================
export const dlgEl = $('dlg'), dlgTx = dlgEl.querySelector('.tx'), dlgOp = dlgEl.querySelector('.op'), dlgTitle = dlgEl.querySelector('.ttl');
export const GREET = [
  'Your feet are quick. Whether your mind keeps up, we shall see.',
  'Wind does not ask permission to move. Neither should you.',
  'Back again? Good. Mastery is only repetition with attention.',
  'Every style is a different answer to the same question: how do you get there first?',
];
export const TIPS = [
  'Dash, then jump at once. The speed of the dash carries into the jump.',
  'Slide, then jump. Chain them and the ground will never slow you.',
  'The grey ones raise a shield. Strike from behind them, or from above.',
  'The purple ones strike back. Watch the red marks on the ground. A dash cannot be hit.',
  'A Monk who blocks at the very moment a blow lands will parry, and appear behind the attacker.',
  'Rewind (X) is a second chance. Use it after a failed jump.',
  'A Ninja can climb. Hold right-click against a wall and look up.',
  'A Lancer\'s javelin is also a door. Throw it, then press Q again.',
  'Throw a dummy hard into a wall and it takes extra damage.',
  'Do not test my patience. I warn once. After that I use my hands.',
];
// The little pictures on the cards. Each is the inside of a 24 x 24 drawing made of lines.
const ICONS = {
  sword: '<path d="M5 19 L18 6 L20 4 L19 7 L7 20 Z"/><path d="M4 16 L8 20"/><path d="M3 21 L5.5 18.5"/>',
  daggers: '<path d="M4 20 L13 11 L15 8 L12 10 L3.5 19"/><path d="M20 20 L11 11 L9 8 L12 10 L20.5 19"/>',
  fist: '<path d="M6 10 h11 a2 2 0 0 1 2 2 v4 a4 4 0 0 1 -4 4 H9 a3 3 0 0 1 -3 -3 Z"/><path d="M9 10 V7 M12 10 V6 M15 10 V7"/>',
  spear: '<path d="M3 21 L17 7"/><path d="M15 9 L21 3 L20 9 L15 9 L15 4 Z"/>',
  swap: '<circle cx="12" cy="6" r="3"/><path d="M6 21 v-4 a6 6 0 0 1 12 0 v4"/>',
  hall: '<path d="M3 7 Q12 3 21 7"/><path d="M5 10 H19"/><path d="M7 7 V21 M17 7 V21"/>',
  trophy: '<path d="M7 4 H17 V9 a5 5 0 0 1 -10 0 Z"/><path d="M7 6 H4 a3 3 0 0 0 3 4 M17 6 h3 a3 3 0 0 1 -3 4"/><path d="M12 14 V18 M8 20 H16"/>',
  bulb: '<path d="M9 17 a6 6 0 1 1 6 0 v2 H9 Z"/><path d="M10 22 H14"/>',
  leave: '<path d="M14 4 H19 V20 H14"/><path d="M4 12 H14 M9 7 L4 12 L9 17"/>',
  back: '<path d="M4 12 H20 M10 6 L4 12 L10 18"/>',
  blink: '<path d="M13 2 L5 13 H11 L9 22 L19 9 H13 Z"/>',
  cyclone: '<path d="M12 12 a3 3 0 1 1 3 -3 a6 6 0 1 1 -6 6 a9 9 0 1 1 9 -9"/>',
  slam: '<path d="M12 3 V15 M7 10 L12 15 L17 10"/><path d="M3 20 H21 M6 17 L4 20 M18 17 L20 20"/>',
  rising: '<path d="M12 21 V7 M7 12 L12 7 L17 12"/><path d="M5 4 Q12 1 19 4"/>',
  hook: '<path d="M12 3 V14 a4 4 0 0 1 -8 0"/><circle cx="12" cy="3" r="1.6"/>',
  water: '<path d="M12 3 C7 10 6 13 6 15 a6 6 0 0 0 12 0 C18 13 17 10 12 3 Z"/>',
  flame: '<path d="M12 2 C14 7 18 9 18 14 a6 6 0 0 1 -12 0 C6 11 8 10 9 7 C10 10 12 9 12 2 Z"/>',
  rings: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  flag: '<path d="M6 21 V3"/><path d="M6 4 H18 L15 8 L18 12 H6"/>',
  smash: '<path d="M5 5 L19 19 M19 5 L5 19"/><circle cx="12" cy="12" r="9"/>',
  combo: '<path d="M4 8 L10 12 L4 16 M10 8 L16 12 L10 16 M16 8 L22 12 L16 16"/>',
  wrench: '<path d="M15 4 a4 4 0 0 0 -4 6 L4 17 L7 20 L14 13 a4 4 0 0 0 6 -4 L17 12 L15 10 L18 7 Z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11 V8 a4 4 0 0 1 8 0 v3"/>',
  again: '<path d="M4 12 a8 8 0 1 0 3 -6.2"/><path d="M4 4 V9 H9"/>',
};
const SLOT_ICON = { m2: 'hook', q: 'blink', e: 'cyclone', r: 'slam', f: 'rising' };
const WEAPON_ICON = { sword: 'sword', daggers: 'daggers', spear: 'spear', none: 'fist' };
const CHALLENGE_ICON = { rings: 'rings', summit: 'flag', demo: 'smash', combo: 'combo' };
const PAGE_TITLE = { main: 'What do you want?', classes: 'Choose how you fight', chal: 'Challenges', train: 'Training hall', tips: 'Advice' };
const icon = name => `<svg viewBox="0 0 24 24">${ICONS[name] || ICONS.back}</svg>`;

export function fmtBest(c) { const b = save.best[c.id]; return b ? `best ${b.toFixed(2)}s` : 'not done yet'; }
const backOption = () => ({ label: 'Back', icon: 'back', plain: true, act: () => { dlg.page = 'main'; renderDlg('Something else?'); } });

// Draw the current page of the menu. Each option becomes one card:
//   label = its title, sub = the small text under it, icon = its picture (a name from ICONS),
//   tag = a short status in the corner (tone picks its colour: gold, blue, red or grey),
//   cur = nothing to do here (shown faded), plain = a small card such as Back, act = what choosing it does.
// Cards can be clicked; the number keys pick them too (here while the menu has the mouse, in update.js otherwise).
export function renderDlg(text) {
  let opts = [];
  if (dlg.page === 'main') {
    text = text || pick(GREET);
    opts = [
      { label: 'Change fighting style', sub: 'Blademaster, Ninja, Monk or Lancer', icon: 'swap', act: () => { dlg.page = 'classes'; renderDlg(); } },
      { label: 'Train my skills', sub: 'He takes you to the training hall, where skills and sword styles are earned', icon: 'hall', act: () => { closeDlg(); enterDojo(); } },
      { label: 'Take a challenge', sub: 'Timed tests in the arena. Your best times are kept', icon: 'trophy', act: () => { dlg.page = 'chal'; renderDlg(); } },
      { label: 'Ask for advice', sub: 'A tip about moving or fighting', icon: 'bulb', act: () => { dlg.page = 'tips'; renderDlg(); } },
      { label: 'Leave', icon: 'leave', plain: true, act: closeDlg },
    ];
  } else if (dlg.page === 'classes') {
    text = 'Four paths. Each moves differently. Choose.';
    opts = CLASS_ORDER.map(id => {
      const c = CLASSES[id], cur = c.id === CL.id;
      return { label: c.name, sub: c.desc, icon: WEAPON_ICON[c.weapon], cur, tag: cur ? 'CURRENT' : '', tone: 'gold', act: () => { closeDlg(); if (!cur) setClass(c.id); } };
    });
    opts.push(backOption());
  } else if (dlg.page === 'chal') {
    text = 'A test, then. I will count you in.';
    opts = CH.map(c => ({ label: c.name, sub: c.desc, icon: CHALLENGE_ICON[c.id], tag: fmtBest(c).toUpperCase(), tone: save.best[c.id] ? 'gold' : 'grey', act: () => startChallenge(c) }));
    opts.push(backOption());
  } else if (dlg.page === 'train') {
    // One card per skill that has ranks: its rank, and the trial that earns the next one.
    const list = trainingList();
    const tuned = isTuned();
    if (!list.length) text = 'This style has no trials yet. Its skills are yours already.';
    else if (tuned) text = 'You have changed numbers in the tuning panel. A trial is earned fairly or not at all: put them back to default and I will test you.';
    else text = 'Pick a skill and I will prepare the hall for it. For a skill you have not learned, I lend it to you until the trial ends. Pass, and it is yours.';
    if (tuned && list.length) {
      // Trials cannot start with tuned numbers, so offer the fix right here.
      opts = [{ label: 'Put my tuning back to default', sub: 'Same as "Reset all" in the tuning panel', icon: 'wrench', act: () => { resetTuning(); renderDlg(); } }];
    } else {
      opts = list.map(({ slot, skill, rank, next }) => {
        const status = rank === 0 ? 'LOCKED' : 'RANK ' + ROMAN[rank];
        if (!next) return { label: skill.n, sub: 'Nothing more to learn here', icon: SLOT_ICON[slot], tag: 'MASTERED', tone: 'gold', cur: true, act: () => renderDlg() };
        const lent = next.rank === 1 ? ' The skill is lent to you for the trial.' : '';
        return {
          label: skill.n, icon: SLOT_ICON[slot], tag: status, tone: rank === 0 ? 'red' : 'blue',
          sub: `<b>Trial:</b> ${next.desc} (${next.time}s).${lent}<br><b>Reward:</b> ${skill.perks[next.rank - 1]}`,
          act: () => { if (!startTrial(next)) renderDlg(); },
        };
      });
      // Sword styles come after the skills: each is unlocked by its own trial.
      for (const { st, trial, unlocked, blocked } of styleList()) {
        const base = { label: st.name + ' style', icon: st.id };
        if (unlocked) opts.push({ ...base, sub: `${st.how} to take it for a while`, tag: 'UNLOCKED', tone: 'gold', cur: true, act: () => renderDlg() });
        else if (blocked) opts.push({ ...base, sub: `${st.perk}.<br><b>First learn:</b> ${blocked}`, tag: 'LOCKED', tone: 'grey', cur: true, act: () => renderDlg() });
        else opts.push({ ...base, sub: `<b>Trial:</b> ${trial.desc} (${trial.time}s).<br><b>Reward:</b> ${st.perk}`, tag: 'LOCKED', tone: 'red', act: () => { if (!startTrial(trial)) renderDlg(); } });
      }
    }
    opts.push({ label: 'Return to the arena', icon: 'leave', plain: true, act: () => { closeDlg(); leaveDojo(); } });
  } else if (dlg.page === 'tips') {
    text = pick(TIPS);
    opts = [
      { label: 'Tell me another', icon: 'again', plain: true, act: () => renderDlg() },
      backOption(),
    ];
  }
  dlg.opts = opts;
  dlgTx.textContent = text;
  dlgTitle.textContent = PAGE_TITLE[dlg.page] || '';
  dlgOp.innerHTML = opts.map((o, i) => `<button class="card${o.cur ? ' cur' : ''}${o.plain ? ' plain' : ''}" data-i="${i}">
    <span class="num">${i + 1}</span><span class="ic">${icon(o.icon)}</span>
    <span class="tt">${o.label}</span>${o.tag ? `<span class="tag ${o.tone || 'grey'}">${o.tag}</span>` : ''}
    ${o.sub ? `<span class="sb">${o.sub}</span>` : ''}</button>`).join('');
  dlgEl.style.display = 'flex';
}
// Capture the mouse again after the menu closes. If the browser refuses, the pause screen is simply left showing.
function recapture() {
  if (DEBUG !== null || document.pointerLockElement) return;
  const r = renderer.domElement.requestPointerLock();
  if (r && r.catch) r.catch(() => {});
}
// Open the menu: the mouse is set free so the cards can be clicked. The class on <body> hides the pause screen
// and the tuning panel while the menu is up (see index.html).
export function openDlg() {
  dlg.open = true;
  dlg.page = dojo.inside ? 'train' : 'main';    // in the training hall he only talks about trials
  P.atk.on = false;
  if (!LOCKED.has(P.state)) setState('normal');
  document.body.classList.add('sen');
  renderDlg();
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeDlg() {
  if (!dlg.open) return;
  dlg.open = false;
  dlgEl.style.display = 'none';
  document.body.classList.remove('sen');
  recapture();
}

// Clicking a card chooses it; clicking the dark area outside the window leaves.
dlgEl.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) dlg.opts[+card.dataset.i].act();
  else if (e.target === dlgEl) closeDlg();
});
// Keys while the menu has the mouse (the game itself is paused then, so update.js is not reading keys).
addEventListener('keydown', e => {
  if (!dlg.open || document.pointerLockElement || DEBUG !== null) return;
  const n = e.code.startsWith('Digit') ? +e.code.slice(5) : e.code.startsWith('Numpad') ? +e.code.slice(6) : 0;
  if (n >= 1 && n <= dlg.opts.length) { e.preventDefault(); dlg.opts[n - 1].act(); }
  else if (e.code === 'KeyG' || e.code === 'Backspace' || e.code === 'Escape') { e.preventDefault(); closeDlg(); }
});
