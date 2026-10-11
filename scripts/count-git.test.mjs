// Tests of scripts/count-git.mjs and its preload. The two runs of the tool count throwaway test files written
// to a temporary folder, which start a known number of git and other processes in every way the preload has to
// see: sync and async, through a shell string, through `util.promisify`, by a named import and by the default
// one, in a helper, and from a child `node` with the inherited environment and with one written out. Only cheap
// git commands run (`git --version` and the like); no repository is built.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describeCall, gitSubcommand, repositoryFrame } from './count-git-preload.mjs';
import { parseArgs, renderReport, summarize } from './count-git.mjs';

const TOOL = fileURLToPath(new URL('./count-git.mjs', import.meta.url));

// Every line that starts a git process ends in a marker, so the expected caller frame is read off this list.
const FILES = {
  'a.test.mjs': [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { spawn, spawnSync, exec, execSync, execFile, execFileSync } from 'node:child_process';",
    "import { once } from 'node:events';",
    "import { promisify } from 'node:util';",
    "import { viaHelper } from './helper.mjs';",
    'const here = import.meta.dirname;',
    'const lean = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };',
    "test('a', async () => {",
    "  spawnSync('git', ['--version']); // m-sync",
    "  execFileSync('git', ['-c', 'core.x=1', 'version']); // m-file-sync",
    "  execSync('git --version'); // m-shell-sync",
    "  await once(spawn('git', ['version'], { stdio: 'ignore' }), 'close'); // m-async",
    "  assert.match((await promisify(execFile)('git', ['version'])).stdout, /^git version/); // m-promisified",
    "  assert.match((await promisify(exec)('git version')).stdout, /^git version/); // m-shell-async",
    '  viaHelper();',
    "  assert.throws(() => execFileSync('git', ['no-such-command'], { stdio: 'ignore' })); // m-failing",
    "  assert.throws(() => spawnSync('git', ['status'], { timeout: 'soon' }), { code: /^ERR_/ });",
    "  spawnSync(process.execPath, ['child.mjs'], { cwd: here });",
    "  spawnSync(process.execPath, ['child.mjs'], { cwd: here, env: lean });",
    "  execSync('echo not git');",
    '});',
  ],
  'helper.mjs': [
    "import { spawnSync } from 'node:child_process';",
    "export const viaHelper = () => spawnSync('git', ['--version']); // m-helper",
  ],
  'child.mjs': [
    "import cp from 'node:child_process';",
    "cp.spawnSync('git', ['-C', '.', 'rev-parse', '--git-dir']); // m-child",
    "cp.spawnSync(process.execPath, ['-e', '0']);",
  ],
  'b.test.mjs': [
    "import { test } from 'node:test';",
    "import cp from 'node:child_process';",
    "test('b', () => { cp.spawnSync('git', ['--version']); }); // m-default-import",
  ],
  'fail.test.mjs': [
    "import { test } from 'node:test';",
    "import { spawnSync } from 'node:child_process';",
    "test('boom-test', () => { spawnSync('git', ['--version']); throw new Error('boom'); });",
  ],
};
const at = (file, marker) => `${file}:${FILES[file].findIndex((line) => line.endsWith(`// ${marker}`)) + 1}`;

let root;
let tmp;
before(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'count-git-test-')));
  tmp = path.join(root, 'tmp');
  fs.mkdirSync(tmp);
  for (const [name, lines] of Object.entries(FILES)) fs.writeFileSync(path.join(root, name), `${lines.join('\n')}\n`);
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

/** Runs the tool in the throwaway folder, with a temporary folder of its own to look into afterwards. */
const runTool = (...args) => spawnSync(process.execPath, [TOOL, '--root', root, ...args], {
  cwd: root, encoding: 'utf8', env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp },
});

