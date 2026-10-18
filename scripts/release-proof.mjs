#!/usr/bin/env node
// Release proof: installs a release tag of the repository with the real package manager into throwaway folders,
// checks it, upgrades it to `--to` and uninstalls, then compares the throwaway home with the one it started from.
// The logic is in scripts/release-proof-lib.mjs; this runs the steps it lists and prints one line per step.
// NOT part of `npm run check`: it installs for real (from a GitHub tag, or from a clone of this repository).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, bumpVersion, globalPackageDir, mkTmp, npm, resolveNpmCli, run } from './lib.mjs';
import { installPlan, tagSpec } from '../bin/lib/version.mjs';
import { uninstalledHostProblem } from './practice-lib.mjs';
import {
  ReleaseProofArgError,
  USAGE,
  copyCandidatesOf,
  homeDifferences,
  hostFilesProblem,
  manifestProblem,
  movePin,
  parseArgs,
  pickCopy,
  seededHostFiles,
  snapshotOf,
  stepsFor,
  statusProblem,
  tagVersion,
  throwawayTags,
  upgradePmCommand,
  versionProblem,
} from './release-proof-lib.mjs';

const PKG = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
const MAX_BUFFER = 64 * 1024 * 1024;
// The throwaway commit of a clone is made under this identity, never the user's.
const GIT_IDENTITY = ['-c', 'user.name=release proof', '-c', 'user.email=release-proof@example.invalid'];

function lastLines(text, count = 5) {
  return String(text ?? '').trim().split(/\r?\n/).slice(-count).join('\n      ');
}

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

/** The output of a finished command, or the throw that says how it ended. */
function assertRun(result, label) {
  if (result.error || result.status !== 0) {
    throw new Error(`${label} exited ${result.status ?? result.error?.code}: ${lastLines(`${result.stdout ?? ''}${result.stderr ?? ''}`)}`);
  }
  return result.stdout;
}

function git(cwd, args) {
  return assertRun(spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER }), `git ${args.join(' ')}`).trim();
}

/** Every file under `dir` as `[path, content]`, for the snapshot of the home. */
function readTree(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? readTree(file) : [[file, fs.readFileSync(file)]];
  });
}

