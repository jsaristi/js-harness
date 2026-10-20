import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as channel from './channel.mjs';

// Every test writes under a home of its own in the temp folder: nothing here reads or writes the real
// home, and the transcripts are synthetic.

const SLUG = 'C--proj';
const AT = '2026-01-01T12:00:00.000Z';
const FROM = { host: 'claude-code', id: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'environment', title: 'JH 5 · canal entre sesiones', permissionMode: 'auto' };

function withHome(body) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-channel-'));
    try {
      await body(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

const note = (fields = {}) => channel.newNotice({ at: AT, from: FROM, to: 'orchestrator', kind: 'note', text: 'the gate passed', ...fields });
const refused = (fields, pattern) => assert.throws(() => note(fields), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), JSON.stringify(fields));

// --- where the channel lives ---

test('everything the channel writes is in one folder under the home, beside the relief file', () => {
  const home = path.join('C:', 'home');
  assert.equal(channel.channelDir(home), path.join(home, '.js-harness', 'channel'));
  assert.equal(channel.recordPath(home, SLUG), path.join(home, '.js-harness', 'channel', 'C--proj.jsonl'));
  assert.equal(channel.openingsDir(home, SLUG), path.join(home, '.js-harness', 'channel', 'openings', 'C--proj'));
  assert.equal(channel.reliefPath(home, SLUG), path.join(home, '.js-harness', 'relief', 'C--proj.md'));
});

// --- a notice ---

test('a notice is a schema, the time, the sender, the role it is for, the kind, the text and where it was run from', () => {
  const made = note({ to: 'ORQ', kind: 'opened', text: 'session channel, T1', cwd: 'C:\\proj-worktrees\\channel', worktree: 'C:\\proj-worktrees\\channel', branch: 'feat/session-record' });
  assert.deepEqual(made, {
    schema: 'js-harness.channel-notice/v1',
    at: AT,
    from: FROM,
    to: { role: 'orchestrator', number: null },
    kind: 'opened',
    text: 'session channel, T1',
    cwd: 'C:\\proj-worktrees\\channel',
    worktree: 'C:\\proj-worktrees\\channel',
    branch: 'feat/session-record',
  });
  assert.deepEqual(note({ to: '5' }).to, { role: 'work', number: 5 });
  // Where it was run from is null when it could not be read, never left out.
  assert.deepEqual([note().cwd, note().worktree, note().branch], [null, null, null]);
});

test('the kinds are nine, question, withdrawn and ready last and in that order, and no other is one', () => {
  assert.deepEqual(channel.NOTICE_KINDS, ['opened', 'waiting', 'closed', 'note', 'answer', 'relieved', 'question', 'withdrawn', 'ready']);
  for (const kind of channel.NOTICE_KINDS.filter((one) => !['answer', 'question', 'withdrawn', 'ready'].includes(one))) assert.equal(note({ kind }).kind, kind);
  for (const kind of ['done', 'Note', '', undefined, 'constructor']) refused({ kind }, /--kind takes one of opened, waiting, closed, note, answer, relieved, question, withdrawn, ready/);
});

// odd/tasks/wake-and-flag.md, T1 (B1 of the throughput plan): a pull request is announced ready with its number, so
// the land can tell which session it belongs to without reading a branch (most ready notices are sent from main).
test('a ready notice carries the number of its pull request, and only a ready notice takes one', () => {
  const ready = note({ kind: 'ready', pr: 344, text: 'T20b: every wait ends on a notice to its own number' });
  assert.deepEqual(ready, { schema: 'js-harness.channel-notice/v1', at: AT, from: FROM, to: { role: 'orchestrator', number: null }, kind: 'ready', text: 'T20b: every wait ends on a notice to its own number', cwd: null, worktree: null, branch: null, pr: 344 });
  refused({ kind: 'ready', text: 'ready' }, /a ready notice names its pull request: --pr <n>/);
  for (const pr of [0, -1, 1.5, '344', Number.MAX_SAFE_INTEGER + 1]) refused({ kind: 'ready', pr, text: 'ready' }, /--pr takes the number of a pull request, from 1/);
  for (const kind of ['opened', 'waiting', 'closed', 'note', 'relieved', 'withdrawn']) refused({ kind, pr: 344, question: kind === 'withdrawn' ? 1 : undefined, text: 'x' }, /only a ready notice takes --pr/);
  refused({ kind: 'answer', pr: 344, text: 'A', transcript: '1d16beeb', line: 4 }, /only a ready notice takes --pr/);
  refused({ kind: 'ready', pr: 344, text: 'ready', question: 1 }, /only an answer or a withdrawal takes --question/);
});

// The summary a finished session leaves (odd/tasks/session-close.md, T2): the record keeps its file.
test('a closed notice keeps the file of its summary, under docs/sessions, and no other kind takes one', () => {
  assert.equal(note({ kind: 'closed', text: 'delivered', summary: 'docs/sessions/2026-10-17-jh-24.md' }).summary, 'docs/sessions/2026-10-17-jh-24.md');
  assert.equal(note({ kind: 'closed', text: 'delivered', summary: 'docs\\sessions\\2026-10-17-jh-24.md' }).summary, 'docs/sessions/2026-10-17-jh-24.md');
  // A closed notice built by a library caller, or read from the record, may have none: the command requires it.
  assert.equal('summary' in note({ kind: 'closed', text: 'delivered' }), false);
  for (const summary of ['README.md', 'docs/sessions/a.txt', '../docs/sessions/a.md', 'docs/sessions/sub/a.md', '/docs/sessions/a.md', 'C:/r/docs/sessions/a.md', 'docs/sessions/.md', '']) {
    refused({ kind: 'closed', text: 'delivered', summary }, /--summary takes a file of docs\/sessions\/, as js-harness summary path names it/);
  }
  for (const kind of ['opened', 'waiting', 'note', 'relieved']) refused({ kind, summary: 'docs/sessions/a.md' }, /only a closed notice takes --summary/);
  refused({ kind: 'ready', pr: 344, summary: 'docs/sessions/a.md' }, /only a closed notice takes --summary/);
});

test('readNotices keeps a ready notice with its pull request, and skips one without a number', withHome((home) => {
  const file = channel.recordPath(home, SLUG);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ready = note({ kind: 'ready', pr: 344, text: 'ready to land' });
  const { pr, ...unnumbered } = ready;
  const lines = [ready, unnumbered, { ...ready, pr: '344' }, { ...ready, pr: 0 }].map((one) => JSON.stringify(one));
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual(read.notices, [ready]);
  assert.equal(read.skipped, 3);
}));

test('a notice is for a role: the orchestrator or the number of a work session', () => {
  for (const to of ['boss', 'JH 5', '', '5.5', undefined]) refused({ to }, /--to takes a role/);
});

test('the text is one line: not empty, no line break, 500 characters at most', () => {
  assert.equal(channel.NOTICE_TEXT_MAX, 500);
  assert.equal(note({ text: 'x'.repeat(500) }).text.length, 500);
  assert.equal(note({ text: '  padded  ' }).text, 'padded', 'the blanks around it are not part of it');
  refused({ text: '' }, /empty/);
  refused({ text: '   ' }, /empty/);
  refused({ text: undefined }, /empty/);
  for (const text of ['two\nlines', 'two\r\nlines', 'old\rmac', 'next\u0085line', 'line\u2028separator', 'paragraph\u2029separator']) refused({ text }, /one line/);
  refused({ text: 'x'.repeat(501) }, /501 characters.*500 at most/);
});

test('an answer carries the transcript and the line his words are read at, and no other kind takes them', () => {
  const answer = note({ kind: 'answer', text: 'A, as automatic as possible', transcript: '1d16beeb', line: 406 });
  assert.deepEqual([answer.transcript, answer.line], ['1d16beeb', 406]);
  assert.deepEqual(Object.keys(answer).slice(-2), ['transcript', 'line']);
  refused({ kind: 'answer' }, /answer.*--transcript.*--line/);
  refused({ kind: 'answer', transcript: '1d16beeb' }, /answer.*--transcript.*--line/);
  refused({ kind: 'answer', line: 406 }, /answer.*--transcript.*--line/);
  for (const line of [0, -1, 1.5, '406', Number.MAX_SAFE_INTEGER + 1]) refused({ kind: 'answer', transcript: '1d16beeb', line }, /--line takes the number of a line/);
  for (const transcript of ['', '  ', 'two\nlines']) refused({ kind: 'answer', transcript, line: 1 }, /--transcript/);
  refused({ kind: 'note', transcript: '1d16beeb', line: 406 }, /only an answer takes --transcript and --line/);
  refused({ kind: 'closed', line: 406 }, /only an answer takes --transcript and --line/);
  assert.equal('transcript' in note(), false);
});

// --- a question, a withdrawal, and the copy of an answer ---

const asking = (fields = {}) => note({ kind: 'question', text: 'Which budget?', id: 'q-1', options: [], waits: 'the sprint', ...fields });
const askingRefused = (fields, pattern) => assert.throws(() => asking(fields), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), JSON.stringify(Object.keys(fields)));
const copyOfAnswered = { tool: 'AskUserQuestion', answers: [{ question: '¿Qué presupuesto?', options: ['Low', 'High'], answer: 'Low', how: 'tapped' }] };

