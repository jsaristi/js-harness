// The pure parts of `js-harness report` (odd/tasks/status-report.md): the cut, and the four sections of facts a
// status report is written from — what landed on the default branch, the sessions' notices, the questions, and the
// roadmap's map, led by the migration's share and the last stretch (odd/tasks/report-stretch-share.md) — read from
// what `bin/report.mjs` gives them and printed as plain lines. Nothing here runs git or reads a file.
import { recordedQuestions } from './channel.mjs';
import { parseRoadmap } from './progress.mjs';
import { planOf } from './report-pages.mjs';
import { planShare } from './stretch-forecast.mjs';

/** The window a report covers when none was ever recorded, in hours. */
export const REPORT_WINDOW_HOURS = 24;

/** The arguments of the git process that lists the merges of the first-parent line of `ref`, newest first, one a
 * line: the hash, the commit time and the subject, split by the unit separator. With `head`, those `ref` gained
 * since that commit; otherwise those since the time `since` (ISO). */
export function mergeLogArgs({ ref, since, head = null }) {
  const range = head === null ? [`--since=${since}`, ref] : [`${head}..${ref}`];
  return ['log', '--first-parent', '--merges', '--format=%H%x1f%cI%x1f%s', ...range, '--'];
}

/** The arguments of the git process that lists the subjects of the commits a merge brought, oldest first, without
 * the merges that brought the default branch into the pull request's branch. */
export function mergeCommitsArgs(hash) {
  return ['log', '--reverse', '--no-merges', '--format=%s', `${hash}^1..${hash}^2`, '--'];
}

/** What `mergeLogArgs` printed, as `[{ hash, at, subject }]`, `at` in milliseconds. */
export function parseMergeLog(stdout) {
  return stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [hash, time, ...subject] = line.split('\u001f');
      return { hash, at: Date.parse(time), subject: subject.join('\u001f').trim() };
    });
}

/** The cut a report starts from, `{ at, source, head }`: `since` (ISO) when given, else the latest of the recorded
 * `reports`, with the commit of the default branch it read as `head`, else `REPORT_WINDOW_HOURS` before `now`
 * (milliseconds). `head` is `null` but for a recorded report that names one. */
export function cutOf({ since, reports = [], now }) {
  if (since !== undefined) return { at: Date.parse(since), source: 'since', head: null };
  const latest = reports.filter((one) => Number.isFinite(Date.parse(one.at))).reduce((best, one) => (best === null || Date.parse(one.at) > Date.parse(best.at) ? one : best), null);
  if (latest !== null) return { at: Date.parse(latest.at), source: 'last-report', head: typeof latest.head === 'string' && latest.head !== '' ? latest.head : null };
  return { at: now - REPORT_WINDOW_HOURS * 3600_000, source: 'window', head: null };
}

const PULL_REQUEST = /^Merge pull request #(\d+) from (\S+)/;

/** The merges after `cut`, `[{ hash, at, subject, commits }]` newest first as git lists them, as what landed:
 * oldest first, `[{ number, branch, subject, at, commits }]`. A pull request merged more than once (a fix after its
 * first land) is one entry, at its latest merge, with the commits of every merge in order. A merge that names no
 * pull request is its own entry, with `number` and `branch` null. */
export function landedOf(merges, cut) {
  const landed = [];
  const byNumber = new Map();
  for (const merge of [...merges].reverse()) {
    if (!(merge.at > cut)) continue;
    const named = PULL_REQUEST.exec(merge.subject);
    const number = named ? Number(named[1]) : null;
    const known = number === null ? undefined : byNumber.get(number);
    if (known) {
      known.at = merge.at;
      known.commits.push(...merge.commits);
      continue;
    }
    const entry = { number, branch: named ? named[2] : null, subject: merge.subject, at: merge.at, commits: [...merge.commits] };
    landed.push(entry);
    if (number !== null) byNumber.set(number, entry);
  }
  return landed;
}

const present = (value) => typeof value === 'string' && value !== '';

/** The sessions that wrote a notice after `cut`, `[{ name, count, last }]`: how many they wrote and the last one,
 * ordered by that last notice, the latest last. A session is its id, since two may share a title, and is named by
 * its title, else its id; the senders no session id names (a Codex session today) are one line, `unknown senders`. */
export function sessionsOf(notices, cut) {
  const byKey = new Map();
  for (const notice of notices) {
    if (!(Date.parse(notice.at) > cut)) continue;
    const from = notice.from ?? {};
    const key = present(from.id) ? `id:${from.id}` : 'unknown';
    const known = byKey.get(key) ?? { name: 'unknown senders', count: 0, last: null };
    if (present(from.id)) known.name = present(from.title) ? from.title : from.id;
    known.count += 1;
    if (known.last === null || Date.parse(notice.at) >= Date.parse(known.last.at)) known.last = notice;
    byKey.set(key, known);
  }
  return [...byKey.values()].sort((a, b) => Date.parse(a.last.at) - Date.parse(b.last.at));
}

