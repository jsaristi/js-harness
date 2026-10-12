# Rules

Rendered by `js-harness rules render` from `bin/lib/rules-data.mjs` and `docs/rule-sources.json`: do not edit it. A rule is changed in its declaration (`odd/tasks/rule-hierarchy.md`, "How a rule is declared"), and this is the one text that shows a value. Until the command that changes a rule exists, the declarations are written by hand.

Hash `aee76ff2804f`. In force: 14 (9 of Sebastián, 5 of the project). Retired: 0.

## Sebastián's

### codex-review-floor
The most input tokens a Codex review may cost however small its commit: 300,000 input tokens a review.
- Read by: none.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-11.

### codex-review-rate
The most input tokens a Codex review may cost for each changed line of its slice, when that is more than the floor: 1,200 input tokens a changed line.
- Read by: none.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-11.

### review-effort
The effort a Codex review runs at: high.
- Read by: none.
- Since 2026-10-08. Row: reports. Source: his words of 2026-10-08, checked by a session on 2026-10-11.

### review-model
The one model a Codex review runs on: gpt-6.1-sol.
- Read by: none.
- Since 2026-10-08. Row: reports. Source: his words of 2026-10-06, 2026-10-08, checked by a session on 2026-10-11.

### reviewed-commit-lines
About how many changed lines a commit that will be reviewed stays under: 1,200 changed lines.
- Read by: none.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-11.

### subagent-effort
The effort every sub-agent is launched with: high.
- Read by: none.
- Since 2026-10-07. Row: reports. Source: his words of 2026-10-07, checked by a session on 2026-10-11.

### subagent-reader-model
The model of a sub-agent that explores, reviews or verifies: claude-opus-5-5.
- Read by: none.
- Since 2026-10-10. Row: reports. Source: his words of 2026-10-10, checked by a session on 2026-10-11.

### subagent-writer-model
The model of a sub-agent that writes scoped code, in this repository: claude-haiku-5-5.
- Read by: none.
- Since 2026-10-11. Row: reports. Source: his words of 2026-10-10, 2026-10-11, checked by a session on 2026-10-11.

### work-sessions
The most work sessions open at one time: 3 sessions.
- Read by: none.
- Since 2026-10-09. Row: reports. Source: his words of 2026-10-11, checked by a session on 2026-10-11.

## The project's

### control-phrase-min
The shortest phrase by which a control or a rule in prose is found in its file: 12 characters.
- Read by: `bin/lib/failures.mjs`, `bin/lib/rules.mjs`.
- Since 2026-10-11. Row: reports. Source: design, `odd/tasks/rule-hierarchy.md`.

### gate-wait
How long a gate waits for its turn of the lock before it gives up, by default: 60 minutes. The flag `--wait` overrides it for one run.
- Read by: none.
- Since 2026-10-11. Row: reports. Source: design, `odd/tasks/gate-lock.md`.

### review-part-files
The most files one part of a Codex review holds: 40 files.
- Read by: none.
- Since 2026-10-09. Row: reports. Source: design, `odd/tasks/codex-review-lean.md`.

### review-part-lines
The most changed lines one part of a Codex review holds, by default: 400 changed lines. The flag `--part-lines` overrides it for one run.
- Read by: none.
- Since 2026-10-09. Row: reports. Source: design, `odd/tasks/codex-review-cost.md`.

### review-parts-unflagged
The most parts a Codex review runs in without being told its count: 6 parts. The flag `--max-parts` overrides it for one run.
- Read by: none.
- Since 2026-10-09. Row: reports. Source: design, `odd/tasks/codex-review-cost.md`.

## Retired

None.
