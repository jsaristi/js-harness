// `js-harness spend`: what one session spent, read from its transcript with each API message counted once
// (bin/lib/transcript-requests.mjs). A session that watched its spend by summing the transcript's lines read about
// twice what it spent, because one message is written on several lines that each repeat its usage, and stopped at half
// the cap it was given (the measure of 2026-11-21). This is the one figure to read instead. Read-only, zero
// dependencies; `--json` gives the same data as the text.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { transcriptOf } from './lib/channel.mjs';
import { mainCheckout, projectDirsOf } from './lib/sessions.mjs';
import { harnessHome } from './lib/home.mjs';
import { StopLineError, parseStopLine, readStopLine, recordStopLine, sessionSpend } from './lib/spend-stop.mjs';
import { leadTitle } from './lib/session-title-guard.mjs';
import { appRoot, appSessions } from './lib/app-record.mjs';

export const USAGE = [
  'Usage: js-harness spend (<session id> | <transcript .jsonl> | --self) [--json]',
  '       js-harness spend --self --line <tokens>',
  '       js-harness spend <whole session id> --line <tokens> --raise    (the lead only)',
  '',
  'What one session spent, from its transcript: the main chain\'s calls, cache-read, input, output and cache-write',
  'tokens, the context of its last call and of its first (the fixed context it opened with), and its sub-agents apart',
  '(side-chain lines and <session>/subagents/agent-*.jsonl). The lines of one API message are one call, counted once.',
  'A session id (whole, or its first eight characters or more) is looked for in this project\'s sessions folders and',
  'its worktrees\'; --self (a flag) reads the session that runs the command, by CLAUDE_CODE_SESSION_ID. A cut last',
  'line, as a session still writing leaves, is counted as unreadable and in no figure.',
  '--self --line records the stop line in cache-read tokens (20000000, 20M or 500K) for the session that runs it, beside',
  'its pause state under the harness home: from then on js-harness guard refuses its next step once its cache-read, main',
  'chain and sub-agents, reaches the line, but for the steps that close the work (a state file or feature document, cd,',
  'git add, commit and push, gh pr create|edit|ready, notify, loop stop). A line is recorded once: the same line again',
  "changes nothing, any other is refused. --raise moves another session's line, run from a session whose app record",
  "carries a lead's title. A prompt that names \"Stop at <N> cache-read\" records the line once by itself, through",
  'the rules turn hook. The plain form then names the line recorded.',
  'Exit 0 printed or recorded; 1 the transcript could not be found or read, a line other than the one recorded, or a --raise from a session not titled as the lead; 2 a usage error.',
].join('\n');

class SpendArgError extends Error {}

// A session's whole id, as the host writes it: a raise names the session it moves whole, never by its start.
const WHOLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `{ json, self, given }` from the command line; a usage error throws `SpendArgError`. */
function parseArgs(argv) {
  const parsed = { json: false, self: false, given: undefined, line: undefined, raise: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--line') {
      parsed.line = parseStopLine(argv[i + 1]);
      if (parsed.line === null) throw new SpendArgError('--line takes a token count: digits, or with a K or M suffix (20M)');
      i += 1;
    }
    else if (arg === '--self') parsed.self = true;
    else if (arg === '--raise') parsed.raise = true;
    else if (arg.startsWith('--')) throw new SpendArgError(`unknown argument: ${arg}`);
    else if (parsed.given !== undefined) throw new SpendArgError(`one session at a time, not ${parsed.given} and ${arg}`);
    else parsed.given = arg;
  }
  if (parsed.self && parsed.given !== undefined) throw new SpendArgError('--self or a session, not both');
  if (parsed.raise && (parsed.line === undefined || parsed.self || parsed.json || !WHOLE_ID.test(parsed.given ?? ''))) throw new SpendArgError("--raise moves another session's line: <whole session id> --line <tokens> --raise");
  if (!parsed.raise && parsed.line !== undefined && (!parsed.self || parsed.json)) throw new SpendArgError('--line records the line of the session that runs it: --self --line <tokens>, without --json');
  return parsed;
}

