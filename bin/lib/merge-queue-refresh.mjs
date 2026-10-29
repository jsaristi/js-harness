// `merge-queue --land --refresh-copy`'s refresh after the land (odd/tasks/harness-review.md, T4), held until no work
// session of the project is in the middle of a run. The refresh replaces the installed copy whose hooks every session
// runs, and one under a running session breaks its hooks (2026-10-28), so it waits as the lead waited for each session
// to say it was between runs. A session is at work as the machine uninstall reads it (`atWork`, bin/lib/background.mjs):
// busy, waiting on a prompt, or working, by `claude agents`, which lists the background and the interactive sessions of
// every folder with their state. Zero dependencies.

import path from 'node:path';
import { atWork, within } from './background.mjs';
import { GATE_NOT_RUN } from './gate-turn.mjs';
import { REFRESH_FAILED } from './refresh-copy.mjs';
import { mainCheckout, parseWorktreeList } from './sessions.mjs';

// How long the refresh waits for the sessions to be between runs, and how often it looks: a run of a work session
// lasts minutes, and the gate lock the refresh takes after it is waited for an hour.
export const QUIET_WAIT_MINUTES = 30;
const QUIET_LOOK_SECONDS = 30;

/** The sessions of `agents`, a listing of `claude agents --json --all`, at work in a folder of `roots`; the one whose
 * session id is `self` is left out, since it is the session that refreshes. */
export function atWorkIn(agents, { roots, self, platform = process.platform }) {
  return agents.filter((agent) => atWork(agent) && typeof agent.cwd === 'string' && roots.some((root) => within(agent.cwd, root, platform)) && !(self && agent.sessionId === self));
}

const named = (agent) => `${agent.name ?? agent.id ?? '(no title)'} (${agent.status ?? agent.state})`;
const unlisted = (err) => `claude agents could not say which sessions are at work (${err.message})`;

/** One look with `list` at the sessions of `roots`, the refresh's under the gate lock, which waits for none of them: a
 * session waiting for that lock is at work, and would wait for the refresh in turn. `{ quiet }`, with `why` when not. */
export function lookOnce({ list, roots, self, platform }) {
  let busy;
  try {
    busy = atWorkIn(list(), { roots, self, platform });
  } catch (err) {
    return { quiet: false, why: unlisted(err) };
  }
  return busy.length === 0 ? { quiet: true } : { quiet: false, why: `${busy.map(named).join(', ')} began a run` };
}

/** Waits until no session of `roots` is at work, looking with `list` every QUIET_LOOK_SECONDS: `{ quiet: true }`, or
 * `{ quiet: false, why }` when one still is after `waitMinutes`, or the listing failed, which cannot tell. Whom it waits
 * for is said once, and again when that changes. */
export async function waitForQuiet({ list, roots, self, now, sleep, stdout, waitMinutes = QUIET_WAIT_MINUTES, platform }) {
  const until = now() + waitMinutes * 60000;
  let said = null;
  for (;;) {
    let busy;
    try {
      busy = atWorkIn(list(), { roots, self, platform });
    } catch (err) {
      return { quiet: false, why: unlisted(err) };
    }
    if (busy.length === 0) return { quiet: true };
    const names = busy.map(named).join(', ');
    if (now() >= until) return { quiet: false, why: `after ${waitMinutes} minutes ${busy.length === 1 ? 'a session is' : `${busy.length} sessions are`} still in the middle of a run: ${names}` };
    if (names !== said) stdout(`refresh: waiting for ${names} to be between runs (up to ${waitMinutes} minutes): a refresh under a running session breaks its hooks`);
    said = names;
    await sleep(QUIET_LOOK_SECONDS * 1000);
  }
}

/** The folders a session of the project at `cwd` works in: its main checkout and every worktree git lists, or the main
 * checkout alone when git cannot list them. `run` is `spawnSync`'s shape. */
function projectRoots(run, cwd) {
  const utf8 = (command, args, options) => run(command, args, { ...options, encoding: 'utf8' });
  const root = mainCheckout(utf8, cwd);
  const listed = utf8('git', ['worktree', 'list', '--porcelain'], { cwd: root });
  if (listed.error || listed.status !== 0) return [root];
  return [root, ...parseWorktreeList(String(listed.stdout)).filter((tree) => !tree.bare).map((tree) => path.resolve(tree.path))];
}

/** The refresh after a land whose exit is `code`: when the land moved main, it waits for the project's sessions to be
 * between runs (`waitForQuiet`), then asks `refresh` (`refreshCopy`, bin/lib/refresh-copy.mjs) for main's sha, which
 * looks once more under the gate lock (`lookOnce`, Codex P2 on 79e3430..318f952). Returns the land's exit when the
 * refresh did its part, the refresh's code when it failed, and GATE_NOT_RUN when a session was still at work, which
 * refreshes nothing; the landing stands in every case. */
export async function refreshAfterLand({ code, log, refresh, versionOf, home, cwd, env, run, list, now, sleep, stdout, stderr }) {
  const landed = code === 0 && (log.landedBranches?.size ?? 0) > 0;
  const sha = landed ? log.record.candidate : null;
  const session = env.CLAUDE_CODE_SESSION_ID || null;
  let refreshed;
  try {
    const roots = landed ? projectRoots(run, cwd) : [];
    const stillQuiet = () => lookOnce({ list, roots, self: session });
    if (landed) {
      const quiet = await waitForQuiet({ list, roots, self: session, now, sleep, stdout });
      if (!quiet.quiet) {
        stderr(`refresh: ${quiet.why}: nothing was refreshed, and the installed copy still names its previous main; the next land with --refresh-copy brings it up`);
        return GATE_NOT_RUN;
      }
    }
    refreshed = await refresh({ landed, sha, version: landed ? versionOf(sha) : null, home, cwd, env, session, stillQuiet, stdout, stderr });
  } catch (err) {
    // A refresh that threw, or the folders or the wait before it, still lets the land record be written: main has
    // moved whatever the refresh did.
    stderr(`refresh failed: ${err.message}`);
    refreshed = REFRESH_FAILED;
  }
  return refreshed === 0 ? code : refreshed;
}
