import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dueNotice, hygieneDir, hygieneState, INDEX_BYTES, LINE_CHARS, PASS_DAYS, purgeMarker, readJournal, readMemory } from './memory-hygiene.mjs';
import { RULES } from './rules-data.mjs';
import { ruleValue } from './rules.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-15T08:00:00Z');

function withFolder(files, fn) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-memory-'));
  try {
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(folder, name), text, 'utf8');
    return fn(folder);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

const note = (type, body = 'body') => `---\nname: x\ndescription: y\nmetadata:\n  type: ${type}\n---\n\n${body}\n`;
const line = (name) => `- [${name}](${name}.md) — hook`;
const ids = (list) => list.map((item) => item.id);

test('readMemory reads the index lines, their links and length in code points, and each note with its type', () => {
  withFolder({ 'MEMORY.md': `${line('a')}\n- [Ñandú](b.md) — ${'é'.repeat(10)}\n`, 'a.md': note('feedback'), 'b.md': note('user') }, (folder) => {
    const memory = readMemory(folder);
    assert.equal(memory.index.bytes, Buffer.byteLength(fs.readFileSync(path.join(folder, 'MEMORY.md'))));
    assert.deepEqual(memory.index.lines.map((l) => [l.number, l.link]), [[1, 'a.md'], [2, 'b.md']]);
    assert.equal(memory.index.lines[1].chars, [...'- [Ñandú](b.md) — '].length + 10);
    assert.deepEqual(memory.notes.map((n) => [n.name, n.type]), [['a.md', 'feedback'], ['b.md', 'user']]);
  });
});

test('a folder within every budget, with a recent pass and no new rule note, is not due', () => {
  withFolder({ 'MEMORY.md': `${line('a')}\n`, 'a.md': note('feedback') }, (folder) => {
    const memory = readMemory(folder);
    const journal = [{ kind: 'verify', at: new Date(NOW - DAY).toISOString(), notes: ['a.md'] }];
    const state = hygieneState({ memory, journal, now: NOW });
    assert.equal(state.due, false);
    assert.deepEqual(state.reasons, []);
  });
});

test('with no pass recorded the folder is due once, for that reason alone', () => {
  withFolder({ 'MEMORY.md': `${line('a')}\n`, 'a.md': note('user') }, (folder) => {
    const state = hygieneState({ memory: readMemory(folder), journal: [], now: NOW });
    assert.equal(state.due, true);
    assert.deepEqual(ids(state.reasons), ['no-pass']);
  });
});

test('an index over its byte budget and lines over the host length are due, naming the lines', () => {
  const long = `- [a](a.md) — ${'x'.repeat(LINE_CHARS)}`;
  const filler = Array.from({ length: Math.ceil(INDEX_BYTES / 100) }, () => `<!-- ${'y'.repeat(92)} -->`).join('\n');
  withFolder({ 'MEMORY.md': `${long}\n${filler}\n`, 'a.md': note('user') }, (folder) => {
    const journal = [{ kind: 'verify', at: new Date(NOW - DAY).toISOString(), notes: ['a.md'] }];
    const state = hygieneState({ memory: readMemory(folder), journal, now: NOW });
    assert.deepEqual(ids(state.reasons), ['index-bytes', 'line-chars']);
    assert.match(state.reasons[1].detail, /^1 line over 150 characters: 1$/);
  });
});

test('a link to no file and a note with no line are due', () => {
  withFolder({ 'MEMORY.md': `${line('gone')}\n`, 'here.md': note('user') }, (folder) => {
    const journal = [{ kind: 'verify', at: new Date(NOW - DAY).toISOString(), notes: ['here.md'] }];
    const state = hygieneState({ memory: readMemory(folder), journal, now: NOW });
    assert.deepEqual(state.reasons, [
      { id: 'broken-link', detail: 'gone.md (line 1)' },
      { id: 'orphan', detail: 'here.md' },
    ]);
  });
});

