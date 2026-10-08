import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { codexArgs } from '../../bin/codex-review.mjs';
import { createLeanHome as makeLeanHome, leanHomesDir } from '../../bin/lib/codex-review-home.mjs';
import { REVIEW_PROMPT_VERSION } from '../../bin/lib/codex-review-prompt.mjs';
import { windowsCommandLine } from '../../bin/lib/windows-args.mjs';
import {
  buildReading, CELLS, CHECKOUT_NAME, codegraphSettings, compareMain, CONFIGS, configuredModel, EXCLUDED, FINDING_BODY_MAX, RANGES, READING_SCHEMA,
  readingFile, readReading, TEMPLATE_NAME,
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

/** The environment the comparison is given: the host's, without a Codex home or a state dir of the user's. */
const hostEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(codex_home|js_harness_home|engram_.*)$/i.test(name)));

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

/** A repository of two commits that stands in for this one, and the `real` range over it: `base` is the
 * first commit and `head` the second. `extra` are more files of the first commit. */
function fakeRepository(m, extra = {}) {
  const root = path.join(m.root, 'repository');
  fs.mkdirSync(path.join(root, 'odd', 'tasks'), { recursive: true });
  git(root, 'init', '--quiet');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  git(root, 'config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(root, 'odd', 'tasks', 'feature.md'), FEATURE_DOC, 'utf8');
  fs.writeFileSync(path.join(root, 'f.txt'), 'one\n', 'utf8');
  for (const [name, content] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content, 'utf8');
  }
  git(root, 'add', '--all', '--force', '.');
  git(root, 'commit', '--quiet', '-m', 'one');
  const base = git(root, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'f.txt'), 'two\n', 'utf8');
  git(root, 'commit', '--quiet', '-am', 'two');
  const head = git(root, 'rev-parse', 'HEAD');
  const real = { ...RANGES.find((range) => range.name === 'real'), base, head, doc: 'odd/tasks/feature.md' };
  return { root, base, head, ranges: [real, ...RANGES.filter((range) => range.name !== 'real')] };
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
 * (`gentle-ai`) recorded in `tools` and answered with the exit code `init`. `spawnAsync` is the review: it
 * shows the diff of the checkout's last commit (unless `shows` is false), leaves the rollout file of a review
 * with `findings` in its home when it has one and is not ephemeral (`said` is the text of its answer, in
 * place of one built from the findings; `ran`, the model and the effort that file says the session ran
 * with), and ends with `status`. `calls` holds each launch with what `during(opts)` saw, and `order` what
 * happened in which order. */
function fakeCodex({ findings = [], status = 0, shows = true, said, ran = null, probe = { status: 0, stdout: 'codex-cli 0.160.1\n' }, init = 0, during = () => ({}) } = {}) {
  const calls = [];
  const tools = [];
  const ports = [];
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
    if (!`${command} ${args.join(' ')}`.includes('--ephemeral') && typeof home === 'string' && fs.existsSync(home)) {
      const dir = path.join(home, 'sessions', '2026', '10', '07');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'rollout-2026-10-07T05-34-59-review.jsonl'), rollout(opts.cwd, findings, said, ran), 'utf8');
    }
    const child = fakeChild({ stdout: events(patch), status, piped: opts.stdio?.[0] === 'pipe' });
    calls.push({ command, args, opts, child, seen });
    return child;
  };
  return { spawn, spawnAsync, calls, tools, ports, order };
}

