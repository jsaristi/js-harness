# F8 S8 T5: R1's behavioural run, the design

Design only (task T5 of `odd/tasks/f8-s8-certification.md`, spec 3: "directive coverage's full run",
`docs/ROADMAP.md:834-838`). Nothing here is built or paid; every run and every threshold proposed below is the
owner's to approve. Written 2026-11-19 by JH 235. Marks: [c] checked here, [i] an estimate, [a] assumed.

## What exists today
- The paired proof standard is built: `evals/rule-proof.mjs`. A case naming rules runs on the current arm and on
  `current-without-rule-<id>` (`evals/without.mjs`, at most two rules an arm), at least `MIN_TRIALS` = 5 scored
  trials an arm, and proves its rules when `tellsApart`: the current mean above the without mean by more than the
  spread of their trials (`evals/rule-proof.mjs:57`) [c]. Its own header states its errors: about one false proof in
  eleven cases proven at once, and 47% power when a rule's absence fails 3 trials in 10 (81% at 5 in 10) [c].
- The inventory, three lists in three units, kept apart [c]:
  1. **Cases**: 21 under `evals/tasks/`, all 21 owed in the coverage register. Only `rule-away-autonomy` and
     `rule-reuse-first` name a rule; their records (`evals/proofs/rules/*.json`) are format 1, 2 trials an arm,
     and tie (reuse-first 0.714 on both arms). No case is proven.
  2. **Rules without a check**: 24 of the live rules (`rules coverage --json`, class `prose`): 21 held by a
     protocol, 3 by a line (`away-autonomy`, `double-review`, `wording-is-the-need`).
  3. **Owed obligations**: 454 of 542, of which 440 are source spans (orchestrator skill 103, protocols skill 71,
     skill 40, CLAUDE.md 39, …). Spans are text, not behaviour: an eval case closes a rule, never a span count.
- The ten incident cases are C1.1's; they name no rule today.

## The design
1. **Inventory: one case a rule, for the 24 prose rules only, and only where no check can hold the behaviour**
   (a judgment or a question that is his, `docs/proposals/gentle-ai-reverse-engineering.md:1152-1153`). Each
   candidate rule is first asked whether a `bin/` check could hold it; a rule a check can hold leaves the list
   with that check named as a task. The working figure stays 15 to 25 cases [i]. The two existing rule cases are
   rerun under the current bar, not rewritten.
2. **The incident cases are not counted twice.** An incident case may name the rules it exercises, and then its
   paired proof is part of R1; its 20-trial score stays C1.1's, read by `incident-score.mjs`. R1 reports proven
   rules, C1.1 reports the incident score.
3. **A case is valid before it is proven**: its no-op trial scores below its pass line (evals-a-17, a case a no-op
   passes cannot tell arms apart); its grader is not readable from the trial's work root (evals-b-2: an explicit
   `--work-root` outside the checkout, as every S8 run used); its result names the case digest (`caseDigest`,
   which answers evals-a-6 for proofs). Validity is checked free (`evals/task-proof.mjs` per case) before any
   paid trial.
4. **Repeats: the existing bar, 5 trials an arm, 10 a case**, from two runs of one model, effort and permission
   mode. Not raised: more trials alone do not narrow a 0/0.5/1 score's false-proof rate, the spread carries it
   (`evals/rule-proof.mjs:12-13`).
5. **Acceptance, per case**: a current record (`evals/tasks.test.mjs` reads its digests) that clears
   `tellsApart`. A record that does not clear it is reported as "not told apart", never as "the rule does
   nothing". **The run's line, proposed** (no frozen line exists for R1): report proven of attempted, beside the
   expected false proofs at that count (about attempted / 11); R1 passes when every attempted case has a current
   record and the proven count exceeds the expected false proofs by at least 3 [a, his to set].
6. **At S8, after the proofs**: the proven cases on the current arm only, 2 trials each, as a regression read
   (`gentle-ai-reverse-engineering.md:1163`), scored like the incident set.

## Cost [i]
At $0.56 to $0.65 a trial (`gentle-ai-reverse-engineering.md:1154-1158`), API-equivalent, on his plan's limits:
- proofs: 15 to 25 cases × 10 trials = 150 to 250 trials, $84 to $163;
- the two existing cases re-proven: 20 trials, $11 to $13;
- the S8 regression read: up to 25 cases × 2 = 50 trials, $28 to $33;
- writing the cases: one to two hours each (`:1152-1153`), 15 to 50 hours of session time.
Total paid: about $123 to $209, against the S8 document's $79 to $117, which priced 2 trials a case.

## Out of scope
S5c-b's filling (whether it runs is S8's open result); new grader code; the incident set's fixture faults (Ask 5 of
the S8 document).

## For his decision
The case list once item 1 has run; the run's line in item 5; the spend.
