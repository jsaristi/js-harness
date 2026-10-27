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
- [x] T1 (kind: docs) this document — all; inline; 9d07f7a6 and the commits after it
- [x] T2 (kind: build) `init` writes `AGENTS.md` and `CLAUDE.md` split; `sync` renders each block; a legacy `AGENTS.md` keeps its whole block; the practice script follows; test first — S3, S6 (template line); inline; b94f525f
- [x] T3 (kind: build) this repo's root `CLAUDE.md` and the smaller `AGENTS.md`; the protocols skill names both files — S1, S2, S7; inline; b94f525f
- [x] T4 (kind: build) `payload` honours `claudeMdExcludes` from the settings layers; test first — S8; inline; 18260036, f49b5749
- [x] T5 (kind: build) `.claude/settings.json` with the exclusion, on its own branch — S8; inline; ff716e6c on `claude/f8-s3-exclude`, PR 603
- [x] T6 (kind: build) `rule/` branch: `claude-md-budget` and its `check` row (test first); `rules-live-in-the-harness` rewritten — S4, S5; inline; 18083c91, e5e36473, f4c058c8 on `rule/f8-s3-split`, PR 602
- [x] T7 (kind: docs) the roadmap's "Portable by default" row and F8 step 4 — S5; inline; b94f525f and this commit
- [x] T10 (kind: build) the root `CLAUDE.md` states the two every-turn protocols in a few tight lines: how to ask him (protocols section 1) and how to close a reply (section 2, the five states); re-measure `claude-md-budget` after (on PR 602 if the value moves) — L9; inline
- [x] T11 (kind: build) `AGENTS.md` holds exactly what diet D3 gives a reviewer: what the project is, how the repo works, what good looks like; everything about how Claude works moves to `CLAUDE.md`, in the plan's order — L9; inline
- [x] T8 (kind: verify) the incident rerun on `current-without-claude-md`, recorded against the baseline — S9; inline
- [ ] T9 (kind: verify) `npm run check`, Codex per code slice, gentle-ai per slice, push, PRs, notify — all; inline

## D7 applied
Applied in b94f525f, taken out again (L8) and put back (L11): every default of the diet's item 7 (his "Aceptar todo", transcript `e41d1e8d`, line 3733):
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
- L4 (2026-10-27, after a host compaction at 07:01 local): T4 done test first: `payload` reads
  `claudeMdExcludes` from the user, project and local settings layers, lists a matched `CLAUDE.md` as
  excluded with no tokens, and `check` prints it as "excluded (claudeMdExcludes)". The first full
  gate found `bin/lib/project.mjs` 52 lines over its ceiling and `scripts/practice-lib.mjs` 4 over:
  the template block moved out to `bin/lib/project-template.mjs` (re-exported, so no importer
  changes) and the ceiling went down to 1984; the practice lines were folded back to 1174. On the
  `rule/` branch the `claude-md-budget` row lives in `bin/lib/claude-md-budget.mjs`, so
  `bin/check.mjs` stays at exactly its ceiling of 2110 lines and the two branches change no adjacent
  ceiling lines. The rule's value is 2300: this repo's `CLAUDE.md` measures 2239 estimated tokens.
- L5 (2026-10-27): the incident rerun cannot run `current-without-claude-md` alone: the suite refuses
  an arm without its base (`evals/suite.mjs:218`), so it runs `current` beside it, about $22
  API-equivalent instead of about $13; within D2, decided, and the orchestrator told. The `current`
  half measures the split without the exclusion.
- L6 (2026-10-27): Codex on the split, 9d07f7a..b94f525, in two parts: correct (0.86, 0.88), no findings. Codex on
  the payload slice, b94f525..1826003: incorrect (0.9), one P2: excluding a project's root `CLAUDE.md` still counted
  the `AGENTS.md` it imports; fixed test first in f49b5749, and the recheck of 1826003..f49b574 found it fixed (0.97).
  The rule branch and the exclusion each carry their own document and lines (PRs 602 and 603).
- gentle-ai on `9d07f7a6..b94f525f`: medium, not due (under_budget, 563 lines, executable_change), assessed in a
  detached worktree at b94f525f since `assess` reads to HEAD.
- gentle-ai on `b94f525f..18260036`: medium, not due (under_budget, 99 lines).
- gentle-ai on `18260036..f49b5749`: medium, not due (under_budget, 27 lines).
- L7 (2026-10-27), what is left after these pull requests land:
  - the `/context` check after a restart, that the global file no longer loads and the root `CLAUDE.md` does;
  - the fixed load measured over five sessions against the S0 row;
  - D5 (`rule:double-review`), waiting for his typed words (L3);
  - follow-ups: `rule:memory-feedback-home` and the memory guard (`bin/guard.mjs`,
    `bin/lib/memory-feedback-guard.mjs`) read only `AGENTS.md` phrases; and D7's "keep doing what does not depend on
    the answer" sits beside `rule:reply-five-states`' "never while work runs", which the orchestrator should reconcile.
