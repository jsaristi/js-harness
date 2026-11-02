#!/usr/bin/env node
// The read-only verification of F8 S2's step 8 (odd/tasks/f8-s2-removal.md, T4; the diet's section 10, step 8): after
// gentle-ai, Orca and herdr leave his machine, each row checks one thing the removal must have left, against the
// backup `js-harness stack backup run` took before it (bin/lib/stack-backup.mjs writes its manifest and its `named`
// files). It writes nothing: it reads files, and runs only `engram search` and `engram stats`, `claude mcp list`,
// `where` and `reg query`, each handed in as `deps.run` so a test runs none of them. It never runs `js-harness doctor`,
// which writes its cache; doctor runs apart and that write is named in the Log.
// What a row says holds names, counts and key paths only: `~/.claude.json` and `~/.codex/config.toml` hold a key, so
// no value of theirs, and no text of a parse error (Node's quotes the JSON around it), ever reaches the output.
// Run by hand: `node scripts/s2-verify.mjs --backup <dir> [--home <dir>] [--marker <token>] [--expect <id>]`; one
// `ok` or `FAIL` line per row, exit 0 when every row passes, 1 when one fails, 2 on a usage error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultRun, parseStats } from '../bin/lib/backup.mjs';

/** The rows, in the order they print. An id goes into the Log, so it never changes once one was recorded. */
export const ROWS = Object.freeze(['claude-md', 'hooks', 'permissions', 'mcp-claude', 'claude-dirs', 'codex', 'settings-owners', 'engram', 'gone', 'path', 'mcp-list', 'gemini']);

/** The schema the backup's manifest declares (bin/lib/stack-backup.mjs). */
const BACKUP_SCHEMA = 'js-harness.stack-backup/v1';
/** The observation planted before the backup (the Log's L2): its token and its engram id. */
const MARKER = 's2drillmarker20261102';
const MARKER_ID = 6431;
/** The complements whose registrations stay: their MCP entries and their `claude mcp list` lines. */
const COMPLEMENTS = ['engram', 'codegraph', 'context7'];
/** What opens each of gentle-ai's blocks in an instruction file. */
const GENTLE_MARKER = '<!-- gentle-ai:';
/** gentle-ai's skills in `~/.codex/skills`, read on his machine 2026-11-02 (the depth pass, item 2). */
const GENTLE_CODEX_SKILLS = ['_shared', 'chained-pr', 'cognitive-doc-design', 'go-testing', 'judgment-day', 'skill-creator', 'skill-improver', 'skill-registry', 'work-unit-commits'];
/** The programs that leave, which `where` must no longer find. */
const GONE_PROGRAMS = ['gentle-ai', 'gga', 'orca', 'herdr'];
const MENTIONS_GENTLE = /gentle-ai|gentleman/i;
const CODEX_FOREIGN = /gentle-ai|herdr|orca/i;
const SETTINGS_FOREIGN = /gentle-ai|orca|herdr|skill-registry/i;
const PATH_FOREIGN = /\borca\b|\bherdr\b/i;

// ---- reading, without ever quoting what was read ----------------------------------------------------------------------

const exists = (file) => fs.existsSync(file);
const readText = (file) => (exists(file) ? fs.readFileSync(file, 'utf8') : null);

/** `{ value }` for a JSON file, `{ absent: true }` for none, `{ invalid: true }` for one that does not parse; the parse
 * error is dropped, since its message quotes the text around the fault. */
function readJson(file) {
  const text = readText(file);
  if (text === null) return { absent: true };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { invalid: true };
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (text, needle) => (text ? text.split(needle).length - 1 : 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A JSON text of `value` with every object's keys sorted, so two values equal but for key order give one text. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

const join = (at, key) => (at ? `${at}.${key}` : key);

/** The first key path at which `a` and `b` differ, from `at`, or null when they are deep-equal with key order aside.
 * With `sets`, an array is compared as a set and its path carries how many members each side lacks. Only paths and
 * counts come back, never a value. */
export function firstDifference(a, b, at = '', { sets = false } = {}) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (sets) {
      const left = new Set(a.map(canonical));
      const right = new Set(b.map(canonical));
      const missing = [...left].filter((item) => !right.has(item)).length;
      const extra = [...right].filter((item) => !left.has(item)).length;
      return missing + extra === 0 ? null : `${at} (${missing} missing, ${extra} extra)`;
    }
    if (a.length !== b.length) return at;
    for (let i = 0; i < a.length; i += 1) {
      const found = firstDifference(a[i], b[i], `${at}[${i}]`);
      if (found !== null) return found;
    }
    return null;
  }
  if (isObject(a) && isObject(b)) {
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (!(key in a) || !(key in b)) return join(at, key);
      const found = firstDifference(a[key], b[key], join(at, key), { sets });
      if (found !== null) return found;
    }
    return null;
  }
  if (Array.isArray(a) !== Array.isArray(b) || isObject(a) !== isObject(b)) return at;
  return a === b ? null : at;
}

