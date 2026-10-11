// progress.js: learning skills and making them stronger. The only way to do either is to pass a trial.
// A skill with progression has a rank: 0 = locked, 1 to 3 = learned, stronger each time. Ranks are kept per class.
// Which skills have ranks, what each rank gives and what the trials are is data in the class file (see classes/blade.js).
// Every class has that data now. A class without it would simply have every skill available.
// A trial says how it is counted either with its own onHit function (the Blademaster's do) or in plain data
// (count, by, only, when, under: see countHit below), which is how the Mage's trials are written.
// Sword styles are unlocked once, for every class. A class whose file lists no style trials is given the three
// common ones (commonStyleTrials below), worded with its own skill names.
//
// How a trial runs: Master Sen starts it in the training hall (startTrial; dojo.js builds the layout the trial
// asks for), challenges.js does the countdown and the clock, every hit that
// lands is reported here (onHit), and updateTrial decides each frame whether it is passed or failed.
// Closed back doors: trials refuse to start, and fail, while any tuning value differs from default; a trial can
// limit which attacks do damage (allow); a rank-N trial needs rank N-1.

import { _fx } from './util.js';
import { toast, centerMsg, spawnRing, burst } from './fx.js';
import { T, P, CL, CLASSES, chal, hitSrc } from './state.js';
import { startChallenge, endChallenge, chalEl } from './challenges.js';
import { isTuned } from './tuning.js';
import { dojo, enterDojo, setupTrial } from './dojo.js';
import { STYLES, style, styleHow } from './styles.js';

const STORE_KEY = 'stickblade.progress.v1';
// The smoke test starts from nothing and never writes, so running it cannot touch real progress.
const SMOKE = new URLSearchParams(location.search).get('debug') === 'smoke';
export const ROMAN = ['', 'I', 'II', 'III'];
// Testing only (tests/poses.js with &lit=1): show every pool and fire as unlocked, without touching the save.
const SHOW_LIT = new URLSearchParams(location.search).get('lit') === '1' && new URLSearchParams(location.search).has('debug');
export const MAX_RANK = 3;
const KEY_NAME = { m2: 'the right mouse button', q: 'Q', e: 'E', r: 'R', f: 'F' };

// prog[classId][slot] = rank. Missing means the skill's starting rank.
// prog._styles[styleId] = 1 once a sword style (styles.js) is unlocked.
let prog = {};
function store() {
  if (SMOKE) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(prog)); } catch (e) {}
}
function savedRank(cls, slot) {
  const skill = cls.skills[slot];
  const saved = prog[cls.id] && prog[cls.id][slot];
  return typeof saved === 'number' ? saved : (skill.start || 0);
}

// The rank of a skill right now. A skill without progression always counts as rank 1.
// While a trial for a skill is running the skill is lent at rank 1 at least, so a locked skill can be tried out.
export function rankOf(slot, cls = CL) {
  const skill = cls.skills[slot];
  if (!skill || !skill.lv) return 1;
  const saved = savedRank(cls, slot);
  const t = chal.cur;
  const lent = t && t.trial && t.cls === cls.id && t.slot === slot;
  return lent ? Math.max(1, saved) : saved;
}

// Has a sword style been unlocked? It also counts as unlocked while its own trial is running, so the trial can teach it.
export function styleUnlocked(id) {
  if (SHOW_LIT) return true;
  if (prog._styles && prog._styles[id]) return true;
  const t = chal.cur;
  return !!(t && t.trial && t.style === id);
}
// The sword styles a class can unlock, each with its trial. blocked = the name of a skill that has to be learned first.
export function styleList(cls = CL) {
  const out = [];
  for (const t of cls.trials || []) {
    if (!t.style) continue;
    let blocked = null;
    for (const slot in t.needs || {}) {
      if (savedRank(cls, slot) < t.needs[slot]) blocked = cls.skills[slot].n;
    }
    out.push({ st: STYLES[t.style], trial: t, unlocked: !!(prog._styles && prog._styles[t.style]), blocked });
  }
  return out;
}

let lastLockedMsg = -99;
// Called when a skill key is pressed. Returns false, with a hint, if the skill is still locked.
export function skillReady(slot) {
  if (rankOf(slot) > 0) return true;
  if (T - lastLockedMsg > 2.5) {
    lastLockedMsg = T;
    toast(`<b>${CL.skills[slot].n}</b> is locked. Press <b>G</b> next to <b>Master Sen</b> and choose <b>Train my skills</b> to start its trial.`, 3.5);
  }
  return false;
}

