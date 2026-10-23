# launch-audit

The pre-launch audit of the whole harness, and its single ledger: every finding of every stage has one row here, by a stable id.
Audit sha `3f25784af07d6c1385e7c5b67b8855f1dbe033cd` (origin/main on 2026-10-23); stage 7 audits the diff since it. Delivery: one pull request per slice, landed by the merge queue. Runner: `node --test`.

## Goal
Before the 1.0.0 tag, every live file of js-harness has been read against what it claims, every instruction it gives a model has been checked for duplicates, contradictions and dead orders, and every finding is fixed or carried by name with why.

## Why
Launch means the 1.0.0 tag (`odd/tasks/release-095.md`, T4), which waits until he calls a commit definitive; once a commit is definitive, what it says is what users and models get. He asked for an audit that tells the truth in depth (S1), and the harness's own principle is that a line paid on every turn must earn it.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/launch-audit.md` exits 0
- `node --test scripts/inventory.test.mjs` exits 0
- `node scripts/inventory.mjs --check` exits 0
- Every row of "Findings" is fixed (with its commit) or carried (with why and where), and stage 7's report is in the Log.

## In scope / Out of scope
- In: every tracked file (by its class, S4); the auto-memory notes of this project, which load every turn; the texts the harness installs (skills, hook outputs, guard messages).
- Out: gentle-ai, engram and codegraph texts and configuration — a conflict with them is reported, never edited (ROADMAP, "Stack visibility").
- Out: the 1.0.0 tag and any npm publish — his (release-095 T4).
- Out: a whole-file Codex mode — not built (S2).

## Constraints
- This document has one writer, the session that runs stages 0–2 or the lead after it; sessions 2–4 write their findings to `odd/tasks/launch-audit/<area>.md`, merged here by id — because two writers of one ledger lose rows to each other.
- A settled item is reopened only with current contradicting evidence (path:line or a command and its output) — because an audit that relitigates closed work spends without finding.
- Deterministic findings are fixed directly, test first, in slices of about 400 lines; judgment findings (stages 3–4) go through a refuter first — because a mechanical fact needs no debate and an opinion does.
- Every removal of an instruction is one component at a time, undoable, and proven by a discriminating eval probe — because a line that looks dead may be what keeps a behavior.
- Nothing is removed from a check, test or review to make the work fit (ROADMAP principle 7).

## Ask me before
- Spend past this plan: stages 3–4 are budgeted at about 2 instruction readers and 10 area readers (Opus, high) plus refuters.
- The wording of `AGENTS.md`, moving a rule to "one home", and deleting a memory note.
- The 1.0.0 tag and any publish.

## Specs
- S1. His request (2026-10-23, lead transcript `908805db-d0b9-4c2f-a9e6-f828b6bf1e41`): "Ahora quiero que hagamos un auditoria completa y extensa e incluso con revision de codex de todo el harnes y quiero que me des un plan bien hecho de que revisar como ultima revision antes del lanzamiento, osea quiero ver si todo esta bien escrito, en orden, sin contradicciones, optimizado osea no tenga duplicacion de ordenes o ordenes que no sirvan. Mejor dicho quiero que me hagas una auditoria que realmente nos diga en profundida todo y esto que te dije es de ejemplo dime enrealidad como la debemos hacer?"
- S2. His decision, Pregunta 55 (same transcript, line 23199): "Sí, Codex en cada arreglo (Recomendada)". Codex reviews every fix slice of the audit through the existing `js-harness codex-review` flow; no whole-file Codex mode is built.
- S3. Stage 0: the audit sha is recorded above; every open record on the subject is imported below with a stable id and a verdict read against the current bytes (I-*).
- S4. Stage 1: every tracked file has one row in `odd/tasks/launch-audit/inventory.tsv` with its class (`live`, `history`, `generated`, `fixture`, `internal`, `compatibility`) and, for `live` and `internal` files, the stage-4 area that reads it. `scripts/inventory.mjs --check` fails on a tracked file with no row (missing), a path with two rows (duplicate), a row whose file is not tracked (stale), and an unknown class or area; it prints the counts per class and per area, and how many rows hold a verdict. File coverage is not behavioral coverage; stage 7 reports both.
- S5. Stage 2: the mechanical checks, reusing the gate rows (`spec`, `bin/readme.test.mjs`, `rules check`, `load`, `budget`, `bin/lib/citations.mjs`) and building only what is new: citations over the whole live tree; flag parity by behavior; exports with no importer; protocol expiry; public-repo hygiene over git history with an allow-list. Their findings are M-* rows.
- S6. Stages 3–7, run by sessions 2–4 and the lead, follow `launch-audit-plan-v2.md` (side-session notes of the lead); their findings come back as N-* (instructions), C-<area>-* (code) and B-* (behavior) rows.

