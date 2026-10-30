// `merge-queue --refresh-copy` run alone (S4, S5 of odd/tasks/lead-manual-steps.md): `refreshNow`
// (./merge-queue-refresh.mjs) with this machine's effects. Moved out of bin/merge-queue.mjs, which holds the land and
// stays under its line ceiling. Main is origin's default branch once fetched in the checkout; the copy is the one
// pnpm's shim names; its processes are read from one process table and one listing of command lines (Windows); a wait
// is stopped by pid and creation time; its session is read from the transcripts and told by a note in its project's
// channel. No land record is written. Zero dependencies.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendNotice, newNotice, readNotices } from './channel.mjs';
import { defaultBranchOf } from './default-branch.mjs';
import { harnessHome } from './home.mjs';
import { refreshNow } from './merge-queue-refresh.mjs';
import { readCopy } from './merge-queue-waits.mjs';
import { listCommandLines } from './process-list.mjs';
import { killProcesses, takeSnapshot } from './process-tree.mjs';
import { namedSha, refreshCopy } from './refresh-copy.mjs';
import { comparable, mainCheckout, projectDirsOf, projectSlug } from './sessions.mjs';
import { WAKE_WINDOW_MS, wakePlan } from './wake.mjs';

/** The refresh now for the checkout `args.cwd`. `answer(run, command, args, cwd)` is the queue's way to run a command
 * and read it (`{ ok, out }`); `versionOf(sha)` the version main's package.json names at `sha`; `pnpmBinDir` the
 * upgrade's reading of pnpm's global bin folder (bin/update.mjs), handed in since a module here imports no command. */
export async function refreshNowRun(args, { run = spawnSync, env, now, stdout, stderr, answer, versionOf, pnpmBinDir, refreshCopy: refresh = refreshCopy, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const gitIn = (...gitArgs) => answer(run, 'git', gitArgs, args.cwd);
  const mainOf = () => {
    if (!gitIn('fetch', '-q', 'origin').ok) return { why: 'could not fetch origin' };
    const named = defaultBranchOf((command, gitArgs) => answer(run, command, gitArgs, args.cwd));
    if (!named.name) return { why: named.why };
    const sha = gitIn('rev-parse', '--verify', '--quiet', `origin/${named.name}`).out.trim();
    return sha ? { sha } : { why: `could not read origin/${named.name}` };
  };
  const main = mainOf();
  const binDir = main.sha ? pnpmBinDir(run, ['pnpm'], undefined, process.platform) : null;
  if (main.sha && !binDir) {
    stderr("refresh: pnpm's global bin folder is not known (pnpm bin -g gave none): nothing was refreshed");
    return 1;
  }
  const utf8 = (command, cmdArgs, options) => run(command, cmdArgs, { ...options, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  const globalDir = binDir ? path.join(path.dirname(binDir), 'global') : null;
  const look = () => {
    const snapshot = takeSnapshot({ spawnSync: run });
    return { snapshot, ...readCopy({ snapshot, processes: listCommandLines(utf8, process.platform, 'js-harness'), globalDir, self: process.pid }) };
  };
  const home = harnessHome({ env, homedir: os.homedir });
  const from = { host: os.hostname(), id: null, source: 'merge-queue', title: 'js-harness merge-queue' };
  const tell = (number, text, slug = projectSlug(mainCheckout(utf8, args.cwd))) => {
    appendNotice(home, slug, newNotice({ at: new Date(now()).toISOString(), from, to: String(number), kind: 'note', text }));
  };
  const claudeHome = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const sessions = () => {
    const root = mainCheckout(utf8, args.cwd);
    // A folder that is gone, as a landed worktree's, names no checkout: its channel is not known.
    const slugOf = (cwd) => (fs.existsSync(cwd) ? projectSlug(mainCheckout(utf8, cwd)) : null);
    return openSessions({ claudeHome, home, here: { slug: projectSlug(root), root, dirs: projectDirsOf(utf8, root, claudeHome) }, now, slugOf });
  };
  return refreshNow({
    main, copySha: binDir ? namedSha(binDir) : null, look, stop: (targets) => killProcesses(targets, { spawnSync: run }), sessions, refresh,
    versionOf, tell, home, cwd: args.cwd, env, sleep, stdout, stderr,
  });
}

/** The folder the session of transcript `text` ran in: the first entry's `cwd` that names one, or null. */
function cwdOf(text) {
  for (const line of text.split('\n')) {
    try {
      const { cwd } = JSON.parse(line);
      if (typeof cwd === 'string' && cwd !== '') return cwd;
    } catch {
      // A line that is no JSON names no folder.
    }
  }
  return null;
}

/** The sessions open now (`now()`) with their background waits not ended, as wake reads them after a boot (`wakePlan`),
 * of every project under `claudeHome`: the installed copy is the machine's, so a wait another project started runs from
 * it too. Each comes with the `slug` of the channel its note goes to, its main checkout's, as `notify` names it: a
 * folder of this project's (`here.dirs`, its checkout's and its worktrees') is `here.slug`, and so is a transcript
 * that ran under `here.root`, as in a worktree git no longer lists; any other is `slugOf(cwd)`, `cwd` the folder
 * its session ran in, read from the transcript (Codex P2 on b9fa64f..8843225: a worktree's folder name is no channel),
 * null when that cannot be known, and the folder's own name when the transcript names no folder. A session whose
 * transcript holds no title, as one opened from the phone, is named by the opening it read (the channel's readings).
 * A folder or a
 * transcript that cannot be read holds no session to tell. */
export function openSessions({ claudeHome, home, here, now, slugOf = () => null }) {
  const under = here.root ? `${comparable(here.root)}/` : null;
  const projects = path.join(claudeHome, 'projects');
  let names = [];
  try {
    names = fs.readdirSync(projects, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
  const mine = new Set(here.dirs.map((dir) => path.basename(dir)));
  const slugs = new Map();
  const slugIn = (cwd, name) => {
    if (cwd === null) return name;
    if (under !== null && `${comparable(cwd)}/`.startsWith(under)) return here.slug;
    if (!slugs.has(cwd)) slugs.set(cwd, slugOf(cwd));
    return slugs.get(cwd);
  };
  const bySlug = new Map();
  for (const name of names) {
    const dir = path.join(projects, name);
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((file) => file.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        if (fs.statSync(path.join(dir, file)).mtimeMs < now() - WAKE_WINDOW_MS) continue;
        const text = fs.readFileSync(path.join(dir, file), 'utf8');
        const slug = mine.has(name) ? here.slug : slugIn(cwdOf(text), name);
        bySlug.set(slug, [...(bySlug.get(slug) ?? []), { id: file.slice(0, -'.jsonl'.length), text }]);
      } catch {
        // A transcript removed while this reads holds no wait to tell.
      }
    }
  }
  const bootAt = new Date(now()).toISOString();
  return [...bySlug].flatMap(([slug, transcripts]) => wakePlan({ bootAt, transcripts, readings: slug === null ? [] : readNotices(home, slug).readings }).map((one) => ({ ...one, slug })));
}
