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
import { linesHolding, personTimesIn } from './person-times.mjs';
import { comparable, mainCheckout, projectSlug } from './sessions.mjs';
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
const hhmm = (iso) => new Date(iso).toISOString().slice(11, 16);

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

/** The warning for a stop of `payload` whose reply closes with `state`, or `null` when none is due. The records are
 * read through `io` (`readFile`, `run`, `env`, `homedir`, and `readNotices` when the hook shares one parse of the record); one that cannot be read throws, and the hook says so.
 * `state` is not read: a return is answered with the page first, whatever the reply closes with. */
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

  return `js-harness reply: ${RETURN_MARKER} ${(away / 3600_000).toFixed(1)} hours away (his message at ${hhmm(back)} UTC, `
    + `the one before at ${hhmm(before)} UTC) and no reply since links the status page (rule:reports-spanish-visual). `
    + 'Run `js-harness report --mark --html <file> --notes <file>`, publish the file it wrote unchanged with Artifact, '
    + `and link its URL in your reply. This is said once for this return ${named}.`;
}

/** The words only the stretch warnings of a return have. */
export const NO_STRETCH_MARKER = 'no stretch covered his absence';
export const OPEN_STRETCH_MARKER = 'the stretch of his absence is still open';

/** The stretches of the record of `slug` under `home`, each `{ id, openedAt, closedAt }` (ms; `closedAt` null while
 * open), read as `js-harness stretch status` reads it (`eventsOf`); a record that is there and cannot be read throws. */
function stretchesOf(home, slug, readFile) {
  let text;
  try {
    text = readFile(stretchFile(home, slug));
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw new Error(`the stretch record (${stretchFile(home, slug)}): ${err?.code ?? err?.message}`);
  }
  const events = eventsOf(text);
  return events.filter((event) => event.event === 'open').map((open) => {
    const close = events.find((event) => event.event === 'close' && event.id === open.id);
    return { id: open.id, openedAt: Date.parse(open.at), closedAt: close ? Date.parse(close.at) : null };
  });
}

/** The stretch warning for a stop of `payload` (odd/tasks/departure-stretch.md, spec 1b), or `null` when none is due:
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
    return `js-harness reply: he came back at ${hhmm(back)} UTC and ${OPEN_STRETCH_MARKER} (${open.id}; rule:away-autonomy). `
      + 'Close it with `js-harness stretch close --html <file>` and show its return page in your reply. '
      + `This is said once for this return ${named}.`;
  }
  if (stretches.some((one) => one.openedAt <= backMs && (one.closedAt === null || one.closedAt >= beforeMs))) return null;
  return `js-harness reply: he came back at ${hhmm(back)} UTC after ${hhmm(before)} UTC and ${NO_STRETCH_MARKER} `
    + '(rule:away-autonomy), so his return has no estimate to measure against. Tell him so in your report, and add a '
    + '`- Seen:` line to `stretch-not-opened` in docs/FAILURES.md with the times of his absence. '
    + `This is said once for this return ${named}.`;
}
