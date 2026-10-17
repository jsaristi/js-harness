// The throughput review's measure (odd/tasks/throughput-review.md): the facts of a UTC day read from the records the
// harness keeps, and the fixed table a window of days prints. Pure: it reads no file and spawns nothing, so a test
// hands it records and the command (bin/throughput.mjs) hands it what it read. The facts and not the figures are
// what a day keeps, so a median over several days is the median of their facts, never of their daily medians.

import { compareSteps, stepsOf } from './progress-pace.mjs';

const DAY_MS = 24 * 3600 * 1000;

/** `[from, to)` of a UTC day `YYYY-MM-DD`, in ms. */
export function dayBounds(day) {
  const from = Date.parse(`${day}T00:00:00Z`);
  return { from, to: from + DAY_MS };
}

/** The UTC day of `ms`, `YYYY-MM-DD`. */
export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The days of `[since, until)`, both `YYYY-MM-DD`. */
export function daysBetween(since, until) {
  const days = [];
  for (let at = dayBounds(since).from; at < dayBounds(until).from; at += DAY_MS) days.push(utcDay(at));
  return days;
}

/** What a gate was run for, from its start line, as the 2026-10-17 measure classified gates: a land of the merge
 * queue (its candidate's folder), a commit's own check, a commit wrapped in `gate --`, the lead's copy update, or
 * any other run under the lock. */
export function gateKind({ cwd, command }) {
  if (/merge-queue/.test(String(cwd ?? ''))) return 'land';
  const said = String(command ?? '');
  if (said === 'check' || said.startsWith('check ')) return 'check';
  if (/git commit/.test(said)) return 'commit';
  if (/update-copy/.test(said)) return 'copy';
  return 'run';
}

const secondsBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 100) / 10;

/** The tests sensor of an end line, or the first sensor that says where it ran. */
const testsOf = (end) => (Array.isArray(end?.sensors) ? end.sensors.find((sensor) => sensor?.name === 'tests') : undefined);

/** The gates of a day among the gate log's events (`readGateLog`): `{ gates, fallbacks, partialFrom }`. A gate is the
 * day's when its start is in `[from, to)`, a fallback (a gate CI gave no answer) when its line is. `partialFrom` is the time of the oldest event when the log holds none before `from`:
 * the rotation took the start of the day, and every figure of its gates is partial from then. */
export function gateFacts(events, { from, to }) {
  const ends = new Map();
  let oldest = null;
  for (const event of events) {
    if (oldest === null || Date.parse(event.at) < Date.parse(oldest.at)) oldest = event;
    if (event.event === 'end') ends.set(event.id, event);
  }
  const gates = [];
  const fallbacks = [];
  for (const start of events) {
    const at = Date.parse(start.at);
    if (!(at >= from && at < to)) continue;
    // A gate CI gave no answer, written before the gate it fell back to runs here.
    if (start.event === 'ci-fallback') fallbacks.push({ id: start.id, at: start.at, seconds: Number.isFinite(start.seconds) ? start.seconds : null, reason: start.reason ?? null });
    if (start.event !== 'start') continue;
    const end = ends.get(start.id) ?? null;
    const tests = testsOf(end);
    gates.push({
      id: start.id,
      kind: gateKind(start),
      lock: start.lock ?? null,
      session: start.session ?? null,
      startedAt: start.at,
      endedAt: end?.at ?? null,
      seconds: end ? secondsBetween(start.at, end.at) : null,
      waitedSeconds: Number.isFinite(start.waitedSeconds) ? start.waitedSeconds : 0,
      result: end?.result ?? null,
      ranIn: tests ? (tests.ranIn ?? 'windows') : null,
      // Whether its tests ran under the tracer (exact tests in shadow or skip), the gates that can keep test times (B5).
      traced: Boolean(tests?.shadow || tests?.skip),
      failing: (end?.sensors ?? []).flatMap((sensor) => (Array.isArray(sensor?.failing) ? sensor.failing : [])),
      // The candidate's folder, one per land: a land that bisects runs several gates in it.
      land: /merge-queue/.test(String(start.cwd ?? '')) ? String(start.cwd).split(/[\\/]/).filter(Boolean).at(-1) : null,
      load: Number.isFinite(start.load?.share) ? start.load.share : null,
    });
  }
  // A log with no event at all covers nothing of the day: partial from its end, so any copy that holds it is fuller.
  if (oldest === null) return { gates, fallbacks, partialFrom: new Date(to).toISOString() };
  return { gates, fallbacks, partialFrom: Date.parse(oldest.at) > from ? oldest.at : null };
}

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

/** The `p`th percentile of `values` by the nearest rank, `null` for none. */
export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

const iso = (text) => new Date(Date.parse(text)).toISOString();

/** The merges of a pull request among `git log --first-parent --merges --format=%H%x09%cI%x09%P%x09%s` lines:
 * `{ commit, at, head, number }`, `head` being the merged branch's tip (the second parent). Other merges (a branch
 * merged into main by hand) are no pull request and are left out. */
