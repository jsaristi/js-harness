#!/usr/bin/env node
// `doctor`: reports each stack tool's installed, configured and up-to-date state, and each gap's
// own fix command, then whether the Claude CLI and the desktop app are signed into the same account
// and whether the remote server of every recorded login launcher is running
// (`checks` in bin/lib/stack.mjs). Local probes are read-only and synchronous; `upToDate` adds
// one round of latest-version lookups (bin/lib/latest.mjs) behind a 6h cache (bin/lib/cache.mjs) —
// see odd/tasks/stack-doctor.md. Exit code is always 0 for a normal report: this is a report, not
// a gate, and every probe underneath fails open into `unknown` rather than throwing. `--hook` (T3)
// is the one exception with its own, stricter contract — see `hookMain` below.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { probeStack, resolveProjectRoot, tools } from './lib/stack.mjs';
import { compareSemver } from './lib/version.mjs';
import { readCache, writeCache, isStale } from './lib/cache.mjs';
import { fetchLatestVersions, isLookupAttempted, isLocalSource, readLocalLatestVersions } from './lib/latest.mjs';
import { GAP_STATES, gapList, gapDigest } from './lib/digest.mjs';

const COLUMN_WIDTHS = [16, 10, 10, 10, 10];
const HEADER_LABELS = ['tool', 'version', 'claude', 'codex', 'project'];
const DIMENSIONS = ['installed', 'claude', 'codex', 'project', 'upToDate'];
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

/** The column header, aligned with `formatRow`'s widths the same way its own cells are. */
function headerRow() {
  return HEADER_LABELS.map((label, i) => label.padEnd(COLUMN_WIDTHS[i])).join('') + 'up to date';
}

/** Every `{ dimension, state, fix }` gap on one row: a dimension in one of `GAP_STATES` (`missing`,
 * `outdated`, `stale`, `mismatch`, `down`; the list is digest.mjs's, shared with the hook's digest and the
 * TUI); `unknown` and `n/a` are not actionable the same way. A gap with no fix command defined is
 * still a gap — `fix` is `null` — so `gaps` always agrees with the row states and the hook's digest. */
function rowGaps(row) {
  const gaps = [];
  for (const dimension of DIMENSIONS) {
    const state = row[dimension];
    if (GAP_STATES.has(state)) gaps.push({ dimension, state, fix: row.fix?.[dimension] ?? null });
  }
  return gaps;
}

/** context7 hosted has no version of its own to compare against npm, so it is never `outdated` —
 * always `n/a`. So is a row with nothing to install (`installed` is `n/a`: a check, the Claude
 * account one or the remote server one, not a tool): it has no version at all. Every other tool
 * compares its installed version against the fetched/cached latest, and is `unknown` whenever
 * either side is missing or unparseable (never `n/a`, since every other tool does have a
 * latest-version source). */
function computeUpToDate(row, latestVersion) {
  if (row.installed === 'n/a') return 'n/a';
  if (row.id === 'context7' && row.version === 'hosted') return 'n/a';
  if (row.installed !== 'ok' || !latestVersion) return 'unknown';
  return compareSemver(row.version, latestVersion) >= 0 ? 'ok' : 'outdated';
}

/** Resolves each row's latest version: from the cache alone in `--offline` mode or while it is
 * still fresh (checked within the last 6h), else refetched. A refetch is fail-open per tool: one
 * that could not be resolved this time keeps whatever was cached for it before (`null` if there
 * was nothing), so a partial outage never wipes out data that was fine an hour ago. Exported for
 * its own tests (R3-004 below needs a row set smaller than the real stack). */
export async function resolveLatestVersions(rows, deps) {
  // T6d (Codex P2): a latest version read from a local marketplace file is never taken from the
  // cache — it is read on every run, online or `--offline`, and overlaid on the cached or fetched
  // network versions. It is not written to the cache either, and (see `isLookupAttempted`) it never
  // counts as an attempted lookup below, so a local answer can neither hide an outage nor be stale.
  const local = readLocalLatestVersions(rows, { home: deps.home });
  const networkRows = rows.filter((row) => !isLocalSource(row));
  return { ...(await resolveNetworkVersions(networkRows, deps)), ...local };
}

/** The cache-backed half of `resolveLatestVersions`: every row here is a network lookup (or has no
 * source at all), served from the cache alone in `--offline` mode or while it is still fresh. */
