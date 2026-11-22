// A session's stop line in cache-read tokens (odd/tasks/spend-stop.md): `js-harness spend --self --line <N>` records
// it once, beside the session's pause state, and `js-harness guard --hook` reads it before each step, so a session
// stops at the line its brief gave without remembering the line or reading its own figure. Tonight's sessions ran to
// their caps, or stopped at half of them, because each read its spend by hand (the measure of 2026-11-21).
//
// The guard runs on every tool call of every session, so a session with no line costs one existence check and reads
// no transcript; whatever cannot be read throws, and the guard lets the call run. Past the line the calls that write
// the session's state (a Read, Write or Edit of a Markdown file), a lone `js-harness notify` and a lone `js-harness loop stop` still pass, so the refusal
// never traps a session before it can say where it stopped.
import fs from 'node:fs';
import path from 'node:path';
import { isSessionId } from './session-id.mjs';
import { spendOf } from './transcript-requests.mjs';
import { shellWords } from './guard.mjs';
import { programOf } from './chained-step-guard.mjs';

/** A line that would raise the one recorded: refused, since the line is the brief's, not the session's to move. */
export class StopLineError extends Error {}

const SUFFIX = { '': 1, k: 1_000, m: 1_000_000 };

/** The token count `text` writes, as digits or with a K or M suffix (`20M`, `1.5M`, `500K`), or null. */
export function parseStopLine(text) {
  const match = /^(\d+(?:\.\d+)?)([kKmM]?)$/.exec(String(text ?? '').trim());
  if (match === null) return null;
  const value = Math.round(Number(match[1]) * SUFFIX[match[2].toLowerCase()]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** The file of a session's stop line: `<home>/.js-harness/channel/spend/<sessionId>.json`, beside the pause state.
 * A session id that is not of the shape of one throws, since it becomes a file name. */
export function stopLinePath(home, sessionId) {
  if (!isSessionId(sessionId)) throw new TypeError(`not a session id: ${JSON.stringify(sessionId)}`);
  return path.join(home, '.js-harness', 'channel', 'spend', `${sessionId}.json`);
}

/** The line recorded for the session, or null where none is or the file cannot be read as one. */
export function readStopLine(home, sessionId, { readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  try {
    const value = JSON.parse(readFile(stopLinePath(home, sessionId)))?.line;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Records `line` for the session and returns `{ line, previous }`. A line is the session's for good: the same line
 * again changes nothing, and any other throws `StopLineError` unless `raise` is set, which only the lead's
 * `spend <session> --line <N> --raise` passes (odd/tasks/spend-stop.md, T5). The file is written whole through a
 * temporary file. */
export function recordStopLine({ home, sessionId, line, now = () => new Date(), raise = false }) {
  const file = stopLinePath(home, sessionId);
  const previous = readStopLine(home, sessionId);
  if (previous === line) return { line, previous };
  if (previous !== null && !raise) throw new StopLineError(`this session's stop line is ${previous}, recorded once: only the lead moves it (js-harness spend ${sessionId} --line <tokens> --raise)`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ line, setAt: now().toISOString() })}\n`);
  fs.renameSync(temporary, file);
  return { line, previous };
}

/** What the session of transcript `file` (session `id`) spent: `spendOf` over the main transcript and each sub-agent
 * file, with `subagentFiles` read and `unreadSubagentFiles` left out. The main transcript that cannot be read throws. */
export function sessionSpend({ file, id, readFile = (one) => fs.readFileSync(one, 'utf8'), readdir = (dir) => fs.readdirSync(dir) }) {
  const mainText = readFile(file);
  const subagentDir = path.join(path.dirname(file), id, 'subagents');
  let names = [];
  try {
    names = readdir(subagentDir).filter((name) => /^agent-.+\.jsonl$/.test(name)).sort();
  } catch {
    // No sub-agent folder: the session started none.
  }
  const subagentTexts = [];
  let unreadSubagentFiles = 0;
  for (const name of names) {
    try {
      subagentTexts.push(readFile(path.join(subagentDir, name)));
    } catch {
      unreadSubagentFiles += 1;
    }
  }
  return { ...spendOf(mainText, subagentTexts), subagentFiles: subagentTexts.length, unreadSubagentFiles };
}

// The literal a brief or a lead's message writes for a session's line, read by one parser (odd/tasks/spend-stop.md, T4).
// It stands on a line of its own, or ends the text after a sentence (the one-line prompt `sessions start` gives), so a
// literal quoted inside a sentence for another session ("tell JH 5: Stop at 20M cache-read") records nothing.
const LITERAL = /^[ \t]*stop at (\d+(?:\.\d+)?[km]?) cache-read\.?[ \t]*\r?$|\. stop at (\d+(?:\.\d+)?[km]?) cache-read\.?\s*(?![\s\S])/im;
// A brief is the session's own text, never a relayed one, so `sessions start` reads the literal anywhere in it.
const IN_BRIEF = /(?:^|[^\w-])stop at (\d+(?:\.\d+)?[km]?) cache-read\b/i;

/** The stop line the text `text` names with the literal "Stop at <N> cache-read" (`20M`, `1.5M`, `500K` or digits),
 * or null: a looser wording ("a 20M cap") names none, so a line is never guessed from prose. With `brief`, the
 * literal counts anywhere in the text. */
export function stopLineIn(text, { brief = false } = {}) {
  const match = (brief ? IN_BRIEF : LITERAL).exec(String(text ?? ''));
  return match === null ? null : parseStopLine(match[1] ?? match[2]);
}

// A cross-session message as the host hands it to the receiving session, closed or cut off at the end of the prompt.
const MESSAGE = /<cross-session-message\b([^>]*)>[\s\S]*?(?:<\/cross-session-message>|(?![\s\S]))/g;
const SENDER = /\bfrom-name="([^"]*)"/;

/** The prompt `prompt` with every cross-session message whose sender `isLeadTitle` does not read as the lead's taken
 * out: a brief one session relays to another (JH PLAN's draft sent to the lead) names the line of the session it is
 * for, never the one that carries it (odd/tasks/spend-stop.md, L9). */
function ownText(prompt, isLeadTitle) {
  return String(prompt ?? '').replace(MESSAGE, (whole, attributes) => (isLeadTitle(SENDER.exec(attributes)?.[1] ?? '') ? whole : '\n'));
}

/** The line the UserPromptSubmit payload `payload` records for its session, or null where it records none: another
 * event, a sub-agent's prompt, no session id of the right shape, no literal in the prompt, or a line already recorded,
 * which a later prompt never moves. A start_session's first prompt and a cross-session message both reach this hook
 * (odd/tasks/spend-stop.md, L5), so a session's line is recorded with no step of its own; a message counts only when
 * `isLeadTitle` reads its sender's title as the lead's, and with no `isLeadTitle` none does. */
export function recordPromptLine(payload, { home, now, isLeadTitle = () => false } = {}) {
  if (payload?.hook_event_name !== 'UserPromptSubmit' || !isSessionId(payload.session_id)) return null;
  if (typeof payload.agent_id === 'string' && payload.agent_id !== '') return null;
  const line = stopLineIn(ownText(payload.prompt, isLeadTitle));
  if (line === null || readStopLine(home, payload.session_id) !== null) return null;
  recordStopLine({ home, sessionId: payload.session_id, line, ...(now ? { now } : {}) });
  return line;
}

const slashed = (text) => String(text ?? '').replace(/\\/g, '/').toLowerCase();
// The spend folder named anywhere, or the home's folders above it named whole.
const NAMES_FOLDER = /\.js-harness\/+channel\/+spend(?:\/|\b)/;
const ABOVE_WHOLE = /\.js-harness(?:\/+channel)?\/*$/;
// The programs that only read what they name, so a session may look at its line; and those that remove or move.
// Not rg, whose --pre runs a program on each file, nor a pager, which can start a shell.
const READERS = new Set(['cat', 'ls', 'dir', 'head', 'tail', 'wc', 'stat', 'file', 'grep', 'type', 'get-content', 'gc', 'get-childitem', 'gci', 'get-item', 'test-path']);
// A word the shell expands (`$x`, `$_`, `$(`, a backtick, cmd's `%x%`): what it names is not read from the call.
const EXPANDS = /\$|`|%\w+%/;
const WHOLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The simple commands of the split words `words`, each as `{ step, piped }`: its words, and the index of the
 * pipeline it belongs to (steps joined by `|` share one). */
function stepsOf(words) {
  const steps = [];
  let start = 0;
  let pipeline = 0;
  for (let at = 0; at <= words.length; at += 1) {
    if (at < words.length && !words.operators.has(at)) continue;
    if (at > start) steps.push({ step: words.slice(start, at), piped: pipeline });
    if (at < words.length && words[at] !== '|') pipeline += 1;
    start = at + 1;
  }
  return steps;
}
const REMOVERS = new Set(['rm', 'rmdir', 'mv', 'del', 'erase', 'rd', 'move', 'remove-item', 'ri', 'move-item', 'ren', 'rename-item']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'mcp__terminal__run_in_terminal']);

/** Whether the shell command `command` (slashed and lower-cased) writes, removes or moves the spend folder. A command
 * that names the folder passes only when every step of each pipeline that names it is a reader (`READERS`) and no
 * word of it expands (`EXPANDS`: `rm "$_"` after an `ls` of the folder); a remover of a folder above it, or a
 * redirection into it, is refused too. A command that cannot be split is read as one that does. */
function shellTouches(command) {
  if (!/\.js-harness/.test(command)) return false;
  let words;
  try {
    words = shellWords(command, { groups: true, redirections: true });
  } catch {
    return true;
  }
  for (const at of words.redirections) if (NAMES_FOLDER.test(words[at + 1] ?? '') || ABOVE_WHOLE.test(words[at + 1] ?? '')) return true;
  const steps = stepsOf(words);
  const named = new Set(steps.filter(({ step }) => step.some((word) => NAMES_FOLDER.test(word))).map(({ piped }) => piped));
  if (named.size > 0 && (EXPANDS.test(command) || /<\(|>\(/.test(command))) return true;
  for (const { step, piped } of steps) {
    const { program } = programOf(step);
    if (named.has(piped) && !READERS.has(program)) return true;
    if (REMOVERS.has(program) && step.some((word) => ABOVE_WHOLE.test(word))) return true;
  }
  return false;
}

/** Whether the shell command `command` (slashed and lower-cased) has a step `js-harness spend ... --raise` that does
 * not name, as a literal whole id, a session other than `sessionId`, the one that runs it: the host sets the hook's
 * `session_id`, which a worker cannot, so its own raise is refused here whatever it puts in CLAUDE_CODE_SESSION_ID or
 * its title (odd/tasks/spend-stop.md, L9). A heredoc's text is no step; a `bash -c` or `eval` script is not read. */
function raisesOwnLine(command, sessionId) {
  if (!/spend/.test(command) || !/--raise/.test(command)) return false;
  let words;
  try {
    words = shellWords(command, { groups: true, redirections: true });
  } catch {
    return true;
  }
  return stepsOf(words).some(({ step }) => {
    const { program, args } = programOf(step);
    if (program !== 'js-harness' || args[0] !== 'spend' || !args.includes('--raise')) return false;
    const named = args.slice(1).filter((arg, at, rest) => !arg.startsWith('-') && rest[at - 1] !== '--line');
    return named.length !== 1 || !WHOLE_ID.test(named[0]) || named[0] === String(sessionId ?? '').toLowerCase() || step.some((word) => EXPANDS.test(word));
  });
}

/** Why the PreToolUse call of `payload` is refused for touching the stop lines, or null: a Write, Edit, MultiEdit or
 * NotebookEdit of a file in the spend folder, a Bash or terminal command that writes, removes or moves that folder or
 * removes the folders above it (`shellTouches`; a read passes), or one that raises the running session's own line
 * (`raisesOwnLine`), for every session, with or without a line, read from the call alone (odd/tasks/spend-stop.md,
 * T5, L9). A path the shell computes (`$HOME`, a variable, `eval`, a `cd` then a relative path) is not read, nor a
 * script file a command runs. */
export function lineFileRefusal(payload, { home } = {}) {
  const tool = payload?.tool_name;
  const input = payload?.tool_input;
  let touches = false;
  if (WRITE_TOOLS.has(tool)) {
    const file = slashed(path.resolve(String(input?.file_path ?? input?.notebook_path ?? '')));
    const folder = slashed(path.resolve(path.dirname(stopLinePath(home, '00000000-0000-0000-0000-000000000000'))));
    touches = file.startsWith(`${folder}/`) || NAMES_FOLDER.test(file);
  } else if (SHELL_TOOLS.has(tool)) {
    const command = slashed(input?.command);
    if (raisesOwnLine(command, payload?.session_id)) return 'js-harness guard: this step raises the stop line of the session that runs it, or of a session the shell computes: no session raises its own line; the lead raises it, naming the session whole (js-harness spend <session> --line <tokens> --raise)';
    touches = shellTouches(command);
  }
  return touches ?'js-harness guard: this step writes or removes a session\'s stop line (the spend folder under the harness home), which no session touches: a line is recorded once, and only the lead moves it (js-harness spend <session> --line <tokens> --raise)' : null;
}

// The files a session past its line may still read and write: its state (`*state.md`) and a feature document.
const STATE_FILE = /(?:^|\/)[^/]*state\.md$|(?:^|\/)odd\/tasks\/[^/]+\.md$/;

/** Whether the words of one simple command, `words`, are a step that closes the work: `cd`, `git add`, `git commit`
 * (plain or through `js-harness gate --`), `git push`, `gh pr create|edit|ready`, `js-harness notify` or
 * `js-harness loop stop`. */
function closingStep(words) {
  const { program, args } = programOf(words);
  if (program === 'cd') return true;
  // A push takes only these options: another, or git's prefix of one (`--receive=`, `--exe=`), may run a command.
  if (args[0] === 'push' && program === 'git') return args.slice(1).every((arg) => !arg.startsWith('-') || /^(?:-u|-q|--quiet|--set-upstream|--force-with-lease(?:=.*)?)$/.test(arg));
  if (program === 'git') return ['add', 'commit'].includes(args[0]);
  if (program === 'gh') return args[0] === 'pr' && ['create', 'edit', 'ready'].includes(args[1]);
  if (program !== 'js-harness') return false;
  if (args[0] === 'gate') return args[1] === '--' && programOf(args.slice(2)).program === 'git' && programOf(args.slice(2)).args[0] === 'commit';
  return args[0] === 'notify' || (args[0] === 'loop' && args[1] === 'stop');
}

/** Whether the call still passes past the line, so the work is never stranded (the lead's decision, L4): a Read,
 * Write or Edit of a state file or a feature document, or a Bash command whose every simple command is a closing step
 * (`closingStep`), joined by any operator, with no subshell, redirection or substitution (`$(`, a backtick, `<(`)
 * anywhere, quoted text too. TaskStop is not in the guard's matcher, so a session can always stop its background
 * tasks. */
function passesAtStop(tool, input) {
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit') return STATE_FILE.test(slashed(String(input?.file_path ?? '').trim()));
  if (tool !== 'Bash') return false;
  const command = String(input?.command ?? '');
  if (/`|\$\(|<\(|>\(/.test(command)) return false;
  let words;
  try {
    words = shellWords(command, { groups: true, redirections: true });
  } catch {
    return false;
  }
  if (words.redirections.size > 0 || words.some((word, at) => words.operators.has(at) && (word === '(' || word === ')'))) return false;
  let start = 0;
  let steps = 0;
  for (let at = 0; at <= words.length; at += 1) {
    if (at < words.length && !words.operators.has(at)) continue;
    if (at > start) {
      if (!closingStep(words.slice(start, at))) return false;
      steps += 1;
    }
    start = at + 1;
  }
  return steps > 0;
}

/** Why the PreToolUse call of `payload` is refused for the session's spend, or null. Null with no read of the
 * transcript where the payload names no session or no line is recorded for it; a transcript that cannot be read
 * throws, for the guard to let the call run. */
export function spendStopRefusal(payload, { home, exists = fs.existsSync, readFile, readdir } = {}) {
  const sessionId = payload?.session_id;
  const transcript = payload?.transcript_path;
  if (!isSessionId(sessionId) || typeof transcript !== 'string' || transcript === '') return null;
  if (!exists(stopLinePath(home, sessionId))) return null;
  const line = readStopLine(home, sessionId, readFile === undefined ? {} : { readFile });
  if (line === null || passesAtStop(payload.tool_name, payload.tool_input)) return null;
  const spend = sessionSpend({ file: transcript, id: sessionId, ...(readFile ? { readFile } : {}), ...(readdir ? { readdir } : {}) });
  const figure = spend.main.cacheReadTokens + spend.subagents.cacheReadTokens;
  if (figure < line) return null;
  const n = (value) => value.toLocaleString('en-US');
  return `js-harness guard: this session has spent ${n(figure)} cache-read (main ${n(spend.main.cacheReadTokens)}, sub-agents ${n(spend.subagents.cacheReadTokens)}), past its stop line ${n(line)} (js-harness spend --self --line): write your state and stop. Still passing: a Read, Write or Edit of a *state.md file or an odd/tasks document, and a command made only of cd, git add, git commit (plain or through js-harness gate --), git push, gh pr create|edit|ready, js-harness notify and js-harness loop stop, joined by && or ;, with no ( ), redirection, \` or $( anywhere, quoted text too. Only the lead moves the line (js-harness spend ${sessionId} --line <tokens> --raise)`;
}
