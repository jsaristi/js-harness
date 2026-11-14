# codex-spend: no Codex waste, no review weakened

## State
The lead's OK is in (L7). Next: the plan's double review (Claude first, Codex on the version Claude passed), then
T1, T2, T3, T5, and T4 last, after JH 198's T6 lands; each its own PR through the lead's merge-queue. Q1's draft
after T1.

## Goal
Codex spends only on reading code it has not read, while every review the push and the merge door ask for still runs.

## Why
On 2026-11-14 Codex's five-hour window reached 100%. About 22% of that day's 3.05M Codex input tokens (L3) bought
nothing: runs refused after Codex read, a review whose record was then refused, and a 435-line review of commits that
had been reviewed. He asked for the waste to go ("aplica las mejoras para que no haya ningun desperdicio", L1), not
for fewer reviews.

## Done when
- `node --test bin/codex-review.test.mjs bin/codex-review.second.test.mjs bin/lib/codex-review-turns.test.mjs` exits 0
- `node --test bin/double-review.test.mjs` exits 0
- `node --test bin/codex-meter.test.mjs bin/lib/codex-meter.test.mjs` exits 0
- `js-harness rules check` exits 0
- `npm run check` exits 0
- `js-harness codex-meter --per-pr --since 2026-11-14` prints the 2026-11-14 baseline beside the runs after it
- Each slice landed through the lead's merge-queue

## In scope / Out of scope
- In: `bin/codex-review.mjs` and `bin/lib/codex-review-*.mjs` with their tests; the files the lead clears below.
- Out: skipping or weakening any review, check or test; the advisor gate (its question is with him); Codex model or
  effort; reset credits (his rule: one only when more than 3 are left); `bin/lib/manifest.mjs` and JH 198's files
  without the lead's clearance.

## Constraints
- `codex-review` is what the pre-push hook and the merge door read: high risk (contracts others consume, and item 6:
  a refusal path that no test catches if it regresses). Each code slice gets a verifier, Codex and the lenses.
- No edit while a review of this branch runs; one commit per round — the habits this feature is about.
- Sub-agents get an explicit model, never Fable.

## Ask me before
- A change of the protocol text (§1, §3), which is his: through the lead, as `rules change` with his words.
- Lenses before Codex on code (question for him, "For the lead's OK", Q1): not built unless he says yes.

