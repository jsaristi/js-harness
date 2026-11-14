// Closing the background sessions that finished (odd/tasks/sessions-close-themselves.md). `js-harness sessions stop`
// was the only thing that removed one, nothing ran it, and it refuses while the session's worktree holds files, so on
// 2026-11-10 the Claude app listed dozens of sessions whose work had landed days before. Here is the one act the land,
// `sessions stop --finished` and the listings share: a session that said `closed` (`finishedOf`) and has no job at
// work loses its worktree to `git worktree remove`, never forced and only by the rule a land holds its own removals to
// (`worktreeKept`), and then its jobs to `undoSession`. The order is the guard: claude rm deleted the files of a
// worktree while it said it had refused (2026-11-04), so claude rm runs for no session until its worktree is gone or
// holds nothing; only claude stop runs before, which ends the job's process and deletes nothing. claude locks the
// worktree of every job it runs there, a finished one that idles included, so the lock of the session's own job does
// not keep it, and one left for a process that has ended is released; any other lock does. claude rm takes a job with
// the scratch folder claude keeps for it, which the host gives as temporary. What cannot go that way stays, named with
// why and with the command that settles it.

import fs from 'node:fs';
import path from 'node:path';
import { CLOSE_FINISHED, LOCK_WAIT_MS, atWork, exists, finishedHere, finishedOf, readRecord, recordFileOf, saidBy, sleepSync, undoSession, within, workingIn, worktreeHolding, worktreeOf } from './background.mjs';
import { readNotices } from './channel.mjs';
import { defaultBranchOf } from './default-branch.mjs';
import { projectSlug } from './sessions.mjs';
import { HOST_FILES, boundedGit, linkedWorktrees, sameFolder, worktreeKept } from './worktrees.mjs';

/** The command that closes the session `entry` by hand once what its worktree holds was looked at. */
const byHand = (entry) => `once nothing there is needed, js-harness sessions stop ${entry.id} --remove-worktree removes it with its worktree`;

/** The command that tries the close again, for a session kept by something that passes. */
const AGAIN = `${CLOSE_FINISHED} tries again`;

/** The pid in the lock claude puts on the worktree `tree` while a job of its runs there, `claude session <folder's name>
 * (pid N)`, or `null` for a worktree that is not locked or that anything else locked. All 8 locked worktrees of
 * 2026-11-11 read so, two of them under sessions that had said `closed` and idled (L15): a rule that keeps every locked
 * worktree closes no session until the machine restarts. */
function claudeLockPid(tree) {
  const said = /^claude session (.+) \(pid (\d+)\)$/.exec(tree.lockReason ?? '');
  return said !== null && tree.path && said[1] === path.basename(tree.path) ? Number(said[2]) : null;
}

/** The worktree of the finished session `entry` as git lists it, `{ tree }`, when nothing in it would be lost
 * (`worktreeKept`, claude's own files left out); otherwise why it stays, `{ why, settle }`: the close tried again for
 * what time or an unlock settles, the command by hand for what holds files. `ownLock(tree)` says which lock does not
 * keep it. It changes nothing. */
function removable(entry, worktree, { root, cwd, base, baseName, listed, gitIn, now, ownLock }) {
  if (listed === null) return { why: 'git could not list the worktrees, so its worktree was not looked at', settle: AGAIN };
  if (within(cwd, worktree)) return { why: `this command runs from its worktree ${worktree}`, settle: 'run it from the main checkout' };
  const tree = listed.linked.find((item) => item.path && sameFolder(item.path, worktree));
  if (tree === undefined) return { why: `git lists no worktree at ${worktree}, which holds files`, settle: byHand(entry) };
  const kept = worktreeKept(tree, { cwd: root, base, baseName, gitIn, now, hostFiles: HOST_FILES, ownLock });
  return kept === null ? { tree } : { why: `its worktree ${worktree} stays: ${kept}`, settle: /^(it is locked|its index changed)/.test(kept) ? AGAIN : byHand(entry) };
}

/** The jobs of `chain` as claude lists them in `agents`: by id, and by session too, as `workingIn` looks, since a job
 * claude lists under another id stands in the same folder. */
const listedOf = (chain, agents) => agents.filter((item) => typeof item.id === 'string' && chain.some((job) => item.id === job.id || (typeof job.sessionId === 'string' && item.sessionId === job.sessionId)));

