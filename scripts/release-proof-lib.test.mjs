// The pure parts of the release proof (scripts/release-proof.mjs): its arguments, the environment of an isolated
// pnpm, the steps it runs and what each one checks, the pin it moves, and the comparison of the throwaway home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  ReleaseProofArgError,
  USAGE,
  copyCandidatesOf,
  homeDifferences,
  hostFilesProblem,
  installProblem,
  isolatedPnpmEnv,
  manifestProblem,
  movePin,
  parseArgs,
  pickCopy,
  repoFromPackage,
  seededHostFiles,
  snapshotOf,
  stepsFor,
  statusProblem,
  tagVersion,
  throwawayTags,
  upgradePmCommand,
  versionProblem,
  EARLIER_CODEX_HOOKS,
  codexHooksOf,
} from './release-proof-lib.mjs';
import { hooksOfHost } from './practice-lib.mjs';
import { EARLIER_CODEX_ENTRIES } from '../bin/lib/earlier-codex.testkit.mjs';

const PKG = { version: '0.1.0', repository: { type: 'git', url: 'git+https://github.com/jsaristi/js-harness.git' } };

test('the default repository is the GitHub repository of package.json, without its git+ prefix', () => {
  assert.equal(repoFromPackage(PKG), 'https://github.com/jsaristi/js-harness.git');
  assert.equal(repoFromPackage({ version: '0.1.0' }), '');
});

test('parseArgs takes the defaults: the package repository, its own tag as --from, no --to, npm', () => {
  assert.deepEqual(parseArgs([], PKG), {
    help: false,
    repo: 'https://github.com/jsaristi/js-harness.git',
    from: 'v0.1.0',
    to: null,
    pm: 'npm',
  });
});

test('parseArgs reads --repo, --from, --to and --pm', () => {
  assert.deepEqual(parseArgs(['--repo', '.', '--from', 'v0.9.0', '--to', 'v1.0.0', '--pm', 'pnpm'], PKG), {
    help: false,
    repo: '.',
    from: 'v0.9.0',
    to: 'v1.0.0',
    pm: 'pnpm',
  });
});

// T10's verifier (2026-10-18): the Done-when lines run `--repo .` with no `--to`, which proved no upgrade, and
// `npm run release-proof -- ...` through this machine's npm, a pnpm shim, passes the `--` on to the script.
test('parseArgs gives --repo . the throwaway tag of the bump as --to, so a local proof always upgrades', () => {
  assert.equal(parseArgs(['--repo', '.'], PKG).to, 'v0.2.0');
  assert.equal(parseArgs(['--repo', '.', '--to', 'v0.2.0'], PKG).to, 'v0.2.0');
  assert.equal(parseArgs(['--repo', 'https://example.test/x.git'], PKG).to, null);
});

test('parseArgs skips the -- a package manager passes on before the flags', () => {
  assert.deepEqual(parseArgs(['--', '--repo', '.', '--pm', 'pnpm'], PKG), parseArgs(['--repo', '.', '--pm', 'pnpm'], PKG));
  assert.throws(() => parseArgs(['--repo', '.', '--'], PKG), /unknown argument: --/);
});

test('parseArgs answers --help, alone or with other flags, and the usage names every flag', () => {
  assert.deepEqual(parseArgs(['--help'], PKG), { help: true });
  assert.deepEqual(parseArgs(['--repo', '.', '-h'], PKG), { help: true });
  for (const flag of ['--repo', '--from', '--to', '--pm', '--help']) assert.match(USAGE, new RegExp(flag));
});

test('parseArgs refuses an unknown flag, a missing value, a tag without v, and a pm that is neither npm nor pnpm', () => {
  assert.throws(() => parseArgs(['--tag', 'v1.0.0'], PKG), ReleaseProofArgError);
  assert.throws(() => parseArgs(['--from'], PKG), /--from requires a value/);
  assert.throws(() => parseArgs(['--from', '--to', 'v1.0.0'], PKG), /--from requires a value/);
  assert.throws(() => parseArgs(['--from', '0.9.0'], PKG), /--from takes a release tag \(v<x\.y\.z>\), not "0\.9\.0"/);
  assert.throws(() => parseArgs(['--to', 'v1.0.0-rc.1'], PKG), /--to takes a release tag/);
  assert.throws(() => parseArgs(['--pm', 'yarn'], PKG), /--pm takes npm or pnpm, not "yarn"/);
});

