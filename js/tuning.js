// tuning.js: the in-game tuning panel. Shown whenever the game is paused (Esc or Tab); every slider changes a number
// the game reads live, so you can tweak, resume and feel the difference.
// The numbers themselves live in TUNE (state.js) and in each class table (CLASSES). This file only edits and saves them.
// Changes are kept in the browser's localStorage. "Reset all" and the per-row reset button restore the defaults.

import { $ } from './util.js';
import { P, CL, CLASSES, TUNE, TUNE_DEFAULTS } from './state.js';
import { dummies } from './dummies.js';
import { unlockAll, resetProgress } from './progress.js';
import { resetStory } from './quests.js';

const STORE_KEY = 'stickblade.tune.v1';
// The smoke test must always run on default numbers, so it ignores and never writes saved tuning.
const SMOKE = new URLSearchParams(location.search).get('debug') === 'smoke';
const SKILL_KEYS = { m2: 'RMB', q: 'Q', e: 'E', r: 'R', f: 'F' };

// The general sliders. Each row: [key in TUNE, label, min, max, step]. A row with no numbers is an on/off switch.
const GROUPS = [
  ['Movement', [
    ['runMult', 'Run speed ×', 0.25, 3, 0.05],
    ['jump', 'Jump power', 4, 30, 0.5],
    ['airJump', 'Air jump power', 4, 30, 0.5],
    ['gravity', 'Gravity', 5, 80, 1],
    ['extraAirJumps', 'Extra air jumps', 0, 5, 1],
    ['dashSpeed', 'Dash speed', 10, 80, 1],
    ['dashTime', 'Dash length (s)', 0.05, 0.5, 0.01],
    ['dashCd', 'Dash recharge (s)', 0, 3, 0.05],
    ['dashCharges', 'Dash charges', 1, 6, 1],
  ]],
  ['Player', [
    ['maxHp', 'Max health', 10, 1000, 10],
    ['hpRegen', 'Health regen / s', 0, 100, 1],
    ['dmgTaken', 'Damage taken ×', 0, 3, 0.05],
    ['god', 'Cannot be hit'],
    ['cdMult', 'Cooldowns × (0 = none)', 0, 2, 0.05],
  ]],
  ['Combat', [
    ['dmgMult', 'Damage dealt ×', 0, 10, 0.1],
    ['kbMult', 'Knockback ×', 0, 4, 0.05],
    ['hitstopMult', 'Hit freeze ×', 0, 3, 0.05],
    ['shakeMult', 'Screen shake ×', 0, 3, 0.05],
  ]],
  ['Dummies', [
    ['dummyHpMult', 'Dummy health ×', 0.1, 10, 0.1],
    ['dummyRegen', 'Dummies heal'],
    ['fightersAttack', 'Fighters attack'],
  ]],
  ['Game', [
    ['timeScale', 'Game speed ×', 0.1, 2, 0.05],
  ]],
];

// The original numbers of every class, copied before any saved tuning is applied, so reset has something to go back to.
const classDefaults = {};
// Skills with ranks (progress.js) get their cooldown from their rank, so the panel leaves those alone.
function tunableSkills(c) {
  return Object.keys(SKILL_KEYS).filter(k => !c.skills[k].lv);
}
function classNumbers(c) {
  const cd = {};
  for (const k of tunableSkills(c)) cd[k] = c.skills[k].cd;
  return { run: c.run, airJumps: c.airJumps, dmg: c.atk.map(a => a.dmg), cd };
}
function setClassNumbers(c, n) {
  c.run = n.run;
  c.airJumps = n.airJumps;
  c.atk.forEach((a, i) => { a.dmg = n.dmg[i]; });
  for (const k of tunableSkills(c)) c.skills[k].cd = n.cd[k];
}

function store() {
  if (SMOKE) return;
  const classes = {};
  for (const id in CLASSES) classes[id] = classNumbers(CLASSES[id]);
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ tune: TUNE, classes })); } catch (e) {}
}
function load() {
  if (SMOKE) return;
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
  if (!s || typeof s !== 'object') return;
  // Only take values that still exist and have the right type, so an old save cannot break a newer version.
  for (const k in TUNE_DEFAULTS) {
    if (s.tune && typeof s.tune[k] === typeof TUNE_DEFAULTS[k]) TUNE[k] = s.tune[k];
  }
  for (const id in CLASSES) {
    const n = s.classes && s.classes[id], d = classDefaults[id];
    const ok = n && typeof n.run === 'number' && typeof n.airJumps === 'number' && Array.isArray(n.dmg) && n.dmg.length === d.dmg.length
      && n.dmg.every(v => typeof v === 'number') && n.cd && tunableSkills(CLASSES[id]).every(k => typeof n.cd[k] === 'number');
    if (ok) setClassNumbers(CLASSES[id], n);
  }
}

// Push the numbers that are copied onto the player or the dummies (most are simply read live and need nothing here).
export function applyTune() {
  P.maxHp = TUNE.maxHp;
  if (P.hp > P.maxHp) P.hp = P.maxHp;
  if (P.dashCharges > TUNE.dashCharges) P.dashCharges = TUNE.dashCharges;
  if (CL) {
    P.run = CL.run;
    P.airJumpsMax = CL.airJumps + TUNE.extraAirJumps;
    if (P.airJumps > P.airJumpsMax) P.airJumps = P.airJumpsMax;
  }
  for (const d of dummies) {
    const max = d.baseHp * TUNE.dummyHpMult;
    d.hp = d.hp / d.maxHp * max;    // keep the same fraction of health
    d.maxHp = max;
  }
}

