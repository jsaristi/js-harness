// Helpers of the hidden grader of `house-rules`: a fake context for `main`, the seed tasks, and a reader
// for CSV. The workspace root is `..` from this directory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The fake clock is years away from the real date, so a command that asks the system for the time gets a
// different answer from one that calls `ctx.clock()`.
export const NOW = '2031-04-20T12:00:00.000Z';

// Stored out of id order on purpose. Titles hold a comma, a double quote and a line feed.
const seed = (id, title, status, created, completed) => ({ id, title, status, created, completed });
const T = {
  1: seed(1, 'Buy milk', 'open', '2031-04-10T12:00:00.000Z', null), // 10 days before NOW
  2: seed(2, 'Call Ann, then Bob', 'done', '2031-04-11T12:00:00.000Z', '2031-04-12T12:00:00.000Z'), // 9 days
  3: seed(3, 'Say "hello"', 'open', '2031-04-17T12:00:00.000Z', null), // 3 days
  4: seed(4, 'Line one\nLine two', 'done', '2031-04-20T01:00:00.000Z', '2031-04-20T10:00:00.000Z'), // 11 hours
  5: seed(5, 'Plain', 'open', '2031-04-20T11:30:00.000Z', null), // 30 minutes
  6: seed(6, 'Water plants', 'open', '2031-04-19T23:00:00.000Z', null), // 13 hours
};
export const TASKS = [T[3], T[1], T[6], T[2], T[5], T[4]];
export const BY_ID = [1, 2, 3, 4, 5, 6].map((id) => T[id]);

// CONTRIBUTING.md "Data formats": the store is `{ nextId, tasks }`, and a bare array of tasks is read too.
const storedTasks = (parsed) => (Array.isArray(parsed) ? parsed : parsed.tasks);

export const HEADER = 'id,title,status,created,completed';

/**
 * A temporary directory holding a store (seeded with `store` as given, else with `tasks` as a bare array,
 * unless `tasks` is null) and an empty `out/`
 * directory for files a command writes, plus a context whose clock is `now` and whose output is captured.
 */
export function makeEnv({ tasks = TASKS, store = null, now = NOW } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tk-grade-'));
  const storePath = path.join(dir, 'tasks.json');
  const outDir = path.join(dir, 'out');
  fs.mkdirSync(outDir);
  if (store) fs.writeFileSync(storePath, JSON.stringify(store));
  else if (tasks) fs.writeFileSync(storePath, JSON.stringify(tasks));
  const printed = { out: [], err: [] };
  return {
    ctx: {
      io: { out: (text) => printed.out.push(String(text)), err: (text) => printed.err.push(String(text)) },
      clock: () => new Date(now),
      storePath,
    },
    storePath,
    outDir,
    outFile: (name) => path.join(outDir, name),
    out: () => printed.out.join(''),
    err: () => printed.err.join(''),
    stored: () => storedTasks(JSON.parse(fs.readFileSync(storePath, 'utf8'))),
    storedFile: () => JSON.parse(fs.readFileSync(storePath, 'utf8')),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** Runs `body(env)` with a fresh environment and removes it afterwards. */
export async function withEnv(options, body) {
  const env = makeEnv(options);
  try {
    return await body(env);
  } finally {
    env.cleanup();
  }
}

/** Reads CSV into records of fields (RFC 4180: quoted fields, doubled quotes, CRLF or LF between records). */
export function parseCsv(text) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

/** The task records a CSV document holds, without its header. */
export function csvTasks(text) {
  const [, ...rows] = parseCsv(text);
  return rows.map(([id, title, status, created, completed]) => ({ id: Number(id), title, status, created, completed: completed === '' ? null : completed }));
}

/** Runs `body` while writes to the real stdout, stderr and the console are recorded instead of printed.
 * Binary chunks are the test runner's own and pass through. Returns what the body returned and the text
 * that was written. */
export async function spyOnStdio(body) {
  const written = [];
  const names = ['log', 'info', 'warn', 'error', 'debug'];
  const saved = { stdout: process.stdout.write, stderr: process.stderr.write, console: Object.fromEntries(names.map((name) => [name, console[name]])) };
  const intercept = (original, stream) => (chunk, ...rest) => {
    if (typeof chunk !== 'string') return original.call(stream, chunk, ...rest);
    written.push(chunk);
    return true;
  };
  process.stdout.write = intercept(saved.stdout, process.stdout);
  process.stderr.write = intercept(saved.stderr, process.stderr);
  for (const name of names) console[name] = (...args) => written.push(args.join(' '));
  try {
    const value = await body();
    return { value, written };
  } finally {
    process.stdout.write = saved.stdout;
    process.stderr.write = saved.stderr;
    for (const name of names) console[name] = saved.console[name];
  }
}
