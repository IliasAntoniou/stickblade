# Stickblade

Browser game (three.js, native ES modules, no build step, no dependencies). The folder must stay self-contained: no CDN links, relative paths only.

Run locally with `python -m http.server 8000` from this folder, then open `http://localhost:8000/`. Add `?debug` to run the simulation without pointer lock and expose `window.SB` for testing.

## Git rule

Applies to every new feature or stage of work.

1. **Start:** before touching code, check for the feature's branch. If none exists, create `feature/<short-name>` from an up-to-date `main`. Never work directly on `main`.
2. **End:** when the feature is finished and verified (including the user's playtest), `git add`, commit, push the branch, merge into `main`, push `main`.
3. **Not all good:** do not merge. Leave the work on the branch, report what failed, and fix it there.

## Working alongside the user's edits

The user edits this project too. Re-read the current files before starting work; never rely on an earlier read.
