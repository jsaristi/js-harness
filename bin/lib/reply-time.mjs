// The UTC-time check of a reply, the control of rule:local-time (odd/tasks/local-time.md, spec 2): a reply that gives
// the user a clock time in UTC in its prose is turned back once by the reply Stop hook, with each time and what it is
// in local time, so the session writes them again in its next words. The records keep UTC, and a record shown as a
// record keeps it too: a time in a fenced block, in inline code (over two lines or not), on a quoted line (`>`) or
// inside a path or a URL is not read, while the label of a Markdown link is prose and is. What it cannot see: a UTC
// time written with no `Z` and no "UTC" reads as local and passes. Pure: the hook hands it the reply's text and the
// time it runs at.
import { fencedBlocks } from './reply.mjs';
import { localHour, localMinute, localZone } from './local-time.mjs';

// A clock time in UTC: `H:MM` or `HH:MM`, with seconds and a fraction or not, after a date or not, then `Z` or "UTC".
// An offset such as `UTC-05:00` names a zone and is no time, so "UTC" followed by a sign does not count.
const UTC_TIME = /(?<![\w:.])(?:(\d{4}-\d{2}-\d{2})[T ])?(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|\s?UTC)(?![\w+\-−])/g;
// A code span may run over lines, never over a blank line, which ends its paragraph.
const CODE_SPAN = /(`+)(?:(?!\n[ \t]*\n)[\s\S])*?\1/g;
const LINK = /\[([^\]\n]*)\]\([^)\s]*\)/g;
const PATH_OR_URL = /\S*[\\/]\S*/g;
const QUOTED = /^\s*>/;

/** The UTC clock times in the prose of the reply `text`, in order, each as `{ text, line, date, hour, minute }`: `line`
 * counts from 1, and `date` is `YYYY-MM-DD` where the time carries one, else `null`. */
export function utcTimesIn(text) {
  const raw = String(text ?? '').split(/\r?\n/);
  const fenced = new Set();
  for (const block of fencedBlocks(text)) for (let i = block.start; i <= block.end; i += 1) fenced.add(i);
  // Fenced lines go blank before the code spans are found, so a fence's backticks open none; a span keeps its line
  // breaks, so every line keeps its number.
  const lines = raw.map((line, i) => (fenced.has(i) ? '' : line)).join('\n').replace(CODE_SPAN, (span) => span.replace(/[^\n]/g, ' ')).split('\n');
  const found = [];
  lines.forEach((line, i) => {
    if (QUOTED.test(raw[i])) return;
    const prose = line.replace(LINK, ' $1 ').replace(PATH_OR_URL, ' ');
    for (const match of prose.matchAll(UTC_TIME)) {
      found.push({ text: match[0], line: i + 1, date: match[1] ?? null, hour: match[2].padStart(2, '0'), minute: match[3] });
    }
  });
  return found;
}

/** The instant one UTC time names: on its own date, or on the UTC day of `now` where it carries none. */
const instantOf = ({ date, hour, minute }, now) => Date.parse(`${date ?? new Date(now).toISOString().slice(0, 10)}T${hour}:${minute}:00Z`);

/** The Stop hook's warning for the reply `text` read at `now` (milliseconds), or `null` when it gives no UTC time. Each
 * time is given in local time, the local minute where it carries a date, the hour where it does not, with the zone of
 * its own instant: said once where all share it, with each time where a clock change lies between them. */
export function utcTimeWarning(text, { now }) {
  const times = utcTimesIn(text).map((one) => ({ ...one, at: instantOf(one, now) }));
  if (times.length === 0) return null;
  const zones = new Set(times.map((one) => localZone(one.at)));
  const local = (one) => `${one.date === null ? localHour(one.at) : localMinute(one.at)}${zones.size > 1 ? ` ${localZone(one.at)}` : ''}`;
  const said = times.map((one) => `"${one.text}" (line ${one.line}) is ${local(one)}`).join(', ');
  return `js-harness reply: the reply gives a UTC clock time outside a code block, a quoted output or a path: ${said}${zones.size === 1 ? `, local time ${[...zones][0]}` : ''}. `
    + 'The user reads their local time (rule:local-time). Your reply is already shown: give those times again in local time, the zone said once, '
    + 'in your next words; a record\'s UTC stamp shown as it is goes in a code span.';
}
