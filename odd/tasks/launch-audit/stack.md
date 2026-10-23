Stage 4, area stack: 8 files read (bin/stack.mjs, bin/lib/stack.mjs, bin/lib/stack-install.mjs, bin/lib/stack-run.mjs, bin/lib/stack-update.mjs, README.md, docs/SPEC.md, bin/js-harness.mjs); 11 of the 42 inventory rows of areas backup, clean, onboard, report and stack.
Sha read: fb9108c06a4370ca5cb17c48b23e6cd6f0937f2e (HEAD f45e78c2 differs from it only in odd/tasks/launch-audit.md).

- C-stack-1. open. contradiction. Doctor's fixes for codegraph and codex hardcode `npm i -g`, while `stack install` resolves the package manager because the word `npm` may run pnpm; `planStack` reuses doctor's fix text for its manual rows, so the install plan can print the command its own rule forbids. Evidence: bin/lib/stack.mjs:365 "installed: 'npm i -g @colbymchenry/codegraph'" and :423 "installed: 'npm i -g @openai/codex'"; bin/stack.mjs:59 "Never read from the word `npm` on the path, which may run pnpm"; bin/lib/stack-install.mjs:80 `fixesOf` and :116 `steps: fixesOf(r, others)`. Fix: build those fix lines from the resolved package manager (`resolveStackPm`). Refuter, amended: The planStack half is false: codex's and codegraph's `installed` is only ok, missing or unknown (probeVersionCommand, bin/lib/stack.mjs:66-70), `missing` goes to `mandatory` through packageWords with the resolved pm (bin/lib/stack-install.mjs:98-104), and the manual rows take only non-missing gaps (:111-113), so `fixesOf` never yields an `npm i -g` line; what survives is doctor's own fix text (bin/lib/stack.mjs:365, 369, 423, 425) telling a pnpm-installed machine to `npm i -g`, so the evidence and fix should name doctor's rows only.
- C-stack-2. open. style. The header of lib/stack.mjs describes three checks and pending work of task T2, while `checks` holds six. Evidence: bin/lib/stack.mjs:1-2 "probes for three of their four states" and "`outdated` is T2's job"; bin/lib/stack.mjs:645-689 (six checks, adding memory-rules, session-classes and pnpm-lock). Fix: rewrite the header to name the current checks. Refuter, amended: The header is stale, but not as stated: "three of their four states" means installed/configured states, not checks, and it is stale because T2 shipped the `outdated` state (odd/tasks/stack-doctor.md:81 "[x] T2", upToDateFix at bin/lib/stack.mjs:301, 341) while the header still calls it "T2's job"; `checks` (:645) holds six doctor rows (memory-rules, session-classes, claude-account, remote-server, hook-commands, pnpm-lock), which the header never described.
- C-stack-3. carried (M4). dead. Six stack exports are imported only by tests: stack-install.mjs:50 packageWords; stack-run.mjs:15 realSpawn, :43 refusedWord; stack.mjs:552 hookCommandPlan, :645 checks, :705 probeTool. Each is also used inside its module, so the export is a test seam. Evidence: `node scripts/audit-exports.mjs` "test-only-export  bin/lib/stack.mjs:645  checks: imported only by test files". Fix: keep (lead's triage). Refuter: confirmed.

Otherwise bin/stack.mjs, stack-install.mjs, stack-run.mjs and stack-update.mjs match README.md:564-605 and docs/SPEC.md:189-205: the plan from probe rows, the records in the machine manifest and their undo.

## Counts
After the refuter (refute-small.md): 1 confirmed, 2 amended, 0 refuted and removed here (their verdicts stay in refute-small.md).
- contradiction: 1 (C-stack-1)
- style: 1 (C-stack-2)
- dead: 1 (C-stack-3, a test seam to keep)
- bug, contract, duplicate, useless, stack-conflict, test-gap, risk: 0
- M9 carries no row in this area (`node scripts/audit-flags.mjs` lists no stack flag as unprobed).

## Not read
- bin/stack.test.mjs and bin/lib/stack*.test.mjs were listed, not read in full.
- No `stack install` was run: it installs global packages on this machine.
- bin/lib/manifest.mjs (the records) and bin/lib/args.mjs are outside this file set.
