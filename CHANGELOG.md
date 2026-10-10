# Changelog

Newest first. One entry per merged feature: what changed, where, how to check it, and the git tag to go back to.

## v0.13-campaign: take back the city (the docks)

- **The purpose:** the city has five districts, all held by the Ash Hand, each with a keeper. The game is taking them back one by one. Sen's menu has a new card, "The city", with a map of all five: which are free, which are held, which are still locked.
- **Missions:** a district is a mission in its own walled area, fought in stages with a boss at the end. Fall and the mission is lost; P gives up. Clearing a stage gives back 35% of your health, and health returns on its own only a quarter as fast as in the yard. Winning frees the district for good and adds 20 to your maximum health.
- **The Docks** (the first district, open once chapter 1 is done). Five stages, each built around a different tool: break through the gate (runners, weak to Thunder); hook up the crane to cut the alarm (only the grappling hook reaches it); ram three barricades that only a mount can break, guarded by ironclads (weak to Flame); clear a swarm of dock rats (weak to Water); defeat Marrow, who calls for help at half health.
- **Weaknesses:** some gang members are weak to one element, shown by the colour of their headband. Under that sword style they take 60% more; from anything else only 60%.
- **Story:** chapter 2 has one task, to free the docks. The other four districts are on the map with their keepers' names, not built yet.
- **Menu numbers moved again:** "The city" is card 2 in Sen's menu, so changing class is 3 and training is 4.
- **Where:** new `js/missions.js` (the campaign is data in `DISTRICTS`); enemy options in `js/dummies.js` (`weak`, `tough`, `zone`, `speed`, `size`, `ramOnly`, `fixed`, `look`); the barricade and band colours in `js/skins.js`; the map page in `js/master.js`; hooks in `js/update.js`, `js/player.js`, `js/hud.js`, `js/tuning.js`, `js/mounts.js`, `js/quests.js`.
- **Not tuned yet:** every enemy's health and speed, how many come, and how much health you get back. It has only been played by the automated test, so it may be far too hard or too easy.
- **Check:** `bash tests/smoke.sh` (plays the whole mission, a defeat, giving up and a reset). To look at the area: `?debug=mission:docks`.

## v0.12-elements: each element is its own power

- **What:** a sword style no longer just recolours the sword. Each element has a job, and all four skills do something different under it. The skill bar shows each skill's new name in gold while the style is on.
  - **Flame, destruction:** Blink Strike explodes where you arrive. Cyclone leaves a trail of fire. Meteor Slam leaves a burning crater. Rising Slash is a wide pillar of fire that hits all around. Fire on the ground sets burning whatever stands in it.
  - **Thunder, speed and stuns:** Blink Strike jumps on to two more enemies. Cyclone is faster, can be steered, and stuns. Meteor Slam stuns everything it hits. Rising Slash calls a bolt down on each enemy it launched.
  - **Water, control and survival:** Blink Strike soaks the target (it takes more damage and is slowed). Cyclone is a whirlpool that drags enemies in. Meteor Slam is a wide wave that throws enemies back and heals you. Rising Slash is a geyser that holds enemies in the air and heals you.
- **The fire and water dashes are rebuilt so you are the element:** the lightning dash worked because you are one continuous bolt, where fire and water were only puffs left behind. Now fire is long silky ribbons of flame streaming back from you, swaying and fanning out, with a dense swarm of embers at the front (after the smoke dash in inFAMOUS Second Son). Water is a torrent: thick streams running back along your path that roll and sag, with a head of water and spray. After the dash the ribbons keep waving and fade where they are, with their front end staying on you while your body grows back; nothing new is produced once the dash is over. Lightning is unchanged.
- **Unchanged:** with a plain sword every skill is exactly as it was, so the skill trials are not affected.
- **Load:** fire on the ground is up to 16 flat patches, one draw call each while burning. Nothing is added when no element is in use.
- **Where:** new `js/elements.js` (every number is in `POWERS`); the skills call into it from `bmBlink()` and `bmRising()` in `js/classes/blade.js` and from the `cyclone` and `slamDown` cases in `js/update.js`; soaking in `js/dummies.js`; `groundImpact()` in `js/player.js` takes a knockback; the ribbons (`RIBBONS`, `updateRibbons()`) and each form's `stream` in `js/dashfx.js`.
- **Not tuned yet:** every number in `POWERS` is a first guess, and so is how strong the elements are against each other.
- **Check:** `bash tests/smoke.sh` (one check per power, plus that a plain sword leaves no fire and a respawn puts fires out). To look at the dashes: `?debug=pose:dash&style=flame` and `&style=water`.

