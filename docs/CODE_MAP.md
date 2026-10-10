# Stickblade code map

For what every ability and sword style does, see `docs/ABILITIES.md`. For the story and its tasks, see `docs/STORY.md`.

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
| The story: what Sen says, what each task asks for, how many it takes, which enemies it brings and where | `QUESTS` in `js/quests.js` |
| The campaign: the districts, their layout, their stages, which enemies each stage brings and where | `DISTRICTS` in `js/missions.js` |
| The kinds of enemy in missions (health, speed, size, which element they are weak to) | `THUG`, `RUNNER`, `IRON`, `RAT`, `BARRICADE`, `BLOCKADE`, `MARROW`, `TWIN_EMBER` and `TWIN_TIDE` in `js/missions.js` |
| A timed stage: how long the player has | `time` on the stage in `DISTRICTS` in `js/missions.js` |
| Where the curtains of light stand (the ones only a dash passes) | `gates` on the district in `DISTRICTS`; how one looks and blocks is `addPhaseWall()` in `js/world.js` |
| The prisoner to be rescued | `captive` in `js/missions.js`; a stage shows him with `rescue: true` |
| How much a weakness matters, and how hard a mount hits a barricade | `WEAK_BONUS` and `RAM_BONUS` in `js/dummies.js`; `tough` on the enemy kind |
| What freeing a district gives, the healing between stages, and how slowly health returns in a mission | `HP_PER_DISTRICT`, `STAGE_HEAL` and `MISSION_REGEN` in `js/missions.js` |
| The city map in Sen's menu | The `map` page of `renderDlg()` in `js/master.js`; what it lists comes from `districtList()` in `js/missions.js` |
| What a barricade looks like, and the headband colours | `barricadeGeo` and `weakBandMat` in `js/skins.js` |
| How strong the gang's fighters are (health, colour) | `SCOUT` and `ROOK` in `js/quests.js` |
| How far a gang member sees and how fast it walks | `GANG_SIGHT` and `GANG_SPEED` in `js/dummies.js` |
| What the gang looks like (headband, mask) | The `d.gang` part of `dressDummy()` in `js/skins.js` |
| The task shown at the top right of the screen | `questLine()` in `js/quests.js`; its look is the `#quest` CSS in `index.html` |
| The story card and the story page in Sen's menu | `storyCard()` and the `story` page of `renderDlg()` in `js/master.js` |
| A challenge's goal, or a new challenge | `CH` and `updateChallenge()` in `js/challenges.js` |
| Master Sen's lines, and what is on each page of his menu | `GREET`, `TIPS` and `renderDlg()` in `js/master.js` |
| How his menu looks (the window, the cards, his portrait) | The `#dlg` CSS and HTML in `index.html` |
| The pictures on the menu cards | `ICONS` in `js/master.js` |
| What happens when he is hit: the warning and how long it lasts | `strikeMaster()`, `warnPlayer()` and `WARNING_TIME` in `js/master.js` |
| The grab, then the slam or the throw: timing, how high he leaps, how much health each takes | `grabPlayer()`, `updateGrab()` and the `GRAB_...`, `SLAM_...`, `THROW_...` and `JUMP_HEIGHT` numbers in `js/master.js` |
| Which rocks he can throw you at, and where on them you hit | `pickWall()` in `js/master.js` |
| How long you stay stuck to the rock, and how fast and flat the throw is | `STUCK_TIME`, and `throwTime` and `throwArc` in `updateGrab()`, in `js/master.js` |
| How his head and eyes follow the player | `updateMaster()` in `js/master.js` |
| Camera distance, shake, zoom with speed, lock-on | `updateCamera()` in `js/camera.js` |
| How far the mouse wheel can zoom in and out, and where the zoom starts | `CAM_NEAR`, `CAM_FAR` and `camDist` in `js/camera.js` |
| A mount's speed, turning, jump and ramming damage | `MOUNTS` in `js/mounts.js` |
| What a mount looks like | `buildCar()`, `buildHorse()`, `buildLion()` and `buildElephant()` in `js/mounts.js` |
| How riding moves, and what ramming hits | `updateMounted()` in `js/mounts.js` |
| How a mount's legs, wheels and flames move | `animateMount()` in `js/mounts.js` |
| How the rider sits | The `mounted` branch of `animatePlayer()` in `js/anim.js` |
| Which key does what | The "actions" block in `update()` in `js/update.js`; raw key handling is in `js/input.js` |
| Mouse sensitivity | `sens` in `js/input.js` |
| Skill bar, health bar, stats line | `js/hud.js`; their look is the CSS at the top of `index.html` |
| The start / pause menu text | The `#overlay` block in `index.html` |
| Slash arcs, rings, sparks, damage numbers, hitstop | `js/fx.js` |
| Sky colours, fog, overall brightness | `SKY` and `toneMappingExposure` in `js/core.js`; the sky itself is drawn in `js/sky.js` |
| The lighting (sun colour, direction, strength; the soft light from the sky) | `sun`, `SUN_OFFSET` and `hemi` in `js/core.js` |
| Rock colours | `COL` in `js/world.js` |
| How chipped and uneven the rocks are, and how finely they are faceted | `CHIP` and `rockGeo()` in `js/world.js` |
| The grass on the ground: its colours | `grassTex` and the tint on the `ground` line in `js/world.js` |
| The training hall's tiled floor | `tileTex` and `makeFloor()` in `js/world.js`, used from `js/dojo.js` |
| A sword style's colour, how long it lasts, how strong its effect is (burn damage, extra reach) | `STYLES` and `STYLE_TIME` in `js/styles.js` |
| What a sword style does to each skill, and every number behind it (explosion size, stun times, healing, how long fire burns) | `POWERS` in `js/elements.js` |
| What being soaked does to an enemy | `SOAK` in `js/elements.js` |
| What a skill is called on the skill bar under a style | `names` in `POWERS` in `js/elements.js` |
| The patches of fire left on the ground | `addZone()` and `updateElements()` in `js/elements.js` |
| The ribbons of fire and water in a dash: how many, how wide, how long they last, how they wave, their colours | `RIBBONS` in `js/dashfx.js` (`bend` is the motion, `tint` the colour); `RIBBON_WIDTH` and `RIBBON_GLOW` vary them |
| The soft edges and fine streaks on a ribbon | `ribbonTex` in `js/dashfx.js` |
| The swarm of embers or the head of water at the front of a dash | Each `stream` in `FORMS`, and `HEAD_PACE`, in `js/dashfx.js` |
| Where the pool and the fire stand in the arena | The two `addSource()` lines at the bottom of `js/styles.js` |
| How a style is taken (how close a slam has to land; how far away a fire can be locked on to; how wide a storm is) | `slamSources()`, `aimedFire()`, `FIRE_LOCK_RANGE`, `stormAt()` and `STORM_RADIUS` in `js/styles.js` |
| Thunder's jump from one enemy to the next (share of damage, range) | `chainLightning()` and `chain`, `chainRange` in `STYLES.thunder` in `js/styles.js` |
| The scene when a style is taken (going under the water, standing in the fire, spinning in the storm, how long it lasts) | `startTake()`, `updateTake()` and the `TAKE_...` numbers in `js/styles.js` |
| The close-up of the eyes: their shape, the path of the slash, and the timing | `SHAPE`, `EYE`, `SLASH_PATH` and the three timings at the top of `js/cutin.js` |
| The close-up of the eyes: colours, glow, shake and the other motion | The `#cutin` CSS in `index.html` |
| The lock-on ring | The lock part of `updateHud()` in `js/hud.js`; what gets locked is decided at the end of `updateCamera()` in `js/camera.js` |
| The suit worn under a style: what colour it glows | `glow`, `core`, `glowHex` and `eyes` in `STYLES` in `js/styles.js` |
| The thin wisps running along the sword under a style | `wispTex` and `wispMat` in `js/styles.js`; how fast they flow is the `wispTex.offset` line in `updateStyles()` |
| The hair worn under a style: the tongues of fire, the strands of water, the spikes of lightning | `TONGUES`, `STRANDS`, `SPIKES` and the hair lines in `attachOutfit()` in `js/styles.js` |
| How the hair moves (flicker, sway, how far it streams out behind) | `updateHair()` in `js/styles.js` |
| What each kind of enemy looks like (bucket, helm, wings, horns) | `dressDummy()` and the shapes above it in `js/skins.js` |
| The size of each piece of armour | The numbers in `attachOutfit()` in `js/styles.js` |
| The suit's glowing cracks, and the coat's ragged hem | `drawCracks()`, `armourGlow()`, `coatCloth()` and `coatGlow()` in `js/styles.js` |
| The suit's pieces (hood, armour, coat, cape) and where they sit on the body | `attachOutfit()` in `js/styles.js` |
| How the water and the fire look | The textures and `addSource()` in `js/styles.js` |
| The storm: the cloud, how often lightning strikes, how a bolt is drawn | `addSource()`, `updateStorm()`, `strike()` and `makeBolt()` in `js/styles.js` |
| How a style's slash is painted (foam, tongues of fire) | The `edge` part of `paintCrescent()` and `TRAIL_PAINTS` in `js/fx.js` |
| The trial that unlocks a style | The entries with `style:` in `CLASSES.blade.trials` in `js/classes/blade.js` |
| How Master Sen looks (build, hair, eyes, poses) | The `master` block and the `POSE_...` tables at the top of `js/master.js` |
| A sword or dagger slash: how long it hangs in the air | `TRAIL_LIFE` in `js/fx.js`. The slash is built from the blade's real positions by `updateTrail()`, so its path is the sword's path |
| A slash's width and how far it reaches past the blade | `WEAPON_REACH` in `js/anim.js` |
| When a slash is drawn (which moves, how fast the blade must be moving) | `TRAIL_STATES` and `SLASH_SPEED` in `js/anim.js` |
| How a slash is painted (shape, ink outline, foam) | `paintCrescent()` and the `trailOuter` / `trailInner` shape functions in `js/fx.js` |
| The Monk's punch and kick arcs (ready-made shapes, since fists have no blade) | The `arcs` part of `js/fx.js`, called from `attackVfx()` in `js/player.js` |
| How snappy or bouncy the character's movement is | `SPRING_ACTION` and `SPRING_CALM` in `js/anim.js` |
| Breathing, leaning into turns, the landing dip | The idle block and the "weight" block in `animatePlayer()` in `js/anim.js` |
| The Cyclone whirlpool and the Meteor Slam wave | `spawnSwirl()` in `js/fx.js`, called from `bmCyclone()` and `groundImpact()` |
| The Blademaster's stance, run and sword swings | The `id === 'blade'` blocks and `case 'slash'` in `animatePlayer()` in `js/anim.js` |
| How much things glow (impact flashes, the halo on the weapon, afterimages) | `spawnGlow()` and the effect pools in `js/fx.js`; `bladeGlow` in `js/player.js` |
| The outline light on characters | `addRim()` in `js/stickman.js` |
| What a dash looks like under a sword style (the smoke, the bolt, the water) | `FORMS` in `js/dashfx.js`: each style's `stream` and `gather` |
| How fast the body turns into the element and comes back, and how small it shrinks | `DISSOLVE_TIME`, `REFORM_TIME` and `SMALLEST` in `js/dashfx.js` |
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
   8. update every dummy, every projectile, the challenge, and the story (`updateQuests()`)