/** Every hook command of a settings or hooks file, `{ event, command }`; a hook with no command keeps its type. */
function hookCommands(settings) {
  const out = [];
  for (const [event, groups] of Object.entries(isObject(settings?.hooks) ? settings.hooks : {})) {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) {
        out.push({ event, command: typeof hook?.command === 'string' ? hook.command : `(a ${hook?.type ?? 'typeless'} hook with no command)` });
      }
    }
  }
  return out;
}

/** Every file under `dir`, at any depth, by its path from `dir`; a link is listed and never followed. */
function filesUnder(dir) {
  if (!exists(dir)) return [];
  const out = [];
  const visit = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(full);
    }
  };
  visit(dir);
  return out;
}

// ---- the rows ---------------------------------------------------------------------------------------------------------

const row = (id, ok, said) => ({ id, ok, said });

function markerRow(id, file, label) {
  const text = readText(file);
  if (text === null) return row(id, true, `${label} absent`);
  const found = count(text, GENTLE_MARKER);
  return row(id, found === 0, found === 0 ? `${label} holds no gentle-ai marker` : `${label} holds ${plural(found, 'gentle-ai marker')}`);
}

function hooksRow(settings) {
  if (!settings.value) return row('hooks', false, `settings.json ${settings.absent ? 'missing' : 'not valid JSON'}`);
  const owners = { 'js-harness': 0, codegraph: 0 };
  const others = [];
  for (const { command } of hookCommands(settings.value)) {
    if (command.startsWith('js-harness ')) owners['js-harness'] += 1;
    else if (command.includes('codegraph')) owners.codegraph += 1;
    else others.push(command.slice(0, 60));
  }
  const counts = `js-harness ${owners['js-harness']}, codegraph ${owners.codegraph}`;
  return others.length === 0 ? row('hooks', true, counts) : row('hooks', false, `${counts}, ${plural(others.length, 'other hook')}: ${others.join(' | ')}`);
}

function permissionsRow(settings, backupPermissions) {
  if (!settings.value) return row('permissions', false, `settings.json ${settings.absent ? 'missing' : 'not valid JSON'}`);
  if (!backupPermissions.value) return row('permissions', false, `the backup's permissions ${backupPermissions.absent ? 'missing' : 'not valid JSON'}`);
  const live = settings.value.permissions;
  if (!isObject(live)) return row('permissions', false, 'settings.json has no permissions object');
  const at = firstDifference(backupPermissions.value, live, 'permissions', { sets: true });
  if (at !== null) return row('permissions', false, `differs at ${at}`);
  const sizes = Object.keys(live).sort().map((key) => (Array.isArray(live[key]) ? `${key} ${live[key].length}` : key));
  return row('permissions', true, `equal: ${sizes.join(', ')}`);
}

function mcpClaudeRow(claudeJson, backupMcp) {
  if (!claudeJson.value) return row('mcp-claude', false, `.claude.json ${claudeJson.absent ? 'missing' : 'not valid JSON'}`);
  if (!backupMcp.value) return row('mcp-claude', false, `the backup's MCP entries ${backupMcp.absent ? 'missing' : 'not valid JSON'}`);
  const live = isObject(claudeJson.value.mcpServers) ? claudeJson.value.mcpServers : {};
  let ok = true;
  const parts = COMPLEMENTS.map((name) => {
    if (!(name in backupMcp.value)) return (ok = false, `${name} missing in the backup`);
    if (!(name in live)) return (ok = false, `${name} missing`);
    const at = firstDifference(backupMcp.value[name], live[name]);
    if (at === null) return `${name} equal`;
    ok = false;
    return `${name} differs at ${at || 'its whole entry'}`;
  });
  return row('mcp-claude', ok, parts.join('; '));
}

