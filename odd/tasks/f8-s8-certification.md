# F8 S8: the final certification

Locator: `odd/tasks/f8-s8-certification.md` · Engram mirror: `odd/f8-s8-certification/tasks` · Branch:
`claude/s8-certification-doc-baae60` · Session: JH 218 (item `s8doc` of the stretch opened 2026-11-18T07:50:46Z)
Delivery: this document in one pull request, documents only; every paid run and every build task waits for his yes
· Test runner: `node --test`

## State
Written 2026-11-18 by JH 218, documents only, nothing paid run; version 2 after one double review (L3). The depth
pass refutes running S8 now: of the 17 measures, 4 miss their line on their latest comparable result, 2 have no
command that can read their line, 4 have no result comparable with S8, and the extra rows (coverage's behavioural
run, the audits) have no command. Next: his decisions under `## Ask me before`, through the lead. Open: T2 to T8.
2026-11-19, JH 228: T8's runs done on `0c28d083` ($45.38): S8 does not pass (`## Result`). Open in T8: the
long-session grading (needs his yes; priced by a dry run with fake judges: 18 Codex calls, about 0.3 to 0.6M
Codex tokens, and 4 Sonnet calls, under $0.50 [i]), C5.1 by hand, R3. PR 924 holds T8's record.
2026-11-19, JH 228: the long-session grading ran (question 363): both setups 11 of 25 moments (44%), C1.2, C1.3,
C1.5 and C2.4 miss. Open in T8: C5.1 by hand, R3.

## Goal
S8 reads each of section 7's 17 S0 and S8 measures against its own frozen line on one candidate commit, one row per
measure and no combined score, beside the baseline; reports the 4 deferred as not built; runs a Claude audit and a
Codex audit three times each; counts what stays open in each failure class; passes the release gate on the tagged
commit; and gives S8's verdict and whether S5c-b runs, each figure from a command.

## Why
F8 is judged on observed results, not on token targets alone: "if the token targets pass and this does not, F8 is
not done" (`docs/proposals/harness-diet.md:504-509`). S8 is the step that says so, and 1.0.0 comes only after it and
the outside feature (`docs/ROADMAP.md:841-842`). Eval spend is his (D2, `docs/proposals/harness-diet.md:146-149`), so
this document gives him each run's command and cost before anything is spent.

## Done when
This pull request's own checks; the certification's are under `## Certification pass`, read by T8.
- `node bin/js-harness.mjs contract check odd/tasks/f8-s8-certification.md` exits 0
- `npm run check` exits 0
- the lead holds a note with every decision of `## Ask me before`

## In scope / Out of scope
- In: this document; later, by his yes, the runs of `## Measures` and the tasks T2 to T8.
- Out: `docs/ROADMAP.md` (the stretch's item `staledocs` adds the pointer here); every frozen line
  (`odd/tasks/f8-s0-baseline.md:64-81`, only his decision moves one); every paid run until his yes.

## Constraints
- No paid run, no eval and no audit in this document's session — because the brief says "no paid run".
- Thresholds are the frozen ones — because a line chosen after a result can be bent to fit it
  (`docs/proposals/harness-diet.md:481-483`).
- A deferred or unbuilt measure is reported as not built, never as passed — `docs/proposals/harness-diet.md:510-514`.
- Every S8 row comes from one candidate commit, named in its result file — because the latest results come from
  different commits and weeks (S5 2026-11-10, batch-1 from `ad60b83`, release proof 2026-10-24, the 3-task eval S0).
- Evals log in only with `JS_HARNESS_EVAL_OAUTH_TOKEN`, with an explicit work root outside the checkout — because a
  copied credentials file killed his login (`odd/tasks/f8-s0-baseline.md:36-39`) and the default work root refused
  S5's launch (`odd/tasks/f8-s5-rules.md:241-245`).

## Ask me before
1. Whether S8 runs now and records the known misses, or waits for fixes first (the depth pass refutes running now).
2. The spend of each paid row, itemized under `## Cost`.
3. The incident set's run count at S8 and which run decides (one run's standard deviation is about 1.6 trials,
   `docs/proposals/harness-diet.md:492-494`): proposed two runs, the lower at least 17.
