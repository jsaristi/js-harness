import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordPath } from './lib/channel.mjs';
import { replyHookEntry } from './lib/hook-entries.mjs';
import { CURSOR_SCHEMA, liveCursorPath } from './lib/live-rows.mjs';
import { RETURN_MARKER } from './lib/return-report.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { STALE_MARKER } from './lib/stale-board.mjs';
import { WAKE_MARKER } from './lib/stop-wake.mjs';
import { percentile } from '../scripts/reply-hook-time.mjs';

// The reply hook's time budget (odd/tasks/reply-hook-latency.md, spec 4): on a transcript and a channel record of the
// lead's size, its 90th percentile over ten runs is at most half the timeout `install` gives it, so a check added
// later that costs too much turns this red before it reaches him. A run that outlives the timeout skips every check of
// its stop, and at a stop the hook shares the machine with eight other Stop hooks: half the timeout is the room left
// for them. The hook runs as the host runs it, a process of its own, and the fixture makes every check do its whole
// work: the lead's stop warns of waiting board rows and of a return without its page, a work session's stop of held
// work with nothing to wake it, each searching the whole transcript for an earlier warning it does not find.
//
// Sizes are the lead's 0f71b2c6 on 2026-10-31: 60.2 MB in 38,990 lines, with accented text (stored by V8 as two bytes a
// character, which every search pays for), and a channel record of 1.4 MB.

const BIN = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));
const BUDGET_MS = (replyHookEntry().hooks[0].timeout * 1000) / 2;
const RUNS = 10;
const TRANSCRIPT_BYTES = 60_000_000;
const RECORD_BYTES = 1_400_000;
const LEAD = { host: 'claude-code', id: 'lead-budget', title: 'JH ORQ · orquestador' };
const WORK = { host: 'claude-code', id: 'work-budget', title: 'JH 78 · evals' };
const HOUR = 3600_000;

let dir;
let project;
let home;
let leadTranscript;
let workTranscript;

const line = (entry) => JSON.stringify(entry);

/** A transcript of `bytes` for the session titled `title`: his message about every 150 lines, the session's replies and
 * tool calls between them with results of a few kilobytes, and his newest message after three hours away. Times run
 * from four days ago to a minute ago. */
function transcriptOf(title, bytes, now) {
  const filler = 'Revisé la página de estado y el tablero; también corrí la compuerta y leí las reseñas. '.repeat(40);
  const lines = [line({ type: 'custom-title', customTitle: title, sessionId: 'x' })];
  let size = lines[0].length;
  const start = now - 4 * 24 * HOUR;
  for (let i = 0; size < bytes; i += 1) {
    // Timed by how much is written, so the last line before his return is at least four hours old.
    const at = new Date(start + (size / bytes) * (4 * 24 * HOUR - 4 * HOUR)).toISOString();
    let written;
    if (i % 150 === 0) {
      written = line({ type: 'user', timestamp: at, origin: { kind: 'human' }, message: { role: 'user', content: `¿cómo vamos con la tarea ${i}?` } });
    } else if (i % 3 === 0) {
      written = line({ type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'tool_use', id: `toolu_${i}`, name: 'Bash', input: { command: `git log --oneline -${i % 20}` } }] } });
    } else if (i % 3 === 1) {
      written = line({ type: 'user', timestamp: at, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `toolu_${i - 1}`, content: filler.slice(0, 1500 + (i % 7) * 400) }] } });
    } else {
      written = line({ type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'text', text: `Avancé en la tarea ${i}: ${filler.slice(0, 300)}` }] } });
    }
    lines.push(written);
    size += written.length + 1;
  }
  // His return: three hours away, then back a few minutes ago, and the session's replies since.
  lines.push(line({ type: 'user', timestamp: new Date(now - 10 * 60_000).toISOString(), origin: { kind: 'human' }, message: { role: 'user', content: 'ya volví, ¿qué pasó?' } }));
  lines.push(line({ type: 'assistant', timestamp: new Date(now - 9 * 60_000).toISOString(), message: { role: 'assistant', content: [{ type: 'text', text: 'Se fusionaron tres PR.' }] } }));
  lines.push(line({ type: 'custom-title', customTitle: title, sessionId: 'x' }));
  return `${lines.join('\n')}\n`;
}

/** A channel record of `bytes`: notices of work sessions to the lead, the lead's own, and the lead's handing of work
 * to JH 78, every half minute up to an hour ago. */
function recordOf(bytes, now) {
  const lines = [];
  let size = 0;
  const text = 'JH 77 cerró su PR con las reseñas de Codex y de los lentes, y el resumen está en docs/sessions. '.repeat(6);
  for (let i = 0; size < bytes; i += 1) {
    const at = new Date(now - HOUR - (40_000 - i) * 30_000).toISOString();
    const from = i % 5 === 0 ? LEAD : { host: 'claude-code', id: `work-${i % 40}`, title: `JH ${i % 40} · tarea` };
    const to = i % 5 === 0 ? { role: 'work', number: 70 + (i % 9) } : { role: 'orchestrator' };
    const kind = i % 5 === 0 ? { kind: 'note' } : { kind: 'ready', pr: 100 + i };
    const written = JSON.stringify({ schema: 'js-harness.channel-notice/v1', at, from, to, ...kind, text: `${text} (${i})` });
    lines.push(written);
    size += written.length + 1;
  }
  // The lead's newest notice carries its title; then it hands JH 78 its work, which JH 78 has not given back.
  lines.push(JSON.stringify({ schema: 'js-harness.channel-notice/v1', at: new Date(now - 50 * 60_000).toISOString(), from: LEAD, to: { role: 'work', number: 78 }, kind: 'note', text: 'JH 78: mide el hook.' }));
  return { text: `${lines.join('\n')}\n`, count: lines.length };
}

