// Convention: a test that runs on one platform only runs in a gate of that platform (docs/FAILURES.md,
// test-skipped-here-never-run). This machine is Windows; a test it skips ran in no gate, so its expectation went stale
// and stood red with nothing to say so. Each platform a test can be left to has its gate here, in PLATFORM_GATES:
// Linux is the `check` job of .github/workflows/gate.yml, which every commit waits for, and Windows is the daily
// whole suite of .github/workflows/windows-daily.yml. A platform condition in a test file names a platform of that
// table, so a test skipped everywhere but a platform with no gate is refused at the commit that writes it.
//
// What a test can see is checked: every `process.platform` compared to a quoted name in a tracked `*.test.mjs`, read
// with its comment lines left out, and each gate file's runner and command. A platform injected as data
// (`platform: 'darwin'`) runs everywhere and is not a condition. LEGACY lists the test files that compare to a platform
// with no gate yet, each with why; it only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { withoutComments } from './lib/source.testkit.mjs';

const REPO = path.join(import.meta.dirname, '..');

/** Each platform a test may be left to, the workflow that runs it there, and what that workflow must hold. */
const PLATFORM_GATES = {
  linux: { file: '.github/workflows/gate.yml', runner: /runs-on: ubuntu-/, command: /run: node bin\/check\.mjs/ },
  win32: { file: '.github/workflows/windows-daily.yml', runner: /runs-on: windows-/, command: /run: node --test\s*$/m },
};

const LEGACY = {};

/** The platform names `text` compares `process.platform` to, each once. */
export function comparedPlatforms(text) {
  const found = new Set();
  for (const match of text.matchAll(/process\.platform\s*[!=]==?\s*(['"`])([^'"`]+)\1|(['"`])([^'"`]+)\3\s*[!=]==?\s*process\.platform/g)) {
    found.add(match[2] ?? match[4]);
  }
  return [...found];
}

/** The names of `platforms` that no gate of `gates` runs. A comparison with win32 leaves a test to Windows or to the
 * rest, and the rest is Linux here, the one other runner a gate has. */
export function platformsWithoutGate(platforms, gates = PLATFORM_GATES) {
  return platforms.filter((name) => !Object.hasOwn(gates, name));
}

function testFiles() {
  const listed = spawnSync('git', ['-C', REPO, 'ls-files', '*.test.mjs'], { encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  return listed.stdout.split('\n').filter(Boolean);
}

test('a comparison with a platform no gate runs is found, and one with win32 or linux is not', () => {
  // Spelled in two parts, so this file's own source holds no comparison for the file check below to read.
  const platform = ['process', 'platform'].join('.');
  assert.deepEqual(comparedPlatforms(`test('x', { skip: ${platform} !== 'darwin' && 'macOS only' }, () => {});`), ['darwin']);
  assert.deepEqual(comparedPlatforms(`const skip = 'win32' === ${platform};`), ['win32']);
  assert.deepEqual(comparedPlatforms("run({ platform: 'darwin' });"), []);
  assert.deepEqual(platformsWithoutGate(['darwin', 'win32', 'linux']), ['darwin']);
});

test('each platform of the table has its gate: the workflow exists, on that runner, running the tests', () => {
  for (const [platform, gate] of Object.entries(PLATFORM_GATES)) {
    const text = fs.readFileSync(path.join(REPO, gate.file), 'utf8');
    assert.match(text, gate.runner, `${gate.file} runs on the ${platform} runner`);
    assert.match(text, gate.command, `${gate.file} runs the tests`);
  }
});

test('every platform a test file compares to has a gate, but the legacy ones', () => {
  const files = testFiles();
  assert.ok(files.length >= 200, `only ${files.length} test files were read`);
  const broken = files.filter((file) => platformsWithoutGate(comparedPlatforms(withoutComments(fs.readFileSync(path.join(REPO, file), 'utf8')))).length > 0);
  const problems = ratchet({ checked: files, broken, legacy: LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\na test left to a platform no gate runs is never run: add its gate to PLATFORM_GATES or drop the condition`);
});
