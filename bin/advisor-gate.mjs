// `advisor-gate`: the hook that holds the acts that decide (a question to him, a land, a session opened, a plan or a
// task document begun, a piece said ready or closed, a block said with a `waiting` notice (odd/tasks/consistent-orders.md,
// S1), a sub-agent's end) to a consultation of the Fable advisor in the
// same stretch of work (odd/tasks/advisor-use.md, P1 and P2, his yes to question 282). Why a hook: with the tool on
// for every role since 2026-11-12, the lead consulted it before 6 of its 20 questions, and the host's own prompt
// already asks (M2, Depth pass 1). Policy R: one advisor call with a result covers every gated act after it until his
// next message (typed or queued), the next session event, or STRETCH_TOOL_CALLS tool calls.
// It refuses an uncovered act (his answer to question 285, which moved refusal ahead of the warning week of P3): the
// reason says how to consult and retry, and the decision is recorded either way. A sub-agent's uncovered end is turned
// back once and its next stop let through (his answer to question 294, odd/tasks/consistent-orders.md S4). It fails open: an unreadable transcript or payload lets the act through, recorded
// unchecked. It acts only in a js-harness project
// (a `harness.json` at or above the cwd), since the entry is in the user's settings and runs everywhere.
import fs from 'node:fs';
import path from 'node:path';
import { seniorTitle } from './lib/session-title-guard.mjs';
import { advisorSay } from './lib/advisor-gate.mjs';
import { recordFileOf } from './lib/background.mjs';
import { harnessHome } from './lib/home.mjs';

/** The stretch's bound in tool calls (policy R, P1). */
export const STRETCH_TOOL_CALLS = 60;
/** The Fable tokens a day the hook is estimated to add (odd/tasks/advisor-use.md, Depth pass), which the report weighs. */
export const ESTIMATED_DAILY_TOKENS = 2_400_000;
/** What an uncovered act gets, recorded on each flag: refusal, his answer to question 285, which ended the warning week. */
export const MODE = 'refuse';
/** How much of a transcript's end is read: R needs at most STRETCH_TOOL_CALLS tool calls back, and the hook has 5 s. */
const TAIL_BYTES = 4 * 1024 * 1024;
/** How much of the decision log's end is read for an earlier turn-back: 357 ends took 235 kB in four days. */
const DECISIONS_TAIL_BYTES = 1024 * 1024;
const SCHEMA = 'js-harness.advisor-gate/v1';
const ADVISOR_TOOL_TYPE = 'advisor_20260301';

const USAGE = `Usage: js-harness advisor-gate --hook    (PreToolUse: the hook payload on standard input)
       js-harness advisor-gate --stop    (SubagentStop: the hook payload on standard input)
       js-harness advisor-gate report [--since <YYYY-MM-DD>]
  Holds the acts that decide to an advisor call with a result in the caller's stretch (policy R): since his last
  message or the last session event, within ${STRETCH_TOOL_CALLS} tool calls. Mode ${MODE}: an uncovered act is refused, its reason
  saying how to consult and retry; a sub-agent's uncovered end (--stop) is turned back once, its next stop let through, and one whose transcript does not exist is recorded
  no-transcript with its agent type. Every decision is appended to <home>/.js-harness/advisor-gate/decisions.jsonl. It prints {} outside a
  project with a harness.json, and fails open: what it cannot read lets the act through, recorded unchecked.
  report: the decisions by day, kind and act, and the Fable input tokens of the advisor calls that followed a flag in
  its stretch with a result (the calls the flags prompted), against the estimate of ${ESTIMATED_DAILY_TOKENS} a day;
  then the gated acts the transcripts under <home>/.claude/projects show since the first decision, with and without
  a decision, and the share let through unchecked.
  Exit 2: a usage error.`;

/** A command runs js-harness (installed or `node bin/js-harness.mjs`) with `verb` somewhere after it. */
const runs = (command, verb) => new RegExp(`js-harness(?:\\.mjs)?\\b[^\\n]*?\\s${verb}\\b`).test(command);
/** The command with its quoted text blanked, so a message, a commit body or a grep pattern that names a gated command
 * is not one. Quoted text that the shell runs keeps its text: a value right after `--kind` (`--kind "ready"`), the
 * command of a `-c` (`bash -c "js-harness sessions start ..."`), and a quoted path to js-harness
 * (`node "C:/work/bin/js-harness.mjs" merge-queue --land`). */
