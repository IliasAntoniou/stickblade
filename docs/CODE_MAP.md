# Stickblade code map

Where everything is, what the short names mean, and how to add things. If this file and the code disagree, the code is right and this file needs fixing.

## Where is it?

| I want to change... | Go to |
|---|---|
| A class's damage, combo speed, reach, cooldowns, run speed | The `CLASSES.<name> = {` table at the bottom of `js/classes/blade.js`, `js/classes/ninja.js`, `js/classes/monk.js` or `js/classes/lancer.js` |
| Which Blademaster skills start locked, and what each rank gives (damage, cooldown, perks) | The `start`, `lv` and `perks` of each skill in the `CLASSES.blade = {` table in `js/classes/blade.js` |
| A trial's goal, time limit or difficulty | `CLASSES.blade.trials` at the bottom of `js/classes/blade.js` |
| What the training hall looks like for a trial (platforms, which enemies, where they stand) | The `arena` of that trial in `CLASSES.blade.trials` in `js/classes/blade.js` |
| The training hall itself (size, place, walls, the teleport) | `js/dojo.js` |
| How trials and ranks work in general | `js/progress.js` |
| What a skill does when pressed | Its function in the class file, for example `bmBlink()` in `js/classes/blade.js` |
| What a skill does while it lasts | The `case` named after its state in `update()` in `js/update.js` |
| How a skill or move looks (the pose) | `animatePlayer()` in `js/anim.js` |
| Try out a number while playing (speed, jump, damage, health...) | Pause with Tab or Esc and use the tuning panel. Nothing to edit |
| Jump height, gravity, dash, player health, damage and cooldown multipliers (the permanent defaults) | `TUNE_DEFAULTS` in `js/state.js` |
| Which sliders the tuning panel shows, and their ranges | `GROUPS` and `classRows()` in `js/tuning.js` |
| Running, air control, wall jump, slide feel | The `normal` and `slide` cases in `update()` in `js/update.js` |
| Player health, getting hit, block, parry | `hurtPlayer()` and `parry()` in `js/player.js` |
| Collision with walls and floors | `moveAxis()` and `integrate()` in `js/player.js` |
| A dummy type's health or colour | `DTYPE` in `js/dummies.js` |
| Where dummies stand | The `dummies` list in `js/dummies.js` |
| How the fighter attacks | `fighterAI()` in `js/dummies.js` |
| How hits work (damage, knockback, shield block) | `hitDummy()` and `dealDamage()` in `js/dummies.js` |
| The map (boxes, platforms, walls) | The `addBox()` lines in `js/world.js` |
| Kunai and javelin | `js/projectiles.js` |
| A challenge's goal, or a new challenge | `CH` and `updateChallenge()` in `js/challenges.js` |
| Master Sen's lines and menu | `GREET`, `TIPS` and `renderDlg()` in `js/master.js` |
| Camera distance, shake, zoom with speed, lock-on | `updateCamera()` in `js/camera.js` |
| Which key does what | The "actions" block in `update()` in `js/update.js`; raw key handling is in `js/input.js` |
| Mouse sensitivity | `sens` in `js/input.js` |
| Skill bar, health bar, stats line | `js/hud.js`; their look is the CSS at the top of `index.html` |
| The start / pause menu text | The `#overlay` block in `index.html` |
| Slash arcs, rings, sparks, damage numbers, hitstop | `js/fx.js` |
| Sky colours, fog, overall brightness | `SKY` and `toneMappingExposure` in `js/core.js`; the sky itself is drawn in `js/sky.js` |
| The lighting (sun colour, direction, strength; the soft light from the sky) | `sun`, `SUN_OFFSET` and `hemi` in `js/core.js` |
| Box colours, the floor tiles, how dark boxes get at the base | `COL`, `tileTex`, `makeFloor()` and the shading block under `boxGeo` in `js/world.js` |
| How much things glow (slash arcs, impact flashes, the halo on the weapon) | `spawnGlow()` and the effect pools in `js/fx.js`; `bladeGlow` in `js/player.js` |
| The outline light on characters | `addRim()` in `js/stickman.js` |
| What Low and High graphics do | `applyQuality()` in `js/quality.js` |
| What gets saved between sessions | `save` in `js/util.js` |

## What happens every frame

`frame()` in `js/main.js` runs once per screen refresh:

