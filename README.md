# js-harness

js-harness sets up Claude Code and Codex for AI-assisted development in a project, on top of a
stack it does not rebuild: gentle-ai owns the workflow, task documents and review, engram owns
memory, codegraph owns code structure. js-harness adds the thin layer those leave open: a short
`AGENTS.md`, a pre-commit gate that runs the project's checks, task contracts whose end is a set
of commands that exit 0, and a record of everything it writes, so that it can be removed exactly.

It is plain Node with no dependencies. It needs Node 22 or newer and git.

## Install

The repository is private: the install needs a GitHub account with access to it.

```sh
npm i -g github:jsaristi/js-harness
js-harness install
cd my-project
js-harness init
```

1. `npm i -g` puts the `js-harness` command on the path.
2. `js-harness install` writes its skills and hooks for Claude Code and Codex under your home,
   once per machine.
3. `js-harness init`, in a git repository, writes `harness.json`, `AGENTS.md` and the
   pre-commit gate of that project.
4. `js-harness doctor` tells you which tools of the stack are missing and the command that sets
   up each one.

## Remove

```sh
cd my-project
js-harness uninstall
js-harness uninstall --global
npm rm -g js-harness
```

`uninstall` removes from the project what `init` wrote, and `uninstall --global` removes from
the home what `install` wrote. Each one reads the manifest the install recorded, so it removes
only those files, and all of them. Measured on Windows with an empty home and an empty project:

- the project is left as it was: `git status` shows nothing;
- the home keeps the empty folders `.claude/` and `.codex/`, and an empty `AppData/Roaming/`;
- the home keeps no `.codegraph/`: `init` runs `codegraph init` with `DO_NOT_TRACK=1`, so codegraph
  writes no telemetry there (measured on codegraph 1.6.0).

## Commands

Every example below is the output of a real run. Paths are shortened: `~` is the home and
`my-project` is the project's folder. A line `…` marks output left out.

### js-harness check

Runs the project's gate: the budget of `AGENTS.md`, the task contracts, the declared sensors
(tests, lint, typecheck) and whether the pending change is due a review. The pre-commit hook
runs it, so a red check means the commit is not ready yet. With `JS_HARNESS_TEST_CONCURRENCY=<n>`
set, a tests sensor that is `node --test` (directly or as the `test` script) runs `n` test files
at a time, for a machine where node's default, one fewer than its processors, is too few: this
repository's CircleCI run of the merge queue's candidates sets 2.

When a `node --test` suite fails, the test files it names as failed run once more, alone. A
file that passes on that rerun does not block while it has a current entry in `docs/FLAKY.md`,
the quarantine ledger: one `### <test file>` entry with `- Owner:`, `- Expires: YYYY-MM-DD`
and `- Failure: <id in docs/FAILURES.md>`, written by hand and committed. A file that passes
on rerun with no entry still blocks, and the `rerun` row names the entry to add; one that
fails again blocks as before, and so does a failure in a file that cannot be rerun (no test
file, or a path with a character a shell reads): then nothing is rerun. A pass that rests on a
quarantine proves no tree for `"sameTree": "skip"`, so the next gate runs the tests again. The
`flaky` row fails a malformed ledger, an empty field included, and lists the expired entries,
which no longer count.

```console
$ js-harness check
PASS  budget  122 estimated tokens (budget 1500)
PASS  contracts  no contracts under odd/tasks
INFO  payload claude  122 estimated tokens per turn from files (tools and hook output not counted)
      global CLAUDE.md   not found  ~\.claude\CLAUDE.md
      project AGENTS.md        122  my-project\AGENTS.md
…
INFO  sensors  no sensors declared: add test, lint or typecheck scripts to package.json, or a "sensors" object to harness.json
```

`js-harness check --subagents` adds one INFO row, `subagents`, for today's sub-agents of this project, read from the Claude Code records: each writer launch is compared with `subagent-writer-model`, each explorer, reviewer or verifier with `subagent-reader-model`, and every launch's effort with `subagent-effort`. It says how many ran off those rules and fails nothing. It is opt-in: the commit gate runs plain `check`, which reads no record, and a day of records is about 231 MB.

