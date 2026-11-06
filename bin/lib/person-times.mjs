// When the person wrote in a transcript, read fast enough for a Stop hook (odd/tasks/lead-duty-checks.md, spec 2).
// Whose words an entry is stays `quoteOf`'s one rule (`quoteEntry` in bin/lib/sessions.mjs, with the question calls it
// pairs an answer with): this module only reads fewer lines. A lead's transcript runs to tens of megabytes and the
// reply hook has a few seconds for every check: the 38,419 lines of the lead's 0f71b2c6 (59 MB, 2026-10-31) took
// 0.77 s to parse whole, and the lines that can hold his words, 0.24 s.

import { parseTranscript, QUESTION_TOOLS, questionCallsOf, quoteEntry } from './sessions.mjs';

/** Every time the person wrote in `entries` (parsed transcript lines), by `quoteOf`'s rule, oldest first: a typed
 * message, a queued one and a tapped answer count, an entry with no time does not. */
export function personTimesOf(entries) {
  const questionCalls = questionCallsOf(entries);
  const times = [];
  for (const entry of entries) {
    const quote = quoteEntry(entry, questionCalls);
    if (quote.person && typeof quote.at === 'string') times.push(quote.at);
  }
  return times.sort();
}

/** `personTimesOf` for a transcript's `text`, parsing only the lines that can hold the person's words or a question
 * call: his entries carry the origin `"human"`, his answers `"answers"`, and the calls they answer the tool's name. */
export function personTimesIn(text) {
  const marks = ['"human"', '"answers"', ...QUESTION_TOOLS.map((tool) => `"${tool}"`)];
  return personTimesOf(parseTranscript(linesHolding(text, marks).join('\n')).entries);
}

// What the host writes of its own requests: a copy of the whole prompt, which names every tool and holds any word, and
// never an entry of the person or of the session. In the lead's 0f71b2c6, 41 such lines of 9 MB held the marks above.
const HOST_RECORDS = ['"type":"api-request-shape"', '"type":"prompt_snapshot"'];
const HEAD = 256;

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The lines of a transcript's `text` that hold one of `marks`, in file order and each once, found by searching the
 * text rather than splitting it, and none of the host's records of its own requests (`HOST_RECORDS`, read in a line's
 * first characters). One pass finds every mark: in the lead's 60 MB transcript, 46 ms for the three of
 * `personTimesIn`, against 121 ms for a pass a mark (odd/tasks/reply-hook-latency.md). */
export function linesHolding(text, marks) {
  if (marks.length === 0) return [];
  const starts = new Set();
  const any = new RegExp(marks.map(escaped).join('|'), 'g');
  for (let found = any.exec(text); found !== null; found = any.exec(text)) {
    starts.add(text.lastIndexOf('\n', found.index) + 1);
    // The rest of the line holds nothing more to find: the line is kept once.
    const end = text.indexOf('\n', found.index);
    if (end < 0) break;
    any.lastIndex = end + 1;
  }
  const lines = [];
  for (const start of [...starts].sort((a, b) => a - b)) {
    const found = text.indexOf('\n', start);
    const end = found < 0 ? text.length : found;
    // The head is the line's own: a short line's next line is no part of it.
    const head = text.slice(start, Math.min(end, start + HEAD));
    if (HOST_RECORDS.some((record) => head.includes(record))) continue;
    lines.push(text.slice(start, end));
  }
  return lines;
}