1. `update()` (`js/update.js`), only while the mouse is captured:
   1. count down cooldowns and timers
   2. Master Sen and his dialog
   3. read the keys
   4. start actions (dash, skills, attack, slide)
   5. run the block for the player's current state (`P.state`)
   6. advance the basic attack
   7. `integrate()`: move the player and resolve collisions
   8. update every dummy, every projectile, and the challenge
2. `animatePlayer()` (`js/anim.js`): work out the pose.
3. `updateFx()` (`js/fx.js`): fade the effects.
4. `updateCamera()` (`js/camera.js`): place the camera, find what the crosshair is on.
5. `updateDomFx()` and `updateHud()`: floating text and the on-screen display.
6. Draw.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: HTML for the menu and HUD, all the CSS, and one line that loads `js/main.js` |
| `js/main.js` | Entry point and the frame loop |
| `js/util.js` | Maths helpers, scratch vectors, the save file |
| `js/core.js` | Renderer, scene, camera, lights |
| `js/world.js` | The map's boxes, ground height lookup, blob shadows |
| `js/stickman.js` | Builds stick figures; the pose tables |
| `js/state.js` | Shared state: `P`, `CL`, `T`, combo counters, `CLASSES` |
| `js/fx.js` | Effects, messages, screen shake, hitstop |
| `js/dummies.js` | The `Dummy` class, the list of dummies, the damage functions |
| `js/projectiles.js` | Kunai and javelin |
| `js/player.js` | Player body, collision, taking damage, basic attack, dash, slide, rewind |
| `js/camera.js` | Camera and aiming |
| `js/classes/index.js` | Loads the class files; `setClass()` |
| `js/classes/blade.js`, `ninja.js`, `monk.js`, `lancer.js` | One class each: skill functions and the class table |
| `js/master.js` | Master Sen and the dialog menu |
| `js/challenges.js` | Timed challenges |
| `js/input.js` | Keyboard, mouse, pause |
| `js/update.js` | One step of the game |
| `js/anim.js` | Player poses |
| `js/hud.js` | On-screen display |
| `js/tuning.js` | The tuning panel shown while paused |
| `js/progress.js` | Skill ranks and the trials that earn them |
| `js/dojo.js` | The training hall: teleporting there, building and clearing each trial's layout |
| `js/sky.js` | The dusk sky: gradient dome, sun, stars |
| `js/quality.js` | The Low / High graphics setting |
| `vendor/three.module.js` | The three.js library (not ours; do not edit) |
| `tests/smoke.js`, `tests/smoke.sh` | Automated test that plays every class and skill |
| `tests/drawcost.sh` | Prints draw calls and triangles per frame, to compare before and after a graphics change |
| `tests/check_docs.py` | Checks file headers and that this map points at real things |
| `serve.py` | The local web server (tells the browser not to keep old copies of files) |
| `play.bat` | Starts the server and opens the game |

## Glossary