### js-harness gate

Runs a heavy command under the machine's gate lock, one at a time with the gates of every
project, and records the run in the machine's gate log. `gate log` prints the last runs. A
command is stopped after 30 minutes (`--max <minutes>`), and while the branch of the folder it runs
in has an open pull request and commits a push would take now, any command but that push or a merge
is refused, with the push command printed.

```console
$ js-harness gate --no-wait -- node -e "console.log('a heavy run, one at a time')"
gate: 8.0 of 8 logical processors busy before the command (100%, 1 s sample)
…
a heavy run, one at a time
$ js-harness gate log --last 2
10-14 04:24:38  0 s  exit 0  load 8.0 of 8 (vmmem, MsMpEng, claude)  my-project
```

### js-harness init

Enables js-harness in a git repository and records what it wrote in a manifest of the clone.

```console
$ js-harness init
wrote harness.json
wrote AGENTS.md
wrote .git/hooks/pre-commit
ran codegraph init
manifest: my-project\.git\js-harness\manifest.json
```

### js-harness install

Writes the skills and the session hooks for Claude Code and Codex under the home, and records a
manifest of them.

```console
$ js-harness install
installed js-harness 0.1.0 (4 files) into ~
registered hook entry in ~\.claude\settings.json: js-harness doctor --hook (SessionStart, matcher startup|resume)
registered hook entry in ~\.codex\hooks.json: js-harness doctor --hook (SessionStart, matcher startup|resume)
registered hook entry in ~\.claude\settings.json: js-harness resume --hook (SessionStart, matcher compact)
registered hook entry in ~\.codex\hooks.json: js-harness resume --hook (SessionStart, matcher compact)
registered hook entry in ~\.claude\settings.json: js-harness resume --pause || exit 0 (PostToolUse)
```

### js-harness loop

Runs a session's long background loops (the orchestrator's heartbeat, its channel watch, a merge
keeper) under an owner record, so two sessions never stop each other's loops. `run` keeps the
command in the foreground of a background task, so its end still wakes the session, and records the
owner session, its own process and the command's by pid and creation time, the purpose and what
ends it. `stop` refuses a live loop another session owns unless `--take-over`, and exits 0 only when
a second look at the process table finds none of its processes left. `heartbeat` and
`channel-watch` are bodies for `run`.

```console
$ js-harness loop run heartbeat --purpose "wake the lead on a stall" --until "30 min with no gate or channel write" -- js-harness loop heartbeat
js-harness loop: heartbeat runs (pid 60332, command pid 65396), owned by 053e19d7: wake the lead on a stall; until 30 min with no gate or channel write. Stop it with js-harness loop stop heartbeat
$ js-harness loop status
heartbeat  alive  053e19d7  pid 60332  since 05:17  wake the lead on a stall — until 30 min with no gate or channel write
$ js-harness loop stop heartbeat        # from another session
js-harness loop: heartbeat is owned by 053e19d7, not by 220663e4 (pid 60332, since 05:17: wake the lead on a stall); nothing was stopped. Give --take-over only when that session is told and the loop is to be yours
$ js-harness loop stop heartbeat        # from its owner
js-harness loop: stopped heartbeat: 2 processes, none left (looked at 05:18)
```
### js-harness sync

Inside a project, moves it to the version its `harness.json` pins. With `--global`, or outside a
git repository, writes the machine install again.

```console
$ js-harness sync
up to date at 0.1.0
```

### js-harness uninstall

Inside a project, removes what `init` wrote; with `--global`, removes what `install` wrote.

```console
$ js-harness uninstall
removed harness.json
removed AGENTS.md
removed .git/hooks/pre-commit
removed .codegraph/
removed manifest my-project\.git\js-harness\manifest.json
$ js-harness uninstall --global
removed ~\.claude\skills\js-harness\SKILL.md
removed ~\.codex\skills\js-harness\SKILL.md
…
removed hook entry from ~\.claude\settings.json
```

