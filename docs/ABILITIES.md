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

Sword and grapple hook. Skills are learned and ranked up through trials with Master Sen. Under a sword style each of its skills becomes something of its own (Part 2).

| Key | Ability | What it does | Cooldown |
|---|---|---|---|
| LMB | Slash | Three-hit combo: 12, 14, then an overhead finisher for 24 that knocks back | none |
| RMB | Grapple | Pulls you to the dummy you are locked on, or the wall under the crosshair. Hold to keep pulling, jump to let go | 0.5 s |
| Q | Blink Strike | Teleport behind the locked dummy and strike. With no target, blink 14 forward. With the lock-on ring on a lit fire, blink into it (see Flame) | 4 s |
| E | Cyclone | A spinning dash that hits everything it passes, about 13 times a second. Used inside a storm it takes Thunder | 5 s |
| R | Meteor Slam | A hop, then a dive straight down and a blast around the landing. Landing in a pool takes Water | 6 s |
| F | Rising Slash | An uppercut that launches dummies into the air, and you with them | 3 s |

**Fighting in the air.** A sword hit that lands while you are off the ground holds you up: a small hop, then a short slow fall. Each one does less than the last, and after four there is nothing left until you land again. An enemy hit by the sword in the air is held up the same way, for five hits. So a launch can be followed by about half a dozen hits, and then both of you come down. Swinging at nothing does not hold you up at all, and neither do the Mage's missiles.

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
| Cyclone | Hit 3 dummies with one spin: they stand close enough that a spin straight through the middle one catches all three (45 s) | Deal 400 damage with it (45 s) | Deal 600 damage with it, with a shield dummy in the line (45 s) |
| Meteor Slam | Start a slam 5 high and hit 3 dummies (75 s) | Catch 3 dummies and a fighter in one blast (90 s) | Catch 3 dummies and two fighters in one blast (120 s) |
| Rising Slash | Known from the start | Launch a dummy, then 4 more hits before it lands (90 s) | Launch a fighter, then 5 more hits before it lands (120 s) |

## Mage

A staff and spells. Slow on foot (8, where the Blademaster runs at 9.5) and with no second jump, but it hits one enemy harder than anything else and it fights from a distance. Its biggest hit is the sniping shot on the right mouse button, which has to be aimed by hand. Skills are learned and ranked up through trials, as for the Blademaster.

| Key | Ability | What it does | Cooldown |
|---|---|---|---|
| LMB | Arcane Bolt | Three bolts from the staff, each a missile that flies to the locked-on enemy or to the crosshair: 14, 14, then a heavy one for 30. You do not step forward | none |
| RMB (hold) | Arcane Snipe | Hold to take aim: the camera comes up to the eye (your own body is hidden), the view narrows, and a ring closes round the crosshair for 1.2 s while the shot charges (it turns gold when full). You can only creep while aiming. Let go to fire a straight line up to 90 long: 30 damage uncharged, 150 fully charged, and half as much again for a hit to the head. **Nothing guides it:** it hits only what the crosshair itself is on, and the lock-on ring is hidden while you aim. The mouse slows down as the scope closes (to 40% when full), so the crosshair moves across the screen as it normally does. A dash or being hit breaks the aim off | 4 s |
| Space in the air | Hover | In place of a second jump: you hang in the air for 1.6 s and can cast from there | once per jump |
| Q | Arcane Crossbow | A big crossbow made of light appears in the air above and in front of you, draws its string for 0.3 s, and looses one great arrow at one enemy, then kicks back and fades. The hardest single hit of the skills. Being hit or dashing before it looses breaks the spell. With the lock-on ring on a lit fire it takes Flame instead | 5 s |
| E | Arcane Barrage | A machine gun made of light appears at your right side, its barrels spinning, and pours a stream of small missiles at one enemy, one every 0.11 s, while you stand still and direct it. A dash breaks it off. Inside a storm it takes Thunder instead | 7 s |
| R | Comet | Calls something down from the sky onto the locked-on enemy, or the spot under the crosshair, up to 40 away. It lands 0.7 s later, in a small circle (3.2). Pressed while standing in a pool it takes Water instead | 9 s |
| F | Force Nova | The way out. The staff is driven into the ground and a ring of force hurls everything around you back and into the air, a long way, and leaves it unable to act for a moment. It does almost no damage on purpose: it is for getting away, and the Mage stays a class that kills one enemy at a time | 5 s |

