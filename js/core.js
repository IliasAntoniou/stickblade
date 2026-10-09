// core.js: the three.js basics. renderer draws to the screen, scene holds everything visible, camera is the viewpoint.
// Used by any file that adds objects to the world.

import * as THREE from 'three';

// ================= renderer / scene =================
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// Capped at 1.5 so very sharp screens do not draw four times the pixels. Lower this first if the game runs slowly.
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd9e2);
// Fog hides the far edge of the arena: clear up to 70 units away, fully fogged at 170.
scene.fog = new THREE.Fog(0xcfd9e2, 70, 170);
// 72 = field of view in degrees (updateCamera widens it with speed). 0.1 and 400 = nearest and farthest distance drawn.
export const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8796a3, 1.6));
export const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(30, 60, 20);
scene.add(sun);

// Keep the picture the right shape when the window is resized.
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
