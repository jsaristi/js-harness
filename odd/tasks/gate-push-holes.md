# JH 112 · gate and push: two holes left open after JH 111

Locator: `odd/tasks/gate-push-holes.md` · Engram mirror: `odd/gate-push-holes/tasks` · Branch: `worktree-gate-push-holes`
(slice 1), a second branch from main for slice 2
Delivery: two pull requests to main, slice 1 first · Test runner: `node --test`

## Goal
The pre-push hook refuses the cut the merge door refuses, and the gate's same-tree proof never forgets a failure that
stands against a pass.

## Why
Two holes the lead found after JH 111. The push took a cut inside a reviewed range that the door then refused
(`js-harness failures door-covers-past-tip`, three sightings). The gate log's two rotating files drop a failure after
some hundreds of gates, and the proof JH 111 built (`odd/tasks/gate-narrow-pass.md`, L8 item 2) then judges the tree as
before it. Both touch guards (Task Size high risk, item 2).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/gate-push-holes.md` exits 0
- `node --test bin/check-codex-reviews.test.mjs bin/lib/lens-review-rows.test.mjs bin/lib/codex-review-coverage.test.mjs` exits 0
- `node --test bin/lib/gate-log.test.mjs bin/check.test.mjs` exits 0
- the planted cut of slice 1 in `bin/check-codex-reviews.test.mjs` and the planted forgotten failure of slice 2 each
  failed before its fix and pass after it, both runs quoted in `## Log`
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- both pull requests are merged into main, named in `## Log`, with Codex and the Claude lenses recorded over their code

## In scope / Out of scope
- In: `bin/lib/codex-review-coverage.mjs` (`reviewCoverage`), `bin/lib/codex-review-rows.mjs`,
  `bin/lib/lens-review-rows.mjs`, `bin/codex-review.mjs` (where it reads what records cover), `bin/lib/gate-log.mjs`,
  `bin/check.mjs` where the proof is asked, their tests, `docs/FAILURES.md`, the ROADMAP's Sensors row.
- Out: the other open failures of `odd/tasks/f8-lead-rigor.md` L13 (a follow-up goes to the lead in a notice);
  `~/.claude`, `~/.codex`, credentials, gentle-ai config.

## Constraints
- The push and the door judge cover by one function, not a copy — because the brief asks it and two copies drift.
- A gate log line gains a field, never changes one — because older installs read the same log.
- Tests first, each planted case red before its fix — because the brief asks it.

## Ask me before
Nothing here is his: Sebastián is away until about 02:00Z; a decision only he can take goes to the lead as a recorded
question (`js-harness notify --to orchestrator --kind question`, in Spanish).

## Specs
1. The brief (lead, 2026-10-30): "Make `check --push` judge cover the way the door does (the door's check is in
   bin/merge-queue and its test "a record whose head lies past the pull request covers it at its head and not
   merged"), sharing one function, not a copy: a planted cut inside a reviewed range is refused at the push, red before
   and green after. Update the failure's Control line."
2. The brief: "Decide in the feature document, with the evidence, the smallest fix: keep the last failure per tree
   outside rotation, or refuse `same` when the pass's own entry is older than the oldest kept failure, or another;
   tests first."
3. The brief: "Ready notice with --pr per slice; summary under docs/sessions/."

## Tasks
- [x] T1 (kind: build) spec 1: a record whose head lies past the tip covers nothing at the push, the plain row or
  `codex-review`; the planted cut red then green; the failure's Control line — commits: `2b678054`, `1283e5f2`
- [x] T2 (kind: verify) spec 3: Codex, the lenses, an independent verifier, PR 1 and its ready notice — PR 723,
  merged (L8-L12, L15)
- [x] T3 (kind: design) spec 2: the decision for the forgotten failure, with its evidence, in `## Log` — L4, L5
- [x] T4 (kind: build) spec 2: the fix, tests first, the planted case red then green — commits: `bebf5238`,
  `f9d4c09c` (L13, L14)
- [x] T5 (kind: verify) spec 3: Codex, the lenses, an independent verifier, PR 2, its ready notice, the summary — PR
  724, merged (L14-L16)