## v0.11-dash: the dash turns you into your element

- **What:** dashing under a sword style no longer leaves afterimages. You become the element for the length of the dash. Flame: a thick rush of dark smoke with a glow of heat in it and embers flying off. Thunder: a jagged bolt of lightning along your path, with thin branches and sparks. Water: a stream of water that sags and falls, with bright drops flung off and a ring where you land. With no style the dash looks as it did.
- **Smooth in and out:** the body is never swapped for the effect in one frame. It shrinks into the heart of the effect over the first 0.05 s of the dash and grows back out over 0.24 s afterwards, while what is left of the element is drawn back in towards it.
- **Only the look:** distance, speed, charges and not being hit are all unchanged.
- **Load:** all the smoke, water and sparks are two particle clouds, one draw call each, and only while something is in them. A lightning dash adds up to 18 short-lived pieces. Nothing is added when not dashing, so the Low draw budget is unchanged.
- **Where:** new `js/dashfx.js` (`FORMS`, `updateDashForm()`, `formScale()`); `animatePlayer()` in `js/anim.js` draws the body at that size; the `dash` case in `js/update.js` skips the afterimages; `step()` in `js/main.js` runs it.
- **Not tuned yet:** how thick, dark and long-lasting each effect is.
- **Check:** `bash tests/smoke.sh`. To look at a dash frozen partway: `?debug=pose:dash&style=flame`, `&style=thunder`, `&style=water`; add `&frames=14` to stop it while the body is growing back.

## v0.10-mounts: X calls a mount (Rewind is gone), and the camera starts zoomed out

- **Mounts:** X no longer rewinds. It calls something to ride, and X again gets off. With no sword style it is a car; with Flame a fire horse; with Thunder a lightning lion; with Water a war elephant. The mount changes under you if the style changes or runs out. Every class can ride (the other classes always get the car, since only the sword takes styles).
- **Riding:** the movement keys steer and Space jumps. Each mount handles differently: the horse is the fastest, the lion turns tightest and jumps highest, the elephant is slow but hits hardest. Running into enemies hits them and throws them aside. Attacking, a skill, a dash, being hit or being defeated takes you off.
- **Rewind removed:** the X ability, its cooldown and the position history behind it are gone. Slide (C) is unchanged.
- **Camera:** the game now starts fully zoomed out. The mouse wheel still zooms in.
- **Load on Low:** zoomed out, more of the arena is in view: about 380 draw calls where it was 340. The smoke test's draw budget was raised from 375 to 410 on purpose for this. A mount adds about 7 more while it is being ridden.
- **Where:** new `js/mounts.js` (`MOUNTS`, the four `build...()` functions, `updateMounted()`, `animateMount()`); the X key and the `mounted` case in `js/update.js`; `setState()` in `js/player.js` puts the mount away; the riding pose in `animatePlayer()` in `js/anim.js`; the X slot in `js/hud.js`; `CAM_FAR` in `js/camera.js`.
- **Not tuned yet:** every mount's speed, turning, jump and damage is a first guess, and the models are simple shapes.
- **Check:** `bash tests/smoke.sh`. To look: `?debug=pose:mount`, `?debug=pose:mount&style=flame&ride=1`, `&style=thunder`, `&style=water`.

