// The memory backup's library (odd/tasks/memory-backup.md): what one backup copies into the private clone and how it
// reads it back. Zero dependencies: `engram` and `git` are run as programs, everything else is Node's fs.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const REDACTED = '<redacted>';

/** The secrets a file may hold, each with the name a manifest gives it and the pattern of its value. The value is
 * blanked in the copy, private repository or not: a private repository is one leaked token or one visibility flip
 * away from public (D1). A pattern's first group, when it has one, is the part kept before the value. Values never
 * hold a quote or a backslash, so a blanked JSON document stays JSON. */
const SECRETS = [
  // Through its END line, never past a quote. A key with no END, through each base64 run after it, past spaces and line
  // breaks raw or escaped in JSON: a run of 16 or more, or a shorter one that ends its line, then a cut END's dashes.
  // Prose words are short and end in a space, so the prose after a key is kept either way. The empty first group is the
  // part kept (nothing); the second is the key's type, so the END matched is its own.
  [
    'private key',
    /()-----BEGIN ([A-Z ]*)PRIVATE KEY-----(?:[^"]*?-----END \2PRIVATE KEY-----|(?:(?:[ \t]|\r?\n|\\(?:r\\)?n)+(?:[A-Za-z0-9+/=]{16,}|[A-Za-z0-9+/=]+(?=\r?\n|\\(?:r\\)?n|"|$)))*(?:(?:\r?\n|\\(?:r\\)?n)-+(?="|$))?)/g,
  ],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g],
  // `sk-ant-api03-…`: a run of 20 or more without a hyphen, holding a digit, so `risk-assessment-…` is not one; or a
  // UUID after `sk-`, the shape of the Context7 key found in this machine's backups (round 2 of the readers).
  ['API key', /\b[a-z0-9]*sk-(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|(?:[a-z0-9]+-)*(?=[A-Za-z_]*\d)[A-Za-z0-9_]{20,})/gi],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,}/g],
  ['AWS key', /\bAKIA[A-Z0-9]{16}\b/g],
  ['bearer token', /(\bBearer\s+)[A-Za-z0-9._~+/=-]{20,}/g],
  // A field named like a credential, in JSON, TOML or an env line, whose value is long enough to be one: "short" is a
  // placeholder. Its name may carry a prefix (`CONTEXT7_API_KEY`, `refresh_token`, `accessToken`).
  [
    'credential field',
    // Its quotes may be escaped (`\"password\":\"…\"`): an Engram export holds a note's JSON inside a JSON string.
    /((?:\\?"[A-Za-z0-9_.-]*(?:token|secret|password|passwd|api_?key|authorization)\\?"|\b[A-Za-z0-9_.-]*(?:token|secret|password|passwd|api_?key|authorization))\s*[:=]\s*(?:\\?")?)[^"\s\\]{20,}/gi,
  ],
];

/** `text` with every secret value replaced by `<redacted>`, and the kinds found, in the order of `SECRETS`. */
export function redactSecrets(text) {
  const kinds = [];
  let out = text;
  for (const [name, pattern] of SECRETS) {
    let found = false;
    out = out.replace(pattern, (whole, kept) => {
      found = true;
      return (typeof kept === 'string' ? kept : '') + REDACTED;
    });
    if (found) kinds.push(name);
  }
  return { text: out, kinds };
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** Every file under `dir`, as paths relative to it with forward slashes; `skip(relative, isDir)` prunes. */
export function walk(dir, skip = () => false, prefix = '') {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (skip(relative, entry.isDirectory())) return [];
    if (entry.isDirectory()) return walk(path.join(dir, entry.name), skip, relative);
    return entry.isFile() ? [relative] : [];
  });
}

/** The engram flags of a scope: `'all'` backs up every project, any other value the one project of that name. */
export function scopeArgs(scope) {
  if (typeof scope !== 'string' || scope === '') throw new Error('the backup scope is "all" or a project name');
  return scope === 'all' ? ['--all'] : ['--project', scope];
}

