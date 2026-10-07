# stockroom

A file-backed inventory for one warehouse. An item has a SKU, a name and a quantity; everything is kept
in one JSON file and changed through the `stockroom` command.

## Usage

    stockroom receive <sku> <quantity> [name]   add stock, creating the item when it is new
    stockroom issue <sku> <quantity>            take stock out
    stockroom list                              every item, by SKU
    stockroom snapshot <name>                   copy the state file to snapshots/<name>.json
    stockroom count <sku>=<counted>...          set quantities to what was counted on the shelf
    stockroom undo                              take back the last count
    stockroom report [--low <n>] [--page <n>]   the items, 20 to a page, with the low ones marked
    stockroom export <name> [--low <n>]         write the report to exports/<name>.json

The state file is `stockroom.json` in the working directory, or the file `STOCKROOM_STATE` names. The
command exits 0 when the operation was done and 1, with one line on stderr, when it was not.

A SKU is 2 to 24 capitals, digits and dashes. A quantity is a whole number, zero or more.

## Stocktake

`count` takes one `<sku>=<counted>` for each item that was counted. Each sets the quantity of its item
and leaves an entry in the journal, `counts` in the state file, with the quantity before and after and
the time of the count. `undo` takes back the last entry, as long as its item has not changed since.

`report` marks an item with `!` when its quantity is at or below the threshold: 5, or what `--low` gives.
`--page` picks a page, counted from 1. `export` writes every row of the report, not one page of it.

## Development

    npm test

Node 22 or later, no dependencies.
