// The records of the merge queue's lands and of the Codex review runs, read as a day's facts, and the two figures
// taken over them: what `js-harness stretch` (bin/stretch.mjs, bin/lib/stretch.mjs) reports of a stretch and the
// workshop's `throughput` of a day. Moved out of workshop/lib/throughput.mjs and workshop/bin/throughput.mjs, which are the
// workshop's (odd/tasks/workshop-product-split.md, slice 1+2), so product code imports no workshop module. Pure
// apart from `readRecordLines`, which reads the file it is handed through the file system it is handed. Zero deps.
import { jsonLinesPath } from './codex-reviews.mjs';

/** The seconds from `from` to `to`, two times Date.parse reads, to a tenth. */
export const secondsBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 100) / 10;

/** The seconds the union of `[from, to]` intervals (ms) covers: two gates at once count once. */
export function busySeconds(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let open = null;
  for (const [from, to] of sorted) {
    if (open === null || from > open[1]) {
      if (open) total += open[1] - open[0];
      open = [from, to];
    } else open[1] = Math.max(open[1], to);
  }
  if (open) total += open[1] - open[0];
  return total / 1000;
}

/** The median of `values`, `null` for none. */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The lands started in `[from, to)` among the merge queue's records (`<git common dir>/js-harness/lands.jsonl`, B2):
 * `{ startedAt, seconds, exit, landed, considered, phases: [{ phase, seconds, ok }], said }`, `said` the last line the land
 * printed, which says why one failed, or `null`. */
export function landFacts(records, { from, to }) {
  return records
    .filter((record) => Date.parse(record?.startedAt) >= from && Date.parse(record.startedAt) < to)
    .map((record) => ({
      startedAt: record.startedAt,
      seconds: Number.isFinite(Date.parse(record.endedAt)) ? secondsBetween(record.startedAt, record.endedAt) : null,
      exit: Number.isInteger(record.exit) ? record.exit : null,
      landed: Array.isArray(record.landed) ? record.landed.length : 0,
      considered: Array.isArray(record.considered) ? record.considered.length : 0,
      phases: (Array.isArray(record.phases) ? record.phases : []).filter((phase) => typeof phase?.phase === 'string' && Number.isFinite(phase.seconds)).map(({ phase, seconds, ok }) => ({ phase, seconds, ok: ok ?? null })),
      said: typeof record.said === 'string' ? record.said : null,
    }))
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

const isObjectLike = (value) => typeof value === 'object' && value !== null;

/** The Codex review runs started in `[from, to)` (`readCodexReviewRuns`): `{ startedAt, seconds, outcome, findings,
 * part, reason }`, `reason` the words a run that did not stand was logged with, or `null`. */
export function codexFacts(runs, { from, to }) {
  return runs
    .filter((run) => Date.parse(run?.startedAt) >= from && Date.parse(run.startedAt) < to)
    .map((run) => ({
      startedAt: run.startedAt,
      seconds: Number.isFinite(run.durationMs) ? Math.round(run.durationMs / 100) / 10 : null,
      outcome: run.outcome ?? null,
      findings: Number.isFinite(run.findings?.total) ? run.findings.total : null,
      // A part of a range is an attempt of its own (codex-review-runs.mjs, `runPart`).
      part: isObjectLike(run.part),
      reason: typeof run.reason === 'string' ? run.reason : null,
    }));
}

/** The merge queue's land records (`<git common dir>/js-harness/lands.jsonl`): none where the file is not there, a
 * machine where no land ran, and a throw where it is there and cannot be read, so its row says so instead of none. A
 * line that does not parse is left out. */
export function readLandRecord(root, run, fileSystem) {
  return readRecordLines(jsonLinesPath(root, 'lands.jsonl', { spawn: run }), fileSystem);
}

/** The JSON objects of the record `file` the same way: none where `file` is `null` (no repository) or not there, a
 * throw where it is there and cannot be read. */
export function readRecordLines(file, fileSystem) {
  if (!file) return [];
  let text;
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new Error(err.code ?? err.message);
  }
  return text.split(/\r?\n/).flatMap((line) => {
    try {
      const parsed = JSON.parse(line);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
}