test('tagVersion is the version of a release tag, and refuses anything else', () => {
  assert.equal(tagVersion('v0.9.0'), '0.9.0');
  assert.throws(() => tagVersion('0.9.0'), ReleaseProofArgError);
  assert.throws(() => tagVersion('v1.0'), ReleaseProofArgError);
});

test('throwawayTags names the package version and the next minor, which the bump gets', () => {
  assert.deepEqual(throwawayTags('0.1.0'), { from: 'v0.1.0', to: 'v0.2.0', nextVersion: '0.2.0' });
  assert.deepEqual(throwawayTags('0.9.3'), { from: 'v0.9.3', to: 'v0.10.0', nextVersion: '0.10.0' });
});

test('an isolated pnpm keeps every folder it writes inside its prefix and puts that bin folder first on the path', () => {
  const prefix = path.join('T', 'prefix');
  const env = isolatedPnpmEnv(prefix, { Path: 'C:\\Windows', npm_config_global_bin_dir: 'C:\\real' }, 'win32');
  const bin = path.join(prefix, 'bin');
  assert.equal(env.PNPM_HOME, prefix);
  assert.equal(env.pnpm_config_global_bin_dir, bin);
  assert.equal(env.pnpm_config_global_dir, path.join(prefix, 'global'));
  assert.equal(env.pnpm_config_store_dir, path.join(prefix, 'store'));
  assert.equal(env.pnpm_config_cache_dir, path.join(prefix, 'cache'));
  assert.equal(env.pnpm_config_state_dir, path.join(prefix, 'state'));
  assert.equal(env.Path, `${bin};C:\\Windows`, 'the Windows key already in the environment is the one extended');
  assert.equal(env.PATH, undefined);
  assert.equal(env.npm_config_global_bin_dir, 'C:\\real', 'the caller environment is passed through unchanged');
});

test('upgradePmCommand names the real npm CLI through this node, and pnpm by its own name', () => {
  const execPath = 'C:\\nvm4w\\nodejs\\node.exe';
  const npmCli = 'C:\\nvm4w\\nodejs\\node_modules\\npm\\bin\\npm-cli.js';
  assert.equal(upgradePmCommand('npm', { execPath, npmCli }), `${execPath} ${npmCli}`);
  assert.equal(upgradePmCommand('pnpm', { execPath, npmCli }), 'pnpm');
  // The upgrade splits its --pm on spaces, so a path with one could not be given to it.
  assert.throws(() => upgradePmCommand('npm', { execPath: 'C:\\Program Files\\nodejs\\node.exe', npmCli }), /contains a space/);
});

test('stepsFor lists the steps of an install-only proof, and adds the project and the upgrade when --to is given', () => {
  const install = ['install-from', 'seed-home', 'install-home', 'check-from'];
  assert.deepEqual(stepsFor({ to: null, local: false }), [...install, 'uninstall', 'compare-home']);
  assert.deepEqual(stepsFor({ to: null, local: true }), ['prepare-repo', ...install, 'uninstall', 'compare-home']);
  assert.deepEqual(stepsFor({ to: 'v1.0.0', local: false }), [
    ...install,
    'init-project',
    'upgrade',
    'check-to',
    'move-pin',
    'check-project',
    'uninstall',
    'compare-home',
  ]);
});

