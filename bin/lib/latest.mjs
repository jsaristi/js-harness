// Latest-version lookups: one request per tool (a GitHub release, an npm registry entry, or the
// local plugin marketplaces for the two Claude plugins), each bounded by a 5s timeout and run in parallel.
// Every lookup fails open to `null` ("unknown" upstream) instead of throwing: a network outage or
// a malformed body for one tool never blocks the others, and `doctor` is a report, not a gate.
import fs from 'node:fs';
import path from 'node:path';

const TIMEOUT_MS = 5000;

async function fetchGithubReleaseVersion(owner, repo, fetchImpl) {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.tag_name === 'string' ? data.tag_name.replace(/^v/, '') : null;
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
 * marketplace file its own marketplace ships (`claude-plugins-official` for typescript-lsp,
 * `openai-codex` for the Codex plugin). */
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
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const entry = Array.isArray(data?.plugins) ? data.plugins.find((p) => p?.name === pluginName) : undefined;
    return typeof entry?.version === 'string' ? entry.version : null;
  } catch {
    return null;
  }
}

/** Per-tool latest-version source. Each receives the shared deps (`fetch`, `home`) and that tool's
 * already-probed local row, and resolves to a version string or `null`. context7's source is only
 * ever invoked when it is not hosted (see `fetchLatestVersions` below), since a hosted entry has
 * no version of its own to compare against npm. */
const SOURCES = {
  'gentle-ai': ({ fetch: fetchImpl }) => fetchGithubReleaseVersion('Gentleman-Programming', 'gentle-ai', fetchImpl),
  engram: ({ fetch: fetchImpl }) => fetchGithubReleaseVersion('Gentleman-Programming', 'engram', fetchImpl),
  codegraph: ({ fetch: fetchImpl }) => fetchNpmLatestVersion('@colbymchenry/codegraph', fetchImpl),
  context7: ({ fetch: fetchImpl }) => fetchNpmLatestVersion('@upstash/context7-mcp', fetchImpl),
  'typescript-lsp': ({ home }) =>
    Promise.resolve(readMarketplacePluginVersion(home, 'claude-plugins-official', 'typescript-lsp')),
  'codex-plugin': ({ home }) => Promise.resolve(readMarketplacePluginVersion(home, 'openai-codex', 'codex')),
};

/** True when `fetchLatestVersions` below actually looks `row` up — false for a hosted context7 row
 * (no version of its own to compare against npm) or for a row id with no `SOURCES` entry at all.
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
