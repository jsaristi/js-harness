// The records of the merge queue's lands and of the Codex review runs, read as a day's facts, and the figures taken
// over them: what `js-harness stretch` (bin/stretch.mjs, bin/lib/stretch.mjs) reports of a stretch, the workshop's
// `throughput` of a day, and Codex input per landed PR, which `js-harness codex-meter --per-pr` prints (`perLandedPr`,
// odd/tasks/codex-spend.md, spec 6). Moved out of workshop/lib/throughput.mjs and workshop/bin/throughput.mjs, which are the
// workshop's (odd/tasks/workshop-product-split.md, slice 1+2), so product code imports no workshop module. Pure
// apart from `readRecordLines`, which reads the file it is handed through the file system it is handed; the per-PR
// measure is handed git and the review coverage as functions. Zero deps.
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

// Codex input per landed PR (odd/tasks/codex-spend.md, spec 6). The measure is taken per delivered unit, not per run:
// what Codex read for each PR that landed, over all its days, and what of it bought no new reading.

/** The PRs and the day of the baseline the measure is held to: PRs 864-868, and 2026-11-14, the day Codex's five-hour
 * window reached 100%, kept apart (the document's L3). */
export const BASELINE = { prs: [864, 865, 866, 867, 868], day: '2026-11-14' };

/** The subject the merge queue writes on the merge of a PR (bin/lib/pull-request.mjs, `mergeMessage`), which
 * GitHub's merge button writes too. */
const MERGE_OF_PR = /^Merge pull request #(\d+) from /;

const tokensOf = (run) => (Number.isFinite(run.usage?.inputTokens) ? run.usage.inputTokens : 0);
const tally = (runs) => ({ runs: runs.length, inputTokens: runs.reduce((sum, run) => sum + tokensOf(run), 0) });
const namesOf = (rec) => [...(Array.isArray(rec?.runs) ? rec.runs : []), ...(typeof rec?.run === 'string' ? [rec.run] : [])];

/** The commits of the default branch `defaultRef` and of the lands' candidates, as `git` reads them: a map of each
 * id to `{ parents, subject }`. A candidate git does not hold is left out (one `cat-file`); the revisions go on
 * standard input, so their number meets no command-line limit. Throws where git cannot read them. */
function commitGraph(git, lands, defaultRef) {
  const candidates = [...new Set(lands.map((land) => land?.candidate).filter((id) => typeof id === 'string'))];
  const checked = candidates.length === 0 ? '' : git(['cat-file', '--batch-check'], `${candidates.join('\n')}\n`);
  if (checked === null) throw new Error('git could not tell which commits of the lands it holds');
  const held = checked.split('\n').map((line) => line.trim().split(' ')).filter(([, type]) => type === 'commit').map(([id]) => id);
  const revisions = [...(defaultRef ? [defaultRef] : []), ...held];
  const graph = new Map();
  if (revisions.length === 0) return graph;
  const log = git(['log', '--stdin', '--format=%H %P%x09%s'], `${revisions.join('\n')}\n`);
  if (log === null) throw new Error('git could not read the commits of the lands');
  for (const line of log.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const [id, ...parents] = line.slice(0, tab).trim().split(' ').filter(Boolean);
    graph.set(id, { parents, subject: line.slice(tab + 1) });
  }
  return graph;
}

/** Every commit of `graph` reachable from `start` without entering `stop` (a set): `git rev-list start ^stop`, over
 * the commits the graph holds. */
function reachable(graph, start, stop = new Set()) {
  const seen = new Set();
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id) || stop.has(id) || !graph.has(id)) continue;
    seen.add(id);
    stack.push(...graph.get(id).parents);
  }
  return seen;
}

/** The PR each commit landed with: for each land that landed (exit 0), oldest first, the merges on its candidate's
 * first-parent line above the main it started from whose subject names a PR it landed, and the commits each merge
 * brought in, `<merge>^1..<merge>^2`. A commit two lands brought in is the first one's. */
