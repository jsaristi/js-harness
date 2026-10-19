#!/usr/bin/env node
// `status`, `update`, `upgrade`: version detection and upgrade. The package manager is injectable
// because on this machine `npm` on PATH is a pnpm shim; it installs a release and is never asked which
// release is the latest: the repository's tags say that (see `resolveLatest`). `status` also answers by location (T5 design); see
// `statusMain` for which folders report the project, the machine install, or refuse.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyPackageManager, quoteForShell, runPm } from './lib/package-manager.mjs';
import { currentVersion } from './install.mjs';
import { installedVersion } from './lib/manifest.mjs';
import { projectLocation, staleManifestMessage, invalidHarnessJsonMessage, howToPinClause } from './lib/project.mjs';
import { DEFAULT_REPO, INSTALL_NEWEST, latestFromSource, latestTag, tagSpec, splitCommand, pmKind, installPlan, isNewer } from './lib/version.mjs';
import { unknownArgument } from './lib/args.mjs';

const PKG_NAME = 'js-harness';
const UPGRADE_USAGE = 'Usage: js-harness upgrade [--home <path>] [--repo <url or folder>] [--source <dir>] [--pm <command>] [--prefix <dir>]';

function parseArgs(argv, env) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  return {
    home: get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir(),
    source: get('--source') ?? env.JS_HARNESS_SOURCE,
    repo: get('--repo') ?? env.JS_HARNESS_REPO ?? DEFAULT_REPO,
    prefix: get('--prefix') ?? env.JS_HARNESS_PREFIX,
    pm: get('--pm'),
  };
}


/** The package manager of an upgrade: `--pm`, else `JS_HARNESS_PM`, else the one that installed the copy running now,
 * read from where it lies: the TUI's Upgrade passes no `--pm`, and npm over a copy pnpm installed fails (release-095 S3). */
function resolvePm(pm, env, copyPath = fileURLToPath(import.meta.url)) {
  return pm ?? env.JS_HARNESS_PM ?? copyPackageManager(copyPath);
}

/** What the commands say where the repository holds no release tag (the first is v0.9.0, docs/ROADMAP.md, "Versioning"),
 * and how a machine gets the newest copy then. */
export const NO_RELEASE = `no release of js-harness is tagged yet; to get the newest copy: ${INSTALL_NEWEST}`;

/** How long `git ls-remote` may take to list the tags before the lookup gives up. */
const TAG_LOOKUP_MS = 30_000;

class TagLookupError extends Error {}

/** The newest release: in `source`, a folder of `npm pack` tarballs the caller named with `--source` or
 * `JS_HARNESS_SOURCE`, as `{ version, file }`; else the newest `vX.Y.Z` tag of `repo` (the public
 * repository unless `--repo` or `JS_HARNESS_REPO` names another), as `{ version, spec }`, read with the machine's git and its
 * own credentials. `null` when the folder or the repository holds no release. The public registry is never asked
 * about the name `js-harness`, which nobody holds there, so whoever registered it would decide what `upgrade`
 * installs and runs. A source folder that cannot be read throws, as `fs.readdirSync` does; tags that cannot be
 * listed throw a `TagLookupError` with git's reason. */
