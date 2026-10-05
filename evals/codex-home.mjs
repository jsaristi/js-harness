// The Codex home of a trial: the login every arm needs, and the current arm's copy of the machine's real
// Codex setup, frozen once into a template and copied into every trial's sandbox home. Zero deps, plain
// Node. It follows `home.mjs` (the same three rules: a copy list, copies only, frozen) and reuses its
// machinery; what differs is what Codex keeps where. The plan is `odd/tasks/codex-parity.md` (T2).
//
//  - The login is a FILE, `auth.json`, not an environment variable. It is copied byte for byte into the
//    trial's own `CODEX_HOME` and nothing here opens it; it never enters the template, which outlives a trial.
//  - `config.toml` is TOML and this repository has no parser for it (zero deps), so it is handled as text:
//    a path into the real `.codex` becomes a placeholder, and the engram server's env is set by a line scan
//    that refuses any shape it cannot rewrite safely.
import fs from 'node:fs';
import path from 'node:path';
import {
  PAYLOAD, buildInto, copyEntry, countRealHome, initWorkspace, inventory, isDirectory, readTemplate, removeTemplate, requireAbsolute, sealTemplate,
} from './home.mjs';
import { exists } from './paths.mjs';
import { assertTrialPort } from './ports.mjs';

/** What the marker of a Codex template says it is: a kind of its own, so `home.mjs` never seeds a Claude
 * home from it, and nothing here seeds a Codex home from a Claude template. */
export const CODEX_TEMPLATE_KIND = 'js-harness-eval-codex-home-template';
const CODEX_TEMPLATE = { kind: CODEX_TEMPLATE_KIND, label: 'js-harness eval Codex home template' };

/** The `CODEX_HOME` of the home directory `home`. */
export const codexHomeOf = (home) => path.join(home, '.codex');

// ---- the login -----------------------------------------------------------------------------------------

const LOGIN = 'auth.json';

/** Throws unless `authFile`, an absolute path, is a file: the message names the command that makes one. */
export function assertLogin(authFile) {
  requireAbsolute('Codex login file', authFile);
  if (fs.statSync(authFile, { throwIfNoEntry: false })?.isFile() !== true) {
    throw new Error(`there is no Codex login at ${authFile}: run \`codex login\` first, then start the run again`);
  }
}

/** How old a ChatGPT login is when Codex refreshes it in place: about eight days. An ASSUMPTION about Codex,
 * not read from the source of 0.159.1. What was observed here: the real `auth.json` kept its 2026-09-27 date
 * through four real runs on 2026-10-04, so a login under eight days old is used as it is. */
export const LOGIN_REFRESH_AFTER_HOURS = 192;
/** The oldest login a run may copy: six hours short of that, the room a run needs to end before the refresh. */
export const DEFAULT_MAX_LOGIN_AGE_HOURS = LOGIN_REFRESH_AFTER_HOURS - 6;

/** Throws unless the login `authFile` was last written less than `maxAgeHours` before `now` (milliseconds);
 * returns `{ ageHours }`. Why: once a login is that old Codex refreshes it, and a refresh made by a trial
 * rewrites the trial's COPY and may leave the real login invalid, which a run must not risk for a
 * measurement (`odd/tasks/codex-parity.md`, Constraints). The age is the file's date and nothing else: the
 * login is never opened. That date is when the file was last written, ASSUMED to be its last refresh; a file
 * restored or touched since then looks younger than its login is. */
export function assertLoginFresh(authFile, { maxAgeHours = DEFAULT_MAX_LOGIN_AGE_HOURS, now = Date.now() } = {}) {
  if (typeof maxAgeHours !== 'number' || !(maxAgeHours > 0)) throw new Error(`the oldest login allowed must be a positive number of hours, got ${JSON.stringify(maxAgeHours)}`);
  assertLogin(authFile);
  const ageHours = (now - fs.statSync(authFile).mtimeMs) / 3_600_000;
  if (ageHours > maxAgeHours) {
    throw new Error(`the Codex login at ${authFile} was last written ${ageHours.toFixed(1)} hours ago, over the ${maxAgeHours} hours allowed: Codex refreshes a ChatGPT login in place once it is about eight days (${LOGIN_REFRESH_AFTER_HOURS} hours) old, and a refresh made inside a trial's copy may leave the real login invalid. Use the real Codex once, so that it refreshes its own login, then run again`);
  }
  return { ageHours };
}

