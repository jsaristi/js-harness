// The doctor cache: `<home>/.js-harness/doctor.json`. Holds the latest versions last fetched (with
// their fetch time, so `doctor` only hits the network every 6h — see `isStale`) and the last gap
// digest already notified to the user via `doctor --hook` (T3). Malformed or missing on disk reads
// as an empty cache; nothing here ever throws.
//
// Beside it, the record of the versions last reviewed: `<home>/.js-harness/reviewed.json` (`readReviewed`). It was the
// cache's `host` and `stack` keys until a torn cache, read as empty, turned a pending update into "reviewed" (M10 of
// the Fable 5.2 audit, odd/tasks/audit-u5-atomic-state.md). Both files are written by a temporary file and a rename
// (./atomic-write.mjs), so a reader sees the bytes before or after a write, never half of one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { renameOver, writeManifestAtomic } from './atomic-write.mjs';

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
 * reviews, and that write would otherwise lose an old cache's reviews, or the sign that a torn one held some. While that
 * record cannot be written, the cache there is left as it is (Codex on 0b8b7c2..52367d1). */
export function writeCache(home, cache) {
  const file = cachePath(home);
  try {
    if (!fs.existsSync(reviewedPath(home)) && !migrate(home).kept) return;
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

/** The JSON file `file` as `{ data }`: `data` its object, `undefined` when there is no file, `null` when it is no JSON
 * object; or `{ failed }` when it could not be read now (a file held, a refused read), which says nothing of what it
 * holds, so nothing is written from it (the verifier on 6ee974d..52367d1, finding 3). */
function readObject(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return err.code === 'ENOENT' ? { data: undefined } : { failed: err };
  }
  try {
    const data = JSON.parse(text);
    return { data: data && typeof data === 'object' && !Array.isArray(data) ? data : null };
  } catch {
    return { data: null };
  }
}

/** The record `reviews` is written as: an unknown review as `null`. */
const recordOf = (reviews) => Object.fromEntries(Object.entries(reviews).map(([key, review]) => [key, review.unreadable ? null : { reviewed: review.reviewed }]));

/** Writes `reviews` to the record whole or not at all; whether it was written. */
function writeReviews(home, reviews) {
  try {
    fs.mkdirSync(path.dirname(reviewedPath(home)), { recursive: true });
    writeManifestAtomic(reviewedPath(home), recordOf(reviews));
    return true;
  } catch {
    return false;
  }
}

/** Makes the record from `reviews` only while there is none, whole or not at all: a fresh sibling, then a hard link to
 * the record's name, which fails when another process made the record meanwhile. Returns `created`, `exists` or
 * `failed`. Where the folder takes no hard link, the record is made by a rename, checked for first. */
function createReviews(home, reviews) {
  const file = reviewedPath(home);
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, `${JSON.stringify(recordOf(reviews), null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch {
    return 'failed';
  }
  try {
    fs.linkSync(tmp, file);
    return 'created';
  } catch (err) {
    if (err.code === 'EEXIST') return 'exists';
    if (fs.existsSync(file)) return 'exists';
    try {
      renameOver(tmp, file);
      return 'created';
    } catch {
      return 'failed';
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** The reviews as read now, `{ reviews, sure }`: `sure` false when a file could not be read now, so the reviews are
 * unknown for this read only and nothing may be written from them. */
function loadReviews(home) {
  const record = readObject(reviewedPath(home));
  if (record.failed) return { reviews: unknown(), sure: false };
  if (record.data !== undefined) return { reviews: record.data === null ? unknown() : reviewsOf(record.data), sure: true };
  const { reviews, kept } = migrate(home);
  return { reviews, sure: kept };
}

/** The versions last reviewed, as `{ host?, stack? }`, each `{ reviewed }`, or `{ unreadable: true }` when its record
 * cannot be read: then nothing is taken as reviewed, and only `doctor --host-reviewed` or `--stack-reviewed` records
 * it. A review left out was never recorded, so its first reading is. A record that does not parse leaves both unknown.
 * With no record yet, an old cache's `host` and `stack` are read instead and written to the record then, before a
 * later write of the cache could lose them; a cache that does not parse leaves both unknown, kept so in the record. */
export function readReviewed(home) {
  return loadReviews(home).reviews;
}

/** The reviews of the cache there, with no record yet, made into the record, as `{ reviews, kept }`: `kept` false when
 * the cache holds something the record could not take, so nothing may replace that cache yet. A record another process
 * made meanwhile is read instead, never overwritten (the verifier on 6ee974d..52367d1, finding 1). */
function migrate(home) {
  const cache = readObject(cachePath(home));
  if (cache.failed) return { reviews: unknown(), kept: false };
  if (cache.data === undefined) return { reviews: {}, kept: true };
  const reviews = cache.data === null ? unknown() : reviewsOf(cache.data);
  const made = createReviews(home, reviews);
  if (made === 'created') return { reviews, kept: true };
  if (made === 'failed') return { reviews, kept: false };
  const record = readObject(reviewedPath(home));
  if (record.failed || record.data === undefined) return { reviews: unknown(), kept: false };
  return { reviews: record.data === null ? unknown() : reviewsOf(record.data), kept: true };
}

/** Records `reviewed` as the `key` review (`host` or `stack`), the other kept as the record holds it, read again just
 * before the write; whether it was written, since a review that cannot be recorded must be said. A record that cannot be
 * read now is not written over, so the other review is never lost to a read that failed for a moment. */
export function recordReviewed(home, key, reviewed) {
  const { reviews, sure } = loadReviews(home);
  return sure && writeReviews(home, { ...reviews, [key]: { reviewed } });
}

/** True when the cached latest versions are stale enough to refetch: absent, unparseable, or 6h
 * old or older. `now` is injectable so tests never depend on the real clock. */
export function isStale(checkedAt, now = () => new Date()) {
  if (!checkedAt) return true;
  const checkedAtMs = Date.parse(checkedAt);
  if (Number.isNaN(checkedAtMs)) return true;
  return now().getTime() - checkedAtMs >= CACHE_TTL_MS;
}
