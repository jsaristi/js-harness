// The measure of the context pause, the proof the user is owed (odd/tasks/session-channel.md, section 14):
// for each compaction the host made, whether the session was told the pause before it and kept its state in
// the feature document between the notice and the boundary. A third fact, whether a reply announced the
// compaction to him, left when he stopped compacting by hand (odd/tasks/no-manual-compact.md, S1). The
// facts are judged by `compactionMeasures` (bin/lib/sessions.mjs) from a transcript and two readers; this
// module holds the reader of the document's commits and the lines `sessions --measures` prints. It spawns
// nothing itself and reads no file: git is reached through the `run` it is given, so a test hands it a fake.

import { windowBefore } from './audit.mjs';
import { percentOf, peakContextBefore, shareOf } from './sessions.mjs';

/** The folder and the file name of `document`, split at its last slash of either kind. A transcript of a
 * session on Windows names its files with backslashes, and the measure may be read on another system, where
 * `path.dirname` would take the whole Windows path for a file name. */
function splitDocument(document) {
  const cut = Math.max(document.lastIndexOf('/'), document.lastIndexOf('\\'));
  return cut === -1 ? { folder: '.', name: document } : { folder: document.slice(0, cut) || document.slice(0, 1), name: document.slice(cut + 1) };
}

/** A bound of the stretch as milliseconds: `null` is open (`fallback`), and a time that does not parse is
 * `NaN`, which the reader takes for "not known" rather than for a bound that every commit passes. */
const boundOf = (time, fallback) => (time === null ? fallback : Date.parse(time));

/** A reader of the feature document's state for `compactionMeasures`: for `{ document, after, before }` it
 * asks git for the commit times of that document alone, from the document's own folder, and answers
 * `{ known: true, kept }`, `kept` being whether a commit falls after `after` (the notice; `null` is open) and
 * at or before `before` (the boundary). The times are compared as instants, since git writes each in the
 * offset of the machine that committed it, and a commit time that does not parse proves nothing. The file
 * is measured, not the tool call: an edit the session made and never committed is not a state kept.
 *
 * `{ known: false }` when there is no document, a bound does not parse, or git cannot answer (not a
 * repository, a worktree since removed, git missing): a fact that could not be read is not judged, which is
 * not the same as a stretch whose state was not kept. `run` is spawnSync-shaped: `{ status, stdout, error }`. */
export function keptByGitLog(run) {
  return ({ document, after, before } = {}) => {
    const unknown = { known: false };
    if (typeof document !== 'string' || document === '') return unknown;
    const from = boundOf(after ?? null, -Infinity);
    const to = boundOf(before ?? null, Infinity);
    if (Number.isNaN(from) || Number.isNaN(to)) return unknown;
    const { folder, name } = splitDocument(document);
    let result;
    try {
      result = run('git', ['-C', folder, 'log', '--format=%cI', '--', name], {});
    } catch {
      return unknown;
    }
    if (!result || result.error || result.status !== 0) return unknown;
    const kept = String(result.stdout ?? '')
      .split(/\r?\n/)
      .map((line) => Date.parse(line.trim()))
      .some((time) => Number.isFinite(time) && time > from && time <= to);
    return { known: true, kept };
  };
}

/** The span a line of the relief file is stamped with, `{ from, to }` in ms, both included: `YYYY-MM-DD HH:MM:SS local`
 * as `reliefStamp` (bin/lib/channel.mjs) writes it since 2026-10-15, one instant; `YYYY-MM-DD HH:MM local` as it wrote
 * before and as a hand-written line does, the whole minute. In the local time of the machine that wrote it. `null` for
 * a line that does not start with such a stamp, or whose date or hour the calendar does not have: a line whose hour is
 * not known proves nothing. */
const RELIEF_STAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))? local\b/;
function reliefSpan(line) {
  const match = RELIEF_STAMP.exec(line);
  if (match === null) return null;
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const at = new Date(year, month - 1, day, hour, minute, second);
  const same = at.getFullYear() === year && at.getMonth() === month - 1 && at.getDate() === day && at.getHours() === hour
    && at.getMinutes() === minute && at.getSeconds() === second;
  if (!same) return null;
  return { from: at.getTime(), to: match[6] === undefined ? at.getTime() + 59999 : at.getTime() };
}

