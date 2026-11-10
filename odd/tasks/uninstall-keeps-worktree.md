# uninstall machine keeps a background session whose worktree holds files

Locator: `odd/tasks/uninstall-keeps-worktree.md` · Branch: `worktree-audit-h1-uninstall-guard` · Delivery: one pull
request to main · Test runner: `node --test`

## Goal
`js-harness uninstall machine` never runs `claude stop` or `claude rm` on a recorded background session whose worktree
holds files: it keeps that session, names it with its worktree and what settles it, and fails until it is settled, as it
does for a session at work.

## Why
`sessions stop` refuses a session whose worktree holds files because on 2026-11-04 `claude rm` deleted every file of
such a worktree but `.git` while it said it had refused (`odd/tasks/stop-keeps-worktree.md`). `uninstall machine`
reaches the same `claude rm` through `undoBackground` with no such check, so an uninstall run while a background
session rests with uncommitted work deletes that work. That document's L2 named the follow-up and no task held it; the
Fable 5.2 audit of 2026-11-09 (finding H1) found it again.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/uninstall-keeps-worktree.md` exits 0
- `node --test bin/sessions-background.test.mjs bin/lib/background.test.mjs` exits 0
- `npm run check` exits 0
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code and an
  independent verifier's verdict in `## Log`

## In scope / Out of scope
- In: `undoBackground` (`bin/lib/background.mjs`), its report in `uninstallByFlags` (`bin/install.mjs`), their tests,
  the sentence on `uninstall machine` in `README.md` and `docs/SPEC.md`; this document.
- Out, each with its reason:
  - finding H2 (the backup's secret blanking) and every other finding of the audit: the brief gives H1 alone.
  - `sessions stop` and the `at-work` settle line, which still says "sessions stop <id> removes it": stop's own
    refusal names `--remove-worktree` when it applies, and the brief touches nothing else.
  - `claude rm` itself: claude's, not this repo's.

## Constraints
- The check runs before any claude command for that session — because `claude stop` alone ends the job and only the rm
  deletes, and the refusal must cost nothing.
- It reuses `worktreeHolding`, the check `sessions stop` runs — because one rule of what "holds files" means has one
  home: a worktree that cannot be read counts as holding files, one holding only `.git` or none at all does not.
- A kept session keeps the record and the background folder, and the uninstall exits 1 — because that is how
  `undoBackground` already keeps a session it cannot undo exactly.

## Ask me before
Nothing planned: the brief names the guard to reuse and the behaviour. A question goes to the lead with
`js-harness notify --to orchestrator --kind waiting`.

## Depth pass
- 1. Method: a destructive command's guard, to the standard of `git worktree remove`, which refuses a worktree with
  changes unless forced: refuse by default, name the explicit way to remove, keep everything else. The smallest change:
  one `worktreeHolding` check in the loop of `undoBackground`, before `undoSession`, and one settle line in the report.
  Searched first (`rule:reuse-first`): `worktreeHolding` (`bin/lib/background.mjs:292`), used only by
  `sessionsStopMain` (`bin/sessions-background.mjs:429`); `undoSession` callers (`bin/lib/background.mjs:439`,
  `bin/sessions-background.mjs:443`); the settles map (`bin/install.mjs:674`). No new path or content logic.
- 2. Raw material: the path that deletes, `bin/install.mjs:673` → `undoBackground` (`bin/lib/background.mjs:416-442`)
  → `undoSession` (`bin/lib/background.mjs:381-405`) → `removeJob` (claude rm); the guard `sessions stop` has,
  `bin/sessions-background.mjs:429-436`; the incident, `odd/tasks/stop-keeps-worktree.md` L3, and its open follow-up L2
  (`:89`); the audit, `git show origin/claude/fable-5-2-audit-531f8e:docs/audits/2026-11-09-fable-5-2-audit.md`,
  finding H1. Each line the audit cites was read at the source on 2026-11-09 and holds.
- 3. The bar:
  spec 1: `node --test bin/sessions-background.test.mjs`: none, new behaviour; today `uninstall machine` on a resting
  session whose worktree holds a file runs `claude stop` and `claude rm` and removes the worktree.
- 4. Refutation: could the guard keep sessions it should remove, so a clean uninstall never ends? The fake claude makes
  each worktree an empty folder and the existing uninstall tests start sessions without a worktree; a session with only
  `.git` or none is still removed (`worktreeHolding` returns `null`), which the new test checks beside the kept one.
  Could a resumed job slip through? A job a resume replaced is skipped and undone with its head
  (`bin/lib/background.mjs:433`), and the head carries the same worktree (`bin/sessions-background.mjs:354`), so the
  head's check covers the chain.
  Verdict: supports
- 5. Request: as the Goal; the settle line names `sessions stop <id> --remove-worktree` once the work has landed, and
  resuming by message, the two ways `sessions stop`'s refusal already names.
  Adds: none

## Specs
1. "`uninstall machine` never removes a background session whose worktree holds files or changes; it keeps that
   session and names it, as it does for other things it cannot undo exactly. The test that proves it is written first
   and is red before the fix. Do not reproduce the loss on a real session: use fixtures." (the brief, 2026-11-09)

## Tasks
- [ ] T1 (kind: build) spec 1: the test first, then the check in `undoBackground` and its settle line ·
  `bin/lib/background.mjs`, `bin/install.mjs`, `bin/sessions-background.test.mjs`, `README.md`, `docs/SPEC.md`
- [ ] T2 (kind: verify) Codex, the Claude lenses, an independent verifier, the pull request

## Log
- L1 (2026-11-09, the brief from the lead, JH 161's audit finding H1): "`uninstall machine` never removes a background
  session whose worktree holds files or changes; it keeps that session and names it, as it does for other things it
  cannot undo exactly. The test that proves it is written first and is red before the fix. Do not reproduce the loss on
  a real session: use fixtures. [...] treat it as high risk: a feature document with its contract and depth pass unless
  you can show it is small."
- L2 Large, not small: the change is understood within one read, but it touches an irreversible deletion (a high-risk
  item of `CLAUDE.md`), so it fails the small test and carries this document.
- L3 Test first: the new uninstall test in `bin/sessions-background.test.mjs` failed (`0 !== 1`: the uninstall printed
  "removed background session 0db8bc5e · Held" and exited 0), then, with the `worktreeHolding` check in
  `undoBackground` and the `holds` settle line, `node --test bin/sessions-background.test.mjs bin/lib/background.test.mjs`
  passed 52 of 52. The test keeps a session with `src/work.js` in its worktree beside one holding only `.git`, which is
  removed, and settles the kept one with `sessions stop --remove-worktree` before a second uninstall ends.
- L4 Searched before adding (`rule:reuse-first`): `worktreeHolding` is reused unchanged; no other caller of
  `undoSession` than `sessionsStopMain` (already guarded) and `undoBackground`. `README.md` and `docs/SPEC.md` said
  `uninstall machine` removes every resting session and now say it keeps one whose worktree holds files.
- L5 2026-11-09, the lead (channel note 23:05): H2 comes to this session after H1, as its own slice and pull request.
