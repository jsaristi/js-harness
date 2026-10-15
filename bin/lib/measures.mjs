// The measure of the context pause, the proof the user is owed (odd/tasks/session-channel.md, section 14):
// for each compaction the host made, whether the session was told the pause before it, kept its state in
// the feature document between the notice and the boundary, and announced the compaction to him. The
// facts are judged by `compactionMeasures` (bin/lib/sessions.mjs) from a transcript and two readers; this
// module holds the reader of the document's commits and the lines `sessions --measures` prints. It spawns
// nothing itself and reads no file: git is reached through the `run` it is given, so a test hands it a fake.

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

/** The instant a line of the relief file is stamped with: `YYYY-MM-DD HH:MM local`, in the local time of the machine
 * that wrote it, as `reliefStamp` (bin/lib/channel.mjs) writes it. `NaN` for a line that does not start with such a
 * stamp, or whose date or hour the calendar does not have: a line whose hour is not known proves nothing. */
const RELIEF_STAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) local\b/;
function reliefInstant(line) {
  const match = RELIEF_STAMP.exec(line);
  if (match === null) return NaN;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const at = new Date(year, month - 1, day, hour, minute);
  const same = at.getFullYear() === year && at.getMonth() === month - 1 && at.getDate() === day && at.getHours() === hour && at.getMinutes() === minute;
  return same ? at.getTime() : NaN;
}

/** A reader of the orchestrator's relief file for `compactionMeasures`: for `{ after, before }` it reads `file` through
 * `readFile(file)` and answers `{ known: true, kept }`, `kept` being whether a line is stamped in or after the minute of
 * `after` (the notice; `null` is open) and in or before the minute of `before` (the boundary), compared as instants. A stamp that does not parse proves
 * nothing. `{ known: false }` when the file cannot be read, ENOENT included, or a bound does not parse. */
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
    // A stamp names a minute and the bounds carry seconds: each bound is taken to its minute, and a line of the
    // notice's minute or of the boundary's counts, since which side of the second it fell on cannot be read.
    const minuteOf = (time) => Math.floor(time / 60000) * 60000;
    const kept = String(text)
      .split(/\r?\n/)
      .some((line) => {
        const time = reliefInstant(line);
        return time >= minuteOf(from) && time <= minuteOf(to);
      });
    return { known: true, kept };
  };
}

/** One reader that answers what `readers` answer together: `{ known: true, kept: true }` when a known reader says kept,
 * `{ known: true, kept: false }` when a reader is known and none says kept, and `{ known: false }` when none is known.
 * A reader that throws, or answers nothing, is not known. */
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
    if (answers.some((answer) => answer?.known === true)) return { known: true, kept: false };
    return { known: false };
  };
}

const FACTS = ['told', 'kept', 'announced'];

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
  const total = { judged: 0, sessions: 0, missing: 0, facts: { told: 0, kept: 0, announced: 0 }, unknown: 0, asked: 0, elsewhere: 0, unreadable: 0 };
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

/** The line of one compaction: its time, who made it, and for one the host made, its three facts. */
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