| Name | Meaning |
|---|---|
| `P` | The player: `P.pos`, `P.vel` (speed), `P.hp`, `P.state`, `P.cd` (cooldowns)... Full list at `Object.assign(P, {` in `js/player.js` |
| `P.state`, `P.st` | What the player is doing (`normal`, `dash`, `slide`, or a skill such as `cyclone`) and for how many seconds |
| `CL` | The class being played, one entry of `CLASSES` |
| `TUNE`, `TUNE_DEFAULTS` | The numbers the tuning panel can change, and their defaults. In `js/state.js` |
| `T` | Game time in seconds |
| `dt` | Game seconds since the last frame. Shrinks during hitstop |
| `rdt` | Real seconds since the last frame |
| `_a` `_b` `_c` `_d` `_e`, `_fx`, `_hv`... | Shared scratch vectors. Any call may overwrite them |
| `V3` | three.js `Vector3`: an x, y, z triple. y is up |
| `yaw`, `pitch` | Turn left/right, and look up/down, in radians |
| `inDir`, `hasIn` | The direction the movement keys point, and whether any is held |
| `hsp` | Horizontal speed |
| `solids` | The map's collision boxes |
| `d` | A dummy, in most loops |
| `DTYPE` | Dummy types |
| `CH`, `chal` | The list of challenges, and the one running |
| `dlg` | Master Sen's dialog state |
| `SK` | The skill bar's slots |
| `S` | Shorthand for `CL.skills` inside `update()` |
| `m2`, `q`, `e`, `r`, `f`, `x` | Skill slots: right mouse, the Q E R F keys, and Rewind |
| `M0`, `M2` | Left and right mouse button, as they appear in `pressed` |
| `tp`, `pose` | Target pose and current pose |
| hitstop | The brief slow motion when a hit lands |
| draw call | One instruction to the graphics card to draw one object. The main measure of how heavy a frame is; shown as Draws with `?debug` |
| tone mapping | Squeezing very bright colours into what a screen can show, so they glow instead of turning flat white |
| additive | A way of drawing where colour is added on top of what is behind, so the object looks like light |
| rim light | Extra brightness on the edges of a character, so its outline shows against a dark background |
| `SKY` | The dusk palette that both the sky and the fog are made from |
| iframes | Seconds during which the player cannot be hit |
| pool | A fixed set of objects reused over and over, never created during play |
| lock-on, `lockTarget` | The dummy nearest the crosshair |
| `aimHit` | The point on the map under the crosshair |
| rank | How far a skill has been trained: 0 = locked, 1 to 3 = learned. `rankOf()` in `js/progress.js` |
| trial | A timed test that earns a rank. Runs on top of the challenge system; `chal.st` is its scratch space, `chal.st.n` its progress |
| training hall, `dojo` | The separate room where trials happen, at x = 300. `dojo.inside` is true while the player is there |
| `arena` (on a trial) | The boxes and dummies the hall builds for that trial, in coordinates relative to the hall's centre |
| `area` | The square the player is kept inside: the main arena or the hall. In `js/world.js` |
| `lv` | A skill's numbers at each rank. The current rank's row is copied onto the skill by `applyRanks()` |
| `hitSrc` | Which attack the current hits belong to: `atk`, `q`, `e`, `r`, `f` or `other`. Set with `setHitSrc()` just before dealing damage |
| `P.castN` | Counts skill uses, so a trial can tell one use from the next |
| `SB` | `window.SB`, the test handle that exists only with `?debug` |

## Recipes

### Add or change a skill

1. Write the start function in the class file (copy a neighbour such as `bmCyclone()`). Set the cooldown there: `P.cd.e = CL.skills.e.cd`.
2. Point the slot at it in the class table: `e: { n: 'Name', cd: 5, fn: myFunction }`.
3. If the skill lasts longer than one frame: call `setState('myState')` in the start function and add `case 'myState':` to the switch in `update()` in `js/update.js`. The case must return to `setState('normal')` when done.
4. Give it a pose: add an `else if (st === 'myState')` branch in `animatePlayer()` in `js/anim.js`.
5. If nothing may interrupt it, add the state to `LOCKED` in `js/player.js`. If the player cannot be hit during it, add it to `isInvuln()`.
6. Run the smoke test. It presses every skill key for every class, so a new skill is covered automatically.

### Make a number tunable in the panel

1. Add it to `TUNE_DEFAULTS` in `js/state.js` with a comment saying what it does.
2. Use `TUNE.<name>` where the game needs the number. Read it every time; do not copy it into a constant.
3. Add a row to `GROUPS` in `js/tuning.js`: key, label, min, max, step (or just key and label for an on/off switch).
4. If the number is copied onto the player or the dummies (like max health), also handle it in `applyTune()`.
5. Add a check to the tuning part of `tests/smoke.js` proving the number changes the game and that reset undoes it.

### Give a skill ranks and trials

The Blademaster is the worked example; copy from `js/classes/blade.js`.

1. In the class table, replace the skill's `cd` with `start` (0 = locked for a new player, 1 = known), `lv` (three rows of numbers, every row listing every key, `cd` included) and `perks` (one line per rank).
2. Make the skill's code read those numbers, for example `CL.skills.q.dmg`, in place of fixed values.
3. Just before the skill deals damage, call `setHitSrc()` with its slot (`'q'`, `'e'`, `'r'` or `'f'`), so trials know which skill hit.
4. Add its trials to `CLASSES.<id>.trials`: `slot`, `rank`, `name`, `desc`, `time`, `goal`, optionally `allow`, an `onHit` that raises `st.n`, and an `arena` listing the boxes (`props`) and dummies (`spawn`) the training hall should build. To look at a layout without playing the trial, open `http://localhost:8000/?debug=hall:<trial id>`.
5. Add checks to the progression part of `tests/smoke.js`.

A class with no `lv` on any skill has no progression: everything is usable from the start.

### Add a class