/** A fake that fails the test when anything at all is started. */
function nothingStarts() {
  const never = (command) => {
    throw new Error(`nothing may be started, and ${command} was`);
  };
  return { spawn: never, spawnAsync: never, calls: [], tools: [], ports: [], order: [] };
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
    env: hostEnv(),
    homedir: () => m.oshome,
    repoRoot: m.repository?.root ?? path.join(m.root, 'no-repository'),
    ranges: m.repository?.ranges ?? RANGES,
    readingsDir: m.readings,
    checkoutParent: m.parent,
    tmpdir: m.tmp,
    now: () => new Date('2026-10-07T12:00:00.000Z'),
    spawn: fake.spawn,
    review: { spawnAsync: fake.spawnAsync, killTree: () => {}, randomUUID: () => RUN_ID, monotonicNow: ticking(1000, 61000), write: () => {} },
    allocatePort: async () => 45678,
    releasePort: (port) => fake.ports.push(['release', port]),
    killPort: (port) => fake.ports.push(['kill', port]),
    ...extra,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

/** How Codex is launched with `argv` on this host: through a shell as one line on Windows, else as it is. */
const launchedWith = (argv) => (PLATFORM === 'win32' ? { command: windowsCommandLine('codex', argv), args: [] } : { command: 'codex', args: argv });
const launched = ({ command, args }) => ({ command, args });

const reading = (m, config, range) => JSON.parse(fs.readFileSync(readingFile(m.readings, config, range), 'utf8'));
const entries = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);
const fileId = (file) => {
  const { dev, ino } = fs.statSync(file, { bigint: true });
  return `${dev}:${ino}`;
};

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
    ['current:seeded', codexArgs(KEY.base, 'current', PLATFORM, 'codex', { ephemeral: false })],
    ['lean:seeded', codexArgs(KEY.base, 'lean', PLATFORM)],
    ['lean-own:seeded', codexArgs(KEY.base, 'lean', PLATFORM, 'own')],
    ['lean-high:seeded', codexArgs(KEY.base, 'lean', PLATFORM, 'codex', { effort: 'high' })],
    ['lean-codegraph:real', codexArgs(RANGES[0].base, 'lean', PLATFORM, 'codex', { extraConfig: CODEGRAPH })],
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
    // Every cell names its session: none rests on which one `codex-review` runs when it is given none, so
    // a cell measures the same configuration whatever that default is.
    const command = result.out.split('\n').find((line) => line.startsWith('Command: '));
    assert.ok(command.includes(` --session ${config === 'current' ? 'current' : 'lean'} `), command);
    assert.equal(command.match(/--session/g).length, 1, command);
  }
  // Each configuration differs from `lean` where it says it does, and nowhere else.
  assert.equal(cases[0][1].includes('--ephemeral'), false);
  assert.equal(cases[2][1].at(-1), '-');
  assert.ok(cases[3][1].includes('model_reasoning_effort="high"'));
  assert.deepEqual(cases[4][1].filter((token) => token.startsWith('mcp_servers.')), CODEGRAPH);
  const real = await run(['--cell', 'lean:real', '--dry-run'], m);
  assert.ok(real.out.includes(path.join(m.parent, CHECKOUT_NAME)), real.out);
  assert.match(real.out, /git clone/);
  const index = await run(['--cell', 'lean-codegraph:real', '--dry-run'], m, nothingStarts(), { configToml: m.configToml });
  assert.match(index.out, /gentle-ai codegraph init --cwd /);
  const copy = await run(['--cell', 'current:real', '--dry-run'], m);
  assert.ok(copy.out.includes(path.join(m.parent, TEMPLATE_NAME)), copy.out);
  assert.ok(copy.out.includes(m.homes), copy.out);
  assert.match(copy.out, /hard link/);
  assert.deepEqual([entries(m.readings), entries(m.parent), entries(m.tmp)], [[], [], []], 'nothing was made');
  assert.equal(fs.existsSync(m.homes), false);
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
  assert.deepEqual(launched(fake.calls[0]), launchedWith(codexArgs(KEY.base, 'lean', PLATFORM)));
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
    model: 'gpt-6.1-sol',
    effort: 'medium',
    modelSource: 'command',
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
    'schema', 'config', 'range', 'recordedAt', 'cli', 'session', 'model', 'effort', 'modelSource', 'prompt', 'promptVersion', 'outcome', 'reason',
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
  // The lean command passes `gpt-6.1-sol` at medium effort, and the session's file says it ran with another.
  const result = await run(['--cell', 'lean:seeded'], m, fakeCodex({ findings: FOUND, ran: { model: 'gpt-it-ran', effort: 'low' } }));
  assert.equal(result.code, 0, result.err);
  const stored = reading(m, 'lean', 'seeded');
  assert.deepEqual(modelOf(stored), { model: 'gpt-it-ran', effort: 'low', modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'medium' });
  assert.deepEqual(Object.keys(stored).slice(6, 12), ['model', 'effort', 'modelSource', 'configuredModel', 'configuredEffort', 'prompt'], 'what was asked for comes right after what ran');
  // A session that ran what it was asked to says so as well: the two are there to be seen equal.
  const same = await run(['--cell', 'lean-high:seeded'], m, fakeCodex({ findings: FOUND, ran: { model: 'gpt-6.1-sol', effort: 'high' } }));
  assert.equal(same.code, 0, same.err);
  assert.deepEqual(modelOf(reading(m, 'lean-high', 'seeded')), { model: 'gpt-6.1-sol', effort: 'high', modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'high' });
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
  assert.deepEqual(launched(own.calls[0]), launchedWith(codexArgs(KEY.base, 'lean', PLATFORM, 'own')));
  const goal = fs.readFileSync(new URL('./seeded/head/odd/tasks/stocktake.md', import.meta.url), 'utf8').split('## Goal')[1].split('\n').find((line) => line.trim() !== '').trim();
  assert.ok(own.calls[0].child.received.includes(goal.slice(0, 40)), 'the Goal of the seeded feature document is in the prompt');
  assert.ok(own.calls[0].child.received.includes(KEY.base) && own.calls[0].child.received.includes(KEY.head));
  const asked = reading(m, 'lean-own', 'seeded');
  assert.deepEqual([asked.session, asked.prompt, asked.promptVersion, asked.effort, asked.verdict], ['lean', 'own', REVIEW_PROMPT_VERSION, 'medium', 'correct']);
  assert.deepEqual(asked.score, { defects: 7, found: [], missed: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'], extra: 0, recall: 0 });

  const high = fakeCodex();
  assert.equal((await run(['--cell', 'lean-high:seeded'], m, high)).code, 0);
  assert.deepEqual(launched(high.calls[0]), launchedWith(codexArgs(KEY.base, 'lean', PLATFORM, 'codex', { effort: 'high' })));
  assert.deepEqual([reading(m, 'lean-high', 'seeded').effort, reading(m, 'lean-high', 'seeded').prompt], ['high', 'codex']);
  assert.deepEqual(entries(m.readings), ['lean-high__seeded.json', 'lean-own__seeded.json']);
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
  assert.deepEqual(launched(fake.calls[0]), launchedWith(codexArgs(base, 'lean', PLATFORM)));
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

/** How `gentle-ai codegraph init` is started for `checkout` on this host. */
const initWith = (checkout) => {
  const args = ['codegraph', 'init', '--cwd', checkout];
  return PLATFORM === 'win32' ? { command: windowsCommandLine('gentle-ai', args), args: [] } : { command: 'gentle-ai', args };
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
  assert.deepEqual(launched(fake.calls[0]), launchedWith(codexArgs(m.repository.base, 'lean', PLATFORM, 'codex', { extraConfig: CODEGRAPH })));
  assert.deepEqual([reading(m, 'lean-codegraph', 'real').session, reading(m, 'lean-codegraph', 'real').effort], ['lean', 'medium']);
  // No other cell builds an index or names the server.
  const plain = fakeCodex();
  assert.equal((await run(['--cell', 'lean:real'], m, plain, { configToml: m.configToml })).code, 0);
  assert.deepEqual(plain.tools, []);
  assert.deepEqual(launched(plain.calls[0]), launchedWith(codexArgs(m.repository.base, 'lean', PLATFORM)));
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
  assert.match(result.err, /gentle-ai codegraph init.*exited 3/);
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

// --- the current configuration, measured ---

test('current is measured in a copy of the user\'s Codex home: his configuration without the desktop pieces, the login as a hard link, and not ephemeral', async () => {
  const m = machine();
  const realBefore = { entries: entries(m.codexHome), config: fs.readFileSync(m.configToml, 'utf8'), id: fileId(m.auth) };
  const fake = fakeCodex({
    findings: FOUND.slice(0, 1),
    during: (opts) => {
      const home = opts.env.CODEX_HOME;
      return {
        home,
        entries: entries(home),
        skill: fs.existsSync(path.join(home, 'skills', 'ship', 'SKILL.md')),
        config: fs.readFileSync(path.join(home, 'config.toml'), 'utf8'),
        login: { id: fileId(path.join(home, 'auth.json')), links: fs.statSync(m.auth).nlink },
        template: fs.existsSync(path.join(m.parent, TEMPLATE_NAME)),
        engram: [opts.env.ENGRAM_PORT, opts.env.ENGRAM_DATA_DIR],
      };
    },
  });
  const result = await run(['--cell', 'current:seeded'], m, fake, { configToml: m.configToml });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(launched(fake.calls[0]), launchedWith(codexArgs(KEY.base, 'current', PLATFORM, 'codex', { ephemeral: false })));
  const { seen } = fake.calls[0];
  const folder = path.join(m.homes, RUN_ID);
  assert.equal(seen.home, path.join(folder, '.codex'));
  assert.deepEqual(seen.entries, ['AGENTS.md', 'auth.json', 'config.toml', 'skills']);
  assert.equal(seen.skill, true);
  assert.deepEqual(seen.login, { id: realBefore.id, links: 2 }, 'the same file as the real login, never a copy');
  assert.equal(seen.template, true);
  // His configuration, but for what reaches the desktop app, and with an engram of the run's own.
  assert.match(seen.config, /^model = "gpt-user"$/m);
  assert.match(seen.config, /^\[mcp_servers\.codegraph\]$/m);
  assert.doesNotMatch(seen.config, /notify|computer-use/);
  assert.match(seen.config, /^ENGRAM_PORT = "45678"$/m);
  assert.deepEqual(seen.engram, ['45678', path.join(folder, '.engram')]);
  // The reading: the current session, with what it really spent, and the model his configuration names.
  const stored = reading(m, 'current', 'seeded');
  assert.deepEqual([stored.session, stored.model, stored.effort, stored.modelSource, stored.prompt, stored.outcome], ['current', 'gpt-user', 'high', 'config.toml', 'codex', 'reviewed']);
  assert.deepEqual([stored.usage, stored.requests, stored.firstRequestInputTokens], [SPENT, 2, 18200]);
  assert.deepEqual(stored.score.found, ['D1']);
  // Nothing is left, and the real home is as it was: its entries, its configuration, its login under one name.
  assert.deepEqual(fake.ports, [['kill', 45678], ['release', 45678]], 'the engram of the run is stopped, then its port given back');
  assert.deepEqual(entries(m.homes), []);
  assert.deepEqual(entries(m.parent), [], 'the template of the home is removed with the cell');
  assert.deepEqual(entries(m.tmp), []);
  assert.deepEqual({ entries: entries(m.codexHome), config: fs.readFileSync(m.configToml, 'utf8'), id: fileId(m.auth) }, realBefore);
  assert.equal(fs.statSync(m.auth).nlink, 1);
  assert.equal(fs.readFileSync(m.auth, 'utf8'), LOGIN);
});

test('current names the model its session ran with, not the one the user\'s configuration names, which is kept beside it', async () => {
  const m = machine();
  // His `config.toml` names `gpt-user` at high effort; the review's sub-agent wrote down another.
  const result = await run(['--cell', 'current:seeded'], m, fakeCodex({ findings: FOUND.slice(0, 1), ran: { model: 'gpt-the-review-ran', effort: 'low' } }), { configToml: m.configToml });
  assert.equal(result.code, 0, result.err);
  const stored = reading(m, 'current', 'seeded');
  assert.deepEqual(modelOf(stored), { model: 'gpt-the-review-ran', effort: 'low', modelSource: 'session', configuredModel: 'gpt-user', configuredEffort: 'high' });
  assert.equal(stored.session, 'current');
});

test('current gives its port back and removes its template also when the review never starts', async () => {
  const m = machine();
  const fake = fakeCodex({ probe: { status: 1, stdout: '' } });
  const result = await run(['--cell', 'current:seeded'], m, fake, { configToml: m.configToml });
  assert.equal(result.code, 1);
  assert.equal(fake.calls.length, 0);
  assert.deepEqual(fake.ports.at(-1), ['release', 45678]);
  assert.deepEqual([entries(m.parent), entries(m.tmp), entries(m.homes), entries(m.readings)], [[], [], [], []]);
  assert.equal(fs.statSync(m.auth).nlink, 1);
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

test('configuredModel: the model and the effort the top of a configuration names, and nothing from inside a table', () => {
  assert.deepEqual(configuredModel(CONFIG_TOML), { model: 'gpt-user', effort: 'high' });
  assert.deepEqual(configuredModel('model = \'gpt-literal\' # mine\n'), { model: 'gpt-literal', effort: null });
  assert.deepEqual(configuredModel('[profiles.fast]\nmodel = "gpt-fast"\nmodel_reasoning_effort = "low"\n'), { model: null, effort: null });
  assert.deepEqual(configuredModel('model = 7\n'), { model: null, effort: null });
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
  // A seeded reading is scored against the key it is given; one of the current session says where its model was read.
  const scored = buildReading({ ...CELL, range: { name: 'seeded', base: KEY.base, head: KEY.head }, key: KEY, results: [resultOf({}, { findings: [finding('src/cli.mjs', 100)], verdict: 'incorrect', explanation: '', confidence: null })] });
  assert.deepEqual(scored.score, { defects: 7, found: ['D4'], missed: ['D1', 'D2', 'D3', 'D5', 'D6', 'D7'], extra: 0, recall: 1 / 7 });
  const current = buildReading({ ...CELL, results: [resultOf({ session: 'current', model: null, effort: null })], configured: { model: 'gpt-user', effort: null } });
  assert.deepEqual([current.model, current.effort, current.modelSource], ['gpt-user', null, 'config.toml']);
  const unknown = buildReading({ ...CELL, results: [resultOf({ session: 'current', model: null, effort: null })] });
  assert.deepEqual([unknown.model, unknown.effort, unknown.modelSource], [null, null, null]);
});

test('buildReading: the model is the one the session ran with when its run line measured one, and says where it was read: `session`, else `command`, else `config.toml`', () => {
  const one = (over, configured) => buildReading({ ...CELL, results: [resultOf(over)], ...(configured === undefined ? {} : { configured }) });
  const measured = { sessionModel: 'gpt-it-ran', sessionEffort: 'low' };
  // The lean session: the command names a model, and the session's own file says which one ran.
  assert.deepEqual(modelOf(one(measured)), { model: 'gpt-it-ran', effort: 'low', modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'medium' });
  // The current session: the command names none, so what was asked for is the user's configuration's.
  const current = { session: 'current', model: null, effort: null };
  assert.deepEqual(modelOf(one({ ...current, ...measured }, { model: 'gpt-user', effort: 'high' })), { model: 'gpt-it-ran', effort: 'low', modelSource: 'session', configuredModel: 'gpt-user', configuredEffort: 'high' });
  // Measured with no configuration to read: what ran is known, and what was asked for is not.
  assert.deepEqual(modelOf(one({ ...current, ...measured })), { model: 'gpt-it-ran', effort: 'low', modelSource: 'session', configuredModel: null, configuredEffort: null });
  // A session that wrote down its model and no effort: the effort is not known, and is not the one asked for.
  assert.deepEqual(modelOf(one({ sessionModel: 'gpt-it-ran', sessionEffort: null })), { model: 'gpt-it-ran', effort: null, modelSource: 'session', configuredModel: 'gpt-6.1-sol', configuredEffort: 'medium' });
  // Not measured, a reading is what it always was: the model asked for, said to be that, and no field more.
  // A run line written before the session's model was read, and one whose home named none, are both that.
  for (const unmeasured of [{}, { sessionModel: null, sessionEffort: null }, { sessionModel: null, sessionEffort: 'low' }, { sessionModel: 7 }]) {
    const lean = one(unmeasured);
    assert.deepEqual([lean.model, lean.effort, lean.modelSource], ['gpt-6.1-sol', 'medium', 'command'], JSON.stringify(unmeasured));
    const user = one({ ...current, ...unmeasured }, { model: 'gpt-user', effort: 'high' });
    assert.deepEqual([user.model, user.effort, user.modelSource], ['gpt-user', 'high', 'config.toml'], JSON.stringify(unmeasured));
    const nobody = one({ ...current, ...unmeasured });
    assert.deepEqual([nobody.model, nobody.effort, nobody.modelSource], [null, null, null], JSON.stringify(unmeasured));
    for (const reading of [lean, user, nobody]) assert.equal('configuredModel' in reading || 'configuredEffort' in reading, false, JSON.stringify(unmeasured));
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
