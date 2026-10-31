// The guard's check of a step chained to the one before it (odd/tasks/guard-chained-steps.md; rule chained-steps;
// failure chained-step-not-conditional, 10 sightings): a push, a commit, a pull request command, a land or a notice
// joined to the step before by `;`, a line break, `||` or `&` runs whatever that step answered. `js-harness guard
// --hook` asks it of every Bash command (bin/guard.mjs), and reads the project's rules only for a command it finds
// chained. It reads the command through `shellWords` of ./guard.mjs, the splitter the guard's other Bash checks share.
import { guardHeld, ruleHere } from './rules.mjs';
import { COMMAND_KEYWORDS, WRAPPERS, shellWords } from './guard.mjs';

// The keywords whose body runs on a condition the command states: a step right after one is joined by nothing.
const CONDITION_BODIES = new Set(['then', 'else', 'do']);
// The keywords a condition's command follows, looked through: `a; if git push; then` runs the push after `a`.
const CONDITIONS = new Set(['if', 'elif', 'while', 'until']);
// How the refusal names each joiner; shellWords writes an unquoted line break as a `;`.
const JOINERS = { ';': 'a ; or a line break', '||': '||', '&': '&' };

// The options of each wrapper, and of git before its verb, that take the next word as their value.
const VALUE_OPTIONS = {
  env: new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']),
  sudo: new Set(['-u', '--user', '-g', '--group', '-C', '--close-from', '-h', '--host', '-p', '--prompt', '-D', '--chdir', '-r', '--role', '-t', '--type', '-U', '--other-user']),
  exec: new Set(['-a']),
  command: new Set(),
  nohup: new Set(),
  timeout: new Set(['-s', '--signal', '-k', '--kill-after']),
  nice: new Set(['-n', '--adjustment']),
  time: new Set(['-f', '--format', '-o', '--output']),
  npx: new Set(['-p', '--package', '-c', '--call']),
  git: new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix']),
};
// A redirection that starts a word (`>f`, `2>f`, `<f`, `>>f`); one with no file in it takes the next word.
const REDIRECTION = /^\d*(?:>>?|<)(.*)$/;

/** The index of the first word of `segment` from `at` that is no option of `program` (`VALUE_OPTIONS`), its values
 * and an ending `--` taken; for a wrapper, no assignment either. */
function pastOptions(segment, at, program) {
  while (at < segment.length) {
    const word = segment[at];
    if (word === '--') return at + 1;
    if (word.startsWith('-') && word !== '-') at += VALUE_OPTIONS[program].has(word) ? 2 : 1;
    else if (program !== 'git' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) at += 1;
    else return at;
  }
  return at;
}

/** The step the words of one simple command take, among those whose check must be read first: `git push`, `git commit`,
 * `gh pr`, `js-harness merge-queue` or `js-harness notify`, or null. It looks through assignments, redirections,
 * wrappers and their options, git's options before its verb, `node <path>/js-harness.mjs`, `npx` and
 * `js-harness gate --`. */
function guardedStep(words) {
  const segment = [];
  for (let i = 0; i < words.length; i += 1) {
    const redirection = REDIRECTION.exec(words[i]);
    if (redirection === null) segment.push(words[i]);
    else if (redirection[1] === '' || redirection[1] === '&') i += 1;
  }
  // A program's name: its file's, the extension and an npm version (`js-harness@latest`) taken off.
  const name = (word) => String(word ?? '').split(/[\\/]/).pop().toLowerCase().replace(/\.(?:exe|cmd|mjs)$/, '').replace(/(.)@.*$/, '$1');
  let at = 0;
  while (at < segment.length) {
    const program = name(segment[at]);
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(segment[at])) at += 1;
    else if (WRAPPERS.has(segment[at]) || program === 'nice') at = pastOptions(segment, at + 1, program);
    // timeout runs the command after its options and its duration.
    else if (program === 'timeout') at = pastOptions(segment, at + 1, program) + 1;
    else if (program === 'npx') at = pastOptions(segment, at + 1, program);
    else if (program === 'pnpm' && (segment[at + 1] === 'exec' || segment[at + 1] === 'dlx')) at = pastOptions(segment, at + 2, 'command');
    else break;
  }
  if (name(segment[at]) === 'node' && name(segment[at + 1]) === 'js-harness') at += 1;
  const program = name(segment[at]);
  const args = segment.slice(at + 1);
  if (program === 'git') {
    const verb = args[pastOptions(args, 0, 'git')];
    return verb === 'push' || verb === 'commit' ? `git ${verb}` : null;
  }
  if (program === 'gh') return args[0] === 'pr' ? 'gh pr' : null;
  if (program !== 'js-harness') return null;
  if (args[0] === 'gate') return args.includes('--') ? guardedStep(args.slice(args.indexOf('--') + 1)) : null;
  return args[0] === 'merge-queue' || args[0] === 'notify' ? `js-harness ${args[0]}` : null;
}

