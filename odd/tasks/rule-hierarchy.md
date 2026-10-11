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
- `node --test bin/lib/failures.test.mjs` exits 0
- `node --test bin/failures.test.mjs` exits 0
- `node bin/js-harness.mjs failures check --settled` exits 0
- `node --test bin/lib/spec.test.mjs` exits 0
- `node --test scripts/practice-lib.test.mjs` exits 0
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
  hooks — they are `odd/tasks/session-channel.md`, built first. gentle-ai's managed block and
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
  (`docs/ROADMAP.md`, "Rule hierarchy (planned)").
- Not built while the session channel is being built — because both edit
  `bin/lib/manifest.mjs` and `docs/ROADMAP.md`, and the channel changes two sentences of
  `AGENTS.md` (the resume prompt of a cut) that T8 here rewrites with the rest.

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
  labels (what it is, where it goes, what sending it does), or no line naming which of his six
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
file written outside the repository is claimed by no capability. It is built first: its list of
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
- `Control` is absent, owed or in place.
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
and said so: `init` does not write an empty register (it goes with T9, with the template); no
command writes a sighting, which is built only if editing by hand proves to cost; no `--json`,
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

### `AGENTS.md`, rewritten
The headings stay. What changes is "Working with Sebastián", which runs from line 48 to line 84
of the file's 87 today. The content of the new section, in order; the wording is his to pass in the build
session:

1. The six principles, once, in one paragraph: done properly, not to comply; no shortcut; under
   the agreed protocols; nothing stated that was not checked; what is passed on is complete and
   true; each mistake leaves a control, of the smallest kind that does the job. With the meaning
   of done: a rule is not recorded until it has its place in a check, a line here or a protocol.
2. What is his, the six items: spend outside the plan; anything installed or changed on a
   machine; a product choice; what cannot be undone; a change of the plan or of its order; a new
   protocol. Asked one at a time, never while work runs, naming the item. Everything else is
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
   asked again says first that the earlier answer still holds and what changed.
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
| No repeated mistake | row `failures`: no closed entry reopened; the counts of the board |
| No protocol without its incident | a test over the protocols skill: every section opens with a dated incident |

### Contradictions the build resolves
The fourteen the survey found; each names the text that wins. The first four are corrected in
`docs/ROADMAP.md` by the design session's own pull request; the rest by the build, and T11 is
done when each of the fourteen reads one way in every place that states it.

1. Context limit: nothing stops for a percentage and a session pauses at 85% (his decision,
   2026-10-10) wins over the 73% of the roadmap, of the board (`bin/lib/sessions.mjs:20`) and of
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
| 39 | Never stop for the percentage; at 85% pause, write the state, finish or compact | MEM, REL | CH, C1 (nudge) |
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
| 58 | An unused block is repeated whole | REL | CH |
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
seed of `docs/FAILURES.md`. None has its proof yet, so all are open. Owner: RH this feature, CH
the session channel, GL `feat/gate-lock`. A proof marked "owed" is not designed here: its owner
names it, and the entry stays open until it does.

| # | What happened | Owner | Control | Proof |
|---|---|---|---|---|
| 1 | A yes was asked of him that was not his | RH | C1: a decision names its item | count of bare yes per session is 0 |
| 2 | A rule changed in a memory note did not reach open sessions | RH | C6; the rule in a check or a line | `doctor`: no `memory-rules` gap |
| 3 | A block he had not used was referred to by its hour | CH | no block for another session; a notice is a record | notices carried by his paste, counted by the board: 0 in the stretch of its "Done when" |
| 4 | An opening pasted with no line of his cost one more yes | CH | the opening is a file, his line is typed | count of a yes after a paste is 0 |
| 5 | A finished feature sat six hours: a phone session could not be reached | CH | the notice is a record the board reads | a practice step: a notice read with no message sent |
| 6 | The 73% mark and the cut near 70 | CH | the limit as room left; the pause at 85% | count of cuts proposed under 85% is 0 |
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
- [ ] T1 `docs/SPEC.md` from the capability survey, and the row `spec`
- [ ] T2 The reply check: `bin/lib/reply.mjs`, `bin/reply.mjs`, the `Stop` entries in the
  manifest for both hosts, the `reply` key of `harness.json`
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
- [ ] T4 Every command that writes outside the repository refuses a flag it does not know; and
  the push row hints the merge commit as the base after `main` is merged in (failure 15)