const unquoted = (command) => command.replace(/(--kind\s+|\b(?:bash|sh|zsh|pwsh|powershell)(?:\.exe)?(?:\s+--?[\w-]+)*?\s+-(?:\w*c|Command)\s+)?("[^"]*"|'[^']*')/g, (quoted, before, text) => {
  const inner = text.slice(1, -1);
  if (before || /(?:^|[\\/])js-harness(?:\.mjs)?$/.test(inner)) return (before ?? '') + inner;
  return '""';
});
/** The value of `--kind` in an unquoted command. */
/** Every value of `--kind` in an unquoted command: a chain may send two notices, and notify keeps the last of a repeated
 * flag, so the first alone could hide a gated one (the verifier's finding, odd/tasks/consistent-orders.md). */
const kindsOf = (command) => [...command.matchAll(/--kind\s+(\w+)/g)].map((match) => match[1]);

/** A task document's path, whose creation is a plan. */
const TASK_DOCUMENT = /[\\/]odd[\\/]tasks[\\/][^\\/]+\.md$/;

/** The act a tool call is, or `null` when it is not gated: `question`, `land`, `session`, `plan`, `done` or
 * `waiting`. */
export function gatedAct(tool, input, cwd) {
  if (tool === 'AskUserQuestion') return 'question';
  if (tool === 'mcp__ccd_session__start_session') return 'session';
  if (tool === 'ExitPlanMode') return 'plan';
  if (tool === 'Write') {
    const file = typeof input?.file_path === 'string' ? path.resolve(cwd, input.file_path) : '';
    return TASK_DOCUMENT.test(file) && !fs.existsSync(file) ? 'plan' : null;
  }
  if (tool !== 'Bash' || typeof input?.command !== 'string') return null;
  if (!/js-harness/.test(input.command)) return null;
  const command = unquoted(input.command);
  if (runs(command, 'notify')) {
    const kinds = kindsOf(command);
    if (kinds.includes('question')) return 'question';
    if (kinds.includes('ready') || kinds.includes('closed')) return 'done';
    // A block is consulted before it is said (odd/tasks/consistent-orders.md, S1): on 2026-11-15 two unconsulted
    // `waiting` notices preceded a session's 2 h 40 min wait.
    if (kinds.includes('waiting')) return 'waiting';
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
  // A compaction's summary ends the stretch by its own mark, not only by reading as his message, so a host that someday
  // marks it `isMeta` does not let a consult made before the compaction cover acts after it (odd/tasks/consistent-orders.md, L8).
  if (entry.isCompactSummary === true) return 'compaction';
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
 * what ended the stretch (his message, a session event, a compaction, the tool-call bound, or the start of what was read);
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
    return true;
  } catch (err) {
    stderr(`js-harness advisor-gate: cannot append to ${file}: ${err.message}; the decision stands`);
    return false;
  }
}

/** The reason a refused PreToolUse act is given; a sub-agent's end is turned back with its own, END_NOTICE. */
const NOTICE = (act) => [
  advisorSay('missed', { act: `act (${act})`, calls: STRETCH_TOOL_CALLS }), advisorSay('how'), advisorSay('refused'),
].join(' ');

/** What a sub-agent hears when its end is turned back: consult, then end with its whole result, since its caller reads
 * only its last message; it is turned back once. */
const END_NOTICE = [
  advisorSay('missed', { act: 'act (end)', calls: STRETCH_TOOL_CALLS }), advisorSay('how'),
  'Your end is turned back once: consult the advisor, then end by giving your whole result again, as your caller reads only your last message; the next stop goes through.',
].join(' ');

/** Whether the newest end the log under `home` holds of the sub-agent `agent` of `session` is a turn-back, so this
 * stop is that end's repeat: its tail, which a turn-back and its next stop sit close in. No log holds none (`false`);
 * one there that cannot be read gives `null`. */
function turnedBackBefore(home, session, agent) {
  let text;
  try {
    const file = path.join(home, '.js-harness', 'advisor-gate', 'decisions.jsonl');
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r');
    try {
      const length = Math.min(size, DECISIONS_TAIL_BYTES);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      text = buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    // No log yet holds no turn-back; one there and unreadable cannot say, and the caller lets the end through.
    return err.code === 'ENOENT' ? false : null;
  }
  // Once is per end (his words, "ese final"): only when this sub-agent's newest end is the turn-back is this stop its
  // repeat; a later end of the same sub-agent, resumed say, is its own.
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry?.act === 'end' && entry.agent === agent && entry.session === session) return entry.turnedBack === true;
  }
  return false;
}

