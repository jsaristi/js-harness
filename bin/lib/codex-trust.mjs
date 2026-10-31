// Codex's trust of the hooks of a hooks.json, as its config.toml records it (odd/tasks/codex-hook-trust.md). Codex CLI
// 0.163.0 runs no hook without a record, and keys each by the hook's place, not by what it runs:
// `[hooks.state.'<hooks.json>:<event_snake>:<group>:<handler>']` holding `trusted_hash`, the group being the entry's
// index in the event's list and the handler the hook's index in the entry (B4 of the launch audit). The hash is a sha256
// of a form internal to Codex, so nothing here can write one: this module reads the records and, for `uninstall`, drops
// or renumbers them, line by line, so every other byte of the file stays as the user had it. No TOML library: only the
// table headers are read, their keys quoted or not, and hook trust spelled any other way (keys in a `[hooks.state]`
// table, dotted keys, an inline table) is refused with `TrustFormError` instead of guessed at. Codex 0.166 writes an
// empty `[hooks.state]` table before the trust tables; with no key in it, it is read and kept as written.
import fs from 'node:fs';
import path from 'node:path';
import { deepEqual } from './json-equal.mjs';

/** A config.toml that holds hook trust in a form this module does not read. */
export class TrustFormError extends Error {}

/** A hooks.json event name as Codex writes it in a key: `SessionStart` is `session_start`. */
export const snakeEvent = (event) => event.replace(/(?<=[a-z0-9])([A-Z])/g, '_$1').toLowerCase();

// A key's place: `<hooks.json>:<event>:<group>:<handler>`, the path itself holding colons on Windows.
const PLACE = /^(.*):([a-z_]+):(\d+):(\d+)$/;

/** A basic string's body with its escapes read: only `\\` and `\"`, the two a path can need. Any other escape is
 * refused rather than read wrong. */
function unescapeBasic(body) {
  return body.replace(/\\(.)/g, (whole, char) => {
    if (char === '\\' || char === '"') return char;
    throw new TrustFormError(`a trust key with the escape ${whole}`);
  });
}

/** A path as compared here: resolved, and without case on Windows, where Codex and the harness may spell it apart. */
function samePath(a, b, platform) {
  const [x, y] = [path.resolve(a), path.resolve(b)];
  return platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** `list`, config.toml paths, with `config` added unless it holds it already as `samePath` compares them: each file
 * is edited once, since a second edit would move again the keys the first one moved. */
export function withConfig(list, config, platform = process.platform) {
  return list.some((known) => samePath(known, config, platform)) ? list : [...list, config];
}

/** The keys of a table header line, `[a."b".'c']`: `{ array, keys }`, each key `{ name, end, basic }`, its name as
 * written between its quotes (`basic` says a basic string's escapes are still in it) and `end` where that spelling
 * ends in the line. `null` for a line that is no header this reads. */
function headerKeys(line) {
  let i = line.search(/\S/);
  const array = line.startsWith('[[', i);
  i += array ? 2 : 1;
  const keys = [];
  for (;;) {
    while (line[i] === ' ' || line[i] === '\t') i += 1;
    const quote = line[i];
    if (quote === '"' || quote === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== quote) j += quote === '"' && line[j] === '\\' ? 2 : 1;
      if (j >= line.length) return null;
      keys.push({ name: line.slice(i + 1, j), end: j, basic: quote === '"' });
      i = j + 1;
    } else {
      const bare = /^[A-Za-z0-9_-]+/.exec(line.slice(i));
      if (!bare) return null;
      keys.push({ name: bare[0], end: i + bare[0].length, basic: false });
      i += bare[0].length;
    }
    while (line[i] === ' ' || line[i] === '\t') i += 1;
    if (line[i] === '.') {
      i += 1;
      continue;
    }
    const close = array ? ']]' : ']';
    if (!line.startsWith(close, i)) return null;
    return /^\s*(?:#.*)?$/.test(line.slice(i + close.length)) ? { array, keys } : null;
  }
}

/** Where a line leaves a value that spans lines, from where the line before left it: `open` the multi-line string it
 * is inside (`"""`, `'''` or null), `depth` how deep inside arrays. One scan of strings, comments and brackets, so a
 * quote or a bracket inside a string or a comment opens nothing. */
function scanLine(line, { open, depth }) {
  let i = 0;
  while (i < line.length) {
    if (open) {
      if (open === '"""' && line[i] === '\\') {
        i += 2;
      } else if (line.startsWith(open, i)) {
        // Up to two quotes of the string's own can sit against its closing three.
        while (line[i] === open[0]) i += 1;
        open = null;
      } else {
        i += 1;
      }
      continue;
    }
    const char = line[i];
    if (char === '#') break;
    if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
      open = line.slice(i, i + 3);
      i += 3;
    } else if (char === '"' || char === "'") {
      i += 1;
      while (i < line.length && line[i] !== char) i += char === '"' && line[i] === '\\' ? 2 : 1;
      i += 1;
    } else {
      if (char === '[') depth += 1;
      if (char === ']') depth = Math.max(0, depth - 1);
      i += 1;
    }
  }
  return { open, depth };
}