test('the limits of a question are 2000 characters of text, six options, 120 characters a label, 500 a description and 500 for what waits, and the copy of an answer keeps 2000', () => {
  assert.deepEqual([channel.QUESTION_TEXT_MAX, channel.QUESTION_OPTIONS_MAX, channel.OPTION_LABEL_MAX, channel.OPTION_DESCRIPTION_MAX, channel.QUESTION_WAITS_MAX, channel.ANSWER_COPY_TEXT_MAX], [2000, 6, 120, 500, 500, 2000]);
});

const questionJson = (fields = {}) => JSON.stringify({ text: 'Which budget?', options: [{ label: 'Low (Recomendado)', description: 'the cheap one' }], waits: 'the sprint', ...fields });
const questionRefusedIn = (json, pattern) => assert.throws(() => channel.questionFieldsOf(json), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), json.slice(0, 80));

test('a question takes its fields from standard input as JSON: its text, its options with a label and a description, and what waits', () => {
  assert.deepEqual(channel.questionFieldsOf(questionJson({ text: '  ¿Qué presupuesto?  ' })), { text: '¿Qué presupuesto?', options: [{ label: 'Low (Recomendado)', description: 'the cheap one' }], waits: 'the sprint' });
  assert.deepEqual(channel.questionFieldsOf(questionJson({ options: [] })).options, [], 'a question with nothing to tap is allowed');
  assert.deepEqual(channel.questionFieldsOf(questionJson({ options: [{ label: 'Otro' }] })).options, [{ label: 'Otro', description: '' }], 'a missing description is stored as an empty text');
  assert.equal(channel.questionFieldsOf(`\uFEFF${questionJson()}`).text, 'Which budget?', 'a byte order mark is not part of the text');
});

test('standard input that is not JSON, or is JSON that is not an object, is refused in words', () => {
  for (const json of ['', 'Which budget?', '{"text":', 'undefined']) questionRefusedIn(json, /what came is not JSON/);
  for (const json of ['null', '[]', '"Which budget?"', '5', 'true']) questionRefusedIn(json, /what came is not an object/);
});

test('a question takes no key but text, options and waits, and the refusal names the key it found', () => {
  questionRefusedIn(questionJson({ due: 'Friday' }), /a question takes no key "due": it takes text, options and waits/);
});

test('the text of a question is one line, not empty, of 2000 characters at most', () => {
  questionRefusedIn(questionJson({ text: '' }), /the text of a question is empty/);
  questionRefusedIn(questionJson({ text: 'two\nlines' }), /the text of a question is one line/);
  questionRefusedIn(questionJson({ text: 'x'.repeat(2001) }), /the text of a question has 2001 characters, 2000 at most/);
  assert.equal(channel.questionFieldsOf(questionJson({ text: 'x'.repeat(2000) })).text.length, 2000);
});

test('the options of a question are a list of six at most, each a label and a description and no other key, and no two share a label', () => {
  const many = (count) => Array.from({ length: count }, (_, i) => ({ label: `Option ${i}` }));
  questionRefusedIn(questionJson({ options: undefined }), /the options of a question are a list, the recommended one first/);
  questionRefusedIn(questionJson({ options: 'Low' }), /the options of a question are a list/);
  questionRefusedIn(questionJson({ options: { label: 'Low' } }), /the options of a question are a list/);
  questionRefusedIn(questionJson({ options: many(7) }), /a question has 7 options, 6 at most/);
  assert.equal(channel.questionFieldsOf(questionJson({ options: many(6) })).options.length, 6);
  questionRefusedIn(questionJson({ options: ['Low'] }), /an option of a question is an object/);
  questionRefusedIn(questionJson({ options: [{ label: 'Low', color: 'red' }] }), /an option takes no key "color": it takes label and description/);
  questionRefusedIn(questionJson({ options: [{ label: '' }] }), /the label of an option is empty/);
  questionRefusedIn(questionJson({ options: [{ label: 'two\nlines' }] }), /the label of an option is one line/);
  questionRefusedIn(questionJson({ options: [{ label: 'x'.repeat(121) }] }), /the label of an option has 121 characters, 120 at most/);
  questionRefusedIn(questionJson({ options: [{ label: 'Low', description: 5 }] }), /the description of an option is a text/);
  questionRefusedIn(questionJson({ options: [{ label: 'Low', description: 'two\nlines' }] }), /the description of an option is one line/);
  questionRefusedIn(questionJson({ options: [{ label: 'Low', description: 'x'.repeat(501) }] }), /the description of an option has 501 characters, 500 at most/);
  assert.equal(channel.questionFieldsOf(questionJson({ options: [{ label: 'Low', description: 'x'.repeat(500) }] })).options[0].description.length, 500);
  questionRefusedIn(questionJson({ options: [{ label: 'Low' }, { label: ' Low ' }] }), /two options of a question have the label "Low"/);
});

test('what waits on a question is one line, not empty, of 500 characters at most', () => {
  questionRefusedIn(questionJson({ waits: undefined }), /what waits on a question is empty/);
  questionRefusedIn(questionJson({ waits: '' }), /what waits on a question is empty/);
  questionRefusedIn(questionJson({ waits: 'two\nlines' }), /what waits on a question is one line/);
  questionRefusedIn(questionJson({ waits: 'x'.repeat(501) }), /what waits on a question has 501 characters, 500 at most/);
});

test('a question is the base notice, then its id, its options and its waits, in that order', () => {
  const made = asking({ id: '  q-7f3a  ', text: '  Which budget?  ', options: [{ label: 'Low (Recomendado)', description: 'the cheap one' }, { label: 'High' }], waits: 'the sprint' });
  assert.deepEqual(Object.keys(made), ['schema', 'at', 'from', 'to', 'kind', 'text', 'cwd', 'worktree', 'branch', 'id', 'options', 'waits']);
  assert.deepEqual(made, {
    schema: 'js-harness.channel-notice/v1',
    at: AT,
    from: FROM,
    to: { role: 'orchestrator', number: null },
    kind: 'question',
    text: 'Which budget?',
    cwd: null,
    worktree: null,
    branch: null,
    id: 'q-7f3a',
    options: [{ label: 'Low (Recomendado)', description: 'the cheap one' }, { label: 'High', description: '' }],
    waits: 'the sprint',
  });
});

test('a question goes to the orchestrator, who asks him, and takes an id of one line and 100 characters at most', () => {
  assert.equal(asking({ to: 'ORQ' }).to.role, 'orchestrator');
  askingRefused({ to: '5' }, /a question goes to the orchestrator, who asks the user/);
  askingRefused({ id: undefined }, /the id of a question is empty/);
  askingRefused({ id: '' }, /the id of a question is empty/);
  askingRefused({ id: 'x'.repeat(101) }, /the id of a question has 101 characters, 100 at most/);
  askingRefused({ id: 'two\nids' }, /the id of a question is one line/);
  assert.equal(asking({ id: 'x'.repeat(100) }).id.length, 100);
});

