import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { appendCodexReviewRun, codexReviewRunsPath, readCodexReviewRuns, runFindings, runKept, runPart, runPrompt, runSession, runSessionModel, partKey, keptPartFor, KEPT_PART_FORMAT, CODEX_REVIEW_RUN_SCHEMA } from './codex-review-runs.mjs';
import { appendCodexReview, codexReviewsPath, isValidCodexReview, readCodexReviews, CODEX_REVIEW_SCHEMA } from './codex-reviews.mjs';
import { repoTemplate } from './git-fixture.testkit.mjs';

// Real git in every test, isolated from the host's config like codex-reviews.test.mjs does.
let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-review-runs-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

/** The repository `makeRepo` hands out, built once and copied (`git-fixture.testkit.mjs`). */
const oneCommit = repoTemplate((root) => {
  git(root, 'init');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.writeFileSync(path.join(root, 'f.txt'), 'x', 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'init');
});

function makeRepo() {
  const root = tmp('js-harness-codex-review-runs-');
  oneCommit(root);
  return root;
}

const run = {
  schema: CODEX_REVIEW_RUN_SCHEMA,
  id: '00000000-0000-4000-8000-000000000001',
  startedAt: '2026-10-06T00:00:00.000Z',
  durationMs: 107000,
  base: 'a'.repeat(40),
  from: 'a'.repeat(40),
  head: 'b'.repeat(40),
  outcome: 'reviewed',
  cli: '0.160.0',
  model: null,
  effort: null,
  usage: { inputTokens: 297479, cachedInputTokens: 240640, outputTokens: 2396, reasoningOutputTokens: 703 },
  turns: 1,
  items: { agent_message: 1, command_execution: 6 },
  commands: { total: 6, failed: 0 },
  coverage: { seen: 2, total: 2 },
};

test('the schema of a run line is its own, apart from the review record\'s', () => {
  assert.equal(CODEX_REVIEW_RUN_SCHEMA, 'js-harness.codex-review-run/v1');
  assert.notEqual(CODEX_REVIEW_RUN_SCHEMA, CODEX_REVIEW_SCHEMA);
});