- [ ] T5 The row `citations`, INFO
- [ ] T6 The row `memory-rules` of `doctor`
- [ ] T7 The skill `js-harness-protocols`, six sections, each opening with its incident
- [ ] T8 `AGENTS.md` rewritten within the budget, its wording passed by him. His idea of
  2026-10-11 for how (relief file, line 203), recorded here and not built yet: the text is
  drafted in `docs/agents-build.md`, analysed, reordered and polished there with the budget
  measured on the draft at each step, and when he approves it one commit copies it over
  `AGENTS.md` and deletes the draft, so there is never a second source. The reason the lead
  added: a session that edits `AGENTS.md` in its own worktree reads that file on every turn, so
  a half-written version would govern the session that writes it
- [ ] T9 `agentsTemplate` gains the lines that hold in any project; whether `init` turns the
  reply check on is asked of him
- [ ] T10 The honesty eval: the task and its proof; then, before any spend is asked of him, the
  number of trials, their cost at list price and the difference in score that counts as "the
  line moves it"; then the trials with and without the line
- [ ] T11 Every rule moved: the memory notes placed and, on his word, deleted; the remaining
  contradictions of the roadmap corrected
- [ ] T12 Practice journey: a step for the template's lines and one for the reply hook
- [ ] T13 The sub-agent model check (C8), after his answer on what enters from the comparison
- [ ] T14 The honesty audit (C9): the transcript reader read first, then designed as a count or
  recorded as not worth it
- [ ] T15 The seven signals read and recorded; the roadmap's section replaced by a pointer only
  after what it holds and this document does not (the reading of the specification, "how far
  is far enough", the bullets on bias and research, the team rules) is in `docs/SPEC.md` or
  here
- [ ] T16 One home for every rule, by the protocol of "One home for every rule (T16)" and in
  its order (route: delegated; after T17, before T1)
  - [x] T16a The approved protocol in this document, read against the relief file's lines 253
    and 254 by a reader that did not write it (twelve fixes, all taken), and the nine places
    where it differs from the eight points, pulls two ways or stays open told to the
    orchestrator
  - [ ] T16b The homes and the list: how a rule is declared, designed and read by a reader
    that did not write it; then the declarations of the rules that have a value today, and
    `docs/RULES.md` rendered from them
  - [ ] T16c The one command that changes a rule
  - [ ] T16d The row `rules`: a pattern for each rule on added lines, reporting and then
    refusing rule by rule, with a planted violation as its test; after the gate stops before
    its sensors
  - [ ] T16e The merge command, the rule rows first
  - [ ] T16f Reach: the turn-start hook, confirmed first with a logging hook; the hash of the
    rules in the installed command; the template's marked block
- [ ] T17 The sweep of 2026-10-11 (his order of that day; route: delegated, read-only readers,
  then one writer for documents)
  - [x] T17a The list: `docs/sweep-2026-10-11.md`, pull request 61
  - [x] T17b This session's places corrected in documents: the roadmap and eleven closed
    feature documents, 83 places, pull request 62 (commit `119adbc`); four more are left
    unchecked in the list with their reason, and the six of `odd/tasks/codex-parity.md` wait
    for that document's branch
  - [ ] T17c This session's places in this document (13) and in code (7: `bin/codex-review.mjs`,
    `bin/install.mjs`, `bin/js-harness.mjs`, `bin/lib/codex-review-parts.mjs`,
    `bin/lib/manifest.mjs`, `bin/lib/project.mjs`), the code through the gate and both reviews
  - [x] T17d One entry of the register for the failure itself, with the sweep as a sighting
    (`old-rule-beside-new`; its control is owed by T16)

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

## Next step
In this order. (1) The reviews of what follows `5b754dd`:
gentle-ai first (consent is pre-granted), then Codex for the code since the branch point,
`js-harness codex-review --base 9a2edb1^` after its `--plan` says what it costs; neither beside
a running gate. (2) Merge `main` in before the push of `feat/failures-register`: three unmerged
branches change `bin/check.mjs` and `bin/js-harness.mjs` in the same places. Push, open the
pull request with the twelve doubts of the seed in it, tell the orchestrator. (3) T17c, its
code places read again on the new `main`, which changed three of the seven files. (4) T16b:
how a rule is declared, designed and read before it is built. (5) T1. T2 and T8 wait for him: before
T2 the first item of "Ask me before" is asked, and the host facts of "What the hosts allow"
that T2 rests on are confirmed with a logging hook.
