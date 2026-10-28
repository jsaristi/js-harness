# js-harness

js-harness sets up Claude Code and Codex for AI-assisted development in a project, on top of a
stack it does not rebuild: gentle-ai owns the workflow, task documents and TDD, engram owns
memory, codegraph owns code structure. js-harness adds the thin layer those leave open: a short
`AGENTS.md`, a pre-commit gate that runs the project's checks, the two reviews every slice gets
(Codex's, `codex-review`, and the Claude lenses', `lens-review`), task contracts whose end is a set
of commands that exit 0, and a record of everything it writes, so that it can be removed exactly.

**New here? Start with the [user guide](docs/GUIDE.md):** install, the menu, the first run, a typical day and
uninstall. This page is the reference of every command.

It is plain Node with no dependencies. It needs Node 24 or newer and git.

## Install

The repository is public on GitHub; the install reads it from there.

```sh
npm i -g --allow-git=all github:jsaristi/js-harness
js-harness install
cd my-project
js-harness init
```

1. `npm i -g` puts the `js-harness` command on the path; npm 12 fetches a package from git only
   with `--allow-git`, and npm 11.12 refuses this one under `root`, so `all`. With pnpm: `pnpm add -g github:jsaristi/js-harness`.
2. `js-harness install` writes its skills and hooks for Claude Code and Codex under your home,
   once per machine.
3. `js-harness init`, in a git repository, writes `harness.json` (the pin, `"code"`, the project's
   identifier its sessions' titles start with, offered from the initials of its name, and `"reply": true`,
   which turns the reply check on), `AGENTS.md`, an empty failures register (`docs/FAILURES.md`)
   and the pre-commit gate of that project.
4. `js-harness doctor` tells you which tools of the stack are missing and the command that sets
   up each one.

`js-harness --version` (or `-v`, or `version`) prints the version of the copy on the path, alone on one
line. `js-harness <command> --help` (or `-h`) prints that command's usage and runs nothing.

## Remove

```sh
cd my-project
js-harness uninstall            # what init wrote in this project
js-harness uninstall --global   # what install wrote in the home; the program stays
pnpm remove -g js-harness       # the program; npm rm -g js-harness for an npm install
```

The last line uses the package manager that installed the program. `uninstall --global --everything`
does the last two in one step and goes further, below.

`uninstall --global` keeps the snapshots of memory passes, the only copy of what a pass changed,
and names them; `uninstall --global --full` removes them too. Files you modified and the memory
notes themselves are kept either way. `uninstall --global --everything` removes all that js-harness
keeps on the machine and then the program itself, so no `pnpm remove -g` or `npm rm -g` is needed after it. Projects'
files are kept. Each kind has a name too (`uninstall project`, `machine`, `snapshots`,
`everything`), and the TUI's Uninstall opens a submenu of them.

`uninstall` removes from the project what `init` wrote, and `uninstall --global` removes from
the home what `install` wrote. Each one reads the manifest the install recorded, so it removes
only those files, and all of them. Measured on Windows with an empty home and an empty project:

- the project is left as it was: `git status` shows nothing;
- the home keeps no `.claude/` or `.codex/`: a folder `install` made goes with the last file in it,
  and only an empty `AppData/Roaming/` is left;
- the home keeps no `.codegraph/`: `init` runs `codegraph init` with `DO_NOT_TRACK=1`, so codegraph
  writes no telemetry there (measured on codegraph 1.6.0).

## Releasing

A release is a `vX.Y.Z` tag on a commit of main whose `package.json` says `X.Y.Z`. The first is
v0.9.0, a rehearsal; v1.0.0 is the first definitive one, and patches after it are 1.0.1, 1.0.2.
No package registry is involved: the tag on GitHub is the release.

1. The bump: on a branch, `version` in `package.json` goes to the new version, and the branch lands
   on main through the merge queue like any change.
2. The full test, on the landed commit: `npm run check`, then the release proof with each package
   manager, `npm run release-proof -- --repo . --pm npm`, and the same with `--pm pnpm`. With
   `--repo .` the proof clones this repository into a temp folder and tags the clone twice, with
   the version released and the minor after it (`v0.9.0` and `v0.10.0` for 0.9.0), so it needs no
   real tag; it installs the first into throwaway folders, upgrades to the second, moves a
   project's pin, uninstalls, and fails unless the throwaway home ends as it started.
3. The practice run, on that same commit: one run of the journey starts a real host session, which
   no other step does (`docs/SPEC.md`, "A host loads what was installed"). Set its folder up once
   with `node scripts/practice.mjs setup --root <dir>`, then run `node scripts/practice.mjs run --root <dir>`
   without `--no-host`. The host step needs `JS_HARNESS_EVAL_OAUTH_TOKEN`, a token from
   `claude setup-token`, and it spends a model: each release costs one host session, and v1.0.0 is
   the first. The run passes only when every step does, the host session included, on a clean checkout
   of that commit. It appends its line to `<dir>/record.jsonl`.
4. The tag: `git tag vX.Y.Z <commit>` on that same commit, then push it with the folder of step 3
   named: `JS_HARNESS_PRACTICE_ROOT=<dir> git push origin vX.Y.Z`. The pre-push hook refuses a tag
   whose `package.json` at the tagged commit says another version, and a tag with no whole pass of
   step 3 on its commit: it reads `<dir>/record.jsonl`, and its refusal says what is missing. With no
   folder named, the refusal says how to name one. Once the tag exists,
   `npm run release-proof -- --from vX.Y.Z` proves it from GitHub itself.
5. A machine: `js-harness update` says that a newer release exists, and `js-harness upgrade`
   installs it and syncs the home.
6. A project: raising its pin is an explicit commit, like a lockfile. Set `version` in its
   `harness.json` to the new version, run `js-harness sync` with that version installed, and commit
   what it wrote.

A new user installs a release by its tag, `npm i -g --allow-git=all
github:jsaristi/js-harness#vX.Y.Z` or `pnpm add -g github:jsaristi/js-harness#vX.Y.Z`; the
commands under Install, with no tag, install the newest main. A tag can be moved by anyone who can
push to the repository, and no checksum is checked; `git ls-remote
https://github.com/jsaristi/js-harness "refs/tags/vX.Y.Z*"` prints the commit a tag names (on the
line ending `^{}` for an annotated tag), and `#<that commit>` in place of `#vX.Y.Z` installs that
commit exactly.

## Commands

Most commands are for you; some exist for the hooks `install` registers or for an orchestrator session
that leads other sessions, and are rarely typed by hand:

| For you | For hooks and the orchestrator |
|---|---|
| check, gate, init, onboard, install, sync, uninstall, status, update, upgrade, doctor, stack, progress, contract, summary, failures, rules, codex-review, codex-meter, lens-review, functions, remote, memory, fetch, backup, clean | hooks: guard, reply, resume, permit; the orchestrator and its sessions: loop, report, throughput, windows-daily, merge-queue, sessions, unseen, subagents, audit, notify, wake, quiet, wait |

Every example below is the output of a real run. Paths are shortened: `~` is the home and
`my-project` is the project's folder. A line `…` marks output left out; output that grows with
each feature, such as install's hook lines or check's rows, is shown in part and cut with it.

### js-harness check

Runs the project's gate: the budget of `AGENTS.md`, the task contracts, the declared sensors
(tests, lint, typecheck) and what code still waits for its two reviews. The pre-commit hook
runs it, so a red check means the commit is not ready yet. A gate that passes prints one line,
`PASS  check  <n> rows passed`, with what the `review` row says of that debt; a gate that fails
prints every row. A check a gate's own sensor starts carries `JS_HARNESS_CHECK_INNER=1` and runs no
sensor and takes no lock; its line ends `sensors: none ran, an inner check (JS_HARNESS_CHECK_INNER=1)`,
so the variable left set in a shell never passes for a gate. `--verbose` prints every row of a passing gate too, and so does
`JS_HARNESS_CHECK_VERBOSE=1`, for a hook, which runs `check` without flags. `--push` and
`--door` print their rows either way. `--head` goes only with `--push`, and `--push` refuses `--first`,
`--subagents`, `--wait`, `--no-wait` and `--verbose`, as a usage error. With `JS_HARNESS_TEST_CONCURRENCY=<n>`
set, a tests sensor that is `node --test` (directly or as the `test` script) runs `n` test files
at a time, for a machine where node's default, one fewer than its processors, is too few.

Three keys of `harness.json` shape the gate's sensors: `documents` (an array of paths from the top of
the repository, with forward slashes and a final `/` for a folder; a commit that holds only these
runs no `sensors`), `documentSensors` (named commands that run at such a commit instead, and need
`documents`), and `exactTests` (`"shadow"` or `"skip"`). A value of the wrong shape fails the
`sensors` row, which names the key and the shape it takes, and no sensor runs.

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
which is then cancelled) runs here under the lock, after one `check:` line on stderr that says why. The gate log keeps both: a run's red tests by name, read from its log with gh's prefix taken off, and a `ci-fallback` line with why and what the wait cost, under the id of the gate that then runs here. `JS_HARNESS_GATE_CI=0` keeps every gate here. The runner is Linux, so a test that runs only
on Windows is left to the daily Windows suite: `.github/workflows/windows-daily.yml` runs the whole suite once a day on
GitHub's Windows machines, off the land's path, and `js-harness windows-daily` tells the lead the
failing test names of a red run.

