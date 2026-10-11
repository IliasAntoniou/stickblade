// dashfx.js: dashing under a sword style turns the player into that element for the length of the dash.
//   Flame = ribbons of flame streaming back from a swarm of embers,  Thunder = a zigzag bolt of lightning,
//   Water = a torrent that surges and sags, with a head of water and spray.
// In each the player is one continuous shape reaching from where they are back along their path: that is what
// makes it read as BEING the element, where puffs left behind only read as a trail.
// With no style the dash keeps its plain afterimages (update.js).
// The change is never a cut. form.amount runs from 0 (the body) to 1 (all element): the body shrinks into the
// middle of the effect as the dash starts and grows back out of it afterwards, while the element is thickest at
// 1 and thins out as the body returns, with the last of it drawn back in towards the body.
// Purely visual: the dash itself (speed, distance, not being hit) is unchanged.
// Owns: form, the two particle clouds, the ribbons and the pool of lightning segments. Used by: main.js (updateDashForm every
// frame), anim.js (formScale shrinks the body), update.js (hasDashForm switches the afterimages off).

import * as THREE from 'three';
import { V3 } from './util.js';
import { scene, camera } from './core.js';
import { glowTex, beamGeo, setBeam, spawnGlow, spawnRing } from './fx.js';
import { P } from './state.js';
import { style } from './styles.js';

const DISSOLVE_TIME = 0.05;    // seconds for the body to turn into the element when a dash starts
const REFORM_TIME = 0.24;      // seconds for it to come back afterwards. Slower, so the eye can follow it
const SMALLEST = 0.06;         // the size the body shrinks to at the heart of the effect (1 = full size)
const CHEST = 1.0;             // height above the feet of the point the body shrinks into and the effect comes from

// amount = 0 the body, 1 all element. kind = the entry of FORMS in use (kept while the body re-forms, even if the
// style ends meanwhile). dashing = a dash with a form was running last frame. time = seconds since that dash began.
export const form = { amount: 0, kind: null, dashing: false, time: 0 };

// ---------- particle clouds ----------
// Every particle of a cloud is drawn in one go (one draw call for the whole cloud, however many there are).
// Two clouds: `soft` is drawn normally, so dark smoke and solid-looking water are possible; `bright` adds its
// colour to what is behind it, which reads as light (embers, sparks, glints).
const CLOUD_SIZE = 420;
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
bright.points.renderOrder = 2;    // light is drawn after smoke, so smoke never blots out the fire inside it
soft.points.renderOrder = 1;

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
// (These numbers are brightened on the way to the screen: smoke has to be given as almost black to come out dark
// grey, and orange needs far less green than it looks like it should.)
const SMOKE = [0.035, 0.03, 0.035], HOT = [1, 0.13, 0.01], EMBER = [1, 0.2, 0.02], CORE = [1, 0.5, 0.12], SPARK = [1, 0.95, 0.55], WATER = [0.05, 0.22, 0.75], GLINT = [0.7, 0.92, 1];
const _at = new V3(), _to = new V3(), _last = new V3();
// _side and _up point across the line of the dash (to its right, and upwards from it): the ribbons are pushed
// off the path along them.
const _side = new V3(), _up = new V3();
const HEAD_PACE = 26;    // how fast the swarm at the front is thrown forward (the dash itself travels at 34)

