import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MENU_ITEMS,
  buildMenu,
  withLocation,
  initialState,
  handleKey,
  render,
  normalizeKey,
  runTui,
  tuiMain,
  worstState,
  summarizeStackRow,
  computeStackState,
  buildCommands,
} from './tui.mjs';
import { installMain } from './install.mjs';
import { manifestPath } from './lib/manifest.mjs';
import { spawnSync } from 'node:child_process';

// T5: the menu depends on where the TUI opens, and these tests run real `git`: keep it off the host's
// git config (see project.test.mjs, T2e item 8), and give every machine-menu test a folder outside any
// repository, since the default (this repo's own checkout) is now a project.
let nonGitDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-nongit-'));
});
after(() => {
  fs.rmSync(nonGitDir, { recursive: true, force: true });
});

function makeFakeStdin() {
  const emitter = new EventEmitter();
  emitter.setRawMode = () => {};
  emitter.resume = () => {};
  emitter.pause = () => {};
  emitter.setEncoding = () => {};
  return emitter;
}

function makeFakeStdout() {
  const chunks = [];
  return { write: (s) => chunks.push(s), chunks };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

// --- pure: normalizeKey ---

test('normalizeKey maps arrow keys, vi keys, enter, quit and escape', () => {
  assert.equal(normalizeKey('\u001b[A'), 'up');
  assert.equal(normalizeKey('\u001b[B'), 'down');
  assert.equal(normalizeKey('k'), 'up');
  assert.equal(normalizeKey('j'), 'down');
  assert.equal(normalizeKey('\r'), 'enter');
  assert.equal(normalizeKey('\n'), 'enter');
  assert.equal(normalizeKey('q'), 'quit');
  assert.equal(normalizeKey('\u001b'), 'escape');
  assert.equal(normalizeKey('y'), 'y');
  assert.equal(normalizeKey('Y'), 'y');
  assert.equal(normalizeKey('n'), 'n');
});

// --- pure: initialState / render ---

test('initialState opens on the menu at the first item', () => {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  assert.equal(state.mode, 'menu');
  assert.equal(state.selected, 0);
});

test('render shows the installed version and every menu item, marking the selection', () => {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  const lines = render(state);
  const text = lines.join('\n');
  assert.match(text, /js-harness 0\.1\.0/);
  assert.doesNotMatch(text, /update available/);
  assert.match(text, /^> Status$/m);
  assert.match(text, /^ {2}Install$/m);
});

test('render notes an available update in the header', () => {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: '0.2.0' });
  assert.match(render(state).join('\n'), /update available: 0\.2\.0/);
});

test('render shows a confirmation prompt in confirm-uninstall mode', () => {
  const state = { ...initialState({ installedVersion: '0.1.0', updateAvailable: null }), mode: 'confirm-uninstall' };
  assert.match(render(state).join('\n'), /Uninstall.*\(y\/N\)/);
});

// --- pure: handleKey ---

test('down and up move the selection and wrap around', () => {
  let state = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  ({ state } = handleKey(state, 'down'));
  assert.equal(state.selected, 1);
  ({ state } = handleKey(state, 'up'));
  assert.equal(state.selected, 0);
  ({ state } = handleKey(state, 'up'));
  assert.equal(state.selected, MENU_ITEMS.length - 1, 'up from the first item wraps to the last');
});

test('enter on a non-destructive item requests it be run and stays on the menu', () => {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: null }); // selected: status
  const { state: next, effect } = handleKey(state, 'enter');
  assert.equal(next.mode, 'menu');
  assert.deepEqual(effect, { type: 'run', command: 'status' });
});

test('enter on Uninstall asks for confirmation instead of running it directly', () => {
  let state = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  const uninstallIndex = MENU_ITEMS.indexOf('uninstall');
  state = { ...state, selected: uninstallIndex };
  const { state: next, effect } = handleKey(state, 'enter');
  assert.equal(next.mode, 'confirm-uninstall');
  assert.equal(effect, null);
});

