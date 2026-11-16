# session-roles — a role of its own for each session, beyond its opening (JH SR, design only)

## State
Design only, no code. Version 3, 2026-11-16, by JH SR at the lead's word (T12 of
`odd/tasks/plan-orchestrator.md`, its Spec 9). Read twice: read d8b87396 found 14 failures and read 7d891ab3
found 13, all 27 taken (L4, L5). Version 3 is the second correction: one delivery path for every role in place of
four. The third and last read (ea3a7283) still finds 21 real failures, four of them high (L6): they are open,
not corrected, and go to him as problems (`rule:double-review`: no fourth read). The design is not approved.
Branch `docs/session-roles`, cut from main at 035a2dcc, worktree `rule-lead-effort-split-aac740`. Nothing is
built. Three things are his ("Ask me before"): at the lead's word they are recorded as questions 316, 317 and
318, the first with the last read's dispute in its text (L7). The lead puts them to him one at a time.

## Goal
Each session that holds a role (the lead, the Plan, the senior) reads what its role is, from one text the harness
owns, when it starts working, after every compaction and in a new session under the same title.

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

## Ask me before
Three things are his, drafted for the lead, one at a time:
1. "cada sesion por ejemplo Orquestador, Orquestador Plan y Senior" names three as examples. Do the numbered work
   sessions get a role card too? Proposed: yes, one short card. A no is written as a named exemption with his
   answer's line.
2. Two lines the senior's card needs are in no rule today: a senior works one task at a time, and a senior's task
   ends with `waiting`, never `closed`. Each is a new rule, his to approve, changed by the lead on a `rule/`
   branch; until then neither is in the card. With the second, `notify --kind closed` from a senior's title is
   refused, so the line is held by a check and not by the card.
3. `CLAUDE.md` says every session holds one feature and commits on its feature branch ("How sessions run"); that
   is a work session's way, and it contradicts a lead, which never commits, and a standing senior. Proposed: that
   paragraph says it speaks of work sessions. It is his file.
Not his, said with its cost: read 1 cost 1,397,745 Claude tokens and 477,121 of Codex; read 2 cost 2,143,025 and
472,024; the command states 1.1M and 0.9M. The third read is estimated at 1.4 to 2.2M Claude and 0.5M Codex.

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
  resume hook on a plain `startup`, when a title is usually not set yet (`bin/resume.mjs:840`).
