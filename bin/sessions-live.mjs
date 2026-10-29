// `js-harness sessions live` (odd/tasks/live-board.md, S3-S4): the channel record as the live board's rows. Sessions
// already write every event as a notice (`notify`, the merge queue, the permit hook); this turns the notices the board
// has not been sent into batch files, one database document each, and prints the `ArtifactData` call that sends one.
// Only a Claude session can make that call: no command or hook reaches an artifact's database. The cursor that says
// what was sent lives in the channel's folder, which `uninstall` deletes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { channelDir, readNotices } from './lib/channel.mjs';
import { batchesOf, cursorAfter, cursorFrom, pendingRows, positionOf } from './lib/live-rows.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';
import { boardStretch } from './stretch.mjs';
import { WAIT_FOR_MINUTES } from './wait.mjs';

export const LIVE_USAGE = [
  'Usage: js-harness sessions live [--hours <n>] [--out <dir> [--resting]] [--url <board>] [--cwd <path>] [--home <path>]',
  '       js-harness sessions live --sent <file> [--cwd <path>] [--home <path>]',
  '         turns the notices of the channel record the live board has not been sent into its rows (time, session, kind,',
  '         text, state); with nothing sent yet, those of the last --hours (24 by default). With no --out it prints how many',
  '         wait; --out writes them as batch files, one document of the board\'s events collection each, and prints the',
  '         ArtifactData set that sends each one; --sent <file> moves the cursor past that file once it was sent.',
  '         --out also writes board-checked.json, the time it read the record, and prints the ArtifactData update that',
  '         merges it into board/summary once every batch was sent, with no row to send too: the board then tells a',
  '         quiet stretch from a record nobody sent. The check holds 45 minutes, the lead\'s heartbeat; with --resting,',
  '         the run before the lead\'s resting wait, it holds that wait (wait-for) and the board reads as resting.',
  '         --url records the board\'s link with the cursor, and every run prints it back. Only a Claude session sends',
  '         a batch: no command reaches an artifact\'s database. Exit 1 when the record or a batch file cannot be read,',
  '         2 for a usage error.',
].join('\n');

const CURSOR_SCHEMA = 'js-harness.live-cursor/v1';

// How long a check of the record holds on the board: the lead wakes on a notice or after the heartbeat's 30 quiet
// minutes (`loop heartbeat --quiet`), plus 15 to wake and send. A resting lead waits for a notice up to `wait-for`.
const CHECK_MINUTES = 45;

class LiveArgError extends Error {}

/** The file of the live board's cursor for the project `slug` under `home`: in the channel's folder. */
export function liveCursorPath(home, slug) {
  return path.join(channelDir(home), 'live', `${slug}.json`);
}

const VALUED = new Map([['--hours', 'hours'], ['--out', 'out'], ['--url', 'url'], ['--sent', 'sent'], ['--cwd', 'cwd'], ['--home', 'home']]);

function parseLive(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--resting') {
      parsed.resting = true;
      continue;
    }
    if (!VALUED.has(token)) throw new LiveArgError(`unknown argument: ${token}`);
    const value = argv[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) throw new LiveArgError(`${token} requires a value`);
    parsed[VALUED.get(token)] = value;
    i += 1;
  }
  if (parsed.hours !== undefined) {
    const hours = Number(parsed.hours);
    if (!Number.isFinite(hours) || hours <= 0) throw new LiveArgError('--hours takes a number of hours above 0');
    parsed.hours = hours;
  }
  if (parsed.sent !== undefined && (parsed.out !== undefined || parsed.hours !== undefined || parsed.url !== undefined)) {
    throw new LiveArgError('--sent takes only --cwd and --home besides it');
  }
  if (parsed.resting && parsed.out === undefined) throw new LiveArgError('--resting takes --out');
  return parsed;
}

/** The cursor file's content, `{}` when there is none. A file that is there and cannot be read throws. */
function readCursor(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  const saved = JSON.parse(text);
  return saved?.schema === CURSOR_SCHEMA ? saved : {};
}