test('y confirms the uninstall; anything else cancels back to the menu', () => {
  const confirming = { ...initialState({ installedVersion: '0.1.0', updateAvailable: null }), mode: 'confirm-uninstall' };

  const yes = handleKey(confirming, 'y');
  assert.equal(yes.state.mode, 'menu');
  assert.deepEqual(yes.effect, { type: 'run', command: 'uninstall' });

  const no = handleKey(confirming, 'n');
  assert.equal(no.state.mode, 'menu');
  assert.equal(no.effect, null);

  const escaped = handleKey(confirming, 'escape');
  assert.equal(escaped.state.mode, 'menu');
  assert.equal(escaped.effect, null);
});

test('q, escape, and enter on Quit all request quitting', () => {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  assert.deepEqual(handleKey(state, 'quit').effect, { type: 'quit' });
  assert.deepEqual(handleKey(state, 'escape').effect, { type: 'quit' });

  const onQuitItem = { ...state, selected: MENU_ITEMS.indexOf('quit') };
  assert.deepEqual(handleKey(onQuitItem, 'enter').effect, { type: 'quit' });
});

// --- thin shell: runTui, driven with fake streams ---

test('runTui runs the selected command, redraws, and resolves 0 on quit', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const calls = [];
  const commands = {
    status: async () => calls.push('status'),
    install: async () => calls.push('install'),
    update: async () => calls.push('update'),
    upgrade: async () => calls.push('upgrade'),
    uninstall: async () => calls.push('uninstall'),
  };

  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });

  stdin.emit('data', '\r'); // Enter on Status
  await flush();
  stdin.emit('data', 'q');

  const code = await done;
  assert.equal(code, 0);
  assert.deepEqual(calls, ['status']);
  assert.ok(stdout.chunks.join('').includes('Status'));
});

test('runTui asks for confirmation before uninstalling', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const calls = [];
  const commands = {
    status: async () => calls.push('status'),
    install: async () => calls.push('install'),
    update: async () => calls.push('update'),
    upgrade: async () => calls.push('upgrade'),
    uninstall: async () => calls.push('uninstall'),
  };

  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });

  for (let i = 0; i < MENU_ITEMS.indexOf('uninstall'); i++) stdin.emit('data', 'j');
  stdin.emit('data', '\r'); // Enter opens the confirmation
  await flush();
  assert.ok(stdout.chunks.at(-1).includes('y/N'));

  stdin.emit('data', 'y');
  await flush();
  stdin.emit('data', 'q');

  const code = await done;
  assert.equal(code, 0);
  assert.deepEqual(calls, ['uninstall']);
});

// --- CLI entry: tuiMain ---

test('tuiMain shows an available update from the injected spawn, then quits cleanly', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const spawn = () => ({ status: 0, stdout: '99.0.0', stderr: '' });

  const done = tuiMain(['--cwd', nonGitDir, '--home', nonGitDir], {}, spawn, { stdin, stdout });
  await flush();
  stdin.emit('data', 'q');
  const code = await done;

  assert.equal(code, 0);
  assert.ok(stdout.chunks[0].includes('update available: 99.0.0'));
});

test('tuiMain resolves home from JS_HARNESS_HOME when --home is not given', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const spawn = () => ({ status: 0, stdout: '', stderr: '' });
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-envhome-'));
  try {
    const done = tuiMain(['--cwd', nonGitDir], { JS_HARNESS_HOME: home }, spawn, { stdin, stdout });
    await flush();
    for (let i = 0; i < MENU_ITEMS.indexOf('install'); i++) stdin.emit('data', 'j'); // down to Install
    stdin.emit('data', '\r'); // run it
    await flush();
    stdin.emit('data', 'q');
    const code = await done;

    assert.equal(code, 0);
    assert.ok(
      fs.existsSync(path.join(home, '.js-harness', 'manifest.json')),
      'install bound by the TUI should have written into the JS_HARNESS_HOME directory',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Redraw in place: bytes measured 2026-09-26 on Windows (PowerShell 7.6 -> cmd -> node, raw mode):
// down = ESC [ B, up = ESC [ A, Enter = \r.
const noCommands = {
  status: async () => {}, doctor: async () => {}, install: async () => {}, update: async () => {},
  upgrade: async () => {}, uninstall: async () => {},
};
const MENU_HEIGHT = 2 + MENU_ITEMS.length; // header, blank line, one line per item

test('runTui redraws the menu in place when the selection moves', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: noCommands, stdin, stdout });

  const before = stdout.chunks.length;
  stdin.emit('data', '\u001b[B');
  await flush();
  const redraw = stdout.chunks.slice(before).join('');
  assert.ok(redraw.startsWith(`\u001b[${MENU_HEIGHT}A\u001b[0J`), `expected a cursor-up redraw, got ${JSON.stringify(redraw.slice(0, 12))}`);
  assert.match(redraw, /> Doctor/);

  stdin.emit('data', 'q');
  await done;
});

