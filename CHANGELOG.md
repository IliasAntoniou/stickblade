# Changelog

Newest first. One entry per merged feature: what changed, where, how to check it, and the git tag to go back to.

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
