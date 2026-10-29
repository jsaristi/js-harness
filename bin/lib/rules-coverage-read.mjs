// The reads behind the harness's directive coverage (F8 S5c-a, odd/tasks/f8-s5c-a-coverage.md): the register
// bin/lib/rules-coverage-data.mjs as text, the sources at the checkout's version, the eval cases and the rules each
// names in its task.json, and the files a control names, all under one root. Shared by `rules check`, which refuses
// what `findings` holds, and `rules coverage`, which reports it all. It writes nothing; the computing is
// ./rules-coverage.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { coverageOf, readCoverageText } from './rules-coverage.mjs';
import { MESSAGE_SOURCES, textSources } from './rules-sources.mjs';

/** Where the register is, from the top of the harness's checkout. */
export const REGISTER_PATH = 'bin/lib/rules-coverage-data.mjs';
const TASKS = 'evals/tasks';

/** The text of `file` under `root`, or `null` when it is not there; a file that is there and cannot be read throws. */
function readOptional(root, file) {
  try {
    return fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EISDIR') return null;
    throw new Error(`cannot read ${file}: ${err.code ?? err.message}`);
  }
}

/** The eval cases under `root`: each folder of `evals/tasks` that holds a `task.json`, with the `rules` it names. */
export function readCases(root) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, ...TASKS.split('/')), { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const cases = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const text = readOptional(root, `${TASKS}/${entry.name}/task.json`);
    if (text === null) continue;
    let task;
    try {
      task = JSON.parse(text);
    } catch (err) {
      throw new Error(`${TASKS}/${entry.name}/task.json is not JSON: ${err.message}`);
    }
    cases.push({ name: entry.name, rules: task?.rules });
  }
  return cases;
}

/** The files of the checkout at `root` that a proof copies: what git tracks or would track there, or, where git gives no
 * answer, every file but those under `.git` and `node_modules`. */
function filesOf(root, spawn) {
  const listed = spawn('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (!listed.error && listed.status === 0) return [...new Set(String(listed.stdout).split('\0').filter(Boolean))];
  const found = [];
  const visit = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== '.git' && entry.name !== 'node_modules') visit(child);
      } else if (entry.isFile()) found.push(child);
    }
  };
  visit('');
  return found;
}

/** Every planted break of `register`'s controls: `{ rule, of, test, break }`, one a check, a bundled rule's included. */
export function plantedBreaks(register) {
  const out = [];
  for (const [rule, control] of Object.entries(register.controls).sort(([a], [b]) => (a < b ? -1 : 1))) {
    for (const item of Array.isArray(control) ? control : [control]) {
      if (item?.level === 'check') out.push({ rule, of: item.of, test: item.test, break: item.break });
    }
  }
  return out;
}

const isText = (value) => typeof value === 'string' && value.length > 0;

// How long one test may run with its break before the proof gives it up as not red.
const PROOF_TIMEOUT_MS = 5 * 60 * 1000;
/** `env` without a single `GIT_*` variable, so a test the gate runs in a hook writes to no repository of the caller, and
 * without `NODE_TEST_CONTEXT`, under which a `node --test` started by a test reports to it and exits 0 on a failure. */
const withoutGit = (env) => Object.fromEntries(Object.entries(env).filter(([key]) => !/^git_/i.test(key) && key !== 'NODE_TEST_CONTEXT'));

/** `rules coverage --prove`: the checkout at `root` copied once into a folder under `tmpdir`, and in it each planted
 * break of `register` applied in turn, its test run with `node --test`, and the file put back. Each result is
 * `{ rule, of, test, path, red, status, baseline }`: a break proves its check only when the test, green without it
 * (`baseline`), goes red with it; a test red without it, or a break whose file is not there, proves nothing. The copy
 * is removed at the end. `spawn` runs git and node. */
export function proveBreaks(root, register, { spawn, tmpdir, env = process.env }) {
  const breaks = plantedBreaks(register);
  if (breaks.length === 0) return [];
  const scratch = fs.mkdtempSync(path.join(tmpdir, 'js-harness-prove-'));
  try {
    for (const file of filesOf(root, spawn)) {
      const from = path.join(root, ...file.split('/'));
      if (!fs.statSync(from, { throwIfNoEntry: false })?.isFile()) continue;
      const to = path.join(scratch, ...file.split('/'));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
    const runTest = (test) => {
      const ran = spawn(process.execPath, ['--test', test], { cwd: scratch, env: withoutGit(env), encoding: 'utf8', timeout: PROOF_TIMEOUT_MS, windowsHide: true });
      return ran.error ? null : ran.status;
    };
    // Each test run once as the checkout holds it: one that is red already, or not there, would go red with any break.
    const baselines = new Map();
    return breaks.map(({ rule, of, test, break: planted }) => {
      const said = { rule, ...(of === undefined ? {} : { of }), test, path: planted?.path };
      // A check not in its shape is a finding of the register's, and nothing of it is run.
      if (!isText(test) || !isText(planted?.path) || !isText(planted?.find) || typeof planted?.replace !== 'string') return { ...said, red: false, status: null, baseline: 'malformed' };
      const target = path.join(scratch, ...planted.path.split('/'));
      const text = fs.statSync(target, { throwIfNoEntry: false })?.isFile() ? fs.readFileSync(target, 'utf8') : null;
      if (text === null || !text.replace(/\r\n/g, '\n').includes(planted.find)) return { ...said, red: false, status: null, baseline: 'no break' };
      if (!baselines.has(test)) baselines.set(test, runTest(test) === 0 ? 'green' : 'red');
      if (baselines.get(test) === 'red') return { ...said, red: false, status: null, baseline: 'red' };
      fs.writeFileSync(target, text.replace(/\r\n/g, '\n').replace(planted.find, () => planted.replace));
      const status = runTest(test);
      fs.writeFileSync(target, text);
      return { ...said, red: status !== 0 && status !== null, status, baseline: 'green' };
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/** How a proof of `proveBreaks` ended, in the words of a report line. */
export function proofSaid({ red, status, baseline }) {
  if (red) return 'went red';
  if (baseline === 'malformed') return 'is not a check of a test and a break { path, find, replace }, so nothing was run';
  if (baseline === 'no break') return 'has no file holding the words its break changes';
  if (baseline === 'red') return 'was red before the break, or is not there, so it proves nothing';
  return status === null ? 'did not finish' : 'stayed green';
}

/** The coverage of the harness's checkout at `root` against `rules`: `{ present: false }` when it holds no register,
 * and otherwise `{ present: true, register, report }` (`coverageOf`). A register that does not read throws. */
export function readCoverage(root, rules) {
  const text = readOptional(root, REGISTER_PATH);
  if (text === null) return { present: false };
  const read = readCoverageText(text);
  if (read.fault) throw new Error(read.fault);
  const version = JSON.parse(readOptional(root, 'package.json') ?? '{"version":"0.0.0"}').version;
  const readFile = (file) => readOptional(root, file);
  const cases = readCases(root);
  const report = coverageOf({
    register: read.register,
    sources: textSources(version, readFile),
    messages: MESSAGE_SOURCES,
    rules,
    cases,
    readFile,
    caseExists: (name) => cases.some((item) => item.name === name),
  });
  return { present: true, register: read.register, report };
}
