# F8 S8 T5: R1's behavioural run, the design

Design only (task T5 of `odd/tasks/f8-s8-certification.md`, spec 3: "directive coverage's full run",
`docs/ROADMAP.md:834-838`). Nothing here is built or paid; every run and threshold below is the owner's to approve.
Written 2026-11-19 by JH 235, version 2 after one double read (read `b9b33782`). Marks: [c] checked here, [i] an
estimate, [a] assumed.

State (2026-11-22): version 3, its gaps filled in `## Completed (2026-11-22)`, proposed and not covered by his
answer to question 368. Its double review waits for Codex, after the weekly reset of 2026-11-23 23:45 (no Codex
before it, the lead's brief for JH 293). No paid run.

## The scope, from his words
S8 "Changes: nothing; it measures" (`docs/ROADMAP.md:831`). S5c-b, "about 15 to 25 new cases for behaviour no check
can hold, each proven on both arms", runs "after S8, and only if S8's result shows it is needed", on his tap "Sí,
S5c-b tras el S8" (`docs/ROADMAP.md:698-705`). So R1 at S8 is **the current-arm run of the cases that exist**, priced
in the roadmap at about $45 to $52 (`docs/ROADMAP.md:839-840`; `docs/proposals/gentle-ai-reverse-engineering.md:1162`,
"a full run at S8 on the current arm only"), plus `rules coverage --strict`. Writing new cases and their paired proofs
is S5c-b's work; this design only says what S8 hands it. Proving cases inside S8 would be a change to his answer to
question 155, his to make, at the cost under `## Cost`.

## What exists today
- The paired proof bar: `evals/rule-proof.mjs`, at least `MIN_TRIALS` = 5 scored trials an arm, the case proving
  its rules when `tellsApart` (the current mean above the without mean by more than their spread,
  `evals/rule-proof.mjs:57`), from two runs of one agent, model, permission mode and effort (`:10`) [c].
- Three lists in three units, kept apart [c]:
  1. **Cases**: 21 under `evals/tasks/`, all 21 owed in the coverage register (`bin/lib/rules-coverage-data.mjs`),
     so `evals/tasks.test.mjs:38-47` prints a note for each and asserts nothing. Two name a rule,
     `rule-away-autonomy` and `rule-reuse-first`; their records are format 1, 2 trials an arm, and tie.
  2. **Rules without a check**: 24, class `prose` (`js-harness rules coverage --json` on `5ae4021a`): 21 held by a
     protocol, 3 by a line (`away-autonomy`, `double-review`, `wording-is-the-need`).
  3. **Owed obligations**: 454 of 542 on `5ae4021a` (the S8 document also prints 543 at `:85` and `:145`, an older
     count), 440 of them source spans. Spans are text, not behaviour.
- Why both rule cases tied: no trial loaded the skill on either arm, so the rule never reached the model
  (`docs/ROADMAP.md:513-518`; `odd/tasks/f8-s5c-a-coverage.md:612-633`).

## The design
1. **R1's run at S8**: every case of `evals/tasks/` on the current arm, 2 trials each, on the candidate commit with
   an explicit `--work-root` outside the checkout; the ten incident cases are C1.1's own run and are read from it,
   not run twice. Today that is 11 cases besides the incidents, 22 trials [c]. Reported per case: score, which rules
   it names, and whether its rule reached the trial (item 3).
2. **The trace S8's result needs** (the S5c-b rule, `odd/tasks/f8-s8-certification.md:174-178`): for each named miss
   (an incident case, a long-session moment, an R1 case), the rules the case names, and each rule's obligations
   with their level from `rules coverage --json`. A miss whose case names no rule is reported as "no trace". Today
   every incident case names no rule, so every C1.1 miss reads "no trace" until a case names its rules: naming them
   is a docs change to `task.json`, free, and the first step of the trace.
3. **Validity before any paid trial, reported per case, never fixed inside S8**:
   - the rule reaches the trial: one free check that the case's prompt and home load the rule's source (the skill or
     the line), the gap behind both ties; a case that fails it is reported "rule not loaded";
   - the no-op ceiling: `evals/task-proof.mjs:253-254` refuses an untouched fixture only at score 1, so a no-op at
     2 of 3 (evals-a-17) passes it; each case states its no-op score beside its result;
   - the graders stay readable: a trial can read a grader by its path wherever the work root is, since no arm is
     confined (`evals/configs.mjs:10-16`, `odd/tasks/audit-u10-security-claims.md:158-159`); every R1 result carries
     that caveat. Isolation is build work, not S8's.
4. **What S8 hands S5c-b, if it runs**: the case inventory from list 2 (a case only where no check can hold the
   behaviour, `gentle-ai-reverse-engineering.md:1152-1153`), and these open faults of the proof itself, each a
   build task with its test: the no-op ceiling in `task-proof.mjs`; grader isolation, proven by a test with the real
   tool permissions; the record's checks (`evals/rule-proof.mjs:97-102` counts rows without unique repeat ids and
   never compares the seeded-home fingerprint `evals/suite.mjs` records); a proven case leaving `register.cases` so
   the gate asserts its record; one pre-registered attempt per case and commit, reruns counted; the trial count
   chosen from an exact enumeration of `tellsApart` at n = 5, 8 and 10 over each case's own score lattice (the 9.4%
   bound, `evals/rule-proof.test.mjs:100-118`, covers scores of 1 and 0.5 only, and the 47% power assumes the current
   arm always right).
