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
  and the login is his. The one exception is his own (2026-10-06, Progress): the lean home's
  `auth.json` is a hard link to the real one, never a copy, so a refresh during a review
  writes the real file as his own Codex would. The real home is read before and after a first
  run, before any review rests on it.
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
- `AGENTS.md` is at 1,500 of 1,500 estimated tokens (1,497 when this feature opened) — so a
  line changes there only by replacing words, and the gate measures it.
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
- [x] T3 `codex-review --session lean`: `--ignore-user-config`, `-m gpt-6.1-sol`,
  `-c model_reasoning_effort="medium"`, read-only sandbox, no approvals, with the exact argv
  under test; `current` stays the default — route: delegated writer
- [x] T4 What a session still loads from the Codex home under `--ignore-user-config` (the global
  `AGENTS.md`, `hooks.json`, skills, plugin caches), and every way to leave the global
  `AGENTS.md` out, read from the installed CLI's help and Codex's source and written here with
  its sources; no model call — route: one read-only explorer
- [x] T5 The way T4 finds, implemented, and proven on the real binary before a review rests on
  it: the real `~/.codex` hashed before and after, the real login still answering, the first
  request's size recorded. Calls the model: asked first, with the count — route: delegated writer,
  then inline runs

### Slice C — own instructions, structured answer
- [x] T6 The answer as data and the prompt of our own, both in `bin/lib/`: a schema for the
  answer the rubric already gives in JSON (findings with file, line range, severity, title,
  explanation, confidence; the verdict) and its reader from the review sub-agent's rollout
  file; a versioned review prompt that names the range and carries the intent, chosen with
  `--prompt own` and fed by `--doc <feature document>` (its Goal and Done when). The default
  stays `--base` with Codex's own sentence; `--output-schema` is not used, since a review
  ignores it — route: delegated writer
- [x] T7 The answer read as data under the lean session: findings validated against the
  schema, printed as `file:line severity title`, counted by severity in the run log; an
  answer off the schema is a failed attempt, recorded — route: same writer

### Slice D — completeness
- [x] T8 The evidence rule holds under the lean session and the own prompt: every changed line
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

## Why the first lean review ran no command and reported no tokens (2026-10-07)
Read from the same tag by a read-only explorer after the run of 05:34Z, two claims read again
by the parent (`core/src/exec_policy.rs:787-814`, `core/src/codex_delegate.rs:306-322`). No
model was called.

- The refusal. On Windows a shell command that no rule matches is forbidden when approvals are
  `never`, the profile restricts the file system (read-only does) and no Windows sandbox is
  set: `windows_managed_fs_restrictions_without_sandbox_backend`, `AskForApproval::Never =>
  Decision::Forbidden` (`core/src/exec_policy.rs:789-806`); with a sandbox the same function
  allows it (`:810-813`). The sandbox is the key `windows.sandbox`, one of `elevated`,
  `unelevated`, `mxc` (`config/src/types.rs:164-176`), which his `config.toml` sets to
  `unelevated` and the lean session did not load. `unelevated` needs no administrator and no
  setup; it writes `cap_sid` and `.sandbox/` into the home
  (`windows-sandbox-rs/src/cap.rs:35-36`, `spawn_prep.rs:108-109`). In read-only mode it adds
  no access entry to the workspace or to the home, only to the NUL device
  (`spawn_prep.rs:289-342`), so the linked `auth.json` keeps its access list. `--ignore-rules`
  changes nothing here: there are no built-in allow rules (`exec_policy.rs:662-716`).
- The zeros. `exec` fills `turn.completed.usage` from the last token update of the primary
  thread and prints zeros when none came (`exec/src/event_processor_with_jsonl_output.rs:118-127`).
  A review runs in a sub-agent whose `TokenCount` events are dropped before they reach the
  parent (`core/src/codex_delegate.rs:311-319`), and the parent makes no request of its own
  (`core/src/tasks/review.rs:76-91`). So `exec review --json` reports no tokens in any
  session, by construction. The review of 2026-09-30 that F6's evidence cites was read from a
  database of a run that was not ephemeral, not from this stream.
- Where the tokens are. With `--ephemeral` nowhere on disk (`core/src/session/session.rs:1008-1009`,
  `:1112-1113`), and the sub-agent inherits it (`core/src/tasks/review.rs:105-106`). Without it
  each thread writes `sessions/YYYY/MM/DD/rollout-<timestamp>-<thread id>.jsonl`
  (`rollout/src/rollout_file_name.rs:67`) with `token_count` lines whose `info` holds
  `total_token_usage` and `last_token_usage` (`protocol/src/protocol.rs:2241-2282`,
  `rollout/src/policy.rs:113-119`). That the sub-agent gets a file of its own is read from
  code and not yet seen.

