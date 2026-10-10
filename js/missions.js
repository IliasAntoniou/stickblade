// missions.js: the campaign. The city has five districts, each held by one of the Ash Hand's lieutenants, and the
// purpose of the game is to take them back one by one. A district is a mission: a separate walled area (like the
// training hall) fought through in stages, with a boss at the end. Being defeated fails the mission.
// Districts are not all the same kind of place. The docks are three yards that open one after another: the gate
// yard, the cargo yard and the pier. The Old Market is one long straight street run against the clock to save a
// prisoner, with a low road (curtains only a dash passes, barricades a mount or a powder keg breaks, walls the
// hook gets over) and a high road along the rooftops.
// Stages are built so that each one leans on a different tool: the grappling hook, a mount, the sword styles
// (enemies that are weak to one element; the colour of their headband says which), and the things in the
// district that react: powder kegs, levers, falling loads, awnings (all in setpieces.js).
// The story is told while playing: each stage can have lines for the people in it to say (`say`), and each
// district hides pages of the Hand's ledger.
// DISTRICTS is the whole campaign as data. A district without `stages` is not built yet and shows as such on the map.
// Owns: which districts are free and which ledger pages are found (saved in the browser), the running mission,
// its enemies and its marker.
// Used by: master.js (the city map in Sen's menu), hud.js (the stage shown on screen), update.js (updateMissions
// every frame, the P key), player.js (failMission on defeat), tuning.js (campaignHp, resetCampaign), quests.js,
// setpieces.js (foundPage, addTime).

import * as THREE from 'three';
import { V3, _fx } from './util.js';
import { makeStickman, applyPose, addRim, BASE } from './stickman.js';
import { scene } from './core.js';
import { addBox, removeBox, addPhaseWall, setArea, makeFloor, ARENA, COL } from './world.js';
import { glowTex, ringGeo, spawnRing, burst, toast, centerMsg, flash, say, clearSay } from './fx.js';
import { T, P, CL, SPAWN, chal } from './state.js';
import { spawnDummy, removeDummy, dummyBlocked } from './dummies.js';
import { respawnPlayer } from './player.js';
import { addSource } from './styles.js';
import { story } from './quests.js';
import { applyTune } from './tuning.js';
import { dojo } from './dojo.js';
import { buildThings, clearThings, updateThings, fire, wasFired } from './setpieces.js';

const STORE_KEY = 'stickblade.campaign.v1';
// The smoke test starts from nothing and never writes, so running it cannot touch a real save.
const SMOKE = new URLSearchParams(location.search).get('debug') === 'smoke';
const YARD_SPAWN = SPAWN.clone();    // where the player starts in the main arena, to go back to
const HP_PER_DISTRICT = 20;          // extra maximum health for every district freed
const HP_PER_LEDGER = 10;            // extra maximum health for finding every ledger page of a district
const STAGE_HEAL = 0.35;             // share of full health given back when a stage is cleared
export const MISSION_REGEN = 0.25;   // health comes back this much slower during a mission, so damage adds up
const STAGE_PAUSE = 1.6;             // seconds between clearing a stage and the next one starting
const LEAVE_PAUSE = 3.5;             // seconds in the freed district before going home
const REVIVE_HP = 0.35;              // share of its health a boss gets back up with (stages with `together`)

// The Ash Hand's fighters. All are built on the 'fighter' dummy (a slam up close, a lunge from further away).
// hp = health, speed = walking speed (the player runs at 9.5), size = how big, weak = the sword style that hurts
// them most. An enemy with a weakness takes only 60% from everything else, so bringing the right element matters.
const THUG = { gang: true, hp: 240, color: 0x5a5a66 };                                                  // plain: no weakness
const RUNNER = { gang: true, hp: 170, color: 0x6a6440, weak: 'thunder', speed: 8.5, size: 0.92 };       // fast: lightning pins it down
const IRON = { gang: true, hp: 420, color: 0x3f444e, weak: 'flame', speed: 3.6, size: 1.14 };           // armoured: fire gets through
const RAT = { gang: true, hp: 95, color: 0x44566a, weak: 'water', speed: 6.2, size: 0.82 };             // small and many: water gathers them
// A lookout: stands where it is put (somewhere high) and throws from far off. The red line is the warning. Not
// much health, so the answer is to get up to it.
const LOOKOUT = { gang: true, hp: 130, color: 0x6b4a3a, ranged: true, size: 0.95 };
// A wall of planks. Stands still, ignores swords and skills, and breaks to one ram from any mount, or to a
// powder keg going off beside it. Built on the 'basic' dummy.
const BARRICADE = { gang: true, hp: 60, look: 'barricade', fixed: true, ramOnly: true };
// Marrow wears armour: every hit counts for 60% until a powder keg going off beside him breaks it open for a while.
const MARROW = { gang: true, boss: true, hp: 1500, color: 0x33283a, armour: 0.6 };
// A barricade that also shuts the way: an unseen wall stands where it does until it is broken.
const BLOCKADE = { ...BARRICADE, block: true };
// The Twins, keepers of the Old Market. One falls to fire and one to water, so the fight asks for both.
const TWIN_EMBER = { gang: true, boss: true, name: 'Ember', hp: 800, color: 0x4a2a22, weak: 'flame', size: 0.82 };
const TWIN_TIDE = { gang: true, boss: true, name: 'Tide', hp: 800, color: 0x223a4a, weak: 'water', size: 0.82 };

