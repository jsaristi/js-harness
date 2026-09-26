// Helpers shared by scripts/e2e.mjs and scripts/sandbox.mjs: resolving the real npm CLI (PATH
// `npm` may be a shim), staging a repo copy so version bumps never touch the real package.json,
// and small tmp-dir helpers. Kept here so both scripts stay in sync instead of drifting apart.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The real npm CLI, bypassing a PATH `npm` that may be a shim (on this machine, pnpm's). */
export function resolveNpmCli(env = process.env) {
  return (
    env.JS_HARNESS_E2E_NPM_CLI ??
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  );
}

export function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

/** Runs the resolved npm CLI directly through this same node, never through a PATH `npm`. */
export function npm(npmCli, args, opts = {}) {
  return run(process.execPath, [npmCli, ...args], opts);
}

export function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Copies the repo into a staging dir so version bumps never touch the real package.json. */
export function copyRepoToStaging(dest, repoRoot = REPO_ROOT) {
  fs.cpSync(repoRoot, dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(repoRoot, src);
      return rel !== '.git' && !rel.startsWith(`.git${path.sep}`) && !rel.startsWith('node_modules');
    },
  });
}

export function bumpVersion(dir, version) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return pkg;
}