test('the text of a question may be 2000 characters where a note may be 500, and its options and waits are checked as standard input checks them', () => {
  assert.equal(asking({ text: 'x'.repeat(2000) }).text.length, 2000);
  askingRefused({ text: 'x'.repeat(2001) }, /the text of a question has 2001 characters, 2000 at most/);
  askingRefused({ text: 'two\nlines' }, /the text of a question is one line/);
  askingRefused({ text: '' }, /the text of a question is empty/);
  refused({ text: 'x'.repeat(501) }, /501 characters.*500 at most/);
  askingRefused({ options: [{ label: 'Low' }, { label: 'Low' }] }, /two options of a question have the label "Low"/);
  askingRefused({ options: 'Low' }, /the options of a question are a list/);
  askingRefused({ options: [{ label: 'x'.repeat(121) }] }, /the label of an option has 121 characters, 120 at most/);
  askingRefused({ waits: '' }, /what waits on a question is empty/);
});

test('a question refuses a transcript and a line, a question number, a verdict and a copy', () => {
  askingRefused({ transcript: '1d16beeb', line: 4 }, /only an answer takes --transcript and --line/);
  askingRefused({ question: 1 }, /only an answer or a withdrawal takes --question/);
  askingRefused({ verified: true }, /only an answer with a question takes verified and copy/);
  askingRefused({ copy: null }, /only an answer with a question takes verified and copy/);
});

test('every other kind refuses the question fields, and a withdrawal takes its question number and nothing of a question', () => {
  for (const kind of ['opened', 'waiting', 'closed', 'note', 'relieved']) {
    refused({ kind, id: 'q-1' }, /only a question takes id, options and waits/);
    refused({ kind, options: [] }, /only a question takes id, options and waits/);
    refused({ kind, waits: 'the sprint' }, /only a question takes id, options and waits/);
    refused({ kind, question: 1 }, /only an answer or a withdrawal takes --question/);
    refused({ kind, verified: true }, /only an answer with a question takes verified and copy/);
    refused({ kind, copy: null }, /only an answer with a question takes verified and copy/);
  }
});

test('a withdrawal names its question and its reason is its text, one line of 500 characters at most', () => {
  const closing = note({ kind: 'withdrawn', question: 3, text: 'he moved on to the next task' });
  assert.deepEqual(closing, { schema: 'js-harness.channel-notice/v1', at: AT, from: FROM, to: { role: 'orchestrator', number: null }, kind: 'withdrawn', text: 'he moved on to the next task', cwd: null, worktree: null, branch: null, question: 3 });
  refused({ kind: 'withdrawn', text: 'why' }, /a withdrawal names its question: --question <n>/);
  for (const question of [0, -1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1]) refused({ kind: 'withdrawn', question, text: 'why' }, /--question takes the number of a question, from 1/);
  refused({ kind: 'withdrawn', question: 1, text: 'x'.repeat(501) }, /501 characters.*500 at most/);
  const extras = [
    [{ transcript: '1d16beeb', line: 4 }, /only an answer takes --transcript and --line/],
    [{ id: 'q-1' }, /only a question takes id, options and waits/],
    [{ options: [] }, /only a question takes id, options and waits/],
    [{ waits: 'the sprint' }, /only a question takes id, options and waits/],
    [{ verified: true }, /only an answer with a question takes verified and copy/],
    [{ copy: null }, /only an answer with a question takes verified and copy/],
  ];
  for (const [extra, pattern] of extras) refused({ kind: 'withdrawn', question: 1, text: 'why', ...extra }, pattern);
});

test('an answer with no question keeps the shape it had, and takes neither verified nor copy', () => {
  const plain = note({ kind: 'answer', text: 'A, as automatic as possible', transcript: '1d16beeb', line: 406 });
  assert.deepEqual(Object.keys(plain), ['schema', 'at', 'from', 'to', 'kind', 'text', 'cwd', 'worktree', 'branch', 'transcript', 'line']);
  refused({ kind: 'answer', transcript: '1d16beeb', line: 406, verified: true, copy: copyOfAnswered }, /only an answer with a question takes verified and copy/);
  refused({ kind: 'answer', transcript: '1d16beeb', line: 406, copy: null }, /only an answer with a question takes verified and copy/);
});

test('an answer names its question, and is verified only where its line was read: then it keeps the copy of what the line holds', () => {
  const verified = note({ kind: 'answer', text: 'Low', transcript: '1d16beeb', line: 406, question: 3, verified: true, copy: { ...copyOfAnswered, askedAt: AT } });
  assert.deepEqual(Object.keys(verified).slice(-5), ['transcript', 'line', 'question', 'verified', 'copy']);
  assert.deepEqual([verified.question, verified.verified, verified.copy], [3, true, copyOfAnswered]);
  const unread = note({ kind: 'answer', text: 'Low', transcript: '1d16beeb', line: 406, question: 3, verified: false, copy: null });
  assert.deepEqual([unread.question, unread.verified, unread.copy], [3, false, null]);
  const cases = [
    [{ question: 0, verified: true, copy: copyOfAnswered }, /--question takes the number of a question, from 1/],
    [{ question: '3', verified: true, copy: copyOfAnswered }, /--question takes the number of a question, from 1/],
    [{ question: 3 }, /verified takes true or false/],
    [{ question: 3, verified: 'yes', copy: null }, /verified takes true or false/],
    [{ question: 3, verified: true }, /a verified answer takes copy/],
    [{ question: 3, verified: true, copy: null }, /a verified answer takes copy/],
    [{ question: 3, verified: true, copy: ['Low'] }, /a verified answer takes copy/],
    [{ question: 3, verified: true, copy: { tool: null, answers: [] } }, /the copy of an answer has no answers/],
    [{ question: 3, verified: false, copy: copyOfAnswered }, /an answer that was not verified takes copy null/],
  ];
  for (const [fields, pattern] of cases) refused({ kind: 'answer', transcript: '1d16beeb', line: 406, ...fields }, pattern);
});

test('a verified answer keeps when its question was shown and when he answered it, and a typed one only when he answered', () => {
  const SHOWN = '2026-10-17T09:05:00.000Z';
  const ANSWERED = '2026-10-17T09:20:00.000Z';
  const base = { kind: 'answer', text: 'Low', transcript: '1d16beeb', line: 406, question: 3, verified: true };
  const tapped = note({ ...base, copy: copyOfAnswered, shownAt: SHOWN, answeredAt: ANSWERED });
  assert.deepEqual(Object.keys(tapped).slice(-4), ['verified', 'copy', 'shownAt', 'answeredAt']);
  assert.deepEqual([tapped.shownAt, tapped.answeredAt], [SHOWN, ANSWERED]);
  const typedCopy = { tool: null, answers: [{ question: 'Pregunta 3: ¿cuál?', options: [], answer: 'Low', how: 'typed in the chat' }] };
  const typed = note({ ...base, copy: typedCopy, answeredAt: ANSWERED });
  assert.equal(typed.answeredAt, ANSWERED);
  assert.equal('shownAt' in typed, false);
  // Written without them, as every answer before B4b was: the same keys as before.
  assert.deepEqual(Object.keys(note({ ...base, copy: copyOfAnswered })).slice(-2), ['verified', 'copy']);
  const cases = [
    [{ ...base, copy: copyOfAnswered, answeredAt: 'yesterday' }, /answeredAt takes a time/],
    [{ ...base, copy: copyOfAnswered, shownAt: 42, answeredAt: ANSWERED }, /shownAt takes a time/],
    [{ ...base, copy: typedCopy, shownAt: SHOWN, answeredAt: ANSWERED }, /no tool showed an answer typed in the chat/],
    [{ ...base, verified: false, copy: null, answeredAt: ANSWERED }, /only a verified answer takes shownAt and answeredAt/],
    [{ kind: 'answer', text: 'Low', transcript: '1d16beeb', line: 406, answeredAt: ANSWERED }, /only a verified answer takes shownAt and answeredAt/],
    [{ kind: 'note', text: 'hi', answeredAt: ANSWERED }, /only a verified answer takes shownAt and answeredAt/],
  ];
  for (const [fields, pattern] of cases) refused(fields, pattern);
});

