// The package manager as js-harness starts it: on Windows through one cmd.exe line (`runPm`), and read from where the
// running copy lies when nothing names it (`copyPackageManager`). Shared by `upgrade` (bin/update.mjs) and the full
// uninstall (bin/install.mjs), which must both reach the manager that installed this copy.
import path from 'node:path';

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

/** A copy in pnpm's global folder, `<pnpm home>/global/v<n>/...`, as Node resolves it with links followed: through
 * `node_modules/.pnpm/js-harness@<source>/node_modules/js-harness` for one installed from GitHub. */
const PNPM_GLOBAL_COPY = /[\\/]global[\\/]v\d+[\\/](?:.*[\\/])?node_modules[\\/]js-harness[\\/]/i;

/** The package manager that installed the copy whose file is `copyPath`: pnpm for one in pnpm's global folder, else
 * npm (release-095 S3). */
export function copyPackageManager(copyPath) {
  return PNPM_GLOBAL_COPY.test(copyPath) ? 'pnpm' : 'npm';
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

/** The checkout folder a copy no package manager installed runs from: the folder above its `bin`. */
export function checkoutOf(copyPath) {
  const dir = path.dirname(path.normalize(copyPath));
  return path.basename(dir) === 'bin' ? path.dirname(dir) : dir;
}
