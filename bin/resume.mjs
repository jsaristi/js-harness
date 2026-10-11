#!/usr/bin/env node
// `resume --hook`: what a session reads when it comes back from a compaction, so nobody pastes it a
// resume prompt (odd/tasks/session-channel.md, "Context"). It is registered as a `SessionStart` hook with
// the matcher `compact` (bin/lib/manifest.mjs): the host hands it one JSON object on standard input and
// adds what it prints to what the session reads next. Both hosts document that input and that matcher
// (Claude Code: `session_id`, `transcript_path`, `cwd`, `source`, and `session_title` when the session has
// one; Codex: the same without the title), and this project's transcripts record the hooks of other tools
// run under `SessionStart:compact` after 40 compactions.
//
// It prints a few plain lines: the session's title, the opening stored for that title, the feature
// document it works on, and what to read there. Each comes from a file, and what no file says is said as
// not known, with where to look. Like every hook: it acts only in a project that opted in (a
// `harness.json` at the root of the checkout the session is in) and prints nothing elsewhere; it never
// fails a session (whatever goes wrong, it prints nothing and exits 0, with nothing on stderr); and it
// writes nothing, not even the reading `sessions --opening` records. Zero dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tty from 'node:tty';
import { spawnSync } from 'node:child_process';
import { findOpenings, openingsDir, placeOf, readNotices } from './lib/channel.mjs';
import { isSelf, mainCheckout, parseWorktreeList, projectSlug, readPlans, titleRead } from './lib/sessions.mjs';

const USAGE = [
  'Usage: js-harness resume --hook',
  '         a SessionStart hook for the matcher "compact": it reads the hook\'s input from standard input and,',
  '         after a compaction in a project with a harness.json, prints the session\'s title, its opening,',
  '         its feature document and what to read there. It prints nothing anywhere else, writes nothing',
  '         and always exits 0.',
].join('\n');

// How long one `git` may take, in milliseconds. The hook asks at most seven questions and the host gives
// it fifteen seconds (the entry `install` writes): a `git` that hangs costs the session a moment, not
// its start.
const GIT_TIMEOUT = 2000;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const oneLine = (text) => text.replace(/\s+/g, ' ').trim();

/** The title a transcript carries: the `customTitle` of its last `custom-title` entry, or `null`. It is
 * the rule of the board's reader (`sessionFacts`, `titleSource: 'custom-title'`) without the rest of it:
 * a transcript runs to tens of megabytes, and only the few lines that name the entry are parsed. A line
 * that does not parse (the last one, while the session writes) is skipped. */
