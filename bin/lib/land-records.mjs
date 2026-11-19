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
export const BASELINE = {
  prs: [864, 865, 866, 867, 868],
  day: '2026-11-14',
  // The lead's decisions of 2026-11-18 (odd/tasks/codex-spend.md, L40), said with the baseline they read it by.
  notes: [
    "The depth pass's 306,981 (6ba747e..4977072's passing parts) moved from re-read of covered code alone to re-read beside new: each of those runs also read a code commit no record covered (1d982b38), so T6 compares the beside-new figure.",
    'Rounds are fresh reviews above a clean pass of the same PR: by that rule PR 866 09:28 and PR 868 11:42, 11:49 and 12:10 count, beside L5\'s narrower reading, which did not list them; no criterion tells a review of the next work unit apart, so none is left out.',
  ],
};

/** The subject the merge queue writes on the merge of a PR (bin/lib/pull-request.mjs, `mergeMessage`), which
 * GitHub's merge button writes too. bin/lib/report-git.mjs reads the same subject with a regex it does not export. */
const MERGE_OF_PR = /^Merge pull request #(\d+) from /;

const countOf = (run) => (Number.isFinite(run.usage?.inputTokens) ? run.usage.inputTokens : null);
/** `{ runs, inputTokens }` of `runs`, the tokens of those with a count, and `uncounted`, the runs with none, where any. */
const tally = (runs) => {
  const uncounted = runs.filter((run) => countOf(run) === null).length;
  return { runs: runs.length, inputTokens: runs.reduce((sum, run) => sum + (countOf(run) ?? 0), 0), ...(uncounted > 0 ? { uncounted } : {}) };
};
const namesOf = (rec) => [...(Array.isArray(rec?.runs) ? rec.runs : []), ...(typeof rec?.run === 'string' ? [rec.run] : [])];

/** The commits of the default branch `defaultRef` and of the lands' candidates, as `git` reads them: `graph`, a map of
 * each id to `{ parents, subject }`, and `tip`, the commit `defaultRef` names (`null` without one). A candidate git
 * does not hold is left out (one `cat-file`); the revisions go on standard input, so their number meets no
 * command-line limit. Throws where git cannot read them. */
