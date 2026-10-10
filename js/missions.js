// missions.js: the campaign. The city has five districts, each held by one of the Ash Hand's lieutenants, and the
// purpose of the game is to take them back one by one. A district is a mission: a separate walled area (like the
// training hall) fought through in stages, with a boss at the end. Being defeated fails the mission.
// Stages are built so that each one leans on a different tool: the grappling hook (a point high up to reach),
// a mount (barricades only ramming breaks), and the sword styles (enemies that are weak to one element; the
// colour of their headband says which).
// DISTRICTS is the whole campaign as data. A district without `stages` is not built yet and shows as such on the map.
// Owns: which districts are free (saved in the browser), the running mission, its enemies and its marker.
// Used by: master.js (the city map in Sen's menu), hud.js (the stage shown on screen), update.js (updateMissions
// every frame, the P key), player.js (failMission on defeat), tuning.js (campaignHp, resetCampaign), quests.js.

import * as THREE from 'three';
import { V3, _fx } from './util.js';
import { scene } from './core.js';
import { addBox, setArea, makeFloor, ARENA, COL } from './world.js';
import { glowTex, ringGeo, spawnRing, burst, toast, centerMsg, flash } from './fx.js';
import { T, P, CL, SPAWN, chal } from './state.js';
import { spawnDummy, removeDummy, dummyBlocked } from './dummies.js';
import { respawnPlayer } from './player.js';
import { addSource } from './styles.js';
import { story } from './quests.js';
import { applyTune } from './tuning.js';
import { dojo } from './dojo.js';

const STORE_KEY = 'stickblade.campaign.v1';
// The smoke test starts from nothing and never writes, so running it cannot touch a real save.
const SMOKE = new URLSearchParams(location.search).get('debug') === 'smoke';
const YARD_SPAWN = SPAWN.clone();    // where the player starts in the main arena, to go back to
const HP_PER_DISTRICT = 20;          // extra maximum health for every district freed
const STAGE_HEAL = 0.35;             // share of full health given back when a stage is cleared
export const MISSION_REGEN = 0.25;   // health comes back this much slower during a mission, so damage adds up
const STAGE_PAUSE = 1.6;             // seconds between clearing a stage and the next one starting
const LEAVE_PAUSE = 3.5;             // seconds in the freed district before going home

// The Ash Hand's fighters. All are built on the 'fighter' dummy (a slam up close, a lunge from further away).
// hp = health, speed = walking speed (the player runs at 9.5), size = how big, weak = the sword style that hurts
// them most. An enemy with a weakness takes only 60% from everything else, so bringing the right element matters.
const THUG = { gang: true, hp: 240, color: 0x5a5a66 };                                                  // plain: no weakness
const RUNNER = { gang: true, hp: 170, color: 0x6a6440, weak: 'thunder', speed: 8.5, size: 0.92 };       // fast: lightning pins it down
const IRON = { gang: true, hp: 420, color: 0x3f444e, weak: 'flame', speed: 3.6, size: 1.14 };           // armoured: fire gets through
const RAT = { gang: true, hp: 95, color: 0x44566a, weak: 'water', speed: 6.2, size: 0.82 };             // small and many: water gathers them
// A wall of planks. Stands still, ignores swords and skills, and breaks only when a mount runs into it
// (the elephant in one go, the others in two or three). Built on the 'basic' dummy.
const BARRICADE = { gang: true, hp: 60, look: 'barricade', fixed: true, ramOnly: true };
const MARROW = { gang: true, boss: true, hp: 1500, color: 0x33283a };

