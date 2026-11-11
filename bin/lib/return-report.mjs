// The return check of the reply Stop hook (odd/tasks/lead-duty-checks.md, spec 2): when the user's newest message to
// the lead comes after an absence longer than `ABSENCE_MS`, the lead's replies since that message must link the status
// page `js-harness report --html` wrote since it, or the stop is turned back once with what to run.
//
// Why. On 2026-10-31 he came back after 6.7 hours and the lead gave him the totals in one line, without the page
// `rule:reports-spanish-visual` asks for, until he asked ("en ningun momento me mostraste que tanto avanzamos"). The
// duties a hook checked were done that night; the ones only written in the orchestrator skill were not, and the skill
// reaches the lead cut after each compaction. A reply is shown when the hook runs, so this reminds, it does not
// prevent, and a record it cannot read throws, so the hook says the check did not run and lets the stop through.
//
// What it reads, each by the rule that already says it: his messages by `quoteOf`'s (`personTimesIn`), so a tapped
// answer is his too; the lead as the live-board check tells it (`isLeadSession`); the page as a `status-report` line of
// the rendered record, which `report --html` appends with the file's path; and the link as the URL of the `Artifact`
// call that published that path since his message, written in this reply or in one of the lead's since it. "Once" is
// read from the transcript, as the live-board check reads its own: a warning that names the same return is not given
// again.

import path from 'node:path';
import { readNotices } from './channel.mjs';
import { harnessHome } from './home.mjs';
import { localHour, localZone } from './local-time.mjs';
import { linesHolding, personLinesIn, personTimesIn, personTimesOf } from './person-times.mjs';
import { comparable, mainCheckout, parseTranscript, projectSlug, questionCallsOf } from './sessions.mjs';
import { isLeadSession } from './stale-board.mjs';
import { pageTarget } from './template-gate.mjs';
import { lastLineWith } from './stop-wake.mjs';
import { eventsOf, stretchFile } from './stretch.mjs';
import { RENDERED_SCHEMA, readRecord, renderedFile } from './template-record.mjs';

/** How long between two of his messages counts as an absence, in ms. In the four largest lead transcripts of this
 * project (2026-10-31), 40 of 311 gaps between his messages were longer than 2 hours, about one or two a day, so the
 * page costs one report run per such return; and in the 16 hours to 2026-10-31 01:46Z, 27 pull requests landed, so
 * after 2 hours away about three have, and a line of totals no longer says what changed. */
export const ABSENCE_MS = 2 * 3600_000;

/** The words only this warning has, by which an earlier one is found in the transcript. */
export const RETURN_MARKER = 'he came back after';

// The link a published Artifact gets, as the host's result of the call says it.
const ARTIFACT_URL = /https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9_-]+/g;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const blocksOf = (entry) => (Array.isArray(entry?.message?.content) ? entry.message.content.filter(isObject) : []);
const timeOf = (entry) => Date.parse(entry?.timestamp ?? '');

/** The text a tool result holds: its content as a string, or its text blocks joined. */
function resultText(block) {
  if (typeof block.content === 'string') return block.content;
  return Array.isArray(block.content) ? block.content.filter((part) => typeof part?.text === 'string').map((part) => part.text).join('\n') : '';
}

/** His newest return among `times` (his messages, oldest first): the newest message whose gap to the one before is
 * longer than `ABSENCE_MS`, as `{ before, back, away }`, or `null`. Not his newest message alone: on 2026-10-31 he
 * wrote "ya llegue" at 01:33:48Z and three short messages before the lead's first reply at 01:43:11Z. */
export function lastReturn(times) {
  for (let i = times.length - 1; i > 0; i -= 1) {
    const away = Date.parse(times[i]) - Date.parse(times[i - 1]);
    if (away > ABSENCE_MS) return { before: times[i - 1], back: times[i], away };
  }
  return null;
}

/** The status-report pages the rendered record holds as written at or after `sinceMs`: each page's comparable path
 * with the times it was written. */
