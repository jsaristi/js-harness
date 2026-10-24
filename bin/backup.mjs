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
import { bundleRefs, checkoutsOf, pathKey, repoFiles, shortKey, unpushedCount, writeBundle } from './lib/backup-repos.mjs';
import { fallbackNotice, projectOf, readStats, STATS_TIMEOUT_MS } from './lib/backup-fallback.mjs';
import { copyTranscripts, restoreTranscripts, verifyTranscripts } from './lib/backup-transcripts.mjs';
import { mainCheckout } from './lib/sessions.mjs';
import { unknownArgument } from './lib/args.mjs';
import { INSTALL_NEWEST } from './lib/version.mjs';

const USAGE = [
  'Usage: js-harness backup <run | status | ready | summary | init | restore | verify | --hook | --session-start>',
  '  run [--allow-shrink] [--adopt] [--transcripts]  Back up now: the Engram export and the Claude memory folders of the scope, the',
  '    js-harness home, reference copies of the config, the plugin lists and Claude Desktop\'s notes and presets, and for',
  '    each repository of config.json\'s `bundles` a bundle of what no remote holds (every stash entry included), a',
  '    patch of each worktree\'s uncommitted edits with its untracked files, and the records in its .git/js-harness;',
  '    secrets blanked, into the private clone, then push it. The',
  '    scope is config.json\'s `scope`: "all" for every project, or one project name (js-harness when unset). It',
  '    refuses an export that lost more than a tenth of any count (a wiped Engram looks like that; --allow-shrink when',
  '    the drop is meant), a clone whose fetch or push URL is not the configured repository on github.com, and a',
  '    repository that does not read PRIVATE just before the push. --adopt takes over a backup another machine made',
  '    (the first run after a reinstall). Once a day it also pushes the public summary to the memory-summary branch;',
  '    a summary that cannot be pushed is recorded and never fails the backup. Once a day, when init --transcripts-repo',
  '    named one, it then copies every ~/.claude/projects/**/*.jsonl as text into the transcripts repositories, a file',
  '    over 40 MiB cut by line into parts, and pushes them after the same checks; a transcripts failure is recorded and',
  '    never fails the backup. --transcripts runs them now, and then their failure is the exit.',
  '  status  The last success, the last failure and why, and the commits still to push.',
  '  ready  Whether this machine can be wiped: a `missing:` line for each thing the backup is configured for that has',
  '    no copy off it (the clone ahead of origin or never pushed, a file or an Engram count the last backup does not',
  '    hold, and for each repository of `bundles` no remote, commits or a stash entry in no bundle, a worktree\'s edits',
  '    or its .git/js-harness records changed since, an untracked file too large to copy), and a `not copied:` line',
  '    with the size of what the backup never copies (Claude transcripts while no transcripts repository is named,',
  '    Claude Desktop data). With transcripts named, a transcript in no backup or changed since is missing, and one',
  '    that only grew in the last 15 minutes, a session running now, is a note. It writes nothing and exits 1 while',
  '    anything is missing.',
  '  summary [--summary-repo <dir>]  Print the public summary as the next run would push it: the roadmap and feature documents on the',
  "    summary repository's origin/main and the decisions of the last export, every line checked against the clone's",
  '    private-terms.txt.',
  '  init --repo <owner/name> [--checkout <path>] [--summary-repo <dir>]  Create the repository private when it does not exist, check it',
  '    reads PRIVATE, clone it, write RESTORE.md and seed private-terms.txt. A config with no bundle list yet takes the git',
  '    repository the folder init runs in; --checkout <path> (any folder inside a repository) adds that repository to the',
  '    bundles when absent, and says so. An existing bundle list is otherwise left as it is. RESTORE.md clones each bundled',
  '    repository from its origin, with no credential in it. With no checkout, nothing is bundled and init says so. The summary repository',
  '    is the checkout named, and only then, since a public push cannot be taken back; every URL of its origin must be',
  '    jsaristi/js-harness on github.com.',
  '  init --transcripts-repo <owner/name>  The same for a repository of the Claude transcripts, apart from the memory',
  "    backup's: created private, read PRIVATE, cloned, and added to config.json's transcripts.repos. The last one",
  '    named takes new transcripts; once its objects reach 800 MB, `backup run` names the next to open.',
  '  restore --from <dir|git url> [--home <dir>] [--merge] [--map <old path>=<new path>]...  Put a backup into a home:',
  '    Engram imported (refused when that Engram already holds observations, unless --merge), the memory folders',
  '    (--map for a project now at another path), ~/.js-harness without its install manifest, the config files in',
  '    ~/.js-harness/restored-config to compare by hand, the bundles, patches and records in',
  '    ~/.js-harness/restored-bundles with the line that uses each. A',
  '    live file is never written over, and a restore run again skips the import it already did. The home is this',
  "    user's unless --home names another.",
  '  restore --transcripts <dir|git url> [--home <dir>]  Rejoin the transcripts of one transcripts repository into',
  '    ~/.claude/projects, each checked against its sha256; a live file is never written over.',
  '  verify --from <dir|git url>  Restore into a scratch home, which it then removes, and check the four counts',
  '    against the backup and the live Engram it recorded, and every file byte for byte.',
  '  verify --summary <dir|git url>  Check the memory-summary branch: its four sections, and no line the privacy',
  "    check would drop, with the clone's private-terms.txt when there is one.",
  '  verify --transcripts <dir|git url>  Rejoin every transcript of a transcripts repository in memory and check each',
  '    part and each whole file against its sha256.',
  '  --hook  The Stop hook install registers: when a backup is due it starts `backup run` detached, and returns at once.',
  '  --session-start  The SessionStart hook install registers: reads the hook input, and when Engram holds less than nine',
  "    tenths of what the last backup held of the session's project (or does not answer within 3 seconds) it tells the",
  "    session to read that project's file in recent/ and how to restore Engram. Silent otherwise; always exits 0.",
  '  Its state lives in ~/.js-harness/memory-backup. Deleting that folder removes the clones on this machine and their records,',
  '    not what they pushed (the private repositories and the memory-summary branch) nor what restore wrote in ~/.js-harness',
  '    (restored-config, restored-bundles, restore-progress.json).',
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

/** How often `backup run` backs up the Claude transcripts (odd/tasks/transcripts-backup.md, D3), pushed or not. */
export const TRANSCRIPTS_EVERY_HOURS = 24;
/** How long without a transcripts success before `doctor` calls them stopped: a day's run, and a day of slack. */
export const TRANSCRIPTS_STALE_HOURS = 48;
/** A transcripts repository whose objects reach this takes no new transcript (D4): GitHub warns past 1 GB, and the
 * transcripts it already holds keep growing in it. */
export const TRANSCRIPTS_ROLL_BYTES = 800 * 1024 * 1024;
/** The longest a transcripts push may take: the first is about 430 MB. */
export const TRANSCRIPTS_PUSH_TIMEOUT_MS = 60 * 60_000;
/** A transcripts lock older than this was left by a run that died. A live run can take three hour-long git steps per
 * repository (a push, a rebase after a rejected one, the push again), and two repositories after a rollover. */
export const TRANSCRIPTS_LOCK_STALE_MINUTES = 8 * 60;

/** Where the backup keeps its state under a home. */
export function backupPaths(home) {
  const dir = path.join(home, '.js-harness', 'memory-backup');
  return {
    dir,
    clone: path.join(dir, 'repo'),
    config: path.join(dir, 'config.json'),
    last: path.join(dir, 'last.json'),
    lock: path.join(dir, 'lock'),
    transcripts: path.join(dir, 'transcripts'),
    transcriptsLock: path.join(dir, 'transcripts.lock'),
    // The transcripts run's own record, beside last.json: only the transcripts run writes it, under its lock, while a
    // memory run may write last.json, so neither can lose the other's record.
    transcriptsLast: path.join(dir, 'transcripts.json'),
  };
}

/** The clones of the transcripts repositories of config.json (D4), oldest first: the last one takes new transcripts. */
export function transcriptsClones(paths, config) {
  const repos = Array.isArray(config?.transcripts?.repos) ? config.transcripts.repos : [];
  return repos.map((repo) => ({ name: repo, dir: path.join(paths.transcripts, repo.split('/')[1]) }));
}

/** The repository after `repo` in its series: its trailing number plus one, or `-2` after a name with none. */
export function nextTranscriptsRepo(repo) {
  const match = /^(.*?)-(\d+)$/.exec(repo);
  return match ? `${match[1]}-${Number(match[2]) + 1}` : `${repo}-2`;
}

const NO_PROMPT = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };

