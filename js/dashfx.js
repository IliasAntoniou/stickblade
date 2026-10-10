// dashfx.js: dashing under a sword style turns the player into that element for the length of the dash.
//   Flame = a rush of smoke and embers,  Thunder = a bolt of lightning,  Water = a stream of water.
// With no style the dash keeps its plain afterimages (update.js).
// The change is never a cut. form.amount runs from 0 (the body) to 1 (all element): the body shrinks into the
// middle of the effect as the dash starts and grows back out of it afterwards, while the element is thickest at
// 1 and thins out as the body returns, with the last of it drawn back in towards the body.
// Purely visual: the dash itself (speed, distance, not being hit) is unchanged.
// Owns: form, the two particle clouds and the pool of lightning segments. Used by: main.js (updateDashForm every
// frame), anim.js (formScale shrinks the body), update.js (hasDashForm switches the afterimages off).

import * as THREE from 'three';
import { V3 } from './util.js';
import { scene } from './core.js';
import { glowTex, beamGeo, setBeam, spawnGlow, spawnRing } from './fx.js';
import { P } from './state.js';
import { style } from './styles.js';

const DISSOLVE_TIME = 0.05;    // seconds for the body to turn into the element when a dash starts
const REFORM_TIME = 0.24;      // seconds for it to come back afterwards. Slower, so the eye can follow it
const SMALLEST = 0.06;         // the size the body shrinks to at the heart of the effect (1 = full size)
const CHEST = 1.0;             // height above the feet of the point the body shrinks into and the effect comes from

// amount = 0 the body, 1 all element. kind = the entry of FORMS in use (kept while the body re-forms, even if the
// style ends meanwhile). dashing = a dash with a form was running last frame.
export const form = { amount: 0, kind: null, dashing: false };

// ---------- particle clouds ----------
// Every particle of a cloud is drawn in one go (one draw call for the whole cloud, however many there are).
// Two clouds: `soft` is drawn normally, so dark smoke and solid-looking water are possible; `bright` adds its
// colour to what is behind it, which reads as light (embers, sparks, glints).
const CLOUD_SIZE = 260;
function makeCloud(blending) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CLOUD_SIZE * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CLOUD_SIZE * 4), 4));    // red, green, blue, opacity
  geo.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(CLOUD_SIZE), 1));
  const mat = new THREE.PointsMaterial({ map: glowTex, size: 1, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending, toneMapped: false });
  // three.js gives every point of a cloud the same size. This adds a size of its own for each one.
  mat.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float psize;\n' + shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * psize;');
  };
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;    // the particles move every frame, so three.js cannot know where the cloud is
  points.visible = false;
  scene.add(points);
  const list = [];
  for (let i = 0; i < CLOUD_SIZE; i++) list.push({ life: 0, max: 1, pos: new V3(), vel: new V3(), size: 0, grow: 0, r: 1, g: 1, b: 1, alpha: 1, fall: 0, drag: 0 });
  return { points, geo, list, next: 0, alive: 0 };
}
export const soft = makeCloud(THREE.NormalBlending);
export const bright = makeCloud(THREE.AdditiveBlending);

const rand = spread => (Math.random() - 0.5) * 2 * spread;
// Add one particle to a cloud. at = where, (vx, vy, vz) = its speed, size = how big (world units), grow = how fast
// it swells (or shrinks, if negative), life = seconds it lasts, rgb = colour as [r, g, b] from 0 to 1,
// alpha = how solid at its strongest, fall = pull downwards (negative rises), drag = how quickly it slows.
function emit(cloud, at, vx, vy, vz, size, grow, life, rgb, alpha, fall, drag) {
  const p = cloud.list[cloud.next = (cloud.next + 1) % CLOUD_SIZE];
  p.pos.copy(at);
  p.vel.set(vx, vy, vz);
  p.size = size; p.grow = grow;
  p.life = p.max = life;
  p.r = rgb[0]; p.g = rgb[1]; p.b = rgb[2];
  p.alpha = alpha; p.fall = fall; p.drag = drag;
}
// Move and fade every particle of a cloud, and hand the result to the graphics card.
function updateCloud(cloud, dt) {
  const pos = cloud.geo.attributes.position.array, col = cloud.geo.attributes.color.array, size = cloud.geo.attributes.psize.array;
  let alive = 0;
  cloud.list.forEach((p, i) => {
    if (p.life <= 0) { size[i] = 0; col[i * 4 + 3] = 0; return; }
    p.life -= dt;
    alive++;
    p.vel.y -= p.fall * dt;
    p.vel.multiplyScalar(Math.exp(-p.drag * dt));
    p.pos.addScaledVector(p.vel, dt);
    p.size = Math.max(0, p.size + p.grow * dt);
    pos[i * 3] = p.pos.x; pos[i * 3 + 1] = p.pos.y; pos[i * 3 + 2] = p.pos.z;
    // appears over its first 0.04 s (so nothing pops into view), then fades over the rest of its life
    const age = p.max - p.life;
    const fade = Math.min(1, age / 0.04) * Math.max(0, p.life / p.max);
    col[i * 4] = p.r; col[i * 4 + 1] = p.g; col[i * 4 + 2] = p.b; col[i * 4 + 3] = p.alpha * fade;
    size[i] = p.size;
  });
  if (alive || cloud.alive) {
    cloud.geo.attributes.position.needsUpdate = true;
    cloud.geo.attributes.color.needsUpdate = true;
    cloud.geo.attributes.psize.needsUpdate = true;
  }
  cloud.alive = alive;
  cloud.points.visible = alive > 0;    // an empty cloud costs nothing
}