// True if any number differs from its default. Trials refuse to run while this is true (see progress.js).
export function isTuned() {
  for (const k in TUNE_DEFAULTS) {
    if (TUNE[k] !== TUNE_DEFAULTS[k]) return true;
  }
  for (const id in classDefaults) {
    if (JSON.stringify(classNumbers(CLASSES[id])) !== JSON.stringify(classDefaults[id])) return true;
  }
  return false;
}

// Put every number back to its default: the general ones and all four classes.
export function resetTuning() {
  Object.assign(TUNE, TUNE_DEFAULTS);
  for (const id in CLASSES) setClassNumbers(CLASSES[id], classDefaults[id]);
  applyTune();
  store();
  render();
}

// ---------- the panel ----------
const panel = document.createElement('div');
panel.id = 'tune';
panel.innerHTML = '<div class="th"><b>TUNING</b><span>click to fold</span></div><div class="tb"></div>'
  + '<div class="tf"><button class="ra">Reset all</button><button class="cp">Copy changes</button></div>'
  + '<div class="tf tt"><span>Testing</span><button class="ua">Unlock all skills</button><button class="rp">Reset progress</button></div>';
document.body.appendChild(panel);
const body = panel.querySelector('.tb');
let rows = [];

// Rows for the class being played. They edit the class table directly.
function classRows() {
  if (!CL) return [];
  const d = classDefaults[CL.id], c = CL;
  const out = [
    { label: 'Run speed', min: 2, max: 30, step: 0.5, get: () => c.run, set: v => { c.run = v; }, def: d.run },
    { label: 'Air jumps', min: 0, max: 5, step: 1, get: () => c.airJumps, set: v => { c.airJumps = v; }, def: d.airJumps },
  ];
  c.atk.forEach((a, i) => {
    const last = i === c.atk.length - 1;
    out.push({ label: `Hit ${i + 1} damage${last ? ' (finisher)' : ''}`, min: 0, max: 200, step: 1, get: () => a.dmg, set: v => { a.dmg = v; }, def: d.dmg[i] });
  });
  for (const k of tunableSkills(c)) {
    const s = c.skills[k];
    out.push({ label: `${SKILL_KEYS[k]} ${s.n} cooldown (s)`, min: 0, max: 20, step: 0.5, get: () => s.cd, set: v => { s.cd = v; }, def: d.cd[k] });
  }
  return out;
}
function fmt(row, v) {
  if (row.toggle) return v ? 'on' : 'off';
  const decimals = (String(row.step).split('.')[1] || '').length;
  return v.toFixed(decimals);
}
function refreshRow(row) {
  const v = row.get();
  if (row.toggle) row.input.checked = v; else row.input.value = v;
  row.valEl.textContent = fmt(row, v);
  row.el.classList.toggle('chg', v !== row.def);
}
// Build the whole panel again. Called at start, when the class changes, and after a reset.
function render() {
  body.innerHTML = '';
  rows = [];
  const groups = GROUPS.map(([title, list]) => [title, list.map(([key, label, min, max, step]) => (
    { label, min, max, step, toggle: min === undefined, get: () => TUNE[key], set: v => { TUNE[key] = v; }, def: TUNE_DEFAULTS[key] }
  ))]);
  if (CL) groups.push([CL.name + ' (this class only)', classRows()]);
  for (const [title, list] of groups) {
    const h = document.createElement('div');
    h.className = 'tg';
    h.textContent = title;
    body.appendChild(h);
    for (const row of list) {
      const el = document.createElement('div');
      el.className = 'tr';
      el.innerHTML = `<span class="tl">${row.label}</span>`
        + (row.toggle ? '<input type="checkbox">' : `<input type="range" min="${row.min}" max="${row.max}" step="${row.step}">`)
        + '<span class="tv"></span><button class="tx" title="Back to default">↺</button>';
      row.el = el;
      row.input = el.querySelector('input');
      row.valEl = el.querySelector('.tv');
      const change = v => { row.set(v); applyTune(); refreshRow(row); store(); };
      row.input.addEventListener('input', () => change(row.toggle ? row.input.checked : +row.input.value));
      el.querySelector('.tx').addEventListener('click', () => change(row.def));
      refreshRow(row);
      body.appendChild(el);
      rows.push(row);
    }
  }
}
export function refreshTuning() { render(); }

panel.querySelector('.th').addEventListener('click', () => {
  const folded = panel.classList.toggle('min');
  try { localStorage.setItem(STORE_KEY + '.folded', folded ? '1' : ''); } catch (e) {}
});
panel.querySelector('.ra').addEventListener('click', resetTuning);
// Testing shortcuts for skill progress. They skip the trials, so they are for trying things out, not for playing.
panel.querySelector('.ua').addEventListener('click', unlockAll);
// "Reset progress" also starts the story again from its first task.
panel.querySelector('.rp').addEventListener('click', () => {
  resetProgress();
  resetStory();
});
// Copy every changed number as text, to paste into a chat or a note ("make these the new defaults").
panel.querySelector('.cp').addEventListener('click', e => {
  const changed = rows.filter(r => r.get() !== r.def).map(r => `${r.label}: ${fmt(r, r.get())} (default ${fmt(r, r.def)})`);
  const text = changed.length ? changed.join('\n') : 'No changes from default.';
  const done = () => { e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = 'Copy changes'; }, 1200); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => prompt('Copy this:', text));
  else prompt('Copy this:', text);
});
// The panel is only usable with a free mouse, which is exactly when the game is paused.
document.addEventListener('pointerlockchange', () => { panel.style.display = document.pointerLockElement ? 'none' : 'flex'; });

// Called once from main.js, after the class files have loaded and before the first class is chosen.
export function initTuning() {
  for (const id in CLASSES) classDefaults[id] = classNumbers(CLASSES[id]);
  load();
  try { if (localStorage.getItem(STORE_KEY + '.folded')) panel.classList.add('min'); } catch (e) {}
  render();
}
