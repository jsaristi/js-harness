#!/usr/bin/env node
// `audit`: per session of a day, the claims of its transcript that the transcript itself can check
// (odd/tasks/honesty-audit.md, T14): the hour a message to another session stamps against the hour it was sent,
// and the share of its context a session states against the share its reply records. It reads the Claude Code
// records of this project, the main checkout's and each worktree's, and prints no text of any message. Read-only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditEntries } from './lib/audit.mjs';
import { linesOf } from './lib/lines.mjs';
import { DEFAULT_CONTEXT_WINDOW } from './lib/sessions.mjs';
import { dayOf } from './lib/subagent-count.mjs';
import { recordFolders } from './subagents.mjs';

const USAGE = 'Usage: js-harness audit [--day YYYY-MM-DD] [--days <n>] [--json] [--cwd <dir>]';
// A day of this project's records is about 231 MB, every line of it read: a week is the most one run reads.
const MAX_DAYS = 7;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class AuditArgError extends Error {}

function parseArgs(argv) {
  const parsed = { days: 1, json: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new AuditArgError(`${token} requires a value`);
      i += 1;
      return next;
    };
    if (token === '--day') {
      parsed.day = value();
      // A day that does not come back as itself (2026-02-30 is read as March 2nd) is no date.
      const read = DAY_PATTERN.test(parsed.day) ? Date.parse(`${parsed.day}T00:00:00Z`) : NaN;
      if (Number.isNaN(read) || new Date(read).toISOString().slice(0, 10) !== parsed.day) throw new AuditArgError('--day takes a date as YYYY-MM-DD');
    } else if (token === '--days') {
      const raw = value();
      parsed.days = /^\d+$/.test(raw) ? Number(raw) : NaN;
      if (!(parsed.days >= 1 && parsed.days <= MAX_DAYS)) throw new AuditArgError(`--days takes a whole number from 1 to ${MAX_DAYS}`);
    } else if (token === '--json') {
      parsed.json = true;
    } else if (token === '--cwd') {
      parsed.cwd = value();
    } else {
      throw new AuditArgError(`unknown argument: ${token}`);
    }
  }
  return parsed;
}

/** `day` moved by `delta` days, both `YYYY-MM-DD`. */
const shiftDay = (day, delta) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);

/** The audit of the transcript `file`: its title and what `auditEntries` counts in its entries inside the window.
 * Streamed, and only the lines that can hold a reply or the title are parsed: a transcript runs to hundreds of
 * megabytes. A line that is not JSON is skipped. */
async function auditFile(file, { inWindow, offsetMinutes }) {
  let title = null;
  const items = [];
  let line = 0;
  for await (const text of linesOf(file)) {
    line += 1;
    const isTitle = text.includes('"custom-title"');
    // A get_usage read gives the session's window whatever its day: a read of the day before still holds.
    const isUsage = text.includes('contextWindow');
    if (!isTitle && !isUsage && !text.includes('"assistant"')) continue;
    let entry;
    try {
      entry = JSON.parse(text);
    } catch {
      continue;
    }
    if (isTitle && entry?.type === 'custom-title' && typeof entry.customTitle === 'string') title = entry.customTitle;
    else if ((entry?.type === 'assistant' && inWindow(entry.timestamp)) || (isUsage && entry?.type === 'user')) items.push({ entry, line });
  }
  return { title, ...auditEntries(items, { offsetMinutes }) };
}

/** The transcripts of `dir` that changed at or after `since` (ms). */
function recentTranscripts(dir, since) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(dir, name))
    .filter((file) => {
      try {
        return fs.statSync(file).mtimeMs >= since;
      } catch {
        return false;
      }
    });
}

const zone = (offset) => `UTC${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;

function auditLines(sessions, { from, to, offsetMinutes, folders, ms }) {
  const days = from === to ? `local day ${from}` : `local days ${from} to ${to}`;
  const lines = [`Audit, ${days} (${zone(offsetMinutes)}), ${folders} record folder${folders === 1 ? '' : 's'}: the hours messages stamp and the context shares sessions state, each against its transcript`];
  const header = ['session', 'title', 'messages', 'stamped', 'wrong hour', 'shares', 'wrong share'];
  const table = sessions.map((s) => [s.session.slice(0, 8), s.title ?? '(no title)', s.messages, s.stamped, s.wrongHours.length, s.shares, s.wrongShares.length].map(String));
  const sum = (pick) => sessions.reduce((total, s) => total + pick(s), 0);
  table.push(['total', '', sum((s) => s.messages), sum((s) => s.stamped), sum((s) => s.wrongHours.length), sum((s) => s.shares), sum((s) => s.wrongShares.length)].map(String));
  const widths = header.map((title, i) => Math.max(title.length, ...table.map((row) => row[i].length)));
  const format = (row) => row.map((cell, i) => (i < 2 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  ').trimEnd();
  lines.push(format(header), ...table.map(format));
  const hours = sessions.flatMap((s) => s.wrongHours.map((h) => `  ${s.session}:${h.line}  stamped ${h.stamped}, sent ${h.sent}`));
  if (hours.length > 0) lines.push('Wrong hours, more than a minute from the hour of sending (transcript:line):', ...hours);
  const shares = sessions.flatMap((s) => s.wrongShares.map((w) => `  ${s.session}:${w.line}  stated ${w.stated}%, recorded ${w.recorded}%`));
  if (shares.length > 0) lines.push('Wrong shares, more than 2 points from the share the reply records (transcript:line):', ...shares);
  const assumed = sessions.filter((s) => s.shares > 0 && !s.windowRead);
  if (assumed.length > 0) {
    const one = assumed.length === 1;
    lines.push(`${assumed.length} session${one ? '' : 's'} whose window no get_usage read gave: ${one ? 'its' : 'their'} shares are taken of ${DEFAULT_CONTEXT_WINDOW.toLocaleString('en-US')} tokens (${assumed.map((s) => s.session.slice(0, 8)).join(', ')})`);
  }
  lines.push(`Read in ${(ms / 1000).toFixed(1)} s`);
  return lines;
}

export async function auditMain(argv, env = process.env, deps = {}) {
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
    parsed = parseArgs(argv);
  } catch (err) {
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
    const day = typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp)) ? dayOf(timestamp, offsetAt(timestamp)) : null;
    return day !== null && day >= from && day <= to;
  };
  const zoneAt = offsetAt(`${to}T12:00:00.000Z`);
  const sessions = [];
  for (const folder of folders) {
    for (const file of recentTranscripts(folder, since)) {
      const audit = await auditFile(file, { inWindow, offsetMinutes: offsetAt });
      if (audit.messages > 0 || audit.shares > 0) sessions.push({ session: path.basename(file, '.jsonl'), ...audit });
    }
  }
  sessions.sort((a, b) => a.session.localeCompare(b.session));
  if (parsed.json) {
    stdout(JSON.stringify({ from, to, offsetMinutes: zoneAt, folders: folders.length, sessions }, null, 2));
  } else {
    for (const line of auditLines(sessions, { from, to, offsetMinutes: zoneAt, folders: folders.length, ms: now() - started })) stdout(line);
  }
  return 0;
}
