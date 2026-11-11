#!/usr/bin/env node
// The record of an eval case's proof that it tells its rules apart (F8 S5c-a, `odd/tasks/f8-s5c-a-coverage.md`, S4):
// the case runs on the current arm and on the arm without the rules it names (`current-without-rule-<id>`,
// `evals/without.mjs`), and `evals/proofs/rules/<case>.json` keeps what each scored, at what cost and on which texts.
// The run is paid and his; this writes the record from the two results files, and `evals/tasks.test.mjs` reads it on
// every gate, for free: a record is current while the case's files and its rules' texts are the ones it ran on, and
// it proves the case only when it clears the bar. Zero deps, plain Node.
//
// The bar (`odd/tasks/audit-u9-eval-bar.md`, his answer to question 2 of the audit triage, 2026-11-11): at least
// `MIN_TRIALS` scored trials on each arm and the same count on both, from two runs of one agent, model, permission
// mode and effort, and the current arm's mean above the arm without by more than the spread of their trials
// (`tellsApart`). The bar before it, two trials and any gap, called a proof on pure noise in 20 to 43 percent of draws
// from the recorded scores, and more trials alone made that worse, not better: the spread carries it.
//
// What this bar gets wrong, both enumerated exactly in `evals/rule-proof.test.mjs`: with no difference between the
// arms of a case that scores a trial 1 or 0.5, it calls a proof in at most 9.4 % of draws (the worst is where a
// trial passes one time in four, or three), so about one false proof in eleven cases proven at once; and with the
// current arm always right, a rule whose absence fails a trial three times in ten clears it in 47 % of runs, 81 % at
// five in ten. A record that does not clear it shows that, not that the rule
// changes nothing. A proof costs ten trials.
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
import { scoreSpread } from './report.mjs';

/** Where the records are, from the top of the checkout: one `<case>.json` a case that names rules. */
export const PROOFS = 'evals/proofs/rules';
/** The trials a proof takes on each arm: five, his "5 intentos por lado" (14.4 asked for two, "on both arms, twice
 * each", and two tied both proofs that were paid for). */
export const MIN_TRIALS = 5;
/** The record's format: 2 since each arm keeps its trials' scores, which the spread is read from. */
const FORMAT = 2;
/** The format before the bar: a mean and a count for each arm. Read, so that it can be named, and never a proof. */
const EARLIER_FORMAT = 1;
const PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
/** The sample variance (n - 1), 0 for one value, which has no spread to speak of. */
const variance = (values) => (values.length < 2 ? 0 : values.reduce((sum, value) => sum + (value - mean(values)) ** 2, 0) / (values.length - 1));
// Rounded before a comparison, as `report.mjs` does: 1 - 0.98 must not land a hair above the tolerance it equals.
const round = (value) => Math.round(value * 1e9) / 1e9;

/** The spread a gap between two arms must exceed to be a difference: the pooled sample deviation of their trials'
 * scores, and never less than its tolerance. It is `scoreSpread`, the rule `report.mjs` calls two scores unequal by
 * (`compareCells`), so "equal" means one thing in the A/B report and in a proof. */
export const spreadOf = (current, without) => scoreSpread(Math.sqrt(variance(current)), Math.sqrt(variance(without)));

/** Whether the trials' scores of the current arm stand above those of the arm without by more than their spread. */
export const tellsApart = (current, without) => round(mean(current) - mean(without)) > round(spreadOf(current, without));

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

/** What the `results` of one run say of the case `name` on the arm `arm`: `{ run, arm, trials, errors, score, scores }`,
 * the mean and each trial's score in run order, the efforts those trials ran at, and its cost. A trial that recorded an
 * error counts at the score it was graded at, as the A/B report counts it (`evals/report.mjs`, `buildCells`: a failure
 * rate is itself a result), and `errors` says how many did, since one cut trial can make or erase a gap at five. The
 * cost is a trial's CLI cost where it has one, else its transcripts' list cost: a trial cut by its timeout printed no
 * result, so it has no CLI cost, and leaving it out would record a run as cheaper than it was (L40). */
function armScore(results, name, arm) {
  const trials = (results.trials ?? []).filter((item) => item.task === name && item.config === arm && typeof item.score === 'number');
  if (trials.length < MIN_TRIALS) throw new Error(`${trials.length} trial${trials.length === 1 ? '' : 's'} of ${name} on ${arm} in ${results.name}: a proof takes ${MIN_TRIALS}`);
  const scores = trials.map((item) => item.score);
  const errors = trials.filter((item) => item.error !== null && item.error !== undefined).length;
  return { efforts: trials.map((item) => item.effort), line: { run: results.name, arm, trials: trials.length, errors, score: mean(scores), scores }, costUsd: trials.reduce((sum, item) => sum + (item.costUsd ?? item.listCost?.total?.listCostUsd ?? 0), 0) };
}

