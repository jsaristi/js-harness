# F8 S11: js-harness takes over the complements

Locator: `odd/tasks/f8-s11-complements.md` · Engram mirror: `odd/f8-s11-complements/tasks` · Branch: `f8-s11-complements`
Delivery: chained pull requests, one a slice of about 400 lines · Test runner: `node --test`

## Goal
`stack` installs and registers engram, its plugin, codegraph and context7 with each tool's own command and an
exact or named undo, with context7 required; `init` takes a preset (complete, lean, custom) and writes no line
naming a tool the preset leaves out; and `bin/` and `evals/` stop depending on gentle-ai, so what still names it
is a named list.

## Why
S2 removes gentle-ai, and today it is the installer of engram and of the engram plugin, the fix line of three
`doctor` rows and a watched install (the diet, section 10, the S11 row). The diet ports first and removes last;
G11 ("el context7 siempre va a encendido en los proyectos", line 2466) makes context7 required; G14 names the
presets; rows 11 and 17 of the reverse-engineering document's section 13.3 land here.

## Done when
- `node --test bin/lib/stack.test.mjs bin/lib/stack-install.test.mjs bin/stack.test.mjs bin/stack-install.test.mjs bin/doctor.test.mjs bin/doctor-hook.test.mjs bin/lib/gentle-ai-absence.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s11-complements.md` exits 0
- `npm run check` exits 0
- `## Probe` below records, in a scratch home with no gentle-ai: `stack` lists engram, the engram plugin,
  codegraph and context7, each with its own command and its undo; and `doctor` on his machine, gentle-ai still
  installed, shows no gentle-ai row and no gap S11 made
- `grep -rl gentle-ai bin evals` lists only the files `bin/lib/gentle-ai-absence.test.mjs` names, each with its
  reason (a historical fixture, a license notice, a test that asserts absence, or a file another session owns)

## In scope / Out of scope
- In: `bin/` (except `bin/lib/guard.mjs`, `bin/lib/lens-reviews.mjs`, `bin/lib/codex-reviews.mjs` and their
  tests, which JH 69 owns), `evals/`, `scripts/`, this document, the F8 S11 line of `docs/ROADMAP.md`.
- Out: the real `~/.claude`, `~/.codex` and gentle-ai's configuration (applying S11 to his machine is his, asked
  through the lead once the PRs are ready); `CLAUDE.md` and `AGENTS.md`, which still name gentle-ai's review
  until S2; S2's removal; the idea watch (S9, after S2).

## Constraints
- No test or probe installs anything for real: every command goes through `runWords`, whose spawn refuses in a
  test, and probes run in a `mktemp -d` home outside the repo, with no network — because a real install on his
  machine is his to decide.
- What `stack install` runs has an exact undo recorded before it starts; a tool whose own command writes more
  than one thing it cannot read back is his step, named with its undo — because the predecessor needed four
  hand-written purge scripts (AGENTS.md).
- S11's probes spend nothing on evals (the diet, line 166).
- At most one gate, eval or review at a time — because the machine is shared with JH 69.

## Ask me before
Applying S11 to his machine (through the lead, once the PRs are ready).

## Specs
- S1 (diet S11 row): "`stack`'s engram, engram-plugin, codegraph and context7 rows install and register with their
  own commands; context7 required and on here (G11)".
- S2 (diet S11 row, G14): "presets (G14)"; G14: "**complete** (engram, codegraph, context7, both reviews, the
  split) and **lean** (the same without codegraph); **custom** may add or drop codegraph and the engram plugin,
  never context7 or the reviews"; "`init` with a preset enables context7 and runs `codegraph init` (except
  `lean`, which has no codegraph); `doctor` flags a project with context7 off".
- S3 (reverse-engineering 13.3, row 17): "a project on the lean preset gets no codegraph lines"; proof: "a test
  renders each preset's files and finds no line naming a tool the preset leaves out".
- S4 (diet S11 row): "the `gentle-ai` and `gentle-ai-sync` rows and `gentle-ai-update.mjs`'s install watch leave".
- S5 (diet S11 row): "**the sweep covers `bin/` and `evals/`** ...; the block arms become historical fixtures,
  named in a list"; pass: "`grep -rl gentle-ai bin evals` lists only the idea watch, the named fixtures and tests
  that assert its absence".
