import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CELLS, RANGES, READING_SCHEMA, readingFile } from './compare.mjs';
import { reportMain, reportMarkdown } from './report.mjs';

// Every reading here is a fixture written into a temporary folder: no test reads the readings of the
// repository, and none writes its report.
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** A temporary folder that stands in for the repository: its readings go where the comparison writes them. */
function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-review-report-'));
  made.push(root);
  const readings = path.join(root, 'evals', 'results', 'review', 'readings');
  fs.mkdirSync(readings, { recursive: true });
  return { root, readings, out: path.join(root, 'evals', 'results', 'review', 'report.md') };
}

const rangeOf = (name) => RANGES.find((range) => range.name === name);
const finding = { file: 'a.mjs', start: 1, end: 1, severity: 'P1', title: 't', body: 'b', confidence: 0.8 };

/** The reading of a cell as the comparison stores one, with `over` laid on it. */
const readingOf = (config, range, over = {}) => ({
  schema: READING_SCHEMA,
  config,
  range: { name: range, base: rangeOf(range).base, head: rangeOf(range).head },
  recordedAt: '2026-10-07T12:00:00.000Z',
  cli: '0.160.1',
  session: config === 'current' ? 'current' : 'lean',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  modelSource: 'command',
  prompt: 'codex',
  promptVersion: null,
  outcome: 'reviewed',
  reason: null,
  usage: { inputTokens: 40100, cachedInputTokens: 18176, outputTokens: 480, reasoningOutputTokens: 150 },
  requests: 2,
  firstRequestInputTokens: 18200,
  durationMs: 60400,
  coverage: { seen: 9, total: 9 },
  parts: 1,
  findings: [finding, finding, finding],
  findingBodyMax: 600,
  verdict: 'incorrect',
  ...(range === 'seeded' ? { score: { defects: 7, found: ['D1', 'D2'], missed: ['D3', 'D4', 'D5', 'D6', 'D7'], extra: 1, recall: 2 / 7 } } : {}),
  ...over,
});

const record = (repo, config, range, over) => fs.writeFileSync(readingFile(repo.readings, config, range), JSON.stringify(readingOf(config, range, over)), 'utf8');
const recordAll = (repo, over = () => ({})) => CELLS.forEach(({ config, range }) => record(repo, config, range, over(config, range)));

