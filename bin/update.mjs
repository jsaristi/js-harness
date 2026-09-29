#!/usr/bin/env node
// `status`, `update`, `upgrade`: version detection and upgrade. The package manager and the
// release source are both injectable because on this machine `npm` on PATH is a pnpm shim. `status`
// also answers by location (T5 design); see `statusMain` for which folders report the project, the
// machine install, or refuse.
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { currentVersion } from './install.mjs';
import { readManifest } from './lib/manifest.mjs';
import { projectLocation, staleManifestMessage, invalidHarnessJsonMessage } from './lib/project.mjs';
import { latestFromSource, splitCommand, viewArgs, installArgs, isNewer } from './lib/version.mjs';

const PKG_NAME = 'js-harness';

function parseArgs(argv, env) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  return {
    home: get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir(),
    source: get('--source') ?? env.JS_HARNESS_SOURCE,
    prefix: get('--prefix') ?? env.JS_HARNESS_PREFIX,
    pm: get('--pm'),
  };
}

function resolvePm(pm, env) {
  return pm ?? env.JS_HARNESS_PM ?? 'npm';
}

/** Looks up the latest available version: a local tarball dir with `--source`, else the registry. */
export function resolveLatest({ source, pm }, env, spawn = spawnSync) {
  if (source) return latestFromSource(source);

  const [cmd, ...head] = splitCommand(resolvePm(pm, env));
  const result = spawn(cmd, [...head, ...viewArgs(PKG_NAME)], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  const version = result.stdout.trim();
  return version ? { version, file: null } : null;
}

/** The install spec for `<pm> install -g`: a tarball path for `--source`, else `name@version`. */
export function resolveSpec({ source, latest }) {
  return source ? latest.file : `${PKG_NAME}@${latest.version}`;
}

/** The upgraded binary's path under `--prefix`: npm's Windows vs POSIX --prefix layout differ. */
function upgradedBinPath(prefix, platform) {
  return platform === 'win32'
    ? path.join(prefix, 'node_modules', PKG_NAME, 'bin', 'js-harness.mjs')
    : path.join(prefix, 'lib', 'node_modules', PKG_NAME, 'bin', 'js-harness.mjs');
}

/** Quotes a value for a shell command line built by joining tokens with spaces (see `shell: true`
 * in `child_process.spawn`, which does not escape array elements on its own). Simple, not
 * bulletproof: assumes the value has no embedded quote of its own platform's kind. */
function quoteForShell(value, platform) {
  return platform === 'win32' ? `"${value}"` : `'${value.replace(/'/g, "'\\''")}'`;
}

const STATUS_USAGE =
  'Usage: js-harness status [--cwd <path>] [--home <path>] [--global] [--source <dir>] [--pm <command>] [--prefix <dir>]';

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
    } else if (['--cwd', '--home', '--source', '--prefix', '--pm'].includes(token)) {
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
    prefix: values['--prefix'] ?? env.JS_HARNESS_PREFIX,
    pm: values['--pm'],
  };
}

/** The project half of `status`: what `init` pinned, what is running, and whether this clone is set up.
 * A pin that differs from the running version is reported, not failed: `status` reads, `sync` names the
 * ways out (T4 design). */
function reportProjectStatus(location, version) {
  console.log(`project: ${path.normalize(location.root)}`);
  console.log(`pinned version: ${location.pin}`);
  console.log(`running version: ${version}`);
  console.log(
    location.manifestPresent
      ? `this clone: set up (manifest: ${path.normalize(location.manifestPath)})`
      : 'this clone: not set up; js-harness sync sets it up',
  );
  console.log(
    location.pin === version
      ? 'pin and running version: match'
      : 'pin and running version: differ; js-harness sync names the ways out',
  );
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
        reportProjectStatus(location, currentVersion());
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
  const manifest = readManifest(opts.home);
  const latest = resolveLatest(opts, env, spawn);

  console.log(`installed package version: ${installed}`);
  console.log(`manifest version: ${manifest ? manifest.version : '(not installed)'}`);
  if (latest) {
    console.log(`latest available: ${latest.version}`);
    if (isNewer(latest.version, installed)) console.log(`update available: ${latest.version}`);
  } else {
    console.log('latest available: (unknown)');
  }
  return 0;
}

export async function updateMain(argv, env = process.env, spawn = spawnSync) {
  const opts = parseArgs(argv, env);
  const installed = currentVersion();
  const latest = resolveLatest(opts, env, spawn);

  if (!latest) {
    console.log('could not determine the latest version');
    return 0;
  }
  if (isNewer(latest.version, installed)) {
    console.log(`update available: ${latest.version} (installed: ${installed})`);
  } else {
    console.log(`up to date: ${installed}`);
  }
  return 0;
}

export async function upgradeMain(argv, env = process.env, spawn = spawnSync, platform = process.platform) {
  const opts = parseArgs(argv, env);
  const latest = resolveLatest(opts, env, spawn);
  if (!latest) {
    console.error('could not determine the latest version to upgrade to');
    return 1;
  }

  const spec = resolveSpec({ source: opts.source, latest });
  const [cmd, ...head] = splitCommand(resolvePm(opts.pm, env));
  const installResult = spawn(cmd, [...head, ...installArgs(spec, opts.prefix)], { encoding: 'utf8' });
  if (installResult.status !== 0) {
    console.error(`upgrade failed: ${cmd} exited ${installResult.status}`);
    return installResult.status ?? 1;
  }

  // Re-run the NEWLY installed binary's own sync, so files on disk match the new release
  // rather than whatever this (old) process would have written. With --prefix we know exactly
  // where npm put it; without one, run whatever `js-harness` the shell resolves on PATH. `--global`
  // (T4): upgrade runs from any folder, and inside a git repository a plain `sync` would act on that
  // project (or refuse for it) instead of the machine install this is meant to bring up to date.
  const syncResult = opts.prefix
    ? spawn(process.execPath, [upgradedBinPath(opts.prefix, platform), 'sync', '--home', opts.home, '--global'], {
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
  const manifest = readManifest(opts.home);
  if (!manifest || manifest.version !== latest.version) {
    console.error(
      `sync ran, but the manifest under ${opts.home} reports ` +
        `${manifest ? manifest.version : '(not installed)'}, not ${latest.version}: the js-harness ` +
        'found is not the upgraded one — run `js-harness sync --global` with the upgraded binary',
    );
    return 1;
  }

  console.log(`upgraded to ${latest.version}`);
  return 0;
}
