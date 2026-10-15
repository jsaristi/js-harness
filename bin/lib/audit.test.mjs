import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditEntries, ownShares } from './audit.mjs';

// Clauses read from this project's transcripts (2026-10-12 to 2026-10-15), each with the share it states of the
// session that wrote it.
const OWN = [
  ['Volví con el 24 % de mi contexto.', [24]],
  ['Contexto ~91%.', [91]],
  ['Contexto: 77%.', [77]],
  ['**Contexto: 86 %.** Llegué al punto de pausa, así que dejo el estado escrito.', [86]],
  ['Mi contexto: 62 %.', [62]],
  ['- **Mi contexto:** 55 %.', [55]],
  ['Contexto cerca del 30 %.', [30]],
  ['Contexto: cerca del 82 %;', [82]],
  ['Estoy en 77 % de contexto (383k de 500k) y la pausa es al 88 %.', [77]],
  ['Llevo el 82% del contexto: me queda margen hasta la pausa del 88%.', [82]],
  ['Esta sesión está en 66% de contexto, y el prompt de apertura guardado quedó al día.', [66]],
  ['Contexto de esta sesión: **83%**.', [83]],
  ['**Qué sigue y por qué cortar ahora:** el contexto de esta sesión está en 76%.', [76]],
  ['Ahora no: esta sesión está cerca del 87% de contexto, y media docena de notas cruzarían la compactación.', [87]],
  ['el contexto de esta sesión anda cerca del 87 %.', [87]],
  ['**Topes:** plan de Claude 85 % de la semana (te aviso al 95 %), Codex 34 % (te aviso al 80 %), mi contexto 75 % (si llego a 88 me resumo y sigo).', [75]],
  ['Context: 35%.', [35]],
  ['I am at 40% of my context.', [40]],
  ['Estoy en 77 % de contexto (383k de 500k).', [77]],
];

// Clauses that name a context share that is not the writer's present one: another session's, a threshold, a
// phase of the roadmap, a share dated by the hour it was read, a past one, a share of another window.
const NOT_OWN = [
  'JH 9 corrigió un dato: está al 79 % de contexto, no al 75 % que había dicho.',
  'F2 Context diet 75%, F6 Codex parity 0%;',
  'Contexto: lo leí a las 21:02 y estaba en 39 %;',
  '**Mapa:** contexto del lead al ~37% de 350k.',
  '| F2 Dieta de contexto | 75 % |',
  'Todas las fases al 100 % salvo dieta de contexto (75 %), paridad con Codex (0 %).',
  '- **JH 16 · memoria e higiene:** trabajando, al 90% de contexto.',
  '- **JH 15 está al 88 % de contexto.** Sus dos bloques de corte te los dejó a vos.',
  'A las 06:10 el contexto estaba en 26 %, el plan semanal en 93 %.',
  '**Una corrección mía:** en los últimos recaps dije que el contexto iba en 30-40%.',
  'JH 8 está al 88 % de su contexto.',
  'está en 88 % de contexto y la app la va a compactar sola.',
  'Pauso al 88 % del contexto.',
  'Son las 06:45 y voy por el 26% del contexto.',
  'Mi contexto: 70 % de 350k.',
  '- Mi contexto: 49% (148k de 300k).',
];

test('ownShares reads the share a session states of its own context', () => {
  for (const [text, expected] of OWN) assert.deepEqual(ownShares(text).map((share) => share.stated), expected, text);
});

test('ownShares leaves out a share that is not the writer\'s present one', () => {
  for (const text of NOT_OWN) assert.deepEqual(ownShares(text), [], text);
});

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

test('auditEntries says when no get_usage read gave the window, so its shares are of the default one', () => {
  const result = auditEntries([reply(50, { text: 'Contexto: 30 %.', tokens: 150000 })], { offsetMinutes: 0 });
  assert.equal(result.windowRead, false);
  assert.deepEqual(result.wrongShares, []);
});

test('ownShares keeps a share of the window it is told is the session\'s', () => {
  assert.deepEqual(ownShares('- Mi contexto: 49% (148k de 300k).', 300000).map((share) => share.stated), [49]);
});

test('auditEntries reads only the session\'s own replies: no side chain, no reply the harness wrote', () => {
  const result = auditEntries([
    reply(30, { text: 'Contexto: 10 %.', tokens: 300000, sidechain: true, tools: [send('SendMessage', 'From JH 15, 01:00 local.')] }),
    reply(31, { text: 'Contexto: 10 %.', tokens: 300000, model: '<synthetic>' }),
    { line: 32, entry: { type: 'user', timestamp: '2026-10-15T08:06:00.000Z', message: { content: 'Contexto: 10 %.' } } },
  ], { offsetMinutes: 0 });
  assert.deepEqual(result, { messages: 0, stamped: 0, wrongHours: [], shares: 0, wrongShares: [], windowRead: false });
});