export function parseMerges(text) {
  const merges = [];
  for (const line of String(text).split(/\r?\n/)) {
    const [commit, at, parents, subject] = line.split('\t');
    const number = /^Merge pull request #(\d+) /.exec(subject ?? '')?.[1];
    if (!number || !Number.isFinite(Date.parse(at))) continue;
    merges.push({ commit, at, head: String(parents).split(' ')[1] ?? null, number: Number(number) });
  }
  return merges;
}

/** `git show -s --format=%H%x09%cI` lines as a map from commit to its committer time. */
export function parseCommitTimes(text) {
  const times = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    const [commit, at] = line.split('\t');
    if (commit && Number.isFinite(Date.parse(at))) times.set(commit, at);
  }
  return times;
}

/** The files each merge changed against its first parent, from `git log --first-parent -m --name-only
 * --format=%x01%H`: a map from the merge commit to its paths. */
export function parseMergeFiles(text) {
  const files = new Map();
  for (const block of String(text).split('\u0001').slice(1)) {
    const [commit, ...paths] = block.split(/\r?\n/);
    files.set(commit.trim(), paths.filter((line) => line.trim() !== ''));
  }
  return files;
}

/** Whether a path is a document, as the Codex review's scope says (`isDocument`): a Markdown file. */
const isDocument = (path) => /\.md$/i.test(path);

/** The pull requests merged in `[from, to)`: `{ number, mergedAt, lastCommitAt, docsOnly }`, merged at the merge
 * commit's committer time and last committed at its head's (`null` where git did not give it), oldest first.
 * `docsOnly` is whether every file the merge changed is a document, `null` where `files` does not name it. */
export function prFacts(merges, headTimes, { from, to }, files = new Map()) {
  return merges
    .filter((merge) => Date.parse(merge.at) >= from && Date.parse(merge.at) < to)
    .map((merge) => ({
      number: merge.number,
      mergedAt: iso(merge.at),
      lastCommitAt: headTimes.has(merge.head) ? iso(headTimes.get(merge.head)) : null,
      docsOnly: files.has(merge.commit) ? files.get(merge.commit).every(isDocument) : null,
    }))
    .sort((a, b) => Date.parse(a.mergedAt) - Date.parse(b.mergedAt));
}

/** Whether a notice says its session waits, as the 2026-10-17 measure read them: a `waiting` or a `question`, or a
 * note that says it is ready or asks to be told. */
const waits = (notice) => notice.kind === 'waiting' || notice.kind === 'question' || (notice.kind === 'note' && /\bready\b|notify me/i.test(String(notice.text ?? '')));

/** The waits a session announced in `[from, to)` on the channel (`waits`), each to
 * that session's next notice: `{ session, title, at, minutes }`. An upper bound of its idle time, since a session
 * may keep working without a notice; a wait with no notice after it yet is left out. */
export function channelIdle(notices, { from, to }) {
  const sorted = [...notices].filter((notice) => Number.isFinite(Date.parse(notice?.at)) && notice.from?.id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const idle = [];
  sorted.forEach((notice, index) => {
    const at = Date.parse(notice.at);
    if (!(at >= from && at < to) || !waits(notice)) return;
    const next = sorted.slice(index + 1).find((later) => later.from.id === notice.from.id);
    if (next) idle.push({ session: notice.from.id, title: notice.from.title ?? null, at: notice.at, minutes: Math.round((Date.parse(next.at) - at) / 6000) / 10 });
  });
  return idle;
}

/** `prs` (`prFacts`'s), each with `readyAt`: the newest `ready` notice that names it (`notify --kind ready --pr`, B1)
 * at or before its merge, as the merge queue reads the newest one; `null` where none does. */
export function withReadyAt(prs, notices) {
  const ready = notices.filter((notice) => notice?.kind === 'ready' && Number.isInteger(notice.pr) && Number.isFinite(Date.parse(notice.at)));
  return prs.map((pr) => {
    const merged = Date.parse(pr.mergedAt);
    const newest = ready.filter((notice) => notice.pr === pr.number && Date.parse(notice.at) <= merged).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return { ...pr, readyAt: newest?.at ?? null };
  });
}

/** The test times of the gates `ids` among the lines of `test-times.jsonl` (`readGateTestTimes`, B5), kept per file
 * so a day's snapshot stays small and days add up exactly: `{ gates, files: [{ test, runs, seconds, max }] }`, `gates`
 * the gates that kept times and `seconds` the total over `runs`. */
export function testTimeFacts(byId, ids) {
  const files = new Map();
  let gates = 0;
  for (const id of ids) {
    const line = byId.get(id);
    if (!line) continue;
    gates += 1;
    for (const { test, seconds } of line.files) {
      const file = files.get(test) ?? { test, runs: 0, seconds: 0, max: 0 };
      files.set(test, { test, runs: file.runs + 1, seconds: Math.round((file.seconds + seconds) * 1000) / 1000, max: Math.max(file.max, seconds) });
    }
  }
  return { gates, files: [...files.values()].sort((a, b) => a.test.localeCompare(b.test)) };
}

/** The lands started in `[from, to)` among the merge queue's records (`<git common dir>/js-harness/lands.jsonl`, B2):
 * `{ startedAt, seconds, exit, landed, considered, phases: [{ phase, seconds, ok }] }`. */
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
    }))
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

