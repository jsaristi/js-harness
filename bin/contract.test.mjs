import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contractMain, discoverContracts, validateEntries } from './contract.mjs';
import { CONTRACT_TEMPLATE } from './lib/contract.mjs';

const GOOD = [
  '# A feature',
  '',
  '## Goal',
  'Ship the thing.',
  '',
  '## Why',
  'Because the loop needs evidence.',
  '',
  '## Done when',
  '- `npm run check` exits 0',
  '',
  '## In scope / Out of scope',
  '- In: bin/',
  '',
  '## Constraints',
  '- Zero dependencies — because it must run anywhere',
  '',
  '## Effort',
  'high',
  '',
  '## Ask me before',
  'Changing the template.',
  '',
].join('\n');

/** A contract whose `## Done when` is prose only, so `validateContract` rejects it. */
const BAD = GOOD.replace('- `npm run check` exits 0', '- It works');

const NOT_A_CONTRACT = '# Old feature\n\n## Tasks\n- [x] T1\n';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-contract-'));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Runs `contractMain`, capturing what it printed through the injected writers. */
async function run(argv, { env = {}, ...deps } = {}) {
  const out = [];
  const err = [];
  const code = await contractMain(argv, env, { stdout: (line) => out.push(line), stderr: (line) => err.push(line), ...deps });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

test('template prints the template and exits 0', async () => {
  const { code, stdout } = await run(['template']);
  assert.equal(code, 0);
  assert.equal(`${stdout}\n`, CONTRACT_TEMPLATE);
});

test('no subcommand, an unknown one, an unknown flag and a missing value are usage errors (exit 2)', async () => {
  for (const argv of [[], ['frobnicate'], ['template', 'extra'], ['check', '--nope'], ['check', '--cwd'], ['check', '--cwd', '--x']]) {
    const { code, stdout, stderr } = await run(argv);
    assert.equal(code, 2, argv.join(' '));
    assert.equal(stdout, '', argv.join(' '));
    assert.match(stderr, /Usage: js-harness contract/, argv.join(' '));
  }
});

test('check with no contracts under odd/tasks says so and exits 0', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'odd', 'tasks', 'old.md'), NOT_A_CONTRACT);
    const { code, stdout } = await run(['check', '--cwd', dir]);
    assert.equal(code, 0);
    assert.match(stdout, /no contracts under odd\/tasks/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('check with no files validates every contract under odd/tasks, skips other docs, and exits 1 on a failure', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'odd', 'tasks', 'good.md'), GOOD);
    writeFile(path.join(dir, 'odd', 'tasks', 'bad.md'), BAD);
    writeFile(path.join(dir, 'odd', 'tasks', 'old.md'), NOT_A_CONTRACT);
    const { code, stdout } = await run(['check', '--cwd', dir]);
    assert.equal(code, 1);
    assert.match(stdout, /^PASS {2}odd\/tasks\/good\.md$/m);
    assert.match(stdout, /^FAIL {2}odd\/tasks\/bad\.md$/m);
    assert.match(stdout, /^ +.*"## Done when" has no command/m);
    assert.doesNotMatch(stdout, /old\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('check with no files and only good contracts exits 0', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'odd', 'tasks', 'good.md'), GOOD);
    const { code, stdout } = await run(['check', '--cwd', dir]);
    assert.equal(code, 0);
    assert.match(stdout, /^PASS {2}odd\/tasks\/good\.md$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('check with files resolves them from --cwd; a file that is not a contract, or is unreadable, fails with a reason', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'a.md'), GOOD);
    writeFile(path.join(dir, 'b.md'), NOT_A_CONTRACT);
    const { code, stdout } = await run(['check', 'a.md', 'b.md', 'missing.md', '--cwd', dir]);
    assert.equal(code, 1);
    assert.match(stdout, /^PASS {2}a\.md$/m);
    assert.match(stdout, /^FAIL {2}b\.md$/m);
    assert.match(stdout, /not a contract: no "## Goal" heading/);
    assert.match(stdout, /^FAIL {2}missing\.md$/m);
    assert.match(stdout, /cannot read/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const hasGit = spawnSync('git', ['--version']).status === 0;

test('check with no files run from a subdirectory of a repository reads the repository root', { skip: !hasGit && 'git is not on PATH' }, async () => {
  const dir = makeTmpDir();
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    writeFile(path.join(dir, 'odd', 'tasks', 'good.md'), GOOD);
    fs.mkdirSync(path.join(dir, 'bin'));
    const { code, stdout } = await run(['check', '--cwd', path.join(dir, 'bin')]);
    assert.equal(code, 0);
    assert.match(stdout, /^PASS {2}odd\/tasks\/good\.md$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- discovery: injected fs, and every error path ---

const fsError = (code) => Object.assign(new Error(code), { code });
const isFile = () => ({ isFile: () => true });

test('discoverContracts uses only the injected fs, stat included, and keeps contracts only', () => {
  const files = { 'good.md': GOOD, 'old.md': NOT_A_CONTRACT, 'notes.txt': GOOD };
  const found = discoverContracts('/nowhere', {
    readdir: () => Object.keys(files),
    stat: isFile,
    readFile: (p) => files[path.basename(p)],
  });
  assert.deepEqual(found, [{ label: 'odd/tasks/good.md', markdown: GOOD }]);
});

test('a missing odd/tasks is no contracts; any other readdir error is reported, not swallowed', () => {
  assert.deepEqual(discoverContracts('/x', { readdir: () => { throw fsError('ENOENT'); } }), []);
  assert.deepEqual(discoverContracts('/x', { readdir: () => { throw fsError('EACCES'); } }), [{ label: 'odd/tasks', error: 'EACCES' }]);
});

test('a directory named x.md is skipped silently', () => {
  const found = discoverContracts('/x', {
    readdir: () => ['x.md', 'good.md'],
    stat: (p) => ({ isFile: () => path.basename(p) !== 'x.md' }),
    readFile: () => GOOD,
  });
  assert.deepEqual(found.map((entry) => entry.label), ['odd/tasks/good.md']);
  const dir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(dir, 'odd', 'tasks', 'x.md'), { recursive: true });
    assert.deepEqual(discoverContracts(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A gate must not hide a file it cannot read: it is not known to be a non-contract, so it fails.
test('a file that cannot be stat-ed or read is a failing entry, and the others are still checked', () => {
  const found = discoverContracts('/x', {
    readdir: () => ['a-stat.md', 'b-read.md', 'c-good.md'],
    stat: (p) => {
      if (path.basename(p) === 'a-stat.md') throw fsError('EIO');
      return { isFile: () => true };
    },
    readFile: (p) => {
      if (path.basename(p) === 'b-read.md') throw fsError('EACCES');
      return GOOD;
    },
  });
  assert.deepEqual(found.map((entry) => [entry.label, entry.error ?? 'ok']), [
    ['odd/tasks/a-stat.md', 'EIO'],
    ['odd/tasks/b-read.md', 'EACCES'],
    ['odd/tasks/c-good.md', 'ok'],
  ]);
  const results = validateEntries(found);
  assert.deepEqual(results.map((r) => r.ok), [false, false, true]);
  assert.deepEqual(results[1].errors, ['cannot read: EACCES']);
});

// --- run: the done-when commands, with a fake spawn ---

/** `GOOD` with its `## Done when` body replaced. */
const contractWith = (doneWhenBody) => GOOD.replace('- `npm run check` exits 0', doneWhenBody);

/** Runs `contract run c.md` on `md` with a fake spawn that answers from `results` (default: exit 0)
 * and records each done-when command. The `git rev-parse` that finds the repository root is answered
 * "not a repository", so the root is the temp directory itself. */
async function runWithFake(md, results, { args = [], ...extra } = {}) {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'c.md'), md);
    const calls = [];
    const spawn = (command, second) => {
      if (Array.isArray(second)) return { status: 1, stdout: '', stderr: '' };
      calls.push({ command, opts: second });
      return results[command] ?? { status: 0, stdout: '', stderr: '' };
    };
    const outcome = await run(['run', 'c.md', '--cwd', dir, ...args], { spawn, ...extra });
    return { ...outcome, calls, dir };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('run executes every command in order from the root, then lists the hand checks and prints met', async () => {
  const md = contractWith('- `first` exits 0\n- `second` exits 0\n- The output names the file');
  const { code, stdout, calls, dir } = await runWithFake(md, { first: { status: 0, stdout: 'hello\n', stderr: '' } });
  assert.equal(code, 0);
  assert.deepEqual(calls.map((c) => c.command), ['first', 'second']);
  assert.equal(calls[0].opts.shell, true);
  assert.equal(path.resolve(calls[0].opts.cwd), path.resolve(dir));
  assert.equal(calls[0].opts.env.JS_HARNESS_CONTRACT_RUN, '1');
  const lines = stdout.split('\n');
  assert.equal(lines[0], 'PASS  first');
  assert.match(stdout, /hello/);
  assert.ok(lines.includes('PASS  second'));
  assert.ok(lines.indexOf('check by hand:') > lines.indexOf('PASS  second'));
  assert.match(stdout, /- The output names the file/);
  assert.equal(lines.at(-1), 'met');
});

test('run keeps going after a failure, shows its output, and exits 1 with not met', async () => {
  const md = contractWith('- `first` exits 0\n- `second` exits 0');
  const { code, stdout, calls } = await runWithFake(md, { first: { status: 3, stdout: '', stderr: 'boom\n' } });
  assert.equal(code, 1);
  assert.deepEqual(calls.map((c) => c.command), ['first', 'second']);
  assert.match(stdout, /^FAIL {2}first {2}\(exit 3\)$/m);
  assert.match(stdout, /boom/);
  assert.match(stdout, /^PASS {2}second$/m);
  assert.equal(stdout.split('\n').at(-1), 'not met');
  assert.doesNotMatch(stdout, /check by hand/);
});

test('run reports a command that could not start or was killed, and fails', async () => {
  const md = contractWith('- `a` exits 0\n- `b` exits 0');
  const { code, stdout } = await runWithFake(md, {
    a: { status: null, signal: 'SIGTERM', stdout: '', stderr: '' },
    b: { status: null, error: Object.assign(new Error('spawn'), { code: 'ENOENT' }), stdout: '', stderr: '' },
  });
  assert.equal(code, 1);
  assert.match(stdout, /^FAIL {2}a {2}\(signal SIGTERM\)$/m);
  assert.match(stdout, /^FAIL {2}b {2}\(error ENOENT\)$/m);
});

test('run refuses an invalid contract with its reasons and runs nothing', async () => {
  const { code, stdout, calls } = await runWithFake(contractWith('- It works'), {});
  assert.equal(code, 1);
  assert.deepEqual(calls, []);
  assert.match(stdout, /no command/);
  assert.equal(stdout.split('\n').at(-1), 'not met');
});

test('run refuses to start inside another run, so a done-when cannot be contract run itself', async () => {
  const { code, stdout, stderr, calls } = await runWithFake(GOOD, {}, { env: { JS_HARNESS_CONTRACT_RUN: '1' } });
  assert.equal(code, 2);
  assert.deepEqual(calls, []);
  assert.equal(stdout, '');
  assert.match(stderr, /inside another/);
});

test('run and goal need exactly one file (usage error, exit 2)', async () => {
  for (const argv of [['run'], ['run', 'a.md', 'b.md'], ['goal'], ['goal', 'a.md', 'b.md'], ['run', 'a.md', '--nope']]) {
    const { code, stderr } = await run(argv);
    assert.equal(code, 2, argv.join(' '));
    assert.match(stderr, /Usage: js-harness contract/, argv.join(' '));
  }
});

test('run really runs shell commands: a passing and a failing node -e give exit 1 and both rows', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(
      path.join(dir, 'c.md'),
      contractWith('- `node -e "console.log(\'from-child\')"` exits 0\n- `node -e "process.exit(3)"` exits 0'),
    );
    const { code, stdout } = await run(['run', 'c.md', '--cwd', dir]);
    assert.equal(code, 1);
    assert.match(stdout, /^PASS {2}node -e .*from-child/m);
    assert.match(stdout, /^ +from-child$/m);
    assert.match(stdout, /^FAIL {2}node -e "process\.exit\(3\)" {2}\(exit 3\)$/m);
    assert.equal(stdout.split('\n').at(-1), 'not met');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('run from a subdirectory runs the commands from the repository root', { skip: !hasGit && 'git is not on PATH' }, async () => {
  const dir = makeTmpDir();
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    fs.mkdirSync(path.join(dir, 'sub'));
    const command = 'node -e "console.log(require(\'path\').basename(process.cwd()))"';
    writeFile(path.join(dir, 'c.md'), contractWith(`- \`${command}\` exits 0`));
    const { code, stdout } = await run(['run', '../c.md', '--cwd', path.join(dir, 'sub')]);
    assert.equal(code, 0);
    assert.ok(stdout.split('\n').some((line) => line.trim() === path.basename(dir)), stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- run: a timeout for every command ---

test('run gives each command a 30 minute timeout by default, and --timeout <minutes> changes it', async () => {
  const md = contractWith('- `first` exits 0');
  assert.equal((await runWithFake(md, {})).calls[0].opts.timeout, 30 * 60 * 1000);
  assert.equal((await runWithFake(md, {}, { args: ['--timeout', '2'] })).calls[0].opts.timeout, 2 * 60 * 1000);
});

test('a command that times out is a FAIL row saying so, the next command still runs, and the run is not met', async () => {
  const md = contractWith('- `first` exits 0\n- `second` exits 0');
  const timedOut = { status: null, signal: 'SIGTERM', error: Object.assign(new Error('spawnSync ETIMEDOUT'), { code: 'ETIMEDOUT' }), stdout: 'partial\n', stderr: '' };
  const { code, stdout, calls } = await runWithFake(md, { first: timedOut }, { args: ['--timeout', '2'] });
  assert.equal(code, 1);
  assert.deepEqual(calls.map((c) => c.command), ['first', 'second']);
  assert.match(stdout, /^FAIL {2}first {2}\(timed out after 2 min\)$/m);
  assert.match(stdout, /partial/);
  assert.equal(stdout.split('\n').at(-1), 'not met');
  assert.match((await runWithFake(md, { first: timedOut })).stdout, /\(timed out after 30 min\)/);
});

test('--timeout needs a plain decimal number of minutes, and only run takes it (usage error, exit 2)', async () => {
  const bad = ['0', 'soon', '-3', '0x10', '1e2', 'Infinity', '1_0', '', '0.000001', '99999999'];
  const argvs = [['run', 'c.md', '--timeout'], ['goal', 'c.md', '--timeout', '5'], ['check', '--timeout', '5']];
  for (const value of bad) argvs.push(['run', 'c.md', '--timeout', value]);
  for (const argv of argvs) {
    const { code, stderr } = await run(argv);
    assert.equal(code, 2, argv.join(' '));
    assert.match(stderr, /Usage: js-harness contract/, argv.join(' '));
  }
});

test('the timeout handed to spawn is a whole number of milliseconds', async () => {
  const md = contractWith('- `first` exits 0');
  for (const [minutes, ms] of [['0.03', 1800], ['1.5', 90000], ['.5', 30000], ['0.00002', 1], ['0.100001', 6000]]) {
    const { calls, code } = await runWithFake(md, {}, { args: ['--timeout', minutes] });
    assert.equal(code, 0, minutes);
    assert.equal(calls[0].opts.timeout, ms, minutes);
    assert.ok(Number.isInteger(calls[0].opts.timeout), minutes);
  }
});

test('run takes its root from the git top-level of --cwd, whatever the caller\'s own directory is', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'c.md'), contractWith('- `first` exits 0'));
    fs.mkdirSync(path.join(dir, 'sub'));
    const calls = [];
    const spawn = (command, second) => {
      if (Array.isArray(second)) return { status: 0, stdout: `${dir}\n`, stderr: '' }; // git rev-parse --show-toplevel
      calls.push(second);
      return { status: 0, stdout: '', stderr: '' };
    };
    const { code } = await run(['run', path.join(dir, 'c.md'), '--cwd', path.join(dir, 'sub')], { spawn, cwd: os.tmpdir() });
    assert.equal(code, 0);
    assert.equal(path.resolve(calls[0].cwd), path.resolve(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- goal: the /goal condition ---

const HARNESS = path.resolve('/opt/js-harness/bin/js-harness.mjs');
const REAL_HARNESS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');

/** `contract goal` on `md`, saved as `<tmp>/<subdir>/c.md`; `file` is that absolute path. With
 * `inRepo`, a fake git says the temp directory is the repository top-level; otherwise it says "not a
 * repository", so `root` (the `--cwd` the condition must carry) is the contract's own directory. */
async function goalFor(md, { subdir = '.', harnessPath = HARNESS, cwdFlag = true, inRepo = false } = {}) {
  const dir = makeTmpDir();
  try {
    const file = path.join(dir, subdir, 'c.md');
    writeFile(file, md);
    const spawn = (command, second) => (Array.isArray(second) && inRepo ? { status: 0, stdout: `${dir}\n` } : { status: 1, stdout: '' });
    const outcome = cwdFlag
      ? await run(['goal', 'c.md', '--cwd', path.dirname(file)], { harnessPath, spawn })
      : await run(['goal', file], { harnessPath, spawn, cwd: os.tmpdir() });
    return { ...outcome, file, dir, root: inRepo ? dir : path.dirname(file) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('goal prints one paragraph: the run command, the hand checks and the Ask me before text', async () => {
  const { code, stdout, stderr, file, root } = await goalFor(contractWith('- `npm run check` exits 0\n- The output names the file\n- Rows are sorted'));
  assert.equal(code, 0, stderr);
  assert.ok(!stdout.includes('\n'), 'one paragraph');
  assert.ok(stdout.startsWith(`\`node "${HARNESS}" contract run "${file}" --cwd "${root}"\` exits 0 and prints \`met\``), stdout);
  assert.ok(stdout.includes('also true by hand: The output names the file; Rows are sorted'), stdout);
  assert.match(stdout, /Run it after each change and fix what fails/);
  assert.ok(stdout.includes(`"Ask me before" in ${file}: Changing the template.`), stdout);
});

test('goal emits absolute paths, so the command finds the contract from any working directory', async () => {
  const { stdout, file } = await goalFor(GOOD, { subdir: 'deep', cwdFlag: false });
  assert.ok(path.isAbsolute(file));
  assert.ok(stdout.includes(`contract run "${file}"`), stdout);
});

test('goal pins the project directory too: the git top-level of the contract, not the directory it sits in', async () => {
  const { stdout, file, dir } = await goalFor(GOOD, { subdir: 'deep', inRepo: true });
  assert.ok(stdout.includes(`contract run "${file}" --cwd "${dir}"\``), stdout);
  assert.ok(!stdout.includes(`--cwd "${path.dirname(file)}"`));
});

test('goal outside a git repository pins the requested --cwd, not the directory the contract sits in', async () => {
  const dir = makeTmpDir();
  try {
    const file = path.join(dir, 'odd', 'tasks', 'c.md');
    writeFile(file, GOOD);
    const spawn = () => ({ status: 128, stdout: '' }); // git finds no repository anywhere
    const { code, stdout, stderr } = await run(['goal', 'odd/tasks/c.md', '--cwd', dir], { harnessPath: HARNESS, spawn });
    assert.equal(code, 0, stderr);
    assert.ok(stdout.includes(`contract run "${file}" --cwd "${dir}"\``), stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the emitted command, replayed from an unrelated directory, runs the checks in the project root', async () => {
  const { stdout, file, dir } = await goalFor(GOOD, { subdir: 'deep', inRepo: true });
  const argv = [...stdout.matchAll(/"([^"]+)"/g)].map((m) => m[1]); // harness, contract, --cwd value
  assert.deepEqual(argv.slice(0, 3), [HARNESS, file, dir]);
  const tmp = makeTmpDir();
  try {
    writeFile(argv[1], contractWith('- `first` exits 0'));
    const calls = [];
    const spawn = (command, second) => {
      if (Array.isArray(second)) return { status: 0, stdout: `${tmp}\n` };
      calls.push(second);
      return { status: 0, stdout: '', stderr: '' };
    };
    const code = await contractMain(['run', argv[1], '--cwd', argv[2]], {}, { spawn, cwd: os.tmpdir(), stdout() {}, stderr() {} });
    assert.equal(code, 0);
    assert.equal(path.resolve(calls[0].cwd), path.resolve(tmp)); // the git top-level of --cwd, not os.tmpdir()
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('goal without an injected harness path runs the js-harness.mjs that is running', async () => {
  const dir = makeTmpDir();
  try {
    writeFile(path.join(dir, 'c.md'), GOOD);
    const { stdout } = await run(['goal', 'c.md', '--cwd', dir]);
    assert.ok(stdout.startsWith(`\`node "${REAL_HARNESS}" contract run `), stdout);
    assert.ok(fs.existsSync(REAL_HARNESS));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('goal double-quotes both paths, so a path with spaces replays as one argument', async () => {
  const { code, stdout, file, root } = await goalFor(GOOD, { subdir: 'with space', harnessPath: path.resolve('/opt/js harness/js-harness.mjs') });
  assert.equal(code, 0);
  assert.ok(file.includes('with space'));
  assert.ok(stdout.startsWith(`\`node "${path.resolve('/opt/js harness/js-harness.mjs')}" contract run "${file}" --cwd "${root}"\``), stdout);
});

test('goal refuses a path the shell could expand or split, and prints no condition', async () => {
  // A double quote, backtick, $, %, ! and a newline anywhere; a backslash only at the end.
  const harnessPaths = ['"', '`', '$', '%', '!', '\n'].map((bad) => path.resolve(`/opt/we${bad}ird/js-harness.mjs`));
  harnessPaths.push('/opt/js-harness\\'); // raw: path.resolve would drop the trailing backslash
  for (const harnessPath of harnessPaths) {
    const { code, stdout, stderr } = await goalFor(GOOD, { harnessPath });
    assert.equal(code, 1, JSON.stringify(harnessPath));
    assert.equal(stdout, '', JSON.stringify(harnessPath));
    assert.match(stderr, /cannot be quoted/, JSON.stringify(harnessPath));
  }
  for (const subdir of ['cost$5', 'wow!', '100%']) {
    const refused = await goalFor(GOOD, { subdir });
    assert.equal(refused.code, 1, subdir);
    assert.match(refused.stderr, /cannot be quoted/, subdir);
  }
});

test('a backslash inside a path is fine: only a trailing one is refused', async () => {
  const { code } = await goalFor(GOOD, { harnessPath: 'C:\\tools\\js-harness.mjs' });
  assert.equal(code, 0);
});

test('goal leaves out the hand-check clause when there is none, and a long Ask me before is only referenced', async () => {
  const long = 'x'.repeat(500);
  const { code, stdout, file } = await goalFor(GOOD.replace('Changing the template.', long));
  assert.equal(code, 0);
  assert.doesNotMatch(stdout, /by hand/);
  assert.ok(!stdout.includes(long));
  assert.ok(stdout.includes(`"Ask me before" in ${file}`), stdout);
});

test('goal refuses an invalid contract with its reasons on stderr and prints no condition', async () => {
  const { code, stdout, stderr } = await goalFor(contractWith('- It works'));
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /no command/);
});

test('goal exits 1 saying so when the condition is over the 4000-character /goal limit', async () => {
  const items = Array.from({ length: 60 }, (_, i) => `- Check number ${i} ${'y'.repeat(80)}`).join('\n');
  const { code, stdout, stderr } = await goalFor(contractWith(`- \`npm run check\` exits 0\n${items}`));
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /4,000/);
});
