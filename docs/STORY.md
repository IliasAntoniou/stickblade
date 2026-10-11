# The story

What the story is, who is in it, and every task in order. Kept up to date whenever a task is added or changed. The words and numbers live in `QUESTS` in `js/quests.js` (what Sen says) and in `DISTRICTS` in `js/missions.js` (what is said and found during a mission); to change a line, change it there and here.

## The idea

Master Sen spent eleven years in Blackgate prison for the Ash Hand, the gang he used to run with. He came out wanting to bury it. He cannot do that alone, so he recruits people and trains them. You are his newest recruit.

- **Master Sen:** ex-convict, the Hand's old enforcer. Hard, short with words, honest about what he was.
- **The Ash Hand:** the gang. Grey coats, red headbands and masks. They own the rooftops and run the docks.
- **Rook:** Sen's cellmate for six years, still with the Hand. Sen taught him to fight.
- **Marrow:** keeper of the docks. A butcher, and patient. He lands the Hand's powder.
- **Old Tam:** the locksmith who cut every lock in the city, the gate of the Ash Citadel among them.
- **The Twins, Ember and Tide:** keepers of the Old Market. Tam took them off the street as children and taught them his trade. They went over to the Hand.
- **The Ash King:** the man at the top, in the Citadel. Sen once answered to him.

The names were made up to get started and can be changed.

## The thread: the powder and the key

1. **The powder.** The Hand is landing ashpowder at the docks by night: black powder, meant to burn the free quarters of the city from the rooftops. Taking the docks means blowing that shipment up around Marrow.
2. **What it was buying.** Marrow's ledger shows the powder is one half of a deal. The other half is a key. The Ash King wants a new key to his own gate, and the only man who can cut one is Tam, who refuses. So the Twins are to hang him at the market bell at dusk.
3. **The hanging.** The Old Market is a race down one street to reach the gallows before the bell stops, then a fight with the two people Tam raised.
4. **The three pieces.** Cut down, Tam says why no key can be copied: he built the gate to take three pieces of one key. Cinder keeps one in the Foundry, Lady Vane wears one in the Heights. The third is with Sen. He took it off the Ash King the night he walked away, and sat eleven years in Blackgate sooner than say where it was.

That gives the three districts still to build their reason: two pieces to take, and a gate to open.

## How a task works

1. Sen offers it: talk to him (G) and pick the story card, the first one in his menu.
2. You take it. The task shows at the top right of the screen with its count.
3. When the goal is met, the screen says to go back to him.
4. You tell him. He answers, and the next task is on offer.

The story is told with the Blademaster only. With another class it is paused and its enemies leave. If you are defeated while a task's enemies are about, they all come back and the count starts over. "Reset progress" in the tuning panel starts the story again.

## Chapter 1: The Recruit

All of it happens in the arena and the training hall.

| # | Task | What you do | What it is for |
|---|---|---|---|
| 1 | Show me | Knock out 3 practice dummies | Sen tells you who he is; you learn to hit |
| 2 | High ground | Stand on something at least 12 high | The Hand attacks from above; you learn to climb |
| 3 | A real technique | Learn a new skill in the training hall | Sends you to the trials |
| 4 | They found us | Defeat 4 Ash Hand scouts | The first real enemies. They come at you from the edges of the arena |
| 5 | Rook | Defeat Rook and his two men | The first boss |

It ends with Sen calling you one of his, and pointing at the docks.

## Chapter 2: The Docks

One task: free the docks. It is done through the campaign (below), not in the yard. When you report it, Sen tells you who Tam is.

## Chapter 3: The Locksmith

One task: free the Old Market. When you report it, Sen admits he carries the third piece of the key.

## The campaign: take back the city

This is what the game is for. The city has five districts and the Ash Hand holds all of them. Talk to Sen and choose "The city" to see the map and start a mission. A district opens when the one before it is free.

| # | District | Held by | State |
|---|---|---|---|
| 1 | The Docks | Marrow | Built |
| 2 | The Old Market | the Twins | Built |
| 3 | The Foundry | Cinder | Not built |
| 4 | The Heights | Lady Vane | Not built |
| 5 | The Ash Citadel | the Ash King | Not built |

How a mission works:

