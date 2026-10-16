# Rule hierarchy

Locator: `odd/tasks/rule-hierarchy.md` · Engram mirror: `odd/rule-hierarchy/tasks` · Designed on
branch `docs/channel-and-rules-design` by the session `JH 4 · diseño canal y reglas` (2026-10-10),
together with `odd/tasks/session-channel.md`. Built from 2026-10-11 by the session
`JH 7 · registro de fallas y reglas`, which owns this document from that day: T3 first, then T1,
while the session channel is still being built (the reason is in Progress, 2026-10-11).

## Goal
Every working rule of this project acts from one of three places — a check a command or a hook
runs, a line of `AGENTS.md`, or a protocol loaded on demand — so that no rule depends on a
session remembering it, here and in a project that only installs the harness.

## Why
Rules that live where nothing acts are repeated by Sebastián, session after session. He has
said three times that his wording is the need and not the specification (2026-10-08,
2026-10-09 and 2026-10-10, as the relief file counts them in its line 80), and it still acts
only through an agent's memory note. The line of `AGENTS.md` about a
step he would only say yes to was loaded in a session that still stopped for a yes
(`odd/tasks/session-board.md`, entry of 2026-10-10, "A sentence did not carry it"). A rule
changed in a memory note did not reach the sessions already open (failure 2 below). And text is
not free: in F5 the stack with the most instructions cost 1.68 to 2.54 times as much for the same
score (`docs/ROADMAP.md`, "F5 result").

The survey of 2026-10-10 (section "Survey" below) counted 83 rules. For 49 of them nothing acts:
they live only in a memory note, in the orchestrator's relief file or as roadmap text. In
fourteen matters two places say different things; each is listed, with the text that wins, in
"Contradictions the build resolves".

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/rule-hierarchy.md` exits 0
- `node --test bin/reply.test.mjs` exits 0
- `node --test bin/lib/reply.test.mjs` exits 0
- `node --test bin/lib/failures.test.mjs` exits 0
- `node --test bin/failures.test.mjs` exits 0
- `node bin/js-harness.mjs failures check --settled` exits 0
- `node --test bin/lib/spec.test.mjs` exits 0
- `node --test scripts/practice-lib.test.mjs` exits 0
- `node --test bin/lib/protocols-skill.test.mjs` exits 0
- The practice journey, with this feature's steps in it, passes on the machine that builds it
  (here `node scripts/practice.mjs run --root D:\js-harness-practice`), and its record line is
  quoted in Progress. The folder is one machine's, so this is read, not a command of the
  contract.
- The seven signals of "Signals of done" below are read and recorded in Progress, each with the
  command that showed it.

## In scope / Out of scope
- In: `AGENTS.md` (rewritten within its budget); `agentsTemplate` (`bin/lib/project.mjs`); a new
  protocols skill and the two hook entries in `bin/lib/manifest.mjs`; new `bin/reply.mjs` with
  `bin/lib/reply.mjs`, and its entry in the dispatcher (`bin/js-harness.mjs`); new rows in
  `bin/check.mjs` (`failures`, `spec`, citations) with `bin/lib/failures.mjs` and
  `bin/lib/spec.mjs`; a row in `bin/lib/stack.mjs` (`memory-rules`); `docs/SPEC.md` and
  `docs/FAILURES.md`; the `harness.json` at the root of this repository (tracked since `74e473c`,
  with `documents` alone; the design of 2026-10-10 said it was not tracked), which C1 needs a
  `reply` key in for the reply check to act here; one eval task under
  `evals/tasks/`; steps in `scripts/practice*.mjs`; `docs/ROADMAP.md`. The test files the
  contract names (`bin/reply.test.mjs`, `bin/lib/failures.test.mjs`, `bin/lib/spec.test.mjs`)
  do not exist yet: the build creates them, and adds to "Done when" the test of each other
  check as it writes it (C4, C5, C6, the protocols skill, the eval's proof).
- Out: the orchestrator skill, the notices, the roster, the opening of a session and the context
  hooks — they are `odd/tasks/session-channel.md`. gentle-ai's managed block and
  the global `CLAUDE.md` — not this repository's text (F2); what they already say is not
  repeated. The gate lock (`feat/gate-lock`) — it is the check for the gate rules and is only
  pointed to.

## Constraints
- A check before a line, a line before a protocol — because a check costs no tokens and cannot
  be forgotten, and F5 measured what more text costs.
- `AGENTS.md` stays within `TOKEN_BUDGET` (1,500, `bin/check.mjs:21`); the gate of this
  document's commit printed `PASS  budget  1499 estimated tokens (budget 1500)` — because every
  line is paid on every turn, a rule that enters makes another leave. The new section lists
  nine items against a file with one token to spare, so T8 is not done by adding: it measures
  what C1 and the protocols let leave before a line enters.
- A hook the harness installs acts only in a project that opted in, and is recorded in the
  manifest — because a user-level hook runs in every project of the machine, and what is written
  outside the repository must be undone exactly (`AGENTS.md`, "What good looks like").
- Zero dependencies, fixture-based tests — because every command runs on any machine with no
  install step.
- The wording of each line of `AGENTS.md`, and each thing shipped, passes by Sebastián in the
  build session — because he accepted the content and the direction, not the final text
  (`docs/ROADMAP.md`, "Rule hierarchy").
- T2, T7, T8 and T9 are not built while the session channel is being built — because they edit
  `bin/lib/manifest.mjs` and `docs/ROADMAP.md`, which the channel edits too, and the channel
  changes two sentences of `AGENTS.md` (the resume prompt of a cut) that T8 here rewrites with
  the rest. The other tasks wait for nothing of the channel (Progress, 2026-10-11).

## Effort
high

## Ask me before
Installing the reply hook on this machine (a change on a machine). Whether `init` turns the reply
check on in a project by default (a product choice). The final wording of the rewritten
`AGENTS.md` and of the template. The spend of the honesty eval's trials. Deleting or rewriting the
memory notes of this project once their rules are placed. The protocols: the roadmap starts
with four, and sections 5 and 6 of "Protocols" are proposed to him as two more (a new protocol
is his); so is any after them.

Already put to him and not answered, which this document does not settle: what enters the
harness from the sub-agent models result (asked by the orchestrator on 2026-10-10, 22:35). C8
and the model clause of protocol 6 wait for it.

## TDD
Mode: strict (source: user global config). Runner: `node --test`. Passive documents (`AGENTS.md`,
`docs/SPEC.md`, `docs/FAILURES.md`) have no RED of their own: the rows of `check` that validate
them are written test first.

## Delivery
Forecast: about 1,400 to 1,800 authored lines over six slices, each its own pull request against
`main`, merged in order (`stacked-to-main`, as every feature since `odd/tasks/project-init.md`).
Slices: 1 = T1; 2 = T2; 3 = T3 to T6; 4 = T7 to T9; 5 = T10; 6 = T11 to T15.

Changed on 2026-10-11: T3 leaves slice 3 and is delivered first, as a slice of its own on the
branch `feat/failures-register`; T1 follows as the next slice. T2 and T8 wait for him. The
forecast for T3 is about 1,000 authored lines (the library and its tests, the command, the row,
the seeded file), under the 1,200 a reviewed commit may hold.

## Design

### The placement rule
A rule is recorded only when it has a place in one of three levels, in this order of preference.

1. A check: a row of `check`, a git hook, a host hook, a row of `doctor`, a test, or a count a
   command prints. It costs no tokens until it fails.
2. A line of `AGENTS.md`, with its reason, when the rule cannot be checked and applies to every
   reply. In a project that only installs the harness, the same line is in the template `init`
   writes.
3. A protocol loaded on demand, when the rule applies only in some situations.

Two places are none of the three. The record of what was decided is `docs/ROADMAP.md` and the
feature documents. An agent's memory holds facts of one machine (how he merges from the phone,
the list of models, a quirk of a tool) and never a rule.

One rule of design follows from the first level and is what frees the budget: **the refusal of a
check carries the rule**. A rule that is checked needs no prose until it is broken; the message
of the check that refuses says what is missing and how it is written. `AGENTS.md` then keeps one
sentence that names the rule, and the format leaves it.

### What the hosts allow (read on 2026-10-10)
Read in the official documentation by a sub-agent, URLs in Progress; one page not re-read by the
design session, so each is a claim to confirm with a logging hook before it is built on.

- Claude Code `Stop` hook: its input carries `last_assistant_message`, `stop_hook_active`,
  `background_tasks` and `transcript_path`; it refuses the stop with `decision: "block"` and a
  `reason` the model reads. A cap of 8 consecutive refusals exists. Codex has the same event
  with `last_assistant_message` and the same refusal. So one check serves both hosts.
- `SessionStart` has the matcher `compact`; `PreCompact` exists; `UserPromptSubmit` sees the
  prompt with pasted text between `pasted_content` tags.
- `PreToolUse` on the sub-agent tool sees `model` and `subagent_type`; `effort` is not a
  documented field, and the matcher's name (`Agent` or `Task`) is not confirmed.
- A skill invoked in a session is re-attached after a compaction (5,000 tokens each, 25,000 in
  all). The description of every installed skill is loaded on every turn.
- Not documented: whether `Stop` fires in sessions started through `claude remote-control`, and
  whether the desktop app renders a status line.
- Inferred by the review of this document, not tested: this machine already has a `Stop` hook
  of gentle-ai. If it refuses a stop first, the next stop arrives with `stop_hook_active` true,
  and a check that lets such a stop through would be skipped. T2 tests the two hooks together
  before it relies on that flag.

### Checks to build
Each names the incident it comes for, what it refuses, and how it is judged in a project that
only installs the harness.

**C1 The reply check** (`js-harness reply --hook`, a `Stop` hook on both hosts). Incidents: a
block worded as an instruction was read three times as a task for him (2026-10-07); a yes asked
of him that was not his (failures 1 and 17); a decision asked while work ran; stale prompts sent
twice because he could not tell "working" from "waiting on you". It reads `last_assistant_message`
and refuses a final reply when:
- it closes with none of the four states, or with more than one;
- the state is decision and the reply has no block, more than one, a block not under the three
  labels (what it is, where it goes, what sending it does), or no line naming which of his
  items the question falls under;
- the state is decision and `background_tasks` is not empty (never asked while work runs);
- the state is working or finished and the reply carries a block for this chat;
- the state is finished and no session to return to is named;
- the state is cut and the blocks are not the two numbered ones (until the resume hook of the
  session channel exists; then a cut carries the bare `/compact` alone).
Two kinds of block exist, told apart by the label "where it goes". A block for this chat holds
his answer and belongs to a decision. A carry block names another session: it is the one line
that opens a session or a notice for a session nothing else can reach
(`odd/tasks/session-channel.md`, points 6 and 8). The check allows at most one carry block in a
reply, in any state, and refuses one that does not say there that he types a line of his own
with it.

It also does one thing without refusing: when the session's context, read from the transcript
as the board reads it, is at or past the context pause (a number the board's code holds, never
written here: "One home for every rule"), it adds one
line to the model's context saying so and naming the rule (write the state in the feature
document, then judge what is left). It says it once per session, not at every stop.

Three changes to this check are taken from the design of a compaction that loses nothing
(`odd/tasks/session-channel.md`, point 14, version 2, read on 2026-10-12 at `bfb9199`), written
here when his answers to that session arrive and built with T2, not before:
- One more shape of a reply: working, past the pause, with the two blocks of a cut. The check
  allows it only past the pause; under it a working reply with a block for this chat stays
  refused. And the first final reply after a session was told is refused when it lacks the
  share and the blocks, so that "announced" is a refusal and not only a count. How many blocks
  a cut has once the resume hook is installed is his, and is read from one place.
- The line at the pause is said once for each stretch between two compactions, not once for a
  session: as written above it would be silent after the first compaction.
- The function that decides it and the mark that it was said are one, built by the session
  channel's session for its hook that runs after each tool call; this check imports them and
  writes none, so a session is told once, by whichever comes first. By that session's notice
  of the same day (a peer's claim): the function is `pauseNotice` of `bin/lib/pause.mjs`, on
  `feat/session-compaction`, and a stretch ends when the context falls under the pause again,
  kept in a state file for each session, not at the boundary of a compaction.

The refusal prints the missing piece and the exact shape, in the project's language. It lets a
reply through when `stop_hook_active` is true, so a session is refused once per stop and never
loops. It does not run for sub-agents. It acts only where `harness.json` holds a `reply` key;
that key carries the labels (here the Spanish ones: `Sigo solo`, `Necesito tu decisión`,
`Corte`, `Terminado`) and may narrow the list of what is the owner's. Judged twice: here it
lets the format of the states, of the block and of a cut leave "Working with Sebastián" (how
many tokens that frees is measured in T8, not estimated here); in an installed project it is
the only way the four states reach a session at all, since the template does not carry them
today.
Cost: a refused reply costs one more turn. Proof: `node --test bin/reply.test.mjs`, a practice
step that installs and removes the hook, and the count of refusals per session on the board
(session channel, measures), which should fall towards zero.

**C2 The failures register** (`docs/FAILURES.md`, row `failures` of `check`, command
`js-harness failures`). Designed again on 2026-10-11, before anything was built, in the section
"The failures register" below; the first design, an id, a date, an owner and a state written by
hand, is in this file's history (`6d8bc82`). The row refuses a register it cannot read; what
depends on other files is counted, and `failures check --settled` is the command that refuses
it. It is seeded with the eighteen entries of "Failures
of 2026-10-10" and with those of 2026-10-11. In an installed project the row acts only when the
file exists.

**C3 The specification** (`docs/SPEC.md`, row `spec`). As the roadmap describes it: one entry
per capability with problem, requirement, reason, proof command, what was discarded, and a
"today" line. The row fails when a capability has no proof command, when a file its "today" line
names does not exist, or when a command of the dispatcher, a hook the manifest installs, or a
file written outside the repository is claimed by no capability. It is built after T3: its list of
capabilities is the second half of this survey, taken on 2026-10-10 and held in Progress.

**C4 A writing command refuses a flag it does not know.** Incident: `install --help` was run to
read its help and installed on his machine (2026-10-09). One table-driven test runs every command
that writes outside the repository with an unknown flag against a throwaway home and expects a
non-zero exit and nothing written.

**C5 Citations.** A feature document cites a path or a commit that does not exist. Row
`citations`, INFO at first: it reads only the lines the pending change adds, resolves each
`path:line` against the tree and each commit id against the repository, and prints the count.
It becomes a FAIL only after the count of false alarms over twenty commits is zero, because
documents cite other branches and removed files on purpose.

**C6 Rules in memory** (row `memory-rules` of `doctor`). It lists the notes of the project's
agent memory whose type is `feedback` or `project`: each is a rule or a decision living where
nothing acts. The four types (`user`, `feedback`, `project`, `reference`, in each note's front
matter) are what Claude Code's memory instructions define in this session; the types the
seventeen notes actually carry were not read here, and T6 reads them before it relies on them. The fix line says: place it with the protocol "recording a new rule", then delete
the note. Notes of type `user` and `reference` are machine facts and are left. The `SessionStart`
hook that `install` already writes (`js-harness doctor --hook`) shows the gap when it changes.
This is the first of the feature's two end numbers, as a command.

**C7 The honesty eval.** One task under `evals/tasks/` whose honest answer is "this could not be
verified", with a hidden grader, scored with and without the line "each claim is checked, assumed
or not known". If the score does not move, the line leaves `AGENTS.md` and the template and the
sensors stay. Its trials are spend he approves first.

**C8 Sub-agent models** (last, optional). His rule of 2026-10-10: Haiku only for sub-agents that
write code; designing, planning and verifying on Opus 5.5 at high effort at least. A `PreToolUse`
hook can read `model` and refuse one the project does not allow; it cannot read `effort`. The
comparison is closed (`docs/ROADMAP.md`, "Subagent models result", merged on 2026-10-10): the
same score, 58% less cost for the session, not faster, and a recommendation that nothing is
turned on by default and that, if it goes in, it is the model of the writing sub-agent only.
What enters the harness from it is his and not answered, so C8 is built only after his answer
and after the matcher's name is confirmed; until then the rule is one clause of the protocol
"handing off".

**C9 The honesty audit** (after the session channel; an assumption first). The roadmap proposes
that the reader of transcripts take a session's final report and check what can be checked:
that the paths and commits it names exist, that the test count is the one that ran. Whether the
reader makes that cheap is an assumption the roadmap itself marks; T14 reads the code and
either designs the audit as a count on the board or records why not.

Not built here, only pointed to: the gate lock of `feat/gate-lock` is the check for "never two
gates" and replaces three rules kept by hand (59 to 61 of the survey); the pre-push row already
checks the Codex record.

### The failures register
The design of C2, by the session that builds it (`JH 7 · registro de fallas y reglas`,
2026-10-11), as it stands after a reader that did not write it attacked it (Progress, T3a).

The need, in his words. On 2026-10-10: a mistake is told with how it is solved now, how it does
not happen again and how it is integrated, and "a futuro comprobar que esto no vuelva a fallar".
On 2026-10-11: "tenemos una forma de guardar logs de fallos o informacion erronea para poder
llevar un registro y poder hacer correciones a futuro y ver que tan repetitivo hacemos algo?"
(the orchestrator's transcript `7d2ae675-4bf2-4657-aff5-cde2477a4bee.jsonl`, line 1360, read by
this session). Read as three needs: one record of what went wrong, wrong information included;
each entry tied to what corrects it; and a count of how often each thing, and each kind of
thing, comes back. What existed on that day: failures numbered by hand in the orchestrator's
relief file and in feature documents, in two numberings that already disagree (16 to 18 of
"Failures of 2026-10-10" below are not the 16 to 18 of the relief file's line 202), and nothing
that counts them.

What a failure is, for this file: the work went wrong in a way a control could prevent. He was
asked, or kept waiting, for what was not his; something false or unchecked was stated as a fact;
a tool showed a state that was not the real one; the machine's load or its leftovers hurt a run;
a rule existed and nothing made it act; a command failed or did the wrong thing. A test that
fails and is fixed inside its own task is not one: the gate is that control, working.

The file. `## Classes` declares the classes, one list item each (`` `id` `` and what it means).
`## Entries` holds one entry per failure: a `### <id>` heading, the text that says what
happened, and a list of fields.

```
### language-server-load
A TypeScript language server per session works while tests write files, and a gate reaches its
bound.
- Class: machine
- Aka: failure 20
- Seen: 2026-10-11 — relief file, line 224 — a gate at 1,188 s of 1,200
- Control: owed — odd/tasks/<feature>.md — "<words of an unchecked task of that document>"
```

That block shows the shape only: the lines of the seed are written from the records, not from it.

- The id is lowercase words joined by hyphens, not a number: two branches that each add a failure
  would both take the next number, and the collision would only show on `main`. The numbers the
  earlier records used stay in `Aka`, so those records can still be followed. Entries are kept in
  the alphabetical order of their ids, which the row checks: two branches that add entries then
  seldom touch the same lines, where a file ordered by time is in conflict at its end every time.
- `Class` is one of the classes the file itself declares, so a project that installs the harness
  names its own. The seed proposes seven, his to correct: `wrong-information` (stated as a fact,
  and not checked or not true), `asked-of-him` (asked or kept waiting for what was not his),
  `unseen-state` (a tool showed a state that was not the real one, or did not show it),
  `machine` (load or leftovers: processes, folders, locks), `rule-not-acting` (a rule existed and
  nothing made it act), `tool` (a command of the harness or of the stack failed or did the wrong
  thing), `delivery` (a commit, a review or a merge left in a shape that could not be checked).
- `Seen` is one line per sighting: the date, where the evidence is, a note. The number of these
  lines is how often the thing came back; it is never written as a figure. Their order in the
  file is free and the reader sorts them, so a conflict between two branches that each add a
  sighting is settled by keeping both lines, in either order. Two lines with the same date and
  the same evidence are one sighting: two sessions that read the same record do not count it
  twice.
- `Control` is absent, owed, in place or measured (the last, T3f, is told under "A failure with
  no control, measured (T3f)").
  Owed: `owed — <document> — "<phrase>"`, where the phrase is found in a list item of that
  document that is not checked off: the task that will build the control, in a feature document
  or in the roadmap. A phrase and not a task number, because the roadmap's steps carry none.
  In place: `<check|line|protocol> — <path> — "<phrase>" — since <date>`, one of the three levels
  of the placement rule. The path is a file of the repository and the phrase is text that file
  must hold: the name of the test for a check, the sentence for a line of `AGENTS.md`, the
  heading for a protocol. `since` is the day the control reached `main`.
- `Proof`, when the control is not a test: the command or the count that shows the failure has
  not come back, in words ("the board prints 0 under ..."). Free text, printed and not checked.
- `Was` is a control that did not hold or that left, moved there by hand. Free text; its lines
  are counted, as the number of controls that had to be replaced.

How a field is read, said here because the existing reader of markdown (`tokenize`,
`bin/lib/progress.mjs`) only tells a heading, a list item and a fence apart. A field is never
split on every dash: `Seen` takes the date at its start and is cut at the first two ` — `, so a
note may hold dashes, quotes and dates; `Control` takes its first word, the `— since <date>` at
its end, and the phrase between the outermost quotes, so a phrase may hold a quote or a dash. A
long field continues on indented lines. A path uses forward slashes, is not absolute and holds
no `..` (as `documentFault` refuses them, `bin/check.mjs:162-171`); a `check` is never a `.md`
file. A phrase has at least twelve characters and is matched with every run of white space read
as one space on both sides, because the files here end their lines with a carriage return and
wrap their sentences. Everything between the heading and the first field is the text of the
entry. A byte-order mark is dropped. A fence left open inside an entry is refused, because it
would swallow every entry after it without a word.

There is no state field. The state is computed from the fields, and a state written by hand
would be one more statement that can be false, in a file that exists to count those:
- `once`: seen once, nothing owed. Nothing is asked of it.
- `repeated`: seen twice or more, and no `Control`.
- `owed`: the document holds the phrase in a checkbox item that is not checked (`- [ ]`). A
  list item with no checkbox owes nothing, under such an item too; nor does a task kept in a
  comment or shown inside a fence, a fence indented under an item included.
- `owed, stale`: it does not: the document is gone, or the task was checked off and the entry
  still says owed.
- `controlled`: the path holds the phrase and no sighting is later than `since`.
- `control lost`: the path is gone or no longer holds the phrase: a test renamed, a line of
  `AGENTS.md` dropped.
- `seen again`: a sighting later than `since`: the control did not hold where it was seen.
`once`, `owed` and `controlled` are settled. The other four are not.

What the row refuses, and what it only counts. It refuses what the register alone shows, which
the session editing it can always repair: an entry with no text, no class or no sighting; a
class the file does not declare, or declares twice; an id that is not in the shape, is repeated or is out of order;
a date that is no date; a field it does not know or cannot read; a control in a shape it does
not know; a fence left open. Each refusal says what is missing and how it is written. Every
state that depends on another file, or on another day, is counted and printed with the ids on
every gate and refuses nothing. Three facts decide it:
1. Those states change without any author. A session renames a test on a branch cut before the
   entry that names it; both pull requests merge clean; the next session to commit, on any
   feature, is the one refused, for a failure it knows nothing about. A task checked off on one
   branch while the entry sits on another does the same.
2. A static row that fails is only printed after the sensors have run (`bin/check.mjs:964-995`:
   the rows are computed first and printed last), and nothing checks `main` after a merge (no
   `.github/`; `.githooks/` holds `pre-commit` and `pre-push`). So that bystander pays a whole
   gate to read the refusal: 897 s for this document's own on 2026-10-10 (Progress), 1,188 s for
   one of 2026-10-11 (relief file, line 224), of a turn the whole machine shares.
3. A row that refused a second sighting until its control is placed would be obeyed by not
   recording it: the session that sees a failure again often does not own the document where
   its task belongs, and may not write there.
So the force is put where somebody can act. `js-harness failures check --settled` exits 1 while
any entry is not settled, and it is a command of this feature's "Done when": the rule hierarchy
does not close with a repeated failure that nobody controls or owes. Any feature's contract can
carry it. The row prints the same list at every gate, with the first day each was seen, and
its detail ends with how a failure is recorded, which is how a session learns the register
exists at no token per turn. Proposed to the gate's feature and not built here: a gate that
stops before its sensors when a static row already fails; with that, the states that are not
settled could refuse in the row at the cost of seconds.

Nothing fails by the calendar: a row that turned red with the date would refuse a commit that
changed nothing.

The command. `js-harness failures` prints the totals, the count of entries and of sightings by
class, and one line per entry, the most seen first, with its state. `js-harness failures <id>`
prints one entry whole. `js-harness failures check` runs the row alone and exits 1 when it
refuses; with `--settled`, also when an entry is not settled. It reads; nothing writes the file
but an editor.

What the counts are worth. The count by class is the one to trust. The count of one failure
depends on every session giving it the same name: two sessions that record the same new failure
under two ids make two entries seen once each, and nothing mechanical sees it. Numbers collided
loudly; words diverge in silence. What narrows it: the command lists the entries of a class, so
a session looks before it adds, and a new entry is read by the slice's reviewers. A sighting
recorded on a branch reaches the other sessions when that branch merges, not before.

What the register proves and what it does not. A control in place is a phrase found in a file,
not a control that works: the test it names proves that, and the gate runs it. A short phrase
can be found by accident, and a test that is skipped still holds its name. Whether a failure
came back is known only if somebody records it, except where its control is a check that makes
it impossible; that is the limit of his "comprobar que esto no vuelva a fallar", and the honesty
audit (C9) is what would narrow it. A date has no hour, so a failure seen again on the day its
control entered reads as seen before it; and a sighting on a branch that did not have the
control yet reads as `seen again`, which is why that state is counted and judged by a person
and never refused.

Judged twice. Here it replaces two hand-kept lists, and "no repeated mistake" of the signals
becomes a number that can be other than zero on a green tree: the entries seen again, and the
`Was` lines. In a project that only installs the harness, the row acts only when
`docs/FAILURES.md` exists, the classes are the project's own, and a control owed is a phrase of
any checkbox item that is not checked, which needs no convention of task numbers; a plan kept
as plain bullets has to turn the one that owes into a checkbox. Not built in this slice,
and said so: `init` does not write an empty register (it goes with T9, with the template; built
with T9 on 2026-10-16, Progress); no command writes a sighting, which is built only if editing by hand proves to cost; no `--json`,
which waits for a reader.

A limit of who writes. The orchestrator writes only its relief file, so what it sees reaches the
register through a work session that reads that file, and the evidence of such a sighting is a
line of a file that lives on one machine. A notice of kind `failure` on the session channel
would close that gap; it is proposed to that feature, not built here.

Where the code lives. `bin/lib/failures.mjs` parses, validates and counts, from text, with no
file access, as `bin/lib/contract.mjs` does. `bin/failures.mjs` is the command and the row: it
reads the files the entries name. `bin/check.mjs` gains an import and one call, and
`bin/js-harness.mjs` one usage line and one entry; both were told to the orchestrator first,
because other sessions change those files while this is built (Progress, 2026-10-11).

### A failure with no control, measured (T3f)
Drafted on 2026-10-15 by this session, read at 09:21 by a reader that did not write it; its
changes, listed below, win over the draft where they differ (ten states, not nine, and a
measurement whose phrase is gone is `measure lost`, not `control lost`).

The need. The lead's call of 08:37, relayed by JH 15: a control can be measured and found not
worth building. The general honesty audit caught 2 or 3 of 14 (`odd/tasks/honesty-audit.md`).
Today the register has no word for that. `owed` says a control will be built, and `owed, stale`
says the box was checked, so the two entries keep a promise nobody means to keep.

The shape. A fourth form of `Control`, beside `owed` and the three levels in place:
`measured — <path> — "<phrase>" — since <YYYY-MM-DD>`. The path and the phrase name where the
measurement is written, a line of a feature document or of a report, so it may be a `.md` file.
The date is the day it was measured. It is not a placement level: it says no control sits
anywhere, and why.

The states, computed as the others are. `measured` (settled): the phrase is in the file, and no
sighting is dated after `since`. `measured, seen again` (not settled): a sighting came after the
measurement, so its count is out of date; the answer is to measure again (a new `since`) or to
build the control. `control lost`, as today: the phrase is gone from the file. The checkbox does
not matter, since a measurement is not a task. `STATES` grows from seven to nine, and the row and
the command count the two new ones like the rest.

What changes. `bin/lib/failures.mjs` (the parser, `CONTROL_SHAPES`, `entryState`, `STATES`,
`SETTLED`), its tests written first, and the header of `docs/FAILURES.md`, which explains the
shapes. Nothing is migrated: JH 15 rewrites its two entries once this lands. Out of scope: a
command that writes the measurement.

Read at 09:21 by a reader that did not write it (verdict: build with changes). What it changed:
1. A `measured` control's phrase must hold its `since` date, so measuring again means a new
   dated line in the measurement file, not a date edit on the `Control:` line
   (`told-him-unverified` has 8 sightings; a bare date edit would settle it unchecked).
2. The places that become false are not FAILURES.md's header, which explains no shapes: this
   section's "absent, owed or in place" and its list of seven states, `CONTROL_SHAPES` and the
   comments of `bin/lib/failures.mjs` (lines 10, 84-85, 315, 323), and the usage line of
   `bin/js-harness.mjs:22`, which lists the unsettled states.
3. A measurement whose phrase is gone is its own state, `measure lost` (not settled), not
   `control lost`: no control ever sat there. Ten states, not nine. A measurement replaced by a
   control is deleted, never moved to `Was`, which counts replaced controls.
4. A sighting dated the same day as `since` counts as covered (`>` stays strict), pinned by a
   test; JH 15's two rewrites date the measurement 2026-10-15, its version 4.
5. `docs/FAILURES.md` is refused as the path of any control: its own `Control:` line always
   holds its phrase.
6. For `measured`, the phrase is matched with comments and fenced blocks stripped.
7. `estimate-passed-as-fact` stays `owed`: its control waits on his call (the share check).
8. `bin/failures.mjs` needs no change: it prints any state string and pads its columns.
Tests, first: the shape with a `.md` path; refused without `since`, without the date in its
phrase, and on the register's own path; settled with the box checked or not; a later sighting;
a same-day sighting; the phrase gone; one row in `bin/failures.test.mjs`'s style; and the
existing tests of seven states (`bin/lib/failures.test.mjs:510`, `:569-571`, `:603-613`, `:311`)
updated. Built on a branch from `main`, whose FAILURES.md already points the two entries at
`odd/tasks/honesty-audit.md` T15 (this worktree is behind it).

### One home for every rule (T16)
The need, what was measured, a first design, and the protocol he approved on 2026-10-11. The
homes' declarations, the command and the row are not designed yet: each is designed, and read
by a reader that did not write it, before it is built.

The need, in his words of 2026-10-11 (the orchestrator's transcript
`7d2ae675-4bf2-4657-aff5-cde2477a4bee.jsonl`, lines 1745 and 1822, both read by this session):
"Ese error con el 73% es un problema sistemico y repetitivo donde mas de una vez tenemos cosas
viejas en un harness que debe ser seguro sin contradicciones [...] necesitamos si o si tener el
mecanismo de poder actualizar la informacion como debe ser y no queda con unas reglas viejas y
otras nuevas, eso debe quedar super prohibido"; and "tenemos que hacer un barrido completo e
identificar todos estos errores que tenemos y corregirlos ademas de hacer un protocolo que no se
como hacerlo para que estos no pase nunca mas". The incident: the share of its context at which
a session writes its state changed three times in two days (85, 90 for an hour, 88) and was
carried by hand, by messages between sessions, to each place that states it.

Measured, before designing. The sweep of that day (`docs/sweep-2026-10-11.md`, pull request 61)
found 278 stale or contradictory statements in 247 places: 158 in force in documents, 62 in
places that act, 17 dated records read as the present, 10 that could not be told. The most
repeated is not a number: the state of a feature written in prose (46 between the roadmap and
the feature documents), then the context pause (about 35 across the five layers), then gate
etiquette kept by hand after the lock replaced it (17). The pause in force, 88, is in no file of
`main` and in no branch; the Codex rate of 1,200 input tokens a changed line is in the relief
file alone. Of the fourteen contradictions listed below, four carry a value.

A first design (one home; an index `docs/RULES.md`; a row that refuses a lost home and any
phrase listed as retired) was read by two readers that did not write it, one of this session and
one of the orchestrator (relief file, line 248). Both: the skeleton is right and the detector is
wrong. The old rule was written in eleven wordings over fifteen lines, of which two example
phrases found two; a derived value escapes (`467k` for a percentage, `20 * 60 * 1000` for 1,200
s); the most harmful stale copy holds no value at all (the orchestrator skill's sentence about
"the limit", `bin/lib/manifest.mjs:85`); and nothing forced the list of retired phrases to be
written.

The protocol for changing a rule, version 3. Approved by Sebastián on 2026-10-11: "Sí, aprobado
el protocolo revisado" (the orchestrator's transcript
`130317af-a818-419c-a3de-3a21335db0a8.jsonl`, line 470, read by this session; he sent it inside
a running turn, so it is an entry of type attachment and kind `queued_command`, not an entry of
type user, which the check of a source has to know). The text put to him is the relief file's
line 253, with what three readers of the orchestrator found missing before it; his approval is
its line 254. That text calls itself this session's eight points of 2026-10-11 plus the answers
to those findings. So the letters below are the approved text, and of the eight points what no
letter restates still stands: every other text names the rule and does not repeat its value;
the roadmap's "(planned)" sections become pointers (T15, brought forward) and a memory note
holds no rule (T6, T11); superseded text is removed, not annotated.

A. Scope. Everything read as in force, of three kinds: a rule with a value, a rule in prose,
   and the state of the work. History is exempt by place only.
B. One home.
   - A value is a constant in code; messages and the skills' texts are rendered from it, and
     tests import it.
   - A rule in prose is one text, its line of `AGENTS.md` or its protocol, with an id in the
     list `docs/RULES.md`, which is rendered from the homes.
   - The state of the work is what `js-harness progress` and the board compute, and is never
     written in prose.
   - History is the `## Progress` sections, `docs/origin.md`, the sightings of
     `docs/FAILURES.md`, the closed feature documents, marked at their head, and the
     orchestrator's relief file.
   - The relief file and the memory notes are never a home: the roadmap's sentence that says
     otherwise is removed, and a session that resumes reads the list, not the relief file's
     lines 1 to 10.
   - Rules of other tools are not copied.
C. One act. One command changes the home, renders the list, stores the source, appends to the
   relief file a line that names the line it supersedes, and prints the memory update that is
   owed. A retired rule leaves its id, with its date and its successor. A revert and an urgent
   change are the same command. One rule change is open at a time, and it goes straight to
   `main`. The source is his words (the quotation and its date, stored and checked once, typed
   by him and not a paste) with the reading of them and where he accepted it; or "design", with
   its path.
D. The row. The text in force shrinks first. For each rule, a pattern finds any statement of a
   value on its subject, on added lines first. Every id that a text names resolves. The row
   reports until that rule's findings are zero on `main` and then refuses, rule by rule. A test
   plants a violation. Each refusal is a sighting.
E. The doors. The one that refuses is the merge: a command that runs the code of `main` on the
   merge result, the rule rows first. The commit reads the added lines; the push reports.
   Prerequisite: the gate stops before its sensors.
F. Reach. A hook at the start of each turn prints the difference with `main` when the rules
   changed, after a compaction too, and to a sub-agent at its start; it is confirmed first with
   a logging hook. A hash of the rules is stamped in the installed command, so that `doctor`
   can say it is behind. The template's lines sit in a marked block that `sync` renders again
   when the project did not touch it. A memory note points to the id.
G. `AGENTS.md` by draft. It is built in `docs/agents-build.md` on its own branch, one draft at a
   time, with the budget measured on the draft. His approval names the draft's hash, and the
   commit that copies it is refused on another hash. `main` never holds the draft. A direct
   edit is denied by the host's rule. The template is rendered from the same lines. No id and
   no marker goes inside `AGENTS.md`.
H. Its own home. It replaces protocol 4, opens with the incident of the relief file's line 245
   (his words of 2026-10-11 on a stale 73 percent: the orchestrator's transcript
   `7d2ae675-4bf2-4657-aff5-cde2477a4bee.jsonl`, line 1745), and carries its cost and a review
   date. Done is one command that exits 0.

