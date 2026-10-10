// sky.js: the dusk sky. One big inside-out sphere painted with a colour gradient, a glowing sun on the horizon and a
// sprinkle of stars. It is centred on the camera every frame, so it always looks infinitely far away.
// Cost: 3 draw calls and no per-frame work beyond moving one group. The colours come from SKY in core.js.

import * as THREE from 'three';
import { scene, camera, SKY, SUN_OFFSET } from './core.js';

const RADIUS = 350;    // must stay inside the camera's far distance (400, see core.js)
const sky = new THREE.Group();
scene.add(sky);

// Where the sun sits in the sky: the same compass direction the sunlight comes from, but pulled down near the horizon.
const sunDir = new THREE.Vector3(SUN_OFFSET.x, 0, SUN_OFFSET.z).normalize().setY(0.16).normalize();

// ---------- the dome ----------
{
  const geo = new THREE.SphereGeometry(RADIUS, 32, 20);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const zenith = new THREE.Color(SKY.zenith), mid = new THREE.Color(SKY.mid), horizon = new THREE.Color(SKY.horizon);
  const below = new THREE.Color(SKY.below), haze = new THREE.Color(SKY.fog);
  const c = new THREE.Color(), dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const up = dir.y;
    // How much this part of the sky faces the sun: 1 = straight at it. The orange only shows on that side.
    const towardSun = Math.pow(Math.max(0, dir.dot(sunDir)), 3);
    if (up >= 0) {
      // from the horizon up: haze or sunset orange, then purple, then deep blue overhead
      c.copy(haze).lerp(horizon, towardSun);
      c.lerp(mid, Math.min(1, up * 3.2));
      c.lerp(zenith, Math.pow(up, 0.75));
    } else {
      c.copy(haze).lerp(horizon, towardSun * 0.6).lerp(below, Math.min(1, -up * 5));
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // BackSide = visible from inside. No fog and no depth writing: it is a backdrop, never in front of anything.
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  dome.renderOrder = -2;
  dome.frustumCulled = false;
  sky.add(dome);
}

// ---------- the sun ----------
{
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,244,214,1)');
  g.addColorStop(0.12, 'rgba(255,214,150,0.95)');
  g.addColorStop(0.35, 'rgba(255,140,70,0.35)');
  g.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  sunSprite.position.copy(sunDir).multiplyScalar(RADIUS - 8);
  sunSprite.scale.setScalar(150);
  sunSprite.renderOrder = -1;
  sky.add(sunSprite);
}

// ---------- stars ----------
{
  const COUNT = 260;
  const pts = new Float32Array(COUNT * 3);
  const dir = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    // random directions in the upper sky only; there are none near the bright horizon
    dir.set(Math.random() * 2 - 1, 0.25 + Math.random() * 0.75, Math.random() * 2 - 1).normalize().multiplyScalar(RADIUS - 5);
    pts[i * 3] = dir.x;
    pts[i * 3 + 1] = dir.y;
    pts[i * 3 + 2] = dir.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false, depthWrite: false, toneMapped: false }));
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  sky.add(stars);
}

// Once per frame (main.js): keep the sky centred on the camera.
export function updateSky() {
  sky.position.copy(camera.position);
}
