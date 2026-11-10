// What a boot left behind, read from the transcripts of the project's sessions: which sessions were open before
// it, what each must read to resume, and which of its background waits the boot killed (`js-harness wake`).
//
// Why. On 2026-10-14 the machine restarted at 23:52, and the lead woke seven sessions by hand, one by one; each
// re-armed its own waits from memory. A boot kills every background command of every session and the
// transcripts do not say so: a wait the boot killed still reads as running. No command can put a prompt into
// an idle session (only the app's `send_message`, a tool of an agent, does), so what this plans is the notes
// that say it, which the inbox hook tells each session on its next tool call, and the list the orchestrator
// wakes them from.

import { NOTICE_TEXT_MAX } from './channel.mjs';
import { parseTranscript, roleOfTitle, sessionFacts, titleRead } from './sessions.mjs';

/** How long before a boot a session's last entry may be for it to count as open then: the board's default
 * window (`sessions --hours`), the sessions a person would still call open. */
export const WAKE_WINDOW_MS = 12 * 60 * 60 * 1000;

// `js-harness wait`, as a session types it or runs it from a checkout: the command name or the dispatcher
// followed by `wait`, or `wait.mjs` itself. `gate --wait` and a word that only starts with `wait` are not one.
const WAIT_COMMAND = /(?:^|[\s/\\"'&;|(])(?:js-harness(?:\.mjs)?["']?\s+wait(?=\s|$)|wait\.mjs["']?(?=\s|$))/;

/** Whether the command line `command` runs `js-harness wait`, the declared wait of this harness. */
export function isWaitCommand(command) {
  return typeof command === 'string' && WAIT_COMMAND.test(command);
}

/** The steps of the shell command `command`, in order, each `{ step }` as it was typed and trimmed, with `{ open }`
 * and `{ close }` where a group's parentheses start and end: split at `&&`, `||`, `;`, `|`, `&` and a line break,
 * never inside quotes or a `$(...)`, and not at the `&` of a redirection (`2>&1`, `&>`). The guard's `shellWords`
 * gives a step's words with their quotes taken off; a step handed back to be run again has to keep them. */
function stepsOf(command) {
  const steps = [];
  let from = 0;
  let quote = null;
  let depth = 0;
  const cut = (at, width, mark = null) => {
    const step = command.slice(from, at).trim();
    if (step !== '') steps.push({ step });
    if (mark !== null) steps.push({ [mark]: true });
    from = at + width;
  };
  for (let i = 0; i < command.length; i += 1) {
    const c = command[i];
    if (quote !== null) {
      if (quote === '"' && c === '\\') i += 1;
      else if (c === quote) quote = null;
    } else if (c === '\\') i += 1;
    else if (c === '"' || c === "'") quote = c;
    else if (c === '$' && command[i + 1] === '(') {
      depth += 1;
      i += 1;
    } else if (depth > 0) {
      if (c === ')') depth -= 1;
    } else if ((c === '&' || c === '|') && command[i + 1] === c) cut(i++, 2);
    else if (c === '&' && (command[i - 1] === '>' || command[i - 1] === '<' || command[i + 1] === '>')) continue;
    else if (c === '(' || c === ')') cut(i, 1, c === '(' ? 'open' : 'close');
    else if (c === ';' || c === '|' || c === '&' || c === '\n' || c === '\r') cut(i, 1);
  }
  cut(command.length, 0);
  return steps;
}

// The words a shell puts before a command it runs on a condition or in a group: a step that begins with one is that
// command, handed back without it.
// A step that runs the wait itself: the dispatcher and its `wait`, or wait.mjs, each as typed or through node, and
// not a command that only names it in an argument (Codex, on adf0e80: `js-harness install "wait"` is no wait).
const RUNS_WAIT = /^(?:["']?(?:[^\s"']*[\\/])?node(?:\.exe)?["']?\s+)?["']?(?:[^\s"']*[\\/])?(?:js-harness(?:\.mjs|\.cmd)?["']?\s+wait|wait\.mjs["']?)(?:\s|$)/i;
const LEADING_KEYWORD = /^(?:(?:then|do|else|elif|if|while|until|!|\{)\s+)+/;
// What may run a command for it and leave it the same command: an environment assignment, `env`, `nohup`, `time`,
// `command`, `exec` and `timeout` with its options and duration. The step is handed back with them; the program
// after them is the one RUNS_WAIT reads (the reliability lens, on 7e2b1cb: a prefixed wait was dropped).
const RUN_PREFIX = /^(?:(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)|env|nohup|time|command|exec|timeout(?:\s+-\w+(?:\s+\d\S*)?)*\s+\d\S*)\s+)+/;

/** The commands that re-arm the `js-harness wait` calls of the command line `command`, one for each, in order: the
 * wait step, without a keyword before it, after the `cd` steps that move it, joined by `&&` so it runs only in that
 * folder. A `cd` inside a group moves only what is in that group. `[]` when no step is a wait (the words were only
 * quoted). A chained line was handed back whole, so a push before its wait would have run again after a boot (audit
 * M31, 2026-11-09); two waits are two commands, since one joined to the other would wait for it (Codex, on 643d57d). */
export function waitPartsOf(command) {
  const parts = [];
  const frames = [[]];
  for (const { step, open, close } of stepsOf(command)) {
    if (open) frames.push([]);
    else if (close) {
      if (frames.length > 1) frames.pop();
    } else {
      const bare = step.replace(LEADING_KEYWORD, '');
      if (/^cd(\s|$)/.test(bare)) frames.at(-1).push(bare);
      else if (RUNS_WAIT.test(bare.replace(RUN_PREFIX, ''))) parts.push([...frames.flat(), bare].join(' && '));
    }
  }
  return parts;
}

const timeOf = (iso) => (typeof iso === 'string' ? Date.parse(iso) : NaN);

/** What the transcript `text` says for a plan: the newest time an entry was written at or before `bootMs`
 * (`lastAt`, `null` when none was), and the command line of each Bash call by its tool_use id (`commands`),
 * which the work of `sessionFacts` names by `toolUseId` and does not carry. */
function readTranscript(text, bootMs) {
  let lastAt = null;
  const commands = new Map();
  for (const entry of parseTranscript(text).entries) {
    const ms = timeOf(entry.timestamp);
    if (Number.isFinite(ms) && ms <= bootMs && (lastAt === null || ms > lastAt)) lastAt = ms;
    const content = entry.type === 'assistant' ? entry.message?.content : null;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === 'tool_use' && block.name === 'Bash' && typeof block.input?.command === 'string' && !commands.has(block.id)) commands.set(block.id, block.input.command);
    }
  }
  return { lastAt, commands };
}

