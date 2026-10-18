// The pure parts of the release proof (scripts/release-proof.mjs): its arguments, the environment of an isolated
// pnpm, the steps it runs and what each one checks, the pin it moves, and the comparison of the throwaway home.
// Nothing here starts a process or touches a file: the runner does both and hands the results in.
import path from 'node:path';
import { installPlan } from '../bin/lib/version.mjs';
import { compareSnapshots, contentHash, hostHooksProblem } from './practice-lib.mjs';
import { nextVersion } from './lib.mjs';

export class ReleaseProofArgError extends Error {}

export const USAGE = [
  'Usage: node scripts/release-proof.mjs [--repo <url or folder>] [--from <tag>] [--to <tag>] [--pm npm|pnpm] [--help]',
  '  --repo  where the tags come from: a URL or a folder. "." clones this repository into a temp folder and tags the',
  '          clone with throwaway versions (v<package version> and the next minor). Default: the GitHub repository of package.json.',
  '  --from  the release tag installed first. Default: v<package version>.',
  '  --to    the release tag `upgrade` moves to, then the pin of a project moves to it. Omitted: install and uninstall only.',
  '  --pm    npm or pnpm, the package manager that installs. Default: npm.',
  'Everything is installed into throwaway folders: never the real home, nor the real pnpm or npm folders.',
].join('\n');

const VALUED = ['--repo', '--from', '--to', '--pm'];
const TAG_RE = /^v\d+\.\d+\.\d+$/;

/** The GitHub repository of a package.json, as `git clone` takes it (its `git+` prefix dropped), or `''` when it names none. */
export function repoFromPackage(pkg) {
  return String(pkg.repository?.url ?? '').replace(/^git\+/, '');
}

/** The version of a release tag (`v0.9.0` is `0.9.0`); throws for anything that is not `v` and three numbers. */
export function tagVersion(tag) {
  if (!TAG_RE.test(tag)) throw new ReleaseProofArgError(`not a release tag: ${JSON.stringify(tag)} (v<x.y.z>)`);
  return tag.slice(1);
}

/** The arguments of the proof, with their defaults, or `{ help: true }` when `--help` or `-h` is among them.
 * Throws `ReleaseProofArgError` for an unknown flag, a value missing, a tag that is not `v<x.y.z>`, or a `--pm` that
 * is neither npm nor pnpm. */
export function parseArgs(argv, pkg) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const opts = { help: false, repo: repoFromPackage(pkg), from: `v${pkg.version}`, to: null, pm: 'npm' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!VALUED.includes(flag)) throw new ReleaseProofArgError(`unknown argument: ${flag}`);
    const value = argv[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) throw new ReleaseProofArgError(`${flag} requires a value`);
    i += 1;
    if (flag === '--repo') opts.repo = value;
    else if (flag === '--pm') {
      if (value !== 'npm' && value !== 'pnpm') throw new ReleaseProofArgError(`--pm takes npm or pnpm, not "${value}"`);
      opts.pm = value;
    } else {
      if (!TAG_RE.test(value)) throw new ReleaseProofArgError(`${flag} takes a release tag (v<x.y.z>), not "${value}"`);
      opts[flag.slice(2)] = value;
    }
  }
  return opts;
}

/** The throwaway tags of a clone of the repository at `version`: its own, and the next minor the bump commits. */
export function throwawayTags(version) {
  const next = nextVersion(version);
  return { from: `v${version}`, to: `v${next}`, nextVersion: next };
}

/** The environment of an isolated pnpm under `prefix` (`installPlan`, T2 of odd/tasks/harness-review.md): every folder pnpm
 * writes is inside it, and its bin folder is first on the path. The caller's environment is kept otherwise. */
export function isolatedPnpmEnv(prefix, env, platform) {
  return installPlan('pnpm', 'spec', prefix, env, platform).env;
}

/** The package-manager command `upgrade` runs for `--pm`: npm through this node and the real npm CLI, never a PATH
 * `npm` that may be a shim, and pnpm by its name. `upgrade` splits the command on spaces, so a path with one is refused. */
export function upgradePmCommand(kind, { execPath, npmCli }) {
  if (kind === 'pnpm') return 'pnpm';
  if (/\s/.test(execPath) || /\s/.test(npmCli)) {
    throw new Error(`${execPath} or ${npmCli} contains a space, which the --pm of upgrade cannot hold: set JS_HARNESS_E2E_NPM_CLI to an npm-cli.js in a folder without one`);
  }
  return `${execPath} ${npmCli}`;
}

/** The steps of one proof, in order. `local` is a `--repo` that is a folder of this machine, which is cloned and tagged first;
 * `to` is the release `upgrade` moves to, or `null` for an install-only proof, which sets no project up either. */
