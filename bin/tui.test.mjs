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
  childCommands,
  commandArgv,
  startRun,
  appendRunOutput,
  finishRun,
  sections,
  REFRESHING,
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

// The TUI repaints whole frames (`paint`, bin/lib/terminal.mjs): these read them back as text.
const FRAME_START = '\u001b[H';
function textOf(chunk) {
  return chunk
    .slice(chunk.lastIndexOf(FRAME_START))
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\r\n/g, '\n');
}
/** The text of the last frame painted. */
function screen(stdout) {
  return textOf(stdout.chunks.findLast((chunk) => chunk.includes(FRAME_START)) ?? '');
}
/** The last frame with its wrapped rows joined, for a prompt the window wraps. */
function flatScreen(stdout) {
  return screen(stdout).replace(/\n/g, ' ');
}
/** The text of every frame painted so far. */
function allText(stdout) {
  return stdout.chunks.filter((chunk) => chunk.includes(FRAME_START)).map(textOf).join('\n');
}
/** Waits until `predicate()` holds: a child run or a deferred read ends on its own clock. */
async function until(predicate, what = 'the screen to change', ms = 20_000) {
  const end = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
/** Waits for the result screen of a run, then presses Enter to go back to the menu. */
async function backToMenu(stdin, stdout) {
  await until(() => / \(exit \d+\)$|: cancelled;| failed: /m.test(screen(stdout)), 'the result screen');
  stdin.emit('data', '\r');
  await flush();
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
  assert.match(screen(stdout), /^js-harness 1\.0\.0 {2}\(update available: 1\.1\.0\)$/m);
  stdin.emit('data', '\r');
  await backToMenu(stdin, stdout);
  assert.match(screen(stdout), /^js-harness 1\.0\.0 {2}\(1\.1\.0 installed: quit and open js-harness again to use it\)$/m);
  assert.doesNotMatch(screen(stdout), /update available/);
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('render shows a confirmation prompt in confirm mode', () => {
  const base = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  const state = { ...base, mode: 'confirm', pending: 'uninstall-machine' };
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

// odd/tasks/uninstall-kinds.md, S2: one Uninstall item opens a submenu of the kinds, each asking its own y/N.
const KIND_LABELS = ['Machine', 'Machine + memory snapshots', 'Everything', 'Back'];

/** The menu state with Uninstall selected, and the submenu Enter opens on it. */
function openUninstall(location) {
  const base = initialState({ installedVersion: '0.1.0', updateAvailable: null, location });
  const onUninstall = { ...base, selected: base.menu.findIndex((entry) => entry.id === 'uninstall') };
  return { onUninstall, ...handleKey(onUninstall, 'enter') };
}

test('enter on Uninstall opens the submenu of the kinds, without running or asking anything', () => {
  const { state, effect } = openUninstall();
  assert.equal(effect, null);
  assert.equal(state.mode, 'menu');
  assert.deepEqual(state.menu.filter((entry) => !entry.header).map((entry) => entry.label), KIND_LABELS, 'outside a project there is no Project kind');
  assert.equal(state.menu[state.selected].id, 'uninstall-machine', 'the first kind is selected');
  const text = render(state).join('\n');
  assert.match(text, /^uninstall$/m, 'the submenu says what it is');
  assert.match(text, /^> Machine$/m);
  assert.match(text, /^ {2}Everything$/m);
  assert.doesNotMatch(text, /^ {2}Doctor$/m, 'the main menu is not drawn under it');
});

test('inside an initialized project the submenu starts with Project', () => {
  for (const location of [INITIALIZED, STALE, INVALID, NO_PIN]) {
    const { state } = openUninstall(location);
    assert.deepEqual(state.menu.filter((entry) => !entry.header).map((entry) => entry.label), ['Project', ...KIND_LABELS], location.kind);
    assert.equal(state.menu[state.selected].id, 'uninstall-project', location.kind);
  }
  const { state } = openUninstall(NOT_INITIALIZED);
  assert.deepEqual(state.menu.filter((entry) => !entry.header).map((entry) => entry.label), KIND_LABELS, 'a repository init never touched has nothing to undo');
});

test('Back and escape leave the submenu for the menu, on Uninstall; q still quits', () => {
  const { onUninstall, state } = openUninstall(INITIALIZED);
  const onBack = { ...state, selected: state.menu.findIndex((entry) => entry.id === 'back') };
  for (const [what, left] of [['Back', handleKey(onBack, 'enter')], ['escape', handleKey(state, 'escape')]]) {
    assert.equal(left.effect, null, what);
    assert.deepEqual(left.state.menu, onUninstall.menu, `${what}: the main menu is back`);
    assert.equal(left.state.menu[left.state.selected].id, 'uninstall', `${what}: on Uninstall`);
  }
  assert.deepEqual(handleKey(state, 'quit').effect, { type: 'quit' });
});

test('each kind asks its own question, saying what it removes and what it keeps; y runs it from the menu, anything else stays in the submenu', () => {
  const prompts = {
    'uninstall-project': /^Undo js-harness in this project\? It removes what init recorded in this clone and keeps the files you edited and the machine install\. \(y\/N\)$/,
    'uninstall-machine': /^Uninstall js-harness from this home\? It removes what install recorded and the folders js-harness keeps here, and keeps the files you edited, the memory snapshots, the throughput records and the program\. \(y\/N\)$/,
    'uninstall-snapshots': /^Uninstall js-harness from this home and remove the memory snapshots, the only copy of what a pass changed\? It keeps the files you edited, the throughput records and the program\. \(y\/N\)$/,
    'uninstall-everything': /^Remove everything js-harness keeps on this machine: the whole \.js-harness folder of this home \(the lead's notes, the backups, the memory snapshots\) and the js-harness program itself\? It keeps the projects' files\. This cannot be undone\. \(y\/N\)$/,
  };
  const { onUninstall, state } = openUninstall(INITIALIZED);
  for (const [kind, prompt] of Object.entries(prompts)) {
    const asked = handleKey({ ...state, selected: state.menu.findIndex((entry) => entry.id === kind) }, 'enter');
    assert.deepEqual([asked.state.mode, asked.state.pending, asked.effect], ['confirm', kind, null], kind);
    assert.match(render(asked.state).at(-1), prompt, kind);
    const yes = handleKey(asked.state, 'y');
    assert.deepEqual(yes.effect, { type: 'run', command: kind }, kind);
    assert.equal(yes.state.mode, 'menu', kind);
    assert.deepEqual(yes.state.menu, onUninstall.menu, `${kind}: the command runs from the main menu`);
    for (const key of ['n', 'enter', 'escape']) {
      const no = handleKey(asked.state, key);
      assert.equal(no.effect, null, `${kind} ${key}`);
      assert.deepEqual([no.state.mode, no.state.menu[no.state.selected].id], ['menu', kind], `${kind} ${key}: back in the submenu`);
    }
  }
});

test('buildCommands uninstall-snapshots removes the memory snapshots, which uninstall-machine keeps', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-home-'));
  const originalLog = console.log;
  try {
    const snapshot = path.join(home, '.js-harness', 'memory-hygiene', 'C--proj', 'snapshots', '20261015T120606108Z');
    fs.mkdirSync(snapshot, { recursive: true });
    console.log = () => {};
    assert.equal(await buildCommands({ home })['uninstall-machine'](), 0);
    assert.equal(fs.existsSync(snapshot), true, 'the machine uninstall keeps them');
    assert.equal(await buildCommands({ home })['uninstall-snapshots'](), 0);
    assert.equal(fs.existsSync(snapshot), false);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    console.log = originalLog;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('q, ctrl+c and enter on Quit request quitting; Esc on the main menu is Back, with nowhere to go back to', () => {
  const state = initialState({ installedVersion: '0.1.0', updateAvailable: null });
  assert.deepEqual(handleKey(state, 'quit').effect, { type: 'quit' });
  assert.deepEqual(handleKey(state, 'ctrl-c').effect, { type: 'quit' });
  assert.deepEqual(handleKey(state, 'escape'), { state, effect: null });

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
  assert.ok(allText(stdout).includes('Status'));
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
    'uninstall-machine': async () => calls.push('uninstall-machine'),
  };

  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });

  for (let i = 0; i < MENU_ITEMS.indexOf('uninstall'); i++) stdin.emit('data', 'j');
  stdin.emit('data', '\r'); // Enter opens the submenu, on Machine
  await flush();
  assert.match(screen(stdout), /^> Machine$/m);
  stdin.emit('data', '\r'); // Enter opens the confirmation
  await flush();
  assert.ok(screen(stdout).includes('y/N'));

  stdin.emit('data', 'y');
  await backToMenu(stdin, stdout);
  assert.match(screen(stdout), /^> Uninstall$/m, 'the menu is drawn again, on Uninstall');
  stdin.emit('data', 'q');

  const code = await done;
  assert.equal(code, 0);
  assert.deepEqual(calls, ['uninstall-machine']);
});

// release-095 S5 (Pregunta 17): Everything asks once, naming the folder and the program, and runs
// `uninstall everything`; it is the last kind of the submenu, before Back.
test('Everything is the last kind of the submenu, before Back', () => {
  const { state } = openUninstall();
  assert.deepEqual(state.menu.slice(-2).map((entry) => entry.id), ['uninstall-everything', 'back']);
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
    for (let i = 0; i < MENU_ITEMS.indexOf('uninstall'); i++) stdin.emit('data', 'j');
    // Uninstall, then Everything (the third kind outside a project), then the yes.
    for (const key of ['\r', 'j', 'j', '\r', 'y']) {
      stdin.emit('data', key);
      await flush();
    }
    if (result === 0) {
      // The result says the menu itself is gone, and leaving it ends the menu.
      assert.match(flatScreen(stdout), /Everything js-harness kept is removed, this menu included: Enter, Esc or q closes it\./);
      stdin.emit('data', '\r');
    } else {
      // Back in the menu, on Uninstall: back to the top, run Status, then quit.
      await backToMenu(stdin, stdout);
      for (let i = 0; i < MENU_ITEMS.indexOf('uninstall'); i++) stdin.emit('data', 'k');
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

  // A repository with no tags, as JS_HARNESS_REPO names it for update and status: the header never asks the
  // network, so the test holds whatever the real repository has tagged.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-no-tags-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0);
    const done = tuiMain(['--cwd', nonGitDir, '--home', nonGitDir], { JS_HARNESS_REPO: repo }, spawn, { stdin, stdout });
    await flush();
    stdin.emit('data', 'q');
    const code = await done;

    assert.equal(code, 0);
    assert.deepEqual(calls.filter((call) => call.includes('view')), []);
    assert.ok(!allText(stdout).includes('update available'));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
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
    assert.match(allText(stdout), /^ {2}Uninstall$/m);
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
    // S5: the first frame comes before the lookup, which fills the header after it.
    assert.match(allText(stdout).split('js-harness ')[1], /checking for updates/);
    assert.match(allText(stdout), /stack: checking\.\.\./);
    await until(() => screen(stdout).includes('update available: 99.0.0'), 'the update in the header');
    stdin.emit('data', 'q');
    const code = await done;

    assert.equal(code, 0);

    const { result, lines } = await silently(() => buildCommands({ home: nonGitDir, source, env: {}, spawn }).update());
    assert.equal(result, 0);
    assert.match(lines.join('\n'), /update available: 99\.0\.0/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});

/** How many steps down Install is in the menu the last frame drew: one more when Install the stack is there. */
function installIndex(stdout) {
  return MENU_ITEMS.indexOf('install') + (screen(stdout).includes('Install the stack') ? 1 : 0);
}

test('tuiMain resolves home from JS_HARNESS_HOME when --home is not given', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const spawn = () => ({ status: 0, stdout: '', stderr: '' });
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-envhome-'));
  try {
    const done = tuiMain(['--cwd', nonGitDir], { JS_HARNESS_HOME: home }, spawn, { stdin, stdout });
    await flush();
    // A home with no context7 has a stack gap (F8 S11, G11), so Install the stack sits above Install once the
    // stack block, read after the first draw (S5), has filled in.
    await until(() => !screen(stdout).includes('stack: checking'), 'the stack block');
    for (let i = 0; i < installIndex(stdout); i++) stdin.emit('data', 'j'); // down to Install
    stdin.emit('data', '\r'); // run it, as a child `js-harness install`
    await backToMenu(stdin, stdout);
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

test('tuiMain takes an empty JS_HARNESS_HOME as no home: the install goes to the user\'s home folder, and the folder the menu runs in stays empty', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const spawn = () => ({ status: 0, stdout: '', stderr: '' });
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-emptyhome-'));
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tui-workdir-'));
  const original = process.cwd();
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.chdir(workdir);
  try {
    const done = tuiMain(['--cwd', nonGitDir], { JS_HARNESS_HOME: '' }, spawn, { stdin, stdout });
    await flush();
    // A home with no context7 has a stack gap (F8 S11, G11), so Install the stack sits above Install once the
    // stack block, read after the first draw (S5), has filled in.
    await until(() => !screen(stdout).includes('stack: checking'), 'the stack block');
    for (let i = 0; i < installIndex(stdout); i++) stdin.emit('data', 'j'); // down to Install
    stdin.emit('data', '\r'); // run it, as a child `js-harness install`
    await backToMenu(stdin, stdout);
    stdin.emit('data', 'q');
    const code = await done;

    assert.equal(code, 0);
    assert.ok(
      fs.existsSync(path.join(home, '.js-harness', 'manifest.json')),
      'install bound by the TUI should have written into the home folder',
    );
    assert.deepEqual(fs.readdirSync(workdir), [], 'nothing is written in the folder the menu runs in');
  } finally {
    process.chdir(original);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

// Redraw in place: bytes measured 2026-09-26 on Windows (PowerShell 7.6 -> cmd -> node, raw mode):
// down = ESC [ B, up = ESC [ A, Enter = \r.
const noCommands = {
  status: async () => {}, doctor: async () => {}, install: async () => {}, update: async () => {},
  upgrade: async () => {}, uninstall: async () => {},
};

test('runTui repaints the whole frame from the top-left when the selection moves, never moving up over what it counted', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: noCommands, stdin, stdout });

  const before = stdout.chunks.length;
  stdin.emit('data', '\u001b[B');
  await flush();
  const redraw = stdout.chunks.slice(before).join('');
  assert.ok(redraw.startsWith('\u001b[H'), `expected a repaint from home, got ${JSON.stringify(redraw.slice(0, 12))}`);
  assert.doesNotMatch(redraw, /\u001b\[\d+A/, 'no cursor-up erase, which miscounts wrapped rows');
  assert.match(screen(stdout), /^> Doctor$/m);

  stdin.emit('data', 'q');
  await done;
});

// S2: the frame fits the window it is drawn in, and is drawn again when the window changes.
test('runTui lays every frame out to the window, and repaints it on resize', async () => {
  const stdin = makeFakeStdin();
  const stdout = Object.assign(new EventEmitter(), makeFakeStdout(), { columns: 30, rows: 8 });
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: '0.2.0', stack: [{ id: 'engram', version: '4.2.0', state: 'missing codex' }], commands: noCommands, stdin, stdout });
  const fits = (columns, rows) => {
    const lines = screen(stdout).split('\n');
    assert.ok(lines.length <= rows, `${lines.length} rows in a window of ${rows}`);
    for (const line of lines) assert.ok(line.length < columns, `${JSON.stringify(line)} in a window ${columns} wide`);
  };
  fits(30, 8);
  assert.match(screen(stdout), /^> Status$/m, 'the selection is on screen');
  const before = stdout.chunks.length;
  Object.assign(stdout, { columns: 100, rows: 40 });
  stdout.emit('resize');
  assert.ok(stdout.chunks.length > before, 'a resize repaints');
  fits(100, 40);
  assert.match(screen(stdout), /^js-harness 0\.1\.0 {2}\(update available: 0\.2\.0\)$/m);
  stdin.emit('data', 'q');
  await done;
  assert.equal(stdout.listenerCount('resize'), 0, 'the menu stops listening once it quits');
});

// S1: the menu takes the alternate screen and gives the terminal back, however it ends.
test('runTui opens on the alternate screen with the cursor hidden and raw keys, and restores them on quit', async () => {
  const stdin = makeFakeStdin();
  const raw = [];
  stdin.setRawMode = (on) => raw.push(on);
  const stdout = makeFakeStdout();
  const proc = new EventEmitter();
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: noCommands, stdin, stdout, proc });
  assert.ok(stdout.chunks[0].startsWith('\u001b[?1049h'), 'the alternate screen first');
  assert.ok(stdout.chunks[0].includes('\u001b[?25l'), 'the cursor hidden');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
  assert.deepEqual(raw, [true, false]);
  assert.equal(stdout.chunks.at(-1), '\u001b[?25h\u001b[?1049l', 'the cursor and the main screen come back last');
  assert.equal(proc.listenerCount('SIGINT'), 0);
});

test('runTui restores the terminal and ends on SIGINT from outside, stopping a running command with it', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const proc = new EventEmitter();
  let aborted = false;
  const commands = { ...noCommands, status: (location, { signal }) => new Promise((resolve) => signal.addEventListener('abort', () => { aborted = true; resolve({ code: null, cancelled: true }); })) };
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout, proc });
  stdin.emit('data', '\r');
  await flush();
  proc.emit('SIGINT');
  assert.equal(await done, 130);
  assert.equal(aborted, true);
  assert.equal(stdout.chunks.at(-1), '\u001b[?25h\u001b[?1049l');
});

test('runTui gives the terminal back when drawing fails, and rejects with the error', async () => {
  const stdin = makeFakeStdin();
  const writes = [];
  let failing = false;
  const stdout = { write: (s) => { if (failing && s.startsWith('\u001b[H')) throw new Error('write EPIPE'); writes.push(s); } };
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: noCommands, stdin, stdout, proc: new EventEmitter() });
  failing = true;
  stdin.emit('data', 'j');
  await assert.rejects(done, /EPIPE/);
  assert.equal(writes.at(-1), '\u001b[?25h\u001b[?1049l');
});

