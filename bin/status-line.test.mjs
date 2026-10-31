// `js-harness status-line`, the writer of the line Claude Desktop's sessionStatusLine program prints (bin/lib/status-line.mjs):
// its arguments, the board it runs, the file it writes, what it prints and its exit code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { statusLineMain } from './status-line.mjs';
import { statusLineFile } from './lib/status-line.mjs';

const BOARD = {
  sessions: [{ state: 'working' }, { state: 'waiting' }],
  questions: { open: [] },
  pullRequests: { available: true, items: [] },
  gateLock: { available: true, holder: null, waiters: [] },
};
const NOW = Date.parse('2026-10-31T03:00:00Z');

function world(result) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'status-line-command-'));
  const out = [];
  const err = [];
  const ran = [];
  const deps = {
    cwd: home,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    env: {},
    homedir: () => home,
    now: () => NOW,
    run: (command, args, options) => {
      ran.push({ command, args, options });
      return result;
    },
  };
  return { home, out, err, ran, deps, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

test('write runs the board with this copy of the harness and keeps its line, with its time, under the home', async () => {
  const { home, out, ran, deps, done } = world({ status: 0, stdout: JSON.stringify(BOARD), stderr: '' });
  try {
    assert.equal(await statusLineMain(['write'], deps), 0);
    assert.equal(ran.length, 1);
    assert.equal(ran[0].command, process.execPath);
    assert.deepEqual(ran[0].args, [path.join(import.meta.dirname, 'js-harness.mjs'), 'sessions', '--json']);
    assert.equal(ran[0].options.cwd, home);
    const line = '0 preguntas · 1 trabajando · 1 esperando · 0 PR · gate libre';
    assert.equal(fs.readFileSync(statusLineFile(home), 'utf8'), `2026-10-31T03:00:00.000Z\n${line}\n`);
    assert.deepEqual(out, [`status-line: wrote ${statusLineFile(home)}: ${line}`]);
  } finally {
    done();
  }
});

test('write leaves the last line as it was when the board fails or is not JSON, and exits 1 saying why', async () => {
  for (const result of [{ status: 1, stdout: '', stderr: 'boom' }, { status: 0, stdout: 'not json', stderr: '' }, { status: null, stdout: '', stderr: '', error: new Error('spawnSync node ETIMEDOUT') }]) {
    const { home, out, err, deps, done } = world(result);
    try {
      fs.mkdirSync(path.dirname(statusLineFile(home)), { recursive: true });
      fs.writeFileSync(statusLineFile(home), 'earlier\nthe last line\n');
      assert.equal(await statusLineMain(['write'], deps), 1);
      assert.equal(fs.readFileSync(statusLineFile(home), 'utf8'), 'earlier\nthe last line\n');
      assert.deepEqual(out, []);
      assert.match(err[0], /^js-harness status-line: the board could not be read/);
    } finally {
      done();
    }
  }
});

test('program prints the path of the program the host runs, beside the line module', async () => {
  const { out, ran, deps, done } = world(null);
  try {
    assert.equal(await statusLineMain(['program'], deps), 0);
    assert.deepEqual(out, [path.join(import.meta.dirname, 'lib', 'status-line.ps1')]);
    assert.ok(fs.existsSync(out[0]));
    assert.equal(ran.length, 0);
  } finally {
    done();
  }
});

test('a missing or unknown subcommand or argument is a usage error, exit 2; --help prints the usage, exit 0', async () => {
  for (const argv of [[], ['read'], ['write', '--force'], ['write', '--home']]) {
    const { err, deps, done } = world(null);
    try {
      assert.equal(await statusLineMain(argv, deps), 2, argv.join(' '));
      assert.match(err[0], /^js-harness status-line: /);
      assert.match(err[0], /Usage: js-harness status-line/);
    } finally {
      done();
    }
  }
  const { out, deps, done } = world(null);
  try {
    assert.equal(await statusLineMain(['--help'], deps), 0);
    assert.match(out[0], /^Usage: js-harness status-line/);
  } finally {
    done();
  }
});
