#!/usr/bin/env node
// `subagents`: the count of a day's sub-agents by role, model and effort, with their tokens and the share of
// the day's tokens they took (odd/tasks/effort-by-task.md, S3). It reads the Claude Code records of this
// project, the main checkout's and each worktree's, and keeps no text of any message. Zero dependencies.
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { countOf, dayOf, launchesOf } from '../../bin/lib/subagent-count.mjs';
import { readRecords, recordFolders } from '../../bin/lib/subagent-records.mjs';
import { parseDayArgs, shiftDay, zone } from '../../bin/lib/record-days.mjs';

class SubagentsArgError extends Error {}

export const USAGE = 'Usage: node workshop/js-harness-workshop.mjs subagents [--day YYYY-MM-DD] [--days <n>] [--json] [--cwd <dir>]';

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
