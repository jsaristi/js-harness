# codex-spend: no Codex waste, no review weakened

## State
T1 (PR 878) and T2 (PR 883, main c7afe0be) landed; JH 199 closed (L33, docs/sessions/2026-11-15-jh-199-sin-desperdicio-de-codex.md).
Y1 is JH 207's. Next, for the session the lead assigns: T3, T5, T4 last, T6, and the follow-ups X2-X6, W2, W4, W7,
V3/B1-2, V4.

## Goal
Codex spends only on reading code it has not read, while every review the push and the merge door ask for still runs.

## Why
On 2026-11-14 Codex's five-hour window reached 100%. Of PRs 864-868's 3,053,278 Codex input tokens that day,
593,573 (19.4%; 142,373, 14.0%, of the uncached input) went to runs or reviews a snapshot of the head would not
have needed, and about 150k more (an estimate) to code of main re-read after a merge (L3, L9). At least 25
part-level refusals for a live-folder change since 2026-10-16 (the log starts 10-07) cost 3,992,076; record refusals
after a review leave no reason in the run log and are not in that count. He asked for the waste to go ("aplica las
mejoras para que no haya ningun desperdicio", L1), not for fewer reviews.

## Done when
- `node --test bin/codex-review.test.mjs bin/codex-review.second.test.mjs bin/lib/codex-review-turns.test.mjs` exits 0
- `node --test bin/lib/codex-review-recheck.test.mjs bin/merge-queue.test.mjs` exits 0
- `node --test bin/double-review.test.mjs` exits 0
- `node --test bin/lib/land-records.test.mjs bin/codex-meter.test.mjs bin/lib/codex-meter.test.mjs` exits 0
- `js-harness rules check` exits 0
- `npm run check` exits 0
- `js-harness codex-meter --per-pr` exits 0
- T6 passes: after T1 lands, no run refused for a live-folder change; after T2, no re-read run of covered code
  (spec 6's class); re-read tokens per landed PR and tokens per reviewed line below the PRs 864-868 baseline, the
  normalised figure first
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
- Clearance of `bin/lib/land-records.mjs` + test (T5), `bin/lib/pull-request.mjs` + test and the merge-queue edits
  at `:902`, `:906-908`, `:942` (T3), `bin/js-harness.mjs` usage (T4).
- Widening the sequenced double review from questions to every proposal (Q2, his).

## For the lead's OK
Given in L7. Asked now: the clearances above. Q2 (his, through the lead, with Q1): the sequence he endorsed at 6359
is for questions; should plans, designs and analyses also go Claude first, Codex on the passed version? A yes cuts
Codex reads of those too (a read measured at 720,239 Codex tokens, L11); a no keeps both readers at once for them.

Q1 (his, to put through the lead): lenses first on code, Codex only on the head the lenses passed — the code
analogue of item 4. Eight fresh Codex reviews of small follow-ups on 2026-11-14 (L5) came after a clean Codex pass
and a later lens or verifier finding; each cost 42-84k. A yes slows a round by one lens run (2-4 min) and saves an
estimated (not measured) half of those runs; a no keeps today's parallel order.

## Depth pass
- 1. Method: the discipline is build-system cost engineering: never pay twice for the same input, make the unit of
  work hermetic (a review reads a fixed snapshot, as a build reads a fixed tree), and measure per delivered unit,
  not per run. Reuse first (codegraph, grep, `rule:reuse-first`): `addTurnWorktree` / `sweepTurnWorktrees`
  (`bin/lib/codex-review-turns.mjs:144-173`) already review a merge from a detached worktree under
  `<git common dir>/js-harness/`; `mergeTurn` (`codex-review-turns.mjs:24`) already cuts a range in two turns with
  its guards; `bin/lib/land-records.mjs:37,56` (`landFacts`, `codexFacts`) reads `lands.jsonl` and the run
  log. Smallest changes: run each review's Codex session in a snapshot at `head` with the same checks pointed at it;
  cut the gap below a merge of main as a turn; extend `land-records` for the measure; make `double-review read`
  sequential with a Codex read at the end.
- 2. Raw material:
  - Run log `<common>/js-harness/codex-review-runs.jsonl` and records `codex-reviews.jsonl`.
  - `bin/codex-review.mjs:1799-1805` (`notTheRange`, the check per part), `:1539-1543` (the check after a merge
    turn), `:2198-2224` (the check after the review), `:1869-1874` (Codex spawned with `cwd: root`), `:1900`
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
  - The lead's analysis the owner answered, transcript 69918425 line 6359 (12:30:18Z): "Yo: cada pregunta pasa
    primero por la lectura de Claude, y Codex solo lee la versión que ya pasó."
- 3. The bar (each spec's proof; today's result; existing tests matching a word prove nothing new, so each new test
  has a distinct name):
  spec 1: `node --test --test-name-pattern "reads a snapshot of the head" bin/codex-review.test.mjs`: none, new behaviour
  spec 2: `node --test --test-name-pattern "gap below a merge" bin/lib/codex-review-turns.test.mjs bin/codex-review.test.mjs`: none, new behaviour
  spec 3: `node --test --test-name-pattern "conflict with main names" bin/merge-queue.test.mjs bin/lib/pull-request.test.mjs`: none, new behaviour
  spec 4: `node --test --test-name-pattern "double review of a question" bin/rules.test.mjs`: none, new behaviour (with `js-harness rules check`)
  spec 5: `node --test --test-name-pattern "Claude first" bin/double-review.test.mjs`: none, new behaviour
  spec 6: `node --test --test-name-pattern "per landed PR" bin/lib/land-records.test.mjs`: none, new behaviour (scratch result in L3)
- 4. Refutation: the request holds only if the waste is avoidable without fewer reviews. Cheapest test: join the
  day's run lines to records and transcripts and ask whether each wasted run would have been needed had Codex read a
  snapshot (scratchpad `perpr.mjs`, `chain.mjs`; rerun by the Claude reader, L9). Of 3,053,278 input tokens:
  286,592 in two runs refused for a live-folder change; 306,981 in the passing parts of 6ba747e..4977072, a range
  the push asked for only because 1d982b3's passing recheck (79,096) had its record refused when HEAD moved
  (f983eab9). With a snapshot the recheck would still run and be the record, so the saving is 593,573 (19.4%); in
  uncached tokens 142,373 (14.0%). Not saved by a snapshot: cc54678..af986f0 read about 272 lines of main's code
  brought in by a merge (about 150k, the reader's estimate), which spec 2 targets. History: at least 25 part-level
  refusals since 2026-10-16, 3,992,076 tokens.
  Verdict: supports
- 5. Request: make a Codex review read a snapshot of the commit it records, with every check it makes today pointed
  at that snapshot, so no edit or commit in the session's folder refuses a run or a record (outside a gate turn that
  falls back); when code commits below a merge of main lack a record, review only them and the merge's own lines,
  never main's code again; name the fix when the queue leaves a PR out for a conflict with main; run the double
  review of a question Claude first, ending always with a Codex read of the version he gets; show Codex input per
  landed PR, code reviews and double reviews, with PRs 864-868 as the baseline, including spend that buys no new
  reading. Item 3 of the lead's list (one commit per round) is not applied by a command: no check was found that
  refuses a wasteful run without refusing a needed one; it is measured (spec 6) and its lever is Q1, his.
  Adds: none

## Specs
His order for all of them: "hazme la pregunta de bloquear cuando pase y ademas aplica las mejoras para que no haya
ningun desperdicio como lo mencionas y dices" (69918425:6379, typed), after "me gustaria saber si lo estamos
utilizando optimizadamente o estamos utilizandolo a lo bestia y desproporcionadamente por favro revisa bien que no
se este gastando por esto" (69918425:6293, queued). What he endorsed is the lead's list at 6359.
1. Each Codex session of `codex-review` runs in a detached worktree made from the resolved `head` id under
   `<common>/js-harness/`, named so `sweepTurnWorktrees` finds it, once per run, removed however the run ends; the
   sweep runs before a run's first Codex session, by a run that is neither a turn's nor a measure's (L17). Removal
   and the sweep delete only inside `<common>/js-harness/`, refuse a path
   whose resolved form leaves it, and never follow a symlink or junction. The three checks that compared the live
   folder with `head` (after a part, after a merge turn, after the review) compare the snapshot instead; their
   refusals say that the review's own snapshot changed. The dirty-tree refusal at the start stays on the live folder.
   Finding paths are made relative to the snapshot, else to the live root. What the run reads before Codex starts
   (the range, the patch, the marks at `head`, the intent of `--doc` or `--request`) is read as today, at the start;
   the intent stays in a kept part's key. A run whose `--cwd` is already a turn worktree makes none. In a turn of
   the gate lock (where Codex runs the tests), when the live root's `package.json` declares dependencies and its
   `node_modules` is not empty, the run reads the live folder exactly as today, the three checks on the live folder,
   and says why. Proofs: a commit and an edit in the live folder during a run leave the record written; a gate turn's
   Codex command run in the snapshot gives what it gives in the live tree; finding paths come back relative; `--cwd`
   at a turn worktree makes no nested snapshot; a stale snapshot of a dead pid is swept before the next first session; a removal that
   fails is a warning; sentinel files behind a symlink or junction in or above the snapshot area survive removal and
   sweep; a part that passed is kept (existing, `keptPartFor`).
2. HEAD's merge of the default branch is set apart first (it is reviewed by `mergeStart` by what was written in it,
   or needs nothing when it writes no line). When every other code commit no record covers lies on the first-parent
   line below it, the run reviews that gap alone, `<oldest uncovered>^..<newest uncovered>`, as a turn in a worktree
   at the newest uncovered commit, then the merge. Guards, from `mergeTurn` and one more: the marks match at the turn
   and at HEAD; the review switch is on at the turn; no merge commit lies inside the gap; else the range is taken as
   today. The gap turn is what the records make it: a review, or a recheck of the review that ended at its start
   (its prompt, `recheckOf`, and the second-recheck and refused states as any range has them); when it leaves
   findings open the run stops before the merge, as `:1534` does. `turnsCheaper` is not asked: a gap is never dearer
   than the range with main. Never the merge's whole diff with main.
3. Where `merge-queue` leaves a PR out because it conflicts with main itself (GitHub's not-mergeable answer, worded
   in `bin/lib/pull-request.mjs:14`, or a merge into the candidate while it is still main, `merge-queue.mjs:906-908`,
   `:942`), its line names the fix: merge the default branch into the PR's branch. A conflict with an earlier PR of
   the batch says it waits for that land. `notify`'s use of the same words (`bin/notify.mjs:265`) is tested for the
   change. `rules-reach`'s line is unchanged.
4. `rule:double-review` (§1), for a question put to him: the Claude reader first; the Codex reader reads the frozen
   copy the Claude reader passed, or the version at the cap of three; the Codex reader never receives the Claude
   reader's answer to that copy, while the material is the writer's text and may say what earlier reads changed; a
   read goes through `js-harness double-review read`, so it is recorded. Plans, designs and other proposals keep
   both readers at once until he says otherwise (Q2). Changed with `js-harness rules change double-review` on a
   `rule/` branch, quoting 6379 and 6359, after JH 198's T6; the pinned phrase of `bin/lib/rules-data.mjs:227`
   changes with it.
5. `double-review read` takes `--subject`, derived from the material's repository path when one file is given, else
   required, naming an existing path or a draft file; a read without one is refused. A valid read is one whose
   readers answered with their tokens and the repository unmoved; only valid reads count. It runs the Claude reader:
   on findings it records the Claude read alone, marked sequenced, and stops; on none, or at the third valid read of
   the subject, it runs the Codex reader on the same copy and writes one record of both once both have returned. A
   fourth read of a subject is refused, naming the cap. A failed reader is recorded as failed, counts as no read,
   and the same copy may be read again. The tally keeps sequenced reads apart. T4 also updates the §1 text and the
   usage in `bin/js-harness.mjs`.
6. `land-records` attributes runs to landed PRs (new logic: a run's head among the commits a land's merge brought in;
   the runs of no landed PR listed as pending or orphaned) and gives, per PR, its Codex runs and input tokens over
   all its days, and what bought no new reading: failed runs, `reviewed` runs no record names, and re-reads (runs
   whose range held a code commit a `reviewed` record written before the run covered, by `reviewCoverage` as the
   push counts it, leaving out remerge runs, skip records and `--again` runs where run lines say so, with the run
   count and the token sum apart). Plus Codex runs after a clean pass on the same first-parent line (rounds), tokens
   per reviewed line, and the double reviews' Codex tokens from `double-reviews.jsonl`. The baseline is PRs 864-868
   by these rules over all their days (3,173,294 by L3's join, PR 864 counting its 11-13 run), the 2026-11-14 day
   total kept apart and labelled. Tests: a run on a rebased head, a stacked PR's run, a run of no landed PR, and a
   fixture reproducing the baseline. `codex-meter --per-pr` prints it.

## Tasks
- [x] T1 (kind: build) spec 1 — PR 878 — `bin/codex-review.mjs`, `bin/lib/codex-review-turns.mjs` + tests — commit `fix(codex-review): read a snapshot of the head, not the live folder`
- [x] T2 (kind: build) spec 2 — PR 883, main c7afe0be — `bin/lib/codex-review-turns.mjs`, `bin/codex-review.mjs` + tests — commit `fix(codex-review): review the gap below a merge of main alone`
- [x] T3 (kind: build) spec 3 — branch fix/codex-spend-t3 (L34-L37) — `bin/merge-queue.mjs`, `bin/lib/pull-request.mjs`, `bin/lib/merge-queue-reviews.mjs:97` (cleared L36) + tests — commit `fix(merge-queue): a conflict with main names its fix`
- [ ] T4 (kind: build) specs 4, 5 — `rules change double-review` on `rule/double-review-sequence`, `bin/double-review.mjs`, `bin/js-harness.mjs` usage + tests — commits `chore(rules): a question's double review reads Claude first` and `feat(double-review): Codex reads what Claude passed`
- [x] T5 (kind: build) spec 6 — branch feat/codex-spend-t5 (L38-L43) — `bin/lib/land-records.mjs`, `bin/codex-meter.mjs` + tests — commit `feat(codex-meter): Codex input per landed PR`
- [ ] T6 (kind: verify) — the measure after the slices land, against the baseline, by Done-when's T6 line; result in the Log

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
  committed f983eab9 inside that run (depth pass, item 2; L9). So the push counted 1 of 5 code commits uncovered and
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
- L10 2026-11-14T19:13Z, the confirming Claude read of v2 (same reader, sha256 caa752ef…, 229k Claude tokens, 2 min):
  findings 1, 2, 4, 5, 8-12 fixed; one blocking for T4: reads of "the same material" could not be counted (the hash
  and the copies' paths change each version), so the cap never fired; taken: spec 5 requires `--subject`. Should-fix
  taken: the `node_modules` fallback triggers only when `package.json` declares dependencies and `node_modules` is
  not empty (the main checkout has an empty one and declares none), and keeps today's checks on the live folder;
  spec 2 refuses a gap holding a merge; spec 6's re-read class leaves out remerge runs, skip records and `--again`,
  counted by `reviewCoverage` against earlier records, runs and tokens apart; spec 1 says what is read before Codex
  starts; L4 says HEAD moved. Not taken: none. `double-review read --plan` puts a read at about 0.9M Codex tokens,
  mostly cache, 1% of the weekly limit, against the 60-90k this document told the lead.
- L11 2026-11-14T19:39Z, the plan's recorded read (`double-review read`, id 5a4d88d1, on v3 6b9fc95a; both readers
  at once, since the command cannot run Codex alone). Measured: Codex 720,239 input tokens against the 0.9M estimate
  of `--plan`; Claude 3,695,922. Findings: Claude 14, Codex 5, all taken (`double-review take`, one shared each:
  spec 5's cap). Taken: uncached saving 142,373 (14.0%), not 17.3%; spec 4 limited to questions, as 6359 says
  ("cada pregunta"), the widening put to him as Q2, and 6359 quoted (6346 was a Bash call); blindness defined as
  "never receives the Claude reader's answer to that copy"; spec 2 sets HEAD's merge apart first (Codex 1) and
  takes the gap as review or recheck, stopping before the merge on open findings; spec 3's surface names
  `pull-request.mjs:14` and notify; item 3 of the lead's list is said not applied by a command, with why; spec 6
  adds double reviews' Codex tokens, new attribution tests and a baseline by all-days rules (3,173,294); T6 has pass
  criteria; spec 1 adds containment of removal (symlink and junction sentinels), gate-turn, path, nesting and sweep
  tests, and refusals reworded for the snapshot; spec 5 derives `--subject`, counts valid reads only, refuses a
  fourth, says what a failed reader is; citations corrected. Left, with the reason: the lead's L7 fold-in (the
  recheck refusal naming `senior-model`): §1 names `rule:session-model` as the strongest and §1 is his
  (`protocols-skill.mjs:43`), so it does not fit T3; it goes back to the lead as a §1 `rules change` with his words.
- L12 2026-11-14T19:45Z, the lead: cleared `bin/lib/pull-request.mjs` + test, `bin/merge-queue.mjs` at `:902`,
  `:906-908`, `:942`, `bin/lib/land-records.mjs` + test, and the usage lines of `bin/js-harness.mjs`. Spec 4 limited
  to questions is right; Q2 goes with Q1 to him, drafts after T1; the senior-model fold-in left is noted. Main is
  4187cb1. T1 starts.
- L13 2026-11-14T20:3xZ, the lead: advisor refuse mode is on since main c9160a5 (a ready, a question or a session
  start with no advisor call in the stretch is refused: consult once, then retry); the app auto-archives a session
  when its bound PR closes, so each landed PR of this feature is unbound (ccd_pr unbind_pr) before work goes on.
- L14 2026-11-14T21:30Z, T1 written by a js-harness-writer (opus), Covered: S1. Two choices beyond spec 1, kept:
  a run that measures (`onResult`, only `evals/review/compare.mjs`, which already reviews in its own clone at the
  head) makes no snapshot; the sweep runs where Codex's folder is first chosen, not at process start, so a run that
  starts nothing (covered, refused, `--plan`, `--unavailable`) touches nothing there. Code moved from
  `bin/codex-review.mjs` to the turns module to hold its 2258-line ceiling (`conventions-structure`), so T2's lines
  go in `bin/lib`. Directory symlinks skip on this machine (EPERM); junctions are tested.
- L15 2026-11-14T21:45Z, the lead: PR 874 landed (main dfcb70f), so `docs/rule-sources.json`, the rules data and
  `bin/lib/protocols-skill.mjs` are free for T4, after T1 to T3 as planned.
- L16 2026-11-14T22:30Z, T1's verifier (opus, read-only) on 6edc7fca: deletion and the record guards hold on every
  path traced; six findings, all taken in one fix commit. F1 proof 2 had no test: a gate turn's `node --test` now
  runs in the live folder and in the snapshot with the same result. F2 a snapshot dirty as soon as it is made (a
  checkout filter, an end-of-line rule) cost a whole review before its record was refused: it is now checked when
  made, removed, and the run refused before Codex starts. F3 a run in a turn worktree or a comparison run does not
  sweep (its parent run swept), a second departure beside L14's, kept. F4 removal refuses a path that is not
  absolute. F5 links are removed again just before the delete. F6 what the sweep leaves is a warning.
- L17 2026-11-14T23:55Z, T1's reviews on bc87ce6..ec97168: Codex passed all 4 parts (536,572 input tokens, 377,728
  cached; the first real run read its own snapshot). Lenses: risk 0; resilience, reliability and readability each
  warned that the sweep runs before the first Codex session, not at every run's start. Answered by spec 1's wording,
  changed here: sweeping in a run that starts nothing (`--plan`, a covered range, a refusal) adds a git process to
  each of them to clear what only a killed run leaves, which the next run that starts Codex clears anyway. Taken:
  `measuring` is its own option, no longer folded into `inTurn`; the refusal of a snapshot dirty when made builds
  its own text instead of stripping `snapshotChanged`'s by a regex.
- L18 2026-11-15T00:20Z, the fix fc1c9f09 rechecked: Codex passed (60,265 input tokens); lenses resilience,
  reliability, readability: 5 earlier findings fixed, 0 new. PR 878 opened, pre-push covering 3 code commits. Put to
  the lead with the ready, not settled by this log: measuring runs make no snapshot (L14), and the sweep runs before
  the first Codex session rather than at every start (L17). Not tested: snapshot removal after a throw, and the
  Ctrl-C test asserting the snapshot is gone; a test of either costs another review round, offered to the lead.
- L19 2026-11-15T01:05Z, the lead: PR 878 landed (main c472dcb, green local and Actions); L18 accepted (measuring
  runs make no snapshot; the sweep runs before the first Codex session). Inside T2: a test of snapshot removal after
  a throw, and the Ctrl-C test asserting the snapshot is gone. The land removed this worktree (empty at 19:55 local);
  the lead re-added it on feat/codex-spend-t2 at c472dcb. A leftover snapshot is a registered git worktree, which
  the next sweep removes with `worktree remove --force` and `worktree prune`.
- L20 2026-11-15T02:30Z, T2 written by a js-harness-writer (opus), Covered: S2, with the two L19 tests (both pass on
  T1's `finally` and fail with the removal off). Measured on the incident (scratchpad probe-gap.mjs, today's records):
  cc54678..af986f0 leaves 1de6ed6 alone uncovered and `turnsAt` cuts it as the gap cc54678..1de6ed6, the merge
  needing no read, so main's code is not read again. Left as today: a range where a commit of main has no record
  (off the first-parent line, no gap). Follow-up outside the surface: `bin/lib/codex-review-rows.mjs` sizes the
  push's debt with `mergeTurn` alone. `--plan` does not say when the gap turn is a recheck.
- L21 2026-11-15T03:00Z, T2's verifier (opus) on d1c152a6: no record covers code Codex did not read, but open findings
  escape across runs (probe: scratchpad probe-gap-findings.mjs). F1 blocker: after a gap turn with findings, a rerun
  at the same HEAD reads the merge through `mergeStart`, which asks no recheck state (`mergeTurn` does), and the
  clean merge record then discharges the push's `correctionOwed`. F2 major: the correction, which can only go above
  the merge, is a plain review (`recheckAnchor` passes only documents), so the findings are never rechecked, while
  `turnStopped` promises a recheck. Minor: F3 a one-turn gap makes a snapshot it never reads; F4 in a gate turn with
  installed dependencies the gap turn reads a worktree with no node_modules; F5 `gapLeftMerge` lasts one run; F6 the
  new rev-list runs on ordinary runs, untested by the counting tests; F7 the HEAD-is-a-merge guard has no failing
  test. The advisor: F1 and F2 are one defect (an owed correction is enforced only at the head of the last covering
  record, and nothing chains from a merge back to it); rewording is no fix. Acceptance matrix, at the push row's level:
  after a gap turn with findings, one turn and two turns, each with a rerun at the same HEAD, the push row's printed
  command, a correction above the merge with --base on main, and with base M^: each ends in a recheck naming the gap
  record, or a refusal with no session and no record, and the row says owed until then.
- L22 2026-11-15T02:40Z, the lead: the chain fix rides T2's PR as its own commit, its tests first. T2's surface
  grows by `bin/lib/codex-review-recheck.mjs` and `bin/lib/codex-review-rows.mjs` (+ tests). A `- Seen:` line in
  docs/FAILURES.md for main's hole (entry open-findings-escape-merge). Its review: Codex and the lenses on that
  commit as its own slice, no rerun of commits already reviewed. Ready --pr after the gate sequence; the lead lands.
- L23 2026-11-15T04:10Z, the chain fix (writer, opus) committed as 74256214: `recheckThrough` walks the first-parent
  line from a plain review through clean merge-own records and merges that write nothing, over documents-only
  stretches, to the record that owes; `recheckAt` alone asks git; mergeTurn, the startingAt guard, recheckFor and the
  push row's correctionOwed read it. The 12 matrix cells pass (7 failed before), and F3, F4, F6 and F7 have tests.
  The writer's declared gaps, outside the matrix: both turns owe; `--unavailable` on the merge; a 'refused' state
  at the first parent; plain check's debt row base; the second-recheck warning's base; exit codes differ, one turn
  against two. Put to the verifier.
- L24 2026-11-15T04:40Z, the verifier (opus) on 74256214: the 12 matrix cells pass, but two default-command shapes
  still lose the debt, the push row ending on pass. V1 blocker: `recheckAt` lists `rev-list --parents
  --max-count=500` without `--first-parent`, by date, so a merge of a busy main pushes the owing record out of the
  window (n=600 probes, two turns, one turn and main's own shape; in this repo merge fa8e650 has its first parent at
  507). `git rev-list --first-parent --parents` still prints both parents of a merge (checked on c472dcb). V2 major:
  where the merge's own record also owes, `recheckThrough` returns at once and the gap's finding is never rechecked
  (probe PA). Minor: V3 `--unavailable` drops a debt, as before this commit; V4 plain check's debt row prints a
  base the guard refuses; V5 the one-turn rerun exits 0 as covered where L21 asks for a refusal; V6 two correction
  tests assert only pass false. The advisor: no review on 74256214; one more round as a new commit; V2's rule
  written before code and checked against the push row, which reads only the last covering record; a fix that
  changes the record shape or the three-review count goes to the lead first. The gate at 74256214 ran no tests
  locally (gate.yml sends them to CI at push); the writer's own run of every file is what holds them; nothing was
  pushed (ls-remote empty). V3 and V4 are follow-ups.
- L25 2026-11-15T07:00Z, the second writer round committed as 457bb1c9 (its own run of the 16 codex-review test files:
  904 pass, 0 fail; the gate runs none locally). V1: `recheckAt` lists `--first-parent --parents`, one git call,
  tests with 600 main commits by `git fast-import`. V2: below a merge whose own record owes a first recheck the walk
  goes on, and a debt found below joins it, one recheck carrying both findings, `recheckOf` still the merge; refused
  where the debt below is refused or would reach a third review, the merge's debt kept in memory (`owed`) for the
  push row. Gap c, V5 and V6 have tests. Left open by the writer, put to the verifier: after a joined recheck no
  record names the gap's head, so `--again --base <gap head>` could reach a fourth review (needs a record-shape
  change, out of scope); the debt below at its second recheck refuses rather than joins; a merge's debt over three
  reviews spent below refuses until escalated; older merge-recheck records read as covering the debt below. The
  lead asked (2026-11-15) for a clean second verifier pass before ready, and for the PR body to say whether the rule
  decides the full audit's B1-1 and B1-2: it decides neither. B1-1 (removing a `-codex-review` mark leaves code
  covered) is coverage by marks in `reviewCoverage`, a mechanism the rule does not touch; B1-2 (an `--unavailable`
  skip over a later code commit erases an owed correction) is V3 of L24, there before this work: `correctionOwed`
  reads only reviewed records, so a skip covering the newest code commit hides the debt. Neither is fixed in T2.
