// The warning for a whole test run started beside a gate: a `node --test` of several files run by hand while
// another gate holds the machine's lock shares its cores, and both miss their time bounds with every test
// green. On the night of 2026-10-14 JH 9 and JH 10 each started one. `js-harness guard --hook` (JH 15's)
// calls this for a Bash command and, by his decision (transcript `ffe99ebf`, line 5718), refuses the call with the line
// it answers (odd/tasks/test-run-warning.md). Since first-version T6a a heavy run is refused whatever its size:
// one file the gate log timed over a minute counts as several, and an eval batch's mark counts as a holder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readBatch } from './batch-mark.mjs';
import { readGateHolder } from './gate-lock.mjs';
import { GATE_COMMAND_MAX, gatesOf, readGateLog } from './gate-log.mjs';

/** A test file a gate ran alone for longer than this, by the gate log, is heavy: run beside a gate, it counts
 * as several files. Two such files ran beside gates past the protocol line, of 65 to 200 s, and one made a gate
 * fail (docs/FAILURES.md, heavy-run-beside-gate). */
export const HEAVY_FILE_SECONDS = 60;

/** The flags of `node --test` that take the next word as their value, so that word is no file. */
const VALUED = new Set(['--test-name-pattern', '--test-skip-pattern', '--test-reporter', '--test-reporter-destination', '--test-concurrency', '--test-timeout', '--test-shard', '--import', '--require', '-r', '--env-file']);

/** The commands of a command line, each as its words with quotes taken off. A command ends at `&&`, `||`,
 * `;`, `|`, `&`, `(`, `)` or a line break outside quotes: a `|` in a quoted pattern ends nothing (Codex,
 * 2026-10-14). A word keeps whether it held a wildcard outside quotes (`globbed`), which the shell expands. */
export function commandsOf(text) {
  const commands = [];
  let words = [];
  let word = null;
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };
  const source = String(text);
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' || char === "'") {
      const close = source.indexOf(char, i + 1);
      const inside = close === -1 ? source.slice(i + 1) : source.slice(i + 1, close);
      word ??= { text: '', globbed: false };
      word.text += inside;
      i = close === -1 ? source.length : close;
    } else if (char === '&' && (source[i - 1] === '>' || source[i - 1] === '<' || source[i + 1] === '>')) {
      // `2>&1`, `<&0`, `&>out`: a descriptor redirection ends no command (Codex, 2026-10-14).
      word ??= { text: '', globbed: false };
      word.text += char;
    } else if (/[;&|()\n]/.test(char)) {
      endCommand();
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      word ??= { text: '', globbed: false };
      word.text += char;
      if (char === '*' || char === '?') word.globbed = true;
    }
  }
  endCommand();
  return commands;
}

const isNode = (word) => /(^|[\\/])node(\.exe)?$/i.test(word?.text ?? '');

/** The commands a `js-harness gate` command runs after its `--`, each as its words, or `null` for a command that
 * is no gate: `js-harness gate ...` or `node .../js-harness.mjs gate ...`. One word after `--` is a command line
 * of its own, as `gate` reads it. */
export function gateCommands(words) {
  const at = /(^|[\\/])js-harness(\.mjs)?$/.test(words[0]?.text ?? '') ? 0 : isNode(words[0]) && /js-harness\.mjs$/.test(words[1]?.text ?? '') ? 1 : -1;
  if (at === -1 || words[at + 1]?.text !== 'gate') return null;
  const split = words.findIndex((word) => word.text === '--');
  if (split === -1) return [];
  const rest = words.slice(split + 1);
  return rest.length === 1 ? commandsOf(rest[0].text) : [rest];
}

/** The words a `js-harness gate` command runs after its `--`, all its commands' in one list (see `gateCommands`). */
function gateWraps(words) {
  return gateCommands(words)?.flat() ?? null;
}

/** The files the `node --test` of `words` names, as `{ files, names }`: `files` is `0` for none (every test
 * file the runner finds) and `Infinity` when one is a wildcard (several, as a rule), and `names` holds the words
 * that are files. `null` for words that run no `node --test`. */