// --- T5: the stack block (worstState / summarizeStackRow / computeStackState / render / menu) ---

function makeDoctorRow(overrides = {}) {
  return {
    id: 'gentle-ai',
    version: '3.7.0',
    installed: 'ok',
    claude: 'ok',
    codex: 'ok',
    project: 'n/a',
    upToDate: 'ok',
    ...overrides,
  };
}

test('worstState is "ok" when every dimension is ok or n/a', () => {
  assert.equal(worstState(makeDoctorRow()), 'ok');
});

test('worstState names the dimension for a per-host/per-project gap', () => {
  assert.equal(worstState(makeDoctorRow({ codex: 'missing' })), 'missing codex');
  assert.equal(worstState(makeDoctorRow({ claude: 'missing' })), 'missing claude');
  assert.equal(worstState(makeDoctorRow({ project: 'missing' })), 'missing project');
});

test('worstState is bare (no dimension suffix) for an installed or up-to-date gap', () => {
  assert.equal(worstState(makeDoctorRow({ installed: 'missing' })), 'missing');
  assert.equal(worstState(makeDoctorRow({ upToDate: 'outdated' })), 'outdated');
});

test('worstState breaks ties deterministically toward the first dimension', () => {
  assert.equal(worstState(makeDoctorRow({ installed: 'missing', codex: 'missing' })), 'missing');
});

test('summarizeStackRow reports the installed version and worst state when healthy', () => {
  assert.deepEqual(summarizeStackRow(makeDoctorRow()), { id: 'gentle-ai', version: '3.7.0', state: 'ok' });
});

test('summarizeStackRow shows the installed state as the version when the tool is not ok', () => {
  const row = makeDoctorRow({ installed: 'missing', version: null });
  assert.deepEqual(summarizeStackRow(row), { id: 'gentle-ai', version: 'missing', state: 'missing' });
});

test('render shows one compact line per tool above the menu when state.stack is an array', () => {
  const state = {
    ...initialState({ installedVersion: '0.1.0', updateAvailable: null }),
    stack: [
      { id: 'gentle-ai', version: '3.7.0', state: 'ok' },
      { id: 'codegraph', version: '1.6.0', state: 'missing codex' },
    ],
  };
  const text = render(state).join('\n');
  assert.match(text, /gentle-ai.*3\.7\.0.*ok/);
  assert.match(text, /codegraph.*1\.6\.0.*missing codex/);
});

test('render falls back to a single "stack: unknown" line when the probe failed', () => {
  const state = { ...initialState({ installedVersion: '0.1.0', updateAvailable: null }), stack: 'unknown' };
  assert.match(render(state).join('\n'), /stack: unknown/);
});

test('render shows no stack block when state.stack was never provided', () => {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  assert.doesNotMatch(render(state).join('\n'), /stack:/);
});

test('computeStackState falls back to "unknown" when a probe throws, never rejecting', async () => {
  const spawn = () => ({ status: 0, stdout: '1.0.0', stderr: '' });
  const stack = await computeStackState({ home: undefined, cwd: process.cwd(), spawn });
  assert.equal(stack, 'unknown');
});

