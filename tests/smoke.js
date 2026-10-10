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
    press('KeyX', 30); press('KeyX', 30); SB.keys.delete('KeyW'); run(60);    // onto the mount and off again
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
  press('Digit3', 2); if (dlg.page !== 'classes') return false;
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

// painted slashes: a sword's slash is drawn from the blade's own path, with no ready-made shape beside it
const ribbon = SB.trail.children[0].geometry;
check('slash: the sword slash follows the blade and then clears', () => {
  SB.setClass('blade'); reset(); P.pos.set(0, 0, 40); run(40);
  if (SB.trail.visible) return false;                    // nothing while the sword is only held
  pressed.add('M0'); run(8);
  if (!SB.trail.visible || SB.arcs.some(a => a.g.visible)) return false;
  // every point of the ribbon is within sword-wave reach of the player: it is where the blade was, nowhere else
  const pts = ribbon.attributes.position.array, used = ribbon.index.array;
  for (let i = 0; i < ribbon.drawRange.count; i++) {
    const v = used[i] * 3;
    if (Math.hypot(pts[v] - P.pos.x, pts[v + 2] - P.pos.z) > 4.2) return false;
  }
  run(70);
  if (SB.trail.visible) return false;
  // two cuts in a row: no piece of ribbon may bridge the gap between them (no piece longer than a sword swing step)
  pressed.add('M0'); run(17); pressed.add('M0'); run(17); pressed.add('M0'); run(9);
  const p2 = ribbon.attributes.position.array, index = ribbon.index.array;
  for (let i = 0; i < ribbon.drawRange.count; i += 6) {   // six numbers per ribbon piece
    const a = index[i] * 3, b = index[i + 2] * 3;       // a corner and the matching corner of the next position
    if (Math.hypot(p2[a] - p2[b], p2[a + 1] - p2[b + 1], p2[a + 2] - p2[b + 2]) > 1.6) return false;
  }
  run(70);
  return !SB.trail.visible;
});
check('slash: fists still use the ready-made arc', () => {
  SB.setClass('monk'); reset(); P.pos.set(0, 0, 40); run(5);
  pressed.add('M0'); run(6);
  const arc = SB.arcs.find(a => a.g.visible);
  const ok = !!arc && arc.body.material.opacity > 0.5 && arc.ink.material.opacity > 0.5 && !SB.trail.visible;
  run(60); SB.setClass('blade');
  return ok && !SB.arcs.some(a => a.g.visible);
});
check('slash: Cyclone whirlpool and Slam wave', () => {
  reset(); P.pos.set(0, 0, 40); run(5);
  SB.CL.skills.e.fn(); run(6);
  const whirl = SB.swirls.some(w => w.g.visible);
  run(90); P.pos.y = 6; P.grounded = false; SB.CL.skills.r.fn(); run(14);
  const wave = SB.swirls.some(w => w.g.visible);
  run(90);
  return whirl && wave && !SB.swirls.some(w => w.g.visible);
});
check('slash: fists leave no trail, a teleport does not stretch one', () => {
  SB.setClass('monk'); reset(); pressed.add('M0'); run(6);
  const none = !SB.trail.visible;
  SB.setClass('blade'); reset(); pressed.add('M0'); run(5);
  P.pos.x += 60; run(1);                                 // far away in one frame
  const box = ribbon.attributes.position.array, joined = ribbon.index.array;
  let widest = 0;
  for (let i = 0; i < ribbon.drawRange.count; i += 6) widest = Math.max(widest, Math.abs(box[joined[i] * 3] - box[joined[i + 2] * 3]));
  run(60);
  return none && (!SB.trail.visible || widest < 14);
});

