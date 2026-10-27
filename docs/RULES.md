# Rules

Rendered by `js-harness rules render` from `bin/lib/rules-data.mjs` and `docs/rule-sources.json`: do not edit it. A rule is changed with `js-harness rules change <id>`, which writes its declaration (`odd/tasks/rule-hierarchy.md`, "How a rule is declared"), its source and this list together, and this is the one text that shows a value.
The list holds no engine version and no date of a check: `js-harness rules applied` reads them from the session records.

Hash `31cf8015c650`. In force: 66 (40 of Sebastián, 26 of the project). Retired: 2.

## Sebastián's

### announce-finished
A session says when it finished and where to return, watches its context, and a rule has one home: "## The recap Each reply that closes a stretch of work carries: - one line a session: its state, the effort mode its kind of work calls for and why; - by title, the sessions to archive and the ones stopped, with what each waits for; a session a scheduled task opened is named as a routine; - the Codex meter, read at that moment, when the project reviews with Codex; - what waits for the user in a session, said only after reading that session at that moment; - when a stretch or a session ends, that it ended and which session to return to."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-09-28, 2026-10-07, 2026-10-07, 2026-10-10, 2026-10-10, 2026-10-11, 2026-10-12, checked by the command on 2026-10-22.

### ask-before-away
Before he leaves, the lead asks for everything the stretch needs, and while he is away repeats nothing: "- Before the user leaves, ask in that reply for everything the stretch will need: the decisions in the queue, the sessions to open and their permission mode, what the machine and the plan's limits allow."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-11, 2026-10-11, checked by the command on 2026-10-22.

### background-task-declared
A background task says what it is for and what ends it, and is stopped when its condition resolves: "A background task a session starts (a wait, a watch, a timer) says in its description what it is for and what ends it, and the session writes it to its state with who stops it; when its condition resolves another way, it is stopped in that same step."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-14, checked by the command on 2026-10-22.

### codex-review-floor
The most input tokens a Codex review may cost however small its commit: 300,000 input tokens a review.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/codex-review-allowance.mjs`.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-11.

### codex-review-margin
How far over its allowance the plan of a Codex review may read and still count as inside it: 5 percent of the allowance.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/codex-review-allowance.mjs`.
- Since 2026-10-12. Row: reports. Source: his words of 2026-10-12, checked by a session on 2026-10-12.

### codex-review-rate
The most input tokens a Codex review may cost for each changed line of its slice, when that is more than the floor: 1,200 input tokens a changed line.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/codex-review-allowance.mjs`.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-11.

### context-pause
The share of its context window at which a session pauses, writes its state and judges whether what is left fits before the host compacts: 88 percent of the context window. The flag `--context-pause` overrides it for one run.
- Read by: `bin/lib/sessions.mjs`.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-12.

### double-review
A design before it is built, and what reaches the user to decide, passes two read-only readers that did not write it: "- A design before it is built, and a plan, a design, an analysis with figures, a protocol or a change of the charter that reaches the user, asked or reported, first passes two read-only readers that did not write it: one attacks its claims, one looks only for what is missing."
- Home: `bin/lib/protocols-skill.mjs`.
- Looked at again on 2026-11-16.
- Since 2026-10-16. Row: reports, against the failure `proposal-unreviewed`. Source: his words of 2026-10-11, 2026-10-16, checked by the command on 2026-10-16.

### fixed-load-budget
The fixed load of a session at its first turn, the median of its latest sessions, above which the fixed-load row warns: 100,000 tokens.
- Read by: `bin/lib/fixed-load.mjs`.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-15, checked by the command on 2026-10-24.

### lead-charter
What the lead does alone and tells him after, and what stays his, asked one at a time: "Within it you open the next feature's work session, send plan steps and notices to work sessions (\`js-harness notify\`), merge pull requests by the rules below, remove the worktrees of merged features and update the installed command."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-09, 2026-10-11, 2026-10-09, 2026-10-09, 2026-10-10, 2026-10-10, 2026-10-15, 2026-10-15, 2026-10-24, checked by the command on 2026-10-22.

### live-board
The harness never works as a black box: work sessions write each event as a notice (a session starts or ends, a step finishes, a pull request opens or merges, a decision is made, spend is reported), the lead sends them to the live board, a page that updates by itself, and points every reply to it: "- Every event of your work reaches the user's live board as a notice: \`js-harness notify --to orchestrator\` with \`opened\` when you start, \`note\` when a step of your plan finishes, a pull request opens or merges, a decision is made or you report spend, and \`ready\` and \`closed\` as below."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-27. Row: reports. Source: his words of 2026-10-27, 2026-10-27, 2026-10-27, 2026-10-27, checked by the command on 2026-10-27.

### mistake-report
A mistake is reported with what it was, its fix, what prevents it, how it enters the harness and how it is proven later: "What stops it from happening again: a check before a line, a line before a protocol."
- Home: `bin/lib/protocols-skill.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-10, 2026-10-10, checked by the command on 2026-10-22.