The `fixed load` row says how many tokens a Claude session of the project sends at its first turn,
before any work: the median of the latest five sessions, read from their transcripts under
`~/.claude/projects` (and, from a worktree, its main checkout's). It never fails a commit, and warns
over `rule:fixed-load-budget` tokens.

The `review` row informs and fails nothing: it names the code commits since the default branch that
no Claude lens record covers, with the `lens-review` command that makes one, and the skips of both
reviews (`--unavailable`) that still owe one; where the Codex review is off it says the lenses are
the one review. In the harness's own repository the `commit-size` row also fails a staged change
whose lines a review reads number more than `rule:reviewed-commit-lines`, so it is split before it
is committed.

```console
$ js-harness check --verbose
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

Three more forms of `check` share the same command:

- `--wait <minutes>` is how long the machine's gate lock may go without changing hands before this
  gate gives up on it (the rule `gate-wait` when not given); `--no-wait` refuses at once instead.
- `--first <reason>` issues this session a ticket for the tree and claims it as the gate arrives, so
  its check goes before every gate that waits. It is for the orchestrator's batch run on main;
  `js-harness gate first` lists the open tickets and cancels one.
- `js-harness check --push` is the pre-push check of a project with the Codex review on. Its Codex row
  refuses a push whose code commits no Codex record covers, and a push whose head is a review that
  owes a correction never rechecked; a recheck that left findings open passes with a warning. Its
  `lens-review` row refuses, the same way, a code commit no complete Claude lens record covers,
  where that commit's own `harness.json` turns `lensReview` on, and names the command that makes the
  record; a skip passes and is listed. A first push to a remote that holds no branch passes both. Its
  `rules` row lists the lines the push brings past the remote's default branch, as INFO: the push
  reports them, and the merge door refuses them. A pushed `vX.Y.Z` tag is refused when `package.json` at the
  tagged commit names another version than the tag without its `v` (`check --push --ref`, which the
  pre-push hook passes for each tag): `upgrade` would refuse that copy.
- `js-harness check --door --base <rev> [--branch <name>]` runs only the rule rows of the lines
  `<rev>..HEAD` brings, and the failures row, for merge-queue's door. It exits 1 when one refuses.
  `--branch` names the pull request's branch, which may change `bin/lib/rules-data.mjs` only when it
  is a `rule/` branch.

### js-harness gate

Runs a heavy command under the machine's gate lock, one at a time with the gates of every
project, and records the run in the machine's gate log. `gate log` prints the last runs. A
command is stopped after the minutes of `rule:gate-max` (`--max <minutes>` replaces them), and
while the branch of the folder it runs in has an open pull request and commits a push would take now, any command but that push or a merge
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
excluded .atl/ in .git/info/exclude
manifest: my-project\.git\js-harness\manifest.json
next: in a Claude Code or Codex session, run js-harness onboard
```

The last line appears only while the project has no `docs/ROADMAP.md`. The `excluded` line keeps
gentle-ai's `.atl/` folder out of what git calls untracked, in this clone only; it is not written
when the lines there already exclude `.atl`, and `uninstall` takes back exactly the line `init`
added. A project set up before `init` wrote it gets the same line, recorded the same way, from its
next `js-harness sync`. The example is a project with code. What `init` adds beyond the first four files follows the
switches in `harness.json` `"functions"` (`js-harness functions` shows each one and why): the
pre-push check (`.git/hooks/pre-push`) when the Codex review is on, the code map's `codegraph init`
and the keys of `.claude/settings.local.json` when their switches ask for them. A project whose code
map is off prints `codegraph init skipped: the code map is off` and gets no `.codegraph/`.

### js-harness onboard

The pre-plan and the roadmap of a project after `init`, written by the session the owner talks to;
the command calls no model. With no verb it reads the files and git, prints the stage the
onboarding is in (Read, Conversation and advice, Pre-plan, its review, Plan, its review, Close, then awaiting
merge and onboarded, which hands off to the build orchestrator with the opening prompt the
`js-harness-orchestrator` skill gives a new lead) and what the session does next, so a new session, a compaction or the other
host resumes by running it again; an onboarding on another branch is named with its worktree or
the switch that resumes it. `check` names what is still missing and the stage it sends the work
back to (`check --plan` reads only the roadmap and its ties to the pre-plan); `hash` prints what an
approval records; `template feature|origin|roadmap|adr` prints a skeleton and, with `--write`, writes
it, never over a file, and `template adr <slug>` numbers the next decision record under `docs/adr/`.
It exits 1 when `check` finds something, a template's file exists or a link is in the way, the project has a plan of its
own, it is no initialized project or a profile cannot tell what it needs, and 2 for a usage error.

```console
$ js-harness onboard
Stage 1 of 8, Read: no onboarding document yet.
First: git switch -c onboarding, the branch the onboarding is committed on, so a session in another worktree finds it.
Do: js-harness onboard template feature --write; then read the repository (README, manifests, git log, docs, codegraph where there is code). Write the owner's request verbatim in L1, and what exists under ## What exists, each with its evidence. Check O1.
Then: commit, and run js-harness onboard again.
$ js-harness onboard template feature --write
wrote odd/tasks/onboarding.md
$ js-harness onboard check
FAIL  odd/tasks/onboarding.md: ## Setup has no Kind line yet (back to stage 2, Conversation and advice)
FAIL  docs/origin.md: missing: js-harness onboard template origin --write starts it (back to stage 3, Pre-plan)
FAIL  AGENTS.md: has no line "The plan is docs/ROADMAP.md: a session starts there, and each feature's state is in odd/tasks/." (back to stage 7, Close)
$ js-harness onboard hash
answers   sha256:91f9c265f5ad
origin    missing
roadmap   missing
adrs      sha256:e3b0c44298fc
```

The `check` is cut to three of its findings. A project with a plan of its own and no onboarding
anywhere is left alone, exit 1; `docs/origin.md` and `docs/ROADMAP.md` are found in any case, and named as the disk
names them. Until the close, `check` also holds the roadmap to the advice:
`## Decided` names every accepted ADR, and every `B:` target that `profile --checklist bar` prints
for the project's Kind and Size is on a Checklist step, waits under `## Open decisions` with its
area's open decision, or is named in the given-up line. The design is `odd/tasks/onboarding.md`.

`profile` prints the advice the session gives from, one piece at a time, so none of it loads on
every turn: with no argument the kinds of project it knows; with a kind (or two, joined by a
comma) its default, why, and its areas and bar; `--area <id>` one area, explained for each level
of experience, with its pitfalls, each kind's advice and its sourced targets; `--checklist
advice|bar` the lines the onboarding pastes. With no kind it reads `Kind` and `Size` from the
onboarding document's `## Setup`; a small project keeps the core areas only, plus each area the
owner asked for on its `- Areas: +<area> (L<n>)` line, such as `- Areas: +answer-engines (L9)`.

```console
$ js-harness onboard profile platform --checklist advice --size small
- [ ] A:architecture Architecture
- [ ] A:frontend Front end and UX
- [ ] A:backend Back end and API
- [ ] A:data Data and storage
- [ ] A:auth Authentication and accounts
- [ ] A:hosting Hosting and environments
- [ ] A:security Security
- [ ] A:accessibility Accessibility
- [ ] A:ci CI and tests
- [ ] A:legal Legal and privacy
- [ ] A:cost Cost and budget
```

### js-harness install

Writes the skills and the session hooks for Claude Code and Codex under the home, and records a
manifest of them. It also holds two things in the user's Claude files, recording only what it
wrote so `uninstall` takes out exactly that: the permissions of the Claude settings (an allow for
codegraph's tools, and denies of a wipe of the root or the home and of a read or edit of the places
of secrets) and a marked Rules
block in `~/.claude/CLAUDE.md`, rendered again while unedited and left as yours once you edit it.
`--accept-session-messages` also sets Claude Code's `crossSessionInbound` to `"accept"` in the user
settings, so a message from a session of another permission class arrives; `uninstall` puts back
what was there.

```console
$ js-harness install
installed js-harness 0.9.0 (6 files) into ~
registered hook entry in ~\.claude\settings.json: js-harness doctor --hook (SessionStart, matcher startup|resume)
registered hook entry in ~\.codex\hooks.json: js-harness doctor --hook (SessionStart, matcher startup|resume)
registered hook entry in ~\.claude\settings.json: js-harness resume --hook (SessionStart, matcher compact|clear|startup)
registered hook entry in ~\.codex\hooks.json: js-harness resume --hook (SessionStart, matcher compact|clear|startup)
registered hook entry in ~\.claude\settings.json: js-harness resume --pause || exit 0 (PostToolUse)
registered hook entry in ~\.claude\settings.json: js-harness resume --pause || exit 0 (PostToolUseFailure, matcher WebFetch)
registered hook entry in ~\.claude\settings.json: js-harness guard --hook || exit 0 (PreToolUse, matcher ^(Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash|Read|Write|Edit|MultiEdit|NotebookEdit|Grep|mcp__scheduled-tasks__create_scheduled_task|mcp__scheduled-tasks__update_scheduled_task|mcp__scheduled-tasks__run_scheduled_task|RemoteTrigger|mcp__ccd_session__start_session|mcp__terminal__run_in_terminal)$)
registered hook entry in ~\.claude\settings.json: js-harness permit --hook || exit 0 (PermissionRequest)
registered hook entry in ~\.claude\settings.json: js-harness guard --stop || exit 0 (Stop)
registered hook entry in ~\.claude\settings.json: js-harness rules --hook || exit 0 (UserPromptSubmit)
registered hook entry in ~\.claude\settings.json: js-harness rules --hook || exit 0 (SessionStart, matcher compact|clear|resume)
registered hook entry in ~\.claude\settings.json: js-harness rules --hook || exit 0 (SubagentStart)
registered hook entry in ~\.claude\settings.json: js-harness reply --hook || exit 0 (Stop)
registered hook entry in ~\.codex\hooks.json: js-harness reply --hook || exit 0 (Stop)
…
```

Then trust the Codex hooks: Codex runs no hook of `hooks.json` that its `config.toml` holds no
trust record for, and says nothing about it (Codex CLI 0.163.0). Run `codex` in a terminal and
answer its prompt about hooks with "Trust all and continue". Install never writes that record:
trusting a hook is your security setting, and its hash is Codex's own. Until you do, `doctor`'s
`codex-trust` row is `missing` and names each hook Codex skips.

### js-harness loop

Runs a session's long background loops (the orchestrator's heartbeat, its channel watch, a merge
keeper) under an owner record, so two sessions never stop each other's loops. `run` keeps the
command in the foreground of a background task, so its end still wakes the session, and records the
owner session, its own process and the command's by pid and creation time, the purpose and what
ends it. `stop` refuses a live loop another session owns unless `--take-over`, and exits 0 only when
a second look at the process table finds none of its processes left (exit 1 when one survives, 3
for a loop another session owns). The owner is `--owner`, else `CLAUDE_CODE_SESSION_ID`. `run`
refuses a live loop of the same name (exit 2) unless `--restart`, which stops it first under the
rule of `stop`. `heartbeat` and `channel-watch` are bodies for `run`; `channel-watch` ends on the
first notice of another session, or after `--for` minutes (30, exit 1).

`heartbeat` ends on a quiet machine (no gate-log or channel write for `--quiet` minutes) and on a
stalled work session: one the orchestrator handed work to, by a notice to its number or its
opening, that has not given it back with a `waiting`, `closed` or `relieved` notice and has made no
commit of its own, sent no notice and run no gate for `--stall` minutes (the rule `session-stall`,
an hour). It prints a `STALLED:` line naming the session, since when it is quiet and what it holds,
and says it again each time that quiet doubles. `js-harness sessions` lists the same sessions in
its `Stalled` section, and its `--watch` says each one as it crosses.

Every `--windows` minutes (an hour; `0` for never) it also reads the daily Windows run, as
`js-harness windows-daily` does, and ends with a `WINDOWS:` line when that run is red and was not
told before. The time of the last reading is kept in a file, so a heartbeat started again after a
`STALL` still reads it once an hour. With nothing else, it ends after `--max` hours (10, exit 1).

Each tick also keeps the throughput snapshot of every settled day of the last
`throughput-backfill-days` that the gate log holds and that has none, never while a gate holds
the lock, and reads the throughput reviews due (`js-harness throughput status`). One that falls
due ends the heartbeat with its `DUE:` line, again an hour, three and seven after; and every line
that ends it is followed by the `DUE:` lines still open, so the daily review never waits on the
lead remembering it.

```console
$ js-harness loop heartbeat
js-harness loop heartbeat: ends when 30 minutes pass with no write to the gate log (…) or the channel (…), or a work session holds handed work with no commit, notice or gate for 60 minutes, or after 10 hours; every 60 minutes, the daily Windows run is read, and a red one told now ends it; each tick keeps the settled days with no throughput snapshot, and a throughput review falling due ends it
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
git repository, writes the machine install again; a hook entry the host file already holds is said as
`already registered hook entry in …`, and is not written again.

The lines of `AGENTS.md` that `init` wrote for any project sit between two `js-harness block`
marks. While the project has not edited them, `sync` writes them as the running version has them,
for the project to commit; an edited block is kept and said.

```console
$ js-harness sync
up to date at 0.9.0
```

### js-harness uninstall

Inside a project, removes what `init` wrote; with `--global`, removes what `install` wrote.
`--global --full` also removes the memory snapshots, the only copy of what a pass changed; files
you modified and the memory notes themselves are kept either way. Neither removes a project's
memory folder while a pass holds its lock: the line says what releases it.

`--global --everything` is `--full` and then the rest: the whole `.js-harness` folder of the home
(the lead's notes, the backups, the throughput records and anything else under it), and the
js-harness program, removed by the package manager that installed the copy running it (pnpm's
`remove -g`, or npm's `uninstall -g` with that copy's own prefix, run as the npm beside the node that runs js-harness, not
whatever `npm` is first on PATH, which may be pnpm's shim). A copy run from a checkout was
installed by no package manager, and one in a project's `node_modules` (or npx's cache) is that
project's dependency, so the program is kept and the line says why. The program counts as
removed only once its folder is gone, whatever the manager's exit code. While a gate runs, or the
folder or anything above it could not be removed, it removes nothing more and says to run it
again. It cannot be undone; the TUI's Everything asks once, naming all of it, and the TUI
ends once it succeeds. Projects' files are kept: `uninstall` inside each project undoes `init`.

Each kind also has a name, and a named kind never acts by location:

| Kind | Same as | Removes | Keeps |
|---|---|---|---|
| `uninstall project [--cwd <path>]` | `uninstall` inside a project | what `init` recorded in this clone | files you edited, the machine install |
| `uninstall machine` | `uninstall --global` | what `install` recorded, and the folders js-harness keeps in the home | files you edited, the memory snapshots, the throughput records, the program |
| `uninstall snapshots` | `uninstall --global --full` | the same, and the memory snapshots | the throughput records, the program |
| `uninstall everything` | `uninstall --global --everything` | the same, the whole `.js-harness` folder and the program | projects' files |

The machine kinds also undo what `stack install` ran, the last first, printing each undo before
it runs it: a tool already gone loses its record, one that changed since (you upgraded it, or
registered it again with another entry) is yours and is kept, named, and one whose undo fails
stays recorded, so running the uninstall again finishes it, and the exit code is 1.

`uninstall project` outside an initialized project exits 1 and removes nothing; it never falls
through to the machine. A kind given `--global`, `--full` or `--everything`, or a machine kind
given `--cwd`, is a usage error.

In the TUI, Uninstall opens a submenu of the same kinds: Project (inside a project `init`
touched), Machine, Machine + memory snapshots, Everything and Back. Each kind asks y/N with a
line that says what it removes and what it keeps; a yes runs it and returns to the menu, Back
or Escape returns without running anything.

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
up. With `--global`, shows the machine's installed version, its manifest and the latest release,
read as `update` reads it: `--repo <url or folder>` names another repository and `--source <dir>` a
folder of `npm pack` tarballs.

```console
$ js-harness status
project: my-project
pinned version: 0.9.0
running version: 0.9.0
this clone: set up (manifest: my-project\.git\js-harness\manifest.json)
pin and running version: match
```

### js-harness update

Says whether a newer release exists: the newest `vX.Y.Z` tag of the repository, read with
`git ls-remote` and the git credentials already on the machine (`--repo <url or folder>` names
another repository; `--source <dir>` reads a folder of `npm pack` tarballs instead). Releases are
tagged from v0.9.0; where the repository holds no tag it says that and how to get the newest copy. When the tags cannot be listed it says why and exits 1. A value
flag with no value, or followed by another flag, exits 2 with `<flag> requires a value`.

```console
$ js-harness update
up to date: 0.9.0
```

### js-harness upgrade

Installs the newer release with the package manager, then syncs the home with the copy it
installed: the repository at its newest tag (`github:jsaristi/js-harness#vX.Y.Z`; `--repo <url or
folder>` names another repository), or the newest tarball of `--source <dir>`, a folder of `npm pack`
tarballs, which wins when named and needs no credential. With no release tagged it installs nothing and exits 1; no package registry is ever
asked. A value flag with no value, or followed by another flag, exits 2 with `<flag> requires a value`, before anything is installed.

The package manager is `--pm <command>`, else `JS_HARNESS_PM`, else the one that installed the copy
running now: `pnpm` for a copy in pnpm's global folder, `npm` otherwise. The menu's Upgrade passes
no `--pm`, so it upgrades a pnpm copy with pnpm; after it the menu's header says the new version is
installed and to open the menu again, since the one open keeps the old code. npm gets `--allow-git=all` for a tag, since npm 12 fetches nothing from git without it
(`all` and not `root`, which npm 11.12 refuses for a global install);
pnpm gets `add -g`. The install is judged by the installed copy's own `--version`, not by the
package manager's exit code: pnpm can exit 1 after a good install when its cleanup finds a file
in use, and `upgrade` then says so and goes on. With pnpm, its bin folder's lock is removed when
the install left it, or when it is older than ten minutes, and never while another pnpm runs.
When the copy does not answer the new version after a failed install, `upgrade` tries again, up to
three tries 20 seconds apart; after the third it says how many it made and that a lock left behind
is removed by the next upgrade once it is ten minutes old. After an upgrade from a tag, the undo
`--refresh-copy` prints names that tag.
Where `npm` on the path is a shim that runs pnpm, as on a machine where pnpm installed js-harness,
name pnpm: `--pm pnpm`, since pnpm refuses npm's `--allow-git`. `--prefix <dir>` installs into a
folder of its own: npm's prefix, or pnpm's home with every folder pnpm writes inside it. On
Windows the install runs through cmd.exe, which changes a `"` or a `%`, so a value holding either is
refused before anything is installed.

