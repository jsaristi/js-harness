// Latest-version lookups: one request per tool (a GitHub release, an npm registry entry, or the
// local plugin marketplace for typescript-lsp), each bounded by a 5s timeout and run in parallel.
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

/** typescript-lsp has no CLI and no registry: its latest version is read offline from the local
 * plugin marketplace file the `claude-plugins-official` marketplace ships. */
function readMarketplacePluginVersion(home, pluginName) {
  const filePath = path.join(
    home,
    '.claude',
    'plugins',
    'marketplaces',
    'claude-plugins-official',
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
  'typescript-lsp': ({ home }) => Promise.resolve(readMarketplacePluginVersion(home, 'typescript-lsp')),
};

/** Fetches every tool's latest version in parallel (each already timeout-bounded). Returns a map
 * of tool id to version string or `null`. Never throws: a source with no id in `SOURCES`, or one
 * whose own promise rejects, resolves to `null` for that id only. */
export async function fetchLatestVersions(rows, deps) {
  const entries = await Promise.all(
    rows.map(async (row) => {
      if (row.id === 'context7' && row.version === 'hosted') return [row.id, null];
      const source = SOURCES[row.id];
      if (!source) return [row.id, null];
      try {
        return [row.id, await source(deps, row)];
      } catch {
        return [row.id, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}
