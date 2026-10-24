// `practice setup` on a machine with no git identity (B9): the project's one commit is made under the identity the
// practice brings itself, as release-proof's commit is. This starts git and writes only throwaway folders, as setup
// does: the home, the global and the system git config are pointed at folders of their own, so the user's identity
// is never read and nothing is written to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { main } from './practice.mjs';
import { practiceLayout } from './practice-lib.mjs';
import { REPO_ROOT } from './lib.mjs';

// setup names the candidate it comes from by the checkout's branch and commit, so it needs a git checkout: the WSL
// gate's mirror is synced without .git, and there the test is skipped, with this reason, rather than failed.
const inCheckout = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: REPO_ROOT }).status === 0;

const IDENTITY_VARIABLES = ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL'];

test('setup makes the project commit with no git identity on the machine', { skip: !inCheckout && 'setup names its candidate from a git checkout, and this tree has no .git' }, () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-practice-setup-'));
  const home = path.join(sandbox, 'home');
  const globalConfig = path.join(sandbox, 'gitconfig-global');
  const root = path.join(sandbox, 'practice');
  fs.mkdirSync(home);
  const saved = {};
  const set = { HOME: home, USERPROFILE: home, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' };
  for (const name of [...Object.keys(set), ...IDENTITY_VARIABLES]) saved[name] = process.env[name];
  Object.assign(process.env, set);
  for (const name of IDENTITY_VARIABLES) delete process.env[name];
  const originalError = console.error;
  const originalLog = console.log;
  const errors = [];
  console.error = (...text) => errors.push(text.join(' '));
  console.log = () => {};
  try {
    const code = main(['setup', '--root', root]);
    assert.equal(code, 0, `practice setup must succeed with no git identity on the machine: ${errors.join('; ')}`);
    const author = spawnSync('git', ['log', '-1', '--format=%an <%ae>'], { cwd: practiceLayout(root).project, encoding: 'utf8' });
    assert.equal(author.status, 0, author.stderr);
    assert.equal(author.stdout.trim(), 'practice <practice@example.invalid>');
    assert.equal(fs.existsSync(globalConfig), false, 'setup must not write a git config of the machine');
  } finally {
    console.error = originalError;
    console.log = originalLog;
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

// `run` commits in the project too, and the whole run cannot be a unit test (it packs and installs with npm), so the
// source is read: every git call that commits names the practice's identity, as setup's does (the T9 re-check found
// `commitWithRows` without it, which failed `commit-passes` on a machine with no identity).
test('every commit the practice makes names its own identity', () => {
  const source = fs.readFileSync(new URL('./practice.mjs', import.meta.url), 'utf8');
  const commits = source.split('\n').filter((line) => /\bgit\(.*'commit'/.test(line));
  assert.ok(commits.length >= 5, `expected the practice's commits, found ${commits.length}`);
  for (const line of commits) assert.match(line, /\.\.\.GIT_IDENTITY, 'commit'/, line.trim());
});
