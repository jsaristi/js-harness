#!/usr/bin/env node
// Tiny dispatcher: `js-harness <command> [...args]`.
import { main as checkMain } from './check.mjs';
import { installMain, syncMain, uninstallMain } from './install.mjs';
import { initMain } from './init.mjs';
import { statusMain, updateMain, upgradeMain } from './update.mjs';
import { doctorMain } from './doctor.mjs';
import { progressMain } from './progress.mjs';
import { contractMain } from './contract.mjs';
import { codexReviewMain } from './codex-review.mjs';
import { remoteMain } from './remote.mjs';
import { tuiMain } from './tui.mjs';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: js-harness <command>

Commands:
  check       Run the budget and test gates.
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
  remote      Keep Claude Code's remote-control server running for this git repository, so the Claude app can start sessions here: start, stop, status. start --at-login also starts it at every Windows login; stop --at-login undoes that.

Environment: JS_HARNESS_HOME, JS_HARNESS_SOURCE, JS_HARNESS_PREFIX override --home/--source/--prefix.
`;

const commands = {
  check: checkMain,
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
