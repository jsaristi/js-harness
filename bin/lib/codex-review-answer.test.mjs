import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  findingCounts, normalizeAnswer, REVIEW_ANSWER_SCHEMA, REVIEW_ANSWER_SCHEMA_VERSION, rolloutAnswer, validateAnswer,
} from './codex-review-answer.mjs';

// Every answer and every rollout file here is invented, in the shape read from one real lean review
// (codex-cli 0.160.1): no test reads a real Codex home.
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function fakeHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-answer-'));
  made.push(dir);
  return dir;
}

/** One finding as the rubric asks for it; `over` replaces or adds fields. */
const finding = (over = {}) => ({
  title: '[P1] Drops the last record',
  body: 'The loop stops one short, so the last line is never written.',
  confidence_score: 0.8,
  priority: 1,
  code_location: { absolute_file_path: '/repo/bin/x.mjs', line_range: { start: 3, end: 5 } },
  ...over,
});

// The answer of the one real run, which found nothing: no `overall_confidence_score` in it.
const NO_FINDINGS = { findings: [], overall_correctness: 'patch is correct', overall_explanation: 'Nothing in the diff breaks existing behaviour.' };
const WITH_FINDINGS = { findings: [finding()], overall_correctness: 'patch is incorrect', overall_explanation: 'One record is lost.', overall_confidence_score: 0.7 };

const errorsOf = (value) => {
  const result = validateAnswer(value);
  assert.equal(result.ok, false, JSON.stringify(value));
  assert.equal('answer' in result, false);
  return result.errors;
};

// --- the schema and its validator ---

test('the schema is versioned, and names the fields the rubric sends', () => {
  assert.equal(REVIEW_ANSWER_SCHEMA_VERSION, 'js-harness.codex-review-answer/v1');
  assert.equal(REVIEW_ANSWER_SCHEMA.$id, REVIEW_ANSWER_SCHEMA_VERSION);
  assert.deepEqual(REVIEW_ANSWER_SCHEMA.required, ['findings', 'overall_correctness', 'overall_explanation']);
  assert.deepEqual(REVIEW_ANSWER_SCHEMA.properties.overall_correctness.enum, ['patch is correct', 'patch is incorrect']);
  assert.deepEqual(REVIEW_ANSWER_SCHEMA.properties.findings.items.required, ['title', 'body', 'confidence_score', 'code_location']);
});

test('validateAnswer accepts the answer of a review that found nothing, with no overall confidence', () => {
  assert.deepEqual(validateAnswer(NO_FINDINGS), { ok: true, answer: NO_FINDINGS });
});

test('validateAnswer accepts findings, with the priority given, absent or null', () => {
  assert.deepEqual(validateAnswer(WITH_FINDINGS), { ok: true, answer: WITH_FINDINGS });
  const { priority, ...unranked } = finding();
  assert.equal(priority, 1);
  for (const one of [unranked, finding({ priority: null }), finding({ priority: 0 }), finding({ priority: 3 })]) {
    assert.equal(validateAnswer({ ...WITH_FINDINGS, findings: [one] }).ok, true, JSON.stringify(one));
  }
  assert.equal(validateAnswer({ ...WITH_FINDINGS, overall_confidence_score: null }).ok, true);
  // The bounds themselves are inside the range.
  assert.equal(validateAnswer({ ...WITH_FINDINGS, overall_confidence_score: 1, findings: [finding({ confidence_score: 0 })] }).ok, true);
});

test('validateAnswer lets through a field it does not know: a later CLI may add one', () => {
  const more = { ...WITH_FINDINGS, summary: 'new', findings: [finding({ category: 'logic' })] };
  assert.deepEqual(validateAnswer(more), { ok: true, answer: more });
});

test('validateAnswer does not hold a title to the 80 characters the rubric asks the model for', () => {
  assert.equal(validateAnswer({ ...WITH_FINDINGS, findings: [finding({ title: 'x'.repeat(200) })] }).ok, true);
});

