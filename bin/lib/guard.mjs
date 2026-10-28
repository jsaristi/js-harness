// What `js-harness guard --hook` decides before a tool call runs (odd/tasks/honesty-audit.md, T13 and T14). It is
// a `PreToolUse` hook, so it answers the host with the hooks contract's JSON on standard output and always exits 0:
// an older js-harness on the path answers 2 to a command it does not know, and 2 blocks the host, so every hook
// entry ends in `|| exit 0` (bin/lib/manifest.mjs), and a refusal by exit code would be swallowed. Zero deps.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { guardHeld, ruleHere, ruleOf, staleNote } from './rules.mjs';

/** The models a sub-agent may be launched on in the project whose rules file has the text `projectData`, as
 * `[{ alias, id, rule }]`, writer first; or null when the rules are not in force there (no rules file, or one that
 * does not declare them), and then no model is refused. Behind a project that declares them the copy's own are held,
 * each with a `note` where the project declares it otherwise (`guardHeld`). The two model rules are read with
 * `ruleHere`, by their ids written out so that `rules check` lists this file as their reader, because both are of
 * this repository only: a project that installs the harness turns nothing on by default (his answer of 2026-10-14,
 * odd/tasks/honesty-audit.md S5). */
export function allowedModels(projectData) {
  const writer = guardHeld('subagent-writer-model', ruleHere('subagent-writer-model', undefined, projectData));
  const reader = guardHeld('subagent-reader-model', ruleHere('subagent-reader-model', undefined, projectData));
  if (writer === null || reader === null) return null;
  const entry = (rule, { value, note }) => ({ alias: ruleOf(rule).alias, id: value, rule, ...(note !== '' && { note }) });
  return [entry('subagent-writer-model', writer), entry('subagent-reader-model', reader)];
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
    + 'Launch it on one of those, or with no model to run on the parent\'s.' + staleNote(allowed.filter(({ note }) => note).map(({ rule }) => rule));
}

// The tools that open a session in the app's Routines or in the cloud, where it runs at the effort it inherits and he
// does not see it (odd/tasks/session-channel.md, layer 3). `delete`, `list` and `CronCreate` open nothing and pass.
export const OPENING_TOOLS = Object.freeze([
  'mcp__scheduled-tasks__create_scheduled_task',
  'mcp__scheduled-tasks__update_scheduled_task',
  'mcp__scheduled-tasks__run_scheduled_task',
  'RemoteTrigger',
]);

/** Why the call of the tool `toolName` is refused, or null. The four tools of `OPENING_TOOLS` are refused in the project
 * whose rules file has the text `projectData`, where the rule `sessions-open-in-sidebar` gives a value (his answers of
 * 2026-10-15: only where the rule is declared, and even when he asked for the session): the reason names the tool, the
 * rule and the value to open a session with instead. In a project that does not declare the rule nothing is refused;
 * behind one that declares it, the copy's value is held (`guardHeld`). The rule is read with `ruleHere`, by its id
 * written out so that `rules check` lists this file as its reader. */
export function openingRefusal(toolName, projectData) {
  if (!OPENING_TOOLS.includes(toolName)) return null;
  const rule = guardHeld('sessions-open-in-sidebar', ruleHere('sessions-open-in-sidebar', undefined, projectData));
  if (rule === null) return null;
  return `js-harness guard: ${toolName} opens a session in the app's Routines or in the cloud, where he does not see it `
    + `(rule sessions-open-in-sidebar). Open it with ${rule.value}, a row in his sidebar, or tell the lead; `
    + `it is refused even when he asked for it.${rule.note}`;
}

/** The tool that starts a session in the desktop app, a row in his sidebar. */
export const SESSION_TOOL = 'mcp__ccd_session__start_session';

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

/** Why the `start_session` call whose input is `toolInput` is refused, or null. A session started with no effort runs
 * at the effort of the one that started it: on 2026-10-16 two work sessions started so ran at max for two days while
 * the rule `session-effort` says high (odd/tasks/harness-review.md, T6c). Where that rule gives a value, a call that
 * carries a brief (`prompt`) is refused when it names no effort, a fork included since a fork cannot set its own, or
 * one above the rule's; a call with no brief (an offer's title, a proposal started as proposed) passes. Where the
 * rule is not declared nothing is refused; behind a project that declares it, the copy's value is held (`guardHeld`).
 * `cli` words the reasons for `js-harness sessions start`, which holds the same rule over its `--effort`
 * (odd/tasks/background-sessions.md, S5). */
export function sessionEffortRefusal(toolInput, projectData, { cli = false } = {}) {
  if (typeof toolInput?.prompt !== 'string' || toolInput.prompt === '') return null;
  const rule = guardHeld('session-effort', ruleHere('session-effort', undefined, projectData));
  if (rule === null) return null;
  const reason = effortReason(toolInput, rule.value, cli);
  return reason === null ? null : `${reason}${rule.note}`;
}

