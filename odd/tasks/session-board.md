# Session board

Locator: `odd/tasks/session-board.md` · Engram mirror: `odd/session-board/tasks` (pending: engram
refused writes in the session that opened this document) · Branch: `feat/session-board`, worktree
`D:\js-harness-worktrees\session-board`, cut from `main` at `3915b88`.

## Goal
`js-harness sessions` prints, from facts on disk, every recent Claude Code session of the project
with what it is doing right now, including the background work it still has running, next to the
worktrees, the running gates and the open pull requests.

## Why
Sebastián runs several sessions at once and answers from his phone. On 2026-10-06 three things
went wrong in one afternoon, all because no session can see the others:

- A side session that had finished kept handing him prompts, one of them addressed to a session
  that never existed, for work the main session had already done.
- The main session recorded that a process "was not killed" while a side session killed it in the
  same minutes.
- The main session reported a side session as waiting for his prompt when it still had a commit in
  the gate and a research subagent running. His words: "está ejecutando 2 terminales ... cuando
  revises también mirá eso porque creo que das por hecho que ya terminó".

The main session has been answering "where is every session" by reading transcripts with throwaway
scripts and by memory. That costs tokens and it missed the background work once already. When
something can be checked by a command, it belongs in `bin/`. He asked for it on 2026-10-06:
"quiero que implementes esto en la funcionalidad de orquestación de sesiones".

## Done when
- `node --test bin/lib/sessions.test.mjs bin/sessions.test.mjs` exits 0
- `node bin/js-harness.mjs sessions --json` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/session-board.md` exits 0
- `npm run check` exits 0
- Run on this machine with two or more sessions open, the board shows for each one its state and
  each piece of background work with what it is and whether it is still running, and the output is
  recorded under Progress next to what was checked by hand.

## In scope / Out of scope
- In: `bin/lib/sessions.mjs` (pure: transcript text and machine facts in, board out),
  `bin/sessions.mjs` (the command: reads the disk, runs `git` and `gh`, prints text or `--json`),
  their tests, the dispatcher entry and help line in `bin/js-harness.mjs`, a `### Session board`
  entry in the checklist of `docs/ROADMAP.md`, the README line that lists commands if there is one.
- In, since the scope was widened on 2026-10-06 (Progress): `sessions --watch`; a second skill in
  `bin/lib/manifest.mjs` with its tests in `bin/lib/manifest.test.mjs` and its paths in
  `scripts/e2e.mjs`; a line for `sessions` in the first skill and in the roadmap's Commands row.
- Out: sending anything to another session, stopping a session or a process, and writing any file
  (the command is read-only, because a board that acts would need the consent the acting needs).
  `AGENTS.md` (1,497 of 1,500 tokens; the memories point to the command instead). Codex sessions
  and other hosts (only Claude Code keeps transcripts in the layout read here). A TUI entry.

## Constraints
- Zero dependencies, plain Node, like every command in `bin/` — because it must run in any host
  with no install step.
- Read-only: it opens transcripts and task outputs for reading and runs only `git worktree list`,
  `git rev-list`, `git status`, the process listing and `gh pr list` — because it runs while other
  sessions work in the same checkout.
- Every path and every external command is injectable (`--claude-home`, `--tmp`, a `deps` object
  for `git`, `gh` and the process listing) — because tests use fixture folders, never this
  machine's sessions.
- Fixtures are synthetic, written for the test — because real transcripts hold Sebastián's
  conversations and must not be committed.
- A fact the command cannot read is printed as unavailable with its reason, never left out and
  never guessed — because the failure this feature answers was a report that assumed.
- A transcript line that does not parse is skipped and counted, not fatal — because a session
  writes its transcript while the board reads it, and the last line may be half written.
- Exit 0 whenever the board was printed, even with unavailable parts; exit 2 for a usage error,
  like `progress`, `remote` and `codex-review`; exit 1 only when no project directory of sessions
  exists.

## Design
What a session is: one `<id>.jsonl` under `<claude home>/projects/<slug>/`, where `<slug>` is the
main checkout's absolute path with every character outside `[A-Za-z0-9]` turned into `-`
(`D:\js-harness` is `D--js-harness`). The main checkout is found with `git rev-parse
--git-common-dir`, so the board is the same from any worktree. `--hours <n>` (default 12) limits
the board to sessions whose transcript changed in that window.