// graphics: the quality switch works both ways, and Low stays cheap to draw
check('quality: switch to High and back', () => {
  reset();
  SB.applyQuality('high'); run(5); SB.renderer.render(SB.scene, SB.camera);
  const high = SB.quality.level === 'high' && SB.renderer.shadowMap.enabled === true;
  SB.applyQuality('low'); run(5); SB.renderer.render(SB.scene, SB.camera);
  return high && SB.quality.level === 'low' && SB.renderer.shadowMap.enabled === false && document.getElementById('quality').value === 'low';
});
// Draw calls for one frame from the start point. About 310 after the rocks, about 350 once every enemy wore its own
// shapes (the limit was raised on purpose for that). The limit leaves a little room; if this fails, something made
// the cheap setting more expensive. Either undo that or raise the limit on purpose.
// (Raised from 375 to 410 when the camera began fully zoomed out: more of the arena is in view, about 380 draws.)
check('quality: Low stays within its draw budget', () => {
  reset(); SB.respawnPlayer(); run(30);
  SB.renderer.render(SB.scene, SB.camera);
  return SB.renderer.info.render.calls <= 410;
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
  press('KeyG', 2); press('Digit4', 2);                  // "Train my skills"
  if (!dojo.inside || dlg.open) return false;
  run(5); press('KeyG', 2);                              // he is next to where you arrive
  if (dlg.page !== 'train' || dlg.opts.length !== 8) return false;    // 4 skills, 3 sword styles, return
  press('Digit1', 2);                                    // first skill listed is Blink Strike
  if (chal.cur !== trial('blade-q1') || dlg.open) return false;
  SB.endChallenge(); run(2);
  SB.respawnPlayer(); run(2);
  press('KeyG', 2); press('Digit8', 2);                  // "Return to the arena"
  return !dojo.inside && near(0, 14);
});
check('Master Sen: offers to reset tuning in the hall', () => {
  reset(); SB.enterDojo(); run(5); TUNE.jump = 20;
  press('KeyG', 2);
  if (dlg.opts.length !== 2) { SB.resetTuning(); return false; }    // only "reset tuning" and "return"
  press('Digit1', 2);
  const ok = TUNE.jump === 13 && dlg.opts.length === 8;              // tuning is default again and the trials are listed
  press('KeyG', 2);
  return ok;
});
// Master Sen: one hit earns a warning, a second inside ten seconds is fatal
const sen = SB.master;
// Stand right in front of him and swing the sword.
function swingAtSen() { P.pos.set(sen.pos.x, sen.pos.y, sen.pos.z + 1.6); P.vel.set(0, 0, 0); P.iframes = 0; run(2); pressed.add('M0'); run(10); }
check('Sen: the first hit is only a warning', () => {
  SB.setClass('blade'); reset(); run(60 * 11);           // let any earlier warning run out
  const hp = P.hp;
  swingAtSen();
  // warned, thrown back from him, but alive and not sent anywhere
  return sen.warnT > 9 && P.hp === hp && Math.hypot(P.pos.x - sen.pos.x, P.pos.z - sen.pos.z) > 1.7 && !near(0, 14);
});
check('Sen: a second hit inside ten seconds gets you grabbed by the neck and slammed', () => {
  run(60 * 3);
  if (!(sen.warnT > 0)) return false;
  sen.nextMove = 'slam';
  swingAtSen();
  if (P.state !== 'grabbed') return false;
  run(26);                                               // about half a second in: held up in front of him
  const held = P.pos.y > sen.pos.y + 0.5 && Math.hypot(P.pos.x - sen.pos.x, P.pos.z - sen.pos.z) < 2.5 && P.hp === P.maxHp;
  SB.hurtPlayer(20, dummies[0].pos, dummies[0]);         // nothing else can hurt him meanwhile
  SB.strikeMaster(sen.pos.x, sen.pos.y, sen.pos.z, 3);   // and flailing at Sen does nothing
  if (P.hp !== P.maxHp || P.state !== 'grabbed') return false;
  run(22);                                               // he has jumped: both are well off the ground now
  const airborne = sen.sm.root.position.y > sen.pos.y + 2 && P.pos.y > sen.pos.y + 2.5 && P.state === 'grabbed';
  run(40);                                               // slammed, and he is back on his feet
  return held && airborne && sen.sm.root.position.y === sen.pos.y && P.state === 'normal' && P.hp === P.maxHp - 60 && sen.warnT === 0 && !near(0, 14)
    && Math.hypot(P.pos.x - sen.pos.x, P.pos.z - sen.pos.z) < 6;
});
check('Sen: the slam never takes the last of your health', () => {
  reset(); run(120);
  swingAtSen(); run(50);
  P.hp = 25;
  sen.nextMove = 'slam';
  swingAtSen();
  if (P.state !== 'grabbed') return false;
  run(90);
  return P.state === 'normal' && P.hp === 1 && !near(0, 14) && sen.nextMove === 'throw';    // and next time it is the throw
});
// Get thrown by him, and stop at the moment the player hits the rock. Returns false if that never happens.
function thrownAtWall() {
  swingAtSen(); run(50);
  sen.nextMove = 'throw';
  swingAtSen();
  if (P.state !== 'grabbed') return false;
  run(60);                                               // let go by now: tumbling through the air
  if (P.thrown !== true || P.hp !== P.maxHp) return false;
  for (let i = 0; i < 150 && !P.splat; i++) run(1);
  return P.splat === true;
}
// Is the player flat against the upright side of something tall? (Within reach of one of its sides, below its top.)
function againstWall() {
  return SB.solids.some(r => r.max.y - r.min.y >= 8 && P.pos.y + 0.9 < r.max.y
    && P.pos.x > r.min.x - 0.5 && P.pos.x < r.max.x + 0.5 && P.pos.z > r.min.z - 0.5 && P.pos.z < r.max.z + 0.5
    && (P.pos.x < r.min.x || P.pos.x > r.max.x || P.pos.z < r.min.z || P.pos.z > r.max.z));
}
check('Sen: the other time he throws you into the side of a rock', () => {
  reset(); run(120);
  if (!thrownAtWall()) return false;
  // flat against the side of a rock, well off the ground, for 40 of 100 health, and held there
  const at = P.pos.clone();
  const smacked = againstWall() && P.pos.y > sen.pos.y + 2 && P.hp === P.maxHp - 40 && P.state === 'grabbed';
  run(12);
  const held = P.pos.distanceTo(at) < 0.01 && P.state === 'grabbed';
  run(200);
  // then he drops to the ground at its foot, free again; next time it is the slam
  return smacked && held && P.state === 'normal' && P.splat === false && P.grounded && P.pos.y < at.y - 1 && sen.nextMove === 'slam';
});
check('Sen: in the training hall he throws you at its wall', () => {
  reset(); run(120); SB.enterDojo(); run(5);
  const smacked = thrownAtWall() && againstWall() && P.hp === P.maxHp - 40;
  run(200);
  const down = P.state === 'normal' && P.grounded;
  SB.leaveDojo();
  return smacked && down;
});
check('enemies: each type wears its own shapes', () => {
  const of = type => dummies.find(d => d.type === type);
  const basic = of('basic'), guard = of('shield'), winged = of('flying'), brute = of('fighter');
  if (!basic.sm.head.children.length || !guard.sm.head.children.length || !brute.sm.head.children.length) return false;    // bucket, helm, horns
  if (!winged.wings || winged.wings.length !== 2) return false;
  const before = winged.wings[0].rotation.y;
  run(4);
  if (winged.wings[0].rotation.y === before) return false;                    // the wings flap
  return brute.sm.root.scale.x > guard.sm.root.scale.x && guard.sm.root.scale.x > winged.sm.root.scale.x;    // brute biggest, winged slightest
});
check('Sen: after ten seconds it is only a warning again', () => {
  reset(); run(200);                                     // after a slam or a throw he cannot be provoked again for a moment
  swingAtSen();
  if (!(sen.warnT > 0)) return false;
  run(60 * 11);
  if (sen.warnT !== 0) return false;
  swingAtSen();
  return sen.warnT > 9 && !near(0, 14);
});
check('Sen: a blast counts as a hit too, and one swing never counts twice', () => {
  reset(); run(60 * 11);
  SB.strikeMaster(sen.pos.x + 1, sen.pos.y, sen.pos.z, 3);
  SB.strikeMaster(sen.pos.x + 1, sen.pos.y, sen.pos.z, 3);    // the same instant: ignored
  const once = sen.warnT > 9 && !near(0, 14);
  SB.strikeMaster(sen.pos.x + 30, sen.pos.y, sen.pos.z, 3);   // nowhere near him
  run(60 * 11);
  return once && sen.warnT === 0;
});
check('Sen: his head follows the player', () => {
  reset(); P.pos.set(sen.pos.x + 6, 9, sen.pos.z); P.vel.set(0, 0, 0); run(5);   // up in the air to one side of him
  const lookingUp = sen.headPitch > 0.3;
  P.pos.set(sen.pos.x - 6, 0, sen.pos.z); run(4);             // suddenly on his other side: the head turns before the body
  const turned = Math.abs(sen.headYaw) > 0.4;
  run(120);
  return lookingUp && turned && Math.abs(sen.headYaw) < 0.2;  // and then the body catches up
});
check('Sen: the menu is made of cards that can be clicked', () => {
  reset(); P.pos.copy(sen.pos); P.pos.z -= 2; P.vel.set(0, 0, 0); run(2);
  press('KeyG', 2);
  const win = document.getElementById('dlg'), cards = win.querySelectorAll('.card');
  if (!dlg.open || cards.length !== dlg.opts.length || cards.length !== 7 || !cards[0].querySelector('svg')) return false;
  if (!document.body.classList.contains('sen')) return false;
  cards[2].click();                                      // "Change fighting style"
  if (dlg.page !== 'classes' || win.querySelectorAll('.card').length !== 5) return false;
  win.querySelectorAll('.card')[2].click();              // the Monk
  const picked = !dlg.open && SB.CL.id === 'monk' && !document.body.classList.contains('sen') && getComputedStyle(win).display === 'none';
  SB.setClass('blade');
  return picked;
});

