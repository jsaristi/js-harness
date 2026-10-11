# Rule hierarchy

Locator: `odd/tasks/rule-hierarchy.md` · Engram mirror: `odd/rule-hierarchy/tasks` · Designed on
branch `docs/channel-and-rules-design` by the session `JH 4 · diseño canal y reglas` (2026-10-10),
together with `odd/tasks/session-channel.md`. Nothing is built here: the feature is built later,
in a session of its own, on a branch of its own, after the session channel (roadmap order, items
3 and 4).

## Goal
Every working rule of this project acts from one of three places — a check a command or a hook
runs, a line of `AGENTS.md`, or a protocol loaded on demand — so that no rule depends on a
session remembering it, here and in a project that only installs the harness.

## Why
Rules that live where nothing acts are repeated by Sebastián, session after session. He has
stated "my wording is the need, not the specification" three times (2026-10-08, 2026-10-09,
2026-10-10) and it still acts only through an agent's memory note. The line of `AGENTS.md` about a
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
  `bin/lib/reply.mjs`; new rows in `bin/check.mjs` (`failures`, `spec`, citations); a row in
  `bin/lib/stack.mjs` (`memory-rules`); `docs/SPEC.md` and `docs/FAILURES.md`; one eval task
  under `evals/tasks/`; steps in `scripts/practice*.mjs`; `docs/ROADMAP.md`.
- Out: the orchestrator skill, the notices, the roster, the opening of a session and the context
  hooks — they are `odd/tasks/session-channel.md`, built first. gentle-ai's managed block and
  the global `CLAUDE.md` — not this repository's text (F2); what they already say is not
  repeated. The gate lock (`feat/gate-lock`) — it is the check for the gate rules and is only
  pointed to.

## Constraints
- A check before a line, a line before a protocol — because a check costs no tokens and cannot
  be forgotten, and F5 measured what more text costs.
- `AGENTS.md` stays within `TOKEN_BUDGET` (1,500, `bin/check.mjs:19`); it stands at 1,499 in a
  CRLF checkout and 1,477 by committed blob — because every line is paid on every turn, a rule
  that enters makes another leave.
- A hook the harness installs acts only in a project that opted in, and is recorded in the
  manifest — because a user-level hook runs in every project of the machine, and what is written
  outside the repository must be undone exactly (`AGENTS.md`, "What good looks like").
- Zero dependencies, fixture-based tests — because every command runs on any machine with no
  install step.
- The wording of each line of `AGENTS.md`, and each thing shipped, passes by Sebastián in the
  build session — because he accepted the content and the direction, not the final text
  (`docs/ROADMAP.md`, "Rule hierarchy (planned)").
- Not built while the session channel is being built — because both edit `AGENTS.md`,
  `bin/lib/manifest.mjs` and `docs/ROADMAP.md`.

## Effort
high

## Ask me before
Installing the reply hook on this machine (a change on a machine). Whether `init` turns the reply
check on in a project by default (a product choice). The final wording of the rewritten
`AGENTS.md` and of the template. The spend of the honesty eval's trials. Deleting or rewriting the
memory notes of this project once their rules are placed. Any protocol beyond the six sections
named in "Protocols" (a new protocol).

## TDD
Mode: strict (source: user global config). Runner: `node --test`. Passive documents (`AGENTS.md`,
`docs/SPEC.md`, `docs/FAILURES.md`) have no RED of their own: the rows of `check` that validate
them are written test first.

## Delivery
Forecast: about 1,400 to 1,800 authored lines over six slices, each its own pull request against
`main`, merged in order (`stacked-to-main`, as every feature since `odd/tasks/project-init.md`).
Slices: 1 = T1; 2 = T2; 3 = T3 to T6; 4 = T7 to T9; 5 = T10; 6 = T11 to T14.

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
- the state is working or finished and the reply carries a block;
- the state is finished and no session to return to is named;
- the state is cut and the blocks are not the two numbered ones (until the resume hook of the
  session channel exists; then a cut carries the bare `/compact` alone).
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

