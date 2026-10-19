#!/usr/bin/env node
// Zero-dependency TUI: rendering and key handling are pure (state + key -> state), so they are
// unit-tested without a terminal. Only `runTui`/`tuiMain` below touch real stdin/stdout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { currentVersion, installMain, syncMain, uninstallMain } from './install.mjs';
import { hygieneDir } from './lib/memory-hygiene.mjs';
import { initMain } from './init.mjs';
import { statusMain, updateMain, upgradeMain, resolveLatest } from './update.mjs';
import { isNewer } from './lib/version.mjs';
import { projectLocation } from './lib/project.mjs';
import { installedVersion as manifestVersion } from './lib/manifest.mjs';
import { doctorMain, buildReport } from './doctor.mjs';
import { GAP_STATES } from './lib/digest.mjs';
import { remoteMain } from './remote.mjs';

/** The machine-level menu items, in order: the whole menu outside a git repository, and the section
 * below `project` inside one. */
export const MENU_ITEMS = ['status', 'doctor', 'install', 'update', 'upgrade', 'uninstall', 'uninstall-everything', 'quit'];
/** The remote-control server of the repository, last in the project section. */
const REMOTE_ITEMS = ['project-remote-status', 'project-remote-start', 'project-remote-stop'];
const MENU_LABELS = {
  status: 'Status',
  doctor: 'Doctor',
  install: 'Install',
  update: 'Update',
  upgrade: 'Upgrade',
  uninstall: 'Uninstall',
  'uninstall-everything': 'Uninstall everything',
  quit: 'Quit',
  'project-init': 'Init',
  'project-sync': 'Sync',
  'project-status': 'Status',
  'project-uninstall': 'Uninstall',
  'project-remote-status': 'Remote status',
  'project-remote-start': 'Remote start',
  'project-remote-stop': 'Remote stop',
};
// The uninstalls ask before they run; each prompt names what it undoes. A command has a prompt here
// exactly when it asks first, and `state.pending` names the command the open prompt is for. Stopping the
// remote server asks too: the sessions the phone opened through it end with it.
const CONFIRM_PROMPTS = {
  uninstall: 'Uninstall js-harness from this home? (y/N)',
  'project-uninstall': 'Undo js-harness in this project? (y/N)',
  'project-remote-stop': 'Stop the remote server of this project? The sessions opened through it end. (y/N)',
  // Asked after the yes to Uninstall, only while the home holds memory snapshots (D7.8 of odd/tasks/memory-hygiene.md).
  'uninstall-full': 'Remove the memory snapshots too, the only copy of what a pass changed? (y/N)',
  // One question, snapshots or not: it already names them (release-095 S5, Pregunta 17).
  'uninstall-everything': 'Remove everything js-harness keeps on this machine: the whole .js-harness folder of this home (the lead\'s notes, the backups, the memory snapshots) and the js-harness program itself? This cannot be undone. (y/N)',
};

/** Whether the home holds a snapshot of a memory pass, the copy only `uninstall --full` removes. False when the
 * folder cannot be read: the menu then asks one question, and the uninstall still keeps the snapshots. */
