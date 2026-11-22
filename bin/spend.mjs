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
import { spendOf } from './lib/transcript-requests.mjs';

export const USAGE = [
  'Usage: js-harness spend (<session id> | <transcript .jsonl> | --self) [--json]',
  '',
  'What one session spent, from its transcript: the main chain\'s calls, cache-read, input, output and cache-write',
  'tokens, the context of its last call and of its first (the fixed context it opened with), and its sub-agents apart',
  '(side-chain lines and <session>/subagents/agent-*.jsonl). The lines of one API message are one call, counted once.',
  'A session id (whole, or its first eight characters or more) is looked for in this project\'s sessions folders and',
  'its worktrees\'; --self (a flag) reads the session that runs the command, by CLAUDE_CODE_SESSION_ID. A cut last',
  'line, as a session still writing leaves, is counted as unreadable and in no figure.',
  'Exit 0 printed; 1 the transcript could not be found or read; 2 a usage error.',
].join('\n');

class SpendArgError extends Error {}

/** `{ json, self, given }` from the command line; a usage error throws `SpendArgError`. */
function parseArgs(argv) {
  const parsed = { json: false, self: false, given: undefined };
  for (const arg of argv) {
    if (arg === '--json') parsed.json = true;
    else if (arg === '--self') parsed.self = true;
    else if (arg.startsWith('--')) throw new SpendArgError(`unknown argument: ${arg}`);
    else if (parsed.given !== undefined) throw new SpendArgError(`one session at a time, not ${parsed.given} and ${arg}`);
    else parsed.given = arg;
  }
  if (parsed.self && parsed.given !== undefined) throw new SpendArgError('--self or a session, not both');
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
  const { json, self } = parsed;
  let { given } = parsed;
  if (self) {
    given = env.CLAUDE_CODE_SESSION_ID || undefined;
    if (given === undefined) return usage('--self reads CLAUDE_CODE_SESSION_ID, which is not set here: name the session or its transcript');
  }
  if (given === undefined) return usage('name a session, its transcript, or --self');

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

  let mainText;
  try {
    mainText = readFile(found.file);
  } catch (err) {
    stderr(`js-harness spend: could not read ${found.file} (${err.code ?? err.message})`);
    return 1;
  }
  // A sub-agent's file that cannot be read is left out and counted, so a short sum says why.
  const subagentDir = path.join(path.dirname(found.file), found.id, 'subagents');
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
  const spend = { id: found.id, file: found.file, ...spendOf(mainText, subagentTexts), subagentFiles: subagentTexts.length, unreadSubagentFiles };

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
  if (spend.unreadableLines > 0) lines.push(`unreadable: ${plural(spend.unreadableLines, 'line')}, in no figure (a session still writing ends on a cut line)`);
  if (unreadSubagentFiles > 0) lines.push(`not read: ${plural(unreadSubagentFiles, 'sub-agent file')}, left out of the sub-agents' sums`);
  lines.push('Each API message is one call, however many transcript lines repeat its usage.');
  stdout(lines.join('\n'));
  return 0;
}
