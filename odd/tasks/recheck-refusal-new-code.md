# A refused recheck range that holds unread code

A fix assigned by the lead, on branch `fix/recheck-refusal-new-code`. Test runner: `node --test`.

## Goal
A second-recheck refusal over code no Codex review read names the review that reads it, never a skip.

## Why
The refusal told every caller to record the range with `--unavailable`. On 2026-10-19 the memory-backup
session did so for c305bc02, a new commit no review had read; only `--base <earlier commit> --again` got it
reviewed. A skip is for when Codex cannot run (AGENTS.md).

## Done when
- `npm run check` exits 0
- `node --test bin/lib/codex-review-recheck.test.mjs` exits 0, with the test of the refusal over unread code;
- `node --test bin/codex-review.second.test.mjs bin/codex-review.test.mjs` exits 0, with these tests:
  - a range with an earlier recheck plus one new code commit is refused with a runnable review and no `--unavailable`, and that review runs;
  - the pure second recheck keeps its refusal.

## In scope / Out of scope
- In: `bin/lib/codex-review-recheck.mjs`, `bin/codex-review.mjs`, their tests, this document.
- Out: the push row of `check`, whose hint for a root commit still offers `--unavailable` (bin/check.mjs:2362).

## Constraints
- A range whose every code commit has a record keeps the skip it was offered.

## Ask me before
Nothing: the lead assigned the fix.

## Specs
- S1 "when the refused range holds commits no recorded Codex review covers, the refusal must say how to review those commits (the base and flag that work) and must not offer `--unavailable`, which is only for when Codex cannot run (AGENTS.md)" (the lead's brief).
- S2 "the pure second-recheck case keeps its current refusal" (the lead's brief).

## Tasks
- [x] T1 (kind: build) S1-S2, inline: `secondRecheckRefused` takes the uncovered commits and the nearest commit behind the range that `--again` reviews as any other (`d365d79c`).

## Log
- L1 (2026-10-22, the lead's brief): "`js-harness codex-review` refuses a range based at the head of an earlier recheck as a "second recheck" (the correction bound), and its refusal text tells the caller to record `--unavailable`."
- L2 (`d365d79c`): RED was the new test in each file; GREEN 11 targeted tests, then `npm run check` (tests on CI in 124 s). The base it names is found on the first-parent line behind the range, up to 20 commits: the recheck's own base is refused as well, so the commit before it is the one that works.
- gentle-ai on `d365d79c` (`52004bd7..d365d79c`): assessed medium, not due (under budget).
- Codex: `b7fe295..d365d79` correct (0.86), recorded.