// S3: keys are read one by one out of a chunk, an Esc alone only after its timeout.
test('runTui reads every key of a chunk, and an Esc alone leaves the submenu once nothing follows it', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: noCommands, stdin, stdout, escapeMs: 5 });
  stdin.emit('data', 'j'.repeat(MENU_ITEMS.indexOf('uninstall')) + '\r');
  assert.match(screen(stdout), /^> Machine$/m, 'one chunk of keys, all read: down to Uninstall, then Enter');
  stdin.emit('data', '\u001b');
  assert.match(screen(stdout), /^> Machine$/m, 'an Esc alone waits');
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(screen(stdout), /^> Uninstall$/m, 'then it is Back');
  stdin.emit('data', '\u001b[A');
  assert.match(screen(stdout), /^> Upgrade$/m, 'an arrow is never an Esc');
  stdin.emit('data', 'q');
  await done;
});

// --- T5: the stack block (worstState / summarizeStackRow / computeStackState / render / menu) ---

function makeDoctorRow(overrides = {}) {
  return {
    id: 'engram',
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
  assert.deepEqual(summarizeStackRow(makeDoctorRow()), { id: 'engram', version: '3.7.0', state: 'ok' });
});

test('summarizeStackRow shows the installed state as the version when the tool is not ok', () => {
  const row = makeDoctorRow({ installed: 'missing', version: null });
  assert.deepEqual(summarizeStackRow(row), { id: 'engram', version: 'missing', state: 'missing' });
});