## Tasks
- [x] T1 (kind: docs) (S1-S3) Stage 0: the audit sha, this ledger, the imports verified. Route: inline.
- [ ] T2 (kind: build) (S4) Stage 1: the inventory and its coverage checker, with negative fixtures. Route: inline.
- [ ] T3 (kind: build) (S5) Stage 2: the mechanical checks that are new, each test first. Route: inline.
- [ ] T4 (kind: build) (S5) Stage 2: the deterministic findings fixed in slices, each with gentle-ai and Codex. Route: inline.
- [ ] T5 (kind: verify) (S4, S5) The report that starts stages 3–5: counts per class and per finding kind. Route: inline.
- [ ] T6 (kind: verify) (S6) Stage 3, the instruction audit (session 2). Route: delegated readers.
- [ ] T7 (kind: verify) (S6) Stage 4, the code review by area (session 3). Route: delegated readers.
- [ ] T8 (kind: verify) (S6) Stage 5, behavior (session 4). Route: per-action workers.
- [ ] T9 (kind: build) (S6) Stage 6: confirm, fix in slices, re-check. Route: per its size.
- [ ] T10 (kind: verify) (S6) Stage 7: sign-off on the final sha, the diff since the audit sha included. Route: inline.

## Ids
- `I-<source>-<id>`: a record imported in stage 0. `HR` harness-review, `RH` rule-hierarchy, `SW` the sweep of 2026-10-11 (its reader ids), `RM` the ROADMAP.
- `M<n>`: a mechanical finding of stage 2. `N<n>`: an instruction finding of stage 3. `C-<area>-<n>`: a code finding of stage 4. `B<n>`: a behavior finding of stage 5.
- Status: `open`, `fixed <commit>`, `carried <where, why>`, `closed <evidence>` (the place no longer says it), `wrong <why>`.

## Imported (stage 0)
Each verified against the bytes at the audit sha on 2026-10-23.