before(() => {
  const now = Date.now();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reply-budget-'));
  project = path.join(dir, 'project');
  home = path.join(dir, 'home');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'harness.json'), JSON.stringify({ reply: true }));
  // A repository of its own, as the lead's checkout is: the hook finds the project from its `.git` folder.
  const init = spawnSync('git', ['init', '-q'], { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(init.status, 0, init.stderr);
  const slug = projectSlug(project);
  const record = recordOf(RECORD_BYTES, now);
  fs.mkdirSync(path.dirname(recordPath(home, slug)), { recursive: true });
  fs.writeFileSync(recordPath(home, slug), record.text);
  // The board was sent up to ten rows before the end: the oldest waiting row is older than one check.
  fs.mkdirSync(path.dirname(liveCursorPath(home, slug)), { recursive: true });
  fs.writeFileSync(liveCursorPath(home, slug), JSON.stringify({ schema: CURSOR_SCHEMA, url: 'https://claude.ai/artifact/board', upto: record.count - 10, sent: [] }));
  leadTranscript = path.join(dir, 'lead.jsonl');
  workTranscript = path.join(dir, 'work.jsonl');
  fs.writeFileSync(leadTranscript, transcriptOf(LEAD.title, TRANSCRIPT_BYTES, now));
  fs.writeFileSync(workTranscript, transcriptOf(WORK.title, TRANSCRIPT_BYTES, now));
});

after(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

/** The wall times of `RUNS` runs of the hook on the stop of `session`, and the last answer. */
function timeStops(session, transcript) {
  const input = JSON.stringify({
    session_id: session.id, transcript_path: transcript, cwd: project, hook_event_name: 'Stop', stop_hook_active: false,
    last_assistant_message: 'Se fusionaron tres PR mientras no estabas.\n\nWorking — the notice of JH 116 wakes me.',
    background_tasks: [], session_crons: [],
  });
  const times = [];
  let answer = null;
  for (let i = 0; i < RUNS; i += 1) {
    const started = performance.now();
    const result = spawnSync(process.execPath, [BIN, 'reply', '--hook'], { input, encoding: 'utf8', windowsHide: true, env: { ...process.env, JS_HARNESS_HOME: home } });
    times.push(performance.now() - started);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '', 'every check ran: none said on standard error that it did not');
    answer = JSON.parse(result.stdout);
  }
  return { times, answer };
}

test('the fixture is the lead\'s size', () => {
  assert.ok(fs.statSync(leadTranscript).size >= TRANSCRIPT_BYTES);
  const text = fs.readFileSync(leadTranscript, 'utf8');
  assert.ok(text.split('\n').length > 38_000, 'about as many lines as the lead\'s');
  assert.ok(/[áéíóúñ¿]/.test(text), 'accented text, so the transcript is stored two bytes a character');
});

test('the lead\'s stop, every check doing its whole work, stays within half the timeout at the 90th percentile', (t) => {
  const { times, answer } = timeStops(LEAD, leadTranscript);
  assert.equal(answer.decision, 'block', JSON.stringify(answer));
  assert.ok(answer.reason.includes(STALE_MARKER), 'the live-board check searched the transcript and warned');
  assert.ok(answer.reason.includes(RETURN_MARKER), 'the return check searched the transcript and warned');
  const p90 = percentile(times, 0.9);
  t.diagnostic(`p90 ${p90.toFixed(0)} ms, budget ${BUDGET_MS} ms, runs ${times.map((ms) => ms.toFixed(0)).join(' ')}`);
  assert.ok(p90 <= BUDGET_MS, `p90 ${p90.toFixed(0)} ms over ${RUNS} runs is above the budget of ${BUDGET_MS} ms: ${times.map((ms) => ms.toFixed(0)).join(' ')}`);
});

test('a work session\'s stop, its wake check doing its whole work, stays within half the timeout at the 90th percentile', (t) => {
  const { times, answer } = timeStops(WORK, workTranscript);
  assert.equal(answer.decision, 'block', JSON.stringify(answer));
  assert.ok(answer.reason.includes(WAKE_MARKER), 'the wake check searched the transcript and warned');
  const p90 = percentile(times, 0.9);
  t.diagnostic(`p90 ${p90.toFixed(0)} ms, budget ${BUDGET_MS} ms, runs ${times.map((ms) => ms.toFixed(0)).join(' ')}`);
  assert.ok(p90 <= BUDGET_MS, `p90 ${p90.toFixed(0)} ms over ${RUNS} runs is above the budget of ${BUDGET_MS} ms: ${times.map((ms) => ms.toFixed(0)).join(' ')}`);
});
