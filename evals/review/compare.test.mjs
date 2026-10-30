import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { codexArgs, REVIEW_EFFORT } from '../../bin/codex-review.mjs';
import { createLeanHome as makeLeanHome, leanHomesDir } from '../../bin/lib/codex-review-home.mjs';
import { REVIEW_PROMPT_VERSION } from '../../bin/lib/codex-review-prompt.mjs';
import { windowsCommandLine } from '../../bin/lib/windows-args.mjs';
import { repoTemplate } from '../../bin/lib/git-fixture.testkit.mjs';
import {
  buildReading, CELLS, CHECKOUT_NAME, codegraphSettings, compareMain, CONFIGS, EXCLUDED, FINDING_BODY_MAX, RANGES, READING_SCHEMA,
  readingFile, readReading,
} from './compare.mjs';

// Real git and a fake `codex`, through injected spawns: no test calls a real Codex, the model, or CodeGraph.
// The machine is a temporary folder too: an OS home with a fixture for a Codex home and its login, the
// folder the checkouts go beside, the temp folder and the folder of the readings. No test reads the real
// Codex home, its `config.toml` or its login, and none writes a reading into the repository.
const LOGIN = 'FIXTURE login, not a token\n';
const KEY = JSON.parse(fs.readFileSync(new URL('./seeded/key.json', import.meta.url), 'utf8'));
const RUN_ID = '00000000-0000-4000-8000-000000000001';
const PLATFORM = process.platform;
let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-review-compare-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

/** The environment the comparison is given: the host's, without a Codex home or a state dir of the user's, and
 * without the mark of a gate's turn (`JS_HARNESS_GATE_HELD`), which the gate sets for its sensors and a run by
 * hand does not: inherited, it made these tests pass in the gate and fail by hand (docs/FAILURES.md). */
const hostEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(codex_home|js_harness_home|js_harness_gate_held|engram_.*)$/i.test(name)));

/** `hostEnv` in a turn of the machine's gate lock, where a cell is run (`js-harness gate -- ...`). */
const inTurn = () => ({ ...hostEnv(), JS_HARNESS_GATE_HELD: '1' });

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

const CONFIG_TOML = [
  'model = "gpt-user"',
  'model_reasoning_effort = "high"',
  'notify = ["computer-use.exe", "turn-ended"]',
  '',
  '[mcp_servers.codegraph]',
  'command = "codegraph" # the index of the project',
  'args = ["serve", "--mcp"]',
  '',
  '[mcp_servers.codegraph.env]',
  'CODEGRAPH_TELEMETRY = "0"',
  '',
  '[mcp_servers.engram]',
  'command = "engram"',
  'args = ["mcp"]',
  '',
  '[plugins."computer-use@openai-bundled"]',
  'enabled = true',
  '',
].join('\n');
const CODEGRAPH = ['mcp_servers.codegraph.command="codegraph"', 'mcp_servers.codegraph.args=["serve", "--mcp"]', 'mcp_servers.codegraph.env.CODEGRAPH_TELEMETRY="0"'];

/** A machine in a temporary folder: `oshome` with a Codex home (`codexHome`: the login `auth`, a
 * `config.toml`, the global `AGENTS.md`, a skill), `parent` where a checkout and a template go, `tmp` for
 * the seeded repository and `readings` for what is recorded. `config` is the text of `config.toml`. */
function machine({ config = CONFIG_TOML } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-review-compare-'));
  made.push(root);
  const at = (...names) => path.join(root, ...names);
  const codexHome = at('oshome', '.codex');
  fs.mkdirSync(path.join(codexHome, 'skills', 'ship'), { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'auth.json'), LOGIN, 'utf8');
  fs.writeFileSync(path.join(codexHome, 'config.toml'), config, 'utf8');
  fs.writeFileSync(path.join(codexHome, 'AGENTS.md'), 'The global instructions.\n', 'utf8');
  fs.writeFileSync(path.join(codexHome, 'skills', 'ship', 'SKILL.md'), '# ship\n', 'utf8');
  for (const name of ['parent', 'tmp', 'readings']) fs.mkdirSync(at(name));
  return {
    root, oshome: at('oshome'), codexHome, auth: path.join(codexHome, 'auth.json'), configToml: path.join(codexHome, 'config.toml'),
    parent: at('parent'), tmp: at('tmp'), readings: at('readings'), homes: leanHomesDir(at('oshome')),
  };
}

const GOAL = 'Counts are stored once.';
const FEATURE_DOC = `# A feature\n\n## Goal\n${GOAL}\n\n## Done when\n- \`npm test\` exits 0\n`;

// Each repository is built once in a run of this file, by its `extra`, and copied (`bin/lib/git-fixture.testkit.mjs`).
const fakeRepositories = new Map();

/** A repository of two commits that stands in for this one, and the `real` range over it: `base` is the
 * first commit and `head` the second. `extra` are more files of the first commit. */
function fakeRepository(m, extra = {}) {
  const root = path.join(m.root, 'repository');
  const key = JSON.stringify(extra);
  if (!fakeRepositories.has(key)) fakeRepositories.set(key, repoTemplate((template) => buildFakeRepository(template, extra)));
  const { base, head } = fakeRepositories.get(key)(root);
  const real = { ...RANGES.find((range) => range.name === 'real'), base, head, doc: 'odd/tasks/feature.md' };
  return { root, base, head, ranges: [real, ...RANGES.filter((range) => range.name !== 'real')] };
}

/** Builds in `root` the repository `fakeRepository` hands out copies of: `{ base, head }`. */
function buildFakeRepository(root, extra) {
  fs.mkdirSync(path.join(root, 'odd', 'tasks'), { recursive: true });
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  git(root, 'config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(root, 'odd', 'tasks', 'feature.md'), FEATURE_DOC, 'utf8');
  fs.writeFileSync(path.join(root, 'f.txt'), 'one\n', 'utf8');
  // A repository with no program reads the Codex review's switch as off and `codex-review` starts nothing
  // (odd/tasks/on-demand-functions.md, S7): it holds one, unchanged by the range, so a cell's review runs.
  fs.writeFileSync(path.join(root, 'tool.js'), 'export const tool = 1;\n', 'utf8');
  for (const [name, content] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content, 'utf8');
  }
  git(root, 'add', '--all', '--force', '.');
  git(root, 'commit', '--quiet', '-m', 'one');
  const base = git(root, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'f.txt'), 'two\n', 'utf8');
  git(root, 'commit', '--quiet', '-am', 'two');
  return { base, head: git(root, 'rev-parse', 'HEAD') };
}

