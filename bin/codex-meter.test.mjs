import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { codexMeterMain, USAGE } from './codex-meter.mjs';
import { withoutAutoMaintenance } from './lib/git-fixture.testkit.mjs';

// A fake `codex app-server` (see bin/lib/codex-meter.test.mjs): nothing here starts Codex.
function fakeCodex(answer, { spawnError = null } = {}) {
  const sent = [];
  const killed = [];
  const spawned = [];
  const child = new EventEmitter();
  child.pid = 4321;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = {
    write(text) {
      const message = JSON.parse(text);
      sent.push(message);
      for (const line of answer(message) ?? []) {
        const written = typeof line === 'string' ? line : JSON.stringify(line);
        setImmediate(() => child.stdout.write(`${written}\n`));
      }
      return true;
    },
    end() {},
  };
  const spawn = (command, args, options) => {
    spawned.push({ command, args, options });
    if (spawnError) setImmediate(() => child.emit('error', spawnError));
    return child;
  };
  const kill = (target, lifetime) => {
    killed.push({ target, lifetime });
  };
  return { spawn, kill, sent, killed, spawned, child };
}

// Read the way codex-cli 0.163.0 answers it (numbers read once from the real server; the account identifier is
// one the output must never print).
const RESULT = {
  rateLimits: {
    primary: { usedPercent: 3, windowDurationMins: 300, resetsAt: 1792839680 },
    secondary: { usedPercent: 8, windowDurationMins: 10080, resetsAt: 1793385515 },
  },
  rateLimitResetCredits: { availableCount: 1 },
  accountId: 'acct-test-123',
};

function answering(result = RESULT) {
  return (message) => {
    if (message.method === 'initialize') return [{ id: message.id, result: {} }];
    if (message.method === 'account/rateLimits/read') return [{ id: message.id, result }];
    return [];
  };
}

/** The clock of the host's time zone, as the command prints a reset: `YYYY-MM-DD HH:MM`, written out here
 * by hand so the test does not call the function it checks. */
function localClock(seconds) {
  const date = new Date(seconds * 1000);
  const two = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** Runs the command with a fake server, capturing what it prints and its exit code. */
async function run(argv, fake, extra = {}) {
  const out = [];
  const err = [];
  const code = await codexMeterMain(argv, {
    spawn: fake.spawn,
    kill: fake.kill,
    timeoutMs: 2000,
    platform: 'linux',
    log: (text) => out.push(text),
    error: (text) => err.push(text),
    codexDebts: () => [],
    ...extra,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('the human form: a line for the five-hour window, one for the weekly, and the reset credits left; exit 0', async () => {
  const fake = fakeCodex(answering());
  const { code, out, err } = await run([], fake);
  assert.equal(code, 0, err);
  assert.equal(
    out,
    [
      `five-hour: 3% used, resets at ${localClock(1792839680)}`,
      `weekly: 8% used, resets at ${localClock(1793385515)}`,
      'reset credits left: 1',
      'Codex debts: none',
    ].join('\n'),
  );
});

test('--json prints the parsed numbers, and no account identifier; exit 0', async () => {
  const fake = fakeCodex(answering());
  const { code, out } = await run(['--json'], fake);
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), {
    fiveHour: { usedPercent: 3, resetsAt: 1792839680 },
    weekly: { usedPercent: 8, resetsAt: 1793385515 },
    resetCredits: 1,
    codexDebts: [],
  });
  assert.ok(!out.includes('acct-test-123'), 'no account identifier is printed');
});

test('a field the answer does not hold is printed as unknown, and the command still exits 0', async () => {
  const fake = fakeCodex(answering({ rateLimits: { primary: { usedPercent: 3 } } }));
  const { code, out } = await run([], fake);
  assert.equal(code, 0);
  assert.match(out, /^five-hour: 3% used, resets at unknown$/m);
  assert.match(out, /^weekly: unknown$/m);
  assert.match(out, /^reset credits left: unknown$/m);
});

test('no answer within the timeout: exit 1, one line saying so, and the process is killed', async () => {
  const fake = fakeCodex(() => []);
  const { code, err } = await run([], fake, { timeoutMs: 30 });
  assert.equal(code, 1);
  assert.match(err, /codex app-server did not answer within/);
  assert.equal(fake.killed.length, 1, 'the child is killed once');
});

test('codex is not on the PATH: exit 1 with the line that says so', async () => {
  const missing = Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' });
  const fake = fakeCodex(answering(), { spawnError: missing });
  const { code, err } = await run([], fake);
  assert.equal(code, 1);
  assert.match(err, /^codex is not on PATH: install the Codex CLI, then run this again\.$/m);
});

test('an error answer: exit 1 with one line that names the code', async () => {
  const fake = fakeCodex((message) => (message.method === 'initialize'
    ? [{ id: message.id, result: {} }]
    : [{ id: message.id, error: { code: -32000, message: 'not signed in' } }]));
  const { code, err } = await run([], fake);
  assert.equal(code, 1);
  assert.match(err, /codex app-server answered with an error \(code -32000\)\./);
});

test('an unknown argument: exit 2 with the usage, and codex is not started', async () => {
  const fake = fakeCodex(answering());
  const { code, err } = await run(['--plan'], fake);
  assert.equal(code, 2);
  assert.match(err, /--plan/);
  assert.ok(err.includes(USAGE), 'the usage is printed');
  assert.equal(fake.spawned.length, 0, 'no process is started for a usage error');
});

test('the usage line names the command and its two options', () => {
  assert.match(USAGE, /^Usage: js-harness codex-meter \[--json\] \[--per-pr\]$/m);
});

// Spec 6 of odd/tasks/codex-spend.md: --per-pr reads the records alone, so it needs no app-server.
const PER_PR = {
  prs: [{
    pr: 864, runs: 3, inputTokens: 230_174, cachedInputTokens: 150_000, days: ['2026-11-13', '2026-11-14'], failed: { runs: 0, inputTokens: 0 }, unnamed: { runs: 0, inputTokens: 0 },
    rereadOnly: { runs: 0, inputTokens: 0 }, rereadBeside: { runs: 0, inputTokens: 0, covered: 0, code: 0 }, rounds: { runs: 1, inputTokens: 69_498 },
    reviewedLines: 272, boughtInputTokens: 230_174, tokensPerLine: 846, coverageUnknown: 0,
  }],
  unattributed: Object.fromEntries(['pending', 'byNoLand', 'orphaned'].map((kind) => [kind, { runs: 0, inputTokens: 0, ids: [], list: [] }])),
  baseline: { prs: [864, 865, 866, 867, 868], runs: 3, inputTokens: 230_174, day: '2026-11-14', dayInputTokens: 110_158 },
  doubleReviews: { reads: 0, codexReads: 0, codexInputTokens: 0 },
};

test('--per-pr prints Codex input per landed PR from the records and starts no codex app-server; exit 0', async () => {
  const fake = fakeCodex(answering());
  const { code, out, err } = await run(['--per-pr'], fake, { perPr: () => PER_PR });
  assert.equal(code, 0, err);
  assert.equal(fake.spawned.length, 0, 'no app-server is started');
  assert.match(out, /^PR 864: 3 runs, 230,174 input tokens \(150,000 of them cached\) \(2026-11-13, 2026-11-14\); /m);
  assert.match(out, /^Baseline, PRs 864-868: 3 runs over all their days, 230,174 input tokens; of them on 2026-11-14 alone: 110,158$/m);
  assert.doesNotMatch(out, /five-hour|Codex debt/);
});

test('--per-pr --json prints the report as JSON; exit 0', async () => {
  const fake = fakeCodex(answering());
  const { code, out } = await run(['--json', '--per-pr'], fake, { perPr: () => PER_PR });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), PER_PR);
  assert.equal(fake.spawned.length, 0);
});

