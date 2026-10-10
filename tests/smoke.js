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
  if (SB.dojo.inside) SB.leaveDojo();    // the general checks happen in the main arena
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

// graphics: the quality switch works both ways, and Low stays cheap to draw
check('quality: switch to High and back', () => {
  reset();
  SB.applyQuality('high'); run(5); SB.renderer.render(SB.scene, SB.camera);
  const high = SB.quality.level === 'high' && SB.renderer.shadowMap.enabled === true;
  SB.applyQuality('low'); run(5); SB.renderer.render(SB.scene, SB.camera);
  return high && SB.quality.level === 'low' && SB.renderer.shadowMap.enabled === false && document.getElementById('quality').value === 'low';
});
// Draw calls for one frame from the start point. 319 before the dusk look, 322 after it. The limit leaves a little
// room; if this fails, something made the cheap setting more expensive. Either undo that or raise the limit on purpose.
check('quality: Low stays within its draw budget', () => {
  reset(); SB.respawnPlayer(); run(30);
  SB.renderer.render(SB.scene, SB.camera);
  return SB.renderer.info.render.calls <= 335;
});

// progression (Blademaster): locked skills, the training hall, trials, ranks, and the closed back doors
const rankOf = SB.rankOf, dojo = SB.dojo, DOJO = SB.DOJO;
const trial = id => SB.CLASSES.blade.trials.find(t => t.id === id);
const skillHit = (src, d, up = 0, heavy = false) => { SB.setHitSrc(src); return SB.hitDummy(d, 10, 0, 0, up, heavy, null, P.pos, true); };
const spawned = type => dojo.spawned.filter(d => d.type === type);
const near = (x, z, r = 1.5) => Math.hypot(P.pos.x - x, P.pos.z - z) < r;
// Start a trial and sit through the 3-2-1 countdown.
function begin(id) {
  if (!SB.startTrial(trial(id))) return false;
  run(200);
  return chal.cur === trial(id) && chal.phase === 'run';
}
// Put the player at a spot given relative to the centre of the hall, standing still.
function standAt(x, y, z) { P.pos.set(DOJO.cx + x, y, DOJO.cz + z); P.vel.set(0, 0, 0); }
const arenaDummies = dummies.length;

check('progress: starting ranks', () => {
  SB.resetProgress(); SB.setClass('blade');
  return rankOf('q') === 0 && rankOf('e') === 0 && rankOf('r') === 0 && rankOf('f') === 1 && rankOf('m2') === 1;
});
check('progress: a locked skill does nothing', () => { reset(); press('KeyQ', 5); press('KeyE', 5); press('KeyR', 5); return P.cd.q === 0 && P.cd.e === 0 && P.cd.r === 0 && P.state === 'normal'; });
check('progress: the starting skill works', () => { reset(); press('KeyF', 3); return P.cd.f > 0; });
check('progress: other classes are not locked', () => { SB.setClass('ninja'); const ok = rankOf('q') === 1 && rankOf('e') === 1; SB.setClass('blade'); return ok; });
check('progress: ranks are earned in order', () => SB.startTrial(trial('blade-q2')) === false && SB.startTrial(trial('blade-e3')) === false && chal.cur === null && !dojo.inside);
check('progress: tuned numbers block a trial', () => {
  TUNE.dmgMult = 2; const blocked = SB.startTrial(trial('blade-q1')) === false && chal.cur === null; SB.resetTuning();
  return blocked;
});

