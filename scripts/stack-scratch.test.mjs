import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { D2_ROWS, realFilesOf, scratchEnv, scratchLayout, shimContent, trialVerdict } from './stack-scratch.mjs';

// The pure parts of the trial of odd/tasks/stack-install.md (D9): where it puts things, the environment every command
// of it gets, the shims, the files of his it hashes, and the verdict. The trial itself downloads, so it is run by hand.

test('scratchLayout puts the home, its AppData, the package prefix, the shims and the project under one folder', () => {
  const layout = scratchLayout('/t');
  assert.equal(layout.home, path.join('/t', 'home'));
  assert.equal(layout.appData, path.join('/t', 'home', 'AppData', 'Roaming'));
  assert.equal(layout.localAppData, path.join('/t', 'home', 'AppData', 'Local'));
  assert.equal(layout.prefix, path.join('/t', 'prefix'));
  assert.equal(layout.prefixBin, path.join('/t', 'prefix', 'bin'));
  assert.equal(layout.bin, path.join('/t', 'bin'));
  assert.equal(layout.project, path.join('/t', 'project'));
});

test('scratchEnv holds only the shims and the prefix on PATH, the scratch home, and no telemetry', () => {
  const layout = scratchLayout('/t');
  const base = { Path: 'C:\\Windows;C:\\nvm4w\\nodejs', SystemRoot: 'C:\\Windows', ComSpec: 'C:\\Windows\\cmd.exe', PATHEXT: '.EXE;.CMD', TEMP: 'C:\\Temp', USERPROFILE: 'C:\\Users\\him', PNPM_HOME: 'C:\\pnpm', JS_HARNESS_PM: 'npm', CODEX_HOME: 'C:\\x' };
  const env = scratchEnv(layout, base, 'win32');
  assert.equal(env.Path, `${layout.bin};${layout.prefixBin}`);
  assert.equal(env.PATH, undefined);
  assert.equal(env.SystemRoot, 'C:\\Windows');
  assert.equal(env.ComSpec, 'C:\\Windows\\cmd.exe');
  assert.equal(env.PATHEXT, '.EXE;.CMD');
  assert.equal(env.TEMP, 'C:\\Temp');
  assert.equal(env.USERPROFILE, layout.home);
  assert.equal(env.HOME, layout.home);
  assert.equal(env.CODEX_HOME, path.join(layout.home, '.codex'));
  assert.equal(env.APPDATA, layout.appData);
  assert.equal(env.LOCALAPPDATA, layout.localAppData);
  assert.equal(env.DO_NOT_TRACK, '1');
  assert.equal(env.PNPM_HOME, undefined, 'his pnpm home never reaches the trial');
  assert.equal(env.JS_HARNESS_PM, undefined);
  assert.equal(scratchEnv(layout, { PATH: '/usr/bin', HOME: '/home/him' }, 'linux').PATH, `${layout.bin}:${layout.prefixBin}`);
});

test('a shim starts exactly the program it names, with every argument', () => {
  assert.equal(shimContent('C:\\Program Files\\Git\\cmd\\git.exe', 'win32'), '@"C:\\Program Files\\Git\\cmd\\git.exe" %*\r\n');
  assert.equal(shimContent('/usr/bin/git', 'linux'), '#!/bin/sh\nexec "/usr/bin/git" "$@"\n');
});

test('realFilesOf names the four files of his the trial must leave as they are', () => {
  assert.deepEqual(realFilesOf('/h'), [
    path.join('/h', '.claude.json'),
    path.join('/h', '.claude', 'settings.json'),
    path.join('/h', '.codex', 'config.toml'),
    path.join('/h', '.codex', 'AGENTS.md'),
  ]);
});

const okRow = (id, cells = {}) => ({ id, installed: 'ok', claude: 'ok', codex: 'ok', ...cells });
const GOOD = {
  stack: { code: 1, plan: { mandatory: D2_ROWS.map((key) => ({ tool: key.split('.')[0], dimension: key.split('.')[1] })) } },
  installs: [{ tool: 'codex', code: 0 }, { tool: 'codegraph', code: 0 }],
  doctor: [okRow('codex', { claude: 'n/a', codex: 'missing' }), okRow('codegraph')],
  uninstall: { code: 0, manifestLeft: false, prefixPackages: [] },
  differences: [],
};

test('trialVerdict passes a trial that did what D9 expects', () => {
  assert.deepEqual(trialVerdict(GOOD), { pass: true, failures: [] });
});

test('trialVerdict names each thing that went wrong', () => {
  const bad = {
    stack: { code: 0, plan: { mandatory: [] } },
    installs: [{ tool: 'codex', code: 1 }],
    doctor: [okRow('codex', { installed: 'unknown' }), okRow('codegraph', { claude: 'missing' })],
    uninstall: { code: 1, manifestLeft: true, prefixPackages: ['@openai/codex'] },
    differences: [{ path: '/h/.claude.json', change: 'changed' }],
  };
  assert.deepEqual(trialVerdict(bad).failures, [
    'stack --json exited 0, not 1',
    'stack --json planned , not codex.installed, codegraph.installed, codegraph.claude, codegraph.codex',
    'stack install --tool codex exited 1',
    'doctor: codex installed is unknown, not ok',
    'doctor: codegraph claude is missing, not ok',
    'uninstall machine exited 1',
    'uninstall machine left the manifest',
    'the scratch prefix still holds @openai/codex',
    'his file changed: /h/.claude.json',
  ]);
});