test('a rule note written after the last pass is due as a rule waiting for its home; a new user note is not', () => {
  withFolder({ 'MEMORY.md': `${line('old')}\n${line('rule')}\n${line('fact')}\n`, 'old.md': note('feedback'), 'rule.md': note('project'), 'fact.md': note('reference') }, (folder) => {
    const journal = [{ kind: 'verify', at: new Date(NOW - DAY).toISOString(), notes: ['old.md'] }];
    const state = hygieneState({ memory: readMemory(folder), journal, now: NOW });
    assert.deepEqual(state.reasons, [{ id: 'new-rule-note', detail: 'rule.md (project)' }]);
  });
});

test('the cadence is due seven days after the last pass only when a note was written since', () => {
  withFolder({ 'MEMORY.md': `${line('a')}\n`, 'a.md': note('user') }, (folder) => {
    const at = NOW - 8 * DAY;
    const journal = [{ kind: 'verify', at: new Date(at).toISOString(), notes: ['a.md'] }];
    fs.utimesSync(path.join(folder, 'a.md'), new Date(at - DAY), new Date(at - DAY));
    fs.utimesSync(path.join(folder, 'MEMORY.md'), new Date(at - DAY), new Date(at - DAY));
    assert.equal(hygieneState({ memory: readMemory(folder), journal, now: NOW }).due, false);
    fs.utimesSync(path.join(folder, 'a.md'), new Date(at + DAY), new Date(at + DAY));
    assert.deepEqual(ids(hygieneState({ memory: readMemory(folder), journal, now: NOW }).reasons), ['cadence']);
    assert.equal(hygieneState({ memory: readMemory(folder), journal, now: at + 6 * DAY }).due, false);
  });
});

test('the last verified pass counts, not a plan that was never verified', () => {
  withFolder({ 'MEMORY.md': `${line('a')}\n`, 'a.md': note('user') }, (folder) => {
    const journal = [{ kind: 'plan', at: new Date(NOW - DAY).toISOString(), notes: ['a.md'] }];
    assert.deepEqual(ids(hygieneState({ memory: readMemory(folder), journal, now: NOW }).reasons), ['no-pass']);
  });
});

test('a long note and a citation that resolves to nothing are candidates, never reasons to be due', () => {
  const body = `${'z'.repeat(3100)}\nSee \`bin/gone.mjs:3\` and \`bin/here.mjs:2\`.`;
  withFolder({ 'MEMORY.md': `${line('big')}\n`, 'big.md': note('user', body) }, (folder) => {
    const journal = [{ kind: 'verify', at: new Date(NOW - DAY).toISOString(), notes: ['big.md'] }];
    const lineCount = (file) => (file === 'bin/here.mjs' ? 5 : null);
    const state = hygieneState({ memory: readMemory(folder), journal, now: NOW, lineCount, commitExists: () => true });
    assert.equal(state.due, false);
    assert.deepEqual(state.candidates.map((c) => [c.id, c.detail.split(' ')[0]]), [['note-bytes', 'big.md'], ['stale-citation', 'big.md']]);
    assert.match(state.candidates[1].detail, /bin\/gone\.mjs:3 \(no such file\)/);
  });
});

test('dueNotice says a due pass at most once a day, says nothing when none is due or there is no folder', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-due-'));
  try {
    const folder = path.join(home, '.claude', 'projects', 'p', 'memory');
    assert.equal(dueNotice({ home, slug: 'p', folder, now: NOW }), null, 'no folder');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'MEMORY.md'), `${line('a')}\n`);
    fs.writeFileSync(path.join(folder, 'a.md'), note('user'));
    assert.match(dueNotice({ home, slug: 'p', folder, now: NOW }), /^js-harness: a memory hygiene pass is due for this project \(no-pass\)/);
    assert.equal(dueNotice({ home, slug: 'p', folder, now: NOW + DAY - 1 }), null, 'told within the day');
    assert.match(dueNotice({ home, slug: 'p', folder, now: NOW + DAY }), /is due/, 'told again the next day');
    fs.appendFileSync(path.join(home, '.js-harness', 'memory-hygiene', 'p', 'journal.jsonl'), `${JSON.stringify({ kind: 'verify', at: new Date(NOW + DAY).toISOString(), notes: ['a.md'] })}\n`);
    fs.utimesSync(path.join(folder, 'a.md'), new Date(NOW), new Date(NOW));
    fs.utimesSync(path.join(folder, 'MEMORY.md'), new Date(NOW), new Date(NOW));
    assert.equal(dueNotice({ home, slug: 'p', folder, now: NOW + 3 * DAY }), null, 'nothing due after a verified pass');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T10 (D7.5): while an uninstall holds its marker, the hook writes nothing into the folder it removes.
