# Effort by task

Locator: `odd/tasks/effort-by-task.md` · Engram mirror: `odd/effort-by-task/tasks` · Branch:
`docs/effort-by-task` (the design; the build gets its own branch) · Session: `JH 13 · esfuerzo y
subagentes`, opened by the orchestrator on 2026-10-14 with T13, T14 and T15 of
`odd/tasks/session-channel.md`. Test runner: `node --test`. Delivery: `ask-on-risk`.

## Goal
Each task of a feature runs at the effort and with the sub-agent models its kind of work calls
for, the harness says which and shows what really ran, and a day's sub-agents are counted by
kind, model, effort and tokens.

## Why
A feature holds design tasks and build tasks, and today one `## Effort` covers all of them
(`bin/lib/contract.mjs:25-32`); nothing applies it and nothing prints it (`bin/contract.mjs:287-295`).
Sub-agents were about 59 percent of a day's tokens (the orchestrator's count of 2026-10-11, not in
a file), so what to measure next and how many to launch should come from a count, not a guess.
His words: "siempre dime en que modo de esfuerzo debemos trabajar dependiendo de lo que hagamos"
(2026-10-11, in `docs/model-effort.md`).

## Done when
- `node --test bin/contract.test.mjs bin/lib/contract.test.mjs bin/subagents.test.mjs bin/lib/subagent-count.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/effort-by-task.md` exits 0
- `npm run check` exits 0
- `js-harness contract goal` on this document names each open task's kind, effort and writer model
- `js-harness subagents` on a real day of this project prints its launches by kind, model and
  effort with their tokens, and the share of the day's tokens they took

## In scope / Out of scope
- In: the kind of a task in a feature document's checklist; the contract's parser, validator and
  `goal`; the session-start hook's line on mode; a new `subagents` command and its library.