function filesOf(words) {
  const [program, ...rest] = words;
  if (!isNode(program) || !rest.some((word) => word.text === '--test')) return null;
  let files = 0;
  const names = [];
  for (let i = 0; i < rest.length; i += 1) {
    const { text, globbed } = rest[i];
    if (VALUED.has(text)) i += 1;
    // A redirection is no file: `2>` (whose `&1` ended the command), `>` and its target, `>out.txt`.
    else if (/^\d*[<>]/.test(text)) {
      if (/^\d*[<>]+$/.test(text)) i += 1;
    } else if (!text.startsWith('-')) {
      files += globbed || text.includes('$') ? Infinity : 1;
      names.push(text);
    }
  }
  return { files, names };
}

/** A test file as the gate log and the guard both name it: from the folder the command ran in, with forward
 * slashes and no leading `./`. A file named by its whole path is named from `cwd`. A run from another folder of
 * the same tree names the file otherwise, and is then not matched: it stays free, as before T6a. */
function fileKey(name, cwd) {
  const whole = path.win32.isAbsolute(name) || path.posix.isAbsolute(name);
  const relative = whole && typeof cwd === 'string' ? path.relative(cwd, name) : name;
  return path.posix.normalize(relative.replace(/\\/g, '/')).replace(/^(\.\/)+/, '');
}

/** The repository of `cwd`, as the folder git keeps its objects in, shared by every worktree of it: the nearest
 * `.git` folder, or the one a worktree's `.git` file names (`gitdir: <common>/worktrees/<name>`). Read from files
 * only, since the guard runs on every Bash call; `null` where none is found. */
export function repositoryOf(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    const dotGit = path.join(dir, '.git');
    try {
      if (fs.statSync(dotGit).isDirectory()) return path.resolve(dotGit).toLowerCase();
      const named = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(dotGit, 'utf8'))?.[1];
      if (!named) return null;
      const gitdir = path.resolve(dir, named);
      return (path.basename(path.dirname(gitdir)) === 'worktrees' ? path.dirname(path.dirname(gitdir)) : gitdir).toLowerCase();
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') return null;
    }
    if (path.dirname(dir) === dir) return null;
  }
}

/** The longest that a gate of `events` (the gate log's, `readGateLog`) ran `file` alone: the `seconds` of the
 * end of each gate whose command is `gate ... -- node --test` of that one file, or `undefined` when none did. A
 * gate of several files times none of them, nor does a command the log cut at its length (`GATE_COMMAND_MAX`),
 * which may have lost every file after the first. */
export function timedSeconds(events, file, { project, projectOf = repositoryOf } = {}) {
  let longest;
  const projects = new Map();
  const sameProject = (cwd) => {
    if (project === undefined) return true;
    if (!projects.has(cwd)) projects.set(cwd, typeof cwd === 'string' ? projectOf(cwd) : null);
    return projects.get(cwd) === project;
  };
  for (const { start, end } of gatesOf(events)) {
    if (!start || !end || typeof start.command !== 'string' || !Number.isFinite(end.seconds)) continue;
    if (start.command.length >= GATE_COMMAND_MAX || !sameProject(start.cwd)) continue;
    const words = gateWraps([{ text: 'js-harness', globbed: false }, ...commandsOf(start.command).flat()]);
    const run = words === null ? null : filesOf(words);
    if (run?.files !== 1 || fileKey(run.names[0], start.cwd) !== file) continue;
    longest = Math.max(longest ?? 0, end.seconds);
  }
  return longest;
}

// The words a command line can hide a test run behind: `wsl.exe ... -- <command>` (or `-e <command>`), a
// shell's `-c "<command line>"`, and the keywords of a shell's `if`, `for` and `while` (JH 8, 2026-10-14: a
// whole run inside `wsl.exe -- sh -c "for f in ...; do node --test $f; done"`, whose `$f` was empty).
const WSL = /(^|[\\/])wsl(\.exe)?$/i;
const SHELL = /(^|[\\/])(sh|bash|dash|zsh)(\.exe)?$/i;
const KEYWORDS = new Set(['do', 'then', 'else', 'elif', '!', 'time', '{']);
const NPM = /(^|[\\/])npm(\.cmd|\.exe)?$/i;
// The words before a program that set its environment: `NAME=value`, and `env` with the options that take a value.
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const ENV_VALUED = new Set(['-u', '--unset', '-C', '--chdir']);

/** The index of the word a command runs at: past the keywords, the `NAME=value` words and `env` with its options
 * that come before it, so `FOO=1 env node --test` runs `node`. */