What follows from it:
- The lean session sets `windows.sandbox` itself on Windows and drops `--ephemeral`: its home
  is thrown away after the run, so the tokens are read from its rollout files before that.
- The `current` session cannot be measured as it runs today, ephemeral in his real home.
  Measuring it for the comparison of T12 means either a run that is not ephemeral, which
  leaves session files in his `~/.codex` and has this command read them, or a home that
  copies his configuration. That is his decision, put to him before T12.

## Open questions, each with the task that answers it
- Answered by T4 (section above): `--ignore-user-config` leaves the global `AGENTS.md`, the
  skills and the rules in; only a home of the review's own leaves the global `AGENTS.md` out;
  `exec review` takes a prompt or `--base`, not both, and ignores `--output-schema`.
- Does a refresh of the login inside a copy leave the real one invalid? Not shown, and not to
  be tried on his login. (T5 is designed so that it never has to be.)
- Do the skills of `~/.agents/skills`, a hook or the apps server still reach a lean session?
  Answered for the text of the first request by the run of 2026-10-07T08:20Z (Progress): no
  skill, plugin or MCP text and no global `AGENTS.md`. The tool list of that request is not
  in the rollout file, so what tools were offered is not shown.
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
- 2026-10-06: T1 and T2 committed as `73ec5ae` (gate green, `core.bare` `false`, the worktree
  clean). gentle-ai assessed `7deddfc..73ec5ae` as `medium`, review due
  (`slice_budget_reached`, 933 lines); granted without asking, as agreed. Lineage
  `review-1792335775ecde79`, one lens (`review-reliability`): approved and acknowledged, so
  the reviewed boundary is `73ec5ae`. Its three findings, none blocking, all accepted and fixed
  by the writer, resumed:
  - R3-reviewed-run-without-record (WARNING): the order is kept and now proven, with a test
    where the record cannot be written after the run was logged: exit 1, the message, one
    `reviewed` run line and no record; the run log's header says what such a line means. The
    behavior existed, so the test passed at once: a guard, not a RED.
  - R3-wall-clock-duration: the wall time is read off a monotonic clock (`monotonicNow`,
    `performance.now()` by default), whole milliseconds, never below zero; `startedAt` stays
    on the wall clock. RED: 3 failing, `-3600000 !== 2501` with the wall clock set back an hour.
  - R3-logrun-build-outside-try: the run line is built inside the `try`, so a failing id or
    date source never changes how an attempt ends. RED: 2 failing, the injected error escaping.
  RED over the file: 97 tests, 5 failing. GREEN, the writer's verification over the five test
  files: 177 of 177, 129 s. Parent: read the diff of the command and of the run log.
- 2026-10-06: the corrections committed as `338386a` (gate green, `core.bare` `false`, the
  worktree clean). gentle-ai assessed `73ec5ae..338386a` as `medium`, review not due
  (`under_budget`, 191 lines): pending in the slice, the reviewed boundary stays `73ec5ae`.
- 2026-10-06: T3 by the writer, resumed. `--session <current|lean>`, `current` the default and
  its argv unchanged to the token. The lean argv, pinned by a test, also through the Windows
  launch path: `exec review --json --ephemeral --ignore-user-config --ignore-rules --disable
  plugins --disable apps --disable hooks -m gpt-6.1-sol -c model_reasoning_effort="medium" -c
  sandbox_mode=read-only -c approval_policy=never -c skills.include_instructions=false --base
  <base>`. The model and the effort are the exported constants `LEAN_MODEL` and `LEAN_EFFORT`;
  the run line gains `session` and, under `lean`, holds them instead of `null`. RED: the
  import failed, then 106 tests with 8 failing on assertions. GREEN: 106/106; the writer's
  verification over the five test files: 186 of 186, 236 s. Parent: `--session fast` exits 2
  with the usage, and both argv lists printed from the module read as above.
  - Not shown yet, and T5's first real run shows it: that Codex accepts the feature names
    `plugins`, `apps` and `hooks` after `--disable`, and that each flag does what T4 read
    from source. `lean` sets no `CODEX_HOME`, so until T5 it still loads the global
    `AGENTS.md`.
- 2026-10-06: T3 committed as `e3aad48` (gate green, `core.bare` `false`, the worktree clean).
  gentle-ai assessed `73ec5ae..e3aad48` as `medium`, review due (`slice_budget_reached`, 438
  lines, the corrections of `338386a` with T3); granted without asking. Lineage
  `review-b49708c1e845a7d1`, one lens (`review-reliability`): approved and acknowledged, so
  the reviewed boundary is `e3aad48`. Its three findings, none blocking, all accepted and
  carried to T5, which touches the same lines (Follow-ups). Recorded as `2c74d42` (gate green,
  `passive`).
