// `js-harness codex-review` where the project has the review off (odd/tasks/on-demand-functions.md, S4): it
// launches nothing, says why and exits 0, with `--plan` too; `--unavailable` always records, so no state exists
// in which the push asks for a record the command refuses to write.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { codexReviewMain } from './codex-review.mjs';

let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-switch-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

const git = (root, ...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

/** Two commits of code; the second declares the review off. */
function offProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-switch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'test');
  fs.writeFileSync(path.join(root, 'a.mjs'), 'x\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'first');
  fs.writeFileSync(path.join(root, 'b.mjs'), 'y\n');
  fs.writeFileSync(path.join(root, 'harness.json'), '{ "functions": { "codexReview": "off" } }\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'second');
  return root;
}

const records = (root) => path.join(root, '.git', 'js-harness', 'codex-reviews.jsonl');

async function review(root, ...argv) {
  const out = [];
  const err = [];
  const launched = [];
  const code = await codexReviewMain(['--cwd', root, ...argv], {}, {
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    spawnAsync: (...call) => {
      launched.push(call);
      throw new Error('no Codex may be launched here');
    },
  });
  return { code, out, err, launched };
}

test('with the review off at the head, codex-review and its plan launch nothing, record nothing, and say why', async (t) => {
  const root = offProject(t);
  const head = git(root, 'rev-parse', '--short', 'HEAD');
  for (const argv of [['--base', 'HEAD~1'], ['--base', 'HEAD~1', '--plan']]) {
    const { code, out, err, launched } = await review(root, ...argv);
    assert.equal(code, 0, err.join('\n'));
    assert.deepEqual(out, [`The Codex review is off at ${head} (declared in harness.json): nothing to review, and nothing was started or recorded.`]);
    assert.deepEqual(launched, []);
    assert.equal(fs.existsSync(records(root)), false);
  }
});

test('--unavailable records its skip with the review off as well', async (t) => {
  const root = offProject(t);
  const { code } = await review(root, '--base', 'HEAD~1', '--unavailable', 'no Codex on this machine');
  assert.equal(code, 0);
  assert.match(fs.readFileSync(records(root), 'utf8'), /no Codex on this machine/);
});
