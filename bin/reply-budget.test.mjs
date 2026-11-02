import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recordPath } from './lib/channel.mjs';
import { replyHookEntry } from './lib/hook-entries.mjs';
import { CURSOR_SCHEMA, liveCursorPath } from './lib/live-rows.mjs';
import { OPEN_STRETCH_MARKER, RETURN_MARKER } from './lib/return-report.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { STALE_MARKER, SUMMARY_MARKER } from './lib/stale-board.mjs';
import { RECORD_SCHEMA as STRETCH_SCHEMA, stretchFile } from './lib/stretch.mjs';
import { WAKE_MARKER } from './lib/stop-wake.mjs';
import { RENDERED_SCHEMA, SHOWN_SCHEMA, SUMMARY_SUBJECT, renderedFile, shownFile } from './lib/template-record.mjs';
import { percentile } from '../scripts/reply-hook-time.mjs';

// The reply hook's time budget (odd/tasks/reply-hook-latency.md, spec 4): on a transcript and a channel record of the
// lead's size, its 90th percentile over ten runs is at most 2500 ms, so a check added later that costs too much turns
// this red before it reaches him. A run that outlives the timeout skips every check of its stop, and at a stop the hook
// shares the machine with eight other Stop hooks. The budget was half the 5 s timeout it was set against; the timeout
// is 15 s since question 138 (odd/tasks/reply-hook-timeout.md), and the 10 s added are room for the load of a stop, not
// for the hook's own work, so the budget stays where it was and is held to at most half the timeout. The hook runs as
// the host runs it, a process of its own, and the fixture makes every check do its whole work: the lead's stop warns
// of waiting board rows, of a board summary last written with its content before notices that waited (so the check
// reads the whole shown record of the template gate), and of a return whose page was published and never linked (so
// the return check reads every Artifact call and searches the whole transcript for the link), a work session's stop of held work with nothing to
// wake it, each searching the whole transcript for an earlier warning it does not find; and
// both replies show a block of what was run, which the command-block check reads against every run of the transcript.
// A block handed to him is also parsed by his PowerShell, a process whose start alone takes 1.4 to 2.3 s on the
// machine that measured it: that cost is not the hook's own work, is measured apart, and is not held here
// (odd/tasks/reply-hook-latency.md, `## Measure`).
//
// Sizes are the lead's 0f71b2c6 on 2026-10-31: 60.2 MB in 38,990 lines, with accented text (stored by V8 as two bytes a
// character, which every search pays for), and a channel record of 1.4 MB. The template gate's shown record was 33 KB
// in 95 lines that day; the fixture's is 400 KB, a lead's months of pages and summary writes.
//
// The hook's own work is its main thread's CPU time, read at its exit by a module loaded before it (odd/tasks/defect-
// trio.md, L3). Wall time is the machine's: under ten busy loops the same runs took 3.4 to 9.4 s against 1.0 to 1.8 s
// quiet, and the main thread's CPU 1.1 to 1.4 s both ways, so the wall p90 turned lands red on another session's load
// (PR 736, PR 740). The GC and compile threads run beside the main thread and are not counted; the processes the hook
// starts are counted instead, since their time is not in this measure: git, once, where the project is. In WSL2, where
// the gate runs, load moves CPU time too: the whole suite beside the hook took its main thread from about 650 ms to
// 1.4-2.4 s, and the gate's run past 2500 ms (PR 750, L11). So the runs are held against reference runs between them,
// the same machine's work of the same kind, whose CPU grew the same way (the ratio held at 1.2 to 1.7 quiet and
// loaded), and their CPU is read in milliseconds of the machine that set the budget.

