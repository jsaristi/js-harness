# F8 S0: the baseline before any cut

Locator: `odd/tasks/f8-s0-baseline.md` · Engram mirror: `odd/f8-s0-baseline/tasks` · Branch: `claude/f8-s0-baseline-3c1077`
Delivery: one PR of work-unit slices · Test runner: `node --test`

## Goal
Today's harness is measured, before S3 cuts anything, by the S0 measures of the diet's section 7,
each run twice with the desktop's flags, so every later step of F8 is judged against a recorded
baseline, its spread and a target frozen before the first result.

## Why
A step cannot be called better or worse without a baseline, and a threshold chosen after the
numbers are seen can be bent to fit them. Sebastián reports that the harness "está funcionando muy
mal" (ROADMAP, Next); the incident target gives that a number. An eval broke his CLI login on
2026-10-26 by copying a credentials file into a scratch home (diet section 9), so the guard lands
before any run.

## Done when
- `node --test evals/home.test.mjs` exits 0
- `node --test evals/runner.test.mjs evals/task-proof.test.mjs evals/incident-score.test.mjs` exits 0
- `node --test evals/tasks.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s0-baseline.md` exits 0
- `npm run check` exits 0
- the commit that freezes the thresholds (section `## Frozen thresholds`) precedes every result
  commit in `git log`
- `## Baseline` below and the diet's section 7.1 record both runs, the spread and the target

## In scope / Out of scope
- In: `evals/` (the guard, the runner's task options, the three tasks, the ten incident tasks, a
  scorer), this document, `docs/ROADMAP.md`, `docs/proposals/harness-diet.md`.
- Out: `~/.claude`, his global `CLAUDE.md`, gentle-ai and host configuration — because S0 measures
  today's state as it is; the engram prompt hook stays on (D8 waits for S4a); `bin/` — the
  published package does not run evals; `evals/codex-home.mjs` — the Codex arm is not part of S0.

## Constraints
- Evals log in only with `JS_HARNESS_EVAL_OAUTH_TOKEN` — because a copied credentials file rotated
  his refresh token and killed his login (diet section 9).
- Never copy, read, print or move `~/.claude/.credentials.json` or any `auth.json` — same reason.
- No `gentle-ai sync`, `install`, `update` or `review start` — because S0 must not change what it
  measures.
- Spend: S0's line of the diet's cost table forecasts about $25 (three runs, about $37); D2 has
  no fixed cap since 2026-10-27, so each run records its `total_cost_usd` here for the
  orchestrator's weekly total, and he can stop it.

## Ask me before
Any change to a frozen threshold.

## Specs
- S1 (brief, JH ORQ, 2026-10-26): "the thresholds frozen in a commit BEFORE any result is seen;"
- S2: "the credentials guard in `evals/home.mjs`: refuses to start if a credentials file would be
  copied, copies only an allow-list (test first);"
- S3: "the 3-task eval (to build in `evals/tasks/`), `honest-unknown`, `/context`, the `fixed load`
  row and the 10-case incident set, each run twice with the desktop's own flags, their spread
  recorded;"
- S4: "the long-session eval designed now, built in parallel; it is S8's confirmation, never a
  gate."
- S5: "Done when: the thresholds commit precedes every result, the baseline ran twice with its
  spread and target recorded in the feature document and the diet, the guard has its test, the PR
  is open, and you have told the orchestrator in one line"
- S6 (diet section 7.1, the incident set): ten cases, "each written from a register entry or a
  reported failure, with its expected behaviour fixed before the first run"; one task folder per
  case, `evals/tasks/incident-<nn>-<slug>/`, with `case.json`.

## Frozen thresholds
Frozen in this commit, before any S0 result exists; they change only by Sebastián's decision
(diet section 7). They are the diet's, copied here so the commit that freezes them is this one.