### js-harness status

Inside a project, shows its pinned version, the running version and whether this clone is set
up. With `--global`, shows the machine's installed version and its manifest.

```console
$ js-harness status
project: my-project
pinned version: 0.1.0
running version: 0.1.0
this clone: set up (manifest: my-project\.git\js-harness\manifest.json)
pin and running version: match
```

### js-harness update

Says whether a newer release exists. No release is tagged before 1.0.0, so for now it says that
and how to get the newest copy.

```console
$ js-harness update
no release of js-harness is tagged yet (versions are tagged from 1.0.0); to get the newest copy: npm i -g github:jsaristi/js-harness, or the same with the package manager that installed it (installed: 0.1.0)
```

### js-harness upgrade

Installs the newer release of `--source <dir>`, a folder of `npm pack` tarballs, then syncs.
With no source it installs nothing and exits 1; no package registry is ever asked.

```console
$ js-harness upgrade
nothing was installed: no release of js-harness is tagged yet (versions are tagged from 1.0.0); to get the newest copy: npm i -g github:jsaristi/js-harness, or the same with the package manager that installed it
```

### js-harness doctor

Reports each tool of the stack: its version, whether Claude Code and Codex are configured for
it, and the command that fixes what is missing. `--offline` skips the check for newer versions.

```console
$ js-harness doctor --offline
tool            version   claude    codex     project   up to date
gentle-ai       4.1.1     missing   missing   n/a       unknown
engram          3.4.0     missing   missing   n/a       unknown
codegraph       1.6.0     missing   missing   ok        unknown
…
Fix:
  gentle-ai (claude): gentle-ai install
  codegraph (claude): claude mcp add -s user codegraph -- codegraph serve --mcp
…
```

### js-harness progress

Shows the roadmap's phases and the features, counted from the checkboxes of `docs/ROADMAP.md`
and `odd/tasks/*.md`.

```console
$ js-harness progress
Roadmap  docs/ROADMAP.md  61/62  98%
  [x] F0 Safeguard and baseline                                                                 3/3  100%
  [x] F1 Skeleton                                                                               3/3  100%
…
  [ ] F2 Context diet                                                                           3/4  75%
      - Block exclusion via gentle-ai #4036, if it ships
…
Features  295/349  85%
```

### js-harness contract

Task contracts: `template` prints the skeleton a feature document opens with, `check`
validates every contract, `run` runs a contract's done-when commands, and `goal` prints the
`/goal` condition that runs them. Each task names its kind of work, `(kind: design | build |
verify | docs)`; `modes` prints the effort and sub-agent models each open task calls for, from
the project's rules, and `goal` prints the same lines on stderr.

```console
$ js-harness contract template
## Goal
<one sentence: the outcome, not the steps>

## Why
<the reason — lets the model make judgment calls you didn't foresee>

## Done when
- `<command>` exits 0            # executable, never prose
…
$ js-harness contract check
PASS  odd/tasks/codex-parity.md
PASS  odd/tasks/codex-review-cost.md
…
```

### js-harness failures

Reads the register of what went wrong, `docs/FAILURES.md`: the totals, the count by class and
one line per failure, the most seen first. `failures <id>` prints one entry; `failures check`
exits 1 when the register is malformed. It only reads: the register is written by hand.

```console
$ js-harness failures
docs/FAILURES.md  69 failures, 178 sightings, 39 seen more than once, 24 not settled, 0 controls replaced

By class
  wrong-information  8 failures   30 sightings
…
By failure, the most seen first
  10  stray-folder-untracked        machine            repeated     first seen 2026-10-07
   8  gate-at-its-bound             machine            repeated     first seen 2026-10-10
…
```

### js-harness rules

Shows the declared rules of the harness, each with its value or the file that holds it.
`rules <id>` prints one rule with its source and the files that read it; `rules check` exits 1
when a declaration, its source, a reader or `docs/RULES.md` is wrong; `rules render` writes
`docs/RULES.md`.

