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
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sandboxEnv } from './configs.mjs';
import { exists, isWithin, resolveReal } from './paths.mjs';
import { childEnv } from './runner.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireAbsolute = (label, value) => {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`the ${label} must be an absolute path, got ${JSON.stringify(value)}`);
};

/** What the template's marker file says it is. `removeTemplate` and `seedHome` trust nothing without it, so
 * a mistyped directory is never emptied or seeded from. */
export const TEMPLATE_KIND = 'js-harness-eval-home-template';
const MARKER = 'template.json';
// The template keeps its copy of the home in a subdirectory, next to the marker.
const PAYLOAD = 'home';

// What is taken from `<real home>/.claude/`. Plugin state is separate: its paths are rewritten.
const CLAUDE_ITEMS = ['settings.json', 'CLAUDE.md', 'skills', 'agents', 'commands', 'output-styles', 'hooks'];
const PLUGIN_STATE_FILES = ['installed_plugins.json', 'known_marketplaces.json'];
// `marketplaces/` is copied although only `cache/` holds the plugins: `known_marketplaces.json` points each
// marketplace's `installLocation` there, and a marketplace that is not on disk is one Claude Code may try
// to clone again at startup, which is network and a write. Unverified until the real run (T2c).
const PLUGIN_DIRS = ['cache', 'marketplaces'];

// What a real-home path becomes inside the template: the trial's home is not known until a trial seeds
// itself, so `seedHome` swaps this prefix for it. The template then names no path of the real machine.
const HOME_TOKEN = '@@TRIAL_HOME@@';

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

const isDirectory = (target) => fs.statSync(target, { throwIfNoEntry: false })?.isDirectory() === true;

/** Copies `source` to `target`, file by file, never creating a link. A link in `source` is followed when
 * `ctx.followLinks` (its target's content is copied and its place listed in `ctx.warnings`; a dangling one
 * is skipped and listed), and an error otherwise. A directory already being copied higher up the walk
 * (reached again through a link) is a cycle: an error, not an endless copy. Special files (sockets, pipes)
 * are skipped. `label` is the path shown in messages, relative to the item's root, never absolute. */
function copyEntry(source, target, ctx, label) {
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
function inventory(root) {
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
function countRealHome(text, realHome) {
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
    return writeTemplate({ realHome, templateDir, claude, copyFile });
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

  const files = inventory(payload);
  const bytes = files.reduce((total, file) => total + file.size, 0);
  fs.writeFileSync(path.join(templateDir, MARKER), `${JSON.stringify({ kind: TEMPLATE_KIND, version: 1, builtAt: new Date().toISOString(), files, bytes, warnings }, null, 2)}\n`);
  return { templateDir, files: files.length, bytes, warnings };
}

/** The marker of the template in `templateDir`; an error when the directory is not one. */
function readTemplate(templateDir) {
  const marker = path.join(templateDir, MARKER);
  let info;
  try {
    info = JSON.parse(fs.readFileSync(marker, 'utf8'));
  } catch {
    throw new Error(`${templateDir} is not a js-harness eval home template: there is no readable ${MARKER} in it`);
  }
  if (!isObject(info) || info.kind !== TEMPLATE_KIND) throw new Error(`${templateDir} is not a js-harness eval home template: ${MARKER} has another kind`);
  return info;
}

/** Removes a template. A directory that is not one (no marker) is refused and left alone, so a wrong
 * argument can never delete anything else; a missing one is not an error, so cleanup can run twice. */
export function removeTemplate(templateDir) {
  if (!exists(templateDir)) return;
  readTemplate(templateDir);
  fs.rmSync(templateDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** Seeds the trial home `home`, absolute and fresh, from the template: the copy list goes in as it is,
 * then the three files that name the home are written for this one. Plugin paths (`installPath`,
 * `installLocation`, ...) point into `home`, so a plugin is loaded from the trial's own copy; and in
 * `.claude.json` the engram server gets `ENGRAM_DATA_DIR` set to `<home>/.engram` (its child process does
 * not inherit one), because that file is where the MCP child's env comes from. A file with no engram server
 * is left alone. Nothing here writes outside `home`, and the template is only read. */
export function seedHome(templateDir, home) {
  requireAbsolute('home', home);
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
      engram.env = { ...(isObject(engram.env) ? engram.env : {}), ENGRAM_DATA_DIR: path.join(home, '.engram') };
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
 * codegraph index. It runs under the trial's own sandbox env, so its `codegraph init` and every write it
 * makes in a home land in the sandbox; `env` adds variables on top of it (a test puts a stub `codegraph`
 * on `PATH`). `runInit({ workspace, env })` is injectable and returns a `spawnSync`-like result. A
 * non-zero exit, or a step `init` reports as failed (it prints `<step> failed: ...` and still exits 0, for
 * a codegraph that is not installed), rejects: a trial that went on without its project layer would score
 * a different configuration than the one it is named after. */
export async function initWorkspace({ home, workspace, runInit = runJsHarnessInit, env: extra = {} }) {
  const env = childEnv({ ...sandboxEnv({ home }), ...extra });
  const result = await runInit({ workspace, env });
  if (result.error) throw new Error(`js-harness init could not run in the trial workspace: ${result.error.message}`);
  const output = `${result.stderr ?? ''}`.trim() || `${result.stdout ?? ''}`.trim();
  if (result.status !== 0 || /\bfailed: /.test(result.stderr ?? '')) {
    throw new Error(`js-harness init failed in the trial workspace (exit ${result.status}): ${output}`);
  }
}

/** The `seed` of the current arm (`currentConfig({ seed })`): copies the template into the trial's home,
 * then initializes the workspace. The template is checked now, when the seed is made, so a wrong path
 * fails before any trial. `runInit` and `env` are passed to `initWorkspace`. */
export function seedFromTemplate(templateDir, { runInit, env } = {}) {
  readTemplate(templateDir);
  return async ({ home, workspace }) => {
    seedHome(templateDir, home);
    await initWorkspace({ home, workspace, runInit, env });
  };
}
