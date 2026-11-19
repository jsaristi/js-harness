#!/usr/bin/env node
// The report of the comparison: the readings of `./compare.mjs`, set side by side.
//
//   node evals/review/report.mjs [--out <file>] [--require-complete]
//
// One table a range, one row a configuration, each row what the reading of that cell holds: how the review
// ended, how many findings it gave, for the seeded range how many of the seven known defects those found
// and how many findings were none of them, what it spent, how long it took, on which codex-cli and with
// which model at which effort. A cell with no reading is a row too, so that what is not yet measured is
// seen and not left out.
//
// The model of a row is the one its session ran with, read from the session's own rollout file. A reading
// that holds only what the command passed or what the user's configuration names is marked as not
// measured, because Codex may run the review on another model than the one asked for, and a comparison of
// two configurations says little while it is not known that both ran the same one.
//
// It reports and chooses nothing: which configuration `codex-review` runs is decided by a person reading
// these numbers (odd/tasks/codex-review-lean.md, T13). The one thing it says of its own is where the rows
// of a table cannot be compared as they stand: a reading taken on another codex-cli than the others, over
// other commits than the range's, or by a session that ran another model than the one it was asked for.
//
// `--require-complete` is the gate of the feature: it exits 1, naming them, while a cell has no reading,
// and 0 once every cell is recorded. A recorded cell counts whatever its outcome, which the row shows.
//
// It reads the readings and writes one Markdown file. It starts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARM_RUNS, ARMS, CELLS, CONFIGS, RANGES, readReading } from './compare.mjs';

const USAGE = 'Usage: node evals/review/report.mjs [--out <file>] [--require-complete]';

const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A count as a cell: grouped by thousands, and `unknown` for one the run did not report, never a zero. */
const counted = (count) => (Number.isFinite(count) ? thousands(count) : 'unknown');

// What follows a model that was not measured, in its cell; the top of the report says what it means.
const NOT_MEASURED = '*';

/** Whether `text` is a name: a model or an effort that is known. */
const named = (text) => typeof text === 'string' && text !== '';

/** A model and an effort as one text, `<model> <effort>`: each `unknown` when it is no name, and the one
 * word `unknown` when neither is. */
function ranWith(model, effort) {
  const [name, level] = [model, effort].map((text) => (named(text) ? text : null));
  return name === null && level === null ? 'unknown' : `${name ?? 'unknown'} ${level ?? 'unknown'}`;
}

/** Whether what was asked for and what ran are two different names. One that is not known on either side
 * is not a difference: nothing says it is one. */
const differs = (asked, ran) => named(asked) && named(ran) && asked !== ran;

/** The model of a reading as a cell: what its session ran with. Marked, unless it was read from the
 * session's own file (`modelSource` is `session`): it is then what the command passed or the user's
 * configuration names, which is what was asked for and may not be what ran. What is not known at all
 * claims nothing, so it has no mark. */
function modelCell({ model, effort, modelSource }) {
  const text = ranWith(model, effort);
  return text === 'unknown' || modelSource === 'session' ? text : `${text}${NOT_MEASURED}`;
}

/** The columns of the table of a range, each `[heading, what a reading gives for it]`. The two of the
 * score are there for a range that has a key to score against. */
function columns(scored) {
  const score = (pick) => ({ score: found }) => (found === null || found === undefined ? 'unknown' : pick(found));
  return [
    ['outcome', (reading) => reading.outcome],
    ['findings', (reading) => (Array.isArray(reading.findings) ? counted(reading.findings.length) : 'unknown')],
    ...(scored ? [['found', score((found) => `${found.found.length}/${found.defects}`)], ['extra', score((found) => counted(found.extra))]] : []),
    ['input tokens', (reading) => counted(reading.usage?.inputTokens)],
    // The part of the input that was not read from the cache: what a request really sent anew.
    ['not-cached input', ({ usage }) => (Number.isFinite(usage?.inputTokens) && Number.isFinite(usage?.cachedInputTokens) ? counted(usage.inputTokens - usage.cachedInputTokens) : 'unknown')],
    ['output tokens', (reading) => counted(reading.usage?.outputTokens)],
    ['requests', (reading) => counted(reading.requests)],
    ['first request', (reading) => counted(reading.firstRequestInputTokens)],
    ['seconds', (reading) => (Number.isFinite(reading.durationMs) ? counted(Math.round(reading.durationMs / 1000)) : 'unknown')],
    ['CLI', (reading) => reading.cli ?? 'unknown'],
    // Last, beside the CLI: the two that say what ran, and that the rows of a table are compared on.
    ['model', modelCell],
  ];
}