test('the run log lives in the git common dir beside the review record, so no file joins the working tree', () => {
  const root = makeRepo();
  const file = codexReviewRunsPath(root);
  assert.equal(path.basename(file), 'codex-review-runs.jsonl');
  assert.equal(path.dirname(file), path.dirname(codexReviewsPath(root)));
  assert.equal(fs.realpathSync(path.dirname(path.dirname(file))), fs.realpathSync(path.join(root, '.git')));
  appendCodexReviewRun(root, run);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('outside a git repository there is no run log path', () => {
  assert.equal(codexReviewRunsPath(tmp('js-harness-codex-review-runs-nongit-')), null);
});

test('append creates the js-harness dir, writes one JSON line per run in order, and returns the path it wrote', () => {
  const root = makeRepo();
  const file = appendCodexReviewRun(root, run);
  assert.equal(file, codexReviewRunsPath(root));
  const failed = { ...run, id: '00000000-0000-4000-8000-000000000002', outcome: 'failed', reason: 'it exited 1' };
  appendCodexReviewRun(root, failed);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[2], '');
  assert.deepEqual(JSON.parse(lines[0]), run);
  assert.deepEqual(Object.keys(JSON.parse(lines[0])), Object.keys(run), 'the fields keep the order they were given in');
  assert.deepEqual(readCodexReviewRuns(root), [run, failed]);
});

test('an append after an unterminated last line starts on a new line, so the new run survives', () => {
  const root = makeRepo();
  const file = appendCodexReviewRun(root, run);
  fs.appendFileSync(file, '{"schema":"js-harness.codex-review-run/v1","id":"dead', 'utf8');
  const later = { ...run, id: '00000000-0000-4000-8000-000000000003' };
  appendCodexReviewRun(root, later);
  assert.deepEqual(readCodexReviewRuns(root), [run, later]);
  assert.equal(fs.readFileSync(file, 'utf8').endsWith('\n'), true);
});

test('append outside a git repository throws instead of writing somewhere else', () => {
  assert.throws(() => appendCodexReviewRun(tmp('js-harness-codex-review-runs-nongit-'), run), /git/i);
});

test('reading with no file yet, or outside a git repository, gives an empty list', () => {
  assert.deepEqual(readCodexReviewRuns(makeRepo()), []);
  assert.deepEqual(readCodexReviewRuns(tmp('js-harness-codex-review-runs-nongit-')), []);
});

test('the reader skips blank and malformed lines without throwing', () => {
  const root = makeRepo();
  const file = appendCodexReviewRun(root, run);
  fs.appendFileSync(file, '\n   \nnot json\n{"truncated":\n"a string"\n[1]\nnull\n', 'utf8');
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-000000000004' });
  assert.deepEqual(readCodexReviewRuns(root).map((line) => line.id), [run.id, '00000000-0000-4000-8000-000000000004']);
});

test("a linked worktree shares the clone's one run log", () => {
  const root = makeRepo();
  const worktree = path.join(tmp('js-harness-codex-review-runs-wt-'), 'wt');
  git(root, 'worktree', 'add', worktree, '-b', 'other');
  appendCodexReviewRun(root, run);
  // Compare real paths: Windows may spell the same temp dir with a short or a long name.
  const dirOf = (r) => fs.realpathSync(path.dirname(codexReviewRunsPath(r)));
  assert.equal(dirOf(worktree), dirOf(root));
  assert.deepEqual(readCodexReviewRuns(worktree), [run]);
});

test('a caller that knows where the git folder is says so, and the run log is found, appended to and read with no git process', () => {
  const root = makeRepo();
  const file = codexReviewRunsPath(root);
  const none = () => {
    throw new Error('no git process is started');
  };
  const where = { commonGitDir: path.dirname(path.dirname(file)) };
  assert.equal(codexReviewRunsPath(root, { spawn: none, where }), file);
  assert.equal(appendCodexReviewRun(root, run, { spawn: none, where }), file);
  assert.deepEqual(readCodexReviewRuns(root, { spawn: none, where }), [run]);
  // Not said, git is asked as before: one process a call.
  let started = 0;
  const spawn = (cmd, args, opts) => {
    started += 1;
    return spawnSync(cmd, args, opts);
  };
  assert.deepEqual(readCodexReviewRuns(root, { spawn }), [run]);
  assert.equal(started, 1);
});

test('a run line is never evidence of a review: it is not a valid record, and the record file does not hold it', () => {
  const root = makeRepo();
  appendCodexReviewRun(root, run);
  assert.equal(isValidCodexReview(run), false);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.deepEqual(readCodexReviews(root), []);
});

test('deleting the one file undoes the run log and leaves the review record alone', () => {
  const root = makeRepo();
  const review = { schema: CODEX_REVIEW_SCHEMA, base: run.base, head: run.head, reviewedAt: '2026-10-06T00:01:47.000Z', outcome: 'reviewed', run: run.id };
  appendCodexReview(root, review);
  fs.rmSync(appendCodexReviewRun(root, run));
  assert.deepEqual(readCodexReviewRuns(root), []);
  assert.deepEqual(readCodexReviews(root), [review]);
  assert.equal(isValidCodexReview(review), true, 'a record that names its run is still a valid record');
});

test('runSession: a line written before the session was recorded reads as `current`, the only one there was', () => {
  assert.equal('session' in run, false, 'the fixture is a line as they were first written');
  assert.equal(runSession(run), 'current');
  assert.equal(runSession({ ...run, session: 'current' }), 'current');
  assert.equal(runSession({ ...run, session: 'lean' }), 'lean');
});

test('runSession: a session it does not know, or a line that is not one, reads as `current` too', () => {
  for (const session of ['fast', 'LEAN', '', null, 7, ['lean']]) assert.equal(runSession({ ...run, session }), 'current', JSON.stringify(session));
  for (const line of [null, undefined, 'lean', 7]) assert.equal(runSession(line), 'current', JSON.stringify(line));
});

test('runSession reads the log as it is: old lines and new ones side by side', () => {
  const root = makeRepo();
  appendCodexReviewRun(root, run);
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-000000000005', session: 'lean', model: 'gpt-fixture', effort: 'medium' });
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-000000000006', session: 'current' });
  assert.deepEqual(readCodexReviewRuns(root).map(runSession), ['current', 'lean', 'current']);
});

// What an attempt adds to its line once the model its session ran with is read from its rollout file.
const measured = { sessionModel: 'gpt-fixture', sessionEffort: 'low' };

test('runSessionModel: the model and the effort the session ran with, and null for every line that measured none', () => {
  assert.deepEqual(runSessionModel({ ...run, session: 'lean', model: 'gpt-fixture', effort: 'medium', ...measured }), { model: 'gpt-fixture', effort: 'low' });
  // A line written before the session's model was read: it has neither field, and what the command passed
  // (`model`, `effort`) is not what the session ran with.
  assert.equal('sessionModel' in run, false, 'the fixture is a line as they were first written');
  assert.equal(runSessionModel(run), null);
  assert.equal(runSessionModel({ ...run, session: 'lean', model: 'gpt-fixture', effort: 'medium' }), null);
  // The same of the `current` session, which the command names a model and an effort to since 2026-10-08
  // and which, as a person runs it, measures none: what was asked for is not read as what ran.
  assert.equal(runSessionModel({ ...run, session: 'current', model: 'gpt-fixture', effort: 'high', sessionModel: null, sessionEffort: null }), null);
  // A line of a session whose home held no such line: both are there, and `null`.
  assert.equal(runSessionModel({ ...run, sessionModel: null, sessionEffort: null }), null);
  // A session that named its model and no effort is measured, with an effort that is not known.
  assert.deepEqual(runSessionModel({ ...run, sessionModel: 'gpt-fixture', sessionEffort: null }), { model: 'gpt-fixture', effort: null });
  assert.deepEqual(runSessionModel({ ...run, sessionModel: 'gpt-fixture' }), { model: 'gpt-fixture', effort: null });
  // Only what the reader knows is given, so a field a later version adds is not handed on by accident.
  assert.deepEqual(Object.keys(runSessionModel({ ...run, ...measured, sessionSummary: 'auto' })), ['model', 'effort']);
});

test('runSessionModel: a model that is no name, or a line that is not one, reads as null; an effort that is no name is not known', () => {
  for (const sessionModel of ['', 7, true, ['gpt'], { name: 'gpt' }]) assert.equal(runSessionModel({ ...run, ...measured, sessionModel }), null, JSON.stringify(sessionModel));
  // An effort with no model beside it measures nothing: there is no session to say it of.
  assert.equal(runSessionModel({ ...run, sessionEffort: 'low' }), null);
  for (const sessionEffort of ['', 7, true, ['low']]) assert.deepEqual(runSessionModel({ ...run, ...measured, sessionEffort }), { model: 'gpt-fixture', effort: null }, JSON.stringify(sessionEffort));
  for (const line of [null, undefined, 'gpt-fixture', 7]) assert.equal(runSessionModel(line), null, JSON.stringify(line));
});

test('runSessionModel reads the log as it is: old lines and new ones side by side', () => {
  const root = makeRepo();
  appendCodexReviewRun(root, run);
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-00000000000c', session: 'lean', model: 'gpt-fixture', effort: 'medium', ...measured });
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-00000000000d', session: 'current', sessionModel: 'gpt-user', sessionEffort: 'high' });
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-00000000000e', session: 'current', sessionModel: null, sessionEffort: null });
  assert.deepEqual(readCodexReviewRuns(root).map(runSessionModel), [null, { model: 'gpt-fixture', effort: 'low' }, { model: 'gpt-user', effort: 'high' }, null]);
});

// What a lean attempt adds to its line once the review's answer is read as data.
const answered = {
  prompt: 'own',
  promptVersion: 'js-harness.codex-review-prompt/v1',
  findings: { total: 3, bySeverity: { P0: 0, P1: 2, P2: 0, P3: 0, none: 1 } },
  verdict: 'incorrect',
  answerSource: 'rollout',
};

test('runPrompt: a line written before the prompt was recorded reads as `codex`, the only one there was', () => {
  assert.equal('prompt' in run, false, 'the fixture is a line as they were first written');
  assert.equal(runPrompt(run), 'codex');
  assert.equal(runPrompt({ ...run, prompt: 'codex', promptVersion: null }), 'codex');
  assert.equal(runPrompt({ ...run, ...answered }), 'own');
});

test('runPrompt: a prompt it does not know, or a line that is not one, reads as `codex` too', () => {
  for (const prompt of ['mine', 'OWN', '', null, 7, ['own']]) assert.equal(runPrompt({ ...run, prompt }), 'codex', JSON.stringify(prompt));
  for (const line of [null, undefined, 'own', 7]) assert.equal(runPrompt(line), 'codex', JSON.stringify(line));
});

test('runFindings: the counts of a line whose answer was read, and null for every line that has none', () => {
  assert.deepEqual(runFindings({ ...run, ...answered }), answered.findings);
  assert.deepEqual(runFindings({ ...run, ...answered, prompt: 'codex', promptVersion: null }), answered.findings, 'the answer is read under either prompt');
  // A line written before the answer was read, and every `current` attempt since: no findings data, which
  // is not the same as a review that found nothing.
  assert.equal('findings' in run, false, 'the fixture is a line as they were first written');
  assert.equal(runFindings(run), null);
  assert.equal(runFindings({ ...run, prompt: 'codex', promptVersion: null, findings: null, verdict: null, answerSource: null }), null);
  assert.deepEqual(runFindings({ ...run, ...answered, findings: { total: 0, bySeverity: { P0: 0, P1: 0, P2: 0, P3: 0, none: 0 } } }).total, 0);
});

test('runFindings: counts that were read from no answer, or are not counts, read as null', () => {
  assert.equal(runFindings({ ...run, ...answered, answerSource: null }), null);
  assert.equal(runFindings({ ...run, findings: answered.findings }), null, 'a line that does not say where its counts came from');
  for (const findings of [null, undefined, 3, 'three', [], {}, { total: '3' }, { total: -1 }, { total: 1.5 }]) {
    assert.equal(runFindings({ ...run, ...answered, findings }), null, JSON.stringify(findings));
  }
  for (const line of [null, undefined, 'own', 7]) assert.equal(runFindings(line), null, JSON.stringify(line));
});

test('runPrompt and runFindings read the log as it is: old lines and new ones side by side', () => {
  const root = makeRepo();
  appendCodexReviewRun(root, run);
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-000000000007', session: 'lean', ...answered });
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-000000000008', session: 'lean', ...answered, outcome: 'failed', findings: null, verdict: null, answerSource: null });
  const runs = readCodexReviewRuns(root);
  assert.deepEqual(runs.map(runPrompt), ['codex', 'own', 'own']);
  assert.deepEqual(runs.map(runFindings), [null, answered.findings, null]);
});

// What the attempt of one part of a range reviewed in parts adds to its line.
const partOf = { index: 2, of: 3, files: 4, changedLines: 380 };

test('runPart: the part a line measured, and null for every line that measured a whole range', () => {
  assert.deepEqual(runPart({ ...run, session: 'lean', ...answered, part: partOf }), partOf);
  // A line written before a range was ever reviewed in parts, and every review of a whole range since:
  // neither has the field, and neither is a part.
  assert.equal('part' in run, false, 'the fixture is a line as they were first written');
  assert.equal(runPart(run), null);
  assert.equal(runPart({ ...run, session: 'lean', ...answered }), null);
  assert.equal(runPart({ ...run, part: null }), null);
  // Only what the reader knows is given, so a field a later version adds is not handed on by accident.
  assert.deepEqual(runPart({ ...run, part: { ...partOf, later: true } }), partOf);
  assert.deepEqual(runPart({ ...run, part: { index: 1, of: 2, files: 1, changedLines: 0 } }), { index: 1, of: 2, files: 1, changedLines: 0 }, 'a part of binary files alone');
});

test('runPart: a part that is not one, or a line that is not one, reads as null', () => {
  const bad = [
    'part 2 of 3', 2, [], {}, { index: 2, of: 3 },
    { ...partOf, index: 0 }, { ...partOf, index: 4 }, { ...partOf, index: '2' }, { ...partOf, index: 1.5 },
    { ...partOf, of: 0 }, { ...partOf, of: null }, { ...partOf, files: 0 }, { ...partOf, files: ['a.txt'] },
    { ...partOf, changedLines: -1 }, { ...partOf, changedLines: '380' },
  ];
  for (const part of bad) assert.equal(runPart({ ...run, part }), null, JSON.stringify(part));
  for (const line of [null, undefined, 'part', 7]) assert.equal(runPart(line), null, JSON.stringify(line));
});

test('runPart reads the log as it is: the lines of whole ranges and of parts side by side', () => {
  const root = makeRepo();
  appendCodexReviewRun(root, run);
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-000000000009', session: 'lean', ...answered, part: { ...partOf, index: 1 } });
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-00000000000a', session: 'lean', ...answered, outcome: 'not-inspected', part: partOf });
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-00000000000b', session: 'lean', ...answered });
  assert.deepEqual(readCodexReviewRuns(root).map(runPart), [null, { ...partOf, index: 1 }, partOf, null]);
});

// What a part that passed keeps, and the key that says whether a later run would send the same thing.
const parts = {
  base: 'a'.repeat(40), from: 'b'.repeat(40), head: 'c'.repeat(40),
  prompt: 'Review the range.', argv: ['exec', '--model', 'gpt-5', '-c', 'model_reasoning_effort=high'],
};
const keptKey = 'a'.repeat(64);
const keptLine = (over = {}) => ({
  id: 'r1', outcome: 'reviewed', part: { index: 1, of: 3, files: 2, changedLines: 40 },
  kept: { key: keptKey, review: { findings: [], verdict: 'correct', explanation: '', confidence: null }, rendered: 'No findings.' }, ...over,
});

test('partKey: the same inputs give the same key, a 64-character lowercase hex string', () => {
  assert.equal(partKey(parts), partKey({ ...parts }));
  assert.match(partKey(parts), /^[0-9a-f]{64}$/);
});

test('partKey: the key changes when any one of what was sent changes', () => {
  const baseKey = partKey(parts);
  const variants = {
    base: { ...parts, base: 'd'.repeat(40) },
    from: { ...parts, from: 'e'.repeat(40) },
    head: { ...parts, head: 'f'.repeat(40) },
    'prompt with one character added': { ...parts, prompt: `${parts.prompt}!` },
    'one element of argv': { ...parts, argv: parts.argv.map((arg, i) => (i === 1 ? 'gpt-5.1' : arg)) },
    'two elements of argv in another order': { ...parts, argv: [parts.argv[1], parts.argv[0], ...parts.argv.slice(2)] },
    'one more element in argv': { ...parts, argv: [...parts.argv, '--json'] },
  };
  for (const [what, variant] of Object.entries(variants)) assert.notEqual(partKey(variant), baseKey, what);
});

test('partKey: null when a field of what was sent is missing, empty or not a string, and a key when argv is empty', () => {
  for (const field of ['base', 'from', 'head', 'prompt']) {
    for (const value of [undefined, '', 42, null, ['a']]) {
      assert.equal(partKey({ ...parts, [field]: value }), null, `${field} ${JSON.stringify(value)}`);
    }
  }
  for (const argv of [undefined, 'exec', {}, null, 3, [1], ['exec', null], ['exec', ['x']]]) {
    assert.equal(partKey({ ...parts, argv }), null, `argv ${JSON.stringify(argv)}`);
  }
  assert.equal(partKey(), null);
  assert.equal(partKey(null), null);
  assert.match(partKey({ ...parts, argv: [] }), /^[0-9a-f]{64}$/);
});

test('partKey: the key is the SHA-256 of the format number and what was sent, so the format is inside it', () => {
  const sha = (format) => createHash('sha256')
    .update(JSON.stringify([format, parts.base, parts.from, parts.head, parts.prompt, parts.argv])).digest('hex');
  assert.equal(partKey(parts), sha(KEPT_PART_FORMAT));
  assert.notEqual(partKey(parts), sha(KEPT_PART_FORMAT + 1));
});

test('runKept: a valid kept gives its key, review and rendered, with the review the very same object', () => {
  const review = { findings: [], verdict: 'correct', explanation: 'Nothing breaks.', confidence: 0.9 };
  const kept = runKept(keptLine({ kept: { key: keptKey, review, rendered: '' } }));
  assert.deepEqual(kept, { key: keptKey, review, rendered: '' });
  assert.equal(kept.review, review);
  assert.equal(kept.review.confidence, 0.9);
});

test('runKept: null for a line that keeps no answer, or keeps one that is not valid', () => {
  const good = { key: keptKey, review: { findings: [], verdict: 'correct', explanation: '', confidence: null }, rendered: 'No findings.' };
  const bad = [
    { id: 'old', outcome: 'reviewed' },
    keptLine({ kept: null }),
    keptLine({ kept: { ...good, key: 'a'.repeat(63) } }),
    keptLine({ kept: { ...good, key: 'a'.repeat(65) } }),
    keptLine({ kept: { ...good, key: 'A'.repeat(64) } }),
    keptLine({ kept: { ...good, review: 'correct' } }),
    keptLine({ kept: { ...good, review: null } }),
    keptLine({ kept: { ...good, review: { ...good.review, findings: {} } } }),
    keptLine({ kept: { ...good, review: { verdict: 'correct', explanation: '', confidence: null } } }),
    keptLine({ kept: { ...good, review: { ...good.review, verdict: 'Correct' } } }),
    keptLine({ kept: { ...good, review: { ...good.review, verdict: 'pass' } } }),
    keptLine({ kept: { ...good, rendered: null } }),
    keptLine({ kept: { ...good, rendered: undefined } }),
    undefined,
    null,
    'a line',
  ];
  for (const line of bad) assert.equal(runKept(line), null, JSON.stringify(line));
});

test('runKept: null for a kept answer that lacks a field the command reads when it shows the answer again', () => {
  const finding = { file: 'a.txt', start: 2, end: 3, severity: 'P2', title: 'A title', body: 'A body.', confidence: 0.7 };
  const whole = { findings: [finding], verdict: 'incorrect', explanation: 'One line is wrong.', confidence: 0.8 };
  const kept = (review) => keptLine({ kept: { key: keptKey, review, rendered: 'One finding.' } });
  assert.notEqual(runKept(kept(whole)), null);
  // A finding the model gave no priority, and an answer it gave no confidence, are whole answers.
  assert.notEqual(runKept(kept({ ...whole, confidence: null, findings: [{ ...finding, severity: null }] })), null);
  const { explanation, ...noExplanation } = whole;
  const { confidence, ...noConfidence } = whole;
  const withFinding = (over) => ({ ...whole, findings: [{ ...finding, ...over }] });
  const lacking = [
    noExplanation,
    { ...whole, explanation: null },
    noConfidence,
    { ...whole, confidence: 'high' },
    { ...whole, findings: [null] },
    { ...whole, findings: ['a.txt:2'] },
    withFinding({ file: undefined }),
    withFinding({ start: '2' }),
    withFinding({ end: undefined }),
    withFinding({ title: undefined }),
    withFinding({ severity: 2 }),
    { ...whole, findings: [finding, { ...finding, title: null }] },
  ];
  for (const review of lacking) assert.equal(runKept(kept(review)), null, JSON.stringify(review));
  assert.equal(typeof explanation, 'string');
  assert.equal(typeof confidence, 'number');
});

test('keptPartFor: of two lines that hold the same key, the later one in the list is returned', () => {
  const older = keptLine({ id: 'older' });
  const newer = keptLine({ id: 'newer' });
  assert.equal(keptPartFor([older, newer], keptKey).id, 'newer');
  assert.equal(keptPartFor([newer, older], keptKey).id, 'older');
});

test('keptPartFor: a line is not taken when it did not review, has no part, has an invalid part, or keeps another key', () => {
  const other = { key: 'b'.repeat(64), review: { findings: [], verdict: 'correct', explanation: '', confidence: null }, rendered: '' };
  const refused = [
    keptLine({ outcome: 'failed' }),
    keptLine({ part: undefined }),
    keptLine({ part: { index: 3, of: 2, files: 1, changedLines: 1 } }),
    keptLine({ kept: other }),
  ];
  for (const line of refused) assert.equal(keptPartFor([line], keptKey), null, JSON.stringify(line));
  assert.equal(keptPartFor(refused, keptKey), null);
});

test('keptPartFor: null for an empty list, for runs that is not a list, and for a key that is not a string', () => {
  assert.equal(keptPartFor([], keptKey), null);
  for (const runs of [null, undefined, 'lines', { 0: keptLine() }]) assert.equal(keptPartFor(runs, keptKey), null);
  for (const key of [null, undefined]) assert.equal(keptPartFor([keptLine()], key), null);
});

test('keptPartFor reads a list as it is: older lines and parts without kept are passed over', () => {
  // The lines as they are written and read back: a JSON round trip, the same shape the log gives.
  const log = [
    { id: 'older', outcome: 'reviewed' },
    { id: 'part-no-kept', outcome: 'reviewed', part: { index: 1, of: 3, files: 2, changedLines: 40 } },
    keptLine({ id: 'with-key' }),
    { id: 'part-no-kept-after', outcome: 'reviewed', part: { index: 2, of: 3, files: 2, changedLines: 40 } },
  ];
  const runs = JSON.parse(JSON.stringify(log));
  assert.equal(keptPartFor(runs, keptKey).id, 'with-key');
});