```console
$ js-harness upgrade --pm pnpm
up to date: 0.9.0 (the source holds 0.9.0)
```

### js-harness doctor

Reports each tool of the stack: its version, whether Claude Code and Codex are configured for
it, and the command that fixes what is missing. `--offline` skips the check for newer versions.
It also says whether Claude Code and the desktop app are signed into the same account (neither
identifier is printed) and whether the remote server of each recorded login launcher is running.
Its `unseen` row counts what `js-harness unseen` would clear, and an interactive run adds a
`worktrees` row for the worktrees on branches main already holds and a `review-skips` row for the
skips of both reviews that still owe one (a pull request holding a lens skip does not land). `--json` prints the rows.
`--hook` is the session-start hook `install` registers: it computes the same report and prints one
line only when there are gaps and they differ from the last ones it told, and it exits 0 (2, with
the usage, for an argument it does not know).

Its `codex-trust` row reads the `config.toml` of the Codex home (`CODEX_HOME` when the home is the
real one and it is set, else `~/.codex`) for a `trusted_hash` of each harness hook of
`~/.codex/hooks.json`, at the place Codex keys it by:
`[hooks.state.'<hooks.json>:<event>:<group>:<handler>']`. A hook with none is `missing`, listed by
that place and its command, with the step that trusts it; doctor never writes the record. A hash
that no longer matches its hook, after an upgrade changed it, cannot be told from here.
`uninstall` takes the trust records of the hooks it removes out of the `config.toml` install
recorded, and moves the records of your own hooks that come after them to their new places.

Its `engram-plugin` row, shown while engram's Claude Code plugin (`engram@engram`) is installed and
enabled, compares the plugin with the one the engram binary's own release ships: the version that
tag's `.claude-plugin/marketplace.json` names, read with git from Claude Code's clone of the engram
marketplace (`~/.claude/plugins/marketplaces/engram`), never from its working tree and never over
the network. An older plugin is `outdated`, and its fix names both versions:
`claude plugin marketplace update engram`, then `claude plugin update engram@engram`, then a
restart of Claude Code. A clone without that tag, or no git, is `unknown`. engram's latest version
is its highest `v<semver>` release, so its separate `pi-v*` releases are never read as engram's.

Its `host-update` row watches the Claude Desktop app and the Claude Code CLI bundled for its Code
tab, read from the app's folder under the home (`--home`), never from the environment. The first
reading is recorded as reviewed in the doctor cache. After an update, the row stays `stale` until
the review is done, listing the old and new versions and the review steps: the two changelogs,
the harness hooks, Remote Control, and a full report to the user: what improved, what changed
and what was fixed, how each helps or hurts the harness and the way the user works, and what the
harness should change; a version the changelog has no entry for is reported as having none. A restart of the app turns Remote
Control off, and the step is to turn it back on in each work session without asking where the rule
`remote-control-yes` holds, his standing yes of 2026-10-15, and to ask the user first anywhere else; a session that has run no turn since the restart refuses it, so it
is sent a message first. `js-harness doctor --host-reviewed`
records the review; with `--json` it prints the record it wrote. The row also shows
`outdated` when the app downloaded an update it has not applied: on Windows that waits until
Claude is quit fully, the tray icon included.

Its `gentle-ai-sync` row does the same for gentle-ai. A gentle-ai sync rewrites the global
`~/.claude/CLAUDE.md`, which gentle-ai owns: js-harness writes nothing there but its own recorded
Rules block (`install`, above), and otherwise only reads the file to measure the per-turn payload
(`bin/lib/payload.mjs`). So a new gentle-ai version stays `stale`
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

### js-harness stack

Read-only. Lists the tools the harness requires that are missing on this machine for this
project, in the order `stack install` runs them, each with its command and its exact undo:
the Codex CLI while the project's `codexReview` switch is not off, codegraph while `codeMap`
is not off, and codegraph's registrations in Claude Code and Codex. What it never runs is
named as your own step: gentle-ai's installer (its uninstall is not an exact undo, so it
stays yours, with gentle-ai's own undo beside it), engram, which that installer brings, a
login, and the prerequisites `git` and `gh`. context7 and typescript-lsp are listed as
optional. The package manager is `--pm`, else `JS_HARNESS_PM`, else the one that installed
this copy. `--json` prints `{ mandatory, manual, optional }`. It exits 0 when nothing
required is missing, 1 when something is.

`js-harness stack install [--prefix <dir>] [--tool <id>]... [--yes]` runs those installs in
that order. Each is printed with its undo and asked `Run it? [y/N]` in a terminal; without one it
runs nothing unless given `--yes`, and then only the tools `--tool` names. Each is recorded in the
machine manifest before it starts, so `uninstall machine` undoes it; a failure that left nothing
behind loses its record, and one the probe cannot read afterwards keeps it, as does a timeout
(under `--yes` only: in a terminal nothing is timed out). Such a record is read again at the end
of the run; one still unread by `uninstall machine` cannot tell what it left from a later install
of your own, so its undo is printed for you and never run. Under `--prefix` the
prefix's binaries come first on the PATH of every probe and command. With a `CODEX_HOME` of your
own, the registration in Codex goes there, where `doctor` reads it and the undo finds it. It
exits 0 when nothing it set out to install is missing or unverified, 1 when something is
(declined, failed, timed out or left to you). In the TUI, Install the stack sits after Doctor
while a required tool is missing, and runs `stack install`, each y/N answered by one key.

```console
$ js-harness stack
js-harness stack: 2 to install, 1 of your own steps.

Installs (stack install runs each one after you say yes, in this order):
  1. codegraph claude
     run:  claude mcp add -s user codegraph -- codegraph serve --mcp
     undo: claude mcp remove -s user codegraph
  2. codegraph codex
     run:  codex mcp add codegraph -- codegraph serve --mcp
     undo: codex mcp remove codegraph

Your steps (never run):
  - codex (codex): a login takes your credentials
      codex login
    undo: codex logout
```

### js-harness progress

Shows the roadmap's phases and the features, counted from the checkboxes of `docs/ROADMAP.md`
and `odd/tasks/*.md`. A feature that keeps its tasks in a table (a header with an `ID` and a
`Status` cell) is counted by its rows: a row whose ID is a task (`T2`, `T3c`) is done when its
status starts with `done`. `--json` gives the data and `--cwd <path>` names another project.

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

### js-harness report

The facts a status report is written from, since the last report: the pull requests merged into
the default branch (origin/HEAD, else `main`, else `HEAD`) with the subjects of their commits,
each session that wrote a notice with its last one, the questions answered and those still open,
and the roadmap as the default branch holds it, phase by phase with what is left. The
orchestrator skill tells the lead to run it when the user asks how the work is going, and to
answer from it in six sections.

The cut is `--since <time>` (an ISO 8601 time), else the last report recorded, else the last 24
hours; the first line says which. Reading writes nothing. `--mark` records this report as the
last one: one line in the project's channel record under the home
(`.js-harness/channel/<project>.jsonl`), which `uninstall` removes with the rest of the channel.
The line keeps the commit of the default branch the report read, and the next report lists the
merges that branch gained since that commit, so a pull request fetched after a report is still
shown. A section whose source cannot be read says why in its place, the command exits 1, and
`--mark` then records nothing, since the next report would start after facts this one never
showed.

```console
$ js-harness report
Since 2026-10-19 19:59Z, the last 24 hours: no report is recorded

Landed on origin/main: 9 pull requests
…
  #478 fix/notify-worktree-title  merged 2026-10-20 11:42Z
      - fix(notify): read the title of a session opened in a worktree
      - docs(notify): record the reviews of the worktree title fix
…
Sessions: 8 wrote notices
…
  JH 35 · notify title from worktree sessions  closed 2026-10-20 11:39Z  (2 notices)
      JH 35: PR 478 ready (notify reads titles of worktree sessions; heldWork takes the session's own close). Follow-up proposed: board and transcriptNamed.
…
Questions: 10 answered, 1 open
…
Map: docs/ROADMAP.md on origin/main  80/85  94%
…
  [ ] Onboarding  1/2  50%
      - Design, past its two readers: the interview, the pre-plan, the plan and the roadmap it writes
```

With `--mark`, the same report ends in one more line, `Recorded this report at <time>`, and the
next report starts at that time, and at that commit for merges.

### js-harness throughput

The throughput review's measure: a fixed table of a window of UTC days, by default yesterday,
where every row names the record it was read from and a fact no record holds yet says which
recorder it waits for, never a zero; a record that could not be read, a git process that failed
included, is named on its row with why. The tasks are each commit of main compared with the one
before, as `progress` compares them. It is read-only and fetches nothing: main is `origin/main`
as last fetched (`git merge-tree`, which names the files of a conflicted merge, writes objects
into the object store). The gates are every project's on the machine, as the gate lock is.
`ready to merged` runs from the newest ready notice naming a pull request (`notify --kind ready
--pr`) to its merge, `land phases` reads the merge queue's land record, and `red tests on CI`
and `CI fallbacks` read the gate log's lines of gates sent to GitHub's machines; a day before
the recorder of a row reached main says `not recorded` on that row, since nothing wrote a line.
`test files` reads the time of each test file from the local gates that traced their tests
(exact tests on), kept beside the gate log in `test-times.jsonl`; a day kept from copies of the
gate log has no times and says so. `gentle-ai reviews` counts the reviews gentle-ai acknowledged from the
records it keeps in the git common folder, so it reaches back before the row existed; when each started is
kept by the pause hook while the review runs, from the first tool call that sees it, so a day before this
machine began recording them says `started not recorded`. `uninstall` keeps those starts with the snapshots.
`questions` reads the channel's question notices to the answer or withdrawal that closed each, numbered as the
board numbers them: how long an answer took to be relayed, and, from answer notices that keep them, when the
question was shown and answered.