function readVersion(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2), PKG);
  } catch (err) {
    if (!(err instanceof ReleaseProofArgError)) throw err;
    console.error(`${err.message}\n\n${USAGE}`);
    process.exit(2);
    return;
  }
  if (opts.help) {
    console.log(USAGE);
    process.exit(0);
    return;
  }

  const npmCli = resolveNpmCli();
  const local = opts.repo === '.';
  const created = [];
  const scratch = (prefix) => {
    const dir = mkTmp(prefix);
    created.push(dir);
    return dir;
  };
  const prefix = scratch('js-harness-release-proof-prefix-');
  const home = scratch('js-harness-release-proof-home-');
  const project = path.join(scratch('js-harness-release-proof-project-'), 'app');
  const fromVersion = tagVersion(opts.from);
  const toVersion = opts.to === null ? null : tagVersion(opts.to);
  let repo = opts.repo;
  let seeded = null;
  let before = null;

  /** The bin of the copy of `version` under the prefix: npm's folder, or the pnpm copy of that version. */
  function copyOf(version) {
    if (opts.pm === 'npm') return path.join(globalPackageDir(prefix), 'bin', 'js-harness.mjs');
    const copies = copyCandidatesOf(prefix, (dir) => (fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? fs.readdirSync(dir) : []), (file) => fs.existsSync(file))
      .map((root) => ({ root, version: readVersion(root) }));
    const root = pickCopy(copies, version);
    if (root === null) throw new Error(`no ${opts.pm} copy of js-harness ${version} under ${prefix}`);
    return path.join(root, 'bin', 'js-harness.mjs');
  }

  /** Runs the copy `bin` of js-harness with `args`, through this node. */
  const js = (bin, args) => run(process.execPath, [bin, ...args], { maxBuffer: MAX_BUFFER });

  /** The checks of a release once installed: its version, `status --global`, its manifest and both hosts' hooks. */
  function checkInstalled(version) {
    const bin = copyOf(version);
    const versionFault = versionProblem(assertRun(js(bin, ['--version']), 'js-harness --version'), version);
    assertThat(versionFault === null, versionFault);
    const statusFault = statusProblem(assertRun(js(bin, ['status', '--global', '--home', home, '--repo', repo]), 'js-harness status --global'), version);
    assertThat(statusFault === null, statusFault);
    const manifestFault = manifestProblem(fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8'), version);
    assertThat(manifestFault === null, manifestFault);
    const hooksFault = hostFilesProblem({
      claude: fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'),
      codex: fs.readFileSync(path.join(home, '.codex', 'hooks.json'), 'utf8'),
    }, seeded);
    assertThat(hooksFault === null, hooksFault);
  }

  const handlers = {
    'prepare-repo': () => {
      // The clone takes no tags of the repository: its real tags would be the newest one `upgrade` finds.
      const cloneDir = path.join(scratch('js-harness-release-proof-clone-'), 'repo');
      git(path.dirname(cloneDir), ['clone', '-q', '--no-tags', path.resolve(opts.repo), cloneDir]);
      const tags = throwawayTags(PKG.version);
      assertThat(opts.to === null || opts.to === tags.to, `with --repo ., --to must be ${tags.to}, the throwaway tag of the bump`);
      git(cloneDir, ['tag', tags.from]);
      bumpVersion(cloneDir, tags.nextVersion);
      git(cloneDir, ['add', 'package.json']);
      git(cloneDir, [...GIT_IDENTITY, 'commit', '-q', '-m', `chore: release proof ${tags.nextVersion}`]);
      git(cloneDir, ['tag', tags.to]);
      repo = cloneDir;
    },
    'install-from': () => {
      const plan = installPlan(opts.pm, tagSpec(repo, opts.from), prefix, process.env, process.platform);
      if (opts.pm === 'npm') {
        assertThat(fs.existsSync(npmCli), `npm CLI not found at ${npmCli}: set JS_HARNESS_E2E_NPM_CLI to your real npm-cli.js`);
        assertRun(npm(npmCli, plan.args, { env: plan.env, maxBuffer: MAX_BUFFER }), `npm install of ${opts.from}`);
      } else if (process.platform === 'win32') {
        // On Windows pnpm is a .cmd file, which runs only through a shell, as `upgrade` runs it.
        assertRun(spawnSync(['pnpm', ...plan.args].join(' '), { encoding: 'utf8', env: plan.env, shell: true, maxBuffer: MAX_BUFFER }), `pnpm install of ${opts.from}`);
      } else {
        assertRun(spawnSync('pnpm', plan.args, { encoding: 'utf8', env: plan.env, maxBuffer: MAX_BUFFER }), `pnpm install of ${opts.from}`);
      }
      const versionFault = versionProblem(assertRun(js(copyOf(fromVersion), ['--version']), 'js-harness --version'), fromVersion);
      assertThat(versionFault === null, versionFault);
    },
    'seed-home': () => {
      seeded = seededHostFiles();
      fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
      fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
      fs.writeFileSync(path.join(home, '.claude', 'settings.json'), seeded.claude.text, 'utf8');
      fs.writeFileSync(path.join(home, '.codex', 'hooks.json'), seeded.codex.text, 'utf8');
      before = snapshotOf(readTree(home));
    },
    'install-home': () => {
      assertRun(js(copyOf(fromVersion), ['install', '--home', home]), 'js-harness install --home');
    },
    'check-from': () => checkInstalled(fromVersion),
    'init-project': () => {
      fs.mkdirSync(project, { recursive: true });
      git(project, ['init', '-q']);
      assertRun(js(copyOf(fromVersion), ['init', '--cwd', project, '--home', home]), 'js-harness init');
      const pin = JSON.parse(fs.readFileSync(path.join(project, 'harness.json'), 'utf8')).version;
      assertThat(pin === fromVersion, `expected the project pinned to ${fromVersion}, got ${pin}`);
    },
    upgrade: () => {
      const pm = upgradePmCommand(opts.pm, { execPath: process.execPath, npmCli });
      assertRun(js(copyOf(fromVersion), ['upgrade', '--home', home, '--repo', repo, '--pm', pm, '--prefix', prefix]), `js-harness upgrade to ${toVersion}`);
    },
    'check-to': () => checkInstalled(toVersion),
    'move-pin': () => {
      const file = path.join(project, 'harness.json');
      fs.writeFileSync(file, movePin(fs.readFileSync(file, 'utf8'), toVersion), 'utf8');
      assertRun(js(copyOf(toVersion), ['sync', '--cwd', project, '--home', home]), 'js-harness sync');
    },
    'check-project': () => {
      const shown = assertRun(js(copyOf(toVersion), ['status', '--cwd', project, '--home', home]), 'js-harness status --cwd');
      const field = (label) => new RegExp(`^${label}: (.*)$`, 'm').exec(shown)?.[1];
      assertThat(field('pinned version') === toVersion, `project status: pinned version ${field('pinned version')}, expected ${toVersion}`);
      assertThat(field('running version') === toVersion, `project status: running version ${field('running version')}, expected ${toVersion}`);
    },
    uninstall: () => {
      assertRun(js(copyOf(toVersion ?? fromVersion), ['uninstall', '--home', home, '--global']), 'js-harness uninstall --global');
      assertThat(!fs.existsSync(path.join(home, '.js-harness')), 'expected .js-harness to be removed');
      for (const [host, file] of [['claude', path.join(home, '.claude', 'settings.json')], ['codex', path.join(home, '.codex', 'hooks.json')]]) {
        const problem = uninstalledHostProblem(fs.readFileSync(file, 'utf8'), seeded[host].text);
        assertThat(problem === null, `${host} hook file after uninstall: ${problem}`);
      }
    },
    'compare-home': () => {
      const differences = homeDifferences(before, snapshotOf(readTree(home)));
      assertThat(differences.length === 0, `the home differs from its start: ${JSON.stringify(differences)}`);
    },
  };

  let failed = false;
  try {
    for (const name of stepsFor({ to: toVersion, local })) {
      try {
        handlers[name]();
        console.log(`PASS  ${name}`);
      } catch (err) {
        console.log(`FAIL  ${name}: ${err.message}`);
        failed = true;
        break;
      }
    }
  } finally {
    for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}

main();
