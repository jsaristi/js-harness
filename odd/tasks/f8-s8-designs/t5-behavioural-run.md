# F8 S8 T5: R1's behavioural run, the design

Design only (task T5 of `odd/tasks/f8-s8-certification.md`, spec 3: "directive coverage's full run",
`docs/ROADMAP.md:834-838`). Nothing here is built or paid; every run and threshold below is the owner's to approve.
Written 2026-11-19 by JH 235, version 2 after one double read (read `b9b33782`). Marks: [c] checked here, [i] an
estimate, [a] assumed.

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

## For his decision
That R1 at S8 is the current-arm run of the existing cases (about $13 to $16), with proofs left to S5c-b; and R1's
line in item 5.