test('computeStackState resolves real rows from local probes without ever calling fetch (offline)', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-stack-'));
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: false };
  };
  const spawn = () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });
  try {
    const stack = await computeStackState({ home, cwd: home, spawn, fetch: fetchImpl });
    assert.equal(fetchCalled, false, 'the stack block must never touch the network');
    assert.ok(Array.isArray(stack));
    assert.deepEqual(
      stack.map((r) => r.id),
      ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp'],
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('MENU_ITEMS includes doctor, and enter on it requests it be run', () => {
  assert.ok(MENU_ITEMS.includes('doctor'));
  const state = {
    ...initialState({ installedVersion: '0.1.0', updateAvailable: null }),
    selected: MENU_ITEMS.indexOf('doctor'),
  };
  const { effect } = handleKey(state, 'enter');
  assert.deepEqual(effect, { type: 'run', command: 'doctor' });
});

test('tuiMain wires the Doctor menu item to the full doctorMain, with network per the cache rules', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const spawn = () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: false };
  };
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-doctor-'));
  let logged = '';
  const originalLog = console.log;
  console.log = (line) => {
    logged += `${line}\n`;
  };
  try {
    const done = tuiMain(['--cwd', nonGitDir], { JS_HARNESS_HOME: home }, spawn, { stdin, stdout, fetch: fetchImpl });
    await flush();
    const doctorIndex = MENU_ITEMS.indexOf('doctor');
    for (let i = 0; i < doctorIndex; i++) stdin.emit('data', 'j');
    stdin.emit('data', '\r');
    await flush();
    stdin.emit('data', 'q');
    const code = await done;

    assert.equal(code, 0);
    assert.equal(
      fetchCalled,
      true,
      'the Doctor menu item must be allowed to hit the network, unlike the startup stack block',
    );
    assert.match(logged, /gentle-ai/);
  } finally {
    console.log = originalLog;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('tuiMain never touches the network while opening (the startup stack block stays offline)', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const spawn = () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: false };
  };
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-nostack-fetch-'));
  try {
    const done = tuiMain(['--cwd', nonGitDir], { JS_HARNESS_HOME: home }, spawn, { stdin, stdout, fetch: fetchImpl });
    await flush();
    assert.equal(fetchCalled, false, 'opening the TUI must never call fetch');
    stdin.emit('data', 'q');
    await done;
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('runTui keeps a command\'s output on screen and draws the menu below it', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const commands = { ...noCommands, status: async () => stdout.write('status output\n') };
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });

  stdin.emit('data', '\r'); // run Status
  await flush();
  const all = stdout.chunks.join('');
  const afterOutput = all.slice(all.indexOf('status output\n') + 'status output\n'.length);
  assert.ok(!afterOutput.startsWith('\u001b['), 'the menu after a command must not erase the command output');
  assert.match(afterOutput, /js-harness 0\.1\.0/);

  stdin.emit('data', 'q');
  await done;
});

