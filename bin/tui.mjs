#!/usr/bin/env node
// Zero-dependency TUI, after gentle-ai's Bubble Tea design (odd/tasks/tui-gentle-level.md): rendering and key
// handling are pure (state + key -> state), so they are unit-tested without a terminal. Only `runTui`/`tuiMain`
// below touch real stdin/stdout, through the terminal layer (bin/lib/terminal.mjs) and child runs
// (bin/lib/run-child.mjs).
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cleanLine, createKeyReader, createTerminalGuard, layoutFrame, paint, scrollRange, splitKeys, splitOutput } from './lib/terminal.mjs';
import { handOff, runChild } from './lib/run-child.mjs';
import { currentVersion, installMain, syncMain, uninstallMain } from './install.mjs';
import { initMain } from './init.mjs';
import { statusMain, updateMain, upgradeMain, resolveLatest } from './update.mjs';
import { isNewer } from './lib/version.mjs';
import { projectLocation } from './lib/project.mjs';
import { installedVersion as manifestVersion } from './lib/manifest.mjs';
import { doctorMain, buildReport } from './doctor.mjs';
import { GAP_STATES } from './lib/digest.mjs';
import { remoteMain } from './remote.mjs';
import { resolveStackPm, stackInstallMain } from './stack.mjs';
import { functionsOf, gitIn, harnessOfTree, workingTree } from './lib/project-functions.mjs';
import { planStack } from './lib/stack-install.mjs';
import { resolveProjectRoot } from './lib/stack.mjs';
import { harnessHome } from './lib/home.mjs';

/** The machine-level menu items, in order: the whole menu outside a git repository, and the section
 * below `project` inside one. */
export const MENU_ITEMS = ['status', 'doctor', 'install', 'update', 'upgrade', 'uninstall', 'quit'];
/** The kinds of uninstall in the submenu Uninstall opens (odd/tasks/uninstall-kinds.md, S2), each run by the kind of
 * `js-harness uninstall` of the same name; `uninstall-project` is there only inside a project init touched. */
const MACHINE_UNINSTALL_ITEMS = ['uninstall-machine', 'uninstall-snapshots', 'uninstall-everything'];
/** Where there is a project to undo: the project section offers Sync and Status, and the submenu Project. */
const UNDOABLE_LOCATIONS = ['initialized', 'noPin', 'staleManifest', 'invalidHarnessJson'];
/** The remote-control server of the repository, last in the project section. */
const REMOTE_ITEMS = ['project-remote-status', 'project-remote-start', 'project-remote-stop'];
const MENU_LABELS = {
  status: 'Status',
  doctor: 'Doctor',
  'stack-install': 'Install the stack',
  install: 'Install',
  update: 'Update',
  upgrade: 'Upgrade',
  uninstall: 'Uninstall',
  'uninstall-project': 'Project',
  'uninstall-machine': 'Machine',
  'uninstall-snapshots': 'Machine + memory snapshots',
  'uninstall-everything': 'Everything',
  back: 'Back',
  quit: 'Quit',
  'project-init': 'Init',
  'project-sync': 'Sync',
  'project-status': 'Status',
  'project-remote-status': 'Remote status',
  'project-remote-start': 'Remote start',
  'project-remote-stop': 'Remote stop',
};
// Each kind of uninstall asks before it runs; its prompt names what it removes and what it keeps. A command has a
// prompt here exactly when it asks first, and `state.pending` names the command the open prompt is for. Stopping the
// remote server asks too: the sessions the phone opened through it end with it.
const CONFIRM_PROMPTS = {
  'uninstall-project': 'Undo js-harness in this project? It removes what init recorded in this clone and keeps the files you edited and the machine install. (y/N)',
  'uninstall-machine': 'Uninstall js-harness from this home? It removes what install recorded and the folders js-harness keeps here, and keeps the files you edited, the memory snapshots, the throughput records and the program. (y/N)',
  'uninstall-snapshots': 'Uninstall js-harness from this home and remove the memory snapshots, the only copy of what a pass changed? It keeps the files you edited, the throughput records and the program. (y/N)',
  // It names the snapshots too (release-095 S5, Pregunta 17).
  'uninstall-everything': "Remove everything js-harness keeps on this machine: the whole .js-harness folder of this home (the lead's notes, the backups, the memory snapshots) and the js-harness program itself? It keeps the projects' files. This cannot be undone. (y/N)",
  'project-remote-stop': 'Stop the remote server of this project? The sessions opened through it end. (y/N)',
};

// --- T5: the menu by location. Data built by a pure function, so it is tested without a terminal ---

const item = (id) => ({ id, label: MENU_LABELS[id] });
const header = (label) => ({ header: true, label });

