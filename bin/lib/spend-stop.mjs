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

/** Records `line` for the session and returns `{ line, previous }`. A line above the one recorded throws
 * `StopLineError`; the same or a lower one is written. The file is written whole through a temporary file. */
export function recordStopLine({ home, sessionId, line, now = () => new Date() }) {
  const file = stopLinePath(home, sessionId);
  const previous = readStopLine(home, sessionId);
  if (previous !== null && line > previous) throw new StopLineError(`this session's stop line is ${previous}; it can be lowered, never raised`);
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

/** Whether the call still passes past the line: a Read, Write or Edit of a Markdown file (the session's state, which
 * the host's Edit needs read first), or a Bash command that is one `js-harness notify` or `js-harness loop stop` (to
 * end the loops it started) and nothing chained, substituted, redirected or on another line. TaskStop is not in the
 * guard's matcher, so a session can always stop its background tasks. */
function passesAtStop(tool, input) {
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit') return /\.md$/i.test(String(input?.file_path ?? '').trim());
  if (tool !== 'Bash') return false;
  const command = String(input?.command ?? '');
  return /^\s*js-harness\s+(?:notify|loop\s+stop)\s/.test(command) && !/[;&|<>\r\n`]|\$\(/.test(command);
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
  return `js-harness guard: this session has spent ${n(figure)} cache-read (main ${n(spend.main.cacheReadTokens)}, sub-agents ${n(spend.subagents.cacheReadTokens)}), past its stop line ${n(line)} (js-harness spend --self --line): write your state and stop; a Read, Write or Edit of a .md file, a lone js-harness notify and a lone js-harness loop stop still pass, with none of ; & | < > \` $( or a line break anywhere in the command, its quoted text too. The line is in ${stopLinePath(home, sessionId)}: only the user lifts it, by deleting that file`;
}