- 2026-10-06: Sebastián decided the login of the lean home: "Hard link al auth.json real,
  recreado en cada corrida. Probalo primero con el hash antes y después." So the lean session
  runs in a home of its own under `<home>/.js-harness/codex-review-homes/<run id>`, made and
  removed by every run, whose `auth.json` is a hard link to the real one and never a copy.
  Why the link: Codex saves the login by truncating and writing the same path
  (`login/src/auth/storage.rs:206-223`), so the two names always hold one token and a refresh
  cannot leave the real login stale. What it costs, said to him before he chose: a refresh
  during a review writes the real `auth.json` through the link, as his own Codex would. The
  constraint "nothing writes into the real `~/.codex`" stands for everything else, and the
  proof he asked for comes first: the real home read before and after one lean review
  (`evals/review/login-proof.mjs`), which calls the model and is asked with its count.
- 2026-10-06: engram refused the update of this document's mirror ("Claude host session
  registration could not be confirmed"), as it did to F6's session. The mirror
  `odd/codex-review-lean/tasks` holds the document as it was opened; this file is whole. The
  mirror is pending until engram takes a write.
- 2026-10-07: Sebastián approved the model calls of T5 and of the slice's review, two reviews
  and no more: "Dale con las 2 revisiones cuando T5 esté commiteado". One `lean` over
  `338386a..HEAD` inside the proof of the login, then one `current` over `7deddfc..HEAD`.
- 2026-10-07: T5's build by a new writer, no model called and the real `~/.codex` never
  touched (every test makes its own fake home).
  - `bin/lib/codex-review-home.mjs`: `createLeanHome` makes `<parent>/<id>`, hard-links the
    real `auth.json` into it and checks that the two names are one file (device and file id);
    a missing login, another volume (`EXDEV`) or any failed link is an error that leaves
    nothing behind and says no copy is made. `dispose` removes the login's second name first,
    by a call that removes one name, and then the folder; it never throws. A run that was
    killed leaves its folder, and `sweepStaleLeanHomes` removes those older than twice the
    review's timeout. The module never opens the file.
  - `bin/codex-review.mjs`: under `lean` only, the run's id is made before the launch, the
    home is created under `<home>/.js-harness/codex-review-homes/` and given as
    `CODEX_HOME`, and it is disposed on every way out; a home that cannot be made launches
    nothing and exits 1. `--home` names the harness's state dir again. `current` makes no
    folder and sets nothing, pinned by a test.
  - The two smaller findings of the review of `e3aad48`: `runSession(run)` reads a run line
    with no `session` as `current`; a duration that is not finite is `null` on purpose.
  - `evals/review/login-proof.mjs`: reads the real home before and after a wrapped command
    (for `auth.json` its size, date, link count, file id and digest; for the rest of the top
    level sizes, dates and digests, folders by count) and writes a report with no byte of any
    file; it exits 1 if `auth.json` is another file afterwards or its link count did not
    return.
  - RED: the home module 17 of 18 failing against a stub; the command 14 failing; the proof
    18 of 18. GREEN, the writer's verification over seven test files: 239 of 239, 171 s.
    Parent: read `bin/lib/codex-review-home.mjs` whole and ran three of the files again, 50
    of 50.
  - Added by the writer beyond its brief and kept: `dispose` warns when the lean name had
    become another file (Codex renaming instead of truncating), an id that is not a plain
    folder name is refused, and an existing folder is never taken over.
  - Seen by the parent and not covered by the script: a hard link shares the file's access
    list too, and Codex on Windows prepares its sandbox per home (`cap_sid`, `.sandbox` in
    the real one). So the proof run also reads `icacls` of the real `auth.json` before and
    after, by hand.
- 2026-10-07: T5's build committed as `e531c1f` (gate green, `core.bare` `false`, the
  worktree clean), 1,601 lines against the roughly 300 the parent had told Sebastián, so the
  two ranges he approved had grown to 1,826 and 2,832 lines. Told to him; the first review was
  kept to what he approved by running it from a temporary worktree at `e3aad48`
  (`D:js-harness-worktreescodex-review-lean-probe`), over `338386a..e3aad48`, 255 lines;
  the second is not run without asking again.
- 2026-10-07: gentle-ai assessed `e3aad48..e531c1f` as `medium`, review due; granted without
  asking. Lineage `review-ad600fc281d41934`, one lens (`review-reliability`): approved and
  acknowledged, so the reviewed boundary is `e531c1f`. Four findings, none blocking, all
  accepted, fixed with the next change to these files (Follow-ups); none bears on a run with
  `JS_HARNESS_HOME` and `CODEX_HOME` unset, which was checked before the run below.
