# js-harness user guide

js-harness sets up Claude Code and Codex for a project and gets out of the way: a short `AGENTS.md`, a
pre-commit gate, task contracts and hooks, all recorded so they can be removed exactly. This guide takes you
from nothing to a working project. The README holds the full reference of every command.

## Quick path

1. Install the program: `pnpm add -g github:jsaristi/js-harness` (or npm, below).
2. Set up the machine: `js-harness install`, then `js-harness doctor` and `js-harness stack install`.
3. Set up a project: `cd my-project`, `js-harness init`.
4. Plan it: in a Claude Code or Codex session in that project, run `js-harness onboard`.
5. Work: commit as usual; the pre-commit gate runs `js-harness check`.

Lost at any point? `js-harness <command> --help` prints that command's usage and runs nothing.

## Install

You need Node 22 or newer and git. The repository is public on GitHub, and the install reads it from there.

| Package manager | Command |
|---|---|
| pnpm | `pnpm add -g github:jsaristi/js-harness` |
| npm | `npm i -g --allow-git=all github:jsaristi/js-harness` |

npm 12 fetches a package from git only with `--allow-git`, and npm 11.12 refuses this one under `root`, hence
`all`. Without a tag you get the newest `main`; add `#vX.Y.Z` to install a release. `js-harness --version`
(or `-v`, or `version`) prints the version you have.

## The menu

`js-harness` with no arguments, in a terminal, opens a menu. Move with the arrow keys (or `j` and `k`), run an
item with Enter, leave with `q` or Escape. Piped or scripted, it prints the help instead.

Outside a git repository the menu shows only the machine items. Inside one, a **project** section comes first.

| Item | Section | What it does |
|---|---|---|
| Init | project, before `init` | Enables js-harness here (`js-harness init`). |
| Sync | project, after `init` | Moves the project to the version its `harness.json` pins (`js-harness sync`). |
| Status | project, after `init` | The pinned version, the running one, and whether this clone is set up (`js-harness status`). |
| Remote status / start / stop | project | Claude Code's remote-control server for this repository, so the Claude app can start sessions here (`js-harness remote`). Stop asks first: the sessions opened through it end. Windows only. |
| Status | machine | The machine's installed version, its manifest and the latest release. |
| Doctor | machine | Each tool of the stack: installed, configured, up to date, and the fix for each gap (`js-harness doctor`). |
| Install the stack | machine, while a required tool is missing | Runs `js-harness stack install`: each install is shown with its undo and asked y/N. |
| Install | machine | Writes the skills and session hooks for Claude Code and Codex under your home (`js-harness install`). |
| Update | machine | Says whether a newer release exists (`js-harness update`). |
| Upgrade | machine | Installs the newer release and syncs the home; open the menu again afterwards to run the new code. |
| Uninstall | machine | Opens a submenu of the kinds of uninstall, below. Each asks y/N and says what it removes and keeps. |
| Quit | machine | Leaves the menu. |

The Uninstall submenu:

| Kind | Removes | Keeps |
|---|---|---|
| Project (inside a project `init` touched) | what `init` recorded in this clone | files you edited, the machine install |
| Machine | what `install` recorded, and the folders js-harness keeps in the home | files you edited, the memory snapshots, the throughput records, the program |
| Machine + memory snapshots | the same, and the memory snapshots | the throughput records, the program |
| Everything | the same, the whole `.js-harness` folder and the program; cannot be undone | projects' files |

Back, or Escape, returns to the menu without running anything.

## The first run

Once per machine:

1. **`js-harness install`** writes the skills and the session hooks for Claude Code and Codex under your home,
   and records each in a manifest, so `uninstall` removes exactly them.
2. **`js-harness doctor`** lists each tool of the stack (gentle-ai, engram, codegraph, Codex and the optional
   ones) with what is missing and the command that fixes it. Where engram's Claude Code plugin is installed, it
   also says when the plugin is older than the one the engram binary's release ships.
3. **`js-harness stack install`** runs the installs js-harness can undo exactly, in order, asking y/N for each
   and recording it before it starts. What it never runs is printed as your own step: gentle-ai's installer
   (which brings engram), logins, and `git` and `gh`. `js-harness stack` alone lists the same, read-only.

Once per project, in its git repository:

