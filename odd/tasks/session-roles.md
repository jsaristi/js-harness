# session-roles — a role of its own for each session, beyond its opening (JH SR, design only)

## State
Design only, no code. Version 2, 2026-11-16, by JH SR at the lead's word (T12 of
`odd/tasks/plan-orchestrator.md`, its Spec 9). Read once (read d8b87396): Claude 9 findings, Codex 5, all 14 taken
(L4); version 2 is their correction and waits for its confirming read. Branch `docs/session-roles`, cut from main
at 035a2dcc, worktree `rule-lead-effort-split-aac740`. Nothing is built and nothing is asked of him yet: one
question is drafted, for the lead to put to him.

## Goal
Each session that holds a role (the lead, the Plan, the senior) reads what its role is, from one text the harness
owns, at its start, after every compaction and in a new session under the same title.

## Why
His words (Spec 1): each session must know its role and its function, with a specific role and not only an opening
prompt, so that it works better. The record agrees (Depth pass item 4): after a compaction the harness tells a
senior nothing of what it is, and told this senior to work as a work session.

## Done when
- `js-harness contract check odd/tasks/session-roles.md` exits 0
- `npm run check` exits 0
- each double review's read id and every finding's answer are in the Log

## In scope / Out of scope
- In: this document; a draft docs PR; the Spanish page if the lead puts the proposal to him.
- Out: every file under `bin/` (design only). At the build the board (`js-harness sessions`) says who holds
  `bin/lib/sessions.mjs`, `bin/resume.mjs`, `bin/lib/manifest.mjs` and `bin/lib/lead-protocols.mjs` that day.
- Out: the Plan's role in the title parser and its guarded start, which are T5 of
  `odd/tasks/plan-orchestrator.md`; this design only says what follows once that lands.
- Out: what a role may do. No permission changes here: a card says what the rules already say, and a line no
  rule says yet becomes a rule first, by `rules change`, or leaves the card.

## Constraints
- One home (`AGENTS.md`): a role's text is one constant in code; every other text renders it or names it and does
  not repeat it. A card names a rule by `rule:<id>` and restates no value — because a second copy is how the 73
  percent mark outlived three changes (`js-harness-protocols`, section 4).
- A stored opening is a session's task and state, written by a session and replaced often; a role is the same for
  every session that holds it. They are two texts — because a role kept inside an opening goes stale with it.
- `js-harness sessions --opening` keeps its output and its exit codes (0 for one opening, 1 for none, 2 for
  several; a reading is recorded): the resume block and `--peek` depend on them (`bin/sessions.mjs:84-88`,
  `:688-711`; `bin/resume.mjs:376-391`). Nothing here changes that command.
- The orchestrator skill is read by work sessions too (`bin/lib/manifest.mjs:115`, `:120`, `:243`): a lead's card
  at its head would tell a work session it is the lead.
- A senior's first turn runs on the lead's model, before its own is set, so its start brief says "Run nothing"
  and the guard compares the brief with a constant (`bin/lib/lead-protocols.mjs:9-12`;
  `odd/tasks/senior-orchestrator.md`, D11): that turn may read, and may call no tool.
- The host is not ours: whether a skill or an output style survives a compaction is not checked, and
  `set_session_output_style` asks him with a card and is refused in an unattended session (the host's tool
  description, read by the explorer). Nothing here depends on either.
- A text every session reads costs tokens each time it is read, on every model, Fable included — so a card has a
  budget a test holds, and nothing is injected on every tool call.

## Ask me before
1. His, one question, drafted for the lead: "cada sesion por ejemplo Orquestador, Orquestador Plan y Senior" names
   three as examples. Do the numbered work sessions get a role card too? Proposed: yes, one short card, since the
   mechanism is the same and he said "cada sesion". A no is written into the code as a named exemption with his
   answer's line, so the test still accounts for every role.
2. Not his, said with its cost: the first read of this document cost 1,397,745 Claude tokens and 477,121 of
   Codex, against the 1.1M and 0.9M the command states; the confirming read is one more of the same kind, and
   there are at most three.