// The TUI runs outside or inside a project alike, and its uninstall entry is the machine one: it
// must pass --global, or inside a git repository it would act on (or refuse for) that project.
test('buildCommands uninstall undoes the machine install even when run inside a git repository', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-repo-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-home-'));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  try {
    assert.equal(spawnSync('git', ['init'], { cwd: repo, encoding: 'utf8' }).status, 0);
    console.log = () => {};
    await installMain(['--home', home]);
    process.chdir(repo);

    const code = await buildCommands({ home }).uninstall();

    assert.equal(code, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    process.chdir(originalCwd);
    console.log = originalLog;
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T4: the same holds for sync — the menu's entry is the machine sync wherever the TUI was opened,
// or inside a git repository it would act on (or refuse for) that project instead.
test('buildCommands sync syncs the machine install even when run inside a git repository', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-sync-repo-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-sync-home-'));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  try {
    assert.equal(spawnSync('git', ['init'], { cwd: repo, encoding: 'utf8' }).status, 0);
    const lines = [];
    console.log = (line) => lines.push(String(line));
    await installMain(['--home', home]);
    process.chdir(repo);

    const code = await buildCommands({ home }).sync();

    assert.equal(code, 0);
    assert.ok(lines.some((l) => l.startsWith('synced js-harness ')));
  } finally {
    process.chdir(originalCwd);
    console.log = originalLog;
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T5: the menu by location ---

const NOT_GIT = { kind: 'notGit' };
const NOT_INITIALIZED = { kind: 'notInitialized', root: '/repo' };
const INITIALIZED = { kind: 'initialized', root: '/repo', pin: '0.1.0', manifestPresent: true };
const STALE = { kind: 'staleManifest', root: '/repo', manifestPath: '/repo/.git/js-harness/manifest.json' };
const INVALID = { kind: 'invalidHarnessJson', root: '/repo', harnessJsonPath: '/repo/harness.json', reason: 'x' };

/** A menu as one comparable list: headers as `[label]`, items by id. */
const ids = (menu) => menu.map((entry) => (entry.header ? `[${entry.label}]` : entry.id));
const PROJECT_MENU = ['[project]', 'project-sync', 'project-status', 'project-uninstall'];

function stateAt(location, id) {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: null, location });
  return { ...state, selected: state.menu.findIndex((entry) => entry.id === id) };
}

function press(state, ...keys) {
  let effect = null;
  for (const key of keys) ({ state, effect } = handleKey(state, key));
  return { state, effect };
}

test('buildMenu is exactly today\'s machine menu outside a git repository', () => {
  for (const location of [NOT_GIT, { kind: 'noSuchDirectory', cwd: '/x' }]) {
    const menu = buildMenu(location);
    assert.deepEqual(ids(menu), MENU_ITEMS);
    assert.equal(menu.some((entry) => entry.header), false);
  }
  assert.deepEqual(
    buildMenu(NOT_GIT).map((entry) => entry.label),
    ['Status', 'Doctor', 'Install', 'Update', 'Upgrade', 'Uninstall', 'Quit'],
  );
});

test('buildMenu offers Init, then the machine section, in a repository that is not initialized', () => {
  const menu = buildMenu(NOT_INITIALIZED);
  assert.deepEqual(ids(menu), ['[project]', 'project-init', '[machine]', ...MENU_ITEMS]);
  assert.equal(menu[1].label, 'Init');
});

test('buildMenu offers Sync, Status and Uninstall in an initialized project, stale and invalid ones included', () => {
  for (const location of [INITIALIZED, STALE, INVALID]) {
    const menu = buildMenu(location);
    assert.deepEqual(ids(menu), [...PROJECT_MENU, '[machine]', ...MENU_ITEMS], location.kind);
    assert.deepEqual(
      menu.slice(1, 4).map((entry) => entry.label),
      ['Sync', 'Status', 'Uninstall'],
    );
  }
});

test('initialState starts on the first selectable item, never on a header', () => {
  assert.equal(initialState({ installedVersion: '0.1.0', updateAvailable: null }).selected, 0);
  const inRepo = initialState({ installedVersion: '0.1.0', updateAvailable: null, location: INITIALIZED });
  assert.equal(inRepo.menu[inRepo.selected].id, 'project-sync');
});

test('render draws the section headers unselectable, with the selection on an item', () => {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: null, location: INITIALIZED });
  const text = render(state).join('\n');
  assert.match(text, /^project$/m);
  assert.match(text, /^machine$/m);
  assert.match(text, /^> Sync$/m);
  assert.match(text, /^ {2}Status$/m);
  assert.equal(text.match(/Status$/gm).length, 2, 'the project Status and the machine Status');
  assert.doesNotMatch(text, /^> (project|machine)$/m);
});

test('render outside a repository shows no section headers', () => {
  const text = render(initialState({ installedVersion: '0.1.0', updateAvailable: null })).join('\n');
  assert.doesNotMatch(text, /^(project|machine)$/m);
});

test('down and up skip the headers and wrap around the whole menu', () => {
  const start = stateAt(INITIALIZED, 'project-uninstall');
  const machineStatus = press(start, 'down').state;
  assert.equal(machineStatus.menu[machineStatus.selected].id, 'status', 'down from the last project item skips [machine]');
  const back = press(machineStatus, 'up').state;
  assert.equal(back.menu[back.selected].id, 'project-uninstall', 'up skips [machine] the other way');

  const first = stateAt(INITIALIZED, 'project-sync');
  const wrapped = press(first, 'up').state;
  assert.equal(wrapped.menu[wrapped.selected].id, 'quit', 'up from the first item skips [project] and wraps to Quit');
  const around = press(wrapped, 'down').state;
  assert.equal(around.menu[around.selected].id, 'project-sync', 'down from Quit wraps past [project]');
});

test('Init is a selectable project command; Sync and Status run directly', () => {
  assert.deepEqual(press(stateAt(NOT_INITIALIZED, 'project-init'), 'enter').effect, {
    type: 'run',
    command: 'project-init',
  });
  assert.deepEqual(press(stateAt(INITIALIZED, 'project-sync'), 'enter').effect, {
    type: 'run',
    command: 'project-sync',
  });
  assert.deepEqual(press(stateAt(INITIALIZED, 'project-status'), 'enter').effect, {
    type: 'run',
    command: 'project-status',
  });
  assert.deepEqual(press(stateAt(INITIALIZED, 'status'), 'enter').effect, { type: 'run', command: 'status' });
});

