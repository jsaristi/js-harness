// Versions are `major.minor.patch` with an optional prerelease, as in `1.4.0` or `2.0.0-rc.1`. Build
// metadata is not supported.
const IDENTIFIER = String.raw`(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)`;
const VERSION = new RegExp(String.raw`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(${IDENTIFIER}(?:\.${IDENTIFIER})*))?$`);
const NUMERIC = /^\d+$/;

/** Reads a version into `{ major, minor, patch, prerelease }`, `prerelease` being the list of its identifiers. */
export function parse(text) {
  const match = VERSION.exec(text);
  if (!match) throw new TypeError(`invalid version "${text}"`);
  const [, major, minor, patch, prerelease] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch), prerelease: prerelease ? prerelease.split('.') : [] };
}

function compareIdentifier(a, b) {
  const numericA = NUMERIC.test(a);
  if (numericA !== NUMERIC.test(b)) return numericA ? -1 : 1;
  if (numericA) return Math.sign(Number(a) - Number(b));
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function comparePrerelease(a, b) {
  if (a.length === 0 || b.length === 0) return Math.sign(b.length - a.length);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const order = compareIdentifier(a[index], b[index]);
    if (order !== 0) return order;
  }
  return Math.sign(a.length - b.length);
}

/**
 * Orders two versions, given as strings or as the result of `parse`: -1, 0 or 1. A prerelease is lower than
 * its release, and prereleases compare identifier by identifier, numbers below words.
 */
export function compare(a, b) {
  const left = typeof a === 'string' ? parse(a) : a;
  const right = typeof b === 'string' ? parse(b) : b;
  return Math.sign(left.major - right.major) || Math.sign(left.minor - right.minor) || Math.sign(left.patch - right.patch) || comparePrerelease(left.prerelease, right.prerelease);
}
