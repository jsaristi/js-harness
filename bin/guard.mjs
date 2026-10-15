// `js-harness guard --hook`: the `PreToolUse` hook that checks a tool call before it runs
// (odd/tasks/honesty-audit.md, T13 and T14). It reads the host's payload on standard input and, to refuse, prints the
// hooks contract's deny with its reason; to let the call run, it prints nothing. It exits 0 whatever happens, and a
// failure inside it lets the call run: a check that cannot read what it checks says nothing rather than block work.
//   - `Agent`: the sub-agent's model against the rules in force in the project (bin/lib/guard.mjs, `modelRefusal`).
//   - `SendMessage` and `mcp__ccd_session_mgmt__send_message`: the hour a message stamps as its time of sending
//     against the clock (`hourRefusal`).
//   - `Bash`: backticks inside double quotes, which bash runs as commands (`backtickRefusal`); then a `node --test` of
//     several files outside a turn while another gate holds the machine's lock, refused with JH 8's warning line
//     unchanged (bin/lib/test-run-warning.mjs; his answers of 2026-10-14, S7 and S8).
//   - `Write` and `Edit`: a line of a project's memory index over the host's 150 characters, judged in the file the
//     call leaves (read from disk for an Edit) and only when the call brings it
//     (bin/lib/memory-index-guard.mjs; odd/tasks/memory-hygiene.md, T4). The hook runs on every Write and Edit of
//     every session, so that path loads nothing but that file: the modules of the other checks are imported only for
//     the tools they check. Then, for a Markdown file, a line that stamps today's date with an hour ahead of the clock
//     (bin/lib/document-hour-guard.mjs; odd/tasks/session-channel.md, T12b), imported only for a `.md` path.
// `js-harness guard --stop` is the `Stop` hook (odd/tasks/honesty-audit.md, T16): a reply that states the session's own
// context share more than 2 points from the share its transcript records (bin/lib/audit.mjs, `shareRefusal`). A reply
// is not a tool call and is already shown when the hook runs, so it cannot be refused before it is sent: the hook
// turns the stop back with the hooks contract's `decision: "block"` and its reason, and the session corrects the share
// in its next words. It never turns back a stop it already turned back (`stop_hook_active`), so it cannot loop; it
// reads the transcript only when the reply states a share, and a failure inside it lets the session stop.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { memoryIndexRefusal } from './lib/memory-index-guard.mjs';

const USAGE = 'Usage: js-harness guard --hook\n'
  + '  reads a PreToolUse payload on standard input; refuses an Agent call on a model the rules do not give, a\n'
  + '  message whose stamped hour is more than a minute off the clock, a Bash command with backticks inside double\n'
  + '  quotes, a node --test of several files while another gate holds the lock, and a Write or Edit that puts a line\n'
  + '  over 150 characters in a memory index (MEMORY.md) or a line in a Markdown file that stamps today with an hour\n'
  + '  ahead of the clock; always exits 0\n'
  + '       js-harness guard --stop\n'
  + '  reads a Stop payload on standard input; turns the stop back when the reply states this session\'s context share\n'
  + '  more than 2 points from the share its transcript records, so the session corrects it; always exits 0\n';

const MESSAGE_TOOLS = new Set(['SendMessage', 'mcp__ccd_session_mgmt__send_message']);
const FILE_TOOLS = new Set(['Write', 'Edit']);

/** The hooks contract's answer that refuses the call, with `reason` shown to the agent (the same as
 * bin/lib/guard.mjs's `denial`, written here so the Write and Edit path imports nothing more). */
const denial = (reason) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });

/** The top of the git work tree `cwd` is in, or `cwd` itself when git does not say. */
function gitRoot(cwd) {
  const result = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
  const [top] = String(result.stdout ?? '').split(/\r?\n/).filter((line) => line.trim() !== '');
  return result.status === 0 && top !== undefined ? path.resolve(top) : cwd;
}

