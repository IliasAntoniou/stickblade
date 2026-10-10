// quality.js: the Low / High graphics setting on the pause screen.
//   Low  (default) = the full look at the lowest cost: blob shadows, resolution capped at 1.5x.
//   High = real shadows cast by the sun (the scene is drawn a second time into a shadow map) and resolution up to 2x.
// It is a player setting saved with the rest of the save file. It is not part of the tuning panel, so it never blocks trials.

import * as THREE from 'three';
import { $, save, persist } from './util.js';
import { renderer, scene, sun, SUN_OFFSET } from './core.js';
import { shadowMat } from './world.js';
import { P } from './state.js';

export const quality = { level: 'low' };

// Shadow settings, used only on High. The shadow map covers a square of 2 x SHADOW_REACH units around the player:
// bigger covers more of the map but makes every shadow blurrier.
const SHADOW_REACH = 42;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -SHADOW_REACH;
sun.shadow.camera.right = SHADOW_REACH;
sun.shadow.camera.top = SHADOW_REACH;
sun.shadow.camera.bottom = -SHADOW_REACH;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 180;
// Small offsets that stop surfaces from shadowing themselves in stripes.
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;

const selectEl = $('quality');

// Switch between 'low' and 'high'. Takes effect at once, no reload needed.
export function applyQuality(level) {
  const high = level === 'high';
  quality.level = high ? 'high' : 'low';
  renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = high;
  sun.castShadow = high;
  shadowMat.visible = !high;    // the fake blob shadows are only needed when there are no real ones
  // Materials are compiled with or without shadow support, so they all have to be rebuilt after the switch.
  scene.traverse(o => {
    if (o.material) o.material.needsUpdate = true;
  });
  selectEl.value = quality.level;
  save.quality = quality.level;
  persist();
}

// Once per frame (main.js). On High the sun follows the player so the shadow map always covers where they are.
export function updateQuality() {
  if (quality.level !== 'high') return;
  sun.position.copy(P.pos).add(SUN_OFFSET);
  sun.target.position.copy(P.pos);
}

selectEl.addEventListener('change', () => applyQuality(selectEl.value));
// The pause screen resumes the game on any click, so clicks on the setting must not reach it.
selectEl.addEventListener('click', e => e.stopPropagation());