async function resolveNetworkVersions(rows, { home, offline, fetch: fetchImpl, now }) {
  const cache = readCache(home);
  if (offline) return cache.latest.versions;
  // Codex P2 (accepted T6 review follow-up): a fresh cache that predates a row (no key for its id)
  // would leave that row `unknown` for up to 6h, so an online run refetches for it. A cached `null`
  // counts as present, so an outage — which stores `null` for what it could not resolve — never
  // retriggers this on every run.
  const predatesRow = rows.some((row) => isLookupAttempted(row) && !(row.id in cache.latest.versions));
  if (!isStale(cache.latest.checkedAt, now) && !predatesRow) return cache.latest.versions;

  // R3-004 (accepted T4 review follow-up): a row never even attempted (context7 hosted has no
  // version of its own to look up) is not a failure — only a row that was actually looked up and
  // still came back null counts as "attempted and failed" for the check below. R3-003 (accepted
  // final review follow-up, lineage review-cef5637e2884c12a): reuse latest.mjs's own
  // `isLookupAttempted` predicate here instead of re-deriving a second copy of the same rule — the
  // old inline copy only knew about context7 hosted, not about a row id with no registered source
  // at all, so it could drift from what `fetchLatestVersions` actually attempts.
  const attemptedIds = rows.filter(isLookupAttempted).map((r) => r.id);

  const fetched = await fetchLatestVersions(rows, { fetch: fetchImpl, home });
  const versions = { ...cache.latest.versions };
  let anySucceeded = false;
  for (const [id, version] of Object.entries(fetched)) {
    if (version !== null) {
      versions[id] = version;
      anySucceeded = true;
    } else if (!(id in versions)) {
      versions[id] = null;
    }
  }
  // R3-102 (accepted T2/T3 review follow-up): when every attempted lookup in this refetch failed
  // (e.g. no network at all), do not stamp checkedAt as "now" — that would make the cache read as
  // fresh for a full 6h and hide a real outage from the next run. The simplest fix is to leave
  // checkedAt exactly as it was: it was already stale enough to trigger this refetch, so the next
  // run's `isStale` check stays true and tries the network again immediately instead of waiting 6h.
  // R3-004 extends this: when nothing was attempted at all (an empty row set, or every row skipped
  // like a hosted-only context7), there was nothing to fail either, so the cache becomes fresh too
  // — otherwise a home with nothing left to check would stay "stale" and retry forever.
  const nothingAttempted = attemptedIds.length === 0;
  const checkedAt = anySucceeded || nothingAttempted ? new Date().toISOString() : cache.latest.checkedAt;
  writeCache(home, { ...cache, latest: { checkedAt, versions } });
  return versions;
}

/** Builds one full report: local probes plus `upToDate`, resolving latest versions per
 * `resolveLatestVersions`'s caching/offline rules above. Shared by the interactive report, the
 * hook, and (T5, `offline: true`) the TUI's stack block, so all three ever compute `upToDate` the
 * same way. `interactive` is set only by the interactive report: it lets `probeStack` run the checks
 * that start processes (see `interactiveOnly` in stack.mjs). */
export async function buildReport({ home, cwd, offline, interactive }, deps) {
  const spawn = deps.spawn ?? spawnSync;
  const platform = deps.platform ?? process.platform;
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now;
  const project = resolveProjectRoot(cwd, spawn);

  const localRows = probeStack({ home, project, spawn, platform, interactive });
  const latestVersions = await resolveLatestVersions(localRows, { home, offline, fetch: fetchImpl, now });
  return localRows.map((row) => {
    const latest = latestVersions[row.id];
    // A tool's fix can depend on the latest version (gentle-ai's, across a Go major).
    const upToDateFix = tools.find((tool) => tool.id === row.id)?.upToDateFix?.(row.version, latest);
    const fix = upToDateFix ? { ...row.fix, upToDate: upToDateFix } : row.fix;
    return { ...row, upToDate: computeUpToDate(row, latest), fix };
  });
}

export async function doctorMain(argv, env = process.env, deps = {}) {
  if (argv.includes('--hook')) return hookMain(argv, env, deps);

  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { home, cwd, json, offline } = parsed;
  const rows = await buildReport({ home, cwd, offline, interactive: true }, deps);

  if (json) {
    console.log(JSON.stringify(rows.map((row) => ({ ...row, gaps: rowGaps(row) })), null, 2));
    return 0;
  }

  console.log(headerRow());
  for (const row of rows) console.log(formatRow(row));

  const gapLines = rows.flatMap((row) => rowGaps(row).map((gap) => ({ id: row.id, ...gap })));
  if (gapLines.length > 0) {
    console.log('\nFix:');
    for (const gap of gapLines) {
      // A multi-step fix is a list of commands: the header line, then one indented command per line.
      if (Array.isArray(gap.fix)) {
        console.log(`  ${gap.id} (${gap.dimension}):`);
        for (const command of gap.fix) console.log(`    ${command}`);
      } else {
        console.log(`  ${gap.id} (${gap.dimension}): ${gap.fix ?? 'no fix command known'}`);
      }
    }
  }

  return 0;
}

/** `doctor --hook`: a `SessionStart` hook, at zero model tokens when nothing changed. Computes the
 * same report as the interactive command (network allowed only when the cache is stale), digests
 * its gap list, and prints exactly one `{"systemMessage": ...}` line only when gaps exist and that
 * digest differs from the last one stored — never plain text, never anything on stderr, and always
 * exit 0, even if something above throws: a `SessionStart` hook must never break a session. */
export async function hookMain(argv, env = process.env, deps = {}) {
  try {
    const { home, cwd } = parseArgs(argv, env);
    const rows = await buildReport({ home, cwd, offline: false }, deps);

    const gaps = gapList(rows);
    const digest = gapDigest(rows);
    const cache = readCache(home);
    const shouldNotify = gaps.length > 0 && digest !== cache.notified;
    writeCache(home, { ...cache, notified: digest });

    if (shouldNotify) {
      const plural = gaps.length === 1 ? '' : 's';
      console.log(
        JSON.stringify({ systemMessage: `js-harness: ${gaps.length} stack gap${plural} — run js-harness doctor` }),
      );
    }
  } catch {
    // Fail open: see the doc comment above — never a crash, never stderr, never non-zero.
  }
  return 0;
}
