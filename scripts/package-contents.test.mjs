import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, npm, resolveNpmCli } from './lib.mjs';

// What the package holds for whoever installs it: the commands, and nothing else of this repository
// (his answer to question 24, "Solo los comandos"; docs/ROADMAP.md, open decision 10). The list is npm's
// own, read from a dry run of `npm pack`, which writes no tarball; `--logs-max=0` keeps it from writing a
// log file either.

const NPM_CLI = resolveNpmCli();
const IS_TEST_FILE = /\.(test|testkit)\.mjs$/;
// npm packs these whatever `files` says.
const ALWAYS_PACKED = /^(package\.json|readme(\.[^/]*)?|licen[cs]e(\.[^/]*)?)$/i;

function packedPaths() {
  const result = npm(NPM_CLI, ['pack', '--dry-run', '--json', '--logs-max=0'], { cwd: REPO_ROOT });
  assert.equal(result.status, 0, `npm pack --dry-run exited ${result.status}: ${result.stderr}`);
  // npm 11 prints an array of packs, npm 12 an object keyed by package name (seen with 12.2.0, 2026-10-16).
  const parsed = JSON.parse(result.stdout);
  const [pack] = Array.isArray(parsed) ? parsed : Object.values(parsed);
  return pack.files.map((file) => file.path).sort();
}

function commandFiles() {
  return fs
    .readdirSync(path.join(REPO_ROOT, 'bin'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !IS_TEST_FILE.test(entry.name))
    .map((entry) => path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

test(
  'the package holds every command file and none of the test files, nor this repository\'s AGENTS.md',
  { skip: fs.existsSync(NPM_CLI) ? false : `no npm-cli.js at ${NPM_CLI}` },
  () => {
    const packed = packedPaths();

    assert.deepEqual(
      packed.filter((file) => IS_TEST_FILE.test(file)),
      [],
      'a test file is in the package',
    );
    assert.equal(packed.includes('AGENTS.md'), false, 'this repository\'s AGENTS.md is in the package');
    assert.deepEqual(
      packed.filter((file) => file.startsWith('bin/')),
      commandFiles(),
      'the files of bin/ that are not tests, all of them and only them',
    );
    assert.deepEqual(
      packed.filter((file) => !file.startsWith('bin/') && !ALWAYS_PACKED.test(file)),
      [],
      'something outside bin/ is in the package',
    );
  },
);
