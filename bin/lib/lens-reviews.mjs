// The record of Claude lens reviews: one JSON line per run of `js-harness lens-review` (odd/tasks/f8-s1-reviews.md,
// T3; diet section 10, "S1, the Claude lens runner", item 6).
//
// It lives beside Codex's record, in `<git common dir>/js-harness/`, so every worktree of a clone shares it and
// deleting its two files and its `lens-answers/` folder undoes everything this module writes. A run holds each picked
// lens's outcome, findings, tokens, cost and duration. Only a run whose every lens was complete is `reviewed`; one
// with an incomplete lens is recorded as `incomplete` and covers nothing, so the attempt is kept and the review is
// not. What an incomplete lens's CLI printed is kept whole in `lens-answers/`, a file the result names, so why it
// failed is read there; no check reads that folder (JH 75).
//
// Provenance (docs/proposals/gentle-ai-reverse-engineering.md, section 13.3, row 3). The command writes a run line to
// a file of its own, `lens-review-runs.jsonl` beside it, before any lens runs, and the record it writes after names
// that line by its id (`run`), as a Codex review record names its run line (`./codex-review-runs.mjs`). A check
// admits a record only when it is the first of its range and subject hash to name a run line of that range and hash
// (`admittedLensReviews`), so a well-shaped line a session appended by hand with no run line covers nothing, and
// neither does a later record naming a run another already claimed, an incomplete run's among them. A record written
// before run lines existed names none and is no longer evidence: its range is reviewed again (cents a lens).
//
// What it does not do: a run line is a plain line with a random id, so a session that writes a run line and a record
// both, or claims the line of a run that was cut off before its record, is not refused here. Only `guard`, which
// refuses a file tool or a shell write to either file (`reviewRecordOf` in ./guard.mjs), stands in its way.
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { appendJsonLine, jsonLinesPath, NOTHING_TO_REVIEW, readJsonLines } from './codex-reviews.mjs';
import { gitDirs } from './project.mjs';

export const LENS_REVIEW_SCHEMA = 'js-harness.lens-review/v1';
export const LENS_REVIEWS_FILE = 'lens-reviews.jsonl';
export const LENS_REVIEW_RUN_SCHEMA = 'js-harness.lens-review-run/v1';
export const LENS_REVIEW_RUNS_FILE = 'lens-review-runs.jsonl';
export const INCOMPLETE = 'incomplete';
export const LENS_ANSWERS_FOLDER = 'lens-answers';

/** Keeps `text`, what the lens `lens` of the run `run` printed, whole in `lens-answers/<run>-<lens>.stdout` beside the
 * records and returns the file's path; throws outside a git repository. */