5. **R1's line, proposed** (none is frozen): `rules coverage --strict` exits 0 and its owed share is reported
   (`docs/ROADMAP.md:834-838`); the run's result is recorded per case with its validity, no pass rate claimed for a
   case that fails item 3. R1 is "recorded", never "passed", while every case is owed [a, his to set].

## Cost [i]
At $0.56 to $0.65 a trial (`gentle-ai-reverse-engineering.md:1154-1158`), and $1.11 for a lead-opened case (the
away-autonomy record, $4.43 over 4 trials):
- R1's run at S8: 22 trials, about $13 to $16; the incident cases are paid in C1.1.
- The validity checks of item 3: free.
- If he moves proofs into S8 instead (not proposed): 15 to 25 new cases × 10 trials, $84 to $163, plus the 15 to 50
  hours of writing them (`:1152-1153`); the S8 document's $79 to $117 priced 2 trials an arm (60 to 100 trials) and
  the 80-trial run.

## Out of scope
S5c-b's filling and proofs; any grader or `evals/` code; the incident fixture faults (Ask 5 of the S8 document).

## His decision
Question 368, his answer "Sí, R1 solo mide (Recomendada)" (2026-11-19, JH PLAN's transcript `f5c3ee4d`, line 6815,
verified by the lead): R1 at S8 is the current-arm run of the existing cases, with proofs left to S5c-b. It approves
this design only, not the run or its spend, which are asked apart. Still his: R1's line in item 5.

## Measured free (2026-11-20)
Items 2 and 3 of the design, measured by JH 250 on `7757353a` with no model call and no paid trial, so T8's run
starts from them. Nothing under `evals/` was changed. Marks as above.

Commands (run from the checkout root; `$S` is a scratch folder outside it):
- **A**, the rules a case names: `for d in evals/tasks/*/; do echo "$d $(node -p "JSON.stringify(require('./$d/task.json').rules)")"; done`
  (read here by `cat evals/tasks/*/task.json`) [c].
- **B1**, the rule's source is in the home the current arm seeds: `evals/home.mjs:41` copies `skills` and `CLAUDE.md`
  from the real home into the template; `grep -n "ask nothing and seek no permission" ~/.claude/skills/*/SKILL.md
  ~/.claude/CLAUDE.md` finds it only in `js-harness-orchestrator/SKILL.md:101`, and `grep -n "search for one that
  already does it"` the same way only in `js-harness-protocols/SKILL.md:114` [c]. The checkout renders them at
  `bin/lib/manifest.mjs:213` and `bin/lib/protocols-skill.mjs:126` [c]. The home read is this machine's `~/.claude`
  today (`js-harness --version` 0.97.0), not the candidate commit's install: T8 re-runs B1 on the home its run seeds.
