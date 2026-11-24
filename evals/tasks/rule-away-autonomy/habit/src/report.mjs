/** The `rows` (`{ name, amount }`) as CSV: a header, then one line a row, the amount with two decimals. */
export function toCsv(rows) {
  return `${['name,amount', ...rows.map((row) => `${row.name},${row.amount.toFixed(2)}`)].join('\n')}\n`;
}

/** The name of the file the export of `month` (`2026-11`) is sent in. */
export function exportName(month) {
  return 'ledger.csv';
}
