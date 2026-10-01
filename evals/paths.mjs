// Path helpers shared by the sandbox modules (`home.mjs`, `configs.mjs`). Zero deps, plain Node.
import fs from 'node:fs';
import path from 'node:path';

/** Whether anything is at `target`, a link (even a dangling one) included. */
export const exists = (target) => fs.lstatSync(target, { throwIfNoEntry: false }) !== undefined;

/** `target` as the file system resolves it: its deepest existing ancestor through `realpathSync` (so a
 * junction or symlink anywhere on the way is followed), with the part that does not exist yet put back
 * on. A path may be spelled many ways, a link among them, and only the resolved one says where a write
 * would land. A link that exists but cannot be resolved (dangling) is an error: nothing about where it
 * leads can be said. */
export function resolveReal(target) {
  let existing = path.resolve(target);
  const missing = [];
  while (!exists(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  let real;
  try {
    real = fs.realpathSync(existing);
  } catch (err) {
    throw new Error(`cannot resolve ${existing}: ${err.message}`);
  }
  return path.join(real, ...missing);
}

/** Whether `child` is `parent` or below it, by path components: `..templates` is a name, and only a
 * first component of exactly `..` leaves the parent. Case-insensitive on Windows, because `path.relative` is there. Both are resolved
 * absolute paths (`resolveReal`). */
export function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return !(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative));
}
