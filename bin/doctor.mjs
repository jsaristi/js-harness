#!/usr/bin/env node
// `doctor`: reports each stack tool's installed, configured and up-to-date state, and each gap's
// own fix command, then whether the Claude CLI and the desktop app are signed into the same account
// and whether the remote server of every recorded login launcher is running
// (`checks` in bin/lib/stack.mjs). Local probes are read-only and synchronous; `upToDate` adds
// one round of latest-version lookups (bin/lib/latest.mjs) behind a 6h cache (bin/lib/cache.mjs) —
// see odd/tasks/stack-doctor.md. Exit code is always 0 for a normal report: this is a report, not
// a gate, and every probe underneath fails open into `unknown` rather than throwing. `--hook` (T3)
// is the one exception with its own, stricter contract — see `hookMain` below.
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { probeStack, probeVersionCommand, resolveProjectRoot, tools } from './lib/stack.mjs';
import { stackNotice, stackUpdateRow, stackVersions } from './lib/stack-update.mjs';
import { functionsOf, gitIn, harnessOfTree, workingTree } from './lib/project-functions.mjs';
import { compareSemver } from './lib/version.mjs';
import { readCache, writeCache, isStale } from './lib/cache.mjs';
import { fetchLatestVersions, isLookupAttempted, isLocalSource, readLocalLatestVersions } from './lib/latest.mjs';
import { GAP_STATES, gapList, gapDigest } from './lib/digest.mjs';
import { unknownArgument } from './lib/args.mjs';
import { hostNotice, hostUpdateRow, readHostVersions } from './lib/host-update.mjs';
import { claudeMdSnapshots, gentleAiNotice, gentleAiUpdateRow } from './lib/gentle-ai-update.mjs';

const COLUMN_WIDTHS = [16, 10, 10, 10, 10];
const HEADER_LABELS = ['tool', 'version', 'claude', 'codex', 'project'];
const DIMENSIONS = ['installed', 'claude', 'codex', 'project', 'upToDate'];
const USAGE = 'Usage: js-harness doctor [--home <path>] [--cwd <path>] [--json] [--offline] [--hook] [--host-reviewed] [--gentle-ai-reviewed] [--stack-reviewed]';

// R3-003 (accepted T1 review follow-up): a flag with no value (end of argv, or immediately
// followed by another `--flag`) is a usage error, not a silently-swallowed token.
class DoctorArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new DoctorArgError(`${flag} requires a value`);
  return value;
}

// Every flag `doctor` takes, for `unknownArgument`: a flag it does not know is refused before the
// report, which writes its cache under the home (T1 of odd/tasks/commands-and-doctor.md).
const KNOWN = { valued: ['--home', '--cwd'], bare: ['--json', '--offline', '--hook', '--host-reviewed', '--gentle-ai-reviewed', '--stack-reviewed'] };

function parseArgs(argv, env) {
  const unknown = unknownArgument(argv, KNOWN);
  if (unknown !== null) throw new DoctorArgError(`unknown argument: ${unknown}`);
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
  // The project's switches, resolved once for every row: the Codex row is shown only while codexReview is not off.
  const { resolved: functions } = functionsOf(harnessOfTree(project), workingTree(gitIn(project, spawn)));

  const localRows = probeStack({ home, project, spawn, platform, interactive, functions });
  const latestVersions = await resolveLatestVersions(localRows, { home, offline, fetch: fetchImpl, now });
  const rows = localRows.map((row) => {
    const latest = latestVersions[row.id];
    // A tool's fix can depend on the latest version (gentle-ai's, across a Go major).
    const upToDateFix = tools.find((tool) => tool.id === row.id)?.upToDateFix?.(row.version, latest);
    const fix = upToDateFix ? { ...row.fix, upToDate: upToDateFix } : row.fix;
    return { ...row, upToDate: computeUpToDate(row, latest), fix };
  });
  const withUnseen = deps.unseen ? [...rows, await unseenRow(deps.unseen, project)] : rows;
  const withHost = deps.host ? [...withUnseen, hostRow(deps.host, home, now)] : withUnseen;
  const withStack = deps.stackUpdate ? [...withHost, stackRow(readStackVersions(rows, { home, spawn, platform }), home, now)] : withHost;
  if (!deps.gentleAiSnapshots) return withStack;
  const gentleAi = rows.find((row) => row.id === 'gentle-ai')?.version ?? null;
  return [...withStack, gentleAiRow(gentleAi, deps.gentleAiSnapshots, home, now)];
}

