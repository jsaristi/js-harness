// The UTC-time check of a reply, the control of rule:local-time (odd/tasks/local-time.md, spec 2): a reply that gives
// the user a clock time in UTC in its prose is turned back once by the reply Stop hook, with each time and what it is
// in local time, so the session writes them again in its next words. The records keep UTC, and a record shown as a
// record keeps it too: a time in a fenced block, in inline code, on a quoted line (`>`) or inside a path or a URL is
// not read. What it cannot see: a UTC time written with no `Z` and no "UTC" reads as local and passes. Pure: the hook
// hands it the reply's text and the time it runs at.
import { fencedBlocks } from './reply.mjs';
import { localHour, localMinute, localZone } from './local-time.mjs';

// A clock time in UTC: `HH:MM`, with seconds and a fraction or not, after a date or not, then `Z` or "UTC". An offset
// such as `UTC-05:00` names a zone and is no time, so "UTC" followed by a sign does not count.
const UTC_TIME = /(?<![\w:.])(?:(\d{4}-\d{2}-\d{2})[T ])?(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|\s?UTC)(?![\w+\-−])/g;
const CODE_SPAN = /(`+)[\s\S]*?\1/g;
const PATH_OR_URL = /\S*[\\/]\S*/g;
const QUOTED = /^\s*>/;

/** The UTC clock times in the prose of the reply `text`, in order, each as `{ text, line, date, hour, minute }`: `line`
 * counts from 1, and `date` is `YYYY-MM-DD` where the time carries one, else `null`. */
export function utcTimesIn(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const fenced = new Set();
  for (const block of fencedBlocks(text)) for (let i = block.start; i <= block.end; i += 1) fenced.add(i);
  const found = [];
  lines.forEach((raw, i) => {
    if (fenced.has(i) || QUOTED.test(raw)) return;
    const prose = raw.replace(CODE_SPAN, ' ').replace(PATH_OR_URL, ' ');
    for (const match of prose.matchAll(UTC_TIME)) {
      found.push({ text: match[0], line: i + 1, date: match[1] ?? null, hour: match[2], minute: match[3] });
    }
  });
  return found;
}

/** What one UTC time is in local time: the local minute where it carries a date, the local hour where it does not. */
function localOf({ date, hour, minute }, now) {
  const day = date ?? new Date(now).toISOString().slice(0, 10);
  const at = Date.parse(`${day}T${hour}:${minute}:00Z`);
  return date === null ? localHour(at) : localMinute(at);
}

/** The Stop hook's warning for the reply `text` read at `now` (milliseconds), or `null` when it gives no UTC time. */
export function utcTimeWarning(text, { now }) {
  const times = utcTimesIn(text);
  if (times.length === 0) return null;
  const said = times.map((one) => `"${one.text}" (line ${one.line}) is ${localOf(one, now)}`).join(', ');
  return `js-harness reply: the reply gives a UTC clock time outside a code block, a quoted output or a path: ${said}, local time ${localZone(now)}. `
    + 'The user reads their local time (rule:local-time). Your reply is already shown: give those times again in local time, the zone said once, '
    + 'in your next words; a record\'s UTC stamp shown as it is goes in a code span.';
}
