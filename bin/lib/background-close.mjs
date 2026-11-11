// Closing the background sessions that finished (odd/tasks/sessions-close-themselves.md). `js-harness sessions stop`
// was the only thing that removed one, nothing ran it, and it refuses while the session's worktree holds files, so on
// 2026-11-10 the Claude app listed dozens of sessions whose work had landed days before. Here is the one act the land,
// `sessions stop --finished` and the listings share: a session that said `closed` (`finishedOf`) and has no job at
// work loses its worktree to `git worktree remove`, never forced and only by the rule a land holds its own removals to
// (`worktreeKept`), and then its jobs to `undoSession`. The order is the guard: claude rm deleted the files of a
// worktree while it said it had refused (2026-11-04), so claude rm runs for no session until its worktree is gone or
// holds nothing; only claude stop runs before, which ends the job's process and deletes nothing. What cannot go that
// way stays, named with why and with the command that settles it.

import { LOCK_WAIT_MS, atWork, exists, finishedOf, readRecord, saidBy, sleepSync, undoSession, within, worktreeHolding, worktreeOf } from './background.mjs';
import { readNotices } from './channel.mjs';
import { defaultBranchOf } from './default-branch.mjs';
import { projectSlug } from './sessions.mjs';
import { HOST_FILES, boundedGit, linkedWorktrees, sameFolder, worktreeKept } from './worktrees.mjs';

/** The command that closes the session `entry` by hand once what its worktree holds was looked at. */
const byHand = (entry) => `once nothing there is needed, js-harness sessions stop ${entry.id} --remove-worktree removes it with its worktree`;

/** The command that tries the close again, for a session kept by something that passes. */
const AGAIN = 'js-harness sessions stop --finished tries again';

/** The worktree of the finished session `entry` as git lists it, `{ tree }`, when nothing in it would be lost
 * (`worktreeKept`, claude's own files left out); otherwise why it stays, `{ why, settle }`. It changes nothing. */
function removable(entry, worktree, { root, cwd, base, baseName, listed, gitIn, now }) {
  if (listed === null) return { why: 'git could not list the worktrees, so its worktree was not looked at', settle: AGAIN };
  if (within(cwd, worktree)) return { why: `this command runs from its worktree ${worktree}`, settle: 'run it from the main checkout' };
  const tree = listed.linked.find((item) => item.path && sameFolder(item.path, worktree));
  if (tree === undefined) return { why: `git lists no worktree at ${worktree}, which holds files`, settle: byHand(entry) };
  const kept = worktreeKept(tree, { cwd: root, base, baseName, gitIn, now, hostFiles: HOST_FILES });
  return kept === null ? { tree } : { why: `its worktree ${worktree} stays: ${kept}`, settle: byHand(entry) };
}

/** Ends the processes of the jobs of `chain` that claude lists, with `claude stop`, which keeps the conversation and
 * deletes nothing, and waits up to `LOCK_WAIT_MS` for each to end: a finished session idles in its worktree, and
 * Windows deletes no folder a process stands in, so a removal begun under one would stop halfway. `null` once none
 * runs, or why one still does. */
function endJobs(chain, agents, { claude, now, alive, pause }) {
  for (const agent of agents.filter((item) => chain.some((job) => item.id === job.id))) {
    const stop = claude(['stop', agent.id]);
    if ((stop.error || stop.status !== 0) && !/no job matching/i.test(saidBy(stop))) return `claude stop ${agent.id}: ${saidBy(stop)}`;
    if (!Number.isInteger(agent.pid)) continue;
    const from = now();
    let running;
    while ((running = alive(agent.pid)) && now() - from < LOCK_WAIT_MS) pause(500);
    if (running) return `the process of ${agent.id}, pid ${agent.pid}, still ran ${Math.round((now() - from) / 1000)} s after claude stop`;
  }
  return null;
}

/** What `closeFinished` did, in lines: each session closed, each kept with why and, under it, what settles it. */
export function closedLines({ closed, kept }) {
  const name = (entry) => `${entry.id} · ${entry.title}`;
  return [
    ...closed.map(({ entry, worktree, jobs }) => `closed ${name(entry)}: ${worktree === null ? '' : `git removed its worktree ${worktree}, which held nothing to lose, and `}claude removed its ${jobs === 1 ? 'job' : `${jobs} jobs`}; its transcript stays`),
    ...kept.flatMap(({ entry, why, settle }) => [`kept ${name(entry)}: ${why}`, ...(settle === null ? [] : [`  ${settle}`])]),
  ];
}

