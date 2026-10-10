# Abilities and sword styles

A running list of everything a character can do, kept up to date whenever something is added or changed. Numbers are the defaults in the code. `python tests/check_docs.py` fails if a skill or style exists in the game but is missing from this file.

- **Part 1** is abilities: what every class has, and what each rank changes.
- **Part 2** is sword styles: temporary changes taken from the world.
- **Part 3** is Master Sen: what he does when you hit him.
- **Part 4** is the enemies: what each kind is and how it looks.
- **Part 5** is the mounts: what X calls, and what each one is like.

Damage numbers vary by about 10% either way on each hit. Distances are in world units; a character is about 1.9 tall.

---

# Part 1: Abilities

## Everyone

| Key | Ability | What it does |
|---|---|---|
| Space | Jump | Jump, one more jump in the air, and a jump off any wall you are touching |
| Shift | Dash | A short burst in the direction you are moving, or where you are looking if you are standing still. 2 charges, 1.1 s to regain one. You cannot be hit during it. Jumping out of a dash keeps its speed |
| C | Slide | A speed boost along the ground that fades. Jumping out of it keeps the speed |
| X | Mount | Call something to ride; X again gets off. Much faster than running, and it knocks aside what it runs into. See Part 5 |

## Blademaster

Sword and grapple hook. The only class with progression so far: skills are learned and ranked up through trials with Master Sen.

| Key | Ability | What it does | Cooldown |
|---|---|---|---|
| LMB | Slash | Three-hit combo: 12, 14, then an overhead finisher for 24 that knocks back | none |
| RMB | Grapple | Pulls you to the dummy you are locked on, or the wall under the crosshair. Hold to keep pulling, jump to let go | 0.5 s |
| Q | Blink Strike | Teleport behind the locked dummy and strike. With no target, blink 14 forward. With the lock-on ring on a lit fire, blink into it (see Flame) | 4 s |
| E | Cyclone | A spinning dash that hits everything it passes, about 13 times a second. Used inside a storm it takes Thunder | 5 s |
| R | Meteor Slam | A hop, then a dive straight down and a blast around the landing. Landing in a pool takes Water | 6 s |
| F | Rising Slash | An uppercut that launches dummies into the air, and you with them | 3 s |

### Ranks

Grapple has no ranks. Rising Slash is known from the start; the other three start locked.

| Ability | Rank I | Rank II | Rank III |
|---|---|---|---|
| Blink Strike | 34 damage, 4 s cooldown | 44 damage, 3.5 s cooldown | A knockout gives the skill straight back |
| Cyclone | 8 per hit, reach 2.9, lasts 0.45 s | 10 per hit, reach 3.3 | Lasts 0.7 s, so it travels further and hits more |
| Meteor Slam | 55 damage, blast radius 7.5 | 70 damage, radius 9 | The blast stuns fighters for 2 s |
| Rising Slash | 20 damage, 3 s cooldown | 28 damage, 2.5 s cooldown | Wider (4.4), and hits all around you |

### Trials

| Ability | To learn | For rank II | For rank III |
|---|---|---|---|
| Blink Strike | Land it on all 3 flying dummies (60 s) | Interrupt a fighter's attack with it, twice (120 s) | Land it on all 4 flying dummies (25 s) |
| Cyclone | Hit 3 dummies with one spin (45 s) | Deal 600 damage with it (30 s) | Deal 800 damage with it, with a shield dummy in the line (30 s) |
| Meteor Slam | Start a slam 5 high and hit 3 dummies (75 s) | Catch 3 dummies and a fighter in one blast (90 s) | Catch 3 dummies and two fighters in one blast (120 s) |
| Rising Slash | Known from the start | Launch a dummy, then 6 more hits before it lands (90 s) | Launch a fighter, then 8 more hits before it lands (120 s) |

## Shadow Ninja

Daggers. Runs faster than the others. Everything unlocked.

