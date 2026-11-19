import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withoutAutoMaintenance } from './git-fixture.testkit.mjs';
import { busySeconds, codexFacts, landFacts, median, perLandedPr, perPrLines, readRecordLines } from './land-records.mjs';

const from = Date.parse('2026-10-16T00:00:00Z');
const to = Date.parse('2026-10-17T00:00:00Z');

test('busy time is the union of the runs, so two gates at once count once', () => {
  assert.equal(busySeconds([[0, 100_000], [50_000, 150_000], [200_000, 260_000]]), 210);
  assert.equal(busySeconds([]), 0);
});

test('the median of a list, null for none', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('the Codex runs of a day, with their seconds and outcome', () => {
  const runs = [
    { startedAt: '2026-10-15T23:59:59Z', durationMs: 1000, outcome: 'reviewed' },
    { startedAt: '2026-10-16T08:00:00Z', durationMs: 49_000, outcome: 'reviewed' },
    { startedAt: '2026-10-16T09:00:00Z', outcome: 'failed' },
  ];
  runs[1].findings = { total: 2 };
  runs[1].part = { index: 1, of: 2 };
  assert.deepEqual(codexFacts(runs, { from, to }), [
    { startedAt: '2026-10-16T08:00:00Z', seconds: 49, outcome: 'reviewed', findings: 2, part: true, reason: null },
    { startedAt: '2026-10-16T09:00:00Z', seconds: null, outcome: 'failed', findings: null, part: false, reason: null },
  ]);
});

// docs/sessions/2026-10-29-jh-79-visual-pages-the-harness-shows-its-moments-as-pages.md, "Left": the pages read
// these facts, and a failure lost the words that say why it failed.
test('a land keeps the last line it said, and a Codex run the reason it was logged with', () => {
  const day = { from: Date.parse('2026-10-29T00:00:00Z'), to: Date.parse('2026-10-30T00:00:00Z') };
  const land = (said) => ({ v: 1, startedAt: '2026-10-29T05:00:00Z', endedAt: '2026-10-29T05:05:00Z', considered: [1], landed: [], phases: [], exit: 1, ...said });
  const lands = landFacts([land({ said: 'PR 644 was refused at push: its head is past the reviewed range' }), land({}), land({ said: 7 })], day);
  assert.deepEqual(lands.map((one) => one.said), ['PR 644 was refused at push: its head is past the reviewed range', null, null]);
  const run = (reason) => ({ startedAt: '2026-10-29T06:00:00Z', durationMs: 1000, outcome: 'failed', ...reason });
  const runs = codexFacts([run({ reason: 'the session ran gpt-5.4 at low, not gpt-5.5 at high' }), run({}), run({ reason: { not: 'words' } })], day);
  assert.deepEqual(runs.map((one) => one.reason), ['the session ran gpt-5.4 at low, not gpt-5.5 at high', null, null]);
});

test('the lands of a day, in order, with their seconds, exit and counts, and none outside it or without a time', () => {
  const land = (startedAt, exit, phases) => ({ v: 1, startedAt, endedAt: new Date(Date.parse(startedAt) + 300_000).toISOString(), considered: [1, 2], landed: exit === 0 ? [1] : [], phases, exit });
  const records = [
    land('2026-10-16T07:00:00Z', 1, []),
    land('2026-10-16T05:00:00Z', 0, [{ phase: 'suite', seconds: 270, ok: true }, { phase: 'push', seconds: 4 }, { phase: 'bad' }]),
    land('2026-10-15T23:00:00Z', 0, []),
    { v: 1, startedAt: 'not a time' },
    null,
  ];
  assert.deepEqual(landFacts(records, { from, to }), [
    { startedAt: '2026-10-16T05:00:00Z', seconds: 300, exit: 0, landed: 1, considered: 2, phases: [{ phase: 'suite', seconds: 270, ok: true }, { phase: 'push', seconds: 4, ok: null }], said: null },
    { startedAt: '2026-10-16T07:00:00Z', seconds: 300, exit: 1, landed: 0, considered: 2, phases: [], said: null },
  ]);
});

test('a record file reads as its JSON objects: none for no file or one not there, a throw for one that cannot be read', () => {
  const fileSystem = (read) => ({ readFileSync: read });
  assert.deepEqual(readRecordLines(null, fileSystem(() => assert.fail('no file is read'))), []);
  const missing = Object.assign(new Error('gone'), { code: 'ENOENT' });
  assert.deepEqual(readRecordLines('lands.jsonl', fileSystem(() => { throw missing; })), []);
  const denied = Object.assign(new Error('denied'), { code: 'EACCES' });
  assert.throws(() => readRecordLines('lands.jsonl', fileSystem(() => { throw denied; })), /EACCES/);
  const text = '{"a":1}\r\n{broken\n[1,2]\n"word"\nnull\n\n{"b":2}\n';
  assert.deepEqual(readRecordLines('lands.jsonl', fileSystem(() => text)), [{ a: 1 }, { b: 2 }]);
});

// Spec 6 of odd/tasks/codex-spend.md: Codex input per landed PR. A run counts for the PR whose land's merge brought its
// head in (`<merge>^1..<merge>^2`). The attribution tests read a real repository, built once by one `git fast-import`.
const data = (text) => `data ${Buffer.byteLength(text)}\n${text}`;
const commitText = (mark, ref, subject, from, merge) => [
  `commit ${ref}`, `mark :${mark}`, `committer T <t@example.com> ${1_700_000_000 + mark * 60} +0000`, data(subject),
  ...(from ? [`from :${from}`] : []), ...(merge ? [`merge :${merge}`] : []), `M 644 inline f${mark}.mjs`, data(`export const n = ${mark};`), '',
].join('\n');
// main: m0, then the merges of PR 1, of PR 2 (stacked on PR 1), of PR 3 (rebased onto PR 2's merge), of PR 5, which only a
// failed land names, and PR 7 twice: by hand (13), then by its land (15). PR 3's head from before its rebase stays on a ref
// that is no branch; PR 4 is an open branch; 16 is the candidate of a later land that brought PR 3's commit in again.
const LAYOUT = [
  [1, 'refs/heads/main', 'm0'], [2, 'refs/heads/a', 'a1', 1], [3, 'refs/heads/b', 'b1', 2],
  [4, 'refs/heads/main', 'Merge pull request #1 from a', 1, 2], [5, 'refs/heads/main', 'Merge pull request #2 from b', 4, 3],
  [6, 'refs/before-rebase/r', 'r1', 1], [7, 'refs/heads/r', 'r1', 5], [8, 'refs/heads/main', 'Merge pull request #3 from r', 5, 7],
  [9, 'refs/heads/d', 'd1', 8], [10, 'refs/heads/main', 'Merge pull request #5 from d', 8, 9], [11, 'refs/heads/open', 'p1', 10],
  [12, 'refs/heads/h', 'h1', 10], [13, 'refs/heads/main', 'Merge pull request #7 from h', 10, 12], [14, 'refs/heads/h', 'h2', 12],
  [15, 'refs/heads/main', 'Merge pull request #7 from h', 13, 14], [16, 'refs/heads/other', 'Merge pull request #6 from r', 5, 7],
];
let built = null;
function layoutRepo() {
  if (built) return built;
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-land-records-'));
  process.once('exit', () => fs.rmSync(repo, { recursive: true, force: true }));
  const marks = path.join(repo, 'marks');
  withoutAutoMaintenance(() => {
    assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0);
    const stream = LAYOUT.map(([mark, ref, subject, from, merge]) => commitText(mark, ref, subject, from, merge)).join('');
    const imported = spawnSync('git', ['fast-import', '--quiet', `--export-marks=${marks}`], { cwd: repo, input: stream, encoding: 'utf8' });
    assert.equal(imported.status, 0, imported.stderr);
  });
  const id = Object.fromEntries(fs.readFileSync(marks, 'utf8').trim().split('\n').map((line) => line.slice(1).split(' ')));
  const git = (args, input) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', input });
    return result.status === 0 ? result.stdout : null;
  };
  const land = (startedAt, main, candidate, landed, exit = 0) => ({ startedAt, main: id[main], candidate: id[candidate], landed, exit });
  // Out of time order on purpose: the land of PR 6, later than PR 3's, comes first in the file.
  const lands = [
    land('2026-11-01T04:00:00Z', 5, 16, [6]), land('2026-11-01T01:00:00Z', 1, 4, [1]), land('2026-11-01T02:00:00Z', 4, 5, [2]),
    land('2026-11-01T03:00:00Z', 5, 8, [3]), land('2026-11-01T03:30:00Z', 8, 10, [5], 1), land('2026-11-01T05:00:00Z', 13, 15, [7]),
  ];
  built = { id, git, lands };
  return built;
}
const layoutRun = (name, mark, from, extra = {}) => ({ id: name, startedAt: '2026-11-01T00:30:00Z', from, base: from, head: mark, outcome: 'reviewed', usage: { inputTokens: 1000 }, ...extra });
function layoutReport(runs, more = {}) {
  const { id, git, lands } = layoutRepo();
  const shaped = runs.map((run) => ({ ...run, from: id[run.from] ?? run.from, base: id[run.base] ?? run.base, head: id[run.head] ?? run.head }));
  return perLandedPr({ runs: shaped, records: [], lands, git, defaultRef: 'refs/heads/main', coverage: () => assert.fail('no record to cover'), ...more });
}
const prOf = (report, pr) => report.prs.find((one) => one.pr === pr);