export function resolveLatest({ source, repo = DEFAULT_REPO }) {
  if (source) return latestFromSource(source);
  const listed = spawnSync('git', ['ls-remote', '--tags', '--refs', repo], {
    encoding: 'utf8',
    timeout: TAG_LOOKUP_MS,
    // A missing credential fails at once instead of waiting for a prompt nobody answers.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (listed.status !== 0) {
    const reason = listed.error?.code ?? String(listed.stderr ?? '').trim().split(/\r?\n/).at(-1) ?? '';
    throw new TagLookupError(reason || `git exited ${listed.status}`);
  }
  const best = latestTag(listed.stdout);
  return best ? { version: best.version, spec: tagSpec(repo, best.tag) } : null;
}

/** `resolveLatest` for a command: `{ latest }`, or `{ problem }` with a line to print when the source folder
 * cannot be read or the repository's tags cannot be listed. */
function latestFor(opts) {
  try {
    return { latest: resolveLatest(opts) };
  } catch (err) {
    if (err instanceof TagLookupError) {
      return {
        problem: `cannot list the tags of ${opts.repo}: ${err.message}; git needs to reach the repository, and a ` +
          'credential when it is private, or name a folder of release tarballs with --source',
      };
    }
    return { problem: `cannot read the source folder ${opts.source}: ${err.code ?? err.message}` };
  }
}

/** The upgraded binary's path under `--prefix`: npm's Windows vs POSIX --prefix layout differ. */
function upgradedBinPath(prefix, platform) {
  return platform === 'win32'
    ? path.join(prefix, 'node_modules', PKG_NAME, 'bin', 'js-harness.mjs')
    : path.join(prefix, 'lib', 'node_modules', PKG_NAME, 'bin', 'js-harness.mjs');
}

/** Where pnpm laid out the copy of js-harness under `prefix`, its home: `<prefix>/global/v<n>/<hash>/node_modules/
 * js-harness` on pnpm 12 (L7), or without the hash folder. The copy of `version` when its package says so, else
 * the first found, whose own `--version` then refuses it; `null` when there is none. */
function pnpmCopy(prefix, version) {
  const globalDir = path.join(prefix, 'global');
  const list = (dir) => {
    try {
      return fs.readdirSync(dir);
    } catch {
      return [];
    }
  };
  const copies = [];
  for (const store of list(globalDir)) {
    for (const parent of [path.join(globalDir, store), ...list(path.join(globalDir, store)).map((hash) => path.join(globalDir, store, hash))]) {
      const root = path.join(parent, 'node_modules', PKG_NAME);
      if (fs.existsSync(path.join(root, 'bin', 'js-harness.mjs'))) copies.push(root);
    }
  }
  const versionOf = (root) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    } catch {
      return null;
    }
  };
  const root = copies.find((copy) => versionOf(copy) === version) ?? copies[0];
  return root ? path.join(root, 'bin', 'js-harness.mjs') : null;
}




/** pnpm's lock on its global bin folder: a folder it takes while it links commands, and leaves behind when its
 * cleanup fails (os error 32 on Windows), after which the next install waits five minutes on it and times out
 * (update-copy.sh, 2026-10-15). */
const PNPM_BIN_LOCK = '.pnpm-global-bin.lock';
/** No live install holds the lock this long: pnpm itself gives up waiting on it after five minutes. */
const STALE_LOCK_MS = 10 * 60_000;

/** The global bin folder pnpm uses: the prefix's own, else what `pnpm bin -g` answers; `null` when it does not. */
export function pnpmBinDir(spawn, words, prefix, platform) {
  if (prefix) return path.join(prefix, 'bin');
  const asked = runPm(spawn, words, ['bin', '-g'], undefined, platform);
  const line = String(asked.stdout ?? '').trim().split(/\r?\n/).at(-1) ?? '';
  return asked.status === 0 && path.isAbsolute(line) ? line : null;
}

/** Whether a command line starts a pnpm: `pnpm` or `pnpm.exe` itself, or node running pnpm's script. A word in double
 * quotes, as Windows writes a path that holds a space, is one word. */
function startsPnpm(commandLine) {
  const [first = '', second = ''] = [...commandLine.trim().matchAll(/"([^"]*)"|(\S+)/g)].slice(0, 2).map((m) => m[1] ?? m[2]);
  const base = (word) => word.split(/[\\/]/).at(-1).toLowerCase();
  if (/^pnpm(\.exe|\.cmd)?$/.test(base(first))) return true;
  return /^node(\.exe)?$/.test(base(first)) && /^pnpm(\.c?js)?$/.test(base(second));
}