function commitGraph(git, lands, defaultRef) {
  const candidates = [...new Set(lands.map((land) => land?.candidate).filter((id) => typeof id === 'string'))];
  const asked = [...(defaultRef ? [`${defaultRef}^{commit}`] : []), ...candidates];
  const checked = asked.length === 0 ? '' : git(['cat-file', '--batch-check'], `${asked.join('\n')}\n`);
  if (checked === null) throw new Error('git could not tell which commits of the lands it holds');
  const answers = checked.split('\n').filter((line) => line.trim() !== '').map((line) => line.trim().split(' '));
  const isCommit = ([, type]) => type === 'commit';
  const tip = defaultRef && answers[0] && isCommit(answers[0]) ? answers[0][0] : null;
  const held = answers.slice(defaultRef ? 1 : 0).filter(isCommit).map(([id]) => id);
  const revisions = [...(tip ? [tip] : []), ...held];
  const graph = new Map();
  if (revisions.length === 0) return { graph, tip };
  const log = git(['log', '--stdin', '--format=%H %P%x09%s'], `${revisions.join('\n')}\n`);
  if (log === null) throw new Error('git could not read the commits of the lands');
  for (const line of log.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const [id, ...parents] = line.slice(0, tab).trim().split(' ').filter(Boolean);
    graph.set(id, { parents, subject: line.slice(tab + 1) });
  }
  return { graph, tip };
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

/** The merges of `graph` on the first-parent line from `from` down to `to` (not included), oldest first. */
function firstParentMerges(graph, from, to) {
  const line = [];
  const seen = new Set();
  for (let id = from; id && id !== to && graph.has(id) && !seen.has(id); id = graph.get(id).parents[0]) {
    seen.add(id);
    if (graph.get(id).parents.length >= 2) line.push(id);
  }
  return line.reverse();
}

/** The PR each commit landed with: for each land that landed (exit 0), oldest first, the merges on its candidate's
 * first-parent line above the main it started from whose subject names a PR it landed, and the commits each merge
 * brought in, `<merge>^1..<merge>^2`. A commit two lands brought in is the first one's. Then, as `pullRequestsOf`
 * (bin/lib/report-git.mjs) joins the commits of every merge of one PR, the other merges on the default branch's
 * first-parent line (`tip`) that name a PR a land landed: PR 731 was merged by hand (bd45a5b2) and then by its land
 * (d0cc6e69), which brought in only what the first had not. */
function landedOwners(graph, lands, tip) {
  const owner = new Map();
  const claim = (merge, pr) => {
    const { parents } = graph.get(merge);
    for (const id of reachable(graph, parents[1], reachable(graph, parents[0]))) if (!owner.has(id)) owner.set(id, pr);
  };
  const prOf = (merge) => Number(MERGE_OF_PR.exec(graph.get(merge).subject)?.[1]);
  const landed = lands
    .filter((land) => land?.exit === 0 && Array.isArray(land.landed) && land.landed.length > 0 && typeof land.candidate === 'string')
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const claimed = new Set();
  for (const land of landed) {
    for (const merge of firstParentMerges(graph, land.candidate, land.main)) {
      if (!land.landed.includes(prOf(merge))) continue;
      claimed.add(merge);
      claim(merge, prOf(merge));
    }
  }
  const landedPrs = new Set(landed.flatMap((land) => land.landed));
  for (const merge of firstParentMerges(graph, tip, null)) if (!claimed.has(merge) && landedPrs.has(prOf(merge))) claim(merge, prOf(merge));
  return owner;
}

/** Codex input per landed PR, from the records alone. `runs` the run log's lines, `records` the Codex review records,
 * `lands` the merge queue's land records, `doubleReviews` the lines of `double-reviews.jsonl`. `git(args, input)` gives
 * git's standard output or `null`, `defaultRef` the default branch (or `null`), `admitted(rec)` whether a record is
 * evidence (`admittedCodexReviews`), and `coverage({ from, tip, records })` what `reviewCoverage` says of `from..tip`
 * with those records alone. All are handed in, so this module asks nothing of git or the disk itself.
 *
 * A run counts for the PR whose land's merge brought its head in (`landedOwners`). One of no landed PR is pending (its
 * head on a branch not merged into the default branch), on the default branch by no land record (before lands.jsonl,
 * or merged by hand only), or orphaned (its head on no branch: rebased away, or gone). Each run of a PR is in the first
 * class that holds it: failed (any outcome but `reviewed`), no record (a `reviewed` run no record names, by `run` or
 * `runs`), re-read (a code commit of its range covered by a `reviewed` record written before it started, as the push
 * counts it, `beyondTip` off), or the rest. A re-read whose code commits were all covered bought no new reading; one
 * that also read code no record covered is counted apart, with how many of its code commits were covered. A remerge
 * run (`diff: 'remerge'`) is no re-read, and a skip record is no reading; `--again` runs are not marked in the run log,
 * so none is left out. A run with no token count is counted as a run and its tokens as unknown (`uncounted`).
 *
 * The runs that bought new reading are the `reviewed` runs a record names that are no re-read of covered code alone;
 * tokens a line are their input over their changed lines (`coverage.total`, which every run line carries; `part`
 * lacks on lines of whole ranges written before parts). A round, as L5 measured it, is a fresh review (`reviewed`, no
 * `recheck`, no remerge) whose head lies above a clean pass of the same PR on its first-parent line, started after
 * that pass: a record whose runs all found nothing, or a run of a whole range that found nothing, whose record may
 * have been refused (L4). Rounds overlap the classes above. */
export function perLandedPr({ runs, records = [], lands, doubleReviews = [], git, defaultRef = null, admitted = () => true, coverage, baseline = BASELINE }) {
  const { graph, tip } = commitGraph(git, lands, defaultRef);
  const owner = landedOwners(graph, lands, tip);
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
  const listed = (bucket) => ({ ...tally(bucket), ids: bucket.map((run) => run.id), list: bucket.map((run) => ({ id: run.id, startedAt: run.startedAt, head: run.head, inputTokens: countOf(run) })) });
  return {
    prs,
    unattributed: Object.fromEntries(Object.entries(unattributed).map(([kind, bucket]) => [kind, listed(bucket)])),
    baseline: {
      prs: baseline.prs,
      ...tally(baselineRuns),
      uncountedRuns: baselineRuns.filter((run) => countOf(run) === null).map((run) => ({ id: run.id, startedAt: run.startedAt })),
      day: baseline.day,
      dayInputTokens: tally(onDay).inputTokens,
      notes: baseline.notes ?? [],
    },
    doubleReviews: doubleReviewFigures(doubleReviews),
  };
}

/** `run => { covered, code } | false | null`: how many of the code commits of the run's range a `reviewed` record
 * written before it started covered, of how many, where any was; `false` where none was, `null` where coverage cannot
 * tell. Only the records whose head lies in the range are handed to `coverage`: with `beyondTip` off one past the tip
 * covers nothing, and a range none reaches is asked nothing. A range the graph cannot walk hands every earlier record.
 * Asked once per range and set of records, which a range's parts share. */
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
      const covered = known ? said.codeCommits.filter((commit) => said.covers.some(({ rec, covered: ids }) => rec?.outcome === 'reviewed' && ids.has(commit.id))).length : null;
      asked.set(key, covered === null ? null : covered > 0 && { covered, code: said.codeCommits.length });
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
  const onlyCovered = (run) => said.get(run) && said.get(run).covered === said.get(run).code;
  const rereadOnly = rest.filter(onlyCovered);
  const rereadBeside = rest.filter((run) => said.get(run) && !onlyCovered(run));
  const bought = rest.filter((run) => !onlyCovered(run));
  // The first-parent line below a head, while it stays among the PR's own commits.
  const lineBelow = (head) => {
    const line = new Set();
    for (let id = graph.get(head)?.parents[0]; owner.get(id) === pr && !line.has(id); id = graph.get(id)?.parents[0]) line.add(id);
    return line;
  };
  const passes = cleanPasses.filter((pass) => owner.get(pass.head) === pr);
  const fresh = (run) => run.outcome === 'reviewed' && run.recheck === undefined && run.diff !== 'remerge';
  // Commits above a clean pass: the range starts at the pass's head or above it, so a range from below it is no round.
  const rounds = sorted.filter((run) => {
    if (!fresh(run)) return false;
    const from = run.from ?? run.base;
    const startLine = new Set([from, ...lineBelow(from)]);
    return passes.some((pass) => pass.at < Date.parse(run.startedAt) && startLine.has(pass.head));
  });
  const reviewedLines = bought.reduce((sum, run) => sum + (Number.isFinite(run.coverage?.total) ? run.coverage.total : 0), 0);
  const boughtInputTokens = tally(bought).inputTokens;
  const sum = (list, field) => list.reduce((total, run) => total + said.get(run)[field], 0);
  return {
    pr,
    ...tally(sorted),
    cachedInputTokens: sorted.reduce((total, run) => total + (Number.isFinite(run.usage?.cachedInputTokens) ? run.usage.cachedInputTokens : 0), 0),
    days: [...new Set(sorted.map((run) => String(run.startedAt).slice(0, 10)))],
    ids: sorted.map((run) => run.id),
    failed: tally(failed),
    unnamed: tally(unnamed),
    rereadOnly: tally(rereadOnly),
    rereadBeside: { ...tally(rereadBeside), covered: sum(rereadBeside, 'covered'), code: sum(rereadBeside, 'code') },
    coverageUnknown: rest.filter((run) => said.get(run) === null).length,
    rounds: tally(rounds),
    roundIds: rounds.map((run) => run.id),
    reviewedLines,
    boughtInputTokens,
    tokensPerLine: reviewedLines > 0 ? Math.round(boughtInputTokens / reviewedLines) : null,
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
/** `<n> runs`, saying how many of them had no count (they are among the n, not beside them). */
function runsCounted(runs, uncounted = 0) {
  return uncounted ? `${runsWord(runs)} (${count(uncounted)} of them with no count)` : runsWord(runs);
}

/** A tally as `<n> runs <tokens>`, saying where runs had no count. */
function spent({ runs, inputTokens, uncounted = 0 }) {
  if (uncounted === 0) return `${runsWord(runs)} ${count(inputTokens)}`;
  if (uncounted === runs) return `${runsWord(runs)}, tokens unknown`;
  return `${runsCounted(runs, uncounted)} ${count(inputTokens)}`;
}

/** The lines `js-harness codex-meter --per-pr` prints of `report` (`perLandedPr`). */
export function perPrLines(report) {
  const lines = ['Codex input per landed PR, over all its days (input tokens, the cached ones among them):'];
  for (const pr of report.prs) {
    // The beside-new runs bought new reading too: their tokens are among "tokens of theirs", not to be added to them.
    const perLine = pr.tokensPerLine === null ? 'no line reviewed' : `${count(pr.reviewedLines)} lines reviewed by the runs that bought new reading${pr.rereadBeside.runs > 0 ? ', the beside-new runs among them' : ''}, ${count(pr.boughtInputTokens)} tokens of theirs, ${count(pr.tokensPerLine)} a line`;
    const unknown = pr.coverageUnknown > 0 ? `; ${runsWord(pr.coverageUnknown)} whose coverage could not be told` : '';
    const beside = `re-read covered code beside new ${spent(pr.rereadBeside)} (${count(pr.rereadBeside.covered)} of ${count(pr.rereadBeside.code)} code commits already covered)`;
    lines.push(`PR ${pr.pr}: ${runsCounted(pr.runs, pr.uncounted)}, ${count(pr.inputTokens)} input tokens (${count(pr.cachedInputTokens)} of them cached) (${pr.days.join(', ')}); bought no new reading: failed ${spent(pr.failed)}, no record ${spent(pr.unnamed)}, re-read of covered code alone ${spent(pr.rereadOnly)}; ${beside}; ${perLine}${unknown}`);
    lines.push(`  rounds after a clean pass (they overlap the classes above; do not add them): ${spent(pr.rounds)}`);
  }
  const { baseline } = report;
  const uncountedList = (baseline.uncountedRuns ?? []).map((run) => `${run.id}, ${run.startedAt}`).join('; ');
  const baselineRuns = baseline.uncounted ? `${runsWord(baseline.runs)} (${count(baseline.uncounted)} of them with no count: ${uncountedList})` : runsWord(baseline.runs);
  lines.push(`Baseline, PRs ${baseline.prs[0]}-${baseline.prs.at(-1)}: ${baselineRuns} over all their days, ${count(baseline.inputTokens)} input tokens; of them on ${baseline.day} alone: ${count(baseline.dayInputTokens)}`);
  // The notes speak of this repository's baseline runs; a repository that holds none of them is not told them.
  if (baseline.runs > 0) for (const note of baseline.notes ?? []) lines.push(`  ${note}`);
  const alone = report.prs.filter((pr) => pr.rereadOnly.runs > 0).length;
  lines.push(`Re-read of covered code alone: ${count(alone)} of ${count(report.prs.length)} ${report.prs.length === 1 ? 'PR' : 'PRs'}`);
  const words = { pending: 'Pending, on a branch not landed', byNoLand: 'On the default branch by no land record', orphaned: 'Orphaned, on no branch (rebased away or gone)' };
  for (const [kind, label] of Object.entries(words)) {
    const bucket = report.unattributed[kind];
    lines.push(`${label}: ${runsCounted(bucket.runs, bucket.uncounted)}, ${count(bucket.inputTokens)} input tokens`);
    if (kind !== 'byNoLand') for (const run of bucket.list) lines.push(`  ${run.startedAt} ${String(run.head).slice(0, 12)} ${run.inputTokens === null ? 'unknown' : count(run.inputTokens)}`);
  }
  const doubles = report.doubleReviews;
  lines.push(`Double reviews: ${count(doubles.reads)} reads, ${count(doubles.codexReads)} with a Codex reader, ${count(doubles.codexInputTokens)} Codex input tokens`);
  lines.push('Re-reads leave out remerge runs and skip records; --again runs are not marked in the run log, so none is left out.');
  return lines;
}
