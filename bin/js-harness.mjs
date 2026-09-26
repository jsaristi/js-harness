#!/usr/bin/env node
// Tiny dispatcher: `js-harness <command> [...args]`.
import { main as checkMain } from './check.mjs';
import { installMain, syncMain, uninstallMain } from './install.mjs';
import { statusMain, updateMain, upgradeMain } from './update.mjs';
import { tuiMain } from './tui.mjs';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: js-harness <command>

Commands:
  check       Run the budget and test gates.
  install     Write the skills and record a manifest under a home.
  sync        Re-write installed files for the running version.
  uninstall   Remove exactly what install wrote.
  status      Show installed, manifest and latest available versions.
  update      Check whether a newer release exists.
  upgrade     Install the newer release, then sync.
`;

const commands = {
  check: checkMain,
  install: installMain,
  sync: syncMain,
  uninstall: uninstallMain,
  status: statusMain,
  update: updateMain,
  upgrade: upgradeMain,
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
  run(process.argv.slice(2)).then((code) => process.exit(code));
}

export { run };
