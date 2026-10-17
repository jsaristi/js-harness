// The reader of the daily Windows suite (odd/tasks/commit-gates-first.md, S5 and "R1, version 3"): what it reads
// of GitHub, what it tells the lead, and that it tells each run once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STALE_MS, readDaily, staleOf, tellingOf, windowsDaily, windowsDailyTick } from './windows-daily.mjs';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const REPO = 'owner/project';
const URL = 'https://github.com/owner/project/actions/runs/77';
const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
const git = (args) => (args.includes('remote.origin.url') ? ok('https://github.com/owner/project.git\n') : { status: 1, stdout: '', stderr: '' });

/** A gh that answers the default branch, the newest run (`run`, or none) and its failed log (`log`). */
function fakeGh({ run = null, log = '', list = null, calls = [] } = {}) {
  return (args) => {
    calls.push(args);
    // `gh repo view` names its repository as an argument: it has no --repo flag.
    if (args[0] === 'repo') return args[2] === REPO && !args.includes('--repo') ? ok('main\n') : { status: 1, stdout: '', stderr: 'unknown flag: --repo' };
    if (args[0] === 'run' && args[1] === 'list') return list ?? ok(JSON.stringify(run === null ? [] : [run]));
    if (args[0] === 'run' && args[1] === 'view') return ok(log);
    throw new Error(`unexpected gh ${args.join(' ')}`);
  };
}

const ended = (msAgo) => new Date(NOW - msAgo).toISOString();
const runOf = (conclusion, { attempt = 1, msAgo = 3600_000 } = {}) => ({ databaseId: 77, attempt, conclusion, url: URL, updatedAt: ended(msAgo) });

// What gh's `--log-failed` prints: the job, the step and the time before each line, the time ending in a space.
const prefixed = (lines) => lines.map((line) => `suite\tThe whole suite\t2026-10-17T07:40:00.0000000Z ${line}`).join('\r\n');
const RED_LOG = prefixed([
  '✔ something passed (3ms)',
  '✖ failing tests:',
  '',
  'test at bin/loop.test.mjs:10:1',
  '✖ the loop stops (12ms)',
  '  AssertionError: expected',
  'test at bin/notify.test.mjs:4:1',
  '✖ a notice is written (5ms)',
]);
const TEST_FILES = ['bin/loop.test.mjs', 'bin/notify.test.mjs'];
const base = { cwd: '/repo', git, now: () => NOW, testFiles: () => TEST_FILES, ledger: () => [] };

test('a red run gives the names, the total and the files, read through gh\'s prefix', () => {
  const calls = [];
  const read = readDaily({ ...base, gh: fakeGh({ run: runOf('failure'), log: RED_LOG, calls }) });
  assert.equal(read.state, 'red');
  assert.deepEqual(read.names, ['the loop stops', 'a notice is written']);
  assert.equal(read.total, 2);
  assert.deepEqual(read.files, TEST_FILES);
  assert.equal(read.quarantined, false);
  assert.ok(calls.every((args) => args.includes(REPO)), 'every gh call names the repository origin names');
  assert.ok(calls.some((args) => args[1] === 'list' && args.includes('windows-daily.yml') && args.includes('main') && args.includes('completed')));
  assert.ok(calls.some((args) => args[1] === 'view' && args.includes('77') && args.includes('--log-failed') && args.includes('--attempt')));
});

test('a timed-out or cancelled run is red, and with no summary its names are not readable', () => {
  for (const conclusion of ['timed_out', 'cancelled']) {
    const read = readDaily({ ...base, gh: fakeGh({ run: runOf(conclusion), log: prefixed(['Error: The operation was canceled.']) }) });
    assert.equal(read.state, 'red', conclusion);
    assert.deepEqual(read.names, []);
    const telling = tellingOf(read);
    assert.match(telling.line, /^WINDOWS: \S+ (timed_out|cancelled), names not readable$/);
  }
});

test('a green run tells nothing', () => {
  const read = readDaily({ ...base, gh: fakeGh({ run: runOf('success') }) });
  assert.equal(read.state, 'green');
  assert.equal(tellingOf(read), null);
});

test('a red run is passed over only when it names files and every one is quarantined', () => {
  const current = TEST_FILES.map((file) => ({ file, owner: 'x', expires: '2026-12-31', failure: 'F1' }));
  const allQuarantined = readDaily({ ...base, ledger: () => current, gh: fakeGh({ run: runOf('failure'), log: RED_LOG }) });
  assert.equal(allQuarantined.quarantined, true);
  assert.equal(tellingOf(allQuarantined), null);
  const expired = readDaily({ ...base, ledger: () => [current[0], { ...current[1], expires: '2026-10-01' }], gh: fakeGh({ run: runOf('failure'), log: RED_LOG }) });
  assert.equal(expired.quarantined, false);
  // No file found reads as "every file quarantined" to a check that does not ask for one.
  const noFiles = readDaily({ ...base, ledger: () => current, gh: fakeGh({ run: runOf('failure'), log: prefixed(['setup failed']) }) });
  assert.equal(noFiles.quarantined, false);
  assert.notEqual(tellingOf(noFiles), null);
});