- S6 (reverse-engineering 13.3, row 11): "js-harness writes no engram text of its own; the protocol and the
  context recovery come from engram alone (its MCP instructions and plugin) ... A `doctor` row flags a binary and
  plugin that serve different protocol versions"; cost "a stack row's fix, a `doctor` row and two fixtures".
- S7 (diet S11 row, pass): "`stack` on a scratch home with no gentle-ai lists each complement with its own command
  and undo"; "`check` green; `doctor` green with gentle-ai still installed".

## Tasks
- [x] T1 (kind: build) the stack rows: engram, the engram plugin, codegraph and context7 by their own commands,
  context7 required and runnable, the gentle-ai row and its installer step out — S1, S4; inline; PR 1
- [x] T2 (kind: build) the `gentle-ai-sync` row, `doctor --gentle-ai-reviewed` and the install watch out — S4;
  inline; PR 1
- [x] T3 (kind: build) presets: `init --preset`, the `engramPlugin` switch, the context7 project row, and a test
  per preset — S2, S3; inline; PR 2
- [x] T4 (kind: build) row 11: a test that nothing js-harness writes carries engram's protocol, and the
  engram-plugin row's `mismatch` with its two fixtures (L10) — S6; inline; PR 2
- [x] T5 (kind: build) the review sweep: the merge door's gentle-ai evidence, the pull-request body line, the
  review-starts row and the shipped text that sends a session to gentle-ai — S5; inline; PR 3
- [x] T6 (kind: build) the evals sweep: the block arms and the state copies as historical fixtures, named in a
  list — S5; inline; PR 4
- [x] T7 (kind: build) the comment sweep and `bin/lib/gentle-ai-absence.test.mjs`, the named list — S5; inline;
  PR 4
- [x] T8 (kind: verify) the probe in a scratch home, and `doctor` read on his machine — S7; inline

Reviews:
- Codex: ac0725d..cea68ea, 6 parts, all passed (828,730 input tokens), one P2 taken: the Codex undo of engram
  removes the instruction settings an older engram or gentle-ai set before it deletes the files (fix commit after
  cea68ea1); Codex cea68ea..28acfb5 passed (the P2 fixed). Lenses risk, reliability, readability over d2bc8ab..28acfb5: 0 findings.
- PR 2: Codex fd70e26..ac28c99, 1 part, passed, no finding (174,553 input tokens); lenses risk, reliability,
  readability over fd70e26..ac28c99: 0 findings (about 23,830 input tokens each).