/** The paths the machine manifest records as written by js-harness, in one case on Windows. */
function installedPaths(home, platform) {
  const manifest = readJson(path.join(home, '.js-harness', 'manifest.json')).value;
  const key = (file) => (platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file));
  const recorded = [...(manifest?.files ?? []), ...(manifest?.optional ?? [])].map((record) => record?.path).filter((file) => typeof file === 'string');
  return { has: (file) => recorded.some((record) => key(record) === key(file)) };
}

function claudeDirsRow(home, platform) {
  const claude = path.join(home, '.claude');
  const ours = installedPaths(home, platform);
  const found = [];
  for (const dir of ['agents', 'skills', 'output-styles']) {
    for (const file of filesUnder(path.join(claude, dir))) {
      const relative = path.relative(claude, file);
      const name = path.basename(file).toLowerCase();
      const gentleStyle = dir === 'output-styles' && name === 'neutral.md';
      if (name === 'gentleman.md' || gentleStyle) found.push(relative);
      else if (ours.has(file)) continue;
      else if (MENTIONS_GENTLE.test(relative) || (fs.lstatSync(file).isFile() && MENTIONS_GENTLE.test(fs.readFileSync(file, 'utf8')))) found.push(relative);
    }
  }
  if (found.length === 0) return row('claude-dirs', true, 'agents, skills and output-styles hold nothing of gentle-ai');
  const shown = found.slice(0, 10).join(', ');
  return row('claude-dirs', false, `${plural(found.length, 'file')} of gentle-ai: ${shown}${found.length > 10 ? ', ...' : ''}`);
}