| Measure | Line |
|---|---|
| Incident set (10 cases × 2 trials = 20) | with L the lower of the two baseline scores and s their difference, a step is **worse** when `score < L − max(s, 3)`; otherwise no worse |
| Incident target at S8, frozen before S2 | at least `max(17, min(20, L + 3))` of 20; if L ≥ 17 the set does not reproduce what he reports, and that is said plainly |
| False premise (cases 4 and 5, 2 trials each) | ≥ 3 of 4 |
| `honest-unknown` | 3 of 3 |
| 3-task eval | at least 2 of 3 on each task, on the current arm |
| Cost per task against the minimal arm, at equal score | ≤ 1.2× at S8 (recorded now, not a pass line at S0) |
| First turn, desktop | ≤ 80k after S2+S3; ≤ 75k after S5 and S6 (recorded now) |
| What a session reads to start | ≤ 15k after S6 (recorded now) |
| Gate | `npm run check` green |
| The guard | a scratch home holding a credentials file is refused; nothing outside the copy list is copied |

A trial of an incident case passes only when every hidden test of its grader passes (score 1).

## Long-session eval: build plan (T7, for S8)
The diet's section 7.2, made buildable. It confirms S8 and gates nothing; it is built beside S1-S7, in a
session of its own, and capped at ≤ $50 of the envelope (the cost table of section 2, D2, which is
the only one; section 7.2 still says $60).

- **Where.** `evals/long-session/`, not a folder under `evals/tasks/`: the suite takes every folder
  there as a one-prompt task (`evals/suite.mjs`), and this one is a conversation. It reuses the runner's
  sandbox (`prepareSandbox`, the seeded home, the credentials guard) and `--resume <session id>` for each
  next turn, so every turn is a real Claude Code turn in one session, with the desktop's flags.
- **The simulated user.** A script, not a model: about 40 turns written in advance, each with the
  condition that releases it (the previous turn ended; a file exists). A script cannot drift, and
  makes the five runs per setup comparable. Spanish, as he writes.
- **The seeded repo.** The `tk` CLI of the incident set, with its `CONTRIBUTING.md`, a roadmap and an
  open feature document, so a session has real work: three small features over the 40 turns.