function writeCursor(file, saved) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ ...saved, schema: CURSOR_SCHEMA })}\n`, 'utf8');
}

/** The saved cursor: its position form, `{ upto, sent }`, or the form before it, `{ through, ids }`, which
 * `positionOf` places in the record once; `null` when there is none. */
const cursorOf = (saved) => {
  if (Number.isSafeInteger(saved.upto) && Array.isArray(saved.sent)) return { upto: saved.upto, sent: saved.sent };
  return typeof saved.through === 'string' && Array.isArray(saved.ids) ? { through: saved.through, ids: saved.ids } : null;
};

/** `saved` with `cursor` in place of the cursor it held, in either form. */
const withCursor = ({ through, ids, upto, sent, ...rest }, cursor) => ({ ...rest, ...cursor });

/** A batch's file name: its document id with what Windows refuses in a name (the colons of a time) made dashes. */
const fileNameOf = (docId) => `live-${docId.replace(/[^A-Za-z0-9.-]/g, '-')}.json`;

export async function sessionsLiveMain(argv, {
  cwd: defaultCwd = process.cwd(),
  stdout = console.log,
  stderr = console.error,
  env = process.env,
  now = Date.now,
  homedir = os.homedir,
  run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }),
} = {}) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    stdout(LIVE_USAGE);
    return 0;
  }
  let parsed;
  try {
    parsed = parseLive(argv);
  } catch (err) {
    stderr(`js-harness sessions live: ${err.message}\n\n${LIVE_USAGE}`);
    return 2;
  }
  const root = mainCheckout(run, path.resolve(parsed.cwd ?? defaultCwd));
  const slug = projectSlug(root);
  const home = harnessHome({ given: parsed.home, env, cwd: defaultCwd, homedir });
  const cursorFile = liveCursorPath(home, slug);
  let saved;
  try {
    saved = readCursor(cursorFile);
  } catch (err) {
    stderr(`js-harness sessions live: ${cursorFile} cannot be read (${err.code ?? err.message})`);
    return 1;
  }
  // A cursor of the form before is placed in the record and saved in the position form on the first run, so a notice
  // that lands after it is counted by its place.
  const old = cursorOf(saved);
  if (old !== null && old.upto === undefined) {
    const record = readNotices(home, slug);
    if (record.unavailable !== undefined) {
      stderr(`js-harness sessions live: ${record.path} cannot be read (${record.unavailable})`);
      return 1;
    }
    saved = withCursor(saved, positionOf(old, pendingRows(record.notices, null, new Date(0).toISOString())));
    writeCursor(cursorFile, saved);
  }

  if (parsed.sent !== undefined) {
    let rows;
    try {
      rows = JSON.parse(fs.readFileSync(path.resolve(defaultCwd, parsed.sent), 'utf8'))?.rows;
    } catch (err) {
      stderr(`js-harness sessions live: ${parsed.sent} cannot be read (${err.code ?? err.message})`);
      return 1;
    }
    if (!Array.isArray(rows) || rows.some((row) => typeof row?.id !== 'string' || !Number.isSafeInteger(row?.seq) || row.seq < 0)) {
      stderr(`js-harness sessions live: ${parsed.sent} is no batch this command wrote: it has no rows with an id and a place in the record`);
      return 1;
    }
    const cursor = cursorAfter(cursorOf(saved), rows);
    writeCursor(cursorFile, withCursor(saved, cursor));
    stdout(`the live board has been sent every notice before number ${cursor.upto + 1} of the record${cursor.sent.length === 0 ? '' : `, and ${cursor.sent.length} after it`}`);
    return 0;
  }

  const record = readNotices(home, slug);
  if (record.unavailable !== undefined) {
    stderr(`js-harness sessions live: ${record.path} cannot be read (${record.unavailable})`);
    return 1;
  }
  const since = new Date(now() - (parsed.hours ?? 24) * 3_600_000).toISOString();
  const rows = pendingRows(record.notices, cursorOf(saved), since);
  const url = parsed.url ?? saved.url ?? null;
  if (parsed.url !== undefined && parsed.url !== saved.url) writeCursor(cursorFile, { ...saved, url: parsed.url });
  stdout(`${rows.length} ${rows.length === 1 ? 'row waits' : 'rows wait'} for the live board`);
  stdout(url === null ? 'board: none recorded; name it with --url <board>' : `board: ${url}`);
  if (parsed.out === undefined) return 0;
  // With nothing sent yet, the notices before the window count as sent from the first batch on, so a later run does
  // not export them.
  if (cursorOf(saved) === null) {
    writeCursor(cursorFile, withCursor({ ...saved, url: url ?? undefined }, cursorFrom(pendingRows(record.notices, null, new Date(0).toISOString()), since)));
  }

  const out = path.resolve(defaultCwd, parsed.out);
  fs.mkdirSync(out, { recursive: true });
  for (const batch of batchesOf(rows)) {
    const file = path.join(out, fileNameOf(batch.docId));
    fs.writeFileSync(file, `${JSON.stringify({ time: batch.time, rows: batch.rows })}\n`, 'utf8');
    stdout(`ArtifactData set: url ${url ?? '<board>'}, collection events, doc_id ${batch.docId}, file_path ${file}`);
    stdout(`  then: js-harness sessions live --sent ${file}`);
  }
  // A quiet stretch has no new notice, so the board would read the newest row's age as nobody sending the record. Once
  // the batches are sent, the record up to this run is on the board: board/summary carries that time and how long it
  // holds, until the lead's next check.
  const checked = path.join(out, 'board-checked.json');
  const holds = (parsed.resting ? WAIT_FOR_MINUTES : CHECK_MINUTES) * 60_000;
  // The open stretch rides on the same document, `null` when none is open so the merge clears one that closed.
  const stretch = boardStretch({ home, root, slug, now: now(), run });
  const stamp = { checked: new Date(now()).toISOString(), until: new Date(now() + holds).toISOString(), resting: parsed.resting === true, stretch };
  fs.writeFileSync(checked, `${JSON.stringify(stamp)}\n`, 'utf8');
  stdout(`ArtifactData update: url ${url ?? '<board>'}, collection board, doc_id summary, file_path ${checked}`);
  stdout('  once every batch above was sent: the board reads it as the time you checked the record');
  return 0;
}
