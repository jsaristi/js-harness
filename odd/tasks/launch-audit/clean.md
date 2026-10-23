Stage 4, area clean: 5 files read (bin/clean.mjs, bin/lib/clean.mjs, README.md, docs/SPEC.md, bin/js-harness.mjs); 6 of the 42 inventory rows of areas backup, clean, onboard, report and stack.
Sha read: fb9108c06a4370ca5cb17c48b23e6cd6f0937f2e (HEAD f45e78c2 differs from it only in odd/tasks/launch-audit.md).

- C-clean-1. open. contract. Plain `clean` and `clean --json` write `~/.js-harness/clean.json` and create `~/.js-harness` when it is absent, while help and README say only `--measure` writes the sizes; `--measure` itself writes only when the home exists. Evidence: bin/clean.mjs:150 "writeMeasure(args.home, kinds, now());" against :142 "{ onlyIfHome: true }"; bin/clean.mjs:18 "--measure writes the sizes for the clean row of doctor"; bin/clean.test.mjs:43 asserts "the list is also a measure". Fix: say in help and README that the listing also records the measure, and pass `onlyIfHome` on the listing path too. Refuter: confirmed.
- C-clean-2. open. contract. `--json` is accepted with `--apply` or `--measure` and silently ignored, where the other flag combinations are refused. Evidence: bin/clean.mjs:29 lists `--json` as a bare flag; bin/clean.mjs:48 refuses only "--apply, --measure and --log go one at a time". Fix: refuse `--json` with `--apply` or `--measure`, or say it is ignored. Refuter: confirmed.
- C-clean-3. carried (M4). dead. Six clean exports are imported only by tests: lib/clean.mjs:17 CLEAN_EVERY_DAYS, :18 CLEAN_THRESHOLD_BYTES, :289 refusal, :435 readMeasure, :446 measureDue, :468 startMeasure. Each is also used inside the module, so the export is a test seam. Evidence: `node scripts/audit-exports.mjs` "test-only-export  bin/lib/clean.mjs:289  refusal: imported only by test files". Fix: keep (lead's triage). Refuter: confirmed.

The deletion side matches its promise: the guard paths, `refusal`, `cacheRefusal`, the rename before the remove and the log line per deletion agree with README.md:1666-1669 and docs/SPEC.md:606, and nothing outside the scanned kinds is removed.

## Counts
After the refuter (refute-small.md): 3 confirmed, 0 amended, 0 refuted and removed here (their verdicts stay in refute-small.md).
- contract: 2 (C-clean-1, 2)
- dead: 1 (C-clean-3, a test seam to keep)
- bug, duplicate, contradiction, useless, stack-conflict, test-gap, risk, style: 0

## Not read
- bin/clean.test.mjs and bin/lib/clean.test.mjs were listed and grepped, not read in full.
- No `clean --apply` was run on this machine: it deletes the owner's caches.