test('--per-pr exits 1 with one line when the records cannot be read', async () => {
  const fake = fakeCodex(answering());
  const { code, out, err } = await run(['--per-pr'], fake, { perPr: () => { throw new Error('EACCES'); } });
  assert.equal(code, 1);
  assert.equal(out, '');
  assert.match(err, /^could not read the records for Codex input per landed PR: EACCES$/m);
});

test('the Codex debts of the branch, the skips no Codex review has paid yet, are listed after the reading', async () => {
  const debt = 'unavailable abc1234..def5678: weekly limit at its floor: no';
  const listed = await run([], fakeCodex(answering()), { codexDebts: () => [debt] });
  assert.equal(listed.code, 0, listed.err);
  assert.ok(listed.out.split('\n').includes(`Codex debt: ${debt}`), listed.out);
  const json = await run(['--json'], fakeCodex(answering()), { codexDebts: () => [debt] });
  assert.deepEqual(JSON.parse(json.out).codexDebts, [debt]);
  const unknown = await run([], fakeCodex(answering()), { codexDebts: () => null });
  assert.match(unknown.out, /^Codex debts: unknown/m);
});

test('a read that fails still lists the Codex debts of the branch', async () => {
  const failing = fakeCodex(answering(), { spawnError: Object.assign(new Error('nope'), { code: 'ENOENT' }) });
  const { code, out } = await run([], failing, { codexDebts: () => ['unavailable abc1234..def5678: floor'] });
  assert.equal(code, 1);
  assert.ok(out.split('\n').includes('Codex debt: unavailable abc1234..def5678: floor'), out);
});

test('--json keeps standard output JSON when the read fails: the debts alone, and the exit 1', async () => {
  const failing = fakeCodex(answering(), { spawnError: Object.assign(new Error('nope'), { code: 'ENOENT' }) });
  const { code, out, err } = await run(['--json'], failing, { codexDebts: () => ['unavailable abc1234..def5678: floor'] });
  assert.equal(code, 1);
  assert.deepEqual(JSON.parse(out), { codexDebts: ['unavailable abc1234..def5678: floor'] });
  assert.match(err, /codex is not on PATH/);
});

