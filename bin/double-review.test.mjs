import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { doubleReviewMain, parseArgs, readerModel, SKIP_PHRASE } from './double-review.mjs';
import { readDoubleReviews } from './lib/double-review-records.mjs';
import { readCodexReviews } from './lib/codex-reviews.mjs';
import { ruleHere } from './lib/rules.mjs';

const finding = (claim) => ({ severity: 'high', claim, evidence: 'plan.md:1', fix: 'fix it' });

function makeRepo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-double-review-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(root, 'plan.md'), '# The plan\n\nDo the thing.\n');
  git('add', '.');
  git('commit', '-q', '-m', 'one');
  fs.writeFileSync(path.join(root, 'plan.md'), '# The plan\n\nDo the thing, twice.\n');
  git('commit', '-q', '-am', 'two');
  return root;
}

/** A fake `spawn`: each child reads its prompt on stdin and answers as `answer(command, args, prompt)` says, after
 * both children have started, so a test sees whether the two were started at once. */
function fakeSpawn(answer) {
  const calls = [];
  const spawn = (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    let prompt = '';
    child.stdin.on('data', (chunk) => { prompt += chunk; });
    const call = { command, args, options, startedBefore: calls.length };
    calls.push(call);
    child.stdin.on('finish', () => setTimeout(() => {
      call.prompt = prompt;
      call.startedWhenAnswering = calls.length;
      const { stdout = '', status = 0, file } = answer(command, args, prompt);
      if (file) fs.writeFileSync(file.path, file.text);
      child.stdout.end(stdout);
      child.stderr.end('');
      setImmediate(() => child.emit('close', status));
    }, 5));
    return child;
  };
  return { spawn, calls };
}

const hashIn = (prompt) => /inputHash to "([0-9a-f]{64})"/.exec(prompt)?.[1];
const claudeOut = (prompt, findings, hash = hashIn(prompt)) =>
  JSON.stringify({ structured_output: { inputHash: hash, findings, sound: ['the order'], unchecked: [] }, usage: { input_tokens: 10, cache_read_input_tokens: 90, output_tokens: 5 }, total_cost_usd: 0.5 });
const codexAnswer = (args, prompt, findings, hash = hashIn(prompt)) => ({
  stdout: `${JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 70, output_tokens: 7 } })}\n`,
  file: { path: args[args.indexOf('-o') + 1], text: JSON.stringify({ inputHash: hash, findings, sound: [], unchecked: ['the meter'] }) },
});

function deps(t, root, spawn, extra = {}) {
  const lines = { log: [], error: [] };
  const leanParent = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-double-review-lean-'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-double-review-tmp-'));
  t.after(() => fs.rmSync(leanParent, { recursive: true, force: true }));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const disposed = [];
  return {
    lines,
    disposed,
    tmp,
    deps: {
      log: (line) => lines.log.push(line),
      error: (line) => lines.error.push(line),
      spawn,
      platform: 'linux',
      tmpdir: () => tmp,
      now: () => new Date('2026-10-31T17:00:00Z'),
      id: () => 'read-1',
      resolveClaude: () => ({ path: '/bin/claude', shell: false }),
      makeLeanHome: () => {
        const home = fs.mkdtempSync(path.join(leanParent, 'home-'));
        return { home, dispose: () => disposed.push(home) };
      },
      cwd: root,
      ...extra,
    },
  };
}

test('parseArgs refuses an unknown argument, a missing verb, a take with no --taken and a skip without the user\'s words', () => {
  assert.throws(() => parseArgs(['read', 'a.md', '--bogus']), /unknown argument: --bogus/);
  assert.throws(() => parseArgs([]), /a verb is needed/);
  assert.throws(() => parseArgs(['--bogus']), /^Error: unknown argument: --bogus$/);
  assert.throws(() => parseArgs(['review']), /not a verb: review/);
  assert.throws(() => parseArgs(['take', 'r1', 'claude']), /--taken/);
  assert.throws(() => parseArgs(['take', 'r1', 'gemini', '--taken', '1']), /not a reader: gemini/);
  assert.throws(() => parseArgs(['skip', '--what', 'the plan']), /skip needs --words/);
  assert.throws(() => parseArgs(['tally', '--since', 'yesterday']), /YYYY-MM-DD/);
  assert.deepEqual(parseArgs(['take', 'r1', 'codex', '--taken', '1,3', '--shared', '3']).taken, [1, 3]);
});