## Log
- L1 (2026-10-30, the brief as written, title): "JH 112 · gate and push: two holes left open after JH 111". Its words
  are in `C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T23-55-19-267Z-aee663a3.md`.
- L2 (2026-10-30, searched before building, slice 1): `js-harness rules` names no rule of review cover. codegraph over
  `checkCodexReviews`, `lensCoverage`, `reviewEvidence`, `reviewCoverage`, `headsPastTip`: the door
  (`reviewEvidence`, `bin/lib/merge-queue-reviews.mjs`) and the push (`check --push`, `bin/check.mjs`) already share
  their rows, `checkCodexReviews` and `lensCoverage`; they differ in the tip only. The door reads the pull request
  merged onto main (`asMerged`), past which no record's head lies; the push reads the branch's own head, and
  `reviewCoverage` counts a record whose head lies past the tip as cover (`headsPastTip`, since `6ad93abb`,
  2026-10-08). So the cut `1488343e` with Codex and lens `24c47ca..09ae012` passed the push and not the door.
- L3 (2026-10-30, slice 1, the decision): the rule goes into the one function both read, `reviewCoverage`, as an
  option the rows that refuse pass (`beyondTip: false`): `codexReviewCoverage` (the push row and the plain row) and
  `lensCoverage` (the lens push row, the plain `review` row and the door's `lensDoor`). At the door's merged tip it
  changes nothing, since no head lies past it; at a cut it refuses what the door refuses. `codex-review` reads it the
  same way where it decides what is already covered, because the push row's comment holds "what this refuses to push
  is what that command reviews": the command the refusal prints must not answer "nothing to review". Not taken: the
  push reading `asMerged` itself, since a branch that conflicts with main would then be refused at its push for the
  conflict, which is the door's business, not the push's. Cost: a stack reviewed as one range and pushed cut by cut
  is refused at each cut, as the door already refused it; the refusal names the record and the head to push to.

- L4 (2026-10-30, slice 2, the evidence): the gate log (`~/.js-harness/gate-log`, read at 00:20Z on 2026-10-31) holds
  1,956 lines in 650 KB, from 2026-10-24T10:21Z to 2026-10-30T23:44Z: 840 gates in 6.5 days, 90 of them ending in a
  failure, whose end lines average 369 bytes; 89 of the 90 name no `files` (written before PR 721). `gate-log-size`
  is 512 KiB, so the log keeps 512 KiB to 1 MiB: 5 to 10 days today. Only `provenBy` reads an end's `code` (codegraph
  and `grep -n "\.code\b"` over `bin/`). A failure is forgotten when rotation drops it while the pass after it stays:
  the failure in `log.1.jsonl`, the pass in `log.jsonl`, and the next rotation writes `log.jsonl` over the older file.
  A failure after the pass is never forgotten first, since the older line goes first.
- L5 (2026-10-30, slice 2, the decision): the failing ends that name `files` are also appended to a file of their
  own beside the log, `failed.jsonl` (rotated into `failed.1.jsonl` at the same `gate-log-size`), and the proof reads
  them before the log, the ones the log no longer holds first: a line rotated out of the log is older than every line
  it keeps, so the order `provenBy` reads stays the order they were written, and `provenBy` itself does not change.
  At about 200 bytes a line and 14 failures a day, the two files keep about 5,000 failures, months where the log keeps
  days. And a pass proves only where its end names `files` equal to the files now: a pass written before PR 721 could
  not be told against the failures before it, which name no files, so it is no proof; it costs one run of each such
  tree. Not taken: refusing `same` when the pass is older than the oldest failure kept, since that refuses sound
  proofs whenever the log rotated and still misses a failure older than the oldest kept one; and writing no `code` on
  a pass a failure stands against, since a pass after the failure rotated out writes it again. Left as it is: a
  failure written before PR 721 names no files and stands against nothing; nothing it holds names its tree (its start
  names the folder, not the tree), and the last of them leaves the log by about 2026-11-09 (10 days, the longest the
  log keeps today).

