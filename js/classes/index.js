import './blade.js';
import './ninja.js';
import './monk.js';
import './lancer.js';
import { _fx, $, save, persist } from '../util.js';
import { setWeapon } from '../stickman.js';
import { spawnRing, burst, toast } from '../fx.js';
import { P, CL, CLASSES, setCL } from '../state.js';
import { projAccent } from '../projectiles.js';
import { bladeMat, player, cloneSm, setState, cleanupClassObjects } from '../player.js';
import { buildSkillBar } from '../hud.js';

// ================= classes =================
export const CLASS_ORDER = ['blade', 'ninja', 'monk', 'lancer'];

export function setClass(id, announce = true) {
  if (CL) { cleanupClassObjects(); setState('normal'); }
  setCL(CLASSES[id] || CLASSES.blade);
  bladeMat.color.setHex(CL.color); projAccent.color.setHex(CL.color);
  setWeapon(player, CL.weapon); setWeapon(cloneSm, CL.weapon);
  for (const k in P.cd) P.cd[k] = 0;
  P.run = CL.run; P.airJumpsMax = CL.airJumps; P.airJumps = CL.airJumps; P.atk.on = false; P.atk.lastCombo = 0;
  buildSkillBar();
  $('hp').querySelector('.cls').textContent = CL.name.toUpperCase();
  save.cls = CL.id; persist();
  if (announce) {
    spawnRing(_fx.copy(P.pos).setY(P.pos.y + 0.05), 0.3, 3, 0.45, CL.color);
    burst(_fx.setY(P.pos.y + 1), 20, 8);
    toast(`You are now a <b>${CL.name}</b>.<br>"${CL.quote}"`, 4);
  }
}