/** Why `toolInput` is refused under the rule session-effort of value `value`, or null. */
function effortReason(toolInput, value, cli) {
  const effort = toolInput.context === 'fork' ? undefined : toolInput.effort;
  const who = cli ? 'js-harness sessions start' : 'js-harness guard: start_session';
  const pass = cli ? `Pass --effort ${value} or lower` : `Pass effort "${value}" or lower`;
  if (effort === undefined || effort === null || effort === '') {
    if (cli) return `${who} names no effort, so the new session would run at the host's default (rule session-effort: ${value}). ${pass}.`;
    return `${who} names no effort, so the new session would run at this session's `
      + `(rule session-effort: ${value}). ${pass} with context "fresh"; a fork cannot set its own effort.`;
  }
  const asked = EFFORTS.indexOf(effort);
  if (asked === -1) {
    return `${who} asks for effort "${effort}", which is not one of ${EFFORTS.join(', ')}. ${pass}.`;
  }
  if (asked <= EFFORTS.indexOf(value)) return null;
  return `${who} asks for effort "${effort}", above the rule session-effort: ${value}. ${pass}; a higher one is his to set.`;
}

// The hour a message stamps as the time it is sent: in its opening header, after nothing but the sender's label
// and an optional date, and followed by a stamp word or a stop. The label is "From <someone>" or a session's
// title as the harness names sessions, a short code and a number with an optional topic ("JH 5 · canal, ",
// "JH 7 at "), so "JH 11 paused at 01:10" is an event and not a stamp. Only the position tells a stamp from any
// other hour: an event's hour also says "local" or "by date". Measured over 877 messages of three days
// (odd/tasks/honesty-audit.md, Log): 221 matches, 49 of them wrong, none an hour meant as anything but the time of
// sending.
// A title's topic never holds a colon, so "JH 26 · canal: compacted at 18:46" is an event after the label.
const STAMP = /^(?:From\b[^.:\n]{0,90}?[,(]\s*|[A-Z][A-Za-z]{0,3} ?\d{1,3}(?: ·[^,:\n]{0,40})?(?:,| at)\s+)(?:20\d\d-\d\d-\d\d\s+)?((?:[01]?\d|2[0-3]):[0-5]\d)(?::[0-5]\d)?(?=\s*(?:local\b|\(?(?:by|por|read from)\s+(?:a\s+)?`?date`?|by (?:the|my) clock|\(date\)|[.:),]))/;

// The other place a stamp sits: the hour first, then the label or a word in capitals ("19:48 JH ORQ: ...",
// "05:57 HIS ORDER: ..."), as the lead opened its notices. Over the record of 2026-10-15 to 10-17 only the lead's 74
// notices opened so, 73 of them more than a minute off the local clock; no message to another session did but 3,
// all right (odd/tasks/wake-and-flag.md, T4).
const HOUR_FIRST = /^((?:[01]?\d|2[0-3]):[0-5]\d)\s+(?=[A-Z])/;

const pad = (n) => String(n).padStart(2, '0');

/** The `HH:MM` that `text` stamps as the time it is sent, or null when its opening carries none. */
export function stampedHour(text) {
  const match = STAMP.exec(String(text ?? '')) ?? HOUR_FIRST.exec(String(text ?? ''));
  if (match === null) return null;
  const [hours, minutes] = match[1].split(':').map(Number);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** The stamp of `text` and the clock's hour at the local time `now`, `{ stamped, right }`, when the stamp is more
 * than a minute from the clock either way, the short way round midnight; else null. `notify` holds a notice's text
 * to it, as `hourRefusal` holds a message's. */
export function stampOff(text, now) {
  const stamped = stampedHour(text);
  if (stamped === null) return null;
  const [hours, minutes] = stamped.split(':').map(Number);
  // Minute against minute: a stamp names a minute, and 14:43 is right at 14:44:30.
  const apart = Math.abs(hours * 60 + minutes - (now.getHours() * 60 + now.getMinutes())) % 1440;
  if (Math.min(apart, 1440 - apart) <= 1) return null;
  return { stamped, right: `${pad(now.getHours())}:${pad(now.getMinutes())}` };
}

/** Why a message whose text is `text` is refused at the local time `now`, or null when it is not: its stamped hour
 * is more than a minute from the clock's, either way, the short way round midnight. Hours the sessions guessed ran
 * ahead of the clock by 2 to 26 minutes, "by date" or not; the refusal gives the right hour. */
export function hourRefusal(text, now) {
  const off = stampOff(text, now);
  if (off === null) return null;
  const { stamped, right } = off;
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
    if (here.kind === 'ansi') {
      // `$'...'`: literal like single quotes, but a backslash escapes the next character, `\'` among them.
      if (c === '\\') i++;
      else if (c === "'") stack.pop();
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
    if (c === '$' && text[i + 1] === "'") { stack.push({ kind: 'ansi' }); i++; }
    else if (c === "'") stack.push({ kind: 'single' });
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

/** The desktop app's tool that types a command into the user's Terminal panel. */
export const TERMINAL_TOOL = 'mcp__terminal__run_in_terminal';

// The note that ends a command for his terminal: PowerShell's Write-Host, or echo in an SSH host's shell, printing
// 'NOTE: ' and at least four words. Single quotes, because the tool refuses anything a shell would compute. A word
// holds no quote, so the note cannot reach past its closing quote into a later command (Codex, on 4ed1cc5).
const TERMINAL_NOTE = /;\s*(?:[Ww]rite-[Hh]ost|echo)\s+'NOTE: (?:[^'\s]+\s+){3}[^'\s]+[^']*'\s*$/;

/** Why the command `command`, typed into the user's terminal, is refused, or null: it does not end with a note that
 * says what it does. His request of 2026-10-19 (odd/tasks/terminal-note.md, S1): he reads the note beside the command,
 * where it runs, and learns what it does. A comment cannot carry it: the tool refuses one. Only where the rule
 * terminal-note is declared (`projectData`, the text of the project's rules file) is the command checked, so a
 * project that does not declare it types any command (his answer Q85, C-b-34); behind one that declares it, the copy's
 * value is held (`guardHeld`). */
export function terminalNoteRefusal(command, projectData) {
  const rule = guardHeld('terminal-note', ruleHere('terminal-note', undefined, projectData));
  if (rule === null) return null;
  if (TERMINAL_NOTE.test(String(command ?? ''))) return null;
  return 'js-harness guard: a command for the user\'s terminal ends with a note that says what it does, in everyday words: '
    + '<command>; Write-Host \'NOTE: <what it does>\' (echo instead of Write-Host in an SSH host\'s shell), four words '
    + `or more, in single quotes and printable ASCII, so the user reads it beside the command where it runs (rule terminal-note: ${rule.value}).${rule.note}`;
}

/** The words of the shell command `command`, its quotes taken off, with `;`, `&&`, `||` and `|` as words of their
 * own, and an unquoted newline as a `;`. A heredoc's body is left out: it is text, not commands. A backslash is kept
 * as it is: a Windows path is written with them. `words.operators` holds the indexes of the words that are operators,
 * so a quoted `"&&"` is told from one. With `groups`, an unquoted `(` or `)` of a subshell is an operator too; one of
 * a `$(...)` stays in its word. With `redirections`, an unquoted `>`, `>>` or `>|` is a word of its own wherever it
 * stands, a descriptor before it (`2>`) taken in, and `words.redirections` holds their indexes. */
function shellWords(command, { groups = false, redirections = false } = {}) {
  const words = [];
  const operators = new Set();
  const redirects = new Set();
  const operator = (text) => { operators.add(words.length); words.push(text); };
  let word = null;
  let quote = null;
  let substitutions = 0;
  const pending = [];
  const text = String(command ?? '');
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote !== null) {
      if (c === quote) quote = null;
      else word += c;
    } else if (groups && c === '$' && text[i + 1] === '(') {
      word = `${word ?? ''}$(`;
      substitutions += 1;
      i += 1;
    } else if (groups && c === ')' && substitutions > 0) {
      word += c;
      substitutions -= 1;
    } else if (groups && (c === '(' || c === ')')) {
      if (word !== null) words.push(word);
      word = null;
      operator(c);
    } else if (c === "'" || c === '"') {
      quote = c;
      word ??= '';
    } else if (c === '\\' && text[i + 1] === '\n') {
      i += 1;
    } else if (c === '#' && word === null) {
      while (i + 1 < text.length && text[i + 1] !== '\n') i += 1;
    } else if (c === '<' && text[i + 1] === '<' && text[i + 2] !== '<' && HEREDOC.test(text.slice(i))) {
      const [found, single, double, bare] = HEREDOC.exec(text.slice(i));
      if (word !== null) words.push(word);
      word = null;
      pending.push({ end: single ?? double ?? bare, tabs: found.startsWith('<<-') });
      i += found.length - 1;
    } else if (c === '\n') {
      if (word !== null) words.push(word);
      word = null;
      // Each pending heredoc's body runs to the line that is its delimiter alone (tabs before it for <<-).
      for (const { end, tabs } of pending.splice(0)) {
        while (i < text.length) {
          const next = text.indexOf('\n', i + 1);
          const line = text.slice(i + 1, next === -1 ? text.length : next).replace(/\r$/, '');
          i = next === -1 ? text.length : next;
          if ((tabs ? line.replace(/^\t+/, '') : line) === end) break;
        }
      }
      operator(';');
    } else if (/\s/.test(c)) {
      if (word !== null) words.push(word);
      word = null;
    } else if (c === ';' || c === '|' || c === '&') {
      if (word !== null) words.push(word);
      word = null;
      const pair = text[i + 1] === c && c !== ';';
      operator(pair ? c + c : c);
      if (pair) i += 1;
    } else if (redirections && c === '>') {
      if (word !== null && !/^\d+$/.test(word)) words.push(word);
      word = null;
      const pair = text[i + 1] === '>';
      redirects.add(words.length);
      words.push(pair ? '>>' : '>');
      if (pair) i += 1;
      if (text[i + 1] === '|') i += 1;
    } else {
      word = (word ?? '') + c;
    }
  }
  if (word !== null) words.push(word);
  words.operators = operators;
  words.redirections = redirects;
  return words;
}

