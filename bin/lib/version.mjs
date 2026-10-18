// Pure version-comparison and command-construction helpers. Directory listing is the one
// filesystem read here, kept simple and injectable via its `dir` argument.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TARBALL_RE = /^js-harness-(\d+\.\d+\.\d+)\.tgz$/;

/** Compares two "x.y.z" versions. Returns -1, 0, or 1. No pre-release/build metadata support. */
export function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

/** True when `candidate` is strictly newer than `current`. */
export function isNewer(candidate, current) {
  return compareSemver(candidate, current) > 0;
}

/** How a machine gets the newest copy, in words for a message: from the default branch, which is where a copy
 * ahead of the newest tag comes from, and the only source where a repository holds no release tag
 * (docs/ROADMAP.md, "Versioning"), so `upgrade` has no release to install and says this instead. It names npm, with the
 * option npm 12 needs to fetch from git, and pnpm: a copy that pnpm installed is not the one npm would replace. */
export const INSTALL_NEWEST = 'npm i -g --allow-git=root github:jsaristi/js-harness, or pnpm add -g github:jsaristi/js-harness where pnpm installed it';

/** The repository whose tags are the releases (docs/ROADMAP.md, "Release source"): public since 2026-10-16, read
 * with the machine's git. */
export const DEFAULT_REPO = 'https://github.com/jsaristi/js-harness.git';

/** A release tag: `v` and three numbers, nothing else, so a tag that reaches an install's argv carries no flag. */
const RELEASE_TAG_RE = /^refs\/tags\/(v(\d+\.\d+\.\d+))$/;

/** The highest release tag in the output of `git ls-remote --tags`, as `{ version, tag }`, or null when it holds
 * none. A line that is not a release tag (a pre-release, a tag with no `v`, a peeled `^{}` line, a branch) is
 * ignored. */
export function latestTag(listing) {
  let best = null;
  for (const line of listing.split(/\r?\n/)) {
    const match = RELEASE_TAG_RE.exec(line.split('\t')[1] ?? '');
    if (!match) continue;
    if (!best || compareSemver(match[2], best.version) > 0) best = { version: match[2], tag: match[1] };
  }
  return best;
}

/** An scp-style SSH address (`git@github.com:owner/repo.git`): a remote with no scheme, which is not a folder. */
const SCP_ADDRESS_RE = /^[\w.-]+@[\w.-]+:(?!\/\/)/;

/** What a package manager installs for `tag` of `repo`: the GitHub shorthand for the default repository, as the
 * roadmap writes it, and `git+<url>` for any other: an scp-style SSH address under `ssh://` (npm keeps its colon),
 * a folder as a file URL. */
export function tagSpec(repo, tag) {
  if (repo === DEFAULT_REPO) return `github:jsaristi/js-harness#${tag}`;
  if (SCP_ADDRESS_RE.test(repo)) return `git+ssh://${repo}#${tag}`;
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(repo) ? repo : pathToFileURL(path.resolve(repo)).href;
  return `git+${url}#${tag}`;
}

/** Whether a spec `tagSpec` could have made: one a package manager fetches with git, not a tarball's path. */
export function isGitSpec(spec) {
  return /^(github:|git\+|git:\/\/)/.test(spec);
}

/** Extracts the version out of a `js-harness-<semver>.tgz` (an `npm pack` output name), or null. */
export function parseTarballVersion(filename) {
  const m = TARBALL_RE.exec(filename);
  return m ? m[1] : null;
}

/** Picks the highest-version tarball out of a list of filenames, or null if none match. */
export function pickLatestTarball(filenames) {
  let best = null;
  for (const file of filenames) {
    const version = parseTarballVersion(file);
    if (!version) continue;
    if (!best || compareSemver(version, best.version) > 0) best = { version, file };
  }
  return best;
}

/** Reads a directory of `npm pack` tarballs and returns the highest version found, or null. */
export function latestFromSource(dir) {
  const best = pickLatestTarball(fs.readdirSync(dir));
  return best ? { version: best.version, file: path.join(dir, best.file) } : null;
}

/** Splits an injectable package-manager command string ("npm", "node cli.js") into argv. */
export function splitCommand(pm) {
  return pm.trim().split(/\s+/);
}

/** Which package manager a command's words name: `pnpm` when one word is pnpm itself (`pnpm`, `pnpm.exe`,
 * `node .../pnpm.cjs`), else `npm`, whose arguments every other command is given. */
export function pmKind(words) {
  return words.some((word) => /(^|[\\/])pnpm(\.exe|\.cmd|\.c?js)?$/i.test(word)) ? 'pnpm' : 'npm';
}

/** The install of `spec` by a package manager of `kind`, as `{ args, env }`. npm takes `install -g <spec>` and an
 * optional `--prefix`. pnpm takes `add -g <spec>` (on pnpm 12 `install -g` does the same; `add` is the verb every
 * pnpm version documents) and has no `--prefix`: a prefix becomes its home. pnpm 12 reads its folders from
 * `pnpm_config_*`, not `npm_config_*`, and a `global-bin-dir` in the user's own config wins over `PNPM_HOME`, so
 * every folder it writes is named inside the prefix and its bin folder goes first on the path, which pnpm requires
 * of a global bin folder (T2 of odd/tasks/harness-review.md, L7). */
export function installPlan(kind, spec, prefix, env, platform) {
  if (kind !== 'pnpm') {
    // npm 12 refuses a package fetched from git unless `allow-git` says otherwise; `root` lets in the one git
    // package named here and none among its dependencies (it has none). An older npm warns of an unknown option.
    const args = isGitSpec(spec) ? ['install', '-g', '--allow-git=root', spec] : ['install', '-g', spec];
    return { args: prefix ? [...args, '--prefix', prefix] : args, env };
  }
  const args = ['add', '-g', spec];
  if (!prefix) return { args, env };
  const bin = path.join(prefix, 'bin');
  // Windows names the variable `Path`, and its lookup ignores case: the key already there is the one extended.
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
  const delimiter = platform === 'win32' ? ';' : ':';
  return {
    args,
    env: {
      ...env,
      PNPM_HOME: prefix,
      pnpm_config_global_bin_dir: bin,
      pnpm_config_global_dir: path.join(prefix, 'global'),
      pnpm_config_store_dir: path.join(prefix, 'store'),
      pnpm_config_cache_dir: path.join(prefix, 'cache'),
      pnpm_config_state_dir: path.join(prefix, 'state'),
      [pathKey]: env[pathKey] ? `${bin}${delimiter}${env[pathKey]}` : bin,
    },
  };
}
