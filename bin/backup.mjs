#!/usr/bin/env node
// `backup`: the memory that survives the machine (odd/tasks/memory-backup.md). The full copy goes to a private GitHub
// repository through a local clone under the home; a short summary goes to a branch of the public one. Zero
// dependencies: `engram`, `git` and `gh` are run as programs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildManifest,
  collectFiles,
  defaultRun,
  exportEngram,
  parseStats,
  pushRefusal,
  readJson,
  scopeArgs,
} from './lib/backup.mjs';

const USAGE = [
  'Usage: js-harness backup <run | status | init | --hook>',
  '  run [--allow-shrink] [--adopt]  Back up now: the Engram export and the Claude memory folders of the scope, the',
  '    js-harness home and reference copies of the config, secrets blanked, into the private clone, then push it. The',
  '    scope is config.json\'s `scope`: "all" for every project, or one project name (js-harness when unset). It',
  '    refuses an export that lost more than a tenth of any count (a wiped Engram looks like that; --allow-shrink when',
  '    the drop is meant), a clone whose fetch or push URL is not the configured repository on github.com, and a',
  '    repository that does not read PRIVATE just before the push. --adopt takes over a backup another machine made',
  '    (the first run after a reinstall).',
  '  status  The last run, the last success, the last failure and why, and the commits still to push.',
  '  init --repo <owner/name>  Create the repository private when it does not exist, check it reads PRIVATE, clone it.',
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

/** The git repositories whose unpushed commits are bundled (D1): the configured ones, `D:/js-harness` by default. */
function bundleSources(config) {
  return Array.isArray(config.bundles) ? config.bundles : [];
}

/** The bundle file of a source, named from its whole path as Claude names a project folder (`D--js-harness`), so two
 * repositories of one name never share a bundle. */
export function bundleName(source) {
  return `${path.resolve(source).replace(/[^A-Za-z0-9]/g, '-')}.bundle`;
}

/** Writes the bundle of every commit of `source` that is on no remote, or removes it when there is none. Returns the
 * refs it holds, every ref and not only the branches, so the bundle is made again whenever what it would hold changes
 * and the manifest changes only when it does. A source git cannot read keeps its last bundle and says why. */
function bundleUnpushed(deps, source, clone) {
  const key = path.resolve(source);
  const out = path.join(clone, 'git', bundleName(source));
  const previous = readJson(path.join(clone, 'manifest.json'))?.bundles?.find((b) => b.source === key);
  const refs = git(deps, source, ['for-each-ref', '--format=%(objectname) %(refname)']);
  const unpushed = git(deps, source, ['rev-list', '--count', '--all', '--not', '--remotes']);
  if (refs.status !== 0 || unpushed.status !== 0) {
    // Its commits may be the very ones still to protect: the last bundle stays until git can read the source again.
    const reason = `${refs.stderr || unpushed.stderr || ''}`.trim().split('\n')[0] || 'git failed';
    const { unreadable, ...last } = previous ?? { source: key, commits: 0, refs: [] };
    return { ...last, unreadable: reason };
  }
  const count = Number(unpushed.stdout.trim()) || 0;
  if (count === 0) {
    fs.rmSync(out, { force: true });
    return { source: key, commits: 0, refs: [] };
  }
  const listed = refs.stdout.split('\n').filter(Boolean).sort();
  if (!(previous && !previous.unreadable && JSON.stringify(previous.refs) === JSON.stringify(listed) && fs.existsSync(out))) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const made = git(deps, source, ['bundle', 'create', out, '--all', '--not', '--remotes']);
    if (made.status !== 0) throw new Error(`git bundle of ${source} failed: ${made.stderr.trim()}`);
  }
  return { source: key, commits: count, refs: listed };
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
  const { files, redacted } = collectFiles({ home: deps.home, dest: paths.clone, scope });
  const bundles = bundleSources(config).map((source) => bundleUnpushed(deps, source, paths.clone));
  // A bundle no configured source names any more is left over (a source removed from config.json): it goes.
  const named = new Set(bundleSources(config).map(bundleName));
  const bundleDir = path.join(paths.clone, 'git');
  for (const file of fs.existsSync(bundleDir) ? fs.readdirSync(bundleDir) : []) {
    if (!named.has(file)) fs.rmSync(path.join(bundleDir, file), { force: true });
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
  writeJson(path.join(paths.clone, 'manifest.json'), { ...manifest, scope, bundles });

  git(deps, paths.clone, ['add', '-A']);
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
  return { counts: exported.counts, live, committed, pushed, redacted: manifest.redacted.length, unreadable };
}

/** Pushes the clone when it holds commits its remote does not, after the guard: origin and visibility (D2). A push the
 * remote rejects fetches and rebases once. Returns the number of commits pushed. */
function pushClone(deps, clone, repo) {
  const ahead = git(deps, clone, ['rev-list', '--count', '@{u}..HEAD']);
  // A clone of an empty repository has no upstream yet: everything it holds is to push.
  const owed = ahead.status === 0 ? Number(ahead.stdout.trim()) : Number(git(deps, clone, ['rev-list', '--count', 'HEAD']).stdout.trim());
  if (!owed) return 0;
  // Fetch and push URLs both: `get-url --push` applies a pushurl and pushInsteadOf, so it names where the push goes.
  const urls = [['remote', 'get-url', '--all', 'origin'], ['remote', 'get-url', '--push', '--all', 'origin']].flatMap(
    (args) => git(deps, clone, args).stdout.split('\n').map((line) => line.trim()).filter(Boolean),
  );
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
  if (outcome.error) next.lastFailure = { at, error: outcome.error };
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
    for (const b of outcome.unreadable) {
      deps.stdout.write(`backup: ${b.source} could not be read (${b.unreadable}); its last bundle is kept\n`);
    }
    return 0;
  } catch (error) {
    record(paths, deps.now(), { error: error.message });
    deps.stderr.write(`backup: ${error.message}\n`);
    return 1;
  } finally {
    releaseLock(paths, mine);
  }
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
  deps.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

/** The newest modification time among the things a backup copies (D2); Engram writes through its WAL. */
export function newestChange(home) {
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
  return newest;
}

/** Whether the hook should start a run now, and why not when it should not. */
export function dueReason(home, now) {
  const paths = backupPaths(home);
  if (!fs.existsSync(path.join(paths.clone, '.git'))) return 'not initialised';
  const held = lockTime(paths.lock);
  if (held && now - held.at < LOCK_STALE_MINUTES * 60_000) return 'a run holds the lock';
  const success = Date.parse(readJson(paths.last)?.lastSuccess?.at ?? '') || 0;
  if (now - success < BACKUP_EVERY_MINUTES * 60_000) return 'backed up less than 30 minutes ago';
  if (success && newestChange(home) <= success && !memoryFolderGone(home, paths.clone)) return 'nothing changed since the last backup';
  return null;
}

/** Whether a memory folder the clone holds is gone from the home: a folder deleted whole leaves no time to compare. */
function memoryFolderGone(home, clone) {
  const held = path.join(clone, 'claude', 'projects');
  const slugs = fs.existsSync(held) ? fs.readdirSync(held) : [];
  return slugs.some((slug) => !fs.existsSync(path.join(home, '.claude', 'projects', slug, 'memory')));
}

function hookCommand(deps) {
  try {
    if (dueReason(deps.home, deps.now()) === null) deps.startDetached(['backup', 'run']);
  } catch {
    // A Stop hook never breaks a turn.
  }
  return 0;
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
  writeJson(paths.config, config);
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
  if (sub === 'init') return initCommand(rest, deps);
  if (sub === '--hook') return hookCommand(deps);
  if (sub === '--help' || sub === '-h' || sub === undefined) {
    deps.stdout.write(`${USAGE}\n`);
    return sub === undefined ? 2 : 0;
  }
  deps.stderr.write(`backup: unknown subcommand ${sub}\n\n${USAGE}\n`);
  return 2;
}
