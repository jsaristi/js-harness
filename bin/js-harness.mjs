#!/usr/bin/env node
// Tiny dispatcher: `js-harness <command> [...args]`.
import { main as checkMain } from './check.mjs';

const USAGE = `Usage: js-harness <command>

Commands:
  check   Run the budget and test gates.
`;

async function run(argv) {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }

  if (command === 'check') {
    return checkMain(rest);
  }

  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

run(process.argv.slice(2)).then((code) => process.exit(code));
