// Ranges follow npm's syntax: a set of comparators joined by spaces, sets joined by `||`.
//   exact          1.2.3  =1.2.3          x-ranges   1.x  1.2.x  1.2  1  *
//   caret          ^1.2.3                 tilde      ~1.2.3  ~1.2
//   comparators    >=1.2.3  >1.2.3  <=1.2.3  <1.2.3  (`>` and `<=` need a full version)
//   hyphen         1.2.3 - 2.3.4
// A version with a prerelease satisfies a set only if one of its comparators names a prerelease of the same
// major.minor.patch, so `^1.2.3` never matches `1.3.0-beta` while `>=1.3.0-alpha` does.
import { compare, parse } from './semver.mjs';

const PARTIAL = /^(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?$/;
const TESTS = {
  '=': (order) => order === 0,
  '>=': (order) => order >= 0,
  '>': (order) => order > 0,
  '<=': (order) => order <= 0,
  '<': (order) => order < 0,
};

const version = (major, minor, patch, prerelease = []) => ({ major, minor, patch, prerelease });

/** Reads `1`, `1.2`, `1.2.3-beta.1`, `1.x` or `*` into the numbers it gives and its prerelease, if any. */
function partial(text) {
  const match = PARTIAL.exec(text);
  if (!match) throw new TypeError(`invalid range "${text}"`);
  const parts = [];
  for (const part of match.slice(1, 4)) {
    if (part === undefined || /[xX*]/.test(part)) break;
    parts.push(Number(part));
  }
  return { parts, prerelease: match[4]?.split('.') ?? [] };
}

/** The lowest version the partial stands for: missing numbers are zero. */
function floor({ parts, prerelease }) {
  const [major = 0, minor = 0, patch = 0] = parts;
  return version(major, minor, patch, prerelease);
}

/** The first version after everything that starts with `parts[0..index]`, the zeroth prerelease: `1.2` at 1 is `1.3.0-0`. */
function bump(parts, index) {
  const [major = 0, minor = 0, patch = 0] = parts.map((part, at) => (at === index ? part + 1 : part)).slice(0, index + 1);
  return version(major, minor, patch, ['0']);
}

const ceiling = ({ parts }) => bump(parts, parts.length - 1);

/** The comparators a single `operator version` token stands for. */
function comparators(operator, text) {
  const given = partial(text);
  const { parts } = given;
  if (parts.length === 0) return [['>=', version(0, 0, 0)]];
  if (operator === '^' || operator === '~') {
    const firstNonZero = parts.findIndex((part) => part !== 0);
    const index = operator === '~' ? Math.min(1, parts.length - 1) : firstNonZero === -1 ? parts.length - 1 : firstNonZero;
    return [['>=', floor(given)], ['<', bump(parts, index)]];
  }
  if (operator === '>=' || operator === '<') return [[operator, floor(given)]];
  if (parts.length < 3) {
    if (operator !== '' && operator !== '=') throw new TypeError(`"${operator}" needs a full version, got "${text}"`);
    return [['>=', floor(given)], ['<', ceiling(given)]];
  }
  return [[operator === '' ? '=' : operator, floor(given)]];
}

/** The comparators of one set: a hyphen range, or tokens like `^1.2.3` or `<2`. */
function parseSet(set) {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(set);
  if (hyphen) {
    const upper = partial(hyphen[2]);
    return [['>=', floor(partial(hyphen[1]))], ...(upper.parts.length === 3 ? [['<=', floor(upper)]] : upper.parts.length > 0 ? [['<', ceiling(upper)]] : [])];
  }
  const tokens = set.replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1').split(/\s+/);
  return tokens.flatMap((token) => {
    const [, operator, text] = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(token);
    return comparators(operator ?? '', text);
  });
}

function allowsPrerelease(candidate, set) {
  if (candidate.prerelease.length === 0) return true;
  return set.some(([, bound]) => bound.prerelease.length > 0 && bound.major === candidate.major && bound.minor === candidate.minor && bound.patch === candidate.patch);
}

/** Whether the version `text` is in `range`. A range that cannot be read is a `TypeError`. */
export function satisfies(text, range) {
  const candidate = parse(text);
  return range.split('||').some((alternative) => {
    const set = parseSet(alternative.trim() === '' ? '*' : alternative.trim());
    return set.every(([operator, bound]) => TESTS[operator](compare(candidate, bound))) && allowsPrerelease(candidate, set);
  });
}