- It happens in the district, a separate walled area with its own pool, fire and storm.
- It is fought in stages. Clearing a stage gives back 35% of your health. Health returns by itself only a quarter as fast as in the yard.
- If you are defeated the mission is lost and you start it again. P gives up.
- Winning frees the district for good and adds 20 to your maximum health. A freed district can be fought again.
- Each stage is built around a different tool, so the hook, the mounts and the elements all have a job.
- Districts are different kinds of place, not the same yard with new enemies. The docks are three yards that open one after another. The Old Market is a race down a street.
- **The people in it talk.** Lines appear low on the screen as the stage goes on: the keeper taunting, the prisoners, Tam.
- **Each district hides three pages of the Hand's ledger.** A page is a glowing light to walk into. Each tells a piece of the story. A found page stays found. All three in a district add 10 to your maximum health.
- **Things in the district react** (see `docs/ABILITIES.md`, Part 4): powder kegs, levers, cages, falling loads, awnings, traps, hourglasses.

### The Docks

Three yards, south to north, each shut off from the next until you open it: the gate yard, the cargo yard and the pier.

| Stage | Goal | What it asks of you |
|---|---|---|
| 1 | Break through the gate yard | Three scouts, two runners (yellow bands: Thunder) and a lookout throwing from the top of a stack of crates. Two powder kegs stand among them |
| 2 | Climb the crane and ring the bell | The tower is 17 high: only the grappling hook gets you up. Walk out along the jib and hit the gold lever. That drops the crate hanging under it, which crushes the two guards waiting below and breaks the gate to the cargo yard open |
| 3 | Break the barricades | Three barricades. Ride into one (any mount, one ram), or break the powder keg that stands beside it. Two ironclads guard them (orange bands: Flame). Steam crosses the lane on a cycle |
| 4 | Clear the dock rats | Seven small fast enemies (blue bands: Water), and six kegs they have rolled out in two heaps: one blast sets off the rest of the heap |
| 5 | Defeat Marrow | The gate to the pier opens. Marrow wears armour (every hit counts for 60%) until a keg going off beside him breaks it open for 6 seconds; six kegs ring the pier. At half health he calls two runners and an ironclad and has the fuse lit: 40 seconds left before the pier goes up |

Also in the cargo yard: two cages with dockers in them (break one open for 20% of your health back), and a store in the north-west corner behind a cracked wall that a keg brings down.

Ledger pages: on top of the crane tower; in the store behind the cracked wall; on top of the tall stack of stone on the pier.

What is said: Marrow shouts at his people as each stage begins. When he falls he gives up the ledger, and the page that names Tam is read out.

### The Old Market

One long street, 24 wide and 300 long, and a clock. Tam is on the gallows at the far end.

| Stage | Goal | What it asks of you |
|---|---|---|
| 1 | Reach the gallows before the bell stops (65 seconds) | Movement. **The low road:** four curtains of light that only a dash passes through; two barricades that shut the street until a mount rams them or the keg beside them is broken; two walls right across it (9 and 12 high) that the hook gets over; two burning stalls that flare on a cycle (a dash under Water puts one out for good). **The high road:** six rooftop ledges along the west side, 11 up, where nothing shuts the way. Three awnings throw you up to it; the hook reaches it anywhere. Two lookouts hold it. Runners and dock rats harass you on the street but do not have to be beaten. Five hourglasses, all off the straight line, give 4 seconds each |
| 2 | Defeat the Twins | Two bosses at once, Ember weak to Flame and Tide to Water. A fire and a pool stand beside them. They do not stay down alone: when one falls, the other has to follow within 12 seconds, or the first gets back up with 35% of their health |
| 3 | Cut Tam down | Hit the gold lever by the gallows. The last of the Twins' people are coming up the street: two runners and four dock rats, who are only in the way |

Run out of time in stage 1 and the mission is lost.

Ledger pages: on the first rooftop ledge; on top of the 12-high wall; behind the gallows.

What is said: the Twins taunt Tam and you as the clock runs down (at 45, 25 and 10 seconds). Tam answers them. Freed, he tells you about the three pieces of the key.

## What comes next (not built)

- The other three districts, each meant to be its own kind of place and each with a piece of the story: the Foundry is fire and armour, and Cinder's piece of the key (water and the elephant open it); the Heights is all towers and bridges, and Lady Vane's piece (nothing reachable on foot); the Citadel is the gate itself, and uses everything.
- More kinds of gang member. The lookout is the first that does not fight like a brute.
- Someone besides Sen to talk to in the yard: Tam, once he is free.
