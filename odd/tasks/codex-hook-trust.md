# Codex hook trust: doctor names the untrusted harness hooks, uninstall takes their trust with them

Locator: `odd/tasks/codex-hook-trust.md` · Engram mirror: `odd/codex-hook-trust/tasks` · Branch: `feat/codex-hook-trust`,
cut from `origin/main` at `3b1c8d89`, worktree `D:js-harness.claudeworktreeswonderful-gagarin-88a4cc` · Runner: `node --test` · Delivery: one slice, one PR.

Next step (kept current): the four findings of L6 fixed (L7) and committed; then `js-harness codex-review --base daa97b8` on the fix, push, PR, tick T4.

## Goal
A user whose Codex skips the harness's hooks is told so by `doctor` with the step that fixes it, and `uninstall` leaves
no trust record of a harness hook behind and no trust of the user's own hooks moved off its hook.

## Why
The launch audit's B4 probe (2026-10-24) showed Codex CLI 0.163.0 runs no `hooks.json` handler that has no trust record
in exec mode, and says nothing about it; `codex exec --dangerously-bypass-hook-trust` is the positive control. So the
harness's Codex hooks never run until the user trusts them in interactive `codex`, and nothing tells them. Codex keys a
trust by the hook's place (`[hooks.state.'<hooks.json>:<event>:<group>:<handler>']`), so an uninstall that takes an
entry out moves every later entry of the event to another key: left as it is, the harness's trust stays behind and the
user's hooks lose theirs. The rule that every write outside the repo is undone exactly (`AGENTS.md`) covers this.

