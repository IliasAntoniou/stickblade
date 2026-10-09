# Stickblade

Browser game (three.js, native ES modules, no build step, no dependencies). The folder must stay self-contained: no CDN links, relative paths only.

Run locally with `python -m http.server 8000` from this folder, then open `http://localhost:8000/`. Add `?debug` to run the simulation without pointer lock and expose `window.SB` for testing.

Smoke test: with the server running, `bash tests/smoke.sh` (headless Chrome, prints `SMOKE PASS` or the failures). The same test runs in a normal browser at `http://localhost:8000/?debug=smoke`. Run it after every change and extend `tests/smoke.js` when adding a class, dummy type, challenge or map.

## Code layout

`js/main.js` is the entry point. `util`, `core`, `world`, `stickman`, `state` and `fx` are the base layer: only these may be used at another module's top level. All other modules import each other freely but only use those imports inside functions. An imported `let` is read-only, so cross-module writes go through setter functions (`addHitstop`, `setCamYaw`, `setCL`, ...). Classes register themselves on `CLASSES` (in `state.js`) from `js/classes/*.js`.

## Git rule

Applies to every new feature or stage of work.

1. **Start:** before touching code, check for the feature's branch. If none exists, create `feature/<short-name>` from an up-to-date `main`. Never work directly on `main`.
2. **End:** when the feature is finished and verified (including the user's playtest), `git add`, commit, push the branch, merge into `main`, push `main`.
3. **Not all good:** do not merge. Leave the work on the branch, report what failed, and fix it there.

## Working alongside the user's edits

The user edits this project too. Re-read the current files before starting work; never rely on an earlier read.