const number = (value) => (value === null ? 'none' : value.toLocaleString('en-US'));
const plural = (count, word) => `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;

/** The sessions folders of the project at `cwd` and of its worktrees, as `notify` and the board read them. */
function defaultProjectDirs({ cwd, env }) {
  const run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const claudeHome = path.resolve(cwd, env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'));
  return projectDirsOf(run, mainCheckout(run, cwd), claudeHome);
}

/** Exit 0 with the spend printed, 1 when the transcript cannot be found or read, 2 for a bad command line.
 * `projectDirs`, `readFile` and `readdir` are seams for the tests. */
export function spendMain(
  argv,
  {
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    cwd = process.cwd(),
    projectDirs = defaultProjectDirs,
    readFile = (file) => fs.readFileSync(file, 'utf8'),
    readdir = (dir) => fs.readdirSync(dir),
    homedir = os.homedir,
    readApp,
  } = {},
) {
  const usage = (why) => {
    stderr(`js-harness spend: ${why}\n\n${USAGE}`);
    return 2;
  };
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (err instanceof SpendArgError) return usage(err.message);
    throw err;
  }
  const { json, self, line, raise } = parsed;
  let { given } = parsed;
  if (self) {
    given = env.CLAUDE_CODE_SESSION_ID || undefined;
    if (given === undefined) return usage('--self reads CLAUDE_CODE_SESSION_ID, which is not set here: name the session or its transcript');
  }
  if (given === undefined) return usage('name a session, its transcript, or --self');
  const home = harnessHome({ env, cwd });
  if (line !== undefined) {
    // Only the id the host sets, or the lead's raise of a session it names whole: a line recorded on a guessed session
    // would stop one that never asked for it.
    if (raise) {
      const caller = env.CLAUDE_CODE_SESSION_ID;
      let record = null;
      try {
        const read = readApp ?? (() => {
          const app = appRoot(env, process.platform, homedir());
          return app === null ? new Map() : appSessions(app);
        });
        record = typeof caller === 'string' && caller !== '' ? read().get(caller) ?? null : null;
      } catch {
        record = null;
      }
      if (record === null || !leadTitle(record.title ?? '')) {
        stderr(`js-harness spend: only the lead (a session titled "<code> ORQ · <purpose>" in its app record) moves a recorded line, and ${record === null ? 'no app record names the session that runs this' : `this session is titled ${JSON.stringify(record.title ?? '')}`}`);
        return 1;
      }
    }
    try {
      const { previous } = recordStopLine({ home, sessionId: given, line, raise });
      stdout(`js-harness spend: stop line ${number(line)} cache-read recorded for session ${given}${previous === null || previous === line ? '' : `, moved from ${number(previous)} by the lead`}; js-harness guard refuses its next step once its cache-read reaches it: then write your state and stop`);
      return 0;
    } catch (err) {
      if (!(err instanceof StopLineError) && !(err instanceof TypeError)) throw err;
      stderr(`js-harness spend: ${err.message}`);
      return 1;
    }
  }

  let found;
  if (given.endsWith('.jsonl')) {
    const file = path.resolve(cwd, given);
    found = { id: path.basename(file, '.jsonl'), file };
  } else {
    found = transcriptOf(given, projectDirs({ cwd, env }), readdir);
    if (found === null) {
      stderr(`js-harness spend: no transcript, or more than one, carries the session ${given} in this project's sessions folders; name its .jsonl instead`);
      return 1;
    }
  }

  let read;
  try {
    read = sessionSpend({ file: found.file, id: found.id, readFile, readdir });
  } catch (err) {
    stderr(`js-harness spend: could not read ${found.file} (${err.code ?? err.message})`);
    return 1;
  }
  const spend = { id: found.id, file: found.file, ...read, stopLine: readStopLine(home, found.id) };
  const { unreadSubagentFiles } = spend;

  if (json) {
    stdout(JSON.stringify(spend, null, 2));
    return 0;
  }
  const { main, subagents } = spend;
  const lines = [
    `js-harness spend: ${spend.file}`,
    `main chain: ${plural(main.calls, 'call')}; cache-read ${number(main.cacheReadTokens)}; input ${number(main.inputTokens)}; output ${number(main.outputTokens)}; cache-write ${number(main.cacheWriteTokens)}`,
    `context: last call ${number(main.lastContext)}; first call ${number(main.firstContext)} (the fixed context it opened with)`,
    `sub-agents (${plural(spend.subagentFiles, 'file')}): ${plural(subagents.calls, 'call')}; cache-read ${number(subagents.cacheReadTokens)}; input ${number(subagents.inputTokens)}; output ${number(subagents.outputTokens)}; cache-write ${number(subagents.cacheWriteTokens)}`,
  ];
  if (spend.stopLine !== null) lines.push(`stop line: ${number(spend.stopLine)} cache-read, recorded with --self --line; spent ${number(main.cacheReadTokens + subagents.cacheReadTokens)} of it`);
  if (spend.unreadableLines > 0) lines.push(`unreadable: ${plural(spend.unreadableLines, 'line')}, in no figure (a session still writing ends on a cut line)`);
  if (unreadSubagentFiles > 0) lines.push(`not read: ${plural(unreadSubagentFiles, 'sub-agent file')}, left out of the sub-agents' sums`);
  lines.push('Each API message is one call, however many transcript lines repeat its usage.');
  stdout(lines.join('\n'));
  return 0;
}