test('installProblem judges an install by the copy it left, as upgrade does: a copy of the version passes whatever the exit', () => {
  // pnpm on Windows can install the version and then exit 1 when its cleanup hits os error 32 (L7 of odd/tasks/harness-review.md).
  assert.equal(installProblem({ status: 1 }, '0.9.0\n', '0.9.0', 'pnpm install of v0.9.0'), null);
  assert.equal(installProblem({ status: 0 }, '0.9.0', '0.9.0', 'pnpm install of v0.9.0'), null);
  assert.equal(
    installProblem({ status: 1 }, '', '0.9.0', 'pnpm install of v0.9.0'),
    'pnpm install of v0.9.0 exited 1, and no copy answers 0.9.0',
  );
  assert.equal(
    installProblem({ status: null, error: { code: 'ENOENT' } }, '', '0.9.0', 'pnpm install of v0.9.0'),
    'pnpm install of v0.9.0 exited ENOENT, and no copy answers 0.9.0',
  );
  assert.equal(
    installProblem({ status: 0 }, '0.8.0', '0.9.0', 'pnpm install of v0.9.0'),
    'pnpm install of v0.9.0 exited 0, but the copy answers "0.8.0", not 0.9.0',
  );
});

test('versionProblem passes a copy that answers its version alone, and names both versions when it does not', () => {
  assert.equal(versionProblem('0.9.0\n', '0.9.0'), null);
  assert.match(versionProblem('0.8.0\n', '0.9.0'), /expected --version 0\.9\.0, got "0\.8\.0"/);
});

test('statusProblem reads the installed and manifest versions of status --global, and names the first that differs', () => {
  const good = 'installed package version: 0.9.0\nmanifest version: 0.9.0\nlatest available: 1.0.0\n';
  assert.equal(statusProblem(good, '0.9.0'), null);
  assert.match(statusProblem(good.replace('manifest version: 0.9.0', 'manifest version: (not installed)'), '0.9.0'), /manifest version: \(not installed\), expected 0\.9\.0/);
  assert.match(statusProblem(good.replace('installed package version: 0.9.0', 'installed package version: 0.8.0'), '0.9.0'), /installed package version: 0\.8\.0, expected 0\.9\.0/);
});

test('manifestProblem reads the version of the manifest written by install', () => {
  assert.equal(manifestProblem(JSON.stringify({ version: '0.9.0' }), '0.9.0'), null);
  assert.match(manifestProblem(JSON.stringify({ version: '0.8.0' }), '0.9.0'), /expected manifest version 0\.9\.0, got 0\.8\.0/);
  assert.match(manifestProblem('not json', '0.9.0'), /manifest/);
});

test('the seeded host files hold one unrelated hook each, and hostFilesProblem names what install has not written yet', () => {
  const seeded = seededHostFiles();
  assert.equal(JSON.parse(seeded.claude.text).hooks.SessionStart[0].hooks[0].command, seeded.claude.command);
  assert.equal(JSON.parse(seeded.codex.text).hooks.SessionStart[0].hooks[0].command, seeded.codex.command);
  assert.notEqual(hostFilesProblem({ claude: seeded.claude.text, codex: seeded.codex.text }, seeded), null);
});

// The seeded host file `text` with `hooks` grafted on it in their order, each at the end of its event's list, as install grafts them.
function grafted(text, hooks) {
  const data = JSON.parse(text);
  for (const hook of hooks) {
    data.hooks[hook.event] ??= [];
    data.hooks[hook.event].push({ ...(hook.matcher === undefined ? {} : { matcher: hook.matcher }), hooks: [{ type: 'command', command: hook.command, timeout: 5 }] });
  }
  return JSON.stringify(data, null, 4);
}

test('EARLIER_CODEX_HOOKS are the entries 0.97.0 grafted on the Codex hooks file, in its order', () => {
  const declared = EARLIER_CODEX_ENTRIES.map((component) => {
    const entry = component.entry();
    const hook = { event: component.pointer.at(-1), command: entry.hooks.map((item) => item.command).join(' && ') };
    return entry.matcher === undefined ? hook : { ...hook, matcher: entry.matcher };
  });
  assert.deepEqual(EARLIER_CODEX_HOOKS.map((hook) => ({ ...hook })), declared);
  assert.ok(Object.isFrozen(EARLIER_CODEX_HOOKS));
});

