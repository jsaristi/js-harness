#!/usr/bin/env node
// `progress`: reads a project's docs/ROADMAP.md and odd/tasks/*.md and reports every roadmap phase
// and feature with its checked and pending steps, a percentage, and what remains — counted from
// checkboxes by bin/lib/progress.mjs, never reinterpreted by a model. See
// odd/tasks/progress-view.md. Read-only, zero dependencies; `--json` gives the same data so
// Claude Desktop and mobile can render it as an inline widget on request.
import fs from 'node:fs';
import path from 'node:path';
import { parseRoadmap, parseFeature } from './lib/progress.mjs';

const USAGE = 'Usage: js-harness progress [--cwd <path>] [--json]';

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
    throw new ProgressArgError(`unknown argument: ${token}`);
  }
  return { cwd, json };
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