```console
$ js-harness throughput --since 2026-10-16 --until 2026-10-17
Throughput  2026-10-16 to 2026-10-17 (UTC, until excluded; local UTC-05:00: 2026-10-15 19:00 to 2026-10-16 19:00)  D:\js-harness
  gates: every project of this machine, as the gate lock is; the other rows: this project
  2026-10-16  snapshot
pull requests merged         94 (3.92 an hour); merged twice: #292, #305  [git log of origin/main as last fetched]
ready to merged              not recorded: 2026-10-16 (before B1, 2026-10-17)  [the newest ready notice naming the pull request on the channel (notify --kind ready --pr) to its merge commit on origin/main]
lock busy                    16.8 h of 24 h; by kind: check 125 / 446 min, land 65 / 230 min, copy 49 / 150 min, run 39 / 111 min, commit 25 / 70 min  [the gate log (~/.js-harness/gate-log)]
commit gates                 here: median 200 s (150), lock free median 217 s (52); GitHub: median 144 s (75)  [the gate log (~/.js-harness/gate-log)]
lands                        65, median 216 s, red 8; 65 gates for 49 lands  [the gate log (~/.js-harness/gate-log)]
…
```

The gate log rotates in about two days, so `throughput snapshot [--day <day>]` keeps a day's
gates under the home (`.js-harness/throughput/<project>/<day>.json`) once the day has settled,
two `gate-max` after its midnight, and the table reads a kept day from there. Main's history,
the Codex runs and the channel are append-only and always read live. A kept day is written
again only by a fuller one, the replacement recorded; `--gate-log <file>` (twice at most) reads
archived copies of the log instead, for a day the live log has lost; a copy made before the day
settled may lack its last gates, so the day is kept as partial until then. A copy is made no
earlier than its modification time; one that kept its source's time (`cp -p`) says when it was
made with `--copied-at <YYYY-MM-DDTHH:MMZ>`, never a time after now. `throughput status` lists
the kept days and exits 1 naming each day since the first one kept that has none, or that none
is kept at all, since a project whose snapshots never ran must not read as fine. Uninstall
leaves the snapshots in place.

`status` then prints a `DUE:` line for each review owed, which changes no exit code. The review
of the last settled day is due a day after the last one recorded; once the last
`throughput-quiet-runs` reviews found nothing it is due `throughput-quiet-days` after it, and one
that finds candidates makes it daily again. `throughput reviewed --day <day> --found
nothing|candidates` records a review, `throughput shipped <item> [--day <day>]` records a change
that shipped, and each ship day owes a re-measure of the `throughput-compare-days` after it
against as many before, everything shipped that day compared together, until `throughput
reviewed --shipped <day>` records it. The outcomes go to `outcomes.jsonl` beside the snapshots.

```console
$ js-harness throughput status
2026-10-15  kept
2026-10-16  kept
DUE: throughput review of 2026-10-16: js-harness throughput --since 2026-10-16 --until 2026-10-17; js-harness-protocols section 7; then js-harness throughput reviewed --day 2026-10-16 --found nothing|candidates
```

`--against <since>..<until>` compares the window with an equal window before a change, row by
row, daily value with daily value. The gate-wait median moved from 216 s to 69 s from one day to
the next with nothing shipped, so with fewer than `throughput-compare-days` days a side it prints both and how often the median of
a window that did not change falls outside the before range, and judges nothing; from `throughput-compare-days` days a
row moved only when the after window's median lies outside the before range, which an unchanged
window of that length does 7% of the time. The window before must end by the one compared.

```console
$ js-harness throughput --since 2026-10-16 --until 2026-10-17 --against 2026-10-15..2026-10-16
Throughput compared  before 2026-10-15 to 2026-10-16, after 2026-10-16 to 2026-10-17 (UTC days, until excluded)  D:\js-harness
pull requests merged                     before 80      after 94      not judged: 1 days a side, under 7; with nothing changed, the after median falls outside the before range 100% of the time
lock busy, h                             before 14.3    after 16.8    not judged: 1 days a side, under 7; with nothing changed, the after median falls outside the before range 100% of the time
…
```

### js-harness stretch

