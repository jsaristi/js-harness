#!/usr/bin/env node
// The `stockroom` command. The only module that reads the environment and the command line; everything
// else is given what it needs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatItem, formatItems } from './format.mjs';
import { issue, items, receive } from './inventory.mjs';
import { openStore } from './store.mjs';
import * as valid from './validate.mjs';

const USAGE = [
  'Usage: stockroom <command>',
  '  receive <sku> <quantity> [name]   add stock, creating the item when it is new',
  '  issue <sku> <quantity>            take stock out',
  '  list                              every item, by SKU',
  '  snapshot <name>                   copy the state file to snapshots/<name>.json',
].join('\n');

/** Runs one command and gives its exit code: 0 when it was done, 1 with one line on `err` when it was
 * not, 2 with the usage when it is no command. `stateFile` is where the state is kept; what the command
 * prints goes to `out`. */
export async function main(argv, { stateFile, out = console.log, err = console.error }) {
  const [command, ...args] = argv;
  const store = openStore(stateFile);
  try {
    switch (command) {
      case 'receive': {
        const name = args[2] === undefined ? undefined : valid.itemName(args[2]);
        out(formatItem(await receive(store, { sku: valid.sku(args[0]), quantity: valid.quantity(args[1]), name })));
        return 0;
      }
      case 'issue': {
        out(formatItem(await issue(store, { sku: valid.sku(args[0]), quantity: valid.quantity(args[1]) })));
        return 0;
      }
      case 'list': {
        out(formatItems(await items(store)));
        return 0;
      }
      case 'snapshot': {
        const target = path.join(path.dirname(stateFile), 'snapshots', `${valid.fileName(args[0])}.json`);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(stateFile, target);
        out(`snapshot written to ${target}`);
        return 0;
      }
      default: {
        err(USAGE);
        return 2;
      }
    }
  } catch (error) {
    err(`stockroom: ${error.message}`);
    return 1;
  }
}

const invoked = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const stateFile = process.env.STOCKROOM_STATE ?? path.join(process.cwd(), 'stockroom.json');
  process.exitCode = await main(process.argv.slice(2), { stateFile });
}