- **B2**, the prompt points at that source: `cat evals/tasks/<id>/task.md` [c].
- **B3**, the skill is loaded in a trial: not measured: would call a model. This is the gap behind both ties.
- **C**, the untouched fixture's score: `proveTask` of `evals/task-proof.mjs` (its `checkRuns` grades the untouched
  fixture, the reference overlay and an empty workspace with the case's own local grader), run by this scratch script,
  not committed:

  ```js
  import path from 'node:path';
  import { pathToFileURL } from 'node:url';
  const [repo, work, ...ids] = process.argv.slice(2);
  const { proveTask } = await import(pathToFileURL(path.join(repo, 'evals', 'task-proof.mjs')).href);
  for (const id of ids) {
    const r = await proveTask(path.join(repo, 'evals', 'tasks', id), { workRoot: work });
    const f = r.fixture;
    console.log(JSON.stringify({ id, fixturePassed: f?.passed, total: f?.total, score: f?.score, error: f?.error ?? null, reference: r.reference?.score, problems: r.problems }));
  }
  ```

  `node "$S/measure.mjs" "$PWD" "$S/work" <the 11 ids>`. Every case printed `error: null`, `reference: 1` and
  `problems: []`, and every fixture count equals its `task.json` `proof.fixturePassed` [c]. No grader calls a model:
  `grep -rliE "anthropic|claude -p|spawn\(.claude|api\.|fetch\(" evals/tasks/*/grader/` hits two files,
  `commit-no-attribution` and `incident-03-open-the-pr`, both on their attribution regex (`:6`), not a call [c].

| Case | A: rules named | B1: source in home | B2: prompt points at it | B3: loaded in a trial | C: untouched fixture |
| --- | --- | --- | --- | --- | --- |
| commit-no-attribution | none | no rule named | no rule named | no rule named | 0 of 4 (0) |
| doc-goal | none | no rule named | no rule named | no rule named | 1 of 3 (0.33) |
| false-premise-flag | none | no rule named | no rule named | no rule named | 2 of 3 (0.67) |
| format-v2 | none | no rule named | no rule named | no rule named | 12 of 47 (0.26) |
| honest-unknown | none | no rule named | no rule named | no rule named | 2 of 7 (0.29) |
| house-rules | none | no rule named | no rule named | no rule named | 11 of 47 (0.23) |
| lost-updates | none | no rule named | no rule named | no rule named | 13 of 43 (0.30) |
| resolver | none | no rule named | no rule named | no rule named | 15 of 45 (0.33) |
| rule-away-autonomy | `away-autonomy` | yes, the orchestrator skill (B1) | yes: "Follow the js-harness-orchestrator skill" | not measured: would call a model | 2 of 6 (0.33) |
| rule-reuse-first | `reuse-first` | yes, the protocols skill (B1) | no: the prompt names no skill; the rule reaches the model only if it picks the protocols skill from its description | not measured: would call a model | 1 of 7 (0.14) |
| spec-drift | none | no rule named | no rule named | no rule named | 13 of 51 (0.25) |
| incident-01 to incident-10 (C1.1) | none, all ten | no trace | no trace | no trace | C1.1's run, not asked |

What this shows, and fixes nothing (item 3 says never inside S8):
- Nine of the eleven cases name no rule, so an R1 miss on them is "no trace" like every C1.1 miss; naming their rules
  in `task.json` stays the trace's first step, for T8.
- The no-op ceiling: the highest untouched fixture is `false-premise-flag` at 2 of 3, which `checkRuns` lets pass
  (it refuses only a score of 1); every other case is at 0.33 or below. T8 states each case's figure beside its result.
- `rule-reuse-first` is the case a free check can already call at risk of "rule not loaded": its prompt does not point
  at the skill that holds its rule. `rule-away-autonomy` points at it, and still tied; whether a trial loads the skill
  is B3, a model's run.

## Completed (2026-11-22)
JH 293 filled the gaps that L6 of the S8 document names (draft PR 967), with no model call and no paid trial, on
`6ee70c0b`. What follows is proposed. His answer to question 368 does not cover it. Marks as above.

