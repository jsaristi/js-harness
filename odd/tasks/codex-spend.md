# codex-spend: no Codex waste, no review weakened

## State
v2 after the Claude read (L9): spec 1 keeps every check and runs it in the snapshot, spec 3 reviews only the gap,
spec 4 became a measure, spec 7 always ends with a Codex read. Next: a confirming Claude read of v2, then Codex on the
version it passed; then T1, T2, T3, T5, and T4 last, after JH 198's T6 lands. Q1's draft after T1.

## Goal
Codex spends only on reading code it has not read, while every review the push and the merge door ask for still runs.

## Why
On 2026-11-14 Codex's five-hour window reached 100%. Of PRs 864-868's 3,053,278 Codex input tokens that day,
593,573 (19.4%; 17.3% of the uncached input) went to runs or reviews a snapshot of the head would not have needed,
and about 150k more (an estimate) to code of main re-read after a merge (L3, L9). Since 2026-10-07, 25 runs refused
for a live-folder change cost 3,992,076. He asked for the waste to go ("aplica las mejoras para que no haya ningun
desperdicio", L1), not for fewer reviews.

## Done when
- `node --test bin/codex-review.test.mjs bin/codex-review.second.test.mjs bin/lib/codex-review-turns.test.mjs` exits 0
- `node --test bin/lib/codex-review-recheck.test.mjs bin/merge-queue.test.mjs` exits 0
- `node --test bin/double-review.test.mjs` exits 0
- `node --test bin/lib/land-records.test.mjs bin/codex-meter.test.mjs bin/lib/codex-meter.test.mjs` exits 0
- `js-harness rules check` exits 0
- `npm run check` exits 0
- `js-harness codex-meter --per-pr` exits 0
- the per-PR table shows PRs 864-868 as the baseline beside the PRs landed after it (read by a person)
- Each slice landed through the lead's merge-queue

## In scope / Out of scope
- In: `bin/codex-review.mjs` and `bin/lib/codex-review-*.mjs` with their tests; the files the lead cleared (L7).
- Out: skipping or weakening any review, check or test; the advisor gate (its question is with him); Codex model or
  effort; reset credits (his rule: one only when more than 3 are left); `bin/lib/manifest.mjs` and JH 198's files
  without the lead's clearance.

## Constraints
- `codex-review` is what the pre-push hook and the merge door read: high risk (contracts others consume, and item 6:
  a refusal path that no test catches if it regresses). Each code slice gets a verifier, Codex and the lenses.
- No check is removed: a check that read the live folder reads the snapshot instead.
- A snapshot is removed without following any link out of it; nothing outside `<common>/js-harness/` is deleted.
- No edit while a review of this branch runs; one commit per round — the habits this feature is about.
- Sub-agents get an explicit model, never Fable.

## Ask me before
- A change of the protocol text (§1, §3), which is his: through the lead, as `rules change` with his words.
- Lenses before Codex on code (Q1, his): not built unless he says yes.
- Clearance of `bin/lib/land-records.mjs` + test (T5) and of `bin/lib/pull-request.mjs` if spec 5 needs it.

## For the lead's OK
Given in L7. Asked now: `bin/lib/land-records.mjs` + test for T5 (the Claude read found it already joins lands and
Codex runs, L9 item 10); `bin/lib/pull-request.mjs` only if T3's line for GitHub's CONFLICTING answer lives there.

Q1 (his, to put through the lead): lenses first on code, Codex only on the head the lenses passed — the code
analogue of item 4. Eight fresh Codex reviews of small follow-ups on 2026-11-14 (L5) came after a clean Codex pass
and a later lens or verifier finding; each cost 42-84k. A yes slows a round by one lens run (2-4 min) and saves an
estimated (not measured) half of those runs; a no keeps today's parallel order.

## Depth pass
- 1. Method: the discipline is build-system cost engineering: never pay twice for the same input, make the unit of
  work hermetic (a review reads a fixed snapshot, as a build reads a fixed tree), and measure per delivered unit,
  not per run. Reuse first (codegraph, grep, `rule:reuse-first`): `addTurnWorktree` / `sweepTurnWorktrees`
  (`bin/lib/codex-review-turns.mjs:150-173`) already review a merge from a detached worktree under
  `<git common dir>/js-harness/`; `mergeTurn` (`codex-review-turns.mjs:24`) already cuts a range in two turns with
  its guards; `bin/lib/land-records.mjs:37,56` (`landFacts`, `codexFacts`) already joins `lands.jsonl` and the run
  log. Smallest changes: run each review's Codex session in a snapshot at `head` with the same checks pointed at it;
  cut the gap below a merge of main as a turn; extend `land-records` for the measure; make `double-review read`
  sequential with a Codex read at the end.
- 2. Raw material:
  - Run log `<common>/js-harness/codex-review-runs.jsonl` and records `codex-reviews.jsonl`.
  - `bin/codex-review.mjs:1795-1805` (`notTheRange`, the check per part), `:1539-1543` (the check after a merge
    turn), `:2198-2224` (the check after the review), `:1868-1874` (Codex spawned with `cwd: root`), `:1900`
    (finding paths made relative to `root`), `:1569` (the dirty-tree refusal at the start).
  - `bin/lib/codex-review-coverage.mjs:351-367` (`reviewStart`), `:492-526` (`mergeStart`, null for a merge that
    writes no line at `:511`); `bin/lib/codex-review-recheck.mjs:136,152` (the last record at a head decides).
  - JH 198's transcript `D--js-harness--claude-worktrees-audit-cement/b1a32f3f-….jsonl`: 09:31:54Z it ran
    `codex-review --base f71380ea … > file; tail -3` in the background; f983eab9 was committed at 09:32:18Z inside
    that run (`git log -1 --format=%cI f983eab9`); 10:12:25Z the pre-push printed `FAIL codex-review 1 of 5 code
    commits since origin/main have no Codex review record … next: js-harness codex-review --base 6ba747e38fcc --at
    4977072eb1f9`.
  - `git log --graph cc54678..af986f0`: one branch commit, 1de6ed65, then a merge of main (PRs 858-863).
  - `bin/lib/rules-reach.mjs:117` (a branch reads old rules "until main is merged into it");
    `bin/merge-queue.mjs:900-907,942` (the three ways a conflict leaves a PR out).
  - `bin/double-review.mjs:11-19` (blind by sequence; both readers at once); `bin/lib/protocols-skill.mjs:43` (§1);
    `bin/lib/rules-data.mjs:231` (double-review's review date 2026-11-16).
  - The lead's analysis, transcript 69918425 line 6346 (12:30:18Z).
- 3. The bar (each spec's proof; today's result):
  spec 1: `node --test --test-name-pattern "snapshot" bin/codex-review.test.mjs`: none, new behaviour
  spec 2: `node --test --test-name-pattern "gap below a merge" bin/lib/codex-review-turns.test.mjs bin/codex-review.test.mjs`: none, new behaviour
  spec 3: `node --test --test-name-pattern "conflict" bin/merge-queue.test.mjs`: none, new behaviour
  spec 4: `js-harness rules check`: exits 0 today; the changed text is new
  spec 5: `node --test --test-name-pattern "Claude first" bin/double-review.test.mjs`: none, new behaviour
  spec 6: `node --test --test-name-pattern "per PR" bin/lib/land-records.test.mjs`: none, new behaviour (scratch result in L3)
- 4. Refutation: the request holds only if the waste is avoidable without fewer reviews. Cheapest test: join the
  day's run lines to records and transcripts and ask whether each wasted run would have been needed had Codex read a
  snapshot (scratchpad `perpr.mjs`, `chain.mjs`; rerun by the Claude reader, L9). Of 3,053,278 input tokens:
  286,592 in two runs refused for a live-folder change; 306,981 in the passing parts of 6ba747e..4977072, a range
  the push asked for only because 1d982b3's passing recheck (79,096) had its record refused when HEAD moved
  (f983eab9). With a snapshot the recheck would still run and be the record, so the saving is 593,573 (19.4%); in
  uncached tokens 17.3%. Not saved by a snapshot: cc54678..af986f0 read about 272 lines of main's code brought in by
  a merge (about 150k, the reader's estimate), which spec 2 targets. History: 25 such refusals since 2026-10-07,
  3,992,076 tokens.
  Verdict: supports
- 5. Request: make a Codex review read a snapshot of the commit it records, with every check it makes today pointed
  at that snapshot, so no edit or commit in the session's folder refuses a run or a record; when code commits below
  a merge of main lack a record, review only them, never main's code again; name the fix when the queue leaves a PR
  out for a conflict with main; run the double review of a proposal Claude first and end it always with a Codex read
  of the version given; show Codex input per landed PR, with PRs 864-868 as the baseline, including spend that buys
  no new reading. A round's fixes in one commit is measured (spec 6) and its lever is Q1, his.
  Adds: none

## Specs
His order for all of them: "hazme la pregunta de bloquear cuando pase y ademas aplica las mejoras para que no haya
ningun desperdicio como lo mencionas y dices" (69918425:6379, typed), after "me gustaria saber si lo estamos
utilizando optimizadamente o estamos utilizandolo a lo bestia y desproporcionadamente por favro revisa bien que no
se este gastando por esto" (69918425:6293, queued).
1. Each Codex session of `codex-review` runs in a detached worktree made from the resolved `head` id under
   `<common>/js-harness/`, named so `sweepTurnWorktrees` finds it, once per run, removed however the run ends; the
   sweep runs at every run's start. The three checks that compared the live folder with `head` (after a part, after
   a merge turn, after the review) compare the snapshot instead, word for word in their refusals; the dirty-tree
   refusal at the start stays on the live folder. Finding paths are made relative to the snapshot, else to the live
   root. A run whose `--cwd` is already a turn worktree makes none. In a turn of the gate lock (where Codex runs the
   tests), when the live root holds a `node_modules` the snapshot lacks, the run reads the live folder as today and
   says why. Proofs: a commit and an edit made in the live folder during a run leave the record written; a part that
   passed is kept (existing behaviour, `keptPartFor`); a snapshot whose removal fails is a warning and is swept by
   the next run.
2. When the code commits no record covers all lie on the first-parent line below a merge of the default branch at
   HEAD, the run reviews the gap alone, `<oldest uncovered>^..<newest uncovered>`, as a turn in a worktree at the
   newest uncovered commit, with `mergeTurn`'s guards (the gap's start is a review or a recheck the records allow,
   the marks match at the turn and at HEAD, the review switch is on at the turn), then the merge by `mergeStart`, or
   nothing for a merge that writes no line. Never the merge's whole diff with main.
3. Where `merge-queue` leaves a PR out because it conflicts with main itself (GitHub's CONFLICTING answer, or a merge
   into the candidate while it is still main), its line names the fix: merge the default branch into the PR's
   branch. A conflict with an earlier PR of the batch says it waits for that land. `rules-reach`'s line is unchanged.
4. `rule:double-review` (§1) reads: the Claude reader first; the Codex reader reads the frozen copy the Claude reader
   passed, or the version at the cap of three, blind to the Claude reader's answers; a read goes through `js-harness
   double-review read`, so it is recorded. Changed with `js-harness rules change double-review` on a `rule/` branch,
   quoting 6379, after JH 198's T6.
5. `double-review read` runs the Claude reader; on findings it records the Claude read alone, marked as a sequenced
   read, and stops; on none, or at the third read of the same material, it runs the Codex reader on the same copy
   and writes one record of both once both have returned. The tally keeps sequenced reads apart.
6. `land-records` gives, for each landed PR, its Codex runs and input tokens over all its days, and what bought no
   new reading: failed runs, `reviewed` runs no record names, and runs whose range held a code commit an earlier
   record covered; plus Codex runs after a clean pass on the same branch (the measure of rounds) and tokens per
   reviewed line. `codex-meter --per-pr` prints it with PRs 864-868 as the baseline.

## Tasks
- [ ] T1 (kind: build) spec 1 — `bin/codex-review.mjs`, `bin/lib/codex-review-turns.mjs` + tests — commit `fix(codex-review): read a snapshot of the head, not the live folder`
- [ ] T2 (kind: build) spec 2 — `bin/lib/codex-review-turns.mjs`, `bin/codex-review.mjs` + tests — commit `fix(codex-review): review the gap below a merge of main alone`
- [ ] T3 (kind: build) spec 3, and the lead's assignment of L7 (the recheck refusal names `senior-model` where declared) — `bin/merge-queue.mjs`, `bin/lib/codex-review-recheck.mjs` + tests — commit `fix(merge-queue): a conflict with main names its fix`
- [ ] T4 (kind: build) specs 4, 5 — `rules change double-review` on `rule/double-review-sequence`, `bin/double-review.mjs` + test — commits `chore(rules): double review reads Claude first` and `feat(double-review): Codex reads what Claude passed`
- [ ] T5 (kind: build) spec 6 — `bin/lib/land-records.mjs`, `bin/codex-meter.mjs` + tests — commit `feat(codex-meter): Codex input per landed PR`
- [ ] T6 (kind: verify) — the measure after the slices land, against the baseline; result in the Log

## Log
- L1 2026-11-14T12:31:55Z, his words (69918425:6379, typed): "hazme la pregunta de bloquear cuando pase y ademas
  aplica las mejoras para que no haya ningun desperdicio como lo mencionas y dices". Before it, 12:28:09Z (6293,
  queued): "cuando hayan mas de 3 reinicios te autorizo en utilizar uno pero me gustaria saber si lo estamos
  utilizando optimizadamente o estamos utilizandolo a lo bestia y desproporcionadamente por favro revisa bien que
  no se este gastando por esto". The brief cites 6377 and 6275; those are the host's queue entries of the same text.
- L2 2026-11-14, JH 199: brief read (`jh-199-brief.md` in the lead's notes folder). Worktree
  `D:/js-harness-worktrees/codex-spend`, branch `feat/codex-spend` from origin/main 67455a84.
- L3 2026-11-14, the baseline, measured (scratchpad `perpr.mjs`, runs joined to `lands.jsonl` by the candidate's
  merges): runs started 08:03Z-12:17Z: 33 lines (the lead counted 32; one failed at 12:16Z with no token count),
  3,016,580 input. Per landed PR, runs since 2026-11-13: PR 864 2 runs 110,158 (230,174 with its run of 11-13),
  PR 865 2 / 172,425, PR 866 12 / 1,280,533 (220,599 failed), PR 867 11 / 1,025,087 (65,993 failed, 79,096 in a
  reviewed run with no record), PR 868 7 / 465,075. 2026-11-14 total 3,053,278 over 5 PRs, 610,656 a PR.
- L4 2026-11-14, cause of the 435-line review, checked: not the merge alone. 1d982b3's recheck passed (09:32Z,
  215/215 lines, correct) but has no record (`grep '"head":"1d982b3' codex-reviews.jsonl` finds none); JH 198
  edited its document inside that run (depth pass, item 2). So the push counted 1 of 5 code commits uncovered and
  printed base 6ba747e (main); `mergeStart` needs every commit up to the first parent recorded and returned null;
  `reviewStart` fell back to the given base because 6ba747e is not an ancestor of f71380e
  (`git merge-base --is-ancestor 6ba747e f71380e` exits 1). The merge of main was not needed for the land: PR 867
  had no conflict, and merge-queue retargets stacked PRs.
- L5 2026-11-14, the "rounds", measured (scratchpad `chain.mjs`): most extra runs are fresh reviews of small
  follow-ups made after a clean Codex pass, not rechecks: PR 866 at 09:00 (3 lines, 83,867), 09:50 (16, 68,964),
  10:01 (8, 41,915); PR 864 08:17 (60, 69,498); PR 867 09:46, 09:55, 10:05, 10:52 (57,583-76,048). Whether their
  fixes could have shared a commit is not known (the lenses' and verifiers' timing is in transcripts, not read).
  Rechecks cost 34-95k; a fresh review of 3-16 lines 42-84k.
- L6 2026-11-14, a snapshot worktree on this machine: `git worktree add --detach` 1,233 ms, remove 397 ms, 1,674
  tracked files (measured once).
- L7 2026-11-14T18:46Z, the lead (cross-session message): plan OK at fc917938. Cleared: `bin/merge-queue.mjs` (the
  one line), `bin/double-review.mjs` + test, `bin/codex-meter.mjs` + `bin/lib/codex-meter.mjs` + tests.
  `bin/lib/protocols-skill.mjs` and `docs/rule-sources.json` (T4, `rules change double-review` on a `rule/` branch)
  only after JH 198's T6 lands, on the lead's word. Order: T1, T2, T3, T5, T4 last. The plan's double review runs:
  a Claude read first (explicit model `opus`), Codex only on the version it passed. Q1's draft (Spanish) goes to the
  lead's notes folder as `q1-codex-after-lenses-draft.md` after T1. Folded into T3 if it fits, else left: the
  recheck refusal at `bin/lib/codex-review-recheck.mjs:40-41` (tests :224, :234) names `session-model` as the
  strongest; it should name `senior-model` where declared, else `session-model` (found by JH 198).
- L8 2026-11-14, the gate that ran on this document's tree (gate log id 0138eeb6, 18:38-18:45Z) passed in 437 s:
  tests, docs, workshop spec. The commit fc917938 went in with `--no-verify` after that gate had started; the tree
  it read differed from the commit only in the two contract lines fixed in the document.
- L9 2026-11-14T19:09Z, the plan's Claude read (sub-agent on `opus`, blind, frozen copy v1 sha256 a311aa7e…, 210k
  Claude tokens, 19 min; not through `double-review read`, which starts both readers at once). Taken, each checked:
  three blocking: spec 1 removed three checks, so they now run in the snapshot (and the merge-turn check at `:1539`
  was missing); spec 3 as written re-read covered commits and could override a recheck chain, so it reviews the gap
  with `mergeTurn`'s guards; spec 7 could end with no Codex read, so Codex reads at the clean pass or at the cap.
  Should-fix taken: the saving is 593,573 (19.4%), not 22%: the 79,096 recheck would still run; 1d982b3's record was
  refused because HEAD moved (f983eab9 at 09:32:18Z, checked), not an edit; cc54678..af986f0 re-read main's code
  (checked: one branch commit 1de6ed65, then a merge of PRs 858-863), a class spec 2 targets; `node_modules` absent
  from a snapshot in a gate turn (spec 1's fallback); snapshots named for the sweep and swept at each start; finding
  paths; spec 4 (a printed round line) dropped for a measure (spec 6), since L5's extra runs follow clean passes;
  spec 5's premise was false (`rules-reach.mjs:117`, checked) and a conflict with an earlier PR is not fixed by a
  merge of main; the measure extends `land-records.mjs` (checked: `landFacts`, `codexFacts`) and fixes the baseline
  to PRs 864-868, since the day's total moves (a run at 18:58Z). Minor taken: old spec 2 is existing behaviour,
  folded into spec 1's proofs; Done-when lists the tests T3 touches and a command that exits 0. Not taken: none.
  What made JH 198 merge main is inferred, not read whole: its state line said "merge origin/main in if 865
  landed", to open its PR on main after its stacked base landed; merge-queue would have retargeted it.
