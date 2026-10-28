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
- [ ] T3 (kind: build) presets: `init --preset`, the `engramPlugin` switch, the context7 project row, and a test
  per preset — S2, S3; inline; PR 2
- [ ] T4 (kind: build) row 11: a test that nothing js-harness writes carries engram's protocol, and the
  `engram-protocol` doctor row with its two fixtures — S6; inline; PR 2
- [ ] T5 (kind: build) the review sweep: the merge door's gentle-ai evidence, the pull-request body line, the
  review-starts row and the shipped text that sends a session to gentle-ai — S5; inline; PR 3
- [ ] T6 (kind: build) the evals sweep: the block arms and the state copies as historical fixtures, named in a
  list — S5; inline; PR 4
- [ ] T7 (kind: build) the comment sweep and `bin/lib/gentle-ai-absence.test.mjs`, the named list — S5; inline;
  PR 4
- [ ] T8 (kind: verify) the probe in a scratch home, and `doctor` read on his machine — S7; inline

Reviews:
- Codex: ac0725d..cea68ea, 6 parts, all passed (828,730 input tokens), one P2 taken: the Codex undo of engram
  removes the instruction settings an older engram or gentle-ai set before it deletes the files (fix commit after
  cea68ea1); Codex cea68ea..28acfb5 passed (the P2 fixed). Lenses risk, reliability, readability over d2bc8ab..28acfb5: 0 findings.

## Probe
Not run yet.

## Next step
PR 1 (branch f8-s11-complements, worktree .claude/worktrees/f8-s11): reviewed; push, open the PR, notify the
orchestrator ready --pr. Then T3 (init --preset; lean writes functions.codeMap off; an engramPlugin
switch; the row-17 test scoped to the text files init writes) and T4 (extend the engram-plugin row: a plugin
ahead of its binary's tag is mismatch; fixtures behind and ahead; an absence test of mem_* text in shipped files).

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