test('validateAnswer: what is not an object is one error at the root', () => {
  for (const [value, got] of [[null, 'null'], [[], 'an array'], ['{}', 'a string'], [7, 'a number'], [undefined, 'nothing']]) {
    assert.deepEqual(errorsOf(value), [`answer: expected an object, got ${got}`]);
  }
});

test('validateAnswer names every missing field by its path', () => {
  assert.deepEqual(errorsOf({}), ['findings: is required', 'overall_correctness: is required', 'overall_explanation: is required']);
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, findings: [finding(), {}] }), [
    'findings[1].title: is required',
    'findings[1].body: is required',
    'findings[1].confidence_score: is required',
    'findings[1].code_location: is required',
  ]);
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, findings: [finding({ code_location: {} })] }), [
    'findings[0].code_location.absolute_file_path: is required',
    'findings[0].code_location.line_range: is required',
  ]);
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, findings: [finding({ code_location: { absolute_file_path: '/repo/x', line_range: { start: 3 } } })] }), [
    'findings[0].code_location.line_range.end: is required',
  ]);
});

test('validateAnswer says what was wrong with a value, and where', () => {
  const one = (over) => errorsOf({ ...WITH_FINDINGS, findings: [finding(over)] });
  assert.deepEqual(one({ title: 7 }), ['findings[0].title: expected a string, got a number']);
  assert.deepEqual(one({ title: '' }), ['findings[0].title: is empty']);
  assert.deepEqual(one({ body: null }), ['findings[0].body: expected a string, got null']);
  assert.deepEqual(one({ confidence_score: '0.8' }), ['findings[0].confidence_score: expected a number, got a string']);
  assert.deepEqual(one({ confidence_score: 1.5 }), ['findings[0].confidence_score: 1.5 is above 1']);
  assert.deepEqual(one({ confidence_score: -0.1 }), ['findings[0].confidence_score: -0.1 is below 0']);
  assert.deepEqual(one({ priority: 4 }), ['findings[0].priority: 4 is above 3']);
  assert.deepEqual(one({ priority: 1.5 }), ['findings[0].priority: expected an integer or null, got a number']);
  assert.deepEqual(one({ priority: 'P1' }), ['findings[0].priority: expected an integer or null, got a string']);
  assert.deepEqual(one({ code_location: 'bin/x.mjs:3' }), ['findings[0].code_location: expected an object, got a string']);
  assert.deepEqual(one({ code_location: { absolute_file_path: '', line_range: { start: 1, end: 1 } } }), ['findings[0].code_location.absolute_file_path: is empty']);
  assert.deepEqual(one({ code_location: { absolute_file_path: '/repo/x', line_range: { start: 0, end: '2' } } }), [
    'findings[0].code_location.line_range.start: 0 is below 1',
    'findings[0].code_location.line_range.end: expected an integer, got a string',
  ]);
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, findings: {} }), ['findings: expected an array, got an object']);
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, findings: ['x'] }), ['findings[0]: expected an object, got a string']);
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, overall_correctness: 'looks good' }), [
    'overall_correctness: expected "patch is correct" or "patch is incorrect", got "looks good"',
  ]);
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, overall_explanation: ['x'] }), ['overall_explanation: expected a string, got an array']);
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, overall_confidence_score: 85 }), ['overall_confidence_score: 85 is above 1']);
});

test('validateAnswer: a line range that ends before it starts is an error the schema alone cannot say', () => {
  const backwards = finding({ code_location: { absolute_file_path: '/repo/x', line_range: { start: 7, end: 3 } } });
  assert.deepEqual(errorsOf({ ...WITH_FINDINGS, findings: [backwards] }), ['findings[0].code_location.line_range: end 3 is before start 7']);
});

test('validateAnswer reports every error of an answer, in the order of the document', () => {
  assert.deepEqual(errorsOf({ findings: [finding({ title: 7 }), finding({ priority: 9 })], overall_correctness: 'yes' }), [
    'findings[0].title: expected a string, got a number',
    'findings[1].priority: 9 is above 3',
    'overall_correctness: expected "patch is correct" or "patch is incorrect", got "yes"',
    'overall_explanation: is required',
  ]);
});

// --- our own finding ---

