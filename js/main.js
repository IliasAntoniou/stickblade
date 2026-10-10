// main.js: the entry point. Loads every module, then runs frame() once per screen refresh.

// base layer first: other modules may use these at their top level, and nothing else
import './util.js';
import './core.js';
import './world.js';
import './stickman.js';
import './state.js';
import './fx.js';
import * as THREE from 'three';
import { save, DEBUG } from './util.js';
import { renderer, scene, camera } from './core.js';
import { hitstop, updateFx, updateDomFx, tickHitstop, flash, trail, arcs, swirls } from './fx.js';
import { T, P, CL, dlg, chal, CLASSES, TUNE, totalDmg, setHitSrc } from './state.js';
import { solids } from './world.js';
import { dummies, hitDummy, DTYPE } from './dummies.js';
import { hurtPlayer, respawnPlayer } from './player.js';
import { updateCamera, setCamYaw, setCamPitch, setCamDist } from './camera.js';
import { CLASS_ORDER, setClass } from './classes/index.js';
import { CH, startChallenge, endChallenge } from './challenges.js';
import { keys, pressed, locked, overlay, setMouse } from './input.js';
import { master, strikeMaster, openDlg, renderDlg } from './master.js';
import { update } from './update.js';
import { animatePlayer } from './anim.js';
import { updateHud } from './hud.js';
import { initTuning, applyTune, resetTuning } from './tuning.js';
import { initProgress, rankOf, startTrial, unlockAll, resetProgress } from './progress.js';
import { DOJO, dojo, enterDojo, leaveDojo, setupTrial, clearTrial } from './dojo.js';
import { updateSky } from './sky.js';
import { STYLES, style, sources, outfit, giveStyle, forceStyle, clearStyle, reach, styleSpeed, updateStyles, startTake } from './styles.js';
import { lockFire, lockTarget } from './camera.js';
import { styleUnlocked } from './progress.js';
import { cutinActive, playCutin } from './cutin.js';
import { playerMat, player } from './player.js';
import { quality, applyQuality, updateQuality } from './quality.js';

// ================= loop =================
const clock = new THREE.Clock();
let frozen = false;    // debug only: stops the game advancing so a moment can be looked at (see tests/poses.js)
function step(dt) {
  update(dt);
  updateStyles(dt);
  animatePlayer(dt);
  updateFx(dt);
  pressed.clear();
}
// rdt = real seconds since the last frame, capped at 0.05 so one long hiccup cannot fling things through walls.
// dt = game time: the same, except during hitstop, when it is 8% of that (slow motion).
function frame() {
  requestAnimationFrame(frame);
  const rdt = Math.min(clock.getDelta(), 0.05);
  // The game holds still while the close-up of the eyes is on screen (taking a sword style).
  const live = (locked || DEBUG !== null) && !frozen && !cutinActive();
  if (live) {
    let dt = rdt * TUNE.timeScale;
    if (hitstop > 0) { tickHitstop(rdt); dt *= 0.08; }
    step(dt);
  }
  updateCamera(rdt);
  updateDomFx(live ? rdt : 0);
  updateHud(rdt);
  updateSky();
  updateQuality();
  renderer.render(scene, camera);
}
initProgress();  // loads saved skill ranks and puts each skill's numbers in place; must come before initTuning
initTuning();    // loads saved tuning; must come before the first setClass
setClass(save.cls, false);
applyTune();
applyQuality(save.quality);
for (const d of dummies) d.update(0);
animatePlayer(0.016);
// ?debug: run without pointer lock and expose internals for testing
if (DEBUG !== null) {
  overlay.style.display = 'none';
  window.SB = { styleSpeed, solids, strikeMaster, openDlg, renderDlg, lockFire: () => lockFire, lockTarget: () => lockTarget, player, outfit, startTake, playCutin, playerMat, STYLES, style, sources, giveStyle, forceStyle, clearStyle, reach, styleUnlocked, freeze: v => { frozen = v; }, setCamYaw, setCamPitch, setCamDist, trail, arcs, swirls, renderer, camera, quality, applyQuality, P, dummies, DTYPE, CLASSES, CLASS_ORDER, CH, chal, dlg, keys, pressed, scene, master, setClass, startChallenge, endChallenge,
    hurtPlayer, respawnPlayer, hitDummy, setMouse, step, updateCamera, updateHud, TUNE, applyTune, resetTuning, rankOf, startTrial, unlockAll, resetProgress, setHitSrc, DOJO, dojo, enterDojo, leaveDojo, setupTrial, clearTrial, totalDmg: () => totalDmg,
    get T() { return T; }, get CL() { return CL; } };
  // &quality=high (with ?debug) switches the graphics setting for this visit, for screenshots.
  const wantQuality = new URLSearchParams(location.search).get('quality');
  if (wantQuality) applyQuality(wantQuality);
  if (DEBUG === 'smoke') import('../tests/smoke.js');
  if (DEBUG.startsWith('pose:')) import('../tests/poses.js');
  // ?debug=hall:blade-r1 goes straight to the training hall dressed for that trial, to look at a layout.
  if (DEBUG.startsWith('hall:')) {
    const wanted = CLASSES.blade.trials.find(t => t.id === DEBUG.slice(5));
    enterDojo();
    if (wanted) setupTrial(wanted);
    flash(0);    // no teleport flash, so a screenshot shows the hall
  }
}
frame();
