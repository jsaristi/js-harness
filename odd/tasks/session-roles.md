# session-roles — a role of its own for each session, beyond its opening (JH SR, design only)

## State
Design only, no code. Version 4, 2026-11-17, written by JH 213, a senior session opened fresh for it (his answer
to question 328, L16). It answers each of the 21 findings of the third read (L17), redoes L4 finding by finding
(L18) and carries his answers: the numbered work sessions get a card (316, L8); the senior does one task at a
time, in a queue, only for what needs more than Opus (324, L11, L13); the senior closes when its task ends and a
new one opens (329, L14, which replaces the tap A of 317 on how a senior's task ends); "How sessions run" is for
work sessions only (330, L15). THE CONFIRMING READ RAN AND DID NOT CONFIRM (L20, by JH 214): read bdef7ebc found
21 findings, four of them high between the two readers, 20 taken and one not; none is corrected, and version 4
stands as read. Correcting them and any further read are his to decide, with the forecast of L20. The
design is not approved and nothing is built. The rule changes his answers 324, 329 and 330 ask for are the
lead's, on a `rule/` branch (T5); none is written here. Branch `docs/session-roles`, cut from main at 035a2dcc,
draft PR 899. Versions 1 to 3 and their three reads are L4 to L6; the stop of the first attempt at version 4 is
L10 to L12.

## Goal
Each session that holds a role (the lead, the Plan, the senior, a work session) is given what its role is, from
one text the harness owns: after every compaction and every clear, at the first turn or tool call where the
harness knows its title, and whenever it asks. What a new session knows before the harness knows its title is
its brief or its opening, as today; the design says where that leaves a gap and does not claim to close it.

## Why
His words (Spec 1): each session must know its role and its function, with a specific role and not only an opening
prompt, so that it works better. The record agrees (Depth pass item 4): after a compaction the harness tells a
senior nothing of what it is, and told this senior to work as a work session.

## Done when
- `js-harness contract check odd/tasks/session-roles.md` exits 0
- `npm run check` exits 0
- each double review's read id and every finding's answer are in the Log

## In scope / Out of scope
- In: this document; one Log line in `odd/tasks/plan-orchestrator.md`; a draft docs PR; the Spanish page if the
  lead puts the proposal to him.
- Out: every file under `bin/` (design only). At the build the board (`js-harness sessions`) says who holds
  `bin/lib/sessions.mjs`, `bin/resume.mjs`, `bin/lib/inbox.mjs`, `bin/lib/manifest.mjs` and
  `bin/lib/lead-protocols.mjs` that day.
- Out: what a role may do. A card adds no duty and no permission.
- Out: the guard. No start brief, no guarded constant and no title check changes here.

## Constraints
- One home (`AGENTS.md`): a role's text is one constant in code; every other text renders it or names it and does
  not repeat it — because a second copy is how the 73 percent mark outlived three changes
  (`js-harness-protocols`, section 4).
- A card line cites its source, which exists today (a rule by `rule:<id>`, a decision of a feature document, or a
  line of the skill), and adds no duty. A line with no source is not in a card until a rule says it, and a rule
  is his (`rule:owner-decisions`).
- A stored opening is a session's task and state, written by a session and replaced often; a role is the same for
  every session that holds it — because a role kept inside an opening goes stale with it.
- What other texts and checks rest on stays as it is: `js-harness sessions --opening` (its output, its exits and
  its recorded reading: `bin/sessions.mjs:85-88`, `:688-711`; `bin/resume.mjs:376-391`), and the senior's wait
  brief, which the guard compares as a whole and the lead types (`bin/lib/session-title-guard.mjs:102`;
  `bin/lib/lead-protocols.mjs:12`, `:43`).
- The orchestrator skill is read by work sessions too (`bin/lib/manifest.mjs:115`, `:120`, `:243`).
- A title can be missing or off its shape: the resume block may know none (`bin/resume.mjs:884-887`), a lead has
  run under a drifted title, and a rename is not checked (`odd/tasks/senior-orchestrator.md`, D13, D17).
- The host is not ours: whether a skill or an output style survives a compaction is not checked, and
  `set_session_output_style` asks him with a card and is refused in an unattended session.
- A text every session reads costs tokens each time, on every model, Fable included — so a card has a budget a
  test holds and is given once a session and once after each compaction, never on every call.
- A rule's sentence stays in its home: `js-harness rules check` reads the home's own text for each phrase and
  fails when it is gone (read 3's citation of `bin/lib/rules-check.mjs:191-198`), so a design that moves a
  sentence moves a rule of his. Version 4 moves none.
- His answer to question 307 moves his questions to the Plan and its typed line is owed: a text that says who
  puts a question to him goes stale that day, so no card says it.
- A hook has seconds, not a search: two after a tool call, five at a turn's start
  (`bin/lib/hook-entries.mjs:44-48`, `:172-178`), and a failure there is silent (`|| exit 0`, `:37`, `:164`).

## Ask me before
Nothing in this design waits for a new answer of his except its approval. The three questions of version 3 are
answered: 316 (L8), 317 by his typed words of 324 and 329 (L13, L14), 318 by his typed words of 330 (L15). Each
of those changes a rule of his or his file, so the lead writes it on a `rule/` branch with his words and their
date (T5); a card carries a line only once its rule exists.
Not his, said with its cost: the reads of versions 1 to 3 measured 1,397,745, 2,143,025 and 3,445,474 Claude
tokens and 477,121, 472,024 and 767,513 of Codex; the command states 1.1M and 0.9M. A read of version 4 is
forecast from those three, 1.4 to 3.4M Claude and 0.5 to 0.8M Codex: an estimate.

## Depth pass
- 1. Method: an organization gives each post a job description apart from the day's assignment: its purpose, its
  duties, what it may not do, whom it answers to and whom it hands work to, kept as one controlled text and read
  again when a person takes the post. For an agent the same text is the part of its prompt that is re-read at
  every boundary where its memory is cut. Its standard: one text a role, short enough to be read whole, owned in
  one place, delivered by a path that runs by itself at each boundary, and held by a check where a check can hold
  it. The smallest change that meets it reuses what exists (searched by one read-only explorer, 42 tool calls,
  and by this session: codegraph for `roleOfTitle`, `resumeLines`, `orchestratorSkillContent`; grep for
  `leadTitle|seniorTitle|isLeadTitle|roleOfTitle` in `bin`, for `agent type|--agent|top-level session` in
  `odd/tasks`, for `set_session_output_style` in `bin` and `odd/tasks`; `ls bin/lib | grep -i role`, no file):
  two hooks already speak to a session by themselves and already know its title, the one after a tool call, which
  resolves the role for the inbox, and the one after a compaction. Weighed and left out, each for what rests on
  it: the card inside `sessions --opening`, inside the senior's wait brief, at the head of the skill, and from the
  resume hook on a plain `startup`, when a title is usually not set yet (`bin/resume.mjs:840`). Weighed again for version 4 and used as a
  second carrier: the turn's start, where `rules --hook` already runs (The design).
- 2. Raw material (the explorer's and the two reads' citations; this session checked `bin/resume.mjs:874` and
  `:905`, `bin/lib/lead-prompt.mjs:4`, `bin/lib/lead-protocols.mjs:12-16`, `bin/lib/manifest.mjs:134` and
  `:154-156`; the rest are theirs, not rechecked):
  - His words: `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 5054`.
  - Titles hold three roles: `bin/lib/sessions.mjs:1248-1261` (`orchestrator`, `senior`, and `work` for a
    number); a Plan's title holds none; no list of the roles is exported; D17 of `odd/tasks/senior-orchestrator.md` gives `roleOfTitle` 42 callers; counted on 2026-11-17 by
    the explorer of L12 (its command is item 6 of `session-roles-v4-facts.md`; not run again): 31 call lines in
    16 modules, tests apart.
  - At a start. The lead: `LEAD_OPENING_PROMPT`, "Follow the js-harness-orchestrator skill"
    (`bin/lib/lead-prompt.mjs:4`). The senior: `SENIOR_WAIT_BRIEF`, "Run nothing", its first turn being on the
    lead's model (`bin/lib/lead-protocols.mjs:9-16`); `js-harness sessions start` still takes any brief for a
    senior (`bin/sessions-background.mjs:209-257`; T7 of `senior-orchestrator.md` is open). Any session: its
    stored opening, when the first message `notify --opening` prints is sent.
  - After a compaction. `resumeLines` speaks only on a compaction or a clear (`bin/resume.mjs:874`) and has one
    role branch, the orchestrator's (`:905`): the lead gets its relief file's path and "Read its last lines",
    though its charter is at that file's head (`bin/lib/manifest.mjs:155`); the block names neither the skill nor
    the charter. Every other session gets the work session's mode line (`:943`).
  - After a tool call. `resume --pause` runs on PostToolUse, adds context to the session (this session read its
    pause notice that way on 2026-11-16) and resolves the session's title and role for the inbox
    (`bin/lib/inbox.mjs:171`). What it has said it keeps in a state file of the session, not in the transcript
    (`bin/lib/pause.mjs:347-371`), and it has two seconds (`bin/lib/hook-entries.mjs:44-48`).
  - The other hooks (`bin/lib/hook-entries.mjs`): `resume --hook` and `backup --session-start` on SessionStart;
    `rules --hook` on SessionStart, UserPromptSubmit and SubagentStart, with no title logic; `doctor --hook` on
    SessionStart (`:8-13`), which prints a message for him and gives the model no context; and the pause command
    again on a failed WebFetch (`:55-60`), which does give the model context, the web notice, and gives it to a
    sub-agent too (`bin/resume.mjs:1009-1013`, `:1038`).
  - The senior's limits are decisions D1 to D14 of `odd/tasks/senior-orchestrator.md:171-232` and guard refusals:
    no text tells the senior itself. What the lead's skill says of it: "it reports through the same notices as any
    work session", and that its sub-agents name the work sessions' model and never inherit its own
    (`bin/lib/lead-protocols.mjs:43`); a work session ends with `closed` (`bin/lib/manifest.mjs:254`).
  - The skill says "Two kinds of session" (`bin/lib/manifest.mjs:120`); `CLAUDE.md` gives every session one
    feature and its branch.
  - Agent types: `.claude/agents/js-harness-writer.md` serves sub-agents; `start_session` takes no agent type.
  - The output style is one for every session of a clone (`bin/lib/project-apply.mjs:12-35`).
- 3. The bar:
  spec 1: `node --test bin/resume.test.mjs`: none, new behaviour (after a compaction a senior's resume block carries no role text and a lead's names neither its skill nor its charter; no test asks for either)
- 4. Refutation: the request fails if a session already gets its role back where its memory is cut. Read now, in
  this session's own transcript (285fc2c7-d588-4b0c-bef5-ded03fe6b04c under the worktree's project folder, lines
  1649 and 1669): the block the hook gave this senior after the compaction of 2026-11-16 00:57 local names its
  opening and its feature document and says "Mode of the next open task: T10 (kind: verify): the session and
  every sub-agent on claude-opus-5-5 at medium". This session is the senior, on `rule:senior-model` at high: the hook read it as a work session. It did so at each of its three compactions: the blocks at lines 882, 1649
  and 2783 all name claude-opus-5-5 at medium (the explorer of L12, item 11; 882 and 2783 not reread here). And one cost already paid for a role nobody had written down: on 2026-11-15
  this senior ended its task with a `closed` notice (the channel's record, 2026-11-16T03:44Z), which is what the
  one sentence the harness has on a senior's notices told it to do; the lead's correction, "you are the standing senior", came by message. His answer to question 329 (L14) has since made `closed` the
  right end of a senior's task: the event still shows a session acting on a role nobody had written down, and
  no longer shows a wrong act. What this does not show: that a role text would have prevented it, or that a lead or
  a Plan loses its role the same way; one session, one day.
  Verdict: supports
- 5. Request: "Give each role one short text the harness owns, apart from the opening: who the session is, what
  it does, what it never does, whom it hands work to, where questions go, and its limits. Have the harness hand
  it over by itself, once when the session starts working and again after each compaction. Hold with a check
  what a check can hold, and say what stays unmeasured."
  Adds: none

## Specs
1. "cada sesion por ejemplo Orquestador, Orquestador Plan y Senior deben saber cual es su rol y su funcion osea
   cada uno debe no solo tener un prompt inicial sino un rol especifico que haga que funcione mejor"
   (2026-11-16T18:58Z, 13:58 in his local time; 699d7c29 line 5054, the second half of his typed answer to
   question 315; whole in Log L17 of `odd/tasks/plan-orchestrator.md`)

## The design
Version 4 adds as little as it can: four constants, one small state file a session, and a few lines in three
commands that already speak to a session. Nothing moves out of the skill, no hook entry is added, the guard and
`roleOfTitle`'s results are not touched. Where a sentence below rests on code, the line was read by this session
on 2026-11-17 at head 74b10f43 unless it says "the explorer's" (`session-roles-v4-facts.md`, checked by nobody
else) or "not known".
- **A role card.** One constant a role, in one new module, `bin/lib/role-cards.mjs`, beside its test. The module
  imports nothing: what it needs (a role's name, a rule's value) is passed in by whoever prints the card. Six
  parts, always in this order: who you are; what you do; what you never do; whom you hand work to and who sends
  you work; where his questions go; your limits. A budget of 1,500 characters a card is a constant the test reads.
- **A card names rules and holds none of their text.** A card is new text in its own words. Where a rule
  governs a part, the card names it, `rule:<id>`, and stops. So every sentence of the skill stays where it is:
  `bin/lib/manifest.mjs:154-156` stays the home of `rule:lead-charter` and `:249` of `rule:questions-one-place`
  (the phrases and their homes: read 3's citation of `bin/lib/rules-data.mjs:319-328` and `:453-461`), and
  `bin/lib/lead-protocols.mjs` gains no import. Nothing refuses a rule's phrases copied outside their home today
  (the explorer's, item 4), so the cards' test does it for the cards: it reads every rule's phrases and fails on
  a card that holds one, and it runs `js-harness rules check` clean. What this costs, said: a card and the skill
  speak of the same role in two texts. One home holds for a rule's sentence and for a value; a card's own
  sentence has its home in the card and its source in this Log, and the skill is not rewritten to render it.
- **His questions, in every card**, is one line: "His questions: as `rule:questions-one-place` says." It does
  not say who puts them to him, because his answer to question 307 moves that to the Plan and his typed line is
  still owed (`odd/tasks/plan-orchestrator.md`, its Log on question 307; read 3's citation of `:480-483`). The
  test holds that line equal in the four cards, so a card cannot go stale when the rule changes.
- **Which title gets which card.** `bin/lib/sessions.mjs` exports one frozen list of the role names
  `roleOfTitle` returns (`orchestrator`, `senior`, `work`: `:1248-1261`, the explorer's), with no caller's result
  changed; the cards' test fails for a name on it with no card. A Plan's title holds no role today, so the cards
  module has one pattern of its own for `<code> PLAN · …`, used only to pick a card: it gives no role to the
  inbox, the guard or the board. When T5 of `plan-orchestrator.md` makes `PLAN` a role, the list gains it and the
  pattern leaves. Every other title gets no card and one line that names `js-harness sessions --role`: a title
  not known, one off its shape, and a relieved lead's (`<code> ORQ relevada`), which holds no role by design.
  Declined, against version 3: a card for a lead whose title drifted. Its title holds no role for the inbox or
  the guard either, and a card would tell it otherwise; the fix for a drifted title is the rename
  `rule:session-title` asks for.
- **The senior's card, drafted, under 900 characters before its two values are filled.** It is given only where
  the project declares `rule:senior-model`, which is how the lead's senior section opens
  (`bin/lib/lead-protocols.mjs:43`); the two rules are of this repository only (the explorer's, item 5). The
  printer fills `{model}` and `{effort}` from `ruleHere` (`bin/lib/rules.mjs:399`).
  > You are a senior session of this project (`<code> SR`), on {model} at {effort} (`rule:senior-model`,
  > `rule:senior-effort`).
  > What you do: the task the lead gave you, one the lead judged to need more intelligence or complexity than a
  > work session's model gives, such as a design, an audit or the strongest reader of a proposal.
  > What you never do: start a session; let a sub-agent inherit your model: each names the model
  > `rule:session-model` gives its work.
  > Whom you hand work to: the lead, by `js-harness notify --to orchestrator`. The lead sends you your task.
  > His questions: as `rule:questions-one-place` says.
  > Your limits: at most one senior is alive, since the weekly meter of your model is not read per call. Your
  > first turn ran on the lead's model, so it carried no task.
  Sources, each a decision of `odd/tasks/senior-orchestrator.md` (the explorer's, item 14) or a line of the
  skill: the lead's judgment is the condition, D5; the three examples, as `bin/lib/lead-protocols.mjs:43` gives
  them (read 3, Claude 5); starts no session, D3; the sub-agents' model, `:43`; reports to the lead, D6; the lead
  sends the task, D3 and D6, which name the sender and forbid no one, so the card forbids no one; one alive and
  why, D4; the first turn, D11. No line says "you ask him nothing": the rule's own sentence is conditional.
  Two lines wait for the rule the lead writes from his words (T5) and enter the card with it, not before:
  "One task at a time: the next one waits in the lead's queue" (324, L13) and "When your task is done you close,
  `notify --kind closed`; the next task opens a new senior" (329, L14). With them "long-lived" in D3 and "one
  senior session stands beside the work sessions" in `:43` change; both are in T5, neither is changed here.
- **The other cards, in outline**, written at the build under the same budget and the same test:
  - The lead: who it is; that it leads the project's sessions and what it never does, in the card's words, with
    `rule:lead-charter` and `rule:away-autonomy` named for what it may do alone; that its long text is the lead
    part of the skill `js-harness-orchestrator` and the charter at the head of its relief file.
  - The Plan: that it plans and does not execute, hands plans to the lead alone and reads no code. Its sources
    are in this Log (`odd/tasks/plan-orchestrator.md`, "The role", its Log L15 and L16), not in the card: that
    document does not ship to another project.
  - A work session (316): owns one feature, its document, its branch and its PR; reports to the lead by
    `js-harness notify --to orchestrator`; its long text is the work session's part of the same skill.
- **Delivery: one state file, three carriers.** The state is `<home>/.js-harness/channel/role-card/<session
  id>.json`, beside the pause's and the rules' own per-session files (`bin/lib/pause.mjs:347-351`;
  `bin/lib/rules-reach.mjs:191`), holding `{ role, stretch, compaction }`. A card is owed while no file
  `<session id>.<stretch>.told` exists beside it. To give a card is to create that file with the exclusive flag
  and print only if the creation succeeded, so two calls at once give one card. To owe it again is to add one to
  `stretch`. Version 3's "finds its own earlier line in the transcript, as the pause notice is found" was false:
  the pause keeps `armed` and `compaction` in its state file (`bin/lib/pause.mjs:351-362`) and no hook searches
  the transcript.

  | When | Carrier | The title comes from | What it does |
  |---|---|---|---|
  | After a compaction or a clear | the resume block, `resumeLines` (`bin/resume.mjs:872-874`) | `titleOf` (`:881`) | First adds one to `stretch` and writes `compaction: "pending"`. Then, where the title gets a card, prints it and creates the marker. A block that fails, or knows no title, leaves the card owed. |
  | At a turn's start | `rules --hook` on UserPromptSubmit (`bin/lib/hook-entries.mjs:168-178`, five seconds) | the title the hook after a tool call keeps for the inbox (`bin/lib/inbox.mjs:160-171`); else the app's record (`appSessions`, `bin/lib/app-record.mjs:81-104`, the explorer's) | Where a card is owed and the title gets one: prints it and creates the marker. |
  | After a tool call | `resume --pause`, the session's own branch (`bin/resume.mjs:1011`, two seconds) | the same kept title (`bin/lib/inbox.mjs:170-171`) | The same; and it reads the boundary below. |

  - No new hook entry: `rules --hook` already runs on UserPromptSubmit, reads the session's id and stays quiet
    for a sub-agent's own events (`bin/lib/rules-reach.mjs:173-180`). Its wrapper prints one text today
    (`:268-270`); joining the card to it is a code change of T3, and the card is said even on a turn where the
    rules have nothing to say or the folder is no git checkout. `bin/lib/rules-reach.mjs` or the new module then
    prints a hook message, so it is registered where `bin/lib/rules-sources.test.mjs` asks (the explorer's,
    item 4).
  - A role that changes. The state's `role` differs from the title's: a title that now gets another card is
    given that card; a title that now gets none, where `role` was set, is told once "Your title no longer holds
    the role <role>" and `role` is cleared. That is the relieved lead (read 3, Claude 8).
  - A compaction whose resume block never ran. The hook after a tool call already reads the last compaction
    boundary in the transcript's end (`end.compaction`, `bin/lib/pause.mjs:349`, `:358`). Where the state holds
    `"pending"` it stores that value and owes nothing; where the value differs from the stored one, it adds one
    to `stretch`; where the end holds no boundary (null), it changes nothing. The boundary is written after the
    resume hook runs (the explorer's, items 3 and 11), which is why the block writes `"pending"` and not a value.
  - A clear gives a new session id (not known: read in T3's first step), so no state: the block gives the card
    and the marker, and the next turn's start and tool call give nothing.
- **What is guaranteed, and what is not.** Guaranteed, by tests: the card is in the resume block after a
  compaction or a clear whose title is known; and it is given once at the first turn's start or tool call at
  which the title is known, whichever comes first. Not known, and T3's first step: whether a title is known at a
  new session's first UserPromptSubmit. The resume hook's own code treats a title as usually not set at a plain
  start (version 3's reading of `bin/resume.mjs:840`); a session started with `start_session` and a title may
  have it in the app's record by then, and nobody has looked. Until that is measured the design claims this and
  no more: a session whose title is not known at its first turn gets its card after the first tool call that
  follows the title, and one that answers that turn in text alone gets none on it. Its brief or opening is what
  it has before that, as today. The only hook that runs before a session's first act is the guard
  (PreToolUse), and the guard is out of scope here; read 3's Codex 1 stands as a limit of this design, said in
  the Goal, not as something it fixes.
- **The resume block, by role.** The role the card resolved picks the whole block, with `roleOfTitle` as it is:
  - A lead's: as today (`bin/resume.mjs:905-909`), with its card and two more lines: the skill to load again,
    and that its charter is at the head of the relief file (`bin/lib/manifest.mjs:155`).
  - A senior's: a work session's block, since it holds a feature document and a task, with its card and with
    the mode line read from the senior's home (`SENIOR_HOME`, `bin/lib/model-shape.mjs:15`). Today every title
    that is not a lead's gets `nextModeLines` (`bin/resume.mjs:943`, `:976-985`), which reads the work sessions'
    home (the explorer's, item 2): that is the wrong model this senior was told three times.
  - A Plan's: its card, its opening and the questions. No search for a feature document and no mode line: it
    owns no feature and reads no code. Where a Plan keeps its state is `plan-orchestrator.md`'s to say and was
    not read here (not known); the block names that place once that document's T5 gives one.
  - A work session's: as today, with its card. A title with no card: as today, with the one line.
- **To read a card again.** `js-harness sessions --role <title>` prints the card for that title: exit 0 with the
  card; 1 for a title that gets none; 2 for a call it cannot read (no title, or an option it does not take
  with). It records no reading and writes no state.
- **The Plan's stored opening.** By the lead's word its phase 0 opening carries a role section
  (`odd/tasks/plan-orchestrator.md`, its Log L17). That is a second copy of the Plan's role, known and owned by
  the lead, until T4 shows the Plan's card delivered; then the lead stores that opening again without the
  section (T4's last step).
- **What a check holds, and what stays unmeasured.** Held by tests: every role name has a card; six parts; the
  budget; no rule's phrase in a card; the questions line; `rules check` clean; the senior's card only where its
  rule is declared, with its values filled; the state table row by row (owed, given, two calls at once, a role
  that changes, pending, a boundary that differs, no boundary); the block for each role on a compaction and on
  a clear, with the senior's mode line; the three exits. Not measured: whether a session that has read its card
  works better. Three wrong blocks in one session are the whole record, so no count over the next tasks could
  tell the card from chance; T4 reads delivery, and says so.
- **Not proposed, and why.** Moving the skill's sentences into the constants: it moves the homes of two of his
  rules (read 3, Claude 1 and Codex 5). A new hook entry at the turn's start: five files and a counted limit
  (the explorer's, item 7) for what an entry that already runs there can carry. A card from the guard, before
  the first tool call: the guard is out of scope. A refusal of a senior's `closed` notice: his answer to 329
  makes `closed` the right end. A reminder on every tool call: tokens on each call for a text lost only where
  memory is cut. An output style a role: it needs his tap at each start, is refused when he is away, replaces
  the project's one style, and its surviving a compaction is not checked. An agent type for a top-level session:
  `start_session` takes none. A role section inside each stored opening: it goes stale with the opening.
- **Cost.** To read: a card of 1,500 characters is about 400 tokens, once a session and once after each
  compaction or clear; an estimate. To run: one small state file read after each tool call and at each turn's
  start, inside budgets of two and five seconds, and one read of the app's record only while a card is owed and
  no title is kept; neither is measured, and T3's first step measures both. To build: three small tasks, with
  two verifiers; not estimated in hours, since no closed stretch measures work of this kind.
- **Reach.** The lead's, the Plan's and the work session's cards ship to every project: they name only rules in
  force project-wide (`rule:questions-one-place`, `rule:lead-charter`, `rule:away-autonomy`; the explorer's,
  item 5) and a skill installed in every home (the explorer's, item 9). The senior's is given only where the
  project declares `rule:senior-model`. No card names a feature document.

## Tasks
One chain: T2, then T3, then T4. The board is checked before each. T5 is the lead's and holds none of them: a
card ships without the lines that wait for a rule.
- [ ] T1 (kind: design) (1) This document, its double reviews, his answers. Route: inline, JH SR, then JH 213.
- [ ] T2 (kind: build) (1) The exported list of role names (`bin/lib/sessions.mjs`); `bin/lib/role-cards.mjs`,
  with no import, and its test: the four cards, the pattern for a Plan's title, the six parts, the budget, no
  rule's phrase in a card, the questions line, the senior's card only where its rule is declared, `rules check`
  clean, the source of each line in this Log. No sentence leaves `bin/lib/manifest.mjs` or
  `bin/lib/lead-protocols.mjs`. High risk 3 (an export of a function with 31 call lines in 16 modules; texts
  that ship to every project): a verifier.
- [ ] T3 (kind: build) (1) Delivery. First, measure and write here: whether a title is known at a new session's
  first UserPromptSubmit, started by `start_session` and by hand; what a clear gives the hooks; the time of the
  state read and of the app's record read against two and five seconds. Then, tests first: the state file and
  its marker; the card from `rules --hook` at a turn's start, from the hook after a tool call and in the resume
  block, each row of the state table; the block by role, the senior's mode line, the lead's two lines, the line
  for a title with no card; `js-harness sessions --role` with its three exits (`bin/sessions.mjs`); the hook
  message registered. Fixtures: the three blocks this project's senior was given (transcript 285fc2c7, lines
  882, 1649 and 2783). High risk 3 and 4 (texts every session already reads; two hooks writing one state): a
  verifier.
- [ ] T4 (kind: verify) (1) From real sessions, the transcript lines in this Log: the card at the first turn or
  tool call of a lead, of a senior, of a Plan and of a work session, at whatever start comes next by itself, and
  in the block after a real compaction of each. It reads delivery only. Last step, the lead's: the Plan's
  phase 0 opening stored again without its role section.
- [ ] T5 (kind: build) (1) The lead's, on a `rule/` branch, with his words and their dates: the senior's rule
  from 324 and 329 (one task at a time, in a queue; only for work that needs more than Opus; it closes when its
  task ends and a new one opens), and with it the two lines of the senior's card, the sentence of
  `bin/lib/lead-protocols.mjs:43` that says one senior stands, "long-lived" in D3 of
  `odd/tasks/senior-orchestrator.md`, and the stored opening of the earlier JH SR, which says "never `closed`";
  the "How sessions run" paragraph of `CLAUDE.md` from 330.

## Log
- L1 2026-11-16, his words: Spec 1, read with `sessions --quote` by this session. The lead's message to JH SR
  asked for the design of "how each role reaches its session beyond the opening, so it survives a compaction and a
  new session", the search first, and a proposal with its double review and cost before anything is built.
- L2 The search: one read-only explorer (152,840 tokens, 42 tool calls) mapped role by moment; its grid is Depth
  pass item 2. Not checked by anyone: whether a skill or an output style survives a compaction, whether a stored
  opening exists for the senior's title on another machine.
- L3 A reading left open: whether "cada sesion" takes in the numbered work sessions. Question 1.
- L4 Double review 1, read d8b87396-d6cc-44e5-b866-66ee88b09103 of version 1 (stated 1.1M Claude and 0.9M Codex;
  measured 1,397,745 and 477,121 tokens): Claude 9 findings, three high, Codex 5; all 14 taken. Version 1
  delivered the card through `sessions --opening`, one more sentence in the senior's brief and the head of the
  skill, without reading what rests on each. Version 2 answered them one by one: the card at the skill's lead
  part, an exported list of roles with exemptions, the senior's brief as its card, a `--role` option, the card in
  the resume block for every role, sources for the senior's lines, three citations, an outcome in T5.
- L5 Double review 2, read 7d891ab3-f9a0-4e66-ab9c-aaa3eea6c374 of version 2 (measured 2,143,025 Claude and
  472,024 Codex tokens): Claude 9 findings, two high, Codex 4; all 13 taken. The mistake of versions 1 and 2,
  told: both gave each role its own delivery path at the start (the skill, the brief, the first message), and
  each path turned out to rest on something else: the guard compares the brief as typed by the lead, the brief
  is quoted in the skill, a senior can still be started with any brief, the Plan had no path at all. Fixed in
  version 3 by one path for every role, the hook after a tool call, which touches none of those; not checked
  until the third read. What stops it: Constraints now lists what rests on each text before a path uses it;
  proof later: T3's tests for each role on that one path. What each changed: Claude 1 and Codex 1 (shared), the
  Plan's card ships at the first build by a title match, and `plan-orchestrator.md` T5 names the module (its
  L18); Claude 2, the senior's brief is not touched; Claude 3, the any-brief start is in the raw material and no
  longer matters to delivery; Claude 4, a senior's `closed` is refused by code once his rule exists, and the
  card's effect on the work is said to be unmeasured; Claude 5, the title not known and the drifted lead; Claude
  6, the constraint on sources rewritten and the rule changes moved to "Ask me before" and to the lead, T5;
  Claude 7, the Log line in both documents; Claude 8 and Codex 4 (shared), three exits defined, "a function with
  42 callers", the two hooks that give the model nothing, `bin/sessions.mjs:85-88`; Claude 9, the third read's
  estimate from what was measured, no senior stopped for T4, the senior's card drafted; Codex 2, the skill's
  "Two kinds of session" and the paragraph of `CLAUDE.md`, question 3; Codex 3, the sub-agents' line and
  `rule:senior-effort` in the senior's card, with its test.
- L6 Double review 3, the last (`rule:double-review`), read ea3a7283-5bc5-40c1-aba3-0d06f5f71375 of version 3
  (measured 3,445,474 Claude and 767,513 Codex tokens): Claude 14 findings, Codex 7. It still finds real failures,
  so they go to him as problems and none is corrected here; version 3 stands as read. Their full text is in the
  review's record (`double-reviews.jsonl` under the git common dir) and in JH SR's scratchpad output. High:
  (Claude 1, Codex 5) moving the lead's sentences out of `bin/lib/manifest.mjs:154-156` moves the home of
  `rule:lead-charter`, his rule, which the document never says, and `npm run check` would fail; (Claude 2, Codex
  2) the once-a-session line rests on a false precedent, since the pause notice is not found in the transcript
  but through kept state, and a marker in the transcript never arms again after a compaction; (Claude 3) "every
  project gets them" contradicts a senior's card whose sources are this repository's rules and a feature
  document; (Codex 1) a hook after a tool call cannot make a session know its role when it starts: the first
  call can already act, and a session that answers in text alone gets no card. Medium: every card's line on his
  questions will go stale when his typed line moves them to the Plan (Claude 4); the senior's draft adds duties
  with no source, such as an unconditional "you ask him nothing" (Claude 5); the Plan's phase 0 opening keeps a
  role section no task removes (Claude 6); question 1 asks what his words already answer, since "cada sesion"
  takes in the work sessions (Claude 7); a Plan's resume block still carries the work session's instructions
  (Codex 3); T2 does wait for his answer to question 1 (Codex 4). Low: a carrier before the first act, `rules
  --hook`, is not weighed, and a relieved lead keeps its card (Claude 8); the failed-tool-call entry does give
  the model context (Claude 9, Codex 6); "42 callers" does not reproduce (Claude 10); this senior was misread at
  both of its compactions, not one (Claude 11); "T5 reads delivery" should say T4 (Claude 12, Codex 7); L4 does
  not answer read 1 finding by finding (Claude 13); rendering from a constant gives `lead-protocols.mjs` an
  import D11 forbade (Claude 14). What three reads cost: 6,986,244 Claude and 1,716,658 Codex tokens, with the
  explorer's 152,840. What holds across the three versions: the card itself (one text a role, six parts, one
  home, a budget) and the resume block as its carrier after a compaction. What does not hold yet: how the card
  reaches a session at its start, and where the lead's sentences live. The three questions of "Ask me before"
  are not recorded: the read disputes the first, and the design is not approved.
- L7 The lead's word after L6 (by message, 2026-11-16 15:04 local): "Record questions 2 and 3 now with their
  drafted texts. Record question 1 too, and put read 3's dispute in its text: his line "cada sesion" may already
  answer it. I put all three to him one at a time when he returns. Correct nothing yet and run no more reads: the
  21 findings and who corrects them go to him as a problem, along with the measured spend. Keep PR 899 a draft.
  Phase 0 stays as stored." Recorded in the channel: question 316 (do the numbered work sessions get a card;
  its text says the last read holds his "cada sesion" may already answer yes), question 317 (the two rules for
  the senior, with a third option for the second rule alone, since it is the one that already failed) and
  question 318 (scoping the "one feature a session" paragraph of `CLAUDE.md` to work sessions). Each says the
  design is not approved and that a yes authorizes no build. L6's last sentence, that the questions are not
  recorded, held until this line. Nothing is corrected; draft PR 899.
- L8 His answers to the three questions, each tapped in the lead's chat (read with `js-harness sessions --quote
  699d7c29-54c4-460e-a5e8-700b114eb251 <line>`; the records keep UTC). Question 316, line 7242,
  2026-11-17T05:56Z: "A: sí, también las de trabajo", so the numbered work sessions get a short role card and
  "Ask me before" 1 is closed; it also settles the last read's Claude 7 and Codex 4, though nothing in the
  design is changed for it here. Question 317, line 7285, 05:59Z: "A: las dos reglas", a senior works one task
  at a time, and a senior's task ends with `waiting`, never `closed`, with `notify --kind closed` refused
  from a senior's title. Question 318, line 7306, 06:14Z: "A: sí, acotarlo a las de trabajo", the "How sessions
  run" paragraph of `CLAUDE.md` says it speaks of work sessions. What the taps do not cover: 317 makes two
  rules of his and 318 changes his file, and a tap changes neither (`js-harness-protocols`, section 4: his
  words, quoted with their date); the lead asks for his typed line when that work comes, so no `rule/` branch
  and no edit of `CLAUDE.md` starts on these taps. No answer approves the design or a build: the 21 findings
  of L6 stay open, and what to do with them and who corrects them is still his to answer (the lead's message,
  2026-11-17, about 01:15 local). Nothing is corrected, no read is run; draft PR 899.
- L9 His answer to question 323, tapped in the lead's chat (`js-harness sessions --quote
  699d7c29-54c4-460e-a5e8-700b114eb251 7877`, 2026-11-17T07:10Z, 02:10 local): "A: corregir (unos 2,5-4 M)".
  What the question said a yes covers: correcting the open findings and then one read that confirms, at about
  2 to 3.5M Claude tokens and 0.5M of Codex, an estimate taken from the three reads; then the design comes to
  him for approval. What it does not cover: approving the design or building the cards. What it said is not
  guaranteed: that a fourth read finds nothing new. The fourth read rests on this answer alone:
  `rule:double-review` allows three, and where the third still finds a failure the work passes to the model
  `rule:senior-model` names. The lead's word to JH SR (by message, 02:11 local): correct the findings of L6 with
  his answers of L8; run one confirming read, its cost said first; record the spend; build nothing; if that
  read finds real failures, stop and send them as a problem, with no further read. Two things the lead was
  told before the work began: the question told him "una sesión nueva" and this is the session that wrote the
  three versions, on claude-fable-5-2 (its transcript's last entry), at 46% of its context; and the read alone
  was measured at 1.40, 2.14 and 3.45M Claude tokens on this document, so with the correction pass it can pass
  what he approved.
- L10 2026-11-17, 02:26 local: the correction is stopped before version 4, and a mistake of this session, told.
  What happened: every cost this session reported for the design (L4 to L6, its notes to the lead, and so the
  7.0M he read in question 323) counted the reads and the sub-agents and never the session's own tokens. Read
  now from its transcript's usage fields, each message once: 17,992,257 tokens on Fable between his line of
  2026-11-16 13:58 local and the lead's message on question 323, 17.4M of them cache reads; and 2,983,482 in
  the 13 calls after that message, about 230k a call, since the session holds 238k of context (68%, the app's
  usage tool). So what he approved for the correction and its read together, 2 to 3.5M Claude tokens, was used
  before a line of version 4 was written. The meter, for every session of the account together: weekly Fable
  21% against 17% at 2026-11-16 01:00 local, all models 44% against 38%. The fix now, sent and not yet
  answered: the work stops; three notes tell the lead the figures, that spend past the approved is his, and
  the recommendation that a fresh senior session writes version 4, as question 323 told him ("una sesión
  nueva"), since its calls cost about a fifth of these; an estimate, from 238k of context against about 50k.
  What stops it recurring: a cost report names the session's own tokens beside its reads, read by a command
  and not by hand; today a throwaway script in this session's scratchpad does it, a manual workaround, so the
  follow-up is a figure of `js-harness sessions` or of the closing summary, which the lead assigns
  (`js-harness-protocols`, section 4). Where it enters: `docs/FAILURES.md`, a `- Seen:` line under
  `estimate-passed-as-fact`, in this commit. Proof later: `js-harness failures` lists that entry with no new
  `- Seen:` line after the control lands. What was done before the stop and stays useful: the approach of
  version 4 is in this session's stored opening (`js-harness sessions --opening "JH SR · diseño del
  Orquestador Plan"`), and one read-only opus explorer is checking fourteen facts in the code, its answers to
  be saved in the sessions' shared notes folder.
- L11 2026-11-17, three messages of the lead, read together at 02:30 local. First, his typed answer to question
  324, which asked for his words for 317 and 318 (`js-harness sessions --quote
  699d7c29-54c4-460e-a5e8-700b114eb251 7921`, 2026-11-17T07:14Z, 02:14 local, typed): "El SR hace una tarea a
  la vez en fila ya que este solo se va a utilizar para cosas que necesitemos mejor poder que opus pero nla
  idea no es que se utilice todo el tiempo, osea solo para tareas complejas que necesiten mas poder que opus".
  What it words: the first rule of 317, a senior does one task at a time, in a queue; and one thing more, that
  the senior is not for use all the time, only for complex tasks that need more power than Opus. What it does
  not word: the second rule of 317, a task ends with `waiting` and never `closed`, and 318, the scope of the
  "How sessions run" paragraph of `CLAUDE.md`. He chose A on both and never chose "not yet", so both are open,
  waiting for words, not dropped (the lead's correction, its second message). Whoever writes them runs the
  dry run of `js-harness rules change` first, to see whether his lines 5054 and 7921 with the taps satisfy the
  source. Nothing is written as a rule here. Third message, after this session's stop of L10: "you keep the
  Q323 work, since you are on claude-fable-5-2. Go on with version 4. Start the confirming read only if its
  forecast fits what is left of the approved figure (2 to 3.5M Claude plus 0.5M Codex, correction and read
  together). If it does not fit, the read waits for his return, not for me: he is away for some hours, and my
  cases authorize no spend. Send a note either way." Read by this session as: version 4 is written here, at
  about 230k tokens a call on Fable, which the lead decided knowing the figures of L10; nothing of the approved
  figure is left, so the read does not start and waits for him. That reading was sent to the lead in a note.
- L12 2026-11-17, 02:37 local, the lead's word, by message: "STOP now. The approved figure is used up, so the
  roughly 8 more calls for version 4 (about 1.8M on Fable) would be spend he did not approve. Commit what is
  written, mark version 4 as unfinished in State, push, and send waiting. Finishing version 4 and the confirming
  read wait for his return and his word on new spend. Nothing more runs." It replaces the third message of L11.
  Where the work stands: of version 4 nothing is in this document; its approach is in L10 and in this session's
  stored opening; the 21 findings of L6 are open, and L4 is not yet redone finding by finding. Measured spend of
  the work on question 323: this session's own tokens on Fable, from the lead's message of 02:13 local to this
  entry, the call that wrote it not counted, 6,795,693 in 28 calls, 6,629,771 of them cache
  reads; one read-only explorer on claude-opus-5-5, 209,428 tokens and 79 tool calls; no read ran, so no Codex
  tokens. That explorer was started before the stop and ended as the stop arrived: its fourteen answers, each
  with path:line and checked by nobody else, are `session-roles-v4-facts.md` in the sessions' shared notes
  folder, beside the findings of read 3. Among them, for whoever writes version 4: the mode line of the resume
  block always reads the work sessions' model, so a senior is told the wrong one at every compaction (three
  times in this session, transcript lines 882, 1649 and 2783); the compact boundary is written after the
  resume hook runs; a new module that prints a hook message must be registered or a test fails; no check
  refuses a rule's phrases restated outside their home; one more hook entry also raises a counted limit and
  needs its id in `docs/SPEC.md`. What is his when he returns: whether to spend on finishing version 4 and on
  its read, and in which session; a fresh senior session is what question 323 told him and what L10
  recommends for its cost.
- L13 Version 4, by JH 213 (a senior session on claude-fable-5-2, opened fresh on 2026-11-17 with the opening
  `js-harness sessions --opening "JH 213 · senior: session-roles v4"`). His answer to question 324 is whole in
  L11 (line 7921, 2026-11-17T07:14Z, typed) and was read again by this session. Carried into the design: a
  senior does one task at a time and the next waits in a queue; it is used only for complex tasks that need
  more power than Opus. Both wait for the lead's rule (T5) before they are a line of the card.
- L14 His answer to question 329 (`js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 10115`,
  2026-11-17T14:25Z, typed): "El señor se cierra al terminar y se abre uno nuevo". The question asked whether a
  senior that ends a task waits for the next or closes; "señor" is read as the senior (the lead's reading, in
  this session's opening). It replaces the tap A of question 317 on that point (L8): "a senior's task ends with
  `waiting`, never `closed`" and the refusal of `notify --kind closed` from a senior's title leave the design.
  A senior ends its one task with `closed`, as a work session does, and the next task opens a new senior. What
  his words do not say: whether the senior's start (the wait brief, D11 and D14) changes; the design leaves it
  as it is.
- L15 His answer to question 330 (`js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 10155`,
  2026-11-17T14:28Z, typed): "how sessions run es solo para sesiones de trabajo". It gives the words question
  318's tap lacked (L8): the "How sessions run" paragraph of `CLAUDE.md` speaks of work sessions. It is his
  file: the lead changes it (T5), not this document.
- L16 His answer to question 328 (`js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 10046`,
  2026-11-17T14:19Z, tapped): "B: sí, con el senior (Fable)". What the question said a yes covers: finishing
  version 4 in a new session and one confirming read, forecast at 1.5 to 3M Claude tokens and about 0.4M of
  Codex, an estimate; "Si pasa de 3 M, paro y te aviso". It approves no design and no build.
- L17 The 21 findings of read ea3a7283 (L6), each answered in version 4. Claude 1 and Codex 5, taken: no
  sentence leaves the skill, a card names a rule and holds none of its phrases, and T2 tests `rules check`
  clean. Claude 2 and Codex 2, taken: the false precedent is named as false; the state is a per-session file
  with an exclusive marker; the table says what each carrier writes, a compaction owes the card again, a clear
  gives one card, two calls at once give one; T3 tests each row and the time against the hooks' budgets; no
  transcript is searched. Claude 3, taken: the senior's card only where `rule:senior-model` is declared, its
  values filled by `ruleHere`, its limits written as sentences; no card names a feature document. Codex 1,
  taken in part: a carrier at the turn's start is added and a text-only turn is covered where the title is
  known; that a session knows its role before its first act is not claimed, the Goal says so, and whether a
  title is known at the first turn is T3's first step. Claude 4, taken: every card's questions part is one line
  that names the rule; the dependency on question 307 is a constraint. Claude 5, taken: no "you ask him
  nothing", no sender forbidden, the examples as the source gives them. Claude 6, taken: the Plan's opening is
  named as a second copy with its owner and T4's last step removes it. Claude 7 and Codex 4, settled by his
  answer to 316 (L8): the work session's card is in T2. Codex 3, taken: the role picks the whole resume block;
  the Plan's state is said to be not known. Claude 8, taken: the turn's start is weighed and used, and a title
  that leaves a role is told once; a card from the guard before the first call is declined, the guard being
  out of scope. Claude 9 and Codex 6, taken: Depth pass item 2. Claude 10, taken: 31 call lines in 16 modules,
  with the command's place. Claude 11, taken: three blocks, lines 882, 1649 and 2783. Claude 12 and Codex 7,
  taken: T4. Claude 13, taken: L18. Claude 14, taken: `bin/lib/role-cards.mjs` imports nothing and
  `bin/lib/lead-protocols.mjs` gains no import. Not recorded with `double-review take`: this session ran no
  command on read ea3a7283, and whether the earlier session recorded its takes was not read (not known).
- L18 L4 again, finding by finding (read d8b87396 of version 1; the findings as the explorer of L12 copied
  them, item 13; what version 2 did is L4's own account, not reread). Claude 1 and Codex 4, the lead's card at
  the skill's head reaching work sessions and making a second home: version 2 moved it to the lead's part;
  version 4 puts no card in the skill. Claude 2 and Codex 2, the coverage test against "a no keeps three
  cards": an exported list of roles with named exemptions; since his answer to 316 every name has a card.
  Claude 3 and Codex 1, a command named in a brief that says "Run nothing": version 2 made the brief the card;
  since version 3 the brief is not touched. Claude 4, the contract of `sessions --opening`: not changed since
  version 2, which added `--role` in its place. Claude 5 and Codex 5, the start not weighed, pointers in place
  of a card for the lead, a clear not tested: the card is in the resume block for every role since version 2;
  version 4 adds the state table and its tests on a clear. Claude 6, the senior's lines without sources: each
  line has one since version 2, and version 4 quotes the examples. Claude 7 and Claude 8, wrong citations
  (`docs/FAILURES.md`, the place of D1 to D14, `bin/lib/manifest.mjs:133`, a missed hook): the "three
  citations" of L4, corrected in version 2. Claude 9, no check of the effect: version 2 added an outcome to a
  task; since version 3 the effect is said to be unmeasured. Codex 3, the lead's exception for `rules change`
  and `rules switch`: version 4 writes none of the lead's duties in its card, which names `rule:lead-charter`.
- L19 2026-11-17, the confirming read is not run, and why. Measured before this version was written, from this
  session's transcript, each message once: 1,169,272 Claude tokens in 10 calls, about 117k a call (the
  session's fixed context is large; question 328's forecast took 50 to 100k). The three reads of this document
  measured 1.40, 2.14 and 3.45M Claude tokens. The smallest of them, with what this session has spent and the
  calls that writing, committing and taking the findings need, passes the 3M of his answer to 328 (L16); the
  opening says to stop there. So version 4 is written, committed and pushed, and no read is started: a fourth
  read rests on his answer to question 323 (L9) and waits for his word on its spend, forecast at 1.4 to 3.4M
  Claude and 0.5 to 0.8M Codex. The final measure of this session's spend is in its closing notice to the lead.
  What a later session needs for the read: `js-harness double-review read odd/tasks/session-roles.md` on this
  commit, its findings answered with `double-review take`; if it finds real failures they go to him as a
  problem, with no further read (L9).
- L20 2026-11-17, the confirming read of version 4, by JH 214 (a senior session on claude-fable-5-2, opened
  fresh for it; his yes to question 331, the lead's transcript 699d7c29 line 11011, as the session's opening
  gives it). Read bdef7ebc-59e4-49a0-a09a-12577ac1abe8 of this document at 9d1e031e: Claude 15 findings, three
  high, 3,307,277 tokens; Codex 6, one high, 921,331 tokens. It finds real failures, so version 4 is not
  confirmed and nothing is corrected here. The session's own tokens before its stop notice, each message once:
  991,856 in 10 calls; with the read that is 4.30M Claude against the 3.4M of question 331, so it stopped and
  told the lead (the channel's note of 18:16 local). His yes to question 334 (`js-harness sessions --quote
  699d7c29-54c4-460e-a5e8-700b114eb251 11387`, 2026-11-17T23:48Z, tapped): "A: que los anote (Recomendado)";
  what the question said a yes covers: writing the findings, answering each, the Log and the push, about 0.9M
  of Fable, an estimate; not correcting version 4 and not reading it again. Recorded with `double-review take`:
  Claude 14 of 15 taken, Codex 6 of 6, five shared. No taken finding was rechecked against the code by this
  session: each is the reader's claim with the reader's citations, whole in the read's record
  (`double-reviews.jsonl` under the git common dir).
  High. (Claude 1, Codex 4, shared) The senior's mode line read from `SENIOR_HOME` keeps the formatter's
  sentence "the session and every sub-agent on" (`bin/lib/contract.mjs:316-319`), so a senior is told to run
  its sub-agents on its own model, against its card and `bin/lib/lead-protocols.mjs:43`; T3's test would lock
  it in. (Claude 3, Codex 1, shared) The marker is created before the card is printed, so a hook that fails or
  runs out of time after it loses the card for good, against the table's "leaves the card owed" and the
  guarantee. (Claude 2) The gap at a session's start is conceded on a misread citation: `bin/resume.mjs:840`
  tests whether a start is a clear and says nothing of titles; SessionStart and UserPromptSubmit hooks do run
  before the first act; the app's record holds the title and is already read at a start
  (`bin/resume.mjs:831-838`, `bin/lib/app-record.mjs:97`); the measurement that settles it is cheap and was
  left to T3.
  Medium. (Claude 4, Codex 2, shared) `end.compaction` is the `preTokens` of the last automatic compaction in
  the transcript's end, not a boundary's identity: a manual compaction is not seen, and a `pending` state can
  take a later compaction as its own and owe no card. (Claude 8, Codex 3, shared) Three hooks read and write
  one JSON state with no lock, and `rules --hook` also runs at SubagentStart and at SessionStart on a
  compaction, so it can spend the owed card or take it from the resume block. (Claude 5) A senior under a
  numbered title, as JH 213 and JH 214 are, holds the role `work` and would get the work session's card and
  mode line. (Claude 6, Codex 6, shared) His typed answer to question 307 is recorded
  (`odd/tasks/plan-orchestrator.md`, L19, "Solo en el Plan") and this document says it is owed; no test holds
  that a rule a card names is live. (Claude 7) What the card and the mode line do when `ruleHere` answers
  `behind` or `elsewhere` is not said. (Claude 9) The forecast's lower bound ignored that each read cost more
  than the one before, which this read's 3.31M bears out; "Ask me before" said nothing waits while State said
  the read does. (Claude 10) The lead's card is pointers, which read 1 objected to; a rule's sentence can be
  rendered from its home at print time. (Codex 5) The senior's card may ship before T5 while
  `bin/lib/lead-protocols.mjs:43` still describes a standing senior.
  Low. (Claude 12) the line for a title with no card names a command that exits 1 for it; (Claude 13) what a
  clear gives is in the code (`bin/resume.mjs:825-829`), not "not known"; (Claude 14) citations off by lines
  and "this session" meaning two sessions; (Claude 15) the state files are never pruned, the role list can
  drift from `roleOfTitle`, `PLAN nueva` must get no card, the Plan's card ships everywhere with its sources
  here.
  Not taken: Claude 11, no criterion or proxy for "que haga que funcione mejor". The design says the effect is
  unmeasured and why (the "What a check holds" part: three wrong blocks in one session are the whole record),
  and T4 says it reads delivery only; a proxy the finding itself calls weak adds a record and no criterion.
  What a correction would change and cost, every figure an estimate, none approved. Claude 1 with Codex 4: the
  senior's paragraph of "The resume block, by role" and one line of T3; small, a call or two. Claude 2: a
  read-only measurement over existing transcripts and app records first (one explorer, about 0.2M on Opus, as
  L2 and L12 measured theirs), then the Goal, Depth pass item 1, "What is guaranteed" and T3's first step.
  Claude 3 with Codex 1: the order of marker and print, with a claimed state apart from a delivered one; it
  sits in the same part as the shared mediums on the state and the boundary, so "Delivery" is rewritten once
  for all five, with its table and T3's rows. In a fresh senior at about 100k a call (this session's measure),
  the highs alone about 1 to 1.5M of Fable; all 20 taken findings about 1.5 to 2.5M, with the explorer. A read
  after that is not less than this one, 3.3M Claude and 0.9M Codex, and it would be the fifth:
  `rule:double-review` allows three and L9 said no further read. Both are his to decide. The final measure of
  this session's spend is in its closing notice.
