// What `js-harness guard --hook` decides before a tool call runs (odd/tasks/honesty-audit.md, T13 and T14). It is
// a `PreToolUse` hook, so it answers the host with the hooks contract's JSON on standard output and always exits 0:
// an older js-harness on the path answers 2 to a command it does not know, and 2 blocks the host, so every hook
// entry ends in `|| exit 0` (bin/lib/manifest.mjs), and a refusal by exit code would be swallowed. Zero deps.
import { spawnSync } from 'node:child_process';
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
 * a `$(...)` stays in its word. */
function shellWords(command, { groups = false } = {}) {
  const words = [];
  const operators = new Set();
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
    } else {
      word = (word ?? '') + c;
    }
  }
  if (word !== null) words.push(word);
  words.operators = operators;
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
// section 13.3, row 3). This stops the accident; the lens record's run line is what refuses a forgery past it.
export const REVIEW_RECORD_FILES = Object.freeze(['codex-reviews.jsonl', 'codex-review-runs.jsonl', 'lens-reviews.jsonl', 'lens-review-runs.jsonl']);
const RECORD_NAMES = REVIEW_RECORD_FILES.map((name) => name.replace(/\./g, '\\.')).join('|');
const RECORD_PATH = new RegExp(`(?:^|[\\\\/])js-harness[\\\\/](${RECORD_NAMES})$`, 'i');
const RECORD_NAMED = new RegExp(`(?:^|[\\\\/])js-harness[\\\\/](${RECORD_NAMES})(?![\\w.-])`, 'i');

/** The name of the review record the path `file` is, or null when it is none: a file of `REVIEW_RECORD_FILES` in a
 * folder named `js-harness`, in any spelling of the path. */
export function reviewRecordOf(file) {
  const match = typeof file === 'string' ? RECORD_PATH.exec(file.trim()) : null;
  return match === null ? null : match[1].toLowerCase();
}

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

// The commands that write every file they are given, and those that write the last one (the others are read, but
// `mv` moves them away, which writes them too).
const WRITES_EACH = new Set(['tee', 'truncate', 'rm', 'shred', 'mv']);
const WRITES_LAST = new Set(['cp', 'install', 'ln']);
const IN_PLACE = new Set(['sed', 'perl']);
const INTERPRETERS = new Set(['node', 'python', 'python3', 'py', 'perl', 'ruby', 'deno', 'bun', 'pwsh', 'powershell']);
// The words before a command that leave it the command: an assignment, and a few wrappers.
const WRAPPERS = new Set(['env', 'command', 'exec', 'sudo', 'nohup']);
// What a script does to write a file it names, and the functions of this package that append a record.
const FILE_WRITE = /\b(?:appendFile|appendFileSync|writeFile|writeFileSync|createWriteStream|truncate|truncateSync|rename|renameSync|copyFile|copyFileSync|unlink|unlinkSync|rmSync|Add-Content|Set-Content|Out-File)\b|\bopen\s*\([^)]*?,\s*['"][^'"]*[wax+]/;
const RECORD_APPENDS = /\b(?:appendLensReview|startLensRun|appendCodexReview|appendCodexReviewRun|appendJsonLine)\b/;

/** Why the Bash command `command` is refused for writing a review record, or null. A record is written by a
 * redirection to it, by a command of `WRITES_EACH` given it, by one of `WRITES_LAST` given it last, by `sed` or `perl`
 * with an in-place option, by `dd of=` it, and by a script on a command line that names it beside a call that writes a
 * file, or that calls a function of this package that appends a record. Reading one passes, and so does text in quotes
 * or a heredoc's body. A script fed on standard input, or a path held in a variable, is not followed: this stops the
 * accident, and the lens record's run line refuses a forgery (./lens-reviews.mjs). */
export function reviewRecordWriteRefusal(command) {
  const words = shellWords(command, { groups: true });
  const { operators } = words;
  let start = 0;
  for (let i = 0; i <= words.length; i += 1) {
    if (i < words.length && !operators.has(i)) continue;
    const what = segmentRecordWrite(words.slice(start, i));
    if (what !== null) return recordReason(what);
    start = i + 1;
  }
  return null;
}

/** What the words of one simple command write of the review records, said as the refusal opens, or null. */
function segmentRecordWrite(segment) {
  const writes = (name) => (name === null ? null : `this command writes ${name}, the record of a review`);
  for (let i = 0; i < segment.length; i += 1) {
    const word = segment[i];
    // `> file` and `>> file`, a descriptor before them or not; or `>file` in one word, which holds no space unquoted.
    if (/^(?:\d*|&)>>?\|?$/.test(word) && reviewRecordOf(segment[i + 1]) !== null) return writes(reviewRecordOf(segment[i + 1]));
    const after = word.includes('>') ? word.slice(word.lastIndexOf('>') + 1) : '';
    if (after !== '' && !/\s/.test(after) && reviewRecordOf(after) !== null) return writes(reviewRecordOf(after));
  }
  let at = 0;
  while (at < segment.length && (COMMAND_KEYWORDS.has(segment[at]) || WRAPPERS.has(segment[at]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(segment[at]))) at += 1;
  const program = String(segment[at] ?? '').split(/[\\/]/).pop().toLowerCase().replace(/\.(?:exe|cmd)$/, '');
  const args = segment.slice(at + 1);
  const first = args.map(reviewRecordOf).find((name) => name !== null) ?? null;
  if (WRITES_EACH.has(program)) return writes(first);
  const paths = args.filter((arg) => !arg.startsWith('-'));
  if (WRITES_LAST.has(program)) return paths.length > 1 ? writes(reviewRecordOf(paths[paths.length - 1])) : null;
  if (IN_PLACE.has(program) && args.some((arg) => /^-[A-Za-z]*i/.test(arg) || arg.startsWith('--in-place')) && first !== null) return writes(first);
  if (program === 'dd') return writes(args.map((arg) => (arg.startsWith('of=') ? reviewRecordOf(arg.slice(3)) : null)).find((name) => name !== null) ?? null);
  if (!INTERPRETERS.has(program)) return null;
  for (const arg of args) {
    const append = RECORD_APPENDS.exec(arg);
    if (append !== null) return `this command calls ${append[0]}, which appends the record of a review`;
    const named = RECORD_NAMED.exec(arg);
    if (named !== null && FILE_WRITE.test(arg)) return writes(named[1].toLowerCase());
  }
  return null;
}

/** The hooks contract's answer that refuses the call, with `reason` shown to the agent. */
export function denial(reason) {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}