test('the copy of an answer keeps the question, the options and the answer, cut to its limits, and drops the keys it does not know', () => {
  assert.deepEqual(channel.answerCopyOf({ ...copyOfAnswered, askedAt: AT }), copyOfAnswered);
  const long = 'x'.repeat(2500);
  const cut = channel.answerCopyOf({ tool: null, answers: [{ question: long, options: ['y'.repeat(130)], answer: long, how: 'typed' }] }).answers[0];
  assert.deepEqual(cut, { question: `${'x'.repeat(1999)}…`, options: [`${'y'.repeat(119)}…`], answer: `${'x'.repeat(1999)}…`, how: 'typed' });
  assert.equal(cut.question.length, channel.ANSWER_COPY_TEXT_MAX);
  const labels = Array.from({ length: 13 }, (_, i) => `Option ${i}`);
  assert.deepEqual(channel.answerCopyOf({ tool: 'AskUserQuestion', answers: [{ question: 'Which?', options: labels, answer: 'Option 0', how: 'tapped' }] }).answers[0].options, labels.slice(0, 12));
  const refusals = [
    [{ tool: 'AskUserQuestion', answers: [] }, /has no answers/],
    [{ tool: 'AskUserQuestion' }, /has no answers/],
    [null, /takes the tool that asked/],
    [{ tool: 7, answers: copyOfAnswered.answers }, /takes the tool that asked/],
    [{ tool: 'AskUserQuestion', answers: [{ question: 'Which?', options: ['Low'], answer: '  ', how: 'typed' }] }, /the answer to a question is empty/],
    [{ tool: 'AskUserQuestion', answers: [{ question: ' ', options: ['Low'], answer: 'Low', how: 'tapped' }] }, /the question of an answer is empty/],
    [{ tool: 'AskUserQuestion', answers: [{ question: 'Which?', options: 'Low', answer: 'Low', how: 'tapped' }] }, /the options of an answer are a list of labels/],
    [{ tool: 'AskUserQuestion', answers: ['Low'] }, /an answer of a copy is an object/],
  ];
  for (const [answered, pattern] of refusals) assert.throws(() => channel.answerCopyOf(answered), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), pattern.source);
});

// --- the record ---

test('appendNotice writes one JSON line per notice, creating the folder, and readNotices gives them back in order', withHome((home) => {
  const first = note();
  const second = note({ to: '5', kind: 'waiting', text: 'on his answer about the cap' });
  const file = channel.appendNotice(home, SLUG, first);
  assert.equal(file, channel.recordPath(home, SLUG));
  channel.appendNotice(home, SLUG, second);
  const text = fs.readFileSync(file, 'utf8');
  assert.deepEqual(text.split('\n'), [JSON.stringify(first), JSON.stringify(second), '']);
  assert.deepEqual(channel.readNotices(home, SLUG), { path: file, notices: [first, second], readings: [], questions: [], skipped: 0 });
}));

test('a project with no record yet has no notices, and that is not an error', withHome((home) => {
  assert.deepEqual(channel.readNotices(home, SLUG), { path: channel.recordPath(home, SLUG), notices: [], readings: [], questions: [], skipped: 0 });
}));

test('readNotices counts and skips a torn line and a line that is not a notice, and keeps the rest', withHome((home) => {
  const file = channel.recordPath(home, SLUG);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const good = note();
  const lines = [
    JSON.stringify(good),
    '{"schema":"js-harness.channel-notice/v1","at":"2026-01-01T12:0', // torn
    '',
    'null',
    '[1,2]',
    '"a string"',
    JSON.stringify({ schema: 'js-harness.codex-review/v1', at: AT }), // another file's record
    JSON.stringify({ ...good, kind: 'shouted' }),
    JSON.stringify({ ...good, text: 42 }),
    JSON.stringify({ ...good, to: 'everyone' }),
    JSON.stringify({ ...good, at: 'yesterday' }),
    JSON.stringify(note({ kind: 'closed', text: 'delivered' })),
  ];
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual(read.notices.map((one) => one.kind), ['note', 'closed']);
  assert.equal(read.skipped, 9);
}));

test('a record that is there and cannot be read is unavailable with the reason, never an empty record', withHome((home) => {
  const readFile = () => {
    throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  };
  assert.deepEqual(channel.readNotices(home, SLUG, { readFile }), { path: channel.recordPath(home, SLUG), unavailable: 'EACCES', notices: [], readings: [], questions: [], skipped: 0 });
}));

test('a question, a withdrawal and an answer with a number are kept only when they hold what makes them one', withHome((home) => {
  const file = channel.recordPath(home, SLUG);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const good = asking({ id: 'q-1' });
  const closing = note({ kind: 'withdrawn', question: 1, text: 'moved on' });
  const answered1 = note({ kind: 'answer', text: 'Low', transcript: '1d16beeb', line: 406, question: 1, verified: false, copy: null });
  const plain = note({ kind: 'answer', text: 'Low', transcript: '1d16beeb', line: 406 });
  const broken = [
    { ...good, id: undefined },
    { ...good, id: '' },
    { ...good, options: 'Low' },
    { ...good, waits: 5 },
    { ...closing, question: undefined },
    { ...closing, question: 0 },
    { ...closing, question: '1' },
    { ...answered1, question: 0 },
    { ...answered1, question: 1.5 },
  ];
  fs.writeFileSync(file, [good, ...broken, closing, answered1, plain].map((one) => JSON.stringify(one)).join('\n') + '\n', 'utf8');
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual(read.notices, [good, closing, answered1, plain]);
  assert.equal(read.skipped, broken.length);
  assert.deepEqual(read.questions, [{ number: 1, notice: good }]);
}));

test('readNotices numbers the question lines in the order written, a broken one included, so the next valid question has the following number', withHome((home) => {
  const first = asking({ id: 'q-1', text: 'first' });
  const broken = { ...asking({ id: 'q-2', text: 'second' }), id: '' };
  const third = asking({ id: 'q-3', text: 'third' });
  const said = note({ text: 'the gate passed' });
  const recordFile = channel.recordPath(home, SLUG);
  fs.mkdirSync(path.dirname(recordFile), { recursive: true });
  fs.writeFileSync(recordFile, [first, broken, third, said].map((one) => JSON.stringify(one)).join('\n') + '\n', 'utf8');
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual(read.questions, [{ number: 1, notice: first }, { number: 3, notice: third }]);
  assert.deepEqual([read.notices, read.skipped], [[first, third, said], 1]);
}));

test('recordedQuestions says which questions are still open, and what closed the others: the first answer or withdrawal that names them', withHome((home) => {
  const asked = [asking({ id: 'q-1', text: 'one' }), asking({ id: 'q-2', text: 'two' }), asking({ id: 'q-3', text: 'three' }), asking({ id: 'q-4', text: 'four' })];
  const answerTo = (question, text) => note({ kind: 'answer', text, transcript: '1d16beeb', line: 406, question, verified: false, copy: null });
  const firstAnswer = answerTo(1, 'first answer to one');
  const withdrawn = note({ kind: 'withdrawn', question: 2, text: 'he moved on' });
  const written = [...asked, note({ kind: 'answer', text: 'an answer that names no question', transcript: '1d16beeb', line: 9 }), withdrawn, firstAnswer, answerTo(1, 'a second answer to one')];
  for (const one of written) channel.appendNotice(home, SLUG, one);
  assert.deepEqual(channel.recordedQuestions(channel.readNotices(home, SLUG)), [
    { number: 1, notice: asked[0], closed: { by: 'answer', notice: firstAnswer } },
    { number: 2, notice: asked[1], closed: { by: 'withdrawn', notice: withdrawn } },
    { number: 3, notice: asked[2], closed: null },
    { number: 4, notice: asked[3], closed: null },
  ]);
}));

