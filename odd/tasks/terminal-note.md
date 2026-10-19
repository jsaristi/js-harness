# Terminal note and the full update report

Locator: `odd/tasks/terminal-note.md` · Engram mirror: `odd/terminal-note/tasks` · Branch: `feat/terminal-note`
Delivery: one slice, one pull request. Test runner: `node --test`.

## Goal
A command typed into his Terminal panel ends with a note he reads beside it, and the review of a Claude Desktop
update ends with a full report of what improved, changed and was fixed, what it does to us and what to change.

## Why
He learns from the terminal by reading what each command does where it runs, and an update review that only listed
breaking changes left him without what helps, what hurts and what the harness should do about it. Both are his
requests of 2026-10-19; a check carries each, so no session has to remember them.

## Done when
- `node --test bin/lib/guard.test.mjs bin/guard.test.mjs bin/lib/manifest.test.mjs bin/lib/host-update.test.mjs bin/doctor.test.mjs bin/install.test.mjs` exits 0
- `npm run check` exits 0
- A `run_in_terminal` call without the note is denied by the installed guard after `js-harness sync --global`.

## In scope / Out of scope
- In: `bin/lib/guard.mjs`, `bin/guard.mjs`, the guard's matcher and its copies, `bin/lib/host-update.mjs`, their
  tests, README, the help and skill lines, ROADMAP.
- Out: release-095 (its own branch and worktree), commands in a reply's code blocks (no tool carries them, so no
  check can hold them; the reply states the note under each one instead).

## Constraints
- The note is `; Write-Host 'NOTE: ...'` in single quotes and printable ASCII — because `run_in_terminal` refuses a
  comment, a variable, a backtick and any character outside printable ASCII.

## Ask me before
Nothing: both rules are his words; spend is one gate, one gentle-ai review and one Codex review.

## Specs
- S1. His words (2026-10-19): "Explicame siempre abajo en una nota que va a acer el comando" and "Pero explicame que
  va a hacer el comando en el terminal al final para poderlo ver junto al comando y aprender que hace ademas metelo al
  harnes". `js-harness guard --hook` denies a `mcp__terminal__run_in_terminal` call whose command does not end with
  `; Write-Host 'NOTE: <what it does>'` (or `; echo 'NOTE: ...'` in an SSH host's shell), four words or more; the
  reason shows that shape. The guard's hook matcher includes `mcp__terminal__run_in_terminal`.
- S2. His words (2026-10-19): "Se acabo de actualizar Claude Desktop, lee todo lo que cambio como el protocolo que
  hicimos y dime tambien mete al protocolo que me diga todo un resumen completo de que mejoro, que cambio y que se
  corrigio. y en que nos beneficia o damnifica y que podemos hacer para que el harnes funcione mejor o que toca
  cambiar". The `host-update` review step of `doctor` reads: "report to the user a full summary in everyday words:
  what improved, what changed and what was fixed; for each, how it helps or hurts the harness and the way the user
  works; and what the harness should change to work better, or must change; a version the changelog has no entry for
  is reported as having none".

## Tasks
- [x] T1 (S1, kind: build): `terminalNoteRefusal`, its route in the guard, the matcher in its five copies, help, skill
  and README lines. Route: inline. RED: `bin/lib/guard.test.mjs` could not load (`terminalNoteRefusal` not exported).
  GREEN: guard, lib/guard and manifest tests 240/240.
- [x] T2 (S2, kind: build): the report step in `bin/lib/host-update.mjs`, its two test copies, README. Route: inline.
  No RED of its own: the step is one constant the tests assert verbatim, changed in the same edit. GREEN:
  host-update and doctor tests 94/94.
- [ ] T3 (kind: verify): gate, gentle-ai review, Codex review, pull request, land, `sync --global`, the installed guard
  denies a bare command. Gates, the verifier and both Codex reviews done (L4, L5); the land and the installed check
  are left.

## Log
- L1 (2026-10-19, his words, verbatim): see S1 and S2.
- L2 (2026-10-19): the review of Claude Desktop 2.42304.0 → 2.42304.2 found no changelog entry for 2.42304.1 or
  2.42304.2 (the page's newest is 2.42304.0, 2026-10-15); the bundled Code tab CLI stayed 2.1.299. Hooks ran
  (UserPromptSubmit, PreToolUse and PostToolUse output seen this session); Remote Control was turned back on here.
- L3 (2026-10-19): before the restart, every Bash call of the lead failed with "unexpected EOF" at line 82: the
  session's environment files from the SessionStart hooks had grown to 81 duplicated `export` lines over its
  compactions; deduplicating them did not help, so the host held them in memory, and that they caused it is not
  proven. After the reboot the shell works. Not fixed here; proposed as its own task.
- L4 (2026-10-19): T1 and T2 committed as 4ed1cc5d (gate passed). gentle-ai e4adf3be..4ed1cc5d medium, not due
  (under_budget). Independent verifier (risk item 2, a guard): S1 and S2 met, no blockers, 250/250; advisories: a
  lowercase `note:` passed, and a quote could count inside a word. Codex e4adf3b..4ed1cc5: incorrect (confidence 1),
  one P2, taken: a word of the note could reach past its closing quote, so `npm test; Write-Host 'NOTE: runs tests';
  echo 'done'` passed. Fixed test first (RED 32/33): a word holds no quote, and `NOTE:` is matched in capitals; the
  lowercase advisory is pinned by the same test.
- L5 (2026-10-19): the fix committed as 84b829bd (gate passed). gentle-ai 4ed1cc5d..84b829bd medium, not due
  (under_budget). Codex 4ed1cc5..84b829b: correct (0.99), the P2 fixed.