function git(deps, cwd, args, options = {}) {
  return deps.run('git', ['-C', cwd, ...args], { env: { ...deps.env, ...NO_PROMPT }, ...options });
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Written whole and renamed into place, so a read never sees it half written. On Windows a rename over a file another
// process holds open (a run reading it, a scanner) can fail for a moment, so it is tried again before it fails.
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const partial = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(partial, `${JSON.stringify(data, null, 2)}\n`);
  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        fs.renameSync(partial, file);
        return;
      } catch (error) {
        if (attempt >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
        pause(50 * attempt);
      }
    }
  } finally {
    fs.rmSync(partial, { force: true });
  }
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

/** Takes the lock `lock` by creating its file exclusively, so two hooks at once cannot both hold it; returns what it
 * wrote, the proof of holding it, or why not: a live run holds it. A lock older than `staleMinutes` is taken over. */
function takeLock(lock, now, staleMinutes = LOCK_STALE_MINUTES) {
  const mine = `${JSON.stringify({ pid: process.pid, at: new Date(now).toISOString() })}\n`;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(lock, mine, { flag: 'wx' });
      return { mine };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const held = lockTime(lock);
    if (held && now - held.at < staleMinutes * 60_000) return { refusal: `a backup is already running (pid ${held.pid})` };
    fs.rmSync(lock, { force: true });
  }
  return { refusal: 'a backup is already running (it took the stale lock first)' };
}

/** Removes the lock only while it is still the one this run wrote: a run that outlived its lock leaves the new one. */
function releaseLock(lock, mine) {
  let held;
  try {
    held = fs.readFileSync(lock, 'utf8');
  } catch {
    return;
  }
  if (held === mine) fs.rmSync(lock, { force: true });
}