1. Copy `js/classes/blade.js` to a new file and rename the table to `CLASSES.<id> = {`. All five slots (`m2`, `q`, `e`, `r`, `f`) must exist.
2. In `js/classes/index.js`: import the file and add the id to `CLASS_ORDER`.
3. `style` must be `slash`, `dagger`, `punch` or `thrust`, or add a new case to `attackVfx()` in `js/player.js` and to the attack part of `animatePlayer()`.
4. `weapon` must be `sword`, `daggers`, `spear` or `none`, or add a new one in `makeStickman()` and `setWeapon()` in `js/stickman.js`.
5. Run the smoke test: it loops over `CLASS_ORDER`.

### Add a dummy type

1. Add it to `DTYPE` in `js/dummies.js` (colour, health).
2. Place at least one in the `dummies` list.
3. Give it behaviour with checks on `this.type` in the `Dummy` class, the way `shield` and `flying` do.
4. Run the smoke test: it loops over `DTYPE` and fails if a type has no dummy on the map.

### Add a challenge

1. Add it to `CH` in `js/challenges.js` (id, name, description).
2. In `updateChallenge()` add a branch for its id that sets `prog` (the progress text) and `done`.
3. If it shows objects (like the rings), show them in `startChallenge()` and hide them in `endChallenge()`.
4. Run the smoke test: it loops over `CH`.

### Change the map

Until maps become data files, the map is spread over: the `addBox()` lines in `js/world.js`, the `dummies` list in `js/dummies.js`, `SPAWN` in `js/state.js`, Master Sen's position in `js/master.js`, and `RING_PTS` plus the Summit check in `js/challenges.js`.

## Traps

- **Changing another file's variable.** A variable imported from another file can be read but not assigned. `hitstop = 0.1` from outside `js/fx.js` throws an error; call `addHitstop()` instead. The setters are at the bottom of `js/state.js`, `js/fx.js` and `js/camera.js`.
- **Scratch vectors.** `_a` to `_e` are shared by everything. Fill one, use it, and assume it is gone after calling any other function.
- **Top-level code.** Code outside functions may only use things from `util`, `core`, `world`, `stickman`, `state` and `fx`. Anything else may not be loaded yet.
- **Dummies and boxes can now come and go.** Trial dummies are added with `spawnDummy()` and removed with `removeDummy()`; trial boxes with `addBox()` and `removeBox()`. Never keep a dummy in a variable across frames without checking `d.dead`.
- **`SPAWN` moves.** It is where the player respawns: the arena start, the hall's arrival point, or a trial's start. `js/dojo.js` changes it.
- **Glow needs `toneMapped: false`.** Any material meant to look like light (effects, the weapon, warning marks) must set it, or tone mapping dulls it. Lit objects must not set it.
- **`lam()` is for boxes only.** It expects the shading baked into `boxGeo`; on any other shape the result is black.
- **Low quality has a draw budget.** The smoke test fails if one frame on Low needs more than 335 draw calls. Put expensive extras behind High in `js/quality.js`.
- **Pools.** Effects and projectiles are never created during play. Use `spawnRing()`, `burst()`, `fireProj()` and friends.
- **`dt` or `rdt`.** Gameplay uses `dt` so it slows down during hitstop. Camera and on-screen display use `rdt`.
- **Only boxes.** Collision assumes every solid is an upright box. A slope or rotated wall will not collide correctly.
- **Trials and tuning.** A trial will not start, and fails if running, while any tuning value differs from default. That is deliberate: it stops tuned numbers being used to pass.
- **Stale files.** Always serve the game with `serve.py` (or `play.bat`). A plain web server lets the browser keep running old copies of changed files.
- **Saved tuning.** Slider changes are stored in the browser and come back next time. If the game feels wrong, press "Reset all" in the panel before looking for a bug. The smoke test always runs on defaults.
- **The game only runs while the mouse is captured.** That is the pause system. For testing without it, add `?debug` to the address.

## If something breaks

1. Open the browser console (F12) and read the first red error. It names the file and line.
2. Run `bash tests/smoke.sh` with the server running. It lists which class, skill or dummy fails.
3. `git status` and `git diff` show what changed since the last commit.
4. `git restore <file>` throws away uncommitted changes to that file. This cannot be undone.
5. Every merged version has a tag, listed in `CHANGELOG.md`. `git checkout v0.1-modules` looks at that version; `git checkout main` comes back.