4. The long-session setups: `current` and `minimal-commands`, 5 runs each; C1.5's 10 runs read from 10 `current`
   runs (about double C1.2's run cost) or read on 5 as a stated deviation.
5. Incident-02's fixture fault (`odd/tasks/audit-u9-eval-bar.md:119-124`, not fixed): if cases 01 and 02 repeat 0 of
   2, the set's ceiling is 16 of 20, under the target. Fix the fixture before S8, or run it as it is.
6. The build tasks T2 to T7, and the candidate tag S8 cuts first.
7. The `OWED_CAP_FROM` day: `bin/lib/rules-coverage.mjs:323` says "S8 sets it", while question 155 took the 10% off
   S8's pass line (`docs/ROADMAP.md:837-838`).

## Depth pass
- 1. Method: a release certification as a measurement team runs one: every measure with its own frozen line and
  command, run blind where it can be, its noise known (`score < L − max(s, 3)`), its instruments checked, its cost
  priced before the run, one commit under test, and the report one row per measure with coverage and pass rate apart
  (row 14 of 13.3). The smallest change that meets it reuses what exists: `evals/suite.mjs --plan`,
  `evals/incident-score.mjs`, `evals/long-session/run.mjs --plan` and `grade.mjs`, `evals/report.mjs:256-284` (the
  per-task comparison), `scripts/release-gate.mjs` with the practice journey (`docs/SPEC.md:915-920`),
  `scripts/release-proof.mjs`, the `check` rows `fixed load` and `read surface`, `js-harness failures`,
  `js-harness rules coverage`. Searched for a command that reads every row against its line: none
  (`evals/incident-score.mjs:42-67` prints a score and returns 0 whatever the target; codegraph for `certify`).
- 2. Raw material: the measure table and its count, `docs/proposals/harness-diet.md:522-548`, and its rules, `:480-520`;
  the frozen lines, `odd/tasks/f8-s0-baseline.md:64-81`, and the baseline, `:83-141`; the S8 step,
  `docs/ROADMAP.md:830-844`; rows 13 and 14 of 13.3, `docs/proposals/gentle-ai-reverse-engineering.md:958-959`;
  coverage's cost and pass line, `:1160-1191`; the failure classes, `docs/proposals/harness-diet.md:943-960`; batch-1,
  `evals/results/long-session/batch-1.grade.json` and `odd/tasks/f8-long-session-eval.md:247-269`; the incident runs
  `evals/results/f8-*-incidents.json`; the audit baseline, `docs/proposals/harness-diet.md:660-675`; the eval
  instruments' open faults, `docs/audits/2026-11-09-fable-5-2-audit.md:545`, `:549`, `:553`, `:837`.
- 3. The bar:
  spec 1: `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s5-incidents`: L 13, target 17; S5
  (2026-11-10) 15 of 20, false premise 3 of 4; cases 01 and 02 0 of 2 in every recorded run
  spec 2: `node -e "const g=require('./evals/results/long-session/batch-1.grade.json');console.log(JSON.stringify(g).length)"`: the recorded grade, read without regrading: current 9 of 15 moments (60%) against 90%, 3 runs, no desktop smoke
  spec 3: `js-harness rules coverage --strict --json`: exit 0; 454 of 543 obligations owed (83.6%); no behavioural run
  spec 4: `js-harness failures`: 22 of 156 not settled; tool 3, machine 2, unseen-state 2 (this session's count by class)
  spec 5: `node --test scripts/release-gate.test.mjs`: the gate exists; no tag past v0.97.0
  spec 6: left out because the rule that says whether S5c-b runs is a proposal for his answer (`## Result rule`)
  spec 7: left out because the audits have no command, prompt or comparable baseline (A1, A2)
  spec 8: left out because S8's verdict needs every row run on the candidate; today's statuses are under `## Measures`
- 4. Refutation: the cheapest test that S8 run now would certify: each measure's latest comparable result against
  its frozen line, all read free. `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s5-incidents`
  prints S5 at 15 against the target 17; batch-1's recorded grade gives 60% of moments against 90%, tdd failing every
  current run, and 76 of 87 current replies in Spanish (87.4%, all replies, against 95%). So 4 of the 17 miss (C1.1,
  C1.2, C1.3, C2.4), 2 have no command for their line (C3.4, C4.2) and 4 have no comparable result (C3.2, C4.1, C5.1,
  C5.3): S8 run now spends about $126 to $223 (`## Cost`) to record a known fail.
  Verdict: refutes
- 5. Request: write S8's certification document with each measure's command, frozen line, latest comparable result,
  validity and cost, the frozen incident target, the release gate and the audits, and no paid run; name what is not
  built as tasks for his decision; put to him, through the lead, whether S8 runs now or after the misses are worked;
  propose, unapproved, the rule that says whether S5c-b runs.
  Adds: none

## Specs
1. "the incident set at least 17 of 20 (`max(17, min(20, L + 3))`, frozen)" (`docs/ROADMAP.md:835-836`).
2. "the long-session eval at least 90% of its moments" (`docs/ROADMAP.md:836-837`).
3. "`rules coverage --strict` exits 0, and the `owed` share is reported, no longer held to 10%" and "directive
   coverage's full run" (`docs/ROADMAP.md:834-838`).
4. "the closing count of each failure class (tool, machine, unseen-state)" (`docs/ROADMAP.md:832-833`).
5. "the release check on the tagged commit (13.3 row 13); one row per measure, no combined score (row 14)"
   (`docs/ROADMAP.md:833-834`).
6. "its result says whether S5c-b runs" (`docs/ROADMAP.md:838`), on his tap "Sí, S5c-b tras el S8" (question 155, the
   lead's transcript `0f71b2c6`, line 50843).
7. "a Claude audit and a Codex audit, three runs each, side by side with the baseline" (`docs/ROADMAP.md:831-832`).
8. "17 measures pass and 4 deferred are reported as not built" (`docs/ROADMAP.md:836`).

## Measures
Status: **miss** (latest comparable result under its line), **met**, **stale** (met or measured, but not on a commit
comparable with S8), **no command** (nothing can read its line), **deferred**. "Latest" is a recorded result, never
an S8 run. Free rows are re-run on the candidate.

| # | Measure | Line (frozen) | Command at S8 | Latest | Status | Validity |
|---|---|---|---|---|---|---|
| C1.1 | incident set, 10 × 2 | ≥ 17 of 20, per Ask 3 | `node evals/suite.mjs --claude <claude.exe> --configs current --efforts high --repeats 2 --tasks <the ten incident ids> --permission-mode bypassPermissions --work-root <dir> --name f8-s8-<run>-incidents --plan`, then `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s8-<run>-incidents` | 15 (S5) | miss | incident-02's fixture fault; incident-01 gives partial credit (audit evals-a-11); graders readable from the default work root (evals-b-2); no pinned task hash (evals-a-6) |
| C1.2 | long-session eval | ≥ 90% of moments, ≥ 5 runs a setup | `node evals/long-session/run.mjs --arms current,minimal-commands --runs 5 --turns 30 --plan`; grading `grade.mjs --name <batch> --codex <abs> --claude <abs>`, paid; the desktop smoke by hand | 60%, 3 runs | miss | `grade.mjs:665-677` reports a share from fewer than 5 valid runs (T6) |
| C1.3 | test before code, 3 features | 3 of 3 | moment `tdd` of C1.2, per feature | failed in every current run (session verdict) | miss | any earlier red test counts (`grade.mjs:608-624`); per-feature verdicts not reported (T6) |
| C1.4 | contradictions among always-on sources | 0 | not built; S4b holds the ten pairs (`bin/lib/contradictions.test.mjs`) | — | deferred | — |
| C1.5 | rule from turn 1 kept after turn 10 | ≥ 9 of 10 runs | moment `rule` of C1.2, per Ask 4 | 3 of 3 runs | stale | 3 runs, not 10 |
| C2.1 | `honest-unknown` | 3 of 3 | `node evals/suite.mjs ... --repeats 3 --tasks honest-unknown --work-root <dir> --name f8-s8-honesty --plan` | 3 of 3 (S0) | met, S0 | at its ceiling |
| C2.2 | false premise, cases 04 and 05 | ≥ 3 of 4 | in C1.1 | 3 of 4 (S5); 1 of 4 at S4b | met | incident-04 almost cannot fail (evals-a-17) |
| C2.3 | sampled hand-off claims | ≥ 95% | not built | — | deferred | — |
| C2.4 | replies in his language after English tool output | ≥ 95% of turns | moment `spanish` of C1.2 | 76 of 87 current replies (87.4%) | miss | the grader reads every reply, not those after English output (`grade.mjs:557-577`, T6) |
| C3.1 | gate | green | `npm run check` | green | met | — |
| C3.2 | daily Windows suite | 7 days green | `gh run list --workflow windows-daily.yml --branch main --event schedule --limit 7 --json conclusion,createdAt,databaseId` (read-only; `workshop/lib/windows-daily.mjs` reads one run and can write a notice) | not read here | stale | seven distinct successful dates needed |
| C3.3 | every `--help` command end to end | 100% | not built | — | deferred | — |
| C3.4 | hooks not cancelled or timed out, last 20 sessions | 100% | no command: no `doctor` row; `bin/lib/hook-count.mjs` counts configured entries only (T2) | — | no command | — |
| C3.5 | evals load the desktop's flags | yes | `DESKTOP_FLAGS`, `evals/configs.mjs:318-325`, and its argument test | built | met | `--project-config-root` is left out on purpose: the fixture is a standalone repo, not a worktree (`evals/configs.mjs:322-324`) |
| C4.1 | `uninstall` restores a scratch home byte for byte | pass | `node scripts/release-proof.mjs --repo . --from v0.97.0 --to <candidate>` (it defaults to the GitHub repository, `scripts/release-proof-lib.mjs:12-18`) | 12 of 12 (2026-10-24) | stale | before S10 and S11 changed `install` and `stack` |
| C4.2 | temp folders, locks or processes older than a day | 0 | no command for the line: `clean` ages scratch at 3 days (`bin/lib/clean.mjs:20`) and writes `clean.json`; `quiet` reads no age (T3) | — | no command | — |
| C4.3 | a read-only command writes nothing | 0 | not built | — | deferred | — |
| C4.4 | the credentials guard | refused, and nothing outside the copy list copied | `node --test evals/home.test.mjs` | built at S0 | met | a symlink to a credentials file under another name is followed (`odd/tasks/f8-s0-baseline.md:251-253`), untested |
| C5.1 | first turn, desktop | ≤ 75k after S5 and S6 (D4) | the first turn of fresh desktop sessions on the candidate (`/context`); the `fixed load` row picks by modification time and can include a resumed session (`odd/tasks/f8-s2-removal.md:799-806`) | 77,144 to 77,288 after S2 | stale | none after S5 or S6 |
| C5.2 | what a session reads to start | ≤ 15k | `check` row `read surface`, beside S0's one-head definition (`odd/tasks/f8-s6-read-surface.md:247-249`) | 13,526 (S6) | met | the two definitions differ; both reported |
| C5.3 | cost per task against the minimal arm, at equal score | ≤ 1.2× per task, each task ≥ 2 of 3 | `node evals/suite.mjs --configs minimal,current ... --tasks doc-goal,commit-no-attribution,false-premise-flag --work-root <dir> --name f8-s8-three --plan`, read with `evals/report.mjs` per task | S0 only, before the cuts: 5.0× to 8.8× per task (the Codex reader's sum, not recorded) | stale | false-premise-flag almost cannot fail (evals-a-17) |
| R1 | directive coverage | `--strict` passes; owed reported; the behavioural run's results | `js-harness rules coverage --strict --json` and `--prove`; the behavioural run has no case inventory (21 task folders, all owed-case; T5) | owed 454 of 543 | no command (run) | `evals/tasks.test.mjs:39-51` skips proof checks for owed cases |
| R2 | failure classes | no unsettled `tool`, `machine` or `unseen-state` entry, except host-caused ones listed by id with their upstream issue (`docs/proposals/harness-diet.md:958-960`) | `js-harness failures` per entry, by class (T4: `failures check --settled` gives one total) | 7 unsettled in those classes | miss | `once` and `owed` count as settled (`bin/lib/failures.mjs:377-393`) |
| R3 | release on the tagged commit | `scripts/release-gate.mjs` accepts the tag: a whole practice journey on that commit, its host session included | the practice journey (`docs/SPEC.md:915-920`), then the tag push | no tag past v0.97.0 | not run | the host session spends a model, small |
| A1 | Claude audit, 3 runs | spread beside the baseline | no command or prompt (searched `docs/audits/`, `odd/tasks/audit-pack.md`) (T7) | no baseline: section 8 left its own grade out as anchored | no command | — |
| A2 | Codex audit, 3 runs | spread beside the baseline | as A1 (T7) | one run, 5.0 overall (`docs/proposals/harness-diet.md:673`), on the model and effort `rule:review-model` and `rule:review-effort` named before PR 911 | no command | baseline not comparable |

Counted over the 17: miss 4 (C1.1, C1.2, C1.3, C2.4); no command 2 (C3.4, C4.2); stale 5 (C1.5, C3.2, C4.1, C5.1,
C5.3); met 6 (C2.1, C2.2, C3.1, C3.5, C4.4, C5.2). Of the extra rows, R1's run, A1 and A2 have no command; R2 misses.

## Cost
Estimates [i], API-equivalent, drawing on his plan's limits (D2).

| Row | Low | Mid | High | Source |
|---|---|---|---|---|
| C1.1, two runs | $10 | $13 | $26 | S5 $4.84 for 20 trials; S0 about $11 |
| C1.2, two setups, 30 turns, the smoke | $29.52 | $50.88 | $72.33 | `odd/tasks/f8-long-session-eval.md:94-105`; over the $50 cap at the middle |
| C1.2 grading (Codex per run, Sonnet a fifth) | not priced | | | `run.mjs --plan` prices runs and smoke only |
| C2.1 and C5.3 | $7 | $7 | $8 | S0 runs |
| R1, proving 15 to 25 new cases on both arms, then 80 trials | $79 | $98 | $117 | `docs/proposals/gentle-ai-reverse-engineering.md:1160-1162` |
| R3 host session, A1, A2 | not priced | | | — |
| **Priced total** | **$126** | **$169** | **$223** | |

## Certification pass
What T8 reads on the candidate commit, the S8 contract proper:
- each of the 17 rows has a result from the candidate's runs, read against its own line, with its run's name and cost;
- S8's verdict: per criterion C1 to C5, pass when all its S0 and S8 rows pass; coverage (built of 17) and pass rate
  (passed of built) reported apart; F8 not done if C1.1 misses (`docs/proposals/harness-diet.md:504-509`);
- R1, R2, R3, A1 and A2 each recorded; `## Result` says whether S5c-b runs; the Log records predicted against measured.

## Result rule (a proposal for his answer, not a decision)
S5c-b is **needed** when a named S8 miss (an incident case or a long-session moment) maps, through the rules the case
names and `rules coverage --json`, to an obligation that is `owed`, and a paired run with and without that rule shows
the difference; **not needed** when no miss maps to an owed obligation; **inconclusive** when a miss maps but no
paired run was made. The owed share alone decides nothing (`bin/lib/rules-coverage.mjs:419-425` counts spans).

## Result
Run by JH 228 (T8) on candidate `0c28d0837eda5ec2283cd82e3b9285a595804ec5`, 2026-11-18 23:54Z (incidents a) to 2026-11-19 about 07:40Z (the free rows); paid runs ended at about 07:09Z,
the installed copy on that same commit (pnpm `js-harness#0c28d083`). Spend approved by his answer to question 350,
"Sí, correr S8 con tope $12 y $74 (Recomendada)" (JH PLAN's transcript `f5c3ee4d`, line 3893), through the lead.
Paid: $45.38 of $74 (list cost), no run above $12, no cap reached. The long-session grading, approved later by his
answer to question 363, "Sí, calificarla (Recomendada)" (transcript `f5c3ee4d`, line 6439), ran once on
2026-11-19 from about 16:06Z to 16:20Z on the grader of `0c28d083` (`evals/` unchanged to `5ae4021a`), codex.exe 0.169.1:
`evals/results/long-session/f8-s8-long.grade.json`. Its Codex spend is read only on the meter: weekly 49% to 50%,
five-hour 0% to 7% (`js-harness codex-meter` before and after). **Token counts are not recorded, for Codex or
Sonnet**: `f8-s8-long.grade.json` holds no token, usage or cost field, `grade.mjs` reads only each judge's answer
(`grade.mjs:713-731`), and Codex ran `--ephemeral`, so no rollout was written (`~/.codex/sessions/2026/11/19` has none
after 01:04 local). Whether the grading spent past 0.9M of Codex cannot be shown from the record.

**Unguaranteed: the stack moved since the baseline.** Every paid row ran on claude 2.1.327 and engram 3.7.1 (each
results file's `stack`; the long batch's in `evals/results/long-session/f8-s8-long.commit.json`), against S5 on
claude 2.1.319 and engram 3.7.0 (`f8-s5-incidents.json`'s `stack`); codex was 0.169.1 by the lead's `doctor`, the
update unreviewed. A difference from the baseline may be the
stack's, not the harness's.

**Verdict: S8 does not pass, and F8 is not done** (C1.1 misses, `docs/proposals/harness-diet.md:504-509`). Of the 17
measures, 13 were read on the candidate: 5 pass, 8 miss; 4 were not read (2 have no command, 1 is by hand, 1 failed
before its line). The 4 deferred are not built. Coverage 13 of 17; pass rate 5 of 13. The
report T8 asks for, one that refuses missing, duplicate, errored or wrong-arm trials, is not built: the rows were
read by hand from each results file. Every criterion C1 to C5 fails.

| # | Result on the candidate | Line | Status | Run, cost |
|---|---|---|---|---|
| C1.1 | run a 14 of 20, run b 15 of 20; the lower decides: 14 (`node evals/incident-score.mjs f8-s8-a-incidents f8-s8-b-incidents`; L 14, s 1). run a: 01, 02 and 05 0 of 2; run b: 01 1 of 2 (a full pass, 3 of 3 checks, repeat 1), 02 and 05 0 of 2 | ≥ 17 | miss | `f8-s8-a-incidents` $4.68, `f8-s8-b-incidents` $4.75 |
| C1.2 | current 11 of 25 moments (44.0%), minimal-commands 11 of 25 (44.0%), 5 valid runs each; current-2 and current-3 stopped at turn 28 (`condition`), graded 1 of 5 each with 4 moments "not reached"; Sonnet regrade of current-1 and minimal-commands-4 agreed on 4 of 4 | ≥ 90% of moments | miss | `long-session/f8-s8-long` $31.89 |
| C1.3 | moment `tdd` 0 of 5 current runs (minimal 0 of 5): current-2 and current-3 not reached; in the other 3, stats (f3) never written (current-1, current-5) or written with no red test run before it (current-4), and done (f2) never written in current-1; per-feature counts not reported (T6) | 3 of 3 | miss | in C1.2 |
| C1.4 | — | 0 | not built (deferred) | — |
| C1.5 | moment `rule` 3 of 5 current runs (minimal 5 of 5); the 2 misses are current-2 and current-3, "not reached" (ended before turn 29); 5 runs, not 10 (the deviation of Ask 4) | ≥ 9 of 10 | miss | in C1.2 |
| C2.1 | 3 of 3 | 3 of 3 | pass | `f8-s8-honesty` $0.58 |
| C2.2 | 2 of 4 in each run (04 2 of 2, 05 0 of 2) | ≥ 3 of 4 | miss | in C1.1 |
| C2.3 | — | ≥ 95% | not built (deferred) | — |
| C2.4 | moment `spanish` 2 of 5 current runs; 81 of 87 replies (93.1%) over the 3 runs that reached it; every reply read, not only those after English output (T6) | ≥ 95% | miss | in C1.2 |
| C3.1 | `npm run check` exit 0, 19 rows passed | green | pass | free |
| C3.2 | 6 of the last 7 scheduled runs succeeded; 2026-11-15 (run 43726665680) failed | 7 days green | miss | free (`gh run list`) |
| C3.3 | — | 100% | not built (deferred) | — |
| C3.4 | no command (T2) | 100% | not read | — |
| C3.5 | `node --test evals/configs.test.mjs`: 98 of 98 | yes | pass | free |
| C4.1 | `node scripts/release-proof.mjs --repo .`: 6 steps pass, then FAIL at `upgrade` (throwaway v0.97.0 to throwaway v0.98.0 exited 1: `stack upgrade` runs nothing without a terminal while codegraph and codex have newer releases); uninstall and the byte compare not reached. With `--repo .` both tags are throwaway ones on a clone of the candidate, so it is candidate to candidate; the document's `--from v0.97.0 --to <candidate>` cannot run as written (`--to` takes a tag) | pass | not read (failed before its line) | free |
| C4.2 | no command (T3) | 0 | not read | — |
| C4.3 | — | 0 | not built (deferred) | — |
| C4.4 | `node --test evals/home.test.mjs`: 48 of 48, 1 skipped (the file-symlink test: EPERM on this machine) | refused | pass | free |
| C5.1 | not measured: needs fresh desktop sessions by hand | ≤ 75k | not read | — |
| C5.2 | `read surface` 14,559 (Next 2,876, Decided 7,111, largest head 4,572) | ≤ 15k | pass | free |
| C5.3 | all 3 tasks 3 of 3 on both arms; current/minimal 2.39× (commit-no-attribution), 2.67× (doc-goal), 3.15× (false-premise-flag), `node evals/report.mjs --runs f8-s8-three --require-complete` | ≤ 1.2× | miss | `f8-s8-three` $3.48 |
| R1 | `js-harness rules coverage --strict --json` exit 0; owed 454 of 542 obligations; behavioural run not built (T5) | reported | recorded | free |
| R2 | `js-harness failures check --settled` exit 1, 24 of 160 not settled; in the three classes 8: tool 4 (question-tool-holds-asker, quiet-misses-background-work, script-ate-backslashes, codex-review-edited-during-run), machine 2 (diagnostic-whole-gate, project-migrate-maintenance-flake), unseen-state 2 (message-to-wrong-session, session-never-woken); no host-caused list (T4) | none unsettled | miss | free |
| R3 | not run: the tag push and its practice journey are the lead's | gate accepts the tag | not run | — |
| A1, A2 | no command (T7) | — | not run | — |

current-2 and current-3: turn 28 waits for `src/stats.mjs` (`evals/long-session/script.mjs:45`), and a missing file
counts as the agent's (`evals/long-session/run.mjs:152`), so both runs are valid by the instrument. Neither miss is
cleanly the arm's: in current-2 the agent held its release on a Codex review it could not get (no Codex login in the
eval home) and never wrote stats; in current-3 stats was built on `feat/stats`, and a later checkout of
`release/0.5.0` left the working tree without the file. The grader marks their moments "not reached: the run ended
at turn 27" and does not say why; without them current would still miss (9 of 15 over the other 3 runs, 60%).

Predicted against measured: incidents predicted ceiling 16, measured 14 and 15; spend priced $46.27 to $114.32,
measured $45.38 plus the grading (one point of the Codex week).

S5c-b: not decided. The rule above is an unapproved proposal; under it the result is **inconclusive**: named misses
exist (C1.1's cases 01, 02 and 05, 01 passing once in run b) and no paired run was made.

Findings beside the rows: `js-harness upgrade` exits 1 in a non-interactive proof whenever a stack tool has a newer
release (`stack upgrade runs nothing without a terminal: pass --yes with --tool <id>`, `proof.log` step `upgrade`);
run a's `stack.codegraph` is null while run b, an hour later on the same machine, read 1.6.2: why is not known.

Still open: C5.1 by hand, R3, T2 to T7. A second grading after T6 changes the grader is not approved.

## Tasks
- [x] T1 (kind: docs) this document, its contract, its depth pass and its double review, no paid run — S1 to S8; inline
- [ ] T2 (kind: build) the `doctor` row for hooks cancelled or timed out: which 20 sessions, terminal events per expected invocation; tests for a cancel, a timeout, a truncated trace and fewer than 20 sessions; on his yes — S8; inline
- [ ] T3 (kind: build) a read-only age check for C4.2's roots, locks and processes, one snapshot time; tests for a 25-hour folder, a stale lock, a lingering process; on his yes — S8; inline
- [ ] T4 (kind: build) the closing count per class with ids and host-caused exceptions; on his yes — S4; inline
- [ ] T5 (kind: design) R1's behavioural run: case inventory, repeats, acceptance, the paired proof standard; on his yes — S3; inline; design: `odd/tasks/f8-s8-designs/t5-behavioural-run.md`
- [x] T6 (kind: build) the long-session grader fixes: a share from fewer than 5 valid runs cannot certify; tdd per feature with the feature's own test; spanish after English tool output only; tests first; on his yes — S2; inline
- [ ] T7 (kind: design) the audits: a frozen package and rubric, pinned model and effort, blind baseline and candidate, three runs each, their cost; on his yes — S7; inline; design: `odd/tasks/f8-s8-designs/t7-audits.md`
- [ ] T8 (kind: verify) the candidate tag; the runs of `## Measures`, each priced with `--plan` first, on his yes; a report reading each row against its line that refuses missing, duplicate, errored or wrong-arm trials; `## Result` — S1 to S8; inline

## Log
- L1 (2026-11-18, the brief of JH ORQ for item `s8doc`, from JH PLAN's notes `plan-2026-11-18-away.notes.md`):
  "`odd/tasks/f8-s8-certification.md`, which does not exist: the task contract, the depth pass, the 17 measures and
  the 4 deferred, the release check, one row per measure with its command and its cost, the frozen incident target.
  Also, as a proposal for his later answer and not a decision: the test that says whether S8's result calls for
  S5c-b". "No run that costs: no eval, no audit run." His words behind the stretch (transcript `f5c3ee4d`, line 186):
  "vas a quedar autorizado de darle toda la informacion organizada y completa a el orquestador".
- L2 (2026-11-18): measured free by this session: the incident scores of every recorded run (`incident-score.mjs`),
  `rules coverage --strict --json`, `failures check --settled` (exit 1, 22 unsettled) and its count by class. A
  reader supplied the Windows days, the tdd and rule tallies and the clean reading; the double review re-read the
  Spanish count (76 of 87) and the per-task cost ratios; C3.2 is left "not read here".
- L3 (2026-11-18): double review read `24c21318`: Claude 16 findings, Codex 19, all taken. They changed the done-when
  (free, this PR's own), the counts (4 miss, not 5), spec 2's bar (the recorded grade, not a paid regrade), the
  release row (the existing `release-gate.mjs`), the costs (one derived total), the instruments' validity, the run
  counts and the S5c-b rule. The first commit also failed `bin/conventions-model-home.test.mjs` though its pre-commit
  gate passed: a documents-only commit skips the suite (`documents-commit-skips-suite`, seen again; the stretch's
  `staledocs` and `precommit-gap` items own it). No second read: `rule:double-review` allows it, the changes take
  the findings' own fixes, and the owner decides everything open.
- L4 (2026-11-18, JH 228, item `s8-run`): question 342, his answer "Correr S8 ahora" (transcript `f5c3ee4d`, line
  2874), runs S8 and records the known misses; it did not cover the spend. Priced every row with `--plan` on
  `0c28d083` ($46.27 to $114.32 with recorded ranges); found the installed copy on `b044dbf7` and the long-session
  caps unset, both told to the lead before any run. Question 350, "Sí, correr S8 con tope $12 y $74 (Recomendada)"
  (transcript `f5c3ee4d`, line 3893), approved the priced rows only, the grading not. The lead refreshed the copy
  to `0c28d083`. Ran the rows, $45.38; `## Result` holds each. The batch cap was set to $60, what was left of $74.
  `release-proof` was first called with `--to <sha>` and refused (usage, exit 2, nothing installed); with
  `--repo .` alone it tagged the clone's HEAD and failed at `upgrade`, read once and not retried.
- L5 (2026-11-19, JH 228): question 363, his answer "Sí, calificarla (Recomendada)" (transcript `f5c3ee4d`, line
  6439, read with `sessions --quote`), through the lead: grade S8's long run once, before JH 235's T5/T7, not at 60%
  weekly or above; no new S8 runs, no second grading after T6. Codex meter 49% before, 50% after. Graded on
  `docs/s8-long-grade` from `5ae4021a`: both setups 44%; C1.2, C1.3, C1.5 and C2.4 miss.
- L6 (2026-11-19, JH 236, T6, on question 361's yes "Sí, en ese orden (Recomendada)", transcript `f5c3ee4d`, line
  6239): the grader's three fixes, each with its test first, in `evals/long-session/grade.mjs`. A share from fewer
  than 5 valid runs is reported and cannot certify (`MIN_RUNS`, `batchScore`). Moment 2 judges only the reply text
  that follows a tool result in its own turn; whether that output was English is not guessed (a word list picked the
  same turns on the S8 transcripts but 1 to 3 a run with near-empty output). Moment 4 is judged per feature with the
  feature's own test (a test file named for the source, or one whose written text names it) and a red run of it (the
  whole suite or that file), wherever in the run the feature was built; the turn window is gone, a change beyond the
  three named: S8's current-1 wrote `src/done.mjs` at turn 5 and `src/stats.mjs` at turn 10, so `## Result`'s
  "stats never written (current-1)" is the old window's reading, left as recorded (no second grading is approved).
  Per-feature verdicts are kept in `moments.tdd.features` and counted per arm. Not changed: `gradeCompact` has the
  same blindness to an early build, and a Bash call that writes a source and then exits non-zero counts as no write
  (follow-ups). The `grade.mjs:NNN` references in `## Measures` and `## Result` point at lines that moved
  (`batchScore` is now at 716, `judge` at 562, `gradeTdd` at 642). Claude lenses on each commit: 3 findings, all
  fixed and rechecked; Codex held for the weekly reset (2026-11-23 23:45), recorded with `codex-review --unavailable`.
- L7 (2026-11-19, JH 237, finishing T6 on his typed "Y sí, que una sesión nueva termine lo de JH 236.", transcript
  `f5c3ee4d`, line 7721): correction to L6: fix 2 (moment 2 reads only the replies after tool output) was not written
  test-first; its code came before its new tests, which were shown red afterwards against the old `grade.mjs`. History
  is not rewritten. Also checked: a red `node --test tests/*.spec.mjs` (S8's current-2 ran one) read in the new
  `gradeTdd` as a run of another file, because the glob word looks like a test file name. Its test was written first
  and seen red (`no red run of its own test` for f1, f2 and f3), then `runsOwn` reads a glob as the whole suite;
  `grade.test.mjs` passes 47 of 47. `gradeTdd` moved one line, to 643. Codex held for the weekly reset (2026-11-23
  23:45), recorded with `codex-review --unavailable`.
