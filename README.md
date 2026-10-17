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
3. `js-harness init`, in a git repository, writes `harness.json`, `AGENTS.md`, an empty failures
   register (`docs/FAILURES.md`) and the pre-commit gate of that project.
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
`my-project` is the project's folder. A line `…` marks output left out; output that grows with
each feature, such as install's hook lines or check's rows, is shown in part and cut with it.

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

In a project that holds `.github/workflows/gate.yml`, as this repository does, every commit's gate
runs its tests on GitHub's machines first, whether or not the machine's gate lock is free: it pushes
the tree being committed to a `gate/<sha>` branch of the remote (`--remote`, `origin` when not
given), reads that workflow's run in the GitHub repository the remote names with `gh`, deletes the
branch, and lets the commit through only on green. The `tests` row then names the run. A gate that
gets no answer from GitHub (a remote not on GitHub, no push, `gh` not signed in, no run within 3
minutes, a run cancelled or timed out, or one not done within `rule:ci-gate-bound` of the push,
which is then cancelled) runs here under the lock, after one `check:` line on stderr that says why. `JS_HARNESS_GATE_CI=0` keeps every gate here. The runner is Linux, so a test that runs only
on Windows is left to the merge queue's run on this machine.

The `fixed load` row says how many tokens a Claude session of the project sends at its first turn,
before any work: the median of the latest five sessions, read from their transcripts under
`~/.claude/projects` (and, from a worktree, its main checkout's). It never fails a commit, and warns
over 100,000 tokens.

```console
$ js-harness check
PASS  budget  639 estimated tokens (budget 1500)
PASS  contracts  no contracts under odd/tasks
INFO  payload claude  639 estimated tokens per turn from files (tools and hook output not counted)
      global CLAUDE.md   not found  ~\.claude\CLAUDE.md
      project AGENTS.md        639  my-project\AGENTS.md
…
INFO  fixed load  95570 tokens at the first turn, median of the latest 5 sessions (budget 100000)
…
INFO  sensors  no sensors declared: add test, lint or typecheck scripts to package.json, or a "sensors" object to harness.json
```

`js-harness check --subagents` adds one INFO row, `subagents`, for today's sub-agents of this project, read from the Claude Code records: each writer launch is compared with `subagent-writer-model`, each explorer, reviewer or verifier with `subagent-reader-model`, and every launch's effort with `subagent-effort`. It says how many ran off those rules and fails nothing. It is opt-in: the commit gate runs plain `check`, which reads no record, and a day of records is about 231 MB.

### js-harness gate

Runs a heavy command under the machine's gate lock, one at a time with the gates of every
project, and records the run in the machine's gate log. `gate log` prints the last runs. A
command is stopped after 30 minutes (`--max <minutes>`), and while the branch of the folder it runs
in has an open pull request and commits a push would take now, any command but that push or a merge
is refused, with the push command printed. `--ready <command>` declares a quick check, such as
`git diff --quiet`, run before the wait and again as the turn comes after one: when it fails, nothing
runs (exit 75), so a command that would refuse at once does not wait for a turn first.

```console
$ js-harness gate --no-wait -- node -e "console.log('a heavy run, one at a time')"
gate: 8.0 of 8 logical processors busy before the command (100%, 1 s sample)
…
a heavy run, one at a time
$ js-harness gate log --last 2
10-14 04:24:38  0 s  exit 0  load 8.0 of 8 (vmmem, MsMpEng, claude)  my-project
```

A ticket puts one session's next whole check before every gate that waits: the orchestrator issues it
with `gate first --session <id> --reason <why>`, or its own batch run carries one with `check --first
<reason>`. Two are open at most, for an hour at most; `js-harness sessions` prints them with their
issuer and flags one the orchestrator did not issue, and the gate log keeps each issue and claim.

### js-harness init

Enables js-harness in a git repository and records what it wrote in a manifest of the clone.

```console
$ js-harness init
wrote harness.json
wrote AGENTS.md
wrote docs/FAILURES.md
wrote .git/hooks/pre-commit
ran codegraph init
manifest: my-project\.git\js-harness\manifest.json
```

### js-harness install

Writes the skills and the session hooks for Claude Code and Codex under the home, and records a
manifest of them.

```console
$ js-harness install
installed js-harness 0.1.0 (6 files) into ~
registered hook entry in ~\.claude\settings.json: js-harness doctor --hook (SessionStart, matcher startup|resume)
registered hook entry in ~\.codex\hooks.json: js-harness doctor --hook (SessionStart, matcher startup|resume)
…
```

### js-harness loop

Runs a session's long background loops (the orchestrator's heartbeat, its channel watch, a merge
keeper) under an owner record, so two sessions never stop each other's loops. `run` keeps the
command in the foreground of a background task, so its end still wakes the session, and records the
owner session, its own process and the command's by pid and creation time, the purpose and what
ends it. `stop` refuses a live loop another session owns unless `--take-over`, and exits 0 only when
a second look at the process table finds none of its processes left. `heartbeat` and
`channel-watch` are bodies for `run`.

