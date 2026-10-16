// `js-harness reply --hook`: the `Stop` hook of the reply check, C1 of odd/tasks/rule-hierarchy.md (T2). It reads the
// host's payload on standard input and judges the reply that ends the turn (`last_assistant_message`) by
// bin/lib/reply.mjs. A reply is already shown when the hook runs, so it cannot be refused before it is sent: the hook
// turns the stop back with the hooks contract's `decision: "block"` and its reason, and the session writes its close
// again in its next words.
//
// It acts only where the nearest `harness.json` above the session's folder holds a `reply` key, so the entry install
// writes for every session of the machine does nothing in a project that did not turn it on. It lets through a stop
// the hooks already turned back (`stop_hook_active`), so a session is turned back once per stop and never loops. It
// does not run for sub-agents: their end is the host's `SubagentStop`, not `Stop`. Its answer is always JSON and it
// always exits 0: Codex reads a `Stop` hook's exit 0 only with JSON on standard output (its hooks documentation, read
// on 2026-10-16), Claude Code reads `{}` as nothing to say, and whatever the hook cannot read lets the session stop.
import fs from 'node:fs';
import path from 'node:path';
import { replyConfig, replyRefusal } from './lib/reply.mjs';

const USAGE = 'Usage: js-harness reply --hook\n'
  + '  reads a Stop payload on standard input; where the nearest harness.json holds a "reply" key, turns the stop back\n'
  + '  when the reply does not close with exactly one state (working, decision, cut, finished, in the labels the key\n'
  + '  names) and what that state needs; writes nothing and always exits 0\n';

/** The parsed `harness.json` nearest above `start` (that folder included), or `null` when none is found. A file that
 * is there and cannot be read or parsed throws. */
function nearestHarness(start, readFile) {
  let dir = path.resolve(start);
  for (;;) {
    let text;
    try {
      text = readFile(path.join(dir, 'harness.json'));
    } catch (err) {
      if (err?.code !== 'ENOENT' && err?.code !== 'ENOTDIR') throw err;
    }
    if (text !== undefined) return JSON.parse(text);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** How many of the payload's background tasks still run (Claude Code's `background_tasks`; Codex sends none). */
const runningOf = (tasks) => (Array.isArray(tasks) ? tasks.filter((task) => task?.status === 'running').length : 0);

export async function replyMain(argv, {
  readStdin = () => fs.readFileSync(0, 'utf8'),
  readFile = (file) => fs.readFileSync(file, 'utf8'),
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
} = {}) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    stdout(USAGE);
    return 0;
  }
  if (argv.length !== 1 || argv[0] !== '--hook') {
    stderr(USAGE);
    return 2;
  }
  let reason = null;
  try {
    const payload = JSON.parse(readStdin());
    const message = payload?.last_assistant_message;
    if (payload?.stop_hook_active !== true && typeof message === 'string') {
      const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
      const config = replyConfig(nearestHarness(cwd, readFile));
      if (config?.error) stderr(`js-harness reply: ${config.error}; the reply check did not run\n`);
      else if (config !== null) reason = replyRefusal(message, config, { running: runningOf(payload.background_tasks) });
    }
  } catch {
    reason = null;
  }
  stdout(`${JSON.stringify(reason === null ? {} : { decision: 'block', reason })}\n`);
  return 0;
}
