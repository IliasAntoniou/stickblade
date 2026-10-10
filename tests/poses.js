// Pose viewer: open index.html?debug=pose:<name> to freeze the game in the middle of an action and look at it from
// the side. For checking animation and effects without having to catch the moment by hand.
// Names: idle, run, slash0, slash1, slash2, cyclone, slam, rising. Add &view=<angle> to turn the camera (radians).
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
const skills = SB.CL.skills;
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
SB.setCamDist(4.2);
for (let i = 0; i < 90; i++) SB.updateCamera(DT);
document.title = 'pose: ' + name;