// The campaign, in order. A district is open once the one before it is free (the first needs `needs`, a story task).
//   area   = where it is: centre and half-width of its square. Far from everything else, so fog hides the rest.
//            walls: false leaves out the four outer walls (for a district that builds its own shape from props).
//   gates  = curtains of light only a dash passes through: [x, z, width].
//   floor  = colour of its ground.   start = where the player arrives (all coordinates are relative to the centre).
//   props  = its boxes: [x, y, z, w, h, d, colour name], as in addBox.   sources = [style id, x, z]: a pool, a fire, a storm.
//   captive = [x, y, z]: someone is held there (the kneeling figure) until a stage with `frees` is cleared.
//   things = what reacts (setpieces.js builds them). Each is { kind, ... }; `stage: n` puts it out when stage n
//            begins (the first stage if left out). The kinds:
//       keg { at }                        a powder keg.
//       lever { at, name }                fires the trigger 'lever:<name>' when hit.
//       cage { at, who, line }            someone to free, and what they say.
//       door { box, opens | cracked }     a wall (box as in props) that goes when the trigger `opens` fires, or,
//                                         with cracked, when a keg goes off beside it.
//       load { at, size, rope, name, drops, rubble }  a crate hanging at `at` from a rope reaching up to height
//                                         `rope`. Falls when the trigger `drops` fires; fires 'load:<name>' on
//                                         landing and leaves a pile `rubble` high.
//       pad { box, up, push }             an awning: throws whoever lands on it up at speed `up` and along at [x, z].
//       trap { at, size, every, warn, on, dmg, offset, color, quench }  a strip of ground [w, d] that burns on a cycle.
//       page { at, text }                 a page of the ledger.
//       hourglass { at, secs }            more time on the clock.
//   stages = what has to be done, in order. Each: goal (shown on screen), hint (how), and one of
//       spawn   = enemies as [type, x, y, z, options]: the stage is cleared when all of them are down, or
//       point   = [x, y, z], a place to stand on: the stage is cleared on reaching it, or
//       trigger = the name of a trigger: the stage is cleared when it fires (a point then only shows the beacon).
//       With a point or a trigger, any enemies are only in the way.
//     time   = seconds allowed. Run out and the mission is lost.
//     frees  = clearing it frees the district's captive.
//     together = seconds: the stage has two bosses, and when one falls the other must follow within this long
//                or the first gets back up.
//     reinforce = { at, spawn, say, time, late }: when the stage's boss falls to this share of its health, more
//                enemies arrive. time = from then on there are this many seconds left; late = what the screen
//                says if they run out.
//     say    = lines of the story: [who, line, when]. when = 'start', 'clear', 'left:20' (that many seconds left
//              on the clock) or 'hp:0.5' (the boss is down to that share of its health).
export const DISTRICTS = [
  {
    id: 'docks', name: 'The Docks', boss: 'Marrow', needs: 'c1-rook',
    blurb: 'Where the Hand lands its powder. Three yards: a gate to break, a crane to climb, and Marrow counting kegs on the pier.',
    area: { cx: -300, cz: 0, half: 40 }, floor: 0x9a8670, start: [0, 0, 34],
    props: [
      // the gate yard (south): cargo for cover, and the stack the lookout stands on
      [-16, 0, 24, 6, 3, 6, 'crate'], [15, 0, 24, 5, 5, 5, 'crate'], [-5, 0, 28, 3, 2, 3, 'crate'], [26, 0, 15, 4, 2.5, 4, 'crate'],
      // the wall between the gate yard and the cargo yard. The gap of 8 in the middle is the gate (a door, below)
      [-22, 0, 4, 36, 9, 2, 'wall'], [22, 0, 4, 36, 9, 2, 'wall'],
      // the crane: a tower too high to jump (the hook gets you up), its jib reaching out over the gate
      [12, 0, 9, 4, 17, 4, 'pillar'], [4, 16.2, 9, 14, 0.8, 3, 'plat'],
      // the cargo yard (middle): cover, and in the north-west corner a store with a cracked wall
      [-24, 0, -3, 8, 4, 4, 'crate'], [24, 0, -12, 3, 7, 3, 'pillar'], [-32, 0, -13, 1, 9, 8, 'wall'],
      // the wall between the cargo yard and the pier, with its own gate
      [-22, 0, -18, 36, 9, 2, 'wall'], [22, 0, -18, 36, 9, 2, 'wall'],
      // the pier (north): two stacks of stone, and cargo at the water's edge
      [-28, 0, -28, 6, 8, 6, 'stone'], [28, 0, -28, 6, 10, 6, 'stone'], [-15, 0, -37, 4, 2, 4, 'crate'], [15, 0, -37, 4, 2, 4, 'crate'],
    ],
    sources: [['water', -15, 30], ['flame', 15, 30], ['thunder', 0, 24]],
    things: [
      // the gate: shut until the crane's load comes down on it
      { kind: 'door', box: [0, 0, 4, 8, 9, 2, 'crate'], opens: 'load:crane' },
      { kind: 'keg', at: [-6, 0, 15] }, { kind: 'keg', at: [7, 0, 14] },
      // the crane: the bell-pull at the end of the jib lets the load go
      { kind: 'lever', name: 'crane', at: [-1.5, 17, 9], stage: 2 },
      { kind: 'load', name: 'crane', at: [0, 8, 8], size: [5, 4, 5], rope: 16.2, drops: 'lever:crane', rubble: 1 },
      // the cargo yard: steam across the lane, a keg beside each barricade, two cages, and the store
      { kind: 'trap', at: [-10, 0, 0], size: [14, 2.5], every: 3.4, warn: 0.9, on: 1.1, dmg: 10, color: 0xcfe6ff },
      { kind: 'trap', at: [10, 0, 0], size: [14, 2.5], every: 3.4, warn: 0.9, on: 1.1, dmg: 10, color: 0xcfe6ff, offset: 1.7 },
      { kind: 'keg', at: [-9.2, 0, -5], stage: 3 }, { kind: 'keg', at: [2.8, 0, -5], stage: 3 }, { kind: 'keg', at: [14.8, 0, -5], stage: 3 },
      { kind: 'cage', at: [-35, 0, -1], who: 'Docker', line: 'Bless you. Marrow works us till we drop, then feeds us to the tide.' },
      { kind: 'cage', at: [35, 0, -1], who: 'Docker', line: 'The kegs! Do not let those kegs leave the pier, they are meant for our own streets.' },
      { kind: 'door', box: [-36, 0, -9.5, 8, 9, 1, 'crate'], cracked: true },
      { kind: 'keg', at: [-36, 0, -7.5] },
      // the rats roll the powder out with them
      { kind: 'keg', at: [-15, 0, -11], stage: 4 }, { kind: 'keg', at: [-13.2, 0, -12.6], stage: 4 }, { kind: 'keg', at: [-16.8, 0, -12.6], stage: 4 },
      { kind: 'keg', at: [15, 0, -11], stage: 4 }, { kind: 'keg', at: [13.2, 0, -12.6], stage: 4 }, { kind: 'keg', at: [16.8, 0, -12.6], stage: 4 },
      // the pier: shut until Marrow comes out to fight, and ringed with his kegs
      { kind: 'door', box: [0, 0, -18, 8, 9, 2, 'crate'], opens: 'stage:5' },
      { kind: 'keg', at: [-9, 0, -23], stage: 5 }, { kind: 'keg', at: [9, 0, -23], stage: 5 }, { kind: 'keg', at: [-12, 0, -31], stage: 5 },
      { kind: 'keg', at: [12, 0, -31], stage: 5 }, { kind: 'keg', at: [-6, 0, -36], stage: 5 }, { kind: 'keg', at: [6, 0, -36], stage: 5 },
      // the ledger: on top of the crane, in the store behind the cracked wall, and on the tall stack on the pier
      { kind: 'page', at: [12, 18.2, 9], text: '"Forty kegs of ashpowder, landed by night. For the free quarters: light them from the rooftops."' },
      { kind: 'page', at: [-36, 1.2, -13], text: '"Blackgate, eleven years back. One enforcer took the whole sentence and named nobody. Keep him inside."' },
      { kind: 'page', at: [28, 11.2, -28], text: '"The Ash King asks again for a key to his own gate. The locksmith says it cannot be copied. Persuade him."' },
    ],
    stages: [
      { goal: 'Break through the gate yard', hint: 'Yellow bands are fast: lightning stuns them. Break a powder keg, then get clear before it goes off',
        spawn: [['fighter', -7, 0, 18, THUG], ['fighter', 7, 0, 18, THUG], ['fighter', -16, 0, 16, THUG], ['fighter', -4, 0, 10, RUNNER], ['fighter', 5, 0, 9, RUNNER], ['fighter', 15, 5, 24, LOOKOUT]],
        say: [['Marrow', 'Somebody is at my gate. Break him, and get back to counting my powder.', 'start']] },
      { goal: 'Climb the crane and ring the bell', hint: 'Aim at the tower and hold the right mouse button. Hit the gold lever at the end of the jib',
        point: [-1.5, 17, 9], trigger: 'lever:crane',
        spawn: [['fighter', -1.5, 0, 9, THUG], ['fighter', 1.5, 0, 8, THUG]],
        say: [['Marrow', 'He is going for the bell. If the dockers hear it they will run. Stand under that crane and wait for him!', 'start'],
          ['Docker', 'That is the bell! The Hand is being hit. Out, everybody out!', 'clear']] },
      { goal: 'Break the barricades', hint: 'Ride into them (X), or break the keg beside one. Orange bands are armoured: bring fire. Watch the steam',
        spawn: [['basic', -12, 0, -6, BARRICADE], ['basic', 0, 0, -6, BARRICADE], ['basic', 12, 0, -6, BARRICADE], ['fighter', -6, 0, -11, IRON], ['fighter', 7, 0, -11, IRON]],
        say: [['Marrow', 'Wall off the powder. Nothing on two legs gets past those planks.', 'start']] },
      { goal: 'Clear the dock rats', hint: 'Blue bands come in swarms. Water gathers them up, and one keg sets off the next',
        spawn: [['fighter', -4, 0, -4, RAT], ['fighter', 4, 0, -4, RAT], ['fighter', -19, 0, -8, RAT], ['fighter', 19, 0, -8, RAT], ['fighter', 0, 0, -13, RAT], ['fighter', -7, 0, -14, RAT], ['fighter', 7, 0, -14, RAT]],
        say: [['Marrow', 'Rats! Roll the kegs out and bury him in them.', 'start']] },
      { goal: 'Defeat Marrow', hint: 'His armour shrugs off your sword. Break a keg beside him to crack it open',
        spawn: [['fighter', 0, 0, -30, MARROW], ['fighter', -8, 0, -27, THUG], ['fighter', 8, 0, -27, THUG]],
        reinforce: { at: 0.5, say: '"Light the fuse! If I lose the docks, nobody has them!"', time: 40, late: 'The pier went up',
          spawn: [['fighter', -20, 0, -31, RUNNER], ['fighter', 20, 0, -32, RUNNER], ['fighter', 0, 0, -37, IRON]] },
        say: [['Marrow', 'Sen sent a child. I have gutted bigger fish than you on this pier.', 'start'],
          ['Marrow', 'The ledger... in my coat. Read it. See what the powder was buying.', 'clear'],
          ['The ledger', '"Paid to the Twins, Old Market: for the locksmith Tam, who will not cut the key. Hang him at dusk, at the bell."', 'clear']] },
    ],
  },
  {
    id: 'market', name: 'The Old Market', boss: 'the Twins',
    blurb: 'One long street and no time. The Twins mean to hang old Tam, the locksmith who raised them, at the far end. Dash, ride and hook your way down it, or take the rooftops.',
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
      // the high road: six rooftop ledges along the west side, 11 up. The pinch blocks (14 high) and the two
      // cross walls are the steps between them, so up here nothing shuts the way. An awning throws you up to
      // the first, third and fifth; the hook reaches any of them.
      [-9.5, 10.2, 92, 5, 0.8, 12, 'plat'], [-9.5, 10.2, 68, 5, 0.8, 20, 'plat'], [-9.5, 10.2, 35, 5, 0.8, 14, 'plat'],
      [-9.5, 10.2, -4, 5, 0.8, 24, 'plat'], [-9.5, 10.2, -43, 5, 0.8, 18, 'plat'], [-9.5, 10.2, -74, 5, 0.8, 20, 'plat'],
    ],
    gates: [[0, 112, 6], [0, 22, 6], [0, 14, 6], [0, -88, 6]],
    // an element (and so a mount) to pick at the start, the storm partway, and fire and water again for the Twins
    sources: [['flame', -7, 127], ['water', 7, 127], ['thunder', 6, 46], ['flame', -8, -142], ['water', 8, -142]],
    captive: [0, 0, -126],
    things: [
      // awnings: each stands 6 up the street from the end of a ledge. Any nearer and the throw comes up
      // underneath the ledge; from here it clears the edge and comes down on top
      { kind: 'pad', box: [-9.5, 0, 104, 4, 1.6, 3], up: 27, push: [0, -9] },
      { kind: 'pad', box: [-9.5, 0, 48, 4, 1.6, 3], up: 27, push: [0, -9] },
      { kind: 'pad', box: [-9.5, 0, -28, 4, 1.6, 3], up: 27, push: [0, -9] },
      // a keg by each barricade, for a player with no mount to spare
      { kind: 'keg', at: [2.6, 0, 85.5] }, { kind: 'keg', at: [-2.6, 0, -18.5] },
      // stalls the Twins' people have set alight. A dash under Water puts one out for good
      { kind: 'trap', at: [0, 0, 74], size: [24, 3], every: 3.2, warn: 0.9, on: 1.2, dmg: 12, quench: true },
      { kind: 'trap', at: [0, 0, -48], size: [24, 3], every: 3.2, warn: 0.9, on: 1.2, dmg: 12, quench: true, offset: 1.6 },
      // time to be won, all of it off the straight line down the street
      { kind: 'hourglass', at: [-9.5, 12.2, 88], secs: 4 }, { kind: 'hourglass', at: [8, 10.2, 52], secs: 4 }, { kind: 'hourglass', at: [7.5, 15.2, 18], secs: 4 },
      { kind: 'hourglass', at: [6, 3.7, -40], secs: 4 }, { kind: 'hourglass', at: [-9.5, 12.2, -74], secs: 4 },
      // the rope Tam hangs from: only there once the Twins are down
      { kind: 'lever', name: 'rope', at: [2, 0, -126], stage: 3 },
      // the ledger: on the first rooftop, on top of the tall wall, and behind the gallows
      { kind: 'page', at: [-9.5, 12.2, 95], text: '"The Twins took the market in one night. They knew every door: the old man taught them every lock."' },
      { kind: 'page', at: [0, 13.2, -58], text: '"Three pieces to one key. The King holds none of them. That is the joke the locksmith built into his gate."' },
      { kind: 'page', at: [0, 1.2, -147], text: '"If Sen ever walks out of Blackgate, kill his recruit first. He will not get over losing another."' },
    ],
    stages: [
      { goal: 'Reach the gallows before the bell stops', hint: 'Dash (Shift) through blue curtains · ride (X) into barricades or break the keg · hook over walls · or take the rooftops',
        time: 65, point: [0, 0, -126],
        spawn: [['basic', 0, 0, 82, BLOCKADE], ['basic', 0, 0, -22, BLOCKADE],
          ['fighter', -4, 0, 96, RUNNER], ['fighter', 4, 0, 34, RUNNER], ['fighter', -3, 0, -8, RUNNER], ['fighter', 3, 0, -70, RUNNER],
          ['fighter', 5, 0, -100, RAT], ['fighter', -5, 0, -100, RAT],
          ['fighter', -9.5, 11, 68, LOOKOUT], ['fighter', -9.5, 11, -43, LOOKOUT]],
        say: [['Ember', 'Hear the bell, old man? When it stops, you drop.', 'start'],
          ['Tide', 'And look, sister: somebody is running. Run faster, little sword.', 'start'],
          ['Tam', 'You were my apprentices! I taught you to cut a key, not a throat!', 'left:45'],
          ['Tide', 'Half the street still to go. He will not make it, Ember.', 'left:25'],
          ['Ember', 'Ten more breaths, master. Any last lesson?', 'left:10'],
          ['Tam', 'Behind you, child! They never did learn to wait.', 'clear']] },
      { goal: 'Defeat the Twins', hint: 'One wears orange, one wears blue: each falls to the element of their colour. Bring them down together, or the first gets back up',
        together: 12,
        spawn: [['fighter', -5, 0, -138, TWIN_EMBER], ['fighter', 5, 0, -138, TWIN_TIDE]],
        say: [['Ember', 'He raised us, he fed us, and then he chose a lock over us.', 'start'],
          ['Tide', 'Together, sister. Always together.', 'start'],
          ['Tam', 'I am sorry. I am so sorry, both of you.', 'clear']] },
      { goal: 'Cut Tam down', hint: 'Hit the gold lever by the gallows. The rest of their people are coming up the street',
        point: [2, 0, -126], trigger: 'lever:rope', frees: true,
        spawn: [['fighter', -2, 0, -98, RUNNER], ['fighter', 2, 0, -98, RUNNER], ['fighter', -4, 0, -104, RAT], ['fighter', 4, 0, -104, RAT], ['fighter', -7, 0, -110, RAT], ['fighter', 7, 0, -110, RAT]],
        say: [['Tam', 'The rope, quickly! The rest of them are coming up the street.', 'start'],
          ['Tam', 'The Citadel gate takes three pieces of one key. Cinder keeps one in the Foundry. Lady Vane wears one in the Heights.', 'clear'],
          ['Tam', 'The third? Ask your master what he carried into Blackgate, and why he never gave it up.', 'clear']] },
    ],
  },
  { id: 'foundry', name: 'The Foundry', boss: 'Cinder', blurb: 'Furnaces and armour, and one piece of the key. Fire feeds half of what is in there; water and a war elephant open the rest.' },
  { id: 'heights', name: 'The Heights', boss: 'Lady Vane', blurb: 'Towers and bridges, and the second piece. Nothing there can be reached on foot, and nothing there stands still for long.' },
  { id: 'citadel', name: 'The Ash Citadel', boss: 'the Ash King', blurb: 'Where it ends. A gate that takes three pieces of one key, everything the Hand has left, and the man Sen once answered to.' },
];