export function hasMemorySnapshots(home) {
  try {
    const dir = hygieneDir(home);
    return fs.readdirSync(dir).some((slug) => {
      try {
        return fs.readdirSync(path.join(dir, slug, 'snapshots')).length > 0;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// --- T5: the menu by location. Data built by a pure function, so it is tested without a terminal ---

const item = (id) => ({ id, label: MENU_LABELS[id] });
const header = (label) => ({ header: true, label });

/** The menu for where the TUI opened (a `projectLocation` result): outside a git repository exactly the
 * machine menu; inside one, a non-selectable `project` header with Init (not initialized) or Sync, Status
 * and Uninstall (initialized, a stale manifest or a bad `harness.json` included: `status` and `sync` name
 * the problem and `uninstall` clears it), then a non-selectable `machine` header with the machine items.
 * In every one of those the project section ends with Remote status, start and stop: `js-harness remote`
 * acts on any git repository, initialized or not. The login launcher (`--at-login`) is not offered here.
 * Entries are `{ id, label }`, or `{ header: true, label }` for a section header. */
export function buildMenu(location = { kind: 'notGit' }) {
  const machine = MENU_ITEMS.map(item);
  const section = (...ids) => [header('project'), ...[...ids, ...REMOTE_ITEMS].map(item), header('machine'), ...machine];
  if (location.kind === 'notInitialized') return section('project-init');
  if (['initialized', 'noPin', 'staleManifest', 'invalidHarnessJson'].includes(location.kind)) {
    return section('project-sync', 'project-status', 'project-uninstall');
  }
  return machine;
}

function firstSelectable(menu) {
  return menu.findIndex((entry) => !entry.header);
}

/** The next selectable index from `from` in direction `dir` (+1/-1), wrapping and skipping headers. A
 * menu always ends in Quit, so there is always something to land on. */
function stepSelection(menu, from, dir) {
  let i = from;
  do {
    i = (i + dir + menu.length) % menu.length;
  } while (menu[i].header);
  return i;
}

/** Pure: the state for a re-read location. The menu is rebuilt; the selection stays on the same item when
 * it survives, else (an `init` turned Init into Sync, a project `uninstall` turned Sync back into Init)
 * on the top of the project section when the item was a project one, else on the nearest selectable index
 * in range. */
export function withLocation(state, location) {
  const menu = buildMenu(location);
  const previous = state.menu?.[state.selected];
  let selected = previous?.id === undefined ? -1 : menu.findIndex((entry) => entry.id === previous.id);
  if (selected === -1) {
    if (previous?.id?.startsWith('project-')) {
      selected = firstSelectable(menu);
    } else {
      selected = Math.min(state.selected, menu.length - 1);
      if (menu[selected].header) selected = stepSelection(menu, selected, 1);
    }
  }
  return { ...state, location, menu, selected, pending: undefined };
}

// --- T5: the stack block — one compact line per doctor row, from local probes + cache only ---

/** How bad a cell is: a gap outranks `unknown`, which outranks a healthy or not-applicable cell. What a gap
 * is comes from the one list doctor and the session digest use (`GAP_STATES`), so every gap state, `mismatch`
 * (the Claude accounts differ) and `down` (a login launcher's remote server is not running) included, is as
 * severe here as `missing`. */
function severityOf(state) {
  if (GAP_STATES.has(state)) return 2;
  return state === 'unknown' ? 1 : 0;
}
const DIMENSIONS = ['installed', 'claude', 'codex', 'project', 'upToDate'];
// `installed` and `upToDate` describe the tool's own version, so a gap there reads fine bare
// ("missing", "outdated"); `claude`/`codex`/`project` are per-host/per-project, so a gap there
// needs the dimension named ("missing codex") to say where it is.
const BARE_DIMENSIONS = new Set(['installed', 'upToDate']);

/** The worst state across a doctor row's dimensions, as the short label the stack block shows:
 * bare (`ok`, `missing`, `outdated`, `unknown`) when the worst dimension is the tool's own
 * installed/up-to-date state, or `<state> <dimension>` (e.g. `missing codex`) when a per-host or
 * per-project dimension is worse. Ties break toward the first dimension in `DIMENSIONS` order, so
 * the result is deterministic. */
export function worstState(row) {
  let best = { severity: -1, dimension: 'installed', state: 'ok' };
  for (const dimension of DIMENSIONS) {
    const state = row[dimension];
    const severity = severityOf(state);
    if (severity > best.severity) best = { severity, dimension, state };
  }
  if (best.severity === 0) return 'ok';
  return BARE_DIMENSIONS.has(best.dimension) ? best.state : `${best.state} ${best.dimension}`;
}

/** One doctor report row -> the compact `{ id, version, state }` the stack block renders. `version`
 * mirrors doctor.mjs's own version column: the installed version when the tool is `ok`, else the
 * installed state itself, so a missing/unknown tool is visible without a separate column. */
export function summarizeStackRow(row) {
  const version = row.installed === 'ok' ? row.version : row.installed;
  return { id: row.id, version, state: worstState(row) };
}

/** Resolves the stack block's rows from local probes plus the cache only — `buildReport` is called
 * with `offline: true` (the same semantics as `doctor --offline`), so opening the TUI never touches
 * the network. Any probe failure (a thrown error, a broken home, ...) must never stop the TUI from
 * opening: it falls back to the literal string `'unknown'`, which `render` shows as a single
 * `stack: unknown` line instead of the block. */
export async function computeStackState({ home, cwd, spawn, platform, fetch: fetchImpl, now, env }) {
  try {
    const rows = await buildReport({ home, cwd, offline: true, env }, { spawn, platform, fetch: fetchImpl, now });
    return rows.map(summarizeStackRow);
  } catch {
    return 'unknown';
  }
}

/** Builds the initial menu state from the version info the caller already resolved. `stack` is the
 * result of `computeStackState` (an array of compact rows, or `'unknown'`); omitted entirely, the
 * stack block simply does not render (see `render` below), so older callers keep working. `location` is
 * a `projectLocation` result; omitted, the TUI is outside any repository and shows the machine menu. */
export function initialState({ installedVersion, updateAvailable, stack, location = { kind: 'notGit' }, memorySnapshots = false, installedCopy = null }) {
  const menu = buildMenu(location);
  return {
    mode: 'menu',
    selected: firstSelectable(menu),
    installedVersion,
    updateAvailable,
    installedCopy,
    stack,
    location,
    menu,
    memorySnapshots,
  };
}

/** Maps a raw terminal chunk to a normalized key token; unrecognized input passes through. */
export function normalizeKey(chunk) {
  if (chunk === '\u001b[A') return 'up';
  if (chunk === '\u001b[B') return 'down';
  if (chunk === '\r' || chunk === '\n') return 'enter';
  if (chunk === '\u001b') return 'escape';
  if (chunk === '\u0003') return 'quit'; // Ctrl-C
  if (chunk === 'k' || chunk === 'K') return 'up';
  if (chunk === 'j' || chunk === 'J') return 'down';
  if (chunk === 'q' || chunk === 'Q') return 'quit';
  if (chunk === 'y' || chunk === 'Y') return 'y';
  if (chunk === 'n' || chunk === 'N') return 'n';
  return chunk;
}

/**
 * Pure reducer: (state, normalized key) -> { state, effect }. `effect` is null,
 * `{ type: 'run', command }`, or `{ type: 'quit' }` — the shell performs it, the reducer never does.
 */
export function handleKey(state, key) {
  if (state.mode === 'confirm') {
    const next = { ...state, mode: 'menu', pending: undefined };
    if (state.pending === 'uninstall' && key === 'y' && state.memorySnapshots) return { state: { ...state, pending: 'uninstall-full' }, effect: null };
    // The second question is asked after a yes: its no (or Enter, the default) still uninstalls, keeping them.
    if (state.pending === 'uninstall-full') {
      if (key === 'y') return { state: next, effect: { type: 'run', command: 'uninstall-full' } };
      if (key === 'n' || key === 'enter') return { state: next, effect: { type: 'run', command: 'uninstall' } };
      return { state: next, effect: null };
    }
    if (key === 'y') return { state: next, effect: { type: 'run', command: state.pending } };
    return { state: next, effect: null };
  }

  if (key === 'up' || key === 'down') {
    const selected = stepSelection(state.menu, state.selected, key === 'up' ? -1 : 1);
    return { state: { ...state, selected }, effect: null };
  }
  if (key === 'quit' || key === 'escape') {
    return { state: { ...state, mode: 'done' }, effect: { type: 'quit' } };
  }
  if (key === 'enter') {
    const command = state.menu[state.selected].id;
    if (command === 'quit') return { state: { ...state, mode: 'done' }, effect: { type: 'quit' } };
    if (Object.hasOwn(CONFIRM_PROMPTS, command)) return { state: { ...state, mode: 'confirm', pending: command }, effect: null };
    return { state, effect: { type: 'run', command } };
  }
  return { state, effect: null };
}

/** Pure: state -> the lines to draw. The stack block (T5) renders above the menu, straight from
 * `state.stack` — this function never probes anything itself, see `computeStackState`. */
export function render(state) {
  // A newer copy installed under the home (an Upgrade from this menu) runs only in a new process: this one keeps
  // its code, so the header says to open the menu again instead of offering the update once more (release-095 F1).
  const reopen = state.installedCopy && isNewer(state.installedCopy, state.installedVersion);
  const updateNote = reopen ? `  (${state.installedCopy} installed: quit and open js-harness again to use it)` : state.updateAvailable ? `  (update available: ${state.updateAvailable})` : '';
  const lines = [`js-harness ${state.installedVersion}${updateNote}`];
  if (Array.isArray(state.stack)) {
    for (const row of state.stack) {
      lines.push(`  ${row.id.padEnd(16)}${String(row.version).padEnd(10)}${row.state}`);
    }
  } else if (state.stack === 'unknown') {
    lines.push('  stack: unknown');
  }
  lines.push('');
  for (const [i, entry] of state.menu.entries()) {
    if (entry.header) {
      lines.push(entry.label);
    } else {
      lines.push(`${i === state.selected ? '>' : ' '} ${entry.label}`);
    }
  }
  if (state.mode === 'confirm') {
    lines.push('', CONFIRM_PROMPTS[state.pending]);
  }
  return lines;
}

/** An error as one printable line: its first line, without C0, DEL or C1 control characters (U+009B is a
 * one-byte CSI on some terminals, so an untrusted message must not keep it). */
function oneLine(err) {
  return String(err?.message ?? err)
    .split('\n')[0]
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
}

function screenText(state) {
  return `${render(state).join('\n')}\n`;
}

/** The thin I/O shell: wires real (or fake) stdin/stdout to the pure reducer above. `location` is the
 * `projectLocation` the menu opens on; `readLocation` (sync or async) reads it again after every command,
 * since a command can change it (`init` initializes the project, `uninstall` undoes it). `readStack`
 * (sync or async) does the same for the stack block above the menu: `init` creating `.codegraph/` changes
 * codegraph's project state, and `uninstall` the reverse. `readSnapshots` reads again whether the home holds memory
 * snapshots (`memorySnapshots` at the start), which decides whether Uninstall asks its second question. */
export function runTui({
  installedVersion,
  updateAvailable,
  installedCopy = null,
  stack,
  location,
  memorySnapshots = false,
  readLocation,
  readStack,
  readSnapshots,
  readUpdate,
  commands,
  stdin = process.stdin,
  stdout = process.stdout,
}) {
  let state = initialState({ installedVersion, updateAvailable, stack, location, memorySnapshots, installedCopy });
  // Lines the last draw left on screen; the next draw moves back over them and clears them, so the
  // menu updates in place. Zero means "start below whatever is there" (e.g. a command's output).
  let drawn = 0;
  const draw = () => {
    const erase = drawn > 0 ? `[${drawn}A[0J` : '';
    stdout.write(erase + screenText(state));
    drawn = render(state).length;
  };

  stdin.setRawMode?.(true);
  stdin.setEncoding('utf8');
  stdin.resume();
  draw();

  return new Promise((resolve) => {
    async function onData(chunk) {
      const key = normalizeKey(chunk);
      const { state: next, effect } = handleKey(state, key);
      state = next;

      if (effect?.type === 'run') {
        stdin.pause();
        // Whatever the command or the re-read does, the terminal comes back: a failure is one line on
        // stderr, the previous location stays, and the menu is drawn again below.
        let code = null;
        try {
          code = await commands[effect.command](state.location);
        } catch (err) {
          console.error(`${effect.command} failed: ${oneLine(err)}`);
        }
        // Once everything is gone, the program included, there is no menu left to offer: the TUI ends. A failure
        // keeps the menu, since what it kept is still installed and the uninstall can be run again.
        if (effect.command === 'uninstall-everything' && code === 0) {
          stdin.setRawMode?.(false);
          stdin.removeListener('data', onData);
          resolve(0);
          return;
        }
        if (readLocation) {
          try {
            state = withLocation(state, await readLocation());
          } catch (err) {
            console.error(`reading the project failed: ${oneLine(err)}`);
          }
        }
        if (readStack) {
          try {
            state = { ...state, stack: await readStack() };
          } catch (err) {
            console.error(`refreshing the stack failed: ${oneLine(err)}`);
          }
        }
        if (readSnapshots) {
          try {
            state = { ...state, memorySnapshots: await readSnapshots() };
          } catch (err) {
            console.error(`reading the memory snapshots failed: ${oneLine(err)}`);
          }
        }
        if (readUpdate) {
          try {
            const { updateAvailable: available = null, installedCopy = null } = (await readUpdate()) ?? {};
            state = { ...state, updateAvailable: available, installedCopy };
          } catch (err) {
            console.error(`reading the installed version failed: ${oneLine(err)}`);
          }
        }
        stdin.resume();
        drawn = 0; // keep the command's output; redraw the menu below it
      }

      draw();

      if (effect?.type === 'quit') {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        resolve(0);
      }
    }
    stdin.on('data', onData);
  });
}

/** The commands the menu runs, each bound to `home`. The machine ones do not change scope with the folder:
 * `status`, `sync` and `uninstall` pass `--global`, so the same Enter never acts on a project. (`doctor`
 * reads the folder's project, like the stack block, so it gets `--cwd`.) Every project command exists
 * whatever the TUI opened on, and takes the location the menu was last built for: it acts on that
 * location's `root` (the repository's top-level) with `--cwd`, so a repository that appears, or a project
 * that moves, while the TUI is open never leaves a menu item without a command or bound to a stale root.
 * `root` serves direct callers and tests that call a project command with no location; the TUI always
 * passes one, so there the location is authoritative. */
export function buildCommands({
  home,
  cwd = process.cwd(),
  root,
  env = process.env,
  spawn = spawnSync,
  fetch: fetchImpl = fetch,
  now,
  remoteMain: remote = remoteMain,
  source,
} = {}) {
  // The folder of tarballs the menu was opened with, passed on, so that its header and its three version
  // commands read the same release source.
  const fromSource = source ? ['--source', source] : [];
  const argsAt = (location) => {
    const at = location?.root ?? root;
    if (!at) throw new Error('no project to act on');
    return ['--cwd', at, '--home', home];
  };
  return {
    'project-init': async (location) => initMain(argsAt(location), env),
    'project-sync': async (location) => syncMain(argsAt(location), env),
    'project-status': async (location) => statusMain(argsAt(location), env, spawn),
    'project-uninstall': async (location) => uninstallMain(argsAt(location), env),
    // `remote` takes the same `--cwd` and `--home` for its three subcommands, and nothing else is passed.
    'project-remote-status': async (location) => remote(['status', ...argsAt(location)], env),
    'project-remote-start': async (location) => remote(['start', ...argsAt(location)], env),
    'project-remote-stop': async (location) => remote(['stop', ...argsAt(location)], env),
    status: () => statusMain(['--global', '--home', home, ...fromSource], env, spawn),
    doctor: () => doctorMain(['--home', home, '--cwd', cwd], env, { spawn, fetch: fetchImpl, now }),
    install: () => installMain(['--home', home]),
    update: () => updateMain(['--home', home, ...fromSource], env, spawn),
    upgrade: () => upgradeMain(['--home', home, ...fromSource], env, spawn),
    sync: () => syncMain(['--global', '--home', home]),
    uninstall: () => uninstallMain(['--global', '--home', home]),
    'uninstall-full': () => uninstallMain(['--global', '--full', '--home', home]),
    'uninstall-everything': () => uninstallMain(['--global', '--everything', '--home', home]),
  };
}

/** CLI entry point: gathers version info, reads where it opened (`--cwd`, default the current folder),
 * binds the real commands to a home, computes the stack block (offline, never blocking on the network —
 * see `computeStackState`), opens the TUI. `io` may also carry `fetch`/`now` overrides for tests;
 * production leaves them at their real defaults. */
export async function tuiMain(argv, env = process.env, spawn = spawnSync, io = {}) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const home = get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir();
  const cwd = get('--cwd') ?? process.cwd();
  const installedVersion = currentVersion();
  const { fetch: fetchImpl = fetch, now } = io;

  // The newest release: in a folder of tarballs when one is named, else the repository's tags (`git ls-remote`).
  const source = get('--source') ?? env.JS_HARNESS_SOURCE;
  let latest = null;
  try {
    // The repository JS_HARNESS_REPO names, as update and status read it, so the header and those items agree.
    latest = resolveLatest({ source, repo: env.JS_HARNESS_REPO });
  } catch {
    latest = null;
  }
  // The release is looked up once; what the home's manifest records is read again after each command, since an
  // Upgrade installs a newer copy than the one running this menu.
  // A manifest that cannot be read names no copy: the menu opens all the same, as it did before it read one.
  const readUpdate = () => {
    let installedCopy = null;
    try {
      installedCopy = manifestVersion(home);
    } catch {
      installedCopy = null;
    }
    const newest = installedCopy && isNewer(installedCopy, installedVersion) ? installedCopy : installedVersion;
    return { installedCopy, updateAvailable: latest && isNewer(latest.version, newest) ? latest.version : null };
  };
  const { updateAvailable, installedCopy } = readUpdate();

  // Real `git`, whatever `spawn` is: `spawn` stands in for the package manager in tests.
  const location = projectLocation(cwd);
  const stack = await computeStackState({ home, cwd, spawn, fetch: fetchImpl, now });

  const commands = buildCommands({ home, cwd, env, spawn, fetch: fetchImpl, now, source });

  return runTui({
    installedVersion,
    updateAvailable,
    installedCopy,
    readUpdate,
    stack,
    location,
    readLocation: () => projectLocation(cwd),
    // The same offline probes as at start, never the network: `computeStackState` always calls
    // `buildReport` with `offline: true`, which reads the cache instead of calling `fetch`.
    readStack: () => computeStackState({ home, cwd, spawn, fetch: fetchImpl, now }),
    memorySnapshots: hasMemorySnapshots(home),
    readSnapshots: () => hasMemorySnapshots(home),
    commands,
    ...io,
  });
}