test('normalizeAnswer: a finding becomes file, start, end, severity, title, body and confidence; the verdict is one word', () => {
  assert.deepEqual(normalizeAnswer(WITH_FINDINGS, { root: '/repo', platform: 'linux' }), {
    findings: [{
      file: 'bin/x.mjs', start: 3, end: 5, severity: 'P1', title: '[P1] Drops the last record',
      body: 'The loop stops one short, so the last line is never written.', confidence: 0.8,
    }],
    verdict: 'incorrect',
    explanation: 'One record is lost.',
    confidence: 0.7,
  });
  assert.deepEqual(normalizeAnswer(NO_FINDINGS, { root: '/repo', platform: 'linux' }), {
    findings: [], verdict: 'correct', explanation: 'Nothing in the diff breaks existing behaviour.', confidence: null,
  });
});

test('normalizeAnswer: the severity is P0 to P3, and null when the model gave no priority', () => {
  const { priority, ...unranked } = finding();
  assert.equal(priority, 1);
  const answer = { ...WITH_FINDINGS, findings: [finding({ priority: 0 }), finding({ priority: 2 }), finding({ priority: 3 }), unranked, finding({ priority: null })] };
  assert.deepEqual(normalizeAnswer(answer, { root: '/repo', platform: 'linux' }).findings.map((one) => one.severity), ['P0', 'P2', 'P3', null, null]);
});

test('normalizeAnswer: a file under the repository is named from its root, with forward slashes', () => {
  const fileOf = (file, root, platform) => normalizeAnswer(
    { ...WITH_FINDINGS, findings: [finding({ code_location: { absolute_file_path: file, line_range: { start: 1, end: 1 } } })] },
    { root, platform },
  ).findings[0].file;
  assert.equal(fileOf('/repo/bin/lib/x.mjs', '/repo', 'linux'), 'bin/lib/x.mjs');
  assert.equal(fileOf('/repo/bin/lib/x.mjs', '/repo/', 'darwin'), 'bin/lib/x.mjs');
  // On Windows git names the root with forward slashes, Codex the file with backslashes, and neither
  // the drive letter nor the folders have a case.
  assert.equal(fileOf('D:\\Work\\Repo\\bin\\lib\\x.mjs', 'D:/Work/Repo', 'win32'), 'bin/lib/x.mjs');
  assert.equal(fileOf('d:\\work\\repo\\bin\\X.mjs', 'D:\\Work\\Repo', 'win32'), 'bin/X.mjs');
  assert.equal(fileOf('D:/Work/Repo/bin/x.mjs', 'D:\\Work\\Repo\\', 'win32'), 'bin/x.mjs');
  // Elsewhere a path has a case, so another spelling is another folder.
  assert.equal(fileOf('/Repo/bin/x.mjs', '/repo', 'linux'), '/Repo/bin/x.mjs');
});

test('normalizeAnswer: a file outside the repository, or the root itself, is kept as it was given', () => {
  const fileOf = (file, root, platform) => normalizeAnswer(
    { ...WITH_FINDINGS, findings: [finding({ code_location: { absolute_file_path: file, line_range: { start: 1, end: 1 } } })] },
    { root, platform },
  ).findings[0].file;
  assert.equal(fileOf('/elsewhere/x.mjs', '/repo', 'linux'), '/elsewhere/x.mjs');
  assert.equal(fileOf('/repo-other/x.mjs', '/repo', 'linux'), '/repo-other/x.mjs');
  assert.equal(fileOf('/repo', '/repo', 'linux'), '/repo');
  assert.equal(fileOf('C:\\Other\\x.mjs', 'D:\\Work\\Repo', 'win32'), 'C:\\Other\\x.mjs');
  assert.equal(fileOf('D:\\Work\\Repository\\x.mjs', 'D:\\Work\\Repo', 'win32'), 'D:\\Work\\Repository\\x.mjs');
});