const CLEAN_COMMIT = /^[0-9a-f]{40,64}$/;

/** The commit of the checkout at `root` a proof is written at, with `+dirty` after it when a file there differs from
 * it, a file git does not track included, or `null` when git cannot say. `evals/results` and `evals/proofs` are left
 * out: a run writes its results there and this command its records, none of which a case ran on. Untracked files
 * count, unlike the run's own `readWorkspaceCommit` (`evals/suite.mjs`), because `caseDigest` reads every file of a
 * case folder, so an untracked one would be digested as if the runs had run on it. */
export function proofCommit({ spawn, root }) {
  const git = (args) => {
    const result = spawn('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 30000, windowsHide: true });
    return result.error || result.status !== 0 ? null : String(result.stdout ?? '');
  };
  const commit = git(['rev-parse', 'HEAD'])?.trim();
  if (!commit || !CLEAN_COMMIT.test(commit)) return null;
  const changes = git(['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude)evals/results', ':(exclude)evals/proofs']);
  if (changes === null) return null;
  return changes.trim() === '' ? commit : `${commit}+dirty`;
}

const agentOf = (results) => results.agent ?? 'claude';
/** What two runs must share for their arms to differ by the rule alone, each with how a results file says it. */
const CONDITIONS = [['agent', agentOf], ['model', (results) => results.model], ['permission mode', (results) => results.permissionMode]];

/** The record of the case `name` that names `rules`, from the results of its `current` run and its `without` run.
 * The two runs are of one agent, model and permission mode, their counted trials of one effort and the same count on
 * both arms: a gap between two models or two efforts is not the rule's, and a count that differs is a run extended on
 * one side. The record keeps those conditions.
 * `digests` are read from the checkout at `commit`, so each run must have run on that same commit, clean (its
 * `stack.jsHarness`, `evals/suite.mjs`): a run of other texts would be stamped with digests it never ran on. */
export function buildRecord({ name, rules, digests, date, commit, current, without }) {
  if (typeof commit !== 'string' || !CLEAN_COMMIT.test(commit)) throw new Error(`the checkout is not one clean commit (${commit ?? 'unknown'}): a proof's digests are read from the commit both runs ran on`);
  for (const results of [current, without]) {
    const ran = results.stack?.jsHarness ?? null;
    if (ran !== commit) throw new Error(`${results.name} ran on js-harness ${ran ?? 'unknown'}, and the checkout is at ${commit}: write the proof from the clean commit both runs ran on`);
  }
  for (const [what, of] of CONDITIONS) {
    for (const results of [current, without]) {
      if (typeof of(results) !== 'string' || of(results) === '') throw new Error(`${results.name} records no ${what}: a proof keeps the ${what} both arms ran on`);
    }
    if (of(current) !== of(without)) throw new Error(`${current.name} ran on ${what} ${of(current)} and ${without.name} on ${of(without)}: a proof compares two arms of one ${what}`);
  }
  const held = armScore(current, name, 'current');
  const out = armScore(without, name, armOf(rules));
  if (held.line.trials !== out.line.trials) throw new Error(`${held.line.trials} trials of ${name} on current and ${out.line.trials} on ${armOf(rules)}: a proof takes the same count on both arms`);
  if ([...held.efforts, ...out.efforts].some((effort) => typeof effort !== 'string' || effort === '')) throw new Error(`a trial of ${name} records no effort: a proof compares two arms at one effort`);
  const efforts = [...new Set([...held.efforts, ...out.efforts])].sort();
  if (efforts.length !== 1) throw new Error(`the trials of ${name} ran at efforts ${efforts.join(', ')}: a proof compares two arms at one effort`);
  return {
    format: FORMAT, case: name, rules: [...rules].sort(), digests, date, commit,
    agent: agentOf(current), model: current.model, permissionMode: current.permissionMode, effort: efforts[0],
    current: held.line, without: out.line, costUsd: held.costUsd + out.costUsd,
  };
}

const isEarlierLine = (line) => line !== null && typeof line === 'object' && typeof line.run === 'string' && typeof line.arm === 'string' && Number.isInteger(line.trials) && typeof line.score === 'number';
/** An arm as `armScore` writes it: the earlier line, with its count of errored trials, one finite score a trial and
 * the mean they give. */
const isArmLine = (line) => isEarlierLine(line) && Number.isInteger(line.errors) && line.errors >= 0 && line.errors <= line.trials
  && Array.isArray(line.scores) && line.scores.length === line.trials && line.trials > 0
  && line.scores.every((score) => typeof score === 'number' && Number.isFinite(score)) && round(mean(line.scores)) === round(line.score);
/** What a record says its two runs shared: each a name, as `buildRecord` writes them. */
const RECORD_CONDITIONS = ['agent', 'model', 'permissionMode', 'effort'];
const shown = (score) => String(Math.round(score * 1e4) / 1e4);

/** Why `record` does not prove the case `name` as it is now (`rules`, `digests`): `[]` when it does. A record of
 * the earlier format is named as one, with what it scored, and proves nothing: it holds no trial's score, so its
 * spread cannot be read, and none was written at five trials. */
export function recordFaults(record, { name, rules, digests }) {
  const earlier = record?.format === EARLIER_FORMAT;
  const isLine = earlier ? isEarlierLine : isArmLine;
  if ((record?.format !== FORMAT && !earlier) || record.case !== name || !Array.isArray(record.rules) || !isLine(record.current) || !isLine(record.without) || typeof record.digests !== 'object' || record.digests === null) {
    return [`the proof of ${name} is not a record buildRecord writes`];
  }
  if (!earlier && !RECORD_CONDITIONS.every((key) => typeof record[key] === 'string' && record[key] !== '')) return [`the proof of ${name} is not a record buildRecord writes`];
  const named = [...rules].sort().join(', ');
  if (record.rules.join(', ') !== named) return [`the proof of ${name} is of ${record.rules.join(', ')}, and the case names ${named}`];
  if (earlier) {
    return [`the proof of ${name} of ${record.date} is of the earlier bar: ${record.current.trials} trials on the current arm (${shown(record.current.score)}) and ${record.without.trials} without ${named} (${shown(record.without.score)}), with no trial's score kept, where a proof takes ${MIN_TRIALS} an arm and a gap above their spread: it is run again`];
  }
  const faults = [];
  if (record.digests.case !== digests.case) faults.push(`the case ${name} changed since its proof of ${record.date}: it is run again`);
  if (record.digests.rules !== digests.rules) faults.push(`the text of ${named} changed since the proof of ${name} of ${record.date}: it is run again`);
  if (record.current.trials !== record.without.trials) faults.push(`the proof of ${name} ran ${record.current.trials} trials on the current arm and ${record.without.trials} without: a proof takes the same count on both`);
  if (record.current.trials < MIN_TRIALS || record.without.trials < MIN_TRIALS) faults.push(`the proof of ${name} ran fewer than ${MIN_TRIALS} trials on an arm`);
  if (!tellsApart(record.current.scores, record.without.scores)) {
    // The record does not clear the bar; that the rule changes nothing is not what it shows: with the current arm always
    // right, a rule whose absence fails a trial three times in ten clears this bar in 47 % of runs, and 81 % at five in ten.
    faults.push(`the proof of ${name} does not clear the bar: the current arm scored ${shown(record.current.score)} and the arm without ${named} ${shown(record.without.score)} over ${record.current.trials} trials each, a gap of ${shown(record.current.score - record.without.score)}, no larger than the spread of their trials (${shown(spreadOf(record.current.scores, record.without.scores))})`);
  }
  return faults;
}

/** What the test of a case the coverage register owes says of it (`evals/tasks.test.mjs`): that its proof is owed,
 * and what the `record` on file shows, `null` where there is none. An owed case passed its test in silence, titled
 * as if it were proven, while no rule was proven by an eval (the audit of 2026-11-09, M2). */
export function owedNote(record, { name, rules, digests }) {
  if (rules.length === 0) return `${name} names no rule: it owes the rule it tests, and the proof that it tells it apart`;
  const owes = `${name} owes the proof that it tells ${[...rules].sort().join(', ')} apart`;
  if (record === null) return `${owes}: no record at ${PROOFS}/${name}.json`;
  const faults = recordFaults(record, { name, rules, digests });
  return faults.length === 0 ? `${name} is owed in the coverage register, and its record of ${record.date} clears the bar: the register is behind it` : `${owes}: ${faults.join('; ')}`;
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
  const errored = record.current.errors + record.without.errors;
  process.stdout.write(`${faults.length === 0 ? 'PASS' : 'FAIL'}  proof  ${name}: current ${shown(record.current.score)} over ${record.current.trials}, without ${shown(record.without.score)} over ${record.without.trials}, the spread ${shown(spreadOf(record.current.scores, record.without.scores))}${errored === 0 ? '' : `, ${errored} trial${errored === 1 ? '' : 's'} errored and counted at the score graded`}, $${record.costUsd.toFixed(2)}; ${PROOFS}/${name}.json written\n`);
  for (const fault of faults) process.stdout.write(`      ${fault}\n`);
  return faults.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));