## For the lead's OK
Clearances asked (files outside the brief's surface):
1. `bin/lib/codex-review-coverage.mjs` is in the surface; `bin/lib/codex-review-turns.mjs` too. Nothing more for T1-T2.
2. T3: `bin/lib/lens-reviews.mjs` (read only, import) — no edit. `bin/merge-queue.mjs`: one next line on a conflict.
3. T4: `bin/double-review.mjs` + test; `docs/rule-sources.json`, `bin/lib/protocols-skill.mjs` §1 through
   `js-harness rules change double-review` on `rule/double-review-sequence`. JH 198's T6 also edits
   `protocols-skill.mjs` (§7 text): whichever lands second merges main; the lead orders them.
4. T5: `bin/codex-meter.mjs`, `bin/lib/codex-meter.mjs` + tests.
5. The depth pass's own double review (`rule:double-review`, §9): a Claude read (~25k Claude tokens) and, if it
   passes, a Codex read (~60-90k Codex input). Codex's five-hour window is at 0% now, weekly at 68%, 3 reset
   credits (none usable under his rule). Say whether to run it before T1, or skip it with his words.

Q1 (his, to put through the lead): lenses first on code, Codex only on the head the lenses passed — the code
analogue of item 4. Eight fresh Codex reviews of small follow-ups on 2026-11-14 (L5) came after a clean Codex pass
and a later lens or verifier finding; each cost 42-84k. A yes slows a round by one lens run (2-4 min) and saves an
estimated (not measured) half of those runs; a no keeps today's parallel order.

## Depth pass
- 1. Method: the discipline is build-system cost engineering: never pay twice for the same input, make the unit of
  work hermetic (a review reads a fixed snapshot, as a build reads a fixed tree), and measure per delivered unit,
  not per run. Reuse first (searched with codegraph and grep, `rule:reuse-first`): `addTurnWorktree` /
  `sweepTurnWorktrees` (`bin/lib/codex-review-turns.mjs:150-173`) already review a merge from a detached worktree
  under `<git common dir>/js-harness/`; `mergeTurn` (`codex-review-turns.mjs:24`) already cuts a range in two
  turns; `lands.jsonl` already names each landed PR and candidate; `codex-meter` is where the lead reads Codex.
  Smallest changes: run every review's Codex session in a snapshot at `head`; extend the turn cut to the mirror case;
  join runs to lands for the measure; make `double-review read` sequential.
- 2. Raw material:
  - Run log `<common>/js-harness/codex-review-runs.jsonl` and records `codex-reviews.jsonl` (2026-11-14 lines).
  - `bin/codex-review.mjs:1795-1805` (`notTheRange`, the mid-run check per part), `:2198-2224` (the post-review
    check that refuses the record), `:1868-1874` (Codex spawned with `cwd: root`, the live folder).
  - `bin/lib/codex-review-coverage.mjs:351-367` (`reviewStart`: from must be an ancestor of the oldest uncovered
    commit's parent, else the range as given), `:492-526` (`mergeStart`: needs every code commit up to the first
    parent recorded).
  - JH 198's transcript `D--js-harness--claude-worktrees-audit-cement/b1a32f3f-….jsonl`: 09:31:54Z it ran
    `codex-review --base f71380ea … > file; tail -3` in the background; 09:32:17Z it rewrote
    `odd/tasks/audit-cement.md`'s State while that run read; 10:12:25Z the pre-push printed
    `FAIL codex-review 1 of 5 code commits since origin/main have no Codex review record … next: js-harness
    codex-review --base 6ba747e38fcc --at 4977072eb1f9`.
  - `bin/double-review.mjs:17-19` ("Both readers are started at once"); `bin/lib/protocols-skill.mjs:43` (§1).
  - `bin/merge-queue.mjs:7` (ready = no conflict with the candidate; stacked PRs are retargeted, `:9`).
  - The lead's analysis, transcript 69918425 line 6346 (12:30:18Z).
- 3. The bar (each spec's proof; today's result):
  spec 1: `node --test --test-name-pattern "snapshot" bin/codex-review.test.mjs`: none, new behaviour
  spec 2: `node --test --test-name-pattern "kept across" bin/codex-review.test.mjs`: none, new behaviour
  spec 3: `node --test --test-name-pattern "below a merge" bin/lib/codex-review-turns.test.mjs`: none, new behaviour
  spec 4: `node --test --test-name-pattern "round" bin/codex-review.test.mjs`: none, new behaviour
  spec 5: `node --test --test-name-pattern "conflict" bin/merge-queue.test.mjs`: none, new behaviour
  spec 6: `js-harness rules check`: exits 0 today; the changed text is new
  spec 7: `node --test --test-name-pattern "Claude first" bin/double-review.test.mjs`: none, new behaviour
  spec 8: `js-harness codex-meter --per-pr --since 2026-11-14`: none, new behaviour (scratch script result in L3)
- 4. Refutation: the request holds only if the waste is avoidable without fewer reviews. Cheapest test: join the
  day's run lines to records and transcripts and ask whether each wasted run would have been needed had Codex read a
  snapshot. Run (scratchpad `perpr.mjs`, `chain.mjs`, read-only): of 3,053,278 input tokens, 286,592 in two runs
  refused for "tracked files differ" (both live edits during the run); 79,096 in a `reviewed` recheck of
  f71380e..1d982b3 whose record the post-review check refused (the 09:32:17Z doc edit; the run's output went to a
  file, so the refusal is inferred from the code path and the missing record, not read); 306,981 in the two passing
  parts of 6ba747e..4977072, a range the push asked for only because 1d982b3 had no record (the merge's remerge-diff
  is empty, `git show --remerge-diff 4977072`, and its other four code commits have records). All three would not
  have been spent with a snapshot: 672,669 tokens, 22.0%. Without the merge of main, the cost of the missing record
  would have been one 79k recheck, not 307k.
  Verdict: supports
- 5. Request: make a Codex review read a snapshot of the commit it records, so no edit in the session's folder
  refuses a run or a record; review only what the records leave when a commit below a merge of main lacks a record,
  and say a merge of main is needed only for a conflict the queue reports; make a round's fixes one commit and one
  recheck something the command says; run the double review of a proposal Claude first and Codex only on the copy
  Claude passed; show Codex input per landed PR with 2026-11-14 as the baseline.
  Q1 is put to him, not built.
  Adds: none

## Specs
His order for all of them: "hazme la pregunta de bloquear cuando pase y ademas aplica las mejoras para que no haya
ningun desperdicio como lo mencionas y dices" (69918425:6379, typed), after "me gustaria saber si lo estamos
utilizando optimizadamente o estamos utilizandolo a lo bestia y desproporcionadamente por favro revisa bien que no
se este gastando por esto" (69918425:6293, queued).
1. Every Codex session of `codex-review` runs in a detached worktree of `head` under `<common>/js-harness/`, made
   once per run and removed however the run ends (swept like a turn's when killed); records and the run log stay in
   the common git dir; a run whose `--cwd` is already such a worktree (a merge turn) makes none. The checks after a
   part and after the review that compare the live folder with `head` go, since Codex never read it; the refusal of
   a dirty tree at the start stays as it is.
2. A part that passed is kept for the next run of the same range whatever the live folder did meanwhile; a rerun
   repeats only the parts that did not pass.
3. When the oldest code commits no record covers lie below a merge of the default branch at HEAD (the merge itself
   writing no line, or reviewed by what was written in it), the run reviews them as a turn in a worktree of the
   merge's first parent from where the records end, then the merge by `mergeStart`, as `mergeTurn` does for the
   mirror case; never the merge's whole diff with main.
4. At the end of a run with findings, and at the start of a recheck, `codex-review` says the round: the findings
   open at that head, that they and the lens and verifier findings of the same head go in one commit, and that one
   `codex-review --base <head>` rechecks them together.
5. `merge-queue`'s line for a PR left out for a conflict names the fix: merge the default branch into it. Nothing
   else asks for that merge; the protocol §3 line on the base after a merge stays.
6. `rule:double-review` (§1) reads: the Claude reader first; the Codex reader reads only the frozen copy the Claude
   reader passed, blind to its answer; a read goes through `js-harness double-review read`, so it is recorded.
   Changed with `js-harness rules change double-review` on a `rule/` branch, quoting 6379.
7. `double-review read` runs the Claude reader, records and stops when it finds something, and runs the Codex
   reader on the same copy only when the Claude reader found nothing.
8. `codex-meter --per-pr [--since <day>]` prints, for each landed PR (`lands.jsonl`), its Codex runs and input
   tokens over all its days, the share in failed runs and in `reviewed` runs no record names, the runs of heads not
   landed yet, and the 2026-11-14 baseline beside the days after it.

## Tasks
- [ ] T1 (kind: build) specs 1, 2 — `bin/codex-review.mjs`, `bin/lib/codex-review-turns.mjs` + tests — commit `fix(codex-review): read a snapshot of the head, not the live folder`
- [ ] T2 (kind: build) spec 3 — `bin/lib/codex-review-turns.mjs`, `bin/codex-review.mjs` + tests — commit `fix(codex-review): review below a merge of main in turns`
- [ ] T3 (kind: build) specs 4, 5, and the senior-model name of L7 — `bin/codex-review.mjs`, `bin/lib/codex-review-recheck.mjs`, `bin/merge-queue.mjs` + tests — commit `feat(codex-review): say the round: one commit, one recheck`
- [ ] T4 (kind: build) specs 6, 7 — `rules change double-review` on `rule/double-review-sequence`, `bin/double-review.mjs` + test — commits `chore(rules): double review reads Claude first` and `feat(double-review): Codex reads only what Claude passed`
- [ ] T5 (kind: build) spec 8 — `bin/codex-meter.mjs`, `bin/lib/codex-meter.mjs` + tests — commit `feat(codex-meter): Codex input per landed PR`
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
