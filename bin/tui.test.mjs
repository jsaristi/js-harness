import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MENU_ITEMS,
  initialState,
  handleKey,
  render,
  normalizeKey,
  runTui,
  tuiMain,
  worstState,
  summarizeStackRow,
  computeStackState,
} from './tui.mjs';

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

  const done = tuiMain([], {}, spawn, { stdin, stdout });
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
    const done = tuiMain([], { JS_HARNESS_HOME: home }, spawn, { stdin, stdout });
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
    const done = tuiMain([], { JS_HARNESS_HOME: home }, spawn, { stdin, stdout, fetch: fetchImpl });
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
    const done = tuiMain([], { JS_HARNESS_HOME: home }, spawn, { stdin, stdout, fetch: fetchImpl });
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
