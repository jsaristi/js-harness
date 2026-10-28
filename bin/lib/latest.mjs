// Latest-version lookups: one request per tool (a GitHub release or an npm registry entry), each
// bounded by a 5s timeout and run in parallel, plus the Claude plugins' latest versions, which are read
// locally instead (`LOCAL_SOURCES`, never cached): typescript-lsp's from its marketplace file, the engram
// plugin's from the engram marketplace clone at the engram binary's release tag.
// Every lookup fails open to `null` ("unknown" upstream) instead of throwing: a network outage or
// a malformed body for one tool never blocks the others, and `doctor` is a report, not a gate.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { compareSemver } from './version.mjs';

const TIMEOUT_MS = 5000;

// An engram release is a plain `v<semver>` tag: the releases lookup accepts only those, and the plugin read asks git
// for exactly that tag, so both read the same rule here.
const PLAIN_SEMVER = String.raw`\d+\.\d+\.\d+`;
const RELEASE_TAG_RE = new RegExp(`^v(${PLAIN_SEMVER})$`);
const PLAIN_SEMVER_RE = new RegExp(`^${PLAIN_SEMVER}$`);
// One page of the newest releases across every stream. The newest `v<semver>` release must be among them: past 30
// newer `pi-v*` releases, drafts or prereleases the answer is `null`, shown as `unknown`, never a wrong version.
const RELEASES_PAGE = 30;

/** The highest `v<semver>` release of a repository that publishes more than one release stream, where
 * `releases/latest` is whichever stream published last: engram's `pi-v*` releases share its repository
 * (odd/tasks/engram-plugin-lag.md, D4). Drafts, prereleases and every other tag are skipped. */
async function fetchGithubStreamVersion(owner, repo, fetchImpl) {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=${RELEASES_PAGE}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    const versions = data
      .filter((release) => !release?.draft && !release?.prerelease)
      .map((release) => RELEASE_TAG_RE.exec(release?.tag_name ?? '')?.[1])
      .filter(Boolean);
    return versions.reduce((best, v) => (best === null || compareSemver(v, best) > 0 ? v : best), null);
  } catch {
    return null;
  }
}

