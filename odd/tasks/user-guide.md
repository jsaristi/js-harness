# User guide: docs a new user can start from, and a real --help on every command

Locator: `odd/tasks/user-guide.md` · Engram mirror: `odd/user-guide/tasks` · Branch: `docs/user-guide`
Delivery: one pull request, two work-unit commits (help, then docs). Test runner: `node --test`.

## Goal
A new user gets going from the docs alone: a user guide linked from the README, and `js-harness <command> --help`
answering every command with its usage and exit 0.

## Why
An audit of `main` on 2026-10-20 found the reference docs complete and held by tests, but no user guide and no real
`--help`: 32 of 38 commands answered `--help` with "unknown argument" and exit 2, and `update --help` ran a real
release lookup because its parser ignored flags it did not know (`bin/update.mjs:21-33`). Sebastián keeps iterating in
0.9x releases, so a new user reads `main`'s docs, not a frozen manual.

## Done when
- `node --test bin/js-harness.test.mjs bin/update.test.mjs bin/stack.test.mjs bin/readme.test.mjs` exits 0
- `npm run check` exits 0
- `node scripts/tui-walk.mjs` exits 0
- A pull request is ready for the lead, with its gentle-ai line and a Codex review record.

## In scope / Out of scope
- In: the dispatcher's help (`bin/js-harness.mjs`) and its test; `bin/update.mjs` and `bin/stack.mjs` argument
  parsing and their tests; the usage constants the dispatcher reads (one `export` each); `docs/GUIDE.md`, README,
  `docs/SPEC.md`, `docs/ROADMAP.md`, `odd/tasks/onboarding.md`.
- Out: changing what any command does beyond `--help`; reordering README's command sections, which
  `bin/readme.test.mjs` holds to the dispatcher's order (so the end-user/internal split is an index, S8); the design
  item of the Onboarding phase, open until design v4.

## Constraints
- A command that does not print help of its own refuses `--help` today, so reading for help never acts
  (`bin/lib/args.mjs:8-10`); the new help must keep that: `--help` alone prints and runs nothing — because
  `install --help` once installed on his machine (2026-10-09).
- `package.json` is not touched — because version bumps are their own release step.

## Ask me before
Nothing: the task was given whole (L1).

## Specs
- S1. "Write `docs/GUIDE.md` and link it from the top of README": install with npm or pnpm; `js-harness` with no
  arguments opens the TUI menu, "what each item does (Status, Doctor, Install the stack, Install, Update, Upgrade,
  Uninstall and its kinds, project Init/Sync/Status, Remote status/start/stop)"; the first run: `install`,
  `stack install`, `init`, `onboard`, `backup init`; a typical workflow: check, commit, review, progress; uninstall.
- S2. "A real `--help` on every command": "32 of 38 commands answer `--help` with \"unknown argument\" and exit 2.
  Each should print its usage and exit 0."
- S3. "`update --help` currently runs a real release lookup, because its parser ignores unknown flags
  (`bin/update.mjs:21-33`). Fix that."
- S4. "`stack`'s usage should name `install` and the valid `--tool` ids."
- S5. "Add one test that loops over the dispatcher's commands and asserts `--help` exits 0 with a usage line."
- S6. "README \"Remove\" still says `npm rm -g js-harness` (`README.md:37`), which is wrong for pnpm and redundant
  after `uninstall --global --everything`."
- S7. Main help: "undersells `install`, which writes skills AND hooks (`bin/js-harness.mjs:13`)"; "The main help's
  `backup` line leaves out summary, restore and verify"; "The main help's `guard` line leaves out the
  `<code> ORQ · <purpose>` title form."
- S8. "Split README's commands into end-user commands and orchestrator-internal ones (guard, reply, resume, permit,
  notify, wake, sessions), or add a short index that says which is which."
- S9. "Document the version aliases `-v`, `--version` and `version` in README and SPEC." "Name `bin/tui.mjs` in a
  SPEC Today line."
- S10. "ROADMAP ticks: the Onboarding phase shows 0/2 although `onboard` slices 1-2 shipped (PRs 466, 468), and
  `odd/tasks/onboarding.md` T3 is merged. Tick what shipped; the design item stays open, because design v4 is
  still pending."

## Tasks
- [x] T1 (kind: build) `--help` on every command through the dispatcher, `update` refusing unknown flags, `stack`
  help naming `install` and the `--tool` ids, the loop test (S2-S5, S7). Route: inline. RED: 6 failing
  (`node --test bin/js-harness.test.mjs bin/update.test.mjs bin/stack.test.mjs`), GREEN: 129 of 129 with readme.
- [x] T2 (kind: docs) `docs/GUIDE.md`, README link, Remove, command index and version aliases, SPEC lines (S1, S6,
  S8, S9). Route: inline.
- [x] T3 (kind: docs) ROADMAP and `odd/tasks/onboarding.md` ticks (S10). Route: inline. `js-harness progress`:
  Onboarding 1/2, the design item open.
- [x] T4 (kind: verify) Gate, gentle-ai review per code commit, Codex review, pull request. `npm run check` green
  on both commits, `node scripts/tui-walk.mjs` 21 PASS and exit 0, Codex on 19ac60f..e1631b5 correct (L6).

## Log
- L1 (2026-10-20, the task from the lead session, verbatim in its parts above as S1-S10): "Close the documentation
  gaps an audit of js-harness found on main (2026-10-20), so a new user can get going from the docs alone. Do it as
  ODD work with its own feature document `odd/tasks/user-guide.md`, on its own branch, test first where a command
  changes."
- L2 (2026-10-20): design of S2. Every command module but `update` already has a usage string, the one it prints on a
  usage error; five (`backup`, `fetch`, `merge-queue`, `reply`, `windows-daily`) already answer `--help`. The
  dispatcher answers `<command> --help` (or `-h`), as the only argument, with that module's usage and the command's
  line of the main help, and runs nothing; the five keep their own help, and `stack` joins them so that
  `stack install --help` answers too. `--help` after other arguments still reaches the command, which refuses it as
  before, so `gate -- <command> --help` is untouched.
- L3 (2026-10-20): the one existing test that pinned `update` ignoring an unknown flag
  (`bin/update.test.mjs`, "updateMain keeps ignoring flags it does not know") was the behavior S3 removes; it now
  pins the refusal and that `--home`, `--repo` and `--source` are still taken. The loop test asks each command in
  its own process, since `reply`, `fetch` and `backup` write their help to stdout directly, not through console.log.
- L4 (2026-10-20): S8 is an index, not a split: `bin/readme.test.mjs` holds the README's command sections to the
  dispatcher's order, so the README's Commands section and the guide open with one table of which commands are the
  user's and which are for hooks and the orchestrator. README's Remove keeps `uninstall --global` and names the
  package manager's own removal (pnpm first) in place of a bare `npm rm -g`, rather than leading with
  `--everything`, which cannot be undone.
- L5 (2026-10-20): gentle-ai evidence per code commit, for the merge queue.
  - gentle-ai: ee2a7289 assessed medium, review_due false, reason under_budget (316 lines, executable_change bin/audit.mjs).
  - gentle-ai: e1631b51 assessed with the slice 19ac60ff..e1631b51, medium, review_due false, reason under_budget (492 lines).
- L6 (2026-10-20): Codex reviewed 19ac60f..e1631b5 (230 code lines in 33 files): "the patch is correct", confidence
  0.91, no findings; 175,469 input tokens in 79 s, recorded in codex-reviews.jsonl.
