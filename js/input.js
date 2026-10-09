import { clamp, $ } from './util.js';
import { renderer } from './core.js';
import { toast } from './fx.js';
import { camYaw, camPitch, camDist, setCamYaw, setCamPitch, setCamDist } from './camera.js';

// ================= input =================
export const keys = new Set(), pressed = new Set();
export let mouseL = false, mouseR = false, locked = false, sens = 1.2;
export function setMouse(l, r) { mouseL = l; mouseR = r; }    // for tests
addEventListener('keydown', e => {
  if (!locked) return;
  if (e.code !== 'F11' && e.code !== 'F5') e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; });
addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) { mouseL = true; pressed.add('M0'); }
  if (e.button === 2) { mouseR = true; pressed.add('M2'); }
});
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (!locked) return;
  const s = 0.0022 * sens;
  setCamYaw(camYaw - e.movementX * s); setCamPitch(clamp(camPitch - e.movementY * s, -1.3, 1.15));
});
addEventListener('wheel', e => { setCamDist(clamp(camDist + Math.sign(e.deltaY) * 0.6, 2.5, 10)); });
export const overlay = $('overlay');
$('sens').addEventListener('input', e => { sens = +e.target.value; });
$('sens').addEventListener('click', e => e.stopPropagation());
overlay.addEventListener('click', () => {
  const r = renderer.domElement.requestPointerLock();
  if (r && r.catch) r.catch(() => {});
});
export let started = false;
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  overlay.style.display = locked ? 'none' : 'flex';
  $('ovsub').textContent = locked ? '' : (started ? 'Paused' : 'Click to play');
  if (locked && !started) { started = true; toast('Talk to <b>Master Sen</b> (press <b>G</b> next to him) to change class or start a challenge.', 6); }
  if (!locked) { keys.clear(); mouseL = mouseR = false; }
});
