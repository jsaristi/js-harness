// `advisor-gate`: the hook that holds the acts that decide (a question to him, a land, a session opened, a plan or a
// task document begun, a piece said ready or closed, a sub-agent's end) to a consultation of the Fable advisor in the
// same stretch of work (odd/tasks/advisor-use.md, P1 and P2, his yes to question 282). Why a hook: with the tool on
// for every role since 2026-11-12, the lead consulted it before 6 of its 20 questions, and the host's own prompt
// already asks (M2, Depth pass 1). Policy R: one advisor call with a result covers every gated act after it until his
// next message (typed or queued), the next session event, or STRETCH_TOOL_CALLS tool calls.
// This is the warning week (P3): an uncovered act gets a notice through `additionalContext` (probe 4, which showed it
// reaches the model) and goes through; refusing is a one-line change of MODE after the report. It fails open: an
// unreadable transcript or payload lets the act through, recorded unchecked. It acts only in a js-harness project
// (a `harness.json` at or above the cwd), since the entry is in the user's settings and runs everywhere.
import fs from 'node:fs';
import path from 'node:path';
import { seniorTitle } from './lib/session-title-guard.mjs';
import { advisorSay } from './lib/advisor-gate.mjs';
import { recordFileOf } from './lib/background.mjs';
import { harnessHome } from './lib/home.mjs';

/** The stretch's bound in tool calls (policy R, P1). */
export const STRETCH_TOOL_CALLS = 60;
/** `warn` lets an uncovered act through with a notice; `refuse` denies it. The week of warnings is his answer to 282. */
export const MODE = 'warn';
/** How much of a transcript's end is read: R needs at most STRETCH_TOOL_CALLS tool calls back, and the hook has 5 s. */
const TAIL_BYTES = 4 * 1024 * 1024;
const SCHEMA = 'js-harness.advisor-gate/v1';
const ADVISOR_TOOL_TYPE = 'advisor_20260301';

const USAGE = `Usage: js-harness advisor-gate --hook    (PreToolUse: the hook payload on standard input)
       js-harness advisor-gate --stop    (SubagentStop: the hook payload on standard input)
  Holds the acts that decide to an advisor call with a result in the caller's stretch (policy R): since his last
  message or the last session event, within ${STRETCH_TOOL_CALLS} tool calls. Mode ${MODE}: an uncovered act gets a notice and goes
  through. Every decision is appended to <home>/.js-harness/advisor-gate/decisions.jsonl. It prints {} outside a
  project with a harness.json, and fails open: what it cannot read lets the act through, recorded unchecked.
  Exit 2: a usage error.`;

/** A command runs js-harness (installed or `node bin/js-harness.mjs`) with `verb` somewhere after it. */
const runs = (command, verb) => new RegExp(`js-harness(?:\\.mjs)?\\b[^\\n]*?\\s${verb}\\b`).test(command);
/** The command with its quoted text blanked, so a message, a commit body or a grep pattern that names a gated command
 * is not one; a value quoted right after `--kind` (`--kind "ready"`) keeps its text, as the shell passes it. */
const unquoted = (command) => command.replace(/(--kind\s+)?("[^"]*"|'[^']*')/g, (quoted, option, text) => (option ? option + text.slice(1, -1) : '""'));
/** The value of `--kind` in an unquoted command. */
const kindOf = (command) => /--kind\s+(\w+)/.exec(command)?.[1] ?? null;

/** The act a tool call is, or `null` when it is not gated: `question`, `land`, `session`, `plan` or `done`. */
export function gatedAct(tool, input, cwd) {
  if (tool === 'AskUserQuestion') return 'question';
  if (tool === 'mcp__ccd_session__start_session') return 'session';
  if (tool === 'ExitPlanMode') return 'plan';
  if (tool === 'Write') {
    const file = typeof input?.file_path === 'string' ? path.resolve(cwd, input.file_path) : '';
    return /[\\/]odd[\\/]tasks[\\/][^\\/]+\.md$/.test(file) && !fs.existsSync(file) ? 'plan' : null;
  }
  if (tool !== 'Bash' || typeof input?.command !== 'string') return null;
  if (!/js-harness/.test(input.command)) return null;
  const command = unquoted(input.command);
  if (runs(command, 'notify')) {
    const kind = kindOf(command);
    if (kind === 'question') return 'question';
    if (kind === 'ready' || kind === 'closed') return 'done';
  }
  if (runs(command, 'merge-queue') && /--land\b/.test(command) && !/--dry-run\b/.test(command)) return 'land';
  if (runs(command, 'sessions\\s+start') && !/--help\b/.test(command)) return 'session';
  return null;
}

/** The folder of the nearest `harness.json`, at `folder` or above it, or `null`. */
function nearestHarness(folder) {
  for (let at = path.resolve(folder); ; at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, 'harness.json'))) return at;
    if (path.dirname(at) === at) return null;
  }
}

