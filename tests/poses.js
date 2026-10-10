// Pose viewer: open index.html?debug=pose:<name> to freeze the game in the middle of an action and look at it from
// the side. For checking animation and effects without having to catch the moment by hand.
// Names: idle, run, slash0, slash1, slash2, cyclone, slam, rising, master, pool, fire, cloud, ignite, submerge, storm,
// grab, splat, enemies.
// Add &view=<angle> to turn the camera (radians), &style=water, flame or thunder to see a sword style,
// &lit=1 to show the pool, fire and storm as unlocked, &cutin=water, flame or thunder to hold the eye close-up on screen,
// &dist=<units> to pull the camera back,
// and &menu=main, classes, chal, train or tips to open that page of Master Sen's menu.
const SB = window.SB;
const { P, pressed, keys } = SB;
const params = new URLSearchParams(location.search);
const name = params.get('debug').slice(5);
const DT = 1 / 60;
function run(n) {
  for (let i = 0; i < n; i++) { SB.updateCamera(DT); SB.step(DT); }
}
// Tap the attack button and let the swing run for some frames.
function swing(frames) {
  pressed.add('M0');
  run(frames);
}

run(20);    // settle into the idle stance first
if (params.get('style')) SB.forceStyle(params.get('style'));
// stand next to something to look at it
const beside = { grab: SB.master.pos, master: SB.master.pos, pool: SB.sources[0].pos, fire: SB.sources[1].pos, ignite: SB.sources[1].pos, submerge: SB.sources[0].pos,
  cloud: SB.sources[2].pos, storm: SB.sources[2].pos }[name];
if (beside) { P.pos.set(beside.x + 1.2, beside.y, beside.z - 4.2); run(30); }
const skills = SB.CL.skills;
// the two scenes, stopped partway: standing in the fire, and halfway under the water
if (name === 'ignite' || name === 'submerge') { SB.startTake(SB.sources[name === 'ignite' ? 1 : 0]); run(name === 'ignite' ? 12 : 6); }
// spinning in the storm while the lightning comes down
if (name === 'storm') { SB.startTake(SB.sources[2]); run(14); }
// thrown by Master Sen, stopped flat against the rock
if (name === 'splat') {
  const m = SB.master.pos;
  SB.strikeMaster(m.x, m.y, m.z, 3); run(45);
  SB.master.nextMove = 'throw';
  SB.strikeMaster(m.x, m.y, m.z, 3);
  for (let i = 0; i < 260 && !P.splat; i++) run(1);
  run(4);
}
// held up by the neck by Master Sen: hit him, wait, hit him again, and stop partway through the hold
if (name === 'grab') {
  const m = SB.master.pos;
  SB.strikeMaster(m.x, m.y, m.z, 3); run(45);
  if (params.get('throw')) SB.master.nextMove = 'throw';                    // &throw=1 shows the throw instead
  SB.strikeMaster(m.x, m.y, m.z, 3); run(params.get('throw') ? 76 : params.get('jump') ? 58 : 34);    // &jump=1 stops at the top of his leap
}
// one of each kind of enemy, lined up in front of the player
if (name === 'enemies') {
  ['basic', 'shield', 'flying', 'fighter'].forEach((type, i) => {
    const d = SB.dummies.find(e => e.type === type);
    d.anchor.set(P.pos.x - 3.3 + i * 2.2, 0, P.pos.z - 3.2); d.base.copy(d.anchor); d.radius = 0; d.patrol = 0; d.pos.copy(d.anchor);
    d.ai = 'none';
  });
  run(20);
}
if (params.get('cutin')) {
  const band = document.getElementById('cutin');
  band.style.setProperty('--style', '#' + SB.STYLES[params.get('cutin')].color.toString(16).padStart(6, '0'));
  band.classList.add('on', 'lit');
}
if (name === 'run') { keys.add('KeyW'); run(45); }
if (name === 'slash0') swing(7);
if (name === 'slash1') { swing(17); swing(7); }
if (name === 'slash2') { swing(17); swing(17); swing(10); }
if (name === 'cyclone') { skills.e.fn(); run(14); }
if (name === 'rising') { skills.f.fn(); run(5); }
if (name === 'slam') { P.pos.y = 6; P.grounded = false; skills.r.fn(); run(13); }

SB.freeze(true);
// Swing the camera round to the side and a little above, then let it settle there.
SB.setCamYaw(Number(params.get('view') || 2.0));
SB.setCamPitch(-0.22);
SB.setCamDist(Number(params.get('dist') || 4.2));
for (let i = 0; i < 90; i++) SB.updateCamera(DT);
if (params.get('menu')) { SB.openDlg(); SB.dlg.page = params.get('menu'); SB.renderDlg(); }
document.title = 'pose: ' + name;
