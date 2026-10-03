const NEEDS_QUOTES = /[",\r\n]/;

function field(value) {
  const text = String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 rows: `headings` first, then one row per entry of `rows`. Returns the lines, each ending with CRLF. */
export function csvLines(headings, rows) {
  return [headings, ...rows].map((cells) => `${cells.map(field).join(',')}\r\n`);
}
