// core.js: the three.js basics. renderer draws to the screen, scene holds everything visible, camera is the viewpoint.
// Used by any file that adds objects to the world.

import * as THREE from 'three';

// ================= renderer / scene =================
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// Capped at 1.5 so very sharp screens do not draw four times the pixels. Lower this first if the game runs slowly.
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
// Tone mapping squeezes very bright colours into what a screen can show, the way a camera does: bright things glow
// instead of turning flat white. Exposure is the overall brightness (raise it if the scene feels too dark).
// Materials that should stay pure and vivid (glows, the sky) opt out with toneMapped: false.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

export const scene = new THREE.Scene();
// The dusk palette. zenith = straight up, mid = halfway down, horizon = the sunset glow, below = under the horizon,
// fog = the haze distant things fade into (sky.js paints the sky from these, so fog and sky always match).
export const SKY = { zenith: 0x0d1433, mid: 0x3b3572, horizon: 0xff8f52, below: 0x241f38, fog: 0x57496b };
scene.background = new THREE.Color(SKY.fog);    // only seen if the sky dome is missing
// Fog hides the far edge of the arena: clear up to 70 units away, fully fogged at 170.
scene.fog = new THREE.Fog(SKY.fog, 70, 170);
// 72 = field of view in degrees (updateCamera widens it with speed). 0.1 and 400 = nearest and farthest distance drawn.
export const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 400);
// Two lights make the dusk look: a soft light from all around (cool blue from the sky above, warm brown bounced up
// from the ground) and a low orange sun. Sides facing the sun go warm, sides facing away stay cool: that contrast is
// most of what makes the scene read as evening. The last number of each is its strength.
export const hemi = new THREE.HemisphereLight(0xb0b9ea, 0x6e5444, 2.2);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffb880, 2.6);
// Where the sun stands relative to what it lights: to the left, behind, and fairly low.
export const SUN_OFFSET = new THREE.Vector3(-50, 34, -35);
sun.position.copy(SUN_OFFSET);
scene.add(sun);
scene.add(sun.target);    // the point the sun aims at; quality.js moves it with the player on High

// Keep the picture the right shape when the window is resized.
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
