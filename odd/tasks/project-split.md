## State
A plan only, written by JH 302 on 2026-11-22 against origin/main e3dce5b3; no code is written. It carries out spec 3
of `odd/tasks/size-list-splits.md` (pull request 994), which left `bin/lib/project.mjs` for after Codex and wrote
its refutation as "not run yet": item 4 below runs it. Both documents stay (the lead, 2026-11-22): this one plans
`bin/lib/project.mjs`, and `size-list-splits.md` closes the other two files.
Owed: this plan's double review, until the Codex reset (2026-11-23 23:45); T1 does not start before it.
Next: on Codex day, after the double review and after pull requests 991, 993 and 994 land, T1 to T4 in order, each
in its own commit, then T5.
Open: nothing.

## Goal
`bin/lib/project.mjs` comes under the 1,000-line limit of `bin/conventions-structure.test.mjs` and leaves its
`CEILINGS`, with its behaviour, its stored formats and every importer unchanged.

## Why
- The size convention keeps a module small enough to read whole; at 1,975 lines this one, which writes and undoes
  a project's recorded files, is the hardest of the list to change safely.
- His order of 2026-11-22 (L1) asks for the large files split; the lead's orders ask for the smallest diff. Moving
  whole blocks behind the same names, re-exported, keeps every importer and test as it is.

## Done when
- `node --test bin/conventions-structure.test.mjs` exits 0 with `bin/lib/project.mjs` not in `CEILINGS`
- `node --test bin/lib/project.test.mjs bin/init.test.mjs bin/functions.test.mjs bin/uninstall-kinds.test.mjs` exits 0
- `node --test bin/lib/project-switches.test.mjs bin/lib/project-exclude.test.mjs bin/lib/project-migrate.test.mjs bin/lib/project-coverage.test.mjs bin/lib/template-block.test.mjs` exits 0
- `node --test bin/lib/rules-sources.test.mjs bin/install.test.mjs bin/update.test.mjs bin/migrate.test.mjs bin/check-functions.test.mjs` exits 0
- `js-harness rules check` exits 0
- `js-harness failures check` exits 0

## In scope / Out of scope
- In: `bin/lib/project.mjs`; four new modules beside it (`project-paths.mjs`, `project-uninstall.mjs`,
  `project-codegraph.mjs`, `project-location.mjs`); the `bin/lib/project.mjs` line of `CEILINGS`.
- Out: any change of behaviour, output, error text or stored shape; every importer (each name stays reachable from
  `bin/lib/project.mjs`); the template lines (`agentsBlock`, `claudeBlock`), which stay where they are (Constraints);
  the short-name fix of `isWithinBase` (`short-name-judged-outside`, in
  `docs/audits/2026-11-22-failures-a-check-could-hold.md`), which is behaviour; it is built after this split, in
  `project-paths.mjs`, where `isWithinBase` lands.

## Constraints
- The template lines stay in `bin/lib/project.mjs` — because the owner's rule `wording-is-the-need` names that file
  as its home (`bin/lib/rules-data.mjs:914-918`, `bin/lib/rules-coverage-data.mjs:78`); moving `claudeBlock` would
  move a rule's home, which is a rule change, not a split.
- Every exported name of `bin/lib/project.mjs` stays exported from it, by a re-export where it moved — because 38
  files import it (Depth pass, item 2), two of them by a dynamic `import()` (`bin/functions.mjs:106`,
  `bin/functions.test.mjs:195`).
- A new module imports `project-paths.mjs` and the modules `project.mjs` already imports, never `project.mjs` —
  because a cycle would load in an order nobody chose; item 4 shows none is needed.
- `MANIFEST_FORMAT`, the manifest's entries (`wrote`, `kept`, `dirs`) and every result shape stay byte for byte —
  because an older or newer copy reads the same manifest (`newerManifest`), and uninstall must undo exactly.