- 2. Raw material (the explorer's and the two reads' citations; this session checked `bin/resume.mjs:874` and
  `:905`, `bin/lib/lead-prompt.mjs:4`, `bin/lib/lead-protocols.mjs:12-16`, `bin/lib/manifest.mjs:134` and
  `:154-156`; the rest are theirs, not rechecked):
  - His words: `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 5054`.
  - Titles hold three roles: `bin/lib/sessions.mjs:1248-1261` (`orchestrator`, `senior`, and `work` for a
    number); a Plan's title holds none; no list of the roles is exported; `roleOfTitle` has 42 callers
    (`odd/tasks/senior-orchestrator.md`, D17).
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
    (`bin/lib/inbox.mjs:171`).
  - The other hooks (`bin/lib/hook-entries.mjs`): `resume --hook` and `backup --session-start` on SessionStart;
    `rules --hook` on SessionStart, UserPromptSubmit and SubagentStart, with no title logic; `doctor --hook` on
    SessionStart and the entry on a failed tool call (`:8-13`, `:55-60`), which print a message for him and give
    the model no context.
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
  every sub-agent on claude-opus-5-5 at medium". This session is the senior, on `rule:senior-model` at high: the
  hook read it as a work session. And one cost already paid for a role nobody had written down: on 2026-11-15
  this senior ended its task with a `closed` notice (the channel's record, 2026-11-16T03:44Z), which is what the
  one sentence the harness has on a senior's notices told it to do; the lead's correction, "you are the standing
  senior", came by message. What this does not show: that a role text would have prevented it, or that a lead or
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
- **A role card.** One constant a role, in one new module, `bin/lib/role-cards.mjs`, beside its test. Six parts,
  always in this order: who you are; what you do; what you never do; whom you hand work to and who sends you
  work; where his questions go; your limits. A budget of 1,500 characters a card is a constant the test reads.
- **Which title gets which card.** `bin/lib/sessions.mjs` exports one frozen list of the roles a title can hold,
  which `roleOfTitle` is built from, with no caller's result changed. The cards module gives every role on it a
  card or a named exemption with its reason, so a role added to the parser with neither fails the test. Two
  titles hold no role and still get a card, by a match of the cards module alone: a Plan's, `<code> PLAN · …`,
  from the first build, and a drifted lead's, by the reading D17 already has. That match gives no role anywhere
  else: no inbox, no guard, no board. When T5 of `plan-orchestrator.md` makes `PLAN` a role, the list gains it and
  the card is already there; that task names this module (its Log L18).
- **The senior's card, drafted, 778 characters**, each line with its source:
  > You are this project's senior (`<code> SR`): one standing session, on `rule:senior-model` at
  > `rule:senior-effort`.
  > What you do: the tasks the lead sends you as messages, where more intelligence or complexity is needed, such
  > as a design or a hard diagnosis.
  > What you never do: start a session; take work from anyone but the lead; let a sub-agent inherit your model:
  > each names the model `rule:session-model` gives its work.
  > Whom you hand work to: the lead, by `js-harness notify --to orchestrator`. The lead is your one sender.
  > His questions: you ask him nothing. Record a question with `notify --kind question` and the lead puts it to
  > him (`rule:questions-one-place`).
  > Your limits: decisions D1 to D14 of `odd/tasks/senior-orchestrator.md` say how you are started and sent work.
  Sources: one alive, D4; tasks as the lead's messages, D3, D5 and D6; starts no session, D3; the sub-agents'
  model, `bin/lib/lead-protocols.mjs:43`. Two lines wait for his rules (question 2) and are not in the draft.
- **The other cards, in outline**, written at the build under the same budget:
  - The lead: leads this project's sessions; opens the work sessions and the senior, sends them work, puts every
    question to him and carries his answer, lands ready PRs; never implements, commits or writes in a worktree,
    except what `rules change` and `rules switch` write from a `rule/` checkout, and never answers for him
    (`bin/lib/manifest.mjs:154-156`); receives the plan from the Plan where one holds its role; its long text is
    the skill's lead part and the charter at the head of its relief file (`rule:lead-charter`).
  - The Plan: who it is, that it plans and does not execute, hands plans to the lead alone and reads no code
    (`odd/tasks/plan-orchestrator.md`, "The role"; his answers in its Log L15 and L16).
  - A work session, on a yes to question 1: owns one feature, its document, its branch and its PR; reports to
    the lead; records its questions for the lead (`rule:questions-one-place`, `bin/lib/manifest.mjs:134`).
- **One home, in practice.** Where a card's sentence stands today in another text, that text renders it from the
  constant and keeps no copy: the who, does and never sentences of the skill's lead part
  (`bin/lib/manifest.mjs:154-156`) and the senior's sentence in the lead's protocols
  (`bin/lib/lead-protocols.mjs:43`). The skill's "Two kinds of session" (`:120`) names the roles and points to
  their cards. A check refuses a card's sentence copied anywhere else in the skill, and a test holds that the
  work session's part carries no line of the lead's card.
- **Delivery, one path at the start.** The hook that runs after a tool call already knows the session's title.
  The first time it sees a title that gets a card, it adds the card to the session, once: it finds its own
  earlier line in the session's transcript, as the pause notice is found, and says nothing again. So every role
  gets its card when it starts working, whoever started it and whatever its brief or opening said: a senior on
  its first task and its own model, never on the wait turn, which calls no tool; a Plan he opens by hand and
  titles afterwards; a new session under an old title. Not checked, and T3's first step: what that hook reads of
  the transcript on each call today, and what one more search of it costs.
- **Delivery after a compaction or a clear: the resume block.** `resumeLines` prints the card itself for every
  title that gets one, the lead's included, with two more lines in the lead's branch: the skill to load again,
  and that its charter is at the head of the relief file. The mode line reads the senior's own home. For a title
  that is not known or holds no card, the block says so in one line and names the command below.
- **To read a card again.** `js-harness sessions --role <title>` prints the card for that title: exit 0 with the
  card; 1 for a title that gets none; 2 for a call it cannot read (no title, or an option it does not take
  with). It records no reading.
- **What a check holds, and what stays unmeasured.** Held by tests: every role has a card or an exemption; six
  parts; the budget; one home; the card in the first hook line and in the resume block, on a compaction and on a
  clear, for each role, for a Plan's title, a drifted lead's and no title; the senior's rendered text keeps the
  sub-agents' line; the three exits. Held by code once his rule exists (question 2): a senior's `closed` notice
  is refused. Not measured: whether a session that has read its card works better. One event on one day is the
  whole record, so no count over the next tasks could tell the card from chance; T5 reads delivery, and says so.
- **Not proposed, and why.** A reminder on every tool call: it spends tokens on each call for a text lost only
  where memory is cut. An output style a role: the one carrier at the system level on every turn, but it needs
  his tap at each start, is refused when he is away, replaces the project's one style, and its surviving a
  compaction is not checked; his to reopen if the cards prove too weak. An agent type for a top-level session:
  `start_session` takes none. A role section inside each stored opening: it goes stale with the opening.
- **Cost.** To read: a card of 1,500 characters is about 400 tokens, once a session and once after each
  compaction; an estimate. The skill does not grow: its sentences move into the constants it renders. To build:
  three small tasks on five files other sessions also hold, with two verifiers; not estimated in hours, since no
  closed stretch measures work of this kind.
- **Reach.** The cards ship with the harness, so every project gets them; the Plan's card is read only by a
  session titled as a Plan.

## Tasks
One chain: T2, then T3, then T4. The board is checked before each. His three answers do not hold T2 to T4: a
card ships without the lines that wait for a rule.
- [ ] T1 (kind: design) (1) This document, its double reviews, the three questions for him. Route: inline, JH SR.
- [ ] T2 (kind: build) (1) The exported list of roles (`bin/lib/sessions.mjs`); `bin/lib/role-cards.mjs` and its
  test: the cards of the lead, the senior and the Plan (a work session's, or its exemption, by question 1), the
  match for a Plan's and a drifted lead's title, the six parts, the budget, the source of each line in this Log;
  the skill and the lead's protocols render what the cards now hold and lose those sentences, named in the
  commit (`bin/lib/manifest.mjs`, `bin/lib/lead-protocols.mjs`), with the check against a copy; `:120` names the
  roles. High risk 3 (a function with 42 callers; texts that ship to every project): a verifier.
- [ ] T3 (kind: build) (1) Delivery. First, read what the hook after a tool call reads today and measure one more
  search of the transcript; then the once-a-session line (`bin/resume.mjs`, `bin/lib/inbox.mjs`), the resume
  block for every title that gets a card, the lead's two lines, the mode line from the senior's home, the line
  for a title not known; `js-harness sessions --role` with its three exits (`bin/sessions.mjs`). Tests first, on
  a compaction and on a clear for each role; fixture: this session's block of 2026-11-16 00:57 local. High risk
  3 (texts every session already reads): a verifier.
- [ ] T4 (kind: verify) (1) From real sessions, the transcript lines in this Log: the card at the first tool call
  of a lead, of a senior and of a Plan, at whatever start comes next by itself (a senior is one alive, D4, so
  none is stopped to make a start), and in the block after a real compaction of each. It reads delivery only.
- [ ] T5 (kind: build) (1) Only on his answers, by the lead on a `rule/` branch: the two rules of question 2, the
  two lines in the senior's card, `notify --kind closed` refused for a senior's title with its test, and the
  sentence of `bin/lib/lead-protocols.mjs:43` that says the opposite; the paragraph of `CLAUDE.md` of question 3.

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