// The JSONL events `codex exec --json` prints.
const jsonl = (...lines) => `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
const events = (patch) => jsonl(
  { type: 'thread.started', thread_id: 't1' },
  { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'c', type: 'command_execution', command: 'git diff', aggregated_output: patch, exit_code: 0, status: 'completed' } },
  { type: 'item.completed', item: { id: 'm', type: 'agent_message', text: 'The review, as Codex renders it.' } },
  { type: 'turn.completed', usage: { input_tokens: 0, output_tokens: 0 } },
);

const usageOf = (input, cached, output, reasoning) => ({ input_tokens: input, cached_input_tokens: cached, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output });
const tokenCount = (total, last = total) => ({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: total, last_token_usage: last }, rate_limits: null } });
// What every fake review spent: two requests, the first of 18,200 input tokens.
const SPENT = { inputTokens: 40100, cachedInputTokens: 18176, outputTokens: 480, reasoningOutputTokens: 150 };

/** The rollout file of the review sub-agent: what it spent and, last, its answer with `findings`, each
 * `{ file, start, end }` from the root of the repository `root` (Codex names the file by its absolute path).
 * With `ran`, `{ model, effort }`, it holds the `turn_context` line a real one does, which names what the
 * session ran with; without, none, as the files this reader was first written against. */
const rollout = (root, findings, said, ran = null) => jsonl(
  { type: 'session_meta', payload: { id: 'review', source: { subagent: 'review' } } },
  ...(ran === null ? [] : [{ type: 'turn_context', payload: { cwd: root, model: ran.model, effort: ran.effort, summary: 'auto' } }]),
  tokenCount(usageOf(18200, 0, 210, 90)),
  tokenCount(usageOf(40100, 18176, 480, 150), usageOf(21900, 18176, 270, 60)),
  {
    type: 'response_item',
    payload: {
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'output_text',
        text: said ?? JSON.stringify({
          findings: findings.map(({ file, start, end, body = 'What is wrong, and why.' }) => ({
            title: `Wrong at ${file}`, body, confidence_score: 0.8, priority: 1, code_location: { absolute_file_path: path.join(root, file), line_range: { start, end } },
          })),
          overall_correctness: findings.length === 0 ? 'patch is correct' : 'patch is incorrect',
          overall_explanation: 'Read the whole diff.',
        }),
      }],
    },
  },
);

/** The model and the effort a Codex was launched with, read off its launch: the value of `-m` and of the
 * `model_reasoning_effort` setting, in an argv or in the one command line a shell is handed on Windows. */
function launchedOn(command, args) {
  const line = [command, ...args].join(' ');
  return { model: / -m "?([\w.-]+)/.exec(line)?.[1], effort: /model_reasoning_effort=\\?"([a-z]+)/.exec(line)?.[1] };
}

/** A fake async child: `stdout` is written, then it closes with `status`. It has a `stdin` when it was
 * spawned with one, and `received` is what was written there. */
function fakeChild({ stdout, status, piped }) {
  const child = new EventEmitter();
  child.pid = 4242;
  child.stdout = new PassThrough();
  child.stdin = null;
  child.received = '';
  if (piped) {
    child.stdin = new PassThrough();
    child.stdin.setEncoding('utf8');
    child.stdin.on('data', (chunk) => {
      child.received += chunk;
    });
  }
  child.kill = () => {};
  setImmediate(() => {
    child.stdout.once('end', () => setImmediate(() => child.emit('close', status, null)));
    child.stdout.write(stdout);
    child.stdout.end();
  });
  return child;
}

/** The fakes of one run. `spawn` is real git, a `codex --version` that answers `probe`, and anything else
 * (`codegraph`) recorded in `tools` and answered with the exit code `init`. `spawnAsync` is the review: it
 * shows the diff of the checkout's last commit (unless `shows` is false), leaves the rollout file of a review
 * with `findings` in its home when it has one and is not ephemeral (`said` is the text of its answer, in
 * place of one built from the findings; `ran`, the model and the effort that file says the session ran
 * with), and ends with `status`. `calls` holds each launch with what `during(opts)` saw, and `order` what
 * happened in which order.
 *
 * Unless a test says what the session ran with, its file says what a real one does: the model and the effort
 * it was launched with (`launchedOn`). A review whose file names no model does not stand, and `ran: null` is
 * such a file. */
function fakeCodex({ findings = [], status = 0, shows = true, said, ran, probe = { status: 0, stdout: 'codex-cli 0.160.1\n' }, init = 0, during = () => ({}) } = {}) {
  const calls = [];
  const tools = [];
  const order = [];
  const spawn = (command, args, opts) => {
    if (command === 'git') return spawnSync(command, args, opts);
    if (/^codex(\s|$)/.test(command)) return probe;
    order.push('tool');
    tools.push({ command, args, opts });
    return { status: init, stdout: '', stderr: init === 0 ? '' : 'the index could not be built' };
  };
  const spawnAsync = (command, args, opts) => {
    order.push('review');
    const home = opts.env.CODEX_HOME;
    const seen = during(opts);
    const patch = shows ? spawnSync('git', ['diff', '--no-color', '--no-ext-diff', 'HEAD~1', 'HEAD'], { cwd: opts.cwd, encoding: 'utf8' }).stdout : '';
    if (typeof home === 'string' && fs.existsSync(home)) {
      const dir = path.join(home, 'sessions', '2026', '10', '07');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'rollout-2026-10-07T05-34-59-review.jsonl'), rollout(opts.cwd, findings, said, ran === undefined ? launchedOn(command, args) : ran), 'utf8');
    }
    const child = fakeChild({ stdout: events(patch), status, piped: opts.stdio?.[0] === 'pipe' });
    calls.push({ command, args, opts, child, seen });
    return child;
  };
  return { spawn, spawnAsync, calls, tools, order };
}

/** A fake that fails the test when anything at all is started. */
function nothingStarts() {
  const never = (command) => {
    throw new Error(`nothing may be started, and ${command} was`);
  };
  return { spawn: never, spawnAsync: never, calls: [], tools: [], order: [] };
}

/** A function that answers each call with the next of `values`, then keeps giving the last. */
function ticking(...values) {
  let calls = 0;
  return () => values[Math.min(calls++, values.length - 1)];
}

/** Runs the comparison on the machine `m` with the fakes `fake`; `m.repository`, when there is one, stands
 * in for this repository and its `real` range. */
async function run(argv, m, fake = nothingStarts(), extra = {}) {
  const out = [];
  const err = [];
  const code = await compareMain(argv, {
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    env: inTurn(),
    homedir: () => m.oshome,
    repoRoot: m.repository?.root ?? path.join(m.root, 'no-repository'),
    ranges: m.repository?.ranges ?? RANGES,
    readingsDir: m.readings,
    checkoutParent: m.parent,
    tmpdir: m.tmp,
    now: () => new Date('2026-10-07T12:00:00.000Z'),
    spawn: fake.spawn,
    review: { spawnAsync: fake.spawnAsync, killTree: () => {}, randomUUID: () => RUN_ID, monotonicNow: ticking(1000, 61000), write: () => {} },
    ...extra,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

/** How Codex is launched with `argv` on this host: through a shell as one line on Windows, else as it is. */
const launchedWith = (argv) => (PLATFORM === 'win32' ? { command: windowsCommandLine('codex', argv), args: [] } : { command: 'codex', args: argv });
const launched = ({ command, args }) => ({ command, args });

/** The argv Codex is launched with for a lean cell over the range from `base`: the lean session at the
 * effort the cell was measured with, `medium` unless `over` says otherwise, which is not the effort
 * `codex-review` passes when nobody names one. `over` is what the cell varies (`codexArgs`). */
const leanCell = (base, prompt = 'codex', over = {}) => codexArgs(base, PLATFORM, prompt, { effort: 'medium', ...over });

const reading = (m, config, range) => JSON.parse(fs.readFileSync(readingFile(m.readings, config, range), 'utf8'));
const entries = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);

// --- the matrix ---

test('the matrix is data: five configurations over two ranges, nine cells, CodeGraph on the real range alone', () => {
  assert.deepEqual(CONFIGS.map((config) => config.name), ['current', 'lean', 'lean-own', 'lean-high', 'lean-codegraph']);
  assert.deepEqual(CONFIGS.map(({ session, prompt, effort, doc, codegraph }) => [session, prompt, effort, doc, codegraph]), [
    ['current', 'codex', null, false, false],
    ['lean', 'codex', 'medium', false, false],
    ['lean', 'own', 'medium', true, false],
    ['lean', 'codex', 'high', false, false],
    ['lean', 'codex', 'medium', false, true],
  ]);
  // One configuration is retired, and stays in the matrix: its cells are still listed and reported.
  assert.deepEqual(CONFIGS.map(({ name, retired }) => [name, retired]), [['current', '2026-10-08'], ['lean', null], ['lean-own', null], ['lean-high', null], ['lean-codegraph', null]]);
  assert.deepEqual(RANGES.map(({ name, base, head, doc }) => ({ name, base, head, doc })), [
    { name: 'real', base: '338386a6de63e4a47ef0515ceb6fda5f99846df8', head: 'e3aad4802d4604fbc4976e2ad5c4a40e2f5de42e', doc: 'odd/tasks/codex-review-lean.md' },
    { name: 'seeded', base: KEY.base, head: KEY.head, doc: 'odd/tasks/stocktake.md' },
  ]);
  assert.deepEqual(CELLS.map(({ config, range }) => `${config}:${range}`), [
    'current:real', 'current:seeded', 'lean:real', 'lean:seeded', 'lean-own:real', 'lean-own:seeded', 'lean-high:real', 'lean-high:seeded', 'lean-codegraph:real',
  ]);
  assert.deepEqual(EXCLUDED.map(({ config, range }) => `${config}:${range}`), ['lean-codegraph:seeded']);
  assert.match(EXCLUDED[0].why, /index/);
  // The document the seeded range is judged against is in the tree that is built.
  assert.ok(fs.existsSync(new URL(`./seeded/head/${RANGES[1].doc}`, import.meta.url)));
});

test('each lean configuration is pinned at the effort its committed readings were measured with, whatever effort `codex-review` passes by default', () => {
  // The effort a review runs at when nobody names one changed on 2026-10-08, from `medium` to `high`, and on
  // 2026-10-12 back to `medium`. A
  // configuration that took its effort from that default would be another configuration since, under the
  // name of the one that was measured: so each names its own, and the readings in the repository say which.
  assert.equal(REVIEW_EFFORT, 'medium', 'the default is what three of the four lean configurations were measured at again, and none of them reads it');
  const committed = new URL('../results/review/readings/', import.meta.url);
  const lean = CONFIGS.filter((config) => config.session === 'lean');
  assert.deepEqual(lean.map((config) => [config.name, config.effort]), [['lean', 'medium'], ['lean-own', 'medium'], ['lean-high', 'high'], ['lean-codegraph', 'medium']]);
  let read = 0;
  for (const { config, range } of CELLS.filter((cell) => lean.some((one) => one.name === cell.config))) {
    const stored = JSON.parse(fs.readFileSync(new URL(`${config}__${range}.json`, committed), 'utf8'));
    // What the command passed: the reading's `effort`, or `configuredEffort` when `effort` is what the session ran with.
    const passed = stored.modelSource === 'session' ? stored.configuredEffort : stored.effort;
    assert.equal(passed, CONFIGS.find((one) => one.name === config).effort, `${config}:${range}`);
    read += 1;
  }
  assert.equal(read, 7, 'every lean cell has a committed reading to be held to');
});

test('a reading is one file a cell, named after its configuration and its range', () => {
  assert.equal(readingFile(path.join('x', 'readings'), 'lean-own', 'seeded'), path.join('x', 'readings', 'lean-own__seeded.json'));
});

// --- the command line ---

test('--list names every cell and says which are recorded, and starts nothing', async () => {
  const m = machine();
  const empty = await run(['--list'], m);
  assert.equal(empty.code, 0, empty.err);
  for (const { config, range } of CELLS) assert.match(empty.out, new RegExp(`^${config}:${range}\\s+missing$`, 'm'));
  assert.match(empty.out, /^0 of 9 cells are recorded\.$/m);
  assert.match(empty.out, /lean-codegraph:seeded/, 'and the one that is not a cell, with why');
  fs.writeFileSync(readingFile(m.readings, 'lean', 'seeded'), JSON.stringify({ schema: READING_SCHEMA, config: 'lean', range: { name: 'seeded' }, outcome: 'not-inspected', recordedAt: '2026-10-07T12:00:00.000Z', cli: '0.160.1' }), 'utf8');
  fs.writeFileSync(readingFile(m.readings, 'lean', 'real'), 'not json', 'utf8');
  const one = await run(['--list'], m);
  assert.match(one.out, /^lean:seeded\s+recorded\s+not-inspected\s+2026-10-07T12:00:00\.000Z\s+codex-cli 0\.160\.1$/m);
  assert.match(one.out, /^lean:real\s+missing \(.*not .*reading.*\)$/m, 'a file that is not a reading is not a recorded cell');
  assert.match(one.out, /^1 of 9 cells are recorded\.$/m);
});

test('exactly one cell an invocation: none, two, an unknown one and the one left out are usage errors, and nothing starts', async () => {
  const m = machine();
  const wrong = [
    [],
    ['--cell', 'lean:seeded', '--cell', 'lean:real'],
    ['--cell'],
    ['--cell', 'lean'],
    ['--cell', 'fast:seeded'],
    ['--cell', 'lean:tiny'],
    ['--cell', 'lean:seeded', '--list'],
    ['--cell', 'lean:seeded', '--everything'],
    ['--dry-run'],
  ];
  for (const argv of wrong) {
    const result = await run(argv, m);
    assert.equal(result.code, 2, JSON.stringify(argv));
    assert.match(result.err, /Usage: node evals\/review\/compare\.mjs/, JSON.stringify(argv));
  }
  const excluded = await run(['--cell', 'lean-codegraph:seeded'], m);
  assert.equal(excluded.code, 2);
  assert.match(excluded.err, /lean-codegraph:seeded is not a cell.*index/);
  assert.deepEqual(entries(m.readings), []);
  assert.deepEqual(entries(m.parent), []);
});

// --- a dry run ---

/** The argv a dry run printed. */
const printedArgv = (out) => JSON.parse(out.split('\n').find((line) => line.startsWith('Codex argv: ')).slice('Codex argv: '.length));

test('--dry-run prints the checkout, the argv of the review and where the reading goes, and starts nothing', async () => {
  const m = machine();
  const cases = [
    ['lean:seeded', leanCell(KEY.base)],
    ['lean-own:seeded', leanCell(KEY.base, 'own')],
    ['lean-high:seeded', leanCell(KEY.base, 'codex', { effort: 'high' })],
    ['lean-codegraph:real', leanCell(RANGES[0].base, 'codex', { extraConfig: CODEGRAPH })],
  ];
  for (const [cell, argv] of cases) {
    const [config, range] = cell.split(':');
    const result = await run(['--cell', cell, '--dry-run'], m, nothingStarts(), { configToml: m.configToml });
    assert.equal(result.code, 0, `${cell}: ${result.err}`);
    assert.deepEqual(printedArgv(result.out), argv, cell);
    assert.match(result.out, /nothing is started/, cell);
    assert.ok(result.out.includes(`Reading: ${readingFile(m.readings, config, range)} (missing)`), result.out);
    assert.match(result.out, /^Checkout: /m, cell);
    assert.match(result.out, /^Command: js-harness codex-review --base [0-9a-f]{40} /m, cell);
    // No cell names a session: `codex-review` has one, and `--session` is a flag it only still reads.
    const command = result.out.split('\n').find((line) => line.startsWith('Command: '));
    assert.doesNotMatch(command, /--session/, command);
    assert.equal(command, `Command: js-harness codex-review --base ${range === 'seeded' ? KEY.base : RANGES[0].base}${config === 'lean-own' ? ` --prompt own --doc ${RANGES.find((one) => one.name === range).doc}` : ''} --cwd ${range === 'seeded' ? path.join(m.tmp, 'codex-review-seeded-*') : path.join(m.parent, CHECKOUT_NAME)}`, cell);
  }
  // Each configuration differs from `lean` where it says it does, and nowhere else.
  assert.equal(cases[1][1].at(-1), '-');
  assert.deepEqual(cases[1][1].slice(0, -1), cases[0][1].slice(0, -2), 'the own prompt in place of the base, and no other token');
  assert.deepEqual(cases[2][1], cases[0][1].map((token) => (token === 'model_reasoning_effort="medium"' ? 'model_reasoning_effort="high"' : token)));
  assert.deepEqual(cases[3][1].filter((token) => token.startsWith('mcp_servers.')), CODEGRAPH);
  const real = await run(['--cell', 'lean:real', '--dry-run'], m);
  assert.ok(real.out.includes(path.join(m.parent, CHECKOUT_NAME)), real.out);
  assert.match(real.out, /git clone/);
  const index = await run(['--cell', 'lean-codegraph:real', '--dry-run'], m, nothingStarts(), { configToml: m.configToml });
  assert.match(index.out, /codegraph init --yes \. in /);
  assert.deepEqual([entries(m.readings), entries(m.parent), entries(m.tmp)], [[], [], []], 'nothing was made');
  assert.equal(fs.existsSync(m.homes), false);
});

test('--dry-run: the argv of the four lean cells is the one their readings were taken with, token by token, though the effort of `codex-review` has changed since', async () => {
  const m = machine();
  // Written out, and not asked of `codexArgs`: this is what a dry run printed on 2026-10-08, before the
  // command's own effort went from `medium` to `high`. Off Windows, where the lean argv names no sandbox.
  const lean = (base, effort, extra = []) => [
    'exec', 'review', '--json',
    '--ignore-user-config', '--ignore-rules',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
    '-m', 'gpt-6.1-sol',
    '-c', `model_reasoning_effort="${effort}"`,
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'skills.include_instructions=false',
    ...extra,
    '--base', base,
  ];
  const measured = [
    ['lean:seeded', lean(KEY.base, 'medium')],
    ['lean:real', lean(RANGES[0].base, 'medium')],
    ['lean-own:seeded', [...lean(KEY.base, 'medium').slice(0, -2), '-']],
    ['lean-high:seeded', lean(KEY.base, 'high')],
    ['lean-high:real', lean(RANGES[0].base, 'high')],
    ['lean-codegraph:real', lean(RANGES[0].base, 'medium', CODEGRAPH.flatMap((setting) => ['-c', setting]))],
  ];
  for (const [cell, argv] of measured) {
    const result = await run(['--cell', cell, '--dry-run'], m, nothingStarts(), { configToml: m.configToml, platform: 'linux' });
    assert.equal(result.code, 0, `${cell}: ${result.err}`);
    assert.deepEqual(printedArgv(result.out), argv, cell);
  }
});

// --- the configuration that is retired ---

const RETIRED = (cell) =>
  `Cell ${cell} cannot be run: the \`current\` configuration was retired on 2026-10-08, because a Codex review runs only on gpt-6.1-sol at medium effort (odd/tasks/codex-review-cost.md) ` +
  'and this configuration measured one on the model the user\'s own Codex configuration names. Its readings stay as the record of the comparison; nothing was started.';