- gentle-ai on `fd70e263..ac28c992`: approved (lineage review-4739c69c341b3d15, lens review-reliability), three
  advisory findings. R3-001 (init's context7 notice would throw without an `os` import) does not hold:
  `bin/init.mjs:5` imports it. R3-002 (the engramPlugin switch hiding the row is proved by a unit call only) is
  taken: a `probeStack` test in the commit after ac28c992. R3-003 (a Windows drive letter in another case would
  read a disabled context7 as `ok`) is left: `claudeJsonMcpServer` reads the same `projects` keys exactly, so one
  cell matching by case would make two rules for one file, and it fails open, never a false gap.
- f63536e9 (R3-002's test): Codex ac28c99..f63536e passed (35,412 input tokens); lens reliability, 0 findings;
  gentle-ai on `ac28c992..f63536e9`: approved, no finding (lineage review-02e16e1f6bf65507).
- PR 3, fc2a9a0f (the merge door asks for no gentle-ai line): Codex e0260e5..fc2a9a0, 1 part, passed (131,847
  input tokens); lenses risk, reliability, readability over e0260e5..fc2a9a0: 0 findings (about 29,840 input
  tokens each); gentle-ai on `e0260e51..fc2a9a0f`: approved (lineage review-62a0e5a1a2f1a26e), two advisory
  findings. R3-001 (with both review switches off the door admits a code commit with no review) is question 104's
  case: L11 keeps it until he answers, and the codex-off landing test changes with that answer. R3-002 (the help
  test's `doesNotMatch` runs on a `find` that could be undefined) is left: an undefined argument throws, so the
  test still fails, only with a type error, and a test-only commit would cost three more reviews.
- PR 3, f718c3f6 (the review starts and their throughput row leave): Codex 6c04759..f718c3f, 2 parts, passed
  (172,708 input tokens); lenses reliability, readability: 0 findings (about 26,230 input tokens each; a first run
  came back incomplete, readability's answer cut mid-JSON, and the one rerun was complete); gentle-ai on
  `6c047591..f718c3f6`: approved (lineage review-050cc676b966128a), one suggestion left: R3-001 (the no-store test
  wraps three fs calls, not every one) is covered by the same test's output assertion, which is what a person sees.
- PR 4 (#632), eef7e095 and 61829b9f (the live mentions and the sweep): Codex caaccd3..61829b9, 2 parts, passed
  (163,588 input tokens), one P2 taken: the review cell built its index without DO_NOT_TRACK (fixed in 8d7bc9fa;
  Codex 61829b9..8d7bc9f, confidence 0.99, says fixed); lenses reliability, readability over caaccd3..8d7bc9f: 0
  findings (about 38,750 input tokens each); gentle-ai on `fc2a9a0f..8d7bc9fa` (the range its Stop hook offered,
  with f718c3f6 again): approved (lineage review-c62331774b325e18), two findings taken in 71e89a2b: R3-001 (the
  absence test walked the worktree, so an untracked file decided it; it reads `git ls-files` now, proved with an
  untracked scratch file naming it) and R3-002 (an old day's `reviews` key is proved silent). 71e89a2b: Codex
  8d7bc9f..71e89a2 passed (63,924 input tokens); lens reliability, 0 findings.
- Lens reruns (2026-10-28, the lead: PR 630 makes older lens records stop counting; installed copy main 19f2d80):
  PR 629 over e0260e5..caaccd3, risk, reliability, readability: 0 findings (about 53,190 input tokens each); PR 632
  over caaccd3..83fcb8a, reliability, readability: 0 findings (about 39,320 input tokens each).
- gentle-ai on `fc2a9a0f..fff61c60` (the range its Stop hook offered; new to it: 71e89a2b and the records): approved
  (lineage review-f349eeab4a9cc763), two findings left. R3-001 (the test matches the dashed name only, not
  `gentleAi` or `GENTLE_AI_TELEMETRY`): the dashed name is the diet's pass line, `grep -rl gentle-ai`; the other
  spellings are old stack records a run still reads and a guard of his machine until S2 (L12). R3-002 (the test
  needs git): every test here runs in a checkout, the GitHub gate included, and the failure names git.
- PR 3, 36587437 (the lens record where the Codex review is off, L14): Codex caaccd3..3658743, 1 part, passed
  (118,985 input tokens); lenses risk, reliability, readability over caaccd3..3658743: 0 findings (about 20,350
  input tokens each); gentle-ai on `caaccd3f..36587437`: approved (lineage review-e13532840d6c3432), two suggestions
  left. R3-001 (no test of a Codex switch whose `auto` resolves off): the merge-queue test of a project with no
  harness.json is that case, since `codexReview` falls back to `auto` (`bin/lib/functions.mjs:9`), and it is now
  refused with no lens record. R3-002 (the "2 of 2" count rests on state of earlier tests): `beforeEach` makes a new
  repository for each test, so the two commits are its own and the one this test makes.
- gentle-ai on `ac0725d2..28acfb5d`: not reviewed (its Stop hook offered only the whole branch, so its status was read and nothing started, as CLAUDE.md says); Codex and the lenses reviewed it.

## Probe
T8, 2026-10-28, from the branch at 71e89a2b, nothing installed and nothing written to his machine:
- `stack` on a scratch home (`mktemp -d`, outside the repo) with only a copied `node` on PATH: 6 installs and 4 own
  steps; engram, engram-plugin, codegraph (installed, claude, codex) and context7 (claude, codex) each with its own
  command and undo; no gentle-ai row; the home held only the `bin/` the probe made. A first run with node's own
  folder on PATH found codegraph there (`/c/nvm4w/nodejs`), so it showed no codegraph install: the reason for the copy.
- `grep -rl gentle-ai bin evals`: `bin/lib/gentle-ai-absence.test.mjs` runs it over the tracked files and passes;
  every file it finds is on its named list, with why.
- `doctor --offline` on his machine, gentle-ai 4.3.1 still installed: the branch exits 0, as the installed copy does;
  against it, the gentle-ai and gentle-ai-sync rows are gone, context7's project cell reads `ok` (it read `n/a`),
  and codegraph's project fix is `codegraph init --yes <root>`; its other gaps are the same in both. Codex's fix
  says `npm i -g` from the branch and `pnpm add -g` from the installed copy: the package manager is the one the
  running copy was installed with (`resolveStackPm`, bin/lib/package-manager.mjs:117), not a change of S11.
- `check` green at each commit (the pre-commit hook); the full tests run on GitHub at each push.

## Next step
#627 and #628 landed (main 170e09dd). Drafts: #629 (PR 3, f8-s11-reviews, base main) and #632 (PR 4,
f8-s11-sweep, base f8-s11-reviews, which merges PR 3 in), each reviewed by Codex, the lenses and gentle-ai
(Reviews); T1-T8 done, T5 by his answer to question 104 (L14). Next: the absence list drops the files that no
longer name gentle-ai, then both PRs are announced ready. Open, his: whether to apply S11 to his machine (`stack
install` on his real home), asked through the lead.

## Log
- L1 (2026-10-28, the brief from JH ORQ, `briefs/2026-10-28T10-57-44-850Z-c751a8fa.md`): "JH 68 · F8 S11:
  js-harness takes over the complements ... Goal: carry out S11 as the diet defines it. - The stack's engram,
  engram-plugin, codegraph and context7 rows install and register with their own commands. context7 is required
  and on (G11). - The presets of G14 (complete, lean, custom; lean has no codegraph). Row 17: a preset gets no
  lines naming a tool it leaves out, with a test per preset. - The gentle-ai and gentle-ai-sync rows and the
  install watch in gentle-ai-update.mjs leave. - The sweep of bin/ and evals/. The block arms become historical
  fixtures, named in a list. - Row 11: js-harness writes no engram text of its own, and a doctor row flags an
  engram binary and plugin that serve different protocol versions, with two fixtures ... Never run a real install
  on his machine ... Do not edit [bin/lib/guard.mjs, bin/lib/lens-reviews.mjs, bin/lib/codex-reviews.mjs]".
- L2 (2026-10-28, evidence: the map of `grep -rl gentle-ai bin evals`, 129 files, by a read-only explorer, checked
  against `bin/lib/stack.mjs` and `bin/doctor.mjs`): there is **no idea watch** in the code (S9 builds it after
  S2), so the pass line's first class is empty; the mentions that can stay are historical fixtures (the S0-S10
  eval results, the block arms), license notices (`bin/lib/lens-prompts.mjs`, MIT; `bin/lib/ported-skills.mjs`,
  Apache-2.0, printed into the shipped skill), tests that assert absence, and the files JH 69 owns
  (`bin/lib/guard.mjs:369-410`, the `reviewBaseRefusal` of `gentle-ai review --base`, and a comment in
  `bin/lib/codex-reviews.mjs:6`). Functional dependencies: the gentle-ai row and its probes
  (`bin/lib/stack.mjs:124-205,306-336`), engram's and codegraph's fixes through gentle-ai (`:347-350,391`), the
  installer step (`bin/lib/stack-install.mjs:57-66,120-134`), the gentle-ai-sync row (`bin/doctor.mjs:224-236`,
  `:422-434`), the merge door's evidence (`bin/merge-queue.mjs:310-333`, after the Codex and lens records it
  already demands), the pull-request body line (`bin/lib/pull-request.mjs:16`), the review-starts row
  (`bin/lib/throughput.mjs:515`), shipped text (`bin/lib/manifest.mjs:253`, `bin/lib/protocols-skill.mjs:61,64`,
  `bin/lib/project.mjs:388`) and the evals (`evals/arms.mjs:23-47`, `evals/home.mjs:279`, `evals/suite.mjs:353`,
  `evals/review/compare.mjs:453`).
- L3 (2026-10-28, evidence, engram v3.6.0's own source, read-only from the marketplace clone,
  `internal/setup/setup.go:985-1060,1158-1215`): `engram setup claude-code` runs `claude plugin marketplace add
  Gentleman-Programming/engram`, `claude plugin install engram`, and then `claude mcp add --transport stdio --scope
  user engram -- <absolute engram path> mcp --tools=agent`, which it refuses to overwrite when an entry with
  another command is there; it needs `jq` and `curl` on the PATH. Its README installs the binary from GitHub
  Releases (`brew install gentleman-programming/tap/engram` on a Mac). gentle-ai registers the same `mcp
  --tools=agent` (`internal/components/engram/inject.go:94`).
- L4 (2026-10-28, decision, the lead's call within S1): engram's binary and its Claude Code side are **his
  steps**, named with engram's own commands and their undo, never run by `stack install`: the binary has no
  package manager here, and `engram setup claude-code` writes three things (a marketplace, a plugin, an MCP entry
  whose command is the binary's absolute path), so a registration of ours with another command would make it
  refuse its own. Engram's Codex side is `engram setup codex`, his step too. codegraph stays runnable as it is,
  its project fix becomes `codegraph init`; context7 becomes required, its two registrations runnable with exact
  undos (`claude mcp remove -s user context7`, `codex mcp remove context7`).
- L5 (2026-10-28, evidence, the Claude Code docs, `mcp.md` and `settings.md`, by a docs reader): a user-scope MCP
  server is turned off for one project by `/mcp`, which writes `disabledMcpServers` into `~/.claude.json`; no
  settings key turns a user-scope server on for a project (`enabledMcpjsonServers` is for `.mcp.json` servers).
- L6 (2026-10-28, decision, within S2): "`init` enables context7" is read as: `init` writes nothing outside the
  repository, so it does not write `~/.claude.json`; it names context7 as required when the machine lacks it, and
  `doctor`'s context7 row turns its `project` cell into a gap where `~/.claude.json` turns it off for the project
  (the "flags a project with context7 off" of S2). A committed `.mcp.json` was weighed and left: it would shadow
  the user registration in every clone and ask the folder's trust first (L5).
- L7 (2026-10-28, decision, within S4): the `gentleAi` record the gentle-ai-sync row kept in
  `~/.js-harness/doctor.json` is read as nothing and drops at the next write of the cache, with no migration: it
  was a cache of a row that left, regenerable and read by nothing else. The doctor tests that used gentle-ai as
  their sample looked-up tool use engram (GitHub releases) or the Codex CLI (npm) instead, and the list-fix tests
  use the engram plugin behind its binary's tag, the one list fix left.
- L8 (2026-10-28, evidence and decision, within S4): the first gate of the commit that drops the gentle-ai row
  failed on GitHub Actions (run 40687865647): `evals/suite.mjs` read that row for the eval stack's `gentleAi`
  field, 9 tests of `evals/suite.test.mjs`. The field leaves the stack a run records and compares; a results file
  recorded before keeps its `gentleAi` key, unread, so an old run resumes on a machine without gentle-ai.
- L9 (2026-10-28, decision, within S2 and S3): `init --preset complete|lean|custom` is optional; with none, `init`
  writes the `harness.json` it wrote before, with no `"functions"`, so no project changes by this slice. A preset
  writes its `"functions"` (`PRESETS`, `bin/lib/functions.mjs`): every one declares `codexReview` and `lensReview`
  `on`, since no preset drops a review; `lean` adds `codeMap: "off"`, so `init` runs no `codegraph init`; `custom`
  starts from complete and takes `--codegraph on|off` (`codeMap` `on-demand` or `off`) and `--engram-plugin on|off`,
  a new switch `engramPlugin` (`auto` is on) that hides the engram-plugin row where off; either choice with another
  preset, or without one, is a usage error that writes nothing. context7 and engram have no switch: every preset
  holds them (G11), and a preset prints that context7 is required where `~/.claude.json` has it nowhere (L6). The
  row-17 test reads the files `init`'s manifest lists; the settings key that silences codegraph's prompt hook in a
  lean clone (`env.CODEGRAPH_NO_PROMPT_HOOK`) stays, since it is what keeps a machine-wide codegraph out of it, and
  it lives in the clone's own `.claude/settings.local.json`, no committed file.
- L10 (2026-10-28, decision, within S6): the "doctor row" of row 11 is the engram-plugin row, not a new one: its
  latest is already the plugin the engram binary's own tag ships (odd/tasks/engram-plugin-lag.md), so a plugin
  behind it is `outdated` (the fixture that was there) and one ahead of it is now `mismatch`, whose fix updates the
  binary; the two fixtures are those two `doctor` tests. "Writes no engram text of its own" is held by a test over
  every shipped component, the rules block and `init`'s templates, which finds no `mem_*` tool name and no save
  rule. The js-harness skill's "When Engram fails" stays: it is js-harness's own backup and its restore, not
  engram's protocol or its context recovery (searched: `grep -rln "mem_save|mem_search|mem_context" bin`, only
  test files and evals fixtures).
- L11 (2026-10-28, decision within S5, and one question that is his): the merge door and `notify --kind ready` stop
  asking for a gentle-ai line in the pull request's body and on the feature document (`bin/lib/gentle-ai-evidence.mjs`
  leaves); they ask for what the project's switches ask, a Codex record where `codexReview` is on and a complete lens
  record where `lensReview` is on, as before. T5 splits: PR 3 holds that and the shipped text; the review starts the
  pause hook keeps and their `throughput` row (`bin/lib/review-starts.mjs`, reaching `install`, `resume` and
  `throughput`) go in a slice after it. **Open, his:** the line of `init`'s `AGENTS.md` block "Where the Codex review
  is off (`js-harness functions`), gentle-ai's assessment decides when a change is reviewed" is his answer to
  question 4 of odd/tasks/on-demand-functions.md (N6, 2026-10-24); with gentle-ai gone, what reviews a change in a
  project whose Codex review is off is his to say. Asked through the lead as question 104 (2026-10-28); until he answers, that line
  and its two tests stay, and PR 3 is not announced ready.
- L12 (2026-10-28, decision within S5): the plan of the sweep, from a read-only map of every file of `bin/`, `evals/`
  and `scripts/` that names gentle-ai (111 files; `grep -rliE 'gentle-ai|gentle_ai|gentleai'`, since the camelCase
  `gentleAi` and `GENTLE_AI_TELEMETRY` escape the plain grep). The diet says gentle-ai leaves his machine only at
  S2, after S11 and S12 (harness-diet.md:1339), so what guards his machine while it is there stays: the eval homes'
  copy of `~/.gentle-ai/state.json` and the isolation probes' watch of `~/.gentle-ai`, the block arms and their
  marker parser (`evals/arms.mjs:23-47`, `evals/without.mjs:182-232`), `GENTLE_AI_TELEMETRY`, and `init`'s
  `.atl/` exclude (`bin/lib/project-exclude.mjs`) all become historical fixtures named in the list, each with S2 as
  the step that retires it. The licence notices stay as the licences require (`bin/lib/lens-prompts.mjs` MIT,
  `bin/lib/ported-skills.mjs` Apache-2.0) and are named. What goes: `evals/review/compare.mjs` runs
  `codegraph init` itself instead of `gentle-ai codegraph init`; `rules-change-run`'s cost line and `summary`'s
  placeholder stop naming gentle-ai; about 60 comments and test titles are rewritten or lose the name; six test
  fixtures that use gentle-ai as an arbitrary id take a neutral one. The guard's refusal of a `gentle-ai review`
  base (`bin/guard.mjs`, `bin/lib/guard.mjs`, `bin/lib/codex-reviews.mjs`, their tests and `js-harness.mjs`'s guard
  help) is JH 69's surface: named in the list until the lead says otherwise, asked through it. `bin/lib/
  gentle-ai-absence.test.mjs` holds the list and fails on a file outside it.
- L13 (2026-10-28 09:45, the lead, a notice on the channel): "the guard's gentle-ai review-base refusal stays until S2.
  gentle-ai still reviews here until then, and the refusal is a guard (high risk), so JH 69 keeps its scope. Name those
  files in S11's allowed list". S2 removes the refusal with gentle-ai (`bin/guard.mjs`, `bin/lib/guard.mjs`,
  `bin/lib/codex-reviews.mjs`, their tests, and `bin/js-harness.mjs`'s guard help line).
- L14 (2026-10-28 22:59Z, his answer to question 104, tapped on the board, read with `js-harness sessions --quote
  0f71b2c6-cbce-43ca-a031-276a4b2c381f 11879`): "Las lentes Claude (Recomendada)", the option that read "Donde Codex
  está apagado, la revisión de lentes queda encendida: la línea dice eso y la puerta de merge exige su registro."
  So `init`'s `AGENTS.md` block says "Where the Codex review is off (`js-harness functions`), the Claude lens review
  stays on: the merge door asks for its record before a change lands", in place of his answer to question 4 of
  odd/tasks/on-demand-functions.md, and `lensDoor` asks for a complete lens record of every code commit whose own tree
  turns the Codex review off, even with `lensReview` off (`whereCodexOff`). The push rows do not change: his answer
  S9 there lets a push through with the Codex review off, and the door is where the record is asked. The block's
  bytes move, so a project whose block is unedited gets it rendered again on its next sync, which git undoes, and an
  edited one is kept (`syncTemplateBlock`).