test('an answer no transcript confirmed closes its question only until his answer is read at its line', withHome((home) => {
  const asked = asking({ id: 'q-1', text: 'one' });
  const claimed = note({ kind: 'answer', text: 'he said yes', transcript: 'codex-thread', line: 1, question: 1, verified: false, copy: null });
  const copy = { tool: 'AskUserQuestion', answers: [{ question: 'Pregunta 1: one', options: ['Yes', 'No'], answer: 'No', how: 'tapped' }] };
  const read = note({ kind: 'answer', text: 'he tapped no', transcript: '1d16beeb', line: 406, question: 1, verified: true, copy });
  for (const one of [asked, claimed]) channel.appendNotice(home, SLUG, one);
  assert.deepEqual(channel.recordedQuestions(channel.readNotices(home, SLUG)), [{ number: 1, notice: asked, closed: { by: 'answer', notice: claimed } }]);
  // The answer read at its line is written after the claim, and it is the one the question is closed by.
  channel.appendNotice(home, SLUG, read);
  channel.appendNotice(home, SLUG, note({ kind: 'answer', text: 'a later claim', transcript: 'codex-thread', line: 2, question: 1, verified: false, copy: null }));
  assert.deepEqual(channel.recordedQuestions(channel.readNotices(home, SLUG)), [{ number: 1, notice: asked, closed: { by: 'answer', notice: read } }]);
}));

// --- the readings: which session read which opening ---

test('a reading is a line of its own schema: the time, the session that read and the title of the opening', () => {
  const reading = channel.newReading({ at: AT, reader: FROM, title: '  JH 5 · canal entre sesiones ' });
  assert.deepEqual(reading, { schema: 'js-harness.channel-reading/v1', at: AT, reader: { host: 'claude-code', id: FROM.id, source: 'environment' }, title: 'JH 5 · canal entre sesiones' });
  assert.equal(channel.NOTICE_KINDS.includes('reading'), false, 'it is not a seventh kind of notice');
  // Without the id of a session there is nobody to say it of, and a title is one line.
  for (const [fields, pattern] of [[{ reader: { ...FROM, id: null } }, /session id/], [{ reader: null }, /session id/], [{ title: '' }, /empty/], [{ title: 'two\nlines' }, /one line/], [{ title: 'x'.repeat(121) }, /121 characters/]]) {
    assert.throws(() => channel.newReading({ at: AT, reader: FROM, title: 'JH 5 · x', ...fields }), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), JSON.stringify(fields));
  }
});

test('appendReading adds the reading to the record, and readNotices gives the readings apart from the notices, neither skipped', withHome((home) => {
  const first = note();
  const reading = channel.newReading({ at: AT, reader: FROM, title: 'JH 5 · canal entre sesiones' });
  channel.appendNotice(home, SLUG, first);
  assert.equal(channel.appendReading(home, SLUG, reading), channel.recordPath(home, SLUG));
  const second = note({ kind: 'closed', text: 'delivered' });
  channel.appendNotice(home, SLUG, second);
  assert.deepEqual(channel.readNotices(home, SLUG), { path: channel.recordPath(home, SLUG), notices: [first, second], readings: [reading], questions: [], skipped: 0 });
  // A reading that lost what makes it one is a line the reader does not know, counted as such.
  for (const broken of [{ ...reading, reader: { ...reading.reader, id: 7 } }, { ...reading, title: '' }, { ...reading, at: 'yesterday' }, { ...reading, reader: 'somebody' }]) {
    fs.appendFileSync(channel.recordPath(home, SLUG), `${JSON.stringify(broken)}\n`);
  }
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual([read.notices.length, read.readings.length, read.skipped], [2, 1, 4]);
}));

test('a tail left without its line break does not swallow the notice appended after it', withHome((home) => {
  const file = channel.recordPath(home, SLUG);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"schema":"js-harness.channel-notice/v1","at":', 'utf8');
  channel.appendNotice(home, SLUG, note());
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual([read.notices.length, read.skipped], [1, 1]);
}));

// Two sessions write at the same moment. What the writer relies on: the file is opened for appending and
// each notice is one write of one whole line, a few hundred bytes, which the system puts at the end of
// the file as a whole. What can be tested is that it holds here: several processes that write as fast as
// they can, all of them in the middle of their writes at once, leave nothing but whole lines, every one
// of them, each writer's in order.
//
// That they wrote at once is made, not hoped for (the review of T1: writers started at a set time could
// have run one after another on a loaded machine, and the test would have passed all the same). Two
// barriers, each a file in a folder of the test: no writer appends before \`go\`, which the test creates
// once every writer has said it is ready; and no writer appends its last notice before every writer has
// appended its first. So each writer's last line can only come after every other writer's first line,
// which the record itself then shows.
const WRITER = `
import fs from 'node:fs';
import path from 'node:path';
import { appendNotice, newNotice } from${JSON.stringify(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'channel.mjs')).href)};
// Under \`node -e\` the arguments start at the second place, not the third. A writer that read them one
// place off took another argument for its count and wrote without end: so it checks what it was given.
const [home, slug, writer, count, barrier, writers] = process.argv.slice(1);
const given = path.isAbsolute(home) && path.isAbsolute(barrier) && Number(count) >= 2 && Number(count) <= 1000 && Number(writers) >= 1 && Number(writers) <= 16 && Number(writer) >= 1 && Number(writer) <= Number(writers);
if (!given) throw new Error('writer: bad arguments ' + JSON.stringify(process.argv.slice(1)));
// A wait is a tight loop on purpose, so every writer goes on within the same instant, and it has an end.
const waitFor = (names) => {
  const until = Date.now() + 30000;
  while (!names.every((name) => fs.existsSync(path.join(barrier, name)))) {
    if (Date.now() > until) throw new Error('writer ' + writer + ': waited 30 s for ' + names.join(', '));
  }
};
const append = (i) => appendNotice(home, slug, newNotice({ at: new Date().toISOString(), from: { host: 'unknown', id: null, source: null, title: null, permissionMode: null }, to: writer, kind: 'note', text: String(i) + ' ' + 'x'.repeat(400) }));
fs.writeFileSync(path.join(barrier, 'ready-' + writer), '');
waitFor(['go']);
append(0);
fs.writeFileSync(path.join(barrier, 'started-' + writer), '');
for (let i = 1; i < Number(count) - 1; i++) append(i);
waitFor(Array.from({ length: Number(writers) }, (_, index) => 'started-' + (index + 1)));
append(Number(count) - 1);
`;