/** The gentle-ai-sync row (bin/lib/gentle-ai-update.mjs): the gentle-ai version against the one last reviewed,
 * recorded like the host-update row's, so a sync that rewrote the global CLAUDE.md stays a gap until reviewed. */
function gentleAiRow(version, snapshots, home, now) {
  const cache = readCache(home);
  const { row, record } = gentleAiUpdateRow({ version, reviewed: cache.gentleAi?.reviewed ?? null, snapshots: version ? snapshots(home) : [], home, now });
  if (record) writeCache(home, { ...cache, gentleAi: { reviewed: record } });
  return row;
}

/** The versions the stack-update row watches: the tools of `rows` and the Claude CLI on PATH. */
function readStackVersions(rows, { home, spawn, platform }) {
  return stackVersions(rows, probeVersionCommand('claude', ['--version'], { home, spawn, platform }).version);
}

/** The stack-update row (bin/lib/stack-update.mjs): each tool's version against the one last reviewed, recorded like
 * the host-update row's, so a tool that updated itself stays a gap until `--stack-reviewed` records its review. */
function stackRow(versions, home, now) {
  const cache = readCache(home);
  const { row, record } = stackUpdateRow(versions, cache.stack?.reviewed ?? null, now);
  if (record) writeCache(home, { ...cache, stack: { reviewed: record } });
  return row;
}

/** The host-update row (bin/lib/host-update.mjs): the Claude Desktop app and its Code tab CLI against the versions
 * last reviewed. The first reading, with no record, is recorded as reviewed; after that only `--host-reviewed`
 * records, so an update stays a gap until its review is done. */
function hostRow(host, home, now) {
  const cache = readCache(home);
  const { row, record } = hostUpdateRow(host(home), cache.host?.reviewed ?? null, now);
  if (record) writeCache(home, { ...cache, host: { reviewed: record } });
  return row;
}

/** The unseen row (`js-harness unseen`): a check of the Claude app, not a tool, so nothing to install and one cell
 * that carries the state. `stale` is a gap while an item is to clear, and its fix names the count and each item.
 * `unknown` when the check cannot run: it fails open, like every probe here, and is no gap. */
async function unseenRow(unseen, cwd) {
  const row = { id: 'unseen', version: null, installed: 'n/a', claude: 'ok', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} };
  let toClear;
  try {
    toClear = await unseen(cwd);
  } catch {
    return { ...row, claude: 'unknown' };
  }
  if (toClear.length === 0) return row;
  return { ...row, claude: 'stale', fix: { claude: [`unseen: ${toClear.length} to clear: run js-harness unseen`, ...toClear] } };
}

/** `js-harness doctor` as the dispatcher runs it: the report with the unseen, host-update and gentle-ai-sync rows. Their checks are
 * given only here, so `doctorMain` alone keeps the rows its callers give it. */
export function doctorCommand(argv) {
  return doctorMain(argv, process.env, {
    unseen: async (cwd) => (await import('./unseen.mjs')).unseenToClear(cwd),
    host: (home) => readHostVersions({ home }),
    gentleAiSnapshots: (home) => claudeMdSnapshots(home),
    stackUpdate: true,
  });
}

