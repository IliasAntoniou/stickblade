// master.js: Master Sen (the figure next to the start) and his dialog menu: change class, start a challenge, get a tip.

import * as THREE from 'three';
import { V3, pick, $, save } from './util.js';
import { scene } from './core.js';
import { boxGeo, lam, ground, makeShadow, placeShadow } from './world.js';
import { SG, makeStickman, BASE, applyPose, addRim, castShadows } from './stickman.js';
import { ringGeo } from './fx.js';
import { P, CL, dlg, chal, CLASSES } from './state.js';
import { LOCKED, setState, parry } from './player.js';
import { CLASS_ORDER, setClass } from './classes/index.js';
import { CH, startChallenge } from './challenges.js';
import { trainingList, styleList, startTrial, ROMAN } from './progress.js';
import { isTuned, resetTuning } from './tuning.js';
import { dojo, enterDojo, leaveDojo } from './dojo.js';

// ================= master NPC + dialog =================
export const master = (() => {
  // Master Sen is built from the same stick figure as everyone else, then bulked out: a towering, heavily
  // muscled man with a dark hat pulled low and eyes that glow red underneath it. He is meant to be intimidating.
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
  // The face: a heavy brow sloping inwards (a scowl) and two small glowing eyes.
  const browMat = new THREE.MeshLambertMaterial({ color: 0x1c1413 });
  for (const side of [1, -1]) {
    const brow = new THREE.Mesh(boxGeo, browMat);
    brow.scale.set(0.13, 0.035, 0.06); brow.position.set(0.065 * side, 0.07, 0.145); brow.rotation.z = -0.38 * side;
    sm.head.add(brow);
    const eye = new THREE.Mesh(SG.joint, new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
    eye.scale.setScalar(0.42); eye.position.set(0.065 * side, 0.025, 0.155);
    sm.head.add(eye);
  }
  // A wide dark hat. (Its own material, not lam(): that one is for boxes only.)
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.22, 16), new THREE.MeshLambertMaterial({ color: 0x241b1b }));
  hat.position.y = 0.19;
  sm.head.add(hat);
  castShadows(sm);
  sm.root.scale.setScalar(1.45);    // half as tall again as the player
  const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffd23f })); sm.root.add(mark);
  const mat2 = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  mat2.scale.setScalar(2.2); mat2.position.set(-5, 0.03, 18); scene.add(mat2);
  // Arms folded across the chest, feet planted wide, leaning slightly forward over whoever he is talking to.
  const p = { ...BASE, bodyY: 0.93, spineX: 0.12,
    shLX: -0.85, shLZ: -0.55, elL: -1.85, shRX: -0.7, shRZ: 0.55, elR: -1.95,
    hipLZ: 0.24, hipRZ: -0.24, hipLX: 0, hipRX: 0, kneeL: 0.05, kneeR: 0.05 };
  applyPose(sm, p);
  sm.root.position.set(-5, 0, 18); scene.add(sm.root);
  const sh = makeShadow(); placeShadow(sh, -5, 0, 18);
  // pad = the gold ring he stands on, shadow = his blob shadow, home = his place in the main arena
  return { sm, mark, pad: mat2, shadow: sh, pos: new V3(-5, 0, 18), home: new V3(-5, 0, 18), yaw: 0, near: false };
})();