function pagesSince(file, sinceMs, readFile) {
  let lines;
  try {
    lines = readRecord(file, RENDERED_SCHEMA, { readFileSync: (name) => readFile(name) });
  } catch (err) {
    throw new Error(`the rendered record (${file}): ${err?.code ?? err?.message}`);
  }
  const pages = new Map();
  for (const one of lines) {
    const at = Date.parse(one.at);
    if (one.template !== 'status-report' || typeof one.path !== 'string' || !(at >= sinceMs)) continue;
    const key = comparable(one.path);
    pages.set(key, [...(pages.get(key) ?? []), at]);
  }
  return pages;
}

/** The URLs the `Artifact` calls of the transcript `text` made at or after `sinceMs` publishing one of `pages` after
 * it was written: the call's own `url` when it updates an artifact, and the link its result gives. A call's files are
 * read as the template gate reads them (`pageTarget`: the page, its `files` and their `root`), a relative one under
 * the folder the call ran in (`cwd`). A publish older than every render of its file since then sent the report
 * before them. */
function publishedUrls(text, pages, sinceMs, cwd) {
  const calls = new Map();
  for (const written of linesHolding(text, ['"Artifact"'])) {
    let entry;
    try {
      entry = JSON.parse(written);
    } catch {
      continue;
    }
    const at = timeOf(entry);
    if (entry?.type !== 'assistant' || entry.isSidechain || !(at >= sinceMs)) continue;
    const folder = typeof entry.cwd === 'string' && entry.cwd !== '' ? entry.cwd : cwd;
    for (const block of blocksOf(entry)) {
      if (block.type !== 'tool_use' || typeof block.id !== 'string') continue;
      const files = pageTarget(block.name, block.input)?.files ?? [];
      const carries = files.some((page) => (pages.get(comparable(path.resolve(folder, page))) ?? []).some((rendered) => rendered <= at));
      if (carries) calls.set(block.id, typeof block.input.url === 'string' ? block.input.url : null);
    }
  }
  const urls = new Set();
  for (const [id, given] of calls) {
    const result = lastLineWith(text, id, (entry) => entry.type === 'user' && blocksOf(entry).some((block) => block.type === 'tool_result' && block.tool_use_id === id));
    const block = result && blocksOf(result.entry).find((one) => one.type === 'tool_result' && one.tool_use_id === id);
    if (!block || block.is_error === true) continue;
    for (const url of [given, ...(resultText(block).match(ARTIFACT_URL) ?? [])]) if (typeof url === 'string' && url !== '') urls.add(url);
  }
  return urls;
}

/** Whether a reply of the lead at or after `sinceMs`, this one (`message`) or one the transcript `text` holds, links
 * one of `urls`. */
function linked(urls, message, text, sinceMs) {
  for (const url of urls) {
    if (typeof message === 'string' && message.includes(url)) return true;
    const reply = lastLineWith(text, url, (entry) => entry.type === 'assistant' && !entry.isSidechain && timeOf(entry) >= sinceMs
      && blocksOf(entry).some((block) => block.type === 'text' && typeof block.text === 'string' && block.text.includes(url)));
    if (reply !== null) return true;
  }
  return false;
}

/** The lead's newest return for a stop of `payload`, read through `io`, as `{ cwd, home, slug, text, before, back,
 * away }`, or `null` when the session is no lead on Claude Code or the transcript holds no return. */
function leadReturnOf(payload, io) {
  // Codex sends no background tasks, and cannot publish a page.
  if (!Array.isArray(payload?.background_tasks)) return null;
  if (typeof payload.session_id !== 'string' || payload.session_id === '') return null;
  if (typeof payload.transcript_path !== 'string' || payload.transcript_path === '') return null;

  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
  const home = harnessHome({ env: io.env, homedir: io.homedir });
  // The hook finds the project once a stop and from the files when it can (`io.mainCheckout`, bin/reply.mjs).
  const slug = projectSlug(io.mainCheckout?.(cwd) ?? mainCheckout(io.run, cwd));
  // One parse of the record for every check of the stop when the hook shares it (`io.readNotices`, bin/reply.mjs).
  const record = (io.readNotices ?? readNotices)(home, slug, { readFile: io.readFile });
  if (record.unavailable !== undefined) throw new Error(`the record of notices (${record.path}): ${record.unavailable}`);
  if (!isLeadSession(record.notices, payload.session_id)) return null;

  const text = io.readFile(payload.transcript_path);
  const found = lastReturn(personTimesIn(text));
  return found === null ? null : { cwd, home, slug, text, ...found };
}

