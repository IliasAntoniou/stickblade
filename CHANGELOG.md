# Changelog

Newest first. One entry per merged feature: what changed, where, how to check it, and the git tag to go back to.

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