## Depth pass
- 1. Method: an organization gives each post a job description apart from the day's assignment: its purpose, its
  duties, what it may not do, whom it answers to and whom it hands work to, kept as one controlled text and read
  again when a person takes the post. For an agent the same text is the part of its prompt that is re-read at
  every boundary where its memory is cut. Its standard: one text a role, short enough to be read whole, owned in
  one place, delivered by the path that already runs at each boundary, and checked by a test, not by a habit. The
  smallest change that meets it reuses what exists (searched by one read-only explorer, 42 tool calls, and by this
  session: codegraph for `roleOfTitle`, `resumeLines`, `orchestratorSkillContent`; grep for
  `leadTitle|seniorTitle|isLeadTitle|roleOfTitle` in `bin`, for `agent type|--agent|top-level session` in
  `odd/tasks`, for `set_session_output_style` in `bin` and `odd/tasks`; `ls bin/lib | grep -i role`, no file):
  each role already has a text it reads at its start (the skill's lead part, the senior's brief, a work session's
  first message), and the resume hook already speaks where memory is cut. Weighed and left out: the same hook on a
  plain `startup` (`bin/lib/hook-entries.mjs:27`; `bin/resume.mjs:840`). It would print the card when the app's
  record gives a role's title at that instant, but a title is usually set after a session starts, and a senior,
  whose brief is its card, would get it twice; every role has a start path that carries the card without it.
- 2. Raw material (the explorer's and the first read's citations; this session checked `bin/resume.mjs:874` and
  `:905`, `bin/lib/lead-prompt.mjs:4`, `bin/lib/lead-protocols.mjs:12-16`, `bin/lib/manifest.mjs:134` and
  `:154-156`; the rest are theirs, not rechecked):
  - His words: `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 5054`.
  - Titles hold three roles: `bin/lib/sessions.mjs:1248-1261` (`orchestrator`, `senior`, and `work` for a number);
    a Plan's title holds none, and no list of the roles is exported.
  - At a start. The lead: `LEAD_OPENING_PROMPT`, "Follow the js-harness-orchestrator skill"
    (`bin/lib/lead-prompt.mjs:4`). The senior: `SENIOR_WAIT_BRIEF` and `SENIOR_WAIT_BACKGROUND`
    (`bin/lib/lead-protocols.mjs:12-16`), the only text addressed to it. Any session: its stored opening, when the
    first message `notify --opening` prints is sent ("Read your opening with js-harness sessions --opening").
  - After a compaction. `resumeLines` speaks only on a compaction or a clear (`bin/resume.mjs:874`) and has one
    role branch, the orchestrator's (`:905`): the lead gets its relief file's path and "Read its last lines",
    though its charter is at that file's head (`bin/lib/manifest.mjs:155`); the block names neither the skill nor
    the charter. A senior goes down the work session's path.
  - In a new session under the same title: nothing from the hook (a plain `startup` returns no line).
  - On every turn: nothing chosen by role. `CLAUDE.md` and `AGENTS.md` name no role; the orchestrator skill is
    loaded when the model chooses it (`bin/lib/manifest.mjs:115`, `:272-276`). The hooks that can add context
    (`bin/lib/hook-entries.mjs`, `:27` and `:149-173`): `resume --hook` and `backup --session-start` on
    SessionStart; `rules --hook` on SessionStart, UserPromptSubmit and SubagentStart; `resume --pause` on
    PostToolUse. None reads the role to choose text, though the last resolves it for the inbox
    (`bin/lib/inbox.mjs:171`).
  - The senior's limits are decisions D1 to D14 of `odd/tasks/senior-orchestrator.md:171-232` and guard refusals:
    no text tells the senior itself. What the lead's skill says of it points the other way from what the lead
    asked of this senior: "it reports through the same notices as any work session"
    (`bin/lib/lead-protocols.mjs:43`), and a work session ends with `closed` (`bin/lib/manifest.mjs:254`).
  - Agent types: `.claude/agents/js-harness-writer.md` serves sub-agents; `start_session` takes no agent type.
  - The output style is one for every session of a clone (`bin/lib/project-apply.mjs:12-35`).
