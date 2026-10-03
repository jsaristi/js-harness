import fs from 'node:fs';
import { exportCsv, importCsv } from './csv.mjs';
import { InventoryError, validateInventory } from './model.mjs';
import { formatAmount } from './money.mjs';
import { valuation } from './report.mjs';
import { filterItems } from './search.mjs';
import { loadInventory, saveInventory } from './store.mjs';

const USAGE = 'usage: stock <list|add|move|value|export|import> [--file <path>] ...';

/** `state` when every item is valid, else the first problem as an error. */
function checked(state) {
  const [first] = validateInventory(state);
  if (first) throw new InventoryError(first.code, `item ${state.items[first.index].sku}: ${first.field} is not valid`);
  return state;
}

/**
 * Fails with a usage error unless every value is there.
 * @param {string} usage
 * @param {...unknown} values
 */
const needs = (usage, ...values) => {
  if (values.includes(undefined)) throw new InventoryError('EUSAGE', `usage: stock ${usage}`);
};

/** A command gets the inventory and what the command line holds; it returns the inventory to save, if it changed. */
const commands = {
  list(state, { flags, out }) {
    for (const item of filterItems(state, { tag: flags.get('tag'), location: flags.get('location') })) {
      const price = `${formatAmount(item.price, state.currency)} ${state.currency}`;
      out(`${[item.sku, item.name, price, item.qty, item.location].join('\t')}\n`);
    }
  },

  add(state, { args: [sku, name], flags }) {
    needs('add <sku> <name> --price <decimal> --location <location> [--qty <n>] [--tags <list>]', sku, name, flags.get('price'), flags.get('location'));
    const item = { sku, name, price: Number(flags.get('price')), qty: Number(flags.get('qty') ?? 0), location: flags.get('location'), tags: flags.get('tags') ?? '' };
    return checked({ ...state, items: [...state.items, item] });
  },

  move(state, { args: [sku, location] }) {
    needs('move <sku> <location>', sku, location);
    if (!state.items.some((item) => item.sku === sku)) throw new InventoryError('ENOSKU', `no item has the sku ${sku}`);
    return checked({ ...state, items: state.items.map((item) => (item.sku === sku ? { ...item, location } : item)) });
  },

  value(state, { out }) {
    out(`${formatAmount(valuation(state), state.currency)} ${state.currency}\n`);
  },

  export(state, { out }) {
    out(exportCsv(state));
  },

  import(state, { args: [path], out }) {
    needs('import <csv-file>', path);
    let text;
    try {
      text = fs.readFileSync(path, 'utf8');
    } catch {
      throw new InventoryError('EUSAGE', `cannot read ${path}`);
    }
    const next = importCsv(text, state);
    out(`imported ${next.items.length - state.items.length} items\n`);
    return next;
  },
};

/** Positional arguments, and the `--name value` pairs by name. */
function parseArgs(argv) {
  const args = [];
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) {
      args.push(argv[i]);
    } else if (i + 1 < argv.length) {
      flags.set(argv[i].slice(2), argv[i + 1]);
      i += 1;
    } else {
      throw new InventoryError('EUSAGE', `${argv[i]} needs a value`);
    }
  }
  return { args, flags };
}

const exitCodeOf = (error) => (error.code === 'EUSAGE' ? 2 : 1);

/** Runs one command; `ctx` holds `out` and `err` (each takes text) and `env`. Returns the exit code. */
export function main(argv, { out, err, env = process.env }) {
  try {
    const {
      args: [name, ...args],
      flags,
    } = parseArgs(argv);
    if (!Object.hasOwn(commands, name)) throw new InventoryError('EUSAGE', USAGE);
    const file = flags.get('file') ?? env.STOCK_FILE;
    if (file === undefined) throw new InventoryError('EUSAGE', 'no inventory file: pass --file or set STOCK_FILE');
    const state = loadInventory(file);
    const next = commands[name](state, { args, flags, out });
    if (next !== undefined) saveInventory(file, next);
    return 0;
  } catch (error) {
    if (!(error instanceof InventoryError)) throw error;
    err(`${error.code}: ${error.message}\n`);
    return exitCodeOf(error);
  }
}
