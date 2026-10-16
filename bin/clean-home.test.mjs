// S5 of odd/tasks/first-version.md: the whole cycle on a clean machine, run by every gate. A throwaway home outside the
// repository gets this checkout's `install`, a `doctor` with no gap of the harness's own, the session-start hooks the
// install registered, and `uninstall --global`, which must leave the home empty. The hooks and doctor's hook check run
// `js-harness` by name, as a host does, so a shim at the front of PATH sends that name to this checkout and never to
// the copy installed on the machine. The update step waits for the release source (T4 of the same document).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAP_STATES } from './lib/digest.mjs';

const BIN = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));
// The rows of `doctor` that are the harness's own. The others are tools of the stack (gentle-ai, engram, Codex...),
// whose state is the machine's, not the install's.
const OWN_ROWS = ['memory-rules', 'session-classes', 'remote-server', 'hook-commands', 'unseen', 'host-update', 'gentle-ai-sync'];
// Every state a row reports in, so a row whose state is not one of these is a failure of the run, not a pass.
const STATES = new Set([...GAP_STATES, 'ok', 'n/a', 'unknown']);

/** A folder on PATH whose `js-harness` runs this checkout's command line. */
function shimFolder(root) {
  const folder = path.join(root, 'shim');
  fs.mkdirSync(folder);
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(folder, 'js-harness.cmd'), `@"${process.execPath}" "${BIN}" %*\r\n`);
  } else {
    const shim = path.join(folder, 'js-harness');
    fs.writeFileSync(shim, `#!/bin/sh\nexec '${process.execPath}' '${BIN}' "$@"\n`);
    fs.chmodSync(shim, 0o755);
  }
  return folder;
}

/** Every file under `folder`, relative to it, sorted. */
function filesUnder(folder) {
  return fs.readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(folder, path.join(entry.parentPath, entry.name)))
    .sort();
}

test('a clean home installs the harness, reports no gap of its own, runs its session-start hooks and uninstalls to an empty home', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-clean-home-'));
  try {
    const home = path.join(root, 'home');
    const project = path.join(root, 'project');
    fs.mkdirSync(home);
    fs.mkdirSync(project);
    const env = {
      ...process.env,
      PATH: `${shimFolder(root)}${path.delimiter}${process.env.PATH}`,
      HOME: home,
      USERPROFILE: home,
      JS_HARNESS_HOME: home,
    };
    const run = (args, options = {}) => spawnSync(process.execPath, [BIN, ...args], { cwd: project, env, encoding: 'utf8', timeout: 60_000, ...options });

    const installed = run(['install', '--home', home]);
    assert.equal(installed.status, 0, installed.stderr);
    assert.ok(fs.existsSync(path.join(home, '.js-harness', 'manifest.json')), 'install records its manifest');

    const doctor = run(['doctor', '--home', home, '--offline', '--json']);
    assert.equal(doctor.status, 0, doctor.stderr);
    const rows = JSON.parse(doctor.stdout);
    for (const id of OWN_ROWS) {
      const row = rows.find((candidate) => candidate.id === id);
      assert.ok(row, `doctor reports the ${id} row`);
      for (const column of ['installed', 'claude', 'codex', 'project', 'upToDate']) {
        assert.ok(STATES.has(row[column]), `${id} ${column}: ${row[column]}`);
        assert.ok(!GAP_STATES.has(row[column]), `${id} ${column} is a gap: ${row[column]}; fix: ${JSON.stringify(row.fix)}`);
      }
    }
    // The commands the installed hooks run answered: they reached this checkout through the shim.
    assert.equal(rows.find((row) => row.id === 'hook-commands').claude, 'ok');

    // Each session-start entry of both hosts, run as its host runs it: by name, through a shell, with the hook's input.
    const ran = [];
    for (const file of [path.join(home, '.claude', 'settings.json'), path.join(home, '.codex', 'hooks.json')]) {
      for (const entry of JSON.parse(fs.readFileSync(file, 'utf8')).hooks.SessionStart) {
        const source = entry.matcher === 'compact' ? 'compact' : 'startup';
        const input = JSON.stringify({ hook_event_name: 'SessionStart', source, session_id: '00000000-0000-4000-8000-000000000000', cwd: project });
        for (const { command } of entry.hooks) {
          const hook = spawnSync(command, { cwd: project, env, encoding: 'utf8', input, shell: true, timeout: 60_000 });
          assert.equal(hook.status, 0, `${command}: ${hook.stderr}`);
          // A session-start hook says nothing, or one JSON object for the host.
          if (hook.stdout.trim() !== '') assert.equal(typeof JSON.parse(hook.stdout), 'object', `${command}: ${hook.stdout}`);
          ran.push(command);
        }
      }
    }
    assert.deepEqual(ran, ['js-harness doctor --hook', 'js-harness resume --hook', 'js-harness doctor --hook', 'js-harness resume --hook']);

    const uninstalled = run(['uninstall', '--global', '--home', home]);
    assert.equal(uninstalled.status, 0, uninstalled.stderr);
    // Nothing the cycle wrote is left: not the manifest, not the doctor's cache, not a hook's state, not a folder.
    assert.deepEqual(filesUnder(home), []);
    assert.deepEqual(fs.readdirSync(home), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test.todo('a clean home updates to a newer local tag (S5), once the release source of T4 exists');
