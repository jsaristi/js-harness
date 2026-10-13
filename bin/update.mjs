#!/usr/bin/env node
// `status`, `update`, `upgrade`: version detection and upgrade. The package manager is injectable
// because on this machine `npm` on PATH is a pnpm shim; it installs a tarball and is never asked which
// release is the latest (see `resolveLatest`). `status` also answers by location (T5 design); see
// `statusMain` for which folders report the project, the machine install, or refuse.
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { currentVersion } from './install.mjs';
import { installedVersion } from './lib/manifest.mjs';
import { projectLocation, staleManifestMessage, invalidHarnessJsonMessage } from './lib/project.mjs';
import { INSTALL_NEWEST, latestFromSource, splitCommand, installArgs, isNewer } from './lib/version.mjs';

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

/** What the commands say where there is no release to look for: none is tagged before 1.0.0
 * (docs/ROADMAP.md, "Release source"), and how a machine gets the newest copy until then. */
export const NO_RELEASE = `no release of js-harness is tagged yet (versions are tagged from 1.0.0); to get the newest copy: ${INSTALL_NEWEST}`;

/** The newest release in `source`, a folder of `npm pack` tarballs the caller named with `--source` or
 * `JS_HARNESS_SOURCE`, as `{ version, file }`; `null` when that folder holds none, and `null` when there
 * is no source. It starts no process, and that is the point: the public registry is never asked about
 * the name `js-harness`, which nobody holds there, so whoever registered it would decide what `upgrade`
 * installs and runs. Reading the tags of this repository, the decided release source, belongs here when
 * the first one exists. A source folder that cannot be read throws, as `fs.readdirSync` does. */
export function resolveLatest({ source }) {
  return source ? latestFromSource(source) : null;
}

/** `resolveLatest` for a command: `{ latest }`, or `{ problem }` with a line to print when the source
 * folder cannot be read. */
function latestFor(opts) {
  try {
    return { latest: resolveLatest(opts) };
  } catch (err) {
    return { problem: `cannot read the source folder ${opts.source}: ${err.code ?? err.message}` };
  }
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
  const recorded = installedVersion(opts.home);
  const { latest, problem } = latestFor(opts);

  console.log(`installed package version: ${installed}`);
  console.log(`manifest version: ${recorded ?? '(not installed)'}`);
  if (latest) {
    console.log(`latest available: ${latest.version}`);
    if (isNewer(latest.version, installed)) console.log(`update available: ${latest.version}`);
  } else if (opts.source) {
    // A source that was named and answers nothing is not known, which is not the same as no release.
    console.log(`latest available: (unknown${problem ? `: ${problem}` : ''})`);
  } else {
    console.log('latest available: (no release is tagged yet)');
  }
  return 0;
}

export async function updateMain(argv, env = process.env, spawn = spawnSync) {
  const opts = parseArgs(argv, env);
  const installed = currentVersion();
  if (!opts.source) {
    console.log(`${NO_RELEASE} (installed: ${installed})`);
    return 0;
  }
  const { latest, problem } = latestFor(opts);
  if (problem) {
    console.error(problem);
    return 1;
  }

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
  if (!opts.source) {
    console.error(`nothing was installed: ${NO_RELEASE}`);
    return 1;
  }
  const { latest, problem } = latestFor(opts);
  if (problem) {
    console.error(problem);
    return 1;
  }
  if (!latest) {
    console.error('could not determine the latest version to upgrade to');
    return 1;
  }
  // Only a newer release replaces the installed one: the folder may hold the same version, or an older.
  const installed = currentVersion();
  if (!isNewer(latest.version, installed)) {
    console.log(`up to date: ${installed} (the source holds ${latest.version})`);
    return 0;
  }

  // The one thing ever installed: the tarball of the folder the caller named, never a name on a registry.
  const [cmd, ...head] = splitCommand(resolvePm(opts.pm, env));
  const installResult = spawn(cmd, [...head, ...installArgs(latest.file, opts.prefix)], { encoding: 'utf8' });
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
