import { ResolveError } from './errors.mjs';

const LOCKFILE_VERSION = 1;
const byName = (left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
const sortedByName = (object) => Object.fromEntries(Object.entries(object).sort(byName));

/**
 * The lockfile text of a resolution `{ packages }`: JSON with `lockfileVersion` first, then the packages
 * sorted by name; each package is `{ version, dependencies }` with its dependencies sorted by name too.
 * Two-space indent and a final newline, so the same resolution is always the same bytes.
 */
export function serializeLock({ packages }) {
  const entries = Object.entries(packages)
    .sort(byName)
    .map(([name, { version, dependencies }]) => [name, { version, dependencies: sortedByName(dependencies) }]);
  return `${JSON.stringify({ lockfileVersion: LOCKFILE_VERSION, packages: Object.fromEntries(entries) }, null, 2)}\n`;
}

/** The resolution `{ packages }` a lockfile text holds; anything that is not a lockfile is an `ELOCK` error. */
export function parseLock(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ResolveError('ELOCK', `the lockfile is not valid JSON: ${error.message}`);
  }
  if (data?.lockfileVersion !== LOCKFILE_VERSION || typeof data.packages !== 'object' || data.packages === null || Array.isArray(data.packages)) {
    throw new ResolveError('ELOCK', `the lockfile is not a version ${LOCKFILE_VERSION} lockfile`);
  }
  return { packages: data.packages };
}