- 2026-10-07T05:34Z, the first real lean review, inside the proof of the login
  (`evals/results/review/login-proof.md`), after a dry run of the proof around an empty
  command had read the real home twice without a difference.
  - The login: PASS. `auth.json` is the same file before and after (device and file id), its
    bytes unchanged, its names 1 before and 1 after, 4,009 bytes, last written
    2026-09-27T21:45:10Z; none of the other 55 top-level entries of the real home changed.
    `icacls` of the real `auth.json`, of the reviewed worktree and of its `bin` read the same
    before and after. No lean home was left under `<home>/.js-harness/codex-review-homes`.
  - The CLI took the lean argv: every flag and the three feature names after `--disable`
    (R3-lean-argv-unproven-against-codex, closed for acceptance; what each does is not shown).
  - The review did not happen. Every shell command the model tried was refused before it ran,
    "rejected: blocked by policy", for `powershell.exe`, `bash.exe` and `cmd.exe` alike, and
    the model answered that it could not see the diff. The command recorded nothing as a
    review and one run line, `not-inspected`, 0 of 216 changed lines, 18 s. Likely cause, read
    from his config and not yet from Codex's source: `[windows] sandbox = "unelevated"` is a
    key of the `config.toml` the lean session ignores, so the session had no sandbox to run a
    command in and no one to ask.
  - The measurement did not happen either: the one `turn.completed` carried a `usage` of four
    zeros, present and not missing, although the model made four tool attempts and wrote a
    message. So Codex's JSONL may not report a review's tokens at all, and T1 reads the only
    place the command looks. What this attempt drew from the cap is not known.
  - Both are being read from Codex's source by a read-only explorer before another call to
    the model is asked for.
- 2026-10-07: that run recorded as `4c8af4b` (gate green, `passive`). The explorer's reading
  is in "Why the first lean review ran no command and reported no tokens".
- 2026-10-07: the correction, by a new writer, no model called and no real home touched.
  - The lean argv sets `-c windows.sandbox="unelevated"` on Windows and nothing elsewhere,
    and no longer passes `--ephemeral`; `current` is unchanged to the token. Both lean lists
    are pinned, and the Windows command line.
  - The tokens come from the lean home's rollout files, read after Codex exits and before the
    home is removed (`rolloutReading` in `bin/lib/codex-usage.mjs`): per count the sum over
    threads of each thread's last total, the requests (the `token_count` lines that hold a
    count, an inferred reading), the input of the first request and the threads. The run line
    gains `requests`, `firstRequestInputTokens`, `threads` and `usageSource`
    (`rollout` or `null`). The command no longer takes tokens from Codex's JSONL: under
    `current` every count is `null` and the summary says the tokens are not known, where it
    printed zeros.
  - `--keep-home`, lean only: the run removes the login's name from its home and keeps the
    rest, so the rollout files of a first run can be read by a person; the sweep removes the
    folder later.
  - The four findings of the review of `e531c1f`: an empty `--home` or `JS_HARNESS_HOME`
    counts as unset; `CODEX_HOME` is found in any case on Windows; the proof writes its report
    when the second reading throws; its usage says the wrapped command must be an executable.
  - RED: the usage reader 11 of 24 failing, the command 24 of 134, the home module 4 of 22,
    the proof 3 of 21. GREEN, the writer's verification over seven test files: 271 of 271,
    223 s. Parent: printed the three argv lists from the module, ran four of the files again
    (81 of 81), saw `--keep-home` without `--session lean` exit 2, read the home module's diff.
  - Left open by the writer, settled by the first kept home: `requests` may count a line
    Codex writes when only the rate limits change. The shape of a rollout line is read from
    source and has not been seen in a real file.
- 2026-10-07: the correction committed as `7529f67` (gate green, `core.bare` `false`, the
  worktree clean). gentle-ai assessed `e531c1f..7529f67` as `medium`, review due (1,330
  lines); granted without asking. Lineage `review-04599bf4472ce38a`, one lens
  (`review-reliability`): approved and acknowledged, so the reviewed boundary is `7529f67`.
  Two suggestions, both about tests, accepted and carried (Follow-ups).