## Done when
- `node --test bin/codex-hook-trust.test.mjs bin/lib/codex-trust.test.mjs bin/lib/stack.test.mjs bin/doctor.test.mjs bin/install.test.mjs bin/lib/manifest.test.mjs bin/readme.test.mjs` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/codex-hook-trust.md` exits 0
- The PR is open and `js-harness codex-review` recorded the slice's review

## In scope / Out of scope
- In: a `codex-trust` check in `bin/lib/stack.mjs` (doctor's report and its session-start hook); the trust edit of
  `uninstall` (`bin/lib/manifest.mjs`, `bin/install.mjs`); the TOML reading and editing in a new
  `bin/lib/codex-trust.mjs`; the entries `sync` prunes, which move the hooks after them as an uninstall does (L4);
  README; `docs/SPEC.md` where it lists doctor's rows.
- Out: writing a trust record. Trusting a hook is the user's security setting, and its `trusted_hash` is a sha256 of a
  form internal to Codex that cannot be reproduced from the entry (B4). A stale hash (an entry an upgrade changed) is
  not seen either: doctor cannot recompute it. Where the user's `CODEX_HOME` is not `<home>/.codex`, the harness writes
  its hooks to `<home>/.codex/hooks.json`, which that Codex does not read: a defect of its own, a follow-up.

## Constraints
- Tests through the public commands (`doctorMain`, `installMain`, `uninstallMain`) on throwaway homes; never the real
  `~/.codex` — because a test that wrote there would change his Codex.
- A `config.toml` holding hook trust in a form the edit does not read (dotted keys, an inline table, a `[hooks.state]`
  table) is left untouched and said — because a guess at TOML could lose his settings.

## Ask me before
Nothing expected: no spend beyond the Codex review, nothing irreversible, no product choice open.

## Specs
- S1. Doctor: "`js-harness doctor` reports each harness entry of the Codex `hooks.json` that has no `[hooks.state.'<hooks.json path>:<event_snake>:<group>:<handler>']` record with a `trusted_hash` in the user's Codex `config.toml` (under `CODEX_HOME`, following how stack T8 resolves it), and names the user's step to fix it. It never writes that record: trusting a hook is the user's security setting, and the hash cannot be reproduced."
- S2. Uninstall: "`uninstall` removes the trust records of the harness entries it removes, recorded at install so the undo is exact. The keys are positional (index-based), so removing an entry can shift later keys; handle that and test it."
- S3. README: "The README names the trust step after install."
- S4. "Tests first, through the public commands, with throwaway homes; never touch the real `~/.codex`. Done when `npm run check` passes, the PR is open, and the Codex review is recorded."

## Design
- The check `codex-trust` (`checks` of `bin/lib/stack.mjs`): the records of the manifest whose path is
  `<home>/.codex/hooks.json`, each found in that file as uninstall finds it (the first deep-equal entry not taken by an
  earlier record), give `<hooks.json>:<event_snake>:<index>:<handler>` for each handler. The `config.toml` of
  `codexHomeOf` (T8) is read for `[hooks.state.'…']` tables holding `trusted_hash`. Gap `missing` in the codex cell,
  with the fix line and one line per untrusted entry; `n/a` with no Codex entry recorded or present; `unknown` when a
  file cannot be read or holds hook trust in a form not read. It reads files only, so the session-start hook runs it.
- Install records, on each Codex entry, `trustConfigs`: the `config.toml` of `codexHomeOf` at each install, every one so far, handed in by
  `installMain` and `syncMain`. Uninstall plans, before taking an entry out, where every group of each event of that
  `hooks.json` goes (its new index, or gone), then edits each of `trustConfigs`, once: a gone group's tables are dropped, a moved
  group's are renamed to the new index with their hash. Tables of another `hooks.json`, and of places the file does
  not hold, are left. A record from before `trustConfigs` edits nothing: there is no recorded file to edit.

## Tasks
- [x] T1 (kind: build) S1, S4: the `codex-trust` check, tests first. Route: inline. RED/GREEN in L3.
- [x] T2 (kind: build) S2, S4: `trustConfigs` at install and the trust edit of uninstall and of sync's prune, tests first. Route: inline. RED/GREEN in L3, L4.
- [x] T3 (kind: docs) S3: README (the trust step after the install block, the row under doctor) and SPEC. Route: inline.
- [ ] T4 (kind: verify) S4: `npm run check`, Codex review, PR. Route: inline.

## Log
- L1. 2026-10-24, the task handed to this session by the lead session (`local_bd0ae465-dea2-48dc-91c5-964f400801be`), verbatim:
  "Build the harness work that B4 opened (`odd/tasks/launch-audit.md`, L32). Codex CLI 0.163.0 silently skips every `hooks.json` handler that has no trust record, so the four harness Codex hooks (`resume --hook` on compact, `backup --session-start`, `reply --hook`, `backup --hook`) never run until the user trusts them in interactive `codex` ("Trust all and continue").
  Deliver, as one ODD feature (`odd/tasks/codex-hook-trust.md`, opening with `js-harness contract template`):
  1. `js-harness doctor` reports each harness entry of the Codex `hooks.json` that has no `[hooks.state.'<hooks.json path>:<event_snake>:<group>:<handler>']` record with a `trusted_hash` in the user's Codex `config.toml` (under `CODEX_HOME`, following how stack T8 resolves it), and names the user's step to fix it. It never writes that record: trusting a hook is the user's security setting, and the hash cannot be reproduced.
  2. `uninstall` removes the trust records of the harness entries it removes, recorded at install so the undo is exact. The keys are positional (index-based), so removing an entry can shift later keys; handle that and test it.
  3. The README names the trust step after install.
  Tests first, through the public commands, with throwaway homes; never touch the real `~/.codex`. Done when `npm run check` passes, the PR is open, and the Codex review is recorded."
- L2. 2026-10-24, the key's shape read (read only) from the real `config.toml`: `[hooks.state.'C:\Users\Oficina\.codex\hooks.json:session_start:0:0']` with `trusted_hash = "sha256:…"`, a literal-quoted path, the event in snake case. The manifest declares five Codex entries, not four: the doctor's own `SessionStart` hook (`codex-hook`) is the fifth, and the check covers all five.
- L3. 2026-10-24, T1 and T2. RED: `node --test bin/codex-hook-trust.test.mjs` failed 9 of its 10 tests before any code (the tenth, nothing written to a config.toml without hook trust, guards the old behavior); `bin/lib/codex-trust.test.mjs` was written with the module. GREEN: 17 of 17 across the two files. The suites of the row lists (`stack`, `doctor`, `js-harness`, `clean-home`, `tui`) and `manifest`'s result shape were updated for the new check and the result fields, which appear only when not empty.
- L4. 2026-10-24, a gap found while building T2: `sync` takes out the entries a release no longer ships (`removeEntryFromFile` in its prune), which moves the Codex hooks after them exactly as an uninstall does, so it plans and moves the trust the same way. Its test went RED with the plan emptied (0 of 1) and GREEN with it. Not done, follow-ups: (a) with a `CODEX_HOME` that is not `<home>/.codex`, install writes the hooks to `<home>/.codex/hooks.json`, which that Codex never reads, so the check names every hook and trusting cannot fix it; (b) an upgrade that changes an entry replaces it in place (`isOlderOwnEntry`), keeping its key with a hash Codex no longer accepts, which doctor cannot see.
- L5. 2026-10-24, the first commit's gate failed three tests: `doctor.test.mjs` (a regex a heredoc unescaped), `clean-home.test.mjs` (a clean install now reports `codex-trust` missing, which is right: the test now asserts that gap and its five hooks instead of counting it among the rows with no gap), and the 1,000-line ceiling of `manifest.mjs` (the trust planning moved to `codex-trust.mjs`, `deepEqual` to `json-equal.mjs`). Commit message: `feat(codex): name untrusted harness hooks in doctor and move their trust on uninstall`.
- L6. 2026-10-24, `js-harness codex-review --base 3b1c8d89` recorded (parts 1 and 3 correct, part 2 incorrect at 0.99), four findings, all accepted: [P1] a `"""` inside a comment opened a multi-line string, so a drop could take the tables after it; [P2] a header comment that repeats the key's suffix got the rename instead of the key; [P2] `["hooks"."state"]` and other quoted spellings escaped the refusal; [P2] an install under another `CODEX_HOME` replaced `trustConfig`, so the uninstall forgot the first file. Fixes: one scanner for strings, comments and brackets; the rename inside the parsed key; quoted spellings refused; `trustConfigs`, every file recorded so far, each edited.
- L7. 2026-10-24, the fixes of L6, tests first. RED: three new tests of `bin/lib/codex-trust.test.mjs` (a `"""` in a comment and `[` and `'''` in one-line strings; a header comment repeating the key's end; quoted spellings of `hooks.state`, read as the same tables when they hold a trust key and refused in any other form) and two of `bin/codex-hook-trust.test.mjs` (`trustConfigs` at install; an install under a second `CODEX_HOME` then uninstall, both files emptied of harness trust) failed. GREEN: 551 of 551 across the contract's suites. The scanner is now one pass per line over strings, comments and brackets (`scanLine`) and a header parser (`headerKeys`) whose key end the rename uses; `trustConfigs` adds each install's file once (`withConfig`, the same path compare as the keys), so no file is moved twice.