/** Closes every finished session of the project at `root` (`finishedOf` over the record under `home` and the channel's
 * `notices`) that can go with nothing lost: `{ closed, kept }`. A closed one is `{ entry, worktree, jobs }`, the
 * worktree git removed (or `null`) and how many jobs went. A kept one is `{ entry, why, settle }`, `settle` the command
 * that closes it by hand or `null` where there is none to run. `agents` is claude's listing (`listAgents`), `base` the
 * commit a worktree's head must be in and `baseName` its name in words, `cwd` where the command runs, `gitIn(dir,
 * ...args)` answers `{ ok, out, err }`, `claude` runs the Claude CLI (`claudeRunner`). */
export function closeFinished({ home, root, cwd = root, base, baseName = base, notices, agents, gitIn, claude, now = Date.now, alive = exists, pause = sleepSync }) {
  const finished = finishedOf(readRecord(home), notices, root);
  const closed = [];
  const kept = [];
  let listed;
  for (const { entry, chain } of finished) {
    const live = agents.find((agent) => atWork(agent) && chain.some((job) => agent.id === job.id || (typeof job.sessionId === 'string' && agent.sessionId === job.sessionId)));
    if (live !== undefined) {
      kept.push({ entry, why: `it is ${live.status ?? live.state}: a session at work is not closed`, settle: null });
      continue;
    }
    const worktree = worktreeOf(entry);
    let removed = null;
    // The guard `sessions stop` holds: only a worktree that holds something is git's to remove first.
    if (worktree !== null && worktreeHolding(entry) !== null) {
      if (listed === undefined) listed = linkedWorktrees(root, gitIn);
      const found = removable(entry, worktree, { root, cwd, base, baseName, listed, gitIn, now });
      if (found.tree === undefined) {
        kept.push({ entry, ...found });
        continue;
      }
      const runs = endJobs(chain, agents, { claude, now, alive, pause });
      if (runs !== null) {
        kept.push({ entry, why: `its worktree ${worktree} stays: ${runs}`, settle: AGAIN });
        continue;
      }
      const gone = gitIn(root, 'worktree', 'remove', found.tree.path);
      if (!gone.ok || worktreeHolding(entry) !== null) {
        const said = gone.ok ? 'git removed it and its folder still holds files' : `git worktree remove refused: ${gone.err.split('\n')[0] || 'git gave no reason'}`;
        kept.push({ entry, why: `its worktree ${worktree} stays: ${said}`, settle: byHand(entry) });
        continue;
      }
      removed = worktree;
    }
    const done = undoSession(entry, { home, run: claude, now, alive, pause });
    if (done.outcome === 'kept') {
      kept.push({ entry, why: `${removed === null ? '' : `its worktree ${removed} was removed, and `}${done.why}`, settle: `js-harness sessions stop ${entry.id}` });
      continue;
    }
    closed.push({ entry, worktree: removed, jobs: chain.length });
  }
  return { closed, kept };
}

/** `closeFinished` for the project at `root`, with what it needs read here: the channel's record under `home`, claude's
 * listing (`list()`, which throws when it cannot be read) and, unless `base` is given, the default branch as origin
 * holds it in this clone, with no fetch. `{ closed, kept }`, or `{ unavailable }`, why nothing was looked at: a record
 * or a listing that cannot be read closes nothing, since "could not look" is never "none at work". With no finished
 * session it asks claude and git nothing. `run(command, args, options)` runs a command as `spawnSync` does. */
export function closeFinishedIn({ home, root, cwd = root, base = null, baseName = base, run, claude, list, now = Date.now }) {
  const record = readNotices(home, projectSlug(root));
  if (record.unavailable !== undefined) return { unavailable: `the channel's record ${record.path} could not be read (${record.unavailable})` };
  const background = readRecord(home);
  if (background.unavailable !== undefined) return { unavailable: `the record of background sessions could not be read (${background.unavailable})` };
  if (finishedOf(background, record.notices, root).length === 0) return { closed: [], kept: [] };
  let agents;
  try {
    agents = list();
  } catch (err) {
    return { unavailable: `whether a session is at work cannot be told (${err.message})` };
  }
  const gitIn = boundedGit(run);
  let [commit, name] = [base, baseName];
  if (commit === null) {
    const named = defaultBranchOf((command, args) => {
      const result = run(command, args, { cwd: root, encoding: 'utf8', windowsHide: true });
      return { ok: !result?.error && result?.status === 0, out: String(result?.stdout ?? '') };
    });
    if (!named.name) return { unavailable: named.why };
    name = `origin/${named.name}`;
    commit = gitIn(root, 'rev-parse', '--verify', '--quiet', name).out.trim();
    if (!commit) return { unavailable: `git could not read ${name}` };
  }
  return closeFinished({ home, root, cwd, base: commit, baseName: name, notices: record.notices, agents, gitIn, claude, now });
}
