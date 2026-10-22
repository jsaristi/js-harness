#!/usr/bin/env node
// `backup`: the memory that survives the machine (odd/tasks/memory-backup.md). The full copy goes to a private GitHub
// repository through a local clone under the home; a short summary goes to a branch of the public one. Zero
// dependencies: `engram`, `git` and `gh` are run as programs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  buildManifest,
  collectFiles,
  defaultRun,
  desktopDir,
  exportEngram,
  parseStats,
  PUBLIC_REPO,
  pushRefusal,
  readJson,
  repoOf,
  scopeArgs,
} from './lib/backup.mjs';
import { readTerms, renderSummary, seedTerms } from './lib/backup-summary.mjs';
import { buildRecent } from './lib/backup-recent.mjs';
import { restoreBackup, verifyBackup, verifySummary } from './lib/backup-restore.mjs';
import { humanSize, readiness } from './lib/backup-ready.mjs';
import { bundleRefs, pathKey, repoFiles, shortKey, unpushedCount, writeBundle } from './lib/backup-repos.mjs';

const USAGE = [
  'Usage: js-harness backup <run | status | ready | summary | init | restore | verify | --hook>',
  '  run [--allow-shrink] [--adopt]  Back up now: the Engram export and the Claude memory folders of the scope, the',
  '    js-harness home, reference copies of the config, the plugin lists and Claude Desktop\'s notes and presets, and for',
  '    each repository of config.json\'s `bundles` a bundle of what no remote holds (every stash entry included), a',
  '    patch of each worktree\'s uncommitted edits with its untracked files, and the records in its .git/js-harness;',
  '    secrets blanked, into the private clone, then push it. The',
  '    scope is config.json\'s `scope`: "all" for every project, or one project name (js-harness when unset). It',
  '    refuses an export that lost more than a tenth of any count (a wiped Engram looks like that; --allow-shrink when',
  '    the drop is meant), a clone whose fetch or push URL is not the configured repository on github.com, and a',
  '    repository that does not read PRIVATE just before the push. --adopt takes over a backup another machine made',
  '    (the first run after a reinstall). Once a day it also pushes the public summary to the memory-summary branch;',
  '    a summary that cannot be pushed is recorded and never fails the backup.',
  '  status  The last run, the last success, the last failure and why, and the commits still to push.',
  '  ready  Whether this machine can be wiped: a `missing:` line for each thing the backup is configured for that has',
  '    no copy off it (the clone ahead of origin or never pushed, a file or an Engram count the last backup does not',
  '    hold, and for each repository of `bundles` no remote, commits or a stash entry in no bundle, a worktree\'s edits',
  '    or its .git/js-harness records changed since, an untracked file too large to copy), and a `not copied:` line',
  '    with the size of what the backup never copies (Claude transcripts, Claude Desktop data). It writes nothing and',
  '    exits 1 while anything is missing.',
  '  summary [--summary-repo <dir>]  Print the public summary as the next run would push it: the roadmap and feature documents on the',
  "    summary repository's origin/main and the decisions of the last export, every line checked against the clone's",
  '    private-terms.txt.',
  '  init --repo <owner/name> [--summary-repo <dir>]  Create the repository private when it does not exist, check it',
  '    reads PRIVATE, clone it, write RESTORE.md and seed private-terms.txt. The summary repository is the checkout',
  '    named, and only then, since a public push cannot be taken back; every URL of its origin must be',
  '    jsaristi/js-harness on github.com.',
  '  restore --from <dir|git url> [--home <dir>] [--merge] [--map <old path>=<new path>]...  Put a backup into a home:',
  '    Engram imported (refused when that Engram already holds observations, unless --merge), the memory folders',
  '    (--map for a project now at another path), ~/.js-harness without its install manifest, the config files in',
  '    ~/.js-harness/restored-config to compare by hand, the bundles, patches and records in',
  '    ~/.js-harness/restored-bundles with the line that uses each. A',
  '    live file is never written over, and a restore run again skips the import it already did. The home is this',
  "    user's unless --home names another.",
  '  verify --from <dir|git url>  Restore into a scratch home, which it then removes, and check the four counts',
  '    against the backup and the live Engram it recorded, and every file byte for byte.',
  '  verify --summary <dir|git url>  Check the memory-summary branch: its four sections, and no line the privacy',
  "    check would drop, with the clone's private-terms.txt when there is one.",
  '  --hook  The Stop hook install registers: when a backup is due it starts `backup run` detached, and returns at once.',
  '  Its state lives in ~/.js-harness/memory-backup; deleting that folder undoes everything here but the repository.',
].join('\n');

/** How long after a success the hook waits before it backs up again. */
export const BACKUP_EVERY_MINUTES = 30;
/** A lock older than this was left by a run that died. */
export const LOCK_STALE_MINUTES = 10;
/** The longest a push may take: a sign-in prompt in a process with no window would otherwise wait for ever. */
export const PUSH_TIMEOUT_MS = 120_000;
/** What a backup holds when config.json names no `scope`: one Engram project and its Claude memory folders, or `'all'`
 * for every project. Other projects' memories stay off the remote until Sebastián decides; either answer is this line. */
export const DEFAULT_SCOPE = 'js-harness';
/** How often `backup run` tries the public summary (D4), pushed or not. */
export const SUMMARY_EVERY_HOURS = 24;
/** The public repository's branch that holds the summary, one file in one commit. */
export const SUMMARY_BRANCH = 'memory-summary';

/** Where the backup keeps its state under a home. */
export function backupPaths(home) {
  const dir = path.join(home, '.js-harness', 'memory-backup');
  return {
    dir,
    clone: path.join(dir, 'repo'),
    config: path.join(dir, 'config.json'),
    last: path.join(dir, 'last.json'),
    lock: path.join(dir, 'lock'),
  };
}

