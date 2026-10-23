#!/usr/bin/env node
// End-to-end proof: pack, global-install, detect an update, upgrade, and uninstall — all inside
// temp dirs, using the real npm CLI directly. On this machine `npm` on PATH is a pnpm shim, so
// every npm invocation here goes through the resolved npm-cli.js instead of PATH `npm`.
// NOT part of `npm run check` — this is slow (spawns two real global installs).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, resolveNpmCli, run, npm, mkTmp, copyRepoToStaging, bumpVersion, globalPackageDir, nextVersion } from './lib.mjs';
import { hooksOfHost, hookLabel, hostHooksProblem, uninstalledHostProblem } from './practice-lib.mjs';

// The skills `install` writes for each host, one folder each under `<home>/.<host>/skills/`.
// The repository's version is packed first, and the upgrade goes to the next minor (harness review e6).
const FROM = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).version;
const TO = nextVersion(FROM);

const SKILLS = ['js-harness', 'js-harness-orchestrator', 'js-harness-protocols'];

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

/** The `--pm` of the upgrade step: node and the npm CLI run through this same node, the real npm CLI and never a PATH
 * `npm`. `upgrade` splits its `--pm` on whitespace (bin/update.mjs), so the two paths are the value as they are when
 * neither holds a space. When one does (C:\Program Files\nodejs, the Windows default) they are named, quoted, inside a
 * wrapper script in `dir`, and the value is the wrapper's path, which must hold no space (tui-walk does the same). */
