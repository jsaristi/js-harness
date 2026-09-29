#!/usr/bin/env node
// Zero-dependency TUI: rendering and key handling are pure (state + key -> state), so they are
// unit-tested without a terminal. Only `runTui`/`tuiMain` below touch real stdin/stdout.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { currentVersion, installMain, syncMain, uninstallMain } from './install.mjs';
import { initMain } from './init.mjs';
import { statusMain, updateMain, upgradeMain, resolveLatest } from './update.mjs';
import { isNewer } from './lib/version.mjs';
import { projectLocation } from './lib/project.mjs';
import { doctorMain, buildReport } from './doctor.mjs';

/** The machine-level menu items, in order: the whole menu outside a git repository, and the section
 * below `project` inside one. */
export const MENU_ITEMS = ['status', 'doctor', 'install', 'update', 'upgrade', 'uninstall', 'quit'];
const MENU_LABELS = {
  status: 'Status',
  doctor: 'Doctor',
  install: 'Install',
  update: 'Update',
  upgrade: 'Upgrade',
  uninstall: 'Uninstall',
  quit: 'Quit',
  'project-init': 'Init',
  'project-sync': 'Sync',
  'project-status': 'Status',
  'project-uninstall': 'Uninstall',
};
// The uninstalls ask before they run; each prompt names what it undoes. A command has a prompt here
// exactly when it asks first, and `state.pending` names the command the open prompt is for.
const CONFIRM_PROMPTS = {
  uninstall: 'Uninstall js-harness from this home? (y/N)',
  'project-uninstall': 'Undo js-harness in this project? (y/N)',
};

// --- T5: the menu by location. Data built by a pure function, so it is tested without a terminal ---

const item = (id) => ({ id, label: MENU_LABELS[id] });
const header = (label) => ({ header: true, label });

/** The menu for where the TUI opened (a `projectLocation` result): outside a git repository exactly the
 * machine menu; inside one, a non-selectable `project` header with Init (not initialized) or Sync, Status
 * and Uninstall (initialized, a stale manifest or a bad `harness.json` included: `status` and `sync` name
 * the problem and `uninstall` clears it), then a non-selectable `machine` header with the machine items.
 * Entries are `{ id, label }`, or `{ header: true, label }` for a section header. */
export function buildMenu(location = { kind: 'notGit' }) {
  const machine = MENU_ITEMS.map(item);
  if (location.kind === 'notInitialized') return [header('project'), item('project-init'), header('machine'), ...machine];
  if (['initialized', 'staleManifest', 'invalidHarnessJson'].includes(location.kind)) {
    const project = ['project-sync', 'project-status', 'project-uninstall'].map(item);
    return [header('project'), ...project, header('machine'), ...machine];
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

// --- T5: the stack block — one compact line per tool, from local probes + cache only ---

const STATE_SEVERITY = { missing: 2, outdated: 2, unknown: 1, ok: 0, 'n/a': 0 };
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
    const severity = STATE_SEVERITY[state] ?? 0;
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
export async function computeStackState({ home, cwd, spawn, platform, fetch: fetchImpl, now }) {
  try {
    const rows = await buildReport({ home, cwd, offline: true }, { spawn, platform, fetch: fetchImpl, now });
    return rows.map(summarizeStackRow);
  } catch {
    return 'unknown';
  }
}

/** Builds the initial menu state from the version info the caller already resolved. `stack` is the
 * result of `computeStackState` (an array of compact rows, or `'unknown'`); omitted entirely, the
 * stack block simply does not render (see `render` below), so older callers keep working. `location` is
 * a `projectLocation` result; omitted, the TUI is outside any repository and shows the machine menu. */
export function initialState({ installedVersion, updateAvailable, stack, location = { kind: 'notGit' } }) {
  const menu = buildMenu(location);
  return {
    mode: 'menu',
    selected: firstSelectable(menu),
    installedVersion,
    updateAvailable,
    stack,
    location,
    menu,
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
  const updateNote = state.updateAvailable ? `  (update available: ${state.updateAvailable})` : '';
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
 * codegraph's project state, and `uninstall` the reverse. */
export function runTui({
  installedVersion,
  updateAvailable,
  stack,
  location,
  readLocation,
  readStack,
  commands,
  stdin = process.stdin,
  stdout = process.stdout,
}) {
  let state = initialState({ installedVersion, updateAvailable, stack, location });
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
        try {
          await commands[effect.command](state.location);
        } catch (err) {
          console.error(`${effect.command} failed: ${oneLine(err)}`);
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
} = {}) {
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
    status: () => statusMain(['--global', '--home', home], env, spawn),
    doctor: () => doctorMain(['--home', home, '--cwd', cwd], env, { spawn, fetch: fetchImpl, now }),
    install: () => installMain(['--home', home]),
    update: () => updateMain(['--home', home], env, spawn),
    upgrade: () => upgradeMain(['--home', home], env, spawn),
    sync: () => syncMain(['--global', '--home', home]),
    uninstall: () => uninstallMain(['--global', '--home', home]),
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

  let updateAvailable = null;
  try {
    const source = get('--source') ?? env.JS_HARNESS_SOURCE;
    const latest = resolveLatest({ source, pm: get('--pm') }, env, spawn);
    if (latest && isNewer(latest.version, installedVersion)) updateAvailable = latest.version;
  } catch {
    updateAvailable = null;
  }

  // Real `git`, whatever `spawn` is: `spawn` stands in for the package manager in tests.
  const location = projectLocation(cwd);
  const stack = await computeStackState({ home, cwd, spawn, fetch: fetchImpl, now });

  const commands = buildCommands({ home, cwd, env, spawn, fetch: fetchImpl, now });

  return runTui({
    installedVersion,
    updateAvailable,
    stack,
    location,
    readLocation: () => projectLocation(cwd),
    // The same offline probes as at start, never the network: `computeStackState` always calls
    // `buildReport` with `offline: true`, which reads the cache instead of calling `fetch`.
    readStack: () => computeStackState({ home, cwd, spawn, fetch: fetchImpl, now }),
    commands,
    ...io,
  });
}