// Copy each skill's numbers for its current rank onto the skill, so the rest of the game just reads CL.skills.q.dmg.
export function applyRanks(cls) {
  for (const slot in cls.skills) {
    const skill = cls.skills[slot];
    if (skill.lv) Object.assign(skill, skill.lv[Math.max(1, savedRank(cls, slot)) - 1]);
  }
}

// The skills of a class that have progression, each with its rank and the next trial (null when mastered).
export function trainingList(cls = CL) {
  const out = [];
  for (const slot in cls.skills) {
    const skill = cls.skills[slot];
    if (!skill.lv) continue;
    const rank = savedRank(cls, slot);
    const next = (cls.trials || []).find(t => t.slot === slot && t.rank === rank + 1) || null;
    out.push({ slot, skill, rank, next });
  }
  return out;
}

// Begin a trial. Returns false, changing nothing, if it is not allowed right now.
export function startTrial(t) {
  const cls = CLASSES[t.cls];
  if (CL !== cls) return false;                              // only for the class being played
  if (isTuned()) return false;                               // no tuned numbers
  if (t.style) {
    if (prog._styles && prog._styles[t.style]) return false;   // already unlocked
    for (const slot in t.needs || {}) {
      if (savedRank(cls, slot) < t.needs[slot]) return false;  // needs a skill that is not learned yet
    }
  } else if (savedRank(cls, t.slot) !== t.rank - 1) return false;   // ranks are earned in order
  if (!dojo.inside) enterDojo();    // trials only happen in the training hall
  setupTrial(t);                    // build this trial's layout and enemies; also sets where the player starts
  startChallenge(t);
  chal.st = { n: 0, seen: new Set(), count: 0, target: null };
  for (const k in P.cd) P.cd[k] = 0;
  // Say plainly that a locked skill works during its own trial.
  if (t.slot && t.rank === 1) toast(`<b>${cls.skills[t.slot].n}</b> is lent to you for this trial. Use it with <b>${KEY_NAME[t.slot]}</b>.`, 6);
  return true;
}

// Asked by hitDummy before any damage: may the current attack hurt dummies during this trial?
export function hitAllowed() {
  const t = chal.cur;
  return !(t && t.trial && t.allow && !t.allow.includes(hitSrc));
}
// Told by hitDummy about every hit that landed. ev = { d, dmg, src, ko, targetAir, interrupted }.
export function onHit(ev) {
  const t = chal.cur;
  if (!t || !t.trial || chal.phase !== 'run') return;
  if (t.onHit) t.onHit(chal.st, ev);
  else if (t.count) countHit(t, chal.st, ev);
}
// A trial written as data. First the hit has to pass the trial's filters:
//   by    = the hit source it must come from ('q' 'e' 'r' 'f' = that skill, 'chain' = Thunder's jump).
//   only  = the type of dummy it must land on ('flying', 'fighter'...).
//   when  = 'interrupt': it must have broken a fighter's wind-up.
//   under = the sword style that must be in use.
// Then `count` says what a hit that passes adds to the progress (st.n):
//   'hits'    = 1.                         'damage' = the damage it did.
//   'kos'     = 1 if it knocked the dummy out.
//   'biggest' = the progress is the biggest single hit so far.
//   'targets' = the progress is how many different dummies have been hit during the trial.
//   'most'    = the progress is the most different dummies hit by ONE use of the skill (P.castN tells uses apart).
function countHit(t, st, ev) {
  if (t.by && ev.src !== t.by) return;
  if (t.only && ev.d.type !== t.only) return;
  if (t.when === 'interrupt' && !ev.interrupted) return;
  if (t.under && !(style.cur && style.cur.id === t.under)) return;
  if (t.count === 'hits') st.n++;
  else if (t.count === 'damage') st.n += ev.dmg;
  else if (t.count === 'kos') st.n += ev.ko ? 1 : 0;
  else if (t.count === 'biggest') st.n = Math.max(st.n, ev.dmg);
  else if (t.count === 'targets') {
    st.seen.add(ev.d);
    st.n = st.seen.size;
  } else if (t.count === 'most') {
    if (st.cast !== P.castN) {
      st.cast = P.castN;
      st.seen = new Set();
    }
    st.seen.add(ev.d);
    st.n = Math.max(st.n, st.seen.size);
  }
}