const NO_PROMPT = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };

function git(deps, cwd, args, options = {}) {
  return deps.run('git', ['-C', cwd, ...args], { env: { ...deps.env, ...NO_PROMPT }, ...options });
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** When a lock was taken: the time it records, or, while its writer has not written it yet, the file's own time. */
function lockTime(file) {
  const held = readJson(file);
  if (held?.at) return { at: Date.parse(held.at), pid: held.pid };
  try {
    return { at: fs.statSync(file).mtimeMs, pid: 'unknown' };
  } catch {
    return null;
  }
}

/** Takes the lock by creating its file exclusively, so two hooks at once cannot both hold it; returns what it wrote,
 * the proof of holding it, or why not: a live run holds it. A lock older than `LOCK_STALE_MINUTES` is taken over. */
function takeLock(paths, now) {
  const mine = `${JSON.stringify({ pid: process.pid, at: new Date(now).toISOString() })}\n`;
  fs.mkdirSync(paths.dir, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(paths.lock, mine, { flag: 'wx' });
      return { mine };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const held = lockTime(paths.lock);
    if (held && now - held.at < LOCK_STALE_MINUTES * 60_000) return { refusal: `a backup is already running (pid ${held.pid})` };
    fs.rmSync(paths.lock, { force: true });
  }
  return { refusal: 'a backup is already running (it took the stale lock first)' };
}

/** Removes the lock only while it is still the one this run wrote: a run that outlived its lock leaves the new one. */
function releaseLock(paths, mine) {
  let held;
  try {
    held = fs.readFileSync(paths.lock, 'utf8');
  } catch {
    return;
  }
  if (held === mine) fs.rmSync(paths.lock, { force: true });
}

/** The git repositories whose unpushed commits are bundled (D1): config.json's `bundles`, none when it names none.
 * `init` seeds the list once, with this machine's js-harness checkout when there is one (`defaultDeps().bundles`). */
function bundleSources(config) {
  return Array.isArray(config.bundles) ? config.bundles : [];
}

/** The bundle file of a source, named from its whole path as Claude names a project folder (`D--js-harness`), so two
 * repositories of one name never share a bundle. */
export function bundleName(source) {
  return `${pathKey(source)}.bundle`;
}

/** Mirrors `repoFiles` of `source` into the clone's `git/<shortKey(source)>/`, so a file no longer there (a worktree
 * committed since) goes. Returns the manifest's entries for them, or null, leaving the last copies, when git cannot
 * read the source. */
function copyRepoFiles(deps, source, clone) {
  const kept = repoFiles((cwd, args, options) => git(deps, cwd, args, options), source);
  if (!kept) return null;
  const folder = `git/${shortKey(source)}`;
  fs.rmSync(path.join(clone, folder), { recursive: true, force: true });
  const files = [];
  const redacted = [];
  for (const file of kept.files) {
    const target = `${folder}/${file.path}`;
    fs.mkdirSync(path.dirname(path.join(clone, target)), { recursive: true });
    fs.writeFileSync(path.join(clone, target), file.buffer);
    files.push({ path: target, bytes: file.buffer.length, sha256: createHash('sha256').update(file.buffer).digest('hex') });
    if (file.kinds.length) redacted.push({ path: target, kinds: file.kinds });
  }
  return { files, redacted, worktrees: kept.worktrees, skipped: kept.skipped };
}

/** Writes the bundle of every commit of `source` that is on no remote, or removes it when there is none. Returns the
 * refs it holds, every ref and not only the branches, with each stash entry and each worktree's HEAD (`bundleRefs`), so
 * the bundle is made again whenever what it would hold changes and the manifest changes only when it does. A source
 * git cannot read keeps its last bundle and says why. */
function bundleUnpushed(deps, source, clone) {
  const key = path.resolve(source);
  const out = path.join(clone, 'git', bundleName(source));
  const previous = readJson(path.join(clone, 'manifest.json'))?.bundles?.find((b) => b.source === key);
  const gitIn = (cwd, args, options) => git(deps, cwd, args, options);
  const { listed, reason } = bundleRefs(gitIn, source);
  const count = listed ? unpushedCount(gitIn, source, listed) : null;
  if (count === null) {
    // Its commits may be the very ones still to protect: the last bundle stays until git can read the source again.
    const { unreadable, ...last } = previous ?? { source: key, commits: 0, refs: [] };
    return { ...last, unreadable: reason ?? 'git rev-list failed' };
  }
  if (count === 0) {
    fs.rmSync(out, { force: true });
    return { source: key, commits: 0, refs: [] };
  }
  if (!(previous && !previous.unreadable && JSON.stringify(previous.refs) === JSON.stringify(listed) && fs.existsSync(out))) {
    writeBundle(gitIn, source, listed, out, deps.tmp);
  }
  return { source: key, commits: count, refs: listed };
}

/** Writes the readable fallback (odd/tasks/recent-memory.md, D1) from the clone's export: `RECENT.md` and
 * `recent/<project>.md`, a file of a project gone from the export removed. Returns the manifest's `recent` entries. */
function writeRecent(clone) {
  const { files, projects } = buildRecent(readJson(path.join(clone, 'engram', 'export.json')));
  const folder = path.join(clone, 'recent');
  fs.mkdirSync(folder, { recursive: true });
  for (const name of fs.readdirSync(folder)) if (!files.has(`recent/${name}`)) fs.rmSync(path.join(folder, name), { recursive: true, force: true });
  for (const [file, text] of files) fs.writeFileSync(path.join(clone, file), text);
  return projects;
}

/** `backup run`: one backup, start to push. Returns the outcome recorded in last.json. */
export function runBackup(deps, { allowShrink = false, adopt = false } = {}) {
  const paths = backupPaths(deps.home);
  const config = readJson(paths.config);
  if (!config?.repo || !fs.existsSync(path.join(paths.clone, '.git'))) {
    throw new Error('not initialised: run js-harness backup init --repo <owner/name> first');
  }
  const machine = deps.machine;
  const previous = readJson(path.join(paths.clone, 'manifest.json'));
  if (previous?.machine && previous.machine !== machine && !adopt) {
    throw new Error(
      `the last backup was made on ${previous.machine}, this machine is ${machine}: run backup run --adopt to take it over`,
    );
  }

  const scope = config.scope ?? DEFAULT_SCOPE;
  const stats = deps.run('engram', ['stats', ...scopeArgs(scope)]);
  const live = parseStats(stats.stdout);
  if (!live) throw new Error(`engram stats gave no counts: ${(stats.stderr || stats.stdout).trim()}`);
  // Counts of another scope say nothing about a wipe: the first run after the scope changes takes the export as it is.
  const rescoped = previous !== null && (previous.scope ?? 'all') !== scope;
  const exported = exportEngram({ dest: paths.clone, run: deps.run, allowShrink: allowShrink || rescoped, scope });
  // Only now, from the export the shrink guard accepted: a wiped Engram never reaches the readable fallback either.
  const recent = writeRecent(paths.clone);
  // RESTORE.md holds no time, so every run writes it: a clone made before a change of the steps gets them.
  fs.writeFileSync(path.join(paths.clone, 'RESTORE.md'), restoreSteps(config.repo));
  const { files, redacted } = collectFiles({ home: deps.home, dest: paths.clone, scope, desktop: deps.desktop });
  const bundles = bundleSources(config).map((source) => {
    const entry = bundleUnpushed(deps, source, paths.clone);
    const copied = copyRepoFiles(deps, source, paths.clone);
    if (copied) {
      files.push(...copied.files);
      redacted.push(...copied.redacted);
      return { ...entry, folder: shortKey(source), worktrees: copied.worktrees, skipped: copied.skipped };
    }
    // A source git cannot read keeps its last copies, and the manifest goes on naming them.
    const folder = `git/${shortKey(source)}/`;
    files.push(...(previous?.files ?? []).filter((f) => f.path.startsWith(folder)));
    redacted.push(...(previous?.redacted ?? []).filter((f) => f.path.startsWith(folder)));
    return entry;
  });
  // The bundle and the copies of a source the last manifest named and config.json no longer does go; any other file
  // stays, since a bundle no manifest names may be the only copy of its commits.
  const configured = new Set(bundleSources(config).map((source) => path.resolve(source)));
  for (const gone of (previous?.bundles ?? []).filter((b) => !configured.has(b.source))) {
    fs.rmSync(path.join(paths.clone, 'git', bundleName(gone.source)), { force: true });
    fs.rmSync(path.join(paths.clone, 'git', shortKey(gone.source)), { recursive: true, force: true });
  }
  const version = deps.run('engram', ['version']).stdout.trim();
  const manifest = JSON.parse(
    buildManifest({
      machine,
      engramVersion: version,
      counts: exported.counts,
      live,
      files,
      redacted: [...redacted, ...(exported.kinds.length ? [{ path: 'engram/export.json', kinds: exported.kinds }] : [])],
    }),
  );
  writeJson(path.join(paths.clone, 'manifest.json'), { ...manifest, scope, bundles, recent });
  // Every byte as written: under core.autocrlf a commit or a checkout would change line endings, and a restore would
  // no longer match the sha256 the manifest holds.
  fs.writeFileSync(path.join(paths.clone, '.gitattributes'), '* -text\n');

  // A file git cannot add (a path past Windows' 260 characters) would be named by the manifest and not be in the
  // backup: the run fails instead of pushing a backup that says it holds it.
  const added = git(deps, paths.clone, ['-c', 'core.longpaths=true', 'add', '-A']);
  if (added.status !== 0) throw new Error(`git add failed in ${paths.clone}: ${(added.stderr || added.stdout).trim()}`);
  const pending = git(deps, paths.clone, ['status', '--porcelain']).stdout.trim();
  let committed = false;
  if (pending) {
    const c = exported.counts;
    const message = `backup: ${c.observations} observations, ${c.sessions} sessions, ${c.prompts} prompts, ${c.relations} relations`;
    const made = git(deps, paths.clone, ['commit', '-q', '-m', message]);
    if (made.status !== 0) throw new Error(`git commit failed: ${(made.stderr || made.stdout).trim()}`);
    committed = true;
  }
  const pushed = pushClone(deps, paths.clone, config.repo);
  const unreadable = bundles.filter((b) => b.unreadable);
  const summary = pushSummary(deps, paths, config);
  return { counts: exported.counts, live, committed, pushed, redacted: manifest.redacted.length, unreadable, summary };
}

/** Every fetch and push URL of a clone's origin: `get-url --push` applies a pushurl and pushInsteadOf, so it names where
 * a push goes. */
function originUrls(deps, clone) {
  return [['remote', 'get-url', '--all', 'origin'], ['remote', 'get-url', '--push', '--all', 'origin']].flatMap((args) =>
    git(deps, clone, args).stdout.split('\n').map((line) => line.trim()).filter(Boolean),
  );
}

/** Why a checkout cannot carry the summary, or null: every fetch and push URL of its origin must be the public
 * repository on github.com, so a summary never lands anywhere else. */
function summaryRefusal(deps, dir) {
  const urls = originUrls(deps, dir);
  const stray = urls.filter((url) => repoOf(url)?.toLowerCase() !== PUBLIC_REPO);
  if (urls.length && !stray.length) return null;
  return `refused: the summary goes only to ${PUBLIC_REPO} on github.com, and ${dir}'s origin names ${stray.join(', ') || 'no URL'}`;
}

function noteSummary(paths, entry) {
  writeJson(paths.last, { ...(readJson(paths.last) ?? {}), ...entry });
}

/** Refreshes the `memory-summary` branch of the public repository (D4) at most once a day: fetches main, builds the
 * summary, and pushes it as one orphan commit in place of the last. Never throws, since the summary is not the backup: a
 * summary that cannot be built or pushed is recorded in last.json as `summaryError`. Returns a word for the run's line. */
function pushSummary(deps, paths, config) {
  const source = config.summaryRepo;
  if (!source) return 'off';
  const last = readJson(paths.last) ?? {};
  const tried = Math.max(Date.parse(last.lastSummary?.at ?? '') || 0, Date.parse(last.summaryError?.at ?? '') || 0);
  const now = deps.now();
  if (now - tried < SUMMARY_EVERY_HOURS * 60 * 60_000) return 'not due';
  const at = new Date(now).toISOString();
  const must = (result, what) => {
    if (result.status !== 0) throw new Error(`${what} failed in ${source}: ${(result.stderr || 'no answer within the time limit').trim()}`);
    return result.stdout.trim();
  };
  try {
    if (!fs.existsSync(path.join(paths.clone, 'private-terms.txt'))) {
      throw new Error(`no private-terms.txt in ${paths.clone}: the summary is never pushed without it`);
    }
    const refusal = summaryRefusal(deps, source);
    if (refusal) throw new Error(refusal);
    must(git(deps, source, ['fetch', '-q', 'origin', 'main'], { timeout: PUSH_TIMEOUT_MS }), 'git fetch origin main');
    const { text } = buildPublicSummary(deps, paths, config);
    const hash = createHash('sha256').update(text).digest('hex');
    const ref = `refs/heads/${SUMMARY_BRANCH}`;
    // What the remote holds now, empty when the branch is gone: it is the lease of the push, so a push made elsewhere
    // since is not overwritten, and it decides "unchanged", since a summary replaced or deleted there is not unchanged.
    const lease = must(git(deps, source, ['ls-remote', 'origin', ref], { timeout: PUSH_TIMEOUT_MS }), 'git ls-remote').split(/\s/)[0];
    if (hash === last.lastSummary?.hash && lease === last.lastSummary.commit) {
      noteSummary(paths, { lastSummary: { ...last.lastSummary, at } });
      return 'unchanged';
    }
    const blob = must(git(deps, source, ['hash-object', '-w', '--stdin'], { input: text }), 'git hash-object');
    const tree = must(git(deps, source, ['mktree'], { input: `100644 blob ${blob}\tSUMMARY.md\n` }), 'git mktree');
    const commit = must(git(deps, source, ['commit-tree', tree, '-m', `memory summary ${at.slice(0, 10)}`]), 'git commit-tree');
    must(git(deps, source, ['push', '-q', `--force-with-lease=${ref}:${lease}`, 'origin', `${commit}:${ref}`], { timeout: PUSH_TIMEOUT_MS }), 'git push');
    noteSummary(paths, { lastSummary: { at, pushedAt: at, commit, hash } });
    return 'pushed';
  } catch (error) {
    noteSummary(paths, { summaryError: { at, error: error.message } });
    return `not pushed: ${error.message}`;
  }
}

/** Pushes the clone when it holds commits its remote does not, after the guard: origin and visibility (D2). A push the
 * remote rejects fetches and rebases once. Returns the number of commits pushed. */
function pushClone(deps, clone, repo) {
  const ahead = git(deps, clone, ['rev-list', '--count', '@{u}..HEAD']);
  // A clone of an empty repository has no upstream yet: everything it holds is to push.
  const owed = ahead.status === 0 ? Number(ahead.stdout.trim()) : Number(git(deps, clone, ['rev-list', '--count', 'HEAD']).stdout.trim());
  if (!owed) return 0;
  const urls = originUrls(deps, clone);
  const visibility = deps.run('gh', ['repo', 'view', repo, '--json', 'visibility', '-q', '.visibility']);
  const refusal = pushRefusal({ urls, repo, visibility: visibility.status === 0 ? visibility.stdout.trim() : null });
  if (refusal) throw new Error(refusal);
  const push = () => git(deps, clone, ['push', '-q', '-u', 'origin', 'HEAD'], { timeout: PUSH_TIMEOUT_MS });
  let result = push();
  if (result.status !== 0 && /rejected|fetch first|non-fast-forward/.test(result.stderr)) {
    const rebased = git(deps, clone, ['pull', '-q', '--rebase', 'origin', 'HEAD'], { timeout: PUSH_TIMEOUT_MS });
    if (rebased.status !== 0) {
      git(deps, clone, ['rebase', '--abort']);
      throw new Error(`the push was rejected and the rebase failed: ${rebased.stderr.trim()}`);
    }
    result = push();
  }
  if (result.status !== 0) throw new Error(`git push failed: ${(result.stderr || 'no answer within the time limit').trim()}`);
  return owed;
}

function record(paths, now, outcome) {
  const last = readJson(paths.last) ?? {};
  const at = new Date(now).toISOString();
  const next = { ...last, lastRun: at };
  if (outcome.error) next.lastFailure = { at, error: outcome.error, ...(outcome.projects ? { projects: outcome.projects } : {}) };
  else next.lastSuccess = { at, ...outcome };
  writeJson(paths.last, next);
  return next;
}

function runCommand(args, deps) {
  const paths = backupPaths(deps.home);
  const { mine, refusal } = takeLock(paths, deps.now());
  if (refusal) {
    deps.stderr.write(`backup: ${refusal}\n`);
    return 1;
  }
  try {
    const outcome = runBackup(deps, { allowShrink: args.includes('--allow-shrink'), adopt: args.includes('--adopt') });
    record(paths, deps.now(), outcome);
    const c = outcome.counts;
    deps.stdout.write(
      `backup: ${c.observations} observations, ${c.sessions} sessions, ${c.prompts} prompts, ${c.relations} relations; ` +
        `${outcome.committed ? 'committed' : 'nothing new'}, ${outcome.pushed} pushed, ${outcome.redacted} files with secrets blanked\n`,
    );
    if (outcome.summary !== 'off' && outcome.summary !== 'not due') deps.stdout.write(`backup: summary ${outcome.summary}\n`);
    for (const b of outcome.unreadable) {
      deps.stdout.write(`backup: ${b.source} could not be read (${b.unreadable}); its last bundle is kept\n`);
    }
    return 0;
  } catch (error) {
    // A wiped project's name stays in last.json, under the home, never in the printed line.
    record(paths, deps.now(), { error: error.message, projects: error.projects });
    deps.stderr.write(`backup: ${error.message}\n`);
    return 1;
  } finally {
    releaseLock(paths, mine);
  }
}

/** The public summary (D4) of `config.summaryRepo`'s `origin/main` and the clone's last export, checked against the
 * clone's private-terms.txt. Throws when a piece is missing, since a summary is never built from less. */
function buildPublicSummary(deps, paths, config) {
  const source = config.summaryRepo;
  if (!source) throw new Error('no summaryRepo in config.json: the repository whose main the summary reads');
  const show = (spec) => {
    const result = git(deps, source, ['show', `origin/main:${spec}`]);
    if (result.status !== 0) throw new Error(`git show origin/main:${spec} failed in ${source}: ${result.stderr.trim()}`);
    return result.stdout;
  };
  const listed = git(deps, source, ['ls-tree', '--name-only', 'origin/main', 'odd/tasks/']);
  const features = listed.stdout
    .split('\n')
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ id: path.basename(name, '.md'), markdown: show(name) }));
  const termsFile = path.join(paths.clone, 'private-terms.txt');
  const terms = fs.existsSync(termsFile) ? readTerms(fs.readFileSync(termsFile, 'utf8')) : null;
  const observations = readJson(path.join(paths.clone, 'engram', 'export.json'))?.observations ?? [];
  return renderSummary({ roadmap: show('docs/ROADMAP.md'), features, observations, terms });
}

