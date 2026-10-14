# Effort by task

Locator: `odd/tasks/effort-by-task.md` · Engram mirror: `odd/effort-by-task/tasks` · Branch:
`docs/effort-by-task` (the design; the build gets its own branch) · Session: `JH 13 · esfuerzo y
subagentes`, opened by the orchestrator on 2026-10-14 with T13, T14 and T15 of
`odd/tasks/session-channel.md`. Test runner: `node --test`. Delivery: `ask-on-risk`.

## Goal
Each task of a feature runs at the effort and with the sub-agent models its kind of work calls
for, the harness says which and shows what really ran, and a day's sub-agents are counted by
role, model, effort and tokens.

## Why
A feature holds design tasks and build tasks, and today one `## Effort` covers all of them
(`bin/lib/contract.mjs:25-32`); nothing applies it and nothing prints it (`bin/contract.mjs:287-295`).
Sub-agents were about 59 percent of a day's tokens (the orchestrator's count of 2026-10-11, not in
a file), so what to measure next and how many to launch should come from a count, not a guess.
His words: "siempre dime en que modo de esfuerzo debemos trabajar dependiendo de lo que hagamos"
(2026-10-11, in `docs/model-effort.md`).

## Done when
- `node --test bin/contract.test.mjs bin/lib/contract.test.mjs bin/resume.test.mjs bin/subagents.test.mjs bin/lib/subagent-count.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/effort-by-task.md` exits 0
- `node bin/js-harness.mjs contract modes odd/tasks/effort-by-task.md` exits 0
- `node bin/js-harness.mjs subagents --days 1` exits 0
- `npm run check` exits 0
- On a real day of this project `subagents` prints its launches by role, model, effort asked and
  ran, with their tokens and the share of the day's tokens they took, and no text of any message
- The figures of two real days and a proposed rule on launches (C4) reached the orchestrator

## In scope / Out of scope
- In: the kind of a task in a feature document's checklist; the contract's parser, validator,
  template, `goal` and a new `modes` form; the mode line of `resume --hook`; a new `subagents`
  command and its library; the help text of what changes.