/** Whether a Claude project folder belongs to the scope: under a project scope, the folder of a checkout whose last
 * path part is the project (`D--js-harness`) or of a worktree inside it (`D--js-harness--claude-worktrees-x`). */
export function inScope(slug, scope) {
  return scope === 'all' || slug.endsWith(`--${scope}`) || slug.includes(`--${scope}--`);
}

/** The trees one backup mirrors: where each comes from under the home, where it goes in the clone, and what it skips. */
function trees(home, scope, desktop) {
  const projects = path.join(home, '.claude', 'projects');
  const memoryTrees = walk(projects, (relative, isDir) => isDir && relative.split('/').length === 2 && !relative.endsWith('/memory'))
    .filter((relative) => relative.split('/')[1] === 'memory')
    .map((relative) => relative.split('/')[0]);
  const slugs = [...new Set(memoryTrees)].filter((slug) => inScope(slug, scope)).sort();
  return [
    ...slugs.map((slug) => ({
      from: path.join(projects, slug, 'memory'),
      to: `claude/projects/${slug}/memory`,
      skip: () => false,
    })),
    {
      from: path.join(home, '.js-harness'),
      to: 'js-harness-home',
      // The backup's own folder holds the clone itself; logs are rewritten on every run and restore nothing. What a
      // restore left (reference copies, bundles, its progress mark) is already in the backup it came from, and backed
      // up again it would nest a copy of the last machine's config in every generation. codex-review's per-run homes
      // hold a hard link to Codex's login (auth.json) and lock files Codex keeps open: a credential, and no memory.
      skip: (relative, isDir) =>
        (isDir && ['memory-backup', 'gate-log', 'restored-config', 'restored-bundles', 'codex-review-homes'].includes(relative)) ||
        (!isDir && (relative.endsWith('.log') || relative === 'restore-progress.json')),
    },
    // Reference copies (D1): a restore puts them beside the live files, never over them. Login files never come.
    ...CONFIG_FILES.map(([from, to]) => ({ from: path.join(home, ...from), to: `config/${to}`, skip: () => false })),
    ...(desktop ? DESKTOP_FILES.map((name) => ({ from: path.join(desktop, name), to: `config/claude-desktop/${name}`, skip: () => false })) : []),
  ];
}

/** What the backup keeps of Claude Desktop's own folder (`desktopDir`), as reference copies: the notes side sessions
 * leave for each other and the session presets. The rest of it is caches, logs and login state. */
const DESKTOP_FILES = ['side-session-notes', 'ccd-session-presets.json'];

/** Claude Desktop's folder: `%APPDATA%\Claude` on Windows, as Electron places it on the other systems. */
export function desktopDir(home, env = {}, platform = process.platform) {
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude');
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Claude');
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Claude');
}

/** The config the backup keeps a reference copy of: [path under the home, path under `config/`]. A file is a tree of one. */
const CONFIG_FILES = [
  [['.claude', 'CLAUDE.md'], 'claude/CLAUDE.md'],
  [['.claude', 'settings.json'], 'claude/settings.json'],
  // Which plugins were installed, from which marketplaces: the lists, not the plugins, which reinstall from them.
  [['.claude', 'plugins', 'installed_plugins.json'], 'claude/plugins/installed_plugins.json'],
  [['.claude', 'plugins', 'known_marketplaces.json'], 'claude/plugins/known_marketplaces.json'],
  [['.claude', 'hooks'], 'claude/hooks'],
  [['.claude', 'scheduled-tasks'], 'claude/scheduled-tasks'],
  [['.codex', 'config.toml'], 'codex/config.toml'],
  [['.codex', 'hooks.json'], 'codex/hooks.json'],
  [['.codex', 'AGENTS.md'], 'codex/AGENTS.md'],
  [['.engram', 'protocol-mode.json'], 'engram/protocol-mode.json'],
];

/** The files of a tree: every file under a folder, or the one file a tree of one names (as `''`). */
function treeFiles(tree) {
  let stat;
  try {
    stat = fs.statSync(tree.from);
  } catch {
    return [];
  }
  return stat.isFile() ? [''] : walk(tree.from, tree.skip);
}

