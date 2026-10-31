import test from 'node:test';
import assert from 'node:assert/strict';
import { linesHolding, personTimesIn, personTimesOf } from './person-times.mjs';
import { parseTranscript, personAtOf } from './sessions.mjs';

// When the person wrote, read for the return check (odd/tasks/lead-duty-checks.md, spec 2). The entries have the
// shapes of bin/lib/sessions.test.mjs, which holds the cases of whose words an entry is: here only that the fast read
// gives what the whole parse gives.
const at = (minute) => `2026-01-01T10:${String(minute).padStart(2, '0')}:00.000Z`;
const base = (minute) => ({ timestamp: at(minute), isSidechain: false });
const transcript = (...entries) => entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
const prompt = (text, minute) => ({ type: 'user', ...base(minute), origin: { kind: 'human' }, message: { role: 'user', content: text } });
const reply = (text, minute) => ({ type: 'assistant', ...base(minute), message: { role: 'assistant', content: [{ type: 'text', text }] } });
const result = (id, toolUseResult, minute) => ({ type: 'user', ...base(minute), toolUseResult, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const told = (minute) => ({ type: 'user', ...base(minute), isMeta: true, origin: { kind: 'peer', name: 'JH ORQ · proj', fromSession: 'local_1' }, message: { role: 'user', content: 'made up' } });
const queued = (minute, attachment = {}) => ({ type: 'attachment', ...base(minute), attachment: { type: 'queued_command', prompt: 'made up', origin: { kind: 'human' }, timestamp: at(minute), humanTurn: true, ...attachment } });
const QUESTION = 'Pregunta 10: ¿cómo llega a esfuerzo alto?';
const asked = (id, minute) => ({ type: 'assistant', ...base(minute), message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions: [{ question: QUESTION, options: [{ label: 'Alto' }, { label: 'Dejar' }] }] } }] } });
const answered = (id, minute, answer) => result(id, { questions: [], answers: { [QUESTION]: answer } }, minute);

test('personTimesIn reads every time he wrote, oldest first, by quoteOf\'s rule, as the whole parse does', () => {
  const text = transcript(
    prompt('newer', 5), prompt('older', 2), reply('working', 3), queued(4), told(6), result('toolu_b1', { stdout: 'human' }, 7),
    asked('toolu_q1', 8), answered('toolu_q1', 9, 'Alto'), queued(10, { humanTurn: undefined }),
  );
  assert.deepEqual(personTimesIn(text), [at(2), at(4), at(5), at(9)]);
  assert.deepEqual(personTimesIn(text), personTimesOf(parseTranscript(text).entries), 'the lines it skips hold none of his');
  assert.equal(personAtOf(parseTranscript(text).entries), at(9), 'the newest is the board\'s');
  assert.deepEqual(personTimesIn(transcript(reply('only mine', 1))), []);
});

test('linesHolding gives each line that holds a mark once, in file order, and never a record the host keeps of its own requests', () => {
  const text = [
    '{"type":"user","a":"human","b":"answers"}',
    '{"type":"api-request-shape","shape":"human"}',
    '{"parentUuid":"x","attachment":{"type":"prompt_snapshot","systemPrompt":"human"}}',
    '{"type":"assistant","b":"answers"}',
    '{"type":"user","c":"none"}',
    '{"type":"user","d":"human"}',
  ].join('\n');
  assert.deepEqual(linesHolding(text, ['"human"', '"answers"']), [
    '{"type":"user","a":"human","b":"answers"}',
    '{"type":"assistant","b":"answers"}',
    '{"type":"user","d":"human"}',
  ], 'a short line before a host record is kept: its head is its own');
  assert.deepEqual(linesHolding('', ['"human"']), []);
  assert.deepEqual(linesHolding(text, []), [], 'no mark finds no line');
});

test('linesHolding\'s one pass finds the lines a pass a mark found, marks with a regex\'s characters and marks inside marks', () => {
  // The search as it was before the one pass (odd/tasks/reply-hook-latency.md, T3), kept as the reference.
  const aPassAMark = (text, marks) => {
    const starts = new Set();
    for (const mark of marks) {
      for (let at = text.indexOf(mark); at >= 0;) {
        starts.add(text.lastIndexOf('\n', at) + 1);
        const end = text.indexOf('\n', at);
        if (end < 0) break;
        at = text.indexOf(mark, end + 1);
      }
    }
    return [...starts].sort((a, b) => a - b).map((start) => {
      const end = text.indexOf('\n', start);
      return text.slice(start, end < 0 ? text.length : end);
    }).filter((line) => !line.slice(0, 256).includes('"type":"api-request-shape"') && !line.slice(0, 256).includes('"type":"prompt_snapshot"'));
  };
  const pieces = ['"human"', 'human', '"a.b"', 'axb', '(x)', '"answers"', 'ñandú', '{}', '\\'];
  let state = 7;
  const next = (n) => {
    state = (state * 48271) % 2147483647;
    return state % n;
  };
  const lines = Array.from({ length: 400 }, () => Array.from({ length: 1 + next(4) }, () => pieces[next(pieces.length)]).join(' · '));
  const text = lines.join('\n');
  for (const marks of [['"human"', 'human'], ['"a.b"'], ['(x)', '\\'], ['ñandú', '"answers"', '{}'], ['absent']]) {
    assert.deepEqual(linesHolding(text, marks), aPassAMark(text, marks), marks.join(' '));
    assert.deepEqual(linesHolding(`${text}\n`, marks), aPassAMark(`${text}\n`, marks), `${marks.join(' ')}, with a last line break`);
  }
});
