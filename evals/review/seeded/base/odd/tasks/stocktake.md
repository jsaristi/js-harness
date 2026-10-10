# Stocktake: counts, a low-stock report and its export

## Goal
A warehouse worker records what they counted on the shelf, sees which items are running low, and hands
that list to purchasing as a file, all through the `stockroom` command.

## Why
The quantities in the state file drift from the shelf: items get mislaid, or leave without an `issue`.
Today the only way to bring a quantity back in line is to issue or receive the difference, which leaves
no trace of why the number changed. And purchasing asks every week which items are nearly out, which
someone answers by reading `stockroom list` by eye.

## Done when
- `npm test` exits 0
- `stockroom count <sku>=<counted>...` sets the quantity of each item to what was counted and adds one
  journal entry for each, with the quantity before and after and the time of the count; every one of
  them is stored by the time the command prints its result
- A count for a SKU that is not in the inventory is refused: the command exits 1 and stores nothing,
  since a new item comes in through `receive`, with its name
- `stockroom undo` takes back the last count: the item has the quantity it had before, the entry is gone
  from the journal, and both are stored by the time the command prints its result
- `stockroom report [--low <n>] [--page <n>]` lists the items by SKU, 20 to a page, and marks those whose
  quantity is at or below the threshold, which is 5 unless `--low` gives another
- `stockroom export <name> [--low <n>]` writes the whole report to `exports/<name>.json` beside the state
  file, and exits 1 when the file could not be written
- Every value from the command line is checked before it is used, as `AGENTS.md` asks

## Out of scope
- Counting by location or by batch: an item has one quantity.
- Changing or removing journal entries other than the last one.
- Formats other than JSON for the export.

## Constraints
- No dependencies.
- No module but `src/cli.mjs` reads the clock: the time of a count is passed in.
