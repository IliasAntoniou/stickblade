# Abilities and sword styles

A running list of everything a character can do, kept up to date whenever something is added or changed. Numbers are the defaults in the code. `python tests/check_docs.py` fails if a skill or style exists in the game but is missing from this file.

- **Part 1** is abilities: what every class has, and what each rank changes.
- **Part 2** is sword styles: temporary changes taken from the world.

Damage numbers vary by about 10% either way on each hit. Distances are in world units; a character is about 1.9 tall.

---

# Part 1: Abilities

## Everyone

| Key | Ability | What it does |
|---|---|---|
| Space | Jump | Jump, one more jump in the air, and a jump off any wall you are touching |
| Shift | Dash | A short burst in the direction you are moving, or where you are looking if you are standing still. 2 charges, 1.1 s to regain one. You cannot be hit during it. Jumping out of a dash keeps its speed |
| C | Slide | A speed boost along the ground that fades. Jumping out of it keeps the speed |
| X | Rewind | Go back to where you were about 2 seconds ago. 8 s cooldown |

## Blademaster

Sword and grapple hook. The only class with progression so far: skills are learned and ranked up through trials with Master Sen.

| Key | Ability | What it does | Cooldown |
|---|---|---|---|
| LMB | Slash | Three-hit combo: 12, 14, then an overhead finisher for 24 that knocks back | none |
| RMB | Grapple | Pulls you to the dummy you are locked on, or the wall under the crosshair. Hold to keep pulling, jump to let go | 0.5 s |
| Q | Blink Strike | Teleport behind the locked dummy and strike. With no target, blink 14 forward. With the lock-on ring on a lit fire, blink into it (see Flame) | 4 s |
| E | Cyclone | A spinning dash that hits everything it passes, about 13 times a second | 5 s |
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

A style is taken from a place in the world and lasts 20 seconds. It changes the slash's colour and painted look, puts the character in a suit of dark armour glowing in that element's colour, and adds one effect. The normal moves stay the same.

Rules for all styles:

- One at a time. Taking another replaces it; taking the same one again refills the time.
- It ends on death, on any teleport, on changing class, and at the start and end of any trial.
- The place it comes from does nothing until the style is unlocked by its trial with Master Sen.

| | Water | Flame |
|---|---|---|
| **Taken by** | Meteor Slam into a pool | Aim at a fire until the lock-on ring is on it (within 15), then Blink Strike |
| **Needs first** | Meteor Slam learned | Blink Strike learned |
| **The scene** | You go under the water; a close-up shows your eyes closed, a blue slash sweeps across, and they snap open blazing blue; you burst back out | You stand burning in the flames; the same close-up with an orange slash and orange eyes; you step out |
| **Slash** | Blue, with white foam along the edge | Orange, with tongues of fire along the edge |
| **Suit** | Dark hooded armour split by glowing blue cracks; pale blue eyes under the hood; thin blue wisps flowing along the sword; blue sparks | The same armour split by glowing lava-orange cracks; gold eyes under the hood; thin wisps of fire flowing along the sword; orange sparks |
| **Effect on every hit** | Takes 0.12 s off all your cooldowns | Sets the target burning: 14 damage a second for 4 s |
| **Other change** | Sword attacks, Cyclone and Meteor Slam reach 20% further | None |
| **Trial to unlock** | Take Water, then hit 4 dummies with one sword swing (60 s) | Take Flame, then have 3 dummies burning at once (60 s) |
| **Where it is** | Left of the start in the arena | Right of the start in the arena |
| **Before it is unlocked** | The pool is still and grey | The fire is out |

---

The suit is the same for every style: a tall, narrow assassin's hood with a peak that tips forward, the face in shadow and two glowing eyes, a chest plate, spiked shoulder guards, gauntlets, greaves, a long ragged coat open at the front, and a torn cape. Only what glows changes.

---

# Part 3: Master Sen

He cannot be hurt, but he reacts to being hit. Sword swings, blasts, Cyclone and Rising Slash count; thrown weapons do not.

| What you do | What he does |
|---|---|
| Hit him once | He points at you, throws you back, and his eyes burn brighter for 10 seconds |
| Hit him again within those 10 seconds | He catches you by the neck, holds you off the ground for a moment, leaps into the air with you, and slams you into the ground from the top of the jump. It takes 60% of your full health, but never your last point |
| Hit him again after the 10 seconds | Another warning |

Hits less than 0.6 seconds apart count as one. For about a second and a half after a slam he cannot be provoked again.

---

## When adding something

- **A new ability or a changed number:** update the class's table here (and its rank and trial rows if it has them).
- **A new style:** add a column to the table in Part 2.
- **A new class:** add a section in Part 1.

Where the numbers live in the code: each class's table at the bottom of its file in `js/classes/`, and `STYLES` in `js/styles.js`.
