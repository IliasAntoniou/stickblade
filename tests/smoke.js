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

log.push(fails.length ? 'SMOKE FAIL (' + fails.length + ')' : 'SMOKE PASS', ...fails);
const pre = document.createElement('pre');
pre.id = 'smoke'; pre.textContent = log.join('\n');
pre.style.cssText = 'position:fixed;left:10px;top:70px;z-index:50;background:#14171c;color:#e8eef3;padding:10px;font-size:12px;max-width:90vw;white-space:pre-wrap';
document.body.appendChild(pre);
document.title = log[0];
