#!/usr/bin/env node
// Tiny dispatcher: `js-harness <command> [...args]`.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ruleValue } from './lib/rules.mjs';

const USAGE = `Usage: js-harness <command>

Commands:
  check       Run the budget and test gates. With --first <reason>, it issues its session a ticket for this tree and claims it, so it goes before every gate that waits (for the orchestrator's batch run on main); js-harness sessions prints the open tickets and flags one not issued by the orchestrator. js-harness check --door --base <rev> [--branch <name>] runs only the rule rows of the lines <rev>..HEAD brings and the failures row, for the merge door of merge-queue, and exits 1 when one refuses. js-harness check --push adds the row rules of the lines the push brings past the remote's default branch, as INFO: the commit refuses, the push reports, the merge refuses.
  gate        Run a command under the machine's gate lock, one at a time with the gates of every project: js-harness gate [--wait <minutes> | --no-wait] [--max <minutes>] -- <command>. It waits for its turn in the order the gates arrived; --wait is how many minutes the lock may go without changing hands before it gives up (${ruleValue('gate-wait', 'minutes')} when not given), and --no-wait refuses at once. --max is how many minutes the command may run before it is stopped with every process it started (${ruleValue('gate-max', 'minutes')} when not given). While the branch of the folder it runs in has an open pull request and commits a push would take now, it refuses any command but that push or a merge, and prints the push command. --ready <command> is a quick check, run before the wait and again as the turn comes after one: when it fails, nothing runs (exit 75). For a heavy run that is not a commit's gate (a whole test suite by hand, a batch of evals); its exit code is the command's. Every gate, a commit's included, leaves when it ran and under what in a file under the home (.js-harness/gate-log); js-harness gate log [--last <n>] prints the last gates of the machine's gate log, one a line: when, seconds, result, load, whom it waited for, folder. js-harness gate first --session <id> --reason <why> [--tree <path>] [--minutes <n>] issues a ticket that puts that session's next whole check before every gate that waits (two open at most, for 60 minutes at most, each kept in the gate log); gate first alone lists the open tickets, and gate first --cancel <id> undoes one.
  init        Enable js-harness in this project: harness.json (the pin, the project's code from the initials of its name, with the reply check on), AGENTS.md, an empty failures register (docs/FAILURES.md), the pre-commit gate; then what harness.json "functions" asks (js-harness functions): the pre-push check, the code map index (codegraph init, skipped when the code map is off) and the keys of .claude/settings.local.json, each recorded so uninstall undoes it.
  onboard     The pre-plan (docs/origin.md) and the roadmap (docs/ROADMAP.md) of a project after init, written by the session the owner talks to from an interview of one question at a time; the command calls no model. onboard with no verb prints the stage the onboarding is in, read from its files and git, and what the session does next, or the branch and worktree where one is in progress. onboard check holds the onboarding document (odd/tasks/onboarding.md), both plans and AGENTS.md to their shape and to each other, and names the stage each finding sends the work back to (--plan: the roadmap and its ties to the pre-plan only); it never runs a command. onboard hash prints the sha256 an approval records; onboard template feature|origin|roadmap|adr <slug> prints a skeleton, and with --write creates its file, never over one that exists; adr numbers the next decision record, docs/adr/<nnnn>-<slug>.md. onboard profile [<kind>[,<kind>]] [--area <id> | --checklist advice|bar [--size small|large]] prints the advice by kind of project: the kinds, a kind's areas and bar, one area explained, or the lines the onboarding pastes; with no kind it reads Kind and Size from the onboarding's ## Setup. Exit 0, 1 when check finds something, a template's file exists or a link is in the way, the project has a plan of its own, this is no initialized project, or a profile cannot tell the kind, the size or the area it needs; 2 for a usage error.
  install     Write the skills and the session hooks of Claude Code and Codex under a home, and record each in a manifest, so uninstall removes exactly them. --accept-session-messages also sets Claude Code's crossSessionInbound to "accept" in the user settings, so a message from a session of another permission class arrives; uninstall puts back what was there.
  loop        Run a session's long background loops under an owner record, so two sessions never stop each other's loops: js-harness loop run <name> --purpose "<text>" --until "<end condition>" -- <command> runs the command in the foreground (start it as a background task, so its end wakes the session) and records the owner session, its process and the command's by pid and creation time, the purpose and what ends it; loop status lists the project's loops, alive or stale, with their owners; loop stop <name> refuses a live loop another session owns unless --take-over, and exits 0 only when a second look finds none of its processes left; run --restart stops it first, under the same rule. loop heartbeat (ends on 30 minutes with no write to the gate log or the channel, a stalled work session, or a red daily Windows run not told before) and loop channel-watch (ends on the first notice of another session) are bodies for run.
  sync        Move the project to its pinned version (inside one) or re-write the machine install (--global, or outside a git repository).
  uninstall   Undo the project (inside one) or the machine install (--global, or outside a git repository). --full also removes the memory snapshots, the only copy of what a pass changed; files you modified and the memory notes themselves are kept either way. It goes with --global. Each kind also has a name, which never acts by location: uninstall project (what init wrote here), machine (--global), snapshots (--global --full) or everything (--global --everything: also the whole .js-harness folder and the program). The machine kinds also undo what stack install ran, each undo printed first; one that fails stays recorded for a run again.
  status      Show the project's pin and this clone (inside one) or the machine's installed, manifest and latest versions (--global, or outside a git repository).
  update      Say whether a newer release exists: the newest vX.Y.Z tag of the repository, read with the machine's git (--repo <url or folder> names another). When none is tagged it says that and how to get the newest copy; --source <dir> reads a folder of npm pack tarballs instead. Tags that cannot be listed exit 1 and say why.
  upgrade     Install the newer release, the repository at its newest vX.Y.Z tag (or the newest tarball of --source <dir>), then sync with the installed copy. --repo <url or folder> names another repository, --pm <command> the package manager (npm unless named), --prefix <dir> a folder of its own. With no release tagged it installs nothing and exits 1: no package registry is ever asked.
  doctor      Report the stack's tools: installed, configured, up to date, each gap with its fix (engram's Claude plugin against the one its binary's release ships); whether Claude Code and the desktop app share an account and each recorded remote server runs; whether the installed copy's rules are behind main's; the Claude app's, gentle-ai's and the stack's updates, each stale until its review is recorded (--host-reviewed, --gentle-ai-reviewed, --stack-reviewed); the sessions to clear (unseen); the worktrees on branches main already holds; and the regenerable leftovers of the last clean measure, a gap from 2 GB (clean). --json prints the rows, --offline skips the newer-version lookups, --hook is the session-start hook.
  stack       Read-only: the tools the harness requires that are missing on this machine for this project, in the order stack install runs them, each with its command and its exact undo (the Codex CLI and codegraph while their switches are not off, and codegraph's registrations in Claude Code and Codex); gentle-ai's own installer, logins and the prerequisites git and gh are named as steps of yours and never run, and context7 and typescript-lsp are listed as optional. --pm <command> names the package manager (else JS_HARNESS_PM, else the one that installed this copy); --json prints { mandatory, manual, optional }. Exit 0 when nothing required is missing, 1 when something is, 2 for a usage error. stack install [--prefix <dir>] [--tool <id>]... [--yes] runs those installs in that order, each printed with its undo and asked y/N in a terminal; without one it runs only --yes with --tool; each is recorded before it starts, so uninstall machine undoes it.
  progress    Show roadmap and feature progress from their checkboxes; --pace [--days <n>] gives the tasks closed, reopened, added and removed each day from the default branch's history; --json gives the data; --cwd names another project.
  report      The facts a status report is written from, since the last report: the pull requests merged into the default branch with their commits, each session's last notice, the questions answered and still open, and the roadmap phase by phase with what is left. --since <time> sets the cut; --mark records this report as the last one in the channel record, the only thing it writes.
  throughput  Table of a window's UTC days of work, every figure naming its source: pull requests merged and how long each waited, the gate lock's busy time and waits, commit gates here and on GitHub, lands, failing tests, Codex reviews, tasks closed and added, conflicts by file. js-harness throughput [--since <day>] [--until <day>] [--against <since>..<until>] [--json], where --against compares the window with an equal one before it, a row each, and judges nothing under the days of the rule throughput-compare-days a side; throughput snapshot [--day <day>] [--gate-log <file>]... keeps a settled day's gates under the home (.js-harness/throughput/<project>), because the gate log rotates in about two days; throughput status names a day with none and the reviews due; throughput reviewed (--day <day> | --shipped <day>) --found nothing|candidates and throughput shipped <item> [--day <day>] record the review's outcomes, which set when the next is due. The table and status write nothing.
  contract    Task contracts: template, check (validate), run (the done-when commands), goal (the /goal condition), modes (each task's effort and sub-agent models).
  summary     The summary a work session leaves when it finishes: template --title "<title>" prints it, headed by the title and naming its file docs/sessions/<date>-<title-slug>.md; path --title prints only that file. The session fills it with facts and their evidence, commits and pushes it, and closes with notify --kind closed --summary <file>.
  failures    The register of what went wrong, docs/FAILURES.md: the totals, the count by class and one line per failure, the most seen first, with its state. failures <id> prints one entry whole; failures check runs the gate's row alone and exits 1 when the register is refused, and with --settled also while a failure is not settled (repeated with no control, a control owed that is stale, a control lost or seen again, or a measurement lost or seen again). Read-only: only an editor writes the register.
  rules       Show the declared rules of the harness, each with its value or its home (rules <id> prints one with its source and who reads it). rules check exits 1 when a declaration, its source, a reader or docs/RULES.md is wrong; rules render writes docs/RULES.md; rules applied says what each model alias gave in the records of the last seven days. In a project that installs the harness, the project's own rules in docs/rules.json are listed too, and rules check holds them: each phrase still in its file, each sensor still declared, no rule deleted since HEAD. In the harness's own checkout rules check also counts each rule's patterns in the texts in force, and the gate's rules row reports, or for a rule that refuses fails, a line a commit adds that restates a rule's value instead of marking it rule:<id>. rules change <id> is the one command that changes a rule of the harness, in its own checkout on a rule/ branch: the change as JSON on standard input, it writes the declaration, its source and docs/RULES.md and appends a relief line (--dry-run prints them and writes nothing; --check-source checks a stored source against its transcript again). Its set takes patterns and a failure of docs/FAILURES.md as a change of form; set.row { refuses: today } turns a rule to refuse once its patterns find nothing on origin/main, fetched first, and set.row { reports, since: today } switches a refusing rule back. rules --hook is the turn-start hook install registers for Claude Code (UserPromptSubmit, SessionStart after a compaction or a resume, and SubagentStart; a clear in the desktop app arrives as a startup, which it does not name): where the project declares rules, it tells the session once what the rules on the default branch say that its merge base does not, with each new declaration; it prints nothing otherwise and always exits 0.
  codex-review  Run the Codex review of <base>..HEAD and record it (--unavailable <reason> records a skip).
  codex-meter  Read Codex's five-hour and weekly limits and its reset credits left, from codex app-server, which answers without running a model, so it spends no tokens: js-harness codex-meter [--json]. It starts one process per read and kills it after; --json prints the numbers, and a field the answer does not hold is printed as unknown.
  lens-review  Run the Claude lenses picked over <base>..HEAD, each a fresh tool-less run on the CLI login, and record the run (--unavailable <reason> records a skip).
  windows-daily  Read the newest run of the daily Windows suite (.github/workflows/windows-daily.yml) on GitHub and say whether it passed; a red run not told before is told to the orchestrator once, with its failing test names. The lead's loop heartbeat runs the same reading every hour.
  merge-queue  Build the candidate main would be: origin/main with each ready pull request merged in order of number, naming each one left out and why. Each pull request merged into the candidate passes main's rule rows first (check --door), and one that fails leaves the batch. With --land --refresh-copy, a land that moved main also brings the installed copy up to it (pnpm, under the gate lock) and prints the undo. Each code commit made after the cut-over is named, by its hash or a range a..b that holds it, on a gentle-ai line its pull request adds to a feature document (odd/tasks), and the queue prints each code commit's Codex record and that line. --dry-run prints it and pushes nothing; --land tests it on this machine and on GitHub Actions (.github/workflows/gate.yml on a queue/ branch) at the same time and, when both are green, moves main to it by fast-forward. A candidate whose every changed path is a document main's harness.json declares runs no suite on this machine, and its GitHub Actions run is its test. A land asks js-harness gate first to put its gate first in the line, and a gate that ran nothing exits 5 with main not pushed and nothing bisected. A land run from a copy whose bin/ is not origin/main's stops before it builds anything. A land tells the work session of each pull request it leaves out why, by a note in the channel, and removes the worktree of each one it landed when it is clean and idle, keeping its branch. --prune removes, by the same rule, every worktree on a branch origin/main holds. A landed rule/ branch appends to the relief file one line that confirms the newest proposal of each rule it changed that its landed head holds.
  functions   Show each function this project can turn off and on (harness.json "functions"): its value here and why. functions apply makes this clone what they ask (the code map index, the push check, the keys of .claude/settings.local.json), recorded so uninstall undoes it, with no pin needed; functions set <name> <value> writes one switch into harness.json and applies it.
  remote      Keep Claude Code's remote-control server running for this git repository, so the Claude app can start sessions here: start, stop, status. start --at-login also starts it at every Windows login, and again within five minutes whenever it is not running (a scheduled task); stop --at-login undoes both. A server stopped with stop stays stopped until the next start.
  sessions    Show the project's recent Claude Code sessions (state, context size with the room left before the host compacts it and what its last task cost, background work still open, tail of the last reply), with their roster by the role each title gives and what the channel's record says of each, the worktrees and each one's feature plan, the running gates and the session each hangs from, the open pull requests, the orchestrator's relief file (its path and last lines) and the channel (the last notices of the record and the last messages between sessions). The board is read-only; --json gives the same data. --watch waits and returns only when the board changes in a way that needs a decision, a notice for the orchestrator among them, or at --timeout. --address <role> (orchestrator, or a work session's number) prints the title of the one other session that holds the role: exit 0 for one, 1 for none with every transcript read, 2 for several or when it cannot tell. --opening "<title>" prints the opening stored for a session (notify --opening) and records in the channel which session read it. --next-number prints <code> <n>, the title number of the next work session, one past the highest in the channel and the openings. --quote <transcript> <line> prints the entry at that line of a transcript only when the user sent it, a message sent while the session worked included, with its time (exit 1 otherwise).
  unseen      Read-only: what the desktop app opened out of his sight for this project: an enabled scheduled task that runs here, and a session a schedule opened that sits in Routines (not archived), each named as FAIL, exit 1 when one is to clear; a disabled task, a leftover folder or a session a command opened (js-harness remote) is INFO. js-harness unseen [--hours <n>] [--claude-home <path>] [--records-only] [--json]; --records-only reads no transcript; with nothing to clear it says so and exits 0.
  memory      Memory hygiene for the project's Claude Code memory (the main checkout's folder, so a worktree reads the same notes): memory status says whether a pass is due and why (no verified pass yet, the index over the byte limit of the rule memory-index-bytes, an index line over 150 characters, a link to no file, a note with no line, a rule note written since the last pass, or the days of the rule memory-pass-days since it with notes written since), and lists what a pass should look at (long notes, citations to nothing). Read-only; --json gives the same data, --history the index bytes of each verified pass. Exit 0 nothing due or no memory folder, 1 due. A pass is made safe by three steps, whose lock, snapshots (the ten newest) and journal live under the home (.js-harness/memory-hygiene/<project>), never in the memory folder: memory plan <note>... takes the lock, snapshots the folder and names the files the pass may change, create or delete; memory verify <stamp> [--approved <note>,...] records what the pass left and refuses a file outside that set that changed meanwhile, a quotation of his in no note and in no home of the repository (docs/rule-sources.json, docs/rules.json, docs/ROADMAP.md, odd/tasks), a note deleted without --approved, an index line whose number or code span went neither to the new line nor to its note, or the index still over its limits, and releases the lock when it passes; memory undo <stamp> puts back each file the pass changed that nobody wrote since, keeps the lines others added to the index, and names any file it leaves; it refuses while another pass holds the lock.
  subagents   Count a day's sub-agents of this project by role (writer, explorer, reviewer, verifier), model, and effort asked and ran, with their tokens and the share of the day's tokens they took, read from the Claude Code records of the main checkout and each worktree; it keeps no text of any message. --day YYYY-MM-DD, --days <n> (at most 7), --json, --cwd <dir>.
  audit       Count, per session of a day, the claims of its transcript that the transcript itself can check, and print each wrong one at its transcript and line: the hour a message to another session stamps in its opening against the hour it was sent (more than a minute apart is wrong), and the share of its context a session states of itself against the share its own reply records (more than 2 points apart is wrong). Read from the Claude Code records of the main checkout and each worktree; it prints no text of any message. --day YYYY-MM-DD, --days <n> (at most 7), --json, --cwd <dir>.
  notify      Append one notice to the project's channel record under the home (.js-harness/channel/<project>.jsonl), with the time of the clock, the sender's session and the worktree and branch it ran in: js-harness notify --to orchestrator|<number> --kind opened|waiting|closed|note|answer|relieved|question|withdrawn|ready "<one line>" (an answer also takes --transcript and --line, where the user's words are read; an answer or a withdrawal takes --question <n>; a ready notice takes --pr <n>; a closed notice takes --summary <file>; a question takes its fields as JSON on standard input, and no text). Exit 0 once recorded, 1 when refused and not recorded, 2 for a usage error. It then prints the address of the role, as sessions --address gives it, so the sender can ring it; it sends no message, and its exit is 0 once the notice is recorded. --relief "<one line>" appends a line stamped by the clock to the orchestrator's relief file; --opening "<title>" stores the opening of a session, read from standard input. A notice is a claim of the session that wrote it, never the user's word.
  permit      The relay of permission cards to the orchestrator: --hook is the PermissionRequest hook install registers; while the orchestrator holds the relay (lease [--session <id>] [--minutes <n>], lease --off) a card of another session is told to it by a notice and waits up to 9.5 minutes for allow <id> or deny <id> --reason <text>; with no verdict the card reaches the user. list [--json] shows the waiting cards. Nothing is allowed but by the orchestrator's verdict, and every outcome is logged under the channel folder.
  wake        After a boot, list the sessions of the project open before it (an entry in the 12 hours before), each with the command that prints its stored opening and the js-harness wait calls the boot killed: js-harness wake [--notify] [--boot-time <iso>] [--home <path>] [--claude-home <path>]. --notify leaves each session whose title names a role a note (the inbox hook tells it on its next tool call: its waits are gone, read the opening, re-arm only its declared waits) and leaves the orchestrator the list to wake with send_message, once per boot. js-harness wake --at-login writes a file in the Windows Startup folder that runs wake --notify at each login, with the home and Claude home given or set when it is written, recorded so that uninstall removes it; --at-login --remove removes it now.
  quiet       Say whether anything still runs on this machine: js-harness quiet [--json] [--self <session id>] prints quiet (exit 0), busy (exit 1) or unknown (exit 3, a source could not be read), with what runs (a session claude agents --json --all lists as busy, the gate lock's holder and the gates that wait, a merge-queue --land, a codex exec or codex-review process), the sessions that wait for you on a permission prompt or a question, which are not work, and what could not be read. js-harness quiet --wait [--settle <minutes>] [--for <minutes>] [--every <seconds>] runs in the background and exits 0 once nothing has run for --settle minutes (10), saying the last work it saw, what needs you and that the PC can be turned off; after --for minutes (720) with no settle it exits 1.
  wait        Wait in the background until one condition holds, and print the one line that says so: js-harness wait (--pr <number> | --main-has <commit> | --main-file <path> --contains <text> | --notice-to <role or number>) [--every <seconds>] [--for <minutes>]. It checks at once, then every --every seconds (the rule wait-every when not given), and ends after --for minutes (the rule wait-for when not given) with exit 1; a pull request closed without merging ends it too. A notice to a work session's number ends its wait with exit 3; --cwd and --home name the repository and the harness home, as elsewhere. It says what it waits for and when it ends, so run it in the background and stop it with TaskStop when it is no longer needed.
  resume      The SessionStart hook that runs after a compaction or a clear (matcher compact|clear|startup, a startup only where the desktop app records the session it replaced), which install registers for Claude Code and Codex: js-harness resume --hook reads the hook input from standard input and prints the title of the session, the opening stored for it, the feature document it works on and what to read there, and the mode its next open task calls for when that task names its kind, so nobody pastes a resume prompt. It speaks only in a project with a harness.json, writes nothing and always exits 0. js-harness resume --pause is the PostToolUse hook of the context pause, which prints its notice once a stretch of work passes the pause (measured against the window CLAUDE_CODE_AUTO_COMPACT_WINDOW or the autoCompactWindow setting gives, when one does), and, at most once a day for the project, that a memory hygiene pass is due; and after a WebFetch the site answered 402, 403, 429 or 503 names the next rung (js-harness fetch, then the built-in browser).
  guard       The PreToolUse hook that install registers for Claude Code: js-harness guard --hook reads the hook input from standard input and refuses, with the hooks contract's deny and its reason, an Agent call on a model the project's rules do not give a sub-agent (only where the rules are in force; a project that installs the harness turns nothing on by default), a message to another session whose opening hour is more than a minute off the clock, a command typed into the user's terminal that does not end with a note saying what it does (only where the project's rules declare terminal-note), a Markdown document whose stamped hour is ahead of the clock, a Bash command with backticks inside double quotes (bash runs them as commands), a recursive rm of a drive's root or of a folder at its top, a gentle-ai review whose --base-ref is off its head's first-parent line, a node --test of several files outside a gate turn while another gate holds the machine's lock, a start_session with a brief and no effort, or one above the project's session-effort rule, a start_session titled otherwise than <code> <n> · <purpose> with the project's code (harness.json "code") (or <code> ORQ · <purpose> for a new lead) where the project declares the session-title rule, naming the next free number or saying to declare the code, a scheduled or cloud session the project's sessions-open-in-sidebar rule refuses, a Write or Edit that puts a line over 150 characters in a project's memory index (MEMORY.md), and one that leaves a feedback note of a memory folder naming no home of its rule in the repository, where the project declares the memory-feedback-home rule. js-harness guard --memory <folder> lists the feedback notes of a memory folder that name no such home and exits 1 when there is one. js-harness guard --stop is the Stop hook install registers beside it: it turns the stop back, so the session corrects it, when a reply states the session's own context share more than 2 points from the share its transcript records. It writes nothing; both hooks always exit 0.
  reply       The Stop hook of the reply check, which install registers for Claude Code and Codex: js-harness reply --hook reads the hook input from standard input and, where the nearest harness.json holds a "reply" key, turns the stop back with the hooks contract's block and its reason when the reply does not close with exactly one state (working, decision, question, cut, finished, in the labels the key names) and what that state needs: working says what wakes the session, a decision is never asked while background work runs, a question (an open one the user answers in writing) is written on its line and never asked while background work runs, a cut carries one block under its three labels, finished names the session to return to. It prints {} otherwise, writes nothing and always exits 0.
  fetch       Read a public page through r.jina.ai, the rung after a WebFetch the site refused as AI traffic: js-harness fetch <url>. It prints the page and exits 0, or exits 3 when this rung is blocked too (r.jina.ai answers a challenge page with HTTP 200, so the body is read), saying why and that the next rung is the built-in browser's get_page_text. It sends no cookie and no key, and refuses with exit 1 a host that is not public, a URL with a user or a password, or a query that names a secret.
  backup      The memory that survives the machine: backup run exports Engram (the js-harness project unless the scope in its config is all), copies the Claude memory folders, the js-harness home and reference copies of the config, blanks every secret value, bundles the commits on no remote with every stash entry, keeps each worktree's uncommitted edits and the .git/js-harness records, and pushes it all to a private GitHub repository through a clone under the home (.js-harness/memory-backup). It refuses an export that lost more than a tenth of any count (--allow-shrink when meant), a clone whose origin is not the configured repository, a repository that does not read PRIVATE just before the push, and a backup another machine made (--adopt). backup init --repo <owner/name> [--checkout <path>] creates the repository private when it does not exist and clones it, and adds the git checkout it runs in (or the one --checkout names) to the repositories the backup bundles, which RESTORE.md names; backup status prints the last success, the last failure and the commits to push; backup ready says whether the machine can be wiped, naming each thing that has no copy off it, and writes nothing; backup summary prints the public summary the next run would push to the memory-summary branch; backup restore --from <dir|git url> puts a backup into a home, never over a live file; backup verify --from <dir|git url> restores into a scratch home it then removes and checks it against the backup, and backup verify --summary <dir|git url> checks the memory-summary branch; backup --hook is the Stop hook install registers in both hosts, which starts a run detached when one is due (30 minutes since the last success and something changed) and does nothing where init never ran.
  clean       The regenerable leftovers of the stack: old Codex app-server releases, old Claude Code CLIs, Codex's marketplace staging, old test scratch in the temp folder, and the npm, pnpm, Go and uv caches. With no flags it lists each kind, why it is safe to delete, each item's size and a total, and deletes nothing; clean --apply deletes only the kinds confirmed (y/N per kind in a terminal, else each named with --kind <id>), package caches only through their own tools, and records each deletion under the home (.js-harness/clean-log.jsonl), which clean --log prints. It never deletes the transcripts, engram's store, the harness's home, the current Codex runtime, the running Claude or anything inside a git worktree. doctor starts clean --measure in the background at most once every 7 days, and its clean row recommends the clean once the total reaches 2 GB.

js-harness --version (or -v, or version) prints the version of this copy, alone on one line.
js-harness <command> --help (or -h) prints that command's usage and its line above, and runs nothing.

Environment: JS_HARNESS_HOME, JS_HARNESS_SOURCE, JS_HARNESS_PREFIX are used when --home/--source/--prefix are not given; JS_HARNESS_REPO is the release repository of update, upgrade and status when --repo is not given; JS_HARNESS_PM is the package manager of upgrade when --pm is not given.
`;

