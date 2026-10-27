# F8 S3: the CLAUDE.md/AGENTS.md split and the interim exclusion

Locator: `odd/tasks/f8-s3-split.md` · Engram mirror: `odd/f8-s3-split/tasks` · Branch: `claude/f8-s3-split-251472`
Delivery: three pull requests (this feature, the exclusion alone, one `rule/` branch) · Test runner: `node --test`

## Goal
Claude works from a root `CLAUDE.md` that imports `@AGENTS.md` and holds the kept lines of
gentle-ai's global file, `AGENTS.md` holds only what a reviewer needs, `init` ships the same split,
and this repo stops loading the global file, so each turn and subagent pays about 30.7k less.

## Why
His answer D3 (diet section 1): Claude is the harness's only worker and Codex is an outside reviewer
("codex es un revisor externo no mas", transcript `e41d1e8d`, line 1697). The global file is 30.7k of
a 105.5k first turn (S0 baseline); S3 banks that saving before the replacements land (diet section
10, seventh pass), and S2 reverts the exclusion when gentle-ai leaves.

## Done when
- `node --test bin/lib/project.test.mjs bin/lib/payload.test.mjs scripts/practice-lib.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s3-split.md` exits 0
- `npm run check` exits 0
- `node -e "const s=require('./.claude/settings.json');process.exit(JSON.stringify(s.claudeMdExcludes)==='[\"**/.claude/CLAUDE.md\"]'?0:1)"` exits 0 (on the exclusion's branch)
- `## Incident rerun` below records S3's incident score against L 13 (worse below 10)
- `js-harness merge-queue --dry-run` lists each pull request as ready, and Codex has no open finding

## In scope / Out of scope
- In: `CLAUDE.md` (new, root), `AGENTS.md`, `bin/lib/project.mjs` (init's split), `bin/lib/payload.mjs`
  (`claudeMdExcludes`), `bin/lib/protocols-skill.mjs`, `bin/lib/manifest.mjs`, `bin/check.mjs` (the
  `claude-md-budget` row), `bin/lib/rules-data.mjs` and its sources (on the `rule/` branch only),
  `scripts/practice*.mjs`, `.claude/settings.json` (new), `docs/ROADMAP.md`, the diet, this document.
- Out: `~/.claude`, his global `CLAUDE.md`, gentle-ai and host configuration — his, and the brief says
  so; other sessions — the orchestrator checks the exclusion's effect after the merge; migrating an
  existing project's `AGENTS.md` — S12 builds that; `rule:memory-feedback-home` reads only `AGENTS.md`
  — named below as left.

## Constraints
- A rule of his changes only with his typed words (`bin/lib/rules-change.mjs:232` refuses a tapped
  answer) — so D5, answered by a tap, waits (L3).
- `bin/lib/rules-data.mjs` changes only on a `rule/` branch — the merge door refuses it elsewhere.
- The exclusion is one commit in its own pull request — so S2 undoes it with one revert on `main`.
- Never read, copy or move a credentials file — the evals log in with `JS_HARNESS_EVAL_OAUTH_TOKEN` only.

## Ask me before
Nothing new: D2 has no cap, and the incident rerun (~$13) is in its table.

## Specs
- S1 (brief): "The root `CLAUDE.md` imports `@AGENTS.md` and holds A.1's kept lines below the
  import. It goes at the repo root, never in `.claude/CLAUDE.md`."
- S2 (brief): "`AGENTS.md` shrinks to what a reviewer needs."
- S3 (brief): "`init` ships the same split to projects."
- S4 (brief): "A declared rule `claude-md-budget` with its own `check` row, set to the file's measured
  size rounded up to the next 100. `rule:agents-budget` stays untouched."
- S5 (brief): "The Decided row \"Portable by default\" in the roadmap and `rule:rules-live-in-the-harness`
  are rewritten for the split."
- S6 (brief): "D5: narrow `rule:double-review` to proposals that change one of his decisions."
- S7 (brief): "D7: apply every default of item 7, his reply rules."
- S8 (brief): "Interim exclusion: `claudeMdExcludes: [\"**/.claude/CLAUDE.md\"]` in a committed
  `.claude/settings.json` in this repo only, and the `payload` row taught to read it
  (`bin/lib/payload.mjs:232-246`)."
- S9 (brief): "Then run S3's incident rerun once against the baseline ... Report the real cost."

## Tasks
- [ ] T1 (kind: docs) this document — all; inline
- [ ] T2 (kind: build) `init` writes `AGENTS.md` and `CLAUDE.md` split; `sync` renders each block; a legacy `AGENTS.md` keeps its whole block; the practice script follows; test first — S3, S6 (template line); inline
- [ ] T3 (kind: build) this repo's root `CLAUDE.md` and the smaller `AGENTS.md`; the protocols skill names both files — S1, S2, S7; inline
- [ ] T4 (kind: build) `payload` honours `claudeMdExcludes` from the settings layers; test first — S8; inline
- [ ] T5 (kind: build) `.claude/settings.json` with the exclusion, on its own branch — S8; inline
- [ ] T6 (kind: build) `rule/` branch: `claude-md-budget` and its `check` row (test first); `rules-live-in-the-harness` rewritten — S4, S5; inline
- [ ] T7 (kind: docs) the roadmap's "Portable by default" row and F8 step 4 — S5; inline
- [ ] T8 (kind: verify) the incident rerun on `current-without-claude-md`, recorded against the baseline — S9; inline
- [ ] T9 (kind: verify) `npm run check`, Codex per code slice, gentle-ai per slice, push, PRs, notify — all; inline

## D7 applied
Every default of the diet's item 7 (his "Aceptar todo", transcript `e41d1e8d`, line 3733):
- "Response-length contract: default to short answers. ..." (global file 38) and "If unsure about length or detail, choose the
  shorter response." (41): dropped.
- "Ask at most one question at a time. After asking it, STOP and wait." (39) and "When asking a
  question, STOP and wait for response. Never continue or assume answers." (42): replaced by "One
  question at a time; keep doing what does not depend on the answer."
- "**Self-check BEFORE every response**" (56): dropped.
- "Never agree with user claims without verification. ..." (43): replaced by "Verify a claim before
  building on it."
- "Prefer the agent's native file-reading, search, and editing tools. ..." (37) and "Do not present
  option menus ..." (40): kept word for word.
- "Always propose alternatives with tradeoffs when relevant." (45): dropped.

## Log
- L1 (2026-10-27, the brief from JH ORQ): You are JH 59, a work session of js-harness led by the
  orchestrator, JH ORQ. Your task is F8 step S3: the CLAUDE.md/AGENTS.md split and the interim
  exclusion, with Sebastián's answers D3, D5 and D7 applied. (Scope, how and done-when as quoted in
  `## Specs`; the brief also asks: tests first; every rule change through `js-harness rules change
  <id>` on a `rule/` branch cut from origin/main; Codex per code slice; gentle-ai per slice with
  `--committed-only`; push and open PRs, never merge; notify the orchestrator when `merge-queue
  --dry-run` lists them ready.)
- L2 (2026-10-27, design decisions):
  - Three pull requests. The exclusion is `.claude/settings.json` alone, so S2's undo is one revert
    and nothing else rides with it. The rule changes are one `rule/` branch: the command refuses a
    second open `rule/` branch (`bin/lib/rules-change-run.mjs`, "one change is open at a time"), and
    one branch may hold several ids. The `claude-md-budget` row rides with its declaration and
    reports nothing while a project has no `CLAUDE.md`, so either pull request may land first.
  - `init` in a project with neither file writes both: `AGENTS.md` with the "What good looks like"
    block, `CLAUDE.md` with `@AGENTS.md` and the "Working with the owner" block. A project that has
    an `AGENTS.md` gets no `CLAUDE.md` (S12 migrates it), and `sync` keeps rendering the whole block
    in an `AGENTS.md` whose project has no harness block in `CLAUDE.md`, so no project loses a line
    before it is moved.
  - The incident rerun uses the arm `current-without-claude-md` (`evals/without.mjs:237` removes the
    scratch home's global file), which is what the exclusion does, with this checkout's `init`.
- L3 (2026-10-27): D5 is blocked. His "Acotarla" (`e41d1e8d`, line 3709) and D7's "Aceptar todo"
  (line 3733) were tapped answers, which `rules change` refuses as the source of a rule of his, and no
  typed line of his on D5 was found in that transcript. D7 needs no rule change (its lines live in
  `CLAUDE.md`, not in a declared rule). Told the orchestrator; `rule:double-review` and the template's
  two-readers line stay as they are until his typed words or its call.