function landedOwners(graph, lands) {
  const owner = new Map();
  const landed = lands
    .filter((land) => land?.exit === 0 && Array.isArray(land.landed) && land.landed.length > 0 && typeof land.candidate === 'string')
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  for (const land of landed) {
    const merges = [];
    for (let id = land.candidate; id !== land.main && graph.has(id) && !merges.includes(id); id = graph.get(id).parents[0]) merges.push(id);
    for (const merge of merges.reverse()) {
      const { parents, subject } = graph.get(merge);
      const pr = Number(MERGE_OF_PR.exec(subject)?.[1]);
      if (parents.length < 2 || !land.landed.includes(pr)) continue;
      for (const id of reachable(graph, parents[1], reachable(graph, parents[0]))) if (!owner.has(id)) owner.set(id, pr);
    }
  }
  return owner;
}

/** Codex input per landed PR, from the records alone. `runs` the run log's lines, `records` the Codex review records,
 * `lands` the merge queue's land records, `doubleReviews` the lines of `double-reviews.jsonl`. `git(args, input)` gives
 * git's standard output or `null`, `defaultRef` the default branch (or `null`), `admitted(rec)` whether a record is
 * evidence (`admittedCodexReviews`), and `coverage({ from, tip, records })` what `reviewCoverage` says of `from..tip`
 * with those records alone. All are handed in, so this module asks nothing of git or the disk itself.
 *
 * A run counts for the PR whose land's merge brought its head in. One of no landed PR is pending (its head on a branch
 * not merged into the default branch), on the default branch by no land record (before lands.jsonl, or merged by
 * hand), or orphaned (its head on no branch: rebased away, or gone). What bought no new reading, each run in the first
 * class that holds it: failed (any outcome but `reviewed`), no record (a `reviewed` run no record names, by `run` or
 * `runs`), and re-read (a code commit of its range covered by a `reviewed` record written before it started, as the
 * push counts it, `beyondTip` off). A remerge run (`diff: 'remerge'`) is no re-read, and a skip record is no reading;
 * `--again` runs are not marked in the run log, so none is left out. A round is a run after a clean pass of the same
 * PR at or below its head on its first-parent line: a record whose runs all found nothing, or a run of a whole range
 * that found nothing, after it ended, whose record may have been refused (L5 counts such a run). The lines reviewed are
 * those of the runs that bought new reading (`part.changedLines`, else `coverage.total`), and tokens a line divide all
 * the PR's input by them. */
export function perLandedPr({ runs, records = [], lands, doubleReviews = [], git, defaultRef = null, admitted = () => true, coverage, baseline = BASELINE }) {
  const graph = commitGraph(git, lands, defaultRef);
  const owner = landedOwners(graph, lands);
  const unlanded = defaultRef ? git(['rev-list', '--branches', '--remotes', '--not', defaultRef]) : '';
  if (unlanded === null) throw new Error('git could not list the commits of the branches not landed');
  const pending = new Set(unlanded.split('\n').map((line) => line.trim()).filter(Boolean));
  const named = new Set(records.flatMap(namesOf));
  const reviewed = records.filter((rec) => rec?.outcome === 'reviewed' && admitted(rec)).sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt));
  const runById = new Map(runs.map((run) => [run?.id, run]));
  const clean = (run) => run?.outcome === 'reviewed' && run.findings?.total === 0;
  const cleanPasses = [
    ...reviewed.filter((rec) => namesOf(rec).length > 0 && namesOf(rec).every((id) => clean(runById.get(id)))).map((rec) => ({ head: rec.head, at: Date.parse(rec.reviewedAt) })),
    // A whole range Codex passed whose record was refused (L4: HEAD moved during the run) is a clean pass too.
    ...runs.filter((run) => clean(run) && (run.part === undefined || run.part?.of === 1)).map((run) => ({ head: run.head, at: Date.parse(run.startedAt) + (Number.isFinite(run.durationMs) ? run.durationMs : 0) })),
  ];
  const reread = rereadOf({ graph, reviewed, coverage });
  const byPr = new Map();
  const unattributed = { pending: [], byNoLand: [], orphaned: [] };
  for (const run of runs) {
    if (typeof run?.head !== 'string') continue;
    const pr = owner.get(run.head);
    if (pr !== undefined) byPr.set(pr, [...(byPr.get(pr) ?? []), run]);
    else unattributed[pending.has(run.head) ? 'pending' : graph.has(run.head) ? 'byNoLand' : 'orphaned'].push(run);
  }
  const prs = [...byPr].sort(([a], [b]) => a - b).map(([pr, own]) => prFigures(pr, own, { named, reread, graph, owner, cleanPasses }));
  const baselineRuns = prs.filter((one) => baseline.prs.includes(one.pr)).flatMap((one) => one.ids.map((id) => runById.get(id)));
  const onDay = baselineRuns.filter((run) => String(run.startedAt).startsWith(baseline.day));
  const listed = (bucket) => ({ ...tally(bucket), ids: bucket.map((run) => run.id), list: bucket.map((run) => ({ id: run.id, startedAt: run.startedAt, head: run.head, inputTokens: tokensOf(run) })) });
  return {
    prs,
    unattributed: Object.fromEntries(Object.entries(unattributed).map(([kind, bucket]) => [kind, listed(bucket)])),
    baseline: { prs: baseline.prs, ...tally(baselineRuns), day: baseline.day, dayInputTokens: tally(onDay).inputTokens },
    doubleReviews: doubleReviewFigures(doubleReviews),
  };
}