test('codexHooksOf expects the earlier Codex entries only of a release tag at 0.97.0 or older, never of this checkout', () => {
  for (const version of ['0.97.0', '0.96.0', '0.9.0']) assert.equal(codexHooksOf(version, false), EARLIER_CODEX_HOOKS, version);
  for (const version of ['0.97.1', '0.98.0', '1.0.0', '0.100.0']) assert.deepEqual(codexHooksOf(version, false), [], version);
  // A local proof tags a clone of this checkout with its own version, whatever that reads.
  assert.deepEqual(codexHooksOf('0.97.0', true), []);
});

test('hostFilesProblem holds the Codex file to what the release wrote there: nothing from this one, its entries from an earlier one', () => {
  const seeded = seededHostFiles();
  const claude = grafted(seeded.claude.text, hooksOfHost('claude'));
  const earlier = grafted(seeded.codex.text, EARLIER_CODEX_HOOKS);
  assert.equal(hostFilesProblem({ claude, codex: seeded.codex.text }, seeded, []), null);
  assert.equal(hostFilesProblem({ claude, codex: earlier }, seeded, EARLIER_CODEX_HOOKS), null);
  // An earlier install's entries left after this release's sync, and an earlier release that wrote none.
  assert.match(hostFilesProblem({ claude, codex: earlier }, seeded, []), /^codex hook file: expected the seeded entry "echo unrelated-codex-hook"; found: /);
  assert.match(hostFilesProblem({ claude, codex: seeded.codex.text }, seeded, EARLIER_CODEX_HOOKS), /^codex hook file: expected the seeded entry "echo unrelated-codex-hook", then "js-harness doctor --hook"/);
  // Its Stop entries left when its SessionStart ones went.
  const stopsLeft = grafted(seeded.codex.text, EARLIER_CODEX_HOOKS.filter((hook) => hook.event === 'Stop'));
  assert.match(hostFilesProblem({ claude, codex: stopsLeft }, seeded, []), /^codex hook file: expected no entry of the harness in hooks\.Stop of codex; found: /);
  // The Claude file is held to today's entries whatever the release.
  assert.match(hostFilesProblem({ claude: seeded.claude.text, codex: seeded.codex.text }, seeded, []), /^claude hook file: /);
});

test('movePin sets the version a harness.json pins and keeps the rest of the file', () => {
  const moved = JSON.parse(movePin(JSON.stringify({ version: '0.9.0', other: true }), '1.0.0'));
  assert.deepEqual(moved, { version: '1.0.0', other: true });
  assert.throws(() => movePin('not json', '1.0.0'));
});

test('homeDifferences is empty when the throwaway home is as it was, and names each file that differs', () => {
  const before = snapshotOf([['.claude/settings.json', '{}']]);
  assert.deepEqual(homeDifferences(before, snapshotOf([['.claude/settings.json', '{}']])), []);
  assert.deepEqual(homeDifferences(before, snapshotOf([['.claude/settings.json', '{}'], ['.js-harness/manifest.json', '{}']])), [
    { path: '.js-harness/manifest.json', change: 'appeared' },
  ]);
  assert.deepEqual(homeDifferences(before, snapshotOf([['.claude/settings.json', '{"x":1}']])), [
    { path: '.claude/settings.json', change: 'changed' },
  ]);
});

test('copyCandidatesOf finds the pnpm copies under a prefix, both where the store is and in its hash folder', () => {
  const prefix = path.join('P', 'prefix');
  const global = path.join(prefix, 'global');
  const tree = {
    [global]: ['v11'],
    [path.join(global, 'v11')]: ['hash1'],
  };
  const listDir = (dir) => tree[dir] ?? [];
  const copy = path.join(global, 'v11', 'hash1', 'node_modules', 'js-harness');
  const exists = (file) => file === path.join(copy, 'bin', 'js-harness.mjs');
  assert.deepEqual(copyCandidatesOf(prefix, listDir, exists), [copy]);
  assert.deepEqual(copyCandidatesOf(path.join('P', 'empty'), listDir, exists), []);
});

test('pickCopy takes the copy of the version it is asked for, and none when no copy has it', () => {
  const copies = [
    { root: 'a', version: '0.8.0' },
    { root: 'b', version: '0.9.0' },
  ];
  assert.equal(pickCopy(copies, '0.9.0'), 'b');
  assert.equal(pickCopy(copies, '1.0.0'), null);
});
