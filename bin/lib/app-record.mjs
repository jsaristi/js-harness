// The desktop app's own records: which folder a session sits in, and the scheduled tasks. The files are undocumented,
// so they are read as optional: a folder that is missing and a file that cannot be read or parsed yield nothing.
import fs from 'node:fs';
import path from 'node:path';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The folder the desktop app keeps its records in on `platform`, or `null` when the variable it needs is not set. */
export function appRoot(env, platform, homedir) {
  if (platform === 'win32') return env.APPDATA ? path.join(env.APPDATA, 'Claude') : null;
  if (!homedir) return null;
  if (platform === 'darwin') return path.join(homedir, 'Library', 'Application Support', 'Claude');
  return path.join(homedir, '.config', 'Claude');
}

const listing = (readdir, dir) => {
  try {
    return readdir(dir);
  } catch {
    return [];
  }
};

const jsonOf = (readFile, file) => {
  try {
    const data = JSON.parse(readFile(file));
    return isObject(data) ? data : null;
  } catch {
    return null;
  }
};

/** The `<account>/<org>` folders under the app's `claude-code-sessions` folder, each as its full path. */
function orgFolders(root, readdir) {
  if (!root) return [];
  const base = path.join(root, 'claude-code-sessions');
  return listing(readdir, base).flatMap((account) => listing(readdir, path.join(base, account)).map((org) => path.join(base, account, org)));
}

/** The app's session records by `cliSessionId`: `{ where, effort, scheduledTaskId, archived, title, cwd }`, `cwd` the
 * folder the session runs in (null when the record names none). `where` is
 * `'archived'` when the app archived it, `'routines'` when a scheduled task opened it, else `'sessions'`. */
export function appSessions(root, { readdir = fs.readdirSync, readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const sessions = new Map();
  for (const folder of orgFolders(root, readdir)) {
    for (const name of listing(readdir, folder)) {
      if (!/^local_.*\.json$/.test(name)) continue;
      const data = jsonOf(readFile, path.join(folder, name));
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
      });
    }
  }
  return sessions;
}

/** The app's scheduled-task registry: `{ found, tasks }`. `found` is whether a registry file (`scheduled-tasks.json`)
 * of some account and org parses to an object that holds a task list, an empty one included; `tasks` are every such
 * file's tasks as `{ id, cwd, enabled }`. A missing or unparsable file is no registry, so `found` says nothing of
 * its tasks: the caller decides what that is. */
export function scheduledRegistry(root, { readdir = fs.readdirSync, readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  let found = false;
  const tasks = [];
  for (const folder of orgFolders(root, readdir)) {
    const data = jsonOf(readFile, path.join(folder, 'scheduled-tasks.json'));
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
