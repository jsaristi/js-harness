## Goal
F8's S7 lands: the lead is cut at a phase's close or after its second compaction, a sub-agent that writes code starts
from a small, fixed context (its own agent type, `omitClaudeMd`, the model the rules give), and every writer's brief
names the `S#` it covers and its return says which it covered.

## Why
The old lead ran to 85 MB with 16 compactions and its incidents clustered after compactions (the diet's section 6);
today's lead is at 124 MB and 28 compactions. A sub-agent that writes code carries every instruction file and tool
definition into its first turn, which the Haiku 5.5 guide says makes it stop early. A writer whose return does not say
what it covered leaves the lead to guess what was done (the reverse-engineering document, 13.3 row 9).

## Done when
- `node --test bin/loop.test.mjs bin/loop-bodies.test.mjs bin/lib/manifest.test.mjs bin/lib/protocols-skill.test.mjs bin/lib/writer-agent.test.mjs` exits 0
- `npm run check` exits 0
- the probe of five writer runs, recorded in the Log with its commands: each first turn at most 30k tokens
- five writer slices, recorded in the Log: at most one unrequested file in all, each return naming its `S#`
- `js-harness notify --to orchestrator --kind ready --pr <n>` records the notice

## In scope / Out of scope
- In: `bin/loop.mjs` and its tests, `bin/loop-bodies.test.mjs` among them (the heartbeat's cut line), the orchestrator skill and the protocols skill
  (`bin/lib/manifest.mjs`, `bin/lib/protocols-skill.mjs`) and their tests, a new `.claude/agents/js-harness-writer.md`
  with the test that holds it to the rules, `docs/ROADMAP.md`'s S7 entry, `docs/SPEC.md`'s S7 row, this document.
- Out: `bin/check.mjs`, the contracts and `bin/conventions-*.test.mjs` (S4b's, JH 158, running beside this);
  `init` and `install` shipping the agent type to other projects (the model rules are of this repository only, his
  answer of 2026-10-14, `odd/tasks/honesty-audit.md` S5); his `~/.claude`, `~/.codex` and credentials; merging (the
  lead's, after his yes).

## Constraints
- The writer's model and effort have their home in `rule:subagent-writer-model` and `rule:subagent-effort`; the agent
  file keeps a copy because the host reads only the file, and `bin/lib/writer-agent.test.mjs` fails until a change of
  either rule edits the file in the same commit — because a value has one home (`AGENTS.md`), and a copy no check
  holds drifts.
- A running session does not see a first agent file in a new `.claude/agents/` folder until it restarts
  (code.claude.com/docs/en/sub-agents, "Claude Code watches") — so the probe runs in new headless processes, and the
  lead's sessions pick the type up when they next start.
- Every sub-agent at the effort `rule:subagent-effort` gives — because it is his rule.

## Ask me before
- The writer's model for the five slices: Sonnet 5.5 as the plan wrote, or Haiku 5.5 as his rule says (question 227,
  answered Haiku, L3). Everything else is inside the plan he approved; merging is his yes through the lead.

## Depth pass
- 1. Method: context engineering for agent hand-offs, to the standard of Anthropic's sub-agent docs and the 5.5 model
  guides: a worker gets the smallest fixed context that does its job (its own system prompt, the tools it needs, no
  instruction files it cannot use), a brief that states scope and the unit it covers, and a return the parent can
  check; a long-running coordinator is replaced from files before its summaries drift. The smallest change that meets
  it: one project agent type for writers (frontmatter only: `model`, `omitClaudeMd`, `tools`, `effort`), one line in
  the protocols skill's hand-off section, the relief rule of the orchestrator skill moved from "only on request" to
  the cut, and one heartbeat line that says when the cut is due. Searched first: `js-harness rules` (the three
  sub-agent rules, `lead-charter`), the skills' text (`bin/lib/manifest.mjs:219-231`, the relief section;
  `bin/lib/protocols-skill.mjs:100-102`, the hand-off), `bin/lib/guard.mjs:16-36` (a call's `model` is held, an agent
  type's own model passes), `bin/lib/rules-block.mjs:43-50` (his Delegation lines, word for word, not ours to change),
  and the components `install` writes (`bin/lib/manifest.mjs:273-300`, no agent type among them).
- 2. Raw material:
  - the plan: `docs/ROADMAP.md:685-692` (S7); `docs/proposals/harness-diet.md:432-438` (routing: Sonnet for bounded
    writers with the guide's damping paragraph, Haiku keeps scoped code with `omitClaudeMd`), `:452-457` (the cut, "a
    hypothesis, not a finding"), `:1298-1301` (S7's Haiku line may be met by S2 alone; restate it once S2 measured);
    `docs/proposals/gentle-ai-reverse-engineering.md:954` (row 9).
  - his rules: `subagent-writer-model` = `claude-haiku-5-5`, "si pero solo para codificar quiero el haiku"
    (2026-10-10, session `182ad401`, line 990); `subagent-reader-model` = `claude-opus-5-5`; `subagent-effort` =
    `high` (`js-harness rules <id>`). The relief "only on request" was the lead's call, not his
    (`odd/tasks/session-channel.md:1869`, 2026-10-15 05:44, "no question to him").
  - the records: first assistant turn of every sub-agent transcript of this project over 14 days (input + cache
    write + cache read, read-only, scratch script outside the repo): Opus sub-agents 36.9k-38.9k until 2026-11-04,
    49.9k-51.4k since 2026-11-05; Haiku sub-agents 25.5k-52.7k, the latest 49,602 (2026-11-08T22:34, another
    session); a `general-purpose` Haiku sub-agent launched from this session, 35,683 (22:44Z).
  - the lead: transcript `0f71b2c6`, 124,276,533 bytes, 28 `compact_boundary` entries (`grep -c`, 2026-11-08).
  - the docs (code.claude.com/docs/en/sub-agents, fetched 2026-11-08): `omitClaudeMd` drops "the user, project, and
    local CLAUDE.md files" (AGENTS.md with them) from v2.1.271; an agent type's `model` takes a full id, an Agent
    call's `model` only an alias; `tools` narrows the pool; a new agents folder needs a restart. Here: 2.1.319.
- 3. The bar:
  spec 1: `node --test bin/loop-bodies.test.mjs`: none, new behaviour; today the heartbeat says nothing of the lead's
  compactions or of a phase that closed, and the skill gives the opening prompt "only when the user asks for a new
  lead" (`bin/lib/manifest.mjs:222`).
  spec 2: `node --test bin/lib/writer-agent.test.mjs`: none, new behaviour; today a writer is a `general-purpose`
  sub-agent with `model: "haiku"`, first turn 35,683 here and 49,602 in another session; the probe (T5) is the
  measure.
  spec 3: `node --test bin/lib/protocols-skill.test.mjs`: none, new behaviour; no shipped text asks a writer's brief
  for its `S#` or its return for what it covered (`grep -rn "S#" bin/lib/protocols-skill.mjs bin/lib/manifest.mjs`:
  nothing); the five slices (T6) are the measure.
- 4. Refutation: the plan's own doubt (diet `:1298`) was that S7's 30k line might already hold, or that `omitClaudeMd`
  alone would not move it. Three headless runs in this worktree (`claude -p --model haiku --agents <file>`, the main
  thread told to delegate once to `probe-helper` with "Reply with the single word OK."), first turn of the sub-agent
  from its transcript: no `omitClaudeMd`, 22,181; `omitClaudeMd`, 16,260; `omitClaudeMd` and `tools` narrowed to
  Read, Grep, Glob, Edit, Write, Bash, 6,361 ($0.020 for the three; sessions `daa36a1c`, `9e1f2d9c`, `0fba5a14`).
  The same host's `general-purpose` Haiku launch, same worktree and prompt, after the double review asked for it:
  21,468 (session `e26c35a3`). So in headless mode the 30k line already holds without S7, as the diet's `:1298`
  feared; the launches over it are in the app's sessions (35,683 from this background session, 49,602 from another),
  where more tools ride along. Narrowing the tools removes the largest part that varies by host (MCP and app tools);
  it does not bound the brief, which T6 measures with real briefs, nor prove the same figure on every host. The
  request holds as a cut of about 68% in the measured configuration (21,468 to 6,881), with the agent type and its
  tools as the means rather than `omitClaudeMd` alone; the app-session figure for the type is owed (L8). The cut has
  no measure in the plan's pass line; it is tested as behaviour here and stays a hypothesis for S8.
  Verdict: supports
- 5. Request: give writing sub-agents a project agent type, `js-harness-writer`, on the model of
  `rule:subagent-writer-model` at the effort of `rule:subagent-effort`, with `omitClaudeMd` and six tools, whose own
  prompt carries what it loses with the instruction files (tests first, the allowed edit surface, nothing unrequested,
  a real check, the `S#` it covered in its return); write into the protocols skill that a writer's brief names its
  `S#` and the return says which it covered; move the orchestrator skill's relief from "only on request" to the cut
  at a phase's close or after the second compaction, and have the heartbeat end with a `CUT:` line when the
  compactions make it due, once per count even across relaunches; a phase's close is the lead's own step, the turn it
  shows `js-harness report phase`'s page, so the skill alone carries that half;
  prove it with five first turns at most 30k and five writer slices with at most one unrequested file, each naming its
  `S#`. The plan's "Sonnet writer" is asked (L3), since his rule gives Haiku.
  Adds: none

## Specs
1. "the lead cut at a phase's close or after two compactions" (the plan, `docs/ROADMAP.md:686`), started by his
   "Listo continuemos con todo lo siguiente" (lead transcript `0f71b2c6`, 2026-11-08 ~17:40 local, through the brief).
2. "Haiku 5.5 helpers with `omitClaudeMd`" (`docs/ROADMAP.md:686-687`); probe: "the first turn of five Haiku
   sub-agents at most 30k" (`:689`).
3. "Sonnet writer prompts whose brief names its `S#` and whose return says which it covered (13.3 row 9)"
   (`docs/ROADMAP.md:687-688`); probe: "at most one unrequested file in five Sonnet writer slices, each naming its
   `S#`" (`:689-690`).

## Tasks
- [ ] T1 (docs) this document with its depth pass; the writer-model question recorded and sent to the lead.
- [x] T2 (build) S2: `.claude/agents/js-harness-writer.md` and `bin/lib/writer-agent.test.mjs` holding it to the rules.
- [x] T3 (build) S3: the hand-off line in the protocols skill, with its test.
- [x] T4 (build) S1: the heartbeat's `CUT:` line and the orchestrator skill's relief rule, with their tests.
- [x] T5 (verify) S2: five headless writer first turns, at most 30k each, recorded here (L5).
- [x] T6 (verify) S3 (L10): five writer slices, at most one unrequested file in all, each naming its `S#`, recorded here.
  The named reason for delegating them is the plan's probe itself. Each runs in a scratch clone of this branch outside
  the repo, reset between slices, delegated once by a headless main thread to the writer type with a brief of its `S#`,
  its task, its `## Allowed edit surfaces` and its check: S1 a new `clamp` module and its test; S2 one
  `compactionsIn` test in `bin/loop-bodies.test.mjs`; S3 one test of the writer's description in
  `bin/lib/writer-agent.test.mjs`; S4 a new `byteSize` module and its test; S5 one test of section 6 in
  `bin/lib/protocols-skill.test.mjs`. Unrequested means a path in `git status --porcelain --untracked-files=all` of the
  clone after the slice that is not on its surface; names its `S#` means the sub-agent's own last reply, read from
  its transcript, opens `Covered: S<n>` or `Covered: part of S<n>`. Both per slice go in the Log.
- [x] T7 (docs) the roadmap's S7 state and SPEC's row; reviews; the pull request.

## Log
- L1 The brief (2026-11-08T22:33Z): "F8 S7: topology and routing. His words (lead transcript 0f71b2c6, 2026-11-08
  ~17:40 local): "Listo continuemos con todo lo siguiente". S7 runs beside S4b (JH 158) [...] stay off those files".
- L2 Where the writer type lives, decided here: in this repository's `.claude/agents/`, committed, not written by
  `install` or `init` into other projects, because the model rules are of this repository (`scope: repository`) and a
  project that installs the harness gets nothing turned on by default. The orchestrator skill stays generic.
- L3 Question to the lead for him (recorded before it is sent): the plan names Sonnet 5.5 writers, his rule gives
  Haiku 5.5 to a sub-agent that writes code, and the guard refuses `model: "sonnet"` on a call here. Recommended: keep
  Haiku (his words of 2026-10-10; `odd/tasks/subagent-model-routing.md:598`, same score as Opus at 58% less; Sonnet's
  price is 20 times Haiku's per token, diet `:424-426`), and run S7's five writer slices on `js-harness-writer`. The
  other option changes his rule to let a bounded writer run on Sonnet 5.5, as the diet's starting choice proposed.
  Sent as question 227 (2026-11-08T22:5xZ); T6 waits on it, the rest goes on. Answered: he tapped "Seguir con Haiku
  (Recomendada)" (the lead's transcript `0f71b2c6`, line 75063, 2026-11-08T23:19:50Z, recorded `verified: true` in
  the channel); his rule stays, and T6 runs on `js-harness-writer`.
- L4 Commits held: the lead's message (2026-11-08, JH ORQ) says `check`'s `hook entries` row refuses every commit on
  this machine since the engram plugin 0.1.22 added a hook; JH 153 fixes the table. Built uncommitted until that lands,
  then origin/main is merged in.
- L5 T5, the probe (2026-11-08, 23:0xZ): five headless sessions in this worktree (`claude -p --model haiku`, each told
  to call the Agent tool once with `subagent_type js-harness-writer` and a read-only S1 brief with its `## Allowed edit
  surfaces`), the sub-agent's first assistant turn read from `subagents/agent-*.jsonl` (input + cache write + cache
  read): 6,998, 6,881, 6,881, 6,881, 6,881; each `agentType: js-harness-writer`, model `claude-haiku-5-5`, and each
  return opens `Covered: S1`. $0.025 for the five. Predicted 5 of 5 under 30k (item 4), measured 5 of 5. Not measured:
  a desktop session's launch of the type, since a running session needs a restart to see a new agents folder.
  Reproducible from: Claude Code 2.1.319; sessions `826e4dcc`, `2c0b369b`, `5d286554`, `7a69c74b`, `1c0a7f21` under
  `~/.claude/projects/D--js-harness--claude-worktrees-f8-s7-topology/<session>/subagents/` (agent ids `add6dcfe…`
  onward in each `agent-*.jsonl`, the type in `agent-*.meta.json`); the brief, verbatim: "S1: say how many lines
  bin/lib/writer-agent.test.mjs has, and change nothing. / ## Allowed edit surfaces / - none: this slice reads only. /
  Check: `node --test bin/lib/writer-agent.test.mjs`."; the figure is the first `type: assistant` entry's
  `usage.input_tokens + cache_creation_input_tokens + cache_read_input_tokens`; the cost is each run's
  `total_cost_usd`. The scratch scripts that ran them stay outside the repo; this line is what reproduces them.
- L6 T4: `compactionsIn` over the lead's transcript `0f71b2c6` gives 28, the same as `grep -c compact_boundary`,
  in 1.5 s for 124 MB on the first read; later ticks read only what was appended. The lead's first heartbeat after
  this lands ends at once with `CUT:` (28 compactions) and keeps the mark, so its relaunches name it and wait.
- L7 The plan's double review (read `26428e35`, 2026-11-08; Claude 12 findings, Codex 7). Taken: Claude 1 (the host
  reads `effort` from the file: a scratch agent with `effort: low # a trailing comment` ran at `low`, session
  `7d953f83`, `"effort":"low"` 3 times in its sub-agent record; the comments moved to their own line anyway), 2 (the
  headless `general-purpose` baseline, 21,468, restated in item 4 and the roadmap), 3 and Codex 1 and 7 (a cut due at
  a heartbeat's start now ends it once, kept by a mark; the phase-close half is stated as the skill's), 4 and Codex 6
  (the Done-when runs `bin/loop-bodies.test.mjs`), 5 (the copy of the two values is stated and its test says what to
  edit), 6 and Codex 4 (the writer prompt now asks for the S# and surface, a search before adding, no dependency,
  nothing outside the repository, scratch outside it, and the brief's closing block), 7 (T6's slices and its count
  are defined), 8 (the protocols line says what to launch where the type is not seen), 9 (L9), 10 (each duty has a
  phrase in the test), 11 (the agent file is added by path, `.claude/settings.local.json` stays out); Codex 2 (a
  worktree session's transcript is found under its own folder, tested), 3 (L5 now names its sessions, brief and
  arithmetic), 5 (item 4 limits the claim to the measured configuration). Not taken: Claude 12, the 124 MB read at
  start is 1.5 s once per relaunch, kept as the reviewer judged acceptable; it is read in chunks if it grows.
- L8 Owed: the type's first turn in an app session, once the lead's sessions restart on a main that has the type.
- L9 Why the protocols skill and not the orchestrator skill, as 13.3 row 9 wrote: every session that delegates loads
  the protocols skill's hand-off section, a work session as well as the lead, while the orchestrator skill reaches
  only the lead; a writer is delegated by whoever builds.
- L10 T6 (2026-11-09, the lead's one rerun after the host killed the first for low memory): the scratch clone at
  `8e34981d`, `node <job tmp>/slices.mjs <job tmp>/clone`, exit 0. Per slice: unrequested files, the return's head,
  the sub-agent's first turn (input + cache write + cache read) and the session: S1 0, `Covered: S1`, 6,772,
  `7be3dc32`; S2 0, `Covered: S2`, 6,761, `ae6f5490`; S3 0, `Covered: S3`, 6,720, `2091f3b6`; S4 0, `Covered: S4`,
  6,805, `85cf68bb`; S5 0, `Covered: S5`, 6,726, `89409387`. In all: 0 unrequested files, 5 of 5 returns naming their
  `S#`. Each sub-agent's `meta.json` says `"agentType":"js-harness-writer"`, model `claude-haiku-5-5`. The CLI's
  `total_cost_usd` was $0.0096 to $0.0125 a slice, notional inside his plan. Not checked by the runner: whether each
  slice's own check passed; the returns state it, and nothing builds on those scratch files.
- L11 The reviews of `71b50d3..78aec0e` (2026-11-09). Codex, 1 finding, taken: the cut mark `cut-<session>.json` sat
  in the loops folder, whose every `.json` entry `readRecords` (bin/lib/loops.mjs) lists as a loop, so `loop status`
  would show it as unreadable; it moves to `cuts/<session>.json`, and a test reads the folder through `readRecords`.
  Lenses (reliability, readability, resilience): reliability 2, readability 1, resilience 0. Taken: reliability 2,
  a transcript unread at the start and readable later re-told a cut the mark held; the tick now compares with the
  mark too, with a test. Answered, not taken: reliability 1 and readability 1 (the agent file is absent from the
  range): it is in `b48111f8` (`create mode 100644 .claude/agents/js-harness-writer.md`); the lenses leave Markdown
  out of the range, so they did not see it.

## Next step
- State (2026-11-09 ~02:55Z): PR 794 ready, reviews recorded and answered (L11), `npm run check` PASS. Next: the
  lead merges after his yes; L8 (the type's first turn in an app session) is owed after a restart on that main.
