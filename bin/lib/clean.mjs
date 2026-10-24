// `js-harness clean` (odd/tasks/clean.md): the regenerable leftovers our way of developing leaves on a machine. `scan`
// finds each known kind and sizes it, read-only; `applyKinds` deletes the kinds the user confirmed, through the
// tool that owns them when one does, and appends each deletion to `<home>/.js-harness/clean-log.jsonl`; the measure
// record (`clean.json`) is what the `clean` row of doctor reads, refreshed in the background at most once every
// CLEAN_EVERY_DAYS. Every path hangs off `home` and `tmpdir`, so a test reads and deletes only its scratch folders.
import { spawn as spawnAsync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appFolders } from './host-update.mjs';
import { compareSemver } from './version.mjs';
import { homeIsSet } from './home.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
// Assumptions of S10, his to confirm: how often the measure runs, the total that makes the row a gap, and how old a
// scratch folder must be before it counts as left behind rather than in use.
export const CLEAN_EVERY_DAYS = 7;
export const CLEAN_THRESHOLD_BYTES = 2 * 1024 ** 3;
const SCRATCH_AGE_DAYS = 3;
// A measure that started this recently is still running (or died): another session start does not start a second.
const STARTED_FRESH_MS = 60 * 60 * 1000;
// The name a folder is renamed to before it is removed, so a removal that stops halfway is found again by the scan.
const LEFTOVER_PREFIX = '.js-harness-clean-';
const VERSION = /^\d+\.\d+\.\d+$/;
const QUERY_TIMEOUT_MS = 60 * 1000;
const CLEAN_TIMEOUT_MS = 30 * 60 * 1000;

export const KIND_IDS = [
  'codex-releases',
  'claude-versions',
  'claude-desktop-cli',
  'codex-staging',
  'temp-scratch',
  'npm-cache',
  'pnpm-store',
  'go-modcache',
  'uv-cache',
];

/** Runs `command args` in `cwd` and returns spawnSync's result. On Windows the tools are `.cmd` shims, so it goes
 * through a shell as one line; the arguments are fixed literals of this file. The scan and the clean both run in the
 * home, because pnpm names the store of the drive it runs on. Never throws: a tool that is not there is an `error` on
 * the result. */
function defaultRun(command, args, { platform = process.platform, timeout = QUERY_TIMEOUT_MS, cwd } = {}) {
  const shell = platform === 'win32';
  const [file, argv] = shell ? [[command, ...args].join(' '), []] : [command, args];
  try {
    return spawnSync(file, argv, { encoding: 'utf8', shell, timeout, windowsHide: true, ...(cwd ? { cwd } : {}) });
  } catch (error) {
    return { status: null, error, stdout: '' };
  }
}

/** The first line a tool printed, when it ran and exited 0; otherwise `null`. */
function answer(run, command, args) {
  const result = run(command, args);
  if (!result || result.error || result.status !== 0) return null;
  return String(result.stdout ?? '').trim().split(/\r?\n/)[0]?.trim() ?? '';
}

/** `{ bytes, newest, linkedWorktree }` of a file or folder: its size with everything under it, the newest time of
 * anything in it, and whether it holds a `.git` (a clone, or a linked worktree of a repository elsewhere). Links are not
 * followed; what cannot be read counts as nothing. */
function measureTree(target) {
  const total = { bytes: 0, newest: 0, linkedWorktree: false };
  const stack = [target];
  while (stack.length > 0) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      continue;
    }
    total.newest = Math.max(total.newest, stat.mtimeMs);
    if (current !== target && path.basename(current) === '.git') total.linkedWorktree = true;
    if (stat.isSymbolicLink()) continue;
    if (!stat.isDirectory()) {
      total.bytes += stat.size;
      continue;
    }
    let names = [];
    try {
      names = fs.readdirSync(current);
    } catch {
      // An unreadable folder counts as empty.
    }
    for (const name of names) stack.push(path.join(current, name));
  }
  return total;
}

