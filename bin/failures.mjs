#!/usr/bin/env node
// `failures`: the register of what went wrong, `docs/FAILURES.md` (see odd/tasks/rule-hierarchy.md,
// "The failures register", and bin/lib/failures.mjs, which reads it). This file is the command and
// the `failures` row of `check`: it reads the register and the files its entries name, all under
// the project, and writes nothing; only an editor writes the register. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { holdsPhrase, parseRegister, summarize } from './lib/failures.mjs';

const REGISTER = 'docs/FAILURES.md';
const USAGE = 'Usage: js-harness failures | failures <id> | failures check [--settled]';

// The end of the row's detail at every gate: how a session learns the register exists, at no token
// per turn.
const HOW_TO_RECORD = `a failure is recorded by hand in ${REGISTER}, as one more "- Seen:" line of its entry or as a new "### <id>" entry (js-harness failures lists them)`;

class FailuresArgError extends Error {}

const readText = (absolute) => fs.readFileSync(absolute, 'utf8');

/** `n` things, in the singular for one: `1 failure`, `2 failures`. */
const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** The content of the file at `file`, a path from the top of `root`, or `null` when it is gone,
 * cannot be read or lies outside `root`: the register is never a reason to open a file of another
 * project. */
function readUnder(root, file, readFile) {
  const absolute = path.resolve(root, file);
  const inside = path.relative(root, absolute);
  if (inside === '' || inside.split(path.sep)[0] === '..' || path.isAbsolute(inside)) return null;
  try {
    return readFile(absolute);
  } catch {
    return null;
  }
}

/** The `holds(path, phrase, { unchecked })` the states are computed with (`entryState`), answered
 * from the files under `cwd`: whether the file holds the phrase, in an unchecked list item when
 * `unchecked`. A file that is gone holds nothing. Each file is read once, however many entries name
 * it. */
export function holdsUnder(cwd, readFile = readText) {
  const root = path.resolve(cwd);
  const texts = new Map();
  return (file, phrase, options) => {
    if (!texts.has(file)) texts.set(file, readUnder(root, file, readFile));
    const text = texts.get(file);
    return text !== null && holdsPhrase(text, phrase, options);
  };
}

/** What the register under `cwd` says: `null` when there is none, else `{ row }`, the `failures` row
 * of the gate, with `{ register, counts }` beside it when the register is read without a fault. */
function readRegister(cwd, readFile) {
  const name = 'failures';
  let text;
  try {
    text = readFile(path.join(cwd, ...REGISTER.split('/')));
  } catch (err) {
    // Only a file that is not there is no register: `ENOENT`, or `ENOTDIR` where `docs` is a file
    // (what POSIX answers for it). One that is there and cannot be read is not known to be clean,
    // and a gate must not hide it.
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    return { row: { name, pass: false, detail: `cannot read ${REGISTER}: ${err.code ?? err.message}` } };
  }
  const register = parseRegister(text);
  if (register.errors.length > 0) {
    const detail = `${REGISTER} is not read: ${count(register.errors.length, 'fault')} to repair in that file`;
    return { row: { name, pass: false, detail, lines: register.errors } };
  }
  const counts = summarize(register, holdsUnder(cwd, readFile));
  const lines = counts.rows.filter((row) => !row.settled).map((row) => `${row.id}  ${row.state}  first seen ${row.firstSeen}`);
  return { row: { name, pass: true, detail: `${numbers(counts).join(', ')}; ${HOW_TO_RECORD}`, lines }, register, counts };
}

/** The four numbers the row and the command both give: the failures, the sightings, the failures
 * seen more than once (whatever their control) and those that are not settled. */
function numbers(counts) {
  return [
    count(counts.entries, 'failure'),
    count(counts.sightings, 'sighting'),
    `${counts.repeated} seen more than once`,
    `${counts.unsettled} not settled`,
  ];
}

/** The `failures` row of the gate, as a list: empty when the project has no `docs/FAILURES.md`, so
 * a project that keeps no register sees no row. The row fails only for what the register alone
 * shows (`parseRegister`'s errors), which the session editing it can always repair. A state that
 * depends on another file changes without any author (a test renamed on another branch, a task
 * checked off), so the entries that are not settled are counted and listed at every gate and fail
 * none; `failures check --settled` is what refuses them, where a contract asks for it. */
export function checkFailures(cwd, { readFile = readText } = {}) {
  const read = readRegister(cwd, readFile);
  return read ? [read.row] : [];
}