const BIN = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));
const BUDGET_MS = 2500;
const RUNS = 10;
const CHILDREN = 1;
// Loaded with --import before the hook: counts every process it starts, and at its exit writes its main thread's CPU.
const MEASURE = String.raw`
import fs from 'node:fs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
let children = 0;
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  const started = childProcess[name];
  childProcess[name] = (...args) => { children += 1; return started(...args); };
}
syncBuiltinESMExports();
process.on('exit', () => {
  const { user, system } = process.threadCpuUsage();
  fs.appendFileSync(process.env.BUDGET_MEASURE, JSON.stringify({ cpuMs: (user + system) / 1000, children }) + '\n');
});
`;
// The reference: the work the hook does most of, with none of its checks — the transcript read, each line parsed, and
// the whole of it searched for a mark it does not hold. Its main-thread CPU on the machine that set the budget, quiet:
// a median of 405 ms on Windows and 443 ms in its WSL2 on 2026-11-02, the larger taken (odd/tasks/defect-trio.md, L11).
const REFERENCE_MS = 450;
const REFERENCE = String.raw`
import fs from 'node:fs';
const text = fs.readFileSync(process.argv[2], 'utf8');
for (const one of text.split('\n')) if (one !== '') JSON.parse(one);
if (text.includes('a mark no transcript holds')) process.exitCode = 1;
`;
const TRANSCRIPT_BYTES = 60_000_000;
const RECORD_BYTES = 1_400_000;
const SHOWN_BYTES = 400_000;
const LEAD = { host: 'claude-code', id: 'lead-budget', title: 'JH ORQ · orquestador' };
const WORK = { host: 'claude-code', id: 'work-budget', title: 'JH 78 · evals' };
const HOUR = 3600_000;
const PAGE_URL = 'https://claude.ai/artifact/budgetPage01';
const MESSAGE = 'Se fusionaron tres PR mientras no estabas. Corrí esto:\n\n```powershell ran\njs-harness sessions --opening "JH 78 · evals"\n```\n\nWorking — the notice of JH 116 wakes me.';

let dir;
let project;
let home;
let leadTranscript;
let workTranscript;
let page;
let measure;
let reference;

const line = (entry) => JSON.stringify(entry);

/** A transcript of `bytes` for the session titled `title`: his message about every 150 lines, the session's replies and
 * tool calls between them with results of a few kilobytes, and his newest message after three hours away, then the
 * lines `since` (the page the lead published after it). Times run from four days ago to a minute ago. */
