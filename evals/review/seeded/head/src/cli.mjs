#!/usr/bin/env node
// The `stockroom` command. The only module that reads the environment, the clock and the command line;
// everything else is given what it needs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatItem, formatItems } from './format.mjs';
import { issue, items, receive } from './inventory.mjs';
import { exportRows, formatPage, LOW_THRESHOLD, pageCount, pageOf, reportRows } from './report.mjs';
import { count, undo } from './stocktake.mjs';
import { openStore } from './store.mjs';
import * as valid from './validate.mjs';

const USAGE = [
  'Usage: stockroom <command>',
  '  receive <sku> <quantity> [name]   add stock, creating the item when it is new',
  '  issue <sku> <quantity>            take stock out',
  '  list                              every item, by SKU',
  '  snapshot <name>                   copy the state file to snapshots/<name>.json',
  '  count <sku>=<counted>...          set quantities to what was counted on the shelf',
  '  undo                              take back the last count',
  '  report [--low <n>] [--page <n>]   the items, 20 to a page, with the low ones marked',
  '  export <name> [--low <n>]         write the report to exports/<name>.json',
].join('\n');

/** The flags among `args` and what is left: `values` maps each of `names` that was given to the word
 * after it, and `rest` holds the words that belong to no flag, in order. A flag given twice, or last
 * with no word after it, is refused. */
function options(args, names) {
  const values = {};
  const rest = [];
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index];
    if (!names.includes(word)) {
      rest.push(word);
    } else if (word in values || index + 1 === args.length) {
      throw new valid.InputError(`${word} takes one value, and is given once`);
    } else {
      values[word] = args[index + 1];
      index += 1;
    }
  }
  return { values, rest };
}

/** The threshold of a report: what `--low` gave, or the usual one. */
const thresholdOf = (values) => (values['--low'] === undefined ? LOW_THRESHOLD : valid.wholeNumber(values['--low'], { min: 0, what: 'a threshold' }));

/** Runs one command and gives its exit code: 0 when it was done, 1 with one line on `err` when it was
 * not, 2 with the usage when it is no command. `stateFile` is where the state is kept; what the command
 * prints goes to `out`, and `now` gives the time a count is made at. */
export async function main(argv, { stateFile, out = console.log, err = console.error, now = () => new Date() }) {
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
      case 'count': {
        if (args.length === 0) throw new valid.InputError('count takes one <sku>=<counted> or more');
        const at = now().toISOString();
        const entries = await Promise.all(args.map((pair) => count(store, { ...valid.countPair(pair), at })));
        out(entries.map((entry) => `${entry.sku}: ${entry.before} -> ${entry.after}`).join('\n'));
        return 0;
      }
      case 'undo': {
        const entry = await undo(store);
        out(`${entry.sku}: back to ${entry.before}`);
        return 0;
      }
      case 'report': {
        const { values, rest } = options(args, ['--low', '--page']);
        if (rest.length > 0) throw new valid.InputError(`report takes no ${JSON.stringify(rest[0])}`);
        const number = values['--page'] === undefined ? 1 : valid.wholeNumber(values['--page'], { min: 1, what: 'a page number' });
        const rows = reportRows(await items(store), thresholdOf(values));
        out(formatPage(pageOf(rows, number), { number, pages: pageCount(rows) }));
        return 0;
      }
      case 'export': {
        const { values, rest } = options(args, ['--low']);
        if (rest.length !== 1) throw new valid.InputError('export takes one name');
        const target = path.join(path.dirname(stateFile), 'exports', `${rest[0]}.json`);
        const rows = reportRows(await items(store), thresholdOf(values));
        const written = await exportRows(target, rows, { warn: err });
        out(`${written} rows written to ${target}`);
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
