// `merge-queue --land --refresh-copy`'s refresh after the land (odd/tasks/harness-review.md, T4), held until no work
// session of the project is in the middle of a run. The refresh replaces the installed copy whose hooks every session
// runs, and one under a running session breaks its hooks (2026-10-28), so it waits as the lead waited for each session
// to say it was between runs. A session is at work as the machine uninstall reads it (`atWork`, bin/lib/background.mjs):
// busy, waiting on a prompt, or working, by `claude agents`, which lists the background and the interactive sessions of
// every folder with their state. Zero dependencies.

//
// `merge-queue --refresh-copy` run alone (`refreshNow`, S4 and S5 of odd/tasks/lead-manual-steps.md) refreshes the copy
// to origin's main at once, as the lead did by hand when that wait gave up: it refuses while anything but a lone, loaded
// wait runs from the copy, or a shell runs more after its wait (merge-queue-waits.mjs), and leaves the waits running,
// since a wait outlives its folder's swap (JH 284).

import path from 'node:path';
import { atWork, within } from './background.mjs';
import { GATE_NOT_RUN } from './gate-turn.mjs';
import { REFRESH_FAILED, REFRESH_UNANSWERED } from './refresh-copy.mjs';
import { mainCheckout, parseWorktreeList } from './sessions.mjs';

// How long the refresh waits for the sessions to be between runs, and how often it looks: a run of a work session
// lasts minutes, and the gate lock the refresh takes after it is waited for an hour.
export const QUIET_WAIT_MINUTES = 30;
const QUIET_LOOK_SECONDS = 30;

/** The sessions of `agents`, a listing of `claude agents --json --all`, at work in a folder of `roots`; the one whose
 * session id is `self` is left out, since it is the session that refreshes, and so is one `onlyWaits(agent)` says only
 * waits (`agentOnlyWaits`, ./merge-queue-refresh-now.mjs), which claude calls busy while its wait runs. */
export function atWorkIn(agents, { roots, self, platform = process.platform, onlyWaits = () => false }) {
  return agents.filter((agent) => atWork(agent) && typeof agent.cwd === 'string' && roots.some((root) => within(agent.cwd, root, platform)) && !(self && agent.sessionId === self) && !onlyWaits(agent));
}

const named = (agent) => `${agent.name ?? agent.id ?? '(no title)'} (${agent.status ?? agent.state})`;
const unlisted = (err) => `claude agents could not say which sessions are at work (${err.message})`;

/** One look with `list` at the sessions of `roots`, the refresh's under the gate lock, which waits for none of them: a
 * session waiting for that lock is at work, and would wait for the refresh in turn. `{ quiet }`, with `why` when not. */
export function lookOnce({ list, roots, self, platform, onlyWaits }) {
  let busy;
  try {
    busy = atWorkIn(list(), { roots, self, platform, onlyWaits });
  } catch (err) {
    return { quiet: false, why: unlisted(err) };
  }
  return busy.length === 0 ? { quiet: true } : { quiet: false, why: `${busy.map(named).join(', ')} began a run` };
}

/** Waits until no session of `roots` is at work, looking with `list` every QUIET_LOOK_SECONDS: `{ quiet: true }`, or
 * `{ quiet: false, why }` when one still is after `waitMinutes`, or the listing failed, which cannot tell. Whom it waits
 * for is said once, and again when that changes; a session it does not wait for since it only waits, once. */
