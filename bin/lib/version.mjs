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

/** How a machine gets the newest copy today, in words for a message: from the default branch, since no
 * version is tagged or published before 1.0.0 (docs/ROADMAP.md, "Release source"), so `upgrade` has no
 * release to install and says this instead. It names npm and says the rest: a copy that pnpm installed is
 * not the one npm would replace. */
export const INSTALL_NEWEST = 'npm i -g github:jsaristi/js-harness, or the same with the package manager that installed it';

/** The repository whose tags are the releases (docs/ROADMAP.md, "Release source"): private, read with the git
 * credentials already on the machine. */
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

/** Builds argv for `<pm> install -g <spec>`, with an optional `--prefix`. */
export function installArgs(spec, prefix) {
  const args = ['install', '-g', spec];
  if (prefix) args.push('--prefix', prefix);
  return args;
}