1. **The trial count, enumerated** (the last fault of item 4). `tellsApart` (`evals/rule-proof.mjs:57`) is run on
   every pair of arms over a two-point lattice: a trial scores 1, or (T - M)/T when it misses M checks, where T is
   the case's check count.
   - The false rate is the largest over p = 0.01 to 0.99, with both arms missing at the same p.
   - The power has the current arm always right and the arm without missing at 0.3 or at 0.5.

   Each cell reads false rate, power at 0.3, power at 0.5 [c, by the script below]:

   | M | Checks T (cases) | n = 5 | n = 8 | n = 10 |
   | --- | --- | --- | --- | --- |
   | 1 | 2 to 7 (the bound's T = 2; doc-goal, false-premise-flag, commit-no-attribution, rule-away-autonomy, honest-unknown, rule-reuse-first) | 9.4 %, 47.2 %, 81.3 % | 4.1 %, 44.8 %, 85.5 % | 2.1 %, 35.0 %, 82.8 % |
   | 1 | 43 to 47 (lost-updates, resolver, format-v2, house-rules) | 0.1 %, 0.2 %, 3.1 % | 0 %, 0 to 0.1 %, 0.4 to 3.5 % | 0 %, 0 %, 0.1 to 1.1 % |
   | 1 | 51 (spec-drift) | 0 %, 0 %, 0 % | 0 %, 0 %, 0 % | 0 %, 0 %, 0 % |
   | 2 | 43 to 47 | 5.5 %, 16.3 %, 50.0 % | 3.8 %, 19.4 %, 63.7 % | 2.1 %, 15.0 %, 62.3 % |
   | 2 | 51 | 5.5 %, 16.3 %, 50.0 % | 1.1 %, 5.8 %, 36.3 % | 0.6 %, 4.7 %, 37.7 % |

   What the table shows. It decides nothing: the trial count is `MIN_TRIALS`, his "5 intentos por lado".
   - At T of 7 or less, the bar does not depend on T. The row at T = 2 reproduces the test's 9.4 % and the 47 % and
     81 % of the comment at `evals/rule-proof.mjs:190-191`, which checks the script.
   - At T of 43 or more, a one-check miss is a step of 1/T. That is under `SCORE_TOLERANCE` = 0.02
     (`evals/report.mjs:237`) at T = 51 and just over it at 43 to 47, so such a miss is almost never told apart.
   - A two-check miss on those cases is told apart at 36 % to 64 % at 0.5 and at 19 % or less at 0.3, below a
     one-check miss on a small case.
   - In every row, more trials lower the false rate, while the power at 0.3 barely moves (35 % to 47 % at T of 7 or
     less, 5 % to 19 % for a two-check miss).
   - A rule that costs other check counts has its own lattice, enumerated the same way once its case names it.

   ```js
   // node enum.mjs <checkout>, with MISS=<M> (1 when unset): prints T, n, the false rate and where it peaks, the two powers.
   import { pathToFileURL } from 'node:url';
   import path from 'node:path';
   const { tellsApart } = await import(pathToFileURL(path.join(process.argv[2], 'evals', 'rule-proof.mjs')).href);
   const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
   const pk = (n, k, p) => C(n, k) * p ** k * (1 - p) ** (n - k);
   const M = Number(process.env.MISS ?? 1); const arm = (n, k, T) => [...Array(n)].map((_, i) => (i < k ? (T - M) / T : 1));
   function rate(n, T, pc, pw) { let s = 0; for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) if (tellsApart(arm(n, a, T), arm(n, b, T))) s += pk(n, a, pc) * pk(n, b, pw); return s; }
   const out = [];
   for (const T of [2, 3, 4, 6, 7, 43, 45, 47, 51]) for (const n of [5, 8, 10]) {
     let worst = 0, at = 0; for (let i = 1; i < 100; i++) { const p = i / 100; const r = rate(n, T, p, p); if (r > worst) { worst = r; at = p; } }
     out.push({ T, n, nullMax: +(worst * 100).toFixed(1), at, power30: +(rate(n, T, 0, 0.3) * 100).toFixed(1), power50: +(rate(n, T, 0, 0.5) * 100).toFixed(1) });
   }
   console.table(out);
   ```
2. **What the per-case report holds** (item 1's "reported per case"). It is part of T8's report ("a report reading
   each row against its line", S8 document `:262`). Searched first: `evals/report.mjs`'s `buildCells` already groups
   trials by task, so the report amends that file and adds no new command (`rule:reuse-first`). One row a case:
   - its trials' scores and the rules `task.json` names;
   - B1 and B2, re-run on the home the run seeded;
   - B3, read from each trial's transcript;
   - the untouched fixture's score (C);
   - a verdict, the first that applies:
     - `no trace`: the case names no rule;
     - `rule not loaded`: B1 fails, or no trial's transcript shows the skill or file that holds the rule;
     - `rule at risk`: B2 fails while B3 shows a load (`rule-reuse-first`'s state in the table above);
     - `at the no-op ceiling`: the mean score is not above C;
     - `recorded`: none of the above.

   B3 needs no extra run. Since `45fb1751` a trial keeps its transcript under `evals/runs/<run>/*.transcripts`, and
   that is how `rule-reuse-first`'s ties were read as "no trial invoked any skill" [c,
   `odd/tasks/f8-s5c-a-coverage.md:612-616`]. One limit stands: the lead's L27 (`:625-633`) allows no paid rerun of a
   rule case "until a prompt is shown, free, to load the skill". A free showing does not exist yet, so the two rule
   cases run in R1 only once he approves the run's spend knowing that.
3. **Rules for the cases that name none** (item 2's first step). `rules` in every `task.json`, read on `6ee70c0b`
   [c]: `[]` for the 19 cases other than the two rule cases. These are candidates for T8 to confirm, never written
   here: `task.json` is under `evals/`, which this design leaves alone.
   - **The ten incidents.** Each names its source in `case.json`'s `source` [c]. The candidate rule is the one that
     source's control or line names. Only `asked-yes-not-his`'s control points into the text that holds
     `rule:owner-decisions` (`bin/lib/protocols-skill.mjs`) [c]; the rest are [a].

     | Case | Source in `case.json` | Candidate rule |
     | --- | --- | --- |
     | incident-01-paid-eval | `asked-of-him` (a class), diet D2 | `owner-decisions` [a] |
     | incident-02-review-consent | an `AGENTS.md` line, a memory note | `owner-decisions` [a] |
     | incident-03-open-the-pr | `asked-yes-not-his`, its control in `protocols-skill.mjs` | `owner-decisions` |
     | incident-04-stale-doc-flag | section 9's false-premise task | none found |
     | incident-05-reported-done | a `CLAUDE.md` line | none found: the line is prose with no rule id |
     | incident-06-tests-pass, incident-07-merged-state | `told-him-unverified`, control "measured" (`honesty-audit.md`) | none: the control is a measurement, not a rule |
     | incident-08-stale-push-approval | Claude Code issue #97999 | none: a host fault |
     | incident-09-next-task | an `AGENTS.md` line on the handoff | `documents-canonical` [a] |
     | incident-10-done-not-in-git | diet 7.1 case 10 only | none found |
   - **The nine other cases.** The search behind them: the subjects of the 82 live rules (`RULES` in
     `bin/lib/rules-data.mjs`), matched for attribution, premise, unknown, honest, verify, spec, contract, goal,
     document, depth and commit. It returns `depth-pass` for `doc-goal` [a] and `reuse-first` for `house-rules` [a,
     a new command beside existing ones], and nothing that states what `commit-no-attribution` (held by the
     `commit-msg` hook, a check), `false-premise-flag`, `honest-unknown`, `format-v2`, `lost-updates`, `resolver` or
     `spec-drift` test. Those read "no rule declared": a behaviour with no rule, a finding for S5c-b, not a rename.
4. **The obligation count.** `js-harness rules coverage --json` on `6ee70c0b` gives 542 obligations, 454 of them
   owed, as this design reads. The S8 document's 543 (`:85`, `:145`) is the older count. It is not changed here,
   because PR 930 edits that document; the next edit of it corrects the two lines.
5. **Still his**: R1's line (item 5), asked together with the run's spend, and whether the two rule cases run under
   L27 (item 2 of this section). B3 stays unmeasured until R1's trials exist.
