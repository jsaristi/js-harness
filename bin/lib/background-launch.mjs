// A session opened in the background runs where the user does not see it (odd/tasks/senior-orchestrator.md, T7: his
// words of 2026-11-15 and 2026-11-16, "nunca debemos permitir eso", "no se puede abrir ninguna sesion en segundo
// plano"). Where the rule sessions-open-in-sidebar is declared, the guard refuses a Bash or Terminal step that launches
// `claude --bg` or `js-harness sessions start`, and the command refuses itself. It lives apart from ./guard.mjs, which
// is at a module's size limit (bin/conventions-structure.test.mjs).
import { COMMAND_KEYWORDS, shellWords, sidebarRule } from './guard.mjs';
import { programOf } from './chained-step-guard.mjs';

// The keywords that open a condition: the command after one is a step of its own.
const CONDITIONS = new Set(['if', 'elif', 'while', 'until']);

// The options of xargs, GNU's and BSD's, that take the next word as their value.
const XARGS_VALUES = new Set(['-n', '-L', '-P', '-s', '-d', '-E', '-a', '-I', '-J', '-R', '-S', '--max-args', '--max-lines', '--max-procs', '--max-chars', '--delimiter', '--eof', '--arg-file', '--replace']);

// A redirection's operator at a word's start: `>`, `>>`, `<`, with a descriptor (`2>`) or `&` (`&>`) before it.
const REDIRECT = /^(?:\d+|&)?(?:>>?|<)/;

/** `words` without their redirections (Codex P2 of 2026-11-17): an operator alone takes the next word as its target,
 * one written against its target goes with it, and one written after a word (`--bg>log`, `claude>log`) leaves that
 * word. */
function withoutRedirections(words) {
  const kept = [];
  for (let at = 0; at < words.length; at += 1) {
    const lead = REDIRECT.exec(words[at]);
    if (lead !== null) {
      if (lead[0] === words[at]) at += 1;
      continue;
    }
    const cut = words[at].search(/[<>]/);
    kept.push(cut > 0 ? words[at].slice(0, cut) : words[at]);
  }
  return kept;
}

/** Whether `args` hold the option `name`, alone or with its value after `=`. */
const hasOption = (args, name) => args.some((arg) => arg === name || arg.startsWith(`${name}=`));

/** The launch of a session out of his sidebar the words of one simple command make, or null
 * (odd/tasks/senior-orchestrator.md, T7): `claude --bg`, `claude respawn` (which restarts background sessions),
 * `claude --cloud`, or `js-harness sessions start`, behind `js-harness gate --` or `xargs` too. The guard reads
 * launches written out in an ordinary shape; text the shell computes (`eval`, `$C`, `bash -c`) it does not read. */
function launchOf(words) {
  const { program, args } = programOf(withoutRedirections(words));
  if (program === 'xargs') {
    let at = 0;
    while (at < args.length && args[at].startsWith('-')) at += XARGS_VALUES.has(args[at]) ? 2 : 1;
    return launchOf(args.slice(at));
  }
  if (program === 'claude') {
    if (hasOption(args, '--bg') || hasOption(args, '--background')) return 'claude --bg';
    if (hasOption(args, '--cloud')) return 'claude --cloud';
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
  const words = shellWords(command, { groups: true });
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
 * out of his sidebar (odd/tasks/senior-orchestrator.md, T7: his words of 2026-11-15 and 2026-11-16). */
export function backgroundStartRefusal(projectData) {
  const rule = sidebarRule(projectData);
  if (rule === null) return null;
  return 'js-harness sessions start: a session started or resumed here runs in the background, where he does not see it '
    + `(rule sessions-open-in-sidebar), so nothing ran. Open it with ${rule.value} on a turn he typed, then detach_session `
    + 'to top level; on any other turn start_session leaves a card he taps. A background session already on the machine '
    + `is resumed by a message to it, never restarted.${rule.note}`;
}