`heartbeat` ends on a quiet machine (no gate-log or channel write for `--quiet` minutes) and on a
stalled work session: one the orchestrator handed work to, by a notice to its number or its
opening, that has not given it back with a `waiting`, `closed` or `relieved` notice and has made no
commit of its own, sent no notice and run no gate for `--stall` minutes (the rule `session-stall`,
an hour). It prints a `STALLED:` line naming the session, since when it is quiet and what it holds,
and says it again each time that quiet doubles. `js-harness sessions` lists the same sessions in
its `Stalled` section, and its `--watch` says each one as it crosses.

```console
$ js-harness loop heartbeat
js-harness loop heartbeat: ends when 30 minutes pass with no write to the gate log (…) or the channel (…), or a work session holds handed work with no commit, notice or gate for 60 minutes, or after 10 hours
STALLED: JH 19 · skill del orquestador (T8) — no commit, notice or gate since 11:49, holding a note from JH ORQ · js-harness (350k) of 11:49: 17:00 JH ORQ: first-version T3 moved to JH 25 after 6h without an answer…
```

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
removed docs/FAILURES.md
removed .git/hooks/pre-commit
removed docs
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
up. With `--global`, shows the machine's installed version, its manifest and the latest release.

```console
$ js-harness status
project: my-project
pinned version: 0.1.0
running version: 0.1.0
this clone: set up (manifest: my-project\.git\js-harness\manifest.json)
pin and running version: match
```

### js-harness update

Says whether a newer release exists: the newest `vX.Y.Z` tag of the private repository, read with
`git ls-remote` and the git credentials already on the machine (`--repo <url or folder>` names
another repository). No release is tagged before 1.0.0, so for now it says that and how to get
the newest copy. When the tags cannot be listed it says why and exits 1.

```console
$ js-harness update
no release of js-harness is tagged yet (versions are tagged from 1.0.0); to get the newest copy: npm i -g github:jsaristi/js-harness, or the same with the package manager that installed it (installed: 0.1.0)
```

### js-harness upgrade

Installs the newer release with the package manager, then syncs the home with the copy it
installed: the repository at its newest tag (`github:jsaristi/js-harness#vX.Y.Z`), or the newest
tarball of `--source <dir>`, a folder of `npm pack` tarballs, which wins when named and needs no
credential. With no release tagged it installs nothing and exits 1; no package registry is ever
asked.

```console
$ js-harness upgrade
nothing was installed: no release of js-harness is tagged yet (versions are tagged from 1.0.0); to get the newest copy: npm i -g github:jsaristi/js-harness, or the same with the package manager that installed it
```

### js-harness doctor

Reports each tool of the stack: its version, whether Claude Code and Codex are configured for
it, and the command that fixes what is missing. `--offline` skips the check for newer versions.

Its `host-update` row watches the Claude Desktop app and the Claude Code CLI bundled for its Code
tab, read from the app's folder under the home (`--home`), never from the environment. The first
reading is recorded as reviewed in the doctor cache. After an update, the row stays `stale` until
the review is done, listing the old and new versions and the review steps: the two changelogs,
the harness hooks, Remote Control, and a report to the user. A restart of the app turns Remote
Control off, and the step is to turn it back on in each work session without asking, his
standing yes of 2026-10-15; a session that has run no turn since the restart refuses it, so it
is sent a message first. `js-harness doctor --host-reviewed`
records the review; with `--json` it prints the record it wrote. The row also shows
`outdated` when the app downloaded an update it has not applied: on Windows that waits until
Claude is quit fully, the tray icon included.