/** Whether a pnpm other than this process runs on the machine: `true`, `false`, or `null` when the process list could
 * not be read, which a caller takes as running. Windows answers through PowerShell, which shows a pnpm run by node by
 * its command line; elsewhere `ps`. Each line is `<pid> <command line>`. */
export function pnpmRunning(spawn, platform) {
  const listed = platform === 'win32'
    ? spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }'], { encoding: 'utf8', windowsHide: true })
    : spawn('ps', ['-A', '-o', 'pid=,args='], { encoding: 'utf8' });
  if (listed.status !== 0) return null;
  return String(listed.stdout ?? '').split(/\r?\n/).some((line) => {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    return match !== null && Number(match[1]) !== process.pid && startsPnpm(match[2]);
  });
}

/** Removes pnpm's bin lock when no live install can hold it: only while no other pnpm runs (an empty folder does not
 * show its owner is gone, Codex P2 on 839b194..eae1e83), and then one taken since `since` (this run's own install,
 * which has exited) or one older than STALE_LOCK_MS. A lock with anything inside is left (rmdir refuses it). Says
 * what it removed, or `null`. */
function clearPnpmLock(binDir, since, isPnpmRunning) {
  if (!binDir) return null;
  const lock = path.join(binDir, PNPM_BIN_LOCK);
  let taken;
  try {
    taken = fs.statSync(lock).mtimeMs;
  } catch {
    return null;
  }
  // Two seconds of slack: the file system's stamp and this process's clock are read apart.
  const own = since !== undefined && taken >= since - 2000;
  if (!own && Date.now() - taken <= STALE_LOCK_MS) return null;
  if (isPnpmRunning() !== false) return null;
  try {
    fs.rmdirSync(lock);
  } catch {
    return null;
  }
  return `removed pnpm's bin lock ${lock}, ${own ? 'left by this install' : `taken at ${new Date(taken).toISOString()}`}`;
}

const STATUS_USAGE =
  'Usage: js-harness status [--cwd <path>] [--home <path>] [--global] [--repo <url or folder>] [--source <dir>] [--pm <command>] [--prefix <dir>]';

class StatusArgError extends Error {}

/** `status`'s flags are strict, unlike `update`/`upgrade`'s lenient `parseArgs` above (whose behavior stays
 * as it was): an unknown flag or a missing value is a usage error, and `--global` with `--cwd` is one too,
 * the same rule `sync` and `uninstall` follow (`--cwd` only means anything for the project scope). */
function parseStatusArgs(argv, env) {
  const values = {};
  let global = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--global') {
      global = true;
    } else if (['--cwd', '--home', '--repo', '--source', '--prefix', '--pm'].includes(token)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new StatusArgError(`${token} requires a value`);
      values[token] = value;
      i++;
    } else {
      throw new StatusArgError(`unknown flag: ${token}`);
    }
  }
  if (global && values['--cwd'] !== undefined) throw new StatusArgError('--global cannot be combined with --cwd');
  return {
    cwd: values['--cwd'] ?? process.cwd(),
    cwdExplicit: values['--cwd'] !== undefined,
    global,
    home: values['--home'] ?? env.JS_HARNESS_HOME ?? os.homedir(),
    source: values['--source'] ?? env.JS_HARNESS_SOURCE,
    repo: values['--repo'] ?? env.JS_HARNESS_REPO ?? DEFAULT_REPO,
    prefix: values['--prefix'] ?? env.JS_HARNESS_PREFIX,
    pm: values['--pm'],
  };
}

/** The project half of `status`: what `init` pinned, what is running, and whether this clone is set up.
 * A pin that differs from the running version is reported, not failed: `status` reads, `sync` names the
 * ways out (T4 design). A project with no pin (`noPin`, install-update T6) is reported too: there is no
 * version to compare, `sync` sets nothing up until one is pinned, and the last line says how to pin. */