/** The menu for where the TUI opened (a `projectLocation` result): outside a git repository exactly the
 * machine menu; inside one, a non-selectable `project` header with Init (not initialized) or Sync and Status
 * (initialized, a stale manifest or a bad `harness.json` included: `status` and `sync` name the problem, and the
 * Project kind of the Uninstall submenu clears it), then a non-selectable `machine` header with the machine items.
 * In every one of those the project section ends with Remote status, start and stop: `js-harness remote`
 * acts on any git repository, initialized or not. The login launcher (`--at-login`) is not offered here.
 * Entries are `{ id, label }`, or `{ header: true, label }` for a section header. While `stackGap` (a tool the
 * harness requires is missing, as `js-harness stack` reads it) the machine items hold Install the stack after Doctor
 * (odd/tasks/stack-install.md, D5). */
export function buildMenu(location = { kind: 'notGit' }, { stackGap = false } = {}) {
  const ids = stackGap ? MENU_ITEMS.flatMap((id) => (id === 'doctor' ? [id, 'stack-install'] : [id])) : MENU_ITEMS;
  const machine = ids.map(item);
  const section = (...ids) => [header('project'), ...[...ids, ...REMOTE_ITEMS].map(item), header('machine'), ...machine];
  if (location.kind === 'notInitialized') return section('project-init');
  if (UNDOABLE_LOCATIONS.includes(location.kind)) return section('project-sync', 'project-status');
  return machine;
}

/** The submenu Uninstall opens: an `uninstall` header, the kinds (Project first, where there is a project to undo),
 * and Back. */