/** The version most of `readings` were taken on, the first of them when two are as frequent. */
function usualCli(readings) {
  const seen = new Map();
  for (const { cli } of readings) seen.set(cli, (seen.get(cli) ?? 0) + 1);
  return [...seen].reduce((usual, entry) => (entry[1] > usual[1] ? entry : usual), [null, 0])[0];
}

/** The report of the readings in `readingsDir` over `ranges`, as `{ text, recorded, missing }`: the
 * Markdown, how many cells have a reading, and the cells that have none, each `<config>:<range>`. A file
 * that is not a reading of its cell is a missing cell, and the report says what is wrong with it. */
export function reportMarkdown({ readingsDir, ranges = RANGES }) {
  const missing = [];
  const sections = [];
  // The comparison's own cells: the runs of the arms are a section of their own (`armsSection`), and not one of
  // them makes the comparison incomplete.
  const compared = CELLS.filter((cell) => CONFIGS.some((one) => one.name === cell.config && one.arm === null));
  for (const range of ranges) {
    const scored = range.seeded === true;
    const shown = columns(scored);
    const rows = [];
    const notes = [];
    const read = [];
    for (const config of CONFIGS.filter((one) => one.arm === null && compared.some((cell) => cell.config === one.name && cell.range === range.name))) {
      const found = readReading(readingsDir, config.name, range.name);
      if (!found.ok) {
        missing.push(`${config.name}:${range.name}`);
        rows.push([config.name, 'missing', ...shown.slice(1).map(() => '-')]);
        if (!found.missing) notes.push(`- \`${config.name}\`: ${found.why}.`);
        continue;
      }
      const { reading } = found;
      read.push(reading);
      rows.push([config.name, ...shown.map(([, cell]) => String(cell(reading)))]);
      if (reading.range.base !== range.base || reading.range.head !== range.head) {
        notes.push(`- \`${config.name}\` was read over ${String(reading.range.base).slice(0, 7)}..${String(reading.range.head).slice(0, 7)}, not over this range.`);
      }
    }
    const usual = usualCli(read);
    for (const reading of read) {
      if (reading.cli !== usual) notes.push(`- \`${reading.config}\` ran on codex-cli ${reading.cli}, the others on ${usual}: the comparison is only fair on one version.`);
    }
    // A session that was measured and ran something else than what it was asked for: the row shows what
    // ran, and what was asked for is in the reading alone, so it is said here. The model and the effort are
    // compared each on its own, and only where both sides know it: a half one side does not know (an
    // effort the user's configuration does not name, one the session did not write down) is not known to
    // differ, and the two as one text would call it a difference.
    for (const reading of read) {
      if (reading.modelSource !== 'session') continue;
      if (!differs(reading.configuredModel, reading.model) && !differs(reading.configuredEffort, reading.effort)) continue;
      notes.push(`- \`${reading.config}\` ran on ${ranWith(reading.model, reading.effort)}, and was asked for ${ranWith(reading.configuredModel, reading.configuredEffort)}.`);
    }
    const headings = ['configuration', ...shown.map(([heading]) => heading)];
    sections.push([
      `## ${range.name}: ${range.base.slice(0, 7)}..${range.head.slice(0, 7)}`,
      '',
      `${range.what[0].toUpperCase()}${range.what.slice(1)}.`,
      '',
      `| ${headings.join(' | ')} |`,
      `| ${headings.map((heading, at) => (at < 2 ? '---' : '---:')).join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
      ...(notes.length > 0 ? ['', ...notes] : []),
      '',
    ].join('\n'));
  }
  const recorded = compared.length - missing.length;
  const text = [
    '# Codex review: the configurations, side by side',
    '',
    `One Codex review a cell, read by \`evals/review/compare.mjs\`: ${recorded} of ${compared.length} cells are recorded. A cell with no reading is a row of dashes; ` +
      'a count the run did not report is `unknown`. Findings are those the review gave as data; for the seeded range, `found` is how many of its known defects they name and `extra` how many findings name none.',
    '',
    `\`model\` is the model and the reasoning effort the review session ran with, as its own rollout file says. One followed by \`${NOT_MEASURED}\` was not measured: ` +
      'it is what the command passed or what the user\'s configuration names, and the session may have run another.',
    '',
    ...sections,
    armsSection({ readingsDir, ranges }),
  ].join('\n');
  return { text, recorded, missing };
}

/** The input a reading spent on each line its range changes (`changedLines` of the range, as git counts them),
 * rounded: the base the price of the controlled test and the run log's figures are on. Not the lines the review's
 * evidence holds, which are fewer, and not only the lines it saw, so a review that stopped before it saw every
 * line is not made to look dearer a line than one that finished. `unknown` when either is not known. */
const perChangedLine = (range) => ({ usage }) => (Number.isFinite(usage?.inputTokens) && Number.isInteger(range.changedLines) && range.changedLines > 0 ? counted(Math.round(usage.inputTokens / range.changedLines)) : 'unknown');

/** Whether a run of the arm `config` counts (odd/tasks/reviewer-controlled-test.md, Constraints): `yes` when its
 * session's own file says it ran the arm's model at the arm's effort, else `no` and why. A run that does not count
 * is kept and shown: it was made and paid for, and it measured another pair, or one nobody can name. */
function counts(config, { model, effort, modelSource }) {
  if (modelSource !== 'session') return 'no: what it ran was not measured';
  if (!named(effort)) return 'no: its session named no effort';
  if (!named(model)) return 'no: its session named no model';
  if (model !== config.model || effort !== config.effort) return `no: it ran ${model} ${effort}, not ${model !== config.model ? `${config.model} ${config.effort}` : config.effort}`;
  return 'yes';
}

/** The value most of `readings` hold for `pick`, the first of them when two are as frequent. */
function usual(readings, pick) {
  const seen = new Map();
  for (const reading of readings) seen.set(pick(reading), (seen.get(pick(reading)) ?? 0) + 1);
  return [...seen].reduce((most, entry) => (entry[1] > most[1] ? entry : most), [null, 0])[0];
}

/** The section of the arms of the controlled test of the reviewer (`ARMS` in `./compare.mjs`,
 * odd/tasks/reviewer-controlled-test.md): one table a range, one row a run, with the columns of the comparison,
 * whether the run counts (`counts`), the input a changed line (the runs are compared on ranges of other sizes than
 * the reviews of real work) and the version of the prompt each was asked with. A run with no reading is a row of
 * dashes, as a cell is above. Under a table, what keeps its rows from being compared, as under the comparison's: a
 * reading of other commits than the range's, another codex-cli or another prompt version than most of the table's,
 * and a file that is there and is no reading of its run, with why, so that it is looked at before a run is paid
 * for again. */
function armsSection({ readingsDir, ranges }) {
  const runs = CONFIGS.filter((one) => one.arm !== null);
  const cells = CELLS.filter((cell) => runs.some((one) => one.name === cell.config));
  let recorded = 0;
  let counting = 0;
  const tables = ranges.map((range) => {
    const shown = columns(range.seeded === true);
    const more = [['input a changed line', perChangedLine(range)], ['prompt version', (reading) => reading.promptVersion ?? 'unknown']];
    const notes = [];
    const read = [];
    const rows = runs.filter((config) => cells.some((cell) => cell.config === config.name && cell.range === range.name)).map((config) => {
      const found = readReading(readingsDir, config.name, range.name);
      if (!found.ok) {
        if (!found.missing) notes.push(`- \`${config.name}\`: ${found.why}.`);
        return [config.name, config.arm, 'missing', ...shown.slice(1).map(() => '-'), '-', ...more.map(() => '-')];
      }
      const { reading } = found;
      recorded += 1;
      read.push(reading);
      const verdict = counts(config, reading);
      if (verdict === 'yes') counting += 1;
      if (reading.range.base !== range.base || reading.range.head !== range.head) {
        notes.push(`- \`${config.name}\` was read over ${String(reading.range.base).slice(0, 7)}..${String(reading.range.head).slice(0, 7)}, not over this range.`);
      }
      return [config.name, config.arm, ...shown.map(([, cell]) => String(cell(reading))), verdict, ...more.map(([, cell]) => String(cell(reading)))];
    });
    const cli = usual(read, (reading) => reading.cli);
    const prompt = usual(read, (reading) => reading.promptVersion ?? null);
    for (const reading of read) {
      if (reading.cli !== cli) notes.push(`- \`${reading.config}\` ran on codex-cli ${reading.cli}, the others on ${cli}: the comparison is only fair on one version.`);
      if ((reading.promptVersion ?? null) !== prompt) {
        notes.push(`- \`${reading.config}\` was asked with ${reading.promptVersion ?? 'no named prompt version'}, the others with ${prompt ?? 'no named prompt version'}: the comparison is only fair on one prompt.`);
      }
    }
    const headings = ['run', 'arm', ...shown.map(([heading]) => heading), 'counts', ...more.map(([heading]) => heading)];
    return [
      `### ${range.name}: ${range.base.slice(0, 7)}..${range.head.slice(0, 7)}, ${range.changedLines} changed lines`,
      '',
      `| ${headings.join(' | ')} |`,
      `| ${headings.map((heading, at) => (at < 3 ? '---' : '---:')).join(' | ')} |`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
      ...(notes.length > 0 ? ['', ...notes] : []),
      '',
    ].join('\n');
  });
  return [
    '## The arms of the controlled test',
    '',
    `The runs of odd/tasks/reviewer-controlled-test.md, ${ARM_RUNS} a range an arm, each on the model and at the effort of its arm: ${recorded} of ${cells.length} runs are recorded, ${counting} of them ${counting === 1 ? 'counts' : 'count'}. ` +
      'A run counts when its session\'s own file says it ran its arm\'s model at its arm\'s effort; one that does not is shown and is no measure of its arm. ' +
      'They are not cells of the comparison above, and a run that has not been made leaves it complete.',
    '',
    ...ARMS.map(({ arm, model, effort, why }) => `- ${arm}: ${model} at ${effort}, ${why}.`),
    '',
    ...tables,
  ].join('\n');
}

class ArgError extends Error {}

function parseArgs(argv) {
  let out = null;
  let requireComplete = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--require-complete') requireComplete = true;
    else if (argv[i] === '--out') {
      out = argv[i + 1];
      if (out === undefined || out.startsWith('--')) throw new ArgError('--out requires a value, the file to write');
      i += 1;
    } else throw new ArgError(`Unknown argument ${JSON.stringify(argv[i])}`);
  }
  return { out, requireComplete };
}

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/** Runs the command and returns its exit code: 0 with the report written and printed; 1 when it could not
 * be written, and under `--require-complete` when a cell has no reading; 2 with the usage on a bad command
 * line. `deps` (all optional) injects `log`, `error`, and `repoRoot`, the folder the readings are read
 * from (`evals/results/review/readings`) and the report written to (`evals/results/review/report.md`). */
export function reportMain(argv = process.argv.slice(2), deps = {}) {
  const { log = console.log, error = console.error, repoRoot = REPO_ROOT } = deps;
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const results = path.join(repoRoot, 'evals', 'results', 'review');
  const out = args.out === null ? path.join(results, 'report.md') : path.resolve(args.out);
  const { text, recorded, missing } = reportMarkdown({ readingsDir: path.join(results, 'readings') });
  log(text.trimEnd());
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text, 'utf8');
  } catch (err) {
    error(`Could not write the report to ${out}: ${err.message}`);
    return 1;
  }
  if (args.requireComplete && missing.length > 0) {
    error(`${missing.length} of ${recorded + missing.length} cells have no reading: ${missing.join(', ')}. Each is one Codex review: \`node evals/review/compare.mjs --cell <cell>\`.`);
    return 1;
  }
  return 0;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = reportMain(process.argv.slice(2));
}