test('notices appended by several processes at the same moment are all there, each one whole', { timeout: 60000 }, withHome(async (home) => {
  // Few and short on purpose: each append opens the file twice, and on a machine that runs a gate beside
  // this test 240 of them took 17 s. A hundred show the same thing.
  const writers = 4;
  const each = 25;
  const barrier = path.join(home, 'barrier');
  fs.mkdirSync(barrier);
  const closed = [];
  const exits = Promise.all(
    Array.from({ length: writers }, (_, index) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--input-type=module', '-e', WRITER, home, SLUG, String(index + 1), String(each), barrier, String(writers)], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 45000 });
        let stderr = '';
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('error', reject);
        child.on('close', (code) => {
          closed.push(index + 1);
          resolve({ code, stderr });
        });
      }),
    ),
  );
  // The first barrier: every writer is loaded and waits. A writer that ended before it is a failure the
  // exits below say; the wait is given up then, and after 30 s, so the test never hangs on it.
  const ready = () => Array.from({ length: writers }, (_, index) => `ready-${index + 1}`).every((name) => fs.existsSync(path.join(barrier, name)));
  for (const until = Date.now() + 30000; !ready() && closed.length === 0 && Date.now() < until; ) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(fs.existsSync(channel.recordPath(home, SLUG)), false, 'no writer appends before the barrier is lifted');
  fs.writeFileSync(path.join(barrier, 'go'), '');
  assert.deepEqual(await exits, Array.from({ length: writers }, () => ({ code: 0, stderr: '' })));
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual([read.notices.length, read.skipped], [writers * each, 0]);
  const lineOf = (writer, number) => read.notices.findIndex((one) => one.to.number === writer && Number(one.text.split(' ')[0]) === number);
  for (let writer = 1; writer <= writers; writer++) {
    const sequence = read.notices.filter((one) => one.to.number === writer).map((one) => Number(one.text.split(' ')[0]));
    assert.deepEqual(sequence, Array.from({ length: each }, (_, i) => i), `writer ${writer}`);
    // The proof that they overlapped, read from the record: this writer's last line is after the first
    // line of every writer, so all of them were between their first and their last append at one moment.
    for (let other = 1; other <= writers; other++) {
      assert.ok(lineOf(other, 0) < lineOf(writer, each - 1), `writer ${writer} ended before writer ${other} began: line ${lineOf(writer, each - 1)} against ${lineOf(other, 0)}`);
    }
  }
  assert.equal(fs.readFileSync(channel.recordPath(home, SLUG), 'utf8').endsWith('\n'), true);
}));

// --- the relief file ---

test('a relief line is stamped with the local date and time of the clock, and says the command wrote it', () => {
  const ms = Date.parse('2026-10-11T11:15:42.000Z');
  const local = new Date(ms);
  const two = (number) => String(number).padStart(2, '0');
  // The seconds are written since 2026-10-15: the measure of a compaction compares a line with the notice, which has them.
  const expected = `${local.getFullYear()}-${two(local.getMonth() + 1)}-${two(local.getDate())} ${two(local.getHours())}:${two(local.getMinutes())}:${two(local.getSeconds())} local (notify).`;
  assert.equal(channel.reliefStamp(ms), expected);
  assert.match(channel.reliefStamp(ms), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} local \(notify\)\.$/);
});

test('appendRelief adds one stamped line to the relief file, creating it and its folder, after whatever it holds', withHome((home) => {
  const ms = Date.parse('2026-10-11T11:15:42.000Z');
  const first = channel.appendRelief(home, SLUG, '  JH 5 opened: session channel  ', ms);
  assert.deepEqual(first, { path: channel.reliefPath(home, SLUG), line: `${channel.reliefStamp(ms)} JH 5 opened: session channel` });
  assert.equal(fs.readFileSync(first.path, 'utf8'), `${first.line}\n`);
  // A file somebody wrote by hand, whose last line has no line break: the new line starts on its own.
  fs.writeFileSync(first.path, '2026-10-09 decision (made up): one orchestrator', 'utf8');
  const second = channel.appendRelief(home, SLUG, 'merged pull request 58', ms + 60000);
  assert.deepEqual(fs.readFileSync(first.path, 'utf8').split('\n'), ['2026-10-09 decision (made up): one orchestrator', second.line, '']);
}));

test('a relief line is one line too, of 6000 characters at most, and nothing is written for one that is not', withHome((home) => {
  assert.equal(channel.RELIEF_LINE_MAX, 6000);
  for (const [line, pattern] of [['', /empty/], [' \t ', /empty/], ['two\nlines', /one line/], ['x'.repeat(6001), /6001 characters.*6000 at most/]]) {
    assert.throws(() => channel.appendRelief(home, SLUG, line, 0), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), JSON.stringify(line.slice(0, 20)));
  }
  assert.equal(fs.existsSync(channel.reliefPath(home, SLUG)), false);
  assert.equal(channel.appendRelief(home, SLUG, 'x'.repeat(6000), 0).line.length, channel.reliefStamp(0).length + 1 + 6000);
}));

// --- the openings ---

const TITLE = 'JH 5 · canal entre sesiones';

test('the file of an opening has a name every system takes, whatever the title holds', () => {
  const name = channel.openingFileName(TITLE);
  assert.match(name, /^jh-5-canal-entre-sesiones-[0-9a-f]{12}\.json$/);
  const awkward = ['CON', 'nul', 'a/b\\c:d*e?f"g<h>i|j', 'ends with a dot.', ' ', '···', 'JH 7 · revisión de diseño ñandú', 'x'.repeat(300), 'aux.txt'];
  for (const title of awkward) {
    const made = channel.openingFileName(title);
    assert.match(made, /^([a-z0-9]+-)*[0-9a-f]{12}\.json$/, title);
    assert.ok(made.length <= 80, `${title.slice(0, 20)}: ${made.length}`);
  }
  assert.match(channel.openingFileName('JH 7 · revisión de diseño ñandú'), /^jh-7-revision-de-diseno-nandu-/);
  // Titles that differ only by case, or by an accent, are two openings on a disk that ignores case.
  const names = ['JH 5 · canal', 'JH 5 · Canal', 'JH 5 · canál'].map((title) => channel.openingFileName(title).toLowerCase());
  assert.equal(new Set(names).size, 3);
  // One title is one file however its accents were typed: composed, or a letter and a combining mark.
  assert.equal(channel.openingFileName('JH 7 · revisión'), channel.openingFileName('JH 7 · revisio\u0301n'));
});

test('writeOpening stores the text under the title, and writing the same title again replaces it and says so', withHome((home) => {
  const first = channel.writeOpening(home, SLUG, { title: TITLE, text: 'Sos JH 5.\nLeé odd/tasks/session-channel.md.\n', at: AT, from: FROM });
  assert.deepEqual(first, { path: path.join(channel.openingsDir(home, SLUG), channel.openingFileName(TITLE)), replaced: false });
  assert.deepEqual(JSON.parse(fs.readFileSync(first.path, 'utf8')), { schema: 'js-harness.channel-opening/v1', title: TITLE, at: AT, from: FROM, text: 'Sos JH 5.\nLeé odd/tasks/session-channel.md.\n' });
  const later = '2026-01-01T13:00:00.000Z';
  const second = channel.writeOpening(home, SLUG, { title: `  ${TITLE}  `, text: 'Second text.', at: later, from: FROM });
  assert.deepEqual(second, { path: first.path, replaced: true });
  assert.deepEqual(fs.readdirSync(channel.openingsDir(home, SLUG)), [channel.openingFileName(TITLE)]);
  assert.equal(JSON.parse(fs.readFileSync(first.path, 'utf8')).text, 'Second text.');
}));

test('the text of an opening loses its byte order mark and its carriage returns, and nothing else', withHome((home) => {
  const { path: file } = channel.writeOpening(home, SLUG, { title: TITLE, text: '\uFEFFuno\r\n  dos\r\n', at: AT, from: FROM });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).text, 'uno\n  dos\n');
}));

test('an opening needs a one-line title and a text, of 120 and 100000 characters at most, and nothing is written without them', withHome((home) => {
  assert.deepEqual([channel.OPENING_TITLE_MAX, channel.OPENING_TEXT_MAX], [120, 100000]);
  const write = (fields) => () => channel.writeOpening(home, SLUG, { title: TITLE, text: 'text', at: AT, from: FROM, ...fields });
  const cases = [
    [{ title: '' }, /title.*empty/],
    [{ title: 'two\nlines' }, /title.*one line/],
    [{ title: 'x'.repeat(121) }, /title.*121 characters.*120 at most/],
    [{ text: '' }, /text.*empty/],
    [{ text: ' \r\n\t ' }, /text.*empty/],
    [{ text: 'x'.repeat(100001) }, /text.*100001 characters.*100000 at most/],
  ];
  for (const [fields, pattern] of cases) assert.throws(write(fields), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), JSON.stringify(Object.keys(fields)));
  assert.equal(fs.existsSync(channel.channelDir(home)), false);
}));