/** The folder a job of `chain` was started in or is listed in that is not the main checkout `root` and holds something
 * besides `.git`, or `null`. The record names no worktree for such a session, so the guard of `sessions stop`
 * (`worktreeHolding`) looks at nothing, while its job stands in a folder that may be a worktree, another session's
 * included: on 2026-11-11 JH 155 stood that way in a folder of 19 entries. A folder that cannot be read counts as
 * holding files. */
function standsIn(chain, agents, root) {
  const folders = [...chain.flatMap((job) => [job.cwd, job.worktreePath]), ...listedOf(chain, agents).map((item) => item.cwd)];
  return folders.find((folder) => {
    if (typeof folder !== 'string' || folder === '' || sameFolder(folder, root)) return false;
    try {
      return fs.readdirSync(folder).some((name) => name !== '.git');
    } catch (err) {
      return err.code !== 'ENOENT';
    }
  }) ?? null;
}

/** Ends the processes of the jobs of `chain` that claude lists, with `claude stop`, which keeps the conversation and
 * deletes nothing, and waits up to `LOCK_WAIT_MS` for each to end: a finished session idles in its worktree, and
 * Windows deletes no folder a process stands in, so a removal begun under one would stop halfway. `null` once none
 * runs, or why one still does. */
function endJobs(chain, agents, { claude, now, alive, pause }) {
  for (const agent of listedOf(chain, agents)) {
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
    ...closed.map(({ entry, worktree, jobs }) => `closed ${name(entry)}: ${worktree === null ? '' : `git removed its worktree ${worktree}, which held nothing to lose, and `}claude removed its ${jobs === 1 ? 'job, with the scratch folder claude keeps for it' : `${jobs} jobs, with the scratch folder claude keeps for each`}; its transcript stays`),
    ...kept.flatMap(({ entry, why, settle, stopped }) => [
      `kept ${name(entry)}: ${why}`,
      ...(stopped ? [`  claude stop was sent to its job before that, which deletes nothing; js-harness sessions start --resume ${entry.id} resumes it`] : []),
      ...(settle === null ? [] : [`  ${settle}`]),
    ]),
  ];
}

/** How long the one git call that deletes may take, `git worktree remove`: not the 20 s of a question (`boundedGit`),
 * since a removal killed part-way leaves a worktree half deleted and still registered (a lens, 2026-11-11). */
export const REMOVAL_WAIT_MS = 5 * 60_000;

/** Closes every finished session of the project at `root` (`finishedOf` over the record under `home` and the channel's
 * `notices`) that can go with nothing lost: `{ closed, kept }`. A closed one is `{ entry, worktree, jobs }`, the
 * worktree git removed (or `null`) and how many jobs went. A kept one is `{ entry, why, settle }`, `settle` the command
 * that closes it by hand or `null` where there is none to run. `agents` is claude's listing (`listAgents`), `base` the
 * commit a worktree's head must be in and `baseName` its name in words, `cwd` where the command runs, `gitIn(dir,
 * ...args)` answers `{ ok, out, err }`, `claude` runs the Claude CLI (`claudeRunner`). A close waits on processes, so
 * what was seen before it is looked at again: `list()`, when given, reads claude's listing anew after each act and
 * after the wait for a session's jobs, and a worktree is held to the rule a second time after that wait, when the only
 * lock that no longer keeps it is claude's for a process that has ended (`git worktree unlock` releases it, the lock
 * read once more right before). A worktree another recorded session has that did not say `closed` stays, and so does
 * one a job of another session stands in, at either listing. `removeIn` is the `gitIn` of the one call that deletes,
 * which wants a longer bound (`REMOVAL_WAIT_MS`). A kept one whose job got `claude stop` has `stopped`. */
