#!/usr/bin/env node
// End-to-end proof: pack, global-install, detect an update, upgrade, and uninstall — all inside
// temp dirs, using the real npm CLI directly. On this machine `npm` on PATH is a pnpm shim, so
// every npm invocation here goes through the resolved npm-cli.js instead of PATH `npm`.
// NOT part of `npm run check` — this is slow (spawns two real global installs).
import fs from 'node:fs';
import path from 'node:path';
import { resolveNpmCli, run, npm, mkTmp, copyRepoToStaging, bumpVersion } from './lib.mjs';

// The skills `install` writes for each host, one folder each under `<home>/.<host>/skills/`.
const SKILLS = ['js-harness', 'js-harness-orchestrator'];

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
  const claudeSettingsPath = path.join(home, '.claude', 'settings.json');
  const codexHooksPath = path.join(home, '.codex', 'hooks.json');
  let seededClaudeSettings = '';
  let seededCodexHooks = '';

  function sessionStartCount(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.hooks.SessionStart.length;
  }

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

    // R3-005 (accepted T4 native review follow-up): one seed uses 4-space indentation, the other
    // tabs, so install/uninstall proves it preserves whatever indentation a host file already has
    // instead of always reformatting to 2 spaces.
    step('seed the temp home with one unrelated SessionStart entry per host, in two different indent styles', () => {
      fs.mkdirSync(path.dirname(claudeSettingsPath), { recursive: true });
      fs.mkdirSync(path.dirname(codexHooksPath), { recursive: true });
      seededClaudeSettings = `${JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: 'startup|resume|clear|compact',
                hooks: [{ type: 'command', command: 'echo unrelated-claude-hook', timeout: 5 }],
              },
            ],
          },
        },
        null,
        4,
      )}\n`;
      seededCodexHooks = `${JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                hooks: [{ type: 'command', command: 'echo unrelated-codex-hook', timeout: 5 }],
                matcher: 'startup|resume|clear|compact',
              },
            ],
          },
        },
        null,
        '\t',
      )}\n`;
      fs.writeFileSync(claudeSettingsPath, seededClaudeSettings, 'utf8');
      fs.writeFileSync(codexHooksPath, seededCodexHooks, 'utf8');
    });

    step('installed `js-harness install --home` writes the manifest and skill files', () => {
      const result = run(process.execPath, [binPath, 'install', '--home', home]);
      assertThat(result.status === 0, `install exited ${result.status}: ${result.stderr}`);
      const manifest = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8'));
      assertThat(manifest.version === '0.1.0', `expected manifest version 0.1.0, got ${manifest.version}`);
      for (const [host, label] of [['.claude', 'Claude'], ['.codex', 'Codex']]) {
        for (const skill of SKILLS) {
          assertThat(
            fs.existsSync(path.join(home, host, 'skills', skill, 'SKILL.md')),
            `missing the ${label} skill file of ${skill}`,
          );
        }
      }
    });

    step('install added exactly one SessionStart entry to each seeded host file', () => {
      assertThat(
        sessionStartCount(claudeSettingsPath) === 2,
        `expected 2 Claude SessionStart entries (1 seeded + 1 ours), got ${sessionStartCount(claudeSettingsPath)}`,
      );
      assertThat(
        sessionStartCount(codexHooksPath) === 2,
        `expected 2 Codex SessionStart entries (1 seeded + 1 ours), got ${sessionStartCount(codexHooksPath)}`,
      );
      const claudeData = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8'));
      assertThat(
        claudeData.hooks.SessionStart[0].hooks[0].command === 'echo unrelated-claude-hook',
        'expected the seeded Claude entry to still be first and untouched',
      );
      const codexData = JSON.parse(fs.readFileSync(codexHooksPath, 'utf8'));
      assertThat(
        codexData.hooks.SessionStart[0].hooks[0].command === 'echo unrelated-codex-hook',
        'expected the seeded Codex entry to still be first and untouched',
      );
    });

    step('install preserved each seeded file\'s own indentation (4-space Claude, tab Codex)', () => {
      const claudeRaw = fs.readFileSync(claudeSettingsPath, 'utf8');
      assertThat(claudeRaw.includes('\n    "hooks"'), `expected 4-space indentation in:\n${claudeRaw}`);
      const codexRaw = fs.readFileSync(codexHooksPath, 'utf8');
      assertThat(codexRaw.includes('\n\t"hooks"'), `expected tab indentation in:\n${codexRaw}`);
    });

    step('a second `install --home` adds no duplicate SessionStart entries', () => {
      const result = run(process.execPath, [binPath, 'install', '--home', home]);
      assertThat(result.status === 0, `install exited ${result.status}: ${result.stderr}`);
      assertThat(
        sessionStartCount(claudeSettingsPath) === 2,
        `expected still 2 Claude SessionStart entries after a repeat install, got ${sessionStartCount(claudeSettingsPath)}`,
      );
      assertThat(
        sessionStartCount(codexHooksPath) === 2,
        `expected still 2 Codex SessionStart entries after a repeat install, got ${sessionStartCount(codexHooksPath)}`,
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

    step('`js-harness status --global --source` reports the 0.2.0 update', () => {
      const result = run(process.execPath, [binPath, 'status', '--global', '--source', releasesDir, '--home', home]);
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

    step('the `sync` run inside upgrade also added no duplicate SessionStart entries', () => {
      assertThat(
        sessionStartCount(claudeSettingsPath) === 2,
        `expected still 2 Claude SessionStart entries after upgrade's sync, got ${sessionStartCount(claudeSettingsPath)}`,
      );
      assertThat(
        sessionStartCount(codexHooksPath) === 2,
        `expected still 2 Codex SessionStart entries after upgrade's sync, got ${sessionStartCount(codexHooksPath)}`,
      );
    });

    step('`js-harness uninstall` removes what it wrote and restores both hook files byte-for-byte', () => {
      // --global (T3b item 6, R3-uninstall-cwd-dependent-machine-tests): this step must always
      // mean the machine install under `home`, never depend on whichever directory `npm run e2e`
      // happens to be invoked from.
      const result = run(process.execPath, [binPath, 'uninstall', '--home', home, '--global']);
      assertThat(result.status === 0, `uninstall exited ${result.status}: ${result.stderr}`);
      assertThat(!fs.existsSync(path.join(home, '.js-harness')), 'expected .js-harness to be removed');
      assertThat(
        !fs.existsSync(path.join(home, '.claude', 'skills')),
        'expected the Claude skill dir to be removed',
      );
      assertThat(
        !fs.existsSync(path.join(home, '.codex', 'skills')),
        'expected the Codex skill dir to be removed',
      );
      const claudeAfter = fs.readFileSync(claudeSettingsPath, 'utf8');
      assertThat(
        claudeAfter === seededClaudeSettings,
        `expected Claude settings.json restored byte-for-byte, got:\n${claudeAfter}`,
      );
      const codexAfter = fs.readFileSync(codexHooksPath, 'utf8');
      assertThat(
        codexAfter === seededCodexHooks,
        `expected Codex hooks.json restored byte-for-byte, got:\n${codexAfter}`,
      );
    });
  } finally {
    for (const dir of [staging, pack01Dir, releasesDir, prefix, home]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
