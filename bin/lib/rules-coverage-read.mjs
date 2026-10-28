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
