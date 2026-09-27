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

function parseArgs(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? requireValue(argv, i, flag) : undefined;
  };
  return {
    cwd: get('--cwd'),
    json: argv.includes('--json'),
  };
}

function toRepoRelative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

/** `docs/ROADMAP.md` under `root`, parsed into `{ path, done, total, phases }` — `null` when the
 * file does not exist, since a missing roadmap is not an error (odd/tasks/progress-view.md). */
function readRoadmap(root) {
  const absolute = path.join(root, 'docs', 'ROADMAP.md');
  if (!fs.existsSync(absolute)) return null;
  const { phases, done, total } = parseRoadmap(fs.readFileSync(absolute, 'utf8'));
  return { path: toRepoRelative(root, absolute), done, total, phases };
}

/** Every `odd/tasks/*.md` under `root`, sorted by filename, as `{ id, title, path, done, total,
 * steps }` — `[]` when the directory does not exist, since a missing `odd/tasks/` is not an error. */
function readFeatures(root) {
  const dir = path.join(root, 'odd', 'tasks');
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .sort();
  return files.map((file) => {
    const absolute = path.join(dir, file);
    const id = file.slice(0, -'.md'.length);
    const { title, done, total, steps } = parseFeature(fs.readFileSync(absolute, 'utf8'), id);
    return { id, title, path: toRepoRelative(root, absolute), done, total, steps };
  });
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

export async function progressMain(argv, { cwd: defaultCwd = process.cwd(), stdout = console.log, stderr = console.error } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  const root = path.resolve(parsed.cwd ?? defaultCwd);
  const roadmap = readRoadmap(root);
  const features = readFeatures(root);

  if (!roadmap && features.length === 0) {
    stderr(`js-harness progress: no docs/ROADMAP.md or odd/tasks/*.md under ${root}`);
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
