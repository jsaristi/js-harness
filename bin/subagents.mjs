#!/usr/bin/env node
// `subagents`: the count of a day's sub-agents by role, model and effort, with their tokens and the share of
// the day's tokens they took (odd/tasks/effort-by-task.md, S3). It reads the Claude Code records of this
// project, the main checkout's and each worktree's, and keeps no text of any message. Zero dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { callsOf, countOf, dayOf, launchesOf, usageOf } from './lib/subagent-count.mjs';
import { mainCheckout, parseWorktreeList, projectSlug } from './lib/sessions.mjs';

const USAGE = 'Usage: js-harness subagents [--day YYYY-MM-DD] [--days <n>] [--json] [--cwd <dir>]';
// A day of this project's records is about 231 MB, every line of it read: a week is the most one run reads.
const MAX_DAYS = 7;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class SubagentsArgError extends Error {}

function parseArgs(argv) {
  const parsed = { days: 1, json: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new SubagentsArgError(`${token} requires a value`);
      i += 1;
      return next;
    };
    if (token === '--day') {
      parsed.day = value();
      if (!DAY_PATTERN.test(parsed.day) || Number.isNaN(Date.parse(`${parsed.day}T00:00:00Z`))) throw new SubagentsArgError('--day takes a date as YYYY-MM-DD');
    } else if (token === '--days') {
      const raw = value();
      parsed.days = /^\d+$/.test(raw) ? Number(raw) : NaN;
      if (!(parsed.days >= 1 && parsed.days <= MAX_DAYS)) throw new SubagentsArgError(`--days takes a whole number from 1 to ${MAX_DAYS}`);
    } else if (token === '--json') {
      parsed.json = true;
    } else if (token === '--cwd') {
      parsed.cwd = value();
    } else {
      throw new SubagentsArgError(`unknown argument: ${token}`);
    }
  }
  return parsed;
}

/** `day` moved by `delta` days, both `YYYY-MM-DD`. */
const shiftDay = (day, delta) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);

/** The records folders of this project: the main checkout's and each worktree's, as Claude Code names them
 * under `<config>/projects`, the ones that exist. */
function recordFolders({ cwd, env, homedir, run }) {
  const main = mainCheckout(run, cwd);
  const listed = run('git', ['worktree', 'list', '--porcelain'], { cwd: main, encoding: 'utf8' });
  const trees = listed.error || listed.status !== 0 ? [] : parseWorktreeList(listed.stdout).map((tree) => tree.path);
  const root = path.join(env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'), 'projects');
  const slugs = [...new Set([main, ...trees].map((folder) => projectSlug(path.resolve(folder))))];
  return slugs.map((slug) => path.join(root, slug)).filter((dir) => fs.existsSync(dir));
}

/** Each line of `file` parsed, handed to `keep`; a line that is not JSON is skipped. Streamed: a session's
 * record can be hundreds of megabytes. */
async function eachEntry(file, keep) {
  const lines = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line === '') continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    keep(entry);
  }
}

/** What the count needs of an entry and nothing more: never the content of a message. */
function slim(entry) {
  const kept = { type: entry?.type, timestamp: entry?.timestamp, requestId: entry?.requestId, effort: entry?.effort };
  const message = entry?.message;
  if (entry?.type === 'assistant' && message && typeof message === 'object') {
    kept.message = { id: message.id, model: message.model, usage: message.usage };
  }
  return kept;
}

/** The files of `dir` whose names `test` accepts and that changed at or after `since` (ms). */
function recentFiles(dir, test, since) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter(test)
    .map((name) => path.join(dir, name))
    .filter((file) => {
      try {
        return fs.statSync(file).mtimeMs >= since;
      } catch {
        return false;
      }
    });
}

/** The parent sessions' usage inside the window and their calls, and the sub-agents' records, of every
 * folder. `inWindow(timestamp)` says whether an entry's local day is one asked for. */