Per session the board gives:
- its id (first eight characters in text, whole in JSON), its title when the transcript has one,
  otherwise the start of its first user message, and the time of its last entry;
- `cwd` and `gitBranch` as its last entry records them;
- its background work: every tool call launched in the background (a `Bash` call with
  `run_in_background`, an `Agent` call) with its description, its launch time, and whether the
  transcript records its end. How a launch gives its id and how an end is recorded was established
  from real transcripts and is under "Transcript format" below;
- for work with no recorded end, the last write of its file when one exists (`<tmp>/claude/<slug>/
  <id>/tasks/<task>.output`, `<claude home>/projects/<slug>/<id>/subagents/agent-<agent>.jsonl`),
  so a task that stopped writing an hour ago does not read as live;
- a state derived from those facts, in this order: `working` when the last entry is a tool call or
  a tool result; `background` when the turn ended and some background work has no recorded end;
  `waiting` when the turn ended and nothing is pending. The last lines of its final reply are
  printed under it (`--tail <n>` lines, default 3), because that is where a session writes its
  question or its next prompt.

Machine facts, each one unavailable with a reason when its command fails:
- worktrees: path, branch, head, commits not on `origin/main`, commits not on the upstream (or "no
  upstream"), count of changed files;
- running gates: every process whose command line runs `bin/check.mjs`, with its worktree and its
  start time (`bin/lib/process-tree.mjs` may already list processes; reuse it if it does);
- open pull requests: number, title, head branch, from `gh pr list`.

Text output: the sessions first, most recent first, then worktrees, gates and pull requests, and a
last line that says what the board cannot see (a session's plans, work a session started outside
the transcript). `--json` carries the same data.

### Transcript format

Established on 2026-10-06 from the 34 transcripts of this project (about 62,000 entries, Claude
Code 2.1.289), with throwaway scripts that printed types, keys, ids and tags and no message text.
The counts are what those scripts printed; three sessions were writing while they ran, so a count
may be off by a few.

- A transcript is one JSON object per line. `user`, `assistant`, `attachment` and `system` entries
  carry `timestamp` (ISO, UTC), `cwd`, `gitBranch` and `isSidechain`; `queue-operation` entries
  carry `timestamp` only; `custom-title`, `agent-name`, `last-prompt`, `mode` and the other
  bookkeeping entries carry none of them. A subagent's entries are in its own file, not here.
- Title: `{"type":"custom-title","customTitle":"..."}`, written again and again (about 1,950
  entries, never two values in one file); the last one is used. Five transcripts have none. In
  three the start of the first prompt stands in: the first `user` entry that is not `isMeta`, not
  `isCompactSummary`, and whose text does not start with a tag. The other two hold no
  conversation and have no title.
- Every `assistant` entry holds one content block (`thinking`, `text` or `tool_use`), and every
  block of one message carries that message's `stop_reason`. A `user` entry's content is a string
  (a prompt, `origin.kind: "human"`; a task notification, `origin.kind: "task-notification"`; a
  local command's `<local-command-stdout>`) or an array (`tool_result` blocks, with the tool's
  structured result in the entry's `toolUseResult`; a `text` block `[Request interrupted by user`).
- A finished turn ends on an `assistant` `text` entry whose `stop_reason` is not `tool_use`
  (`end_turn` in 27 of the 34 files), followed only by `attachment` and `system/stop_hook_summary`
  entries, or on the interruption marker (5 files). A turn in progress ends on a `tool_use` entry,
  a `tool_result`, a `thinking` block, a `text` block whose message stopped for `tool_use`, or a
  prompt or notification with no reply yet. The board reads all of the second list as `working`
  (the design named the first two; a prompt not answered yet is a session that is thinking), and a
  local command's output and a compaction summary as an ended turn. A transcript with no `user` or
  `assistant` entry (2 files) has state `unknown`, with that reason.
- A background `Bash` call is a `tool_use` with `input.run_in_background: true` and
  `input.description`. Its task id is not in the call: it is `toolUseResult.backgroundTaskId` of
  the `tool_result` that follows. Thirty calls without `run_in_background` got one as well (a
  command moved to the background after its launch), so the result, not the input, says what is
  background work.
- An `Agent` call is a `tool_use` with `input.description` and `subagent_type`. It runs in the
  background when its `tool_result` has `toolUseResult.isAsync: true`, `status: "async_launched"`
  and `agentId` (58 results, 39 of them from calls with no `run_in_background` in the input). In
  the foreground the transcript has nothing until the `tool_result`, whose `toolUseResult.status`
  is `completed` with the `agentId` (56 results): that result is its end. While it runs, only
  `subagents/agent-<id>.meta.json` (`toolUseId`, `agentType`, `description`) ties the call to the
  subagent, which is where the command looks the id up.
- The end of background work is a `<task-notification>` block with `<task-id>` (the
  `backgroundTaskId` or the `agentId`), `<tool-use-id>` (the launching call; missing in 3 of 282),
  `<status>` (`completed` 266, `failed` 9, `stopped` 5, `killed` 2 among `user` entries) and
  `<summary>`. It is written in up to three places: a `queue-operation` entry with the block in
  `content` (`operation: "enqueue"`, later `dequeue`, or `remove` with `reason:
  "absorbed_mid_turn"`); a `user` entry whose content is the block, when it starts a turn; and an
  `attachment` of type `queued_command` with the block in `prompt`, when the session absorbed it
  mid-turn. Of 334 background launches, 330 have an end in at least one form: 178 in the queue and
  as a `user` entry, 103 only in the queue or attachment forms, 49 only as a `user` entry. The 4
  without one are three shells of sessions that were closed and the subagent that wrote this. All
  three forms are read, and only text that starts with the block counts, because the same text is
  echoed inside `hook_success` attachments and can be quoted in a prompt.
- A block with `<event>` and no `<status>` (7 `user` entries) is the progress of a task still
  running, not an end.
- A resumed session writes earlier entries again (544 of 6,438 `tool_use` ids appear twice in one
  file), so only the first sight of a call launches work.
- A follow-up to a subagent (established on 2026-10-07 from the same transcripts, 63 calls, three
  of them the ones that resumed the writer of this section): a `tool_use` named `SendMessage`
  whose `input` has `to` and `recipient` (the agent id), `type: "message"`, `summary`, `message`
  and `content`. Its `tool_result` has `toolUseResult.success: true` and a `message`, and says one
  of two things. When the subagent had stopped (55 calls; 34 of those subagents had run in the
  foreground, 21 in the background): `message` is `Resuming agent <id>` and `resumedAgentId` is
  the agent id. The subagent then runs again in the background under the same id and in the same
  `subagents/agent-<id>.jsonl`, and its end is a `<task-notification>` whose `<task-id>` is that
  id and whose `<tool-use-id>` is the `SendMessage` call, not the first `Agent` call (53 of the
  55; of the other two, one was still running). When the subagent was still running (8 calls):
  `message` is `Message queued for delivery to <id> at its next tool round.`, there is no
  `resumedAgentId`, and no notification ever names that call; nothing new starts.
- Notifications also arrive for ids no call of the transcript launched (52 ids): work a subagent
  started. The board does not list it and its last line says so.
- Files: `<tmp>/claude/<slug>/<session>/tasks/<task id>.output` is a shell's output. The same
  folder holds an empty `<agent id>.output` for a subagent, so a subagent's last write is read from
  `<claude home>/projects/<slug>/<session>/subagents/agent-<id>.jsonl`.

### Decisions taken while writing T1 to T3

- (T3c) A follow-up that resumes a subagent is a new piece of work with the subagent's id and
  `resumed: true`, not the first piece reopened: it has its own call, launch time and end, and
  the first run keeps the end it had. Its description is the follow-up's `summary`, its kind the
  first run's. In text its line reads `Agent <id> (<kind>, resumed) ...` under the count of work
  with no recorded end, with the last write of the subagent's transcript.
- (T3c) Which end closes what: an end that names a call closes that call's piece and any older
  piece of the same id still open, never one launched after that call; an end that names only the
  task closes every open piece of that id; an end that closes nothing is kept by task id for the
  one call made before it whose result gives that id later, and is used once.

- `Agent` calls are listed whether they run in the background or the foreground (`mode` says
  which), because a session in the middle of a foreground subagent is exactly the "still has work
  running" case, and its subagent's last write is the only sign of life it gives.
- In text, each piece of work with no recorded end has its own line; the ended ones are a count
  and the latest. `--json` lists every piece. A session of this project holds up to 68.
- The text gives ages (`4m ago`), not clock times, so it reads the same in every time zone;
  `--json` has the ISO timestamps.
- A running gate is a process whose program is `node` and whose command line has `bin/check.mjs`
  as an argument. A shell whose text mentions the file is not one: on the first live run the only
  matches for the bare text were the shells of the session that was searching for it. Its worktree
  is the folder the command line names (the pre-commit hook passes an absolute path); `npm run
  check` passes a relative one and Windows records no working directory, so that gate's worktree is
  unavailable with that reason.
- `bin/lib/process-tree.mjs` lists processes without their command lines, so its listing is not
  reused whole: the command's own PowerShell prints rows with the shared `Format-ProcessRow` and
  reads them back with `parseSnapshot`, as `evals/runner.mjs` does, plus one line per command line.
- `git status` runs with `--no-optional-locks`, so the board never holds the index lock a session
  committing in that worktree needs.
- The sessions folder is `--claude-home`, else `CLAUDE_CONFIG_DIR`, else `.claude` in the home
  folder. `--cwd` exists as in `progress`. Outside a git repository the folder itself is the
  project.
- A usage error exits 2, as in `progress`, `remote` and `codex-review`. The constraint first said
  1; the writer flagged the difference and the parent settled it on 2026-10-06.

## Constraints on the work
- TDD strict, runner `node --test`: each behavior has its failing test first.
- No commit by the writer: the parent commits, in the background, and only when no other
  `check.mjs` is running, because the `codex-review-lean` session commits through the same gate.

## Effort
medium

## Ask me before
- Running the Codex review of this branch's code commits: it spends the same quota F6 and the lean
  review need.
- Push, pull request, merge.
- Anything that would make the command act on a session instead of reading it.
- Running `js-harness install` on this machine: it writes into the real `~/.claude` and `~/.codex`,
  where no machine install exists today (`~/.js-harness/manifest.json` has no files).

## Delivery
Strategy: `ask-on-risk`. Forecast about 450 authored lines (library and command about 200, tests
about 250). If the running count passes about 400 before T3, the chain question is asked then.

Settled on 2026-10-06 by the main session, not by a question: two slices stacked to `main`, the
form the watchdog used (`jsaristi/js-harness#35` to `#37`). Slice 1 is the library and its test
(`bin/lib/sessions.mjs`, 910 lines with the test), slice 2 the command, the dispatcher, this
document and the roadmap entry. Each slice is one work-unit commit with its own review. The chain
strategy is none of the three things Sebastián decides (spend, the irreversible, product choices),
and nothing is pushed without his word, so he can still ask for one pull request. The code was not
cut to fit the budget: 884 of the 1,576 lines are tests.

## Tasks
- [x] T1 `bin/lib/sessions.mjs`: a transcript's text into session facts (title, last entry, cwd and branch, background work with its recorded end, state, tail of the final reply) — route: delegated writer (two non-trivial files, and reading real transcripts prepares the write)
- [x] T2 Machine facts in `bin/lib/sessions.mjs`: worktrees with their unpushed counts, running gates, open pull requests, each unavailable with its reason — route: delegated writer, same delegation as T1
- [x] T3 `bin/sessions.mjs`: `sessions`, `--json`, `--hours`, `--tail`, the injectable paths, text output, exit codes; dispatcher entry, help line and the roadmap checklist entry — route: delegated writer, same delegation
- [x] T3b Accepted review follow-ups on the library: `R3-enoent-misattributed`, `R3-empty-stdout-counts-zero`, `R3-null-entry-fatal`, `R3-end-marker-not-final`, `R3-untested-branches` — route: delegated writer (the library, its test, and the listing script of the command)
- [x] T3c A subagent that is sent a follow-up reads as running again: establish the transcript shape of a resumed subagent from real transcripts, then reopen its work on the board; with it `R3-stale-early-end-on-id-reuse` of the second review, the same ground — route: delegated writer (the library and its test, and reading real transcripts prepares the write)
- [x] T3d Accepted follow-ups of the second review: `R3-args-prototype-keys`, `R3-stat-race-branch-untested`, `R3-facts-throw-kills-board`, `R3-dispatch-test-not-hermetic` (its fifth finding, `R3-stale-early-end-on-id-reuse`, is in T3c) — route: delegated writer, same delegation as T3c
- [ ] T4 Live check on this machine with two or more sessions, output recorded here; the memories `main-session-orchestrates` and `cross-session-prompts` point to the command — route: inline (one run and two memory edits)
- [ ] T5 `sessions --watch`: the command waits and returns when the board changes (a session's state, its open background work, a gate starting or ending, a pull request opening or closing), printing what changed; it costs nothing while nothing changes — route: delegated writer
- [ ] T6 The orchestrator ships with the harness: a second skill declared in `bin/lib/manifest.mjs` for Claude Code and Codex, installed and removed through the manifest like the first, that tells the session playing orchestrator what to run and what it may and may not do, and tells a side session how it closes; the two tests that assume one skill corrected — route: delegated writer
- [ ] T7 On this machine, on Sebastián's word: `js-harness install`, the orchestrator session opened with the skill, and one real stretch with two sessions supervised by it, recorded here — route: inline

## Progress
- 2026-10-06: document created in the main session (the one that holds F6, paused at 13 of 15
  trials), on Sebastián's request, after reading the contract template, `odd/tasks/progress-view.md`
  for the shape, the roadmap's checklist headings and the dispatcher. Evidence the design rests on,
  from that afternoon's hand checks: a background `Bash` call's end appears in the transcript as a
  task notification with its task id (seen for `bi2h2rw8m` of session `77a27016`); a subagent's
  transcript is `subagents/agent-<id>.jsonl` and keeps changing while it runs; a session's task
  outputs are under the temp folder named above. Not established yet: how an `Agent` call's end is
  recorded (the hand script did not match it), which is T1's first step.
- Decision recorded: this feature runs in the main session although a session holds one feature,
  because F6 is paused and the main session is the one that orchestrates; opening a fourth session
  for it would add to the disorder it exists to end.

- 2026-10-06, T1 (delegated writer, not committed): the transcript format was read from the real
  transcripts first and is under "Transcript format" above. RED: `node --test
  bin/lib/sessions.test.mjs` against an empty module, 28 tests, 0 pass, 28 fail (`lib.sessionFacts
  is not a function` 26 times, `lib.parseTranscript is not a function` twice). GREEN: the same
  command, 28 pass. One more RED after the survey showed a resumed session repeats entries: the
  test "a call and its result written again later ... do not reopen work that ended" failed with
  `ended: false` where `true` was expected, and passed once only the first sight of a call
  launches work. Run over the 34 real transcripts with a throwaway script that printed ids, states
  and counts only: the library leaves open the same four pieces of work the survey found without
  an end record, and no other.
- 2026-10-06, T2 (same writer): RED: the same command, 41 tests, 28 pass, 13 fail (`readWorktrees`,
  `readPullRequests`, `findGates`, `readGates`, `parseProcessList`, `parsePsList`,
  `parseWorktreeList`, `projectSlug` `is not a function`). GREEN: 41 pass. One more RED: `node
  D:/proj/sbin/check.mjs` was taken for a gate with worktree `D:/proj/s`; the pattern now wants
  `bin/check.mjs` to start the argument or follow a separator.
- 2026-10-06, T3 (same writer): RED for the text: 44 tests, 41 pass, 3 fail (`lib.renderBoard is
  not a function`); GREEN: 44 pass. RED for the command: `node --test bin/sessions.test.mjs`
  failed on the missing `bin/sessions.mjs`; GREEN: 26 pass. RED for the dispatcher: `node --test
  --test-name-pattern sessions bin/js-harness.test.mjs`, 2 fail (the help had no `sessions` line;
  `sessions --cwd <temp> --claude-home <temp>` exited 2, the dispatcher's unknown command, where 1
  was expected); GREEN: 2 pass, and the whole file, 22 pass. First live run, `node bin/js-harness.mjs sessions` from this worktree, exit 0 in about
  eleven seconds while a gate was running (`gh pr list` took 1.5 s and the process listing 2.1 s
  when timed alone): six sessions in the last twelve hours. `77a27016` `background`, one shell with
  no recorded end (its commit through the gate) and five ended; `729ed66b` `background`, one
  subagent with no recorded end (this writer), its file written 3 s before, and eighteen ended;
  `0432a149`, `ea84ab15` and `71ccf3e5` `waiting` with nothing open; `30293afd` `unknown`, a
  transcript with no conversation. Six worktrees with their counts, one gate (pid 4952, worktree
  `D:/js-harness-worktrees/codex-review-lean`, started 4 minutes before, the same gate the open
  shell of `77a27016` is waiting for), no open pull request. This is a first look, not the live
  check of T4: nothing was compared by hand with what the sessions were doing.
- Size: 1,576 lines, against a forecast of 450 (`bin/lib/sessions.mjs` 424, `bin/sessions.mjs`
  240, the two test files 486 and 398, the dispatcher and its test 28). The forecast counted
  neither the three forms of an end record, nor the per-fact unavailable reasons, nor a text
  renderer with its own tests. The running count passed 400 before T3, so the chain question of
  "Delivery" is the parent's to ask before the commit.
- 2026-10-06, follow-up on T3 (same writer): a usage error now exits 2. RED: `node --test
  bin/sessions.test.mjs`, 26 tests, 17 pass, 9 fail (`actual: 1, expected: 2`, the nine usage
  cases), and the dispatcher's `sessions --bogus` test failed the same way. GREEN: 26 pass, and
  the dispatcher's file 22 pass. "No sessions folder" still exits 1, and its two tests did not
  change.
- 2026-10-06, review of the library commit: gentle-ai reviewed `3915b88..875c5d9` (risk medium,
  due by `slice_budget_reached`, consent granted, one consolidated reviewer), outcome approved,
  lineage `review-f4fbf1b6d5dfc3fa`, acknowledged. It left five advisory findings, all accepted by
  the parent: `R3-enoent-misattributed` (WARNING), and `R3-empty-stdout-counts-zero`,
  `R3-null-entry-fatal`, `R3-end-marker-not-final`, `R3-untested-branches` (SUGGESTION).
- 2026-10-06, T3b (delegated writer, not committed, on top of `875c5d9`). The tests of the five
  findings were written first and run together: RED, `node --test bin/lib/sessions.test.mjs`, 64
  tests, 49 pass, 15 fail; GREEN, the same command, 64 pass. By finding:
  - `R3-enoent-misattributed`: RED 4 fail (the `prunable` key missing from two list tests; git run
    in a prunable worktree; `git is not installed or not on PATH` where the folder was missing).
    Now the porcelain's `prunable` line is read, nothing is run in such a worktree and its three
    counts say `its folder is gone: git lists the worktree as prunable (<git's reason>)`; and an
    ENOENT on a count, which runs after the list was read with the same git, says `the folder
    <path> does not exist (ENOENT starting git there)`. The list itself and `gh pr list` keep "not
    installed or not on PATH": nothing has run before them that proves the program starts.
  - `R3-empty-stdout-counts-zero`: RED 6 of 7 cases fail (`""`, blank, `0x10`, `1e3`, `-1`, `3.0`
    were taken for counts; `2 commits` was already refused). A count is now digits only.
  - `R3-null-entry-fatal`: RED 2 fail (`null`, `42`, `"text"`, `[1]`, `true` were pushed as
    entries; `sessionFacts` threw on a `null` block). A line that is not an object is skipped and
    counted; a block that is not an object is left out; a text block counts only with a string.
  - `R3-end-marker-not-final`: RED 1 fail in the library (a marker before the rows, a marker
    followed by a row and a count that disagreed were all accepted) and 1 in `node --test
    bin/sessions.test.mjs` (the script printed the count of all processes). The stricter check was
    chosen over a weaker comment: the script now prints `OK` with the number of command lines it
    wrote, as its last line, and the parser refuses a last line that is not the marker and a count
    that differs from the lines it read. Proved on the real listing twice: with no candidate (`Gates
    none running`) and with one (a shell whose command line named `bin/check.mjs`; `gates`
    available, 0 items).
  - `R3-untested-branches`: RED 2 fail. A notification that names only the task id and arrives
    before the tool result that records that id left the work open for good: ends are now kept by
    task id and applied when the id arrives. And an end with no time won "latest ended" over every
    dated one: a timed end now wins. The other four cases passed as written and pin what was
    already right: `Task` listed as `Agent`, a first prompt made of blocks, the attachment's own
    time for an absorbed end, `returned` and `error` for a foreground Agent result.
  After the fixes `node --test bin/lib/sessions.test.mjs bin/sessions.test.mjs` is 90 tests, 90
  pass, and `node bin/js-harness.mjs sessions --hours 2` exits 0 with three sessions
  (`77a27016` `working`, `729ed66b` and `0432a149` `waiting`, no work open, no gate running).
  The library changes of T3b are not in `875c5d9`: they are in the working tree, for the parent
  to commit.
- Seen in that last run and not fixed (outside the five findings): `729ed66b` read `waiting` with
  nothing open while this writer was running for it. A subagent that is sent a follow-up after its
  first end keeps the same agent id; the notification of that first end closed its work, and the
  board reads no later launch. A resumed subagent is therefore invisible until the transcript
  shape of a follow-up is established the way the launch was. T4 should check it by hand.

- 2026-10-06, scope widened by Sebastián, in two messages. First: "que tal si hacemos una sesion
  que siempre este activa y principal que coordine y supervise en tiempo real el resto sesiones".
  Then, to the answer that it could be a dedicated session woken by changes: "pero quiero que lo
  añadamos al harness". So the orchestrator is a part of js-harness, not a rule in one machine's
  memory: T5 (`--watch`), T6 (the skill the installer ships) and T7 (this machine) are his request.
  What he had settled the same day and the skill has to carry: the orchestrator sees where every
  session is and says whether to send a session's own prompt, wait, or drop it; it does not write
  another session's prompts, because each session owns its work and has the context ("cada sesión
  tiene independencia"); a session that already wrote its next prompt is not finished while it has
  background work; a side session gives prompts only for itself and closes with a notice to the
  orchestrator. The design answer to "always active": woken by a change, not polling with a model,
  so it costs nothing while nothing changes; it still dies with the desktop app like any session.
- Evidence for T6, from a read-only mapping of `main`: the harness has no skills folder; its one
  skill is the template string `skillContent` in `bin/lib/manifest.mjs:9-28`, declared twice in
  `components` (`:31-42`) for `~/.claude/skills/js-harness/SKILL.md` and
  `~/.codex/skills/js-harness/SKILL.md`; `install` records each file with its sha256 and
  `uninstall` removes only what still matches (`:533-559`, `:629-639`); `sync` installs before it
  prunes, so a new component needs no engine change. `bin/lib/manifest.test.mjs:55` and `:119-128`
  assume a single skill and fail when a second is added; other tests index `components[0]` and
  `[1]`, so new components go after the first two. No gate measures a skill's size. On this machine
  nothing is installed at machine level, which is why T7 is a step of its own. Not established:
  whether Codex loads a skill from that frontmatter.
- Commits so far: `875c5d9` (slice 1, the library; gate green; gentle-ai approved, lineage
  `review-f4fbf1b6d5dfc3fa`).
- 2026-10-07, second review: with `5a79a0d` (the T3b fixes) and `6c92d93` (the command, this
  document, the roadmap entry) committed, gentle-ai reviewed `875c5d9..6c92d93` (risk medium, due
  by `slice_budget_reached`, consent granted, one consolidated reviewer), outcome approved, lineage
  `review-2276b071e49a490d`, acknowledged. Five advisory findings, all accepted by the parent:
  `R3-stale-early-end-on-id-reuse` (WARNING), and `R3-args-prototype-keys`,
  `R3-stat-race-branch-untested`, `R3-facts-throw-kills-board`, `R3-dispatch-test-not-hermetic`
  (SUGGESTION).
- 2026-10-07, T3c with `R3-stale-early-end-on-id-reuse` (delegated writer, not committed). The
  shape of a follow-up was read first from the real transcripts, the parent's three follow-ups to
  this writer among them, and is under "Transcript format". RED: `node --test
  bin/lib/sessions.test.mjs`, 74 tests, 63 pass, 11 fail: no `resumed` key on work (2), a
  `SendMessage` that resumes a subagent launched nothing (7, among them the end that names the
  follow-up, the repeated old end, the repeated follow-up, the task-only end), no `resumed` label
  in the text (1), and the finding itself: a second launch under an id whose end had been kept was
  closed at once, `endedAt` 10:05 before its `launchedAt` 10:08 (1). The case of a message queued
  for a subagent still running passed as written. GREEN: 74 pass. `node --test
  bin/sessions.test.mjs` got one case for the file of resumed work, green as written once the
  library was. Over the 34 real transcripts, with a script that printed counts only: 454 pieces
  of work, 55 of them resumed, one of those open (this writer), none ended before its launch.
  Live, `node bin/js-harness.mjs sessions --hours 2`, exit 0, while this writer ran as a resumed
  subagent: `729ed66b` `background`, two pieces with no recorded end and 26 ended. The two: `Agent
  ab8b82d56ba4fa5d8 (general-purpose, resumed)`, launched 5 minutes before (01:36:12Z, the time
  of the parent's `SendMessage`), file written 1 second before; and a shell, `brjc287q0`, launched
  19 minutes before with its output last written 18 minutes before, which nobody checked by hand.
  `77a27016` `waiting`, nothing open, 11 ended. No gate, no open pull request.
- 2026-10-07, T3d (same writer, not committed):
  - `R3-args-prototype-keys`: RED, `node --test bin/sessions.test.mjs`, 11 of 13 new usage cases
    fail: `constructor x`, `toString x`, `hasOwnProperty x` and `__proto__ x` went on to run git;
    `--tail ""`, `--tail " "` and `--tail 0x2` were taken for 0, 0 and 2; `--hours 1e1` for 10;
    `--cwd ""`, `--claude-home ""` and `--tmp ""` for paths. `--hours ""` and `--hours " "` were
    already refused. GREEN: all 22 usage cases pass. The flags are in a `Map`, a number is plain
    digits (with a decimal part for `--hours`), an empty value is a missing one. Live:
    `node bin/js-harness.mjs sessions constructor x` prints `unknown argument: constructor` and
    the usage, exit 2.
  - `R3-stat-race-branch-untested`: the test passed as written (the branch was right, and
    untested): a transcript whose `stat` fails after the listing is on the board as `{ id,
    modifiedAt: null, unavailable: "ENOENT" }`, after every dated session, the text prints its
    line, exit 0.
  - `R3-facts-throw-kills-board`: RED 1 fail, the command rejected with the reader's `TypeError`.
    No transcript shape is known to make the reader throw since T3b, so the reader is a dependency
    of the command (`readFacts`) and the test hands in one that throws. GREEN: that session is
    `unavailable: its transcript could not be read into facts: <message>` and the others print.
  - `R3-dispatch-test-not-hermetic`: RED reproduced by running the test with `TEMP` and `TMP`
    inside a scratch repository: the message named that repository, not the temp cwd. The test
    now asserts the exit code, the empty stdout, the one-line message and the temp Claude home in
    it, and no longer which project git answers with. GREEN in both temp roots.
  After both: `node --test bin/lib/sessions.test.mjs bin/sessions.test.mjs
  bin/js-harness.test.mjs`, 138 tests, 138 pass.

## Next step
T3c and T3d are in the working tree for the parent to commit through the gate, when no other gate
is running, followed by its gentle-ai assessment and the roadmap step for T3c.
Then T4, so the board is proved by hand before anything is built on it; then T5, T6 and
T7. Before any push: Sebastián's word, and his answer on the Codex review of the code commits,
which spends quota. Before T7: his word on `js-harness install`.
