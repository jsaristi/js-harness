// What `js-harness guard --hook` decides before a tool call runs (odd/tasks/honesty-audit.md, T13 and T14). It is
// a `PreToolUse` hook, so it answers the host with the hooks contract's JSON on standard output and always exits 0:
// an older js-harness on the path answers 2 to a command it does not know, and 2 blocks the host, so every hook
// entry ends in `|| exit 0` (bin/lib/manifest.mjs), and a refusal by exit code would be swallowed. Zero deps.
import { ruleHere, ruleOf } from './rules.mjs';

/** The models a sub-agent may be launched on in the project whose rules file has the text `projectData`, as
 * `[{ alias, id, rule }]`, writer first; or null when the rules are not in force there (no rules file, or a copy of
 * the harness whose list is not the project's), and then no model is refused. The two model rules are read with
 * `ruleHere`, by their ids written out so that `rules check` lists this file as their reader, because both are of
 * this repository only: a project that installs the harness turns nothing on by default (his answer of 2026-10-14,
 * odd/tasks/honesty-audit.md S5). */
export function allowedModels(projectData) {
  const writer = ruleHere('subagent-writer-model', undefined, projectData);
  const reader = ruleHere('subagent-reader-model', undefined, projectData);
  if (!Object.hasOwn(writer, 'value') || !Object.hasOwn(reader, 'value')) return null;
  return [
    { alias: ruleOf('subagent-writer-model').alias, id: writer.value, rule: 'subagent-writer-model' },
    { alias: ruleOf('subagent-reader-model').alias, id: reader.value, rule: 'subagent-reader-model' },
  ];
}

/** Why the `Agent` call whose input is `toolInput` is refused, or null when it is not. A call with no `model`
 * passes: it runs on the parent's model, or on the one its agent type declares, which the rules leave out
 * (odd/tasks/rule-hierarchy.md, "the agent types that set their own model"). One that names a model passes when it
 * is a rule's alias or its id; any other is refused, `fable` too: his words allow Fable 5.5, and the alias is not
 * known to give it. Effort is never refused here: it is reported after the fact (`check`, an INFO row). */
export function modelRefusal(toolInput, allowed) {
  const model = toolInput?.model;
  if (allowed === null || model === undefined || model === null || model === '') return null;
  if (allowed.some(({ alias, id }) => model === alias || model === id)) return null;
  const rules = allowed.map(({ rule, alias, id }) => `${rule} gives "${alias}" (${id})`).join(', and ');
  return `js-harness guard: the model "${model}" is not one a sub-agent may run on here: ${rules}. `
    + 'Launch it on one of those, or with no model to run on the parent\'s.';
}