export const dlgEl = $('dlg'), dlgTx = dlgEl.querySelector('.tx'), dlgOp = dlgEl.querySelector('.op');
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
];
// Move Master Sen, his gold ring and his shadow to another spot (the training hall and back).
export function moveMaster(x, y, z) {
  master.pos.set(x, y, z);
  master.sm.root.position.set(x, y, z);
  master.pad.position.set(x, y + 0.03, z);
  placeShadow(master.shadow, x, y, z);
}
export function fmtBest(c) { const b = save.best[c.id]; return b ? `best ${b.toFixed(2)}s` : 'not completed yet'; }
// Draw the current dialog page. Each option is { label, sub (small text), act (what choosing it does) }.
// Number keys pick one; that check is in update.js.
export function renderDlg(text) {
  let opts = [];
  if (dlg.page === 'main') {
    text = text || pick(GREET);
    opts = [
      { label: 'Teach me a different style', act: () => { dlg.page = 'classes'; renderDlg(); } },
      { label: 'Train my skills', sub: 'Master Sen takes you to the training hall', act: () => { closeDlg(); enterDojo(); } },
      { label: 'Give me a challenge', act: () => { dlg.page = 'chal'; renderDlg(); } },
      { label: 'Any advice, master?', act: () => { dlg.page = 'tips'; renderDlg(); } },
      { label: 'Farewell', act: closeDlg },
    ];
  } else if (dlg.page === 'classes') {
    text = 'Four paths. Each moves differently. Choose.';
    opts = CLASS_ORDER.map(id => {
      const c = CLASSES[id];
      return { label: c.name + (c.id === CL.id ? ' (current)' : ''), sub: c.desc, cur: c.id === CL.id, act: () => { closeDlg(); if (c.id !== CL.id) setClass(c.id); } };
    });
    opts.push({ label: 'Back', act: () => { dlg.page = 'main'; renderDlg('Something else?'); } });
  } else if (dlg.page === 'chal') {
    text = 'A test, then. I will count you in.';
    opts = CH.map(c => ({ label: c.name, sub: `${c.desc} · ${fmtBest(c)}`, act: () => startChallenge(c) }));
    opts.push({ label: 'Back', act: () => { dlg.page = 'main'; renderDlg('Something else?'); } });
  } else if (dlg.page === 'train') {
    // One line per skill that has ranks: its rank, and the trial that earns the next one.
    const list = trainingList();
    const tuned = isTuned();
    if (!list.length) text = 'This style has no trials yet. Its skills are yours already.';
    else if (tuned) text = 'You have changed numbers in the tuning panel. A trial is earned fairly or not at all: put them back to default and I will test you.';
    else text = 'Pick a skill and I will prepare the hall for it. For a skill you have not learned, I lend it to you until the trial ends. Pass, and it is yours.';
    if (tuned && list.length) {
      // Trials cannot start with tuned numbers, so offer the fix right here.
      opts = [{ label: 'Put my tuning back to default', sub: 'Same as "Reset all" in the tuning panel', act: () => { resetTuning(); renderDlg(); } }];
    } else {
      opts = list.map(({ skill, rank, next }) => {
        const status = rank === 0 ? 'not learned' : 'rank ' + ROMAN[rank];
        if (!next) return { label: `${skill.n} · ${status} · mastered`, cur: true, act: () => renderDlg() };
        const lent = next.rank === 1 ? ' · the skill is lent to you for the trial' : '';
        return {
          label: `${skill.n} · ${status} · start the trial`,
          sub: `${next.desc} (${next.time}s)${lent} · reward: ${skill.perks[next.rank - 1]}`,
          act: () => { if (!startTrial(next)) renderDlg(); },
        };
      });
      // Sword styles come after the skills: each is unlocked by its own trial.
      for (const { st, trial, unlocked, blocked } of styleList()) {
        if (unlocked) opts.push({ label: `${st.name} style · unlocked`, sub: `${st.how} to take it for a while`, cur: true, act: () => renderDlg() });
        else if (blocked) opts.push({ label: `${st.name} style · learn ${blocked} first`, sub: st.perk, cur: true, act: () => renderDlg() });
        else opts.push({ label: `${st.name} style · locked · start the trial`, sub: `${trial.desc} (${trial.time}s) · reward: ${st.perk}`, act: () => { if (!startTrial(trial)) renderDlg(); } });
      }
    }
    opts.push({ label: 'Return to the arena', act: () => { closeDlg(); leaveDojo(); } });
  } else if (dlg.page === 'tips') {
    text = pick(TIPS);
    opts = [
      { label: 'Tell me another', act: () => renderDlg() },
      { label: 'Back', act: () => { dlg.page = 'main'; renderDlg('Something else?'); } },
    ];
  }
  dlg.opts = opts;
  dlgTx.textContent = text;
  dlgOp.innerHTML = opts.map((o, i) => `<div class="${o.cur ? 'cur' : ''}"><b>${i + 1}</b>${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}</div>`).join('');
  dlgEl.style.display = 'block';
}
export function openDlg() { dlg.open = true; dlg.page = dojo.inside ? 'train' : 'main';    // in the training hall he only talks about trials
  P.atk.on = false; if (!LOCKED.has(P.state)) setState('normal'); renderDlg(); }
export function closeDlg() { dlg.open = false; dlgEl.style.display = 'none'; }
