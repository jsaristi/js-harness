#!/usr/bin/env node
// Tiny dispatcher: `js-harness <command> [...args]`.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ruleValue } from './lib/rules.mjs';

const USAGE = `Usage: js-harness <command>

Commands:
  check       Run the budget and test gates. With --first <reason>, it issues its session a ticket for this tree and claims it, so it goes before every gate that waits (for the orchestrator's batch run on main); js-harness sessions prints the open tickets and flags one not issued by the orchestrator. js-harness check --door --base <rev> [--branch <name>] runs only the rule rows of the lines <rev>..HEAD brings, for the merge door of merge-queue, and exits 1 when one refuses. js-harness check --push adds the row rules of the lines the push brings past the remote's default branch, as INFO: the commit refuses, the push reports, the merge refuses.
  gate        Run a command under the machine's gate lock, one at a time with the gates of every project: js-harness gate [--wait <minutes> | --no-wait] [--max <minutes>] -- <command>. It waits for its turn in the order the gates arrived; --wait is how many minutes the lock may go without changing hands before it gives up (${ruleValue('gate-wait', 'minutes')} when not given), and --no-wait refuses at once. --max is how many minutes the command may run before it is stopped with every process it started (${ruleValue('gate-max', 'minutes')} when not given). While the branch of the folder it runs in has an open pull request and commits a push would take now, it refuses any command but that push or a merge, and prints the push command. --ready <command> is a quick check, run before the wait and again as the turn comes after one: when it fails, nothing runs (exit 75). For a heavy run that is not a commit's gate (a whole test suite by hand, a batch of evals); its exit code is the command's. Every gate, a commit's included, leaves when it ran and under what in a file under the home (.js-harness/gate-log); js-harness gate log [--last <n>] prints the last gates of the machine's gate log, one a line: when, seconds, result, load, whom it waited for, folder. js-harness gate first --session <id> --reason <why> [--tree <path>] [--minutes <n>] issues a ticket that puts that session's next whole check before every gate that waits (two open at most, for 60 minutes at most, each kept in the gate log); gate first alone lists the open tickets, and gate first --cancel <id> undoes one.
  init        Enable js-harness in this project: harness.json, AGENTS.md, an empty failures register (docs/FAILURES.md), the pre-commit gate.
  install     Write the skills and record a manifest under a home. --accept-session-messages also sets Claude Code's crossSessionInbound to "accept" in the user settings, so a message from a session of another permission class arrives; uninstall puts back what was there.
  loop        Run a session's long background loops under an owner record, so two sessions never stop each other's loops: js-harness loop run <name> --purpose "<text>" --until "<end condition>" -- <command> runs the command in the foreground (start it as a background task, so its end wakes the session) and records the owner session, its process and the command's by pid and creation time, the purpose and what ends it; loop status lists the project's loops, alive or stale, with their owners; loop stop <name> refuses a live loop another session owns unless --take-over, and exits 0 only when a second look finds none of its processes left; run --restart stops it first, under the same rule. loop heartbeat (ends on 30 minutes with no write to the gate log or the channel) and loop channel-watch (ends on the first notice of another session) are bodies for run.
  sync        Move the project to its pinned version (inside one) or re-write the machine install (--global, or outside a git repository).
  uninstall   Undo the project (inside one) or the machine install (--global, or outside a git repository).
  status      Show the project's pin and this clone (inside one) or the machine's installed, manifest and latest versions (--global, or outside a git repository).
  update      Say whether a newer release exists: the newest vX.Y.Z tag of the repository, read with the machine's git (--repo <url or folder> names another). None is tagged before 1.0.0, so it says that and how to get the newest copy; --source <dir> reads a folder of npm pack tarballs instead. Tags that cannot be listed exit 1 and say why.
  upgrade     Install the newer release, the repository at its newest vX.Y.Z tag (or the newest tarball of --source <dir>), then sync with the installed copy. With no release tagged it installs nothing and exits 1: no package registry is ever asked.
  doctor      Report the stack's tools: installed, configured, up to date; and whether the installed copy's rules are behind main's.
  progress    Show roadmap and feature progress from their checkboxes.
  contract    Task contracts: template, check (validate), run (the done-when commands), goal (the /goal condition), modes (each task's effort and sub-agent models).
  failures    The register of what went wrong, docs/FAILURES.md: the totals, the count by class and one line per failure, the most seen first, with its state. failures <id> prints one entry whole; failures check runs the gate's row alone and exits 1 when the register is refused, and with --settled also while a failure is not settled (repeated with no control, a control owed that is stale, a control lost or seen again, or a measurement lost or seen again). Read-only: only an editor writes the register.
  rules       Show the declared rules of the harness, each with its value or its home (rules <id> prints one with its source and who reads it). rules check exits 1 when a declaration, its source, a reader or docs/RULES.md is wrong; rules render writes docs/RULES.md. In a project that installs the harness, the project's own rules in docs/rules.json are listed too, and rules check holds them: each phrase still in its file, each sensor still declared, no rule deleted since HEAD. In the harness's own checkout rules check also counts each rule's patterns in the texts in force, and the gate's rules row reports, or for a rule that refuses fails, a line a commit adds that restates a rule's value instead of marking it rule:<id>. rules change <id> is the one command that changes a rule of the harness, in its own checkout on a rule/ branch: the change as JSON on standard input, it writes the declaration, its source and docs/RULES.md and appends a relief line (--dry-run prints them and writes nothing; --check-source checks a stored source against its transcript again). Its set takes patterns and a failure of docs/FAILURES.md as a change of form; set.row { refuses: today } turns a rule to refuse once its patterns find nothing on origin/main, fetched first, and set.row { reports, since: today } switches a refusing rule back. rules --hook is the turn-start hook install registers for Claude Code (UserPromptSubmit, SessionStart after a compaction, a clear or a resume, and SubagentStart): where the project declares rules, it tells the session once what the rules on the default branch say that its merge base does not, with each new declaration; it prints nothing otherwise and always exits 0.
  codex-review  Run the Codex review of <base>..HEAD and record it (--unavailable <reason> records a skip).
  merge-queue  Build the candidate main would be: origin/main with each ready pull request merged in order of number, naming each one left out and why. Each pull request merged into the candidate passes main's rule rows first (check --door), and one that fails leaves the batch. Each code commit made after the cut-over is named, by its hash or a range a..b that holds it, on a gentle-ai line its pull request adds to a feature document (odd/tasks), and the queue prints each code commit's Codex record and that line. --dry-run prints it and pushes nothing; --land tests it on this machine and on CircleCI and, when both are green, moves main to it by fast-forward. A candidate whose every changed path is a document main's harness.json declares runs no suite on this machine, and CircleCI's run is its test. A land asks js-harness gate first to put its gate first in the line, and a gate that ran nothing exits 5 with nothing pushed or bisected. A landed rule/ branch appends to the relief file one line that confirms the newest proposal of each rule it changed that its landed head holds.
  functions   Show each function this project can turn off and on (harness.json "functions"): its value here and why. functions apply makes this clone what they ask (the code map index, the push check, the keys of .claude/settings.local.json), recorded so uninstall undoes it, with no pin needed; functions set <name> <value> writes one switch into harness.json and applies it.
  remote      Keep Claude Code's remote-control server running for this git repository, so the Claude app can start sessions here: start, stop, status. start --at-login also starts it at every Windows login, and again within five minutes whenever it is not running (a scheduled task); stop --at-login undoes both. A server stopped with stop stays stopped until the next start.
  sessions    Show the project's recent Claude Code sessions (state, context size with the room left before the host compacts it and what its last task cost, background work still open, tail of the last reply), with their roster by the role each title gives and what the channel's record says of each, the worktrees and each one's feature plan, the running gates and the session each hangs from, the open pull requests, the orchestrator's relief file (its path and last lines) and the channel (the last notices of the record and the last messages between sessions). The board is read-only; --json gives the same data. --watch waits and returns only when the board changes in a way that needs a decision, a notice for the orchestrator among them, or at --timeout. --address <role> (orchestrator, or a work session's number) prints the title of the one other session that holds the role: exit 0 for one, 1 for none with every transcript read, 2 for several or when it cannot tell. --opening "<title>" prints the opening stored for a session (notify --opening) and records in the channel which session read it. --quote <transcript> <line> prints the entry at that line of a transcript only when the user sent it, a message sent while the session worked included, with its time (exit 1 otherwise).
  unseen      Read-only: what the desktop app opened out of his sight for this project: an enabled scheduled task that runs here, and a session a schedule opened that sits in Routines (not archived), each named as FAIL, exit 1 when one is to clear; a disabled task, a leftover folder or a session a command opened (js-harness remote) is INFO. js-harness unseen [--hours <n>] [--claude-home <path>] [--records-only] [--json]; --records-only reads no transcript; with nothing to clear it says so and exits 0.
  memory      Memory hygiene for the project's Claude Code memory (the main checkout's folder, so a worktree reads the same notes): memory status says whether a pass is due and why (no verified pass yet, the index over 4,000 bytes, an index line over 150 characters, a link to no file, a note with no line, a rule note written since the last pass, or 7 days since it with notes written since), and lists what a pass should look at (long notes, citations to nothing). Read-only; --json gives the same data, --history the index bytes of each verified pass. Exit 0 nothing due or no memory folder, 1 due. A pass is made safe by three steps, whose lock, snapshots (the ten newest) and journal live under the home (.js-harness/memory-hygiene/<project>), never in the memory folder: memory plan <note>... takes the lock, snapshots the folder and names the files the pass may change, create or delete; memory verify <stamp> [--approved <note>,...] records what the pass left and refuses a file outside that set that changed meanwhile, a quotation of his in no note and in no home of the repository (docs/rule-sources.json, docs/rules.json, docs/ROADMAP.md, odd/tasks), a note deleted without --approved, an index line whose number or code span went neither to the new line nor to its note, or the index still over its limits, and releases the lock when it passes; memory undo <stamp> puts back each file the pass changed that nobody wrote since, keeps the lines others added to the index, and names any file it leaves; it refuses while another pass holds the lock.
  subagents   Count a day's sub-agents of this project by role (writer, explorer, reviewer, verifier), model, and effort asked and ran, with their tokens and the share of the day's tokens they took, read from the Claude Code records of the main checkout and each worktree; it keeps no text of any message. --day YYYY-MM-DD, --days <n> (at most 7), --json, --cwd <dir>.
  audit       Count, per session of a day, the claims of its transcript that the transcript itself can check, and print each wrong one at its transcript and line: the hour a message to another session stamps in its opening against the hour it was sent (more than a minute apart is wrong), and the share of its context a session states of itself against the share its own reply records (more than 2 points apart is wrong). Read from the Claude Code records of the main checkout and each worktree; it prints no text of any message. --day YYYY-MM-DD, --days <n> (at most 7), --json, --cwd <dir>.
  notify      Append one notice to the project's channel record under the home (.js-harness/channel/<project>.jsonl), with the time of the clock, the sender's session and the worktree and branch it ran in: js-harness notify --to orchestrator|<number> --kind opened|waiting|closed|note|answer|relieved "<one line>" (an answer also takes --transcript and --line, where the user's words are read). It then prints the address of the role, as sessions --address gives it, so the sender can ring it; it sends no message, and its exit is 0 once the notice is recorded. --relief "<one line>" appends a line stamped by the clock to the orchestrator's relief file; --opening "<title>" stores the opening of a session, read from standard input. A notice is a claim of the session that wrote it, never the user's word.
  wake        After a boot, list the sessions of the project open before it (an entry in the 12 hours before), each with the command that prints its stored opening and the js-harness wait calls the boot killed: js-harness wake [--notify] [--boot-time <iso>] [--home <path>] [--claude-home <path>]. --notify leaves each session whose title names a role a note (the inbox hook tells it on its next tool call: its waits are gone, read the opening, re-arm only its declared waits) and leaves the orchestrator the list to wake with send_message, once per boot. js-harness wake --at-login writes a file in the Windows Startup folder that runs wake --notify at each login, with the home and Claude home given or set when it is written, recorded so that uninstall removes it; --at-login --remove removes it now.
  wait        Wait in the background until one condition holds, and print the one line that says so: js-harness wait (--pr <number> | --main-has <commit> | --main-file <path> --contains <text> | --notice-to <role or number>) [--every <seconds>] [--for <minutes>]. It checks at once, then every --every seconds (120), and ends after --for minutes (480) with exit 1; a pull request closed without merging ends it too. It says what it waits for and when it ends, so run it in the background and stop it with TaskStop when it is no longer needed.
  resume      The SessionStart hook that runs after a compaction (matcher compact), which install registers for Claude Code and Codex: js-harness resume --hook reads the hook input from standard input and prints the title of the session, the opening stored for it, the feature document it works on and what to read there, and the mode its next open task calls for when that task names its kind, so nobody pastes a resume prompt. It speaks only in a project with a harness.json, writes nothing and always exits 0. js-harness resume --pause is the PostToolUse hook of the context pause, which prints its notice once a stretch of work passes the pause (measured against the window CLAUDE_CODE_AUTO_COMPACT_WINDOW or the autoCompactWindow setting gives, when one does), and, at most once a day for the project, that a memory hygiene pass is due; and after a WebFetch the site answered 402, 403, 429 or 503 names the next rung (js-harness fetch, then the built-in browser).
  guard       The PreToolUse hook that install registers for Claude Code: js-harness guard --hook reads the hook input from standard input and refuses, with the hooks contract's deny and its reason, an Agent call on a model the project's rules do not give a sub-agent (only where the rules are in force; a project that installs the harness turns nothing on by default), a message to another session whose opening hour is more than a minute off the clock, a Bash command with backticks inside double quotes (bash runs them as commands), a node --test of several files outside a gate turn while another gate holds the machine's lock, and a Write or Edit that puts a line over 150 characters in a project's memory index (MEMORY.md). js-harness guard --stop is the Stop hook install registers beside it: it turns the stop back, so the session corrects it, when a reply states the session's own context share more than 2 points from the share its transcript records. It writes nothing and always exits 0.
  reply       The Stop hook of the reply check, which install registers for Claude Code and Codex: js-harness reply --hook reads the hook input from standard input and, where the nearest harness.json holds a "reply" key, turns the stop back with the hooks contract's block and its reason when the reply does not close with exactly one state (working, decision, cut, finished, in the labels the key names) and what that state needs: working says what wakes the session, a decision is never asked while background work runs, a cut carries one block under its three labels, finished names the session to return to. It prints {} otherwise, writes nothing and always exits 0.
  fetch       Read a public page through r.jina.ai, the rung after a WebFetch the site refused as AI traffic: js-harness fetch <url>. It prints the page and exits 0, or exits 3 when this rung is blocked too (r.jina.ai answers a challenge page with HTTP 200, so the body is read), saying why and that the next rung is the built-in browser's get_page_text. It sends no cookie and no key, and refuses with exit 1 a host that is not public, a URL with a user or a password, or a query that names a secret.

js-harness --version prints the version of this copy, alone on one line.

Environment: JS_HARNESS_HOME, JS_HARNESS_SOURCE, JS_HARNESS_PREFIX are used when --home/--source/--prefix are not given.
`;