2. `animatePlayer()` (`js/anim.js`): work out the pose. Then `animateMount()` (`js/mounts.js`) if one is being ridden.
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
| `js/skins.js` | What each kind of enemy looks like |
| `js/projectiles.js` | Kunai and javelin |
| `js/player.js` | Player body, collision, taking damage, basic attack, dash, slide |
| `js/mounts.js` | The mount called with X: car, fire horse, lightning lion, war elephant |
| `js/camera.js` | Camera and aiming |
| `js/classes/index.js` | Loads the class files; `setClass()` |
| `js/classes/blade.js`, `ninja.js`, `monk.js`, `lancer.js` | One class each: skill functions and the class table |
| `js/master.js` | Master Sen and the dialog menu |
| `js/challenges.js` | Timed challenges |
| `js/missions.js` | The campaign: the districts of the city, and running a mission through its stages |
| `js/quests.js` | The story: Sen's chain of tasks, their progress, and the gang enemies they bring |
| `js/input.js` | Keyboard, mouse, pause |
| `js/update.js` | One step of the game |
| `js/anim.js` | Player poses |
| `js/hud.js` | On-screen display |
| `js/tuning.js` | The tuning panel shown while paused |
| `js/progress.js` | Skill ranks and the trials that earn them |
| `js/dojo.js` | The training hall: teleporting there, building and clearing each trial's layout |
| `js/styles.js` | Sword styles (Water, Flame, Thunder), the pools, fires and storms they are taken from, and the scene of taking one |
| `js/cutin.js` | The close-up of the eyes that cuts across the screen when a style is taken |
| `js/elements.js` | What each sword style does to the four skills: Flame destroys, Thunder chains and stuns, Water controls and heals |
| `js/dashfx.js` | The elemental dash: under a sword style the player becomes smoke, lightning or water for the dash |
| `js/sky.js` | The dusk sky: gradient dome, sun, stars |
| `js/quality.js` | The Low / High graphics setting |
| `vendor/three.module.js` | The three.js library (not ours; do not edit) |
| `tests/smoke.js`, `tests/smoke.sh` | Automated test that plays every class and skill |
| `tests/drawcost.sh` | Prints draw calls and triangles per frame, to compare before and after a graphics change |
| `tests/poses.js` | Freezes the game mid-move so an animation or effect can be looked at: `?debug=pose:slash0` |
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
| `m2`, `q`, `e`, `r`, `f`, `x` | Skill slots: right mouse, the Q E R F keys, and the mount |
| mount, `mount.cur` | What the player is riding (an entry of `MOUNTS`), or null on foot. Riding is the player state `mounted` |
| `P.seat` | How far the body is drawn above where it stands, for sitting on a mount. 0 the rest of the time |
| `M0`, `M2` | Left and right mouse button, as they appear in `pressed` |
| `tp`, `pose` | Target pose and current pose |
| hitstop | The brief slow motion when a hit lands |
| draw call | One instruction to the graphics card to draw one object. The main measure of how heavy a frame is; shown as Draws with `?debug` |
| tone mapping | Squeezing very bright colours into what a screen can show, so they glow instead of turning flat white |
| additive | A way of drawing where colour is added on top of what is behind, so the object looks like light |
| painted slash | A flat crescent with an ink outline and white foam, in the style of Japanese wave prints. Two layers: body (class colour) and ink |
| chudan | The basic ready stance of Japanese swordsmanship: sword in front, tip at the opponent's eyes. The Blademaster's idle |
| spring (animation) | Each joint is pulled towards its target pose, overshoots slightly and settles, which gives follow-through. `poseVel` holds the joint speeds |
| `bladeAim()` | Works out the wrist angle that points the blade a given way whatever the arm is doing. In `js/anim.js` |
| rim light | Extra brightness on the edges of a character, so its outline shows against a dark background |
| `SKY` | The dusk palette that both the sky and the fog are made from |
| iframes | Seconds during which the player cannot be hit |
| pool | A fixed set of objects reused over and over, never created during play |
| lock-on, `lockTarget` | The dummy nearest the crosshair |
| `lockFire` | A lit fire the crosshair is on. When set, `lockTarget` is null and a Blink Strike goes into the fire |
| `aimHit` | The point on the map under the crosshair |
| sword style, `style` | A temporary change to the sword taken from an object in the world: new slash colour and look plus one extra effect. `style.cur` is the one in use, `style.left` its seconds remaining |
| source | A pool or fire a style is taken from. Still and unlit until its style is unlocked |
| cut-in | The band across the screen showing the eyes change colour. The game stands still while it plays |
| `P.splat` | True while the player is stuck flat against a rock after Master Sen's throw |
| `P.sink` | How far the body is drawn below where it stands, for going under the water. 0 the rest of the time |
| `reach()` | How much further sword attacks reach under the current style (1 = normal) |
| power, `POWERS` | What a sword style changes about the skills. `power()` gives the entry for the style in use, or null with a plain sword |
| zone | A round patch of fire on the ground that sets burning whatever stands in it. Left by Flame's Cyclone and Meteor Slam |
| soaked, `d.soakT` | Seconds an enemy stays soaked (Water's Blink Strike): it takes more damage and a fighter is slowed |
| share | A power's number given as a part of the skill's own (0.6 = 60%), so it grows with the skill's rank |
| dash form, `form.amount` | The player turned into their style's element during a dash. 0 = the body, 1 = all element; it rises fast when a dash starts and falls more slowly after |
| ribbon | A long strip that starts at the player and streams back along the path of their dash. What makes a dash read as being the element. Built by `updateRibbons()` in `js/dashfx.js` |
| particle cloud | Many small soft dots drawn in one draw call. `soft` (drawn normally: smoke, water) and `bright` (added as light: embers, sparks) in `js/dashfx.js` |
| `slashColor()` | The colour sword effects should use: the style's, or the class's when there is none |
| rank | How far a skill has been trained: 0 = locked, 1 to 3 = learned. `rankOf()` in `js/progress.js` |
| trial | A timed test that earns a rank. Runs on top of the challenge system; `chal.st` is its scratch space, `chal.st.n` its progress |
| training hall, `dojo` | The separate room where trials happen, at x = 300. `dojo.inside` is true while the player is there |
| `arena` (on a trial) | The boxes and dummies the hall builds for that trial, in coordinates relative to the hall's centre |
| `area` | The square the player is kept inside: the main arena or the hall. In `js/world.js` |
| `lv` | A skill's numbers at each rank. The current rank's row is copied onto the skill by `applyRanks()` |
| `hitSrc` | Which attack the current hits belong to: `atk`, `q`, `e`, `r`, `f` or `other`. Set with `setHitSrc()` just before dealing damage |
| `P.castN` | Counts skill uses, so a trial can tell one use from the next |
| district, mission | One part of the city held by the Ash Hand, and the fight to take it back. Data in `DISTRICTS` in `js/missions.js`. `mission.cur` is the one running, or null in the yard |
| stage | One step of a mission: a group of enemies to beat, or a place to reach, sometimes against the clock. `mission.stage` is its number, `mission.clock` the seconds spent on it |
| curtain of light, phase wall, `s.phase` | A see-through wall that is solid except to a dashing player. A flag on its entry in `solids` |
| blocker, `d.blocker` | The unseen wall behind a barricade that shuts the way. Removed when the barricade breaks |
| the yard | The main arena, the player's base between missions |
| `d.weak`, `d.tough` | The sword style an enemy is weak to, and what every other hit on it is multiplied by |
| `d.zone` | The square a gang member is kept inside: the yard, or its district |
| `d.ramOnly`, `d.fixed`, `d.look` | A barricade: only a mount can damage it, it never moves, and it is drawn as a wall of planks |
| quest, task | One step of the story, given by Master Sen. Data in `QUESTS` in `js/quests.js` |
| `story` | Where the story stands: `story.done` (finished task ids), `story.cur` (the running one), `story.n` (its count) |
| phase (of the story) | `none` (wrong class), `offer` (Sen has a task), `active` (doing it), `ready` (done, go and tell him), `end` (nothing left). From `questState()` |
| gang, `d.gang` | A story enemy, one of the Ash Hand: a dummy that hunts the player, never heals and stays dead. `d.boss` marks their leader |
| `d.gone` | Set on a beaten gang member once it has finished falling; `updateQuests()` then removes it |
| `d.baseHp` | A dummy's health before the tuning panel's multiplier |
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

### Add a sword style

Water, Flame and Thunder in `js/styles.js` are the worked examples.

1. Add it to `STYLES`: id, name, colour, `paint`, `reach`, the numbers for its effect, and the `how` and `perk` lines.
2. Give it its effect in `onStyleHit()` (runs for every hit that lands), or read `style.cur` wherever else it should matter.
3. Give it a look: add an `edge` kind to `paintCrescent()` in `js/fx.js` and a matching entry in `TRAIL_PAINTS`.
4. Give it a source: a new kind in `addSource()`, a way to take it (like `slamSources()`, the lock-on used for fire, or `stormAt()` called from Cyclone) that calls `startTake()`, a line in `sourceHint()`, and one in the arena.
   Give its suit a colour: `glow`, `core`, `glowHex`, `eyes` and `spark`, and an entry in `mats` in `attachOutfit()`.
5. Add its trial to the class's `trials` with `style: '<id>'` and `arena.sources`. Passing it unlocks the style.
   Give it a job: an entry in `POWERS` in `js/elements.js` (a role, a name for each skill, its numbers), and a branch for it in each of the hook functions there (`blinkPower()`, `spinTick()`, `slamPower()`, `slamLanded()`, `risingPower()`, `risingHit()`). Give its dash a look: an entry in `FORMS` in `js/dashfx.js`.
6. Add checks to the style part of `tests/smoke.js`, and a column to Part 2 of `docs/ABILITIES.md`.

### Add a district, or a stage to one

The docks in `DISTRICTS` in `js/missions.js` are the worked example. Every stage should lean on a different tool.

1. A district that already has a card on the map only needs its data: `area` (pick a centre at least 250 from every other area, so fog hides them from each other), `floor`, `start`, `props`, `sources` and `stages`.
2. A stage is `goal` and `hint` plus one of: `spawn` (enemies; cleared when all are down) or `point` (a place to stand on; put it somewhere only the hook reaches). With both, the enemies are only in the way. Add `time` for a limit and `rescue: true` to put the prisoner at the point.
   A district does not have to be a square yard: the Old Market sets `walls: false` and builds a long street out of `props`. To shut a gap, use a curtain (`gates`: only a dash passes) or a `BLOCKADE` (only a mount breaks it).
3. To make a stage about a mount, spawn `BARRICADE`s. To make it about an element, spawn enemies with `weak` set, and make sure the district has that element's source.
4. A new kind of enemy is a new set of options next to `THUG`. Give it a row in Part 4 of `docs/ABILITIES.md`.
5. Look at it: `http://localhost:8000/?debug=mission:<id>`. Add it to `docs/STORY.md` and to the campaign checks in `tests/smoke.js`.

### Add a task to the story

`QUESTS` in `js/quests.js` is the whole story in order; the five tasks of chapter 1 are the worked examples.

1. Add an entry: `id` (never change it afterwards, it is in the save), `chapter`, `name`, `intro` and `outro` (Sen's words), `goal` (a few words, shown on screen) and `need`.
2. Say how it is counted. Either `event: 'ko'` with a `match(ev)` that picks which knockouts count, or a `check` function that returns true once the task is done.
   For a new kind of event, call `questEvent('<name>', { ... })` from wherever it happens.
3. If it brings enemies, list them in `spawn` as `[type, x, y, z, options]`. Use `SCOUT` or `ROOK` as the options, or a new set with `gang: true`. Pick spots on open ground.
4. A new chapter needs a line in `CHAPTERS`.
5. Add a row to `docs/STORY.md` and a check to the story part of `tests/smoke.js`.

### Add a mount

The four in `js/mounts.js` are the worked examples.

1. Add it to `MOUNTS`: name, the `style` that calls it, speed, grip, jump, the ramming numbers, `reach`, `width`, `seat` and `sit`.
2. Write its `build...()` function (copy `buildHorse()`): the model faces +z with its feet at y = 0. Join everything that does not move into one shape with `joined()`; legs and axles are separate pieces so they can move.
3. Add the function to `builders` in `initMounts()`.
4. Look at it: `http://localhost:8000/?debug=pose:mount&style=<style>` (add `&ride=1` to see it moving).
5. Add it to the mount checks in `tests/smoke.js` and to Part 5 of `docs/ABILITIES.md`.

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
   Give it a look in `dressDummy()` in `js/skins.js`, and a row in Part 4 of `docs/ABILITIES.md`.
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
- **Gang members are dummies, but not all dummy rules hold for them.** `respawn()` does nothing to one, they have no home spot, and they are removed from `dummies` after a knockout. Removal happens in `updateQuests()`, never inside the loop that updates dummies.
- **Sen's main menu starts with the story card.** The number keys follow the cards, so adding or moving a card changes which number does what (the smoke test presses them).
- **A mission is not a challenge.** It does not use `chal`: it has its own state (`mission`) and runs while the player is in its district. Master Sen stays in the yard, so no trial, class change or other mission can start during one.
- **Being defeated in a mission is handled before the respawn.** `playerDefeated()` calls `failMission()` first, which puts `SPAWN` and the area back to the yard, so the respawn that follows lands there.
- **Beaten mission enemies stay in `mission.spawned`,** marked dead, so the stage can tell they are down. Only `despawnAll()` empties the list.
- **A curtain of light is solid to everything except a dashing player.** Enemies, mounts and walking players are stopped by it. It is left out of ray checks on purpose, so the camera, the crosshair and the hook ignore it. Never pass one to `removeBox()`.
- **A `BLOCKADE` has to stand in a gap no wider than 6,** which is the width of its unseen wall; anything wider can be walked round.
- **District ids are in the save,** like task ids.
- **Task ids are in the save.** Renaming one in `QUESTS` makes saved games forget it.
- **`SPAWN` moves.** It is where the player respawns: the arena start, the hall's arrival point, or a trial's start. `js/dojo.js` changes it.
- **Glow needs `toneMapped: false`.** Any material meant to look like light (effects, the weapon, warning marks) must set it, or tone mapping dulls it. Lit objects must not set it.
- **`lam()` needs baked shading.** It expects a `color` attribute on the shape, as `boxGeo` and every rock from `rockGeo()` have; on any other shape the result is black.
- **Rocks are drawn chipped but collide as plain boxes.** A rock's top is exactly flat and at full height, and its sides only ever go inwards. Keep it that way, or the player will stand on air or sink into stone.
- **Low quality has a draw budget.** The smoke test fails if one frame on Low needs more than 410 draw calls. (It is measured at the starting zoom, which is fully zoomed out.)
- **Leaving the `mounted` state is what removes the mount.** `setState()` hides it whenever the player goes into any other state, so nothing else has to remember to. Do not hide the model by hand.
- **Mount models are built in `initMounts()`, not at the top of the file,** because they use `joined()` from `js/skins.js`, which is not a base file.
- **Enemy shapes cost draw calls.** Each shape on each enemy is one more. In `js/skins.js`, shapes that always go together are joined into one (`joined()`); do the same for new ones. Put expensive extras behind High in `js/quality.js`.
- **A blade's slash must come from the blade.** Do not add a ready-made slash shape for a weapon attack: it will not line up with the swing. Change the pose in `js/anim.js` and the slash follows by itself.
- **Poses are targets, not positions.** `animatePlayer()` sets where each joint should go (`tp`); springs move the real pose there. To make something happen instantly, set `pose` as well as `tp`.
- **The player's size belongs to the dash form.** `animatePlayer()` sets `player.root.scale` from `formScale()` every frame, so setting that scale anywhere else has no effect.
- **Particle clouds have a fixed size.** Each holds `CLOUD_SIZE` particles and reuses the oldest. Emitting far more per second than that lasts makes the trail cut off early.
- **A skill asks the element, the element never runs the skill.** The four skills stay in `js/classes/blade.js` and `js/update.js` and call small functions in `js/elements.js` for what the style changes. With a plain sword every one of those returns "no change", so the skills behave exactly as before.
- **Read the style before a slam lands.** Landing in a pool changes the style during the blast, so the slam case in `update()` takes `power()` first and passes it to `slamLanded()`.
- **Fire on the ground outlives the style, not a respawn.** `clearElements()` runs on every respawn (and so at the start of a trial); the style running out does not put fires out.
- **Call `setHitSrc()` for each enemy in a loop.** A hit can set off an element's effect that deals damage of its own and changes the source.
- **Nothing new may come out of a dash once it has ended.** After the dash the ribbons keep waving and fading (that is what keeps the ending alive), and their front end stays on the player, but `recordPath()` adds no more to them. Do not freeze them or pull them in either: that was tried and made the ending feel dead.
- **A dash effect has to be one continuous shape from the player backwards.** Puffs left along the path read as a trail behind the player, not as the player. The lightning's bolt and the ribbons are what make it read as being the element: keep that when changing them.
- **Colours for particles are not what they look like.** They are brightened on the way to the screen: orange needs very little green, dark smoke is almost black.
- **Pools.** Effects and projectiles are never created during play. Use `spawnRing()`, `burst()`, `fireProj()` and friends.
- **`dt` or `rdt`.** Gameplay uses `dt` so it slows down during hitstop. Camera and on-screen display use `rdt`.
- **Only boxes.** Collision assumes every solid is an upright box (however rocky it is drawn). A slope or rotated wall will not collide correctly.
- **A style ends whenever the player respawns.** That covers death, teleports, class changes and the start of a trial (`clearStyle()` is called from `cleanupClassObjects()`), which is what keeps styles from being carried into a trial.
- **Use `slashColor()` and `reach()` in sword code,** not `CL.color` and a bare radius, or the effect ignores the style.
- **The menu frees the mouse.** Opening Master Sen's menu releases the mouse so cards can be clicked, which also pauses the game; closing it captures the mouse again. If the browser refuses, the pause screen shows and one click resumes.
- **New area attacks should call `strikeMaster()`.** Sword swings, `hitArea()`, Cyclone and Rising Slash already do. An attack that loops over dummies by hand will pass straight through Master Sen unless it calls it too.
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