Its `gentle-ai-sync` row does the same for gentle-ai. A gentle-ai sync rewrites the global
`~/.claude/CLAUDE.md`, which gentle-ai owns: js-harness never writes that file, and only reads it
to measure the per-turn payload (`bin/lib/payload.mjs`). So a new gentle-ai version stays `stale`
until it is reviewed. One review step diffs the global `CLAUDE.md` against the copy gentle-ai saved
before the first sync since the last review (`~/.gentle-ai/backups/<stamp>/snapshot.tar.gz`), and
the next checks each change against the project's `AGENTS.md` for conflicts.
`js-harness doctor --gentle-ai-reviewed` records the review, and `--json` prints the record.

Its `stack-update` row does the same for the other tools of the stack and for the `claude` on PATH:
the first reading is recorded as reviewed, and a tool that updated itself since (engram, codex, the
Claude CLI's native updater) stays `stale`, named by the session-start hook, until
`js-harness doctor --stack-reviewed` records its review. A tool installed since joins the record as
it is; one removed is no update.

Its `js-harness` row is the harness's own rules: the version column holds the first 8 characters
of the hash of the installed copy's rules with no scope, and `up to date` compares it with the same
hash of the default branch's list. A rule scoped to the harness's own repository never calls a copy
behind. In the harness's own checkout that list is read from the main ref with git; anywhere else
an interactive `doctor` reads it from GitHub on every run, never from the cache, and `--offline`,
the session-start hook and the TUI's stack block read nothing there (`n/a`), as does a project that
pins another version than the copy's. A copy behind is `outdated`, and its fix names the newest copy and the ids of the
rules that differ; a list that cannot be read is `unknown`. `--json` adds both hashes and the ids.

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
and `odd/tasks/*.md`. A feature that keeps its tasks in a table (a header with an `ID` and a
`Status` cell) is counted by its rows: a row whose ID is a task (`T2`, `T3c`) is done when its
status starts with `done`.

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

`--pace [--days <n>]` reads the first-parent history of the default branch (origin/HEAD, else
`main`, else `HEAD`) and prints the tasks closed, reopened, added and removed on each of the last
14 days, or `n`, by committer day, with the totals and the mean a day; `--json` gives the same as
data. A task is matched by its ID (`T3`); one reworded without an ID, or in a moved file, counts
as removed and added. Without `--pace`, `progress` runs no git.

```console
$ js-harness progress --pace --days 2
Pace of origin/main, its first-parent line, by committer day over the last 2 days:
  2026-10-15  closed 81  reopened 0  added 67  removed 1
  2026-10-16  closed 30  reopened 0  added 22  removed 1  (today, so far)
Total       closed 111  reopened 0  added 89  removed 2
A day       closed 55.5  reopened 0  added 44.5  removed 1
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

`rules --hook` is the turn-start hook of the rules (letter F of `odd/tasks/rule-hierarchy.md`). `install`
registers it for Claude Code three times: on `UserPromptSubmit`, on `SessionStart` for the
matcher `compact|clear|resume`, and on `SubagentStart`. Where the project declares rules
(`bin/lib/rules-data.mjs` in the harness's checkout, `docs/rules.json` in a project), it
compares the list at the session's merge base with the list on the default branch
(`origin/HEAD`, else `origin/main`, else `main`, never fetched). It tells the session, once,
each rule that was added, removed, retired or changed, with the new declaration itself. After a
compaction, a clear or a resume it tells it again, and a sub-agent is told at its start. Anywhere
else it prints nothing. A turn with no change prints nothing and costs no token. It never blocks:
a fault goes to standard error and it exits 0. What a session was last told is kept in
`~/.js-harness/channel/rules-seen/`, one file a session, pruned after 30 days. `uninstall` removes
that folder with the channel's; a session still running afterwards may write it again, and the
next `uninstall` removes it. Codex sessions get nothing until a logging hook confirms its events.

### js-harness codex-review

Runs the Codex review of `<base>..HEAD` and records it. `--plan` prints what the review would
read and cost, with how close that estimate came on the last reviews this machine recorded, and
starts nothing; a run records in each part's run line the figures it was planned at, which that
line reads; `--unavailable <reason>` records a skip.

A merge of the default branch is reviewed by what was written in it, not by what it brought in. At
HEAD that is one review. Below HEAD, after code commits that each have a record, the range is cut
in two turns where two cost less than one review (a part counted as 100 changed lines): the merge,
in a worktree at it that the run removes, then the commits after it. Each turn writes its record;
a merge whose review owes a correction stops the run before the commits after it.

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
this machine under the gate lock and, at the same time, on CircleCI on a `queue/*` branch pushed
before the suite starts, and when both are green moves main to it by fast-forward, leased on the main it was built from (odd/tasks/merge-queue.md).
A candidate whose every changed path is a document main's `harness.json` declares (`documents`) runs
no suite on this machine, as a commit of documents alone runs none, and takes no turn of the gate
lock: CircleCI's run of the whole gate is its test.
No GitHub workflow runs for a pull request: the one workflow, the gate of a commit (`js-harness check`),
runs for a push to a `gate/` branch alone.
A candidate red on this machine is bisected: the pull request that turns it red is left out and
named, and the rest is landed. The land asks `js-harness gate first` for a ticket of the running
session, so its gate goes first in the line; with no session id or a refused ticket it waits its turn
and says so. A gate that ran nothing (no turn in time, or a waiting push took it) or was stopped
before it ended is no red: the land exits 5, with main not pushed and nothing bisected
(`odd/tasks/land-unattended.md`). The `queue/*` branch is removed as soon as its answer no longer
matters: when the candidate is red or untested on this machine, or once CircleCI answered. Starting
CircleCI with the suite saves the minutes the two took in series; its cost is one CircleCI run spent
on each candidate this machine turns red or does not test, since removing the branch does not
cancel its build. A land killed before it ends leaves its `queue/*` branch on origin, to be removed
by hand. The pre-push hook refuses every other push of main from a clone; a
merge made on GitHub's side does not pass through it.
Each `--land` appends one JSON line to `lands.jsonl` under the git directory's `js-harness` folder:
the pull requests it looked at, each one left out with its reason (`not-ready`, `review`, `door`,
`conflict`, `merge` or `red`, with what the suite said), the start and seconds of each suite run,
of CircleCI (from the push of the `queue/*` branch, so it spans the local suite) and of the push,
the CircleCI build, what landed and the exit. A `--dry-run` writes none,
and a record that cannot be written is said and changes no exit.

A code commit made after the cut-over needs gentle-ai's evidence written on its own branch, beside
the line in the body: its hash (seven characters or more), or a range `a..b` that holds it (`a` and
what `git rev-list a..b` lists), on a line the pull request adds to a feature document
(`odd/tasks/<name>.md`) that says gentle-ai, such as `gentle-ai: 6b58f85..3d0cc94 high, approved`.
The queue resolves each range itself; a merge of main needs no line, and a pull request of documents
asks for none. A rebase changes the hashes, and the refusal says so. For each ready pull request
the queue prints, commit by commit, the Codex record that covers it and the line that names it.

A landed pull request from a `rule/` branch closes what `js-harness rules change` opened: for each
rule it changed in `bin/lib/rules-data.mjs`, the newest relief line "rule:<id> proposed on
<branch>, not landed" that the landed head holds (the line ends with a hash of the declaration it
wrote, which must be the head's) and that no later landing confirms gets one line of the queue's, "rule:<id>
landed on main <sha> from <branch>: confirms relief line <n>". A branch with no such line is named;
`--dry-run` and a land that does not move main write none. A rule's row is read three times: the
commit refuses a restated value, `js-harness check --push` reports it as INFO for the lines the push
brings past the remote's default branch, and the merge door refuses it.

On a machine whose gate runs its sensors in WSL2 (the switch `~/.js-harness/gate-wsl.json` and
`"sensorsInWsl": true` in `harness.json`), the land's run on this machine is a run in WSL2 too, so
the code paths of Windows (process trees, PowerShell, `cmd.exe` quoting) are tested by no commit's
gate. After each landed batch, the one who landed it runs the whole suite once on Windows, in a lock
turn on the main just landed, with the temporary files inside the drive the antivirus excludes:

```console
$ TEMP='D:\js-harness-tmp' TMP='D:\js-harness-tmp' JS_HARNESS_GATE_WSL=0 node bin/check.mjs
```

Each sensor's row then ends "on Windows (JS_HARNESS_GATE_WSL=0), its temporary files under
D:\js-harness-tmp", so a run that forgot `TEMP` shows it. A red run there is fixed like any red main
(odd/tasks/gate-wsl.md).

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
last reply, the worktrees and their feature plans, the running gates, the open pull
requests and whether a memory hygiene pass is due. It only reads. `--watch` waits until the board changes in a way that needs a
decision; `--address <role>` prints the title of the session that holds a role; `--quote
<transcript> <line>` prints one message the user sent; `--measures` prints, for each compaction
the host made, whether the session was told the pause and committed its feature document (the
orchestrator may write a line in its relief file instead), and how many compactions miss one of
those facts (nobody announces a compaction: he does not compact by hand); then the reliefs of the record (each `relieved` notice, judged by the context its relieved session was at: filled at the pause or another reason) and the Log lines that name a reopening, as candidates for the lead. Under each roster row's
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
nobody wrote since and refuses while another pass holds the lock. `uninstall --global` removes that
folder, except a project's folder that holds snapshots: they are the only copy of what a pass changed,
so it is kept, with its journal, and its stamps are named. The steps of a pass are in the installed `js-harness` skill, "Memory hygiene".

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

A pull request ready to land is announced with `--kind ready --pr <number>`: the record keeps
the number, and the board shows it ("ready for pull request 344"), so the land can tell which
session a pull request belongs to from the record, even when the notice was sent from `main`.

The record stamps every notice with the clock, so the text needs no hour. A text that opens with
one as its sending (`19:48 JH ORQ: …`, or after the label, `JH 5, 19:48: …`) more than a minute
off the clock is refused with exit 1, the right hour, and nothing written. An hour after a colon
is an event (`JH 5 · canal: compacted at 18:46`), and an answer, which quotes his words, is not
held to it.

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

A work session's wait, whatever its condition, also ends on a notice to that session's own
number, so a session that waits on a pull request still wakes for the lead. The number is read
from the title of the transcript the host's `CLAUDE_CODE_SESSION_ID` names, as `notify` reads a
sender. A session with no number keeps its one condition: the orchestrator, a phone session
whose transcript has no title. Such a wait exits 3, prints the notice and the same wait to run
again:

```console
$ js-harness wait --pr 340 --for 2 --every 5
js-harness wait: waits for the merge of pull request 340; ends when it holds, on a notice to 26, or after 2 minutes; stop it with TaskStop when it is no longer needed
js-harness wait: a notice to 26 came before the merge of pull request 340 held (20:14); the wait ends
note from JH 26 · canal y compactación: smoke test of T20b
js-harness wait: to wait again, run: js-harness wait --pr 340 --for 2 --every 5
```

```console
$ js-harness wait --pr 133 --for 1 --every 5
js-harness wait: waits for the merge of pull request 133; ends when it holds, or after 1 minutes; stop it with TaskStop when it is no longer needed
js-harness wait: the merge of pull request 133 holds (14:12)
```

### js-harness resume

The hook that runs after a compaction, which `install` registers for Claude Code and Codex.
`resume --hook` reads the hook's input and prints the session's title, its opening, the feature
document it works on and what to read there, so nobody pastes a resume prompt. For one document
it names the lines to read, not the whole file: its resume sections ("Next step", "State for a
resume"), the open task the first of them names first, that task's specs and its last log entries,
each range with its size. It writes
nothing and always exits 0. `resume --pause` is the hook of the context pause, measured against the window the host is configured to compact on when a setting gives one (`CLAUDE_CODE_AUTO_COMPACT_WINDOW`, else `autoCompactWindow` of the project's `.claude/settings.local.json`, its `.claude/settings.json` or the user's settings), and of the channel's inbox: after a tool call it says once each notice addressed to the session that it was not told yet. After a WebFetch the site refused as AI traffic (402, 403, 429 or 503) it names the next rung, `js-harness fetch`, to a sub-agent too; so it does after a WebFetch that failed as a tool error ("Claude Code is unable to fetch from <domain>"), which reaches no `PostToolUse` hook: `install` registers the same command as a `PostToolUseFailure` entry on WebFetch for that.

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
session, on `Bash`, on `Write` and `Edit`, and on the scheduled-task and cloud tools that open a session
(`create`, `update` and `run` of a scheduled task, and `RemoteTrigger`). `guard --hook` reads the call on
standard input and refuses seven things: a sub-agent launched on a model the project's rules do not give;
a scheduled-task or cloud tool that would open a session where he does not see it, in a project that
declares `sessions-open-in-sidebar`, the reason naming `start_session`, which opens it as a row in his
sidebar, even when he asked for it; a message whose stamped hour, after its label or first before it, is more than a minute off the clock; a shell command with backticks
inside double quotes, which bash runs as commands; a heavy `node --test` outside a gate turn while
another gate holds the machine's lock or an eval batch runs, heavy being several files, or one file
the gate log timed alone over a minute (an eval batch marks itself under `~/.js-harness/gate/batches`
while its trials run, and `uninstall` removes that folder with the lock's); and a `Write` or `Edit` that puts a line
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

### js-harness reply

The reply check. `install` registers `reply --hook` as a `Stop` hook for Claude Code and Codex;
it acts only in a project whose nearest `harness.json` holds a `reply` key, and prints `{}`
everywhere else. There it reads the reply that ends the turn and turns the stop back, with the
hooks contract's `decision: "block"` and the shape to follow, when the reply does not close with
exactly one state line: working (with what wakes the session on that line), decision (never while
a background task runs), cut (one code block of what the user sends, under the three labels what
it is, where it goes and what sending it does, each once) or finished (with the session to return
to on that line). A block under those labels in any other state is turned back too: a decision is
asked with the question tool. A state line is a line that starts with a state's label once its
markdown is taken off, followed by the end of the line or a mark such as a dash or a colon
(`**Working** — the gate wakes me`); a label inside a sentence, or a sentence that only begins
with its word (`Working on the docs`), is none.

`"reply": true` takes the English labels (`Working`, `Decision`, `Cut`, `Finished`; `What it is`,
`Where it goes`, `What sending it does`). An object names the project's own, each over the
English one: `{"states": {"working": "Sigo solo", "decision": "Necesito tu decisión", "cut":
"Corte", "finished": "Terminado"}, "labels": {"what": "Qué es", "where": "Dónde", "effect":
"Qué pasa"}}`. A key it cannot read, or a
`harness.json` that is not JSON, is said on standard error and checks nothing. A reply is
already shown when a `Stop` hook runs, so the session writes its close again in its next words.
It never turns back a stop the hooks already turned back (`stop_hook_active`), does not run for
sub-agents, writes nothing and always exits 0.

In the same projects, on Claude Code, it also turns back a work session (a title such as `JH 7 · …`)
that ends its turn holding work the orchestrator handed it, by a notice to its number or by its
opening, with nothing running in its background and no cron of its own: nothing would wake it when
a notice or a land comes, so it is told to arm `js-harness wait --notice-to <number>` in the
background, or to give the work back with `--kind closed`. A `waiting` notice does not give it
back: a session that waits still arms a wait. It says so once a handing, as the transcript records
its earlier block, and again after a background task launched since has ended. A close with the
decision state is not told, a handing older than the session's transcript belongs to another
session of that number (except the opening the session read, always stored before it began), a
call the host moved to the background when it outlived its timeout counts as a launch, and Codex, which sends no background tasks, is not checked. When the close
is refused too, both reasons go in one block.

```console
$ js-harness reply --hook < stop.json
{"decision":"block","reason":"js-harness reply: the reply has no state line. End the reply with one line that starts with one of: Sigo solo (say what wakes you), Necesito tu decisión (never while background work runs; the question itself goes through the question tool), Corte (one code block of only what the user sends, under the lines Qué es:, Dónde: and Qué pasa:), Terminado (name the session to return to). Your reply is already shown: write the close again in your next words."}
```

### js-harness fetch

The second rung for a page that refuses WebFetch as AI traffic (a 403, a 402, a challenge
page). It asks `r.jina.ai` for the page, which needs no install and no key, and reads the answer
for a block: `r.jina.ai` answers HTTP 200 with the site's challenge page inside, so its status
alone would take a block for a page. A page is printed whole with exit 0. A block at this rung
exits 3 and says why and what the next rung is: the built-in browser's `get_page_text`. The
`resume --pause` hook names this command after a WebFetch answered 402, 403, 429 or 503, and after one
that failed as a tool error.

It sends no cookie and no key. The URL goes to a third party, so a host that is not public (no
dot, loopback, a private address), a URL with a user or a password, or a query parameter named
like a secret is refused with exit 1 before anything is sent.

```console
$ js-harness fetch https://www.npmjs.com/package/react
js-harness fetch: blocked at r.jina.ai: the site answered it HTTP 403.
Next rung: open https://www.npmjs.com/package/react in the built-in browser and read it with get_page_text; if the text comes back empty, wait a few seconds and read it again.
```
