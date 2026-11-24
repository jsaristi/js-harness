# The three large files of the size list

Locator: `odd/tasks/size-list-splits.md` · Branch: `claude/jh299-big-splits`, cut from `origin/main` (the four small splits are draft PR 993), in the worktree `D:\js-harness\.claude\worktrees\priceless-dubinsky-34d74e` ·
Session: `JH 299 · one-line cards, owed checks, legacy list`, a work session; the lead is `JH ORQ · orquestador F8` ·
Runner: `node --test` · Delivery: draft PR

## State
2026-11-22, JH 299. The four small files of the size list are split in draft PR 993. This document opens the three
large ones, which the lead calls large work: each moves 600 to 975 lines. T1 (profiles-data, 906 lines) and T2
(isolation-probe, 971 lines) are done, each in two commits (L4). Lenses ran with 0 findings; the Codex skip is recorded. Next: Codex after 2026-11-23 23:45, then land after 991 and 993.
T3 (project) is left for after Codex, in its own PR (the lead, 20:05). Open: nothing. A conflict of
the `CEILINGS` lines with PRs 991 and 993 is resolved at land, after Codex, in the order 991, 993, this one (the lead, 20:20).

## Goal
`bin/lib/profiles-data.mjs`, `evals/isolation-probe.mjs` and `bin/lib/project.mjs` each come under the 1,000-line
limit of `bin/conventions-structure.test.mjs` and leave its `CEILINGS`, with their behaviour and every importer unchanged.

## Why
- The size convention keeps a module small enough to read whole. The ceiling only stops growth, so these three
  files stay hard to change until something moves out of them.
- The lead's orders of 2026-11-22 (L1, L2) ask for the smallest diff. New modules go beside the file, behaviour
  stays the same, the existing tests stay green, and the file leaves its list in the same commit.

## Done when
- `node --test bin/conventions-structure.test.mjs` exits 0 with none of the three files in `CEILINGS`
- `node --test bin/lib/profiles-data.test.mjs bin/lib/profiles.test.mjs bin/onboard.test.mjs` exits 0
- `node --test evals/isolation-probe.test.mjs evals/codex-isolation-probe.test.mjs` exits 0
- `node --test bin/lib/project.test.mjs bin/init.test.mjs` exits 0
- `node --test bin/lib/gentle-ai-absence.test.mjs bin/lib/rules-switch.test.mjs` exits 0
- `js-harness rules check` exits 0
- `js-harness failures check` exits 0
- `js-harness failures check` still counts 28 entries not settled, as before the splits

## In scope / Out of scope
- In: the three files, one or two new modules beside each, their three `CEILINGS` lines, and an importer's import
  line only where a re-export cannot serve.
- Out: any change of behaviour, output or data shape. Out too: a file an open PR edits (checked with
  `gh pr list --state open --json files` before each task), and `bin/pre-push-hook.test.mjs` (PR 950).
  `PROBE_MODEL` and the two gentle-ai lines stay in `evals/isolation-probe.mjs`, because `rules-switch.mjs` reads
  the model by path and `gentle-ai-absence.test.mjs` lets only that file name gentle-ai. The templates stay
  reachable through `bin/lib/project.mjs`, because `rules-sources.mjs` imports them from there.

## Constraints
- No paid run: only unit tests, no eval or probe run. That is the orchestrator's standing constraint until
  2026-11-23 23:45.
- No Codex run before 2026-11-23 23:45; its skip is recorded with `--unavailable`. Same constraint.
- Every moved name stays reachable from its old path through a re-export, so the importers change nothing. That
  keeps the diff small and the open PRs that import these files clean.
- A new module never imports a command, and never forms an import cycle with the file it left. That is the structure
  convention, and a cycle would load in an order nobody chose.