Every shot can hit Master Sen (the bolts, the crossbow's arrow, each missile of a Barrage, the Comet, the Nova and the sniping shot), with the usual consequences: a warning, then a grab. A Barrage at him lands more than one, so it earns both.

A missile bends towards a locked-on enemy, so it rarely misses one that is standing still; it hits the first enemy or wall in its way.

### Ranks

Arcane Snipe has no ranks. Force Nova is known from the start; the other three start locked.

| Ability | Rank I | Rank II | Rank III |
|---|---|---|---|
| Arcane Crossbow | 70 damage, 5 s cooldown | 90 damage, 4.5 s cooldown | A knockout gives the skill straight back |
| Arcane Barrage | 6 missiles of 12, 7 s cooldown | 8 missiles of 14, 6 s cooldown | 12 missiles |
| Comet | 110 damage, 9 s cooldown | 140 damage, 8 s cooldown | What it lands on is stunned for 2 s |
| Force Nova | 8 damage, reach 5, a hard throw (26), 0.4 s stun, 5 s cooldown | 10 damage, throws harder (30), 4 s cooldown | Reach 6.5, throws harder still (36), 1 s stun |

### Trials

| Ability | To learn | For rank II | For rank III |
|---|---|---|---|
| Arcane Crossbow | Hit all 3 flying dummies with it (75 s) | Deal 400 damage with it (60 s) | Knock out 4 weak dummies with it (60 s) |
| Arcane Barrage | Deal 200 damage with it (60 s) | Hit the flying dummies 12 times with it (75 s) | Deal 450 damage with it (75 s) |
| Comet | Hit 3 dummies with one Comet (60 s) | Land one on the fighter, twice (120 s) | Deal 600 damage with it (75 s) |
| Force Nova | Known from the start | Throw back 4 dummies with one Nova (60 s) | Interrupt a fighter's attack with it, twice (120 s) |

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

### The Mage under a style

The Mage takes the same three styles and gets the same dash and the same mounts. Four things are its own.

**How a style is taken.** With a skill key at the source; the skill itself does not happen (its cooldown starts all the same):

| | Water | Flame | Thunder |
|---|---|---|---|
| **Taken by** | R (Comet) while standing in a pool | Q (Arcane Crossbow) with the lock-on ring on a fire (within 15): you are carried into it | E (Arcane Barrage) while standing inside a storm |
| **Needs first** | Comet learned | Arcane Crossbow learned | Arcane Barrage learned |
| **Trial to unlock** (if the Blademaster has not unlocked it already) | Take Water, then land 12 hits before it runs out (60 s) | Take Flame, then have 3 dummies burning at once (60 s) | Take Thunder, then make lightning jump between enemies 6 times (60 s) |

A style is unlocked once, for both classes.

**What it wears.** Robes in place of the Blademaster's plate: a pointed hat with a wide brim and a glowing band, wide sleeves, a short mantle over the shoulders, and the same long coat and cape, all in dark cloth split by glowing cracks in the style's colour. No hair made of the element; the hat is there instead. The staff's orb takes the style's colour and grows a head: a tongue of flame, a ring of water, or three forks of lightning.

**How its missiles fly.** Every missile (the bolts, the crossbow's arrow, the Barrage) changes:

| | Plain | Flame | Thunder | Water |
|---|---|---|---|---|
| **Looks like** | A violet ball | A big orange fireball | A thin yellow streak | A blue orb |
| **Speed** | 46 | 34, the slowest | 95, the fastest | 40 |
| **What is special** | Nothing | It bursts where it lands: everything within 2.6 takes half its damage again, the one it struck included | It goes on through two more enemies | It bends after its target far harder, so it almost never misses |
| **Comet lands after** | 0.7 s | 0.8 s | 0.3 s | 0.7 s |

**The crossbow and the machine gun** take the style's colour, and the crossbow's arrow is wrapped in the same wisps that run along the Blademaster's sword under that style: fire, water or lightning flowing along the shaft.

**The sniping shot** takes the style's colour and its special: under Flame it bursts on the enemy it hits, under Thunder it goes on through two more enemies in the line. A fully charged shot also carries the style's strike (below).

**What every hit does.** The same as that style's sword: Flame sets the target burning, Thunder's damage jumps to a second enemy and you run faster, Water takes time off every cooldown. On top of that each skill adds the style's strike where it lands:

| | Flame | Thunder | Water |
|---|---|---|---|
| **Adds** | A patch of fire, 60% as wide as the skill's reach (at least 1.6), burning 4 s for 16 a second | A bolt on everything the skill reached: stunned 0.8 s and hit again for 40% of the skill's damage | Everything within 1.8 times the skill's reach is dragged in and soaked for 3 s (it takes 30% more, and a fighter is slowed); you are healed 4 for each, up to 20 |

Where it lands: on the enemy the arrow strikes, on the enemy the last missile of a Barrage strikes, and where the Comet comes down.

**Force Nova does not get that strike.** Fire on the ground or a bolt on everyone would turn it into an attack on a crowd. A style only changes what kind of room it makes: under Flame what it throws is singed (it burns for 1 s only), under Thunder it is stunned 0.8 s longer, under Water it is thrown 30% harder and soaked for 3 s.

What each skill is called on the skill bar while a style is on:

| Skill | Flame | Thunder | Water |
|---|---|---|---|
| Arcane Crossbow | Flame Arrow | Lightning Arrow | Tide Arrow |
| Arcane Barrage | Ember Barrage | Spark Barrage | Rain Barrage |
| Comet | Meteor | Thunderbolt | Tidal Crash |
| Force Nova | Fire Nova | Shock Nova | Tidal Nova |

### What each skill becomes (Blademaster)

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

He cannot be hurt, but he reacts to being hit. Sword swings, blasts, Cyclone and Rising Slash count, and so does every one of the Mage's shots.

| What you do | What he does |
|---|---|
| Hit him once | He points at you, throws you back, and his eyes burn brighter for 10 seconds |
| Hit him again within those 10 seconds | He catches you by the neck and holds you off the ground. Then one of two things, taking turns: **the slam** (he leaps into the air with you and slams you into the ground from the top of the jump, for 60% of your full health) or **the throw** (he winds up and hurls you flat and fast at one of the tall rocks; you smack into its side, hang there spread out for a moment, then drop, for 40%). Neither ever takes your last point. In the training hall he throws you at the wall. Where there is nothing tall to throw you at, it is always the slam |
| Hit him again after the 10 seconds | Another warning |

Hits less than 0.6 seconds apart count as one. For about a second and a half after a slam he cannot be provoked again. He only throws you at a rock he can see from where he stands: one with another rock in the way is never chosen, and if he can see none it is the slam.

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
| Runner (missions) | Dull yellow, **yellow band** | Small and quick | Fights like a scout but moves at 8.5, nearly your running speed. **Weak to Thunder** | 170 |
| Ironclad (missions) | Dark steel, **orange band** | Bigger and heavier | Slow (3.6) and very tough. **Weak to Flame** | 420 |
| Dock rat (missions) | Blue-grey, **blue band** | Small | Weak alone, but they come seven at a time. **Weak to Water** | 95 |
| Lookout (missions) | Brown, red band | A little smaller than a scout, standing somewhere high | Does not come after you. From up to 46 away it aims a thin red line at you for 0.8 s, then throws along it for 10. The line stops following you a quarter of a second before the throw, so a sidestep or a dash dodges it. It cannot see straight down from its perch. Up close it slams like the others | 130 |
| Barricade (missions) | Wood | A wall of planks with spikes on top | Does not move or fight. Swords and skills do nothing to it. One ram from any mount breaks it, and so does a powder keg going off beside it | 60 |
| The Twins (missions) | One dark red with an **orange band**, one dark blue with a **blue band** | Two smaller bosses with spiked shoulders | Ember and Tide, the keepers of the Old Market, fought together. Ember is **weak to Flame** and Tide **weak to Water**, so the fight asks for both. They do not stay down alone: when one falls the other must follow within 12 seconds, or the first gets back up with 35% of their health | 800 each |
| Marrow (missions) | Dark | As big as Rook, with spiked shoulders | The boss of the docks. He wears armour: every hit counts for 60% (the number says ARMOUR) until a powder keg going off beside him breaks it open for 6 seconds and staggers him. At half health he calls in two runners and an ironclad and has the fuse lit: 40 seconds to finish him | 1500 |
| Rook (story only) | Dark ash | The same headband and mask on a much bigger body with spiked shoulders | The first boss. The same slam and lunge, with far more health | 800 |

**Things in a district that react (missions).**

| Thing | Looks like | What it does |
|---|---|---|
| Powder keg | A dark barrel with a glowing orange band and a fuse | 30 health, so one or two hits break it. 0.6 seconds later it blows up: up to 140 to every enemy within 5.5 (half that at the edge), 18 to you if you are still within 4.4, and a patch of fire for 5 seconds. It breaks barricades and cracked walls, strips armour, and sets off other kegs in reach. Fire sets it off too |
| Lever | A post with a glowing gold handle | Hit it once and something happens: the crane lets its load go, Tam is cut down |
| Falling load | A crate hanging from the crane | When let go it drops, does 500 to enemies under it and 25 to you, and breaks the gate it lands against. A low pile is left to step over |
| Cage | A ring of bars with a gold lock; someone kneels inside | 40 health. Break it open and you get 20% of your health back |
| Cracked wall | A wall the colour of crates | A powder keg going off beside it brings it down |
| Awning | A red block, 1.6 high | Land on it and it throws you 10 up and forward, onto the rooftop ledge beyond |
| Trap | A strip across the ground: white for steam, orange for a burning stall | Brightens for 0.9 s as a warning, then burns for about a second: 10 or 12 to you if you stand in it. A dash passes through unhurt. A burning stall is put out for good by a dash under Water |
| Hourglass | A blue light in the air | 4 more seconds on the clock |
| Ledger page | A pale gold light in the air | A piece of the story. Three in each district; all three add 10 to your maximum health |

**Curtains of light (missions).** A pale blue see-through wall across a gap. It stops you, your mount and every enemy. Dash (Shift) and you pass straight through it.

**Weaknesses.** The colour of a gang member's headband is the element that hurts it most: orange for Flame, yellow for Thunder, blue for Water, red for none. Hit under that sword style it takes 60% more. Hit any other way it takes only 60% of the damage. Burning ignores this.

---

# Part 5: Mounts

Press X to get on and X again to get off (you hop off keeping your speed). Every class can ride. Which mount comes depends on the sword style in use, and it changes under you if the style changes or runs out.

While riding: the movement keys steer, Space jumps. Running into an enemy at a fair pace hits it and throws it aside (the same enemy at most every 0.7 s), and the sword style's effect applies to that hit. One ram from any mount breaks a barricade. Attacking, using a skill, dashing, being hit or being defeated all take you off the mount.

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