// sword styles: locked until their trial is passed, taken through a short scene, gone after 20 seconds
const style = SB.style, PLAIN_SKIN = 0xeef1f8, outfit = SB.outfit;
let flameArmour = null;    // remembered from the Flame check, to make sure Water wears different colours
// Is the style's suit on? Dark limbs, every piece showing, the armour and coat glowing in that style's cracks
// (each style has its own pictures for those), and that style's hair, and only that style's, on the head.
const dressedAs = id => SB.playerMat.color.getHex() !== PLAIN_SKIN && outfit.parts.length > 15 && outfit.parts.every(m => m.visible)
  && outfit.chest.material.emissiveMap !== null && outfit.coat.material.emissiveMap !== null
  && outfit.chest.material !== outfit.coat.material && SB.player.head.material !== SB.playerMat
  && outfit.flameHair.visible === (id === 'flame') && outfit.waterHair.visible === (id === 'water') && outfit.thunderHair.visible === (id === 'thunder');
const undressed = () => SB.playerMat.color.getHex() === PLAIN_SKIN && outfit.parts.every(m => !m.visible) && SB.player.head.material === SB.playerMat
  && !outfit.flameHair.visible && !outfit.waterHair.visible && !outfit.thunderHair.visible;
const pool = SB.sources.find(s => s.id === 'water'), firePit = SB.sources.find(s => s.id === 'flame'), storm = SB.sources.find(s => s.id === 'thunder');
// Stand in the middle of a storm and use Cyclone.
function cycloneIn(src) { P.pos.copy(src.pos); P.vel.set(0, 0, 0); P.cd.e = 0; run(3); pressed.add('KeyE'); run(4); }
// Stand six units from a fire, facing it (the camera looks along -z after a respawn), and Blink Strike.
function faceFire(src) { P.pos.set(src.pos.x, src.pos.y, src.pos.z + 6); P.vel.set(0, 0, 0); P.cd.q = 0; run(3); }
function blinkAt(src) { faceFire(src); pressed.add('KeyQ'); run(4); }
// Drop into a pool from above with Meteor Slam.
function slamInto(src) { P.pos.set(src.pos.x, src.pos.y + 7, src.pos.z); P.vel.set(0, 0, 0); P.grounded = false; P.cd.r = 0; run(1); pressed.add('KeyR'); run(14); }
// Pass a skill's first trial the quick way, to get on with the style checks.
function learn(id, src) {
  if (!begin(id)) return false;
  P.castN++; P.castY = P.pos.y + 6;
  for (const d of dojo.spawned) skillHit(src, d);
  run(3);
  return chal.cur === null;
}
check('style: locked at the start, and the fire is out', () => {
  SB.resetProgress(); SB.setClass('blade'); reset(); run(3);
  return !SB.styleUnlocked('flame') && !SB.styleUnlocked('water') && SB.giveStyle('flame') === false && firePit.fire.visible === false && pool.ripples.visible === false;
});
check('style: each needs its skill first', () => SB.startTrial(trial('blade-flame')) === false && SB.startTrial(trial('blade-water')) === false
  && SB.startTrial(trial('blade-thunder')) === false && chal.cur === null);