A stretch of work, planned and measured from the records (`odd/tasks/stretch-protocol.md`): most
often the hours the user is away, but any stretch the lead plans. `stretch open --plan <file>`
reads a JSON plan: `hours`, `slots` (work sessions at once), `goals` (each a `text` and a
`command` that exits 0 when it is met, so no goal is graded by the session that ran it), `items`
(each one session's work: a `title`, a `kind` of the task contract, `hours: [low, high]` left,
its `session` label once it has one, and `waitsFor` when it cannot start without the user) and
`waits`. It records the plan and prints the departure: each estimate as written and as the last
closed stretches correct it (the median of real over estimate, the kind's own from three items,
else every kind's), the items in lanes, and whether they fill the hours or how many
session-hours sit idle from which hour.

`stretch status` measures the open stretch from the records: an item runs from its session's
first record (or the opening) to its first `closed` notice, its removal from the background
record, its last record once it is silent past `session-stall`, or now; its lost time is its
session's failed gates inside that span, a nested gate folded into the one around it. The
stretch itself carries the failed lands, their failed gates and the failed Codex runs. What no
record holds (a rewrite after a review, a wait for an answer) is named as not measured. `status
--goals` and `stretch close` run the goals, one at a time in the main checkout; `close` records
each item's estimate, real and lost time, which the next `open` learns from. `stretch bind <item>
<session>` names a queued item's session once it starts. `--json` prints the view and `--html
<file>` writes it as the Spanish fragment the lead shows in the chat. The record is
`.js-harness/throughput/<project>/stretches.jsonl` under the home, which `uninstall` keeps.

```console
$ js-harness stretch open --plan plan.json
stretch 2026-10-28T12:00:00.000Z: 8 h, back at 2026-10-28T20:00:00.000Z
queued 6-9 h in 2 lanes; 10 session-hours idle from hour 2
  W1 registros (build, JH 69): 2-3 h, corrected 2-3 h
  W2 documentación (docs): 4-6 h, corrected 4-6 h
  goal G1 PR 630 en main: git merge-base --is-ancestor 79e3430 origin/main
```

### js-harness contract

Task contracts: `template` prints the skeleton a feature document opens with, `check`
validates every contract, `run` runs a contract's done-when commands, and `goal` prints the
`/goal` condition that runs them. Each task names its kind of work, `(kind: design | build |
verify | docs)`; `modes` prints the effort and sub-agent models each open task calls for, from
the project's rules (`--task <id>` for one), and `goal` prints the same lines on stderr. `check`
takes files to validate in place of all, `run` takes `--timeout <minutes>`, and every verb but
`template` takes `--cwd <dir>`.

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

### js-harness summary

Prints the summary a work session leaves when it finishes, the file the lead reads before it archives
the session. It is kept to reverse-engineer how the work went later, so each section holds facts with
their evidence (a pull request, a commit, a `path:line`, a command and its output), not prose: the goal
and the opening, the user's words that started it, what was delivered, the decisions and whose they
were, what failed and what was learned, what is left and who holds it, and the cost.

```console
$ js-harness summary path --title "JH 24 · gate más rápido"
docs/sessions/2026-10-17-jh-24-gate-mas-rapido.md
$ js-harness summary template --title "JH 24 · gate más rápido" > docs/sessions/2026-10-17-jh-24-gate-mas-rapido.md
```

The file is named by the day and by the title's letters and digits, without accents, as the
session's opening is. The session fills every section, commits and pushes the file, and closes with
it (`notify --kind closed --summary`, below).

### js-harness failures

Reads the register of what went wrong, `docs/FAILURES.md`: the totals, the count by class and
one line per failure, the most seen first. `failures <id>` prints one entry; `failures check`
exits 1 when the register is malformed, and with `--settled` also while a failure is not settled: one
repeated with no control, a control owed that is stale, a control lost or seen again, or a measurement
lost or seen again. It only reads: the register is written by hand.

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
`docs/RULES.md`. `rules applied` says what each model alias gave in the records of the last seven
days. `rules change <id>` is the one command that changes a rule of the harness: in its own checkout,
on a `rule/` branch, it takes the change as JSON on standard input and writes the declaration, its
source and `docs/RULES.md`, and appends a relief line; `--dry-run` prints them and writes nothing (it
fetches nothing either: a turn to refuse counts on the `origin/main` this clone holds, and says so), and
`--check-source` checks a stored source against its transcript again. In a project that installs
the harness, the project's own rules in `docs/rules.json` are listed too, and `rules check` holds
them: each phrase still in its file, each sensor still declared, no rule deleted since HEAD.

```console
$ js-harness rules codex-review-floor
{
  "id": "codex-review-floor",
  "subject": "the most input tokens a Codex review may cost however small its commit",
  "owner": "sebastian",
  "scope": "repository",
  "since": "2026-10-11",
  "value": 300000,
  "unit": "input tokens a review",
  "patterns": […]
}
Read by: bin/lib/codex-review-allowance.mjs
…
$ js-harness rules check
PASS  rules  40 rules, hash 4a95a3907229
```

`rules --hook` is the turn-start hook of the rules (letter F of `odd/tasks/rule-hierarchy.md`). `install`
registers it for Claude Code three times: on `UserPromptSubmit`, on `SessionStart` for the
matcher `compact|clear|resume`, and on `SubagentStart`. Where the project declares rules
(`bin/lib/rules-data.mjs` in the harness's checkout, `docs/rules.json` in a project), it
compares the list at the session's merge base with the list on the default branch
(`origin/HEAD`, else `origin/main`, else `main`, never fetched). It tells the session, once,
each rule that was added, removed, retired or changed, with the new declaration itself. After a
compaction or a resume it tells it again, and a sub-agent is told at its start. A clear does not
reach this retelling in the desktop app: its clear starts a new session, which the hook receives with
the source `startup`, and the matcher `compact|clear|resume` does not name that (measured 2026-10-18). Anywhere
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

Codex gets the diff, the repository to read and the project's `AGENTS.md`, and none of your Codex
configuration; the command fixes the model and its effort. Markdown files and the paths a
`.gitattributes` marks `-codex-review` are left out, and the plan says how many. A run starts where
the records end: commits a record covers are not reviewed again, and `--again` takes the range as
given. A run of more parts than `rule:review-parts-unflagged` is not started without
`--max-parts <n>`; `--part-lines <n>` sets how many changed lines a part holds at most, in place of
`rule:review-part-lines`; `--fresh` reviews again the parts an earlier run of the
range passed; `--keep-home` leaves the run's Codex home in place. `--prompt codex|own` picks the
prompt (`codex` is the default in a turn of the gate lock, and a run by hand asks with `own`), and
`--doc <feature document>` judges the change against that document's Goal and Done when, with
`--prompt own`.

A merge of the default branch is reviewed by what was written in it, not by what it brought in, and
so is a merge of a stacked base: a branch off the default branch each of whose own code commits has
a record. At HEAD that is one review. Below HEAD, after code commits that each have a record, the range is cut
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

### js-harness codex-meter

Reads Codex's five-hour and weekly limits and the reset credits left, from the local `codex app-server`.
The server answers the read without running a model, so it spends no tokens; each read starts one
process and kills it after. `--json` prints the numbers. A field the answer does not hold is shown as
unknown, and a failed read (no `codex` on the PATH, no answer within 15 seconds, an error answer, or a
process that exits first) says so in one line and exits 1. A usage error exits 2.

```console
$ js-harness codex-meter
five-hour: 3% used, resets at 2026-10-24 06:01
weekly: 8% used, resets at 2026-10-30 13:38
reset credits left: 1
```

### js-harness lens-review

The Claude half of the two reviews every slice gets; Codex is the other. The session picks one to four
lenses (risk, resilience, readability, reliability) by the consequence of what `<base>..HEAD` touched
(`--head <rev>` names another head) and says why with `--reason`. Each lens is a fresh `claude -p`
run on the `sonnet` alias with no tools and none of your customizations, on your own CLI login,
never on the eval token or an API key, and it reads only the range as a block: its two commits, its
subject hash, the paths a review reads and each path's patch. Markdown files and the paths a
`.gitattributes` marks `-codex-review` are left out, as Codex leaves them out.
A result counts only when it echoes the hash and inspected every path; otherwise the run is recorded
as incomplete, exits 1 and covers nothing, and the start of an answer it could not read is kept and
printed, so why it failed is read before it runs again. Runs are recorded in `<git common dir>/js-harness/lens-reviews.jsonl`.
`--plan` prints the candidate and starts nothing; `--unavailable <reason>` records a skip, which the
push lets through and `check`, `doctor` and `merge-queue` list until a review covers the range. The
two do not go together.

```console
$ js-harness lens-review --base 3f2a9c1 --lenses risk,reliability --reason "changes how a record is validated"
risk: complete, 0 findings, 9120 input and 410 output tokens
reliability: complete, 1 finding, 9120 input and 650 output tokens
  WARNING bin/lib/a.mjs:40: an empty list is read as valid
```

### js-harness windows-daily

The gates run on Linux, so the whole suite also runs once a day on GitHub's Windows machines
(`.github/workflows/windows-daily.yml`: at 07:23 UTC and by hand with `gh workflow run
windows-daily.yml`, never for a push or a pull request, so it holds up no gate and no land; free on
a public repository). This command reads the newest completed run on the default branch of the
GitHub repository `origin` names and says whether it passed. A red run (`failure`, `timed_out` or
`cancelled`) not told before is told to the orchestrator once, with the run's address, how many
tests failed and their names, unless every file it failed in has a current entry in
`docs/FLAKY.md`; a red run whose names cannot be read is told all the same. A schedule whose newest
run ended more than 26 hours ago is told once too: GitHub drops scheduled runs under load and
switches a schedule off after 60 days with no activity. Each run is told by whoever first creates
its marker under `.js-harness/channel/windows-daily/` in the home, so the heartbeat and a hand run
never both tell it. The lead's `js-harness loop heartbeat` reads it every hour.

```console
$ js-harness windows-daily
windows-daily: the newest run, https://github.com/jsaristi/js-harness/actions/runs/39007607383, failed (failure, ended 1 h ago), 168 failing: in shadow the gate traces its suite under the git dir and its end line keeps the counts; …
WINDOWS: https://github.com/jsaristi/js-harness/actions/runs/39007607383 failure, 168 failing: in shadow the gate traces its suite under the git dir and its end line keeps the counts; …
```

### js-harness merge-queue

Builds the candidate the default branch would be: origin's default branch with each ready pull request
merged into it in order of number, and names each one it leaves out and why. The default branch is
the one origin's HEAD names, else the one `gh repo view` names; when neither does, the queue refuses
and names both commands, so a project whose default is not `main` lands on its own branch.
Ready means the pull request is open, not a draft, mergeable, based on the default branch and with a
gentle-ai line in its body, has a Codex review record and a complete Claude lens record (no lens skip) for every code commit, and merges into the
candidate so far with no conflict; one whose mergeability GitHub has not computed yet is decided by
its merge into the candidate. Each pull request merged into the candidate passes main's rule rows
first (`check --door`), and one that fails leaves the batch. `--dry-run` prints it and pushes nothing. `--land` tests it, the whole suite on
this machine under the gate lock and, at the same time, on GitHub Actions (`.github/workflows/gate.yml`) on a
`queue/*` branch pushed before the suite starts, so the run's checkout is the candidate, main as it would become, and when both are green moves the default branch to it by fast-forward, leased on the commit it was built from (odd/tasks/merge-queue.md).
After a land, each open pull request whose base is a branch that land merged is retargeted to the default branch
(`gh pr edit <n> --base`), so the next land takes it as a candidate; a retarget gh refuses is named, and the land still exits 0.
A candidate whose every changed path is a document main's `harness.json` declares (`documents`) runs
no suite on this machine, as a commit of documents alone runs none, and takes no turn of the gate
lock: the GitHub Actions run of the whole gate is its test.
No GitHub workflow runs for a pull request: the gate workflow runs for a push to a `gate/` branch (a
commit's gate, `js-harness check`) or a `queue/` branch (a candidate) alone.
A candidate red on this machine is bisected: the pull request that turns it red is left out and
named, and the rest is landed. The land asks `js-harness gate first` for a ticket of the running
session, so its gate goes first in the line; with no session id or a refused ticket it waits its turn
and says so. A gate that ran nothing (no turn in time, or a waiting push took it) or was stopped
before it ended is no red: the land exits 5, with main not pushed and nothing bisected
(`odd/tasks/land-unattended.md`). A land exits 0 landed or with nothing to land, 4 red, 3 when main
moved meanwhile, 5 when the suite did not run or GitHub Actions gave no result in 30 minutes (main
not pushed in those three), and 1 for anything else. A landed pull request whose branch moved during
the land is named after it: its new commits are not in main, so it needs another run of the queue.
The `queue/*` branch is removed as soon as its answer no longer
matters: when the candidate is red or untested on this machine, or once GitHub Actions answered. Starting
the run with the suite saves the minutes the two took in series; its cost is one GitHub Actions run spent
on each candidate this machine turns red or does not test, since removing the branch does not
cancel its run. A land killed before it ends leaves its `queue/*` branch on origin, to be removed
by hand. A `--land` run from a copy whose `bin/` is not origin/main's, after its fetch (any file that
differs, line ends aside, or is on one side only), names those files and stops before it builds anything,
exit 1: it would land with code main no longer has. The pre-push hook refuses every other push of main from a clone; a
merge made on GitHub's side does not pass through it.
`--land --refresh-copy` also refreshes the installed copy the hooks run, after a land that moved main, in place of the
lead's hand scripts: under the gate lock, the Claude settings are backed up (the newest five kept under
`<home>/.js-harness/refresh-backups`), main is installed by its sha with `pnpm add -g` in up to three tries, and the copy
is verified by its `--version` and by the sha its shim names. Then `js-harness install` and `js-harness doctor` run, and
stale pnpm state is pruned (folders no link or shim names, and old bin backups; nothing while a pnpm runs). The undo is
printed: the previous sha, the settings copy and `js-harness uninstall --global`. A land that moved nothing refreshes
nothing and says so. Exit 6 when the copy is not verified or a step after the install fails, 75 when the gate lock was not
obtained; the landing itself stands. Only pnpm installs the copy this way.
Each `--land` appends one JSON line to `lands.jsonl` under the git directory's `js-harness` folder:
the pull requests it looked at, each one left out with its reason (`not-ready`, `review`, `door`,
`conflict`, `merge` or `red`, with what the suite said), the start and seconds of each suite run,
of GitHub Actions (from the push of the `queue/*` branch, so it spans the local suite; `circleci` in a
record before 2026-10-27) and of the push, the GitHub Actions run, what landed and the exit. A `--dry-run` writes none,
and a record that cannot be written is said and changes no exit.
A land also tells the work session of each pull request it left out why, with the failing tests of a red
as the gate log names them, by a note to that session's number in the channel, which ends its
`js-harness wait`. The session is the one whose newest `ready` notice names the pull request
(`js-harness notify --kind ready --pr <n>`); one that sent none is not told, and the lead relays it. The
same reason is told once for one ready notice. Each left-out entry of the record keeps the failing
tests of a red (`failing`) and the number of the session told (`told`, or `null`).
After it lands, a land removes the worktree of each pull request it landed, with `git worktree remove` and
never `--force`, when nothing in it can be lost: its head is in the main it pushed, `git status` shows
nothing, ignored files included (the removal takes them, and no branch brings them back), its index has
not changed for 10 minutes, and it is neither another app's (the Claude app's under `.claude/worktrees`,
the Orca app's under `orca/workspaces`, which those apps manage), the main one, a locked one nor the
one the land runs from. The branch stays, so `git worktree add` brings it back; the record names each one removed (`removed`, each `{ pr, path }`). A session still open in such a
worktree that staged nothing for 10 minutes is not seen: on Windows the removal of a folder in use fails
and is said; elsewhere the session loses its folder.
`--prune` removes by the same rule every worktree on a branch origin/main holds, whatever landed it, after
a fetch; it asks about no pull request, moves nothing and writes no record. `js-harness doctor` counts
those worktrees in its `worktrees` row, a gap that names `--prune` and each one; its hook, run at every
session start, does not count them, since that asks a `git status` of each. Each git call of that count
stops after 20 seconds, as the heartbeat bounds its commands: a worktree whose git hangs is not counted.

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
gate. The daily Windows suite (`js-harness windows-daily`) runs them once a day on GitHub's Windows
machines. That run was chosen over one after each landed batch, which would hold the gate lock 15 to
19 hours a day (docs/ROADMAP.md, "Windows suite"); it cannot see this machine's antivirus, its
temporary folders or its paths. To reproduce a red daily run here, or to test a change to the
Windows paths before it lands, run the whole suite once on Windows, in a lock turn, with the
temporary files inside the drive the antivirus excludes:

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
value here and why. `doctor` follows them: where `languageServer` is off it shows no row for the
TypeScript plugin, and where `codexReview` is off no row for Codex. `pushUnasked` says whether a
session pushes without asking: a project that says nothing is asked before each push, and the
switch is turned on by its owner (js-harness declares it on). `lensReview` says whether a code commit
asks for a Claude lens record (`js-harness lens-review`) at the push: a commit is asked only where its own
`harness.json` turns it on, which a project that says nothing does not (js-harness does).

```console
$ js-harness functions
codeMap         off        auto: no file of the project is a program
languageServer  off        auto: no file of the project is TypeScript
codexReview     off        auto: no file of the project is a program
pushUnasked     off        auto: the project asks until its owner turns it on
lensReview      off        auto: a commit asks for a lens record only where the project turns the lens review on
```

`js-harness functions apply` makes this clone what the switches ask: the code map index, the
pre-push check, and the keys of `.claude/settings.local.json`, each recorded in the project manifest
so `uninstall` undoes it. It needs no pin. `js-harness functions set <name> <value>` writes one
switch into `harness.json` and applies it: `codeMap` takes `auto`, `on-demand`, `always` or `off`;
`languageServer`, `codexReview`, `pushUnasked` and `lensReview` take `auto`, `on` or `off`. `--json` prints the list and `--cwd
<path>` names another project. A `--cwd` with no path, or followed by another flag, exits 2 with `--cwd requires a value`.

### js-harness remote

Keeps Claude Code's remote-control server running for this git repository, so the Claude app
can start sessions here: `start`, `stop` and `status`. `start --at-login` also starts it at
every Windows login, through a launcher in the Startup folder that opens no window, and registers
a scheduled task that starts it again within five minutes whenever it is not running; it replaces the
`.cmd` launcher of an earlier version, which opened a console, when js-harness still recorded writing
it. The server pre-creates no session, so a restart adds no row to the app's sidebar; `status`
reads its `Ready` as connected.

`start` also takes `--name <name>`, `--permission-mode <mode>`, `--spawn same-dir|worktree|session` and
`--watchdog`, which is what the scheduled task runs: it starts nothing when the server was stopped
with `stop` or already runs. `stop --at-login` removes the login launcher, an earlier `.cmd` one
too, and the scheduled task. A
server stopped with `stop` stays stopped until the next `start`. It runs on Windows only.

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
requests and whether a memory hygiene pass is due. It only reads. A session is listed when its
transcript changed in the last `--hours` (12 by default), and also, up to seven days back, when its
last call has had no result for 15 minutes: a session the host holds on a card writes nothing, and
the board keeps it with the line that the host may be holding it for approval. `--watch` waits until the board changes in a way that needs a
decision; `--address <role>` prints the title of the session that holds a role; `--quote
<transcript> <line>` prints one message the user sent; `--measures` prints, for each compaction
the host made, whether the session was told the pause and committed its feature document (the
orchestrator may write a line in its relief file instead), and how many compactions miss one of
those facts (nobody announces a compaction: he does not compact by hand); then the reliefs of the record (each `relieved` notice, judged by the context its relieved session was at: filled at the pause or another reason) and the Log lines that name a reopening, as candidates for the lead. Under each roster row's
mode line, a line says how its session was opened, where the desktop app keeps it and its effort,
and marks a session outside his sidebar (in Routines, or not in the app) and an effort below `high`.
A session that closed with its summary (`notify --kind closed --summary`) and is not archived yet
gets a `to archive:` line naming the file: the lead reads it, then archives the session, first
turning its Remote Control off when the host refuses it as live work. A session that closed or
was relieved while its Claude Code host process still runs (the process whose command line has
`--resume=<its id>`) gets a `closed but still running:` line with that process's pid: the desktop
app holds it as running and refuses to archive it until the process ends, so the lead stops its
turn or ends the process, then archives it. The board reads the hosts from the same process
listing as the gates, and says so when that listing could not be read.

Two more blocks follow the roster. `stalled` names a work session the orchestrator handed work to
that has gone quiet (no commit, notice or gate for the rule `session-stall`'s minutes, and no
`waiting`, `closed` or `relieved` notice). `questions` lists the questions put to the user that
have no answer of his yet, read from the transcripts and joined by number to the channel record's
`notify --kind question` notices. `--json` gives the same data as the board. `--opening "<title>"`
(or `"<code> <role>"`) prints the opening stored for a session and records which session read it;
a session keeps the title of its first reading, and `--peek` reads an opening and records nothing.
`--address` and `--opening` exit 0 for one session, 1 for none and 2 for several or when they cannot
tell. `--next-number` prints `<code> <n>`, the title number of the next work session, one past the
highest of the project's code in the channel and the openings (exit 1 when the project declares no
code). `--watch` also returns at `--timeout <seconds>`, looking every `--interval`. The context
figures are measured against `--context-window`, with the pause at `--context-pause`
(`rule:context-pause` by default) and the host's compaction at `--context-compaction`.

`js-harness sessions start --title <title> --brief <file>` starts a work session in the background
with `claude --bg`, from any turn: the desktop app's `start_session` starts one only on a turn the
user typed, and leaves a card the user must tap on a turn a notice or a compaction started. The lead uses
it only there, since a background session is not a row in the user's sidebar; Remote Control is on unless
`--no-remote-control`, so claude.ai/code and the user's phone reach it. The session reads a copy of the
brief under `~/.js-harness/background/briefs/` that ends by telling it to report through
`js-harness notify --to orchestrator`; `--worktree <name>`, `--model` and `--effort` go to `claude`,
and the title and effort are held to the rules `session-title` and `session-effort` where they are
declared. Each start is recorded in `~/.js-harness/background/sessions.jsonl`: `js-harness sessions
stop <id>` removes a recorded session (`claude stop`, then `claude rm`; its transcript stays) and no
other, and `js-harness uninstall machine` removes every recorded one that is not at work and fails
while one is. The board's `Background sessions` block lists the project's background sessions from
`claude agents --json --all`, what each waits for (a permission prompt included) and whether `start`
recorded it; `--watch` returns when one starts waiting.

```console
$ js-harness sessions start --title "JH 45 · thing" --brief brief.md --worktree thing --effort high
started 0db8bc5e · JH 45 · thing
  js-harness sessions stop 0db8bc5e removes it; claude attach 0db8bc5e opens it here; js-harness sessions lists it
  Remote Control is on: claude.ai/code and the user's phone reach it
```

```console
$ js-harness sessions --address orchestrator
js-harness sessions: no sessions folder for my-project: …
```

`js-harness sessions live` feeds the live board, an Artifact page whose shared database the user
watches as it updates (rule `live-board`). Its rows are the notices of the channel record, the
ones `notify`, the merge queue and the permit hook already write: each one's time, session, kind,
text and the state its kind gives. With no flag it says how many rows the board has not been sent;
`--out <dir>` writes them as batch files, one database document of the `events` collection each,
and prints the `ArtifactData` set that sends one; `--sent <file>` moves the cursor past that file.
`--out` also writes `board-checked.json`, the time it read the record, with the `ArtifactData`
update that merges it into `board/summary` once every batch was sent, with no row to send too: a
quiet stretch has no new notice, and the page counts that check to tell it from a record nobody sent.
A check holds 45 minutes, the lead's heartbeat; `--resting`, the run before the lead's resting
wait, makes it hold that wait (`wait-for`) and the page reads the board as resting.
The cursor goes by each notice's place in the record, not its time, so a notice stamped before a
later one but appended after it still waits. Only a Claude session can make that call: no command or hook reaches an artifact's database. The
cursor and the board's link (`--url`) are kept in `~/.js-harness/channel/live/`, which `uninstall`
deletes with the channel. The page's source is `docs/live-board.html`.

```console
$ js-harness sessions live --out live --url https://claude.ai/artifact/…
3 rows wait for the live board
board: https://claude.ai/artifact/…
ArtifactData set: url https://claude.ai/artifact/…, collection events, doc_id 2026-10-27T05:23:50.996Z-62656cd8, file_path …/live/live-2026-10-27T05-23-50.996Z-62656cd8.json
  then: js-harness sessions live --sent …/live/live-2026-10-27T05-23-50.996Z-62656cd8.json
ArtifactData update: url https://claude.ai/artifact/…, collection board, doc_id summary, file_path …/live/board-checked.json
  once every batch above was sent: the board reads it as the time you checked the record
```

### js-harness unseen

What the desktop app opened for this project out of his sidebar: an enabled scheduled task whose
folder is this project (the app runs it in Routines), and a session a schedule opened that sits in
Routines and is not archived. Each one to clear is named as `FAIL`, and the command exits 1. A
disabled task, a leftover scheduled-task folder, and a session a command opened (`js-harness remote`)
are `INFO`. A location it cannot read (a folder or file that is there and fails to open, not a missing
one) is a `FAIL` too, since what it holds is then not known. It only reads; `doctor` reports the same count as its `unseen` row. `--records-only` reads
the app's session records and no transcript, which is the fast path `doctor` uses at each session start.
`--hours <n>` sets how far back the sessions are read: 168 (a week) by default. `--json` prints the items.

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
yet in a folder that holds a note (a new project's empty folder is not due), the index over its
budget (rule `memory-index-bytes`), a line over the host's 150 characters, a
link to no file or a note with no line, a rule note written since the last pass, or the cadence (rule
`memory-pass-days`) passed since it with notes written since. `js-harness rules <id>` prints each value.
It reads the main checkout's memory folder, so a worktree sees the same notes, and exits 1 when a
pass is due. `memory plan`, `memory verify` and `memory undo` make a pass safe: a lock, a snapshot
of the folder and a journal under `~/.js-harness/memory-hygiene/`, a check that no quotation of the
user is lost and no file another session wrote is overwritten, and an undo that puts back only what
nobody wrote since and refuses while another pass holds the lock. `uninstall --global` removes that
folder, except a project's folder that holds snapshots: they are the only copy of what a pass changed,
so it is kept, with its journal, and its stamps are named; `uninstall --global --full` removes them
too. Neither removes a project under a pass. The steps of a pass are in the installed `js-harness` skill, "Memory hygiene".
`memory status --json` gives the same data and `--history` the index bytes of each verified pass;
`memory verify <stamp> --approved <note>,...` names the notes the pass may delete.

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
main checkout and each worktree and keeps no text of any message; Codex is not counted. `--day
YYYY-MM-DD` names the day (today by default), `--days <n>` reads up to 7, `--json` gives the data
and `--cwd <dir>` names another project.

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
the main checkout and each worktree and prints no text of any message. It takes the same `--day`,
`--days` (up to 7), `--json` and `--cwd` as `subagents`.

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

A session's title names the project whose lead counts it. A session titled with another
project's code (`harness.json` "code"), such as one a lead starts in a new project to onboard it,
records its notices where that lead listens: in the record of the project that declares that
code and from whose folders an orchestrator of that code last wrote (a folder of a worktree
removed since is passed over), and a line after the confirmation says so. When no record, or more than one, holds such a notice, the notice is refused with exit 1 and
nothing written; `--cwd <that project's folder>` sends it there. A project with no code, or whose
`harness.json` cannot be read, keeps its notices. Sent with `--cwd`, the sender is still read
where it runs.

A pull request ready to land is announced with `--kind ready --pr <number>`: the record keeps
the number, and the board shows it ("ready for pull request 344"), so the land can tell which
session a pull request belongs to from the record, even when the notice was sent from `main`. It
is refused with exit 1, and nothing written, while the land would leave that pull request out: its
state, its body's gentle-ai line, its reviews.

A session gives its work back with `--kind closed --summary <file>`, the summary it leaves
(`js-harness summary`, above): the record keeps the file, and the lead reads it before it archives
the session. The notice is refused, with exit 1 and nothing written, while a section of the file is
missing or empty, or while neither origin's default branch, origin/main nor the session's branch on
origin holds it as it is in the worktree: commit it and push it first. A closed notice without
`--summary` is a usage error.

A question for him is recorded with `--kind question`, its fields as one JSON object on standard
input (`text`, `options` and `waits`); the record numbers it, and the board asks the user with its
text headed by "Pregunta <n>: ". An answer names its question with `--question <n>`, and a
`withdrawn` notice does the same. An answer takes `--transcript` and `--line`, where his words are
read: an answer read at its line is verified, and one with no transcript is recorded unverified,
and that is said.

`--relief "<one line>"` appends a dated line to the orchestrator's relief file, and `--opening
"<title>"` stores the opening of a session, its text read from standard input, so the session can
read it back with `sessions --opening`.

The record stamps every notice with the clock, so the text needs no hour. A text that opens with
one as its sending (`19:48 JH ORQ: …`, or after the label, `JH 5, 19:48: …`) more than a minute
off the clock is refused with exit 1, the right hour, and nothing written. An hour after a colon
is an event (`JH 5 · canal: compacted at 18:46`), and an answer, which quotes his words, is not
held to it.

### js-harness permit

The host asks the user before some tool calls even in bypass mode, and a session that meets such a card waits
in its own window until the user answers it there: on 2026-10-17 five sessions waited 12 to 38 hours. The host
gives a session no tool to answer another's card; a `PermissionRequest` hook is the one way, and `install`
registers `js-harness permit --hook` as that hook in Claude Code's settings (600 s timeout; `uninstall` removes
it).

While the orchestrator holds the relay, a card of another session reaches it first:

```
$ js-harness permit lease            # the orchestrator, at its start (40 minutes; its wait renews it)
$ js-harness permit list             # the waiting cards: id, time left, session, tool, command
$ js-harness permit allow p1a2b3c4d5
$ js-harness permit deny p1a2b3c4d5 --reason "its work merged in PR 305"
$ js-harness permit lease --off      # before the orchestrator is relieved
```

The hook records the request, tells the orchestrator by a `permit <id>` note in the channel and waits up to
570 seconds for a verdict. An allow lets the call run; a deny refuses it with the orchestrator's reason, which the
session reads. With no verdict in time, with no orchestrator holding the relay, for the orchestrator's own cards,
or on any failure, the hook answers nothing and the card reaches the user as before. Nothing is allowed by a rule:
only by the orchestrator's verdict, and a `deny` rule in the settings still wins over an allow. `allow` and `deny`
answer only when the session that runs them is the one holding the relay, never the session that asks; a lease
another session holds is replaced or ended only with `--take-over`, as a new orchestrator does.

That check is a convention between cooperating sessions, not a credential. It compares the caller's
`CLAUDE_CODE_SESSION_ID` with the session `lease.json` names in plain text, and every process of the user can read
that file and set that variable, so any of them can give a verdict. No local secret would change this: what one
of the user's processes can write, any other can read. The relay keeps cooperating sessions from answering each
other's cards by mistake; it does not hold off a process that means to. Requests, verdicts,
the lease and `log.jsonl`, one line per outcome, live under `~/.js-harness/channel/permits/<project>/`, which
`uninstall` removes with the channel.

Every `permit` subcommand checks each token before it acts: a flag it does not take is refused with
`unknown argument: <token>`, a value flag with no value (or one followed by another flag) with `<flag> requires a
value`, and either exits 2 with nothing written. So `permit lease --of` is refused rather than taking a lease.

### js-harness wake

A boot kills every background command of every session, and the transcripts do not say so: a
wait the boot killed still reads as running. After a boot, `wake` lists the sessions of the
project that were open before it (an entry in the 12 hours before), each with the command that
prints its stored opening and the `js-harness wait` calls the boot killed. With `--notify` it
leaves each session whose title names a role a note, which the inbox hook tells it on its next
tool call: its waits are gone, read the opening, re-arm only its declared waits. The
orchestrator gets the list of sessions to wake with `send_message`, since no command can put a
prompt into an idle session. A second run after the same boot records nothing. `--boot-time <iso>`
replaces the boot the clock and the uptime give. A channel record or
openings folder that is there and cannot be read makes `wake` exit 1: it still lists the sessions, says on
standard error which one it could not read, and records nothing, since an empty read would write the notes again.

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
so `uninstall` removes it; `--at-login --remove` removes it now. The file is a `.vbs` that opens no
window, and it replaces the `.cmd` of an earlier version, which opened a console. A file at that path
that js-harness did not write, or one changed since, is kept.

```console
$ js-harness wake --at-login
wake at login: on (wrote C:\Users\you\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\js-harness-wake-js-harness-0f3a5c2d9e1b.vbs); it runs at each login with no window, and js-harness wake --at-login --remove removes it.
```

### js-harness quiet

Says whether anything still runs on this machine, so the owner can turn the PC off instead of
leaving it on while nothing is left to do. One look reads each source of work the harness knows:
the sessions `claude agents --json --all` lists (busy is work; waiting on a permission prompt or a
question needs you, and is not work), the record of `js-harness sessions start`, the machine's gate
lock (its live holder and the gates that wait for it) and the process listing (a
`merge-queue --land`, a `codex exec` or `codex-review` process). The session that runs it
(`--self`, else `CLAUDE_CODE_SESSION_ID`) is left out. Exit 0 quiet, 1 busy, 3 unknown: a source
that could not be read is never quiet. A session the listing does not show is not seen.

```console
$ js-harness quiet
quiet: nothing runs on this machine; 1 session needs you
needs you:
  session JH 12 · codex hook trust (aa914608) waits for permission prompt in D:\js-harness\.claude\worktrees\wonderful-gagarin-88a4cc
left out:
  session JH ORQ · js-harness (908805db), the session that runs this command
```

`--wait` looks at once, then every `--every` seconds (60), and exits 0 once nothing has run for
`--settle` minutes (10; 0 ends at the first quiet look); a busy or unknown look starts the count
again, and after `--for` minutes (720) with no settle it exits 1 with the last look. The lead runs it
as a background task while the owner is away, and sends him a push notification when it ends:

```console
$ js-harness quiet --wait --settle 10
js-harness quiet --wait: waits until nothing has run on this machine for 10 minutes, looking every 60 seconds; ends then, or after 720 minutes; stop it with TaskStop when it is no longer needed
js-harness quiet --wait: nothing has run on this machine since 03:13, 10 minutes (11 looks); the PC can be turned off
last work seen: session JH 48 · guard behind copy (b7e2c901) busy in D:\js-harness\.claude\worktrees\guard-6b1c (03:12)
needs you: nothing
```

`--json` gives the same data, for one look and for the end of a wait; under `--wait` the line that says
what it waits for then goes to standard error, so standard output is the JSON alone. A process is
work by what it runs, never by an argument that only names a file: a `js-harness wait` for
`bin/codex-review.mjs` on main is no review.

### js-harness wait

Waits in the background for one condition and ends when it holds: a pull request merged
(`--pr <number>`), a commit on `origin/main` (`--main-has <commit>`), a text in a file of
`origin/main` (`--main-file <path> --contains <text>`), or a notice addressed to a role or a work
session's number in the channel record (`--notice-to`). It says at start what it waits for and
what ends it, so a session keeps working instead of ending its turn to wait. It checks at once,
then every `--every` seconds (`rule:wait-every`), and gives up after `--for` minutes
(`rule:wait-for`). Exit 0 the condition holds; 1 the time ran out, or the pull request closed
without merging; 2 a usage error; 3 a notice to the session's own number, below.

A wait for a notice to the orchestrator, run by the session that holds the permit relay's lease,
renews that lease on every tick, to the longer of 40 minutes and its interval plus 5, so the
relay does not lapse while the lead waits; it never takes or changes another session's lease.

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

The hook that runs after a compaction or a clear, which `install` registers for Claude Code and Codex.
`resume --hook` reads the hook's input and prints the session's title, its opening, the feature
document it works on and what to read there, so nobody pastes a resume prompt. After a clear it
prints the same lines under a first line that says the session was cleared, with none of the
compaction's: the desktop app starts a cleared session as `startup`, and the hook speaks on that
start only when the app's record of the session names the session it was cleared from. For one document
it names the lines to read, not the whole file: its resume sections ("Next step", "State for a
resume"), the open task the first of them names first, that task's specs and its last log entries,
each range with its size. It writes
nothing and exits 0, or 2 for a usage error. `resume --pause` is the hook of the context pause, measured against the window the host is configured to compact on when a setting gives one (`CLAUDE_CODE_AUTO_COMPACT_WINDOW`, a number or one with a `k` or `M` suffix such as `350k`, else `autoCompactWindow` of the project's `.claude/settings.local.json`, its `.claude/settings.json` or the user's settings), and of the channel's inbox: after a tool call it says once each notice addressed to the session that it was not told yet. After a WebFetch the site refused as AI traffic (402, 403, 429 or 503) it names the next rung, `js-harness fetch`, to a sub-agent too; so it does after a WebFetch that failed as a tool error ("Claude Code is unable to fetch from <domain>"), which reaches no `PostToolUse` hook: `install` registers the same command as a `PostToolUseFailure` entry on WebFetch for that.

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
session, on `Bash`, on `Read`, `Write`, `Edit`, `MultiEdit`, `NotebookEdit` and `Grep`, and on the scheduled-task and cloud tools that open a session
(`create`, `update` and `run` of a scheduled task, and `RemoteTrigger`), and on the desktop app's
`run_in_terminal`. `guard --hook` reads the call on
standard input and refuses these things: a sub-agent launched on a model the project's rules do not give;
a scheduled-task or cloud tool that would open a session where he does not see it, in a project that
declares `sessions-open-in-sidebar`, the reason naming `start_session`, which opens it as a row in his
sidebar, even when he asked for it; a `start_session` with a brief that names no effort, or an effort above the
rule `session-effort` where that rule is declared (a fork included, since it cannot set its own); a `start_session`
whose title is not `<code> <n> · <purpose>` (or `<code> ORQ · <purpose>` for a new lead) with the project's own code,
harness.json `"code"` (`init` offers the initials of the project's name; this repository's is `JH`), where the rule
`session-title` is declared, the reason naming the project's next free number, one past the highest of that code in
its channel and openings, which `js-harness sessions --next-number` also prints, or saying to declare the code where
the project declares none (a proposal started by its `proposal_id` carries no title and passes); a message whose stamped hour, after its label or first before it, is more than a minute off the clock; a command typed into the user's Terminal panel that does not
end with a note saying what it does, `<command>; Write-Host 'NOTE: <what it does>'` (`echo` in an
SSH host's shell), four words or more, so the user reads it beside the command where it runs and
learns from it (his request of 2026-10-19), where the rule
`terminal-note` is declared; a shell command with backticks
inside double quotes, which bash runs as commands; a recursive `rm` or an `rmdir` of a drive's root or a
folder at its top, which the host holds for the user even in bypass mode, with where to put such a folder
instead (below the project's worktrees folder, or the session's scratchpad); a gentle-ai review
(`assess`, `status` or `start`) whose `--base-ref` is off its head's first-parent line; a heavy `node --test` outside a gate turn while
another gate holds the machine's lock or an eval batch runs, heavy being several files, the whole suite (`node --test`, or `npm test` as the `test` script of the folder, or of the one `--prefix` names, runs it with the words npm hands it; `npm run check` is no run of the suite), or one file
the gate log timed alone over a minute (an eval batch marks itself under `~/.js-harness/gate/batches`
while its trials run, and `uninstall` removes that folder with the lock's); a `js-harness sessions` read of the
board, `--watch` too, in the same case, because a board read slows that gate (one entry, such as `--opening`, is
free); a `Read`, `Write`, `Edit`, `MultiEdit` or `NotebookEdit` of a file in a place of secrets
that the denies `install` holds in the Claude settings name (`.env`, `.ssh/`, `*.pem`, `*.key` and
the like), or of Claude Code's login file `.credentials.json`, and a `Grep` of such a file or of the
folder that holds it (`bin/lib/deny-paths.mjs`); and a `Write` or `Edit` that puts a line
over 150 characters, the host's own limit, in a project's memory index
(`~/.claude/projects/<project>/memory/MEMORY.md`, or under `CLAUDE_CONFIG_DIR` when that is set),
which every session reads on every turn; a `Write` or `Edit` that leaves a note of a project's memory folder whose
type is `feedback`, a rule he stated, naming no home of that rule in the repository, where the rule
`memory-feedback-home` is declared (this repository only): the note names `` `rule:<id>` `` of a live declared rule,
or quotes, on a line that names AGENTS.md, a phrase of at least twelve characters that AGENTS.md holds
(`AGENTS.md "<phrase>"`), and the reason says to cement the rule with `js-harness rules change` or in AGENTS.md
first, since a memory note is read by an agent that may or may not recall it; and a `Write` or `Edit` of a Markdown file that brings a
line stamping today's date with an hour more than a minute ahead of the clock, where the line
opens with the date or the date follows "written" (`- 2026-10-14 14:50 — T3 done.` written at
14:44). A document also records earlier events, so an hour behind the clock passes; an `Edit` is
judged by the lines of the file it leaves that were not already there. A
refusal is printed as the hook's deny, with the reason and the right value; any other call runs
as it was. A rule "declared" here is one the project's own `bin/lib/rules-data.mjs` declares: when the
installed copy's list differs from that file, as it does after every landed rule change until the copy is
brought up to main, the copy still holds each rule the project declares, by its own value, and where the
project declares that rule otherwise the refusal ends by naming the update (on 2026-10-23 a copy that held
nothing then let three sessions open with free titles). One more Bash call runs with a hint the agent reads beside its result (the hook's
`additionalContext`): a `git commit` or `git merge` wrapped in `js-harness gate --`, which holds
the machine's lock for the commit's whole gate, so the gate runs here and never goes to GitHub,
while a plain commit waits for its turn by itself. It reads every command the wrapper runs, a
shell's `-c` included, from the folder the gate's `--cwd` names. A commit with `--no-verify` or `-n`, a merge
that makes no commit, a commit after the wrapper (`js-harness gate -- npm test && git commit`)
and a wrapped test run get none: a test run of your own stays wrapped. A denial on the same call
wins over the hint. A `Write` or `Edit` of any other file loads nothing but the places of secrets and the memory index check, and of a
Markdown file the hour check besides; of a memory note, the feedback check, which reads the project only for a
note whose type is `feedback`. An `Edit` is
judged by the file it leaves, read from disk, so a short clause that makes a line long counts; a
line that was already long there is left to the memory hygiene pass rather than blocking the edit.

The hook always exits 0 and writes nothing. A check that cannot read what it checks lets the call run.
The model rules are the project's `subagent-writer-model` and `subagent-reader-model`. A project
that installs the harness has them off by default, so the model check applies only where the
project sets them.

```console
$ js-harness guard --hook < send.json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"js-harness guard: this message stamps 03:10, and the clock says 15:01. Stamp 15:01, or no hour: an hour in a message is read from the clock in the same step, or left out."}}
```

`guard --memory <folder>` reads a memory folder with the same check: it prints one line for each feedback note
that names no home of its rule and exits 1, or says how many it read and exits 0; where the project does not
declare `memory-feedback-home` it checks nothing and exits 0.

```console
$ js-harness guard --memory ~/.claude/projects/D--js-harness/memory
every feedback note names its home (23 feedback notes)
```

`install` also registers `guard --stop` for Claude Code, as a `Stop` hook: the share check. A
reply that states the session's own context share ("Contexto: 40 %") more than 2 points from the
share its transcript records is turned back with the hooks contract's `decision: "block"`, so the
session corrects it in one line from `get_usage`. The share is of the window the host is configured with when
a setting gives one (`CLAUDE_CODE_AUTO_COMPACT_WINDOW`, else `autoCompactWindow`, as the pause notice
reads it), else the window the session's last `get_usage` read reports, else the default 500,000 tokens; which clauses count as the session's
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
a background task runs), question (an open question the user answers in writing, not with
buttons, asked on that line and never while a background task runs), cut (one code block of what the user sends, under the three labels what
it is, where it goes and what sending it does, each once) or finished (with the session to return
to on that line). A block under those labels in any other state is turned back too: a decision is
asked with the question tool. A state line is a line that starts with a state's label once its
markdown is taken off, followed by the end of the line or a mark such as a dash or a colon
(`**Working** — the gate wakes me`); a label inside a sentence, or a sentence that only begins
with its word (`Working on the docs`), is none.

`init` writes `"reply": true` in a new project's `harness.json`; `false` turns the check off.
`"reply": true` takes the English labels (`Working`, `Decision`, `Question`, `Cut`, `Finished`;
`What it is`, `Where it goes`, `What sending it does`). An object names the project's own, each
over the English one: `{"states": {"working": "Sigo solo", "decision": "Necesito tu decisión",
"question": "Te pregunto", "cut": "Corte", "finished": "Terminado"}, "labels": {"what": "Qué es", "where": "Dónde", "effect":
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
decision or the question state is not told, a handing older than the session's transcript belongs to another
session of that number (except the opening the session read, always stored before it began), a
call the host moved to the background when it outlived its timeout counts as a launch, and Codex, which sends no background tasks, is not checked. When the close
is refused too, both reasons go in one block.

```console
$ js-harness reply --hook < stop.json
{"decision":"block","reason":"js-harness reply: the reply has no state line. End the reply with one line that starts with one of: Sigo solo (say what wakes you), Necesito tu decisión (never while background work runs; the question itself goes through the question tool), Te pregunto (an open question the user answers in writing, asked on that line), Corte (one code block of only what the user sends, under the lines Qué es:, Dónde: and Qué pasa:), Terminado (name the session to return to). Your reply is already shown: write the close again in your next words."}
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

### js-harness backup

The memory that survives the machine: a PC Manager cleanup or a Windows reinstall that wipes
Engram, the Claude memory folders or `~/.js-harness` loses nothing that was backed up.
`backup run` exports Engram and copies the Claude memory folders of its scope, then the js-harness
home and reference copies of the Claude, Codex and Engram config, the plugin lists
(`installed_plugins.json`, `known_marketplaces.json`) and Claude Desktop's side-session notes and
session presets, blanks every secret value it finds (a token, a key, a field named like a
credential), and for each repository of `config.json`'s `bundles` (`init` seeds it with the git
checkout it ran in, or the one `--checkout <path>` names; with none, nothing is bundled) keeps a bundle of the commits on no remote, every stash
entry and each worktree's detached commit included, a patch of each worktree's uncommitted edits
with its untracked files and its changed binary files copied whole, where the secret blanking can
read them (one over 5 MB is left out and named by `ready`), and the records of its
`.git/js-harness` (codex-review's, which the pre-push hook reads, and the merge queue's). It
pushes it all to a private GitHub repository through a clone under
`~/.js-harness/memory-backup`. A run with nothing new commits nothing. The home is copied without
its logs, its own backup clone, what a restore left there, and codex-review's per-run Codex homes,
which hold a link to Codex's login.

The scope is the `scope` field of `~/.js-harness/memory-backup/config.json`: `"all"` backs up
every Engram project and every Claude memory folder, a project name only that project and the
memory folders of its checkout and worktrees: a checkout named after the project at a drive root, or
the checkout and worktrees git lists for a repository of `bundles` whose main checkout has that name,
wherever it sits, with the worktrees Claude made in its `.claude/worktrees` that git no longer lists. Unset, it is `js-harness`, so another project's
memories reach GitHub only once someone writes `"all"`. The first run after the scope changes
takes the new export as it is, and drops from the clone what the narrower scope leaves out.

It refuses, keeping the last good backup: an export that lost more than a tenth of any count,
which is what a wiped Engram looks like (`--allow-shrink` when the drop is meant); a clone whose
fetch or push URL is not the configured repository on github.com, or is the public
`jsaristi/js-harness`; a repository
that does not read `PRIVATE` just before the push; and a backup another machine made
(`--adopt`, the first run after a reinstall). The push never waits for a sign-in prompt and gives
up after two minutes; the next run pushes what is owed.

Once a day, when `init` named a summary checkout, a run also refreshes a short public summary on the `memory-summary` branch of
`jsaristi/js-harness`, one file in one commit replaced each time; any clone reads it with
`git fetch origin memory-summary` and `git show FETCH_HEAD:SUMMARY.md`. It is built from an
allowlist, never filtered from everything: each roadmap phase's share, its open items, the
feature documents on main with their goal and next task, and the titles and dates of the last 30
decisions mirrored from those documents. A line with an email, a secret, a home path or a word of
the clone's `private-terms.txt` is dropped and counted; without that file nothing is pushed.
`backup summary` prints it without pushing. A summary that cannot be pushed is recorded in
`status` and never fails the backup.

`backup init --repo <owner/name>` creates the repository private when it does not exist, checks
it reads `PRIVATE`, clones it, and seeds `private-terms.txt` with the other Engram projects'
names. The checkout it bundles is the git repository the folder `init` runs in, or the one
`--checkout <path>` names (any folder inside it, refused with exit 2 when it is in no work tree).
A config with no `bundles` list yet, or an empty one, takes the checkout `init` runs in; a list
that names a checkout is left as it is, and `--checkout` adds its checkout to it when no entry is the same folder, saying so. Each
bundled repository gets a clone line in `RESTORE.md` with its `origin` (read when the file is
written, its credential removed), each argument single-quoted so bash and PowerShell read it as it
is, and an instruction in place of the command when a quote in it would end the quoting; or the instruction to clone it from wherever the project lives
when it has none. With no checkout, nothing is bundled and `init` says so: run
`init --repo <owner/name> --checkout <path>` from a checkout to add one. The summary reads the checkout `--summary-repo <dir>` names, and only then (a public push cannot be taken back; `backup summary --summary-repo <dir>`
shows it first);
every URL of its origin must be `jsaristi/js-harness` on github.com, or no summary is pushed.
`backup status` prints the last success, the last failure and the commits to push, and
`doctor` shows a `memory-backup` row that goes stale, with the reason, when no backup succeeded in
a day, a run failed after the last success, or the clone is gone, so the session-start hook says
it stopped.

Before a wipe or a reinstall, `backup ready` says whether the machine can go. It writes nothing,
and exits 1 while anything the backup is configured for has no copy off the machine, one
`missing:` line each: the clone ahead of origin, never pushed or apart from it; a file or an Engram
count the last backup does not hold; and for each repository of `bundles`, no remote, commits or a
stash entry in no bundle, a worktree's edits or the `.git/js-harness` records changed since the
last backup, an untracked file too large to copy. What the backup never copies is a `not copied:`
line with its size, and never fails it: the Claude transcripts while no transcripts repository is
named, and Claude Desktop's own data.

```console
$ js-harness backup ready
missing: D:/js-harness: stash@{1} (On feat/x: held out) is in no bundle
not copied: Claude transcripts (C:\Users\me\.claude\projects\**\*.jsonl): 156 files, 1.1 GB
backup ready: no, 1 things have no copy off this machine
```

The Claude transcripts go to private repositories of their own, so the memory backup stays small
(`odd/tasks/transcripts-backup.md`). `backup init --transcripts-repo <owner/name>` creates one
private, reads it PRIVATE and clones it; from then on `backup run` copies every
`~/.claude/projects/**/*.jsonl` into it once a day, as text, after the memory backup, and pushes it
after the same origin and PRIVATE checks (`backup run --transcripts` does it now). A transcript over
40 MiB is cut by line into parts, so no file nears GitHub's 100 MiB limit and a long session that
grows pushes only its new lines; the manifest holds each file's and each part's sha256, and a
transcript Claude Code deletes stays in the backup. They are not blanked, since a restore puts them
back byte-identical, so the PRIVATE check is their only guard. Once a repository's objects reach
800 MB it takes no new transcript, and `backup run`, `status` and `doctor` name the next one to open
with `init --transcripts-repo`. A transcripts failure is recorded and never fails the memory backup.
With transcripts named, `ready` calls a transcript in no backup or changed since missing, and one that
only grew in the last 15 minutes (a session running now) a note.

```console
$ node bin/js-harness.mjs backup verify --transcripts https://github.com/<owner>/<name>.git
ok transcripts: 834 of 834 files byte for byte
$ node bin/js-harness.mjs backup restore --transcripts https://github.com/<owner>/<name>.git
```

While Engram is down, the memory stays readable. Every run also writes, from the export it
accepted, `RECENT.md` and `recent/<project>.md` in the private repository: each project's last 100
important observations in full (pinned first, decisions favoured, one another superseded left out,
one under an unjudged conflict marked), under a head with the project's state and an index of each
entry's line. A run also refuses an export in which one project of at least 20 observations lost
more than a tenth of them, so a wipe of one client's memory under `"all"` never replaces its copy;
the refusal names `backup restore --merge` before `--allow-shrink`. `verify` and `ready` rebuild the
files from the export and say, by count and never by name, when one differs; `status` names the
projects and the newest entry; `doctor` calls the backup stale when a success left no `RECENT.md`.

A SessionStart hook in both hosts, `backup --session-start`, resolves the session's project and asks
`engram stats` for it within 3 seconds. When Engram holds less than nine tenths of what the last
backup held of it, the session is told so, pointed to its file's head, and given the restore command;
otherwise it says nothing. An Engram that answers but holds too few is told it holds less than its
backup; only one with no memory of the project, silent or failing is told its protocol is not working:

```console
js-harness: Engram has no memory of js-harness (memory fallback, odd/tasks/recent-memory.md).
The Engram protocol shown at this start is not working for this project. ...
Read C:\Users\me\.js-harness\memory-backup\repo\recent\js-harness.md, lines 1-120 first ...
```

After a reinstall, the steps are in `RESTORE.md` in the private repository (`init` writes it, every run rewrites it);
in short, with js-harness installed (`npm i -g --allow-git=all github:jsaristi/js-harness`) and before any session
and before `js-harness install`:

```console
$ js-harness backup restore --from https://github.com/<owner>/<name>.git
$ js-harness backup verify --from https://github.com/<owner>/<name>.git
```

`restore` works on this user's home unless `--home <dir>` names another. It imports Engram
(refused when that Engram already holds observations or its count cannot be read, unless
`--merge`; a restore run again skips the import it already did), puts back the memory folders (`--map <old path>=<new path>` for a project now
elsewhere) and `~/.js-harness` without its install manifest, never over a live file, and leaves the
old config files in `~/.js-harness/restored-config` to compare by hand, and the bundles, patches
and records in `~/.js-harness/restored-bundles`, each with the line that puts it back (`git fetch`
for a bundle, `git apply` for a patch, the folder to copy into `.git/js-harness`). `verify --from` restores
into a scratch home and checks the four counts and every file byte for byte; `verify --summary`
checks the public summary's sections and privacy; it takes one of `--from`, `--summary` or `--transcripts` at a time. The private clone keeps every byte as written
(`* -text`), so line endings never change on the way. `backup --hook` is the Stop hook install registers in both hosts: when a
backup is due (30 minutes since the last success, and Engram, a memory folder, the home, a plugin
list or Claude Desktop's notes or presets changed since) it starts a run detached and returns; where `init` never ran it does nothing.
The detached run outlives the hook and the host in both: measured on Claude Code 2.1.301 and Codex
0.162.1, the child was alive seconds after the host process exited. Codex runs a hook only once its
config records it as trusted (`hooks.state` in `config.toml`); until then only Claude Code's Stop
hook starts backups.

```console
$ js-harness backup status
backup: not initialised (js-harness backup init --repo <owner/name>)
```

### js-harness clean

The regenerable leftovers our way of developing leaves behind, which nothing else deletes: old
Codex app-server releases (every one but the release `current` points to and the one
`auto-update-version` names), old Claude Code CLI versions (the highest and the running one are
kept), the desktop app's old Code tab CLIs (the highest is kept), Codex's marketplace staging and
`tmp.*` or `js-harness-*` test scratch in the temp folder once untouched for 3 days (a scratch
folder holding a linked git worktree is kept), and the npm, pnpm, Go and uv caches when their tool
answers. With no flags it lists each kind, why it is safe to delete, each item with its size, and a
total, and deletes nothing. Where `~/.js-harness` exists, the listing also writes the sizes to
`clean.json`, as `--measure` does; without that folder it writes nothing. `--json` goes with the
listing or `--log`; with `--apply` or `--measure` it is a usage error (exit 2).

`clean --apply` scans again and deletes only the kinds you confirm: in a terminal it asks y/N per
kind; without one it deletes only the kinds named with `--kind <id>`, and with none named it
deletes nothing and exits 1. A folder is renamed before it is removed, so one with a file in use (a
running binary on Windows) fails whole and stays. A package cache is cleaned only by its own tool
(`npm cache clean --force`, `pnpm store prune`, `go clean -modcache`, `uv cache clean`), never by
hand; `pnpm store prune` removes only the packages no project uses, so its size is "up to". Each
deletion, failure or refusal is appended to `~/.js-harness/clean-log.jsonl` with when, the kind,
the path or command and the bytes; `clean --log` prints it. A deletion that failed or was refused
makes `--apply` exit 1. Never deleted: `~/.claude/projects`,
engram's store (`~/.engram`), `~/.js-harness`, the current Codex runtime, the running Claude,
anything inside a git worktree, and anything the scan of the same run did not find.

The smart part runs from `doctor`: when the last measure is 7 days old or missing, doctor and its
session-start hook start `clean --measure` detached (measuring takes about half a minute on a
machine with these caches, more than the hook's 10 seconds) and return. The measure writes
`~/.js-harness/clean.json` where `~/.js-harness` exists, and deletes nothing. Once its total reaches 2 GB, the `clean` row of
doctor is a gap that recommends `js-harness clean`, and the hook's notice names the size, once per
measure. `JS_HARNESS_CLEAN_MEASURE=off` turns the background measure off.

```console
$ js-harness clean
codex-releases 1.7 GB: old Codex app-server releases: Codex runs the one `current` points to, and downloads again a release it lacks
  C:\Users\you\.codex\packages\app-server-daemon\releases\0.157.1-x86_64-pc-windows-msvc  425.5 MB
  C:\Users\you\.codex\packages\app-server-daemon\releases\0.158.0-x86_64-pc-windows-msvc  427.2 MB
  C:\Users\you\.codex\packages\app-server-daemon\releases\0.159.0-x86_64-pc-windows-msvc  427.5 MB
  C:\Users\you\.codex\packages\app-server-daemon\releases\0.159.1-x86_64-pc-windows-msvc  427.6 MB
claude-versions 506.7 MB: old Claude Code CLI versions: the highest and the running one are kept, and the updater downloads what it needs
  C:\Users\you\.local\share\claude\versions\2.1.296  248.4 MB
  C:\Users\you\.local\share\claude\versions\2.1.300  258.3 MB
go-modcache 544.7 MB: the Go module cache: go downloads again what a build needs
  C:\Users\you\go\pkg\mod  544.7 MB
  cleaned by: go clean -modcache
Total: 4.3 GB (plus up to 5.9 GB that pnpm store prune may free)
Nothing was deleted. js-harness clean --apply asks y/N per kind; --apply --kind <id> deletes only the kinds named.
```

The run above is cut to three of its kinds.