// campaign.free = ids of the districts taken back. campaign.pages = the ledger pages found, by district id
// (each a list of page numbers, counted from 0 in the order they stand in the district's `things`).
export const campaign = { free: [], pages: {} };
// The running mission: cur = its district (null in the yard), stage = which stage, spawned = its enemies,
// wait = seconds until the next thing happens (the next stage, or going home), won = it is finished and only
// waiting to leave, reinforced = this stage's extra enemies have already come.
// clock = seconds spent on the current stage. limit = seconds allowed for it (0 = as long as it takes).
// late = what the screen says if the time runs out. said = which of the stage's lines have been spoken.
// freed = the captive has been let go. revive = seconds until `fallen`, a beaten boss, gets back up (stages
// with `together`; 0 = nobody is about to).
export const mission = { cur: null, stage: 0, spawned: [], wait: 0, won: false, reinforced: false, clock: 0, limit: 0, late: '', said: new Set(), freed: false, revive: 0, fallen: null };

function store() {
  if (SMOKE) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(campaign)); } catch (e) {}
}
const districtById = id => DISTRICTS.find(d => d.id === id) || null;
export const isFree = id => campaign.free.includes(id);
// How many ledger pages a district hides, and which of them have been found.
const pageTotal = d => (d.things || []).filter(thing => thing.kind === 'page').length;
const pagesFound = d => campaign.pages[d.id] || [];
// Extra maximum health earned in the campaign (added in applyTune, tuning.js): some for every district freed,
// and some for every district whose ledger pages have all been found.
export function campaignHp() {
  let ledgers = 0;
  for (const d of DISTRICTS) {
    if (pageTotal(d) > 0 && pagesFound(d).length >= pageTotal(d)) ledgers++;
  }
  return campaign.free.length * HP_PER_DISTRICT + ledgers * HP_PER_LEDGER;
}

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

