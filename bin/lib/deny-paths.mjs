// The places a session is kept off (F8 S10, odd/tasks/f8-s10-port.md, T4 and T5): the allow entry and the 24 denies
// gentle-ai writes into the user's Claude settings, which `install` holds there (./permissions.mjs), and the paths
// `guard` refuses a file tool on (bin/guard.mjs). Kept apart from both, with no import, because the guard hook runs
// on every Read, Write and Edit of every session and must load nothing more than this.

/** The allow entry gentle-ai writes: codegraph's tools run without a prompt. */
export const PERMISSIONS_ALLOW = Object.freeze(['mcp__codegraph__*']);

/** The places of a secret gentle-ai denies a read and an edit of (the reverse-engineering document, section 3). */
const SECRET_PLACES = ['.env', '.env.*', '.ssh/*', '.credentials/*', 'Library/Keychains/*', '.aws/credentials', '.config/gh/hosts.yml', '**/*.pem', '**/*.key', '**/secrets/*'];

/** The 24 denies gentle-ai writes: no wipe of the root or the home, and no read or edit of a secret's places. */
export const PERMISSIONS_DENY = Object.freeze([
  'Bash(rm -rf /)', 'Bash(sudo rm -rf /)', 'Bash(rm -rf ~)', 'Bash(sudo rm -rf ~)',
  ...SECRET_PLACES.flatMap((place) => [`Read(${place})`, `Edit(${place})`]),
]);

/** The places `guard` refuses: the secrets' places, and the login Claude Code keeps in `.credentials.json`, which an
 * eval copied into a scratch home and broke his login with on 2026-10-26 (the diet's section 9). */
export const GUARDED_PLACES = Object.freeze([...SECRET_PLACES, '.credentials.json']);

/** A place as a pattern over a path's `/`-separated segments, matched at the end of the path from any segment on:
 * `**` stands for any number of segments and `*` for any characters within one. Letters match in any case, as on
 * Windows. */
function patternOf(place) {
  const body = place.split('/').map((segment) => (segment === '**'
    ? '(?:[^/]+/)*'
    : `${segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}/`)).join('').replace(/\/$/, '');
  return new RegExp(`(?:^|/)${body}$`, 'i');
}

const PATTERNS = GUARDED_PLACES.map((place) => [place, patternOf(place)]);

/** The guarded place `file` is in (`GUARDED_PLACES`), or null. A Windows path is read with `/` for `\`. */
export function deniedPlace(file) {
  if (typeof file !== 'string' || file === '') return null;
  const normal = file.replace(/\\/g, '/');
  return PATTERNS.find(([, pattern]) => pattern.test(normal))?.[0] ?? null;
}