/** The Claude project folders the clone holds a copy of, by name: a name is its own slug, so `inScope` takes it. */
function clonedSlugs(clone) {
  try {
    return fs.readdirSync(path.join(clone, 'claude', 'projects'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
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
  fs.writeFileSync(path.join(paths.clone, 'RESTORE.md'), restoreSteps(config.repo, transcriptsClones(paths, config), bundleCheckouts(deps, bundleSources(config))));
  const found = checkoutsOf((cwd, args, options) => git(deps, cwd, args, options), bundleSources(config), scope);
  // A repository git cannot read this time (a drive not mounted, a folder moved) lists no checkout, and the mirror would
  // drop the copies the last run made of its memory folders: under the same scope, every folder the clone holds stays.
  const checkouts = [...found.paths, ...(found.unreadable.length && previous?.scope === scope ? clonedSlugs(paths.clone) : [])];
  const { files, redacted } = collectFiles({ home: deps.home, dest: paths.clone, scope, desktop: deps.desktop, checkouts });
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
  // `recent` reaches last.json too, outside the clone: with the clone gone, the session-start notice still knows the files.
  return { counts: exported.counts, live, committed, pushed, redacted: manifest.redacted.length, unreadable, summary, recent };
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
function pushClone(deps, clone, repo, timeout = PUSH_TIMEOUT_MS) {
  const ahead = git(deps, clone, ['rev-list', '--count', '@{u}..HEAD']);
  // A clone of an empty repository has no upstream yet: everything it holds is to push.
  const owed = ahead.status === 0 ? Number(ahead.stdout.trim()) : Number(git(deps, clone, ['rev-list', '--count', 'HEAD']).stdout.trim());
  if (!owed) return 0;
  const urls = originUrls(deps, clone);
  const visibility = deps.run('gh', ['repo', 'view', repo, '--json', 'visibility', '-q', '.visibility']);
  const refusal = pushRefusal({ urls, repo, visibility: visibility.status === 0 ? visibility.stdout.trim() : null });
  if (refusal) throw new Error(refusal);
  const push = () => git(deps, clone, ['push', '-q', '-u', 'origin', 'HEAD'], { timeout });
  let result = push();
  if (result.status !== 0 && /rejected|fetch first|non-fast-forward/.test(result.stderr)) {
    const rebased = git(deps, clone, ['pull', '-q', '--rebase', 'origin', 'HEAD'], { timeout });
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

/** The bytes of a clone's objects, loose and packed, from `git count-objects -v`: close to what GitHub stores. */
function objectBytes(deps, dir) {
  const counted = git(deps, dir, ['count-objects', '-v']);
  if (counted.status !== 0) throw new Error(`git count-objects failed in ${dir}: ${counted.stderr.trim()}`);
  const kib = (key) => Number(new RegExp(`^${key}: (\\d+)$`, 'm').exec(counted.stdout)?.[1] ?? 0);
  return (kib('size') + kib('size-pack')) * 1024;
}

/** Whether the transcripts are configured and their last attempt, pushed or not, is a day old (D3); `t` is their own
 * record, transcripts.json. */
function transcriptsDue(config, t, now) {
  if (!config?.transcripts?.repos?.length) return false;
  const tried = Math.max(Date.parse(t?.lastSuccess?.at ?? '') || 0, Date.parse(t?.lastFailure?.at ?? '') || 0);
  return now - tried >= TRANSCRIPTS_EVERY_HOURS * 60 * 60_000;
}

/** One transcripts backup (D1-D4): copies every transcript into its clone, commits and pushes each clone through
 * `pushClone`, so each push is checked PRIVATE first. The last clone takes no new transcript once it is full, and the
 * outcome names the repository to open next. */
function runTranscripts(deps, paths, config) {
  const clones = transcriptsClones(paths, config);
  for (const clone of clones) {
    if (!fs.existsSync(path.join(clone.dir, '.git'))) throw new Error(`no clone of ${clone.name} at ${clone.dir}: run js-harness backup init --transcripts-repo ${clone.name}`);
  }
  const roll = deps.transcriptsRollBytes ?? TRANSCRIPTS_ROLL_BYTES;
  const active = clones.at(-1);
  const copied = copyTranscripts({ projects: path.join(deps.home, '.claude', 'projects'), clones, full: objectBytes(deps, active.dir) >= roll });
  let pushed = 0;
  let files = 0;
  for (const clone of clones) {
    files += readJson(path.join(clone.dir, 'manifest.json'))?.files?.length ?? 0;
    const added = git(deps, clone.dir, ['-c', 'core.longpaths=true', 'add', '-A']);
    if (added.status !== 0) throw new Error(`git add failed in ${clone.dir}: ${(added.stderr || added.stdout).trim()}`);
    if (git(deps, clone.dir, ['status', '--porcelain']).stdout.trim()) {
      const made = git(deps, clone.dir, ['commit', '-q', '-m', `transcripts: ${copied.changed} changed`]);
      if (made.status !== 0) throw new Error(`git commit failed in ${clone.dir}: ${(made.stderr || made.stdout).trim()}`);
    }
    pushed += pushClone(deps, clone.dir, clone.name, TRANSCRIPTS_PUSH_TIMEOUT_MS);
  }
  const rollover = copied.waiting.length || objectBytes(deps, active.dir) >= roll ? nextTranscriptsRepo(active.name) : null;
  return { files, repos: clones.length, changed: copied.changed, pushed, waiting: copied.waiting.length, refused: copied.refused, rollover };
}

/** The transcripts step of `backup run`, under its own lock: when due or `force`d, runs them and records the outcome in
 * transcripts.json. Returns false only when it failed. */
function transcriptsStep(deps, paths, force) {
  const config = readJson(paths.config);
  if (!transcriptsClones(paths, config).length) return true;
  if (!force && !transcriptsDue(config, readJson(paths.transcriptsLast), deps.now())) return true;
  const note = (entry) => {
    writeJson(paths.transcriptsLast, { ...(readJson(paths.transcriptsLast) ?? {}), ...entry });
  };
  const at = () => new Date(deps.now()).toISOString();
  let taken;
  try {
    taken = takeLock(paths.transcriptsLock, deps.now(), TRANSCRIPTS_LOCK_STALE_MINUTES);
  } catch (error) {
    // Recorded, so the hook does not find them due again at its next stop.
    note({ lastFailure: { at: at(), error: error.message } });
    deps.stderr.write(`backup: transcripts: ${error.message}
`);
    return false;
  }
  const { mine, refusal } = taken;
  if (refusal) {
    deps.stderr.write(`backup: transcripts: ${refusal}\n`);
    return !force;
  }
  try {
    const outcome = runTranscripts(deps, paths, config);
    note({ lastSuccess: { at: at(), files: outcome.files, pushed: outcome.pushed }, rollover: outcome.rollover });
    deps.stdout.write(`backup: transcripts: ${outcome.files} files in ${outcome.repos} repositories, ${outcome.changed} changed, ${outcome.pushed} pushed\n`);
    if (outcome.waiting) deps.stdout.write(`backup: transcripts: ${outcome.waiting} new transcripts wait for the next repository: js-harness backup init --transcripts-repo ${outcome.rollover}\n`);
    else if (outcome.rollover) deps.stdout.write(`backup: transcripts: the repository is full; open the next: js-harness backup init --transcripts-repo ${outcome.rollover}\n`);
    for (const r of outcome.refused) deps.stdout.write(`backup: transcripts: ${r.path} not copied: ${r.reason}\n`);
    return true;
  } catch (error) {
    note({ lastFailure: { at: at(), error: error.message } });
    deps.stderr.write(`backup: transcripts: ${error.message}\n`);
    return false;
  } finally {
    releaseLock(paths.transcriptsLock, mine);
  }
}

function runCommand(args, deps) {
  const paths = backupPaths(deps.home);
  const status = runMemory(args, deps, paths);
  // After the memory backup and outside its lock: a first transcripts push may take an hour. A transcripts failure is
  // the exit only when they were asked for by name.
  const transcripts = transcriptsStep(deps, paths, args.includes('--transcripts'));
  return status || (transcripts || !args.includes('--transcripts') ? 0 : 1);
}

function runMemory(args, deps, paths) {
  const { mine, refusal } = takeLock(paths.lock, deps.now());
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
    releaseLock(paths.lock, mine);
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
function localCopy(deps, from, marker, branch, timeout = PUSH_TIMEOUT_MS) {
  if (fs.existsSync(path.join(from, marker))) return { dir: from, done: () => {} };
  const scratch = fs.mkdtempSync(path.join(deps.tmp ?? os.tmpdir(), 'backup-from-'));
  const dir = path.join(scratch, 'clone');
  const cloned = deps.run('git', ['clone', '-q', from, dir, '--depth=1', ...(branch ? [`--branch=${branch}`] : []), '--config', 'core.longpaths=true'], {
    env: { ...deps.env, ...NO_PROMPT },
    timeout,
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
  if (refuseBareFlag(args, ['--from', '--home', '--transcripts'], 'restore', deps)) return 2;
  const from = valueOf(args, '--from');
  const transcripts = valueOf(args, '--transcripts');
  // The home defaults to this user's: a documented `--home %USERPROFILE%` reaches PowerShell
  // unexpanded and would restore into a folder named after the literal text.
  const home = valueOf(args, '--home') ?? deps.home;
  if ((!from && !transcripts) || !home) {
    deps.stderr.write('backup restore: --from <dir|git url> or --transcripts <dir|git url> is required (--home <dir> defaults to this user\'s home)\n');
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
    if (from) {
      source = localCopy(deps, from, 'manifest.json');
      restoreBackup({ from: source.dir, home: path.resolve(home), merge: args.includes('--merge'), map, run: deps.run, env: deps.env, stdout: deps.stdout });
      source.done();
      source = null;
    }
    if (transcripts) {
      source = localCopy(deps, transcripts, 'manifest.json', undefined, TRANSCRIPTS_PUSH_TIMEOUT_MS);
      restoreTranscripts({ from: source.dir, home: path.resolve(home), stdout: deps.stdout });
    }
    return 0;
  } catch (error) {
    deps.stderr.write(`backup restore: ${error.message}\n`);
    return 1;
  } finally {
    source?.done();
  }
}

function verifyCommand(args, deps) {
  if (refuseBareFlag(args, ['--from', '--summary', '--transcripts'], 'verify', deps)) return 2;
  const from = valueOf(args, '--from');
  const summary = valueOf(args, '--summary');
  const transcripts = valueOf(args, '--transcripts');
  if (!from && !summary && !transcripts) {
    deps.stderr.write('backup verify: --from <dir|git url>, --summary <dir|git url> or --transcripts <dir|git url> is required\n');
    return 2;
  }
  if ([from, summary, transcripts].filter(Boolean).length > 1) {
    deps.stderr.write('backup verify: one of --from, --summary or --transcripts at a time\n');
    return 2;
  }
  let source;
  try {
    let result;
    if (transcripts) {
      source = localCopy(deps, transcripts, 'manifest.json', undefined, TRANSCRIPTS_PUSH_TIMEOUT_MS);
      result = verifyTranscripts(source.dir);
    } else if (from) {
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
    transcripts: transcriptsClones(paths, config),
    now: deps.now(),
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
  const fix = [];
  if (!(now - success < BACKUP_STALE_HOURS * 60 * 60_000 && !failedSince && !cloneGone && !noRecent)) {
    const failure = failedSince ? `; last failure ${last.lastFailure.at}: ${last.lastFailure.error}` : '';
    const gone = cloneGone ? `; the clone ${paths.clone} is gone` : '';
    const recent = noRecent ? '; no RECENT.md in the clone, so Engram has no readable fallback' : '';
    fix.push(`memory backup: last success ${last.lastSuccess?.at ?? 'never'}${failure}${gone}${recent}: run js-harness backup status`);
  }
  const transcripts = transcriptsHealth(readJson(paths.config), readJson(paths.transcriptsLast) ?? {}, now);
  if (transcripts) fix.push(transcripts);
  return fix.length ? { state: 'stale', fix } : { state: 'ok', fix };
}

/** The transcripts' line of the backup row (odd/tasks/transcripts-backup.md, D6), or null while they are healthy or not
 * configured: no success in two days, a failure after the last success, or a full repository. */
function transcriptsHealth(config, t, now) {
  if (!config?.transcripts?.repos?.length) return null;
  const success = Date.parse(t.lastSuccess?.at ?? '') || 0;
  const failedSince = t.lastFailure && Date.parse(t.lastFailure.at) > success;
  if (now - success < TRANSCRIPTS_STALE_HOURS * 60 * 60_000 && !failedSince && !t.rollover) return null;
  const failure = failedSince ? `; last failure ${t.lastFailure.at}: ${t.lastFailure.error}` : '';
  const full = t.rollover ? `; the last repository is full: run js-harness backup init --transcripts-repo ${t.rollover}` : '';
  return `memory backup, transcripts: last success ${t.lastSuccess?.at ?? 'never'}${failure}${full}: run js-harness backup status`;
}

function statusCommand(deps) {
  const paths = backupPaths(deps.home);
  const config = readJson(paths.config);
  if (!config) {
    deps.stdout.write('backup: not initialised (js-harness backup init --repo <owner/name>)\n');
    return 1;
  }
  const last = readJson(paths.last) ?? {};
  const cloned = fs.existsSync(path.join(paths.clone, '.git'));
  const ahead = git(deps, paths.clone, ['rev-list', '--count', '@{u}..HEAD']);
  const lines = [
    `repository: ${config.repo}`,
    `scope: ${config.scope ?? DEFAULT_SCOPE}${config.scope ? '' : ' (the default)'}`,
    `last success: ${last.lastSuccess ? `${last.lastSuccess.at}, ${last.lastSuccess.counts.observations} observations` : 'never'}`,
    `last failure: ${last.lastFailure ? `${last.lastFailure.at}, ${last.lastFailure.error}` : 'none'}`,
    `to push: ${ahead.status === 0 ? `${ahead.stdout.trim()} commits` : cloned ? 'unknown (no upstream yet)' : 'unknown (no clone)'}`,
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
  const clones = transcriptsClones(paths, config);
  if (clones.length) {
    const t = readJson(paths.transcriptsLast) ?? {};
    const success = t.lastSuccess ? `last success ${t.lastSuccess.at}, ${t.lastSuccess.files} files` : 'last success never';
    const failed = t.lastFailure && !(Date.parse(t.lastSuccess?.at ?? '') > Date.parse(t.lastFailure.at)) ? `; last failure ${t.lastFailure.at}, ${t.lastFailure.error}` : '';
    const full = t.rollover ? `; full: init --transcripts-repo ${t.rollover}` : '';
    lines.push(`transcripts: ${clones.map((c) => c.name).join(', ')}, ${success}${failed}${full}`);
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
  const last = readJson(paths.last);
  const success = Date.parse(last?.lastSuccess?.at ?? '') || 0;
  if (now - success < BACKUP_EVERY_MINUTES * 60_000) return 'backed up less than 30 minutes ago';
  // The transcripts change at every turn and count for nothing below, so their day alone makes a run due, unless a
  // transcripts run holds their lock: a first push can take an hour, and records nothing until it ends.
  const pushing = lockTime(paths.transcriptsLock);
  if (!(pushing && now - pushing.at < TRANSCRIPTS_LOCK_STALE_MINUTES * 60_000) && transcriptsDue(readJson(paths.config), readJson(paths.transcriptsLast), now)) return null;
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

/** The notice of `backup --session-start` (odd/tasks/recent-memory.md, D7), or null: no backup here, no file for the
 * session's project, or an Engram that still holds nine tenths of what the last backup held of it. */
function sessionNotice(deps) {
  const paths = backupPaths(deps.home);
  const config = readJson(paths.config);
  if (!config?.repo) return null;
  const text = deps.stdin();
  if (!text.trim()) return null;
  const cwd = JSON.parse(text)?.cwd;
  if (typeof cwd !== 'string' || !cwd) return null;
  const cloneExists = fs.existsSync(path.join(paths.clone, '.git'));
  const recent = (cloneExists ? readJson(path.join(paths.clone, 'manifest.json'))?.recent : null) ?? readJson(paths.last)?.lastSuccess?.recent;
  if (!Array.isArray(recent) || !recent.length) return null;
  const origin = deps.run('git', ['-C', cwd, 'remote', 'get-url', 'origin']);
  const { project } = projectOf({
    env: deps.env,
    cwd,
    main: mainCheckout(deps.run, cwd),
    config: (dir) => readJson(path.join(dir, '.engram', 'config.json')),
    origin: origin.status === 0 ? origin.stdout.trim() : null,
    recent,
  });
  const entry = recent.find((r) => r.project === project);
  if (!entry) return null;
  const stats = readStats(deps.run('engram', ['stats', '--project', project], { timeout: STATS_TIMEOUT_MS }));
  return fallbackNotice({ entry, stats, clone: paths.clone, cloneExists, repo: config.repo });
}

/** `backup --session-start`: prints the notice in the hooks contract when there is one, and exits 0 whatever happens,
 * since a SessionStart hook never breaks a session. */
function sessionStartCommand(deps) {
  try {
    const notice = sessionNotice(deps);
    if (notice) deps.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: notice } })}\n`);
  } catch {
    // An unreadable input or a file half-written: nothing to say this time.
  }
  return 0;
}

/** The root of the git work tree `dir` is in, as git names it and Node resolves it, or null when `dir` is in none (a
 * bare repository included). `backup init` bundles that root, the one repository a checkout is. */
function checkoutRoot(deps, dir) {
  const top = deps.run('git', ['-C', dir, 'rev-parse', '--show-toplevel']);
  return top.status === 0 && top.stdout.trim() ? path.resolve(top.stdout.trim()) : null;
}

/** Whether two paths name one folder. Windows folders are case-insensitive, so there the spelling does not decide it. */
function sameFolder(a, b) {
  const key = (place) => (process.platform === 'win32' ? path.resolve(place).toLowerCase() : path.resolve(place));
  return key(a) === key(b);
}

/** The origin URL of a repository, for RESTORE.md, with its credential removed (`withoutCredentials`), or null when the
 * repository has none or git cannot read it. It is read at write time, so RESTORE.md always names the origin as it is. */
function originOf(deps, dir) {
  const got = deps.run('git', ['-C', dir, 'remote', 'get-url', 'origin']);
  return got.status === 0 ? withoutCredentials(got.stdout.trim()) : null;
}

/** Each bundled repository as RESTORE.md names it: its path as `config.json` holds it and its origin, or null. */
function bundleCheckouts(deps, bundles) {
  return bundles.map((dir) => ({ path: dir, origin: originOf(deps, dir) }));
}

/** An origin URL with its credential taken out, so no password or token reaches RESTORE.md, which is written to a
 * repository. `https://user:token@host/x.git` keeps only `https://host/x.git`; an `ssh://user:pass@host/x.git` keeps its
 * user, since a user name is no secret, and loses the password. A scp-like `git@host:x.git` has no scheme, so it is left
 * as it is. Null when the text has a scheme the URL parser refuses: nothing unreadable is written in its place. */
function withoutCredentials(text) {
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'ssh:') url.username = '';
  url.password = '';
  return url.toString();
}

/** RESTORE.md (D5): the way back, kept in the private repository so it survives the machine with the memory. `checkouts`
 * are the bundled repositories (`bundleCheckouts`): RESTORE.md clones each into the path it had, since the Claude memory
 * folder is named after that path. Nothing is named but what the config and the origins hold, never a path of the owner's. */
function restoreSteps(repo, transcripts = [], checkouts = []) {
  const url = `https://github.com/${repo}.git`;
  // Each checkout gets a clone line: its origin when it has one, else the instruction to clone it from wherever the
  // project lives (no URL is made up). With no checkout bundled, the steps say so and leave the folder to the user.
  const cloneLines = checkouts.length
    ? [
      '3. Clone each repository the backup bundles into the path it had, since the Claude memory folder is named after that path:',
      ...checkouts.map((c) => (c.origin
        ? `   \`git clone ${c.origin} ${c.path}\``
        : `   Clone it from wherever the project lives into \`${c.path}\` (it has no origin, or git cannot read it).`)),
      '   If a checkout lives elsewhere now, add `--map <old path>=<new path>` for it to the next step.',
    ]
    : [
      '3. No repository was bundled when this backup was made (`backup init` found no checkout): clone your projects',
      '   from wherever they live, and for one whose path differs now, add `--map <old path>=<new path>` to the next step.',
    ];
  // The transcripts repositories (odd/tasks/transcripts-backup.md, D6), one line each, oldest first.
  const transcriptLines = transcripts.length
    ? [
      '   Then the Claude transcripts, from each of their private repositories (none writes over a live file):',
      ...transcripts.map((t) => `   \`js-harness backup restore --transcripts https://github.com/${t.name}.git\``),
    ]
    : [];
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
    '2. Install Claude Code and Codex, then js-harness, so every step below runs the installed `js-harness` from',
    `   any folder: ${INSTALL_NEWEST}.`,
    ...cloneLines,
    `4. \`js-harness backup restore --from ${url}\``,
    '   It restores into this user\'s home (`--home <dir>` names another): it imports Engram, puts back the',
    '   memory folders and ~/.js-harness, and leaves the old config files in',
    '   ~/.js-harness/restored-config to compare by hand. It prints the line that fetches unpushed commits.',
    ...transcriptLines,
    `5. \`js-harness backup verify --from ${url}\` restores again into a scratch home and checks it.`,
    '6. `js-harness install`.',
    `7. \`js-harness backup init --repo ${repo}\` and \`js-harness backup run --adopt\`: this`,
    '   machine takes over the backup.',
    '',
    'An Engram restore brings back every observation as it is now, not its edit history (observation_versions).',
    '',
  ].join('\n');
}

/** Makes `repo` a private repository with a clone at `dir`: creates it private when it does not exist, reads its
 * visibility back, and clones it only when it reads PRIVATE. Returns why not, or null. The public repository is refused
 * before anything is asked of GitHub. */
function privateClone(deps, repo, dir, description) {
  const url = `https://github.com/${repo}.git`;
  if (repo.toLowerCase() === PUBLIC_REPO) return pushRefusal({ urls: [url], repo, visibility: null });
  const view = () => deps.run('gh', ['repo', 'view', repo, '--json', 'visibility', '-q', '.visibility']);
  let visibility = view();
  if (visibility.status !== 0) {
    const made = deps.run('gh', ['repo', 'create', repo, '--private', '--description', description]);
    if (made.status !== 0) return `gh repo create failed: ${(made.stderr || made.stdout).trim()}`;
    visibility = view();
  }
  const visible = visibility.stdout.trim() || null;
  const refusal = pushRefusal({ urls: [url], repo, visibility: visible });
  if (refusal) return refusal;
  // A clone already there is kept only when its own origin is this repository: init must not report another's as this one.
  if (fs.existsSync(path.join(dir, '.git'))) return pushRefusal({ urls: originUrls(deps, dir), repo, visibility: visible });
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  // Long paths on: a transcript's stored path can pass Windows' 260 characters under the home.
  const cloned = deps.run('git', ['clone', '-q', url, dir, '--config', 'core.longpaths=true'], { env: { ...deps.env, ...NO_PROMPT } });
  return cloned.status === 0 ? null : `git clone failed: ${cloned.stderr.trim()}`;
}

/** `backup init --transcripts-repo <owner/name>` (odd/tasks/transcripts-backup.md, D4): adds a private repository for
 * the transcripts, after the memory backup's, to config.json's `transcripts.repos`, and clones it. The last one named
 * takes the new transcripts. */
function initTranscripts(repo, deps) {
  const paths = backupPaths(deps.home);
  const config = readJson(paths.config);
  if (!config?.repo) {
    deps.stderr.write('backup init: the memory backup is not initialised: run js-harness backup init --repo <owner/name> first\n');
    return 1;
  }
  if (repo.toLowerCase() === config.repo.toLowerCase()) {
    deps.stderr.write(`backup init: refused: ${repo} is the memory backup's own repository, and the transcripts go to one of their own\n`);
    return 1;
  }
  const clone = path.join(paths.transcripts, repo.split('/')[1]);
  // A clone is named by the repository alone, so two owners' repositories of one name would share it.
  const sharing = transcriptsClones(paths, config).find((c) => c.name.toLowerCase() !== repo.toLowerCase() && c.dir.toLowerCase() === clone.toLowerCase());
  if (sharing) {
    deps.stderr.write(`backup init: refused: ${repo} would share the clone of ${sharing.name} (${clone}); name the repository otherwise\n`);
    return 1;
  }
  const refusal = privateClone(deps, repo, clone, 'js-harness Claude transcripts backup (private)');
  if (refusal) {
    deps.stderr.write(`backup init: ${refusal}\n`);
    return 1;
  }
  const repos = transcriptsClones(paths, config).map((c) => c.name);
  if (!repos.includes(repo)) writeJson(paths.config, { ...config, transcripts: { ...(config.transcripts ?? {}), repos: [...repos, repo] } });
  deps.stdout.write(`backup: ${repo} reads PRIVATE; transcripts clone in ${clone}\n`);
  return 0;
}

function initCommand(args, deps) {
  if (refuseBareFlag(args, ['--summary-repo', '--checkout'], 'init', deps)) return 2;
  const t = args.indexOf('--transcripts-repo');
  if (t !== -1) {
    const repo = args[t + 1];
    if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
      deps.stderr.write('backup init: --transcripts-repo <owner/name> needs a value\n');
      return 2;
    }
    return initTranscripts(repo, deps);
  }
  const i = args.indexOf('--repo');
  const repo = i === -1 ? undefined : args[i + 1];
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    deps.stderr.write('backup init: --repo <owner/name> is required\n');
    return 2;
  }
  // The checkout is named by `--checkout <path>`, else the git repository the folder init runs in. It is resolved before
  // anything is written or asked of GitHub: a path in no work tree is refused with nothing changed.
  const checkoutFlag = valueOf(args, '--checkout');
  const checkout = checkoutFlag === undefined ? checkoutRoot(deps, deps.cwd()) : checkoutRoot(deps, path.resolve(checkoutFlag));
  if (checkoutFlag !== undefined && !checkout) {
    deps.stderr.write(`backup init: refused: ${checkoutFlag} is not inside a git work tree; --checkout names one\n`);
    return 2;
  }
  const paths = backupPaths(deps.home);
  const refusal = privateClone(deps, repo, paths.clone, 'js-harness memory backup (private)');
  if (refusal) {
    deps.stderr.write(`backup init: ${refusal}\n`);
    return 1;
  }
  const config = { ...(readJson(paths.config) ?? {}), repo };
  // The bundle list is what RESTORE.md names, so it is the one place a checkout is recorded. A config with no list yet
  // takes the checkout init runs in; a list on disk, empty or not, is left exactly as it is unless --checkout names a
  // checkout: that one is added when no entry is the same folder, and init says so either way.
  const fresh = !Array.isArray(config.bundles);
  if (fresh) config.bundles = [];
  if (checkoutFlag !== undefined) {
    if (config.bundles.some((dir) => typeof dir === 'string' && sameFolder(dir, checkout))) {
      deps.stdout.write(`backup: ${checkout} is already bundled\n`);
    } else {
      config.bundles.push(checkout);
      deps.stdout.write(`backup: added ${checkout} to bundles\n`);
    }
  } else if (fresh && checkout) {
    config.bundles.push(checkout);
  }
  // The checkout whose main the public summary reads (D4), only when named: a push to a public repository cannot be
  // taken back, so it is never a default, and its first content is read first with `backup summary --summary-repo`.
  if (args.includes('--summary-repo')) {
    const named = path.resolve(valueOf(args, '--summary-repo'));
    const refused = summaryRefusal(deps, named);
    if (refused) {
      deps.stderr.write(`backup init: ${refused}\n`);
      return 1;
    }
    config.summaryRepo = named;
  }
  writeJson(paths.config, config);
  fs.writeFileSync(path.join(paths.clone, 'RESTORE.md'), restoreSteps(repo, transcriptsClones(paths, config), bundleCheckouts(deps, config.bundles)));
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
  // Said once more when nothing is bundled, so the owner learns that no repository is backed up before a wipe relies on it.
  if (!config.bundles.length) {
    deps.stdout.write('backup: no repository will be bundled: init found no git checkout here; add one with js-harness backup init --repo <owner/name> --checkout <path>\n');
  }
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
    cwd: () => process.cwd(),
    stdin: () => (process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8')),
    desktop: desktopDir(home, process.env),
    // Node itself on this install's own entry point: no `.cmd` shim, no shell between the hook and the run.
    startDetached: (args) => {
      const entry = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));
      const child = spawn(process.execPath, [entry, ...args], { detached: true, stdio: 'ignore', windowsHide: true });
      child.unref();
    },
  };
}

// The flags each subcommand takes: `valued` ones take the next token as their value. A token none of them takes is
// refused with exit 2, so a mistyped flag never runs the command with its defaults. The hooks' entry points (`--hook`,
// `--session-start`) are not here: the host runs them, and they always exit 0.
const FLAGS = {
  run: { bare: ['--allow-shrink', '--adopt', '--transcripts'] },
  status: {},
  ready: {},
  summary: { valued: ['--summary-repo'] },
  init: { valued: ['--repo', '--checkout', '--summary-repo', '--transcripts-repo'] },
  restore: { valued: ['--from', '--home', '--map', '--transcripts'], bare: ['--merge'] },
  verify: { valued: ['--from', '--summary', '--transcripts'] },
};

export async function backupMain(args, deps = defaultDeps()) {
  const [sub, ...rest] = args;
  const unknown = Object.hasOwn(FLAGS, sub) ? unknownArgument(rest, FLAGS[sub]) : null;
  if (unknown !== null) {
    deps.stderr.write(`backup ${sub}: unknown argument: ${unknown}\n`);
    return 2;
  }
  if (sub === 'run') return runCommand(rest, deps);
  if (sub === 'status') return statusCommand(deps);
  if (sub === 'ready') return readyCommand(deps);
  if (sub === 'summary') return summaryCommand(rest, deps);
  if (sub === 'restore') return restoreCommand(rest, deps);
  if (sub === 'verify') return verifyCommand(rest, deps);
  if (sub === 'init') return initCommand(rest, deps);
  if (sub === '--hook') return hookCommand(deps);
  if (sub === '--session-start') return sessionStartCommand(deps);
  if (sub === '--help' || sub === '-h' || sub === undefined) {
    deps.stdout.write(`${USAGE}\n`);
    return sub === undefined ? 2 : 0;
  }
  deps.stderr.write(`backup: unknown subcommand ${sub}\n\n${USAGE}\n`);
  return 2;
}