## v0.9-story: the story begins (chapter 1)

- **The story:** Master Sen is an ex-convict who left his gang, the Ash Hand, and is recruiting and training people to bring it down. He hands out tasks one at a time. Talk to him and pick the story card, now the first card in his menu: he says his piece, you take the task, do it, and go back to tell him.
- **Chapter 1, The Recruit:** five tasks in the arena and the training hall. Knock out 3 practice dummies; stand on something at least 12 high; learn a skill in the hall; defeat 4 Ash Hand scouts; defeat Rook, the first boss, and his two men.
- **On screen:** the current task and its count show at the top right. When it is done it says to go back to Sen.
- **Real enemies:** the Ash Hand's fighters hunt you across the whole arena, walk round rocks, never heal, and stay down when beaten. Ash grey with a red headband and mask; Rook is much bigger. If you are defeated they all come back and the task starts over.
- **Rules:** Blademaster only for now (with another class the story is paused). Progress is saved. "Reset progress" in the tuning panel also restarts the story.
- **Menu numbers moved:** the story card is number 1 in Sen's menu, so the other cards are one number higher than before.
- **Where:** new `js/quests.js` (the tasks are data in `QUESTS`) and `docs/STORY.md`; gang behaviour in `js/dummies.js` (the `gang` option, `GANG_SIGHT`, `GANG_SPEED`); their look in `dressDummy()` in `js/skins.js`; `storyCard()` and the story page in `js/master.js`; the task display in `js/hud.js` and `index.html`; small hooks in `js/update.js`, `js/player.js`, `js/tuning.js`, `js/main.js`.
- **Not tuned yet:** the gang's health, speed and numbers, and every line Sen says, are first guesses.
- **Check:** `bash tests/smoke.sh` (walks the whole chapter: the menu, counting, reporting, scouts that hunt and do not heal, a defeat, a class change, the ending and a reset). By hand: talk to Sen, press 1.

## v0.8-world: grass, rocks, element hair, enemy looks, Sen's throw, and the Thunder style

