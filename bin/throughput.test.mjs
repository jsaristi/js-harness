import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SNAPSHOT_SCHEMA, throughputMain } from './throughput.mjs';

const NOW = Date.parse('2026-10-17T03:00:00Z');
const ROOT = path.resolve('/project/js-harness');
const homes = [];
afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

function makeHome(gateLines = []) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-throughput-'));
  homes.push(home);
  if (gateLines.length) {
    fs.mkdirSync(path.join(home, '.js-harness', 'gate-log'), { recursive: true });
    fs.writeFileSync(path.join(home, '.js-harness', 'gate-log', 'log.jsonl'), gateLines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  }
  return home;
}

/** A git that answers as a repository whose main merged pull request 7 at 10:30Z on the 16th. */
function fakeGit({ origin = true } = {}) {
  return (command, args) => {
    const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
    if (args[0] === 'rev-parse' && args[1] === '--git-common-dir') return ok(`${ROOT}/.git\n`);
    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return ok(`${ROOT}\n`);
    if (args[0] === 'rev-parse') return origin ? ok('abc\n') : { status: 1, stdout: '', stderr: '' };
    if (args[0] === 'log' && args[1] === '--first-parent') return ok('m7\t2026-10-16T10:30:00Z\tp7 h7\tMerge pull request #7 from feat/x\n');
    if (args[0] === 'show') return ok('h7\t2026-10-16T10:00:00Z\n');
    if (args[0] === 'rev-list') return ok('c1\n');
    if (args[0] === 'grep') return ok('odd/tasks/a.md:- [ ] T1\nodd/tasks/a.md:- [x] T2\n');
    if (args[0] === 'log') return ok('');
    return { status: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` };
  };
}

async function run(argv, { home, git = fakeGit(), codex = [], now = NOW } = {}) {
  const out = [];
  const err = [];
  const code = await throughputMain(argv, {}, {
    cwd: ROOT, stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => now, run: git,
    homedir: () => home, readCodexRuns: () => codex,
  });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

const GATES = [
  { v: 1, event: 'start', id: 'g0', at: '2026-10-15T23:00:00Z', cwd: ROOT, command: 'check', pid: 1, lock: 'own', waitedSeconds: 0, waitedFor: [] },
  { v: 1, event: 'start', id: 'g1', at: '2026-10-16T09:00:00Z', cwd: ROOT, command: 'check', pid: 1, lock: 'own', waitedSeconds: 120, waitedFor: [], session: 'aaaaaaaa-1' },
  { v: 1, event: 'end', id: 'g1', at: '2026-10-16T09:03:20Z', seconds: 200, result: 'pass', sensors: [{ name: 'tests', seconds: 190, pass: true, ranIn: 'wsl' }] },
];

test('a usage error exits 2 and does nothing', async () => {
  const home = makeHome();
  assert.equal((await run(['--since', '16-10-2026'], { home })).code, 2);
  assert.equal((await run(['--bogus'], { home })).code, 2);
  assert.equal((await run(['snapshot', '--since', '2026-10-15'], { home })).code, 2);
  assert.equal(fs.existsSync(path.join(home, '.js-harness', 'throughput')), false);
});

test('the table of the day before today names, for each row, its source, and the day it read from the live records', async () => {
  const home = makeHome(GATES);
  const { code, stdout } = await run([], { home, codex: [{ startedAt: '2026-10-16T08:00:00Z', durationMs: 49_000, outcome: 'reviewed' }] });
  assert.equal(code, 0);
  assert.match(stdout, /2026-10-16 to 2026-10-17/);
  assert.match(stdout, /2026-10-16 {2}live records/);
  assert.match(stdout, /pull requests merged +1 \(0\.04 an hour\) +\[git log of origin\/main/);
  assert.match(stdout, /gate waits +2 min in all; most: aaaaaaaa 2 min +\[the gate log/);
  assert.match(stdout, /Codex reviews +1 runs, median 49 s/);
  assert.match(stdout, /ready to merged +not recorded \(B1, JH 26\)/);
});

test('a main that is not there is said on the rows git gives, never read as no pull request', async () => {
  const home = makeHome(GATES);
  const { stdout } = await run([], { home, git: fakeGit({ origin: false }) });
  assert.match(stdout, /pull requests merged +not read: 2026-10-16 origin\/main is not there/);
});

test('snapshot keeps a closed day once, and the table then reads the day from it', async () => {
  const home = makeHome(GATES);
  const first = await run(['snapshot', '--day', '2026-10-16'], { home });
  assert.equal(first.code, 0, first.stderr);
  const file = path.join(home, '.js-harness', 'throughput', ROOT.replace(/[^A-Za-z0-9]/g, '-'), '2026-10-16.json');
  const kept = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(kept.schema, SNAPSHOT_SCHEMA);
  assert.deepEqual(kept.gates.map((gate) => gate.id), ['g1']);
  // main's history is append-only and is read live, never kept: a stale fetch freezes nothing.
  assert.equal(kept.prs, undefined);

  const again = await run(['snapshot', '--day', '2026-10-16'], { home });
  assert.equal(again.code, 1);
  assert.match(again.stderr, /already kept/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), kept);

  // The live log loses the day (rotation): the table still prints it, from the snapshot.
  fs.rmSync(path.join(home, '.js-harness', 'gate-log'), { recursive: true });
  const { stdout } = await run(['--since', '2026-10-16', '--until', '2026-10-17'], { home });
  assert.match(stdout, /2026-10-16 {2}snapshot/);
  assert.match(stdout, /gate waits +2 min in all/);
});

test('snapshot refuses a day that is not over yet', async () => {
  const home = makeHome(GATES);
  const { code, stderr } = await run(['snapshot', '--day', '2026-10-17'], { home });
  assert.equal(code, 2);
  assert.match(stderr, /not over yet/);
});

test('status names each day since the first one kept that has none, and exits 1', async () => {
  const home = makeHome(GATES);
  assert.equal((await run(['status'], { home })).code, 0);
  await run(['snapshot', '--day', '2026-10-14'], { home });
  await run(['snapshot', '--day', '2026-10-16'], { home });
  const { code, stdout } = await run(['status'], { home });
  assert.equal(code, 1);
  assert.match(stdout, /2026-10-14 {2}kept/);
  assert.match(stdout, /2026-10-15 {2}MISSING/);
  assert.match(stdout, /2026-10-16 {2}kept/);
});

test('a day is kept only once its last gates can have ended: two gate-max after its midnight', async () => {
  const home = makeHome(GATES);
  const early = await run(['snapshot', '--day', '2026-10-16'], { home, now: Date.parse('2026-10-17T00:30:00Z') });
  assert.equal(early.code, 2);
  assert.match(early.stderr, /settles at 2026-10-17T01:00:00.000Z/);
});

test('snapshot --gate-log keeps a day from archived copies of the log and says where it came from', async () => {
  const home = makeHome();
  const copy = path.join(home, 'gate-log.jsonl');
  fs.writeFileSync(copy, GATES.map((line) => JSON.stringify(line)).join('
') + '
');
  const { code, stderr } = await run(['snapshot', '--day', '2026-10-16', '--gate-log', copy], { home });
  assert.equal(code, 0, stderr);
  const kept = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'throughput', ROOT.replace(/[^A-Za-z0-9]/g, '-'), '2026-10-16.json'), 'utf8'));
  assert.deepEqual(kept.from, [copy]);
  assert.deepEqual(kept.gates.map((gate) => gate.id), ['g1']);
});

test('a partial day is replaced by a fuller one, and the replacement is recorded', async () => {
  const home = makeHome(GATES.slice(1));
  assert.equal((await run(['snapshot', '--day', '2026-10-16'], { home })).code, 0);
  const copy = path.join(home, 'gate-log.jsonl');
  fs.writeFileSync(copy, GATES.map((line) => JSON.stringify(line)).join('
') + '
');
  const { code, stdout } = await run(['snapshot', '--day', '2026-10-16', '--gate-log', copy], { home });
  assert.equal(code, 0);
  assert.match(stdout, /replaced a partial snapshot/);
  const kept = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'throughput', ROOT.replace(/[^A-Za-z0-9]/g, '-'), '2026-10-16.json'), 'utf8'));
  assert.equal(kept.partialFrom, null);
  assert.equal(kept.replaced.partialFrom, '2026-10-16T09:00:00Z');
});