/** Where the login of the trial home `home` goes; an error when that is `authFile` itself, because a
 * "trial home" that is the real one would have its login overwritten here and deleted at cleanup. */
function loginTarget({ authFile, home }) {
  requireAbsolute('home', home);
  const target = path.join(codexHomeOf(home), LOGIN);
  if (path.relative(path.resolve(authFile), target) === '') throw new Error(`the trial home ${home} is the home the Codex login lives in: a trial never runs on the real one`);
  return target;
}

/** Copies the login `authFile` into the trial home's `CODEX_HOME`, byte for byte (`copyFileSync`: the content
 * never passes through this process as text, so it cannot reach a log), and returns where it went. The real
 * file is only read. Codex refreshes a login in place, so a trial may rewrite its copy; whether the real one
 * stays valid after that is UNVERIFIED until the real trials (`odd/tasks/codex-parity.md`, Constraints). */
export function copyLogin({ authFile, home }) {
  assertLogin(authFile);
  const target = loginTarget({ authFile, home });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(authFile, target);
  return target;
}

/** Deletes the trial home's copy of the login. The runner removes the whole home after a trial, but a
 * directory a leftover process holds can outlive it, and a credential must not wait there to be noticed. */
export function removeLogin({ authFile, home }) {
  fs.rmSync(loginTarget({ authFile, home }), { force: true });
}

// ---- real paths in config files ------------------------------------------------------------------------

// What is taken from `<real home>/.codex/`, as the real home held it on 2026-10-04: the config, the global
// instructions, the hooks, the two files `config.toml` names for engram, and the skills. One pattern adds
// the scripts a hook runs from the home itself.
// Left behind by not being listed: `auth.json`, every `*.sqlite*`, `sessions/`, `cache/`, `.tmp/`,
// `.sandbox/`, `app-server-*`, `.codex-global-state.json*`, `*.bak`, and whatever Codex adds tomorrow. Also
// the profiles `-p <name>` layers over the config (`<name>.config.toml`): no trial passes `-p`, so they are
// not part of what a trial loads, and a copy would go through neither `withoutDesktopApp` nor
// `withEngramEnv`, which only `config.toml` gets. Whoever makes a trial use a profile has to edit it first.
const CODEX_ITEMS = ['config.toml', 'AGENTS.md', 'hooks.json', 'engram-instructions.md', 'engram-compact-prompt.md', 'skills'];
const HOOK_SCRIPT = /\.(ps1|sh)$/;
// Of `plugins/` only the cache: it holds what a session loads of a plugin (its manifest, hooks, skills).
// `plugins/.plugin-appserver` is the desktop app's own binaries (425 MB of the directory's 505 MB on this
// machine, none of them a plugin) and `.remote-plugin-install-staging` is scratch.
const PLUGIN_CACHE = ['plugins', 'cache'];
const CONFIG = '.codex/config.toml';
// The copied files whose paths are rewritten: the JSON and TOML ones, wherever they are, because those are
// what Codex parses for paths. Besides `config.toml` and `hooks.json` that is a plugin's `.mcp.json`, which on
// this machine sets `CODEX_HOME` for the MCP server it declares. Everything else is copied as it is, and
// reported when it names the real home.
const isRewritten = (file) => file.startsWith('.codex/') && /\.(json|toml)$/.test(file);

// A path into the real `.codex` becomes one of three placeholders, by how the file spells its separators,
// so the trial's path can be written back the same way: a TOML basic string and a JSON string double each
// backslash, a TOML literal string keeps it, and a tool may have written `/`.
const STYLES = { '\\\\': 'escaped', '\\': 'plain', '/': 'slash' };
const token = (style) => `@@TRIAL_CODEX_HOME:${style}@@`;
const SEPARATOR = String.raw`(\\\\|\\|/)`;
const NAME_CHAR = String.raw`[\w.-]`;