// ---------- ribbons ----------
// What makes the player look like they ARE the element, not something leaving a trail: long flowing strips that
// start at the player and stream back along the path they have just taken, the way the lightning is one bolt.
// The path is remembered as a short list of points, newest first. Every ribbon follows that same path, each
// pushed off it in its own slowly waving way, so together they move like silk or like water in a current.
// All the ribbons are one shape, rebuilt every frame: one draw call.
const PATH_POINTS = 18;      // how many points of the path are remembered
const PATH_GAP = 0.013;      // seconds between remembered points, so a fast screen does not use them all up at once
const SMOOTH = 3;            // each stretch between two remembered points is drawn as this many pieces, so curves are round
const RIBBON_POINTS = (PATH_POINTS - 1) * SMOOTH + 1;
const MAX_RIBBONS = 8;
// How each element's ribbons look. count = how many, life = seconds a part of a ribbon lasts before it has faded,
// width = how wide the widest one is at the head, solid = true draws them as a body (water), false as light (fire),
// bend(n, age, out) = how far ribbon number n is pushed off the path, sideways (out.x) and upwards (out.y), at a
//   point that is `age` seconds old,
// tint(age, out) = its colour there as out.x, out.y, out.z (red, green, blue).
const RIBBONS = {
  flame: {
    count: 8, life: 0.5, width: 0.95, solid: false,
    // Silk in a wind: each ribbon swings from side to side on its own beat. It opens out a little over the
    // length of the dash and then holds that width: `open` levels off, so the ribbons go on waving as they fade
    // but stay a compact bundle and do not keep spreading (they used to end up three times as wide).
    bend(n, age, out) {
      const open = 1 - Math.exp(-age * 9);    // 0 at the head, close to 1 from about a quarter of a second on
      const spread = 0.1 + open * 0.42;
      const sway = Math.sin(n * 2.4 + age * 26 + form.time * 7) * 0.55 + Math.sin(n * 0.9 + age * 11) * 0.45;
      out.x = sway * spread + (n - 3.5) * (0.07 + open * 0.11);
      out.y = Math.cos(n * 1.7 + age * 19 + form.time * 5) * spread * 0.45 + open * 0.35 + ((n * 7) % 5 - 2) * 0.11;
    },
    // pale gold at the head, quickly through orange, to a deep red at the tail
    tint(age, out) {
      const k = Math.min(1, age / 0.26), cool = (1 - k) * (1 - k);
      out.set(1, 0.2 * cool + 0.012, 0.035 * cool);
    },
  },
  water: {
    count: 5, life: 0.4, width: 0.85, solid: true,
    // A torrent: keeps close to the path, rolls like a wave, and sags under its own weight as it ages.
    bend(n, age, out) {
      out.x = Math.sin(n * 1.9 + age * 17 + form.time * 4) * (0.08 + age * 1.3) + (n - 2) * 0.17;
      out.y = Math.sin(age * 30 + n * 1.3) * 0.26 - age * age * 11 + (n % 2) * 0.14;
    },
    // near white at the head, deepening to blue
    tint(age, out) {
      const k = Math.min(1, age / 0.2), pale = (1 - k) * (1 - k);
      out.set(0.3 * pale + 0.02, 0.4 * pale + 0.13, 0.95);
    },
  },
};
// Each ribbon's own share of the full width and brightness, so they are not all alike: a few broad ones and
// several thin wisps.
const RIBBON_WIDTH = [1, 0.45, 0.8, 0.3, 0.65, 0.38, 0.9, 0.28];
const RIBBON_GLOW = [0.75, 1, 0.6, 1, 0.8, 0.95, 0.55, 1];
// The picture on every ribbon: see-through at both edges, with fine streaks running along its length, which is
// what makes a flat strip read as flowing flame or running water. Across the ribbon is left to right in the
// picture; along it is top to bottom.
const ribbonTex = (() => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 8;
  const x = c.getContext('2d');
  for (let px = 0; px < 64; px++) {
    const across = Math.sin(px / 63 * Math.PI);                       // 0 at the edges, 1 in the middle
    const streak = 0.55 + 0.45 * Math.sin(px * 1.9) * Math.sin(px * 0.73 + 1);    // fine uneven lines
    const alpha = Math.pow(across, 1.6) * Math.max(0.15, streak);
    x.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    x.fillRect(px, 0, 1, 8);
  }
  return new THREE.CanvasTexture(c);
})();
const path = [];
for (let i = 0; i < PATH_POINTS; i++) path.push({ pos: new V3(), side: new V3(), up: new V3(), dir: new V3(), born: 0 });
let pathCount = 0;        // how many points of the path are in use (they are kept newest first)
let ribbonClock = 0;      // seconds, counted here so the ribbons age in game time
let ribbonLook = null;    // the entry of RIBBONS being drawn
const ribbonGeo = new THREE.BufferGeometry();
{
  const corners = MAX_RIBBONS * RIBBON_POINTS * 2;
  ribbonGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(corners * 3), 3));
  ribbonGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(corners * 4), 4));    // red, green, blue, opacity
  // which part of the picture each corner shows: one edge of the ribbon or the other
  const uv = new Float32Array(corners * 2);
  for (let v = 0; v < corners; v++) { uv[v * 2] = v % 2; uv[v * 2 + 1] = 0.5; }
  ribbonGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // each ribbon is a row of four-cornered pieces joining one point to the next
  const index = [];
  for (let r = 0; r < MAX_RIBBONS; r++) {
    for (let k = 0; k < RIBBON_POINTS - 1; k++) {
      const a = (r * RIBBON_POINTS + k) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  ribbonGeo.setIndex(index);
}
export const ribbons = new THREE.Mesh(ribbonGeo, new THREE.MeshBasicMaterial({ map: ribbonTex, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }));
ribbons.frustumCulled = false;    // rebuilt every frame, so three.js cannot know where it is
ribbons.visible = false;
ribbons.renderOrder = 2;
scene.add(ribbons);

// Remember where the dash is now. The newest point always follows the player; a new one is started only every
// PATH_GAP seconds.
// grow = false (the dash is over, the body is coming back): nothing new is added. The front end of the ribbons
// only keeps hold of the player, and the rest goes on waving and fading as it was. Adding to them here made a
// fresh, bright length of ribbon pour out behind the player after the dash had finished.
function recordPath(at, grow) {
  if (!grow) {
    if (pathCount > 0) path[0].pos.copy(at);
    return;
  }
  if (pathCount === 0 || ribbonClock - path[Math.min(1, pathCount - 1)].born >= PATH_GAP || pathCount === 1) {
    const oldest = path.pop();
    path.unshift(oldest);
    pathCount = Math.min(PATH_POINTS, pathCount + 1);
  }
  const head = path[0];
  head.pos.copy(at);
  head.side.copy(_side);
  head.up.copy(_up);
  head.dir.copy(P.dashDir);
  head.born = ribbonClock;
}
const _bend = new V3(), _tint = new V3(), _mid = new V3(), _across = new V3(), _toEye = new V3();
// Rebuild the ribbons from the path. Runs every frame while any of the path is still young enough to show.
function updateRibbons(dt) {
  ribbonClock += dt;
  const look = ribbonLook;
  // points older than the ribbon's life have faded completely: forget them
  while (look && pathCount > 0 && ribbonClock - path[pathCount - 1].born > look.life) pathCount--;
  if (!look || pathCount < 2) {
    ribbons.visible = false;    // a ribbon needs two points; the first frame of a dash has only one
    return;
  }
  const pos = ribbonGeo.attributes.position.array, col = ribbonGeo.attributes.color.array;
  const last = (pathCount - 1) * SMOOTH;    // the last drawn point of each ribbon
  for (let r = 0; r < MAX_RIBBONS; r++) {
    for (let k = 0; k < RIBBON_POINTS; k++) {
      const corner = (r * RIBBON_POINTS + k) * 2;
      // past the end of this ribbon (or a ribbon this element does not have): fold everything onto the last
      // real point, see-through, so nothing is drawn
      const used = r < look.count && k <= last;
      // where along the remembered path this point is: between point `from` and the next one
      const along = Math.min(k, last) / SMOOTH;
      const from = Math.min(Math.floor(along), pathCount - 2), part = along - from;
      const a = path[from], b = path[from + 1];
      const age = ribbonClock - (a.born + (b.born - a.born) * part);
      look.bend(r, age, _bend);
      _mid.copy(a.pos).lerp(b.pos, part).addScaledVector(a.side, _bend.x).addScaledVector(a.up, _bend.y);
      // The strip is turned to face the camera: its width runs across both the path and the line of sight.
      _toEye.copy(camera.position).sub(_mid);
      _across.crossVectors(a.dir, _toEye);
      if (_across.lengthSq() < 0.0001) _across.copy(a.up);
      _across.normalize();
      const fade = Math.max(0, 1 - age / look.life);
      // wide near the head, tapering to a point at the tail; the very front is pinched so it grows out of the body
      const half = used ? look.width * RIBBON_WIDTH[r] * 0.5 * Math.pow(fade, 0.6) * Math.min(1, 0.2 + age * 16) : 0;
      look.tint(age, _tint);
      const opacity = used ? fade * RIBBON_GLOW[r] : 0;
      for (let side = 0; side < 2; side++) {
        const v = corner + side, sign = side ? 1 : -1;
        pos[v * 3] = _mid.x + _across.x * half * sign;
        pos[v * 3 + 1] = _mid.y + _across.y * half * sign;
        pos[v * 3 + 2] = _mid.z + _across.z * half * sign;
        col[v * 4] = _tint.x; col[v * 4 + 1] = _tint.y; col[v * 4 + 2] = _tint.z;
        col[v * 4 + 3] = opacity;
      }
    }
  }
  ribbonGeo.attributes.position.needsUpdate = true;
  ribbonGeo.attributes.color.needsUpdate = true;
  ribbons.material.blending = look.solid ? THREE.NormalBlending : THREE.AdditiveBlending;
  ribbons.visible = true;
}

// Each form: glow = colour of the flash at each end, rate = how many times a second `stream` runs during the dash,
//   stream(at, dir, t) = what pours off the player while dashing (at = the chest, dir = the way the dash is
//                      going, t = seconds since it began). Fire and water also have ribbons (RIBBONS, above)
//   gather(at)       = one wisp of the element being drawn back into the body as it re-forms
const FORMS = {
  flame: {
    glow: 0xff7a1f, rate: 520,
    // The player IS the fire: long ribbons of flame stream back from where they are (see RIBBONS), and at the
    // front a dense swarm of embers travels with them. Only a little smoke is left behind.
    stream(at, dir) {
      // the swarm: tiny bright embers thrown forward at nearly the speed of the dash, so they stay around the
      // head and spill out ahead of it when it stops
      _to.set(at.x + rand(0.5), at.y + rand(0.6), at.z + rand(0.5));
      const pace = HEAD_PACE * (0.75 + Math.random() * 0.4);
      emit(bright, _to, dir.x * pace + rand(3), dir.y * pace + rand(3) + 0.5, dir.z * pace + rand(3), 0.13 + Math.random() * 0.12, -0.15, 0.22 + Math.random() * 0.3, Math.random() < 0.3 ? CORE : EMBER, 1, 2.5, 2.2);
      // dark flecks of ash among them
      if (Math.random() < 0.3) emit(soft, _to, dir.x * pace * 0.8 + rand(3), dir.y * pace * 0.8 + rand(3), dir.z * pace * 0.8 + rand(3), 0.12, 0, 0.4, SMOKE, 1, 5, 1.5);
      // a thin wisp of smoke left on the path
      if (Math.random() < 0.08) emit(soft, _to, rand(0.6), 0.9, rand(0.6), 0.8, 1.8, 0.5, SMOKE, 0.45, -1, 2);
    },
    gather(at) {
      // embers falling back in towards the body
      _to.set(at.x + rand(1.1), at.y + rand(1), at.z + rand(1.1));
      emit(bright, _to, (at.x - _to.x) * 6, (at.y - _to.y) * 6, (at.z - _to.z) * 6, 0.16, -0.2, 0.2, EMBER, 1, 0, 0);
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
    glow: 0x2f8fff, rate: 300,
    // The player IS the water: a thick torrent (see RIBBONS) that surges along the path and sags as it ages, with
    // a head of water travelling at the front and spray thrown up off it.
    stream(at, dir) {
      _to.set(at.x + rand(0.3), at.y + rand(0.35), at.z + rand(0.3));
      const pace = HEAD_PACE * (0.8 + Math.random() * 0.3);
      // the head: blobs of water carried along with the dash
      emit(soft, _to, dir.x * pace + rand(1.5), dir.y * pace + rand(1.5), dir.z * pace + rand(1.5), 0.5 + Math.random() * 0.3, -0.6, 0.2 + Math.random() * 0.15, WATER, 1, 6, 2);
      // spray: bright drops thrown up and out, falling in arcs
      if (Math.random() < 0.6) emit(bright, _to, dir.x * pace * 0.6 + rand(3), 2.5 + Math.random() * 3, dir.z * pace * 0.6 + rand(3), 0.17, -0.1, 0.4 + Math.random() * 0.2, GLINT, 0.95, 14, 0.6);
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
    ribbonLook = RIBBONS[style.cur.id] || null;
    pathCount = 0;
    spawnGlow(_at, form.kind.glow, 2.4, 0.2);
    _last.copy(_at);
    form.time = 0;
    streamOwed = 3;    // a little of the element straight away, so the body is covered as it shrinks
  }
  if (!dashing && form.dashing) {
    // the moment of arriving: a flash, and for water a ring where it lands
    spawnGlow(_at, form.kind.glow, 2, 0.22);
    if (form.kind === FORMS.water && P.grounded) spawnRing(_to.set(P.pos.x, P.pos.y + 0.05, P.pos.z), 0.3, 2.4, 0.35, 0x2f8fff);
  }
  form.dashing = dashing;
  if (dashing) form.time += dt;
  form.amount = dashing ? Math.min(1, form.amount + dt / DISSOLVE_TIME) : Math.max(0, form.amount - dt / REFORM_TIME);
  if (form.kind) {
    // The ribbons stay joined to the player for the dash and for the first part of coming back, so the body is
    // seen to grow out of the front of them and not appear beside them.
    if (ribbonLook && (dashing || form.amount > 0.3)) {
      // across the dash: to its right, and up from it (for a dash straight up or down, any sideways will do)
      _side.set(P.dashDir.z, 0, -P.dashDir.x);
      if (_side.lengthSq() < 0.01) _side.set(1, 0, 0);
      _side.normalize();
      _up.crossVectors(P.dashDir, _side).normalize();
      if (_up.y < 0) _up.negate();
      recordPath(_at, dashing);
    }
    if (dashing) {
      // dt-based, so the stream is as thick at 30 frames a second as at 144
      streamOwed += form.kind.rate * dt;
      while (streamOwed >= 1) {
        streamOwed -= 1;
        // spread this frame's share along the frame's time, so fast shapes are drawn smoothly, not in steps
        form.kind.stream(_at, P.dashDir, form.time - streamOwed / form.kind.rate);
      }
    } else if (form.amount > 0) {
      // re-forming: the element is drawn back in, less and less of it as the body returns
      gatherOwed += 90 * form.amount * dt;
      while (gatherOwed >= 1) { gatherOwed -= 1; form.kind.gather(_at); }
    }
  }
  updateCloud(soft, dt);
  updateCloud(bright, dt);
  updateBolts(dt);
  updateRibbons(dt);
}
