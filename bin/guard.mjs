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
//   - `Write` and `Edit`: a line of a project's memory index over the host's 150 characters
//     (bin/lib/memory-index-guard.mjs; odd/tasks/memory-hygiene.md, T4). The hook runs on every Write and Edit of
//     every session, so that path loads nothing but that file: the modules of the other checks are imported only for
//     the tools they check.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { memoryIndexRefusal } from './lib/memory-index-guard.mjs';

const USAGE = 'Usage: js-harness guard --hook\n'
  + '  reads a PreToolUse payload on standard input; refuses an Agent call on a model the rules do not give, a\n'
  + '  message whose stamped hour is more than a minute off the clock, a Bash command with backticks inside double\n'
  + '  quotes, a node --test of several files while another gate holds the lock, and a Write or Edit that puts a line\n'
  + '  over 150 characters in a memory index (MEMORY.md); always exits 0\n';

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
async function refusalOf(payload, { now, projectRoot, readFile, testRun }) {
  const tool = payload?.tool_name;
  const input = payload?.tool_input ?? {};
  if (FILE_TOOLS.has(tool)) return memoryIndexRefusal(tool, input);
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

export async function guardMain(argv, {
  readStdin = () => fs.readFileSync(0, 'utf8'),
  now = () => new Date(),
  projectRoot = gitRoot,
  readFile = (file) => fs.readFileSync(file, 'utf8'),
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
  testRun,
} = {}) {
  if (argv.length !== 1 || argv[0] !== '--hook') {
    stderr(USAGE);
    return 2;
  }
  let reason = null;
  try {
    reason = await refusalOf(JSON.parse(readStdin()), { now, projectRoot, readFile, testRun });
  } catch {
    return 0;
  }
  if (reason !== null) stdout(`${JSON.stringify(denial(reason))}\n`);
  return 0;
}