// ---------- lightning segments ----------
// A bolt is a chain of short straight pieces, each from where the dash was to where it is, knocked a little off line.
export const bolts = [];
for (let i = 0; i < 18; i++) {
  const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff3a0, blending: THREE.AdditiveBlending, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
  m.visible = false;
  scene.add(m);
  bolts.push({ m, life: 0, max: 0.2, width: 1 });
}
let boltIdx = 0;
function spawnBolt(from, to, width, dur) {
  const b = bolts[boltIdx = (boltIdx + 1) % bolts.length];
  setBeam(b.m, from, to, width);
  b.life = b.max = dur;
  b.width = width;
  b.m.visible = true;
}
function updateBolts(dt) {
  for (const b of bolts) {
    if (b.life <= 0) continue;
    b.life -= dt;
    const k = Math.max(0, b.life / b.max);
    b.m.material.opacity = k;
    b.m.scale.x = b.m.scale.z = b.width * (0.3 + 0.7 * k) * (0.8 + Math.random() * 0.4);    // thins out, flickering
    if (b.life <= 0) b.m.visible = false;
  }
}

// ---------- the three forms ----------
// Colours are [red, green, blue], each 0 to 1.
// (Smoke has to be given as almost black to come out dark grey: these numbers are brightened on the way to the screen.)
const SMOKE = [0.035, 0.03, 0.035], HOT = [0.55, 0.16, 0.03], EMBER = [1, 0.5, 0.12], SPARK = [1, 0.95, 0.55], WATER = [0.05, 0.22, 0.75], GLINT = [0.7, 0.92, 1];
const _at = new V3(), _to = new V3(), _last = new V3();
// Each form: glow = colour of the flash at each end, rate = how many times a second `stream` runs during the dash,
//   stream(at, dir)  = what pours off the player while dashing (at = the chest, dir = the way the dash is going)
//   gather(at)       = one wisp of the element being drawn back into the body as it re-forms
const FORMS = {
  flame: {
    glow: 0xff7a1f, rate: 230,
    stream(at, dir) {
      // a thick puff of dark smoke that swells and drifts upwards, left behind along the path
      _to.set(at.x + rand(0.35), at.y + rand(0.45), at.z + rand(0.35));
      emit(soft, _to, -dir.x * 2 + rand(1), 0.7 + rand(0.6), -dir.z * 2 + rand(1), 1.3 + Math.random() * 0.7, 2.4, 0.55 + Math.random() * 0.35, SMOKE, 1, -0.9, 2);
      // a short-lived glow of heat in the middle of it, where the fire still is
      if (Math.random() < 0.3) emit(bright, _to, -dir.x * 2 + rand(0.6), rand(0.6), -dir.z * 2 + rand(0.6), 0.9, 0.6, 0.16, HOT, 0.8, 0, 2);
      // and embers thrown out of it
      if (Math.random() < 0.5) emit(bright, _to, rand(3.5), rand(3.5) + 1, rand(3.5), 0.34, -0.4, 0.35 + Math.random() * 0.3, EMBER, 1, 3, 1);
    },
    gather(at) {
      _to.set(at.x + rand(0.9), at.y + rand(0.9), at.z + rand(0.9));
      emit(soft, _to, (at.x - _to.x) * 4, (at.y - _to.y) * 4 + 0.5, (at.z - _to.z) * 4, 1.0, 0.8, 0.3, SMOKE, 0.9, -0.5, 1);
    },
  },
  thunder: {
    glow: 0xffe14a, rate: 55,
    stream(at) {
      // the next piece of the bolt, from the end of the last one to a point just off the player's path
      _to.set(at.x + rand(0.4), at.y + rand(0.55), at.z + rand(0.4));
      spawnBolt(_last, _to, 4.6, 0.22);
      // a thin branch forking off to the side
      if (Math.random() < 0.4) {
        _at.set(_to.x + rand(1.3), _to.y + rand(1.1), _to.z + rand(1.3));
        spawnBolt(_to, _at, 1.4, 0.13);
      }
      _last.copy(_to);
      for (let i = 0; i < 3; i++) emit(bright, _to, rand(6), rand(6), rand(6), 0.3, -0.8, 0.14 + Math.random() * 0.12, SPARK, 1, 0, 3);
    },
    gather(at) {
      _to.set(at.x + rand(1.1), at.y + rand(1.1), at.z + rand(1.1));
      emit(bright, _to, (at.x - _to.x) * 7, (at.y - _to.y) * 7, (at.z - _to.z) * 7, 0.28, -0.5, 0.16, SPARK, 1, 0, 0);
      if (Math.random() < 0.3) spawnBolt(_to, at, 1.2, 0.09);    // small arcs snapping back to the body
    },
  },
  water: {
    glow: 0x2f8fff, rate: 240,
    stream(at, dir) {
      // a rope of water: blobs left along the path that sag and fall, with bright drops flung off it
      _to.set(at.x + rand(0.28), at.y + rand(0.38), at.z + rand(0.28));
      emit(soft, _to, -dir.x * 1.5 + rand(0.8), rand(0.8), -dir.z * 1.5 + rand(0.8), 0.6 + Math.random() * 0.35, 0.4, 0.38 + Math.random() * 0.2, WATER, 1, 7, 1);
      if (Math.random() < 0.5) emit(bright, _to, rand(2.5), 1.5 + rand(2), rand(2.5), 0.2, -0.2, 0.3 + Math.random() * 0.15, GLINT, 0.9, 10, 0.5);
    },
    gather(at) {
      // drops rising back up into the body
      _to.set(at.x + rand(0.8), at.y - 0.9 + rand(0.3), at.z + rand(0.8));
      emit(soft, _to, (at.x - _to.x) * 4, 4.5, (at.z - _to.z) * 4, 0.55, -0.6, 0.28, WATER, 1, 4, 0);
    },
  },
};