export function keepLensAnswer(root, { run, lens, text }, deps = {}) {
  // `jsonLinesPath` only resolves a name under `<git common dir>/js-harness/`; this file is plain text no reader parses.
  const file = jsonLinesPath(root, path.join(LENS_ANSWERS_FOLDER, `${run}-${lens}.stdout`), deps);
  if (!file) throw new Error(`not a git repository: ${root}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

/** Appends `record` as one line and returns the file's path; throws outside a git repository. */
export function appendLensReview(root, record, deps = {}) {
  return appendJsonLine(root, LENS_REVIEWS_FILE, record, deps);
}

/** Every record, oldest first; a line that is not a JSON object is skipped. */
export function readLensReviews(root, deps = {}) {
  return readJsonLines(root, LENS_REVIEWS_FILE, deps);
}

/** Writes the run line of a run over `base..head` at `subjectHash` and returns its id, which the run's record names
 * as `run`; throws outside a git repository. Called before any lens runs, so the line comes first. */
export function startLensRun(root, { base, head, subjectHash }, deps = {}) {
  const id = randomUUID();
  appendJsonLine(root, LENS_REVIEW_RUNS_FILE, { schema: LENS_REVIEW_RUN_SCHEMA, id, base, head, subjectHash, startedAt: new Date().toISOString() }, deps);
  return id;
}

/** Writes the last line of the run `id` over `base..head` at `subjectHash`: its `outcome` and, where its lenses ran,
 * what each found (`results`, kept as each lens's outcome and count of findings). Written after the run's record, so a
 * run stopped before it leaves a record no check admits, never a result a record written by hand could name (V2, the
 * opus verifier's second pass on pull request 896). Throws outside a git repository. */
export function endLensRun(root, { id, base, head, subjectHash, outcome, results }, deps = {}) {
  const said = resultsSaid(results);
  appendJsonLine(root, LENS_REVIEW_RUNS_FILE, { schema: LENS_REVIEW_RUN_SCHEMA, id, base, head, subjectHash, outcome, ...(said === null ? {} : { results: said }), endedAt: new Date().toISOString() }, deps);
}

/** What a run's last line keeps of its lenses' results, and what a record's are read as to match it: `null` for none. */
const resultsSaid = (results) => (Array.isArray(results) ? results.map((one) => ({ lens: one?.lens, outcome: one?.outcome, ...(Array.isArray(one?.findings) ? { findings: one.findings.length } : {}) })) : null);

/** Every run line, oldest first, with the tolerance of `readLensReviews`. */
export function readLensRuns(root, deps = {}) {
  return readJsonLines(root, LENS_REVIEW_RUNS_FILE, deps);
}

/** What a run line and the record that names it agree on: the run, its range and its subject hash. */
const runKey = ({ id, base, head, subjectHash }) => JSON.stringify([id, base, head, subjectHash]);

/** The records, oldest first, and `admitted(rec)`, true only for one of them that is evidence (`isValidLensReview`)
 * and the first record to name a run line of its own range and subject hash; a record of another range naming that
 * run claims nothing. A run's last line says its result (`endLensRun`): a record naming a run with one is admitted only
 * where it says the same outcome and findings, and a run with two results admits none. A run with no result line was
 * written before runs had one, or stopped before its end: its record is admitted only where it stands before the first
 * record a result line admits, so the records of the shared log stay as they were and none written after is (V2, L66 of
 * odd/tasks/review-gate.md). A record of another read is never admitted, so `records` is what a check reads with it. The git
 * common dir is asked once for both files (`where`, as `jsonLinesPath` takes it). */
export function admittedLensReviews(root, { spawn = spawnSync, where, ...rest } = {}) {
  const deps = { ...rest, spawn, where: where ?? { commonGitDir: gitDirs(root, spawn).commonGitDir ?? null } };
  const records = readLensReviews(root, deps);
  const lines = readLensRuns(root, deps).filter((line) => line.schema === LENS_REVIEW_RUN_SCHEMA);
  const runs = new Set(lines.map(runKey));
  const endsOf = new Map();
  for (const line of lines) if (line.outcome !== undefined) endsOf.set(line.id, [...(endsOf.get(line.id) ?? []), line]);
  const claimed = new Set();
  const admitted = new Set();
  let resulted = false;
  for (const rec of records) {
    const key = runKey({ ...rec, id: rec.run });
    if (typeof rec.run !== 'string' || claimed.has(rec.run) || !runs.has(key)) continue;
    claimed.add(rec.run);
    if (!isValidLensReview(rec)) continue;
    const ends = endsOf.get(rec.run) ?? [];
    if (ends.length === 0) {
      if (!resulted) admitted.add(rec);
      continue;
    }
    const [end] = ends;
    const agrees = ends.length === 1 && runKey(end) === key && end.outcome === rec.outcome && JSON.stringify(end.results ?? null) === JSON.stringify(resultsSaid(rec.results));
    if (!agrees) continue;
    admitted.add(rec);
    resulted = true;
  }
  return { records, admitted: (rec) => admitted.has(rec) };
}

const COMMIT_ID = /^[0-9a-f]{40,64}$/;
const HASH = /^[0-9a-f]{64}$/;

/** Whether `rec` is a record a check may treat as evidence over its range: the schema, full commit ids, a subject
 * hash, a `reviewedAt`, and an outcome of `reviewed` (with its lenses' results), or a skip (`unavailable`) or a
 * range with nothing to review, each with a reason. An `incomplete` run is never evidence. Its shape alone: a check
 * also asks where it came from (`admittedLensReviews`). */
export function isValidLensReview(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false;
  if (rec.schema !== LENS_REVIEW_SCHEMA) return false;
  if (typeof rec.base !== 'string' || !COMMIT_ID.test(rec.base)) return false;
  if (typeof rec.head !== 'string' || !COMMIT_ID.test(rec.head)) return false;
  if (typeof rec.subjectHash !== 'string' || !HASH.test(rec.subjectHash)) return false;
  if (typeof rec.reviewedAt !== 'string') return false;
  if (rec.outcome === 'reviewed') return Array.isArray(rec.results) && rec.results.length > 0 && rec.results.every((result) => result?.outcome === 'complete');
  return (rec.outcome === 'unavailable' || rec.outcome === NOTHING_TO_REVIEW) && typeof rec.reason === 'string' && rec.reason.trim() !== '';
}