test('a run of two files: every git process once, by sub-command, caller and test file', () => {
  const run = runTool('--json', 'a.test.mjs', 'b.test.mjs');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /pass 2/, 'with --json the output of the tests goes to stderr');
  const report = JSON.parse(run.stdout); // nothing but the report is on stdout
  assert.equal(report.exitCode, 0);
  assert.equal(report.git.count, 11);
  assert.equal(report.git.untimed, 0);
  assert.ok(report.git.seconds > 0, 'the time of the processes is measured');
  // Two `node child.mjs`, the `node -e 0` of each, and one `echo`. Not counted: the call Node refused, and the
  // runner's own process per test file.
  assert.deepEqual(report.other, { count: 5, shell: 1 });
  assert.deepEqual(report.bySubcommand.map((row) => [row.name, row.count]),
    [['--version', 4], ['version', 4], ['rev-parse', 2], ['no-such-command', 1]]);
  // One per line, also where Node builds the function on another one (`execSync` and `execFileSync` on
  // `spawnSync`, `exec` on `execFile` on `spawn`) and where `util.promisify` gives the promise form.
  assert.deepEqual(Object.fromEntries(report.byCaller.map((row) => [row.name, row.subcommands])), {
    [at('child.mjs', 'm-child')]: { 'rev-parse': 2 }, // once with the inherited environment, once with a written one
    [at('a.test.mjs', 'm-sync')]: { '--version': 1 },
    [at('a.test.mjs', 'm-file-sync')]: { version: 1 },
    [at('a.test.mjs', 'm-shell-sync')]: { '--version': 1 },
    [at('a.test.mjs', 'm-async')]: { version: 1 },
    [at('a.test.mjs', 'm-promisified')]: { version: 1 },
    [at('a.test.mjs', 'm-shell-async')]: { version: 1 },
    [at('a.test.mjs', 'm-failing')]: { 'no-such-command': 1 },
    [at('helper.mjs', 'm-helper')]: { '--version': 1 },
    [at('b.test.mjs', 'm-default-import')]: { '--version': 1 },
  });
  assert.equal(report.byCaller[0].name, at('child.mjs', 'm-child'), 'the largest caller is first');
  assert.deepEqual(report.byTestFile.map((row) => [row.name, row.count]), [['a.test.mjs', 10], ['b.test.mjs', 1]]);
  // The two test files, two `node child.mjs` and their two `node -e 0`; the runner is not one of them.
  assert.deepEqual(report.processes, { reported: 6, missing: 0, unreadable: 0 });
  assert.deepEqual(fs.readdirSync(tmp), [], 'the temporary file is removed');
});

test('a failing run: its exit code, the output of the tests and then the report, no temporary file left', () => {
  const run = runTool('--top', '1', 'fail.test.mjs');
  assert.equal(run.status, 1);
  assert.match(run.stdout, /boom-test[\s\S]*\ngit processes: 1 \(\d+\.\d s summed\), 100% of the 1 processes started\n/);
  assert.match(run.stdout, /by caller \(count, seconds, caller, sub-commands\), top 1 of 1:\n +1 +\d+\.\d  fail\.test\.mjs:3  --version 1\n/);
  assert.doesNotMatch(run.stdout, /by test file/, 'one file given, nothing to split');
  assert.match(run.stdout, /\nnot seen: .*hooks.*non-Node child.*\n$/);
  assert.deepEqual(fs.readdirSync(tmp), []);
});

test('the git sub-command is the first argument that is not an option of git or the value of one', () => {
  for (const [args, expected] of [
    [['status', '--short'], 'status'],
    [['-C', 'some/dir', 'rev-parse', '--git-dir'], 'rev-parse'],
    [['-c', 'user.name=x', '-c', 'core.bare=false', 'commit', '-m', 'm'], 'commit'],
    [['--git-dir', '.git', '--work-tree=.', '--no-pager', 'log'], 'log'],
    [['-C', 'dir', '--version'], '--version'], // no sub-command: the option that is asked instead
    [[], '(none)'],
  ]) assert.equal(gitSubcommand(args), expected, args.join(' '));
});

test('what a call starts: git by the base name of the command, a shell string by its first word', () => {
  const git = (sub, shell = false) => ({ git: true, sub, node: false, shell });
  assert.deepEqual(describeCall('spawn', ['C:\\Program Files\\Git\\cmd\\Git.EXE', ['status']]), git('status'));
  assert.deepEqual(describeCall('execFileSync', ['/usr/bin/git', ['-C', 'x', 'log'], { encoding: 'utf8' }]), git('log'));
  assert.deepEqual(describeCall('execSync', ['"C:\\Program Files\\Git\\bin\\git.exe" -C "a b" diff --stat']), git('diff', true));
  assert.deepEqual(describeCall('spawnSync', ['git status', { shell: true }]), git('status', true));
  assert.deepEqual(describeCall('spawn', ['git', { cwd: 'x' }]), git('(none)'));
  assert.deepEqual(describeCall('exec', ['cd x && git status']), { git: false, sub: null, node: false, shell: true });
  assert.deepEqual(describeCall('spawn', ['gitk', []]), { git: false, sub: null, node: false, shell: false });
  assert.deepEqual(describeCall('spawnSync', [process.execPath, ['x.mjs']]), { git: false, sub: null, node: true, shell: false });
  assert.deepEqual(describeCall('fork', ['x.mjs']), { git: false, sub: null, node: true, shell: false });
  // A runner loads no preload and never reports, so it is not one of the Node processes a report is due from.
  assert.equal(describeCall('spawnSync', [process.execPath, ['--test', 'x.test.mjs']]).node, false);
});