function transcriptOf(title, bytes, now, since = []) {
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
  lines.push(...since);
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
  // The template gate on, as in this repository, so the summary check reads the shown record.
  fs.writeFileSync(path.join(project, 'harness.json'), JSON.stringify({ reply: true, templates: true }));
  // A repository of its own, as the lead's checkout is: the hook asks git where the project is.
  const init = spawnSync('git', ['init', '-q'], { cwd: project, encoding: 'utf8', windowsHide: true });
  assert.equal(init.status, 0, init.stderr);
  const slug = projectSlug(project);
  const record = recordOf(RECORD_BYTES, now);
  fs.mkdirSync(path.dirname(recordPath(home, slug)), { recursive: true });
  fs.writeFileSync(recordPath(home, slug), record.text);
  // The board was sent up to ten rows before the end: the oldest waiting row is older than one check.
  fs.mkdirSync(path.dirname(liveCursorPath(home, slug)), { recursive: true });
  fs.writeFileSync(liveCursorPath(home, slug), JSON.stringify({ schema: CURSOR_SCHEMA, url: 'https://claude.ai/artifact/board', upto: record.count - 10, sent: [] }));
  // The template gate's shown record: pages shown and summary writes, the last one carrying now and status two hours
  // ago, before the notices of the last hour; checked-only writes after it.
  const shown = [];
  for (let i = 0, size = 0; size < SHOWN_BYTES; i += 1) {
    const at = new Date(now - 2 * HOUR - (4000 - i) * 60_000).toISOString();
    const written = i % 2 === 0
      ? line({ schema: SHOWN_SCHEMA, at, session: LEAD.id, tool: 'Artifact', call: `toolu_s${i}`, template: 'status-report', subject: 'status', decision: 'shown', sha256: 'a'.repeat(64), reason: null })
      : line({ schema: SHOWN_SCHEMA, at, session: LEAD.id, tool: 'ArtifactData', call: `toolu_s${i}`, template: null, subject: SUMMARY_SUBJECT, decision: 'shown', sha256: null, reason: `fields: ${JSON.stringify(i % 4 === 1 ? ['now', 'status', 'yours', 'route', 'links'] : ['checked', 'until', 'resting', 'stretch', 'running', 'questions'])}` });
    shown.push(written);
    size += written.length + 1;
  }
  shown.push(line({ schema: SHOWN_SCHEMA, at: new Date(now - 2 * HOUR).toISOString(), session: LEAD.id, tool: 'ArtifactData', call: 'toolu_content', template: null, subject: SUMMARY_SUBJECT, decision: 'shown', sha256: null, reason: 'fields: ["now","status","yours"]' }));
  shown.push(line({ schema: SHOWN_SCHEMA, at: new Date(now - 5 * 60_000).toISOString(), session: LEAD.id, tool: 'ArtifactData', call: 'toolu_checked', template: null, subject: SUMMARY_SUBJECT, decision: 'shown', sha256: null, reason: 'fields: ["checked","until"]' }));
  fs.mkdirSync(path.dirname(shownFile(home, slug)), { recursive: true });
  fs.writeFileSync(shownFile(home, slug), `${shown.join('\n')}\n`);
  // The status page, rendered after his return and published, its link never given to him.
  page = path.join(dir, 'status.html');
  fs.mkdirSync(path.dirname(renderedFile(home, slug)), { recursive: true });
  fs.writeFileSync(renderedFile(home, slug), `${line({ schema: RENDERED_SCHEMA, template: 'status-report', subject: 'status', sha256: 'a', normal: 'b', bytes: 1, at: new Date(now - 8 * 60_000).toISOString(), head: null, path: page })}\n`);
  const publishedAt = new Date(now - 7 * 60_000).toISOString();
  const published = [
    line({ type: 'assistant', timestamp: publishedAt, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_page', name: 'Artifact', input: { file_path: page, icon: 'chart' } }] } }),
    line({ type: 'user', timestamp: publishedAt, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_page', content: `Published ${page} at ${PAGE_URL} (Version 1).` }] } }),
  ];
  // The stretch record: months of stretches opened and closed, and the one opened before he left still open, so the
  // return's stretch check reads the whole record and warns.
  const stretches = [];
  for (let i = 0; i < 400; i += 1) {
    const id = new Date(now - (500 - i) * 6 * HOUR).toISOString();
    stretches.push(line({ schema: STRETCH_SCHEMA, event: 'open', id, at: id, plan: { hours: 4, slots: 3, goals: [], items: [] } }));
    stretches.push(line({ schema: STRETCH_SCHEMA, event: 'close', id, at: new Date(Date.parse(id) + 4 * HOUR).toISOString() }));
  }
  const left = new Date(now - 4 * HOUR).toISOString();
  stretches.push(line({ schema: STRETCH_SCHEMA, event: 'open', id: left, at: left, plan: { hours: 4, slots: 3, goals: [], items: [] } }));
  fs.mkdirSync(path.dirname(stretchFile(home, slug)), { recursive: true });
  fs.writeFileSync(stretchFile(home, slug), `${stretches.join('\n')}\n`);
  leadTranscript = path.join(dir, 'lead.jsonl');
  workTranscript = path.join(dir, 'work.jsonl');
  fs.writeFileSync(leadTranscript, transcriptOf(LEAD.title, TRANSCRIPT_BYTES, now, published));
  fs.writeFileSync(workTranscript, transcriptOf(WORK.title, TRANSCRIPT_BYTES, now));
  measure = path.join(dir, 'measure.mjs');
  fs.writeFileSync(measure, MEASURE);
  reference = path.join(dir, 'reference.mjs');
  fs.writeFileSync(reference, REFERENCE);
});

after(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

/** `RUNS` runs of the hook on the stop of `session`: each one's main-thread CPU (`times`), the processes it started
 * (`children`) and its wall time (`walls`), the main-thread CPU of the reference run before the first and after each
 * (`references`, one more than the runs), and the last answer. */
function timeStops(session, transcript) {
  const input = JSON.stringify({
    session_id: session.id, transcript_path: transcript, cwd: project, hook_event_name: 'Stop', stop_hook_active: false,
    last_assistant_message: MESSAGE,
    background_tasks: [], session_crons: [],
  });
  const measured = path.join(dir, `${session.id}.jsonl`);
  const referenced = path.join(dir, `${session.id}-reference.jsonl`);
  const walls = [];
  let answer = null;
  const runReference = () => {
    const ran = spawnSync(process.execPath, ['--import', pathToFileURL(measure).href, reference, transcript], { encoding: 'utf8', windowsHide: true, env: { ...process.env, BUDGET_MEASURE: referenced } });
    assert.equal(ran.status, 0, ran.stderr);
  };
  runReference();
  for (let i = 0; i < RUNS; i += 1) {
    const started = performance.now();
    const env = { ...process.env, JS_HARNESS_HOME: home, BUDGET_MEASURE: measured };
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(measure).href, BIN, 'reply', '--hook'], { input, encoding: 'utf8', windowsHide: true, env });
    walls.push(performance.now() - started);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '', 'every check ran: none said on standard error that it did not');
    answer = JSON.parse(result.stdout);
    runReference();
  }
  const runs = fs.readFileSync(measured, 'utf8').trim().split('\n').map((one) => JSON.parse(one));
  assert.equal(runs.length, RUNS, 'every run wrote its measure at its exit');
  const references = fs.readFileSync(referenced, 'utf8').trim().split('\n').map((one) => JSON.parse(one).cpuMs);
  assert.equal(references.length, RUNS + 1, 'every reference run, before the first and after each, wrote its measure');
  return { times: runs.map((run) => run.cpuMs), children: runs.map((run) => run.children), walls, references, answer };
}

/** The main thread's CPU of each run of `timeStops` in milliseconds of the machine that set the budget: its CPU over the
 * median of the reference runs around it, the one before the run before it to the one after the run after it, times
 * `REFERENCE_MS`. Runs near it follow load that comes or goes during the test, which the median of all of them did not
 * (a work stop scaled to 1513 ms when busy loops ended halfway, and a cap at 1.5 times that median scored a hook under
 * load that came for four runs at twice its work: Codex and the resilience lens on 3db0ca0, odd/tasks/defect-trio.md,
 * L13); their median, not the mean of the two beside it, so one slow reference run, as one of a quiet Windows took
 * 905 ms where the others took 358 to 812, cannot halve a run's measure and hide a hook grown slower (L12). */
function scaledTimes(times, references) {
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const half = sorted.length / 2;
    return Number.isInteger(half) ? (sorted[half - 1] + sorted[half]) / 2 : sorted[Math.floor(half)];
  };
  return times.map((ms, i) => (ms / median(references.slice(Math.max(0, i - 1), i + 3))) * REFERENCE_MS);
}

