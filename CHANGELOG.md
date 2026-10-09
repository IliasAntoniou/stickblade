# Changelog

Newest first. One entry per merged feature: what changed, where, how to check it, and the git tag to go back to.

## v0.4-blademaster: skills are earned (Blademaster only)

- **What:** The Blademaster now starts with the basic attack, Grapple and Rising Slash. Blink Strike, Cyclone and Meteor Slam are locked and each is learned by passing a trial from Master Sen ("Train my skills"). Every skill then has rank II and rank III, each earned by a harder trial that has to be done with that skill. Rank II gives better numbers; rank III changes how the skill works (Blink Strike: a knockout gives it straight back; Cyclone: lasts longer; Meteor Slam: stuns fighters; Rising Slash: hits all around). The skill bar shows LOCKED or one diamond per rank. The other three classes are unchanged.
- **No back doors:** trials are the only way to gain a rank. A learning trial lends the skill only while it runs. Trials that test one skill make dummies immune to everything else. Ranks must be earned in order. Trials refuse to start, and fail, if any tuning value is changed.
- **Testing tools:** the tuning panel has "Unlock all skills" and "Reset progress". They skip the trials on purpose, for trying things out.
- **Where:** new `js/progress.js`; ranks, perks and all eleven trials are data in `js/classes/blade.js`; hooks in `dummies.js` (hit reporting), `update.js` (locked keys, Cyclone and Slam read rank numbers), `player.js`, `challenges.js`, `master.js`, `hud.js`, `tuning.js`. New `serve.py`, used by `play.bat`, so the browser never runs stale files.
- **Not tuned yet:** every trial's time limit and goal is a first guess. They are meant to be adjusted after playing.
- **Check:** `bash tests/smoke.sh` (it now starts from a fresh save, checks locked skills, runs trials, plays the Cyclone and Slam trials for real, and checks every back door listed above).

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
