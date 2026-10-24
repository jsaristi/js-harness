// Codex's trust of the hooks of a hooks.json, as its config.toml records it (odd/tasks/codex-hook-trust.md). Codex CLI
// 0.163.0 runs no hook without a record, and keys each by the hook's place, not by what it runs:
// `[hooks.state.'<hooks.json>:<event_snake>:<group>:<handler>']` holding `trusted_hash`, the group being the entry's
// index in the event's list and the handler the hook's index in the entry (B4 of the launch audit). The hash is a sha256
// of a form internal to Codex, so nothing here can write one: this module reads the records and, for `uninstall`, drops
// or renumbers them, line by line, so every other byte of the file stays as the user had it. No TOML library: only the
// table headers Codex writes are read, and hook trust spelled any other way (a `[hooks.state]` table, dotted keys, an
// inline table) is refused with `TrustFormError` instead of guessed at.
import fs from 'node:fs';
import path from 'node:path';
import { deepEqual } from './json-equal.mjs';

/** A config.toml that holds hook trust in a form this module does not read. */
export class TrustFormError extends Error {}

/** A hooks.json event name as Codex writes it in a key: `SessionStart` is `session_start`. */
export const snakeEvent = (event) => event.replace(/(?<=[a-z0-9])([A-Z])/g, '_$1').toLowerCase();

// A header of a trust table: `[hooks.state.'<key>']`, the key a literal string, or a basic one in double quotes.
const TRUST_HEADER = /^\s*\[\s*hooks\s*\.\s*state\s*\.\s*(?:'([^'\r\n]*)'|"((?:[^"\\\r\n]|\\.)*)")\s*\]\s*(?:#.*)?$/;
// Any other table header, an array of tables included.
const HEADER = /^\s*\[/;
// The bare name a table header or a key line starts with, for the forms that are refused.
const HOOKS_TABLE = /^\s*\[\s*hooks\s*\]\s*(?:#.*)?$/;
const HOOKS_STATE_TABLE = /^\s*\[\s*hooks\s*\.\s*state\s*\]\s*(?:#.*)?$/;
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

/** The lines of `text`, each with its own line ending, sorted into tables: `{ lines, header, place }` per table, the
 * first one being what comes before any header (`header` null). `place` is `{ hooksPath, event, group, handler }` for
 * a trust table and `null` for any other. A multi-line string's lines stay in the table that opened it, and hook trust
 * in any form but a trust table's header throws `TrustFormError`. */
function tables(text) {
  const found = [{ header: null, place: null, lines: [] }];
  let open = null;
  // How deep the line is inside an array a value opened on an earlier line: its lines are values, never headers.
  let depth = 0;
  let table = 'root';
  for (const line of text.split(/(?<=\n)/)) {
    const current = found[found.length - 1];
    const bare = line.replace(/\r?\n$/, '');
    if (open) {
      current.lines.push(line);
      if (bare.split(open).length % 2 === 0) open = null;
      continue;
    }
    if (depth === 0 && HEADER.test(bare)) {
      if (HOOKS_STATE_TABLE.test(bare)) throw new TrustFormError('a [hooks.state] table');
      const trust = TRUST_HEADER.exec(bare);
      const key = trust ? trust[1] ?? unescapeBasic(trust[2]) : null;
      const place = key === null ? null : PLACE.exec(key);
      table = HOOKS_TABLE.test(bare) ? 'hooks' : 'other';
      found.push({ header: line, lines: [], place: place && { hooksPath: place[1], event: place[2], group: Number(place[3]), handler: Number(place[4]) } });
      continue;
    }
    if (depth === 0 && ((table === 'root' && /^\s*["']?hooks["']?\s*[.=]/.test(bare) && /state/.test(bare)) || (table === 'hooks' && /^\s*["']?state["']?\s*[.=]/.test(bare)))) {
      throw new TrustFormError('hook trust in dotted keys or an inline table');
    }
    current.lines.push(line);
    for (const quote of ['"""', "'''"]) {
      if (bare.split(quote).length % 2 === 0) open = quote;
    }
    if (!open) {
      const code = bare.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '').replace(/#.*$/, '');
      depth = Math.max(0, depth + (code.match(/\[/g)?.length ?? 0) - (code.match(/\]/g)?.length ?? 0));
    }
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
      const old = `:${place.event}:${place.group}:${place.handler}`;
      const at = table.header.lastIndexOf(old);
      out.push(`${table.header.slice(0, at)}:${place.event}:${to}:${place.handler}${table.header.slice(at + old.length)}`, ...table.lines);
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
 * as it is now: one per hooks.json whose records name the config.toml install recorded (`trustConfig`), with where
 * each of its groups goes. A hooks.json that cannot be read, or holds none of the entries, has none: nothing of it is
 * removed, so no key moves. */
export function planTrustMoves(removing) {
  const plans = [];
  for (const hooksPath of new Set(removing.filter((entry) => entry.trustConfig).map((entry) => entry.path))) {
    const records = removing.filter((entry) => entry.path === hooksPath);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    } catch {
      continue;
    }
    const places = entryPlaces(data, records);
    if (places.length === 0) continue;
    plans.push({ hooksPath, config: records.find((entry) => entry.trustConfig).trustConfig, moves: groupMoves(data, places) });
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
