#!/usr/bin/env node
// `progress`: reads a project's docs/ROADMAP.md and odd/tasks/*.md and reports every roadmap phase
// and feature with its checked and pending steps, a percentage, and what remains — counted from
// checkboxes, and the rows of a feature's task table, by bin/lib/progress.mjs, never reinterpreted by a model. See
// odd/tasks/progress-view.md. Read-only, zero dependencies; `--json` gives the same data so
// Claude Desktop and mobile can render it as an inline widget on request.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseRoadmap, parseFeature } from './lib/progress.mjs';
import { PACE_DAYS, PACE_REF_ARGS, paceLines, paceLogArgs, paceOf, paceRef, parsePaceLog, windowStart } from './lib/progress-pace.mjs';

export const USAGE = [
  'Usage: js-harness progress [--cwd <path>] [--json] [--pace [--days <n>]]',
  `  --pace  the tasks closed, reopened, added and removed on each of the last ${PACE_DAYS} days (or --days), read`,
  '          from the first-parent line of the default branch: origin/HEAD, else main, else HEAD. A task is',
  '          matched by its ID (T3); a task reworded without an ID, or in a moved file, counts as removed and added.',
].join('\n');

// How long each git process of `--pace` may run, and how much it may print: the whole history of this
// repository came to about 16 MB of file content (S6 of odd/tasks/read-from-records.md).
const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_BUFFER = 256 * 1024 * 1024;

// R3-003-style (doctor's own rule, see bin/doctor.mjs): a flag with no value (end of argv, or
// immediately followed by another `--flag`) is a usage error, not a silently-swallowed token.
class ProgressArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new ProgressArgError(`${flag} requires a value`);
  return value;
}

// R3-unknown-args-ignored (accepted review follow-up): walk argv token by token instead of probing
// for known flags by name — `indexOf('--cwd')` alone silently accepted an unknown flag, a
// positional argument, or `--cwd=value` (never equal to the literal token `--cwd`) by simply never
// finding them. Any token that is not exactly `--cwd <value>` or `--json` is now a usage error.
function parseArgs(argv) {
  let cwd;
  let json = false;
  let pace = false;
  let days;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--cwd') {
      cwd = requireValue(argv, i, token);
      i += 1; // consume the value too, so it is never re-read as its own token
      continue;
    }
    if (token === '--json') {
      json = true;
      continue;
    }
    if (token === '--pace') {
      pace = true;
      continue;
    }
    if (token === '--days') {
      const value = requireValue(argv, i, token);
      if (!/^\d+$/.test(value) || Number(value) < 1) throw new ProgressArgError(`--days takes a whole number of at least 1, not ${value}`);
      days = Number(value);
      i += 1;
      continue;
    }
    throw new ProgressArgError(`unknown argument: ${token}`);
  }
  if (days !== undefined && !pace) throw new ProgressArgError('--days counts the days of --pace, which was not given');
  return { cwd, json, pace, days: days ?? PACE_DAYS };
}

/** Runs one git process of `--pace` in `root`: `{ stdout }`, or `{ error }`, the one line that says why not. */
function gitRead(spawn, root, args) {
  const result = spawn('git', args, { cwd: root, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER, windowsHide: true });
  const name = `git ${args.find((arg) => !arg.startsWith('-') && !arg.includes('='))}`;
  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') return { error: `${name} took longer than ${GIT_TIMEOUT_MS / 1000} s` };
    if (result.error.code === 'ENOBUFS') return { error: `${name} printed more than ${GIT_MAX_BUFFER / 1024 / 1024} MiB` };
    return { error: `${name}: ${result.error.message}` };
  }
  if (result.status !== 0) {
    const said = String(result.stderr ?? '').trim().split('\n')[0];
    if (/not a git repository/.test(said)) return { error: `--pace reads the history of a git repository, and ${root} is in none` };
    return { error: `${name}: ${said || `exit ${result.status}`}` };
  }
  return { stdout: String(result.stdout) };
}

/** `progress --pace`: two git processes, the branch and then its history, and the pace printed from them. Exits
 * 1 with one line when either cannot run. A time is cut by `now`, in this machine's time zone. */
