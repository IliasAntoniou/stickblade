import * as THREE from 'three';
import { _a, _fx, $, save, persist } from './util.js';
import { scene } from './core.js';
import { rings, spawnRing, burst, centerT, centerMsg } from './fx.js';
import { T, P, CL, chal, combo, resetCombo } from './state.js';
import { dummies } from './dummies.js';
import { respawnPlayer } from './player.js';
import { closeDlg } from './master.js';

// ================= challenges =================
export const RING_PTS = [[0, 2.5, 2], [-12, 7, -4], [-22, 12.5, 2], [-20, 13, -14], [0, 15, -30], [12, 11, -12], [18, 16, 4], [40, 7.5, 8], [28, 12, 24], [0, 3, 24]];
export const courseGeo = new THREE.TorusGeometry(2.0, 0.13, 8, 36);
export const courseRings = RING_PTS.map((p, i) => {
  const m = new THREE.Mesh(courseGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
  m.position.set(p[0], p[1], p[2]);
  const o = RING_PTS[i < RING_PTS.length - 1 ? i + 1 : i - 1]; m.lookAt(o[0], o[1], o[2]);
  m.visible = false; scene.add(m); return m;
});
export const CH = [
  { id: 'rings', name: 'Sky Rings', desc: 'Pass through 10 rings in order' },
  { id: 'summit', name: 'Summit', desc: 'Reach the flag on top of the great pillar' },
  { id: 'demo', name: 'Demolition', desc: 'K.O. 3 dummies' },
  { id: 'combo', name: 'Combo 50', desc: 'Land a 50-hit combo without dropping it' },
];
export const chalEl = $('chal');
export function startChallenge(c) {
  closeDlg();
  for (const d of dummies) d.respawn(false);
  respawnPlayer();
  resetCombo();
  chal.cur = c; chal.phase = 'count'; chal.t = 3; chal.ring = 0; chal.kos = 0;
  if (c.id === 'rings') for (const r of courseRings) r.visible = true;
  chalEl.style.display = 'block';
}
export function endChallenge() {
  chal.cur = null; chal.phase = 'none';
  for (const r of courseRings) r.visible = false;
  chalEl.style.display = 'none';
}
export function finishChallenge() {
  const c = chal.cur, t = chal.t, old = save.best[c.id], isBest = !old || t < old;
  if (isBest) { save.best[c.id] = t; persist(); }
  centerMsg(`${c.name} complete<small>${t.toFixed(2)}s${isBest ? ' · NEW BEST!' : ` · best ${old.toFixed(2)}s`}</small>`, 3.5);
  spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.5, 6, 0.6, 0xffd23f); burst(_fx.setY(P.pos.y + 1), 30, 12);
  endChallenge();
}
export function updateChallenge(dt) {
  const c = chal.cur; if (!c) return;
  if (chal.phase === 'count') {
    const before = Math.ceil(chal.t); chal.t -= dt;
    if (chal.t <= 0) { chal.phase = 'run'; chal.t = 0; centerMsg('GO!', 0.7); }
    else if (Math.ceil(chal.t) !== before || centerT <= 0) centerMsg(String(Math.ceil(chal.t)), 0.9);
    chalEl.innerHTML = `${c.name}<small>${c.desc}</small>`;
    return;
  }
  chal.t += dt;
  let prog = '', done = false;
  if (c.id === 'rings') {
    const r = courseRings[chal.ring];
    if (_a.copy(P.pos).setY(P.pos.y + 1).distanceTo(r.position) < 2.4) {
      r.visible = false; spawnRing(_fx.copy(r.position), 0.5, 3, 0.3, CL.color); chal.ring++;
      if (chal.ring >= courseRings.length) done = true;
    }
    courseRings.forEach((m, i) => {
      if (!m.visible) return;
      const cur = i === chal.ring;
      m.material.color.setHex(cur ? 0xffd23f : 0xffffff); m.material.opacity = cur ? 0.95 : 0.25;
      m.scale.setScalar(cur ? 1 + Math.sin(T * 6) * 0.06 : 0.85);
    });
    prog = `Ring ${Math.min(chal.ring + 1, courseRings.length)} / ${courseRings.length}`;
  } else if (c.id === 'summit') {
    prog = `Height ${P.pos.y.toFixed(0)} / 26`;
    done = P.grounded && P.pos.y > 25.8 && Math.abs(P.pos.x) < 2.7 && Math.abs(P.pos.z + 46) < 2.7;
  } else if (c.id === 'demo') {
    prog = `K.O. ${chal.kos} / 3`; done = chal.kos >= 3;
  } else if (c.id === 'combo') {
    prog = `Combo ${combo} / 50`; done = combo >= 50;
  }
  chalEl.innerHTML = `${c.name}<div class="tm">${chal.t.toFixed(2)}</div><small>${prog}</small>`;
  if (done) finishChallenge();
}
