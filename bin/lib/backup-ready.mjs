// `backup ready` (odd/tasks/backup-ready.md): whether this machine can be wiped without losing work. It compares what
// is here now with the backup clone's last manifest and asks origin what it holds, and names everything the backup is
// configured for that has no copy off this machine. It writes nothing: it runs right before a wipe.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { collectFiles, parseStats, readJson, scopeArgs, walk } from './backup.mjs';
import { bundleRefs, repoFiles, shortKey, stashesOf } from './backup-repos.mjs';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** A size as people read it. */
export function humanSize(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

/** What `backup ready` found: `missing`, each thing configured that has no copy off this machine, and `notCopied`,
 * what the backup does not copy at all, with its size. `git` runs git with no optional lock, so not even git's own
 * index refresh is written. `scope` is the backup's, as `backup run` reads it. */
export function readiness({ home, clone, config, scope, desktop, run, env = {} }) {
  const git = (cwd, args, options = {}) =>
    run('git', ['-C', cwd, ...args], { env: { ...env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_OPTIONAL_LOCKS: '0' }, ...options });
  const missing = [];
  const manifest = readJson(path.join(clone, 'manifest.json'));
  if (!manifest) missing.push(`the backup clone ${clone} holds no backup yet: run js-harness backup run`);
  missing.push(...cloneState(git, clone));
  if (manifest) {
    missing.push(...homeState({ home, scope, desktop, manifest, run }));
    for (const source of Array.isArray(config.bundles) ? config.bundles : []) missing.push(...repoState(git, source, manifest));
  }
  return { missing, notCopied: notCopied(home, desktop) };
}

/** The backup clone against its origin: never pushed, ahead, behind, or holding what no run committed. */
function cloneState(git, clone) {
  if (!fs.existsSync(path.join(clone, '.git'))) return [`there is no backup clone at ${clone}: run js-harness backup init`];
  const found = [];
  if (git(clone, ['status', '--porcelain']).stdout.trim()) found.push(`the backup clone ${clone} holds changes no backup committed`);
  const head = git(clone, ['rev-parse', 'HEAD']);
  const branch = git(clone, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (head.status !== 0) return [...found, `the backup clone ${clone} has no commit: run js-harness backup run`];
  const local = head.stdout.trim();
  const remote = git(clone, ['ls-remote', 'origin', `refs/heads/${branch}`], { timeout: 120_000 });
  if (remote.status !== 0) {
    return [...found, `the backup clone's origin could not be read, so nothing says the backup is off this machine: ${`${remote.stderr || 'no answer within the time limit'}`.trim().split('\n')[0]}`];
  }
  const pushed = remote.stdout.split(/\s/)[0];
  if (!pushed) return [...found, `the backup clone ${clone} was never pushed`];
  if (pushed === local) return found;
  if (git(clone, ['merge-base', '--is-ancestor', pushed, local]).status === 0) {
    const ahead = git(clone, ['rev-list', '--count', `${pushed}..${local}`]).stdout.trim();
    return [...found, `the backup clone is ${ahead} commits ahead of origin: they are on this machine only`];
  }
  return [...found, `the backup clone is behind origin or apart from it (origin ${pushed.slice(0, 8)}, here ${local.slice(0, 8)}): run js-harness backup run`];
}

/** The memory, the home and the config against the last backup, by the same copy `backup run` makes, made without
 * writing; and Engram's counts against the ones the last backup recorded. */
function homeState({ home, scope, desktop, manifest, run }) {
  const found = [];
  const { files } = collectFiles({ home, scope, desktop, write: false });
  const backed = new Map((manifest.files ?? []).map((f) => [f.path, f.sha256]));
  const changed = files.filter((f) => backed.get(f.path) !== f.sha256).map((f) => f.path);
  if (changed.length) found.push(`${changed.length} files changed since the last backup: ${listed(changed)}`);
  const stats = run('engram', ['stats', ...scopeArgs(scope)]);
  const live = stats.status === 0 ? parseStats(stats.stdout) : null;
  if (!live) found.push(`Engram's counts could not be read, so nothing says its memory is in the backup`);
  else {
    const differ = Object.keys(live).filter((key) => live[key] !== manifest.live?.[key]);
    for (const key of differ) found.push(`Engram holds ${live[key]} ${key}, the last backup ${manifest.live?.[key] ?? 'none'}`);
  }
  return found;
}

/** One configured repository against its entry in the last backup: a remote, the bundle, each stash entry, each
 * worktree's uncommitted edits and the git directory's records. */
function repoState(git, source, manifest) {
  const key = path.resolve(source);
  const entry = (manifest.bundles ?? []).find((b) => b.source === key);
  const { listed: refs, reason } = bundleRefs(git, source);
  if (!refs) return [`${source} could not be read (${reason}), so nothing says its work is in the backup`];
  const found = [];
  if (!git(source, ['remote']).stdout.trim()) found.push(`${source} has no remote: its commits are in the bundle only`);
  const bundled = (entry?.refs ?? []).map((line) => line.split(' ')[0]);
  // A stash entry has its own line below, so its two commits are not counted here as well.
  const commits = refs.filter((line) => !/ refs\/(stash|js-harness\/stash\/\d+)$/.test(line)).map((line) => line.split(' ')[0]);
  const input = `${commits.join('\n')}\n--not\n--remotes\n${bundled.join('\n')}\n`;
  // A failed count is a gap, never zero: this check decides whether a disk may be wiped.
  const counted = git(source, ['rev-list', '--count', '--ignore-missing', '--stdin'], { input });
  const outside = counted.status === 0 ? Number(counted.stdout.trim()) || 0 : null;
  if (outside === null) found.push(`${source}: git could not count its commits outside the bundle`);
  else if (outside) found.push(`${source}: ${outside} commits on no remote are not in the latest bundle`);
  for (const stash of stashesOf(git, source)) {
    if (!bundled.includes(stash.sha)) found.push(`${source}: ${stash.name} (${stash.subject}) is in no bundle`);
  }
  const now = repoFiles(git, source);
  if (!now) return [...found, `${source}: its worktrees and records could not be read`];
  const folder = `git/${shortKey(source)}/`;
  const backed = new Map((manifest.files ?? []).filter((f) => f.path.startsWith(folder)).map((f) => [f.path.slice(folder.length), f.sha256]));
  const stale = new Set(now.files.filter((f) => backed.get(f.path) !== sha256(f.buffer)).map((f) => f.path));
  for (const w of now.worktrees) {
    if ([...stale].some((p) => p === `worktrees/${w.key}.patch` || p.startsWith(`worktrees/${w.key}.untracked/`) || p.startsWith(`worktrees/${w.key}.binary/`))) {
      found.push(`${w.path}: uncommitted edits the last backup does not hold`);
    }
  }
  const records = [...stale].filter((p) => p.startsWith('js-harness/'));
  if (records.length) found.push(`${source}: records in .git/js-harness changed since the last backup: ${listed(records)}`);
  for (const big of now.skipped) {
    found.push(big.bytes === undefined ? `${big.path}: ${big.kind}, not copied` : `${big.path}: ${big.kind ?? 'untracked'}, ${humanSize(big.bytes)}, too large to copy`);
  }
  return found;
}

/** What the backup does not copy, by design until he decides: the Claude transcripts, and Claude Desktop's folder
 * besides its notes and presets. */
function notCopied(home, desktop) {
  const projects = path.join(home, '.claude', 'projects');
  const transcripts = walk(projects, (relative, isDir) => isDir && relative.includes('/'))
    .filter((relative) => relative.split('/').length === 2 && relative.endsWith('.jsonl'))
    .map((relative) => fs.statSync(path.join(projects, relative)).size);
  const found = [{ what: `Claude transcripts (${path.join(projects, '*', '*.jsonl')})`, files: transcripts.length, bytes: transcripts.reduce((a, b) => a + b, 0) }];
  if (desktop && fs.existsSync(desktop)) {
    const sizes = walk(desktop, (relative) => relative === 'side-session-notes' || relative === 'ccd-session-presets.json').map((relative) => {
      try {
        return fs.statSync(path.join(desktop, relative)).size;
      } catch {
        return 0;
      }
    });
    found.push({ what: `Claude Desktop data (${desktop}), besides its notes and presets`, files: sizes.length, bytes: sizes.reduce((a, b) => a + b, 0) });
  }
  return found;
}

/** Up to five names, and how many more. */
function listed(names) {
  return names.length > 5 ? `${names.slice(0, 5).join(', ')} and ${names.length - 5} more` : names.join(', ');
}