function failTrial(why) {
  centerMsg(`Trial failed<small>${why}</small>`, 2.2);
  endChallenge();
}
function passTrial(t) {
  const cls = CLASSES[t.cls];
  if (t.style) {
    if (!prog._styles) prog._styles = {};
    prog._styles[t.style] = 1;
    store();
    endChallenge();
    const st = STYLES[t.style];
    centerMsg(`${st.name} style unlocked<small>${styleHow(st.id)} to take it</small>`, 4);
  } else {
    const skill = cls.skills[t.slot];
    if (!prog[cls.id]) prog[cls.id] = {};
    prog[cls.id][t.slot] = t.rank;
    store();
    endChallenge();
    applyRanks(cls);
    const title = t.rank === 1 ? `${skill.n} learned` : `${skill.n} ${ROMAN[t.rank]}`;
    centerMsg(`${title}<small>${skill.perks[t.rank - 1]}</small>`, 4);
  }
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.5, 6, 0.6, 0xffd23f);
  burst(_fx.setY(P.pos.y + 1), 30, 12);
}
// Once per frame while a trial runs (called by updateChallenge): show time and progress, then decide the outcome.
export function updateTrial(t, dt) {
  const st = chal.st;
  if (t.tick) t.tick(st, dt);
  if (t.count === 'burning') st.n = dojo.spawned.filter(d => d.burnT > 0 && !d.dead).length;    // how many are on fire right now
  const left = t.time - chal.t;
  const shown = Math.min(Math.floor(st.n), t.goal);
  chalEl.innerHTML = `${t.name}<div class="tm">${Math.max(0, left).toFixed(1)}</div><small>${t.desc}<br>${shown} / ${t.goal}</small>`;
  if (st.n >= t.goal) passTrial(t);
  else if (isTuned()) failTrial('Tuning was changed');
  else if (left <= 0) failTrial('Out of time');
}

// ---------- testing tools (buttons in the tuning panel) ----------
// Give every skill of every class its top rank, and unlock every sword style.
export function unlockAll() {
  prog._styles = {};
  for (const id in STYLES) prog._styles[id] = 1;
  for (const id in CLASSES) {
    for (const slot in CLASSES[id].skills) {
      if (!CLASSES[id].skills[slot].lv) continue;
      if (!prog[id]) prog[id] = {};
      prog[id][slot] = MAX_RANK;
    }
    applyRanks(CLASSES[id]);
  }
  store();
}
// Forget all progress: every skill goes back to its starting rank.
export function resetProgress() {
  prog = {};
  for (const id in CLASSES) applyRanks(CLASSES[id]);
  store();
}

// The three sword style trials of a class that does not list its own. They ask for the same things whatever
// the class, because what they test is the style itself: Water's hits, Flame's burning, Thunder's jumps. Each
// needs the skill that takes the style to be learned first (R in a pool, Q into a fire, E in a storm).
function commonStyleTrials(cls) {
  const S = cls.skills;
  return [
    { id: cls.id + '-water', style: 'water', needs: { r: 1 }, name: 'Trial: Water style', time: 60, goal: 12, count: 'hits', under: 'water',
      desc: `Use ${S.r.n} while standing in the pool to take Water, then land 12 hits before it runs out`,
      arena: { sources: [['water', 0, 9]], spawn: [['basic', -2.5, 0, -3], ['basic', 0, 0, -3], ['basic', 2.5, 0, -3]] } },
    { id: cls.id + '-flame', style: 'flame', needs: { q: 1 }, name: 'Trial: Flame style', time: 60, goal: 3, count: 'burning',
      desc: `Lock on to the fire and use ${S.q.n} to take Flame, then have 3 dummies burning at the same time`,
      arena: { sources: [['flame', 0, 12]], spawn: [['basic', -5, 0, -3], ['basic', 0, 0, -6], ['basic', 5, 0, -3]] } },
    { id: cls.id + '-thunder', style: 'thunder', needs: { e: 1 }, name: 'Trial: Thunder style', time: 60, goal: 6, count: 'hits', by: 'chain',
      desc: `Use ${S.e.n} inside the storm to take Thunder, then make lightning jump between enemies 6 times`,
      arena: { sources: [['thunder', 0, 10]], spawn: [['basic', -2, 0, -3], ['basic', 2, 0, -3], ['basic', -2, 0, -7], ['basic', 2, 0, -7]] } },
  ];
}

// Called once from main.js after the class files have loaded, and before the tuning panel reads the class numbers.
export function initProgress() {
  if (!SMOKE) {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && typeof s === 'object') prog = s;
    } catch (e) {}
  }
  for (const id in CLASSES) {
    const cls = CLASSES[id];
    const ranked = Object.values(cls.skills).some(skill => skill.lv);
    if (ranked && !(cls.trials || []).some(t => t.style)) cls.trials = [...commonStyleTrials(cls), ...(cls.trials || [])];
    for (const t of cls.trials || []) { t.cls = id; t.trial = true; }
    applyRanks(cls);
  }
}