function programAt(words) {
  let at = 0;
  for (;;) {
    const text = words[at]?.text ?? '';
    if (KEYWORDS.has(text) || ASSIGNMENT.test(text)) at += 1;
    else if (text === 'env') {
      at += 1;
      while (words[at]?.text.startsWith('-')) at += ENV_VALUED.has(words[at].text) ? 2 : 1;
    } else return at;
  }
}

/** npm's names of its `test` command, and of the command that runs a script by its name. */
const NPM_TEST = new Set(['test', 'tst', 't']);
const NPM_RUN = new Set(['run', 'run-script', 'rum', 'urn']);
/** npm's options that take the next word as their value, which is npm's and never a word handed to the script. */
const NPM_WORKSPACE = /^(-w|-ws|--workspace|--workspaces|--include-workspace-root)(=.*)?$/;
const NPM_VALUED = new Set(['--loglevel', '--userconfig', '--globalconfig', '--cache', '--registry', '--script-shell', '--tag', '--include', '--omit', '--otp', '--node-options', '--before']);

/** The commands `npm test` or `npm run test` runs, as the sensors resolve them (bin/check.mjs, `testsCommand`): the
 * `test` script of the package.json in `cwd`, or in the folder `--prefix` names, whose last command takes the
 * words npm hands it, its positional words and those after `--`, as its files; `null` for any other words, and `[]`
 * where the folder names no test script. npm's other options are its own and are read past, with the value of those
 * that take one (`NPM_VALUED`). npm's workspaces (`-w`, `--workspace`, `--workspaces`, `-ws`,
 * `--include-workspace-root`) run scripts of other folders, which are not resolved here: such a command is
 * `{ every: true }`, a run of every test file, so none passes beside a held gate. Else the run is `{ commands, dir }`,
 * `dir` the folder its script runs in. */
function npmTestRun(words, cwd) {
  if (!NPM.test(words[0]?.text ?? '')) return null;
  let dir = cwd;
  let workspaces = false;
  const positional = [];
  let index = 1;
  for (; index < words.length && words[index].text !== '--'; index += 1) {
    const text = words[index].text;
    if (text === '--prefix') {
      index += 1;
      dir = path.resolve(cwd, words[index]?.text ?? '');
    } else if (text.startsWith('--prefix=')) dir = path.resolve(cwd, text.slice('--prefix='.length));
    else if (NPM_WORKSPACE.test(text)) {
      workspaces = true;
      if (text === '-w' || text === '--workspace') index += 1;
    } else if (NPM_VALUED.has(text)) index += 1;
    else if (!text.startsWith('-')) positional.push(words[index]);
  }
  const verb = NPM_RUN.has(positional[0]?.text) ? 1 : 0;
  if (verb === 1 ? positional[1]?.text !== 'test' : !NPM_TEST.has(positional[0]?.text)) return null;
  if (workspaces) return { every: true };
  let script;
  try {
    script = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))?.scripts?.test;
  } catch (err) {
    script = undefined;
  }
  const commands = typeof script === 'string' ? commandsOf(script) : [];
  const handed = [...positional.slice(verb + 1), ...words.slice(index + 1)];
  if (handed.length > 0 && commands.length > 0) commands[commands.length - 1] = [...commands[commands.length - 1], ...handed];
  return { commands, dir };
}

/** The command line a shell's `-c` runs, for words that start with a shell (`sh`, `bash`, `dash`, `zsh`), or `null`
 * for any other words or a shell with no `-c`. `-c` counts among the shell's options only, before a script or a
 * `--`, and within a cluster such as `-cl` (Codex, 2026-10-14). */
export function shellScript(words) {
  if (!SHELL.test(words[0]?.text ?? '')) return null;
  let flag = -1;
  for (let index = 1; index < words.length && /^-[a-zA-Z]+$/.test(words[index].text); index += 1) {
    if (words[index].text.includes('c')) flag = index;
  }
  return flag === -1 || words[flag + 1] === undefined ? null : words[flag + 1].text;
}

/** The files the first `node --test` of `commands` names (see `scan`), or `null` where there is none. */
function firstRun(commands, depth, cwd) {
  for (const inner of commands) {
    const found = scan(inner, depth, cwd);
    if (found !== null) return found;
  }
  return null;
}

/** The files the first `node --test` that `words` runs names (see `filesOf`), looking through `wsl.exe`, `sh -c`
 * and `npm test` (the test script of `cwd`), or `null` where there is none. A script a shell runs is not read. */