test('per landed PR: a stacked PR\'s run counts for the PR whose merge brought its head in, not for the PR below it', () => {
  const report = layoutReport([layoutRun('on-a', 2, 1), layoutRun('on-b', 3, 2, { usage: { inputTokens: 5000 } })]);
  assert.deepEqual(prOf(report, 1).ids, ['on-a']);
  assert.equal(prOf(report, 1).inputTokens, 1000);
  assert.deepEqual(prOf(report, 2).ids, ['on-b']);
  assert.equal(prOf(report, 2).inputTokens, 5000);
});

test('per landed PR: a run on a head that was rebased away is orphaned, and the run on the rebased head counts for the PR', () => {
  const report = layoutReport([layoutRun('before', 6, 1), layoutRun('after', 7, 5)]);
  assert.deepEqual(prOf(report, 3).ids, ['after']);
  assert.deepEqual(report.unattributed.orphaned.ids, ['before']);
});

test('per landed PR: a run of no landed PR is pending on an open branch, on the default branch by no land, or orphaned', () => {
  const report = layoutReport([layoutRun('open', 11, 10), layoutRun('direct', 9, 8), layoutRun('gone', 'f'.repeat(40), 1)]);
  assert.deepEqual(report.prs, []);
  assert.deepEqual(report.unattributed.pending.ids, ['open']);
  assert.deepEqual(report.unattributed.byNoLand.ids, ['direct']);
  assert.deepEqual(report.unattributed.orphaned.ids, ['gone']);
  assert.equal(report.unattributed.orphaned.inputTokens, 1000);
});

test('per landed PR: a merge brings in only what its first parent lacks, so the first land does not claim the history below it', () => {
  const report = layoutReport([layoutRun('root', 1, 1)]);
  assert.deepEqual(report.prs, []);
  assert.deepEqual(report.unattributed.byNoLand.ids, ['root']);
});

test('per landed PR: a land that failed lands nothing, though its record names a PR', () => {
  // PR 5's merge is on main, but the only land that names it exited 1.
  const report = layoutReport([layoutRun('direct', 9, 8)]);
  assert.equal(prOf(report, 5), undefined);
  assert.deepEqual(report.unattributed.byNoLand.ids, ['direct']);
});

test('per landed PR: a commit two lands brought in is the first land\'s, whatever the order of the file', () => {
  const report = layoutReport([layoutRun('on-r', 7, 5)]);
  assert.deepEqual(prOf(report, 3).ids, ['on-r']);
  assert.equal(prOf(report, 6), undefined);
});

test('per landed PR: a PR merged twice, by hand and then by its land, keeps the runs of both merges', () => {
  const report = layoutReport([layoutRun('by-hand', 12, 10), layoutRun('by-land', 14, 12)]);
  assert.deepEqual(prOf(report, 7).ids, ['by-hand', 'by-land']);
  assert.deepEqual(report.unattributed.byNoLand.ids, []);
});

test('per landed PR: failed, unnamed and re-read runs apart, re-reads beside new code apart from those of covered code alone, remerge runs and skip records left out', () => {
  const { id } = layoutRepo();
  const at = (minute) => `2026-11-01T06:${minute}:00Z`;
  const lines = (total) => ({ coverage: { seen: total, total } });
  const runs = [
    layoutRun('first', 12, 10, { startedAt: at(10), findings: { total: 0 }, ...lines(40) }),
    layoutRun('failed', 14, 12, { startedAt: at(20), outcome: 'failed', usage: { inputTokens: 300 } }),
    layoutRun('unnamed', 14, 12, { startedAt: at(22), usage: { inputTokens: 400 }, findings: { total: 0 } }),
    layoutRun('fresh', 14, 12, { startedAt: at(24), usage: { inputTokens: 500 }, findings: { total: 1 }, ...lines(10) }),
    layoutRun('recheck', 14, 12, { startedAt: at(26), usage: { inputTokens: 200 }, findings: { total: 0 }, recheck: { of: 'x' }, ...lines(5) }),
    layoutRun('remerge', 14, 12, { startedAt: at(28), usage: { inputTokens: 700 }, diff: 'remerge', findings: { total: 0 }, ...lines(25) }),
    layoutRun('again', 14, 12, { startedAt: at(30), usage: { inputTokens: 600 }, findings: { total: 0 }, ...lines(10) }),
    layoutRun('beside', 14, 10, { startedAt: at(40), usage: { inputTokens: 800 }, findings: { total: 0 }, ...lines(20) }),
    layoutRun('same', 12, 10, { startedAt: at(45), usage: { inputTokens: 100 }, findings: { total: 0 }, ...lines(40) }),
    layoutRun('no-count', 14, 12, { startedAt: at(50), outcome: 'failed', usage: {} }),
  ];
  const record = (run, head, minute, outcome = 'reviewed') => ({ base: id[10], head: id[head], reviewedAt: at(minute), outcome, ...(run ? { run } : {}) });
  const records = [record('first', 12, 12), record(null, 14, 23, 'unavailable'), record('fresh', 14, 25), record('recheck', 14, 27), record('remerge', 14, 29), record('again', 14, 31), record('beside', 14, 41), record('same', 12, 46)];
  // How many of its code commits each range asked held covered, by its tip and the records handed in.
  const answers = { [`${id[14]}:1`]: [0, 1], [`${id[14]}:3`]: [1, 1], [`${id[14]}:5`]: [1, 2], [`${id[12]}:1`]: [1, 1] };
  const asked = [];
  const coverage = ({ tip, records: before }) => {
    asked.push(before.map((rec) => rec.reviewedAt));
    const [covered, code] = answers[`${tip}:${before.length}`];
    const ids = Array.from({ length: code }, (_, n) => `c${n}`);
    return { codeCommits: ids.map((one) => ({ id: one })), covers: [{ rec: before[0], covered: new Set(ids.slice(0, covered)) }] };
  };
  const pr = prOf(layoutReport(runs, { records, coverage }), 7);
  assert.equal(pr.runs, 10);
  assert.deepEqual({ inputTokens: pr.inputTokens, uncounted: pr.uncounted }, { inputTokens: 4600, uncounted: 1 });
  assert.deepEqual(pr.failed, { runs: 2, inputTokens: 300, uncounted: 1 });
  assert.deepEqual(pr.unnamed, { runs: 1, inputTokens: 400 });
  assert.deepEqual(pr.rereadOnly, { runs: 2, inputTokens: 700 });
  assert.deepEqual(pr.rereadBeside, { runs: 1, inputTokens: 800, covered: 1, code: 2 });
  // Only `reviewed` records written before each run, never the skip; the remerge run is asked nothing.
  assert.equal(asked.length, 4);
  assert.ok(!asked.flat().includes(at(23)), 'the skip record is handed to no coverage');
  // Tokens a line: the runs that bought new reading, both sides: first, fresh, recheck, remerge and beside.
  assert.deepEqual({ lines: pr.reviewedLines, tokens: pr.boughtInputTokens, perLine: pr.tokensPerLine }, { lines: 100, tokens: 3200, perLine: 32 });
});

