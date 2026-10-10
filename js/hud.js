// hud.js: the on-screen display. Skill bar with cooldowns, health bar, combo counter, crosshair, lock-on ring, stats line.
// The HTML and CSS for it are in index.html.

import { clamp, $ } from './util.js';
import { camera } from './core.js';
import { projV } from './fx.js';
import { T, P, CL, dlg, combo, totalDmg, dmgLog, TUNE } from './state.js';
import { REWIND_CD } from './player.js';
import { lockTarget, aimHit } from './camera.js';
import { master } from './master.js';
import { locked } from './input.js';
import { rankOf } from './progress.js';

// ================= HUD =================
export const skEl = $('skills');
export let SK = [];
// Rebuild the skill bar for the current class (called by setClass).
export function buildSkillBar() {
  skEl.innerHTML = ''; const S = CL.skills;
  const defs = [
    { k: 'LMB', n: CL.lmb }, { k: 'RMB', n: S.m2.n, slot: 'm2' }, { k: 'Q', n: S.q.n, slot: 'q' }, { k: 'E', n: S.e.n, slot: 'e' },
    { k: 'R', n: S.r.n, slot: 'r' }, { k: 'F', n: S.f.n, slot: 'f' },
    { k: 'SHIFT', n: 'Dash', dash: true, gap: true }, { k: 'SPACE', n: 'Jump', jump: true }, { k: 'C', n: 'Slide' }, { k: 'X', n: 'Rewind', slot: 'x' },
  ];
  SK = defs.map(s => {
    const el = document.createElement('div'); el.className = 'sk' + (s.gap ? ' gap' : '');
    el.innerHTML = `<div class="cd"></div><b>${s.k}</b><span>${s.n}</span><div class="t"></div><div class="pips"></div>`;
    skEl.appendChild(el);
    return { ...s, el, cdEl: el.querySelector('.cd'), tEl: el.querySelector('.t'), pEl: el.querySelector('.pips'), nEl: el.querySelector('span'), was: 0, altOn: false };
  });
  skEl.style.setProperty('--acc', '#' + CL.color.toString(16).padStart(6, '0'));
}
export const statsEl = $('stats'), comboEl = $('combo'), crossEl = $('cross'), lockEl = $('lock'), hpFill = $('hp').querySelector('.fill'), promptEl = $('prompt');
export let fpsAcc = 0, fpsN = 0, fps = 0, hudT = 0;
// Once per frame: cooldown fills, crosshair, lock-on ring, combo, health. The stats line refreshes ten times a second.
export function updateHud(rdt) {
  for (const s of SK) {
    let frac = 0, txt = '';
    if (s.slot) {
      const max = s.slot === 'x' ? REWIND_CD : CL.skills[s.slot].cd, v = P.cd[s.slot];
      frac = max > 0 ? v / max : 0; txt = v > 0.05 && max > 1 ? (v * TUNE.cdMult).toFixed(1) : '';
      const alt = s.slot !== 'x' && CL.skills[s.slot].alt ? CL.skills[s.slot].alt() : null;
      if (!!alt !== s.altOn) { s.altOn = !!alt; s.el.classList.toggle('alt', s.altOn); s.nEl.textContent = alt || s.n; }
      // Skills with ranks show one diamond per rank, or LOCKED.
      if (s.slot !== 'x' && CL.skills[s.slot].lv) {
        const rank = rankOf(s.slot);
        s.el.classList.toggle('lock', rank === 0);
        s.pEl.textContent = rank ? '◆'.repeat(rank) : 'LOCKED';
      }
    }
    if (s.dash) {
      frac = P.dashCharges === 0 && TUNE.dashCd > 0 ? P.dashRecharge / TUNE.dashCd : 0;
      s.pEl.textContent = '●'.repeat(P.dashCharges) + '○'.repeat(Math.max(0, TUNE.dashCharges - P.dashCharges));
    }
    if (s.jump) { const n = P.grounded ? P.airJumpsMax : P.airJumps; s.pEl.textContent = '●'.repeat(n) + '○'.repeat(P.airJumpsMax - n); }
    s.cdEl.style.height = (clamp(frac, 0, 1) * 100) + '%'; s.tEl.textContent = txt;
    if (s.was > 0 && frac <= 0) { const el = s.el; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 180); }
    s.was = frac;
  }
  crossEl.className = (aimHit || lockTarget) ? 'can' : '';
  if (lockTarget) {
    lockTarget.chest(projV).project(camera);
    lockEl.style.display = 'block';
    lockEl.style.transform = `translate(${(projV.x * 0.5 + 0.5) * innerWidth - 22}px,${(-projV.y * 0.5 + 0.5) * innerHeight - 22}px)`;
  } else lockEl.style.display = 'none';
  comboEl.style.opacity = combo > 1 ? 1 : 0;
  if (combo > 1) comboEl.innerHTML = `${combo}<small>HIT COMBO</small>`;
  const hr = clamp(P.hp / P.maxHp, 0, 1);
  hpFill.style.width = (hr * 100) + '%'; hpFill.style.background = hr > 0.5 ? '#5ee08a' : hr > 0.25 ? '#f2c14e' : '#ff4d4d';
  promptEl.style.display = (master.near && !dlg.open && locked) ? 'block' : 'none';
  fpsAcc += rdt; fpsN++; if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  hudT -= rdt;
  if (hudT <= 0) {
    hudT = 0.1;
    while (dmgLog.length && T - dmgLog[0].t > 5) dmgLog.shift();
    let sum = 0; for (const e of dmgLog) sum += e.d;
    const win = dmgLog.length ? clamp(T - dmgLog[0].t, 1, 5) : 1;
    statsEl.innerHTML = `Speed <span>${Math.hypot(P.vel.x, P.vel.z).toFixed(1)}</span> &nbsp; DPS <span>${Math.round(sum / win)}</span><br>Total dmg <span>${totalDmg}</span> &nbsp; FPS <span>${fps}</span>`;
  }
}
promptEl.innerHTML = '<b>G</b> &nbsp;Talk to Master Sen';
