// The hour a session writes into a Markdown file as the time of writing, checked against the clock by the guard's
// `PreToolUse` hook on Write and Edit (odd/tasks/session-channel.md, T12b; failure `hours-guessed`). The message guard
// (bin/lib/guard.mjs, `hourRefusal`) holds a message's stamp to the clock; this holds a document's. A document also
// records hours of earlier events, so only an hour ahead of the clock is refused: a record of what happened cannot be
// later than its writing, and the guessed hours ran ahead (2026-10-14: "about 05:40" written at 05:15).

// A stamp is today's date followed by an hour, either where a line opens (after list, quote, heading or bold marks)
// or after "written". "The wait ends at 2026-10-14 16:00" names a plan and is not one.
const STAMPS = [
  /^[\s>#*-]*(20\d\d-\d\d-\d\d)(?:,\s*|\s+)(?:(?:at|about|~)\s*)?((?:[01]?\d|2[0-3]):[0-5]\d)(?!\d)/,
  /\bwritten(?:\s+(?:at|on))?\s+(20\d\d-\d\d-\d\d)(?:,\s*|\s+)(?:(?:at|about|~)\s*)?((?:[01]?\d|2[0-3]):[0-5]\d)(?!\d)/i,
];

const pad = (n) => String(n).padStart(2, '0');

/** The text a Write or an Edit brings to the file: what it writes, or the replacement it puts in. */
function broughtText(toolName, toolInput) {
  const text = toolName === 'Write' ? toolInput?.content : toolInput?.new_string;
  return typeof text === 'string' ? text : null;
}

/** Why the Write or Edit `toolName` with `toolInput` is refused at the local time `now`, or null: a line of the text
 * it brings to a Markdown file stamps today's date with an hour more than a minute ahead of the clock. */
export function documentHourRefusal(toolName, toolInput, now) {
  if (!/\.md$/i.test(String(toolInput?.file_path ?? ''))) return null;
  const text = broughtText(toolName, toolInput);
  if (text === null) return null;
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const clock = now.getHours() * 60 + now.getMinutes();
  const lines = text.split(/\r?\n/);
  for (let at = 0; at < lines.length; at += 1) {
    for (const stamp of STAMPS) {
      const match = stamp.exec(lines[at]);
      if (match === null || match[1] !== today) continue;
      const [hours, minutes] = match[2].split(':').map(Number);
      // Minute against minute, as the message guard: 14:45 is right at 14:44:30.
      if (hours * 60 + minutes - clock <= 1) continue;
      const right = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      return `js-harness guard: line ${at + 1} of the text this call writes stamps ${today} ${pad(hours)}:${pad(minutes)}, and the clock says ${right}. `
        + `Write ${right}, or no hour: an hour written as the time of writing is read from the clock in the same step, `
        + 'or left out; an hour still to come is written as a plan ("planned for", "ends at").';
    }
  }
  return null;
}