test('the current configuration is retired: its cells are refused before anything is made or started, with --force and as a dry run too, and its readings stay', async () => {
  const m = machine();
  m.repository = fakeRepository(m);
  // One of its two cells has a reading, as both have in the repository; the other has none.
  const stored = `${JSON.stringify({ schema: READING_SCHEMA, config: 'current', range: { name: 'seeded' }, outcome: 'reviewed', recordedAt: '2026-10-08T03:15:58.144Z', cli: '0.161.0' }, null, 2)}\n`;
  fs.writeFileSync(readingFile(m.readings, 'current', 'seeded'), stored, 'utf8');
  for (const cell of ['current:seeded', 'current:real']) {
    for (const flags of [[], ['--force'], ['--dry-run'], ['--dry-run', '--force'], ['--force', '--keep-checkout']]) {
      const fake = nothingStarts();
      const result = await run(['--cell', cell, ...flags], m, fake, { configToml: m.configToml });
      const which = `${cell} ${flags.join(' ')}`;
      assert.equal(result.code, 1, which);
      assert.equal(result.err, RETIRED(cell), which);
      assert.equal(result.out, '', `${which}: nothing is said of a checkout, a home or an argv`);
      // No checkout, no template of a home, no home, no seeded repository, and the reading as it was.
      assert.deepEqual([entries(m.parent), entries(m.tmp)], [[], []], which);
      assert.equal(fs.existsSync(m.homes), false, which);
      assert.deepEqual(entries(m.readings), ['current__seeded.json'], which);
      assert.equal(fs.readFileSync(readingFile(m.readings, 'current', 'seeded'), 'utf8'), stored, which);
    }
  }
  assert.equal(fs.statSync(m.auth).nlink, 1, 'the login was never linked');
  // The cells are still cells: listed, with the reading one of them has, and not a usage error.
  const list = await run(['--list'], m);
  assert.match(list.out, /^current:seeded\s+recorded\s+reviewed\s+2026-10-08T03:15:58\.144Z\s+codex-cli 0\.161\.0$/m);
  assert.match(list.out, /^current:real\s+missing$/m);
  assert.match(list.out, /^1 of 9 cells are recorded\.$/m);
  // And the usage says which cells can be run, and which are kept as readings alone.
  const usage = await run([], m);
  assert.equal(usage.code, 2);
  assert.match(usage.err, /^Cells: lean:real, lean:seeded, lean-own:real, lean-own:seeded, lean-high:real, lean-high:seeded, lean-codegraph:real\.$/m);
  assert.match(usage.err, /^Retired, kept as readings and not run: current:real, current:seeded\.$/m);
});

