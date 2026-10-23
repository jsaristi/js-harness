#!/usr/bin/env node
// Finds the shipped protocols whose review date has passed (odd/tasks/launch-audit.md, S5d):
//
//   node scripts/audit-expiry.mjs [--today <YYYY-MM-DD>] [--allow <file>] [--json] [--cwd <repo>]
//
// A protocol of the installed skills ends its cost line with "Reviewed by <date>" (bin/lib/protocols-skill.mjs): the
// day by which someone reads it again and keeps it, changes it or drops it. Nothing else holds that date, so a passed
// one is a protocol nobody reviewed. The files read are the shipped ones, every tracked `bin/**/*.mjs` that is not a
// test or a test kit; a date before `--today` (default: the local date) is a finding of kind `expired`.
//
// The allow-list (`--allow`, default odd/tasks/launch-audit/allow/expiry.json, an array of { kind, location, why })
// hides a finding by its kind and location; an entry that hides nothing is itself a finding, `stale-allow`.
// Exit 0: no finding beyond the allow-list. Exit 1: findings. Exit 2: a usage error.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const USAGE = 'Usage: node scripts/audit-expiry.mjs [--today <YYYY-MM-DD>] [--allow <file>] [--json] [--cwd <repo>]';
const DAY = 24 * 60 * 60 * 1000;

class ExpiryArgError extends Error {}

export function parseArgs(argv) {
  const parsed = { today: null, allow: null, json: false, cwd: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--json') parsed.json = true;
    else if (token === '--today' || token === '--allow' || token === '--cwd') {
      const value = argv[i + 1];
      if (value === undefined) throw new ExpiryArgError(`${token} needs a value`);
      parsed[token.slice(2)] = value;
      i += 1;
    } else throw new ExpiryArgError(`unknown argument: ${token}`);
  }
  if (parsed.today !== null && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.today)) throw new ExpiryArgError('--today takes a date as YYYY-MM-DD');
  return parsed;
}

/** Each "Reviewed by <YYYY-MM-DD>" of `text`, as `{ line, date }` (lines counted from 1). */
export function reviewDates(text) {
  const found = [];
  text.split(/\r?\n/).forEach((one, index) => {
    for (const [, date] of one.matchAll(/Reviewed by (\d{4}-\d{2}-\d{2})/g)) found.push({ line: index + 1, date });
  });
  return found;
}

/** The findings of `files` ({ path, text }) on `today`: one `expired` for each review date before it. */
export function expiryFindings(files, today) {
  const findings = [];
  for (const { path: file, text } of files) {
    for (const { line, date } of reviewDates(text)) {
      if (date >= today) continue;
      const days = Math.round((Date.parse(today) - Date.parse(date)) / DAY);
      findings.push({ kind: 'expired', location: `${file}:${line}`, detail: `reviewed by ${date}, ${days} ${days === 1 ? 'day' : 'days'} before ${today}` });
    }
  }
  return findings;
}

/** Splits `findings` by `allow` ({ kind, location, why }): the ones no entry hides, then a `stale-allow` finding for
 * each entry that hid nothing, and the count hidden. */
export function applyAllow(findings, allow) {
  const used = new Set();
  const kept = findings.filter((finding) => {
    const index = allow.findIndex((entry) => entry.kind === finding.kind && entry.location === finding.location);
    if (index === -1) return true;
    used.add(index);
    return false;
  });
  const stale = allow
    .filter((_, index) => !used.has(index))
    .map((entry) => ({ kind: 'stale-allow', location: entry.location, detail: `no ${entry.kind} finding at this location (${entry.why})` }));
  return { findings: [...kept, ...stale], allowed: findings.length - kept.length };
}

/** The allow-list of `file` as `{ entries }`, or `{ error }`: a missing default is an empty list, but a file named on
 * the command line must be there, and any list must be an array of `{ kind, location, why }` strings, since one read
 * wrong would hide nothing and pass. */
function readAllow(file, named) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' && !named) return { entries: [] };
    return { error: `cannot read the allow-list ${file}: ${err.code ?? err.message}` };
  }
  let entries;
  try {
    entries = JSON.parse(text);
  } catch {
    entries = null;
  }
  const shaped = Array.isArray(entries) && entries.every((entry) => entry && ['kind', 'location', 'why'].every((key) => typeof entry[key] === 'string'));
  return shaped ? { entries } : { error: `the allow-list ${file} is not a JSON array of { kind, location, why }` };
}

const localDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${err.message}\n${USAGE}\n`);
    return 2;
  }
  const cwd = path.resolve(parsed.cwd ?? '.');
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  if (top.status !== 0) {
    process.stderr.write(`not a git repository: ${cwd}\n`);
    return 2;
  }
  const root = top.stdout.trim();
  const listed = spawnSync('git', ['ls-files', '-z', '--', 'bin'], { cwd: root, encoding: 'utf8' }).stdout.split('\0');
  const files = listed
    .filter((file) => file.endsWith('.mjs') && !/\.test(kit)?\.mjs$/.test(file))
    .map((file) => ({ path: file, text: fs.readFileSync(path.join(root, file), 'utf8') }));
  const allowFile = parsed.allow ? path.resolve(cwd, parsed.allow) : path.join(root, 'odd/tasks/launch-audit/allow/expiry.json');
  const allow = readAllow(allowFile, parsed.allow !== null);
  if (allow.error) {
    process.stderr.write(`${allow.error}\n`);
    return 2;
  }
  const { findings, allowed } = applyAllow(expiryFindings(files, parsed.today ?? localDate()), allow.entries);
  if (parsed.json) process.stdout.write(`${JSON.stringify({ findings, allowed })}\n`);
  else {
    for (const { kind, location, detail } of findings) process.stdout.write(`${kind}  ${location}  ${detail}\n`);
    process.stdout.write(`${findings.length} findings, ${allowed} allowed\n`);
  }
  return findings.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