/** Whether the transcript `text` holds a Stop hook's warning carrying `marker` and naming the return `named`. */
const warnedOf = (text, named, marker) => lastLineWith(text, named, (entry) => entry.type === 'attachment'
  && entry.attachment?.type === 'hook_blocking_error'
  && entry.attachment.hookEvent === 'Stop'
  && String(entry.attachment.blockingError?.blockingError ?? '').includes(marker)) !== null;

/** The warning for a stop of `payload` whose reply closes with `state`, or `null` when none is due. The records are
 * read through `io` (`readFile`, `run`, `env`, `homedir`, and `readNotices` when the hook shares one parse of the record); one that cannot be read throws, and the hook says so.
 * `state` is not read: a return is answered with the page first, whatever the reply closes with. */
export function returnReportWarning(payload, state, io) {
  const found = leadReturnOf(payload, io);
  if (found === null) return null;
  const { cwd, home, slug, text, before, back, away } = found;
  const backMs = Date.parse(back);

  const named = `(return at ${back})`;
  if (warnedOf(text, named, RETURN_MARKER)) return null;

  const pages = pagesSince(renderedFile(home, slug), backMs, io.readFile);
  const urls = pages.size === 0 ? new Set() : publishedUrls(text, pages, backMs, cwd);
  if (linked(urls, payload.last_assistant_message, text, backMs)) return null;

  return `js-harness reply: ${RETURN_MARKER} ${(away / 3600_000).toFixed(1)} hours away (his message at ${localHour(back)}, `
    + `the one before at ${localHour(before)}, local time ${localZone(back)}) and no reply since links the status page (rule:reports-spanish-visual). `
    + 'Run `js-harness report --mark --html <file> --notes <file>`, publish the file it wrote unchanged with Artifact, '
    + `and link its URL in your reply. This is said once for this return ${named}.`;
}

/** The words only the stretch warnings of a return have. */
export const NO_STRETCH_MARKER = 'no stretch covered his absence';
export const OPEN_STRETCH_MARKER = 'the stretch of his absence is still open';

/** The stretches a stretch record's `text` holds, each `{ id, openedAt, closedAt }` (ms; `closedAt` null while open),
 * read as `js-harness stretch status` reads it (`eventsOf`). */
export function stretchRecordsIn(text) {
  const events = eventsOf(text);
  return events.filter((event) => event.event === 'open').map((open) => {
    const close = events.find((event) => event.event === 'close' && event.id === open.id);
    return { id: open.id, openedAt: Date.parse(open.at), closedAt: close ? Date.parse(close.at) : null };
  });
}

/** The stretches of the record of `slug` under `home` (`stretchRecordsIn`); a record that is there and cannot be read
 * throws. */
export function stretchesOf(home, slug, readFile) {
  let text;
  try {
    text = readFile(stretchFile(home, slug));
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw new Error(`the stretch record (${stretchFile(home, slug)}): ${err?.code ?? err?.message}`);
  }
  return stretchRecordsIn(text);
}

/** Whether one of `stretches` covers the time from `fromMs` to `toMs`: it was open at some moment of it. The return's
 * warning and the heartbeat's departure line ask this one question, so what a tick tells is what the return would
 * turn back. A stretch opened late covers too: it cannot show the departure's forecast, but the return has its measure. */
const covers = (stretches, fromMs, toMs) => stretches.some((one) => one.openedAt <= toMs && (one.closedAt === null || one.closedAt >= fromMs));

/** The stretch warning for a stop of `payload` (odd/tasks/departure-stretch.md, spec 8), or `null` when none is due:
 * the user's newest return after an absence (`lastReturn`) that no stretch covered (none open at any time between
 * his message before and his return), or whose stretch, opened before the return, is still open. Said once a return,
 * as the page's warning is, and read from the records alone, never from his words: the lead saw both absences of
 * 2026-10-31 and wrote them, and skipped the stretch (the feature document, L10). */