// Each loader imports its command's module when that command runs, not when the dispatcher loads: a host runs
// `resume --pause` after every tool call, and importing every command module up front is paid on each of them.
const COMMANDS = {
  check: async () => (await import('./check.mjs')).main,
  gate: async () => (await import('./gate.mjs')).gateMain,
  init: async () => (await import('./init.mjs')).initMain,
  onboard: async () => (await import('./onboard.mjs')).onboardMain,
  install: async () => (await import('./install.mjs')).installMain,
  loop: async () => (await import('./loop.mjs')).loopMain,
  sync: async () => (await import('./install.mjs')).syncMain,
  uninstall: async () => (await import('./install.mjs')).uninstallMain,
  status: async () => (await import('./update.mjs')).statusMain,
  update: async () => (await import('./update.mjs')).updateMain,
  upgrade: async () => (await import('./update.mjs')).upgradeMain,
  doctor: async () => (await import('./doctor.mjs')).doctorCommand,
  stack: async () => (await import('./stack.mjs')).stackMain,
  progress: async () => (await import('./progress.mjs')).progressMain,
  report: async () => (await import('./report.mjs')).reportMain,
  throughput: async () => (await import('./throughput.mjs')).throughputMain,
  contract: async () => (await import('./contract.mjs')).contractMain,
  summary: async () => (await import('./summary.mjs')).summaryMain,
  failures: async () => (await import('./failures.mjs')).failuresMain,
  // `rules --hook` runs on every turn, so it is sent to its own small module without loading the rest of `rules`.
  rules: async () => (args) => (args[0] === '--hook'
    ? import('./lib/rules-reach.mjs').then((module) => module.rulesHookMain(args.slice(1)))
    : import('./rules.mjs').then((module) => module.rulesMain(args))),
  'codex-review': async () => (await import('./codex-review.mjs')).codexReviewMain,
  'codex-meter': async () => (await import('./codex-meter.mjs')).codexMeterMain,
  'lens-review': async () => (await import('./lens-review.mjs')).lensReviewMain,
  'windows-daily': async () => (await import('./windows-daily.mjs')).windowsDailyMain,
  'merge-queue': async () => (await import('./merge-queue.mjs')).mergeQueueMain,
  functions: async () => (await import('./functions.mjs')).functionsMain,
  remote: async () => (await import('./remote.mjs')).remoteMain,
  sessions: async () => (await import('./sessions.mjs')).sessionsMain,
  unseen: async () => (await import('./unseen.mjs')).unseenMain,
  memory: async () => (await import('./memory.mjs')).memoryMain,
  subagents: async () => (await import('./subagents.mjs')).subagentsMain,
  audit: async () => (await import('./audit.mjs')).auditMain,
  notify: async () => (await import('./notify.mjs')).notifyMain,
  permit: async () => (await import('./permit.mjs')).permitMain,
  resume: async () => (await import('./resume.mjs')).resumeMain,
  quiet: async () => (await import('./quiet.mjs')).quietMain,
  wait: async () => (await import('./wait.mjs')).waitMain,
  wake: async () => (await import('./wake.mjs')).wakeMain,
  guard: async () => (await import('./guard.mjs')).guardMain,
  reply: async () => (await import('./reply.mjs')).replyMain,
  fetch: async () => (await import('./fetch.mjs')).fetchMain,
  backup: async () => (await import('./backup.mjs')).backupMain,
  clean: async () => (await import('./clean.mjs')).cleanMain,
};

