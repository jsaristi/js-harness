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
  viewArgs,
  installArgs,
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

test('viewArgs builds `view <pkg> version`', () => {
  assert.deepEqual(viewArgs('js-harness'), ['view', 'js-harness', 'version']);
});

test('installArgs builds `install -g <spec>`, with an optional --prefix', () => {
  assert.deepEqual(installArgs('js-harness@0.2.0'), ['install', '-g', 'js-harness@0.2.0']);
  assert.deepEqual(installArgs('js-harness@0.2.0', 'C:/tmp/prefix'), [
    'install',
    '-g',
    'js-harness@0.2.0',
    '--prefix',
    'C:/tmp/prefix',
  ]);
});