test('normalizeAnswer: a path the model gave relative is taken as from the root already', () => {
  const fileOf = (file, platform) => normalizeAnswer(
    { ...WITH_FINDINGS, findings: [finding({ code_location: { absolute_file_path: file, line_range: { start: 1, end: 1 } } })] },
    { root: platform === 'win32' ? 'D:\\Work\\Repo' : '/repo', platform },
  ).findings[0].file;
  assert.equal(fileOf('bin/x.mjs', 'linux'), 'bin/x.mjs');
  assert.equal(fileOf('bin\\lib\\x.mjs', 'win32'), 'bin/lib/x.mjs');
  // Off Windows a backslash is a character of the name.
  assert.equal(fileOf('bin\\x.mjs', 'linux'), 'bin\\x.mjs');
});

test('findingCounts: the total, and how many of each severity, with every key always there', () => {
  assert.deepEqual(findingCounts([]), { total: 0, bySeverity: { P0: 0, P1: 0, P2: 0, P3: 0, none: 0 } });
  const findings = [{ severity: 'P1' }, { severity: null }, { severity: 'P3' }, { severity: 'P1' }, { severity: 'P0' }];
  assert.deepEqual(findingCounts(findings), { total: 5, bySeverity: { P0: 1, P1: 2, P2: 0, P3: 1, none: 1 } });
  assert.deepEqual(Object.keys(findingCounts(findings).bySeverity), ['P0', 'P1', 'P2', 'P3', 'none']);
});

// --- the answer in the rollout file of the review's sub-agent ---

/** Writes a rollout file of `lines` (objects, or strings taken as they are) at `<home>/sessions/<...dirs>/<name>`. */
function rollout(home, name, lines, dirs = ['2026', '10', '07']) {
  const dir = path.join(home, 'sessions', ...dirs);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, `${lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n')}\n`, 'utf8');
  return file;
}

/** The first line of a thread's rollout file: `source` is `exec` for the parent thread and
 * `{ subagent: 'review' }` for the review's own. */
const sessionMeta = (source) => ({
  timestamp: '2026-10-07T03:20:23.000Z',
  type: 'session_meta',
  payload: { id: 't1', cwd: '/repo', originator: 'codex_exec', cli_version: '0.160.1', source, base_instructions: { text: 'the rubric' } },
});
const REVIEW_META = sessionMeta({ subagent: 'review' });
const PARENT_META = sessionMeta('exec');

/** A message of the model: `texts` are its content items, one `output_text` each. */
const assistant = (...texts) => ({
  timestamp: '2026-10-07T03:21:00.000Z',
  type: 'response_item',
  payload: { type: 'message', role: 'assistant', content: texts.map((text) => ({ type: 'output_text', text })) },
});
const user = (text) => ({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
const tokenCount = { type: 'event_msg', payload: { type: 'token_count', info: null } };
const taskComplete = { type: 'event_msg', payload: { type: 'task_complete' } };

const PARENT = 'rollout-2026-10-07T03-20-22-parent.jsonl';
const REVIEW = 'rollout-2026-10-07T03-20-23-review.jsonl';

test('rolloutAnswer reads the last message of the review sub-agent\'s session, not the parent thread\'s', () => {
  const home = fakeHome();
  // The parent ends with a message too: the review rendered as text, which is not the answer.
  rollout(home, PARENT, [PARENT_META, user('review this'), assistant('No actionable bugs were identified.'), taskComplete]);
  rollout(home, REVIEW, [REVIEW_META, user('Review the code changes'), tokenCount, assistant(JSON.stringify(WITH_FINDINGS, null, 2)), taskComplete]);
  assert.deepEqual(rolloutAnswer(home), { ok: true, answer: WITH_FINDINGS });
});

test('rolloutAnswer: of several messages of the model the last one is the answer', () => {
  const home = fakeHome();
  rollout(home, REVIEW, [REVIEW_META, assistant('I will read the diff first.'), tokenCount, assistant(JSON.stringify(NO_FINDINGS)), tokenCount, taskComplete]);
  assert.deepEqual(rolloutAnswer(home), { ok: true, answer: NO_FINDINGS });
});

test('rolloutAnswer: the text is every content item of the message joined, whatever their type', () => {
  const home = fakeHome();
  const text = JSON.stringify(NO_FINDINGS);
  const split = {
    type: 'response_item',
    payload: {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: text.slice(0, 20) }, { type: 'refusal' }, { type: 'text', text: text.slice(20) }, 'not an item', null],
    },
  };
  rollout(home, REVIEW, [REVIEW_META, split]);
  assert.deepEqual(rolloutAnswer(home), { ok: true, answer: NO_FINDINGS });
});

