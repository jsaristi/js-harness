# Codex coverage that survives a rebase

Locator: `odd/tasks/codex-patch-coverage.md` · Engram mirror: `odd/codex-patch-coverage/tasks` · Branch:
`feat/codex-patch-coverage` · Delivery: `ask-on-risk` · Runner: `node --test`

## Goal

A commit that a rebase only moves, its reviewed code unchanged, keeps the Codex review it had, so a
conflict costs a review of the commits it changed and of no other.

## Why

Item 6 of the lead's throughput plan of 2026-10-16 (version 2, after two readers): "Codex coverage
survives a rebase (match by patch-id), so a conflict does not cost a new review", baseline "~157k tokens
per re-review". His words behind the plan: optimize until more optimizing costs more than it returns,
"pero manteniendo la calidad y fiabilidad". Today a record covers the commits `rev-list <base>..<head>`
lists (`bin/lib/codex-review-coverage.mjs:53-56`), by commit id. A rebase gives every commit a new id,
so a branch rebased onto `main` to clear a conflict has no covered commit left, and the push check
refuses it until the whole branch is reviewed again.

## Done when

- `node --test bin/lib/codex-review-coverage.test.mjs` exits 0
- `node --test bin/codex-review.test.mjs` exits 0
- `node --test bin/check-codex-reviews.test.mjs` exits 0
- `npm run check` exits 0
- In a scratch repository, a branch with a Codex review record, rebased onto a moved `main` with no
  change to its code, passes `js-harness check --push`; one whose rebase changed a code line does not.

## In scope / Out of scope

