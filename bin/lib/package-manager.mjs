// The package manager as js-harness starts it: on Windows through one cmd.exe line (`runPm`), and read from where the
// running copy lies when nothing names it (`copyPackageManager`). Shared by `upgrade` (bin/update.mjs) and the full
// uninstall (bin/install.mjs), which must both reach the manager that installed this copy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pmKind, splitCommand } from './version.mjs';

/** Quotes a value for a shell command line built by joining tokens with spaces (see `shell: true`
 * in `child_process.spawn`, which does not escape array elements on its own). Simple, not
 * bulletproof: assumes the value has no embedded quote of its own platform's kind. */
export function quoteForShell(value, platform) {
  return platform === 'win32' ? `"${value}"` : `'${value.replace(/'/g, "'\\''")}'`;
}

/** A word for a cmd.exe line: as it is when it holds nothing cmd.exe reads, else quoted. A `.cmd` file found on the
 * path and named in quotes gets a wrong `%~dp0`, the folder pnpm's own shim starts from ("El sistema no puede
 * encontrar la ruta especificada", T2), so a plain command name is never quoted. Quotes do not keep cmd.exe from
 * expanding `%NAME%`, and a `"` ends them, so `upgradeMain` refuses a word holding either before it runs. */
export function cmdWord(word) {
  return /^[\w@+=:,./\\-]+$/.test(word) ? word : quoteForShell(word, 'win32');
}

/** Starts the package manager. On Windows `npm` and `pnpm` are often `.cmd` files, which Node starts only through a
 * shell, so there it runs as one line, with no argument array beside `shell: true` (Node's DEP0190). `env` is
 * passed only when the install needs its own (pnpm's isolated home); otherwise the child inherits. */
export function runPm(spawn, words, args, env, platform) {
  const opts = env ? { encoding: 'utf8', env } : { encoding: 'utf8' };
  if (platform === 'win32') {
    return spawn([...words, ...args].map(cmdWord).join(' '), [], { ...opts, shell: true });
  }
  const [cmd, ...head] = words;
  return spawn(cmd, [...head, ...args], opts);
}

/** A copy in pnpm's global folder, `<pnpm home>/global/v<n>/...` (`<pnpm home>/global/<n>/...` before pnpm 11, where
 * the home is a folder named pnpm, so another `global/2024` folder is no such copy), as Node resolves it with links
 * followed: through `node_modules/.pnpm/js-harness@<source>/node_modules/js-harness` for one installed from GitHub. */
const PNPM_GLOBAL_COPY = /[\\/](?:global[\\/]v\d+|pnpm[\\/]global[\\/]\d+)[\\/](?:.*[\\/])?node_modules[\\/]js-harness[\\/]/i;

/** The package manager that installed the copy whose file is `copyPath`: pnpm for one in pnpm's global folder, else
 * npm (release-095 S3). */
export function copyPackageManager(copyPath) {
  return PNPM_GLOBAL_COPY.test(copyPath) ? 'pnpm' : 'npm';
}

/** pnpm's global folder (`.../global`) that holds the copy whose file is `copyPath`, or `null` for a copy pnpm's global
 * folder does not hold. `pnpm remove -g` acts on its configured one unless told this one. */
export function pnpmGlobalDirOf(copyPath) {
  const found = PNPM_GLOBAL_COPY.exec(copyPath);
  if (!found) return null;
  return copyPath.slice(0, found.index) + found[0].match(/^[\\/](?:pnpm[\\/])?global/i)[0];
}

/** The package folder of the installed copy whose file is `copyPath` (`.../node_modules/js-harness`), or `null` for a
 * copy no package manager installed, such as a checkout of the repository. */
export function installedPackageRoot(copyPath) {
  const parts = path.normalize(copyPath).split(path.sep);
  for (let i = parts.length - 2; i > 0; i -= 1) {
    if (parts[i] === 'js-harness' && parts[i - 1] === 'node_modules') return parts.slice(0, i + 1).join(path.sep);
  }
  return null;
}

/** The global prefix npm installed the package at `root` under: the folder above `node_modules` on Windows, above
 * `lib/node_modules` elsewhere. */
export function npmPrefixOf(root) {
  const modules = path.dirname(root);
  const above = path.dirname(modules);
  return path.basename(above) === 'lib' ? path.dirname(above) : above;
}

/** Where the npm CLI beside the node at `execPath` lives: `<node dir>/node_modules/npm/bin/npm-cli.js` on Windows, under
 * `<prefix>/lib/node_modules` elsewhere. The one place this is worked out; `scripts/lib.mjs` reads it from here. */
export function npmCliPath(execPath = process.execPath, platform = process.platform) {
  const nodeDir = path.dirname(execPath);
  const modules = platform === 'win32' ? path.join(nodeDir, 'node_modules') : path.join(path.dirname(nodeDir), 'lib', 'node_modules');
  return path.join(modules, 'npm', 'bin', 'npm-cli.js');
}

/** The npm CLI beside the node that runs js-harness (`npmCliPath`), or `null` where that file is not there. Run through
 * this node it bypasses a PATH `npm` that may be a shim, as pnpm's is on a machine where pnpm installed js-harness
 * (behavior.md, B3). */
export function npmCliOf(execPath = process.execPath, platform = process.platform, exists = fs.existsSync) {
  const cli = npmCliPath(execPath, platform);
  return exists(cli) ? cli : null;
}

/** The project whose dependency the copy whose file is `copyPath` is, or `null` for a global install; asked of a copy
 * outside pnpm's global folder. The project is the folder above its first `node_modules`: a pnpm project's copy lies
 * in `node_modules/.pnpm/...`, and a project, or npx's cache, keeps a package.json there; a global prefix keeps none. */
export function dependentProjectOf(copyPath, existsSync) {
  const parts = path.normalize(copyPath).split(path.sep);
  const first = parts.indexOf('node_modules');
  if (first <= 0) return null;
  const above = parts.slice(0, first).join(path.sep);
  return parts[first + 1] === '.pnpm' || existsSync(path.join(above, 'package.json')) ? above : null;
}

/** A word as it is when a shell reads nothing in it, else quoted for `platform`: how a command is shown to be run by
 * hand. */
export function shownWord(word, platform) {
  if (platform === 'win32') return cmdWord(word);
  return /^[\w@+=:,./-]+$/.test(word) ? word : quoteForShell(word, platform);
}

/** The checkout folder a copy no package manager installed runs from: the folder above its `bin`. */
export function checkoutOf(copyPath) {
  const dir = path.dirname(path.normalize(copyPath));
  return path.basename(dir) === 'bin' ? path.dirname(dir) : dir;
}

/** The package manager of the installs, resolved as `upgrade` resolves it: `--pm`, else `JS_HARNESS_PM`, else the one
 * that installed the running copy. Never read from the word `npm` on the path, which may run pnpm (odd/tasks/stack-install.md, D6).
 * A command line is split into its words, unless the whole line names a file: a path with a space in it stays one word
 * (Codex on 12e46c4..6a2b0ad). `exists` is the seam that looks. */
export function resolveStackPm(pm, env, copyPath = fileURLToPath(import.meta.url), exists = fs.existsSync) {
  const command = pm ?? env.JS_HARNESS_PM ?? copyPackageManager(copyPath);
  const line = command.trim();
  const words = /\s/.test(line) && exists(line) ? [line] : splitCommand(line);
  return { words, kind: pmKind(words) };
}