test('--dry-run of the CodeGraph cell refuses when the configuration names no such server, and says where it looked', async () => {
  const m = machine({ config: 'model = "gpt-user"\n\n[mcp_servers.engram]\ncommand = "engram"\n' });
  const result = await run(['--cell', 'lean-codegraph:real', '--dry-run'], m, nothingStarts(), { configToml: m.configToml });
  assert.equal(result.code, 1);
  assert.match(result.err, /\[mcp_servers\.codegraph\]/);
  assert.ok(result.err.includes(m.configToml), result.err);
  const gone = await run(['--cell', 'lean-codegraph:real', '--dry-run'], m, nothingStarts(), { configToml: path.join(m.root, 'no-config.toml') });
  assert.equal(gone.code, 1);
  assert.match(gone.err, /no-config\.toml/);
  // On Windows Codex is started through cmd.exe: a setting it would act on is refused, not passed on changed.
  const percent = machine({ config: '[mcp_servers.codegraph]\ncommand = "codegraph"\n\n[mcp_servers.codegraph.env]\nROOT = "%USERPROFILE%"\n' });
  const windows = await run(['--cell', 'lean-codegraph:real', '--dry-run'], percent, nothingStarts(), { configToml: percent.configToml, platform: 'win32' });
  assert.equal(windows.code, 1);
  assert.match(windows.err, /cmd\.exe/);
  assert.equal((await run(['--cell', 'lean-codegraph:real', '--dry-run'], percent, nothingStarts(), { configToml: percent.configToml, platform: 'linux' })).code, 0);
});

// --- a cell over the seeded range ---

// Two of the seven defects, each a line or two off, and one finding that is none of them.
const FOUND = [{ file: 'src/report.mjs', start: 23, end: 25 }, { file: 'src/stocktake.mjs', start: 41, end: 41, body: 'x'.repeat(FINDING_BODY_MAX + 50) }, { file: 'README.md', start: 1, end: 1 }];

test('a cell runs one review of its range and stores its reading: what ran, what it spent, what it found and how that scores', async () => {
  const m = machine();
  const fake = fakeCodex({ findings: FOUND, during: (opts) => ({ cwd: fs.realpathSync.native(opts.cwd), head: git(opts.cwd, 'rev-parse', 'HEAD'), home: entries(opts.env.CODEX_HOME) }) });
  const result = await run(['--cell', 'lean:seeded'], m, fake);
  assert.equal(result.code, 0, result.err);
  // One review, of the seeded repository built under the temp folder, with the argv a dry run prints.
  assert.equal(fake.calls.length, 1);
  assert.deepEqual(launched(fake.calls[0]), launchedWith(leanCell(KEY.base)));
  assert.equal(path.dirname(fake.calls[0].seen.cwd), fs.realpathSync.native(m.tmp), 'a folder of its own under the temp folder');
  assert.deepEqual([fake.calls[0].seen.head, fake.calls[0].seen.home], [KEY.head, ['auth.json']]);
  assert.equal(fake.calls[0].opts.env.CODEX_HOME, path.join(m.homes, RUN_ID));
  const stored = reading(m, 'lean', 'seeded');
  const { coverage, findings, ...rest } = stored;
  assert.deepEqual(rest, {
    schema: READING_SCHEMA,
    config: 'lean',
    range: { name: 'seeded', base: KEY.base, head: KEY.head },
    recordedAt: '2026-10-07T12:00:00.000Z',
    cli: '0.160.1',
    session: 'lean',
    // What the session's own file says it ran with, beside what the cell asked for: the two are the same.
    model: 'gpt-6.1-sol',
    effort: 'medium',
    modelSource: 'session',
    configuredModel: 'gpt-6.1-sol',
    configuredEffort: 'medium',
    prompt: 'codex',
    promptVersion: null,
    outcome: 'reviewed',
    reason: null,
    usage: SPENT,
    requests: 2,
    firstRequestInputTokens: 18200,
    durationMs: 60000,
    parts: 1,
    findingBodyMax: FINDING_BODY_MAX,
    verdict: 'incorrect',
    score: { defects: 7, found: ['D1', 'D2'], missed: ['D3', 'D4', 'D5', 'D6', 'D7'], extra: 1, recall: 2 / 7 },
  });
  assert.deepEqual(Object.keys(stored), [
    'schema', 'config', 'range', 'recordedAt', 'cli', 'session', 'model', 'effort', 'modelSource', 'configuredModel', 'configuredEffort', 'prompt', 'promptVersion', 'outcome', 'reason',
    'usage', 'requests', 'firstRequestInputTokens', 'durationMs', 'coverage', 'parts', 'findings', 'findingBodyMax', 'verdict', 'score',
  ]);
  assert.ok(coverage.total > 100 && coverage.seen === coverage.total, JSON.stringify(coverage));
  assert.deepEqual(findings.map(({ file, start, end, severity, title, confidence }) => ({ file, start, end, severity, title, confidence })), [
    { file: 'src/report.mjs', start: 23, end: 25, severity: 'P1', title: 'Wrong at src/report.mjs', confidence: 0.8 },
    { file: 'src/stocktake.mjs', start: 41, end: 41, severity: 'P1', title: 'Wrong at src/stocktake.mjs', confidence: 0.8 },
    { file: 'README.md', start: 1, end: 1, severity: 'P1', title: 'Wrong at README.md', confidence: 0.8 },
  ]);
  assert.equal(findings[0].body, 'What is wrong, and why.');
  assert.equal(findings[1].body.length, FINDING_BODY_MAX, 'a long body is cut to the stated maximum');
  assert.ok(findings[1].body.endsWith('…'));
  // Nothing is left: the repository that was built, the home of the run, a second name of the login.
  assert.deepEqual(entries(m.tmp), []);
  assert.deepEqual(entries(m.homes), []);
  assert.equal(fs.statSync(m.auth).nlink, 1);
  assert.deepEqual(entries(m.readings), ['lean__seeded.json']);
  assert.ok(result.out.includes(readingFile(m.readings, 'lean', 'seeded')), result.out);
  assert.equal(readReading(m.readings, 'lean', 'seeded').ok, true);
});

/** What a reading says of the model: the one it gives, where that was read, and what was asked for. */
const modelOf = ({ model, effort, modelSource, configuredModel, configuredEffort }) => ({ model, effort, modelSource, configuredModel, configuredEffort });

test('a reading names the model and the effort its session really ran with, read from the session\'s own file, and keeps beside them what the command asked for', async () => {
  const m = machine();
  // The cell passes `gpt-6.1-sol` at medium effort, and the session's file says it ran with another: the
  // review does not stand, so the reading is that of a failed cell, and it still says both.
  const result = await run(['--cell', 'lean:seeded'], m, fakeCodex({ findings: FOUND, ran: { model: 'gpt-it-ran', effort: 'low' } }));
  assert.equal(result.code, 0, result.err);
  const stored = reading(m, 'lean', 'seeded');
  assert.deepEqual(modelOf(stored), { model: 'gpt-it-ran', effort: 'low', modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'medium' });
  assert.deepEqual(Object.keys(stored).slice(6, 12), ['model', 'effort', 'modelSource', 'configuredModel', 'configuredEffort', 'prompt'], 'what was asked for comes right after what ran');
  assert.deepEqual([stored.outcome, stored.reason], ['failed', 'its session ran on gpt-it-ran at low effort, and the command passed gpt-6.1-sol at medium effort']);
  // A session that ran what it was asked to says so as well: the two are there to be seen equal.
  const same = await run(['--cell', 'lean-high:seeded'], m, fakeCodex({ findings: FOUND, ran: { model: 'gpt-6.1-sol', effort: 'high' } }));
  assert.equal(same.code, 0, same.err);
  assert.deepEqual(modelOf(reading(m, 'lean-high', 'seeded')), { model: 'gpt-6.1-sol', effort: 'high', modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'high' });
  assert.equal(reading(m, 'lean-high', 'seeded').outcome, 'reviewed');
});

