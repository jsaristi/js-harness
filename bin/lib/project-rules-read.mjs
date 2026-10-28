// The reads behind a project's own rules: its list `docs/rules.json`, the same list at `HEAD`, the files its rules
// in prose live in, and the ids of its register `docs/FAILURES.md`. Shared by `js-harness rules` and the `rules`
// row of `js-harness check`, so both hold a project to the same check (./project-rules.mjs). It writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseRegister } from './failures.mjs';
import { checkProjectRules, PROJECT_RULES_PATH } from './project-rules.mjs';
import { isDay } from './rules.mjs';

const REGISTER = 'docs/FAILURES.md';

/** The text of `file`, a path from `root` in forward slashes, or `null` when it is not there. A file that is there
 * and cannot be read is an error, never taken for one that is not. */
function readOptional(root, file) {
  try {
    return fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EISDIR') return null;
    throw new Error(`cannot read ${file}: ${err.code ?? err.message}`);
  }
}

const gitShow = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true });

/** The coverage record of the project manifest under `root` (`{ baseline, release }`, which `init` writes, F8
 * S5c-a): `null` when there is no manifest or it records none. A record not in that shape throws: read wrong, it
 * would drop the controls a baseline asks for. */
export function coverageRecord(root, run = gitShow) {
  const where = run('git', ['rev-parse', '--git-path', 'js-harness/manifest.json'], { cwd: root });
  const file = !where.error && where.status === 0 ? path.resolve(root, String(where.stdout).trim()) : path.join(root, '.git', 'js-harness', 'manifest.json');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw new Error(`cannot read the project manifest: ${err.code ?? err.message}`);
  }
  const record = JSON.parse(text).coverage;
  if (record === undefined) return null;
  if (!(record !== null && typeof record === 'object' && isDay(record.baseline) && typeof record.release === 'string')) {
    throw new Error(`the coverage record of ${file} is not { baseline, release }: a day written YYYY-MM-DD and the release that set it`);
  }
  return record;
}

/** The project's list checked, read under `root`, its git top: `{ present: false }` when it keeps no list, and
 * otherwise `{ present: true, rules, findings, notes }`. `sensors` are the names of the sensors `check` runs there.
 * The list at `HEAD` is read with git; when git cannot give it (no commit yet, or the list is new) nothing is
 * compared. The register's ids are read only when it parses with no error: a register that does not parse is the
 * `failures` row's to report. A list deleted whole since `HEAD` is read as an empty list, so each of its rules is
 * the finding a rule deleted from it would be: deleting the file is no way around retiring them. */
export function readProjectRules(root, { sensors = [], run = gitShow } = {}) {
  const current = readOptional(root, PROJECT_RULES_PATH);
  const head = run('git', ['show', `HEAD:${PROJECT_RULES_PATH}`], { cwd: root });
  const headText = !head.error && head.status === 0 ? String(head.stdout ?? '') : null;
  if (current === null && headText === null) return { present: false };
  const text = current ?? JSON.stringify({ format: 1, rules: [] });
  const register = readOptional(root, REGISTER);
  let failureIds = null;
  if (register !== null) {
    const parsed = parseRegister(register);
    if (parsed.errors.length === 0) failureIds = parsed.entries.map((entry) => entry.id);
  }
  const baseline = coverageRecord(root, run)?.baseline ?? null;
  const result = checkProjectRules({ text, headText, readFile: (file) => readOptional(root, file), sensors, failureIds, baseline });
  return { present: true, ...result };
}