- Out, and asked of their owners through the orchestrator: the rules list (`bin/lib/rules-data.mjs`,
  `bin/rules.mjs`, `docs/RULES.md`, `docs/ROADMAP.md`: JH 7); the check row comparing what ran with
  the table (JH 7's T13 of the rule hierarchy, "one check"); the orchestrator skill's text (JH 5's
  T8); `bin/sessions.mjs` and the board (JH 5); the hooks' entries in `bin/lib/manifest.mjs` (JH 8);
  his settings and his machine (his).

## Constraints
- Zero dependencies, plain Node — because `bin/` runs in any host without an install step.
- Nothing is forced on a session without a lead — because the harness ships to projects whose
  host, terminal or Codex has no effort tool; it prints the mode, it does not set it.
- Shipped code reads the session and sub-agent rows with `ruleHere`, never `ruleValue` — because
  they are of scope `repository` and `ruleValue` refuses them (`bin/lib/rules.mjs:313-316`).
- No hook entry is added — because every entry must be undone exactly by `uninstall`; the mode
  line rides an entry that exists.
- `subagents` keeps no text of any message — because the records hold his messages, and in an
  installed project another person's.
- No gate turn until the WSL gate is on `main` (the orchestrator's opening, his order ffe99ebf
  line 1647); documents-only commits until then.

## Effort
high

## Ask me before
Which kinds of work may run below high, and at which level; what a project that installs the
harness gets by default; the effort of a Codex work session; spend outside the plan; anything
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
tokens". The design counts both. Where S3 says "kind" of a sub-agent this document says "role",
so that "kind" stays the kind of a task.

## Design (version 2, after its two readers)

### What exists (an explorer's map, checked by the parent and by the two readers)

- `js-harness rules applied` (`bin/rules.mjs:240-263`, `bin/lib/rules-applied.mjs:256`) already
  compares `session-model`, `session-effort` and `subagent-effort` with the records, as
  information, and the sub-agents' aliases with `subagent-reader-model` and
  `subagent-writer-model`, as a failure. It reads a session's last answer and a sub-agent's first
  in bounded spans (`bin/lib/rules-applied-read.mjs:180-239`), and no tokens. No `check` row
  calls it (`bin/check.mjs:1399-1401`); rows are PASS, FAIL or INFO (`bin/check.mjs:1369-1373`).
- The effort a turn ran at is the top-level `effort` of each assistant entry, beside
  `message.model` and `message.usage` (`evals/fixtures/transcripts/probe/d2ddbeb2-….jsonl` holds
  `"effort":"medium","perTurnEffort":"medium"`). A sub-agent's `.meta.json` holds its `agentType`;
  the call's `description`, `model` and `effort` are in the parent session's Agent call, joined to
  the sub-agent through `toolUseResult.agentId` (`bin/lib/sessions.mjs:600-634`). No code reads the
  call's `input.model` or `input.effort` (`rg "input\??\.(model|effort)" bin evals` is empty).
- Token sums per sub-agent exist only in `evals/transcript-usage.mjs` (`requestOf`, :95-110;
  `summarizeTranscripts`, :162-266: by message id, `requestId` as fallback, `<synthetic>` skipped,
  the largest of each field); `evals/` does not ship.
- Every session and sub-agent row of the table is of scope `repository`
  (`bin/lib/rules-data.mjs:110-150`): `ruleValue` refuses it and `ruleHere` gives `{ off:
  'elsewhere' }` in a project with no rules file, that is, every installed project
  (`bin/lib/rules.mjs:313-338`). What the harness turns on there is his and unanswered
  (`odd/tasks/rule-hierarchy.md:1001-1003`), as is a Codex work session's effort (`:1088-1090`).
- A checklist line is `{ text, done }` (`bin/lib/progress.mjs:15,198`); the board's `taskId`
  (`bin/lib/sessions.mjs:802`) is the only ID parser. Tasks already say `(route: inline)`.
- `doctor --hook` (matcher `startup|resume`) prints only a `systemMessage`, only when the stack
  gaps change (`bin/doctor.mjs:210-235`). `resume --hook` (matcher `compact`,
  `bin/lib/manifest.mjs:176-188`) finds the feature document from the session's own channel
  notices and Edit and Write calls (`bin/resume.mjs:212-262`). A fresh session has neither, and
  in this repository it opens in the main checkout on `main`. Both hooks also run in Codex
  (`bin/lib/manifest.mjs:134-158`).
- A day of this project's records was about 231 MB in 58 files, 34 MB of them sub-agents' (a
  reader's measure on 2026-10-14); the folder holds 846 MB.

### S1 — the kind of a task

A task names its kind as `(kind: build)` in its first line, the shape tasks already use for
`(route: inline)`: `- [ ] T3 (kind: build) The parser reads ...`. A bracket was version 1's; it
reads as a link in `- [ ] T3 [docs/x.md](…)`. The kinds:

| Kind | Meaning | Session effort | Sub-agents it may launch |
|---|---|---|---|
| `design` | a design, a protocol, a decision to bring him | `session-effort` | readers |
| `build` | code under a contract whose scope is closed | `session-effort-build` if declared, else `session-effort` | writers and readers |
| `verify` | verification, review, a measurement | `session-effort` | readers |
| `docs` | documentation, wording | `session-effort` | readers; a Haiku writer for wording is D of the proposal, not decided |

"May launch" is advice printed with the mode, not enforced: C8 of the rule hierarchy (JH 7) owns
a refusal by hook. The models come from the roles' rows (`subagent-writer-model`,
`subagent-reader-model`), not from the kind; so today every kind prints high and only `build`
names writers. That is the table as he decided it; the kind is where a lower level would enter.

A task with no kind takes `session-effort`, not `## Effort`: a document's `## Effort` set to
medium would otherwise revive medium outside C2's trial (`odd/tasks/practice-project.md` says
medium). `## Effort` becomes optional: validated as today when present, read by nothing, and
left out of `contract template`, whose checklist line shows `(kind: …)`. No existing document
changes validity: none has a `(kind:` today (`rg "\(kind:" odd docs` is empty but this file).
An unknown kind is a contract error naming the task: `task T3 names the kind "bild": one of
design, build, verify, docs`. The ID grammar (`T` and digits, an optional letter suffix, an
optional `·`) moves from the board's `taskId` into `bin/lib/progress.mjs`, asked of JH 5 because
`sessions.mjs` is theirs; until then `contract.mjs` holds its own copy and a test pins both alike.

