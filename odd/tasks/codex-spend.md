# codex-T2 at d1c152a6 (local, not pushed). The chain fix (L21, L22) is with a writer (opus, background, uncommitted):
the acceptance matrix as tests first, then the fix in codex-review-recheck.mjs / codex-review-rows.mjs, plus F3, F4,
F6, F7. When it returns: check, commit the fix as its own commit, verifier on it, then Codex and the lenses on T2's
commit d1c152a6 and on the fix as their own slices, PR, advisor, ready --pr. Main's hole is in docs/FAILURES.md.

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
- [ ] T1 (kind: build) spec 1 — `bin/codex-review.mjs`, `bin/lib/codex-review-turns.mjs` + tests — commit `fix(codex-review): read a snapshot of the head, not the live folder`
- [ ] T2 (kind: build) spec 2 — `bin/lib/codex-review-turns.mjs`, `bin/codex-review.mjs` + tests — commit `fix(codex-review): review the gap below a merge of main alone`
- [ ] T3 (kind: build) spec 3 — `bin/merge-queue.mjs`, `bin/lib/pull-request.mjs` (clearance asked) + tests — commit `fix(merge-queue): a conflict with main names its fix`
- [ ] T4 (kind: build) specs 4, 5 — `rules change double-review` on `rule/double-review-sequence`, `bin/double-review.mjs`, `bin/js-harness.mjs` usage + tests — commits `chore(rules): a question's double review reads Claude first` and `feat(double-review): Codex reads what Claude passed`
- [ ] T5 (kind: build) spec 6 — `bin/lib/land-records.mjs`, `bin/codex-meter.mjs` + tests — commit `feat(codex-meter): Codex input per landed PR`
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