// The prisoner: a kneeling figure, hands behind the back, shown where a district's `captive` says.
const captive = makeStickman(addRim(new THREE.MeshLambertMaterial({ color: 0xc9b48a })), null, false);
applyPose(captive, { ...BASE, bodyY: 0.52, spineX: 0.35, hipLX: 0.15, kneeL: 1.75, hipRX: 0.15, kneeR: 1.75, shLX: 0.6, shLZ: -0.3, elL: -1.2, shRX: 0.6, shRZ: 0.3, elR: -1.2 });
captive.root.visible = false;
scene.add(captive.root);
// The curtains of light, so they can be made to shimmer.
const gateMeshes = [];

// ---------- the map ----------
// Every district with where it stands, for Sen's menu:
//   built = it can be played.  free = it has been taken back.  open = it can be started now.
//   why = what is missing when it is not open.  pages, pageTotal = ledger pages found, and how many there are.
export function districtList() {
  return DISTRICTS.map((d, i) => {
    const built = !!d.stages;
    const before = i > 0 ? DISTRICTS[i - 1] : null;
    let why = null;
    if (!built) why = 'Not reachable yet';
    else if (CL.id !== 'blade') why = 'The campaign is fought as the Blademaster';
    else if (before && !isFree(before.id)) why = `Free ${before.name} first`;
    else if (d.needs && !story.done.includes(d.needs)) why = 'Finish what Master Sen has asked of you first';
    return { d, built, free: isFree(d.id), open: !why, why, pages: pagesFound(d).length, pageTotal: pageTotal(d) };
  });
}