function paceMain(root, parsed, { stdout, stderr, spawn, now }) {
  const named = gitRead(spawn, root, PACE_REF_ARGS);
  if (named.error) {
    stderr(`js-harness progress: ${named.error}`);
    return 1;
  }
  const { ref, name } = paceRef(named.stdout);
  const at = now();
  const since = windowStart(at, parsed.days).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const log = gitRead(spawn, root, paceLogArgs({ ref, since }));
  if (log.error) {
    stderr(`js-harness progress: ${log.error}`);
    return 1;
  }
  const pace = paceOf({ commits: parsePaceLog(log.stdout), now: at, days: parsed.days });
  if (parsed.json) {
    stdout(JSON.stringify({ root, branch: name, ref, ...pace }, null, 2));
    return 0;
  }
  for (const line of paceLines({ branch: name, ...pace })) stdout(line);
  return 0;
}

function toRepoRelative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

/** Reads one source file for `readRoadmap`/`readFeatures` — R3-unreadable-entry-crash (accepted
 * review follow-up): a read error (permissions, a race with something deleting the file, ...)
 * must not throw out of `progressMain`. It is reported as one line on `stderr` naming the
 * repo-relative path and the error's code, and the source is treated as skipped (`null`), the same
 * as if it had never existed. */
function tryReadFile(absolute, relative, readFile, stderr) {
  try {
    return readFile(absolute);
  } catch (err) {
    stderr(`js-harness progress: ${relative}: ${err.code ?? err.message}`);
    return null;
  }
}

/** `docs/ROADMAP.md` under `root`, parsed into `{ path, done, total, phases }` — `null` when the
 * file does not exist (a missing roadmap is not an error, odd/tasks/progress-view.md), when it is
 * not a regular file (e.g. a directory at that path), or when reading it fails (see
 * `tryReadFile` above). R3-unreadable-tasks-dir-silent (accepted review follow-up, Codex P2): only
 * `ENOENT` means "genuinely absent" and stays silent — any other `stat` failure (`EACCES`,
 * `ENOTDIR`, ...) is a real discovery error and is reported on stderr, not treated the same as "no
 * roadmap here". */
function readRoadmap(root, readFile, stat, stderr) {
  const absolute = path.join(root, 'docs', 'ROADMAP.md');
  let info;
  try {
    info = stat(absolute);
  } catch (err) {
    if (err.code !== 'ENOENT') stderr(`js-harness progress: docs/ROADMAP.md: ${err.code ?? err.message}`);
    return null;
  }
  if (!info.isFile()) return null;
  const relative = toRepoRelative(root, absolute);
  const markdown = tryReadFile(absolute, relative, readFile, stderr);
  if (markdown === null) return null;
  const { phases, done, total } = parseRoadmap(markdown);
  return { path: relative, done, total, phases };
}

/** Every `odd/tasks/*.md` under `root`, sorted by filename, as `{ id, title, path, done, total,
 * steps }` — `[]` when the directory does not exist (`ENOENT`; a missing `odd/tasks/` is not an
 * error). Any other `readdirSync` failure (R3-unreadable-tasks-dir-silent, Codex P2) is reported on
 * stderr instead of being treated the same as "there is no odd/tasks here". Only a regular file, or
 * a symlink whose target is one, counts as a feature doc (R3-unreadable-entry-crash /
 * R3-symlinked-feature-dropped): a directory named `x.md` is skipped silently, but a *symlinked*
 * `x.md` — dropped entirely by a T2b regression that filtered on `Dirent.isFile()` alone, which
 * reflects the link itself, never its target — is now followed, and a dangling one is reported and
 * skipped exactly like any other unreadable source. */