function scan(words, depth = 0, cwd = process.cwd()) {
  const rest = words.slice(programAt(words));
  if (rest.length === 0 || depth > 4 || gateWraps(rest) !== null) return null;
  if (WSL.test(rest[0].text)) {
    const split = rest.findIndex((word) => ['--', '-e', '--exec'].includes(word.text));
    return split === -1 ? null : scan(rest.slice(split + 1), depth + 1, cwd);
  }
  if (SHELL.test(rest[0].text)) {
    const script = shellScript(rest);
    return script === null ? null : firstRun(commandsOf(script), depth + 1, cwd);
  }
  const npm = npmTestRun(rest, cwd);
  if (npm?.every) return { files: 0, names: [] };
  if (npm !== null) {
    const found = firstRun(npm.commands, depth + 1, npm.dir);
    // A file of the script is its folder's: whole here, so the gate log is asked of it from the command's own (`fileKey`).
    return found === null ? null : { ...found, names: found.names.map((name) => path.resolve(npm.dir, name)) };
  }
  return filesOf(rest);
}

/** How many files the first `node --test` of `command` that runs outside `js-harness gate` names (see
 * `filesOf`), or `null` where there is none: a run that `js-harness gate --` wraps is in a turn. `cwd` is the
 * folder the command runs in, whose package.json names the test script of `npm test`. */
export function testRunFiles(command, cwd = process.cwd()) {
  return testRunOf(command, cwd)?.files ?? null;
}

/** The files of the first `node --test` of `command` that runs outside `js-harness gate`, as `filesOf` gives
 * them, or `null` where there is none. */
function testRunOf(command, cwd) {
  return firstRun(commandsOf(command), 0, cwd);
}

/** The warning for `command`, or `null`: one line, when the command runs, outside `js-harness gate --`, a
 * heavy `node --test` (of two or more files, of a wildcard or of none, every test file; or of one file the gate
 * log timed over `HEAVY_FILE_SECONDS`); is not inside a turn already (`JS_HARNESS_GATE_HELD=1`, or
 * `JS_HARNESS_CHECK_INNER=1` in a gate's sensor); and the machine's lock is held now (`readGateHolder`) or an
 * eval batch runs (`readBatch`). Any other single file stays free, as the skill says. `deps.holder` stands in
 * for the look at the lock and the batch, made only for a command that qualifies, and `deps.fileSeconds` for
 * the gate log's time of a file (`timedSeconds`), read only once the look found a holder; `deps.home` is the
 * home of both (`JS_HARNESS_HOME`, else the user's), and `deps.cwd` the folder the command runs in. */
export function testRunWarning(command, {
  env = process.env,
  home = env.JS_HARNESS_HOME || os.homedir(),
  cwd = process.cwd(),
  holder = () => readGateHolder(home) ?? readBatch(home),
  // Only gates of this repository time its files: the gate log is the machine's (Codex, 2026-10-16).
  fileSeconds = (file) => {
    const project = repositoryOf(cwd);
    return project === null ? undefined : timedSeconds(readGateLog(home).events, file, { project });
  },
} = {}) {
  const run = testRunOf(command, cwd);
  if (run === null) return null;
  if (env.JS_HARNESS_GATE_HELD === '1' || env.JS_HARNESS_CHECK_INNER === '1') return null;
  const held = holder();
  if (!held) return null;
  let what;
  if (run.files === 1) {
    const file = fileKey(run.names[0], cwd);
    const seconds = fileSeconds(file);
    if (!(seconds > HEAVY_FILE_SECONDS)) return null;
    what = `${file}, which the gate log timed at ${seconds} s,`;
  } else {
    what = run.files === 0 ? 'every test file' : run.files === Infinity ? 'several test files' : `${run.files} test files`;
  }
  // One file at a time is a way out only for a run of several; a heavy file waits.
  const several = run.files !== 1;
  if (held.batch) {
    return `node --test of ${what} starts outside a turn while the eval batch of ${held.cwd} runs: both share the cores and miss their bounds; wait for the batch to end${several ? ', or run one file at a time' : ''}`;
  }
  const whose = held.cwd ? `the gate of ${held.cwd}` : 'another gate';
  return `node --test of ${what} starts outside a turn while ${whose} holds the machine's gate lock: both share the cores and miss their bounds; run it with js-harness gate -- <command>, ${several ? 'or one file at a time' : 'which waits its turn'}`;
}