test('render shows one compact line per tool above the menu when state.stack is an array', () => {
  const state = {
    ...initialState({ installedVersion: '0.1.0', updateAvailable: null }),
    stack: [
      { id: 'engram', version: '3.7.0', state: 'ok' },
      { id: 'codegraph', version: '1.6.0', state: 'missing codex' },
    ],
  };
  const text = render(state).join('\n');
  assert.match(text, /engram.*3\.7\.0.*ok/);
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
      ['engram', 'engram-plugin', 'codegraph', 'context7', 'typescript-lsp', 'codex', 'memory-rules', 'session-classes', 'claude-account', 'remote-server', 'codex-daemon', 'pnpm-lock', 'js-harness'],
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
    // In this process, so the fake `fetch` reaches doctor.
    const done = tuiMain(['--cwd', nonGitDir], { JS_HARNESS_HOME: home }, spawn, { stdin, stdout, fetch: fetchImpl, inProcess: true });
    await flush();
    const doctorIndex = MENU_ITEMS.indexOf('doctor');
    for (let i = 0; i < doctorIndex; i++) stdin.emit('data', 'j');
    stdin.emit('data', '\r');
    await backToMenu(stdin, stdout);
    stdin.emit('data', 'q');
    const code = await done;

    assert.equal(code, 0);
    assert.equal(
      fetchCalled,
      true,
      'the Doctor menu item must be allowed to hit the network, unlike the startup stack block',
    );
    assert.match(logged, /engram-plugin/);
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

// S4: a command's output fills the run screen's log, never the menu; the keys wait while it runs.
function controlledCommand() {
  const control = {};
  control.command = (location, io) => new Promise((resolve) => {
    control.io = io;
    control.end = resolve;
    io.signal.addEventListener('abort', () => resolve({ code: null, cancelled: true }));
  });
  return control;
}

test('runTui runs a command on a run screen: a spinner, its output in the log, the keys locked but ctrl+c', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const status = controlledCommand();
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: { ...noCommands, status: status.command }, stdin, stdout, tickMs: 5 });

  stdin.emit('data', '\r'); // run Status
  assert.match(screen(stdout), /^\| Status: running$/m);
  assert.match(screen(stdout), /^ctrl\+c cancels it; the other keys wait until it ends$/m);
  status.io.output('first line\nsecond \u001b[31mred\u001b[0m');
  await flush();
  assert.match(screen(stdout), /^first line$/m);
  assert.doesNotMatch(screen(stdout), /> Status/, 'the menu is not drawn while it runs');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(screen(stdout), /^[/\\|-] Status: running$/m);
  for (const key of ['q', 'j', '\r', '\u001b[B']) stdin.emit('data', key);
  assert.match(screen(stdout), /Status: running$/m, 'q, arrows and Enter do nothing while it runs');

  status.end(0);
  await until(() => /^Status: done \(exit 0\)$/m.test(screen(stdout)), 'the result');
  assert.match(screen(stdout), /^second red$/m, 'the unfinished last line is kept, its colors removed');
  assert.match(screen(stdout), /^Back in the menu, Status and Doctor show what changed\.$/m);
  stdin.emit('data', '\r');
  assert.match(screen(stdout), /^> Status$/m, 'Enter goes back to the menu');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('ctrl+c while a command runs stops it, and the result says it was cancelled; the menu keeps working', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const update = controlledCommand();
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: { ...noCommands, status: update.command }, stdin, stdout });
  stdin.emit('data', '\r');
  stdin.emit('data', '\u0003');
  assert.equal(update.io.signal.aborted, true, 'the command is told to stop');
  await until(() => /^Status: cancelled; the command was stopped before it finished$/m.test(screen(stdout)), 'the cancelled result');
  assert.match(screen(stdout), /^It may have done part of its work: run it again from the menu to finish it\.$/m);
  stdin.emit('data', '\u001b');
  await until(() => /^> Status$/m.test(screen(stdout)), 'Esc back to the menu');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('a failed command ends on its exit code, and the log scrolls with the arrows, PgUp/PgDn and Home/End', async () => {
  const stdin = makeFakeStdin();
  const stdout = Object.assign(makeFakeStdout(), { columns: 60, rows: 12 });
  const lines = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
  const commands = { ...noCommands, status: async (location, io) => { io.output(`${lines}\n`); return 2; } };
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });
  stdin.emit('data', '\r');
  await until(() => /^Status: failed \(exit 2\)$/m.test(screen(stdout)), 'the failed result');
  assert.match(flatScreen(stdout), /The log above is its whole output: fix what it names, then run it again from the menu\./);
  assert.match(screen(stdout), /^line 39$/m, 'the result opens on the tail');
  stdin.emit('data', '\u001b[H');
  assert.match(screen(stdout), /^line 0$/m, 'Home goes to the top');
  stdin.emit('data', '\u001b[6~');
  assert.doesNotMatch(screen(stdout), /^line 0$/m, 'PgDn moves down a page');
  stdin.emit('data', '\u001b[F');
  assert.match(screen(stdout), /^line 39$/m, 'End goes back to the tail');
  stdin.emit('data', 'q');
  assert.equal(await done, 0, 'q quits from the result');
});

