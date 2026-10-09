// main.js: the entry point. Loads every module, then runs frame() once per screen refresh.

// base layer first: other modules may use these at their top level, and nothing else
import './util.js';
import './core.js';
import './world.js';
import './stickman.js';
import './state.js';
import './fx.js';
import * as THREE from 'three';
import { save } from './util.js';
import { renderer, scene, camera } from './core.js';
import { hitstop, updateFx, updateDomFx, tickHitstop } from './fx.js';
import { T, P, CL, dlg, chal, CLASSES, totalDmg } from './state.js';
import { dummies, hitDummy, DTYPE } from './dummies.js';
import { hurtPlayer, respawnPlayer } from './player.js';
import { updateCamera } from './camera.js';
import { CLASS_ORDER, setClass } from './classes/index.js';
import { CH, startChallenge, endChallenge } from './challenges.js';
import { keys, pressed, locked, overlay, setMouse } from './input.js';
import { master } from './master.js';
import { update } from './update.js';
import { animatePlayer } from './anim.js';
import { updateHud } from './hud.js';

// ================= loop =================
const DEBUG = new URLSearchParams(location.search).get('debug');    // null when absent
const clock = new THREE.Clock();
function step(dt) {
  update(dt);
  animatePlayer(dt);
  updateFx(dt);
  pressed.clear();
}
// rdt = real seconds since the last frame, capped at 0.05 so one long hiccup cannot fling things through walls.
// dt = game time: the same, except during hitstop, when it is 8% of that (slow motion).
function frame() {
  requestAnimationFrame(frame);
  const rdt = Math.min(clock.getDelta(), 0.05);
  const live = locked || DEBUG !== null;
  if (live) {
    let dt = rdt;
    if (hitstop > 0) { tickHitstop(rdt); dt = rdt * 0.08; }
    step(dt);
  }
  updateCamera(rdt);
  updateDomFx(live ? rdt : 0);
  updateHud(rdt);
  renderer.render(scene, camera);
}
setClass(save.cls, false);
for (const d of dummies) d.update(0);
animatePlayer(0.016);
// ?debug: run without pointer lock and expose internals for testing
if (DEBUG !== null) {
  overlay.style.display = 'none';
  window.SB = { P, dummies, DTYPE, CLASSES, CLASS_ORDER, CH, chal, dlg, keys, pressed, scene, master, setClass, startChallenge, endChallenge,
    hurtPlayer, respawnPlayer, hitDummy, setMouse, step, updateCamera, totalDmg: () => totalDmg,
    get T() { return T; }, get CL() { return CL; } };
  if (DEBUG === 'smoke') import('../tests/smoke.js');
}
frame();