export function buildUninstallMenu(location = { kind: 'notGit' }) {
  const kinds = UNDOABLE_LOCATIONS.includes(location.kind) ? ['uninstall-project', ...MACHINE_UNINSTALL_ITEMS] : MACHINE_UNINSTALL_ITEMS;
  return [header('uninstall'), ...[...kinds, 'back'].map(item)];
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
  const menu = buildMenu(location, { stackGap: state.stackGap });
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
  return { ...state, location, menu, selected, pending: undefined, parent: undefined };
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
export async function computeStackState(options) {
  return (await computeStackView(options)).stack;
}

/** `computeStackState`'s block with `stackGap` beside it: whether a tool the harness requires is missing, as
 * `js-harness stack` plans it (`planStack` over the same rows, with the project's switches), which shows Install the
 * stack in the menu. A probe that fails gives `'unknown'` and no gap. */
export async function computeStackView({ home, cwd, spawn, platform, fetch: fetchImpl, now, env }) {
  try {
    const rows = await buildReport({ home, cwd, offline: true, env }, { spawn, platform, fetch: fetchImpl, now });
    const project = resolveProjectRoot(cwd, spawn ?? spawnSync);
    const { resolved: functions } = functionsOf(harnessOfTree(project), workingTree(gitIn(project, spawn ?? spawnSync)));
    const plan = planStack({ rows, functions, pm: resolveStackPm(undefined, env ?? process.env), platform });
    return { stack: rows.map(summarizeStackRow), stackGap: plan.mandatory.length > 0 };
  } catch {
    return { stack: 'unknown', stackGap: false };
  }
}

/** Builds the initial menu state from the version info the caller already resolved. `stack` is the
 * result of `computeStackState` (an array of compact rows, or `'unknown'`); omitted entirely, the
 * stack block simply does not render (see `render` below), so older callers keep working. `location` is
 * a `projectLocation` result; omitted, the TUI is outside any repository and shows the machine menu. */
export function initialState({ installedVersion, updateAvailable, stack, stackGap = false, location = { kind: 'notGit' }, installedCopy = null }) {
  const menu = buildMenu(location, { stackGap });
  return {
    mode: 'menu',
    selected: firstSelectable(menu),
    installedVersion,
    updateAvailable,
    installedCopy,
    stack,
    stackGap,
    location,
    menu,
  };
}

/** Maps one raw chunk to its first key token (`splitKeys` reads them all); a lone Esc is `escape`. */
export function normalizeKey(chunk) {
  if (chunk === '\u001b') return 'escape';
  return splitKeys(chunk).keys[0] ?? chunk;
}

/** Pure: the menu the submenu was opened from, back in place, with the selection where it was. */
function leaveSubmenu(state) {
  return { ...state, mode: 'menu', pending: undefined, menu: state.parent.menu, selected: state.parent.selected, parent: undefined };
}

// --- the run screen (odd/tasks/tui-gentle-level.md, S4): a command running as a child, then its result ---

const SPINNER = ['|', '/', '-', '\\'];
// The most lines of output a run keeps: older lines leave the log first.
const MAX_LOG = 5000;
const MENU_KEYS = 'Up/Down move, Enter select, Esc back, q quit';
const RUN_KEYS = 'ctrl+c cancels it; the other keys wait until it ends';
const SCROLL_KEYS = 'Up/Down/PgUp/PgDn/Home/End scroll';
const RESULT_KEYS = 'Enter or Esc back to the menu, q quit';
// On the version line while the menu reads again what a command may have changed.
export const REFRESHING = '  (reading what it changed...)';

/** What a run is called on its screen: the item's label, with its section where the label alone is ambiguous. */
function titleOf(command) {
  const label = MENU_LABELS[command] ?? command;
  if (command.startsWith('project-')) return `Project ${label.toLowerCase()}`;
  if (command.startsWith('uninstall-')) return `Uninstall ${label.toLowerCase()}`;
  return label;
}

/** Pure: the state of a command that has just started; the menu stays underneath, untouched, for the way back. */
export function startRun(state, command) {
  return { ...state, mode: 'running', run: { command, title: titleOf(command), log: [], partials: {}, frame: 0, scroll: 0, notes: [] } };
}

// The most characters an unfinished line keeps: a progress bar redrawn with `\r` never ends its line.
const MAX_PARTIAL = 4096;

/** An unfinished line, kept short: only what its last carriage return left, and at most `MAX_PARTIAL`. */
function boundPartial(partial) {
  const shown = partial.length > MAX_PARTIAL ? partial.slice(partial.lastIndexOf('\r') + 1) : partial;
  return shown.slice(-MAX_PARTIAL);
}

/** Pure: `text` from the running command's `stream` added to its log, each line made safe to draw. Each stream
 * keeps its own unfinished line, so a line of stderr never lands in the middle of one of stdout. */
export function appendRunOutput(state, text, stream = 'stdout') {
  const { lines, partial } = splitOutput(state.run.partials[stream] ?? '', text);
  const partials = { ...state.run.partials, [stream]: boundPartial(partial) };
  if (lines.length === 0) return { ...state, run: { ...state.run, partials } };
  const log = [...state.run.log, ...lines.map(cleanLine)].slice(-MAX_LOG);
  return { ...state, run: { ...state.run, log, partials } };
}

/** The unfinished lines of a run, safe to draw. */
const unfinished = (run) => Object.values(run.partials).filter(Boolean).map(cleanLine);

/** Pure: the run ended, as `{ code, cancelled, error, signal }`; the result screen shows it from the top of its tail. */
export function finishRun(state, { code = null, cancelled = false, error = null, signal = null } = {}) {
  const closeOnLeave = state.run.command === 'uninstall-everything' && code === 0 && !cancelled;
  return { ...state, mode: 'result', run: { ...state.run, log: [...state.run.log, ...unfinished(state.run)], partials: {}, code, cancelled, error, signal, closeOnLeave, scroll: 0 } };
}

const quitting = (state) => ({ state: { ...state, mode: 'done' }, effect: { type: 'quit' } });

/** Keys on the result screen: scroll the log, go back to the menu, or quit. The log scrolls by the rows the window
 * draws, a wrapped line counting each of its rows, so Home reaches its first row and a page is what it shows. */
function resultKey(state, key, { columns = 80, rows = 24 }) {
  const { page, max } = scrollRange(sections(state), { columns, rows });
  const scrollBy = { up: 1, down: -1, pgup: page, pgdn: -page }[key];
  if (scrollBy !== undefined) return { state: { ...state, run: { ...state.run, scroll: Math.min(max, Math.max(0, state.run.scroll + scrollBy)) } }, effect: null };
  if (key === 'home' || key === 'end') return { state: { ...state, run: { ...state.run, scroll: key === 'home' ? max : 0 } }, effect: null };
  if (key === 'quit' || key === 'ctrl-c' || (state.run.closeOnLeave && (key === 'enter' || key === 'escape'))) return quitting(state);
  if (key === 'enter' || key === 'escape') return { state: { ...state, mode: 'menu', run: undefined }, effect: null };
  return { state, effect: null };
}

/**
 * Pure reducer: (state, key token) -> { state, effect }. `effect` is null, `{ type: 'run', command }`,
 * `{ type: 'cancel' }` or `{ type: 'quit' }` — the shell performs it, the reducer never does. While a command runs,
 * only ctrl+c is read, and it cancels the command. Esc is Back, as in gentle-ai: it leaves the Uninstall submenu
 * (`state.parent` holds the menu it was opened from) and does nothing on the main menu; q and ctrl+c quit.
 * `size` is the window's `{ columns, rows }`, for scrolling the result screen's log.
 */
export function handleKey(state, key, size = {}) {
  if (state.mode === 'running') {
    if (key === 'ctrl-c' && !state.run.cancelling) return { state: { ...state, run: { ...state.run, cancelling: true } }, effect: { type: 'cancel' } };
    return { state, effect: null };
  }
  if (state.mode === 'result') return resultKey(state, key, size);
  if (state.mode === 'confirm') {
    if (key === 'y') return { state: state.parent ? leaveSubmenu(state) : { ...state, mode: 'menu', pending: undefined }, effect: { type: 'run', command: state.pending } };
    if (key === 'ctrl-c') return quitting(state);
    return { state: { ...state, mode: 'menu', pending: undefined }, effect: null };
  }
  if (key === 'escape') return { state: state.parent ? leaveSubmenu(state) : state, effect: null };
  if (key === 'up' || key === 'down' || key === 'tab' || key === 'shift-tab') {
    const selected = stepSelection(state.menu, state.selected, key === 'up' || key === 'shift-tab' ? -1 : 1);
    return { state: { ...state, selected }, effect: null };
  }
  if (key === 'home' || key === 'pgup') return { state: { ...state, selected: firstSelectable(state.menu) }, effect: null };
  if (key === 'end' || key === 'pgdn') return { state: { ...state, selected: stepSelection(state.menu, 0, -1) }, effect: null };
  if (key === 'quit' || key === 'ctrl-c') return quitting(state);
  if (key === 'enter') {
    const command = state.menu[state.selected].id;
    if (command === 'quit') return quitting(state);
    if (command === 'back') return { state: leaveSubmenu(state), effect: null };
    if (command === 'uninstall') {
      const menu = buildUninstallMenu(state.location);
      return { state: { ...state, parent: { menu: state.menu, selected: state.selected }, menu, selected: firstSelectable(menu) }, effect: null };
    }
    if (Object.hasOwn(CONFIRM_PROMPTS, command)) return { state: { ...state, mode: 'confirm', pending: command }, effect: null };
    return { state, effect: { type: 'run', command } };
  }
  return { state, effect: null };
}

/** The header: the version, with an update or a copy to reopen, then the stack block. */
function headerLines(state) {
  // A newer copy installed under the home (an Upgrade from this menu) runs only in a new process: this one keeps
  // its code, so the header says to open the menu again instead of offering the update once more (release-095 F1).
  const reopen = state.installedCopy && isNewer(state.installedCopy, state.installedVersion);
  let updateNote = '';
  if (reopen) updateNote = `  (${state.installedCopy} installed: quit and open js-harness again to use it)`;
  else if (state.updateAvailable) updateNote = `  (update available: ${state.updateAvailable})`;
  else if (state.checkingUpdate) updateNote = '  (checking for updates...)';
  const lines = [`js-harness ${state.installedVersion}${updateNote}${state.refreshing ? REFRESHING : ''}`];
  if (Array.isArray(state.stack)) {
    for (const row of state.stack) {
      lines.push(`  ${row.id.padEnd(16)}${String(row.version).padEnd(10)}${row.state}`);
    }
  } else if (state.stack === 'unknown') {
    lines.push('  stack: unknown');
  } else if (state.stack === 'checking') {
    lines.push('  stack: checking...');
  }
  return lines;
}

/** What the result screen says the run did, and what comes next. */
function resultLines(run) {
  let title;
  if (run.error) title = `${run.command} failed: ${run.error}`;
  else if (run.cancelled) title = `${run.title}: cancelled; the command was stopped before it finished`;
  else if (run.signal) title = `${run.title}: failed (stopped by ${run.signal})`;
  else if (run.code === 0 || run.code === undefined) title = `${run.title}: done (exit 0)`;
  else title = `${run.title}: failed (exit ${run.code})`;
  let next;
  if (run.closeOnLeave) next = 'Everything js-harness kept is removed, this menu included: Enter, Esc or q closes it.';
  else if (run.cancelled) next = 'It may have done part of its work: run it again from the menu to finish it.';
  else if (run.error || run.signal || (run.code !== 0 && run.code !== undefined)) next = 'The log above is its whole output: fix what it names, then run it again from the menu.';
  else next = 'Back in the menu, Status and Doctor show what changed.';
  return { title, next };
}

/** Pure: the frame's parts — `top`, `body` (with `focus`, the selected line, or `scroll`, rows above a log's
 * tail) and `bottom` — that `layoutFrame` fits to the window. */
export function sections(state) {
  if (state.mode === 'running' || state.mode === 'result') {
    const { run } = state;
    const head = `js-harness ${state.installedVersion}${state.refreshing ? REFRESHING : ''}`;
    // While it runs, the line it is still writing (a progress bar redrawn in place) shows as the last row.
    const shown = [...run.log, ...unfinished(run)];
    const body = shown.length ? shown : ['(no output yet)'];
    if (state.mode === 'running') {
      const status = run.cancelling ? `${run.title}: cancelling...` : `${SPINNER[run.frame % SPINNER.length]} ${run.title}: running`;
      return { top: [head, '', status, ''], body, scroll: 0, bottom: ['', RUN_KEYS] };
    }
    const { title, next } = resultLines(run);
    const keys = run.closeOnLeave ? SCROLL_KEYS : `${SCROLL_KEYS}, ${RESULT_KEYS}`;
    return { top: [head, '', title, ''], body: run.log.length ? run.log : ['(no output)'], scroll: run.scroll, bottom: ['', ...run.notes, next, keys] };
  }
  const body = state.menu.map((entry, i) => (entry.header ? entry.label : `${i === state.selected ? '>' : ' '} ${entry.label}`));
  const bottom = state.mode === 'confirm' ? ['', CONFIRM_PROMPTS[state.pending]] : ['', MENU_KEYS];
  return { top: [...headerLines(state), ''], body, focus: state.selected, bottom };
}

/** Pure: state -> the logical lines of its screen, before they are fitted to a window (`frame` does that). The
 * stack block renders above the menu, straight from `state.stack`: nothing here probes anything. */
export function render(state) {
  const { top, body, bottom } = sections(state);
  return [...top, ...body, ...bottom];
}

/** Pure: state -> the rows drawn in a `{ columns, rows }` window: none wider, never more of them. */
export function frame(state, size) {
  return layoutFrame(sections(state), size);
}

/** An error as one printable line: its first line, without C0, DEL or C1 control characters (U+009B is a
 * one-byte CSI on some terminals, so an untrusted message must not keep it). */
function oneLine(err) {
  return String(err?.message ?? err)
    .split('\n')[0]
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
}

/**
 * The thin I/O shell: wires real (or fake) stdin/stdout to the pure reducer above, on the alternate screen (S1),
 * repainting the whole frame fitted to the window on every change and on `resize` (S2).
 *
 * `commands` maps a menu item to `(location, { output, signal })`, which resolves to an exit code or to
 * `{ code, cancelled, error }`: it writes what it prints through `output`, which lands in the run screen's log, and
 * stops when `signal` aborts (ctrl+c while it runs). A command with `handoff: true` asks its own questions, so the
 * terminal is handed to it (main screen, keys cooked) and taken back once it ends and a key is pressed.
 *
 * `location` is the `projectLocation` the menu opens on; `readLocation` (sync or async) reads it again after every
 * command, since a command can change it (`init` initializes the project, `uninstall` undoes it). `readStackView`
 * reads the stack block and `stackGap` again (`readStack` the block alone) and `readUpdate` the version note, both
 * after every command. `loaders` are read once after the first draw (S5), each resolving to a part of the state
 * (`{ stack, stackGap }`, `{ updateAvailable, installedCopy }`), so slow work never delays the menu.
 */
export function runTui({
  installedVersion,
  updateAvailable,
  installedCopy = null,
  stack,
  stackGap = false,
  checkingUpdate = false,
  location,
  readLocation,
  readStack,
  readStackView,
  readUpdate,
  loaders = [],
  commands,
  stdin = process.stdin,
  stdout = process.stdout,
  proc = process,
  escapeMs = 50,
  tickMs = 100,
}) {
  let state = { ...initialState({ installedVersion, updateAvailable, stack, stackGap, location, installedCopy }), checkingUpdate };
  const size = () => ({ columns: stdout.columns || 80, rows: stdout.rows || 24 });
  // Once the menu has ended, the main screen is back: nothing more is drawn over it.
  // While a command owns the terminal (`handedOff`), nothing is drawn either: a frame would clear its prompts.
  const draw = () => finished || handedOff || stdout.write(paint(frame(state, size())));
  let drawQueued = false;
  const drawSoon = () => {
    if (drawQueued) return;
    drawQueued = true;
    setImmediate(() => {
      drawQueued = false;
      draw();
    });
  };
  let controller = null;
  // Stops what the loaders still run (a tag lookup over the network) once the menu ends.
  const loading = new AbortController();
  let afterHandoff = null;
  let handedOff = false;
  let finished = false;

  return new Promise((resolve, reject) => {
    const guard = createTerminalGuard({
      stdin,
      stdout,
      proc,
      // A signal from outside ends the menu like q does, a running command with it: the terminal first, since
      // stopping the command reads the process table, which takes a moment on Windows.
      onSignal: (signal) => {
        finish(signal === 'SIGINT' ? 130 : 143);
        controller?.abort();
      },
    });
    const reader = createKeyReader({ onKey, timeoutMs: escapeMs });
    const onData = (chunk) => {
      if (afterHandoff) {
        const back = afterHandoff;
        afterHandoff = null;
        back();
        return;
      }
      reader.feed(String(chunk));
    };
    const onResize = () => draw();

    /** Ends the menu: the terminal is given back first, then what still runs is stopped. */
    function end() {
      finished = true;
      reader.dispose();
      stdin.removeListener('data', onData);
      stdout.removeListener?.('resize', onResize);
      guard.restore();
      stdin.pause();
      loading.abort();
    }
    function finish(code) {
      if (finished) return;
      end();
      resolve(code);
    }
    function fail(err) {
      if (finished) return;
      end();
      reject(err);
    }

    /** Reads what a command may have changed: the location, the stack block, the version note. A read that fails
     * keeps what was there, and says so under the result. The reads may finish after the user left the result
     * screen, so what they found is applied to the state as it is then: the menu is rebuilt only where nothing is
     * open on it, and a submenu or a confirm prompt is left as it is, its menu rebuilt once the user leaves it. */
    async function refresh() {
      const notes = [];
      const attempt = async (what, read) => {
        try {
          await read();
        } catch (err) {
          notes.push(`${what} failed: ${oneLine(err)}`);
        }
      };
      const found = {};
      if (readLocation) await attempt('reading the project', async () => { found.location = await readLocation(); });
      if (readStackView) {
        await attempt('refreshing the stack', async () => {
          const view = await readStackView();
          found.data = { stack: view.stack, stackGap: view.stackGap };
        });
      } else if (readStack) {
        await attempt('refreshing the stack', async () => { found.data = { stack: await readStack() }; });
      }
      if (readUpdate) {
        await attempt('reading the installed version', async () => {
          const { updateAvailable: available = null, installedCopy: copy = null } = (await readUpdate()) ?? {};
          found.update = { updateAvailable: available, installedCopy: copy };
        });
      }
      if (finished) return;
      let next = { ...state, ...found.data, ...found.update, refreshing: false };
      if ('location' in found) next.location = found.location;
      next = rebuildIfFree({ ...next, menuStale: true });
      if (notes.length && next.mode === 'result') next = { ...next, run: { ...next.run, notes } };
      state = next;
    }

    /** The menu built again for the current location and stack, when nothing is open on it (the result screen
     * keeps it underneath); a state with a submenu or a confirm prompt open keeps its menu, marked stale. */
    function rebuildIfFree(current) {
      if (!current.menuStale) return current;
      if (current.mode === 'result' || (current.mode === 'menu' && !current.parent)) return withLocation({ ...current, menuStale: false }, current.location);
      return current;
    }

    async function runCommand(command) {
      const run = commands[command];
      state = startRun(state, command);
      draw();
      controller = new AbortController();
      // The spinner turns only on the run screen: a command handed the terminal is never drawn over.
      const ticker = run?.handoff ? null : setInterval(() => {
        state = { ...state, run: { ...state.run, frame: state.run.frame + 1 } };
        draw();
      }, tickMs);
      let result;
      try {
        if (run?.handoff) {
          // Keys stop being read before they turn cooked, so the command gets its first keystroke.
          stdin.pause();
          handedOff = true;
          guard.suspend();
          try {
            result = await run(state.location, { signal: controller.signal });
            if (finished) return;
            stdout.write(`\r\n${titleOf(command)} ended (exit ${result?.code ?? result ?? 'unknown'}). Press Enter to go back to the menu.`);
            await new Promise((back) => {
              afterHandoff = back;
              stdin.resume();
            });
          } finally {
            // The menu takes the terminal back however the command ended, a throw included.
            if (!finished) {
              stdin.resume();
              guard.resume();
              handedOff = false;
            }
          }
          state = appendRunOutput(state, 'It ran on the terminal itself: its output is on the main screen, which comes back when the menu quits.\n');
        } else {
          result = await run(state.location, { output: (text, stream) => { state = appendRunOutput(state, text, stream); drawSoon(); }, signal: controller.signal });
        }
      } catch (err) {
        result = { code: null, error: oneLine(err) };
      } finally {
        if (ticker) clearInterval(ticker);
        controller = null;
      }
      if (finished) return;
      // A main that returns nothing ended well, as on the command line, where it exits 0.
      const outcome = typeof result === 'object' && result !== null ? result : { code: result ?? 0 };
      state = finishRun(state, outcome);
      // Once everything is gone, the program included, there is nothing left to read again. The first result
      // frame already says the menu is reading, so nothing reading the screen takes it for settled.
      const rereads = !state.run.closeOnLeave;
      if (rereads) state = { ...state, refreshing: true };
      draw();
      if (rereads) {
        await refresh();
        draw();
      }
    }

    function onKey(key) {
      if (finished) return;
      try {
        const { state: next, effect } = handleKey(state, key, size());
        state = rebuildIfFree(next);
        if (effect?.type === 'cancel') {
          // "cancelling" shows before the kill, which reads the process table first.
          draw();
          controller?.abort();
          return;
        }
        if (effect?.type === 'quit') {
          finish(0);
          return;
        }
        if (effect?.type === 'run') {
          runCommand(effect.command).catch(fail);
          return;
        }
        draw();
      } catch (err) {
        fail(err);
      }
    }

    guard.enter();
    stdin.setEncoding?.('utf8');
    stdin.on('data', onData);
    stdout.on?.('resize', onResize);
    stdin.resume();
    draw();
    // The slow reads start once the menu is on screen; each fills its part and draws again.
    if (loaders.length) {
      setImmediate(() => {
        for (const load of loaders) {
          Promise.resolve()
            .then(() => load({ signal: loading.signal }))
            .then((part) => {
              if (finished || !part) return;
              const gapChanged = 'stackGap' in part && part.stackGap !== state.stackGap;
              state = { ...state, ...part };
              if (gapChanged && state.mode === 'menu' && !state.parent) state = withLocation(state, state.location);
              draw();
            })
            .catch(() => {});
        }
      });
    }
  });
}

// --- the commands: each menu item is one `js-harness` command line ---

const CLI = path.join(import.meta.dirname, 'js-harness.mjs');

/**
 * The `js-harness` arguments each menu item runs. The machine ones do not change scope with the folder: `status`
 * and `sync` pass `--global`, and each kind of uninstall names its kind, which never acts by location, so the same
 * Enter never acts on a project. (`doctor` reads the folder's project, like the stack block, so it gets `--cwd`.)
 * Every project command acts on the `root` (the repository's top-level) of the location the menu was last built
 * for, with `--cwd`, so a repository that appears, or a project that moves, while the menu is open never leaves an
 * item bound to a stale root; `root` serves callers with no location. `source` is the folder of tarballs the menu
 * was opened with, passed on, so that its header and its three version commands read the same release source.
 */
export function commandArgv(command, { home, cwd = process.cwd(), root, source, location } = {}) {
  const fromSource = source ? ['--source', source] : [];
  const at = () => {
    const where = location?.root ?? root;
    if (!where) throw new Error('no project to act on');
    return ['--cwd', where, '--home', home];
  };
  const table = {
    'project-init': () => ['init', ...at()],
    'project-sync': () => ['sync', ...at()],
    'project-status': () => ['status', ...at()],
    'uninstall-project': () => ['uninstall', 'project', ...at()],
    // `remote` takes the same `--cwd` and `--home` for its three subcommands, and nothing else is passed.
    'project-remote-status': () => ['remote', 'status', ...at()],
    'project-remote-start': () => ['remote', 'start', ...at()],
    'project-remote-stop': () => ['remote', 'stop', ...at()],
    status: () => ['status', '--global', '--home', home, ...fromSource],
    doctor: () => ['doctor', '--home', home, '--cwd', cwd],
    'stack-install': () => ['stack', 'install', '--home', home, '--cwd', cwd],
    install: () => ['install', '--home', home],
    update: () => ['update', '--home', home, ...fromSource],
    upgrade: () => ['upgrade', '--home', home, ...fromSource],
    sync: () => ['sync', '--global', '--home', home],
    'uninstall-machine': () => ['uninstall', 'machine', '--home', home],
    'uninstall-snapshots': () => ['uninstall', 'snapshots', '--home', home],
    'uninstall-everything': () => ['uninstall', 'everything', '--home', home],
  };
  if (!table[command]) throw new Error(`no menu command ${command}`);
  return table[command]();
}

/** The menu's commands as children of `node bin/js-harness.mjs`, the way the menu runs them (S4): output piped
 * to the run screen, stdin closed, the tree stopped on cancel. Install the stack asks y/N before each install it
 * runs, so it is handed the terminal and asks there exactly as on the command line (`handoff`). */
export function childCommands({ home, cwd = process.cwd(), env = process.env, source, runChild: run = runChild, handOff: hand = handOff } = {}) {
  const childEnv = env === process.env ? env : { ...process.env, ...env };
  const commands = {};
  for (const command of COMMAND_IDS) {
    commands[command] = async (location, { output, signal } = {}) => run(process.execPath, [CLI, ...commandArgv(command, { home, cwd, source, location })], { env: childEnv, cwd, onOutput: output, signal });
  }
  commands['stack-install'] = Object.assign(
    async (location, { signal } = {}) => hand(process.execPath, [CLI, ...commandArgv('stack-install', { home, cwd, source, location })], { env: childEnv, cwd, signal }),
    { handoff: true },
  );
  return commands;
}

const COMMAND_IDS = [
  'project-init', 'project-sync', 'project-status', 'uninstall-project',
  'project-remote-status', 'project-remote-start', 'project-remote-stop',
  'status', 'doctor', 'stack-install', 'install', 'update', 'upgrade', 'sync',
  'uninstall-machine', 'uninstall-snapshots', 'uninstall-everything',
];

/** The same commands run in this process, each bound to `home`, with the arguments `commandArgv` gives the
 * child: the seam the tests use to hand a command a fake `spawn`, `fetch` or `now`. */
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
  // The arguments after the command's own words: what its main takes.
  const args = (command, location, words = 1) => commandArgv(command, { home, cwd, root, source, location }).slice(words);
  return {
    'project-init': async (location) => initMain(args('project-init', location), env),
    'project-sync': async (location) => syncMain(args('project-sync', location), env),
    'project-status': async (location) => statusMain(args('project-status', location), env, spawn),
    'uninstall-project': async (location) => uninstallMain(args('uninstall-project', location), env),
    'project-remote-status': async (location) => remote(args('project-remote-status', location), env),
    'project-remote-start': async (location) => remote(args('project-remote-start', location), env),
    'project-remote-stop': async (location) => remote(args('project-remote-stop', location), env),
    status: () => statusMain(args('status'), env, spawn),
    doctor: () => doctorMain(args('doctor'), env, { spawn, fetch: fetchImpl, now }),
    'stack-install': (location, io = {}) => stackInstallMain(args('stack-install', location, 2), env, { ask: io.ask, interactive: true }),
    install: () => installMain(args('install')),
    update: () => updateMain(args('update'), env, spawn),
    upgrade: () => upgradeMain(args('upgrade'), env, spawn),
    sync: () => syncMain(args('sync')),
    'uninstall-machine': () => uninstallMain(args('uninstall-machine')),
    'uninstall-snapshots': () => uninstallMain(args('uninstall-snapshots')),
    'uninstall-everything': () => uninstallMain(args('uninstall-everything')),
  };
}