```console
$ js-harness rules codex-review-floor
{
  "id": "codex-review-floor",
  "subject": "the most input tokens a Codex review may cost however small its commit",
  "owner": "sebastian",
  "scope": "repository",
  "since": "2026-10-11",
  "value": 300000,
  "unit": "input tokens a review"
}
Read by: bin/lib/codex-review-allowance.mjs
…
$ js-harness rules check
PASS  rules  18 rules, hash 7963ae6d5597
```

### js-harness codex-review

Runs the Codex review of `<base>..HEAD` and records it. `--plan` prints what the review would
read and cost, and starts nothing; `--unavailable <reason>` records a skip.

```console
$ js-harness codex-review --base b36ab7b^1 --plan --again
Plan of the Codex review of b42a30b..c670cff: gpt-6.1-sol at medium effort, 2 parts, 727 changed lines in 7 files.
  part 1 of 2: 4 files, 356 changed lines, about 230,000 input tokens
  part 2 of 2: 3 files, 371 changed lines, about 240,000 input tokens
Left out of the review: 5 Markdown documents, 818 changed lines.
…
Allowance of this plan: 872,400 input tokens, the larger of 300,000 a review and 1,200 a changed line, for the 727 changed lines it reads. Its estimate, about 470,000, is inside it. …
```

### js-harness merge-queue

Builds the candidate main would be: origin/main with each ready pull request merged into it in
order of number, and names each one it leaves out and why. Ready means the pull request is open,
not a draft, mergeable, on main and with a gentle-ai line in its body, has a Codex review record for
every code commit, and merges into the candidate so far with no conflict. `--dry-run` prints it and pushes nothing. `--land` tests it, the whole suite on
this machine under the gate lock and then on CircleCI on a `queue/*` branch, and when both are
green moves main to it by fast-forward, leased on the main it was built from (odd/tasks/merge-queue.md).
That CircleCI run is the repository's only CI run: no GitHub workflow runs for a pull request.
A candidate red on this machine is bisected: the pull request that turns it red is left out and
named, and the rest is landed. The pre-push hook refuses every other push of main from a clone; a
merge made on GitHub's side does not pass through it.

```console
$ js-harness merge-queue --dry-run
PR 144 is left out: PR 144 is not mergeable (CONFLICTING).
Candidate: main eb6abf7 with 2 pull requests merged in order: PR 137 (docs/gate-turn-guards-followups), PR 146 (fix/codegraph-home-files).
Dry run: nothing was tested or pushed, and the candidate was removed.
```

### js-harness functions

Shows each function the project can turn off and on in `harness.json` under `"functions"`: its
value here and why.

```console
$ js-harness functions
codeMap         off        auto: no file of the project is a program
languageServer  off        auto: no file of the project is TypeScript
codexReview     off        auto: no file of the project is a program
```

### js-harness remote

Keeps Claude Code's remote-control server running for this git repository, so the Claude app
can start sessions here: `start`, `stop` and `status`. `start --at-login` also starts it at
every Windows login.

```console
$ js-harness remote status
remote: not running
name: project
project: my-project
log: ~\.js-harness\remote\project-fd15a34ab7bf.log
login launcher: off
watchdog task: off
```

### js-harness sessions

The board of the project's recent Claude Code sessions: each one's state, context size and
last reply, the worktrees and their feature plans, the running gates and the open pull
requests. It only reads. `--watch` waits until the board changes in a way that needs a
decision; `--address <role>` prints the title of the session that holds a role; `--quote
<transcript> <line>` prints one message the user sent; `--measures` prints, for each compaction
the host made, whether the session was told the pause, committed its feature document (the
orchestrator may write a line in its relief file instead) and announced the compaction, and how
many compactions miss one of those facts; then the reliefs of the record (each `relieved` notice, judged by the context its relieved session was at: filled at the pause or another reason) and the Log lines that name a reopening, as candidates for the lead. Under each roster row's
mode line, a line says how its session was opened, where the desktop app keeps it and its effort,
and marks a session outside his sidebar (in Routines, or not in the app) and an effort below `high`.

