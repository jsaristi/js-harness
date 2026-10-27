# F8 directives pass: the plan's directives written into CLAUDE.md and AGENTS.md

Locator: `odd/tasks/f8-directives.md` · Engram mirror: `odd/f8-directives/tasks` · Branch: `rule/f8-directives` (from `worktree-f8-directives`)
Delivery: one pull request from the `rule/` branch, holding the budget's change and both files (L3) · Test runner: `node --test`

## Goal
Every directive of the plan that a session here acts on, gentle-ai's kept lines and the js-harness
protocols, is written out in this repo's `CLAUDE.md` and `AGENTS.md`, so the repo works by the
directives it ships before S1 starts.

## Why
His choice "Justo después de S3 (Recomendada)" (L12 of `odd/tasks/f8-s3-split.md`, transcript
`e41d1e8d`): the old project failed for its structure, and the plan's directives are only dogfooded
when the files a session loads on every turn state them, not when they name a skill section. When
S2 removes gentle-ai, S10's sizing text has to be here already.

## Done when
- `node --test bin/lib/template-block.test.mjs bin/lib/protocols-skill.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-directives.md` exits 0
- `npm run check` exits 0, `claude-md budget` and `agents budget` rows included
- `js-harness merge-queue --dry-run` lists the pull request as ready, and Codex has no open finding

## In scope / Out of scope
- In: `CLAUDE.md`, `AGENTS.md`, `docs/ROADMAP.md` (F8 step 4), this document; `bin/lib/rules-data.mjs`
  and its sources only on a `rule/` branch, only if question 97 raises the budget.
- Out: permissions, skills and S2 (the brief); the template `init` ships (`bin/lib/project.mjs`) —
  its block's bytes are pinned for every project (`bin/lib/template-block.test.mjs`) and S10 and S12
  move projects; `~/.claude`, `~/.codex` and gentle-ai's config.

## Constraints
- The two files name the same rule ids as the shipped block (`bin/lib/template-block.test.mjs:38`) —
  so the new text names no `rule:` id the block does not.
- `CLAUDE.md` is held to `rule:claude-md-budget` and `AGENTS.md` to `rule:agents-budget` — a budget
  is raised only on the orchestrator's answer, never by this session (the brief).
- `AGENTS.md` holds what a reviewer needs (D3); how Claude works with him stays in `CLAUDE.md`.

## Ask me before
The budget (question 97). Nothing else is his here.

## Specs
- S1 (brief): "S10's text part: the ODD sizing test and the feature document's order, written as this
  repo's own directives."
- S2 (brief): "The js-harness protocols written into `CLAUDE.md` in their own words, not only named by
  section."
- S3 (brief): "`AGENTS.md` per D3."
- S4 (brief): "First step, before any edit: the S3 promise check ... report, in your feature document's
  Log and in a `note` notice, whether the project's `CLAUDE.md` loaded once, `AGENTS.md` once (through
  the import), and whether the user-level `C:\Users\Oficina\.claude\CLAUDE.md` (gentle-ai's global
  file) is absent."

## Where each protocol went
| Protocol (`js-harness-protocols`) | Home | Why there |
|---|---|---|
| 1 Asking him | `CLAUDE.md`, "Working with Sebastián" (S3, kept) | how Claude works with him |
| 2 Closing a reply | `CLAUDE.md`, "Working with Sebastián" (S3, kept) | the same |
| 3 Running what costs | `CLAUDE.md`, "Running what costs, and review" | a session's own acts |
| 4 Changing a rule | `AGENTS.md`, "How the repo works" | a reviewer judges a rule change by it |
| 5 Reporting a mistake | `CLAUDE.md`, "Reporting" | a session's report to him |
| 6 Handing off | `CLAUDE.md`, "Reporting" (replaces the pointer to section 6) | the same |
| 7 Throughput | `CLAUDE.md`, "Reporting" | a lead's or session's review |
| 8 Writing new code | `AGENTS.md`, "What good looks like" | what a reviewer checks in a diff |

The skill keeps every section: it carries each incident and date, and projects without these lines
read it.

