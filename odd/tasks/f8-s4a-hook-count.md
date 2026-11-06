# JH 153 · F8 S4a: the hook count and the engram prompt hook

Locator: `odd/tasks/f8-s4a-hook-count.md` · Branch: `claude/f8-s4a-hooks-5da26e` · Delivery: one pull request to
main per slice · Test runner: `node --test`

## Goal
`check` holds the Claude hook entries of the machine to a ceiling by event and owner, the engram plugin's prompt hook
is off on his machine with a way back, and S4a's attribution count on `main` is recorded, so S4a closes.

## Why
Every hook entry is a process start on Windows at each firing, and gentle-ai, Orca and herdr had grown the hooks to 32
before S2 took them out (`docs/proposals/gentle-ai-reverse-engineering.md`, "Every hook, by event and owner"). Nothing
stops them growing back. The engram prompt hook prints a false "CRITICAL FIRST ACTION" and about 0.4k tokens at a
session's first message; he answered D8 "Apagarlo". The attribution hook is merged (`odd/tasks/strip-attribution.md`);
its pass line is a count on `main`.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/f8-s4a-hook-count.md` exits 0
- `node --test bin/lib/hook-count.test.mjs` exits 0
- `node --test bin/check.test.mjs bin/lib/payload.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- one extra `Stop` entry planted in a scratch home turns the `hooks` row red, quoted in `## Log`
- the pull requests are opened, named in `## Log`, with Codex and the Claude lenses recorded over their code

## In scope / Out of scope
- In: a new `bin/lib/hook-count.mjs` and its test; `bin/lib/payload.mjs` (its hook reader reads every event for the
  count); `bin/check.mjs` (the row, and code moved out to stay under its ceiling); the switch in `harness.json`;
  README, `docs/SPEC.md`, `docs/ROADMAP.md` S4a; the command that turns the engram prompt hook off and on, recorded.
- Out, each with its reason:
  - rewriting commits already on main: his answer to question 132.
  - `bin/upgrade*`, `bin/tui*`: JH 152's files.
  - his `~/.claude` and the engram plugin's files: written only by the command, and only after his yes through the
    lead.

## Constraints
- The row is switched on by the project (`harness.json`), not on every project `init` sets up — because the hooks
  are the machine's, and another machine's owners would turn every project's gate red.
- A home with no settings (CI, a test's scratch home) is an INFO row, never a failure — because the gate's sensors run
  on CI.
- `bin/check.mjs` is at its ceiling (2,008 lines, `bin/conventions-structure.test.mjs`): code moves out before any is
  added.
- Anything written outside this repository is backed up and recorded so it is undone exactly — because `AGENTS.md`
  says so.

## Ask me before
Applying D8 to his machine is his yes, asked through the lead (`js-harness notify --to orchestrator --kind question`).
His answer of 2026-10-26 was given to a question that did not say the hook also saves his prompts to engram (L3), so
the question names that.

## Depth pass
- 1. Method: a budget check, the discipline of a performance budget held by CI (a ceiling that fails the build, not a
  dashboard), to the standard of this repo's own ceilings (`bin/conventions-structure.test.mjs`: a table in code that
  only goes down). The smallest change: one static row that counts what the host would run and compares it with a
  table in code. Searched first (`rule:reuse-first`): `claudeHooks` and `pluginHooks` in `bin/lib/payload.mjs` already
  read the settings layers and the enabled plugins' `hooks.json`, for the context events only; `hooksRow` of
  `scripts/s2-verify.mjs:144` classifies owners for S2's one-off verification; `js-harness rules` names no hook rule.
- 2. Raw material: `~/.claude/settings.json` read 2026-11-06 (16 entries: js-harness 15, codegraph 1); the engram
  plugin `0.1.19` `hooks/hooks.json` (7 entries) and `scripts/user-prompt-submit.sh` (no switch: its only early exit is
  `PI_CODING_AGENT`, which silences every engram hook); the Codex plugin `1.0.6` `hooks/hooks.json` (3 entries);
  his D8 answer (`js-harness sessions --quote e41d1e8d 3740`); the diet's D8 row (`docs/proposals/harness-diet.md:99`).