### question-context
Every question to the user opens with what it is for: the work it serves and what its answer changes: "- Every question opens with what it is for: the work it belongs to, by the name the user knows (the project, the feature, the session), and what its answer changes."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-22, checked by the command on 2026-10-22.

### questions-one-place
Every question of the project reaches the user in the orchestrator's chat, through the host's question tool, recorded before it is asked: "## Questions to the user Every question of the project reaches the user in one place: the orchestrator's chat, through the host's question tool, one question a call, the recommended option first."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-14. Row: reports. Source: his words of 2026-10-13, 2026-10-13, checked by a session on 2026-10-14.

### recap-effort-line
The lead's recap names each session's effort mode for its kind of work, and why: "## The recap Each reply that closes a stretch of work carries: - one line a session: its state, the effort mode its kind of work calls for and why; - by title, the sessions to archive and the ones stopped, with what each waits for; a session a scheduled task opened is named as a routine; - the Codex meter, read at that moment, when the project reviews with Codex; - what waits for the user in a session, said only after reading that session at that moment; - when a stretch or a session ends, that it ended and which session to return to."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-11, 2026-10-11, checked by the command on 2026-10-22.

### remote-control-yes
Turning Remote Control back on in each work session after a restart of the Claude app, which turns it off: the review step of a host update (doctor's host-update row) does it without asking only where this rule holds, and asks the user first anywhere else: a standing yes of 2026-10-15.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/host-update.mjs`.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-19, checked by the command on 2026-10-24.

### reply-five-states
A reply ends in one of five states, and a question is his decision alone, explained before it is asked: "- A reply ends in one of five states."
- Home: `bin/lib/protocols-skill.mjs`.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-07, 2026-10-03, 2026-10-03, 2026-10-07, 2026-10-10, 2026-10-08, 2026-10-08, 2026-10-11, 2026-10-20, checked by the command on 2026-10-24.

### report-table
When the user asks what was done, the lead's status report shows each section that holds items as a table: "- Show each section that holds items as a table: one row an item, with the columns that item needs (what it is, its state, what it gives the user)."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-20, checked by the command on 2026-10-24.

### reports-spanish-visual
What the user reads to understand or decide (research, a proposal, an audit, a map, a report) reaches them in Spanish as a graphic, didactic page, an Artifact with diagrams, bars and cards, never a raw English markdown file; the repository's English document stays the source: "- What the user reads to understand or decide (research, a proposal, an audit, a map, a report) reaches them in their language as a visual, didactic page (\`rule:reports-spanish-visual\`): an Artifact with diagrams, bars and cards, never a raw markdown file; the repository's English document stays the source."
- Home: `bin/lib/protocols-skill.mjs`.
- Since 2026-10-26. Row: reports. Source: his words of 2026-10-26, checked by the command on 2026-10-26.

### restart-announce
Before the user restarts or updates, or asks for a pause for one, the lead pauses every session at a safe point, and only then tells them in capitals: "- Then tell the user in capitals: YA PUEDES REINICIAR Y ACTUALIZAR!!!"
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-23. Row: reports. Source: his words of 2026-10-23, checked by the command on 2026-10-23.

### reuse-first
Before adding a command, an option, a function, a protocol, a rule or a document, a session searches for one that already does it, and amends that one: "- Before adding a command, an option, a function, a protocol, a rule or a document, search for one that already does it (codegraph_explore, \`js-harness rules\`, the protocols and the skills); amend that one instead of adding a second, and say in the commit what was searched."
- Home: `bin/lib/protocols-skill.mjs`.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-23, checked by the command on 2026-10-24.

### review-effort
The effort a Codex review runs at: medium.
- Read by: `bin/codex-review.mjs`.
- Since 2026-10-12. Row: reports. Source: his words of 2026-10-08, 2026-10-12, checked by a session on 2026-10-12.

### review-model
The one model a Codex review runs on: gpt-6.1-sol.
- Read by: `bin/codex-review.mjs`.
- Since 2026-10-08. Row: reports. Source: his words of 2026-10-06, 2026-10-08, checked by a session on 2026-10-11.

### reviewed-commit-lines
About how many changed lines a commit that will be reviewed stays under: 1,200 changed lines.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/check.mjs`.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-11.

### rules-live-in-the-harness
A rule he gives is cemented in the harness where something acts on it, never only in memory: "- A rule is recorded only where something acts on it, in this order of preference: a check a command runs, a line of \`AGENTS.md\`, a protocol."
- Home: `bin/lib/protocols-skill.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-07, 2026-10-08, 2026-10-09, 2026-10-09, 2026-10-10, 2026-10-15, checked by the command on 2026-10-22.

### session-effort
The effort a session runs at: high.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/guard.mjs`, `bin/rules.mjs`.
- Since 2026-10-10. Row: reports. Source: his words of 2026-10-10, checked by a session on 2026-10-12.

### session-housekeeping
Each recap names the sessions to archive and the stopped ones, and the lead archives finished sessions without asking: "## The recap Each reply that closes a stretch of work carries: - one line a session: its state, the effort mode its kind of work calls for and why; - by title, the sessions to archive and the ones stopped, with what each waits for; a session a scheduled task opened is named as a routine; - the Codex meter, read at that moment, when the project reviews with Codex; - what waits for the user in a session, said only after reading that session at that moment; - when a stretch or a session ends, that it ended and which session to return to."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-11, 2026-10-15, 2026-10-13, checked by the command on 2026-10-22.

### session-model
The model a session runs on: claude-opus-5-5.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/rules.mjs`.
- Since 2026-10-10. Row: reports. Source: his words of 2026-10-10, checked by a session on 2026-10-12.

### session-prompts
Sessions pass notices through the channel, each gives prompts only for itself, and the lead keeps the order: "## A work session - Give prompts only for yourself. A prompt meant for another session names that session in its first line."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-06, 2026-10-06, 2026-10-09, 2026-10-09, 2026-10-10, 2026-10-06, 2026-10-06, 2026-10-06, 2026-10-06, checked by the command on 2026-10-22.

### session-title
The shape of the title of a session started with start_session: <code> is the project's own identifier, declared in harness.json "code", and the number is the next free one of that code, as js-harness sessions --next-number prints it (a new lead takes ORQ for the number): <code> <n> · <purpose>, <code> from harness.json "code".
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/session-title-guard.mjs`.
- Since 2026-10-19. Row: reports. Source: his words of 2026-10-19, 2026-10-19, checked by the command on 2026-10-19.

### sessions-open-in-sidebar
The way a session opens another in this repository, so that the user can see every session: start_session wherever it starts one, and js-harness sessions start where start_session would only leave a card; the tools that open one in the app's Routines or in the cloud are refused: start_session.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/guard.mjs`.
- Since 2026-10-15. Row: reports, against the failure `session-opened-unseen`. Source: his words of 2026-10-24, checked by the command on 2026-10-24.

### status-report
Asked how the work goes, the lead reports everything since the last report, in detail: "## The status report When the user asks how the work is going, how much is done, or what you have done, the answer is a report of everything since the last report, in detail: never a line that all goes well."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-20, checked by the command on 2026-10-22.

### subagent-effort
The effort every sub-agent is launched with: high.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/rules.mjs`.
- Since 2026-10-07. Row: reports. Source: his words of 2026-10-07, checked by a session on 2026-10-11.

### subagent-reader-model
The model of a sub-agent that explores, reviews or verifies: claude-opus-5-5.
- Passed on a call as `opus`.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/guard.mjs`.
- Since 2026-10-10. Row: reports. Source: his words of 2026-10-10, checked by a session on 2026-10-11.

### subagent-writer-model
The model of a sub-agent that writes scoped code, in this repository: claude-haiku-5-5.
- Passed on a call as `haiku`.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/guard.mjs`.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-10, 2026-10-11, checked by a session on 2026-10-11.

### terminal-note
The note that ends a command typed into his Terminal panel, saying what it does in everyday words, so he reads it beside the command where it runs: the guard refuses a run_in_terminal command without it: <command>; Write-Host 'NOTE: <what it does>'.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/guard.mjs`.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-18, checked by the command on 2026-10-24.

### wording-is-the-need
His wording is the need, not the specification: the agent recommends what is best and says where it differs: "The owner's wording is the need, not the specification: an answer to a proposal of theirs says the need that was understood, what would be done differently from their words and why, and what it costs or is not known; only then is it recorded."
- Home: `bin/lib/project.mjs`.
- Since 2026-10-22. Row: reports. Source: his words of 2026-10-08, 2026-10-10, checked by the command on 2026-10-22.

### work-sessions-private-windows
The most work sessions open at one time when only Windows is used: 3 sessions.
- Of this repository only: not in force in a project that installs the harness.
- Read by: none.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-24, checked by the command on 2026-10-24.

### work-sessions-private-wsl
The most work sessions open at one time in a private repository used with WSL: 6 sessions.
- Of this repository only: not in force in a project that installs the harness.
- Read by: none.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-24, checked by the command on 2026-10-24.

### work-sessions-public
The most work sessions open at one time in a public repository: 12 sessions.
- Of this repository only: not in force in a project that installs the harness.
- Read by: none.
- Since 2026-10-24. Row: reports. Source: his words of 2026-10-24, checked by the command on 2026-10-24.

## The project's

### agents-budget
The most estimated tokens AGENTS.md may hold, since every session pays it on every turn: 1,500 estimated tokens.
- Read by: `bin/check.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `docs/ROADMAP.md`.

### ci-gate-bound
How long a commit gate sent to GitHub waits for its run to end, from the push, before it cancels the run and runs the gate on this machine: 8 minutes.
- Read by: `bin/lib/ci-gate.mjs`.
- Since 2026-10-16. Row: reports. Source: design, `odd/tasks/commit-gates-first.md`.

### claude-md-budget
The most estimated tokens the root CLAUDE.md may hold, since Claude pays it with the AGENTS.md it imports on every turn: 2,300 estimated tokens.
- Read by: `bin/lib/claude-md-budget.mjs`.
- Since 2026-10-27. Row: reports. Source: design, `docs/proposals/harness-diet.md`.

### contract-run-timeout
How long each done-when command of a contract run may run, unless the run says otherwise: 30 minutes. The flag `--timeout` overrides it for one run.
- Read by: `bin/contract.mjs`.
- Since 2026-10-14. Row: reports. Source: design, `odd/tasks/task-contract.md`.

### control-phrase-min
The shortest phrase by which a control or a rule in prose is found in its file: 12 characters.
- Read by: `bin/lib/failures.mjs`, `bin/lib/memory-feedback-guard.mjs`, `bin/lib/rules.mjs`.
- Since 2026-10-11. Row: reports. Source: design, `odd/tasks/rule-hierarchy.md`.

### gate-log-command
The longest command a line of the gate log holds, since what follows gate -- can hold a secret: 120 characters.
- Read by: `bin/lib/gate-log.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/gate-log.md`.

### gate-log-size
The size past which the gate log is renamed over its older file, so the log stays near a megabyte: 512 KiB.
- Read by: `bin/lib/gate-log.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/gate-log.md`.

### gate-max
How long a command run under the gate lock may run before it is stopped with every process it started: 30 minutes. The flag `--max` overrides it for one run.
- Read by: `bin/gate.mjs`, `bin/js-harness.mjs`, `bin/lib/manifest.mjs`, `bin/throughput.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/gate-turn-guards.md`.

### gate-wait
How long a gate waits for its turn of the lock before it gives up, by default: 60 minutes. The flag `--wait` overrides it for one run.
- Read by: `bin/js-harness.mjs`, `bin/lib/gate-lock.mjs`, `bin/lib/manifest.mjs`.
- Since 2026-10-11. Row: reports. Source: design, `odd/tasks/gate-lock.md`.

### memory-feedback-home
Where a rule he states lives: a feedback note of the project's Claude Code memory folder is written only when it names the rule's home in the repository, and js-harness guard refuses it otherwise: a declared rule:<id>, or a phrase of AGENTS.md quoted on a line that names it.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/memory-feedback-guard.mjs`.
- Since 2026-10-22. Row: reports. Source: design, `odd/tasks/memory-feedback-home.md`.

### memory-index-bytes
The bytes the memory index may hold before a memory hygiene pass is due: 4,000 bytes.
- Read by: `bin/lib/memory-hygiene.mjs`.
- Since 2026-10-17. Row: reports. Source: design, `odd/tasks/memory-hygiene.md`.

### memory-pass-days
The days after a verified memory hygiene pass when the next is due, if a note was written since: 7 days.
- Read by: `bin/lib/memory-hygiene.mjs`.
- Since 2026-10-17. Row: reports. Source: design, `odd/tasks/memory-hygiene.md`.

### person-present
How long after the user last wrote in a session a question is put to them at once with the question tool: 15 minutes.
- Read by: none.
- Since 2026-10-14. Row: reports. Source: design, `odd/tasks/session-channel.md`.

### review-part-files
The most files one part of a Codex review holds: 40 files.
- Read by: `bin/lib/codex-review-parts.mjs`.
- Since 2026-10-09. Row: reports. Source: design, `odd/tasks/codex-review-lean.md`.

### review-part-lines
The most changed lines one part of a Codex review holds, by default: 400 changed lines. The flag `--part-lines` overrides it for one run.
- Read by: `bin/lib/codex-review-parts.mjs`.
- Since 2026-10-09. Row: reports. Source: design, `odd/tasks/codex-review-cost.md`.

### review-parts-unflagged
The most parts a Codex review runs in without being told its count: 6 parts. The flag `--max-parts` overrides it for one run.
- Read by: `bin/lib/codex-review-plan.mjs`.
- Since 2026-10-09. Row: reports. Source: design, `odd/tasks/codex-review-cost.md`.

### review-timeout
How long a Codex review may run before it is stopped as stalled: 30 minutes.
- Read by: `bin/codex-review.mjs`.
- Since 2026-10-14. Row: reports. Source: design, `odd/tasks/codex-exec-review.md`.

### sensor-silence
How long one sensor of the gate may write nothing before it is stopped and the commit refused: 20 minutes.
- Read by: `bin/check.mjs`.
- Since 2026-10-16. Row: reports. Source: design, `odd/tasks/first-version.md`.

### sensor-timeout
How long one sensor of the gate may run before it is stopped and the commit refused: 60 minutes.
- Was: 20 minutes until 2026-10-16.
- Read by: `bin/check.mjs`.
- Since 2026-10-16. Row: reports. Source: design, `odd/tasks/first-version.md`.

### session-stall
How long a work session that holds handed work may make no commit, send no notice and run no gate before the board and the lead's heartbeat name it stalled: 60 minutes. The flag `--stall` overrides it for one run.
- Read by: `bin/lib/manifest.mjs`, `bin/loop.mjs`, `bin/sessions.mjs`.
- Since 2026-10-16. Row: reports. Source: design, `odd/tasks/stalled-sessions.md`.

### throughput-backfill-days
How many closed days back the heartbeat writes a missing throughput snapshot for: 14 days.
- Read by: `bin/throughput.mjs`.
- Since 2026-10-17. Row: reports. Source: design, `odd/tasks/throughput-review.md`.

### throughput-compare-days
How many days a side a throughput comparison needs before it judges a change: 7 days.
- Read by: `bin/lib/throughput.mjs`.
- Since 2026-10-17. Row: reports. Source: design, `odd/tasks/throughput-review.md`.

### throughput-quiet-days
How many days after the last recorded throughput review the next is due once the review has gone quiet: 7 days.
- Read by: `bin/lib/throughput.mjs`, `bin/throughput.mjs`.
- Since 2026-10-17. Row: reports. Source: design, `odd/tasks/throughput-review.md`.

### throughput-quiet-runs
How many recorded throughput reviews in a row that found nothing make the review weekly instead of daily: 2 reviews.
- Read by: `bin/lib/throughput.mjs`.
- Since 2026-10-17. Row: reports. Source: design, `odd/tasks/throughput-review.md`.

### wait-every
How often js-harness wait checks its condition, unless --every says otherwise: 120 seconds. The flag `--every` overrides it for one run.
- Read by: `bin/lib/manifest.mjs`, `bin/wait.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/session-channel.md`.

### wait-for
How long js-harness wait waits before it says the time ran out, unless --for says otherwise: 480 minutes. The flag `--for` overrides it for one run.
- Read by: `bin/lib/manifest.mjs`, `bin/wait.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/session-channel.md`.

## Retired

### reply-four-states
A reply ends in one of five states, and a question is his decision alone, explained before it is asked. Retired on 2026-10-24: read `reply-five-states` instead.
- Source: his words of 2026-10-07, 2026-10-03, 2026-10-03, 2026-10-07, 2026-10-10, 2026-10-08, 2026-10-08, 2026-10-11, 2026-10-20, checked by the command on 2026-10-24.

### work-sessions
The most work sessions open at one time. Retired on 2026-10-24: read `work-sessions-public`, `work-sessions-private-wsl`, `work-sessions-private-windows` instead.
- Was: 3 sessions until 2026-10-24.
- Source: his words of 2026-10-24, checked by the command on 2026-10-24.