const SEPARATORS = new Set([';', '&&', '||', '|', '&']);
const BASE_VERBS = new Set(['assess', 'status', 'start']);

/** The value of `--<name>` among `words`, written `--name value` or `--name=value`, or null. */
function optionOf(words, name) {
  for (let i = 0; i < words.length; i += 1) {
    if (words[i] === `--${name}`) return words[i + 1] ?? null;
    if (words[i].startsWith(`--${name}=`)) return words[i].slice(name.length + 3);
  }
  return null;
}

/** Whether `base` is a commit on the first-parent line of the head of the repository at `cwd`: true, false, or null
 * when git cannot tell (a tree, a name it does not know, no repository). */
export function onFirstParentLine(base, cwd, { run = (args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 5000 }) } = {}) {
  // A git that hangs (a loaded machine, a scanner) times out, and a call it cannot judge runs.
  const git = (...args) => run(args);
  const resolved = git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
  if (resolved.status !== 0) return null;
  const commit = resolved.stdout.trim();
  // The head's line down to the first commit the base holds, never the whole history: on the line, that walk ends
  // right above the base; off it, at the fork point. Either way it is as long as the branch. Each commit comes with
  // its parents, and every commit printed is on the head's line, so the base is on it when it is the first parent
  // of any of them: a walk git cut late (committer dates out of order) prints more, never less (gentle-ai R3).
  const above = git('rev-list', '--first-parent', '--parents', 'HEAD', `^${commit}`);
  if (above.status !== 0) return null;
  const line = above.stdout.split(/\r?\n/).filter(Boolean);
  if (line.length === 0) {
    // The base holds the head: on the line only when it is the head.
    const head = git('rev-parse', 'HEAD');
    return head.status !== 0 ? null : head.stdout.trim() === commit;
  }
  return line.some((entry) => entry.split(/\s+/)[1] === commit);
}