function summaryCommand(args, deps) {
  const paths = backupPaths(deps.home);
  const config = readJson(paths.config) ?? {};
  if (refuseBareFlag(args, ['--summary-repo'], 'summary', deps)) return 2;
  const named = valueOf(args, '--summary-repo');
  try {
    deps.stdout.write(buildPublicSummary(deps, paths, named ? { ...config, summaryRepo: path.resolve(named) } : config).text);
    return 0;
  } catch (error) {
    deps.stderr.write(`backup summary: ${error.message}\n`);
    return 1;
  }
}

/** A local folder holding `marker`: `from` itself when it does, else a shallow clone of it (a URL, or a bare
 * repository) in a scratch folder that `done` removes. */
function localCopy(deps, from, marker, branch) {
  if (fs.existsSync(path.join(from, marker))) return { dir: from, done: () => {} };
  const scratch = fs.mkdtempSync(path.join(deps.tmp ?? os.tmpdir(), 'backup-from-'));
  const dir = path.join(scratch, 'clone');
  const cloned = deps.run('git', ['clone', '-q', from, dir, '--depth=1', ...(branch ? [`--branch=${branch}`] : [])], {
    env: { ...deps.env, ...NO_PROMPT },
    timeout: PUSH_TIMEOUT_MS,
  });
  const done = () => fs.rmSync(scratch, { recursive: true, force: true });
  if (cloned.status !== 0) {
    done();
    throw new Error(`git clone ${from} failed: ${(cloned.stderr || 'no answer within the time limit').trim()}`);
  }
  return { dir, done };
}

