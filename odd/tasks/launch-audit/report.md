Stage 4, area report: 5 files read (bin/report.mjs, bin/lib/report.mjs, README.md, docs/SPEC.md, bin/js-harness.mjs); 4 of the 42 inventory rows of areas backup, clean, onboard, report and stack.
Sha read: fb9108c06a4370ca5cb17c48b23e6cd6f0937f2e (HEAD f45e78c2 differs from it only in odd/tasks/launch-audit.md).

- C-report-1. open. contradiction. README says the report after a `--mark` starts at the recorded time, but for merges it starts at the recorded head commit, as README says twenty lines earlier and the code does. Evidence: README.md:683-684 "the next report starts at that time"; README.md:654-656 "the next report lists the merges that branch gained since that commit"; bin/report.mjs:64-68. Fix: say "at that time, and at that commit for merges" in README.md:684. Refuter: confirmed.
- C-report-2. open. style. Two JSDoc blocks are stacked on one function; the first is the stale one. Evidence: bin/report.mjs:59 "What landed on `ref` after `cut`, or `{ error }`." above :60 "What landed on `ref` after the cut, or `{ error }`. After a recorded report". Fix: delete line 59. Refuter: confirmed.

Otherwise `report` matches README.md:642-685 and docs/SPEC.md:216-223: the three cuts, the first line naming which, the exit 1 with nothing recorded when a source cannot be read.

## Counts
After the refuter (refute-small.md): 2 confirmed, 0 amended, 0 refuted and removed here (their verdicts stay in refute-small.md).
- contradiction: 1 (C-report-1)
- style: 1 (C-report-2)
- bug, contract, dead, duplicate, useless, stack-conflict, test-gap, risk: 0
- M4 and M9 carry no row in this area (`node scripts/audit-exports.mjs` and `node scripts/audit-flags.mjs` list nothing under bin/report.mjs or bin/lib/report.mjs).

## Not read
- bin/report.test.mjs and bin/lib/report.test.mjs were listed, not read in full.
- bin/lib/channel.mjs, the source of the questions and notices, is outside this file set.
