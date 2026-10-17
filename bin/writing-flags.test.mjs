// Every command that writes outside the repository refuses a flag it does not know, and `--help`
// writes nothing (odd/tasks/commands-and-doctor.md, T1). The incident: `install --help` was run to
// read its help and installed on his machine (2026-10-09). Each row runs the real dispatcher in a
// child with every home it could write under pointed at a fresh temp folder, and from a fresh temp
// folder that is not a repository, so a command that does act writes there and the row sees it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dispatcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');
const UNKNOWN = '--no-such-flag';

// The argv before the unknown flag: enough for each command to reach its own parsing, and never
// enough to act on this machine (no source to upgrade from, no repository to review). What a row
// holds after `--` (only `gate`'s) goes after the probe, since `gate` hands everything after it on.
const WRITING = [
  ['install'],
  ['sync', '--global'],
  ['uninstall', '--global'],
  ['init'],
  ['upgrade'],
  ['doctor'],
  ['doctor', '--hook'],
  ['gate', '--', 'node', '--version'],
  ['check'],
  ['codex-review', '--base', 'HEAD'],
  ['contract', 'run', 'none.md'],
  ['remote', 'status'],
  ['remote', 'supervise'],
  ['sessions'],
  ['notify', '--to', 'orchestrator', '--kind', 'note', 'probe'],
  ['resume', '--hook'],
  ['throughput', 'snapshot'],
  ['throughput', 'reviewed'],
  ['throughput', 'shipped'],
];

function probe(args, flag) {
  const split = args.indexOf('--');
  return split === -1 ? [...args, flag] : [...args.slice(0, split), flag, ...args.slice(split)];
}

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-writing-flags-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'cwd');
  fs.mkdirSync(home);
  fs.mkdirSync(cwd);
  const env = { ...process.env, JS_HARNESS_HOME: home, CLAUDE_CONFIG_DIR: home, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, TEMP: home, TMP: home, TMPDIR: home, JS_HARNESS_CHECK_INNER: '1' };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_') || key === 'JS_HARNESS_SOURCE' || key === 'JS_HARNESS_PREFIX' || key === 'CLAUDE_CODE_SESSION_ID') delete env[key];
  }
  env.GIT_CEILING_DIRECTORIES = root;
  const run = (args) => spawnSync(process.execPath, [dispatcher, ...args], { cwd, env, encoding: 'utf8', input: '', timeout: 60000 });
  const written = () => [home, cwd].flatMap((dir) => fs.readdirSync(dir).map((name) => path.join(path.basename(dir), name)));
  return { run, written, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

for (const args of WRITING) {
  test(`${args.join(' ')} ${UNKNOWN} exits 2, names the flag and writes nothing`, () => {
    const box = sandbox();
    try {
      const result = box.run(probe(args, UNKNOWN));
      assert.equal(result.status, 2, `exit ${result.status}\n${result.stdout}\n${result.stderr}`);
      assert.ok(result.stderr.includes(UNKNOWN), result.stderr);
      assert.deepEqual(box.written(), []);
    } finally {
      box.done();
    }
  });

  test(`${args.join(' ')} --help writes nothing`, () => {
    const box = sandbox();
    try {
      box.run(probe(args, '--help'));
      assert.deepEqual(box.written(), []);
    } finally {
      box.done();
    }
  });
}