/** The gentle-ai reviews of `[from, to)` (B6), from `record`: `starts`, the lines the pause hook recorded
 * (`readReviewStarts`); `ends`, gentle-ai's terminal records (`readReviewEnds`); `live`, the lineages whose folder is in
 * its store now. Returns `{ since, started, ended, open, gone }`. `since` is when this machine began recording starts
 * (the first line's `seenAt`), and a start born before it is not counted, since the ones that burned before were never
 * seen. Each distinct start of a lineage is one review, so an id used again after a burn counts twice, and lines of one
 * start written by two sessions count once. An end goes to the last start of its lineage at or before it, with the
 * minutes from that start, `null` with none; the last start of a lineage still live has no end yet (gentle-ai writes
 * the record before it deletes the folder) and is open, and a start with no end went without acknowledgement
 * (abandoned, reclaimed or reset). */
export function reviewFacts({ starts, ends, live }, { from, to }) {
  const seen = starts.map((one) => Date.parse(one.seenAt)).filter(Number.isFinite);
  const since = seen.length > 0 ? seen.reduce((a, b) => Math.min(a, b)) : null;
  // Each lineage's lives: an id used again after a burn starts a new one. Two sessions' lines of one start are one.
  const lives = new Map();
  for (const one of starts) {
    const at = Date.parse(one.at);
    if (!Number.isFinite(at)) continue;
    const list = lives.get(one.lineage) ?? [];
    if (!list.includes(at)) list.push(at);
    lives.set(one.lineage, list);
  }
  for (const list of lives.values()) list.sort((a, b) => a - b);
  const alive = new Set(live);
  const iso = (ms) => new Date(ms).toISOString();
  const inDay = (at) => at >= from && at < to;
  // Each end goes to the last life started at or before it; a live folder is the last life, so its own end is not
  // in yet (gentle-ai writes the record before it deletes the folder).
  const endOf = new Map();
  const unpaired = [];
  for (const [lineage, at] of ends.map((one) => [one.lineage, Date.parse(one.at)]).filter(([, at]) => Number.isFinite(at)).sort((a, b) => a[1] - b[1])) {
    const list = lives.get(lineage) ?? [];
    const life = list.filter((began) => began <= at).at(-1);
    const last = list.at(-1);
    if (alive.has(lineage) && (life === undefined || life === last)) continue;
    if (life === undefined) unpaired.push({ lineage, at });
    else if (!endOf.has(`${lineage}@${life}`)) endOf.set(`${lineage}@${life}`, at);
  }
  const counted = [...lives].flatMap(([lineage, list]) => list.map((at) => ({ lineage, at }))).filter((one) => since !== null && one.at >= since && inDay(one.at)).sort((a, b) => a.at - b.at);
  const ended = [
    ...[...endOf].map(([key, at]) => ({ lineage: key.slice(0, key.lastIndexOf('@')), at, minutes: Math.round((at - Number(key.slice(key.lastIndexOf('@') + 1))) / 60000) })),
    ...unpaired.map((one) => ({ ...one, minutes: null })),
  ].filter((one) => inDay(one.at)).sort((a, b) => a.at - b.at).map((one) => ({ lineage: one.lineage, at: iso(one.at), minutes: one.minutes }));
  const isLast = (one) => lives.get(one.lineage).at(-1) === one.at;
  return {
    since: since === null ? null : iso(since),
    started: counted.map((one) => ({ lineage: one.lineage, at: iso(one.at) })),
    ended,
    open: counted.filter((one) => alive.has(one.lineage) && isLast(one)).map((one) => one.lineage),
    gone: counted.filter((one) => !endOf.has(`${one.lineage}@${one.at}`) && !(alive.has(one.lineage) && isLast(one))).map((one) => one.lineage),
  };
}

const isObjectLike = (value) => typeof value === 'object' && value !== null;

/** The Codex review runs started in `[from, to)` (`readCodexReviewRuns`): `{ startedAt, seconds, outcome, findings,
 * part }`. */
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
    }));
}

/** The tasks closed, reopened, added and removed by the commits of `bounds` (`parsePaceLog`'s), each file compared
 * before and after its commit as `progress` compares it: `{ closed, reopened, added, removed }`. Subtracting the
 * totals at both ends instead would read a deleted document of done tasks as tasks reopened. */
export function taskChanges(commits, { from, to }) {
  const counts = { closed: 0, reopened: 0, added: 0, removed: 0 };
  for (const commit of commits) {
    const at = Date.parse(commit.date);
    if (commit.parents.length === 0 || !(at >= from && at < to)) continue;
    for (const file of commit.files) {
      const changed = compareSteps(stepsOf(file.path, file.before), stepsOf(file.path, file.after));
      for (const kind of Object.keys(counts)) counts[kind] += changed[kind];
    }
  }
  return counts;
}

