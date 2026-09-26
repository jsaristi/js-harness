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
  const versions = latest && typeof latest === 'object' && latest.versions && typeof latest.versions === 'object'
    ? latest.versions
    : {};
  const checkedAt = typeof latest?.checkedAt === 'string' ? latest.checkedAt : null;
  const notified = typeof data?.notified === 'string' ? data.notified : null;
  return { latest: { checkedAt, versions }, notified };
}

export function writeCache(home, cache) {
  const file = cachePath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
}

/** True when the cached latest versions are stale enough to refetch: absent, unparseable, or 6h
 * old or older. `now` is injectable so tests never depend on the real clock. */
export function isStale(checkedAt, now = () => new Date()) {
  if (!checkedAt) return true;
  const checkedAtMs = Date.parse(checkedAt);
  if (Number.isNaN(checkedAtMs)) return true;
  return now().getTime() - checkedAtMs >= CACHE_TTL_MS;
}
