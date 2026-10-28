#!/usr/bin/env node
// The record of an eval case's proof that it tells its rules apart (F8 S5c-a, `odd/tasks/f8-s5c-a-coverage.md`, S4):
// the case runs on the current arm and on the arm without the rules it names (`current-without-rule-<id>`,
// `evals/without.mjs`), and `evals/proofs/rules/<case>.json` keeps what each scored, at what cost and on which texts.
// The run is paid and his; this writes the record from the two results files, and `evals/tasks.test.mjs` reads it on
// every gate, for free: a record is current while the case's files and its rules' texts are the ones it ran on, and
// it proves the case only when the arm without scored below the current arm. Zero deps, plain Node.
//
//   node evals/rule-proof.mjs <case> <current results.json> <without results.json>
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cutSpans, tiesOf } from '../bin/lib/rules-coverage.mjs';
import { RULES } from '../bin/lib/rules-data.mjs';
import { textSources } from '../bin/lib/rules-sources.mjs';
import { readWorkspaceCommit } from './suite.mjs';

/** Where the records are, from the top of the checkout: one `<case>.json` a case that names rules. */
export const PROOFS = 'evals/proofs/rules';
/** The trials a proof takes on each arm: 14.4's "on both arms, twice each". */
export const MIN_TRIALS = 2;
const FORMAT = 1;
const PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** The arm that takes out the `rules` a case names: one or two, since an arm takes out at most two components. */
export function armOf(rules) {
  if (rules.length === 0) throw new Error('the case names no rule, so it has no arm without them');
  if (rules.length > 2) throw new Error(`the case names ${rules.length} rules, and an arm takes out at most two`);
  return `current-without-${rules.map((id) => `rule-${id}`).sort().join('_')}`;
}

/** The SHA-256 of the case folder `dir`: each file's path and its text with `\r\n` read as `\n`, in path order. */
export function caseDigest(dir) {
  const files = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const child = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
    }
  };
  walk('');
  return sha(files.sort().map((rel) => `${rel}\0${fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n')}\n`).join(''));
}

/** The SHA-256 of what the `sources` (`{ id, text }`) say of the rules `ids`: each span tied to one of them, by its id. */
export function ruleDigest(ids, sources) {
  const lines = [];
  for (const rule of [...ids].sort()) {
    for (const source of [...sources].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      for (const span of cutSpans(source.text)) if (tiesOf(span.text, RULES).includes(rule)) lines.push(`${rule}\0${source.id}\0${span.id}\n`);
    }
  }
  return sha(lines.join(''));
}

/** What the `results` of one run say of the case `name` on the arm `arm`: `{ run, arm, trials, score }` and its cost. */
function armScore(results, name, arm) {
  const trials = (results.trials ?? []).filter((item) => item.task === name && item.config === arm && typeof item.score === 'number');
  if (trials.length < MIN_TRIALS) throw new Error(`${trials.length} trial${trials.length === 1 ? '' : 's'} of ${name} on ${arm} in ${results.name}: a proof takes ${MIN_TRIALS}`);
  const score = trials.reduce((sum, item) => sum + item.score, 0) / trials.length;
  return { line: { run: results.name, arm, trials: trials.length, score }, costUsd: trials.reduce((sum, item) => sum + (item.costUsd ?? 0), 0) };
}

const CLEAN_COMMIT = /^[0-9a-f]{40,64}$/;

/** The commit of the checkout at `root` a proof is written at, as `readWorkspaceCommit` reads it, with `+untracked`
 * after it when a file git does not track is there outside `evals/results` and `evals/proofs`: `caseDigest` reads
 * every file of a case folder, so an untracked one would be digested as if the runs had run on it. */