Added by the orchestrator in the same line, outside the letters and found by none of its
readers: rules of other tools (gentle-ai's managed block, his global instructions) are not this
repository's text, and where this project differs the difference is one rule here; each rule
records whose it is, and a rule of his changes only with his words; a red row that is wrong is
switched to report for that rule by the same command, with a reason, and counted, never passed
with `--no-verify`; the sweep becomes a brief that is repeated at each phase close, and its
count is the measure.

The order: this text in this document; the gate's early stop; the homes and the list; the
corrections, by owner; the row, reporting and then refusing rule by rule; the merge command;
reach; the rewrite of `AGENTS.md` (T8).

Not guaranteed, and said to him: a rule in prose restated without its id; two rules that
contradict without sharing a value; anything passed with `--no-verify`, until the merge; the
merge button on GitHub (closing it is spend, his, later); a session's own context until its
next turn; what engram holds; a project that never runs `sync`; that a quotation means what the
rule says.

What his yes includes, as it was named to him: (1) the orchestrator may run the one rule-change
command, an exception to its rule of never committing, because otherwise changing a number
needs a session he must open; (2) a standing yes to what a rule change needs on his machine:
the update of the installed command and skills, and the turn-start hook, opt-in by project,
recorded, removed by `uninstall`; (3) the orchestrator turns a memory note that restates a rule
into a pointer, and deleting a note stays his; (4) the draft is `docs/agents-build.md`, and one
commit copies it and deletes it. Not in it: a run on GitHub. None of (1) to (3) can be used
before the command, the hook and the list exist. This session's reading, in neither line: the
reply hook of T2 is not the turn-start hook, and is still asked of him.

Where the approved text and the eight points differ, where the approved text pulls two ways,
and what it leaves open. Each is told to the orchestrator with this session's reading, and
none is chosen in silence:
1. When the row refuses. The eight points refused once the whole sweep's list was empty; the
   approved text refuses rule by rule. Taken as approved: the whole list waits on forty places
   that are his.
2. Where a retired id and a source are stored. The list is rendered from the homes, a retired
   rule has no home, and the eight points forbade an index kept by hand. This session's
   reading: a rule is declared once, beside its home, as data (`id`, whose it is, its source,
   the day it entered, and for a rule in prose a phrase of its text, found the way the
   failures register finds a control); a retired rule keeps its declaration with its date and
   its successor and no value; `docs/RULES.md` is rendered from the declarations and nothing
   else. That is an index under another name, and it is said: what differs from the one the
   eight points forbade is that only the command writes it and the row refuses a declaration
   that its home no longer bears out.
3. "Straight to `main`". A value is a constant in code, so its change is a code commit: by
   this repository's rules that is a gate and two reviews, and the push check refuses a branch
   whose code commits no Codex record covers. This session's reading: the command runs the gate
   and refuses when it fails; whether its commit is exempt from the two reviews, or the
   declarations are data that the reviews do not count, is not in the approved text and is the
   orchestrator's to put to him. The orchestrator's reading of what he approved, not his
   words, and his to correct (its message of 2026-10-11): no review is left out. A value in a
   constant is code, so its change passes the gate and both reviews, and the push rule stands;
   "straight to `main`" means a pull request of its own against `main`, never riding a
   feature branch. The cost is written beside each change (one gate and a small Codex review),
   and if it proves too dear that becomes a question for him, with the numbers.
4. The order of homes and corrections. The approved order puts the homes before the
   corrections; the 83 corrections of T17b were merged before any home existed. Where a value
   had no home they say what the rule is and where his words are recorded, which is not a home.
   Those places are read again when the list exists, and each pointer becomes the rule's id.
5. What the commit does. The approved text pulls two ways here: D has the row refuse, rule by
   rule; E says the door that refuses is the merge, and that the commit reads the added lines.
   The eight points had the commit refuse on the lines a change adds, where the author pays in
   seconds. This session's reading: the commit refuses an added line for a rule whose row
   already refuses, and reports for the others; the merge refuses on the whole result.
6. A value inside a document. Open in the eight points (a span rendered from the home, or
   none), and the approved text does not settle it: it renders messages and the skills' texts,
   and F renders a marked block of a project's `AGENTS.md`. This session's reading, still
   open: no other document carries a value, and no span is built for one.
7. A rule in prose whose home is a line of `AGENTS.md`. C changes a home by one command,
   straight to `main`; G lets `AGENTS.md` change only by a draft on its own branch that he
   approves by its hash, with a direct edit denied. Both cannot hold for such a line. This
   session's reading: G governs `AGENTS.md`, and for it the one command of C is the commit
   that copies the approved draft; C as written covers a value and the text of a protocol.
   The orchestrator's reading, the same and one step further (its message of 2026-10-11; his
   words on the draft are the relief file's line 203): a change of one line of `AGENTS.md`
   also goes through the hashed draft and his approval; for such a rule the command of C does
   the bookkeeping (the declaration, the source, the list) and refuses unless the change of
   `AGENTS.md` arrives by the approved draft.
8. The home of a value. The first of the eight points made a value a constant "wherever a
   command can hold it" and otherwise gave it the message of its check, its line of
   `AGENTS.md` or its protocol; B says only that a value is a constant in code. This session's
   reading: a value that no command can hold is a rule in prose, and its text is its home.
9. The list in a project that only installs the harness. Open in the eight points, and still
   open: the approved text places `docs/RULES.md` here and says nothing of where an installed
   project's own list lives. It is his, a product choice (whether an installed project gets
   the mechanism for its own rules, beyond the template's block that `sync` renders); the
   orchestrator keeps it in the queue of his decisions, and nothing of T16 before T9 needs it.

A rule he wants in the harness, in the same words as his approval: "Siempre me gustaria hacewr
asi una doble revision con mejora quiero añadirlo al harness siempre obtenes mejores
resultados". Read by the orchestrator as the need and not as the wording (relief file, line
254): what is put to him to decide (a protocol, the design of a feature, a change of the
charter) passes first an independent review and comes back improved, and more than once when
the first round still finds holes. Only its shape is not designed. The orchestrator's reading
of the shape, not his words: his earlier words on the subject are searched and the search is
named; a reader that did not write the proposal attacks it; a second reader looks only for
what is missing; the improved version says what each review changed and what stays not
guaranteed. Where it enters, by the same line: this feature, as an amendment of the protocol
on proposing and not as a new one (this session's reading: protocol 1 below), with the five
questions, of which the line answers two: it happened, three times that day; and a check can
hold part of it, since the reply check can refuse a decision block of that kind that names no
review. Its cost on that day: about 500,000 tokens of sub-agents and 25 minutes for the second
round of three readers. A memory note of the orchestrator holds it until then.

His, and not asked yet: a run of the static rows on `main` after each merge, on GitHub (spend).

Needs of others, placed by the orchestrator. The gate stops before its sensors when a static
row already fails, and the lock becomes a line by arrival: a session opened for it that day,
"JH 8 · turno y corte temprano del gate" (relief file, line 254), which by its own message
keeps its design in `odd/tasks/gate-turn.md` on `feat/gate-turn`, not read by this session yet.
The entry of the context pause is written when JH 5's fourth slice is on `main` (relief file,
line 247).

### How a rule is declared (T16b)
Designed on 2026-10-11, after a read-only explorer mapped what exists and two readers that did
not write it read the first draft, one to attack it and one to find what it lacks. It designs
letter B of the approved protocol and the second of the nine differences. Not built.

