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
  `scripts/e2e.mjs`; a line for `sessions` in the first skill and in the roadmap's Commands row;
  the board's `Relief` section, which reads the orchestrator's relief file.
- Out: sending anything to another session, stopping a session or a process, and writing any file
  (the command is read-only, because a board that acts would need the consent the acting needs).
  `AGENTS.md` (1,497 of 1,500 tokens; the memories point to the command instead). Codex sessions
  and other hosts (only Claude Code keeps transcripts in the layout read here). A TUI entry.

## Constraints
- Zero dependencies, plain Node, like every command in `bin/` — because it must run in any host
  with no install step.
- Read-only: it opens transcripts, task outputs, feature documents and the orchestrator's relief
  file for reading and runs only
  `git rev-parse` (to find the checkout), `git worktree list`, `git rev-list`, `git status`,
  `git diff --name-only`, `git ls-files`, the process listing and `gh pr list` — because it runs while other sessions work in the same
  checkout. `--watch` runs the same and nothing more, again at every look.
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
--git-common-dir`, so the board is the same from any worktree; where that directory is not a
`.git` inside the checkout (a submodule, `--separate-git-dir`) git is asked for the top of the
working tree instead. One case stays unresolved: a worktree linked to a `--separate-git-dir`
checkout, which git itself traces back only to the git directory. `--hours <n>` (default 12) limits
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
- running gates: every process whose command line runs `bin/check.mjs`, or the dispatcher with
  `check` as its subcommand (`js-harness check`, the form the hook of an initialized project
  runs), with its worktree and its start time (`bin/lib/process-tree.mjs` may already list processes; reuse it if it does);
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

### The orchestrator
Approved by Sebastián on 2026-10-06 ("Sí al plan completo, seguí con los pasos 3 a 6"), after the
plan was laid out to him in three answers. This section is that plan; T5 and T6 build it.

Two kinds of session. A work session owns one feature: its worktree, its feature document and its
own prompts. The orchestrator is a dedicated session with no feature. It reads; the only file it
writes is its relief file. It never implements, never commits, never writes in a worktree and never
answers for Sebastián. It does not write another session's prompts, with one exception: the opening
prompt of a new work session, which therefore carries what that session needs (what to read first,
the decisions already taken, how the machine is shared), as pointers and not as content.

Why it does not implement: reading code, running tests and discussing a design are what fill a
context. A session that orchestrates and builds at once is the one that opened this document, and
it compacted twice in a day. An orchestrator whose turns are a board and a few lines lasts.

Where each thing lives, so that nothing lives in a conversation:
- the project's plan (the order of the features, the decisions): `docs/ROADMAP.md` on `main`,
  changed through small documentation pull requests;
- a feature's plan (tasks, progress, next step): `odd/tasks/<feature>.md` on its branch, written
  only by the session that owns the feature;
- what is in flight between sessions and in neither file yet (his decisions, questions still
  open, notices not yet delivered, what each session is for): the orchestrator's relief file;
- the facts (who works, what runs, gates, branches, context sizes): not stored, computed by
  `js-harness sessions`.

How a request enters. Sebastián tells the orchestrator what he wants. It places it with the roadmap
and the board: work of a feature whose session is open goes to that session, and he says it there
in his own words; new work gets the opening prompt of a new session; a design conversation is also
a session of its own. The orchestrator notes in the relief file what was asked and where it went,
and goes back to waiting.

When it speaks. It waits on `sessions --watch`, which costs nothing while nothing changes, and
writes to him only when: a session starts waiting on him; a session finished with nothing running
behind it; a gate is about to start while another runs; a prompt he holds became stale; a feature's
plan changed; a session's context passed the threshold. Otherwise it is silent.

When a plan changes (something failed, did not come out as wanted, or a problem appeared). The
session that finds it writes it in its own document before going on: the task reopened or added,
with the reason, committed. Every worktree is on the same disk, so the board reads each branch's
document without a merge, and the watch returns when a task list or a next step changes. The
orchestrator tells him what changed, why (the written reason), and which other session it touches;
for that session it gives a one-line notice, and that session updates its own document. A change
to the project's plan goes to the roadmap on `main`. The rule under all of it: a change does not
exist until it is in a file.

Relief, not compaction. The orchestrator keeps nothing the files do not hold, so it is replaced
when its context passes a threshold, the board showing each session's context size:
- it writes to the relief file as things happen, one dated line each, never at the end, because it
  can die without warning (the desktop app restarting kills it like any session); the file only
  grows, it is never rewritten or summarized;
- when the threshold is passed it tells him and gives the fixed opening prompt, always the same;
- the new orchestrator reads the relief file, the board, and the last reply of the one before it
  (the board prints it), and says it is watching; only then is the old one archived, so there are
  never two;
- compaction is the net, not the plan: if the context filled before the relief, the session coming
  back from a compaction does what a new orchestrator does.
Why not compaction as the rule: a summary is a session telling from memory what happened, the
defect this feature removes; and on 2026-10-06 the session that opened this document lost its
engram writes after each of its two compactions.

The relief file, settled with T6. It is `<home>/.js-harness/relief/<project slug>.md`: `<home>` is
`JS_HARNESS_HOME` or the user's home, as for `install` and `remote`, and the slug is the one of the
sessions folder, so every worktree of a project shares one file and two projects never share one.
It is outside the repository because it is not a plan: nothing in it is reviewed or merged, and a
file in a worktree would belong to a branch. The orchestrator writes it, by appending with its own
tools, as the skill tells it; no command of the harness writes it and `install` does not create it.
`js-harness sessions` prints its path and last lines under `Relief` and only reads it. It is undone
by deleting that one file: no manifest records it, so `uninstall` leaves it, and with it the
`.js-harness` folder that holds it. The first line an orchestrator appends says that it started and
gives its session id, which is how the next one finds the last reply of the one before it.

The skill is `js-harness-orchestrator`, the text of `orchestratorSkillContent` in
`bin/lib/manifest.mjs`, installed for Claude Code and for Codex. It has the orchestrator's part and
the work session's part in one file, because a host loads a skill by its description and both
kinds of session need the same picture of who owns what.

Still open, to be settled with what T7 shows: whether a command should append the relief lines
(today the session does); whether the orchestrator can notify his phone by itself; how long one
lasts before a relief; whether Codex loads the skill.

### Watch, context and plans
What T5 added to the board, and what each fact is read from.

- Context size. The last reply of the session's own (not a side chain, not a message the harness
  wrote itself with model `<synthetic>`) records its `usage`; the context is `input_tokens` plus
  `cache_read_input_tokens` plus `cache_creation_input_tokens`, with the model and the time. In
  this project's transcripts that sum is within half a percent of the `preTokens` the harness
  writes at a compaction. After a compaction and until the next reply it is the boundary's
  `compactMetadata.postTokens`. A transcript where no reply records usage has it unavailable.
- The context window, `--context-window <tokens>`, default 480,000. The desktop app shows a
  context as a percentage, and that is the number Sebastián reads, so the board prints it next to
  the tokens: `context 342k tokens (71%)`, `contextPercent` on each session and `contextWindow` on
  the board in `--json`. The default is this machine's reading of 2026-10-06, one data point:
  the board said 342k tokens for a session the app showed at 71%, which is a window of about
  480,000. It belongs to the model and the app, so it is a default and not a constant. A context
  above the window is said as it is (104%).
- The context limit, `--context-limit`, default `73%`. It takes a whole number of tokens or
  `<N>%` of the window (decimals allowed, above zero, up to 100), whichever flag comes first;
  either way the board keeps it in tokens (`contextLimit`) and says it as both, the percentage
  first (`contextLimitPercent` in `--json`): "past the limit of 73% (350k)" on the board, and
  "passed the context limit: 366k tokens (76%), limit 73% (350k)" from the watch. It marks
  (`pastContextLimit`) and limits nothing. 73% of the default window is 350,400 tokens, where the
  350,000 of T5 was. Measured in this project's transcripts on 2026-10-06: the six automatic
  compactions came at 466,887 to 468,151 tokens, the manual ones at 243,607 to 406,565 (median
  322,517), and a session starts at 75,365 to 98,097. So the limit leaves about 115,000 tokens
  to write the relief before the harness compacts by itself, and it is close to where Sebastián
  compacts by hand. A limit given in tokens may be above the window: nothing checks one against
  the other.
- Feature plans. For each worktree, the documents under `odd/tasks/` that differ from
  `origin/main`: `git diff --name-only --diff-filter=d --merge-base origin/main -z -- odd/tasks`
  (committed on the branch or changed in the working tree) and `git ls-files --others
  --exclude-standard -z -- odd/tasks` (not tracked yet), both with `--no-optional-locks`. `-z`
  gives each name as it is: line by line git prints a name with a character outside ASCII
  quoted and escaped, which is not a path, and the document was left out in silence. Each is
  read from the worktree's disk, so an edit shows before its commit, and parsed with `tokenize`
  and `parseFeature` of `bin/lib/progress.mjs`: title, steps done and total, the pending tasks
  (the id a step starts with, else its first 40 characters), and the non-blank lines of `## Next
  step` (all of them in `--json`, the first three in the text). A document that cannot be read
  is unavailable with the reason; a worktree with none prints nothing extra, which is the case
  of the main checkout.
- This session. `CLAUDE_CODE_SESSION_ID`, which Claude Code sets for every command a session
  runs, or `--self <id>` (the whole id or its first eight characters or more), which wins. The
  session is printed like the others and marked `(this session)`, `self: true` in `--json`.

The watch. `sessions --watch` takes a board, waits `--interval` seconds, takes another, and
returns when the two differ in a way that needs a decision; otherwise the new one becomes the
board to compare with and it waits again, until `--timeout`. It prints nothing while it waits.
The difference is `boardChanges` in the library, a function of two boards; the loop in the
command only waits and prints. What wakes it, one line each:
- a session that appears in the window, with its state; one whose transcript no look had been
  able to read is announced the same way at the first look that reads it, and the line says so;
- a session that starts waiting, from any other state; from `background` the line says how many
  pieces of work it had open, which is "its open work became empty while its turn was over";
- a session waiting at both looks whose turn ended at a different time (`turnEndedAt`): it was
  given something and finished it between two looks;
- a session whose context passes the limit (said once, not at every look above it);
- a session that leaves the window;
- a gate that starts, said apart when another gate is running, and a gate that ends (by pid),
  among the gates whose folder is one of the board's worktrees and the ones started by a relative
  path, which name no folder (`npm run check` is one);
- a pull request that opens, and one that is no longer open (by number; merged and closed look
  the same, the board lists the open ones);
- a feature plan that appears, one that no longer differs from `origin/main`, and one whose done
  or total count, pending tasks or next step changed (the whole text of the next step is
  compared, not only the lines the board prints).

What does not wake it, on purpose: a session that starts working, or goes to `background`; the
age of a last entry; the last write of a background file; the tail of a reply; a context that
grows below the limit; a piece of work that ends while others of the session stay open; the
counts and the head of a worktree; a worktree that is removed; a line added to the relief file. A
gate whose command line names a folder that is none of the board's worktrees does not wake it
either, though the board lists it: the test suite of a running gate starts `bin/check.mjs` in
temporary folders, and on 2026-10-06 a watch returned with `gate ended in
C:/Users/Oficina/AppData/Local/Temp/js-harness-pre-push-3duIqX (pid 32036)`. Such a process is not
the "another" a gate is said to start beside. The session that watches is never
compared. A fact that could not be read at one look is not compared at that look, and the board
to compare with keeps its last readable value (`watchBaseline`), so a failed `gh` call or a busy
transcript neither wakes the watch nor hides the change that happens across it. Which gates are
compared depends on the worktrees, so a look that could not list them compares no gate and the
board to compare with keeps the gates it had. The worktrees say which gates are watched, never
whether one runs: a gate started when its pid is on no gate of the older board and ended when it
is on none of the newer one, so a worktree removed or added under a running gate is neither. A
gate still running after its worktree was removed is no longer watched, and its end is not said.

The relief file. The board's last section, `Relief`, after the pull requests: the path of the
orchestrator's relief file, how many lines it holds and the last five of them, blank lines apart
(the whole file is one read away, so no flag asks for more). The path is the one under "The
orchestrator", or `--relief <path>`. A relative `--relief` is read from the folder the command
runs in, not from `--cwd`: `--claude-home` and `--tmp` are handed to the file system as given,
which is the same folder. An empty `JS_HARNESS_HOME` is no home, and the user's is used. A file
that is not there yet is said as that, with the path
the first line would create; one that is there and cannot be read is unavailable with the reason.
`--json` has it as `relief`: `{ path, exists: false }`, `{ path, exists: true, lineCount, lines }`
or `{ path, unavailable }`. It is read at every look and never written.

Output and exit codes. With changes: `sessions --watch: N changes after Ns`, the changes, an
empty line, the board; exit 0. At the timeout: `sessions --watch: nothing changed in Ns` and no
board, so being woken for nothing costs one line; exit 0. `--json` gives `{ watch: { changed,
waitedSeconds, changes }, board }`, without `board` at the timeout. The seconds are the time that
passed, looks included, so a 20 s timeout can say 24. A usage error is 2: `--interval` or
`--timeout` that is not a number above zero and up to 2,147,483 seconds (the largest delay a
Node timer takes; above it the timer fires after a millisecond and the watch would look in a
loop), either of them without `--watch`, a `--self` shorter than eight characters, a
`--context-window` that is not a whole number of tokens above zero, a `--context-limit` that is
neither that nor a percentage above zero and up to 100, and for every numeric flag (`--hours`
and `--tail` too) digits enough to read as infinity. The sessions folder missing at any look is
1.

Defaults. `--interval 30`: a look is one process listing, one `gh` call and a few `git` calls
per worktree (about four seconds in all on this machine, with six worktrees), so 30 s is some
120 `gh` calls an hour and a change is seen within half a minute. `--timeout 3000`: fifty minutes, so whoever waits hears
"nothing changed" within the hour and never takes silence for a watch that died.

Limits. Something that happens and is undone between two looks is not seen: a gate shorter than
the interval, a pull request opened and closed. The output of a local command also ends a turn,
so "finished another turn" can be a `/` command Sebastián ran in that session. A gate is known
by its pid and, where the listing gives one, its start time; where it gives none (`ps`), one
that ends and another that starts with the same pid between two looks read as the same gate.

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
- [x] T4 Live check on this machine with two or more sessions, output recorded here; the memories `main-session-orchestrates` and `cross-session-prompts` point to the command — route: inline (one run and two memory edits)
- [x] T5 `sessions --watch`: the command waits and returns when the board changes (a session starts waiting, its open work changes, a gate starts or ends, a pull request opens or closes, a feature's plan changes, a context passes the threshold), printing what changed, at no cost while nothing changes; the board also gains each session's context size and each worktree's feature plan (document, done and total, next step) — route: delegated writer
- [x] T5b Accepted follow-ups of the third review: `R3-watch-wait-upper-bound`, `R3-task-only-end-between-followup-call-and-result`, `R3-new-session-first-look-unreadable`, `R3-tool-result-without-recorded-call`, `R3-plan-listing-quoted-names-and-doc-drift`; and the context limit as a percentage of a window (`--context-window`, `--context-limit <N>%`) — route: delegated writer
- [x] T6 The orchestrator ships with the harness: a second skill declared in `bin/lib/manifest.mjs` for Claude Code and Codex, installed and removed through the manifest like the first, that tells the session playing orchestrator what to run and what it may and may not do, and tells a side session how it closes; the two tests that assume one skill corrected; with it the board's `Relief` section and the watch comparing only gates of the project's worktrees — route: delegated writer
- [x] T6b Accepted follow-ups of the fourth review: `R3-watched-gates-follow-worktree-set`, `R3-relief-path-base-untested`, `R3-usage-error-test-names-collide` — route: delegated writer
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

- 2026-10-06, 20:43 local, T4, the live check, done by the parent while the gate of `df1ad94` ran.
  `node bin/js-harness.mjs sessions --hours 3` against the same facts read another way:
  - `729ed66b` (this session): the board showed two pieces of work with no recorded end, the
    shells `brjc287q0` (a watcher) and `b520tmsvq` (the commit), and the writer ended 41 s
    before. The Windows process list had both scripts running with the same start times, and the
    writer's end notification had just arrived. While the writer ran its third follow-up, the
    board had shown it open and marked resumed (its own report), where before T3c it read ended.
  - `77a27016` (the Codex review session): `waiting`, nothing open. The desktop app's own
    session list showed it idle, its worktree was clean at `2c74d42`, and no process named it.
  - `0432a149` (the closed watchdog session): `waiting`; the app showed it idle.
  - Gates: one, pid 29604, worktree `session-board`, started 6 s before; the process list had
    that pid created at 20:43:36.
  - `feat/codex-parity`: 13 not on `origin/main`, 14 not pushed; `git rev-list --count` gave
    13 against `origin/main` and 14 against its upstream `origin/feat/codex-parity`.
  Every fact matched. Two limits seen: a process that is alive but silent reads the same as a dead
  one, the board only has the last write of its file (the watcher's said "20m ago" while it ran);
  and the app listed a session, `js-harness-8a`, that the board does not show (probably the
  remote server's own; not checked). The memories `main-session-orchestrates` and
  `cross-session-prompts` now name the command, the second with the rule of checking `Gates`
  before a commit.
- 2026-10-06: `df1ad94` (T3c and T3d) committed, gate green. gentle-ai assessed
  `6c92d93..df1ad94` as medium and not due (`under_budget`), so it waits in the slice for the
  next commit. Sebastián approved the orchestrator plan ("Sí al plan completo, seguí con los pasos
  3 a 6"); it is written under "The orchestrator" in the design. T5 grows by what that plan needs
  from the command: each session's context size, each worktree's feature plan, and a watch that
  also returns on a plan change.
- 2026-10-06, T5 (delegated writer, not committed by it), in three parts, each test first. The
  design is under "Watch, context and plans".
  - A, context size. Library RED: `node --test bin/lib/sessions.test.mjs`, 80 tests, 73 pass, 7
    fail; GREEN: 80 pass. Command RED: `node --test bin/sessions.test.mjs`, 47 tests, 46 pass, 1
    fail (the four `--context-limit` usage cases passed as written: an unknown argument already
    exits 2); GREEN: 47 pass.
  - B, feature plans. Library RED: 86 tests, 80 pass, 6 fail; GREEN: 86 pass. Command RED: 48
    tests, 47 pass, 1 fail; GREEN: 48 pass.
  - C, the watch. Library RED: 96 tests, 86 pass, 10 fail (`turnEndedAt`, `boardChanges`,
    `watchBaseline`); GREEN: 97 pass, the 97th being `isSelf`, whose test was written after it.
    Command RED: 66 tests, 59 pass, 7 fail (the eleven new usage cases passed as written, for the
    same reason as in A); GREEN: 66 pass. Dispatcher help line RED: 22 tests, 21 pass, 1 fail;
    GREEN: 22 pass. The three files together: 185 pass.
  - Live, from this worktree. `sessions --hours 2`, exit 0: two sessions, this one `background`
    with 2 pieces open, marked `(this session)`, context 320k tokens; `77a27016` `waiting`,
    275k; the plans of `codex-parity` (12/14, pending T7, T8), `codex-review-lean` (4/15) and
    this one (7/10, pending T5, T6, T7) under their worktrees, none under the main checkout or
    the two `orca` worktrees. `sessions --watch --interval 5 --timeout 20`, exit 0, one line:
    `sessions --watch: nothing changed in 24s`. `sessions --watch --interval 0`, exit 2 with the
    usage. A watch that returns on a change, live: the real command, clock, `git`, `gh` and
    process listing, with `--claude-home` on a made-up sessions folder outside the repository
    holding one synthetic session in the middle of a tool call, `--interval 3 --timeout 60`. Its
    reply was appended 8.0 s in; the watch had printed nothing until 17.6 s, then `sessions
    --watch: 1 change after 14s`, the line `session eeeeeeee "synthetic prompt" is waiting (was
    working)` and the board, exit 0. No watch has yet returned on a change of a real session.
  - Size: 872 lines added and 68 removed in `bin/` (source 415 and 62, tests 457 and 5).
  - Decided by the writer, for the parent to confirm: the context limit default (350,000, the
    reasons in the design); a watch at its timeout prints one line and no board; `--interval` and
    `--timeout` without `--watch` are usage errors; a session that appears already past the limit
    gets both lines; a worktree that arrives with a plan wakes the watch and one that is removed
    does not.

- 2026-10-06: `24e1786` (T5) committed, gate green. gentle-ai assessed `6c92d93..24e1786`
  (T3c, T3d and T5 together) as medium and due (`slice_budget_reached`); consent granted, one
  consolidated reviewer, approved, lineage `review-1464f6f176a88b4d`, acknowledged. Five advisory
  findings, all SUGGESTION, all accepted as T5b:
  - `R3-watch-wait-upper-bound` (`bin/sessions.mjs:61`): `--interval` and `--timeout` have no
    upper bound; past about 2,147,483 s Node fires a timer after a millisecond, so the watch would
    look at the machine in a tight loop.
  - `R3-task-only-end-between-followup-call-and-result` (`bin/lib/sessions.mjs:270`): an end that
    names only the task, written after a `SendMessage` call and before its result, is kept by task
    id and then closes the resumed piece the result creates.
  - `R3-new-session-first-look-unreadable` (`bin/lib/sessions.mjs:537`): a session new to the
    window whose transcript fails to read at its first look is never announced by the watch.
  - `R3-tool-result-without-recorded-call` (`bin/lib/sessions.mjs:248`): every tool result now
    dereferences its launching call; no test feeds a result whose call the transcript never
    recorded.
  - `R3-plan-listing-quoted-names-and-doc-drift` (`bin/lib/sessions.mjs:396`): a feature document
    whose name git prints quoted (non-ASCII) fails the name pattern and is dropped without a
    reason; and the design text differs from the code on a point the finding names.
  The reviewer's full claims are outside the repository, in
  `D:\js-harness-worktrees\sb-e-findings.txt`, for whoever writes T5b.
- 2026-10-06, 21:25 local: the first wake of `sessions --watch` on a real event. Launched by the
  parent at 21:14 from this worktree with `--interval 30 --timeout 3000`, it returned after 671 s
  with one line, `gate ended in D:/js-harness-worktrees/session-board (pid 30960)`, the gate of
  `24e1786`, and then the board. Not seen yet: a wake on another session's change (the Codex
  review session did not move in that time). The board gave this session 334k tokens of context
  against the default limit of 350k, which is why it is cut here with a compaction and T6 starts
  after it.
- Commits of the feature so far, all on `feat/session-board`, nothing pushed: `875c5d9` library,
  `5a79a0d` T3b, `6c92d93` command, `df1ad94` T3c and T3d, `24e1786` T5. Reviewed by gentle-ai
  up to `24e1786`. No Codex review yet: it needs Sebastián's word because it spends quota.

- 2026-10-06, 21:31 local: the second real wake of the watch, on a plan change. Relaunched at 21:26, it
  returned after 313 s with `plan odd/tasks/session-board.md in D:/js-harness-worktrees/session-board
  changed: 8/11 done (was 8/10); pending T5b, T6, T7 (was T6, T7); next step now starts ...`: the
  parent's own edit of this document. So a plan change is seen from disk without a commit, and a
  session that edits its own feature document wakes its own watch, because `--self` leaves out a
  session and the board does not know which session owns a worktree. An orchestrator owns no
  worktree, so this does not reach it; noted for T6.
- 2026-10-06, 21:50 local: a third wake of the watch, 587 s after its launch, of the same kind as
  the second: `plan odd/tasks/remote-control.md appeared in
  D:/js-harness-worktrees/remote-revival: 19/19 done, pending nothing`, the document of a
  documentation branch the main session had just cut. Still not seen: a wake on another
  session's change.
- 2026-10-06: T5b written by the delegated writer, parent spot check `node --test
  bin/lib/sessions.test.mjs bin/sessions.test.mjs bin/js-harness.test.mjs`: 213 pass, 0 fail.
  All five claims of the third review held; four needed code and one
  (`R3-tool-result-without-recorded-call`) only its test, which passed as written. With them,
  the context as a percentage, from Sebastián's reading of the desktop app: when the board said
  342k tokens the app showed him 71%, so the app measures against a window of about 480k and he
  thinks in that number. `--context-window` (default 480,000, one reading, this machine's) and
  `--context-limit` in tokens or `<N>%` (default `73%`, 350,400, where T5 had 350,000); the
  board prints `context 342k tokens (71%)`. Accepted as the writer left them: a percentage
  limit takes decimals; a limit in tokens may exceed the window and nothing compares the two; a
  context above the window prints as it is (104%); the limit's percentage is rounded for
  display. A session unreadable since the watch's first board and one new to the window are
  announced with the same line, because the code cannot tell them apart. Noticed and left: an
  end that names a follow-up's call, arrives before that follow-up's result and also closes an
  older open piece of the same id is not kept, so the resumed piece stays open; it errs toward
  "still running", the safe side for a board.
- 2026-10-06: the board gave this session 144k tokens (31%) a few replies after a compaction
  whose boundary said 21k. The likely reason, not checked: the boundary's `postTokens` counts
  the summary and not what the harness loads again with the next reply (instructions, memory,
  tool definitions). Either way the number right after a compaction reads low until the first
  reply; said here so nobody plans a stretch on it.

- 2026-10-06: `0989fc0` (T5b) committed, gate green. gentle-ai assessed `24e1786..0989fc0` as
  medium, 399 lines, not due (`under_budget`); it waits in the slice for T6's commit.
- 2026-10-06, 22:02 local: a false wake of the watch, during the gate of `0989fc0`: `gate ended in
  C:/Users/Oficina/AppData/Local/Temp/js-harness-pre-push-3duIqX (pid 32036)`. The test suite
  starts `bin/check.mjs` by absolute path inside temporary repositories
  (`bin/pre-push-hook.test.mjs`), so a real gate shows extra gates while it runs. Fixed in T6:
  the watch compares only gates whose folder is one of the board's worktrees. The wake before it,
  at 21:57, was the first with two real changes in one return: the gate of the documentation
  branch ending and this branch's gate starting.
- 2026-10-06: T6 written by a second delegated writer (a new one: the installer was ground the
  first had not read). Parent spot check `node --test bin/lib/manifest.test.mjs
  bin/lib/sessions.test.mjs bin/sessions.test.mjs bin/js-harness.test.mjs`: 301 pass, 0 fail.
  The writer also ran `scripts/e2e.mjs` (14 steps pass) after confirming in its source that
  every install step takes a temporary home; nothing was written under the real `~/.claude`,
  `~/.codex` or `~/.js-harness`.
  - The skill is `js-harness-orchestrator`, 63 lines, for both hosts, appended after the first
    two components; the engine did not change. One skill serves both roles (the orchestrator
    and a work session), chosen by its description.
  - The relief file's place was settled by the main session, told to Sebastián before the
    writer started; he has not answered on it, so it can still move:
    `<home>/.js-harness/relief/<project slug>.md`, written by the orchestrator, read by the
    board, in no manifest, undone by deleting that one file.
    `uninstall` therefore leaves it, and `.js-harness` with it.
  - Accepted as the writer left them: a gate started by a relative path names no folder and
    stays compared, because dropping it would silence a real gate; a look that cannot list the
    worktrees compares no gate; the board prints the last five non-blank lines of the relief
    file, with no flag for the number; an orchestrator's first relief line gives its session
    id, so the next one finds its last reply; the wording of the fixed opening prompt.
  - Gaps the writer found between this design and what the command can do, for T7 to judge
    with a real orchestrator:
    1. a watch never compares the session that runs it, so it does not return when the
       orchestrator's own context passes the limit, and a timed-out watch prints no board; the
       skill tells the orchestrator to read its own row on every board;
    2. the design says the board prints the previous orchestrator's last reply: it prints three
       lines of every last reply by default (`--tail`), marks no session as the orchestrator,
       and leaves out one older than the `--hours` window;
    3. "a gate is about to start while another runs": the watch reports it after it started;
    4. not established: whether Codex loads the skill, and whether Claude Code triggers it
       from its description.

- 2026-10-06: `1acbf06` (T6) committed, gate green. gentle-ai assessed `24e1786..1acbf06` (T5b
  and T6 together) as medium and due (`slice_budget_reached`); consent granted, one consolidated
  reviewer, approved, lineage `review-a2d969e2a2b702a5`, acknowledged. Three advisory findings,
  all SUGGESTION, all accepted as T6b:
  - `R3-watched-gates-follow-worktree-set` (`bin/lib/sessions.mjs:599-601`): which gates a watch
    compares is recomputed from each board's own worktree list, so a worktree removed or added
    between two looks reads as a gate ending or starting, where the design says a removed
    worktree wakes nobody.
  - `R3-relief-path-base-untested` (`bin/sessions.mjs:275`): a relative `--relief` ignores
    `--cwd`, and a `JS_HARNESS_HOME` set to the empty string passes the nullish check and puts
    the relief file under the folder the command runs in.
  - `R3-usage-error-test-names-collide` (`bin/sessions.test.mjs:166`): two generated test names
    are equal once cut to 60 characters.
  The reviewer's full claims are outside the repository, in
  `D:\js-harness-worktrees\sb-g-findings.txt`.
- 2026-10-06, found by the parent while preparing T7: the `js-harness` on this machine's PATH is
  not this checkout. `command -v js-harness` gives `C:\Users\Oficina\AppData\Local\pnpm\bin\js-harness`,
  a shim of a global pnpm install from the GitHub repository dated 2026-09-28, and `js-harness
  sessions` run through it answers `Unknown command: sessions`. The skill names its commands as
  bare `js-harness <cmd>`, like the first skill, so an orchestrator opened today could not run
  them. T7 therefore needs, in this order: this branch merged to `main`, that global install
  brought up to `main` (it is his machine's install, so on his word), `js-harness install`, and
  only then the orchestrator session. `js-harness status --global` here says `installed package
  version: 0.1.0`, `manifest version: (not installed)`.
- Commits of the feature, all on `feat/session-board`, nothing pushed: `875c5d9`, `5a79a0d`,
  `6c92d93`, `df1ad94`, `24e1786`, `0989fc0`, `1acbf06`. Reviewed by gentle-ai up to `1acbf06`.
  No Codex review yet; the pre-push hook refuses the branch until one covers the code commits or
  a skip is recorded, and that is Sebastián's decision because it spends quota. Asked on
  2026-10-06, not answered yet.

- 2026-10-06: T6b written by the same writer as T6, parent spot check `node --test
  bin/lib/sessions.test.mjs bin/sessions.test.mjs bin/js-harness.test.mjs`: 230 pass, 0 fail.
  All three claims held. A gate now starts or ends by its pid across all the gates of the two
  boards, and the worktrees only decide which gates are watched; one consequence, written in the
  design: a gate still running after its worktree was removed is no longer watched, so its end
  is not said. A relative `--relief` stays relative to the folder the command runs in, like
  `--claude-home` and `--tmp`, none of which resolves against `--cwd`; that is now pinned by a
  test instead of changed. An empty `JS_HARNESS_HOME` falls back to the OS home.
  - Found outside this feature, not touched: every other command reads the harness home as
    `env.JS_HARNESS_HOME ?? os.homedir()` (`bin/remote.mjs:88`, `bin/install.mjs:21` and `:63`,
    `bin/update.mjs:22` and `:92`, `bin/doctor.mjs:39`, `bin/check.mjs:518`, `bin/init.mjs:40`,
    `bin/tui.mjs:379`), so a variable set to the empty string makes the current folder the
    home, and `install` would then write its manifest and skills there. A follow-up of its own.

- 2026-10-06: `000b7c6` (T6b) committed, gate green. gentle-ai assessed `1acbf06..000b7c6` as medium
  and not due (`under_budget`): it is the last code commit, so it stays unreviewed by gentle-ai
  unless a later commit reaches the budget; a Codex review of the branch would cover it.
- 2026-10-06, 22:41 local: the gate of `000b7c6` left an untracked file in this worktree,
  `Microsoft/Windows/PowerShell/ModuleAnalysisCache`, which made `gentle-ai review assess` answer
  `unassessable` until it was deleted. It is the cache Windows PowerShell keeps under
  `%LOCALAPPDATA%`, written relative to the working folder, so some test of the suite starts
  PowerShell with no `LOCALAPPDATA`. Not reproduced: `node --test bin/sessions.test.mjs` did not
  create it, plain or with `HOME` and `USERPROFILE` pointed at an empty folder, and no other
  worktree has the folder, so which test does it is not known. Nothing in `bin` or `scripts`
  sets `PSModuleAnalysisCachePath` (`rg -n PSModuleAnalysisCachePath bin scripts`: no match);
  setting it in the gate's throwaway home (`checkSensor` in `bin/check.mjs`) would be the fix.
  A follow-up of the gate, not of this feature.

- 2026-10-06, 23:42 local: the Codex review, on Sebastián's word ("Corré la revisión de Codex sobre
  feat/session-board"). `node bin/js-harness.mjs codex-review --base origin/main` over
  `3915b88..000b7c6`, with this document's pending entries stashed for the run because the command
  refuses a tree with uncommitted tracked changes. It ended in 64 s with exit 1 and recorded
  nothing. Codex's own closing text: "No defects were confirmed, but the review is incomplete and
  this is not an approval. Required delegation tools are unavailable, and the fresh-context review
  fallback failed with Access denied (os error 5)." The command's verdict: "its successful
  commands showed 367 of 3356 changed lines of 3915b88..HEAD; nothing was recorded". So the
  branch has no Codex record and the pre-push hook still refuses it. The failure is the one the
  feature `codex-review-lean` exists for (Codex following the delegation rules of its home
  instead of reading the patch), not something in this branch. The output is outside the
  repository, in `D:\js-harness-worktrees\sb-codex-review.out`. Open, his decision: rerun, wait
  for the lean review to land, or record a skip with `--unavailable`.

- 2026-10-06, 23:47 local: the first wake of the watch on another session's change, 138 s after its
  launch: `session 77a27016 "Codex review lean integration" is waiting (was working)`, with its
  last entry 16 s before. That session had been waiting for more than three hours; a look one
  minute later showed it `working`, last entry 4 s before, so Sebastián had just written to it.
  The watch therefore said "waiting" for a session that was in the middle of being given work:
  the line is true of the look it compares, and it is the limit already written under "Watch,
  context and plans" (what ends a turn is not only a finished task). For T7 to judge whether an
  orchestrator should look once more before it speaks.

- 2026-10-07: `51a96f2` committed the three entries above, at the second try. During the first
  try the session of `codex-review-lean` started a gate of its own (pid 30180) while this
  commit's gate ran (pid 30936); neither was stopped, and this one ended red after about 19
  minutes with `commit rc=1`. Its cause was not captured, because `sb-commit-when-free.sh` keeps
  the last six lines of the output; the gate's 20-minute limit on a sensor is the likely one.
  `core.bare` stayed `false`. The helper waits until no gate runs and then starts, so it cannot
  see a gate that another session starts afterwards: "never two gates at once" is a rule two
  sessions cannot keep from outside the gate. A lock taken by the gate itself would keep it; a
  follow-up of the gate, not of this feature, and the board already shows both gates when it
  happens.
- 2026-10-07: the gate of `51a96f2` left `Microsoft/Windows/PowerShell/ModuleAnalysisCache` in
  this worktree again, the second time in two gates; deleted again. Still not traced to a test.
- 2026-10-07: one more kind of wake that asks nothing of anybody: the watch returned because an
  old session left the 12-hour window. True, and of no use to an orchestrator; for T7 to judge
  with the other gaps whether leaving the window should wake at all.
- 2026-10-07: the app's own figure for the window, read with the desktop app's usage tool from this
  session: 500,000 tokens, auto-compact at 93%. At the same moment (a minute apart) the app gave
  this session 114,878 tokens (23%) and the board 99k (21%). So the board's default window of
  480,000 is not the real window: it is the figure that made the board's percentage match the
  app's when Sebastián compared them (342k read as 71%, 350k as 73%), and it works because the
  board counts the usage of the last reply and so misses what entered the context after it,
  some 15k here. The default stays for now, because it keeps the percentage within a point or
  two of the app's; the honest form (the real window, and the count the app shows) is for
  whoever takes the item below.
- 2026-10-07: overlap with another branch, found on the board, not decided. The session of
  `codex-review-lean` recorded on its branch a roadmap item of its own, "Session signals"
  (`824ace8`, `docs/ROADMAP.md` Next item 6, asked by Sebastián on 2026-10-07, not started):
  whose turn it is in every reply, a notice when a session finishes saying which session to
  return to, and the context window watched with its percentage and a cut proposed before
  auto-compact. The same branch reworded the closing rule of `AGENTS.md` to four states
  (`5fe0510`, which leaves the file at 1,500 of 1,500 tokens). What this feature already holds
  of that item: the board prints each session's context with its percentage and the watch
  returns when one passes the limit; the watch returns when a session finishes a turn; the
  orchestrator skill says when it speaks. What it does not hold: anything inside a reply (whose
  turn it is), and a session's own context, which the watch never compares. So "Session
  signals" has two halves, one a reader of this board and one a hook or status line of the
  session itself, and whether it builds on this command is for that feature to settle with
  him. Mechanically: both branches add lines to `docs/ROADMAP.md` (this one the Session board
  phase and the `sessions` command row, that one 40 lines), so the second to merge resolves a
  conflict there, and that item's "77% of 500k" and this document's 480,000 are reconciled by
  the entry above.
- 2026-10-07: still open, asked several times and not answered: for this branch, wait for
  `codex-review-lean` to land and review with it, or record a skip with `--unavailable` and go
  on to the push. The parent's recommendation is to wait: the skip would push 3,356 changed
  lines that no Codex review read, and the lean review is being proven in its own session now.
- 2026-10-07, about 04:36 local: a false wake of a new kind. The watch returned with
  `plan odd/tasks/codex-review-lean.md appeared in D:/js-harness-worktrees/codex-review-lean-probe:
  4/15 done`, for a worktree and a plan the board had shown unchanged all night. So one look in
  between did not list that plan (the other session was running git in its worktrees at the
  time, the likely cause), and the next look read its return as an appearance. A plan that
  cannot be listed on one look is told apart from an absent one for a first look (T5b); the same
  is owed between two looks. A follow-up for T7's judgement, with the other wakes that ask
  nothing.
- 2026-10-07, 05:46 local: the entry above named the wrong cause, corrected here with its proof.
  The same line came back (`plan odd/tasks/codex-review-lean.md appeared in
  D:/js-harness-worktrees/codex-review-lean-probe`), again seconds after the other session
  started a lean Codex review, and this time the folder was looked at: `stat` gives it a birth
  time of 05:45:32, 50 seconds before the look. The other session makes that worktree anew for
  each of its review runs, so the plan did appear, and the watch said the truth both times;
  nothing failed to list. What stands is the judgement owed to T7: a worktree another session
  removes and makes again for each run is a true change that asks nothing of anybody, like the session
  that leaves the window. The follow-up named above (telling an unlistable plan from an absent
  one between two looks) has no observed case and is withdrawn.
- 2026-10-07, 06:07 local: two gates at once a second time, and this time by the parent's own
  doing. The commit of the entry above was started when the gate was free but the other session
  was a minute from committing; stopping the helper did not stop it (the app's stop ended the
  shell it tracks, while `git commit` and the gate under it lived on), and the other session's
  gate started three minutes into this one. The watch said it in so many words: `gate started in
  D:/js-harness-worktrees/codex-review-lean (pid 17200) while another runs in
  D:/js-harness-worktrees/session-board (pid 35856)`. This gate ended red after about 20 minutes
  with nothing committed, the same as the first collision, so two gates at once on this machine
  cost the first one its time limit; `core.bare` stayed `false`. The stray
  `Microsoft/Windows/PowerShell/ModuleAnalysisCache` appeared again, this time seen while the
  gate was still running. For T7: an orchestrator that reads "is about to commit" in a session's
  tail can keep the gates apart, which the helper alone cannot.
- 2026-10-07, 06:28 local, a gap of the board seen on this session: the commit helper stopped
  from the app at 05:47 is still listed 38 minutes later as work "with no recorded end"
  (`Bash bx6qwy42v ... launched 38m ago  file written 18m ago`). A piece of work stopped by hand
  leaves no end the board reads, so it counts as running for as long as the session lives. Here the
  watch itself already keeps this session at `background`; a session with no watch would be
  shown as `background` by such a leftover when it is in fact waiting. For T7, with the other
  gaps.
- 2026-10-07, 15:17 local, decided by Sebastián ("Esperá a codex-review-lean"): this branch waits.
  No skip is recorded and nothing is pushed; once the feature `codex-review-lean` is merged, the
  Codex review of this branch's code commits runs with the lean review, on his word because it
  spends quota. Until then the branch stays as it is and the parent only keeps the board. That
  feature stood at 10 of 15 tasks when he answered.
- 2026-10-07, a candidate for what the harness ships, not decided. Sebastián asked that every
  sub-agent run at high effort, and reminded that the work here is dogfooding: a rule we adopt
  belongs in the harness, not in one agent's memory. What was checked: Claude Code 2.1.292 added an
  `effort` parameter to the Agent tool (its changelog; the tool's listed schema in the desktop
  app does not show it), the desktop app here runs engine 2.1.293, and two probe sub-agents
  recorded the level asked for (`"effort":"low"` and `"effort":"high"` in
  `<session>/subagents/agent-<id>.meta.json`), while one launched without it inherited the
  session's level. For now the rule lives in the parent's memory only. Where it could ship: a
  line in the skill the installer writes for work sessions (`bin/lib/manifest.mjs`), since
  `AGENTS.md` has no room; or, checkable rather than prose, a line of the board per sub-agent
  with the effort its meta file records, so a writer at another level is seen. His to choose,
  after this branch's review.
- 2026-10-07, 16:06 local: the board counts a push's check as a gate. Pushing the documents
  branch `docs/remote-watchdog-revival` ran the pre-push hook (`check --push`, a few seconds: it
  only reads which code commits a Codex record covers), and the watch returned with `gate
  started in D:/js-harness-worktrees/remote-revival (pid 40224) while another runs in
  D:/js-harness-worktrees/codex-review-lean (pid 28240)`. Both are `bin/check.mjs`, which is all
  the board looks at, so a check of seconds reads as a second gate and the commit helper would
  wait on it. For T7: tell the two apart by the arguments of the process. The push opened
  pull request #40, which the board listed on its next look.
- 2026-10-07: pull request #40 was merged on Sebastián's word (`main` at `3e9427c`); its branch
  and its worktree `remote-revival` are gone.
- 2026-10-08: the feature this branch waits for grew a successor, so the wait is longer than
  the decision of 2026-10-07 assumed. `codex-review-lean` reached 15 of 15 tasks and its session
  reviewed its whole branch with Codex before any push: 28 parts and, by its own report, 3.36
  million input tokens for five findings, all five in the quarter of the range that is code
  (tests, half of the lines, gave none). On that balance Sebastián had the same session open
  `codex-review-cost` (six tasks), on a branch stacked on the first: the review fixed to one
  model and one session (done, `14cd8bf`), only code reviewed and never twice, and a `--plan`
  that shows parts, lines and estimated tokens before anything is spent. Neither branch is
  pushed, and the question about disabling the Codex plugin is still his to answer there.
  What it means here: this branch's range against `main` is 15 commits and 4,355 changed lines,
  about 1,330 of them code, 2,024 tests and 1,002 documents. Reviewed as the command stands on
  `main` after the first merge, Codex would read all of it; with the second feature merged it
  would read about a third. Which of the two merges to wait for is his choice when the first
  one lands, with the plan's numbers in front of him.
- 2026-10-08, the wakes of one stretch as the parent, for T7. About twenty-five returns of the
  watch in a day of one other session working; three led to something Sebastián had to do (two
  questions put to him in that session, and its compaction). The rest, by kind:
  - a gate of the other session starting or ending, and its plan changing: true, and useful
    only to keep this session's own commits out of the way. The plan wakes repeated the same
    line each time (`next step now starts "T1 to T15 are checked. What is left is
    Sebastián's:"`) because the change was below the first line the message quotes.
  - `is waiting: the 1 piece of work it had open ended (was background)`, twice, for a session
    that took its next turn by itself seconds later. Already a gap of T6; seen again.
  - `gate ended in an unknown worktree (pid 28632)`, for a gate whose start was never
    announced. By its timing it was the other session's `check --push` of a few seconds, the
    same confusion as on 2026-10-07 16:06, here without even a folder.
  - `session 431f4077 "Project init: T7 Codex review tracking" appeared (waiting)` and the same
    for `a857f62a "Project init: T4 sync"`, both with a last entry eight days old. Why they
    came into the 12-hour window was not established (a guess: opened in the desktop app).
    A session that appears with no new entry asks nothing.
  - `passed the context limit: 351k tokens (73%), limit 73% (350k)`, once. It was the earliest
    notice of a real need: that session went on to 432k on the board (about 90% of the app's
    real window of 500,000) before it was compacted, six gates later. The limit is measured
    against 480,000, as noted on 2026-10-07.
  Also seen: while this session's own transcript was past the limit, the watch said nothing
  about it, as recorded before.
