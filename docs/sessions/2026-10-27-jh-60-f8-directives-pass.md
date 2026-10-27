# JH 60 · F8 directives pass

File: docs/sessions/2026-10-27-jh-60-f8-directives-pass.md.

## Goal
F8 step 4's directives pass, between S3 and S1 (`docs/ROADMAP.md`, F8 step 4): every directive of the plan,
gentle-ai's kept lines and the js-harness protocols, written into this repo's `CLAUDE.md` and `AGENTS.md`;
S10's text part (the ODD sizing test and the feature document's order); `AGENTS.md` per D3. First, the S3
promise check. The brief came from JH ORQ
(`~/.js-harness/background/briefs/2026-10-27T13-55-56-410Z-0087d1d2.md`).

## The user's words
- The pass itself, relayed by JH ORQ (`odd/tasks/f8-s3-split.md`, L12; transcript e41d1e8d): "Justo después de
  S3 (Recomendada)".
- Question 97, read with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 535`
  (15:51:24Z, tapped through the question tool): "Subir a 3200 (Recomendada)".

## Delivered
- PR 606, `rule/f8-directives`, ready (`notify --kind ready` accepted at 11:43 local), not merged:
  - 10e1b4d7: protocols 4 and 8 in `AGENTS.md` (971 of 1500 estimated tokens).
  - 3c70f91c: `claude-md-budget` 2500 → 3200, by `js-harness rules change`, source design.
  - cfe1291f: S10's sizing test, the document's order, protocols 3, 5, 6 and 7 in `CLAUDE.md` (3108).
  - 521d9c31 and this commit: the review records and this summary.
- `worktree-f8-directives` on origin holds only 10e1b4d7, pushed as a safeguard while question 97 waited; PR 606
  supersedes it.
- Feature document: `odd/tasks/f8-directives.md` (T0-T5 done, L1-L5).
- The S3 promise check (L1; `note` notice at 08:57 local): the worktree's `CLAUDE.md` and `AGENTS.md` loaded once
  each, nothing of the main checkout loaded, and `C:\Users\Oficina\.claude\CLAUDE.md` did not load.

## Decisions
- The budget at 3200: his, question 97, `odd/tasks/f8-directives.md` L3.
- Protocols 4 and 8 in `AGENTS.md`, the rest in `CLAUDE.md`: this session, the document's "Where each protocol
  went" table, by D3.
- One pull request from the `rule/` branch carrying both files: this session, L3, because `CLAUDE.md` cannot pass
  the gate before the budget moves and `rules change` needs only `origin/main` under it.
- The shipped `init` template left untouched (its block's hash is pinned): this session, "In scope / Out of scope".

## Failures and lessons
- A `Monitor` filtered on `"question":97` missed the orchestrator's answer, which came as a `note` naming the
  question in its text; `js-harness wait --notice-to 60`, which the Stop hook names, is the wait to arm.
- The host killed the `CLAUDE.md` commit mid-gate when the machine ran low on memory (11:18 local); it was
  restarted only on the orchestrator's "go" (L5).
- Engram bound this session to the project "f8-directives" (the worktree's folder name) and refused a save to
  `js-harness` (`session_project_mismatch`), so the mirror sits under the wrong project (L4).

## Left
- The land of PR 606: JH ORQ, through the merge queue.
- The engram mirror under "f8-directives" (observation 5843): whoever owns engram's project binding.
- S1 next, by the roadmap's F8 step 4.

## Cost
- Time: first notice 08:57 local (13:57Z), ready 11:43 local; about 2h of it was waiting on question 97 and 20
  minutes on the memory stop.
- Context: 40 percent at the ready notice.
- Reviews: Codex once, 10e1b4d..cfe1291, 57,314 input tokens (31,360 cached), 36 s; gentle-ai assessments only,
  no review due.
- Gate runs: 5 commits through the pre-commit gate, one of them killed by the host; one `check` by hand.
