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
  hasMemorySnapshots,
} from './tui.mjs';
import { installMain } from './install.mjs';
import { manifestPath, recordOptionalFile, recordScheduledTask } from './lib/manifest.mjs';
import { GAP_STATES } from './lib/digest.mjs';
import { launcherFileName, loginLauncher, remoteFiles, remoteId } from './lib/remote.mjs';
import { spawnSync } from 'node:child_process';

// T5: the menu depends on where the TUI opens, and these tests run real `git`: keep it off the host's
// git config (see project.test.mjs, T2e item 8), and give every machine-menu test a folder outside any
// repository, since the default (this repo's own checkout) is now a project.
let nonGitDir;
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-nongit-'));
});
after(() => {
  fs.rmSync(nonGitDir, { recursive: true, force: true });
  fs.rmSync(configDir, { recursive: true, force: true });
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

test('render says a newer copy is installed, and offers no update, while the menu runs an older one', () => {
  const state = initialState({ installedVersion: '1.0.0', updateAvailable: null, installedCopy: '1.1.0' });
  assert.equal(render(state)[0], 'js-harness 1.0.0  (1.1.0 installed: quit and open js-harness again to use it)');
  // The same version, or none recorded, changes nothing in the header.
  for (const installedCopy of ['1.0.0', null]) {
    assert.equal(render(initialState({ installedVersion: '1.0.0', updateAvailable: null, installedCopy }))[0], 'js-harness 1.0.0');
  }
});

test('runTui reads the update again after a command: an Upgrade that installed the release says to open the menu again', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  let upgraded = false;
  const done = runTui({
    installedVersion: '1.0.0',
    updateAvailable: '1.1.0',
    readUpdate: () => (upgraded ? { updateAvailable: null, installedCopy: '1.1.0' } : { updateAvailable: '1.1.0', installedCopy: '1.0.0' }),
    commands: { ...noCommands, status: async () => { upgraded = true; } },
    stdin,
    stdout,
  });
  assert.match(stdout.chunks.at(-1), /^js-harness 1\.0\.0 {2}\(update available: 1\.1\.0\)$/m);
  stdin.emit('data', '\r');
  await flush();
  assert.match(stdout.chunks.at(-1), /^js-harness 1\.0\.0 {2}\(1\.1\.0 installed: quit and open js-harness again to use it\)$/m);
  assert.doesNotMatch(stdout.chunks.at(-1), /update available/);
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('render shows a confirmation prompt in confirm mode', () => {
  const base = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  const state = { ...base, mode: 'confirm', pending: 'uninstall' };
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
  assert.equal(next.mode, 'confirm');
  assert.equal(next.pending, 'uninstall');
  assert.equal(effect, null);
});

test('y confirms the uninstall; anything else cancels back to the menu', () => {
  const base = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  const confirming = { ...base, mode: 'confirm', pending: 'uninstall' };

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

// T10 (odd/tasks/memory-hygiene.md, D7.8): with memory snapshots in the home, the yes to Uninstall is followed by a
// second question, whose yes adds --full; without them the yes runs the uninstall as before.
test('with memory snapshots, the yes to Uninstall asks whether to remove them too: y full, n or enter normal, escape cancels', () => {
  const base = initialState({ installedVersion: '0.1.0', updateAvailable: null, memorySnapshots: true });
  const asked = handleKey({ ...base, mode: 'confirm', pending: 'uninstall' }, 'y');
  assert.deepEqual([asked.state.mode, asked.state.pending, asked.effect], ['confirm', 'uninstall-full', null]);
  assert.match(render(asked.state).join('\n'), /Remove the memory snapshots too, the only copy of what a pass changed\? \(y\/N\)$/);
  assert.deepEqual(handleKey(asked.state, 'y').effect, { type: 'run', command: 'uninstall-full' });
  assert.deepEqual(handleKey(asked.state, 'n').effect, { type: 'run', command: 'uninstall' });
  assert.deepEqual(handleKey(asked.state, 'enter').effect, { type: 'run', command: 'uninstall' });
  const escaped = handleKey(asked.state, 'escape');
  assert.deepEqual([escaped.state.mode, escaped.effect], ['menu', null]);
});

test('buildCommands uninstall-full removes the memory snapshots, which the normal uninstall keeps', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-home-'));
  const originalLog = console.log;
  try {
    const project = path.join(home, '.js-harness', 'memory-hygiene', 'C--proj');
    fs.mkdirSync(path.join(project, 'snapshots', '20261015T120606108Z'), { recursive: true });
    assert.equal(hasMemorySnapshots(home), true);
    console.log = () => {};
    assert.equal(await buildCommands({ home }).uninstall(), 0);
    assert.equal(hasMemorySnapshots(home), true, 'the normal uninstall keeps them');
    assert.equal(await buildCommands({ home })['uninstall-full'](), 0);
    assert.equal(hasMemorySnapshots(home), false);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    console.log = originalLog;
    fs.rmSync(home, { recursive: true, force: true });
  }
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

test('runTui asks the second question while snapshots are there, and reads again after each command whether they are', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const calls = [];
  let snapshots = true;
  const commands = {
    uninstall: async () => calls.push('uninstall'),
    'uninstall-full': async () => {
      calls.push('uninstall-full');
      snapshots = false;
    },
  };
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, memorySnapshots: true, readSnapshots: () => snapshots, commands, stdin, stdout });
  for (let i = 0; i < MENU_ITEMS.indexOf('uninstall'); i++) stdin.emit('data', 'j');
  for (const key of ['\r', 'y', 'n', '\r', 'y', 'y', '\r', 'y']) {
    stdin.emit('data', key);
    await flush();
  }
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
  assert.deepEqual(calls, ['uninstall', 'uninstall-full', 'uninstall'], 'with none left, the yes runs the uninstall alone');
});

// release-095 S5 (Pregunta 17): Uninstall everything sits after Uninstall, asks once, naming the folder and the
// program, and runs `uninstall --global --everything`.
test('Uninstall everything follows Uninstall, asks naming the folder and the program, y runs it, n cancels', () => {
  assert.equal(MENU_ITEMS.indexOf('uninstall-everything'), MENU_ITEMS.indexOf('uninstall') + 1);
  const base = initialState({ installedVersion: '0.1.0', updateAvailable: null, memorySnapshots: true });
  assert.match(render(base).join('\n'), /^ {2}Uninstall everything$/m);
  const asked = handleKey({ ...base, selected: MENU_ITEMS.indexOf('uninstall-everything') }, 'enter');
  assert.deepEqual([asked.state.mode, asked.state.pending, asked.effect], ['confirm', 'uninstall-everything', null]);
  assert.match(
    render(asked.state).join('\n'),
    /Remove everything js-harness keeps on this machine: the whole \.js-harness folder of this home \(the lead's notes, the backups, the memory snapshots\) and the js-harness program itself\? This cannot be undone\. \(y\/N\)$/,
  );
  assert.deepEqual(handleKey(asked.state, 'y').effect, { type: 'run', command: 'uninstall-everything' }, 'one question, snapshots or not');
  for (const key of ['n', 'enter', 'escape']) assert.deepEqual(handleKey(asked.state, key).effect, null, key);
});

test('runTui quits once Uninstall everything succeeds, and stays in the menu when it fails', async () => {
  for (const [result, expected] of [[0, ['uninstall-everything']], [1, ['uninstall-everything', 'status']]]) {
    const stdin = makeFakeStdin();
    const stdout = makeFakeStdout();
    const calls = [];
    const commands = {
      status: async () => calls.push('status'),
      'uninstall-everything': async () => {
        calls.push('uninstall-everything');
        return result;
      },
    };
    const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });
    for (let i = 0; i < MENU_ITEMS.indexOf('uninstall-everything'); i++) stdin.emit('data', 'j');
    for (const key of ['\r', 'y']) {
      stdin.emit('data', key);
      await flush();
    }
    if (result !== 0) {
      // Still in the menu: back to the top, run Status, then quit.
      for (let i = 0; i < MENU_ITEMS.indexOf('uninstall-everything'); i++) stdin.emit('data', 'k');
      stdin.emit('data', '\r');
      await flush();
      stdin.emit('data', 'q');
    }
    assert.equal(await done, 0, `result ${result}`);
    assert.deepEqual(calls, expected, `result ${result}`);
  }
});

test('buildCommands uninstall-everything removes the whole folder and, run from a checkout, keeps the program', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-home-'));
  const originalLog = console.log;
  const lines = [];
  try {
    fs.mkdirSync(path.join(home, '.js-harness', 'memory-hygiene', 'C--proj', 'snapshots', '20261015T120606108Z'), { recursive: true });
    fs.mkdirSync(path.join(home, '.js-harness', 'relief'), { recursive: true });
    console.log = (line) => lines.push(String(line));
    assert.equal(await buildCommands({ home })['uninstall-everything'](), 0);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
    assert.ok(lines.some((line) => line.startsWith('kept the js-harness program: this one runs from ')), lines.join('\n'));
  } finally {
    console.log = originalLog;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- CLI entry: tuiMain ---

// Opening the menu asks no package manager which release is the latest: the name `js-harness` is nobody's
// on the public registry. The injected spawn also serves the stack's probes, so what is asserted is that
// no call carries `view`, and that an answer of a newer version is shown nowhere.
test('tuiMain with no source asks no package manager for a release and shows no update', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const calls = [];
  const spawn = (cmd, args = []) => {
    calls.push([cmd, ...args]);
    return { status: 0, stdout: '99.0.0', stderr: '' };
  };

  const done = tuiMain(['--cwd', nonGitDir, '--home', nonGitDir], {}, spawn, { stdin, stdout });
  await flush();
  stdin.emit('data', 'q');
  const code = await done;

  assert.equal(code, 0);
  assert.deepEqual(calls.filter((call) => call.includes('view')), []);
  assert.ok(!stdout.chunks.join('').includes('update available'));
});

test('tuiMain opens the menu when the home\'s manifest cannot be read, as it did before it read the manifest', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-bad-manifest-'));
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  try {
    fs.mkdirSync(path.dirname(manifestPath(home)), { recursive: true });
    fs.writeFileSync(manifestPath(home), '{');
    const done = tuiMain(['--cwd', nonGitDir, '--home', home], {}, () => ({ status: 0, stdout: '', stderr: '' }), { stdin, stdout });
    await flush();
    stdin.emit('data', 'q');
    assert.equal(await done, 0);
    assert.ok(stdout.chunks.join('').includes('Uninstall everything'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('tuiMain shows the update a named source folder holds, and its commands read that same folder', async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-source-'));
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  try {
    fs.writeFileSync(path.join(source, 'js-harness-99.0.0.tgz'), '');
    const spawn = () => ({ status: 0, stdout: '', stderr: '' });

    const done = tuiMain(['--cwd', nonGitDir, '--home', nonGitDir, '--source', source], {}, spawn, { stdin, stdout });
    await flush();
    stdin.emit('data', 'q');
    const code = await done;

    assert.equal(code, 0);
    assert.ok(stdout.chunks[0].includes('update available: 99.0.0'));

    const { result, lines } = await silently(() => buildCommands({ home: nonGitDir, source, env: {}, spawn }).update());
    assert.equal(result, 0);
    assert.match(lines.join('\n'), /update available: 99\.0\.0/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
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

test('worstState reports a stale host cell instead of passing it as ok', () => {
  assert.equal(worstState(makeDoctorRow({ claude: 'stale' })), 'stale claude');
});

test('worstState reports accounts that differ as a gap as severe as a missing tool', () => {
  const account = { id: 'claude-account', version: null, installed: 'n/a', claude: 'mismatch', codex: 'n/a', project: 'n/a', upToDate: 'n/a' };
  assert.equal(worstState(account), 'mismatch claude');
  assert.deepEqual(summarizeStackRow(account), { id: 'claude-account', version: 'n/a', state: 'mismatch claude' });
  assert.equal(worstState({ ...account, claude: 'unknown' }), 'unknown claude');
  assert.equal(worstState({ ...account, claude: 'ok' }), 'ok');
  // As severe as `missing`: the first of the two wins, whichever it is, and both outrank `unknown`.
  assert.equal(worstState(makeDoctorRow({ claude: 'mismatch', codex: 'missing' })), 'mismatch claude');
  assert.equal(worstState(makeDoctorRow({ claude: 'missing', codex: 'mismatch' })), 'missing claude');
});

test('worstState reports a launcher whose server is down as a gap as severe as a missing tool', () => {
  const server = { id: 'remote-server', version: null, installed: 'n/a', claude: 'down', codex: 'n/a', project: 'n/a', upToDate: 'n/a' };
  assert.equal(worstState(server), 'down claude');
  assert.deepEqual(summarizeStackRow(server), { id: 'remote-server', version: 'n/a', state: 'down claude' });
  assert.equal(worstState({ ...server, claude: 'unknown' }), 'unknown claude');
  // No launcher recorded: there is nothing to be down.
  assert.equal(worstState({ ...server, claude: 'n/a' }), 'ok');
  assert.equal(worstState(makeDoctorRow({ installed: 'unknown', claude: 'down' })), 'down claude', 'it outranks unknown');
});

test('every state doctor and the session digest count as a gap outranks unknown in the stack block', () => {
  assert.ok(GAP_STATES.has('mismatch') && GAP_STATES.has('missing') && GAP_STATES.has('down'));
  for (const state of GAP_STATES) {
    assert.equal(worstState(makeDoctorRow({ installed: 'unknown', codex: state })), `${state} codex`, state);
  }
  for (const state of ['ok', 'n/a']) assert.equal(worstState(makeDoctorRow({ installed: 'unknown', codex: state })), 'unknown', state);
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
    const stack = await computeStackState({ home, cwd: home, spawn, fetch: fetchImpl, env: {} });
    assert.equal(fetchCalled, false, 'the stack block must never touch the network');
    assert.ok(Array.isArray(stack));
    assert.deepEqual(
      stack.map((r) => r.id),
      ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex', 'memory-rules', 'session-classes', 'claude-account', 'remote-server', 'pnpm-lock', 'js-harness'],
    );
    assert.match(stack.find((row) => row.id === 'js-harness').version, /^[0-9a-f]{8}$/, "the harness's own rules, by their hash, main unread");
    assert.deepEqual(stack.find((row) => row.id === 'claude-account'), { id: 'claude-account', version: 'n/a', state: 'unknown claude' }, 'an empty home names no account');
    assert.deepEqual(stack.find((row) => row.id === 'remote-server'), { id: 'remote-server', version: 'n/a', state: 'ok' }, 'an empty home records no launcher, so no server is down');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('computeStackState shows accounts that differ as a mismatch in the stack block, and no identifier', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-stack-'));
  const [cli, app] = ['11111111-aaaa-4bbb-8ccc-000000000001', '22222222-dddd-4eee-8fff-000000000002'];
  const spawn = () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });
  try {
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ oauthAccount: { accountUuid: cli } }));
    const appConfig = path.join(home, 'AppData', 'Roaming', 'Claude', 'config.json');
    fs.mkdirSync(path.dirname(appConfig), { recursive: true });
    fs.writeFileSync(appConfig, JSON.stringify({ lastKnownAccountUuid: app }));

    const stack = await computeStackState({ home, cwd: home, spawn, platform: 'win32', env: {} });

    assert.deepEqual(stack.find((row) => row.id === 'claude-account'), { id: 'claude-account', version: 'n/a', state: 'mismatch claude' });
    const state = { ...initialState({ installedVersion: '0.1.0', updateAvailable: null }), stack };
    const text = render(state).join('\n');
    assert.match(text, /claude-account\s+n\/a\s+mismatch claude/);
    assert.equal(text.includes(cli) || text.includes(app), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('computeStackState shows a recorded launcher whose server is not running as down in the stack block, and ok once it runs', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-stack-'));
  // The launcher of a project that is only named, in a folder of the test's: the manifest records where it is.
  const root = 'D:\\work\\proj';
  const launcher = path.join(home, 'Startup', launcherFileName(remoteId(root, 'win32')));
  const content = loginLauncher({ node: 'C:\\node\\node.exe', script: 'D:\\js-harness\\bin\\remote.mjs', root, name: 'proj' });
  // The process snapshot is the one thing answered: it lists the supervisor the state file will name.
  const spawn = (cmd) => (cmd === 'powershell'
    ? { status: 0, stdout: '4\t0\t1\tSystem\r\n4242\t4\t1759700000000\tnode.exe\r\n', stderr: '' }
    : { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });
  try {
    fs.mkdirSync(path.dirname(launcher), { recursive: true });
    fs.writeFileSync(launcher, content);
    recordOptionalFile(home, launcher, content);

    const down = await computeStackState({ home, cwd: home, spawn, platform: 'win32', env: {} });
    assert.deepEqual(down.find((row) => row.id === 'remote-server'), { id: 'remote-server', version: 'n/a', state: 'down claude' });
    const text = render({ ...initialState({ installedVersion: '0.1.0', updateAvailable: null }), stack: down }).join('\n');
    assert.match(text, /remote-server\s+n\/a\s+down claude/);

    const { statePath } = remoteFiles(home, remoteId(root, 'win32'));
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ pid: 4242, startedAt: 1759700000000 }));
    const running = await computeStackState({ home, cwd: home, spawn, platform: 'win32', env: {} });
    assert.deepEqual(running.find((row) => row.id === 'remote-server'), { id: 'remote-server', version: 'n/a', state: 'ok' });
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

// The menu's uninstall hands the engine no `schtasks`, so the engine's own default applies, and it refuses to run
// the real program from a test before it even looks at the environment, on any host. A recorded watchdog task is
// therefore kept and reported here, never deleted from this machine by a test.
test('buildCommands uninstall cannot reach the real schtasks from a test: a recorded task is reported as left, and the rest is undone', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-task-home-'));
  const original = { log: console.log, error: console.error };
  const errors = [];
  try {
    console.log = () => {};
    console.error = (line) => errors.push(String(line));
    await installMain(['--home', home]);
    const task = { name: 'js-harness-remote-x', command: 'conhost.exe', arguments: '--headless node remote.mjs start --watchdog' };
    recordScheduledTask(home, task);

    const code = await buildCommands({ home }).uninstall();

    assert.equal(code, 1, 'a task left behind is not a clean uninstall');
    assert.match(errors.join('\n'), /^could not look for scheduled task js-harness-remote-x \(the real schtasks\.exe is never run from a test/);
    assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath(home), 'utf8')), { version: null, files: [], entries: [], tasks: [task] }, 'the install is undone, and the task that may still fire stays recorded');
  } finally {
    Object.assign(console, original);
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
const NO_PIN = { kind: 'noPin', root: '/repo', harnessJsonPath: '/repo/harness.json', manifestPresent: false };

/** A menu as one comparable list: headers as `[label]`, items by id. */
const ids = (menu) => menu.map((entry) => (entry.header ? `[${entry.label}]` : entry.id));
const REMOTE_MENU = ['project-remote-status', 'project-remote-start', 'project-remote-stop'];
const PROJECT_MENU = ['[project]', 'project-sync', 'project-status', 'project-uninstall', ...REMOTE_MENU];

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
    ['Status', 'Doctor', 'Install', 'Update', 'Upgrade', 'Uninstall', 'Uninstall everything', 'Quit'],
  );
});

test('buildMenu offers Init, then the machine section, in a repository that is not initialized', () => {
  const menu = buildMenu(NOT_INITIALIZED);
  assert.deepEqual(ids(menu), ['[project]', 'project-init', ...REMOTE_MENU, '[machine]', ...MENU_ITEMS]);
  assert.equal(menu[1].label, 'Init');
});

test('buildMenu offers the remote server after the project items in every git repository, and never outside one', () => {
  for (const location of [NOT_INITIALIZED, INITIALIZED, STALE, INVALID, NO_PIN]) {
    const menu = buildMenu(location);
    const machine = menu.findIndex((entry) => entry.header && entry.label === 'machine');
    assert.deepEqual(ids(menu).slice(machine - 3, machine), REMOTE_MENU, `${location.kind}: the last three items of the project section`);
    assert.deepEqual(
      menu.slice(machine - 3, machine).map((entry) => entry.label),
      ['Remote status', 'Remote start', 'Remote stop'],
    );
  }
  for (const location of [NOT_GIT, { kind: 'noSuchDirectory', cwd: '/x' }]) {
    assert.equal(ids(buildMenu(location)).some((id) => id.includes('remote')), false, location.kind);
  }
  const everyLabel = [NOT_INITIALIZED, INITIALIZED].flatMap((location) => buildMenu(location).map((entry) => entry.label));
  assert.equal(everyLabel.some((label) => /login/i.test(label)), false, 'the login launcher is not offered here');
});

test('buildMenu offers Sync, Status and Uninstall in an initialized project, stale, invalid and unpinned ones included', () => {
  for (const location of [INITIALIZED, STALE, INVALID, NO_PIN]) {
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
  const start = stateAt(INITIALIZED, 'project-remote-stop');
  const machineStatus = press(start, 'down').state;
  assert.equal(machineStatus.menu[machineStatus.selected].id, 'status', 'down from the last project item skips [machine]');
  const back = press(machineStatus, 'up').state;
  assert.equal(back.menu[back.selected].id, 'project-remote-stop', 'up skips [machine] the other way');

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
  assert.equal(project.state.mode, 'confirm');
  assert.equal(project.state.pending, 'project-uninstall');
  assert.match(render(project.state).join('\n'), /Undo js-harness in this project\? \(y\/N\)/);
  assert.doesNotMatch(render(project.state).join('\n'), /from this home/);
  assert.deepEqual(handleKey(project.state, 'y').effect, { type: 'run', command: 'project-uninstall' });
  assert.equal(handleKey(project.state, 'n').effect, null);

  const machine = press(stateAt(INITIALIZED, 'uninstall'), 'enter');
  assert.equal(machine.state.mode, 'confirm');
  assert.equal(machine.state.pending, 'uninstall');
  assert.match(render(machine.state).join('\n'), /Uninstall js-harness from this home\? \(y\/N\)/);
  assert.doesNotMatch(render(machine.state).join('\n'), /in this project/);
  assert.deepEqual(handleKey(machine.state, 'y').effect, { type: 'run', command: 'uninstall' });
});

test('Remote status and Remote start run directly; Remote stop asks first, saying what it ends', () => {
  for (const location of [NOT_INITIALIZED, INITIALIZED]) {
    assert.deepEqual(press(stateAt(location, 'project-remote-status'), 'enter').effect, { type: 'run', command: 'project-remote-status' });
    assert.deepEqual(press(stateAt(location, 'project-remote-start'), 'enter').effect, { type: 'run', command: 'project-remote-start' });

    const stop = press(stateAt(location, 'project-remote-stop'), 'enter');
    assert.equal(stop.effect, null, 'nothing runs before the answer');
    assert.equal(stop.state.mode, 'confirm');
    assert.equal(stop.state.pending, 'project-remote-stop');
    const prompt = render(stop.state).at(-1);
    assert.match(prompt, /^Stop the remote server of this project\? .*\(y\/N\)$/);
    assert.match(prompt, /sessions opened through it/i, 'stopping the server ends them, and the prompt says so');
    assert.deepEqual(handleKey(stop.state, 'y').effect, { type: 'run', command: 'project-remote-stop' });
    for (const key of ['n', 'enter', 'escape']) {
      const cancelled = handleKey(stop.state, key);
      assert.equal(cancelled.effect, null, key);
      assert.equal(cancelled.state.mode, 'menu', key);
    }
  }
});

test('withLocation keeps a remote item selected while the repository stays one, and leaves it when the repository is gone', () => {
  const kept = withLocation(stateAt(NOT_INITIALIZED, 'project-remote-start'), INITIALIZED);
  assert.equal(kept.menu[kept.selected].id, 'project-remote-start', 'init changes the items above it, not this one');
  const outside = withLocation(stateAt(INITIALIZED, 'project-remote-stop'), NOT_GIT);
  assert.deepEqual(ids(outside.menu), MENU_ITEMS);
  assert.ok(!outside.menu[outside.selected].header);
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

// R4-stale-command-binding: a menu item never lacks its command, and the project it acts on is the one
// the menu was last built for, not the one the TUI happened to open on.
test('buildCommands has every project command with no root, and each refuses cleanly without a location', async () => {
  const commands = buildCommands({ home: os.tmpdir() });
  for (const id of ['project-init', 'project-sync', 'project-status', 'project-uninstall']) {
    assert.equal(typeof commands[id], 'function', id);
    await assert.rejects(() => commands[id](), /no project/, id);
  }
});

// --- remote: the server of the repository, through `remoteMain` ---

test('buildCommands runs remote status, start and stop on the root of the location, with the home, and returns its exit code', async () => {
  const calls = [];
  const env = { APPDATA: 'C:\\nowhere' };
  const remoteMain = async (argv, givenEnv) => {
    calls.push({ argv, env: givenEnv });
    return argv[0] === 'stop' ? 1 : 0;
  };
  const commands = buildCommands({ home: '/home/x', root: '/opened', env, remoteMain });
  const location = { kind: 'notInitialized', root: '/current' };

  assert.equal(await commands['project-remote-status'](location), 0);
  assert.equal(await commands['project-remote-start'](location), 0);
  assert.equal(await commands['project-remote-stop'](location), 1, 'the command\'s own exit code');
  assert.equal(await commands['project-remote-status'](), 0);

  assert.deepEqual(calls.map((call) => call.argv), [
    ['status', '--cwd', '/current', '--home', '/home/x'],
    ['start', '--cwd', '/current', '--home', '/home/x'],
    ['stop', '--cwd', '/current', '--home', '/home/x'],
    ['status', '--cwd', '/opened', '--home', '/home/x'],
  ]);
  assert.ok(calls.every((call) => call.env === env), 'the same environment as every other command');
  assert.equal(calls.some((call) => call.argv.includes('--at-login')), false, 'the menu never turns the login launcher on or off');
});

test('the remote commands refuse cleanly without a location, and start nothing', async () => {
  let ran = 0;
  const commands = buildCommands({ home: os.tmpdir(), remoteMain: async () => { ran += 1; return 0; } });
  for (const id of ['project-remote-status', 'project-remote-start', 'project-remote-stop']) {
    assert.equal(typeof commands[id], 'function', id);
    await assert.rejects(() => commands[id](), /no project/, id);
  }
  assert.equal(ran, 0);
});

// The arguments the menu passes are ones the real command takes: `status`, which only reads, on a repository
// with no server, a home of its own and an APPDATA that is not this machine's.
test('Remote status reaches the real command with arguments it accepts', { skip: process.platform === 'win32' ? false : 'js-harness remote runs on Windows only' }, async () => {
  const repo = makeFixtureRepo('js-harness-tui-remote-');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-remote-home-'));
  try {
    const commands = buildCommands({ home, env: { APPDATA: path.join(home, 'Roaming') } });
    const status = await silently(() => commands['project-remote-status']({ kind: 'notInitialized', root: repo }));
    assert.equal(status.result, 0, status.lines.join('\n'));
    assert.match(status.lines.join('\n'), /^remote: not running$/m);
    assert.match(status.lines.join('\n'), /^login launcher: off$/m);
    assert.deepEqual(fs.readdirSync(home), [], 'reading the status writes nothing');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('project commands act on the root of the location they are given, not the one they were built with', async () => {
  const opened = makeFixtureRepo('js-harness-tui-opened-');
  const current = makeFixtureRepo('js-harness-tui-current-');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-rebind-home-'));
  try {
    const commands = buildCommands({ home, root: opened });

    const init = await silently(() => commands['project-init']({ kind: 'notInitialized', root: current }));

    assert.equal(init.result, 0, init.lines.join('\n'));
    assert.ok(fs.existsSync(path.join(current, 'harness.json')));
    assert.equal(fs.existsSync(path.join(opened, 'harness.json')), false);

    const bare = buildCommands({ home });
    const again = await silently(() => bare['project-status']({ kind: 'initialized', root: current }));
    assert.equal(again.result, 0);
    assert.match(again.lines.join('\n'), /pinned version: /);
  } finally {
    for (const dir of [opened, current, home]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runTui hands the command the location just read: open outside a repository, then Init on the new one', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const calls = [];
  let location = NOT_GIT;
  const commands = {
    ...noCommands,
    status: async () => {
      location = { kind: 'notInitialized', root: '/became/a/repo' }; // e.g. `git init` in another terminal
    },
    'project-init': async (at) => calls.push(at.root),
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

  stdin.emit('data', '\r'); // Status (machine) runs, then the re-read finds a repository
  await flush();
  assert.match(stdout.chunks.at(-1), /^project$/m);
  // Up, over the [machine] header and the remote items, to Init.
  for (let i = 0; i <= REMOTE_MENU.length; i++) stdin.emit('data', 'k');
  stdin.emit('data', '\r');
  await flush();

  assert.deepEqual(calls, ['/became/a/repo']);
  stdin.emit('data', 'q');
  await done;
});

// R3-001: whatever a command or the re-read does, the terminal comes back.
function pausable(stdin) {
  const state = { paused: false };
  stdin.pause = () => {
    state.paused = true;
  };
  stdin.resume = () => {
    state.paused = false;
  };
  return state;
}

for (const [label, fail] of [
  ['rejects', () => Promise.reject(new Error('boom\nsecond line'))],
  [
    'throws',
    () => {
      throw new Error('boom\nsecond line');
    },
  ],
]) {
  test(`runTui survives a command that ${label}: one line on stderr, stdin resumed, menu redrawn, q still quits`, async () => {
    const stdin = makeFakeStdin();
    const stdout = makeFakeStdout();
    const input = pausable(stdin);
    const commands = { ...noCommands, status: fail };
    const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });
    const before = stdout.chunks.length;

    const { lines } = await silently(async () => {
      stdin.emit('data', '\r');
      await flush();
    });

    assert.equal(input.paused, false, 'stdin must be resumed');
    assert.equal(lines.length, 1);
    assert.match(lines[0], /status failed: boom$/);
    assert.ok(stdout.chunks.length > before && /^> Status$/m.test(stdout.chunks.at(-1)), 'the menu is drawn again');

    stdin.emit('data', 'q');
    assert.equal(await done, 0);
  });
}

test('runTui strips C0 and C1 control characters from a failed command line (U+009B is a CSI on some terminals)', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const commands = {
    ...noCommands,
    status: () => {
      throw new Error('bad \u001b[2J \u009b2J \u0085 \u007f end');
    },
  };
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });

  const { lines } = await silently(async () => {
    stdin.emit('data', '\r');
    await flush();
  });

  assert.equal(lines.length, 1);
  assert.doesNotMatch(lines[0], /[\u0000-\u001f\u007f-\u009f]/);
  assert.match(lines[0], /status failed: bad \[2J 2J {2} end$/);

  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

for (const [label, fail] of [
  ['rejects', () => Promise.reject(new Error('cannot read'))],
  [
    'throws',
    () => {
      throw new Error('cannot read');
    },
  ],
]) {
  test(`runTui keeps the previous location when the re-read ${label}, and still redraws and quits`, async () => {
    const stdin = makeFakeStdin();
    const stdout = makeFakeStdout();
    const input = pausable(stdin);
    const done = runTui({
      installedVersion: '0.1.0',
      updateAvailable: null,
      location: NOT_INITIALIZED,
      readLocation: fail,
      commands: { ...noCommands, status: async () => {} },
      stdin,
      stdout,
    });
    for (let i = 0; i <= REMOTE_MENU.length; i++) stdin.emit('data', 'j'); // past the remote items, to machine Status
    const { lines } = await silently(async () => {
      stdin.emit('data', '\r');
      await flush();
    });

    assert.equal(input.paused, false);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /reading the project failed: cannot read$/);
    const redraw = stdout.chunks.at(-1);
    assert.match(redraw, /^project$/m, 'the menu of the previous location is drawn again');
    assert.match(redraw, /^> Status$/m);
    assert.match(redraw, /Init/);

    stdin.emit('data', 'q');
    assert.equal(await done, 0);
  });
}

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

// --- T5d: the stack block is read again after a command, like the location ---

const STACK_BEFORE = [{ id: 'codegraph', version: '1.6.0', state: 'missing project' }];
const STACK_AFTER = [{ id: 'codegraph', version: '1.6.0', state: 'ok' }];

test('runTui reads the stack again after a command and redraws the new block', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  let stack = STACK_BEFORE;
  const done = runTui({
    installedVersion: '0.1.0',
    updateAvailable: null,
    stack,
    readStack: () => stack,
    commands: {
      ...noCommands,
      status: async () => {
        stack = STACK_AFTER; // e.g. `init` created .codegraph/
      },
    },
    stdin,
    stdout,
  });
  assert.match(stdout.chunks.join(''), /codegraph\s+1\.6\.0\s+missing project/);

  stdin.emit('data', '\r');
  await flush();

  const redraw = stdout.chunks.at(-1);
  assert.match(redraw, /codegraph\s+1\.6\.0\s+ok/);
  assert.doesNotMatch(redraw, /missing project/);

  stdin.emit('data', 'q');
  await done;
});

test('a stack read that fails keeps the previous block, and the terminal still comes back', async () => {
  for (const fail of [
    () => Promise.reject(new Error('probe\nexploded')),
    () => {
      throw new Error('probe\nexploded');
    },
  ]) {
    const stdin = makeFakeStdin();
    const stdout = makeFakeStdout();
    const input = pausable(stdin);
    const done = runTui({
      installedVersion: '0.1.0',
      updateAvailable: null,
      stack: STACK_BEFORE,
      readStack: fail,
      commands: { ...noCommands, status: async () => {} },
      stdin,
      stdout,
    });

    const { lines } = await silently(async () => {
      stdin.emit('data', '\r');
      await flush();
    });

    assert.equal(input.paused, false, 'stdin must be resumed');
    assert.equal(lines.length, 1);
    assert.match(lines[0], /refreshing the stack failed: probe$/);
    assert.match(stdout.chunks.at(-1), /codegraph\s+1\.6\.0\s+missing project/, 'the previous block stays');

    stdin.emit('data', 'q');
    assert.equal(await done, 0);
  }
});

test('a failed location re-read does not stop the stack refresh', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const done = runTui({
    installedVersion: '0.1.0',
    updateAvailable: null,
    stack: STACK_BEFORE,
    readLocation: () => Promise.reject(new Error('git vanished')),
    readStack: () => STACK_AFTER,
    commands: { ...noCommands, status: async () => {} },
    stdin,
    stdout,
  });
  const { lines } = await silently(async () => {
    stdin.emit('data', '\r');
    await flush();
  });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /reading the project failed: git vanished$/);
  assert.match(stdout.chunks.at(-1), /codegraph\s+1\.6\.0\s+ok/, 'the stack was still refreshed');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('a failed stack read does not stop the location re-read', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const done = runTui({
    installedVersion: '0.1.0',
    updateAvailable: null,
    stack: STACK_BEFORE,
    location: NOT_INITIALIZED,
    readLocation: () => INITIALIZED,
    readStack: () => {
      throw new Error('nope');
    },
    commands: { ...noCommands, status: async () => {} },
    stdin,
    stdout,
  });
  for (let i = 0; i <= REMOTE_MENU.length; i++) stdin.emit('data', 'j'); // past the remote items, to machine Status
  await silently(async () => {
    stdin.emit('data', '\r');
    await flush();
  });
  assert.match(stdout.chunks.at(-1), /^> Status$/m);
  assert.match(stdout.chunks.at(-1), /Sync/, 'the location was still re-read');
  stdin.emit('data', 'q');
  await done;
});

test('tuiMain probes the stack again after a command, offline', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-restack-home-'));
  const probes = [];
  const spawn = (cmd, args) => {
    // Windows probes through a shell (`codegraph --version` as one string), elsewhere as file + args.
    if (args?.[0] === '--version' || String(cmd).endsWith(' --version')) probes.push(cmd);
    return { status: 0, stdout: '', stderr: '' };
  };
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    return { ok: false };
  };
  try {
    const { result: done } = await silently(async () => {
      const running = tuiMain(['--cwd', nonGitDir, '--home', home], {}, spawn, { stdin, stdout, fetch: fetchImpl });
      await flush();
      const atStart = probes.length;
      assert.ok(atStart > 0, 'the stack is probed when the TUI opens');

      stdin.emit('data', '\r'); // machine Status
      await flush();
      assert.equal(probes.length, atStart * 2, 'and once more after the command');
      assert.equal(fetchCalled, false, 'never the network');

      stdin.emit('data', 'q');
      return running;
    });
    assert.equal(done, 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