/** The text of the project's rules file, or null when it has none. Any other failure throws. */
function rulesTextOf(root, readFile) {
  try {
    return readFile(path.join(root, 'bin', 'lib', 'rules-data.mjs'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Why the call of `payload` is refused, or null. */
async function refusalOf(payload, { now, projectRoot, readFile, testRun, readIndex, claudeConfigDir }) {
  const tool = payload?.tool_name;
  const input = payload?.tool_input ?? {};
  if (FILE_TOOLS.has(tool)) {
    const index = memoryIndexRefusal(tool, input, readIndex, claudeConfigDir);
    if (index !== null || !/\.md$/i.test(String(input.file_path ?? ''))) return index;
    return (await import('./lib/document-hour-guard.mjs')).documentHourRefusal(tool, input, now(), readIndex);
  }
  if (tool !== 'Agent' && tool !== 'Bash' && !MESSAGE_TOOLS.has(tool)) return null;
  const { allowedModels, backtickRefusal, hourRefusal, modelRefusal } = await import('./lib/guard.mjs');
  if (tool === 'Agent') {
    const root = projectRoot(typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd());
    return modelRefusal(input, allowedModels(rulesTextOf(root, readFile)));
  }
  if (MESSAGE_TOOLS.has(tool)) return hourRefusal(input.message, now());
  const backticks = backtickRefusal(input.command);
  if (backticks !== null) return backticks;
  const run = testRun ?? (await import('./lib/test-run-warning.mjs')).testRunWarning;
  return run(String(input.command ?? ''));
}

/** Why the reply that ends the turn of the `Stop` payload is to be corrected, or null. The text is the host's
 * `last_assistant_message`, else the transcript's last own reply: the host writes its transcript after the fact, so
 * the recorded share may be the step before the reply's, a tool result short of it. */
async function stopRefusalOf(payload, readTranscript) {
  if (payload?.stop_hook_active === true || typeof payload?.transcript_path !== 'string' || payload.transcript_path === '') return null;
  const { lastShare, shareRefusal } = await import('./lib/audit.mjs');
  const given = typeof payload.last_assistant_message === 'string' ? payload.last_assistant_message : null;
  // A reply that names no context share costs no read of the transcript; the window the share is of comes from it.
  if (given !== null && !(/context/i.test(given) && /\d\s?%/.test(given))) return null;
  const recorded = lastShare(readTranscript(payload.transcript_path).split(/\r?\n/));
  if (recorded === null) return null;
  return shareRefusal(given ?? recorded.text, recorded);
}

export async function guardMain(argv, {
  readStdin = () => fs.readFileSync(0, 'utf8'),
  now = () => new Date(),
  projectRoot = gitRoot,
  readFile = (file) => fs.readFileSync(file, 'utf8'),
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
  testRun,
  readIndex = (file) => fs.readFileSync(file, 'utf8'),
  claudeConfigDir = process.env.CLAUDE_CONFIG_DIR,
  readTranscript = (file) => fs.readFileSync(file, 'utf8'),
} = {}) {
  if (argv.length !== 1 || (argv[0] !== '--hook' && argv[0] !== '--stop')) {
    stderr(USAGE);
    return 2;
  }
  if (argv[0] === '--stop') {
    let turnBack = null;
    try {
      turnBack = await stopRefusalOf(JSON.parse(readStdin()), readTranscript);
    } catch {
      return 0;
    }
    if (turnBack !== null) stdout(`${JSON.stringify({ decision: 'block', reason: turnBack })}\n`);
    return 0;
  }
  let reason = null;
  try {
    reason = await refusalOf(JSON.parse(readStdin()), { now, projectRoot, readFile, testRun, readIndex, claudeConfigDir });
  } catch {
    return 0;
  }
  if (reason !== null) stdout(`${JSON.stringify(denial(reason))}\n`);
  return 0;
}