test('the two uninstalls ask different questions and run different commands', () => {
  const project = press(stateAt(INITIALIZED, 'project-uninstall'), 'enter');
  assert.equal(project.effect, null);
  assert.equal(project.state.mode, 'confirm-uninstall');
  assert.match(render(project.state).join('\n'), /Undo js-harness in this project\? \(y\/N\)/);
  assert.doesNotMatch(render(project.state).join('\n'), /from this home/);
  assert.deepEqual(handleKey(project.state, 'y').effect, { type: 'run', command: 'project-uninstall' });
  assert.equal(handleKey(project.state, 'n').effect, null);

  const machine = press(stateAt(INITIALIZED, 'uninstall'), 'enter');
  assert.equal(machine.state.mode, 'confirm-uninstall');
  assert.match(render(machine.state).join('\n'), /Uninstall js-harness from this home\? \(y\/N\)/);
  assert.doesNotMatch(render(machine.state).join('\n'), /in this project/);
  assert.deepEqual(handleKey(machine.state, 'y').effect, { type: 'run', command: 'uninstall' });
});

test('withLocation rebuilds the menu and keeps the selection on the same item when it survives', () => {
  const state = stateAt(INITIALIZED, 'status');
  const next = withLocation(state, STALE);
  assert.equal(next.menu[next.selected].id, 'status');

  const moved = withLocation(stateAt(NOT_INITIALIZED, 'status'), INITIALIZED);
  assert.deepEqual(ids(moved.menu), [...PROJECT_MENU, '[machine]', ...MENU_ITEMS]);
  assert.equal(moved.menu[moved.selected].id, 'status', 'the machine item stays selected as the section above grows');
});

test('withLocation lands on a selectable, in-range item when the selected one disappears', () => {
  // After `init`: Init is gone, so the project section's first item is selected.
  const afterInit = withLocation(stateAt(NOT_INITIALIZED, 'project-init'), INITIALIZED);
  assert.equal(afterInit.menu[afterInit.selected].id, 'project-sync');
  // After a project `uninstall`: back to Init.
  const afterUninstall = withLocation(stateAt(INITIALIZED, 'project-uninstall'), NOT_INITIALIZED);
  assert.equal(afterUninstall.menu[afterUninstall.selected].id, 'project-init');
  // Out of the repository entirely: the machine menu, selection in range.
  const outside = withLocation(stateAt(INITIALIZED, 'project-status'), NOT_GIT);
  assert.ok(outside.selected >= 0 && outside.selected < outside.menu.length);
  assert.ok(!outside.menu[outside.selected].header);
  assert.deepEqual(ids(outside.menu), MENU_ITEMS);
});

test('withLocation leaves the mode alone and never touches the version or stack', () => {
  const state = { ...stateAt(INITIALIZED, 'project-status'), stack: 'unknown', installedVersion: '9.9.9' };
  const next = withLocation(state, INITIALIZED);
  assert.equal(next.stack, 'unknown');
  assert.equal(next.installedVersion, '9.9.9');
  assert.equal(next.mode, 'menu');
});

test('runTui rereads the location after a command and redraws the rebuilt menu', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const calls = [];
  let location = NOT_INITIALIZED;
  const commands = {
    ...noCommands,
    'project-init': async () => {
      calls.push('project-init');
      location = INITIALIZED;
    },
  };
  const done = runTui({
    installedVersion: '0.1.0',
    updateAvailable: null,
    location,
    readLocation: () => location,
    commands,
    stdin,
    stdout,
  });
  assert.match(stdout.chunks.join(''), /^> Init$/m);

  stdin.emit('data', '\r'); // Enter on Init
  await flush();

  assert.deepEqual(calls, ['project-init']);
  const redraw = stdout.chunks.at(-1);
  assert.match(redraw, /^> Sync$/m);
  assert.doesNotMatch(redraw, /Init/);
  assert.match(redraw, /Uninstall/);

  stdin.emit('data', 'q');
  await done;
});

// --- T5: project commands, bound to the repository root ---

function makeFixtureRepo(prefix = 'js-harness-tui-project-') {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  assert.equal(spawnSync('git', ['init'], { cwd: repo, encoding: 'utf8' }).status, 0);
  // Pre-created, so `init` never spawns a real `codegraph` (as in js-harness.test.mjs).
  fs.mkdirSync(path.join(repo, '.codegraph'));
  return repo;
}

