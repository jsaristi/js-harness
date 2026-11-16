# session-roles — a role of its own for each session, beyond its opening (JH SR, design only)

## State
Design only, no code. Version 1, written 2026-11-16 by JH SR at the lead's word (T12 of
`odd/tasks/plan-orchestrator.md`, its Spec 9). Not read yet: its first double review is next, and its cost is in
"Ask me before". Branch `docs/session-roles`, cut from main at 035a2dcc, worktree `rule-lead-effort-split-aac740`.
Nothing is built and nothing is asked of him yet: one question is drafted, for the lead to put to him.

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
  `bin/lib/sessions.mjs`, `bin/resume.mjs` and `bin/lib/lead-protocols.mjs` that day.
- Out: the Plan's role in the title parser (`PLAN` in `TITLE_SHAPE`), which is T5 of
  `odd/tasks/plan-orchestrator.md`; this design only says what follows once that lands.
- Out: what a role may do. No permission, rule or guard changes here: a card says what the rules already say.

## Constraints
- One home (`AGENTS.md`): a role's text is one constant in code; every other text names it and does not repeat
  it. A card names a rule by `rule:<id>` and restates no value — because a second copy is how the 73 percent mark
  outlived three changes (`js-harness-protocols`, section 4).
- A stored opening is a session's task and state, written by a session and replaced often; a role is the same for
  every session that holds it. They are two texts — because a role kept inside an opening goes stale with it.
- The host is not ours: whether a skill or an output style survives a compaction is not checked, and
  `set_session_output_style` asks him with a card and is refused in an unattended session (the host's tool
  description, read by the explorer). Nothing here depends on either.
- A text every session reads costs tokens each time it is read, on every model, Fable included — so a card has a
  budget a test holds, and nothing is injected on every tool call.
- The guard compares a senior's start brief with `SENIOR_WAIT_BRIEF` (`odd/tasks/senior-orchestrator.md`, D11):
  changing that constant is a guard change, high risk 2.

## Ask me before
1. His, one question, drafted for the lead: "cada sesion por ejemplo Orquestador, Orquestador Plan y Senior" names
   three as examples. Do the numbered work sessions get a role card too? Proposed: yes, one short card, since the
   mechanism is the same and he said "cada sesion"; a no keeps three cards.
2. Not his, said with its cost: each double review of this document, by what the last three reads measured, about
   3.0 to 3.6M Claude tokens and 0.7M of Codex, against the 1.1M the command states; at most three.

## Depth pass
- 1. Method: an organization gives each post a job description apart from the day's assignment: its purpose, its
  duties, what it may not do, whom it answers to and whom it hands work to, kept as one controlled text and read
  again when a person takes the post. For an agent the same text is the part of its prompt that is re-read at
  every boundary where its memory is cut. Its standard: one text a role, short enough to be read whole, owned in
  one place, delivered by the path that already runs at each boundary, and checked by a test, not by a habit. The
  smallest change that meets it reuses what exists (searched by one read-only explorer, 42 tool calls, and by this
  session: codegraph for `roleOfTitle`, `resumeLines`, `orchestratorSkillContent`; grep for
  `leadTitle|seniorTitle|isLeadTitle|roleOfTitle` in `bin`, for `agent type|--agent|top-level session` in
  `odd/tasks`, for `set_session_output_style` in `bin` and `odd/tasks`; `ls bin/lib | grep -i role`, no file): the
  opening store and its first message, the resume hook, and the module that already holds the senior's brief.