test('a log whose lines wrap scrolls by the rows it draws: Home reaches its first row, and Down then moves at once', async () => {
  const stdin = makeFakeStdin();
  const stdout = Object.assign(makeFakeStdout(), { columns: 40, rows: 12 });
  const long = Array.from({ length: 20 }, (_, i) => `entry ${i} ${'word '.repeat(25)}`).join('\n');
  const commands = { ...noCommands, status: async (location, io) => { io.output(`${long}\n`); return 0; } };
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });
  stdin.emit('data', '\r');
  await until(() => /^Status: done \(exit 0\)$/m.test(screen(stdout)), 'the result');
  stdin.emit('data', '\u001b[H');
  assert.match(screen(stdout), /^entry 0 word/m, 'Home shows the first row of the first line');
  stdin.emit('data', '\u001b[B');
  assert.doesNotMatch(screen(stdout), /^entry 0 word/m, 'one Down moves off it: Home did not overshoot');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('a line of stderr never lands in the middle of a line of stdout, and a line still being written shows while it runs', () => {
  let state = startRun(initialState({ installedVersion: '0.1.0', updateAvailable: null }), 'status');
  state = appendRunOutput(state, 'half of ', 'stdout');
  state = appendRunOutput(state, 'a warning\n', 'stderr');
  state = appendRunOutput(state, 'a line\n', 'stdout');
  assert.deepEqual(state.run.log, ['a warning', 'half of a line']);
  state = appendRunOutput(state, `${'x'.repeat(10_000)}\r50%`, 'stdout');
  assert.ok(state.run.partials.stdout.length <= 4096, 'an unfinished line is kept short');
  assert.equal(sections(state).body.at(-1), '50%', 'the progress line is the last row while it runs');
  state = finishRun(state, { code: 0 });
  assert.equal(state.run.log.at(-1), '50%');
});