async function readRecords(folders, { since, inWindow }) {
  const sessionEntries = [];
  const calls = new Map();
  const records = [];
  for (const folder of folders) {
    for (const file of recentFiles(folder, (name) => name.endsWith('.jsonl'), since)) {
      await eachEntry(file, (entry) => {
        for (const [id, call] of callsOf([entry])) calls.set(id, call);
        if (entry?.type === 'assistant' && inWindow(entry.timestamp)) sessionEntries.push(slim(entry));
      });
      const session = path.basename(file, '.jsonl');
      const subagents = path.join(folder, session, 'subagents');
      for (const agentFile of recentFiles(subagents, (name) => /^agent-.*\.jsonl$/.test(name), since)) {
        let meta = {};
        try {
          meta = JSON.parse(fs.readFileSync(agentFile.replace(/\.jsonl$/, '.meta.json'), 'utf8'));
        } catch {
          // No meta file: the role falls to the verb and the model, both unknown, so `other`.
        }
        const entries = [];
        await eachEntry(agentFile, (entry) => entries.push(slim(entry)));
        records.push({ session, agentId: path.basename(agentFile, '.jsonl').replace(/^agent-/, ''), meta, entries });
      }
    }
  }
  return { sessions: usageOf(sessionEntries), calls, records };
}

const percent = (share) => (share === null ? '-' : `${Math.round(share * 100)}%`);
const zone = (offset) => `UTC${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;

function countLines(count, { from, to, offsetMinutes, folders, ms }) {
  const days = from === to ? `local day ${from}` : `local days ${from} to ${to}`;
  const lines = [`Sub-agents, ${days} (${zone(offsetMinutes)}), ${folders} record folder${folders === 1 ? '' : 's'}; Claude records only, Codex not counted`];
  const header = ['role', 'model', 'effort asked/ran', 'launches', 'input', 'cache write', 'cache read', 'output'];
  const table = count.rows.map((row) => [row.role, row.model ?? '-', `${row.effortAsked ?? '-'}/${row.effortRan ?? '-'}`, row.launches, row.input, row.cacheCreation, row.cacheRead, row.output].map(String));
  table.push(['total', '', '', count.total.launches, count.total.input, count.total.cacheCreation, count.total.cacheRead, count.total.output].map(String));
  const widths = header.map((title, i) => Math.max(title.length, ...table.map((row) => row[i].length)));
  const format = (row) => row.map((cell, i) => (i < 3 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  ').trimEnd();
  lines.push(format(header), ...table.map(format));
  const { share } = count;
  lines.push(`Their share of the day's tokens: input ${percent(share.input)}, cache write ${percent(share.cacheCreation)}, cache read ${percent(share.cacheRead)}, output ${percent(share.output)}`);
  lines.push(`Read as other: ${count.other}; effort or model inherited from the session: ${count.inherited}; call not found: ${count.callNotFound}`);
  lines.push(`Read in ${(ms / 1000).toFixed(1)} s`);
  return lines;
}

export async function subagentsMain(argv, env = process.env, deps = {}) {
  const {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    run = (command, args, options) => spawnSync(command, args, { encoding: 'utf8', ...options }),
    homedir = os.homedir,
    now = Date.now,
    offsetMinutes = -new Date().getTimezoneOffset(),
  } = deps;
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const started = now();
  const to = parsed.day ?? dayOf(new Date(started).toISOString(), offsetMinutes);
  const from = shiftDay(to, 1 - parsed.days);
  const folders = recordFolders({ cwd: path.resolve(parsed.cwd ?? defaultCwd), env, homedir, run });
  if (folders.length === 0) {
    stderr('no Claude Code records folder for this project');
    return 1;
  }
  const since = Date.parse(`${from}T00:00:00Z`) - offsetMinutes * 60_000;
  const inWindow = (timestamp) => {
    const day = typeof timestamp === 'string' ? dayOf(timestamp, offsetMinutes) : null;
    return day !== null && day >= from && day <= to;
  };
  const { sessions, calls, records } = await readRecords(folders, { since, inWindow });
  const launches = launchesOf(records, { from, to, offsetMinutes, calls });
  const count = countOf(launches, sessions);
  if (parsed.json) {
    stdout(JSON.stringify({ from, to, offsetMinutes, folders: folders.length, sessions, count, launches }, null, 2));
  } else {
    for (const line of countLines(count, { from, to, offsetMinutes, folders: folders.length, ms: now() - started })) stdout(line);
  }
  return 0;
}