/** Holds the runs of `timeStops` to the budget: their CPU as `scaledTimes` puts it at the 90th percentile, and the
 * processes each run started, whose time that measure does not hold. */
function withinBudget(t, { times, children, walls, references }) {
  const scaled = scaledTimes(times, references);
  const p90 = percentile(scaled, 0.9);
  const each = (values) => values.map((ms) => ms.toFixed(0)).join(' ');
  t.diagnostic(`main-thread CPU p90 ${p90.toFixed(0)} ms where the reference takes ${REFERENCE_MS} ms, budget ${BUDGET_MS} ms, runs ${each(scaled)}; measured ${each(times)}, reference ${each(references)}, wall ${each(walls)} ms; processes started ${children.join(' ')}`);
  assert.ok(p90 <= BUDGET_MS, `main-thread CPU p90 ${p90.toFixed(0)} ms over ${RUNS} runs, where the reference takes ${REFERENCE_MS} ms, is above the budget of ${BUDGET_MS} ms: ${each(scaled)} (measured ${each(times)}, reference ${each(references)})`);
  assert.ok(children.every((count) => count <= CHILDREN), `a run started more than ${CHILDREN} process (${children.join(' ')}): a check that starts one costs time this measure does not see, so the budget counts it`);
}

test('a load that comes partway through the runs scales them back to the quiet machine', () => {
  // Codex's case on 3db0ca0: seven reference runs at 450 ms, then four at 1350; a hook of 2000 ms takes three times that
  // under the load, and the run between the two takes twice.
  const references = [450, 450, 450, 450, 450, 450, 450, 1350, 1350, 1350, 1350];
  const times = [2000, 2000, 2000, 2000, 2000, 2000, 4000, 6000, 6000, 6000];
  for (const ms of scaledTimes(times, references)) assert.ok(Math.abs(ms - 2000) < 1, `${ms.toFixed(0)} ms, not 2000`);
});