- 2026-10-07: asked for one more lean review of `338386a..e3aad48` with `--keep-home`, inside
  the proof of the login; not yet answered. Sebastián asked instead where to run it (here, in
  this session; F6's stays paused) and for three things to be built into the harness: whose
  turn it is in every reply, a notice when a session finishes, and the context window watched.
  Recorded in `docs/ROADMAP.md`, Next, item 6, as a feature of its own; applied by hand until
  then. This session's context read 77% of 500k at that moment (auto-compact at 93%), so it is
  compacted before the next run.
- 2026-10-07, after the compact: Sebastián approved that one lean review. It was not run,
  because the Codex CLI on this host changed under the feature. Evidence:
  - `codex --version` now prints `codex-cli 0.160.1`; the run line of 05:34Z records
    `0.160.0`.
  - The global pnpm package `@openai/codex` was replaced at 2026-10-07T05:51:18Z (its
    `package.json` time; the global `package.json` now asks for `^0.160.1`).
  - `~/.codex/version.json` holds `latest_version` `0.160.1`, checked at 05:51:04Z.
  - One session file in the real home starts at 05:51:03Z and ends a second later with a
    turn aborted: originator `codex-tui`, source `vscode`, `cli_version` `0.159.1`, cwd
    `C:\Users\Oficina`. So another Codex client started then, and the update followed within
    15 seconds.
  - No command of this session did it: a search of every Claude transcript under
    `~/.claude/projects` for a pnpm, npm or bun install of `@openai/codex` found none (the
    pattern would match the command text of any Bash call that ran one).
  What this session did in the real home to learn it: listed names and times, read
  `version.json` and the six lines of that session file. It wrote nothing and did not open
  `auth.json`.
  Consequences: the reading of the source in this document is of tag `rust-v0.160.0`, and
  F6 (`codex-parity`) was paused on 0.160.0. Whether the review runs on 0.160.1 or waits for
  0.160.0 to be put back is Sebastián's decision; the question is pending. The `icacls`
  reading taken before the run that did not happen is discarded.
- 2026-10-07: the question above was read three times as a task for him to run in Codex,
  because its block was worded as an instruction. Sebastián approved a closing format of
  four states for every reply and asked for it to be fixed in the harness. Done here, as
  prose: `AGENTS.md` reworded (1,500 of 1,500 tokens) and `docs/ROADMAP.md`, Next, item 6,
  which holds the format and what is left to build (a check, in that feature's own
  session). No code changed. The question about the CLI version is still pending and is
  asked again in that format once this commit is in.
- 2026-10-07T08:20Z: Sebastián said yes to the one lean review on CLI 0.160.1. Run from this
  worktree at `5fe0510` over `338386a..e3aad48` (the temporary worktree), with `--keep-home`,
  inside the proof of the login. It is the second Codex review of this feature and the first
  that read its diff. T5 is checked off on it. Run id
  `f439089a-2ca4-4c4f-aea4-8221594c76f4`; the run line holds every number below.
  - Outcome `reviewed`, coverage 216 of 216 changed lines, no finding, 39 s.
  - Tokens, from the rollout file: 145,852 input, of which 109,184 cached (36,668 not
    cached), 634 output, 98 reasoning; 6 requests; the first request 6,714 input tokens.
  - The login: PASS (`evals/results/review/login-proof.md`): the same file, bytes unchanged,
    names 1 → 1, 51 entries in the real home before and after, nothing else changed.
    `icacls` of the real `auth.json` printed the same before and after. The kept home holds
    no `auth.json`.
  - The Windows sandbox: `-c windows.sandbox="unelevated"` let the session run its commands;
    5 ran, none was rejected by policy (2 ended with exit 1, see below).
  - The model and the effort reached the review: its `turn_context` line says
    `gpt-6.1-sol`, `medium`, approval `never`, sandbox `read-only`.
  - What the home shows of the session. Two rollout files: the parent thread (17 lines, no
    `token_count`, so it made no request) and the review sub-agent (source
    `{"subagent":"review"}`, 44 lines, 6 `token_count` lines). `threads` is 1 because only
    one file holds usage. Each `token_count` line is one request with its own
    `last_token_usage`; none was a line written for rate limits alone, so `requests` did not
    overcount here.
  - What the first request held, read from the sub-agent's file: base instructions of 8,043
    characters (the review rubric); a developer message of 1,263 characters (permissions and
    collaboration mode); a user message of 6,588 characters with the project's `AGENTS.md`
    and the environment; a user message of 353 characters, the review prompt Codex writes
    for `--base` ("Review the code changes against the base branch … Run `git diff …`").
    Absent from all of them: the global `AGENTS.md` (searched for its persona wording), any
    skill, plugin or MCP text.
  - Where the input went: the model read the diff (23 KB of output), then `AGENTS.md`,
    `docs/ROADMAP.md` and this document in one command (41 KB, cut by its own
    `max_output_tokens`), then parts of the changed files. So most of the uncached input is
    reading it chose to do, not what the session loaded.
  - New, for T6: the sub-agent's last message is JSON, not rendered text:
    `{"findings": [], "overall_correctness": "patch is correct", "overall_explanation": …}`.
    So the rubric already answers in a structure, and it is in the rollout file of a home
    that is kept until read. With no finding in this run, the shape of one finding is still
    only known from source.
  - New, a follow-up: the model ran `codex exec review --help` (exit 1),
    `codex --ignore-user-config features list` (exit 0) and
    `codex --disable plugins --disable apps --disable hooks features list` (exit 1) inside
    its sandbox, to check the flags the diff names. None calls the model. A review of a
    change to this command can start the Codex binary from inside the review.
  The kept home stays at `~/.js-harness/codex-review-homes/<run id>` until the next lean
  review sweeps it (60 minutes old) or it is deleted by hand.
- 2026-10-07: the design of slice C, settled. Asked whether to read the rubric's JSON now and
  leave the prompt of our own for the comparison, Sebastián answered "no me importa si gasta
  cupo de codex la idea es eso que se pueda tener una revision". Taken as: the cap is not the
  criterion, a working review is; so both are built now and the numbers of T12 choose the
  default. T6 and T7 are rewritten for it:
  - The answer is read from the review sub-agent's rollout file (the session whose
    `session_meta` source is `{"subagent":"review"}`, its last assistant message), which
    exists only under the lean session, so structured findings are a lean-session feature.
  - The schema is the one the rubric sends (read from the kept home, CLI 0.160.1):
    `findings[]` of `title`, `body`, `confidence_score` 0 to 1, `priority` 0 to 3
    (optional), `code_location.absolute_file_path`, `code_location.line_range.start|end`;
    `overall_correctness` ("patch is correct" or "patch is incorrect"),
    `overall_explanation`, `overall_confidence_score`.
  - `--prompt own` is a custom-target review: no `--base` on Codex's command line, the
    prompt names the range and the command to see it, and `--doc` adds the Goal and the
    Done when of the feature document. `--prompt codex` (default) is today's `--base`.
  - On the cap (my reading of his sentence, to be corrected by him if wrong): a single run
    that proves a piece on the real binary is announced with its count and run without
    waiting; the batch of T12 is still put to him with its count first, as he asked at the
    start.
