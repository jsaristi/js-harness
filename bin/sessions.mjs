#!/usr/bin/env node
// `sessions`: a board of the project's recent Claude Code sessions, from facts on disk — each one's state,
// the background work it still has open and the tail of its last reply — next to the worktrees, the
// running gates and the open pull requests. See odd/tasks/session-board.md. The facts are computed by
// bin/lib/sessions.mjs; this file only finds the folders, reads them and runs `git`, `gh` and one process
// listing. Read-only: it opens files for reading and signals no process, because it runs while other
// sessions work in the same checkout. The one thing it writes is a line of the channel's record when a
// session reads its opening (`--opening`), which says which session read which title; `start` and `stop` (./sessions-background.mjs) write theirs.
// Zero dependencies; `--json` gives the same data as the text.
// `--watch` takes the same board again and again and returns when two of them differ in a way that needs
// a decision, so a session can wait on the others without spending anything while nothing happens.
// The board also prints the relief file of the session that orchestrates the others (its path and last
// lines): that session writes it, this command only reads it.
// The gates come from two sources: the process listing, which shows every `check` process, and the
// machine's gate lock (bin/lib/gate-lock.mjs), which says which of them runs its sensors and which wait
// for their turn. Both are read, neither is written. A gate of a checkout from before the lock asks for
// no turn and runs whenever it is started: it is told apart by the lock's library, which is beside the
// script of a gate that knows the lock and of no other (`lockLibraryBesideScript`).
// The roster is those sessions again, a row per title with the role the title gives (odd/tasks/
// session-channel.md): computed at each read, stored nowhere. `--address <role>` answers with the title
// of the one other session that holds a role, which is where a message to that role goes; it reads the
// transcripts and nothing of the machine, so it costs no `git`, no `gh` and no process listing.
// The channel is the record `notify` writes under the harness home (bin/lib/channel.mjs): the board
// prints its last notices and the last messages between sessions, gives a session opened from the phone
// the title of the opening it read, and a watch returns for a notice written to the orchestrator.
// "Open questions" are the questions a session put to the user with the host's question tool that have
// no answer of his, read from the same transcripts (odd/tasks/session-channel.md, point 15): one he closed
// without answering, one still on his screen. A call the host copied into several files is one question,
// and one asked again and answered then is not listed. A watch returns for a question he closes.
// The list also joins the questions the channel's record holds (`notify --kind question`), by the number at
// the head of their text: recorded and not shown to him yet, on his screen, closed by him, or answered in a
// transcript and not carried to the asker yet. A question answered in the asker's own transcript is closed.
// A session's row says a tool call that has had no result for fifteen minutes, since the host may be holding
// it for approval or it hangs, and a watch returns for it once and again each time its age doubles (point 15).
// A session's row says the context it holds, the room left before the host compacts it and what its last
// task cost (odd/tasks/session-channel.md, "Context"): what a session needs at the context pause to judge
// whether what is left fits. A watch returns once when a session reaches the pause. The share of the window
// the pause is, and the share where the host compacts, are each one constant of bin/lib/sessions.mjs
// (`DEFAULT_CONTEXT_PAUSE_PERCENT`, `DEFAULT_CONTEXT_COMPACTION_PERCENT`): no text here writes either.
// `--opening <title>` prints the opening stored for a session, and `--quote <transcript> <line>` the
// entry at a line of a transcript only when the user sent it: the check a session runs before it takes
// words another session carried as his. What he sent is what he typed, and what he answered to a question
// the session asked with the host's question tool, tapped or typed.
// `--measures` judges each compaction of the transcripts in the window once (odd/tasks/session-channel.md,
// section 14): told, from the state the pause hook keeps (`toldBetween`, bin/lib/pause.mjs); kept, from the
// commits of the feature document (`keptByGitLog`, bin/lib/measures.mjs) and, for the orchestrator alone, from a
// line of its relief file (`keptByRelief`). No reply's block of the bare command is a fact: the user no longer compacts by hand.
// It runs `git log` of that document and nothing else of the machine: no worktree, pull request or gate.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { POWERSHELL_ROW_FUNCTION } from './lib/process-tree.mjs';
import { boardMemory } from './lib/memory-hygiene.mjs';
import { appRoot, appSessions } from './lib/app-record.mjs';
import { readGateHolder, readGateWaiters } from './lib/gate-lock.mjs';
import { readTickets } from './lib/gate-first.mjs';
import { appendReading, findOpenings, newReading, nextSessionNumber, readNotices, recordPath, recordedQuestions, reliefPath, senderOf } from './lib/channel.mjs';
import { dayStartOf, keptByGitLog, keptByRelief, keptEither, localDay, measuresLines, measuresTotal, reliefLines, reliefMeasures, reliefsTotal, reopenCandidates, reopenLines } from './lib/measures.mjs';
import { toldBetween } from './lib/pause.mjs';
import { ruleValue } from './lib/rules.mjs';
import { readStalled } from './lib/stall.mjs';

// How long a work session that holds handed work may go with no commit, notice or gate: the declared rule.
const STALL_MINUTES = ruleValue('session-stall', 'minutes');
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, NOT_VISIBLE, boardChanges, channelOf, compactionMeasures, hostsOf, compactionMissOf, openQuestionsOf, questionRecordOf, hasTitle, isSelf, mainCheckout, namesAFile, parseProcessList, parsePsList, percentOf, projectCode, projectDirsOf, projectSlug, quoteOf, transcriptNamed, shareOf, readGateLock, readGateTickets, readGates, readPullRequests, readWorktrees, renderBoard, roleHolders, roleNamed, roleOfTitle, rosterOf, sameSession, heldPastLimit, sessionFacts, titledByReadings, watchBaseline } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';
import { readRelief, tailOfFile } from './lib/board-files.mjs';
import { backgroundChanges, boardBackground, claudeRunner, listAgents } from './lib/background.mjs';
import { START_USAGE, sessionsStartMain, sessionsStopMain } from './sessions-background.mjs';

export const USAGE = [
  'Usage: js-harness sessions [--hours <n>] [--tail <n>] [--self <session id>] [--json]',
  '                           [--context-window <tokens>] [--context-pause <tokens>|<n>%] [--context-compaction <tokens>|<n>%]',
  '                           [--watch [--interval <seconds>] [--timeout <seconds>]]',
  '                           [--cwd <path>] [--claude-home <path>] [--tmp <path>] [--relief <path>]',
  `         --context-pause is ${DEFAULT_CONTEXT_PAUSE_PERCENT}% of the context window by default, and --context-compaction ${DEFAULT_CONTEXT_COMPACTION_PERCENT}%`,
  '       js-harness sessions --address orchestrator|<number> [--hours <n>] [--self <session id>]',
  '                           [--cwd <path>] [--claude-home <path>]',
  '         prints the title of the one other session that holds the role: exit 0 for one,',
  '         1 for none with every transcript read, 2 for several or when it cannot tell',
  '       js-harness sessions --opening [--] "<title>"|"<code> <role>" [--self <session id>] [--peek]',
  '                           [--cwd <path>] [--claude-home <path>]',
  '         prints the opening stored for that session (notify --opening) and records in the channel which session read it:',
  '         exit 0 for one, 1 for none, 2 for several or when it cannot tell;',
  '         a session keeps the title of the first opening it reads, so one of another title is printed and not',
  '         recorded; --peek reads an opening and records nothing;',
  '         a lone -- before a title that begins with -- (--opening -- "--a title")',
  '       js-harness sessions --next-number [--cwd <path>]',
  '         prints <code> <n>, the title number of the next work session: <code> is the project\'s, from harness.json',
  '         "code", and <n> one past the highest of that code in the channel and the openings; exit 1 when the',
  '         project declares no code, 2 when the code or a source could not be read; it writes nothing',
  '       js-harness sessions --quote <transcript file or session id> <line> [--cwd <path>] [--claude-home <path>]',
  '         prints the entry at that line of the transcript only when the user sent it, with its time:',
  '         exit 1 when it is another session\'s message, a task notification, a meta or assistant entry,',
  '         or no such line, saying which; 2 when it cannot look. It warns when the entry is only pasted content.',
  '         a message the user sent while the session worked (the host queues it) is the user\'s too, and is said so',
  '         the user\'s answer to a question the session asked with the host\'s question tool is the user\'s too: it prints',
  '         the question, the options shown and whether they tapped one or typed their own; the result of any',
  '         other tool is not, and a question the user closed without answering is exit 1',
  '         a file is quoted only from the project\'s sessions folder, where the board reads the transcripts: exit 2 for any other',
  START_USAGE.replace(/^Usage: /, '       '),
  '       js-harness sessions --measures [--hours <n>] [--json] [--cwd <path>] [--claude-home <path>] [--tmp <path>]',
  '         prints, for each compaction of the transcripts in the window, whether the user asked for it and, for one the host',
  '         made, two facts: told (the session was told the pause before it) and kept (the feature document has a commit',
  '         between the notice and the compaction, or for the orchestrator a line of its relief file there),',
  '         each yes, no or unknown, then how many miss a fact; then the reliefs (each relieved notice of the days the window touches, with the peak of its relieved session against the window: filled at the pause, or another reason) and the Log lines that name a reopening (candidates for the lead, not judged); exit 0 when it printed, 1 when there is no sessions folder',
].join('\n');

