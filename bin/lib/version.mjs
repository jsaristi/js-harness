// Pure version-comparison and command-construction helpers. Directory listing is the one
// filesystem read here, kept simple and injectable via its `dir` argument.
import fs from 'node:fs';
import path from 'node:path';

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
 * version is tagged or published before 1.0.0 (docs/ROADMAP.md, "Release source"), so `upgrade` finds
 * nothing. It names npm and says the rest: a copy that pnpm installed is not the one npm would replace. */
export const INSTALL_NEWEST = 'npm i -g github:jsaristi/js-harness, or the same with the package manager that installed it';

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

/** Builds argv for `<pm> view <pkg> version`. */
export function viewArgs(pkgName) {
  return ['view', pkgName, 'version'];
}

/** Builds argv for `<pm> install -g <spec>`, with an optional `--prefix`. */
export function installArgs(spec, prefix) {
  const args = ['install', '-g', spec];
  if (prefix) args.push('--prefix', prefix);
  return args;
}