- Out: the rules list (`bin/lib/rules-data.mjs`, `bin/rules.mjs`, JH 7's: its rows are asked of
  JH 7); the check row comparing what ran with the table (JH 7's T13 of the rule hierarchy, "one
  check"); the orchestrator skill's text (JH 5's T8); `bin/sessions.mjs` (JH 5's); his settings.

## Constraints
- Zero dependencies, plain Node — because `bin/` runs in any host without an install step.
- Nothing is forced on a session without a lead — because the harness ships to projects whose
  host, terminal or Codex has no effort tool; it prints the mode, it does not set it.
- The records are read with bounded reads — because a day's transcripts are hundreds of megabytes.
- No gate turn until the WSL gate is on `main` (the orchestrator's opening, his order ffe99ebf
  line 1647); documents-only commits until then.

## Effort
high

## Ask me before
Which kinds of work may run below high, and at which level; spend outside the plan; anything
installed or changed on his machine.

## Specs

Copied verbatim from `odd/tasks/session-channel.md` (lines 1153-1175 on `main` d3f6ac1), where
JH 5's feature held them until the orchestrator moved them here on 2026-10-14.

- **S1** (T13 there): "Effort by task, not by document (B2 of the proposal "Model and effort by
  kind of work", version 2; his "Sí, que entre al plan" of 2026-10-11, Progress 22:25). Today a
  contract holds one `## Effort` for a whole feature (`bin/lib/contract.mjs:25-32`) and a
  feature has design tasks and build tasks. Each task of the checklist names its kind of
  work; its effort and the model of its writer follow from the table, whose home is the
  rules list of JH 7 and not this feature; `js-harness contract goal` prints them. It waits
  for that table to be on `main`"
- **S2** (T14 there): "The effort applied and checked (B3). High is the default; a lower level
  ends with its task, and a design question inside such a task goes back to high first. With a
  lead in the desktop app, the lead sets the session's effort with the app's tool, from the
  session's next turn. Without one (an installed project, the terminal, Codex) the shipped
  session-start hook and `contract goal` print the mode the task calls for, and nothing is
  forced. In both, a row of `check`, INFO, compares the level a task ran at, and the model
  and effort of its sub-agents, with the table, read from the sessions' records. For the
  design, found by the lead's reader and not for this feature to change: `js-harness remote`
  starts a session with no model or effort (`bin/lib/remote.mjs:88`), so one opened from the
  phone takes the default of his settings. Before a session's mode is changed, the state of
  its task is read (the lead's rule, a note of its relief file today). The check is JH 7's,
  one with task 13 of the rule hierarchy; this feature keeps the applying half"
- **S3** (T15 there): "A count of a day's sub-agents by kind (writer, explorer, reviewer,
  verifier), model and tokens, read from their records (C1): it costs nothing to run, and it
  decides what is measured next and the working rule on fewer launches"

The orchestrator's opening words T15 as "model and effort"; the task's text says "model and
tokens". The design counts both.

## Design (version 1, before its readers)

### What exists (an explorer's map, one spot check of the parent)

- `js-harness rules applied` (`bin/rules.mjs:240-263`, `bin/lib/rules-applied.mjs:256`) already
  compares `session-model`, `session-effort` and `subagent-effort` with the records, as
  information, and the sub-agents' aliases with `subagent-reader-model` and
  `subagent-writer-model`, as a failure. It reads a session's last answer and a sub-agent's first
  (`bin/lib/rules-applied-read.mjs:180-239`), keeps model, `effort`, engine and day, and no
  tokens. No `check` row calls it (`bin/check.mjs:1399-1401`); `check` rows are PASS, FAIL or
  INFO, there is no WARN (`bin/check.mjs:1369-1373`).
- The effort a turn ran at is the top-level `effort` of each assistant entry, beside
  `message.model` and `message.usage` (checked: `evals/fixtures/transcripts/probe/d2ddbeb2-….jsonl`
  holds `"effort":"medium","perTurnEffort":"medium"`). A sub-agent's `.meta.json` holds what the
  call asked; the rule hierarchy counts the answer's (`odd/tasks/rule-hierarchy.md:1217-1219`).
- No code reads `input.model` or `input.effort` of an Agent call (`bin/lib/sessions.mjs:344-357`
  reads `subagent_type` and `description`; `rg "input\??\.(model|effort)" bin evals` is empty).
- Per-sub-agent token sums exist only in `evals/transcript-usage.mjs` (`summarizeTranscripts`,
  whole files, no day window); `evals/` does not ship, so `bin/` cannot import it.
- A checklist line is `{ text, done }` (`bin/lib/progress.mjs:15,198`); "T13" is text.
- The session-start hook (`doctor --hook`, `bin/lib/manifest.mjs:167-173`) prints only stack gaps;
  the compaction hook (`resume --hook`) prints the title, opening and feature document, and finds
  the document from the session's own Edit and Write calls (`bin/resume.mjs:212-260`). Neither
  says a word on effort or model.
- The table on `main` (`bin/lib/rules-data.mjs:110-150`) has one effort for every session
  (`session-effort`, high) and every sub-agent (`subagent-effort`, high), and two sub-agent
  models (writer `haiku`, reader `opus`). It has no row by kind of work. `medium` runs only as
  C2's trial, which is not a rule (`docs/ROADMAP.md:62`).

### S1 — the kind of a task

A task line names its kind in a bracket right after its ID: `- [ ] T3 [build] The parser ...`.
The kinds, from table A of `docs/model-effort.md`:

| Kind | Meaning | Session effort | Sub-agents it may launch |
|---|---|---|---|
| `design` | a design, a protocol, a decision to bring him | high | readers (`subagent-reader-model`) |
| `build` | code under a contract whose scope is closed | the `build` row, else high | writers (`subagent-writer-model`) and readers |
| `verify` | verification, review, a measurement | high | readers |
| `docs` | documentation, wording | high (D of the proposal is not decided) | readers |

A task with no bracket takes the document's `## Effort`, so the nineteen documents that state one
keep working unchanged. A bracket that is not one of the kinds is a contract error in `check`
("task T3 names the kind [bild]: one of design, build, verify, docs"). The kinds are a constant of
`bin/lib/contract.mjs`, not rules: they name work, not a value he set.

The table gives each kind its effort through one optional row of JH 7's list per kind that may
differ from `session-effort`: `session-effort-build` is the only one proposed. Absent, every kind
is high, which is today's rule. Asked of JH 7 through the orchestrator: one additive row, and
`ruleValue` reading an absent row as "none".

`js-harness contract goal <doc>` keeps its stdout exactly the `/goal` condition (it is pasted
whole) and prints the modes on stderr, one line per open task:
`T3 [build]: session high, writers haiku, readers opus, every sub-agent at high`.
The same lines come from a new form, `js-harness contract modes <doc> [--task T3]`, which
exits 0 and prints them on stdout, for the hook and the lead to read.

### S2 — applied

- With a lead in the desktop app: the lead reads the task's state, then runs `contract modes
  --task` and sets the session's effort with `set_session_effort` before the task's first turn;
  a lower level is set back to high when the task's box is checked, or first when a design
  question appears inside it. This is text of the orchestrator skill: JH 5's T8. This feature
  hands JH 5 the paragraph and the command it names.
- Without a lead: the session-start hook prints one line when the session's feature document
  and its next open task are known: `js-harness: T3 [build] calls for effort high; writers
  haiku`. It reuses the compaction hook's way of finding the document. Nothing is set.
- The check: JH 7's. What it needs from this feature is `taskModes(markdown)` in
  `bin/lib/contract.mjs`, the open tasks with kind and mode, so that a session's level can be
  compared with the mode of the task it was on.
- `js-harness remote` (`bin/lib/remote.mjs:88`): recorded, not changed here, as S2 says.

### S3 — the count of a day's sub-agents

`js-harness subagents [--day YYYY-MM-DD] [--days N] [--json]`, a new `bin/subagents.mjs` with its
library `bin/lib/subagent-count.mjs`. It finds the records the way `rules applied` does (the main
checkout's folder under `~/.claude/projects`, by `projectSlug` and `mainCheckout`, imported
unchanged) and reads each `agent-*.jsonl` of the day, line by line, never whole.

- Kind: the `agentType` of the meta file first (`Explore` and `Plan` are explorers; `review-*`,
  `jd-judge-*` and `review-refuter` are reviewers); otherwise the first word of the call's
  description when it is one of writer, explorer, reviewer, verifier; otherwise the model: a
  `haiku` sub-agent is a writer; otherwise `other`, printed so the gap is visible.
- Model and effort: of its answers, the first one's, as `rules applied` reads them.
- Tokens: per message id the largest usage seen (a message is written once per content block),
  summed: input, cache creation, cache read, output, kept apart.
- The share: the same sums over the day's main sessions, so the sub-agents' share of the day is a
  number and not the 59 percent of a recap.
- Day: the record's timestamp in local time, unlike `rules applied` (universal time).

Output: one row per kind, model and effort, with launches and each token figure, a total row, and
the share. It never fails for what it finds; it exits 1 only when the records folder cannot be
read.

### Work units

| Task | Kind | Route | Files |
|---|---|---|---|
| T1 design, two readers, version 2 to the orchestrator | design | inline, readers on opus high | this document |
| T2 the kind and `contract modes`, `goal`'s stderr | build | inline | `bin/lib/contract.mjs`, `bin/contract.mjs`, their tests |
| T3 the session-start line | build | inline | `bin/doctor.mjs` or a new hook form, its test |
| T4 `subagents` | build | a Haiku writer for the library, the parent for the command | `bin/subagents.mjs`, `bin/lib/subagent-count.mjs`, tests, the command list |
| T5 hand-offs | docs | inline | messages to the orchestrator for JH 5 and JH 7 |

## Not guaranteed

- A session's level in the middle of a task: the records give each turn's, the check reads the
  last (JH 7's choice).
- A sub-agent's kind when its type is generic and its description says nothing: it counts as
  `other`.
- What the plan charges per model: tokens are counted, not prices.

## Tasks

- [ ] T1 [design] Design read by two readers (one attacks it, one looks for what is missing);
  version 2 and the question of S1's level sent to the orchestrator (route: inline)
- [ ] T2 [build] The kind of a task, `contract modes`, the modes on `goal`'s stderr (S1)
- [ ] T3 [build] The session-start line on the mode (S2, the half without a lead)
- [ ] T4 [build] `js-harness subagents` (S3)
- [ ] T5 [docs] The paragraph and command for JH 5's skill, the row and `taskModes` for JH 7's
  check, handed through the orchestrator (S2)

## Log

- L1 (2026-10-14, the orchestrator's opening, a claim and not his words): "From
  odd/tasks/session-channel.md (read each task's full text there, the proposal "Model and effort
  by kind of work" it names, and the memory note effort-by-kind-of-work): 1. T13 (line 1153):
  effort by task, not by document (B2). 2. T14 (line 1160): the effort applied and checked (B3).
  High is the default; a lower level ends with what the task says. 3. T15 (line 1172): a count
  of a day's sub-agents by kind (writer, explorer, reviewer, verifier), model and effort."
- L2 (2026-10-14): worktree `D:\js-harness-worktrees\effort-by-task` from `origin/main` d3f6ac1;
  the WSL gate is not on `main` (no `sensorsInWsl` in `harness.json`), so documents only.