```console
$ js-harness sessions --address orchestrator
js-harness sessions: no sessions folder for my-project: …
```

### js-harness unseen

What the desktop app opened for this project out of his sidebar: an enabled scheduled task whose
folder is this project (the app runs it in Routines), and a session a schedule opened that sits in
Routines and is not archived. Each one to clear is named as `FAIL`, and the command exits 1. A
disabled task, a leftover scheduled-task folder, and a session a command opened (`js-harness remote`)
are `INFO`. It only reads; `doctor` reports the same count as its `unseen` row. `--records-only` reads
the app's session records and no transcript, which is the fast path `doctor` uses at each session start.

```console
$ js-harness unseen
FAIL  enabled scheduled task jh-wake runs in D:\my-project: the app opens its sessions in Routines
INFO  disabled scheduled task jh-old runs in D:\my-project: it opens no session
unseen: 1 to clear
```

### js-harness memory

Keeps the project's Claude Code memory small and true. The index of that memory is read on every
turn of every session, and in this repository it grew from 233 to 10,917 characters in 18 days with
nothing watching it. `memory status` says whether a hygiene pass is due and why: no verified pass
yet, the index over 4,000 bytes, a line over the host's 150 characters, a link to no file or a note
with no line, a rule note written since the last pass, or 7 days since it with notes written since.
It reads the main checkout's memory folder, so a worktree sees the same notes, and exits 1 when a
pass is due. `memory plan`, `memory verify` and `memory undo` make a pass safe: a lock, a snapshot
of the folder and a journal under `~/.js-harness/memory-hygiene/`, a check that no quotation of the
user is lost and no file another session wrote is overwritten, and an undo that puts back only what
nobody wrote since. The steps of a pass are in the installed `js-harness` skill, "Memory hygiene".

```console
$ js-harness memory status
memory  ~/.claude/projects/D--js-harness/memory  index 10917 B (budget 4000)  41 lines  42 notes
memory hygiene: due
  no-pass  no verified pass recorded yet
  index-bytes  the index is 10917 B, over 4000
  line-chars  36 lines over 150 characters: 3, 4, 5, 7, ...
  orphan  questions-through-the-question-tool.md
```

### js-harness subagents

Counts a day's sub-agents of the project by role (writer, explorer, reviewer, verifier), model
and effort, with their tokens and the share of the day's tokens they took, so that what to
measure next and how many to launch come from a count. It reads the Claude Code records of the
main checkout and each worktree and keeps no text of any message; Codex is not counted.

```console
$ js-harness subagents --day 2026-10-14
Sub-agents, local day 2026-10-14 (UTC-05:00), 2 record folders; Claude records only, Codex not counted
role      model             effort asked/ran  launches  input  cache write  cache read   output
explorer  claude-opus-5-5   high/high               23    932      2197153    37928674   274820
writer    claude-haiku-5-5  high/high               11    646      1626090    46702162   397934
…
total                                               54   2502      6420288   132472395  1050507
Their share of the day's tokens: input 19%, cache write 29%, cache read 8%, output 23%
Read as other: 5; effort or model inherited from the session: 14; call not found: 1; carried over from the day before: 0
Read in 8.2 s
```

### js-harness audit

Counts, per session of a day, the two claims a transcript can check by itself, and prints each
wrong one at its transcript and line: the hour a message to another session stamps in its
opening, against the hour the entry was sent (more than a minute apart is wrong), and the share
of its context a session states of itself, against the share its own reply records (more than 2
points apart is wrong). The share is of the window the session's own last `get_usage` read
reports, because sessions run on windows of different sizes. It reads the Claude Code records of
the main checkout and each worktree and prints no text of any message.