check('style: a locked fire is just a place to blink past', () => {
  if (!learn('blade-q1', 'q')) return false;
  reset(); faceFire(firePit);
  if (SB.lockFire() !== null) return false;              // no ring on a fire that is out
  pressed.add('KeyQ'); run(60);
  return style.cur === null && P.state === 'normal' && P.cd.q > 0;
});
check('style: Flame trial, played', () => {
  if (!begin('blade-flame')) return false;
  if (dojo.sources.length !== 1 || !SB.styleUnlocked('flame')) return false;    // lent for the trial
  const fire = dojo.sources[0];
  faceFire(fire);
  if (SB.lockFire() !== fire || SB.lockTarget() !== null) return false;    // the ring is on the fire
  pressed.add('KeyQ'); run(4);
  // the scene: standing in the middle of the fire, held there, and nothing can hit him
  if (P.state !== 'ignite' || Math.hypot(P.pos.x - fire.pos.x, P.pos.z - fire.pos.z) > 0.01 || style.cur) return false;
  const hp = P.hp; SB.hurtPlayer(20, dummies[0].pos, dummies[0]);
  if (P.hp !== hp) return false;
  run(50);
  if (P.state !== 'normal' || !style.cur || style.cur.id !== 'flame') return false;
  if (!dressedAs('flame')) return false;                 // he is wearing the suit
  flameArmour = outfit.chest.material;
  for (const d of spawned('basic')) skillHit('atk', d);
  if (!spawned('basic').every(d => d.burnT > 0)) return false;
  run(3);
  return chal.cur === null && SB.styleUnlocked('flame') && style.cur === null && dojo.sources.length === 0 && undressed();
});
check('style: Flame burns over time, then stops', () => {
  reset(); blinkAt(firePit); run(50);
  if (!style.cur || style.cur.id !== 'flame' || !firePit.fire.visible) return false;
  const d = dummies[0];
  skillHit('atk', d);
  const afterHit = d.hp;
  run(150);                                              // 2.5 seconds
  const burned = afterHit - d.hp;
  run(200);
  const later = d.hp;
  run(60);
  return burned >= 25 && d.burnT <= 0 && d.hp >= later;  // ticked, then went out (dummies heal, so only "not lower")
});
check('style: the ring only takes a fire that is aimed at and in reach', () => {
  reset(); faceFire(firePit);
  if (SB.lockFire() !== firePit) return false;
  P.pos.z += 14; run(3);                                 // twenty units away: too far for a blink
  if (SB.lockFire() !== null) return false;
  P.pos.set(firePit.pos.x + 9, 0, firePit.pos.z + 6); run(3);    // close, but looking past it
  return SB.lockFire() === null;
});
check('style: a sword swing at the fire no longer takes it', () => {
  reset(); P.pos.set(firePit.pos.x, 0, firePit.pos.z + 1.7); run(3); pressed.add('M0'); run(20);
  return style.cur === null;
});
check('style: lasts 20 seconds, then sword and skin are plain again', () => {
  reset(); blinkAt(firePit); run(50);
  if (!style.cur) return false;
  run(60 * 18);
  if (!style.cur) return false;
  run(60 * 3);
  return style.cur === null && SB.reach() === 1 && undressed();
});
check('style: a trial starts with a plain sword', () => {
  reset(); blinkAt(firePit); run(50);
  if (!style.cur) return false;
  if (!begin('blade-q2')) return false;
  const plain = style.cur === null;
  SB.endChallenge();
  return plain;
});
check('style: Water trial, played', () => {
  reset();
  if (!learn('blade-r1', 'r')) return false;             // Water needs Meteor Slam, so learn that first
  if (!begin('blade-water')) return false;
  standAt(0, 0, -1.2); run(3); pressed.add('M0'); run(25);
  if (chal.cur === null || chal.st.n !== 0) return false;    // a plain swing does not count, and cannot reach all four
  run(300);                                                  // the dummies walk back into line
  slamInto(dojo.sources[0]);
  // the scene: under the water, sinking
  if (P.state !== 'submerge' || !(P.sink > 0.5) || style.cur) return false;
  run(50);
  if (P.state !== 'normal' || P.sink !== 0 || !style.cur || style.cur.id !== 'water') return false;
  if (!dressedAs('water') || outfit.chest.material === flameArmour) return false;    // and not in Flame's colours
  run(80);                                                   // he leaps out of the pool: wait to land
  standAt(0, 0, -1.2); run(3); pressed.add('M0'); run(12);
  return chal.cur === null && SB.styleUnlocked('water');
});
check('style: Water from a slam into the pool', () => {
  reset(); slamInto(pool); run(55);
  if (!style.cur || style.cur.id !== 'water' || SB.reach() !== 1.2 || !pool.ripples.visible) return false;
  P.cd.q = 3; skillHit('atk', dummies[0]);
  return P.cd.q < 3;                                     // every hit shortens cooldowns
});
check('style: a slam outside the pool gives nothing', () => {
  reset(); P.pos.set(pool.pos.x + 12, 7, pool.pos.z); P.vel.set(0, 0, 0); P.grounded = false; P.cd.r = 0; press('KeyR', 30); run(60);
  return style.cur === null && P.state === 'normal';
});
check('style: a locked storm is quiet, and Cyclone in it is just Cyclone', () => {
  reset(); run(60);
  if (SB.styleUnlocked('thunder') || storm.rim.visible || storm.bolts.some(b => b.life > 0)) return false;
  P.pos.copy(storm.pos); P.vel.set(0, 0, 0); run(3);
  SB.CL.skills.e.fn(); run(2);                           // Cyclone itself is not learned yet here, so call it directly
  if (P.state !== 'cyclone') return false;
  run(90);
  return style.cur === null;
});
check('style: Thunder trial, played', () => {
  reset();
  if (!learn('blade-e1', 'e')) return false;             // Thunder needs Cyclone, so learn that first
  if (!begin('blade-thunder')) return false;
  if (dojo.sources.length !== 1 || !SB.styleUnlocked('thunder')) return false;    // lent for the trial
  const cloud = dojo.sources[0];
  run(60);
  if (!cloud.rim.visible || !cloud.bolts.some(b => b.life > 0 || b.meshes[0].position.lengthSq() > 0)) return false;    // lightning is falling
  for (const d of spawned('basic')) skillHit('atk', d);
  if (chal.st.n !== 0) return false;                     // with a plain sword nothing jumps, so nothing counts
  cycloneIn(cloud);
  // the scene: held in the middle of the storm, and nothing can hit him
  if (P.state !== 'storm' || Math.hypot(P.pos.x - cloud.pos.x, P.pos.z - cloud.pos.z) > 0.01 || style.cur) return false;
  const hp = P.hp; SB.hurtPlayer(20, dummies[0].pos, dummies[0]);
  if (P.hp !== hp) return false;
  run(50);
  if (P.state !== 'normal' || !style.cur || style.cur.id !== 'thunder' || !dressedAs('thunder')) return false;
  if (outfit.chest.material === flameArmour) return false;    // and not in Flame's colours
  for (let i = 0; i < 6 && chal.cur; i++) skillHit('atk', spawned('basic')[i % 2]);
  run(3);
  return chal.cur === null && SB.styleUnlocked('thunder') && style.cur === null && undressed();
});
check('style: Thunder from Cyclone in the storm; hits jump once, and he runs faster', () => {
  reset(); run(30);
  cycloneIn(storm); run(55);
  if (!style.cur || style.cur.id !== 'thunder' || !storm.rim.visible || SB.styleSpeed() <= 1) return false;
  // two dummies side by side and one far off
  const [a, b, far] = dummies.filter(d => d.type === 'basic' || d.type === 'shield').slice(0, 3);
  a.pos.set(40, 0, 40); b.pos.set(42, 0, 40); far.pos.set(60, 0, 40);
  const hpA = a.hp, hpB = b.hp, hpFar = far.hp;
  skillHit('atk', a);
  const jumped = hpB - b.hp;
  // the one beside it takes 40% of what the first took, once; the far one nothing
  return a.hp < hpA && jumped === Math.round((hpA - a.hp) * 0.4) && far.hp === hpFar;
});
check('style: Cyclone outside the storm gives nothing', () => {
  reset(); P.pos.set(storm.pos.x + 9, 0, storm.pos.z); P.vel.set(0, 0, 0); P.cd.e = 0; run(3); pressed.add('KeyE'); run(4);
  const spinning = P.state === 'cyclone';
  run(90);
  return spinning && style.cur === null;
});
// element powers: under a sword style the four skills do something different, and each element has its own job
// Stand in open ground with a style on (null = plain sword), every skill usable and off cooldown.
function asElement(id) {
  SB.unlockAll(); SB.setClass('blade'); reset(); SB.clearStyle();
  P.pos.set(0, 0, 40); P.vel.set(0, 0, 0); SB.setCamYaw(0);
  if (id) SB.giveStyle(id);
  run(3);
}
// Stand a dummy somewhere and keep it there.
function put(d, x, z) { d.respawn(false); d.pos.set(x, 0, z); d.anchor.set(x, 0, z); d.vel.set(0, 0, 0); return d; }
function putBack(...list) { for (const d of list) { d.anchor.copy(d.base); d.respawn(false); } }
const basics = () => dummies.filter(d => d.type === 'basic' && !d.patrol);
// Meteor Slam from 6 up, and wait for the landing.
function slamHere() { P.pos.y = 6; P.grounded = false; P.cd.r = 0; press('KeyR', 3); for (let i = 0; i < 90 && P.state !== 'normal'; i++) run(1); }
check('element: the skills are renamed while a style is on', () => {
  asElement('flame'); if (SB.skillAlt('q') !== 'Fire Burst' || SB.skillAlt('r') !== 'Burning Crater') return false;
  SB.giveStyle('water'); if (SB.skillAlt('e') !== 'Whirlpool') return false;
  SB.clearStyle();
  return SB.skillAlt('q') === null;
});
check('element: Flame slam leaves a crater that burns whoever walks in, then goes out', () => {
  asElement('flame'); slamHere();
  if (SB.zoneCount() !== 1) return false;
  const d = put(basics()[0], 1.5, 40); run(20);
  const burning = d.burnT > 0;
  run(60 * 7);
  const out = SB.zoneCount() === 0;
  putBack(d);
  return burning && out;
});
check('element: Flame Cyclone leaves a trail of fire; a plain one leaves nothing', () => {
  asElement(null); press('KeyE', 40); if (SB.zoneCount() !== 0) return false;
  asElement('flame'); press('KeyE', 40);
  return SB.zoneCount() >= 3;
});
check('element: Flame Blink Strike explodes on those standing near the target', () => {
  asElement('flame');
  const [a, b] = basics(); put(a, 0, 34); put(b, 2.5, 34);
  const hp = b.hp;
  SB.blinkPower(a, { dmg: 40 });
  const ok = b.hp < hp && b.burnT > 0;
  putBack(a, b);
  return ok;
});
check('element: Thunder Blink Strike jumps on to two more enemies and stuns them', () => {
  asElement('thunder');
  const [a, b, c, far] = basics(); put(a, 0, 34); put(b, 4, 34); put(c, 8, 34); put(far, 30, 34);
  const hpB = b.hp, hpC = c.hp, hpFar = far.hp;
  SB.blinkPower(a, { dmg: 40 });
  const ok = b.hp < hpB - 20 && c.hp < hpC - 20 && far.hp === hpFar && b.stunT > 0 && c.stunT > 0 && Math.hypot(P.pos.x - c.pos.x, P.pos.z - c.pos.z) < 2.5;
  putBack(a, b, c, far);
  return ok;
});
check('element: Water Blink Strike soaks the target, which then takes more', () => {
  asElement('water');
  const a = put(basics()[0], 0, 34);
  SB.blinkPower(a, { dmg: 40 });
  if (!(a.soakT > 0)) return false;
  SB.clearStyle();                                        // so only the soaking is measured
  const hp = a.hp; skillHit('atk', a);
  const soaked = hp - a.hp;                               // 10 damage, give or take 10%, times 1.3: at least 12
  a.soakT = 0; const hp2 = a.hp; skillHit('atk', a);
  const dry = hp2 - a.hp;                                 // at most 11
  putBack(a);
  return soaked >= 12 && dry <= 11;
});
check('element: Water Cyclone drags enemies in from outside its reach', () => {
  asElement('water');
  const d = put(basics()[0], 6, 37);                      // off to the side of the path, beyond the spin
  press('KeyE', 20);
  const pulled = d.pos.x < 5;
  putBack(d);
  return pulled;
});
check('element: Thunder Cyclone can be steered', () => {
  asElement('thunder'); SB.keys.add('KeyW'); press('KeyE', 4); SB.keys.delete('KeyW');
  const before = P.skDir.x;
  SB.keys.add('KeyD'); run(12); SB.keys.delete('KeyD');   // lean right mid-spin
  return P.state === 'cyclone' && Math.abs(P.skDir.x - before) > 0.4;
});
check('element: Water slam heals for each enemy hit; Thunder slam stuns', () => {
  asElement('water');
  const [a, b, c] = basics(); put(a, 2, 40); put(b, -2, 40); put(c, 0, 42);
  P.hp = 40; P.hurtT = 0;                                 // hurt just now, so health does not come back by itself
  slamHere();
  const healed = P.hp >= 40 + 17 && P.hp <= 40 + 19;      // 6 for each of the three
  asElement('thunder');
  const f = dummies.find(d => d.type === 'fighter' && !d.gang);
  put(f, 2, 40); f.stunT = 0;
  slamHere();
  const stunned = f.stunT > 1;
  putBack(a, b, c, f);
  return healed && stunned;
});
check('element: Thunder Rising Slash calls a bolt down a moment later', () => {
  asElement('thunder');
  const d = put(basics()[0], 0, 38.5);                    // just in front
  press('KeyF', 3);
  const afterCut = d.hp;
  if (SB.pendingCount() !== 1 || afterCut === d.maxHp) return false;
  run(40);
  const ok = SB.pendingCount() === 0 && d.hp < afterCut - 20;
  putBack(d);
  return ok;
});
check('element: a respawn puts the fires out', () => {
  asElement('flame'); slamHere();
  if (SB.zoneCount() !== 1) return false;
  SB.respawnPlayer(); run(2);
  return SB.zoneCount() === 0 && SB.pendingCount() === 0;
});
// the elemental dash: under a sword style the body turns into the element for the dash and comes back smoothly
const dashForm = SB.dashForm, rootScale = () => SB.player.root.scale.x;
// Stand in open ground and dash forwards under a style (null = none). Returns after the given number of frames.
function dashAs(id, frames) {
  reset(); P.pos.set(0, 0, 40); P.vel.set(0, 0, 0); SB.setCamYaw(0); SB.clearStyle();
  if (id) SB.giveStyle(id);
  SB.keys.add('KeyW'); run(3); press('ShiftLeft', frames); SB.keys.delete('KeyW');
}
check('dash form: a plain dash stays a body with afterimages', () => {
  dashAs(null, 6);
  return P.state === 'dash' && dashForm.amount === 0 && rootScale() === 1 && !SB.dashSoft.points.visible;
});
for (const id of ['flame', 'thunder', 'water']) {
  check('dash form: ' + id + ' turns the body into its element and brings it back', () => {
    dashAs(id, 7);
    // mid-dash: all element, the body shrunk to almost nothing, and the effect on screen
    const effect = id === 'thunder' ? SB.dashBolts.some(b => b.m.visible) : SB.dashSoft.points.visible;
    if (P.state !== 'dash' || dashForm.amount !== 1 || rootScale() > 0.1 || !effect || !SB.dashBright.points.visible) return false;
    // fire and water are ribbons streaming back from the player; lightning is its bolt
    if (SB.dashRibbons.visible !== (id !== 'thunder')) return false;
    // just after: partway back, neither gone nor whole (this is the smooth part)
    run(9);
    if (P.state === 'dash' || !(rootScale() > 0.15 && rootScale() < 0.98)) return false;
    // a little later: whole again, and soon nothing of the effect is left to draw
    run(20); if (dashForm.amount !== 0 || rootScale() !== 1) return false;
    run(80);
    return !SB.dashSoft.points.visible && !SB.dashBright.points.visible && SB.dashBolts.every(b => !b.m.visible) && !SB.dashRibbons.visible;
  });
}
check('dash form: the dash itself is unchanged by it', () => {
  dashAs(null, 30); const plain = 40 - P.pos.z;
  dashAs('flame', 30); const smoke = 40 - P.pos.z;
  SB.clearStyle();
  return plain > 5 && Math.abs(plain - smoke) < 0.6;
});
check('style: ends on respawn and on class change', () => {
  reset(); SB.giveStyle('flame');
  if (!style.cur) return false;
  SB.respawnPlayer();
  if (style.cur) return false;
  SB.giveStyle('water'); SB.setClass('ninja');
  const cleared = style.cur === null;
  SB.setClass('blade');
  return cleared;
});
// mounts: X calls something to ride. Which one depends on the sword style; any other action gets the player off
const mount = SB.mount, MOUNTS = SB.MOUNTS;
// Stand in open ground, facing along -z with the camera behind, and press X.
function mountUp() { reset(); P.pos.set(0, 0, 40); P.vel.set(0, 0, 0); SB.setCamYaw(0); run(3); press('KeyX', 3); }
const riding = id => P.state === 'mounted' && mount.cur === MOUNTS[id] && P.seat > -0.2;
check('mount: X calls the car, it is faster than running, and X gets off again', () => {
  SB.setClass('blade'); mountUp();
  if (!riding('car')) return false;
  SB.keys.add('KeyW'); run(90); SB.keys.delete('KeyW');
  const speed = Math.hypot(P.vel.x, P.vel.z);
  if (speed < 18 || speed > 22) return false;            // the car's top speed is 21; running is 9.5
  run(70); press('KeyX', 3);                              // past the short cooldown, then off
  return P.state === 'normal' && mount.cur === null && P.seat === 0;
});
check('mount: each sword style has its own, and it changes mid-ride', () => {
  mountUp(); if (!riding('car')) return false;
  SB.giveStyle('flame'); run(3); if (!riding('horse')) return false;
  SB.giveStyle('thunder'); run(3); if (!riding('lion')) return false;
  SB.giveStyle('water'); run(3); if (!riding('elephant')) return false;
  const high = P.seat > 1.5;                              // the rider sits well up on the elephant
  SB.clearStyle(); run(3);
  return high && riding('car');
});
check('mount: riding into an enemy hits it and throws it aside', () => {
  mountUp();
  const d = dummies.find(e => e.type === 'basic');
  d.pos.set(0, 0, 28); d.anchor.copy(d.pos); run(2);
  const hp = d.hp;
  SB.keys.add('KeyW'); run(80); SB.keys.delete('KeyW');   // straight at it from 12 away
  const hit = d.hp < hp;
  d.anchor.copy(d.base); d.respawn(false);
  return hit;
});
check('mount: an attack, a hit or a respawn gets the player off', () => {
  mountUp(); press('M0', 4);
  if (P.state === 'mounted' || mount.cur) return false;
  mountUp(); P.iframes = 0; SB.hurtPlayer(5, dummies[0].pos, dummies[0]); run(2);
  if (P.state === 'mounted' || mount.cur) return false;
  mountUp(); SB.respawnPlayer(); run(2);
  return P.state === 'normal' && mount.cur === null && P.seat === 0;
});
check('style: being defeated mid-scene leaves nothing stuck', () => {
  reset(); slamInto(pool);
  if (P.state !== 'submerge') return false;
  SB.respawnPlayer(); run(5);
  return P.state === 'normal' && P.sink === 0 && style.cur === null;
});
// the story (Blademaster): Sen's tasks are offered, taken, counted and reported in order; gang enemies stay dead
const story = SB.story, phase = () => SB.questState().phase, gang = () => dummies.filter(d => d.gang);
// Take the task on offer and check it is the one expected.
function take(id) { return SB.acceptQuest() && story.cur === id && phase() === 'active'; }
// Knock out every gang member in the world, then wait for them to be cleared away.
function beatGang() { for (const d of gang()) d.ko(1, 0); run(130); }
check('story: starts with the first task on offer, and only for the Blademaster', () => {
  SB.resetProgress(); SB.resetStory(); SB.setClass('ninja');
  if (phase() !== 'none' || SB.questLine() !== null) return false;
  SB.setClass('blade');
  return phase() === 'offer' && SB.questState().quest === SB.QUESTS[0] && SB.questLine().includes('Master Sen');
});
check('story: Sen offers the task in his menu, and taking it closes the menu', () => {
  reset(); P.pos.copy(SB.master.pos); P.pos.z -= 2; P.vel.set(0, 0, 0); run(2);
  press('KeyG', 2);
  if (!dlg.open || !dlg.opts[0].label.startsWith('Story')) return false;
  press('Digit1', 2);                                    // the story card
  if (dlg.page !== 'story') return false;
  press('Digit1', 2);                                    // "Take the task"
  return !dlg.open && story.cur === 'c1-hits' && phase() === 'active';
});
check('story: knockouts are counted, and only the right kind', () => {
  reset();
  const basics = dummies.filter(d => d.type === 'basic');
  dummies.find(d => d.type === 'shield').ko(1, 0);       // a guard is not a practice dummy
  if (story.n !== 0) return false;
  basics[0].ko(1, 0); basics[1].ko(1, 0);
  if (story.n !== 2 || phase() !== 'active') return false;
  basics[2].ko(1, 0);
  return phase() === 'ready' && SB.questLine().includes('tell Master Sen');
});
check('story: reporting to Sen finishes the task and offers the next', () => {
  reset(); P.pos.copy(SB.master.pos); P.pos.z -= 2; P.vel.set(0, 0, 0); run(2);
  press('KeyG', 2); press('Digit1', 2);                  // the card now reports
  const answered = dlg.page === 'story' && story.done.includes('c1-hits') && story.cur === null;
  press('KeyG', 2);
  return answered && phase() === 'offer' && SB.questState().quest.id === 'c1-climb';
});
check('story: a task that is checked every frame (stand somewhere high)', () => {
  reset(); if (!take('c1-climb')) return false;
  run(20); if (phase() !== 'active') return false;       // standing on the ground is not enough
  P.pos.set(0, 12.8, -30); P.vel.set(0, 0, 0); run(20);  // the platform at height 12.8
  return phase() === 'ready' && SB.turnInQuest().id === 'c1-climb';
});
check('story: learning a skill counts, a lent one does not', () => {
  reset(); if (!take('c1-learn')) return false;
  if (!begin('blade-q1')) return false;                  // the trial lends Blink Strike while it runs
  run(10); if (phase() !== 'active') return false;
  SB.endChallenge(); SB.leaveDojo(); run(5);
  SB.unlockAll(); run(5);
  const ok = phase() === 'ready' && !!SB.turnInQuest();
  SB.resetProgress();
  return ok;
});
check('story: scouts appear, hunt the player, do not heal and stay dead', () => {
  reset(); if (!take('c1-scouts')) return false;
  const scouts = gang();
  if (scouts.length !== 4 || dummies.length !== arenaDummies + 4) return false;
  // they come for the player from right across the arena
  P.pos.set(0, 0, 0); P.vel.set(0, 0, 0); P.iframes = 99;
  const far = Math.hypot(scouts[0].pos.x, scouts[0].pos.z);
  run(180);
  if (Math.hypot(scouts[0].pos.x, scouts[0].pos.z) > far - 5) return false;
  // hurt one and leave it alone: no healing, and "reset dummies" does nothing to it
  skillHit('atk', scouts[0]);
  const hurt = scouts[0].hp;
  run(60 * 6); scouts[0].respawn(false);
  if (scouts[0].hp > hurt || hurt >= scouts[0].maxHp) return false;
  scouts[0].ko(1, 0); run(130);
  if (story.n !== 1 || dummies.length !== arenaDummies + 3) return false;
  beatGang();
  return phase() === 'ready' && dummies.length === arenaDummies;
});
check('story: being defeated brings the whole group back and restarts the count', () => {
  SB.turnInQuest();
  reset(); if (!take('c1-rook')) return false;
  if (gang().length !== 3 || gang().filter(d => d.boss).length !== 1) return false;
  gang().find(d => !d.boss).ko(1, 0); run(130);
  if (story.n !== 1 || gang().length !== 2) return false;
  P.iframes = 0; SB.hurtPlayer(9999, dummies[0].pos, dummies[0]); run(5);
  return story.n === 0 && gang().length === 3 && gang().every(d => d.hp === d.maxHp);
});
check('story: changing class pauses the task and takes its enemies away', () => {
  SB.setClass('monk'); run(3);
  if (gang().length !== 0 || phase() !== 'none') return false;
  SB.setClass('blade'); run(3);
  return gang().length === 3 && phase() === 'active';
});
check('story: the chapter ends, and a reset starts it again', () => {
  reset(); P.iframes = 99; beatGang();
  if (phase() !== 'ready' || !SB.turnInQuest()) return false;
  // chapter 2 is on offer next; finishing every task there is ends the story for now
  if (phase() !== 'offer' || SB.questState().quest.chapter !== 2) return false;
  story.done.push(...SB.QUESTS.filter(q => !story.done.includes(q.id)).map(q => q.id));
  if (phase() !== 'end' || SB.questLine() !== null) return false;
  SB.resetStory();
  return phase() === 'offer' && story.done.length === 0 && dummies.length === arenaDummies;
});
// the campaign: districts are taken in order, a mission runs in stages, falling loses it, winning frees the district
const mission = SB.mission, campaign = SB.campaign, DOCKS = SB.DISTRICTS[0].area;
const chapterOne = SB.QUESTS.filter(q => q.chapter === 1).map(q => q.id);
// A fresh campaign with the story far enough along for the docks to be open.
function readyForDocks() {
  reset(); SB.resetStory(); SB.resetCampaign(); SB.unlockAll(); SB.setClass('blade');
  story.done.push(...chapterOne);
}
const foes = () => mission.spawned.filter(d => !d.dead);
// Knock out everything the stage spawned and wait for the next stage to begin.
function clearStage() { for (const d of foes()) d.ko(1, 0); run(140); }
check('campaign: the docks are locked until Sen has finished with you, and later districts until the docks are free', () => {
  reset(); SB.resetStory(); SB.resetCampaign(); SB.setClass('blade');
  if (SB.districtList()[0].open || SB.startMission('docks')) return false;
  story.done.push(...chapterOne);
  const list = SB.districtList();
  return list[0].open && !list[1].open && list.length === 5;
});
check('campaign: Sen shows the city map, and a card starts the mission', () => {
  readyForDocks(); P.pos.copy(SB.master.pos); P.pos.z -= 2; P.vel.set(0, 0, 0); run(2);
  press('KeyG', 2); press('Digit2', 2);                  // "The city"
  if (dlg.page !== 'map' || dlg.opts.length !== 6) return false;    // five districts and Back
  press('Digit1', 2);                                    // the docks
  const there = !dlg.open && mission.cur && Math.hypot(P.pos.x - DOCKS.cx, P.pos.z - (DOCKS.cz + 34)) < 2;
  return there && foes().length === 5 && dummies.length === arenaDummies + 5 && SB.missionLine().includes('Break through the gate');
});
check('campaign: an enemy with a weakness shrugs off the wrong element and falls to the right one', () => {
  const runner = foes().find(d => d.weak === 'thunder');
  let hp = runner.hp; skillHit('atk', runner);
  const plain = hp - runner.hp;                           // 10, give or take 10%, times 0.6: at most 7
  SB.giveStyle('thunder');
  hp = runner.hp; skillHit('atk', runner);
  const weak = hp - runner.hp;                            // times 1.6: at least 14
  SB.clearStyle();
  return plain <= 7 && weak >= 14;
});
check('campaign: stage 2 is reached with the hook: standing on the crane clears it', () => {
  clearStage();
  if (mission.stage !== 1 || foes().length !== 0) return false;
  run(60); if (mission.stage !== 1) return false;         // nothing to fight: it waits for the player to get up there
  P.pos.set(DOCKS.cx + 26, 17, DOCKS.cz + 8); P.vel.set(0, 0, 0); run(10);
  if (!P.grounded) return false;                          // the top of the tower is solid
  run(130);
  return mission.stage === 2;
});
check('campaign: a barricade ignores the sword and breaks to a mount', () => {
  const wall = foes().find(d => d.ramOnly);
  if (foes().filter(d => d.ramOnly).length !== 3) return false;
  const hp = wall.hp;
  if (skillHit('atk', wall) !== false || wall.hp !== hp) return false;
  SB.setHitSrc('ram'); SB.hitDummy(wall, 28, 0, 0, 0, true);    // what the elephant does
  return wall.dead;
});
check('campaign: the boss calls for help at half health, and beating him frees the district', () => {
  clearStage(); clearStage();
  if (mission.stage !== 4) return false;
  const boss = foes().find(d => d.boss);
  if (!boss || foes().length !== 3) return false;
  boss.hp = boss.maxHp * 0.4; run(3);
  if (foes().length !== 6) return false;
  SB.acceptQuest();                                       // chapter 2's task: free the docks
  for (const d of foes()) d.ko(1, 0);
  run(5);
  if (!mission.won || !campaign.free.includes('docks') || P.maxHp !== 120) return false;
  run(60 * 4);
  const home = mission.cur === null && near(0, 14) && dummies.length === arenaDummies;
  return home && phase() === 'ready' && SB.districtList()[0].free;
});
check('campaign: falling loses the mission and sends you home', () => {
  readyForDocks();
  if (!SB.startMission('docks')) return false;
  run(5); P.iframes = 0; SB.hurtPlayer(9999, P.pos, null); run(5);
  return mission.cur === null && near(0, 14) && dummies.length === arenaDummies && campaign.free.length === 0 && P.maxHp === 100;
});
check('campaign: P gives up, and a reset gives every district back', () => {
  if (!SB.startMission('docks')) return false;
  run(5); press('KeyP', 3);
  if (mission.cur !== null || !near(0, 14) || dummies.length !== arenaDummies) return false;
  campaign.free.push('docks'); SB.applyTune();
  if (P.maxHp !== 120) return false;
  SB.resetCampaign();
  return campaign.free.length === 0 && P.maxHp === 100;
});
reset();
SB.resetStory();
SB.resetCampaign();
SB.resetProgress();
check('hall: nothing is left behind', () => !dojo.inside && dummies.length === arenaDummies && dojo.props.length === 0);

log.push(fails.length ? 'SMOKE FAIL (' + fails.length + ')' : 'SMOKE PASS', ...fails);
const pre = document.createElement('pre');
pre.id = 'smoke'; pre.textContent = log.join('\n');
pre.style.cssText = 'position:fixed;left:10px;top:70px;z-index:50;background:#14171c;color:#e8eef3;padding:10px;font-size:12px;max-width:90vw;white-space:pre-wrap';
document.body.appendChild(pre);
document.title = log[0];