- 3. The bar:
  spec 1: `node --test bin/lib/hook-count.test.mjs`: none, new behaviour; today nothing fails on an extra hook.
  spec 2: `node --test bin/lib/hook-count.test.mjs`: none, new behaviour; today the engram `UserPromptSubmit` entry is
  on and nothing would notice it coming back.
  spec 3: `git rev-list 75c3583f..origin/main`: 341 commits, 0 attribution lines (L2).
- 4. Refutation: does the roadmap's ceiling still describe the machine? Counted 2026-11-06: 16 settings entries, not
  14 (the template gate added two js-harness entries after the count, `docs/audits/2026-10-30-cleanup-inventory.md`
  F6), and 10 more from plugins the 14 never counted. The ceiling is restated from this count (L3), so the request
  holds in its intent, not its number.
  Verdict: supports
- 5. Request: a `hooks` row that counts every hook entry Claude Code runs here, settings layers and enabled plugins, by
  event and owner, against a table in code set to the count of 2026-11-06, red on a new owner or a cell above its
  ceiling; D8 as a recorded command applied after his yes, its cell then lowered to 0. The plugins' entries in the
  count, and the prompt-saving loss named in the D8 question, are within the request: the first is its intent (L3),
  the second is said in the question that applies D8.
  Adds: none

## Specs
1. ROADMAP S4a (`docs/ROADMAP.md`, "S4a The attribution hook and the hook count"): "a `check` row counting hook entries
   by event and owner"; "one extra `Stop` entry turns the row red; 0 attribution lines in the next 50 commits on
   `main`; the row fails above 14 entries or on a new owner. D8, the engram prompt hook turned off, is applied here."
2. D8, his answer of 2026-10-26 (transcript `e41d1e8d`, line 3740): "Apagarlo (Recommended)"; the register's default:
   "off, backed up and recorded so it can be turned back on; applied at S4a with the hook-count row"
   (`docs/proposals/harness-diet.md:99`).
3. The opening of JH 153 (2026-11-06): "the 50-commit count of attribution lines on `main`"; "Anything that writes
   outside this repo (his `~/.claude` or a host config) is recorded so it can be undone, and applying it to his machine
   is his yes, asked through the lead."

## Tasks
- [x] T1 (kind: verify) spec 3: the 50-commit count on `main` — L2
- [x] T2 (kind: build) spec 1: the `hooks` row, tests first; `check.mjs` code moved out first — L4
- [x] T3 (kind: verify) spec 1: Codex and the lenses over T2, PR 1, ready notice — L5, L6
- [x] T4 (kind: build) spec 2: the command that turns the engram prompt hook off and on, backed up and recorded — L7
- [ ] T5 (kind: verify) spec 2: his yes through the lead; applied; the engram `UserPromptSubmit` ceiling lowered to 0
- [ ] T6 (kind: docs) ROADMAP S4a State, SPEC, summary under `docs/sessions/`

## Log
- L1 (2026-11-06, the request as written): "You are the session \"JH 153 · F8 S4a: the attribution hook and the hook
  count\". Read your opening with js-harness sessions --opening 'JH 153 · F8 S4a: the attribution hook and the hook
  count' and follow it." The opening says what is left: the 50-commit count, the hook-count row, D8.
- L2 (2026-11-06, T1): `strip-attribution`'s two pull requests are merged (#728 as `75c3583f`, #731 as `bd45a5b2`).
  Every commit on `origin/main` since `75c3583f` (`git rev-list 75c3583f..origin/main`: 341, 47 on the first-parent
  line) read with `git log -1 --format=%B` and matched against `^(Co-Authored-By:.*(claude|anthropic)|Claude-Session:)`
  (any case): 0 lines. The 50 commits before `75c3583f` held 20 such lines in 10 commits. S4a's pass line, 0 in the
  next 50, holds.