```console
$ js-harness audit
Audit, local day 2026-10-15 (UTC-05:00), 4 record folders: the hours messages stamp and the context shares sessions state, each against its transcript
session   title                                    messages  stamped  wrong hour  shares  wrong share
2ec5f55e  JH 15 · auditoría de honestidad                 7        1           0       8            4
d3ecd893  JH 8 · turno y corte temprano del gate         11        3           0      10            2
f7f03a7e  JH 10 · comprobación en GitHub                 29        0           0       4            0
total                                                   367        7           0      84           40
Wrong shares, more than 2 points from the share the reply records (transcript:line):
  2ec5f55e-e2da-493b-8819-43b3c57394be:4725  stated 50%, recorded 64%
  d3ecd893-952c-4591-a356-73f605c9fc90:15014  stated 36%, recorded 39%
Read in 13.7 s
```

### js-harness notify

Appends one notice to the project's channel record under the home, with the time, the sender's
session, worktree and branch, then prints the address of the role it is for. It sends no
message itself.

```console
$ js-harness notify --to orchestrator --kind note "JH 1: the README's example of a notice"
js-harness notify: recorded note for the orchestrator at 2026-10-14T09:24:29.740Z from session 9265156a in ~\.js-harness\channel\…
address of the orchestrator: no single one now (sessions --address exit 1): …
```

### js-harness wake

A boot kills every background command of every session, and the transcripts do not say so: a
wait the boot killed still reads as running. After a boot, `wake` lists the sessions of the
project that were open before it (an entry in the 12 hours before), each with the command that
prints its stored opening and the `js-harness wait` calls the boot killed. With `--notify` it
leaves each session whose title names a role a note, which the inbox hook tells it on its next
tool call: its waits are gone, read the opening, re-arm only its declared waits. The
orchestrator gets the list of sessions to wake with `send_message`, since no command can put a
prompt into an idle session. A second run after the same boot records nothing.

```console
$ js-harness wake --notify
The machine booted at 2026-10-15T04:52:10.000Z. 2 sessions were open before it (an entry in the 12 hours before).

JH 5 · canal entre sesiones  (last entry 2026-10-15T04:51:00.000Z, e5376fe9-d1cc-4288-b9e9-cf533ba35a5a)
  opening: js-harness sessions --opening 'JH 5 · canal entre sesiones'
  waits the boot killed:
    js-harness wait --pr 162 --for 60
  tell it: The machine booted at 2026-10-15T04:52:10.000Z: the background waits and tasks of this session are gone. Read your opening: js-harness sessions --opening 'JH 5 · canal entre sesiones'. Then re-arm only these declared waits: 1) js-harness wait --pr 162 --for 60

JH ORQ · js-harness  (last entry 2026-10-15T04:50:00.000Z, c47efdf7-a307-47ef-8644-cf01d1bc377c)
  opening: none stored
  waits the boot killed: none
  tell it: The machine booted at 2026-10-15T04:52:10.000Z: the background waits and tasks of this session are gone. It has no stored opening: resume from its feature document. No declared wait was running: re-arm none.

3 notes recorded in C:\Users\you\.js-harness\channel\D--js-harness.jsonl.
```

`js-harness wake --at-login` writes a file in the Windows Startup folder that runs
`wake --notify` for this project at each login. It records the file in the machine manifest,
so `uninstall` removes it; `--at-login --remove` removes it now. A file at that path that
js-harness did not write, or one changed since, is kept.

```console
$ js-harness wake --at-login
wake at login: on (wrote C:\Users\you\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\js-harness-wake-js-harness-0f3a5c2d9e1b.cmd); it runs at each login, and js-harness wake --at-login --remove removes it.
```

### js-harness wait

Waits in the background for one condition and ends when it holds: a pull request merged, a
commit or a file content on `origin/main`, or a notice addressed to a session in the channel
record. It says at start what it waits for and what ends it, so a session keeps working instead
of ending its turn to wait.

```console
$ js-harness wait --pr 133 --for 1 --every 5
js-harness wait: waits for the merge of pull request 133; ends when it holds, or after 1 minutes; stop it with TaskStop when it is no longer needed
js-harness wait: the merge of pull request 133 holds (14:12)
```

