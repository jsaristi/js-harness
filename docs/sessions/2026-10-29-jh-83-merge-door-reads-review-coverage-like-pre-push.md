# JH 83 · Merge door reads review coverage like pre-push

Opening: the lead's brief `C:\Users\Oficina\.js-harness\background\briefs\2026-10-29T10-39-59-894Z-2b9d0772.md`, started
with `js-harness sessions start`. Branch `fix/door-reads-coverage-like-pre-push`, base main `7eb2a709`. No feature document:
the brief named the scope, the surface and the done-when, and asked for this summary and one ROADMAP line as the record.

## Goal
`js-harness merge-queue --land` called a pull request's commit covered by a review record, built and tested a candidate, and
then the pre-push `check --push` refused the push of main for that commit. Make the door and the push read coverage the same
way, refuse such a pull request before any candidate, and have a refused push print the hook's reason.

## The user's words
None in this session: the work is the lead's brief, not Sebastián's message. Its task, quoted: "Find why the door's
per-commit lines ... accept a record that `check --push` does not"; "the door and the pre-push check read coverage through
one function, so they cannot disagree again. Pick the smallest shape and say why"; "The refused push prints the hook's
reason, not only git's first line"; "One `- Seen:` line in docs/FAILURES.md for this defect (two sightings)".

## Delivered
- `b37e2710` fix(merge-queue): the door asks `checkCodexReviews` and `lensDoor`, the rows `check --push` runs, of the pull
  request's head merged onto main (`asMerged`: `git merge-tree --write-tree`, then `git commit-tree`, an object with no ref,
  worktree or hook), the tip the push of main checks, not of the head itself. A pull request that conflicts with main is
  refused by the door, naming its files. A refused push of main prints the hook's FAIL rows from the push's stdout and
  stderr. The door's glue moves to the new `bin/lib/merge-queue-reviews.mjs` (with its test), re-exported from
  `bin/merge-queue.mjs` for `bin/notify.mjs`; the ceiling of `bin/merge-queue.mjs` goes from 1032 to 1006 lines.
- `3f3fc075` docs: `docs/FAILURES.md` entry `door-covers-past-tip`, two `- Seen:` lines; `docs/ROADMAP.md`, S1, one
  "Later fix" line.
