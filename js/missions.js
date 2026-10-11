// missions.js: the campaign. The city has five districts, each held by one of the Ash Hand's lieutenants, and the
// purpose of the game is to take them back one by one. A district is a mission: a separate walled area (like the
// training hall) fought through in stages, with a boss at the end. Being defeated fails the mission.
// Districts are not all the same kind of place. The docks are a yard fought through stage by stage. The Old
// Market is one long straight street run against the clock to save a prisoner, where the way is shut by
// curtains only a dash passes through, barricades only a mount breaks, and walls only the hook gets over.
// Stages are built so that each one leans on a different tool: the grappling hook (a point high up to reach),
// a mount (barricades only ramming breaks), and the sword styles (enemies that are weak to one element; the
// colour of their headband says which).
// DISTRICTS is the whole campaign as data. A district without `stages` is not built yet and shows as such on the map.
// Owns: which districts are free (saved in the browser), the running mission, its enemies and its marker.
// Used by: master.js (the city map in Sen's menu), hud.js (the stage shown on screen), update.js (updateMissions
// every frame, the P key), player.js (failMission on defeat), tuning.js (campaignHp, resetCampaign), quests.js.

import * as THREE from 'three';
import { V3, _fx } from './util.js';
import { makeStickman, applyPose, addRim, BASE } from './stickman.js';
import { scene } from './core.js';
import { addBox, removeBox, addPhaseWall, setArea, makeFloor, ARENA, COL } from './world.js';
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
// A barricade that also shuts the way: an unseen wall stands where it does until it is broken.
const BLOCKADE = { ...BARRICADE, block: true };
// The Twins, keepers of the Old Market. One falls to fire and one to water, so the fight asks for both.
const TWIN_EMBER = { gang: true, boss: true, hp: 800, color: 0x4a2a22, weak: 'flame', size: 0.82 };
const TWIN_TIDE = { gang: true, boss: true, hp: 800, color: 0x223a4a, weak: 'water', size: 0.82 };