- L8 (2026-10-27, JH ORQ): "D5 now has his typed words. Use the excerpt \"si\", transcript
  e41d1e8d-8264-45a4-b16c-f9279f7b6076, line 7461 ... D7 is still tapped only: keep it pending until I send his
  typed words, unless your D7 changes already have a typed source." They have none, so `CLAUDE.md` drops the four
  lines D7 gave (A.1 keeps none of the global lines 37-43, 45 and 56 until D7) and says they wait. The
  `claude-md-budget` value stays 2300, the file's size once D7's lines return. D5 goes through
  `js-harness rules change double-review` on `rule/f8-s3-split` (PR 602). The template's two-readers line
  (`claudeBlock` in `bin/lib/project.mjs`) stays: narrowing it re-renders every project's block, a follow-up.
- L9 (2026-10-27, JH ORQ relaying his typed words, transcript e41d1e8d-8264-45a4-b16c-f9279f7b6076, line 7551, question 95): "Si ambas cosas pero sacamos todo lo del plan lo organizamos bien en agents colocamos lo que vamos a colocar para codex como dice el plan como para tener un orden por que a la final el trabajo definitivo se va a hacer gracias a todo lo que vamos a ejecutar con el plan, ya que todo nos esta fallando por culpa de la estructura y arquitectura erronea que le di al proyecto viejo". The orchestrator asks, before PR 604 is listed ready: T10 and T11. D7 still waits for his typed words. After S3 lands it starts a new orchestrator on these directives. Land order already sent: 602, then 604, then 603.
- L10 (2026-10-27): T10 and T11. `CLAUDE.md` now follows D3's order: how sessions run, working with him (with how to ask him, section 1, and how to close a reply, section 2, in its own words, naming `rule:questions-one-place` and pointing at `bin/lib/reply.mjs` for the state words rather than restating them; `rule:reply-five-states` is not named, because `bin/lib/template-block.test.mjs` holds this repo to the rule ids the shipped block names), review, then the kept lines. From `AGENTS.md` it took the session handoff, the engram mirror, the contract's place and `/goal`, and the pointer to protocols section 6; `AGENTS.md` keeps what the project is, how the repo works and what good looks like (644 estimated tokens). `CLAUDE.md` measures 2390, so with D7's four lines (about 100) `claude-md-budget` goes to 2500 on PR 602. Orchestration has no line of its own: section 1 already sends questions through the orchestrator where one leads.
- gentle-ai on `6f47fad5..7e069cdc`: medium, not due (under_budget); Markdown only, so no Codex record is due.
- L11 (2026-10-27, JH ORQ): "D7 is answered. He chose \"Acepto D7 así (Recomendada)\" through the question tool (recorded as question 96, transcript e41d1e8d-8264-45a4-b16c-f9279f7b6076). The option listed exactly the four lines that stay and the four that go. Put the four kept lines back into CLAUDE.md as item 7's defaults. Those lines are CLAUDE.md text, not a rules change, so a tapped answer is enough here." The four lines return word for word as b94f525f had them; `CLAUDE.md` then measures within the 2500 of `claude-md-budget` (PR 602).
- L12 (2026-10-27, JH ORQ relaying his choice "Justo después de S3 (Recomendada)" through the question tool, transcript e41d1e8d-8264-45a4-b16c-f9279f7b6076): he means more than the two protocols: every directive of the plan, gentle-ai's kept ones and the js-harness protocols, goes into `CLAUDE.md` and `AGENTS.md` so they are dogfooded. S3 lands as it is, T10 and T11 included. Right after it, a new session runs a directives pass in its own PR, before S1: S10's text part (the ODD sizing test and the feature document's order), the js-harness protocols written into `CLAUDE.md`, and `AGENTS.md` per D3; not permissions, skills or S2. This session does not start it. The roadmap's F8 step 4 puts it between S3 and S1.
- L13 (2026-10-27): the incident rerun, `f8-s3-incidents` (results committed), ran both arms on `b94f525f` with the split in the tree, before T10, T11 and D7. Scored per arm with `incidentScore` of `evals/incident-score.mjs` against the frozen line of `f8-s0-a` (13) and `f8-s0-b` (14): L 13, s 1, worse below 10, S8 target 17. `current` 13 of 20, `current-without-claude-md` 13 of 20, false premise 2 of 4 each; cases 01, 02 and 05 fail every trial on both, 03 is 1 of 2 on `current` and 10 is 1 of 2 without `CLAUDE.md`. S3 is no worse. Real cost $16.95 (sum of `costUsd`: $11.22 and $5.73), below the $22 forecast; recorded in the diet's section 7.1.