| Key | Ability | What it does | Cooldown |
|---|---|---|---|
| LMB | Daggers | Four-hit combo: 7, 7, 8, then 16. Hold the button to throw kunai (5 each) | none |
| RMB | Wall Run | Hold while touching a wall in the air to run along it. Look up to climb | none |
| Q | Shadow Clone | Leave a clone for 7 s. Press again to swap places with it and blast for 22 | 5 s |
| E | Kunai Mark | Throw a kunai that sticks (10). Press again to teleport to it; if it is stuck in a dummy, strike for 26 | 4 s |
| R | Smoke Vanish | Vanish for 3.5 s: you run faster, fighters lose you, and your next hit does triple damage | 9 s |
| F | Chain Pull | Yank the locked dummy to you and stun it | 3 s |

## Monk

Bare fists. Has two air jumps. Everything unlocked.

| Key | Ability | What it does | Cooldown |
|---|---|---|---|
| LMB | Punches | Five-hit combo: 6, 6, 7, 7, then a kick for 18 | none |
| RMB | Block / Parry | Hold to take only a fifth of the damage, moving slowly. Start blocking within 0.3 s of a hit landing and you parry: you appear behind the attacker, stun it and hit for 25 | none |
| Q | Dragon Kick | A flying kick where you are looking, 22 damage. You cannot be hit during it | 4 s |
| E | Air Juggle | Lifts nearby dummies and yourself into the air and holds everyone there for 2.4 s | 7 s |
| R | Charged Palm | Hold to charge for up to 1.2 s, let go to strike: 18 to 80 damage with a huge knockback | 6 s |
| F | Hundred Kicks | One second of rapid kicks, 4 damage each | 6 s |

## Lancer

Long spear. Everything unlocked.

| Key | Ability | What it does | Cooldown |
|---|---|---|---|
| LMB | Thrust | Three-hit combo with long reach: 13, 13, then 26 | none |
| RMB | Pole Vault | A very high jump. Only from the ground | 2.5 s |
| Q | Javelin | Throw the spear (25). Press again to teleport to it and blast for 30 | 5 s |
| E | Piercing Charge | Run forward for half a second pushing dummies along, then launch them | 6 s |
| R | Dragoon Dive | Leap up, then dive onto the crosshair and blast for 48 | 7 s |
| F | Sweep | A spin that hits and launches everything around you, 16 damage | 4 s |

---

# Part 2: Sword styles

A style is taken from a place in the world and lasts 20 seconds. It changes the slash's colour and painted look, puts the character in a suit of dark armour glowing in that element's colour, adds an effect to every hit, and changes what all four skills do. Each element has a job:

- **Flame is destruction.** The most damage, spread over an area and over time. It leaves fire behind that keeps burning. Best against groups.
- **Thunder is speed and stuns.** It jumps from enemy to enemy and freezes them for a moment. Best for shutting down dangerous enemies.
- **Water is control and survival.** It drags enemies in, shoves them away, weakens them and heals you. Best when you are surrounded or hurt.

Under any style the dash (Shift) turns you into its element for as long as it lasts. Your body shrinks into the heart of the effect as the dash starts and grows back out of it over about a quarter of a second afterwards, with the last of the element drawn back in. Only the look changes: the dash goes as far and as fast as ever, and you still cannot be hit during it.

Rules for all styles:

- One at a time. Taking another replaces it; taking the same one again refills the time.
- It ends on death, on any teleport, on changing class, and at the start and end of any trial.
- The place it comes from does nothing until the style is unlocked by its trial with Master Sen.

