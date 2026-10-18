// `js-harness merge-queue --land --refresh-copy` (T4, S5b of odd/tasks/harness-review.md): after a land that moved
// main, the installed copy the hooks run is brought up to main. It replaces the lead's three hand scripts in
// ~/.js-harness/lead/: update-copy.sh (settings backup, `pnpm add -g` by sha in three tries, verification, `js-harness
// install`, doctor), prune-pnpm.sh (stale pnpm state) and run-gated.mjs (the gate lock, taken as `js-harness gate` takes
// it). The install and its verdict are the upgrade path's own (`installCopy` in bin/update.mjs, T2). Every effect goes
// through an injected spawn, clock, sleep, lock and file system, so a test installs nothing.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { takeGateTurn } from '../check.mjs';
import { GATE_NOT_RUN } from '../gate.mjs';
import { installCopy, pnpmBinDir, pnpmRunning } from '../update.mjs';

/** The exit of a refresh that ran and could not verify the copy, or could not finish after it (a `js-harness install`
 * that exits non-zero, or a shim the prune finds broken). The land's own exit stands in the printed record. */
export const REFRESH_FAILED = 6;
/** The settings backups kept: the newest this many, the older ones removed by the run that writes a newer one. */
export const KEEP_SETTINGS_BACKUPS = 5;
/** Tries of the install, each verified; a pause before each try after the first, as update-copy.sh waited 20 seconds. */
const TRIES = 3;
const TRY_PAUSE_MS = 20_000;
/** The minutes the gate lock is waited for, as the lead's `js-harness gate --wait 60` waited. */
const WAIT_MINUTES = 60;
/** A pnpm folder younger than this may be an install still running (prune-pnpm.sh). */
const YOUNG_MS = 10 * 60_000;
const SHA = /^[0-9a-f]{40}$/;
/** pnpm's temporary install folders in its global store: `<hex>-<16 hex>-<digits>`. */
const INSTALL_FOLDER = /^[0-9a-f]+-[0-9a-f]{16}-[0-9]+$/;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The pnpm global folder (`global/v11/<name>`) the js-harness shim in `binDir` runs, as update-copy.sh read it: the
 * path of its package.json, or null when the shim names none. The sh shim and the .cmd name it with forward slashes
 * or backslashes; the sh shim is the one read. */
