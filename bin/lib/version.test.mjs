import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  compareSemver,
  isNewer,
  parseTarballVersion,
  pickLatestTarball,
  latestFromSource,
  splitCommand,
  pmKind,
  installPlan,
} from './version.mjs';

test('compareSemver orders by major, then minor, then patch', () => {
  assert.equal(compareSemver('1.0.0', '1.0.0'), 0);
  assert.equal(compareSemver('2.0.0', '1.9.9'), 1);
  assert.equal(compareSemver('1.9.9', '2.0.0'), -1);
  assert.equal(compareSemver('1.2.0', '1.1.9'), 1);
  assert.equal(compareSemver('1.1.0', '1.1.1'), -1);
});

test('isNewer compares a candidate against the current version', () => {
  assert.equal(isNewer('0.2.0', '0.1.0'), true);
  assert.equal(isNewer('0.1.0', '0.1.0'), false);
  assert.equal(isNewer('0.1.0', '0.2.0'), false);
});

test('parseTarballVersion reads the version out of an npm pack filename', () => {
  assert.equal(parseTarballVersion('js-harness-0.2.0.tgz'), '0.2.0');
  assert.equal(parseTarballVersion('js-harness-1.10.3.tgz'), '1.10.3');
  assert.equal(parseTarballVersion('not-a-tarball.txt'), null);
  assert.equal(parseTarballVersion('other-package-0.2.0.tgz'), null);
});

test('pickLatestTarball picks the highest version and ignores non-matching files', () => {
  const best = pickLatestTarball(['js-harness-0.1.0.tgz', 'js-harness-0.2.0.tgz', 'README.md']);
  assert.deepEqual(best, { version: '0.2.0', file: 'js-harness-0.2.0.tgz' });
  assert.equal(pickLatestTarball(['README.md']), null);
});

test('latestFromSource reads a directory of tarballs and returns the highest version', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-source-'));
  try {
    fs.writeFileSync(path.join(dir, 'js-harness-0.1.0.tgz'), '');
    fs.writeFileSync(path.join(dir, 'js-harness-0.2.0.tgz'), '');
    const result = latestFromSource(dir);
    assert.equal(result.version, '0.2.0');
    assert.equal(result.file, path.join(dir, 'js-harness-0.2.0.tgz'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('latestFromSource returns null for an empty directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-source-empty-'));
  try {
    assert.equal(latestFromSource(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('splitCommand splits a package-manager command into argv', () => {
  assert.deepEqual(splitCommand('npm'), ['npm']);
  assert.deepEqual(splitCommand('node cli.js'), ['node', 'cli.js']);
  assert.deepEqual(splitCommand('  node   cli.js  '), ['node', 'cli.js']);
});

test('pmKind names pnpm when a word of the command is pnpm, and npm for anything else', () => {
  assert.equal(pmKind(['pnpm']), 'pnpm');
  assert.equal(pmKind(['pnpm.exe']), 'pnpm');
  assert.equal(pmKind(['node', 'C:/tools/pnpm/bin/pnpm.cjs']), 'pnpm');
  assert.equal(pmKind(['npm']), 'npm');
  assert.equal(pmKind(['node', 'C:/nvm4w/nodejs/node_modules/npm/bin/npm-cli.js']), 'npm');
  assert.equal(pmKind(['my-pm']), 'npm');
  assert.equal(pmKind(['node', 'C:/pnpm-projects/cli.js']), 'npm');
});

test('installPlan gives npm `install -g <spec>`, with an optional --prefix, and its environment unchanged', () => {
  const env = { PATH: '/usr/bin' };
  assert.deepEqual(installPlan('npm', 'C:/src/js-harness-0.2.0.tgz', undefined, env, 'linux'), {
    args: ['install', '-g', 'C:/src/js-harness-0.2.0.tgz'],
    env,
  });
  assert.deepEqual(installPlan('npm', 'C:/src/js-harness-0.2.0.tgz', 'C:/tmp/prefix', env, 'linux'), {
    args: ['install', '-g', 'C:/src/js-harness-0.2.0.tgz', '--prefix', 'C:/tmp/prefix'],
    env,
  });
});

// T2: npm 12 refuses a package fetched from git by default (EALLOWGIT, `allow-git` "none"), measured 2026-10-18.
test('installPlan lets npm fetch the one git package it is asked for, and never a tarball through that door', () => {
  assert.deepEqual(installPlan('npm', 'github:jsaristi/js-harness#v1.0.0', undefined, {}, 'linux').args, [
    'install',
    '-g',
    '--allow-git=all',
    'github:jsaristi/js-harness#v1.0.0',
  ]);
  assert.deepEqual(installPlan('npm', 'git+file:///tmp/repo#v1.0.0', '/tmp/p', {}, 'linux').args, [
    'install',
    '-g',
    '--allow-git=all',
    'git+file:///tmp/repo#v1.0.0',
    '--prefix',
    '/tmp/p',
  ]);
  assert.ok(!installPlan('npm', '/src/js-harness-1.0.0.tgz', undefined, {}, 'linux').args.includes('--allow-git=all'));
});

test('installPlan gives pnpm `add -g <spec>` and no --prefix, which pnpm does not have', () => {
  const env = { PATH: '/usr/bin' };
  assert.deepEqual(installPlan('pnpm', 'github:o/r#v1.0.0', undefined, env, 'linux'), { args: ['add', '-g', 'github:o/r#v1.0.0'], env });
  assert.deepEqual(installPlan('pnpm', 'github:o/r#v1.0.0', '/tmp/p', env, 'linux').args, ['add', '-g', 'github:o/r#v1.0.0']);
});

// T2 of odd/tasks/harness-review.md, L7: pnpm 12 reads its folders from `pnpm_config_*`, not `npm_config_*`, and a
// global-bin-dir in the user's own config wins over PNPM_HOME, so a prefix sets every folder pnpm writes, and puts
// its bin folder first on the path, which pnpm requires of a global bin folder.
test('installPlan keeps an isolated pnpm install inside the prefix, its bin folder first on the path', () => {
  const prefix = path.join('C:', 'tmp', 'prefix');
  const plan = installPlan('pnpm', 'github:o/r#v1.0.0', prefix, { Path: 'C:\\Windows', HOME: 'C:\\Users\\me' }, 'win32');
  assert.equal(plan.env.PNPM_HOME, prefix);
  assert.equal(plan.env.pnpm_config_global_bin_dir, path.join(prefix, 'bin'));
  for (const key of ['global_dir', 'store_dir', 'cache_dir', 'state_dir']) {
    assert.ok(plan.env[`pnpm_config_${key}`].startsWith(prefix + path.sep), key);
  }
  // Windows names the path `Path`: the same key is extended, never a second one beside it.
  assert.equal(plan.env.Path, `${path.join(prefix, 'bin')};C:\\Windows`);
  assert.equal(plan.env.PATH, undefined);
  assert.equal(plan.env.HOME, 'C:\\Users\\me');
  const posix = installPlan('pnpm', 'x', '/tmp/p', { PATH: '/usr/bin' }, 'linux');
  assert.equal(posix.env.PATH, `${path.join('/tmp/p', 'bin')}:/usr/bin`);
});