- 2026-10-08, later: a third working session, and a second overlap with this feature. Sebastián
  opened "Subagent model routing evaluation" (worktree `subagent-model-routing`, branch
  `feat/subagent-model-routing`, from `main`): an eval of what delegating to a cheaper
  sub-agent model costs and saves, 54 sequential runs by its own plan, about four hours of
  machine. Two things touch this document. The candidate rule of 2026-10-07 (every sub-agent
  at high effort) is the same subject seen from the other side, so where that rule ships
  should be decided with that feature's result in hand, not before. And the constraint "no
  gate or test while trials run" now binds three sessions: the board shows a gate, but it
  shows an eval run only as a session's background work, with nothing that says "trials are
  running, keep your gate out". For T7: a line of the board for running trials, as there is
  one for gates. Seen at the same time: with two sessions waiting for him at once, the watch
  announced each as it stopped, and it was the parent's reading of both tails that said which
  to answer first.
- 2026-10-09: two gates at once on 2026-10-08, both red, and what the watch did about it. The
  session of "Subagent model routing evaluation" committed a roadmap plan from a second
  worktree of its own (`rule-hierarchy-plan`) while "Codex review lean integration" committed
  in `codex-review-lean`. The watch said it in so many words: `gate started in
  D:/js-harness-worktrees/codex-review-lean (pid 42956) while another runs in
  D:/js-harness-worktrees/rule-hierarchy-plan (pid 59944)`, then `gate ended` for each. Both
  ended red past the gate's time bound and neither commit was made; each session retried by
  itself and the retries ran in turn. Since then both carry a step of their own that waits
  for a free machine (on the board: `"Wait for a free machine, then commit T2, which runs the
  pre-commit gate alone"`), as this session does with a script kept outside the repository.
  Judged for T7: the wake was true, early and worded right, and it changed nothing, because
  the parent may not write to another session and Sebastián was away. The cost was two gates
  of about twenty minutes and two commits not made. Three sessions now hold three private
  copies of the same wait, and each is a look followed by a start, so two can still pass it
  in the same moment. A candidate for the harness and not for the board: the gate itself
  waits for, or refuses beside, another gate on the machine. Where it ships is his choice.