/** The checkboxes among `git grep -hE` lines of the task documents: `{ open, done }`, as the measure counted them. */
export function taskCounts(text) {
  const counts = { open: 0, done: 0 };
  for (const line of String(text).split(/\r?\n/)) {
    const box = /^(?:[^:]*:)?\s*- \[([ xX])\]/.exec(line)?.[1];
    if (box === ' ') counts.open += 1;
    else if (box) counts.done += 1;
  }
  return counts;
}

/** The files of a conflicted merge, from `git merge-tree --write-tree --name-only --no-messages` (exit 1): the tree on
 * the first line, a file on each line after it. */
export function conflictFiles(stdout) {
  return String(stdout).split(/\r?\n/).slice(1).filter((line) => line.trim() !== '');
}

const SOURCES = {
  git: 'git log of origin/main as last fetched',
  merge: "git log of origin/main as last fetched; a merge commit is made when its land builds it, before the land's tests",
  gates: 'the gate log (~/.js-harness/gate-log)',
  codex: '<git common dir>/js-harness/codex-review-runs.jsonl',
  tasks: 'each commit of origin/main compared with the one before, as progress compares them; open: git grep of the checkboxes of odd/tasks/*.md and docs/ROADMAP.md',
  conflicts: 'git merge-tree of each merge into a branch on origin/main',
  channel: "the channel (~/.js-harness/channel): a waiting notice to the same session's next one; a session may keep working meanwhile",
  ready: 'the newest ready notice naming the pull request on the channel (notify --kind ready --pr) to its merge commit on origin/main',
  lands: '<git common dir>/js-harness/lands.jsonl, one line per merge-queue --land',
  reviews: 'gentle-ai\'s store (<git common dir>/gentle-ai/review-transactions: a terminal record per acknowledgement) and the starts the pause hook keeps (<home>/.js-harness/throughput/<slug>/review-starts.jsonl)',
  times: 'test-times.jsonl beside the gate log, one line per gate that traced its tests (exact tests on)',
};

/** Which source of the facts each row reads, and the key a day's `unavailable` names it by. */
const UNAVAILABLE_KEY = { git: ['git'], merge: ['git'], gates: ['gate log'], codex: ['codex'], tasks: ['git', 'tasks'], conflicts: ['git', 'conflicts'], channel: ['channel'], ready: ['git', 'channel'], lands: ['lands'], times: ['gate log', 'times'], reviews: ['reviews'] };

/** Why `day` could not read `source`, or `undefined`. */
const unreadOf = (day, source) => UNAVAILABLE_KEY[source].map((key) => day.unavailable?.[key]).find(Boolean);

/** The first day each recorder's lines can be in the records, the day it reached main: a day before it has no line
 * because nothing wrote one, and its row says so instead of a zero. */
const RECORDED_FROM = { B1: '2026-10-17', B2: '2026-10-17', B3: '2026-10-17' };

/** When B1 reached main (the merge of pull request 349): one merged before it could not be named by a ready notice. */
const B1_AT = '2026-10-17T03:24:51Z';

const minutes = (seconds) => `${Math.round(seconds / 60)} min`;
const counted = (values) => `(${values.length})`;
const short = (id) => (typeof id === 'string' && id !== '' ? id.slice(0, 8) : 'no session');

/** A row of a fact no record holds yet: the recorder that will hold it, and who builds it. */
const notRecorded = (label, recorder, why) => ({ label, value: `not recorded (${recorder})`, source: why });

