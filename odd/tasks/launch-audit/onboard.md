Stage 4, area onboard: 5 files read (bin/onboard.mjs, bin/lib/onboard.mjs, README.md, docs/SPEC.md, bin/js-harness.mjs); 5 of the 42 inventory rows of areas backup, clean, onboard, report and stack.
Sha read: fb9108c06a4370ca5cb17c48b23e6cd6f0937f2e (HEAD f45e78c2 differs from it only in odd/tasks/launch-audit.md).

- C-onboard-1. open. contradiction. The dispatcher and onboard's own comment give different reasons for exit 1, and a profile error exits 2, which both reserve for a usage error. Evidence: bin/js-harness.mjs:13 "1 when check finds something, the file exists or the project has a plan of its own"; bin/onboard.mjs:393 "a template's file exists or this is no initialized project"; bin/onboard.mjs:385-387 prints `result.error` and returns 2. Fix: one exit list, in the dispatcher and the comment, and exit 1 for a profile error that is not a usage error. Refuter: confirmed.
- C-onboard-2. open. style. Two JSDoc blocks are stacked, so the `hashes` comment sits above `withoutSection` and misnames it. Evidence: bin/lib/onboard.mjs:267-270 "The hashes an approval records (D2)" directly above "`markdown` without its `## <title>` section". Fix: move the first block to `hashes`. Refuter: confirmed.
- C-onboard-3. carried (M4). dead. Six onboard exports are imported only by tests: lib/onboard.mjs:16 ROADMAP_LINE, :19 TOPICS, :33 LEVEL_TOPIC, :40 SUMMARY_LINE, :248 shortHash, :803 currentStage. Each is also used inside the module, so the export is a test seam. Evidence: `node scripts/audit-exports.mjs` "test-only-export  bin/lib/onboard.mjs:803  currentStage: imported only by test files". Fix: keep (lead's triage). Refuter: confirmed.

## Counts
After the refuter (refute-small.md): 3 confirmed, 0 amended, 0 refuted and removed here (their verdicts stay in refute-small.md).
- contradiction: 1 (C-onboard-1)
- style: 1 (C-onboard-2)
- dead: 1 (C-onboard-3, a test seam to keep)
- bug, contract, duplicate, useless, stack-conflict, test-gap, risk: 0

## Not read
- bin/onboard.test.mjs, bin/lib/onboard.test.mjs and bin/lib/onboard.testkit.mjs were listed, not read in full.
- bin/lib/profiles.mjs, used by `onboard profile`, is outside this file set.
- `onboard profile <kind>` runs `projectRoot` first (bin/onboard.mjs:401), so it needs an initialized project; README does not say otherwise, so it is noted here, not filed.