export function transcriptTitle(text) {
  let title = null;
  for (const line of text.split('\n')) {
    if (!line.includes('"custom-title"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (isObject(entry) && entry.type === 'custom-title' && typeof entry.customTitle === 'string') title = entry.customTitle;
  }
  return title;
}

/** The checkout `cwd` is in, or `cwd` itself outside a repository: where a project's `harness.json` is. */
function checkoutOf(run, cwd) {
  const asked = run('git', ['rev-parse', '--show-toplevel'], { cwd });
  const top = asked.error || asked.status !== 0 ? '' : String(asked.stdout ?? '').split(/\r?\n/)[0].trim();
  return top === '' ? cwd : path.resolve(top);
}

/** The session's title and where it was read, `{ title, from }`, in the order of trust: what the host
 * gave the hook, what the transcript carries, the title of the opening the record says the session read.
 * `{ title: null, from }` with what was looked at when none of them has one. A transcript is read only
 * from the project's sessions folder, by the session's id: the path the input carries is not followed. */
function titleOf(input, sessionId, { projectDir, readings, readFile }) {
  if (typeof input.session_title === 'string' && oneLine(input.session_title) !== '') return { title: oneLine(input.session_title), from: 'the title the host gave the hook' };
  if (sessionId === null) return { title: null, from: 'the host gave the hook none and no session id a transcript could be found by' };
  let carried = null;
  try {
    carried = transcriptTitle(readFile(path.join(projectDir, `${sessionId}.jsonl`)));
  } catch {
    // No such transcript (a Codex session has none here), or one that cannot be read: it gives no title.
  }
  if (carried !== null && oneLine(carried) !== '') return { title: oneLine(carried), from: 'the title its transcript carries' };
  const read = titleRead(readings, sessionId);
  if (read !== null) return { title: read, from: 'the title of the opening it read, by the channel\'s record' };
  return { title: null, from: `the host gave the hook none, its transcript ${sessionId.slice(0, 8)} gives none and the channel's record has no opening read by it` };
}

/** The feature documents the session works on, `{ worktree, branch, documents }`, or `{ unknown }` with
 * why they cannot be told. They are the ones the branch of a worktree changed (`readPlans`, as the board
 * lists them), and the worktree is the one the session's last notice was written from: a transcript only
 * records the folder a session was opened in, and a notice records where its command ran. A notice is the
 * session's by its id, or by its title, which a session the app restarted keeps. A worktree that has
 * another branch checked out now says nothing of this session. */
function featureOf(record, sessionId, title, { run, readFile }) {
  if (record.unavailable !== undefined) return { unknown: `the channel's record could not be read (${record.unavailable})` };
  const own = (notice) => {
    const sender = isObject(notice.from) ? notice.from : {};
    if (sessionId !== null && typeof sender.id === 'string' && sender.id !== '' && isSelf(sessionId, sender.id)) return true;
    return title !== null && sender.title === title;
  };
  const last = record.notices.filter((notice) => own(notice) && typeof notice.worktree === 'string' && notice.worktree !== '').at(-1);
  if (!last) return { unknown: 'no notice of this session in the channel\'s record names a worktree' };
  const { worktree, branch } = last;
  if (typeof branch !== 'string') return { unknown: `this session's last notice was written in ${worktree} on no branch` };
  const now = placeOf(run, worktree).branch;
  if (now === null) return { unknown: `git does not say which branch ${worktree} is on now` };
  if (now !== branch) return { unknown: `${worktree} is on ${now} now; this session's last notice was written there on ${branch}` };
  const plans = readPlans(run, readFile, worktree);
  if (!plans.available) return { unknown: plans.reason };
  if (plans.items.length === 0) return { unknown: `the branch ${branch} of ${worktree} changed no feature document` };
  return { worktree, branch, documents: plans.items.map((plan) => path.join(worktree, plan.path)) };
}

// How many folders of feature documents the hook lists: the lines are read at the start of a turn, and a
// project has a worktree per feature in flight (fifteen in this one on 2026-10-11).
const FOLDERS_LISTED = 6;

/** `12m ago`, `5h ago`, `3d ago`: how long before `now` the time `ms` was. */
function ago(ms, now) {
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/** When a feature document of `folder` was last written (ms), or `null` when it holds none or cannot be
 * read. A session writes its state in its feature document before it is compacted, so the folder written
 * last is the first place to look; it is a fact about the folder, and says nothing of whose it is. */
function lastWritten(folder, { readdir, stat }) {
  try {
    const times = readdir(folder).filter((name) => name.endsWith('.md')).map((name) => stat(path.join(folder, name)).mtimeMs);
    return times.length === 0 ? null : Math.max(...times);
  } catch {
    return null;
  }
}

/** Where the feature documents of the project are, as the lines under "not known": the `odd/tasks`
 * folder of each worktree git lists (the project's own when git lists none), with its branch and when a
 * document was last written in it, that one first. No more than `FOLDERS_LISTED`: the rest is a count,
 * with where to see them. */
function documentFolders(run, root, files) {
  const listed = run('git', ['worktree', 'list', '--porcelain'], { cwd: root });
  const trees = listed.error || listed.status !== 0 ? [] : parseWorktreeList(String(listed.stdout ?? '')).filter((tree) => !tree.bare && tree.prunable === null);
  const folders = (trees.length === 0 ? [{ path: root, branch: null }] : trees).map((tree) => {
    const folder = path.join(tree.path, 'odd', 'tasks');
    return { folder, branch: tree.branch, written: lastWritten(folder, files) };
  });
  // The latest first; a folder with no document after every one that has one, in the order git gave.
  folders.sort((one, other) => (other.written ?? -Infinity) - (one.written ?? -Infinity));
  const said = (written) => (written === null ? 'no document' : `last written ${ago(written, files.now())}`);
  const lines = folders.slice(0, FOLDERS_LISTED).map((item) => `  ${item.folder}  (${[item.branch ? `branch ${item.branch}` : null, said(item.written)].filter(Boolean).join(', ')})`);
  const rest = folders.slice(FOLDERS_LISTED);
  if (rest.length > 0) lines.push(`  and ${rest.length} more worktree${rest.length === 1 ? '' : 's'} (git worktree list names them), ${rest[0].written === null ? 'none with a document' : `the last of them written ${ago(rest[0].written, files.now())}`}`);
  return ['Feature documents are in these folders, the one written last first:', ...lines];
}

const TRUST = 'and "State for a resume" if it has one, and trust them over the summary. Then repeat to the user any question that is still open.';
const WRITTEN_FROM = 'in the worktree this session\'s last notice was written from';

/** The lines the hook prints for the hook input `input`, or none when it is not for it to speak: an input
 * that is not a compaction's, or a project that did not opt in. */
function resumeLines(input, { defaultCwd, env, homedir, run, readFile, readdir, stat, now, isFile }) {
  if (!isObject(input) || input.source !== 'compact') return [];
  const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? path.resolve(input.cwd) : defaultCwd;
  // The opt-in comes first and costs one question to git: elsewhere nothing more is looked at.
  if (!isFile(path.join(checkoutOf(run, cwd), 'harness.json'))) return [];

  // The project is the main checkout, from any worktree, as for the board and for `notify`; the homes are
  // found as they find them.
  const root = mainCheckout(run, cwd);
  const slug = projectSlug(root);
  const projectDir = path.join(env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'), 'projects', slug);
  const harnessHome = env.JS_HARNESS_HOME || homedir();
  const sessionId = typeof input.session_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{7,}$/.test(input.session_id) ? input.session_id : null;
  const record = readNotices(harnessHome, slug, { readFile });
  const { title, from } = titleOf(input, sessionId, { projectDir, readings: record.readings, readFile });

  const lines = ['js-harness resume: this session was just compacted. What follows is read from files; the summary of the compaction is not the record.'];
  lines.push(title === null ? `Session: title not known (${from})` : `Session: "${title}" (${from})`);

  const dir = openingsDir(harnessHome, slug);
  if (title === null) lines.push(`Opening: not known without a title (the openings of this project are in ${dir}; js-harness sessions --opening "<title>" prints one)`);
  else {
    const found = findOpenings(harnessHome, slug, title, { readdir, readFile });
    if (found.unavailable !== undefined) lines.push(`Opening: could not look in ${dir} (${found.unavailable})`);
    else if (found.openings.length === 0) lines.push(`Opening: none stored for that title (the openings of this project are in ${dir})`);
    // The title goes to the command inside double quotes, with the ones it holds escaped.
    else lines.push(`Opening: ${found.openings[0].path}  (print it: js-harness sessions --opening ${JSON.stringify(title)})`);
  }

  const feature = featureOf(record, sessionId, title, { run, readFile });
  if (feature.unknown !== undefined) {
    lines.push(`Feature document: not known (${feature.unknown})`, ...documentFolders(run, root, { readdir, stat, now }));
    lines.push(`Find there the document of the feature this session was working on, read its "Next step", ${TRUST}`);
  } else if (feature.documents.length === 1) {
    lines.push(`Feature document: ${feature.documents[0]}  (branch ${feature.branch}, ${WRITTEN_FROM})`, `Read "Next step" in that document, ${TRUST}`);
  } else {
    lines.push(`Feature documents: the branch ${feature.branch} changed ${feature.documents.length}, ${WRITTEN_FROM}; this session works on one of them`);
    lines.push(...feature.documents.map((document) => `  ${document}`), `Read "Next step" in the one this session was working on, ${TRUST}`);
  }
  return lines;
}

export async function resumeMain(
  argv,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    homedir = os.homedir,
    // Everything that reads the disk or starts a process is a seam, so the tests hand in a machine of
    // their own. `run` is `git`, with a time limit.
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: GIT_TIMEOUT }),
    readFile = (absolute) => fs.readFileSync(absolute, 'utf8'),
    readdir = (absolute) => fs.readdirSync(absolute),
    stat = (absolute) => fs.statSync(absolute),
    now = Date.now,
    readStdin = () => fs.readFileSync(0, 'utf8'),
    stdinIsTTY = tty.isatty(0),
  } = {},
) {
  if (!argv.includes('--hook')) {
    stderr(USAGE);
    return 2;
  }
  // From here on nothing fails and nothing is half said: the lines are printed once they are all there,
  // and whatever throws on the way leaves the session as it would be without the hook.
  try {
    // A terminal is nobody's hook input, and reading it would wait for a key.
    if (stdinIsTTY) return 0;
    const text = readStdin();
    // A pipe of Windows PowerShell puts a byte order mark before what it sends.
    const input = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    const isFile = (absolute) => {
      try {
        return stat(absolute).isFile();
      } catch {
        return false;
      }
    };
    const lines = resumeLines(input, { defaultCwd, env, homedir, run, readFile, readdir, stat, now, isFile });
    if (lines.length > 0) stdout(lines.join('\n'));
  } catch {
    // Fail open: a hook that breaks a session's start is worse than one that says nothing.
  }
  return 0;
}