function reportProjectStatus(location, version) {
  const pinned = location.kind !== 'noPin';
  console.log(`project: ${path.normalize(location.root)}`);
  console.log(`pinned version: ${pinned ? location.pin : 'none'}`);
  console.log(`running version: ${version}`);
  const syncSetsUp = pinned ? 'js-harness sync sets it up' : 'js-harness sync sets it up once a version is pinned';
  const manifestAt = `(manifest: ${path.normalize(location.manifestPath)})`;
  // A manifest `functions apply` wrote holds the switches and no gate, so the clone is not set up by it.
  if (!location.manifestPresent) console.log(`this clone: not set up; ${syncSetsUp}`);
  else if (location.functionsOnly) console.log(`this clone: only its switches applied ${manifestAt}; ${syncSetsUp}`);
  else console.log(`this clone: set up ${manifestAt}`);
  if (!pinned) {
    console.log(`to pin this project: ${howToPinClause(version)}`);
    return;
  }
  console.log(
    location.pin === version
      ? 'pin and running version: match'
      : 'pin and running version: differ; js-harness sync names the ways out',
  );
}

/** One quiet line of a project's own rules (odd/tasks/project-rules.md): how many its docs/rules.json holds and how
 * many findings `js-harness rules check` would name, or nothing when it keeps no list. The check itself is the
 * `rules` row of the gate; this line only lets a person see it without committing. The modules are loaded here
 * only, so the machine status loads none of the gate's. */
async function reportOwnRules(root) {
  const { readProjectRules } = await import('./lib/project-rules-read.mjs');
  const { discoverSensors } = await import('./check.mjs');
  const found = discoverSensors(root);
  let read;
  try {
    read = readProjectRules(root, { sensors: found.error ? null : found.sensors.map((sensor) => sensor.name) });
  } catch (err) {
    console.log(`own rules: docs/rules.json cannot be read (${err.message})`);
    return;
  }
  if (!read.present) return;
  if (!read.readable) {
    console.log('own rules: docs/rules.json cannot be read; js-harness rules check names why');
    return;
  }
  const count = read.findings.length;
  console.log(count === 0
    ? `own rules: ${read.rules.length} in docs/rules.json, all holding`
    : `own rules: ${read.rules.length} in docs/rules.json, ${count} ${count === 1 ? 'finding' : 'findings'}; js-harness rules check names ${count === 1 ? 'it' : 'them'}`);
}

/** `status` by location, the "Command scope" rule `sync` and `uninstall` follow: inside a git repository it
 * reports the project (exit 0), or names what is wrong with it (exit 1); outside one with no `--cwd`, or
 * with `--global`, it is the machine status. An explicit `--cwd` names a project, so when it is not an
 * initialized one this exits 1 and names `--global` rather than falling through to the machine. */