test('per landed PR: the lines reviewed are the changed lines Codex was handed, coverage.total, where a run also carries part.changedLines', () => {
  const run = layoutRun('both', 12, 10, { coverage: { seen: 40, total: 40 }, part: { index: 1, of: 1, files: 1, changedLines: 999 } });
  const { id } = layoutRepo();
  const records = [{ base: id[10], head: id[12], reviewedAt: '2026-11-01T00:31:00Z', outcome: 'reviewed', run: 'both' }];
  assert.equal(prOf(layoutReport([run], { records }), 7).reviewedLines, 40);
});

test('per landed PR: a round is a fresh review that passed no failure, above a clean pass on the PR\'s first-parent line', () => {
  const { id } = layoutRepo();
  const at = (minute) => `2026-11-01T07:${minute}:00Z`;
  const runs = [
    layoutRun('clean', 12, 10, { startedAt: at(10), findings: { total: 0 } }),
    layoutRun('above', 14, 12, { startedAt: at(20), findings: { total: 2 } }),
    layoutRun('failed-above', 14, 12, { startedAt: at(22), outcome: 'failed' }),
    layoutRun('recheck-above', 14, 12, { startedAt: at(24), recheck: { of: 'x' }, findings: { total: 0 } }),
    layoutRun('remerge-above', 14, 12, { startedAt: at(26), diff: 'remerge', findings: { total: 0 } }),
    layoutRun('at-the-pass', 12, 10, { startedAt: at(28), findings: { total: 0 } }),
    layoutRun('from-below', 14, 10, { startedAt: at(30), findings: { total: 0 } }),
  ];
  const records = runs.filter((run) => run.outcome === 'reviewed').map((run) => ({ base: id[run.from], head: id[run.head], reviewedAt: at(Number(run.startedAt.slice(14, 16)) + 1), outcome: 'reviewed', run: run.id }));
  const coverage = () => ({ codeCommits: [], covers: [] });
  const pr = prOf(layoutReport(runs, { records, coverage }), 7);
  assert.deepEqual(pr.roundIds, ['above']);
  assert.deepEqual(pr.rounds, { runs: 1, inputTokens: 1000 });
});

test('per landed PR: a clean part of a range in parts is no clean pass, and a pass counts only for a run started after it ended', () => {
  const { id } = layoutRepo();
  const at = (minute) => `2026-11-01T08:${minute}:00Z`;
  const runs = [
    layoutRun('part-1', 12, 10, { startedAt: at(10), findings: { total: 0 }, part: { index: 1, of: 2, files: 1, changedLines: 5 } }),
    layoutRun('part-2', 12, 10, { startedAt: at(11), findings: { total: 1 }, part: { index: 2, of: 2, files: 1, changedLines: 5 } }),
    layoutRun('after-parts', 14, 12, { startedAt: at(20), findings: { total: 0 } }),
    // A whole range Codex passed, with no record, that ran from 08:22 to 08:32.
    layoutRun('long-pass', 12, 10, { startedAt: at(22), durationMs: 10 * 60_000, findings: { total: 0 } }),
    layoutRun('during-pass', 14, 12, { startedAt: at(25), findings: { total: 0 } }),
  ];
  const records = [
    { base: id[10], head: id[12], reviewedAt: at(12), outcome: 'reviewed', runs: ['part-1', 'part-2'] },
    { base: id[12], head: id[14], reviewedAt: at(21), outcome: 'reviewed', run: 'after-parts' },
    { base: id[12], head: id[14], reviewedAt: at(26), outcome: 'reviewed', run: 'during-pass' },
  ];
  const coverage = () => ({ codeCommits: [], covers: [] });
  assert.deepEqual(prOf(layoutReport(runs, { records, coverage }), 7).roundIds, []);
});

test('per landed PR: the fixture of PRs 864-868 gives the baseline, 3,173,294 over all their days and 3,053,278 on 2026-11-14', () => {
  const runs = BASELINE_RUNS.map(([id, startedAt, durationMs, from, head, outcome, inputTokens, total, findings, recheck, , , of]) => ({
    id, startedAt, durationMs, from, base: from, head, outcome, usage: inputTokens === null ? {} : { inputTokens }, coverage: { seen: total, total },
    findings: { total: findings }, ...(recheck ? { recheck: { of: from } } : {}), ...(of === null ? {} : { part: { of } }),
  }));
  const records = BASELINE_RECORDS.map(([base, head, reviewedAt, names]) => ({ base, head, reviewedAt, outcome: 'reviewed', runs: names }));
  // What `reviewCoverage` gave for each range on the real records: how many of its code commits a record covered, of how many.
  const counts = new Map(BASELINE_RUNS.map((run) => [`${run[3]}..${run[4]}`, [run[10], run[11]]]));
  const coverage = ({ from, tip }) => {
    const [covered, code] = counts.get(`${from}..${tip}`);
    const ids = Array.from({ length: code }, (_, n) => `c${n}`);
    return { codeCommits: ids.map((one) => ({ id: one })), covers: [{ rec: { outcome: 'reviewed' }, covered: new Set(ids.slice(0, covered)) }] };
  };
  const git = (args, input) => {
    if (args[0] === 'cat-file') return input.split('\n').filter(Boolean).map((one) => `${one} commit 1`).join('\n');
    if (args[0] === 'log') return BASELINE_COMMITS.join('\n');
    return '';
  };
  const report = perLandedPr({ runs, records, lands: BASELINE_LANDS, git, defaultRef: null, coverage });
  // L3: PR 864 counts its run of 2026-11-13 (230,174; 110,158 without it).
  assert.deepEqual(report.prs.map((pr) => [pr.pr, pr.runs, pr.inputTokens]), [[864, 3, 230_174], [865, 2, 172_425], [866, 12, 1_280_533], [867, 11, 1_025_087], [868, 7, 465_075]]);
  const { notes, ...baseline } = report.baseline;
  const noCount = runs.find((run) => run.startedAt.startsWith('2026-11-14T12:16'));
  assert.deepEqual(baseline, { prs: [864, 865, 866, 867, 868], runs: 35, inputTokens: 3_173_294, uncounted: 1, uncountedRuns: [{ id: noCount.id, startedAt: noCount.startedAt }], day: '2026-11-14', dayInputTokens: 3_053_278 });
  // The lead's two decisions of 2026-11-18 (L38), said with the baseline.
  assert.ok(notes.some((note) => /306,981/.test(note) && /beside new/.test(note)), notes.join('\n'));
  assert.ok(notes.some((note) => /866 09:28/.test(note) && /868 11:42, 11:49 and 12:10/.test(note) && /L5/.test(note)), notes.join('\n'));
  assert.deepEqual(prOf(report, 866).failed, { runs: 1, inputTokens: 220_599 });
  assert.deepEqual(prOf(report, 867).failed, { runs: 1, inputTokens: 65_993 });
  assert.deepEqual(prOf(report, 868).failed, { runs: 1, inputTokens: 0, uncounted: 1 });
  assert.deepEqual(prOf(report, 867).unnamed, { runs: 1, inputTokens: 79_096 });
  // Each re-read also read one code commit no record covered (1de6ed65; 1d982b38; 2e3b9f94), so none is of covered code alone.
  assert.deepEqual(report.prs.map((pr) => pr.rereadOnly), report.prs.map(() => ({ runs: 0, inputTokens: 0 })));
  assert.deepEqual(prOf(report, 866).rereadBeside, { runs: 3, inputTokens: 528_631, covered: 21, code: 24 });
  assert.deepEqual(prOf(report, 867).rereadBeside, { runs: 3, inputTokens: 383_029, covered: 11, code: 14 });
  // L5's fresh reviews of small follow-ups after a clean pass, PR by PR: 864 and 867 as L5 lists them; 866 has 09:28
  // and 868 three that L5 does not list, each a fresh review whose range starts above a clean pass of its PR: 866 09:28
  // and 868 11:42 above a clean recheck, 868 11:49 and 12:10 above a fresh review that found nothing.
  const startsOf = (pr) => prOf(report, pr).roundIds.map((one) => runs.find((run) => run.id === one).startedAt.slice(11, 16));
  assert.deepEqual([864, 865, 866, 867, 868].map(startsOf), [['08:17'], [], ['09:00', '09:28', '09:50', '10:01'], ['09:46', '09:55', '10:05', '10:52'], ['11:42', '11:49', '12:10']]);
});

