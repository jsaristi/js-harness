#!/usr/bin/env node
// Zero-dependency TUI: rendering and key handling are pure (state + key -> state), so they are
// unit-tested without a terminal. Only `runTui`/`tuiMain` below touch real stdin/stdout.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { currentVersion, installMain, uninstallMain } from './install.mjs';
import { statusMain, updateMain, upgradeMain, resolveLatest } from './update.mjs';
import { isNewer } from './lib/version.mjs';
import { doctorMain, buildReport } from './doctor.mjs';

export const MENU_ITEMS = ['status', 'doctor', 'install', 'update', 'upgrade', 'uninstall', 'quit'];
const MENU_LABELS = {
  status: 'Status',
  doctor: 'Doctor',
  install: 'Install',
  update: 'Update',
  upgrade: 'Upgrade',
  uninstall: 'Uninstall',
  quit: 'Quit',
};

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
 * stack block simply does not render (see `render` below), so older callers keep working. */
export function initialState({ installedVersion, updateAvailable, stack }) {
  return { mode: 'menu', selected: 0, installedVersion, updateAvailable, stack };
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
  if (state.mode === 'confirm-uninstall') {
    if (key === 'y') return { state: { ...state, mode: 'menu' }, effect: { type: 'run', command: 'uninstall' } };
    return { state: { ...state, mode: 'menu' }, effect: null };
  }

  if (key === 'up') {
    const selected = (state.selected - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
    return { state: { ...state, selected }, effect: null };
  }
  if (key === 'down') {
    const selected = (state.selected + 1) % MENU_ITEMS.length;
    return { state: { ...state, selected }, effect: null };
  }
  if (key === 'quit' || key === 'escape') {
    return { state: { ...state, mode: 'done' }, effect: { type: 'quit' } };
  }
  if (key === 'enter') {
    const command = MENU_ITEMS[state.selected];
    if (command === 'quit') return { state: { ...state, mode: 'done' }, effect: { type: 'quit' } };
    if (command === 'uninstall') return { state: { ...state, mode: 'confirm-uninstall' }, effect: null };
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
  for (const [i, item] of MENU_ITEMS.entries()) {
    const marker = i === state.selected ? '>' : ' ';
    lines.push(`${marker} ${MENU_LABELS[item]}`);
  }
  if (state.mode === 'confirm-uninstall') {
    lines.push('', 'Uninstall js-harness from this home? (y/N)');
  }
  return lines;
}

function screenText(state) {
  return `${render(state).join('\n')}\n`;
}

/** The thin I/O shell: wires real (or fake) stdin/stdout to the pure reducer above. */
export function runTui({
  installedVersion,
  updateAvailable,
  stack,
  commands,
  stdin = process.stdin,
  stdout = process.stdout,
}) {
  let state = initialState({ installedVersion, updateAvailable, stack });
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
        await commands[effect.command]();
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

/** CLI entry point: gathers version info, binds the real commands to a home, computes the stack
 * block (offline, never blocking on the network — see `computeStackState`), opens the TUI. `io` may
 * also carry `fetch`/`now` overrides for tests; production leaves them at their real defaults. */
/** The machine-level commands the menu runs, each bound to `home`. */
export function buildCommands({ home, env = process.env, spawn = spawnSync, fetch: fetchImpl = fetch, now } = {}) {
  return {
    status: () => statusMain(['--home', home], env, spawn),
    doctor: () => doctorMain(['--home', home], env, { spawn, fetch: fetchImpl, now }),
    install: () => installMain(['--home', home]),
    update: () => updateMain(['--home', home], env, spawn),
    upgrade: () => upgradeMain(['--home', home], env, spawn),
    // --global: the menu's uninstall is the machine one, wherever the TUI was opened.
    uninstall: () => uninstallMain(['--global', '--home', home]),
  };
}

export async function tuiMain(argv, env = process.env, spawn = spawnSync, io = {}) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const home = get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir();
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

  const stack = await computeStackState({ home, cwd: process.cwd(), spawn, fetch: fetchImpl, now });

  const commands = buildCommands({ home, env, spawn, fetch: fetchImpl, now });

  return runTui({ installedVersion, updateAvailable, stack, commands, ...io });
}
