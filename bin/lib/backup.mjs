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
  // Its body is base64, dashes and line breaks, raw or escaped in JSON (`\n`), so a key with no end stops at a quote.
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:[A-Za-z0-9+/=\s-]|\\n)*(?:[A-Z ]*PRIVATE KEY-----)?/g],
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
    /((?:"[A-Za-z0-9_.-]*(?:token|secret|password|passwd|api_?key|authorization)"|\b[A-Za-z0-9_.-]*(?:token|secret|password|passwd|api_?key|authorization))\s*[:=]\s*"?)[^"\s\\]{20,}/gi,
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
function walk(dir, skip = () => false, prefix = '') {
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
function trees(home, scope) {
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
      // The backup's own folder holds the clone itself; logs are rewritten on every run and restore nothing.
      skip: (relative, isDir) =>
        (isDir && (relative === 'memory-backup' || relative === 'gate-log')) || (!isDir && relative.endsWith('.log')),
    },
    // Reference copies (D1): a restore puts them beside the live files, never over them. Login files never come.
    ...CONFIG_FILES.map(([from, to]) => ({ from: path.join(home, ...from), to: `config/${to}`, skip: () => false })),
  ];
}

/** The config the backup keeps a reference copy of: [path under the home, path under `config/`]. A file is a tree of one. */
const CONFIG_FILES = [
  [['.claude', 'CLAUDE.md'], 'claude/CLAUDE.md'],
  [['.claude', 'settings.json'], 'claude/settings.json'],
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
 * project's memory folders are copied, and another project's copy left from a wider scope is removed. The home is
 * only read. */
export function collectFiles({ home, dest, scope = 'all' }) {
  const files = [];
  const redacted = [];
  const kept = new Set();
  for (const tree of trees(home, scope)) {
    for (const relative of treeFiles(tree)) {
      const target = relative ? `${tree.to}/${relative}` : tree.to;
      let buffer = fs.readFileSync(relative ? path.join(tree.from, relative) : tree.from);
      const scan = redactSecrets(buffer.toString('utf8'));
      if (scan.kinds.length > 0) {
        buffer = Buffer.from(scan.text, 'utf8');
        redacted.push({ path: target, kinds: scan.kinds });
      }
      const out = path.join(dest, target);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buffer);
      files.push({ path: target, bytes: buffer.length, sha256: sha256(buffer) });
      kept.add(target);
    }
  }
  for (const root of MIRRORED) {
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

/** `owner/name` of a GitHub remote URL (https or ssh), or `null`. */
export function repoOf(url) {
  return String(url).trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/)?.[1] ?? null;
}

/** The public repository the full backup must never reach (S7). */
export const PUBLIC_REPO = 'jsaristi/js-harness';

/** Why a push of the full backup must not go, or `null` when it may: the clone's origin must be the configured
 * repository, that repository is never the public one, and its visibility, read just before, must be `PRIVATE`. */
export function pushRefusal({ origin, repo, visibility }) {
  const named = repoOf(origin);
  if (repo.toLowerCase() === PUBLIC_REPO || named?.toLowerCase() === PUBLIC_REPO) {
    return `refused: ${PUBLIC_REPO} is the public repository, and the full backup never goes there`;
  }
  if (named?.toLowerCase() !== repo.toLowerCase()) return `refused: the clone's origin is ${named ?? origin}, not ${repo}`;
  if (!visibility) return `refused: the visibility of ${repo} could not be read, so it is not known to be private`;
  if (visibility !== 'PRIVATE') return `refused: ${repo} reads ${visibility}, not PRIVATE`;
  return null;
}
