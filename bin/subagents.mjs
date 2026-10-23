#!/usr/bin/env node
// `subagents`: the count of a day's sub-agents by role, model and effort, with their tokens and the share of
// the day's tokens they took (odd/tasks/effort-by-task.md, S3). It reads the Claude Code records of this
// project, the main checkout's and each worktree's, and keeps no text of any message. Zero dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { callsOf, countOf, dayOf, launchesOf, usageOf } from './lib/subagent-count.mjs';
import { linesOf } from './lib/lines.mjs';
import { mainCheckout, parseWorktreeList, projectSlug } from './lib/sessions.mjs';
import { parseDayArgs, shiftDay, zone } from './lib/record-days.mjs';

class SubagentsArgError extends Error {}

export const USAGE = 'Usage: js-harness subagents [--day YYYY-MM-DD] [--days <n>] [--json] [--cwd <dir>]';

/** The records folders of this project: the main checkout's and each worktree's, as Claude Code names them
 * under `<config>/projects`, the ones that can be listed. */
export function recordFolders({ cwd, env, homedir, run }) {
  const main = mainCheckout(run, cwd);
  const listed = run('git', ['worktree', 'list', '--porcelain'], { cwd: main, encoding: 'utf8' });
  const trees = listed.error || listed.status !== 0 ? [] : parseWorktreeList(listed.stdout).map((tree) => tree.path);
  const root = path.join(env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'), 'projects');
  const slugs = [...new Set([main, ...trees].map((folder) => projectSlug(path.resolve(folder))))];
  return slugs.map((slug) => path.join(root, slug)).filter((dir) => {
    try {
      fs.readdirSync(dir);
      return true;
    } catch {
      return false;
    }
  });
}

/** Each line of `file` parsed, handed to `keep`; a line that is not JSON is skipped. Streamed: a session's
 * record can be hundreds of megabytes. */
async function eachEntry(file, keep) {
  for await (const line of linesOf(file)) {
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
export async function readRecords(folders, { since, inWindow }) {
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
  lines.push(`Read as other: ${count.other}; effort or model inherited from the session: ${count.inherited}; call not found: ${count.callNotFound}; carried over from the day before: ${count.carried}`);
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
    offsetMinutes = (timestamp) => -new Date(timestamp).getTimezoneOffset(),
  } = deps;
  let parsed;
  try {
    parsed = parseDayArgs(argv, SubagentsArgError);
  } catch (err) {
    if (!(err instanceof SubagentsArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  // The offset at each timestamp, not today's: a day before a clock change has another one (Codex, 2026-10-15).
  const offsetAt = typeof offsetMinutes === 'function' ? offsetMinutes : () => offsetMinutes;
  const started = now();
  const startedAt = new Date(started).toISOString();
  const to = parsed.day ?? dayOf(startedAt, offsetAt(startedAt));
  const from = shiftDay(to, 1 - parsed.days);
  const folders = recordFolders({ cwd: path.resolve(parsed.cwd ?? defaultCwd), env, homedir, run });
  if (folders.length === 0) {
    stderr('no Claude Code records folder for this project');
    return 1;
  }
  // Files changed before the first day's start are left unread; a day's margin covers any offset.
  const since = Date.parse(`${from}T00:00:00Z`) - 86_400_000;
  const inWindow = (timestamp) => {
    const day = typeof timestamp === 'string' ? dayOf(timestamp, offsetAt(timestamp)) : null;
    return day !== null && day >= from && day <= to;
  };
  const zoneAt = offsetAt(`${to}T12:00:00.000Z`);
  const { sessions, calls, records } = await readRecords(folders, { since, inWindow });
  const launches = launchesOf(records, { from, to, offsetMinutes: offsetAt, calls });
  const count = countOf(launches, sessions);
  if (parsed.json) {
    stdout(JSON.stringify({ from, to, offsetMinutes: zoneAt, folders: folders.length, sessions, count, launches }, null, 2));
  } else {
    for (const line of countLines(count, { from, to, offsetMinutes: zoneAt, folders: folders.length, ms: now() - started })) stdout(line);
  }
  return 0;
}