- L3 (2026-11-06, what the roadmap and the machine disagree on): the roadmap's ceiling is 14 (js-harness 13, codegraph
  1); `~/.claude/settings.json` holds 16 (js-harness 15, codegraph 1), and the two enabled plugins add 10 (engram 7:
  `PreToolUse` 1, `SessionStart` 3, `UserPromptSubmit` 1, `SubagentStop` 1, `SessionEnd` 1; Codex 3: `SessionStart`,
  `SessionEnd`, `Stop`). The row counts both, since a plugin's entry starts a process as a setting's does, and its
  table is the count of this day. D8: the engram prompt hook also posts each prompt to engram (`POST /prompts`) and,
  after 15 minutes without a save, injects a save reminder; the question he answered said only that memory keeps
  working without it. Turning it off stops both; the question that applies it says so.
- L4 (2026-11-06, T2, red then green): `bin/lib/hook-count.test.mjs` written first; against a stub module, 9 of 10
  red (the tenth checks the table's shape). Then `bin/lib/hook-count.mjs`: the table `HOOK_CEILINGS` (L3's count),
  `ownerOf` (js-harness or codegraph by the program the command starts, `plugin <id>` for a plugin's entry, the
  command itself for any other), `countHooks` and `hookCountRow`; `readHooks` of `bin/lib/payload.mjs` reads every
  event when asked (`claudeHookEntries`), its context reading unchanged. The gate's test (`main` with one Stop entry
  too many, a scratch home) red with the row unwired, green wired. `checkPayload` moved from `bin/check.mjs` into
  `bin/lib/payload.mjs`, re-exported, so `check.mjs` is 1,987 lines and its ceiling goes down to that. On this machine
  the row reads "26 hook entries from 4 owners", every cell at its ceiling. `node --test` over hook-count, payload,
  check, conventions (structure, arguments, errors), readme and spec: 348 of 348; `rules check` PASS.
- L5 (2026-11-06, the reviews of `1d4f63db`): lenses reliability and readability over `8d1284a..1d4f63d`: 0 findings
  each. Codex over `5fe15e5..266ca79`: incorrect (0.94), one P2, taken, tests first: a command whose program path is
  quoted (`"C:\Program Files\codegraph\codegraph.exe" prompt-hook`) was split on whitespace, kept its quote, and read
  as a new owner. `ownerOf` now reads a quoted first word whole and unquoted. Red: 1 of 10 (the owner test, with
  three quoted cases), then `hook-count` and `check` tests 265 of 265. The D8 question went to the lead as question
  208 (2026-11-06 13:44 local).
- L6 (2026-11-06, the reviews of `43267a4f`): Codex over `266ca79..43267a4`: correct (0.98), the P2 of L5 fixed. Lens
  reliability: 0 findings. No independent verifier: the change names no high-risk item (an optional `harness.json`
  key, a row that reads files and writes none).
- L7 (2026-11-06, his answer and T4): question 208 answered "Apagarlo igual (Recomendado)" (the lead's transcript
  `0f71b2c6`, line 70355, 2026-11-06T19:08:10Z, read with `js-harness sessions --quote`); the lead's word: build it
  test-first with its reviews, apply it once it is reviewed and merged. Searched first: the manifest's `settings`
  record (`restoreSettings`) compares a value by identity, so it cannot hold a file's object; `stack install`'s
  records undo a package or a registration by a command. So a record of its own, `pluginHooks`, with the file's whole
  text before and after (`docs/RECORDS.md`), carried by `install` and `sync` like every on-request record
  (`ON_REQUEST`) and put back by `uninstall`. `bin/lib/manifest.mjs` sat at its ceiling (1,752): the Windows
  scheduled-task helpers moved whole to `bin/lib/scheduled-tasks.mjs`, re-exported, so it is 1,650 and its ceiling
  goes down to that. Red then green: `bin/lib/engram-prompt-hook.test.mjs` against a stub, 0 of 9, then 9 of 9;
  `stack engram-prompt` in `bin/stack.test.mjs`, red (exit 2, unknown argument), then green; the `hooks` row naming
  the command over the engram cell, red 1 of 11, then 11 of 11. `node --test` over hook-count, engram-prompt-hook,
  stack, manifest, install, stack-run, remote, conventions (structure, arguments, errors), readme and js-harness:
  583 of 583.