/** Why the Bash command `command` is refused for the base it gives a gentle-ai review, or null (odd/tasks/gate-wait.md,
 * T11). gentle-ai diffs the tree of `--base-ref` against the head's, then walks up to 64 first-parent ancestors of the
 * head: a base off that line costs it about 216 git runs against 31, which a loaded machine stretches past its timeout,
 * and a base the head is behind also puts that branch's newer work in the candidate, reversed (on 2026-10-17 a head 19
 * commits behind origin/main was assessed as 470 changed lines in 20 s, and as nothing in 1 s from its merge-base).
 * Only `assess`, `status` and `start` take a base. The repository is the command's `--cwd`, else `cwd`; `contains`
 * stands in for git. A base git cannot read (a tree, an unknown name) is let run: the check says nothing it cannot tell. */
export function reviewBaseRefusal(command, { cwd, contains = onFirstParentLine } = {}) {
  const words = shellWords(command);
  // The folder the commands run in, moved by a plain `cd <folder>`; null once a move it cannot follow came.
  let here = cwd;
  for (let i = 0; i < words.length; i += 1) {
    const atStart = i === 0 || SEPARATORS.has(words[i - 1]);
    if (atStart && (words[i] === 'cd' || words[i] === 'pushd' || words[i] === 'popd')) {
      const to = SEPARATORS.has(words[i + 1] ?? ';') ? null : words[i + 1];
      const followed = words[i] === 'cd' && to !== null && to !== '-' && !/^~|\$/.test(to) && here !== null;
      here = !followed ? null : /^([A-Za-z]:)?[\\/]/.test(to) ? to : `${String(here).replace(/[\\/]+$/, '')}/${to}`;
      continue;
    }
    if (!atStart || words[i] !== 'gentle-ai' || words[i + 1] !== 'review' || !BASE_VERBS.has(words[i + 2])) continue;
    let end = i + 3;
    while (end < words.length && !SEPARATORS.has(words[end])) end += 1;
    const own = words.slice(i + 3, end);
    const base = optionOf(own, 'base-ref');
    if (base === null || base === '') continue;
    const named = optionOf(own, 'cwd');
    const relative = named !== null && !/^([A-Za-z]:)?[\\/]/.test(named);
    const repository = named === null ? here : !relative ? named : here === null ? null : `${String(here).replace(/[\\/]+$/, '')}/${named}`;
    if (repository === null || contains(base, repository) !== false) continue;
    return `js-harness guard: --base-ref ${base} is not on this head's first-parent line, where gentle-ai walks for the `
      + 'base: off it the preflight runs about 216 git commands instead of 31 and can time out, and a base the head is '
      + 'behind puts its newer work in the candidate, reversed. Give it, by its hash, a commit on that line: the last '
      + `reviewed boundary, the commit that merged the default branch in, or the hash of git merge-base ${base} HEAD `
      + 'when it never was (odd/tasks/gate-wait.md, T11).';
  }
  return null;
}

// A drive's root, or a folder at its top, as Windows (`D:/x`, `D:\x`) or Git Bash (`/d/x`) writes it.
const DRIVE_TOP = /^(?:[A-Za-z]:|\/[A-Za-z])(?:[\\/]+[^\\/]+)?[\\/]*$/;

/** Why the Bash command `command` is refused for removing a drive's root or a folder at its top, or null: an `rm`
 * with a recursive option, or an `rmdir`, that starts a command. The host asks the user before it even in bypass
 * mode, as a removal of a critical path, and the session waits on that card until the user answers; on 2026-10-17
 * JH 22 waited 20 hours on `rm -rf D:/practice-jh22` (odd/tasks/held-sessions.md, S7 and L9). A denial comes back at
 * once. Text in quotes or in a heredoc's body is no command, and an `rm` that is no command's first word is not read. */
export function driveRootRemovalRefusal(command) {
  const words = shellWords(command, { groups: true });
  const { operators } = words;
  for (let i = 0; i < words.length; i += 1) {
    const atStart = i === 0 || operators.has(i - 1) || (!operators.has(i - 1) && COMMAND_KEYWORDS.has(words[i - 1]) && (i === 1 || operators.has(i - 2)));
    if (!atStart || operators.has(i) || (words[i] !== 'rm' && words[i] !== 'rmdir')) continue;
    // rm takes its options after the paths too (`rm D:/x -rf`), so every option is read before any path.
    let recursive = words[i] === 'rmdir';
    let options = true;
    const paths = [];
    for (let at = i + 1; at < words.length && !operators.has(at); at += 1) {
      const word = words[at];
      if (options && word === '--') options = false;
      else if (options && word === '--recursive') recursive = true;
      else if (options && /^-[A-Za-z]+$/.test(word)) recursive ||= /[rR]/.test(word);
      else paths.push(word);
    }
    const top = recursive ? paths.find((word) => DRIVE_TOP.test(word)) : undefined;
    if (top !== undefined) {
      return `js-harness guard: ${top} is the top of a drive or a folder at it, and the host asks the user before `
        + 'removing such a path even in bypass mode: the session would wait on that card until the user answers. '
        + 'Put practice and scratch folders below the project\'s worktrees folder (for example '
        + '<repo-parent>/<repo-name>-worktrees/practice/<name>) or in the session\'s scratchpad, and remove them there.';
    }
  }
  return null;
}