/** Whether `file` does not exist: only ENOENT, so a transcript there but unreadable stays unchecked. */
function missing(file) {
  try {
    fs.statSync(file);
    return false;
  } catch (err) {
    return err.code === 'ENOENT';
  }
}

/** Decides one act of `payload` and records it; returns the hook's answer object. */
function decide(mode, payload, seams) {
  const { home, stderr } = seams;
  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : seams.cwd;
  const act = mode === '--stop' ? 'end' : gatedAct(payload.tool_name, payload.tool_input, cwd);
  if (act === null) return {};
  if (nearestHarness(cwd) === null) return {};
  const agent = typeof payload.agent_id === 'string' ? payload.agent_id : null;
  const base = { at: new Date(seams.now).toISOString(), session: payload.session_id ?? null, agent, act, tool: payload.tool_name ?? null, toolUseId: typeof payload.tool_use_id === 'string' ? payload.tool_use_id : null, agentType: typeof payload.agent_type === 'string' ? payload.agent_type : null, cwd };
  if (mode === '--stop') base.secondStop = payload.stop_hook_active === true;
  const title = backgroundTitle(home, payload.session_id);
  if (agent === null && seniorTitle(title)) return record(home, { ...base, decision: 'exempt-senior', title }, stderr), {};
  let file = mode === '--stop' ? payload.agent_transcript_path : payload.transcript_path;
  if (mode !== '--stop' && agent !== null && typeof payload.transcript_path === 'string') {
    file = path.join(path.dirname(payload.transcript_path), String(payload.session_id), 'subagents', `agent-${agent}.jsonl`);
  }
  // An end whose transcript does not exist is no sub-agent the gate can read: the host's own agents after a turn write
  // none (L24). It is recorded apart, by its agent type, so the unchecked share counts only acts a read failed for.
  if (mode === '--stop' && typeof file === 'string' && missing(file)) return record(home, { ...base, transcript: file, decision: 'no-transcript' }, stderr), {};
  let stretch;
  try {
    if (typeof file !== 'string') throw new Error('no transcript path in the payload');
    stretch = readStretch(file);
  } catch (err) {
    const reason = `cannot read the transcript ${file ?? ''}: ${err.code ?? err.message}; the act goes through unchecked`;
    stderr(`js-harness advisor-gate: ${reason}`);
    return record(home, { ...base, decision: 'unchecked', reason }, stderr), {};
  }
  const facts = { transcript: file, model: stretch.model, calls: stretch.calls, errors: stretch.errors, toolCalls: stretch.toolCalls, broken: stretch.broken };
  if (typeof stretch.model === 'string' && /fable/.test(stretch.model)) return record(home, { ...base, ...facts, decision: 'exempt-same-model' }, stderr), {};
  if (stretch.hadAdvisor !== true) {
    return record(home, { ...base, ...facts, decision: 'unchecked', reason: 'no sign the caller had the advisor tool' }, stderr), {};
  }
  if (stretch.calls > 0) return record(home, { ...base, ...facts, decision: 'covered' }, stderr), {};
  if (stretch.errors >= 2) return record(home, { ...base, ...facts, decision: 'outage' }, stderr), {};
  // A sub-agent's end is turned back once (his answer to question 294): the second stop goes through, as the reply
  // hook's. Once rests on the host's flag and on this log's own record of the turn-back, so a payload without the flag
  // never loops.
  // An end the log shows turned back is its repeat (afterTurnBack), which the report counts once with it; one let
  // through by the host's flag alone (another hook may have turned it back) stays a flag of its own.
  // A log it cannot read (null) or write leaves once unheld, so the end goes through, as his answer asks of a record
  // that cannot be read.
  const prior = mode === '--stop' ? turnedBackBefore(home, base.session, agent) : false;
  const afterTurnBack = prior === true;
  const turnBack = mode === '--stop' && !base.secondStop && prior === false;
  const written = record(home, { ...base, ...facts, decision: 'flagged', mode: MODE, ...(turnBack ? { turnedBack: true } : {}), ...(mode === '--stop' ? { afterTurnBack } : {}) }, stderr);
  if (mode === '--stop') return turnBack && written ? { decision: 'block', reason: END_NOTICE } : {};
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: NOTICE(act) } };
}

/** The entries of the transcript `file`, torn lines dropped. Throws when it cannot be read. */
const entriesOf = (file) => fs.readFileSync(file, 'utf8').split('\n').flatMap((line) => {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
});