**C2 The failures register** (`docs/FAILURES.md`, row `failures` of `check`). His words of
2026-10-10: a mistake is told with how it is solved now, how it does not happen again and how it
is integrated, and "a futuro comprobar que esto no vuelva a fallar". Each entry has an id, the
date, what happened, the owner (a feature document), and a state. An open entry names its owner;
a closed one names its proof: a test the gate runs, a step of the practice journey, or a count a
command prints. The row fails when an open entry has no owner, when a closed one has no proof,
or when the file a proof names does not exist. It is seeded with the eighteen entries of
"Failures of 2026-10-10" below. In an installed project the row acts only when the file exists.

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
nothing acts. The fix line says: place it with the protocol "recording a new rule", then delete
the note. Notes of type `user` and `reference` are machine facts and are left. The `SessionStart`
hook that `install` already writes (`js-harness doctor --hook`) shows the gap when it changes.
This is the first of the feature's two end numbers, as a command.

**C7 The honesty eval.** One task under `evals/tasks/` whose honest answer is "this could not be
verified", with a hidden grader, scored with and without the line "each claim is checked, assumed
or not known". If the score does not move, the line leaves `AGENTS.md` and the template and the
sensors stay. Its trials are spend he approves first.

**C8 Sub-agent models** (last, optional). His rule of 2026-10-10: Haiku only for sub-agents that
write code; designing, planning and verifying on Opus 5.5 at high effort at least. A `PreToolUse`
hook can read `model` and refuse one the project does not allow; it cannot read `effort`. Built
only after `odd/tasks/subagent-model-routing.md` closes and after the matcher's name is confirmed;
until then the rule is one line of the protocol "handing off".

Not built here, only pointed to: the gate lock of `feat/gate-lock` is the check for "never two
gates" and replaces three rules kept by hand (59 to 61 of the survey); the pre-push row already
checks the Codex record.

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
   decided, its cost said, and the work goes on.
3. His wording is the need, not the specification: an answer to a proposal of his says the need
   that was understood, what would be done differently from his words and why, and what it costs
   or is not known; only then it is recorded.
4. Every claim is one of three: checked (with its evidence), assumed, or not known. What another
   session, a sub-agent or he reports as done outside the session is a claim: one thing is
   checked before building on it.
5. One session, one feature; every decision is written to the roadmap or the feature document
   and committed in the same session.
6. A reply ends with one of four states; the reply check says how.
7. Review consent is pre-granted; the steps are in the protocol "running something that costs".
8. Every proposal is judged twice: as it is here, and as it works in a project that only uses
   the harness.
9. An index of one line: the protocols, by situation.

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
   the second is conditional on the first; an assessment is read before the next command; the
   review consent, a candidate being a commit or a slice, and the Codex review of each slice.
4. Recording a new rule: the five questions (did it happen; twice, or once at a cost; can a
   check do it; can an existing protocol be amended; what does it cost and what leaves); its
   level; the memory note deleted. A missing protocol is reported and proposed, never created.
5. Reporting a mistake: five parts (what happened; the fix now, checked or only sent; what stops
   it recurring; where it enters the harness, which feature and when; how it is proven later that
   it has not come back), and its entry in `docs/FAILURES.md`.
6. Handing off, to him, to a session or to a sub-agent: what was done, what was checked and how,
   what was not checked, what failed, what stays open; "not checked" and "failed" always filled;
   bad news first. A sub-agent that designs, plans or verifies runs on Opus 5.5 at high effort;
   Haiku only to write code.

Sections 1 to 4 are the four protocols the roadmap starts with. Sections 5 and 6 are shapes he
decided afterwards (relief file, lines 6, 125 and 145), so they are placed, not invented. A
seventh passes the five questions and is his.

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
9. Effort: the roadmap's "medium by default" against high on every sub-agent; settled by his
   models rule of 2026-10-10 and the result of `odd/tasks/subagent-model-routing.md`.
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
the session channel, SB the next slice of the session board, GL `feat/gate-lock`.

