# One home folder: every reader of JS_HARNESS_HOME takes an empty value as unset

Locator: `odd/tasks/one-home-folder.md` · Engram mirror: `odd/one-home-folder/tasks` · Branch: `fix/one-home-folder`
Delivery: one commit, under ordinary repository policy; no push and no pull request from this slice.
Test runner: `node --test <one file>`; the commit's gate runs the rest.

## Goal
Every command resolves the harness home the same way: `--home`, else a non-empty `JS_HARNESS_HOME`, else the user's
home, and every path is resolved against the working directory. An empty `JS_HARNESS_HOME` never makes a command write
into the folder it runs in.

## Why
`JS_HARNESS_HOME=""` kept the empty string as the home in eight commands (check, clean, doctor, gate, init, install,
stack, update), so their files landed in the current directory, which is a repository when a session runs there. The
C-c-2 fix covered only `remote` and `tui`. The other files used `||`, and only some of them resolved a relative value.

## Done when
- `node --test bin/lib/home.test.mjs` exits 0
- `npm run check` exits 0
- `node scripts/audit-flags.mjs --json` and every command's `--help` give the same stdout and exit code before and after
  (run with a non-empty scratch `HOME`, `JS_HARNESS_HOME` and `CODEX_HOME`), as recorded in the Log.

## In scope / Out of scope
- In: the new `bin/lib/home.mjs`; its test; every read of `JS_HARNESS_HOME` in `bin/*.mjs` and `bin/lib/*.mjs` (only
  those lines and their imports); one new test per command in its own `*.test.mjs`.
- Out: writes of `JS_HARNESS_HOME` into a child's environment (`scripts/*`, `bin/notify.mjs`, `bin/lib/stack.mjs`
  probe); help text; `bin/doctor.mjs` beyond its home line; any change to what a flag means.

## Constraints
- A flag that is empty counts as unset, as `codex-review.test.mjs` already pins for `--home` — because an empty value is
  the defect class this slice removes, and the next source is the one the user meant.
- Scratch lives in `mktemp -d` folders outside the worktree and is reported, never deleted by a worker.

## Ask me before
Nothing open. A change of what a flag means would be asked first.

## Specs
- S1. `bin/lib/home.mjs` exports `harnessHome({ given, env, cwd, homedir })`: `given` (the `--home` value) wins when it is
  non-empty, so an empty `--home ""` is unset like an empty variable (amended by the lead, L8); otherwise `env.JS_HARNESS_HOME` when it is non-empty; otherwise `homedir()`. The result is `path.resolve(cwd, value)`.
  It exports `homeIsSet(env)`, true only for a non-empty value. It reads no file and spawns nothing.
- S2. All reads of `JS_HARNESS_HOME` in `bin/*.mjs` and `bin/lib/*.mjs` use the helper, keeping each site's order of
  sources. The clean command keeps its `deps.scan` home after the environment, as the `homedir` fallback. The clean
  library's presence test and the resume command's temp-folder test use `homeIsSet`.
- S3. RED first: one test for each of the eight commands, showing an empty `JS_HARNESS_HOME` no longer makes the command
  use its working directory as the home. `home.test.mjs` covers: the flag wins; an empty environment is unset; a relative
  value resolves against `cwd`; the fallback is `homedir()`.
- S4. Behavior differential: before and after, `node scripts/audit-flags.mjs --json` and every command's `--help` are
  identical in stdout and exit code, with a non-empty scratch home, `JS_HARNESS_HOME` and `CODEX_HOME`. The before copy is
  a `git archive` of the base commit in a scratch folder.

## Tasks
- [x] T1 (kind: build) inline, S3 — RED for `check`, `clean`, `doctor`, `gate`, `install`, `stack`, `update`;
  `init` pinned green (its home is never read: `initProject` takes no home). Commit: this slice's commit.
- [x] T2 (kind: build) inline, S1, S3 — `bin/lib/home.mjs` and `home.test.mjs`, RED then GREEN (7 of 7).
  Commit: this slice's commit.
- [x] T3 (kind: build) inline, S2 — 57 edits in 31 files, applied by one script that asserted each old text
  occurs once; the three sites whose local variable was named `harnessHome` now use `home`. Commit: this slice's commit.
- [ ] T4 (kind: verify) inline, S4 — differential and `npm run check`, recorded in the Log.

## Log
- L1 (2026-10-24, the user's words, quoted by the orchestrator in `reorg-slice-1-brief.md` of the side session
  `local_053e19d7-d91d-4aa6-a210-3f014cf86050`): "quiero la mejor calidad, solidez, robustes, y optimizacion al mismo
  tiempo". The plan is `reorg-plan-v2.md`, section 2, "Slice 1".