- High risk, item 1 of `AGENTS.md` (data: the code that writes and removes a project's recorded files): the risk lens
  runs on each slice, and an independent verifier runs last on the range that ends at the head that ships.
- No Codex run before 2026-11-23 23:45, no paid run (the lead's standing constraint); the build waits for Codex day.
- Each commit lowers the `bin/lib/project.mjs` line of `CEILINGS` (`bin/conventions-structure.test.mjs:74`) to the
  exact new count, which the test demands (`:109`), and the last commit removes it. Pull requests 991, 993 and 994
  edit the same list, so this lands after them, in that order.

## Ask me before
- Nothing expected. A name that cannot stay reachable from its old path, or a stored shape that would change, stops
  the task and goes to the lead.

## Depth pass
- 1. Method: extract module (Fowler, "Move Function"): move cohesive blocks whole, with their private helpers, behind
  the same exported names; the unchanged tests passing before and after is the standard. The smallest change that
  meets the limit is four blocks, each a commit.
- 2. Raw material:
  - `bin/lib/project.mjs`, 1,975 lines at e3dce5b3, 88 top-level declarations, no module-level `let`.
  - Importers: 38 files by `grep -rln` for `lib/project.mjs'` and `from './project.mjs'` over `bin`, `scripts` and
    `evals`, among them `bin/init.mjs`,
    `bin/install.mjs`, `bin/update.mjs`, `bin/onboard.mjs`, `bin/tui.mjs`, `bin/lib/project-migrate.mjs`,
    `bin/lib/rules-sources.mjs`. codegraph agrees on the callers it lists (`uninstallProject`: `bin/install.mjs`;
    `initProject`: `bin/init.mjs`; `syncProject`: `bin/install.mjs`, `bin/lib/project-migrate.mjs`;
    `projectLocation`: `bin/update.mjs`, `bin/tui.mjs`, `bin/onboard.mjs`); its index predates the running engine
    (v1.6.0 against v1.6.4), so the grep is the count.
  - By-path readers of the file: `bin/lib/rules-data.mjs:918` and `bin/lib/rules-coverage-data.mjs:78` (the rule
    above), `bin/conventions-structure.test.mjs:74` (the ceiling). No `Control:` line of `docs/FAILURES.md` names it
    as its file; the file does not name gentle-ai.
  - The dependency script, kept for Codex day at
    `side-session-notes/local_f536332a-81c1-489b-9669-68384563ffe9/jh302-project-deps.mjs` (the lead's group's notes
    folder): it lists each top-level declaration and, per block, the declarations of other blocks its code uses,
    comments and quoted strings left out.
- 3. The bar:
  spec 1: `wc -l bin/lib/project.mjs`: 1975 today, at most 1000 after
- 4. Refutation: the cheapest way the request could fail is a moved block that uses a name its file keeps, which
  would force a cycle. Run on 2026-11-22 at a8bf5f68 with the script above (sizes count each declaration with the
  comment above the next one, so they are estimates [e]):
  - paths: `MANIFEST_FORMAT`, `formatFor`, `gitTopLevel` to `excludeFile` (today `:42-366`), `SEMVER`,
    `codegraphDirPath`, `wrote`, `kept`, `keptRecord`, `shallowestMissingAncestor`, `mkdirTracked`, `isUnderRoot`,
    `notRemovedLabel`, `recordedHook`: 33 declarations, about 431 lines; uses no other declaration of the file.
  - uninstall: `resolveManifestEntryPath` to `restoreRecordedHook` (today `:1057-1495`) and `readRecorded`: 15
    declarations, about 458 lines; uses only paths' names.
  - codegraph: `codegraphFixCommand`, `runCodegraphInit`, `initCodegraph`: about 51 lines; uses only
    `codegraphDirPath`.
  - location: `functionsPlan`, `projectFiles`, `readPin`, `holdsFunctionsOnly`, `projectLocation`, `SWITCH_OF_KEY`,
    `jsonOr`, `clonePending`: about 163 lines; uses only paths' names.
  - What stays: about 873 lines [e] plus the import and re-export lines: init (`writeProject`, `initProject`,
    `alreadyInitialized`, `rollback`), sync (`syncProject`, `updateRecorded`, the template-block render) and the
    template lines. Init and sync use dozens of each other's names, so they stay together.
  Verdict: supports. The four blocks leave the file at about 900 lines [e] with no cycle: paths is a leaf, and the
  other three import only from it.
- 5. Request: move four blocks out of `bin/lib/project.mjs` into `project-paths.mjs`, `project-uninstall.mjs`,
  `project-codegraph.mjs` and `project-location.mjs`, paths first, each in its own commit that lowers the ceiling;
  every exported name re-exported from `bin/lib/project.mjs`; the template lines stay; no behaviour or stored shape
  changes.
  Adds: none

## Specs
1. `bin/lib/project.mjs` leaves the size list. His words, 2026-11-22 (transcript 0cdab702, line 13740, checked with
   `js-harness sessions --quote`): "divide los archivos grandes y archiva las sesiones terminadas". The lead,
   2026-11-22 18:40, quoted in `odd/tasks/size-list-splits.md`: "The three that move 600-975 lines (profiles-data,
   isolation-probe, project) are large work: each only after a short feature document with its contract and depth
   pass, committed first".

## Tasks
- [ ] T1 (kind: build) spec 1: `project-paths.mjs`, the paths block and the record helpers; `CEILINGS` lowered;
  route: writer sub-agent or inline, risk lens; commit: refactor(project): move paths and record helpers out
- [ ] T2 (kind: build) spec 1: `project-uninstall.mjs`, the uninstall block and `readRecorded`; `CEILINGS` lowered;
  route: as T1; commit: refactor(project): move uninstall out
- [ ] T3 (kind: build) spec 1: `project-codegraph.mjs`; `CEILINGS` lowered; route: inline; commit:
  refactor(project): move the codegraph init out
- [ ] T4 (kind: build) spec 1: `project-location.mjs`; `bin/lib/project.mjs` leaves `CEILINGS`; route: inline;
  commit: refactor(project): move project location out
- [ ] T5 (kind: verify) spec 1: Done when, Codex on the range, the independent verifier on the range ending at the
  head; route: Codex and a verifier sub-agent; commit: none

## Log
- L1 His words, 2026-11-22, transcript 0cdab702 line 13740 (checked with `js-harness sessions --quote`): "divide los
  archivos grandes y archiva las sesiones terminadas".
- L2 2026-11-22, the lead's brief to JH 302 (brief-302-controls-and-split.md, item 3): the split of
  `bin/lib/project.mjs` as a plan only, with its contract and depth pass (callers from codegraph, the seams, the
  `CEILINGS` line, the order after 991, 993 and 994), so it runs on Codex day.
- L3 2026-11-22, JH 302: the template lines cannot move: the rule `wording-is-the-need` has its home in this file
  (`bin/lib/rules-data.mjs:914-918`). Four other blocks reach the limit instead (item 4).