| | Water | Flame | Thunder |
|---|---|---|---|
| **Taken by** | Meteor Slam into a pool | Aim at a fire until the lock-on ring is on it (within 15), then Blink Strike | Use Cyclone while standing inside a storm |
| **Needs first** | Meteor Slam learned | Blink Strike learned | Cyclone learned |
| **The scene** | You go under the water; a close-up shows your eyes closed, a blue slash sweeps across, and they snap open blazing blue; you burst back out | You stand burning in the flames; the same close-up with an orange slash and orange eyes; you step out | You spin in the middle of the storm with the sword held up while bolt after bolt comes down on you; the same close-up with a yellow slash and yellow eyes |
| **Slash** | Blue, with white foam along the edge | Orange, with tongues of fire along the edge | Yellow, with a jagged line of lightning along the edge and another through the middle |
| **Hair** | Long hair of running water down the back. It sways, streams out behind when you run and lifts when you fall | A head of fire: tongues of flame standing up and back, each flickering | Sharp yellow spikes standing straight out from the head, twitching, with small white arcs jumping between them |
| **Dash** | You become a torrent: thick streams of water run back from you along your path, rolling like a wave and sagging as they age, with a head of water at the front, spray thrown up off it, and a ring where you land | You become fire: long silky ribbons of flame stream back from you in a tight bundle, swaying, pale gold at the front and deep red at the tail, with a dense swarm of embers travelling at the head | You become lightning: a jagged bolt along your path with thin branches and sparks |
| **Suit** | Dark armour split by glowing blue cracks; pale blue eyes; thin blue wisps flowing along the sword; blue sparks | The same armour split by glowing lava-orange cracks; gold eyes; thin wisps of fire flowing along the sword; orange sparks | The same armour split by glowing yellow cracks; pale yellow eyes; thin yellow wisps along the sword; yellow sparks |
| **Effect on every hit** | Takes 0.12 s off all your cooldowns | Sets the target burning: 14 damage a second for 4 s | 40% of the damage jumps along a bolt to the nearest other enemy within 6. A jump does not jump again |
| **Other change** | Sword attacks, Cyclone and Meteor Slam reach 20% further | None | You run 15% faster |
| **Trial to unlock** | Take Water, then hit 4 dummies with one sword swing (60 s) | Take Flame, then have 3 dummies burning at once (60 s) | Take Thunder, then make lightning jump between enemies 6 times (60 s) |
| **Where it is** | Left of the start in the arena | Right of the start in the arena | Behind the start in the arena, under the dark cloud |
| **Before it is unlocked** | The pool is still and grey | The fire is out | A thin grey cloud over a scorched circle, and no lightning |

### What each skill becomes

While a style is on, the skill bar shows the skill's new name in gold. Numbers given as a percentage are of the skill's own number, so they grow with its rank.

| Skill | Flame | Thunder | Water |
|---|---|---|---|
| **Blink Strike** | **Fire Burst.** An explosion where you arrive: radius 4.2, 60% of the strike's damage, and everything it reaches is set burning | **Chain Blink.** After the first target you jump on to up to 2 more (each within 10 of the last), hitting each for 70% and stunning it for 0.6 s. You end up behind the last one | **Drenching Strike.** The target is soaked for 5 s: it takes 30% more damage from everything, and a brute moves and readies its attacks at half speed |
| **Cyclone** | **Fire Tornado.** Leaves a trail of fire along its path. Each patch is 1.7 wide, burns for 4 s and sets whatever stands in it burning (14 a second) | **Storm Spin.** Faster (30, where the plain one is 22), can be steered with the movement keys while it spins, and every hit stuns for 0.3 s | **Whirlpool.** Drags in enemies on the ground from 2.4 times the spin's own reach |
| **Meteor Slam** | **Burning Crater.** Leaves a crater of fire 60% the size of the blast for 6 s; whatever stands in it burns (24 a second) | **Thunderclap.** A bolt comes down on everything in the blast and stuns it for 1.5 s | **Tidal Slam.** A wave: the blast is 30% wider, throws enemies far further (knockback 24, where the plain one is 9), and heals you 6 for each enemy hit, up to 30 |
| **Rising Slash** | **Pillar of Fire.** 40% wider, 50% more damage, and hits all around you | **Skybolt.** 0.4 s later a bolt strikes each enemy you launched for 30 more and holds it in the air for 0.8 s | **Geyser.** 30% wider, hits all around you, holds the enemies it lifts in the air for 1.2 s, and heals you 4 for each |