// The usage each command prints on a usage error, which `<command> --help` prints too: [its module, the export].
// A command left out answers --help itself (backup, fetch, merge-queue, reply, stack, windows-daily).
const HELP = {
  check: ['./check.mjs', 'USAGE'],
  gate: ['./gate.mjs', 'USAGE'],
  init: ['./init.mjs', 'USAGE'],
  onboard: ['./onboard.mjs', 'USAGE'],
  install: ['./install.mjs', 'INSTALL_USAGE'],
  loop: ['./loop.mjs', 'USAGE'],
  sync: ['./install.mjs', 'SYNC_USAGE'],
  uninstall: ['./install.mjs', 'UNINSTALL_USAGE'],
  status: ['./update.mjs', 'STATUS_USAGE'],
  update: ['./update.mjs', 'UPDATE_USAGE'],
  upgrade: ['./update.mjs', 'UPGRADE_USAGE'],
  doctor: ['./doctor.mjs', 'USAGE'],
  progress: ['./progress.mjs', 'USAGE'],
  report: ['./report.mjs', 'USAGE'],
  throughput: ['./throughput.mjs', 'USAGE'],
  contract: ['./contract.mjs', 'USAGE'],
  summary: ['./summary.mjs', 'USAGE'],
  failures: ['./failures.mjs', 'USAGE'],
  rules: ['./rules.mjs', 'USAGE'],
  'codex-review': ['./codex-review.mjs', 'USAGE'],
  'codex-meter': ['./codex-meter.mjs', 'USAGE'],
  'lens-review': ['./lens-review.mjs', 'USAGE'],
  functions: ['./functions.mjs', 'USAGE'],
  remote: ['./remote.mjs', 'USAGE'],
  sessions: ['./sessions.mjs', 'USAGE'],
  unseen: ['./unseen.mjs', 'USAGE'],
  memory: ['./memory.mjs', 'USAGE'],
  subagents: ['./subagents.mjs', 'USAGE'],
  audit: ['./audit.mjs', 'USAGE'],
  notify: ['./notify.mjs', 'USAGE'],
  permit: ['./permit.mjs', 'USAGE'],
  resume: ['./resume.mjs', 'USAGE'],
  quiet: ['./quiet.mjs', 'USAGE'],
  wait: ['./wait.mjs', 'USAGE'],
  wake: ['./wake.mjs', 'USAGE'],
  guard: ['./guard.mjs', 'USAGE'],
  clean: ['./clean.mjs', 'USAGE'],
};