// The campaign, in order. A district is open once the one before it is free (the first needs `needs`, a story task).
//   area   = where it is: centre and half-width of its square. Far from everything else, so fog hides the rest.
//   floor  = colour of its ground.   start = where the player arrives (all coordinates are relative to the centre).
//   props  = its boxes: [x, y, z, w, h, d, colour name], as in addBox.   sources = [style id, x, z]: a pool, a fire, a storm.
//   stages = what has to be done, in order. Each: goal (shown on screen), hint (how), and either
//       spawn = enemies as [type, x, y, z, options]: the stage is cleared when all of them are down, or
//       point = [x, y, z], a place to stand on: the stage is cleared on reaching it.
//     reinforce = { at, spawn, say }: when the stage's boss falls to this share of its health, more enemies arrive.
export const DISTRICTS = [
  {
    id: 'docks', name: 'The Docks', boss: 'Marrow', needs: 'c1-rook',
    blurb: 'Where the Hand lands its goods. A crane to hook up, barricades to ride through, and armour that fire gets through.',
    area: { cx: -300, cz: 0, half: 40 }, floor: 0x9a8670, start: [0, 0, 34],
    props: [
      // stacks of cargo for cover
      [-16, 0, 18, 6, 3, 6, 'crate'], [15, 0, 17, 5, 5, 5, 'crate'], [-24, 0, 2, 8, 4, 4, 'crate'], [0, 0, 16, 3, 2, 3, 'crate'],
      [-9, 0, -14, 10, 3, 3, 'plat'], [11, 0, -16, 3, 7, 3, 'pillar'], [-28, 0, -24, 6, 8, 6, 'stone'], [28, 0, -24, 6, 10, 6, 'stone'],
      // the crane: a tall tower with a jib, too high to jump (the hook gets you up)
      [26, 0, 8, 4, 17, 4, 'pillar'], [20, 16.2, 8, 10, 0.8, 3, 'plat'],
    ],
    sources: [['water', -15, 30], ['flame', 15, 30], ['thunder', 0, 24]],
    stages: [
      { goal: 'Break through the gate', hint: 'The yellow bands are fast. Lightning stuns them',
        spawn: [['fighter', -7, 0, 10, THUG], ['fighter', 7, 0, 10, THUG], ['fighter', -16, 0, 9, THUG], ['fighter', -4, 0, -2, RUNNER], ['fighter', 5, 0, -3, RUNNER]] },
      { goal: 'Hook up the crane and cut the alarm', hint: 'Aim at the tower and hold the right mouse button',
        point: [26, 17, 8] },
      { goal: 'Ram the barricades', hint: 'Press X for a mount and ride into them. Orange bands are armoured: bring fire',
        spawn: [['basic', -12, 0, -6, BARRICADE], ['basic', 0, 0, -6, BARRICADE], ['basic', 12, 0, -6, BARRICADE], ['fighter', -6, 0, -10, IRON], ['fighter', 7, 0, -10, IRON]] },
      { goal: 'Clear the dock rats', hint: 'Blue bands come in swarms. Water gathers them up',
        spawn: [['fighter', -4, 0, -4, RAT], ['fighter', 4, 0, -4, RAT], ['fighter', -18, 0, -10, RAT], ['fighter', 18, 0, -10, RAT], ['fighter', 0, 0, -20, RAT], ['fighter', -6, 0, -22, RAT], ['fighter', 6, 0, -22, RAT]] },
      { goal: 'Defeat Marrow', hint: 'He runs the docks. Watch the red on the ground',
        spawn: [['fighter', 0, 0, -30, MARROW], ['fighter', -8, 0, -28, THUG], ['fighter', 8, 0, -28, THUG]],
        reinforce: { at: 0.5, say: '"Get out here, all of you!"', spawn: [['fighter', -20, 0, -31, RUNNER], ['fighter', 20, 0, -32, RUNNER], ['fighter', 0, 0, -36, IRON]] } },
    ],
  },
  { id: 'market', name: 'The Old Market', boss: 'the Twins', blurb: 'Narrow lanes below and rooftops above. Swarms in the alleys, and a chase across the roofs with the hook.' },
  { id: 'foundry', name: 'The Foundry', boss: 'Cinder', blurb: 'Furnaces and armour. Fire feeds half of what is in there; water and a war elephant open the rest.' },
  { id: 'heights', name: 'The Heights', boss: 'Lady Vane', blurb: 'Towers and bridges. Nothing there can be reached on foot, and nothing there stands still for long.' },
  { id: 'citadel', name: 'The Ash Citadel', boss: 'the Ash King', blurb: 'Where it ends. Everything the Hand has left, and the man Sen once answered to.' },
];

// campaign.free = ids of the districts taken back.
export const campaign = { free: [] };
// The running mission: cur = its district (null in the yard), stage = which stage, spawned = its enemies,
// wait = seconds until the next thing happens (the next stage, or going home), won = it is finished and only
// waiting to leave, reinforced = this stage's extra enemies have already come.
export const mission = { cur: null, stage: 0, spawned: [], wait: 0, won: false, reinforced: false };

function store() {
  if (SMOKE) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(campaign)); } catch (e) {}
}
const districtById = id => DISTRICTS.find(d => d.id === id) || null;
export const isFree = id => campaign.free.includes(id);
// Extra maximum health earned by freeing districts (added in applyTune, tuning.js).
export const campaignHp = () => campaign.free.length * HP_PER_DISTRICT;

// ---------- the marker ----------
// A gold beacon standing on the place a stage wants the player to reach: a ring and a tall soft beam.
const marker = new THREE.Group();
{
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  ring.scale.setScalar(1.6);
  ring.position.y = 0.06;
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd23f, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  beam.scale.set(2.2, 14, 1);
  beam.position.y = 6;
  marker.add(ring, beam);
  marker.visible = false;
  scene.add(marker);
}