function shimManifest(binDir, fsys) {
  let shim;
  try {
    shim = fsys.readFileSync(path.join(binDir, 'js-harness'), 'utf8');
  } catch {
    return null;
  }
  const named = /global\/v11\/([^/"\s]+)/.exec(shim);
  return named ? path.join(path.dirname(binDir), 'global', 'v11', named[1], 'package.json') : null;
}

/** The sha the copy's manifest names (`js-harness#<sha>`), or null when the shim names none. */
function namedSha(binDir, fsys) {
  const manifest = shimManifest(binDir, fsys);
  if (manifest === null) return null;
  let text;
  try {
    text = fsys.readFileSync(manifest, 'utf8');
  } catch {
    return null;
  }
  return /js-harness#([0-9a-f]{40})/.exec(text)?.[1] ?? null;
}

/** Removes what failed pnpm installs leave behind, and only that (prune-pnpm.sh, read by its rules): the install
 * folders of pnpm's global store (`global/v11`) that no link there and no file of the bin folder names, and that are
 * not young; the `.pnpm-bin-backup-*` folders of the bin folder that are not young; then the shims whose target is
 * missing (`broken`, by name). Nothing is removed while a pnpm process runs or the process list cannot be read
 * (`isPnpmRunning` is not false): then `{ skipped }`. */
export function pruneStalePnpm({ binDir, now = Date.now, isPnpmRunning, fsys = fs }) {
  if (isPnpmRunning() !== false) return { skipped: 'a pnpm process runs, or the process list cannot be read: nothing was removed' };
  const home = path.dirname(binDir);
  const store = path.join(home, 'global', 'v11');
  const names = (dir) => {
    try {
      return fsys.readdirSync(dir);
    } catch {
      return [];
    }
  };
  const young = (entry) => now() - fsys.lstatSync(entry).mtimeMs < YOUNG_MS;
  const gone = (entry) => {
    try {
      fsys.rmSync(entry, { recursive: true, force: true });
    } catch {
      // Left in place, and counted as kept below.
    }
    return !fsys.existsSync(entry);
  };
  // In use: the store folder every link there resolves to, and every store folder a file of the bin folder names.
  const used = new Set();
  for (const name of names(store)) {
    const entry = path.join(store, name);
    if (!fsys.lstatSync(entry).isSymbolicLink()) continue;
    try {
      used.add(path.basename(fsys.realpathSync(entry)));
    } catch {
      // A link whose target is gone names no folder in use; it is left as it is.
    }
  }
  for (const name of names(binDir)) {
    let text;
    try {
      text = fsys.readFileSync(path.join(binDir, name), 'utf8');
    } catch {
      continue;
    }
    for (const match of text.matchAll(/v11[\\/]([^\\/"\s]+)/g)) used.add(match[1]);
  }
  let removed = 0;
  let kept = 0;
  for (const name of names(store)) {
    const entry = path.join(store, name);
    const stat = fsys.lstatSync(entry);
    if (stat.isSymbolicLink() || !stat.isDirectory() || !INSTALL_FOLDER.test(name)) continue;
    if (used.has(name) || young(entry) || !gone(entry)) {
      kept += 1;
      continue;
    }
    removed += 1;
  }
  let backups = 0;
  for (const name of names(binDir)) {
    const entry = path.join(binDir, name);
    if (!name.startsWith('.pnpm-bin-backup-') || young(entry)) continue;
    if (gone(entry)) backups += 1;
  }
  // Every shim must still reach its target after the pass.
  const broken = [];
  for (const name of names(binDir)) {
    if (!name.endsWith('.cmd')) continue;
    let text;
    try {
      text = fsys.readFileSync(path.join(binDir, name), 'utf8');
    } catch {
      continue;
    }
    const target = /global\\v11\\[^"]+/.exec(text)?.[0];
    if (target && !fsys.existsSync(path.join(home, target.replace(/\\/g, '/')))) broken.push(path.basename(name, '.cmd'));
  }
  return { removed, backups, kept, broken };
}

/** Copies the Claude settings to `dir` as `settings-<stamp>.json`, then keeps the newest `KEEP_SETTINGS_BACKUPS` of those
 * names there. `null` when there is no settings file. */
function backupSettings({ settings, dir, stamp, fsys }) {
  let text;
  try {
    text = fsys.readFileSync(settings);
  } catch {
    return null;
  }
  fsys.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `settings-${stamp}.json`);
  fsys.writeFileSync(file, text);
  const backups = fsys.readdirSync(dir).filter((name) => /^settings-.*\.json$/.test(name)).sort().reverse();
  let pruned = 0;
  for (const name of backups.slice(KEEP_SETTINGS_BACKUPS)) {
    fsys.rmSync(path.join(dir, name), { force: true });
    pruned += 1;
  }
  return { file, dir, hash: hashOf(text), kept: Math.min(backups.length, KEEP_SETTINGS_BACKUPS), pruned };
}

const hashOf = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);

/** The short hash of the Claude settings as they are now, or null when there is no settings file. */
function settingsHash(settings, fsys) {
  try {
    return hashOf(fsys.readFileSync(settings));
  } catch {
    return null;
  }
}

/** The file-name stamp of a backup: `20261018T023500Z` for 2026-10-18 02:35 UTC. */
const stampOf = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

/** `merge-queue --land --refresh-copy`'s refresh. `landed` says whether this land moved main: when it did not, nothing is
 * refreshed and that is said. Otherwise, under the machine's gate lock: the Claude settings are backed up, main's `sha`
 * is installed with `pnpm add -g` in up to three tries, and the copy is verified by its `--version` (which must be
 * `version`, the one main's package.json names) and by the sha its shim names. Then `js-harness install` and
 * `js-harness doctor` run, and the stale pnpm state is pruned. The undo is printed. Returns 0, REFRESH_FAILED when the
 * copy is not verified or a step fails, or GATE_NOT_RUN when the gate lock was not obtained (nothing ran). */
export async function refreshCopy({
  landed,
  sha,
  version,
  home = process.env.JS_HARNESS_HOME || os.homedir(),
  settings = path.join(os.homedir(), '.claude', 'settings.json'),
  cwd = process.cwd(),
  env = process.env,
  platform = process.platform,
  spawn = spawnSync,
  fsys = fs,
  now = Date.now,
  sleep = defaultSleep,
  takeGateLock,
  session = null,
  stdout = console.log,
  stderr = console.error,
}) {
  if (!landed) {
    stdout('Nothing landed: the installed copy was not refreshed.');
    return 0;
  }
  const fail = (line) => {
    stderr(`refresh failed: ${line}`);
    return REFRESH_FAILED;
  };
  if (!SHA.test(sha ?? '')) return fail(`main's sha is not a full commit sha: ${sha}`);
  if (!version) return fail(`could not read the version main's package.json names at ${sha.slice(0, 7)}`);

  // The lock is taken as `js-harness gate` takes it, in its turn: the heavy part below runs under it, and a refusal or
  // a lock that cannot be taken runs nothing.
  const turn = await takeGateTurn({ name: 'merge-queue', home, cwd, command: 'merge-queue --land --refresh-copy', wait: true, waitMinutes: WAIT_MINUTES, session }, takeGateLock);
  if (turn.refused || turn.without) {
    stderr(`refresh: the gate lock was not obtained (${turn.refused ?? turn.without}): nothing was refreshed, and the installed copy still names its previous main`);
    return GATE_NOT_RUN;
  }
  const { lock } = turn;
  try {
    return await refreshHoldingLock({ sha, version, home, settings, env, platform, spawn, fsys, now, sleep, stdout, stderr, fail });
  } finally {
    const lost = lock.lost();
    lock.release();
    if (lost) stderr("refresh: the machine's gate lock was lost while the refresh ran: this process was silent for over a minute and a gate took its lock, so the two may have run at once");
  }
}

async function refreshHoldingLock({ sha, version, home, settings, env, platform, spawn, fsys, now, sleep, stdout, stderr, fail }) {
  const words = ['pnpm'];
  const binDir = pnpmBinDir(spawn, words, undefined, platform);
  if (!binDir) return fail("pnpm's global bin folder is not known: `pnpm bin -g` gave none");
  const previous = namedSha(binDir, fsys);
  const backupDir = path.join(home, '.js-harness', 'refresh-backups');
  const backup = backupSettings({ settings, dir: backupDir, stamp: stampOf(now()), fsys });
  // The undo is printed whatever the end, once the settings are backed up and the previous copy is known.
  const undo = () => stdout(`undo: js-harness uninstall --global, then pnpm add -g github:jsaristi/js-harness#${previous ?? '<the previous sha, not recorded>'}, then js-harness install; the settings before are in ${backup?.file ?? 'no copy (there was no settings file)'}`);
  if (backup) {
    stdout(`settings before: ${backup.hash} (copy ${backup.file})`);
    stdout(`settings backups: kept the newest ${backup.kept} settings backups in ${backup.dir}, removed ${backup.pruned} older`);
  } else {
    stdout('settings before: no settings file to back up');
  }
  stdout(`refresh: installing main ${sha.slice(0, 7)} (version ${version}); the copy named ${previous ? previous.slice(0, 7) : 'no sha'} before`);

  let copy;
  for (let attempt = 1; attempt <= TRIES; attempt += 1) {
    copy = installCopy({ words, spec: `github:jsaristi/js-harness#${sha}`, version, env, spawn, platform, label: 'refresh', say: stdout });
    if (copy.ok && namedSha(binDir, fsys) === sha) break;
    if (attempt < TRIES) await sleep(TRY_PAUSE_MS);
  }
  if (!copy.ok && copy.packageManager) for (const line of copy.lines) stderr(line);
  const answered = copy.answered ?? '';
  const shimmed = namedSha(binDir, fsys);
  if (answered !== version || shimmed !== sha) {
    if (answered !== version) stderr(`refresh failed: the installed copy answers ${answered || 'nothing'}, not ${version}`);
    if (shimmed !== sha) stderr(`refresh failed: the installed copy does not name ${sha} (its shim names ${shimmed ?? 'no sha'})`);
    undo();
    return REFRESH_FAILED;
  }
  stdout(`refresh: the installed copy answers ${version} and names ${sha}`);

  const installed = spawn('js-harness', ['install'], { shell: true, encoding: 'utf8' });
  stdout(`js-harness install exit ${installed.status}`);
  stdout(`settings after: ${settingsHash(settings, fsys) ?? 'no settings file'}`);
  const doctor = spawn('js-harness', ['doctor'], { shell: true, encoding: 'utf8' });
  stdout(`js-harness doctor exit ${doctor.status}`);

  const pruned = pruneStalePnpm({ binDir, now, isPnpmRunning: () => pnpmRunning(spawn, platform), fsys });
  let code = 0;
  if (pruned.skipped) {
    stdout(`prune: ${pruned.skipped}`);
  } else {
    stdout(`prune: removed ${pruned.removed} unused install folders and ${pruned.backups} bin backups; kept ${pruned.kept} in use or young`);
    for (const shim of pruned.broken) stderr(`PRUNE BROKE ${shim}: its target is missing`);
    if (pruned.broken.length) code = fail('a shim does not reach its target after the prune');
  }
  if (installed.status !== 0) code = fail(`js-harness install exited ${installed.status}`);
  if (doctor.status !== 0) code = fail(`js-harness doctor exited ${doctor.status}`);
  undo();
  return code;
}