test('rolloutAnswer finds the review session at any depth, whatever the other files hold', () => {
  const home = fakeHome();
  rollout(home, PARENT, [PARENT_META, assistant(JSON.stringify(WITH_FINDINGS))], ['2026', '10', '06']);
  rollout(home, 'rollout-with-no-meta.jsonl', [assistant(JSON.stringify(WITH_FINDINGS))]);
  rollout(home, 'rollout-other-subagent.jsonl', [sessionMeta({ subagent: 'compact' }), assistant(JSON.stringify(WITH_FINDINGS))]);
  rollout(home, 'history.jsonl', [REVIEW_META, assistant(JSON.stringify(WITH_FINDINGS))]);
  rollout(home, REVIEW, [REVIEW_META, assistant(JSON.stringify(NO_FINDINGS))], ['2026', '10', '07', 'deeper']);
  assert.deepEqual(rolloutAnswer(home), { ok: true, answer: NO_FINDINGS });
});

test('rolloutAnswer: of two review sessions the later one by file name is read', () => {
  const home = fakeHome();
  rollout(home, 'rollout-2026-10-07T03-20-40-second.jsonl', [REVIEW_META, assistant(JSON.stringify(NO_FINDINGS))], ['2026', '10', '06']);
  rollout(home, 'rollout-2026-10-07T03-20-23-first.jsonl', [REVIEW_META, assistant(JSON.stringify(WITH_FINDINGS))], ['2026', '10', '07']);
  assert.deepEqual(rolloutAnswer(home), { ok: true, answer: NO_FINDINGS });
});

test('rolloutAnswer: with no session of the review sub-agent there is nothing to read, and it says so', () => {
  const none = fakeHome();
  const empty = fakeHome();
  fs.mkdirSync(path.join(empty, 'sessions'), { recursive: true });
  const parentOnly = fakeHome();
  rollout(parentOnly, PARENT, [PARENT_META, assistant(JSON.stringify(NO_FINDINGS))]);
  const noMeta = fakeHome();
  rollout(noMeta, REVIEW, [assistant(JSON.stringify(NO_FINDINGS))]);
  const outside = fakeHome();
  fs.writeFileSync(path.join(outside, REVIEW), `${JSON.stringify(REVIEW_META)}\n${JSON.stringify(assistant(JSON.stringify(NO_FINDINGS)))}\n`, 'utf8');
  for (const home of [none, empty, parentOnly, noMeta, outside]) assert.deepEqual(rolloutAnswer(home), { ok: false, reason: 'no-review-session' }, home);
});

test('rolloutAnswer: a review session the model never answered in has no answer', () => {
  const silent = fakeHome();
  rollout(silent, REVIEW, [REVIEW_META, user('Review the code changes'), tokenCount]);
  const blank = fakeHome();
  rollout(blank, REVIEW, [REVIEW_META, assistant(), taskComplete]);
  const spaces = fakeHome();
  rollout(spaces, REVIEW, [REVIEW_META, assistant('  \n'), taskComplete]);
  const noContent = fakeHome();
  rollout(noContent, REVIEW, [REVIEW_META, { type: 'response_item', payload: { type: 'message', role: 'assistant' } }]);
  for (const home of [silent, blank, spaces, noContent]) assert.deepEqual(rolloutAnswer(home), { ok: false, reason: 'no-answer' }, home);
});

