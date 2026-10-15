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

/** The app's session records by `cliSessionId`: `{ where, effort, scheduledTaskId, archived, title }`. `where` is
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
      });
    }
  }
  return sessions;
}

/** The scheduled tasks the app keeps, as `{ id, cwd, enabled }`. */
export function scheduledTasks(root, { readdir = fs.readdirSync, readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  return orgFolders(root, readdir).flatMap((folder) => {
    const data = jsonOf(readFile, path.join(folder, 'scheduled-tasks.json'));
    const tasks = Array.isArray(data?.scheduledTasks) ? data.scheduledTasks.filter(isObject) : [];
    return tasks.map((task) => ({ id: task.id, cwd: task.cwd, enabled: task.enabled === true }));
  });
}