- **Grass:** the arena floor is painted grass, flat on the ground. (A first version also had tufts standing up out of it; those were removed.) The training hall keeps its tiled floor.
- **Rocks:** every block in the world is now drawn as a faceted rock with chipped, uneven sides and rock colours (grey stone, sandstone platforms, mossy stairs), and the outline edges are gone. Collision is unchanged: each rock still behaves as the plain box it was, its top is exactly flat, and its sides only go inwards.
- **Suit:** the same design at a new size, halfway between the original bulky build and a slim one that was tried: chest plate, shoulder guards and spikes, gauntlets, greaves, belt, coat and cape.
- **Hair:** no hood and no hat. A style now gives the character hair made of its element. Flame: a head of fire, tongues of flame standing up and back, each flickering. Water: long hair of running water down the back that sways, streams out behind when you run and lifts when you fall. The face is its normal colour, with two small glowing eyes. (A deep cowl, an assassin's hood and a sun hat were each tried first.)
- **Enemy looks:** each kind of enemy now has shapes that say what it does. Practice dummies wear a bucket and a painted target. Shield ones are guards with a steel helm, shoulder plates and thick limbs. Flying ones have wings that flap. Fighters are horned brutes with spiked shoulders, thick arms and glowing red eyes, and are bigger than the rest.
- **Master Sen's throw:** his punishment for a second hit now takes turns. One time it is the leap and slam (60% of your health); the next the next he winds up and hurls you flat and fast at one of the tall rocks: you smack into its side, hang there spread out for a moment, then drop (40%). In the training hall he throws you at the wall. (A first version lobbed you onto the top of a rock.)
- **Thunder style:** a third sword style. A dark cloud hangs over a scorched circle behind the start, with lightning striking inside it. Use Cyclone in there and you spin with the sword raised while the bolts come down on you, then the eye close-up in yellow. Yellow slash with lightning along it, yellow cracks in the armour, hair of twitching spikes with small arcs between them. Every hit sends 40% of its damage along a bolt to the nearest other enemy within 6, and you run 15% faster. Unlocked by a new trial with Master Sen (needs Cyclone learned): take Thunder, then make lightning jump 6 times in 60 seconds. Until then the cloud is thin and quiet.
- **Where:** `rockGeo()` and `grassTex` in `js/world.js`; the hair and the sizes in `attachOutfit()`, and `updateHair()`, in `js/styles.js`; new `js/skins.js`; the grab section of `js/master.js` (`pickWall()`, `updateGrab()`); for Thunder, `STYLES.thunder`, `chainLightning()`, `updateStorm()` and `stormAt()` in `js/styles.js`, `bmCyclone()` and the `blade-thunder` trial in `js/classes/blade.js`, the `'bolt'` edge in `paintCrescent()` in `js/fx.js`, and the `storm` pose in `js/anim.js`.
- **Load on Low:** about 340 draw calls in the arena, up from 328: the rocks removed about 20 (no outline edges) and the enemy shapes added about 30. The draw budget in the smoke test was raised from 335 to 375 on purpose for this. Triangles went from about 14,400 to about 17,000.
- **Check:** `bash tests/smoke.sh`; `bash tests/drawcost.sh`. To look without playing: `?debug=pose:idle&style=thunder`, `?debug=pose:storm&lit=1`, `?debug=pose:cloud&lit=1&dist=16`, `?debug=pose:splat`.

## v0.7-styles: sword styles from the world, and a new Master Sen

- **What:** The sword can take on a style for 20 seconds. A style recolours and repaints the slash and adds one effect on top of the normal moves.
  - **Water:** Meteor Slam into a pool. You sink under the surface, a close-up of your eyes cuts across the screen, and you burst back out dressed in blue with white wave patterns. Blue slashes with white foam. Sword attacks, Cyclone and Meteor Slam reach 20% further, and every hit takes a little off all cooldowns.
  - **Flame:** aim at a fire until the lock-on ring is on it, then Blink Strike. You stand burning in the flames, the close-up plays, and you step out dressed in dark red with gold flame patterns. Orange slashes with tongues of fire. Every hit sets the target burning for 4 seconds.
  - The bare sword now has a plain painted slash; the foam look belongs to Water.
- **The close-up:** a dark band across the screen. The eyes start closed. A slash of light in the style's colour sweeps across the band like a blade passing, and as it crosses them they snap open: slanted and narrowed under heavy brows, slit pupils, an iris blazing in the new colour, a glow behind them, cracks of energy spreading outwards, and the band shakes as it hits.
- **Fire lock-on:** a lit fire within 15 units takes the lock-on ring like an enemy does (drawn in fire colours), when it is nearer the crosshair than any dummy. The ring is the promise that a Blink Strike will go there.
- **The suit:** taking a style puts the character in dark armour that glows in the style's colour: a long hood that hangs onto the shoulders with a ragged mantle, the face in shadow and two glowing eyes, a chest plate, spiked shoulder guards, gauntlets and greaves split by glowing cracks, a long ragged coat open at the front with veins of light climbing from its torn hem, and a torn cape. Thin wisps of the style's colour flow along the sword's edges towards the tip, and sparks drift off the body. Lava orange for Flame, cold blue for Water. (Two earlier versions, a glowing skin and a patterned robe, did not look powerful enough.)
- **The places:** the pool is real-looking water, dark in the middle with light drifting over it and a stone rim. The fire is a stone-ringed pit with flickering flames and sparks.
- **Unlocking:** the pool is still and grey and the fire is out until its style is unlocked by a trial with Master Sen. The Flame trial (needs Blink Strike) has you take Flame and keep three dummies burning at once. The Water trial (needs Meteor Slam) has you take Water and hit four dummies with one swing, which only Water's reach allows. During its own trial a style can be taken, which is how the trial teaches it.
- **Rules:** one style at a time; taking another replaces it; taking the same one refills the time. A style ends on death, teleport, class change and at the start and end of any trial, so trials are always fought with a plain sword.
- **Screen:** the style's name and time left show above the health bar, and standing near a pool or brazier says how to use it or that it is locked.
- **Master Sen:** he is now half as tall again as the player and heavily built, arms folded, feet planted wide, with wild dark hair and glowing red eyes. His head turns and tilts to keep those eyes on you wherever you go. (He briefly had a hat; it hid the eyes from some angles, so it is gone.)
- **Hitting Master Sen:** the first hit earns a warning: he points at you, you are thrown back, and his eyes burn brighter for 10 seconds. Hit him again inside those 10 seconds and he catches you by the neck, holds you off the ground while you kick, leaps into the air with you, and slams you into the ground from the top of the jump for 60% of your full health (never the last point). Hits less than 0.6 s apart count as one, so a single combo cannot do both. Sword swings, blasts, Cyclone and Rising Slash all count.
- **His menu:** now a proper window. Opening it frees the mouse; each choice is a card with a picture, a title, a description and a status tag (LOCKED, RANK II, MASTERED, your best time...), with his portrait and what he is saying on the left. Click a card or press its number; G, Esc or a click outside closes it.
- **Abilities list:** new `docs/ABILITIES.md` lists every ability of every class, the Blademaster's ranks and trials, and every sword style and what it changes. The docs check fails if a skill or style is missing from it.
- **Where:** new `js/styles.js` and `js/cutin.js`; three painted looks in `js/fx.js` (`TRAIL_PAINTS`); burning in `js/dummies.js`; reach and sources in `js/player.js`; unlocking in `js/progress.js`; the two trials in `js/classes/blade.js`; Master Sen's build in `js/master.js`; the timer and hints in `js/hud.js` and `index.html`.
- **Not tuned yet:** burn damage, the reach bonus and both trials are first guesses.
- **Check:** `bash tests/smoke.sh` (plays both style trials including the scenes, checks sources are dead while locked, that a sword swing no longer takes Flame, that the ring only takes a fire that is lit, aimed at and in reach, that the outfit goes on and comes off, burning ticks and stops, the 20 second limit, and that respawns and trials clear a style). To look at a style: `http://localhost:8000/?debug=pose:slash2&style=flame`; the scenes: `?debug=pose:ignite&lit=1` and `?debug=pose:submerge&lit=1`; the close-up: `?debug=pose:idle&cutin=water`.

## v0.6-breathing: painted slashes and a swordsman's movement

- **What:** Much less glow. Sword attacks now look like the water techniques in Demon Slayer: a flat painted wave in the class colour with a dark ink outline and white foam along its leading edge. For swords and daggers the slash is drawn from the blade's own positions, so it follows the swing exactly and ends when the swing ends (an earlier version placed a ready-made crescent in front of the character, which did not line up with the sword). The Monk's fists keep ready-made arcs. Cyclone is a spinning whirlpool around the player, and Meteor Slam sends a painted wave rolling out from the landing. The weapon halo, impact flashes, rings and afterimages were all turned down.
- **Flow (all classes):** every joint now moves on a spring, so motion overshoots slightly and settles instead of sliding to a stop. Standing still has breathing and a slow weight shift. Running twists the shoulders against the hips. The body leans into turns and into speeding up, sinks into the knees on landing and stretches on take-off, and the pose in the air follows how fast you are rising or falling. A sword cut coils back for an instant, whips through, and keeps drifting afterwards so it is never held frozen.
- **Movement:** the Blademaster now stands in a proper ready stance (sword in both hands in front, right foot forward), runs with the sword trailing low behind him, cuts with his whole body (hips and chest turn through the swing, deep lunge, long follow-through), and his finisher comes from high overhead down into a low crouch. The other classes get the painted slashes and trails but keep their own movement.
- **How it was chosen:** the anime builds these effects as flat 2D drawings inspired by Hokusai's wave prints, not as glowing light, so the effects here are painted textures with outlines. Game sword trails are normally a ribbon or curved strip with a picture running along it, which is what these are. A first version animated the slashes in visible steps like hand-drawn frames; in play that read as lag, so they are smooth now. For the animation: the standard ready stance is chudan, and since a game swing has no time for a wind-up, the weight has to come from the follow-through and from the hips leading the cut.
- **Where:** `paintCrescent()`, the slash arcs, `spawnSwirl()` and `updateTrail()` in `js/fx.js`; stance, run and swings in `js/anim.js`; small calls in `js/classes/blade.js`, `js/player.js`, `js/update.js`. New `tests/poses.js`.
- **Load:** a slash is two flat pieces while it is on screen, the trail two more while swinging. Nothing is added when idle, so the Low draw budget is unchanged.
- **Check:** `bash tests/smoke.sh`; to look at a move frozen in place open `http://localhost:8000/?debug=pose:slash0` (also `idle`, `run`, `slash1`, `slash2`, `cyclone`, `slam`, `rising`).

## v0.5-look: dusk look with glow, Low / High graphics

- **What:** The game now takes place at dusk. A gradient sky with a low sun and stars, warm sunlight against cool shadow, tiled floors, boxes that darken toward the base, a pale player with a glowing weapon, an outline light on every character, and effects (slash arcs, rings, sparks, afterimages) that glow. Impacts and slashes flash a soft halo. The training hall has its own warm wood palette. On-screen text switched to light colours.
- **Graphics setting:** the pause screen has Graphics: Low or High, remembered between sessions. Low is the default and costs the same as before. High adds real shadows from the sun and a sharper picture, for stronger machines.
- **Load on Low:** one frame in the arena went from 319 to 322 draw calls and from about 13,000 to about 14,200 triangles (the sky dome); the hall from 180 to 184. Real frame rate has to be read on a real machine: the FPS counter is top left.
- **Where:** new `js/sky.js` and `js/quality.js`; lighting, palette and tone mapping in `js/core.js`; box shading, colours and floors in `js/world.js`; glow in `js/fx.js`; `addRim()` and `castShadows()` in `js/stickman.js`; character colours in `player.js`, `dummies.js`, `master.js`; text colours in `index.html`. New `tests/drawcost.sh`.
- **Check:** `bash tests/smoke.sh` (now switches quality both ways and fails if Low goes over its draw budget); `bash tests/drawcost.sh` prints the cost of a frame; `?debug` shows Draws and Tris top left; `?debug&quality=high` previews High.

## v0.4-blademaster: skills are earned (Blademaster only)

- **What:** The Blademaster now starts with the basic attack, Grapple and Rising Slash. Blink Strike, Cyclone and Meteor Slam are locked and each is learned by passing a trial from Master Sen ("Train my skills"). Every skill then has rank II and rank III, each earned by a harder trial that has to be done with that skill. Rank II gives better numbers; rank III changes how the skill works (Blink Strike: a knockout gives it straight back; Cyclone: lasts longer; Meteor Slam: stuns fighters; Rising Slash: hits all around). The skill bar shows LOCKED or one diamond per rank. The other three classes are unchanged.
- **Training hall:** "Train my skills" makes Master Sen teleport you both to a separate walled hall. There you talk to him to pick a trial or to return. When a trial starts the hall builds that trial's own layout (platforms, pillars) and spawns its own enemies; when it ends, everything is cleared. Every trial now has a purpose-built setup: flying dummies for Blink Strike, a fighter to interrupt, a line of dummies for Cyclone, a platform to dive from for Meteor Slam, fighters that must be caught in the blast, and a fighter to juggle for Rising Slash III.
- **No back doors:** trials are the only way to gain a rank. A learning trial lends the skill only while it runs. Trials that test one skill make dummies immune to everything else. Ranks must be earned in order. Trials refuse to start, and fail, if any tuning value is changed.
- **Testing tools:** the tuning panel has "Unlock all skills" and "Reset progress". They skip the trials on purpose, for trying things out.
- **Where:** new `js/progress.js`; ranks, perks and all eleven trials are data in `js/classes/blade.js`; new `js/dojo.js` (the hall); each trial's layout is its `arena` in `js/classes/blade.js`; dummies and boxes can now be added and removed while playing (`spawnDummy`, `removeDummy`, `removeBox`); hooks in `dummies.js` (hit reporting), `update.js` (locked keys, Cyclone and Slam read rank numbers), `player.js`, `challenges.js`, `master.js`, `hud.js`, `tuning.js`. New `serve.py`, used by `play.bat`, so the browser never runs stale files.
- **Not tuned yet:** every trial's time limit and goal is a first guess. They are meant to be adjusted after playing.
- **Check:** `bash tests/smoke.sh` (it now starts from a fresh save, checks locked skills, teleports to the hall and back, builds and clears every trial's layout, plays the Cyclone and Slam trials for real, walks the whole route through Master Sen, and checks every back door listed above). To look at one layout: `http://localhost:8000/?debug=hall:blade-r1`.

## v0.3-tuning: in-game tuning panel

- **What:** Pause with Tab or Esc and a panel on the right lets you change numbers with sliders: run speed, jump, gravity, air jumps, dash, player health and regen, damage taken, a cannot-be-hit switch, cooldowns, damage dealt, knockback, hit freeze, screen shake, dummy health, whether dummies heal, whether fighters attack, and game speed. The last section changes the current class only: its run speed, air jumps, the damage of each combo hit and each skill's cooldown. Changed rows turn yellow. Each row has its own reset button, and "Reset all" puts everything back. "Copy changes" copies the changed numbers as text. Changes are remembered between sessions.
- **Where:** new `js/tuning.js`; the numbers are in `TUNE_DEFAULTS` in `js/state.js` (the old `JUMP`, `GRAV`, `DASH_*` constants moved there); small hooks in `update.js`, `player.js`, `dummies.js`, `fx.js`, `hud.js`, `main.js`, `input.js`, `classes/index.js`; panel styles in `index.html`.
- **Not covered yet:** the damage of individual skills (for example Meteor Slam) is still fixed in code. "Damage dealt x" scales them all together.
- **Check:** `bash tests/smoke.sh` (it now moves sliders and checks that jump, gravity, damage, health and the rest change the game and reset correctly).

## v0.2-docs: code map, comments, changelog

- **What:** No gameplay change. Every code file now starts with a header saying what it is for, and functions and tuning numbers have comments. Added a code map and this changelog. Added rules for how code is written and checked.
- **Where:** comments in every file under `js/`; new `docs/CODE_MAP.md`, `CHANGELOG.md`, `tests/check_docs.py`; rules in `CLAUDE.md`.
- **Check:** `bash tests/smoke.sh` prints `SMOKE PASS`; `python tests/check_docs.py` prints `DOCS OK`.

## v0.1-modules: split into files, launcher

- **What:** No gameplay change. The single 2077-line `index.html` became 22 files under `js/`, one per topic and one per class. three.js is now a local file, so the game works offline. Added `play.bat` and a Desktop shortcut. Added `?debug` and an automated smoke test.
- **Where:** everything under `js/`, `vendor/`, `tests/`; `index.html` keeps only the page and CSS.
- **Check:** `bash tests/smoke.sh`; play each class.
- **Note:** double-clicking `index.html` no longer works. Use `play.bat` or `python -m http.server 8000`.

## v0.0-single-file: the original

- **What:** The whole game in one `index.html`: four classes, four dummy types, Master Sen, four challenges, saved class and best times.
- **Check:** this version loads three.js from the internet and opens by double-click.