export function proofCommit({ spawn, root }) {
  const commit = readWorkspaceCommit({ spawn, root });
  if (commit === null || !CLEAN_COMMIT.test(commit)) return commit;
  const listed = spawn('git', ['-C', root, 'ls-files', '--others', '--exclude-standard', '--', '.', ':(exclude)evals/results', ':(exclude)evals/proofs'], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (listed.error || listed.status !== 0) return null;
  return String(listed.stdout).trim() === '' ? commit : `${commit}+untracked`;
}

/** The record of the case `name` that names `rules`, from the results of its `current` run and its `without` run.
 * `digests` are read from the checkout at `commit`, so each run must have run on that same commit, clean (its
 * `stack.jsHarness`, `evals/suite.mjs`): a run of other texts would be stamped with digests it never ran on. */
export function buildRecord({ name, rules, digests, date, commit, current, without }) {
  if (typeof commit !== 'string' || !CLEAN_COMMIT.test(commit)) throw new Error(`the checkout is not one clean commit (${commit ?? 'unknown'}): a proof's digests are read from the commit both runs ran on`);
  for (const results of [current, without]) {
    const ran = results.stack?.jsHarness ?? null;
    if (ran !== commit) throw new Error(`${results.name} ran on js-harness ${ran ?? 'unknown'}, and the checkout is at ${commit}: write the proof from the clean commit both runs ran on`);
  }
  const held = armScore(current, name, 'current');
  const out = armScore(without, name, armOf(rules));
  return { format: FORMAT, case: name, rules: [...rules].sort(), digests, date, commit, current: held.line, without: out.line, costUsd: held.costUsd + out.costUsd };
}

const isArmLine = (line) => line !== null && typeof line === 'object' && typeof line.run === 'string' && typeof line.arm === 'string' && Number.isInteger(line.trials) && typeof line.score === 'number';

/** Why `record` does not prove the case `name` as it is now (`rules`, `digests`): `[]` when it does. */
export function recordFaults(record, { name, rules, digests }) {
  if (record?.format !== FORMAT || record.case !== name || !Array.isArray(record.rules) || !isArmLine(record.current) || !isArmLine(record.without) || typeof record.digests !== 'object' || record.digests === null) {
    return [`the proof of ${name} is not a record buildRecord writes`];
  }
  const named = [...rules].sort().join(', ');
  if (record.rules.join(', ') !== named) return [`the proof of ${name} is of ${record.rules.join(', ')}, and the case names ${named}`];
  const faults = [];
  if (record.digests.case !== digests.case) faults.push(`the case ${name} changed since its proof of ${record.date}: it is run again`);
  if (record.digests.rules !== digests.rules) faults.push(`the text of ${named} changed since the proof of ${name} of ${record.date}: it is run again`);
  if (record.current.trials < MIN_TRIALS || record.without.trials < MIN_TRIALS) faults.push(`the proof of ${name} ran fewer than ${MIN_TRIALS} trials on an arm`);
  if (!(record.without.score < record.current.score)) {
    faults.push(`the arm without ${named} scored ${record.without.score}, no lower than the current arm's ${record.current.score}: ${name} does not tell the rule apart`);
  }
  return faults;
}

/** The digests of the case `name` of the checkout at `root`, as they are now. */
export function digestsOf(root, name, rules) {
  const readFile = (file) => {
    try {
      return fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  };
  const version = JSON.parse(readFile('package.json')).version;
  return { case: caseDigest(path.join(root, 'evals', 'tasks', name)), rules: ruleDigest(rules, textSources(version, readFile)) };
}

function main(argv) {
  if (argv.length !== 3) {
    process.stderr.write('Usage: node evals/rule-proof.mjs <case> <current results.json> <without results.json>\n');
    return 2;
  }
  const [name, currentFile, withoutFile] = argv;
  const task = JSON.parse(fs.readFileSync(path.join(PACKAGE, 'evals', 'tasks', name, 'task.json'), 'utf8'));
  const rules = Array.isArray(task.rules) ? task.rules : [];
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const commit = proofCommit({ spawn: spawnSync, root: PACKAGE });
  const record = buildRecord({ name, rules, digests: digestsOf(PACKAGE, name, rules), date: new Date().toISOString().slice(0, 10), commit, current: read(currentFile), without: read(withoutFile) });
  const faults = recordFaults(record, { name, rules, digests: record.digests });
  fs.mkdirSync(path.join(PACKAGE, ...PROOFS.split('/')), { recursive: true });
  fs.writeFileSync(path.join(PACKAGE, ...PROOFS.split('/'), `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`${faults.length === 0 ? 'PASS' : 'FAIL'}  proof  ${name}: current ${record.current.score} over ${record.current.trials}, without ${record.without.score} over ${record.without.trials}, $${record.costUsd.toFixed(2)}; ${PROOFS}/${name}.json written\n`);
  for (const fault of faults) process.stdout.write(`      ${fault}\n`);
  return faults.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));