- L6 (2026-10-31, slice 1, red then green): the planted cut, "check --push refuses a cut inside a reviewed range on
  both rows, as the merge door refuses it, and names the head to push to" (`bin/check-codex-reviews.test.mjs`), before
  the fix: `✖ ... actual: 0, expected: 1`, both rows `PASS` ("2 code commits since origin/main, all covered by a Codex
  review record", "1 code commit since origin/main, all covered by a Claude lens record"); after it `✔`. The command
  the refusal prints, "a range covered only by a record whose head lies past it is not covered: the run plans its
  review ..." (`bin/codex-review.test.mjs`, run by `codex-review.second.test.mjs`), with `codex-review` reading past
  the tip: `✖`, "Nothing to review: 4fd69f6..f8967bb holds 2 code commits, and a Codex review record already covers
  all of them"; after: `✔`. Five older tests held the old rule and were changed with it: "a record whose head lies
  past the pushed tip still covers ..." now says it covers nothing there and names the head; "a review that left out
  documents alone still covers an earlier tip ..." reads `reviewCoverage` as the planner does; the three cost tests
  ("one git process together", "no longer knows", "each is asked about on its own") count the processes of the
  reading the push row makes, since the row now fails and its failure asks git where a review would start. Then
  `node --test bin/check-codex-reviews.test.mjs bin/lib/lens-review-rows.test.mjs bin/lib/codex-review-coverage.test.mjs
  bin/codex-review.test.mjs bin/codex-review.second.test.mjs bin/merge-queue.test.mjs bin/lens-review.test.mjs`: 614
  tests, 607 pass, 5 fail (the five above, before they were changed); `bin/check-codex-reviews.test.mjs` alone after:
  109 of 109. `docs/FAILURES.md`: the Control line of `door-covers-past-tip` is the planted cut, the door's test kept
  as a `Was:` line; `js-harness failures door-covers-past-tip` says "state: controlled".

- L7 (2026-10-31): the first commit of T1 failed its gate on CI, once (8,341 tests, 2 failed, 146 skipped):
  `bin/conventions-structure.test.mjs`, "bin/codex-review.mjs grew to 2285 lines, over its ceiling of 2284" (a
  comment line, dropped: the reason is in `reviewCoverage`'s header); and `bin/lib/merge-queue-reviews.test.mjs`, "a
  record whose head lies past the pull request covers its head alone and not merged", a sixth test of the old rule,
  in a file the local run did not hold, now asserting the push of the branch refuses it too. Then `node --test
  bin/lib/merge-queue-reviews.test.mjs bin/conventions-structure.test.mjs`: 14 of 14.

- L8 (2026-10-31): T1 is `2b678054` (gate on CI green on its second try). Codex over `f178018..2b67805`: correct
  (0.88), no finding. Lenses risk, reliability and readability: 0 findings each. gentle-ai, the hook's candidate
  being this commit alone (`f178018b..HEAD`): its `granted` invocation run as `CLAUDE.md` says, approved, one
  SUGGESTION (`R3-plain-row-beyond-lines-untested`: no test asserted the new line on the plain rows), acknowledged.
  The independent verifier, a read-only agent given the code and not this document's conclusion, found no sequence
  where the push and the door disagree, and three real things, all in what a refusal tells and costs:
  (1) real: pushed below HEAD (a chain cut pushed from its top), neither printed command makes the record the push
  asks for: `codex-review` has no `--head` and reviews up to HEAD, where the record past the cut covers all, and the
  lens hint names no `--head`. The line said "make a record that ends here" without saying how. Fixed: it now says
  to check the cut out and make the record with the command below, which reviews up to HEAD; checked by reading
  `bin/codex-review.mjs` (no `--head`) and `bin/lens-review.mjs:160` (`--head` defaults to HEAD).
  (2) real: `mergeStart` still counted a record past the merge, so `codex-review` at a cut that is a merge of main
  reviewed the whole branch again instead of the merge's own lines. Fixed, tests first: its `atMerge` reading passes
  `beyondTip: false`; "a merge of main that only a record past it covers is still read by what was written in it"
  (`bin/lib/codex-review-coverage.test.mjs`) failed before (`actual: undefined`) and passes after. Its `before`
  reading keeps the default: its tip is the merge's first parent, below the pushed commit, and a record between the two
  counts at the push.
  (3) left as they are: `codexSkipsOwed` and `baseLeftOut` still count a record past the tip; neither refuses
  anything (a list of skips in `doctor` and the plain row, and a note on a base chosen by hand). Sent to the lead as a
  follow-up. Limits it named: with two records past the tip the line names the first written, and either head works;
  a cut inside a record of nothing to review gets no line, since such a record never covers short of its head.
  gentle-ai's suggestion is taken in the same commit: the first test of the old rule now also checks the plain row's
  line. Then `node --test` over `bin/check-codex-reviews.test.mjs bin/lib/codex-review-coverage.test.mjs
  bin/lib/lens-review-rows.test.mjs bin/lib/merge-queue-reviews.test.mjs bin/codex-review.second.test.mjs
  bin/conventions-structure.test.mjs`: 334 tests, 332 pass, 0 fail; `bin/codex-review.test.mjs`: 160 of 160.

- L9 (2026-10-31): the verifier's fixes failed their gate on CI once (8,342 tests, 1 failed):
  `bin/lib/gentle-ai-absence.test.mjs`, "no file under bin, evals or scripts names gentle-ai but the named ones": a
  test comment named the review's tool. Reworded; that test then 3 of 3.

- L10 (2026-10-31): the verifier's fixes are `1283e5f2` (gate on CI green). Codex over `2b67805..1283e5f`: correct
  (0.9), no finding. Lenses risk and reliability: 0 findings. gentle-ai over the same commit: its `granted` invocation
  started (lineage `review-1511b14c5ac86b6f`); its reliability lens is captured with `gentle-ai review
  capture-result --cwd . ... --agent=claude-code` (no `--materialize`: the compiled runtime runs the lens itself), then
  `acknowledge-approved` with the command its result prints. Every code commit of slice 1 then has a Codex record and
  a lens record: `2b678054`, `1283e5f2`.

- L11 (2026-10-31): gentle-ai over `1283e5f2`: approved, two SUGGESTIONs left as later work
  (`R3-beyond-lines-empty-tip-default`: `beyondLines`'s `tip` defaults to ''; `R3-tip-abbrev-length-mismatch`: the
  line slices ids to 7 where git's short ids may be longer), acknowledged. Slice 1 is reviewed whole.

- L12 (2026-10-31): slice 1 pushed (the pre-push hook passed) and opened as PR 723; `js-harness notify --kind ready
  --pr 723` recorded at 00:54Z. T2 is done but for the merge. Slice 2 goes on branch `gate-forgotten-failure`, made
  from `9d30c96d` in this worktree, so this document stays one line of history; its PR is based on main once 723 lands.
  The follow-ups (L8 item 3, the two SUGGESTIONs of L11) went to the lead as a note at 00:55Z.

- L13 (2026-10-31, slice 2, red then green): searched first: codegraph and `grep` over `bin/` for the readers of an
  end's `code` (`provenBy` alone, L4) and for the files beside the log (`busiest.jsonl`, `test-times.jsonl`, each by
  `appendLine`); `js-harness rules` names `gate-log-size`, the bound the new file takes. Built as L5 says:
  `appendGateFailure` (`failed.jsonl`, rotated by `appendLine` into `failed.1.jsonl`), written by `gateRecord.end` with
  the end line itself where the result is not a pass, the files are a key and the sensors a list (what
  `standsAgainst` reads); `readGateFailures` (`null` where a file that is there cannot be read: no proof);
  `readGateProof`, the failures the log no longer holds and then the log, which `proven` in `bin/check.mjs` now reads;
  `provenBy` takes only a pass whose end names those `files`. The planted case, "a tree whose tests failed on CI is not
  proven by a narrower pass here after the gate log rotated the failure away" (`bin/check.test.mjs`), before:
  `AssertionError: the commit entered on a pass narrower than a run that failed and was rotated away`; after: `✔`.
  The pass's files: "provenBy: nothing but a passed end with that very key is a proof", with the rule taken out,
  `actual: { id: 'g1', ... }, expected: null`; with it, `✔`. `bin/lib/gate-log.test.mjs` could not load before the two
  new readers existed, 51 of 51 after. One older test wrote a pass with no files ("a gate that waited for the lock
  looks for its proof once more"); it now writes the files' key. Then `node --test` over `bin/check.test.mjs
  bin/gate.test.mjs bin/check-ci-gate.test.mjs bin/check-ci-record.test.mjs bin/conventions-structure.test.mjs
  bin/lib/gentle-ai-absence.test.mjs bin/lib/gate-log.test.mjs bin/throughput.test.mjs bin/rules.test.mjs`: 476 of 476.
  `uninstall` removes the whole folder (`removeGateLogFolder`), the new files with it.

- L14 (2026-10-31): T4 is `bebf5238` (gate on CI green, first try). Codex over `9d30c96..bebf523`: correct (0.88), no
  finding. Lenses risk, resilience and reliability: 0 findings each. gentle-ai over the same commit (lineage
  `review-26b1ad328502cb31`, its `granted` invocation run as `CLAUDE.md` says): approved, one WARNING, informational,
  `R3-001`: a failure the log lacks for another reason than rotation (its line there refused or torn) was put before
  the whole log, so a same-key failure after a pass read as before it; acknowledged. The independent verifier, given the
  code and not this document's conclusion, found no sequence where a failure written by the new code and lost to
  rotation alone lets a proof through, checked that every end line is written by `gateRecord.end` (`check`, `ci-gate`,
  `gate --`), and found three things, none a regression:
  (1) real, left as it is with its end date: failures written between PR 721 and this commit are in the log alone, and
  one rotated away still lets a pass after it prove, until they all leave the log (10 days at most, by about
  2026-11-10); seeding the failures file from the log was not taken, since it writes in a reading or migrates once for a
  window that closes by itself, and L4 counts one such failure in 90.
  (2) real: a file of the log that cannot be read still gave a proof, its lines missing. Fixed: `readGateProof` gives no
  events when `readGateLog` says a file is unavailable.
  (3) the same as `R3-001`. Fixed: each failure the log lacks goes before the first line written after it, after one of
  the same instant. Tests first, "readGateProof puts a failure the log lacks where its time puts it, and gives no events
  when a file of the log cannot be read" (`bin/lib/gate-log.test.mjs`): before, `actual: [ 'end g2', 'start g1', 'end
  g1' ]`; after, `✔`. The first test of `readGateProof` gave its failure the same instant as the pass, which a rotated
  failure never has; it now has an earlier one. Then `node --test bin/check.test.mjs bin/gate.test.mjs
  bin/check-ci-gate.test.mjs bin/check-ci-record.test.mjs bin/check-exact-tests.test.mjs
  bin/conventions-structure.test.mjs bin/lib/gentle-ai-absence.test.mjs bin/lib/gate-log.test.mjs`: 418 of 418.
  Seen and left for later: `bin/lib/manifest.mjs:1448` says the folder holds two files; it has held more since
  `busiest.jsonl`, and the removal is of the whole folder.

- L15 (2026-10-31): the fixes of L14 are `f9d4c09c` (gate on CI green, first try). Codex over `bebf523..f9d4c09`:
  correct (0.9), no finding. Lenses risk and reliability: 0 findings. gentle-ai over the same commit (lineage
  `review-9ebad3491893eba1`): approved, one SUGGESTION, `R3-001`: an unparseable `at` would put a failure last, which
  is the safe side, and no test pins it; left, since `hasHead` refuses every line, of the log or of the failures, whose
  `at` does not parse, so no such line reaches `readGateProof`; acknowledged. PR 723 merged at 01:01Z (T2 done).
  Slice 2 is reviewed whole: every code commit, `bebf5238` and `f9d4c09c`, has a Codex record and a lens record. The
  summary is `docs/sessions/2026-10-31-jh-112-gate-and-push-two-holes-left-open-after-jh-111.md`.

- L16 (2026-10-31): slice 2 pushed (the pre-push hook passed) and opened as PR 724; `js-harness notify --kind ready
  --pr 724` recorded at 01:35Z; merged at 01:49Z (`82919956`). On that main, `npm run check`: `PASS  check  14 rows
  passed, 7 of them INFO`; the contract's commands there: 160 of 160, 306 of 306, `contract check` and `rules check`
  PASS. Both fixes are on main through reviewed pull requests, each planted case red before and
  green after (L6, L13): the contract's end is met. The feature is done.

## Next step
None: the feature is done (L16). Its follow-ups went to the lead (L12, L14).