## Tasks
- [x] T0 (kind: verify) the S3 promise check — S4; inline; note notice 2026-10-27T13:57:54Z, L1
- [x] T1 (kind: build) the sizing test and the feature document's order in `CLAUDE.md` — S1; inline; the `CLAUDE.md` commit
- [x] T2 (kind: build) protocols 3, 5, 6 and 7 in `CLAUDE.md`, 4 and 8 in `AGENTS.md` — S2, S3; inline; 10e1b4d7 and the `CLAUDE.md` commit
- [x] T3 (kind: docs) this document and the roadmap's F8 step 4 — all; inline; 10e1b4d7 and the `CLAUDE.md` commit
- [x] T4 (kind: build) `claude-md-budget` 2500 → 3200 by question 97's answer, `rules change` on `rule/f8-directives` — S2; inline; 3c70f91c
- [x] T5 (kind: verify) `npm run check`, Codex per slice, push, pull request, ready notice — all; inline; PR 606

Reviews:
- gentle-ai on `59df62f7..10e1b4d7`: medium, not due (under_budget, 104 lines); Markdown only, so no Codex record is due.
- gentle-ai on `10e1b4d7..3c70f91c`: medium, not due (under_budget, 19 lines).
- gentle-ai on `59df62f7..cfe1291f`: medium, not due (under_budget).
- Codex on `10e1b4d..cfe1291` (the one code commit, 3c70f91c): the patch is correct (0.98), no findings, recorded; 57,314 input tokens.

## Log
- L1 (2026-10-27, S3 promise check, session started on 59df62f): the instruction files this session's
  context loaded are the worktree's `CLAUDE.md`, once, and its `AGENTS.md`, once, through the import;
  no file of the main checkout `D:\js-harness` loaded. The user-level `C:\Users\Oficina\.claude\CLAUDE.md`
  exists on disk (92641 bytes, 2026-10-26 04:40) and did **not** load: `claudeMdExcludes:
  ["**/.claude/CLAUDE.md"]` in `.claude/settings.json` holds its promise. Still loading, from
  settings rather than that file: the Gentleman output style and its Spanish language block (S10's to
  replace) and the auto-memory index `MEMORY.md`. Sent as a `note` notice at 08:57 local.
- L2 (2026-10-27): drafted on the branch and measured with `estimateTokens` of `bin/lib/payload.mjs`:
  `CLAUDE.md` 2483 → 3108 of 2500, `AGENTS.md` 644 → 971 of 1500. Protocols 4 and 8 went to
  `AGENTS.md` because a reviewer needs them (table above); the rest is how a session acts, so D3 keeps
  it in `CLAUDE.md`. It does not fit: asked as question 97 (raise to 3200, recommended; cut the A.1
  lines; or pointers only).
- L3 (2026-10-27, JH ORQ relaying question 97; read with `js-harness sessions --quote
  0f71b2c6-cbce-43ca-a031-276a4b2c381f 535`, 15:51:24Z, tapped through the question tool): "Subir a
  3200 (Recomendada)". `claude-md-budget` is the project's rule, not his, so its source is this
  document (design), and `rules change` took it (3c70f91c). One pull request carries the whole pass
  from `rule/f8-directives`, branched from `worktree-f8-directives`: `rules change` needs only
  `origin/main` under it, and `CLAUDE.md` could not pass the gate on any branch before the budget
  moved. "Reporting" sits after "Working with Sebastián", in D3's order. `CLAUDE.md` measures 3108 of 3200.
- L4 (2026-10-27): the engram mirror saved under the project "f8-directives" (observation 5843):
  the hook bound this session to the worktree's folder name, and a save with `project: js-harness`
  is refused as `session_project_mismatch`. The file here is the copy that counts.
- L5 (2026-10-27, 11:18 local): the machine ran critically low on memory and the host killed the
  `CLAUDE.md` commit mid-gate; nothing was half-written (the slice stayed staged). Restarted on the
  orchestrator's "go" (11:35, 6.4 GB free) as cfe1291f.
