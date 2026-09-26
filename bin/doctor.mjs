#!/usr/bin/env node
// `doctor`: reports each stack tool's installed, configured and up-to-date state, and each gap's
// own fix command. Read-only and local-only — T1 has no network lookups, no cache and no `--hook`
// (those are T2/T3; see odd/tasks/stack-doctor.md). Exit code is always 0: this is a report, not
// a gate, and every probe underneath fails open into `unknown` rather than throwing.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { probeStack, resolveProjectRoot } from './lib/stack.mjs';

const GAP_STATES = new Set(['missing', 'outdated']);
const COLUMN_WIDTHS = [16, 10, 10, 10, 10];

function parseArgs(argv, env) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  return {
    home: get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir(),
    cwd: get('--cwd') ?? process.cwd(),
    json: argv.includes('--json'),
  };
}

/** The version column shows the version when a tool is `ok`, else its installed state itself
 * (`missing`/`unknown`) — so a gap in that dimension is visible without a separate column. */
function versionCell(row) {
  return row.installed === 'ok' ? row.version : row.installed;
}

function formatRow(row) {
  const cells = [row.id, versionCell(row), row.claude, row.codex, row.project];
  return cells.map((cell, i) => String(cell).padEnd(COLUMN_WIDTHS[i])).join('') + row.upToDate;
}

/** A row has a gap when any dimension is `missing` or `outdated` (T1 never produces the latter,
 * but the check is here once for T2 to inherit). `unknown` and `n/a` are not actionable the same
 * way, so they never trigger a fix command. */
function hasGap(row) {
  return [row.installed, row.claude, row.codex, row.project].some((state) => GAP_STATES.has(state));
}

export async function doctorMain(argv, env = process.env, deps = {}) {
  const { home, cwd, json } = parseArgs(argv, env);
  const spawn = deps.spawn ?? spawnSync;
  const platform = deps.platform ?? process.platform;
  const project = resolveProjectRoot(cwd, spawn);

  const rows = probeStack({ home, project, spawn, platform });

  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return 0;
  }

  for (const row of rows) console.log(formatRow(row));

  const gaps = rows.filter(hasGap);
  if (gaps.length > 0) {
    console.log('\nFix:');
    for (const row of gaps) console.log(`  ${row.id}: ${row.fix.join('; ')}`);
  }

  return 0;
}