test('a lean cell is held to the effort it was measured with, not to the one `codex-review` passes by default: at `medium` it stands, and at `high` it is not that cell', async () => {
  const m = machine();
  // `lean` is the lean session at `medium`. Its session ran at `medium`: the review the cell asked for.
  const kept = await run(['--cell', 'lean:seeded'], m, fakeCodex({ findings: FOUND, ran: { model: 'gpt-6.1-sol', effort: 'medium' } }));
  assert.equal(kept.code, 0, kept.err);
  const stored = reading(m, 'lean', 'seeded');
  assert.deepEqual([stored.outcome, stored.reason], ['reviewed', null]);
  assert.deepEqual(modelOf(stored), { model: 'gpt-6.1-sol', effort: 'medium', modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'medium' });
  // And one that ran at `high`, the effort of a review outside the comparison, is `lean-high` and not `lean`.
  const other = await run(['--cell', 'lean:seeded', '--force'], m, fakeCodex({ findings: FOUND, ran: { model: 'gpt-6.1-sol', effort: 'high' } }));
  assert.equal(other.code, 0, other.err);
  assert.deepEqual([reading(m, 'lean', 'seeded').outcome, reading(m, 'lean', 'seeded').reason], ['failed', 'its session ran on gpt-6.1-sol at high effort, and the command passed gpt-6.1-sol at medium effort']);
});

test('a cell whose session names no model is no review either: the reading is that of a failed cell, and says why', async () => {
  const m = machine();
  const result = await run(['--cell', 'lean:seeded'], m, fakeCodex({ findings: FOUND, ran: null }));
  assert.equal(result.code, 0, result.err);
  const stored = reading(m, 'lean', 'seeded');
  assert.deepEqual([stored.outcome, stored.reason], ['failed', 'its session\'s rollout file names no model, so nothing says that it ran on gpt-6.1-sol, the model the command passed']);
  // What the reading gives as its model is then what the cell asked for, and it says that nothing measured it.
  assert.deepEqual([stored.model, stored.effort, stored.modelSource], ['gpt-6.1-sol', 'medium', 'command']);
});

test('a review that failed or was not inspected is still recorded, with its outcome and its reason; a recorded cell is refused without --force', async () => {
  const m = machine();
  const blind = fakeCodex({ findings: FOUND, shows: false });
  const first = await run(['--cell', 'lean:seeded'], m, blind);
  assert.equal(first.code, 0, 'the reading was written, whatever the review came to');
  const unread = reading(m, 'lean', 'seeded');
  assert.equal(unread.outcome, 'not-inspected');
  assert.match(unread.reason, /showed 0 of \d+ changed lines/);
  assert.deepEqual(unread.usage, SPENT, 'what it spent is kept all the same');
  assert.equal(unread.findings.length, 3, 'and what it answered, beside an outcome that says it is no review');
  // Recorded: a second run is refused, and starts nothing.
  const again = await run(['--cell', 'lean:seeded'], m);
  assert.equal(again.code, 1);
  assert.match(again.err, /already recorded.*--force/);
  assert.deepEqual(reading(m, 'lean', 'seeded'), unread);
  // With --force the cell is run again and its reading replaced.
  const failing = fakeCodex({ status: 7 });
  const forced = await run(['--cell', 'lean:seeded', '--force'], m, failing);
  assert.equal(forced.code, 0, forced.err);
  const failed = reading(m, 'lean', 'seeded');
  assert.deepEqual([failed.outcome, failed.reason, failed.verdict], ['failed', 'it exited 7', 'correct']);
  assert.deepEqual(failed.score.found, []);
  assert.deepEqual(entries(m.tmp), []);
});

test('a review whose answer could not be read is recorded as failed, with findings that are not known, never as a review that found nothing', async () => {
  const m = machine();
  const result = await run(['--cell', 'lean:seeded'], m, fakeCodex({ said: 'I could not finish.' }));
  assert.equal(result.code, 0, result.err);
  const stored = reading(m, 'lean', 'seeded');
  assert.equal(stored.outcome, 'failed');
  assert.match(stored.reason, /not JSON/);
  assert.deepEqual([stored.findings, stored.verdict, stored.score], [null, null, null]);
});

test('a review that was never launched leaves no reading: exit 1, the reason said, and nothing kept', async () => {
  const m = machine();
  const fake = fakeCodex({ probe: { status: 1, stdout: '' } });
  const result = await run(['--cell', 'lean:seeded'], m, fake);
  assert.equal(result.code, 1);
  assert.match(result.err, /Could not run `codex`/);
  assert.match(result.err, /no reading was written/i);
  assert.equal(fake.calls.length, 0);
  assert.deepEqual(entries(m.readings), []);
  assert.deepEqual(entries(m.tmp), []);
});