// The campaign, in order. A district is open once the one before it is free (the first needs `needs`, a story task).
//   area   = where it is: centre and half-width of its square. Far from everything else, so fog hides the rest.
//            walls: false leaves out the four outer walls (for a district that builds its own shape from props).
//   gates  = curtains of light only a dash passes through: [x, z, width].
//   floor  = colour of its ground.   start = where the player arrives (all coordinates are relative to the centre).
//   props  = its boxes: [x, y, z, w, h, d, colour name], as in addBox.   sources = [style id, x, z]: a pool, a fire, a storm.
//   stages = what has to be done, in order. Each: goal (shown on screen), hint (how), and either
//       spawn = enemies as [type, x, y, z, options]: the stage is cleared when all of them are down, or
//       point = [x, y, z], a place to stand on: the stage is cleared on reaching it.
//       point and spawn together = the enemies are only in the way; reaching the point is what counts.
//     time   = seconds allowed. Run out and the mission is lost.
//     rescue = someone is held at the point, waiting to be freed (the kneeling figure).
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
  {
    id: 'market', name: 'The Old Market', boss: 'the Twins',
    blurb: 'One long street and no time. The Twins mean to hang old Tam at the far end. Dash, ride and hook your way down it before they do.',
    // A street 24 wide and 300 long, running from z = +150 (the start) down to z = -150. Nothing here is a
    // square: the outer walls are left out and the street is made of props.
    area: { cx: 0, cz: 500, half: 160, walls: false }, floor: 0x8c8478, start: [0, 0, 138],
    props: [
      // the two sides of the street, in five lengths each, and a wall across each end
      [-13, 0, 120, 2, 16, 60, 'wall'], [-13, 0, 60, 2, 16, 60, 'wall'], [-13, 0, 0, 2, 16, 60, 'wall'], [-13, 0, -60, 2, 16, 60, 'wall'], [-13, 0, -120, 2, 16, 60, 'wall'],
      [13, 0, 120, 2, 16, 60, 'wall'], [13, 0, 60, 2, 16, 60, 'wall'], [13, 0, 0, 2, 16, 60, 'wall'], [13, 0, -60, 2, 16, 60, 'wall'], [13, 0, -120, 2, 16, 60, 'wall'],
      [0, 0, 151, 28, 16, 2, 'wall'], [0, 0, -151, 28, 16, 2, 'wall'],
      // pinch points: two blocks that leave a gap 6 wide in the middle, shut by a curtain or a barricade
      [-7.5, 0, 112, 9, 14, 3, 'stone'], [7.5, 0, 112, 9, 14, 3, 'stone'],
      [-7.5, 0, 82, 9, 14, 3, 'stone'], [7.5, 0, 82, 9, 14, 3, 'stone'],
      [-7.5, 0, 18, 9, 14, 11, 'stone'], [7.5, 0, 18, 9, 14, 11, 'stone'],
      [-7.5, 0, -22, 9, 14, 3, 'stone'], [7.5, 0, -22, 9, 14, 3, 'stone'],
      [-7.5, 0, -88, 9, 14, 3, 'stone'], [7.5, 0, -88, 9, 14, 3, 'stone'],
      // walls right across the street: too high to jump, the hook gets over
      [0, 0, 52, 24, 9, 2, 'pillar'], [0, 0, -58, 24, 12, 2, 'pillar'],
      // market stalls and crates to weave round
      [6, 0, 98, 4, 2.5, 3, 'crate'], [-6, 0, 66, 3, 3, 3, 'crate'], [5, 0, 38, 4, 2, 4, 'crate'],
      [-4, 0, 0, 5, 3, 3, 'crate'], [6, 0, -40, 3, 2.5, 3, 'crate'], [-6, 0, -74, 3, 2, 3, 'crate'], [5, 0, -104, 4, 2, 3, 'crate'],
    ],
    gates: [[0, 112, 6], [0, 22, 6], [0, 14, 6], [0, -88, 6]],
    // an element (and so a mount) to pick at the start, the storm partway, and fire and water again for the Twins
    sources: [['flame', -7, 127], ['water', 7, 127], ['thunder', -6, 40], ['flame', -8, -142], ['water', 8, -142]],
    stages: [
      { goal: 'Reach old Tam before they hang him', hint: 'Dash (Shift) through blue curtains · ride (X) into barricades · hook over walls',
        time: 75, point: [0, 0, -126], rescue: true,
        spawn: [['basic', 0, 0, 82, BLOCKADE], ['basic', 0, 0, -22, BLOCKADE],
          ['fighter', -4, 0, 96, RUNNER], ['fighter', 4, 0, 34, RUNNER], ['fighter', -3, 0, -8, RUNNER], ['fighter', 3, 0, -70, RUNNER],
          ['fighter', 5, 0, -100, RAT], ['fighter', -5, 0, -100, RAT]] },
      { goal: 'Defeat the Twins', hint: 'One wears orange, one wears blue. Each falls to the element of their colour',
        spawn: [['fighter', -5, 0, -138, TWIN_EMBER], ['fighter', 5, 0, -138, TWIN_TIDE]] },
    ],
  },
  { id: 'foundry', name: 'The Foundry', boss: 'Cinder', blurb: 'Furnaces and armour. Fire feeds half of what is in there; water and a war elephant open the rest.' },
  { id: 'heights', name: 'The Heights', boss: 'Lady Vane', blurb: 'Towers and bridges. Nothing there can be reached on foot, and nothing there stands still for long.' },
  { id: 'citadel', name: 'The Ash Citadel', boss: 'the Ash King', blurb: 'Where it ends. Everything the Hand has left, and the man Sen once answered to.' },
];

// campaign.free = ids of the districts taken back.
export const campaign = { free: [] };
// The running mission: cur = its district (null in the yard), stage = which stage, spawned = its enemies,
// wait = seconds until the next thing happens (the next stage, or going home), won = it is finished and only
// waiting to leave, reinforced = this stage's extra enemies have already come.
// clock = seconds spent on the current stage (for stages with a time limit).
export const mission = { cur: null, stage: 0, spawned: [], wait: 0, won: false, reinforced: false, clock: 0 };

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

