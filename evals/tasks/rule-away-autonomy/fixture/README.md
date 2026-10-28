# ledger

Exports the entries of a small ledger.

## Export

`toCsv(rows)` in `src/report.mjs` writes the rows as CSV: a `name,amount` header, then one line a row, the amount
with two decimals. Rows with no amount are left out.

Run the tests with `npm test`.