/** The row as the gate prints it (`formatRow` of `bin/check.mjs`), for `failures check`. */
function formatRow(row) {
  const lines = (row.lines ?? []).map((line) => `\n      ${line}`).join('');
  return `${row.pass ? 'PASS' : 'FAIL'}  ${row.name}  ${row.detail}${lines}`;
}

/** Walks argv token by token, so a flag or a second word it does not know is a usage error and never
 * a silently ignored one. `check` is the one subcommand; any other word is the id of an entry. */
function parseArgs(argv) {
  const words = [];
  let settled = false;
  for (const token of argv) {
    if (token === '--settled') settled = true;
    else if (token.startsWith('-')) throw new FailuresArgError(`unknown argument: ${token}`);
    else words.push(token);
  }
  if (words.length > 1) throw new FailuresArgError(`unknown argument: ${words[1]}`);
  const check = words[0] === 'check';
  if (settled && !check) throw new FailuresArgError('--settled goes with check');
  return { check, settled, id: check ? undefined : words[0] };
}

/** The lines of `js-harness failures`: the totals, the entries and sightings of each class in the
 * order the classes are declared, and one line per entry, the most seen first, with its state. */
function renderCounts(counts) {
  // The `Was` lines are the controls that did not hold or that left.
  const totals = [...numbers(counts), `${count(counts.was, 'control')} replaced`];
  const width = (texts) => texts.reduce((max, text) => Math.max(max, text.length), 0);
  const classWidth = width(counts.byClass.map((group) => group.class));
  const failuresWidth = width(counts.byClass.map((group) => count(group.entries, 'failure')));
  const idWidth = width(counts.rows.map((row) => row.id));
  const stateWidth = width(counts.rows.map((row) => row.state));
  const seenWidth = width(counts.rows.map((row) => String(row.sightings)));
  return [
    `${REGISTER}  ${totals.join(', ')}`,
    '',
    'By class',
    ...counts.byClass.map(
      (group) => `  ${group.class.padEnd(classWidth)}  ${count(group.entries, 'failure').padEnd(failuresWidth)}  ${count(group.sightings, 'sighting')}`,
    ),
    '',
    'By failure, the most seen first',
    ...counts.rows.map(
      (row) =>
        `  ${String(row.sightings).padStart(seenWidth)}  ${row.id.padEnd(idWidth)}  ${row.class.padEnd(classWidth)}  ${row.state.padEnd(stateWidth)}  first seen ${row.firstSeen}`,
    ),
  ];
}

/** `js-harness failures` prints the totals and one line per entry; `failures <id>` prints one entry
 * whole, with its state; `failures check` runs the gate's row alone and, with `--settled`, also
 * refuses while an entry is not settled, which is how a contract's "Done when" carries the register.
 * Exit 0; 1 when the register is refused, an id is not in it or `--settled` finds an entry that is
 * not settled; 2, with usage on stderr and no file read, for an argument it does not know. With no
 * `docs/FAILURES.md` nothing is recorded, so nothing is refused: it says so and exits 0. */
export async function failuresMain(argv, { cwd = process.cwd(), stdout = console.log, stderr = console.error, readFile = readText } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  const read = readRegister(path.resolve(cwd), readFile);
  if (!read) {
    stdout(`no ${REGISTER}: no failure is recorded`);
    return 0;
  }
  const { row, register, counts } = read;
  // Counts of a register that is refused would be numbers that can be false, so no form gives them.
  if (!row.pass) {
    stdout(formatRow(row));
    return 1;
  }

  if (parsed.check) {
    stdout(formatRow(row));
    if (!parsed.settled || counts.unsettled === 0) return 0;
    stdout(`not settled: ${counts.unsettled} of ${count(counts.entries, 'failure')}`);
    return 1;
  }

  if (parsed.id === undefined) {
    for (const line of renderCounts(counts)) stdout(line);
    return 0;
  }

  const entry = register.entries.find((candidate) => candidate.id === parsed.id);
  if (!entry) {
    stderr(`no entry "${parsed.id}" in ${REGISTER}; js-harness failures lists them`);
    return 1;
  }
  const { state, settled, sightings, firstSeen } = counts.rows.find((candidate) => candidate.id === entry.id);
  stdout(entry.source);
  stdout('');
  stdout(`state: ${state}${settled ? '' : ', not settled'} (${count(sightings, 'sighting')}, first seen ${firstSeen})`);
  return 0;
}
