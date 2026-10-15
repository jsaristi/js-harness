#!/usr/bin/env node
// `unseen`: what the desktop app opened out of his sight (odd/tasks/session-channel.md, T16 layer 2). Two
// kinds of thing are listed. A scheduled task of the app whose folder is this project and that is enabled,
// since the app runs it in Routines, not in his sidebar; a session of this project that a schedule opened, or
// that sits in Routines, and that is not archived. A session a command opened (`js-harness remote`) is
// information, not a failure. The scheduled-session check reads the app's session records (their `cwd`,
// `scheduledTaskId` and `archived`), so `--records-only` needs no transcript; the full command also reads the
// transcripts through the board's own reader (`readSessionsWindow`, `rosterOf`). Read-only: it writes nothing.
// Exit 0 when nothing is to clear, 1 when something is, 2 for a usage error. `--json` gives the same items.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { appRoot, appSessions, scheduledTasks } from './lib/app-record.mjs';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, mainCheckout, projectSlug, rosterOf, sessionFacts, shareOf } from './lib/sessions.mjs';
import { unknownArgument } from './lib/args.mjs';
import { readSessionsWindow } from './sessions.mjs';

const USAGE = 'Usage: js-harness unseen [--hours <n>] [--claude-home <path>] [--records-only] [--json]';
const KNOWN = { valued: ['--hours', '--claude-home'], bare: ['--json', '--records-only'] };
const DEFAULT_HOURS = 168;
const NOTHING = 'unseen: nothing opened out of his sight';

class UnseenArgError extends Error {}

const gitRun = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 });

/** The project a folder is in: its main checkout, the one the board names (`mainCheckout`). */
export const projectOf = (cwd) => mainCheckout(gitRun, path.resolve(cwd));

/** A path as the comparisons read it: either slash, any case, no trailing slash. */
const comparable = (text) => text.replace(/\\+/g, '/').replace(/\/+$/, '').toLowerCase();

/** Whether `cwd` is `root` or a folder under it. A longer name that begins with `root` is another folder. */
const isWithin = (cwd, root) => {
  if (typeof cwd !== 'string') return false;
  const folder = comparable(cwd);
  const base = comparable(root);
  return folder === base || folder.startsWith(`${base}/`);
};

/** Whether `text` holds `root` as a whole path, the way a folder is written. */
const mentionsPath = (text, root) => {
  const escaped = comparable(root).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(?![a-z0-9_.-])`).test(comparable(text));
};

const listingOf = (readdir, dir) => {
  try {
    return readdir(dir);
  } catch {
    return [];
  }
};

const textOf = (readFile, file) => {
  try {
    return readFile(file);
  } catch {
    return null;
  }
};

const WHERE_WORDS = { routines: 'in Routines', sessions: 'in Sessions' };

/** The items to clear, and the ones that are information, for the project at `root`: `{ level, what }`, where
 * `level` is `FAIL` or `INFO`. `io` is the file reader set of the board (`readFile`, `readdir`, `stat`,
 * `readFacts`). With `recordsOnly` no transcript is listed or read: only the app's records place a session. */
function itemsOf(root, { claudeHome, appRootPath, hours, now, tmpdir, harnessHome, recordsOnly, io }) {
  const items = [];
  const fail = (what) => items.push({ level: 'FAIL', what });
  const info = (what) => items.push({ level: 'INFO', what });

  // The scheduled tasks: the app's registry of them, and the folders the app keeps for each one. With no
  // registry, the folders' own SKILL.md is all there is to say whether a task runs in this project.
  const scheduledRoot = path.join(claudeHome, 'scheduled-tasks');
  const folders = listingOf(io.readdir, scheduledRoot);
  const tasks = scheduledTasks(appRootPath, { readdir: io.readdir, readFile: io.readFile });
  if (tasks.length === 0) {
    for (const id of folders) {
      const file = path.join(scheduledRoot, id, 'SKILL.md');
      const text = textOf(io.readFile, file);
      if (text !== null && mentionsPath(text, root)) fail(`${file} names this project's path, and with no registry it is not known whether a scheduled task still runs here`);
    }
  } else {
    for (const task of tasks) {
      if (!isWithin(task.cwd, root)) continue;
      if (task.enabled) fail(`enabled scheduled task ${task.id} runs in ${task.cwd}: the app opens its sessions in Routines`);
      else info(`disabled scheduled task ${task.id} runs in ${task.cwd}: it opens no session`);
    }
    const registered = new Set(tasks.map((task) => task.id));
    for (const id of folders) {
      if (!registered.has(id)) info(`leftover folder of scheduled task ${id}, with no registry entry: ${path.join(scheduledRoot, id)}`);
    }
  }

  // The sessions of this project, read as the board reads them, and placed by the app's records. A transcript
  // id that a row of the board covers is not repeated by its record below.
  const projectDir = path.join(claudeHome, 'projects', projectSlug(root));
  const covered = new Set();
  if (!recordsOnly) {
    const seen = readSessionsWindow({
      projectDir,
      slug: projectSlug(root),
      harnessHome,
      hours,
      now,
      tasksRoot: path.join(tmpdir(), 'claude', projectSlug(root)),
      tail: 3,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      contextPause: shareOf(DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_PAUSE_PERCENT),
      contextCompactionDefault: shareOf(DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_COMPACTION_PERCENT),
      self: null,
      io,
    });
    if (seen.unlisted !== undefined && seen.unlisted !== 'ENOENT') {
      fail(`the sessions folder ${projectDir} could not be listed (${seen.unlisted}): the sessions of this project are not known`);
    } else if (seen.unlisted === undefined) {
      const app = appSessions(appRootPath, { readdir: io.readdir, readFile: io.readFile });
      for (const row of rosterOf(seen.sessions, { since: seen.since, app }).rows) {
        for (const transcript of row.transcripts) covered.add(transcript.id);
        if (row.where === 'archived') continue;
        const ids = row.transcripts.map((transcript) => transcript.id).join(', ');
        const name = `${row.title ?? 'a session with no title'} (${ids})`;
        if (row.opened === 'scheduled' || row.where === 'routines') {
          const place = row.where === 'unknown' ? 'where it sits is not known: its app record is missing' : WHERE_WORDS[row.where] ?? `in ${row.where}`;
          fail(`${name}: opened by a scheduled task, ${place}`);
        } else if (row.where === 'not-in-app') {
          info(`${name}: opened by a command, not in the app`);
        }
      }
    }
  }

  // The app's own records: a scheduled session of this project that is not archived, named by its title and id.
  // This is the whole check of `--records-only`, and the full command adds the records no transcript row covers.
  const records = appSessions(appRootPath, { readdir: io.readdir, readFile: io.readFile });
  for (const [sessionId, record] of records) {
    if (covered.has(sessionId) || record.archived || record.scheduledTaskId === null || !isWithin(record.cwd, root)) continue;
    fail(`${record.title ?? 'a session with no title'} (${sessionId}): opened by a scheduled task, in Routines`);
  }
  return items;
}