const UPDATE_URL = pathToFileURL(path.join(import.meta.dirname, 'update.mjs')).href;

/** The newest release, looked up off the menu's thread: a folder of tarballs is read here, and the repository's
 * tags are listed by a child (`git ls-remote` over the network can take seconds), so keys and resize never wait.
 * The child runs from the temp folder, never the user's, and an abort stops it with its `git`. */
export async function latestRelease({ source, repo, env = process.env, signal }) {
  if (source) return resolveLatest({ source, repo });
  const script = `import(${JSON.stringify(UPDATE_URL)}).then((m) => process.stdout.write(JSON.stringify(m.resolveLatest({ repo: process.argv[1] || undefined }))))`;
  let out = '';
  const { code, cancelled, error } = await runChild(process.execPath, ['--input-type=module', '-e', script, repo ?? ''], { env, cwd: os.tmpdir(), signal, onOutput: (text, stream) => { if (stream === 'stdout') out += text; } });
  if (code !== 0) throw new Error(error ?? (cancelled ? 'cancelled' : `the tag lookup exited ${code}`));
  return JSON.parse(out);
}

/** CLI entry point: reads where it opened (`--cwd`, default the current folder), binds the commands to a home and
 * opens the menu at once; the update check and the stack block (offline, never the network — see
 * `computeStackState`) fill in after the first draw. `io` may carry `fetch`/`now` overrides for tests, and
 * `inProcess: true` runs the commands in this process (`buildCommands`) so a test's fakes reach them; production
 * runs each as a child. `argv` is a test seam: bin/js-harness.mjs opens the menu with no arguments, so only the
 * tests pass `--home`, `--cwd` or `--source`. */
