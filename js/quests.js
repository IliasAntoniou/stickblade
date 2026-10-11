// quests.js: the story. Master Sen is an ex-convict who left his gang, the Ash Hand, and now recruits and trains
// people to bring it down. The story is a chain of tasks he hands out one at a time, grouped into chapters.
// QUESTS is the whole story as data: what he says, what the task is, how it is counted, which enemies it brings.
// A task goes through four steps: he offers it (in his menu, master.js) > the player takes it > the goal is
// met (counted here) > the player goes back and tells him, which unlocks the next one.
// Owns: which tasks are done (saved in the browser), the running task's progress, and the gang enemies a task spawns.
// Used by: master.js (the story card and page), hud.js (the task shown on screen), dummies.js and player.js
// (which report knockouts and defeats), update.js (updateQuests every frame), tuning.js (Reset progress).
// The story is only told with the Blademaster for now: with any other class it is paused.

import { _fx } from './util.js';
import { toast, centerMsg, spawnRing, burst } from './fx.js';
import { P, CL, CLASSES } from './state.js';
import { spawnDummy, removeDummy } from './dummies.js';
import { trainingList } from './progress.js';
import { isFree } from './missions.js';

const STORE_KEY = 'stickblade.story.v1';
// The smoke test starts from nothing and never writes, so running it cannot touch a real save.
const SMOKE = new URLSearchParams(location.search).get('debug') === 'smoke';
const STORY_CLASS = 'blade';

export const CHAPTERS = { 1: 'The Recruit', 2: 'The Docks' };

// What the gang's fighters are made of. All are built on the 'fighter' dummy (same attacks: a slam up close, a
// lunge from further away) with less health than a training fighter, because several come at once.
// hp = health, color = body colour. Rook is the first boss: `boss` makes him bigger and dresses him heavier.
const SCOUT = { gang: true, hp: 240, color: 0x5a5a66 };
const ROOK = { gang: true, boss: true, hp: 800, color: 0x3d3038 };

// The story, in order. Each task:
//   id      = its name in the save file. Never change one that has shipped, or saved progress is lost.
//   chapter = which chapter it belongs to (a key of CHAPTERS).
//   name    = its title.   intro = what Sen says when he gives it.   outro = what he says when it is done.
//   goal    = the task in a few words, shown on screen.   need = how many it takes.
//   Counting, one of:
//     event + match = count things that happen. event 'ko' = a dummy or enemy was knocked out; match(ev) says
//                     whether this one counts (ev.d is the dummy).
//     check         = a test run every frame; the task is done the moment it returns true.
//   spawn   = enemies that appear when the task is taken: [type, x, y, z, options], in arena coordinates.
//             They stay dead when beaten. If the player is defeated, the whole group comes back and the count restarts.
export const QUESTS = [
  {
    id: 'c1-hits', chapter: 1, name: 'Show me',
    intro: 'Eleven years I sat in Blackgate for the Ash Hand. I was one of them. Now I mean to bury them, and I cannot do it alone. Before I waste a word on you: show me you can hit.',
    goal: 'Knock out 3 practice dummies', need: 3,
    event: 'ko', match: ev => ev.d.type === 'basic' && !ev.d.gang,
    outro: 'Clumsy. But you hit like you mean it. The Hand will not stand still for you the way straw does.',
  },
  {
    id: 'c1-climb', chapter: 1, name: 'High ground',
    intro: 'The Hand owns the rooftops of this city. They watch from above and they drop on you. I will not train someone who lives on the ground. Get up on the rocks. High.',
    goal: 'Stand on something at least 12 high', need: 1,
    check: () => P.grounded && P.pos.y >= 12,
    outro: 'Good. From up there you saw the whole yard. Remember that: whoever is higher chooses when the fight starts.',
  },
  {
    id: 'c1-learn', chapter: 1, name: 'A real technique',
    intro: 'Swinging a sword is not a technique. In the yard at Blackgate I had eleven years and nothing to do but perfect three of them. Come to the hall and earn one.',
    goal: 'Learn a new skill in the training hall', need: 1,
    // any skill that starts locked and has since been learned
    check: () => trainingList(CLASSES[STORY_CLASS]).some(({ skill, rank }) => skill.start === 0 && rank > 0),
    outro: 'Now you are worth something. And not a day too soon. Somebody has been asking about me in the lower city.',
  },
  {
    id: 'c1-scouts', chapter: 1, name: 'They found us',
    intro: 'Word travels. The Hand has sent scouts to see who old Sen is training. Grey coats, red masks. If one of them walks home, the next visit is fifty men. None of them walks home.',
    goal: 'Defeat the Ash Hand scouts', need: 4,
    event: 'ko', match: ev => ev.d.gang,
    spawn: [
      ['fighter', -30, 0, -30, SCOUT], ['fighter', 30, 0, -28, SCOUT],
      ['fighter', -45, 0, 5, SCOUT], ['fighter', 45, 0, -10, SCOUT],
    ],
    outro: 'Four scouts do not come alone. Somebody led them here, and I know the way he walks.',
  },
  {
    id: 'c1-rook', chapter: 1, name: 'Rook',
    intro: 'Rook. We shared a cell for six years. I taught him the slam he is about to use on you, so watch the red on the ground and do not be standing in it. Put him down.',
    goal: 'Defeat Rook and his two men', need: 3,
    event: 'ko', match: ev => ev.d.gang,
    spawn: [
      ['fighter', 0, 0, -36, ROOK],
      ['fighter', -8, 0, -34, SCOUT], ['fighter', 8, 0, -34, SCOUT],
    ],
    outro: 'He was the best of them once. So was I. You are one of mine now, recruit. Rest. Next we go to them: the Hand runs the docks, and that is where we start cutting.',
  },
  {
    id: 'c2-docks', chapter: 2, name: 'Take the docks',
    intro: 'Everything the Hand owns comes in by water. Marrow keeps the docks for them: a butcher, and patient. Take the docks and they starve. Ask me about the city when you are ready. And listen: out there I cannot drag you home in one piece twice.',
    goal: 'Free the docks (choose "The city" in his menu)', need: 1,
    check: () => isFree('docks'),
    outro: 'Marrow is done, and the dockers are ours. Four districts left. They know now that I am not hiding, and they know your face. Good. Let them lose sleep.',
  },
];

