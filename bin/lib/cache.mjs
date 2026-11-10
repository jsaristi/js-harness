// The doctor cache: `<home>/.js-harness/doctor.json`. Holds the latest versions last fetched (with
// their fetch time, so `doctor` only hits the network every 6h — see `isStale`) and the last gap
// digest already notified to the user via `doctor --hook` (T3). Malformed or missing on disk reads
// as an empty cache; nothing here ever throws.
//
// Beside it, the record of the versions last reviewed: `<home>/.js-harness/reviewed.json` (`readReviewed`). It was the
// cache's `host` and `stack` keys until a torn cache, read as empty, turned a pending update into "reviewed" (M10 of
// the Fable 5.2 audit, odd/tasks/audit-u5-atomic-state.md). Both files are written by a temporary file and a rename
// (./atomic-write.mjs), so a reader sees the bytes before or after a write, never half of one.
import fs from 'node:fs';
import path from 'node:path';
import { writeManifestAtomic } from './atomic-write.mjs';

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
  const host = sanitizeHost(data?.host);
  const stack = sanitizeStack(data?.stack);
  return { latest: { checkedAt, versions }, notified, ...(host ? { host } : {}), ...(stack ? { stack } : {}) };
}

/** The stack-update record (bin/lib/stack-update.mjs): the version of each tool last reviewed, by id. Kept by every
 * reader like the host record; a record whose versions are not all text is dropped whole. */
function sanitizeStack(stack) {
  const reviewed = stack && typeof stack === 'object' ? stack.reviewed : undefined;
  if (!reviewed || typeof reviewed !== 'object') return null;
  const { versions, at } = reviewed;
  if (!versions || typeof versions !== 'object' || Array.isArray(versions) || typeof at !== 'string') return null;
  if (!Object.values(versions).every((value) => typeof value === 'string')) return null;
  return { reviewed: { versions: { ...versions }, at } };
}

/** The host-update record (bin/lib/host-update.mjs): the Claude Desktop and Code tab CLI versions last reviewed.
 * Kept by every reader, so a writer of another key keeps it too; anything malformed is dropped. */
function sanitizeHost(host) {
  const reviewed = host && typeof host === 'object' ? host.reviewed : undefined;
  if (!reviewed || typeof reviewed !== 'object') return null;
  const { desktop, code, at } = reviewed;
  if (typeof desktop !== 'string' || (typeof code !== 'string' && code !== null) || typeof at !== 'string') return null;
  return { reviewed: { desktop, code, at } };
}

/** R3-101 (accepted T2/T3 review follow-up): best-effort. The cache is optional plumbing — a
 * refetched version that cannot be saved must never crash `doctor`, which is a report, not a gate.
 * An unwritable home, or a home path that turns out to be a plain file, is swallowed here instead
 * of propagating up through `doctorMain`. Written whole or not at all (`writeManifestAtomic`). With no record of the
 * reviews yet, the cache there is read into it first (`readReviewed`): `doctor` writes the cache before it reads the
 * reviews, and that write would otherwise lose an old cache's reviews, or the sign that a torn one held some. */
export function writeCache(home, cache) {
  const file = cachePath(home);
  try {
    if (!fs.existsSync(reviewedPath(home))) readReviewed(home);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeManifestAtomic(file, cache);
  } catch {
    // Best-effort: see the doc comment above.
  }
}

/** The two reviews the record keeps: the host's (./host-update.mjs) and the stack's (./stack-update.mjs). */
const REVIEWS = { host: sanitizeHost, stack: sanitizeStack };

export function reviewedPath(home) {
  return path.join(home, '.js-harness', 'reviewed.json');
}

/** Each review of `source`, an object read from the record or from an old cache: `{ reviewed }` when it is well formed,
 * `{ unreadable: true }` when it is there and is not (`null` in the record is how an unknown one is kept), and left
 * out when it is not there, which is a review never recorded. */
function reviewsOf(source) {
  const reviews = {};
  for (const [key, sanitize] of Object.entries(REVIEWS)) {
    if (!Object.hasOwn(source, key)) continue;
    reviews[key] = sanitize(source[key]) ?? { unreadable: true };
  }
  return reviews;
}

/** Both reviews unknown: what a record or an old cache that cannot be read says. */
const unknown = () => Object.fromEntries(Object.keys(REVIEWS).map((key) => [key, { unreadable: true }]));

/** The object of the JSON file `file`, `undefined` when there is none, `null` when it cannot be read as an object. */
function readObject(file) {
  if (!fs.existsSync(file)) return undefined;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Writes `reviews` to the record whole or not at all, an unknown review as `null`; whether it was written. */
function writeReviews(home, reviews) {
  const record = Object.fromEntries(Object.entries(reviews).map(([key, review]) => [key, review.unreadable ? null : { reviewed: review.reviewed }]));
  try {
    fs.mkdirSync(path.dirname(reviewedPath(home)), { recursive: true });
    writeManifestAtomic(reviewedPath(home), record);
    return true;
  } catch {
    return false;
  }
}

/** The versions last reviewed, as `{ host?, stack? }`, each `{ reviewed }`, or `{ unreadable: true }` when its record
 * cannot be read: then nothing is taken as reviewed, and only `doctor --host-reviewed` or `--stack-reviewed` records
 * it. A review left out was never recorded, so its first reading is. A record that does not parse leaves both unknown.
 * With no record yet, an old cache's `host` and `stack` are read instead and written to the record then, before a
 * later write of the cache could lose them; a cache that does not parse leaves both unknown, kept so in the record. */
export function readReviewed(home) {
  const record = readObject(reviewedPath(home));
  if (record !== undefined) return record === null ? unknown() : reviewsOf(record);
  const cache = readObject(cachePath(home));
  if (cache === undefined) return {};
  const reviews = cache === null ? unknown() : reviewsOf(cache);
  writeReviews(home, reviews);
  return reviews;
}

/** Records `reviewed` as the `key` review (`host` or `stack`), the other kept as the record holds it, read again just
 * before the write; whether it was written, since a review that cannot be recorded must be said. */
export function recordReviewed(home, key, reviewed) {
  return writeReviews(home, { ...readReviewed(home), [key]: { reviewed } });
}

/** True when the cached latest versions are stale enough to refetch: absent, unparseable, or 6h
 * old or older. `now` is injectable so tests never depend on the real clock. */
export function isStale(checkedAt, now = () => new Date()) {
  if (!checkedAt) return true;
  const checkedAtMs = Date.parse(checkedAt);
  if (Number.isNaN(checkedAtMs)) return true;
  return now().getTime() - checkedAtMs >= CACHE_TTL_MS;
}
