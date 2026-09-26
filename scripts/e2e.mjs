#!/usr/bin/env node
// End-to-end proof: pack, global-install, detect an update, upgrade, and uninstall — all inside
// temp dirs, using the real npm CLI directly. On this machine `npm` on PATH is a pnpm shim, so
// every npm invocation here goes through the resolved npm-cli.js instead of PATH `npm`.
// NOT part of `npm run check` — this is slow (spawns two real global installs).
import fs from 'node:fs';
import path from 'node:path';
import { resolveNpmCli, run, npm, mkTmp, copyRepoToStaging, bumpVersion } from './lib.mjs';

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const npmCli = resolveNpmCli();
  if (!fs.existsSync(npmCli)) {
    console.log(
      `FAIL  resolve npm CLI: not found at ${npmCli}\n` +
        '      set JS_HARNESS_E2E_NPM_CLI to your real npm-cli.js (PATH `npm` may be a shim).',
    );
    process.exit(1);
    return;
  }

  const staging = mkTmp('js-harness-e2e-staging-');
  const pack01Dir = mkTmp('js-harness-e2e-pack01-');
  const releasesDir = mkTmp('js-harness-e2e-releases-');
  const prefix = mkTmp('js-harness-e2e-prefix-');
  const home = mkTmp('js-harness-e2e-home-');
  const binPath = path.join(prefix, 'node_modules', 'js-harness', 'bin', 'js-harness.mjs');

  let failed = false;
  function step(name, fn) {
    if (failed) return;
    try {
      fn();
      console.log(`PASS  ${name}`);
    } catch (err) {
      console.log(`FAIL  ${name}: ${err.message}`);
      failed = true;
    }
  }

  try {
    step('stage a copy of the repo at 0.1.0', () => {
      copyRepoToStaging(staging);
      assertThat(fs.existsSync(path.join(staging, 'package.json')), 'staging package.json is missing');
    });

    step('npm pack 0.1.0', () => {
      const result = npm(npmCli, ['pack', '--pack-destination', pack01Dir], { cwd: staging });
      assertThat(result.status === 0, `npm pack exited ${result.status}: ${result.stderr}`);
      assertThat(
        fs.existsSync(path.join(pack01Dir, 'js-harness-0.1.0.tgz')),
        'expected js-harness-0.1.0.tgz in the pack directory',
      );
    });

    step('npm install -g the 0.1.0 tarball into a temp prefix', () => {
      const tgz = path.join(pack01Dir, 'js-harness-0.1.0.tgz');
      const result = npm(npmCli, ['install', '-g', tgz, '--prefix', prefix]);
      assertThat(result.status === 0, `npm install -g exited ${result.status}: ${result.stderr}`);
      assertThat(fs.existsSync(binPath), `expected the installed bin at ${binPath}`);
    });

    step('installed `js-harness install --home` writes the manifest and skill files', () => {
      const result = run(process.execPath, [binPath, 'install', '--home', home]);
      assertThat(result.status === 0, `install exited ${result.status}: ${result.stderr}`);
      const manifest = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8'));
      assertThat(manifest.version === '0.1.0', `expected manifest version 0.1.0, got ${manifest.version}`);
      assertThat(
        fs.existsSync(path.join(home, '.claude', 'skills', 'js-harness', 'SKILL.md')),
        'missing the Claude skill file',
      );
      assertThat(
        fs.existsSync(path.join(home, '.codex', 'skills', 'js-harness', 'SKILL.md')),
        'missing the Codex skill file',
      );
    });

    step('bump the staged copy to 0.2.0 and pack it into the release directory', () => {
      bumpVersion(staging, '0.2.0');
      const result = npm(npmCli, ['pack', '--pack-destination', releasesDir], { cwd: staging });
      assertThat(result.status === 0, `npm pack exited ${result.status}: ${result.stderr}`);
      assertThat(
        fs.existsSync(path.join(releasesDir, 'js-harness-0.2.0.tgz')),
        'expected js-harness-0.2.0.tgz in the release directory',
      );
    });

    step('`js-harness status --source` reports the 0.2.0 update', () => {
      const result = run(process.execPath, [binPath, 'status', '--source', releasesDir, '--home', home]);
      assertThat(result.status === 0, `status exited ${result.status}: ${result.stderr}`);
      assertThat(
        /latest available: 0\.2\.0/.test(result.stdout),
        `expected "latest available: 0.2.0" in:\n${result.stdout}`,
      );
      assertThat(
        /update available: 0\.2\.0/.test(result.stdout),
        `expected "update available: 0.2.0" in:\n${result.stdout}`,
      );
    });

    step('`js-harness upgrade --source` installs 0.2.0 and re-syncs through it', () => {
      // A multi-word --pm: run the real npm CLI through this same node, bypassing the pnpm shim.
      const pm = `${process.execPath} ${npmCli}`;
      const result = run(process.execPath, [
        binPath,
        'upgrade',
        '--source',
        releasesDir,
        '--pm',
        pm,
        '--prefix',
        prefix,
        '--home',
        home,
      ]);
      assertThat(result.status === 0, `upgrade exited ${result.status}: ${result.stdout}${result.stderr}`);
    });

    step('the installed package and the manifest both report 0.2.0', () => {
      const installedPkg = JSON.parse(
        fs.readFileSync(path.join(prefix, 'node_modules', 'js-harness', 'package.json'), 'utf8'),
      );
      assertThat(installedPkg.version === '0.2.0', `expected installed version 0.2.0, got ${installedPkg.version}`);
      const manifest = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8'));
      assertThat(manifest.version === '0.2.0', `expected manifest version 0.2.0, got ${manifest.version}`);
    });

    step('`js-harness uninstall` leaves the temp home exactly as it was', () => {
      const result = run(process.execPath, [binPath, 'uninstall', '--home', home]);
      assertThat(result.status === 0, `uninstall exited ${result.status}: ${result.stderr}`);
      const remaining = fs.readdirSync(home);
      assertThat(remaining.length === 0, `expected an empty home, found: ${remaining.join(', ')}`);
    });
  } finally {
    for (const dir of [staging, pack01Dir, releasesDir, prefix, home]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