- 2026-10-07: T6 and T7 built by one delegated writer (route: delegated, the writer trigger:
  ten files), test first. Not checked off until a real review under `--prompt own` shows
  the answer read from a real rollout file.
  - RED seen, then GREEN, per piece: the shared walk `rolloutPaths` (missing export → 25 of
    25); `bin/lib/codex-review-answer.mjs` (module not found → 28 of 28);
    `bin/lib/codex-review-prompt.mjs` (module not found → 14 of 14); `runFindings` and
    `runPrompt` in the run log's reader (missing export → 19 of 19); the command (16 of 19
    new tests red → 150 of 150 for the whole file, 209 s). The parent re-ran the four module
    files: 86 of 86, 8 s.
  - The prompt goes on stdin: `codex exec review --help` (0.160.1) says a PROMPT of `-` is
    read from stdin, so no multi-line text crosses the Windows command line. The lean argv
    under `--prompt own` is the lean one with `-` in place of `--base <base>`.
  - What the writer decided where the brief was open: a failure of Codex itself keeps its own
    reason and exit code, then an unreadable answer is `failed` (exit 1, no review record),
    then the evidence rule; a lean home with no rollout file is now `failed` where it was
    `reviewed`; the five new fields of a run line (`prompt`, `promptVersion`, `findings`,
    `verdict`, `answerSource`) are always present and `null` under `current`; Codex's
    rendered review is still printed, with the `file:line severity title` lines and the
    verdict after it; the schema lets unknown fields pass, does not enforce the 80-character
    title, takes `null` for `priority` and `overall_confidence_score`, refuses an end before
    a start, and accepts JSON inside a fence or after a sentence, as Codex's own parser
    does; the prompt takes full commit ids, and with an intent says the change may be one
    step, so a criterion not reached yet is not a finding by itself; `--doc` is resolved
    from `--cwd`, each section cut at 2,000 characters, read with `parseContract`.
  - The evidence rule is unchanged and holds under `own`, since the prompt names
    `git diff <from> <head>`.
- 2026-10-07: T6 and T7 committed as `81250a4` (gate green). gentle-ai assessed
  `7529f67..81250a4` as `medium`, review due (1,870 lines, `slice_budget_reached`);
  granted without asking. Lineage `review-43ed9ea7c48748ff`, one lens
  (`review-reliability`): approved and acknowledged, so the reviewed boundary is `81250a4`.
  Four findings, none blocking, carried in Follow-ups.
