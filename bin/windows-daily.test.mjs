// `js-harness windows-daily`, the hand run of the daily Windows suite's reader (bin/lib/windows-daily.mjs): its
// arguments, what it prints and its exit code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { windowsDailyMain } from './windows-daily.mjs';

const HOME = path.resolve('/home/someone');
const CWD = path.resolve('/work/project');
const noGit = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });

function world(result) {
  const out = [];
  const err = [];
  const asked = [];
  const deps = {
    cwd: CWD,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    env: {},
    homedir: () => HOME,
    run: noGit,
    daily: async (options) => {
      asked.push(options);
      return result;
    },
  };
  return { out, err, asked, deps };
}

test('it prints what the reader found and exits 0, with the project\'s home and slug', async () => {
  const { out, asked, deps } = world({ lines: ['windows-daily: the newest run, u, passed (ended 3 h ago)'], told: null, failed: null });
  assert.equal(await windowsDailyMain([], deps), 0);
  assert.deepEqual(out, ['windows-daily: the newest run, u, passed (ended 3 h ago)']);
  assert.equal(asked[0].home, HOME);
  assert.equal(asked[0].cwd, CWD);
  assert.equal(typeof asked[0].slug, 'string');
});

test('a red run told now is printed as its end line', async () => {
  const { out, deps } = world({ lines: ['windows-daily: failed'], told: 'WINDOWS: u failure, 1 failing: t', failed: null });
  assert.equal(await windowsDailyMain(['--home', '/elsewhere'], deps), 0);
  assert.deepEqual(out, ['windows-daily: failed', 'WINDOWS: u failure, 1 failing: t']);
});

test('a notice that could not be written exits 1 and says so', async () => {
  const { out, err, deps } = world({ lines: [], told: 'WINDOWS: u failure', failed: 'the notice could not be written' });
  assert.equal(await windowsDailyMain([], deps), 1);
  assert.match(err.join('\n'), /the notice could not be written/);
  // Harness review d7, 2026-10-18: the end line says a run was told; one whose notice failed was not told.
  assert.deepEqual(out, []);
});

test('--help prints the usage, and a flag it does not know is refused', async () => {
  const help = world(null);
  assert.equal(await windowsDailyMain(['--help'], help.deps), 0);
  assert.match(help.out.join('\n'), /^Usage: js-harness windows-daily/);
  assert.equal(help.asked.length, 0);
  const bad = world(null);
  assert.equal(await windowsDailyMain(['--hours', '3'], bad.deps), 2);
  assert.match(bad.err.join('\n'), /--hours/);
  assert.equal(bad.asked.length, 0);
});
