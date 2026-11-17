// A session opened in the background runs where the user does not see it (odd/tasks/senior-orchestrator.md, T7: his
// words of 2026-11-15, "nunca debemos permitir eso", "no se puede abrir ninguna sesion en segundo
// plano"). Where the rule sessions-open-in-sidebar is declared, the guard refuses a Bash or Terminal step that launches
// `claude --bg` or `js-harness sessions start`, and the command refuses itself. It lives apart from ./guard.mjs, which
// is at a module's size limit (bin/conventions-structure.test.mjs).
import { COMMAND_KEYWORDS, shellWords, sidebarRule } from './guard.mjs';
import { programOf } from './chained-step-guard.mjs';

// The keywords that open a condition: the command after one is a step of its own.
const CONDITIONS = new Set(['if', 'elif', 'while', 'until']);

// The options of xargs, GNU's and BSD's, that take the next word as their value.
const XARGS_VALUES = new Set(['-n', '-L', '-P', '-s', '-d', '-E', '-a', '-I', '-J', '-R', '-S', '--max-args', '--max-lines', '--max-procs', '--max-chars', '--delimiter', '--eof', '--arg-file', '--replace']);

/** `command` with each unquoted `&>` written as ` >`: `shellWords` keeps no spacing, so it gives the `&` of `&>` as a
 * separator of its own, and only the text says whether the `&` was written against the `>` (the verifier's second
 * pass; Codex and the lenses on 0b7d607..7a7eb7c: `echo ok & >log claude --bg` keeps its separator). The scan follows
 * quotes and backslashes as the shell does, so an `&>` in quotes stays text; `&&` and `|&` are left as they are. */
function ampersandRedirections(command) {
  const text = String(command ?? '');
  let out = '';
  let quote = null;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (quote === "'") {
      if (char === "'") quote = null;
    } else if (char === '\\') {
      out += char + (text[at + 1] ?? '');
      at += 1;
      continue;
    } else if (quote === '"') {
      if (char === '"') quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '&' && (text[at + 1] === '&' || text[at - 1] === '|' || text[at - 1] === '>')) {
      out += char + (text[at + 1] === '&' ? '&' : '');
      if (text[at + 1] === '&') at += 1;
      continue;
    } else if (char === '&' && text[at + 1] === '>') {
      out += ' ';
      continue;
    }
    out += char;
  }
  return out;
}

/** The words of `command`, as `shellWords` gives them with its `redirections`, with each unquoted `>`, `>>` or `>|`
 * taken out with its target: the next word, or `&` and a descriptor (`2>&1`); an unquoted `&>` or `&>>` is read as
 * `>` or `>>` (`ampersandRedirections` above). A quoted `'>'` is a
 * word, not a redirection (the verifier of 2026-11-17), so the launch after it is read, and a target is no option of
 * claude's (Codex P2s of 2026-11-17). */
function withoutRedirections(command) {
  const read = shellWords(ampersandRedirections(command), { groups: true, redirections: true });
  const words = [];
  words.operators = new Set();
  for (let at = 0; at < read.length; at += 1) {
    if (read.redirections.has(at)) {
      if (read[at + 1] === '&' && read.operators.has(at + 1)) at += 2;
      else if (!read.operators.has(at + 1)) at += 1;
      continue;
    }
    if (read.operators.has(at)) words.operators.add(words.length);
    words.push(read[at]);
  }
  return words;
}

/** Whether `args` hold the option `name`, alone or with its value after `=`. */
const hasOption = (args, name) => args.some((arg) => arg === name || arg.startsWith(`${name}=`));

/** The name a word gives a program: its last part, in lower case, with no `.exe`, `.cmd` or `.bat`. */
const programName = (word) => word.replace(/^.*[\\/]/, '').toLowerCase().replace(/\.(?:exe|cmd|bat)$/, '');

/** The launch of a session out of his sidebar the words of one simple command make, or null
 * (odd/tasks/senior-orchestrator.md, T7): `claude --bg`, `claude respawn` (which restarts background sessions),
 * `claude --cloud`, or `js-harness sessions start`, behind `js-harness gate --` or `xargs` too. The guard reads
 * launches written out in an ordinary shape. It does not read text the shell computes (`eval`, `$C`, `bash -c`, a
 * `$( )` or backtick substitution), nor a wrapper it does not know (`setsid`, `stdbuf`, `cmd /c`, `powershell
 * -Command`), as the verifier of 2026-11-17 listed. */
