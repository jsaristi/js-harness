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
import { batchesOf, cursorAfter, pendingRows } from './lib/live-rows.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';

export const LIVE_USAGE = [
  'Usage: js-harness sessions live [--hours <n>] [--out <dir>] [--url <board>] [--cwd <path>] [--home <path>]',
  '       js-harness sessions live --sent <file> [--cwd <path>] [--home <path>]',
  '         turns the notices of the channel record the live board has not been sent into its rows (time, session, kind,',
  '         text, state); with nothing sent yet, those of the last --hours (24 by default). With no --out it prints how many',
  '         wait; --out writes them as batch files, one document of the board\'s events collection each, and prints the',
  '         ArtifactData set that sends each one; --sent <file> moves the cursor past that file once it was sent.',
  '         --url records the board\'s link with the cursor, and every run prints it back. Only a Claude session sends',
  '         a batch: no command reaches an artifact\'s database. Exit 1 when the record or a batch file cannot be read,',
  '         2 for a usage error.',
].join('\n');

const CURSOR_SCHEMA = 'js-harness.live-cursor/v1';

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

const cursorOf = (saved) => (typeof saved.through === 'string' && Array.isArray(saved.ids) ? { through: saved.through, ids: saved.ids } : null);

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

  if (parsed.sent !== undefined) {
    let rows;
    try {
      rows = JSON.parse(fs.readFileSync(path.resolve(defaultCwd, parsed.sent), 'utf8'))?.rows;
    } catch (err) {
      stderr(`js-harness sessions live: ${parsed.sent} cannot be read (${err.code ?? err.message})`);
      return 1;
    }
    if (!Array.isArray(rows) || rows.some((row) => typeof row?.id !== 'string' || !Number.isFinite(Date.parse(row?.time)))) {
      stderr(`js-harness sessions live: ${parsed.sent} is no batch this command wrote: it has no rows with an id and a time`);
      return 1;
    }
    const cursor = cursorAfter(cursorOf(saved), rows);
    writeCursor(cursorFile, { ...saved, ...cursor });
    stdout(`the live board has been sent the notices through ${cursor?.through ?? 'none yet'}`);
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

  const out = path.resolve(defaultCwd, parsed.out);
  fs.mkdirSync(out, { recursive: true });
  for (const batch of batchesOf(rows)) {
    const file = path.join(out, fileNameOf(batch.docId));
    fs.writeFileSync(file, `${JSON.stringify({ time: batch.time, rows: batch.rows })}\n`, 'utf8');
    stdout(`ArtifactData set: url ${url ?? '<board>'}, collection events, doc_id ${batch.docId}, file_path ${file}`);
    stdout(`  then: js-harness sessions live --sent ${file}`);
  }
  return 0;
}