export async function waitForQuiet({ list, roots, self, now, sleep, stdout, waitMinutes = QUIET_WAIT_MINUTES, platform, onlyWaits = () => false }) {
  const until = now() + waitMinutes * 60000;
  let said = null;
  const toldWaiting = new Set();
  for (;;) {
    let busy;
    try {
      const waiting = [];
      const waits = (agent) => {
        if (!onlyWaits(agent)) return false;
        waiting.push(agent);
        return true;
      };
      busy = atWorkIn(list(), { roots, self, platform, onlyWaits: waits });
      for (const agent of waiting.filter((one) => !toldWaiting.has(named(one)))) {
        toldWaiting.add(named(agent));
        stdout(`refresh: ${named(agent)} only waits (js-harness wait): the refresh does not wait for it`);
      }
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
 * looks once more under the gate lock (`lookOnce`, Codex P2 on 79e3430..318f952). Before the wait, and again under the
 * lock, `unanswered(sha)` gives the line of a refusal while an open question asks to apply what main holds
 * (`unansweredApply`, bin/lib/refresh-consent.mjs), or null. Returns the land's exit when the refresh did its part, the
 * refresh's code when it failed, REFRESH_UNANSWERED for such a question, and GATE_NOT_RUN when a session was still at
 * work, which refreshes nothing; the landing stands in every case. A session `onlyWaits(agent)` says only waits is not
 * at work in either look. */
export async function refreshAfterLand({ code, log, refresh, versionOf, home, cwd, env, run, list, now, sleep, stdout, stderr, unanswered = () => null, onlyWaits = () => false }) {
  const landed = code === 0 && (log.landedBranches?.size ?? 0) > 0;
  const sha = landed ? log.record.candidate : null;
  const session = env.CLAUDE_CODE_SESSION_ID || null;
  let refreshed;
  try {
    const roots = landed ? projectRoots(run, cwd) : [];
    const stillQuiet = () => lookOnce({ list, roots, self: session, onlyWaits });
    if (landed) {
      // His open question is looked at first: no one waits half an hour for a refresh that question refuses.
      const refusal = unanswered(sha);
      if (refusal !== null) {
        stderr(refusal);
        return REFRESH_UNANSWERED;
      }
      const quiet = await waitForQuiet({ list, roots, self: session, now, sleep, stdout, onlyWaits });
      if (!quiet.quiet) {
        stderr(`refresh: ${quiet.why}: nothing was refreshed, and the installed copy still names its previous main; a land run from that copy is refused while main's bin/ differs from it: run js-harness merge-queue --refresh-copy from a checkout at origin/main once only waits run from the copy`);
        return GATE_NOT_RUN;
      }
    }
    refreshed = await refresh({ landed, sha, version: landed ? versionOf(sha) : null, home, cwd, env, session, stillQuiet, unanswered: () => unanswered(sha), stdout, stderr });
  } catch (err) {
    // A refresh that threw, or the folders or the wait before it, still lets the land record be written: main has
    // moved whatever the refresh did.
    stderr(`refresh failed: ${err.message}`);
    refreshed = REFRESH_FAILED;
  }
  return refreshed === 0 ? code : refreshed;
}

/** How many times the refresh run alone looks at the copy's processes while other work runs from it, and the pause
 * between looks: a hook runs for seconds, a review or a gate for minutes. */
export const COPY_LOOKS = 3;
const COPY_LOOK_PAUSE_MS = 10_000;

const sinceOf = (ms) => (Number.isFinite(ms) ? `, since ${new Date(ms).toISOString()}` : '');
const BLOCKER_KINDS = {
  chained: () => 'a shell that runs more after its js-harness wait',
  starting: () => 'a js-harness wait still starting, its code maybe not loaded',
};
const blockerOf = (one) => `${one.pid} (${BLOCKER_KINDS[one.kind]?.() ?? `${one.verb ?? 'no command named'} from the installed copy`}${sinceOf(one.createdAt)})`;
const blockersWhy = (blockers) => `${blockers.length === 1 ? 'a process runs' : `${blockers.length} processes run`} that the installed copy cannot be swapped under: ${blockers.map(blockerOf).join(', ')}`;

/** `merge-queue --refresh-copy` run alone: brings the installed copy up to `main.sha` (origin's main, or `main.why`
 * when it could not be read: exit 1) unless the copy already names it (`copySha`: exit 0). `look()` gives the copy's
 * processes (`{ waits, blockers, snapshot }`, readCopy); while a blocker is there after `COPY_LOOKS` looks, nothing is
 * refreshed (GATE_NOT_RUN). Then `refresh` (refreshCopy) runs for main, and under its gate lock `stillQuiet` looks once
 * more and refuses on a blocker. The waits are left running through the swap: none is stopped or told. Before the first
 * look, and again under the lock, `unanswered(sha)` gives the line of a refusal while an open question asks to apply
 * what main holds, or null: then nothing is refreshed (REFRESH_UNANSWERED). Returns the refresh's exit. */
export async function refreshNow({ main, copySha, look, refresh, versionOf, home, cwd, env, sleep, stdout, stderr, unanswered = () => null }) {
  if (!main.sha) {
    stderr(`refresh: ${main.why}: nothing was refreshed`);
    return 1;
  }
  const { sha } = main;
  if (copySha === sha) {
    stdout(`refresh: the installed copy already names ${sha.slice(0, 7)}, origin's main: nothing to refresh`);
    return 0;
  }
  let refusal;
  try {
    refusal = unanswered(sha);
  } catch (err) {
    refusal = `refresh: whether an open question asks to apply what ${sha.slice(0, 7)} holds could not be told (${err.message}): nothing was refreshed`;
  }
  if (refusal !== null) {
    stderr(refusal);
    return REFRESH_UNANSWERED;
  }
  const looked = () => {
    try {
      return look();
    } catch (err) {
      return { failed: `the processes of the installed copy could not be listed (${err.message})` };
    }
  };
  for (let at = 1; ; at += 1) {
    const seen = looked();
    if (seen.failed) {
      stderr(`refresh: ${seen.failed}: nothing was refreshed`);
      return GATE_NOT_RUN;
    }
    if (seen.blockers.length === 0) break;
    if (at >= COPY_LOOKS) {
      stderr(`refresh: ${blockersWhy(seen.blockers)}, after ${COPY_LOOKS} looks ${COPY_LOOK_PAUSE_MS / 1000} seconds apart: nothing was refreshed; run it again once that work ends`);
      return GATE_NOT_RUN;
    }
    await sleep(COPY_LOOK_PAUSE_MS);
  }
  // Under the gate lock, right before the install: one more look, refused on a blocker. A wait is left running: its
  // code is in memory and outlives its folder's swap, where a wait stopped here woke its session before it could be told
  // to run it again (JH 284).
  const stillQuiet = () => {
    const seen = looked();
    if (seen.failed) return { quiet: false, why: seen.failed };
    if (seen.blockers.length > 0) return { quiet: false, why: blockersWhy(seen.blockers) };
    return { quiet: true };
  };
  let code;
  try {
    code = await refresh({ landed: true, sha, version: versionOf(sha), home, cwd, env, session: env.CLAUDE_CODE_SESSION_ID || null, stillQuiet, unanswered: () => unanswered(sha), command: 'merge-queue --refresh-copy', stdout, stderr });
  } catch (err) {
    stderr(`refresh failed: ${err.message}`);
    code = REFRESH_FAILED;
  }
  return code;
}