Reading the table: `ruleHere(id, undefined, projectData)`. The value prints when found; `off:
'elsewhere'` prints `no effort or model declared in this project`; `off: 'behind'` prints
`this copy of the harness is older than the project's rules`. What an installed project should
get instead is his question, already open at JH 7; this feature prints the truth meanwhile.

`js-harness contract modes <doc> [--task T3]` prints one line per open task and exits 0:
`T3 (kind: build): session high; writers haiku, readers opus; every sub-agent at high`. A task
with no kind says `(no kind)`. `contract goal` keeps its stdout exactly the `/goal` condition,
which is pasted whole, and prints the same lines on stderr after it: a session that runs it sees
both, a person copying the condition gets only stdout when it is piped. This meets S1's "`goal`
prints them" without changing the condition; `modes` is the form the hook and the lead read.

### S2 — applied

- With a lead in the desktop app: before a session's task starts, the lead reads the task's
  state, runs `contract modes <doc> --task <id>`, and sets the session's effort with
  `set_session_effort`; a lower level is set back to high when the task's box is checked, or
  first when a design question appears inside it. Every Agent call names `model` and `effort`,
  since a call without them inherits the session's: a reviewer launched from a medium session
  would run at medium (B3 of the proposal). This is text of the orchestrator skill (JH 5's T8)
  and of the shipped js-harness skill (`bin/lib/manifest.mjs:20-33`); this feature writes the
  paragraph and hands it over, it edits neither file.
- Without a lead: `resume --hook`, after a compaction, already finds the feature document and
  names it; it gains one line with the mode of the next open task, in the `additionalContext` it
  already prints, so the model reads it and says it to the person, who alone can set the level.
  On Codex it prints the kind only and `effort not declared for Codex`, until a row says. At a
  fresh start nothing knows the document, so nothing prints there: the line at startup needs
  `resume --hook` on the `startup` matcher or a branch lookup in a feature checkout, a change to
  the hooks' entries (JH 8's, and an install change). Recorded as an open item, not built here.
  `resume.mjs` holds hook texts JH 5 owns: the added line is a small hunk asked of them first.
- The check: JH 7's. This feature exports `taskModes(markdown, rules)` from
  `bin/lib/contract.mjs`, the open tasks with kind and mode, for that check to compare a
  session's level with the mode of its task; and `subagents` records each launch's asked and ran
  effort, which the check can reuse.
- `js-harness remote` (`bin/lib/remote.mjs:88`) passes no effort, and his settings default Opus
  5.5 to medium: a session opened from the phone starts at medium. Not changed here, as S2 says;
  routed to him with the questions below, since the setting is his machine's.

### S3 — the count of a day's sub-agents

`js-harness subagents [--day YYYY-MM-DD] [--days N] [--json]`, a new `bin/subagents.mjs` and its
library `bin/lib/subagent-count.mjs`.

- Records: the project's folders under `~/.claude/projects`, one per checkout: the main
  checkout's slug and those of `git worktree list`, since a session opened in a worktree is kept
  under another slug. Codex records are not counted: said in the output.