/** The names counted over `lists`, the most frequent first: `name ×n`. */
function topNames(lists, limit) {
  const counts = new Map();
  for (const name of lists.flat()) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

/** The fixed table of the throughput review over `days` (each a day's facts, in order): `[{ label, value, source }]`.
 * A row whose source could not be read on a day says so instead of a figure; a gate row of a day the log covers only
 * in part says from when. */
export function throughputRows(days) {
  const all = (key) => days.flatMap((day) => day[key] ?? []);
  const hours = days.length * 24;
  const gates = all('gates');
  const fallbacks = all('fallbacks');
  const unread = (source, among = days) => among.filter((day) => unreadOf(day, source)).map((day) => `${day.day} ${unreadOf(day, source)}`);
  const partial = days.flatMap((day) => [
    day.partialFrom && (Date.parse(day.partialFrom) >= dayBounds(day.day).to ? `partial: ${day.day} not in the gate log` : `partial: ${day.day} from ${day.partialFrom.slice(11, 16)}Z`),
    // A day kept from a copy of the log made before the day settled: its last gates may be missing.
    day.partialUntil && `partial: ${day.day} until ${day.partialUntil.slice(0, 16)}Z`,
  ]).filter(Boolean);
  const row = (label, source, value, recorder = null) => {
    // A day before its recorder holds nothing to read, whether or not its source could be read.
    const early = recorder ? days.filter((day) => day.day < RECORDED_FROM[recorder]).map((day) => day.day) : [];
    const notRecordedOn = early.length > 0 ? `not recorded: ${early.join(', ')} (before ${recorder}, ${RECORDED_FROM[recorder]})` : null;
    if (early.length === days.length && notRecordedOn) return { label, value: notRecordedOn, source: SOURCES[source] };
    const missing = unread(source, days.filter((day) => !early.includes(day.day)));
    if (missing.length > 0) return { label, value: `not read: ${missing.join('; ')}`, source: SOURCES[source] };
    const notes = [...(source === 'gates' || source === 'times' ? partial : []), notRecordedOn].filter(Boolean);
    return { label, value: [value, ...notes].join('; '), source: SOURCES[source] };
  };

  const prs = all('prs');
  const numbers = new Map();
  for (const pr of prs) numbers.set(pr.number, (numbers.get(pr.number) ?? 0) + 1);
  const twice = [...numbers].filter(([, n]) => n > 1).map(([number]) => `#${number}`);
  const leadOf = (list) => list.filter((pr) => pr.lastCommitAt).map((pr) => (Date.parse(pr.mergedAt) - Date.parse(pr.lastCommitAt)) / 60000);
  const leadTimes = leadOf(prs);
  const ended = gates.filter((gate) => gate.endedAt);
  // The check a gate runs under its lock writes a line of its own (lock "parent"); its gate already counts it.
  const own = ended.filter((gate) => gate.lock === 'own');
  const busy = busySeconds(own.map((gate) => [Date.parse(gate.startedAt), Date.parse(gate.endedAt)]));
  const byKind = new Map();
  for (const gate of own) {
    const kind = byKind.get(gate.kind) ?? { count: 0, seconds: 0 };
    byKind.set(gate.kind, { count: kind.count + 1, seconds: kind.seconds + gate.seconds });
  }
  const kinds = [...byKind].sort((a, b) => b[1].seconds - a[1].seconds).map(([kind, { count, seconds }]) => `${kind} ${count} / ${minutes(seconds)}`);
  const waits = new Map();
  for (const gate of gates) waits.set(gate.session, (waits.get(gate.session) ?? 0) + gate.waitedSeconds);
  const waited = [...waits.values()].reduce((sum, seconds) => sum + seconds, 0);
  const mostWaited = [...waits].filter(([, seconds]) => seconds > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const commits = own.filter((gate) => gate.kind === 'check' || gate.kind === 'commit');
  // As the measure had it: a session's own check that waited under 5 s found the lock free, so its time is the run's alone.
  const free = commits.filter((gate) => gate.kind === 'check' && gate.waitedSeconds < 5).map((gate) => gate.seconds);
  const github = ended.filter((gate) => gate.lock === 'ci').map((gate) => gate.seconds);
  const lands = own.filter((gate) => gate.kind === 'land');
  const red = lands.filter((gate) => gate.result !== 'pass' && gate.result !== 'exit 0');
  const landFolders = new Set(lands.map((gate) => gate.land).filter(Boolean));
  const loads = gates.filter((gate) => gate.lock === 'own' && Number.isFinite(gate.load)).map((gate) => gate.load);
  const codex = all('codex');
  const codexSeconds = codex.map((run) => run.seconds).filter(Number.isFinite);
  // A run that recorded no count of findings, as one before the count was kept, is said apart: it is no zero.
  const counts = codex.map((run) => run.findings).filter(Number.isFinite);
  const uncounted = codex.length - counts.length;
  const noCount = `${uncounted} attempt${uncounted === 1 ? '' : 's'} with no count`;
  const findings = counts.length ? `${counts.reduce((sum, n) => sum + n, 0)} findings${uncounted ? `, ${noCount}` : ''}` : uncounted ? `findings: ${noCount}` : '0 findings';
  const idle = all('idle');
  const idleMinutes = idle.map((wait) => wait.minutes);
  const longest = [...idle].sort((a, b) => b.minutes - a.minutes)[0];
  const first = days[0]?.tasks?.start;
  const last = days.at(-1)?.tasks?.end;
  const changes = { closed: 0, reopened: 0, added: 0, removed: 0 };
  for (const day of days) for (const kind of Object.keys(changes)) changes[kind] += day.tasks?.changes?.[kind] ?? 0;
  const conflicts = all('conflicts');
  const branchMerges = days.reduce((sum, day) => sum + (day.branchMerges ?? 0), 0);

  // A pull request merged before B1 could not have a ready notice naming it: only the days after count.
  const afterB1 = days.filter((day) => day.day >= RECORDED_FROM.B1).flatMap((day) => day.prs ?? []).filter((pr) => pr.readyAt !== undefined);
  const readyPrs = afterB1.filter((pr) => Date.parse(pr.mergedAt) >= Date.parse(B1_AT));
  const beforeB1 = new Set(afterB1.filter((pr) => Date.parse(pr.mergedAt) < Date.parse(B1_AT)).map((pr) => pr.number)).size;
  const readyTimes = readyPrs.filter((pr) => pr.readyAt).map((pr) => (Date.parse(pr.mergedAt) - Date.parse(pr.readyAt)) / 60000);
  const noReady = [...new Set(readyPrs.filter((pr) => !pr.readyAt).map((pr) => `#${pr.number}`))];
  const landRecords = all('lands');
  const byPhase = new Map();
  for (const { phase, seconds, ok } of landRecords.flatMap((land) => land.phases)) byPhase.set(phase, [...(byPhase.get(phase) ?? []), { seconds, ok }]);
  const phaseNotes = [...byPhase].map(([phase, runs]) => {
    const red = runs.filter((one) => one.ok === false).length;
    return `${phase} ${runs.length}, median ${Math.round(median(runs.map((one) => one.seconds)))} s${red ? `, red ${red}` : ''}`;
  });

  // B5's row: a day whose facts hold no times (a snapshot or a copy from before B5) is not recorded, one whose gate
  // log or times could not be read is not read, and the rest say of how many local gates that traced they hold
  // times, so a gate that traced and kept none is seen. A gate sent to GitHub's machines writes no local times.
  const testFilesRow = () => {
    const label = 'test files';
    const unkept = days.filter((day) => day.testTimes === undefined && !unreadOf(day, 'times')).map((day) => day.day);
    const notKept = unkept.length > 0 ? `not recorded: ${unkept.join(', ')} (no test times kept)` : null;
    if (unkept.length === days.length) return { label, value: notKept, source: SOURCES.times };
    const kept = days.filter((day) => day.testTimes !== undefined);
    const traced = kept.flatMap((day) => day.gates ?? []).filter((gate) => gate.traced && gate.endedAt && gate.lock !== 'ci').length;
    const withTimes = kept.reduce((sum, day) => sum + day.testTimes.gates, 0);
    const files = new Map();
    for (const file of kept.flatMap((day) => day.testTimes.files)) {
      const sum = files.get(file.test) ?? { test: file.test, runs: 0, seconds: 0, max: 0 };
      files.set(file.test, { test: file.test, runs: sum.runs + file.runs, seconds: sum.seconds + file.seconds, max: Math.max(sum.max, file.max) });
    }
    const slowest = [...files.values()].sort((a, b) => b.seconds / b.runs - a.seconds / a.runs || a.test.localeCompare(b.test)).slice(0, 5);
    const value = traced === 0 && withTimes === 0
      ? 'no local gate traced'
      : `${withTimes} of ${traced} local gates that traced${slowest.length ? `; slowest by mean: ${slowest.map((file) => `${file.test} ${Math.round(file.seconds / file.runs)} s (max ${Math.round(file.max)} s, ${file.runs} run${file.runs === 1 ? '' : 's'})`).join(', ')}` : ''}`;
    const { value: said, source } = row(label, 'times', value);
    return { label, value: [said, notKept].filter(Boolean).join('; '), source };
  };

  // B6's row: the acknowledgements come from gentle-ai's own records, so every day has them; the starts only from
  // when this machine began recording them, so a day before says so rather than a zero.
  const reviewsRow = () => {
    const label = 'gentle-ai reviews';
    const read = days.filter((day) => day.reviews !== undefined);
    const ended = read.flatMap((day) => day.reviews.ended);
    const timed = ended.map((one) => one.minutes).filter(Number.isFinite);
    const since = read.map((day) => day.reviews.since).find(Boolean) ?? null;
    const sinceDay = since === null ? null : since.slice(0, 10);
    // A day whose starts file could not be read keeps its acknowledgements, which come from gentle-ai's records.
    const startsUnread = read.filter((day) => day.unavailable?.['review starts']);
    const early = read.filter((day) => !startsUnread.includes(day) && (sinceDay === null || day.day < sinceDay)).map((day) => day.day);
    const counted = read.filter((day) => !startsUnread.includes(day) && sinceDay !== null && day.day >= sinceDay);
    const count = (key) => counted.reduce((sum, day) => sum + day.reviews[key].length, 0);
    const parts = [`${ended.length} acknowledged${timed.length ? `, median ${Math.round(median(timed))} min (${timed.length} timed, one lineage each)` : ''}`];
    if (counted.length > 0) parts.push(`${count('started')} started, ${count('open')} open, ${count('gone')} gone without acknowledgement`);
    if (startsUnread.length > 0) parts.push(`started not read: ${startsUnread.map((day) => `${day.day} ${day.unavailable['review starts']}`).join('; ')}`);
    if (early.length > 0) parts.push(`started not recorded: ${early.join(', ')} (${since === null ? 'no review start recorded on this machine' : `this machine records starts from ${sinceDay} ${since.slice(11, 16)}Z`})`);
    return row(label, 'reviews', parts.join('; '));
  };

  const medianOf = (values, unit) => (values.length ? `median ${Math.round(median(values))} ${unit} ${counted(values)}` : 'none');
  return [
    row('pull requests merged', 'git', `${numbers.size} (${(numbers.size / hours).toFixed(2)} an hour)${twice.length ? `; merged twice: ${twice.join(', ')}` : ''}`),
    row('last commit to merge commit', 'merge', leadTimes.length
      ? `median ${Math.round(median(leadTimes))} min, p75 ${Math.round(percentile(leadTimes, 75))} min, worst ${Math.round(Math.max(...leadTimes))} min ${counted(leadTimes)}; docs-only ${medianOf(leadOf(prs.filter((pr) => pr.docsOnly === true)), 'min')}; code ${medianOf(leadOf(prs.filter((pr) => pr.docsOnly === false)), 'min')}`
      : 'none'),
    row('ready to merged', 'ready', readyTimes.length || noReady.length || beforeB1
      ? `${readyTimes.length ? `median ${Math.round(median(readyTimes))} min, p75 ${Math.round(percentile(readyTimes, 75))} min, worst ${Math.round(Math.max(...readyTimes))} min ${counted(readyTimes)}` : 'none'}${noReady.length ? `; no ready notice: ${noReady.join(', ')}` : ''}${beforeB1 ? `; merged before B1 reached main at ${B1_AT.slice(11, 16)}Z: ${beforeB1}` : ''}`
      : 'none', 'B1'),
    row('lock busy', 'gates', `${(busy / 3600).toFixed(1)} h of ${hours} h${kinds.length ? `; by kind: ${kinds.join(', ')}` : ''}`),
    row('gate waits', 'gates', `${minutes(waited)} in all${mostWaited.length ? `; most: ${mostWaited.map(([session, seconds]) => `${short(session)} ${minutes(seconds)}`).join(', ')}` : ''}`),
    row('commit gates', 'gates', `here: ${medianOf(commits.map((gate) => gate.seconds), 's')}, lock free ${medianOf(free, 's')}; GitHub: ${medianOf(github, 's')}`),
    row('lands', 'gates', `${lands.length}, median ${lands.length ? Math.round(median(lands.map((gate) => gate.seconds))) : '-'} s, red ${red.length}; ${lands.length} gates for ${landFolders.size} lands`),
    row('land phases', 'lands', landRecords.length ? `${landRecords.length} lands, median ${Math.round(median(landRecords.map((land) => land.seconds).filter(Number.isFinite)) ?? 0)} s, landed ${landRecords.reduce((sum, land) => sum + land.landed, 0)} of ${landRecords.reduce((sum, land) => sum + land.considered, 0)} looked at; exit ${topNames(landRecords.map((land) => [String(land.exit ?? 'none')]), 9).sort((a, b) => a[0].localeCompare(b[0])).map(([exit, n]) => `${exit} ×${n}`).join(', ')}${phaseNotes.length ? `; ${phaseNotes.join('; ')}` : ''}` : 'none', 'B2'),
    testFilesRow(),
    row('failing tests', 'gates', topNames(ended.filter((gate) => gate.lock !== 'ci').map((gate) => gate.failing), 5).map(([name, n]) => `${name} ×${n}`).join(', ') || 'none'),
    row('red tests on CI', 'gates', topNames(ended.filter((gate) => gate.lock === 'ci').map((gate) => gate.failing), 5).map(([name, n]) => `${name} ×${n}`).join(', ') || 'none', 'B3'),
    row('CI fallbacks', 'gates', fallbacks.length
      ? `${fallbacks.length}, ${minutes(fallbacks.reduce((sum, fallback) => sum + (fallback.seconds ?? 0), 0))} waited before them; why: ${topNames(fallbacks.map((fallback) => [fallback.reason ?? 'not said']), 3).map(([why, n]) => `${why} ×${n}`).join(', ')}`
      : 'none', 'B3'),
    row('load at gate starts', 'gates', loads.length ? `median share ${median(loads).toFixed(2)} (${loads.length}); full at ${loads.filter((share) => share >= 1).length} of ${loads.length}` : 'none'),
    row('Codex reviews', 'codex', `${codex.length} attempts (${codex.filter((run) => run.part).length} parts), median ${codexSeconds.length ? Math.round(median(codexSeconds)) : '-'} s, p90 ${codexSeconds.length ? Math.round(percentile(codexSeconds, 90)) : '-'} s, ${minutes(codexSeconds.reduce((sum, s) => sum + s, 0))} in all; ${findings}`),
    reviewsRow(),
    row('idle upper bound', 'channel', idle.length
      ? `${idle.length} waits, median ${Math.round(median(idleMinutes))} min, ${(idleMinutes.reduce((sum, m) => sum + m, 0) / 60).toFixed(1)} session-h in all; longest: ${longest.title ?? short(longest.session)} ${Math.round(longest.minutes)} min`
      : 'none'),
    notRecorded('idle with nothing armed', 'B8', 'a presence record of each session'),
    notRecorded('tool calls open long', 'G, JH 26', 'a record of the calls the board flags'),
    row('tasks closed and added', 'tasks', first && last ? `${Object.entries(changes).map(([kind, n]) => `${kind} ${n}`).join(', ')}; open ${first.open} to ${last.open}` : 'not read'),
    row('conflicts by file', 'conflicts', `${conflicts.length} of ${branchMerges} merges into branches conflicted${conflicts.length ? `: ${topNames(conflicts.map((merge) => merge.files), 5).map(([file, n]) => `${file} ×${n}`).join(', ')}` : ''}`),
  ];
}

/** Days a side a comparison needs before it judges, the threshold version 2 set (odd/tasks/throughput-review.md,
 * L4 item 4): with fewer, a day-to-day swing like the gate-wait median's 216 s to 69 s reads as a change. */
export const COMPARE_DAYS = 7;

const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);

/** The rows a comparison reads, each a day's value from its facts; the source each needs whole. */
const DAILY = [
  ['pull requests merged', 'git', (day) => new Set(day.prs.map((pr) => pr.number)).size],
  ['last commit to merge commit, median min', 'git', (day) => median(day.prs.filter((pr) => pr.lastCommitAt).map((pr) => (Date.parse(pr.mergedAt) - Date.parse(pr.lastCommitAt)) / 60000))],
  ['lock busy, h', 'gates', (day) => busySeconds(ownEnded(day).map((gate) => [Date.parse(gate.startedAt), Date.parse(gate.endedAt)])) / 3600],
  ['gate waits, min', 'gates', (day) => day.gates.reduce((sum, gate) => sum + gate.waitedSeconds, 0) / 60],
  ['commit gates here, median s', 'gates', (day) => median(ownEnded(day).filter((gate) => gate.kind === 'check' || gate.kind === 'commit').map((gate) => gate.seconds))],
  ['checks with the lock free, median s', 'gates', (day) => median(ownEnded(day).filter((gate) => gate.kind === 'check' && gate.waitedSeconds < 5).map((gate) => gate.seconds))],
  ['lands, median s', 'gates', (day) => median(ownEnded(day).filter((gate) => gate.kind === 'land').map((gate) => gate.seconds))],
  ['red lands', 'gates', (day) => ownEnded(day).filter((gate) => gate.kind === 'land' && gate.result !== 'pass' && gate.result !== 'exit 0').length],
  ['Codex attempts', 'codex', (day) => day.codex.length],
  ['Codex, median s', 'codex', (day) => median(day.codex.map((run) => run.seconds).filter(Number.isFinite))],
  ['idle upper bound, median min', 'channel', (day) => median((day.idle ?? []).map((wait) => wait.minutes))],
];

const ownEnded = (day) => day.gates.filter((gate) => gate.lock === 'own' && gate.endedAt);

/** A day's value of each compared row, `null` where its source was not read that day or, for a gate row, where the
 * gate log covers the day only in part: a part of a day is not a day. */
export function dailyValues(day) {
  const values = {};
  for (const [label, source, read] of DAILY) {
    const missing = unreadOf(day, source) || (source === 'gates' && (day.partialFrom || day.partialUntil));
    values[label] = missing ? null : round1(read({ prs: [], gates: [], codex: [], ...day }));
  }
  return values;
}

/** How often, when nothing changed, the median of `m` after values falls outside the range of `n` before values: the
 * values exchangeable, it is above the range when its rank and all above it, ceil(m/2) of them, are the highest of
 * n + m, and below it likewise, so 2 * prod (m - i) / (n + m - i) over those ranks. An even `m`'s median is the mean
 * of two, which may lie outside with only m/2 past the range: that product is then a bound. A percentage, as said. */
export function outsideChance(n, m) {
  // An empty side has no range or no median: there is no chance to state.
  if (n === 0 || m === 0) return null;
  const far = Math.ceil(m / 2);
  let chance = 2;
  for (let i = 0; i < far; i += 1) chance *= (m - i) / (n + m - i);
  return `${m % 2 === 0 ? 'at most ' : ''}${Math.round(Math.min(chance, 1) * 100)}%`;
}

/** Compares a window of days before a change with an equal window after it, row by row, daily value with daily
 * value: `[{ label, before, after, verdict }]`. Under `COMPARE_DAYS` days a side it judges nothing and says how often
 * the after median of a window that did not change falls outside the before range (`outsideChance`); from there a row moved only when the after
 * window's median daily value lies outside the before range. */
export function compareWindows(beforeDays, afterDays) {
  if (beforeDays.length !== afterDays.length) throw new Error(`a comparison reads equal windows: ${beforeDays.length} days before, ${afterDays.length} after`);
  const before = beforeDays.map(dailyValues);
  const after = afterDays.map(dailyValues);
  return DAILY.map(([label]) => {
    const was = before.map((values) => values[label]).filter((value) => value !== null);
    const is = after.map((values) => values[label]).filter((value) => value !== null);
    const n = Math.min(was.length, is.length);
    const chance = outsideChance(was.length, is.length);
    if (n < COMPARE_DAYS) return { label, before: was, after: is, verdict: `not judged: ${n} days a side, under ${COMPARE_DAYS}; ${chance === null ? 'one side has no value' : `with nothing changed, the after median falls outside the before range ${chance} of the time`}` };
    const low = Math.min(...was);
    const high = Math.max(...was);
    const mid = round1(median(is));
    if (mid < low) return { label, before: was, after: is, verdict: `moved down: after median ${mid}, before ${low} to ${high}; chance ${chance} if nothing changed` };
    if (mid > high) return { label, before: was, after: is, verdict: `moved up: after median ${mid}, before ${low} to ${high}; chance ${chance} if nothing changed` };
    return { label, before: was, after: is, verdict: `within the before range ${low} to ${high}` };
  });
}