/** The lines of `text`, each with its own line ending, sorted into tables: `{ lines, header, place, keyEnd }` per
 * table, the first one being what comes before any header (`header` null). `place` is `{ hooksPath, event, group,
 * handler }` for a trust table, with `keyEnd` where its key ends in the header, and `null` for any other. The lines of
 * a value that spans lines stay in the table that opened it, and hook trust in any form but a trust table's header
 * throws `TrustFormError`. */
function tables(text) {
  const found = [{ header: null, place: null, lines: [] }];
  let state = { open: null, depth: 0 };
  let table = 'root';
  for (const line of text.split(/(?<=\n)/)) {
    const current = found[found.length - 1];
    const bare = line.replace(/\r?\n$/, '');
    const outside = !state.open && state.depth === 0;
    if (outside && /^\s*\[/.test(bare)) {
      const head = headerKeys(bare);
      const names = head?.keys.map((key) => key.name) ?? [];
      const underState = names[0] === 'hooks' && names[1] === 'state';
      // Codex 0.166 writes an empty `[hooks.state]` before the trust tables: read, as long as no key follows it.
      const stateTable = underState && names.length === 2 && !head.array;
      if (underState && !stateTable && (names.length !== 3 || head.array)) throw new TrustFormError('hook trust in a nested table or an array of tables');
      const key = underState ? head.keys[2] : null;
      const place = key && PLACE.exec(key.basic ? unescapeBasic(key.name) : key.name);
      table = names.length === 1 && names[0] === 'hooks' && !head.array ? 'hooks' : stateTable ? 'state' : 'other';
      found.push({ header: line, lines: [], keyEnd: place ? key.end : null, place: place && { hooksPath: place[1], event: place[2], group: Number(place[3]), handler: Number(place[4]) } });
      continue;
    }
    if (outside && table === 'state' && /^\s*[^\s#]/.test(bare)) throw new TrustFormError('a [hooks.state] table with keys');
    if (outside && ((table === 'root' && /^\s*["']?hooks["']?\s*[.=]/.test(bare) && /state/.test(bare)) || (table === 'hooks' && /^\s*["']?state["']?\s*[.=]/.test(bare)))) {
      throw new TrustFormError('hook trust in dotted keys or an inline table');
    }
    current.lines.push(line);
    state = scanLine(bare, state);
  }
  return found;
}

const hasHash = (table) => table.lines.some((line) => /^\s*trusted_hash\s*=/.test(line));

/** The places of `hooksPath` that `text`, a config.toml, holds a trusted hash for, as `event:group:handler`. Throws
 * `TrustFormError` for hook trust in a form it does not read. */
export function trustedPlaces(text, hooksPath, platform = process.platform) {
  const places = new Set();
  for (const table of tables(text)) {
    const { place } = table;
    if (place && samePath(place.hooksPath, hooksPath, platform) && hasHash(table)) places.add(`${place.event}:${place.group}:${place.handler}`);
  }
  return places;
}

/** The lines a dropped table leaves: the comments just above the next header, which are that table's. */
function keptComments(lines) {
  let from = lines.length;
  while (from > 0 && /^\s*#/.test(lines[from - 1])) from -= 1;
  return lines.slice(from);
}

/** `text`, a config.toml, with the trust of `hooksPath` moved as `moves` says: by snake-case event, the new index of
 * each group, or -1 for one that is gone. A gone group's tables are dropped, a moved group's are renamed to the new
 * index with their hash, and every other byte is kept, the tables of another hooks.json and of a place `moves` does not
 * name among them. Returns `{ text, dropped, moved }`, the counts of tables. Throws `TrustFormError` as `trustedPlaces`
 * does, before anything is changed. */
export function moveTrust(text, hooksPath, moves, platform = process.platform) {
  const out = [];
  let dropped = 0;
  let moved = 0;
  for (const table of tables(text)) {
    const { place } = table;
    const to = place && samePath(place.hooksPath, hooksPath, platform) ? moves[place.event]?.[place.group] : undefined;
    if (to === -1) {
      dropped += 1;
      out.push(...keptComments(table.lines));
      continue;
    }
    if (to !== undefined && to !== place.group) {
      // The key's own end, so a comment after the header that repeats it is left as written.
      const at = table.keyEnd - `:${place.event}:${place.group}:${place.handler}`.length;
      out.push(`${table.header.slice(0, at)}:${place.event}:${to}:${place.handler}${table.header.slice(table.keyEnd)}`, ...table.lines);
      moved += 1;
      continue;
    }
    if (table.header !== null) out.push(table.header);
    out.push(...table.lines);
  }
  return { text: out.join(''), dropped, moved };
}

/** Where each of `records` (manifest entry records of one hook file) is in `data`, that file's JSON, as `uninstall`
 * finds it (`removeEntryFromFile`): the first deep-equal entry of the list at its pointer that no earlier record took.
 * Returns `{ record, event, group }` for each record found, `event` being the pointer's last key and `group` the
 * entry's index in that list. A skipped record, or one whose entry is not there, has none. */
export function entryPlaces(data, records) {
  const taken = new Set();
  const places = [];
  for (const record of records) {
    if (record.skipped || !Array.isArray(record.pointer)) continue;
    let list = data;
    for (const key of record.pointer) list = list !== null && typeof list === 'object' ? list[key] : undefined;
    if (!Array.isArray(list)) continue;
    const event = record.pointer[record.pointer.length - 1];
    const group = list.findIndex((item, i) => !taken.has(`${event}\n${i}`) && deepEqual(item, record.entry));
    if (group === -1) continue;
    taken.add(`${event}\n${group}`);
    places.push({ record, event, group });
  }
  return places;
}

/** Where every group of each event of `data`, a hooks.json, goes once the entries at `places` (`entryPlaces`) are out:
 * its new index, or -1, by snake-case event, the way Codex keys a hook's trust. */
function groupMoves(data, places) {
  const moves = {};
  const hooks = data?.hooks !== null && typeof data?.hooks === 'object' ? data.hooks : {};
  for (const [event, list] of Object.entries(hooks)) {
    if (!Array.isArray(list)) continue;
    const gone = new Set(places.filter((place) => place.event === event).map((place) => place.group));
    let next = 0;
    moves[snakeEvent(event)] = list.map((_, i) => (gone.has(i) ? -1 : next++));
  }
  return moves;
}

/** The trust edits that taking the entries of `removing` out makes in Codex's config.toml (`uninstall` takes them all,
 * `sync` those no longer shipped), planned before an entry is taken out, since the places are those of the hooks.json
 * as it is now: one per hooks.json and config.toml its records name (`trustConfigs`, every one an install recorded),
 * with where each of its groups goes. A hooks.json that cannot be read, or holds none of the entries, has none: nothing
 * of it is removed, so no key moves. `earlier`, `{ hooksPath, config }`, is for an install older than `trustConfigs`
 * (0.96.0 and before, c7af39e2): a record of that hooks.json naming none has its trust in that config.toml, today's. */
export function planTrustMoves(removing, earlier = null, platform = process.platform) {
  const plans = [];
  removing = removing.map((entry) => (!entry.trustConfigs?.length && earlier && samePath(entry.path, earlier.hooksPath, platform)
    ? { ...entry, trustConfigs: [earlier.config] }
    : entry));
  for (const hooksPath of new Set(removing.filter((entry) => entry.trustConfigs?.length).map((entry) => entry.path))) {
    const records = removing.filter((entry) => entry.path === hooksPath);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    } catch {
      continue;
    }
    const places = entryPlaces(data, records);
    if (places.length === 0) continue;
    const moves = groupMoves(data, places);
    const configs = records.flatMap((entry) => entry.trustConfigs ?? []).reduce((list, config) => withConfig(list, config), []);
    for (const config of configs) plans.push({ hooksPath, config, moves });
  }
  return plans;
}

/** Makes the trust edits of `plans` (`planTrustMoves`), once the entries are out: `trustMoved` says, per config.toml
 * changed, how many tables were dropped and moved; `trustKept` says why one was left as it was: a form of hook trust
 * `moveTrust` does not read, or the error that stopped the read or the write. A config.toml that is not there, or holds
 * no trust of the file, is left alone and not named. */
export function moveTrustRecords(plans, writeFile = fs.writeFileSync) {
  const trustMoved = [];
  const trustKept = [];
  for (const { hooksPath, config, moves } of plans) {
    try {
      const text = fs.readFileSync(config, 'utf8');
      const result = moveTrust(text, hooksPath, moves);
      if (result.dropped === 0 && result.moved === 0) continue;
      writeFile(config, result.text, 'utf8');
      trustMoved.push({ path: config, dropped: result.dropped, moved: result.moved });
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      trustKept.push({ path: config, hooksPath, why: err instanceof TrustFormError ? `it holds ${err.message}, which the harness does not edit` : err.code ?? err.message });
    }
  }
  return { trustMoved, trustKept };
}