| # | What happened | Owner | Control | Proof |
|---|---|---|---|---|
| 1 | A yes was asked of him that was not his | RH | C1: a decision names its item | count of bare yes per session is 0 |
| 2 | A rule changed in a memory note did not reach open sessions | RH | C6; the rule in a check or a line | `doctor`: no `memory-rules` gap |
| 3 | A block he had not used was referred to by its hour | CH | no block for another session; a notice is a record | count of notices carried by his paste |
| 4 | An opening pasted with no line of his cost one more yes | CH | the opening is a file, his line is typed | count of a yes after a paste is 0 |
| 5 | A finished feature sat six hours: a phone session could not be reached | CH | the notice is a record the board reads | a practice step: a notice read with no message sent |
| 6 | The 73% mark and the cut near 70 | CH | the limit as room left; the pause at 85% | count of cuts proposed under 85% is 0 |
| 7 | A wait process could not be attributed from the board | SB | the board prints each wait with its session | a test of the board |
| 8 | Stopped tasks and archived sessions printed as live | SB | the roster; a stopped task reads as stopped | a test of the board |
| 9 | "No gate runs" said twice while one ran unseen | GL | a gate log, one line per run | the log; no such log exists on the branch yet |
| 10 | A commit of 2,250 lines passed the gate and could not be reviewed | GL | the size is read before the commit | row `codex-review` (debt) |
| 11 | An untracked folder made the review assessment fail | GL | the test run leaves no folder | a test |
| 12 | The lock left an empty folder on his disk | GL | repaired in `3659fb5` (its session's claim) | its test, not read here |
| 13 | A gate killed at its bound leaves its temp folders | GL | no owner task yet | — |
| 14 | An orchestrator's context fills in hours | CH | fewer wakes; measures | reliefs per day, from the record |
| 15 | After `main` is merged in, the assessment counts its commits | RH | P3: the base after a merge is the merge commit | a test of the push row's hint |
| 16 | A test started beside an eval batch | GL | every heavy run takes the lock | the gate log shows no overlap |
| 17 | Failure 4 again: the opening of this session, 28 minutes waiting | CH | as 4 | as 4 |
| 18 | Hours written in the relief file were guessed | CH | the command that appends a line stamps the clock | a test of that command |

## Tasks
- [x] T0 Design: the survey, the placement of the 83 rules, the checks, the outline of
  `AGENTS.md`, the protocols, the signals (route: inline, with three read-only sub-agents for
  the survey and the host documentation)
- [ ] T1 `docs/SPEC.md` from the capability survey, and the row `spec`
- [ ] T2 The reply check: `bin/lib/reply.mjs`, `bin/reply.mjs`, the `Stop` entries in the
  manifest for both hosts, the `reply` key of `harness.json`
- [ ] T3 `docs/FAILURES.md` seeded with the eighteen, and the row `failures`
- [ ] T4 Every command that writes outside the repository refuses a flag it does not know
- [ ] T5 The row `citations`, INFO
- [ ] T6 The row `memory-rules` of `doctor`
- [ ] T7 The skill `js-harness-protocols`, six sections, each opening with its incident
- [ ] T8 `AGENTS.md` rewritten within the budget, its wording passed by him
- [ ] T9 `agentsTemplate` gains the lines that hold in any project; whether `init` turns the
  reply check on is asked of him
- [ ] T10 The honesty eval: the task, its proof, the trials with and without the line
- [ ] T11 Every rule moved: the memory notes placed and, on his word, deleted; the remaining
  contradictions of the roadmap corrected
- [ ] T12 Practice journey: a step for the template's lines and one for the reply hook
- [ ] T13 The sub-agent model check, after `odd/tasks/subagent-model-routing.md` closes
- [ ] T14 The seven signals read and recorded; the roadmap's section replaced by a pointer

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
  `remote-control.md`; `learn.chatgpt.com/docs/hooks`. Not retrieved: the full settings
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

## Next step
The build waits for the session channel to be merged. Its session opens this document, confirms
with a logging hook the three host facts marked as claims in "What the hosts allow", and starts
at T1. Before T2 it asks Sebastián the first item of "Ask me before".