/** The names in `folder`, or none when it cannot be read. */
function children(folder) {
  try {
    return fs.readdirSync(folder);
  } catch {
    return [];
  }
}

/** True when `target` is a folder itself, not a file or a link to one. */
function isFolder(target) {
  try {
    return fs.lstatSync(target).isDirectory();
  } catch {
    return false;
  }
}

/** The items of `folder` whose names `pick` keeps, each with its size, plus any leftover of a removal that stopped. */
function itemsOf(folder, pick) {
  return children(folder)
    .filter((name) => name.startsWith(LEFTOVER_PREFIX) || pick(name, path.join(folder, name)))
    .map((name) => ({ path: path.join(folder, name), bytes: measureTree(path.join(folder, name)).bytes }));
}

/** The highest of the version names in `names`, or `null`. */
function highest(names) {
  return names.filter((name) => VERSION.test(name)).sort(compareSemver).at(-1) ?? null;
}

/** The version `claude --version` reports, or `null`. */
function runningClaude(run) {
  return /(\d+\.\d+\.\d+)/.exec(answer(run, 'claude', ['--version']) ?? '')?.[1] ?? null;
}

const codexDaemon = (home) => path.join(home, '.codex', 'packages', 'app-server-daemon');

/** The release folder `current` resolves to, or `null` when it cannot be resolved. */
function currentCodex(home) {
  try {
    return fs.realpathSync(path.join(codexDaemon(home), 'current'));
  } catch {
    return null;
  }
}

/** The desktop app's folder of Code tab CLIs: the first app folder there is, as the host-update row reads it. */
function desktopCli({ home, platform }) {
  const folder = appFolders({ platform, home }).find((dir) => fs.existsSync(dir));
  return folder ? path.join(folder, 'claude-code') : null;
}

/** Each kind of leftover kept in a folder, in KIND_IDS order: `{ id, why, root, items }`. */
function folderKinds({ home, tmpdir, platform, now, run }) {
  const oldEnough = (target) => measureTree(target).newest < now().getTime() - SCRATCH_AGE_DAYS * DAY_MS;
  const kinds = [];

  const releases = path.join(codexDaemon(home), 'releases');
  const current = currentCodex(home);
  let autoUpdate = null;
  try {
    autoUpdate = fs.readFileSync(path.join(codexDaemon(home), 'auto-update-version'), 'utf8').trim();
  } catch {
    // No auto-update record: only `current` is kept.
  }
  kinds.push({
    id: 'codex-releases',
    why: 'old Codex app-server releases: Codex runs the one `current` points to, and downloads again a release it lacks',
    root: releases,
    items: current ? itemsOf(releases, (name) => name !== path.basename(current) && name !== autoUpdate) : [],
  });

  const versions = path.join(home, '.local', 'share', 'claude', 'versions');
  const running = runningClaude(run);
  const top = highest(children(versions));
  kinds.push({
    id: 'claude-versions',
    why: 'old Claude Code CLI versions: the highest and the running one are kept, and the updater downloads what it needs',
    root: versions,
    items: running ? itemsOf(versions, (name) => VERSION.test(name) && name !== running && name !== top) : [],
  });

  const desktop = desktopCli({ home, platform });
  const desktopTop = desktop ? highest(children(desktop)) : null;
  kinds.push({
    id: 'claude-desktop-cli',
    why: 'old Code tab CLIs of the Claude desktop app: it runs the highest, and one still running is kept whole',
    root: desktop,
    items: desktop ? itemsOf(desktop, (name) => VERSION.test(name) && name !== desktopTop) : [],
  });

  const staging = path.join(home, '.codex', '.tmp', 'marketplaces', '.staging');
  kinds.push({
    id: 'codex-staging',
    why: `Codex marketplace upgrades left in staging, untouched for ${SCRATCH_AGE_DAYS} days: an upgrade stages a fresh one`,
    root: staging,
    items: itemsOf(staging, (name, full) => oldEnough(full)),
  });

  kinds.push({
    id: 'temp-scratch',
    why: `test scratch folders (tmp.*, js-harness-*) in the temp folder, untouched for ${SCRATCH_AGE_DAYS} days, holding no worktree`,
    root: tmpdir,
    items: itemsOf(tmpdir, (name, full) => {
      if (!name.startsWith('tmp.') && !name.startsWith('js-harness-')) return false;
      if (!isFolder(full)) return false;
      const tree = measureTree(full);
      return !tree.linkedWorktree && tree.newest < now().getTime() - SCRATCH_AGE_DAYS * DAY_MS;
    }),
  });
  return kinds;
}