/** The first step of the shell command `command` whose check must be read before it runs, and that follows another
 * step by a joiner that runs it whatever that step answered, as `{ step, joiner }`, or null. `;` and a line break
 * run it after any answer, `||` only after a failure and `&` beside the step, never waiting; `&&` runs it only on a
 * success, and `|` feeds it the step's output (odd/tasks/guard-chained-steps.md, S3). A line break right after `&&`,
 * `||` or `|` continues that command, so the first operator between two steps is their joiner; a group's `(` and `)`
 * are none. A step that is the body of `then`, `else` or `do` runs on a condition the command states. Text in quotes
 * or in a heredoc's body is no step, so neither is a `-Command` argument of PowerShell. */
export function chainedStep(command) {
  const words = shellWords(command, { groups: true });
  const { operators } = words;
  let joiner = null;
  let before = false;
  for (let i = 0; i < words.length; i += 1) {
    if (operators.has(i)) {
      if (joiner === null && words[i] !== '(' && words[i] !== ')') joiner = words[i];
      continue;
    }
    if (CONDITION_BODIES.has(words[i])) {
      joiner = null;
      continue;
    }
    // `time` prefixes a command, a group or a negation, after its options (`time -p`) (Codex, on 06869de9).
    if (words[i] === 'time') {
      while (i + 1 < words.length && !operators.has(i + 1) && words[i + 1].startsWith('-')) i += VALUE_OPTIONS.time.has(words[i + 1]) ? 2 : 1;
      continue;
    }
    if (COMMAND_KEYWORDS.has(words[i]) || CONDITIONS.has(words[i])) continue;
    let end = i;
    while (end < words.length && !operators.has(end)) end += 1;
    const step = guardedStep(words.slice(i, end));
    if (step !== null && before && Object.hasOwn(JOINERS, joiner)) return { step, joiner };
    before = true;
    joiner = null;
    i = end - 1;
  }
  return null;
}

/** Why the Bash command `command` is refused for a step chained to the one before it, or null (`chainedStep`). Only
 * where the rule chained-steps is declared (`projectData`, the text of the project's rules file), as terminal-note
 * is; behind one that declares it, the copy's value is held (`guardHeld`). Row 67 of the lead's duties failed 10
 * times: twice a push the pre-push hook refused was followed by a notice that said "pushed". */
export function chainedStepRefusal(command, projectData) {
  const chained = chainedStep(command);
  if (chained === null) return null;
  const rule = guardHeld('chained-steps', ruleHere('chained-steps', undefined, projectData));
  if (rule === null) return null;
  const { step, joiner } = chained;
  return `js-harness guard: ${step} follows the step before it by ${JOINERS[joiner]}, so it runs whatever that step `
    + `answered (rule chained-steps: two steps share one command only joined by ${rule.value}). Join them with `
    + `${rule.value} (a heredoc's command takes it on its first line: cat > f <<'EOF' ${rule.value} git commit -F f), `
    + `or run ${step} in a call of its own once the answer of the step before is read.${rule.note}`;
}