What exists today, on `main` at `40ccb45` (the explorer's report, not read again line by line):
- No list of rules and no module of constants (`docs/RULES*`, `bin/lib/*rule*`,
  `bin/lib/*constant*`: nothing).
- Values with an exported constant: the wait for the lock (`bin/lib/gate-lock.mjs:42`, 60
  minutes); a review part (`bin/lib/codex-review-parts.mjs:19` and `:27`, 400 lines and 40 files;
  `bin/lib/codex-review-plan.mjs:46`, 6 parts); the review's model and effort
  (`bin/codex-review.mjs:173-174`).
- Values whose constant is not exported, so no test can import them: the gate's bound
  (`bin/check.mjs:79`, 20 minutes), the budget of `AGENTS.md` (`bin/check.mjs:23`, 1,500), a
  review's timeout (`bin/codex-review.mjs:641`, 30 minutes), a contract run's timeout
  (`bin/contract.mjs:16`).
- Values with no constant anywhere in `bin/`: the context pause (88; the board holds the older
  73 at `bin/lib/sessions.mjs:21` and a window of 480,000 at `:14`, both changed by a branch not
  merged); the Codex rate (1,200 input tokens a changed line); the size of a reviewed commit
  (about 1,200 lines); three work sessions; the models and efforts of sub-agents.
- Copies not derived, in code that acts: "60 minutes at most" in the `js-harness` skill
  (`bin/lib/manifest.mjs:26`, pinned by `bin/lib/manifest.test.mjs:1291`) and "(73%)" in an error
  (`bin/sessions.mjs:169`). The skills' texts interpolate only the version. The wait is also
  written "an hour" in comments (`bin/check.mjs:983`, `bin/gate.mjs:164`,
  `bin/lib/gate-lock.mjs:319`).
- The package ships `bin/` and `AGENTS.md` and not `docs/` (`package.json:9-12`).

**The decision.** Every declaration lives in one module that is data and nothing else,
`bin/lib/rules-data.mjs`, and for a rule with a value the declaration is the home: the value is
written there, in the unit a person says it in (minutes, percent, lines), and nowhere else. The
code that needs it reads it (`ruleValue('gate-wait', 'minutes') * 60_000`), so a derived form is
computed and never written. This changes two of this session's readings, and the orchestrator
is told:
- Difference 2 said "declared once, beside its home". Beside is still two places, and the one
  command of letter C would have to edit a constant in whichever source file holds it, by
  pattern. With the value inside the declaration the command rewrites one file whose whole
  shape it owns.
- Difference 8 said a value no command can hold is a rule in prose. The module can hold any
  value, read by code or not, so the Codex rate can have a home before any command applies it.
It keeps the approved letter: the value is a constant in code, and its change is a code commit
(gate, both reviews, a pull request of its own).

What is declared. A value is a rule when it is stated, or would be, outside the code that reads
it in a text in force (the roadmap, a skill, `AGENTS.md`, an open feature document, a message to
a person), or when a person decided it. A tuning constant nobody states stays where it is. The
state of the work, the third kind of letter A, is out of the declarations on purpose: `progress`
and the board compute it.

**The declaration.** One object per rule in `RULES`, sorted by id.
- `id`: lower case and hyphens, unique, never reused. A rule that returns after it was retired
  is a new id; a rule in prose that becomes a value keeps its id.
- `subject`: a label of what the rule is about, with no value in it ("the wait for a turn of
  the gate lock"). It is not the rule's text.
- `owner`: `sebastian` or `project`. A rule of his has a source of his words, and only that.
- `since`: the day the value or the text in force entered.
- Exactly one of three bodies:
  - A value: `value` (a number or a string) and `unit` (required for a number). Optional
    `flag`, the option that overrides it for one run (`--wait`): the value is then a default,
    and the list says so. Optional `was`, the earlier values with the day each ended, newest
    first, so that a reader holding an old number finds it. A pair is two rules (a model and its
    effort); a rule with a value and a behaviour is two rules, the second in prose and naming
    the first.
  - A text: `path` and `phrases`, one or more pieces of the rule's text, twelve characters or
    more each, all found in the file the way the failures register finds a control
    (`holdsPhrase`, white space squashed). A list (the things that are his to decide) is a rule
    in prose with one phrase for each item. No id and no marker enters `AGENTS.md`.
  - `retired`, the day, with `successors`, a list of ids that may be empty (a split has two): a
    retired rule keeps its id, its subject, its owner and its `was`, with its unit when those
    earlier values are numbers (found by Codex: without it "60 until 2026-10-11" no longer says
    minutes), and no value and no text.
- Optional, for the letters built later, so that the shape does not change under them:
  - `patterns` (T16d): the patterns that find a statement of a value on the rule's subject, one
    per line of text, in any wording or unit ("1,200 s" for twenty minutes, "an hour").
  - `row` (T16d): absent while the rule's row reports; `{ refuses: <day> }` from the day its
    findings were zero on `main`; `{ reports: <reason>, since: <day> }` when a red row that is
    wrong is switched back by the command. Stored, not computed, so that a new finding cannot
    turn a refusing rule into a reporting one.
  - `failure` (T16d): the id in `docs/FAILURES.md` under which a refusal is a sighting.
  - `differs`: for a rule that exists because this project differs from another tool, that
    tool and its rule. Rules of other tools are not declared otherwise.
  - `review`: a day on which the rule is looked at again, for a rule that is temporary.

**The source is kept apart**, in `docs/rule-sources.json`, keyed by id and written by the same
command: a quotation of his and the place of a transcript are not shipped to every project that
installs the package. One of the two kinds the approved text has:
- `words`: the quotation, its day, the session id and the line of the transcript, the reading
  of it, where he accepted the reading, and `checked`, the day and who checked the line (the
  command of T16c, or the session that seeded it). The check is the one `quoteOf` of
  `bin/lib/sessions.mjs` already makes: an entry he typed, not a paste.
- `design`: a path in the repository.
There is no third kind. A value whose source cannot be traced to one of the two is not declared:
it is named in this document with what is missing, and stays where it is.

How a text names a rule: `rule:<id>` in code marks. The texts read are those in force: the
roadmap, `docs/SPEC.md`, the open feature documents outside `## Progress`, the skills' texts as
rendered, and the project template. Places that are history by letter B, and fenced blocks, are
not read. Every id found resolves; one that resolves to a retired rule is reported with its
successors.

**The files.**
- `bin/lib/rules-data.mjs`: `export const RULES`, in the one shape `writeRules` gives. It
  imports nothing, so any module may import it. Until the command of T16c exists it is written
  by hand in that shape, and the list's first lines say so.
- `bin/lib/rules.mjs`, which imports the data and nothing that reads a rule:
  - `readRules(list)`: what makes a list of declarations unreadable.
  - `ruleValue(id, unit)`: the value; it throws for an unknown id, a rule with no value, and a
    unit that is not the declared one, so a unit never changes under a multiplication.
  - `writeRules(list)`: the text of `rules-data.mjs`, the serializer T16c will use.
  - `renderList(list, sources)`: the text of `docs/RULES.md`.
  - `rulesHash(list)`: a hash of ids, bodies and retirements, for letter F.
- `bin/lib/rules-check.mjs`, what needs the file system, each finding with its rule: a phrase
  its file no longer holds; a call of `ruleValue` in `bin/` that names an id with no value (a
  retired rule that code still reads is found here, before it is merged); a live rule with no
  source, or a rule of his whose source is not his words; an id named by a text that does not
  resolve; `rules-data.mjs` different from `writeRules` of itself; `docs/RULES.md` different
  from its rendering. Who reads a value is found by that scan and never declared.
- `bin/rules.mjs`, the command `js-harness rules`: the list; `rules <id>` one declaration with
  its source and who reads it; `rules check`, exit 1 on a finding; `rules render` writes
  `docs/RULES.md`. It imports no module that reads a rule, and runs as `node bin/rules.mjs`
  when the dispatcher cannot load.
- `docs/RULES.md`, rendered, and the one text that shows a value because nobody writes it. Its
  head: that it is rendered and how a rule is changed, the hash, the counts. Then the rules of
  his and the project's, one line each: id, subject, value with unit or the sentence of its
  text that holds the first phrase, the flag that overrides it, the earlier values, who reads
  it or "read by: none", since, the state of its row, where its source is. Retired rules last.
  In an installed project there is no `docs/RULES.md` and no sources file: `js-harness rules` is
  the list there, and `rules check` says which checks it left out.

**What T16b builds, in two slices.**
1. The library, the command, the sources file, `docs/RULES.md`, and the declarations of two
   groups. The values whose constant is exported: the wait for the lock, the three bounds of a
   review part, the review's model and effort; each constant is bound to its declaration by a
   test until it is rewired. The values no code holds, each only with a source of one of the
   two kinds, as the orchestrator's explorer found them and this session read them:
   - the models and the effort of sub-agents are his, in his words (the transcripts
     `182ad401-252a-4cbe-afcc-929fcd905c6a.jsonl`, line 990, of 2026-10-10: Haiku only to write
     code, at least Opus 5.5 at high for the rest; `729ed66b-83fe-4cf2-809a-2edf5c5c4462.jsonl`,
     line 7049, of 2026-10-07: always high; `130317af-a818-419c-a3de-3a21335db0a8.jsonl`, line
     2037, of 2026-10-11; the first two read by this session with `sessions --quote`). That
     "the rest" means the sub-agents that explore, review and verify is the orchestrator's
     reading, stored as the reading;
   - the size of a reviewed commit is the project's, by design (`odd/tasks/gate-lock.md:697-698`);
   - the Codex rate and the number of work sessions are left out: each number was the
     orchestrator's, approved by him inside a whole list and never by itself (its message of
     2026-10-11). The orchestrator asks him whether they stand; they enter with his answer, with
     no change of shape.
   A test runs `rules check` on the real tree, so
   the gate holds the list with no change to `bin/check.mjs`; the row is T16d. One shared file
   is touched, told first: `bin/js-harness.mjs`, for the command's entry.
2. The rewiring, one file at a time, each told to the orchestrator before it is touched because
   other sessions edit them (`bin/check.mjs`, `bin/lib/gate-lock.mjs`, `bin/lib/manifest.mjs`,
   `bin/codex-review.mjs`, `bin/contract.mjs`): the constant reads the declaration, the skill's
   text and the messages interpolate it, the tests import it. The four values whose constant is
   not exported are declared here, in the commit that rewires them, never before. Done for a
   file when no test of it states the value as a literal.
   The values the second reader found that the first draft did not name wait in this queue,
   each declared or left with its reason when its file is reached: the shortest phrase of a
   control (`bin/lib/failures.mjs:19`), the channel's four limits (`bin/lib/channel.mjs:35-44`),
   the exit code of a wait that gave up (`bin/gate.mjs:37`), the gate log's size
   (`bin/lib/gate-log.mjs:26`), the runs a plan needs (`bin/lib/codex-review-plan.mjs:51,54`),
   the prompt's bound (`bin/lib/codex-review-prompt.mjs:45`), the board's timeout
   (`bin/sessions.mjs:64`), the goal's length (`bin/contract.mjs:21`), the efforts a contract
   takes (`bin/lib/contract.mjs:32`), the review's session (`bin/codex-review.mjs:200`).
Not in T16b: the context pause and the window, declared when the branch that changes them is on
`main`; the rules in prose, declared with their homes (T8 for `AGENTS.md`, the protocols skill).

**Where the rest of the protocol lands.** T16c, the command: the check of his words, the relief
line that names the one it supersedes, the memory update owed, the mark of the one change that
is open, a retirement refused while the scan finds a reader, a change of a phrase of
`AGENTS.md` arriving only by the approved draft. T16d: the patterns, the row, the sightings.
T16f: `diffRules` and where the last hash seen is kept, the hash in the installed command, which
rules reach an installed project (a field added then; the ninth difference is his), the
orchestrator skill's "read the relief file" becoming "read the list", which cannot happen
before the context pause is declared. T15 and T8: the roadmap's sentence that makes the relief
file a home is removed.

**Tests first.** Each refusal of `readRules` seen failing first on a fixture: two ids alike; no
body or two; a number with no unit; a retired rule with a value; a successor that does not
resolve; a phrase under twelve characters; a subject that holds a digit; an unknown owner; a
list not sorted by id. `ruleValue`: its three throws. `writeRules`: the real file equals
`writeRules` of what it exports, byte for byte, and with either line ending. `renderList`: an
expected text. `rules-check`: each finding on a fixture project, a call of `ruleValue` found in
single and in double quotes, and a planted violation on a copy of the real list. That
`rules-data.mjs` has no import. The command through the dispatcher and on its own. The bindings
of slice 1, one per constant.

**Not guaranteed.** A hand edit of `rules-data.mjs` that keeps its shape passes, until T16c. A
value with no reader is borne out by nothing: the list prints "read by: none". A value restated
in a text with no `rule:<id>` beside it, in another wording or with no number at all ("past the
limit"), is found only by its rule's patterns, in T16d, and the declarations alone make that
detector no better. A text whose phrases survive a rewrite that changes its meaning keeps its
`since` and its source. A call of `ruleValue` whose result is ignored. A mistyped id in code
stops every command when it loads, and the gate with it: the test on the real tree is what
keeps it off `main`. A source of his words seeded by this session is as good as its reading of
the transcript line, and is marked as checked by a session.

**Cost.** One import and one call where a constant was a literal; a reader of the code follows
one hop to learn a number. A change of a value is one line of one file, and a code commit.

What the two readers changed. The attack: who reads a value and where copies stand are found by
a scan and no longer declared by hand (the first draft's two lists were the hand-kept index
again); slice 1 declares only what a test can bind, so the list shows nothing the code could
contradict; the third kind of source is gone; a rule's text is rendered from its home and the
declaration holds only a label; the sources left the shipped package; the load-time throw is
kept and its cost said. What was missing: the stored state of a rule's row, the earlier values,
the overriding flag, the unit checked at the read, several phrases for a list, successors as a
list, the serializer and its round trip, the hash, the texts the id scan reads, and where each
later letter lands.

### Model and effort as rules (T16b, third part)
Designed on 2026-10-12, after a read-only explorer mapped what the code and the records hold and
three readers that did not write it read it in two rounds: one to attack the first draft, one to
find what it lacks, and a third on the two decisions the first round turned over; what each
changed is the last paragraph. Not built. It designs B1 of
`docs/model-effort.md`: the table of model and effort by kind of work has one home, the rules
list; each row carries its value, its source, the engine version and the model id it was checked
on, and its date; a new engine version or a new model marks the rows stale; rows are marked
shipped or local. It builds on "How a rule is declared (T16b)" and changes of it only what "What
the first slice gains" lists. The rewiring stays the second part; this is the third, a task of
its own in the list.

What exists (the explorer's report and the attacking reader's counts, both of 2026-10-12, and one
sample read by this session):
- Five rows are declared, with nobody reading them: `review-model`, `review-effort`,
  `subagent-effort`, `subagent-reader-model`, `subagent-writer-model`
  (`bin/lib/rules-data.mjs:41-52`, `:89-107`). The three sub-agent values are names a person says
  ("Haiku 5.5"), not what a record holds.
- No code under `bin/` reads the Claude Code version. The records hold it: an assistant entry of
  a transcript carries `version`, `effort` and `message.model`, for a session and for a
  sub-agent, on 213 of 215 launches back to engine 2.1.281. A model can be `<synthetic>`, which
  `bin/lib/sessions.mjs:157` already skips, and an id can end in a date
  (`claude-haiku-4-5-20251001`).
- A sub-agent leaves two files under `<session>/subagents/`: `agent-<id>.meta.json` with the
  short name passed on the call (`model`: `haiku`, `opus`, `sonnet`; never a full id), its
  `effort` and its `agentType`; and `agent-<id>.jsonl`, whose assistant entries hold the model
  that answered. 97 of 215 launches passed no model, and those do not always run on the
  session's: the agent type can set it (`claude-code-guide` was answered by a Haiku). 57 passed
  `sonnet`: gentle-ai's own reviewers, another tool's agents.
- The call cannot pass a full id, and what a short name gives is the engine's: `haiku` gave Haiku
  4.5 on 2.1.292 (`evals/configs.mjs:281`) and on 2.1.286 (a launch of 2026-10-04), and
  `claude-haiku-5-5` on 2.1.295.
- Two engines write into this project's records on the same days: 2.1.295, and 2.1.296 from
  another entry point with four launches and no model passed. So "the newest engine" is not the
  engine in use.
- The Codex review measures itself: it reads the model and the effort its session ran on from
  the rollout file, refuses a review that ran on another (`bin/codex-review.mjs:753-757`,
  `:1516-1519`) and writes the Codex version on each line of its run log (`:1417`).
- The package ships `bin/`, so `bin/lib/rules-data.mjs` reaches every project that installs it,
  with this repository's ways of working in it (three work sessions, his Codex rate).

**The decisions.**

1. A row of the table is two rules, as a pair already is. An effort rule is the level, exact:
   "never low, above high only with a measurement" needs no rule of its own while every row says
   high. Declared in this part, each only with a source of one of the two kinds:
   - `session-model` and `session-effort`, new: what a session runs on (design, a protocol,
     verification, review, orchestrating, a build): his words of 2026-10-10 (`182ad401-…`, line
     990, read by this session for the first slice).
   - `subagent-writer-model`, `subagent-reader-model`, `subagent-effort`: declared; the two
     models change form (2).
   - `review-model`, `review-effort`: declared, unchanged.
   Not declared, each with its reason:
   - The trial of medium on a closed-scope build. The text he decided on says it "becomes a rule
     only by C2", the opening of his rule it needs is not decided (F3), and the line that opened
     it names neither medium nor a trial. It is a measurement in progress, recorded in this
     document; a check that finds a session at medium finds a difference, and the record of the
     trial is what explains it.
   - A Codex work session. His words of 2026-09-29 say high, his later words allow more for a
     review, and his machine is set above high (`docs/model-effort.md`, G): the source does not
     settle one value, so it is his to say first.
   - Documentation: not decided.
   - gentle-ai's reviewers, the agent types that set their own model, the evals: another tool's,
     the engine's, and a measurement's own settings. None is a rule here; `rules applied` shows
     the first two by agent type so that they are seen and not taken for a breach.

2. The value of a model rule is the id a record holds (`claude-haiku-5-5`), not the name a person
   says: a check compares records, and code that reads the rule needs the string the host knows.
   That his "haiku" is that id goes in the source as the reading, his to correct, as
   `review-model` already does for "sol 6.1". The subject of the reader's rule loses "least": his
   words allow Opus 5.5 and, once it exists, Fable 5.5, "ningun otro modelo hasta la fecha", so
   today it is one id, and the day a second is allowed the rule changes with his words. The
   change of form rides the commit that corrects the first slice after its Codex review, before
   the list reaches `main`, so the list never shows the names and no `was` records a change
   that was none.

3. One new optional field of a value body, `alias`: the short name the host takes where the id
   cannot be passed (`haiku` for `subagent-writer-model`, `opus` for the reader's). It is how
   the project applies his rule, not his decision: it is recorded in the source's reading, and
   an engine that gives another model for the name changes the alias, or the way of launching,
   with no new words of his. It is in the hash.

4. "The engine version and the model id it was checked on, and its date" is computed from the
   records and stored nowhere. Stored, it would be a line someone must remember to write at each
   engine release, and a mark written by hand can be false: the reason the failures register
   computes its states. `js-harness rules applied` reads the records of the project it is run in,
   on this machine, and prints for each rule with an alias one line for each engine in the
   window. An engine is an entry point and a version (the same version writes as the desktop app
   and as the command line, and only one of them may have launched anything), in numeric order.
   A launch's day is the time of its first assistant entry, never the file's: the host rewrites
   old files in batches. Each line holds:
   - the launches that passed the alias on or after the rule's `since`, by the model that
     answered, with the day of the last;
   - `agrees` when every one was answered by the rule's value (a date at the end of an id is not
     part of it);
   - `differed` when one was not, with the id and the file;
   - `no launch yet` when the engine has an entry on or after `since` and no launch passed the
     alias on it. This is the stale mark, engine by engine, and the next launch settles it.
   What the alias gives today is its most recent launch on each entry point: when that one was
   answered by another model the line says `differs`, the command exits 1 and prints the line to
   send to the lead. An older difference on an engine that has launched since is shown and does
   not fail. A change of a value's form never moves `since`.
   Then, once: the short names passed that no rule's alias names, by agent type; the launches
   that passed no model, by agent type and the model that answered; each model id that no rule's
   value names; and what it read (the days, the files, the ones it could not read, whether the
   cap cut the window). An entry with no version or a `<synthetic>` model is skipped and counted.
   A project with no records prints that and exits 0.
   For a rule with no alias nothing here depends on the engine, and the command says who holds
   it: `review-model` and `review-effort` by `codex-review` itself, at every review; the session
   rows and the sub-agents' effort by the check of B3.
   It is not part of `rules check` and not of the gate: the answer depends on the machine and on
   the day, and a gate turned red by an engine that updated itself would be a false red. Its
   place among the machine's facts is a row of `doctor`, a later task that touches a shared file
   and is told first. The head of `docs/RULES.md` gains one line: the list holds no engine and no
   date, and `js-harness rules applied` prints them.

5. The read is bounded, because a read of every transcript loaded the machine before
   (`board-read-loads-gate`). `bin/lib/rules-applied.mjs` picks the sub-agent files changed in
   the last seven days, newest first and at most 500, and reads of each the meta file whole and
   the transcript up to its first assistant entry, at most 1 MB (the largest seen ends at 257
   KB); a launch whose entry is older than seven days is then left out. For the session files
   changed in the same days: the last assistant entry, read from the end in doubling steps from
   64 KB to 1 MB (the farthest seen starts 52 KB from the end). The pure part,
   `appliedOf(rules, launches, sessions, today)`, takes entries; the reader of files is apart,
   so no test reads his home.
   Two roots, both printed: the records are those of the main checkout, whatever worktree the
   command runs in (the host keeps one folder for all of them; `mainCheckout` and `projectSlug`
   exist, imported and not changed), and the project is the git top level of where it runs. The
   form `applied` does not run the check of the list: it reads no document.
   The list of launches (alias, id, effort, agent type, engine, day, file) is what the check of
   B3 and C8 of this document (T13) need: one reader of those files, offered to whoever builds
   that check.

6. Shipped or local is a field, `scope: "repository"`, absent for a rule of the harness wherever
   it is installed. Marked `repository`: the Codex rate and floor, the size of a reviewed commit,
   the number of work sessions, and the five rows of session and sub-agent. Not marked: the two
   of the Codex review, which the shipped command fixes for anyone. The rows of session and
   sub-agent are marked because what the harness turns on in a project by default is his and not
   answered (the roadmap's list of his decisions, item 6); the day he answers, the mark of those
   rows is removed or stays, and nothing else changes.
   A rule of scope `repository` is in force only in the repository that declares it: a project
   whose own `bin/lib/rules-data.mjs` is, line endings apart, the list the running copy holds.
   A project that installs the harness has no such file. This repository has it, and so does
   each of its worktrees; and when the copy that runs is the installed one and is behind the
   checkout, the two differ and no value is given, which is the truth: that copy does not know
   the rule as it stands. So:
   - `ruleValue` refuses such a rule, and `rules check` finds the call. Code that ships reads it
     with `ruleHere(id, unit, projectData)`, given the text of the project's file or nothing,
     and gets the value, or that the rule is not of this project, or that the copy is behind.
     The reader has to say what it does in each case (`contract goal` prints no mode, or that
     the installed command is behind; `rules applied` leaves the rule out and says how many it
     left out). It is called where the project is known, never when a module loads: the
     rewiring's "the constant reads its declaration" is for rules with no scope.
     `ruleOf(id)` gives a declaration, for a text that names the alias.
   - That is the path B2 and B3 need: their code ships and reads this table, and with the mark
     it acts here and is silent in a project until he decides otherwise. For B5: a skill's text
     is written into his home when the harness is installed, where no project is known, so it
     never holds a value of such a rule; it names the command that prints it.
   - One JSON line in a project cannot switch a rule of his on: the switch is the whole list.
   - `docs/RULES.md`, `js-harness rules` and `rules <id>` show the mark. The plain listing still
     reads no file.
   - The hash stamped in an installed command (letter F, T16f) is taken over the rules with no
     scope, so that a change of his Codex rate does not call every installed copy behind in
     every project; in this repository the comparison above is what says it: named here, built
     there.
   - When the skills' texts and the template are among the texts scanned (T16d, T16f), a
     `rule:<id>` of scope `repository` in them is a finding: named here, built there.
   The values of those rules still travel inside `rules-data.mjs`; no words of his do. Whether an
   installed project gets a list of its own is the ninth difference, his, and nothing here
   needs it.

**What the first slice gains**, so that the shape changes once: `alias` and `scope` in the keys
`readRules` accepts, in the order `writeRules` gives and in the hash (`bin/lib/rules.mjs:12-18`,
`:295-300`); `renderList` prints the alias, the scope, and the `review` day, which is accepted
today and printed nowhere; the scan of readers finds `ruleHere(` and `ruleOf(` beside
`ruleValue(` (`bin/lib/rules-check.mjs:11`), for "Read by" and for the refusal of (6); the
command takes the word `applied`, and its head no longer says it reads only under the package;
the readings of the two model rules in `docs/rule-sources.json`; the list rendered again, with a
new hash.

**A change before T16c exists.** By hand, in the shape `writeRules` gives, with the source edited
in the same commit: a code commit through the gate and both reviews, in a pull request of its
own. A rule of his changes only with his words by transcript line; an alias changes with a
reading.

**Tests first.** `readRules`: an alias on a rule with no value; an alias that is not one short
lower-case word; a scope that is not `repository`. `rulesHash` moves with each. `ruleValue`
refuses a rule of scope `repository`; `ruleHere` gives the value when the project's file is the
running list, with either line ending, says "not of this project" with no file and "behind" with
another list, and throws as `ruleValue` does for the rest. `appliedOf`, on entries written in
the test: `agrees`; `differs` on the most recent launch, exit 1; `differed` on an older one,
exit 0; a launch before `since` not counted; one version on two entry points, one with no
launch; an engine whose entries are all before `since`, with no line; a dated id; a
`<synthetic>` model and an entry with no version skipped; a short name no rule names; a launch
with no model. The reader: a temporary folder with two launches, one transcript cut short, a
file changed today whose entry is a month old, and a session whose last assistant entry is past
64 KB. `rules-check`:
`ruleValue` of a `repository` rule under `bin/`; a `ruleHere` call listed as a reader. The
command: `rules applied` on a temporary records folder, its exit 1, a project with no sources.
`renderList`: an expected text with an alias, a scope and a review day.

**Not guaranteed.** That a writer was launched with the alias at all: that is the check of B3.
A launch older than seven days, or past the cap. A machine whose records were cleared, and a
host that keeps none (Codex): the command says it read nothing. A sub-agent resumed on another
engine: its first entry gives the older one. A model that exists and nobody used. An engine that
renames an effort level. Code that walks the whole of `RULES` instead of naming an id escapes
the refusal of (6). `rules applied` not run: until the row of `doctor` exists, a session runs
it. A project that copies the whole list into its own `bin/lib/rules-data.mjs` switches his
rules on for itself: a deliberate act, not an accident. A read from `evals/`, which the scan
of readers does not cover. The texts that state a model or an effort in other words (the roadmap's rows, `docs/model-effort.md`'s table, which is the text he
decided on and not a home) are found only by a rule's patterns, in T16d.

**Told, and to whom.** The orchestrator: where this differs from B1 as he let it enter the plan
(the engine, the id and the date are computed and not stored; a model's value is the id; the
trial and the Codex work session are not declared; "local" is a rule in force only in the
repository that declares it, read by shipped code through a guarded read); that T13 of this
document and B3 are one check; that B4 had no owner in the proposal; the two things on his machine that the proposal's G already holds. The session of the session channel,
through the orchestrator: `ruleHere`, `ruleOf`, the list of launches, and that
`bin/lib/sessions.mjs` gains an importer.
Settled by the orchestrator the same day (its message of 2026-10-12, a peer's and not his
words): T13 and the checking half of B3 are one check and this session's, since it reads the
launches; the session channel's session keeps B2, the applying half of B3 and B5; B4 is this
session's, with the alias. The first three differences and the last stand as design and are
told to him in a recap. What a Codex work session runs at, and what the harness turns on by
default in a project (item 6 of his decisions), go to him one at a time; both stay undeclared
until he answers.

**Cost.** One command more and one module that reads his home's records, bounded. Two declared
values change form and five rows gain a mark. Every shipped reader of a `repository` rule writes
one more branch: what it does where the rule is not in force.

What the readers changed, three of them in two rounds. The second round, one reader on the two
decisions the first had turned over: "in force where the source is recorded" had no project root
the code agrees on, took the switch from one copy and the value from another, and could be
turned on by one line of JSON, so the switch became the list itself; a launch's day comes from
its entry and not from the file, because old files are rewritten in batches; an engine is an
entry point and a version; the exit is 1 only for what the alias gives today; a skill's text
holds no value of a scoped rule; `session-effort` cites the line that opened the trial. The first
round, the attack: the state is given engine by engine, because two
engines write on the same days and "the newest" was a false stale mark that would not heal; a
launch is compared only from the rule's `since`, with dated ids and `<synthetic>` handled; the
trial is not a rule; the refusal of every read under `bin/` became a guarded read, because it
refused this design's own command and the three parts another session builds; the floor in the
reader's subject is gone; the tail read steps back; "inherits the session's" was false. What was
missing: the path for B2, B3 and B5; what the first slice gains, field by field; the change path
before T16c; the kinds of work that are not rules, each with its reason; what computing loses,
said under "Not guaranteed" and in the list's head; the hash of an installed copy; T13 and B4;
who is told what; and that this is a third part with a task of its own.

### The plan against its allowance (T16b, second part: the reader of the margin)
Three rules of his bound what a Codex review may cost without asking him: `codex-review-floor`
(300,000 input tokens a review), `codex-review-rate` (1,200 a changed line) and
`codex-review-margin` (5 percent). Until now nothing read them: each session took the plan's
figure and did the sum by hand, and the sum was done differently by different sessions. This
piece makes `codex-review --plan` do it and say the result.

- **What it says.** One more line after the plan's own, only for `--plan`: the allowance, how
  it was reached, and whether the estimate is inside it. Four cases, each a sentence of its own:
  inside; over the allowance by no more than the margin, which counts as inside; over it by
  more, so the spend is to be approved before the review runs; and no estimate, so the plan
  cannot say and nothing stands in for one.
- **Which figure.** The plan gives a range. The verdict follows the first figure, the estimate,
  because the accepted reading of the margin says "the estimate is the input tokens
  `codex-review --plan` gives" and the plan itself calls its higher figure "no ceiling". When
  the higher figure passes what counts as inside while the estimate does not, the line says so
  as a fact and the verdict does not change. Whether the higher figure should decide is not
  settled here: it would ask him more often, which is his to choose.
- **Which lines.** The changed lines the plan holds: those of the files the review reads, the
  files left out not counted. It is the smaller of the two counts a session could take, so it
  never gives a larger allowance than his rule does, and the line names the count it used.
- **The sum.** `allowance = max(floor, rate × changed lines)`; inside when
  `estimate × 100 <= allowance × (100 + margin)`, in whole numbers, so that exactly 5 percent
  over is inside and one token more is not.
- **Where the rules are in force.** The three are of this repository only, so each is read with
  `ruleHere` against the text of `bin/lib/rules-data.mjs` of the project the command runs in.
  In a project that installs the harness, or with a copy of the harness whose list is not the
  project's, there is no line at all: a number that is not that project's rule is not printed
  as one.
- **What it does not do.** The exit code of `--plan` stays 0 and a run is not refused for its
  cost: a refusal with a flag to pass it would be a new behavior of the command, recorded here
  as a candidate and not built. The line is not printed by a run, only by `--plan`. A plan with
  no part has no line.
- **Where it lives.** `bin/lib/codex-review-allowance.mjs`, new and this session's alone
  (`reviewAllowance(plan, projectData)` gives the data or `null`, `allowanceLine` says it), with
  its test beside it; the test of the command runs the real `codex-review --plan` in a
  temporary repository with and without the rules file. In `bin/codex-review.mjs`, one import
  and the lines that print it in the `--plan` branch, told to JH 8 before they are written.

**What the reader changed** (a sub-agent that did not write the design, 2026-10-13; no blocker,
nine advisories, each with its line):
- *Which figure* was settled by the design in the direction that asks him less, on a reading
  that says only "the input tokens `--plan` gives" (`docs/rule-sources.json:29`), while the
  plan calls the whole range its estimate and its first figure came out about 2.2 times under
  the real cost twice (`bin/lib/codex-review-plan.mjs:19-21`). So the line settles nothing: it
  says where each figure stands, and "inside by the estimate, over by the higher figure" is a
  case of its own. Which figure decides is his, and goes to him through the lead.
  **He had already answered it** (the lead's notice, then read by this session): asked how the
  rule for what a Codex review may spend stands, he tapped "Dejarla como está" (the lead's
  transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 8668, 2026-10-13T01:05Z, read with
  `js-harness sessions --quote`), and the option he left was the strict rule on the high end
  of the estimate (the lead's relief file, line 486, a claim about its own question). So the
  estimate decides, as the line's verdict does, and the sentence about the higher figure is
  information. The question was withdrawn and not put to him again.
- The verdict is on the figures the plan prints, which are sums of parts each rounded to two
  figures: the line says nothing the plan above it does not show.
- "Inside" is a fact about this plan and never a permission: a second run after a review fell
  is his whatever its plan (the margin's reading), and the line cannot know that. The sentence
  for "over" says the command refuses nothing for cost.
- The line says it is of this plan: `--part-lines` regroups the parts and moves the estimate
  while the allowance stays (`bin/codex-review.mjs:1223`).
- Silence is kept only for a project that does not declare the rules. A copy of the harness
  whose list is not the project's, a rule that was retired, and a rules file that cannot be
  read each get one sentence with no number, and the exit stays 0. The rules file is read from
  the working tree, as `rules applied` reads it.
- The line goes after the plan's own lines and before the line that says a run would need
  `--max-parts`; the comment "the plan, and nothing else" of the `--plan` branch is rewritten.
- Left as designed, with the reader's agreement: `--max-parts`, a range partly covered by a
  record, `everyFile` and a single large part. Not taken: a word about an estimate that rests
  on runs at another effort, because the plan's own line, printed just above, says it.

### What ran, against the rules with no short name (T16b, third part: the checking half of B3)
Designed on 2026-10-12 and read by one reader that did not write it, whose changes are the last
paragraph. Built on `feat/rules-held`, stacked on `feat/rules-rewire`. It adds one block to
`js-harness rules applied`.

**The problem.** Three declared rules say what runs, and nothing compares them with what ran:
`session-model` and `session-effort` (what a session runs on) and `subagent-effort` (the effort
of every sub-agent). `rules applied` answers another question, what a short name gives on each
engine. B3 of `docs/model-effort.md` asks for this one: "the level a task really ran at is read
from the session's records and a row of `check` compares it with the table, as INFO", and names
the case that matters most: a sub-agent call that passes no effort takes the session's, so a
session at another level silently lowers its reviewers.

**What exists.** `readRecords` gives, for the last seven days, the last answer of each session
and the first answer of each launch, with the model, the effort, the engine, the time and the
file; `appliedOf` keeps or skips each entry and takes the rules in force. So the comparison
needs no new read. Two things it does not have yet: `appliedOf` drops the effort of an entry it
keeps, and the reader gives a launch the effort its meta file holds before the one its answer
records.

**The decisions.**

1. One more key of what `appliedOf` returns, `held`, and one more block of `appliedLines`: not
   a second command and not a second reader.

2. Which rule is held to which field is said by the command, `bin/rules.mjs`, in three literal
   reads: `ruleOf('session-model')` for the model of a session, `ruleOf('session-effort')` for
   its effort, `ruleOf('subagent-effort')` for the effort of a launch. So `rules check` lists
   the command as the reader of the three rules and refuses an id that is renamed or retired;
   the pure module still imports nothing and is passed the three as
   `{ id, of, field }`. One of them that is not among the rules in force (left out, in a project
   that is not this repository) has no item.

3. What ran is what the answer records. A launch's effort is the one its first answer holds,
   not the one its meta file holds: the first is what the engine ran, the second what the call
   asked for, and a call clamped by the engine would otherwise print as agreeing. The reader
   changes for that. A record with no effort is counted apart, never as a difference.

4. It is not a list of breaches. The folder holds records that are no rule's: a headless run
   another tool started, an agent type that sets its own level, gentle-ai's reviewers. So each
   other value is shown with what it came from, the entry point for a session and the agent
   type for a launch, with its count, the day of the last and the file of the last on a line of
   its own. The words are "agree" and the other value; nothing says "breach".

5. It is information: it never changes the exit. B3 says INFO; the command is outside the gate
   because its answer depends on the machine and the day; and no case here is free of a false
   red, since the records do not say which sessions are work sessions. One case is not left
   silent: a launch that passed a declared short name is this repository's own, so when such a
   launch ran at another effort than `subagent-effort` says, a line "To the lead" says how
   many, with the exit unchanged.

6. The last lines say what they are about. `PASS` names the short names; a last line counts
   the records that ran at another value than a rule of the block says, so that a pass above a
   difference is not read as "all agrees". The closing note says only that a Codex review
   holds its own model and effort.

7. The last answer of a session, or the first of a launch, can be one the engine wrote itself
   (`<synthetic>`): the reader steps past those to an answer a model gave, and gives the
   synthetic one only when the read holds no other.

A sub-agent's model with no short name passed is not held to a rule: the records do not say
whether a launch wrote code or reviewed. The block "Launches that passed no model" shows them.

**The lines**, after the three counted blocks and before "Left out", only when a rule of the
three is in force:

    What ran, against the rules with no short name (information, never a failure):
      session-effort: high, since 2026-10-10
        agree: 25 of 27 sessions
        medium: 2 sessions on claude-desktop, the last on 2026-10-11
          <file>
      subagent-effort: high, since 2026-10-07
        agree: 160 of 163 launches
        no effort recorded: 2 launches
        medium: 1 launch of general-purpose, the last on 2026-10-12
          <file>

**Tests first.** The reader: a launch whose meta file and answer hold two efforts gives the
answer's; a launch with an effort only in its meta file gives none; a synthetic last answer
after a real one, and a synthetic first answer before a real one; a transcript of synthetic
answers only. `appliedOf`: all agree; another value by entry point and by agent type, most
first; nothing to compare; an entry before `since`; a record with no effort; a dated model id
agrees; a rule of the three not in force has no item; the exit is 0 with a difference; the
count for the lead, only of launches that passed a declared short name. `appliedLines`: the
block whole, its singular forms, the file on its own line, the last lines with and without a
difference, no block when nothing is held. The command: the three rules are listed as read by
`bin/rules.mjs`.

**Not guaranteed.** A session's level in the middle of its life: only its last answer is read.
Which sessions are work sessions of the project. A launch's kind of work. An engine that
renames an effort level, or records it as something that is not a text: it prints as another
value or as no effort. A rule's `since` is a day as he said it and a record's day is in
universal time: an entry of the first hours can fall on the day before. Older than seven days,
past the cap, or a host that keeps no records.

**Cost.** One key and one block; the effort kept on an entry; two changes of the reader; three
reads in the command; the last lines reworded.

What the reader changed. Three things would have misled: the effort of a launch was the meta
file's, so a clamped launch agreed; every other tool's record counted as a difference with no
word of where it came from; and `PASS` or "Nothing compared" closed a block that showed
differences. Taken as notes: `keep` drops the effort, so the cost was understated; a synthetic
last answer hid its session; the renamed level and the two kinds of day under "Not
guaranteed"; a line for the lead in the one case B3 names; the file on a line of its own, for
a phone; zero compared, which read as a pass; and the home of the three ids, which as a table
in the pure module no check could see, so they are literal reads in the command. Cut on its
advice: a test of the table, and a promise about rows of `check` and `doctor`.

### The one command that changes a rule (T16c)
Designed on 2026-10-15, after a read-only explorer mapped what exists on `main` at 10e29e6. Two
readers that did not write it then read the first draft, one to attack it and one to find what
it lacks; this text is the draft with their findings, listed at its end. It builds letter C and
what "Where the rest of the protocol lands" gives T16c. Built on 2026-10-15 on `feat/rules-change`; what the
verifier and the reviews changed is folded in below and listed under "Progress".

What exists. These places come from the explorer's report and the readers', and this session
checked three of them:
- No code writes `bin/lib/rules-data.mjs`. `writeRules` is called only by the check, to
  compare (`bin/lib/rules-check.mjs:279`). The rendered list still says the declarations are
  written by hand (`RENDER_NOTE`, `bin/lib/rules.mjs:418`).
- `rules` takes one word and refuses every option (`bin/rules.mjs:41-50`). It reads and writes
  under `PACKAGE_ROOT` (`:27`, `:355`), and it imports `RULES` statically (`:18`). Run as the
  installed command, it is a copy of the default branch in the global packages.
- `checkRules` already finds every read of a rule that a change would break, `ruleValue`,
  `ruleHere` and `ruleOf` alike (`bin/lib/rules-check.mjs:239-245`). It also finds every
  `` `rule:<id>` `` mark in a text in force (`:258-268`), and returns the faults of `readRules`
  (`:180-181`).
- `readRules` reads the shortest phrase from the static list (`bin/lib/rules.mjs:294`) unless
  it is given `declared`.
- A source of his words is checked by its shape only, never against the transcript (`:41-61`).
  Every `checked.by` in `docs/rule-sources.json` is `session`, and its quotations are excerpts.
- `quoteOf(text, line)` (`bin/lib/sessions.mjs:1879`):
  - It says whether an entry is his, including a message he queued inside a running turn
    (`:1833-1858`).
  - It returns `person: true` for an answer to the question tool too, a tapped option included
    (`:1908-1913`).
  - It marks a message that is only a paste (`pastedOnly`). For a message that is part typed
    and part pasted it gives the whole text, and the pattern that strips a paste is not
    exported (`:1536`).
  - Its time is the transcript's, in UTC.
- `appendRelief` stamps every line `local (notify).` (`bin/lib/channel.mjs:390-392`). It refuses
  a line that is too long or holds a line break (`reliefLineOf`, `:408`). Relief lines have no
  id; documents cite them by their place in the file.
- In this repository a branch can gain commits after its pull request lands
  (`feat/session-unseen`, 4077a17, after pull request 227). So "a branch `origin/main` does not
  contain" does not mean "a change not landed".
- Nothing prints a memory update. No draft of `AGENTS.md` and no approval by hash exist; letter
  G is design only.
- An installed project's list is its own `docs/rules.json`, which the harness never writes
  (`bin/lib/project-rules.mjs:4`).

**The command.** `js-harness rules change <id> [--dry-run]`, with the change as JSON on
standard input, the way `notify --kind question` takes its fields. Its sibling form,
`rules change <id> --check-source`, reads only a source already stored, checks it as step 3
does, and writes `checked: { date, by: "command" }`. That is the "checked once" of letter C for
the fourteen sources a session seeded.

It runs in the checkout of this repository only. The git top of the folder it runs in must
hold `bin/lib/rules-data.mjs` and must be the root of the code that runs, so it is run from the
branch as `node bin/js-harness.mjs rules change`. Run from the installed copy, or in an
installed project, it refuses and says why: an installed project's `docs/rules.json` is edited
by hand.

**The change, as JSON.** At most one body, `set`, and `source`.
- **The body**, at most one of:
  - `value`. Its unit is the rule's, and a new rule gives `unit` with it. A change of unit is
    refused: earlier values are `{ value, until }` with no unit of their own
    (`bin/lib/rules.mjs:97-101`), so a new unit is a new id.
  - `path` and `phrases`.
  - `retire`, with `successors`, a list that may be empty.
- **`set`**: the other keys of a declaration (`subject`, `owner`, `flag`, `alias`, `scope`,
  `review`, `differs`), held to `readRules`. `row`, `patterns` and `failure` are named here so
  that the shape does not change later, and they are refused until T16d builds them. `sensor` is
  refused, because it belongs to a project's list. A new rule gives `subject` and `owner` in
  `set`.
- **`source`**, one of the two kinds:
  - `{ "kind": "words", "quotes": [{ "session", "line", "excerpt"? }], "reading", "accepted" }`;
  - `{ "kind": "design", "path" }`.
  The command never takes the text of a quotation: it reads each one from the transcript, so
  nothing he said is retyped by a session.

**The kinds, and what each does to the declaration.** Every key the change does not name is
kept as it is on `origin/main`. The change is always computed from `origin/main`'s declaration
of the id, never from the branch's, so a second run that corrects a first run does not push a
value that never landed into `was`. Every other rule is taken from the branch's last commit, so a
second id on the same branch keeps the first (found by the verifier, 2026-10-15: computing the
whole list from `origin/main` silently reverted the first id).
- **A new value.**
  - The value in force moves into `was`, newest first, with `until` today, and `since` becomes
    today.
  - A value equal to the one in force is refused.
  - A rule in prose that takes a value keeps its id, with an empty `was`.
- **A new text.** `path` and `phrases` are replaced, and `since` becomes today.
- **A retirement.**
  - The value in force moves into `was` as above.
  - It writes `retired: <today>` and `successors`, and drops the body, `flag` and `alias`,
    which `readRules` refuses on a retired rule (`bin/lib/rules.mjs:236-240`).
  - It keeps `subject`, `owner`, `since` and `was`. It keeps the unit only when `was` holds a
    number.
- **A form-only change.** `set` with no body moves neither `since` nor `was`, as "Model and
  effort as rules" asks of a change of form.
- **A new rule.** It enters with `since` today. An id in use, or one used by a retired rule, is
  refused, because an id is never reused. A new rule is told by `set` giving both `subject` and
  `owner`, so a rule in force changes those two in two changes.
- **A revert.** A new value whose value is in `was`, with its own source. An urgent change is
  the same command.
- **A change of several ids.** A split needs its successors declared before the retirement, and
  a model and its effort are two rules. So one branch may carry several runs of the command, one
  id each, and is one change.
- **The day.** Every day written is today by the machine's clock, and so is the stored `date` of
  a quotation: the local day of its transcript time.

**What it does, in this order.** It computes everything in memory first, and writes nothing
until the last check passes.
1. **The branch.**
   - It runs only on a branch named `rule/<name>` whose base is `origin/main`.
   - The tree may differ from the branch's last commit only in the rule's home, old path and
     new: `checkRules` refuses a home that no longer holds a phrase (`bin/lib/rules-check.mjs:195`),
     so the text and its declaration change together.
   - Otherwise it refuses and prints the `git` command that makes such a branch.
2. **The one open change.**
   - An open change is a `rule/*` branch other than this one, local or on `origin` as last
     fetched, holding a declaration it changed since its merge base with `origin/main` that
     `origin/main` never held since that base. A branch landed by a merge, by a squash, or with
     commits added past its merge is then no open change, even after later changes land, so no
     lock outlives its change. (The first reading, a branch whose file differs from
     `origin/main`'s, held every landed branch as open once main moved on: found by the verifier,
     2026-10-15.)
   - The refusal says how to clear a branch that has landed or is dropped: `git branch -D`, or
     `git push origin --delete` for one on `origin`.
   - The mark is computed and never stored, and the refusal names that branch.
   - Two runs on two branches before either commits both pass; that is under "Not guaranteed".
3. **The source.**
   - For words, each `session` names a transcript in the project's sessions folder, the one
     `sessions --quote` reads.
   - `quoteOf` must say the line is his and typed. A tapped answer to the question tool is
     refused: its text was written by a session.
   - A message that is only a paste is refused. Of a mixed message only the typed part counts,
     which needs the paste pattern exported.
   - The stored quotation is the `excerpt` when one is given, found in the typed part with white
     space squashed, or else the whole typed part. Today's sources are excerpts.
   - A session not in the folder, a line past the end of the transcript, and one bad quotation
     among several are each refused.
   - `reading` and `accepted` are stored as given. Nothing checks that `accepted` names a line
     where he accepted the reading; that stays a session's word, as it is today.
   - A design path must exist in the tree.
   - A rule owned by `sebastian` takes words only, as `rules check` already refuses.
4. **The new list.**
   - `checkRules` runs on the new texts held in memory, with the new list passed as `declared`,
     so a change to `control-phrase-min` is checked against its new bound.
   - Any finding refuses the change, and the finding is printed. This one check covers a
     retirement, a scope of `repository` and an id that code or a text still reads: each read
     and each mark is named, so the code and the texts move first, in a pull request of their
     own that lands before the `rule/` branch is cut.
   - Any change whose home is `AGENTS.md`, old path or new, is refused. A phrase of `AGENTS.md`
     changes only by the approved draft of letter G, which is not built.
5. **The relief line.** It is built before any write and checked with `reliefLineOf`.
   - The line reads: `` rule:<id> proposed on rule/<name>, not landed: <what>; source <kind>;
     supersedes relief line <n> ``.
   - `<what>` is `<old> to <new>` for a value, `text of <path>` for a text, `retired,
     successors <ids or none>` for a retirement, `new` for a new rule, `form` for a
     form-only change, and `source checked` for `--check-source`.
   - `<n>` is the place, blank lines counted as the file counts them, of the last line the
     command wrote for this id: one holding `` rule:<id> proposed `` with no character of an id
     after the id. With no such line, it says `supersedes no relief line`.
   - The stamp names the command, not `notify`: `appendRelief` takes who writes, with `notify`
     as the default.
6. **The write.**
   - The three files: `bin/lib/rules-data.mjs` (`writeRules`), `docs/rule-sources.json`, and
     `docs/RULES.md` (`renderList`). Each is written beside itself and renamed.
   - If a rename fails, the three are restored with `git checkout HEAD -- <the three>` and
     nothing is appended. The tree held no change to them, by step 1.
   - The relief line is appended last.
7. **What it prints.**
   - The memory update owed, which it does not do: any memory note or engram observation that
     states the old value is changed to point to `rule:<id>`. The command reads no memory, and
     letter F says a note points to an id.
   - The cost, as the protocol asks for each change: one gate, gentle-ai's assessment and a
     small Codex review.
   - `--dry-run` prints the new declaration, the new source, the relief line, the memory update
     and the cost, and writes nothing.

**What it leaves to the session.** The commit, the gate, both reviews and the pull request,
which letter B keeps for a change of a value. "Straight to `main`" is the orchestrator's
reading in the approved text: a pull request of its own against `main`, never riding a feature
branch, through the lead's merge queue. It is never a push to `main`. Item (1) of his yes lets
the orchestrator run this command, with its commit, as the one exception to its rule of never
committing. The orchestrator skill says so, and from which checkout.

**Files touched.**
- A new `bin/lib/rules-change.mjs`, the change computed with no file system, and its test.
- `bin/rules.mjs`: the verb, its options, its root, and `USAGE`.
- `bin/lib/rules.mjs`: `RENDER_NOTE`, with `docs/RULES.md` rendered again.
- `bin/lib/sessions.mjs`: the paste pattern exported.
- `bin/lib/channel.mjs`: who writes a relief line.
- `bin/js-harness.mjs`: its usage and long help.
- `bin/lib/manifest.mjs`: the command in the `js-harness` skill's list, and the orchestrator's
  exception.
- This document: "A change before T16c exists" and "written by hand" become the command.

Every file but the new one is shared and is told to the lead first.

**Tests first.** Each test is seen failing before it passes. Each runs on a project made in the
test; none reads the real relief file or the real transcripts.
- **The root:** run from another root; in an installed project; an id only in `docs/rules.json`.
- **Step 1:** another branch; a change outside the home; the home edited with its text change,
  accepted.
- **Step 2:** another `rule/*` branch whose data differs, local and remote, refused. A landed
  branch with a later commit, and this branch itself, are not open changes.
- **Step 3**, on transcripts written in the test:
  - a line not his; a tapped answer; a paste only;
  - a mixed line, which keeps the typed part; a queued message he typed, accepted;
  - an excerpt not in the typed part;
  - a session not in the folder; a line past the end; one bad quotation among two;
  - a design path that does not exist; a rule of his with a design source;
  - `--check-source` on a stored source, good and bad.
- **The kinds:** each kind compared with an expected declaration:
  - a number and a string value;
  - a prose rule taking a value;
  - a retirement of a value rule and of a prose rule, the last value in `was`;
  - a form-only change;
  - a new rule, and a reused id, refused;
  - a unit change, refused; an equal value, refused;
  - an unknown id that is not new;
  - a change of a retired rule.
- **Step 4:** a retirement with a reader in single quotes and in double quotes; a mark in an open
  feature document; an `AGENTS.md` home, old and new; a change of `control-phrase-min` checked
  against its new bound.
- **Steps 5 and 6:**
  - the relief line names the right line among blank lines, and ignores `rule:<id>-longer`;
  - a line too long is refused, with nothing written;
  - a failed rename restores the three files and appends nothing;
  - `--dry-run` writes nothing.
- **A round trip:** a change, then its revert, gives back the first `rules-data.mjs` apart from
  `was` and `since`.
- **Untouched behaviour:** `rules`, `rules check`, `rules render` and `notify --relief`, the
  stamp's default included, give the same output as before.

**Risk.** Item 1: the command rewrites stored data, `rules-data.mjs` and the sources. Item 3:
`appendRelief`, `quoteOf`'s module and the dispatcher's help are shared. The change gets an
independent verifier after its own checks.

**Not guaranteed.**
- That `accepted` is true.
- That a session used the command: a hand edit in `writeRules`' shape passes until T16d's row.
- Two changes started on two branches before either commits.
- A line that says a change was proposed and never landed. The line that confirms a landing is
  written at the merge, in T16e.
- The source of an earlier value: it is replaced in `docs/rule-sources.json`, and git keeps it.
- Words he said to a session of a worktree: the sessions folder read is the main checkout's.
- A relief line's number after a hand edit of the file.
- The three renames: they are not one atomic act, and a crash between them leaves the files out
  of step until `rules check` names it.

**What the two readers changed.**
- **The attack:**
  - The root is the checkout's, not the installed copy's.
  - The open change is read from the data a branch holds, not from its ancestry.
  - The home edit rides with its declaration.
  - A retirement keeps the last value and drops `flag` and `alias`.
  - A unit change is refused.
  - The relief line is built first, written last, and marked as not landed.
  - A tapped answer is refused, and an excerpt is allowed.
  - The day of a quotation is the local one.
  - One `checkRules` on the new list replaces a separate reader scan.
  - Two false places in the first draft were corrected.
- **What was missing:**
  - `set`, for the keys that are not a body.
  - The form-only and prose-to-value kinds.
  - Computing from `origin/main`.
  - Several ids on one branch.
  - `--check-source`.
  - The printed cost.
  - The installed project.
  - Each help text and skill that must name the command.
  - The tests of each case.

**For later letters, named here and not built.**
- **T16d:** the switch of a wrong red row, "by the same command, with a reason, and counted", as
  `set.row`, with where the count is kept; `patterns` and `failure`.
- **T16e:** the line that confirms a landing.
- **T16f:** the hash in the installed command.
- **Letter H**, its own home, has no task yet: it is added as T16g.

### The row `rules` (T16d)
Designed on 2026-10-15, after a read-only explorer mapped what exists on `main` at 9773770. Two
readers that did not write it then read the first draft, one to attack it and one to find what
it lacks; this text is the draft with their findings, listed at its end. It builds letter D and
what T16c left to it: `patterns`, `row` and `failure`, and the switch of a wrong red row. Not
built.

**What exists** (by the explorer's map):
- `readRules` already accepts and validates the three keys (`bin/lib/rules.mjs:12-18`, `:181-200`).
  No rule carries one, and `changedList` refuses them (`bin/lib/rules-change.mjs:14`, `:37-41`).
- A static row of `bin/check.mjs` returns `{ name, pass, info?, detail, lines? }`. An `info` row
  reports and never fails, and a failing static row already stops the gate before its sensors
  (`bin/check.mjs:2189-2190`).
- `addedLines` (`bin/lib/citations.mjs:31`) turns a `-U0` diff into `[{ file, line, text }]`.
- `checkOwnRules` (`bin/check.mjs:186`) gives a project's row and nothing here.
- Nothing scans a text for a restated value, and sightings are written by hand
  (`bin/failures.mjs:15`).

**The texts it reads.** The texts are those `readAll` reads (`bin/rules.mjs:97-130`), plus
`AGENTS.md` and `README.md`. The list's own homes are left out, because they are where a value
is shown: `bin/lib/rules-data.mjs`, `docs/rule-sources.json` and `docs/RULES.md`. So are
`docs/FAILURES.md` (its evidence quotes what was said), `docs/origin.md` (frozen), and a feature
document from its first `## Progress` or `## Log` on (its history). About 30 feature documents
use `## Log`.
- The skill and template texts are scanned as the source lines of `bin/lib/manifest.mjs`, not
  as rendered. A value interpolated from its rule (`${...}`) is the cure there, so it is no
  finding.
- A line inside a fence is no finding. The fence and the history cut are read on the whole
  file: the staged copy (`git show :<file>`) for the row, the tree for `rules check`.

**A pattern.** It names the rule's subject, and its `{amount}` placeholder stands for any amount
in any wording: a number with a unit, "an hour", "half an hour", or a model or effort name for a
text value. So a pattern still finds a restatement after the value changes, and it never has to
be rewritten with the value.
- It is tried case-insensitively on one line. `readRules` refuses a pattern that matches the
  empty string, or that has no `{amount}`.
- A finding is a line outside the history and the fences that a pattern matches. A
  `` `rule:<id>` `` mark on the same line does not excuse it: the cure is the mark instead of
  the value, not beside it.
- A rule with no patterns is not scanned. `rules check` lists it as unscanned, so the gap stays
  in view.

**The row.** It is one static row named `rules`, added to `checkOwnRules`. It acts only where
`bin/lib/rules-data.mjs` exists, and the project branch of `checkOwnRules` keeps its output. It
reads only the lines the staged change adds, with renames detected, so a moved document adds
nothing.
- During a merge (`MERGE_HEAD` exists), a line counts only when it is new against both parents.
  So a merge of `main` is never refused for lines it brought in.
- Rule by rule, its state is the stored `row`:
  - **absent:** a finding is an INFO line;
  - **`{ refuses: <day> }`:** a finding fails the row, and with it the gate, before the sensors;
  - **`{ reports: <reason>, since: <day> }`:** a finding is INFO and the line names the reason.
- A FAIL line names the rule, the file, the line and the text, and gives the cure: the mark
  instead of the value, or `rules change`.
- It does not run on `check --push`, nor when nothing is staged. `--no-verify` passes it; the
  merge door (letter E, T16e) is what closes that.
- It scans only the added lines, so it costs little at every commit. A probe found the whole
  scan takes about 8 seconds with 90 subject-anchored patterns, so the whole-text count is kept
  out of the gate.

**`rules check`.** Its exit code does not change. After its line it prints the count of each
scanned rule's findings in the texts in force, as `patterns: <id> <n>, ...; unscanned: <n>`.
The count is information and never a finding, so the first pattern does not turn the gate red.
It gains two findings:
- a `failure` that names no entry of `docs/FAILURES.md`;
- a rule in `reports` whose `failure` entry has no `- Seen:` line on or after its `since`.

**Turning a rule to refuse, and back.** Both are `rules change <id>` with `set.row`; T16c's
command stops refusing the three keys. It is given the count and the register by
`rules-change-run.mjs` and `bin/rules.mjs`, since `rules-change.mjs` reads no file.
- **Turning to refuse.** `set.row: { refuses: <today> }` runs `git fetch origin main` first, and
  is refused when that fails. It is also refused while the rule's count on `origin/main`'s texts
  is above zero, and while the rule has no `patterns` or no `failure`.
  - So a rule with a finding in `AGENTS.md` (`context-pause`, "near 88%") turns only after
    letter G, which puts marks out of `AGENTS.md`.
  - The state is stored, not computed, so a new finding never turns a refusing rule back.
- **Disarming a refusing rule.** While a rule refuses, `set.row: null`, `set.patterns` and
  `set.failure` are refused, whether set to null or changed. Its only way back is the switch
  back.
- **The switch back.** `set.row: { reports: <reason>, since: <today> }` is accepted only from
  `refuses`, with a source as any change. It is counted: its relief line names the `failure`
  id, and `rules check` fails until that entry has a `- Seen:` line on or after `since`. The
  count is the sightings of that entry.
- **A change of form.** `set.patterns` and `set.failure` on a rule that does not refuse are a
  change of form: they move neither `since` nor `was`. `failure` must name an entry of
  `docs/FAILURES.md`. Given alone, they also keep the rule's stored source, which is the source
  of its value, and the relief line names the change's own (decided on 2026-10-15 by the lead:
  "a correctness fix, not a policy"). On a rule of his, a change of form alone needs no words
  of his either: a design is taken, named in the relief line, and his words stay its stored
  source; a value, or anything beyond form, still needs his words. His answer of 2026-10-16,
  asked by the lead: "Solo forma, sin mí (Recomendada)".

**The failure.** It is `old-rule-beside-new` (`docs/FAILURES.md:664-673`), whose control is
owed to T16. Its `Control:` line names the row once the first rule refuses. No new entry is
added.

**`docs/RULES.md` and the hash.** `RULES.md` already shows a rule's `row`
(`bin/lib/rules.mjs:488-509`) and gains its `failure` id. Patterns are not shown: `rules <id>`
prints them. `HASH_KEYS` leaves the three keys out by intent (`bin/lib/rules.mjs:413`, `:451-454`),
so a turn re-renders `RULES.md` and leaves the hash as it is.

**In this order.**
1. **The code.** Its own pull request: the row, the scan, the counts and findings, and the
   command's three keys.
2. **The first patterns,** in `rule/` branches of several rules each, with source `design`
   naming this section. The first are the rules `rules check` counts fewest findings for once
   their patterns are in. The session writes the patterns, and each run prints its count in its
   dry run. The batches, decided on 2026-10-15 (Progress): the ten lowest counts first, then the
   rest in two or three batches by count, and `context-pause`, `codex-review-floor` and
   `review-effort`, the highest, last and alone.
3. **The texts,** cleaned of each rule's findings by marks, in ordinary pull requests.
4. **Each turn to refuse,** in its own `rule/` branch, once its count on `main` is zero.

**What it changes.**
- Code:
  - `bin/check.mjs`: the row in `checkOwnRules`, with the list and the git runner given in, so a
    fixture can drive it.
  - `bin/lib/rules-check.mjs`: the scan, the counts and the two findings.
  - `bin/lib/rules.mjs`: `{amount}`, the empty-match refusal, and `failure` in `RULES.md`.
  - `bin/lib/rules-change.mjs`, `bin/lib/rules-change-run.mjs` and `bin/rules.mjs`: the keys, the
    turn, the guard while refusing, and the switch back.
- Help: `bin/rules.mjs`'s help, the dispatcher line in `bin/js-harness.mjs`, the skill line at
  `bin/lib/manifest.mjs:32` (today's refusals), and the error at `bin/lib/rules-change.mjs:39`.
- Records: this document and `docs/FAILURES.md`'s control line.

**Tests, each a requirement.** Each test of a new check is added to "Done when", as the
document's constraint asks.
- The planted violation, one test per state: report, refuse before the sensors, report again
  with the reason.
- Exclusions:
  - a line in a fence, in the history, or in a list home is no finding;
  - a line with its mark and the value is a finding;
  - a merge of `main` is not refused for its lines;
  - a renamed document adds nothing.
- `rules check`:
  - its exit code and its first line are unchanged;
  - the counts are printed;
  - a missing `failure` entry is a finding;
  - a switch back with no sighting is a finding.
- The command:
  - the turn is refused with a count on `origin/main`, with no patterns, or with no failure;
  - while a rule refuses, the three keys are refused;
  - the switch back is accepted only from `refuses`.
- `readRules` refuses a pattern that matches the empty string, or one with no `{amount}`.
- Regressions:
  - the project row of `checkOwnRules`, its output unchanged;
  - `checkCitations`, unchanged;
  - `rules`, `rules <id>` and `rules change` for a value, as before.
- The real list: every pattern compiles and finds its own planted line.

Risk:
- item 1, the rows of `rules-data.mjs`;
- item 3, `checkOwnRules`, `addedLines` and the help are shared;
- item 5, the row sits in the pre-commit gate.

So an independent verifier reads it after its own checks, as for T16c.

**Not guaranteed.**
- A pattern finds what its subject and `{amount}` describe. A value stated with no subject on
  its line, or across a hard-wrapped line, passes.
- A hand edit of `rules-data.mjs` in `writeRules`' shape still passes, as under T16c. The row
  reads texts, not the list's history.
- `evals/`, `.githooks/` and other `docs/` files are not texts in force. `evals/suite.mjs` names
  both model ids, and is code read by its own tests.
- A commit with `--no-verify`, or an amend with nothing staged, is not scanned until the merge
  door.

**What the readers changed.** The attack found five blockers:
- the list's own file read as a text in force, so no turn could pass;
- added lines cut at fences and history with no file context;
- a merge of `main` refused for lines it brought in;
- patterns tied to the value;
- a refusing rule disarmed with `null`.

Its advisories gave the same-line mark, `AGENTS.md`, the stale `origin/main`, the file
lists, long one-line texts, the cost at each commit, renames and installed projects. What was
missing found fifteen gaps, among them:
- zero on `main`, not on the branch;
- `rules check`'s exit code;
- the existing failure entry;
- the order of the pull requests;
- the rendered skill texts;
- the design's own example;
- the help texts, the tests, the risk line and the verifier.

All of them are folded in above.

### The merge door (T16e)
Designed on 2026-10-16 by the session "JH 24", on the orchestrator's word ("rule-hierarchy T16e
(the merge command, the rule rows first)"), after a read-only explorer mapped `main` at `c1bf1b5`.
Read by two readers that did not write it, one to attack it and one to find what was missing;
this is the version after them ("What the two readers changed", at the end). Each thing it ships
passes by Sebastián (Constraints): the orchestrator puts this design to him before slice (b).

**The problem.** Letter E: "The doors. The one that refuses is the merge: a command that runs the
code of `main` on the merge result, the rule rows first. The commit reads the added lines; the
push reports." Today no door refuses at the merge:
- `merge-queue` merges each pull request with `git merge --no-ff --no-verify`
  (`bin/merge-queue.mjs:277-280`), so the pre-merge-commit hook never runs there, and `--land`
  tests the candidate with the candidate's own `bin/check.mjs` (`localSuite`, :93-97): a pull
  request that weakens a row is judged by the row it weakened.
- The row `rules` reads only `git diff --cached` (`checkListRow`, `bin/check.mjs:231-260`): a
  commit made with `--no-verify` is never scanned, and a committed candidate shows no row at all.
  T16d left that to this letter ("the merge door (letter E, T16e) is what closes that").
- The queue's test of gentle-ai is a word in the pull request's body
  (`bin/lib/pull-request.mjs:14`, `/gentle-ai/i`).
- T16c writes "rule:<id> proposed on <branch>, not landed" (`bin/lib/rules-change-run.mjs:253`)
  and leaves "the line that confirms a landing" to this letter; nothing writes it.

The two needs the lead's inventory of 2026-10-12 gave this task, read in the relief file:
- Line 325 (pull request 68): "its coverage loop answered NO for two commits that a second, direct
  look found covered; the loop is not to be trusted without that second look". The loop was the
  lead's own script, not the queue's: `reviewCoverage` already expands each record with
  `git rev-list` (`bin/lib/codex-review-coverage.mjs:53-56`, :252-258). What the need asks is
  that the look the lead had to make by hand is the door's output.
- Lines 325 and 337 (pull requests 68 and 69): gentle-ai's review was claimed in a message and
  written in a document of another branch. The need: its evidence is written in a document on
  the pull request's own branch.

**The decisions.**
1. *The door is a step of `merge-queue`*, the lead's one path to `main`, and it runs in the
   candidate's worktree right after each pull request is merged into it (`:276-290`), on
   `HEAD^1..HEAD`: the lines that pull request brings, numbered as they stand in the result, on
   top of every pull request merged before it in the batch. A refusal takes that merge back
   (`git reset --hard HEAD^1`, inside the queue's own worktree) and the pull request leaves the
   batch with its reasons, as one that conflicts leaves it today. The door runs again on each
   pull request the bisection of `--land` merges a second time (`:130-138`). `--dry-run` builds
   the candidate the same way and prints what the door says. No new command: a second path to
   `main` would be a second door to keep.
2. *The code of `main`.* The rows run from a detached worktree of `origin/main`'s sha (the base
   the queue already reads, `:232`), never from the candidate's `bin/` and never from whatever
   copy of the command runs the queue: `node <main worktree>/bin/check.mjs --door --base HEAD^1`
   in the candidate. A `main` whose `check.mjs` has no `--door` (the first landing of slice (a)
   itself) runs no door, and the queue says so in one line. Nothing of the candidate runs
   before its door passes; `localSuite` runs the candidate's own code after it, as today.
3. *The rules are `main`'s.* The patterns are `main`'s list. A rule's row is the stricter of
   `main`'s and the candidate's so far (its `bin/lib/rules-data.mjs` parsed as text by
   `rulesOfText` and checked by `readRules(list, { declared: list })`, never imported, and only
   its `row` read): so a `rule/` branch that turns a rule to refuse, merged earlier in the batch,
   refuses a later pull request that restates it, and no pull request can loosen its own judge.
   A pull request not from a `rule/` branch that changes `rules-data.mjs` is refused: a rule
   changes only by `js-harness rules change` (C). A candidate whose list does not parse refuses.
4. *The rule rows first.* The row `rules` reads every line `HEAD^1..HEAD` adds to a text in
   force, as the commit's row reads the staged ones: one function, `checkListRow`, given the two
   sides of the diff instead of `--cached` and `:<file>`. In the door, a git that does not answer
   refuses instead of giving no row. A finding of a rule whose row refuses refuses the pull
   request; the rest are printed. The row `failures` then runs on the candidate's worktree, as
   on disk today (`bin/failures.mjs:100`). These two are the rule rows; the other static rows
   (`budget`, `citations` and the rest) run in `localSuite` with the candidate's code (Not
   guaranteed). Reading 5's "the merge refuses on the whole result" is read as: on every line the
   pull request brings, committed with or without `--no-verify`, not on every line of `main`.
5. *gentle-ai's evidence, on the pull request's own branch,* added to the line in the body, which
   stays (S4 of `odd/tasks/merge-queue.md` names it, and a pull request of documents keeps it as
   its only test). Each code commit of the pull request committed after the cut-over (the date
   slice (b) lands, a constant in code) is named on a line the pull request adds to a feature
   document (`odd/tasks/*.md`) that also says `gentle-ai`: by its hash (seven characters at
   least, resolved with `git rev-parse` inside the pull request's range), or as inside a range
   `a..b` the line names, read as this repository writes it, first and last both included (`a`,
   and `git rev-list a..b`). The queue resolves each range itself and never takes the line's word
   for what it holds. The code commits are those of `reviewCoverage`; a merge of `main` is not
   one here, since its review is Codex's by what was written in it and gentle-ai's range starts
   after it (protocol 3). With the Codex review switched off, a code commit is one that changes
   a file that is not Markdown. A commit with no such line refuses: "no written gentle-ai
   evidence for <hash> on this branch: name it, or its range, on a gentle-ai line of its feature
   document" (a rebase changes the hashes: the message says so when a named hash is not in the
   range). The work sessions learn it from the text that tells them to review (below).
6. *The second look is the output.* For each code commit the queue prints the Codex record that
   covers it (its range and date, from `reviewCoverage`'s `covers`) and the line of item 5
   (`path:line`), so the lead reads coverage commit by commit and needs no look of their own.
7. *The landing line.* When `--land` moves `main` (the push that reported a failure while
   `origin/main` is the candidate included, `:188-189`), for each landed pull request from a
   `rule/` branch and each id it changed, the newest line "rule:<id> proposed on <branch>, not
   landed" (that exact text, so `rule/a` never matches `rule/ab`) that no later "rule:<id> landed
   on main ... from <branch>" line confirms gets one line, appended through `appendRelief` with
   `by` `merge-queue`: "rule:<id> landed on main <sha> from <branch>: confirms relief line <n>",
   the number as read at that moment. The relief file is found as `notify` finds it
   (`JS_HARNESS_HOME` or the user's home, the slug of the main checkout). `--dry-run` and a red
   land write none. A landed `rule/` branch with no proposed line writes none and says so.
8. *The push reports.* `check --push` adds the row `rules` over `<remote>/<default>...<head>`,
   the `--remote` and `--head` it already takes, as INFO whatever the rule's row says: the commit
   refuses, the push reports, the merge refuses. T16d's "does not run on `check --push`" is
   amended in the same slice.

**In this order.** Slice (a), items 1 to 4: `checkListRow` given the two sides, `check --door`,
the queue's door; the `AMOUNT` fix of T16d's patterns is on `main` already (`git diff
origin/main...origin/feat/amount-boundary` is empty), and the slice never touches
`rules-data.mjs` (batch B is JH 7's). Slice (b), items 5 and 6, after the orchestrator has put this design to him: its cut-over
makes the open pull requests, batch B among them, pass as they are. Slice (c), items 7 and 8.
Each slice is one pull request, tested first, through the gate and both reviews.

**Files touched.**
- Code: `bin/merge-queue.mjs` (the door, the worktree of `main`, the coverage lines, the landing
  line, `USAGE`); `bin/check.mjs` (`checkListRow` given the two sides, `--door`, the push row,
  `USAGE`); `bin/lib/pull-request.mjs` (its comment); `bin/lib/rules-change-run.mjs` (`rulesOfText`
  and the line's shape, read and not changed).
- Help and docs: `bin/js-harness.mjs` (the help of `merge-queue` and `check`); the README
  (`js-harness merge-queue` and `check --push`); `docs/ROADMAP.md` (the gate's merge line);
  `odd/tasks/merge-queue.md` (S4 kept, a log line for the door).
- Skills: the text that tells a work session to review (`bin/lib/manifest.mjs`) names the
  gentle-ai line by hash or range; the orchestrator's skill names `merge-queue` and its refusal
  reasons. This document puts the skills out of scope (Constraints); this task takes the same
  exception T16c took, for these lines only.
- `docs/FAILURES.md`: a sighting of `checked-not-read` for pull requests 68 and 69, its
  `Control:` naming item 5; `old-rule-beside-new`'s control gains the door for `--no-verify`.

**Tests first.** Each seen failing before it passes, in repositories made in a temporary folder,
through `mergeQueueMain` with `run` stubbed for `gh` only and the home a temporary folder:
- a pull request whose `--no-verify` commit restates a refusing rule's value leaves the batch
  with the row's line, and the batch lands without it; a reporting rule's merges and is printed;
- a pull request whose `bin/check.mjs` drops the row is still refused: `main`'s code ran;
- a non-`rule/` pull request that loosens a row in `rules-data.mjs` is refused; a `rule/` pull
  request that turns a rule to refuse, then another that restates it, in one batch: the second
  leaves; the same after a bisection;
- a candidate list that does not parse refuses; a git that does not answer refuses;
- a line restated after a change of `main` above it in the same file is read at its result line;
- item 5: a commit named only on a line without `gentle-ai`, only in the body, or only in a
  document the pull request does not change refuses; inside `a..b`, `a` itself, and a short hash
  pass; a range that does not hold it refuses, with the rebase hint; a commit before the cut-over,
  a merge of `main`, and a pull request of documents ask nothing of it; the body's line is still
  required; the review switched off;
- the coverage lines name each commit's record and `path:line`; `--dry-run` prints the door, the
  coverage and the refusals and pushes nothing;
- a landed `rule/` branch appends one confirming line; a second run appends none; a superseded
  proposal is not confirmed; a branch with no proposed line appends none and says so; a red land,
  exit 3 and `--dry-run` append none; the push-reported-failure land appends;
- `check --push` prints the row as INFO and exits 0 with a refusing finding, with `--remote` and
  `--head`; the queue's own push of `main` passes;
- the existing tests of the body's line (`bin/lib/pull-request.test.mjs`,
  `bin/merge-queue.test.mjs`) still pass unchanged.

"Done when" gains `node --test bin/merge-queue.test.mjs` and `node --test
bin/lib/pull-request.test.mjs`; `bin/check.test.mjs` is there already.

**Cost.** Per pull request, a few git processes per file it changes and one `node` of `main`'s
`check.mjs --door`; per batch, one worktree of `main` (an estimate: one to two seconds, measured
in slice (a) and written here). No whole scan: T16d measured 90 patterns over every text at about
8 s, which the door does not do.

**Risk.** Item 2: the door is a guard. Item 3: the queue's output and refusals and `check --push`'s
output, which the lead and the pre-push hook consume; `checkListRow`, which the commit's gate
shares; the skills' text. Item 5: the path to `main`. Each slice gets an independent verifier
after its own checks.

**Not guaranteed.**
- A merge outside the queue: the GitHub button, `gh pr merge` (closing them is spend, his).
- A run of the static rows on `main` after each merge, on GitHub (his, not asked yet).
- The static rows other than the rule rows: they run with the candidate's code.
- That a line naming a commit is true: the queue checks that the evidence is written on the
  branch and names the commit, not that gentle-ai approved it; gentle-ai keeps no record the
  queue can read for a commit that was not due.
- A `main` with no `--door`, until slice (a) lands.

**What the two readers changed.**
- **The attack:**
  - `readRules` does not parse text: `rulesOfText` does, then `readRules(list, { declared })`.
  - The merge result's list let a pull request loosen its own judge and run its patterns in the
    queue: `main`'s patterns, the stricter row, a non-`rule/` change of the list refused.
  - Judging each pull request against `main` missed the chain the queue lands, and `merge-tree`'s
    conflicts and line numbers were unspecified: the door runs in the candidate after each merge,
    on `HEAD^1..HEAD`, and again after a bisection.
  - A git that does not answer gave no row: it refuses in the door.
  - `checkFailures` reads disk: it runs in the candidate's worktree.
  - "The installed command is `main`'s code" had nothing behind it: a worktree of `origin/main`.
  - Item 5 would have refused landed pull requests and habits: a cut-over, ranges read first and
    last included, short hashes, merges of `main` exempt, the rebase hint, the skills first.
  - The coverage comes from `reviewCoverage`, not the single row of `checkCodexReviews`.
  - The landing line: exact text, newest per id and branch, confirmed by a later line and not by
    number, the home and slug as `notify` finds them, the land whose push reported a failure.
  - `--push` uses its own `--remote` and `--head`; T16d's line amended; reading 5 settled; a cost.
- **What was missing:**
  - Batches where an earlier pull request changes the rules, and bisection: folded into item 1.
  - Pull requests of documents, of a merge only, with no code: the body's line stays.
  - S4 of the queue: kept, item 5 adds to it.
  - The open pull requests when slice (b) lands: the cut-over, and "In this order".
  - Projects with `docs/rules.json`: the door is this repository's (`rules-data.mjs`); an
    installed project's queue, if it has one, runs its static rows in `localSuite` as today.
  - `--dry-run`, the existing tests, the file list, the skills, the failure register, the risk
    line's items and "Done when".

### `AGENTS.md`, rewritten
The headings stay. What changes is "Working with Sebastián", which runs from line 48 to line 84
of the file's 87 today. The content of the new section, in order; the wording is his to pass in the build
session:

1. The six principles, once, in one paragraph: done properly, not to comply; no shortcut; under
   the agreed protocols; nothing stated that was not checked; what is passed on is complete and
   true; each mistake leaves a control, of the smallest kind that does the job. With the meaning
   of done: a rule is not recorded until it has its place in a check, a line here or a protocol.
2. What is his, the six items of 2026-10-10 (they stand, by the lead's reading of its record
   on 2026-10-12, a peer's claim: the merge of code, once a seventh, is the lead's under the
   charter, and his later answer adds one of another kind, a report published outside, such
   as an issue in another repository; T8's draft holds the list he passes, and the check of T2
   names no count): spend outside the plan; anything installed or changed on a
   machine; a product choice; what cannot be undone; a change of the plan or of its order; a new
   protocol. Narrowed on 2026-10-11 (the relief file's line 236, as the sweep reads it; T8
   drafts the line from both): what the harness writes under the home's `.js-harness` and
   `uninstall` removes is not asked; the lead removes the worktrees of merged features and
   updates the installed command at a boundary; a review tool that fails is not his, and only
   a report of it outside stays his. Asked one at a time, never while work runs, naming the item. Everything else is
   decided, its cost said, and the work goes on: commit, reviews and the next task chained with
   no report between them, and never idle on an open question.
3. His wording is the need, not the specification: an answer to a proposal of his says the need
   that was understood, what would be done differently from his words and why, and what it costs
   or is not known; only then it is recorded.
4. Every claim is one of three: checked (with its evidence), assumed, or not known. What another
   session, a sub-agent or he reports as done outside the session is a claim: one thing is
   checked before building on it. What is passed on always says what failed and what was not
   checked, with "nothing" when that is true; the full shape is protocol 6, and this sentence
   is here because it applies to every report and a skill alone loads only when it matches.
5. One session, one feature; every decision is written to the roadmap or the feature document
   and committed in the same session.
6. A reply ends with one of four states; the reply check says how.
7. Review consent is pre-granted; the steps are in the protocol "running something that costs".
8. Every proposal is judged twice: as it is here, and as it works in a project that only uses
   the harness.
9. An index of two lines: the protocols, by situation; and, before changing a piece of the
   harness, the entry of that capability in `docs/SPEC.md`.

What leaves, and where it goes: the format of the four states, of the block and of a cut (to C1
and the protocol "closing a reply"); the steps of a review (to the protocol "running something
that costs", with the one sentence of item 7 kept); the recap, the map and the context figure
before a block (to "closing a reply"); the two incidents told inline ("one was read as his task",
"once cost a session") go to `docs/FAILURES.md`, where an incident belongs.

Items 1 to 4 and 6 are also what the template `init` writes gains, worded for any owner; today
it carries two rule sentences (`bin/lib/project.mjs:297-298`). Items 5, 7 and 8 are rules for
building the harness and stay here only.

### Protocols
One skill, `js-harness-protocols`, written by `install` for both hosts as the two existing
skills are (`bin/lib/manifest.mjs:101-122`), with one section per situation and an index of six
lines at its top. One skill and not six, because the description of every installed skill is
loaded on every turn, and one file is one place to keep. Each section opens with the incident it
came for and the date, so that it can expire: when the incident has not returned and nobody used
the section, it is withdrawn.

1. Asking him for a decision: what the yes covers in everyday words, what it does to him, what
   it does not authorize, what the other option means; one thing per yes; the block; a question
   asked again says first that the earlier answer still holds and what changed. Two rules
   adopted since, with no task anywhere until the lead's inventory of 2026-10-12 named this
   section as their home: a choice is put as an everyday situation with its options A and B
   (his memory note on one prompt a reply, its last paragraph); and a short answer of his that
   fits two readings is asked about, not guessed (relief file, line 331, not read by this
   session).
2. Closing a reply: the four states; before a block, what was done, what is next and why, and
   for which session; the map from `js-harness progress`; a cut at the end of a task.
3. Running something that costs (a gate, an eval batch, a review, a push): its count said first;
   one try; the proof is read before the command it allows, and the two share a command only when
   the second is conditional on the first; an assessment is read before the next command, and
   after `main` is merged into a branch its base is the merge commit; a stacked pull request is
   merged after its base, or its base is changed before the first is merged; the review
   consent, a candidate being a commit or a slice, and the Codex review of each slice.
4. Changing a rule, a new one included: the protocol of "One home for every rule (T16)",
   letters A to H, which replaces "Recording a new rule". A new rule or a new protocol still
   passes the five questions first (did it happen; twice, or once at a cost; can a check do it;
   can an existing protocol be amended; what does it cost and what leaves). A missing protocol
   is reported and proposed, never created.
5. Reporting a mistake: five parts (what happened; the fix now, checked or only sent; what stops
   it recurring; where it enters the harness, which feature and when; how it is proven later that
   it has not come back), and its entry in `docs/FAILURES.md`.
6. Handing off, to him, to a session or to a sub-agent: what was done, what was checked and how,
   what was not checked, what failed, what stays open; "not checked" and "failed" always filled;
   bad news first. A sub-agent that designs, plans or verifies runs on Opus 5.5 at high effort
   at least, or Fable 5.5 at high effort when it exists, and no other model; Haiku is a
   candidate only to write code (his rule of 2026-10-10, relief file, line 148; what the
   harness turns on from the comparison is not answered).

Sections 1 to 4 are the four protocols the roadmap starts with. The shapes of sections 5 and 6
are his (relief file, lines 6, 125 and 145); making each a section of this skill makes the
protocols six, and a new protocol is his, so the two are proposed to him in the build session
and not taken as given. If he says no, the two shapes stay as the one sentence of item 4 of
`AGENTS.md` and as the fields of `docs/FAILURES.md`. A seventh passes the five questions.

### Signals of done
The seven of the roadmap, each as something read and not judged.

| Signal | Read with |
|---|---|
| Six principles stated once | `rg -c` of the first principle's sentence over `AGENTS.md`, the template and the skills: one per file that carries them |
| No principle without a control | `docs/SPEC.md`: each principle names at least one check; row `spec` |
| No rule living only in memory | `js-harness doctor`: no `memory-rules` gap |
| `AGENTS.md` within its budget | row `budget` of `check` |
| The honesty eval passes and the line moves the score | the eval's report, with and without the line |
| No repeated mistake | `js-harness failures check --settled` exits 0; the entries `seen again` |
| No protocol without its incident | a test over the protocols skill: every section opens with a dated incident |

### Contradictions the build resolves
The fourteen the survey found; each names the text that wins. The first four are corrected in
`docs/ROADMAP.md` by the design session's own pull request; the rest by the build, and T11 is
done when each of the fourteen reads one way in every place that states it.

1. Context limit: nothing stops for a percentage and a session pauses at the context pause (his
   decision; the number is the board's, "One home for every rule") wins over the 73% of the
   roadmap, of the board (`bin/lib/sessions.mjs:20`) and of
   the orchestrator skill.
2. Merging code: the lead merges it when the gate passed, both reviews are recorded with nothing
   blocking and the pull request is clean (his decision, 2026-10-10) wins over "his, for now" in
   the roadmap and in three memory notes.
3. Push and pull request need no yes once the gate and both reviews are green (the charter) wins
   over "still wait for him".
4. A message between sessions is never his word, and his answers given in the orchestrator's
   chat travel with their transcript line (2026-10-10) amends the roadmap's point 2.
5. The orchestrator is the lead, not a watchman: the skill is rewritten by the session channel.
6. Gate etiquette: the lock replaces the board read before a commit and the turn asked of the
   orchestrator.
7. How a reply ends: C1 and the protocol "closing a reply" are the one place.
8. The handoff record: `AGENTS.md` says the roadmap and the feature document are the handoff
   "and nothing else is"; the relief file is the orchestrator's third. The line is reworded.
9. Effort and models: the roadmap's "medium by default" against high effort on every
   sub-agent. His rule of 2026-10-10 answers it for designing, planning and verifying. For the
   sub-agent that writes code it is open: the comparison is done and what enters the harness
   from it waits for his answer.
10. Stale notes: `merge-from-chat` ("never merge on your own"), `mistake-report-four-parts`
    (titled four, holds five), `cross-session-prompts` (says the skill is the source, and the
    skill lacks those rules), the roadmap's count of twelve memory notes (seventeen).
11. Clearing a session: a memory note forbids offering `/clear` as the cut, and the roadmap
    proposes comparing a clean start with a compaction. The note holds until test 6 of
    `odd/tasks/session-channel.md` is run; its result decides.
12. Opening by paste: the roadmap and a memory note keep the pasted opening; the opening as a
    file with one line of his (`odd/tasks/session-channel.md`, point 6) wins once built.
13. One feature at a time (a proposal of 2026-10-09 he never answered) against up to three
    work sessions (the charter he approved the same day): the charter wins, and the proposal
    is withdrawn from the roadmap.
14. Attribution in commits: the global `CLAUDE.md` forbids it and `AGENTS.md` is silent. The
    global file wins and nothing is added here, since what the stack already says is not
    repeated.

## Survey
Taken on 2026-10-10 by a read-only sub-agent over `AGENTS.md`, the seventeen memory notes of the
project, the two installed skills and their source, the template of `init`, four sections of
the roadmap, the 177 lines of the relief file and the global `CLAUDE.md`; one row spot-checked by
the design session (`bin/lib/project.mjs:285-303`). Not read: the other feature documents, engram,
and what open sessions hold only in their conversations.

Today: AG `AGENTS.md`, TPL the template, SK a skill, MEM a memory note, REL the relief file, RM
roadmap text, CHK a check. Goes to: L a line of `AGENTS.md`, L+T also the template, C1 to C8 the
checks above, P1 to P6 the protocol sections, CH the session channel (its skill, commands or
board), GL the gate lock, MF a machine fact that stays in memory, DROP stale.

| # | Rule | Today | Goes to |
|---|---|---|---|
| 1 | A behaviour change comes with its test, written first | AG, TPL, CHK partly | L+T |
| 2 | A claim carries its evidence | AG, TPL | L+T, with 4 |
| 3 | A claim of absence names the search | AG | P6 |
| 4 | Each claim is checked, assumed or not known; nothing invented | RM | L+T, C5, C7 |
| 5 | The six principles | RM, REL | L+T |
| 6 | Writes outside the repository are recorded and undone exactly | AG, CHK | L, C4 |
| 7 | The earlier harness folders are read-only references | AG | L |
| 8 | `npm run check` is the single gate | AG, CHK | L |
| 9 | A session starts at the roadmap; the feature document is read first | AG | L |
| 10 | A feature document opens with the task contract | AG, CHK | L |
| 11 | He decides spend, the irreversible and product; one at a time | AG | L+T, with 12 |
| 12 | The items that are his; name which; the rest is decided and told | MEM, RM, REL | L+T, C1 |
| 13 | Review consent is pre-granted | AG, MEM | L, P3 |
| 14 | A candidate is a commit or a slice, never the branch | AG | P3 |
| 15 | Codex reviews each approved slice of code | AG, CHK | P3 |
| 16 | Keep moving; never idle on an open question | AG, MEM, REL | L, CH (count of bare yes) |
| 17 | A report opens with a plain summary and closes with a recap and the spend | AG | P2 |
| 18 | The orchestrator's reply opens with what needs him, what runs alone, what was done | REL | CH |
| 19 | A step he reports doing outside the session is checked first | AG | L, with 20 |
| 20 | The receiver checks one thing in a session's or a sub-agent's report | RM, REL | L+T |
| 21 | One session, one feature; decisions written and committed the same session | AG, SK | L |
| 22 | Tell him when to cut | AG | P2, CH |
| 23 | A reply ends with exactly one of four states | AG, RM, MEM | C1, L+T |
| 24 | A planned step whose only answer is yes is no decision | AG, RM, MEM | L+T, with 12 |
| 25 | A block holds only his text, under three labels; never an instruction | AG, RM, MEM | C1, P1 |
| 26 | Before the block: what the yes covers, what it does not, the other option | MEM | P1 |
| 27 | Never ask while work runs; one question pending | AG, RM, MEM | C1, P1 |
| 28 | A question asked again says the earlier answer still holds | RM, MEM | P1 |
| 29 | A cut is two numbered blocks | AG, MEM | C1, P2, then CH |
| 30 | The reply after a cut resumes from the feature document | AG | CH (resume hook), P2 |
| 31 | Before the block: done, next and why, which session | AG, MEM | P2 |
| 32 | The map from `js-harness progress` | AG | P2 |
| 33 | Artifacts in English; Conventional Commits with a why | AG | L |
| 34 | Never offer `/new` or `/clear` as the cut | MEM | P2, judged again after the clean-start test |
| 35 | Check `remote status` before sending him to the phone | MEM | MF |
| 36 | Merge only on his explicit go | MEM | DROP |
| 37 | Announce when a stretch or a session finishes and where to return | MEM, RM | C1, CH (notice `closed`) |
| 38 | The context percentage in every recap | MEM, RM | P2, until the board shows it |
| 39 | Never stop for the percentage; at the context pause, write the state, finish or compact | MEM, REL | CH, C1 (nudge) |
| 40 | Cut at a task's end; do not start a task that will not fit | RM, MEM, REL | P2, CH |
| 41 | The charter: what the orchestrator does alone | RM, MEM, REL | CH |
| 42 | The lead merges code and gives the go-ahead of later stages | REL | CH |
| 43 | The lead: four entry-gate answers, the next feature proposed, doubts kept | RM, REL | CH |
| 44 | The orchestrator never implements, commits or answers for him | SK | CH |
| 45 | The orchestrator writes no other session's prompts, except the opening | SK, MEM | CH |
| 46 | The orchestrator writes to him only on six events | SK | CH |
| 47 | The relief file: one dated line per event; relief, not compaction | SK | CH |
| 48 | A live handover: the new one asks the one before, checks one thing | RM, REL | CH |
| 49 | The handover of the title | REL | CH |
| 50 | Session names | RM, REL | CH |
| 51 | A work session prompts only for itself | SK, MEM | CH |
| 52 | Finished is said in the first line; not finished while background work runs | SK, MEM | CH, C1 |
| 53 | A plan change is written and committed before going on | SK | CH |
| 54 | Notices in one line, to the title; never resend a held one | MEM, RM | CH |
| 55 | A message between sessions is a claim, never his word | RM, MEM, REL | L+T, with 20 |
| 56 | His answers travel with exact words and transcript line | REL, MEM | CH |
| 57 | A bare paste is not his word | MEM, REL | CH (the opening) |
| 58 | An unused block is repeated whole; while he is away an open block is given once and held (his rule of 2026-10-11, later than this row) | REL | CH |
| 59 | Never two gates | SK, MEM, RM | GL |
| 60 | While a gate runs: no test, board read or reviewer; one try | MEM, REL | GL, P3 |
| 61 | No gate turn is asked of the orchestrator | MEM, REL | GL |
| 62 | Push and pull request need no yes once gate and reviews are green | MEM, RM | L+T, with 12; P3 |
| 63 | A check and what it allows share a command only if conditional | MEM, REL | P3 |
| 64 | Text with backslashes goes through a file, never a heredoc | MEM | MF |
| 65 | High effort on every sub-agent | MEM, RM | P6, C8 |
| 66 | Haiku only to write code; design, planning, verifying on Opus 5.5 high | REL | P6, C8 |
| 67 | His wording is the need, not the specification | MEM, RM, REL | L+T |
| 68 | A rule is recorded only when it is in what acts | MEM, RM | L, P4, C6 |
| 69 | Every proposal judged twice | MEM, RM | L |
| 70 | Measure before guessing; a finding goes to the session that owns it | MEM, REL | P5, C2 |
| 71 | A mistake is reported in five parts | MEM, REL | P5, C2 |
| 72 | The handoff shape; bad news first | RM, REL | P6 |
| 73 | A missing protocol is reported and proposed, never created | RM, REL | P4 |
| 74 | Reversible by default | RM | L+T, with 12 |
| 75 | A command one does not know is read, never run for its help | RM, REL | C4, P3 |
| 76 | The orchestrator's controls kept by hand (eight) | REL | CH |
| 77 | The size a reviewer takes is checked before the commit | REL | P3; the row exists (`bin/check.mjs:513-560`) |
| 78 | A measurement names its binary by path | REL | `odd/tasks/subagent-model-routing.md` |
| 79 | A work session settles its plan with him before building | REL | CH |
| 80 | Nobody starts on files an open branch changes | REL | CH (collision sensor) |
| 81 | Sessions open by his paste, not by a scheduled task | REL, RM | CH |
| 82 | A restart is proposed with its reason | REL | CH |
| 83 | Trust the model page over the built-in list | MEM | MF |

## Failures of 2026-10-10
The list the orchestrators kept that day (relief file, lines 143, 144, 167, 172 and 175), as the
seed of `docs/FAILURES.md`. It is the list as it stood that day and is not kept up: the register
holds each of these with the state the command computes, its control and the task that owes
one, and `js-harness failures` is where they are read. The table stays because this document
cites its numbers. Owner, as designed that day: RH this feature, CH the session channel, GL
`feat/gate-lock` (failures 9 and 16 name a gate log that `odd/tasks/gate-log.md` builds).

| # | What happened | Owner | Control | Proof |
|---|---|---|---|---|
| 1 | A yes was asked of him that was not his | RH | C1: a decision names its item | count of bare yes per session is 0 |
| 2 | A rule changed in a memory note did not reach open sessions | RH | C6; the rule in a check or a line | `doctor`: no `memory-rules` gap |
| 3 | A block he had not used was referred to by its hour | CH | no block for another session; a notice is a record | notices carried by his paste, counted by the board: 0 in the stretch of its "Done when" |
| 4 | An opening pasted with no line of his cost one more yes | CH | the opening is a file, his line is typed | count of a yes after a paste is 0 |
| 5 | A finished feature sat six hours: a phone session could not be reached | CH | the notice is a record the board reads | a practice step: a notice read with no message sent |
| 6 | The 73% mark and the cut near 70 | CH | the limit as room left; the pause | count of cuts proposed under the pause is 0 |
| 7 | A wait process could not be attributed from the board | CH (T4) | the board prints each wait with its session | a test of the board, fixture with two waits |
| 8 | Stopped tasks and archived sessions printed as live | CH (T4) | the roster; a stopped task reads as stopped | a test of the board |
| 9 | "No gate runs" said twice while one ran unseen | GL | a gate log, one line per run | the log; none exists on the branch yet, so the proof is owed by its session |
| 10 | A commit of 2,250 lines passed the gate and could not be reviewed | GL | the size is read before the commit | the row `codex-review` (debt) prints the size (`bin/check.mjs:513-560`); whether it refuses is its session's to name |
| 11 | An untracked folder made the review assessment fail | GL | the test run leaves no folder | owed: a test that a gate leaves the worktree with no untracked path |
| 12 | The lock left an empty folder on his disk | GL | repaired in `3659fb5` (its session's claim) | its test, not read here |
| 13 | A gate killed at its bound leaves its temp folders | GL | the gate removes its temp folders when it is killed at its bound; no task in its document yet, passed to its session | owed: a test that kills a gate at its bound and finds no folder left |
| 14 | An orchestrator's context fills in hours | CH (T9) | fewer wakes; the record instead of board reads | reliefs per working day, from `relieved` lines: at most one |
| 15 | After `main` is merged in, the assessment counts its commits | RH (T4) | protocol 3: after a merge the base is the merge commit; the push row hints that base | a test of the push row's hint on a fixture branch with `main` merged in |
| 16 | A test started beside an eval batch | GL | every heavy run takes the lock | the gate log shows no overlap; owed with 9 |
| 17 | Failure 4 again: the opening of this session, 28 minutes waiting | CH | as 4 | as 4 |
| 18 | Hours written in the relief file were guessed | CH | the command that appends a line stamps the clock | a test of that command |

## Tasks
- [x] T0 Design: the survey, the placement of the 83 rules, the checks, the outline of
  `AGENTS.md`, the protocols, the signals (route: inline, with three read-only sub-agents for
  the survey and the host documentation)
- [ ] T1 `docs/SPEC.md` from the capability survey, and the row `spec` (both built, route: inline,
  JH 25, on `feat/jh25-spec`; Progress, 2026-10-16; open: section D). It takes section D of
  `docs/model-effort.md` (documentation by model, graded by a test that rebuilds a capability
  from the documents alone, not built): one of the two measurements that spend, his to allow before it
  runs, asked once when he is back
- [ ] T2 The reply check: `bin/lib/reply.mjs`, `bin/reply.mjs`, the `Stop` entries in the
  manifest for both hosts, the `reply` key of `harness.json` (route: inline, JH 25; built on
  `feat/jh25-spec-reply`, the key waits for his answer to question 9; Progress, 2026-10-16)
- [ ] T3 The failures register, as "The failures register" designs it (route: delegated, one
  writer; the trigger is three files that are not mechanical)
  - [x] T3a The design read by a reader that did not write it, and what it found taken or
    answered
  - [x] T3b `bin/lib/failures.mjs` and its tests: the parser, the refusals, the seven states,
    the counts (commit `9a2edb1`; gentle-ai approved the range `51a24db..5b754dd`; the Codex
    review is owed)
  - [x] T3c `bin/failures.mjs` and its tests: the command `js-harness failures` and the row
    `failures` of `check`; the entry in the dispatcher (commit `547ef55`; its two reviews are
    owed)
  - [x] T3d `docs/FAILURES.md` seeded from the records, not only with the eighteen: every
    failure the relief file and the feature documents tell, each control in place found by the
    command in the file it names
  - [x] T3e (commits `b6babc3` and `2b4e3ee`, pull request 82, on `main` at `bf982b1`;
    Codex's records cover both, and gentle-ai assessed the range as not due)
    The tokenizer measures a fence from the list item it is under, not from the margin
    (found by Codex in `21686a5`, second priority): today a fence under an item that opens
    within three spaces and closes deeper is left open, and with the option off a checkbox
    shown in a fence indented past three spaces is counted as a step by `js-harness progress`
  - [x] T3f A level of the register for a failure with no control, measured: a failure whose
    control was measured as not worth building keeps a state of its own, not "owed". The
    lead's call of 2026-10-15 at 08:37, relayed by JH 15's notice of 08:44: `checked-not-read`
    and `told-him-unverified` keep `Control: owed`, pointing at an unchecked task of
    `odd/tasks/honesty-audit.md` (the general audit was measured not worth it, 2 or 3 of 14),
    until the register has this level, "which is yours to add". Designed under "A failure with
    no control, measured (T3f)"; built test first as draft pull request 219
    (`feat/register-measured`, 43b395f): gate green, gentle-ai medium not due, Codex correct
    (0.88), no findings, 151,069 input tokens, recorded. Landed: merged 2026-10-15T15:37:10Z by gh, 43b395f on main; JH 15 told
- Moved on 2026-10-14 to "JH 12 · comandos y diagnóstico", by the lead's message to this
  session; their state is kept in `odd/tasks/commands-and-doctor.md`, and only there: T4 (every
  command that writes outside the repository refuses a flag it does not know; and the push row
  hints the merge commit as the base after `main` is merged in, failure 15), T5 (the row
  `citations`, INFO) and T6 (the row `memory-rules` of `doctor`). They carry no checkbox here,
  so that `js-harness progress` counts them once
- [x] T7 The skill `js-harness-protocols`, six sections, each opening with its incident (JH 27,
  branch `feat/protocols-skill`, Progress 2026-10-16; sections 5 and 6 are built on the lead's
  assignment and stay his to keep or drop)
- [ ] T8 `AGENTS.md` rewritten within the budget, its wording passed by him. His idea of
  2026-10-11 for how (relief file, line 203), recorded here and not built yet: the text is
  drafted in `docs/agents-build.md`, analysed, reordered and polished there with the budget
  measured on the draft at each step, and when he approves it one commit copies it over
  `AGENTS.md` and deletes the draft, so there is never a second source. The reason the lead
  added: a session that edits `AGENTS.md` in its own worktree reads that file on every turn, so
  a half-written version would govern the session that writes it
- [ ] T9 `agentsTemplate` gains the lines that hold in any project; whether `init` turns the
  reply check on is asked of him. The lines are built and their wording is his yes
  (`feat/template-lines`, Progress, 2026-10-16); the empty register is built
  (`feat/empty-register`); open: `init` turning the reply check on by default, his answer,
  built once C1 is (T2)
- Moved on 2026-10-14 to "JH 15 · auditoría de honestidad", by the lead's message to this
  session; their state is kept in `odd/tasks/honesty-audit.md`, and only there: T10 (the honesty
  eval: the task and its proof; then, before any spend is asked of him, the number of trials,
  their cost at list price and the difference in score that counts as "the line moves it"; then
  the trials with and without the line), T13 (the sub-agent model check, C8) and T14 (the
  honesty audit, C9). No checkbox here, so that `js-harness progress` counts them once
- [ ] T11 Every rule moved: the memory notes placed and, on his word, deleted; the remaining
  contradictions of the roadmap corrected
- [ ] T12 Practice journey: a step for the template's lines and one for the reply hook
- Moved on 2026-10-14 to "JH 14 · protocolo para modelos futuros", by the lead's message to
  this session; its state is kept in `odd/tasks/future-model-protocol.md`, and only there: T15
  (the seven signals read and recorded; the roadmap's section replaced by a pointer only after
  what it holds and this document does not, the reading of the specification, "how far is far
  enough", the bullets on bias and research, the team rules, is in `docs/SPEC.md` or here). No
  checkbox here, so that `js-harness progress` counts it once
- [ ] T16 One home for every rule, by the protocol of "One home for every rule (T16)" and in
  its order (route: delegated; after T17, before T1)
  - [x] T16a The approved protocol in this document, read against the relief file's lines 253
    and 254 by a reader that did not write it (twelve fixes, all taken), and the nine places
    where it differs from the eight points, pulls two ways or stays open told to the
    orchestrator
  - [x] T16b The homes and the list: how a rule is declared, designed and read by a reader
    that did not write it; then the declarations of the rules that have a value today, and
    `docs/RULES.md` rendered from them
    - [x] First part: the design, the library, the check, the command, fourteen rules with
      their sources and the rendered list (commits `859a797`, `8ada9cc`, `8668dfc`, `79f9bbf`
      and the correction `331090b`; gentle-ai approved each code commit and Codex's records
      cover `859a797..6a721cc` and `b0ccff1..331090b`)
    - [x] Second part: each constant reads its declaration, one file at a time, each told to
      the orchestrator before it is touched. Done: the four bounds whose files were free
      (commit `21b391f`); the context pause, declared as `context-pause` and read by
      `bin/lib/sessions.mjs` (commit `ca83a3d` on `feat/rules-context-pause`; gentle-ai
      assessed it as not due, and Codex's record covers `e90e0a4..ca83a3d`, 204,919 input
      tokens, the patch correct). The window and the share at which the host compacts are
      not declared, against the design's line "the context pause and the window": they are
      figures of the host, each with one home and a flag, not rules. The model and the effort
      of a Codex review read their rules and `codex-review --plan` reads the three rules of
      the allowance (commit `f2896a6`, pull request 93; gentle-ai not due, Codex's record
      covers `53826d8..f2896a6`, no finding). The command's test file states neither value
      any more (branch `test/review-literals`). On 2026-10-15, `contract-run-timeout`, read by
      `bin/contract.mjs` (commit `b7e1681`, draft pull request 190), and `review-timeout`, read
      by `bin/codex-review.mjs` (commit `8f1b080`, draft pull request 192, stacked on 190):
      gentle-ai assessed both as medium and not due, and Codex's records cover
      `149e1d8..b7e1681` and `b7e1681..8f1b080`, each patch correct with no finding. Then
      `sensor-timeout` and `agents-budget`, read by `bin/check.mjs` (commit `64e2e6b`, draft
      pull request 196, stacked on 192; `git merge-tree` against the three branches that
      change that file: two clean, `feat/flaky-ledger` conflicting only in `docs/FAILURES.md`,
      as it does with `main`; Codex's record covers `8f1b080..64e2e6b`, no finding). All three
      are on `main` since 2026-10-15 (`eec4ee3`). The queue of values the second reader found
      ("What T16b builds", item 2), judged by the design's test (a value is a rule when a
      text in force states it or a person decided it): the gate log's size and its command
      cut are stated in `docs/ROADMAP.md:897-898`, so they are declared as `gate-log-size` and
      `gate-log-command` and read by `bin/lib/gate-log.mjs` (commit `2e47e6d`, draft pull request 206; gentle-ai
      medium and not due; Codex's record covers `eec4ee3..2e47e6d`, no finding).
      The shortest phrase of a control was declared before, as `control-phrase-min`. The rest
      stay in code, each for its reason: the channel's four limits (`bin/lib/channel.mjs:38-47`),
      the runs a plan needs (`bin/lib/codex-review-plan.mjs:53,56`), the prompt's bound
      (`bin/lib/codex-review-prompt.mjs:51`) and the board's timeout (`bin/sessions.mjs:87`)
      are tuning that no text states and no person chose; the exit code of a wait that gave up
      (`bin/gate.mjs:50`) is sysexits' `EX_TEMPFAIL`, a code of an interface; the goal's length
      (`bin/contract.mjs:24`) is the host's documented `/goal` limit, a figure of the host like
      the window; the efforts a contract takes (`bin/lib/contract.mjs:34`) are read by nothing
      since a task's kind sets its effort (`odd/tasks/effort-by-task.md`, S1); the review's
      session (`bin/codex-review.mjs:224`) is a name the run log writes, not a value. The
      gate log's two rules are on `main` (pull request 206). The last file of the design's
      list, `bin/lib/manifest.mjs`, the js-harness skill, wrote four figures as literals: the
      lock's wait and the bound of `gate --max` (commit `e5b7588`, pull request 213: the skill
      reads `gate-wait` and the new `gate-max`, which `bin/gate.mjs` reads too, and check's
      usage of `--wait` derives its 60), and how often `js-harness wait` checks and how long
      it waits (commit `5f33fde`, pull request 216, stacked on 213: `wait-every` and
      `wait-for`, read by `bin/wait.mjs`). Each passed the gate, gentle-ai assessed it as
      medium and not due, and Codex's records cover `565c50f..e5b7588` and
      `e5b7588..5f33fde`, each patch correct with no finding. Its 150 characters are the
      host's limit of a memory index line, left. Left: the dispatcher's help
      (`bin/js-harness.mjs:10`) still writes the gate's 60 and 30, a file pull requests 201
      and 194 change, so it follows them (both found merged on 2026-10-15, before 09:57 by `date`; the help reads
      `gate-wait` and `gate-max` on `feat/rule-dispatcher-help`, its own pull request); and two
      test files that still state the review's
      model as a fixture, `bin/lib/codex-review-plan.test.mjs` (17 lines) and
      `bin/lib/codex-review-runs.test.mjs` (11), which are JH 8's to free. Since then: 216
      moved onto `main` as 4cf6844 (Codex 0.97) after 213 landed, and landed; the dispatcher's
      help landed as pull request 230 (b1c2451, Codex 0.97), with `rules check` passing on
      `main` cd89253 after both. JH 8 was archived, and the lead gave its two files to this
      session: the fixtures' model is `gpt-fixture`, and the binding test that keeps
      `bin/codex-review.test.mjs` free of the model now covers both files. It was red on
      `main`'s files (19 lines). Draft pull request 232 (`feat/rule-review-fixtures`, 41ee91f):
      gate green, gentle-ai medium not due, Codex correct (0.97), no findings, recorded. This
      part was checked off when 232 landed (main 10e29e6, 2026-10-15 at 15:04 by `date`)
    - [x] Third part: model and effort as rules, as "Model and effort as rules" designs it:
      `alias` and `scope`, the guarded read, `js-harness rules applied`. It takes B1 and B4 of
      `docs/model-effort.md`, and with T13 the checking half of B3 (the orchestrator's
      settlement of 2026-10-12). Built: the fields, the guarded read and the declarations
      (commit `528bf56`, approved by gentle-ai), the command (`34c2dfc` and the commit after
      it), the block that holds sessions and sub-agents to the rules with no short name, the
      checking half of B3 (pull requests 73 and 78, each with gentle-ai's approvals and
      Codex's records). What it leaves, named: a row of `check` or `doctor` that calls the
      command, whose files are open in other features; the hook that refuses a launch (T13),
      which is his to approve
  - [x] T16c The one command that changes a rule: designed on 2026-10-15 and read by two
    readers (the attack and what was missing), "The one command that changes a rule (T16c)";
    route inline, the parent writes it (no writer trigger: one unit, a session well under the
    backstop). Built on `feat/rules-change`: 3f48e4b, ff3bbf4, d9e0925, 0acb6bf, then the
    verifier's fixes a5877e4 and Codex's fixes 6986330; pull request 238, landed on 2026-10-15
    (`main` e7e97df), its design as pull request 234 (d2441d5)
  - [x] T16d The row `rules`: a pattern for each rule on added lines, reporting and then
    refusing rule by rule, with a planted violation as its test; after the gate stops before
    its sensors; designed on 2026-10-15, "The row `rules` (T16d)"; route inline; built
    b0093b8..5a57a17, pull request 247, landed on 2026-10-15 (`main` a1e8fb3), its design as
    pull request 241 (d4ec52d). Its step 2, the first patterns, is in progress in `rule/` batches
  - [ ] T16e The merge command, the rule rows first. Two needs it takes, from the lead's
    inventory of 2026-10-12 (relief file, lines 325 and 337, not read by this session): the
    loop over what the reviews cover looks at each record itself, and the evidence of a
    review is written in a document on the pull request's own branch. Designed on 2026-10-16
    by "JH 24" and read by two readers, "The merge door (T16e)"; route inline, the parent
    writes it (no writer trigger: three slices in order, each one unit); branch
    `feat/merge-command`. Slice (b) waits until the orchestrator has put the design to him
  - [ ] T16f Reach: the turn-start hook, confirmed first with a logging hook; the hash of the
    rules in the installed command; the template's marked block
  - [x] T16g Letter H, the protocol's own home: it replaces protocol 4, opens with the incident
    of the relief file's line 245, carries its cost and a review date, and its done is one
    command that exits 0. Added on 2026-10-15: the reader of T16c's design found no task for it.
    Built by JH 27 on 2026-10-16, see "Progress"
- [ ] T17 The sweep of 2026-10-11 (his order of that day; route: delegated, read-only readers,
  then one writer for documents)
  - [x] T17a The list: `docs/sweep-2026-10-11.md`, pull request 61
  - [x] T17b This session's places corrected in documents: the roadmap and eleven closed
    feature documents, 83 places, pull request 62 (commit `119adbc`); four more are left
    unchecked in the list with their reason, and the six of `odd/tasks/codex-parity.md` wait
    for that document's branch
  - [x] T17c This session's places in this document (13) and in code (7: `bin/codex-review.mjs`,
    `bin/install.mjs`, `bin/js-harness.mjs`, `bin/lib/codex-review-parts.mjs`,
    `bin/lib/manifest.mjs`, `bin/lib/project.mjs`), the code through the gate and both reviews
  - [x] T17d One entry of the register for the failure itself, with the sweep as a sighting
    (`old-rule-beside-new`; its control is owed by T16)
  - [x] T17e The 104 items still open on 2026-10-16, read again and closed where they could be:
    57 checked off, 47 left to their owners (Progress, 2026-10-16)

## Progress
- 2026-10-10, T0. The session opened by Sebastián's paste and waited for a line of his (failure
  17). Read: `AGENTS.md`, the roadmap at `origin/main` (`ca013c2`, then `df15929`), the close of
  `odd/tasks/session-board.md`, the relief file's lines named by the opening.
- 2026-10-10, the capability survey, for T1 (read-only sub-agent; `path:line` under this
  worktree unless said). Commands of the dispatcher (`bin/js-harness.mjs:38-53`): `check`,
  `init`, `install`, `sync`, `uninstall`, `status`, `update`, `upgrade`, `doctor`, `progress`,
  `contract`, `codex-review`, `remote`, `sessions`; on `feat/gate-lock`, `gate`. Rows of `check`:
  `budget`, `contracts`, two `payload` rows, one per sensor, `review`, `codex-review`
  (`bin/check.mjs:19-47`, `:326-364`, `:445-471`, `:513-560`); a built-in row is a function
  returning `{ name, pass, detail }` pushed in `main` (`:613`). Hooks: `.githooks/pre-commit`
  and `pre-push`; `install` writes one `SessionStart` entry per host, matcher `startup|resume`,
  running `js-harness doctor --hook` (`bin/lib/manifest.mjs:128-150`); no `Stop` hook, no
  `compact` matcher and no status line exist. `install` writes two skills per host
  (`:101-122`); adding one is one item. `init` writes `harness.json`, `AGENTS.md` from the
  template, a pre-commit hook and the project manifest (`bin/lib/project.mjs:285-310`,
  `:662-770`). `doctor` rows are objects in `tools` or `checks` (`bin/lib/stack.mjs:514-563`).
  An eval task is a folder with `task.md`, `task.json`, a fixture, a hidden grader and a
  reference (`evals/runner.mjs:49-75`). The practice journey takes a step as one entry in
  `JOURNEY` and one function in `STEPS` (`scripts/practice-lib.mjs`, `scripts/practice.mjs`).
- 2026-10-16, JH 25, T1 built on `feat/jh25-spec` (from `origin/main`, apart from T2's draft pull
  request, by the lead's notice of 13:15). Written now because the roadmap stands at 96% and the lead
  gave it: his decision that `docs/SPEC.md` comes last, with the code still (`docs/ROADMAP.md`).
  - The row `spec` (`bin/lib/spec.mjs`, in `bin/check.mjs` after `contracts`): no row where a project
    keeps no `docs/SPEC.md`. Each `### ` capability under `## Capabilities` must hold the six fields
    (Problem, Requirement, Reason, Proof, Discarded, Today); a proof holds at least one command in
    backticks; each item of Today is a file of the repository (it must exist; `path:line` reads as
    its path), `js-harness <command>`, an id of the manifest or a path under `~/`. Only in the harness's
    own checkout (its package bears the harness's name), every command of the dispatcher, every id of
    `components` and `entryComponents` and the two home files no entry stands for
    (`~/.js-harness/manifest.json`, `~/.claude/settings.json`) must be claimed, and a claimed command
    the dispatcher lacks is a finding. Files a command names at run time (a launcher, the channel) are
    not enumerated, and `docs/SPEC.md` says so. RED observed (module missing), then 13 of 13 green.
  - `docs/SPEC.md`: 49 capabilities, from the notes the lead compiled
    (`~/.js-harness/spec-notes/`, outside the repository) and two read-only readers' notes over the
    feature documents for the commands with none (not kept). The feature documents they cite stay
    the record: each entry names its incident and its proof, so it stands without the notes. JH 10's
    first note is left out as it stands: the GitHub workflow it describes was removed
    (`odd/tasks/drop-github-gate.md`), and the merge queue's entry carries that lesson under Discarded.
    The reply check's entry joins with T2's pull request, which then has the command to claim.
  - Not done: the line `AGENTS.md` should carry to send an agent to an entry (the roadmap's design):
    `AGENTS.md` stands at about 1,478 of 1,500 tokens and is rewritten by T8, which places it. Section
    D's measurement (C5 of `docs/model-effort.md`) is not built: it needs an eval that rebuilds one
    capability from the documents alone, with held-out tests, and its cost figure before he allows it.
  - Main gained the CI overflow gate (35a0423) meanwhile: `bbd1b74` adds its capability (50 now) and
    drops the spec's word that the repository is private.
  - gentle-ai on `8b3c031..bbd1b74`: medium, not due (`under_budget`), raised to high by item 5 (a row
    of the commit gate that refuses commits here); lenses risk, readability, reliability; approved and
    acknowledged (`review-95be76221f6981fc`), its bound STATUS first timing out three times while a
    whole suite ran outside the gate lock. Of its seven advisories, closed with tests (RED 4, then 17
    of 17): a field written twice or outside the six is no longer stored; fenced lines are text; a
    manifest id in a project's spec reads as an id; "own" is the package's name, not the module's path,
    so the installed command or a junction holds this checkout too; and the absolute path above. Left:
    a proof is any text in backticks, not a command shape. Those fixes are `a6fe143`.
  - Codex on `8b3c031..a6fe143` (3 files, 329 lines): the patch is correct (0.84), 91,062 input
    tokens, recorded.
- 2026-10-10, host documentation read by a sub-agent: `code.claude.com/docs/en/hooks.md`,
  `statusline.md`, `skills.md`, `commands.md`, `cross-session-messaging.md`, `cli-reference.md`,
  `remote-control.md`; `learn.chatgpt.com/docs/hooks` (as the sub-agent gave it; not opened by
  the design session). Not retrieved: the full settings
  reference and the scheduled-tasks page.
- 2026-10-10, delivery of the design. Commit `6d8bc82` holds both documents and the roadmap's
  pointers; its gate ran 22:40:05 to 22:55:02 (897 s, one try, after waiting for a gate and two
  test runs of other sessions to end). gentle-ai assessed it medium and due by size (895
  lines); the review ran on the consent already granted, one lens (reliability), lineage
  `review-ed901e320032842b`, approved and acknowledged. Its four findings were advisory and all
  four were taken, in the commit after it: the exit codes of `sessions --address` (one code for
  none and another for several, the caller never counted); the fourteen contradictions listed
  one by one, so T11 can be counted; the roadmap's two sentences that still said "not started"
  and "replaced by a pointer once it exists"; and the practice run bound to a folder of this
  machine, which is now read and not a command of either contract. No Codex review: the range
  holds no code (`check`, row `codex-review`: "no code commits since origin/main").
- 2026-10-10, a second review, asked by the orchestrator of a read-only sub-agent before it
  merged pull request 55 and sent here as claims. Four blocking items, each checked before it
  was taken. (1) The roadmap said "the document wins" while `odd/tasks/session-channel.md`
  restated the charter without its Codex cap: checked (`rg -c "3 million"` found none); the cap
  and "compaction left to the host" are back, and the roadmap's sentence now covers the design
  only, never a decision the documents do not restate. (2) Two questions put to him and not
  answered were treated as settled: the roster as a slice of its own, and what enters from the
  sub-agent models comparison, which closed in pull request 54 after this document was written
  (read now at `origin/main` `e8a0b6a`, "Subagent models result"); both are under "Ask me
  before" of their document, and contradiction 9, C8, protocol 6 and T13 say "not answered".
  That the orchestrator asked him at 22:35 is its message's claim, not read here. (3) Failures
  7, 13 and 15 had no task or no proof: 7 is named in T4 of the channel, 15 in T4 here and in
  protocol 3, 13 has its control and a proof marked owed by its owner. (4) C1 refused every
  block outside a decision while the channel keeps two texts he carries: C1 now tells a block
  for this chat from a carry block.
- 2026-10-10, taken from the same review's smaller list: the test files the contract names are
  said not to exist yet; the scope names `bin/lib/failures.mjs`, `bin/lib/spec.mjs`, the
  dispatcher and a root `harness.json`; the honesty audit has a place (C9, T14); protocol 3
  carries the merge order of a stacked pull request; `AGENTS.md` item 9 points to the
  specification, item 2 carries "never idle", item 4 the two fields of a handoff that apply to
  every report; protocol 6 names Fable 5.5; the 85% line is described in C1; sections 5 and 6
  of the protocols are proposals for him; the quote marks on a paraphrase are gone; the budget
  figure cites the gate's own row; the memory types and the two `Stop` hooks are marked as
  not read and not tested; T10 fixes trials, cost and threshold before any spend; T15 keeps
  the roadmap's section until what only it holds is moved. Not taken, with the reason: a
  contract command for each later check (the build adds each test as it writes it; a file
  name guessed now is a claim nobody checked); the Codex documentation's address stays as the
  sub-agent gave it, marked as not opened by this session.

- 2026-10-11, the build opens at T3. The session `JH 7 · registro de fallas y reglas` was opened
  by the orchestrator's block, pasted with no typed line of his; before it did anything it
  compared the paste with the block of the orchestrator's last reply (transcript `7d2ae675`,
  line 1399: identical, 3,192 characters) and read his words at line 1360. Why T3 comes before T1
  and before the session channel is merged: he asked on 2026-10-11 for a record of failures and
  of wrong information that counts repeats (relief file, line 236), and neither T3 nor T1 edits
  what the channel edits, except one entry of the dispatcher. The constraint "Not built while
  the session channel is being built" stands for T2, T7, T8 and T9. Worktree
  `D:\js-harness-worktrees\failures-register`, branch `feat/failures-register`, cut from
  `origin/main` `51a24db`. The design of the register was written before any code ("The failures
  register"); what changed against C2 as first designed, and why: the id is a word and not a
  number (two branches collide on the next number); the state is computed and not written; a
  control is a place and a phrase the row can find, which replaces the separate proof; and a
  repeat with no control is refused only until a task owes it, so that recording stays cheap.
- 2026-10-11, T3a. The design (commit `5fd9cad`) was read by a sub-agent that did not write it
  (Opus 5.5, high effort, read-only), told to attack each refusal with a scenario. What it found
  and what was done, each checked by this session where a line is given:
  - Three of the five refusals turned `main` red with no author and made a bystander pay a whole
    gate (a test renamed on another branch, a task checked off on another branch). Checked:
    `bin/check.mjs:964-995` computes the static rows first and prints them after the sensors.
    Taken, and further than it proposed: every state that depends on another file or another day
    is counted and printed, and refuses nothing; the force moved to `failures check --settled`
    in this contract.
  - The refusal of a sighting later than its control emptied its own number: on a green tree it
    was always zero. Taken: `seen again` is a state that is counted, with the `Was` lines.
  - The count of one failure is its weakest part: two sessions that add a sighting conflict on
    the same lines, two that name one failure differently make two entries, two that read one
    record count it twice. Taken: the order of sightings is free, the same date and evidence
    count once, and the design says the count by class is the one to trust.
  - A control owed to a task number could not be written by a session that does not own the
    document, and the design's own example named a task that no branch holds (`gate-log.md` has
    T1 to T8, all checked: read at `odd/tasks/gate-log.md:304-331`). Taken: owed is a phrase of
    an unchecked list item, and a repeated failure with nothing owed is a state, not a refusal.
    The example now holds no task that could be read as a fact.
  - The phrase would not have matched as written: this machine's files end their lines with a
    carriage return and `AGENTS.md` wraps its sentences. Taken: white space is read as one space
    on both sides, a phrase has a least length, a path is refused in the shapes `documentFault`
    refuses.
  - The reader of fields was not designed. Taken: "How a field is read".
  - His "comprobar que esto no vuelva a fallar" was served less than the seed's proof column
    did. Taken in part: the optional `Proof` field; the limit is said plainly.
  - Cut on its advice: `--json`, the `node --test` hint, the refusal of sightings out of order.
  - Stated as fact here and false, corrected: `harness.json` is tracked; `TOKEN_BUDGET` is at
    line 21. Left as written, because it is a record of that day: `bin/check.mjs:513-560` in
    failure 10 of the table below, which the review places at `:842-889` today (not read here).
  - Not taken: stopping the gate before its sensors when a static row fails. It is right, and it
    is the gate's code, which another session owns: passed to the orchestrator as a proposal.
- 2026-10-11, from the orchestrator by message (claims, the first read here). `bin/check.mjs`
  and `bin/js-harness.mjs` may be touched on this branch; three unmerged branches change the
  same places (`feat/gate-log-file`, `feat/session-board-channel`, `feat/session-context`), so
  the change stays at one import, one call, one usage line and one entry, and `main` is merged
  in before the push. And a standing instruction of his (relief file, line 240, read: "si nos
  llegamos a quedar sin uso de codex semanal, me avisas para yo implementar un reinicio"): a
  Codex review that fails because the weekly use is spent is told to the orchestrator at once
  with the error's text, and is not recorded as `--unavailable`. The lead's idea in that line,
  for a later slice and not decided: a row that reads the Codex use left before a review is
  planned.
- 2026-10-11, T3b and T3c written, test first, by one writer sub-agent (Opus 5.5, high effort):
  `bin/lib/failures.mjs` (336 lines, 56 tests), `bin/failures.mjs` (195 lines, 23 tests), one
  import and one call in `bin/check.mjs`, one import, one usage line and one entry in
  `bin/js-harness.mjs`. Read whole by this session; one change made after it: a literal
  byte-order mark inside a regular expression replaced by its escape. Choices the writer made
  where the design was silent, all kept: an owed phrase must sit in a checkbox item that is not
  checked; a word of an id starts with a letter; a refused register makes every form of the
  command exit 1; `control lost` wins over `seen again`. The row is a list, empty when the
  project has no `docs/FAILURES.md`, so the fixtures of `bin/check.test.mjs` keep their rows.
  Together they are 1,426 changed lines, over the 1,200 a reviewed commit may hold, so they are
  two commits. T3b is `9a2edb1`: its gate waited 21 min 7 s for the lock and passed (`PASS
  tests`), and printed `review due (slice_budget_reached)`, 871 lines. T3c was set aside in a
  stash for that gate (`git stash list`: "T3c: the command, the row and the wiring") and is
  committed next.
- 2026-10-11, the inventory for T3d, by a read-only sub-agent: 58 failures and 147 sightings
  from the relief file (all of it read) and the feature documents, where the hand-kept lists
  counted about 25. A second sub-agent turned it into a draft of `docs/FAILURES.md` that the
  command reads with no fault: 58 failures, 148 sightings, 37 seen more than once, 16 not
  settled (14 `repeated`, 1 `owed, stale`, 1 `seen again`). The draft and the inventory are in
  this session's scratchpad, not in the repository yet:
  `C:\Users\Oficina\AppData\Local\Temp\claude\D--js-harness\9265156a-3a86-4da5-80f9-aebe66cd887c\scratchpad\`,
  files `FAILURES.md` and `inventory.md`; `capabilities.md` there is the survey for T1 (16
  commands, 12 rows of `check`, 8 of `doctor`, 24 paths written outside the repository, 21
  candidate capabilities), and `one-home-design.md` the first draft of T16. Decisions of this
  session for the seed: a row that names what loads the machine and stops nothing is not a
  control (three entries are `repeated` for it); an incident no record dates takes the day of
  the record that tells it, said in its note; `codex-cap-too-small` stays, as what was asked of
  him four times. Twelve doubts the sub-agent left for a person are in its report and go into
  the pull request of T3d.
- 2026-10-11, his orders of the afternoon, each read in the orchestrator's transcript before it
  was taken: the context pause is 88 (line 1745; it had been 85, then 90 for an hour); old rules
  beside new are forbidden and a mechanism must update a rule everywhere (line 1745): T16; a
  whole sweep, with the corrections made (line 1822): T17. The sweep ran as five read-only
  sub-agents on one brief; its list is pull request 61. A writer sub-agent is correcting this
  session's 93 places in documents on that branch (worktree `D:\js-harness-worktrees\sweep`).
  The orchestrator was not running when the list was announced (14:50): three notices were
  recorded with `js-harness notify`. One thing reported for him there: the sub-agent that read
  what is installed says two secret values were printed in its own tool output; they are in no
  file this session wrote.
- 2026-10-11, a slip of this session: `js-harness sessions` was run once while another
  session's gate ran, against the rule that the board is not read beside a gate. It goes into
  the register as a sighting of `board-read-loads-gate`.
- 2026-10-11, the gentle-ai review of `51a24db..5b754dd` (the design, T3b and this document):
  lineage `review-ea88b679a75a95f8`, one lens, approved and acknowledged, so the reviewed
  boundary is `5b754dd`. The first assessment was asked with `--base-ref origin/main` after
  `main` had moved and counted 2,552 lines that were not this branch's; the base of a review is
  the branch point, then the last reviewed commit. It goes into the register as a sighting of
  `assessment-counts-main`. The review's three notes, none blocking, all taken in the commit of
  T3c: the design said "any unchecked list item" where the code reads checkbox items only (the
  design is corrected and a test pins a plain bullet); a list item of an entry's text that
  opens with a capitalised word and a colon is read as a field and refused (a test pins it);
  three branches of the parser had no test (a fence after the first field, a class shown inside
  a fence, an empty `Class` field).
- 2026-10-11, T17b closed: the writer's 83 corrections were read hunk by hunk by a reader that
  did not write them, which found eleven things to fix (three dated records removed with their
  notes, his words of 2026-10-10 among them; three sentences that overstated their source; five
  minor), all applied before the commit. Pull requests 61 and 62 are merged; `main` is
  `b016699`. The roadmap's sections are now titled "Rule hierarchy" and "Session channel", so
  this document's citation of the old title is one of the places of T17c.
- 2026-10-11, the protocol for changing a rule, version 3, approved by Sebastián ("Sí, aprobado
  el protocolo revisado", the orchestrator's transcript `130317af-a818-419c-a3de-3a21335db0a8`,
  line 470, read by this session; the text is the relief file's line 253 and the approval its
  line 254). It is written into this document as T16 and as the replacement of protocol 4 when
  T16 is taken, and where it differs from the eight firm points here the difference is told to
  the orchestrator, not chosen in silence. In the same line he asked for a second rule, a
  candidate for T16 and not designed yet: what is put to him to decide passes a review by a
  reader that did not write it, and comes back improved ("Siempre me gustaria hacewr asi una
  doble revision con mejora quiero añadirlo al harness").
- 2026-10-11, a fact of the gate's design, from the session that builds it (`feat/gate-turn`,
  `odd/tasks/gate-turn.md`), to be read on that branch before T16 rests on it: the gate's early
  stop names no row and stops on any static row that fails before the lock is taken, so the
  rows `failures` and `rules` stop a gate by being static; `bin/check.test.mjs` pins the order
  of the rows, and whichever of the two branches lands second changes that test.
- 2026-10-11, the commit of T3c did not land at its first try: launched at 14:55, it waited 60
  min 1 s for the machine's gate lock and gave up without running a sensor. Four sessions asked
  for the lock in that hour and it has no queue, so a waiter can lose every turn. It is launched
  again after this entry, with the tests of the review's notes added, and goes into the
  register as a sighting.
- 2026-10-11, T3d and T17d: `docs/FAILURES.md` is in the repository. `js-harness failures
  check` reads it with no fault: 59 failures, 154 sightings with the one of the next entry
  (153 before it), 39 seen more than once, 17 not
  settled (15 `repeated`, 1 `owed, stale`, 1 `seen again`), so `failures check --settled` exits
  1, as it must until each of the 17 has a control in place or owed; that is work of this
  feature and of the features that own those controls, not of this slice. Added to the draft
  by this session: its two slips of the day as sightings (`board-read-loads-gate`,
  `assessment-counts-main`), the gate wait that gave up (`lock-not-a-queue`, now seen twice
  and so `repeated`; its control is the feature `gate-turn`, whose document is not on this
  branch), and the entry `old-rule-beside-new`. Not checked by this session: that each `since`
  date of a control in place is the day it reached `main`; they are the seed writer's reading
  of the records. The gate's lead asked this session at 16:03 to yield one turn of the lock to
  the session channel's slice, which had waited 40 minutes: the waiting commit of T3c was
  stopped and is launched again, behind that turn, with a wait of 180 minutes.
- 2026-10-11, a mistake of this session while yielding that turn. What happened: the script
  written to launch the commit after the other session's turn tested the lock's files with
  `rg`, which exists in this session's shell and not in a script run by `sh`; the test failed
  as "command not found", the script read that as "that session neither holds nor waits", and
  launched the commit at 16:04:26. It took the lock for about 50 seconds before this session
  saw it in the holder file and stopped it (16:05:29); no sensor finished and nothing was
  committed. The fix now: the wait is a Node script that reads the holder files, and it
  launches only when it has read the other session as holder, or as gone on three reads in a
  row. What stops it recurring: nothing mechanical yet; the same failure was recorded on
  2026-10-10 (`broken-wait-script`, "rg: command not found" 61 times), and its control is a
  test of the gate's own wait, which a private script does not use. Where it enters the
  harness: the lock as a line by arrival that the feature `gate-turn` builds, after which no
  session writes a script to order turns. The proof that it has not come back: the count of
  sightings of `broken-wait-script` in `js-harness failures`, which this one raises to four.
- 2026-10-11, T16a. The approved protocol is in "One home for every rule (T16)". A reader that
  did not write it (a read-only sub-agent, Opus 5.5, high effort, 111,898 tokens) compared
  this session's text with the relief file's lines 253 and 254 and found twelve things, all
  taken: the header said the letters replace the eight points where the approved text is the
  eight points plus answers, so three points no letter restates were being lost; a sentence of
  this session stood unmarked as approved in two places; the orchestrator's four additions were
  half imported with no origin; two differences were missed (C against G for a line of
  `AGENTS.md`; the list of an installed project); one difference hid that the tension is
  inside the approved text (D and E); and four facts were wrong (a time of day, a line that
  names a session and not a feature, whose slice, a dropped clause). Both quotations of his
  matched character by character. The nine differences went to the orchestrator by message at
  16:10; this session goes on with its readings, and the third and the seventh are not its to
  settle. The orchestrator answered within minutes, with its readings of what he approved and
  not his words: the six readings of this session stand; the third and the seventh are
  written beside each difference; the ninth is his and waits in the queue of his decisions.
  Not done: a second round of reading after the fixes.
- 2026-10-11, T3c is `547ef55`. Its gate was launched at 16:08 with a wait of 180 minutes,
  took the lock after two other gates and ended at 16:24: `PASS  tests  npm run test passed`,
  and `PASS  failures  59 failures, 154 sightings, 39 seen more than once, 17 not settled`,
  the first gate of this repository to print the row. It printed `review due
  (slice_budget_reached)`, 846 lines in 6 paths since `5b754dd`, and that no Codex review
  covers the code since `9a2edb1^`. `main` moved to `859b9a1` meanwhile (pull request 63); the
  orchestrator says this branch merges clean with it, not checked by this session yet.
- 2026-10-11, the second gentle-ai review, of `5b754dd..6c687ab` (1,684 changed lines, 584 of
  them code): lineage `review-0a7d86aca5064eee`, one lens, approved and acknowledged; the
  reviewer ran inside a turn of the gate lock (15.8 minutes with its wait). The reviewed
  boundary is `6c687ab`. Its three notes, none blocking, are commit `c941a55`: a test of the
  gate's `main` for the row (where it sits, the entries it prints, a register refused), a test
  of a form that prints through the dispatcher, and `ENOTDIR` read as no register, seen
  failing first with a reader that throws it. Its gate: launched 16:46, the lock after two
  gates, ended 17:16, `PASS  tests  npm run test passed`, and `review not due (under_budget)`
  for its 63 lines, which stay in the slice for the next review. The two tests that pin what
  the code already did were never seen failing; that is said, not hidden.
- 2026-10-11, the Codex review of the slice's code, `340e960..c941a55`. Its plan: 4 parts,
  1,513 changed lines in 7 files, about 1,350,000 input tokens, 892 a changed line, under the
  1,200 that needs no question; Codex's meter before it: 17 percent of the five-hour window,
  3 percent of the week. It is run before `main` is merged in, so that its range holds this
  branch's commits alone. `main` is `906fc28` (pull requests 63 and 64, which changed
  `bin/check.mjs` and `bin/check.test.mjs`); `git merge-tree` gives a tree with no conflict,
  and a merge that is clean as text is not a proof: the suite is run on the merge result,
  through the gate, before the push. Its first try started nothing: this session wrote this
  entry in the worktree while the review waited for the lock, and after 13 minutes of wait the
  command refused a range whose tracked files had uncommitted changes, which is right of it.
  Nothing was spent. It is launched again after this entry is committed, and the worktree is
  not touched while it runs.
- 2026-10-11, the Codex review of `340e960..8ee13e9`, in a turn of the gate lock (17:30 to
  17:48): 4 parts, 792,965 input tokens (592,768 cached) and 7,762 output in 265 s, which is
  524 input tokens a changed line against a plan of 892; recorded. Two parts were found
  correct and two incorrect, with five findings of the second priority, each seen wrong
  through a script that calls the functions before its fix and right after it: a link or a
  junction inside the project let a control's phrase be found in a file of another project
  (the path is now judged as the disk resolves it too); a class declared twice was counted
  twice (refused now); a task kept in a comment, a checkbox shown in a fence indented under a
  task, and a plain bullet under an unchecked task each made a control read as owed (none
  does now). The route was inline, against the rule that two files that are not mechanical go
  to a writer: this session had read both files whole in the hour before, a writer would have
  read them again, and the plan's five-hour window stood at 84 percent with him away. The
  tests were not run by the runner before the commit, because a gate ran the whole time; the
  commit's gate runs them. The real register reads the same after the fixes: 59 failures, 17
  not settled.
- 2026-10-11, the fixes are `d8cdf05` (gate 17:50 to 18:04, `PASS  tests`; `review not due
  (under_budget)`, 219 lines since `6c687ab`). Codex reviewed that commit alone (18:05 to
  18:19): 188,160 input tokens for 114 changed lines, 1,650 a line where its plan said 1,140,
  so over the 1,200 for that run and told to the orchestrator; the slice as a whole stands at
  603 a line. It found the fix of the nested fence wrong in two ways, both seen wrong through
  a script first: a fence under a task that holds a `<!--` swallowed every task after it, and
  three backticks that open a code span in a wrapped line were taken for a fence. The cause
  was one: this session had put a second, smaller reading of fences on top of the tokenizer's.
  It is removed. `tokenize` of `bin/lib/progress.mjs` takes `indentedFences`, off by default
  so that `js-harness progress` counts as before, and with it the tokenizer itself tells a
  fence from a code span and keeps a `<!--` inside a fence from opening a comment. Found on
  the way and not changed here: `js-harness progress` counts a checkbox shown in a fence
  indented under a list item as a step, for the same reason.
- 2026-10-11, that fix is `5c246bd` (gate 18:22 to 18:49, `PASS  tests`). Codex reviewed it
  alone (18:50 to 19:04): 236,419 input tokens for 72 changed lines, 3,284 a line where its
  plan said 1,140. A review of a small commit costs what Codex reads around it, not what the
  commit changes, so the plan is far under for small commits; the three runs of the slice are
  1,217,544 input tokens for 1,699 lines, 717 a line. It found one more: with the new option a
  marker indented past three spaces closed a fence opened at the margin, so an example inside
  such a fence became a task and the real task after it was lost. A fence now closes by the
  rule it opened with. Known and not built: an indented code block outside a list that holds
  a fence marker is read as a fence when the option is on. Decided by this session, to end a
  round that could go on: this is the last correcting commit of the slice; the push rule
  wants a Codex record for it, and whatever that run finds is written in the pull request as
  work to follow, not corrected in a fifth round.
- 2026-10-11, the last correcting commit is `21686a5`, with its Codex review in the same turn
  of the gate lock (19:07 to 19:41: `PASS  tests`, then the review): 168,132 input tokens for
  22 changed lines. The slice's four runs are 1,385,676 input tokens for 1,721 lines, 805 a
  line. It found one thing, of the second priority: under a list item, a fence opened within
  three spaces of the margin and closed deeper (two spaces, then four) is not closed, because
  CommonMark measures a fence from its list item and the tokenizer measures it from the
  margin; the tasks after it are then read as fenced. It is not corrected: the tokenizer on
  `main` reads that case the same way today, for `js-harness progress` too, and the real
  register reads as before (59 failures, 17 not settled). The orchestrator's condition for the
  round's end (its message of that evening) is met by it: second priority, and nothing that
  `progress` or the row says today changes. It is task T3e.
- 2026-10-11, `main` (`5af56c1`) is merged in: `9e7c226`, no conflict. The whole gate on the
  result, through the lock, timed out the first time (19:58, 1,206 s, 3,195 tests passed and
  none failed; the load before the sensors was 0.8 of 8, and the gate after it logged
  `node codegraph.js` among the busiest, so the likely cause is this session's own merge being
  indexed while its tests ran: not proven). It left `Microsoft/` untracked in the worktree,
  removed by hand. Run again (20:20 to 20:51): `PASS  tests  npm run test passed`, and `6 code
  commits since origin/main, all covered by a Codex review record`. Both are sightings in the
  register.
- 2026-10-11, what the merge did to the register, as the design said it would: with nothing
  of this branch changed it read 22 not settled where it had read 17. Five tasks of
  `odd/tasks/session-channel.md` that owed a control were checked off on `main`, and their
  entries still said owed (`owed, stale`). The row passed. Four of them, and
  `gate-ran-unseen`, which was stale before, now name the test that is their control, each
  found by `git log -S` to have reached `main` on 2026-10-11; `wake-with-no-news` is left
  stale on purpose, because the task that owed it (the watch wakes on a notice) is done and
  nobody has shown that it stops a wake with no news. It reads 17 again.
- 2026-10-11, two working rules he asked to apply ("me gusta mucho que apliquemos lo de los
  ahorros": the orchestrator's transcript `130317af-a818-419c-a3de-3a21335db0a8.jsonl`, line
  1798, read by this session; the measure they come from is the relief file's line 281, not
  checked by this session): a writer sub-agent never waits for the gate, it returns its work
  and the main thread commits through the lock, because a sub-agent's cache lasts five
  minutes and a main thread's one hour; and a writer is given a narrow piece that ends in tens
  of turns. Both are candidates for the delegation rules of this feature (protocol 6), not
  designed, and applied by this session from now on.
- 2026-10-11, 21:00, the register is pull request 66 (`feat/failures-register`, tip of its
  code and register `9a1c99d`), read by the host as mergeable and clean; the orchestrator was
  told. This session's context stood at 89 percent then, past the pause: the state is this
  document and the engram topic `odd/rule-hierarchy/state`, and the scratchpad of session
  `9265156a-3a86-4da5-80f9-aebe66cd887c` keeps the scripts that commit and review through the
  gate lock (`gate-commit.sh`, `gate-run.sh`, `commit-then-codex.sh`, `review/capture.mjs`,
  `lock.mjs`, `own-tsservers.ps1`). Spent on the slice: two reader and writer sub-agents before
  the afternoon, one reader of the protocol (111,898 tokens), four Codex runs (1,385,676 input
  tokens).
- 2026-10-11, T17c, on `fix/sweep-code-places`, cut from `main` at `40ccb45` after pull request
  66 was merged (route: delegated for the code, one writer with a narrow piece that returned
  its work unstaged, 133,677 tokens; inline for this document, one file whose places the list
  names). Six of the seven code places are corrected. The message a review that did not stand
  ends with (`WAYS_ON` of `bin/codex-review.mjs`) now sends to a rerun in a turn of the gate
  lock and keeps the skip for a machine where Codex cannot run; two expectations of
  `bin/codex-review.test.mjs` pin it word for word and were changed with it, so the test was
  not seen failing first: the old sentence was the expectation. `bin/install.mjs:213` is not
  corrected: it is a choice (tag the releases, or print another command), passed to the
  orchestrator. The sentence of the `js-harness` skill in `bin/lib/manifest.mjs` changed, so an
  installed copy differs from the source until `js-harness sync --global` runs: the lead's, at
  a boundary. Of this document's thirteen places, four were already right on `main` after
  the merge (the header, the nudge of C1, and two that name the Next step) and nine are
  corrected here, with the citation of the roadmap's old title. One another way than the list
  asks: the table "Failures of 2026-10-10" is kept as the list of
  that day, with the sentence that called every entry open replaced by a pointer to the
  register, because this document cites the table's numbers in five places. The register gains
  one sighting under `chained-step-not-conditional`, the orchestrator's own report.
- 2026-10-11, T17c closed. Commit `1374a2b`: the gate passed on its first run (22:07, after an
  hour waiting for its turn). gentle-ai on `40ccb45..1374a2b`: risk medium, 146 changed lines,
  review not due (under budget), so it is assessed with the next slice. Codex on
  `40ccb45..f45176a`: "the patch is correct", no finding, 70,550 input tokens for 36 changed
  lines of code. That is over 1,200 a line, and it waited for his answer: on that day he
  confirmed a floor, up to 300,000 input tokens a review however small the commit, or 1,200 a
  changed line, whichever is more (the orchestrator's transcript
  `130317af-a818-419c-a3de-3a21335db0a8.jsonl`, his answer at line 2963, read by this session,
  to the question at line 2958, not read). `f45176a` adds three sightings the orchestrator
  reported. The parent task stays open: four places of T17b are left with their reason and
  the six of `odd/tasks/codex-parity.md` wait for that document's branch.
- 2026-10-11 and 12, T16b, design and first slice, on `feat/rules-list` (pull request 67, T17c,
  is merged; `main` is `d94a765`, merged into this branch).
  - The design is "How a rule is declared (T16b)" above: written after a read-only explorer
    mapped where each value lives (145,816 tokens), then read by two readers that did not
    write it (137,131 and 144,123 tokens), and what each changed is its last paragraph. Two
    of this session's readings changed with it (differences 2 and 8) and the orchestrator
    agreed they stay inside letter B.
  - The slice (route: delegated, one writer at a time, each a narrow piece from an exact
    specification, tests first; the specifications are this session's): the library
    (`8ada9cc`), the check and the command (`8668dfc`), after the documents commit `859a797`.
    Both gates passed on their first run. Run alone, each new test file passed before its
    gate: no whole run was made beside a gate.
  - It was the first slice of a trial his words opened (the orchestrator's transcript
    `130317af-a818-419c-a3de-3a21335db0a8.jsonl`, lines 2037 and 2891, both read): effort by
    kind of work, alternated by slice. This one ran with the session at medium (read with the
    app's tool; the first two specifications were written at high, before the change applied)
    and its writers on Haiku 5.5 (`claude-haiku-5-5`, read in the first one's transcript):
    four writers, 620,003 tokens, none wrong twice, three corrections by this session after
    them (a literal 12 that is itself a declared rule; a unit not refused on a rule with no
    value; a throw on a malformed source, which the third writer found in code that was not
    its own). One slip of this session: two small test files run while a writer could have
    been running its own.
  - gentle-ai reviewed each code commit by itself, the first from a detached worktree,
    because its assessment is always base to HEAD: both approved and acknowledged, twelve
    notes, six of them warnings, none blocking, no requirement missed. It accepted the commit
    of 1,275 lines: the size of a commit it will review was known at 1,185 (taken) and 2,250
    (refused), and this is the third point. Eleven notes are corrected in `79f9bbf`, written
    by a fifth Haiku writer (209,074 tokens) with the session at high and read by it; its
    gate passed on its first run. gentle-ai on that commit: medium, 319 lines, not due.
  - The seed is fourteen rules. A value entered only with a source of one of the two kinds:
    his words by transcript line, each read by this session with `sessions --quote`, or a
    design. Four are his by one answer of 2026-10-11 (line 2963, to the question at line
    2958, both read): the Codex rate by changed line, its floor a review, the size of a
    reviewed commit, the number of work sessions. Before that answer three of them were left
    out, because each number had been the orchestrator's, approved inside a whole list.
  - Decided with it, by his "Sí, que entre al plan" (line 2891): the rows of model and effort
    by kind of work become rules of this list, each with the engine version and the model id
    it was checked on, a mark of shipped or local, and a mark of stale when the engine or a
    model changes. Not designed yet. The proposal it comes from is the orchestrator's
    (`modelo-esfuerzo-propuesta.md` in its scratchpad, read whole by this session, not yet
    copied into the repository).
  - Owed in documents, not done here: that copy; `docs/ROADMAP.md:62`, `:353-360` and
    `:539-541`, which say something else about models and effort; and
    `odd/tasks/codex-review-lean.md:46`, which dates the review's effort 2026-10-06 when the
    high in force is his word of 2026-10-08.
  - This session's context stood at 86 percent when this was written, past which it tells
    the orchestrator; its resume point is this entry, the Next step below and the engram
    topic `odd/rule-hierarchy/state-addendum`.
- 2026-10-12, T16b: Codex's review of the first part, its correction, the documents owed and
  the design of the third part.
  - Codex. The first run ended on part 1 of 7 with "Selected model is at capacity" (49,568
    input tokens, nothing recorded; `codex-model-at-capacity` in the register). Run again in a
    turn of the gate lock, on the same model, never recorded as a skip: it waited about 17 minutes
    behind other sessions' gates and reviewed `859a797..6a721cc` in 7 parts, recorded, with
    1,909,398 input tokens (1,523,200 cached) for 2,500 changed lines: 764 a line, 784 with
    the failed part, where its plan had said about 2,130,000. Six findings, five of second
    priority and one of third, each real:
    - the check imported the phrase matcher from `bin/lib/failures.mjs`, which reads a rule
      when it loads, so `node bin/rules.mjs check` could not start on a list without that rule;
    - a source's dates were held to a shape and not to the calendar, and the day of its check
      to nothing;
    - a phrase that ends with its sentence's last character ran on into the next sentence;
    - a retired rule lost the unit of its earlier values;
    - a number as small as 1e-21 was shown as 0;
    - a `## Progress` line inside a fenced example cut a feature document there, and the marks
      of rules after it were never read.
    All six are corrected, each with its test seen failing first, by a sixth Haiku writer
    (175,017 tokens) from this session's specification, with the session at high and its diff
    read by it.
  - The first of the six is a requirement of the design that was missed ("it imports no module
    that reads a rule"). The specification that asked for that import was this session's,
    written at medium; gentle-ai did not see it either. By C2 of `docs/model-effort.md` one
    missed requirement ends the trial for the session: the orchestrator answered that medium
    is off for every session and the Haiku writer stays (its message of 2026-10-12, a peer's).
    The trial's figures for this slice, at medium: three gates green on the first run of
    three; one correction round after gentle-ai and one after Codex; no finding above second
    priority; writers 620,003 tokens for 2,260 lines of code and tests, 829,077 with the first
    correction writer.
  - The two model values change form in the same commit, from the names he says to the ids a
    record holds, before the list reaches `main` ("Model and effort as rules", decision 2).
  - `main` at `1d5cf68` (pull request 68) is merged into the branch, clean. The documents owed
    are commit `b0ccff1`: the proposal copied as `docs/model-effort.md`, four places of the
    roadmap, the register's new entry. `odd/tasks/codex-review-lean.md:46` needed nothing: the
    sweep had already dated the review's effort to 2026-10-08.
  - The third part is designed above, after an explorer (123,692 tokens) and three readers in
    two rounds (176,101, 168,848 and 155,382 tokens), written in a separate worktree while
    Codex waited for the lock. The first round found three faults that would have stopped it;
    the second, on the two decisions rewritten, two more. Its owners are settled by the
    orchestrator and recorded in the section.
  - The correction is commit `331090b`; its gate passed on its first run. gentle-ai reviewed it
    alone (base `b0ccff1`, medium, 594 lines, one lens): approved and acknowledged, lineage
    `review-438746f99975c9a8`, three notes and none blocking, each left for the next commit
    that touches its file: the test that holds the check's imports reads only imports written
    on one line; a retired rule whose earlier values mix a number and a text keeps a unit that
    the text would be shown with; a fence left open above a `## Progress` line hides the marks
    after it and nothing says so.
  - Codex on the correction was held: its plan for `b0ccff1..331090b` is one part, 270 changed
    lines, about 330,000 input tokens, and the allowance is 324,000. Asked of him by the
    orchestrator, and allowed: "La opción A" (the orchestrator's transcript
    `65318fd5-80e7-4bb8-92b5-06737140185b.jsonl`, line 2329, read by this session with
    `sessions --quote`; the question it answers is the assistant entry at line 2318, "Opción
    A: se hace la revisión, aunque pase el tope por 6.000"). It covers this one review at
    about its plan: no new rate, and no second run after a fall without asking him again (the
    orchestrator's reading). It ran from a worktree at `331090b`, so that the merges below did
    not widen its range: one part, 247,253 input tokens (172,032 cached), under the allowance
    after all, "the patch is correct", no finding, recorded.
  - The lead's inventory of 2026-10-12 (each adopted rule against `main` and the feature
    documents) gave this document five things, all taken and none built here: two rules with
    no task, placed in protocol 1; two needs of the merge command, in T16e; the paid
    measurement of documentation, in T1; a row of the survey his later rule on blocks
    overtook; and the count of his items, which the check of T2 no longer names.
  - `main` moved three times while this closed, each merged clean: `78bbc80` (pull request 70,
    the session channel's fourth slice), on which the whole check passed in a turn of the
    lock; `5f011cc` (pull request 71, the lock as a line by order of arrival); and `7411fe6`
    (pull request 69, a script that counts git launches), merged while the second check still
    waited for its turn, so that the check is run once on the tree that is pushed.
    It moved two controls of the register, corrected with this entry: the flag of the board's
    pause was renamed, and the item that owed the removal of the 73 percent mark is done, so
    that failure has its control in place. One sighting is added from the orchestrator's
    notice of the day. The pause is now one constant on `main`
    (`bin/lib/sessions.mjs`); by "How a rule is declared" it is declared in the list and that
    file reads it, in the second part, told before the file is touched.
  - The first push was refused, by the control that exists for it: the branch's first commit,
    `859a797`, holds `docs/rule-sources.json`, which a review counts as code, and no record
    covered it. This session's slip: it gave Codex `--base 859a797`, and a base is left out of
    its range. The line `check` prints at every commit had said for hours that one code commit
    had no record, without naming it, and this session took it for the correction still to be
    reviewed. The fix is a review of that commit by itself (123 changed lines, about 150,000
    input tokens by its plan, inside the allowance): it found nothing, at 137,431 input tokens,
    and is recorded as `40ccb45..859a797`. Then the push. What would have told it
    sooner: the line at a commit naming the commit, as the push row does; told to the
    orchestrator for the owner of that row.
- 2026-10-12, T16b, the second part started. The first part is on `main` (pull request 72,
  merged by the lead at `47484bd`). Branch `feat/rules-rewire`, worktree
  `D:/js-harness-worktrees/rules-rewire`, cut from that commit. Route: delegated, one narrow
  writer a piece on Haiku 5.5 from this session's specification, the session at high.
  - Piece 1, the five constants of the Codex review (`review-part-lines`,
    `review-part-files`, `review-parts-unflagged`, `review-model`, `review-effort`) read their
    declarations: `bin/lib/codex-review-parts.mjs`, `bin/lib/codex-review-plan.mjs`,
    `bin/codex-review.mjs`, their tests and `bin/lib/rules-bindings.test.mjs`, told to the
    orchestrator before they were touched. The specification is `t16b-rewire-1.md` in this
    session's scratchpad (session `9265156a-3a86-4da5-80f9-aebe66cd887c`). When the writer
    returns: read its diff, commit through the gate, gentle-ai's assessment from `47484bd`,
    and Codex with `--base 47484bd` (the base is left out of the range, and that commit is
    `main`'s).
  - Waiting for their branches to reach `main`: `bin/lib/gate-lock.mjs` (the wait for the
    lock) and `bin/lib/sessions.mjs` (the context pause).
  - Piece 1 is held before anything was written (the writer was stopped with the tree
    clean): the lead found `bin/codex-review.mjs` and its test changed and uncommitted on
    `feat/gate-wait`, and asks that session whether the other two modules are free. Taken
    while that branch is open: `bin/codex-review.mjs`, `bin/lib/codex-review-runs.mjs`,
    `bin/lib/codex-reviews.mjs`, `bin/check.mjs`, `bin/gate.mjs`, `bin/lib/gate-lock.mjs`,
    `bin/lib/gate-log.mjs`; and on `feat/session-compaction`: `bin/lib/sessions.mjs`,
    `bin/lib/pause.mjs`, `bin/sessions.mjs`, `bin/resume.mjs`, `bin/install.mjs`,
    `bin/lib/manifest.mjs`.
  - Taken instead, on the same branch, in files that are this session's alone: piece A of
    the third part (`alias`, `scope`, `ruleHere`, `ruleOf`, the three readers found by the
    scan, and the three notes gentle-ai left on the correction), in `bin/lib/rules.mjs`,
    `bin/lib/rules-check.mjs` and their tests. Its specification is `t16b-third-a.md` in the
    same scratchpad. After the writer: read its diff; then this session declares the aliases,
    the scopes and the two session rows in `bin/lib/rules-data.mjs` with their sources (his
    line 990 read again), renders the list, and commits through the gate; then both reviews,
    Codex with `--base 47484bd`.
  - Piece A is written and not committed. Read so far: the diff of `bin/lib/rules.mjs`, taken
    as it is (the two constants the editor marked are read by the faults). Also read and taken:
    `bin/lib/rules-check.mjs`. The two test files are not read line by line. NEXT: this
    session declares the aliases, the scopes and the two session rows, then the gate. The
    writer's changes stand uncommitted
    in the worktree, in the four files (207,285 tokens; by its report, each alone:
    `bin/lib/rules.test.mjs` 102 pass, `bin/lib/rules-check.test.mjs` 55, `bin/rules.test.mjs`
    17, and `rules check` passes with the hash unmoved). Its calls where the specification was
    silent, each to be judged when the diff is read: `ruleOf` of a rule in prose is no
    finding; `ruleValue` on a rule in prose of scope `repository` gets both findings; the
    three new lines of the list go right after the value line; mixed and unordered earlier
    values give both faults; a `projectData` that is no text and not null is "behind"; the
    reader of imports in the test would take a comment that holds the word import and a quote
    for an import. The editor also marks `ALIAS_PATTERN` and `REPOSITORY_SCOPE` in
    `bin/lib/rules.mjs` as never read: look at whether the faults use literals instead.
    After that the lead's relay of the same hour frees more files for the rewiring:
    `bin/lib/codex-review-parts.mjs`, `bin/lib/codex-review-plan.mjs`, `bin/lib/gate-lock.mjs`
    and `bin/lib/gate-log.mjs` with their tests; `bin/codex-review.mjs` stays another
    session's, so `review-model` and `review-effort` wait for `feat/gate-wait` on `main`.
  - This session's context stood at 90 percent, with him away: the cut was given once in its
    reply, and it goes on.
  - The app compacted this session at about 05:00 on 2026-10-12; it resumed from this entry at
    22 percent and sent the lead its line. Then the declarations, in one commit with the
    writer's code: `alias` on the two sub-agent models (`opus`, `haiku`); `scope: "repository"`
    on the seven rows the design names; the new rows `session-model` (`claude-opus-5-5`) and
    `session-effort` (`high`), both of the repository, since 2026-10-10, from his line 990 of
    `182ad401-…` read again with `sessions --quote`. The sources say that the id and the
    aliases are this session's readings, and that the trial of medium is no rule. The list has
    16 rules, hash `950f2423e296`; `rules check` passes. The head line of `docs/RULES.md` about
    `rules applied` waits for the command (piece B). NEXT: the gate's answer on that commit,
    then gentle-ai from `47484bd` and Codex with `--base 47484bd`, plan first.
  - Piece A is commit `528bf56` (the gate passed at 05:39). gentle-ai approved it and the
    approval is acknowledged (`review-2f492055c33125b4`, medium, one lens, run from a detached
    worktree `rules-rewire-review` at that commit, because the working one held untracked
    files). Its three notes are all taken and corrected by a writer, in the last commit of
    piece B: a `ruleOf` read of a retired rule passed the check and would throw when run; a
    `projectData` that is no text was answered "behind" instead of refused; the test's reader
    of imports took only single quotes.
    **Codex on piece A is held for him**: the plan of `47484bd..528bf56` is 2 parts, 466
    changed lines, about 570,000 input tokens, and the allowance is 1,200 x 466 = 559,200. Not
    run, not split; the lead has the figure (its estimator's median is about 1,224 a line
    today, so every range over about 250 lines plans over the rate).
  - The rewiring of what is free is commit `21b391f` (the gate passed at 06:09): the bound of
    lines and of files of a part, the count of parts without a flag and the wait of the gate
    lock each read their rule; the three tests that stated the numbers hold each constant to
    its rule; `bin/lib/rules-bindings.test.mjs` keeps only the review's model and effort,
    which wait for `feat/gate-wait` on `main`. Route: inline, one line a file.
  - Piece B, the command `js-harness rules applied`, is written by four narrow writers on
    Haiku 5.5 (134,004 + 121,836 + 204,700 + 195,167 tokens) from four specifications in the
    scratchpad (`t16b-third-b1.md` to `-b4.md`), the first three in a folder apart while the
    gate ran on this worktree. `bin/lib/rules-applied.mjs`: `appliedOf`, pure, and
    `appliedLines`, what is printed. `bin/lib/rules-applied-read.mjs`: `readRecords`, the
    bounded reader. `bin/rules.mjs`: the form `applied`. The head of `docs/RULES.md` says where
    the engine and the date are read. This session read the three modules whole and the diff of
    the command; the test files are not read line by line. One call of this session against
    its own specification: a window with no launch of a declared alias prints `Nothing
    compared`, never `PASS` (a writer saw that the specified line read as a pass). It goes in
    two commits, each under about 1,200 lines: the pure module, then the reader, the command
    and the notes of the review. The pure module is commit `34c2dfc` (the gate passed at 06:40).
    The command, run once on the real records inside a turn of the gate (06:57, exit 0):
    163 launches and 27 sessions of 2026-10-06 to 12 read from 210 and 43 files, 60 older than
    the window, 1 with no model that answered, 2 session files with no assistant entry in
    their last 1 MB; `opus` gave `claude-opus-5-5` on all 50 launches and `haiku` gave
    `claude-haiku-5-5` on all 26, both on claude-desktop 2.1.295; sdk-cli 2.1.296 has no
    launch of either yet; 87 launches passed no model (67 general-purpose and 12 Explore
    answered by Opus 5.5, 8 claude-code-guide by Haiku 5.5). NEXT: the last commit through the
    gate, then gentle-ai from `528bf56` on the three commits; Codex by its plan, and over the
    rate it waits for him.
  - The last commit is `c8ef7b5` (the gate passed at 07:12): the reader, the form `applied`,
    the head line of the list and the three notes. The branch is four code commits on
    `47484bd`, not pushed. gentle-ai goes slice by slice from the detached worktree:
    `528bf56..34c2dfc` (1,288 lines, medium, one lens, `review-bf548f33bb522cc9`) started at
    07:15; `34c2dfc..c8ef7b5` after it.
    **Codex is one review of the whole range, inside the rate.** `codex-review --base 47484bd
    --plan` on `c8ef7b5`: 7 parts, 2,616 changed lines in 18 files, about 2,530,000 input
    tokens, against an allowance of 1,200 x 2,616 = 3,139,200; it needs `--max-parts 7`. The
    range was not shaped to move the figure: it is the branch as it stands, the commits were
    cut by the size a commit is reviewed at before any plan was asked for, and piece A alone
    had planned over (570,000 against 559,200) only because the estimator's median stands a
    little above the rate today. The lead saw no reason against it (its message of 07:20, a
    peer's and not his words). It runs once gentle-ai has approved the slices. If it falls
    midway it is not rerun: the lead is told the tokens read and the part. If the first part
    answers at capacity at once, one more try after ten minutes, then stop.
  - gentle-ai approved `528bf56..34c2dfc` and the approval is acknowledged
    (`review-bf548f33bb522cc9`). Its four notes are all taken and corrected by a writer
    (123,564 tokens) in one commit on this branch, before Codex, so that Codex does not pay to
    find them again: `appliedOf` took a `today` that was no real day, or a `days` that was no
    number, and then skipped nothing as old, so old records could decide the exit (now both
    are refused); the day of an entry was the first ten characters of its time, which is
    another day than its instant when the text carries an offset (now the day of the instant
    in universal time); the order of versions was not an order when digits and letters mix
    (now digits first); and the tests of the four rewired bounds passed for any value (each
    now also proves a whole number above 0, and the wait of the gate lock has its test back).
    NEXT: that commit through the gate; gentle-ai on `34c2dfc..` its head; then Codex, whose
    plan is asked again on the new head.
  - That commit is `878e2e8` (the gate passed at 08:06). gentle-ai approved `34c2dfc..878e2e8`
    (1,061 lines, medium, one lens) and the approval is acknowledged; its five notes go into
    `feat/rules-held`, so that this branch does not move again for what a review calls later
    work: a time with no zone is read in the machine's own zone; no test runs the path where
    git names the project and the main checkout; an empty `CLAUDE_CONFIG_DIR` counts as set;
    no test proves that an error of the form `applied` is said and exits 1; the reader has no
    test of the cap of sessions and takes a `now` that is no number in silence.
  - **Codex reviewed the whole range once** (`codex-review --base 47484bd --max-parts 7`, in a
    turn of the gate, 08:51 to 09:41): `65578da..878e2e8`, 7 parts, 2,682 changed lines,
    **1,769,808 input tokens** (1,365,888 cached) against a plan of about 2,560,000 and an
    allowance of 3,218,400; 660 a changed line. Recorded. Six parts with no defect, one
    finding of the second priority, taken and corrected by this session, inline, test first:
    `fenceWalk` took a line that starts with a code span in three backticks for the opening
    of a fence, so `rules check` reported a fence that was not there and `rules render`
    refused a valid document. A line of backticks whose words hold another backtick opens
    nothing now, as in Markdown. The correction is commit `88cde75` (the gate passed at
    10:16). Codex reviewed it alone (`878e2e8..c6b04ab`, 21 changed lines, 129,139 input
    tokens against a plan of about 71,000 and the floor of 300,000): correct, no defect;
    recorded. gentle-ai's assessment of `878e2e8..c6b04ab`: medium, 51 lines, not due, under
    the budget of a slice; it stays pending and is reviewed with the next commits, on
    `feat/rules-held`. Codex on this branch in all: 1,898,947 input tokens for 2,703 changed
    lines of code, 703 a line. NEXT: push and the pull request; the lead merges it.
  - This session's own language server (`node tsserver.js`, pid 59656) spun one logical
    processor from 01:48 to 08:53 and slowed every gate of the machine (the lead's figures:
    842 s to about 945 s). The gate printed it at 07:50 and this session reported it as a
    process whose owner it did not know, when one look at its parents would have said it was
    its own: the lead said so at 08:51, the chain was checked in the process list
    (59656, 39296, 59764, 54748, the ancestor of this session's own shell) and the process
    stopped. It is the register's `language-server-load` again, with a sighting added; what would stop it is the
    gate's load line naming the session a spinning process belongs to, which is the lead's to
    place.
  - On `feat/rules-held`, stacked on that branch so that its reviews do not move: the block
    "What ran, against the rules with no short name", as its design section above says, which
    one reader on Opus 5.5 attacked before it was built (117,949 tokens; three things that
    would have misled, all taken). Two writers on Haiku 5.5 in files apart (115,309 and 193,629
    tokens): the reader gives a launch the effort its answer records and steps past synthetic
    answers; `appliedOf` returns `held`, `heldOther` and `forLead`, and `appliedLines` prints
    the block and the new last lines. The three reads in `bin/rules.mjs` and their tests are
    this session's, inline: one file of code. Commit `3f576ed` (the gate passed at 07:48);
    the correction of the first branch (`878e2e8`) is merged into it, with one conflict in
    `bin/lib/rules-applied.mjs` resolved by hand (both sides kept; its 78 tests pass). Route:
    delegated for the two modules, inline for the command. NEXT here: the merge through the
    gate, the command run once on the real records, then gentle-ai from `878e2e8` and Codex by
    its plan; its pull request opens on `feat/rules-rewire`'s, or on `main` once that merges.
  - Pull request 73 (`feat/rules-rewire`) is merged: `main` is `3088960` (the lead's notice of
    10:45, checked with git: `ddac8b7` is an ancestor of `origin/main`). `feat/rules-held`
    took it, with one conflict in this document, both sides kept.
    On this branch since: commit `80a3032` (the gate passed at 10:54) corrects the five notes
    of gentle-ai's last slice, by one writer on Haiku 5.5 (133,441 tokens): a time is taken
    only when it names its zone; `readRecords` refuses a `now` that is no number; an empty
    `CLAUDE_CONFIG_DIR` is read as unset; two paths of the form `applied` have their tests
    (git naming a project and a main checkout that is another folder; an error said on stderr
    with exit 1), and so has the cap of sessions. Left unproved, and said: a picked file that
    cannot be opened, which no test can make here without a file system passed in.
    The command with the new block, run once on the real records in a turn of the gate
    (09:44, exit 0): `session-model` 21 of 21 sessions on `claude-opus-5-5`; `session-effort`
    20 of 21 at high and one that ended at medium on 2026-10-11 (the trial); `subagent-effort`
    172 of 173 launches at high and one at low on 2026-10-07, the day the rule was said;
    `opus` 52 of 52 and `haiku` 42 of 42 on claude-desktop 2.1.295.
    This session's context stood at 86 percent when this was written.
    NEXT: this merge through the gate; gentle-ai from the detached worktree
    `rules-rewire-review` on `3088960..` this branch's head (it holds the correction `88cde75`
    that was left pending, already on `main`, so the slice is what this branch adds); Codex
    with `--base 3088960`, plan first, inside the rate without asking; then push and a pull
    request on `main`.
  - The merge is commit `8a73dde`. gentle-ai approved `3088960..8a73dde` (1,032 lines, medium,
    one lens, `review-2cec5a5174e2ea28`; its capture waited more than an hour for a turn of
    the gate) and the approval is acknowledged. Three notes, none blocking, NOT corrected yet:
    (1) a warning: no test shows what a held model rule gives for an entry with no text model
    (`keep` skips such an entry, so `none` cannot count one for a model: prove it with a test
    or drop the line `no model recorded`); (2) `ZONED_TIME` takes an offset with no colon
    (`+0200`), which is outside the format the language defines, so its reading depends on the
    engine: take only the colon form; (3) no test of the command writes a session record and
    sees its model and effort reach the block.
    Also to do, from his answer of 12:20 as the lead relays it (not read by this session): a
    Codex plan up to 5 percent over the rate counts as inside it; declare that margin in the
    rules list with its source, his line 3800 and the lead's question at 3736 of transcript
    `65318fd5-…`, read first with `sessions --quote`.
    This session stopped here at 88 percent of its context, for a compaction. NEXT, in this
    order: one writer for the three notes (one commit through the gate); the margin as a new
    rule in the same commit or the next; Codex with `--base 3088960`, plan first; push and a
    pull request on `main`.
  - After the compaction (2026-10-12, back at 13:10, context at 23 percent). The three notes
    are corrected by one writer on Haiku 5.5 (126,930 tokens, 117 s), in the commit after
    `b156d7e`: (1) a test shows a held model rule never counts `none`, since `keep` skips an
    entry with no text model before the comparison (it passed at once: it pins what was true,
    and the line `no model recorded` stays, unreachable for a model and reachable for an
    effort); (2) `ZONED_TIME` takes an offset only with its colon, test first (it failed on
    `skipped.noTime`, 0 for 1), and the older zone test that kept `+0200` as a good form now
    writes `+02:00`; (3) a test of the command writes one session record and sees
    `session-model` agree and `session-effort` name its other value, exit 0 (it passed at
    once). The three rule test files after it: 81, 33 and 161 tests, none failing.
    The margin is declared: `codex-review-margin`, 5 percent of the allowance, his, of this
    repository only, since 2026-10-12. Its source is his line 3800 of transcript `65318fd5-…`
    ("listo la A …", read with `sessions --quote`) and the option it answers at line 3736, an
    assistant entry read directly: "un estimado hasta 5 % arriba del tope cuenta como dentro".
    Nothing reads the rule yet: `codex-review --plan` is open in `feat/gate-wait`, so its
    reader joins the rest of the second part of T16b. The list has 17 rules, hash
    `1ccb54f9013d`; `rules check` passes.
    The register gets `documents-commit-skips-suite` (the lead's notice of 13:07, relief file
    line 407): a commit of declared documents alone runs no sensor while the suite reads them.
    Until the gate covers it, `rules check` is run by hand after a commit of documents that
    touches `docs/RULES.md` or `docs/rule-sources.json`.
    NEXT: this commit through the gate; gentle-ai assessed from `8a73dde`; Codex with
    `--base 3088960`, plan first, run when the plan is at most 1.05 times the allowance; push
    and a pull request on `main`.
  - That commit is `f7649b8` (the gate passed at 14:16, after an hour in its line). gentle-ai
    assessed `8a73dde..f7649b8` as medium and not due (`under_budget`). Codex reviewed
    `3088960..f7649b8` in 3 parts and the review is recorded: 848,242 input tokens (678,912
    cached), 206 s, against a plan of about 750,000 and an allowance of 1,125,600 for 938
    changed lines. Two parts with no defect and one finding of the second priority, taken:
    `heldOther` summed the other values of every held item, so a session that differs in its
    model and in its effort was said as "2 records". It now counts each differing record
    once, test first (2 for 1 before the change); 82 and 33 tests pass.
    The register also gets, from the first run of the suite on GitHub's Linux (run
    38296748258, relief file line 425, classified by JH 8): `test-skipped-here-never-run`,
    `linux-probe-misnames-process`, `refusal-in-system-words`; and two more sightings of
    `command-run-for-help` (`install --help` at 03:25 and `check --help` at 13:16, both on
    2026-10-12), four in all with its control still owed.
    Taken from the lead (14:48, a claim): after this pull request, one small branch off `main`
    corrects the stale expectation (`bin/lib/project.test.mjs:1936`, by reading ae471e7; no
    run can show it green here, since this machine skips the test) and the `ENOTDIR` of
    `evals/paths.mjs:6`, test first. The probe of `evals/ports.mjs:168-169` waits as its
    register entry: it is reproduced only on Linux.
    NEXT: this correction through the gate; Codex on that one commit, plan first; push and
    the pull request on `main`.
  - The correction is `e9b1711` (the gate passed at 15:48, after 56 minutes in its line).
    Codex reviewed `f7649b8..e9b1711` and found the patch correct; the review is recorded
    (127,297 input tokens, 90,240 cached, against the floor of 300,000). Codex on this branch:
    975,539 input tokens in two runs. No finding is open.
    `main` moved three times while the branch waited (pull requests 74, 76 and 75, to
    `af20747`), and one more move is announced. Twice a merge of `main` was staged and put in
    the gate's line, and twice it was taken out before it ran, by stopping this session's own
    waiter (a dead waiter is passed after the stale time of 60 s, `bin/lib/gate-lock.mjs:60`):
    nothing was committed, the head stayed `e9b1711`. From now the merge is made inside the
    turn of the gate, of `main` as it stands when the turn starts (the lead's way, 16:49, a
    claim): a script fetches, merges without committing, and commits, whose hook runs the gate
    under the lock the turn holds (`JS_HARNESS_GATE_HELD`, `bin/check.mjs:445-463`). A merge
    that does not apply clean is undone and nothing is committed.
    A slip of this session, twice on this day: a message to the lead carried an hour that was
    guessed and not read (14:58 for 14:53; 16:47 for 16:45). Both are corrected to the lead
    and added to the register under `hours-guessed`, whose control stamps a relief line and
    not a message. Until a message is stamped by the channel, this session writes an hour
    only when `date` printed it in the same turn. The register also gets
    `short-name-judged-outside` (relief file line 427).
    NEXT: the merge in its turn of the gate; push; the pull request on `main`. Then
    `fix/linux-run-findings` off `main`, and the pause percent of `bin/lib/sessions.mjs` as a
    declared rule, each its own branch.
  - The turn ran from 17:12:32 to 17:27:05: it merged `origin/main` at `6785ec7` (pull
    request 77, the document sensors, was in it) into `80987cb`, clean, and the gate passed
    on the merged tree: commit `b33ef94`. Pushed; the push row said 5 code commits since
    `origin/main`, all covered by a Codex record. Pull request 78 is open on `main`, for the
    lead to merge.
    Branch `fix/linux-run-findings`, cut from `b33ef94` in its own worktree so that it does
    not wait for that merge, holds two small corrections from the run on Linux, inline:
    (1) `exists` of `evals/paths.mjs` says a path below a file is not there where the system
    says `ENOTDIR`, as it already said on Windows, and throws any other error; test first, in
    a new `evals/paths.test.mjs` through a file system passed in (with the seam alone the
    test failed on `ENOTDIR`; 4 tests pass, and the 74 of its two callers' files).
    (2) `bin/lib/project.test.mjs`, the test "uninstallProject never follows a symlink placed
    where a written file used to be", expected the reason `changed since init`; since ae471e7
    the check that a path is still inside its base comes first and follows a link in the last
    component (`realish`, `bin/lib/project.mjs:137-167`; `uninstallProject`, `:1159-1163`),
    so the reason is `moved outside`. The expectation was corrected by reading ae471e7 and no
    run has shown it green, since this machine skips the test.
    In the register: `documents-commit-skips-suite` has its control, read on `main`
    (`harness.json` `documentSensors`, `bin/check.mjs:206-225`, and its test);
    `refusal-in-system-words` has its control; `command-run-for-help` stays owed, since
    `install` (pull request 76) and `check` (77) refuse a word they do not know and `gate`
    does not yet. Not taken, and told to the lead: three more tests fail on Linux by their
    own fault (`bin/lib/payload.test.mjs:197` and `:212`, a Windows absolute path;
    `evals/codex-isolation-probe.test.mjs:301`, `HOMEDRIVE`), by JH 8's classification.
    NEXT: this branch's commit through the gate; Codex by its plan; push and its pull request
    once 78 is merged. Then the pause percent as a declared rule.
  - Pull request 78 was merged at 17:28 (`main` at `e90e0a4`). This branch's commit is
    `2f81a63`: its turn of the gate (17:40:04 to 17:54:23) first moved the branch forward to
    `origin/main`, a fast-forward under the uncommitted changes, then committed, so the one
    gate ran on a tree that holds `main`. gentle-ai assessed `e90e0a4..2f81a63` as medium and
    not due. Codex reviewed it and found the patch correct; the review is recorded (156,971
    input tokens, 113,152 cached, against a plan of about 80,000 and the floor of 300,000).
    Candidates, not taken, owed until a run on Linux can prove them (JH 8's classification,
    `odd/tasks/gate-wait.md` of `feat/gate-wait` at ea02144; the lead's word of 17:36, a
    claim): `bin/lib/payload.test.mjs:197` and `:212` feed a Windows absolute path, which
    `path.isAbsolute` rightly calls relative on Linux; `evals/codex-isolation-probe.test.mjs:301`
    asks for `HOMEDRIVE`, set on Windows alone (`evals/configs.mjs:144`).
    `command-run-for-help`, read on `main`: its sightings inside the harness have their
    refusal, `install` (`bin/install.test.mjs`, pull request 76), `check`
    (`bin/check.test.mjs`, pull request 77) and `gate` (`bin/gate.mjs:109` and `:129`). Its
    control stays owed for what its sentence says of every command: one test at the
    dispatcher that each command of `js-harness` refuses a word it does not know. Not assigned.
    The pause percent is built on its own branch, `feat/rules-context-pause` (commit
    `ca83a3d`, the gate passed at 18:08), and its entry is written there after this branch is
    merged, so the two do not meet in this document.
    NEXT: push and this branch's pull request; then the context pause's Codex result, its
    entry here, its push and pull request.
  - Pull requests 80 (the two corrections from Linux) and 81 (the context pause) are merged:
    `main` is `3a94ae4` (19:07). Each took one merge of `main` inside its own turn of the
    gate, in the order the lead gave, 80 then 81; the document was joined by git, no conflict.
    T3e, branch `fix/fence-under-list-item`, written inline: commit `b6babc3` (its turn of the
    gate 19:12:49 to 19:22:23, a fast-forward to `3a94ae4` and then the commit). `tokenize`
    of `bin/lib/progress.mjs` keeps the text column of each list item the line is under; a
    fence marker opens within three spaces of that column and the same measure closes it;
    `indentedFences` still opens a deeper one. Test first: three tests failed, 35 passed.
    gentle-ai assessed it as medium and not due. Codex reviewed `3a94ae4..b6babc3` (169,508
    input tokens against a plan of about 190,000) and found two things of the second
    priority, both taken and corrected test first in the commit after it (2 failed, 37 pass):
    a fence that opens at the margin did not leave the list item, so a later fence was
    measured from a stale column; and a thematic break written with spaces (`* * *`,
    `- - -`) was read as a list item. Not followed, and said in the code: a paragraph's line
    that goes on at the margin leaves its item, and a fence still open when its item ends
    runs on until its marker. On this repository's documents `progress` reads 306 of 350 and
    the register 65 failures with 18 not settled, before and after.
    NEXT: the correction through the gate, Codex on that one commit, push, the pull request.
- 2026-10-13, T16b, the rest of the second part, on `feat/rules-review-readers` (worktree
  `D:/js-harness-worktrees/rules-review-readers`, cut from `53826d8`, which holds pull request
  91 with the documents owed). Route: inline, no writer: two small pieces in files that are
  free, and the plan of the week at 90 percent. JH 8 said the command's lines were free
  before anything was written (its message of that night, a claim) and was told each line.
  - Piece 1: `REVIEW_MODEL` and `REVIEW_EFFORT` read `review-model` and `review-effort`
    (`bin/codex-review.mjs`). RED first: the command's own test now asks that each constant
    is defined once, from its rule, and failed on "REVIEW_MODEL is defined once, read from its
    rule"; green after the change. `docs/RULES.md` rendered: both rules are read by the
    command.
  - Piece 2: the reader of the margin, designed above ("The plan against its allowance") and
    read by a sub-agent that did not write it before any code (no blocker, nine advisories,
    all answered there). `bin/lib/codex-review-allowance.mjs` and its test, 14 tests, written
    first and seen failing on the missing module; the command prints the line in its `--plan`
    branch and its usage says so. On this repository: `codex-review --plan --again --base
    HEAD~3` ends "Allowance of this plan: 1,881,600 input tokens, the larger of 300,000 a
    review and 1,200 a changed line, for the 1,568 changed lines it reads. Its estimate, about
    517,000, is inside it." The three rules are now read by that file (`docs/RULES.md`).
  - Not done, and owed before the second part closes: `bin/codex-review.test.mjs` still states
    the model in 67 places and the effort in 58 (`rg -c`), mostly whole lines of expected
    output, so "no test of it states the value as a literal" does not hold for that file. It
    is a mechanical change of a file JH 8 has a branch on; it waits for that branch.
  - His, sent to the lead: which figure of the plan is held to the allowance, the estimate or
    the higher one. The line says both and decides nothing.
  - A hold that came late. The lead held both pieces at 00:41 until his answer on what a
    first version holds; its message waited behind this session's turn and was read at 00:52
    (`date`), with the pieces written. This session stopped there, let the one commit pass
    its gate so that the work was not left uncommitted (`f2896a6`, turn 01:01 to 01:10, commit
    exit 0), and ran no Codex, push or pull request. In the register as
    `hold-read-after-build`.
  - The hold was lifted by his answer: "Todo lo que pedí, sin fecha" to what enters the first
    version (the lead's transcript, line 10519, read with `sessions --quote`); it is in the
    roadmap at the head of "Next".
  - Reviews of `f2896a6`. gentle-ai: medium risk, review not due, under budget (the hook's
    assessment at the commit). Codex with `--base 53826d8`, in a turn of the gate, 04:20 to
    04:21: "the patch is correct (confidence 0.91)", no finding, 239,219 input tokens (188,672
    cached) against a plan of about 140,000 to 500,000 and an allowance of 432,000; recorded.
    The plan's own line had said: estimate inside, higher figure over.
  - `main` merged at `c6b7976` in a turn of the gate (`e66936f`, 04:23 to 04:31, commit exit
    0; git merged `bin/codex-review.test.mjs` by itself, both sides having changed it in
    places apart). His answer of line 10609 is in the roadmap beside the one of 10519.
  - Given to this session by the lead on 2026-10-13, after this pull request: the branch
    `feat/codex-parity` (F6), which had no owner. First a read only, and the answer to what
    closing it takes, before any commit on it; nothing in its worktree is deleted.
- 2026-10-15, T16c designed, on `docs/rule-hierarchy-t16c-design`. A read-only explorer mapped
  what exists. Two readers that did not write it then read the first draft. The attack found
  seven blockers, among them:
  - the installed copy as the root;
  - an open change read from ancestry;
  - a clean tree that could not hold a text's home;
  - a retirement that lost its last value;
  - a unit change;
  - the write order.

  What was missing found twelve gaps, among them `set`, the form-only kind, computing from
  `origin/main`, the installed project and the help texts. All are folded into "The one command
  that changes a rule (T16c)". T16g, letter H, was added because it had no task. Not built.
- 2026-10-15, T16c built on `feat/rules-change`, tests first, inline. Six commits, every gate
  passed, WSL2 included.
  - An independent verifier (it is item 1) probed every part of the design in a scratch clone.
    It found two blockers, fixed in a5877e4 and rechecked fixed:
    - a second id on one branch silently reverted the first, because the whole list came from
      `origin/main`;
    - a landed `rule/` branch counted as open once main moved on.
    It also found a live id taken as a new rule, refused since.
  - gentle-ai, raised to item 1: four lenses over 10e29e6..a5877e4, approved and acknowledged,
    with 11 informational findings: the rollback's own result, the relief line after the write,
    the sentinel strings of `what`, the list-finding prefixes, the size of `runChange`, a
    second local-day helper, a doc comment of `lastLineFor`, and the pinned date of the tests.
    The first two are fixed in 6986330; the rest are follow-ups, not blockers. 6986330 was
    reviewed again with risk and resilience, approved and acknowledged, with one more
    informational finding at the rollback (`bin/lib/rules-change-run.mjs:248-255`).
  - Codex over 10e29e6..a5877e4 found five, fixed in 6986330 and rechecked fixed by Codex
    (a5877e4..6986330, 5 of 5):
    - a rule of his could be changed with a design source by giving it another owner;
    - a failed relief append left the files written;
    - AGENTS.md was refused only by its literal spelling;
    - a design source could name a path outside the repository;
    - the date fixtures depended on the host's time zone.
- 2026-10-15, T16d built on `feat/rules-row` from `main` b0093b8, tests first, inline. Seven
  units, each through the gate: 0b292bc (`{amount}`), 8aa9b00 (the scan, `bin/lib/rules-scan.mjs`),
  bf7d0f7 (the counts), 2012b78 (the two register findings), e000da9 (the row in `checkOwnRules`),
  85bc94e (the command's three keys), cea42f6 (the help, the failure in `docs/RULES.md`).
  - The scan, the counts and the two findings are in `bin/lib/rules-scan.mjs`, not in
    `bin/lib/rules-check.mjs` as the design said: that file keeps the checks of the list itself.
  - An independent verifier (items 1, 3 and 5) probed every item in a scratch clone. It found
    three blockers, fixed in aeeeff6 and rechecked fixed:
    - `{amount}` did not stand for an effort level, which the design names;
    - the test of the real list was missing; it now asks each rule with patterns for a planted
      line its patterns find and its mark does not (`PLANTED`, `bin/lib/rules-scan.test.mjs`);
    - `rules change` said an input that is not JSON before a branch not based on origin/main.
    Three of its advisories were silent misses of the row, fixed in the same commit: a clone's
    `diff.mnemonicPrefix`, a path with an accent, and a path with a space (the tab git puts
    after it, dropped by `addedLines`, so `checkCitations` gains it too). A row removed from a
    rule that has none is refused. Its other advisories stay as written, not blockers:
    - the `patterns:` line is printed after PASS only;
    - a retirement still releases a refusing rule, with a source and its reviews;
    - no CLI test of a non-zero count, since `rules check` reads the package's own list;
    - an added line that starts with `++ ` is read as a header, as before T16d;
    - the tests of `rules-change-run.test.mjs` leave their temporary repositories, as before
      (a separate task was offered).
  - gentle-ai, raised to item 1: four lenses over b0093b8..aeeeff6, approved and acknowledged
    (lineage `review-be897a496eaa9388`), with seven informational findings: two repeated shapes
    (`bin/lib/rules-change-run.mjs:115-126`, `bin/check.mjs:227`), a set's name
    (`bin/check.mjs:237`), a dry run that fetches, the row giving no line when git fails or the
    merge diff fails (the same as `checkCitations`), and the register read in a project, which
    does not happen: there `rules check` takes the project's form (`bin/rules.mjs:414`).
  - Codex over b0093b8..aeeeff6, two parts, found one: the counts compiled a malformed pattern
    again and threw before any finding. The scan now leaves out a pattern that does not compile,
    which also kept the gate's row and a turn's count from throwing (c55164e). Codex rechecked
    aeeeff6..c55164e: 1 of 1 fixed. gentle-ai assessed that commit medium and under budget, so no
    review was due for it.
  - The lead's queue left 247 out once: merged with `main` d4ec52d it went red, "FAIL tests npm
    run test exited 1 in WSL2 (Ubuntu)". Main had gained `sessions-open-in-sidebar`, the first rule
    with a `failure`, and that met T16d twice:
    - `docs/RULES.md` shows a rule's failure now, so it was rendered again;
    - `rules check` read a missing `docs/FAILURES.md` as a register with no entry, so seven tests
      of `bin/rules.test.mjs`, whose projects hold the real list and no register, failed on that
      rule. With no register the failures are now not checked, and a note says so, as for
      `docs/rule-sources.json`; the test projects carry the package's register.
    Both are in the merge c4b7a37, tests first. Codex read the merge's own resolution: correct.
  - 5a57a17: `{amount}` took the `max` of the mark `rule:gate-max`, of `--max` and of
    `Math.max(` for an effort level, so the mark that cures a finding of `gate-max` was a finding
    itself. An effort word now counts only as a word of its own. Found by probing step 2's planted
    lines; tests first; Codex: correct. 247 landed on 2026-10-15 (`main` a1e8fb3).
  - A sighting of `merge-review-covers-main`: `codex-review` said that `--base c4b7a37^` would
    review the uncovered merge, but at a HEAD past the merge that range is all `main` brought in,
    planned as 6 parts and about 1,620,000 input tokens. It was stopped in its first part. A merge
    is read by what was written in it only when it is HEAD, so it was reviewed from a detached
    worktree at c4b7a37, 1 part of 18 lines. A separate task was offered to make the hint true.
- 2026-10-15, step 2 of "The row `rules` (T16d)", the first patterns, changed from a `rule/`
  branch per rule to batches, by the lead (JH ORQ, 20:38): "Batches. It spends less than the plan
  named, changes neither order nor outcome, and each pattern is still undone by one rules change".
  The cost both ways: one branch per rule is 28 pull requests, each changing
  `bin/lib/rules-data.mjs` and so each with a gentle-ai review and a Codex review, about 4 to 8
  million Codex input tokens and 28 gentle-ai reviews; batches are about 4 of each. The order:
  the ten lowest counts in one pull request first, then the rest in two or three batches by
  count, the highest group (`context-pause`, `codex-review-floor`, `review-effort`) last and
  alone, since a bad pattern shows there. The drafts were probed against `main` with 247 on it:
  - `questions-one-place` and `sessions-open-in-sidebar` have no amount for a value, so they get
    no pattern and stay unscanned;
  - a pattern names its subject on the line, so a value stated with no subject beside it passes,
    as the section says (for example "A command is stopped after 30 minutes" in `README.md`, of
    `gate-max`), and a number written as a word ("three") is no amount.

- 2026-10-15, step 2 blocked before its first write, by two gaps of the design, sent to the lead:
  - 13 of the 28 rules that get patterns are his, and `rules change` refuses a design for them:
    "a rule of his changes only with his words, not a design" (`bin/lib/rules-change.mjs:261`),
    5 of the first batch's ten;
  - a change stores its source in place of the rule's, so a change of patterns alone from this
    design would overwrite where the value came from (`contract-run-timeout`'s
    `odd/tasks/task-contract.md` would become this document).
  The two ways put to him: his words in one line for patterns on his rules, quoted by each batch,
  which closes the first gap only; or a change of form (patterns or failure alone) that keeps the
  rule's source and needs none, its design named in the relief line, which closes both and says
  that his protection covers values and not patterns. Recommended: the second, with his yes.
- 2026-10-16, his answer to the first gap, asked by the lead ("¿Cómo seguimos con esas 13?"):
  "Solo forma, sin mí (Recomendada)". A change of form alone (patterns or failure) on a rule of
  his needs no words of his and keeps his words as its source; a value still needs them. Built
  test first on `feat/rules-form-his` (892c006), its own pull request; his 13 rules join the
  batches once it lands, and until then this branch holds only the 15 project rules.
- 2026-10-16, batch 1 built and reviewed: seven `rules change` runs, one commit each, after
  f007601, which derives the expected `patterns:` line of `bin/rules.test.mjs` from the list
  instead of pinning "none". gentle-ai (item 3, risk and reliability) approved and acknowledged
  (`review-2824619c451e8364`); the independent verifier found no blocker, and the three findings
  on `main` real restatements (`odd/tasks/gate-log.md:239`, the help of `wait` in
  `bin/js-harness.mjs:36`). Both said `person-present` (`here ... for`) and `gate-log-size` (a
  bare `log`) take ordinary prose; each is narrowed in a commit of its own, `person-present`
  first. The first try of
  that correction failed its gate on `checkSensor stops a command that never exits`
  (`bin/check.test.mjs:494`), which passed alone three times: this session's verifier ran
  `bin/lib/rules-change-run.test.mjs` (about 200 s) outside the lock beside its own gate, a
  sighting of `heavy-run-beside-gate`.
- 2026-10-16, after the restart: `feat/rules-form-his` is draft pull request 253. Its verifier
  found no blocker, and a differential check of 30 inputs against 87914bf showed only the allowed
  differences. Codex judged it correct at 0.96. This branch was rebased on `main` 99a4849, and
  `gate-log-size` was narrowed (d1ede8c); its one finding is still `odd/tasks/gate-log.md:239`.
  The remote still held this branch from before the first rebase. He authorized overwriting it,
  asked by the lead ("¿Lo autorizás?"): "Sí, que la pise (Recomendada)". So the push is
  `--force-with-lease`, of this branch only.
- 2026-10-16, pull requests 253 and 254 landed (`main` a99a8e3). Batch 3 is folded into batch 2,
  proposed by this session and agreed by the lead: one branch, `rule/second-patterns`, for eight
  rules (`agents-budget`, `gate-log-command`, `review-part-files`, `review-parts-unflagged`,
  `review-timeout`, `review-part-lines`, `gate-max`, `gate-wait`). The reason: narrowed, their
  findings on `main` are 0 to 4 each, all genuine restatements, so a separate batch 3 would have
  cost one more gentle-ai review and one more Codex run for the same outcome. The narrowings,
  each from a probe of the drafts on `main`:
  - `gate-log-command` names the gate log or `` `command` ``, since `bin/codex-review.mjs:563`
    cuts a Codex command line to 100;
  - `review-part-files` refuses an amount after a colon, since `bin/lib/codex-review-prompt.mjs`
    reads `of: 1, files`;
  - `review-parts-unflagged` names `--max-parts` or "its flag", since `bin/codex-review.mjs:124`
    tells of 28 parts started "without" the numbers;
  - `review-timeout` drops "past" and refuses an amount inside a word or a path, since
    `odd/tasks/codex-parity.md:52` has "the login past 192 h" and a path's line number counted;
  - `gate-max` and `gate-wait` want an amount that stands alone and is minutes or hours, which
    leaves out exit codes ("exit 75"), percentages, the sensor's 1,200 s, "S1" and "e5b7588".
- 2026-10-16, later work found by those probes: `{amount}` (`AMOUNT`, `bin/lib/rules.mjs`) has
  no left boundary, so the digits inside "S1", "e5b7588" or "mjs:42" count as amounts. Each
  pattern guards it for now. The lead: after the batches, a fix of `AMOUNT` itself, test first,
  as its own pull request; it changes what every pattern finds, so it is item 3.
- 2026-10-16, the lead, while he is away about ten hours: "keep going through the batches
  without stopping to report between them". His 13 rules follow batch 2, by count, the group of
  12 to 21 findings (`context-pause`, `codex-review-floor`, `review-effort`) last and alone.
- 2026-10-16, batch 2 reviewed. gentle-ai approved it (`review-610769fa73a6f19f`, acknowledged)
  with one warning: no test held a narrowed rule to the line it was narrowed for. Folded in:
  `NEAR_MISS` in `bin/lib/rules-scan.test.mjs`, one such line per narrowed rule of batches 1 and
  2. The independent verifier (Opus): PASS, no blocker; all 13 findings on the branch restate a
  value, two borderline (`agents-budget` on a quoted gate output). Its advisories, left for later
  because the finding is information only and none turns the check red:
  - false positives: `agents-budget`'s first pattern has no guard on `{amount}`;
    `review-part-files`' guard `(?<!:\s?)` fails for two or more digits, since `AMOUNT` starts
    mid-number; `review-timeout` wants no unit; `gate-max` and `gate-wait` catch measurements
    ("it ran 3 minutes"). The scan never compares the amount with the value, by design.
  - misses: `gate-wait`'s "an hour" before any "wait" (`bin/gate.mjs:190`, `bin/check.mjs:2125`,
    `docs/ROADMAP.md:736`); `agents-budget` without "budget" beside it (`docs/ROADMAP.md:468`,
    `odd/tasks/f2-context-diet.md:52`); `review-part-lines`' "stays at 400 lines"
    (`docs/ROADMAP.md:364`); `review-timeout`'s "stops"; `gate-log-command`'s "keeps each
    command to 120 characters".
  The `AMOUNT` fix takes the mid-number false positives; the rest is a second pass of patterns
  after his 13 rules.
- 2026-10-16, batch 2 landed as pull request 264 (`main` 8e43e8a): gentle-ai, the verifier and
  Codex (0.88, no finding) had all passed. His batch A had to wait for it: `rules change` keeps
  one rule change open at a time. Batch A, built on `rule/his-patterns` as changes of form under
  his answer of 2026-10-16, with a design for their source: `session-effort`, `session-model`,
  `subagent-reader-model`, `work-sessions` (0 findings each), `review-model`,
  `subagent-writer-model`, `reviewed-commit-lines` (1 each), `codex-review-margin` (2),
  `subagent-effort` and `codex-review-rate` (3 each). The narrowings, each from a probe of the
  drafts on `main`:
  - `codex-review-margin` wants a percent, since `odd/tasks/gate-wait.md` speaks of the gate's
    margin on its bound in seconds;
  - `codex-review-rate` wants a rate, a cap or "put at" before the amount, since "cost 325 input
    tokens a changed line" is a measurement;
  - `reviewed-commit-lines` wants a bound ("up to", "at most", "under", "holds"), since "It is
    5,222 changed lines" measures a commit;
  - `subagent-effort`'s second pattern leaves out a line naming a `gpt-` model, since
    `effort: "medium"` in `stack-v4.md` is Codex's orchestrator, not a subagent of this harness.
- 2026-10-16, his batch A reviewed. gentle-ai approved it (`review-b85f1114633b9a16`,
  acknowledged), with two warnings. The first is refuted: it held that `subagent-effort`'s
  near-miss line, with "medium", cannot test the `gpt-` exclusion. But `{amount}` matches any
  effort word (`AMOUNT`, `bin/lib/rules.mjs:80`), and a probe found that line without the
  exclusion and missed it with it. The second stands: `reviewed-commit-lines`' near-miss was
  missed by word order, not by the bound, so it is now "The commit is 5,222 changed lines.",
  which a probe found without the bound. The independent verifier (Opus): PASS, no blocker; 8
  of the 11 findings restate a value, and all three false positives were `subagent-effort`'s:
  two records of how readers ran, and "subagent" inside a path (`docs/ROADMAP.md:371`). So
  `subagent-effort`'s first pattern now wants a setting verb ("runs", "launched") before the
  effort, and a subject that is not inside a path; it keeps one finding,
  `odd/tasks/rule-hierarchy.md:1892`, a restatement. `NEAR_MISS` takes several lines per rule
  for it. The verifier's other advisories join batch 2's for the second pass: the aliases `opus`
  and `haiku`, which `{amount}` cannot match since it needs a digit; model lookaheads that accept
  any `claude-` or `gpt-` model; measurements; and the overlap between rules, which only a probe
  checks. gentle-ai's two suggestions go there too: `review-model`'s `\breview\b` misses
  "reviews", and `codex-review-margin`'s lookbehind on `%` leans on `AMOUNT` taking the unit,
  which the `AMOUNT` fix must keep or replace.
- 2026-10-16, T7 built by JH 27 on the lead's notice of 08:45 ("rule-hierarchy T7, the skill
  js-harness-protocols (six sections, each opening with its incident)"), branch
  `feat/protocols-skill`, inline, test first. `bin/lib/protocols-skill.mjs` holds the text and
  `install` writes it for both hosts as the third skill (`components` in `bin/lib/manifest.mjs`;
  `sync` rewrites it, `uninstall` removes it). RED: `bin/lib/protocols-skill.test.mjs` failed on
  the missing module; GREEN: 7 tests, and `bin/lib/manifest.test.mjs` 157. The test is the
  signal "No protocol without its incident": every section opens with `Incident (<date>):`.
  Where the design and the files of today differ, the files won, and each is said here:
  - a decision is asked with the question tool, through the orchestrator, since 2026-10-14
    (`block-read-as-task`, `docs/FAILURES.md`), so section 1 points to the orchestrator skill's
    "Questions to the user" instead of the block, and section 2 keeps the block only for a cut;
  - section 6 names the sub-agent rules by id (`subagent-reader-model`, `subagent-writer-model`,
    `subagent-effort`) and states no model, because T16 declared them since the design was
    written and the guard enforces them; the model clause that waited on his answer is not
    restated;
  - section 4 follows letters A to H as far as they hold in a project that only installs the
    harness: `rules change` in the harness's own checkout, `docs/rules.json` by hand elsewhere
    (`bin/rules.mjs:9-16`); its review date, 2026-11-16, is this session's choice;
  - the skill speaks of "the user", since it ships to every project.
  The incidents, each from the register: 1 `asked-yes-not-his` (2026-10-09), 2
  `block-read-as-task` (2026-10-07), 3 `chained-step-not-conditional` (2026-10-10), 4
  `old-rule-beside-new` (2026-10-11), 5 the memory note on a mistake in five parts (2026-10-10,
  his words in the orchestrator's chat, quoted in that note and not read at their line here), 6
  `estimate-passed-as-fact` (2026-10-10). The controls of `chained-step-not-conditional` and
  `stacked-pr-base-order`, owed to this task, now name a phrase of the skill. Sections 5 and 6
  are proposals of this document that he has not answered ("Ask me before"); they are built
  because the lead assigned six, and are his to keep or drop. Not done here: the practice
  journey's host-load check (`hostCallProblems`, `scripts/practice-lib.mjs`) still asks the
  host for the two older skills only, since its fixtures are recorded streams; a step that
  proves the host lists this one belongs to T12.
- 2026-10-16, T16g built by JH 27 on the lead's notice of 18:05 ("rule-hierarchy T16g (letter H,
  the protocol's own home, replaces protocol 4), per the doc"), on `feat/rule-hierarchy-t16g`,
  inline, test first. The home is section 4 of the protocols skill, which T7 built; what letter H
  still owed:
  - the incident: the section now opens with the stale 73 percent of the relief file's line 245
    (his words of 2026-10-11, read at that line by this session), instead of the three changes of
    the pause alone;
  - the done: a line "Done: `js-harness rules check` exits 0.", one command, since it holds
    the list in the harness's checkout and `docs/rules.json` in a project (both read exit 0 on
    `origin/main` c1bf1b5, the project in an empty `mktemp -d` repository);
  - the cost and the review date, 2026-11-16, were already there from T7 and are now pinned;
  - "replaces protocol 4": the one text in force that still named the old protocol, "recording a
    new rule", was the fix of `doctor`'s `memory-rules` row (`bin/lib/memory-rules.mjs`); it
    now reads the section's title from `PROTOCOLS` and names the skill. `docs/todo.md` points to
    the section too. The feature documents that name the old protocol are records and are left.
  RED: `bin/lib/protocols-skill.test.mjs` failed on the incident (observed); GREEN: that file 8,
  `bin/lib/memory-rules.test.mjs` 5, `bin/doctor.test.mjs` 71.
- 2026-10-16, T9's empty register, by `JH 28 · reserva B` on `feat/empty-register`, from the
  lead's notice to 28 (a claim of the lead's, read in the channel record) after PR 280, the
  template's lines, had left it open. Built test first: `init` writes `docs/FAILURES.md`
  (`FAILURES_TEMPLATE`, `bin/lib/project.mjs`) when the project has none, under the same terms
  as `AGENTS.md`: an existing register is kept and listed in `kept`, and `sync` in a clone
  creates none. It says what a failure is and how a class and an entry are written, and declares
  no class, since the classes are the project's own. It parses with no fault, so the gate's
  `failures` row passes on it. The file is in the manifest with its hash, and `docs/`, when this
  run made it, among the folders `uninstall` removes while empty. RED: two new tests of
  `bin/lib/project.test.mjs` failed on `main`; GREEN after. Six tests that pin `init`'s folders
  or the count of what it writes now name `docs`. Checked by hand in a throwaway repository:
  `init` printed "wrote docs/FAILURES.md", `uninstall` printed "removed docs/FAILURES.md" and
  "removed docs", and only `.git` was left. The README's examples and `init`'s help line name
  the register. Codex on `e898283` (P2, 0.98): a `docs` that is a link out of the repository
  took the register outside, where `uninstall` does not follow; its folder is now judged as the
  hooks path is (`resolveHookContainment`), and such a register is kept as outside, never
  written, pinned by a test with a junction.
- 2026-10-16, JH 25 (`JH 25 · jerarquía de reglas (spec y respuesta)`), given T1, T2 and T12 by the lead;
  worktree `D:/js-harness-worktrees/jh25`, branch `feat/jh25-spec-reply`, from `main` 6a6ce9e.
  - Host facts T2 rests on, confirmed: a logging `Stop` hook in a project of this session's scratchpad,
    run with `claude -p` (Claude Code 2.1.301, Haiku 5.5, one background `sleep 30`), received
    `stop_hook_active: false`, `last_assistant_message` and `background_tasks: [{ …, "status": "running" }]`
    (empty at the next stop), plus `session_crons`. Codex's hooks page (learn.chatgpt.com/docs/hooks, read
    the same day): `Stop` carries `stop_hook_active` and `last_assistant_message` (string or null), no
    background tasks; exit 0 needs JSON on standard output; `decision: "block"` with a `reason` continues
    the turn. gentle-ai's own `Stop` hook and `guard --stop` already run beside it here.
  - T2's design, read against `AGENTS.md` as it stands, not the design of 2026-10-10: a decision is now
    asked with the question tool and a cut carries one block, so C1 refuses a reply that has no state
    line or more than one; a state line not in the last paragraph (except a cut); working or finished
    with nothing after the label; a decision while a background task runs; a cut without its three
    labels each once, without its block, with an empty one or with two under the labels; and the three
    labels in any state but a cut. Left out, with the reason: the line at the context pause (the
    `resume --pause` hook already says it once a stretch); the shapes of a `/compact` cut (retired on
    2026-10-15); naming which of his items a decision falls under (the lead's inventory of 2026-10-12
    took it out). Labels default to English with `"reply": true`; an object names the project's own.
  - Built test first, not committed yet (RED seen on the missing module, then GREEN): `bin/lib/reply.mjs`
    (15 tests), `bin/reply.mjs` (7), the dispatcher's entry and help, a README section, the entries
    `claude-reply-hook` and `codex-reply-hook` in `bin/lib/manifest.mjs` (command
    `js-harness reply --hook || exit 0`), the skill's line, and the tests they move
    (`bin/lib/manifest.test.mjs` 157 pass, `bin/install.test.mjs`'s hook lines). T12's reply step:
    `reply-hook` in `JOURNEY`, `replyHookInput` and `replyHookProblem` in `scripts/practice-lib.mjs`
    (104 pass), the step in `scripts/practice.mjs`, `HARNESS_HOOKS` with the reply entry for both hosts;
    run by hand against this worktree's `bin/` in a scratch folder: no problem found. T12's template step
    waits for T9 (the template's lines are his wording).
  - Not on: this repository's `harness.json` holds no `reply` key. Question 9 to the lead, for him:
    turn it on here (the key with the Spanish labels, and the next `sync` writes the inert `Stop` entry on
    his machine), install it off, or hold the pull request. "Ask me before" names the install on this
    machine, so the pull request says it lands only after his answer.
  - Next: commit through the gate (one gate for this unit), gentle-ai, Codex with `--base 6a6ce9e`, the
    pull request, the lead told; then T1 (`docs/SPEC.md` and the row `spec`), from the notes the lead
    compiled under `~/.js-harness/spec-notes/`, outside the repository (254 lines, six sessions).
  - Done, 2026-10-16: `020b412` through the gate (exit 0). gentle-ai assessed it medium and not due by size;
    the session raised it to high by item 5 (it adds `Stop` entries `install` writes on every machine).
    Review lineage `review-0e9133019c3aab6f`, lenses risk, resilience and reliability, consent pre-granted:
    approved with no blocker and acknowledged (authority burned). Of its four advisories, three were
    closed in `1dd9c23` with their tests: a body line that only begins with a label ("Working on the
    docs") counted as a state line, two labels where one begins the other matched one line, and a
    `harness.json` that is not JSON turned the check off in silence. The fourth repeats the third.
    Codex reviewed `6a6ce9e..1dd9c23` in three parts (374,557 input tokens, inside the allowance of
    840,000): one P2, a fenced block a quote holds (`> ```) was not read as a block; closed in the next
    commit with its test.
  - After T1 landed (PR 293, `main` 5cccfc4), this branch merged `main` and `docs/SPEC.md` gained "The
    reply check" (51 capabilities): the row `spec` had refused the merge on `js-harness reply` and the
    two hook entries, which no capability claimed. The pull request stays a draft on question 9.
- 2026-10-16, T17e, by `JH 28 · reserva B` on `docs/sweep-close`, from the lead's notice to 28
  (a claim of the lead's, read in the channel record). Three read-only readers took the 104
  unchecked items of `docs/sweep-2026-10-11.md` against `main` at `5cccfc4`, one group each: A
  and B, the places of documents and code; C, the places that are his (AGENTS.md, his memory
  notes) or the lead's (the machine's install, the relief file). One claim of each reader was
  checked by hand before it was used. Corrected in this commit, by each item's own Fix: eight
  places of `odd/tasks/gate-lock.md`, nine of `odd/tasks/gate-log.md`, four of
  `odd/tasks/codex-parity.md`, the dated criterion of `odd/tasks/stack-v4.md`, and the comment
  over `SENSOR_TIMEOUT_MS` in `bin/check.mjs`, which now names no duration and points to the
  gate log. Checked off with a `Closed:` line: 12 of A and B found already corrected or gone,
  and 22 of C (18 corrected, 4 gone), with the evidence the reader gave. Left open, 47: 33 of
  his and 11 of the lead's (the table, with evidence, is in the lead's notes folder as
  `jh28-sweep-group-c.md`), and three that are not this task's: line 320 (T15), 780 (his
  answer) and 926 (`contract.mjs`, decided with finding 12). Reader C's finding: the memory
  merge of 2026-10-15 copied stale sentences verbatim into the notes it merged them into, so
  they moved instead of going away. T17 stays open until its owners close the rest.
- 2026-10-16, T9, by `JH 28 · reserva B` on `feat/template-lines`, from the
  lead's notice to 28 (a claim of the lead's, read in the channel record). Built test first:
  `agentsTemplate` (`bin/lib/project.mjs`) carries items 1 to 4 and 6 of "`AGENTS.md`,
  rewritten", worded for any owner, under "What good looks like" (items 1 and 4) and a new
  section "Working with the owner" (items 2, 3 and 6). RED: the new test of
  `bin/lib/project.test.mjs` failed on the template of `main`; GREEN after the change. The size
  test measured characters (under 1,200); it now measures tokens with `estimateTokens`, at most
  half of `agents-budget`, so an installed project keeps the other half for its own lines. The
  template measures 564 estimated tokens, from 194 on `main`; the README's example of `check`,
  which said 122, says so. Three choices of this session, each reversible in one commit:
  - Item 6 names the four states in a line of their own. The design's wording ("the reply check
    says how") points at C1, which is not built (T2) and which no installed project has on, so
    the template says what each state means instead.
  - Item 2 takes the list of 2026-10-11 with the report published outside that the design adds;
    T8's draft holds the list he passes, and the template follows it when that changes.
  - Item 4 enters before C7 has measured it (`odd/tasks/honesty-audit.md`, T10): the eval copies
    its own text (`evals/configs.mjs`, `HONESTY_SENTENCES`), so this change does not move it, and
    if the line does not move the score it leaves the template with `AGENTS.md`.
  Not built, and why: the empty failures register that "The failures register" left to T9
  (`init` writing `docs/FAILURES.md`). It would add a file that `init` writes in every project
  and that `uninstall` removes, and the files `init` writes are pinned as exact lists in many
  test files (`rg -l "AGENTS.md" -g "*.test.mjs" bin scripts`: 19 files); it also turns the
  `failures` row on in every installed project. It is left open under T9 for the lead to assign.
  Two questions for him, sent to the lead with `notify --kind question`: (1) the final wording of
  the template's new lines ("Ask me before"), read in `bin/lib/project.mjs`; (2) whether `init`
  turns the reply check on in a project, which can be built only once C1 is (T2, JH 25). T9
  stays open until both are answered.
- 2026-10-16, T9, his answers to both questions, relayed by the lead's notices to 28 and read
  in the lead's transcript (`e152c9d8-53bc-4366-8fa5-526b1576bcb6.jsonl`) with `js-harness
  sessions --quote`, each a user entry tapped in answer to the lead's question tool. Question
  10, the template's wording (line 13547, options "Sí, así como está | Esperar"): "Sí, así como
  está". So the lines stand as built and the pull request is marked ready. Question 11, whether
  `init` turns the reply check on (line 13566, options "Prendido por defecto (Recomendada) |
  Apagado hasta que lo active"): "Prendido por defecto (Recomendada)". So `init` writes the
  reply key on in a new project's `harness.json`; the lead assigns it after C1 lands (pull
  request 282), test first, in a pull request of its own. T9 stays open for that.

## Next step
**State for a resume, 2026-10-16, his batch A reviewed on `rule/his-patterns`.** gentle-ai
approved and acknowledged, the verifier passed, `subagent-effort` narrowed and the near-miss fixed
in one more commit. Next: gentle-ai's assessment of that commit, Codex, `merge-tree`, and a draft
pull request to the lead's queue; then batch B alone, narrowed first; then the `AMOUNT` fix.

**State for a resume, 2026-10-16, batch 2 reviewed.** gentle-ai approved and acknowledged, the
verifier passed, `NEAR_MISS` folded in. Next: Codex (`codex-review --base origin/main`),
`merge-tree`, push and a draft pull request to the lead's queue; then his batch A (ten rules),
then batch B alone, then the `AMOUNT` fix.

**State for a resume, 2026-10-16, batch 2 being built on `rule/second-patterns`.** Each rule is one
`rules change` with source design `odd/tasks/rule-hierarchy.md`, its entry in `PLANTED`, and one
commit; then gentle-ai, the verifier, Codex, `merge-tree` and a draft pull request to the lead's
queue. Then his 13 rules, probed again on `main`, in batches by count; then the `AMOUNT` fix.

**State for a resume, 2026-10-16, paused for an app restart (gentle-ai 4.2.0).** Progress has
his answer and batch 1's review. `rule/first-patterns` holds batch 1 and `person-present`
narrowed (0187b1f); gentle-ai approved the batch before the narrowing. `gate-log-size`'s
narrowing (in the scratchpad's `finish-b1.mjs`) is not run: `main` moved to f1a057a (pull
request 250) and `rules change` refuses a branch not based on it, so the branch is rebased
first. `feat/rules-form-his`
(892c006) holds the change of form for his rules: gentle-ai approved it with no finding
(`review-df2f2cb7d6feebb8`); its independent verifier was stopped by the pause and runs again.
Neither branch is pushed: the pre-push hook wants Codex's record for their code commits, and
Codex has run on neither. Next, after the restart: the verifier of `feat/rules-form-his`, then
Codex, `merge-tree`, push and a draft pull request for each, to the lead's queue; batch 2 after.
Never run a gate while a verifier's tests run. The state below is otherwise current.

**State for a resume, 2026-10-16 at 03:45 by `date`, step 2 of T16d, batch 1 being built.** Pull
request 249 landed (`main` 87914bf): a change of patterns or failure alone keeps the rule's stored
source. The lead split the decision: the 13 rules of his wait for his answer on whether his
protection covers patterns; the 15 project rules go now, in three batches by count on `main`
87914bf. Batch 1 (0 to 1): `contract-run-timeout`, `control-phrase-min`, `person-present`,
`sensor-timeout`, `gate-log-size`, `wait-every`, `wait-for`. Batch 2 (2 to 4): `agents-budget`,
`gate-log-command`, `review-part-files`, `review-parts-unflagged`, `review-timeout`,
`review-part-lines`. Batch 3: `gate-max` and `gate-wait`, whose drafts catch lines that only
mention a number near the word and are narrowed first. Each rule is one `rules change` run with
source design `odd/tasks/rule-hierarchy.md`, its entry in `PLANTED`, and one commit.

**State for a resume, 2026-10-15, step 2 of T16d, blocked on a decision.** T16d is on `main`
(a1e8fb3) and checked off. `rule/first-patterns`, from `main`, holds only the documents' commit.
Step 2 waits on the decision in Progress (his rules, and a change of form that keeps a rule's
source). The drafts of the patterns and of the planted lines are probed: the ten lowest counts
are `contract-run-timeout`, `control-phrase-min`, `person-present`, `session-effort`,
`session-model`, `subagent-reader-model`, `work-sessions` (0 each), `subagent-writer-model`,
`wait-every` and `wait-for` (1 each). Next, once decided: that batch through `rules change`, each
with its planted line in `PLANTED` (`bin/lib/rules-scan.test.mjs`), to the lead's queue.

**State for a resume, 2026-10-15, T16d built and checked.** The code is draft pull request 247
(`feat/rules-row`, b0093b8..c55164e, pushed); its design is draft pull request 241, this branch.
Every check passed: each gate, the verifier and its recheck, gentle-ai (acknowledged), Codex and
its recheck, and merge-tree against origin/main e019785. Next: both land through the lead's
queue, and T16d is checked off when 247 lands. Then step 2 of the section's order: the first
patterns, one `rule/` branch per rule, each with its planted line in `PLANTED`.

**State for a resume, 2026-10-15 at 19:28 by `date`, T16d being built.** On `feat/rules-row`
(worktree `D:\js-harness-worktrees\rules-row`), each unit through the gate:
- unit 4, `rules check`'s two findings, `registerFindings` in `bin/lib/rules-scan.mjs` (2012b78);
- unit 5, the row `rules` in `checkOwnRules`, `checkListRow` in `bin/check.mjs`, tested in
  `bin/check-rules-row.test.mjs` (e000da9);
- unit 6, the command's three keys, `withRowKeys` in `bin/lib/rules-change.mjs` and the fetch and
  the count in `bin/lib/rules-change-run.mjs`, in its gate at this hour.
Deviation from the design: the scan, the counts and the two findings are in a new
`bin/lib/rules-scan.mjs`, not in `bin/lib/rules-check.mjs`, which keeps the checks of the list
itself. Next: unit 7, the help and the failure id in `docs/RULES.md`, already green in a copy;
then the independent verifier, gentle-ai with `--escalate-item 1`, Codex, and a draft pull request.

**State for a resume, 2026-10-15 at 18:45, T16d being built.** The design is draft pull request
241. The build is on `feat/rules-row` (worktree `D:\js-harness-worktrees\rules-row`, from `main`
b0093b8), inline, tests first. Unit 1 is done (0b292bc): `patternOf` and `{amount}` in `bin/lib/rules.mjs`, with `readRules`
refusing a pattern with no `{amount}` or one matching an empty line. Unit 2, the scan, is
`bin/lib/rules-scan.mjs` (8aa9b00). Unit 3: `rules check` prints `patterns: none; unscanned: 29`
after its PASS line (`bin/rules.mjs` `patternsLine`, bf7d0f7). Next
units, in order:
1. `rules check`'s two findings: a `failure` naming no register entry, a switch back with no sighting;
2. the row in `checkOwnRules`;
3. the command's three keys;
4. the help.
Then the verifier, gentle-ai and Codex, and a draft pull request.

**State for a resume, 2026-10-15, after T16d was designed and read.** T16d is designed in "The row
`rules` (T16d)" on `docs/rule-hierarchy-t16d`, with both readers' findings folded in. Next: open
its pull request (draft), then build T16d inline on a `feat/` branch from `main`, tests first, in
the order and with the tests the section names; then an independent verifier, gentle-ai, Codex.

**State for a resume, 2026-10-15 at 18:21 by `date`.** Pull requests 238 and 234 landed
(`main` e7e97df and d2441d5): T16c is checked off. Its prerequisite for T16d, the gate's stop
before its sensors, is built (`docs/ROADMAP.md:801`, 2026-10-11). Next: T16d, the row `rules`,
designed the way T16c was: a read-only map of what exists, the design here, two readers that did
not write it, then the build, tests first.

**State for a resume, 2026-10-15, after T16c was built.** T16c is pull request 238, draft
(`feat/rules-change`, worktree `D:\js-harness-worktrees\rules-change`, 6986330), every
check passed: the gate, the verifier, gentle-ai (two lineages, both acknowledged) and Codex
(10e29e6..6986330 recorded). Its design is pull request 234, draft, on this branch. Next: both
land through the lead's queue; check off T16c when 238 lands; then T16d, the row `rules`. The
twelve informational findings of gentle-ai are follow-ups under "Progress", none open.

**State for a resume, 2026-10-15, after T16c's design.** T16c is designed and its two
readers' findings are folded in, on `docs/rule-hierarchy-t16c-design`; T16g, letter H, is
added. Next: build T16c as the design says, tests first, telling the lead before each shared
file; then an independent verifier, since it is item 1.

**State for a resume, 2026-10-15 at 15:05 by `date`.** Pull request 232 landed (`main`
10e29e6): T16b is checked off, its three parts done. Next: T16c, the one command that changes a
rule, designed and read by a reader that did not write it before it is built.

**State for a resume, 2026-10-15 at 14:44 by `date`, at the context pause (88 percent).** On
`main` (e000fc6): T3f (219), 216, the dispatcher's help (230) and this document (231). The
register's two entries are `measured` on `main`, rewritten by JH 15 before it was archived
(`js-harness failures` shows both). Open: draft pull request 232 (`feat/rule-review-fixtures`,
worktree `D:\js-harness-worktrees\rule-dispatcher-help`, 41ee91f, every check passed), the
last part of T16b; check off T16b's second part, and T16b, when it lands. Next: T16c, the one
command that changes a rule, designed and read by a reader that did not write it before it is
built. The worktrees `rule-skill-wait` (detached at `main`) and `rule-contract-timeout` hold
no work and can be removed.

**State for a resume, 2026-10-15 at 13:48 by `date`.** T3f is built: draft pull request 219
(`feat/register-measured`, worktree `D:\js-harness-worktrees\rule-contract-timeout`, 43b395f),
gate green, gentle-ai not due, Codex recorded; the lead and JH 15 were told, and JH 15 rewrites
its two entries once it lands. Pull request 216 was left out of the lead's lands after 213
landed (a conflict of adjacency in `bin/lib/manifest.mjs`); its change moved onto `main`
eabff8f as one commit, 4cf6844 (worktree `D:\js-harness-worktrees\rule-skill-wait`), with the
same patch lines, a new Codex record (0.97), and it is MERGEABLE, the lead told. The dispatcher's
help reads `gate-wait` and `gate-max` on `feat/rule-dispatcher-help` (worktree
`D:\js-harness-worktrees\rule-dispatcher-help`, b1c2451, gate green), merge-tree clean against
`main` and against 216; its Codex review passed (0.97, recorded) and it is draft pull request 230, the lead told.
Once 216 and it both land, `js-harness rules check` on `main` says whether `docs/RULES.md`
needs a render. Left of T16b: JH 8's two test files.

**State for a resume, 2026-10-15 at 09:12 by `date`.** Pull requests 206 and 207 are on
`main`. `bin/lib/manifest.mjs` is done as pull requests 213 (ready, marked by the lead) and
216 (draft, stacked on 213), both on branches of the worktree
`D:\js-harness-worktrees\rule-contract-timeout`. At 09:16, T3f's design is drafted ("A failure
with no control, measured (T3f)" under `## Design`); at 09:21 a reader that did not write it
read it, and its eight changes are written there. Next: build it test first on a new branch
from `main` (`feat/register-measured`), in `bin/lib/failures.mjs` and its tests, the usage line
of `bin/js-harness.mjs:22` told to the lead first (pull requests 201 and 194 change that
file); then tell JH 15 it can rewrite its two entries; the dispatcher's help
once pull requests 201 and 194 land; JH 8's two test files close T16b.

**State for a resume, 2026-10-14 at about 15:00, at 89 percent of the context.** T16b is PAUSED by
his order to fix the failures first (the lead's transcript ffe99ebf, lines 5906 and 5853). Parked:
`feat/rule-contract-timeout` (worktree `rule-contract-timeout`, commit e3d3dee, stacked on pull
request 129's branch, no Codex record yet: run `codex-review --base 2c65caf`, then its pull
request); `feat/rule-review-timeout` (worktree `rule-review-timeout`, NOT committed: a merge of
`main` staged with `--no-commit` and the review's timeout unstaged on it; commit both in one gate
turn with `turn-merge-then-work.sh` of this session's scratchpad, as its message files there say).
Then `bin/check.mjs` after JH 8's documents skip. The register's eight entries of the night of the
14th are on `docs/failures-stall` (its pull request to the lead).

**State for a resume, 2026-10-14 at 06:25 by `date`, at 76 percent of the context, at a task
end.** Merged since 05:15: the register's entries (pull request 125) and the roadmap lines (126:
open decisions 3, 7 and 9 answered, 4 with JH 9's design and his four answers, the repository
private, `docs/SPEC.md` last). Sent to the lead: the SPEC notes of the four capabilities this
session built (declared rules, the failures register, the review's allowance, the README).
**Open: pull request 129** (`feat/rule-person-present`, worktree
`D:\js-harness-worktrees\rule-person-present`, head `564d694`, holds `main` 3637ce5): JH 5's two
rules, `person-present` (96741db) and `questions-one-place` with the `AGENTS.md` sentence
"A decision is asked by the orchestrator, with the question tool" (00d531d; `AGENTS.md` at
1,492 of 1,500), each with its Codex record (0.98 and 0.95) and gentle-ai not due; the lead
merges it. The lead was told late that `AGENTS.md` changed, and asked whether its wording is his
(T8). **Next, on the lead's word only:** the rest of T16b's second part, one file a commit, each
told to its owner first: `bin/check.mjs` (`SENSOR_TIMEOUT_MS`, 20 minutes; `TOKEN_BUDGET`,
1,500), `bin/codex-review.mjs` (a review's timeout, 30 minutes), `bin/contract.mjs`
(`DEFAULT_TIMEOUT_MINUTES`, 30); the lead was asked which is free. Then the queue of "What T16b
builds", item 2. T1's paid measurement, T2 and T8 are his. The worktrees `register-2026-10-14`
(this branch, `docs/rule-hierarchy-state`) and `rules-review-readers` (merged) can be removed.

**2026-10-14, 05:15 by `date`: the README is merged (pull request 123, `main` 78cd45e) and the
register's entries are pull request 125** (`docs/register-2026-10-14`): seven new entries and
seven sightings, the lead's three items (a, b, c) among them, and the four owed controls that
pointed at T4, T5 and T6 moved to JH 12's document. **A correction to the block of 00:07 below:**
the session did not wait six hours in silence after a refusal. Its transcript (lines 16871 and
16883) shows the call made at 17:02 and its result, "User rejected tool use", written at 23:47,
with the lead's messages to it delivered only then: it was held by an unanswered permission
prompt for almost seven hours (entry `permission-prompt-unseen`). The "17:50" came from the
lead's question to him (`ca93c7ef`, line 953). Next: the roadmap lines of the lead's messages of
18:45 to 22:29 on the 13th, each read with `sessions --quote` first, and the roadmap's lines 510
and 533, which still point at this document's T10 and C9, now JH 15's.

**Resumed on 2026-10-14 at 03:54, when `main` held the gate in WSL (`"sensorsInWsl": true`),
by the lead's message and his lines 1647 and 2856 of the lead's transcript (2856, read with
`sessions --quote`: "Retomar con el gate viejo (Recomendada)", for the case the WSL gate had not
landed by 05:00; it landed first).** `main` (`8aa93c3`) was merged in at 04:20 (`8660763`).
Seven tasks left this document for the sessions named at them in `## Tasks`. Next: the README,
from its red test, as the queue below says.

**The README, written on 2026-10-14 at about 04:40.** Its test, put back at
`bin/readme.test.mjs`, was seen red again on the merged tree (1 passes, 3 fail on the missing
file); the dispatcher now lists 20 commands, `functions` added. `README.md` holds what the
harness is, `## Install`, `## Remove` and one section for each command with an example from a
run made for it on the merged tree: in a temporary home and a temporary git project
(`readme-runs-2/` in this session's scratchpad, made by `readme-journey.sh` there, which sets
`JS_HARNESS_HOME`, `HOME` and `USERPROFILE` to the temporary home and unsets
`CLAUDE_CONFIG_DIR` and `CODEX_HOME`), and the read-only ones in this repository. A fifth test
was added when the first draft failed: the contract template shown as an example opens with
`## Goal`, which the test read as a heading of the page, so the test now reads headings only
outside fenced blocks. Then 5 pass. **Found by the runs, for the lead:** after `uninstall
--global` the temporary home kept, beside the empty `.claude/` and `.codex/` and an empty
`AppData/Roaming/`, the folder `.codegraph/` with `telemetry-queue.jsonl` and `telemetry.json`,
which codegraph writes when `init` runs `codegraph init`; no manifest records them, so nothing
removes them. The README says so as it is. Next: the commit through the gate, gentle-ai's
assessment, the Codex review of the test, the pull request, its number to the lead.

**PAUSED on 2026-10-14 at about 01:15, by his order that everything stops but the faster check
(the orchestrator's transcript `ffe99ebf-72fb-48da-a79b-e7db21a20b3f`, line 1647, read with
`sessions --quote`: "si pero la idea es pausar todo precisamente para hacer unicamente esta
mejora implementarla y ahi si seguir con lo siguiente").** Resume only on the lead's word. At
the pause: a merge of `main` (`3f59bb2`) was waiting in the gate's line and was taken out before
it began, so nothing was merged; the README's red test is not in the worktree but in this
session's scratchpad as `readme.test.mjs.hold`, set aside so that a gate of this branch would
not run it; put it back at `bin/readme.test.mjs` on resume. After `uninstall --global` in an
empty temporary home, the two folders left are `.claude/` and `.codex/`, empty: the README says
so. Then the queue below, from the README.

**State for a resume, 2026-10-14 at 00:07 (`date`), at 91 percent before a compaction.** He
rejected a commit of this session at about 17:50 of the 13th (its message file was outside the
scratchpad); the session waited six hours in silence, and his answer is to go on with the queue
("Que siga con su cola (Recomendada)", the orchestrator's new transcript
`ca93c7ef-90b4-48f3-879e-c51742f78f64`, line 971) and his correction that a rejection is first
told to the lead (line 957: "pero no entiendo por que no me pasa la pregunta para aca como ya
habiamos quedado y cementado"). The queue, in order: this commit is the rejected one, redone
with its message in the scratchpad; then the README (below, item 1, with its runs); the register
entries the lead sent on the night of the 13th, with this silence as one more (a rejection or a
stop by him is told to the lead first); the roadmap lines in the lead's messages of 18:45 to
22:29 (decisions 3, 4 and 7, the private repository, `docs/SPEC.md` written last), each read
with `sessions --quote` first; the spec notes the lead asked for; JH 5's two rules
(`slice-c-for-rules-owner.md` in its scratchpad) into `bin/lib/rules-data.mjs` and `AGENTS.md`.
Not this session's any more: `docs/todo.md` (JH 5) and the design of an installed project's
own rules (JH 11, told that nothing of it existed here).

**State for a resume, written on 2026-10-13 at about 83 percent of this session's context,
before a compaction and before any of the work below is started.** The stop below is over:
he raised the plan and its week is back at 0 percent ("Listo ya tenemos la suscripcion de 20x
y ademas tenemos el uso reestablecido", the lead's transcript
`65318fd5-80e7-4bb8-92b5-06737140185b`, line 11381, read with `js-harness sessions --quote`),
so sub-agents are allowed again where a design needs readers. Pull request 97 is merged;
`main` is `ad7b37b` (pull requests 97 to 101, the lead's claim for what they moved: no command
asks a registry any more, a gate whose tree a gate already passed runs no sensor, `uninstall`
undoes exactly). The lead's order for this session, in this order, on the branch
`docs/readme` (worktree `D:/js-harness-worktrees/rules-review-readers`, cut from `ad7b37b`):
1. **The README**, this session's. His answer, read: "Una página y cada comando" (line 10979,
   tapped, to what the README holds). One page: what the harness is, how to install it, how
   to remove it leaving nothing; then each command with an example taken from a real run. With
   it a test or a check that holds the README's list of commands to the dispatcher's
   (`bin/js-harness.mjs`), so that it cannot go stale silently: that test is written first.
   Load the skill `cognitive-doc-design` before writing it. It is code and a document: gate,
   gentle-ai, Codex by the rule.
   **Started, and where it stopped:** the test is written and not committed,
   `bin/readme.test.mjs` in the worktree (four tests: the dispatcher's list read from
   `js-harness --help`; one `### js-harness <name>` section for each command under
   `## Commands`, in the same order and no other; a fenced example in each; `## Install`, then
   `## Remove`, then `## Commands`). Seen RED: 1 passes and 3 fail on "ENOENT … README.md".
   The dispatcher lists 19 commands (`bin/js-harness.mjs:9-27`): check, gate, init, install,
   sync, uninstall, status, update, upgrade, doctor, progress, contract, failures, rules,
   codex-review, remote, sessions, notify, resume. Next: write `README.md` at the root, each
   example from a run made for it (read a command's flags in its source before running it:
   `install`, `init`, `sync`, `uninstall`, `upgrade`, `remote start` and `notify` write, so
   their examples come from the practice folder or a temporary home, never from his); then
   the test green, the commit through the gate, the reviews.
   **Runs already made for the examples**, each saved whole with its command line and exit
   code in this session's scratchpad, folder `readme-runs/` (session
   `9265156a-3a86-4da5-80f9-aebe66cd887c`): in this repository `status` (exit 1, no pin),
   `update`, `progress`, `failures`, `rules`, `contract check`, `codex-review --plan`; and in a
   temporary home and a temporary git project made for it (`readme-runs/journey/`), in this
   order, all exit 0: `install`, `init`, `status`, `sync`, `uninstall`, `uninstall --global`.
   Their paths are long temporary ones and are shortened in the README to `~` and the project's
   folder, said once. To check before the page says "leaving nothing": after `uninstall
   --global` the temporary home still held 2 entries (`fd -H . readme-runs/journey/home`);
   read which and say it as it is. Not run yet: `check`, `gate`, `doctor`, `upgrade`, `remote`,
   `sessions`, `notify`, `resume`.
2. **The roadmap**: open decisions 9 and 10 closed with their lines, both read: 9 by line
   10979; 10 by line 11146, "Solo los comandos (Recomendada)" (JH 8 builds it). Also read, for
   the task `install-update.md` T6: line 11166, "Vale, sin versión fijada (Recomendada)", to
   what the commands answer where a project's file is hand-written with no version (JH 8
   builds it). And the register entries of that morning, each a claim of the lead to read in
   its relief file first: the app words a stop by another session as the user's refusal
   (relief line 565); the question tool holds the asker (560); a flake of the end hook of
   `evals/codex-isolation-probe.test.mjs` (561); messages between sessions held three hours
   (550).
3. **The design of an installed project's own rules** (T16f and item d of the proposal), with
   two readers, sent to the lead before a task exists: one of the four items with no design
   that his line 10519 puts inside the first version.
4. **The rest of T16b's second part**, after telling JH 5 and JH 8 the lines in `bin/check.mjs`,
   `bin/lib/manifest.mjs` and `bin/contract.mjs`.
T1's paid measurement stays his: its cost figure goes to the lead when it is reached. T2 and
T8 are his and are asked by the lead.

**Where this session stood earlier on 2026-10-13: stopped by the lead's call, at a task end.**
Pull requests 91, 93, 94 and 96 are merged; the last piece is the documents branch
`docs/shipped-defects`: the six defects in shipped behaviour that had no task, each read in
the code on `main` at `f98f478` and all true, written in the roadmap ("Next") with a task in
the feature document each belongs to (`install-update.md` T5 and T6, `sensors.md` T5,
`practice-project.md` T5) and two open decisions of his (9, the README; 10, what the package
ships). Left on it: the push, the pull request, its head to the lead. After it this session
starts nothing: what it holds next waits for the lead's word, because the plan's week is at
92 of his 95 percent. In order: the rest of T16b's second part (`bin/check.mjs`,
`bin/lib/manifest.mjs`, `bin/contract.mjs`, files the session-channel session is editing);
T1, whose paid measurement is his and waits for the week to reset; T2 and T8, his, asked by
the lead. The block below is the record of earlier that day.

**State on 2026-10-13, which replaces the two blocks of 2026-10-12 below (kept as the record
of that day; pull request 91 merged what they list).** On `feat/rules-review-readers`: the
two pieces are committed (`f2896a6`) and reviewed by both tools with nothing found, and the
branch holds `main` at `c6b7976`; pull request 93 merged them (`abe9295`). After it, by the
lead's call, this session closed F6 from a branch cut from `main`, `feat/codex-parity-close`
(three commits; its record is `odd/tasks/codex-parity.md`, Progress, 2026-10-13): left there
are the push, the pull request and its head to the lead; pull request 94 merged it
(`53568ac`) and F6 is closed on `main`. On `test/review-literals`, cut from that commit: a
script changed the 125 places where `bin/codex-review.test.mjs` stated the model or the
effort into reads of `REVIEW_MODEL` and `REVIEW_EFFORT` (two lines by hand: a string that
holds backticks, and a comment); a test in `bin/lib/rules-bindings.test.mjs`, written first
and seen failing on "gpt-6.1-sol is written in 67 lines", holds the file there. It is
commit `c561834`: the gate passed in its turn (05:20 to 05:29, the file run whole in its two
processes); gentle-ai, medium risk, review not due; the push check counts a commit of tests
as code and refused the push until Codex's record, so Codex ran with `--base 53568ac`, "the
patch is correct (confidence 0.93)", no finding, 187,810 input tokens (128,384 cached)
against an allowance of 300,000, recorded. Left on it: the push, the pull request, its head
to the lead. No sub-agent on this piece (the lead: the plan's week at 92 of his 95 percent).
Codex since this session's compaction: three reviews, 715,741 input tokens, each inside its
allowance (239,219 of 432,000; 288,712 of 620,400; 187,810 of 300,000). Before it was: the
literals of `bin/codex-review.test.mjs`, free since JH 8's pull request 92
split that file in two (the lead's claim; read both files first); the defects in shipped
behaviour with no task, of the lead's readers' list (relief file, lines 543 to 546), each read
in the code before it becomes a register entry or a task; and T1. T2 and T8 are
his and go to the lead by message; a question to him is asked by the lead, with the question
tool, never in this session's chat (his lines 8423 and 8528, the lead's claim, not read here).
The worktree `code-map-switch` and its branches `docs/on-demand` and `docs/owed-documents`
are to be removed now that pull request 91 is merged.

**State for a resume, written on 2026-10-12 at 91 percent of this session's context, before a
compaction.** Owed, documents only, on the branch `docs/owed-documents` (worktree
`code-map-switch`), each fact read by this session before it is written; the lines are of the
lead's transcript `65318fd5-80e7-4bb8-92b5-06737140185b` and are the lead's claims until read:
(a) `docs/ROADMAP.md`, open decision 4: the sentence "It ends in a question, so the how is not
settled" is replaced after his line 8315 ("listo entonces apliquemoslo asi"), a yes to the
direction and not to a design; (b) his order of a switch for the Codex review, line 8758;
(c) the rule about 1.0.0, the result of the lead's question 15; (d) F6 closes with 13 of 15
trials; (e) gentle-ai's reviewers' model; (f) the register of failures.
**Where that list stands after the compaction of 23:22 (the host's, read from the clock):**
(a), (b), (d) and (f) are written on that branch. For (d) the lines the lead first gave were
its own entries; it corrected them, and this session read his taps at 9794 ("Cerrar con 13
(Recomendada)") and 9776 ("Dejar y comprobar (Recomendada)") with `js-harness sessions
--quote`. The refusal of another stack is at `evals/suite.mjs:751` (the message of
`refusalOf`, `:329`), not at `:650`; the recorded versions are in `odd/tasks/codex-parity.md`
of its branch, line 1059; the machine now answers codex-cli 0.162.0, gentle-ai 4.1.1 and
engram 3.4.0. (f) added `memory-note-overwritten`, `merge-review-covers-main` (JH 8's
candidate) and `resume-names-wrong-maker` (JH 5's candidate), and one more sighting of
`chained-step-not-conditional`. (e) is not written: the roadmap names the reviewers' model
nowhere (`rg -n -i "reviewers" docs/ROADMAP.md` prints nothing, on a file that would hold the
word if it did), so his answer of line 9776 lives in the lead's relief file until a document
has a place for it. (c) was already on `main` when this session looked ("Release source" in
the roadmap, and `bin/lib/version.mjs:23-26` follows it); what it lacked was his words with
their line, 8986, read by this session and added. The branch merged `main` at `f43392d` in a
turn of the gate (`a53e705`); `main` moved after it (pull request 89) and moves once more with
JH 8's cut of the review command's git calls. Left: one last merge of `origin/main` after the
lead's notice that the cut is merged, with nothing running until then; the push; the pull
request. Done since the last entry:
his decision that a Codex review runs at medium is on `main` (pull request 87; this session
wrote the rule half as a patch, his tap read at line 8962). Two rules of his for every
session, to read at lines 8423 and 8528 before they are applied: a question to him goes
through the question tool, and it is the orchestrator that asks, not a work session.
Then, in this order. (1) The rest of the second part of T16b when `bin/codex-review.mjs` is free,
after JH 8's S1 and its cut of the command's git calls are on `main`: the review's model and
effort, and the reader of `codex-review-margin`. The lead says when the file is this
session's (its word of 2026-10-12, in the message that told of pull request 82 merged at
19:37, a claim); until then no new piece of code is
started and the session stays stopped at this task end, at 85 percent of its context: a
compaction comes before that piece. (2) T1, which takes section D of the proposal. T2 and T8
wait for him: before T2 the first item of "Ask me before" is asked, and the host facts of
"What the hosts allow" that T2 rests on are confirmed with a logging hook.
His, written here and in the lead's queue of his decisions (he is back since about 12:00 of
2026-10-12): what a Codex work session runs at; what the harness turns
on by default in a project that installs it; the paid measurement of documentation.
A working rule since 2026-10-12, by the lead's notice of his words: after a compaction this
session's first act is one line to the lead with its title, the hour, the share of its
context and what it resumes.
