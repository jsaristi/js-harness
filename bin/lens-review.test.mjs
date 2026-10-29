import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claudeArgs, LENS_ANSWER_KEPT, lensEnv, lensReviewMain, runLens } from './lens-review.mjs';
import { admittedLensReviews, readLensReviews, readLensRuns } from './lib/lens-reviews.mjs';
import { LENS_ANSWER_SCHEMA } from './lib/lens-result.mjs';
import { UNCLOSED_INSPECTION_STDOUT } from './lib/lens-review-answers.testkit.mjs';
import { withoutAutoMaintenance } from './lib/git-fixture.testkit.mjs';

let dir;
const git = (...args) => {
  const ran = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(ran.status, 0, `git ${args.join(' ')}: ${ran.stderr}`);
  return ran.stdout.trim();
};
const commit = (file, text, message) => {
  fs.writeFileSync(path.join(dir, file), text);
  git('add', '-A');
  git('commit', '-q', '-m', message);
};

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-review-'));
  withoutAutoMaintenance(() => {
    git('init', '-q', '--initial-branch=main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    commit('a.mjs', 'export const a = 1;\n', 'first');
    commit('a.mjs', 'export const a = 2;\n', 'second');
  });
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

/** A Claude CLI that answers each lens as `answer(lens, block)` says, in `--output-format json`'s shape. */
function fakeClaude(answer) {
  const calls = [];
  const runLens = ({ lens, prompt, block, env }) => {
    calls.push({ lens, prompt, block, env });
    const subject = JSON.parse(block.split('\n')[0].replace(/^\S+ /, ''));
    const result = answer(lens, subject);
    return { status: 0, durationMs: 1200, stdout: JSON.stringify({ type: 'result', is_error: false, result, total_cost_usd: 0.05, usage: { input_tokens: 10, cache_creation_input_tokens: 2000, cache_read_input_tokens: 0, output_tokens: 300 }, modelUsage: { 'claude-sonnet-5-5': {} } }) };
  };
  return { runLens, calls };
}
const clean = (lens, subject) => JSON.stringify({ subject_hash: subject.subject_hash, inspection: { status: 'completed', paths: ['a.mjs'] }, findings: [], evidence: [`${lens}: read a.mjs`] });

function run(argv, deps = {}) {
  const out = [];
  const err = [];
  const code = lensReviewMain([...argv, '--cwd', dir], { JS_HARNESS_EVAL_OAUTH_TOKEN: 'eval', PATH: process.env.PATH }, { stdout: (line) => out.push(line), stderr: (line) => err.push(line), ...deps });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('each picked lens runs once with its prompt and the block; every lens complete is one reviewed record', () => {
  const claude = fakeClaude(clean);
  const { code, out } = run(['--base', 'HEAD~1', '--lenses', 'risk,reliability', '--reason', 'changes a constant others read'], { runLens: claude.runLens });
  assert.equal(code, 0, out);
  assert.deepEqual(claude.calls.map((call) => call.lens), ['risk', 'reliability']);
  assert.match(claude.calls[0].prompt, /# Risk lens review/);
  assert.match(claude.calls[0].block, /^JS_HARNESS_LENS_SUBJECT /);
  const [rec] = readLensReviews(dir).slice(-1);
  assert.equal(rec.outcome, 'reviewed');
  assert.equal(rec.head, git('rev-parse', 'HEAD'));
  assert.deepEqual(rec.lenses, ['risk', 'reliability']);
  assert.equal(rec.lensReason, 'changes a constant others read');
  assert.deepEqual(rec.results.map((r) => [r.lens, r.outcome, r.inputTokens, r.outputTokens, r.costUsd, r.durationMs, r.model]), [
    ['risk', 'complete', 2010, 300, 0.05, 1200, 'claude-sonnet-5-5'],
    ['reliability', 'complete', 2010, 300, 0.05, 1200, 'claude-sonnet-5-5'],
  ]);
  assert.match(out, /reviewed/);
});

test('one incomplete lens makes the run incomplete: recorded, exit 1, and no review', () => {
  const claude = fakeClaude((lens, subject) => (lens === 'risk' ? 'Looks fine.' : clean(lens, subject)));
  const { code, err } = run(['--base', 'HEAD~1', '--lenses', 'risk,readability', '--reason', 'r'], { runLens: claude.runLens });
  assert.equal(code, 1);
  assert.match(err, /risk.*not one JSON object/);
  const [rec] = readLensReviews(dir).slice(-1);
  assert.equal(rec.outcome, 'incomplete');
  assert.deepEqual(rec.results.map((r) => r.outcome), ['incomplete', 'complete']);
  // What it answered is kept and shown, cut short, so why it failed can be read before it runs again (L10).
  assert.equal(rec.results[0].answered, 'Looks fine.');
  assert.match(err, /risk: incomplete, the answer is not one JSON object: it holds none; it answered: "Looks fine\."/);
});

test('an incomplete answer is kept on one line and cut at its first characters, never inside one', () => {
  const head = 'Here is my review. ';
  // A character of two UTF-16 units across the cut is kept whole or left out, never split.
  const long = `Here is my review.\n\n${'x'.repeat(LENS_ANSWER_KEPT - head.length - 1)}🙂${'y'.repeat(1000)}`;
  const claude = fakeClaude(() => long);
  const { code, err } = run(['--base', 'HEAD~1', '--lenses', 'risk', '--reason', 'r'], { runLens: claude.runLens });
  assert.equal(code, 1);
  const [rec] = readLensReviews(dir).slice(-1);
  const kept = `${head}${'x'.repeat(LENS_ANSWER_KEPT - head.length - 1)}🙂`;
  assert.equal(rec.results[0].answered, kept);
  assert.ok(err.split('\n').some((line) => line === `risk: incomplete, the answer is not one JSON object: it holds none; it answered: ${JSON.stringify(kept)}`), err);
});

// JH 75: three of JH 73's lenses answered an object that never closed, over a diff holding JSON in strings, and the
// 300 characters kept were the start of a well-formed result. The record now names a file holding what the CLI printed,
// whole, with why it stopped, so the next one is read rather than guessed.
test('an incomplete lens keeps what its CLI printed whole, in a file its record names, with why the answer stopped', () => {
  const quoting = (subject) => `{"subject_hash":"${subject.subject_hash}","inspection":{"status":"completed","paths":["a.mjs"]},"findings":[],"evidence":["put(root, 'b-case.json', '{\\"written\\":\\"again\\"}') rewrites a \\"kept\\" proof, and "a.mjs is read"]}`;
  const printed = [];
  const runLens = ({ lens, block }) => {
    const subject = JSON.parse(block.split('\n')[0].replace(/^\S+ /, ''));
    const result = lens === 'risk' ? quoting(subject) : clean(lens, subject);
    const stdout = JSON.stringify({ type: 'result', is_error: false, stop_reason: 'end_turn', result, usage: { output_tokens: 700 } });
    printed.push(stdout);
    return { status: 0, durationMs: 900, stdout };
  };
  const { code, err } = run(['--base', 'HEAD~1', '--lenses', 'risk,reliability', '--reason', 'r'], { runLens });
  assert.equal(code, 1);
  const [rec] = readLensReviews(dir).slice(-1);
  const [risk, reliability] = rec.results;
  assert.equal(risk.outcome, 'incomplete');
  assert.match(risk.why, /not closed \(it opens at character 0\): it breaks at character \d+, near "/);
  assert.equal(risk.stopReason, 'end_turn');
  assert.equal(path.basename(risk.answerFile), `${rec.run}-risk.stdout`);
  assert.equal(fs.readFileSync(risk.answerFile, 'utf8'), printed[0]);
  assert.match(err, /^risk: incomplete, the answer is not one JSON object/m);
  assert.ok(err.split('\n').includes(`  what its CLI printed is kept whole in ${risk.answerFile}`), err);
  // A complete lens keeps nothing beside its record.
  assert.equal(reliability.outcome, 'complete');
  assert.equal(reliability.answerFile, undefined);
});

test('a lens whose CLI printed no JSON keeps that output too; one that printed nothing keeps no file', () => {
  const outputs = { risk: 'Error: overloaded\n', readability: '' };
  const runLens = ({ lens }) => ({ status: 1, durationMs: 10, stdout: outputs[lens], stderr: 'failed' });
  assert.equal(run(['--base', 'HEAD~1', '--lenses', 'risk,readability', '--reason', 'r'], { runLens }).code, 1);
  const [risk, readability] = readLensReviews(dir).at(-1).results;
  assert.equal(fs.readFileSync(risk.answerFile, 'utf8'), 'Error: overloaded\n');
  assert.equal(readability.answerFile, undefined);
});

// Review finding R3-003: a write that fails is said and recorded, and the run keeps its record.
test('an output that cannot be kept is recorded as not kept, and the run still has its record', () => {
  const folder = path.join(git('rev-parse', '--absolute-git-dir'), 'js-harness', 'lens-answers');
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(folder), { recursive: true });
  fs.writeFileSync(folder, 'a file where the folder goes');
  try {
    const before = readLensReviews(dir).length;
    const claude = fakeClaude(() => 'Looks fine.');
    const { code, err } = run(['--base', 'HEAD~1', '--lenses', 'risk', '--reason', 'r'], { runLens: claude.runLens });
    assert.equal(code, 1);
    assert.equal(readLensReviews(dir).length, before + 1);
    const [risk] = readLensReviews(dir).at(-1).results;
    assert.equal(risk.answerFile, undefined);
    assert.match(risk.answerNotKept, /\S/);
    assert.ok(err.split('\n').includes(`  what its CLI printed could not be kept: ${risk.answerNotKept}`), err);
  } finally {
    fs.rmSync(folder, { force: true });
  }
});

// JH 76: with `--json-schema` the CLI prints the answer as `structured_output`, an object the host checked against the
// schema, beside `result`, the same object as text (odd/tasks/lens-review-structured-output.md, L2).
test('a lens answer is read from structured_output when the CLI gives it, whatever its result text holds', () => {
  const runLens = ({ lens, block }) => {
    const subject = JSON.parse(block.split('\n')[0].replace(/^\S+ /, ''));
    const structured = JSON.parse(clean(lens, subject));
    const result = lens === 'risk' ? '{"subject_hash":' : JSON.stringify(structured);
    return { status: 0, durationMs: 800, stdout: JSON.stringify({ type: 'result', is_error: false, stop_reason: 'tool_use', result, structured_output: structured, usage: { output_tokens: 200 } }) };
  };
  const { code, out } = run(['--base', 'HEAD~1', '--lenses', 'risk,readability', '--reason', 'r'], { runLens });
  assert.equal(code, 0, out);
  const [rec] = readLensReviews(dir).slice(-1);
  assert.deepEqual(rec.results.map((r) => [r.lens, r.outcome, r.evidence]), [['risk', 'complete', ['risk: read a.mjs']], ['readability', 'complete', ['readability: read a.mjs']]]);
});

// Review finding R3-fallback-guard-untested: only an object counts as structured output; anything else leaves the text.
test('a structured_output that is no object is passed over, and the answer is read from result', () => {
  const given = { risk: null, resilience: [], readability: 'text' };
  const runLens = ({ lens, block }) => {
    const subject = JSON.parse(block.split('\n')[0].replace(/^\S+ /, ''));
    return { status: 0, durationMs: 800, stdout: JSON.stringify({ type: 'result', is_error: false, result: clean(lens, subject), structured_output: given[lens] }) };
  };
  const { code, out } = run(['--base', 'HEAD~1', '--lenses', 'risk,resilience,readability', '--reason', 'r'], { runLens });
  assert.equal(code, 0, out);
  assert.deepEqual(readLensReviews(dir).at(-1).results.map((r) => [r.lens, r.outcome, r.evidence]), [
    ['risk', 'complete', ['risk: read a.mjs']],
    ['resilience', 'complete', ['resilience: read a.mjs']],
    ['readability', 'complete', ['readability: read a.mjs']],
  ]);
});

test('a structured_output the parse refuses is incomplete: the host checks the shape, the parse still decides', () => {
  const runLens = ({ lens }) => {
    const structured = { subject_hash: 'e'.repeat(64), inspection: { status: 'completed', paths: ['a.mjs'] }, findings: [], evidence: [`${lens}: read a.mjs`] };
    return { status: 0, durationMs: 800, stdout: JSON.stringify({ type: 'result', is_error: false, result: JSON.stringify(structured), structured_output: structured }) };
  };
  const { code, err } = run(['--base', 'HEAD~1', '--lenses', 'risk', '--reason', 'r'], { runLens });
  assert.equal(code, 1);
  const [risk] = readLensReviews(dir).at(-1).results;
  assert.equal(risk.outcome, 'incomplete');
  assert.match(risk.why, /subject_hash/);
  assert.match(err, /^risk: incomplete, its subject_hash/m);
});

// The fallback, for a CLI that gives no structured output: JH 73's readability answer, as its CLI printed it.
test("a CLI that gives no structured_output is read from result as before: JH 73's unclosed answer is refused and kept whole", () => {
  const runLens = () => ({ status: 0, durationMs: 6787, stdout: UNCLOSED_INSPECTION_STDOUT });
  const { code, err } = run(['--base', 'HEAD~1', '--lenses', 'readability', '--reason', 'r'], { runLens });
  assert.equal(code, 1);
  const [readability] = readLensReviews(dir).at(-1).results;
  assert.equal(readability.outcome, 'incomplete');
  assert.match(readability.why, /not closed \(it opens at character 0\): the answer ends before it closes$/);
  assert.equal(readability.stopReason, 'end_turn');
  assert.deepEqual([readability.outputTokens, readability.costUsd, readability.model], [842, 0.049128, 'claude-sonnet-5-5']);
  assert.equal(fs.readFileSync(readability.answerFile, 'utf8'), UNCLOSED_INSPECTION_STDOUT);
  assert.ok(err.split('\n').includes(`  what its CLI printed is kept whole in ${readability.answerFile}`), err);
});

test('a skip is recorded with its reason and runs no lens; a range with no code records nothing to review', () => {
  const claude = fakeClaude(clean);
  assert.equal(run(['--base', 'HEAD~1', '--unavailable', 'the plan is out of turns'], { runLens: claude.runLens }).code, 0);
  assert.equal(claude.calls.length, 0);
  const [skip] = readLensReviews(dir).slice(-1);
  assert.deepEqual([skip.outcome, skip.reason], ['unavailable', 'the plan is out of turns']);
  withoutAutoMaintenance(() => commit('notes.md', '# n\n', 'docs'));
  assert.equal(run(['--base', 'HEAD~1', '--lenses', 'risk', '--reason', 'r'], { runLens: claude.runLens }).code, 0);
  assert.equal(readLensReviews(dir).at(-1).outcome, 'nothing-to-review');
  assert.equal(claude.calls.length, 0);
  // Both name the run line the command wrote, so both are admitted (the verifier on e7bc4215).
  const { records, admitted } = admittedLensReviews(dir);
  assert.deepEqual(records.slice(-2).map(admitted), [true, true]);
});

// Row 3 of the reverse-engineering document, section 13.3: every record the command writes names the run
// line it wrote first, before any lens ran, so a check admits it, and a line written by hand names none.
test('each record names the run line the command wrote before any lens ran, so every outcome is admitted', () => {
  const seen = [];
  const claude = fakeClaude((lens, subject) => {
    seen.push(readLensRuns(dir).length);
    return lens === 'risk' ? clean(lens, subject) : 'Looks fine.';
  });
  const before = readLensRuns(dir).length;
  // From the first commit, so the range holds code whatever the tests before this one committed.
  const root = git('rev-list', '--max-parents=0', 'HEAD');
  assert.equal(run(['--base', root, '--lenses', 'risk', '--reason', 'r'], { runLens: claude.runLens }).code, 0);
  assert.equal(run(['--base', root, '--lenses', 'readability', '--reason', 'r'], { runLens: claude.runLens }).code, 1);
  assert.equal(run(['--base', root, '--unavailable', 'the plan is out of turns'], { runLens: claude.runLens }).code, 0);
  assert.deepEqual(seen, [before + 1, before + 2]);
  const runs = readLensRuns(dir).slice(before);
  const records = readLensReviews(dir).slice(-3);
  assert.deepEqual(records.map((rec) => rec.outcome), ['reviewed', 'incomplete', 'unavailable']);
  assert.deepEqual(records.map((rec) => rec.run), runs.map((line) => line.id));
  const { records: read, admitted } = admittedLensReviews(dir);
  assert.deepEqual(read.slice(-3).map(admitted), [true, false, true]);
});

test('--plan records nothing over a range with no code either, and does not go with --unavailable', () => {
  const before = readLensReviews(dir).length;
  const docs = run(['--base', 'HEAD~1', '--lenses', 'risk', '--reason', 'r', '--plan']);
  assert.equal(docs.code, 0);
  assert.match(docs.out, /nothing to review/i);
  assert.equal(run(['--base', 'HEAD~1', '--unavailable', 'out of turns', '--plan']).code, 2);
  assert.equal(readLensReviews(dir).length, before);
});

// The shim is found by its file on a Windows PATH, so the test runs where such a path is a path: the daily Windows suite.
test('a Claude CLI that is an npm shim runs as one quoted command line: the empty --tools value and the prompt path survive', { skip: process.platform !== 'win32' && 'a .cmd shim is found only on Windows' }, () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'lens shim '));
  try {
    fs.writeFileSync(path.join(bin, 'claude.cmd'), '');
    const calls = [];
    const spawn = (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0, stdout: '{}', stderr: '' };
    };
    runLens({ prompt: 'p', block: 'b', env: { PATH: bin } }, { spawn, platform: 'win32' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.shell, true);
    assert.equal(calls[0].options.input, 'b');
    assert.match(calls[0].command, /--tools "" /);
    // The path is quoted when it holds a space, as `quoteWindowsArg` quotes any argument.
    assert.match(calls[0].command, /--system-prompt-file ("[^"]*js-harness-lens-[^"]*prompt\.md"|\S*js-harness-lens-\S*prompt\.md) --settings /);
    assert.match(calls[0].command, /--settings ("[^"]*js-harness-lens-[^"]*settings\.json"|\S*js-harness-lens-\S*settings\.json) --model/);
    // The schema is one quoted argument, its quotes escaped as cmd.exe hands them to the CLI.
    assert.ok(calls[0].command.includes(`--json-schema "${JSON.stringify(LENS_ANSWER_SCHEMA).replaceAll('"', '\\"')}"`), calls[0].command);
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('--plan starts nothing and records nothing; a usage error is exit 2', () => {
  const before = readLensReviews(dir).length;
  const claude = fakeClaude(clean);
  const plan = run(['--base', 'HEAD~2', '--lenses', 'risk', '--reason', 'r', '--plan'], { runLens: claude.runLens });
  assert.equal(plan.code, 0);
  assert.match(plan.out, /1 path.*estimated/s);
  assert.equal(claude.calls.length, 0);
  assert.equal(readLensReviews(dir).length, before);
  for (const argv of [['--lenses', 'risk', '--reason', 'r'], ['--base', 'HEAD~1', '--reason', 'r'], ['--base', 'HEAD~1', '--lenses', 'risk'], ['--base', 'HEAD~1', '--lenses', 'style', '--reason', 'r'], ['--base', 'HEAD~1', '--lenses', 'risk,risk', '--reason', 'r'], ['--base', 'HEAD~1', '--bogus']]) {
    assert.equal(run(argv, { runLens: claude.runLens }).code, 2, argv.join(' '));
  }
});

test('a lens runs tool-less on the CLI login: no eval token, no API key, no customizations', () => {
  const env = lensEnv({ JS_HARNESS_EVAL_OAUTH_TOKEN: 'e', CLAUDE_CODE_OAUTH_TOKEN: 'o', ANTHROPIC_API_KEY: 'k', PATH: 'p' });
  assert.deepEqual(env, { PATH: 'p' });
  const args = claudeArgs('prompt.txt', 'settings.json');
  for (const flag of ['-p', '--safe-mode', '--no-session-persistence']) assert.ok(args.includes(flag), flag);
  const valueOf = (flag) => args.slice(args.indexOf(flag), args.indexOf(flag) + 2);
  assert.deepEqual(valueOf('--tools'), ['--tools', '']);
  assert.deepEqual(valueOf('--system-prompt-file'), ['--system-prompt-file', 'prompt.txt']);
  assert.deepEqual(valueOf('--output-format'), ['--output-format', 'json']);
  // The host enforces the answer's shape (JH 76, L2), and the user's language setting gives way to English (L3).
  assert.deepEqual(valueOf('--json-schema'), ['--json-schema', JSON.stringify(LENS_ANSWER_SCHEMA)]);
  assert.deepEqual(valueOf('--settings'), ['--settings', 'settings.json']);
});

test('a lens run hands the CLI a settings file that sets its language to English, and removes it after', () => {
  const calls = [];
  const spawn = (command, args) => {
    const file = args[args.indexOf('--settings') + 1];
    calls.push({ file, settings: JSON.parse(fs.readFileSync(file, 'utf8')) });
    return { status: 0, stdout: '{}', stderr: '' };
  };
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-bin-'));
  try {
    const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
    fs.writeFileSync(path.join(bin, exe), '');
    runLens({ prompt: 'p', block: 'b', env: { PATH: bin } }, { spawn });
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].settings, { language: 'English' });
  assert.equal(fs.existsSync(calls[0].file), false);
});
