#!/usr/bin/env node
// Tiny dispatcher: `js-harness <command> [...args]`.
import { main as checkMain } from './check.mjs';
import { installMain, syncMain, uninstallMain } from './install.mjs';

const USAGE = `Usage: js-harness <command>

Commands:
  check       Run the budget and test gates.
  install     Write the skills and record a manifest under a home.
  sync        Re-write installed files for the running version.
  uninstall   Remove exactly what install wrote.
`;

const commands = {
  check: checkMain,
  install: installMain,
  sync: syncMain,
  uninstall: uninstallMain,
};

async function run(argv) {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }

  if (command in commands) {
    return commands[command](rest);
  }

  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

run(process.argv.slice(2)).then((code) => process.exit(code));