export function returnStretchWarning(payload, state, io) {
  const found = leadReturnOf(payload, io);
  if (found === null) return null;
  const { home, slug, text, before, back } = found;
  const named = `(return at ${back})`;
  if (warnedOf(text, named, NO_STRETCH_MARKER) || warnedOf(text, named, OPEN_STRETCH_MARKER)) return null;

  const [beforeMs, backMs] = [Date.parse(before), Date.parse(back)];
  const stretches = stretchesOf(home, slug, io.readFile);
  const open = stretches.findLast((one) => one.closedAt === null && one.openedAt < backMs);
  if (open !== undefined) {
    return `js-harness reply: he came back at ${localHour(back)} local time (${localZone(back)}) and ${OPEN_STRETCH_MARKER} (${open.id}; rule:away-autonomy). `
      + 'Close it with `js-harness stretch close --html <file>` and show its return page in your reply. '
      + `This is said once for this return ${named}.`;
  }
  if (covers(stretches, beforeMs, backMs)) return null;
  const head = `js-harness reply: he came back at ${localHour(back)} after ${localHour(before)}, local time (${localZone(back)}), and ${NO_STRETCH_MARKER} `
    + '(rule:away-autonomy), so his return has no estimate to measure against. ';
  // A session the question tool held through the absence skipped no duty: that is another failure, recorded apart.
  const held = heldIn(text, before);
  if (held !== null) {
    return `${head}The question tool held this session from ${localHour(held.since)}${held.until === null ? '' : ` to ${localHour(held.until)}`}, through the start of his absence, `
      + 'so it could open none then: tell him so in your report, '
      + `and add a \`- Seen:\` line to \`${HELD_FAILURE}\` in docs/FAILURES.md with those times. This is said once for this return ${named}.`;
  }
  return `${head}Tell him so in your report, and add a `
    + '`- Seen:` line to `stretch-not-opened` in docs/FAILURES.md with the times of his absence. '
    + `This is said once for this return ${named}.`;
}

/** The failure a held absence is recorded as (docs/FAILURES.md): the question tool, not a duty the lead skipped. */
const HELD_FAILURE = 'question-tool-holds-asker';

/** Whether a question call held the session when the absence after his message of `beforeMs` started: the call was
 * made from that message to the moment the absence starts, `ABSENCE_MS` later, and had no result at that moment
 * (`result` is when its result was written, his answer or his closing it, `null` with none yet). The return's warning
 * and the heartbeat's departure line ask this one question, as they ask `covers`, so both name the same failure for
 * one absence. A call older than his last message holds nothing, which also drops a call the host copied again
 * without its result; one made once the absence had started left the session free to open a stretch when it did. */
function heldAtStart(asked, result, beforeMs) {
  const askedMs = Date.parse(asked ?? '');
  const starts = beforeMs + ABSENCE_MS;
  return askedMs >= beforeMs && askedMs <= starts && (result === null || Date.parse(result) > starts);
}

/** The question calls of the session's own thread that the lines `written` hold, each `{ id, at }`, in file order. */
function ownQuestionCalls(written) {
  return [...questionCallsOf(parseTranscript(written.join('\n')).entries)].filter(([, call]) => !call.sidechain).map(([id, call]) => ({ id, at: call.at }));
}

/** When the result of the tool call `id` was written in `text`, as the entry's own time (`''` when it carries none,
 * which no rule reads as held), or `null` with no result there. */
function resultAtIn(text, id) {
  for (const written of linesHolding(text, [id])) {
    try {
      const entry = JSON.parse(written);
      if (entry?.type === 'user' && blocksOf(entry).some((block) => block.type === 'tool_result' && block.tool_use_id === id)) return typeof entry.timestamp === 'string' ? entry.timestamp : '';
    } catch {
      // A torn line is no result.
    }
  }
  return null;
}

/** The question that held the session when the absence after his message of `before` started (`heldAtStart`), read
 * from the transcript `text`, as `{ since, until }` (`until` null while it has no result), or `null`. Only a call made
 * in the two hours after `before` has its result looked for, so a long transcript is scanned for one or two ids. */