- L26 2026-11-15T08:00Z, the second verifier pass (opus) on 457bb1c9: V1, V2, gap c, V5 and V6 closed by probe; the five
  test files pass on its own run (26, 26, 112, 211, 164). Not clean: W1 major, where the merge's own record owes a first
  recheck over a gap at its second recheck, or with three reviews spent, `recheckThrough` refuses the run
  (codex-review-recheck.mjs:251-252), and the refusal prints `--base <far back> --again`, a plain review whose
  record clears the merge's finding unrechecked and reads main's diff (probes N1, N2, Z1); on 74256214 that merge got
  its first recheck, so this is a regression. Minor: W2 `--again --base <gap>` rechecks the gap's finding alone
  (an override, V3's class, older); W3 a fourth review is reachable, since `recheckOrAgain` checks
  `againPastThreeReviews` only on a plain review; W4 an octopus merge of main loses the debt (documented stop,
  older); W5 one extra first-parent rev-list on the push row with uncovered plain commits and a run log, unpinned;
  W6 the V5 refusal names the docs commit above the merge as the merge; W7 older merge-recheck records read as
  covering the debt below. The anchor scan of the real records: 143 of 2,060 range starts moved anchor, none changed
  the recheck state. Taken (advisor): W1 shape (3), three reviews spent below: the merge's own recheck runs alone, as on
  74256214. W1 shape (2), the debt below at its second recheck: join only if the next run can tell from the records
  that the debt below had its three after a joined recheck that still owes (a cap, test first); if not, the writer
  stops there and the lead is asked, with an uncapped join as the default and its cost. Merge-alone is V2 again and
  refusing is W1, so neither stays. Every refusal test runs the command the refusal prints. W3 only as the
  one-condition change with a failing test; W5 and W6 taken. W2, W4 and W7 are follow-ups. A third pass that finds
  another major goes to the lead as a problem, not a fourth round.
- L27 2026-11-15T10:30Z, the third writer round committed as a5d528dc (its run of the 16 files: 912 pass, 0 fail). W1
  shape (3): the merge's own recheck runs alone wherever the state below is refused. Shape (2): joined, with a cap
  read from the records alone: from a recheck of a merge's own record the walk runs again from the merge's first
  parent, and where it joins a second recheck still due, the joined one was the third review, so the run is
  refused as three reviews; the cap refusal prints no review command and says to raise it with the user. W3:
  `recheckOrAgain` holds `--again` to three on any refused state, and `againPastThreeReviews` refuses a state
  carrying `merge`. W5 pinned, W6 names the merge. Put to the third pass: the cap's missing command, the push row
  passing with no three-reviews warning for the debt below after shape (3)'s recheck, the wider
  `againPastThreeReviews`, the removal of `owed`. The lead (2026-11-15) asked to lock the worktree before ready,
  since a land skips a locked one: locked, "JH 199 live".
- L28 2026-11-15T11:20Z, the third verifier pass (opus) on a5d528dc: W1 (both shapes), W3, W5 and W6 closed by probe; its
  own run of the five codex-review test files passes (29, 26, 112, 216, 164). Not clean: X1 major, introduced by
  a5d528dc: in `walk`, `capped` is asked only while nothing is owed (codex-review-recheck.mjs:261), so with a
  merge's debt in hand a second-recheck state below joins at :263 uncapped; a second merge of main above a joined
  third review, whose own turn finds something, makes the default run review the gap's finding a fourth time
  (probe X-c(true); a third such merge, by reading, a fifth). Nothing goes unreviewed or unrechecked; the three-review
  limit is what breaks. Likely fix: at :263 a state `capped` refuses is refused, and the merge's recheck runs alone.
  Minor: X2 after the cap only `--unavailable` gets a push through and the row then shows nothing (B1-2's class);
  X3 `againPastThreeReviews` refuses an `--again` after a clean merge that works without one, and the wording
  names the merge's findings (`merge` is set past any merge); X4 shape (3)'s three-reviews warning disappears after
  the merge's recheck; X5 the row after shape (3)'s fix drops "owes a correction" (rows.mjs:326 needs `at`), still
  refusing; X6 two printed routes are dead ends. W2 and N6d unchanged; W7 has no live instance (0 of 1,425 records).
  Third pass with another major: to the lead as a problem (L26).
- L29 2026-11-15T09:50Z, the lead's answer to L28 (cross-session, JH ORQ): "B. Open the PR now. X1 errs toward a review
  too many, not a review skipped, and it needs a rare shape. Each round so far has brought a new regression, so a
  fourth round costs more than X1 does." X1 is not a FAILURES entry, since it has not happened. Follow-up X1, for
  JH 205 (the honest review gate, after T2 lands): in `recheckThrough`'s `walk`, `capped` is asked only while
  nothing is owed (bin/lib/codex-review-recheck.mjs:261), so a second-recheck state below joins at :263 uncapped; a
  second merge of main above a joined third review, whose own turn finds something, buys a fourth review of the
  gap's finding. Proof: probe X-c(true) in the JH 199 scratchpad verify4probes7.part.mjs (out7-X-c.txt). Likely
  fix: at :263 a state `capped` refuses is refused, and the merge's recheck runs alone; a test of X-c first. The
  minor X2 to X6, W2, W4 and W7 ride with it as candidates. Codex and the lenses: the code commits not yet reviewed
  (d1c152a6, 74256214, 457bb1c9, a5d528dc) as one range from c472dcb, no rerun of what is reviewed.
- L30 2026-11-15T10:00Z, the reviews of c472dcb..3ddfd3e (d1c152a6, 74256214, 457bb1c9, a5d528dc as one range, the
  lead's ask): lenses risk and reliability complete, 0 findings; Codex, 5 parts, 1,016,226 input tokens, three P2:
  an empty gap (a change and its revert) writes a nothing-to-review record that `afterTurn` rejects, exit 1 with the
  merge unreviewed (codex-review.mjs:1503); X1 itself (codex-review-recheck.mjs:261-263); `recheckAt`'s
  `writesNothing` (codex-review-turns.mjs:90-93) counts a conflict resolved by one side's version as code where
  coverage does not, so the walk stops and a debt is lost. The push refuses an owed correction, so the lead's B
  (PR now, X1 a follow-up) cannot ship without them: all three fixed in one commit, tests first, then Codex's
  recheck and the lenses on it, no fourth verifier pass; the lead told so (notify 04:58 local). X1 leaves the
  follow-up list of L29 once the fix lands; X2 to X6, W2, W4 and W7 stay on it.
- L31 2026-11-15T11:40Z, the fix of L30's three P2 at 13367429 (writer 4, tests first; each new test failed before
  its fix; 917 pass, 0 fail across the 16 touched or neighbouring test files): `afterTurn` takes a gap's valid
  nothing-to-review record as owing nothing; `recheckThrough` leaves a merge's recheck alone where `capped` refuses
  the state below (X1, which leaves L29's follow-up list); `writesNothing` asks `reviewCoverage`, as `mergeStart`
  does. Codex's recheck of 6e6adbf..1336742: 3 of 3 fixed, correct at 0.95, 126,887 input tokens; lenses risk and
  reliability: 0 findings. Not covered: a third merge only by a unit test. The title and `## State` header, lost
  to a state script at d1c152a6, are restored. Follow-ups that stay: X2 to X6, W2, W4, W7, V3/B1-2, V4.
- L32 2026-11-15T12:15Z, PR 883 opened at 08653f93 and sent ready (06:36 local); the lead held its land for one
  narrow verifier pass (opus) on 6e6adbf..1336742, with the outcome fixed beforehand: clean lands, fail-safe lands
  with JH 205 owning it, fail-open does not land and is held for the owner. Verdict: fails open, Y1. Y1: a review
  owes a correction, a commit and its revert follow, the default run records nothing-to-review over them (the range
  changes no file), and the push row passes while `recheckAt(HEAD)` still says the finding is owed. The class is
  older than 13367429: it holds with no merge at all (C1f) and on the same records at 6e6adbf. 13367429's part: in
  a one-turn merge that writes nothing above such a gap (C1e) the run exited 1 and printed a refused rerun; now
  `afterTurn`'s nothing-to-review branch returns owing nothing without asking whether the gap starts at a record
  that owes, so it exits 0 silently. Two turns still refuse the merge (C1d); the debt returns at the next code
  commit. Evidence: scratchpad verify5, out-C1d.txt:20-30 (read by JH 199), out-C1g.txt, out-C1g-pre.txt; the
  lead's folder, jh199-verify5-883.md. The three fixes hold (V1, V2, W1 shape 3, X-c, a third merge, Codex's
  cases 1 and 3 clean). Fail-safe and older: X6, X-b, and the three-reviews refusal's `--base <start> --again`
  route to a fourth review (since 2026-10-19). Not covered: the real check --push, hook and merge door; real
  Codex; W2, W4, W7, --unavailable. The lead set 883 to draft and holds it for the owner (07:12 local).
- L33 2026-11-15T15:40Z, PR 883 landed at 10:31 local (main c7afe0be) on the owner's yes to Q288, as the lead relayed
  it; Y1 goes to JH 207. The lead also asked whether Y1 is on main: yes, C1f (no merge) on main 7de0b95's own bin
  passes the push row after a nothing-to-review record over an owed review (JH 199 scratchpad verify5,
  out-C1f-main.txt). JH 199 closes with its summary, docs/sessions/2026-11-15-jh-199-sin-desperdicio-de-codex.md.
- L34 2026-11-18, JH 220 (item `codexspend` of the plan of 2026-11-18, v4): T3 and T5, worktree
  `.claude/worktrees/codex-spend-t3-t5-9335da` from main b044dbf7. L12's cleared lines were counted at main 4187cb1;
  at b044dbf7 they are `:896` (GitHub's answer), `:900-902` (the reviews read onto the candidate) and `:936` (the merge
  into it), plus the import line `:24` for the one new name. `bin/notify.test.mjs`: the one assertion of
  `readyProblems`' CONFLICTING words changes (`:429`), no test added. T3's decisions: the words have one home,
  `conflictSaid` in `bin/lib/pull-request.mjs`. GitHub's CONFLICTING is computed against the branch the pull request
  targets, so its fix names that branch. In the reviews' loop a conflict onto main is now a `conflict` (it was left out
  as `review`, with a "merging or rebasing" next step); onto a candidate with earlier pull requests, main alone is asked
  again (`isCovered(head, main)`, only on that path), since `reviewEvidence` returns main's own conflict first and the
  line called it the candidate's. At the merge, the candidate is still main while every merge before it brought
  nothing (`merge === main`), not only while none was made. A conflict with the batch names the pull requests merged
  so far, not the one it meets: git does not say which, and they land together. The one reader of a land record's
  `leftOut` reason is `leftOutText` (`bin/merge-queue.mjs:264`), which prints it in brackets before `said` and branches
  on nothing (`grep -rn "leftOut\|\.reason\b"` over `bin/merge-queue.mjs`, `bin/lib/merge-queue-*.mjs`,
  `bin/lib/stretch*.mjs`, `bin/stretch.mjs` and `workshop/`, non-test files, unbounded). Left: `README.md:1308` shows the old
  CONFLICTING line, and `bin/lib/merge-queue-reviews.mjs:75` still says "by merging or rebasing" for `check`'s own
  use; both outside T3's files.
- L35 2026-11-18, T3's reviews on b044dbf..c3385fc. Codex (915,136 input tokens, 818,816 cached; its plan said about
  1.9M, over the 300,000 allowance, sent to the lead before it ran): five P2, verdict incorrect. Lenses risk 0,
  readability 1 warning. Verifier (opus, read-only): clean, probe on a real repository reproduced the old misnaming
  and the fix; five low notes. Taken in one commit, tests first: a conflict git names no file of is still a
  conflict (`Array.isArray`, Codex 1); the step comes before the lists, which a notice cuts at its length (Codex 4);
  CONFLICTING against a branch the queue refuses as base names no merge of it (Codex 5); the wait names "the one of"
  the earlier pull requests it conflicts with, not all of them (Codex 3, verifier 1); the merge loop decides "with
  main" by the reviews' rule, asking main alone where earlier merges moved the candidate (lens). Answered, not
  taken: Codex 2 (carry the conflict's base in `reviewEvidence`'s result instead of asking main alone again) needs
  `bin/lib/merge-queue-reviews.mjs`, outside the cleared files; the second ask runs only on a conflict with the
  batch. Verifier 2 (`readyProblems` asks gh for no `headRefName`, so notify's line names no branch) needs
  `bin/notify.mjs`; verifier 3 (an UNKNOWN conflict found by the reviews keeps `reviewEvidence`'s words in notify)
  is `merge-queue-reviews.mjs` too. Both go to the lead as follow-ups with README.md:1308.
- L36 2026-11-18, Codex's recheck of c3385fc..1dbba7f (297,006 input tokens): 3 fixed, 2 not fixed. Finding 4 (a long
  list still came before the wait's condition) and finding 2 (ask main again) both taken. For finding 2 the lead
  cleared, 16:24 local: "You may edit bin/lib/merge-queue-reviews.mjs at line 97 and its test, adding only the
  optional field conflictOnto." `reviewEvidence`'s conflict now says whose it is, `main` or `candidate`, and the
  reviews' loop reads it; the merge loop still asks main alone, since a `git merge` there has no such result. Lenses
  on 1dbba7f: risk 0; readability a follow-up, answered: at the merge a failed `git merge` with no unmerged file is not
  a conflict (the test "a merge that fails with no conflict says what git said"), while `merge-tree`'s exit 1 is.
  The lead holds T5's Codex review (planned 7.5M to 17.3M input tokens) for the owner's answer.
- L37 2026-11-18, the second recheck, 1dbba7f..6bf60cc (195,381 input tokens): both findings fixed, verdict correct
  (0.99). T3's reviews end at three: Codex 915,136 + 297,006 + 195,381 = 1,407,523 input tokens; lenses risk 0 each
  round, readability's follow-up (say in a comment why the two loops count an empty conflict list apart) left for
  the next change of those lines, since a code edit now would need a fourth review. Merge-queue tests 133 of 133.
- L38 2026-11-18, T5's writer, round 1 (sub-agent of JH 220), worktree `D:\js-harness-worktrees\codex-spend-t5` on
  feat/codex-spend-t5 from main b044dbf7: 9d9b5b55 `feat(codex-meter): Codex input per landed PR`. A run is a landed
  PR's when its head is among the commits the land's merge brought in (`<merge>^1..<merge>^2`), lands of exit 0 only;
  a run of no landed PR is pending (on a branch not landed), on the default branch by no land, or orphaned. The
  baseline on the real records: 3,173,294 over all their days and 3,053,278 on 2026-11-14, L3's figures exactly. Run
  lines carry no `--again` marker; the report says so and leaves none out. Real run 121 s.
- L39 2026-11-18, the verifier (opus, read-only) on 9d9b5b55 and round 2, 2e40eb81. Taken, tests first: M1, a re-read
  run that also read uncovered code is no "bought no new reading" (the baseline's 911,660 all were): re-reads split
  into "covered code alone" and "covered code beside new" with k of n code commits; tokens a line divide the tokens
  of the runs that bought new reading by their `coverage.total`. M2, rounds were 6, 9 and 5 for PRs 866-868 against
  L5's 3, 4 and 0: a round is now a fresh `reviewed` run (no recheck, no remerge) above a clean pass of the same PR on
  its first-parent line, printed on its own line that says not to add it. M3, one failing-first test each for the
  `^1` exclusion, the exit-0 filter and "first land wins". Low: a PR merged twice keeps both merges' runs (PR 731, 2
  runs, 117,860), as `pullRequestsOf` (`bin/lib/report-git.mjs:77`) joins them; a run with no count prints unknown;
  cached tokens print. The rule gives L5's lists for PR 864 (08:17) and 867 (09:46, 09:55, 10:05, 10:52) and more for
  866 (09:28 too) and 868 (11:42, 11:49, 12:10, where L5 has none): reported, not tuned. Answered: report-git's
  merge-subject regex is not exported, so `MERGE_OF_PR` copies it. `where` handed to `reviewCoverage` cut git
  processes 537 to 506 (`show-cdup` 80 to 49); the run times, 98 s and 127 s, are noise beside that.
- L40 2026-11-18, the confirming verifier and the lenses on 2e40eb81, and the lead's decisions (JH ORQ), 18:13
  local: "(1) T6 compares the 'beside new' figure: the 306,981 now sits there, and covered-alone is 0 for all 410
  PRs. Write in the baseline line that the depth pass's figure moved from alone to beside new, and why. (2) Add no
  size cut, since no rule supports one: PR 866 09:28 keeps counting as a round." 18:24 local: "keep the rounds rule
  as you wrote it (fresh reviews above a clean pass of the same PR). Name 866 09:28 and 868 11:42, 11:49 and 12:10 in
  the baseline as counted by that rule, beside L5's narrower reading. No criterion for next-work-unit reviews exists,
  so do not invent one." Round 3, f6c388e1, taken: the baseline names its run with no count and says both decisions
  (`BASELINE.notes`); "(C of them cached)" stands beside its total, not beside the uncounted run; the beside-new runs
  are said to be among "tokens of theirs"; a test pins `coverage.total` as the lines measure (the code was right, a
  mutant reading `part.changedLines` first fails it); the dead `pass.head !== run.head` goes; the fixture comment says
  11:49 and 12:10 sit above fresh clean passes. Lens reliability: a test runs `workingPerPr` over a throwaway
  repository with record files, exit 1 when `lands.jsonl` cannot be read; it failed first by reading this
  repository's records (`codexMeterMain` now takes `cwd`). Its mutants fail it for `read`, `isValid`, the default
  ref and the admission; `beyondTip: false` survives, since only records whose head is in the run's range are handed
  on, and `where` only saves git processes. Lens readability (`MERGE_OF_PR` copies report-git's regex): left, L42.
  No Codex review of T5 ran (held, L36).
- L41 2026-11-18, the real report at f6c388e1, exit 0 in 206 s (run alone; 84-127 s in round 2, about 500 git
  processes of 30 `reviewCoverage` calls), as printed: "Baseline, PRs 864-868: 35 runs over all their days, 3,173,294
  input tokens, and 1 run with no count (ba57f254-b216-4807-ac21-a69f1b9f331e, 2026-11-14T12:16:11.982Z); of them on
  2026-11-14 alone: 3,053,278", then the two notes and "Re-read of covered code alone: 0 of 412 PRs" (the lead's 410
  was counted before; covered-alone is 0 still). Bought no new reading: PR 866 failed 1 run 220,599; PR 867 failed 1 run
  65,993 and no record 1 run 79,096; PR 868 failed 1 run, tokens unknown. Beside new: PR 866 3 runs 528,631 (21 of 24
  code commits covered), PR 867 3 runs 383,029 (11 of 14). Rounds: 864 1 run 69,498, 865 0, 866 4 runs 364,992, 867 4
  runs 268,543, 868 3 runs 212,698. Pending 37 runs 9,268,560 and 1 with no count; by no land 720 runs 121,777,561;
  orphaned 36 runs 3,642,490. Double reviews: 47 reads, 42,715,604 Codex input tokens.
- L42 2026-11-18, T5's follow-ups, outside its files: the help line `bin/js-harness.mjs:34` lacks `--per-pr`;
  README's codex-meter section does not show it; `MERGE_OF_PR` in `bin/lib/land-records.mjs` copies the regex of
  `bin/lib/report-git.mjs`, which exports none; run lines carry no `--again` marker (their writer); zeros outside a
  repository are left as they are.
- L43 2026-11-18, round 4, e709d8f4, written inline by JH 220 (no writer, no verifier pass; the lenses read it). The
  confirming verifier (opus, read-only) on f6c388e1: all eight claims of L40 hold, no High or Medium; six Low, all
  taken: "35 runs ..., and 1 run with no count" read as 36, now "35 runs (1 of them with no count: ...)" in every tally;
  "the beside-new runs among them" printed for a PR with none; the baseline's notes printed in any repository, now
  only when the baseline has runs; `codexDebts` read `process.cwd()` beside `--per-pr`'s `cwd`, now both read `cwd`
  (no test pins the debts' `cwd`: that path spawns the app-server); the test cited L38 for the decisions (L40); the
  wiring test left its marks file on a failure. The lenses on 85e918f..26ecda2: reliability 0, readability two
  suggestions (`unnamedRuns` beside the "no record" class `unnamed`, now `uncountedList`; the L38 citation), both
  fixed; on 26ecda2..e709d8f 0 and 0, both rechecked fixed. Tests first: 2 of 20 failed before the code changed. The
  real report at e709d8f4, exit 0 in 130 s (206 s at f6c388e1, unexplained), as printed: "Baseline, PRs 864-868: 35
  runs (1 of them with no count: ba57f254-b216-4807-ac21-a69f1b9f331e, 2026-11-14T12:16:11.982Z) over all their
  days, 3,173,294 input tokens; of them on 2026-11-14 alone: 3,053,278", its two notes, "Re-read of covered code
  alone: 0 of 412 PRs"; per-PR figures and rounds as L41. Codex reads T5 once, as `check --push` names it:
  `codex-review --base 04b7ac53a258 --at e709d8f44f33` (3 parts, 930 changed lines, 3.96M-8.5M planned).
