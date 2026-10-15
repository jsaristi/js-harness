`js-harness merge-ready` is retired: no pull request has a GitHub run of its own to decide on.
Branch: feat/retire-merge-ready. Delivery: single-pr, as a draft, held with ci/drop-github-gate (PR 205). Tests: `node --test`.

## Goal
The command that decided whether a pull request could merge on its own GitHub run is gone, and what the merge
queue still uses of it, the checks of the pull request itself, lives in a module named for what it does.

## Why
PR 205 drops the GitHub Actions run of each pull request: the merge queue's CircleCI run of the candidate is
the only CI run. `merge-ready` reads that run (its conclusion, the base its checkout tested) and would answer
"run missing" for every pull request, forever. The queue already decides ready without it (merge-queue.md S4).

## Done when
- `node --test bin/lib/pull-request.test.mjs bin/merge-queue.test.mjs` exits 0
- `node --test --test-name-pattern="merge-ready is retired" bin/js-harness.test.mjs` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: bin/merge-ready.mjs, bin/merge-ready.test.mjs, bin/lib/merge-ready.mjs, bin/lib/merge-ready.test.mjs (removed); bin/lib/pull-request.mjs and its test (new); bin/merge-queue.mjs (its import); bin/js-harness.mjs (help and command table); README.md; this document.
- Out: odd/tasks documents that name merge-ready in their history, which record what was true then; bin/lib/manifest.mjs, whose rule on CI is shipped to installed projects.

## Constraints
- It lands only with PR 205 or after it — because while gate.yml exists, `merge-ready` still answers truly.
- The queue's ready stays exactly what it was — because S4 of merge-queue.md is its contract.

## Ask me before
- Marking the pull request ready: removing a command is a contract change, held with PR 205 for Sebastián (the lead asks him).

## Specs
- S1. The lead's order (channel note from "JH ORQ · js-harness (350k)" to JH 21, 2026-10-15 07:38): "GO on both follow-ups, each its own branch and draft PR: (1) the codex-configs flaky fix, test first; (2) js-harness merge-ready without a GitHub run (retire or rewrite; a CLI contract change, so draft and held with A). The queue is not blocked: it landed 185 with a red own run, so pullRequestProblems reads no run."
- S2. Retired, not rewritten (L2): `js-harness merge-ready` is no longer a command: `--help` does not name it and `js-harness merge-ready <pr>` exits 2 as an unknown command.
- S3. `pullRequestProblems` moves to bin/lib/pull-request.mjs with the same sentences in the same order (open, draft, mergeable, main, gentle-ai line); its `conflicts` advice, passed only by merge-ready, goes with the command.
- S4. README: the merge-ready section goes; the merge-queue section says what ready is in its own words.

## Tasks
- [x] T1 (S2, S3, S4, kind: build): retire the command, move the checks, update help and README. Route: inline. RED: "merge-ready is retired..." (`--help` still named it) and bin/lib/pull-request.test.mjs (module missing); GREEN: 1 of 1 and 2 of 2; bin/merge-queue.test.mjs 18 of 18.

## Log
- L1. 2026-10-15 07:38, the lead's order, quoted in S1.
- L2. 2026-10-15, retire rather than rewrite: a rewrite would answer "is this pull request ready for the queue", which `merge-queue --dry-run` already answers for every open pull request, naming each one it leaves out and why. No script outside the repository calls it: `rg -l "merge-ready"` over ~/.js-harness, ~/.claude/skills and ~/.claude/hooks finds only records (the channel, the relief file, the gate log, a research note), no caller. The conflict advice (merge-review.md S7) was reachable only through `merge-ready`, which passed `conflicts`; the queue calls `pullRequestProblems(pr)` alone, so the advice is dead code once the command goes.
- L3. 2026-10-15, 067ec01 holds T1, gate green. gentle-ai assessed it medium (under budget); raised to high with `--escalate-item 3` (a removed command is a contract change), reviewed with lenses risk, readability and reliability (lineage review-23d6570bb1ba16ae): approved with no finding, acknowledged. Codex reviewed 882ce3f..067ec01 in 2 parts: "the patch is correct" (0.98, 0.99), no findings, 147,896 input tokens, recorded. Next: push and a draft pull request, held with PR 205.