function launchOf(words) {
  const { program: named, args } = programOf(words);
  // programOf keeps a .bat on the name (claude.bat), which names the program too.
  const program = programName(named);
  if (program === 'xargs') {
    let at = 0;
    while (at < args.length && args[at].startsWith('-')) at += XARGS_VALUES.has(args[at]) ? 2 : 1;
    return launchOf(args.slice(at));
  }
  if (program === 'claude') {
    // claude's options are the words after it, not programOf's args: withoutRedirections keeps a quoted '>' as a
    // word, and programOf still drops any '>' word with the word after it (['-p', '>', '--bg', 'x'] gives
    // ['-p', 'x']); and a wrapper's own argument before claude (exec -a --bg claude) is none of claude's.
    const own = words.slice(words.findIndex((word) => programName(word) === 'claude') + 1);
    if (hasOption(own, '--bg') || hasOption(own, '--background')) return 'claude --bg';
    if (hasOption(own, '--cloud')) return 'claude --cloud';
    return args[0] === 'respawn' ? 'claude respawn' : null;
  }
  if (program !== 'js-harness') return null;
  if (args[0] === 'gate') return args.includes('--') ? launchOf(args.slice(args.indexOf('--') + 1)) : null;
  return args[0] === 'sessions' && args[1] === 'start' ? 'js-harness sessions start' : null;
}

/** The first step of the shell command `command` that launches a background session (`launchOf`), or null: every
 * simple command is read, joined however it is; text in quotes or in a heredoc's body is no step, so a command that
 * only names one (a grep, a commit message) launches none. */
export function backgroundLaunch(command) {
  const words = withoutRedirections(command);
  let start = 0;
  for (let i = 0; i <= words.length; i += 1) {
    if (i < words.length && !words.operators.has(i)) continue;
    let from = start;
    while (from < i && (COMMAND_KEYWORDS.has(words[from]) || CONDITIONS.has(words[from]))) {
      // `time` takes its options (`time -p`) before the command it times.
      const timed = words[from] === 'time';
      from += 1;
      while (timed && from < i && words[from].startsWith('-')) from += 1;
    }
    const launch = from < i ? launchOf(words.slice(from, i)) : null;
    if (launch !== null) return launch;
    start = i + 1;
  }
  return null;
}

/** Why a Bash step that launches a session out of his sidebar, `launch` (from `backgroundLaunch` above), is refused
 * in the project whose rules file has the text `projectData`, or null where the rule `sessions-open-in-sidebar` gives no value (T7, as below). */
export function backgroundLaunchRefusal(launch, projectData) {
  const rule = sidebarRule(projectData);
  if (rule === null) return null;
  const where = launch === 'claude --cloud' ? 'in the cloud' : 'in the background';
  return `js-harness guard: ${launch} opens a session ${where}, where he does not see it (rule sessions-open-in-sidebar). `
    + `Open it with ${rule.value} on a turn he typed, then detach_session to top level; on any other turn start_session `
    + `leaves a card he taps.${rule.note}`;
}

/** Why `js-harness sessions start` (a start or a `--resume`) is refused in the project whose rules file has the text
 * `projectData`, or null: where the rule `sessions-open-in-sidebar` gives a value, no session runs in the background,
 * out of his sidebar (odd/tasks/senior-orchestrator.md, T7: his words of 2026-11-15). */
export function backgroundStartRefusal(projectData) {
  const rule = sidebarRule(projectData);
  if (rule === null) return null;
  return 'js-harness sessions start: a session started or resumed here runs in the background, where he does not see it '
    + `(rule sessions-open-in-sidebar), so nothing ran. Open it with ${rule.value} on a turn he typed, then detach_session `
    + 'to top level; on any other turn start_session leaves a card he taps. A background session already on the machine '
    + `is resumed by a message to it, never restarted.${rule.note}`;
}