test('findOpenings finds an opening by its exact title and by its code and role, the latest first', withHome((home) => {
  const write = (title, at, text = `opening of ${title}`) => channel.writeOpening(home, SLUG, { title, text, at, from: FROM });
  write(TITLE, '2026-01-01T10:00:00.000Z');
  write('JH 5 · canal, segunda vuelta', '2026-01-01T11:00:00.000Z');
  write('JH 6 · reglas', '2026-01-01T09:00:00.000Z');
  write('JH ORQ · js-harness', '2026-01-01T08:00:00.000Z');
  write('XY 5 · otro proyecto', '2026-01-01T12:00:00.000Z');
  write('notas sueltas', '2026-01-01T12:30:00.000Z');
  const titles = (wanted) => channel.findOpenings(home, SLUG, wanted).openings.map((one) => one.title);

  assert.deepEqual(titles(TITLE), [TITLE]);
  assert.deepEqual(titles('JH 5'), ['JH 5 · canal, segunda vuelta', TITLE]);
  assert.deepEqual(titles('JH 6'), ['JH 6 · reglas']);
  assert.deepEqual(titles('JH ORQ'), ['JH ORQ · js-harness']);
  assert.deepEqual(titles('notas sueltas'), ['notas sueltas']);
  assert.deepEqual(titles('  JH 5  '), ['JH 5 · canal, segunda vuelta', TITLE]);
  // Neither half of a title, nor another project's code, nor a title that only starts the same.
  for (const wanted of ['JH 9', 'JH', '5', 'jh 5', 'JH 5 · canal', 'JH 5 ·', 'ZZ ORQ', '']) assert.deepEqual(titles(wanted), [], wanted);

  const [found] = channel.findOpenings(home, SLUG, 'JH 6').openings;
  assert.deepEqual(found, { path: path.join(channel.openingsDir(home, SLUG), channel.openingFileName('JH 6 · reglas')), title: 'JH 6 · reglas', at: '2026-01-01T09:00:00.000Z', from: FROM, text: 'opening of JH 6 · reglas' });
  // Another project's openings are another folder.
  assert.deepEqual(channel.findOpenings(home, 'C--other', 'JH 5'), { dir: channel.openingsDir(home, 'C--other'), openings: [], unreadable: 0 });
}));

test('findOpenings counts a file it cannot read as an opening and goes on, and says when the folder itself cannot be listed', withHome((home) => {
  channel.writeOpening(home, SLUG, { title: TITLE, text: 'text', at: AT, from: FROM });
  const dir = channel.openingsDir(home, SLUG);
  fs.writeFileSync(path.join(dir, 'torn-000000000000.json'), '{"schema":"js-harness.channel-opening/v1","title":"JH 5 · c', 'utf8');
  fs.writeFileSync(path.join(dir, 'foreign-000000000000.json'), JSON.stringify({ title: 'JH 5 · no schema', text: 'x' }), 'utf8');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'not an opening, and not counted', 'utf8');
  const found = channel.findOpenings(home, SLUG, 'JH 5');
  assert.deepEqual([found.openings.map((one) => one.title), found.unreadable], [[TITLE], 2]);

  const readdir = () => {
    throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
  };
  assert.deepEqual(channel.findOpenings(home, SLUG, 'JH 5', { readdir }), { dir, openings: [], unreadable: 0, unavailable: 'EPERM' });
}));

// --- the next free number of a work session (odd/tasks/session-title.md, S2) ---

test('nextSessionNumber is one past the highest number of the code the project declares, in the record and in the openings', withHome((home) => {
  const from = (title) => ({ ...FROM, title });
  channel.appendNotice(home, SLUG, note({ from: from('JH ORQ · js-harness') }));
  channel.appendNotice(home, SLUG, note({ from: from('JH 21 · reserva de la noche') }));
  channel.appendNotice(home, SLUG, note({ from: from('JH 7 · registro de fallas') }));
  channel.appendNotice(home, SLUG, note({ from: from('js-harness wake') }));
  channel.appendNotice(home, SLUG, note({ from: from(null) }));
  // Another code is another numbering: only the code asked for counts, however many titles carry another.
  channel.appendNotice(home, SLUG, note({ from: from('XY 90 · otro') }));
  channel.appendNotice(home, SLUG, note({ from: from('XY 91 · otro') }));
  channel.appendNotice(home, SLUG, note({ from: from('XY 92 · otro') }));
  channel.appendReading(home, SLUG, channel.newReading({ at: AT, reader: { id: 'bbbbbbbb-2222' }, title: 'JH 24 · gate más rápido' }));
  channel.writeOpening(home, SLUG, { title: 'JH 29 · memory', text: 'opening', at: AT, from: FROM });
  channel.writeOpening(home, SLUG, { title: 'Install module for required third-party tools', text: 'opening', at: AT, from: FROM });
  assert.deepEqual(channel.nextSessionNumber(home, SLUG, { code: 'JH' }), { code: 'JH', number: 30 });
  assert.deepEqual(channel.nextSessionNumber(home, SLUG, { code: 'XY' }), { code: 'XY', number: 93 });

  // A notice addressed to a work number holds that number too: the session it names may not have written yet.
  channel.appendNotice(home, SLUG, note({ to: '32' }));
  assert.deepEqual(channel.nextSessionNumber(home, SLUG, { code: 'JH' }), { code: 'JH', number: 33 });
  assert.deepEqual(channel.nextSessionNumber(home, 'C--other', { code: 'JH' }), { code: 'JH', number: 1 });
  // A caller that names no code would get a number counted from the notices alone: it is refused (gentle-ai, R3).
  assert.throws(() => channel.nextSessionNumber(home, SLUG), /needs the project's code/);
  assert.throws(() => channel.nextSessionNumber(home, SLUG, { code: '' }), /needs the project's code/);

  // A line from another version with a number that is not whole counts for nothing and breaks nothing; it is not a
  // notice of this version, so the record is said to hold a line it could not read.
  fs.appendFileSync(channel.recordPath(home, SLUG), `${JSON.stringify({ ...note(), to: { role: 'work', number: 'x' } })}\n`, 'utf8');
  assert.deepEqual(channel.nextSessionNumber(home, SLUG, { code: 'JH' }), { code: 'JH', number: 33, unavailable: [`record ${channel.recordPath(home, SLUG)} (1 line not readable as a notice or a reading)`] });
}));

test('nextSessionNumber says which source it could not read, so a guess is not taken for the number', withHome((home) => {
  channel.appendNotice(home, SLUG, note());
  const readdir = () => {
    throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
  };
  assert.deepEqual(channel.nextSessionNumber(home, SLUG, { code: 'JH', readdir }), { code: 'JH', number: 6, unavailable: [`openings ${channel.openingsDir(home, SLUG)} (EPERM)`] });
  // An opening that is listed and cannot be read may hold the highest number: it is said, not dropped (Codex, P2).
  const dir = channel.openingsDir(home, SLUG);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'torn-000000000000.json'), '{"schema":"js-harness.channel-opening/v1","title":"JH 32 · t', 'utf8');
  assert.deepEqual(channel.nextSessionNumber(home, SLUG, { code: 'JH' }), { code: 'JH', number: 6, unavailable: [`openings ${dir} (1 file not readable as an opening)`] });
  fs.rmSync(path.join(dir, 'torn-000000000000.json'));
  // A torn line of the record may hold the highest number too: it is said, not dropped (Codex, P2).
  fs.appendFileSync(channel.recordPath(home, SLUG), '{"schema":"js-harness.channel-notice/v1","from":{"title":"JH 32 · t\n', 'utf8');
  assert.deepEqual(channel.nextSessionNumber(home, SLUG, { code: 'JH' }), { code: 'JH', number: 6, unavailable: [`record ${channel.recordPath(home, SLUG)} (1 line not readable as a notice or a reading)`] });
}));

// --- where a notice is run from ---

const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
const notARepository = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' });