export function upgradePm(dir, execPath, npmCli, platform = process.platform) {
  if (!/\s/.test(execPath) && !/\s/.test(npmCli)) return `${execPath} ${npmCli}`;
  const file = path.join(dir, platform === 'win32' ? 'npm-e2e.cmd' : 'npm-e2e');
  if (/\s/.test(file)) throw new Error(`the --pm wrapper would sit in ${dir}, a path with a space, which upgrade cannot hold`);
  const content = platform === 'win32' ? `@"${execPath}" "${npmCli}" %*\r\n` : `#!/bin/sh\nexec "${execPath}" "${npmCli}" "$@"\n`;
  fs.writeFileSync(file, content, { mode: 0o755 });
  return file;
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
  const pmDir = mkTmp('js-harness-e2e-pm-');
  const binPath = path.join(globalPackageDir(prefix), 'bin', 'js-harness.mjs');
  const claudeSettingsPath = path.join(home, '.claude', 'settings.json');
  const codexHooksPath = path.join(home, '.codex', 'hooks.json');
  let seededClaudeSettings = '';
  let seededCodexHooks = '';

  // The command of the entry each host file is seeded with, the user's, which install must leave first, and the host
  // whose file it is: what install writes there depends on the host (`hooksOfHost`).
  const seededCommands = [
    [claudeSettingsPath, 'echo unrelated-claude-hook', 'claude'],
    [codexHooksPath, 'echo unrelated-codex-hook', 'codex'],
  ];

  /** What is wrong with the hook entries of the two host files, or `null`: each must hold its seeded entry
   * and then every entry `install` writes for its host (`hooksOfHost`: the doctor's for `startup|resume` and
   * the resume hook's for `compact|clear|startup`, for both; the pause hook's for Claude Code only) once, by its event, its
   * matcher and its command (`hostHooksProblem`). */
  function hostFilesProblem() {
    for (const [filePath, seededCommand, host] of seededCommands) {
      const problem = hostHooksProblem(fs.readFileSync(filePath, 'utf8'), seededCommand, host);
      if (problem !== null) return `${filePath}: ${problem}`;
    }
    return null;
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
    step('stage a copy of the repo at ' + FROM, () => {
      copyRepoToStaging(staging);
      assertThat(fs.existsSync(path.join(staging, 'package.json')), 'staging package.json is missing');
    });

    step('npm pack ' + FROM, () => {
      const result = npm(npmCli, ['pack', '--pack-destination', pack01Dir], { cwd: staging });
      assertThat(result.status === 0, `npm pack exited ${result.status}: ${result.stderr}`);
      assertThat(
        fs.existsSync(path.join(pack01Dir, 'js-harness-' + FROM + '.tgz')),
        'expected js-harness-' + FROM + '.tgz in the pack directory',
      );
    });

    step('npm install -g the ' + FROM + ' tarball into a temp prefix', () => {
      const tgz = path.join(pack01Dir, 'js-harness-' + FROM + '.tgz');
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
      assertThat(manifest.version === FROM, `expected manifest version ${FROM}, got ${manifest.version}`);
      for (const [host, label] of [['.claude', 'Claude'], ['.codex', 'Codex']]) {
        for (const skill of SKILLS) {
          assertThat(
            fs.existsSync(path.join(home, host, 'skills', skill, 'SKILL.md')),
            `missing the ${label} skill file of ${skill}`,
          );
        }
      }
    });

    step(`install added its hook entries to each seeded host file, after the seeded one: ${seededCommands.map(([, , host]) => `${host} ${hooksOfHost(host).map(hookLabel).join(' and ')}`).join('; ')}`, () => {
      const problem = hostFilesProblem();
      assertThat(problem === null, `after install, ${problem}`);
    });

    step('install preserved each seeded file\'s own indentation (4-space Claude, tab Codex)', () => {
      const claudeRaw = fs.readFileSync(claudeSettingsPath, 'utf8');
      assertThat(claudeRaw.includes('\n    "hooks"'), `expected 4-space indentation in:\n${claudeRaw}`);
      const codexRaw = fs.readFileSync(codexHooksPath, 'utf8');
      assertThat(codexRaw.includes('\n\t"hooks"'), `expected tab indentation in:\n${codexRaw}`);
    });

    step('a second `install --home` adds no duplicate hook entries', () => {
      const result = run(process.execPath, [binPath, 'install', '--home', home]);
      assertThat(result.status === 0, `install exited ${result.status}: ${result.stderr}`);
      const problem = hostFilesProblem();
      assertThat(problem === null, `after a repeat install, ${problem}`);
    });

    step('bump the staged copy to ' + TO + ' and pack it into the release directory', () => {
      bumpVersion(staging, TO);
      const result = npm(npmCli, ['pack', '--pack-destination', releasesDir], { cwd: staging });
      assertThat(result.status === 0, `npm pack exited ${result.status}: ${result.stderr}`);
      assertThat(
        fs.existsSync(path.join(releasesDir, 'js-harness-' + TO + '.tgz')),
        'expected js-harness-' + TO + '.tgz in the release directory',
      );
    });

    step('`js-harness status --global --source` reports the ' + TO + ' update', () => {
      const result = run(process.execPath, [binPath, 'status', '--global', '--source', releasesDir, '--home', home]);
      assertThat(result.status === 0, `status exited ${result.status}: ${result.stderr}`);
      assertThat(
        result.stdout.includes(`latest available: ${TO}`),
        `expected "latest available: ${TO}" in:\n${result.stdout}`,
      );
      assertThat(
        result.stdout.includes(`update available: ${TO}`),
        `expected "update available: ${TO}" in:\n${result.stdout}`,
      );
    });

    step('`js-harness upgrade --source` installs ' + TO + ' and re-syncs through it', () => {
      // The real npm CLI through this same node, bypassing the pnpm shim, named by a wrapper (upgradePm).
      const pm = upgradePm(pmDir, process.execPath, npmCli);
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

    step('the installed package and the manifest both report ' + TO, () => {
      const installedPkg = JSON.parse(
        fs.readFileSync(path.join(globalPackageDir(prefix), 'package.json'), 'utf8'),
      );
      assertThat(installedPkg.version === TO, `expected installed version ${TO}, got ${installedPkg.version}`);
      const manifest = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8'));
      assertThat(manifest.version === TO, `expected manifest version ${TO}, got ${manifest.version}`);
    });

    step('the `sync` run inside upgrade also added no duplicate hook entries', () => {
      const problem = hostFilesProblem();
      assertThat(problem === null, `after upgrade's sync, ${problem}`);
    });

    step('`js-harness uninstall` removes what it wrote and restores both hook files byte for byte as seeded', () => {
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
      // uninstall takes back the PostToolUse list install made in Claude's file as well, so both files are the seeded bytes.
      const claudeAfter = fs.readFileSync(claudeSettingsPath, 'utf8');
      const claudeProblem = uninstalledHostProblem(claudeAfter, seededClaudeSettings);
      assertThat(
        claudeProblem === null,
        `Claude settings.json after uninstall: ${claudeProblem}`,
      );
      const codexAfter = fs.readFileSync(codexHooksPath, 'utf8');
      const codexProblem = uninstalledHostProblem(codexAfter, seededCodexHooks);
      assertThat(
        codexProblem === null,
        `Codex hooks.json after uninstall: ${codexProblem}`,
      );
    });
  } finally {
    for (const dir of [staging, pack01Dir, releasesDir, prefix, home, pmDir]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  process.exit(failed ? 1 : 0);
}

// Compare real paths, as the `bin/` commands do, so the file can be imported without running the proof.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main();
}