// story.done = ids of finished tasks. story.cur = id of the task being done (null between tasks). story.n = its count.
export const story = { done: [], cur: null, n: 0 };
// The gang members the running task has put in the world, and which task they belong to.
const spawned = [];
let spawnedFor = null;

function store() {
  if (SMOKE) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(story)); } catch (e) {}
}
const questById = id => QUESTS.find(q => q.id === id) || null;

// Where the story stands right now. phase is one of:
//   'none'   = paused: the class being played is not the one the story is told with
//   'offer'  = Sen has a task waiting (quest)        'active' = the player is doing it (n of quest.need)
//   'ready'  = the goal is met; tell Sen             'end'    = every task written so far is done
export function questState() {
  if (!CL || CL.id !== STORY_CLASS) return { phase: 'none', quest: null, n: 0 };
  const running = questById(story.cur);
  if (running) return { phase: story.n >= running.need ? 'ready' : 'active', quest: running, n: story.n };
  const next = QUESTS.find(q => !story.done.includes(q.id));
  return { phase: next ? 'offer' : 'end', quest: next || null, n: 0 };
}

// Take the task Sen is offering. Its enemies, if it has any, appear at once.
export function acceptQuest() {
  const { phase, quest } = questState();
  if (phase !== 'offer') return false;
  story.cur = quest.id;
  story.n = 0;
  store();
  toast(`<b>New task:</b> ${quest.goal}`, 5);
  syncEnemies();
  return true;
}

// Tell Sen the task is done. Returns the finished task (master.js shows its outro), or null if there was nothing to report.
export function turnInQuest() {
  const { phase, quest } = questState();
  if (phase !== 'ready') return null;
  story.done.push(quest.id);
  story.cur = null;
  story.n = 0;
  store();
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.5, 6, 0.6, 0xffd23f);
  burst(_fx.setY(P.pos.y + 1), 30, 12);
  // the last task of a chapter: say so
  const next = QUESTS.find(q => !story.done.includes(q.id));
  if (!next || next.chapter !== quest.chapter) {
    centerMsg(`Chapter ${quest.chapter} complete<small>${CHAPTERS[quest.chapter]}</small>`, 4);
  }
  return quest;
}