test('a usage error exits 2 with the one line and the usage, and starts nothing', async (t) => {
  const root = makeRepo(t);
  const { spawn, calls } = fakeSpawn(() => ({}));
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md', '--bogus'], {}, run.deps), 2);
  assert.match(run.lines.error[0], /^unknown argument: --bogus\n\nUsage: js-harness double-review/);
  assert.equal(calls.length, 0);
});

test('--plan says what a read costs and the user\'s words that skip it, and starts and records nothing', async (t) => {
  const root = makeRepo(t);
  const { spawn, calls } = fakeSpawn(() => ({}));
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md', '--plan'], {}, run.deps), 0);
  const said = run.lines.log.join('\n');
  assert.match(said, /Claude reader on opus and a Codex reader/, 'a project that does not declare the reader model reads on its alias');
  assert.match(said, /tokens/);
  assert.ok(said.includes(SKIP_PHRASE));
  assert.equal(calls.length, 0);
  assert.deepEqual(readDoubleReviews(root), []);
});

test('in this repository the Claude reader runs on the model its rule sets', () => {
  const repo = path.resolve(import.meta.dirname, '..');
  assert.equal(readerModel(repo), ruleHere('subagent-reader-model', undefined, fs.readFileSync(path.join(repo, 'bin', 'lib', 'rules-data.mjs'), 'utf8')).value);
});

test('read starts both readers at once on one frozen copy outside the repository, blind, and records both once both return', async (t) => {
  const root = makeRepo(t);
  let copied = null;
  const { spawn, calls } = fakeSpawn((command, args, prompt) => {
    if (command === 'codex') return codexAnswer(args, prompt, [finding('codex one')]);
    copied = fs.readFileSync(path.join(args[args.indexOf('--add-dir') + 1], '1-plan.md'), 'utf8');
    return { stdout: claudeOut(prompt, [finding('claude one'), finding('claude two')]) };
  });
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md', '--diff', 'HEAD~1'], {}, run.deps), 0);

  const [claude, codex] = [calls.find((c) => c.command !== 'codex'), calls.find((c) => c.command === 'codex')];
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.startedWhenAnswering === 2), 'each reader answered only after both had started');
  assert.equal(claude.prompt, codex.prompt, 'both readers get the same prompt');
  const material = claude.args[claude.args.indexOf('--add-dir') + 1];
  const fromRoot = path.relative(root, material);
  assert.ok(fromRoot.startsWith('..') || path.isAbsolute(fromRoot), 'the copy is outside the repository');
  assert.ok(claude.prompt.includes(path.join(material, '1-plan.md')));
  assert.match(copied, /twice/, 'the copy is of the file as it stands');
  assert.match(claude.prompt, /diff\.patch/);
  assert.equal(claude.options.cwd, root);
  assert.deepEqual(claude.args.slice(0, 4), ['-p', '--safe-mode', '--tools', 'Read,Grep,Glob']);
  const answerFile = codex.args[codex.args.indexOf('-o') + 1];
  assert.ok(!claude.prompt.includes(path.dirname(answerFile)), 'no prompt names where an answer is written');
  assert.ok(codex.args.includes('--ignore-user-config'), 'Codex runs in the lean session of codex-review');
  assert.ok(run.disposed.length === 1, 'the lean Codex home is disposed');

  const [record] = readDoubleReviews(root);
  assert.equal(record.kind, 'read');
  assert.equal(record.id, 'read-1');
  assert.deepEqual(record.files, ['plan.md']);
  assert.equal(record.diff, 'HEAD~1');
  assert.equal(record.hash, hashIn(claude.prompt));
  assert.deepEqual(record.readers.map((one) => [one.reader, one.outcome, one.findings.length]), [['claude', 'answered', 2], ['codex', 'answered', 1]]);
  assert.deepEqual(record.readers[0].usage, { inputTokens: 100, outputTokens: 5 });
  assert.deepEqual(record.readers[1].usage, { inputTokens: 70, outputTokens: 7 });
  assert.deepEqual(readCodexReviews(root), [], 'a read covers no code');
  assert.ok(!fs.existsSync(material), 'the frozen copy is removed once recorded');
  assert.match(run.lines.log.join('\n'), /double-review take read-1 claude --taken/);
});