/** The lines of the last `tailBytes` of `file`, the first (partial) one dropped when the file is longer. */
function tailLines(file, tailBytes) {
  const size = fs.statSync(file).size;
  const start = Math.max(0, size - tailBytes);
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    const lines = buffer.toString('utf8').split('\n');
    return start > 0 ? lines.slice(1) : lines;
  } finally {
    fs.closeSync(fd);
  }
}

/** What breaks a stretch, or `null`: his message (typed, or queued while the session worked) or a session event. */
function breakOf(entry) {
  if (entry.type === 'attachment' && entry.attachment?.type === 'queued_command' && entry.attachment?.origin?.kind === 'human') return 'his message';
  if (entry.type !== 'user' || entry.isMeta || entry.toolUseResult) return null;
  const content = entry.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.filter((c) => c?.type === 'text').map((c) => c.text).join(' ') : '';
  if (text.trim() === '') return null;
  const head = text.trim();
  if (/^<(side-sessions-event|cross-session-message)/.test(head)) return 'session event';
  if (/^<(task-notification|system-reminder|local-command|command-|ci-monitor)/.test(head) || /^Stop hook feedback/.test(head)) return null;
  return 'his message';
}

/** Policy R's stretch at the end of the transcript `file`: `{ calls, errors, broken, toolCalls, model, hadAdvisor }`.
 * `calls` counts advisor calls with a result that is not an error, `errors` those whose result is one; `broken` says
 * what ended the stretch (his message, a session event, the tool-call bound, or the start of what was read);
 * `hadAdvisor` is true, false or null (not known), from the last assistant entry's `advisorModel` when it differs from
 * its model, else from a request-shape line naming the advisor tool (M1). Throws when the file cannot be read. */
export function readStretch(file, { tailBytes = TAIL_BYTES } = {}) {
  const lines = tailLines(file, tailBytes);
  const results = new Map();
  for (const line of lines) {
    if (!line.includes('advisor_tool_result')) continue;
    for (const m of line.matchAll(/"type":"advisor_tool_result","tool_use_id":"([^"]+)","content":\{"type":"([^"]+)"/g)) results.set(m[1], m[2]);
  }
  let model = null;
  let hadAdvisor = null;
  let shape = false;
  let calls = 0;
  let errors = 0;
  let toolCalls = 0;
  let broken = 'start of the transcript read';
  const seenTools = new Set();
  const seenCalls = new Set();
  let open = true;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line === '') continue;
    if (!shape && line.includes(`"${ADVISOR_TOOL_TYPE}"`)) shape = true;
    if (!open && model !== null && shape) break;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type === 'assistant' && model === null && entry.message?.model && entry.message.model !== '<synthetic>') {
      model = entry.message.model;
      if (typeof entry.advisorModel === 'string' && entry.advisorModel !== '' && entry.advisorModel !== model) hadAdvisor = true;
    }
    if (!open) continue;
    const ended = breakOf(entry);
    if (ended !== null) {
      broken = ended;
      open = false;
      continue;
    }
    if (entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
    for (const block of [...entry.message.content].reverse()) {
      if (block?.type === 'tool_use' && !seenTools.has(block.id)) {
        seenTools.add(block.id);
        toolCalls++;
        if (toolCalls >= STRETCH_TOOL_CALLS) {
          broken = `${STRETCH_TOOL_CALLS} tool calls`;
          open = false;
          break;
        }
      } else if (block?.type === 'server_tool_use' && block.name === 'advisor' && !seenCalls.has(block.id)) {
        seenCalls.add(block.id);
        const result = results.get(block.id);
        if (result === undefined) continue;
        if (/error/.test(result)) errors++;
        else calls++;
      }
    }
  }
  if (hadAdvisor === null && shape) hadAdvisor = true;
  return { calls, errors, broken, toolCalls, model, hadAdvisor };
}

/** The title of the session `sessionId` in the background record under `home`, or `null`. */
function backgroundTitle(home, sessionId) {
  if (typeof sessionId !== 'string') return null;
  let text;
  try {
    text = fs.readFileSync(recordFileOf(home), 'utf8');
  } catch {
    return null;
  }
  let title = null;
  for (const line of text.split('\n')) {
    if (!line.includes(sessionId)) continue;
    try {
      const record = JSON.parse(line);
      if (record.sessionId !== sessionId) continue;
      if (record.event === 'started') title = record.title ?? null;
      if (record.event === 'removed') title = null;
    } catch {
      // A torn line names no session.
    }
  }
  return title;
}