export async function doctorMain(argv, env = process.env, deps = {}) {
  // The hook refuses an argument it does not know as the report does, before its fail-open part: an
  // installed entry carries only `--hook`, so an unknown one means the copy on the path is older than
  // the install that wrote it, and a SessionStart hook's exit 2 shows its one line without stopping it.
  if (argv.includes('--hook')) {
    const unknown = unknownArgument(argv, KNOWN);
    if (unknown !== null) {
      console.error(`unknown argument: ${unknown}\n\n${USAGE}`);
      return 2;
    }
    return hookMain(argv, env, deps);
  }

  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { home, cwd, json, offline } = parsed;
  if (argv.includes('--host-reviewed')) return recordHostReview(home, json, deps);
  if (argv.includes('--gentle-ai-reviewed')) return recordGentleAiReview(home, json, deps);
  if (argv.includes('--stack-reviewed')) return recordStackReview({ home, cwd, json }, deps);
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

/** `doctor --host-reviewed`: records the Claude Desktop and Code tab CLI versions read now as reviewed, the last step
 * of the review the host-update row lists; with `--json` it prints `{ reviewed }`, the record written. With no
 * running version read it records nothing and exits 1. */
function recordHostReview(home, json, deps) {
  const versions = deps.host ? deps.host(home) : { desktop: null };
  if (!versions.desktop) {
    console.error('js-harness doctor: could not read the running Claude Desktop version: nothing was recorded.');
    return 1;
  }
  const now = deps.now ?? (() => new Date());
  const reviewed = { desktop: versions.desktop, code: versions.code, at: now().toISOString() };
  writeCache(home, { ...readCache(home), host: { reviewed } });
  if (json) {
    console.log(JSON.stringify({ reviewed }));
    return 0;
  }
  console.log(`Recorded Claude Desktop ${versions.desktop}${versions.code ? ` and its Code tab CLI ${versions.code}` : ''} as reviewed.`);
  return 0;
}

/** `doctor --gentle-ai-reviewed`: records the installed gentle-ai version as reviewed, the last step of the review
 * the gentle-ai-sync row lists; with `--json` it prints `{ reviewed }`, the record written. With no version read it
 * records nothing and exits 1. */
function recordGentleAiReview(home, json, deps) {
  const probe = tools.find((tool) => tool.id === 'gentle-ai').installed({ spawn: deps.spawn ?? spawnSync, platform: deps.platform ?? process.platform, home });
  if (!probe.version) {
    console.error('js-harness doctor: could not read the gentle-ai version: nothing was recorded.');
    return 1;
  }
  const now = deps.now ?? (() => new Date());
  const reviewed = { version: probe.version, at: now().toISOString() };
  writeCache(home, { ...readCache(home), gentleAi: { reviewed } });
  console.log(json ? JSON.stringify({ reviewed }) : `Recorded gentle-ai ${probe.version} as reviewed.`);
  return 0;
}

/** `doctor --stack-reviewed`: records the versions of the stack's tools and of the Claude CLI read now as reviewed, the
 * last step of the review the stack-update row lists; with `--json` it prints `{ reviewed }`, the record written. With
 * no version read it records nothing and exits 1. */
function recordStackReview({ home, cwd, json }, deps) {
  const spawn = deps.spawn ?? spawnSync;
  const platform = deps.platform ?? process.platform;
  const rows = probeStack({ home, project: resolveProjectRoot(cwd, spawn), spawn, platform, interactive: false, functions: {} });
  const versions = readStackVersions(rows, { home, spawn, platform });
  if (Object.keys(versions).length === 0) {
    console.error('js-harness doctor: could not read the version of any tool of the stack: nothing was recorded.');
    return 1;
  }
  const now = deps.now ?? (() => new Date());
  const reviewed = { versions, at: now().toISOString() };
  writeCache(home, { ...readCache(home), stack: { reviewed } });
  const named = Object.entries(versions).map(([id, version]) => `${id} ${version}`).join(', ');
  console.log(json ? JSON.stringify({ reviewed }) : `Recorded ${named} as reviewed.`);
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
    // A host or gentle-ai update is named in the notice, which stays a `systemMessage`: no model tokens (docs/ROADMAP.md,
    // Decided). Its versions enter the digest, so another update before the review is recorded is a new notice (Codex,
    // 2026-10-15).
    const host = [
      hostNotice(rows.find((row) => row.id === 'host-update')),
      gentleAiNotice(rows.find((row) => row.id === 'gentle-ai-sync')),
      stackNotice(rows.find((row) => row.id === 'stack-update')),
    ]
      .filter(Boolean)
      .join('; ');
    const digest = host ? crypto.createHash('sha256').update(`${gapDigest(rows)}\n${host}`).digest('hex') : gapDigest(rows);
    const cache = readCache(home);
    const shouldNotify = gaps.length > 0 && digest !== cache.notified;
    writeCache(home, { ...cache, notified: digest });

    if (shouldNotify) {
      const plural = gaps.length === 1 ? '' : 's';
      console.log(
        JSON.stringify({ systemMessage: `js-harness: ${gaps.length} stack gap${plural} — run js-harness doctor${host ? ` (${host})` : ''}` }),
      );
    }
  } catch {
    // Fail open: see the doc comment above — never a crash, never stderr, never non-zero.
  }
  return 0;
}
