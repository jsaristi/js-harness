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
- [x] T1 A reader of what a review session spent, in `bin/lib/`: from Codex's JSONL, tokens
  (input, cached, output, reasoning) summed over every `turn.completed`, the count of turns,
  and the items by type (shell commands, MCP calls, sub-agent calls, messages) — route:
  delegated writer (the reader and its test; `evals/agent-output.mjs` is the reference, `bin/`
  cannot import it)
- [x] T2 Every attempt of `codex-review` leaves a line in a run log beside the review record:
  outcome (reviewed, not inspected, failed, timed out, interrupted), the reading of T1, wall
  time, codex-cli version, model and effort (`null` while the user's config sets them), and the
  review record names its run — route: same writer

### Slice B — a clean session
- [ ] T3 `codex-review --session lean`: `--ignore-user-config`, `-m gpt-6.1-sol`,
  `-c model_reasoning_effort="medium"`, read-only sandbox, no approvals, with the exact argv
  under test; `current` stays the default — route: delegated writer
- [x] T4 What a session still loads from the Codex home under `--ignore-user-config` (the global
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

## What Codex loads, and what `exec review` accepts (T4, 2026-10-06)
Read from `openai/codex` at the tag `rust-v0.160.0` (paths under `codex-rs/`) by a read-only
explorer, three claims read again by the parent (`login/src/auth/storage.rs:206-223`,
`exec/src/cli.rs:283-305`, `exec/src/lib.rs:884-889`). No model was called and `auth.json` was
not opened. "Read" below means the code path was read, not that a run showed it.

- `--ignore-user-config` swaps the user layer for an empty table whose path is still
  `$CODEX_HOME/config.toml` (`config/src/loader/mod.rs:511-518`). So what is a key of
  `config.toml` goes: `[mcp_servers.*]`, `[plugins]`, `model_instructions_file`, the model and
  the effort. What is found through the home's folder stays:
  - the global `AGENTS.override.md` or `AGENTS.md`, read with no gate and no size cap
    (`codex-home/src/instructions/mod.rs:43-79`, `core/src/thread_manager.rs:1824-1832`);
  - `$CODEX_HOME/skills`, and `~/.agents/skills`, which is under the OS home and not the Codex
    home (`ext/skills/src/host_roots.rs:95-113`), so a home of the review's own does not leave
    it out;
  - execpolicy `.rules`, unless `--ignore-rules` (`core/src/exec_policy.rs:669-682`);
  - `hooks.json` is read (`hooks/src/engine/discovery.rs:129-148`), and a handler runs only if
    trusted, with the trust hashes in the ignored `config.toml`, so none should run: inferred,
    and `--disable hooks` makes it certain;
  - the built-in `codex_apps` MCP server while the `apps` feature is on
    (`core/src/mcp.rs:353-363`); `--disable apps` and `--disable plugins` remove it and the
    plugins (`core-plugins/src/manager.rs:813-815`).
- No `-c` key, environment variable or flag leaves the global `AGENTS.md` out with the real home
  in place. `project_doc_max_bytes=0` does the opposite: it bounds the project's file only
  (`core/src/agents_md.rs:68,133`). The one way is a `CODEX_HOME` of the review's own, which
  must exist already (`utils/home-dir/src/lib.rs:13-50`); the project's `AGENTS.md` is still
  read there, since it is skipped only when the project is marked untrusted
  (`core/src/agents_md.rs:64`).
- The login in such a home. The store is the file `<home>/auth.json` by default
  (`login/src/auth/storage.rs:154-155`) and this machine's `config.toml` has no
  `cli_auth_credentials_store` key. No supported way shares a login between two homes: the
  keyring entry is keyed by a hash of the home's path (`storage.rs:238-248`),
  `CODEX_ACCESS_TOKEN` takes no ChatGPT login (`login/src/auth/manager.rs:1536-1557`), and
  `CODEX_API_KEY` is API billing. A refresh rewrites the tokens (`manager.rs:1599-1621`) by
  truncating and writing the same path, not by renaming a new file over it
  (`storage.rs:206-223`); it happens when the access token is within 5 minutes of its expiry or
  the last refresh is older than 8 days (`manager.rs:203-204,3014-3025`). The client has a
  message for the server's `refresh_token_reused` (`manager.rs:207,1687`), so a refresh from a
  copy leaving the original invalid is likely, and not shown.
- `exec review` and a prompt. `--base` conflicts with the positional prompt
  (`exec/src/cli.rs:283-305`). A prompt alone is a custom target: the user message is the prompt
  as written, with no range (`prompts/src/review_request.rs:91-97`), while a `--base` review
  gets a fixed sentence with the merge-base and `git diff <sha>` (`review_request.rs:62-70`).
  Codex's rubric applies to either, since it replaces the base instructions whatever the target
  (`core/src/tasks/review.rs:119-120`).
- `--output-schema` does nothing in a review: the review branch never loads it
  (`exec/src/lib.rs:884-889`) and core passes no schema (`core/src/tasks/review.rs:137`). The
  rubric already asks the model for findings with title, body, priority, confidence and a file
  with a line range (`prompts/templates/review/rubric.md:67-94`); `exec --json` then gives them
  as one `agent_message` of rendered text, a line `- <title> — <path>:<start>-<end>` per
  finding with the priority as a `[P1]` tag in the title
  (`protocol/src/review_format.rs:23-82`). The confidence and the overall verdict are dropped.
- Model and effort. `-m` applies, since `review_model` would win and neither exec nor the real
  config sets it (`core/src/session/review.rs:14-17`, `exec/src/lib.rs:573`); the effort
  carries over from the session (`session/review.rs:49-69`); that
  `-c model_reasoning_effort` reaches it is inferred.
- Both `AGENTS.md` files reach a review as one user message (`core/src/codex_delegate.rs:76`,
  `core/src/context/user_instructions.rs:15-34`).

What this changes, and waits on Sebastián:
- The lean session needs a home of its own, so the login question is his (Ask me before): a
  copy of `auth.json` per run, or a hard link to it. Neither is documented by Codex.
- `--output-schema` and a prompt beside `--base` cannot both hold over `exec review`. The
  nearest that keeps his three decisions is a custom-target review: the versioned prompt names
  the range and carries the intent, Codex's rubric still applies, and the findings by file,
  line and severity are read from the rubric's own rendered format. The flag is dropped
  because the CLI ignores it there. T6 and T7 are written for that once he agrees.
- Skills in `~/.agents/skills` are outside any Codex home: `-c skills.include_instructions=false`
  is the key read at `core/src/config/mod.rs:4010-4014`, its effect inferred. T5's first run
  shows whether they still reach the session.

## Open questions, each with the task that answers it
- Answered by T4 (section above): `--ignore-user-config` leaves the global `AGENTS.md`, the
  skills and the rules in; only a home of the review's own leaves the global `AGENTS.md` out;
  `exec review` takes a prompt or `--base`, not both, and ignores `--output-schema`.
- Does a refresh of the login inside a copy leave the real one invalid? Not shown, and not to
  be tried on his login. (T5 is designed so that it never has to be.)
- Do the skills of `~/.agents/skills`, a hook or the apps server still reach a lean session?
  (T5, read from its first real run)
- With the orchestrator block gone, does Codex still refuse a range above about a thousand
  lines? T9's bound is set from a measured run, not from that number. (T12)

## Progress
- 2026-10-06: Sebastián opened the feature and fixed its decisions and order (Constraints).
  Worktree and branch created from `main` at `3915b88`; this document written from the evidence
  of F6's Progress of the same day, `bin/codex-review.mjs` and `odd/tasks/codex-exec-review.md`.
  No model called. Committed as `7deddfc` (gate green, `core.bare` `false`, the worktree
  clean); gentle-ai assessed `3915b88..7deddfc` as `passive`, review not due, so the reviewed
  boundary is `7deddfc`.
- 2026-10-06: T4 by a read-only explorer (route: delegated, as planned), its three load-bearing
  claims read again by the parent at the tag. Findings in "What Codex loads, and what
  `exec review` accepts". Two of them reach Sebastián's decisions and are put to him, one at a
  time: the login of a home of the review's own, then `--output-schema`. T1's wording is
  corrected by the same reading: Codex's JSONL reports usage per turn, not the number of
  requests in it, so the reader counts turns.
- 2026-10-06: T1 and T2 by the delegated writer, with nothing staged by it and no model called.
  T1: `sessionReading(events)` in `bin/lib/codex-usage.mjs` gives the four token counts summed
  over the turns (`null` for one Codex never reported, so it is told apart from zero), the
  turns, the items by type and the commands with how many failed. T2: every attempt that
  launches Codex appends a line to `<git common dir>/js-harness/codex-review-runs.jsonl`
  (`bin/lib/codex-review-runs.mjs`, schema `js-harness.codex-review-run/v1`): outcome
  (`reviewed`, `not-inspected`, `failed`, `timed-out`, `interrupted`) with its reason, the
  range, the cli version read from the `--version` probe, wall time, the reading of T1 and the
  coverage; `model` and `effort` are `null` until T3. The review record names its run, and a
  line of one summary is printed. Nothing before the launch writes a run line, nor does
  `--unavailable`. RED: T1 13 tests, 11 failing on assertions against a stub; the run-log
  module failed to load; the command 91 tests, 21 failing. GREEN: 13/13, 24/24, 91/91. The
  writer's verification over the five test files: 171 tests, 171 pass, 117 s. Parent: read the
  diff of the command, and ran the three library files again, 37 of 37.
  - Chosen by the writer and kept: a run line that cannot be written is a warning, and the
    record then omits `run`; the `reviewed` run line is written before the review record, so
    a record that then fails to write leaves a measured run with no record, which
    `check --push` never reads; the append and read plumbing is shared from
    `bin/lib/codex-reviews.mjs`, whose own tests pass unedited.

## Follow-ups
- `bin/codex-review.test.mjs` takes just over 120 s here, about 1.3 s a test, since each one
  spawns real git; a foreground limit of 120 s cuts it off, so it is run with a longer one.
- The reason logged for a timeout or an overflow quotes the built-in bounds even when a test
  injects others, as the message it copies does (carried in `odd/tasks/codex-exec-review.md`).

## Next step
Slice A is written (T1, T2) and T4 is read. Waiting on Sebastián: how the login reaches a home
of the review's own (a copy per run, or a hard link), which T5 needs; then what becomes of
`--output-schema`, which T6 needs. T3, the `--session lean` argv, waits on neither. Slice A
holds code, so before a push it needs gentle-ai's assessment and a Codex review of its range,
which draws on the cap and is asked first.
