# Rules

Rendered by `js-harness rules render` from `bin/lib/rules-data.mjs` and `docs/rule-sources.json`: do not edit it. A rule is changed with `js-harness rules change <id>`, which writes its declaration (`odd/tasks/rule-hierarchy.md`, "How a rule is declared"), its source and this list together, and this is the one text that shows a value.
The list holds no engine version and no date of a check: `js-harness rules applied` reads them from the session records.

Hash `de4a8300404e`. In force: 31 (15 of Sebastián, 16 of the project). Retired: 0.

## Sebastián's

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

### questions-one-place
Every question of the project reaches the user in the orchestrator's chat, through the host's question tool, recorded before it is asked: "## Questions to the user Every question of the project reaches the user in one place: the orchestrator's chat, through the host's question tool, one question a call, the recommended option first."
- Home: `bin/lib/manifest.mjs`.
- Since 2026-10-14. Row: reports. Source: his words of 2026-10-13, 2026-10-13, checked by a session on 2026-10-14.

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

### session-effort
The effort a session runs at: high.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/rules.mjs`.
- Since 2026-10-10. Row: reports. Source: his words of 2026-10-10, checked by a session on 2026-10-12.

### session-model
The model a session runs on: claude-opus-5-5.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/rules.mjs`.
- Since 2026-10-10. Row: reports. Source: his words of 2026-10-10, checked by a session on 2026-10-12.

### sessions-open-in-sidebar
The one way a session opens another in this repository, so that it is a row in his sidebar: the tools that open one in the app's Routines or in the cloud are refused: start_session.
- Of this repository only: not in force in a project that installs the harness.
- Read by: `bin/lib/guard.mjs`.
- Since 2026-10-15. Row: reports, against the failure `session-opened-unseen`. Source: his words of 2026-10-15, 2026-10-15, checked by a session on 2026-10-15.

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

### work-sessions
The most work sessions open at one time: 3 sessions.
- Of this repository only: not in force in a project that installs the harness.
- Read by: none.
- Since 2026-10-09. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-11.

## The project's

### agents-budget
The most estimated tokens AGENTS.md may hold, since every session pays it on every turn: 1,500 estimated tokens.
- Read by: `bin/check.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `docs/ROADMAP.md`.

### contract-run-timeout
How long each done-when command of a contract run may run, unless the run says otherwise: 30 minutes. The flag `--timeout` overrides it for one run.
- Read by: `bin/contract.mjs`.
- Since 2026-10-14. Row: reports. Source: design, `odd/tasks/task-contract.md`.

### control-phrase-min
The shortest phrase by which a control or a rule in prose is found in its file: 12 characters.
- Read by: `bin/lib/failures.mjs`, `bin/lib/rules.mjs`.
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
- Read by: `bin/gate.mjs`, `bin/js-harness.mjs`, `bin/lib/manifest.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/gate-turn-guards.md`.

### gate-wait
How long a gate waits for its turn of the lock before it gives up, by default: 60 minutes. The flag `--wait` overrides it for one run.
- Read by: `bin/js-harness.mjs`, `bin/lib/gate-lock.mjs`, `bin/lib/manifest.mjs`.
- Since 2026-10-11. Row: reports. Source: design, `odd/tasks/gate-lock.md`.

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

### sensor-timeout
How long one sensor of the gate may run before it is stopped and the commit refused: 20 minutes.
- Read by: `bin/check.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/remote-control.md`.

### session-stall
How long a work session that holds handed work may make no commit, send no notice and run no gate before the board and the lead's heartbeat name it stalled: 60 minutes. The flag `--stall` overrides it for one run.
- Read by: `bin/sessions.mjs`.
- Since 2026-10-16. Row: reports. Source: design, `odd/tasks/stalled-sessions.md`.

### wait-every
How often js-harness wait checks its condition, unless --every says otherwise: 120 seconds. The flag `--every` overrides it for one run.
- Read by: `bin/lib/manifest.mjs`, `bin/wait.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/session-channel.md`.

### wait-for
How long js-harness wait waits before it says the time ran out, unless --for says otherwise: 480 minutes. The flag `--for` overrides it for one run.
- Read by: `bin/lib/manifest.mjs`, `bin/wait.mjs`.
- Since 2026-10-15. Row: reports. Source: design, `odd/tasks/session-channel.md`.

## Retired

None.
