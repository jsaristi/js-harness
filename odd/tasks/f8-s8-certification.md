# F8 S8: the final certification

Locator: `odd/tasks/f8-s8-certification.md` · Engram mirror: `odd/f8-s8-certification/tasks` · Branch:
`claude/s8-certification-doc-baae60` · Session: JH 218 (item `s8doc` of the stretch opened 2026-11-18T07:50:46Z)
Delivery: this document in one pull request, documents only; every paid run waits for his yes · Test runner: `node --test`

## State
Written 2026-11-18 by JH 218, documents only, nothing paid run. The depth pass refutes running S8 as the roadmap
words it today: of the 17 measures, the latest recorded results already miss five of their frozen lines, four have
no command, and the run that judges all of them has no command either. Next: the double review of this document,
then the pull request; his decision on the spend and on the build tasks T2 to T5 comes after. Open: everything
under `## Tasks` from T2.

## Goal
S8 reads each of section 7's 17 S0 and S8 measures against its own frozen line, one row per measure and no combined
score, beside the baseline; runs a Claude audit and a Codex audit three times each; counts what stays open in each
failure class; checks the release on a tagged commit; and says whether S5c-b runs, each figure from a command.

## Why
F8 is judged on observed results, not on token targets alone: "if the token targets pass and this does not, F8 is
not done" (`docs/proposals/harness-diet.md:504-509`). S8 is the step that says so, and 1.0.0 comes only after it and
the outside feature (`docs/ROADMAP.md:841`). He decides its spend (G7 after it, `docs/ROADMAP.md:843`), so this
document gives him each run's command and cost before anything is spent.

## Done when
Free commands only: the paid runs are rows of `## Measures` in their `--plan` form, never here, because `contract
run` and the merge execute every command written in this section.
- `node bin/js-harness.mjs contract check odd/tasks/f8-s8-certification.md` exits 0
- `npm run check` exits 0
- `js-harness failures check --settled` exits 0
- `js-harness rules coverage --strict` exits 0
- every row of `## Measures` holds its measured result, read against its own line, with the run's name and cost
- `## Result` says, from those rows, whether S5c-b runs (spec 6), and the Log records predicted against measured

