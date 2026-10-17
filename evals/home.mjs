// The current arm's home: the machine's real Claude Code setup, frozen once into a template and copied
// into every trial's sandbox home. Zero deps, plain Node. What the sandbox is and why each piece of the
// real home is (or is not) taken is in `odd/tasks/evals.md` ("T2 map and decisions").
//
// Three rules shape everything here:
//  - A COPY LIST, not a deny list. Only the items named below are read from the real home, so a new kind
//    of state Claude Code starts writing tomorrow (history, a credential, a database) is left behind by
//    default instead of leaking into a trial.
//  - Copies only, never links. A link in a trial home would let an agent write through it into the real
//    files. A link met in the real home is followed and its target copied (users link skills in from a
//    shared directory), and a link found in a template is an error.
//  - Frozen. The real home is read once, by `buildTemplate`; every trial then copies the template, so a
//    config edit in the middle of a run cannot change one arm halfway.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sandboxEnv } from './configs.mjs';
import { exists, isWithin, resolveReal } from './paths.mjs';
import { assertTrialPort } from './ports.mjs';
import { childEnv } from './runner.mjs';
import { HOME_TOKEN, applyWithout, checkWithout } from './without.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const requireAbsolute = (label, value) => {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`the ${label} must be an absolute path, got ${JSON.stringify(value)}`);
};

/** What the template's marker file says it is. `removeTemplate` and `seedHome` trust nothing without it, so
 * a mistyped directory is never emptied or seeded from. */
export const TEMPLATE_KIND = 'js-harness-eval-home-template';
// The template of another agent's home (`codex-home.mjs`) has a kind and a name of its own, so neither is
// ever seeded from, or removed as, the other. This is the one this module builds.
const CLAUDE_TEMPLATE = { kind: TEMPLATE_KIND, label: 'js-harness eval home template' };
const MARKER = 'template.json';
// The template keeps its copy of the home in a subdirectory, next to the marker.
export const PAYLOAD = 'home';

// What is taken from `<real home>/.claude/`. Plugin state is separate: its paths are rewritten.
const CLAUDE_ITEMS = ['settings.json', 'CLAUDE.md', 'skills', 'agents', 'commands', 'output-styles', 'hooks'];
const PLUGIN_STATE_FILES = ['installed_plugins.json', 'known_marketplaces.json'];
// `marketplaces/` is copied although only `cache/` holds the plugins: `known_marketplaces.json` points each
// marketplace's `installLocation` there, and a marketplace that is not on disk is one Claude Code may try
// to clone again at startup, which is network and a write. Unverified until the real run (T2c).
const PLUGIN_DIRS = ['cache', 'marketplaces'];

// What a real-home path becomes inside the template (`HOME_TOKEN`, from `without.mjs`, which reads it back): the
// trial's home is not known until a trial seeds itself, so `seedHome` swaps this prefix for it. The template then
// names no path of the real machine.

const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
const slashes = (text) => text.replace(/\\+/g, '/');

/** `value` with the real home swapped for `HOME_TOKEN` when it is a path inside it (separators of either
 * kind, and case-insensitive on Windows), else `value` unchanged. */
function tokenize(value, realHome) {
  const text = slashes(value);
  const home = slashes(realHome).replace(/\/+$/, '');
  if (fold(text) === fold(home) || fold(text).startsWith(`${fold(home)}/`)) return HOME_TOKEN + text.slice(home.length);
  return value;
}

/** `value` with the token swapped for `home`; the rest of the path keeps its segments, joined the way this
 * host joins them. */
function untokenize(value, home) {
  if (value !== HOME_TOKEN && !value.startsWith(`${HOME_TOKEN}/`)) return value;
  return path.join(home, ...value.slice(HOME_TOKEN.length).split('/').filter(Boolean));
}

/** A copy of the JSON value `json` with `fn` applied to every string in it. */
function mapStrings(json, fn) {
  if (typeof json === 'string') return fn(json);
  if (Array.isArray(json)) return json.map((item) => mapStrings(item, fn));
  if (isObject(json)) return Object.fromEntries(Object.entries(json).map(([key, value]) => [key, mapStrings(value, fn)]));
  return json;
}

/** The JSON in `file`, or an error that names the file: a plugin or config file that is silently left out
 * would make the current arm quietly different from the setup it claims to measure. */
