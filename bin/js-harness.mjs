#!/usr/bin/env node
// Tiny dispatcher: `js-harness <command> [...args]`.
import { main as checkMain } from './check.mjs';
import { gateMain } from './gate.mjs';
import { installMain, syncMain, uninstallMain } from './install.mjs';
import { initMain } from './init.mjs';
import { statusMain, updateMain, upgradeMain } from './update.mjs';
import { doctorMain } from './doctor.mjs';
import { progressMain } from './progress.mjs';
import { contractMain } from './contract.mjs';
import { codexReviewMain } from './codex-review.mjs';
import { remoteMain } from './remote.mjs';
import { sessionsMain } from './sessions.mjs';
import { notifyMain } from './notify.mjs';
import { tuiMain } from './tui.mjs';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: js-harness <command>

Commands:
  check       Run the budget and test gates.
  gate        Run a command under the machine's gate lock, one at a time with the gates of every project: js-harness gate [--wait <minutes> | --no-wait] -- <command>. For a heavy run that is not a commit's gate (a whole test suite by hand, a batch of evals); its exit code is the command's.
  init        Enable js-harness in this project: harness.json, AGENTS.md, the pre-commit gate.
  install     Write the skills and record a manifest under a home.
  sync        Move the project to its pinned version (inside one) or re-write the machine install (--global, or outside a git repository).
  uninstall   Undo the project (inside one) or the machine install (--global, or outside a git repository).
  status      Show the project's pin and this clone (inside one) or the machine's installed, manifest and latest versions (--global, or outside a git repository).
  update      Check whether a newer release exists.
  upgrade     Install the newer release, then sync.
  doctor      Report the stack's tools: installed, configured, up to date.
  progress    Show roadmap and feature progress from their checkboxes.
  contract    Task contracts: template, check (validate), run (the done-when commands), goal (the /goal condition).
  codex-review  Run the Codex review of <base>..HEAD and record it (--unavailable <reason> records a skip).
  remote      Keep Claude Code's remote-control server running for this git repository, so the Claude app can start sessions here: start, stop, status. start --at-login also starts it at every Windows login, and again within five minutes whenever it is not running (a scheduled task); stop --at-login undoes both. A server stopped with stop stays stopped until the next start.
  sessions    Show the project's recent Claude Code sessions (state, context size, background work still open, tail of the last reply), with their roster by the role each title gives and what the channel's record says of each, the worktrees and each one's feature plan, the running gates and the session each hangs from, the open pull requests, the orchestrator's relief file (its path and last lines) and the channel (the last notices of the record and the last messages between sessions). The board is read-only; --json gives the same data. --watch waits and returns only when the board changes in a way that needs a decision, a notice for the orchestrator among them, or at --timeout. --address <role> (orchestrator, or a work session's number) prints the title of the one other session that holds the role: exit 0 for one, 1 for none with every transcript read, 2 for several or when it cannot tell. --opening "<title>" prints the opening stored for a session (notify --opening) and records in the channel which session read it. --quote <transcript> <line> prints the entry at that line of a transcript only when the user sent it, with its time (exit 1 otherwise).
  notify      Append one notice to the project's channel record under the home (.js-harness/channel/<project>.jsonl), with the time of the clock, the sender's session and the worktree and branch it ran in: js-harness notify --to orchestrator|<number> --kind opened|waiting|closed|note|answer|relieved "<one line>" (an answer also takes --transcript and --line, where the user's words are read). It then prints the address of the role, as sessions --address gives it, so the sender can ring it; it sends no message, and its exit is 0 once the notice is recorded. --relief "<one line>" appends a line stamped by the clock to the orchestrator's relief file; --opening "<title>" stores the opening of a session, read from standard input. A notice is a claim of the session that wrote it, never the user's word.

Environment: JS_HARNESS_HOME, JS_HARNESS_SOURCE, JS_HARNESS_PREFIX override --home/--source/--prefix.
`;

const commands = {
  check: checkMain,
  gate: gateMain,
  init: initMain,
  install: installMain,
  sync: syncMain,
  uninstall: uninstallMain,
  status: statusMain,
  update: updateMain,
  upgrade: upgradeMain,
  doctor: doctorMain,
  progress: progressMain,
  contract: contractMain,
  'codex-review': codexReviewMain,
  remote: remoteMain,
  sessions: sessionsMain,
  notify: notifyMain,
};

async function run(argv, { stdin = process.stdin, stdout = process.stdout, tui = tuiMain } = {}) {
  const [command, ...rest] = argv;

  if (!command) {
    // A real terminal on both ends opens the menu; anything else (a pipe, a script) gets help.
    if (stdin.isTTY && stdout.isTTY) {
      return tui(rest, process.env, undefined, { stdin, stdout });
    }
    console.log(USAGE);
    return 0;
  }

  if (command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }

  if (command in commands) {
    return commands[command](rest);
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

export { run };
