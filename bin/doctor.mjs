#!/usr/bin/env node
// `doctor`: reports each stack tool's installed, configured and up-to-date state, and each gap's
// own fix command. Local probes are read-only and synchronous (bin/lib/stack.mjs); `upToDate` adds
// one round of latest-version lookups (bin/lib/latest.mjs) behind a 6h cache (bin/lib/cache.mjs) —
// see odd/tasks/stack-doctor.md. Exit code is always 0 for a normal report: this is a report, not
// a gate, and every probe underneath fails open into `unknown` rather than throwing. `--hook` (T3)
// is the one exception with its own, stricter contract — see `hookMain` below.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { probeStack, resolveProjectRoot } from './lib/stack.mjs';
import { compareSemver } from './lib/version.mjs';
import { readCache, writeCache, isStale } from './lib/cache.mjs';
import { fetchLatestVersions } from './lib/latest.mjs';

const GAP_STATES = new Set(['missing', 'outdated']);
const COLUMN_WIDTHS = [16, 10, 10, 10, 10];
const USAGE = 'Usage: js-harness doctor [--home <path>] [--cwd <path>] [--json] [--offline] [--hook]';

// R3-003 (accepted T1 review follow-up): a flag with no value (end of argv, or immediately
// followed by another `--flag`) is a usage error, not a silently-swallowed token.
class DoctorArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new DoctorArgError(`${flag} requires a value`);
  return value;
}

function parseArgs(argv, env) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? requireValue(argv, i, flag) : undefined;
  };
  return {
    home: get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir(),
    cwd: get('--cwd') ?? process.cwd(),
    json: argv.includes('--json'),
    offline: argv.includes('--offline'),
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

/** A row has a gap when any dimension — including `upToDate` — is `missing` or `outdated`.
 * `unknown` and `n/a` are not actionable the same way, so they never trigger a fix command. */
function hasGap(row) {
  return [row.installed, row.claude, row.codex, row.project, row.upToDate].some((state) => GAP_STATES.has(state));
}

/** context7 hosted has no version of its own to compare against npm, so it is never `outdated` —
 * always `n/a`. Every other tool compares its installed version against the fetched/cached latest,
 * and is `unknown` whenever either side is missing or unparseable (never `n/a`, since every other
 * tool does have a latest-version source). */
function computeUpToDate(row, latestVersion) {
  if (row.id === 'context7' && row.version === 'hosted') return 'n/a';
  if (row.installed !== 'ok' || !latestVersion) return 'unknown';
  return compareSemver(row.version, latestVersion) >= 0 ? 'ok' : 'outdated';
}

/** Resolves each row's latest version: from the cache alone in `--offline` mode or while it is
 * still fresh (checked within the last 6h), else refetched. A refetch is fail-open per tool: one
 * that could not be resolved this time keeps whatever was cached for it before (`null` if there
 * was nothing), so a partial outage never wipes out data that was fine an hour ago. */
async function resolveLatestVersions(rows, { home, offline, fetch: fetchImpl, now }) {
  const cache = readCache(home);
  if (offline || !isStale(cache.latest.checkedAt, now)) return cache.latest.versions;

  const fetched = await fetchLatestVersions(rows, { fetch: fetchImpl, home });
  const versions = { ...cache.latest.versions };
  for (const [id, version] of Object.entries(fetched)) {
    if (version !== null) versions[id] = version;
    else if (!(id in versions)) versions[id] = null;
  }
  writeCache(home, { ...cache, latest: { checkedAt: new Date().toISOString(), versions } });
  return versions;
}

export async function doctorMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { home, cwd, json, offline } = parsed;
  const spawn = deps.spawn ?? spawnSync;
  const platform = deps.platform ?? process.platform;
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now;
  const project = resolveProjectRoot(cwd, spawn);

  const localRows = probeStack({ home, project, spawn, platform });
  const latestVersions = await resolveLatestVersions(localRows, { home, offline, fetch: fetchImpl, now });
  const rows = localRows.map((row) => ({ ...row, upToDate: computeUpToDate(row, latestVersions[row.id]) }));

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
