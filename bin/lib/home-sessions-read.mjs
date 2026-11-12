// Reads what ./home-sessions.mjs judges, for `js-harness rules applied` (odd/tasks/one-model-home.md, spec 6): the
// desktop app's records of a project's sessions, and the background jobs `sessions start` recorded for it, each with
// what its start asked, what its last reply ran on and its job's state. It writes nothing. A source that cannot be
// read is named in `unread` and never taken as empty: a list that failed is not "no session off the home".
import fs from 'node:fs';
import path from 'node:path';
import { appRoot, appSessions } from './app-record.mjs';
import { atWork, claudeRunner, listAgents, readRecord, within, worktreeOf } from './background.mjs';
import { projectSlug, sessionFacts } from './sessions.mjs';

/** What `sessionsOffHome` takes, `{ desktop, background, unread }`, for the project whose main checkout is `main`.
 *
 * `desktop` is each app record whose folder is in `main` (a worktree under it too), as `{ id, ...record }`. `readApp`
 * is given whom to tell of a record or a folder that is there and cannot be read (`unreadable(file, code)`), which the
 * app's reader otherwise passes over in silence: those are counted in `unread`, the first one named.
 * `background` is each start the record under `home` (the harness's) holds for `main`, but one a later start resumed,
 * whose job that start replaced, and one removed more than `days` days before `now` (ms): `{ id, title, asked, replied,
 * state, working, removed }`. `replied` is read from the session's transcript under `claudeDir`, in the folder of the
 * place it runs in (its worktree as `worktreeOf` gives it, since an old record holds the main checkout as its path),
 * and is null when there is none or it records neither a model nor a level. `state` is what `agents()` (the
 * list `claude agents` gives, read only when a job is not removed) says of the job, `not listed by claude agents`
 * when it holds none, and null when the list could not be read or the job is removed; `working` is whether that list
 * holds the job at work (`atWork`), which a resume refuses, and null where `state` is. */
export function readHomeSessions({
  main, home, claudeDir, now, days, env = process.env, homedir, platform = process.platform,
  readApp = (unreadable) => {
    const root = appRoot(env, platform, homedir());
    if (root === null) throw new Error('the folder the app keeps them in is not known here');
    return appSessions(root, { unreadable });
  },
  agents = () => listAgents(claudeRunner({ env, platform })),
  readFile = (file) => fs.readFileSync(file, 'utf8'),
}) {
  const unread = [];
  let desktop = [];
  const passed = [];
  try {
    desktop = [...readApp((file, code) => passed.push(`${file}: ${code}`))].filter(([, record]) => typeof record.cwd === 'string' && within(record.cwd, main, platform)).map(([id, record]) => ({ id, ...record }));
  } catch (err) {
    unread.push(`the app's records of its sessions (${err.code ?? err.message})`);
  }
  if (passed.length > 0) unread.push(`${passed.length} of the app's session records or their folders (${passed[0]}${passed.length > 1 ? `, and ${passed.length - 1} more` : ''})`);
  const record = readRecord(home, { readFile });
  if (record.unavailable !== undefined) unread.push(`the record of the background sessions (${record.unavailable})`);
  const started = record.started ?? [];
  const removed = record.removed ?? new Set();
  const resumed = new Set(started.map((entry) => entry.resumedFrom).filter((id) => typeof id === 'string'));
  const here = (entry) => typeof entry.root === 'string' && within(entry.root, main, platform) && within(main, entry.root, platform);
  const since = now - days * 24 * 3600 * 1000;
  const jobs = started.filter((entry) => here(entry) && !resumed.has(entry.id) && (!removed.has(entry.id) || Date.parse(entry.at ?? '') >= since));
  let listed = null;
  if (jobs.some((entry) => !removed.has(entry.id))) {
    try {
      listed = agents();
    } catch (err) {
      unread.push(`the state of the background jobs (${err.message})`);
    }
  }
  const repliedOf = (entry) => {
    if (typeof entry.sessionId !== 'string') return null;
    try {
      const folder = worktreeOf(entry, platform) ?? entry.cwd ?? entry.root;
      const facts = sessionFacts(readFile(path.join(claudeDir, 'projects', projectSlug(folder), `${entry.sessionId}.jsonl`)), { tail: 0 });
      // The advisor goes with the model it was named beside, only where the reply names one (advisor-home.md, spec 6).
      const replied = { model: facts.context?.model ?? null, effort: facts.effort ?? null, ...(typeof facts.advisor === 'string' && { advisor: facts.advisor }) };
      return replied.model === null && replied.effort === null ? null : replied;
    } catch {
      return null;
    }
  };
  const stateOf = (entry) => {
    if (listed === null || removed.has(entry.id)) return { state: null, working: null };
    const job = listed.find((agent) => agent.id === entry.id || (typeof entry.sessionId === 'string' && agent.sessionId === entry.sessionId));
    return { state: job === undefined ? 'not listed by claude agents' : String(job.status ?? job.state ?? 'listed'), working: atWork(job) };
  };
  const background = jobs.map((entry) => ({
    id: entry.id,
    title: entry.title ?? null,
    asked: { model: entry.model ?? null, effort: entry.effort ?? null },
    replied: repliedOf(entry),
    ...stateOf(entry),
    removed: removed.has(entry.id),
  }));
  return { desktop, background, unread };
}