function heldIn(text, before) {
  const beforeMs = Date.parse(before);
  for (const call of ownQuestionCalls(personLinesIn(text))) {
    if (!heldAtStart(call.at, null, beforeMs)) continue;
    const until = resultAtIn(text, call.id);
    if (heldAtStart(call.at, until, beforeMs)) return { since: call.at, until };
  }
  return null;
}

// ---- the start of his absence (odd/tasks/departure-control.md) ---------------------------------------------------
//
// The warning above acts at his return, after the time away it is about: 16 of the 21 sightings of
// `stretch-not-opened` came after it (the Fable 5.2 audit, M9). The lead's heartbeat (bin/loop.mjs) is alive while he
// is away and its end wakes the lead, so it asks the same question at each tick and tells the lead when the absence
// starts. What counts as an absence does not change: his messages by `quoteOf`'s rule, a gap longer than
// `ABSENCE_MS`, and the cover test of the return (`covers`).
//
// What it cannot do is said, not hidden. The question tool holds the session that calls it until he answers, and the
// host delivers a loop's end only then: of the 23 absences no stretch covered from 2026-10-31 to 2026-11-10, a
// question held the lead until his return in 9. The line then says since when, so the sighting can.

/** The word the heartbeat's departure line opens with. */
export const AWAY_MARKER = 'AWAY:';

/** A watch of his absence for a process that reads the lead's transcript piece by piece. `add(text)` takes the whole
 * lines a tick read and keeps those that can hold his words or a question call (`personLinesIn`); `read(stretches,
 * now)` gives the absence in course at `now` (ms) that none of `stretches` (`stretchesOf`) covers, as `{ before, away,
 * heldSince }`, or `null`: `before` is when he last wrote, `away` the ms since, and `heldSince` when the session
 * made the question call that held it when the absence started (`heldAtStart`, the return's rule), else `null`.
 * Only the calls made since his last message are kept, and only they have their result looked for in each piece: a
 * call older than his last message can hold no absence, since his last message only moves forward. */
export function departureWatch() {
  const kept = [];
  let times = [];
  let calls = [];
  return {
    add(text) {
      const lines = personLinesIn(text);
      if (lines.length > 0) {
        kept.push(...lines);
        times = personTimesOf(parseTranscript(kept.join('\n')).entries);
        calls.push(...ownQuestionCalls(lines).map((call) => ({ ...call, result: null })));
      }
      const beforeMs = Date.parse(times.at(-1) ?? '');
      calls = calls.filter((call) => !(Date.parse(call.at ?? '') < beforeMs));
      for (const call of calls) call.result ??= resultAtIn(text, call.id);
    },
    read(stretches, now) {
      const before = times.at(-1);
      if (before === undefined) return null;
      const beforeMs = Date.parse(before);
      const away = now - beforeMs;
      if (!(away > ABSENCE_MS) || covers(stretches, beforeMs, now)) return null;
      const held = calls.find((call) => heldAtStart(call.at, call.result, beforeMs));
      return { before, away, heldSince: held?.at ?? null };
    },
  };
}

/** The line the heartbeat ends with for the absence `departureWatch` found: when he last wrote, in local time, and
 * the command that opens the stretch; or, where the question tool held the session when the absence started, since
 * when, and what the sighting must say: a held session could open none and reads this only once the tool returned,
 * so a stretch is asked for only where he is still away then. */
export function departureLine({ before, away, heldSince }) {
  const head = `${AWAY_MARKER} the user last wrote to this session at ${localHour(before)}, local time (${localZone(before)}), ${(away / 3600_000).toFixed(1)} hours ago, `
    + 'and no stretch covers the time since (rule:away-autonomy)';
  if (heldSince !== null) {
    return `${head}. The question tool held this session from ${localHour(heldSince)}, through the start of this absence, so it could open none then and this line reaches you only once the tool returned: `
      + `record it as a \`- Seen:\` line of \`${HELD_FAILURE}\` in docs/FAILURES.md, as the reply hook asks at their return, `
      + 'and where they are still away, open a stretch now, `js-harness stretch open --plan <file> --html <file>`. Told once for this absence.';
  }
  return `${head}: open one now for the hours left, \`js-harness stretch open --plan <file> --html <file>\`, so their return has an estimate to measure against. `
    + 'Told once for this absence.';
}