/** A reader of the orchestrator's relief file for `compactionMeasures`: for `{ after, before }` it reads `file` through
 * `readFile(file)` and answers `{ known: true, kept }`, `kept` being whether a line is stamped after `after` (the
 * notice; `null` is open) and at or before `before` (the boundary), compared as instants. A line stamped with minutes
 * only, whose minute holds a bound, cannot say which side of it it fell on: when no line decides, such a line makes the
 * answer `{ known: false, undecided: true }`, never kept, since that line may be the state kept (`keptEither` lets no
 * other reader call it a miss). A stamp that does not parse proves nothing. `{ known: false }` when the file cannot be
 * read, ENOENT included, or a bound does not parse. */
export function keptByRelief(readFile, file) {
  return ({ after, before } = {}) => {
    const unknown = { known: false };
    const from = boundOf(after ?? null, -Infinity);
    const to = boundOf(before ?? null, Infinity);
    if (Number.isNaN(from) || Number.isNaN(to)) return unknown;
    let text;
    try {
      text = readFile(file);
    } catch {
      return unknown;
    }
    let ambiguous = false;
    for (const line of String(text).split(/\r?\n/)) {
      const span = reliefSpan(line);
      if (span === null) continue;
      if (span.from > from && span.to <= to) return { known: true, kept: true };
      if (span.to > from && span.from <= to) ambiguous = true;
    }
    return ambiguous ? { known: false, undecided: true } : { known: true, kept: false };
  };
}

/** One reader that answers what `readers` answer together: `{ known: true, kept: true }` when a known reader says kept;
 * `{ known: false }` when none does and a reader is undecided (it read a line that may be the state kept, so another
 * reader's "not kept" is no miss); `{ known: true, kept: false }` when a reader is known and none says kept; and
 * `{ known: false }` when none is known. A reader that throws, or answers nothing, is not known and decides nothing. */
export function keptEither(...readers) {
  return (query) => {
    const answers = readers.map((reader) => {
      try {
        return reader(query);
      } catch {
        return { known: false };
      }
    });
    if (answers.some((answer) => answer?.known === true && answer.kept === true)) return { known: true, kept: true };
    if (answers.some((answer) => answer?.undecided === true)) return { known: false };
    if (answers.some((answer) => answer?.known === true)) return { known: true, kept: false };
    return { known: false };
  };
}

const FACTS = ['told', 'kept'];

/** Whether a compaction carries a verdict: one the host made, with the stretch before it in this transcript. */
const isJudged = (measure) => measure.verdict !== null && measure.verdict !== undefined;

/** What the closing line of `sessions --measures` counts, as data: `{ judged, sessions, missing, facts,
 * unknown, asked, elsewhere, unreadable }`. `judged` is the automatic compactions with a verdict and
 * `sessions` the sessions that hold one; `missing` the judged ones that miss a fact, and `facts` how many
 * miss each; `unknown` the judged ones with a fact that could not be read, which a count of misses alone
 * would hide, since zero misses read from unknown facts proves nothing; `asked` the compactions the user
 * asked for, counted and never judged; `elsewhere` the automatic ones whose stretch is in another transcript
 * (it is judged there, once); `unreadable` the transcripts that could not be read. */
