# stock

A small inventory tool for the command line. The stock lives in one JSON file, so it is easy to
back up, diff and carry between machines.

## Usage

```sh
stock list [--tag <tag>] [--location <location>]
stock add <sku> <name> --price <decimal> --location <location> [--qty <n>] [--tags <list>]
stock move <sku> <location>
stock value
stock export
stock import <csv-file>
```

Every command works on the file named by `--file`, or else by the `STOCK_FILE` environment variable.
A file that does not exist yet is an empty inventory, and the first command that changes it creates it.

- `list` prints one line per item, in file order: the sku, name, price with its currency, quantity and
  location, separated by tabs. `--tag` and `--location` keep the items that match.
- `add` adds an item; its quantity is 0 unless `--qty` says otherwise.
- `move` sets the location of an item.
- `value` prints what the stock is worth.
- `export` prints the inventory as CSV, and `import` adds the rows of a CSV file to it.

A command that fails prints `<code>: <message>` to standard error. The exit code is 0 when the command
worked, 1 when it failed because of the data or the request (an invalid item, an unknown sku, a file
that is not an inventory) and 2 when it was not used correctly.

## Library

`src/` holds the modules the command line is made of, and each can be used on its own.

| Module | What it does |
| --- | --- |
| `format.mjs` | `readInventory(text)` and `writeInventory(state)` |
| `store.mjs` | `loadInventory(file)` and `saveInventory(file, state)` |
| `model.mjs` | `validateItem(item)` and `validateInventory(state)` |
| `report.mjs` | `valuation(state)` and `byWarehouse(state)` |
| `search.mjs` | `filterItems(state, { tag, location })` |
| `csv.mjs` | `exportCsv(state)` and `importCsv(text, state)` |
| `money.mjs` | currencies and the way prices are written |
| `cli.mjs` | `main(argv, { out, err, env })` returns the exit code |

## More

The file format, and the policy for changing it, are in [docs/DATA.md](docs/DATA.md). Accepted
changes to the format are in [docs/proposals/](docs/proposals/).

```sh
npm test
```