// ---------- the ledger and the clock (called by setpieces.js) ----------
// The player has picked up a ledger page. index = its number in the district, text = what it says.
export function foundPage(index, text) {
  const d = mission.cur;
  if (!d) return;
  if (!campaign.pages[d.id]) campaign.pages[d.id] = [];
  const found = campaign.pages[d.id];
  if (found.includes(index)) return;
  found.push(index);
  store();
  say('The ledger', text, 6);
  if (found.length >= pageTotal(d)) {
    applyTune();    // the extra maximum health takes effect at once
    toast(`<b>The whole ledger of ${d.name}</b> · +${HP_PER_LEDGER} maximum health`, 5);
  } else toast(`Ledger page <b>${found.length} of ${pageTotal(d)}</b>`, 3);
}
// The player has picked up an hourglass. Returns false, changing nothing, if no clock is running.
export function addTime(seconds) {
  if (!mission.cur || !mission.limit || mission.wait > 0 || mission.won) return false;
  mission.limit += seconds;
  return true;
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
  d.spec = [type, x, y, z, options];    // what it was made from, so it can be made again (a boss getting back up)
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

// ---------- the story ----------
// Speak the lines of the current stage that are due. when = 'start' or 'clear' for those moments; left out, it
// checks the lines that wait for the clock ('left:20') or for the boss's health ('hp:0.5').
function speak(when) {
  const stage = mission.cur.stages[mission.stage];
  if (!stage.say) return;
  const boss = mission.spawned.find(e => e.boss && !e.dead);
  for (let i = 0; i < stage.say.length; i++) {
    const [who, line, cue] = stage.say[i];
    if (mission.said.has(i)) continue;
    const [kind, amount] = cue.split(':');
    let due = cue === when;
    if (!when && kind === 'left') due = mission.limit > 0 && mission.limit - mission.clock <= Number(amount);
    if (!when && kind === 'hp') due = !!boss && boss.hp <= boss.maxHp * Number(amount);
    if (!due) continue;
    mission.said.add(i);
    say(who, line);
  }
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
  mission.freed = false;
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
  mission.limit = stage.time || 0;
  mission.late = 'Too late';
  mission.reinforced = false;
  mission.revive = 0;
  mission.fallen = null;
  mission.said.clear();
  despawnAll();
  for (const [type, x, y, z, options] of stage.spawn || []) place(type, x, y, z, options);
  // the things of this stage are put out first, so that a door among them hears the stage begin
  buildThings(d.area, d.things, index + 1, pagesFound(d));
  fire('stage:' + (index + 1));
  marker.visible = !!stage.point;
  if (stage.point) marker.position.set(d.area.cx + stage.point[0], stage.point[1], d.area.cz + stage.point[2]);
  captive.root.visible = !!d.captive && !mission.freed;
  if (d.captive) captive.root.position.set(d.area.cx + d.captive[0], d.captive[1], d.area.cz + d.captive[2]);
  centerMsg(`${stage.goal}<small>${d.name} · ${index + 1} of ${d.stages.length}</small>`, 2.4);
  speak('start');
}
// Testing tool (?debug=mission:docks&stage=3, and the smoke test): go straight to a later stage, counted from 0.
// Every stage on the way is begun in turn and its trigger fired, so the doors on the way stand open.
export function jumpToStage(index) {
  const d = mission.cur;
  if (!d) return;
  for (let i = mission.stage; i < Math.min(index, d.stages.length - 1); i++) {
    if (d.stages[i].trigger) fire(d.stages[i].trigger);
    if (d.stages[i].frees) mission.freed = true;
    beginStage(i + 1);
  }
}
// Has the current stage been done?
function stageCleared() {
  const d = mission.cur, stage = d.stages[mission.stage];
  if (stage.trigger) return wasFired(stage.trigger);
  if (stage.point) {
    const dx = P.pos.x - (d.area.cx + stage.point[0]), dz = P.pos.z - (d.area.cz + stage.point[2]);
    return P.grounded && Math.hypot(dx, dz) < 2.6 && Math.abs(P.pos.y - stage.point[1]) < 1.5;
  }
  return mission.spawned.every(e => e.dead);
}
// A stage with `together`: two bosses who do not stay down alone. When one falls, the other has to follow
// within stage.together seconds, or the first is back on its feet with part of its health.
function updateTogether(stage, dt) {
  const bosses = mission.spawned.filter(e => e.boss && !e.replaced);
  const down = bosses.filter(e => e.dead);
  if (down.length !== 1 || bosses.length < 2) {
    mission.revive = 0;
    mission.fallen = null;
    return;
  }
  if (mission.fallen !== down[0]) {
    mission.fallen = down[0];
    mission.revive = stage.together;
  }
  mission.revive -= dt;
  if (mission.revive > 0) return;
  const [type, x, y, z, options] = mission.fallen.spec;
  mission.fallen.replaced = true;    // the one lying there no longer counts; the one made below takes its place
  mission.fallen = null;
  mission.revive = 0;
  const back = place(type, x, y, z, options);
  back.hp = back.maxHp * REVIVE_HP;
  centerMsg(`${options.name} gets back up<small>Bring them down together</small>`, 2);
}
// Leave the district for the yard. Does not move the player: the caller respawns them.
function goHome() {
  despawnAll();
  clearThings();
  clearSay();
  marker.visible = false;
  captive.root.visible = false;
  mission.cur = null;
  mission.won = false;
  mission.limit = 0;
  mission.revive = 0;
  mission.fallen = null;
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
  mission.limit = 0;
  marker.visible = false;
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.5, 8, 0.8, 0xffd23f);
  burst(_fx.setY(P.pos.y + 1), 40, 14);
  centerMsg(`${d.name} is free<small>${first ? `+${HP_PER_DISTRICT} maximum health · ` : ''}${campaign.free.length} of ${DISTRICTS.length} districts</small>`, LEAVE_PAUSE);
}
// The captive is let go: gets clear in a puff.
function freeCaptive() {
  mission.freed = true;
  captive.root.visible = false;
  burst(_fx.copy(captive.root.position).setY(captive.root.position.y + 1), 20, 8);
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
  updateThings(dt);
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
  if (mission.wait > 0) {
    // between stages
    mission.wait -= dt;
    if (mission.wait <= 0) beginStage(mission.stage + 1);
    return;
  }
  mission.clock += dt;
  // out of time: the mission is lost, the same as being defeated
  if (mission.limit && mission.clock > mission.limit && !stageCleared()) {
    const late = mission.late;
    goHome();
    respawnPlayer();
    flash();
    centerMsg(`MISSION FAILED<small>${late}</small>`, 3);
    return;
  }
  // the boss calls for help once, when hurt enough
  if (stage.reinforce && !mission.reinforced) {
    const boss = mission.spawned.find(e => e.boss);
    if (boss && !boss.dead && boss.hp <= boss.maxHp * stage.reinforce.at) {
      mission.reinforced = true;
      for (const [type, x, y, z, options] of stage.reinforce.spawn) place(type, x, y, z, options);
      centerMsg(`${stage.reinforce.say}<small>${d.boss}</small>`, 2);
      if (stage.reinforce.time) {
        // and from here on there is a clock
        mission.limit = mission.clock + stage.reinforce.time;
        mission.late = stage.reinforce.late || 'Too late';
      }
    }
  }
  if (stage.together) updateTogether(stage, dt);
  speak();
  if (!stageCleared()) return;
  speak('clear');
  if (stage.frees) freeCaptive();
  if (mission.stage === d.stages.length - 1) { winMission(); return; }
  P.hp = Math.min(P.maxHp, P.hp + P.maxHp * STAGE_HEAL);
  mission.wait = STAGE_PAUSE;
  marker.visible = false;
  if (stage.time) centerMsg(`In time<small>${Math.max(0, mission.limit - mission.clock).toFixed(1)} s to spare</small>`, 1.5);
  else centerMsg('Stage clear', 1.2);
}