// Add to the running task's count, and say so when that finishes it.
function advance(amount) {
  const quest = questById(story.cur);
  const wasDone = story.n >= quest.need;
  story.n = Math.min(quest.need, story.n + amount);
  store();
  if (!wasDone && story.n >= quest.need) toast(`<b>${quest.name}</b> · done. Go back and tell <b>Master Sen</b>.`, 6);
}

// Told about things that happen in the game. type 'ko' = a dummy was knocked out (ev.d). type 'defeated' = the
// player's health ran out.
export function questEvent(type, ev) {
  const { phase, quest } = questState();
  if (phase !== 'active') return;
  if (type === 'defeated') {
    // Losing to a task's enemies undoes it: they all come back at full strength (updateQuests spawns them again).
    if (!quest.spawn) return;
    despawn();
    story.n = 0;
    store();
    toast('The Ash Hand regroups. Their numbers are full again.', 4);
    return;
  }
  if (quest.event === type && (!quest.match || quest.match(ev))) advance(1);
}

// Take every gang member the story spawned out of the world.
function despawn() {
  for (const d of spawned) removeDummy(d);
  spawned.length = 0;
  spawnedFor = null;
}
// Make the gang members in the world match the running task: spawn its group when it starts (or when the game
// is loaded with it running, or after a defeat), and remove them when there is no task for them any more.
// A fresh group always restarts the count, since the ones already beaten are back.
function syncEnemies() {
  const { phase, quest } = questState();
  const wanted = (phase === 'active' || phase === 'ready') && quest.spawn;
  if (!wanted) {
    if (spawnedFor) despawn();
    return;
  }
  if (phase !== 'active' || spawnedFor === quest.id) return;
  despawn();
  for (const [type, x, y, z, options] of quest.spawn) {
    const d = spawnDummy(type, x, y, z, options);
    spawned.push(d);
    spawnRing(_fx.copy(d.pos).setY(d.pos.y + 0.05), 0.2, 2.6, 0.5, 0xc22a2a);
  }
  spawnedFor = quest.id;
  story.n = 0;
}

// Once per frame (update.js, after the dummies have moved).
export function updateQuests() {
  // A beaten gang member has finished falling: take it out of the world for good.
  for (let i = spawned.length - 1; i >= 0; i--) {
    if (!spawned[i].gone) continue;
    removeDummy(spawned[i]);
    spawned.splice(i, 1);
  }
  syncEnemies();
  const { phase, quest } = questState();
  if (phase === 'active' && quest.check && quest.check()) advance(quest.need);
}

// The task shown on screen (hud.js), as HTML. null = show nothing.
export function questLine() {
  const { phase, quest, n } = questState();
  if (phase === 'none' || phase === 'end') return null;
  if (phase === 'offer') {
    const first = story.done.length === 0;
    return `<small>STORY</small><b>${first ? 'Talk to Master Sen' : 'Master Sen has a task for you'}</b><span>Press G next to him and choose the story</span>`;
  }
  const head = `<small>CHAPTER ${quest.chapter} · ${CHAPTERS[quest.chapter].toUpperCase()}</small><b>${quest.name}</b>`;
  if (phase === 'ready') return `${head}<span class="ok">Done. Go back and tell Master Sen</span>`;
  const count = quest.need > 1 ? ` · ${n} / ${quest.need}` : '';
  return `${head}<span>${quest.goal}${count}</span>`;
}

// Testing tool (the "Reset progress" button in the tuning panel): start the story again from its first task.
export function resetStory() {
  despawn();
  story.done.length = 0;
  story.cur = null;
  story.n = 0;
  store();
}

// Called once from main.js: load the saved story. Tasks that no longer exist are dropped.
export function initStory() {
  if (SMOKE) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!saved || typeof saved !== 'object') return;
    if (Array.isArray(saved.done)) story.done = saved.done.filter(id => questById(id));
    if (questById(saved.cur) && !story.done.includes(saved.cur)) {
      story.cur = saved.cur;
      story.n = typeof saved.n === 'number' ? saved.n : 0;
    }
  } catch (e) {}
}