- L8 (2026-11-06, the reviews of `b309c50f`): lenses reliability and risk over `dc0d6c5..b309c50`: 0 findings each.
  Codex over the same range, 2 parts: incorrect (0.96), three P2, all to take, tests first, after the pause for the
  Desktop update (4.23118.0): (1) `restorePluginHooks` treats any read error as `gone` and `promptHookOn` then forgets
  the only undo record while the hook stays off; only ENOENT is gone, any other read error keeps the record as
  `failed`; (2) `stack engram-prompt off --home <dir>` prints `undo: js-harness stack engram-prompt on` without that
  `--home`; (3) a manifest that does not parse or cannot be written throws out of `stackEngramPromptMain`; catch it at
  the command and exit 1 with the reason.
- L9 (2026-11-06, after the restart, 21:43Z): L8's three P2, tests first (`f87e2d69`, red 2 of 30 then the manifest
  one, then 30 of 30); Codex's recheck over `6503545..f87e2d6`: 1 and 3 fixed, 2 not (the home quoted with
  `JSON.stringify`, which no shell reads as written). `6e347957` quoted it the POSIX way; Codex's third review over
  `f87e2d6..7693ac2` (0.99): still a P2, an apostrophe in the home is not read by PowerShell, which doubles it. By
  rule:escalation-model nothing more is reviewed of it and it passes to claude-fable-5-1; the guard refused a Fable
  sub-agent (rule:subagent-writer-model haiku, rule:subagent-reader-model opus), so the hand-off went to the lead as a
  question (shared notes, `jh153-d8-escalation.md`). That review wrote no record: I edited `docs/FAILURES.md` while
  it ran. The independent verifier over `dc0d6c55..f87e2d69` (opus, read-only): P1, the `uninstall` command read no
  `pluginHooks` result, so a hooks file it could not put back was silent with exit 0 and `--everything` then removed
  `~/.js-harness` with the only record; fixed in `a3c771de` (red: exit 0 where 1). P2, `off` wrote before it recorded,
  so a failed record and a failed put-back left the hook out unrecorded; fixed in `7693ac2a` (red: the record kept
  after the write). Its P3s: the scratch homes left behind, fixed there; a half-finished `on` run again says
  "changed" for a file it already put back, and non-UTF-8 bytes would not round-trip exactly, both left (nothing is
  lost; engram's file is plain JSON). Lenses reliability and risk over `6503545..932bbd6`: 0 findings each.
  `node --test` over engram-prompt-hook, stack, install, manifest, hook-count, conventions and readme: 398 of 398.
  The lead asked for 772 against this PR: neither row covers the other, both create `bin/lib/hook-count.mjs`; the
  answer (fold 782 into 772's module after the series) is in the shared notes, `jh153-772-vs-782.md`.

## Next step
State (2026-11-06, JH 153, worktree `D:\js-harness\.claude\worktrees\probe-auto-archive-3b36c3`): slice 1 is PR #782
(branch `claude/f8-s4a-hooks-5da26e`, reviewed, ready notice sent). Slice 2 (T4, L7) is committed on branch
`claude/f8-s4a-d8`, cut from slice 1's head, not pushed. D8 is answered "Apagarlo igual" (L7). L8's and the
verifier's findings are fixed (L9) except the undo line's quoting for PowerShell, which waits on the lead's answer to
how it passes to claude-fable-5-1; the lead also holds the 772 question, which may move this branch onto that series.
Then: Codex's record for the fixes, push, PR 2, `notify --kind ready --pr <n>`. After both merge (T5): a question through the
lead to run `js-harness stack engram-prompt off` on his machine, then the engram `UserPromptSubmit` cell leaves
`HOOK_CEILINGS`, then T6 (ROADMAP S4a State, summary, `notify --kind closed`).
