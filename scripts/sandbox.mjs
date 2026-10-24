#!/usr/bin/env node
// A hand-drivable sandbox for trying the TUI: packs the current repo at its own version, installs
// it into a temp --prefix + --home (via the real npm CLI, never PATH `npm`), bumps a staged copy
// and packs it as a fake newer release, then writes a launch script that opens the TUI over all
// of it. Never touches the real home or the real global npm install.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveNpmCli, run, npm, mkTmp, copyRepoToStaging, bumpVersion, globalPackageDir, nextVersion } from './lib.mjs';

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

/** The launcher of a --prefix global install, in the package folder lib.mjs's globalPackageDir names. */
export function installedBinPath(prefix, platform = os.platform()) {
  return path.join(globalPackageDir(prefix, platform), 'bin', 'js-harness.mjs');
}

function main() {
  const npmCli = resolveNpmCli();
  if (!fs.existsSync(npmCli)) {
    console.log(
      `FAIL  resolve npm CLI: not found at ${npmCli}\n` +
        '      set JS_HARNESS_E2E_NPM_CLI to your real npm-cli.js (PATH `npm` may be a shim).',
    );
    process.exit(1);
    return;
  }

  const sandboxRoot = mkTmp('js-harness-sandbox-');
  const prefix = path.join(sandboxRoot, 'prefix');
  const home = path.join(sandboxRoot, 'home');
  const releases = path.join(sandboxRoot, 'releases');
  const stage = path.join(sandboxRoot, 'stage');
  for (const dir of [prefix, home, releases, stage]) fs.mkdirSync(dir, { recursive: true });

  copyRepoToStaging(stage);
  const baseVersion = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8')).version;
  // The upgrade goes to the next minor of the repository's version, whatever it is (harness review e6).
  const TO = nextVersion(baseVersion);

  const pack01 = npm(npmCli, ['pack', '--pack-destination', sandboxRoot], { cwd: stage });
  assertThat(pack01.status === 0, `npm pack (${baseVersion}) exited ${pack01.status}: ${pack01.stderr}`);
  const tarball01 = path.join(sandboxRoot, `js-harness-${baseVersion}.tgz`);
  assertThat(fs.existsSync(tarball01), `expected ${tarball01} after npm pack`);

  const install01 = npm(npmCli, ['install', '-g', tarball01, '--prefix', prefix]);
  assertThat(install01.status === 0, `npm install -g exited ${install01.status}: ${install01.stderr}`);

  const binPath = installedBinPath(prefix);
  assertThat(fs.existsSync(binPath), `expected the installed bin at ${binPath}`);

  bumpVersion(stage, TO);
  const pack02 = npm(npmCli, ['pack', '--pack-destination', releases], { cwd: stage });
  assertThat(pack02.status === 0, `npm pack (${TO}) exited ${pack02.status}: ${pack02.stderr}`);
  assertThat(
    fs.existsSync(path.join(releases, `js-harness-${TO}.tgz`)),
    `expected js-harness-${TO}.tgz in releases/`,
  );

  const node = process.execPath;
  if (node.includes(' ') || npmCli.includes(' ')) {
    console.log(
      'warning: process.execPath or the npm CLI path contains a space; JS_HARNESS_PM splits on ' +
        'whitespace (bin/lib/version.mjs splitCommand) and will not parse this value correctly.',
    );
  }
  // The existing --pm splitting is whitespace-based (see the warning above): this only works
  // because neither path contains a space on this machine.
  const pmValue = `${node} ${npmCli}`;

  const launchCmdPath = path.join(sandboxRoot, 'launch.cmd');
  fs.writeFileSync(
    launchCmdPath,
    [
      '@echo off',
      `set "JS_HARNESS_HOME=${home}"`,
      `set "JS_HARNESS_SOURCE=${releases}"`,
      `set "JS_HARNESS_PREFIX=${prefix}"`,
      `set "JS_HARNESS_PM=${pmValue}"`,
      `"${node}" "${binPath}"`,
      '',
    ].join('\r\n'),
    'utf8',
  );

  const launchShPath = path.join(sandboxRoot, 'launch.sh');
  fs.writeFileSync(
    launchShPath,
    [
      '#!/bin/sh',
      `export JS_HARNESS_HOME="${home}"`,
      `export JS_HARNESS_SOURCE="${releases}"`,
      `export JS_HARNESS_PREFIX="${prefix}"`,
      `export JS_HARNESS_PM="${pmValue}"`,
      `"${node}" "${binPath}"`,
      '',
    ].join('\n'),
    'utf8',
  );
  try {
    fs.chmodSync(launchShPath, 0o755);
  } catch {
    // best-effort; not all filesystems (e.g. some Windows setups) honor chmod
  }

  const launchCommand = os.platform() === 'win32' ? launchCmdPath : `sh ${launchShPath}`;

  console.log('');
  console.log(`Sandbox ready: ${sandboxRoot}`);
  console.log(`Launch: ${launchCommand}`);
  console.log('');
  console.log('Try, in order:');
  console.log(`  Status    -> installed ${baseVersion}, update available: ${TO}`);
  console.log('  Install   -> writes the skill files + manifest under the sandbox home');
  console.log(`  Upgrade   -> installs ${TO} into the sandbox prefix and re-syncs`);
  console.log(`  Status    -> now ${TO}, no update available`);
  console.log('  Uninstall -> removes exactly what Install/Upgrade wrote');
  console.log('');
  console.log(`Delete afterwards: remove ${sandboxRoot} recursively.`);
  console.log('It never touched your real home or your real global npm install.');
}

// Compare real paths, as the `bin/` commands do, so the file can be imported without building a sandbox.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main();
}