// Is there a form for the dash right now? (update.js: no plain afterimages while there is.)
export const hasDashForm = () => !!(style.cur && FORMS[style.cur.id]);
// How big to draw the body: 1 normally, down to SMALLEST at the heart of the effect. Eased at both ends so the
// shrinking and the growing back start and stop gently.
export function formScale() {
  const k = form.amount * form.amount * (3 - 2 * form.amount);
  return 1 - k * (1 - SMALLEST);
}
// The body is shrunk around the chest, not the feet: this is how far the feet have to be lifted to do that.
export const formLift = () => (1 - formScale()) * CHEST;

let streamOwed = 0, gatherOwed = 0;
// Once per frame (main.js, after update() and before the player is posed).
export function updateDashForm(dt) {
  const dashing = P.state === 'dash' && hasDashForm();
  _at.set(P.pos.x, P.pos.y + CHEST, P.pos.z);
  if (dashing && !form.dashing) {
    // the moment of leaving: a flash where the body was, and the bolt starts from here
    form.kind = FORMS[style.cur.id];
    spawnGlow(_at, form.kind.glow, 2.4, 0.2);
    _last.copy(_at);
    streamOwed = 3;    // a little of the element straight away, so the body is covered as it shrinks
  }
  if (!dashing && form.dashing) {
    // the moment of arriving: a flash, and for water a ring where it lands
    spawnGlow(_at, form.kind.glow, 2, 0.22);
    if (form.kind === FORMS.water && P.grounded) spawnRing(_to.set(P.pos.x, P.pos.y + 0.05, P.pos.z), 0.3, 2.4, 0.35, 0x2f8fff);
  }
  form.dashing = dashing;
  form.amount = dashing ? Math.min(1, form.amount + dt / DISSOLVE_TIME) : Math.max(0, form.amount - dt / REFORM_TIME);
  if (form.kind) {
    if (dashing) {
      // dt-based, so the stream is as thick at 30 frames a second as at 144
      streamOwed += form.kind.rate * dt;
      while (streamOwed >= 1) { streamOwed -= 1; form.kind.stream(_at, P.dashDir); }
    } else if (form.amount > 0) {
      // re-forming: the element is drawn back in, less and less of it as the body returns
      gatherOwed += 90 * form.amount * dt;
      while (gatherOwed >= 1) { gatherOwed -= 1; form.kind.gather(_at); }
    }
  }
  updateCloud(soft, dt);
  updateCloud(bright, dt);
  updateBolts(dt);
}