/** `run => true | false | null`: whether a code commit of the run's range was covered by a `reviewed` record written
 * before it started, `null` where coverage cannot tell. Only the records whose head lies in the range are handed to
 * `coverage`: with `beyondTip` off one past the tip covers nothing, and a range none reaches is asked nothing. A range
 * the graph cannot walk hands every earlier record. Asked once per range and set of records, which a range's parts
 * share. */
function rereadOf({ graph, reviewed, coverage }) {
  const asked = new Map();
  return (run) => {
    const from = run.from ?? run.base;
    const started = Date.parse(run.startedAt);
    const range = graph.has(run.head) && graph.has(from) ? reachable(graph, run.head, reachable(graph, from)) : null;
    const before = reviewed.filter((rec) => Date.parse(rec.reviewedAt) < started && (range === null || range.has(rec.head)));
    if (before.length === 0) return false;
    const key = `${from}..${run.head}:${before.length}`;
    if (!asked.has(key)) {
      const said = coverage({ from, tip: run.head, records: before });
      const known = !said?.unknown && Array.isArray(said?.codeCommits) && Array.isArray(said.covers);
      asked.set(key, known ? said.codeCommits.some((commit) => said.covers.some(({ rec, covered }) => rec?.outcome === 'reviewed' && covered.has(commit.id))) : null);
    }
    return asked.get(key);
  };
}

/** The figures of one PR from its runs `own`. */
function prFigures(pr, own, { named, reread, graph, owner, cleanPasses }) {
  const sorted = [...own].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const failed = sorted.filter((run) => run.outcome !== 'reviewed');
  const unnamed = sorted.filter((run) => run.outcome === 'reviewed' && !named.has(run.id));
  const rest = sorted.filter((run) => run.outcome === 'reviewed' && named.has(run.id));
  const said = new Map(rest.map((run) => [run, run.diff === 'remerge' ? false : reread(run)]));
  const rereads = rest.filter((run) => said.get(run) === true);
  const bought = rest.filter((run) => said.get(run) !== true);
  // The first-parent line at and below a head, while it stays among the PR's own commits.
  const lineBelow = (head) => {
    const line = new Set();
    for (let id = head; owner.get(id) === pr && !line.has(id); id = graph.get(id)?.parents[0]) line.add(id);
    return line;
  };
  const passes = cleanPasses.filter((pass) => owner.get(pass.head) === pr);
  const rounds = sorted.filter((run) => {
    const line = lineBelow(run.head);
    return passes.some((pass) => pass.at < Date.parse(run.startedAt) && line.has(pass.head));
  });
  const linesOf = (run) => (Number.isFinite(run.part?.changedLines) ? run.part.changedLines : Number.isFinite(run.coverage?.total) ? run.coverage.total : 0);
  const reviewedLines = bought.reduce((sum, run) => sum + linesOf(run), 0);
  const { inputTokens } = tally(sorted);
  return {
    pr,
    ...tally(sorted),
    cachedInputTokens: sorted.reduce((sum, run) => sum + (Number.isFinite(run.usage?.cachedInputTokens) ? run.usage.cachedInputTokens : 0), 0),
    days: [...new Set(sorted.map((run) => String(run.startedAt).slice(0, 10)))],
    ids: sorted.map((run) => run.id),
    failed: tally(failed),
    unnamed: tally(unnamed),
    rereads: tally(rereads),
    coverageUnknown: rest.filter((run) => said.get(run) === null).length,
    rounds: tally(rounds),
    roundIds: rounds.map((run) => run.id),
    reviewedLines,
    tokensPerLine: reviewedLines > 0 ? Math.round(inputTokens / reviewedLines) : null,
  };
}