async function silently(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  const lines = [];
  console.log = (line) => lines.push(String(line));
  console.error = (line) => lines.push(String(line));
  try {
    return { result: await fn(), lines };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('buildCommands binds the project commands to the root: init, status, sync, uninstall', async () => {
  const repo = makeFixtureRepo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-project-home-'));
  try {
    const commands = buildCommands({ home, root: repo });

    const init = await silently(() => commands['project-init']());
    assert.equal(init.result, 0, init.lines.join('\n'));
    assert.ok(fs.existsSync(path.join(repo, 'harness.json')));

    const status = await silently(() => commands['project-status']());
    assert.equal(status.result, 0);
    assert.match(status.lines.join('\n'), /pinned version: /);

    const sync = await silently(() => commands['project-sync']());
    assert.equal(sync.result, 0, sync.lines.join('\n'));
    assert.match(sync.lines.join('\n'), /up to date/);

    const uninstall = await silently(() => commands['project-uninstall']());
    assert.equal(uninstall.result, 0, uninstall.lines.join('\n'));
    assert.equal(fs.existsSync(path.join(repo, 'harness.json')), false);

    assert.deepEqual(fs.readdirSync(home), [], 'project commands never write under the home');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('buildCommands leaves the project commands out when there is no project root', () => {
  const commands = buildCommands({ home: os.tmpdir() });
  for (const id of ['project-init', 'project-sync', 'project-status', 'project-uninstall']) {
    assert.equal(commands[id], undefined, id);
  }
});

// The machine status is the machine's wherever the TUI opened: inside a repository a plain `status`
// would report that project instead (or refuse for it).
test('buildCommands status reports the machine install even when run inside a git repository', async () => {
  const repo = makeFixtureRepo('js-harness-tui-status-repo-');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-status-home-'));
  const originalCwd = process.cwd();
  try {
    process.chdir(repo);
    const spawn = () => ({ status: 0, stdout: '', stderr: '' });

    const { result, lines } = await silently(() => buildCommands({ home, spawn }).status());

    assert.equal(result, 0, lines.join('\n'));
    assert.match(lines.join('\n'), /manifest version: /);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('tuiMain in a repository shows the project section, inits it, and offers Sync/Status/Uninstall after', async () => {
  const repo = makeFixtureRepo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-project-home-'));
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const spawn = () => ({ status: 0, stdout: '', stderr: '' });
  try {
    const { result: done } = await silently(async () => {
      const running = tuiMain(['--cwd', repo, '--home', home], {}, spawn, { stdin, stdout });
      await flush();
      const opening = stdout.chunks.join('');
      assert.match(opening, /^project$/m);
      assert.match(opening, /^machine$/m);
      assert.match(opening, /^> Init$/m);

      stdin.emit('data', '\r'); // Init, for real, in the fixture repository
      await flush();
      assert.ok(fs.existsSync(path.join(repo, 'harness.json')));
      const afterInit = stdout.chunks.at(-1);
      assert.match(afterInit, /^> Sync$/m);
      assert.doesNotMatch(afterInit, /Init/);

      stdin.emit('data', 'j');
      stdin.emit('data', 'j'); // Uninstall (project)
      stdin.emit('data', '\r');
      await flush();
      assert.match(stdout.chunks.at(-1), /Undo js-harness in this project\? \(y\/N\)/);
      stdin.emit('data', 'y');
      await flush();
      assert.equal(fs.existsSync(path.join(repo, 'harness.json')), false);
      assert.match(stdout.chunks.at(-1), /^> Init$/m, 'the menu goes back to Init once the project is undone');

      stdin.emit('data', 'q');
      return running;
    });
    assert.equal(done, 0);
    assert.deepEqual(fs.readdirSync(home), [], 'nothing was written under the home');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('tuiMain --cwd outside any repository opens the machine menu only', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const spawn = () => ({ status: 0, stdout: '', stderr: '' });
  const done = tuiMain(['--cwd', nonGitDir, '--home', nonGitDir], {}, spawn, { stdin, stdout });
  await flush();
  const opening = stdout.chunks.join('');
  assert.doesNotMatch(opening, /^(project|machine)$/m);
  assert.match(opening, /^> Status$/m);
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});