/** Removes every folder under `dir` left with no file in it, so a project the scope dropped leaves no trace. */
function removeEmptyFolders(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sub = path.join(dir, entry.name);
    removeEmptyFolders(sub);
    if (fs.readdirSync(sub).length === 0) fs.rmdirSync(sub);
  }
}

/** The clone's folders `collectFiles` owns: a file in them the home no longer has is removed. */
const MIRRORED = ['claude', 'js-harness-home', 'config'];

/** Mirrors the Claude memory folders, the js-harness home and the config files into `dest`: each file copied with its sha256, a secret
 * value blanked and the file named with its kinds, and a file the clone holds under `claude/` or `js-harness-home/`
 * that the home no longer has removed, so the clone is the home as it is now. Under a project scope only that
 * project's memory folders are copied, and another project's copy left from a wider scope is removed. `desktop`,
 * Claude Desktop's folder, adds its `DESKTOP_FILES`. The home is only read; with `write: false` nothing is written at
 * all, and the files are only listed as a run would copy them (`backup ready` compares them with the last backup). */
export function collectFiles({ home, dest, scope = 'all', desktop, write = true }) {
  const files = [];
  const redacted = [];
  const kept = new Set();
  for (const tree of trees(home, scope, desktop)) {
    for (const relative of treeFiles(tree)) {
      const target = relative ? `${tree.to}/${relative}` : tree.to;
      const source = relative ? path.join(tree.from, relative) : tree.from;
      let buffer;
      try {
        buffer = fs.readFileSync(source);
      } catch (error) {
        throw new Error(`could not read ${source}: ${error.message}`, { cause: error });
      }
      const scan = redactSecrets(buffer.toString('utf8'));
      if (scan.kinds.length > 0) {
        buffer = Buffer.from(scan.text, 'utf8');
        redacted.push({ path: target, kinds: scan.kinds });
      }
      if (write) {
        const out = path.join(dest, target);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, buffer);
      }
      files.push({ path: target, bytes: buffer.length, sha256: sha256(buffer) });
      kept.add(target);
    }
  }
  for (const root of write ? MIRRORED : []) {
    for (const relative of walk(path.join(dest, root))) {
      const target = `${root}/${relative}`;
      if (!kept.has(target)) fs.rmSync(path.join(dest, target));
    }
    removeEmptyFolders(path.join(dest, root));
  }
  return { files, redacted };
}

const COUNTED = ['sessions', 'observations', 'prompts', 'relations'];

/** The four counts of an Engram export, the figures a restore is checked against. */
export function exportCounts(data) {
  return Object.fromEntries(COUNTED.map((key) => [key, Array.isArray(data?.[key]) ? data[key].length : 0]));
}

/** An export that lost more than this share of any count of the last backup is refused: it is what a wiped or freshly
 * reinstalled Engram looks like, and writing it over the good copy is the loss this feature exists to stop (D2). */
export const SHRINK_LIMIT = 0.1;

/** Runs a program with no shell, so an argument with spaces (a commit message) stays one argument; `engram`, `git` and
 * `gh` are executables on every host (`where` on this machine names three `.exe`). */
export function defaultRun(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? String(result.error ?? '') };
}

/** An export's text with its `exported_at` left out, so two exports of the same memory compare equal. */
function withoutTime(data) {
  const { exported_at: _time, ...rest } = data;
  return JSON.stringify(rest);
}

/** Runs `engram export` for the scope (every project, or one) into a temporary file beside the clone, reads it back,
 * blanks its secrets, and only then puts it in place as the clone's `engram/export.json`. Throws, leaving the previous
 * export as it was, when the export fails, is not JSON, or holds fewer of any count than the last one by more than
 * `SHRINK_LIMIT` (unless `allowShrink`). When the new export differs from the last only in `exported_at`, the file is
 * left untouched (`changed: false`). */