export async function statusMain(argv, env = process.env, spawn = spawnSync) {
  let opts;
  try {
    opts = parseStatusArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}

${STATUS_USAGE}`);
    return 2;
  }

  if (!opts.global) {
    // Real `git`, whatever `spawn` is: `spawn` stands in for the package manager, not for git.
    const location = projectLocation(opts.cwd);
    switch (location.kind) {
      case 'initialized':
      case 'noPin':
        reportProjectStatus(location, currentVersion());
        await reportOwnRules(location.root);
        return 0;
      case 'invalidHarnessJson':
        console.error(invalidHarnessJsonMessage(location.harnessJsonPath, location.reason));
        return 1;
      case 'staleManifest':
        console.error(staleManifestMessage(location.manifestPath));
        return 1;
      case 'noSuchDirectory':
        console.error(`no such directory: ${opts.cwd}`);
        return 1;
      case 'notInitialized':
        console.error(notInitializedMessage(opts.cwd));
        return 1;
      default: // notGit: the machine, unless --cwd named a project
        if (opts.cwdExplicit) {
          console.error(notInitializedMessage(opts.cwd));
          return 1;
        }
    }
  }

  return machineStatus(opts, env, spawn);
}

function notInitializedMessage(cwd) {
  return `not an initialized project: ${cwd}; js-harness init sets one up, js-harness status --global shows the machine install`;
}

async function machineStatus(opts, env, spawn) {
  const installed = currentVersion();
  const recorded = installedVersion(opts.home);
  const { latest, problem } = latestFor(opts);

  console.log(`installed package version: ${installed}`);
  console.log(`manifest version: ${recorded ?? '(not installed)'}`);
  if (latest) {
    console.log(`latest available: ${latest.version}`);
    if (isNewer(latest.version, installed)) console.log(`update available: ${latest.version}`);
  } else if (opts.source || problem) {
    // A source that was named and answers nothing is not known, which is not the same as no release; nor is a
    // repository whose tags cannot be listed.
    console.log(`latest available: (unknown${problem ? `: ${problem}` : ''})`);
  } else {
    console.log('latest available: (no release is tagged yet)');
  }
  return 0;
}

export async function updateMain(argv, env = process.env, spawn = spawnSync) {
  const opts = parseArgs(argv, env);
  const installed = currentVersion();
  const { latest, problem } = latestFor(opts);
  if (problem) {
    console.error(problem);
    return 1;
  }

  if (!latest) {
    console.log(opts.source ? 'could not determine the latest version' : `${NO_RELEASE} (installed: ${installed})`);
    return 0;
  }
  if (isNewer(latest.version, installed)) {
    console.log(`update available: ${latest.version} (installed: ${installed})`);
  } else {
    console.log(`up to date: ${installed}`);
  }
  return 0;
}

/** A version as `js-harness --version` prints it. What a program found on the path answered is named in a
 * line only when it is this plain; anything else is never printed (it may hold terminal escapes). */
const PLAIN_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]*)?$/;

/** Why the `js-harness` on the path may not run the sync after an upgrade to `version`, or `null` when it
 * may (T8): it is asked its version through the same shell the sync would run it through, and only the
 * version just installed passes. A copy that fails, is not found or does not know `--version` (one older
 * than this) is not the upgraded one either. Nothing is written by the question. The one way out it names
 * is the sync itself, run with the upgraded copy: a second `upgrade` is no way out, since the install
 * already happened and that run would find nothing newer, say "up to date" and sync nothing. */
function pathCopyRefusal(answered, version) {
  const found = PLAIN_VERSION.test(answered)
    ? `the js-harness on the path is ${answered}, not the upgraded ${version}`
    : `the js-harness on the path did not answer --version, so it is not the upgraded ${version}`;
  return (
    `${found}: ${version} was installed and nothing was synced. ` +
    'Run `js-harness sync --global` with the copy that was just installed, by its own path: ' +
    'the one the shell finds first is another.'
  );
}

/** What the `js-harness` the shell finds first answers to `--version`, asked through the same shell the sync
 * would run it through, or '' when it does not answer. Nothing is written by the question. */
function pathCopyVersion(spawn) {
  const asked = spawn('js-harness', ['--version'], { shell: true, encoding: 'utf8' });
  return asked.status === 0 ? String(asked.stdout ?? '').trim() : '';
}

/** What the copy at `bin`, the one an install under `--prefix` laid out, answers to `--version`, or '' when it does
 * not answer. */
function prefixCopyVersion(spawn, bin) {
  const asked = spawn(process.execPath, [bin, '--version'], { encoding: 'utf8' });
  return asked.status === 0 ? String(asked.stdout ?? '').trim() : '';
}

/** The install of an upgrade (T2 of odd/tasks/harness-review.md), shared with `merge-queue --refresh-copy`
 * (bin/lib/refresh-copy.mjs): `spec` installed with the package manager `words`, and judged by the copy it left, never
 * by the package manager's exit code. pnpm exits 1 when its cleanup hits os error 32 after a good install (L7). With
 * `prefix` the copy is where the package manager laid it out; without one it is whatever `js-harness` the shell
 * resolves on PATH, which also runs the sync, so only the version just installed is let to write (T8). `also` lists
 * words the Windows command line must not carry either. `say` is told of each pnpm bin lock it removes. Returns
 * `{ ok: true, status, bin }`, where `status` is the package manager's exit and `bin` the copy's entry under `prefix`
 * (null without one); else `{ ok: false, status, lines }`: what to say and the exit to give. */
export function installCopy({ words, spec, version, prefix, env, spawn, platform, label, also = [], say = () => {} }) {
  const kind = pmKind(words);
  const plan = installPlan(kind, spec, prefix, env, platform);
  const unsafe = platform === 'win32' ? [...words, ...plan.args, ...also].find((word) => /["%]/.test(word)) : undefined;
  if (unsafe !== undefined) {
    return { ok: false, status: 1, answered: '', packageManager: false, lines: [`${label}: ${unsafe} holds " or %, which cmd.exe would change: nothing was installed`] };
  }
  const binDir = kind === 'pnpm' ? pnpmBinDir(spawn, words, prefix, platform) : null;
  const isPnpmRunning = () => pnpmRunning(spawn, platform);
  const staleLock = clearPnpmLock(binDir, undefined, isPnpmRunning);
  if (staleLock) say(staleLock);
  const started = Date.now();
  const installResult = runPm(spawn, words, plan.args, plan.env === env ? undefined : plan.env, platform);
  const ownLock = clearPnpmLock(binDir, started, isPnpmRunning);
  if (ownLock) say(ownLock);

  // The verdict on the install is the installed copy's own --version, not the package manager's exit code (T2, L7).
  const bin = prefix ? (kind === 'pnpm' ? pnpmCopy(prefix, version) : upgradedBinPath(prefix, platform)) : null;
  const answered = prefix ? (bin ? prefixCopyVersion(spawn, bin) : '') : pathCopyVersion(spawn);
  if (answered === version) return { ok: true, status: installResult.status, bin, answered };
  if (installResult.status !== 0) {
    const how = installResult.error ? `could not be started (${installResult.error.code ?? installResult.error.message})` : `exited ${installResult.status}`;
    // The package manager's output was captured, so its last lines say why.
    const said = String(installResult.stderr ?? '').trim().split(/\r?\n/).slice(-5).join('\n');
    return { ok: false, status: installResult.status ?? 1, answered, packageManager: true, lines: [`${label} failed: ${words[0]} ${how}${said ? `:\n${said}` : ''}`] };
  }
  if (prefix) {
    const said = PLAIN_VERSION.test(answered) ? `answers ${answered}` : 'does not answer --version';
    return { ok: false, status: 1, answered, packageManager: false, lines: [`the copy installed under ${prefix} ${said}, not ${version}: nothing was synced`] };
  }
  return { ok: false, status: 1, answered, packageManager: false, lines: [pathCopyRefusal(answered, version)] };
}