## In scope / Out of scope
- In: this document; later, by his yes, the runs of `## Measures` and the build tasks T2 to T5.
- Out: `docs/ROADMAP.md` (the stretch's item `staledocs` adds the pointer to this document); any frozen threshold
  (`odd/tasks/f8-s0-baseline.md`, "Frozen thresholds": only his decision moves one); every paid run until his yes.

## Constraints
- No paid run, no eval and no audit run in this document's session — because the brief says "no paid run" and the
  spend is his (`docs/ROADMAP.md:843`).
- Thresholds are the frozen ones of `odd/tasks/f8-s0-baseline.md:64-81` — because a line chosen after a result can be
  bent to fit it (`docs/proposals/harness-diet.md:481-483`).
- A deferred measure is reported as not built, never as passed — because a missing measure is never a pass
  (`docs/proposals/harness-diet.md:510-514`).
- Evals log in only with `JS_HARNESS_EVAL_OAUTH_TOKEN` and the `evals/home.mjs` guard — because a copied credentials
  file killed his login on 2026-10-26 (`odd/tasks/f8-s0-baseline.md:36-39`).

## Ask me before
The spend of every paid row; the build tasks T2 to T5; whether S8 runs knowing five lines are already missed or
waits for fixes first; the `OWED_CAP_FROM` day; any change to a frozen line.

## Depth pass
- 1. Method: a release certification as a measurement team runs one: every measure has its own frozen pass line and
  its own command, run blind where it can be, its noise known (the incident rule `score < L − max(s, 3)`), its cost
  priced before the run, and the report one row per measure with no composite (row 14 of 13.3, from gentle-ai's
  bench). The smallest change that meets it reuses what exists: `evals/suite.mjs` with `--plan`,
  `evals/incident-score.mjs`, `evals/long-session/run.mjs` and `grade.mjs`, `scripts/release-proof.mjs`, the
  `check` rows `fixed load` and `read surface`, `js-harness failures check --settled`, `js-harness rules coverage`.
  Searched for a command that reads all rows against their lines: `evals/incident-score.mjs:42-67` prints a score and
  returns 0 whatever the target; no other found (codegraph for `certify`, `baselineLine`; `bin/` and `evals/` names).
- 2. Raw material: the measure table, `docs/proposals/harness-diet.md:528-548`, and its rules, `:477-524`; the frozen
  lines, `odd/tasks/f8-s0-baseline.md:64-81`, and the baseline, `:83-141`; the S8 step, `docs/ROADMAP.md:830-844`, and
  step 5, `docs/ROADMAP.md:163`; rows 13 and 14 of 13.3, `docs/proposals/gentle-ai-reverse-engineering.md:958-959`;
  directive coverage's pass line and run cost, `docs/proposals/gentle-ai-reverse-engineering.md:1162` and `:1179-1192`;
  the failure classes, `docs/proposals/harness-diet.md:943-955`; the long-session batch, `odd/tasks/f8-long-session-eval.md:247-269`
  and `evals/results/long-session/batch-1.grade.json`; the recorded incident runs `evals/results/f8-*-incidents.json`;
  the audit baseline, `docs/proposals/harness-diet.md:660-702`; the owed cap, `bin/lib/rules-coverage.mjs:323-326`.
- 3. The bar:
  spec 1: `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s5-incidents`: the latest full run,
  S5 (2026-11-10), 15 of 20 against the target 17; false premise 3 of 4, at its line
  spec 2: `node evals/long-session/grade.mjs --name batch-1`: current 9 of 15 moments (60%) against 90%, 3 runs not 5
  (L12-L13 of the eval's document); no desktop smoke
  spec 3: `js-harness rules coverage --strict`: exit 0; 454 of 543 obligations owed (83.6%), reported, not held
  spec 4: `js-harness failures check --settled`: exit 1; 22 of 156 not settled, of them tool 3, machine 2, unseen-state 2
  spec 5: `node scripts/release-proof.mjs --help`: the script exists; no tag past v0.97.0, no release record format
  spec 6: left out because the test that says whether S5c-b runs is a proposal for his answer (`## Result rule`)
  spec 7: left out because the audits have no command, prompt or comparable baseline (`## Measures`, A1 and A2)
- 4. Refutation: the cheapest test that S8 run now would certify: the latest recorded result of each measure against
  its frozen line, all free. `node evals/incident-score.mjs f8-s5-incidents f8-s5-incidents` gives 15 of 20 (line 17);
  batch-1 gives 60% of moments (line 90%), tdd 0 of 3 runs on each arm; the S0 cost ratio is above 5× (line 1.2×);
  the Windows daily suite was red on 2026-11-15 (line 7 days green); `js-harness failures check --settled` exits 1.
  Four measures have no command (the hooks row, the audits, the full coverage run as 40 cases, the release record).
  So 5 of the 17 lines are already missed and 4 cannot run: S8 run now spends about $120 to record a known fail.
  Verdict: refutes
- 5. Request: write S8's certification document with every measure's command, line, latest result and cost, the
  frozen incident target, the release check and the audits, and no paid run; name what is not built as build tasks
  for his decision; put to him, through the lead, whether S8 runs now and reports the fail or waits for the misses to
  be worked first; propose, unapproved, the rule that says whether S5c-b runs.
  Adds: none

## Specs
1. "the incident set at least 17 of 20 (`max(17, min(20, L + 3))`, frozen)" (`docs/ROADMAP.md:835-836`).
2. "the long-session eval at least 90% of its moments" (`docs/ROADMAP.md:836-837`).
3. "`rules coverage --strict` exits 0, and the `owed` share is reported, no longer held to 10% (S5c-b moved after S8,
   question 155, 2026-11-02)" (`docs/ROADMAP.md:837-838`).
4. "the closing count of each failure class (tool, machine, unseen-state)" (`docs/ROADMAP.md:832-833`).
5. "the release check on the tagged commit (13.3 row 13); one row per measure, no combined score (row 14)"
   (`docs/ROADMAP.md:833-834`).
6. "its result says whether S5c-b runs" (`docs/ROADMAP.md:838`), on his tap "Sí, S5c-b tras el S8" (question 155, the
   lead's transcript `0f71b2c6`, line 50843).
7. "a Claude audit and a Codex audit, three runs each, side by side with the baseline" (`docs/ROADMAP.md:831-832`).

## Measures
One row per measure, each read against its own line (row 14). "Latest" is the newest recorded result, not an S8
run. Costs are API-equivalent and draw on his plan's limits (D2); an [i] is an estimate.

| # | Measure | When | Line (frozen) | Command at S8 | Latest | Cost |
|---|---|---|---|---|---|---|
| C1.1 | incident set, 10 cases × 2 | S0 | ≥ 17 of 20 | `node evals/suite.mjs --claude <claude.exe> --configs current --efforts high --repeats 2 --tasks <the ten incident ids> --permission-mode bypassPermissions --name f8-s8-<run>-incidents --plan`, then `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s8-<run>-incidents` | 15 (S5, 2026-11-10); 01 and 02 fail every trial of every run | $4.84 at S5 for 20 trials |
| C1.2 | long-session eval | S8 | ≥ 90% of moments, ≥ 5 runs | `node evals/long-session/run.mjs --arms current --runs 5 --turns 30 --plan`, then `grade.mjs --name <batch>` | 60% (batch-1, 3 runs) | $22.97 / $36.18 / $49.43 low / mid / high [i], the smoke included; cap $50 |
| C1.3 | test before code, 3 features | S8 | 3 of 3 | moment `tdd` of C1.2 | 0 of 3 runs (reader's tally of batch-1.grade.json, not recorded) | in C1.2 |
| C1.4 | contradictions among always-on sources | deferred | 0 | not built (`rules conflicts` absent, `bin/rules.mjs`); S4b holds the ten pairs | reported as not built | — |
| C1.5 | rule from turn 1 kept after turn 10 | S8 | ≥ 9 of 10 runs | moment `rule` of C1.2 | 3 of 3 runs (reader's tally); 10 runs need two arms of 5 | in C1.2 |
| C2.1 | `honest-unknown` | S0 | 3 of 3 | `node evals/suite.mjs ... --repeats 3 --tasks honest-unknown --name f8-s8-honesty --plan` | 3 of 3 (S0) | about $1.5 |
| C2.2 | false premise, cases 04 and 05 | S0 | ≥ 3 of 4 | in C1.1 | 3 of 4 (S5); 1 of 4 at S4b | in C1.1 |
| C2.3 | sampled hand-off claims | deferred | ≥ 95% | not built | reported as not built | — |
| C2.4 | replies in his language after English output | S8 | ≥ 95% of turns | moment `spanish` of C1.2 | current 1 of 3 runs (reader's tally) | in C1.2 |
| C3.1 | gate | S0, S8 | green | `npm run check` | green on GitHub, 2026-11-18 (reader) | free |
| C3.2 | daily Windows suite | S8 | 7 days green | `node workshop/js-harness-workshop.mjs windows-daily` (moved from `js-harness`) | red 2026-11-15, so 2 days green on 2026-11-18 (reader, `gh run list`) | free |
| C3.3 | every `--help` command end to end | deferred | 100% | not built | reported as not built | — |
| C3.4 | hooks not cancelled or timed out, last 20 sessions | S8 | 100% | **not built**: no `doctor` row (T2) | none | build only |
| C3.5 | evals load the desktop's flags | S0 | yes | `DESKTOP_FLAGS`, `evals/configs.mjs:325` | built | free |
| C4.1 | `uninstall` restores a scratch home byte for byte | S8 | pass | `node scripts/release-proof.mjs --from <tag> --to <tag>` | 12 of 12, npm and pnpm (2026-10-24) | free, about a minute |
| C4.2 | temp folders, locks or processes older than a day | S8 | 0 | `js-harness clean --dry-run` and `js-harness quiet`; `temp-scratch` ages at 3 days, not 1 (`bin/lib/clean.mjs:20`) | 0 older than a day (reader, 2026-11-18) | free |
| C4.3 | a read-only command writes nothing | deferred | 0 | not built | reported as not built | — |
| C4.4 | the credentials guard of `evals/home.mjs` | S0 | refused | `node --test evals/home.test.mjs` | built at S0 | free |
| C5.1 | first turn, desktop | S0, S8 | ≤ 75k after S5 and S6 (D4) | `check` row `fixed load` (warns at 100k only) and `/context` of one desktop session | 77,144 to 77,288 after S2; none after S5 or S6 | free |
| C5.2 | what a session reads to start | S0 | ≤ 15k | `check` row `read surface` | 13,526 (S6) | free |
| C5.3 | cost per task against the minimal arm, at equal score | S0 | ≤ 1.2× | `node evals/suite.mjs --configs minimal,current ... --tasks doc-goal,commit-no-attribution,false-premise-flag --name f8-s8-three --plan` | S0 only; the reader's sum of `costUsd` gives 5.7× to 6.7×, not recorded | about $5.7 |
| R1 | directive coverage | S8 | `--strict` exits 0; owed reported | `js-harness rules coverage --strict --json`; the 80-trial run has no command (T4) | exit 0; owed 454 of 543 | $45 to $52 [i] for 80 trials; 21 task folders exist, not 40 |
| R2 | failure classes | S8 | no `tool`, `machine` or `unseen-state` entry unsettled | `js-harness failures check --settled` | 7 unsettled in those classes | free |
| R3 | release check on the tagged commit | S8 | the tag's record names a `release-proof` run on it, exit 0 | no record format exists (T5) | latest tag v0.97.0 | free |
| A1 | Claude audit, 3 runs | S8 | spread reported beside the baseline | no command or prompt found (searched `docs/audits/`, `odd/tasks/audit-pack.md`) (T3) | no Claude baseline: section 8 left its own grade out as anchored | not priced |
| A2 | Codex audit, 3 runs | S8 | spread reported beside the baseline | as A1 (T3) | one run, 5.0 overall, on `gpt-6.1-sol`; the reviewer is `gpt-6.2-sol` since PR 911, so the baseline is not comparable | not priced |

Of the 17 S0 and S8 measures, 5 miss their line on their latest result (C1.1, C1.2, C1.3, C3.2, C5.3), C2.4 is near
its line on the reader's tally, and C3.4 has no command. The paid total, by the rows: about $5 + $36 + $1.5 + $6 +
$48 ≈ $97 at the middle, plus the audits, unpriced; the roadmap's estimate is $25 + $50 + $45 to $52
(`docs/ROADMAP.md:839-840`).

## Result rule (a proposal for his answer, not a decision)
S5c-b runs when S8's coverage row shows owed above 10% of the live obligations and the incident set or the
long-session eval misses its line on a moment a coverage case would hold; otherwise it does not. Today the first half
holds (83.6%). `bin/lib/rules-coverage.mjs:323` says "S8 sets" `OWED_CAP_FROM`, while question 155 took the 10% off
S8's pass line: which one stands is his.

## Tasks
- [x] T1 (kind: docs) this document, its contract and its depth pass, no paid run — S1 to S7; inline
- [ ] T2 (kind: build) the `doctor` row for hooks cancelled or timed out over the last 20 sessions, test first; waits for his yes — S1; inline
- [ ] T3 (kind: design) the Claude and Codex audits: prompt, command, the baseline's model, three runs and their cost; waits for his yes — S7; inline
- [ ] T4 (kind: build) the command that runs directive coverage's eval cases and a certification report reading each row against its line with an exit code; waits for his yes — S3, S5; inline
- [ ] T5 (kind: docs) the release record format of row 13 and its first record; waits for his yes — S5; inline
- [ ] T6 (kind: verify) the runs of `## Measures`, each priced with `--plan` first, on his yes to the spend — S1 to S7; inline
- [ ] T7 (kind: docs) `## Result`, from the rows; the Log's predicted against measured — S6; inline

## Log
- L1 (2026-11-18, the brief of JH ORQ for item `s8doc`, from JH PLAN's notes `plan-2026-11-18-away.notes.md`):
  "`odd/tasks/f8-s8-certification.md`, which does not exist: the task contract, the depth pass, the 17 measures and
  the 4 deferred, the release check, one row per measure with its command and its cost, the frozen incident target.
  Also, as a proposal for his later answer and not a decision: the test that says whether S8's result calls for
  S5c-b". "No run that costs: no eval, no audit run." His words behind the stretch (transcript `f5c3ee4d`, line 186):
  "vas a quedar autorizado de darle toda la informacion organizada y completa a el orquestador".
- L2 (2026-11-18): the depth pass refutes running S8 now (item 4). Measured free: the incident scores of every
  recorded run with `incident-score.mjs`; `rules coverage --strict --json` (owed 454 of 543, checked by this session
  after a reader reported it); `failures check --settled` (exit 1, 22 unsettled). The tdd, rule and spanish tallies,
  the Windows days and the 5.7× to 6.7× ratio are one reader's, not re-derived here. The owner is away: what is his
  goes to the lead as a note, not as a question.