// The mission shown on screen (hud.js), as HTML. null = no mission is running.
export function missionLine() {
  const d = mission.cur;
  if (!d) return null;
  if (mission.won) return `<small>${d.name.toUpperCase()}</small><b>The district is free</b><span class="ok">Heading home</span>`;
  const stage = d.stages[mission.stage];
  const left = mission.spawned.filter(e => !e.dead).length;
  const count = stage.spawn && !stage.point && !stage.trigger ? ` · ${left} left` : '';
  const clock = mission.limit ? `<span class="tm">${Math.max(0, mission.limit - mission.clock).toFixed(1)} s</span>` : '';
  const revive = mission.revive > 0 ? `<span class="ok">${mission.fallen.spec[4].name} gets back up in ${Math.ceil(mission.revive)} s</span>` : '';
  const pages = pageTotal(d) ? `<span class="pg">Ledger ${pagesFound(d).length} / ${pageTotal(d)}</span>` : '';
  return `<small>${d.name.toUpperCase()} · ${mission.stage + 1} / ${d.stages.length}</small><b>${stage.goal}${count}</b>${clock}${revive}<span>${stage.hint}</span>${pages}`;
}

// Testing tool (the "Reset progress" button in the tuning panel): every district goes back to the Hand, and
// every ledger page is lost again.
export function resetCampaign() {
  if (mission.cur) abandonMission();
  campaign.free.length = 0;
  campaign.pages = {};
  store();
  applyTune();
}

// Called once from main.js: load which districts are free, and build every district that has stages (its
// floor, walls, boxes, and its pool, fire and storm). They stand far away and are never removed. The things in
// a district that react (`things`) are not built here: they come and go with each mission.
export function initMissions() {
  if (!SMOKE) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && Array.isArray(saved.free)) campaign.free = saved.free.filter(id => districtById(id));
      // a save from before the ledger has no pages: that is fine, it starts with none
      if (saved && saved.pages && typeof saved.pages === 'object') {
        for (const id in saved.pages) {
          if (districtById(id) && Array.isArray(saved.pages[id])) campaign.pages[id] = saved.pages[id];
        }
      }
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