test('placeOf reads the worktree and the branch of the folder from git, in two calls', () => {
  const calls = [];
  const run = (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    return args[0] === 'rev-parse' ? ok('C:/proj-worktrees/channel\n') : ok('feat/session-record\n');
  };
  assert.deepEqual(channel.placeOf(run, 'C:\\proj-worktrees\\channel\\bin'), { worktree: path.resolve('C:/proj-worktrees/channel'), branch: 'feat/session-record' });
  assert.deepEqual(calls, [
    { command: 'git', args: ['rev-parse', '--show-toplevel'], cwd: 'C:\\proj-worktrees\\channel\\bin' },
    { command: 'git', args: ['branch', '--show-current'], cwd: 'C:\\proj-worktrees\\channel\\bin' },
  ]);
});

test('placeOf gives null for what git does not say, and never throws', () => {
  assert.deepEqual(channel.placeOf(notARepository, 'C:\\tmp'), { worktree: null, branch: null });
  // A detached HEAD is a worktree with no branch.
  assert.deepEqual(channel.placeOf((command, args) => (args[0] === 'rev-parse' ? ok('C:/proj\n') : ok('\n')), 'C:\\proj'), { worktree: path.resolve('C:/proj'), branch: null });
  assert.deepEqual(channel.placeOf(() => ({ error: Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' }) }), 'C:\\proj'), { worktree: null, branch: null });
  const thrower = () => {
    throw new Error('made up');
  };
  assert.deepEqual(channel.placeOf(thrower, 'C:\\proj'), { worktree: null, branch: null });
});

// --- who sends ---

const SESSION = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER = 'aaaaaaaa-2222-4222-8222-222222222222';
const transcript = (...entries) => entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
const titled = (title, permissionMode = 'bypassPermissions') =>
  transcript({ type: 'custom-title', customTitle: title }, { type: 'user', timestamp: AT, permissionMode, origin: { kind: 'human' }, message: { role: 'user', content: 'made up' } });

/** A sessions folder of a project as `senderOf` reads it: `files` is `{ <name>: <text> }`. */
const folder = (files) => ({
  projectDir: 'C:\\claude\\projects\\C--proj',
  readdir: () => Object.keys(files),
  readFile: (file) => files[path.basename(file)],
});

test('the sender is the session the host names in the environment, with the title and permission mode its transcript gives', () => {
  const where = folder({ [`${SESSION}.jsonl`]: titled('JH 5 · canal entre sesiones', 'auto'), [`${OTHER}.jsonl`]: titled('JH ORQ · js-harness') });
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...where }), { host: 'claude-code', id: SESSION, source: 'environment', title: 'JH 5 · canal entre sesiones', permissionMode: 'auto', context: null });
});

test('the sender carries the share of its context its transcript gives: the tokens of its last reply with usage and the whole percentage of the window', () => {
  const reply = { type: 'assistant', timestamp: AT, isSidechain: false, message: { role: 'assistant', model: 'made-up-model', stop_reason: 'end_turn', content: [{ type: 'text', text: 'made up' }], usage: { input_tokens: 150000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 0, output_tokens: 300 } } };
  const withUsage = transcript({ type: 'custom-title', customTitle: 'JH 5 · canal entre sesiones' }, { type: 'user', timestamp: AT, permissionMode: 'auto', origin: { kind: 'human' }, message: { role: 'user', content: 'made up' } }, reply);
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...folder({ [`${SESSION}.jsonl`]: withUsage }) }), { host: 'claude-code', id: SESSION, source: 'environment', title: 'JH 5 · canal entre sesiones', permissionMode: 'auto', context: { tokens: 200000, percent: 40 } });
});

test('--self names the sender instead, by its id or the start of it, and the record says the id came from the flag', () => {
  const where = folder({ [`${SESSION}.jsonl`]: titled('JH 5 · canal entre sesiones'), 'bbbbbbbb-2222-4222-8222-222222222222.jsonl': titled('JH ORQ · js-harness') });
  const whole = channel.senderOf({ self: SESSION, env: { CLAUDE_CODE_SESSION_ID: 'bbbbbbbb-2222-4222-8222-222222222222' }, ...where });
  assert.deepEqual(whole, { host: 'claude-code', id: SESSION, source: 'flag', title: 'JH 5 · canal entre sesiones', permissionMode: 'bypassPermissions', context: null });
  assert.deepEqual(channel.senderOf({ self: 'aaaaaaaa', env: {}, ...where }), whole, 'the start of an id is completed from the transcript it names');
});

test('a sender with no transcript to read keeps its id and has no title; a start that names two transcripts names neither', () => {
  const none = { title: null, permissionMode: null, context: null };
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...folder({}) }), { host: 'claude-code', id: SESSION, source: 'environment', ...none });
  // An id typed with --self that no transcript carries is only a claim: no host is named for it.
  assert.deepEqual(channel.senderOf({ self: 'cccccccc', env: {}, ...folder({}) }), { host: 'unknown', id: 'cccccccc', source: 'flag', ...none });
  const two = folder({ [`${SESSION}.jsonl`]: titled('one'), [`${OTHER}.jsonl`]: titled('two') });
  assert.deepEqual(channel.senderOf({ self: 'aaaaaaaa', env: {}, ...two }), { host: 'unknown', id: 'aaaaaaaa', source: 'flag', ...none });
  const missing = { projectDir: 'C:\\nowhere', readdir: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); }, readFile: () => '' };
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...missing }), { host: 'claude-code', id: SESSION, source: 'environment', ...none });
  const unreadable = { ...folder({ [`${SESSION}.jsonl`]: '' }), readFile: () => { throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' }); } };
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...unreadable }), { host: 'claude-code', id: SESSION, source: 'environment', ...none });
});

test('the sender\'s transcript is read from whichever of the project\'s sessions folders holds it, a worktree\'s included', () => {
  // A session opened in a worktree is filed under that worktree's folder, not the main checkout's.
  const main = 'C:\\claude\\projects\\C--proj';
  const worktree = 'C:\\claude\\projects\\C--proj--claude-worktrees-x';
  const files = { [path.join(worktree, `${SESSION}.jsonl`)]: titled('JH 30 · onboarding', 'auto'), [path.join(main, `${OTHER}.jsonl`)]: titled('JH ORQ · js-harness') };
  const readdir = (dir) => {
    const names = Object.keys(files).filter((file) => path.dirname(file) === dir).map((file) => path.basename(file));
    if (names.length === 0) throw Object.assign(new Error(`ENOENT: ${dir}`), { code: 'ENOENT' });
    return names;
  };
  const readFile = (file) => files[file];
  const where = { projectDirs: [main, worktree, 'C:\\claude\\projects\\C--gone'], readdir, readFile };
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...where }), { host: 'claude-code', id: SESSION, source: 'environment', title: 'JH 30 · onboarding', permissionMode: 'auto', context: null });
  assert.deepEqual(channel.senderOf({ self: 'aaaaaaaa', env: {}, ...where }).title, null, 'a start that names a transcript in each of two folders names neither');
});

test('only a title the session was given is one: the start of its first prompt names nobody', () => {
  const untitled = transcript({ type: 'user', timestamp: AT, permissionMode: 'auto', origin: { kind: 'human' }, message: { role: 'user', content: 'build the channel' } });
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...folder({ [`${SESSION}.jsonl`]: untitled }) }), { host: 'claude-code', id: SESSION, source: 'environment', title: null, permissionMode: 'auto', context: null });
});

test('with no id from the host and none given the sender is not known, and the host is not guessed', () => {
  const unknown = { host: 'unknown', id: null, source: null, title: null, permissionMode: null, context: null };
  const neverRead = { projectDir: 'C:\\nowhere', readdir: () => assert.fail('nothing to look for'), readFile: () => assert.fail('nothing to read') };
  assert.deepEqual(channel.senderOf({ env: {}, ...neverRead }), unknown);
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: '' }, ...neverRead }), unknown);
  // No variable with Codex in its name is known to hold a session id, so none is read as one.
  assert.deepEqual(channel.senderOf({ env: { CODEX_HOME: 'C:\\codex', CODEX_SANDBOX_NETWORK_DISABLED: '1' }, ...neverRead }), unknown);
});
