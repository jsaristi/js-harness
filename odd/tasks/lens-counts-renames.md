# The Claude lenses read a renamed file by the lines it changes

Locator: `odd/tasks/lens-counts-renames.md` · Branch: `fix/lens-renames` · Delivery: one pull request to main ·
Test runner: `node --test`

## Goal
`js-harness lens-review` reads a file a range renames as git measures a rename, by the lines it changes, as
`codex-review` does since pull request 775; a range that renames a file a review leaves out into one it reads is still
read renames off, whole; the 150,000 input tokens a lens is handed stays.

## Why
JH 142's move of the workshop under `workshop/` (`odd/tasks/workshop-product-split.md`, L24) is 591 changed lines as a
rename and about 243,000 input tokens a lens renames off, over the 150,000 a lens is handed, so no lens can review it
and the skip recorded for it holds the series at the merge door. The owner answered question 199 "Lentes por lo que
cambia (recomendado)" (2026-11-05 19:15 local, the lead's transcript `0f71b2c6`, line 68447), whose yes covered only this
change to `lens-review`, and neither the cap nor anything else.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/lens-counts-renames.md` exits 0
- `node --test bin/lib/lens-candidate.test.mjs` exits 0
- `node --test bin/lib/codex-review-coverage.test.mjs` exits 0
- `npm run check` exits 0
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code and an
  independent verifier's verdict in `## Log`

## In scope / Out of scope
- In: `lensCandidate` (`bin/lib/lens-candidate.mjs`), which builds the block a lens reads and the subject hash every
  review record carries; the check of that hash in `reviewCoverage` (`bin/lib/codex-review-coverage.mjs`); the
  lens prompt's description of the manifest (`bin/lib/lens-prompts.mjs`); their tests; this document.
- Out, each with its reason:
  - the 150,000 input tokens a lens is handed: his answer kept it.
  - `codex-review`'s reading of a range: pull request 775 made it, and this change reuses its `rangeFiles`.

## Constraints
- The candidate reads a range through `rangeFiles` (`bin/lib/codex-review-scope.mjs`), with the option it chooses —
  because the lenses and Codex must count, leave out and fall back on the same files (L7 of
  `odd/tasks/rename-counted-by-changes.md`).
- A range where git finds no rename gives the block and the subject hash it gave before — because every record
  already written carries that hash, and a record whose hash no longer matches covers nothing.
- A record written before this change, whose hash is of its range read renames off, still covers while that reading
  hashes to it — because the hash proves the patch of its range did not change, which the reading renames off proves
  as well; otherwise every record over a range with a rename, the move's Codex record among them, would be void.
- A renamed file is one manifest entry, by its new path, naming its old one — because the lens answers with every
  manifest path, and a rename's patch is one section of git's diff.

## Ask me before
Nothing planned: question 199 decided the change. A question goes to the lead with
`js-harness notify --to orchestrator --kind question`.

## Depth pass
- 1. Method: change review sizing, the discipline of code review tooling, to the standard pull request 775 set for
  `codex-review` (a reviewer reads what changed; GitHub's "renamed with changes"). The smallest change: the candidate
  asks `rangeFiles` for the files and the option, diffs its name-status and patch with that option, and keeps a
  rename's two names in one entry. Searched first (`rule:reuse-first`): `rangeFiles`, `numstatFiles`,
  `patchSections` and `leftOutOfFiles` exist and are reused; `lensCandidate` is the one builder of a lens's block,
  and its hash is checked in one place, `reviewCoverage` (`bin/lib/codex-review-coverage.mjs:268`).
- 2. Raw material: `bin/lib/lens-candidate.mjs` (`DIFF` with `--no-renames`, `statusOf`, `numstatCounts`);
  `rangeFiles`, `bin/lib/codex-review-scope.mjs:173`; `withSubjectHash`, `bin/lib/codex-reviews.mjs:98`, which gives a
  Codex record the same hash; the move of JH 142, `52d0703..fd1da6e` on `feat/workshop-dispatch`; his answer, the
  lead's transcript `0f71b2c6`, line 68447.
- 3. The bar:
  spec 1: `node --test bin/lib/lens-candidate.test.mjs`: none, new behaviour; today a range that renames a 200-line file
  and changes one of its lines hands a lens the whole file twice, removed and added.
  spec 2: `node --test bin/lib/codex-review-coverage.test.mjs`: none, new behaviour; today a record whose hash is of
  its range read renames off would be stale once the candidate reads renames on.
- 4. Refutation: does the move fit a lens once renames are read, and does a record written before keep covering? The
  move read with `git diff --find-renames --numstat 52d0703 fd1da6e`: 591 changed lines, every moved file a rename;
  the move's Codex record, written this day, carries the hash of the reading renames off.
  Verdict: supports
- 5. Request: as the Goal; the compatibility of older records is what keeps the change from voiding reviews already
  paid for, which his yes needs to be useful; nothing more.
  Adds: none

## Specs
1. Question 199, as he said yes to it: "Lentes por lo que cambia (recomendado)": "Un PR aparte a main, con la prueba
   primero y revisado como todo: las lentes leen un archivo movido como Codex desde el PR 775, y un documento
   convertido en código sigue leyéndose entero. Cuesta entre 1 y 2 horas; después corren las lentes de la mudanza. Un
   sí cubre solo ese cambio a lens-review, no el tope de 150.000 ni nada más."
2. The lead's brief (2026-11-05): "a separate PR to main, test first, so lens-review counts a renamed file by what it
   changes as codex-review does since PR 775, with a document turned into code still read whole. Not the 150k cap,
   nothing else."

## Tasks
- [x] T1 (kind: build) specs 1-2: the tests first, then the candidate through `rangeFiles` and the older hash kept ·
  `bin/lib/lens-candidate.mjs`, `bin/lib/codex-review-coverage.mjs`, `bin/lib/lens-prompts.mjs`
- [ ] T2 (kind: verify) Codex, the lenses and an independent verifier over the branch; the pull request

## Log
- L1 2026-11-05, question 199 (the lead's transcript `0f71b2c6`, line 68447), tapped: "Lentes por lo que cambia
  (recomendado)".
- L2 2026-11-05, the lead's brief to JH 142, as Spec 2 quotes it.
- L3 2026-11-05, the tests first, each seen red before its code: `lens-candidate.test.mjs`, "a renamed file is one
  entry by its new path" (the manifest held the old path removed and the new one added) and "the prompt tells every
  lens how a renamed file is written"; `lens-review-rows.test.mjs`, "a record written while the lenses read renames
  off still covers its range", red against the coverage of main with the new candidate (a scratch copy). Two tests
  pin what must not move and passed before and after: a document renamed into code is read whole, and a range with
  no rename gives the same block and hash. The move's Codex record, `52d0703..635a64b`, carries
  `ff6470d5…`, the hash of its range read renames off, as computed again here. Under the new reading the move's
  lens block, `52d0703..fd1da6e`, is 51 paths (32 renames) and 77,477 characters.
- L4 2026-11-05, the suites that read the candidate's hash: `lens-review`, `codex-review-coverage`, `lens-reviews`,
  `merge-queue-reviews`, `check-codex-reviews` and `lens-result`, 188 of 188 under `js-harness gate`.
- Next step (for a resume): T2, the reviews of the code commit.
