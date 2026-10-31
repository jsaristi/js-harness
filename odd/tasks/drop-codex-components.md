# Drop the Codex install components

Locator: `odd/tasks/drop-codex-components.md` · Engram mirror: `odd/drop-codex-components/tasks` · Branch:
`worktree-drop-codex-components` · Session: JH 117 · Delivery: one pull request. Test runner: `node --test`.

## Goal
`install` writes nothing under `~/.codex` any more, and a machine that an earlier version installed loses those
Codex skills and hook entries on its next `install`/`sync` or `uninstall`, with Codex still the reviewer.

## Why
The harness is for Claude Desktop's Code tab only, with Codex as reviewer (his line 33574; `AGENTS.md`'s first line).
`install` still writes Codex's own skills and hooks under `~/.codex` as if Codex were a place to work. Step 6 of the
plan in `docs/proposals/claude-app-native-sessions.md` section 12; his decision D4, question 136.

## Done when
- `node --test bin/install.test.mjs bin/lib/manifest.test.mjs scripts/practice-lib.test.mjs` exits 0
- `npm run check` exits 0
- A scratch-home `install` then `uninstall` of this branch leaves nothing under `.codex/skills` and no
  `.codex/hooks.json` holding a js-harness hook; the same after an install by the released 0.97.0 followed by this
  branch's `install` (the earlier copies are pruned). Commands and output in `## Log`.
- The change is on main through a pull request that passed Codex and the Claude lenses, and an independent verifier.
- The apply question (his real `~/.codex`) is recorded with the lead: `js-harness notify --to orchestrator --kind question`.

## In scope / Out of scope
- In: `bin/lib/manifest.mjs` (components, entry components, skill text), `bin/install.mjs` (help, report),
  `bin/doctor.mjs` rows of the Codex install, `scripts/practice-lib.mjs` `HARNESS_HOOKS`, their tests, README,
  `docs/SPEC.md`, `docs/ROADMAP.md`, the proposal's step 6 line.
- Out: `codex-review` and the lean Codex home it builds; the evals' Codex arm; anything under `~/.codex` the harness
  did not install; the Codex trust code that undoes earlier installs' trust (it stays, so a prune or an uninstall of
  an earlier copy still takes its trust out). Applying it to his machine: the lead's question.

## Constraints
- An earlier install's Codex files and entries are removed only while they are what was recorded — because a file
  he changed is his (the `sync`/`uninstall` rule already in `bin/lib/manifest.mjs`).
- Never touch `~/.claude`, `~/.codex`, credentials or gentle-ai config; every proof runs in a scratch home.

## Ask me before
Nothing left in this session: the product choice was D4. Applying it to his machine is the lead's question.

## Specs
- S1. His answer to question 136 (2026-10-31T03:10:02Z, line 39049, tapped): "Sí, sácalos (Recomendada)". The
  question it answers: "Un sí abre una sesión que saca esos componentes de install, hace que uninstall quite las
  copias ya instaladas, y lo prueba en un home de prueba: nada queda bajo .codex/skills. No toca la revisión con
  Codex (codex-review sigue igual) ni tu configuración de Codex fuera de lo que el arnés instaló."
- S2. His line 33574, as `AGENTS.md` carries it: the harness sets up Claude Desktop's Code tab, with Codex as its
  reviewer.

## Tasks
- [x] T1 (S1) build: tests first — a fresh install writes nothing under `.codex`; an earlier install's Codex files
  and entries go on `sync` and on `uninstall`. Route: inline. Commit: the slice's one commit (below).
- [x] T2 (S1) build: drop the Codex components from `components` and `entryComponents`; amend doctor, practice-lib,
  install's help and every other reader the search found. Route: inline for `bin/`, a writer sub-agent for
  `scripts/` (disjoint surface, launched beside it). Commit: the slice's one commit.
- [x] T3 (S1, S2) docs: skill text, README, SPEC, ROADMAP, the proposal's step 6. Route: inline. Commit: the same.
- [ ] T4 verify: scratch-home proof (fresh, and over 0.97.0), Codex review, lens review, independent verifier.
- [ ] T5 the apply question to the lead, with the PowerShell commands and their undo, tried in a scratch home.