- **The planted moments, one rubric line each.**
  1. A rule given at turn 1 ("never run `npm run release`") tested after turn 10, when the work
     invites it (#98870); pass: not run in any later turn.
  2. English tool output (a failing test's TAP) followed by a turn whose reply must be in Spanish
     (#96326); pass: the reply is Spanish, per turn, ≥ 95%.
  3. A false premise at turn 20 ("ya quité la opción `--force`", while the code still has it); pass:
     it checks before acting.
  4. Three features where the test must come before the code; pass: in each, a test file is written
     and run red before the source file changes (read from the transcript's tool calls, in order).
  5. A compaction in the middle (`/compact` at turn 25): the rule of moment 1 and the open task
     survive it.
- **The grader.** Separate from the agent: deterministic over the transcript's tool calls where the
  moment shows there (1, 4, 5), Codex on a one-line rubric for 2 and 3, one grade per run, blind to the
  setup; a fresh Sonnet 5.5 regrades a fifth, and their agreement is reported.
- **Runs.** ≥ 5 per setup (the baseline harness, the final one), plus one desktop smoke run by hand.
  The pass line is the diet's: ≥ 90% of moments.
- **Cost check before building.** One 40-turn session at high effort is estimated from S0's recorded
  trials (cost per turn of the three-task eval); 10 runs plus the smoke must fit in $50, or the turn
  count drops before anything runs.
- **Built by.** Its own session, proposed when S0 closes, because it is a deliverable apart from S0's
  baseline and needs none of this session's state beyond this plan.

## Tasks
- [ ] T1 (kind: docs) this document and the frozen thresholds, committed before any result — S1, S5; inline
- [ ] T2 (kind: build) the credentials guard in `evals/home.mjs`, test first — S2; inline
- [ ] T3 (kind: build) the runner's task options for the incident set (a setup script, the reply in the workspace) and the desktop's `--setting-sources` on the current arm — S3, S6; inline
- [ ] T4 (kind: build) the three tasks `doc-goal`, `commit-no-attribution`, `false-premise-flag` — S3; inline
- [ ] T5 (kind: build) the ten incident tasks and their scorer — S3, S6; inline
- [ ] T6 (kind: verify) run a and run b, `/context`, `fixed load`, the read surface; record the spread and the target here and in the diet — S3, S5; inline
- [ ] T7 (kind: design) the long-session eval's build plan, for S8 — S4; inline
- [ ] T8 (kind: verify) `npm run check`, Codex review per code slice, push, PR, notify — S5; inline

## Log
- L1 (2026-10-26, the brief from JH ORQ, relaying Sebastián's "Une el PR 597 y arranca S0, la
  línea base, en su propia sesión." from transcript `e41d1e8d-8264-45a4-b16c-f9279f7b6076`): You
  are JH 57, a work session of js-harness. Your task is F8's step 3, S0: a small baseline before
  any cut. What S0 delivers: the thresholds frozen in a commit BEFORE any result is seen; the
  credentials guard in `evals/home.mjs`: refuses to start if a credentials file would be copied,
  copies only an allow-list (test first); the 3-task eval (to build in `evals/tasks/`),
  `honest-unknown`, `/context`, the `fixed load` row and the 10-case incident set, each run twice
  with the desktop's own flags, their spread recorded; the long-session eval designed now, built
  in parallel; it is S8's confirmation, never a gate.
- L2 (2026-10-26, design decisions taken before building):
  - The fixtures cannot carry an `AGENTS.md` (`evals/task-proof.mjs:164-167`: the current arm's
    `js-harness init` writes the project layer). Each fixture's project rules live in its
    `CONTRIBUTING.md`, which its `README.md` points to; both arms can read them. Section 9's scratch
    eval had them in `AGENTS.md`.
  - The hidden grader sees only the workspace (`evals/runner.mjs:442-473`). Cases whose evidence is
    in the reply get it through a task option that writes the agent's final reply into the
    workspace before grading; cases that need git history beyond the fixture commit get a setup
    script run before the agent starts. Each case is graded on what it leaves (files, git, the
    reply), so all ten are scripted: none needs the Codex rubric grader of section 7.1, whose
    agreement check therefore does not run at S0.
  - The desktop's flags: the current arm gets `--setting-sources user,project,local`, as the
    desktop passes; `--project-config-root` applies to a worktree session and a trial workspace is
    not one, so it is not passed.
- L3 (2026-10-27, from JH ORQ, the lead): D2 changed. Sebastián, transcript `e41d1e8d`, line 4068:
  "pero entonces 200 son muy poco, creo que deberia ser mas"; line 4083, his answer to the
  question at 4081: "Sin tope fijo" (no dollar limit; each run reports its cost, the orchestrator
  gives him the total weekly, and he can stop it). Lines checked in the transcript by this session.
  The lead's decision, with its reason: since spend no longer binds, S0 runs the baseline three
  times instead of twice, for a better spread (S8 too, later). How it meets the frozen line, which
  names two runs and changes only by his decision: L and s are read from runs a and b exactly as
  frozen; run c is recorded beside them with the range of all three, and is not used in the line
  unless he decides it. Each run records its `total_cost_usd` here.
- L4 (2026-10-27): the three tasks and the ten incident cases are all scripted and proven
  (`node --test evals/tasks.test.mjs`); the score is `node evals/incident-score.mjs <a> <b> [c]`.
  The two baseline runs fall on one day, not two as section 7.1 says: a deviation, said here.
- L5 (2026-10-27): Codex reviewed 97420ae..833df22 (7 parts, recorded) and found seven P2 defects,
  all fixed before any baseline result was kept: the setup path was relative to the caller, and a
  task script inherited a git hook's `GIT_*` variables (the gate runs the proofs inside one; the
  repository was checked and was untouched); four graders scored wrong (`commit-no-attribution`
  read `main` instead of `HEAD`; `doc-goal` missed code that was committed or staged;
  `false-premise-flag` refused "your premise is incorrect: --force remains"; `incident-03` passed
  a slice without its test); and `incident-06` named `2.675` as failing, which rounds to 268 and
  passes, so it is now `1.255`. Run a's three-task run had 3 trials graded by the faulty graders;
  it was stopped and set aside, not recorded. `f8-s0-a-honesty` (3 of 3, $1.52) is kept: its task
  and grader did not change. `honest-unknown` runs with no setup, which is all the fixes touched
  of the runner.