function readFeatures(root, readFile, readdir, stat, stderr) {
  const dir = path.join(root, 'odd', 'tasks');
  let entries;
  try {
    entries = readdir(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') stderr(`js-harness progress: odd/tasks: ${err.code ?? err.message}`);
    return [];
  }

  const mdEntries = entries
    .filter((entry) => entry.name.endsWith('.md'))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const features = [];
  for (const entry of mdEntries) {
    const absolute = path.join(dir, entry.name);
    const relative = toRepoRelative(root, absolute);

    if (!entry.isFile()) {
      if (!entry.isSymbolicLink()) continue; // e.g. a directory named `x.md` — never a feature doc
      let target;
      try {
        target = stat(absolute);
      } catch (err) {
        stderr(`js-harness progress: ${relative}: ${err.code ?? err.message}`);
        continue;
      }
      if (!target.isFile()) continue;
    }

    const markdown = tryReadFile(absolute, relative, readFile, stderr);
    if (markdown === null) continue;
    const id = entry.name.slice(0, -'.md'.length);
    const { title, done, total, steps } = parseFeature(markdown, id);
    features.push({ id, title, path: relative, done, total, steps });
  }
  return features;
}

/** `—` for a group with nothing to count (`total: 0` means no steps, never 100%), else a rounded
 * whole-number percentage. */
function formatPercent(done, total) {
  if (total === 0) return '—';
  return `${Math.round((done / total) * 100)}%`;
}

/** `[x]` only when every step is done and there is at least one; `[ ]` otherwise (including 0/0,
 * which is not "done", just empty). */
function marker(done, total) {
  return done === total && total > 0 ? '[x]' : '[ ]';
}

/** One totals line for a section: `<label>  [<path>  ]<done>/<total>  <percentage>` — matches
 * `Roadmap  docs/ROADMAP.md  7/20  35%` and, with no path, `Features  12/14  86%`. */
function sectionHeader(label, sectionPath, done, total) {
  const parts = sectionPath ? [label, sectionPath] : [label];
  parts.push(`${done}/${total}`, formatPercent(done, total));
  return parts.join('  ');
}

/** One phase/feature's own line, plus its pending steps when it is not fully done. The row prefix
 * (`  ` + a 3-char marker + ` `) is exactly 6 columns, so a pending step's `      - <text>` lines up
 * under the title that starts the line above it. */
function groupLines(group, titleWidth) {
  const lines = [`  ${marker(group.done, group.total)} ${group.title.padEnd(titleWidth)}${group.done}/${group.total}  ${formatPercent(group.done, group.total)}`];
  if (!(group.done === group.total && group.total > 0)) {
    for (const step of group.steps) {
      if (!step.done) lines.push(`      - ${step.text}`);
    }
  }
  return lines;
}

function renderText(data) {
  const lines = [];
  const titled = [...(data.roadmap?.phases ?? []), ...data.features];
  const titleWidth = titled.reduce((max, group) => Math.max(max, group.title.length), 0) + 2;

  if (data.roadmap) {
    lines.push(sectionHeader('Roadmap', data.roadmap.path, data.roadmap.done, data.roadmap.total));
    for (const phase of data.roadmap.phases) lines.push(...groupLines(phase, titleWidth));
    lines.push('');
  }

  if (data.features.length > 0) {
    const featuresDone = data.features.reduce((sum, f) => sum + f.done, 0);
    const featuresTotal = data.features.reduce((sum, f) => sum + f.total, 0);
    lines.push(sectionHeader('Features', null, featuresDone, featuresTotal));
    for (const feature of data.features) lines.push(...groupLines(feature, titleWidth));
    lines.push('');
  }

  lines.push(`Total  ${data.done}/${data.total}  ${formatPercent(data.done, data.total)}`);
  return lines;
}

export async function progressMain(
  argv,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    // Injectable so tests can exercise a read/discovery error (R3-unreadable-entry-crash,
    // R3-unreadable-tasks-dir-silent) without depending on OS-specific permission bits; real runs
    // default to plain `fs` calls.
    readFile = (absolute) => fs.readFileSync(absolute, 'utf8'),
    stat = (absolute) => fs.statSync(absolute),
    readdir = (absolute) => fs.readdirSync(absolute, { withFileTypes: true }),
    // `--pace` alone runs git, and cuts its days by the clock; both injectable for its tests.
    spawn = spawnSync,
    now = () => new Date(),
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  const root = path.resolve(parsed.cwd ?? defaultCwd);
  if (parsed.pace) return paceMain(root, parsed, { stdout, stderr, spawn, now });
  // Tracks whether any real discovery/read error was reported (as opposed to a source that is
  // simply, silently absent), so the exit-1 message below never claims "no docs/ROADMAP.md or
  // odd/tasks/*.md" when one of them exists but failed to read.
  let errorReported = false;
  const reportError = (line) => {
    errorReported = true;
    stderr(line);
  };
  const roadmap = readRoadmap(root, readFile, stat, reportError);
  const features = readFeatures(root, readFile, readdir, stat, reportError);

  if (!roadmap && features.length === 0) {
    stderr(
      errorReported
        ? `js-harness progress: nothing could be read under ${root}`
        : `js-harness progress: no docs/ROADMAP.md or odd/tasks/*.md under ${root}`,
    );
    return 1;
  }

  const featuresDone = features.reduce((sum, f) => sum + f.done, 0);
  const featuresTotal = features.reduce((sum, f) => sum + f.total, 0);
  const done = (roadmap?.done ?? 0) + featuresDone;
  const total = (roadmap?.total ?? 0) + featuresTotal;
  const data = { root, roadmap, features, done, total };

  if (parsed.json) {
    stdout(JSON.stringify(data, null, 2));
    return 0;
  }

  for (const line of renderText(data)) stdout(line);
  return 0;
}