// The prisoner: a kneeling figure, hands behind the back, shown at the point of a stage marked `rescue`.
const captive = makeStickman(addRim(new THREE.MeshLambertMaterial({ color: 0xc9b48a })), null, false);
applyPose(captive, { ...BASE, bodyY: 0.52, spineX: 0.35, hipLX: 0.15, kneeL: 1.75, hipRX: 0.15, kneeR: 1.75, shLX: 0.6, shLZ: -0.3, elL: -1.2, shRX: 0.6, shRZ: 0.3, elR: -1.2 });
captive.root.visible = false;
scene.add(captive.root);
// The curtains of light, so they can be made to shimmer.
const gateMeshes = [];

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
  // a barricade that shuts the way: an unseen wall across the gap, taken away when the barricade breaks
  if (options.block) {
    d.blocker = addBox(_spot.x, 0, _spot.z, 6.2, 3.6, 0.9);
    d.blocker.visible = false;
  }
  mission.spawned.push(d);
  spawnRing(_fx.copy(d.pos).setY(d.pos.y + 0.05), 0.2, 2.6, 0.5, 0xc22a2a);
  return d;
}
// Take away the unseen wall behind a barricade, if it has one.
function openWay(d) {
  if (!d.blocker) return;
  removeBox(d.blocker);
  d.blocker = null;
}
function despawnAll() {
  for (const d of mission.spawned) {
    openWay(d);
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
  mission.clock = 0;
  mission.reinforced = false;
  despawnAll();
  for (const [type, x, y, z, options] of stage.spawn || []) place(type, x, y, z, options);
  marker.visible = !!stage.point;
  captive.root.visible = !!stage.rescue;
  if (stage.point) {
    marker.position.set(d.area.cx + stage.point[0], stage.point[1], d.area.cz + stage.point[2]);
    captive.root.position.copy(marker.position);
  }
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
  captive.root.visible = false;
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
  for (const gate of gateMeshes) gate.material.opacity = 0.26 + Math.sin(T * 5) * 0.08;    // the curtains shimmer (they share one material)
  for (const e of mission.spawned) {
    if (e.dead) openWay(e);    // a broken barricade no longer shuts the way
  }
  // out of time: the mission is lost, the same as being defeated
  if (stage.time && mission.wait <= 0) {
    mission.clock += dt;
    if (mission.clock > stage.time && !stageCleared()) {
      goHome();
      respawnPlayer();
      flash();
      centerMsg('MISSION FAILED<small>Too late</small>', 3);
      return;
    }
  }
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
  if (stage.rescue) {
    // freed: the prisoner gets clear in a puff, and says so
    captive.root.visible = false;
    burst(_fx.copy(captive.root.position).setY(captive.root.position.y + 1), 20, 8);
    centerMsg(`Freed with ${Math.max(0, stage.time - mission.clock).toFixed(1)} s to spare`, 1.5);
  } else centerMsg('Stage clear', 1.2);
}

// The mission shown on screen (hud.js), as HTML. null = no mission is running.
export function missionLine() {
  const d = mission.cur;
  if (!d) return null;
  if (mission.won) return `<small>${d.name.toUpperCase()}</small><b>The district is free</b><span class="ok">Heading home</span>`;
  const stage = d.stages[mission.stage];
  const left = mission.spawned.filter(e => !e.dead).length;
  const count = stage.spawn && !stage.point ? ` · ${left} left` : '';
  const clock = stage.time ? `<span class="tm">${Math.max(0, stage.time - mission.clock).toFixed(1)} s</span>` : '';
  return `<small>${d.name.toUpperCase()} · ${mission.stage + 1} / ${d.stages.length}</small><b>${stage.goal}${count}</b>${clock}<span>${stage.hint}</span>`;
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
    if (a.walls !== false) {
      addBox(a.cx, 0, a.cz - edge, size + 2, 9, 1, COL.wall);
      addBox(a.cx, 0, a.cz + edge, size + 2, 9, 1, COL.wall);
      addBox(a.cx - edge, 0, a.cz, 1, 9, size, COL.wall);
      addBox(a.cx + edge, 0, a.cz, 1, 9, size, COL.wall);
    }
    for (const [x, z, w] of d.gates || []) gateMeshes.push(addPhaseWall(a.cx + x, 0, a.cz + z, w, 14, 0.8));
    for (const [x, y, z, w, h, depth, col] of d.props) addBox(a.cx + x, y, a.cz + z, w, h, depth, COL[col] || COL.stone);
    for (const [id, x, z] of d.sources) addSource(id, a.cx + x, 0, a.cz + z);
  }
}