// A flag's value: undefined when the flag is absent, null when nothing or another flag follows it, so
// `--home --merge` is refused instead of restoring into a folder named --merge.
function valueOf(args, flag) {
  if (!args.includes(flag)) return undefined;
  const value = args[args.indexOf(flag) + 1];
  return value === undefined || value.startsWith('--') ? null : value;
}

function refuseBareFlag(args, flags, command, deps) {
  const bare = flags.find((flag) => valueOf(args, flag) === null);
  if (bare) deps.stderr.write(`backup ${command}: ${bare} needs a value\n`);
  return Boolean(bare);
}

function restoreCommand(args, deps) {
  if (refuseBareFlag(args, ['--from', '--home'], 'restore', deps)) return 2;
  const from = valueOf(args, '--from');
  // The home defaults to this user's: a documented `--home %USERPROFILE%` reaches PowerShell
  // unexpanded and would restore into a folder named after the literal text.
  const home = valueOf(args, '--home') ?? deps.home;
  if (!from || !home) {
    deps.stderr.write('backup restore: --from <dir|git url> is required (--home <dir> defaults to this user\'s home)\n');
    return 2;
  }
  if (/%[^%\s]+%|^\$/.test(home)) {
    deps.stderr.write(`backup restore: --home ${home} was not expanded by the shell; leave --home out to restore into this user's home\n`);
    return 2;
  }
  // --map <old>=<new>, as often as needed: a project now at another path.
  const maps = args.flatMap((arg, i) => (arg === '--map' ? [args[i + 1] ?? ''] : []));
  const malformed = maps.find((value) => value.indexOf('=') < 1);
  if (malformed !== undefined) {
    deps.stderr.write(`backup restore: --map needs <old path>=<new path>, got "${malformed}"\n`);
    return 2;
  }
  const map = Object.fromEntries(maps.map((value) => [value.slice(0, value.indexOf('=')), value.slice(value.indexOf('=') + 1)]));
  let source;
  try {
    source = localCopy(deps, from, 'manifest.json');
    restoreBackup({ from: source.dir, home: path.resolve(home), merge: args.includes('--merge'), map, run: deps.run, env: deps.env, stdout: deps.stdout });
    return 0;
  } catch (error) {
    deps.stderr.write(`backup restore: ${error.message}\n`);
    return 1;
  } finally {
    source?.done();
  }
}