async function fetchNpmLatestVersion(pkgName, fetchImpl) {
  try {
    const res = await fetchImpl(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

/** A Claude plugin has no CLI and no registry: its latest version is read offline from the local
 * marketplace file its own marketplace ships (`claude-plugins-official` for typescript-lsp). */
function readMarketplacePluginVersion(home, marketplace, pluginName) {
  const filePath = path.join(
    home,
    '.claude',
    'plugins',
    'marketplaces',
    marketplace,
    '.claude-plugin',
    'marketplace.json',
  );
  try {
    return pluginVersionIn(fs.readFileSync(filePath, 'utf8'), pluginName);
  } catch {
    return null;
  }
}

/** The version `pluginName` has in the text of a marketplace file, or `null`. Throws on text that does not parse. */
function pluginVersionIn(text, pluginName) {
  const data = JSON.parse(text);
  const entry = Array.isArray(data?.plugins) ? data.plugins.find((p) => p?.name === pluginName) : undefined;
  return typeof entry?.version === 'string' ? entry.version : null;
}

/** The plugin version the engram binary's own release tag ships: read with git from Claude Code's clone of the
 * engram marketplace at `v<binary version>`, never from the clone's working tree, which can sit behind the refs
 * Claude Code fetched (odd/tasks/engram-plugin-lag.md, D2). `rows` holds the engram row. No engram version, no
 * clone, no git, no such tag or a manifest with no engram entry is `null`. A folder with no `.git` of its own is no
 * clone: git would read a repository above it. `git` is the seam that runs it (`runGit` below). */
async function readEngramPluginAtTag({ home, git = runGit }, _row, rows = []) {
  const binary = rows.find((row) => row.id === 'engram')?.version;
  if (typeof binary !== 'string' || !PLAIN_SEMVER_RE.test(binary)) return null;
  const clone = path.join(home, '.claude', 'plugins', 'marketplaces', 'engram');
  if (!fs.existsSync(path.join(clone, '.git'))) return null;
  const result = await git(['-C', clone, 'show', `v${binary}:.claude-plugin/marketplace.json`]);
  if (!result || result.error || result.signal || result.status !== 0) return null;
  return pluginVersionIn(result.stdout ?? '', 'engram');
}

/** Runs git with `args`, no shell, bounded by the same 5s as a request, and resolves to `{ status, stdout }`, or
 * `{ status, signal, error }` when it fails or is killed. Never rejects. Asynchronous, so the lookups in flight keep
 * reading their responses while it runs: a blocked event loop lets their timeouts run out unread (Codex P2). */
function runGit(args) {
  return new Promise((resolve) => {
    execFile('git', args, { encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true }, (error, stdout) => {
      if (!error) resolve({ status: 0, stdout });
      else resolve({ status: typeof error.code === 'number' ? error.code : null, signal: error.signal ?? null, error, stdout });
    });
  });
}

/** Per-tool latest-version source. Each receives the shared deps (`fetch`, `home`) and that tool's
 * already-probed local row, and resolves to a version string or `null`. context7's source is only
 * ever invoked when it is not hosted (see `fetchLatestVersions` below), since a hosted entry has
 * no version of its own to compare against npm. */
const SOURCES = {
  engram: ({ fetch: fetchImpl }) => fetchGithubStreamVersion('Gentleman-Programming', 'engram', fetchImpl),
  codegraph: ({ fetch: fetchImpl }) => fetchNpmLatestVersion('@colbymchenry/codegraph', fetchImpl),
  context7: ({ fetch: fetchImpl }) => fetchNpmLatestVersion('@upstash/context7-mcp', fetchImpl),
  codex: ({ fetch: fetchImpl }) => fetchNpmLatestVersion('@openai/codex', fetchImpl),
};

/** Latest-version sources that are a local file, not a request. Each receives the shared deps
 * (`home`, and `git` for the engram plugin's), that tool's row and every row, and returns a version string or
 * `null`, or a promise of one. They are read on every run, online or `--offline`, and never cached: a plugin
 * installed after a run that found no answer must be compared at once, not up to 6h later (T6d, Codex P2). */
const LOCAL_SOURCES = {
  'typescript-lsp': ({ home }) => readMarketplacePluginVersion(home, 'claude-plugins-official', 'typescript-lsp'),
  'engram-plugin': readEngramPluginAtTag,
};

/** True when `row`'s latest version is read from a local file (`LOCAL_SOURCES`), not fetched. */
export function isLocalSource(row) {
  return Boolean(LOCAL_SOURCES[row.id]);
}

/** Reads every local-source row's latest version: a map of tool id to version string or `null`,
 * with an entry only for the rows `isLocalSource` says yes to, read in parallel. Never rejects. */
export async function readLocalLatestVersions(rows, deps) {
  const entries = await Promise.all(
    rows.filter(isLocalSource).map(async (row) => {
      try {
        return [row.id, await LOCAL_SOURCES[row.id](deps, row, rows)];
      } catch {
        return [row.id, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** True when `fetchLatestVersions` below actually looks `row` up over the network — false for a
 * hosted context7 row (no version of its own to compare against npm), for a local-source row (read
 * by `readLocalLatestVersions`, never an outage-prone lookup), or for a row id with no source at all.
 * Exported (R3-003, accepted final review follow-up, lineage review-cef5637e2884c12a) so any caller
 * that needs to know what was *attempted*, not just what came back — doctor.mjs's
 * `resolveLatestVersions`, deciding whether a refetch that resolved nothing was a real outage or
 * simply had nothing left to check — reuses this one predicate instead of keeping a second copy of
 * the same rule that can silently drift out of sync with it. */
export function isLookupAttempted(row) {
  if (row.id === 'context7' && row.version === 'hosted') return false;
  return Boolean(SOURCES[row.id]);
}

/** Fetches every tool's latest version in parallel (each already timeout-bounded). Returns a map
 * of tool id to version string or `null`. Never throws: a row `isLookupAttempted` says no to, or
 * one whose own promise rejects, resolves to `null` for that id only. */
export async function fetchLatestVersions(rows, deps) {
  const entries = await Promise.all(
    rows.map(async (row) => {
      if (!isLookupAttempted(row)) return [row.id, null];
      try {
        return [row.id, await SOURCES[row.id](deps, row)];
      } catch {
        return [row.id, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}
