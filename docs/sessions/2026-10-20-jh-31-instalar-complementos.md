# JH 31 · instalar complementos

File: docs/sessions/2026-10-20-jh-31-instalar-complementos.md.

## Goal
Design and build the js-harness module that installs the mandatory third-party tools, as `odd/tasks/stack-install.md`:
on a scratch home it installs every missing mandatory tool, `doctor` then shows no install gap for them, `uninstall`
undoes what it wrote, and every contract check exits 0. Started by the orchestrator (JH ORQ, local_bd0ae465).

## The user's words
"tenemos que colocar el modulo de install 3rd plugins o complementos obligatorios" (relayed verbatim in the
orchestrator's brief; L1 of `odd/tasks/stack-install.md`). His answers through the orchestrator's question tool:
question 23 "Paso tuyo, nombrado (Recomendado)" (gentle-ai and engram stay his step, F1 option 1, L4) and question 26
"Construirlo (Recomendado)" (build design v3, L5).

## Delivered
- jsaristi/js-harness#472, merged: slice 1, `js-harness stack` read-only with `--json` (866f197b; Codex fixes
  6a2b0ad1, 2c5753ef).
- jsaristi/js-harness#473, ready, branch `feat/stack-install-run`, retargeted to `main` after #472 merged: slice 2.
  - dba54d18 the manifest's `stack` record and its undo in `uninstall machine` (`bin/lib/stack-run.mjs`, `bin/lib/manifest.mjs`, `bin/install.mjs`)
  - cea616b9 `stack install` (`bin/stack.mjs`, `bin/lib/stack-install.mjs`)
  - b9553aba the TUI item Install the stack (`bin/tui.mjs`)
  - e57f2d0c the trial script `scripts/stack-scratch.mjs`
  - 6bf07353, 5a6ca247, c0e862bd Codex's nine P2 findings; cbb5201e two gentle-ai advisories; 80a5fa3b the T4 fixes
- Feature document `odd/tasks/stack-install.md` (T1 to T5 done), engram topic `odd/stack-install/tasks`; ROADMAP
  decision "Stack visibility" amended and row "Stack install" added.
- Note to onboarding on the `stack --json` contract: side-session notes `jh31-stack-json-contract.md`.

## Decisions
- gentle-ai and engram are installed by gentle-ai's own installer, named as his step: Sebastián, question 23 (L4).
- Build design v3 in two slices, test-first, manual proof on a scratch home only: Sebastián, question 26 (L5).
- A registration in Codex under a `CODEX_HOME` of his own elsewhere is printed, never run: this session (L10), since
  `doctor` and the record read `<home>/.codex`.
- A timeout keeps its record; nothing is timed out in a terminal: this session, from gentle-ai's advisories (L11).
- gentle-ai's advisory R1-001 (a record whose `applies` is `null`) and the `doctor` `CODEX_HOME` gap left as T7.

## Failures and lessons
- Codex on b9722fc..e57f2d0 found nine P2 defects (records dropped, prefix PATH, CODEX_HOME, failures called done,
  the trial's POSIX PATH and its missing registration check); all fixed test-first, its recheck found all nine fixed
  (L10, L12).
- The trial's first two runs failed at `codex mcp add` ("CODEX_HOME points to ... but that path does not exist");
  a first fix keyed on the wrong condition, found by run 2; fixed in 80a5fa3b with a test of the trial's own shape
  (L13). Lesson: the manual trial found what the unit tests' fake world could not.
- Run 2 flagged his `~/.claude.json` as changed; his own `codegraph` entry was intact, so the change was the live
  Claude sessions rewriting the file; the trial now compares only its MCP servers (L13).
- Bash heredocs ate backslashes in test strings twice; Edit was used instead (the memory rule already says so).
- One RED was not observed cleanly (c0e862bd: a syntax error first), recorded as such in L10.

## Left
- T6 (`splitCommand` shared with `upgrade --pm`) and T7 (`applies: null` undo; `doctor` and `CODEX_HOME`): follow-ups
  outside this feature, held by the orchestrator.
- Landing #473: the orchestrator.

## Cost
- Commits from 2026-10-19 11:22 local (design) to 22:55 local (80a5fa3b); two compactions by the host.
- gentle-ai: slice 1 reviewed (review-b72c1389cbb96396), slice 2 reviewed (review-296d60b1e90da71e, lenses risk and
  resilience); every other code commit assessed under_budget.
- Codex: slice 1 and its recheck; slice 2 (4 parts, 757k input tokens), its recheck (103k) and 80a5fa3b (94k).
- The trial ran three times on a scratch home, each downloading the Codex CLI and codegraph.
