// What `js-harness rules change` says of another rule/ branch that holds an open change: whether it is pushed, how many
// commits it is ahead, and the worktree that has it checked out. Run on a repository made in each test, through
// `rules change --dry-run`, and on the helper alone where git cannot list the worktrees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rulesMain } from '../rules.mjs';
import { writeRules } from './rules.mjs';
import { heldDetail } from './rules-change-held.mjs';

const LIST = [
  { id: 'gate-wait', subject: 'the wait for a turn of the gate lock', owner: 'project', since: '2026-10-11', value: 60, unit: 'minutes', flag: '--wait' },
];
const DESIGN = { kind: 'design', path: 'docs/ROADMAP.md' };

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};
const write = (dir, file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};

/** A repository with the list on main and origin/main, on rule/gate-wait: `{ base, dir }`, `base` the test's folder. */
function repository() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-held-'));
  const dir = path.join(base, 'repo');
  fs.mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  git(dir, 'config', 'core.autocrlf', 'false');
  write(dir, 'docs/ROADMAP.md', '# Roadmap\n');
  write(dir, 'bin/lib/rules-data.mjs', writeRules(LIST));
  write(dir, 'docs/rule-sources.json', `${JSON.stringify({ 'gate-wait': DESIGN }, null, 2)}\n`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'the list');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(dir, 'switch', '-q', '-c', 'rule/gate-wait');
  return { base, dir };
}

/** Makes `rule/other` off main with `commits` commits, the first of which changes gate-wait, and leaves `dir` on the
 * branch it was on. */
function otherBranch(dir, commits) {
  const was = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');
  git(dir, 'switch', '-q', '-c', 'rule/other', 'main');
  write(dir, 'bin/lib/rules-data.mjs', writeRules(LIST.map((rule) => ({ ...rule, value: 45 }))));
  git(dir, 'commit', '-q', '-am', 'another change');
  for (let n = 1; n < commits; n++) {
    write(dir, 'docs/ROADMAP.md', `# Roadmap ${n}\n`);
    git(dir, 'commit', '-q', '-am', `a later commit ${n}`);
  }
  git(dir, 'switch', '-q', was);
}

/** Runs `rules change gate-wait --dry-run` in `dir`: `{ code, err }`. */
async function change(dir) {
  const err = [];
  const code = await rulesMain(['change', 'gate-wait', '--dry-run'], {
    root: dir,
    cwd: dir,
    env: { JS_HARNESS_HOME: path.join(dir, '..', 'home'), CLAUDE_CONFIG_DIR: path.join(dir, '..', 'claude') },
    now: () => Date.parse('2026-10-16T17:00:00.000Z'),
    stdin: () => JSON.stringify({ value: 30, source: DESIGN }),
    stdout: () => {},
    stderr: (line) => err.push(line),
  });
  return { code, err: err.join('\n') };
}

test('a branch not pushed, held in a linked worktree: the refusal says so, with its commits ahead of origin/main', async () => {
  const { base, dir } = repository();
  otherBranch(dir, 2);
  git(dir, 'worktree', 'add', '-q', path.join(base, 'held-tree-unpushed'), 'rule/other');
  const result = await change(dir);
  assert.equal(result.code, 1);
  assert.match(result.err, /rule\/other holds a rule change not on origin\/main.*git branch -D rule\/other/s);
  assert.match(result.err, /rule\/other is not pushed \(no origin\/rule\/other\), 2 commits ahead of origin\/main/);
  assert.match(result.err, /checked out in the worktree [^\n]*held-tree-unpushed/);
});

test('a pushed branch: the refusal names its origin ref and the commits it is ahead of it', async () => {
  const { base, dir } = repository();
  otherBranch(dir, 2);
  git(dir, 'update-ref', 'refs/remotes/origin/rule/other', 'rule/other~1');
  git(dir, 'worktree', 'add', '-q', path.join(base, 'held-tree-pushed'), 'rule/other');
  const result = await change(dir);
  assert.equal(result.code, 1);
  assert.match(result.err, /rule\/other is pushed \(origin\/rule\/other\), 1 commit ahead of it/);
  assert.match(result.err, /checked out in the worktree [^\n]*held-tree-pushed/);
});

test('a branch the main checkout holds is named in that checkout, and one no worktree holds says so', async () => {
  const { base, dir } = repository();
  otherBranch(dir, 1);
  const linked = path.join(base, 'runner-tree');
  git(dir, 'switch', '-q', 'rule/other');
  git(dir, 'worktree', 'add', '-q', linked, 'rule/gate-wait');
  const inMain = await change(linked);
  assert.equal(inMain.code, 1);
  assert.match(inMain.err, /checked out in the worktree [^\n]*[\\/]repo$/m);

  git(dir, 'switch', '-q', 'main');
  const nowhere = await change(linked);
  assert.equal(nowhere.code, 1);
  assert.match(nowhere.err, /rule\/other is not pushed \(no origin\/rule\/other\), 1 commit ahead of origin\/main, checked out in no worktree/);
});

test('a branch only on origin is pushed, with no local branch or worktree', async () => {
  const { dir } = repository();
  otherBranch(dir, 1);
  git(dir, 'update-ref', 'refs/remotes/origin/rule/other', 'rule/other');
  git(dir, 'branch', '-q', '-D', 'rule/other');
  const result = await change(dir);
  assert.equal(result.code, 1);
  assert.match(result.err, /origin\/rule\/other holds a rule change not on origin\/main.*git push origin --delete rule\/other/s);
  assert.match(result.err, /origin\/rule\/other is pushed, with no local branch or worktree/);
});

test('a branch on origin whose local branch no longer holds the change names that branch and its worktree', async () => {
  const { base, dir } = repository();
  otherBranch(dir, 1);
  git(dir, 'update-ref', 'refs/remotes/origin/rule/other', 'rule/other');
  git(dir, 'branch', '-q', '-f', 'rule/other', 'main');
  git(dir, 'worktree', 'add', '-q', path.join(base, 'held-tree-reset'), 'rule/other');
  const result = await change(dir);
  assert.equal(result.code, 1);
  assert.match(result.err, /origin\/rule\/other holds a rule change not on origin\/main/);
  assert.match(result.err, /origin\/rule\/other is pushed, and the local rule\/other is checked out in the worktree [^\n]*held-tree-reset/);
});

test('git that answers nothing leaves only what it could read, and never throws', () => {
  const failing = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
  assert.equal(heldDetail('rule/other', failing), 'rule/other: git could not say whether it is pushed or which worktree holds it');
  const throwing = () => { throw new Error('spawn failed'); };
  assert.equal(heldDetail('rule/other', throwing), 'rule/other: git could not say whether it is pushed or which worktree holds it');
  const noList = (args) => (args[0] === 'worktree' ? { status: 128, stdout: '' } : args[0] === 'for-each-ref' ? { status: 0, stdout: '' } : { status: 0, stdout: '3\n' });
  assert.equal(heldDetail('rule/other', noList), 'rule/other is not pushed (no origin/rule/other), 3 commits ahead of origin/main');
});