- Before each commit, the moved and changed modules are read for imports that only a comment names
  (`unused.mjs` in the session's scratchpad). The four small splits carried six such imports through review once.
- T3 touches the code that writes and removes a project's recorded files (the manifest, uninstall), which is high
  risk (data). It gets the risk lens and an independent verifier.

## Ask me before
- Nothing expected. A split that cannot keep a name at its old path, or that would change a stored format, stops and
  goes to the lead.

## Depth pass
- 1. Method: extract a module (Fowler, "Move Function"). Move a cohesive block whole, with its private helpers,
  behind the same exported names. The standard is that the tests, unchanged, pass before and after. The smallest
  change is one block per file where one is enough.
- 2. Raw material: the size list, `bin/conventions-structure.test.mjs:69-90`.
  - `bin/lib/profiles-data.mjs:13-708` is `AREAS`: data that uses no other name of the file.
  - `evals/isolation-probe.mjs` has sections at `:358` (hashing, scanning and diffing real trees), `:746` (the trees
    that must not change, which names gentle-ai at `:763`), `:777` (looking inside the sandbox) and `:1477` (the
    summary and the command line).
  - The path readers, found with `grep -rn` of each path: `bin/lib/rules-switch.mjs:287` (`PROBE_MODEL`),
    `bin/lib/gentle-ai-absence.test.mjs:90`, and the header of `bin/lib/profiles-data.mjs:2`, which says the file
    "imports nothing".
- 3. The bar:
  spec 1: `wc -l bin/lib/profiles-data.mjs`: 1598 today, ≤ 1000 after
  spec 2: `wc -l evals/isolation-probe.mjs`: 1681 today, ≤ 1000 after
  spec 3: `wc -l bin/lib/project.mjs`: 1975 today, ≤ 1000 after
- 4. Refutation: the cheapest way each request could fail is a block that uses a name its file keeps, which would
  force a cycle. The checks, run 2026-11-22 with `deps.mjs` on each line range:
  - spec 1: `AREAS` uses no name of the rest. `AGREED` appears 0 times in `:16-708` and 38 times after it.
  - spec 2: `:358-776` uses `isObject`, `fold`, `normalize` and `exists` of the rest. `:777-982` uses `fold`,
    `parseEnvLines`, `relOf`, `scanFile` and `ENGRAM_PARTS`. Those small helpers move with the blocks that use them
    and are imported back, so there is still no cycle. `:1477-1642` also holds `USAGE`, `parseArgs` and `main`,
    which stay; only `formatSummary` and its helpers can move. The file has no module-level `let`.
  - spec 3: not run yet. T3's own refutation is written here and committed before T3's code.
  Verdict: supports (specs 1 and 2); spec 3 open until T3's pass.
- 5. Request: move one or two cohesive blocks out of each of the three files into modules beside them. Each moved
  name is re-exported from its old path, with no cycle and no change of behaviour. Each file leaves `CEILINGS` in
  its own commit.
  Adds: none

## Specs
1. `bin/lib/profiles-data.mjs` leaves the size list. The lead, 2026-11-22 18:40: "The three that move 600-975 lines
   (profiles-data, isolation-probe, project) are large work: each only after a short feature document with its
   contract and depth pass, committed first".
2. `evals/isolation-probe.mjs` leaves the size list. Same order.
3. `bin/lib/project.mjs` leaves the size list. Same order.

## Tasks
- [x] T1 (kind: build) (spec 1) `AREAS` of `bin/lib/profiles-data.mjs` into `bin/lib/profiles-areas-data.mjs`,
  re-exported; the header's "imports nothing" is corrected. Route: inline. Commit: 398a99fa and b2308099 (L4).
- [x] T2 (kind: build) (spec 2) the tree hashing and scanning and the sandbox inspection of `evals/isolation-probe.mjs`
  into a module beside it, with the helpers they share, re-exported. `PROBE_MODEL` and the gentle-ai lines stay.
  Route: inline. Commit: 0a4281da and 69cc304c (L4).
- [ ] T3 (kind: build) (spec 3) after Codex (2026-11-23 23:45), in its own PR, by the lead's order of 20:05: blocks of `bin/lib/project.mjs` totalling at least 975 lines into modules beside it,
  re-exported, after its depth pass is written here. It gets the risk lens and an independent verifier. Route:
  inline. Commit: one.

## Log
- L1. 2026-11-22 18:10, his words, through the lead: "listo continua y sigas abriendo mas horas pero lo que me
  preocupa que quedan muchas sesiones abiertas" (`js-harness sessions --quote 0cdab702 13663`, 2026-11-22T23:09:47Z).
  The lead's order that followed: "take the conventions size-list splits you found (the ~12 big files no open PR
  touches): one file per branch from origin/main, one draft PR each, smallest diff (new modules beside the file,
  behaviour unchanged, the existing tests green, the file leaves its list in the same commit), lenses on each, Codex
  skip recorded."
- L2. 2026-11-22 18:40, the lead: "put the splits on one branch cut from PR 991's head, one commit per file, one draft
  PR stacked on 991, so the CEILINGS lines never conflict pairwise". The four small ones come first. The three large
  ones wait for this document.
- L3. 2026-11-22, the four small splits are draft PR 993: fefc70ef, ec12d906, 1ce7908d and babc7ffd. The lenses over
  e59ae1b..babc7ff found 0 reliability and 0 risk issues, and 3 readability ones. Two were leftover imports, removed
  in 2fc80d18. The third asks why `bin/resume.mjs` (1111) stays: PR 968 edits it. The tests, each run once:
  codex-isolation-probe 37; suite, configs and long-session 212; practice, release-gate, release-proof and pre-push 198;
  remote, lib/remote, tui, doctor and stack 495.
- L4. 2026-11-22, T1 and T2. The gate refused T1 as one commit: `commit-size` counted 1,399 changed lines against the
  1,200 of `rule:reviewed-commit-lines`, because a move counts both its sides. Each task is therefore two commits. The
  first adds the new module, which nothing imports yet. The second removes the block and re-exports it.
  - T1: 398a99fa and b2308099. profiles-data goes from 1598 to 906 lines.
  - T2: 0a4281da and 69cc304c. isolation-probe goes from 1681 to 971 lines. The moved code is in
    `evals/isolation-probe-trees.mjs` (622) and `evals/isolation-probe-summary.mjs` (108). The probe's export list
    was compared by importing both versions: 28 names before, 28 after.
  - A flaw of the session's use scanner, found by the test run: its lookbehind `(?<![\w.])` read a spread
    `...inspectEnv` as a property access, so `inspectEnv` and `leakHits` were not imported back at first. Fixed
    before the commit. PR 993's four splits were scanned again with the corrected pattern and leave nothing out.
  - Tests: probe, codex probe, gentle-ai-absence, rules-switch and conventions 209 of 209. `rules check` passes.
    `failures check` counts 28 not settled.
  - Reviews of 1d690bd..69cc304: readability and reliability lenses, 0 findings each, about 76k input tokens each.
    The Codex skip is recorded with `--unavailable`, for the standing constraint until 2026-11-23 23:45.
