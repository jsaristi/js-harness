// The index of `docs/README.md`, the entry document of a cold audit (odd/tasks/audit-pack.md, spec 1): one table row
// for every file and folder directly under `docs/`, each with one of four statuses and, for one that is no longer
// live, what superseded it or where its result lives. This module reads the table and says what it lacks; the
// `docs` row of `check` hands it the text and the entries of `docs/`, so a document added without its row stops the
// commit and the index cannot fall behind the folder. Pure: it reads no file.

export const ENTRY_PATH = 'docs/README.md';

/** What a document can be: in force and kept true; kept as written; true when written and superseded; work that ended. */
export const STATUSES = Object.freeze(['live', 'frozen', 'historical', 'closed']);

/** The cells of a Markdown table row, trimmed, without the outer pipes. */
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

/** The heading the index stands under, so another table of the page holds none of its rows. */
export const INDEX_HEADING = '## Index';

/** The rows of the index in `text`: each table row under `INDEX_HEADING`, up to the next `## ` heading, whose first
 * cell is one path in backticks, as `{ path, status, successor, line }`, its line counted from 1. */
export function parseIndex(text) {
  const rows = [];
  let inIndex = false;
  text.split(/\r?\n/).forEach((line, index) => {
    if (/^##\s/.test(line)) inIndex = line.trim() === INDEX_HEADING;
    if (!inIndex || !line.trim().startsWith('|')) return;
    const [first, status = '', successor = ''] = cells(line);
    const named = /^`([^`]+)`$/.exec(first);
    if (named) rows.push({ path: named[1], status, successor, line: index + 1 });
  });
  return rows;
}

/** What the index in `text` lacks against `entries`, the files and folders directly under `docs/` (a folder written
 * with its closing `/`), and `files`, the tracked files: a row of nothing there, a row twice, a status of none of
 * `STATUSES`, a status that is not live with no successor, and an entry with no row. A tracked file inside a folder of
 * `docs/` may have its own row, which overrides its folder's, as a live format among records of one kind. Empty when
 * the index is whole. */
export function indexFindings(text, entries, files = []) {
  const findings = [];
  const first = new Map();
  const deeper = new Set(files.filter((file) => file.startsWith('docs/') && file.split('/').length > 2));
  for (const row of parseIndex(text)) {
    const at = `${ENTRY_PATH}:${row.line}: \`${row.path}\``;
    if (first.has(row.path)) findings.push(`${at} has a row already, at line ${first.get(row.path)}`);
    else first.set(row.path, row.line);
    if (!entries.includes(row.path) && !deeper.has(row.path)) findings.push(`${at} is not a file or folder directly under docs/, nor a tracked file of one of its folders`);
    else if (!STATUSES.includes(row.status)) findings.push(`${at} has the status "${row.status}", not one of ${STATUSES.join(', ')}`);
    else if (row.status !== 'live' && row.status !== 'frozen' && row.successor.trim() === '') findings.push(`${at} is ${row.status} and names no successor or where its result lives`);
  }
  for (const entry of entries) if (!first.has(entry)) findings.push(`${entry} has no row in the index of ${ENTRY_PATH}`);
  return findings;
}