export function exportEngram({ dest, run = defaultRun, allowShrink = false, scope = 'all' }) {
  const dir = path.join(dest, 'engram');
  const target = path.join(dir, 'export.json');
  // The raw export holds every secret: it lives outside the clone, so a run killed before its cleanup leaves nothing a
  // later `git add -A` would push, and under one fixed name, so the next run overwrites what a dead one left.
  const temp = `${dest}.export.tmp`;
  fs.mkdirSync(dir, { recursive: true });
  try {
    const result = run('engram', ['export', temp, ...scopeArgs(scope)]);
    if (result.status !== 0) throw new Error(`engram export failed: ${(result.stderr || result.stdout).trim()}`);
    const scan = redactSecrets(readText(temp));
    let data;
    try {
      data = JSON.parse(scan.text);
    } catch {
      throw new Error('engram export is not readable JSON');
    }
    const counts = exportCounts(data);
    const previous = readJson(target);
    if (previous && !allowShrink) {
      const before = exportCounts(previous);
      const lost = COUNTED.find((key) => counts[key] < before[key] * (1 - SHRINK_LIMIT));
      if (lost) {
        throw new Error(
          `the export holds ${counts[lost]} ${lost}, the last backup ${before[lost]}: refused, because a wiped ` +
            'Engram looks like this (run with --allow-shrink if the drop is meant)',
        );
      }
    }
    if (previous && withoutTime(previous) === withoutTime(data)) return { counts, changed: false, kinds: scan.kinds };
    fs.writeFileSync(temp, scan.text);
    fs.renameSync(temp, target);
    return { counts, changed: true, kinds: scan.kinds };
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** The three counts `engram stats` prints (it prints no relations), or `null` when one of them is missing. */
export function parseStats(text) {
  const read = (label) => text.match(new RegExp(`^\\s*${label}:\\s+(\\d+)`, 'm'))?.[1];
  const values = ['Sessions', 'Observations', 'Prompts'].map(read);
  if (values.some((value) => value === undefined)) return null;
  const [sessions, observations, prompts] = values.map(Number);
  return { sessions, observations, prompts };
}

/** The clone's `manifest.json`: what the backup holds and the figures a restore is checked against. It holds no time,
 * so it changes only when the content does, and a run with nothing new commits nothing (D1). */
export function buildManifest({ machine, engramVersion, counts, live, files, redacted }) {
  const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = {
    format: 1,
    machine,
    engramVersion,
    export: counts,
    live,
    files: [...files].sort(byPath),
    redacted: [...redacted].sort(byPath),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** `owner/name` of a remote URL on github.com itself (https, or ssh as `git@github.com:` or `ssh://`), or `null`: a
 * host that only contains the name (`notgithub.com`, `github.com.evil.example`) is not GitHub. */
export function repoOf(url) {
  const match = String(url)
    .trim()
    .match(/^(?:https:\/\/(?:[^@/\s]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i);
  return match?.[1] ?? null;
}

/** The public repository the full backup must never reach (S7). */
export const PUBLIC_REPO = 'jsaristi/js-harness';

/** Why a push of the full backup must not go, or `null` when it may: every URL of the clone's remote, fetch and push
 * (a `pushurl` or `pushInsteadOf` sends the push elsewhere), must be the configured repository, that repository is
 * never the public one, and its visibility, read just before, must be `PRIVATE`. */
export function pushRefusal({ urls, repo, visibility }) {
  if (!urls?.length) return `refused: the clone has no remote to push to`;
  const named = urls.map((url) => ({ url, repo: repoOf(url) }));
  if (repo.toLowerCase() === PUBLIC_REPO || named.some((n) => n.repo?.toLowerCase() === PUBLIC_REPO)) {
    return `refused: ${PUBLIC_REPO} is the public repository, and the full backup never goes there`;
  }
  const stray = named.find((n) => n.repo?.toLowerCase() !== repo.toLowerCase());
  if (stray) return `refused: the clone's remote is ${stray.repo ?? stray.url}, not ${repo}`;
  if (!visibility) return `refused: the visibility of ${repo} could not be read, so it is not known to be private`;
  if (visibility !== 'PRIVATE') return `refused: ${repo} reads ${visibility}, not PRIVATE`;
  return null;
}
