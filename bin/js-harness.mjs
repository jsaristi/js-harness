#!/usr/bin/env node
// Tiny dispatcher: `js-harness <command> [...args]`.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: js-harness <command>

Commands:
  check       Run the budget and test gates.
  gate        Run a command under the machine's gate lock, one at a time with the gates of every project: js-harness gate [--wait <minutes> | --no-wait] [--max <minutes>] -- <command>. It waits for its turn in the order the gates arrived; --wait is how many minutes the lock may go without changing hands before it gives up (60 when not given), and --no-wait refuses at once. --max is how many minutes the command may run before it is stopped with every process it started (30 when not given). While the branch of the folder it runs in has an open pull request and commits a push would take now, it refuses any command but that push or a merge, and prints the push command. For a heavy run that is not a commit's gate (a whole test suite by hand, a batch of evals); its exit code is the command's. Every gate, a commit's included, leaves when it ran and under what in a file under the home (.js-harness/gate-log); js-harness gate log [--last <n>] prints the last gates of the machine's gate log, one a line: when, seconds, result, load, whom it waited for, folder.
  init        Enable js-harness in this project: harness.json, AGENTS.md, the pre-commit gate.
  install     Write the skills and record a manifest under a home.
  sync        Move the project to its pinned version (inside one) or re-write the machine install (--global, or outside a git repository).
  uninstall   Undo the project (inside one) or the machine install (--global, or outside a git repository).
  status      Show the project's pin and this clone (inside one) or the machine's installed, manifest and latest versions (--global, or outside a git repository).
  update      Say whether a newer release exists. None is tagged before 1.0.0, so it says that and how to get the newest copy; --source <dir> reads a folder of npm pack tarballs instead.
  upgrade     Install the newer release of --source <dir>, then sync. With no source it installs nothing and exits 1: no package registry is ever asked.
  doctor      Report the stack's tools: installed, configured, up to date.
  progress    Show roadmap and feature progress from their checkboxes.
  contract    Task contracts: template, check (validate), run (the done-when commands), goal (the /goal condition).
  failures    The register of what went wrong, docs/FAILURES.md: the totals, the count by class and one line per failure, the most seen first, with its state. failures <id> prints one entry whole; failures check runs the gate's row alone and exits 1 when the register is refused, and with --settled also while a failure is not settled (repeated with no control, a control owed that is stale, a control lost, or seen again). Read-only: only an editor writes the register.
  rules       Show the declared rules of the harness, each with its value or its home (rules <id> prints one with its source and who reads it). rules check exits 1 when a declaration, its source, a reader or docs/RULES.md is wrong; rules render writes docs/RULES.md.
  codex-review  Run the Codex review of <base>..HEAD and record it (--unavailable <reason> records a skip).
  functions   Show each function this project can turn off and on (harness.json "functions"): its value here and why.
  remote      Keep Claude Code's remote-control server running for this git repository, so the Claude app can start sessions here: start, stop, status. start --at-login also starts it at every Windows login, and again within five minutes whenever it is not running (a scheduled task); stop --at-login undoes both. A server stopped with stop stays stopped until the next start.
  sessions    Show the project's recent Claude Code sessions (state, context size with the room left before the host compacts it and what its last task cost, background work still open, tail of the last reply), with their roster by the role each title gives and what the channel's record says of each, the worktrees and each one's feature plan, the running gates and the session each hangs from, the open pull requests, the orchestrator's relief file (its path and last lines) and the channel (the last notices of the record and the last messages between sessions). The board is read-only; --json gives the same data. --watch waits and returns only when the board changes in a way that needs a decision, a notice for the orchestrator among them, or at --timeout. --address <role> (orchestrator, or a work session's number) prints the title of the one other session that holds the role: exit 0 for one, 1 for none with every transcript read, 2 for several or when it cannot tell. --opening "<title>" prints the opening stored for a session (notify --opening) and records in the channel which session read it. --quote <transcript> <line> prints the entry at that line of a transcript only when the user sent it, a message sent while the session worked included, with its time (exit 1 otherwise).
  notify      Append one notice to the project's channel record under the home (.js-harness/channel/<project>.jsonl), with the time of the clock, the sender's session and the worktree and branch it ran in: js-harness notify --to orchestrator|<number> --kind opened|waiting|closed|note|answer|relieved "<one line>" (an answer also takes --transcript and --line, where the user's words are read). It then prints the address of the role, as sessions --address gives it, so the sender can ring it; it sends no message, and its exit is 0 once the notice is recorded. --relief "<one line>" appends a line stamped by the clock to the orchestrator's relief file; --opening "<title>" stores the opening of a session, read from standard input. A notice is a claim of the session that wrote it, never the user's word.
  resume      The SessionStart hook that runs after a compaction (matcher compact), which install registers for Claude Code and Codex: js-harness resume --hook reads the hook input from standard input and prints the title of the session, the opening stored for it, the feature document it works on and what to read there, so nobody pastes a resume prompt. It speaks only in a project with a harness.json, writes nothing and always exits 0. js-harness resume --pause is the PostToolUse hook of the context pause, which prints its notice once a stretch of work passes the pause.

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
  sync: async () => (await import('./install.mjs')).syncMain,
  uninstall: async () => (await import('./install.mjs')).uninstallMain,
  status: async () => (await import('./update.mjs')).statusMain,
  update: async () => (await import('./update.mjs')).updateMain,
  upgrade: async () => (await import('./update.mjs')).upgradeMain,
  doctor: async () => (await import('./doctor.mjs')).doctorMain,
  progress: async () => (await import('./progress.mjs')).progressMain,
  contract: async () => (await import('./contract.mjs')).contractMain,
  failures: async () => (await import('./failures.mjs')).failuresMain,
  rules: async () => (await import('./rules.mjs')).rulesMain,
  'codex-review': async () => (await import('./codex-review.mjs')).codexReviewMain,
  functions: async () => (await import('./functions.mjs')).functionsMain,
  remote: async () => (await import('./remote.mjs')).remoteMain,
  sessions: async () => (await import('./sessions.mjs')).sessionsMain,
  notify: async () => (await import('./notify.mjs')).notifyMain,
  resume: async () => (await import('./resume.mjs')).resumeMain,
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