// ---------- the map ----------
// Every district with where it stands, for Sen's menu:
//   built = it can be played.  free = it has been taken back.  open = it can be started now.
//   why = what is missing when it is not open.
export function districtList() {
  return DISTRICTS.map((d, i) => {
    const built = !!d.stages;
    const before = i > 0 ? DISTRICTS[i - 1] : null;
    let why = null;
    if (!built) why = 'Not reachable yet';
    else if (CL.id !== 'blade') why = 'The campaign is fought as the Blademaster';
    else if (before && !isFree(before.id)) why = `Free ${before.name} first`;
    else if (d.needs && !story.done.includes(d.needs)) why = 'Finish what Master Sen has asked of you first';
    return { d, built, free: isFree(d.id), open: !why, why };
  });
}

// ---------- enemies ----------
const _spot = new V3();
// Put one enemy into the running mission. Coordinates are relative to the district's centre. If the spot is
// inside a box, the nearest free spot around it is used.
function place(type, x, y, z, options) {
  const a = mission.cur.area;
  for (const [ox, oz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3], [3, -3], [-3, 3]]) {
    _spot.set(a.cx + x + ox, y, a.cz + z + oz);
    if (!dummyBlocked(_spot)) break;
  }
  const d = spawnDummy(type, _spot.x, y, _spot.z, { ...options, zone: a });
  mission.spawned.push(d);
  spawnRing(_fx.copy(d.pos).setY(d.pos.y + 0.05), 0.2, 2.6, 0.5, 0xc22a2a);
  return d;
}
function despawnAll() {
  for (const d of mission.spawned) {
    if (!d.removed) removeDummy(d);
  }
  mission.spawned.length = 0;
}

// ---------- running a mission ----------
// The "teleport": effects where the player leaves, the move itself, effects where they arrive.
function travel(area, spot) {
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.3, 4.5, 0.5, 0xffd23f);
  burst(_fx.setY(P.pos.y + 1), 26, 9);
  SPAWN.copy(spot);
  setArea(area.cx, area.cz, area.half);
  respawnPlayer();    // moves to SPAWN, full health, and ends any sword style
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.3, 4.5, 0.6, 0xffd23f);
  flash();
}
// Go to a district and begin. Returns false, changing nothing, if that is not possible right now.
// force = start it even if it is still locked (testing only: ?debug=mission:docks).
export function startMission(id, force = false) {
  const entry = districtList().find(e => e.d.id === id);
  if (!entry || !entry.built || (!entry.open && !force) || mission.cur || dojo.inside || chal.cur) return false;
  const d = entry.d;
  mission.cur = d;
  mission.won = false;
  travel(d.area, _spot.set(d.area.cx + d.start[0], d.start[1], d.area.cz + d.start[2]));
  beginStage(0);
  toast(`<b>${d.name}</b> · held by <b>${d.boss}</b>. If you fall, the mission is lost. <b>P</b> gives up.`, 6);
  return true;
}
function beginStage(index) {
  const d = mission.cur, stage = d.stages[index];
  mission.stage = index;
  mission.wait = 0;
  mission.reinforced = false;
  despawnAll();
  for (const [type, x, y, z, options] of stage.spawn || []) place(type, x, y, z, options);
  marker.visible = !!stage.point;
  if (stage.point) marker.position.set(d.area.cx + stage.point[0], stage.point[1], d.area.cz + stage.point[2]);
  centerMsg(`${stage.goal}<small>${d.name} · ${index + 1} of ${d.stages.length}</small>`, 2.4);
}
// Has the current stage been done?
function stageCleared() {
  const d = mission.cur, stage = d.stages[mission.stage];
  if (stage.point) {
    const dx = P.pos.x - (d.area.cx + stage.point[0]), dz = P.pos.z - (d.area.cz + stage.point[2]);
    return P.grounded && Math.hypot(dx, dz) < 2.6 && Math.abs(P.pos.y - stage.point[1]) < 1.5;
  }
  return mission.spawned.every(e => e.dead);
}
// Leave the district for the yard. Does not move the player: the caller respawns them.
function goHome() {
  despawnAll();
  marker.visible = false;
  mission.cur = null;
  mission.won = false;
  setArea(0, 0, ARENA);
  SPAWN.copy(YARD_SPAWN);
}
// The mission is lost (the player was defeated). Returns true if there was one. The caller respawns the player.
export function failMission() {
  if (!mission.cur) return false;
  goHome();
  return true;
}
// The P key: walk away from a mission.
export function abandonMission() {
  if (!mission.cur) return;
  goHome();
  respawnPlayer();
  flash();
  centerMsg('Mission abandoned', 1.6);
}
function winMission() {
  const d = mission.cur;
  const first = !isFree(d.id);
  if (first) {
    campaign.free.push(d.id);
    store();
    applyTune();    // the extra maximum health takes effect at once
  }
  P.hp = P.maxHp;
  mission.won = true;
  mission.wait = LEAVE_PAUSE;
  marker.visible = false;
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.5, 8, 0.8, 0xffd23f);
  burst(_fx.setY(P.pos.y + 1), 40, 14);
  centerMsg(`${d.name} is free<small>${first ? `+${HP_PER_DISTRICT} maximum health · ` : ''}${campaign.free.length} of ${DISTRICTS.length} districts</small>`, LEAVE_PAUSE);
}

