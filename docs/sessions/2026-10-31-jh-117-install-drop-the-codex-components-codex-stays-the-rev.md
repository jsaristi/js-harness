# JH 117 · install: drop the Codex components, Codex stays the reviewer

File: docs/sessions/2026-10-31-jh-117-install-drop-the-codex-components-codex-stays-the-rev.md. Facts with their evidence (a pull request, a commit, a path:line, a command and its output), not prose: the file is read later to reverse-engineer how the work went. Commit and push it, then close with js-harness notify --to orchestrator --kind closed --summary <this file> "<what you delivered>".

## Goal
Take the Codex skills and hooks out of `install` (step 6 of `docs/proposals/claude-app-native-sessions.md` section
12), have `sync`/`uninstall` remove the copies an earlier version installed, and keep Codex as the reviewer. The
opening read was the lead's brief, `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T03-10-38-509Z-2da8c7ee.md`.

## The user's words
His answer to question 136 (D4), read with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 39049`
(2026-10-31T03:10:02Z, tapped): "Sí, sácalos (Recomendada)", to a question that said a yes "saca esos componentes de
install, hace que uninstall quite las copias ya instaladas, y lo prueba en un home de prueba: nada queda bajo
.codex/skills. No toca la revisión con Codex (codex-review sigue igual) ni tu configuración de Codex fuera de lo que el
arnés instaló."

## Delivered
- PR #729 (ready, not merged; this session never merges), branch `worktree-drop-codex-components`:
  - `57486c74` feat(install): write nothing under ~/.codex; Codex only reviews.
  - `dd397c0d` fix(install): earlier Codex copies leave with their trust, their folder and a line each (the
    independent verifier's findings).
  - `bc8c6f6b` merge of main (#727, #728; one conflict in `bin/js-harness.mjs`, both lines kept).
  - `44a4218f` docs(install): the last lines that said install serves both hosts (SPEC, README, two comments).
- Feature document `odd/tasks/drop-codex-components.md`: contract `PASS`, T1–T5 done, Log L1–L10.
- Scratch-home proof (L6, L9): this branch on an empty home writes no `.codex`; over a 0.97.0 install it removes the
  3 Codex skills and 5 hook entries, keeps the user's own hook and an edited skill, moves the trust, and removes the
  `.codex` folder it had made; the undo (0.97.0's `sync --global`) brings them back.
- Question 140 recorded with the lead: applying it to his real `~/.codex`, with the PowerShell commands and their undo.

## Decisions
- D4 (his, question 136): take the Codex components out; ROADMAP "Host" row and the proposal's step 6.
- This session: no new removal code (sync's prune and uninstall already removed undeclared records, L2); a test seam
  (`deps.components`, `deps.entryComponents`, `bin/lib/earlier-codex.testkit.mjs`) so tests run today's commands over
  a real earlier install (L4); the doctor's `codex-trust` row removed (L3).
- This session: gentle-ai's review was not retried or split after `lens_context_budget_exceeded`; splitting would void
  the Codex and lens records of the same commit (L8).

## Failures and lessons
- The first search (L3) grepped `bin/`, `scripts/` and docs, not `evals/`, for readers of `components`; the gate found
  `evals/without.mjs` (L7). Lesson: a search for readers of an export covers every folder that imports it
  (`grep -rl "manifest.mjs'"` over the whole repo), which the second search did.
- Removing `codexConfigOf` dropped a side effect nobody named: `sync` re-recording `trustConfigs` for installs older
  than c7af39e2. The independent verifier found it by reading git history (L9, finding 1); fixed with a test.
- Three lines still saying install serves both hosts (SPEC, README's opener, two comments) were found only when the
  merge with main was read (L11): the L3 grep looked for ids and paths, not for the wording. Lesson: a change of what a
  product serves greps its prose too ("both hosts", "each host", "<host> and <host>").
- The first ready notice was refused, #729 CONFLICTING with main; `notify` checks it, so nothing was claimed ready.
- Two gate runs failed before the first commit landed (a module ceiling and a rules-coverage span, then the evals
  test); each was read in its CI log before the next run.

## Left
- Landing #729: the lead.
- Question 140 (apply to his machine): the lead rings it; the commands run only on his yes.
- Not fixed, older than this change and rare (L9, finding 5): an earlier entry recorded `skipped` is never pruned,
  and a sync stopped between `install`'s manifest write and the prune forgets the records.

## Cost
- Time: brief at 2026-10-31T03:10Z; this summary at about 04:45Z; one host compaction at 22:50 local.
- Context at the end: about 45% of the window (42% at question 140's notice).
- Reviews: Codex three times (3 parts over `57486c74`, 392,930 input tokens; 1 part over `dd397c0d`; 1 over
  `44a4218f`); Claude lenses three times (risk, reliability, readability, 0 findings, about 512k then 62k input tokens;
  readability alone over `44a4218f`); one independent verifier (159k tokens); one gentle-ai start refused in preflight.
- Gate runs: seven commits' (two failed, five passed), plus the one of this document's last commit.