/** The package caches, each cleaned only by its own tool: `[id, the folder query, the clean command, why, upTo]`. */
const CACHES = [
  ['npm-cache', ['npm', 'config', 'get', 'cache'], ['npm', 'cache', 'clean', '--force'], 'the npm cache: npm downloads again what an install needs', false],
  ['pnpm-store', ['pnpm', 'store', 'path'], ['pnpm', 'store', 'prune'], 'the pnpm store: prune removes only the packages no project uses', true],
  ['go-modcache', ['go', 'env', 'GOMODCACHE'], ['go', 'clean', '-modcache'], 'the Go module cache: go downloads again what a build needs', false],
  ['uv-cache', ['uv', 'cache', 'dir'], ['uv', 'cache', 'clean'], 'the uv cache: uv downloads again what an install needs', false],
];

/** The folder a cache tool names, or `null` when the tool does not answer. npm 12 answers `undefined` for its cache
 * key, so a running npm that names no absolute folder has its default one. */
function cacheFolder(id, query, { home, platform, run }) {
  const named = answer(run, query[0], query.slice(1));
  if (named === null) return null;
  if (path.isAbsolute(named)) return named;
  if (id !== 'npm-cache') return null;
  return platform === 'win32' ? path.join(home, 'AppData', 'Local', 'npm-cache') : path.join(home, '.npm');
}

/** Each package cache whose tool answers: `{ id, why, command, upTo, items: [the folder] }`. */
function cacheKinds(deps) {
  const kinds = [];
  for (const [id, query, command, why, upTo] of CACHES) {
    const folder = cacheFolder(id, query, deps);
    if (!folder || !fs.existsSync(folder)) continue;
    kinds.push({ id, why, command, upTo, items: [{ path: folder, bytes: measureTree(folder).bytes }] });
  }
  return kinds;
}

/** Every known kind with something in it, in KIND_IDS order, each `{ id, why, items, bytes }` plus `root` (a folder
 * kind) or `command` and `upTo` (a cache kind). Read-only: it writes nothing. */
export function scan({ home, tmpdir = os.tmpdir(), platform = process.platform, now = () => new Date(), run = (command, args) => defaultRun(command, args, { platform, cwd: home }) } = {}) {
  const deps = { home, tmpdir, platform, now, run };
  return [...folderKinds(deps), ...cacheKinds(deps)]
    .map((kind) => ({ ...kind, bytes: kind.items.reduce((sum, item) => sum + item.bytes, 0) }))
    .filter((kind) => kind.items.length > 0 && kind.bytes > 0);
}

/** The paths no deletion may reach, each with what it is: the transcripts, engram's store, the harness's home, the
 * current Codex runtime and the running Claude. */
function guardOf({ home, platform = process.platform, run = (command, args) => defaultRun(command, args, { platform, cwd: home }) }) {
  const paths = [
    [path.join(home, '.claude', 'projects'), 'the Claude Code transcripts'],
    [path.join(home, '.engram'), "engram's store"],
    [path.join(home, '.js-harness'), "the harness's home"],
    [path.join(home, '.local', 'bin', 'claude'), 'the running Claude'],
    [path.join(home, '.local', 'bin', 'claude.exe'), 'the running Claude'],
  ];
  const current = currentCodex(home);
  if (current) paths.push([current, 'the current Codex runtime']);
  const running = runningClaude(run);
  if (running) paths.push([path.join(home, '.local', 'share', 'claude', 'versions', running), 'the running Claude']);
  const desktop = desktopCli({ home, platform });
  const desktopTop = desktop ? highest(children(desktop)) : null;
  if (desktopTop) paths.push([path.join(desktop, desktopTop), 'the running Claude']);
  return paths;
}