function verifyCommand(args, deps) {
  if (refuseBareFlag(args, ['--from', '--summary'], 'verify', deps)) return 2;
  const from = valueOf(args, '--from');
  const summary = valueOf(args, '--summary');
  if (!from && !summary) {
    deps.stderr.write('backup verify: --from <dir|git url> or --summary <dir|git url> is required\n');
    return 2;
  }
  let source;
  try {
    let result;
    if (from) {
      source = localCopy(deps, from, 'manifest.json');
      result = verifyBackup({ from: source.dir, run: deps.run, env: deps.env, tmp: deps.tmp });
    } else {
      source = localCopy(deps, summary, 'SUMMARY.md', SUMMARY_BRANCH);
      const termsFile = path.join(backupPaths(deps.home).clone, 'private-terms.txt');
      const terms = fs.existsSync(termsFile) ? readTerms(fs.readFileSync(termsFile, 'utf8')) : null;
      result = verifySummary({ text: fs.readFileSync(path.join(source.dir, 'SUMMARY.md'), 'utf8'), terms });
    }
    deps.stdout.write(`${result.lines.join('\n')}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    deps.stderr.write(`backup verify: ${error.message}\n`);
    return 1;
  } finally {
    source?.done();
  }
}

/** `backup ready`: whether this machine can be wiped. Every thing configured that has no copy off it is a `missing:`
 * line and makes the exit 1; what the backup does not copy is a `not copied:` line with its size, and never fails it. */
function readyCommand(deps) {
  const paths = backupPaths(deps.home);
  const config = readJson(paths.config);
  if (!config) {
    deps.stdout.write('backup ready: no, the backup is not initialised (js-harness backup init --repo <owner/name>)\n');
    return 1;
  }
  const { missing, notCopied, notes } = readiness({
    home: deps.home,
    clone: paths.clone,
    config,
    scope: config.scope ?? DEFAULT_SCOPE,
    desktop: deps.desktop,
    run: deps.run,
    env: deps.env,
  });
  const lines = [
    ...missing.map((thing) => `missing: ${thing}`),
    ...notCopied.map((n) => `not copied: ${n.what}: ${n.files} files, ${humanSize(n.bytes)}`),
    ...notes.map((note) => `note: ${note}`),
    missing.length
      ? `backup ready: no, ${missing.length} things have no copy off this machine`
      : 'backup ready: yes, everything the backup is configured for has a copy off this machine',
  ];
  deps.stdout.write(`${lines.join('\n')}\n`);
  return missing.length ? 1 : 0;
}

/** How long without a success before `doctor` calls the backup stopped: the hook backs up every 30 minutes of work, so
 * a day without one is a backup that is not running, not a quiet day. */
export const BACKUP_STALE_HOURS = 24;

/** The memory-backup row of `doctor` (D2): `n/a` where `init` never ran, `stale` with its reason when no backup
 * succeeded in a day or the success left no readable fallback (odd/tasks/recent-memory.md, D8), else `ok`. Reads files
 * and runs nothing, so the SessionStart hook pays nothing for it. */
export function backupHealth(home, now) {
  const paths = backupPaths(home);
  if (!readJson(paths.config)) return { state: 'n/a', fix: [] };
  const last = readJson(paths.last) ?? {};
  const success = Date.parse(last.lastSuccess?.at ?? '') || 0;
  const failedSince = last.lastFailure && Date.parse(last.lastFailure.at) > success;
  const cloneGone = !fs.existsSync(path.join(paths.clone, '.git'));
  const noRecent = !cloneGone && success > 0 && !fs.existsSync(path.join(paths.clone, 'RECENT.md'));
  if (now - success < BACKUP_STALE_HOURS * 60 * 60_000 && !failedSince && !cloneGone && !noRecent) return { state: 'ok', fix: [] };
  const failure = failedSince ? `; last failure ${last.lastFailure.at}: ${last.lastFailure.error}` : '';
  const gone = cloneGone ? `; the clone ${paths.clone} is gone` : '';
  const recent = noRecent ? '; no RECENT.md in the clone, so Engram has no readable fallback' : '';
  return { state: 'stale', fix: [`memory backup: last success ${last.lastSuccess?.at ?? 'never'}${failure}${gone}${recent}: run js-harness backup status`] };
}

function statusCommand(deps) {
  const paths = backupPaths(deps.home);
  const config = readJson(paths.config);
  if (!config) {
    deps.stdout.write('backup: not initialised (js-harness backup init --repo <owner/name>)\n');
    return 1;
  }
  const last = readJson(paths.last) ?? {};
  const ahead = git(deps, paths.clone, ['rev-list', '--count', '@{u}..HEAD']);
  const lines = [
    `repository: ${config.repo}`,
    `scope: ${config.scope ?? DEFAULT_SCOPE}${config.scope ? '' : ' (the default)'}`,
    `last success: ${last.lastSuccess ? `${last.lastSuccess.at}, ${last.lastSuccess.counts.observations} observations` : 'never'}`,
    `last failure: ${last.lastFailure ? `${last.lastFailure.at}, ${last.lastFailure.error}` : 'none'}`,
    `to push: ${ahead.status === 0 ? `${ahead.stdout.trim()} commits` : 'unknown (no upstream yet)'}`,
  ];
  const recent = readJson(path.join(paths.clone, 'manifest.json'))?.recent;
  const newest = Array.isArray(recent) ? recent.map((r) => r.newest ?? '').sort().at(-1) : '';
  lines.push(Array.isArray(recent) ? `recent: ${recent.length} projects, newest entry ${newest || 'unknown'}` : 'recent: none yet; the next backup run writes it');
  if (config.summaryRepo) {
    const pushed = last.lastSummary?.pushedAt ? `last pushed ${last.lastSummary.pushedAt}, ${last.lastSummary.commit.slice(0, 8)}` : 'never pushed';
    // A refusal the last attempt outlived is history, not state.
    const current = last.summaryError && !(Date.parse(last.lastSummary?.at ?? '') > Date.parse(last.summaryError.at));
    const refused = current ? `; last refused ${last.summaryError.at}, ${last.summaryError.error}` : '';
    lines.push(`summary: ${pushed}${refused}`);
  }
  deps.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

/** The newest modification time among the things a backup copies (D2); Engram writes through its WAL. `desktop` is
 * Claude Desktop's folder, whose notes and presets are copied too. */
export function newestChange(home, desktop) {
  let newest = 0;
  // Every file and folder under `target`, folders included: a deletion changes only its folder's time.
  const visit = (target, skip = () => false) => {
    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      return;
    }
    newest = Math.max(newest, stat.mtimeMs);
    if (!stat.isDirectory()) return;
    for (const name of fs.readdirSync(target)) if (!skip(name)) visit(path.join(target, name), skip);
  };
  visit(path.join(home, '.engram', 'engram.db'));
  visit(path.join(home, '.engram', 'engram.db-wal'));
  const projects = path.join(home, '.claude', 'projects');
  // Only the memory folders count under ~/.claude/projects, never the transcripts beside them.
  for (const slug of fs.existsSync(projects) ? fs.readdirSync(projects) : []) visit(path.join(projects, slug, 'memory'));
  visit(path.join(home, '.js-harness'), (name) => name === 'memory-backup');
  // The plugin lists change only when a plugin does, so their change alone makes a backup due.
  for (const name of ['installed_plugins.json', 'known_marketplaces.json']) visit(path.join(home, '.claude', 'plugins', name));
  if (desktop) for (const name of ['side-session-notes', 'ccd-session-presets.json']) visit(path.join(desktop, name));
  return newest;
}

/** Whether the hook should start a run now, and why not when it should not. */
export function dueReason(home, now, desktop) {
  const paths = backupPaths(home);
  if (!fs.existsSync(path.join(paths.clone, '.git'))) return 'not initialised';
  const held = lockTime(paths.lock);
  if (held && now - held.at < LOCK_STALE_MINUTES * 60_000) return 'a run holds the lock';
  const success = Date.parse(readJson(paths.last)?.lastSuccess?.at ?? '') || 0;
  if (now - success < BACKUP_EVERY_MINUTES * 60_000) return 'backed up less than 30 minutes ago';
  // A clone without the readable fallback (the first run after it shipped, or a run that died half-way) is due at once.
  const fallbackMissing = !fs.existsSync(path.join(paths.clone, 'RECENT.md')) || !Array.isArray(readJson(path.join(paths.clone, 'manifest.json'))?.recent);
  if (success && !fallbackMissing && newestChange(home, desktop) <= success && !copiedSourceGone(home, paths.clone, desktop)) return 'nothing changed since the last backup';
  return null;
}

/** Whether something the clone holds is gone from the home: a memory folder, a plugin list, or Desktop's notes or
 * presets. A thing deleted whole leaves no time to compare. */
function copiedSourceGone(home, clone, desktop) {
  const held = path.join(clone, 'claude', 'projects');
  const slugs = fs.existsSync(held) ? fs.readdirSync(held) : [];
  if (slugs.some((slug) => !fs.existsSync(path.join(home, '.claude', 'projects', slug, 'memory')))) return true;
  const sources = ['installed_plugins.json', 'known_marketplaces.json'].map((name) => [path.join(clone, 'config', 'claude', 'plugins', name), path.join(home, '.claude', 'plugins', name)]);
  if (desktop) sources.push(...['side-session-notes', 'ccd-session-presets.json'].map((name) => [path.join(clone, 'config', 'claude-desktop', name), path.join(desktop, name)]));
  return sources.some(([copy, live]) => fs.existsSync(copy) && !fs.existsSync(live));
}

function hookCommand(deps) {
  try {
    if (dueReason(deps.home, deps.now(), deps.desktop) === null) deps.startDetached(['backup', 'run']);
  } catch {
    // A Stop hook never breaks a turn.
  }
  return 0;
}

/** RESTORE.md (D5): the way back, kept in the private repository so it survives the machine with the memory. */
function restoreSteps(repo) {
  const url = `https://github.com/${repo}.git`;
  return [
    '# Restoring the memory after a reinstall',
    '',
    'Run these in order, in a terminal, before any Claude Code or Codex session: a session started first',
    'would run the backup hook and back up an empty memory.',
    '',
    'Before any of it, `RECENT.md` and `recent/<project>.md` in this repository tell where each project stands:',
    'its recent decisions and work, readable here on GitHub without restoring anything.',
    '',
    '1. Install Node, git, the GitHub CLI (then `gh auth login`) and engram.',
    '2. Install Claude Code and Codex.',
    '3. `git clone https://github.com/jsaristi/js-harness.git D:\\js-harness` (the Claude memory folder is named after',
    '   that path; if the checkout lives elsewhere, add `--map D:\\js-harness=<new path>` to the next step).',
    `4. \`cd D:\\js-harness\` and \`node bin/js-harness.mjs backup restore --from ${url}\``,
    '   It restores into this user\'s home (`--home <dir>` names another): it imports Engram, puts back the',
    '   memory folders and ~/.js-harness, and leaves the old config files in',
    '   ~/.js-harness/restored-config to compare by hand. It prints the line that fetches unpushed commits.',
    `5. \`node bin/js-harness.mjs backup verify --from ${url}\` restores again into a scratch home and checks it.`,
    '6. `node bin/js-harness.mjs install`.',
    `7. \`node bin/js-harness.mjs backup init --repo ${repo}\` and \`node bin/js-harness.mjs backup run --adopt\`: this`,
    '   machine takes over the backup.',
    '',
    'An Engram restore brings back every observation as it is now, not its edit history (observation_versions).',
    '',
  ].join('\n');
}

function initCommand(args, deps) {
  const i = args.indexOf('--repo');
  const repo = i === -1 ? undefined : args[i + 1];
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    deps.stderr.write('backup init: --repo <owner/name> is required\n');
    return 2;
  }
  const paths = backupPaths(deps.home);
  const view = () => deps.run('gh', ['repo', 'view', repo, '--json', 'visibility', '-q', '.visibility']);
  let visibility = view();
  if (visibility.status !== 0) {
    const made = deps.run('gh', ['repo', 'create', repo, '--private', '--description', 'js-harness memory backup (private)']);
    if (made.status !== 0) {
      deps.stderr.write(`backup init: gh repo create failed: ${(made.stderr || made.stdout).trim()}\n`);
      return 1;
    }
    visibility = view();
  }
  const refusal = pushRefusal({ urls: [`https://github.com/${repo}.git`], repo, visibility: visibility.stdout.trim() || null });
  if (refusal) {
    deps.stderr.write(`backup init: ${refusal}\n`);
    return 1;
  }
  if (!fs.existsSync(path.join(paths.clone, '.git'))) {
    fs.mkdirSync(paths.dir, { recursive: true });
    const cloned = deps.run('git', ['clone', '-q', `https://github.com/${repo}.git`, paths.clone], { env: { ...deps.env, ...NO_PROMPT } });
    if (cloned.status !== 0) {
      deps.stderr.write(`backup init: git clone failed: ${cloned.stderr.trim()}\n`);
      return 1;
    }
  }
  const config = { ...(readJson(paths.config) ?? {}), repo };
  if (!Array.isArray(config.bundles)) config.bundles = deps.bundles ?? [];
  // The checkout whose main the public summary reads (D4), only when named: a push to a public repository cannot be
  // taken back, so it is never a default, and its first content is read first with `backup summary --summary-repo`.
  const s = args.indexOf('--summary-repo');
  if (s !== -1) {
    const named = path.resolve(args[s + 1] ?? '');
    const refused = summaryRefusal(deps, named);
    if (refused) {
      deps.stderr.write(`backup init: ${refused}\n`);
      return 1;
    }
    config.summaryRepo = named;
  }
  writeJson(paths.config, config);
  fs.writeFileSync(path.join(paths.clone, 'RESTORE.md'), restoreSteps(repo));
  // The terms the public summary must never name (D4), kept in the private clone so a restore brings them back.
  const termsFile = path.join(paths.clone, 'private-terms.txt');
  if (!fs.existsSync(termsFile)) {
    const stats = deps.run('engram', ['stats', '--all']);
    const listed = stats.stdout.match(/^\s*Projects:\s*(.*)$/m)?.[1];
    if (stats.status !== 0 || listed === undefined) {
      // An empty list would pass every line; with no file the summary is not pushed until the next init seeds it.
      deps.stderr.write(`backup init: private-terms.txt not written, engram stats failed: ${(stats.stderr || stats.stdout).trim()}\n`);
    } else {
      const terms = seedTerms(listed.split(',').map((name) => name.trim()).filter(Boolean));
      const header = '# Whole words the public memory summary never prints, one per line; add your own.\n';
      fs.writeFileSync(termsFile, `${header}${terms.map((term) => `${term}\n`).join('')}`);
    }
  }
  deps.stdout.write(`backup: ${repo} reads PRIVATE; clone in ${paths.clone}\n`);
  return 0;
}

function defaultDeps() {
  const home = os.homedir();
  return {
    home,
    env: process.env,
    machine: os.hostname(),
    now: () => Date.now(),
    run: defaultRun,
    stdout: process.stdout,
    stderr: process.stderr,
    bundles: ['D:/js-harness'].filter((dir) => fs.existsSync(path.join(dir, '.git'))),
    desktop: desktopDir(home, process.env),
    // Node itself on this install's own entry point: no `.cmd` shim, no shell between the hook and the run.
    startDetached: (args) => {
      const entry = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));
      const child = spawn(process.execPath, [entry, ...args], { detached: true, stdio: 'ignore', windowsHide: true });
      child.unref();
    },
  };
}

export async function backupMain(args, deps = defaultDeps()) {
  const [sub, ...rest] = args;
  if (sub === 'run') return runCommand(rest, deps);
  if (sub === 'status') return statusCommand(deps);
  if (sub === 'ready') return readyCommand(deps);
  if (sub === 'summary') return summaryCommand(rest, deps);
  if (sub === 'restore') return restoreCommand(rest, deps);
  if (sub === 'verify') return verifyCommand(rest, deps);
  if (sub === 'init') return initCommand(rest, deps);
  if (sub === '--hook') return hookCommand(deps);
  if (sub === '--help' || sub === '-h' || sub === undefined) {
    deps.stdout.write(`${USAGE}\n`);
    return sub === undefined ? 2 : 0;
  }
  deps.stderr.write(`backup: unknown subcommand ${sub}\n\n${USAGE}\n`);
  return 2;
}