test('lean-own asks with this command\'s own prompt and the range\'s feature document; lean-high is lean at high effort', async () => {
  const m = machine();
  const own = fakeCodex();
  assert.equal((await run(['--cell', 'lean-own:seeded'], m, own)).code, 0);
  assert.deepEqual(launched(own.calls[0]), launchedWith(leanCell(KEY.base, 'own')));
  const goal = fs.readFileSync(new URL('./seeded/head/odd/tasks/stocktake.md', import.meta.url), 'utf8').split('## Goal')[1].split('\n').find((line) => line.trim() !== '').trim();
  assert.ok(own.calls[0].child.received.includes(goal.slice(0, 40)), 'the Goal of the seeded feature document is in the prompt');
  assert.ok(own.calls[0].child.received.includes(KEY.base) && own.calls[0].child.received.includes(KEY.head));
  const asked = reading(m, 'lean-own', 'seeded');
  assert.deepEqual([asked.session, asked.prompt, asked.promptVersion, asked.effort, asked.verdict], ['lean', 'own', REVIEW_PROMPT_VERSION, 'medium', 'correct']);
  assert.deepEqual(asked.score, { defects: 7, found: [], missed: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'], extra: 0, recall: 0 });

  const high = fakeCodex();
  assert.equal((await run(['--cell', 'lean-high:seeded'], m, high)).code, 0);
  assert.deepEqual(launched(high.calls[0]), launchedWith(leanCell(KEY.base, 'codex', { effort: 'high' })));
  assert.deepEqual([reading(m, 'lean-high', 'seeded').effort, reading(m, 'lean-high', 'seeded').prompt], ['high', 'codex']);
  assert.deepEqual(entries(m.readings), ['lean-high__seeded.json', 'lean-own__seeded.json']);
});

test('a cell reads every file of its range, as it did when it was measured: nothing is left out of its review, whatever a caller hands over for it', async () => {
  // The seeded range changes `README.md`, and since 2026-10-08 `codex-review` leaves documents out of a
  // review, which it then asks by its files. A cell that did so would not be the cell its reading is of.
  const m = machine();
  const fake = fakeCodex({ findings: FOUND });
  const result = await run(['--cell', 'lean:seeded'], m, fake, { review: { ...reviewDeps(fake), everyFile: false } });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(launched(fake.calls[0]), launchedWith(leanCell(KEY.base)), 'asked with the sentence Codex writes for `--base`, of the whole range');
  assert.match(result.out, /Plan of the Codex review of [^\n]*, 1 part, /);
  assert.doesNotMatch(result.out, /Left out of the review|by its files/);
  assert.deepEqual([reading(m, 'lean', 'seeded').outcome, reading(m, 'lean', 'seeded').promptVersion], ['reviewed', null]);
});

test('a cell reviews its range as it was given: from the base of the range, also where a run of `codex-review` would start later', async () => {
  // Since 2026-10-08 a run starts where the Codex review records end, at the parent of the oldest code commit
  // no record covers. The first commit of this range changes a document alone, so a run would start after it;
  // the cell is the review of the whole range, which is what its reading is of.
  const m = machine();
  const repository = fakeRepository(m);
  fs.writeFileSync(path.join(repository.root, 'odd', 'tasks', 'feature.md'), `${FEATURE_DOC}\nMore words.\n`, 'utf8');
  git(repository.root, 'commit', '--quiet', '-am', 'docs: more words');
  fs.writeFileSync(path.join(repository.root, 'f.txt'), 'three\n', 'utf8');
  git(repository.root, 'commit', '--quiet', '-am', 'three');
  const head = git(repository.root, 'rev-parse', 'HEAD');
  m.repository = { ...repository, head, ranges: repository.ranges.map((range) => (range.name === 'real' ? { ...range, base: repository.head, head } : range)) };
  const fake = fakeCodex();
  const result = await run(['--cell', 'lean:real'], m, fake);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(launched(fake.calls[0]), launchedWith(leanCell(repository.head)), 'asked from the base of the range');
  assert.match(result.out, new RegExp(`^Plan of the Codex review of ${repository.head.slice(0, 7)}\\.\\.${head.slice(0, 7)}: `, 'm'));
  assert.doesNotMatch(result.out, /this run starts at|Nothing to review/);
});

// --- a cell over the real range: a clone beside the repository ---

const MARKER = ['.git', 'js-harness-review-range.json'];

test('the real range is reviewed in a clone beside the repository, detached at the head of the range, and the clone goes after the cell', async () => {
  const m = machine();
  m.repository = fakeRepository(m);
  const { root, base, head } = m.repository;
  const clone = path.join(m.parent, CHECKOUT_NAME);
  const fake = fakeCodex({
    during: (opts) => ({
      cwd: fs.realpathSync.native(opts.cwd),
      head: git(opts.cwd, 'rev-parse', 'HEAD'),
      branch: git(opts.cwd, 'rev-parse', '--abbrev-ref', 'HEAD'),
      dirty: git(opts.cwd, 'status', '--porcelain'),
      gitDir: fs.statSync(path.join(opts.cwd, '.git')).isDirectory(),
      marker: JSON.parse(fs.readFileSync(path.join(opts.cwd, ...MARKER), 'utf8')),
    }),
  });
  const result = await run(['--cell', 'lean:real'], m, fake);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(launched(fake.calls[0]), launchedWith(leanCell(base)));
  const { marker, ...seen } = fake.calls[0].seen;
  assert.deepEqual(seen, { cwd: fs.realpathSync.native(m.parent) + path.sep + CHECKOUT_NAME, head, branch: 'HEAD', dirty: '', gitDir: true });
  assert.deepEqual([marker.tool, marker.range, marker.head], ['evals/review/compare.mjs', 'real', head]);
  const stored = reading(m, 'lean', 'real');
  assert.deepEqual([stored.range, stored.outcome, stored.coverage], [{ name: 'real', base, head }, 'reviewed', { seen: 2, total: 2 }]);
  assert.equal('score' in stored, false, 'only the seeded range has a key to score against');
  // The clone is gone, and the repository it was made from holds nothing of the run: no record, no run log.
  assert.equal(fs.existsSync(clone), false);
  assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('the repository may be a linked worktree: the clone is of its repository and has a git folder of its own', async () => {
  const m = machine();
  const main = fakeRepository(m);
  const worktree = path.join(m.root, 'linked');
  git(main.root, 'worktree', 'add', '--quiet', '--detach', worktree, main.base);
  m.repository = { ...main, root: worktree };
  const fake = fakeCodex({ during: (opts) => ({ gitDir: fs.statSync(path.join(opts.cwd, '.git')).isDirectory(), head: git(opts.cwd, 'rev-parse', 'HEAD') }) });
  const result = await run(['--cell', 'lean:real'], m, fake);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(fake.calls[0].seen, { gitDir: true, head: main.head }, 'at the head of the range, not where the worktree is');
  assert.equal(fs.existsSync(path.join(main.root, '.git', 'js-harness')), false, 'the shared git folder of the worktrees holds nothing of the run');
  assert.equal(git(worktree, 'rev-parse', 'HEAD'), main.base, 'the worktree is where it was');
});

test('--keep-checkout leaves the clone, with the record and the run log of the run in its own git folder; the next cell replaces it', async () => {
  const m = machine();
  m.repository = fakeRepository(m);
  const clone = path.join(m.parent, CHECKOUT_NAME);
  const kept = await run(['--cell', 'lean:real', '--keep-checkout'], m, fakeCodex());
  assert.equal(kept.code, 0, kept.err);
  assert.deepEqual(entries(path.join(clone, '.git', 'js-harness')), ['codex-review-runs.jsonl', 'codex-reviews.jsonl']);
  assert.ok(kept.out.includes(clone), kept.out);
  // A clone this tool made is its to replace: a file left in it does not survive the next cell.
  fs.writeFileSync(path.join(clone, 'left-over.txt'), 'x', 'utf8');
  const fake = fakeCodex({ during: (opts) => ({ leftOver: fs.existsSync(path.join(opts.cwd, 'left-over.txt')) }) });
  const next = await run(['--cell', 'lean-high:real'], m, fake);
  assert.equal(next.code, 0, next.err);
  assert.deepEqual(fake.calls[0].seen, { leftOver: false });
  assert.equal(fs.existsSync(clone), false);
});

test('a folder at the place of the clone that this tool did not make is refused and left as it is', async () => {
  const m = machine();
  m.repository = fakeRepository(m);
  const clone = path.join(m.parent, CHECKOUT_NAME);
  const strangers = [
    () => fs.mkdirSync(clone),
    () => fs.writeFileSync(path.join(clone, 'notes.txt'), 'mine', 'utf8'),
    () => {
      fs.mkdirSync(path.join(clone, '.git'));
      fs.writeFileSync(path.join(clone, ...MARKER), '{"tool":"something else"}', 'utf8');
    },
  ];
  for (const make of strangers) {
    make();
    const before = entries(clone);
    const fake = fakeCodex();
    const result = await run(['--cell', 'lean:real'], m, fake);
    assert.equal(result.code, 1);
    assert.match(result.err, /not a clone this tool made/);
    assert.ok(result.err.includes(clone), result.err);
    assert.equal(fake.calls.length, 0);
    assert.deepEqual(entries(clone), before);
  }
  assert.deepEqual(entries(m.readings), []);
});

test('a range the repository does not hold is refused before any review, and the clone is not left behind', async () => {
  const m = machine();
  m.repository = fakeRepository(m);
  m.repository.ranges[0] = { ...m.repository.ranges[0], head: 'f'.repeat(40) };
  const fake = fakeCodex();
  const result = await run(['--cell', 'lean:real'], m, fake);
  assert.equal(result.code, 1);
  assert.match(result.err, /ffffffff/);
  assert.equal(fake.calls.length, 0);
  assert.equal(fs.existsSync(path.join(m.parent, CHECKOUT_NAME)), false);
  assert.deepEqual(entries(m.readings), []);
});

// --- a cell whose range is reviewed in parts ---

/** `fakeRepository`, with a `real` range over the lean session's bound of 400 changed lines: its second
 * commit also rewrites two files of 150 lines, so the range is two parts, `big-a.txt` (300 changed lines)
 * and then `big-b.txt` with `f.txt` (302). */
function fakeLargeRepository(m) {
  const body = (mark) => `${Array.from({ length: 150 }, (_, line) => `${mark} ${line}`).join('\n')}\n`;
  const repository = fakeRepository(m, { 'big-a.txt': body('a'), 'big-b.txt': body('b') });
  for (const name of ['big-a.txt', 'big-b.txt']) fs.writeFileSync(path.join(repository.root, name), body(name.toUpperCase()), 'utf8');
  git(repository.root, 'commit', '--quiet', '--amend', '--no-edit', '--all');
  const head = git(repository.root, 'rev-parse', 'HEAD');
  return { ...repository, head, ranges: repository.ranges.map((range) => (range.name === 'real' ? { ...range, head } : range)) };
}

/** The `review` deps `run` gives `codexReviewMain`, with `more` laid on them. */
const reviewDeps = (fake, more) => ({ spawnAsync: fake.spawnAsync, killTree: () => {}, randomUUID: () => RUN_ID, monotonicNow: ticking(1000, 61000, 61000, 121000), write: () => {}, ...more });

test('a cell whose range is reviewed in parts is one reading, `reviewed` once every part gave its result and the command exited 0', async () => {
  const m = machine();
  m.repository = fakeLargeRepository(m);
  const fake = fakeCodex({ findings: [{ file: 'f.txt', start: 1, end: 1 }] });
  const result = await run(['--cell', 'lean:real'], m, fake, { review: reviewDeps(fake) });
  assert.equal(result.code, 0, result.err);
  assert.equal(fake.calls.length, 2, 'one session a part');
  const stored = reading(m, 'lean', 'real');
  assert.deepEqual([stored.outcome, stored.reason, stored.parts, stored.requests, stored.durationMs], ['reviewed', null, 2, 4, 120000]);
  assert.deepEqual(stored.coverage, { seen: 602, total: 602 });
  assert.equal(stored.findings.length, 2, 'the findings of both parts');
});

test('a cell whose later part could not be launched is not a review of the range: the reading says so, and keeps what the parts that ran spent', async () => {
  const m = machine();
  m.repository = fakeLargeRepository(m);
  const fake = fakeCodex({ findings: [{ file: 'f.txt', start: 1, end: 1 }] });
  // The home of the first part is made as it always is; that of the second cannot be, so its session never
  // starts and `codexReviewMain` hands over no result for it.
  let homes = 0;
  const createLeanHome = (options) => {
    homes += 1;
    if (homes > 1) throw new Error('The Codex home of this run could not be made: the disk is full.');
    return makeLeanHome(options);
  };
  const result = await run(['--cell', 'lean:real'], m, fake, { review: reviewDeps(fake, { createLeanHome }) });
  assert.equal(fake.calls.length, 1, 'the second part was never launched');
  assert.match(result.err, /the disk is full/);
  assert.match(result.err, /Part 2 of 2 .* did not pass/);
  // The reading is written, as that of any cell that launched a review, and it is not that of a review.
  assert.equal(result.code, 0, result.err);
  const stored = reading(m, 'lean', 'real');
  assert.equal(stored.outcome, 'failed');
  assert.equal(stored.reason, 'part 2 of 2 gave no result (codex-review exited 1), so the range was not reviewed whole');
  assert.equal(stored.parts, 2);
  // What the one part that ran spent is a measurement all the same, and is kept.
  assert.deepEqual([stored.usage, stored.requests, stored.firstRequestInputTokens, stored.durationMs], [SPENT, 2, 18200, 60000]);
  assert.match(result.out, /Recorded lean:real \(failed: part 2 of 2 gave no result/);
  // A recorded cell, whatever its outcome: listed as one, and not run again without --force.
  assert.match((await run(['--list'], m)).out, /^lean:real\s+recorded\s+failed\s/m);
  const again = await run(['--cell', 'lean:real'], m);
  assert.equal(again.code, 1);
  assert.match(again.err, /already recorded.*--force/);
  // Nothing is left of the run.
  assert.deepEqual(entries(m.homes), []);
  assert.equal(fs.statSync(m.auth).nlink, 1);
  assert.equal(fs.existsSync(path.join(m.parent, CHECKOUT_NAME)), false);
});

// --- the CodeGraph cell ---

/** How `codegraph init` is started in `checkout` on this host, as `init` starts it. */
const initWith = () => {
  const args = ['init', '--yes', '.'];
  return PLATFORM === 'win32' ? { command: windowsCommandLine('codegraph', args), args: [] } : { command: 'codegraph', args };
};

test('lean-codegraph adds the CodeGraph server of the user\'s configuration to the lean argv, and builds the index of the clone first when it has none', async () => {
  const m = machine();
  m.repository = fakeRepository(m);
  const clone = path.join(m.parent, CHECKOUT_NAME);
  const fake = fakeCodex();
  const result = await run(['--cell', 'lean-codegraph:real'], m, fake, { configToml: m.configToml });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(fake.order, ['tool', 'review'], 'the index is built before the review that uses it');
  assert.deepEqual(fake.tools.map(launched), [initWith(clone)]);
  // As `init` runs it: codegraph writes no telemetry queue or update cache under the home (Codex P2 on eef7e095).
  assert.equal(fake.tools[0].opts.env.DO_NOT_TRACK, '1');
  assert.deepEqual(launched(fake.calls[0]), launchedWith(leanCell(m.repository.base, 'codex', { extraConfig: CODEGRAPH })));
  assert.deepEqual([reading(m, 'lean-codegraph', 'real').session, reading(m, 'lean-codegraph', 'real').effort], ['lean', 'medium']);
  // No other cell builds an index or names the server.
  const plain = fakeCodex();
  assert.equal((await run(['--cell', 'lean:real'], m, plain, { configToml: m.configToml })).code, 0);
  assert.deepEqual(plain.tools, []);
  assert.deepEqual(launched(plain.calls[0]), launchedWith(leanCell(m.repository.base)));
});

test('lean-codegraph builds no index where the checkout already holds one, and refuses when the index cannot be built', async () => {
  const withIndex = machine();
  withIndex.repository = fakeRepository(withIndex, { '.codegraph/graph.db': 'an index' });
  const indexed = fakeCodex();
  assert.equal((await run(['--cell', 'lean-codegraph:real'], withIndex, indexed, { configToml: withIndex.configToml })).code, 0);
  assert.deepEqual(indexed.tools, []);
  assert.equal(indexed.calls.length, 1);

  const m = machine();
  m.repository = fakeRepository(m);
  const failing = fakeCodex({ init: 3 });
  const result = await run(['--cell', 'lean-codegraph:real'], m, failing, { configToml: m.configToml });
  assert.equal(result.code, 1);
  assert.match(result.err, /`codegraph init --yes \.` in .*exited 3/);
  assert.match(result.err, /the index could not be built/);
  assert.equal(failing.calls.length, 0, 'no review without the index it is there to measure');
  assert.deepEqual(entries(m.readings), []);
  assert.equal(fs.existsSync(path.join(m.parent, CHECKOUT_NAME)), false);
});

test('lean-codegraph refuses, before anything is made, when the user\'s configuration names no CodeGraph server', async () => {
  const m = machine({ config: 'model = "gpt-user"\n' });
  m.repository = fakeRepository(m);
  const fake = fakeCodex();
  const result = await run(['--cell', 'lean-codegraph:real'], m, fake, { configToml: m.configToml });
  assert.equal(result.code, 1);
  assert.match(result.err, /\[mcp_servers\.codegraph\]/);
  assert.deepEqual([fake.calls.length, fake.tools.length], [0, 0]);
  assert.deepEqual(entries(m.parent), []);
  assert.deepEqual(entries(m.readings), []);
});

// --- a cell runs in a turn of the gate lock ---

// Out of a turn, codex-review asks its own prompt and keeps Codex from the suite (e06cf68), so a `lean` cell
// would be measured as another configuration than its name. It is refused, with the command that runs it.
test('a cell out of a turn of the gate lock is refused before anything is made, with the command that runs it', async () => {
  const m = machine();
  m.repository = fakeRepository(m);
  const fake = fakeCodex();
  const result = await run(['--cell', 'lean:real'], m, fake, { env: hostEnv() });
  assert.equal(result.code, 1);
  assert.match(result.err, /^Cell lean:real runs in a turn of the machine's gate lock/m);
  assert.match(result.err, /js-harness gate -- node evals\/review\/compare\.mjs --cell lean:real/);
  assert.deepEqual([fake.calls.length, fake.tools.length], [0, 0]);
  assert.deepEqual(entries(m.parent), []);
  assert.deepEqual(entries(m.readings), []);
});

// --- the pieces ---

test('codegraphSettings: the server\'s table and its sub-tables as `-c` settings, each value as the file writes it', () => {
  assert.deepEqual(codegraphSettings(CONFIG_TOML), CODEGRAPH);
  assert.deepEqual(codegraphSettings(CONFIG_TOML.replaceAll('\n', '\r\n')), CODEGRAPH);
  const literal = String.raw`[mcp_servers."codegraph"]` + '\n' + String.raw`command = 'C:\tools\codegraph.exe'   # where it is` + '\nstartup_timeout_sec = 30\nargs = ["serve", "#not-a-comment"]\n';
  assert.deepEqual(codegraphSettings(literal), [
    String.raw`mcp_servers.codegraph.command='C:\tools\codegraph.exe'`,
    'mcp_servers.codegraph.startup_timeout_sec=30',
    'mcp_servers.codegraph.args=["serve", "#not-a-comment"]',
  ]);
  // An inline table is one value, and goes as one.
  assert.deepEqual(codegraphSettings('[mcp_servers]\ncodegraph = { command = "codegraph" }\nengram = { command = "engram" }\n'), ['mcp_servers.codegraph={ command = "codegraph" }']);
  // Another server whose name only starts the same is not it.
  assert.throws(() => codegraphSettings('[mcp_servers.codegraph2]\ncommand = "x"\n'), /\[mcp_servers\.codegraph\]/);
  assert.throws(() => codegraphSettings(''), /\[mcp_servers\.codegraph\]/);
  // What cannot be read for certain is refused, never guessed at.
  assert.throws(() => codegraphSettings('[mcp_servers.codegraph]\nargs = [\n  "serve",\n]\n'), /one line/);
  assert.throws(() => codegraphSettings('[mcp_servers.codegraph]\ncommand = """codegraph"""\n'), /one line/);
});

/** One result as `codexReviewMain` hands it over: a run line with `over` laid on it, and an answer. */
const resultOf = (over = {}, review = { findings: [], verdict: 'correct', explanation: '', confidence: null }) => ({
  logged: true,
  review,
  run: {
    cli: '0.160.1', session: 'lean', model: 'gpt-6.1-sol', effort: 'medium', prompt: 'own', promptVersion: 'p/v1', outcome: 'reviewed',
    usage: { inputTokens: 100, cachedInputTokens: 40, outputTokens: 10, reasoningOutputTokens: 4 }, requests: 3, firstRequestInputTokens: 50, durationMs: 2000,
    coverage: { seen: 5, total: 5 }, ...over,
  },
});
const finding = (file, start, verdictBody = 'b') => ({ file, start, end: start, severity: 'P2', title: 't', body: verdictBody, confidence: 0.5 });
// `exit` is what `codexReviewMain` returned: 0, as for a review that was recorded, unless a test says otherwise.
const CELL = { config: CONFIGS[1] ?? { name: 'lean' }, range: { name: 'real', base: 'b'.repeat(40), head: 'h'.repeat(40) }, recordedAt: '2026-10-07T12:00:00.000Z', exit: 0 };

test('buildReading: a range reviewed in parts is one reading, its counts added up and its findings together', () => {
  const part = (index, over) => ({ part: { index, of: 2, files: 1, changedLines: 3 }, ...over });
  const two = buildReading({
    ...CELL,
    results: [
      resultOf(part(1), { findings: [finding('b.txt', 2)], verdict: 'incorrect', explanation: '', confidence: null }),
      resultOf(part(2, { firstRequestInputTokens: 70 }), { findings: [finding('a.txt', 9)], verdict: 'correct', explanation: '', confidence: null }),
    ],
  });
  assert.deepEqual([two.parts, two.outcome, two.reason], [2, 'reviewed', null]);
  assert.deepEqual(two.usage, { inputTokens: 200, cachedInputTokens: 80, outputTokens: 20, reasoningOutputTokens: 8 });
  assert.deepEqual([two.requests, two.firstRequestInputTokens, two.durationMs, two.coverage], [6, 50, 4000, { seen: 10, total: 10 }]);
  assert.deepEqual(two.findings.map(({ file }) => file), ['b.txt', 'a.txt']);
  assert.equal(two.verdict, 'incorrect', 'one part that says the patch is wrong is a range that is');
  assert.equal('score' in two, false);
});

test('buildReading: what a part did not measure is not known for the whole, and the outcome is that of the attempt that ended the run', () => {
  const stopped = buildReading({
    ...CELL,
    results: [
      resultOf({ part: { index: 1, of: 3, files: 1, changedLines: 3 } }),
      resultOf({ part: { index: 2, of: 3, files: 1, changedLines: 3 }, outcome: 'timed-out', reason: 'it ran past 30 minutes and was stopped', durationMs: null, usage: { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null }, requests: null }, null),
    ],
  });
  assert.deepEqual([stopped.parts, stopped.outcome, stopped.reason], [3, 'timed-out', 'it ran past 30 minutes and was stopped']);
  assert.deepEqual(stopped.usage, { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null });
  assert.deepEqual([stopped.requests, stopped.durationMs, stopped.findings, stopped.verdict], [null, null, null, null]);
  assert.equal(stopped.firstRequestInputTokens, 50);
});

test('buildReading: `reviewed` only when every part gave a result and the command exited 0; short of that the reading is `failed`, says why, and keeps what was measured', () => {
  const part = (index, of, over) => resultOf({ part: { index, of, files: 1, changedLines: 3 }, ...over }, { findings: [finding(`part-${index}.txt`, 1)], verdict: 'correct', explanation: '', confidence: null });
  // The first of three parts was reviewed and the second never handed over a result: its session could not be launched.
  const cutShort = buildReading({ ...CELL, exit: 1, results: [part(1, 3)] });
  assert.deepEqual([cutShort.outcome, cutShort.reason, cutShort.parts], ['failed', 'part 2 of 3 gave no result (codex-review exited 1), so the range was not reviewed whole', 3]);
  // What the part that ran spent and showed is what the cell measured, and stays in the reading.
  assert.deepEqual(cutShort.usage, { inputTokens: 100, cachedInputTokens: 40, outputTokens: 10, reasoningOutputTokens: 4 });
  assert.deepEqual([cutShort.requests, cutShort.firstRequestInputTokens, cutShort.durationMs, cutShort.coverage], [3, 50, 2000, { seen: 5, total: 5 }]);
  // Two of three, the same: the part that is missing is the one after the last that answered.
  assert.equal(buildReading({ ...CELL, exit: 1, results: [part(1, 3), part(2, 3)] }).reason, 'part 3 of 3 gave no result (codex-review exited 1), so the range was not reviewed whole');
  // A part with no result is one too when the command exited 0: the reading does not hold the whole range.
  assert.equal(buildReading({ ...CELL, results: [part(1, 2)] }).outcome, 'failed');
  // Every part answered and the command still failed (the record could not be written): no review was recorded.
  for (const results of [[part(1, 2), part(2, 2)], [resultOf()]]) {
    const unrecorded = buildReading({ ...CELL, exit: 1, results });
    assert.deepEqual([unrecorded.outcome, unrecorded.reason], ['failed', 'codex-review exited 1 after its last session was reviewed, so no review of the range was recorded']);
    assert.equal(buildReading({ ...CELL, results }).outcome, 'reviewed', 'and with the exit code of a review that was recorded, it is one');
  }
  // An exit code nobody gave is not the 0 of a review that was recorded.
  const { exit: _exit, ...untold } = CELL;
  assert.equal(buildReading({ ...untold, results: [resultOf()] }).outcome, 'failed');
  // An attempt that fell short ended the run: its own outcome and reason stand, whatever the exit code.
  const fell = buildReading({ ...CELL, exit: 7, results: [part(1, 3), part(2, 3, { outcome: 'not-inspected', reason: 'its successful commands showed 1 of 3 changed lines' })] });
  assert.deepEqual([fell.outcome, fell.reason], ['not-inspected', 'its successful commands showed 1 of 3 changed lines']);
});

test('buildReading: nothing launched is no reading; a body is cut whole, never inside a pair of code units', () => {
  assert.equal(buildReading({ ...CELL, results: [] }), null);
  const long = `${'a'.repeat(FINDING_BODY_MAX - 2)}😀 and more`;
  const cut = buildReading({ ...CELL, results: [resultOf({}, { findings: [finding('a.txt', 1, long), finding('a.txt', 2, 'short')], verdict: 'incorrect', explanation: '', confidence: null })] });
  assert.equal(cut.findings[0].body, `${'a'.repeat(FINDING_BODY_MAX - 2)}…`);
  assert.equal(cut.findings[1].body, 'short');
  // A seeded reading is scored against the key it is given.
  const scored = buildReading({ ...CELL, range: { name: 'seeded', base: KEY.base, head: KEY.head }, key: KEY, results: [resultOf({}, { findings: [finding('src/cli.mjs', 100)], verdict: 'incorrect', explanation: '', confidence: null })] });
  assert.deepEqual(scored.score, { defects: 7, found: ['D4'], missed: ['D1', 'D2', 'D3', 'D5', 'D6', 'D7'], extra: 0, recall: 1 / 7 });
});

test('buildReading: the model is the one the session ran with when its run line measured one, and says where it was read: `session`, else `command`; the user\'s configuration is no source any more', () => {
  const one = (over, more = {}) => buildReading({ ...CELL, results: [resultOf(over)], ...more });
  const measured = { sessionModel: 'gpt-it-ran', sessionEffort: 'low' };
  // The command names a model, and the session's own file says which one ran.
  assert.deepEqual(modelOf(one(measured)), { model: 'gpt-it-ran', effort: 'low', modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'medium' });
  // A session that wrote down its model and no effort: the effort is not known, and is not the one asked for.
  assert.deepEqual(modelOf(one({ sessionModel: 'gpt-it-ran', sessionEffort: null })), { model: 'gpt-it-ran', effort: null, modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'medium' });
  // A run line of the removed `current` session as they were until 2026-10-08: the command named it no
  // model. No cell makes one any more, and what the user's configuration names is no longer handed over or
  // taken: what such a line was asked for is not known here, measured or not, whatever a caller passes.
  const current = { session: 'current', model: null, effort: null };
  for (const more of [{}, { configured: { model: 'gpt-user', effort: 'high' } }]) {
    assert.deepEqual(modelOf(one({ ...current, ...measured }, more)), { model: 'gpt-it-ran', effort: 'low', modelSource: 'session', configuredModel: null, configuredEffort: null }, JSON.stringify(more));
    const unmeasured = one(current, more);
    assert.deepEqual([unmeasured.model, unmeasured.effort, unmeasured.modelSource], [null, null, null], JSON.stringify(more));
    assert.equal('configuredModel' in unmeasured || 'configuredEffort' in unmeasured, false, JSON.stringify(more));
  }
  // Not measured, a reading is what it always was: the model asked for, said to be that, and no field more.
  // A run line written before the session's model was read, and one whose home named none, are both that.
  for (const unmeasured of [{}, { sessionModel: null, sessionEffort: null }, { sessionModel: null, sessionEffort: 'low' }, { sessionModel: 7 }]) {
    const lean = one(unmeasured);
    assert.deepEqual([lean.model, lean.effort, lean.modelSource], ['gpt-6.1-sol', 'medium', 'command'], JSON.stringify(unmeasured));
    assert.equal('configuredModel' in lean || 'configuredEffort' in lean, false, JSON.stringify(unmeasured));
  }
  // A range in parts is several sessions: the model is that of the last attempt, as its outcome is.
  const part = (index, over) => resultOf({ part: { index, of: 2, files: 1, changedLines: 3 }, ...over });
  const parts = buildReading({ ...CELL, results: [part(1, { sessionModel: 'gpt-part-one', sessionEffort: 'high' }), part(2, measured)] });
  assert.deepEqual(modelOf(parts), { model: 'gpt-it-ran', effort: 'low', modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'medium' });
  const stopped = buildReading({ ...CELL, results: [part(1, measured), part(2, { outcome: 'timed-out' })] });
  assert.deepEqual([stopped.model, stopped.effort, stopped.modelSource], ['gpt-6.1-sol', 'medium', 'command'], 'a last attempt that measured none is not given the model of another');
});

test('readReading: a file that is not there, is not JSON, or is another cell\'s is not a reading', () => {
  const m = machine();
  assert.deepEqual(readReading(m.readings, 'lean', 'real'), { ok: false, missing: true, why: 'no reading' });
  const file = readingFile(m.readings, 'lean', 'real');
  fs.writeFileSync(file, '{', 'utf8');
  assert.deepEqual([readReading(m.readings, 'lean', 'real').ok, readReading(m.readings, 'lean', 'real').missing], [false, false]);
  fs.writeFileSync(file, JSON.stringify({ schema: READING_SCHEMA, config: 'lean-high', range: { name: 'real' }, outcome: 'reviewed' }), 'utf8');
  assert.match(readReading(m.readings, 'lean', 'real').why, /lean-high/);
  fs.writeFileSync(file, JSON.stringify({ schema: 'something/v9', config: 'lean', range: { name: 'real' }, outcome: 'reviewed' }), 'utf8');
  assert.match(readReading(m.readings, 'lean', 'real').why, /schema/);
  fs.writeFileSync(file, JSON.stringify({ schema: READING_SCHEMA, config: 'lean', range: { name: 'real' }, outcome: 'reviewed' }), 'utf8');
  assert.equal(readReading(m.readings, 'lean', 'real').reading.outcome, 'reviewed');
});
