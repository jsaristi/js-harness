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
import { CELLS, CONFIGS, RANGES, readReading } from './compare.mjs';

const USAGE = 'Usage: node evals/review/report.mjs [--out <file>] [--require-complete]';

const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A count as a cell: grouped by thousands, and `unknown` for one the run did not report, never a zero. */
const counted = (count) => (Number.isFinite(count) ? thousands(count) : 'unknown');

// What follows a model that was not measured, in its cell; the top of the report says what it means.
const NOT_MEASURED = '*';

/** A model and an effort as one text, `<model> <effort>`: each `unknown` when it is no name, and the one
 * word `unknown` when neither is. */
function ranWith(model, effort) {
  const [name, level] = [model, effort].map((text) => (typeof text === 'string' && text !== '' ? text : null));
  return name === null && level === null ? 'unknown' : `${name ?? 'unknown'} ${level ?? 'unknown'}`;
}

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
  for (const range of ranges) {
    const scored = range.seeded === true;
    const shown = columns(scored);
    const rows = [];
    const notes = [];
    const read = [];
    for (const config of CONFIGS.filter((one) => CELLS.some((cell) => cell.config === one.name && cell.range === range.name))) {
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
    // ran, and what was asked for is in the reading alone, so it is said here.
    for (const reading of read) {
      const asked = ranWith(reading.configuredModel, reading.configuredEffort);
      const ran = ranWith(reading.model, reading.effort);
      if (reading.modelSource === 'session' && asked !== 'unknown' && asked !== ran) notes.push(`- \`${reading.config}\` ran on ${ran}, and was asked for ${asked}.`);
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
  const recorded = CELLS.length - missing.length;
  const text = [
    '# Codex review: the configurations, side by side',
    '',
    `One Codex review a cell, read by \`evals/review/compare.mjs\`: ${recorded} of ${CELLS.length} cells are recorded. A cell with no reading is a row of dashes; ` +
      'a count the run did not report is `unknown`. Findings are those the review gave as data; for the seeded range, `found` is how many of its known defects they name and `extra` how many findings name none.',
    '',
    `\`model\` is the model and the reasoning effort the review session ran with, as its own rollout file says. One followed by \`${NOT_MEASURED}\` was not measured: ` +
      'it is what the command passed or what the user\'s configuration names, and the session may have run another.',
    '',
    ...sections,
  ].join('\n');
  return { text, recorded, missing };
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
  const { text, missing } = reportMarkdown({ readingsDir: path.join(results, 'readings') });
  log(text.trimEnd());
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text, 'utf8');
  } catch (err) {
    error(`Could not write the report to ${out}: ${err.message}`);
    return 1;
  }
  if (args.requireComplete && missing.length > 0) {
    error(`${missing.length} of ${CELLS.length} cells have no reading: ${missing.join(', ')}. Each is one Codex review: \`node evals/review/compare.mjs --cell <cell>\`.`);
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