test('a command a signal stopped says so on its result', () => {
  const state = finishRun(startRun(initialState({ installedVersion: '0.1.0', updateAvailable: null }), 'status'), { code: null, signal: 'SIGKILL' });
  assert.equal(sections(state).top[2], 'Status: failed (stopped by SIGKILL)');
});

test('nothing is drawn while a command owns the terminal, however long it runs, a resize included', async () => {
  const stdin = makeFakeStdin();
  stdin.setRawMode = () => {};
  const stdout = Object.assign(new EventEmitter(), makeFakeStdout());
  let frames = null;
  let release;
  const install = Object.assign((location, io) => new Promise((resolve) => {
    frames = stdout.chunks.length;
    release = () => resolve({ code: 0 });
    io.signal.addEventListener('abort', () => resolve({ code: null, cancelled: true }));
  }), { handoff: true });
  const done = runTui({
    installedVersion: '0.1.0', updateAvailable: null, commands: { ...noCommands, 'stack-install': install }, stdin, stdout, stackGap: true, tickMs: 5,
  });
  stdin.emit('data', 'jj\r'); // Status, Doctor, Install the stack
  await flush();
  stdout.emit('resize');
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(stdout.chunks.length, frames, 'no spinner frame and no repaint while it asks');
  release();
  await flush();
  assert.equal(stdout.chunks.filter((chunk, i) => i >= frames && chunk.includes(FRAME_START)).length, 0, 'none while it waits for Enter either');
  stdin.emit('data', '\r');
  await until(() => /^Install the stack: done \(exit 0\)$/m.test(screen(stdout)), 'the result once the menu is back');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('a refresh that ends after the user opened a prompt or a submenu keeps it open, and the menu is rebuilt on leaving', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  let finishRead;
  let reads = 0;
  const readLocation = () => {
    reads += 1;
    return reads === 1 ? new Promise((resolve) => { finishRead = () => resolve({ kind: 'outside' }); }) : { kind: 'outside' };
  };
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: noCommands, stdin, stdout, readLocation });
  stdin.emit('data', '\r'); // Status
  await until(() => /^Status: done \(exit 0\)$/m.test(screen(stdout)), 'the result');
  assert.match(screen(stdout), /^js-harness 0\.1\.0 {2}\(reading what it changed\.\.\.\)$/m, 'the header says the menu is still reading');
  stdin.emit('data', '\r'); // back to the menu while the read is pending
  const at = screen(stdout).split('\n').findIndex((line) => line === '  Uninstall');
  assert.ok(at > 0, 'the Uninstall item is on the menu');
  while (!/^> Uninstall$/m.test(screen(stdout))) stdin.emit('data', 'j');
  stdin.emit('data', '\r'); // opens the Uninstall submenu
  const submenu = screen(stdout);
  finishRead();
  await flush();
  await flush();
  assert.equal(screen(stdout).replace(REFRESHING, ''), submenu.replace(REFRESHING, ''), 'the submenu stays as it was');
  assert.doesNotMatch(screen(stdout), /reading what it changed/, 'the read is over');
  stdin.emit('data', '\u001b');
  await until(() => /^> Uninstall$/m.test(screen(stdout)) && /^  Status$/m.test(screen(stdout)), 'Esc back to the main menu, rebuilt, its selection kept');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

// The TUI runs outside or inside a project alike, and its Machine kind must reach the machine: it runs
// `uninstall machine`, or inside a git repository it would act on (or refuse for) that project.
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

    const code = await buildCommands({ home })['uninstall-machine']();

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

    const code = await buildCommands({ home })['uninstall-machine']();

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
const PROJECT_MENU = ['[project]', 'project-sync', 'project-status', ...REMOTE_MENU];

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

test('buildMenu offers Sync and Status in an initialized project, stale, invalid and unpinned ones included, and one Uninstall', () => {
  for (const location of [INITIALIZED, STALE, INVALID, NO_PIN]) {
    const menu = buildMenu(location);
    assert.deepEqual(ids(menu), [...PROJECT_MENU, '[machine]', ...MENU_ITEMS], location.kind);
    assert.deepEqual(
      menu.slice(1, 3).map((entry) => entry.label),
      ['Sync', 'Status'],
    );
    assert.equal(menu.filter((entry) => entry.label === 'Uninstall').length, 1, `${location.kind}: its submenu holds the project kind`);
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
  const afterUninstall = withLocation(stateAt(INITIALIZED, 'project-status'), NOT_INITIALIZED);
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
  assert.match(allText(stdout), /^> Init$/m);

  stdin.emit('data', '\r'); // Enter on Init
  await backToMenu(stdin, stdout);

  assert.deepEqual(calls, ['project-init']);
  const redraw = screen(stdout);
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

    const uninstall = await silently(() => commands['uninstall-project']());
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
  for (const id of ['project-init', 'project-sync', 'project-status', 'uninstall-project']) {
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
  await backToMenu(stdin, stdout);
  assert.match(screen(stdout), /^project$/m);
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
  test(`runTui survives a command that ${label}: one line on the result screen, nothing on stderr, the menu back, q still quits`, async () => {
    const stdin = makeFakeStdin();
    const stdout = makeFakeStdout();
    const input = pausable(stdin);
    const commands = { ...noCommands, status: fail };
    const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands, stdin, stdout });

    const { lines } = await silently(async () => {
      stdin.emit('data', '\r');
      await flush();
    });

    assert.equal(input.paused, false, 'stdin must be resumed');
    assert.deepEqual(lines, [], 'nothing is printed over the screen');
    assert.match(screen(stdout), /^status failed: boom$/m);
    stdin.emit('data', '\r');
    assert.match(screen(stdout), /^> Status$/m, 'the menu is drawn again');

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

  stdin.emit('data', '\r');
  await flush();
  const line = screen(stdout).split('\n').find((text) => text.startsWith('status failed:'));
  assert.doesNotMatch(line, /[\u0000-\u001f\u007f-\u009f]/);
  assert.equal(line, 'status failed: bad [2J 2J   end');
  assert.doesNotMatch(stdout.chunks.join(''), /\u009b|bad \u001b/, 'nothing of it reaches the terminal raw');

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
    stdin.emit('data', '\r');
    await flush();

    assert.equal(input.paused, false);
    assert.match(screen(stdout), /^reading the project failed: cannot read$/m, 'the result says what it could not read again');
    stdin.emit('data', '\r');
    const redraw = screen(stdout);
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
      const opening = allText(stdout);
      assert.match(opening, /^project$/m);
      assert.match(opening, /^machine$/m);
      assert.match(opening, /^> Init$/m);

      stdin.emit('data', '\r'); // Init, for real, in the fixture repository, as a child `js-harness init`
      await until(() => /^Project init: done \(exit 0\)$/m.test(screen(stdout)), 'init to end');
      assert.ok(fs.existsSync(path.join(repo, 'harness.json')));
      stdin.emit('data', '\r');
      const afterInit = screen(stdout);
      assert.match(afterInit, /^> Sync$/m);
      assert.doesNotMatch(afterInit, /Init/);

      stdin.emit('data', 'k'); // from Sync, up wraps to Quit
      stdin.emit('data', 'k'); // Uninstall
      stdin.emit('data', '\r'); // the submenu, on Project
      stdin.emit('data', '\r');
      await flush();
      assert.match(flatScreen(stdout), /Undo js-harness in this project\? .*\(y\/N\)/);
      stdin.emit('data', 'y');
      await until(() => /^Uninstall project: done \(exit 0\)$/m.test(screen(stdout)), 'the uninstall to end');
      assert.equal(fs.existsSync(path.join(repo, 'harness.json')), false);
      stdin.emit('data', '\r');
      assert.match(screen(stdout), /^ {2}Init$/m, 'the menu offers Init again once the project is undone');
      assert.match(screen(stdout), /^> Uninstall$/m, 'the selection stays on Uninstall, which is still there');

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
  const opening = allText(stdout);
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
  assert.match(allText(stdout), /codegraph\s+1\.6\.0\s+missing project/);

  stdin.emit('data', '\r');
  await backToMenu(stdin, stdout);

  const redraw = screen(stdout);
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

    stdin.emit('data', '\r');
    await flush();

    assert.equal(input.paused, false, 'stdin must be resumed');
    assert.match(screen(stdout), /^refreshing the stack failed: probe$/m, 'the result says what it could not read again');
    stdin.emit('data', '\r');
    assert.match(screen(stdout), /codegraph\s+1\.6\.0\s+missing project/, 'the previous block stays');

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
  stdin.emit('data', '\r');
  await flush();
  assert.match(screen(stdout), /^reading the project failed: git vanished$/m);
  stdin.emit('data', '\r');
  assert.match(screen(stdout), /codegraph\s+1\.6\.0\s+ok/, 'the stack was still refreshed');
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
  stdin.emit('data', '\r');
  await backToMenu(stdin, stdout);
  assert.match(screen(stdout), /^> Status$/m);
  assert.match(screen(stdout), /Sync/, 'the location was still re-read');
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
      const running = tuiMain(['--cwd', nonGitDir, '--home', home], {}, spawn, { stdin, stdout, fetch: fetchImpl, inProcess: true });
      await until(() => probes.length > 0, 'the stack probes once the menu is drawn');
      const atStart = probes.length;

      stdin.emit('data', '\r'); // machine Status
      await backToMenu(stdin, stdout);
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

// --- the stack install item (odd/tasks/stack-install.md, D5) ---

test('Install the stack is a machine item only while a tool the harness requires is missing, right after Doctor', () => {
  assert.equal(buildMenu({ kind: 'notGit' }).some((entry) => entry.id === 'stack-install'), false);
  const machine = buildMenu({ kind: 'notGit' }, { stackGap: true });
  const at = machine.findIndex((entry) => entry.id === 'stack-install');
  assert.equal(machine[at].label, 'Install the stack');
  assert.equal(machine[at - 1].id, 'doctor');
  const project = buildMenu({ kind: 'initialized', root: '/r' }, { stackGap: true });
  assert.ok(project.findIndex((entry) => entry.id === 'stack-install') > project.findIndex((entry) => entry.header && entry.label === 'machine'));
});

test('buildCommands binds stack-install to the home and the folder', () => {
  assert.equal(typeof buildCommands({ home: '/h', cwd: '/c' })['stack-install'], 'function');
});

test('the first frame of a result already says the menu is reading what the command changed', async () => {
  const stdin = makeFakeStdin();
  const stdout = makeFakeStdout();
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: noCommands, stdin, stdout, readLocation: () => new Promise(() => {}) });
  stdin.emit('data', '\r'); // Status
  await until(() => /^Status: done \(exit 0\)$/m.test(screen(stdout)), 'the result');
  const first = stdout.chunks.find((chunk) => chunk.includes(FRAME_START) && /Status: done \(exit 0\)/.test(textOf(chunk)));
  assert.ok(textOf(first).includes(REFRESHING), 'no result frame shows before the reading note');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('a command handed the terminal that throws gives the terminal back to the menu, and the result says it failed', async () => {
  const stdin = makeFakeStdin();
  const raw = [];
  stdin.setRawMode = (on) => raw.push(on);
  const stdout = makeFakeStdout();
  const install = Object.assign(async () => { throw new Error('no node'); }, { handoff: true });
  const done = runTui({ installedVersion: '0.1.0', updateAvailable: null, commands: { ...noCommands, 'stack-install': install }, stdin, stdout, stackGap: true });
  stdin.emit('data', 'jj\r'); // Status, Doctor, Install the stack
  await until(() => /^stack-install failed: no node$/m.test(screen(stdout)), 'the failed result');
  assert.equal(raw.at(-1), true, 'raw keys again');
  stdin.emit('data', '\r');
  assert.match(screen(stdout), /^> /m, 'keys reach the menu again');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('a command that asks its own questions is handed the terminal: main screen, keys cooked, back after a key', async () => {
  const stdin = makeFakeStdin();
  const raw = [];
  stdin.setRawMode = (on) => raw.push(on);
  const stdout = makeFakeStdout();
  const seen = [];
  const install = Object.assign(async () => {
    seen.push({ raw: raw.at(-1), last: stdout.chunks.at(-1) });
    return { code: 0 };
  }, { handoff: true });
  const done = runTui({
    installedVersion: '0.1.0', updateAvailable: null, commands: { ...noCommands, 'stack-install': install }, stdin, stdout, stackGap: true,
    readStackView: async () => ({ stack: [], stackGap: false }),
  });
  stdin.emit('data', 'jj\r'); // Status, Doctor, Install the stack
  await flush();
  assert.deepEqual(seen, [{ raw: false, last: '\u001b[?25h\u001b[?1049l' }], 'it runs on the main screen with cooked keys');
  assert.match(stdout.chunks.at(-1), /Install the stack ended \(exit 0\)\. Press Enter to go back to the menu\./);
  stdin.emit('data', '\r');
  await flush();
  assert.equal(raw.at(-1), true, 'raw keys again');
  assert.match(screen(stdout), /^Install the stack: done \(exit 0\)$/m);
  stdin.emit('data', '\r');
  assert.ok(!screen(stdout).includes('Install the stack'), 'the item is gone once nothing is missing');
  stdin.emit('data', 'q');
  assert.equal(await done, 0);
});

test('childCommands runs every item as a child js-harness command line, and hands Install the stack the terminal', async () => {
  const runs = [];
  const commands = childCommands({
    home: '/h', cwd: '/c', env: process.env,
    runChild: async (command, args, opts) => { runs.push({ command, args, piped: typeof opts.onOutput === 'function' }); return { code: 0, cancelled: false }; },
    handOff: async (command, args) => { runs.push({ command, args, handoff: true }); return { code: 0 }; },
  });
  await commands.doctor(undefined, { output: () => {} });
  await commands['project-init']({ kind: 'notInitialized', root: '/r' }, { output: () => {} });
  await commands['stack-install']();
  const cli = path.join(import.meta.dirname, 'js-harness.mjs');
  assert.deepEqual(runs, [
    { command: process.execPath, args: [cli, 'doctor', '--home', '/h', '--cwd', '/c'], piped: true },
    { command: process.execPath, args: [cli, 'init', '--cwd', '/r', '--home', '/h'], piped: true },
    { command: process.execPath, args: [cli, 'stack', 'install', '--home', '/h', '--cwd', '/c'], handoff: true },
  ]);
  assert.equal(commands['stack-install'].handoff, true);
  assert.equal(commands.doctor.handoff, undefined);
});

// Every item's command is one the real CLI has: its --help exits 0. The real children run above (init, uninstall
// project, install) show their arguments are accepted.
test('every menu item runs a command the real js-harness has', () => {
  const cli = path.join(import.meta.dirname, 'js-harness.mjs');
  const location = { kind: 'initialized', root: nonGitDir };
  for (const id of ['project-init', 'project-sync', 'project-status', 'uninstall-project', 'status', 'doctor', 'stack-install', 'install', 'update', 'upgrade', 'sync', 'uninstall-machine', 'uninstall-snapshots', 'uninstall-everything']) {
    const [command] = commandArgv(id, { home: nonGitDir, cwd: nonGitDir, location });
    const result = spawnSync(process.execPath, [cli, command, '--help'], { encoding: 'utf8', env: { ...process.env, JS_HARNESS_HOME: nonGitDir } });
    assert.equal(result.status, 0, `${id}: ${command} --help exited ${result.status}: ${result.stderr}`);
  }
});
