// The doctor cache: `<home>/.js-harness/doctor.json`. Holds the latest versions last fetched (with
// their fetch time, so `doctor` only hits the network every 6h — see `isStale`) and the last gap
// digest already notified to the user via `doctor --hook` (T3). Malformed or missing on disk reads
// as an empty cache; nothing here ever throws.
import fs from 'node:fs';
import path from 'node:path';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function emptyCache() {
  return { latest: { checkedAt: null, versions: {} }, notified: null };
}

export function cachePath(home) {
  return path.join(home, '.js-harness', 'doctor.json');
}

/** R3-103 (accepted T2/T3 review follow-up): a version is a string (a real version) or `null`
 * (looked up, resolved to nothing yet) — anything else is a foreign or corrupted value that must
 * never reach the `outdated` comparison in doctor.mjs, so it is dropped rather than passed through. */
function sanitizeVersions(rawVersions) {
  if (!rawVersions || typeof rawVersions !== 'object' || Array.isArray(rawVersions)) return {};
  const versions = {};
  for (const [id, value] of Object.entries(rawVersions)) {
    if (typeof value === 'string' || value === null) versions[id] = value;
  }
  return versions;
}

/** Reads the cache; a missing file, unparseable JSON, or a wrong-shaped document all read as an
 * empty cache rather than throwing or propagating garbage into the report. */
export function readCache(home) {
  const file = cachePath(home);
  if (!fs.existsSync(file)) return emptyCache();
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return emptyCache();
  }
  const latest = data && typeof data === 'object' ? data.latest : undefined;
  const versions = sanitizeVersions(latest?.versions);
  const checkedAt = typeof latest?.checkedAt === 'string' ? latest.checkedAt : null;
  const notified = typeof data?.notified === 'string' ? data.notified : null;
  return { latest: { checkedAt, versions }, notified };
}

/** R3-101 (accepted T2/T3 review follow-up): best-effort. The cache is optional plumbing — a
 * refetched version that cannot be saved must never crash `doctor`, which is a report, not a gate.
 * An unwritable home, or a home path that turns out to be a plain file, is swallowed here instead
 * of propagating up through `doctorMain`. */
export function writeCache(home, cache) {
  const file = cachePath(home);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Best-effort: see the doc comment above.
  }
}

/** True when the cached latest versions are stale enough to refetch: absent, unparseable, or 6h
 * old or older. `now` is injectable so tests never depend on the real clock. */
export function isStale(checkedAt, now = () => new Date()) {
  if (!checkedAt) return true;
  const checkedAtMs = Date.parse(checkedAt);
  if (Number.isNaN(checkedAtMs)) return true;
  return now().getTime() - checkedAtMs >= CACHE_TTL_MS;
}