// How often a watch looks, and how long it waits before it returns with nothing, in seconds. A look is
// one process listing, one `gh` call and a few `git` calls per worktree: every 30 s that is some 120 `gh`
// calls an hour, far from any limit, and a change is seen within half a minute. The timeout keeps a
// watch under an hour, so whoever waits on it hears "nothing changed" before it could take the silence
// for a watch that died.
const DEFAULT_INTERVAL = 30;
const DEFAULT_TIMEOUT = 3000;

class SessionsArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value === '' || value.startsWith('--')) throw new SessionsArgError(`${flag} requires a value`);
  return value;
}

/** The number `value` spells in plain digits, with an optional decimal part when `decimals` allows it, or
 * `NaN`. `Number` alone would take an empty or blank value for 0, and `0x2` and `1e1` for numbers; and
 * digits enough to overflow are `Infinity` to it, which no flag here can mean. */
function plainNumber(value, { decimals }) {
  const number = (decimals ? /^(\d+\.?\d*|\.\d+)$/ : /^\d+$/).test(value) ? Number(value) : NaN;
  return Number.isFinite(number) ? number : NaN;
}

// The longest wait a watch takes, in seconds: the largest delay a Node timer accepts is 2,147,483,647 ms,
// and one above it fires after a millisecond, which would make the watch look at the machine in a loop.
const MAX_WAIT = 2147483;

/** `--context-pause` or `--context-compaction` as tokens: a whole number of them, or `<N>%` of `window`
 * (above zero, up to 100). `NaN` for anything else. */
function contextMarkOf(spec, window) {
  if (!spec.endsWith('%')) return plainNumber(spec, { decimals: false });
  const percent = plainNumber(spec.slice(0, -1), { decimals: true });
  return percent > 0 && percent <= 100 ? shareOf(window, percent) : NaN;
}

// The two marks of a context a flag sets, each with the share of the window it is by default and what it
// is: the pause is the user's rule, the compaction is the host's (bin/lib/sessions.mjs, the context figures).
const CONTEXT_MARKS = new Map([
  ['--context-pause', { key: 'contextPause', percent: DEFAULT_CONTEXT_PAUSE_PERCENT }],
  ['--context-compaction', { key: 'contextCompactionDefault', percent: DEFAULT_CONTEXT_COMPACTION_PERCENT }],
]);

/** Walks argv token by token, like `progress`: anything that is not a known flag is a usage error, never
 * a token that is silently ignored. `--hours` is a number above zero, `--tail` a whole number from zero. */
