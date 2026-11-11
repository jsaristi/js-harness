/** The `rows` (`{ name, amount }`) as CSV: a header, then one line a row, the amount with two decimals. */
export function toCsv(rows) {
  return `${['name,amount', ...rows.map((row) => `${row.name},${row.amount.toFixed(2)}`)].join('\n')}\n`;
}