test('no workflow, no run yet and a gh that cannot answer are said, and tell nothing', () => {
  const missing = readDaily({ ...base, gh: fakeGh({ list: { status: 1, stdout: '', stderr: 'could not find any workflows named windows-daily.yml\n' } }) });
  assert.equal(missing.state, 'skip');
  assert.match(missing.why, /no windows-daily\.yml/);
  const none = readDaily({ ...base, gh: fakeGh() });
  assert.equal(none.state, 'none');
  const signedOut = readDaily({ ...base, gh: fakeGh({ list: { status: 4, stdout: '', stderr: 'gh auth login\nmore' } }) });
  assert.equal(signedOut.state, 'skip');
  assert.match(signedOut.why, /gh auth login$/);
  const notGithub = readDaily({ ...base, git: () => ok('https://gitlab.com/a/b.git\n'), gh: fakeGh() });
  assert.equal(notGithub.state, 'skip');
  for (const read of [missing, none, signedOut, notGithub]) assert.equal(tellingOf(read), null);
});

test('a run that ended more than 26 hours ago is told as stale', () => {
  const read = readDaily({ ...base, gh: fakeGh({ run: runOf('success', { msAgo: STALE_MS + 60_000 }) }) });
  assert.equal(tellingOf(read), null);
  const telling = staleOf(read);
  assert.equal(telling.key, 'stale-77');
  assert.match(telling.line, /^WINDOWS: no run of windows-daily\.yml has ended in 26 h/);
  assert.doesNotMatch(telling.text, /\d{1,2}:\d{2}/, 'no clock time: notify refuses a stamp that is off');
});

test('the notice text holds the URL, the total and the names that fit in 500 characters', () => {
  const names = Array.from({ length: 20 }, (_, n) => `a long test name number ${n} ${'x'.repeat(40)}`);
  const telling = tellingOf({ state: 'red', run: { id: '77', attempt: 1, conclusion: 'failure', url: URL }, ageMs: 0, names, total: 31, files: [], quarantined: false });
  assert.ok(telling.text.length <= 500, String(telling.text.length));
  assert.match(telling.text, /31 failing/);
  assert.ok(telling.text.includes(URL));
  assert.equal(telling.key, 'told-77-1');
});

function tempHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-windows-daily-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

test('a red run is told once, by the one that creates its marker', async (t) => {
  const home = tempHome(t);
  const sent = [];
  const notify = async (argv) => {
    sent.push(argv);
    return 0;
  };
  const options = { ...base, home, slug: 'D--repo', notify, gh: fakeGh({ run: runOf('failure'), log: RED_LOG }) };
  const first = await windowsDaily(options);
  assert.match(first.told, /^WINDOWS: \S+ failure, 2 failing: the loop stops; a notice is written$/);
  assert.deepEqual(sent[0].slice(0, 4), ['--to', 'orchestrator', '--kind', 'note']);
  assert.ok(fs.existsSync(path.join(home, '.js-harness', 'channel', 'windows-daily', 'D--repo', 'told-77-1')));
  const second = await windowsDaily(options);
  assert.equal(second.told, null);
  assert.equal(sent.length, 1);
  assert.ok(second.lines.some((line) => /told before/.test(line)));
  // A second attempt of the same run is another run to tell.
  const rerun = await windowsDaily({ ...options, gh: fakeGh({ run: runOf('failure', { attempt: 2 }), log: RED_LOG }) });
  assert.notEqual(rerun.told, null);
});

test('a notice that cannot be written is said, and the next reading tries it again', async (t) => {
  const options = { ...base, home: tempHome(t), slug: 's', gh: fakeGh({ run: runOf('failure'), log: RED_LOG }) };
  const result = await windowsDaily({ ...options, notify: async () => 1 });
  assert.notEqual(result.told, null);
  assert.match(result.failed, /notice/);
  const sent = [];
  const retry = await windowsDaily({ ...options, notify: async (argv) => sent.push(argv) && 0 });
  assert.notEqual(retry.told, null);
  assert.equal(retry.failed, null);
  assert.equal(sent.length, 1);
});

test('a red run already told does not hide a schedule that stopped', async (t) => {
  const options = { ...base, home: tempHome(t), slug: 's', notify: async () => 0 };
  const red = await windowsDaily({ ...options, gh: fakeGh({ run: runOf('failure'), log: RED_LOG }) });
  assert.match(red.told, /^WINDOWS: \S+ failure/);
  const later = await windowsDaily({ ...options, gh: fakeGh({ run: runOf('failure', { msAgo: STALE_MS + 60_000 }), log: RED_LOG }) });
  assert.match(later.told, /^WINDOWS: no run of windows-daily\.yml has ended in 26 h/);
  const again = await windowsDaily({ ...options, gh: fakeGh({ run: runOf('failure', { msAgo: STALE_MS + 120_000 }), log: RED_LOG }) });
  assert.equal(again.told, null);
});

test('the tick asks only when the last ask is older than the interval, the first tick of a new process included', async (t) => {
  const home = tempHome(t);
  let clock = NOW;
  let asked = 0;
  const gh = (args) => {
    if (args[1] === 'list') asked += 1;
    return fakeGh({ run: runOf('success') })(args);
  };
  const options = { ...base, home, slug: 's', gh, now: () => clock, everyMs: 3600_000, notify: async () => 0 };
  assert.notEqual(await windowsDailyTick(options), null);
  clock += 30 * 60_000;
  // A heartbeat started again half an hour later reads the time of the last ask from the file.
  assert.equal(await windowsDailyTick(options), null);
  clock += 31 * 60_000;
  assert.notEqual(await windowsDailyTick(options), null);
  assert.equal(asked, 2);
});
