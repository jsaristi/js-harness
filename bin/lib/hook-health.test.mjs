// Tests of ./hook-health.mjs: what the host recorded of each hook it ran in the newest sessions' transcripts, for
// C3.4 of odd/tasks/f8-s8-certification.md (T2).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { HOOK_SESSIONS, hookHealth, readTranscriptHooks } from './hook-health.mjs';

let serial = 0;
/** One attachment line of a transcript, as Claude Code writes it. */
function attachment(type, fields = {}) {
  serial += 1;
  return JSON.stringify({ type: 'attachment', uuid: `u-${serial}`, timestamp: '2026-11-22T10:00:00.000Z', attachment: { type, hookEvent: 'PostToolUse', hookName: 'PostToolUse:Bash', toolUseID: 'toolu_1', ...fields } });
}

const ok = (fields) => attachment('hook_success', { command: 'command hook 1', durationMs: 10, ...fields });

test('readTranscriptHooks counts one invocation per tool use and event, its extra attachments not counted', () => {
  const text = [
    ok({ toolUseID: 'a' }),
    attachment('hook_additional_context', { toolUseID: 'a' }),
    ok({ toolUseID: 'a', command: 'command hook 2' }),
    ok({ toolUseID: 'a', hookEvent: 'PreToolUse', hookName: 'PreToolUse:Bash' }),
    ok({ toolUseID: 'b' }),
    '{"type":"user","message":{}}',
    '',
  ].join('\n');
  assert.deepEqual(readTranscriptHooks(text, new Set()), { invocations: 3, events: 4, cancelled: 0, timedOut: 0, truncated: false });
});

test('readTranscriptHooks counts a cancel apart from a timeout, each once per invocation', () => {
  const text = [
    attachment('hook_cancelled', { toolUseID: 'a' }),
    attachment('hook_cancelled', { toolUseID: 'a' }),
    attachment('hook_cancelled', { toolUseID: 'b', hookEvent: 'Stop', hookName: 'Stop', command: 'js-harness reply --hook || exit 0', durationMs: 16000, timedOut: true, timeoutMs: 15000 }),
    ok({ toolUseID: 'c' }),
    '',
  ].join('\n');
  assert.deepEqual(readTranscriptHooks(text, new Set()), { invocations: 3, events: 4, cancelled: 1, timedOut: 1, truncated: false });
});

test('readTranscriptHooks marks a torn hook line or an unterminated end as truncated, never as clean', () => {
  assert.equal(readTranscriptHooks(`${ok()}\n{"type":"attachment","attachment":{"type":"hook_succ\n`, new Set()).truncated, true);
  assert.equal(readTranscriptHooks(`${ok()}\n${ok({ toolUseID: 'z' })}`, new Set()).truncated, true);
  // A torn line that is no hook's is not the hooks' record.
  assert.equal(readTranscriptHooks(`${ok()}\n{"type":"user","mess\n`, new Set()).truncated, false);
});

test('readTranscriptHooks passes over a line another session already counted, as a fork copies its parent', () => {
  const line = ok();
  const seen = new Set();
  assert.equal(readTranscriptHooks(`${line}\n`, seen).invocations, 1);
  assert.equal(readTranscriptHooks(`${line}\n`, seen).invocations, 0);
});

function home(sessions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-health-'));
  const projects = path.join(dir, 'projects');
  sessions.forEach(({ project = 'p', id, text }, i) => {
    fs.mkdirSync(path.join(projects, project, id, 'subagents'), { recursive: true });
    const file = path.join(projects, project, `${id}.jsonl`);
    fs.writeFileSync(file, text);
    const at = new Date(Date.UTC(2026, 10, 1, 0, i));
    fs.utimesSync(file, at, at);
    // A sub-agent's transcript is not a session.
    fs.writeFileSync(path.join(projects, project, id, 'subagents', 'agent-1.jsonl'), `${attachment('hook_cancelled')}\n`);
  });
  return dir;
}

test('hookHealth reads the newest sessions of every project, names them, and counts their misses', () => {
  const sessions = Array.from({ length: HOOK_SESSIONS + 2 }, (_, i) => ({ project: i % 2 ? 'p' : 'q', id: `s${String(i).padStart(2, '0')}`, text: `${ok({ toolUseID: `t${i}` })}\n` }));
  sessions[HOOK_SESSIONS + 1].text += `${attachment('hook_cancelled', { toolUseID: 'late' })}\n`;
  const dir = home(sessions);
  try {
    const health = hookHealth({ claudeDir: dir });
    assert.equal(health.sessions.length, HOOK_SESSIONS);
    assert.equal(health.sessions[0].id, `s${HOOK_SESSIONS + 1}`);
    assert.equal(health.sessions.at(-1).id, 's02');
    assert.equal(health.short, 0);
    assert.deepEqual({ invocations: health.invocations, cancelled: health.cancelled, timedOut: health.timedOut, truncated: health.truncated }, { invocations: HOOK_SESSIONS + 1, cancelled: 1, timedOut: 0, truncated: [] });
    assert.deepEqual(health.sessions[0], { id: `s${HOOK_SESSIONS + 1}`, project: 'p', at: '2026-11-01T00:21:00.000Z', invocations: 2, events: 2, cancelled: 1, timedOut: 0, truncated: false });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hookHealth says how many sessions it is short of, and which traces are truncated', () => {
  const dir = home([{ id: 'one', text: `${ok()}\n` }, { id: 'two', text: ok({ toolUseID: 'x' }) }]);
  try {
    const health = hookHealth({ claudeDir: dir });
    assert.equal(health.sessions.length, 2);
    assert.equal(health.short, HOOK_SESSIONS - 2);
    assert.deepEqual(health.truncated, ['two']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hookHealth keeps a newest session it cannot read in its place, as truncated, never passing to an older one', () => {
  const dir = home([{ id: 'old', text: `${ok()}
` }, { id: 'locked', text: `${ok({ toolUseID: 'x' })}
` }]);
  const locked = path.join(dir, 'projects', 'p', 'locked.jsonl');
  const real = fs.readFileSync;
  fs.readFileSync = (file, ...rest) => {
    if (file === locked) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
    return real(file, ...rest);
  };
  try {
    const health = hookHealth({ claudeDir: dir, limit: 1 });
    assert.deepEqual(health.sessions.map((s) => s.id), ['locked']);
    assert.deepEqual(health.truncated, ['locked']);
  } finally {
    fs.readFileSync = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hookHealth throws when there is no projects folder to read', () => {
  assert.throws(() => hookHealth({ claudeDir: path.join(os.tmpdir(), 'no-such-claude-dir-hook-health') }));
});