/** Matches `<realHome>/.codex` in any of the three spellings (case-insensitive on Windows), as a whole
 * path: `.codex-old` and `Person2` are other names. Each separator is captured; the first one is the style. */
function codexPattern(realHome) {
  const segments = [...realHome.replace(/[\\/]+$/, '').split(/[\\/]+/), '.codex'];
  const source = segments.map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(SEPARATOR);
  return new RegExp(`(?<!${NAME_CHAR})${source}(?!${NAME_CHAR})`, process.platform === 'win32' ? 'gi' : 'g');
}

const tokenize = (text, realHome) => text.replace(codexPattern(realHome), (match, first) => token(STYLES[first]));

/** `text` with every placeholder swapped for `codexHome`, spelled the way the placeholder records. */
function untokenize(text, codexHome) {
  const spelled = { plain: codexHome, escaped: JSON.stringify(codexHome).slice(1, -1), slash: codexHome.replaceAll('\\', '/') };
  return Object.entries(spelled).reduce((result, [style, value]) => result.replaceAll(token(style), () => value), text);
}

/** The placeholders of `text` that are followed by a path the template's `.codex` (`codexDir`) does not
 * hold, as `{ count, items }` with `items` the distinct first segments. A path ends at a quote, whitespace
 * or list punctuation, so one with a space in a name is cut short and may be reported though it is there:
 * this feeds a warning, never a decision. */
function missingTargets(text, codexDir) {
  const tail = String.raw`((?:(?:\\\\|\\|/)[^\\/"'\s;,:*?<>|()[\]]+)*)`;
  const items = new Set();
  let count = 0;
  for (const [, rest] of text.matchAll(new RegExp(`@@TRIAL_CODEX_HOME:[a-z]+@@${tail}`, 'g'))) {
    const segments = rest.split(/[\\/]+/).filter(Boolean);
    if (segments.length === 0 || exists(path.join(codexDir, ...segments))) continue;
    count += 1;
    items.add(segments[0]);
  }
  return { count, items: [...items].sort() };
}

// ---- the engram server in config.toml ------------------------------------------------------------------

const ENGRAM_SERVER = ['mcp_servers', 'engram'];
const ENGRAM_ENV = [...ENGRAM_SERVER, 'env'];
// What decides which engram a process reaches. The first two are set to the trial's own; the last two
// would send it to a server or socket of someone else's, so a real entry's are dropped.
const ENGRAM_KEYS = ['ENGRAM_DATA_DIR', 'ENGRAM_PORT', 'ENGRAM_URL', 'ENGRAM_SOCKET'];
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