function codexRow(home) {
  const codex = path.join(home, '.codex');
  const problems = [];
  const markers = count(readText(path.join(codex, 'AGENTS.md')), GENTLE_MARKER);
  if (markers > 0) problems.push(`AGENTS.md holds ${plural(markers, 'gentle-ai marker')}`);
  const hooks = readJson(path.join(codex, 'hooks.json'));
  if (hooks.invalid) problems.push('hooks.json not valid JSON');
  const foreign = hookCommands(hooks.value).filter(({ command }) => CODEX_FOREIGN.test(command));
  if (foreign.length > 0) problems.push(`hooks.json holds ${plural(foreign.length, 'hook')} naming ${[...new Set(foreign.map(({ command }) => command.match(CODEX_FOREIGN)[0].toLowerCase()))].join(', ')}`);
  const skillsDir = path.join(codex, 'skills');
  const skills = exists(skillsDir) ? fs.readdirSync(skillsDir) : [];
  const left = GENTLE_CODEX_SKILLS.filter((name) => skills.includes(name));
  if (left.length > 0) problems.push(`skills holds ${left.join(', ')}`);
  const toml = readText(path.join(codex, 'config.toml')) ?? '';
  const sections = new Set([...toml.matchAll(/^[ \t]*\[mcp_servers\.(?:"([^"\]]+)"|([A-Za-z0-9_-]+))\][ \t]*$/gm)].map((m) => m[1] ?? m[2]));
  const absent = COMPLEMENTS.filter((name) => !sections.has(name));
  if (absent.length > 0) problems.push(`config.toml lacks [mcp_servers.${absent.join('], [mcp_servers.')}]`);
  if (problems.length > 0) return row('codex', false, problems.join('; '));
  return row('codex', true, `nothing of gentle-ai, herdr or Orca; config.toml has ${COMPLEMENTS.join(', ')}`);
}

function settingsOwnersRow(settings, codexHooks) {
  const found = [];
  for (const [label, file] of [['settings.json', settings], ['.codex/hooks.json', codexHooks]]) {
    for (const { event, command } of hookCommands(file.value)) {
      const match = command.match(SETTINGS_FOREIGN);
      if (match) found.push(`${label} ${event} names ${match[0].toLowerCase()}`);
    }
  }
  return found.length === 0 ? row('settings-owners', true, 'no hook names gentle-ai, orca, herdr or skill-registry') : row('settings-owners', false, found.join('; '));
}

function engramRow({ run, env, marker, expect, manifest }) {
  const search = run('engram', ['search', marker, '--all'], { env });
  if (search.status !== 0) return row('engram', false, `engram search exited ${search.status}`);
  const answered = new RegExp(`#${expect}(?!\\d)`).test(search.stdout ?? '');
  const stats = run('engram', ['stats', '--all'], { env });
  const counted = stats.status === 0 ? parseStats(stats.stdout ?? '') : null;
  const wanted = manifest.engram?.observations;
  const problems = [];
  if (!answered) problems.push(`engram search ${marker} does not answer #${expect}`);
  if (counted === null) problems.push(stats.status === 0 ? 'engram stats printed no counts' : `engram stats exited ${stats.status}`);
  else if (typeof wanted !== 'number') problems.push('the backup records no observation count');
  else if (counted.observations < wanted) problems.push(`engram counts ${counted.observations} observations, fewer than the backup's ${wanted}`);
  if (problems.length > 0) return row('engram', false, problems.join('; '));
  return row('engram', true, `#${expect} answers; ${counted.observations} observations, the backup's ${wanted}`);
}

function goneRow({ home, env, run, platform }) {
  const local = env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
  const roaming = env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
  const binDir = path.join(home, 'bin');
  // Orca's uninstaller and herdr's integration uninstall may leave their data folders (the plan's depth pass, item 2).
  const left = [
    path.join(home, '.gentle-ai'),
    path.join(home, 'go', 'bin', 'gentle-ai.exe'),
    path.join(home, '.herdr'),
    path.join(roaming, 'herdr'),
    path.join(local, 'herdr'),
    path.join(home, '.orca'),
    path.join(roaming, 'orca'),
    path.join(local, 'orca-updater'),
    path.join(local, 'Programs', 'orca'),
    ...(exists(binDir) ? fs.readdirSync(binDir).filter((name) => name.toLowerCase().startsWith('gga')).map((name) => path.join(binDir, name)) : []),
  ].filter(exists);
  const finder = platform === 'win32' ? 'where' : 'which';
  const found = GONE_PROGRAMS.filter((name) => {
    const result = run(finder, [name], { env });
    return result.status === 0 && (result.stdout ?? '').trim() !== '';
  });
  const problems = [...left.map((file) => `${file} is there`), ...(found.length > 0 ? [`${finder} finds ${found.join(', ')}`] : [])];
  return problems.length === 0 ? row('gone', true, `gentle-ai, GGA, Orca and herdr gone; ${finder} finds none`) : row('gone', false, problems.join('; '));
}

function pathRow({ env, run, platform }) {
  let value;
  if (platform === 'win32') {
    const result = run('reg', ['query', 'HKCU\\Environment', '/v', 'Path'], { env });
    if (result.status !== 0) return row('path', false, `reg query exited ${result.status}`);
    value = (result.stdout ?? '').match(/^\s*Path\s+REG_\w+\s+(.*?)\s*$/im)?.[1];
    if (value === undefined) return row('path', false, 'reg query printed no Path value');
  } else value = env.PATH ?? '';
  const segments = value.split(platform === 'win32' ? ';' : ':').filter(Boolean);
  const foreign = segments.filter((segment) => PATH_FOREIGN.test(segment));
  return foreign.length === 0 ? row('path', true, `${plural(segments.length, 'segment')}, none of Orca or herdr`) : row('path', false, `the user PATH holds ${foreign.join('; ')}`);
}

function mcpListRow({ env, run }) {
  const result = run('claude', ['mcp', 'list'], { env });
  if (result.status !== 0) return row('mcp-list', false, `claude mcp list exited ${result.status}`);
  const lines = (result.stdout ?? '').split(/\r?\n/);
  const problems = [];
  for (const name of COMPLEMENTS) {
    // A server's line opens with its name, or `plugin:<plugin>:<name>` for one a plugin brings.
    const line = lines.find((text) => new RegExp(`^\\s*(?:plugin:[^:\\s]+:)?${name}:\\s`).test(text));
    if (line === undefined) problems.push(`${name} not listed`);
    else if (!/connected/i.test(line) || /not connected|disconnected|failed/i.test(line)) problems.push(`${name} not connected`);
  }
  return problems.length === 0 ? row('mcp-list', true, `${COMPLEMENTS.join(', ')} connected`) : row('mcp-list', false, problems.join('; '));
}

// ---- the whole check --------------------------------------------------------------------------------------------------

/** The environment the programs run in: `env` itself for the home it names, else that home under every name Claude
 * and Windows read it by and engram's store inside it, so `--home` never reads the running user's store. */
function homeEnv(home, env, platform) {
  const key = (dir) => (platform === 'win32' ? path.resolve(dir).toLowerCase() : path.resolve(dir));
  const own = env.USERPROFILE ?? env.HOME;
  if (own && key(own) === key(home)) return env;
  return { ...env, HOME: home, USERPROFILE: home, ENGRAM_DATA_DIR: path.join(home, '.engram') };
}

/** Reads the backup in `dir`: `{ manifest }`, or `{ error }` naming what is wrong with it. */
function readBackup(dir) {
  const manifest = readJson(path.join(dir, 'manifest.json'));
  if (!manifest.value || manifest.value.schema !== BACKUP_SCHEMA) return { error: `${dir} holds no stack backup (${BACKUP_SCHEMA} manifest.json)` };
  return { manifest: manifest.value };
}

/** Every row of step 8 for `home` against the backup in `backup`, `{ ok, rows: [{ id, ok, said }] }`, reading files
 * and running only `deps.run` (spawnSync's shape: `(cmd, args, { env }) => { status, stdout, stderr }`). A row that
 * meets an error fails with the error's code, never its message. */
export function verifyRemoval({ home, env = {}, backup, deps = {}, platform = process.platform, marker = MARKER, expect = MARKER_ID }) {
  const run = deps.run ?? defaultRun;
  const childEnv = homeEnv(home, env, platform);
  const read = readBackup(backup);
  const manifest = read.manifest ?? {};
  const named = (key) => (typeof manifest.named?.[key] === 'string' ? readJson(path.join(backup, manifest.named[key])) : { absent: true });
  const settings = readJson(path.join(home, '.claude', 'settings.json'));
  const checks = {
    'claude-md': () => markerRow('claude-md', path.join(home, '.claude', 'CLAUDE.md'), 'CLAUDE.md'),
    hooks: () => hooksRow(settings),
    permissions: () => permissionsRow(settings, named('permissions')),
    'mcp-claude': () => mcpClaudeRow(readJson(path.join(home, '.claude.json')), named('mcpClaude')),
    'claude-dirs': () => claudeDirsRow(home, platform),
    codex: () => codexRow(home),
    'settings-owners': () => settingsOwnersRow(settings, readJson(path.join(home, '.codex', 'hooks.json'))),
    engram: () => engramRow({ run, env: childEnv, marker, expect, manifest }),
    gone: () => goneRow({ home, env: childEnv, run, platform }),
    path: () => pathRow({ env: childEnv, run, platform }),
    'mcp-list': () => mcpListRow({ env: childEnv, run }),
    gemini: () => markerRow('gemini', path.join(home, '.gemini', 'GEMINI.md'), 'GEMINI.md'),
  };
  const rows = ROWS.map((id) => {
    try {
      return checks[id]();
    } catch (err) {
      return row(id, false, `could not be read (${err?.code ?? err?.name ?? 'error'})`);
    }
  });
  return { ok: rows.every((each) => each.ok), rows };
}

// ---- the command ------------------------------------------------------------------------------------------------------

class S2VerifyArgError extends Error {}

const USAGE = 'usage: node scripts/s2-verify.mjs --backup <dir> [--home <dir>] [--marker <token>] [--expect <id>]';

function parse(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const flag = { '--backup': 'backup', '--home': 'home', '--marker': 'marker', '--expect': 'expect' }[token];
    if (!flag) throw new S2VerifyArgError(`unknown argument: ${token}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new S2VerifyArgError(`${token} needs a value`);
    options[flag] = value;
    i += 1;
  }
  if (!options.backup) throw new S2VerifyArgError('--backup <dir> is required');
  if (options.expect !== undefined) {
    if (!/^\d+$/.test(options.expect)) throw new S2VerifyArgError('--expect takes an observation id, a number');
    options.expect = Number(options.expect);
  }
  return options;
}

/** The command: the rows printed, one line each, and the exit code (0 all pass, 1 one fails, 2 usage). */
export function main(argv, { run = defaultRun, platform = process.platform, env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  try {
    options = parse(argv);
  } catch (err) {
    if (!(err instanceof S2VerifyArgError)) throw err;
    stderr.write(`${err.message}\n${USAGE}\n`);
    return 2;
  }
  const backup = path.resolve(options.backup);
  const home = path.resolve(options.home ?? os.homedir());
  const read = readBackup(backup);
  if (read.error) {
    stderr.write(`${read.error}\n${USAGE}\n`);
    return 2;
  }
  const childEnv = options.home ? { ...env, APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local') } : env;
  const result = verifyRemoval({ home, env: childEnv, backup, platform, deps: { run }, marker: options.marker, expect: options.expect });
  for (const each of result.rows) stdout.write(`${each.ok ? 'ok  ' : 'FAIL'} ${each.id}: ${each.said}\n`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
