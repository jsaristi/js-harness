#!/usr/bin/env node
// The score of the incident set (F8 diet, section 7.1): of a recorded run, the trials of `incident-<nn>-*` tasks
// that passed, a trial passing only when every hidden test of its grader did (score 1); and of the two baseline
// runs, the noise rule and the S8 target frozen in odd/tasks/f8-s0-baseline.md before any result existed.
//
//   node evals/incident-score.mjs <run a> <run b> [run c]     (names of results in evals/results/)
//
// The frozen line names two runs; a third (the lead's decision of 2026-10-27, odd/tasks/f8-s0-baseline.md, L3) is
// printed beside it with the range of all three, and enters the line only by Sebastián's decision.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INCIDENT = /^incident-\d{2}-/;
/** The false-premise cases of the set, which have a line of their own (at least 3 of their 4 trials). */
const FALSE_PREMISE = ['incident-04-stale-doc-flag', 'incident-05-reported-done'];
/** How far a step may fall below the baseline's lower score before it is worse, whatever the spread. */
const MIN_NOISE = 3;
const SET_TRIALS = 20;
const TARGET_FLOOR = 17;

const count = (trials) => ({ passed: trials.filter((entry) => entry.score === 1).length, trials: trials.length });

/** `{ passed, trials, cases, falsePremise }` of one results document: `cases` per incident task, in run order. */
export function incidentScore(doc) {
  const trials = (Array.isArray(doc?.trials) ? doc.trials : []).filter((entry) => INCIDENT.test(entry?.task ?? ''));
  const cases = {};
  for (const task of [...new Set(trials.map((entry) => entry.task))]) cases[task] = count(trials.filter((entry) => entry.task === task));
  return { ...count(trials), cases, falsePremise: count(trials.filter((entry) => FALSE_PREMISE.includes(entry.task))) };
}

/** The line two baseline scores draw: L the lower, s their difference, a step worse below `L - max(s, 3)`, and the
 * S8 target `max(17, min(20, L + 3))`. At L of 17 or more the set does not reproduce what he reports. */
export function baselineLine(a, b) {
  const L = Math.min(a, b);
  const s = Math.abs(a - b);
  return { L, s, worseBelow: L - Math.max(s, MIN_NOISE), target: Math.max(TARGET_FLOOR, Math.min(SET_TRIALS, L + MIN_NOISE)), reproduces: L < TARGET_FLOOR };
}

const USAGE = 'usage: node evals/incident-score.mjs <run a> <run b> [run c]   (names of results in evals/results/)\n';

export function incidentScoreMain(argv, { resultsDir = path.join(HERE, 'results'), stdout = process.stdout, stderr = process.stderr } = {}) {
  if (argv.length !== 2 && argv.length !== 3) {
    stderr.write(USAGE);
    return 2;
  }
  const missing = argv.filter((name) => !fs.existsSync(path.join(resultsDir, `${name}.json`)));
  if (missing.length > 0) {
    stderr.write(`no results named ${missing.join(', ')} in ${resultsDir}\n`);
    return 1;
  }
  const scores = argv.map((name) => incidentScore(JSON.parse(fs.readFileSync(path.join(resultsDir, `${name}.json`), 'utf8'))));
  argv.forEach((name, i) => {
    const { passed, trials, cases, falsePremise } = scores[i];
    stdout.write(`${name}: ${passed} of ${trials}; false premise ${falsePremise.passed} of ${falsePremise.trials}\n`);
    for (const [task, cell] of Object.entries(cases)) stdout.write(`  ${task}: ${cell.passed} of ${cell.trials}\n`);
  });
  const line = baselineLine(scores[0].passed, scores[1].passed);
  stdout.write(`L ${line.L}, s ${line.s}: a step is worse below ${line.worseBelow}; S8 target ${line.target} of ${SET_TRIALS}`);
  stdout.write(line.reproduces ? '\n' : `; L is ${TARGET_FLOOR} or more, so the set does not reproduce what he reports\n`);
  if (scores.length === 3) {
    const passed = scores.map((score) => score.passed);
    const [low, high] = [Math.min(...passed), Math.max(...passed)];
    stdout.write(`all three runs: ${low} to ${high}, a range of ${high - low} (beside the frozen line of a and b, not in it)\n`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = incidentScoreMain(process.argv.slice(2));
}