- 2. Raw material (the explorer's citations; this session checked `bin/resume.mjs:872-874` and `:903-906`,
  `bin/lib/lead-prompt.mjs:4`, `bin/lib/lead-protocols.mjs:12-16`; the rest are the explorer's, not rechecked):
  - His words: `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 5054`.
  - Titles hold three roles: `bin/lib/sessions.mjs:1248-1261` (`ORQ`, `SR`, a number); a Plan's title holds none.
  - At a start. The lead: `LEAD_OPENING_PROMPT`, "Follow the js-harness-orchestrator skill"
    (`bin/lib/lead-prompt.mjs:4`). The senior: `SENIOR_WAIT_BRIEF` and `SENIOR_WAIT_BACKGROUND`
    (`bin/lib/lead-protocols.mjs:12-16`), the only text addressed to it. Any session: its stored opening, when the
    first message `notify --opening` prints is sent ("Read your opening with js-harness sessions --opening").
  - After a compaction. `resumeLines` speaks only on a compaction or a clear (`bin/resume.mjs:872-874`) and has
    one role branch, the orchestrator's (`:903-906`): the lead gets its relief file's path and "Read its last
    lines", though its charter is at that file's head (`bin/lib/manifest.mjs:155`); the block names neither the
    skill nor the charter. A senior goes down the work session's path.
  - In a new session under the same title: nothing from the hook (a plain `startup` returns no line); only the
    first message, if someone sends it.
  - On every turn: nothing chosen by role. `CLAUDE.md` and `AGENTS.md` name no role; the orchestrator skill is
    loaded when the model chooses it (`bin/lib/manifest.mjs:115`, `:272-276`). Three hooks can inject context
    (`bin/lib/hook-entries.mjs`): `resume --hook`, `rules --hook`, `resume --pause`; none reads the role to choose
    text, though the last resolves it for the inbox (`bin/lib/inbox.mjs:171`).
  - The senior's limits are decisions D1 to D14 of `odd/tasks/senior-orchestrator.md:153-214` and guard refusals:
    no text tells the senior itself. "A senior ends a task with `waiting`, never `closed`" is in no file
    (`grep -n waiting bin/lib/lead-protocols.mjs`: the brief alone); the lead said it by message on 2026-11-15.
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
  this senior closed its task with `closed` and took PR 894 out of draft while his approval was pending
  (`docs/FAILURES.md`, `land-took-pending-pr`, the `- Seen:` line of that day); the lead's correction, "you are
  the standing senior", came by message. What this does not show: that a role text would have prevented it, or
  that a lead or a Plan loses its role the same way; one session, one day.
  Verdict: supports
- 5. Request: "Give each role one short text the harness owns, apart from the opening: who the session is, what
  it does, what it never does, whom it hands work to, where questions go, and its limits. Deliver it by the paths
  that already run: with the opening at a start and in a new session, and in the resume block after a compaction.
  Hold it with a test."
  Adds: none

## Specs
1. "cada sesion por ejemplo Orquestador, Orquestador Plan y Senior deben saber cual es su rol y su funcion osea
   cada uno debe no solo tener un prompt inicial sino un rol especifico que haga que funcione mejor"
   (2026-11-16T18:58Z, 13:58 in his local time; 699d7c29 line 5054, the second half of his typed answer to
   question 315; whole in Log L17 of `odd/tasks/plan-orchestrator.md`)

## The design
- **A role card.** One constant a role, in one new module, `bin/lib/role-cards.mjs`, beside its test. Six parts,
  always in this order, the ones the lead asked of the Plan's phase 0 opening: who you are; what you do; what you
  never do; whom you hand work to and who sends you work; where his questions go; your limits and where the long
  text is. A budget, proposed at 1,500 characters a card and fixed at the build, is a constant the test reads.
  A card states nothing new: each line is a rule named by id, a decision of a feature document, or the lead's
  skill, and the build lists the source of each line in this Log. A line with no source (the senior's `waiting`)
  becomes a rule by `rules change` first, or leaves the card.
- **What each card says, in outline** (the texts are written at the build, from these sources):
  - The lead: leads this project's sessions; opens the work sessions and the senior, sends them work, puts every
    question to him and carries his answer, lands ready PRs; never implements, commits, writes in a worktree or
    answers for him (`bin/lib/manifest.mjs:155-156`); receives the plan from the Plan where one holds its role;
    its long text is the orchestrator skill and the charter at the head of its relief file.
  - The senior: the standing senior, one alive, on `rule:senior-model`; does one task at a time, sent by the lead
    alone, where more intelligence or complexity is needed (D5, D10); starts no session (D3); asks him nothing and
    records a question for the lead; reports by `notify`; ends a task waiting.
  - The Plan: the role section of its phase 0 opening (who it is, plans and does not execute, hands plans to the
    lead alone, reads no code), once `PLAN` is a role.
  - A work session, if question 1 says yes: owns one feature, its document, its branch and its PR; reports to
    the lead; records its questions for the lead, since every question reaches him in the lead's chat
    (`rule:questions-one-place`, `bin/lib/manifest.mjs:133`).
- **Delivery at a start and in a new session: the opening's own path.** `js-harness sessions --opening <title>`
  prints the card of the role that title holds, then the stored opening. Every pointer that exists already ends
  there: the first message `notify --opening` prints, and the resume block's "print it" line. So a new session
  under an old title gets its role from the same message that gives it its task, and the card is today's text,
  not the text of the day the opening was stored. A title that holds a role and has no stored opening prints the
  card alone. The senior's wait brief gains one sentence that names the command.
- **Delivery after a compaction: the resume block.** `resumeLines` prints the card itself, not a pointer, for a
  title that holds a role: a senior's branch, a Plan's once the role exists, and in the lead's branch two more
  lines, the skill to load again and that its charter is at the head of the relief file. The block's mode line
  reads the senior's own home, so a senior is not told to work as a work session.
- **A test holds it.** Every role `roleOfTitle` can return has a card, so a role added to the title parser with
  no card fails; a card has its six parts and is inside its budget; the opening and the resume block of a titled
  session carry it. The lead's skill opens with the lead's card, read from the constant.
- **Not proposed, and why.** A reminder on every tool call (the inbox path already knows the role): it spends
  tokens on each call of every session for a text that is lost only where memory is cut. An output style a role,
  set for each session: it is the one carrier that sits at the system level on every turn, but it needs his tap
  on a card at each start, is refused when he is away, replaces the project's one style, and whether it survives
  a compaction is not checked; it is his to reopen if the cards prove too weak. An agent type for a top-level
  session: the host's `start_session` takes none. A role section inside each stored opening (what phase 0 does by
  hand for the Plan): it goes stale with the opening and is rewritten by whoever stores the next one.
- **Cost.** To read: a card of 1,500 characters is about 400 tokens, at a start and once after each compaction;
  an estimate. To build: four small tasks on three files other sessions also hold, with two verifiers; not
  estimated in hours, since no closed stretch measures work of this kind.
- **Reach.** The cards ship with the harness, so every project gets them; the Plan's card is read only where a
  Plan holds its role.

## Tasks
One chain: T2, then T3 and T4 in either order, then T5. The board is checked before each.
- [ ] T1 (kind: design) (1) This document, its double reviews, the question for him. Route: inline, JH SR.
- [ ] T2 (kind: build) (1) `bin/lib/role-cards.mjs` and its test: the cards of the lead and the senior (a work
  session's if question 1 says yes), the six parts, the budget, a card for every role of `roleOfTitle`; the source
  of each line in this Log; `rules change` first for a line with no source. The lead's skill opens with its card
  (`bin/lib/manifest.mjs`). High risk 3 (the skill text ships to every project): a verifier.
- [ ] T3 (kind: build) (1) `js-harness sessions --opening` prints the card above the stored opening, and the card
  alone for a role's title with none; the senior's wait brief names the command (`bin/lib/lead-protocols.mjs`, the
  guard's test). Tests first. High risk 2 and 3 (a guard constant; an output sessions already read): a verifier.
- [ ] T4 (kind: build) (1) `bin/resume.mjs`: the card in the block for a senior, the two lines for a lead, the
  mode line from the senior's home. Fixture first: this session's block of 2026-11-16 00:57 local.
- [ ] T5 (kind: verify) (1) On a real compaction of a lead and of a senior, and in one new session under an old
  title, the block and the opening carry the card: the transcript lines in this Log. After T5 of
  `odd/tasks/plan-orchestrator.md`, the Plan's card moves from its phase 0 opening into the module, and the same
  check runs for a Plan.

## Log
- L1 2026-11-16, his words: Spec 1, read with `sessions --quote` by this session. The lead's message to JH SR
  asked for the design of "how each role reaches its session beyond the opening, so it survives a compaction and a
  new session", the search first, and a proposal with its double review and cost before anything is built.
- L2 The search: one read-only explorer (152,840 tokens, 42 tool calls) mapped role by moment; its grid is Depth
  pass item 2. Checked here before use: `bin/resume.mjs:872-874` and `:903-906`, `bin/lib/lead-prompt.mjs:4`,
  `bin/lib/lead-protocols.mjs:12-16`. Not checked by anyone: whether a skill or an output style survives a
  compaction, whether a stored opening exists for the senior's title on another machine, and the explorer's note
  that nothing stops a senior opening work sessions (D3 says it does not).
- L3 A reading left open: whether "cada sesion" takes in the numbered work sessions. Question 1.