test('per landed PR: the report prints a line for each PR, its rounds apart, the baseline with its day apart, the runs of no landed PR, and the double reviews', () => {
  const pr = {
    pr: 867, runs: 11, inputTokens: 1_025_087, uncounted: 1, cachedInputTokens: 600_000, days: ['2026-11-14'], failed: { runs: 1, inputTokens: 0, uncounted: 1 }, unnamed: { runs: 1, inputTokens: 79_096 },
    rereadOnly: { runs: 0, inputTokens: 0 }, rereadBeside: { runs: 3, inputTokens: 383_029, covered: 11, code: 14 }, rounds: { runs: 4, inputTokens: 268_342 },
    reviewedLines: 1_000, boughtInputTokens: 700_000, tokensPerLine: 700, coverageUnknown: 0,
  };
  const none = { runs: 0, inputTokens: 0, ids: [], list: [] };
  const report = {
    prs: [pr],
    unattributed: { pending: { runs: 2, inputTokens: 10, uncounted: 1, ids: ['p', 'q'], list: [{ id: 'p', startedAt: '2026-11-15T00:00:00Z', head: 'abcdef1234567', inputTokens: 10 }, { id: 'q', startedAt: '2026-11-15T01:00:00Z', head: 'abcdef1234567', inputTokens: null }] }, byNoLand: none, orphaned: none },
    baseline: { prs: [864, 865, 866, 867, 868], runs: 35, inputTokens: 3_173_294, uncounted: 1, uncountedRuns: [{ id: 'ba57f25b-0000', startedAt: '2026-11-14T12:16:11.982Z' }], day: '2026-11-14', dayInputTokens: 3_053_278, notes: ['A note.'] },
    doubleReviews: { reads: 2, codexReads: 1, codexInputTokens: 720_239 },
  };
  const lines = perPrLines(report);
  const has = (line) => assert.ok(lines.includes(line), `${line}\nnot in\n${lines.join('\n')}`);
  has('PR 867: 11 runs, 1,025,087 input tokens (600,000 of them cached) and 1 run with no count (2026-11-14); bought no new reading: failed 1 run, tokens unknown, no record 1 run 79,096, re-read of covered code alone 0 runs 0; re-read covered code beside new 3 runs 383,029 (11 of 14 code commits already covered); 1,000 lines reviewed by the runs that bought new reading, the beside-new runs among them, 700,000 tokens of theirs, 700 a line');
  has('  rounds after a clean pass (they overlap the classes above; do not add them): 4 runs 268,342');
  has('Baseline, PRs 864-868: 35 runs over all their days, 3,173,294 input tokens, and 1 run with no count (ba57f25b-0000, 2026-11-14T12:16:11.982Z); of them on 2026-11-14 alone: 3,053,278');
  has('  A note.');
  has('Re-read of covered code alone: 0 of 1 PR');
  has('Pending, on a branch not landed: 2 runs, 10 input tokens and 1 run with no count');
  has('  2026-11-15T00:00:00Z abcdef123456 10');
  has('  2026-11-15T01:00:00Z abcdef123456 unknown');
  has('Double reviews: 2 reads, 1 with a Codex reader, 720,239 Codex input tokens');
  assert.ok(lines.some((line) => /--again/.test(line) && /not mark/.test(line)), lines.join('\n'));
});

