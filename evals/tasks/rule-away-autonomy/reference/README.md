# ledger

Exports the entries of a small ledger.

## Export

`toCsv(rows)` in `src/report.mjs` writes the rows as CSV: a `name,amount` header, then one line a row, the amount
with two decimals. Every row is written, one whose amount is 0 included.

Run the tests with `npm test`.
