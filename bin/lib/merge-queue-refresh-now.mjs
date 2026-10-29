// `merge-queue --refresh-copy` run alone (S4, S5 of odd/tasks/lead-manual-steps.md): `refreshNow`
// (./merge-queue-refresh.mjs) with this machine's effects. Moved out of bin/merge-queue.mjs, which holds the land and
// stays under its line ceiling. Main is origin's default branch once fetched in the checkout; the copy is the one
// pnpm's shim names; its processes are read from one process table and one listing of command lines (Windows); a wait
// is stopped by pid and creation time; its session is read from the project's transcripts and told by a note in the
// channel. No land record is written. Zero dependencies.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendNotice, newNotice } from './channel.mjs';
import { defaultBranchOf } from './default-branch.mjs';
import { harnessHome } from './home.mjs';
import { refreshNow } from './merge-queue-refresh.mjs';
import { readCopy } from './merge-queue-waits.mjs';
import { listCommandLines } from './process-list.mjs';
import { killProcesses, takeSnapshot } from './process-tree.mjs';
import { namedSha, refreshCopy } from './refresh-copy.mjs';
import { mainCheckout, projectDirsOf, projectSlug } from './sessions.mjs';
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
  const tell = (number, text) => {
    const slug = projectSlug(mainCheckout(utf8, args.cwd));
    appendNotice(home, slug, newNotice({ at: new Date(now()).toISOString(), from, to: String(number), kind: 'note', text }));
  };
  // The project's sessions open now, with their background waits not ended, as wake reads them after a boot.
  const sessions = () => {
    const claudeHome = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const transcripts = [];
    for (const dir of projectDirsOf(utf8, mainCheckout(utf8, args.cwd), claudeHome)) {
      let names = [];
      try {
        names = fs.readdirSync(dir).filter((name) => name.endsWith('.jsonl'));
      } catch {
        continue;
      }
      for (const name of names) {
        const file = path.join(dir, name);
        try {
          if (fs.statSync(file).mtimeMs >= now() - WAKE_WINDOW_MS) transcripts.push({ id: name.slice(0, -'.jsonl'.length), text: fs.readFileSync(file, 'utf8') });
        } catch {
          // A transcript removed while this reads holds no wait to tell.
        }
      }
    }
    return wakePlan({ bootAt: new Date(now()).toISOString(), transcripts });
  };
  return refreshNow({
    main, copySha: binDir ? namedSha(binDir) : null, look, stop: (targets) => killProcesses(targets, { spawnSync: run }), sessions, refresh,
    versionOf, tell, home, cwd: args.cwd, env, sleep, stdout, stderr,
  });
}
