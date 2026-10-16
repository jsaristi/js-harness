// The rows of the gate that read harness.json "functions" (odd/tasks/on-demand-functions.md, slice 3): the
// switches validated at every commit, and a clone that is not what its switches ask said so. The rest of the
// gate is check.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkFunctions, checkFunctionsPending } from './check.mjs';
import { applyProjectFunctions } from './lib/project.mjs';
import { repoTemplate } from './lib/git-fixture.testkit.mjs';

// Every git call here is real: not the host's configuration, nor the repository of a commit's hook.
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-check-functions-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

/** What `git init` makes, made once and copied (`lib/git-fixture.testkit.mjs`): every empty repository here is the same. */
const emptyRepo = repoTemplate((root) => {
  assert.equal(spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' }).status, 0);
});

function repo(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-check-functions-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  emptyRepo(root);
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}

/** Real git; a fake `codegraph` that makes `.codegraph` as the real one does. */
function fakeCodegraph(cmd, args, opts) {
  if (cmd === 'git') return spawnSync('git', args, opts);
  fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
  return { status: 0, stdout: '', stderr: '' };
}

test('a switch that cannot be read fails the gate, with its reason', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', 'harness.json': '{ "functions": { "codexReview": "no" } }\n' });
  assert.deepEqual(checkFunctions(root), [
    {
      name: 'functions',
      pass: false,
      detail: 'harness.json "functions"."codexReview" must be one of "auto", "on", "off"; it is "no"',
      lines: ['until it is fixed every switch is read as on; js-harness functions shows each'],
    },
  ]);
});

test('a harness.json that is no JSON is the sensors row to say, not this one: one fault, one row', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', 'harness.json': '{ not json\n' });
  assert.deepEqual(checkFunctions(root), []);
});

test('the validation row asks git nothing: a gate whose static row fails stops before any git', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', 'harness.json': '{ "functions": { "codexReview": "no" } }\n' });
  const asked = [];
  const spawn = (cmd, args, opts) => {
    asked.push([cmd, ...args].join(' '));
    return spawnSync(cmd, args, opts);
  };
  assert.equal(checkFunctions(root, { spawn })[0].pass, false);
  assert.deepEqual(asked, []);
});

test('a clone that is what its switches ask adds no row', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', 'harness.json': '{}\n' });
  assert.equal(applyProjectFunctions(root, '0.1.0', { spawn: fakeCodegraph, platform: 'linux' }).code, 0);
  assert.deepEqual(checkFunctions(root), []);
  assert.deepEqual(checkFunctionsPending(root), []);
});

test('a clone the harness never set up is told nothing: it holds no manifest to drift from', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', 'harness.json': '{}\n' });
  assert.deepEqual(checkFunctionsPending(root), []);
});

test('a clone that is not what its switches ask is told so, one line a difference, and the gate passes', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', 'harness.json': '{}\n' });
  assert.equal(applyProjectFunctions(root, '0.1.0', { spawn: fakeCodegraph, platform: 'linux' }).code, 0);
  // What `functions apply` made is gone again: the index, the keys, the push check.
  fs.rmSync(path.join(root, '.codegraph'), { recursive: true, force: true });
  fs.rmSync(path.join(root, '.claude', 'settings.local.json'), { force: true });
  fs.rmSync(path.join(root, '.git', 'hooks', 'pre-push'), { force: true });
  const [row] = checkFunctionsPending(root);
  assert.equal(row.name, 'functions');
  assert.equal(row.pass, true);
  assert.equal(row.info, true);
  assert.equal(row.detail, 'this clone is not what its switches ask: js-harness functions apply makes it so');
  assert.deepEqual(row.lines, [
    'codeMap on-demand: no code map index here (.codegraph)',
    'codeMap on-demand: .claude/settings.local.json#/env/CODEGRAPH_NO_PROMPT_HOOK is not "1"',
    'languageServer off: .claude/settings.local.json#/enabledPlugins/typescript-lsp@claude-plugins-official is not false',
    'codexReview on: no push check in the pre-push hook',
  ]);
});

test('a key the harness wrote that a switch no longer wants is a difference too', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', 'harness.json': '{}\n' });
  applyProjectFunctions(root, '0.1.0', { spawn: fakeCodegraph, platform: 'linux' });
  fs.writeFileSync(path.join(root, 'harness.json'), '{ "functions": { "languageServer": "on" } }\n');
  const [row] = checkFunctionsPending(root);
  assert.deepEqual(row.lines, [
    'languageServer on: .claude/settings.local.json#/enabledPlugins/typescript-lsp@claude-plugins-official is still false',
  ]);
});

test('a pre-push hook of the project own counts as the push check', (t) => {
  const root = repo(t, { 'bin/a.mjs': '', 'harness.json': '{}\n' });
  applyProjectFunctions(root, '0.1.0', { spawn: fakeCodegraph, platform: 'linux' });
  fs.rmSync(path.join(root, '.codegraph'), { recursive: true, force: true });
  fs.writeFileSync(path.join(root, '.git', 'hooks', 'pre-push'), '#!/bin/sh\njs-harness check --push\n');
  const [row] = checkFunctionsPending(root);
  assert.ok(!row.lines.some((line) => line.startsWith('codexReview')));
});

// --- the Codex rows read the switch (S4, S6, S9) ---

