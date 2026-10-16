import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { repoTemplate } from './git-fixture.testkit.mjs';

const made = [];
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-git-fixture-gitconfig-'));
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

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-git-fixture-'));
  made.push(dir);
  return dir;
}

/** A repository with one commit, as the tests' builders make it; `builds` counts the times it ran. */
function oneCommit(counter) {
  return (root) => {
    counter.builds += 1;
    git(root, 'init');
    git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
    git(root, 'config', 'user.name', 'js-harness test');
    fs.writeFileSync(path.join(root, 'a.txt'), 'one', 'utf8');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'init');
    return git(root, 'rev-parse', 'HEAD');
  };
}

test('the build runs once, and every copy is that repository: its commit, a clean tree, its own config', () => {
  const counter = { builds: 0 };
  const copyTo = repoTemplate(oneCommit(counter));
  const first = tmp();
  const second = tmp();
  const head = copyTo(first);
  assert.equal(copyTo(second), head);
  assert.equal(counter.builds, 1);
  for (const root of [first, second]) {
    assert.equal(git(root, 'rev-parse', 'HEAD'), head);
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.equal(git(root, 'config', 'user.name'), 'js-harness test');
    assert.equal(fs.realpathSync.native(git(root, 'rev-parse', '--show-toplevel')), fs.realpathSync.native(root));
  }
});

test('a copy is a repository of its own: a commit in one is not in another, nor in the template', () => {
  const copyTo = repoTemplate(oneCommit({ builds: 0 }));
  const first = tmp();
  const second = tmp();
  const head = copyTo(first);
  copyTo(second);
  fs.writeFileSync(path.join(first, 'b.txt'), 'two', 'utf8');
  git(first, 'add', '.');
  git(first, 'commit', '-m', 'second');
  assert.notEqual(git(first, 'rev-parse', 'HEAD'), head);
  assert.equal(git(second, 'rev-parse', 'HEAD'), head);
  assert.equal(git(copyTo.folder, 'rev-parse', 'HEAD'), head);
  const third = tmp();
  copyTo(third);
  assert.equal(git(third, 'rev-parse', 'HEAD'), head);
  assert.equal(fs.existsSync(path.join(third, 'b.txt')), false);
});

test('a build that throws leaves no template, and the next copy builds again', () => {
  let calls = 0;
  const copyTo = repoTemplate((root) => {
    calls += 1;
    fs.writeFileSync(path.join(root, 'half.txt'), 'half', 'utf8');
    if (calls === 1) throw new Error('the first build fails');
    git(root, 'init');
    return 'built';
  });
  assert.throws(() => copyTo(tmp()), /the first build fails/);
  assert.equal(copyTo.folder, null);
  const root = tmp();
  assert.equal(copyTo(root), 'built');
  assert.equal(calls, 2);
  assert.equal(fs.existsSync(path.join(root, '.git')), true);
});

test('the template is removed when the process exits', () => {
  const testkit = pathToFileURL(fileURLToPath(new URL('./git-fixture.testkit.mjs', import.meta.url))).href;
  const script = [
    `import { repoTemplate } from ${JSON.stringify(testkit)};`,
    "import fs from 'node:fs';",
    "const copyTo = repoTemplate((root) => { fs.writeFileSync(root + '/f.txt', 'x'); return 1; });",
    'copyTo(process.argv[1]);',
    'console.log(copyTo.folder);',
  ].join('\n');
  const dest = tmp();
  const ran = spawnSync(process.execPath, ['--input-type=module', '-e', script, dest], { encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr);
  const folder = ran.stdout.trim();
  assert.notEqual(folder, '');
  assert.equal(fs.existsSync(folder), false);
  assert.equal(fs.readFileSync(path.join(dest, 'f.txt'), 'utf8'), 'x');
});