// Once per frame (update.js, after the dummies have moved).
export function updateMissions(dt) {
  const d = mission.cur;
  if (!d) return;
  // beaten enemies that have finished falling are taken out of the world (their place in the list is kept as
  // dead, so the stage still knows they are down)
  for (const e of mission.spawned) {
    if (e.gone && !e.removed) { removeDummy(e); e.removed = true; }
  }
  if (mission.won) {
    mission.wait -= dt;
    if (mission.wait <= 0) {
      goHome();
      respawnPlayer();
      flash();
      toast('Back in the yard. Tell <b>Master Sen</b>.', 4);
    }
    return;
  }
  const stage = d.stages[mission.stage];
  marker.rotation.y = T * 1.5;
  // the boss calls for help once, when hurt enough
  if (stage.reinforce && !mission.reinforced) {
    const boss = mission.spawned.find(e => e.boss);
    if (boss && !boss.dead && boss.hp <= boss.maxHp * stage.reinforce.at) {
      mission.reinforced = true;
      for (const [type, x, y, z, options] of stage.reinforce.spawn) place(type, x, y, z, options);
      centerMsg(`${stage.reinforce.say}<small>${d.boss}</small>`, 2);
    }
  }
  if (mission.wait > 0) {
    // between stages
    mission.wait -= dt;
    if (mission.wait <= 0) beginStage(mission.stage + 1);
    return;
  }
  if (!stageCleared()) return;
  if (mission.stage === d.stages.length - 1) { winMission(); return; }
  P.hp = Math.min(P.maxHp, P.hp + P.maxHp * STAGE_HEAL);
  mission.wait = STAGE_PAUSE;
  marker.visible = false;
  centerMsg('Stage clear', 1.2);
}

// The mission shown on screen (hud.js), as HTML. null = no mission is running.
export function missionLine() {
  const d = mission.cur;
  if (!d) return null;
  if (mission.won) return `<small>${d.name.toUpperCase()}</small><b>The district is free</b><span class="ok">Heading home</span>`;
  const stage = d.stages[mission.stage];
  const left = mission.spawned.filter(e => !e.dead).length;
  const count = stage.spawn ? ` · ${left} left` : '';
  return `<small>${d.name.toUpperCase()} · ${mission.stage + 1} / ${d.stages.length}</small><b>${stage.goal}${count}</b><span>${stage.hint}</span>`;
}

// Testing tool (the "Reset progress" button in the tuning panel): every district goes back to the Hand.
export function resetCampaign() {
  if (mission.cur) abandonMission();
  campaign.free.length = 0;
  store();
  applyTune();
}

// Called once from main.js: load which districts are free, and build every district that has stages (its
// floor, walls, boxes, and its pool, fire and storm). They stand far away and are never removed.
export function initMissions() {
  if (!SMOKE) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && Array.isArray(saved.free)) campaign.free = saved.free.filter(id => districtById(id));
    } catch (e) {}
  }
  for (const d of DISTRICTS) {
    if (!d.stages) continue;
    const a = d.area, size = a.half * 2, edge = a.half + 0.5;
    const floor = makeFloor(size + 2, d.floor);
    floor.position.set(a.cx, 0, a.cz);
    scene.add(floor);
    addBox(a.cx, 0, a.cz - edge, size + 2, 9, 1, COL.wall);
    addBox(a.cx, 0, a.cz + edge, size + 2, 9, 1, COL.wall);
    addBox(a.cx - edge, 0, a.cz, 1, 9, size, COL.wall);
    addBox(a.cx + edge, 0, a.cz, 1, 9, size, COL.wall);
    for (const [x, y, z, w, h, depth, col] of d.props) addBox(a.cx + x, y, a.cz + z, w, h, depth, COL[col] || COL.stone);
    for (const [id, x, z] of d.sources) addSource(id, a.cx + x, 0, a.cz + z);
  }
}