export function closeFinished({ home, root, cwd = root, base, baseName = base, notices, agents, list = null, gitIn, removeIn = gitIn, claude, now = Date.now, alive = exists, pause = sleepSync }) {
  const record = readRecord(home);
  const finished = finishedOf(record, notices, root);
  const closed = [];
  const kept = [];
  let listed;
  let seen = agents;
  let acted = false;
  for (const { entry, chain } of finished) {
    if (acted && list !== null) {
      // A message may have woken a session since the listing was read: the minute an act can take is not assumed idle.
      try {
        seen = list();
        acted = false;
      } catch (err) {
        kept.push({ entry, why: `whether it is at work cannot be told (${err.message})`, settle: AGAIN });
        continue;
      }
    }
    const live = workingIn(chain, seen);
    if (live !== undefined) {
      kept.push({ entry, why: `it is ${live.status ?? live.state}: a session at work is not closed`, settle: null });
      continue;
    }
    const worktree = worktreeOf(entry);
    const place = worktree === null ? standsIn(chain, seen, root) : null;
    if (place !== null) {
      // claude rm is run over no folder nobody looked at: it deleted a worktree's files once while it said it refused.
      kept.push({ entry, why: `its job stands in ${place}, which is not the main checkout and holds files, and the record names no worktree of its own`, settle: `once nothing there is needed, js-harness sessions stop ${entry.id} removes its job and leaves that folder to you` });
      continue;
    }
    let removed = null;
    // The guard `sessions stop` holds: only a worktree that holds something is git's to remove first.
    if (worktree !== null && worktreeHolding(entry) !== null) {
      // A job at rest is no guest below, so the record says whose worktree it is: one a session that did not say
      // closed also has is not removed from under it, whatever claude lists.
      const sharing = sharingSession(record, finished, chain, worktree);
      if (sharing !== undefined) {
        kept.push({ entry, why: `the session ${sharing.id}${sharing.title ? ` · ${sharing.title}` : ''}, which did not say closed, has the same worktree ${worktree}`, settle: `once that session says closed, ${CLOSE_FINISHED} closes both` });
        continue;
      }
      if (listed === undefined) listed = linkedWorktrees(root, gitIn);
      const mine = listedOf(chain, seen);
      // claude's lock for a job of this session, which claude stop ends next, or for a process that no longer runs.
      const ended = (tree) => {
        const pid = claudeLockPid(tree);
        return pid !== null && !alive(pid);
      };
      const ownLock = (tree) => {
        const pid = claudeLockPid(tree);
        return pid !== null && (!alive(pid) || mine.some((agent) => agent.pid === pid));
      };
      const found = removable(entry, worktree, { root, cwd, base, baseName, listed, gitIn, now, ownLock });
      if (found.tree === undefined) {
        kept.push({ entry, ...found });
        continue;
      }
      // A job that is not this session's is not stopped here, and no folder is removed from under one.
      const guestIn = (agents) => {
        const own = listedOf(chain, agents);
        return agents.find((agent) => !own.includes(agent) && typeof agent.cwd === 'string' && within(agent.cwd, worktree) && (atWork(agent) || (Number.isInteger(agent.pid) && alive(agent.pid))));
      };
      const guestWhy = (guest) => `another job, ${guest.id}${guest.name ? ` · ${guest.name}` : ''}, stands in its worktree ${worktree}`;
      const guest = guestIn(seen);
      if (guest !== undefined) {
        kept.push({ entry, why: guestWhy(guest), settle: AGAIN });
        continue;
      }
      acted = true;
      const runs = endJobs(chain, seen, { claude, now, alive, pause });
      if (runs !== null) {
        kept.push({ entry, why: `its worktree ${worktree} stays: ${runs}`, settle: AGAIN, stopped: true });
        continue;
      }
      if (list !== null) {
        // The wait is up to a minute a job: a message may have woken the session in it.
        let woken;
        try {
          seen = list();
          woken = workingIn(chain, seen);
        } catch (err) {
          kept.push({ entry, why: `its worktree ${worktree} stays: whether it went back to work cannot be told (${err.message})`, settle: AGAIN, stopped: true });
          continue;
        }
        if (woken !== undefined) {
          kept.push({ entry, why: `its worktree ${worktree} stays: it is ${woken.status ?? woken.state} again, after claude stop was sent to its job`, settle: null, stopped: true });
          continue;
        }
        // Nor is the first listing's word taken for who else stands there: a job may have entered in that minute.
        const late = guestIn(seen);
        if (late !== undefined) {
          kept.push({ entry, why: guestWhy(late), settle: AGAIN, stopped: true });
          continue;
        }
      }
      // The second look: what the wait above let into the worktree is not deleted on the word of the first, and the
      // only lock that no longer keeps it is claude's for a process that has ended.
      const still = removable(entry, worktree, { root, cwd, base, baseName, listed: linkedWorktrees(root, gitIn), gitIn, now, ownLock: ended });
      if (still.tree === undefined) {
        kept.push({ entry, ...still, stopped: true });
        continue;
      }
      if (still.tree.locked) {
        // git has no compare-and-unlock, and the second look ran git for seconds after it listed this lock: it is read
        // once more right before it is released, so one claude took anew for a session a message woke is not, and one
        // claude released by itself needs no unlock.
        const last = linkedWorktrees(root, gitIn)?.linked.find((item) => item.path && sameFolder(item.path, worktree));
        if (last === undefined || (last.locked && (last.lockReason !== still.tree.lockReason || !ended(last)))) {
          const said = last === undefined ? 'git could not list it again before its lock was released' : `it was locked anew while it was looked at${last.lockReason ? `: ${last.lockReason}` : ''}`;
          kept.push({ entry, why: `its worktree ${worktree} stays: ${said}`, settle: AGAIN, stopped: true });
          continue;
        }
        // Not a forced removal: the lock of a process that is gone is released, and git still refuses what holds files.
        const unlocked = last.locked ? gitIn(root, 'worktree', 'unlock', still.tree.path) : { ok: true };
        if (!unlocked.ok) {
          kept.push({ entry, why: `its worktree ${worktree} stays: git worktree unlock refused: ${unlocked.err.split('\n')[0] || 'git gave no reason'}`, settle: AGAIN, stopped: true });
          continue;
        }
      }
      const gone = removeIn(root, 'worktree', 'remove', still.tree.path);
      if (!gone.ok || worktreeHolding(entry) !== null) {
        const said = gone.ok ? 'git removed it and its folder still holds files' : `git worktree remove refused: ${gone.err.split('\n')[0] || 'git gave no reason'}`;
        kept.push({ entry, why: `its worktree ${worktree} stays: ${said}`, settle: byHand(entry), stopped: true });
        continue;
      }
      removed = worktree;
      listed = undefined;
    }
    acted = true;
    const done = undoSession(entry, { home, run: claude, now, alive, pause });
    if (done.outcome === 'kept') {
      // A folder an earlier claude rm emptied down to its .git: claude refuses the job while it is there (L5).
      const leftover = removed === null && worktree !== null && fs.existsSync(worktree);
      const settle = leftover
        ? `claude keeps the job while its folder ${worktree} is there, and it holds nothing but a leftover .git: once that folder is deleted by hand, js-harness sessions stop ${entry.id} tries the job again`
        : `js-harness sessions stop ${entry.id}`;
      kept.push({ entry, why: `${removed === null ? '' : `its worktree ${removed} was removed, and `}${done.why}`, settle });
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
 * session it asks claude and git nothing, so a `claude` that is `null` (not on PATH) is unavailable only when one is.
 * `standing` marks a refusal a second try does not settle, a record with a damaged line, whose words say what does.
 * `run(command, args, options)` runs a command as `spawnSync` does. */
export function closeFinishedIn({ home, root, cwd = root, base = null, baseName = base, run, claude, list, now = Date.now }) {
  const record = readNotices(home, projectSlug(root));
  if (record.unavailable !== undefined) return { unavailable: `the channel's record ${record.path} could not be read (${record.unavailable})` };
  const background = readRecord(home);
  if (background.unavailable !== undefined) return { unavailable: `the record of background sessions could not be read (${background.unavailable})` };
  if (finishedOf(background, record.notices, root).length === 0) return { closed: [], kept: [] };
  if (claude === null) return { unavailable: 'claude is not on PATH' };
  // A line that cannot be read may be a newer word than `closed`, or the start of a resume: "could not read" is not
  // "none". A second try reads the same line, so this refusal stands (`standing`) and says what settles it (two lenses).
  // Each thing is named where it is: a stranded start is a file of its own, not a line of the record (Codex P2).
  const damaged = (what, may) => ({ unavailable: `${what.join(' and ')} could not be read, and one may be ${may}; the close stays off until what could not be read is repaired or taken out by hand`, standing: true });
  const linesOf = (count, file) => (count > 0 ? [`${count} line${count === 1 ? '' : 's'} of ${file}`] : []);
  if (background.skipped > 0) {
    const files = background.strandedUnread ?? [];
    return damaged([...linesOf(background.skipped - files.length, `the record of background sessions ${recordFileOf(home)}`), ...(files.length > 0 ? [`the stranded start${files.length === 1 ? '' : 's'} ${files.join(', ')}`] : [])], 'a resume');
  }
  if (record.skipped > 0) return damaged(linesOf(record.skipped, `the channel's record ${record.path}`), 'a newer notice than closed');
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
  return closeFinished({ home, root, cwd, base: commit, baseName: name, notices: record.notices, agents, list, gitIn, removeIn: boundedGit(run, REMOVAL_WAIT_MS), claude, now });
}

/** The debt doctor lists: the finished sessions of the project at `root` with no job at work (`finishedHere`), from the
 * records under `home`; claude's listing (`list()`) is asked only when one finished. It throws when a record or the
 * listing cannot be read, since "could not look" is never "none". */
export function finishedIn({ home, root, list }) {
  const record = readNotices(home, projectSlug(root));
  if (record.unavailable !== undefined) throw new Error(`the channel's record ${record.path} could not be read (${record.unavailable})`);
  const background = readRecord(home);
  if (background.unavailable !== undefined) throw new Error(`the record of background sessions could not be read (${background.unavailable})`);
  if (finishedOf(background, record.notices, root).length === 0) return [];
  return finishedHere(background, record.notices, root, list());
}

/** The land's part, once it has landed: the finished sessions of the project are closed against `base`, the main it
 * pushed, those of the pull requests it landed and any an earlier land left (one that came inside the ten minutes an
 * index must stand still). Each is said in a line through `say`, and those closed are returned for the land's record,
 * `[{ id, title, worktree }]`. Whatever keeps it from looking is one line and an empty list: the landing it follows
 * already stands, so this changes no exit. `claude` is `null` when the Claude CLI is not on PATH. */
export function closeAfterLand({ home, root, cwd = root, base, run, claude, list, now = Date.now, say }) {
  const done = closeFinishedIn({ home, root, cwd, base, baseName: 'main', run, claude, list, now });
  if (done.unavailable !== undefined) {
    say(`No finished background session was closed: ${done.unavailable}.${done.standing ? '' : ` ${AGAIN}.`}`);
    return [];
  }
  if (done.closed.length + done.kept.length === 0) return [];
  say(`Finished background sessions: ${done.closed.length} closed, ${done.kept.length} kept.`);
  for (const line of closedLines(done)) say(line);
  return done.closed.map(({ entry, worktree }) => ({ id: entry.id, title: entry.title ?? null, worktree }));
}

/** The recorded session other than the jobs of `chain` that works in the worktree `worktree` and did not say closed, or
 * `undefined`: one `finished` (`finishedOf`) does not name, not resumed by a later job, whose own worktree is that one or
 * which was started or listed in it with no worktree of its own. Its worktree is not removed from under it, by the close or
 * by `sessions stop --remove-worktree` (A5 of the directives audit; Codex P1 on f71380ea, the folder without a name). */
export function sharingSession(record, finished, chain, worktree) {
  const usesIt = (other) => (worktreeOf(other) !== null ? sameFolder(worktreeOf(other), worktree)
    : [other.cwd, other.worktreePath].some((folder) => typeof folder === 'string' && folder !== '' && within(folder, worktree)));
  return (record.sessions ?? []).find((other) => !chain.some((job) => job.id === other.id) && !record.resumedAs?.has(other.id)
    && !finished.some((item) => item.entry.id === other.id) && usesIt(other));
}

/** Folders no copy takes, by name at any depth, each with why: an install or an index rebuilds them, and one of them
 * can hold more files than the copy is worth. Only an untracked or ignored folder is left out: a tracked change in one
 * is copied. A copy names what it left out. */
export const KEEP_LEFT_OUT = new Map([
  ['node_modules', 'an install rebuilds it'],
  ['.codegraph', 'codegraph rebuilds its index'],
]);

/** The folder a copy of what the worktree of the recorded job `id` held goes into, under the harness home `home`:
 * beside the record's folder, not in it, since the uninstall deletes that one once no session is left. */
export const keptDirOf = (home, id, at) => path.join(home, '.js-harness', 'kept', `${id}-${new Date(at).toISOString().replace(/[:.]/g, '-')}`);

/** The refs a worktree keeps in its own git folder, which go with it. */
const OWN_REFS = /^refs\/(worktree|bisect|rewritten)\//;

const listOf = (out) => out.split('\0').filter((item) => item !== '');

/** What no branch keeps of the worktree `worktree`, as paths relative to it with `/`: `changed`, tracked files changed
 * since HEAD (staged or not) and those git is told not to look at (skip-worktree, assume-unchanged), which no status
 * shows; `others`, untracked and ignored ones, a folder git reports whole ending in `/`; `staged`, the index against HEAD
 * as a binary patch, since a file staged and then changed again holds in the index what its copy lacks; `branch` and
 * `head`. `{ why: null }` for a folder git does not read as a worktree; `{ why }` when git cannot answer, when HEAD is
 * detached on commits no branch, tag or remote holds, or when it has submodules, whose own files and commits live in the
 * worktree's git folder that the removal deletes. */
function unkeptPaths(worktree, gitIn) {
  const head = gitIn(worktree, 'rev-parse', '--verify', '--quiet', 'HEAD');
  const top = gitIn(worktree, 'rev-parse', '--show-toplevel');
  if (!head.ok || !top.ok || !sameFolder(top.out.trim(), worktree)) return { why: null };
  // A ref of the worktree's own (refs/worktree, refs/bisect, refs/rewritten) lives in its git folder, which the removal
  // deletes: only a shared ref holds a commit (the verifier on 1d982b38).
  const sharedHolds = (commit) => {
    const held = gitIn(worktree, 'for-each-ref', '--contains', commit, '--format=%(refname)');
    return held.ok ? held.out.split(/\r?\n/).some((ref) => ref !== '' && !OWN_REFS.test(ref)) : null;
  };
  const branch = gitIn(worktree, 'symbolic-ref', '--quiet', '--short', 'HEAD');
  const tips = [...(branch.ok ? [] : ['HEAD'])];
  const own = gitIn(worktree, 'for-each-ref', '--format=%(objectname) %(refname)', 'refs/worktree', 'refs/bisect', 'refs/rewritten');
  if (!own.ok) return { why: `git could not list the refs of its own (${own.err})` };
  tips.push(...own.out.split(/\r?\n/).filter((line) => line !== '').map((line) => line.split(' ')[0]));
  for (const tip of tips) {
    const shared = sharedHolds(tip);
    if (shared === null) return { why: `git could not say whether a branch holds ${tip}` };
    if (!shared) return { why: `${tip === 'HEAD' ? `its head ${head.out.trim().slice(0, 12)} is detached` : `a ref of its own points at ${tip.slice(0, 12)}`}, on commits no branch holds: git -C ${worktree} branch <name> ${tip === 'HEAD' ? '' : `${tip.slice(0, 12)} `}keeps them, then run this again` };
  }
  // A submodule's repository lives in the worktree's git folder even once the index no longer names it.
  const gitDir = gitIn(worktree, 'rev-parse', '--absolute-git-dir');
  if (!gitDir.ok) return { why: `git could not name its git folder (${gitDir.err})` };
  if (fs.existsSync(path.join(gitDir.out.trim(), 'modules'))) return { why: `its git folder holds submodules (${path.join(gitDir.out.trim(), 'modules')}), whose commits no copy here takes: keep them by hand, then run this again` };
  const asked = {
    diff: gitIn(worktree, 'diff', '--name-only', '-z', '--no-renames', 'HEAD'),
    flagged: gitIn(worktree, 'ls-files', '-z', '-v'),
    untracked: gitIn(worktree, 'ls-files', '-z', '--others', '--exclude-standard'),
    ignored: gitIn(worktree, 'ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory'),
    stage: gitIn(worktree, 'ls-files', '-z', '--stage'),
    // A backup is git's own patch: no external diff, text conversion or color the user's config asks for.
    staged: gitIn(worktree, 'diff', '--cached', '--binary', '--no-renames', '--no-ext-diff', '--no-textconv', '--no-color', 'HEAD'),
  };
  const failed = Object.values(asked).find((answer) => !answer.ok);
  if (failed !== undefined) return { why: `git could not list what it holds (${failed.err})` };
  const modules = listOf(asked.stage.out).filter((line) => line.startsWith('160000 ')).map((line) => line.split('\t')[1]);
  if (modules.length > 0) return { why: `it has submodules (${modules.slice(0, 3).join(', ')}), whose files and commits no copy here takes: keep what they hold by hand, then run this again` };
  // `ls-files -v` tags a skip-worktree file S and an assume-unchanged one in lower case.
  const flagged = listOf(asked.flagged.out).filter((line) => line[0] === 'S' || /^[a-z]/.test(line)).map((line) => line.slice(2));
  const changed = [...new Set([...listOf(asked.diff.out), ...flagged])].sort();
  const others = [...new Set([...listOf(asked.untracked.out), ...listOf(asked.ignored.out)])].sort();
  return { changed, others, staged: asked.staged.out, branch: branch.ok ? branch.out.trim() : null, head: head.out.trim() };
}

/** Whether `item` of the worktree `worktree` is there, a link that points nowhere included. */
const present = (worktree, item, io) => {
  try {
    io.lstatSync(path.join(worktree, item));
    return true;
  } catch {
    return false;
  }
};

/** Copies what no branch keeps of the worktree `worktree` of the recorded job `entry` (`unkeptPaths`) into
 * `keptDirOf(home, ...)`: the paths under `files/`, the index as `staged.patch`, and `kept.json`, what the copy is of. A
 * folder git does not read as a worktree is copied whole but its `.git`. It first waits for the process claude's lock on
 * the worktree names, as claude rm does, since claude stop returns while it still ends. `{ dir, count, leftOut }` once it
 * is copied, `dir` null when there was nothing to copy; `{ why }` when something cannot be copied or told, and then the
 * worktree is not to be removed (odd/tasks/audit-cement.md, spec 5). Not seen: a change a clean filter hides from git. */
export function keepUnkept(entry, worktree, { home, gitIn, now = Date.now, alive = exists, pause = sleepSync, fileSystem: io = fs }) {
  if (!io.existsSync(worktree)) return { dir: null, count: 0, leftOut: [] };
  const tree = linkedWorktrees(worktree, gitIn)?.linked.find((item) => item.path && sameFolder(item.path, worktree));
  const pid = tree === undefined ? null : claudeLockPid(tree);
  if (pid !== null) {
    const from = now();
    let running;
    while ((running = alive(pid)) && now() - from < LOCK_WAIT_MS) pause(500);
    if (running) return { why: `the process claude's lock on its worktree names, pid ${pid}, still ran ${Math.round((now() - from) / 1000)} s after claude stop` };
  }
  let found = unkeptPaths(worktree, gitIn);
  if (found.why) return { why: found.why };
  if (found.why === null) {
    try {
      found = { changed: [], others: io.readdirSync(worktree).filter((name) => name !== '.git'), staged: '', branch: null, head: null };
    } catch (err) {
      return { why: `its worktree ${worktree} could not be read (${err.code ?? err.message})` };
    }
  }
  const leftOutIn = (item) => item.replace(/\/$/, '').split('/').some((part) => KEEP_LEFT_OUT.has(part));
  const leftOut = found.others.filter(leftOutIn);
  const others = found.others.filter((item) => !leftOutIn(item));
  // git named it and it is not there: a name git's output does not spell as the file system does, which no copy finds.
  const lost = others.find((item) => !present(worktree, item, io));
  if (lost !== undefined) return { why: `git names ${JSON.stringify(lost)} in it, which cannot be found there to copy` };
  // A tracked file changed and then deleted is HEAD's, or the index's in staged.patch.
  const copied = [...found.changed.filter((item) => present(worktree, item, io)), ...others];
  if (copied.length === 0 && found.staged === '') return { dir: null, count: 0, leftOut };
  const dir = keptDirOf(home, entry.id, now());
  try {
    io.mkdirSync(dir, { recursive: true });
    for (const item of copied) {
      const source = path.join(worktree, item);
      // In a folder copied whole, a left-out folder inside it stays out; a tracked file is never left out.
      const inner = (from) => !(io.lstatSync(from).isDirectory() && KEEP_LEFT_OUT.has(path.basename(from)) && from !== source);
      io.cpSync(source, path.join(dir, 'files', item), { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true, filter: inner });
    }
    if (found.staged !== '') io.writeFileSync(path.join(dir, 'staged.patch'), found.staged);
    io.writeFileSync(path.join(dir, 'kept.json'), `${JSON.stringify({ id: entry.id, title: entry.title ?? null, worktree, branch: found.branch, head: found.head, at: new Date(now()).toISOString(), paths: copied, staged: found.staged !== '', leftOut }, null, 2)}\n`);
  } catch (err) {
    return { why: `what no branch keeps could not be copied to ${dir} (${err.code ?? err.message})` };
  }
  return { dir, count: copied.length, leftOut };
}