/** What `entries` hold about advisor calls: the ids of the calls whose result is not an error, and each message's
 * Fable input tokens, the largest any of its lines carries (the host writes a message over several lines, the final
 * usage on a later one, as `usageOf` in bin/lib/subagent-count.mjs reads it). */
function advisorFacts(entries) {
  const answered = new Set();
  const tokens = new Map();
  for (const entry of entries) {
    if (entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
    for (const block of entry.message.content) {
      if (block?.type === 'advisor_tool_result' && !/error/.test(block.content?.type ?? 'error')) answered.add(block.tool_use_id);
    }
    const id = entry.message.id;
    const n = (entry.message.usage?.iterations ?? []).filter((it) => it?.type === 'advisor_message').reduce((sum, it) => sum + (it.input_tokens ?? 0), 0);
    if (typeof id === 'string' && n > (tokens.get(id) ?? 0)) tokens.set(id, n);
  }
  return { answered, tokens };
}

/** The advisor calls with a result in `entries` that follow the moment `at` within its stretch (policy R: until his
 * message, a session event or STRETCH_TOOL_CALLS tool calls), as `{ message, at }`. */
function callsAfter(entries, at, { answered }) {
  const found = [];
  let toolCalls = 0;
  for (const entry of entries) {
    if (typeof entry.timestamp !== 'string' || entry.timestamp <= at) continue;
    if (breakOf(entry) !== null) break;
    if (entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
    for (const block of entry.message.content) {
      if (block?.type === 'server_tool_use' && block.name === 'advisor' && answered.has(block.id)) found.push({ message: entry.message.id ?? block.id, at: entry.timestamp });
      if (block?.type === 'tool_use') toolCalls++;
    }
    if (toolCalls >= STRETCH_TOOL_CALLS) break;
  }
  return found;
}

/** The `.jsonl` files under `folder`, at any depth (sub-agents' transcripts sit below their session's), changed on
 * `day` or later. */
function transcriptsUnder(folder, day) {
  const found = [];
  let names;
  try {
    names = fs.readdirSync(folder, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const name of names) {
    const at = path.join(folder, name.name);
    if (name.isDirectory()) found.push(...transcriptsUnder(at, day));
    else if (name.name.endsWith('.jsonl')) {
      try {
        if (fs.statSync(at).mtime.toISOString().slice(0, 10) >= day) found.push(at);
      } catch {
        // A file gone between the listing and its stat holds no act.
      }
    }
  }
  return found;
}

/** Whether two paths name one file: the host writes `transcript_path` in its own spelling, and Windows ignores case and
 * takes either slash. */
const samePath = (a, b) => (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));

/** The gated acts of the transcripts under `projects` from `from` on, each matched to a decision: by the tool call's
 * id when the decision recorded one, else by transcript, act and a decision within 120 s after the call, each
 * decision used once. A sub-agent's end is no tool call and is left out. */
function reconcile(projects, from, decisions) {
  const byToolUse = new Map(decisions.filter((d) => typeof d.toolUseId === 'string').map((d) => [d.toolUseId, d]));
  const loose = decisions.filter((d) => typeof d.toolUseId !== 'string' && typeof d.transcript === 'string');
  const used = new Set();
  const harnessOf = new Map();
  const inProject = (cwd) => {
    if (!harnessOf.has(cwd)) harnessOf.set(cwd, nearestHarness(cwd) !== null);
    return harnessOf.get(cwd);
  };
  const acts = { found: 0, decided: 0, missing: [], unread: 0 };
  for (const file of transcriptsUnder(projects, from.slice(0, 10))) {
    let entries;
    try {
      entries = entriesOf(file);
    } catch {
      acts.unread++;
      continue;
    }
    const created = new Set(entries.filter((e) => e.toolUseResult?.type === 'create').flatMap((e) => (Array.isArray(e.message?.content) ? e.message.content : []).map((b) => b?.tool_use_id)));
    for (const entry of entries) {
      if (entry.type !== 'assistant' || typeof entry.timestamp !== 'string' || entry.timestamp < from || !Array.isArray(entry.message?.content)) continue;
      const cwd = typeof entry.cwd === 'string' ? entry.cwd : null;
      if (cwd === null || !inProject(cwd)) continue;
      for (const block of entry.message.content) {
        if (block?.type !== 'tool_use') continue;
        const act = block.name === 'Write'
          ? (created.has(block.id) && typeof block.input?.file_path === 'string' && TASK_DOCUMENT.test(path.resolve(cwd, block.input.file_path)) ? 'plan' : null)
          : gatedAct(block.name, block.input, cwd);
        if (act === null) continue;
        acts.found++;
        const limit = new Date(Date.parse(entry.timestamp) + 120_000).toISOString();
        const match = byToolUse.get(block.id) ?? loose.find((d) => !used.has(d) && samePath(d.transcript, file) && d.act === act && d.at >= entry.timestamp && d.at <= limit);
        if (match === undefined) {
          acts.missing.push({ act, tool: block.name, at: entry.timestamp, transcript: file });
          continue;
        }
        used.add(match);
        acts.decided++;
      }
    }
  }
  return acts;
}

/** The report of the decisions under `home` since `since` (an ISO day, or null): `{ days, acts, unchecked, decisions,
 * noTranscript, unread, untraced, estimate }`; `decisions` leaves out the ends with no transcript, which `noTranscript`
 * counts by agent type. Each day holds its decisions by kind and by act, how many of its flags an advisor
 * call with a result followed in their stretch, and the Fable input tokens of those calls on that day, each call once.
 * `acts` reconciles the decisions with the gated acts the transcripts under `projects` show since the first decision.
 * A transcript that cannot be read (`unread`) or a flag that recorded none (`untraced`) is counted, not guessed. */
export function advisorGateReport({ home, since = null, projects = path.join(home, '.claude', 'projects') } = {}) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(home, '.js-harness', 'advisor-gate', 'decisions.jsonl'), 'utf8');
  } catch {
    // No decisions yet: an empty report.
  }
  const all = text.split('\n').flatMap((line) => {
    try {
      const d = JSON.parse(line);
      return d?.schema === SCHEMA && typeof d.at === 'string' ? [d] : [];
    } catch {
      return [];
    }
  });
  const inRange = (at) => since === null || at.slice(0, 10) >= since;
  const days = new Map();
  const dayOf = (at) => {
    const day = at.slice(0, 10);
    if (!days.has(day)) days.set(day, { day, decisions: {}, acts: {}, flagged: 0, followed: 0, addedTokens: 0 });
    return days.get(day);
  };
  // A turned-back end flagged again at its next stop is the same end (afterTurnBack): one flag, one per act. An end
  // recorded before the field existed says nothing of it, and its second stop stays the repeat it was counted as.
  const repeat = (d) => d.afterTurnBack === true || (d.act === 'end' && d.afterTurnBack === undefined && d.secondStop === true);
  const isFlag = (d) => d.decision === 'flagged' && !repeat(d);
  const shown = all.filter((d) => inRange(d.at));
  for (const d of shown) {
    const row = dayOf(d.at);
    row.decisions[d.decision] = (row.decisions[d.decision] ?? 0) + 1;
    row.acts[d.act] = (row.acts[d.act] ?? 0) + 1;
    if (isFlag(d)) row.flagged++;
  }
  // Every flag is read, in range or not: one before midnight can prompt a call after it, whose tokens are that day's.
  const flagsByTranscript = new Map();
  let untraced = 0;
  for (const d of all.filter(isFlag)) {
    if (typeof d.transcript !== 'string') {
      if (inRange(d.at)) untraced++;
      continue;
    }
    if (!flagsByTranscript.has(d.transcript)) flagsByTranscript.set(d.transcript, []);
    flagsByTranscript.get(d.transcript).push(d);
  }
  let unread = 0;
  const counted = new Set();
  for (const [file, flags] of flagsByTranscript) {
    let entries;
    try {
      entries = entriesOf(file);
    } catch {
      if (flags.some((d) => inRange(d.at))) unread++;
      continue;
    }
    const facts = advisorFacts(entries);
    for (const flag of flags) {
      const calls = callsAfter(entries, flag.at, facts);
      if (calls.length > 0 && inRange(flag.at)) dayOf(flag.at).followed++;
      for (const call of calls) {
        const key = `${file}\n${call.message}`;
        if (counted.has(key) || !inRange(call.at)) continue;
        counted.add(key);
        dayOf(call.at).addedTokens += facts.tokens.get(call.message) ?? 0;
      }
    }
  }
  // Decisions written before `toolUseId` was recorded cannot be matched, so the reconciliation starts after them.
  const first = all.filter((d) => 'toolUseId' in d).reduce((min, d) => (min === null || d.at < min ? d.at : min), null);
  const from = first === null ? null : since !== null && since > first ? since : first;
  const acts = from === null ? { found: 0, decided: 0, missing: [], unread: 0 } : reconcile(projects, from, all);
  // An end recorded before T7 as unchecked because its transcript did not exist (ENOENT) is read as one with no
  // transcript, so the share covers the past too; decisions.jsonl itself is not rewritten.
  const noTranscriptEnd = (d) => d.decision === 'no-transcript' || (d.act === 'end' && d.decision === 'unchecked' && /: ENOENT;/.test(d.reason ?? ''));
  const noTranscript = {};
  for (const d of shown.filter(noTranscriptEnd)) noTranscript[d.agentType ?? 'unknown'] = (noTranscript[d.agentType ?? 'unknown'] ?? 0) + 1;
  const decided = shown.filter((d) => !noTranscriptEnd(d));
  return {
    days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    acts, unchecked: decided.filter((d) => d.decision === 'unchecked').length, decisions: decided.length, noTranscript,
    unread, untraced, estimate: ESTIMATED_DAILY_TOKENS,
  };
}