- Reading: files whose modification time is on or after the first day asked, streamed line by
  line, every line (a sum needs them all), each entry kept only when its timestamp is in the
  window. `--days` is at most 7. About 231 MB a day: the command prints its own time.
- Join: each sub-agent file to its parent's Agent call by `toolUseResult.agentId`; from the call,
  `subagent_type`, `description`, and the `model` and `effort` asked; from the sub-agent's answers,
  the model and effort it ran at. A launch with no effort or model asked is marked `inherited`.
- Role: `subagent_type` first (`Explore`, `Plan` explorer; `review-*`, `jd-judge-*`,
  `review-refuter` reviewer); else the description's first verb by a fixed map read from real
  descriptions of the last two days (Write, Fix, Writer → writer; Map, Find, Sweep, Explore →
  explorer; Attack, Reader, Review, Read → reviewer; Verify, Measure, Count, Check → verifier);
  else a `haiku` model is a writer; else `other`, printed so the gap shows.
- Tokens: per message id (`requestId` as fallback) the largest of each field, `<synthetic>`
  skipped: input, cache creation, cache read and output kept apart, as `evals/transcript-usage.mjs`
  does (copied, since `evals/` does not ship).
- Share: the same sums over the day's main sessions, one share per figure, since cache reads
  dominate and a single number would mislead.
- Day: local time, his day, with the clock and the offset injected so the tests do not depend on
  the machine's zone; the output says "local day". `rules applied` uses universal time: noted.
- Privacy: it keeps the role, the description's first word, the models, efforts, usage,
  timestamps and ids, nothing else, and prints no text of any message, `--json` included; a test
  plants a secret in a record and asserts it never appears.

Output: one row per role, model, effort asked and ran, with launches and each token figure; a
total; the shares; the `other` and `inherited` counts. It exits 1 only when no records folder can
be read.

### Work units

| Task | Kind | Route | Files |
|---|---|---|---|
| T1 design, two readers, version 2 | design | inline, readers on opus high | this document |
| T2 kind, `modes`, `goal`'s stderr, template | build | inline | `bin/lib/contract.mjs`, `bin/contract.mjs`, `bin/js-harness.mjs` (help line), their tests |
| T3 the mode line of `resume --hook` | build | inline, after JH 5 clears the hunk | `bin/resume.mjs`, its test |
| T4 `subagents` | build | two Haiku writers (the token sums; the role map), the parent for the join and the command | `bin/subagents.mjs`, `bin/lib/subagent-count.mjs`, tests, `bin/js-harness.mjs` |
| T5 hand-offs | docs | inline | messages to the orchestrator |
| T6 the figures and the rule on launches | verify | inline | this document |

## Not guaranteed

- A session's level in the middle of a task: the records give each turn's; which turn counts is
  the check's choice (JH 7's).
- A sub-agent's role when its type is generic and its description opens with an unmapped verb:
  it counts as `other`.
- Codex sessions and the Codex review: not in the count.
- A fresh session without a lead: no mode is printed until it runs `contract goal` or `modes`, or
  until a compaction.
- What the plan charges per model: tokens are counted, not prices.

## Questions that are his (through the orchestrator)

1. Which kinds of work may run below high, and at which level. Recommended: none yet; every
   kind runs at `session-effort` (high) until C2's comparison of the medium trial is brought to
   him, and then, if it passes, one row `session-effort-build` at medium. Nothing waits on the
   answer: T2 reads an absent row as "the session's".
2. Already open at JH 7, not asked again: what an installed project gets by default
   (`rule-hierarchy.md:1001-1003`), and the effort of a Codex work session (`:1088-1090`).
3. His machine, for him to change or keep: the settings default of medium and `remote` passing
   no effort make a phone session start at medium (`docs/model-effort.md`, G).

## Places that say something else today (for their owners, in the same stretch)

