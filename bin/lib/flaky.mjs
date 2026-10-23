// Flaky tests: the files a red suite names, rerun once alone; one that passes then is quarantined in a committed
// ledger, docs/FLAKY.md, and does not block while its entry stands (odd/tasks/flaky-ledger.md). Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { parseRegister } from './failures.mjs';
import { testFilesOf } from './select-tests.mjs';

// The colours a reporter may write, which would hide the words around them.
const COLOUR = /\u001b\[[0-9;]*m/g;
// The characters of a path the rerun names on its command line unquoted: none that a shell reads.
const SAFE_PATH = /^[A-Za-z0-9._/-]+$/;

/** The test files a red run of node's spec reporter names, in the order it names them, each once: the
 * `test at <path>:<line>:<col>` lines after its `✖ failing tests:` summary, with `\` read as `/`, kept only
 * when every path is one of `testFiles` (paths from the repository's root) and holds only characters no shell
 * reads (`SAFE_PATH`), since the rerun is a command line on every route. A `test at` line before the summary is
 * a test's own output. One failure in a file that is no test of the suite (a helper) or not safe to name means
 * no file at all: a rerun of the others alone could pass and hide it, so the red run blocks as it is. */
export function failedTestFiles(output, testFiles) {
  const text = String(output ?? '').replace(COLOUR, '');
  const at = text.indexOf('✖ failing tests:');
  if (at === -1) return [];
  const known = new Set(testFiles);
  const named = [];
  // Each failed test of the summary is a `✖ <name>` line after its `test at` line; one with none names no file.
  let located = false;
  for (const line of text.slice(at + '✖ failing tests:'.length).split(/\r?\n/)) {
    if (line.trim().startsWith('✖ ')) {
      if (!located) return [];
      located = false;
      continue;
    }
    const found = /^test at (.+):\d+:\d+$/.exec(line.trim());
    if (!found) continue;
    located = true;
    const file = found[1].replace(/\\/g, '/');
    if (!known.has(file) || !SAFE_PATH.test(file)) return [];
    if (!named.includes(file)) named.push(file);
  }
  return named;
}

// The ledger (odd/tasks/flaky-ledger.md, Design 3 to 5): docs/FLAKY.md, written by hand and committed, one
// `### <test file>` entry with `- Owner:`, `- Expires: YYYY-MM-DD` and `- Failure: <id in docs/FAILURES.md>`.
// An entry counts through the day it expires; after it, its file blocks again.
export const LEDGER = 'docs/FLAKY.md';
const FIELDS = ['Owner', 'Expires', 'Failure'];
const ADD = `to quarantine it, add to ${LEDGER} "### <file>" with "- Owner:", "- Expires: YYYY-MM-DD" and "- Failure: <id in docs/FAILURES.md>", and commit it`;

/** `n` things, in the singular for one. */
const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Whether `text` is a day of the calendar written YYYY-MM-DD. */
function isDay(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The local calendar day of `date`, YYYY-MM-DD: the day an expiry is read against. */
export function localDay(date = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/** The entries of the ledger's `markdown` and the faults that keep it from being read. Text before the
 * first entry, and any line of an entry that is no `- <Field>:` line, is for people and is skipped. */
export function parseLedger(markdown) {
  const entries = [];
  const errors = [];
  let open = null;
  const close = () => {
    if (open === null) return;
    for (const field of FIELDS) if (!(field in open.fields)) open.errors.push(`${open.file}: no "- ${field}:" line`);
    errors.push(...open.errors);
    if (open.errors.length === 0) entries.push({ file: open.file, owner: open.fields.Owner, expires: open.fields.Expires, failure: open.fields.Failure });
    open = null;
  };
  const seen = new Set();
  for (const raw of String(markdown).split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^### (.+)$/.exec(line);
    if (heading) {
      close();
      const file = heading[1].trim();
      open = { file, fields: {}, errors: seen.has(file) ? [`${file}: a second entry for the same file`] : [] };
      seen.add(file);
      continue;
    }
    if (open === null) continue;
    const field = /^- ([A-Z][A-Za-z]*):\s*(.*)$/.exec(line);
    if (!field) continue;
    const [, name, value] = field;
    if (!FIELDS.includes(name)) open.errors.push(`${open.file}: "- ${name}:" is no field of an entry, which has "- Owner:", "- Expires:" and "- Failure:"`);
    else if (name in open.fields) open.errors.push(`${open.file}: "- ${name}:" is written twice`);
    else if (value.trim() === '') {
      open.fields[name] = value;
      open.errors.push(`${open.file}: "- ${name}:" is empty`);
    }
    else if (name === 'Expires' && !isDay(value)) {
      open.fields[name] = value;
      open.errors.push(`${open.file}: in Expires, "${value}" is no date: a date is written YYYY-MM-DD`);
    } else open.fields[name] = value;
  }
  close();
  return { entries, errors };
}

/** The `flaky` row of the gate, as a list: empty when there is no ledger (`text` null), so a project that
 * keeps none sees no row. It fails for what the ledger alone shows, and for an entry whose file is no test
 * of the repository (`testFiles`) or whose failure is not in docs/FAILURES.md (`failureIds`, null when the
 * register cannot be read or does not parse whole, and then not asked). An expired entry fails nothing: it is listed, and its file
 * blocks again at the rerun. */
export function ledgerRow(text, { testFiles, failureIds, today }) {
  if (text === null) return [];
  const name = 'flaky';
  const read = parseLedger(text);
  const faults = [...read.errors];
  for (const one of read.entries) {
    if (!testFiles.includes(one.file)) faults.push(`${one.file}: no test file of the repository has that path`);
    else if (failureIds !== null && !failureIds.includes(one.failure)) faults.push(`${one.file}: no entry "${one.failure}" in docs/FAILURES.md`);
  }
  if (faults.length > 0) return [{ name, pass: false, detail: `${LEDGER} is not read: ${count(faults.length, 'fault')} to repair in that file`, lines: faults }];
  const expired = read.entries.filter((one) => one.expires < today);
  const detail = `${LEDGER} quarantines ${count(read.entries.length, 'test file')}, ${read.entries.length - expired.length} of them current; an expired entry no longer counts, so its file blocks again`;
  return [{ name, pass: true, detail, lines: expired.map((one) => `${one.file}  expired ${one.expires}  owner ${one.owner}`) }];
}

/** What a rerun of the failed test files means (`rerun` is `{ files, pass, detail }`), against the ledger's
 * `entries` on `today`: `pass` is whether the tests stop blocking, which needs a rerun that passed and a
 * current entry for every file, and `row` is the INFO row `rerun` that says why. */
export function judgeRerun(rerun, entries, today) {
  const name = 'rerun';
  const files = count(rerun.files.length, 'failed test file');
  if (!rerun.pass) {
    return { pass: false, row: { name, pass: true, info: true, detail: `the ${files} ran once more, alone, and failed again (${rerun.detail}): the tests block`, lines: [...rerun.files] } };
  }
  const entryOf = (file) => entries.find((one) => one.file === file) ?? null;
  const lines = [];
  let uncovered = 0;
  for (const file of rerun.files) {
    const one = entryOf(file);
    if (one !== null && one.expires >= today) lines.push(`${file}  quarantined until ${one.expires} (${one.failure})`);
    else {
      uncovered += 1;
      lines.push(one === null ? `${file}  not in ${LEDGER}: ${ADD}` : `${file}  its entry expired ${one.expires}: ${ADD}`);
    }
  }
  const detail = uncovered === 0
    ? `the ${files} ran once more, alone, and passed: quarantined in ${LEDGER}, ${rerun.files.length === 1 ? 'it does' : 'they do'} not block`
    : `the ${files} ran once more, alone, and passed; ${uncovered} of them ${uncovered === 1 ? 'has' : 'have'} no current entry in ${LEDGER}, so the tests block`;
  return { pass: uncovered === 0, row: { name, pass: true, info: true, detail, lines } };
}

/** The text of the ledger under `cwd`, or `null` when there is none: a file that is not there (`ENOENT`, or
 * `ENOTDIR` where `docs` is a file). One that is there and cannot be read throws, so a gate does not hide it. */
function readLedgerText(cwd, readFile = (file) => fs.readFileSync(file, 'utf8')) {
  try {
    return readFile(path.join(cwd, ...LEDGER.split('/')));
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw err;
  }
}

/** The entries of the ledger under `cwd` that the rerun is judged against: none when there is no ledger or it
 * cannot be read whole, since then the static `flaky` row has already failed the gate. */
export function ledgerEntries(cwd, readFile) {
  try {
    const text = readLedgerText(cwd, readFile);
    if (text === null) return [];
    const read = parseLedger(text);
    return read.errors.length > 0 ? [] : read.entries;
  } catch {
    return [];
  }
}

/** The static `flaky` row of the gate under `cwd` (`ledgerRow`), with the test files of the repository and the
 * ids of docs/FAILURES.md read from it; a ledger that cannot be read is one failed row. */
export function checkLedger(cwd, { readFile = (file) => fs.readFileSync(file, 'utf8'), today = localDay() } = {}) {
  let text;
  try {
    text = readLedgerText(cwd, readFile);
  } catch (err) {
    return [{ name: 'flaky', pass: false, detail: `cannot read ${LEDGER}: ${err.code ?? err.message}` }];
  }
  if (text === null) return [];
  // Asked only of a register that parses whole: the entries of a damaged one are not all of them, so an id missing
  // from them is not unknown (the `failures` row reports the damage, as project-rules-read does).
  let failureIds = null;
  try {
    const register = parseRegister(readFile(path.join(cwd, 'docs', 'FAILURES.md')));
    if (register.errors.length === 0) failureIds = register.entries.map((one) => one.id);
  } catch {
    failureIds = null;
  }
  return ledgerRow(text, { testFiles: testFilesOf(cwd), failureIds, today });
}