- L2 (2026-10-24) RED on the base commit `828f35a7`: `check`, `clean`, `doctor`, `gate`, `install`, `stack`, `update` each
  fail their new test (`node --test --test-name-pattern="takes an empty JS_HARNESS_HOME" bin/<cmd>.test.mjs`). The
  observed effects: `install` wrote `.claude/settings.json` and `.js-harness/manifest.json` into the working directory;
  `doctor` and `gate` wrote `.js-harness/` there; `check` reported `global CLAUDE.md not found`; `clean --log` named a
  relative log path; `stack` still listed the `claude` dimension of gentle-ai; `status --global` said
  `manifest version: (not installed)`.
- L3 `init`: its home is parsed and never read (`initProject` takes no home; the manifest sits under the repository's
  `.git`). `init` cannot turn RED; its test pins that an empty value still sets a project up.
- L4 GREEN: `home.test.mjs` 7 of 7; the eight command tests pass with the change, and each fails on the base copy
  (`red` scratch, see the report).
- L5 S4 differential: `scripts/audit-flags.mjs --json`, every command's `--help`, the root `--help` and `--version`,
  run with a scratch `HOME`, `JS_HARNESS_HOME` and `CODEX_HOME` on the base copy (`git archive 828f35a7`) and on the
  worktree: 90 of 90 captured files identical in stdout, stderr and exit code, after normalizing the repository root.
  Both runs exit 1 on `audit-flags` and on `tui --help`, as the base does.
- L6 (2026-10-24) the first gated commit failed on GitHub CI with three tests: `sessions --opening` (a `sessionsMain` use
  of `harnessHome` still named the imported function after its declaration became `home`), `doctor` and `gate` (their
  assertions checked files the command does not write under `--offline` and a log file name it does not create). Fixed
  in `bin/sessions.mjs` (uses renamed to `home`), `bin/doctor.test.mjs` (the cache is seeded and read back as `outdated`)
  and `bin/gate.test.mjs` (asserts the gate-log folder). Each now passes locally: `sessions --opening` in
  `bin/js-harness.test.mjs`, `bin/sessions.test.mjs` 245 of 246 (one skipped), the doctor and gate tests alone.
- L7 (2026-10-24) the second gated commit failed on CI again, in the same two tests. The doctor row's `upToDate` is
  `unknown` whenever the tool is not installed, and CI has no gentle-ai, so the test now runs `doctorMain` in-process
  with a fake gentle-ai 4.2.0 and the user home set through `HOME`/`USERPROFILE`. The gate test no longer asserts a log
  file under the user home: CI wrote no `gate-log` there, and I have not found why (open; the in-process
  `gate resolves its home` test covers the home choice). Both tests fail on the base copy (doctor: `unknown` for
  `outdated`; gate: the working directory got its lock or log), so both remain RED evidence.
- L8 (2026-10-24, the lead) The independent Opus verifier (its scratch folder, outside the repository) found no change-caused defect. S1 PARTIAL, S2 PASS, S3 PARTIAL, S4 PASS. The 148-pair differential shows only the asked-for changes. D1: an empty `--home ""` no longer means the working directory. The lead accepts it under his 07:10Z word (908805db line 28784), because it removes the same defect class, and amends S1. A1: CI wrote no gate log because every test inside a gate carries JS_HARNESS_CHECK_INNER=1, and a gate that sees it writes nothing (gate.mjs gateMain). That is a test artifact, not a Linux defect. The gate test now strips the inner-gate variables and asserts the log lands in the user home; observed RED on 828f35a7 and GREEN on the candidate, both with JS_HARNESS_CHECK_INNER=1. A2: the two unused imports in bin/doctor.test.mjs are gone, and doctor.test.mjs passes 91 of 91.
- L9 (2026-10-24, the lead) gentle-ai: 828f35a7..3d432e55 assessed high (raised by the lead to item 1, where files land), reviewed with the risk and reliability lenses, approved and acknowledged (lineage review-16b443b86ce5e700, authority burned). Codex: correct in both parts (0.9, 0.98), recorded. Its three non-blocking findings: R3-stack-test-vacuous (WARNING) is fixed here, since the stack test now asserts that the gentle-ai row asks only for codex, so an absent row no longer passes it (observed RED on 828f35a7 and GREEN on the candidate, both with JS_HARNESS_CHECK_INNER=1); R1, a local scratch path in L8, is removed; R3-gate-subforms-cwd (SUGGESTION, bin/gate.mjs:177) is left as later work.