export async function tuiMain(argv, env = process.env, spawn = spawnSync, io = {}) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  // An empty JS_HARNESS_HOME is no home, as for the other commands: taken as it is it would name the folder the menu runs in.
  const home = harnessHome({ given: get('--home'), env, homedir: os.homedir });
  const cwd = get('--cwd') ?? process.cwd();
  const installedVersion = currentVersion();
  const { fetch: fetchImpl = fetch, now, inProcess = false, ...rest } = io;

  // The newest release: in a folder of tarballs when one is named, else the repository's tags. It is looked up
  // once, after the first draw; what the home's manifest records is read again after each command, since an
  // Upgrade installs a newer copy than the one running this menu.
  const source = get('--source') ?? env.JS_HARNESS_SOURCE;
  let latest = null;
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
  const loadUpdate = async ({ signal } = {}) => {
    try {
      // The repository JS_HARNESS_REPO names, as update and status read it, so the header and those items agree.
      latest = await latestRelease({ source, repo: env.JS_HARNESS_REPO, env: env === process.env ? env : { ...process.env, ...env }, signal });
    } catch {
      latest = null;
    }
    return { ...readUpdate(), checkingUpdate: false };
  };

  // Real `git`, whatever `spawn` is: `spawn` stands in for the package manager in tests.
  const location = projectLocation(cwd);
  const readStackView = () => computeStackView({ home, cwd, spawn, fetch: fetchImpl, now });
  const commands = inProcess ? buildCommands({ home, cwd, env, spawn, fetch: fetchImpl, now, source }) : childCommands({ home, cwd, env, source });

  return runTui({
    installedVersion,
    ...readUpdate(),
    checkingUpdate: true,
    readUpdate,
    stack: 'checking',
    location,
    readLocation: () => projectLocation(cwd),
    // The same offline probes as at start, never the network: `computeStackView` always calls
    // `buildReport` with `offline: true`, which reads the cache instead of calling `fetch`.
    readStackView,
    loaders: [() => readStackView(), loadUpdate],
    commands,
    ...rest,
  });
}