/** The Codex input of the double reviews (`double-reviews.jsonl`): every `read` line, and the input tokens of its
 * Codex reader. A double review names no PR, so it is counted apart. */
function doubleReviewFigures(lines) {
  const reads = lines.filter((line) => line?.kind === 'read');
  const codex = reads.flatMap((read) => (Array.isArray(read.readers) ? read.readers : []).filter((reader) => reader?.reader === 'codex'));
  return { reads: reads.length, codexReads: codex.length, codexInputTokens: codex.reduce((sum, reader) => sum + (Number.isFinite(reader.usage?.inputTokens) ? reader.usage.inputTokens : 0), 0) };
}

const count = (value) => value.toLocaleString('en-US');
const runsWord = (n) => `${count(n)} ${n === 1 ? 'run' : 'runs'}`;
const spent = ({ runs, inputTokens }) => `${runsWord(runs)} ${count(inputTokens)}`;

/** The lines `js-harness codex-meter --per-pr` prints of `report` (`perLandedPr`). */
export function perPrLines(report) {
  const lines = ['Codex input per landed PR, over all its days (input tokens, the cached ones among them):'];
  for (const pr of report.prs) {
    const perLine = pr.tokensPerLine === null ? 'no line reviewed' : `${count(pr.reviewedLines)} lines reviewed, ${count(pr.tokensPerLine)} tokens a line`;
    const unknown = pr.coverageUnknown > 0 ? `; ${runsWord(pr.coverageUnknown)} whose coverage could not be told` : '';
    lines.push(`PR ${pr.pr}: ${runsWord(pr.runs)}, ${count(pr.inputTokens)} input tokens (${pr.days.join(', ')}); bought no new reading: failed ${spent(pr.failed)}, no record ${spent(pr.unnamed)}, re-read ${spent(pr.rereads)}; rounds after a clean pass ${spent(pr.rounds)}; ${perLine}${unknown}`);
  }
  const { baseline } = report;
  lines.push(`Baseline, PRs ${baseline.prs[0]}-${baseline.prs.at(-1)}: ${runsWord(baseline.runs)}, ${count(baseline.inputTokens)} input tokens over all their days; of them on ${baseline.day} alone: ${count(baseline.dayInputTokens)}`);
  const words = { pending: 'Pending, on a branch not landed', byNoLand: 'On the default branch by no land record', orphaned: 'Orphaned, on no branch (rebased away or gone)' };
  for (const [kind, label] of Object.entries(words)) {
    const bucket = report.unattributed[kind];
    lines.push(`${label}: ${runsWord(bucket.runs)}, ${count(bucket.inputTokens)} input tokens`);
    if (kind !== 'byNoLand') for (const run of bucket.list) lines.push(`  ${run.startedAt} ${String(run.head).slice(0, 12)} ${count(run.inputTokens)}`);
  }
  const doubles = report.doubleReviews;
  lines.push(`Double reviews: ${count(doubles.reads)} reads, ${count(doubles.codexReads)} with a Codex reader, ${count(doubles.codexInputTokens)} Codex input tokens`);
  lines.push('Re-reads leave out remerge runs and skip records; --again runs are not marked in the run log, so none is left out.');
  return lines;
}
