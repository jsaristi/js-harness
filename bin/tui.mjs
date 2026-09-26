#!/usr/bin/env node
// Zero-dependency TUI: rendering and key handling are pure (state + key -> state), so they are
// unit-tested without a terminal. Only `runTui`/`tuiMain` below touch real stdin/stdout.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { currentVersion, installMain, uninstallMain } from './install.mjs';
import { statusMain, updateMain, upgradeMain, resolveLatest } from './update.mjs';
import { isNewer } from './lib/version.mjs';

export const MENU_ITEMS = ['status', 'install', 'update', 'upgrade', 'uninstall', 'quit'];
const MENU_LABELS = {
  status: 'Status',
  install: 'Install',
  update: 'Update',
  upgrade: 'Upgrade',
  uninstall: 'Uninstall',
  quit: 'Quit',
};

/** Builds the initial menu state from the version info the caller already resolved. */
export function initialState({ installedVersion, updateAvailable }) {
  return { mode: 'menu', selected: 0, installedVersion, updateAvailable };
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

/** Pure: state -> the lines to draw. */
export function render(state) {
  const updateNote = state.updateAvailable ? `  (update available: ${state.updateAvailable})` : '';
  const lines = [`js-harness ${state.installedVersion}${updateNote}`, ''];
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
export function runTui({ installedVersion, updateAvailable, commands, stdin = process.stdin, stdout = process.stdout }) {
  let state = initialState({ installedVersion, updateAvailable });
  stdin.setRawMode?.(true);
  stdin.setEncoding('utf8');
  stdin.resume();
  stdout.write(screenText(state));

  return new Promise((resolve) => {
    async function onData(chunk) {
      const key = normalizeKey(chunk);
      const { state: next, effect } = handleKey(state, key);
      state = next;

      if (effect?.type === 'run') {
        stdin.pause();
        await commands[effect.command]();
        stdin.resume();
      }

      stdout.write(screenText(state));

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

/** CLI entry point: gathers version info, binds the real commands to a home, opens the TUI. */
export async function tuiMain(argv, env = process.env, spawn = spawnSync, io = {}) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const home = get('--home') ?? os.homedir();
  const installedVersion = currentVersion();

  let updateAvailable = null;
  try {
    const latest = resolveLatest({ source: get('--source'), pm: get('--pm') }, env, spawn);
    if (latest && isNewer(latest.version, installedVersion)) updateAvailable = latest.version;
  } catch {
    updateAvailable = null;
  }

  const commands = {
    status: () => statusMain(['--home', home], env, spawn),
    install: () => installMain(['--home', home]),
    update: () => updateMain(['--home', home], env, spawn),
    upgrade: () => upgradeMain(['--home', home], env, spawn),
    uninstall: () => uninstallMain(['--home', home]),
  };

  return runTui({ installedVersion, updateAvailable, commands, ...io });
}