/** The sessions a boot at `bootAt` (ISO) found open, from `transcripts` (`[{ id, text }]`): those with an
 * entry in the `windowMs` before it. Each is `{ id, title, role, opening, waits, killed, lastAt }`:
 *
 * - `title` is the transcript's own title, else the one of the opening it read last (`readings`, the
 *   record's readings), else `null`; `role` is `{ role, number }` by `roleOfTitle`, or `null`, and is what a
 *   note is addressed to.
 * - `opening` is what `openingOf(title)` gives: the command that prints its stored opening, or `null`.
 * - `waits` are the command lines of its background `js-harness wait` calls that were launched before the
 *   boot and had not ended by then: the waits the boot killed, which the session re-arms. `killed` counts
 *   its other background work the boot killed, which is not re-armed by a note: it is no declared wait.
 *
 * Sessions come in the order of their last entry before the boot, the newest first. Transcripts of one title are
 * one session (a clear or a restart starts a new transcript): only the newest is planned. */
export function wakePlan({ bootAt, transcripts, readings = [], openingOf = () => null, windowMs = WAKE_WINDOW_MS }) {
  const bootMs = timeOf(bootAt);
  if (!Number.isFinite(bootMs)) throw new Error(`the boot time is no time: ${bootAt}`);
  const plan = [];
  for (const { id, text } of transcripts) {
    const { lastAt, commands } = readTranscript(text, bootMs);
    if (lastAt === null || lastAt < bootMs - windowMs) continue;
    const facts = sessionFacts(text);
    const title = facts.titleSource === 'custom-title' ? facts.title : titleRead(readings, id);
    const shaped = roleOfTitle(title);
    const killedByBoot = facts.work.filter((work) => {
      const launched = timeOf(work.launchedAt);
      if (!(Number.isFinite(launched) && launched <= bootMs) || work.mode !== 'background') return false;
      return !work.ended || !(timeOf(work.endedAt) <= bootMs);
    });
    const lines = killedByBoot.map((work) => (work.tool === 'Bash' ? commands.get(work.toolUseId) : undefined)).filter(isWaitCommand);
    // A line read as a wait with no step to re-arm (one run inside `bash -c "..."`) stays killed work, so the
    // note never says no wait ran when one did.
    const parts = lines.map(waitPartsOf);
    const waits = parts.flat();
    plan.push({
      id,
      title,
      role: shaped === null ? null : { role: shaped.role, number: shaped.number },
      opening: title === null ? null : openingOf(title),
      waits,
      killed: killedByBoot.length - parts.filter((part) => part.length > 0).length,
      lastAt: new Date(lastAt).toISOString(),
    });
  }
  // A clear or a restart leaves an older transcript under the same title: one session, planned once, by its newest
  // transcript, so the older one's waits, dead before the boot, are not re-armed (harness review c1).
  const seen = new Set();
  return plan.sort((a, b) => timeOf(b.lastAt) - timeOf(a.lastAt)).filter((one) => {
    if (one.title === null) return true;
    if (seen.has(one.title)) return false;
    seen.add(one.title);
    return true;
  });
}

/** A command line as one line: a notice holds no line break (`newNotice`), and the shell runs a command
 * written on several lines as its lines joined by `;`, so that is how they are told. */
function oneLineCommand(command) {
  return command.split(/[\r\n]+/).map((line) => line.trim()).filter((line) => line !== '').join(' ; ');
}

/** The note a session of the plan is left (`wakePlan`): the boot, that its background waits and tasks are
 * gone, what to read to resume, and the declared waits to re-arm, as many as fit a notice, then how many
 * were left out. */
export function wakeText({ opening, waits }, bootAt) {
  const head = `The machine booted at ${bootAt}: the background waits and tasks of this session are gone. `;
  const read = opening === null ? 'It has no stored opening: resume from its feature document. ' : `Read your opening: ${opening}. `;
  if (waits.length === 0) return `${head}${read}No declared wait was running: re-arm none.`;
  const lead = `${head}${read}Then re-arm only these declared waits: `;
  for (let count = waits.length; count >= 0; count--) {
    const shown = waits.slice(0, count).map((wait, index) => `${index + 1}) ${oneLineCommand(wait)}`).join(' ');
    const rest = waits.length - count;
    const text = `${lead}${shown}${rest === 0 ? '' : `${count === 0 ? '' : ' '}and ${rest} more: js-harness wake lists them.`}`;
    if (text.length <= NOTICE_TEXT_MAX) return text;
  }
  // Only an opening command too long for a notice gets here: the count alone, cut to fit.
  return `${head}${read}`.slice(0, NOTICE_TEXT_MAX);
}