const startsWith = (list, prefix) => prefix.every((part, index) => list[index] === part);
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
function* scanToml(lines) {
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

const unsupported =(how) => new Error(`config.toml declares the engram MCP server ${how}, a form this harness cannot point at a trial's own store and port: write it as a [mcp_servers.engram] table with its env, if any, in a [mcp_servers.engram.env] table`);

/** The `config.toml` text `toml` with the engram MCP server's env pointing at a trial: `ENGRAM_DATA_DIR` is
 * `dataDir` and `ENGRAM_PORT` is `port`, in a `[mcp_servers.engram.env]` table (appended when the file has
 * none), and an `ENGRAM_URL` or `ENGRAM_SOCKET` the table held is dropped. A file with no engram server is
 * returned as it is. The table is needed because Codex is ASSUMED to start an MCP server with a reduced
 * env of its own choosing rather than its whole one (UNVERIFIED, for the real trials), in which case the
 * trial's `ENGRAM_PORT` would not reach the server and it would fall back to 7437, the real one.
 *
 * The file is scanned line by line (`scanToml`, which refuses what it cannot read): table headers and the
 * key each line starts with. A server declared any other way (an inline table, dotted keys, an inline `env`,
 * an array of tables) is an error, never a guess; and so is an inline `mcp_servers` table whatever it
 * holds, because the keys inside a value are not read. */
export function withEngramEnv(toml, { dataDir, port }) {
  assertTrialPort(port);
  const eol = toml.includes('\r\n') ? '\r\n' : '\n';
  const ours = [`ENGRAM_DATA_DIR = ${JSON.stringify(dataDir)}`, `ENGRAM_PORT = "${port}"`];
  const out = [];
  let declared = false;
  let hasEnvTable = false;
  for (const { text: line, table, header, array, key } of scanToml(toml.split(/\r?\n/))) {
    const inEnvTable = table.length === ENGRAM_ENV.length && startsWith(table, ENGRAM_ENV);
    if (header) {
      if (array && startsWith(header, ENGRAM_SERVER)) throw unsupported('as an array of tables');
      out.push(line);
      if (startsWith(table, ENGRAM_SERVER)) declared = true;
      if (inEnvTable) {
        hasEnvTable = true;
        out.push(...ours);
      }
      continue;
    }
    if (key) {
      const full = [...table, ...key.parts];
      if (inEnvTable && key.parts.length === 1 && ENGRAM_KEYS.includes(key.parts[0])) continue;
      if (table.length === ENGRAM_SERVER.length && startsWith(table, ENGRAM_SERVER) && key.parts[0] === 'env') throw unsupported('with an inline or dotted env');
      if (!startsWith(table, ENGRAM_SERVER) && startsWith(full, ENGRAM_SERVER)) throw unsupported('through an inline table or dotted keys');
      if (full.length === 1 && full[0] === ENGRAM_SERVER[0]) throw unsupported('or some other server inside an inline mcp_servers table');
    }
    out.push(line);
  }
  if (!declared) return toml;
  if (!hasEnvTable) {
    while (out.length > 0 && out.at(-1).trim() === '') out.pop();
    out.push('', `[${ENGRAM_ENV.join('.')}]`, ...ours, '');
  }
  return out.join(eol);
}

// ---- the desktop app's pieces ------------------------------------------------------------------------

/** What the current arm leaves out of the copy: the Codex desktop app's pieces (Sebastián, 2026-10-04). A
 * trial runs with approvals bypassed, and these reach the live desktop app (a named pipe, screen and browser
 * control), which a hash of the real trees cannot see; so the arm carries fewer tools than his daily Codex,
 * and the F6 result says so. The precedent is Claude's current arm, which ran without the claude.ai
 * connector. `keys` are top-level keys of `config.toml` (`notify` runs the computer-use program at every
 * turn's end), `servers` are `[mcp_servers.<name>]` tables, and `plugins` are `<name>@<marketplace>` ids:
 * each one's `[plugins."<id>"]` table and its directory `plugins/cache/<marketplace>/<name>`, where the
 * MCP server it declares lives (`cua_repl`, `codex_app`). This is the one place the list is read from. */
export const DESKTOP_APP = {
  keys: ['notify'],
  servers: ['node_repl'],
  plugins: ['unified-computer-use@openai-bundled', 'computer-use@openai-bundled', 'browser@openai-bundled', 'chrome@openai-bundled', 'codex-app-tools@openai-bundled'],
};
const DESKTOP_TABLES = [...DESKTOP_APP.servers.map((name) => ['mcp_servers', name]), ...DESKTOP_APP.plugins.map((id) => ['plugins', id])];
const underDesktop = (parts) => DESKTOP_TABLES.some((prefix) => startsWith(parts, prefix));
const cannotTakeOut = (how) => new Error(`config.toml ${how}, which this harness cannot take out of the copy whole, and a piece of the desktop app left in would reach the real one from a trial: write it as its own [table]`);

/** The `config.toml` text `toml` without the pieces of `DESKTOP_APP`: each top-level key's line (its value
 * ends there, or `scanToml` has refused the file), and each table from its header to the next header,
 * sub-tables included. Every other byte is kept, line endings too. A piece written any other way (an inline
 * table, dotted keys, an array of tables) is an error, never left in; so is an inline `mcp_servers` or
 * `plugins` table whatever it holds, because the keys inside a value are not read; and so is any mention of
 * a server or plugin that survives the removal, a comment included, because a name still in the file is a
 * piece this scan did not understand. */
export function withoutDesktopApp(toml) {
  const out = [];
  for (const { text, table, header, array, key } of scanToml(toml.split(/(?<=\n)/))) {
    if (header) {
      if (!underDesktop(header)) out.push(text);
      else if (array) throw cannotTakeOut(`declares ${header.join('.')} as an array of tables`);
      continue;
    }
    if (underDesktop(table)) continue;
    if (key) {
      const full = [...table, ...key.parts];
      if (full.length === 1 && DESKTOP_APP.keys.includes(full[0])) continue;
      if (underDesktop(full)) throw cannotTakeOut(`declares ${full.slice(0, 2).join('.')} through an inline table or dotted keys`);
      if (full.length === 1 && DESKTOP_TABLES.some(([first]) => first === full[0])) throw cannotTakeOut(`declares ${full[0]} as an inline table, where a piece could be`);
    }
    out.push(text);
  }
  const result = out.join('');
  const left = [...DESKTOP_APP.servers, ...DESKTOP_APP.plugins].find((name) => result.includes(name));
  if (left) throw cannotTakeOut(`still names ${left} outside a table of its own`);
  return result;
}

// ---- the template --------------------------------------------------------------------------------------

/** Builds the Codex template: reads the real `<realHome>/.codex` ONCE and writes a frozen copy of the copy
 * list to `templateDir` (absolute, empty or missing, outside the real home), under the guards and the
 * rollback of `home.mjs`. Returns `{ templateDir, files, bytes, warnings }`. The real home is only read,
 * and the caller removes the template with `removeCodexTemplate` when its suite ends.
 *
 * In the template every path INTO the real `.codex` in a JSON or TOML file of the copy is a placeholder,
 * which `seedCodexHome` turns into the trial's own: the instruction files, the plugin cache, a hook's
 * script, the `CODEX_HOME` an MCP server is handed, and the key Codex stores a hook's trust under
 * (`[hooks.state.'<path of hooks.json>:<event>:<group>:<hook>']`), so nothing a trial reads or writes
 * there is the real one. The marker lists the files that hold one (`rewritten`). A real-home path
 * OUTSIDE `.codex` is left as it is: it names a program installed in the user profile (the engram binary
 * the plugin's hook finds through the first line of `config.toml`) or a
 * marketplace source, a trial home holds no copy of them, and a rewritten path would only make that part
 * of the setup silently absent from the arm that claims to measure it. `PATH` already reaches the same
 * programs in both arms. `warnings` says what that leaves, by file and count and never by value: links
 * that were followed, the paths left pointing at the real machine, the placeholders whose target the
 * template does not hold (the marketplace sources under `.tmp`), and every copied file that names the real
 * home without being rewritten.
 *
 * The desktop app's pieces (`DESKTOP_APP`) are not in the copy at all: `withoutDesktopApp` takes them out
 * of `config.toml`, and their plugin directories are never copied (`copyPluginCache`).
 *
 * A real home without a `.codex` directory is an error, and so are an engram server `withEngramEnv` cannot
 * rewrite and a desktop piece `withoutDesktopApp` cannot take out: found here, once, instead of at the first
 * trial. */
export function buildCodexTemplate({ realHome, templateDir, copyFile }) {
  requireAbsolute('real home', realHome);
  requireAbsolute('template directory', templateDir);
  if (!isDirectory(realHome)) throw new Error(`the real home ${realHome} is not a directory`);
  if (!isDirectory(codexHomeOf(realHome))) throw new Error(`the real home ${realHome} has no .codex directory`);
  return buildInto({ realHome, templateDir }, () => writeCodexTemplate({ realHome, templateDir, copyFile }));
}

/** Copies the plugin cache `source`, laid out as `<marketplace>/<plugin>/<version>/...`, plugin by plugin,
 * and skips the directories of `DESKTOP_APP.plugins`: a plugin that is not on disk declares no MCP server.
 * No file of the cache lists the plugins it holds (the only one beside a version directory is a remote
 * plugin's own `.codex-remote-plugin-install.json`), so nothing is left naming a plugin that is gone. Names
 * compare case-insensitively on Windows, as its file system does. `copy(from, to, label)` is the build's. */
function copyPluginCache(source, target, copy) {
  if (!isDirectory(source)) return;
  const fold = (name) => (process.platform === 'win32' ? name.toLowerCase() : name);
  const excluded = new Set(DESKTOP_APP.plugins.map((id) => fold(`${id.slice(id.lastIndexOf('@') + 1)}/${id.slice(0, id.lastIndexOf('@'))}`)));
  for (const marketplace of fs.readdirSync(source)) {
    const from = path.join(source, marketplace);
    const plugins = isDirectory(from) ? fs.readdirSync(from).filter((plugin) => !excluded.has(fold(`${marketplace}/${plugin}`))) : null;
    if (plugins === null) copy(from, path.join(target, marketplace), `plugins/cache/${marketplace}`);
    else for (const plugin of plugins) copy(path.join(from, plugin), path.join(target, marketplace, plugin), `plugins/cache/${marketplace}/${plugin}`);
  }
}

/** The body of `buildCodexTemplate`: everything that writes, so a failure anywhere in it is undone as one. */
function writeCodexTemplate({ realHome, templateDir, copyFile }) {
  const source = codexHomeOf(realHome);
  const payload = path.join(templateDir, PAYLOAD);
  const target = codexHomeOf(payload);
  fs.mkdirSync(target, { recursive: true });
  const warnings = [];
  const copy = (from, to, what) => {
    if (exists(from)) copyEntry(from, to, { followLinks: true, active: new Set(), warnings, what, copyFile }, what);
  };
  const names = fs.readdirSync(source).filter((name) => CODEX_ITEMS.includes(name) || HOOK_SCRIPT.test(name)).sort();
  for (const name of names) copy(path.join(source, name), path.join(target, name), name);
  copyPluginCache(path.join(source, ...PLUGIN_CACHE), path.join(target, ...PLUGIN_CACHE), copy);
  // What gentle-ai's own hooks and commands read, as in the Claude template: both hosts share that file.
  copy(path.join(realHome, '.gentle-ai', 'state.json'), path.join(payload, '.gentle-ai', 'state.json'), '.gentle-ai/state.json');

  // Before anything reads the copy for paths: what is taken out is neither rewritten nor reported.
  const config = path.join(payload, ...CONFIG.split('/'));
  if (fs.statSync(config, { throwIfNoEntry: false })?.isFile()) fs.writeFileSync(config, withoutDesktopApp(fs.readFileSync(config, 'utf8')));

  // Every copied file is read once. A config file gets its placeholders, and is reported for what they
  // cannot fix. Anything else is copied as it is, so a skill or an instruction file that names the real home
  // points its reader (the model) at the real machine: counted per item of the copy list.
  const rewritten = [];
  const references = new Map();
  for (const { path: file } of inventory(payload)) {
    const full = path.join(payload, ...file.split('/'));
    const [top, item] = file.split('/');
    if (!isRewritten(file)) {
      const found = countRealHome(fs.readFileSync(full, 'latin1'), realHome);
      const name = top === '.codex' ? item : top;
      if (found > 0) references.set(name, (references.get(name) ?? 0) + found);
      continue;
    }
    const original = fs.readFileSync(full, 'utf8');
    const text = tokenize(original, realHome);
    // The values are thrown away: this only refuses, now, a file no trial could be seeded from.
    if (file === CONFIG) withEngramEnv(text, { dataDir: 'unused', port: 1024 });
    if (text !== original) {
      fs.writeFileSync(full, text);
      rewritten.push(file);
    }
    const name = file.slice('.codex/'.length);
    const outside = countRealHome(text, realHome);
    if (outside > 0) warnings.push(`${name}: names the real home outside .codex in ${outside} place(s); they are left as they are, so what they name (a program installed in the user profile, a marketplace source) is the real machine's`);
    const missing = missingTargets(text, target);
    if (missing.count > 0) warnings.push(`${name}: ${missing.count} path(s) into .codex lead to something the template does not hold (${missing.items.join(', ')}), so in a trial they lead nowhere`);
  }
  for (const [name, found] of references) warnings.push(`${name}: names the real home in ${found} place(s); it is not rewritten, so whoever reads it is pointed at the real machine`);

  return sealTemplate(templateDir, { kind: CODEX_TEMPLATE_KIND, warnings, rewritten });
}

/** Removes a Codex template; a directory that is not one is refused and left alone (see `removeTemplate`). */
export function removeCodexTemplate(templateDir) {
  removeTemplate(templateDir, CODEX_TEMPLATE);
}

// ---- a trial's home ------------------------------------------------------------------------------------

/** Seeds the trial home `home`, absolute and fresh, from the Codex template: the copy list goes in as it
 * is (the plugin cache too: about 94 MB and 1,300 files on this machine, a plain copy per trial, because a
 * link to a shared copy would let one trial's agent change what the next one loads), then every placeholder
 * the build left becomes this home's `.codex`, and the engram server of `config.toml` gets this trial's
 * data directory and `engramPort` (`withEngramEnv`). `engramPort`, the
 * trial's own (see `ports.mjs`), is required and checked before anything is copied: the real engram port
 * is refused. The login is not part of this: `copyLogin` adds it. Nothing here writes outside `home`, and
 * the template is only read. */
export function seedCodexHome(templateDir, home, { engramPort } = {}) {
  requireAbsolute('home', home);
  assertTrialPort(engramPort);
  // The path is written into TOML and JSON strings of three kinds; a quote would end one of them early.
  if (/['"\u0000-\u001f]/.test(home)) throw new Error(`the trial home ${JSON.stringify(home)} holds a quote or a control character, which a path in the copied config.toml cannot carry`);
  const { rewritten = [] } = readTemplate(templateDir, CODEX_TEMPLATE);
  copyEntry(path.join(templateDir, PAYLOAD), home, { followLinks: false, active: new Set(), warnings: [], what: 'the template' }, PAYLOAD);

  // The files the build left placeholders in, and `config.toml` whether it has one or not: its engram
  // server needs this trial's port all the same.
  const codexHome = codexHomeOf(home);
  for (const file of new Set([...rewritten.filter((entry) => isRewritten(entry) && !entry.split('/').includes('..')), CONFIG])) {
    const full = path.join(home, ...file.split('/'));
    if (!fs.existsSync(full)) continue;
    const text = untokenize(fs.readFileSync(full, 'utf8'), codexHome);
    fs.writeFileSync(full, file === CONFIG ? withEngramEnv(text, { dataDir: path.join(home, '.engram'), port: engramPort }) : text);
  }
}

/** The `seed` of the Codex current arm (`codexCurrentConfig({ seed })`): copies the template into the
 * trial's home, then runs `js-harness init` in the workspace as the Claude arm does (`initWorkspace`), with
 * `CODEX_HOME` pointing at the trial's own in case a step of it looks for one, and without Claude Code's
 * credential, which `initWorkspace` lets through for the Claude arm and nothing of a Codex trial needs. The
 * template is checked now, when the seed is made, so a wrong path fails before any trial. `runInit` and
 * `env` go to `initWorkspace`. */
export function seedFromCodexTemplate(templateDir, { runInit, env } = {}) {
  readTemplate(templateDir, CODEX_TEMPLATE);
  return async ({ home, workspace, engramPort }) => {
    seedCodexHome(templateDir, home, { engramPort });
    await initWorkspace({ home, workspace, engramPort, runInit, env: { CODEX_HOME: codexHomeOf(home), CLAUDE_CODE_OAUTH_TOKEN: null, ...env } });
  };
}