/** The report as text: one line a day, then the reconciliation with the transcripts. */
function formatReport({ days, acts, unchecked, decisions, noTranscript, unread, untraced, estimate }) {
  const n = (x) => x.toLocaleString('en-US');
  const share = (part, whole) => (whole === 0 ? '0%' : `${Math.round((100 * part) / whole)}%`);
  const counts = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ');
  const lines = [`advisor-gate report: ${days.length} day(s); added tokens are the Fable input tokens of the calls the flags prompted, against the estimate of ${n(estimate)} a day`];
  for (const d of days) {
    lines.push(`${d.day}  ${counts(d.decisions) || 'no decisions'}  (acts: ${counts(d.acts) || 'none'})  flagged then consulted: ${d.followed}/${d.flagged}  added tokens: ${n(d.addedTokens)} (${share(d.addedTokens, estimate)} of the estimate)`);
  }
  const missing = acts.found - acts.decided;
  lines.push(`acts found in the transcripts: ${acts.found}, with a decision: ${acts.decided}, with none: ${missing} (${share(missing, acts.found)})`);
  if (acts.unread > 0) lines.push(`  ${acts.unread} transcript(s) could not be read; their acts are in neither count.`);
  for (const m of acts.missing.slice(0, 10)) lines.push(`  no decision: ${m.act} (${m.tool}) at ${m.at} in ${m.transcript}`);
  lines.push(`let through unchecked: ${unchecked} of ${decisions} decisions (${share(unchecked, decisions)})`);
  const ends = Object.values(noTranscript).reduce((sum, v) => sum + v, 0);
  if (ends > 0) lines.push(`sub-agent ends with no transcript: ${ends} (${counts(noTranscript)}), apart from the decisions above, by agent type: most come right after a turn, agents the host runs itself (odd/tasks/advisor-use.md, L24)`);
  if (unread > 0) lines.push(`${unread} transcript(s) could not be read; their flags count, their calls and tokens do not.`);
  if (untraced > 0) lines.push(`${untraced} flag(s) recorded no transcript (written before the report existed); their calls and tokens are not known.`);
  return `${lines.join('\n')}\n`;
}