// The baseline's fixture: what the real records of PRs 864-868 hold that the measure reads (lands.jsonl, the run log and
// the records), and the commits of their lands with the ranges their runs read. Commit ids and run ids only; the merge
// subjects keep the PR's number and drop the branch.
const BASELINE_COMMITS = [
  '236f72025d4bdf1850c00477bde2e3c28930e33a 9080c53f89e35100d1de465d3b187c09b46e8168 85fa628c84877a3021054df8210d4e555a48d718	Merge pull request #863 from x',
  '4a77d99097f8ead95ec9c3ff891aee6fd7d9bf9f 236f72025d4bdf1850c00477bde2e3c28930e33a c4990e930b53cb18e8669e527bb1bdfafe72f431	Merge pull request #864 from x',
  'c4990e930b53cb18e8669e527bb1bdfafe72f431 0444b5ded113aed21143b4bb571a977325ce57ec	c',
  '0444b5ded113aed21143b4bb571a977325ce57ec 0e1e20fc473ef5bbed47162f6554b4196db67f0e	c',
  '0e1e20fc473ef5bbed47162f6554b4196db67f0e 44a94ec4e30f5b2b3c5ad3cb8582332c2a5a077a	c',
  '44a94ec4e30f5b2b3c5ad3cb8582332c2a5a077a 8bbbdbf334e063310c6d457113fb1e97a6b049f8	c',
  '8bbbdbf334e063310c6d457113fb1e97a6b049f8 0375349227735ca9bb8b7d25c2519dc32bfa2d76	c',
  '0375349227735ca9bb8b7d25c2519dc32bfa2d76 9080c53f89e35100d1de465d3b187c09b46e8168	c',
  '6ba747e38fcc3d7045fb3afc746081d83e5c2a82 4a77d99097f8ead95ec9c3ff891aee6fd7d9bf9f 9cba75011026a74076e273e81d2fb4a3762a1484	Merge pull request #865 from x',
  '9cba75011026a74076e273e81d2fb4a3762a1484 16b63f65e09b83d10e617c5fa0a367262e7cfc2b	c',
  '16b63f65e09b83d10e617c5fa0a367262e7cfc2b 8053d2d6a931de79dd677dd5ff865b10597a923a	c',
  '8053d2d6a931de79dd677dd5ff865b10597a923a c4990e930b53cb18e8669e527bb1bdfafe72f431	c',
  '96ce3c90920cb5c0ee7de2e18607efd80081bc9b 6ba747e38fcc3d7045fb3afc746081d83e5c2a82 46c492b7e59bfe12e775c006f236fb18cde621f8	Merge pull request #866 from x',
  '46c492b7e59bfe12e775c006f236fb18cde621f8 e9db94c0e177e734e5a5194be52c4436abebd97e	c',
  'e9db94c0e177e734e5a5194be52c4436abebd97e 39af358863dbdcbc98a17faa55f9705450979efa	c',
  '39af358863dbdcbc98a17faa55f9705450979efa ce27426edf31f8216e496ad09eede0925b9cd10e	c',
  'ce27426edf31f8216e496ad09eede0925b9cd10e c88de83543d3d867037783e58c9ce72d2587eeb2	c',
  'c88de83543d3d867037783e58c9ce72d2587eeb2 4c7f22be81b623937901b1c95357b378a254f313	c',
  '4c7f22be81b623937901b1c95357b378a254f313 f281d01312e014ddbff4c19cc3b7fdca038ea6c2	c',
  'f281d01312e014ddbff4c19cc3b7fdca038ea6c2 75a0fbb636d1568efbb8a871d9e2d24fcf5a55f8	c',
  '75a0fbb636d1568efbb8a871d9e2d24fcf5a55f8 cec00bb7f8dcbc9247269be1f68f18655d46ce6e	c',
  'cec00bb7f8dcbc9247269be1f68f18655d46ce6e df02895434114e42529eb0b69a41e794dfd6c6fd	c',
  'df02895434114e42529eb0b69a41e794dfd6c6fd b91cde56784740e884d2c041e701628cf1b0dc27	c',
  'b91cde56784740e884d2c041e701628cf1b0dc27 12942c95e217b53cb62b943e7cfc90dc3d680153	c',
  '12942c95e217b53cb62b943e7cfc90dc3d680153 b3043fb9999e6dc0fc893953948708950fa5e7dc	c',
  'b3043fb9999e6dc0fc893953948708950fa5e7dc 13fba2604b08241ab0ee664f8bb60c05e6d1b0ba	c',
  '13fba2604b08241ab0ee664f8bb60c05e6d1b0ba af986f036b14c2052c1bd21c3ab5d0c04342a524	c',
  'af986f036b14c2052c1bd21c3ab5d0c04342a524 1de6ed65d8199160fcf48706dca206258f678f0c 236f72025d4bdf1850c00477bde2e3c28930e33a	c',
  '1de6ed65d8199160fcf48706dca206258f678f0c cc5467815fb50ae21f5536e1d96ac20dd9dff5a8	c',
  'cc5467815fb50ae21f5536e1d96ac20dd9dff5a8 c5d916de10bc2b3136f0dab46c3267757ee4a626	c',
  'c5d916de10bc2b3136f0dab46c3267757ee4a626 25afa628fadf21cb493f7e8dd748ce3617064009	c',
  '25afa628fadf21cb493f7e8dd748ce3617064009 59ec643660e8953a1c270e7086bf37a6b66ed30e	c',
  '59ec643660e8953a1c270e7086bf37a6b66ed30e 2ed909b7ec628c0d8e9fca53cfff2f8ae7189638	c',
  '2ed909b7ec628c0d8e9fca53cfff2f8ae7189638 e526cc0ae3b826e0868c51be13a6dff139ab8a09	c',
  'e526cc0ae3b826e0868c51be13a6dff139ab8a09 ca16067d16cb72a0ed042f2dd30356b0d75f9de3	c',
  'ca16067d16cb72a0ed042f2dd30356b0d75f9de3 af1c2eb8584196de7dd3c23e2ca84caaf14a6d57	c',
  'af1c2eb8584196de7dd3c23e2ca84caaf14a6d57 31ce02e8d874c44f588dcbc72718ea51cbed07c2	c',
  '31ce02e8d874c44f588dcbc72718ea51cbed07c2 69eda92efba522a556b47cfa9c8c808a535a6e71	c',
  '69eda92efba522a556b47cfa9c8c808a535a6e71 e42a4c396711fb67c8241f7a5618e61da1007c74	c',
  'e42a4c396711fb67c8241f7a5618e61da1007c74 9c1967a4ed078bbb54e6a4f44f207f213daef967	c',
  'b07c7b5195a7d966cf99529e36b0fc2a10b5f049 96ce3c90920cb5c0ee7de2e18607efd80081bc9b 2e3b9f941cc6c8884472f0426762b4c55dded4fd	Merge pull request #867 from x',
  '2e3b9f941cc6c8884472f0426762b4c55dded4fd 6e243065000d9a3d64231d8aa588c53249af1466	c',
  '6e243065000d9a3d64231d8aa588c53249af1466 62a71b564824337714d0f53dbf7e8659a8715f2f	c',
  '62a71b564824337714d0f53dbf7e8659a8715f2f 4977072eb1f993507963e804cb4cf386321ab589	c',
  '4977072eb1f993507963e804cb4cf386321ab589 9dfd7afc77749e618cbe9a15a1a42082f4efcfef 6ba747e38fcc3d7045fb3afc746081d83e5c2a82	c',
  '9dfd7afc77749e618cbe9a15a1a42082f4efcfef 6c5022cca3aad89d2861734f64595436d7ce209e	c',
  '6c5022cca3aad89d2861734f64595436d7ce209e a8378412317640a056fd26e867f391cd0b774c05	c',
  'a8378412317640a056fd26e867f391cd0b774c05 4ee5ec6193affe61d84241b0cbada8ac58270a75	c',
  '4ee5ec6193affe61d84241b0cbada8ac58270a75 b1e2fd5ebd087ad6534d01d5f3f79d96f9e785d9	c',
  'b1e2fd5ebd087ad6534d01d5f3f79d96f9e785d9 f983eab9c45189561c3d820622e4fac6ebdf94ba	c',
  'f983eab9c45189561c3d820622e4fac6ebdf94ba 1d982b38907a5274a261efc9012b78afefd042bc	c',
  '1d982b38907a5274a261efc9012b78afefd042bc f71380ea46103fd3680ffb7f2f0ceebc50ec9ec1	c',
  'f71380ea46103fd3680ffb7f2f0ceebc50ec9ec1 9cba75011026a74076e273e81d2fb4a3762a1484	c',
  '67455a84b51170e92670d07520b89e0d9fac0509 b07c7b5195a7d966cf99529e36b0fc2a10b5f049 1502b7a3fda14ea6d2f921665044a02cf962ffae	Merge pull request #868 from x',
  '1502b7a3fda14ea6d2f921665044a02cf962ffae a15517a8c4bf1194d5834194d6716e941e69b683	c',
  'a15517a8c4bf1194d5834194d6716e941e69b683 18d6bda93d165a3b9372698824d3f40c4c551c1b	c',
  '18d6bda93d165a3b9372698824d3f40c4c551c1b a253097f748ac73f1657752086947069fd593a54	c',
  'a253097f748ac73f1657752086947069fd593a54 5c6bca961b85552574117f49c2d4dc798a53e49c	c',
  '5c6bca961b85552574117f49c2d4dc798a53e49c 24b5a75b7994616a261572fa051fcf114641f369	c',
  '24b5a75b7994616a261572fa051fcf114641f369 712988db5fc7c25b08bcad7d8d4c1d84904dcbdc	c',
  '712988db5fc7c25b08bcad7d8d4c1d84904dcbdc 86a1becba3db2f25a584e43eb9e09f53af625f87 b07c7b5195a7d966cf99529e36b0fc2a10b5f049	c',
  '86a1becba3db2f25a584e43eb9e09f53af625f87 b46b65acbad766a22ea8cebe1061ade15d7828db	c',
  'b46b65acbad766a22ea8cebe1061ade15d7828db 36bde347499e57ee03efdafa2de6400078075532	c',
  '36bde347499e57ee03efdafa2de6400078075532 7c4f91fde6e84d889180848e924e2d01de22cc7b	c',
  '7c4f91fde6e84d889180848e924e2d01de22cc7b 96ce3c90920cb5c0ee7de2e18607efd80081bc9b	c',
  '85fa628c84877a3021054df8210d4e555a48d718 9080c53f89e35100d1de465d3b187c09b46e8168	c',
  '9080c53f89e35100d1de465d3b187c09b46e8168 023c4cdeda9a74b1207177500ab65b0854594c22 03a3f1057ddaa5977fdb646fe805e741a176bb1f	Merge pull request #862 from x',
  '03a3f1057ddaa5977fdb646fe805e741a176bb1f a0aa3b169a63d63ba2ed50314857905bb9f5cd62	c',
  '023c4cdeda9a74b1207177500ab65b0854594c22 1d33f6db8e85b6ab17ced8975f7ef36fa75097bf 96919f4829ec2b76340138e8c01ae2c6953906a0	Merge pull request #861 from x',
  'a0aa3b169a63d63ba2ed50314857905bb9f5cd62 fd8893762a4072ee490377118fedf73b92a64dd8	c',
  'fd8893762a4072ee490377118fedf73b92a64dd8 9012a06c6e05bfc7b12147dffe87d73ef011dd11	c',
  '1d33f6db8e85b6ab17ced8975f7ef36fa75097bf 38ed8c0b67a9e456b84d17e2857c277b3a46808c 87c457a6a934cef5fb26aa7aeb35e9ab41a0cdea	Merge pull request #860 from x',
  '38ed8c0b67a9e456b84d17e2857c277b3a46808c 7b41cabfd52a7a2b9dff8ec5ed1694f8a08559d8 52d5863c056f9e0ace649980c05829b200977829	Merge pull request #859 from x',
  '7b41cabfd52a7a2b9dff8ec5ed1694f8a08559d8 9c1967a4ed078bbb54e6a4f44f207f213daef967 2fdd068c3a710d2eff51b24f3c2d1cb6df0cbfd3	Merge pull request #858 from x',
  '9012a06c6e05bfc7b12147dffe87d73ef011dd11 b8140b4a43896995ee898c4d079255c0a82377e6	c',
  'b8140b4a43896995ee898c4d079255c0a82377e6 96919f4829ec2b76340138e8c01ae2c6953906a0	c',
  '96919f4829ec2b76340138e8c01ae2c6953906a0 0a217ce21ea53f0adfa76a77971791f1534810e6	c',
  '0a217ce21ea53f0adfa76a77971791f1534810e6 8fa0c9fced44add4aa6c2b693d6a265bd67a83e5	c',
  '8fa0c9fced44add4aa6c2b693d6a265bd67a83e5 2fdd068c3a710d2eff51b24f3c2d1cb6df0cbfd3	c',
  '87c457a6a934cef5fb26aa7aeb35e9ab41a0cdea 0c55e9c84a8785df7bf94379a871628dcaeed61e	c',
  '0c55e9c84a8785df7bf94379a871628dcaeed61e 9c1967a4ed078bbb54e6a4f44f207f213daef967	c',
  '2fdd068c3a710d2eff51b24f3c2d1cb6df0cbfd3 33b5384b2371625722af164f67b1cb1d53de25f0	c',
  '52d5863c056f9e0ace649980c05829b200977829 9c1967a4ed078bbb54e6a4f44f207f213daef967	c',
  '33b5384b2371625722af164f67b1cb1d53de25f0 ad60b83519f683d05941f2fd6d73a5ced864cee2	c',
];
const BASELINE_LANDS = [
  { startedAt: '2026-11-14T08:46:14.282Z', main: '236f72025d4bdf1850c00477bde2e3c28930e33a', candidate: '4a77d99097f8ead95ec9c3ff891aee6fd7d9bf9f', landed: [864], exit: 0 },
  { startedAt: '2026-11-14T08:55:57.172Z', main: '4a77d99097f8ead95ec9c3ff891aee6fd7d9bf9f', candidate: '6ba747e38fcc3d7045fb3afc746081d83e5c2a82', landed: [865], exit: 0 },
  { startedAt: '2026-11-14T10:06:28.227Z', main: '6ba747e38fcc3d7045fb3afc746081d83e5c2a82', candidate: '96ce3c90920cb5c0ee7de2e18607efd80081bc9b', landed: [866], exit: 0 },
  { startedAt: '2026-11-14T10:58:07.668Z', main: '96ce3c90920cb5c0ee7de2e18607efd80081bc9b', candidate: 'b07c7b5195a7d966cf99529e36b0fc2a10b5f049', landed: [867], exit: 0 },
  { startedAt: '2026-11-14T18:24:25.035Z', main: 'b07c7b5195a7d966cf99529e36b0fc2a10b5f049', candidate: '67455a84b51170e92670d07520b89e0d9fac0509', landed: [868], exit: 0 },
];
// [id, startedAt, durationMs, from, head, outcome, inputTokens, coverage.total, findings, a recheck, covered code commits, of code commits, part.of]
const BASELINE_RUNS = [
  ['95e28a5c-f9f1-4a74-8c31-1a678103f0a3', '2026-11-13T22:54:40.704Z', 51867, '0375349227735ca9bb8b7d25c2519dc32bfa2d76', '8bbbdbf334e063310c6d457113fb1e97a6b049f8', 'reviewed', 120016, 158, 2, 0, 0, 0, 1],
  ['4b7e7b16-efcd-489a-b65f-ebd78949b2b1', '2026-11-14T08:03:05.353Z', 25762, '8bbbdbf334e063310c6d457113fb1e97a6b049f8', '0444b5ded113aed21143b4bb571a977325ce57ec', 'reviewed', 40660, 37, 0, 1, 0, 0, 1],
  ['ea26b053-6204-41f6-b1a9-b9385bc1e366', '2026-11-14T08:15:01.340Z', 98983, 'cc5467815fb50ae21f5536e1d96ac20dd9dff5a8', 'af986f036b14c2052c1bd21c3ab5d0c04342a524', 'failed', 220599, 221, 1, 0, 7, 8, 3],
  ['8d8eb8e9-3236-46c8-aba2-ee105c4e3617', '2026-11-14T08:17:32.905Z', 46508, '0444b5ded113aed21143b4bb571a977325ce57ec', 'c4990e930b53cb18e8669e527bb1bdfafe72f431', 'reviewed', 69498, 59, 0, 0, 0, 0, 1],
  ['def9752e-ebb0-45d3-97aa-5decf15ec37a', '2026-11-14T08:19:22.742Z', 55687, 'cc5467815fb50ae21f5536e1d96ac20dd9dff5a8', '13fba2604b08241ab0ee664f8bb60c05e6d1b0ba', 'reviewed', 202957, 221, 2, 0, 7, 8, 3],
  ['57afa766-c385-41c1-9727-4e8a87450423', '2026-11-14T08:20:22.726Z', 41203, 'cc5467815fb50ae21f5536e1d96ac20dd9dff5a8', '13fba2604b08241ab0ee664f8bb60c05e6d1b0ba', 'reviewed', 136175, 285, 0, 0, 7, 8, 3],
  ['334f58db-0c54-4bee-9d60-a16c5fef2f65', '2026-11-14T08:21:06.004Z', 36532, 'cc5467815fb50ae21f5536e1d96ac20dd9dff5a8', '13fba2604b08241ab0ee664f8bb60c05e6d1b0ba', 'reviewed', 189499, 266, 0, 0, 7, 8, 3],
  ['0a71377b-8ffc-4f9c-81f3-d6fd70b8c741', '2026-11-14T08:40:20.502Z', 28633, '13fba2604b08241ab0ee664f8bb60c05e6d1b0ba', '12942c95e217b53cb62b943e7cfc90dc3d680153', 'reviewed', 42196, 29, 1, 1, 0, 0, 1],
  ['9512a2e6-6083-454e-af40-da8218ba843f', '2026-11-14T08:40:31.211Z', 43115, 'c4990e930b53cb18e8669e527bb1bdfafe72f431', '16b63f65e09b83d10e617c5fa0a367262e7cfc2b', 'reviewed', 133896, 61, 1, 0, 0, 0, 1],
  ['5891e75f-0005-446b-aa06-e7f981f0951e', '2026-11-14T08:47:02.735Z', 18748, '12942c95e217b53cb62b943e7cfc90dc3d680153', 'b91cde56784740e884d2c041e701628cf1b0dc27', 'reviewed', 34054, 13, 0, 1, 0, 0, 1],
  ['39c32b27-6f37-4af9-91ef-a80676f19063', '2026-11-14T08:49:27.016Z', 19931, '16b63f65e09b83d10e617c5fa0a367262e7cfc2b', '9cba75011026a74076e273e81d2fb4a3762a1484', 'reviewed', 38529, 47, 0, 1, 0, 0, 1],
  ['1f2a7ad6-e191-48c6-a550-acf4971da024', '2026-11-14T09:00:40.721Z', 42621, 'b91cde56784740e884d2c041e701628cf1b0dc27', 'df02895434114e42529eb0b69a41e794dfd6c6fd', 'reviewed', 83867, 3, 1, 0, 0, 0, 1],
  ['02866c50-0cd3-4ed0-b7d3-17690b06cf1a', '2026-11-14T09:06:43.821Z', 16952, 'df02895434114e42529eb0b69a41e794dfd6c6fd', 'cec00bb7f8dcbc9247269be1f68f18655d46ce6e', 'reviewed', 39922, 5, 0, 1, 0, 0, 1],
  ['9e40c7c2-06e1-4668-9889-65bc569b2b63', '2026-11-14T09:13:44.367Z', 66818, '9cba75011026a74076e273e81d2fb4a3762a1484', 'f71380ea46103fd3680ffb7f2f0ceebc50ec9ec1', 'reviewed', 170735, 230, 3, 0, 0, 0, 1],
  ['596fcae6-c4d5-4bae-b1cf-65664a3efdbb', '2026-11-14T09:28:54.109Z', 69666, '75a0fbb636d1568efbb8a871d9e2d24fcf5a55f8', 'f281d01312e014ddbff4c19cc3b7fdca038ea6c2', 'reviewed', 170246, 128, 3, 0, 0, 0, 1],
  ['4ef92ac5-9b04-49ea-878d-c641fbaeed07', '2026-11-14T09:32:01.307Z', 26886, 'f71380ea46103fd3680ffb7f2f0ceebc50ec9ec1', '1d982b38907a5274a261efc9012b78afefd042bc', 'reviewed', 79096, 215, 0, 1, 0, 0, 1],
  ['581dc6fb-ae23-4b23-8074-e4af2258ca57', '2026-11-14T09:43:43.573Z', 20080, 'f281d01312e014ddbff4c19cc3b7fdca038ea6c2', '4c7f22be81b623937901b1c95357b378a254f313', 'reviewed', 50139, 293, 0, 1, 0, 0, 1],
  ['a28af8f2-d95c-4f09-9303-303c0f07e0f2', '2026-11-14T09:46:09.851Z', 32064, 'b1e2fd5ebd087ad6534d01d5f3f79d96f9e785d9', '4ee5ec6193affe61d84241b0cbada8ac58270a75', 'reviewed', 72086, 55, 0, 0, 0, 0, 1],
  ['df2d3ccd-ef12-49b3-8ca0-d4a13a5ee1f9', '2026-11-14T09:50:35.422Z', 29115, '4c7f22be81b623937901b1c95357b378a254f313', 'c88de83543d3d867037783e58c9ce72d2587eeb2', 'reviewed', 68964, 16, 0, 0, 0, 0, 1],
  ['8731a61a-f532-432a-99f1-12727e48ab70', '2026-11-14T09:55:40.308Z', 25970, 'a8378412317640a056fd26e867f391cd0b774c05', '6c5022cca3aad89d2861734f64595436d7ce209e', 'reviewed', 62826, 8, 0, 0, 0, 0, null],
  ['5399ac10-019e-40db-bdfb-a29c05ae98bd', '2026-11-14T10:01:14.800Z', 21070, '39af358863dbdcbc98a17faa55f9705450979efa', 'e9db94c0e177e734e5a5194be52c4436abebd97e', 'reviewed', 41915, 7, 0, 0, 0, 0, 1],
  ['218f3aed-865b-4ce2-9e1a-9f54a77a66cb', '2026-11-14T10:05:24.118Z', 20879, '6c5022cca3aad89d2861734f64595436d7ce209e', '9dfd7afc77749e618cbe9a15a1a42082f4efcfef', 'reviewed', 57583, 2, 0, 0, 0, 0, null],
  ['0c39143a-035b-45bf-9679-42a8cca31229', '2026-11-14T10:12:46.656Z', 124242, '6ba747e38fcc3d7045fb3afc746081d83e5c2a82', '4977072eb1f993507963e804cb4cf386321ab589', 'reviewed', 240476, 239, 2, 0, 4, 5, 2],
  ['9da6679e-6c4d-4625-b3ee-921a491e3279', '2026-11-14T10:14:53.582Z', 20026, '6ba747e38fcc3d7045fb3afc746081d83e5c2a82', '4977072eb1f993507963e804cb4cf386321ab589', 'failed', 65993, 129, 0, 0, 4, 5, 2],
  ['563cfd0a-f7c4-4212-9702-185e1c78ee62', '2026-11-14T10:16:24.345Z', 21659, '6ba747e38fcc3d7045fb3afc746081d83e5c2a82', '4977072eb1f993507963e804cb4cf386321ab589', 'reviewed', 66505, 129, 0, 0, 4, 5, 2],
  ['5bb8aa3e-a416-42ce-9d42-cae9f609b91a', '2026-11-14T10:26:43.660Z', 38069, '4977072eb1f993507963e804cb4cf386321ab589', '62a71b564824337714d0f53dbf7e8659a8715f2f', 'reviewed', 94853, 9, 1, 1, 0, 0, 1],
  ['f3250c48-be28-4a4e-9598-d0d655d3d6ba', '2026-11-14T10:39:54.407Z', 28677, '62a71b564824337714d0f53dbf7e8659a8715f2f', '6e243065000d9a3d64231d8aa588c53249af1466', 'reviewed', 38886, 34, 1, 1, 0, 0, 1],
  ['d9f2818d-8910-468e-896e-a2476587c48c', '2026-11-14T10:52:22.685Z', 32361, '9dfd7afc77749e618cbe9a15a1a42082f4efcfef', '2e3b9f941cc6c8884472f0426762b4c55dded4fd', 'reviewed', 76048, 84, 0, 0, 3, 4, 1],
  ['6c784ce4-917c-49d0-ae36-1592db05ef79', '2026-11-14T11:14:10.812Z', 70401, '96ce3c90920cb5c0ee7de2e18607efd80081bc9b', '7c4f91fde6e84d889180848e924e2d01de22cc7b', 'reviewed', 164895, 280, 1, 0, 0, 0, 1],
  ['394218bc-2a76-43a1-a835-215890306d98', '2026-11-14T11:34:03.677Z', 19685, '7c4f91fde6e84d889180848e924e2d01de22cc7b', '36bde347499e57ee03efdafa2de6400078075532', 'reviewed', 50784, 158, 0, 1, 0, 0, 1],
  ['775a3241-c257-4d63-a792-0cbf65e722fd', '2026-11-14T11:42:04.454Z', 38188, '36bde347499e57ee03efdafa2de6400078075532', 'b46b65acbad766a22ea8cebe1061ade15d7828db', 'reviewed', 70303, 40, 0, 0, 0, 0, 1],
  ['b15ff0ef-b646-4195-89e2-f09aff0f9187', '2026-11-14T11:49:48.040Z', 32192, 'b46b65acbad766a22ea8cebe1061ade15d7828db', '86a1becba3db2f25a584e43eb9e09f53af625f87', 'reviewed', 72285, 21, 0, 0, 0, 0, null],
  ['1a6834ba-8e8f-4e2a-8a0e-4b4dd9b06512', '2026-11-14T12:10:22.456Z', 33427, '5c6bca961b85552574117f49c2d4dc798a53e49c', 'a253097f748ac73f1657752086947069fd593a54', 'reviewed', 70110, 17, 1, 0, 0, 0, 1],
  ['ba57f254-b216-4807-ac21-a69f1b9f331e', '2026-11-14T12:16:11.982Z', 6823, 'a253097f748ac73f1657752086947069fd593a54', '18d6bda93d165a3b9372698824d3f40c4c551c1b', 'failed', null, 30, null, 0, 0, 0, null],
  ['c5ac1739-4406-46a2-88fc-71bae4c798b7', '2026-11-14T12:55:46.773Z', 19596, 'a253097f748ac73f1657752086947069fd593a54', 'a15517a8c4bf1194d5834194d6716e941e69b683', 'reviewed', 36698, 30, 0, 1, 0, 0, 1],
];
// [base, head, reviewedAt, run ids]
const BASELINE_RECORDS = [
  ['9c1967a4ed078bbb54e6a4f44f207f213daef967', '0c55e9c84a8785df7bf94379a871628dcaeed61e', '2026-11-13T18:21:47.329Z', ["f5acd356-f9f6-42e5-bf3f-b823bdc696c8"]],
  ['2fdd068c3a710d2eff51b24f3c2d1cb6df0cbfd3', '8fa0c9fced44add4aa6c2b693d6a265bd67a83e5', '2026-11-13T18:31:30.694Z', ["77444754-ed8a-46d3-b07f-089b1f072d00"]],
  ['8fa0c9fced44add4aa6c2b693d6a265bd67a83e5', '96919f4829ec2b76340138e8c01ae2c6953906a0', '2026-11-13T18:42:51.652Z', ["080fa9d3-dcf3-4642-bcb2-8d4cf14ca0ae"]],
  ['b8140b4a43896995ee898c4d079255c0a82377e6', 'fd8893762a4072ee490377118fedf73b92a64dd8', '2026-11-13T18:52:25.649Z', ["67b2a430-308e-4493-8ba9-f7c83f83ef21"]],
  ['fd8893762a4072ee490377118fedf73b92a64dd8', 'a0aa3b169a63d63ba2ed50314857905bb9f5cd62', '2026-11-13T19:02:44.307Z', ["5fc58951-6326-4f1c-966a-3d84401cd64c"]],
  ['9080c53f89e35100d1de465d3b187c09b46e8168', '85fa628c84877a3021054df8210d4e555a48d718', '2026-11-13T22:19:53.868Z', ["532fb487-9910-49cf-9113-617359085196"]],
  ['0375349227735ca9bb8b7d25c2519dc32bfa2d76', '8bbbdbf334e063310c6d457113fb1e97a6b049f8', '2026-11-13T22:55:32.742Z', ["95e28a5c-f9f1-4a74-8c31-1a678103f0a3"]],
  ['8bbbdbf334e063310c6d457113fb1e97a6b049f8', '0444b5ded113aed21143b4bb571a977325ce57ec', '2026-11-14T08:03:31.217Z', ["4b7e7b16-efcd-489a-b65f-ebd78949b2b1"]],
  ['0444b5ded113aed21143b4bb571a977325ce57ec', 'c4990e930b53cb18e8669e527bb1bdfafe72f431', '2026-11-14T08:18:19.512Z', ["8d8eb8e9-3236-46c8-aba2-ee105c4e3617"]],
  ['cc5467815fb50ae21f5536e1d96ac20dd9dff5a8', '13fba2604b08241ab0ee664f8bb60c05e6d1b0ba', '2026-11-14T08:21:42.716Z', ["def9752e-ebb0-45d3-97aa-5decf15ec37a","57afa766-c385-41c1-9727-4e8a87450423","334f58db-0c54-4bee-9d60-a16c5fef2f65","334f58db-0c54-4bee-9d60-a16c5fef2f65"]],
  ['13fba2604b08241ab0ee664f8bb60c05e6d1b0ba', '12942c95e217b53cb62b943e7cfc90dc3d680153', '2026-11-14T08:40:49.264Z', ["0a71377b-8ffc-4f9c-81f3-d6fd70b8c741"]],
  ['c4990e930b53cb18e8669e527bb1bdfafe72f431', '16b63f65e09b83d10e617c5fa0a367262e7cfc2b', '2026-11-14T08:41:14.426Z', ["9512a2e6-6083-454e-af40-da8218ba843f"]],
  ['12942c95e217b53cb62b943e7cfc90dc3d680153', 'b91cde56784740e884d2c041e701628cf1b0dc27', '2026-11-14T08:47:21.700Z', ["5891e75f-0005-446b-aa06-e7f981f0951e"]],
  ['16b63f65e09b83d10e617c5fa0a367262e7cfc2b', '9cba75011026a74076e273e81d2fb4a3762a1484', '2026-11-14T08:49:47.194Z', ["39c32b27-6f37-4af9-91ef-a80676f19063"]],
  ['b91cde56784740e884d2c041e701628cf1b0dc27', 'df02895434114e42529eb0b69a41e794dfd6c6fd', '2026-11-14T09:01:23.466Z', ["1f2a7ad6-e191-48c6-a550-acf4971da024"]],
  ['df02895434114e42529eb0b69a41e794dfd6c6fd', 'cec00bb7f8dcbc9247269be1f68f18655d46ce6e', '2026-11-14T09:07:00.884Z', ["02866c50-0cd3-4ed0-b7d3-17690b06cf1a"]],
  ['9cba75011026a74076e273e81d2fb4a3762a1484', 'f71380ea46103fd3680ffb7f2f0ceebc50ec9ec1', '2026-11-14T09:14:51.281Z', ["9e40c7c2-06e1-4668-9889-65bc569b2b63"]],
  ['75a0fbb636d1568efbb8a871d9e2d24fcf5a55f8', 'f281d01312e014ddbff4c19cc3b7fdca038ea6c2', '2026-11-14T09:30:03.884Z', ["596fcae6-c4d5-4bae-b1cf-65664a3efdbb"]],
  ['f281d01312e014ddbff4c19cc3b7fdca038ea6c2', '4c7f22be81b623937901b1c95357b378a254f313', '2026-11-14T09:44:03.757Z', ["581dc6fb-ae23-4b23-8074-e4af2258ca57"]],
  ['b1e2fd5ebd087ad6534d01d5f3f79d96f9e785d9', '4ee5ec6193affe61d84241b0cbada8ac58270a75', '2026-11-14T09:46:42.062Z', ["a28af8f2-d95c-4f09-9303-303c0f07e0f2"]],
  ['4c7f22be81b623937901b1c95357b378a254f313', 'c88de83543d3d867037783e58c9ce72d2587eeb2', '2026-11-14T09:51:04.666Z', ["df2d3ccd-ef12-49b3-8ca0-d4a13a5ee1f9"]],
  ['a8378412317640a056fd26e867f391cd0b774c05', '6c5022cca3aad89d2861734f64595436d7ce209e', '2026-11-14T09:56:06.635Z', ["8731a61a-f532-432a-99f1-12727e48ab70"]],
  ['39af358863dbdcbc98a17faa55f9705450979efa', 'e9db94c0e177e734e5a5194be52c4436abebd97e', '2026-11-14T10:01:36.003Z', ["5399ac10-019e-40db-bdfb-a29c05ae98bd"]],
  ['6c5022cca3aad89d2861734f64595436d7ce209e', '9dfd7afc77749e618cbe9a15a1a42082f4efcfef', '2026-11-14T10:05:45.114Z', ["218f3aed-865b-4ce2-9e1a-9f54a77a66cb"]],
  ['6ba747e38fcc3d7045fb3afc746081d83e5c2a82', '4977072eb1f993507963e804cb4cf386321ab589', '2026-11-14T10:16:46.136Z', ["0c39143a-035b-45bf-9679-42a8cca31229","563cfd0a-f7c4-4212-9702-185e1c78ee62","563cfd0a-f7c4-4212-9702-185e1c78ee62"]],
  ['4977072eb1f993507963e804cb4cf386321ab589', '62a71b564824337714d0f53dbf7e8659a8715f2f', '2026-11-14T10:27:21.825Z', ["5bb8aa3e-a416-42ce-9d42-cae9f609b91a"]],
  ['62a71b564824337714d0f53dbf7e8659a8715f2f', '6e243065000d9a3d64231d8aa588c53249af1466', '2026-11-14T10:40:23.166Z', ["f3250c48-be28-4a4e-9598-d0d655d3d6ba"]],
  ['9dfd7afc77749e618cbe9a15a1a42082f4efcfef', '2e3b9f941cc6c8884472f0426762b4c55dded4fd', '2026-11-14T10:52:55.141Z', ["d9f2818d-8910-468e-896e-a2476587c48c"]],
  ['96ce3c90920cb5c0ee7de2e18607efd80081bc9b', '7c4f91fde6e84d889180848e924e2d01de22cc7b', '2026-11-14T11:15:21.623Z', ["6c784ce4-917c-49d0-ae36-1592db05ef79"]],
  ['7c4f91fde6e84d889180848e924e2d01de22cc7b', '36bde347499e57ee03efdafa2de6400078075532', '2026-11-14T11:34:23.498Z', ["394218bc-2a76-43a1-a835-215890306d98"]],
  ['36bde347499e57ee03efdafa2de6400078075532', 'b46b65acbad766a22ea8cebe1061ade15d7828db', '2026-11-14T11:42:42.785Z', ["775a3241-c257-4d63-a792-0cbf65e722fd"]],
  ['b46b65acbad766a22ea8cebe1061ade15d7828db', '86a1becba3db2f25a584e43eb9e09f53af625f87', '2026-11-14T11:50:20.441Z', ["b15ff0ef-b646-4195-89e2-f09aff0f9187"]],
  ['5c6bca961b85552574117f49c2d4dc798a53e49c', 'a253097f748ac73f1657752086947069fd593a54', '2026-11-14T12:10:56.034Z', ["1a6834ba-8e8f-4e2a-8a0e-4b4dd9b06512"]],
  ['a253097f748ac73f1657752086947069fd593a54', 'a15517a8c4bf1194d5834194d6716e941e69b683', '2026-11-14T12:56:06.459Z', ["c5ac1739-4406-46a2-88fc-71bae4c798b7"]],
];
