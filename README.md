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
runs it, so a red check means the commit is not ready yet.

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
`/goal` condition that runs them.

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

### js-harness merge-ready

Says whether a pull request may be merged on its GitHub run, and merges nothing: open, not a
draft, mergeable, on main, a gentle-ai line in its body, the latest run of its head green, and
the base that run tested (from its checkout log) is today's main, or behind it only by documents
with a clean merge. Exit 0 ready, 3 stale, 4 run missing, pending or red, 1 otherwise. A stale
pull request gets a fresh run by closing and reopening it, once GitHub has recomputed its merge
against main, which it says.

```console
$ js-harness merge-ready 137
PR 137: run 38632863631 tested base 028d658; main c0364f8 has moved since by 6 paths that are not documents (bin/check.mjs, bin/check.test.mjs, evals/arms.mjs, ...): stale.
PR 137: refs/pull/137/merge still has 028d658 as its first parent, not main c0364f8: wait before reopening.
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
<transcript> <line>` prints one message the user sent.

```console
$ js-harness sessions --address orchestrator
js-harness sessions: no sessions folder for my-project: …
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
session and on `Bash`. `guard --hook` reads the call on standard input and refuses four things:
a sub-agent launched on a model the project's rules do not give; a message whose stamped hour is
more than a minute off the clock; a shell command with backticks inside double quotes, which
bash runs as commands; and a `node --test` of several files outside a gate turn while another
gate holds the machine's lock. A refusal is printed as the hook's deny, with the reason and the
right value; any other call runs as it was.

It always exits 0 and writes nothing. A check that cannot read what it checks lets the call run.
The model rules are the project's `subagent-writer-model` and `subagent-reader-model`. A project
that installs the harness has them off by default, so the model check applies only where the
project sets them.

```console
$ js-harness guard --hook < send.json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"js-harness guard: this message stamps 03:10, and the clock says 15:01. Stamp 15:01, or no hour: an hour in a message is read from the clock in the same step, or left out."}}
```