export function measuresTotal(sessions) {
  const total = { judged: 0, sessions: 0, missing: 0, facts: { told: 0, kept: 0 }, unknown: 0, asked: 0, elsewhere: 0, unreadable: 0 };
  for (const session of sessions) {
    if (session.unavailable !== undefined) {
      total.unreadable += 1;
      continue;
    }
    const measures = session.measures ?? [];
    const judged = measures.filter(isJudged);
    if (judged.length > 0) total.sessions += 1;
    total.judged += judged.length;
    total.asked += measures.filter((measure) => !measure.automatic).length;
    total.elsewhere += measures.filter((measure) => measure.automatic && !isJudged(measure)).length;
    for (const { verdict } of judged) {
      if (verdict.missing.length > 0) total.missing += 1;
      for (const fact of verdict.missing) total.facts[fact] += 1;
      if (FACTS.some((fact) => verdict[fact] === null)) total.unknown += 1;
    }
  }
  return total;
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const said = (fact) => (fact === true ? 'yes' : fact === false ? 'no' : 'unknown');

/** The line of one compaction: its time, who made it, and for one the host made, its two facts. */
function measureLine(measure) {
  const when = measure.at ?? 'no time recorded';
  if (!measure.automatic) return `  ${when}  asked`;
  if (!isJudged(measure)) return `  ${when}  automatic  not judged: the stretch before it is not in this transcript`;
  return `  ${when}  automatic  ${FACTS.map((fact) => `${fact} ${said(measure.verdict[fact])}`).join('  ')}`;
}

/** The text of `sessions --measures`: one block per session that holds a compaction, headed by its title
 * (with the first eight characters of its id) or by its whole id, and a line per compaction, oldest first;
 * a line for each transcript that could not be read, since a measure that skipped one silently would
 * claim more than it read; then the total. `sessions` is `[{ id, title?, measures } | { id, unavailable }]`,
 * each `measures` as `compactionMeasures` gives them. */
export function measuresLines(sessions) {
  const lines = [];
  for (const session of sessions) {
    if (session.unavailable !== undefined) {
      lines.push(`${session.id}  unavailable: ${session.unavailable}`);
      continue;
    }
    const measures = session.measures ?? [];
    if (measures.length === 0) continue;
    lines.push(session.title ? `${session.id.slice(0, 8)}  ${session.title}` : session.id);
    const oldestFirst = [...measures].sort((a, b) => ((a.at ?? '') < (b.at ?? '') ? -1 : (a.at ?? '') > (b.at ?? '') ? 1 : 0));
    for (const measure of oldestFirst) lines.push(measureLine(measure));
  }
  const total = measuresTotal(sessions);
  const missed = FACTS.filter((fact) => total.facts[fact] > 0).map((fact) => `${fact} ${total.facts[fact]}`);
  let closing = `${plural(total.judged, 'automatic compaction', 'automatic compactions')} judged in ${plural(total.sessions, 'session', 'sessions')}: ${total.missing} ${total.missing === 1 ? 'misses' : 'miss'} a fact`;
  if (missed.length > 0) closing += ` (${missed.join(', ')})`;
  if (total.unknown > 0) closing += `; ${total.unknown} with a fact not known`;
  if (total.asked > 0) closing += `; ${total.asked} asked, not judged`;
  if (total.elsewhere > 0) closing += `; ${total.elsewhere} automatic not judged here`;
  if (total.unreadable > 0) closing += `; ${plural(total.unreadable, 'transcript', 'transcripts')} could not be read`;
  lines.push(closing);
  return lines;
}

// ---- the reliefs and the reopenings (session channel, odd/tasks/session-channel.md, section 18) ----
//
// Two measures that reopen a decision, printed by `sessions --measures` after the compactions. Neither decides anything:
// a relief is the context its relieved session was at when it was relieved, and a reopening is a candidate line of a
// feature document's Log for the lead to judge. The record, the transcripts and git come in through the arguments.

const pad2 = (number) => String(number).padStart(2, '0');

/** The local calendar day of `ms`, as `YYYY-MM-DD`. */
export function localDay(ms) {
  const at = new Date(ms);
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
}

/** The local time of `ms` as these lines print it: `YYYY-MM-DD HH:MM`. */
function localMinute(ms) {
  const at = new Date(ms);
  return `${localDay(ms)} ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

/** The instant of local midnight at the start of the day of `ms`. The reliefs read whole days, so a relief of the morning
 * is read by a window that starts at noon. */
export function dayStartOf(ms) {
  const at = new Date(ms);
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

/** The title a relieved lead carries once it is renamed out of the role's title, before it appends its notice. */
const RELIEVED_TITLE = /\bORQ\b.*\brelevad[ao]\b/i;

/** The id of the session a `relieved` notice relieves, or `null` when it is not known: the sender's full id, when the sender
 * has one and its title is a relieved title. A sender with no id (Codex) or another title is not known. */
function relievedOf(notice) {
  const from = notice.from ?? {};
  return typeof from.id === 'string' && from.id !== '' && typeof from.title === 'string' && RELIEVED_TITLE.test(from.title) ? from.id : null;
}

/** One relief, judged from the transcript of the session it relieves: `transcriptLines(id)` gives that transcript's lines, or
 * throws. The verdict is "filled" when the peak of the session's replies since its last compaction before the notice is at or
 * past the pause (`shareOf` of the window), "another reason" below it, and "not known" when no transcript is read or no reply
 * of it records its usage. The window is the session's own last get_usage read before the notice, else `defaultWindow`. */
function reliefOf(notice, { transcriptLines, pausePercent, defaultWindow }) {
  const at = Date.parse(notice.at);
  const relieved = relievedOf(notice);
  let lines = null;
  if (relieved !== null) {
    try {
      lines = transcriptLines(relieved);
    } catch {
      lines = null;
    }
  }
  const peak = lines === null ? { tokens: null, preTokens: null } : peakContextBefore(lines, at);
  const window = (lines === null ? null : windowBefore(lines, at)) ?? defaultWindow;
  const verdict = peak.tokens === null ? 'not known' : peak.tokens >= shareOf(window, pausePercent) ? 'filled' : 'another reason';
  return {
    at: notice.at,
    day: localDay(at),
    relieved,
    verdict,
    peak: peak.tokens === null ? null : { tokens: peak.tokens, percent: percentOf(peak.tokens, window) },
    window,
    pausePercent,
    preTokens: peak.preTokens,
    fromContext: notice.from?.context ?? null,
  };
}

/** The reliefs of the record from the window's first day on, oldest first: one judged relief for each `relieved` notice at or
 * after `since` (ms, a local midnight). `transcriptLines` and the pause are as `reliefOf` takes them. */
export function reliefMeasures(notices, { since, transcriptLines, pausePercent, defaultWindow }) {
  return notices
    .filter((notice) => notice?.kind === 'relieved' && Date.parse(notice.at) >= since)
    .sort((one, other) => Date.parse(one.at) - Date.parse(other.at))
    .map((notice) => reliefOf(notice, { transcriptLines, pausePercent, defaultWindow }));
}

/** What the closing line of the reliefs counts, as data: `{ reliefs, filled, days }`, the reliefs, those whose context filled,
 * and the local days with more than one such relief. */
export function reliefsTotal(reliefs) {
  const filledByDay = new Map();
  for (const one of reliefs) {
    if (one.verdict === 'filled') filledByDay.set(one.day, (filledByDay.get(one.day) ?? 0) + 1);
  }
  const filled = [...filledByDay.values()].reduce((sum, count) => sum + count, 0);
  const days = [...filledByDay].filter(([, count]) => count > 1).map(([day]) => day).sort();
  return { reliefs: reliefs.length, filled, days };
}

/** The lines of the reliefs: a line each (local time, the relieved session's first eight characters or "unknown", its peak
 * against its window, its verdict and the pause), then the closing line. With no relief in the record, the line that says so
 * for the days read, from `since` to `now`: never "no relief". */
export function reliefLines(reliefs, { since, now }) {
  if (reliefs.length === 0) return [`no relieved notice in the record for ${localDay(since)}..${localDay(now)}`];
  const lines = reliefs.map((one) => {
    const who = one.relieved === null ? 'unknown' : one.relieved.slice(0, 8);
    const peak = one.peak === null ? 'peak not known' : `peak ${one.peak.percent}% of ${Math.round(one.window / 1000)}k`;
    return `${localMinute(Date.parse(one.at))}  ${who}  ${peak}  ${one.verdict}  pause ${one.pausePercent}%`;
  });
  const total = reliefsTotal(reliefs);
  const days = total.days.length === 0 ? 'none' : total.days.join(', ');
  lines.push(`${plural(total.reliefs, 'relief', 'reliefs')}, ${total.filled} because the context filled; days with more than one: ${days}`);
  return lines;
}

/** A Log entry an added diff line opens: `+- **L7**` or `+- L2.`, with the Log id it names. */
const LOG_ENTRY = /^\+\s*-\s+(?:\*\*)?(L\d+)\b/;
/** A line that says a reopening, in any form. */
const REOPEN = /reopen/i;
/** The marker `git log --format=commit %H %cI %s` writes before each commit, with its hash and its committer time. */
const COMMIT_MARK = /^commit ([0-9a-f]{40}) (\S+)/;
/** A hunk header of a diff: the line of the new file the hunk starts at. */
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Why a `run` result failed: its error, else what it wrote to stderr, else its status. */
function failureOf(result) {
  if (result?.error) return result.error.message;
  const said = String(result?.stderr ?? '').trim();
  return said === '' ? `git exited with status ${result?.status}` : said;
}

/** The added lines of a `git log -p -m --first-parent` text that open a Log entry, each as `{ commit, at, document, line, text }`
 * where `text` is the diff line with its `+` and `line` its number in the document the merge leaves. */
function addedLogEntries(diff) {
  const added = [];
  let commit = null;
  let at = null;
  let document = null;
  let inHeader = false;
  let next = 0;
  for (const text of diff.split(/\r?\n/)) {
    const mark = COMMIT_MARK.exec(text);
    if (mark !== null) {
      [, commit, at] = mark;
      document = null;
      inHeader = false;
    } else if (text.startsWith('diff --git ')) {
      document = null;
      inHeader = true;
    } else if (inHeader && text.startsWith('+++ ')) {
      document = text.startsWith('+++ b/') ? text.slice('+++ b/'.length) : null;
    } else if (HUNK.test(text)) {
      inHeader = false;
      next = Number(HUNK.exec(text)[1]);
    } else if (!inHeader && commit !== null && document !== null) {
      if (text.startsWith('+')) {
        if (LOG_ENTRY.test(text)) added.push({ commit, at, document, line: next, text });
        next += 1;
      } else if (text.startsWith(' ')) {
        next += 1;
      }
    }
  }
  return added;
}

/** Whether line `number` (1-based) of `lines` lies under a `## Log` heading: the last `## ` heading before it is `## Log`. */
function underLog(lines, number) {
  let inLog = false;
  for (const line of lines.slice(0, number - 1)) {
    if (line.startsWith('## ')) inLog = /^## Log\b/.test(line);
  }
  return inLog;
}

/** The text of `document` at `commit`, as `git show` gives it, or the reason it cannot be read. */
function documentAt(run, root, commit, document) {
  let shown;
  try {
    shown = run('git', ['-C', root, 'show', `${commit}:${document}`], {});
  } catch (err) {
    return { known: false, why: err.message };
  }
  return shown && !shown.error && shown.status === 0 ? { known: true, text: String(shown.stdout ?? '') } : { known: false, why: failureOf(shown) };
}

/** The Log lines of the feature documents that name a reopening, as candidates for the lead: `{ known: true, candidates }`, each
 * `{ at, document, id, commit }` (the merge's committer time, the document, the Log id, the commit's short hash), oldest first; or
 * `{ known: false, why }` when git cannot answer, never zero. A candidate is a line the first-parent history of the repository
 * adds under a document's `## Log` heading, opening with a Log id and saying "reopen" in any form. Nothing is judged here: the
 * cause is not read, and a reopening written in no Log, or closed again inside one pull request, is not seen. `run` is spawnSync-shaped. */
export function reopenCandidates(run, root, sinceIso) {
  // The default branch by name (origin/HEAD), not the main checkout's HEAD: a checkout on a feature branch would read its
  // unmerged Log lines as landed and miss the newer landed ones.
  let head;
  try {
    head = run('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'origin/HEAD'], {});
  } catch (err) {
    return { known: false, why: `the default branch is not known: ${err.message}` };
  }
  const branch = head && !head.error && head.status === 0 ? String(head.stdout ?? '').trim() : '';
  if (branch === '' || branch === 'origin/HEAD') return { known: false, why: `the default branch is not known: ${failureOf(head)}` };
  let log;
  try {
    log = run('git', ['-C', root, 'log', '-p', '-m', '--first-parent', '--format=commit %H %cI %s', `--since=${sinceIso}`, branch, '--', 'odd/tasks/*.md'], {});
  } catch (err) {
    return { known: false, why: err.message };
  }
  if (!log || log.error || log.status !== 0) return { known: false, why: failureOf(log) };
  const documents = new Map();
  const candidates = [];
  for (const entry of addedLogEntries(String(log.stdout ?? ''))) {
    if (!REOPEN.test(entry.text)) continue;
    const key = `${entry.commit}:${entry.document}`;
    if (!documents.has(key)) documents.set(key, documentAt(run, root, entry.commit, entry.document));
    const shown = documents.get(key);
    if (!shown.known) return { known: false, why: shown.why };
    const lines = shown.text.split(/\r?\n/);
    if (lines[entry.line - 1] !== entry.text.slice(1)) return { known: false, why: `${entry.document} at ${entry.commit.slice(0, 7)} does not hold the line its diff adds` };
    if (!underLog(lines, entry.line)) continue;
    candidates.push({ at: entry.at, document: entry.document, id: LOG_ENTRY.exec(entry.text)[1], commit: entry.commit.slice(0, 7) });
  }
  return { known: true, candidates: candidates.sort((one, other) => Date.parse(one.at) - Date.parse(other.at)) };
}

/** The lines of the reopenings: a line per candidate (its local merge time, document, Log id and commit), then the closing line
 * that says what it cannot see; or the reason git could not answer, never a zero. */
export function reopenLines(found) {
  if (!found.known) return [`reopen candidates: not known (${found.why})`];
  const lines = found.candidates.map((one) => `${localMinute(Date.parse(one.at))}  ${one.document}  ${one.id}  ${one.commit}`);
  lines.push(`${plural(found.candidates.length, 'Log line names', 'Log lines name')} a reopening: candidates for the lead, cause not read. A reopening written in no Log, or closed again inside one pull request, is not seen.`);
  return lines;
}
