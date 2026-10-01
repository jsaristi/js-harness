/** Lays `rows` out under `headings` in aligned columns and returns the lines. Every cell is a string. */
export function formatTable(headings, rows) {
  const widths = headings.map((heading, index) => Math.max(heading.length, ...rows.map((row) => row[index].length)));
  const line = (cells) => cells.map((cell, index) => cell.padEnd(widths[index])).join('  ').trimEnd();
  return [line(headings), ...rows.map(line)];
}
