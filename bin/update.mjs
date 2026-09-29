#!/usr/bin/env node
// `status`, `update`, `upgrade`: version detection and upgrade. The package manager and the
// release source are both injectable because on this machine `npm` on PATH is a pnpm shim.
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { currentVersion } from './install.mjs';
import { readManifest } from './lib/manifest.mjs';
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

export async function statusMain(argv, env = process.env, spawn = spawnSync) {
  const opts = parseArgs(argv, env);
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
