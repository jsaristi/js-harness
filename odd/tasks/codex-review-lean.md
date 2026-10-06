# Codex review, lean and measured

Locator: `odd/tasks/codex-review-lean.md` · Engram mirror: `odd/codex-review-lean/tasks` · Branch:
`feat/codex-review-lean`, in the linked worktree `D:\js-harness-worktrees\codex-review-lean`

## Goal
`js-harness codex-review` runs the Codex review in a session that loads only what a review needs,
measures every attempt, and replaces today's configuration only on numbers that show it finds the
same or more with fewer tokens.

## Why
A review session today starts from Sebastián's whole Codex home: 25,698 estimated tokens of
instructions from files on every request, none of them about reviewing (the 87,563 bytes of the
global `AGENTS.md` are delegation, routing, gentle-ai's own review, engram and persona). That
block costs tokens and also steers the reviewer: three saved reviews refused a range because it
"exceeds the repository's mandatory delegation budget". And nothing measures a review: the
command drops the usage Codex reports, so "it costs more than it did" cannot be checked
(`odd/tasks/codex-parity.md` in `feat/codex-parity`, Progress, 2026-10-06). The reviews draw on
the same subscription cap as his own Codex work, so a review that is complete and cheap is worth
a feature; a cheaper one that finds less is not, which is why the switch waits on a comparison.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/codex-review-lean.md` exits 0
- `node --test bin/codex-review.test.mjs` exits 0
- `node --test "evals/review/*.test.mjs"` exits 0
- `node evals/review/report.mjs --require-complete` exits 0, so every cell of the comparison is
  recorded
- `docs/ROADMAP.md` records the result of the comparison (per configuration: findings, seeded
  defects found, tokens, wall time) and which configuration `codex-review` runs by default
- This document holds the proposal for the Codex plugin (the `doctor` row, `codex:rescue`, the
  SessionStart hook), with the numbers it rests on, for Sebastián to decide

## In scope / Out of scope
- In: `bin/codex-review.mjs`, `bin/lib/` (the run log, the usage reader, the review prompt and
  its schema, the session builder), their tests, `evals/review/` (the seeded diff, the scorer,
  the comparison and its report), `evals/results/review/`, `docs/ROADMAP.md`, the installed skill
  text in `bin/lib/manifest.mjs`, this document, and `AGENTS.md` only if a line must change and
  the result fits its budget.
- Out: the Codex plugin for Claude Code (`codex@openai-codex`): this feature proposes, it removes
  and changes nothing of it. The worktree `D:\js-harness-worktrees\codex-parity` and F6's files
  (`evals/codex-*.mjs`, `evals/suite.mjs`, `evals/results/codex/`): F6 is paused there and
  resumes on them. gentle-ai's review. The real `~/.codex`, engram store and gentle-ai state.

## Constraints
- Decided, not reopened (Sebastián, 2026-10-06): the review runs on `gpt-6.1-sol` at `medium`,
  set by the command itself; it loads the diff, read access to the repository, the project's
  `AGENTS.md` and Codex's own review rubric, and leaves out gentle-ai's orchestrator, ODD,
  engram, persona, skills, plugins, MCP servers and hooks; it is an integration of this
  repository over `codex exec review`, not over the plugin.
- Nothing writes into the real `~/.codex`, and the content of `auth.json` is never read, parsed,
  printed, logged or committed — because Codex refreshes that file in place and a refresh inside
  a copy may leave the real login invalid (unverified; `odd/tasks/codex-parity.md`, Constraints),
  and the login is his. If a home of the review's own is needed, the file is copied as bytes by
  code and the real tree is hashed before and after a first run, before any review rests on it.
- Every call to the model through Codex is asked first, with the number of reviews — because
  they draw on the subscription's usage cap, which cannot be measured in advance. T5 and T12
  call the model; no other task does.
- Codex, gentle-ai and engram are not updated while this feature is open — because F6 resumes on
  the stack it started on (codex-cli 0.160.0, gentle-ai 4.0.0, engram 3.1.0) and its suite
  refuses another.
- The new configuration lives beside today's until T13 — because the switch is decided by the
  comparison: it replaces the current one only if it finds the same or more with fewer tokens.
- `check --push` keeps reading `codex-reviews.jsonl` as it does — because a failed attempt must
  never count as a review. Attempts and their measurements go to a second file in the same
  folder of the git common dir, which deleting undoes exactly.
- `AGENTS.md` is at 1,497 of 1,500 estimated tokens — so a line changes there only by replacing
  words, and the gate measures it.
- Zero dependencies, and the review's prompt and schema ship inside `bin/` — because
  `package.json` publishes `bin/` and `AGENTS.md` only, and every command runs with no install.
- Never two gates at once; a commit runs in the background; after a failed gate `git config
  --local core.bare` is read in `D:\js-harness` before anything else, and `git status --short`
  after every gate — because parallel spawns on this host fail with `0xC0000142`, a gate from a
  linked worktree turned the repository bare twice on 2026-10-04, and a gate once left an
  untracked file behind (`odd/tasks/codex-parity.md`, Constraints and Follow-ups).

## Effort
high

## Ask me before
Any call to the model through Codex (the probes of T5, the runs of T12), with the count of
reviews; copying `auth.json` anywhere, if T4 finds no way without it; changing the default
configuration of `codex-review` (T13); anything about the plugin (T14 only proposes); push, pull
request, merge.

## TDD
Mode: strict (source: user global config). Runner: `node --test`. Exceptions: T4 is reading and
writing down; T5's proof and T12 are runs of the real CLI, checked by their recorded output.

## Delivery
Forecast: ~1,900 authored lines with tests (usage reader and run log ~350, session builder ~200,
home if needed ~300, prompt, schema and parser ~350, splitting ~300, `evals/review/` ~400), above
the ~400 slice budget. Strategy: `ask-on-risk`; chain strategy `stacked-to-main`, reusing
Sebastián's choice for the earlier features (`odd/tasks/evals.md`, Delivery): each slice its own
pull request against `main`, merged in order. Slices: A = T1–T2, B = T3–T5, C = T6–T7,
D = T8–T9, E = T10–T15. Review boundary starts at the branch point, `3915b88`.

## Tasks
### Slice A — measure
- [ ] T1 A reader of what a review session spent, in `bin/lib/`: from Codex's JSONL, tokens
  (input, cached, output, reasoning) summed over every `turn.completed`, the count of requests,
  and the items by type (shell commands, MCP calls, sub-agent calls, messages) — route:
  delegated writer (the reader and its test; `evals/agent-output.mjs` is the reference, `bin/`
  cannot import it)
- [ ] T2 Every attempt of `codex-review` leaves a line in a run log beside the review record:
  outcome (reviewed, not inspected, failed, timed out, interrupted), the reading of T1, wall
  time, codex-cli version, model and effort (`null` while the user's config sets them), and the
  review record names its run — route: same writer

### Slice B — a clean session
- [ ] T3 `codex-review --session lean`: `--ignore-user-config`, `-m gpt-6.1-sol`,
  `-c model_reasoning_effort="medium"`, read-only sandbox, no approvals, with the exact argv
  under test; `current` stays the default — route: delegated writer
- [ ] T4 What a session still loads from the Codex home under `--ignore-user-config` (the global
  `AGENTS.md`, `hooks.json`, skills, plugin caches), and every way to leave the global
  `AGENTS.md` out, read from the installed CLI's help and Codex's source and written here with
  its sources; no model call — route: one read-only explorer
- [ ] T5 The way T4 finds, implemented, and proven on the real binary before a review rests on
  it: the real `~/.codex` hashed before and after, the real login still answering, the first
  request's size recorded. Calls the model: asked first, with the count — route: delegated writer,
  then inline runs

### Slice C — own instructions, structured answer
- [ ] T6 The review prompt versioned in `bin/lib/` and a JSON Schema for the answer: findings
  with file, line, severity, title and explanation. `--doc <feature document>` passes the intent
  of the change, its Goal and Done when. First, read from source how `exec review` takes a
  prompt together with `--base` and whether `--output-schema` holds in review mode — route:
  delegated writer
- [ ] T7 The answer read as data: findings validated against the schema, printed as
  `file:line severity title`, counted by severity in the run log; an answer off the schema is a
  failed attempt, recorded — route: same writer

### Slice D — completeness
- [ ] T8 The evidence rule holds under the lean session and the own prompt: every changed line
  of every changed file in the output of a successful command, and a refusal names the files not
  read — route: delegated writer
- [ ] T9 A large range is reviewed in parts instead of refused: whole files grouped up to a
  bound of changed lines, a larger file alone, each part its own session with its own evidence
  and its own line in the run log; the review is recorded only when every part passed, with the
  findings merged — route: same writer

### Slice E — quality before the switch
- [ ] T10 A diff with seeded defects and its answer key in `evals/review/`, and a scorer that
  matches findings to the key by file and line — route: delegated writer
- [ ] T11 The comparison and its report: `evals/review/compare.mjs` runs configurations over
  ranges and stores each reading in `evals/results/review/`; `report.mjs --require-complete`
  sets them side by side — route: same writer
- [ ] T12 The runs, after Sebastián's go-ahead on the count: the same range under `current` and
  `lean`; `high` beside `medium`; the seeded diff under each; CodeGraph with and without —
  route: inline runs
- [ ] T13 The verdict and the switch: `lean` becomes the default only if it found the same or
  more with fewer tokens; then the roadmap's Review and Effort rows, the installed skill text,
  and `AGENTS.md` only if needed and within budget — route: delegated writer
- [ ] T14 The proposal for the Codex plugin, with the numbers: the `doctor` row, `codex:rescue`,
  the SessionStart hook — route: inline
- [ ] T15 The result in `docs/ROADMAP.md`, the carried follow-ups of
  `odd/tasks/codex-exec-review.md` that this feature closed marked there — route: inline

## Evidence at the start (2026-10-06, `main` at `3915b88`, codex-cli 0.160.0)
- What runs today: `codex exec review --json --ephemeral --base <merge-base>` with
  `-c sandbox_mode=read-only -c approval_policy=never` and two desktop plugins off
  (`bin/codex-review.mjs:57-67`). No model, no effort and no `--ignore-user-config`: the session
  takes `high` and everything else from `~/.codex/config.toml`.
- What is dropped: `reviewEvidence` keeps the turn's state, the last message and the shell
  commands; the `usage` of `turn.completed` and every other item type are not read
  (`bin/codex-review.mjs:169-186`). The record holds base, head, date and outcome
  (`bin/codex-review.mjs:430-437`), and an attempt that fails writes nothing
  (`bin/codex-review.mjs:404-426`).
- What the installed CLI offers (`codex exec review --help`): `--ignore-user-config` ("Do not
  load `$CODEX_HOME/config.toml`; auth still uses `CODEX_HOME`"), `--ignore-rules`,
  `-m`, `-c`, `--output-schema <FILE>`, `-o`, `--base`, `--commit`, `--uncommitted`, `--title`,
  and a positional `[PROMPT]` ("Custom review instructions"). No flag names the global
  `AGENTS.md`.
- The one review of this repository with full usage (2026-09-30, cli 0.159.1, `high`, before
  gentle-ai 4): 107 s, 7 requests, 297,479 input tokens (240,640 cached), 2,396 output of which
  703 reasoning, 6 shell calls. The fixed payload from files grew from 10,510 to 25,515
  estimated tokens on 2026-10-01 (`odd/tasks/codex-parity.md` in `feat/codex-parity`, Progress,
  2026-10-06).
- A reader of Codex's JSONL usage exists in `evals/agent-output.mjs:160-197`; `input_tokens`
  holds `cached_input_tokens` as a part, and `reasoning_output_tokens` is kept apart since
  whether it is inside `output_tokens` is not known.

## Open questions, each with the task that answers it
- Does `--ignore-user-config` also leave out `hooks.json`, skills and plugin caches of the home?
  (T4)
- Can the global `AGENTS.md` be left out with the real home in place, or only with a home of
  the review's own? (T4; if the second, the `auth.json` question goes to Sebastián before T5)
- Does `exec review` accept a prompt together with `--base`, and does `--output-schema` shape a
  review's answer? If not, the own prompt has to name the range itself, and whether Codex's
  rubric still applies is the thing to prove. (T6)
- With the orchestrator block gone, does Codex still refuse a range above about a thousand
  lines? T9's bound is set from a measured run, not from that number. (T12)

## Progress
- 2026-10-06: Sebastián opened the feature and fixed its decisions and order (Constraints).
  Worktree and branch created from `main` at `3915b88`; this document written from the evidence
  of F6's Progress of the same day, `bin/codex-review.mjs` and `odd/tasks/codex-exec-review.md`.
  No model called.

## Follow-ups
None yet.

## Next step
T1, then T2 (slice A): the usage reader and the run log, neither of which calls the model.