function parseArgs(argv) {
  const parsed = { hours: 12, tail: 3, json: false, contextWindow: DEFAULT_CONTEXT_WINDOW, watch: false, measures: false };
  const marks = new Map([...CONTEXT_MARKS].map(([flag, mark]) => [flag, `${mark.percent}%`]));
  const given = new Set();
  // A Map, not an object: `constructor`, `toString` and `__proto__` are keys of every object literal, and
  // would pass for flags.
  const paths = new Map([['--cwd', 'cwd'], ['--claude-home', 'claudeHome'], ['--tmp', 'tmp'], ['--relief', 'relief']]);
  const waits = new Map([['--interval', 'interval'], ['--timeout', 'timeout']]);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--next-number') {
      parsed.nextNumber = true;
      continue;
    }
    if (token === '--json' || token === '--watch' || token === '--measures') {
      parsed[token.slice(2)] = true;
      continue;
    }
    if (waits.has(token)) {
      const seconds = plainNumber(requireValue(argv, i, token), { decimals: true });
      if (!(seconds > 0 && seconds <= MAX_WAIT)) throw new SessionsArgError(`${token} takes a number of seconds above zero, up to ${MAX_WAIT}`);
      parsed[waits.get(token)] = seconds;
    } else if (token === '--peek') {
      parsed.peek = true;
      continue; // a flag: it takes no value, so the token after it is read as its own
    } else if (token === '--self') {
      parsed.self = requireValue(argv, i, token);
      if (parsed.self.length < 8) throw new SessionsArgError('--self takes a session id, or its first eight characters or more');
    } else if (paths.has(token)) {
      parsed[paths.get(token)] = requireValue(argv, i, token);
    } else if (token === '--hours') {
      parsed.hours = plainNumber(requireValue(argv, i, token), { decimals: true });
      if (!(parsed.hours > 0)) throw new SessionsArgError('--hours takes a number above zero');
    } else if (token === '--tail') {
      parsed.tail = plainNumber(requireValue(argv, i, token), { decimals: false });
      if (Number.isNaN(parsed.tail)) throw new SessionsArgError('--tail takes a whole number, zero or more');
    } else if (token === '--context-window') {
      parsed.contextWindow = plainNumber(requireValue(argv, i, token), { decimals: false });
      if (!(parsed.contextWindow > 0)) throw new SessionsArgError('--context-window takes a whole number of tokens above zero');
    } else if (CONTEXT_MARKS.has(token)) {
      marks.set(token, requireValue(argv, i, token));
      given.add(token);
    } else if (token === '--context-limit') {
      // The flag of the limit mark the board had before the pause. Taken for the pause it would move the
      // pause to wherever an old command line put the mark; refused as unknown it would not say where to
      // go. The two defaults it names are read from their constants, like every share this command says.
      throw new SessionsArgError(`--context-limit is gone, with the mark it set: --context-pause sets where a session pauses (by default ${DEFAULT_CONTEXT_PAUSE_PERCENT}% of the window), and --context-compaction where the host compacts a session that has measured no point of its own (by default ${DEFAULT_CONTEXT_COMPACTION_PERCENT}%)`);
    } else if (token === '--address') {
      parsed.address = roleNamed(requireValue(argv, i, token));
      if (parsed.address === null) throw new SessionsArgError('--address takes a role: orchestrator (or ORQ), or the number of a work session');
    } else if (token === '--opening') {
      // A lone `--` says that what follows is the title, whatever it begins with: `notify --opening --
      // "--a title"` stores such a title, and this is how it is asked for.
      if (argv[i + 1] === '--') {
        parsed.opening = argv[i + 2];
        if (parsed.opening === undefined || parsed.opening === '') throw new SessionsArgError(`${token} requires a value`);
        i += 1; // the `--`, beside the title consumed below
      } else {
        parsed.opening = requireValue(argv, i, token);
      }
    } else if (token === '--quote') {
      const transcript = requireValue(argv, i, token);
      // A file is named by a path; anything else is a session id, or the start of one as `--self` takes it.
      const file = namesAFile(transcript);
      if (!file && transcript.length < 8) throw new SessionsArgError('--quote takes a transcript: its file, or a session id or its first eight characters or more');
      const line = plainNumber(argv[i + 2] ?? '', { decimals: false });
      if (!(Number.isSafeInteger(line) && line >= 1)) throw new SessionsArgError('--quote takes the number of a line of the transcript, from 1, after the transcript');
      parsed.quote = { transcript, file, line };
      i += 1; // the line, beside the transcript consumed below
    } else {
      throw new SessionsArgError(`unknown argument: ${token}`);
    }
    i += 1; // consume the value too, so it is never re-read as its own token
  }
  // A wait given to a board that does not wait is a mistake to name, not a flag to ignore.
  for (const [flag, key] of waits) {
    if (!parsed.watch && parsed[key] !== undefined) throw new SessionsArgError(`${flag} only applies with --watch`);
  }
  // An address is one title and an exit code: there is no board in it to watch, or to give as data. The
  // same holds for an opening and for a quote, and each of the three is asked alone. The measures of the
  // compactions are asked alone too, and are data like the board, so `--json` gives them; but they are
  // judged once from what the transcripts hold, and a watch would have nothing in them to wait for.
  const answers = [['--address', parsed.address, 'a title'], ['--opening', parsed.opening, 'an opening'], ['--quote', parsed.quote, 'an entry of a transcript'], ['--measures', parsed.measures || undefined, 'the measures of the compactions'], ['--next-number', parsed.nextNumber || undefined, 'a title\'s number']].filter(([, asked]) => asked !== undefined);
  if (answers.length > 1) throw new SessionsArgError(`${answers.map(([flag]) => flag).join(' and ')} are asked one at a time`);
  if (parsed.peek && parsed.opening === undefined) throw new SessionsArgError('--peek goes only with --opening: it reads an opening and records nothing');
  for (const [flag, , what] of answers) {
    if (flag === '--measures' && parsed.watch) throw new SessionsArgError(`${flag} prints ${what}: it does not go with --watch`);
    if (flag !== '--measures' && (parsed.watch || parsed.json)) throw new SessionsArgError(`${flag} prints ${what}: it does not go with --watch or --json`);
  }
  // The marks are read last: as a percentage each is a share of the window, whichever flag came first.
  for (const [flag, mark] of CONTEXT_MARKS) {
    parsed[mark.key] = contextMarkOf(marks.get(flag), parsed.contextWindow);
    if (!(parsed[mark.key] > 0)) throw new SessionsArgError(`${flag} takes a whole number of tokens above zero, or a percentage of the context window above zero and up to 100 (${mark.percent}%)`);
  }
  // Each mark is valid alone; the pair is not when the pause is at the compaction or past it: the host
  // would compact a session before it could pause, and a watch would wake for the pause after the fact.
  // It is refused whichever flag, or default, gave either figure, and both are said in whole tokens,
  // since two that differ can round to one share. The compaction checked is the one the board uses for a
  // session that has measured none: a session's own point is read from its transcript (`sessionFacts`,
  // bin/lib/sessions.mjs), is not known when the flags are parsed, and is no part of this check. Each
  // figure is named by what gave it, so a window too small for the two defaults names no flag nobody gave.
  if (!(parsed.contextPause < parsed.contextCompactionDefault)) {
    const figure = (tokens) => `${tokens} tokens (${percentOf(tokens, parsed.contextWindow)}% of the window)`;
    const named = (flag, word) => (given.has(flag) ? flag : `the default ${word} (${CONTEXT_MARKS.get(flag).percent}% of the window)`);
    throw new SessionsArgError(`${named('--context-pause', 'pause')} must be below ${named('--context-compaction', 'compaction')}, where the host compacts a session before it could pause: the pause is ${figure(parsed.contextPause)} and the compaction ${figure(parsed.contextCompactionDefault)}`);
  }
  return { ...parsed, interval: parsed.interval ?? DEFAULT_INTERVAL, timeout: parsed.timeout ?? DEFAULT_TIMEOUT };
}