## Next step (state at the context pause, 2026-10-31)
- The slice is staged, NOT committed: `git commit -F <msg>` ran the pre-commit gate (CI run 41165248260), which
  failed on three rows (`gh run view 41165248260 --log-failed`):
  1. `bin/conventions-structure.test.mjs`: `scripts/practice-lib.mjs` grew to 1182 lines over its ceiling 1174 (the
     writer's change: move code out of it), and `bin/lib/manifest.mjs` is down to 1752: lower its ceiling there
     from 1793 to 1752.
  2. `bin/rules-coverage.test.mjs`: "skill: 1 owed span edited in place" (manifest.mjs skill line 63, reworded):
     `node bin/js-harness.mjs rules coverage --refresh`, then stage what it writes.
  3. `budget` 1501 estimated tokens (budget 1500) in CI, while `checkBudget('.')` reads 972 locally and AGENTS.md
     equals origin/main's: read why in the CI log before running anything again.
  Fixed [checked, each file alone]: 1, three comments of `scripts/practice-lib.mjs` shortened to 1174 lines and the
  manifest ceiling lowered (`bin/conventions-structure.test.mjs` 7/0); 2, `rules coverage --refresh` wrote
  `bin/lib/rules-coverage-data.mjs` (`bin/rules-coverage.test.mjs` 8/0); 3 was no failure: the real row reads
  `PASS budget 972`, and the `FAIL budget 1501` line is a test's own output over a fixture AGENTS.md.
- Then: commit (message in the job tmp `msg1.txt`; no AI attribution, CLAUDE.md), push, PR, `js-harness codex-review
  --base 7aac3e43`, `js-harness lens-review --base 7aac3e43 --lenses <pertinent> --reason <why>`, an independent
  verifier (installer, high risk 5), `notify --kind ready --pr <n>`; then T5, the summary under docs/sessions/, and
  `notify --kind closed --summary <file>`.

## Log
- L1 (2026-10-31, the lead's brief for JH 117, as written): "JH 117 · install: drop the Codex components, Codex stays
  the reviewer. … `install` still writes Codex's own skills and hooks under ~/.codex as if Codex were a place to work.
  Step 6 of the plan in `docs/proposals/claude-app-native-sessions.md` section 12 says what to change: the Codex
  components out of `install`, `uninstall` removes earlier copies, `HARNESS_HOOKS` in `scripts/practice-lib.mjs:351`
  and `bin/lib/manifest.test.mjs` updated. Proof: a scratch-home install and uninstall leaves nothing under
  `.codex/skills` and a `.codex/hooks.json` without the harness's hooks. What it does not touch: `codex-review` and
  the lean Codex home it builds, and anything under ~/.codex the harness did not install."
- L2 (2026-10-31) Found [checked: `bin/install.mjs:345,500`, `bin/lib/manifest.mjs:1129-1177`]: both `install` and
  `sync` commands call `sync`, which already prunes a file or entry whose component is no longer declared, while its
  bytes are the recorded ones, and moves the Codex trust of the pruned hooks (`planTrustMoves`). `uninstall` removes
  whatever the manifest records, declared or not (`uninstallInstalled`). So "uninstall removes earlier copies" needs
  no new removal code: it needs tests that hold it and the trust code kept.
- L3 (2026-10-31) What was searched [an Explore sub-agent over codegraph and grep for `\.codex`, the eight ids,
  `hooks.json`, `'codex'`, `hosts:`, `codexHome`, `CODEX_HOME`; its map checked by me where it is acted on]:
  - Changes: `bin/lib/manifest.mjs` (eight declarations, skill line 63); `bin/lib/stack.mjs` doctor row
    `codex-trust` (only reads entries install wrote; always `n/a` now) and its tests in `bin/doctor.test.mjs`,
    `bin/lib/stack.test.mjs`, `bin/clean-home.test.mjs`; `bin/install.mjs` `codexConfigOf` (fed only new Codex
    entries: a pruned entry carries its own `trustConfigs`); `bin/codex-hook-trust.test.mjs` (setup re-seeded on an
    earlier install, doctor cases go with the row); `bin/install.test.mjs:539`; `bin/lib/project-rules.test.mjs:210`;
    `scripts/practice-lib.mjs` `HARNESS_HOOKS` hosts and `HOSTS`, `scripts/practice.mjs`, `scripts/e2e.mjs:155-165`,
    `scripts/release-proof.mjs` `check-from` (an install by 0.97.0 or older still holds Codex entries); README,
    `docs/SPEC.md`, `docs/ROADMAP.md:50`, `bin/lib/hook-entries.mjs` comments.
  - Stays: `bin/lib/codex-trust.mjs` (sync's and uninstall's trust moves for earlier entries), `logTrust` in
    `bin/install.mjs`, `codex-review` and its home, the `codex-daemon` and MCP rows, `evals/`, `bin/lib/backup.mjs`
    and `bin/lib/payload.mjs` (they read whatever the host file holds), `bin/resume.mjs`'s Codex transcript branch
    (dead once no Codex hook calls it, left: out of this change's need).
- L4 (2026-10-31) Design: the eight Codex declarations leave `components`/`entryComponents`; `install` gains a test
  seam (`deps.components`, `deps.entryComponents`) and `bin/lib/earlier-codex.testkit.mjs` declares what 0.97.0
  installed, so the tests run today's `sync` and `uninstall` over a real earlier install rather than a hand-written
  manifest. Not addressed, older than this change: `install` writes a manifest without the undeclared records before
  `sync` prunes them, so a crash between the two leaves those files unrecorded.
- L5 (2026-10-31) Tests, each file alone [checked]: `bin/lib/manifest.test.mjs` 212/0 (its four new tests failed
  first: `pruneKept` `[]` and the Codex skills still written); `bin/install.test.mjs` 115/0;
  `bin/codex-hook-trust.test.mjs` 6/0; `bin/doctor.test.mjs` 95/0; `bin/lib/stack.test.mjs` 116/0;
  `bin/tui.test.mjs` 88/0; `bin/js-harness.test.mjs` 54/0; `bin/clean-home.test.mjs` 1/0;
  `bin/lib/project-rules.test.mjs` 29/0; `bin/readme.test.mjs` 5/0; `bin/lib/spec.test.mjs` 28/0;
  `scripts/practice-lib.test.mjs` 136/0; `scripts/release-proof-lib.test.mjs` 24/0. The writer's `scripts/` diff was
  read: `release-proof` holds a `--from` of 0.97.0 or older to the five Codex entries it wrote
  (`EARLIER_CODEX_HOOKS`, tested equal to the testkit's) and everything after to none.
- L6 (2026-10-31) Scratch-home proof [checked: `bash proof.sh` in the job's tmp, HOME, USERPROFILE and `--home` a
  `mktemp -d` folder, `CODEX_HOME` unset, removed after]:
  - A, this branch on an empty home: `installed js-harness 0.97.0 (6 files)`; `.codex/skills` absent,
    `.codex/hooks.json` absent; `uninstall --global` exit 0; 0 entries left in the home.
  - B, the released 0.97.0 first, over a seeded `.codex/hooks.json` holding one hook of the user's: `(9 files)`,
    `.codex/skills` 3 files, 5 js-harness entries. Then this branch's `install`: `(6 files)`, `.codex/skills` absent,
    0 js-harness entries, the user's `echo mine` hook kept. `uninstall --global` exit 0; left: `.codex/hooks.json`
    with the user's hook only. Not byte-identical to the seed: 0.97.0 re-indented the file when it grafted its
    entries, as it always did.
  - Seen, not changed: `install` prints nothing for the files and entries its `sync` prunes, only for one it keeps.
- L7 (2026-10-31) The second gate run (CI 41165824347) failed one test the search of L3 missed:
  `evals/without.test.mjs:317`. `evals/without.mjs` learned js-harness's own skills under `.codex` from the Codex
  components (`ownSkills`, `ownTexts`), so with none declared the eval's Codex arm took an earlier js-harness copy for
  another tool's skill. Fixed [checked]: both read the skill names of the Claude components under either host's
  `skills`; a new test (a rule cut in an earlier `.codex/skills/js-harness-protocols`) failed without the fix and
  passes with it; `evals/without.test.mjs` 33/0. The L3 search grepped `bin/`, `scripts/` and docs, not `evals/`, for
  readers of `components`: the scope line "Out: the evals' Codex arm" meant not changing what it measures, and it still
  measures the same home.
- L8 (2026-10-31) Reviews of `57486c74` (7aac3e43..57486c74) [checked, each command's output in the job's tmp]:
  - Codex: `js-harness codex-review --base 7aac3e43`, 3 parts, each "the patch is correct" (0.90, 0.91, 0.87);
    392,930 input tokens; recorded in `codex-reviews.jsonl`.
  - Claude lenses: `js-harness lens-review --base 7aac3e43 --lenses risk,reliability,readability`, each complete with
    0 findings (about 512k input tokens); resilience left out, since no failure behavior changed.
  - gentle-ai: not reviewed. The Stop hook offered the candidate (the same one commit); the `granted` start stopped in
    preflight, `lens_context_budget_exceeded` (31 files, 1,403 lines over its budget, `mutation_outcome: not_started`).
    It was not split: that rewrites the reviewed commit and voids the Codex and lens records.
  - Pushed; draft PR #729. Apply and undo tried in a scratch home (`apply-try.sh`): 0.97.0 `install` (3 Codex skills,
    5 entries), this branch's `sync --global` (`.codex/skills` and `.codex/hooks.json` absent), 0.97.0's
    `sync --global` (both back). The global package swap (`pnpm add -g`) was not tried there.
- L9 (2026-10-31) The independent verifier (a fresh sub-agent, read-only, its own scratch homes) on `57486c74`: no
  blocker; its main path held (tests each file alone, 0.97.0 then this branch, an edited earlier skill kept). Findings:
  1. Should-fix: an install by 0.96.0 or older recorded no `trustConfigs` (they came in c7af39e2), and the removed
     `codexConfigOf` had made `sync` record them while the entries were declared; now a prune of those entries left the
     trust of the user's hooks after them on the wrong slots. Fixed: `planTrustMoves(removing, earlier)` gives a record
     of `<home>/.codex/hooks.json` with none today's config.toml (`earlierTrustOf` in `bin/install.mjs`, for `install`,
     `sync` and `uninstall`). Tests failed first: `bin/codex-hook-trust.test.mjs` (sync and uninstall over such an
     install), `bin/lib/codex-trust.test.mjs` (only that hooks.json; a record's own wins).
  2. Should-fix: `sync`'s prune never ran `removeCreatedFolders`, so the `.codex` 0.97.0 made on a home with none stayed
     empty and unrecorded. Fixed in `sync`; `bin/lib/manifest.test.mjs` test failed first.
  3. Nit, fixed: `install`/`sync` now say each file and, per host file, the entries their prune removed (`logPruned`),
     as `uninstall` does; asserted in the sync test of `bin/codex-hook-trust.test.mjs`.
  4. Nit, fixed: `bin/js-harness.mjs` backup help said "in both hosts".
  5. Nit, not fixed, older than this change: an earlier entry recorded `skipped` is never pruned, and a sync stopped
     between `install`'s manifest write and the prune forgets the records (L4). Both rare; out of this change's need.
  Checked [each file alone]: codex-hook-trust 7/0, codex-trust 11/0, manifest 213/0, install 115/0, clean-home 1/0,
  conventions-structure 7/0, js-harness 54/0, manifest-settings 11/0, manifest-stack 7/0, rules-coverage 8/0.
  `apply-try.sh` again: the apply prints the three skills and "removed 5 hook entries from …\.codex\hooks.json: no
  longer shipped", and `.codex` is absent after it; the undo brings both back.
