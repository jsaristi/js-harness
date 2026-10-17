// The throughput review's measure (odd/tasks/throughput-review.md): the facts of a UTC day read from the records the
// harness keeps, and the fixed table a window of days prints. Pure: it reads no file and spawns nothing, so a test
// hands it records and the command (bin/throughput.mjs) hands it what it read. The facts and not the figures are
// what a day keeps, so a median over several days is the median of their facts, never of their daily medians.

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

/** The gates of a day among the gate log's events (`readGateLog`): `{ gates, partialFrom }`. A gate is the day's when
 * its start is in `[from, to)`. `partialFrom` is the time of the oldest event when the log holds none before `from`:
 * the rotation took the start of the day, and every figure of its gates is partial from then. */
export function gateFacts(events, { from, to }) {
  const ends = new Map();
  let oldest = null;
  for (const event of events) {
    if (oldest === null || Date.parse(event.at) < Date.parse(oldest.at)) oldest = event;
    if (event.event === 'end') ends.set(event.id, event);
  }
  const gates = [];
  for (const start of events) {
    if (start.event !== 'start') continue;
    const at = Date.parse(start.at);
    if (!(at >= from && at < to)) continue;
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
      failing: (end?.sensors ?? []).flatMap((sensor) => (Array.isArray(sensor?.failing) ? sensor.failing : [])),
      // The candidate's folder, one per land: a land that bisects runs several gates in it.
      land: /merge-queue/.test(String(start.cwd ?? '')) ? String(start.cwd).split(/[\\/]/).filter(Boolean).at(-1) : null,
      load: Number.isFinite(start.load?.share) ? start.load.share : null,
    });
  }
  return { gates, partialFrom: oldest !== null && Date.parse(oldest.at) > from ? oldest.at : null };
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
  tasks: 'git grep of the checkboxes of odd/tasks/*.md and docs/ROADMAP.md on origin/main',
  conflicts: 'git merge-tree of each merge into a branch on origin/main',
  channel: "the channel (~/.js-harness/channel): a waiting notice to the same session's next one; a session may keep working meanwhile",
};

/** Which source of the facts each row reads, and the key a day's `unavailable` names it by. */
const UNAVAILABLE_KEY = { git: 'git', merge: 'git', gates: 'gate log', codex: 'codex', tasks: 'git', conflicts: 'git', channel: 'channel' };

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
  const unread = (source) => days.filter((day) => day.unavailable?.[UNAVAILABLE_KEY[source]]).map((day) => `${day.day} ${day.unavailable[UNAVAILABLE_KEY[source]]}`);
  const partial = days.filter((day) => day.partialFrom).map((day) => `partial: ${day.day} from ${day.partialFrom.slice(11, 16)}Z`);
  const row = (label, source, value) => {
    const missing = unread(source);
    if (missing.length > 0) return { label, value: `not read: ${missing.join('; ')}`, source: SOURCES[source] };
    const notes = source === 'gates' ? partial : [];
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
  const findings = codex.reduce((sum, run) => sum + (Number.isFinite(run.findings) ? run.findings : 0), 0);
  const idle = all('idle');
  const idleMinutes = idle.map((wait) => wait.minutes);
  const longest = [...idle].sort((a, b) => b.minutes - a.minutes)[0];
  const first = days[0]?.tasks?.start;
  const last = days.at(-1)?.tasks?.end;
  const conflicts = all('conflicts');
  const branchMerges = days.reduce((sum, day) => sum + (day.branchMerges ?? 0), 0);

  const medianOf = (values, unit) => (values.length ? `median ${Math.round(median(values))} ${unit} ${counted(values)}` : 'none');
  return [
    row('pull requests merged', 'git', `${numbers.size} (${(numbers.size / hours).toFixed(2)} an hour)${twice.length ? `; merged twice: ${twice.join(', ')}` : ''}`),
    row('last commit to merge commit', 'merge', leadTimes.length
      ? `median ${Math.round(median(leadTimes))} min, p75 ${Math.round(percentile(leadTimes, 75))} min, worst ${Math.round(Math.max(...leadTimes))} min ${counted(leadTimes)}; docs-only ${medianOf(leadOf(prs.filter((pr) => pr.docsOnly === true)), 'min')}; code ${medianOf(leadOf(prs.filter((pr) => pr.docsOnly === false)), 'min')}`
      : 'none'),
    notRecorded('ready to merged', 'B1, JH 26', 'a ready notice that names its pull request'),
    row('lock busy', 'gates', `${(busy / 3600).toFixed(1)} h of ${hours} h${kinds.length ? `; by kind: ${kinds.join(', ')}` : ''}`),
    row('gate waits', 'gates', `${minutes(waited)} in all${mostWaited.length ? `; most: ${mostWaited.map(([session, seconds]) => `${short(session)} ${minutes(seconds)}`).join(', ')}` : ''}`),
    row('commit gates', 'gates', `here: ${medianOf(commits.map((gate) => gate.seconds), 's')}, lock free ${medianOf(free, 's')}; GitHub: ${medianOf(github, 's')}`),
    row('lands', 'gates', `${lands.length}, median ${lands.length ? Math.round(median(lands.map((gate) => gate.seconds))) : '-'} s, red ${red.length}; ${lands.length} gates for ${landFolders.size} lands`),
    notRecorded('land phases', 'B2, JH 24', 'one land record per land'),
    row('failing tests', 'gates', topNames(ended.map((gate) => gate.failing), 5).map(([name, n]) => `${name} ×${n}`).join(', ') || 'none'),
    row('load at gate starts', 'gates', loads.length ? `median share ${median(loads).toFixed(2)} (${loads.length}); full at ${loads.filter((share) => share >= 1).length} of ${loads.length}` : 'none'),
    row('Codex reviews', 'codex', `${codex.length} attempts (${codex.filter((run) => run.part).length} parts), median ${codexSeconds.length ? Math.round(median(codexSeconds)) : '-'} s, p90 ${codexSeconds.length ? Math.round(percentile(codexSeconds, 90)) : '-'} s, ${minutes(codexSeconds.reduce((sum, s) => sum + s, 0))} in all; ${findings} findings`),
    row('idle upper bound', 'channel', idle.length
      ? `${idle.length} waits, median ${Math.round(median(idleMinutes))} min, ${(idleMinutes.reduce((sum, m) => sum + m, 0) / 60).toFixed(1)} session-h in all; longest: ${longest.title ?? short(longest.session)} ${Math.round(longest.minutes)} min`
      : 'none'),
    notRecorded('idle with nothing armed', 'B8', 'a presence record of each session'),
    notRecorded('tool calls open long', 'G, JH 26', 'a record of the calls the board flags'),
    row('tasks closed and added', 'tasks', first && last ? `closed ${last.done - first.done}, added ${last.done - first.done + last.open - first.open}, open ${first.open} to ${last.open}` : 'not read'),
    row('conflicts by file', 'conflicts', `${conflicts.length} of ${branchMerges} merges into branches conflicted${conflicts.length ? `: ${topNames(conflicts.map((merge) => merge.files), 5).map(([file, n]) => `${file} ×${n}`).join(', ')}` : ''}`),
  ];
}
