import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditEntries } from './audit.mjs';
// A transcript entry as Claude Code writes one, with its line.
const reply = (line, { text, tokens = 200000, timestamp = '2026-10-15T08:06:30.000Z', sidechain = false, model = 'claude-opus-5-5', tools = [] }) => ({
  line,
  entry: {
    type: 'assistant',
    isSidechain: sidechain,
    timestamp,
    message: {
      model,
      usage: { input_tokens: 10, cache_read_input_tokens: tokens - 10, cache_creation_input_tokens: 0, output_tokens: 5 },
      content: [...(text === undefined ? [] : [{ type: 'text', text }]), ...tools],
    },
  },
});
const send = (name, message) => ({ type: 'tool_use', id: `t-${name}`, name, input: name === 'SendMessage' ? { to: 'lead', message } : { session_id: 'local_x', message } });

test('auditEntries counts a stamped message hour more than a minute from its entry\'s time as wrong, with either tool', () => {
  const result = auditEntries([
    reply(10, { timestamp: '2026-10-15T08:06:40.000Z', tools: [send('SendMessage', 'From JH 15, 08:06 local. Done.')] }),
    reply(11, { timestamp: '2026-10-15T08:07:10.000Z', tools: [send('mcp__ccd_session_mgmt__send_message', 'From JH 15, 08:06 local. Next.')] }),
    reply(12, { timestamp: '2026-10-15T08:20:00.000Z', tools: [send('mcp__ccd_session_mgmt__send_message', 'From JH 15, 08:06 local. Late.')] }),
    reply(13, { timestamp: '2026-10-15T08:20:00.000Z', tools: [send('SendMessage', 'No hour here.')] }),
  ], { offsetMinutes: 0 });
  assert.equal(result.messages, 4);
  assert.equal(result.stamped, 3);
  assert.deepEqual(result.wrongHours, [{ line: 12, stamped: '08:06', sent: '08:20' }]);
});

test('auditEntries reads the hour of sending in the local time it is given', () => {
  const result = auditEntries([
    reply(5, { timestamp: '2026-10-15T13:06:10.000Z', tools: [send('SendMessage', 'From JH 15, 08:06 local. Done.')] }),
  ], { offsetMinutes: -300 });
  assert.deepEqual(result.wrongHours, []);
});

test('auditEntries counts a stated own share more than 2 points from the reply\'s recorded one as wrong', () => {
  const result = auditEntries([
    reply(20, { text: 'Contexto: 41 %.', tokens: 200000 }),
    reply(21, { text: 'Contexto: 30 %.', tokens: 300000 }),
    reply(22, { text: 'Nothing about context.', tokens: 300000 }),
  ], { offsetMinutes: 0 });
  assert.equal(result.shares, 2);
  assert.deepEqual(result.wrongShares, [{ line: 21, stated: 30, recorded: 60 }]);
});

// The result of a get_usage call as the transcript records it: a user entry with a tool result holding its JSON.
const usageRead = (line, { window, session = 'self' }) => ({
  line,
  entry: {
    type: 'user',
    timestamp: '2026-10-15T08:06:00.000Z',
    message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: [{ type: 'text', text: JSON.stringify({ context: { session, status: 'ok', tokensUsed: 1, contextWindow: window, percentUsed: 0 } }, null, 2) }] }] },
  },
});

test('auditEntries takes a share of the window the session\'s own last get_usage read reports, the first read for the replies before it', () => {
  // Sessions run on windows of 300,000, 350,000 and 500,000 tokens, and one changed its window midway (2026-10-15).
  const result = auditEntries([
    reply(40, { text: 'Contexto: 50 %.', tokens: 150000 }),
    usageRead(41, { window: 300000 }),
    reply(42, { text: 'Mi contexto: 49% (148k de 300k).', tokens: 148000 }),
    usageRead(43, { window: 500000, session: 'local_other' }),
    reply(44, { text: 'Contexto: 50 %.', tokens: 150000 }),
    usageRead(45, { window: 500000 }),
    reply(46, { text: 'Contexto: 50 %.', tokens: 150000 }),
  ], { offsetMinutes: 0 });
  assert.equal(result.shares, 4);
  assert.equal(result.windowRead, true);
  assert.deepEqual(result.wrongShares, [{ line: 46, stated: 50, recorded: 30 }]);
});

test('auditEntries takes no window from a side chain\'s get_usage read (Codex, 2026-10-15)', () => {
  const sidechain = usageRead(60, { window: 300000 });
  sidechain.entry.isSidechain = true;
  const result = auditEntries([sidechain, reply(61, { text: 'Contexto: 30 %.', tokens: 150000 })], { offsetMinutes: 0 });
  assert.equal(result.windowRead, false);
  assert.deepEqual(result.wrongShares, []);
});

test('auditEntries reads each hour of sending at the offset of its own time, so a day across a clock change reads right (Codex, 2026-10-15)', () => {
  // A host on UTC-5 in winter and UTC-4 in summer: both messages were stamped right by the local clock.
  const offsetAt = (timestamp) => (timestamp < '2026-03-08T07:00:00.000Z' ? -300 : -240);
  const result = auditEntries([
    reply(70, { timestamp: '2026-01-15T13:00:20.000Z', tools: [send('SendMessage', 'From JH 15, 08:00 local. Winter.')] }),
    reply(71, { timestamp: '2026-07-15T12:00:20.000Z', tools: [send('SendMessage', 'From JH 15, 08:00 local. Summer.')] }),
    reply(72, { timestamp: '2026-07-15T13:00:20.000Z', tools: [send('SendMessage', 'From JH 15, 08:00 local. An hour late.')] }),
  ], { offsetMinutes: offsetAt });
  assert.equal(result.stamped, 3);
  assert.deepEqual(result.wrongHours, [{ line: 72, stamped: '08:00', sent: '09:00' }]);
});

test('auditEntries says when no get_usage read gave the window, so its shares are of the default one', () => {
  const result = auditEntries([reply(50, { text: 'Contexto: 30 %.', tokens: 150000 })], { offsetMinutes: 0 });
  assert.equal(result.windowRead, false);
  assert.deepEqual(result.wrongShares, []);
});

test('auditEntries reads only the session\'s own replies: no side chain, no reply the harness wrote', () => {
  const result = auditEntries([
    reply(30, { text: 'Contexto: 10 %.', tokens: 300000, sidechain: true, tools: [send('SendMessage', 'From JH 15, 01:00 local.')] }),
    reply(31, { text: 'Contexto: 10 %.', tokens: 300000, model: '<synthetic>' }),
    { line: 32, entry: { type: 'user', timestamp: '2026-10-15T08:06:00.000Z', message: { content: 'Contexto: 10 %.' } } },
  ], { offsetMinutes: 0 });
  assert.deepEqual(result, { messages: 0, stamped: 0, wrongHours: [], shares: 0, wrongShares: [], windowRead: false });
});