check('hall: teleport there, stay inside its walls, teleport back', () => {
  reset(); SB.enterDojo(); run(5);
  if (!dojo.inside || !near(DOJO.cx, DOJO.cz + 18) || Math.hypot(SB.master.pos.x - P.pos.x, SB.master.pos.z - P.pos.z) > 4) return false;
  SB.keys.add('KeyW'); press('ShiftLeft', 400); SB.keys.delete('KeyW');     // run and dash at the far wall
  if (Math.abs(P.pos.x - DOJO.cx) > DOJO.half || Math.abs(P.pos.z - DOJO.cz) > DOJO.half) return false;
  SB.leaveDojo(); run(5);
  return !dojo.inside && near(0, 14) && SB.master.pos.x === -5 && SB.master.pos.z === 18;
});
check('hall: a trial builds its layout and takes it away again', () => {
  SB.enterDojo(); run(2);
  const objects = SB.scene.children.length;
  if (!begin('blade-q1')) return false;
  const built = dojo.spawned.length === 3 && spawned('flying').length === 3 && dojo.props.length === 2 && dummies.length === arenaDummies + 3 && near(DOJO.cx, DOJO.cz + 18);
  SB.endChallenge();
  return built && dojo.spawned.length === 0 && dojo.props.length === 0 && dummies.length === arenaDummies && SB.scene.children.length === objects;
});
check('progress: a trial lends its skill and only that skill counts', () => {
  if (!begin('blade-q1')) return false;
  if (rankOf('q') !== 1 || rankOf('e') !== 0) return false;
  const d = spawned('flying')[0], hp = d.hp;
  return skillHit('atk', d) === false && d.hp === hp;    // basic attacks are IMMUNE here
});
check('progress: tuning during a trial fails it', () => { TUNE.god = true; run(2); const failed = chal.cur === null; SB.resetTuning(); return failed && rankOf('q') === 0; });
check('progress: quitting a trial keeps the skill locked', () => { if (!begin('blade-q1')) return false; SB.endChallenge(); return rankOf('q') === 0; });
check('progress: passing a trial teaches the skill', () => {
  if (!begin('blade-q1')) return false;
  const f = spawned('flying');
  skillHit('q', f[0]); skillHit('q', f[0]); skillHit('q', f[1]); run(2);
  if (chal.cur === null) return false;                 // the same dummy twice must not count twice
  skillHit('q', f[2]); run(2);
  return chal.cur === null && rankOf('q') === 1 && SB.CL.skills.q.dmg === 34 && SB.CL.skills.q.cd === 4 && dojo.inside && dojo.spawned.length === 0;
});
check('progress: the learned skill can be used', () => { reset(); press('KeyQ', 3); return P.cd.q > 0; });
check('progress: rank II changes the numbers', () => {
  if (!begin('blade-q2')) return false;
  const fighter = spawned('fighter')[0];
  for (let i = 0; i < 2; i++) { fighter.stunT = 0; fighter.ai = 'windSlam'; fighter.aiT = 0.5; skillHit('q', fighter, 0, true); }
  run(2);
  return chal.cur === null && rankOf('q') === 2 && SB.CL.skills.q.dmg === 44 && SB.CL.skills.q.cd === 3.5;
});
check('progress: a trial runs out of time', () => { if (!begin('blade-e1')) return false; run(60 * 46); return chal.cur === null && rankOf('e') === 0 && dojo.spawned.length === 0; });
// played for real: spin through the line of three dummies (the camera faces -z after the countdown, so D moves along +x)
check('progress: Cyclone trial, played', () => {
  if (!begin('blade-e1')) return false;
  standAt(-5.5, 0, -2.3);
  SB.keys.add('KeyD'); press('KeyE', 50); SB.keys.delete('KeyD'); run(5);
  return chal.cur === null && rankOf('e') === 1;
});
// played for real: a slam from the ground must not count, a slam from 9 up must
check('progress: Slam trial, played', () => {
  if (!begin('blade-r1')) return false;
  standAt(0, 0, -1); run(2); press('KeyR', 60);
  if (chal.cur === null || chal.st.n !== 0 || P.cd.r <= 0) return false;
  run(360);                                              // the first slam threw the dummies about: let them walk back
  P.cd.r = 0; standAt(0, 9, -1); press('KeyR', 40); run(3);
  return chal.cur === null && rankOf('r') === 1;
});
// played for real: the fighter starts out of reach, so the first slam only gets the three dummies
check('progress: Slam II needs the fighter in the blast', () => {
  if (!begin('blade-r2')) return false;
  const fighter = spawned('fighter')[0];
  standAt(0, 8, -2); press('KeyR', 30);
  if (chal.cur === null || chal.st.n !== 3) return false;
  P.iframes = 99; run(360);                              // let the dummies walk back; the fighter cannot hurt us meanwhile
  P.cd.r = 0; fighter.pos.set(DOJO.cx + 1, 0, DOJO.cz - 2); fighter.vel.set(0, 0, 0);
  standAt(0, 8, -2); press('KeyR', 30); run(3);
  return chal.cur === null && rankOf('r') === 2 && SB.CL.skills.r.rad === 9;
});
check('progress: air combo trial', () => {
  if (!begin('blade-f2')) return false;
  const d = spawned('basic')[0];
  skillHit('f', d, 17.5, true); run(20);                 // launched and in the air
  for (let i = 0; i < 3; i++) skillHit('atk', d, 6);
  run(400);                                              // it lands: the count starts again
  if (chal.cur === null || chal.st.n !== 3) return false;
  skillHit('f', d, 17.5, true); run(20);
  for (let i = 0; i < 6; i++) skillHit('atk', d, 6);
  run(2);
  return chal.cur === null && rankOf('f') === 2 && SB.CL.skills.f.dmg === 28;
});
check('progress: every trial has a layout that builds', () => {
  SB.unlockAll();
  for (const t of SB.CLASSES.blade.trials) {
    if (!t.arena || !t.arena.spawn || !t.arena.spawn.length) return false;
    SB.setupTrial(t);
    const ok = dojo.spawned.length === t.arena.spawn.length && dojo.spawned.every(d => Math.abs(d.pos.x - DOJO.cx) < DOJO.half && Math.abs(d.pos.z - DOJO.cz) < DOJO.half);
    run(30);                                             // let the layout run for half a second
    SB.clearTrial();
    if (!ok) return false;
  }
  return dummies.length === arenaDummies;
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
// the whole route through Master Sen: arena -> hall -> pick a trial -> back to the arena
check('Master Sen: to the hall, a trial, and back', () => {
  SB.setClass('blade'); reset();
  P.pos.copy(SB.master.pos); P.pos.z -= 2; P.vel.set(0, 0, 0); run(2);
  press('KeyG', 2); press('Digit2', 2);                  // "Train my skills"
  if (!dojo.inside || dlg.open) return false;
  run(5); press('KeyG', 2);                              // he is next to where you arrive
  if (dlg.page !== 'train' || dlg.opts.length !== 5) return false;
  press('Digit1', 2);                                    // first skill listed is Blink Strike
  if (chal.cur !== trial('blade-q1') || dlg.open) return false;
  SB.endChallenge(); run(2);
  SB.respawnPlayer(); run(2);
  press('KeyG', 2); press('Digit5', 2);                  // "Return to the arena"
  return !dojo.inside && near(0, 14);
});
check('Master Sen: offers to reset tuning in the hall', () => {
  reset(); SB.enterDojo(); run(5); TUNE.jump = 20;
  press('KeyG', 2);
  if (dlg.opts.length !== 2) { SB.resetTuning(); return false; }    // only "reset tuning" and "return"
  press('Digit1', 2);
  const ok = TUNE.jump === 13 && dlg.opts.length === 5;              // tuning is default again and the trials are listed
  press('KeyG', 2);
  return ok;
});
reset();
SB.resetProgress();
check('hall: nothing is left behind', () => !dojo.inside && dummies.length === arenaDummies && dojo.props.length === 0);

log.push(fails.length ? 'SMOKE FAIL (' + fails.length + ')' : 'SMOKE PASS', ...fails);
const pre = document.createElement('pre');
pre.id = 'smoke'; pre.textContent = log.join('\n');
pre.style.cssText = 'position:fixed;left:10px;top:70px;z-index:50;background:#14171c;color:#e8eef3;padding:10px;font-size:12px;max-width:90vw;white-space:pre-wrap';
document.body.appendChild(pre);
document.title = log[0];