// The hour a message stamps as the time it is sent: in its opening header, after nothing but the sender's label
// and an optional date, and followed by a stamp word or a stop. The label is "From <someone>" or a session's
// title as the harness names sessions, a short code and a number with an optional topic ("JH 5 · canal, ",
// "JH 7 at "), so "JH 11 paused at 01:10" is an event and not a stamp. Only the position tells a stamp from any
// other hour: an event's hour also says "local" or "by date". Measured over 877 messages of three days
// (odd/tasks/honesty-audit.md, Log): 221 matches, 49 of them wrong, none an hour meant as anything but the time of
// sending.
const STAMP = /^(?:From\b[^.:\n]{0,90}?[,(]\s*|[A-Z][A-Za-z]{0,3} ?\d{1,3}(?: ·[^,\n]{0,40})?(?:,| at)\s+)(?:20\d\d-\d\d-\d\d\s+)?((?:[01]?\d|2[0-3]):[0-5]\d)(?::[0-5]\d)?(?=\s*(?:local\b|\(?(?:by|por|read from)\s+(?:a\s+)?`?date`?|by (?:the|my) clock|\(date\)|[.:),]))/;

const pad = (n) => String(n).padStart(2, '0');

/** The `HH:MM` that `text` stamps as the time it is sent, or null when its opening carries none. */
export function stampedHour(text) {
  const match = STAMP.exec(String(text ?? ''));
  if (match === null) return null;
  const [hours, minutes] = match[1].split(':').map(Number);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** Why a message whose text is `text` is refused at the local time `now`, or null when it is not: its stamped hour
 * is more than a minute from the clock's, either way, the short way round midnight. Hours the sessions guessed ran
 * ahead of the clock by 2 to 26 minutes, "by date" or not; the refusal gives the right hour. */
export function hourRefusal(text, now) {
  const stamped = stampedHour(text);
  if (stamped === null) return null;
  const [hours, minutes] = stamped.split(':').map(Number);
  // Minute against minute: a stamp names a minute, and 14:43 is right at 14:44:30.
  const apart = Math.abs(hours * 60 + minutes - (now.getHours() * 60 + now.getMinutes())) % 1440;
  if (Math.min(apart, 1440 - apart) <= 1) return null;
  const right = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `js-harness guard: this message stamps ${stamped}, and the clock says ${right}. `
    + `Stamp ${right}, or no hour: an hour in a message is read from the clock in the same step, or left out.`;
}

const HEREDOC = /^<<-?\s*(?:'([^'\n]+)'|"([^"\n]+)"|\\?([A-Za-z_][A-Za-z0-9_]*))/;

/** The spans between backticks inside the double-quoted strings of the shell command `command`: bash runs each as
 * a command and puts its output in the string, so a commit message written "the `check` row" runs `check` (his
 * answer of 2026-10-14, odd/tasks/honesty-audit.md S7; over 7,061 Bash commands it finds one, real). A small walk
 * of the shell's quoting, as a stack of contexts: single quotes are literal; a backslash escapes the next character
 * outside them; a `$(` inside double quotes starts a context of its own, where quotes count again until its `)`; a
 * heredoc's body is left out whatever its delimiter, at the top or inside such a `$(` (one quoted is literal, and one
 * that is not is a different risk, not this check's); a comment is left out to the end of its line. Backticks outside double quotes and `$(...)` are not looked at: they are written as
 * substitution on purpose. */
export function backticksInDoubleQuotes(command) {
  const text = String(command ?? '');
  const spans = [];
  // A context that is no string (`out`, the command itself, or `sub`, a `$(...)` of a double-quoted string) keeps the
  // heredoc delimiters whose bodies start at its next line: each context skips only its own.
  const stack = [{ kind: 'out', depth: 0, pending: [] }];
  let span = null;
  let wordStart = true; // the last character was an unescaped separator outside strings, so a `#` starts a comment
  const top = () => stack[stack.length - 1];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const here = top();
    const atWordStart = wordStart;
    wordStart = false;
    if (here.kind === 'single') {
      if (c === "'") stack.pop();
      continue;
    }
    if (c === '\\') {
      // A backslash-newline is removed by bash and leaves the word boundary as it was.
      if (text[i + 1] === '\n') wordStart = atWordStart;
      i++;
      continue;
    }
    if (here.kind === 'double') {
      if (c === '`') {
        if (span === null) span = '';
        else { spans.push(span); span = null; }
        continue;
      }
      if (span !== null) { span += c; continue; }
      if (c === '"') stack.pop();
      else if (c === '$' && text[i + 1] === '(') { stack.push({ kind: 'sub', depth: 0, pending: [] }); i++; wordStart = true; }
      continue;
    }
    // `out` or `sub`: quotes open contexts.
    if (c === "'") stack.push({ kind: 'single' });
    else if (c === '"') stack.push({ kind: 'double' });
    else if (c === '#' && atWordStart) {
      // A comment runs to the end of its line, and its quotes are no quotes (`$#`, `a#b` and `a\ #` are no comment).
      const end = text.indexOf('\n', i);
      i = (end === -1 ? text.length : end) - 1;
      wordStart = true;
    } else if (here.kind === 'sub' && c === '(') here.depth += 1;
    else if (here.kind === 'sub' && c === ')') {
      if (here.depth === 0) stack.pop();
      else here.depth -= 1;
    } else if (c === '<' && text[i + 1] === '<' && text[i + 2] !== '<') {
      const match = HEREDOC.exec(text.slice(i));
      if (match) {
        here.pending.push(match[1] ?? match[2] ?? match[3]);
        i += match[0].length - 1;
      }
    } else if (c === '\n' && here.pending.length > 0) {
      // Skip each pending heredoc's body: the lines up to one that is the delimiter alone (tabs allowed for <<-).
      let at = i + 1;
      for (const delimiter of here.pending.splice(0)) {
        while (at < text.length) {
          const end = text.indexOf('\n', at);
          const line = text.slice(at, end === -1 ? text.length : end);
          at = end === -1 ? text.length : end + 1;
          if (line.replace(/^\t+/, '') === delimiter) break;
        }
      }
      i = at - 1;
      wordStart = true;
    }
    if (/[\s;&|()]/.test(c)) wordStart = true;
  }
  return spans;
}

/** Why the Bash command `command` is refused for its backticks, or null. */
export function backtickRefusal(command) {
  const spans = backticksInDoubleQuotes(command);
  if (spans.length === 0) return null;
  const shown = spans.slice(0, 3).map((span) => `\`${span.slice(0, 40)}\``).join(', ');
  return `js-harness guard: backticks inside double quotes run as commands in bash (${shown}). `
    + 'Write the text through a file (Write, then `git commit -F <file>` or `--file`), put it in single quotes, '
    + 'or write $(...) where a command is meant.';
}

/** The hooks contract's answer that refuses the call, with `reason` shown to the agent. */
export function denial(reason) {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}
