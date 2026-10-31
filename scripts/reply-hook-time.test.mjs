// Tests of scripts/reply-hook-time.mjs, the measure of the reply hook (odd/tasks/reply-hook-latency.md). The hook's
// records are the host's, as the lead's transcript 0f71b2c6 holds them (2026-10-31), trimmed to the fields read; the
// runs are given a fake spawn and clock, so no process starts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hookRuns, inSituReport, parseArgs, percentile, stopHooks, stopPayload, timeRuns } from './reply-hook-time.mjs';

const HOOK = 'js-harness reply --hook || exit 0';
const line = (entry) => JSON.stringify(entry);
const ran = (at, ms) => line({ type: 'attachment', timestamp: at, attachment: { type: 'hook_success', hookName: 'Stop', hookEvent: 'Stop', command: HOOK, durationMs: ms, exitCode: 0 } });
const cancelled = (at, ms) => line({ type: 'attachment', timestamp: at, attachment: { type: 'hook_cancelled', hookName: 'Stop', hookEvent: 'Stop', command: HOOK, durationMs: ms, timedOut: true, timeoutMs: 5000 } });
const summary = (infos) => line({ type: 'system', subtype: 'stop_hook_summary', hookCount: infos.length, hookInfos: infos });
const reply = (text, extra = {}) => line({ type: 'assistant', isSidechain: false, message: { role: 'assistant', content: [{ type: 'text', text }] }, ...extra });

test('percentile is the nearest rank: the p90 of ten runs is the ninth', () => {
  assert.equal(percentile([], 0.9), null);
  assert.equal(percentile([5], 0.9), 5);
  assert.equal(percentile([10, 1, 9, 2, 8, 3, 7, 4, 6, 5], 0.9), 9);
  assert.equal(percentile([10, 1, 9, 2, 8, 3, 7, 4, 6, 5], 0.5), 5);
  assert.equal(percentile([3, 1, 2], 1), 3);
});

test('hookRuns reads each run of the reply hook the host recorded, a timed-out one included, and nothing else', () => {
  const text = [
    ran('2026-10-30T10:00:00.000Z', 1800),
    cancelled('2026-10-30T11:00:00.000Z', 7867),
    line({ type: 'attachment', timestamp: '2026-10-30T11:00:01.000Z', attachment: { type: 'hook_success', hookEvent: 'Stop', command: 'js-harness guard --stop || exit 0', durationMs: 900 } }),
    line({ type: 'attachment', timestamp: '2026-10-30T11:00:02.000Z', attachment: { type: 'hook_success', hookEvent: 'PreToolUse', command: HOOK, durationMs: 5 } }),
    reply('I ran js-harness reply --hook by hand'),
    `{"torn": "${HOOK}`,
  ].join('\n');
  assert.deepEqual(hookRuns(text), [
    { at: '2026-10-30T10:00:00.000Z', ms: 1800, timedOut: false },
    { at: '2026-10-30T11:00:00.000Z', ms: 7867, timedOut: true },
  ]);
});

test('stopHooks gathers the time of each Stop hook at every stop, and inSituReport says them by day', () => {
  const text = [
    ran('2026-10-30T10:00:00.000Z', 1000),
    summary([{ command: HOOK, durationMs: 1000 }, { command: 'other-review stop-hook', durationMs: 8000 }, { command: 'callback' }]),
    cancelled('2026-10-31T01:00:00.000Z', 6000),
    summary([{ command: 'other-review stop-hook', durationMs: 9000 }]),
  ].join('\n');
  const { byCommand, aside } = stopHooks(text);
  assert.deepEqual([...byCommand], [[HOOK, [1000]], ['other-review stop-hook', [8000, 9000]]]);
  assert.deepEqual(aside, [{ [HOOK]: 1000, 'other-review stop-hook': 8000 }, { 'other-review stop-hook': 9000 }]);
  const report = inSituReport(text).join('\n');
  assert.match(report, /2026-10-30\s+1\s+0\s+1000\s+1000/);
  assert.match(report, /2026-10-31\s+1\s+1\s+6000\s+6000/);
  assert.match(report, /all\s+2\s+1\s+1000\s+6000/);
  assert.match(report, /2\s+8000\s+9000\s+other-review stop-hook/);
});

test('stopPayload judges the session\'s newest reply that holds text, never a side chain\'s, with nothing in the background', () => {
  const text = [
    reply('older\n\nWorking — a notice wakes me.'),
    line({ type: 'assistant', isSidechain: false, message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: {} }] } }),
    reply('a sub-agent', { isSidechain: true }),
    'not json "type":"assistant"',
  ].join('\n');
  const payload = stopPayload(text, '/p/0f71b2c6.jsonl', '/work');
  assert.equal(payload.last_assistant_message, 'older\n\nWorking — a notice wakes me.');
  assert.equal(payload.session_id, '0f71b2c6');
  assert.equal(payload.transcript_path, '/p/0f71b2c6.jsonl');
  assert.equal(payload.cwd, '/work');
  assert.deepEqual(payload.background_tasks, []);
  assert.equal(payload.stop_hook_active, false);
  assert.equal(stopPayload('', '/p/x.jsonl', '/w').last_assistant_message, '');
});

test('timeRuns takes the commands in turn, so a before and an after meet the same load', () => {
  const order = [];
  let clock = 0;
  const spawn = (command, options) => {
    order.push(command);
    clock += command === 'before' ? 30 : 10;
    return { stdout: `${command} said`, stderr: '', input: options.input };
  };
  const results = timeRuns(['before', 'after'], '{}', 3, { spawn, clock: () => clock });
  assert.deepEqual(order, ['before', 'after', 'before', 'after', 'before', 'after']);
  assert.deepEqual(results.map(({ command, times, stdout }) => ({ command, times, stdout })), [
    { command: 'before', times: [30, 30, 30], stdout: 'before said' },
    { command: 'after', times: [10, 10, 10], stdout: 'after said' },
  ]);
});

test('parseArgs reads each mode and refuses what it does not know', () => {
  assert.deepEqual(parseArgs(['in-situ', 't.jsonl']), { mode: 'in-situ', transcript: 't.jsonl' });
  const runs = parseArgs(['runs', '--transcript', 't.jsonl', '--runs', '15', '--cwd', '/w', '--command', 'a', '--command', 'b']);
  assert.deepEqual(runs, { mode: 'runs', transcript: 't.jsonl', runs: 15, cwd: '/w', commands: ['a', 'b'] });
  assert.equal(parseArgs(['profile', '--transcript', 't.jsonl']).mode, 'profile');
  for (const argv of [[], ['in-situ'], ['other'], ['runs'], ['runs', '--transcript'], ['runs', '--transcript', 't', '--runs', '0'], ['profile', '--transcript', 't', '--runs', '3'], ['runs', '--transcript', 't', '--what', 'x']]) {
    assert.ok(parseArgs(argv).error, JSON.stringify(argv));
  }
});