/** True when `child` is `parent` or under it. */
function within(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** True when `target` or a folder above it holds `.git`. */
function insideWorktree(target) {
  for (let folder = target; ; folder = path.dirname(folder)) {
    if (fs.existsSync(path.join(folder, '.git'))) return true;
    if (path.dirname(folder) === folder) return false;
  }
}

/** Why `resolved` is protected, or `null`: it is or holds a guarded path, or it is inside a git worktree. */
function protectedReason(resolved, guard) {
  for (const [kept, what] of guard) {
    if (within(resolved, kept) || within(kept, resolved)) return `it is or holds ${what}`;
  }
  if (insideWorktree(resolved)) return 'it is inside a git worktree';
  return null;
}

/** Why `target` may not be deleted, or `null` when it may: it must sit right in its kind's folder `root`, hold and be
 * none of the guarded paths, and not be inside a git worktree. `guard` is computed when not given. */
export function refusal(target, { root, guard, ...deps }) {
  const resolved = path.resolve(target);
  if (!root || path.relative(path.resolve(root), path.dirname(resolved)) !== '') return 'not on the known list of leftovers';
  return protectedReason(resolved, guard ?? guardOf(deps));
}

/** The first line every CACHEDIR.TAG starts with (https://bford.info/cachedir/). */
const CACHEDIR_SIGNATURE = 'Signature: 8a477f597d28d172789f06886806bc55';

/** True when `folder` carries a CACHEDIR.TAG with its signature: the tool that owns it marks it regenerable. */
function taggedCache(folder) {
  try {
    return fs.readFileSync(path.join(folder, 'CACHEDIR.TAG'), 'utf8').startsWith(CACHEDIR_SIGNATURE);
  } catch {
    return false;
  }
}

/** Why the cache folder `target` may not be handed to its tool's clean command, or `null` when it may: the tool
 * deletes the whole folder, so it must hold and be none of the guarded paths, sit in no git worktree, and hold no
 * git repository unless a CACHEDIR.TAG marks it a cache (uv keeps a .git of its own in its tagged cache). */
function cacheRefusal(target, guard) {
  const resolved = path.resolve(target);
  const reason = protectedReason(resolved, guard);
  if (reason) return reason;
  if (measureTree(resolved).linkedWorktree && !taggedCache(resolved)) return 'it holds a git repository and no CACHEDIR.TAG marks it a cache';
  return null;
}

export const logPath = (home) => path.join(home, '.js-harness', 'clean-log.jsonl');
const measurePath = (home) => path.join(home, '.js-harness', 'clean.json');

/** Appends one entry to the deletion record. */
function appendLog(home, entry) {
  fs.mkdirSync(path.dirname(logPath(home)), { recursive: true });
  fs.appendFileSync(logPath(home), `${JSON.stringify(entry)}\n`);
}

/** Every entry of the deletion record, oldest first; a line that does not parse is skipped. */
export function readLog(home) {
  let text = '';
  try {
    text = fs.readFileSync(logPath(home), 'utf8');
  } catch {
    return [];
  }
  return text.split('\n').filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

/** Removes one folder item: renamed first, so a folder with a file in use (a running binary on Windows) fails whole. */
function removeItem(item, rename) {
  const moved = path.join(path.dirname(item.path), `${LEFTOVER_PREFIX}${process.pid}-${Date.now()}-${path.basename(item.path)}`);
  const from = path.basename(item.path).startsWith(LEFTOVER_PREFIX) ? item.path : (rename(item.path, moved), moved);
  fs.rmSync(from, { recursive: true, force: true, maxRetries: 2 });
}

/** Deletes every item of `kinds`, which the user confirmed, and records each outcome: `deleted`, `failed` (with the
 * error) or `refused` (with the reason). A cache kind runs its tool's command and records what it freed. Returns the
 * entries recorded, each with `after`, the bytes a cache kind still holds. */
export function applyKinds(kinds, deps) {
  const { home, now = () => new Date(), platform = process.platform, rename = fs.renameSync } = deps;
  const run = deps.run ?? ((command, args) => defaultRun(command, args, { platform, timeout: CLEAN_TIMEOUT_MS, cwd: home }));
  const guard = guardOf({ ...deps, run });
  const results = [];
  const record = (entry) => {
    const full = { at: now().toISOString(), ...entry };
    appendLog(home, full);
    results.push(full);
  };
  for (const kind of kinds) {
    if (kind.command) {
      const [folder] = kind.items;
      const reason = cacheRefusal(folder.path, guard);
      if (reason) {
        record({ kind: kind.id, path: folder.path, bytes: 0, result: 'refused', error: reason });
        continue;
      }
      const result = run(kind.command[0], kind.command.slice(1));
      const after = measureTree(folder.path).bytes;
      const ok = result && !result.error && result.status === 0;
      const error = ok ? undefined : String(result?.error?.message || result?.stderr || `exit ${result?.status}`).trim() || `exit ${result?.status}`;
      record({ kind: kind.id, path: kind.command.join(' '), bytes: Math.max(0, folder.bytes - after), result: ok ? 'deleted' : 'failed', ...(error ? { error } : {}), after });
      continue;
    }
    for (const item of kind.items) {
      const reason = refusal(item.path, { ...deps, root: kind.root, guard });
      if (reason) {
        record({ kind: kind.id, path: item.path, bytes: 0, result: 'refused', error: reason });
        continue;
      }
      try {
        removeItem(item, rename);
        record({ kind: kind.id, path: item.path, bytes: item.bytes, result: 'deleted' });
      } catch (error) {
        record({ kind: kind.id, path: item.path, bytes: 0, result: 'failed', error: `${error.code ?? ''} ${error.message}`.trim() });
      }
    }
  }
  return results;
}

/** `kinds` with what `results` deleted taken out, for the measure written after a clean. */
export function remainingAfter(kinds, results) {
  const gone = new Set(results.filter((entry) => entry.result === 'deleted').map((entry) => entry.path));
  return kinds
    .map((kind) => {
      if (kind.command) {
        const done = results.find((entry) => entry.kind === kind.id && entry.result === 'deleted');
        return done ? { ...kind, bytes: done.after } : kind;
      }
      const items = kind.items.filter((item) => !gone.has(item.path));
      return { ...kind, items, bytes: items.reduce((sum, item) => sum + item.bytes, 0) };
    })
    .filter((kind) => kind.bytes > 0);
}

/** The measure record of `kinds`: when, the total, what the pnpm prune may free on top (`upTo`), and each kind. */
function measureOf(kinds, at) {
  const sum = (list) => list.reduce((total, kind) => total + kind.bytes, 0);
  return {
    measuredAt: at.toISOString(),
    total: sum(kinds.filter((kind) => !kind.upTo)),
    upTo: sum(kinds.filter((kind) => kind.upTo)),
    kinds: kinds.map((kind) => ({ id: kind.id, bytes: kind.bytes, items: kind.items.length, ...(kind.upTo ? { upTo: true } : {}) })),
  };
}

/** Writes the measure of `kinds` under the harness home; with `onlyIfHome`, only while that home is still there (a
 * measure in the background never makes one). Best-effort: a measure that cannot be written is no failure. */
export function writeMeasure(home, kinds, at, { onlyIfHome = false } = {}) {
  try {
    if (onlyIfHome && !fs.existsSync(path.dirname(measurePath(home)))) return;
    fs.mkdirSync(path.dirname(measurePath(home)), { recursive: true });
    fs.writeFileSync(measurePath(home), JSON.stringify(measureOf(kinds, at), null, 2));
  } catch {
    // Best-effort: see above.
  }
}

/** The measure record, or `null` when there is none or it does not parse. */
export function readMeasure(home) {
  try {
    const data = JSON.parse(fs.readFileSync(measurePath(home), 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** True when a measure should start: none was made or the last is CLEAN_EVERY_DAYS old, and none started within the
 * hour. */
export function measureDue(measure, now = () => new Date()) {
  const at = now().getTime();
  const started = Date.parse(measure?.startedAt ?? '');
  if (Number.isFinite(started) && at - started < STARTED_FRESH_MS) return false;
  const measured = Date.parse(measure?.measuredAt ?? '');
  return !Number.isFinite(measured) || at - measured >= CLEAN_EVERY_DAYS * DAY_MS;
}

/** A size in words: `3.0 GB`, `512.0 MB`, `900 B`. */
export function formatBytes(bytes) {
  const units = ['KB', 'MB', 'GB', 'TB'];
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = -1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Starts `js-harness clean --measure --home <home>` detached, so the session-start hook does not wait for it. */
export function startMeasure(home) {
  const bin = fileURLToPath(new URL('../js-harness.mjs', import.meta.url));
  const child = spawnAsync(process.execPath, [bin, 'clean', '--measure', '--home', home], { detached: true, stdio: 'ignore', windowsHide: true, cwd: os.tmpdir() });
  child.on('error', () => {});
  child.unref();
}

/** The measure starter doctor gives its row: `startMeasure` for the machine's own home, or `null`. A home named with
 * `--home` or `JS_HARNESS_HOME` is a fixture or a practice home, and the measure walks the machine's temp folder and runs
 * its tools; `JS_HARNESS_CLEAN_MEASURE=off` turns it off for anyone who wants no measure in the background. */
export function backgroundMeasure(env = process.env, argv = []) {
  if (env.JS_HARNESS_CLEAN_MEASURE === 'off' || homeIsSet(env) || argv.includes('--home')) return null;
  return startMeasure;
}

/** The `clean` row of doctor: `stale` when the last measure's total is CLEAN_THRESHOLD_BYTES or more, its fix the
 * recommendation; `ok` below it; `unknown` with no measure yet. When a measure is due and `start` is given, it records
 * the start and calls `start(home)`; nothing here deletes. */
export function cleanRow({ home, now = () => new Date(), start = null }) {
  const row = { id: 'clean', version: null, installed: 'n/a', claude: 'unknown', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} };
  const measure = readMeasure(home);
  if (start && measureDue(measure, now)) {
    try {
      fs.mkdirSync(path.dirname(measurePath(home)), { recursive: true });
      fs.writeFileSync(measurePath(home), JSON.stringify({ ...measure, startedAt: now().toISOString() }, null, 2));
      start(home);
    } catch {
      // Fail open: a measure that cannot start is tried again at a later session start.
    }
  }
  if (!Number.isFinite(Date.parse(measure?.measuredAt ?? '')) || typeof measure.total !== 'number') return row;
  if (measure.total < CLEAN_THRESHOLD_BYTES) return { ...row, claude: 'ok' };
  const kinds = Array.isArray(measure.kinds) ? measure.kinds.filter((kind) => kind && typeof kind.id === 'string' && typeof kind.bytes === 'number') : [];
  const lines = kinds.map((kind) => `${kind.id}: ${kind.upTo ? 'up to ' : ''}${formatBytes(kind.bytes)}`);
  const head = `${formatBytes(measure.total)} of regenerable leftovers (measured ${measure.measuredAt.slice(0, 10)}): js-harness clean lists them, js-harness clean --apply deletes only the kinds you confirm`;
  return { ...row, claude: 'stale', leftovers: measure.total, fix: { claude: [head, ...lines] } };
}

/** The words of the hook's notice for a `clean` row that is a gap, or `null`. */
export function cleanNotice(row) {
  return row?.claude === 'stale' && typeof row.leftovers === 'number' ? `${formatBytes(row.leftovers)} of leftovers to clean: js-harness clean` : null;
}