test('a reader that does not echo the material\'s hash did not read it: the read is recorded as failed for it, exit 1', async (t) => {
  const root = makeRepo(t);
  const { spawn } = fakeSpawn((command, args, prompt) =>
    command === 'codex' ? codexAnswer(args, prompt, [finding('codex one')], 'f'.repeat(64)) : { stdout: claudeOut(prompt, []) });
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md'], {}, run.deps), 1);
  const [record] = readDoubleReviews(root);
  assert.deepEqual(record.readers.map((one) => one.outcome), ['answered', 'failed']);
  assert.match(record.readers[1].reason, /hash/);
});

test('a read whose record cannot be written still prints what both readers found, and exits 1', async (t) => {
  const root = makeRepo(t);
  fs.writeFileSync(path.join(root, '.git', 'js-harness'), 'a file where the record folder goes\n');
  const { spawn } = fakeSpawn((command, args, prompt) =>
    command === 'codex' ? codexAnswer(args, prompt, [finding('codex one')]) : { stdout: claudeOut(prompt, [finding('claude one')]) });
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'plan.md'], {}, run.deps), 1);
  const said = run.lines.log.join('\n');
  assert.match(said, /claude 1\. \[high\] claude one/);
  assert.match(said, /codex 1\. \[high\] codex one/);
  assert.match(run.lines.error.join('\n'), /could not be recorded/);
});

test('a missing file is refused before anything starts', async (t) => {
  const root = makeRepo(t);
  const { spawn, calls } = fakeSpawn(() => ({}));
  const run = deps(t, root, spawn);
  assert.equal(await doubleReviewMain(['read', 'nope.md'], {}, run.deps), 1);
  assert.match(run.lines.error.join('\n'), /nope\.md/);
  assert.equal(calls.length, 0);
});

test('take records which findings the writer took and which the other reader also found, and tally counts them', async (t) => {
  const root = makeRepo(t);
  const { spawn } = fakeSpawn((command, args, prompt) =>
    command === 'codex' ? codexAnswer(args, prompt, [finding('c1'), finding('c2')]) : { stdout: claudeOut(prompt, [finding('a1')]) });
  const run = deps(t, root, spawn);
  await doubleReviewMain(['read', 'plan.md'], {}, run.deps);
  assert.equal(await doubleReviewMain(['take', 'read-1', 'codex', '--taken', '3'], {}, run.deps), 1, 'codex gave two findings');
  assert.equal(await doubleReviewMain(['take', 'read-9', 'codex', '--taken', '1'], {}, run.deps), 1, 'no such read');
  assert.equal(await doubleReviewMain(['take', 'read-1', 'codex', '--taken', '1,2', '--shared', '2', '--why', 'both sound'], {}, run.deps), 0);
  assert.equal(await doubleReviewMain(['take', 'read-1', 'claude', '--taken', 'none'], {}, run.deps), 0);
  const takes = readDoubleReviews(root).filter((entry) => entry.kind === 'take');
  assert.deepEqual(takes.map((entry) => [entry.reader, entry.taken, entry.shared]), [['codex', [1, 2], [2]], ['claude', [], []]]);
  run.lines.log.length = 0;
  assert.equal(await doubleReviewMain(['tally'], {}, run.deps), 0);
  assert.deepEqual(run.lines.log, [
    'claude: 1 read, 1 finding, 1 judged, 0 taken, 0 found by it alone',
    'codex: 1 read, 2 findings, 2 judged, 2 taken, 1 found by it alone',
  ]);
});

test('skip records the user\'s words that skip a read, with where they are read', async (t) => {
  const root = makeRepo(t);
  const run = deps(t, root, fakeSpawn(() => ({})).spawn);
  const argv = ['skip', '--what', 'the plan of JH 130', '--words', 'no quiero la revisión de este', '--transcript', '0f71b2c6', '--line', '44300'];
  assert.equal(await doubleReviewMain(argv, {}, run.deps), 0);
  const [skip] = readDoubleReviews(root);
  assert.deepEqual([skip.kind, skip.what, skip.words, skip.transcript, skip.line], ['skip', 'the plan of JH 130', 'no quiero la revisión de este', '0f71b2c6', 44300]);
});

test('tally with no read says so', async (t) => {
  const root = makeRepo(t);
  const run = deps(t, root, fakeSpawn(() => ({})).spawn);
  assert.equal(await doubleReviewMain(['tally', '--since', '2026-11-01'], {}, run.deps), 0);
  assert.deepEqual(run.lines.log, ['no double review read since 2026-11-01']);
});