Fire left on the ground stays when the style runs out, and is put out when you respawn. Grapple and the basic sword combo are not changed by the element (the combo still gets the style's effect on every hit).

---

The suit is the same for every style: small glowing eyes, a chest plate, spiked shoulder guards, gauntlets, greaves, a long ragged coat open at the front, and a torn cape. Only what glows changes.

---

# Part 3: Master Sen

He cannot be hurt, but he reacts to being hit. Sword swings, blasts, Cyclone and Rising Slash count; thrown weapons do not.

| What you do | What he does |
|---|---|
| Hit him once | He points at you, throws you back, and his eyes burn brighter for 10 seconds |
| Hit him again within those 10 seconds | He catches you by the neck and holds you off the ground. Then one of two things, taking turns: **the slam** (he leaps into the air with you and slams you into the ground from the top of the jump, for 60% of your full health) or **the throw** (he winds up and hurls you flat and fast at one of the tall rocks; you smack into its side, hang there spread out for a moment, then drop, for 40%). Neither ever takes your last point. In the training hall he throws you at the wall. Where there is nothing tall to throw you at, it is always the slam |
| Hit him again after the 10 seconds | Another warning |

Hits less than 0.6 seconds apart count as one. For about a second and a half after a slam he cannot be provoked again.

---

# Part 4: Enemies

All of them are the same stick figure underneath. Colour and shape say what each one does.

| Kind | Colour | Looks like | What it does | Health |
|---|---|---|---|---|
| Practice dummy | Red | A bucket on its head and a painted target on its chest | Stands still, or slides side to side | 600 |
| Guard | Grey | A steel helm with a crest, heavy shoulder plates, thick limbs, a big shield held in front | Turns to face you and blocks every hit from the front. Strike from behind or from above | 700 |
| Winged | Blue | Two flapping wings, a halo, a slight body | Circles in the air | 400 |
| Brute | Purple | Horns, spiked shoulders, thick arms, glowing red eyes; bigger than the rest | Comes after you. Slams the ground around it when you are close, lunges when you are further away. Red marks on the ground warn of both | 900 |
| Ash Hand scout (story only) | Ash grey | A red headband with flying tails, a red mask, glowing red eyes | Fights like a brute, but hunts you across the whole arena at a fast walk, never heals, and stays down when beaten | 240 |
| Rook (story only) | Dark ash | The same headband and mask on a much bigger body with spiked shoulders | The first boss. The same slam and lunge, with far more health | 800 |

---

# Part 5: Mounts

Press X to get on and X again to get off (you hop off keeping your speed). Every class can ride. Which mount comes depends on the sword style in use, and it changes under you if the style changes or runs out.

While riding: the movement keys steer, Space jumps. Running into an enemy at a fair pace hits it and throws it aside (the same enemy at most every 0.7 s), and the sword style's effect applies to that hit. Attacking, using a skill, dashing, being hit or being defeated all take you off the mount.

| Mount | Comes with | Looks like | Top speed | Turning | Jump | Ramming |
|---|---|---|---|---|---|---|
| Car | No style | A low open car with a spoiler; its lights and stripe take your class colour | 21 | Medium | Low (75% of yours) | 8 damage |
| Fire Horse | Flame | A black horse with a mane and tail of fire | 27, the fastest | Medium | A little higher than yours | 10 damage |
| Lightning Lion | Thunder | A lion with a mane of yellow spikes and a spark on its tail | 24 | The tightest | The highest (150% of yours) | 12 damage |
| War Elephant | Water | A grey elephant in glowing blue war gear, with white tusks | 16, the slowest | Wide | Low (60% of yours) | 28 damage, a heavy hit: big knockback, and it interrupts a brute's attack |

For comparison the Blademaster runs at 9.5.

---

## When adding something

- **A new ability or a changed number:** update the class's table here (and its rank and trial rows if it has them).
- **A new style:** add a column to the table in Part 2.
- **A new class:** add a section in Part 1.
- **A new kind of enemy:** add a row to Part 4.
- **A new mount:** add a row to Part 5.

Where the numbers live in the code: each class's table at the bottom of its file in `js/classes/`, and `STYLES` in `js/styles.js`.