- 2026-10-09, gates in no worktree, seen the same day: `gate started in an unknown worktree
  (pid 55936)` and, again, `gate ended in an unknown worktree (pid 28632)`. Read at the time
  as a test of the other session running `bin/check.mjs` in a temporary repository, besides
  the `check --push` noted above; neither reading was established beyond the timing. Each
  returned the watch for a run of seconds. For T7: whether a gate outside every worktree of
  the repository should wake the parent at all, or only count as a gate running.
- 2026-10-09, the board after a night without the watch. On `main` (`ee74d18`, pull request
  #41) the roadmap now plans a rule hierarchy, and that plan names `skillContent` in
  `bin/lib/manifest.mjs` as where a protocol loaded on demand is written: the file where this
  branch adds 80 lines for the orchestrator skill. The two features meet there, and the one
  that merges second rebases. `codex-review-cost` stands at 5 of 6 with its measurement (T5)
  running on his word; neither stacked branch is pushed. Lines of the board that asked
  nothing, for the judgement of T7:
  - `c80fe895  unknown (the transcript holds no prompt, reply or tool entry)  (no title)`: a
    session line for a transcript with nothing in it.
  - two worktrees under `C:/Users/Oficina/orca/workspaces/js-harness`, made by another tool on
    2026-09-27 at `1d8b048`, with `0 not on origin/main`: listed like the rest.
  - `D:/js-harness-worktrees/t5-ed1fd0e  (detached)`, the other session's checkout of an old
    commit for its measurement, shown with the plans as that commit has them
    (`codex-review-cost.md ... 2/6  pending T2, T4, T5, T6`) under the live worktree's 5 of 6.
    Read alone it is open work that does not exist.
  - `context 523k tokens (109%)` for a session just before its compaction, above the 500,000
    the app reports as the real window. Not explained.
- 2026-10-09, two rules for the orchestrator that came from Sebastián getting lost. A closing
  state that still stands is said in one line: the parent repeated the two blocks of a cut on
  every wake, and he read two compactions asked of him ("como voy a hacer dos compact
  seguidos no entendi"). And a parent near its own context limit stops relaunching the watch
  and says so, since every wake is paid in context: at about 88% of the window it did, and
  saw nothing of the other sessions until it was compacted. The watch has no quieter mode
  for that case.
- 2026-10-09, the wait ended. `codex-review-lean` and `codex-review-cost` reached `main`
  together (pull requests #43 and #44, then #45 for their record; `main` at `d6cf6be`), so the
  choice kept on 2026-10-08 between the two merges never had to be made. Before them the rule
  hierarchy plan (#41) and the first part of the sub-agent routing evals (#42) had gone in.
  `main` was merged into this branch at `4a2a668`: clean, no file resolved by hand, gate
  green; neither `AGENTS.md` nor `bin/lib/manifest.mjs` conflicted. The gate marked that merge
  as due a gentle-ai review (`medium risk, 103 paths, 22650 lines: review due
  (slice_budget_reached)`). None was started: the merge holds no line written here, only work
  reviewed on its own branches, and with consent pre-granted nothing would stop a review of
  that size.
- 2026-10-09, the plan of the Codex review, read before anything is spent
  (`js-harness codex-review --base origin/main --plan`): `gpt-6.1-sol at high effort, 6 parts,
  3,365 changed lines in 9 files`, `Left out of the review: 2 Markdown documents, 1,100
  changed lines`, `Estimate: about 3,203,000 to 5,463,000 input tokens in all`. By part: 192
  lines in 4 files (160,000), `bin/lib/sessions.mjs` 868 (830,000), `bin/lib/sessions.test.mjs`
  1,153 (1,100,000), `bin/sessions.mjs` 367 (310,000), `bin/sessions.test.mjs` 766 (730,000),
  `scripts/e2e.mjs` 19 (73,000). Tests are 2,028 of the 3,365 lines. The lower figure is put
  to Sebastián as a floor; the command itself says the higher one is no ceiling.
- 2026-10-09, a trap in the hint, found by reading the plan first. After the merge of `main`,
  `check --push` still ends with `make the record with: js-harness codex-review --base
  875c5d9^`. That base is the `main` this branch left (`3915b88`), and with the merge commit
  in the range its plan is `41 parts, 21,461 changed lines in 62 files`, 19,653,000 to
  38,083,000 input tokens: everything `main` gained since, read again. The same hint, printed
  by the gate just before the merge commit existed, planned the right 6 parts. Nothing was
  spent: a run of more than 6 parts does not start without `--max-parts`, and the plan showed
  it. But the hint names a base that is wrong once a branch has merged its default branch in,
  and a session that trusted it and passed `--max-parts 41` would pay six times over. It
  belongs to the Codex review feature, not to this one; told to Sebastián.
- 2026-10-09: the session "Codex review lean integration" closed, with a notice for this one
  that matched the board (both features on `main`, `main` at `d6cf6be`). It leaves three
  things to Sebastián: the main checkout `D:\js-harness` still on the old `main`, whether the
  review stays at high effort, and its proposal for the Codex plugin.
- 2026-10-09, a direct channel between sessions, asked by Sebastián after he pasted that
  closing notice by hand ("hay forma que tu te puedas comunicar directamente las sesiones
  contigo y tu con las sesiones en tiempo real?"). The app has one: `ListAgents` lists the
  sessions of the machine and `SendMessage` reaches one by its title. Tested once, to the
  session that had closed: the message arrived there as a new turn, not held for his
  approval, and the answer came back the same way within a minute. Kept in the project memory
  as the rule for side sessions (their notices for the main go by message, with the pasted
  block as fallback, and a message between sessions is never his word). For T7 and the
  orchestrator skill: the skill's text assumes the parent only reads; with this channel a
  side session can tell the parent it waits or has closed, which is the wake the watch gets
  wrong most often, and the parent could warn of a running gate. Whether the parent may
  write to a working session at all is his to confirm; until then it does not.
- 2026-10-09: the Codex review was put to Sebastián with its plan, as a floor, and he gave
  the word after a long exchange on how sessions should work together ("entonces terminemos
  esto para poder continuar con todo"). What that exchange decided is in the roadmap, under
  "Session channel (planned)", with the order of the features that follow this one. The
  first run of the review started nothing and spent nothing: the command refuses while
  tracked files are uncommitted (`Tracked files have uncommitted changes, but the record
  claims the committed range base..HEAD`), and these notes were. They are committed first.
  Also seen on the board that hour: this conversation under two session ids with one title
  (`1cca9aae ... (this session)` and `729ed66b ... background`), after the app restarted it.
- 2026-10-09, the Codex review of the code, run as planned (`js-harness codex-review --base
  origin/main`, range `d6cf6be..764c9b0`): `All 6 parts passed: Codex used 2,439,619 input
  tokens (2,062,336 cached) and 15,045 output (7,733 reasoning) in 759 s over 53 requests`,
  recorded in `.git/js-harness/codex-reviews.jsonl`. That is under the floor put to
  Sebastián (3,203,000): the three parts that are test files cost about 250,000 each where
  the plan put 730,000 to 1,100,000, since Codex found nothing to follow in them. Two parts
  were judged incorrect, five findings, all in the two source files and none in the tests:
  - P1, `bin/lib/sessions.mjs`: a gate started as `js-harness check`, the form the hook of an
    initialized project uses, is not seen as a gate, because the matcher looks for
    `bin/check.mjs`. The board is blind to gates exactly where the harness is installed.
  - P2, `bin/lib/sessions.mjs`: a resumed sub-agent whose end arrives before the result of
    its `SendMessage` stays open, and the session stays in `background`.
  - P2, `bin/lib/sessions.mjs`: a gate that ends and another that takes its pid between two
    looks of the watch are read as one, so neither the end nor the start is announced.
  - P2, `bin/sessions.mjs`: the project root is taken from the git common directory, which
    is wrong in a submodule or with `--separate-git-dir`.
  - P2, `bin/sessions.mjs`: the Windows process listing is decoded as UTF-8 whatever the
    console code page, so a worktree path with a non-ASCII letter loses its gates.
  Each is reproduced by a test first and fixed, by one writer (route: delegated, two source
  files and their tests); the fix commit then gets its own gentle-ai and Codex review.
- 2026-10-09, the five fixed. All five were real: red first (three failures in the library's
  tests, five in the command's), then green: `node --test bin/lib/sessions.test.mjs` 112 of
  112 (re-run by the parent), `bin/sessions.test.mjs` 105 of 105, `bin/js-harness.test.mjs`
  22 of 22; 279 lines added and 34 removed in the four files. The change to how a resumed
  sub-agent's end is kept was compared on the project's real transcripts, old code against
  new: `37 transcripts, 810 pieces of work; facts differ in 0`. What stays open, by the
  writer's own account: a worktree linked to a `--separate-git-dir` checkout still resolves
  to the git directory (git 2.54 traces it no further); no POSIX process listing was looked
  at, so the `ps` form of a dispatcher gate is covered by the library test alone; the code
  page defect cannot show on this machine, whose own code page is already UTF-8, and was
  reproduced with a console switched to 850; a `--cwd` given to `check` is not read for the
  gate's worktree. The Design, Constraints and Limits above are corrected to match.
- 2026-10-09, the fix commit `f24dff6` and its reviews. Gate green. gentle-ai assessed it
  against `764c9b0`: `"risk": "medium"`, 368 lines, `"review_due": false`,
  `"review_due_reason": "under_budget"`, so it stays pending in the slice and no review was
  started. Codex reviewed it alone, the command starting by itself where the records end
  (`this run starts at 764c9b0`): 1 part, 313 changed lines, `the patch is correct
  (confidence 0.86)`, no defect, `521,351 input tokens (441,728 cached)` in 205 s. The push
  check then passes: `PASS  codex-review  9 code commits since origin/main, all covered by a
  Codex review record`. Codex spent on this branch in all: 2,960,970 input tokens, 2,504,064
  of them cached, in two runs.
- 2026-10-09, delivery settled again, by the main session as on 2026-10-06 and for the reason
  given then (the chain is not one of the three things he decides): one pull request, not
  two stacked slices. The merge of `main` sits at the tip and the review records name these
  commits by id, so cutting two slices now means rewriting the commits and paying for their
  reviews a second time, to split a change nobody reads by hand in two. He can still ask for
  two. Push, pull request and merge each wait for his word.
- 2026-10-09, after the merge (pull request #46, `main` at `2e50bbc`): an install nobody
  asked for, by the main session's mistake. Meaning to read the options of `install`, it ran
  `node bin/js-harness.mjs install --help` from this worktree. The command has no help of its
  own and takes no notice of the flag: it installed. Output: `installed js-harness 0.1.0 (4
  files) into C:\Users\Oficina`, `registered hook entry in C:\Users\Oficina\.claude\
  settings.json`, `registered hook entry in C:\Users\Oficina\.codex\hooks.json`. Written at
  15:09: the two skills (`js-harness`, `js-harness-orchestrator`) under `~/.claude/skills`
  and `~/.codex/skills`, and one `SessionStart` entry in each host that runs `js-harness
  doctor --hook`; all of it is in `~/.js-harness/manifest.json`, so `js-harness uninstall`
  removes exactly that. This was the step of T7 he had asked to be told of first; he was
  told right after instead, with the choice to keep it or undo it. Two findings for the
  product: a command that writes outside the repository must not act on `--help` or on a
  flag it does not know, and the command on this machine's PATH is an older copy (a pnpm
  global package with no `sessions`, `contract`, `init`, `remote` or `codex-review`), so the
  orchestrator skill now installed names a command that copy does not have until the global
  install is brought up to `main`.
- 2026-10-09: he chose to keep the install ("Sí, dejala"). So of T7 the install is done, by
  that road; what is left is the global command brought up to `main` (his word), the
  orchestrator session opened with the skill under the title `JH ORQ · js-harness`, and the
  stretch it supervises. He also asked that everything be proven before it reaches a project
  of his; the order is in the roadmap, under "Session channel (planned)".
- 2026-10-09: how the command on PATH is brought up to `main`, found by reading and with
  nothing written. `pnpm ls -g --depth 0` lists `js-harness@0.1.0`, and its folder under
  `%LOCALAPPDATA%\pnpm\global\v11` (dated 28 Sep) declares `"js-harness":
  "github:jsaristi/js-harness"`: it was installed from GitHub and is `main` of that day.
  `js-harness upgrade` cannot do it: `upgradeMain` (`bin/update.mjs`) asks the registry
  first, `npm view js-harness version` answers `404 Not Found` because the package is not
  published, and it stops with `could not determine the latest version to upgrade to`; its
  `--source` wants a folder of tarballs. So the road is the one that installed it, `pnpm add
  -g github:jsaristi/js-harness`, then `js-harness sync --global`; not run, it waits for his
  word. Two findings for the product, true as well in a project that only uses the harness:
  `upgrade` works only from a registry the package is not on, and the version reads `0.1.0`
  before and after, so `status` cannot tell an old copy from a current one.
- 2026-10-09, on his word ("Si, autorizo todo"): the command on PATH brought up to `main`.
  `pnpm add -g github:jsaristi/js-harness` installed commit `2e50bbc` (the new folder's
  `pnpm-lock.yaml`: `resolution: {commit: 2e50bbcb…}`) and the shim on PATH points at it,
  but pnpm ended with an error after doing so: `remove replaced global install directory …
  4b68-18d96946940745c8-0: El proceso no tiene acceso al archivo porque está siendo
  utilizado por otro proceso (os error 32)`. So the folder of the old copy (commit
  `36f2cee`) was left on disk, unused, with one `.pnpm-bin-backup-*` folder beside the
  shim; which process held it was not found. `js-harness sync --global` then printed
  `synced js-harness 0.1.0 (4 files) into C:\Users\Oficina` and the two `registered hook
  entry` lines; each host's file holds one `doctor --hook` entry, not two (`rg -c`). Proof
  that the new copy runs: `js-harness sessions` from `D:\js-harness` prints the board,
  where the old copy had no such command. To go back: `pnpm add -g
  github:jsaristi/js-harness#36f2cee`.
- 2026-10-09: pull request #47 (documents only) merged by the main session under the charter
  he approved that day; `main` at `9510a2a`. The relief file was started
  (`~/.js-harness/relief/D--js-harness.md`) with the handover for the new orchestrator.
- 2026-10-09: a session opened by another, tried because he said he would have the
  orchestrator create the sessions and hand them their prompt. The desktop app has no
  `start_session` among this session's tools, but a scheduled task with no schedule does it:
  `create_scheduled_task`, then `run_scheduled_task`, which answered `dispatched as session
  local_9edf9d4d…`. Seen: the session started in `D:\js-harness` at 17:45:11 with the task's
  title and answered the prompt; `set_session_title` renamed it to `JH 0 · prueba de
  apertura`; a `SendMessage` to its `local_` id was delivered; its answer came back as a
  message between sessions, by `mcp__ccd_session_mgmt__send_message`, because `SendMessage`
  refused it there ("cannot reach another session from a session nobody opened in this
  app"). Limits seen: the app wraps the prompt with "The user is not present to answer
  questions" and the session has no tool to ask him one; `notify_when_idle` is refused for
  it. A mistake of the main session on the way: it told him "you will see it in your list"
  without having checked, and he did not see it (his screenshot, 17:47). And an effect no
  description announced: deleting the task archived the session it had started, 95 seconds
  after it opened, so which of the two explains what he saw is not known. It was brought
  back with `unarchive_session` and he was asked to look again and to type in it. Not known
  yet: where the app lists such a session, whether he can type in it, its permission mode,
  whether it can commit. The task's file stays on disk
  (`~/.claude/scheduled-tasks/jh-open-session-test/SKILL.md`), as the app says it does.
- 2026-10-09, on his word: `D:\js-harness` brought up to `main` with `git pull --ff-only`,
  measured before and after: `d6cf6be` to `9510a2a`, 0 changed files both times, `remote
  status` reporting the same supervisor (`pid 12876, since 2026-10-09T04:40:05`) `running`
  and `connected` both times (it keeps the code it had loaded until it restarts), and
  `js-harness progress` from that folder going from `214/227` to `233/248`.
- 2026-10-09, T7's stretch starts. He opened the new orchestrator by pasting the skill's
  opening prompt with two added lines (its title, and where the change of role is written);
  it is session `0f993107`, titled `JH ORQ · js-harness`. It read the relief file, the
  board and the roadmap, appended to the relief file, told him what it understood, and
  asked the main session five questions by message, on his word that the new orchestrator
  asks the one before (roadmap, "A live handover"). His words were checked in its
  transcript before being written down. From this point the main session no longer
  orchestrates: it is the work session of this feature until T7's record is committed, and
  then it is archived. The proof has five criteria, written before the stretch began: (1)
  the orchestrator says in five lines what it understood and he sees whether it matches;
  (2) it proposes the next two sessions with the four entry-gate answers in writing; (3) it
  opens a session by itself, he sees it, can type in it, and it can commit in its own
  folder; (4) two sessions work at once with never two gates together and the notices
  arriving; (5) a session cuts at the end of a task and resumes with nothing reopened. Each
  is recorded here as seen, with its evidence, or as a defect.

## Next step
The wait of 2026-10-07 is over and `main` is merged in (`4a2a668`). When this feature closes,
the main session brings Sebastián back to the plan in the roadmap ("Session channel
(planned)" and the order under it) to settle with him how each part should work, before any
of it is built: he asked for that on 2026-10-09. The Codex review is done and its five
findings fixed and reviewed (entries of 2026-10-09); the push check passes. Each on
Sebastián's word, in this order: the push and one pull request to `main` (see the entry of
2026-10-09 on delivery), the merge, the global install brought up to
`main`, and `js-harness install`. T7 closes with an orchestrator session opened with the
skill's opening prompt and one real stretch supervised by it, recorded here with the gaps of
T6 and of the wakes above judged.