// Each loader imports its command's module when that command runs, not when the dispatcher loads: a host runs
// `resume --pause` after every tool call, and importing every command module up front is paid on each of them.
const COMMANDS = {
  check: async () => (await import('./check.mjs')).main,
  gate: async () => (await import('./gate.mjs')).gateMain,
  init: async () => (await import('./init.mjs')).initMain,
  install: async () => (await import('./install.mjs')).installMain,
  loop: async () => (await import('./loop.mjs')).loopMain,
  sync: async () => (await import('./install.mjs')).syncMain,
  uninstall: async () => (await import('./install.mjs')).uninstallMain,
  status: async () => (await import('./update.mjs')).statusMain,
  update: async () => (await import('./update.mjs')).updateMain,
  upgrade: async () => (await import('./update.mjs')).upgradeMain,
  doctor: async () => (await import('./doctor.mjs')).doctorCommand,
  progress: async () => (await import('./progress.mjs')).progressMain,
  contract: async () => (await import('./contract.mjs')).contractMain,
  failures: async () => (await import('./failures.mjs')).failuresMain,
  // `rules --hook` runs on every turn, so it is sent to its own small module without loading the rest of `rules`.
  rules: async () => (args) => (args[0] === '--hook'
    ? import('./lib/rules-reach.mjs').then((module) => module.rulesHookMain(args.slice(1)))
    : import('./rules.mjs').then((module) => module.rulesMain(args))),
  'codex-review': async () => (await import('./codex-review.mjs')).codexReviewMain,
  'merge-queue': async () => (await import('./merge-queue.mjs')).mergeQueueMain,
  functions: async () => (await import('./functions.mjs')).functionsMain,
  remote: async () => (await import('./remote.mjs')).remoteMain,
  sessions: async () => (await import('./sessions.mjs')).sessionsMain,
  unseen: async () => (await import('./unseen.mjs')).unseenMain,
  memory: async () => (await import('./memory.mjs')).memoryMain,
  subagents: async () => (await import('./subagents.mjs')).subagentsMain,
  audit: async () => (await import('./audit.mjs')).auditMain,
  notify: async () => (await import('./notify.mjs')).notifyMain,
  resume: async () => (await import('./resume.mjs')).resumeMain,
  wait: async () => (await import('./wait.mjs')).waitMain,
  wake: async () => (await import('./wake.mjs')).wakeMain,
  guard: async () => (await import('./guard.mjs')).guardMain,
  reply: async () => (await import('./reply.mjs')).replyMain,
  fetch: async () => (await import('./fetch.mjs')).fetchMain,
};

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
  if (command === '--version') {
    console.log((await import('./install.mjs')).currentVersion());
    return 0;
  }

  if (Object.hasOwn(commands, command)) {
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