- In: `bin/lib/codex-review-coverage.mjs`, `bin/codex-review.mjs` (the record it writes),
  `bin/lib/codex-reviews.mjs` (the record's shape), their tests, the README, `docs/SPEC.md`.
- Out: who rebases and when, and force-pushing a pull request's branch: that is the merge queue's
  and the lead's (items 2 and 3 of the plan). A merge of `main` already costs only what was written in it
  (`writtenInMerge`, `bin/lib/codex-review-coverage.mjs:143`); nothing here changes that.

## Constraints

- Never weaker: a commit counts as reviewed by a match only when the code a review would read of it is
  byte for byte the code a review read, its context lines included — because the plan's stop rule bars
  any item that lowers quality, and a review of other code is no review.
- No cost at a commit that owes nothing: the patch ids are asked only when a commit is uncovered and a
  record holds patch ids — because the coverage row runs at every commit, and each git process costs
  240 to 370 ms on this machine (`odd/tasks/rule-hierarchy.md`, T16f's time).
- Old records stay valid and are read as before — because `codex-reviews.jsonl` is history the push
  check reads; a record with no patch ids simply covers no moved commit.

## Ask me before

Nothing: the feature changes no rule and spends nothing; its cost is measured in the Log.

## Specs

- S1 (L1) A code commit that is in no record's `<base>..<head>` is covered by a record when its patch
  id equals one the record holds.
- S2 The patch id of a commit is `git patch-id --verbatim` over its patch against its first parent,
  cut to the files a review reads (`patchOfRead`, `bin/lib/codex-review-scope.mjs:204`), exactly as
  `js-harness codex-review` cuts a range. A commit whose cut patch is empty has no patch id. A merge has
  none: it is covered as today, by what was written in it.
- S3 `js-harness codex-review` writes, in each record it appends, the patch ids of the code commits of the
  range it recorded, as `patchIds`: a list of `{ commit, patchId }`, the commit being the one it reviewed.
  Every outcome carries them (`reviewed`, `unavailable`, `nothing to review`), so a match covers as the
  record would have covered the commit it was asked of; `notReviews` still names a skip.
- S4 Coverage asks for patch ids only when its range has an uncovered code commit and a valid record
  holds `patchIds`, with one `git log` and one `git patch-id` for all of them. When git does not answer,
  the commits stay uncovered: unknown is never covered.
- S5 What the push check and `codex-review` say names a commit covered by a match: "covered by the
  record of <base7>..<head7>, by its patch (it was <old7>)".

## Design

**Why the patch id, and why `--verbatim`.** `git patch-id` hashes a patch's changed and context lines
with line numbers left out, so a commit moved by a rebase whose hunks and their three lines of context
are unchanged keeps it. `--verbatim` keeps whitespace in the hash (git's default drops it), so a change
of indentation is a new patch. Context lines in the hash are what keep the match honest: a rebase that
changed the code around a hunk changes the id, and that commit is reviewed again.

**Why cut to the files a review reads.** The conflicts that force a rebase are mostly in the shared
documents (`docs/ROADMAP.md`, the feature documents, the README: item 4 of the plan). A whole-commit id
would change with them though no reviewed line did. The cut is the one the review itself makes, by the
marks at the tip, so the hash is over what a review would read.

**Where the ids come from.** At record time, from the commits the run reviewed: their objects exist then,
and the run already knows the files it read. At coverage time, from the uncovered commits. Ids are never
computed for an old record's commits: those may be gone after a rebase and a prune, and asking for them
would cost a process per record ever written.

**The cost.** Recording: two git processes per run (`git log -p --no-walk` of the range's code commits,
cut by section in JavaScript, then one `git patch-id --verbatim` over the joined stream with a
`commit <id>` line before each patch). Coverage: the same two, only under S4's condition. A branch with no
uncovered commit, or a repository whose records hold no `patchIds`, pays nothing.

**What a match means.** The covered commit is reported with the record and the commit the record
reviewed (S5), so a reader can see that the review was of another commit with the same code. A record
that left out marked files (`leftMarkedFilesOut`) still covers only commits of its own range, as today:
its cut was by the marks of its own head.

**What is not changed.** Merges, the rules for a record whose head lies past the tip, `--again`, the
recheck of findings, and the record's schema version: `patchIds` is an optional field, and a record
without it is valid.

## Tasks

- [x] T1 (kind: design) This design, read by two readers who did not write it; route: inline, the
  readers delegated (Opus). Read: both found it unsound as written (Log).
- T2, dropped by the stop rule, never built (Log; docs/ROADMAP.md, throughput item 6): (kind: build) S2
  and S3: the patch ids of a range, and the record that keeps them; route: inline (no writer trigger:
  one unit).
- T3, dropped by the stop rule, never built: (kind: build) S1, S4 and S5: coverage by patch id, and
  what is said of it; route: inline.
- T4, dropped by the stop rule, never built: (kind: verify) The "Done when" scratch repository, the
  timing of a check with and without a match, and the reviews (gentle-ai, escalated if a high-risk item
  applies; Codex).
- [x] T5 (kind: build) The merge hint: `js-harness rule change` on a branch not based on `origin/main`
  says `git merge origin/main`; route: inline (Log; PR 321).

## Log

- L1, 2026-10-16, the lead's notice to 27 (the lead's claim, read in the channel): "after 315 lands,
  take throughput item 6 of C:/Users/Oficina/AppData/Roaming/Claude/side-session-notes/local_053e19d7-d91d-4aa6-a210-3f014cf86050/throughput-plan.md:
  Codex coverage survives a rebase (match commits by patch-id), so a conflict does not cost a new ~157k
  review. Design first, two readers, then test first. Tell me the PR."
- 2026-10-16, T1 started by JH 27. Map: coverage by commit id at `bin/lib/codex-review-coverage.mjs:175-259`;
  the record written at `bin/codex-review.mjs:1394`; the cut by file at `bin/lib/codex-review-scope.mjs:204`;
  `git patch-id --verbatim` present in git 2.53.

- 2026-10-16, T1 read by two Opus readers (version 1 committed as fed42da). Both found that the design,
  as written, counts unreviewed code as reviewed:
  - A review reads the net diff of its range (`bin/codex-review.mjs:1462`), not each commit's patch. A
    range holding A (adds a line) and R (reverts it) reads an empty diff; a rebase that drops R leaves A'
    with A's patch id, covered though no review read the line. A match must be per record: every
    `patchId` of the record matched in order by one run of commits, whose combined cut diff equals a
    `rangePatchId` of what Codex read.
  - Nothing-to-review records (`onlyWhole`) and remerge records must carry no patch ids.
  - `correctionOwed` (`bin/check.mjs:2013`), `notReviews`, `mergeStart` and the recheck anchor
    (`bin/lib/codex-review-recheck.mjs:72-117`) key on commit ids: a match must enter `covered`, and a
    record that owed a correction must not cover by patch, or a rebase escapes the recheck.
  - The diff must be pinned (`-U3`, `--full-index`, `--no-textconv`, `--no-renames`, ...): repository
    `diff.context=0` drops context from the id, and binary diffs hash the `index` line.
  - S4 as written costs two git processes (0.5-0.7 s) at nearly every commit, since an uncovered commit
    and a record with patch ids is the normal state between reviews.
  - Reader B: nothing in the repository rebases on purpose (the merge queue merges `--no-ff`,
    `bin/merge-queue.mjs:142`; conflicts are cleared by merging `main`; a merge already costs only its
    remerge diff), so the saving needs a baseline.
- 2026-10-16, the baseline, measured on `codex-reviews.jsonl` (491 records since 2026-09-29): 15 records'
  heads are on no branch; 10 of them had their commits moved and reviewed again; in 4 the moved commit's
  code-only patch id equals the reviewed one (2012aa5, 4b53504, 3aaed99, fca77f0), so 4 re-reviews in 17
  days are what a sound version of this item would have saved. Records hold no token count, so the ~157k
  per re-review is the plan's figure, not measured here.

- 2026-10-16, the lead's call (the lead's claim, in the channel): "agreed, drop item 6 by the stop rule (4
  re-reviews saved in 491 records do not pay for a high-risk push-guard change), and take the hint fix
  (rules-change-run.mjs:128: merge, not rebase) as a small PR, test first. In the same PR, mark item 6
  dropped in docs/ROADMAP.md's throughput table with your numbers (the table arrives with PR 316, which
  is in the land now; merge main after it lands), and push the findings document."
- 2026-10-16, T5 (kind: build, route: inline): `js-harness rule change` on a branch not based on
  `origin/main` now says `git merge origin/main`. RED: the updated assertion and a new test that runs the
  told command failed (`git rebase` refuses `--no-edit`); GREEN: 2 of 2.
- 2026-10-16, the feature closed (the lead's notice to 27): `js-harness progress` still counted it 0 of 4
  open after the drop. It counts every checkbox as a step and has no state for a dropped one, so T2-T4,
  dropped and never built, are list items without a checkbox now, their text kept; T1 is checked, as the
  readers did read it, and T5, built and merged in PR 321, has a checkbox of its own.

## Next step

**Closed, 2026-10-16, JH 27:** item 6 dropped by the stop rule (T2-T4 not built); T5, the merge hint,
merged in PR 321. Nothing is left to do here.
