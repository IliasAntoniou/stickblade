# Stickblade

Browser game (three.js, native ES modules, no build step, no dependencies). The folder must stay self-contained: no CDN links, relative paths only.

Run locally with `python serve.py` from this folder, then open `http://localhost:8000/`. Use `serve.py`, not `python -m http.server`: it disables browser caching, and without that stale files get run after edits. `play.bat` does both (the user has a Desktop shortcut to it). Add `?debug` to run the simulation without pointer lock and expose `window.SB` for testing.

Read `docs/CODE_MAP.md` first: it says where everything is, what the short names mean, and how to add a class, skill, dummy type or challenge.

## How code is written here

The user is vibe coding: the AI writes most of the code and the user directs. They still want to open any file and understand it, and they want changes that cannot quietly break the game. So:

- **Write for a reader** who knows basic programming but does not know this codebase, three.js or 3D maths.
- **Every file starts with a header comment:** what the file is for, what it owns, what uses it. First line is `// <path under js/>: ...`.
- **Every function gets a short comment** saying what it does and when it runs, unless its name already says everything.
- **Comments explain why,** not what: tuning numbers (with units), non-obvious tricks, traps, what breaks if this changes. Do not restate what a line plainly does.
- **New and touched code:** one statement per line and descriptive names. Existing short names (`P`, `CL`, `T`, `_a`) stay, and every short name must be in the glossary in `docs/CODE_MAP.md`.
- **In the same change as the code,** update: the comments, `docs/CODE_MAP.md`, `CHANGELOG.md`, and `tests/smoke.js` when a class, dummy type, challenge or map is added. Never leave these for later.
- **When reporting a change to the user,** say which files and functions were touched and how to check it works.

## Checks before any merge

With the server running:

1. `bash tests/smoke.sh` prints `SMOKE PASS` (headless Chrome; the same test runs in a normal browser at `http://localhost:8000/?debug=smoke`).
2. `python tests/check_docs.py` prints `DOCS OK` (every file has a header; everything `docs/CODE_MAP.md` points at exists).
3. The user has playtested and said it is good.

After the merge, tag the version (`v0.N-<name>`), push the tag, and name the tag in the `CHANGELOG.md` entry. Tags are the restore points.

## Code layout rules

`js/main.js` is the entry point. `util`, `core`, `world`, `stickman`, `state` and `fx` are the base layer: only these may be used at another module's top level. All other modules import each other freely but only use those imports inside functions. An imported `let` is read-only, so cross-module writes go through setter functions (`addHitstop`, `setCamYaw`, `setCL`, ...). Classes register themselves on `CLASSES` (in `state.js`) from `js/classes/*.js`.

## Git rule

Applies to every new feature or stage of work.

1. **Start:** before touching code, check for the feature's branch. If none exists, create `feature/<short-name>` from an up-to-date `main`. Never work directly on `main`.
2. **End:** when the feature is finished and verified (including the user's playtest), `git add`, commit, push the branch, merge into `main`, push `main`.
3. **Not all good:** do not merge. Leave the work on the branch, report what failed, and fix it there.

## Working alongside the user's edits

The user edits this project too. Re-read the current files before starting work; never rely on an earlier read.