export function stepsFor({ to, local }) {
  const install = ['install-from', 'seed-home', 'install-home', 'check-from'];
  const upgrade = ['init-project', 'upgrade', 'check-to', 'move-pin', 'check-project'];
  return [...(local ? ['prepare-repo'] : []), ...install, ...(to === null ? [] : upgrade), 'uninstall', 'compare-home'];
}

/** What is wrong with the output of `--version` (one line, the version alone), or `null`. */
export function versionProblem(stdout, expected) {
  const got = String(stdout).trim();
  return got === expected ? null : `expected --version ${expected}, got "${got}"`;
}

/** What is wrong with the output of `status --global`: the installed package's version and the manifest's, each
 * as the line names it, or `null` when both are `expected`. */
export function statusProblem(stdout, expected) {
  const line = (label) => new RegExp(`^${label}: (.*)$`, 'm').exec(String(stdout))?.[1];
  for (const label of ['installed package version', 'manifest version']) {
    const got = line(label);
    if (got !== expected) return `status --global: ${label}: ${got ?? 'no such line'}, expected ${expected}`;
  }
  return null;
}

/** What is wrong with the manifest `install` writes (`<home>/.js-harness/manifest.json`), or `null`. */
export function manifestProblem(text, expected) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    return 'the manifest is not JSON';
  }
  return manifest?.version === expected ? null : `expected manifest version ${expected}, got ${manifest?.version}`;
}

/** The host files a proof seeds before `install`, each with one unrelated SessionStart hook the install must keep: the
 * Claude file in four-space indentation and the Codex file with tabs, as `scripts/e2e.mjs` seeds them. */
export function seededHostFiles() {
  const claudeCommand = 'echo unrelated-claude-hook';
  const codexCommand = 'echo unrelated-codex-hook';
  const sessionStart = (command) => ({
    matcher: 'startup|resume|clear|compact',
    hooks: [{ type: 'command', command, timeout: 5 }],
  });
  return {
    claude: { command: claudeCommand, text: `${JSON.stringify({ hooks: { SessionStart: [sessionStart(claudeCommand)] } }, null, 4)}\n` },
    codex: { command: codexCommand, text: `${JSON.stringify({ hooks: { SessionStart: [sessionStart(codexCommand)] } }, null, '\t')}\n` },
  };
}

/** What is wrong with the hook entries of the two host files after `install`, or `null`: each file must hold its seeded
 * entry and then the entries `install` writes for its host (`hostHooksProblem`). `texts` is `{ claude, codex }`. */
export function hostFilesProblem(texts, seeded) {
  for (const host of ['claude', 'codex']) {
    const problem = hostHooksProblem(texts[host], seeded[host].command, host);
    if (problem !== null) return `${host} hook file: ${problem}`;
  }
  return null;
}

/** The pin of a project (`harness.json`) moved to `version`, the rest of the file kept. Throws when the file is not JSON. */
export function movePin(text, version) {
  const data = JSON.parse(text);
  return `${JSON.stringify({ ...data, version }, null, 2)}\n`;
}

/** A snapshot of files for `homeDifferences`: each path mapped to the hash of its content, from `[path, content]` pairs. */
export function snapshotOf(entries) {
  return Object.fromEntries(entries.map(([file, content]) => [file, contentHash(content)]));
}

/** What differs between two snapshots of the throwaway home: `[{ path, change }]`, empty when it is as it was. */
export function homeDifferences(before, after) {
  return compareSnapshots(before, after);
}

/** The package roots of the pnpm copies under `prefix`, found through `listDir(dir)` (the names in a folder, empty when
 * there is none) and `exists(file)`: pnpm 12 keeps a copy at `<prefix>/global/<store>/<hash>/node_modules/js-harness`, and
 * the hash folder is absent on some layouts (the same search `upgrade` makes). */
export function copyCandidatesOf(prefix, listDir, exists) {
  const globalDir = path.join(prefix, 'global');
  const found = [];
  for (const store of listDir(globalDir)) {
    const storeDir = path.join(globalDir, store);
    for (const parent of [storeDir, ...listDir(storeDir).map((hash) => path.join(storeDir, hash))]) {
      const root = path.join(parent, 'node_modules', 'js-harness');
      if (exists(path.join(root, 'bin', 'js-harness.mjs'))) found.push(root);
    }
  }
  return found;
}

/** The root of the copy whose version is `version`, from `[{ root, version }]`, or `null` when none has it. */
export function pickCopy(copies, version) {
  return copies.find((copy) => copy.version === version)?.root ?? null;
}