function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${label} is not valid JSON, so the template cannot be built: ${err.message}`);
  }
}

const writeJson = (file, json) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
};

export const isDirectory = (target) => fs.statSync(target, { throwIfNoEntry: false })?.isDirectory() === true;

/** Copies `source` to `target`, file by file, never creating a link. A link in `source` is followed when
 * `ctx.followLinks` (its target's content is copied and its place listed in `ctx.warnings`; a dangling one
 * is skipped and listed), and an error otherwise. A directory already being copied higher up the walk
 * (reached again through a link) is a cycle: an error, not an endless copy. Special files (sockets, pipes)
 * are skipped. `label` is the path shown in messages, relative to the item's root, never absolute. */
export function copyEntry(source, target, ctx, label) {
  let from = source;
  let stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) {
    if (!ctx.followLinks) throw new Error(`${ctx.what} holds a link at ${label}: a template and a trial home are copies only`);
    try {
      from = fs.realpathSync(source);
    } catch {
      ctx.warnings.push(`${label}: a link whose target does not exist was skipped`);
      return;
    }
    ctx.warnings.push(`${label}: a link was followed and its target copied`);
    stat = fs.statSync(from);
  }
  if (stat.isDirectory()) {
    const real = fs.realpathSync(from);
    if (ctx.active.has(real)) throw new Error(`${ctx.what} has a link cycle at ${label}`);
    ctx.active.add(real);
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(from)) copyEntry(path.join(from, entry), path.join(target, entry), ctx, `${label}/${entry}`);
    ctx.active.delete(real);
  } else if (stat.isFile()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    (ctx.copyFile ?? fs.copyFileSync)(from, target);
  }
}

/** The files below `root` as `{ path, size }`, `/`-separated and sorted. */
export function inventory(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push({ path: path.relative(root, full).split(path.sep).join('/'), size: fs.statSync(full).size });
    }
  };
  walk(root);
  return files.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** How many times `text` (JSON or plain) names `realHome`, in either slash form or JSON-escaped. */
export function countRealHome(text, realHome) {
  const needle = fold(slashes(realHome).replace(/\/+$/, ''));
  return fold(slashes(text)).split(needle).length - 1;
}

/** Builds the template: reads the real configuration ONCE and writes a frozen copy of the copy list to
 * `templateDir`, which must be absolute, empty or missing, and outside the real home. Returns `{
 * templateDir, files, bytes, warnings }`. The real home is only read. The caller owns the directory's
 * lifetime: it exists until `removeTemplate`, so one suite builds it once, seeds every trial from it, and
 * removes it at the end.
 *
 * In the template, `.claude.json` has no `projects` (the real projects' history and trust dialogs), and
 * every path inside the real home in the two plugin files is the placeholder `HOME_TOKEN`. `warnings` lists
 * what the sandbox cannot move, by file and count and never by value: links that were followed, absolute
 * paths outside the real home in the plugin files, and places `settings.json` names the real home (a hook
 * that runs a file there runs the real one, though anything it writes through `HOME` lands in the sandbox).
 * A real home without a `.claude` directory, or a JSON file that does not parse, is an error: a template
 * missing the setup it stands for would be measured as if it were the setup. */
export function buildTemplate({ realHome, templateDir, copyFile }) {
  requireAbsolute('real home', realHome);
  requireAbsolute('template directory', templateDir);
  if (!isDirectory(realHome)) throw new Error(`the real home ${realHome} is not a directory`);
  const claude = path.join(realHome, '.claude');
  if (!isDirectory(claude)) throw new Error(`the real home ${realHome} has no .claude directory`);
  return buildInto({ realHome, templateDir }, () => writeTemplate({ realHome, templateDir, claude, copyFile }));
}

/** Runs `write()`, which fills `templateDir` from `realHome`, under the guards every template shares: the
 * directory is outside the real home, does not contain it, and is empty or missing; and a `write` that
 * throws leaves nothing of itself behind. Returns what `write` returns. */
export function buildInto({ realHome, templateDir }, write) {
  const resolvedHome = resolveReal(realHome);
  const resolvedTemplate = resolveReal(templateDir);
  if (isWithin(resolvedHome, resolvedTemplate)) {
    throw new Error(`the template directory ${templateDir} is inside the real home: the template must not be a place the real setup can read`);
  }
  if (isWithin(resolvedTemplate, resolvedHome)) {
    throw new Error(`the template directory ${templateDir} contains the real home: building there would copy the real home into itself`);
  }
  if (exists(templateDir) && (!isDirectory(templateDir) || fs.readdirSync(templateDir).length > 0)) {
    throw new Error(`the template directory ${templateDir} is not empty`);
  }

  // Rolled back on failure, not marked incomplete: the payload holds copies of the real home (an
  // account id, MCP headers), so a failed build must not leave it on disk waiting for someone to notice
  // a marker, and "empty or missing" is the only state `buildTemplate` accepts, so a retry needs
  // exactly that back. Everything this call created goes: the directory if it made it, with any parent
  // it had to make, or else only what it put inside the empty one it was given.
  let firstCreated = templateDir;
  while (!exists(path.dirname(firstCreated)) && path.dirname(firstCreated) !== firstCreated) firstCreated = path.dirname(firstCreated);
  const created = !exists(templateDir);
  try {
    return write();
  } catch (err) {
    const remove = (target) => fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    try {
      if (created) remove(firstCreated);
      else for (const entry of fs.readdirSync(templateDir)) remove(path.join(templateDir, entry));
    } catch {
      // The build's own error is the one worth reporting; a stuck cleanup must not replace it.
    }
    throw err;
  }
}

/** The body of `buildTemplate`: everything that writes, so a failure anywhere in it can be undone as one. */
function writeTemplate({ realHome, templateDir, claude, copyFile }) {
  const payload = path.join(templateDir, PAYLOAD);
  fs.mkdirSync(payload, { recursive: true });
  const warnings = [];
  const copy = (source, target, what) => {
    if (exists(source)) copyEntry(source, target, { followLinks: true, active: new Set(), warnings, what, copyFile }, what);
  };
  const claudeTarget = path.join(payload, '.claude');
  for (const item of CLAUDE_ITEMS) copy(path.join(claude, item), path.join(claudeTarget, item), item);
  for (const dir of PLUGIN_DIRS) copy(path.join(claude, 'plugins', dir), path.join(claudeTarget, 'plugins', dir), `plugins/${dir}`);

  for (const name of PLUGIN_STATE_FILES) {
    const source = path.join(claude, 'plugins', name);
    if (!exists(source)) continue;
    let outside = 0;
    const json = mapStrings(readJson(source, name), (value) => {
      const mapped = tokenize(value, realHome);
      if (mapped === value && (path.win32.isAbsolute(value) || path.posix.isAbsolute(value))) outside += 1;
      return mapped;
    });
    if (outside > 0) warnings.push(`${name}: ${outside} absolute path(s) outside the real home are left as they are, so they point at the real machine`);
    writeJson(path.join(claudeTarget, 'plugins', name), json);
  }

  const claudeJson = path.join(realHome, '.claude.json');
  if (exists(claudeJson)) {
    const { projects, ...rest } = readJson(claudeJson, '.claude.json');
    writeJson(path.join(claudeTarget, '.claude.json'), rest);
  }
  copy(path.join(realHome, '.gentle-ai', 'state.json'), path.join(payload, '.gentle-ai', 'state.json'), '.gentle-ai/state.json');

  const settings = path.join(payload, '.claude', 'settings.json');
  if (fs.existsSync(settings)) {
    const references = countRealHome(fs.readFileSync(settings, 'utf8'), realHome);
    if (references > 0) warnings.push(`settings.json: names the real home in ${references} place(s); the sandbox does not rewrite them`);
  }

  return sealTemplate(templateDir, { kind: TEMPLATE_KIND, warnings });
}

/** Writes the marker that makes `templateDir` a template of `kind`, last, once its payload is complete: the
 * inventory of the payload, its size and the `warnings`, then whatever `extra` the kind keeps for its own
 * seeding. Returns the summary a build reports. */
export function sealTemplate(templateDir, { kind, warnings, ...extra }) {
  const files = inventory(path.join(templateDir, PAYLOAD));
  const bytes = files.reduce((total, file) => total + file.size, 0);
  const fingerprint = fingerprintOf(path.join(templateDir, PAYLOAD), files);
  fs.writeFileSync(path.join(templateDir, MARKER), `${JSON.stringify({ kind, version: 1, builtAt: new Date().toISOString(), files, bytes, warnings, fingerprint, ...extra }, null, 2)}\n`);
  return { templateDir, files: files.length, bytes, warnings, fingerprint };
}

// What a day of sessions changes in a file of the template without changing the setup an arm runs on (G6 of
// `odd/tasks/future-model-protocol.md`): left out of the fingerprint, or every run resumed the next day would be
// refused. `.claude.json` keeps Claude Code's counters and caches beside the MCP servers, which alone are setup;
// gentle-ai's state keeps three timestamps beside its settings; Codex's `config.toml` keeps a table per project
// and the notices it has shown beside its configuration.
const STATE_TIMESTAMPS = ['last_update_check', 'last_synced_at', 'rdd_mode_recorded_at'];
const TOML_HEADER = /^\s*\[/;
const TOML_SESSION_TABLE = /^\s*\[(projects\.|notice(\]|\.))/;
const SETTLED = {
  '.claude/.claude.json': (text) => JSON.stringify(JSON.parse(text).mcpServers ?? null),
  '.gentle-ai/state.json': (text) => JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(text)).filter(([key]) => !STATE_TIMESTAMPS.includes(key)))),
  '.codex/config.toml': (text) => {
    let skipping = false;
    return text.split(/\r?\n/).filter((line) => {
      if (TOML_HEADER.test(line)) skipping = TOML_SESSION_TABLE.test(line);
      return !skipping;
    }).join('\n');
  },
};

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** The bytes of the payload file `rel` as the fingerprint reads them: `raw` itself, or the part of it that is setup
 * when a day of sessions changes the rest (`SETTLED`). */
export const settledBytes = (rel, raw) => (Object.hasOwn(SETTLED, rel) ? SETTLED[rel](Buffer.from(raw).toString('utf8')) : raw);

/** The fingerprint of the payload in `root`, whose `files` are its inventory: one sha256 per item (the first two
 * segments of a path, such as `.claude/skills`) over its files' paths and settled contents, and one over the items.
 * Two templates of the same setup have the same fingerprint; the items say which part of a setup moved. */
export function fingerprintOf(root, files = inventory(root)) {
  const lines = new Map();
  for (const { path: rel } of files) {
    const item = rel.split('/').slice(0, 2).join('/');
    const raw = fs.readFileSync(path.join(root, ...rel.split('/')));
    lines.set(item, [...(lines.get(item) ?? []), `${rel}\0${sha256(settledBytes(rel, raw))}\n`]);
  }
  const items = Object.fromEntries([...lines].sort(([a], [b]) => (a < b ? -1 : 1)).map(([item, entries]) => [item, sha256(entries.join(''))]));
  return { sha256: sha256(Object.entries(items).map(([item, hash]) => `${item}\0${hash}\n`).join('')), items };
}

/** The marker of the template in `templateDir`; an error when the directory is not one of `kind`, which
 * `label` names in the message. */
export function readTemplate(templateDir, { kind, label } = CLAUDE_TEMPLATE) {
  const marker = path.join(templateDir, MARKER);
  let info;
  try {
    info = JSON.parse(fs.readFileSync(marker, 'utf8'));
  } catch {
    throw new Error(`${templateDir} is not a ${label}: there is no readable ${MARKER} in it`);
  }
  if (!isObject(info) || info.kind !== kind) throw new Error(`${templateDir} is not a ${label}: ${MARKER} has another kind`);
  return info;
}

/** Removes a template. A directory that is not one (no marker) is refused and left alone, so a wrong
 * argument can never delete anything else; a missing one is not an error, so cleanup can run twice.
 * `template` is the kind to expect, this module's own by default. */
export function removeTemplate(templateDir, template = CLAUDE_TEMPLATE) {
  if (!exists(templateDir)) return;
  readTemplate(templateDir, template);
  fs.rmSync(templateDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** Seeds the trial home `home`, absolute and fresh, from the template: the copy list goes in as it is,
 * then the three files that name the home are written for this one. Plugin paths (`installPath`,
 * `installLocation`, ...) point into `home`, so a plugin is loaded from the trial's own copy; and in
 * `.claude.json` the engram server gets `ENGRAM_DATA_DIR` set to `<home>/.engram` and `ENGRAM_PORT` set to
 * `engramPort` (its child process does not inherit them), because that file is where the MCP child's env comes
 * from; an `ENGRAM_URL` or `ENGRAM_SOCKET` the real entry carries is dropped, so the server can only be the
 * trial's own. `engramPort`, the trial's own port (see `ports.mjs`), is required and checked before anything is
 * copied: the real engram port is refused. A file with no engram server is left alone. Nothing here writes
 * outside `home`, and the template is only read. */
export function seedHome(templateDir, home, { engramPort } = {}) {
  requireAbsolute('home', home);
  assertTrialPort(engramPort);
  readTemplate(templateDir);
  copyEntry(path.join(templateDir, PAYLOAD), home, { followLinks: false, active: new Set(), warnings: [], what: 'the template' }, PAYLOAD);

  const plugins = path.join(home, '.claude', 'plugins');
  for (const name of PLUGIN_STATE_FILES) {
    const file = path.join(plugins, name);
    if (fs.existsSync(file)) writeJson(file, mapStrings(JSON.parse(fs.readFileSync(file, 'utf8')), (value) => untokenize(value, home)));
  }
  const claudeJson = path.join(home, '.claude', '.claude.json');
  if (fs.existsSync(claudeJson)) {
    const json = JSON.parse(fs.readFileSync(claudeJson, 'utf8'));
    if (isObject(json.mcpServers?.engram)) {
      const engram = json.mcpServers.engram;
      const { ENGRAM_URL, ENGRAM_SOCKET, ...kept } = isObject(engram.env) ? engram.env : {};
      engram.env = { ...kept, ENGRAM_DATA_DIR: path.join(home, '.engram'), ENGRAM_PORT: String(engramPort) };
    }
    writeJson(claudeJson, json);
  }
}

const JS_HARNESS = fileURLToPath(new URL('../bin/js-harness.mjs', import.meta.url));

/** Runs `js-harness init` of this checkout in `workspace` and returns the `spawnSync` result. */
function runJsHarnessInit({ workspace, env }) {
  return spawnSync(process.execPath, [JS_HARNESS, 'init'], { cwd: workspace, env, encoding: 'utf8', timeout: 120000, windowsHide: true });
}

/** The current arm's project layer: `js-harness init` in the workspace (which must already be a git
 * repository, see `prepareSandbox`), writing `harness.json`, `AGENTS.md`, the pre-commit hook and the
 * codegraph index. It runs under the trial's own sandbox env (which needs `engramPort`, like every use of it), so
 * its `codegraph init` and every write it makes in a home land in the sandbox; `env` adds variables on top
 * of it (a test puts a stub `codegraph` on `PATH`). `runInit({ workspace, env })` is injectable and returns a `spawnSync`-like result. A
 * non-zero exit, or a step `init` reports as failed (it prints `<step> failed: ...` and still exits 0, for
 * a codegraph that is not installed), rejects: a trial that went on without its project layer would score
 * a different configuration than the one it is named after. */
export async function initWorkspace({ home, workspace, engramPort, runInit = runJsHarnessInit, env: extra = {} }) {
  const env = childEnv({ ...sandboxEnv({ home, engramPort }), ...extra });
  const result = await runInit({ workspace, env });
  if (result.error) throw new Error(`js-harness init could not run in the trial workspace: ${result.error.message}`);
  const output = `${result.stderr ?? ''}`.trim() || `${result.stdout ?? ''}`.trim();
  if (result.status !== 0 || /\bfailed: /.test(result.stderr ?? '')) {
    throw new Error(`js-harness init failed in the trial workspace (exit ${result.status}): ${output}`);
  }
}

/** The `seed` of the current arm (`currentConfig({ seed })`): copies the template into the trial's home,
 * then initializes the workspace; the trial's `engramPort` comes with the context the config's `prepare` hands
 * to a seed. The template is checked now, when the seed is made, so a wrong path fails before any trial.
 * `runInit` and `env` are passed to `initWorkspace`. `without` names the components an arm of one component
 * takes out (`evals/without.mjs`), checked against the template now and taken out of each trial's home after the
 * seed; without `project`, init does not run. */
export function seedFromTemplate(templateDir, { runInit, env, without = [] } = {}) {
  readTemplate(templateDir);
  checkWithout(path.join(templateDir, PAYLOAD), without, 'claude');
  return async ({ home, workspace, engramPort }) => {
    seedHome(templateDir, home, { engramPort });
    applyWithout(home, without, 'claude');
    if (without.includes('project')) return;
    await initWorkspace({ home, workspace, engramPort, runInit, env });
  };
}
