# sessions stop keeps a worktree that holds files

Locator: `odd/tasks/stop-keeps-worktree.md` · Branch: `fix/stop-keeps-worktree` · Delivery: one pull request to main ·
Test runner: `node --test`

## Goal
`js-harness sessions stop <id>` refuses, exiting 1 and running no claude command, while the recorded session's worktree
holds files, unless `--remove-worktree` says the removal is wanted, and its refusal says how to resume a background
session by message instead.

## Why
On 2026-11-04 at 20:06 local (01:06:48Z, the lead's transcript `0f71b2c6`, line 66143) the lead ran
`js-harness sessions stop bf3a3340` only to restart JH 137 after a restart of Claude Desktop. Its `claude rm` deleted the
files of `D:\js-harness\.claude\worktrees\f8-s2-nobackup` and git's registration of it, leaving only the `.git` file,
while claude said "Worktree not removed. Refused before anything was deleted". The branch had been pushed, so nothing
committed was lost; anything uncommitted would have been. A stop is never needed to restart a background session: a
message resumes it from its transcript.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/stop-keeps-worktree.md` exits 0
- `node --test bin/sessions-background.test.mjs bin/lib/manifest.test.mjs` exits 0
- `npm run check` exits 0
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code and an
  independent verifier's verdict in `## Log`

## In scope / Out of scope
- In: `sessionsStopMain` and `START_USAGE` (`bin/sessions-background.mjs`), a helper in `bin/lib/background.mjs`, their
  tests; the orchestrator skill's source (`bin/lib/manifest.mjs`) and its test; this document.
- Out, each with its reason:
  - `js-harness uninstall machine` (`undoBackground`), which also runs `claude rm` on every resting recorded session:
    the brief names `sessions stop` only, and the uninstall is the explicit removal of everything; left open (Log).
  - the leftover folder `f8-s2-nobackup` and bf3a3340's record line: deleting them is the owner's call (the brief).
  - `claude rm` itself: claude's, not this repo's.

## Constraints
- The refusal runs before any claude command — because `claude stop` alone already ends the job, and only the rm deletes.
- A worktree that cannot be read counts as one that holds files — because "could not look" is never read as "none".
- A worktree holding only `.git`, or none at all, is stopped as before — because nothing is left there to lose.

## Ask me before
Nothing planned: the brief chose the guard, the explicit option and the message. A question goes to the lead with
`js-harness notify --to orchestrator --kind question`.

## Depth pass
- 1. Method: a destructive command's guard, to the standard of `git worktree remove`, which refuses a worktree with
  changes unless `--force`: refuse by default, name the explicit option, say the safe alternative. The smallest change:
  one check before `undoSession` in `sessionsStopMain`, one flag. Searched first (`rule:reuse-first`): `claude rm` and
  `sessions stop` in `bin/` (`bin/lib/background.mjs:332`, `bin/sessions-background.mjs:392`), `worktreeOf`
  (`bin/lib/background.mjs:280`) gives the path, so no new path logic.
- 2. Raw material: the code that deletes, `bin/lib/background.mjs:332` (`removeJob`, claude rm) called from
  `bin/sessions-background.mjs:443` (`undoSession` in `sessionsStopMain`); the lead's transcript `0f71b2c6` lines 66143 (the command), 66174 (the brief to the new JH 137 that
  names the loss), 66218 (the relief line "Never use sessions stop to restart a background session that holds a
  worktree; message it instead"); the record `~/.js-harness/background/sessions.jsonl`, where bf3a3340 is still
  `started` (undoSession returned `kept` after claude rm deleted the files); the folder itself, holding a 52-byte `.git`;
  SendMessage's own description: "a send resumes it from its transcript".
- 3. The bar:
  spec 1: `node --test bin/sessions-background.test.mjs`: none, new behaviour; today stop on a worktree with a file
  runs `claude stop` and `claude rm` and exits 0.
  spec 2: `node --test bin/lib/manifest.test.mjs`: none, new behaviour; today the skill says stop removes a session
  "once its work has landed" and nothing about restarting.
- 4. Refutation: could an empty worktree be refused too, breaking the uninstall-free path? The fake claude makes
  worktrees as empty folders, so every existing stop test with `--worktree` would fail if emptiness were miscounted:
  run after the change, they pass. Could the guard miss the incident's case? The worktree held the checkout of
  `f8-s2-removal`, many files; the guard refuses anything beyond `.git`.
  Verdict: supports
- 5. Request: as the Goal; a worktree that cannot be read counts as one that holds files, which is the request's own
  "while it holds files" read safely, not a new ask.
  Adds: none

## Specs
1. "Make `sessions stop` refuse, exiting non-zero and deleting nothing, while the session's worktree holds files. Add an
   explicit option for when removal is wanted, and make the message say how to resume a background session by message
   instead."
2. "Also correct any text that tells the lead to restart background sessions with stop and start: the orchestrator
   skill's restart section and its source in `bin/`."

## Tasks
- [ ] T1 (kind: build) spec 1: the test first, then the guard and `--remove-worktree` · `bin/sessions-background.mjs`
- [ ] T2 (kind: docs) spec 2: the skill's restart section and its sessions start line · `bin/lib/manifest.mjs`
- [ ] T3 (kind: verify) Codex, the Claude lenses, an independent verifier, the pull request

## Log
- L1 (2026-11-04, the brief from the lead session `local_8bd203e6`): "Make `sessions stop` refuse, exiting non-zero and
  deleting nothing, while the session's worktree holds files. Add an explicit option for when removal is wanted, and
  make the message say how to resume a background session by message instead. [...] This is a high-risk item: it
  changes a command's behaviour and touches irreversible deletion. So it gets Codex, the Claude lenses and an
  independent verifier, then a PR. The owner merges."
- L2: open: `js-harness uninstall machine` runs the same `claude rm` on resting sessions with worktrees; whether it
  gets the same guard is a follow-up.
- L3 Evidence of the incident, read in the lead's transcript `0f71b2c6`: line 66143, 01:06:48Z, `js-harness sessions
  stop bf3a3340` and then `sessions start --resume bf3a3340`; the result, 01:07:08Z: claude rm printed "Worktree not
  removed. Refused before anything was deleted (… .git is a link, a mount point, or cannot be probed)", the resume
  printed "Workspace not trusted", and the folder holds only its `.git` file. `undoSession` returned `kept`, so the
  record still has bf3a3340 as `started`. The brief's "Workspace not trusted" came after the deletion, not before it.
- L4 Test first: the two new stop tests in `bin/sessions-background.test.mjs` failed (6 pass, 2 fail), then passed 8 of 8
  with `worktreeHolding` and the check before `undoSession`; the skill test in `bin/lib/manifest.test.mjs` failed, then
  the orchestrator tests passed 28 of 28. A unit test of `worktreeHolding` covers `.git` alone, an empty folder, a
  missing one and one that cannot be read. The worktrees the fake claude makes are empty folders, so every earlier stop
  test with `--worktree` still runs claude stop and claude rm unchanged.
- L5 Searched before adding (`rule:reuse-first`): `worktreeOf` gives the path and is reused; no check of a worktree's
  contents existed in `bin/` (`readdirSync` near `worktree` in `bin/lib/background.mjs` and `bin/sessions-background.mjs`:
  none). `README.md` and `docs/SPEC.md` described stop's removal and now say it refuses; neither told the lead to
  restart with stop and start. The installed skill under `~/.claude/skills` is written by install from
  `bin/lib/manifest.mjs` and is not edited here.
