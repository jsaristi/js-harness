# stockroom

A file-backed inventory for one warehouse: items with a SKU, a name and a quantity, kept in one JSON file
and changed through the `stockroom` command.

## How it works
- `src/store.mjs` reads and writes the state file. A write goes to a temporary file that is then renamed,
  so a reader never sees half a document.
- `src/inventory.mjs` holds the operations on items. Each one loads the state, changes it and awaits the
  save before it returns, so a command that has printed its result has stored it.
- `src/validate.mjs` checks what comes from the command line before anything uses it. A value that
  becomes part of a file name goes through `fileName` first.
- `src/format.mjs` turns items into the text the command prints.
- `src/cli.mjs` is the entry point, and the only module that reads the environment and the clock. It
  exits 0 when the operation was done and 1, with one line on stderr, when it was not.

## Conventions
- No dependencies, ES modules, Node 22 or later.
- An operation that changes the state loads it once and saves it once.
- A function does not change an argument it was given, apart from the state an operation loaded itself.
- An error is handled where something can be done about it, or left to reach `src/cli.mjs`.
- Feature work is described in `odd/tasks/<feature>.md` before it is written.
- Tests are in `tests/`, named `*.spec.mjs`, and run with `npm test`.