/** A usage error of the argv: its message names the token, the usage follows, exit 2. */
class AdvisorGateArgError extends Error {}

/** `js-harness advisor-gate --hook | --stop | report`. Seams for the tests: `readStdin`, `home`, `cwd`, `now`. */
export function advisorGateMain(argv, {
  stdout = (s) => process.stdout.write(s), stderr = console.error, readStdin = () => fs.readFileSync(0, 'utf8'),
  home, env = process.env, cwd = process.cwd(), now = Date.now(),
} = {}) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    stdout(`${USAGE}\n`);
    return 0;
  }
  if (argv[0] === 'report') {
    try {
      let since = null;
      for (let i = 1; i < argv.length; i++) {
        if (argv[i] === '--since' && /^\d{4}-\d{2}-\d{2}$/.test(argv[i + 1] ?? '')) since = argv[++i];
        else if (argv[i] === '--since') throw new AdvisorGateArgError('--since needs a day, YYYY-MM-DD');
        else throw new AdvisorGateArgError('unknown argument: ' + argv[i]);
      }
      stdout(formatReport(advisorGateReport({ home: harnessHome({ given: home, env, cwd }), since })));
      return 0;
    } catch (err) {
      if (!(err instanceof AdvisorGateArgError)) throw err;
      stderr(err.message + '\n\n' + USAGE);
      return 2;
    }
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