function record(home, decision, stderr) {
  const file = path.join(home, '.js-harness', 'advisor-gate', 'decisions.jsonl');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify({ schema: SCHEMA, ...decision })}\n`);
  } catch (err) {
    stderr(`js-harness advisor-gate: cannot append to ${file}: ${err.message}; the decision stands`);
  }
}

const NOTICE = (act) => [
  advisorSay('missed', { act: act === 'end' ? 'sub-agent end' : `act (${act})`, calls: STRETCH_TOOL_CALLS }), advisorSay('how'), advisorSay('week'),
].join(' ');

/** Decides one act of `payload` and records it; returns the hook's answer object. */
function decide(mode, payload, seams) {
  const { home, stderr } = seams;
  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : seams.cwd;
  const act = mode === '--stop' ? 'end' : gatedAct(payload.tool_name, payload.tool_input, cwd);
  if (act === null) return {};
  if (nearestHarness(cwd) === null) return {};
  const agent = typeof payload.agent_id === 'string' ? payload.agent_id : null;
  const base = { at: new Date(seams.now).toISOString(), session: payload.session_id ?? null, agent, act, tool: payload.tool_name ?? null, cwd };
  if (mode === '--stop') base.secondStop = payload.stop_hook_active === true;
  const title = backgroundTitle(home, payload.session_id);
  if (agent === null && seniorTitle(title)) return record(home, { ...base, decision: 'exempt-senior', title }, stderr), {};
  let file = mode === '--stop' ? payload.agent_transcript_path : payload.transcript_path;
  if (mode !== '--stop' && agent !== null && typeof payload.transcript_path === 'string') {
    file = path.join(path.dirname(payload.transcript_path), String(payload.session_id), 'subagents', `agent-${agent}.jsonl`);
  }
  let stretch;
  try {
    if (typeof file !== 'string') throw new Error('no transcript path in the payload');
    stretch = readStretch(file);
  } catch (err) {
    const reason = `cannot read the transcript ${file ?? ''}: ${err.code ?? err.message}; the act goes through unchecked`;
    stderr(`js-harness advisor-gate: ${reason}`);
    return record(home, { ...base, decision: 'unchecked', reason }, stderr), {};
  }
  const facts = { model: stretch.model, calls: stretch.calls, errors: stretch.errors, toolCalls: stretch.toolCalls, broken: stretch.broken };
  if (typeof stretch.model === 'string' && /fable/.test(stretch.model)) return record(home, { ...base, ...facts, decision: 'exempt-same-model' }, stderr), {};
  if (stretch.hadAdvisor !== true) {
    return record(home, { ...base, ...facts, decision: 'unchecked', reason: 'no sign the caller had the advisor tool' }, stderr), {};
  }
  if (stretch.calls > 0) return record(home, { ...base, ...facts, decision: 'covered' }, stderr), {};
  if (stretch.errors >= 2) return record(home, { ...base, ...facts, decision: 'outage' }, stderr), {};
  record(home, { ...base, ...facts, decision: 'flagged', mode: MODE }, stderr);
  if (mode === '--stop') return {};
  if (MODE === 'refuse') return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: NOTICE(act) } };
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: NOTICE(act) } };
}

/** A usage error of the argv: its message names the token, the usage follows, exit 2. */
class AdvisorGateArgError extends Error {}

/** `js-harness advisor-gate --hook | --stop`. Seams for the tests: `readStdin`, `home`, `cwd`, `now`. */
export function advisorGateMain(argv, {
  stdout = (s) => process.stdout.write(s), stderr = console.error, readStdin = () => fs.readFileSync(0, 'utf8'),
  home, env = process.env, cwd = process.cwd(), now = Date.now(),
} = {}) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    stdout(`${USAGE}\n`);
    return 0;
  }
  try {
    if (argv.length === 0) throw new AdvisorGateArgError('advisor-gate needs --hook or --stop');
    const unknown = argv.find((token) => !['--hook', '--stop'].includes(token));
    if (unknown !== undefined) throw new AdvisorGateArgError(`unknown argument: ${unknown}`);
    if (argv.length !== 1) throw new AdvisorGateArgError('advisor-gate takes one of --hook or --stop');
  } catch (err) {
    if (!(err instanceof AdvisorGateArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  let payload;
  try {
    payload = JSON.parse(readStdin());
  } catch {
    stdout('{}');
    return 0;
  }
  try {
    stdout(JSON.stringify(decide(argv[0], payload ?? {}, { home: harnessHome({ given: home, env, cwd }), cwd, now, stderr })));
  } catch (err) {
    stderr(`js-harness advisor-gate: ${err.message}; the act goes through unchecked`);
    stdout('{}');
  }
  return 0;
}