const git = (root, ...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

/** A repository with a first commit of code, which `origin/main` names, and `origin` configured. */
function pushed(t, files = { 'bin/a.mjs': 'x\n' }) {
  const root = repo(t, files);
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'test');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'first');
  git(root, 'remote', 'add', 'origin', path.join(root, 'no-such-remote'));
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return root;
}

function commit(root, files) {
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, name), text);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'next');
  return git(root, 'rev-parse', '--short', 'HEAD');
}

test('the push row passes with the review off at the pushed tip, before any remote is resolved', async (t) => {
  const { checkCodexReviews } = await import('./check.mjs');
  const root = repo(t, { 'bin/a.mjs': 'x\n', 'harness.json': '{ "functions": { "codexReview": "off" } }\n' });
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'test');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'first');
  // No remote at all: with the review on, this row fails for it.
  assert.deepEqual(checkCodexReviews(root, 'HEAD', { remote: 'origin' }), {
    name: 'codex-review',
    pass: true,
    detail: 'the Codex review is off at the pushed commit (declared in harness.json), so no record is asked for',
  });
});

test('a push that turns the review off says so in a line of its own, and passes', async (t) => {
  const { checkCodexReviews } = await import('./check.mjs');
  const root = pushed(t);
  const tip = commit(root, { 'harness.json': '{ "functions": { "codexReview": "off" } }\n' });
  const row = checkCodexReviews(root, 'HEAD', { remote: 'origin' });
  assert.equal(row.pass, true);
  assert.deepEqual(row.lines, [`this push turns the Codex review off: it is on at origin/main and off at ${tip}`]);
});

test('a switch that cannot be read at the pushed tip is read as on, and said', async (t) => {
  const { checkCodexReviews } = await import('./check.mjs');
  const root = pushed(t);
  commit(root, { 'harness.json': '{ "functions": { "codexReview": "maybe" } }\n' });
  const row = checkCodexReviews(root, 'HEAD', { remote: 'origin' });
  assert.equal(row.pass, false);
  assert.match(row.detail, /have no Codex review record/);
  assert.equal(row.lines[0], 'read as on: harness.json "functions"."codexReview" must be one of "auto", "on", "off"; it is "maybe"');
});

test('with the review on, the push row is as before', async (t) => {
  const { checkCodexReviews } = await import('./check.mjs');
  const root = pushed(t);
  commit(root, { 'bin/b.mjs': 'y\n' });
  const row = checkCodexReviews(root, 'HEAD', { remote: 'origin' });
  assert.equal(row.pass, false);
  assert.match(row.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
});

test('the debt row is one line where the review is off', async (t) => {
  const { checkCodexReviewDebt } = await import('./check.mjs');
  const root = pushed(t);
  commit(root, { 'bin/b.mjs': 'y\n', 'harness.json': '{ "functions": { "codexReview": "off" } }\n' });
  assert.deepEqual(checkCodexReviewDebt(root, { remote: 'origin' }), {
    name: 'codex-review',
    pass: true,
    info: true,
    detail: 'the Codex review is off here (declared in harness.json): no code waits for one',
  });
});

/** A gentle-ai that answers `mode status` with `mode` and `assess` with a medium change not due. */
function gentleAi(mode, risk = 'medium') {
  return (cmd, args) => {
    if (args.includes('mode')) return { status: 0, stdout: JSON.stringify({ status: { effective: mode, source: 'global' } }) };
    const assessed = {
      schema: 'gentle-ai.review-assessment/v1',
      risk,
      changed_paths: 2,
      changed_lines: 40,
      review_due: false,
      review_due_reason: 'under_budget',
      reasons: [],
    };
    return { status: 0, stdout: JSON.stringify(assessed) };
  };
}

test('with the Codex review off, a medium change is due for gentle-ai review (S9)', async (t) => {
  const { checkReview } = await import('./check.mjs');
  const off = repo(t, { 'bin/a.mjs': '', 'harness.json': '{ "functions": { "codexReview": "off" } }\n' });
  assert.equal(
    checkReview(off, { spawn: gentleAi('on') }).detail,
    'medium risk, 2 paths, 40 lines: review due (medium risk and the Codex review is off here)',
  );
  const on = repo(t, { 'bin/a.mjs': '' });
  assert.equal(checkReview(on, { spawn: gentleAi('on') }).detail, 'medium risk, 2 paths, 40 lines: review not due (under_budget)');
  assert.equal(
    checkReview(off, { spawn: gentleAi('on', 'passive') }).detail,
    'passive risk, 2 paths, 40 lines: review not due (under_budget)',
  );
});

test('with the Codex review off, a high change gentle-ai calls not due is due too (S9: high and medium)', async (t) => {
  const { checkReview } = await import('./check.mjs');
  const off = repo(t, { 'bin/a.mjs': '', 'harness.json': '{ "functions": { "codexReview": "off" } }\n' });
  assert.equal(
    checkReview(off, { spawn: gentleAi('on', 'high') }).detail,
    'high risk, 2 paths, 40 lines: review due (high risk and the Codex review is off here)',
  );
});

test('with gentle-ai review off and the Codex review off, the row says no review reads the code', async (t) => {
  const { checkReview } = await import('./check.mjs');
  const off = repo(t, { 'bin/a.mjs': '', 'harness.json': '{ "functions": { "codexReview": "off" } }\n' });
  assert.equal(
    checkReview(off, { spawn: gentleAi('off') }).detail,
    'RDD is off (global), so no review was assessed, and the Codex review is off here: no review reads this project\'s code',
  );
});
