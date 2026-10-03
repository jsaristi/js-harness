// Per-turn context payload measurement for Claude Code and Codex — see
// odd/tasks/f2-context-diet.md. Read-only: every function here reads files, never runs a hook.
import fs from 'node:fs';
import path from 'node:path';

/** Rough token estimate: ~4 chars per token. */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/** Reads `filePath` and returns its estimated token count, or `null` if it cannot be read as a
 * file (missing, a directory, no permission) — `check` reports it as not found, never crashes. */
function tokensOf(filePath) {
  try {
    return estimateTokens(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/** One measured source: `{ name, path, tokens }` — `tokens: null` when the file is missing. */
function source(name, filePath) {
  return { name, path: filePath, tokens: tokensOf(filePath) };
}

/** Reads and `JSON.parse`s `filePath`; `null` on a missing file or malformed JSON — never throws,
 * so a bad `settings.json`/`hooks.json` reads as absent rather than crashing `check`. */
function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/** The auto-memory index slug for `cwd`: `path.resolve(cwd)` with every character outside
 * `[A-Za-z0-9]` replaced by `-` (e.g. `D:\js-harness` -> `D--js-harness`). */
function memorySlug(cwd) {
  return path.resolve(cwd).replace(/[^A-Za-z0-9]/g, '-');
}

/** The `name:` field from a file's leading `---`-delimited YAML frontmatter, or `null` if there is
 * no frontmatter block or no `name:` line in it. A flat `key: value` reader, not a general YAML
 * parser — good enough for the skill/style files that use this convention. */
function readFrontmatterName(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return null;
  const nameLine = block[1].split(/\r?\n/).find((line) => /^name:\s*/.test(line));
  if (!nameLine) return null;
  const value = nameLine.replace(/^name:\s*/, '').trim();
  const quoted = value.match(/^(['"])(.*)\1$/);
  return quoted ? quoted[2] : value;
}

/** The output-style `.md` file in `dir` whose frontmatter `name:` (preferred) or basename (without
 * `.md`) equals `styleName`, case-insensitively; `null` if `dir` doesn't exist or nothing matches. */
function findOutputStyleFile(dir, styleName) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const mdFiles = entries.filter((name) => name.endsWith('.md'));
  const wanted = styleName.toLowerCase();

  for (const name of mdFiles) {
    const filePath = path.join(dir, name);
    const frontmatterName = readFrontmatterName(filePath);
    if (frontmatterName && frontmatterName.toLowerCase() === wanted) return filePath;
  }
  for (const name of mdFiles) {
    if (path.basename(name, '.md').toLowerCase() === wanted) return path.join(dir, name);
  }
  return null;
}

/** Claude's output-style source: reads `settings.outputStyle`, matches it against
 * `<home>/.claude/output-styles/*.md`, and returns `null` (source omitted) when there is no
 * `outputStyle` setting at all. A style that is set but unmatched is a built-in or plugin style:
 * still reported, with `path: null, tokens: null`. */
function outputStyleSource(home) {
  const settings = readJson(path.join(home, '.claude', 'settings.json'));
  const outputStyle = settings && typeof settings.outputStyle === 'string' ? settings.outputStyle : null;
  if (!outputStyle) return null;

  const match = findOutputStyleFile(path.join(home, '.claude', 'output-styles'), outputStyle);
  return match ? source('output style', match) : { name: 'output style', path: null, tokens: null };
}

const TOML_ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\' };

/** Unescapes a TOML basic string body (already stripped of its surrounding quotes): the documented
 * backslash escapes, plus `\uXXXX`/`\UXXXXXXXX` Unicode escapes. */
function unescapeTomlBasicString(body) {
  return body.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/gs, (whole, esc) => {
    if (esc[0] === 'u' || esc[0] === 'U') {
      const codePoint = parseInt(esc.slice(1), 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : whole;
    }
    return TOML_ESCAPES[esc] ?? whole;
  });
}

/** Resolves Codex's `model_instructions_file` value against the directory of the `config.toml`
 * that defines it (`<home>/.codex`), the same way Codex's own config loader does
 * (`deserialize_config_toml_with_base` in openai/codex `codex-rs/core/src/config/mod.rs`). An
 * absolute value is kept as-is. */
function resolveModelInstructionsPath(home, value) {
  return path.isAbsolute(value) ? value : path.resolve(path.join(home, '.codex'), value);
}

/** Codex's `model_instructions_file` config value: the top-level (before the first `[table]`
 * header) `model_instructions_file` line in `<home>/.codex/config.toml`, as a TOML basic string
 * (unescaped) or literal string (verbatim), with an optional trailing `#` comment. `null` when the
 * file is missing or the key is absent above the first table. */
function modelInstructionsFile(home) {
  let text;
  try {
    text = fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8');
  } catch {
    return null;
  }
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) break; // first table header ends the top-level section
    const match = line.match(/^\s*model_instructions_file\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(?:#.*)?$/);
    if (match) return match[1] !== undefined ? unescapeTomlBasicString(match[1]) : match[2];
  }
  return null;
}

const CONTEXT_HOOK_EVENTS = ['UserPromptSubmit', 'SessionStart'];

/** Context-injecting hook commands from a Claude/Codex hooks config: only `UserPromptSubmit` and
 * `SessionStart` add their stdout to the model's context, so only those events are read, in
 * configured order. Missing or malformed JSON yields no hooks, never a throw. */
function readHooks(configPath, plugin) {
  const config = readJson(configPath);
  const hooksConfig = config && typeof config === 'object' ? config.hooks : null;
  if (!hooksConfig || typeof hooksConfig !== 'object') return [];

  const hooks = [];
  for (const event of CONTEXT_HOOK_EVENTS) {
    const matchers = hooksConfig[event];
    if (!Array.isArray(matchers)) continue;
    for (const matcher of matchers) {
      const entries = matcher && Array.isArray(matcher.hooks) ? matcher.hooks : [];
      for (const entry of entries) {
        if (entry && typeof entry.command === 'string') {
          hooks.push(plugin ? { event, command: entry.command, plugin } : { event, command: entry.command });
        }
      }
    }
  }
  return hooks;
}

function totalTokens(sources) {
  return sources.reduce((sum, s) => sum + (s.tokens ?? 0), 0);
}

/** The plugin ids enabled across the settings layers: a later layer's `enabledPlugins` entry
 * overrides an earlier one, and only `true` counts as enabled. */
function enabledPluginIds(settingsPaths) {
  const enabled = new Map();
  for (const settingsPath of settingsPaths) {
    const plugins = readJson(settingsPath)?.enabledPlugins;
    if (!plugins || typeof plugins !== 'object') continue;
    for (const [id, value] of Object.entries(plugins)) enabled.set(id, value === true);
  }
  return [...enabled].filter(([, on]) => on).map(([id]) => id);
}

/** The context hooks of every enabled plugin, each tagged with its plugin id: the plugin's
 * `hooks/hooks.json` under the `installPath` recorded in `installed_plugins.json` (the same shape
 * as a settings file). A plugin with no install record, no hooks file or malformed JSON adds nothing. */
function pluginHooks(home, cwd, settingsPaths) {
  const installed = readJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'))?.plugins;
  return enabledPluginIds(settingsPaths).flatMap((id) => {
    const record = applicableInstallRecord(installed && typeof installed === 'object' ? installed[id] : null, cwd);
    return record ? readHooks(path.join(record.installPath, 'hooks', 'hooks.json'), id) : [];
  });
}

/** Whether two paths are the same directory once resolved; Windows paths compare case-insensitively. */
function samePath(a, b) {
  const [x, y] = [path.resolve(a), path.resolve(b)];
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** The one install record of a plugin that applies to the project at `cwd`: a record bound to that
 * project (`projectPath`, as a `project` or `local` install writes it) wins over a user-level one
 * (`scope: "user"`, or no scope and no `projectPath`). A record bound to another project, or a
 * `project`/`local` one that names none, never applies. */
function applicableInstallRecord(records, cwd) {
  const usable = (Array.isArray(records) ? records : []).filter((r) => typeof r?.installPath === 'string');
  const bound = usable.find((r) => typeof r.projectPath === 'string' && samePath(r.projectPath, cwd));
  if (bound) return bound;
  const userLevel = (r) => typeof r.projectPath !== 'string' && r.scope !== 'project' && r.scope !== 'local';
  return usable.find(userLevel) ?? null;
}

/** Claude's context-injecting hook commands, concatenated the same way Claude Code itself merges
 * settings layers: user (`<home>/.claude/settings.json`), then project (`<cwd>/.claude/settings.json`),
 * then project-local (`<cwd>/.claude/settings.local.json`), followed by the hooks of the enabled
 * plugins. A missing or malformed file contributes nothing, never throws. */
function claudeHooks(home, cwd) {
  const settingsPaths = [
    path.join(home, '.claude', 'settings.json'),
    path.join(cwd, '.claude', 'settings.json'),
    path.join(cwd, '.claude', 'settings.local.json'),
  ];
  const settingsHooks = settingsPaths.flatMap((settingsPath) => readHooks(settingsPath));
  return [...settingsHooks, ...pluginHooks(home, cwd, settingsPaths)];
}

/** Claude's per-turn sources, in load order: global `CLAUDE.md`, the active output style, the
 * project's `AGENTS.md` and (if present) `CLAUDE.md`, and the auto-memory index. */
function claudeHost(home, cwd) {
  const sources = [source('global CLAUDE.md', path.join(home, '.claude', 'CLAUDE.md'))];

  const style = outputStyleSource(home);
  if (style) sources.push(style);

  sources.push(source('project AGENTS.md', path.join(cwd, 'AGENTS.md')));

  const projectClaudeMd = path.join(cwd, 'CLAUDE.md');
  if (fs.existsSync(projectClaudeMd)) sources.push(source('project CLAUDE.md', projectClaudeMd));

  sources.push(
    source('memory index', path.join(home, '.claude', 'projects', memorySlug(cwd), 'memory', 'MEMORY.md')),
  );

  return {
    host: 'claude',
    sources,
    total: totalTokens(sources),
    hooks: claudeHooks(home, cwd),
  };
}

/** Codex's per-turn sources, in load order: global `AGENTS.md` (or its override), the configured
 * model-instructions file (if set), and the project's `AGENTS.md` (or its override). */
function codexHost(home, cwd) {
  const overridePath = path.join(home, '.codex', 'AGENTS.override.md');
  const globalAgentsPath = fs.existsSync(overridePath) ? overridePath : path.join(home, '.codex', 'AGENTS.md');
  const sources = [source('global AGENTS.md', globalAgentsPath)];

  const instructionsFile = modelInstructionsFile(home);
  if (instructionsFile) {
    sources.push(source('model instructions', resolveModelInstructionsPath(home, instructionsFile)));
  }

  const projectOverridePath = path.join(cwd, 'AGENTS.override.md');
  const projectAgentsPath = fs.existsSync(projectOverridePath) ? projectOverridePath : path.join(cwd, 'AGENTS.md');
  sources.push(source('project AGENTS.md', projectAgentsPath));

  return {
    host: 'codex',
    sources,
    total: totalTokens(sources),
    hooks: readHooks(path.join(home, '.codex', 'hooks.json')),
  };
}

/** The full per-turn context payload for both hosts rooted at `home`/`cwd`: each host's sources
 * with their estimated tokens, a host total, and the context-injecting hook commands. Read-only —
 * never executes a hook, only reports its configured command. */
export function measurePayload({ home, cwd }) {
  return { hosts: [claudeHost(home, cwd), codexHost(home, cwd)] };
}