### js-harness resume

The hook that runs after a compaction, which `install` registers for Claude Code and Codex.
`resume --hook` reads the hook's input and prints the session's title, its opening, the feature
document it works on and what to read there, so nobody pastes a resume prompt. It writes
nothing and always exits 0. `resume --pause` is the hook of the context pause, and of the channel's inbox: after a tool call it says once each notice addressed to the session that it was not told yet.

```console
$ js-harness resume --hook < hook-input.json
js-harness resume: this session was just compacted. What follows is read from files; the summary of the compaction is not the record.
Session: title not known (the host gave the hook none and no session id a transcript could be found by)
…
Find there the document of the feature this session was working on, read its "Next step", and "State for a resume" if it has one, and trust them over the summary. Then repeat to the user any question that is still open.
```

### js-harness guard

The hook that checks a tool call before it runs. `install` registers it for Claude Code as a
`PreToolUse` hook, on the sub-agent launch, on the two ways of sending a message to another
session, on `Bash`, and on `Write` and `Edit`. `guard --hook` reads the call on standard input
and refuses six things: a sub-agent launched on a model the project's rules do not give; a
message whose stamped hour is more than a minute off the clock; a shell command with backticks
inside double quotes, which bash runs as commands; a `node --test` of several files outside a
gate turn while another gate holds the machine's lock; and a `Write` or `Edit` that puts a line
over 150 characters, the host's own limit, in a project's memory index
(`~/.claude/projects/<project>/memory/MEMORY.md`, or under `CLAUDE_CONFIG_DIR` when that is set),
which every session reads on every turn; and a `Write` or `Edit` of a Markdown file that brings a
line stamping today's date with an hour more than a minute ahead of the clock, where the line
opens with the date or the date follows "written" (`- 2026-10-14 14:50 — T3 done.` written at
14:44). A document also records earlier events, so an hour behind the clock passes; an `Edit` is
judged by the lines of the file it leaves that were not already there. A
refusal is printed as the hook's deny, with the reason and the right value; any other call runs
as it was. A `Write` or `Edit` of any other file loads nothing but the memory index check, and of a
Markdown file the hour check besides. An `Edit` is
judged by the file it leaves, read from disk, so a short clause that makes a line long counts; a
line that was already long there is left to the memory hygiene pass rather than blocking the edit.

It always exits 0 and writes nothing. A check that cannot read what it checks lets the call run.
The model rules are the project's `subagent-writer-model` and `subagent-reader-model`. A project
that installs the harness has them off by default, so the model check applies only where the
project sets them.

```console
$ js-harness guard --hook < send.json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"js-harness guard: this message stamps 03:10, and the clock says 15:01. Stamp 15:01, or no hour: an hour in a message is read from the clock in the same step, or left out."}}
```

`install` also registers `guard --stop` for Claude Code, as a `Stop` hook: the share check. A
reply that states the session's own context share ("Contexto: 40 %") more than 2 points from the
share its transcript records is turned back with the hooks contract's `decision: "block"`, so the
session corrects it in one line from `get_usage`. The share is of the window the session's last
`get_usage` read reports, else the default 500,000 tokens; which clauses count as the session's
own share is `js-harness audit`'s reading. A reply is already shown when a `Stop` hook runs, so
the check cannot hold it back, only make the session correct it before the turn ends. It never
turns back a stop it already turned back (`stop_hook_active`), and always exits 0. When the host
sends the reply's text (`last_assistant_message`) and it names no share, the transcript is not
read; a host that sends no text has the transcript's last reply read instead.

```console
$ js-harness guard --stop < stop.json
{"decision":"block","reason":"js-harness guard: this reply states your context at 40%, and your transcript records 60% of a 500k window (the window of your last get_usage read, else the default). The reply is already sent: correct it in one line with the share mcp__ccd_session_mgmt__get_usage reads now, and say no share you have not just read."}
```