// The words after which a command starts, as after an operator: a group's `{` and the bodies of if, for and while.
const COMMAND_KEYWORDS = new Set(['{', 'then', 'else', 'do', '!', 'time']);

// The records of both reviews, each in `<git common dir>/js-harness/` (./codex-reviews.mjs, ./codex-review-runs.mjs,
// ./lens-reviews.mjs; a test holds this list to their names). Only the commands that make a review write them: a
// line a session writes there by hand reads as a review nobody made (docs/proposals/gentle-ai-reverse-engineering.md,
// section 13.3, row 3). This is the only thing that stops a session writing a lens record and its run line both; the
// run line (./lens-reviews.mjs) refuses a record written with none.
export const REVIEW_RECORD_FILES = Object.freeze(['codex-reviews.jsonl', 'codex-review-runs.jsonl', 'lens-reviews.jsonl', 'lens-review-runs.jsonl']);
const RECORD_NAMES = REVIEW_RECORD_FILES.map((name) => name.replace(/\./g, '\\.')).join('|');
const RECORD_PATH = new RegExp(`(?:^|/)js-harness/(${RECORD_NAMES})$`, 'i');
// A record's name in a script's text, where its folder may be joined apart from it.
const RECORD_IN_TEXT = new RegExp(`(?:^|[\\\\/'"\`\\s(,])(${RECORD_NAMES})(?![\\w.-])`, 'i');
const RECORDS_FOLDER = /(?:^|\/)js-harness\/?$/i;
// The folder itself is `js-harness` in a git dir, so a project folder named `js-harness` is not it. Each part of a path
// may be a glob (`partMatches`). A `.git` under any prefix counts, an absolute path to this one among them, refusing
// more being the safe side; a bare `.git` removed whole is this checkout's only from where the command runs, since
// another project's is removed often and an absolute path to this one is not followed.

/** Whether the part of a path `part`, a name or a glob, matches `name` as a shell reads it: `*`, `?` and a bracketed
 * class (`[!…]` or `[^…]` negated), every other character as itself, and a leading dot matched only by a dot. */
function partMatches(part, name) {
  if (part === undefined) return false;
  if (name.startsWith('.') && !part.startsWith('.')) return false;
  const source = part.replace(/\[([!^]?)(\]?[^\]]*)\]|\*|\?|[.+^${}()|\\[\]]/g, (piece, negated, members) => {
    if (piece === '*') return '.*';
    if (piece === '?') return '.';
    if (members === undefined) return `\\${piece}`;
    return `[${negated === '' ? '' : '^'}${members.replace(/[\\^\]]/g, (c) => `\\${c}`)}]`;
  });
  try {
    return new RegExp(`^${source}$`, 'i').test(name);
  } catch {
    return true;
  }
}

/** The parts of the path `arg`, and whether a trailing slash keeps only folders. */
function pathParts(arg) {
  return { folderOnly: /.\/+$/.test(slashed(arg)), parts: slashed(arg).replace(/(.)\/+$/, '$1').split('/') };
}

const isGitDir = (part) => partMatches(part, '.git');
const isRecordsFolder = (part) => partMatches(part, 'js-harness');
const isRecord = (part) => REVIEW_RECORD_FILES.some((name) => partMatches(part, name));

/** Whether removing or moving away the path `arg` takes a record: it is this checkout's git dir, the records' folder,
 * or a record in it, which a trailing slash leaves out, every record being a file. */
function takesRecords(arg) {
  const { folderOnly, parts } = pathParts(arg);
  const back = (n) => parts[parts.length - n];
  if (parts.length === 1 && isGitDir(back(1))) return true;
  if (isGitDir(back(2)) && isRecordsFolder(back(1))) return true;
  return !folderOnly && isGitDir(back(3)) && isRecordsFolder(back(2)) && isRecord(back(1));
}

/** Whether a `mv`, `cp`, `install` or `ln` given `args` writes the records' folder whole: one copied into a git dir, or
 * what a folder holds (`<folder>/.`, or a glob that can match a record) copied into the git dir or the folder. */
