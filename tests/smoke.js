// Smoke test: open index.html?debug=smoke. Drives the game through window.SB with no pointer lock,
// then writes the result to <pre id="smoke"> and the page title (SMOKE PASS / SMOKE FAIL).
const SB = window.SB;
const { P, dummies, pressed, chal, dlg } = SB;
const DT = 1 / 60;
const fails = [], log = [];
addEventListener('error', e => fails.push('uncaught: ' + e.message));

function run(n = 60) { for (let i = 0; i < n; i++) { SB.updateCamera(DT); SB.step(DT); } }
function press(code, n = 30) { pressed.add(code); run(n); }
function check(name, fn) {
  try {
    const r = fn();
    if (r === false) fails.push(name + ': check failed');
  } catch (e) { fails.push(name + ': ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
  if (![P.pos.x, P.pos.y, P.pos.z, P.vel.x, P.vel.y, P.vel.z, P.hp].every(Number.isFinite)) fails.push(name + ': player state is not finite');
  for (const d of dummies) if (![d.pos.x, d.pos.y, d.pos.z, d.hp].every(Number.isFinite)) { fails.push(name + ': dummy state is not finite'); break; }
}
function reset() {
  SB.setMouse(false, false);
  if (chal.cur) SB.endChallenge();
  SB.respawnPlayer(); P.iframes = 0;
  for (const d of dummies) d.respawn(false);
  P.pos.set(0, 0, -3);    // in the middle of the three practice dummies
  for (const k in P.cd) P.cd[k] = 0;
  run(5);
}

SB.unlockAll();    // the general checks below need every skill usable; progression has its own checks at the end

// every class: basic combo, each skill twice (second press covers recall / swap / release), movement
for (const id of SB.CLASS_ORDER) {
  check(id + ' setClass', () => { SB.setClass(id); return SB.CL.id === id; });
  check(id + ' combo', () => { reset(); const before = SB.totalDmg(); for (let i = 0; i < 6; i++) press('M0', 14); return SB.totalDmg() > before; });
  for (const code of ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'M2']) {
    check(id + ' ' + code, () => { reset(); press(code, 20); press(code, 100); });
    check(id + ' ' + code + ' in the air', () => { reset(); press('Space', 12); press(code, 120); });
  }
  check(id + ' hold LMB', () => { reset(); SB.setMouse(true, false); run(90); SB.setMouse(false, false); });
  check(id + ' hold RMB', () => { reset(); SB.setMouse(false, true); pressed.add('M2'); run(90); SB.setMouse(false, false); run(30); });
  check(id + ' movement', () => {
    reset(); SB.keys.add('KeyW');
    press('ShiftLeft', 6); press('Space', 40); press('Space', 40); press('ShiftLeft', 30);
    SB.keys.add('KeyC'); press('KeyC', 30); press('Space', 60); SB.keys.delete('KeyC');
    press('KeyX', 30); SB.keys.delete('KeyW'); run(60);
  });
  check(id + ' takes a hit', () => { reset(); const hp = P.hp; SB.hurtPlayer(10, dummies[0].pos, dummies[0]); run(10); return P.hp < hp; });
}

// monk parry: block, then get hit inside the parry window
check('monk parry', () => {
  SB.setClass('monk'); reset();
  const f = dummies.find(d => d.type === 'fighter');
  SB.setMouse(false, true); pressed.add('M2'); run(3);
  const hp = P.hp; SB.hurtPlayer(15, f.pos, f); run(30); SB.setMouse(false, false);
  return P.hp === hp && f.stunT > 0;
});

// every dummy type: take a hit from behind / above, get knocked out, come back
for (const type of Object.keys(SB.DTYPE)) {
  check('dummy ' + type, () => {
    reset();
    const d = dummies.find(d => d.type === type);
    if (!d) return false;
    const hp = d.hp;
    SB.hitDummy(d, 30, 3, 0, 5, true, null, P.pos, true); run(20);
    if (!(d.hp < hp)) return false;
    SB.hitDummy(d, 99999, 3, 0, 5, true, null, P.pos, true);
    if (!d.dead) return false;
    run(150);
    return !d.dead && d.hp === d.maxHp;
  });
}

// a fighter attacks a player who stands next to it
check('fighter attacks', () => {
  SB.setClass('blade'); reset();
  const f = dummies.find(d => d.type === 'fighter');
  P.pos.set(f.pos.x + 2, f.pos.y, f.pos.z); P.iframes = 0;
  let hurt = false;
  for (let i = 0; i < 600 && !hurt; i++) { run(1); hurt = P.hp < P.maxHp; }
  return hurt;
});
check('player defeated', () => { reset(); SB.hurtPlayer(9999, dummies[0].pos, dummies[0]); run(30); return P.hp === P.maxHp; });

// challenges: count in, run, quit
for (const c of SB.CH) {
  check('challenge ' + c.id, () => {
    reset(); SB.startChallenge(c); run(200);
    if (chal.phase !== 'run') return false;
    run(60); SB.endChallenge();
    return chal.cur === null;
  });
}

// Master Sen: open the dialog and pick a class from it
check('master dialog', () => {
  SB.setClass('blade'); reset();
  P.pos.copy(SB.master.pos); P.pos.z -= 2; P.vel.set(0, 0, 0); run(2);
  press('KeyG', 2); if (!dlg.open) return false;
  press('Digit1', 2); if (dlg.page !== 'classes') return false;
  press('Digit2', 2);
  return !dlg.open && SB.CL.id === 'ninja';
});
check('class is saved', () => JSON.parse(localStorage.getItem('stickblade.v2')).cls === 'ninja');
SB.setClass('blade');

// tuning: each number has to change the game for real, and reset has to undo it
const TUNE = SB.TUNE;
function jumpApex() {
  reset(); pressed.add('Space');
  let top = 0;
  for (let i = 0; i < 120; i++) { run(1); top = Math.max(top, P.pos.y); }
  return top;
}
function hitFor100() {
  reset();
  const d = dummies[0], hp = d.hp;
  SB.hitDummy(d, 100, 0, 0, 0, false, null, P.pos, true);
  return hp - d.hp;
}
check('tune jump power', () => {
  const normal = jumpApex(); TUNE.jump = 26; const high = jumpApex(); SB.resetTuning(); const back = jumpApex();
  return high > normal * 2 && Math.abs(back - normal) < 0.2;
});
check('tune gravity', () => { const normal = jumpApex(); TUNE.gravity = 72; const low = jumpApex(); SB.resetTuning(); return low < normal * 0.7; });
check('tune damage dealt', () => { TUNE.dmgMult = 3; const dmg = hitFor100(); SB.resetTuning(); return dmg > 250 && hitFor100() < 120; });
check('tune dummy health', () => {
  TUNE.dummyHpMult = 2; SB.applyTune();
  const ok = dummies.every(d => d.maxHp === SB.DTYPE[d.type].hp * 2);
  SB.resetTuning();
  return ok && dummies.every(d => d.maxHp === SB.DTYPE[d.type].hp);
});
check('tune cannot be hit', () => { reset(); TUNE.god = true; SB.hurtPlayer(50, dummies[0].pos, dummies[0]); const ok = P.hp === P.maxHp; SB.resetTuning(); return ok; });
check('tune damage taken', () => { reset(); TUNE.dmgTaken = 2; SB.hurtPlayer(10, dummies[0].pos, dummies[0]); const ok = P.hp === P.maxHp - 20; SB.resetTuning(); return ok; });
check('tune max health', () => { reset(); TUNE.maxHp = 50; SB.applyTune(); const ok = P.maxHp === 50 && P.hp === 50; SB.resetTuning(); return ok && P.maxHp === 100; });
check('tune no cooldowns', () => { SB.setClass('blade'); reset(); TUNE.cdMult = 0; press('KeyQ', 3); const ok = P.cd.q === 0; SB.resetTuning(); return ok; });
check('tune dash charges', () => {
  reset(); TUNE.dashCharges = 1; SB.applyTune(); SB.updateHud(DT);
  const ok = P.dashCharges === 1;
  TUNE.dashCharges = 5; TUNE.dashCd = 0; run(10); SB.updateHud(DT);
  const filled = P.dashCharges === 5;
  SB.resetTuning(); SB.updateHud(DT);
  return ok && filled && P.dashCharges === 2;
});
check('tune extra air jumps', () => { SB.setClass('blade'); TUNE.extraAirJumps = 2; SB.applyTune(); const ok = P.airJumpsMax === 3; SB.resetTuning(); return ok && P.airJumpsMax === 1; });
check('tune run speed', () => {
  const speed = () => { reset(); SB.keys.add('KeyW'); run(60); SB.keys.delete('KeyW'); return Math.hypot(P.vel.x, P.vel.z); };
  const normal = speed(); TUNE.runMult = 2; const fast = speed(); SB.resetTuning();
  return fast > normal * 1.8;
});
// the panel itself: move a slider, use the per-row reset, change a class number, then "Reset all"
check('tuning panel', () => {
  SB.setClass('blade');
  const panel = document.getElementById('tune');
  const rowOf = text => [...panel.querySelectorAll('.tr')].find(r => r.querySelector('.tl').textContent.startsWith(text));
  const slide = (row, v) => { const i = row.querySelector('input'); i.value = v; i.dispatchEvent(new Event('input')); };
  const jump = rowOf('Jump power');
  slide(jump, 20);
  if (TUNE.jump !== 20 || !jump.classList.contains('chg')) return false;
  jump.querySelector('.tx').click();
  if (TUNE.jump !== 13 || jump.classList.contains('chg')) return false;
  slide(rowOf('Hit 1 damage'), 99);
  slide(rowOf('RMB Grapple cooldown'), 1);
  if (SB.CL.atk[0].dmg !== 99 || SB.CL.skills.m2.cd !== 1) return false;
  if (rowOf('Q Blink Strike cooldown')) return false;    // ranked skills take their cooldown from their rank
  slide(rowOf('Run speed ×'), 2);
  panel.querySelector('.ra').click();
  return SB.CL.atk[0].dmg === 12 && SB.CL.skills.m2.cd === 0.5 && TUNE.runMult === 1 && !panel.querySelector('.tr.chg');
});

// progression (Blademaster): locked skills, trials, ranks, and the closed back doors
const rankOf = SB.rankOf;
const trial = id => SB.CLASSES.blade.trials.find(t => t.id === id);
const skillHit = (src, d, up = 0, heavy = false) => { SB.setHitSrc(src); return SB.hitDummy(d, 10, 0, 0, up, heavy, null, P.pos, true); };
// Start a trial and sit through the 3-2-1 countdown.
function begin(id) {
  if (!SB.startTrial(trial(id))) return false;
  run(200);
  return chal.cur === trial(id) && chal.phase === 'run';
}
const flying = dummies.filter(d => d.type === 'flying');
const fighter = dummies.find(d => d.type === 'fighter');

check('progress: starting ranks', () => {
  SB.resetProgress(); SB.setClass('blade');
  return rankOf('q') === 0 && rankOf('e') === 0 && rankOf('r') === 0 && rankOf('f') === 1 && rankOf('m2') === 1;
});
check('progress: a locked skill does nothing', () => { reset(); press('KeyQ', 5); press('KeyE', 5); press('KeyR', 5); return P.cd.q === 0 && P.cd.e === 0 && P.cd.r === 0 && P.state === 'normal'; });
check('progress: the starting skill works', () => { reset(); press('KeyF', 3); return P.cd.f > 0; });
check('progress: other classes are not locked', () => { SB.setClass('ninja'); const ok = rankOf('q') === 1 && rankOf('e') === 1; SB.setClass('blade'); return ok; });
check('progress: ranks are earned in order', () => SB.startTrial(trial('blade-q2')) === false && SB.startTrial(trial('blade-e3')) === false && chal.cur === null);
check('progress: tuned numbers block a trial', () => {
  TUNE.dmgMult = 2; const blocked = SB.startTrial(trial('blade-q1')) === false && chal.cur === null; SB.resetTuning();
  return blocked;
});
check('progress: a trial lends its skill and only that skill counts', () => {
  if (!begin('blade-q1')) return false;
  if (rankOf('q') !== 1 || rankOf('e') !== 0) return false;
  const hp = flying[0].hp;
  return skillHit('atk', flying[0]) === false && flying[0].hp === hp;    // basic attacks are IMMUNE here
});
check('progress: tuning during a trial fails it', () => { TUNE.god = true; run(2); const failed = chal.cur === null; SB.resetTuning(); return failed && rankOf('q') === 0; });
check('progress: quitting a trial keeps the skill locked', () => { if (!begin('blade-q1')) return false; SB.endChallenge(); return rankOf('q') === 0; });
check('progress: passing a trial teaches the skill', () => {
  if (!begin('blade-q1')) return false;
  skillHit('q', flying[0]); skillHit('q', flying[0]); skillHit('q', flying[1]); run(2);
  if (chal.cur === null) return false;                 // the same dummy twice must not count twice
  skillHit('q', flying[2]); run(2);
  return chal.cur === null && rankOf('q') === 1 && SB.CL.skills.q.dmg === 34 && SB.CL.skills.q.cd === 4;
});
check('progress: the learned skill can be used', () => { reset(); press('KeyQ', 3); return P.cd.q > 0; });
check('progress: rank II changes the numbers', () => {
  if (!begin('blade-q2')) return false;
  for (let i = 0; i < 2; i++) { fighter.stunT = 0; fighter.ai = 'windSlam'; fighter.aiT = 0.5; skillHit('q', fighter, 0, true); }
  run(2);
  return chal.cur === null && rankOf('q') === 2 && SB.CL.skills.q.dmg === 44 && SB.CL.skills.q.cd === 3.5;
});
check('progress: a trial runs out of time', () => { if (!begin('blade-e1')) return false; run(60 * 61); return chal.cur === null && rankOf('e') === 0; });
// played for real: spin through the three practice dummies (camera faces -z at spawn, so D moves along +x)
check('progress: Cyclone trial, played', () => {
  if (!begin('blade-e1')) return false;
  P.pos.set(-6.5, 0, -5.3); P.vel.set(0, 0, 0);
  SB.keys.add('KeyD'); press('KeyE', 50); SB.keys.delete('KeyD'); run(5);
  return chal.cur === null && rankOf('e') === 1;
});
check('progress: slam trial needs height', () => {
  if (!begin('blade-r1')) return false;
  P.castN++; P.castY = P.pos.y;                          // started from the ground: must not count
  for (let i = 0; i < 3; i++) skillHit('r', dummies[i]);
  run(2);
  if (chal.cur === null) return false;
  P.castN++; P.castY = P.pos.y + 6;
  for (let i = 0; i < 3; i++) skillHit('r', dummies[i]);
  run(2);
  return chal.cur === null && rankOf('r') === 1;
});
check('progress: slam trial, played', () => {
  if (!begin('blade-r2')) return false;
  P.pos.set(0, 9, -6); P.vel.set(0, 0, 0);               // in the air above the practice dummies
  press('KeyR', 40);
  return P.cd.r > 0 && chal.st.n === 3;                  // three dummies in reach from there; the trial wants four
});
check('progress: air combo trial', () => {
  SB.endChallenge();
  if (!begin('blade-f2')) return false;
  const d = dummies[0];
  skillHit('f', d, 17.5, true); run(20);                 // launched and in the air
  for (let i = 0; i < 3; i++) skillHit('atk', d, 6);
  run(400);                                              // it lands: the count starts again
  if (chal.cur === null || chal.st.n !== 3) return false;
  skillHit('f', d, 17.5, true); run(20);
  for (let i = 0; i < 6; i++) skillHit('atk', d, 6);
  run(2);
  return chal.cur === null && rankOf('f') === 2 && SB.CL.skills.f.dmg === 28;
});
check('progress: rank III perks are applied', () => {
  SB.unlockAll();
  const S = SB.CL.skills;
  return rankOf('q') === 3 && S.q.refund === true && S.e.dur === 0.7 && S.r.stun === 2 && S.f.around === true;
});
check('progress: reset goes back to the start', () => {
  SB.resetProgress();
  const S = SB.CL.skills;
  return rankOf('q') === 0 && rankOf('f') === 1 && S.q.refund === false && S.q.dmg === 34 && S.e.dur === 0.45 && S.f.dmg === 20;
});
check('progress: Master Sen offers the trials', () => {
  SB.setClass('blade'); reset();
  P.pos.copy(SB.master.pos); P.pos.z -= 2; P.vel.set(0, 0, 0); run(2);
  press('KeyG', 2); press('Digit2', 2);
  if (dlg.page !== 'train' || dlg.opts.length !== 5) return false;
  press('Digit1', 2);                                    // first skill listed is Blink Strike
  const started = chal.cur === trial('blade-q1') && !dlg.open;
  SB.endChallenge();
  return started;
});
SB.resetProgress();

log.push(fails.length ? 'SMOKE FAIL (' + fails.length + ')' : 'SMOKE PASS', ...fails);
const pre = document.createElement('pre');
pre.id = 'smoke'; pre.textContent = log.join('\n');
pre.style.cssText = 'position:fixed;left:10px;top:70px;z-index:50;background:#14171c;color:#e8eef3;padding:10px;font-size:12px;max-width:90vw;white-space:pre-wrap';
document.body.appendChild(pre);
document.title = log[0];
