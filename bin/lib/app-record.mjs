// The desktop app's own records: which folder a session sits in, and the scheduled tasks. The files are undocumented,
// so they are read as optional: a folder or file that is missing, or a file that does not parse, yields nothing.
// One that is there and cannot be read is no empty one: its path and error code go to the `unreadable` callback the
// caller gives, which names it as a failure (`unseen`); without one, it yields nothing as well.
import fs from 'node:fs';
import path from 'node:path';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The folder the desktop app keeps its records in on `platform`, or `null` when the variable it needs is not set. */
export function appRoot(env, platform, homedir, { readdir = fs.readdirSync } = {}) {
  if (platform === 'win32') return env.APPDATA ? windowsFolder(path.join(env.APPDATA, 'Claude'), env.LOCALAPPDATA, readdir) : null;
  if (!homedir) return null;
  if (platform === 'darwin') return path.join(homedir, 'Library', 'Application Support', 'Claude');
  return path.join(homedir, '.config', 'Claude');
}

const MOVED_MARKER = '.user-data-left.';
// The name of a moved folder, so a marker can never name a path outside Claude-Data.
const MOVED_NAME = /^claude_[A-Za-z0-9_-]+$/;

/** Where the app keeps its folder on Windows, given its old one, `%APPDATA%\Claude`. The app moved it to
 * `%LOCALAPPDATA%\Claude-Data\claude_<id>` and left only a marker file, `.user-data-left.claude_<id>`, in the old
 * one: the marker names the new folder, while that folder holds something. With no marker and no old folder, the one
 * `Claude-Data\claude_*` folder there is; otherwise the old folder, as before the move. */
export function windowsFolder(old, local, readdir = fs.readdirSync) {
  if (!local) return old;
  const base = path.join(local, 'Claude-Data');
  const kept = listing(readdir, old);
  const marker = kept.find((name) => name.startsWith(MOVED_MARKER) && MOVED_NAME.test(name.slice(MOVED_MARKER.length)));
  // A marker whose folder is gone or empty is stale: the app writes to the old folder again.
  const named = marker ? path.join(base, marker.slice(MOVED_MARKER.length)) : null;
  if (named && listing(readdir, named).length > 0) return named;
  if (kept.length > 0) return old;
  const moved = listing(readdir, base).filter((name) => MOVED_NAME.test(name));
  return moved.length === 1 ? path.join(base, moved[0]) : old;
}

/** The names in `dir`; a folder that is missing, or that cannot be listed, has none. `unreadable(dir, code)` is told of
 * the one that is there and cannot be listed. */
const listing = (readdir, dir, unreadable) => {
  try {
    return readdir(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') unreadable?.(dir, err.code ?? err.message);
    return [];
  }
};

/** The object in the JSON `file`, or null when it is missing, cannot be read, or is no object. `unreadable(file, code)` is
 * told of a file that is there and cannot be read, not of one that does not parse. */
const jsonOf = (readFile, file, unreadable) => {
  let text;
  try {
    text = readFile(file);
  } catch (err) {
    if (err.code !== 'ENOENT') unreadable?.(file, err.code ?? err.message);
    return null;
  }
  try {
    const data = JSON.parse(text);
    return isObject(data) ? data : null;
  } catch {
    return null;
  }
};

/** The `<account>/<org>` folders under the app's `claude-code-sessions` folder, each as its full path. */
function orgFolders(root, readdir, unreadable) {
  if (!root) return [];
  const base = path.join(root, 'claude-code-sessions');
  return listing(readdir, base, unreadable).flatMap((account) => listing(readdir, path.join(base, account), unreadable).map((org) => path.join(base, account, org)));
}

/** The app's session records by `cliSessionId`: `{ where, effort, scheduledTaskId, archived, title, cwd, priorCliSessionIds }`,
 * `cwd` the folder the session runs in (null when the record names none). `where` is
 * `'archived'` when the app archived it, `'routines'` when a scheduled task opened it, else `'sessions'`.
 * `priorCliSessionIds` are the CLI session ids the app had given this session before a clear, so a session started
 * again by a clear is one the record names them for; `[]` when the field is absent or is not a list of strings. */
export function appSessions(root, { readdir = fs.readdirSync, readFile = (file) => fs.readFileSync(file, 'utf8'), unreadable } = {}) {
  const sessions = new Map();
  for (const folder of orgFolders(root, readdir, unreadable)) {
    for (const name of listing(readdir, folder, unreadable)) {
      if (!/^local_.*\.json$/.test(name)) continue;
      const data = jsonOf(readFile, path.join(folder, name), unreadable);
      if (typeof data?.cliSessionId !== 'string') continue;
      const scheduledTaskId = typeof data.scheduledTaskId === 'string' && data.scheduledTaskId !== '' ? data.scheduledTaskId : null;
      const archived = data.isArchived === true;
      sessions.set(data.cliSessionId, {
        where: archived ? 'archived' : scheduledTaskId !== null ? 'routines' : 'sessions',
        effort: typeof data.effort === 'string' ? data.effort : null,
        scheduledTaskId,
        archived,
        title: typeof data.title === 'string' ? data.title : null,
        cwd: typeof data.cwd === 'string' && data.cwd !== '' ? data.cwd : null,
        priorCliSessionIds: Array.isArray(data.priorCliSessionIds) && data.priorCliSessionIds.every((id) => typeof id === 'string') ? data.priorCliSessionIds : [],
      });
    }
  }
  return sessions;
}

/** The app's scheduled-task registry: `{ found, tasks }`. `found` is whether a registry file (`scheduled-tasks.json`)
 * of some account and org parses to an object that holds a task list, an empty one included; `tasks` are every such
 * file's tasks as `{ id, cwd, enabled }`. A missing or unparsable file is no registry, so `found` says nothing of
 * its tasks: the caller decides what that is; one that cannot be read is told to `unreadable`, as `appSessions`. */
export function scheduledRegistry(root, { readdir = fs.readdirSync, readFile = (file) => fs.readFileSync(file, 'utf8'), unreadable } = {}) {
  let found = false;
  const tasks = [];
  for (const folder of orgFolders(root, readdir, unreadable)) {
    const data = jsonOf(readFile, path.join(folder, 'scheduled-tasks.json'), unreadable);
    if (!Array.isArray(data?.scheduledTasks)) continue;
    found = true;
    for (const task of data.scheduledTasks.filter(isObject)) tasks.push({ id: task.id, cwd: task.cwd, enabled: task.enabled === true });
  }
  return { found, tasks };
}

/** The scheduled tasks the app keeps, as `{ id, cwd, enabled }`. */
export function scheduledTasks(root, deps = {}) {
  return scheduledRegistry(root, deps).tasks;
}
