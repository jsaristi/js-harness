import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claudeArgs, lensEnv, lensReviewMain, runLens } from './lens-review.mjs';
import { readLensReviews } from './lib/lens-reviews.mjs';
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
    assert.match(calls[0].command, /--system-prompt-file ("[^"]*js-harness-lens-[^"]*prompt\.md"|\S*js-harness-lens-\S*prompt\.md) --model/);
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
  const args = claudeArgs('prompt.txt');
  for (const flag of ['-p', '--safe-mode', '--no-session-persistence']) assert.ok(args.includes(flag), flag);
  assert.deepEqual(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2), ['--tools', '']);
  assert.deepEqual(args.slice(args.indexOf('--system-prompt-file'), args.indexOf('--system-prompt-file') + 2), ['--system-prompt-file', 'prompt.txt']);
  assert.deepEqual(args.slice(args.indexOf('--output-format'), args.indexOf('--output-format') + 2), ['--output-format', 'json']);
});