test('dueNotice writes no stamp while an uninstall holds the marker beside the folder of memory hygiene', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-due-'));
  try {
    const folder = path.join(home, '.claude', 'projects', 'p', 'memory');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'MEMORY.md'), `${line('a')}\n`);
    fs.writeFileSync(path.join(folder, 'a.md'), note('user'));
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    const marker = purgeMarker(hygieneDir(home));
    fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: new Date(NOW).toISOString() }));
    assert.equal(dueNotice({ home, slug: 'p', folder, now: NOW }), null);
    assert.equal(fs.existsSync(hygieneDir(home)), false, 'not even the folder');
    fs.rmSync(marker);
    assert.match(dueNotice({ home, slug: 'p', folder, now: NOW }), /is due/, 'and says it once the marker is gone');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('readJournal reads JSON lines and skips a line that does not parse', () => {
  withFolder({ 'journal.jsonl': '{"kind":"verify","at":"2026-10-14T00:00:00Z","notes":[]}\nnot json\n' }, (folder) => {
    assert.deepEqual(readJournal(path.join(folder, 'journal.jsonl')), [{ kind: 'verify', at: '2026-10-14T00:00:00Z', notes: [] }]);
    assert.deepEqual(readJournal(path.join(folder, 'none.jsonl')), []);
  });
});

test('an index link written as ./note.md matches the note', () => {
  withFolder({ 'MEMORY.md': '- [A](./a.md) — a\n', 'a.md': note('user') }, (folder) => {
    const journal = [{ kind: 'verify', at: new Date(NOW - DAY).toISOString(), notes: ['a.md'] }];
    assert.deepEqual(hygieneState({ memory: readMemory(folder), journal, now: NOW }).reasons, []);
  });
});

test('the budgets are the rules memory-index-bytes and memory-pass-days, read from the list it is given', () => {
  const tight = RULES.map((rule) => {
    if (rule.id === 'memory-index-bytes') return { ...rule, value: 10 };
    if (rule.id === 'memory-pass-days') return { ...rule, value: 2 };
    return rule;
  });
  withFolder({ 'MEMORY.md': `${line('a')}\n`, 'a.md': note('user') }, (folder) => {
    const at = NOW - 3 * DAY;
    const journal = [{ kind: 'verify', at: new Date(at).toISOString(), notes: ['a.md'] }];
    fs.utimesSync(path.join(folder, 'a.md'), new Date(at + DAY), new Date(at + DAY));
    fs.utimesSync(path.join(folder, 'MEMORY.md'), new Date(at - DAY), new Date(at - DAY));
    assert.deepEqual(ids(hygieneState({ memory: readMemory(folder), journal, now: NOW }).reasons), [], 'the declared rules: 4000 B, 7 days');
    assert.deepEqual(ids(hygieneState({ memory: readMemory(folder), journal, now: NOW, rules: tight }).reasons), ['index-bytes', 'cadence']);
    const without = RULES.filter((rule) => rule.id !== 'memory-pass-days');
    assert.throws(() => hygieneState({ memory: readMemory(folder), journal, now: NOW, rules: without }), /memory-pass-days/);
  });
});

test('the exported budgets are the declared rules', () => {
  assert.deepEqual([INDEX_BYTES, PASS_DAYS], [ruleValue('memory-index-bytes', 'bytes'), ruleValue('memory-pass-days', 'days')]);
});
