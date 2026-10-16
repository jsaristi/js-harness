// The line scanner of Codex's `config.toml`, shared by the template (`evals/codex-home.mjs`) and the arms of one
// component (`evals/without.mjs`): this repository has no TOML parser (zero deps), so the file is edited as text
// by a scan that refuses any line it cannot read for certain. Zero deps, plain Node.

const KEY_PART = /\s*(?:([A-Za-z0-9_-]+)|"((?:[^"\\]|\\.)*)"|'([^']*)')\s*/y;
const ESCAPES = { '"': '"', '\\': '\\', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

/** The text a TOML basic string spells with `raw` between its quotes, or `null` when it holds an escape TOML
 * does not define. A key is compared as TOML reads it, because `"eng\u0072am"` is `engram` to Codex. */
function unescapeBasic(raw) {
  let known = true;
  const text = raw.replace(/\\(?:(["\\bfnrt])|u([0-9A-Fa-f]{4})|U([0-9A-Fa-f]{8})|([\s\S]))/g, (match, simple, short, long) => {
    if (simple) return ESCAPES[simple];
    const code = short || long ? Number.parseInt(short ?? long, 16) : -1;
    if (code >= 0 && code <= 0x10ffff) return String.fromCodePoint(code);
    known = false;
    return '';
  });
  return known ? text : null;
}

/** The dotted TOML key of `line` that starts at `from` (`a.b`, `a."b c"`, `a . 'b'`), as `{ parts, end }`
 * with `end` the index after it, or `null` when no key that can be read starts there. */
function dottedKey(line, from) {
  const parts = [];
  let index = from;
  for (;;) {
    KEY_PART.lastIndex = index;
    const part = KEY_PART.exec(line);
    const name = part && (part[1] ?? (part[2] === undefined ? part[3] : unescapeBasic(part[2])));
    if (name === null || name === undefined) return null;
    parts.push(name);
    index = KEY_PART.lastIndex;
    if (line[index] !== '.') return { parts, end: index };
    index += 1;
  }
}

export const startsWith = (list, prefix) => prefix.every((part, index) => list[index] === part);
const NOTHING_MORE = /^\s*(#.*)?\s*$/;

/** Whether a TOML value that starts on this line also ends on it, for certain: every string closed, every
 * bracket and brace paired, no multi-line string, and something there. Strings go first, then the comment,
 * so a bracket or a quote inside either is not counted. */
function endsOnItsLine(value) {
  if (/"""|'''/.test(value)) return false;
  const bare = value.trim().replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, 's').replace(/#.*$/, '').trim();
  if (bare === '' || /["']/.test(bare)) return false;
  return bare.split('[').length === bare.split(']').length && bare.split('{').length === bare.split('}').length;
}

/** Classifies `lines`, the lines of a `config.toml` (with or without their line endings), for the edits
 * below. For each: `header`, the dotted key of the `[table]` or `[[array of tables]]` header it is, else
 * `null`; `array`; `table`, the table the line is in, a header's own included (`[null]` inside an array of
 * tables: some other table, of no interest here); and `key`, `{ parts, rest }` for a `key = rest` line.
 *
 * This scan is a safety filter, not a TOML parser: it keeps the desktop app and the real engram store out
 * of a trial, so it FAILS CLOSED. A line is a blank, a comment, a header alone on its line, or a key whose
 * value ends on the same line; anything else throws, naming the line. A value that runs over several lines
 * is the case that matters: inside it nothing says what is a header and what is data, so a table could end
 * early and the rest of it be written back, or a key be missed. It is refused wherever it is, because a
 * scan that could tell which tables it may ignore would be the parser this is not. */
export function* scanToml(lines) {
  const unreadable = (number, why) => new Error(`config.toml line ${number} ${why}. This harness edits the file as text, to keep the desktop app and the real engram store out of a trial, so it refuses what it cannot read for certain: write every table header alone on its line and every value on one line`);
  let table = [];
  let number = 0;
  for (const text of lines) {
    number += 1;
    if (NOTHING_MORE.test(text)) {
      yield { text, table, header: null, array: false, key: null };
      continue;
    }
    const lead = text.length - text.trimStart().length;
    if (text[lead] === '[') {
      const array = text[lead + 1] === '[';
      const close = array ? ']]' : ']';
      const parsed = dottedKey(text, lead + close.length);
      if (!parsed || !text.startsWith(close, parsed.end) || !NOTHING_MORE.test(text.slice(parsed.end + close.length))) throw unreadable(number, 'starts with a bracket and is not a table header this scan can read');
      table = array ? [null] : parsed.parts;
      yield { text, table, header: parsed.parts, array, key: null };
      continue;
    }
    const parsed = dottedKey(text, lead);
    if (!parsed || text[parsed.end] !== '=') throw unreadable(number, 'is neither a table header, a key with its value, a comment nor a blank line');
    const rest = text.slice(parsed.end + 1);
    if (!endsOnItsLine(rest)) throw unreadable(number, 'holds a value that does not end on that line');
    yield { text, table, header: null, array: false, key: { parts: parsed.parts, rest } };
  }
}

/** The `config.toml` text `toml` without the tables of `tables` (each a dotted-key prefix: its sub-tables go with
 * it, and so do the blank lines and comments up to the next header) and without each top-level key for which
 * `keys(name, rest)` is true, its line endings kept. A spelling that would hide a piece from this cut throws
 * `refuse(how)`: one of the tables as an array of tables, reached through dotted keys or an inline table, or a
 * key that is an inline table one of them could be in. */
export function withoutTables(toml, { keys = () => false, tables, refuse }) {
  const under = (parts) => tables.find((prefix) => startsWith(parts, prefix));
  const out = [];
  for (const { text, table, header, array, key } of scanToml(toml.split(/(?<=\n)/))) {
    if (header) {
      if (!under(header)) out.push(text);
      else if (array) throw refuse(`declares ${header.join('.')} as an array of tables`);
      continue;
    }
    if (under(table)) continue;
    if (key) {
      const full = [...table, ...key.parts];
      if (full.length === 1 && keys(full[0], key.rest)) continue;
      const hit = under(full);
      if (hit) throw refuse(`declares ${hit.join('.')} through an inline table or dotted keys`);
      if (tables.some((prefix) => prefix.length > full.length && startsWith(prefix, full))) throw refuse(`declares ${full.join('.')} as an inline table, where a piece could be`);
    }
    out.push(text);
  }
  return out.join('');
}