/** Tries of an upgrade's install, and the pause before each try after the first: those of the land's refresh. */
const UPGRADE_TRIES = 3;
const UPGRADE_PAUSE_MS = 20_000;
const PNPM_LOCK_NOTE =
  `with pnpm, a ${PNPM_BIN_LOCK} folder left in its bin folder is removed by the next upgrade once it is ten minutes old, ` +
  'and never while a pnpm runs';
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function upgradeMain(argv, env = process.env, spawn = spawnSync, platform = process.platform, { sleep = defaultSleep, copyPath } = {}) {
  // `upgrade` installs and syncs, so a flag it does not know is refused before anything runs; `update`,
  // which writes nothing, keeps the lenient parse (T1 of odd/tasks/commands-and-doctor.md).
  const unknown = unknownArgument(argv, { valued: ['--home', '--repo', '--source', '--prefix', '--pm'] });
  if (unknown !== null) {
    console.error(`unknown argument: ${unknown}\n\n${UPGRADE_USAGE}`);
    return 2;
  }
  const opts = parseArgs(argv, env);
  const { latest, problem } = latestFor(opts);
  if (problem) {
    console.error(problem);
    return 1;
  }
  if (!latest) {
    console.error(opts.source ? 'could not determine the latest version to upgrade to' : `nothing was installed: ${NO_RELEASE}`);
    return 1;
  }
  // Only a newer release replaces the installed one: the folder may hold the same version, or an older.
  const installed = currentVersion();
  if (!isNewer(latest.version, installed)) {
    console.log(`up to date: ${installed} (the source holds ${latest.version})`);
    return 0;
  }

  // What is installed: the tarball of the folder the caller named, or the repository at its release tag; never a
  // name on a registry. The install and its verdict are `installCopy`'s, which `merge-queue --refresh-copy` shares.
  const words = splitCommand(resolvePm(opts.pm, env, copyPath));
  // A failed install is tried again, as the land's refresh does (bin/lib/refresh-copy.mjs): on Windows pnpm can fail
  // with os error 32 while a file it just wrote is held, and the same install works a little later (harness-review L58).
  let copy;
  for (let attempt = 1; attempt <= UPGRADE_TRIES; attempt += 1) {
    copy = installCopy({
      words,
      spec: latest.file ?? latest.spec,
      version: latest.version,
      prefix: opts.prefix,
      env,
      spawn,
      platform,
      label: 'upgrade',
      also: [opts.home ?? ''],
      say: (line) => console.error(line),
    });
    if (copy.ok || !copy.packageManager || attempt === UPGRADE_TRIES) break;
    console.error(`upgrade: ${words[0]} exited ${copy.status} and the copy is not ${latest.version} yet: trying again in ${UPGRADE_PAUSE_MS / 1000} s (try ${attempt + 1} of ${UPGRADE_TRIES})`);
    await sleep(UPGRADE_PAUSE_MS);
  }
  if (!copy.ok) {
    for (const line of copy.lines) console.error(line);
    if (copy.packageManager) console.error(`nothing was installed after ${UPGRADE_TRIES} tries; ${PNPM_LOCK_NOTE}`);
    return copy.status;
  }
  if (copy.status !== 0) {
    console.error(`${words[0]} exited ${copy.status}, but the copy it installed answers ${latest.version}: going on`);
  }
  const { bin } = copy;

  // Re-run the NEWLY installed binary's own sync, so files on disk match the new release rather than whatever
  // this (old) process would have written. `--global` (T4): upgrade runs from any folder, and inside a git
  // repository a plain `sync` would act on that project (or refuse for it) instead of the machine install this is
  // meant to bring up to date.
  const syncResult = opts.prefix
    ? spawn(process.execPath, [bin, 'sync', '--home', opts.home, '--global'], {
        encoding: 'utf8',
      })
    : spawn('js-harness', ['sync', '--home', quoteForShell(opts.home, platform), '--global'], {
        shell: true,
        encoding: 'utf8',
      });

  if (syncResult.status !== 0) {
    console.error(`sync after upgrade failed: exited ${syncResult.status}`);
    return syncResult.status ?? 1;
  }

  // Verify the sync we just ran actually belonged to the upgraded version: a stale `js-harness`
  // still on PATH (or a --prefix bin that never landed) would silently sync the wrong release.
  const recorded = installedVersion(opts.home);
  if (recorded !== latest.version) {
    console.error(
      `sync ran, but the manifest under ${opts.home} reports ` +
        `${recorded ?? '(not installed)'}, not ${latest.version}: the js-harness ` +
        'found is not the upgraded one — run `js-harness sync --global` with the upgraded binary',
    );
    return 1;
  }

  console.log(`upgraded to ${latest.version}`);
  return 0;
}