test('rolloutAnswer: an answer that is not JSON is told apart from one that is off the schema', () => {
  const prose = fakeHome();
  rollout(prose, REVIEW, [REVIEW_META, assistant('No actionable bugs were identified in the changes.')]);
  assert.deepEqual(rolloutAnswer(prose), { ok: false, reason: 'not-json' });
  const braces = fakeHome();
  rollout(braces, REVIEW, [REVIEW_META, assistant('The object {x} is never closed }')]);
  assert.deepEqual(rolloutAnswer(braces), { ok: false, reason: 'not-json' });

  const off = fakeHome();
  rollout(off, REVIEW, [REVIEW_META, assistant(JSON.stringify({ findings: [finding({ priority: 7 })], overall_correctness: 'patch is correct' }))]);
  assert.deepEqual(rolloutAnswer(off), {
    ok: false,
    reason: 'off-schema',
    errors: ['findings[0].priority: 7 is above 3', 'overall_explanation: is required'],
  });
  const list = fakeHome();
  rollout(list, REVIEW, [REVIEW_META, assistant('[]')]);
  assert.deepEqual(rolloutAnswer(list), { ok: false, reason: 'off-schema', errors: ['answer: expected an object, got an array'] });
});

test('rolloutAnswer: JSON with text around it (a code fence, a sentence) is still read, as Codex itself reads it', () => {
  const fenced = fakeHome();
  rollout(fenced, REVIEW, [REVIEW_META, assistant(`\`\`\`json\n${JSON.stringify(WITH_FINDINGS, null, 2)}\n\`\`\`\n`)]);
  assert.deepEqual(rolloutAnswer(fenced), { ok: true, answer: WITH_FINDINGS });
  const led = fakeHome();
  rollout(led, REVIEW, [REVIEW_META, assistant(`Here is the review:\n${JSON.stringify(NO_FINDINGS)}`)]);
  assert.deepEqual(rolloutAnswer(led), { ok: true, answer: NO_FINDINGS });
});

test('rolloutAnswer: lines that are not JSON are skipped, so a last line cut short falls back to what came before', () => {
  const home = fakeHome();
  const cut = JSON.stringify(assistant(JSON.stringify(WITH_FINDINGS))).slice(0, 80);
  const file = rollout(home, REVIEW, ['', 'not json', REVIEW_META, '"a string"', '[1]', 'null', `${JSON.stringify(assistant(JSON.stringify(NO_FINDINGS)))}\r`, tokenCount]);
  // The last line is unterminated: Codex was killed while it wrote it.
  fs.appendFileSync(file, cut, 'utf8');
  assert.deepEqual(rolloutAnswer(home), { ok: true, answer: NO_FINDINGS });

  const onlyCut = fakeHome();
  fs.appendFileSync(rollout(onlyCut, REVIEW, [REVIEW_META]), cut, 'utf8');
  assert.deepEqual(rolloutAnswer(onlyCut), { ok: false, reason: 'no-answer' });
});

test('rolloutAnswer never throws: a home that is no path, a `sessions` that is a file, a rollout that is a folder', () => {
  for (const home of [undefined, null, '', 7, {}, ['x']]) assert.deepEqual(rolloutAnswer(home), { ok: false, reason: 'no-review-session' }, JSON.stringify(home));
  const file = fakeHome();
  fs.writeFileSync(path.join(file, 'sessions'), 'not a folder', 'utf8');
  assert.deepEqual(rolloutAnswer(file), { ok: false, reason: 'no-review-session' });
  const folder = fakeHome();
  fs.mkdirSync(path.join(folder, 'sessions', 'rollout-a-folder.jsonl'), { recursive: true });
  rollout(folder, REVIEW, [REVIEW_META, assistant(JSON.stringify(NO_FINDINGS))]);
  assert.deepEqual(rolloutAnswer(folder), { ok: true, answer: NO_FINDINGS });
});

test('rolloutAnswer: an empty home path reads nothing, and never the working directory', () => {
  const cwd = process.cwd();
  const here = fakeHome();
  rollout(here, REVIEW, [REVIEW_META, assistant(JSON.stringify(NO_FINDINGS))]);
  // This file's tests run one at a time in a process of their own, so the change is seen by no other.
  process.chdir(here);
  try {
    assert.deepEqual(rolloutAnswer(''), { ok: false, reason: 'no-review-session' });
  } finally {
    process.chdir(cwd);
  }
});
