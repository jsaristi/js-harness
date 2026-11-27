// `merge-queue --refresh-copy` run alone (S4, S5 of odd/tasks/lead-manual-steps.md): `refreshNow`
// (./merge-queue-refresh.mjs) with this machine's effects. Moved out of bin/merge-queue.mjs, which holds the land and
// stays under its line ceiling. Main is origin's default branch once fetched in the checkout; the copy is the one
// pnpm's shim names; its processes are read from one process table and one listing of command lines (Windows); a wait
// is left running, since it outlives its folder's swap (JH 284). No land record is written. Zero dependencies.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultBranchOf } from './default-branch.mjs';
import { harnessHome } from './home.mjs';
import { refreshNow } from './merge-queue-refresh.mjs';
import { onlyWaits, readCopy } from './merge-queue-waits.mjs';
import { listCommandLines } from './process-list.mjs';
import { takeSnapshot } from './process-tree.mjs';
import { unansweredApply } from './refresh-consent.mjs';
import { namedSha, refreshCopy } from './refresh-copy.mjs';
import { projectSlug } from './sessions.mjs';

/** The refresh now for the checkout `args.cwd`. `answer(run, command, args, cwd)` is the queue's way to run a command
 * and read it (`{ ok, out }`); `versionOf(sha)` the version main's package.json names at `sha`; `pnpmBinDir` the
 * upgrade's reading of pnpm's global bin folder (bin/update.mjs), handed in since a module here imports no command. */
export async function refreshNowRun(args, { run = spawnSync, env, stdout, stderr, answer, versionOf, pnpmBinDir, refreshCopy: refresh = refreshCopy, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
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
  return refreshNow({
    main, copySha: binDir ? namedSha(binDir) : null, look, refresh,
    versionOf, home, cwd: args.cwd, env, sleep, stdout, stderr, unanswered: (sha) => unansweredApply({ home, cwd: args.cwd, run, sha }),
  });
}

/** A session id as claude writes one, which names a transcript file and nothing else. */
const SESSION_ID = /^[0-9A-Za-z][0-9A-Za-z-]*$/;

/** Whether the session `agent` of a `claude agents` listing only waits (`onlyWaits`, ./merge-queue-waits.mjs), read from
 * its transcript under `claudeHome`: `projects/<slug of its folder>/<session id>.jsonl`, else the file of that id in any
 * project's folder, `claudeHome` being Claude Code's of `env` by default. A session whose transcript cannot be found or
 * read is at work: `false`. */
export function agentOnlyWaits(agent, { env = process.env, claudeHome = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const id = agent?.sessionId;
  if (typeof id !== 'string' || !SESSION_ID.test(id)) return false;
  const projects = path.join(claudeHome, 'projects');
  const candidates = typeof agent.cwd === 'string' ? [path.join(projects, projectSlug(agent.cwd), `${id}.jsonl`)] : [];
  try {
    for (const name of fs.readdirSync(projects)) candidates.push(path.join(projects, name, `${id}.jsonl`));
  } catch {
    // No projects folder: only the first place is tried.
  }
  for (const file of candidates) {
    let text;
    try {
      text = readFile(file);
    } catch {
      continue;
    }
    return onlyWaits(text);
  }
  return false;
}