test('one slow reference run does not scale down the runs beside it', () => {
  const references = [400, 400, 400, 400, 400, 905, 400, 400, 400, 400, 400];
  const times = Array(references.length - 1).fill(2000);
  for (const ms of scaledTimes(times, references)) assert.ok(Math.abs(ms - 2250) < 1, `${ms.toFixed(0)} ms, not 2250`);
});

test('the budget is at most half the timeout install gives the hook', () => {
  const timeoutMs = replyHookEntry().hooks[0].timeout * 1000;
  assert.ok(BUDGET_MS <= timeoutMs / 2, `a budget of ${BUDGET_MS} ms against a timeout of ${timeoutMs} ms`);
});

test('the fixture is the lead\'s size', () => {
  assert.ok(fs.statSync(leadTranscript).size >= TRANSCRIPT_BYTES);
  const text = fs.readFileSync(leadTranscript, 'utf8');
  assert.ok(text.split('\n').length > 38_000, 'about as many lines as the lead\'s');
  assert.ok(fs.statSync(shownFile(home, projectSlug(project))).size >= SHOWN_BYTES, 'a shown record larger than the lead\'s');
  assert.ok(/[áéíóúñ¿]/.test(text), 'accented text, so the transcript is stored two bytes a character');
});

test('the lead\'s stop, every check doing its whole work, stays within the budget at the 90th percentile', (t) => {
  const runs = timeStops(LEAD, leadTranscript);
  const { answer } = runs;
  assert.equal(answer.decision, 'block', JSON.stringify(answer));
  assert.ok(answer.reason.includes(STALE_MARKER), 'the live-board check searched the transcript and warned');
  assert.ok(answer.reason.includes(SUMMARY_MARKER), 'the summary check read the shown record, searched the transcript and warned');
  assert.ok(answer.reason.includes(RETURN_MARKER), 'the return check read the publish of the page, searched for its link and warned');
  assert.ok(answer.reason.includes(OPEN_STRETCH_MARKER), 'the return\'s stretch check read the whole stretch record and warned');
  withinBudget(t, runs);
});

test('a work session\'s stop, its wake check doing its whole work, stays within the budget at the 90th percentile', (t) => {
  const runs = timeStops(WORK, workTranscript);
  assert.equal(runs.answer.decision, 'block', JSON.stringify(runs.answer));
  assert.ok(runs.answer.reason.includes(WAKE_MARKER), 'the wake check searched the transcript and warned');
  withinBudget(t, runs);
});