- 2026-10-07T09:38Z: the third Codex review of this feature, announced with its count and
  run without waiting (the reading of his sentence above): the same range
  `338386a..e3aad48` under `--session lean --prompt own --doc
  odd/tasks/codex-review-lean.md --keep-home`, inside the proof of the login, CLI 0.160.1.
  Run id `1529f49e-8df4-4306-b0de-71288c113d95`. T6 and T7 are checked off on it.
  - Outcome `reviewed`, coverage 216 of 216, no finding, verdict `correct` with confidence
    0.85, read from the real rollout file (`answerSource` `rollout`); 37 s.
  - Tokens: 107,236 input, of which 71,936 cached (35,300 not cached), 656 output, 106
    reasoning; 5 requests; the first request 7,066 input tokens. 6 commands, none failed.
  - The kept home shows the prompt of our own was what the review got: a user message of
    1,742 characters that starts "Review the code changes in the committed range …" and
    holds the Goal heading; the project's `AGENTS.md` beside it; no global persona text.
  - The login: PASS again, `icacls` unchanged, 51 entries before and after.
  - Beside the run of 08:20Z (Codex's own sentence, `--base`):

    | | `--prompt codex` | `--prompt own` + `--doc` |
    |---|---|---|
    | input tokens | 145,852 | 107,236 |
    | of them not cached | 36,668 | 35,300 |
    | output tokens | 634 | 656 |
    | requests | 6 | 5 |
    | first request | 6,714 | 7,066 |
    | seconds | 39 | 37 |
    | findings | 0 | 0 |

    One run each, so this says only that both work and that the intent costs about 350
    tokens in the first request. It is not a comparison: the model chose different files to
    read in each, and neither found anything on a range with no known defect. T10 to T12
    are what compare.
- 2026-10-07: T8 and T9 built by one delegated writer (route: delegated, the writer trigger:
  eight files), test first. T8 is checked: the rule held in both real lean runs (216 of 216
  under each prompt) and is now pinned by tests. T9 is not checked until a real range is
  reviewed in parts.
  - RED seen, then GREEN: `bin/lib/codex-review-parts.mjs` (module not found → 13 of 13);
    the part prompt (missing export); the cut inside a surrogate pair (a lone `\ud83d` →
    cut before it); `runPart` (missing export → 22 of 22); the refusal that names files
    (no "not read in full" line); the verdict printed only when the attempt stands (the
    one-line notice absent). The 15 command tests of T9 were written after the code, then
    run against the committed command: 14 failed for the right reason and the one that says
    a single part is as today passed, as it should. Whole command file: 174 of 174, 273 s;
    the five module files: 110 of 110, 9 s (re-run by the parent).
  - T8, what was there and what was added: the rule and one test under `--prompt own`
    existed. Added: the lean session with either prompt, reviewed and not-inspected; under
    lean the refusal lists the files not read in full with how many changed lines of each
    were missing (eight at most, then "and N more"); `reviewEvidence().missingFiles`. The
    `current` refusal keeps its exact words.
  - The findings of the last two reviews, closed here: the finding lines and the verdict
    print only when the attempt stands; a child that closes stdin early (EPIPE) leaves the
    outcome to its own exit; the cut of an intent section never leaves half a surrogate
    pair; the off-Windows case test passes `linux` and `darwin`; `--keep-home` with a
    login that could not be removed has a test at the command's level. The two that passed
    at once were checked by breaking the code, and then failed.
  - T9 as built: under the lean session a range above `PART_MAX_CHANGED_LINES` (400,
    provisional; `--part-lines <n>` overrides) is split into parts of whole files in path
    order, a larger file alone. Each part is its own session in its own lean home, one after
    another, with the prompt of our own naming its files, its own evidence check and its own
    run line (`part: {index, of, files, changedLines}`, absent on a single-part run). The
    review is recorded only when every part passed; the first that fails stops the run.
    Findings are merged in file and line order, one verdict line per part.
  - What the writer decided where the brief was open: `--no-renames` in the count, in each
    command of a part and in each expected set, so that parts provably add up to the range
    (a rename split over two parts otherwise does not); a refusal before any launch when
    the parts together would not show every changed line; the review record gains `runs`,
    every part id, beside `run`, the last part line; the part prompt has its own version
    constant and the whole-range text stays `v1` to the character; a path with a quote or
    a control character refuses the split; stale homes are swept once per run, so a later
    part cannot remove an earlier kept home.

## Follow-ups
- From gentle-ai's review of `81250a4` (all but the first closed with T8, Progress):
  - R3-finding-shape-unproved-fails-closed (`bin/lib/codex-review-answer.mjs:44`, WARNING):
    the schema of one finding has only been tested against invented fixtures, and both real
    answers so far held an empty `findings`. An off-schema answer fails the attempt, so a
    difference in a real finding would fail exactly the reviews that found something. Closed
    by T10 and T12: the first real answer with a finding becomes a recorded fixture, before
    the comparison rests on the reader.
  - R3-verdict-printed-on-failed-attempt (`bin/codex-review.mjs:809`): the finding lines and
    the verdict are printed before the completion and evidence checks, so an attempt that
    then fails still prints "the patch is correct". Print them only once the attempt stands,
    with T8.
  - R3-stdin-early-close-unasserted (`bin/codex-review.mjs:464`): no test for a child that
    exits before reading the prompt (an EPIPE on the write). With T8.
  - R3-intent-cut-splits-surrogate (`bin/lib/codex-review-prompt.mjs:77`): the cut at 2,000
    characters can split a surrogate pair. With T8.
- From gentle-ai's review of `7529f67` (both closed with T8, Progress):
  - R3-off-windows-case-test-host-platform (`bin/codex-review.test.mjs:1138`): the test of a
    variable spelled in another case off Windows passes no platform, so it may rest on the
    host's; pass `linux` and `darwin`.
  - R3-keep-home-failed-clean-branch-unasserted (`bin/codex-review.mjs:631`): no test at the
    command's level covers `--keep-home` when the login's name could not be removed cleanly.
- Closed on 2026-10-07 with the correction above, from gentle-ai's review of `e531c1f`:
  - R3-empty-state-home-resolves-to-cwd (WARNING, `bin/codex-review.mjs:544`): an empty
    `JS_HARNESS_HOME` or `--home` is not taken as unset, so the lean home and its link to the
    login would be made under the working directory.
  - R3-real-home-case-sensitive-lookup (`bin/lib/codex-review-home.mjs:33-35`): `CODEX_HOME`
    spelled in another case in an injected environment is not read.
  - R3-proof-second-snapshot-uncaught (`evals/review/login-proof.mjs:239`): a second reading
    that throws leaves no report after the run it exists to observe.
  - R3-proof-no-shell-windows-shim (`evals/review/login-proof.mjs:238`): the wrapped command
    must be a real executable; say so in the usage.
- The command keeps nothing of Codex's raw events, so a run that goes wrong can only be read
  from its summary. Keep the JSONL of every attempt beside the run log, or behind a flag.
- `uninstall` does not know `<home>/.js-harness/codex-review-homes`. Every run empties it, so
  what a machine keeps is an empty folder; make `uninstall` remove it, or record it in the
  manifest, before the lean session becomes the default (T13).
- A `--home` or `JS_HARNESS_HOME` on another volume than the Codex home makes `lean` refuse
  with `EXDEV`; on this host the temp folder is on C: and the repository on D:.
- The `codex --version` probe runs before the lean home exists, so in the user's home.
- With T5, from gentle-ai's review of `e3aad48`:
  - R3-lean-argv-unproven-against-codex (WARNING, `bin/codex-review.mjs:101-108`): nothing
    shows yet that the real CLI accepts the lean flags and the feature names after `--disable`;
    the tests compare the argv with a list of the same tokens. T5's first real run is the
    proof, and until it passes a `--session lean` run may only add `failed` lines to the log.
  - R3-run-line-session-same-schema (`bin/codex-review.mjs:519`): run lines written before
    `e3aad48` have no `session`, so a reader must take a missing one as `current`; say so in
    the run log's header and hold it with a test.
  - R3-duration-nan-not-clamped (`bin/codex-review.mjs:498`): a monotonic source that gives a
    non-number makes `durationMs` `null`, and the clock is read outside the `try`. Only an
    injected clock can do either; make the duration `null` on purpose when it is not finite.
- `bin/codex-review.test.mjs` takes just over 120 s here, about 1.3 s a test, since each one
  spawns real git; a foreground limit of 120 s cuts it off, so it is run with a longer one.
- The five test files of the review command took 129 s in one run and 236 s in the next on
  this host, so a foreground limit of 300 s leaves little room.
- The reason logged for a timeout or an overflow quotes the built-in bounds even when a test
  injects others, as the message it copies does (carried in `odd/tasks/codex-exec-review.md`).

## Next step
Slices A, B and C are done: T1 to T7 are checked. The lean session reads its diff, measures
its tokens, reads Codex's answer as data and can review with a prompt of our own that carries
the intent (CLI 0.160.1; Progress holds the numbers of both real runs). Next is slice D, one
delegated writer: T8 (the evidence rule under the lean session and both prompts, with the
three small findings of the last review, Follow-ups) and T9 (a large range reviewed in
parts). Then slice E: the seeded diff and its scorer (T10), the comparison and its report
(T11), and the runs (T12), whose count is put to Sebastián before they start.

Open, for him, one at a time, none blocking slice D:
1. T12, how the `current` session is measured, since it runs `--ephemeral` in his real
   home and reports zero tokens: a run without `--ephemeral` that leaves session files in
   his `~/.codex` and reads them, or a home that copies his configuration.
2. Which CLI version the comparison runs on: 0.160.1 is installed, F6 was paused on 0.160.0,
   and T12's runs must all share one version.
3. The Codex review of the code range `7deddfc..HEAD` before any push, or a recorded skip.
   The lean session has reviewed `338386a..e3aad48` twice; the rest is not covered, and it
   is larger than a session has taken so far, which T9 is for.

On the cap: three Codex reviews spent in this feature (one read nothing, two read their
diff). A single run that proves a piece is announced with its count and run; the batch of
T12 is asked first. Both kept lean homes are swept by the next lean review.