/** The words of an answer notice: what its copy of his answer holds, else its own text. */
function answerWords(notice) {
  const copied = notice.copy?.answers?.map((one) => one.answer).filter((one) => typeof one === 'string');
  return copied && copied.length > 0 ? copied.join(' / ') : notice.text;
}

/** The questions of a record (`readNotices`): `answered`, those answered after `cut`, `[{ number, notice, answer,
 * verified, at }]` (`verified` false for an answer no transcript confirmed, the sender's claim), and `open`, every question nothing has closed, whenever it was asked, `[{ number, notice }]`. */
export function questionsOf(record, cut) {
  const answered = [];
  const open = [];
  for (const { number, notice, closed } of recordedQuestions(record)) {
    if (closed === null) open.push({ number, notice });
    else if (closed.by === 'answer' && Date.parse(closed.notice.at) > cut) answered.push({ number, notice, answer: answerWords(closed.notice), verified: closed.notice.verified !== false, at: Date.parse(closed.notice.at) });
  }
  return { answered, open };
}

/** The roadmap's map from its markdown: `{ done, total, phases: [{ title, done, total, open }], plans: [{ name, done,
 * total }] }`, `open` being the text of each step still open, and each plan section's steps done counted as the stretch
 * forecast counts them (`planShare`): the F8 plan's is the migration's share. */
export function mapOf(markdown) {
  const { phases, done, total } = parseRoadmap(markdown);
  return {
    done,
    total,
    phases: phases.map((phase) => ({ title: phase.title, done: phase.done, total: phase.total, open: phase.steps.filter((step) => !step.done).map((step) => step.text) })),
    plans: planOf(markdown).map((plan) => ({ name: plan.name, ...planShare(plan) })),
  };
}

/** `ms` as `YYYY-MM-DD HH:MMZ`, in UTC. */
export function stamp(ms) {
  return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')}Z`;
}

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
/** A text that may hold line breaks (a question, his answer) as one line: its lines trimmed and joined by ` / `. */
const oneLine = (text) => String(text).split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '').join(' / ');
const percent = (done, total) => (total === 0 ? '—' : `${Math.round((done / total) * 100)}%`);

const CUT_SAID = {
  since: 'as --since asked',
  'last-report': 'the last report',
  window: `the last ${REPORT_WINDOW_HOURS} hours: no report is recorded`,
};

/** Each plan section's share now and at the cut (`before`: `{ map }`, `{ unavailable }` or `null`), as lines. */
function migrationLines(map, before) {
  if (map.plans.length === 0) return ['Migration: the roadmap has no plan section'];
  return map.plans.map((plan) => {
    const was = before?.map?.plans?.find((one) => one.name === plan.name);
    let cut;
    if (!before) cut = 'at the cut not known: the last report recorded no commit';
    else if (before.unavailable) cut = `at the cut not known: ${before.unavailable}`;
    else cut = was ? `at the cut ${was.done}/${was.total}  ${percent(was.done, was.total)}` : 'at the cut the roadmap had no such plan';
    return `Migration: ${plan.name}  ${plan.done}/${plan.total} steps  ${percent(plan.done, plan.total)}; ${cut}`;
  });
}

const hoursRange = ([low, high]) => (low === high ? `${low} h` : `${low}-${high} h`);

/** The stretch's forecast (`forecastOf` with `now`, `forecastNow`'s) as lines: each plan by its steps, then the map. */
function forecastLines(forecast) {
  if (forecast.unavailable) return [`  forecast: the map could not be read (${forecast.unavailable})`];
  const { now } = forecast;
  const nowOf = (counts) => {
    if (!now) return 'not measured now';
    if (now.unavailable) return `now could not be read (${now.unavailable})`;
    return counts ? `now ${percent(counts.done, counts.total)}` : 'now gone from the roadmap';
  };
  const scope = (label, counts, current) => `  forecast ${label}: ${percent(counts.done, counts.total)} at the opening, ~${percent(counts.forecast, counts.total)} at the return (${percent(counts.low, counts.total)} to ${percent(counts.high, counts.total)}); ${nowOf(current)}`;
  const rowsDone = now && !now.unavailable ? `; ${now.forecastDone.done} of ${now.forecastDone.of} forecast rows done` : '';
  return [
    ...forecast.plans.map((plan) => scope(plan.name, plan, now?.plans?.find((one) => one.name === plan.name))),
    `${scope('map', forecast.total, now?.total)}${rowsDone}`,
  ];
}