/** The help of one command: its module's usage (a string, or an array of lines), then its line of the main help. */
async function commandHelp(command) {
  const [file, name] = HELP[command];
  const usage = [(await import(file))[name]].flat().join('\n');
  const line = USAGE.split('\n').find((text) => text.startsWith(`  ${command} `));
  return `${usage}\n\n${line.trim().slice(command.length).trim()}`;
}

async function run(argv, { stdin = process.stdin, stdout = process.stdout, tui, commands = COMMANDS } = {}) {
  const [command, ...rest] = argv;

  if (!command) {
    // A real terminal on both ends opens the menu; anything else (a pipe, a script) gets help.
    if (stdin.isTTY && stdout.isTTY) {
      // The menu's module is imported only when the menu opens; a test hands `run` its own `tui` instead.
      const openMenu = tui ?? (await import('./tui.mjs')).tuiMain;
      return openMenu(rest, process.env, undefined, { stdin, stdout });
    }
    console.log(USAGE);
    return 0;
  }

  if (command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }

  // The version alone on one line: `upgrade` asks it of the copy on the path before it lets that copy
  // sync (install-update T8), so nothing else may share the line.
  if (command === '--version' || command === '-v' || command === 'version') {
    console.log((await import('./install.mjs')).currentVersion());
    return 0;
  }

  if (Object.hasOwn(commands, command)) {
    // `--help` alone prints and runs nothing; after other arguments it reaches the command (`gate -- node --help`).
    if (rest.length === 1 && (rest[0] === '--help' || rest[0] === '-h') && Object.hasOwn(HELP, command)) {
      console.log(await commandHelp(command));
      return 0;
    }
    const commandMain = await commands[command]();
    return commandMain(rest);
  }

  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

// Compare real paths: a global install reaches this file through a symlink on macOS/Linux.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  // exitCode, not process.exit(): exiting while fetch sockets are still closing crashes libuv on
  // Windows (`Assertion failed ... async.c`, exit 127), which broke `doctor`'s exit-0 contract.
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

export { run, COMMANDS };