// One row of the shared listing (`Format-ProcessRow`, bin/lib/process-tree.mjs) and one `C` line per
// process whose command line mentions `check.mjs`, or the dispatcher followed by `check`, or `--resume`;
// `findGates` decides which of those are gates, and `hostsOf` which are Claude Code hosts and of what session. The last line is `OK` with the number of `C` lines written, which
// `parseProcessList` compares with the lines it read: a listing that stopped half way, or lost a line, is
// refused. Tabs and line breaks in a command line become spaces, so a line of output is always one fact.
// Progress output is off: under `-EncodedCommand` it would arrive as CLIXML. The output is UTF-8 because
// that is what `run` reads: left alone PowerShell writes in the code page of its console, 850 or 437 on
// most machines, and a letter outside ASCII in a path would arrive as another. No byte order mark, which
// would be read as the start of the first row.
const GATE_LISTING_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
${POWERSHELL_ROW_FUNCTION}
try {
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
  $written = 0
  foreach ($process in @(Get-CimInstance Win32_Process)) {
    $line = $process.CommandLine
    if (-not $line -or $line -notmatch 'check\.mjs|js-harness(\.mjs)?"?\s+"?check|--resume[= ]') { continue }
    Format-ProcessRow $process
    'C' + [char]9 + $process.ProcessId + [char]9 + ($line -replace '\s+', ' ')
    $written += 1
  }
  'OK' + [char]9 + $written
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

/** The processes a gate can be among, `[{ pid, createdAt, commandLine }]`. Throws when the listing could
 * not run or did not finish: "no gate is running" must never be read from "could not look". */
function listGateCandidates(run, platform) {
  const windows = platform === 'win32';
  const result = windows
    ? run('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(GATE_LISTING_SCRIPT, 'utf16le').toString('base64')], {})
    : run('ps', ['-A', '-o', 'pid=,args='], {});
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(String(result.stderr ?? '').trim().split(/\r?\n/)[0] || `exit ${result.status}`);
  return windows ? parseProcessList(result.stdout) : parsePsList(result.stdout);
}

/** Whether the machine's gate lock has its library beside the script at `script`: `lib/gate-lock.mjs` in
 * the folder of `bin/check.mjs`, or of the dispatcher, which is where this version keeps it and where a
 * checkout from before the lock has nothing. That is what tells a gate that waits for its turn from one
 * that runs whenever it is started (`findGates`). The script is followed through a link first: an install
 * on macOS or Linux links the dispatcher from a folder of commands. A script that cannot be looked at
 * has no library beside it. Reads only; `realpath` and `exists` are replaceable, since a test cannot make
 * a link on every machine. */
export function lockLibraryBesideScript(script, { realpath = fs.realpathSync, exists = fs.existsSync } = {}) {
  try {
    return exists(path.join(path.dirname(realpath(script)), 'lib', 'gate-lock.mjs'));
  } catch {
    return false;
  }
}

/** The id of the subagent the tool call `toolUseId` launched, from the `agent-<id>.meta.json` that names
 * it — the only place it is written while a foreground subagent runs. `null` when no file names it. */
function agentOfCall(subagentsDir, toolUseId, { readdir, readFile }) {
  let names;
  try {
    names = readdir(subagentsDir);
  } catch {
    return null;
  }
  for (const name of names) {
    const match = /^agent-(.+)\.meta\.json$/.exec(name);
    if (!match) continue;
    try {
      if (JSON.parse(readFile(path.join(subagentsDir, name))).toolUseId === toolUseId) return match[1];
    } catch {
      // a meta file being written, or one that is not JSON, names nothing
    }
  }
  return null;
}

/** Where a piece of work writes while it runs, and when it last did: a subagent's own transcript, a
 * shell's output file. `{ path, modifiedAt }`, or `unavailable` with the reason. */
function workFile(work, { sessionDir, tasksDir }, io) {
  let file;
  if (work.tool === 'Agent') {
    const subagentsDir = path.join(sessionDir, 'subagents');
    const agent = work.id ?? agentOfCall(subagentsDir, work.toolUseId, io);
    if (agent === null) return { unavailable: 'no subagent file of the session names this tool call' };
    file = path.join(subagentsDir, `agent-${agent}.jsonl`);
  } else {
    if (work.id === null) return { unavailable: 'the transcript does not record its task id yet' };
    file = path.join(tasksDir, `${work.id}.output`);
  }
  try {
    return { path: file, modifiedAt: new Date(io.stat(file).mtimeMs).toISOString() };
  } catch (err) {
    return { path: file, unavailable: err.code ?? err.message };
  }
}

/** One session of the board: its transcript's facts plus, for each piece of work with no recorded end,
 * the last write of its file. A transcript that cannot be read, or that the reader cannot turn into
 * facts, is a session with `unavailable` and the reason: one transcript never costs the whole board. */
function readSession(id, modifiedAt, { projectDir, tasksRoot, tail, contextWindow, contextPause, contextCompactionDefault, measureReaders, readings }, io) {
  let text;
  try {
    text = io.readFile(path.join(projectDir, `${id}.jsonl`));
  } catch (err) {
    return { id, modifiedAt, unavailable: err.code ?? err.message };
  }
  let facts;
  try {
    facts = io.readFacts(text, { tail, contextWindow, contextPause, contextCompactionDefault });
  } catch (err) {
    return { id, modifiedAt, unavailable: `its transcript could not be read into facts: ${err.message}` };
  }
  const folders = { sessionDir: path.join(projectDir, id), tasksDir: path.join(tasksRoot, id, 'tasks') };
  for (const work of facts.work) {
    if (!work.ended) work.file = workFile(work, folders, io);
  }
  return { id, modifiedAt, ...facts, compactionMiss: missOf(text, id, measureReaders, roleOfSession(id, facts, readings)) };
}

/** The role a session holds for its relief line, from the title the board gives it (the transcript's, or the opening it
 * read, `titledByReadings`), so the board and `--measures` judge a session alike; `null` for a title outside the shape. */
function roleOfSession(id, facts, readings = []) {
  const [titled] = titledByReadings([{ id, title: facts.title ?? null, titleSource: facts.titleSource ?? null }], readings);
  return hasTitle(titled) ? (roleOfTitle(titled.title)?.role ?? null) : null;
}

/** The readers of one session's compactions (`compactionMeasures`): an orchestrator keeps its state in its feature
 * document or its relief file (`keptEither`), any other session in its feature document alone. */
function readersOf(id, role, readers) {
  const orchestrator = role === 'orchestrator' && readers.relief !== undefined;
  return {
    told: (after, at) => readers.told(id, after, at),
    kept: orchestrator ? keptEither(readers.kept, readers.relief) : readers.kept,
    keptWithoutDocument: orchestrator,
  };
}

/** The miss of the session's last automatic compaction (`compactionMissOf`), judged by the readers `--measures` uses;
 * `null` when no readers are given, or the transcript has no automatic compaction that misses a fact. A judgment that
 * throws is no miss: the board says nothing of it, and `--measures` says what it cannot read. */
function missOf(text, id, readers, role) {
  if (readers === undefined) return null;
  try {
    return compactionMissOf(text, readersOf(id, role, readers));
  } catch {
    return null;
  }
}

/** The measures of one session's compactions (`compactionMeasures`): `{ id, modifiedAt, title, titleSource,
 * measures }`, or `{ id, modifiedAt, unavailable }` with the reason when the transcript cannot be read, which
 * is said and never skipped: a total that left one out would claim more than was read. The facts are read first,
 * for the role that decides which state a compaction is kept in; the title is shown only for a transcript that holds
 * a compaction. A transcript the board's reader cannot turn into facts is measured all the same, by its id. */
function measureSession(id, modifiedAt, file, readers, io, readings) {
  let text;
  try {
    text = io.readFile(file);
  } catch (err) {
    return { id, modifiedAt, unavailable: err.code ?? err.message };
  }
  let facts = {};
  try {
    facts = io.readFacts(text);
  } catch {
    // the block is named by the id, and its role is not known
  }
  let measures;
  try {
    measures = compactionMeasures(text, readersOf(id, roleOfSession(id, facts, readings), readers));
  } catch (err) {
    return { id, modifiedAt, unavailable: `its transcript could not be read into measures: ${err.message}` };
  }
  const shown = measures.length > 0 ? facts : {};
  return { id, modifiedAt, title: shown.title ?? null, titleSource: shown.titleSource ?? null, measures };
}

/** The sessions of a project's folder whose transcript changed in the last `hours`, read as the board reads them,
 * `{ generatedAt, since, sessions, record }`: the sessions most recent first (each one's facts, or `unavailable`
 * with the reason), where the window starts (ms), and the channel's record as its reader gives it. Or `{ unlisted }`
 * when the folder could not be listed, with the system's code for why, or its message when it gave no code.
 * `ENOENT` is a project with no sessions folder; any other is a folder that may hold sessions and did not show
 * them, which is not the same answer to every caller (`--address`). `unseen` reads its sessions through this too,
 * so the two never parse a transcript in two ways. `io` is `{ readFile, readdir, stat, readFacts }`. `measureReaders`
 * (`{ told(sessionId, after, at), kept(query) }`, optional) judges each session's last automatic compaction (`missOf`);
 * without it no session has a miss. */
// A session the host holds on a card writes nothing, so it would leave the window just when it needs him
// (odd/tasks/held-sessions.md, S4). A transcript last written within HELD_HORIZON_MS is read from its last
// HELD_TAIL_BYTES, and kept when it ends on a call that has had no result for the held-call limit.
const HELD_HORIZON_MS = 7 * 24 * 3600 * 1000;
const HELD_TAIL_BYTES = 256 * 1024;

/** Whether the transcript at `file`, last written at `changedAt`, outside the window, is held at `now`: `false`
 * past the horizon, without `io.readTail`, or when its tail cannot be read, since such a session cannot be told. */
function heldOutsideWindow(file, changedAt, now, io) {
  if (changedAt < now - HELD_HORIZON_MS || typeof io.readTail !== 'function') return false;
  try {
    let text = io.readTail(file, HELD_TAIL_BYTES);
    // The first line of a tail may be cut; an entry longer than the tail leaves no whole line after it, so the
    // whole transcript is read then (Codex P2 on f9195084). The count of lines decides, not the text's length:
    // the tail is cut in bytes, and a multibyte text is shorter in characters than in bytes.
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    if (lines.length < 2) text = io.readFile(file);
    return heldPastLimit(io.readFacts(text), now);
  } catch {
    return false;
  }
}

export function readSessionsWindow({ projectDir, slug, harnessHome, hours, now, tasksRoot, tail, contextWindow, contextPause, contextCompactionDefault, self, io, measureReaders }) {
  let names;
  try {
    names = io.readdir(projectDir);
  } catch (err) {
    return { unlisted: err.code ?? err.message };
  }
  const generatedAt = now();
  const since = generatedAt - hours * 3600 * 1000;
  const record = readNotices(harnessHome, slug, { readFile: io.readFile });
  const where = { projectDir, tasksRoot, tail, contextWindow, contextPause, contextCompactionDefault, measureReaders, readings: record.readings };
  const read = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const id = name.slice(0, -'.jsonl'.length);
    let changedAt;
    try {
      changedAt = io.stat(path.join(projectDir, name)).mtimeMs;
    } catch (err) {
      // A transcript whose date cannot be read cannot be placed outside the window either: it is listed.
      read.push({ id, modifiedAt: null, unavailable: err.code ?? err.message });
      continue;
    }
    if (changedAt >= since) read.push(readSession(id, new Date(changedAt).toISOString(), where, io));
    else if (heldOutsideWindow(path.join(projectDir, name), changedAt, generatedAt, io)) {
      // The tail is the cheap look; the whole read, with its subagents' files, says whether it is held.
      const session = readSession(id, new Date(changedAt).toISOString(), where, io);
      if (!session.unavailable && heldPastLimit(session, generatedAt)) read.push(session);
    }
  }
  const sessions = titledByReadings(read, record.readings);
  // Most recent first, by the last entry when the transcript has one and by its last write otherwise.
  const recency = (session) => session.lastEntryAt ?? session.modifiedAt ?? '';
  sessions.sort((a, b) => (recency(a) < recency(b) ? 1 : recency(a) > recency(b) ? -1 : 0));
  for (const session of sessions) if (isSelf(session.id, self)) session.self = true;
  return { generatedAt, since, sessions, record };
}

export async function sessionsMain(
  argv,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    now = Date.now,
    platform = process.platform,
    homedir = os.homedir,
    tmpdir = os.tmpdir,
    // Everything that touches the disk or starts a process is injectable, so the tests read fixture
    // folders and fake commands, never this machine's sessions. `run` is `git` and `gh` (and the process
    // listing, unless `listProcesses` replaces it); each is given a time limit so a stuck command becomes
    // an unavailable fact, not a board that never prints.
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }),
    listProcesses = () => listGateCandidates(run, platform),
    // Whether a gate's script has the lock's library beside it, replaceable so a test places none.
    lockLibraryBeside = (script) => lockLibraryBesideScript(script),
    readFile = (absolute) => fs.readFileSync(absolute, 'utf8'),
    readdir = (absolute) => fs.readdirSync(absolute),
    stat = (absolute) => fs.statSync(absolute),
    // The last `bytes` of a file, so a transcript outside the window is judged held without reading all of it.
    readTail = (absolute, bytes) => tailOfFile(absolute, bytes),
    // The transcript reader, replaceable so a test can make it fail on one transcript.
    readFacts = sessionFacts,
    // The desktop app's records of the sessions (`appSessions`), replaceable so a test gives its own; a failure
    // of the reader is no record (`look`), and the board says `unknown` for the sessions it would have placed.
    readApp = () => appSessions(appRoot(env, platform, homedir())),
    // How a watch waits between two looks; with `now` it is all of its time, so a test waits for nothing.
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    // The background sessions `claude agents` lists, replaceable so a test lists its own; a failure is said on the board.
    listBackground = () => listAgents(claudeRunner({ env, platform })),
  } = {},
) {
  // The two subcommands that start and remove a background session (odd/tasks/background-sessions.md) write, unlike the board.
  if (argv[0] === 'start' || argv[0] === 'stop') {
    return (argv[0] === 'start' ? sessionsStartMain : sessionsStopMain)(argv.slice(1), { cwd: defaultCwd, stdout, stderr, env, now, homedir, run });
  }
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2; // a usage error, as in `progress`, `remote` and `codex-review`; 1 is "no sessions folder" below
  }

  const root = mainCheckout(run, path.resolve(parsed.cwd ?? defaultCwd));
  const slug = projectSlug(root);
  const claudeHome = parsed.claudeHome ?? env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude');
  const projectDir = path.join(claudeHome, 'projects', slug);
  const io = { readFile, readdir, stat, readFacts, readTail };
  const pauseTmp = parsed.tmp ?? tmpdir();
  const stateFiles = { readFileSync: readFile, statSync: stat };
  // Where the session that orchestrates this project keeps its notes: one file per project under the
  // harness home, which is JS_HARNESS_HOME or the user's home. An empty JS_HARNESS_HOME is no home here:
  // joined as it is, it would put the file under the folder the command runs in. A relative `--relief` is
  // read from that folder, as `--claude-home` and `--tmp` are, not from `--cwd`.
  const home = harnessHome({ env, homedir });
  const reliefFile = path.resolve(defaultCwd, parsed.relief ?? reliefPath(home, slug));
  // The readers of a compaction's measures (odd/tasks/session-channel.md, section 14): told from the pause's state, kept
  // from the commits of the feature document and, for the orchestrator (`readersOf`), its relief file. The board judges
  // each session's last automatic compaction with them and `--measures` every compaction, so the two never read a fact
  // in two ways.
  const measureReaders = {
    told: (sessionId, after, at) => toldBetween({ home, sessionId, after, before: at, fileSystem: stateFiles, tmpdir: pauseTmp }),
    kept: keptByGitLog(run),
    relief: keptByRelief(readFile, reliefFile),
  };
  // The machine's gate lock is under the same home, read through the same three functions as every other
  // file of the board, so a test hands it a folder of its own.
  const lockFiles = { readdirSync: readdir, statSync: stat, readFileSync: readFile };
  // The session that asked: Claude Code names it in the environment of every command it runs.
  const self = parsed.self ?? env.CLAUDE_CODE_SESSION_ID ?? null;

  /** One look at the transcripts: `{ generatedAt, since, sessions, record }`, the sessions whose transcript
   * changed in the window, the most recent first, and where that window starts (ms); or `{ unlisted }`
   * when the sessions folder could not be listed, with the system's code for why, or its message when it
   * gave no code. `ENOENT` is a project with no sessions folder; any other is a folder that may hold
   * sessions and did not show them, which is not the same answer to every caller (`--address`).
   *
   * `record` is the channel's record as its reader gives it (`readNotices`), read in the same look: a
   * session whose transcript carries no title has the one of the opening it read (`titledByReadings`),
   * so it is on the board, and holds its role, under that title. */
  const lookAtSessions = () =>
    readSessionsWindow({
      projectDir,
      slug,
      harnessHome: home,
      hours: parsed.hours,
      now,
      tasksRoot: path.join(parsed.tmp ?? tmpdir(), 'claude', slug),
      tail: parsed.tail,
      contextWindow: parsed.contextWindow,
      contextPause: parsed.contextPause,
      contextCompactionDefault: parsed.contextCompactionDefault,
      self,
      io,
      measureReaders,
    });

  const noFolder = (code) => `js-harness sessions: no sessions folder for ${root}: ${projectDir} (${code})`;

  /** The app's records of the sessions, read in each look: a reader that fails leaves none, and the rows say so. */
  const readAppRecords = () => {
    try {
      return readApp();
    } catch {
      return new Map();
    }
  };

  /** The board's stalled sessions at `at` (ms): `{ limitMinutes, items, unavailable }`, read as the heartbeat reads them. */
  const stalledOf = (at) => {
    const { stalled, unavailable } = readStalled({ home, slug, now: at, limitMs: STALL_MINUTES * 60 * 1000, windowMs: parsed.hours * 3600 * 1000, run, fileSystem: { readFileSync: (file) => readFile(file), readdirSync: readdir } });
    return { limitMinutes: STALL_MINUTES, items: stalled, unavailable };
  };

  /** One look at the machine: the board, or `null` (said on stderr) when the sessions folder could not be
   * listed: there is then no board to print, whatever the reason, and the line gives it. */
  const look = () => {
    const seen = lookAtSessions();
    if (seen.unlisted !== undefined) {
      stderr(noFolder(seen.unlisted));
      return null;
    }
    const { generatedAt, since, sessions, record } = seen;
    const app = readAppRecords();
    const worktrees = readWorktrees(run, root, { readFile });
    // The processes first, the lock after: a gate that starts is a process for a moment before it stands
    // in line, and read the other way round more of them would be shown as not yet in line. The waiters
    // before the holder: a gate that takes the lock between the two reads is then in one of them.
    // One listing for the gates and the hosts: each look starts PowerShell once on Windows, and both read the same moment.
    let listed;
    const listOnce = () => {
      if (listed === undefined) {
        try {
          listed = { processes: listProcesses() };
        } catch (err) {
          listed = { error: err };
        }
      }
      if (listed.error) throw listed.error;
      return listed.processes;
    };
    const gates = readGates(listOnce, worktrees.available ? worktrees.items.map((tree) => tree.path) : [], { lockLibraryBeside });
    // A listing that failed leaves the hosts unread, never "none runs": a closed session could still be running.
    const hosts = (() => {
      try {
        return { items: hostsOf(listOnce()) };
      } catch (err) {
        return { unavailable: err.message };
      }
    })();
    const gateLock = readGateLock(() => {
      // Against the clock of this moment, not the one the look began at: the transcripts, `git` and the
      // process listing took their time (16 s, measured here), and a holder whose last beat was a
      // minute before now would still read alive against the earlier time. One time for both reads,
      // which goes with what was read: the board says the ages of these gates against it.
      const readAt = now();
      const reading = { now: () => readAt, fileSystem: lockFiles };
      const waiters = readGateWaiters(home, reading);
      return { holder: readGateHolder(home, reading), waiters, readAt };
    });
    // The tickets that put a session's next check first in that lock, under the same home and through the
    // same functions (./lib/gate-first.mjs).
    const gateTickets = readGateTickets(() => readTickets(home, { now, fileSystem: lockFiles }));
    return {
      root,
      projectDir,
      hours: parsed.hours,
      contextWindow: parsed.contextWindow,
      // Where a session pauses, and where the host compacts one that has measured no point of its own. That
      // one is the default and is named so: a session's `contextCompaction` is another thing, the point it
      // is counted against with whether the session measured it, and one key with two shapes reads wrong.
      contextPause: parsed.contextPause,
      contextPausePercent: percentOf(parsed.contextPause, parsed.contextWindow),
      contextCompactionDefault: parsed.contextCompactionDefault,
      contextCompactionDefaultPercent: percentOf(parsed.contextCompactionDefault, parsed.contextWindow),
      self,
      generatedAt: new Date(generatedAt).toISOString(),
      sessions,
      // The work sessions the orchestrator handed work to that went quiet (odd/tasks/stalled-sessions.md), from the
      // channel's record, the openings and the gate log under the home: what the heartbeat reads too, without a transcript.
      stalled: stalledOf(generatedAt),
      // The window lists a transcript whose file changed; a row of the roster wants an entry of that time.
      roster: rosterOf(sessions, { worktrees, since, record, app, hosts }),
      // The record's last notices and the last messages between these sessions: `notify` writes the
      // first, the transcripts hold the second, and this command writes neither.
      channel: channelOf(record, sessions),
      // The questions put to the user that have no answer of his, read from the same transcripts: nothing
      // a session remembers is in this list. The questions the channel's record holds join it by their number,
      // when the record was read; one that could not be read gives the list of the transcripts alone.
      questions: openQuestionsOf(sessions, { hours: parsed.hours, ...(record.unavailable === undefined && { record: questionRecordOf(recordedQuestions(record)) }) }),
      worktrees,
      gates,
      gateLock,
      gateTickets,
      pullRequests: readPullRequests(run, root),
      relief: readRelief(reliefFile, readFile),
      // Whether a memory hygiene pass is due for the project (odd/tasks/memory-hygiene.md, D5): the main checkout's
      // memory folder, which the host keeps beside the transcripts, and the journal `memory` keeps under the home.
      memory: boardMemory({ home: home, slug, folder: path.join(projectDir, 'memory'), now: now() }),
      notVisible: NOT_VISIBLE,
      // The project's background sessions (odd/tasks/background-sessions.md, S4): what `claude agents` lists in its
      // folders, each marked by whether `sessions start` recorded it. A listing that fails is unavailable, never none.
      background: boardBackground({ home, root, worktrees, list: listBackground, platform, readFile }),
    };
  };
  const boardLines = (board) => renderBoard(board, { now: Date.parse(board.generatedAt) });

  // The number the next work session is titled with (odd/tasks/session-title.md, S2, S5): the one the guard names when
  // it refuses a start_session of another title. It reads the project's code from its harness.json, then the channel's
  // record and the openings, and writes nothing. Exit 1 is a project that declares no code; a code or a source that
  // could not be read is exit 2, so "could not look" is never read as "none".
  if (parsed.nextNumber) {
    let code;
    try {
      ({ code } = projectCode(root, readFile));
    } catch (err) {
      stderr(`js-harness sessions: could not read the project's code: ${err.message}`);
      return 2;
    }
    if (code === null) {
      stderr(`js-harness sessions: ${path.join(root, 'harness.json')} declares no "code", the project's identifier a session's title starts with (such as "JH"): add it to give the next number`);
      return 1;
    }
    const next = nextSessionNumber(home, slug, { code, readdir, readFile });
    for (const source of next.unavailable ?? []) stderr(`js-harness sessions: could not read ${source}: the number may be taken`);
    stdout(`${next.code} ${next.number}`);
    return next.unavailable ? 2 : 0;
  }

  // The opening of a session, read by the session it is for (odd/tasks/session-channel.md, points 4 and
  // 6): the text `notify --opening` stored under a title, found by that title or by the code and the role
  // it starts with. Exit 0 prints one opening, 1 says there is none, and 2 is "no clean answer", as for
  // an address: several openings (each title is printed), or a folder or a file that could not be read,
  // which may be the one asked for.
  //
  // Reading it is also what says which session this is. A session opened from the phone has no title in
  // its transcript, and nothing asks it to state one: this command appends to the record that the session
  // the host names (or `--self`) read the opening of that title, and the board and `notify` take the title
  // from there. With no session named there is nothing to record, and nothing is said of it: the text is
  // what was asked for; and none is recorded for the session that wrote the opening. A reading that
  // cannot be written is said, and the opening is printed all the same.
  if (parsed.opening !== undefined) {
    const wanted = JSON.stringify(parsed.opening);
    const found = findOpenings(home, slug, parsed.opening, { readdir, readFile });
    const notKnown = `js-harness sessions: not known whether there is an opening for ${wanted}`;
    const unreadable = `${found.unreadable} file${found.unreadable === 1 ? '' : 's'} of ${found.dir} could not be read as an opening`;
    if (found.unavailable !== undefined) {
      stderr(`${notKnown}: the folder ${found.dir} could not be listed (${found.unavailable})`);
      return 2;
    }
    if (found.openings.length === 0) {
      stderr(found.unreadable > 0 ? `${notKnown}: ${unreadable}` : `js-harness sessions: no opening for ${wanted} in ${found.dir}`);
      return found.unreadable > 0 ? 2 : 1;
    }
    if (found.openings.length > 1) {
      for (const opening of found.openings) stdout(opening.title);
      stderr(`js-harness sessions: ${found.openings.length} openings are named by ${wanted}: ask for one by its whole title`);
      return 2;
    }
    const [opening] = found.openings;
    // Without its final line ending, whichever it is: `notify --opening` stores plain line breaks, and a
    // file written by anything else may end in a carriage return and a line feed.
    stdout(opening.text.replace(/(\r\n|\n|\r)$/, ''));
    if (found.unreadable > 0) stderr(`js-harness sessions: ${unreadable} and ${found.unreadable === 1 ? 'is' : 'are'} not counted`);
    // A look at an opening, another session's most often: printed, and nothing is recorded.
    if (parsed.peek) return 0;
    // The worktrees are listed only when a session is named to look for: an opening read by nobody runs no more git.
    const someone = Boolean(parsed.self || env.CLAUDE_CODE_SESSION_ID);
    const reader = senderOf({ self: parsed.self ?? null, env, projectDirs: someone ? projectDirsOf(run, root, claudeHome) : [], readdir, readFile, readFacts });
    // The session that stored the opening reads it back to check it: it is not the session it is for,
    // and a reading of its own would give it that title on the board if its transcript carried none. It
    // is the same session when either id is the start of the other: `notify --opening --self` keeps the
    // start it was given when no transcript completed it, and so does this command (`sameSession`).
    if (reader.id === null || sameSession(reader.id, opening.from?.id)) return 0;
    // An id no transcript completes is recorded as given, as a notice written with it is (`senderOf`). One
    // that several transcripts start with is not: the reading would give each of them the title
    // (`titleRead`), and nothing says which of them read. Nor is one given with `--self` when the folder
    // cannot be listed: it may be the start of several ids, and that could not be checked. The id the
    // host gives is whole, and a folder that is not there has no transcript to share a start with.
    let named = [];
    try {
      named = readdir(projectDir).filter((name) => name.endsWith('.jsonl') && isSelf(name.slice(0, -'.jsonl'.length), reader.id));
    } catch (err) {
      if (reader.source === 'flag' && err.code !== 'ENOENT') {
        stderr(`js-harness sessions: the opening was read, and no reading was recorded: the sessions folder ${projectDir} could not be listed (${err.code ?? err.message}), so it is not known whether ${JSON.stringify(reader.id)} names one transcript`);
        return 0;
      }
    }
    if (named.length > 1) {
      stderr(`js-harness sessions: the opening was read, and no reading was recorded: ${named.length} transcripts of this project are named by ${JSON.stringify(reader.id)}, and a reading under it would give each of them the title. Give more of the id`);
      return 0;
    }
    // The first opening a session reads is its own: the line the user sends in a new session asks for it. A
    // later one of another title is another session's, read to see what it does, and recording it would give
    // this session that title on the board (JH 15, 2026-10-14). It is printed, and the reason it is not
    // recorded is said.
    // Either id may be the start of the other: a reading under the whole id and one under `--self`'s start,
    // with no transcript to complete it, are the same session's (`sameSession`).
    const held = readNotices(home, slug, { readFile }).readings.findLast((reading) => sameSession(reading.reader.id, reader.id))?.title ?? null;
    if (held !== null && held !== opening.title) {
      stderr(`js-harness sessions: the opening was read, and no reading was recorded: this session already read the opening of ${JSON.stringify(held)}, which stays its title (--peek reads an opening and records nothing)`);
      return 0;
    }
    try {
      appendReading(home, slug, newReading({ at: new Date(now()).toISOString(), reader, title: opening.title }));
    } catch (err) {
      stderr(`js-harness sessions: the opening was read, and that could not be recorded in ${recordPath(home, slug)} (${err.code ?? err.message})`);
    }
    return 0;
  }

  // Whose words a line of a transcript holds (point 7): the entry at that line, printed only when the
  // user sent it. A session runs this before it takes as his an answer another session carried to it,
  // with the transcript and the line the notice of kind `answer` names. Exit 1 is "these are not his
  // words": another session's message, a task's end, an entry of the host or of the model, a line or a
  // transcript that is not there, each said. Exit 2 is "could not look": a transcript or a folder that
  // could not be read, a start of an id that names several. Only exit 0 prints anything on stdout.
  if (parsed.quote) {
    const { transcript, line } = parsed.quote;
    const notKnown = `js-harness sessions: not known whose words line ${line} holds`;
    // Which file that is, and that it is a transcript of this project's sessions folder, directly in it, as
    // the board reads them: `transcriptNamed`, which says why only those are quoted.
    const named = transcriptNamed(projectDir, transcript, { cwd: defaultCwd, readdir });
    if (named.not === 'outside') {
      stderr(`js-harness sessions: not quoted: ${named.file} is not a transcript of this project's sessions folder, ${projectDir}. Only the transcripts the board reads there are quoted: a session can write a file anywhere else and mark a line of it as the user's`);
      return 2;
    }
    if (named.not === 'unlisted') {
      stderr(named.code === 'ENOENT' ? noFolder(named.code) : `${notKnown}: the sessions folder ${projectDir} could not be listed (${named.code})`);
      return named.code === 'ENOENT' ? 1 : 2;
    }
    if (named.not === 'none' || named.not === 'short') {
      stderr(`js-harness sessions: no transcript of this project is named by ${JSON.stringify(transcript)} in ${projectDir}`);
      return 1;
    }
    if (named.not === 'several') {
      stderr(`js-harness sessions: ${named.count} transcripts of this project are named by ${JSON.stringify(transcript)}: give more of the id, or the file`);
      return 2;
    }
    const { file } = named;
    let text;
    try {
      text = readFile(file);
    } catch (err) {
      const code = err.code ?? err.message;
      stderr(code === 'ENOENT' ? `js-harness sessions: no transcript at ${file}` : `${notKnown}: ${file} could not be read (${code})`);
      return code === 'ENOENT' ? 1 : 2;
    }
    const quote = quoteOf(text, line);
    if (!quote.person) {
      stderr(`js-harness sessions: not the user's words: line ${line} of ${file} is ${quote.what}`);
      return 1;
    }
    // His answer to a question the session asked: the question and the options go with it, since a label
    // alone says nothing to whoever reads it later, and so does whether he tapped an option or typed his own.
    if (quote.answered) {
      stdout(`${file}, line ${line}, ${quote.at ?? 'no time recorded'}, answered by the user to a question the session asked (${quote.answered.tool}):`);
      for (const { question, options, answer, how } of quote.answered.answers) {
        stdout(`question: ${question}`);
        stdout(`options shown: ${options.join(' | ')}`);
        stdout(`answer (${how}): ${answer}`);
      }
      return 0;
    }
    const images = quote.images === 0 ? '' : `, with ${quote.images} image${quote.images === 1 ? '' : 's'}`;
    // A message he sent while the session worked is his too, and is said as that: the host wrote it as a
    // queued command, not as an entry of his turn, and whoever reads the line sees which of the two it is.
    const when = quote.queued ? ' while the session was working (the host queued it)' : '';
    stdout(`${file}, line ${line}, ${quote.at ?? 'no time recorded'}, sent by the user${when}${images}:`);
    stdout(quote.text);
    if (quote.pastedOnly) stderr(`js-harness sessions: line ${line} is only pasted content: nothing was typed with it, and a paste alone is not the user's word`);
    return 0;
  }

  // The address of a role: the title of the one session that holds it, among the sessions the board
  // would list and without the one that asks, so the answer is always about the others. A session that
  // starts as orchestrator learns from it whether another one is there (0 or 2), and a work session
  // where its notices go (0 only). Two transcripts under one title are one holder, and a transcript holds
  // a role only while its last timed entry is in the window, whatever the date of its file (`rosterOf`).
  //
  // Exit 1 says more than "none found": no other session holds the role, and every transcript of the
  // window was read. A transcript that could not be read has no title, so it may be the holder: with no
  // holder found the answer is then not known, and that is exit 2, with the file. The session that starts
  // as orchestrator takes exit 1 as leave to start, so not knowing must never read as "none". Exit 2 is
  // "no clean answer": several holders, cannot tell, or a usage error. The same holds one step earlier: a
  // sessions folder that does not exist has no session in it, and one that is there and could not be
  // listed (no permission, busy, a disk error) may be full of them, so only the first is exit 1. A first
  // version took every failure of the listing for "no folder" (found by both reviews, 2026-10-11).
  if (parsed.address) {
    const role = parsed.address.role === 'orchestrator' ? 'the orchestrator' : `work session ${parsed.address.number}`;
    const seen = lookAtSessions();
    if (seen.unlisted === 'ENOENT') {
      stderr(noFolder(seen.unlisted));
      return 1;
    }
    if (seen.unlisted !== undefined) {
      stderr(`js-harness sessions: not known whether a session carries the title of ${role}: the sessions folder ${projectDir} could not be listed (${seen.unlisted})`);
      return 2;
    }
    // The session that asks is left out by its transcript, not by its title. Leaving out every transcript
    // of its title would answer "none" to a second session that took the same title, and a session that
    // starts as orchestrator must never read that as leave to start. What it costs: after the app
    // restarts a session into a new file, its own earlier transcript is found as the holder, which is
    // said beside the answer (`sameTitle` below), since no transcript tells the two cases apart.
    const others = seen.sessions.filter((session) => !session.self);
    const roster = rosterOf(others, { since: seen.since });
    const holders = roleHolders(roster, parsed.address);
    const window = `that changed in the last ${parsed.hours}h`;
    const unread = others.filter((session) => session.unavailable).map((session) => `${path.join(projectDir, `${session.id}.jsonl`)} (${session.unavailable})`);
    const notRead = `${unread.length} transcript${unread.length === 1 ? '' : 's'} ${window} could not be read`;
    // A session opened from the phone has its title from the record alone (`titledByReadings`): with the
    // record unread it has none here, and may be the holder, or one more holder.
    const recordUnread = seen.record.unavailable === undefined ? null : `the channel's record ${seen.record.path} could not be read (${seen.record.unavailable})`;
    for (const holder of holders) stdout(holder.title);
    if (holders.length === 0 && unread.length > 0) {
      stderr(`js-harness sessions: not known whether a session carries the title of ${role}: ${notRead}: ${unread.join(', ')}`);
      return 2;
    }
    if (holders.length === 0 && recordUnread !== null) {
      stderr(`js-harness sessions: not known whether a session carries the title of ${role}: ${recordUnread}, and a session opened from the phone is known by it`);
      return 2;
    }
    if (holders.length === 0) {
      const apart = others.length < seen.sessions.length ? ', the one that asks is not counted' : '';
      const outside = roster.outside > 0 ? `, ${roster.outside} of them with no entry in that time` : '';
      stderr(`js-harness sessions: no session carries the title of ${role} (transcripts ${window}: ${seen.sessions.length}${apart}${outside})`);
      return 1;
    }
    if (holders.length > 1) stderr(`js-harness sessions: ${holders.length} sessions carry the title of ${role}: a message to it has no single address`);
    // Only a title a session was given is one, as in the roster: the start of a first prompt names nobody.
    const sameTitle = holders.length === 1 && seen.sessions.some((session) => session.self && hasTitle(session) && session.title === holders[0].title);
    if (sameTitle) {
      stderr(`js-harness sessions: ${JSON.stringify(holders[0].title)} is also the title of the session that asks: the transcript found may be an earlier one of this same session, or another session under the same title, and the transcripts cannot tell which`);
    }
    if (unread.length > 0) stderr(`js-harness sessions: ${notRead} and ${unread.length === 1 ? 'is' : 'are'} not counted: ${unread.join(', ')}`);
    if (recordUnread !== null) stderr(`js-harness sessions: ${recordUnread}: a session known only by the opening it read is not counted`);
    return holders.length === 1 ? 0 : 2;
  }

  // The measures of the compactions (odd/tasks/session-channel.md, section 14), the proof the user is owed
  // that the pause works: each compaction of the transcripts that changed in the window, judged once in the
  // file that holds the stretch before it. Told is read from the pause's state under the harness home (or
  // the temp folder, where the hook keeps it when the home cannot be written), kept from `git log` of the
  // feature document the session last wrote. A sessions folder that cannot
  // be listed is exit 1, as for the board: there is nothing to measure, whatever the reason.
  if (parsed.measures) {
    let names;
    try {
      names = readdir(projectDir);
    } catch (err) {
      stderr(noFolder(err.code ?? err.message));
      return 1;
    }
    const generatedAt = now();
    const since = generatedAt - parsed.hours * 3600 * 1000;
    const record = readNotices(home, slug, { readFile });
    const readings = record.readings;
    const measured = [];
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      const id = name.slice(0, -'.jsonl'.length);
      const file = path.join(projectDir, name);
      let changedAt;
      try {
        changedAt = stat(file).mtimeMs;
      } catch (err) {
        // A transcript whose date cannot be read cannot be placed outside the window either: it is said.
        measured.push({ id, modifiedAt: null, unavailable: err.code ?? err.message });
        continue;
      }
      if (changedAt >= since) measured.push(measureSession(id, new Date(changedAt).toISOString(), file, measureReaders, io, readings));
    }
    // A session opened from the phone has its title from the opening it read, as on the board.
    const sessions = titledByReadings(measured, readings);
    sessions.sort((a, b) => ((a.modifiedAt ?? '') < (b.modifiedAt ?? '') ? 1 : (a.modifiedAt ?? '') > (b.modifiedAt ?? '') ? -1 : 0));
    // The reliefs (section 18): the `relieved` notices of the whole local days the window touches, each judged from the
    // transcript of the session it relieves. A record that cannot be read is not known, never a record with no relief.
    const reliefSince = dayStartOf(since);
    // The pause the reliefs are judged against is the one the board marks with, --context-pause included.
    const reliefPause = percentOf(parsed.contextPause, parsed.contextWindow);
    const reliefList = record.unavailable === undefined
      ? reliefMeasures(record.notices, {
        since: reliefSince,
        transcriptLines: (id) => readFile(path.join(projectDir, `${id}.jsonl`)).split('\n'),
        pausePercent: reliefPause,
        defaultWindow: parsed.contextWindow,
      })
      : null;
    // The reopenings (section 18): the Log lines of the feature documents that name one, in the history of the main checkout.
    const reopened = reopenCandidates(run, root, new Date(reliefSince).toISOString().replace('.000Z', 'Z'));
    if (parsed.json) {
      const reliefsData = reliefList === null
        ? { known: false, why: record.unavailable }
        : { known: true, firstDay: localDay(reliefSince), lastDay: localDay(generatedAt), pausePercent: reliefPause, items: reliefList, total: reliefsTotal(reliefList) };
      stdout(JSON.stringify({ root, projectDir, hours: parsed.hours, generatedAt: new Date(generatedAt).toISOString(), sessions, total: measuresTotal(sessions), reliefs: reliefsData, reopenCandidates: reopened }, null, 2));
    } else {
      const reliefText = reliefList === null
        ? [`reliefs: not known (the record could not be read: ${record.unavailable})`]
        : reliefLines(reliefList, { since: reliefSince, now: generatedAt });
      for (const line of [...measuresLines(sessions), ...reliefText, ...reopenLines(reopened)]) stdout(line);
    }
    return 0;
  }

  const first = look();
  if (first === null) return 1;
  if (!parsed.watch) {
    for (const line of parsed.json ? [JSON.stringify(first, null, 2)] : boardLines(first)) stdout(line);
    return 0;
  }

  // The watch: look, wait, look again, and say nothing until two looks differ in a way that matters
  // (`boardChanges`) or the timeout is up. Whoever waits on it pays for one answer, not for the waiting.
  const started = now();
  const waited = () => Math.round((now() - started) / 1000);
  let baseline = first;
  for (let left = parsed.timeout * 1000; left > 0; left = parsed.timeout * 1000 - (now() - started)) {
    await sleep(Math.min(parsed.interval * 1000, left));
    const board = look();
    if (board === null) return 1;
    const changes = [...boardChanges(baseline, board, { self }), ...backgroundChanges(baseline.background, board.background)];
    if (changes.length === 0) {
      baseline = { ...watchBaseline(baseline, board), background: board.background.available ? board.background : baseline.background };
      continue;
    }
    if (parsed.json) {
      stdout(JSON.stringify({ watch: { changed: true, waitedSeconds: waited(), changes }, board }, null, 2));
      return 0;
    }
    stdout(`sessions --watch: ${changes.length} change${changes.length === 1 ? '' : 's'} after ${waited()}s`);
    for (const change of changes) stdout(`  ${change}`);
    stdout('');
    for (const line of boardLines(board)) stdout(line);
    return 0;
  }
  // Nothing to decide: one line and no board, so a watch that wakes for nothing costs next to nothing.
  stdout(parsed.json ? JSON.stringify({ watch: { changed: false, waitedSeconds: waited(), changes: [] } }, null, 2) : `sessions --watch: nothing changed in ${waited()}s`);
  return 0;
}