/** The last stretch since the cut (`reportStretch` of `bin/stretch.mjs`), `null` or `{ unavailable }`, as lines. */
function stretchLines(stretch) {
  if (stretch === null) return ['Stretch: none open or closed since the cut'];
  if (stretch.unavailable) return [`Stretch: could not read: ${stretch.unavailable}`];
  const { goals, totals } = stretch;
  const when = stretch.state === 'closed' ? `closed at ${stamp(Date.parse(stretch.at))}` : `open, back at ${stamp(Date.parse(stretch.returnAt))}`;
  const checked = goals.checkedAt ? `checked ${stamp(Date.parse(goals.checkedAt))}` : 'not checked yet';
  return [
    `Stretch ${stretch.id}: ${when}, opened ${stamp(Date.parse(stretch.openedAt))}; ${stretch.elapsedHours} of ${stretch.hours} h; goals ${goals.met} of ${goals.total} met, ${checked}`,
    ...goals.list.map((goal) => `  goal ${goal.id} ${goal.met === null ? 'not checked' : `${goal.met ? 'met' : 'not met'} (${goal.said})`}: ${oneLine(goal.text)}`),
    `  estimated ${hoursRange(totals.estimate)}, real ${totals.realHours} h, lost ${totals.lostHours} h`,
    ...Object.entries(stretch.unread ?? {}).map(([name, why]) => `  ${name} could not be read: ${why}; the hours above are partial`),
    ...forecastLines(stretch.forecast),
  ];
}

/** The report as lines: the cut, then Landed, Sessions, Questions, the migration and the last stretch, and Map. A
 * section given as `{ error }` says it could not be read, and a map given as `{ absent: true }` that the default branch
 * holds no roadmap. The migration is each plan's share of `map` now and in `before`, the map at the cut; `stretch`
 * left out prints no stretch line. */
export function reportLines({ cut, branch, landed, sessions, questions, map, before = null, stretch }) {
  const lines = [`Since ${stamp(cut.at)}, ${CUT_SAID[cut.source]}`, ''];

  if (landed.error) lines.push(`Landed on ${branch}: could not read: ${landed.error}`);
  else if (landed.length === 0) lines.push(`Landed on ${branch}: nothing since the cut`);
  else {
    const others = landed.filter((one) => one.number === null).length;
    const pullRequests = plural(landed.length - others, 'pull request');
    lines.push(`Landed on ${branch}: ${others === 0 ? pullRequests : `${pullRequests} and ${plural(others, 'other merge')}`}`);
    for (const one of landed) {
      lines.push(one.number === null ? `  ${one.subject}  merged ${stamp(one.at)}` : `  #${one.number} ${one.branch}  merged ${stamp(one.at)}`);
      for (const commit of one.commits) lines.push(`      - ${commit}`);
    }
  }
  lines.push('');

  if (sessions.error) lines.push(`Sessions: could not read: ${sessions.error}`);
  else if (sessions.length === 0) lines.push('Sessions: no notice since the cut');
  else {
    lines.push(`Sessions: ${sessions.length} wrote notices`);
    for (const one of sessions) {
      lines.push(`  ${one.name}  ${one.last.kind} ${stamp(Date.parse(one.last.at))}  (${plural(one.count, 'notice')})`);
      lines.push(`      ${one.last.text}`);
    }
  }
  lines.push('');

  if (questions.error) lines.push(`Questions: could not read: ${questions.error}`);
  else if (questions.answered.length === 0 && questions.open.length === 0) lines.push('Questions: none answered since the cut, none open');
  else {
    lines.push(`Questions: ${questions.answered.length} answered, ${questions.open.length} open`);
    for (const one of questions.answered) {
      lines.push(`  answered #${one.number} at ${stamp(one.at)}: ${oneLine(one.notice.text)}`);
      lines.push(`      ${one.verified === false ? "answer, not verified (the sender's claim)" : 'answer'}: ${oneLine(one.answer)}`);
    }
    for (const one of questions.open) {
      lines.push(`  open #${one.number} since ${stamp(Date.parse(one.notice.at))}: ${oneLine(one.notice.text)}`);
      lines.push(`      waits: ${oneLine(one.notice.waits)}`);
    }
  }
  lines.push('');

  if (!map.error && !map.absent && map.plans !== undefined) lines.push(...migrationLines(map, before));
  if (stretch !== undefined) lines.push(...stretchLines(stretch));
  if (lines.at(-1) !== '') lines.push('');

  if (map.error) lines.push(`Map: could not read: ${map.error}`);
  else if (map.absent) lines.push(`Map: no docs/ROADMAP.md on ${branch}`);
  else {
    lines.push(`Map: docs/ROADMAP.md on ${branch}  ${map.done}/${map.total}  ${percent(map.done, map.total)}`);
    for (const phase of map.phases) {
      const finished = phase.total > 0 && phase.done === phase.total;
      lines.push(`  ${finished ? '[x]' : '[ ]'} ${phase.title}  ${phase.done}/${phase.total}  ${percent(phase.done, phase.total)}`);
      for (const step of phase.open) lines.push(`      - ${step}`);
    }
  }
  return lines;
}