// The production wiring of --per-pr (the lenses on 2e40eb81): the record files of a real throwaway repository, read
// through the run log's path, the land records, the admitted Codex records, git's default branch and reviewCoverage.
test('--per-pr reads the record files of the repository it runs in, and exits 1 when one cannot be read', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-per-pr-'));
  try {
    const data = (text) => `data ${Buffer.byteLength(text)}\n${text}`;
    const commit = (mark, ref, subject, from, merge) => [`commit ${ref}`, `mark :${mark}`, `committer T <t@example.com> ${1_700_000_000 + mark * 60} +0000`, data(subject),
      ...(from ? [`from :${from}`] : []), ...(merge ? [`merge :${merge}`] : []), `M 644 inline f${mark}.mjs`, data(`export const n = ${mark};`), ''].join('\n');
    const marks = path.join(os.tmpdir(), `${path.basename(repo)}.marks`);
    withoutAutoMaintenance(() => {
      assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0);
      const stream = [commit(1, 'refs/heads/main', 'm0'), commit(2, 'refs/heads/a', 'a1', 1), commit(5, 'refs/heads/a', 'a2', 2), commit(3, 'refs/remotes/origin/main', 'Merge pull request #1 from a', 1, 5), commit(4, 'refs/heads/open', 'p1', 3)].join('');
      const imported = spawnSync('git', ['fast-import', '--quiet', `--export-marks=${marks}`], { cwd: repo, input: stream, encoding: 'utf8' });
      assert.equal(imported.status, 0, imported.stderr);
    });
    const id = Object.fromEntries(fs.readFileSync(marks, 'utf8').trim().split('\n').map((line) => line.slice(1).split(' ')));
    fs.rmSync(marks, { force: true });
    const dir = path.join(repo, '.git', 'js-harness');
    fs.mkdirSync(dir);
    const write = (name, lines) => fs.writeFileSync(path.join(dir, name), `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
    const runLine = (runId, startedAt, from, head, inputTokens) => ({ schema: 'js-harness.codex-review-run/v1', id: runId, startedAt, durationMs: 1000, base: from, from, head, outcome: 'reviewed', usage: { inputTokens, cachedInputTokens: 400 }, coverage: { seen: 12, total: 12 }, findings: { total: 0 } });
    write('codex-review-runs.jsonl', [runLine('first', '2026-11-01T00:10:00Z', id[1], id[2], 1000), runLine('second', '2026-11-01T00:20:00Z', id[1], id[5], 1500), runLine('again', '2026-11-01T00:30:00Z', id[1], id[5], 2000), runLine('open', '2026-11-01T02:00:00Z', id[3], id[4], 50)]);
    const record = (run, head, reviewedAt) => ({ schema: 'js-harness.codex-review/v1', base: id[1], head, reviewedAt, outcome: 'reviewed', run });
    write('codex-reviews.jsonl', [record('first', id[2], '2026-11-01T00:11:00Z'), record('second', id[5], '2026-11-01T00:21:00Z'), record('again', id[5], '2026-11-01T00:31:00Z')]);
    write('lands.jsonl', [{ v: 1, startedAt: '2026-11-01T01:00:00Z', main: id[1], candidate: id[3], landed: [1], exit: 0 }]);
    write('double-reviews.jsonl', [{ kind: 'read', readers: [{ reader: 'codex', usage: { inputTokens: 77 } }] }]);
    const out = [];
    const err = [];
    const io = { cwd: repo, log: (text) => out.push(text), error: (text) => err.push(text) };
    assert.equal(await codexMeterMain(['--per-pr', '--json'], io), 0, err.join('\n'));
    const report = JSON.parse(out.join('\n'));
    const [pr] = report.prs;
    assert.deepEqual([pr.pr, pr.runs, pr.inputTokens, pr.cachedInputTokens, pr.reviewedLines], [1, 3, 4500, 1200, 24]);
    // The second run read a2 beside a1, which the first one's record, admitted by its run line, already covered;
    // the records written after it started (its own, the third run's) are not read for it, or it would be alone.
    const { runs, inputTokens, covered, code } = pr.rereadBeside;
    assert.deepEqual({ runs, inputTokens, covered, code }, { runs: 1, inputTokens: 1500, covered: 1, code: 2 });
    // The third run read a range the second one's record already covered.
    assert.deepEqual(pr.rereadOnly, { runs: 1, inputTokens: 2000 });
    assert.deepEqual(report.unattributed.pending.ids, ['open']);
    assert.equal(report.doubleReviews.codexInputTokens, 77);
    fs.rmSync(path.join(dir, 'lands.jsonl'));
    fs.mkdirSync(path.join(dir, 'lands.jsonl'));
    out.length = 0;
    assert.equal(await codexMeterMain(['--per-pr'], io), 1);
    assert.deepEqual(out, []);
    assert.match(err.at(-1), /^could not read the records for Codex input per landed PR: /);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