- `docs/ROADMAP.md:62` (one level per contract), `:353-360`, `:539-541`: JH 7.
- The five `## Effort` sections that say medium (remote-control, session-board, sensors,
  practice-project, stack-v4): left as they are, since `## Effort` is read by nothing.
- The memory notes effort-by-kind-of-work, subagent-effort-high, narrow-writers-no-gate-wait:
  pointed at this document once it is built.
- `odd/tasks/session-channel.md` T13-T15 are still open boxes there: the orchestrator tells JH 5
  they moved here.

## The paragraph handed over (T5)

For the orchestrator skill (JH 5's T8) and, its last two sentences, the js-harness skill text
(`bin/lib/manifest.mjs:20-33`):

> Before a work session starts a task, read the task's state, then run `js-harness contract
> modes <document> --task <id>` and set the session's effort to the level it prints with the
> app's effort tool; it applies from the session's next turn. A level below high ends with its
> task: set it back to high when the task's box is checked, and first, before answering, when a
> design question appears inside it. Name the session's mode and why in every recap. Every
> sub-agent call names its `model` and its `effort`: a call without them inherits the session's,
> so a reviewer launched from a medium session runs at medium. `js-harness contract modes` says
> which model each role takes.

## What the readers changed

The reader that attacked: the table is read with `ruleHere`, not a change to `ruleValue`; the
startup line cannot find the document and `doctor --hook` cannot carry it, so the line moved to
`resume --hook` and the startup half became an open item; the bracket became `(kind: …)`; a task
with no kind takes `session-effort`, not `## Effort`; "kind" of a sub-agent became "role"; the
role comes from the joined Agent call and a verb map read from real descriptions; reading is
streamed, not bounded; tokens follow the evals' three rules; the day is injected.

The reader that looked for what was missing: Codex gets the kind only; the inherited effort has
an applying sentence and an `inherited` mark; the places of G and the help text are named; no
hook entry is added, so uninstall is untouched; a privacy rule and its test; T6 for C4; his
questions listed.

## Tasks

- [x] T1 (kind: design) Design read by two readers (one attacks it, one looks for what is
  missing); version 2 and the questions sent to the orchestrator (route: inline). Version 1
  2a735ec, version 2 4840f89, pushed; sent to the orchestrator 2026-10-14 02:54 with question 1
  and the three file requests
- [ ] T2 (kind: build) The kind of a task, `contract modes`, the modes on `goal`'s stderr, the
  template and help (S1)
- [ ] T3 (kind: build) The mode line of `resume --hook` (S2, the half without a lead)
- [ ] T4 (kind: build) `js-harness subagents` (S3)
- [ ] T5 (kind: docs) The paragraph for JH 5's skill and the js-harness skill, `taskModes` for
  JH 7's check, the startup item for JH 8, handed through the orchestrator (S2)
- [ ] T6 (kind: verify) Two real days counted, the figures and a proposed rule on launches (C4)
  to the orchestrator (S3)

## Log

- L1 (2026-10-14, the orchestrator's opening, a claim and not his words): "From
  odd/tasks/session-channel.md (read each task's full text there, the proposal "Model and effort
  by kind of work" it names, and the memory note effort-by-kind-of-work): 1. T13 (line 1153):
  effort by task, not by document (B2). 2. T14 (line 1160): the effort applied and checked (B3).
  High is the default; a lower level ends with what the task says. 3. T15 (line 1172): a count
  of a day's sub-agents by kind (writer, explorer, reviewer, verifier), model and effort."
- L2 (2026-10-14): worktree `D:\js-harness-worktrees\effort-by-task` from `origin/main` d3f6ac1;
  the WSL gate is not on `main` (no `sensorsInWsl` in `harness.json`), so documents only.
- L3 (2026-10-14): version 1 committed (2a735ec); two readers on opus at high, one attacking and
  one looking for gaps, found five blockers between them, the same two in both (the table's
  scope, the startup line); version 2 above takes every finding.
