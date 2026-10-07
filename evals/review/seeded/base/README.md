# stockroom

A file-backed inventory for one warehouse. An item has a SKU, a name and a quantity; everything is kept
in one JSON file and changed through the `stockroom` command.

## Usage

    stockroom receive <sku> <quantity> [name]   add stock, creating the item when it is new
    stockroom issue <sku> <quantity>            take stock out
    stockroom list                              every item, by SKU
    stockroom snapshot <name>                   copy the state file to snapshots/<name>.json

The state file is `stockroom.json` in the working directory, or the file `STOCKROOM_STATE` names. The
command exits 0 when the operation was done and 1, with one line on stderr, when it was not.

A SKU is 2 to 24 capitals, digits and dashes. A quantity is a whole number, zero or more.

## Development

    npm test

Node 22 or later, no dependencies.
