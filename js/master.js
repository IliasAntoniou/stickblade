// master.js: Master Sen (the figure next to the start) and his dialog menu: change class, start a challenge, get a tip.

import * as THREE from 'three';
import { V3, pick, $, save } from './util.js';
import { scene } from './core.js';
import { boxGeo, lam, ground, makeShadow, placeShadow } from './world.js';
import { makeStickman, BASE, applyPose } from './stickman.js';
import { ringGeo } from './fx.js';
import { P, CL, dlg, chal, CLASSES } from './state.js';
import { LOCKED, setState, parry } from './player.js';
import { CLASS_ORDER, setClass } from './classes/index.js';
import { CH, startChallenge } from './challenges.js';
import { trainingList, startTrial, ROMAN } from './progress.js';
import { isTuned } from './tuning.js';

// ================= master NPC + dialog =================
export const master = (() => {
  const mat = new THREE.MeshLambertMaterial({ color: 0x5a3e2b });
  const sm = makeStickman(mat, null, false);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.24, 16), lam(0xd9b26a)); hat.position.y = 0.2; sm.head.add(hat);
  const staff = new THREE.Mesh(boxGeo, lam(0x8a5a2b)); staff.scale.set(0.06, 2.0, 0.06); staff.position.set(0.5, 1.0, 0.25); sm.root.add(staff);
  const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffd23f })); sm.root.add(mark);
  const mat2 = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  mat2.scale.setScalar(1.6); mat2.position.set(-5, 0.03, 18); scene.add(mat2);
  const p = { ...BASE, shLX: -0.5, shLZ: 0.5, elL: -0.9, shRX: -0.5, shRZ: -0.1, elR: -1.7, spineX: 0.14 };
  applyPose(sm, p);
  sm.root.position.set(-5, 0, 18); scene.add(sm.root);
  const sh = makeShadow(); placeShadow(sh, -5, 0, 18);
  return { sm, mark, pos: new V3(-5, 0, 18), yaw: 0, near: false };
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
export function fmtBest(c) { const b = save.best[c.id]; return b ? `best ${b.toFixed(2)}s` : 'not completed yet'; }
// Draw the current dialog page. Each option is { label, sub (small text), act (what choosing it does) }.
// Number keys pick one; that check is in update.js.
export function renderDlg(text) {
  let opts = [];
  if (dlg.page === 'main') {
    text = text || pick(GREET);
    opts = [
      { label: 'Teach me a different style', act: () => { dlg.page = 'classes'; renderDlg(); } },
      { label: 'Train my skills', act: () => { dlg.page = 'train'; renderDlg(); } },
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
    if (!list.length) text = 'This style has no trials yet. Its skills are yours already.';
    else if (isTuned()) text = 'Your tuning panel is not at its defaults. Press "Reset all" there first: a trial is earned fairly or not at all.';
    else text = 'Skill is earned, never given. Pass a trial to learn a technique, pass a harder one to sharpen it.';
    opts = list.map(({ skill, rank, next }) => {
      const status = rank === 0 ? 'not learned' : 'rank ' + ROMAN[rank];
      if (!next) return { label: `${skill.n} · ${status} · mastered`, cur: true, act: () => renderDlg() };
      return {
        label: `${skill.n} · ${status}`,
        sub: `${next.desc} (${next.time}s) · reward: ${skill.perks[next.rank - 1]}`,
        act: () => { if (!startTrial(next)) renderDlg(); },
      };
    });
    opts.push({ label: 'Back', act: () => { dlg.page = 'main'; renderDlg('Something else?'); } });
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
export function openDlg() { dlg.open = true; dlg.page = 'main'; P.atk.on = false; if (!LOCKED.has(P.state)) setState('normal'); renderDlg(); }
export function closeDlg() { dlg.open = false; dlgEl.style.display = 'none'; }