- `9343b831` fix(merge-queue): with the Codex review off, the door's lines name only the pull request's commits, never the
  merge it makes (the verifier's finding 1).
- PR 663 (https://github.com/jsaristi/js-harness/pull/663): ready, not merged. `npm run check` on the branch: "PASS check
  15 rows passed".

## Decisions
- **Root cause (this session, reproduced).** The brief's premise, that the record's range never held the commit, is not
  so: `git rev-list a7b6ae4..f30d360` lists `4b85503f`. The record's head `f30d360` is a child of `4b85503f`, the PR's
  head at the land (`git log --format='%h %p' -1 072df094` gives `072df094 11194ae5 4b85503f`). `reviewCoverage`
  (`bin/lib/codex-review-coverage.mjs:247-260`) lets a record whose head lies past the tip cover the commits under it. At
  the tip `4b85503f` the record covers it; at the candidate `b5236e39` nothing lies past the tip and it covers nothing.
  Reproduced on the records as they stood before 10:25Z (`reviewCoverage` from `11194ae5`): "4b85503f code 1 uncovered []
  4b85 covered by [ 'a7b6ae4..f30d360' ]" against "b5236e39 code 2 uncovered [ '4b85503f' ] 4b85 covered by []". The first
  sighting (PR 644, 03:01Z) is the same case; JH 79 named it at 03:04Z in the channel.
- **Shape (this session).** The door already called the push's own rows. Only the tip differed. So the door now asks them
  of a commit shaped like the push's tip, and adds no reader of coverage. The other shape was a flag that turns the
  past-tip rule off for the door. It changes three modules instead of one and keeps two tips, so the next rule that depends
  on the tip could disagree again.
- **The new module (the lead, notice at 06:31 local).** The first commit of the fix was refused by
  `bin/conventions-structure.test.mjs` (1061 lines over a ceiling of 1032). The lead widened the surface to a new
  `bin/lib/merge-queue-reviews.mjs` and its test. The coverage stays in `codex-review-coverage.mjs` and the lens rows. The
  ceiling was lowered to 1006, as that test requires ("lower its ceiling from 1032 to 1006").
- **FAILURES.md (this session).** The brief asked for "one `- Seen:` line ... (two sightings)". The register's own rule is
  one line per occurrence (`docs/FAILURES.md`, Entries), and both sightings have evidence, so the entry has two.
- **gentle-ai.** Twice the Stop hook offered a review of the whole branch (base `7eb2a709`). Per CLAUDE.md the read-only
  status ran (`applicability: unrelated`, `action: start`) and nothing was started.

## Failures and lessons
- The first commit attempt carried `Co-Authored-By` and `Claude-Session` lines, which CLAUDE.md forbids. That commit was
  refused by the gate, so it never existed; no commit on the branch carries them (`git log 7eb2a709..HEAD --format=%B`).
- The first commit attempt was refused for the line ceiling. The fix was found after the change instead of before:
  `bin/merge-queue.mjs` sat exactly at its ceiling.

## Evidence
- The door test fails on main's code and passes on the branch. "a record whose head lies past the pull request covers it
  at its head and not merged: the door refuses it before a candidate, as the push does" (`bin/merge-queue.test.mjs`), run
  with only the test changed: ✖, the door printed "6c343e7 feat/g code: Codex 223c245..ad4b9d1 reviewed 2026-10-16" and
  "Candidate: main 223c245 ...". With the fix: ✔. "--land: a push of main the pre-push hook refuses says the hook's failing
  rows" failed on main's code ("could not push main: error: failed to push some refs to 'origin'.") and passes with the fix.
- That Git for Windows 2.54 hands a pre-push hook's stdout to the push's stdout was checked with a scratch probe: the
  hook's echoes came back on `stdout`, and stderr held only the hook's own stderr line and git's "error: failed to push
  some refs".
- `node --test bin/merge-queue.test.mjs`: 118 of 118 pass (before the module move). `node --test
  bin/lib/merge-queue-reviews.test.mjs`: 4 of 4 pass. The test of the verifier's finding fails without its fix (it listed
  "0bc522d merge-queue: the merge the push of main checks: the Codex review is off").
- The pre-commit gate passed on each commit: "PASS check 16 rows passed".
- The independent verifier confirmed the root cause and the fix, the stacked form included (the old door passed PR A of
  stack A→B with a record of main..B; the new door refuses it). It found no regression for `bin/notify.mjs`, and no ref,
  config or worktree left behind by `asMerged`, also with no identity, `user.useConfigOnly` and `commit.gpgSign`.

## Left
- The verifier's finding 2, for the lead: the door reads each pull request merged onto main alone, while the push reads
  the whole candidate. A sibling pull request that turns the Codex review on, or takes off a `-codex-review` mark, can
  still pass the door and fail the push. The old code had the same gap, and it is rare. Closing it means reading each
  pull request onto the candidate so far, which changes the door's loop. The comment of `asMerged` says so.
- A pull request that conflicts with main while GitHub says UNKNOWN is now logged with the reason `review`, not
  `conflict` (no `files`). Nothing reads that reason (the verifier's grep).
- Not run: a real pre-push hook end to end. The test feeds the push's output.

## Cost
- Time: the brief at 10:39Z; the ready notice at 12:16Z; context at 48% when it was sent.
- Reviews: Codex over `7eb2a70..3f3fc07`, 1 part, 87,790 input tokens, "the patch is correct" (0.83). The lenses risk,
  resilience, reliability and readability over the same range, 0 findings, about 88,000 input tokens. Over the fix
  `3f3fc07..9343b83`: the lenses reliability and readability, 0 findings, about 18,000 input tokens; Codex, 58,164 input
  tokens, "the patch is correct" (0.97).
- The independent verifier: one sub-agent, about 121,000 tokens.
- Gate runs: three pre-commit gates of the whole suite (one refused for the line ceiling) and one gate of documents.
  `bin/merge-queue.test.mjs` ran whole once, 25 minutes on a loaded machine.
