// The places a session is kept off (F8 S10, odd/tasks/f8-s10-port.md, T4 and T5): the allow entry and the 24 denies
// that `install` holds in the user's Claude settings (./permissions.mjs), and the paths
// `guard` refuses a file tool on (bin/guard.mjs). Kept apart from both, with no import, because the guard hook runs
// on every Read, Write and Edit of every session and must load nothing more than this.

/** The allow entry `install` holds: codegraph's tools run without a prompt. */
export const PERMISSIONS_ALLOW = Object.freeze(['mcp__codegraph__*']);

/** The places of a secret that `install` denies a read and an edit of (the reverse-engineering document, section 3). */
const SECRET_PLACES = ['.env', '.env.*', '.ssh/*', '.credentials/*', 'Library/Keychains/*', '.aws/credentials', '.config/gh/hosts.yml', '**/*.pem', '**/*.key', '**/secrets/*'];

/** The 24 denies `install` holds: no wipe of the root or the home, and no read or edit of a secret's places. */
export const PERMISSIONS_DENY = Object.freeze([
  'Bash(rm -rf /)', 'Bash(sudo rm -rf /)', 'Bash(rm -rf ~)', 'Bash(sudo rm -rf ~)',
  ...SECRET_PLACES.flatMap((place) => [`Read(${place})`, `Edit(${place})`]),
]);

/** The places `guard` refuses: the secrets' places, and the login Claude Code keeps in `.credentials.json`, which an
 * eval copied into a scratch home and broke his login with on 2026-10-26 (the diet's section 9). */
export const GUARDED_PLACES = Object.freeze([...SECRET_PLACES, '.credentials.json']);

/** A place as one pattern a segment, `*` standing for any characters within one; letters match in any case, as on
 * Windows. A place is matched at the end of a path from any segment on, so a leading `**` (any number of segments)
 * adds nothing and is dropped; the match then costs a fixed number of segment tests, whatever the path's length. */
function patternOf(place) {
  const segments = place.split('/');
  while (segments[0] === '**') segments.shift();
  if (segments.includes('**')) throw new Error(`${place}: "**" can only open a place`);
  return segments.map((segment) => new RegExp(`^${segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i'));
}

const PATTERNS = GUARDED_PLACES.map((place) => [place, patternOf(place)]);

/** The segments of `file` as Windows opens it, so another spelling of a guarded file is that file (T5's verifier
 * read a planted key through each): either slash; no empty or `.` segment; a `..` takes the one before it; a name
 * loses an NTFS stream (`name::$DATA`, `name:$INDEX_ALLOCATION`) and the dots and spaces Windows drops from its
 * end. A drive (`C:`) stays as it is. */
function segmentsOf(file) {
  const out = [];
  for (const raw of file.split(/[\\/]/)) {
    const named = /^[a-z]:$/i.test(raw) ? raw : raw.replace(/:.*$/s, '');
    const segment = /^\.+$/.test(named) ? named : named.replace(/[. ]+$/, '');
    if (segment === '' || segment === '.') continue;
    if (segment === '..' && out.length > 0 && out.at(-1) !== '..') out.pop();
    else out.push(segment);
  }
  return out;
}

/** Whether `patterns` match the last segments of `segments`. */
const endsWith = (segments, patterns) => patterns.length <= segments.length
  && patterns.every((pattern, index) => pattern.test(segments[segments.length - patterns.length + index]));

/** The guarded place `file` is in (`GUARDED_PLACES`), or null. */
export function deniedPlace(file) {
  if (typeof file !== 'string' || file === '') return null;
  const segments = segmentsOf(file);
  return PATTERNS.find(([, patterns]) => endsWith(segments, patterns))?.[0] ?? null;
}

/** The guarded place `file` is in, or the one of several segments a folder `file` holds files of (`.ssh` for
 * `.ssh/*`), or null: what a search of `file` and the files in it would read. */
export function heldPlace(file) {
  const place = deniedPlace(file);
  if (place !== null || typeof file !== 'string' || file === '') return place;
  const segments = segmentsOf(file);
  return PATTERNS.find(([, patterns]) => patterns.length > 1 && endsWith(segments, patterns.slice(0, -1)))?.[0] ?? null;
}