function folderWrittenInto(args) {
  const { target, sources } = moveParts(args);
  if (target === undefined) return false;
  const { parts } = pathParts(target);
  const holds = (source) => /\/\.\/*$/.test(String(source).replace(/\\/g, '/'));
  const last = (source) => pathParts(source).parts.pop();
  if (isGitDir(parts[parts.length - 1])) return sources.some((source) => holds(source) || isRecordsFolder(last(source)));
  if (isGitDir(parts[parts.length - 2]) && isRecordsFolder(parts[parts.length - 1])) {
    return sources.some((source) => holds(source) || isRecord(last(source)));
  }
  return false;
}

/** `file` with forward slashes and its `.`, `..` and doubled slashes taken out. */
const slashed = (file) => path.posix.normalize(String(file).trim().replace(/\\/g, '/'));

/** The name of the review record the path `file` is, or null when it is none: a file of `REVIEW_RECORD_FILES` in a
 * folder named `js-harness`, in any spelling of the path. */
export function reviewRecordOf(file) {
  const match = typeof file === 'string' && file.trim() !== '' ? RECORD_PATH.exec(slashed(file)) : null;
  return match === null ? null : match[1].toLowerCase();
}

/** Whether the path `file` names a review record by its file name alone. */
const recordNamed = (file) => REVIEW_RECORD_FILES.includes(slashed(file).split('/').pop().toLowerCase());

/** The refusal of a write to a review record, after `what` says which write and which record. */
const recordReason = (what) => `js-harness guard: ${what}, and only the command that makes the review writes one `
  + '(js-harness lens-review, js-harness codex-review): a line written by hand reads as a review nobody made, and '
  + 'check --push counts no lens record that names no run line of its own. Run the review instead; reading a record '
  + 'is free, and removing one is the user\'s to do.';

/** Why the file tool `tool` is refused for writing the path `file`, or null when it is no review record. */
export function reviewRecordFileRefusal(tool, file) {
  const name = reviewRecordOf(file);
  return name === null ? null : recordReason(`${tool} of ${file} is refused: it is ${name}, the record of a review`);
}

// The commands that write every file they are given (`mv` moves them away, which writes them too), and those that write
// into a target: the last path, or the folder `-t` names.
const WRITES_EACH = new Set(['tee', 'truncate', 'rm', 'shred', 'mv']);
const WRITES_INTO = new Set(['mv', 'cp', 'install', 'ln']);
const IN_PLACE = new Set(['sed', 'perl']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
const INTERPRETERS = new Set(['node', 'python', 'python3', 'py', 'perl', 'ruby', 'deno', 'bun', 'pwsh', 'powershell']);
// The words before a command that leave it the command: an assignment, and a few wrappers.
const WRAPPERS = new Set(['env', 'command', 'exec', 'sudo', 'nohup']);
// The calls of a script that write a file they are given, and the cmdlets that do in PowerShell.
const WRITE_CALL = /\b(appendFile|writeFile|createWriteStream|truncate|rename|copyFile|unlink|rm|open|appendJsonLine)(?:Sync)?\s*\(/gi;
const CMDLET_WRITE = /\b(?:Add-Content|Set-Content|Out-File)\b/i;
// A write call the code names without calling it: passed on, held or destructured.
const HELD_WRITE = /\b(?:appendFile|writeFile|createWriteStream|copyFile|appendJsonLine|rename|truncate|unlink)(?:Sync)?\b(?!\s*\()/;
// The package's constants and functions that name a record, each with the record it names.
export const RECORD_HANDLES = Object.freeze({
  LENS_REVIEWS_FILE: 'lens-reviews.jsonl',
  LENS_REVIEW_RUNS_FILE: 'lens-review-runs.jsonl',
  codexReviewsPath: 'codex-reviews.jsonl',
  codexReviewRunsPath: 'codex-review-runs.jsonl',
});
const RECORD_HANDLE = new RegExp(`\\b(${Object.keys(RECORD_HANDLES).join('|')})\\b`);
// A function of this package that appends a record of a review and nothing else, named in a script's code: called,
// passed on or held, it is refused; named in a string, it is text.
const RECORD_APPENDS = /\b(appendLensReview|startLensRun|appendCodexReviewRun|appendCodexReview)\b/;

/** Why the Bash command `command` is refused for writing a review record, or null (`recordWriteOf`). */
export function reviewRecordWriteRefusal(command) {
  const what = recordWriteOf(command);
  return what === null ? null : recordReason(what);
}

/** What the shell command `command` writes of the review records, said as a refusal opens, or null. A record is written
 * by a redirection to it, by a command of `WRITES_EACH` given it, by one of `WRITES_INTO` aimed at it or at the records'
 * folder with a record's name, by `sed` or `perl` with an in-place option, by `dd of=` it, by `rm` of the records'
 * folder, by `bash -c` (or `sh`, `zsh`, `dash`) or `eval` of a script that does, and by an interpreter's command line whose
 * write call is given it or that calls a function of this package that appends a record. Reading one passes, and so
 * does text in quotes or a heredoc's body. A script fed on standard input, a path held in a shell variable and a `cd`
 * into the folder are not followed. */
function recordWriteOf(command) {
  const words = shellWords(command, { groups: true, redirections: true });
  const { operators, redirections } = words;
  let start = 0;
  for (let i = 0; i <= words.length; i += 1) {
    if (i < words.length && !operators.has(i)) continue;
    const redirected = new Set([...redirections].filter((at) => at >= start && at < i).map((at) => at - start));
    const what = segmentRecordWrite(words.slice(start, i), redirected);
    if (what !== null) return what;
    start = i + 1;
  }
  return null;
}

/** What the words of one simple command write of the review records, said as the refusal opens, or null.
 * `redirected` holds the indexes of its redirections, each followed by the file it writes. */
function segmentRecordWrite(words, redirected) {
  const writes = (name) => (name === null || name === undefined ? null : `this command writes ${name}, the record of a review`);
  for (const at of redirected) {
    const name = reviewRecordOf(words[at + 1]);
    if (name !== null) return writes(name);
  }
  // What is left is the command and its arguments.
  const segment = words.filter((_, i) => !redirected.has(i) && !redirected.has(i - 1));
  let at = 0;
  while (at < segment.length && (COMMAND_KEYWORDS.has(segment[at]) || WRAPPERS.has(segment[at]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(segment[at]))) at += 1;
  const program = String(segment[at] ?? '').split(/[\\/]/).pop().toLowerCase().replace(/\.(?:exe|cmd)$/, '');
  const args = segment.slice(at + 1);
  const first = args.map(reviewRecordOf).find((name) => name !== null) ?? null;
  if (WRITES_EACH.has(program) && first !== null) return writes(first);
  if (program === 'rm' && args.some(takesRecords)) return 'this command removes the folder that holds every record of a review';
  if (program === 'mv' && moveParts(args).sources.some(takesRecords)) return 'this command moves away the folder that holds every record of a review';
  if (WRITES_INTO.has(program) && writtenInto(args) === null && folderWrittenInto(args)) return 'this command writes the folder that holds every record of a review';
  if (WRITES_INTO.has(program)) return writes(writtenInto(args));
  if (IN_PLACE.has(program) && args.some((arg) => /^-[A-Za-z]*i/.test(arg) || arg.startsWith('--in-place')) && first !== null) return writes(first);
  if (program === 'dd') return writes(args.map((arg) => (arg.startsWith('of=') ? reviewRecordOf(arg.slice(3)) : null)).find((name) => name !== null));
  if (program === 'eval') return recordWriteOf((args[0] === '--' ? args.slice(1) : args).join(' '));
  if (SHELLS.has(program)) {
    const flag = args.findIndex((arg) => /^-[A-Za-z]*c$/.test(arg));
    return flag === -1 || args[flag + 1] === undefined ? null : recordWriteOf(args[flag + 1]);
  }
  if (!INTERPRETERS.has(program)) return null;
  for (const arg of args) {
    const append = RECORD_APPENDS.exec(codeOf(arg));
    if (append !== null) return `this command calls ${append[1]}, which appends the record of a review`;
    const name = scriptRecordWrite(arg);
    if (name !== null) return writes(name);
  }
  return null;
}

/** The target and the sources of a `mv`, `cp`, `install` or `ln` given `args`, and the folder `-t` (alone or last among
 * short options, or `--target-directory`) names, which is then the target; else the target is the last path. */
function moveParts(args) {
  const flag = args.findIndex((arg) => /^-[A-Za-z]*t$/.test(arg) || arg === '--target-directory');
  const long = args.find((arg) => arg.startsWith('--target-directory='));
  const folder = flag !== -1 ? args[flag + 1] : long?.slice('--target-directory='.length);
  const paths = args.filter((arg, i) => !arg.startsWith('-') && !(flag !== -1 && i === flag + 1));
  if (folder !== undefined) return { folder, target: folder, sources: paths };
  return { folder, target: paths.length < 2 ? undefined : paths[paths.length - 1], sources: paths.slice(0, -1) };
}

/** The record a `mv`, `cp`, `install` or `ln` given `args` writes: its target when that is a record, or a record's name
 * among its sources when the target is the records' folder; else null (`moveParts`). */
function writtenInto(args) {
  const { folder, target, sources } = moveParts(args);
  if (target === undefined) return null;
  if (folder === undefined && reviewRecordOf(target) !== null) return reviewRecordOf(target);
  if (!RECORDS_FOLDER.test(slashed(target ?? ''))) return null;
  const source = sources.find(recordNamed);
  return source === undefined ? null : slashed(source).split('/').pop().toLowerCase();
}

/** The top-level arguments of the call whose `(` ends just before `from` in `text`, as written. */
function callArguments(text, from) {
  const args = [];
  let current = '';
  let depth = 0;
  let quote = null;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i];
    if (quote !== null) {
      current += c;
      if (c === '\\') current += text[++i] ?? '';
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) {
      if (depth === 0) break;
      depth -= 1;
    } else if (c === ',' && depth === 0) {
      args.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  args.push(current);
  return args;
}

// A call that runs a string as code, here or in a child process: what that string holds is code too. A timer may run
// what it is given unless that is a function written in place.
const RUNS_TEXT = /\b(?:eval|Function|exec\w*|spawn\w*|fork|compile|runIn\w*Context|system|popen|Popen|check_output|check_call)\s*\(|\b(?:setTimeout|setInterval)\s*\(\s*(?![\s(]|function\b|async\b|[\w$]+\s*=>)|\b(?:subprocess|child_process)\b/;
// The one exec that runs no string: a RegExp's, called on the RegExp it is written on (`RegExp('…').exec(t)`), whose
// arguments hold no call (gentle-ai on PR 630). Called on a name, it may be a child process's, and stays in RUNS_TEXT;
// so does every exec of a script that names RegExp as anything but a call, which may make it another function, or that
// could make a RegExp's exec something else: eval named without a call, a prototype, a global or a member named in
// brackets by a string (the independent verifier on 3982ae68). An exec named in brackets reads `.exec` with spaces
// after it, and stays.
const REGEXP_EXEC = /\b(?:new\s+)?RegExp\s*\([^()]*\)\s*\.exec\(/g;
const REGEXP_NOT_CALLED = /\bRegExp\b(?!\s*\()|\b(?:function|class)\s+RegExp\b/;
const REGEXP_REDIRECTED = /\b(?:eval|Function|constructor|prototype|__proto__|\w*[Pp]rototypeOf|define\w*|Reflect|Object|globalThis|global|window|self|this|with|atob|Buffer)\b|\[\s*['"`]/;

/** Whether the code `code`, its strings blanked, runs a string (`RUNS_TEXT`), a RegExp's own exec left out. */
const runsText = (code) =>
  RUNS_TEXT.test(REGEXP_NOT_CALLED.test(code) || REGEXP_REDIRECTED.test(code) ? code : code.replace(REGEXP_EXEC, ''));

/** The script `text` with what its string literals hold blanked to spaces, so a call is looked for in its code alone and
 * at the same indexes; a template literal's `${…}` stays code, a member named in brackets (`fs['writeFileSync']`) is
 * read as `.writeFileSync`, and a `//` or `/* … *\/` comment opens no string. On the safe side, the script comes back
 * whole, its bracketed members still read so, when its code holds any other `/` (a regex literal's quotes would mislead it), a quote is left open, or the script
 * runs a string (`runsText`). */
function codeOf(script) {
  // Read whole on the safe side, a script keeps its bracketed members read as `.name` (`text`, at the same indexes).
  const text = script.replace(/\[\s*(['"`])([A-Za-z_$][\w$]*)\1\s*\]/g, (whole, _, name) => `.${name}`.padEnd(whole.length));
  let out = '';
  const open = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const top = open[open.length - 1];
    const comment = top !== "'" && top !== '"' && top !== '`' && c === '/' ? { '/': '\n', '*': '*/' }[text[i + 1]] : undefined;
    if (comment !== undefined) {
      const end = text.indexOf(comment, i + 2);
      const to = end === -1 ? text.length : end;
      out += text.slice(i, to);
      i = to - 1;
      continue;
    }
    // A regex literal may hold a quote, and telling one from a division needs a parser: read the script whole.
    if (top !== "'" && top !== '"' && top !== '`' && c === '/') return text;
    if (top === "'" || top === '"' || top === '`') {
      if (c === top) open.pop();
      else if (top === '`' && c === '$' && text[i + 1] === '{') {
        open.push('${');
        out += '${';
        i += 1;
        continue;
      } else {
        const escaped = c === '\\' && i + 1 < text.length;
        out += escaped ? '  ' : ' ';
        if (escaped) i += 1;
        continue;
      }
    } else if (c === "'" || c === '"' || c === '`') open.push(c);
    else if (c === '{' && top !== undefined) open.push('{');
    else if (c === '}' && top !== undefined) open.pop();
    out += c;
  }
  return open.length > 0 || runsText(out) ? text : out;
}

/** What the call argument `arg` holds when it is one string literal and nothing else, or null. */
function literalOf(arg) {
  const match = /^\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*$/s.exec(arg);
  return match === null || (match[1] === '`' && match[2].includes('${')) ? null : match[2];
}

/** The record the script `text` writes by a call given it, or null. What each call writes: `rename` both of its paths,
 * `copyFile` and `appendJsonLine` (this package's, given a folder and a record's name) their second, `open` its first
 * when its mode (the second argument, or `mode=`) writes, the others their first. A call is looked for in the code, not
 * inside a string. A path written whole in one string is a record only in the records' folder (`reviewRecordOf`); one
 * assembled from parts, a join, is taken for a record when a part names one. A path given as anything but one string,
 * a variable or a join of one, is taken for the record the script names anywhere, when it names one: reading a record
 * and writing to a variable is refused with it, the safe side. So is a write call the code holds without calling it
 * (`fs.writeFileSync.call`, `const w = fs.writeFileSync`). A record is named by its file name or by the package's
 * constant or function for it (`RECORD_HANDLES`). */
function scriptRecordWrite(text) {
  const anywhere = recordNamedIn(text);
  const code = codeOf(text);
  if (anywhere !== null && HELD_WRITE.test(code)) return anywhere;
  for (const match of code.matchAll(WRITE_CALL)) {
    const call = match[1].toLowerCase();
    const args = callArguments(text, match.index + match[0].length);
    if (call === 'open') {
      const mode = args.slice(1).find((arg) => /^\s*mode\s*=/.test(arg)) ?? (args[1] !== undefined && !/^\s*\w+\s*=/.test(args[1]) ? args[1] : undefined);
      if (mode === undefined || !/['"][^'"]*[wax+][^'"]*['"]/.test(mode)) continue;
    }
    const written = call === 'rename' ? args : call === 'copyfile' || call === 'appendjsonline' ? args.slice(1, 2) : args.slice(0, 1);
    const recordIn = (arg) => {
      const literal = call === 'appendjsonline' ? null : literalOf(arg);
      return literal !== null ? reviewRecordOf(literal) : recordNamedIn(arg);
    };
    const named = written.map(recordIn).find((name) => name !== null);
    if (named !== undefined) return named;
    if (anywhere !== null && written.some((arg) => arg.trim() !== '' && literalOf(arg) === null)) return anywhere;
  }
  return CMDLET_WRITE.test(text) ? anywhere : null;
}

/** The record `text` names, by its file name or by a handle of `RECORD_HANDLES`, lower-cased; or null. */
function recordNamedIn(text) {
  const name = RECORD_IN_TEXT.exec(text)?.[1];
  if (name !== undefined) return name.toLowerCase();
  const handle = RECORD_HANDLE.exec(text)?.[1];
  return handle === undefined ? null : RECORD_HANDLES[handle];
}

/** The hooks contract's answer that refuses the call, with `reason` shown to the agent. */
export function denial(reason) {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}