/** The items of `unseen` for the project at `root`, as `{ level, what }`, read from `claudeHome` and the app's
 * folder `appRootPath` (null when the app has none). Everything the reader needs is injectable. */
export function unseenItemsOf(root, {
  claudeHome,
  appRootPath = null,
  hours = DEFAULT_HOURS,
  now = Date.now,
  tmpdir = os.tmpdir,
  harnessHome,
  recordsOnly = false,
  readFile = (file) => fs.readFileSync(file, 'utf8'),
  readdir = (dir) => fs.readdirSync(dir),
  stat = (file) => fs.statSync(file),
  readFacts = sessionFacts,
} = {}) {
  return itemsOf(root, { claudeHome, appRootPath, hours, now, tmpdir, harnessHome: harnessHome ?? os.homedir(), recordsOnly, io: { readFile, readdir, stat, readFacts } });
}

/** What the doctor row lists: the texts of the FAIL items for the folder `cwd` is in (its project), on the
 * records-only path, so no transcript is read. The real app folder and Claude home unless given. */
export async function unseenToClear(cwd, options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const homedir = options.homedir ?? os.homedir;
  const items = unseenItemsOf(projectOf(cwd), {
    ...options,
    claudeHome: env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'),
    appRootPath: appRoot(env, platform, homedir()),
    harnessHome: env.JS_HARNESS_HOME || homedir(),
    recordsOnly: true,
  });
  return items.filter((item) => item.level === 'FAIL').map((item) => item.what);
}

function parseArgs(argv) {
  const unknown = unknownArgument(argv, KNOWN);
  if (unknown !== null) throw new UnseenArgError(`unknown argument: ${unknown}`);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    if (i === -1) return undefined;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new UnseenArgError(`${flag} requires a value`);
    return value;
  };
  const parsed = { hours: DEFAULT_HOURS, claudeHome: get('--claude-home'), json: argv.includes('--json'), recordsOnly: argv.includes('--records-only') };
  const hoursText = get('--hours');
  if (hoursText !== undefined) {
    const hours = /^(\d+\.?\d*|\.\d+)$/.test(hoursText) ? Number(hoursText) : NaN;
    if (!(hours > 0)) throw new UnseenArgError('--hours takes a number above zero');
    parsed.hours = hours;
  }
  return parsed;
}

/** `js-harness unseen`: prints one line per item and the last line, exits 1 when an item is to clear. */
export async function unseenMain(argv, {
  cwd = process.cwd(),
  root = projectOf(cwd),
  stdout = console.log,
  stderr = console.error,
  env = process.env,
  now = Date.now,
  platform = process.platform,
  homedir = os.homedir,
  tmpdir = os.tmpdir,
  readFile,
  readdir,
  stat,
  readFacts,
  appRootPath = appRoot(env, platform, homedir()),
} = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const claudeHome = parsed.claudeHome ?? env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude');
  const items = unseenItemsOf(root, {
    claudeHome,
    appRootPath,
    hours: parsed.hours,
    now,
    tmpdir,
    harnessHome: env.JS_HARNESS_HOME || homedir(),
    recordsOnly: parsed.recordsOnly,
    readFile,
    readdir,
    stat,
    readFacts,
  });
  const toClear = items.filter((item) => item.level === 'FAIL').length;
  if (parsed.json) {
    stdout(JSON.stringify({ root, claudeHome, hours: parsed.hours, recordsOnly: parsed.recordsOnly, items, toClear }, null, 2));
  } else {
    for (const item of items) stdout(`${item.level}  ${item.what}`);
    stdout(toClear > 0 ? `unseen: ${toClear} to clear` : NOTHING);
  }
  return toClear > 0 ? 1 : 0;
}