/** Runs the report on the folder `repo`. */
function run(argv, repo) {
  const out = [];
  const err = [];
  const code = reportMain(argv, { repoRoot: repo.root, log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

/** The part of a report under the heading of the range `name`, up to the next heading. */
const section = (text, name) => text.split(/^## /m).find((part) => part.startsWith(`${name}:`)) ?? '';
/** The row of `config` in a section, as its cells. */
const row = (text, config) => text.split('\n').find((line) => line.startsWith(`| ${config} |`))?.split('|').slice(1, -1).map((cell) => cell.trim());

const REAL_COLUMNS = ['configuration', 'outcome', 'findings', 'input tokens', 'not-cached input', 'output tokens', 'requests', 'first request', 'seconds', 'CLI', 'model'];
const SEEDED_COLUMNS = ['configuration', 'outcome', 'findings', 'found', 'extra', 'input tokens', 'not-cached input', 'output tokens', 'requests', 'first request', 'seconds', 'CLI', 'model'];

test('with no reading every cell is a row that says `missing`: one table a range, one row a configuration of that range', () => {
  const repo = repository();
  const result = run([], repo);
  assert.equal(result.code, 0, result.err);
  const text = fs.readFileSync(repo.out, 'utf8');
  assert.equal(result.out, text.trimEnd(), 'the report is printed as it is written');
  assert.match(text, /^# /);
  assert.match(text, /0 of 9 cells are recorded/);
  const [real, seeded] = [section(text, 'real'), section(text, 'seeded')];
  assert.ok(real.startsWith('real: 338386a..e3aad48'), real.slice(0, 60));
  assert.ok(seeded.startsWith(`seeded: ${rangeOf('seeded').base.slice(0, 7)}..${rangeOf('seeded').head.slice(0, 7)}`), seeded.slice(0, 60));
  assert.deepEqual(row(real, 'configuration'), REAL_COLUMNS);
  assert.deepEqual(row(seeded, 'configuration'), SEEDED_COLUMNS);
  for (const config of ['current', 'lean', 'lean-own', 'lean-high', 'lean-codegraph']) assert.deepEqual(row(real, config), [config, 'missing', ...REAL_COLUMNS.slice(2).map(() => '-')], config);
  for (const config of ['current', 'lean', 'lean-own', 'lean-high']) assert.deepEqual(row(seeded, config), [config, 'missing', ...SEEDED_COLUMNS.slice(2).map(() => '-')], config);
  assert.equal(row(seeded, 'lean-codegraph'), undefined, 'CodeGraph is not a cell of the seeded range');
});

test('a recorded cell is a row of what its reading holds: the outcome, the findings, the tokens, the requests, the seconds and the CLI', () => {
  const repo = repository();
  recordAll(repo);
  const result = run([], repo);
  assert.equal(result.code, 0, result.err);
  const text = fs.readFileSync(repo.out, 'utf8');
  assert.match(text, /9 of 9 cells are recorded/);
  // Not-cached input is the input less its cached part; the seconds are the wall time, rounded.
  assert.deepEqual(row(section(text, 'real'), 'lean'), ['lean', 'reviewed', '3', '40,100', '21,924', '480', '2', '18,200', '60', '0.160.1', 'gpt-6.1-sol medium*']);
  assert.deepEqual(row(section(text, 'seeded'), 'lean-own'), ['lean-own', 'reviewed', '3', '2/7', '1', '40,100', '21,924', '480', '2', '18,200', '60', '0.160.1', 'gpt-6.1-sol medium*']);
  assert.equal(text.includes('missing'), false);
  assert.doesNotMatch(text, /default|should|recommend|better|winner/i, 'it reports, and chooses nothing');
});

/** The section of the arms of the controlled test, and in it the table of the range `name`. */
const arms = (text) => text.split(/^## /m).find((part) => part.startsWith('The arms of the controlled test')) ?? '';
const armTable = (text, name) => arms(text).split(/^### /m).find((part) => part.startsWith(`${name}:`)) ?? '';
const ARM_COLUMNS = (scored) => ['run', 'arm', ...(scored ? SEEDED_COLUMNS : REAL_COLUMNS).slice(1), 'counts', 'input a changed line', 'prompt version'];
const ARM_RUNS = ['sol61-medium-1', 'sol61-medium-2', 'sol62-medium-1', 'sol62-medium-2', 'sol62-max-1', 'sol62-max-2', 'sol62-high-1', 'sol62-high-2'];

test('the arms of the controlled test are a section of their own: one table a range, one row a run, with the input a changed line and the prompt version', () => {
  const repo = repository();
  const empty = run([], repo);
  assert.equal(empty.code, 0, empty.err);
  let text = fs.readFileSync(repo.out, 'utf8');
  // Their runs are not cells of the comparison: the tables above and its count are what they were.
  assert.match(text, /0 of 9 cells are recorded/);
  assert.equal(row(section(text, 'real'), 'sol61-medium-1'), undefined, 'an arm is not a row of the comparison');
  assert.match(arms(text), /0 of 16 runs are recorded/);
  for (const name of ['real', 'seeded']) {
    const table = armTable(text, name);
    assert.deepEqual(row(table, 'run'), ARM_COLUMNS(name === 'seeded'), name);
    for (const config of ARM_RUNS) assert.deepEqual(row(table, config).slice(0, 3), [config, config === ARM_RUNS[0] || config === ARM_RUNS[1] ? 'A' : config.startsWith('sol62-medium') ? 'B' : config.startsWith('sol62-max') ? 'C' : 'D', 'missing'], `${name} ${config}`);
  }
  // A run that is recorded and counts: its session ran its arm's model at its arm's effort. The input is over the
  // range's changed lines as git counts them (`changedLines`, 292 for seeded), not over the lines the review's
  // evidence holds (`coverage`, 226 here), and the version of its prompt is shown.
  const measuredAs = (model, effort) => ({ model, effort, modelSource: 'session', configuredModel: model, configuredEffort: effort, prompt: 'own', promptVersion: 'js-harness.codex-review-prompt/v4' });
  record(repo, 'sol62-max-1', 'seeded', { ...measuredAs('gpt-6.2-sol', 'max'), coverage: { seen: 226, total: 226 }, usage: { inputTokens: 1000000, cachedInputTokens: 900000, outputTokens: 5000, reasoningOutputTokens: 3000 } });
  assert.equal(run([], repo).code, 0);
  text = fs.readFileSync(repo.out, 'utf8');
  assert.match(arms(text), /1 of 16 runs are recorded, 1 of them counts/);
  assert.deepEqual(row(armTable(text, 'seeded'), 'sol62-max-1'), ['sol62-max-1', 'C', 'reviewed', '3', '2/7', '1', '1,000,000', '100,000', '5,000', '2', '18,200', '60', '0.160.1', 'gpt-6.2-sol max', 'yes', '3,425', 'js-harness.codex-review-prompt/v4']);
  // A review that stopped at half the range is divided by all of it.
  record(repo, 'sol62-max-1', 'real', { ...measuredAs('gpt-6.2-sol', 'max'), coverage: { seen: 100, total: 200 }, usage: { inputTokens: 100000, cachedInputTokens: 0, outputTokens: 1, reasoningOutputTokens: 0 } });
  run([], repo);
  assert.equal(row(armTable(fs.readFileSync(repo.out, 'utf8'), 'real'), 'sol62-max-1').at(-2), '392');
  // A run counts only when its session's own file says it ran the arm's model at the arm's effort: one that says
  // no effort, one that ran another pair, and one whose model is what the command passed are shown, and do not count.
  record(repo, 'sol62-max-2', 'seeded', { ...measuredAs('gpt-6.2-sol', 'max'), effort: null });
  record(repo, 'sol62-high-1', 'seeded', { ...measuredAs('gpt-6.2-sol', 'medium'), configuredEffort: 'high' });
  record(repo, 'sol62-high-2', 'seeded', { model: 'gpt-6.2-sol', effort: 'high', modelSource: 'command' });
  run([], repo);
  text = fs.readFileSync(repo.out, 'utf8');
  const counts = (config) => row(armTable(text, 'seeded'), config).at(-3);
  assert.equal(counts('sol62-max-2'), 'no: its session named no effort');
  assert.equal(counts('sol62-high-1'), 'no: it ran gpt-6.2-sol medium, not high');
  assert.equal(counts('sol62-high-2'), 'no: what it ran was not measured');
  assert.match(arms(text), /5 of 16 runs are recorded, 2 of them count/);
  // Under a table, what keeps its rows from being compared: a reading of other commits, another CLI or another
  // prompt version than most, and a file that is there and is no reading of its run, with why.
  record(repo, 'sol62-medium-1', 'seeded', { ...measuredAs('gpt-6.2-sol', 'medium'), range: { name: 'seeded', base: 'a'.repeat(40), head: 'b'.repeat(40) } });
  record(repo, 'sol62-medium-2', 'seeded', { ...measuredAs('gpt-6.2-sol', 'medium'), cli: '0.170.0', promptVersion: 'js-harness.codex-review-prompt/v5' });
  fs.writeFileSync(readingFile(repo.readings, 'sol61-medium-2', 'seeded'), 'not json', 'utf8');
  run([], repo);
  const seeded = armTable(fs.readFileSync(repo.out, 'utf8'), 'seeded');
  assert.match(seeded, /^- `sol62-medium-1` was read over aaaaaaa\.\.bbbbbbb, not over this range\.$/m);
  assert.match(seeded, /^- `sol62-medium-2` ran on codex-cli 0\.170\.0, the others on 0\.160\.1: the comparison is only fair on one version\.$/m);
  assert.match(seeded, /^- `sol62-medium-2` was asked with js-harness\.codex-review-prompt\/v5, the others with js-harness\.codex-review-prompt\/v4: the comparison is only fair on one prompt\.$/m);
  assert.match(seeded, /^- `sol61-medium-2`: sol61-medium-2__seeded\.json is not JSON/m);
  assert.equal(row(seeded, 'sol61-medium-2')[2], 'missing');
  // Across the two cases too: a range read wholly on another CLI agrees with itself, and is still flagged.
  for (const config of ARM_RUNS) for (const range of ['real', 'seeded']) fs.rmSync(readingFile(repo.readings, config, range), { force: true });
  for (const config of ['sol61-medium-1', 'sol61-medium-2', 'sol62-max-1']) record(repo, config, 'seeded', measuredAs('gpt-6.2-sol', 'max'));
  record(repo, 'sol62-max-1', 'real', { ...measuredAs('gpt-6.2-sol', 'max'), cli: '0.170.0' });
  run([], repo);
  assert.match(armTable(fs.readFileSync(repo.out, 'utf8'), 'real'), /^- `sol62-max-1` ran on codex-cli 0\.170\.0, the others on 0\.160\.1/m);
  // The arms that have not run do not make the comparison incomplete.
  recordAll(repo, (config) => (config.startsWith('sol') ? { outcome: 'reviewed' } : {}));
  for (const config of ARM_RUNS) for (const range of ['real', 'seeded']) fs.rmSync(readingFile(repo.readings, config, range), { force: true });
  assert.equal(run(['--require-complete'], repo).code, 0);
});

test('a reading that is no review shows its outcome, and a count that is not known says `unknown`, never zero', () => {
  const repo = repository();
  const nothing = { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null };
  record(repo, 'current', 'seeded', { outcome: 'not-inspected', reason: 'its successful commands showed 3 of 292 changed lines', findings: [], score: { defects: 7, found: [], missed: ['D1'], extra: 0, recall: 0 } });
  record(repo, 'lean', 'seeded', { outcome: 'failed', reason: 'the answer of the review is not JSON', findings: null, verdict: null, score: null, usage: nothing, requests: null, firstRequestInputTokens: null, durationMs: null });
  record(repo, 'lean-high', 'seeded', { usage: { ...nothing, inputTokens: 500, outputTokens: 20 } });
  const text = reportMarkdown({ readingsDir: repo.readings }).text;
  const seeded = section(text, 'seeded');
  assert.deepEqual(row(seeded, 'current'), ['current', 'not-inspected', '0', '0/7', '0', '40,100', '21,924', '480', '2', '18,200', '60', '0.160.1', 'gpt-6.1-sol medium*']);
  assert.deepEqual(row(seeded, 'lean'), ['lean', 'failed', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', '0.160.1', 'gpt-6.1-sol medium*']);
  assert.deepEqual(row(seeded, 'lean-high').slice(5, 8), ['500', 'unknown', '20'], 'input with no cached count has no not-cached part to give');
  assert.deepEqual(row(seeded, 'lean-own')[1], 'missing');
});

test('a cell that ended before every part of its range was reviewed is a row that says `failed`, with what its parts spent, and is a recorded cell', () => {
  const repo = repository();
  recordAll(repo);
  // As the comparison stores it when the session of a later part could not be launched (`buildReading`).
  record(repo, 'lean', 'real', { outcome: 'failed', reason: 'part 2 of 3 gave no result (codex-review exited 1), so the range was not reviewed whole', parts: 3 });
  const result = run(['--require-complete'], repo);
  assert.equal(result.code, 0, result.err);
  const real = section(fs.readFileSync(repo.out, 'utf8'), 'real');
  // The outcome is what says it is no review; the counts beside it are those of the parts that ran.
  assert.deepEqual(row(real, 'lean'), ['lean', 'failed', '3', '40,100', '21,924', '480', '2', '18,200', '60', '0.160.1', 'gpt-6.1-sol medium*']);
  assert.equal(row(real, 'lean-high')[1], 'reviewed');
});

/** What a reading holds once the model its session ran with was read from the session's own file. */
const measured = (model, effort, configuredModel, configuredEffort) => ({ model, effort, modelSource: 'session', configuredModel, configuredEffort });
const modelCell = (text, range, config) => row(section(text, range), config).at(-1);

test('the model of a row is the one its session ran with, and one that was not measured is marked and explained', () => {
  const repo = repository();
  // Read from the session's own file: the model as it is, whatever was asked for.
  record(repo, 'current', 'seeded', measured('gpt-the-review-ran', 'low', 'gpt-user', 'high'));
  record(repo, 'lean', 'seeded', measured('gpt-6.1-sol', 'medium', 'gpt-6.1-sol', 'medium'));
  // Not measured: what the command passed, and what the user's configuration names. Both are marked.
  record(repo, 'lean-own', 'seeded', { model: 'gpt-6.1-sol', effort: 'medium', modelSource: 'command' });
  record(repo, 'lean-high', 'seeded', { model: 'gpt-user', effort: 'high', modelSource: 'config.toml' });
  // A model with no effort, the other way round, and neither: what is not known is said, never left blank.
  record(repo, 'current', 'real', measured('gpt-the-review-ran', null, null, null));
  record(repo, 'lean', 'real', { model: null, effort: 'high', modelSource: 'config.toml' });
  record(repo, 'lean-own', 'real', { model: null, effort: null, modelSource: null });
  const text = reportMarkdown({ readingsDir: repo.readings }).text;
  assert.equal(modelCell(text, 'seeded', 'current'), 'gpt-the-review-ran low');
  assert.equal(modelCell(text, 'seeded', 'lean'), 'gpt-6.1-sol medium');
  assert.equal(modelCell(text, 'seeded', 'lean-own'), 'gpt-6.1-sol medium*');
  assert.equal(modelCell(text, 'seeded', 'lean-high'), 'gpt-user high*');
  assert.equal(modelCell(text, 'real', 'current'), 'gpt-the-review-ran unknown');
  assert.equal(modelCell(text, 'real', 'lean'), 'unknown high*');
  assert.equal(modelCell(text, 'real', 'lean-own'), 'unknown');
  assert.equal(modelCell(text, 'real', 'lean-high'), '-', 'a cell with no reading');
  // One line says what the mark means, above the tables.
  assert.match(text.split('## ')[0], /`\*` .*not measured/);
  // Under a table, a session that ran another model than the one asked for is named; one that ran the same is not.
  assert.match(section(text, 'seeded'), /^- `current` ran on gpt-the-review-ran low, and was asked for gpt-user high\.$/m);
  assert.doesNotMatch(section(text, 'seeded'), /`lean` ran on/);
  assert.doesNotMatch(section(text, 'real'), /ran on gpt/, 'with nothing asked for there is nothing to differ from');
  assert.doesNotMatch(text, /default|should|recommend|better|winner/i, 'it reports, and chooses nothing');
});

test('a session is named as having run something else only when a half known on both sides differs: a half that is not known is no difference', () => {
  const repo = repository();
  // The same model, and an effort that one side does not know: nothing is known to differ.
  record(repo, 'current', 'seeded', measured('gpt-x', 'low', 'gpt-x', null));
  record(repo, 'lean', 'seeded', measured('gpt-x', null, 'gpt-x', 'high'));
  // The same on both halves, and a model neither side knows beside an equal effort.
  record(repo, 'lean-own', 'seeded', measured('gpt-x', 'low', 'gpt-x', 'low'));
  record(repo, 'lean-high', 'seeded', measured(null, 'low', null, 'low'));
  // Another model, with an effort that was not asked for: the model alone is a difference.
  record(repo, 'current', 'real', measured('gpt-it-ran', 'low', 'gpt-asked', null));
  // The same model at another effort, both known.
  record(repo, 'lean', 'real', measured('gpt-x', 'low', 'gpt-x', 'high'));
  // A model the session did not write down, and an effort that differs: the effort alone is a difference.
  record(repo, 'lean-own', 'real', measured(null, 'low', 'gpt-x', 'high'));
  // Each half known on one side only, the other way round on each: nothing can be compared.
  record(repo, 'lean-high', 'real', measured('gpt-x', null, null, 'high'));
  // Read from the command and not from the session: what ran was not measured, so nothing is said of it.
  record(repo, 'lean-codegraph', 'real', { model: 'gpt-x', effort: 'low', modelSource: 'command', configuredModel: 'gpt-y', configuredEffort: 'high' });
  const text = reportMarkdown({ readingsDir: repo.readings }).text;
  const said = (range) => section(text, range).split('\n').filter((line) => / ran on (?!codex-cli)/.test(line));
  assert.deepEqual(said('seeded'), [], 'an unknown half is not a difference');
  assert.deepEqual(said('real'), [
    '- `current` ran on gpt-it-ran low, and was asked for gpt-asked unknown.',
    '- `lean` ran on gpt-x low, and was asked for gpt-x high.',
    '- `lean-own` ran on unknown low, and was asked for gpt-x high.',
  ]);
});

test('under a table, each configuration read on another CLI version than the others is named: the comparison is fair on one version', () => {
  const repo = repository();
  recordAll(repo, (config, range) => (config === 'lean-high' && range === 'seeded' ? { cli: '0.160.0' } : {}));
  const text = reportMarkdown({ readingsDir: repo.readings }).text;
  assert.match(section(text, 'seeded'), /^- `lean-high` ran on codex-cli 0\.160\.0, the others on 0\.160\.1: .*one version/m);
  assert.doesNotMatch(section(text, 'real'), /ran on codex-cli/);
  // With every reading on one version nothing is said.
  const same = repository();
  recordAll(same);
  assert.doesNotMatch(reportMarkdown({ readingsDir: same.readings }).text, /ran on codex-cli/);
  // And a reading taken over other commits than the range's is named too.
  const moved = repository();
  recordAll(moved, (config, range) => (config === 'lean' && range === 'real' ? { range: { name: 'real', base: 'a'.repeat(40), head: 'b'.repeat(40) } } : {}));
  assert.match(section(reportMarkdown({ readingsDir: moved.readings }).text, 'real'), /^- `lean` was read over aaaaaaa\.\.bbbbbbb, not over this range\.$/m);
});

test('--require-complete exits 1 and lists the cells with no reading, and exits 0 once all nine are recorded', () => {
  const repo = repository();
  const none = run(['--require-complete'], repo);
  assert.equal(none.code, 1);
  assert.match(none.err, /9 of 9 cells have no reading/);
  for (const { config, range } of CELLS) assert.equal(none.err.includes(`${config}:${range}`), !config.startsWith('sol'), `${config}:${range}: a cell of the comparison is named, a run of an arm is not`);
  assert.ok(fs.existsSync(repo.out), 'the report is written all the same');
  recordAll(repo);
  fs.rmSync(readingFile(repo.readings, 'lean-codegraph', 'real'));
  fs.writeFileSync(readingFile(repo.readings, 'current', 'real'), 'not json', 'utf8');
  const two = run(['--require-complete'], repo);
  assert.equal(two.code, 1);
  assert.match(two.err, /2 of 9 cells have no reading: current:real, lean-codegraph:real\b/);
  // A file that is not a reading is a missing cell, and the report says what is wrong with it.
  const text = fs.readFileSync(repo.out, 'utf8');
  assert.equal(row(section(text, 'real'), 'current')[1], 'missing');
  assert.match(section(text, 'real'), /^- `current`: current__real\.json is not JSON/m);
  assert.equal(run([], repo).code, 0, 'without the flag a report with missing cells is still a report');
  record(repo, 'lean-codegraph', 'real');
  record(repo, 'current', 'real', { outcome: 'failed', reason: 'it exited 1' });
  const all = run(['--require-complete'], repo);
  assert.equal(all.code, 0, all.err);
  assert.equal(all.err, '', 'a recorded cell is complete whatever its outcome: the report shows the outcome');
});

test('--out names the file the report is written to; a bad command line is a usage error and writes nothing', () => {
  const repo = repository();
  const elsewhere = path.join(repo.root, 'deep', 'er', 'report.md');
  const result = run(['--out', elsewhere], repo);
  assert.equal(result.code, 0, result.err);
  assert.equal(fs.readFileSync(elsewhere, 'utf8').trimEnd(), result.out);
  assert.equal(fs.existsSync(repo.out), false);
  for (const argv of [['--out'], ['--out', '--require-complete'], ['--everything'], ['report.md']]) {
    const wrong = run(argv, repo);
    assert.equal(wrong.code, 2, JSON.stringify(argv));
    assert.match(wrong.err, /Usage: node evals\/review\/report\.mjs/);
  }
  assert.equal(fs.existsSync(repo.out), false);
  // A file that cannot be written is exit 1, said.
  const blocked = run(['--out', repo.readings], repo);
  assert.equal(blocked.code, 1);
  assert.match(blocked.err, /Could not write the report/);
});