- 3. The bar:
  spec 1: `node --test bin/resume.test.mjs`: none, new behaviour (after a compaction a senior's resume block carries no role text and a lead's names neither its skill nor its charter; no test asks for either)
- 4. Refutation: the request fails if a session already gets its role back where its memory is cut. Read now, in
  this session's own transcript (285fc2c7-d588-4b0c-bef5-ded03fe6b04c under the worktree's project folder, lines
  1649 and 1669): the block the hook gave this senior after the compaction of 2026-11-16 00:57 local names its
  opening and its feature document and says "Mode of the next open task: T10 (kind: verify): the session and
  every sub-agent on claude-opus-5-5 at medium". This session is the senior, on `rule:senior-model` at high: the
  hook read it as a work session. And one cost already paid for a role nobody had written down: on 2026-11-15
  this senior took PR 894 out of draft while his approval was pending (`docs/FAILURES.md`,
  `land-took-pending-pr`, the `- Seen:` line of that day) and ended its task with a `closed` notice (the
  channel's record, 2026-11-16T03:44Z, from this session), which is what the one sentence the harness has on a
  senior's notices told it to do; the lead's correction, "you are the standing senior", came by message. What
  this does not show: that a role text would have prevented it, or that a lead or a Plan loses its role the same
  way; one session, one day.
  Verdict: supports
- 5. Request: "Give each role one short text the harness owns, apart from the opening: who the session is, what
  it does, what it never does, whom it hands work to, where questions go, and its limits. Deliver it where each
  role already reads at its start, and in the resume block after a compaction. Hold it with a test, and name the
  outcome it is meant to change."
  Adds: none

## Specs
1. "cada sesion por ejemplo Orquestador, Orquestador Plan y Senior deben saber cual es su rol y su funcion osea
   cada uno debe no solo tener un prompt inicial sino un rol especifico que haga que funcione mejor"
   (2026-11-16T18:58Z, 13:58 in his local time; 699d7c29 line 5054, the second half of his typed answer to
   question 315; whole in Log L17 of `odd/tasks/plan-orchestrator.md`)

## The design
- **A role card.** One constant a role, in one new module, `bin/lib/role-cards.mjs`, beside its test. Six parts,
  always in this order: who you are; what you do; what you never do; whom you hand work to and who sends you
  work; where his questions go; your limits and where the long text is. A budget, proposed at 1,500 characters a
  card and fixed at the build, is a constant the test reads.
- **The card is the one home of what it says.** Where a card's sentence stands today in another text, that text
  renders it from the constant and keeps no copy: the build lists, for each card, the lines that move. For the
  lead these are the who, does and never sentences of the skill's lead part (`bin/lib/manifest.mjs:154-156`),
  with their exception kept whole: the lead commits what `rules change` and `rules switch` write from a `rule/`
  checkout. A check refuses a second copy of a card's sentence in the skill.
- **The roles are a list.** `bin/lib/sessions.mjs` exports one frozen list of the roles a title can hold, which
  `roleOfTitle` is built from; the cards module gives every role on it either a card or a named exemption with
  its reason. So a role added to the title parser with neither fails the test, and a no to question 1 is
  `work: no card`, with his answer's line, not a hole.
- **What each card says, in outline**, each line with its source; the texts are written at the build:
  - The lead: leads this project's sessions; opens the work sessions and the senior, sends them work, puts every
    question to him and carries his answer, lands ready PRs; never implements, commits or writes in a worktree,
    but for the `rule/` exception, and never answers for him (`bin/lib/manifest.mjs:154-156`); receives the plan
    from the Plan where one holds its role (`odd/tasks/plan-orchestrator.md`); its long text is the skill's lead
    part and the charter at the head of its relief file (`rule:lead-charter`).
  - The senior: the standing senior, one alive, on `rule:senior-model` (D4); takes its tasks from the lead, as
    messages, where more intelligence or complexity is needed (D3, D5, D6); starts no session (D3); its questions
    for him are recorded for the lead (`rule:questions-one-place`). Two lines have no source and become rules by
    `rules change` first, or leave the card: one task at a time; a task ends with `waiting`, never `closed`. The
    second also changes the sentence that says the opposite (`bin/lib/lead-protocols.mjs:43`), in that commit.
  - The Plan: the role section of its phase 0 opening (who it is, plans and does not execute, hands plans to the
    lead alone, reads no code), once `PLAN` is a role.
  - A work session, if question 1 says yes: owns one feature, its document, its branch and its PR; reports to
    the lead; records its questions for the lead, since every question reaches him in the lead's chat
    (`rule:questions-one-place`, `bin/lib/manifest.mjs:134`).
- **Delivery at a start, and in a new session under the same title: where each role already reads.**
  - The lead: its opening prompt sends it to the skill (`bin/lib/lead-prompt.mjs:4`), and the skill's lead part
    opens with the card, rendered from the constant. Not at the head of the file: a test holds that the work
    session's part carries no line of the lead's card.
  - The senior: its wait brief is the card followed by today's sentence, "Run nothing: reply that you are
    waiting, and wait for the lead's first task", built from the constant, so the guard still compares the brief
    with one text. Its first turn reads the card and calls no tool. A senior is only ever started by the lead
    with that brief (D10), so a new senior gets the same card.
  - The Plan: by hand in phase 0, the role section of its opening; after T5 of `plan-orchestrator.md`, a wait
    brief built as the senior's is, since the lead starts it the same way.
  - A work session, on a yes: the first message `notify --opening` prints gains one line that names the command
    below.
- **One new option to read a card again.** `js-harness sessions --role <title>` prints the card of the role that
  title holds: exit 0 with the card, 1 for a title with no role or an exempt one, and it records no reading.
  `sessions --opening` is not touched.
- **Delivery after a compaction or a clear: the resume block.** `resumeLines` prints the card itself, not a
  pointer, for every title whose role has a card, the lead's included, with two more lines in the lead's branch:
  the skill to load again, and that its charter is at the head of the relief file. The block's mode line reads
  the senior's own home, so a senior is not told to work as a work session.
- **A test holds it.** Every role on the exported list has a card or a named exemption; a card has its six parts
  and is inside its budget; the senior's brief is its card and the wait sentence; the skill's lead part renders
  the lead's card and its work part holds none of it; the resume block of each role carries its card on a
  compaction and on a clear; `sessions --role` gives its three exits.
- **The outcome it is meant to change** (his "que haga que funcione mejor"), read from records in T5: after a
  real compaction a senior's block names its own model and level, never the work session's; and across the next
  five tasks a senior ends, no `closed` notice from it is in the channel and no `- Seen:` line of
  `land-took-pending-pr` names a senior.
- **Not proposed, and why.** The card printed by `sessions --opening`: it would change the output and the exit
  codes the resume block and `--peek` rest on. A reminder on every tool call (the inbox path already knows the
  role): it spends tokens on each call of every session for a text that is lost only where memory is cut. An
  output style a role, set for each session: it is the one carrier that sits at the system level on every turn,
  but it needs his tap on a card at each start, is refused when he is away, replaces the project's one style,
  and whether it survives a compaction is not checked; it is his to reopen if the cards prove too weak. An agent
  type for a top-level session: the host's `start_session` takes none. A role section inside each stored opening
  (what phase 0 does by hand for the Plan): it goes stale with the opening.
- **Cost.** To read: a card of 1,500 characters is about 400 tokens, at a start and once after each compaction;
  an estimate. To build: four small tasks on four files other sessions also hold, with three verifiers; not
  estimated in hours, since no closed stretch measures work of this kind.
- **Reach.** The cards ship with the harness, so every project gets them; the Plan's card is read only where a
  Plan holds its role.

## Tasks
One chain: T2, then T3 and T4 in either order, then T5. The board is checked before each.
- [ ] T1 (kind: design) (1) This document, its double reviews, the question for him. Route: inline, JH SR.
- [ ] T2 (kind: build) (1) The exported list of roles (`bin/lib/sessions.mjs`, with `roleOfTitle` built from it and
  no caller's result changed); `bin/lib/role-cards.mjs` and its test: the cards of the lead and the senior (a
  work session's, or its exemption, by question 1), the six parts, the budget; the source of each line in this
  Log; `rules change` first for the senior's two lines with no source, and `bin/lib/lead-protocols.mjs:43` in
  that commit; the skill's lead part renders the lead's card and loses the sentences it replaces, named in the
  commit (`bin/lib/manifest.mjs`), with the check against a second copy. High risk 3 (a module with 42 callers;
  a skill text that ships to every project): a verifier.
- [ ] T3 (kind: build) (1) The senior's wait brief built from its card (`bin/lib/lead-protocols.mjs`, the guard's
  comparison and its tests: the exact brief passes, a brief that adds a task is refused as today);
  `js-harness sessions --role` with its three exits and no reading; on a yes to question 1, the line in the
  first message `notify --opening` prints. Tests first. High risk 2 (a guard constant): a verifier.
- [ ] T4 (kind: build) (1) `bin/resume.mjs`: the card in the block for every role that has one, the lead's two
  lines, the mode line from the senior's home; tests on a compaction and on a clear for each role. Fixture first:
  this session's block of 2026-11-16 00:57 local. High risk 3 (a block every session already reads): a verifier.
- [ ] T5 (kind: verify) (1) On a real compaction of a lead and of a senior, and at one real start of each, the
  block and the start text carry the card: the transcript lines in this Log. Then the outcome, from the records:
  the senior's block names its own model and level; across the next five tasks a senior ends, no `closed` notice
  and no `land-took-pending-pr` line from a senior. After T5 of `odd/tasks/plan-orchestrator.md`, the Plan's card
  moves from its phase 0 opening into the module and its brief, and the same checks run for a Plan.

## Log
- L1 2026-11-16, his words: Spec 1, read with `sessions --quote` by this session. The lead's message to JH SR
  asked for the design of "how each role reaches its session beyond the opening, so it survives a compaction and a
  new session", the search first, and a proposal with its double review and cost before anything is built.
- L2 The search: one read-only explorer (152,840 tokens, 42 tool calls) mapped role by moment; its grid is Depth
  pass item 2. Checked here before use: `bin/resume.mjs:874` and `:905`, `bin/lib/lead-prompt.mjs:4`,
  `bin/lib/lead-protocols.mjs:12-16`. Not checked by anyone: whether a skill or an output style survives a
  compaction, whether a stored opening exists for the senior's title on another machine, and the explorer's note
  that nothing stops a senior opening work sessions (D3 says it does not).
- L3 A reading left open: whether "cada sesion" takes in the numbered work sessions. Question 1.
- L4 Double review 1, read d8b87396-d6cc-44e5-b866-66ee88b09103 of version 1 (cost said first: 1.1M Claude and
  0.9M Codex stated; measured 1,397,745 and 477,121 tokens): Claude 9 findings, three high, Codex 5; all 14
  taken, none rebutted. The mistake of version 1, told: it delivered the card through `sessions --opening` and
  through one more sentence in the senior's brief without reading what rests on either (the command's exit codes
  and recorded readings; a first turn that must run nothing), and it put the lead's card at the head of a skill
  work sessions read. Fixed in version 2, not checked until the confirming read; what stops it: each delivery
  path names the text a role reads today and what compares or parses that text; proof later: the tests of T2 to
  T4 named in "A test holds it". What each changed: Claude 1 and Codex 4 (shared), the lead's card opens the
  skill's lead part, replaces the sentences it repeats, and a check refuses a second copy; Claude 2 and Codex 2
  (shared), an exported list of roles and a named exemption, so a no to question 1 is not a hole; Claude 3 and
  Codex 1 (shared), the senior's brief is its card and "Run nothing" stays; Claude 4, `sessions --opening` is not
  touched and a new option, `--role`, prints a card; Claude 5 and Codex 5 (shared), the resume block prints the
  card for every role, the lead's included, on a compaction and on a clear, and the startup branch is weighed and
  left out with its reason; Claude 6, a source for each line of the senior's card, two lines marked as needing a
  rule first, and the sentence of `lead-protocols.mjs:43` changed with it; Claude 7, the `closed` notice cited
  from the channel; Claude 8, three citations corrected and the hooks listed in full; Claude 9, an outcome named
  and read in T5; Codex 3, the lead's `rule/` exception kept in its card.