### harness-review
- I-HR-T0 · open, carried to T10. Which open tasks close before 1.0.0 and which are carried with his yes. Its first list (harness-review L45) named v0.9.0 and v1.0.0; the tags since are v0.9.0, v0.95.0, v0.96.0, v0.97.0 (`git ls-remote --tags origin`), and 1.0.0 is release-095 T4. Open on the audit sha, from `js-harness progress`: backup-ready T9; conventions T8; F2 T5 and fixed-load T6 (gentle-ai #4036); future-model T8, T9; held-sessions T3; onboarding T4, T5; release-095 T4; rule-hierarchy T1, T8, T11, T16, T16f; session-channel T11; stack-install T6, T7; terminal-note T3; and the ROADMAP rows "The lead's manual steps are commands with tests", "Every command reviewed…" (I-RM-1), the VM rehearsal of "Memory that survives the machine", onboarding's design, conventions parts 1 and 2.
- I-HR-L48a · closed by the skill and the board: the archive retry. The board lists `to archive` and the orchestrator skill archives again after turning Remote Control off (`bin/lib/manifest.mjs:209`); archiving is the desktop app's alone, so no command can retry it (harness-review L53).
- I-HR-L48b · open, to stage 4 area c: the opening of a cleared session. The resume hook still fires on `compact` only (`bin/lib/manifest.mjs:416`); the probe of harness-review L12 found a clear starts with source `startup`.
- I-HR-L48c · open, to stage 4 area b: the Codex meter (e4). No command reads `account/rateLimits/read` (`grep -rn "rateLimits\|app-server" bin` finds only clean's release folders and tests); the memory note `codex-meter-is-readable.md` points to a scratchpad script.
- I-HR-L48d · open, to stage 4 area b: retargeting a stacked pull request after its base lands (e16). `merge-queue` lists only pull requests based on main (`bin/merge-queue.mjs:848`); nothing retargets (`grep -rn retarget bin`).
- I-HR-L48e · open, to T4: DEP0190. `bin/update.mjs:405` and `:531` pass an argument array with `shell: true`; `bin/lib/package-manager.mjs:22-27` already shows the form Node does not warn on.
- I-HR-L48f · open, to T4: a committed test of the pre-push hook's `--ref` for a version tag. `.githooks/pre-push:21-23` passes it; `bin/pre-push-hook.test.mjs` has no case with a `refs/tags/v*` line (the check's own `--ref` is tested at `bin/check.test.mjs:5705`).
- I-HR-L15 · closed: R1-001 (`bin/update.mjs:427` refuses `"` and `%` on Windows) and R1-002/R4 (`pnpmRunning`, `bin/update.mjs:158`) are in the code.
- I-HR-L26 · closed: R4-001; a setting whose write failed is reported apart and keeps its record (`bin/lib/manifest.mjs:1621`, `bin/install.mjs:556`).

### rule-hierarchy
- I-RH-T16 · carried, his: one home for every rule. Its redesign stays in `odd/tasks/rule-hierarchy.md`; stage 3 reports where each rule's homes stand today and adds no home.
- I-RH-T16f · carried, his: the turn-start hook's reach. Stays in `odd/tasks/rule-hierarchy.md`.

### ROADMAP
- I-RM-1 · open, to T3 and T7: "Every command reviewed against its help, README and SPEC, and every finding fixed or written down" (`docs/ROADMAP.md:220`). Stage 2's flag parity is its mechanical half; stage 4 its reading half.

### The sweep of 2026-10-11
47 items were open in `docs/sweep-2026-10-11.md`. Each was checked for its file and for the quoted "Says:" text (a scratch script; the counts: 17 still stand, 18 quotes gone, 8 files gone, 4 machine places).
- Still standing, to stage 3 (instructions; the wording of AGENTS.md and his memory notes is his): I-SW-A2-52 (`docs/ROADMAP.md:366`), I-SW-A1-10, I-SW-A1-12, I-SW-A1-14, I-SW-A1-27 and I-SW-CD-2 (the same place as A1-12) (`AGENTS.md`), I-SW-A1-28 (`bin/lib/contract.mjs`, the template's "Ask me before"), I-SW-CD-39 (`claude-models-2026-10.md`), I-SW-CD-37 (`hidden-load-slows-gates.md`).
- Still standing, history only (the reference check): I-SW-A3-89 (`odd/tasks/session-channel.md`).
- Still standing on his machine, outside the repository, the lead's: I-SW-B-23 (`launch-session.ps1`), I-SW-B-17, I-SW-B-18, I-SW-B-19 (`~/.claude/settings.json`), I-SW-B-21, I-SW-B-22 (orca worktrees' AGENTS.md), I-SW-B-28 (`D:\js-harness-worktrees\codex-parity`), I-SW-B-20 (`D:\js-harness-worktrees\practice-project`), I-SW-B-24 (`D:\js-harness-worktrees\session-board`).
- Closed, the quoted text no longer stands: I-SW-A1-13 (`AGENTS.md`), I-SW-CD-15, CD-18, CD-19, CD-27, CD-28, CD-40, CD-41 (`cross-session-prompts.md`), CD-38 (`MEMORY.md`), CD-26, CD-33 (`notify-when-done.md`), CD-13, CD-14, CD-32, CD-36 (`one-prompt-per-reply.md`), CD-9, CD-16, CD-24 (`orchestrator-autonomy-charter.md`).
- Closed, the file is gone: I-SW-CD-23, CD-29, CD-30, CD-31 (`main-session-orchestrates.md`), CD-7, CD-35 (`merge-from-chat.md`), CD-42 (`subagent-effort-high.md`), CD-20 (`work-continuously.md`), I-SW-B-25 (`D:\js-harness-worktrees\subagent-model-routing`).
- Not checked: I-SW-CD-43, the orchestrator's relief file, line 4 (a dated record of the lead's).

## Findings
Stage 2 onward; one row per finding, newest last.

## Log
- L1. 2026-10-23, his request, S1 verbatim; the plan he approved is `launch-audit-plan-v2.md` in the lead's side-session notes, after two readers (Opus on its claims, Codex on its gaps). His decision on Codex, S2.
- L2. 2026-10-23, stage 0. Audit sha 3f25784a. harness-review T0 and T6's leftovers moved here (I-HR-*), so they are counted once; the sweep and the ROADMAP row point here. Codegraph initialized in the worktree for stage 2's callers.