test('the caller is the first frame in a file of the repository that is not the preload', () => {
  const base = path.resolve('repo');
  const inside = (...parts) => path.join(base, ...parts);
  const stack = [
    'Error',
    `    at spawnSync (${pathToFileURL(inside('scripts', 'count-git-preload.mjs')).href}:10:3)`,
    '    at node:internal/child_process:1:2',
    `    at helper (${pathToFileURL(path.resolve('elsewhere', 'x.mjs')).href}:7:1)`,
    `    at Object.run (${inside('bin', 'lib', 'old.cjs')}:42:9)`,
    `    at ${pathToFileURL(inside('bin', 'a b.test.mjs')).href}:5:1`,
  ].join('\n');
  assert.equal(repositoryFrame(stack, base, inside('scripts', 'count-git-preload.mjs')), 'bin/lib/old.cjs:42');
  assert.equal(repositoryFrame(stack, inside('bin', 'a b.test.mjs', '..'), 'none'), 'lib/old.cjs:42');
  assert.equal(repositoryFrame(stack.split('\n').slice(0, 4).join('\n'), base, 'none'), 'scripts/count-git-preload.mjs:10');
  assert.equal(repositoryFrame('Error\n    at node:internal/x:1:2', base, 'none'), '(outside the repository)');
});

test('the summary is ordered by count and then by name, and says what never reported', () => {
  const entry = (sub, caller, count) => ({ sub, caller, count, ms: 1000, untimed: 0 }); // a second for the whole entry
  const summary = summarize([
    { pid: 1, ppid: 0, testFile: null, other: 2, shell: 0, nodes: 2, git: [] }, // the runner: its two test files
    { pid: 2, ppid: 1, testFile: path.resolve('r', 'x.test.mjs'), other: 3, shell: 1, nodes: 2, git: [entry('status', 'b.mjs:1', 2), entry('log', 'a.mjs:9', 2)] },
    { pid: 3, ppid: 2, testFile: path.resolve('r', 'x.test.mjs'), other: 0, shell: 0, nodes: 0, git: [{ ...entry('status', 'a.mjs:9', 1), untimed: 1 }] },
  ], { runnerPid: 1, root: path.resolve('r') });
  assert.deepEqual(summary.git, { count: 5, seconds: 3, untimed: 1 });
  assert.deepEqual(summary.other, { count: 3, shell: 1 });
  assert.deepEqual(summary.processes, { reported: 2, missing: 1, unreadable: 0 }); // pid 2 started two, one reported
  assert.deepEqual(summary.bySubcommand.map((row) => [row.name, row.count]), [['status', 3], ['log', 2]]);
  assert.deepEqual(summary.byCaller, [
    { name: 'a.mjs:9', count: 3, seconds: 2, subcommands: { log: 2, status: 1 } },
    { name: 'b.mjs:1', count: 2, seconds: 1, subcommands: { status: 2 } },
  ]);
  const text = renderReport(summary, { top: 1, byFile: true });
  assert.match(text, /^git processes: 5 \(3\.0 s summed\), 63% of the 8 processes started\n  1 of them not timed/);
  assert.match(text, /top 1 of 2:\n +3 +2\.0  a\.mjs:9  log 2, status 1\nby test file \(count, seconds\):\n +5 +3\.0  x\.test\.mjs\n/);
  assert.match(text, /\nNode processes that reported: 2; at least 1 more were started and never reported/);
});

test('the arguments: the options, the files, and what is refused', () => {
  assert.deepEqual(parseArgs(['--json', '--top', '3', '--root', 'r', 'a.test.mjs', 'b.test.mjs']),
    { json: true, top: 3, root: 'r', files: ['a.test.mjs', 'b.test.mjs'] });
  assert.equal(parseArgs(['a.test.mjs']).top, 25);
  for (const argv of [[], ['--json'], ['--top', '0', 'a'], ['--top', 'a'], ['--root'], ['--unknown', 'a']]) {
    assert.equal(typeof parseArgs(argv).error, 'string', argv.join(' '));
  }
});