4. **`js-harness init`** writes `harness.json` (the pinned version, the project's `code` that its sessions'
   titles start with, and the reply check), a base `AGENTS.md` where none exists, an empty failures register
   (`docs/FAILURES.md`) and the pre-commit gate. Commit what it wrote.
5. **`js-harness onboard`**, run by a Claude Code or Codex session you talk to, writes the project's pre-plan
   (`docs/origin.md`) and roadmap (`docs/ROADMAP.md`) through a short interview, one question at a time. The
   command calls no model: it prints the stage the onboarding is in and what the session does next, so a new
   session resumes by running it again. `js-harness onboard check` names what is still missing.

Optionally, once per machine:

6. **`js-harness backup init --repo <owner/name>`** creates a private GitHub repository for your memory (Engram
   and the Claude memory folders) and clones it. From then on the Stop hook backs it up when due, and
   `js-harness backup status` says when it last succeeded. By default only the `js-harness` project is backed
   up; set `"scope": "all"` in `~/.js-harness/memory-backup/config.json` for every project. Before you wipe
   or reinstall the machine, `js-harness backup ready` lists anything that still has no copy off it.

## A typical day

| Step | Command | What to expect |
|---|---|---|
| Check | `js-harness check` | The gate: the `AGENTS.md` budget, the task contracts, the project's tests, lint and typecheck, and whether the change is due a review. Red means the commit is not ready. |
| Commit | `git commit` | The pre-commit hook runs the same gate, so a red check stops the commit. |
| Review | gentle-ai's review, then `js-harness codex-review --base <rev>` | `check` says when a change is due a gentle-ai review. Where the project's `codexReview` function is on, Codex reviews `<rev>..HEAD` and records it, and the pre-push check refuses code commits no record covers. |
| Progress | `js-harness progress` | Each roadmap phase and feature, counted from the checkboxes of `docs/ROADMAP.md` and `odd/tasks/*.md`. |

A feature's work is tracked in `odd/tasks/<feature>.md`; `js-harness contract template` prints the skeleton it
opens with, whose end is a set of commands that exit 0.

## Clean the machine

The stack leaves regenerable leftovers nothing else deletes: old Codex app-server releases, old Claude Code CLIs,
Codex's marketplace staging, old test scratch in the temp folder, and the npm, pnpm, Go and uv caches.

```sh
js-harness clean                          # lists each kind, why it is safe, each item's size and a total; deletes nothing
js-harness clean --apply                  # asks y/N per kind, deletes only the yeses
js-harness clean --apply --kind uv-cache  # without a terminal: deletes only the kinds named
js-harness clean --log                    # what was deleted, when and how much
```

Package caches are cleaned only by their own tools, never by hand, and every deletion is recorded in
`~/.js-harness/clean-log.jsonl`. Your transcripts, engram's store, `~/.js-harness`, the current Codex runtime, the
running Claude and anything inside a git worktree are never touched. You do not have to remember to run it: about once
a week `doctor` measures the leftovers in the background, and once they reach 2 GB the session-start notice says how
much there is to clean. It never deletes by itself; set `JS_HARNESS_CLEAN_MEASURE=off` to stop the measure.

## Uninstall

Inside a project, `js-harness uninstall` removes what `init` wrote there. For the machine, pick a kind:

```sh
js-harness uninstall machine      # what install wrote; keeps the program
js-harness uninstall everything   # all js-harness keeps on the machine, then the program itself
```

`uninstall everything` removes the program with the package manager that installed it, so no `npm rm -g` or
`pnpm remove -g` is needed after it. If you only removed the machine install, remove the program with the same
manager you installed it with: `pnpm remove -g js-harness` or `npm rm -g js-harness`. Projects' files are always
kept; run `js-harness uninstall` inside each project to undo its `init`.

## Which commands are yours

Most commands are for you. Some exist for the hooks `install` registers, or for an orchestrator session that
leads other sessions; you rarely type those by hand. The README lists all of them in its
[Commands](../README.md#commands) section, in this order.

| For you | For hooks and the orchestrator |
|---|---|
| check, gate, init, onboard, install, sync, uninstall, status, update, upgrade, doctor, stack, progress, contract, failures, rules, codex-review, functions, remote, memory, backup, fetch, clean, summary | guard, reply, resume, permit (hooks); notify, wake, sessions, wait, loop, merge-queue, report, throughput, windows-daily, unseen, subagents, audit (the orchestrator and its sessions) |
