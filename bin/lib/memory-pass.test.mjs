import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractQuotes, PassError, planPass, undoPass, verifyPass } from './memory-pass.mjs';
import { readJournal } from './memory-hygiene.mjs';

const NOW = Date.parse('2026-10-15T09:00:00Z');
const note = (type, body) => `---\nname: x\ndescription: "a description in quotes, not his words"\nmetadata:\n  type: ${type}\n---\n\n${body}\n`;

function withPass(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-pass-'));
  const folder = path.join(root, 'memory');
  const stateDir = path.join(root, 'state');
  fs.mkdirSync(folder);
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(folder, name), text, 'utf8');
  const read = (name) => fs.readFileSync(path.join(folder, name), 'utf8');
  const write = (name, text) => fs.writeFileSync(path.join(folder, name), text, 'utf8');
  try {
    return fn({ folder, stateDir, read, write });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('extractQuotes takes his words in quotes and leaves front matter, code spans, fences and short labels', () => {
  const text = note('feedback', [
    'His words: "nunca dejes una nota sin su línea" (2026-10-15).',
    'A label "Sí" is too short, and `"json": "not his words at all"` is code.',
    '```',
    'echo "a fenced command line here"',
    '```',
    'Wrapped: "una frase que sigue',
    'en la línea de abajo".',
  ].join('\n'));
  assert.deepEqual(extractQuotes(text), ['nunca dejes una nota sin su línea', 'una frase que sigue en la línea de abajo']);
});

test('a pass that shortens an index line, keeping its detail in the note, verifies, and undo restores both byte for byte', () => {
  const index = '- [Rule](rule.md) — pause at 88 percent, `context-pause`, and much more text\n';
  const rule = note('feedback', 'Pause. His words: "a los 88 pausá y escribí el estado".');
  withPass({ 'MEMORY.md': index, 'rule.md': rule }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md', 'rule.md'], now: NOW });
    write('MEMORY.md', '- [Rule](rule.md) — pause, `context-pause`\n');
    write('rule.md', `${rule}Detail moved from the index: pause at 88 percent, and much more text.\n`);
    const result = verifyPass({ folder, stateDir, stamp, homes: '', now: NOW + 1000 });
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
    const verified = readJournal(path.join(stateDir, 'journal.jsonl')).filter((e) => e.kind === 'verify');
    assert.equal(verified.length, 1);
    assert.deepEqual(verified[0].notes, ['rule.md']);
    assert.equal(verified[0].indexBytes, Buffer.byteLength('- [Rule](rule.md) — pause, `context-pause`\n'));

    const undone = undoPass({ folder, stateDir, stamp, now: NOW + 2000 });
    assert.deepEqual(undone.refused, []);
    assert.equal(read('MEMORY.md'), index);
    assert.equal(read('rule.md'), rule);
  });
});

test('verify refuses an index line whose number or name went nowhere', () => {
  withPass({ 'MEMORY.md': '- [Rule](rule.md) — pause at 88 percent\n', 'rule.md': note('feedback', 'Pause.') }, ({ folder, stateDir, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [Rule](rule.md) — pause\n');
    const result = verifyPass({ folder, stateDir, stamp, homes: '', now: NOW });
    assert.equal(result.ok, false);
    assert.deepEqual(result.problems, ['MEMORY.md line for rule.md lost "88" (in neither the new line nor the note)']);
  });
});

test('verify refuses a quotation of his that is in no note and no home, and passes once a home holds it', () => {
  const words = 'esto es lo que él dijo y no se pierde';
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n- [B](b.md) — b\n', 'a.md': note('feedback', `"${words}"`), 'b.md': note('user', 'fact') }, ({ folder, stateDir, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md', 'a.md'], now: NOW });
    fs.rmSync(path.join(folder, 'a.md'));
    write('MEMORY.md', '- [B](b.md) — b\n');
    const lost = verifyPass({ folder, stateDir, stamp, homes: '', approved: ['a.md'], now: NOW });
    assert.deepEqual(lost.problems, [`a.md: his words "${words}" are in no note and no home`]);
    const kept = verifyPass({ folder, stateDir, stamp, homes: `{"quote": "${words}"}`, approved: ['a.md'], now: NOW });
    assert.deepEqual(kept.problems, []);
  });
});

test('verify refuses an index line that drops a quotation of his, unless the note or a home holds it', () => {
  const index = '- [Date](date.md) — fixes first ("reloj suizo, primero lo que funciona")\n';
  withPass({ 'MEMORY.md': index, 'date.md': note('feedback', 'Fixes before the date.') }, ({ folder, stateDir, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [Date](date.md) — fixes first\n');
    assert.deepEqual(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }).problems, [
      'MEMORY.md: his words "reloj suizo, primero lo que funciona" are in no note and no home',
    ]);
    assert.equal(verifyPass({ folder, stateDir, stamp, homes: 'reloj suizo, primero lo que funciona', now: NOW }).ok, true);
  });
});

test('verify refuses a note deleted without his approval, even when its words reached a home', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('feedback', '"una regla que él dio hoy mismo"') }, ({ folder, stateDir, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md', 'a.md'], now: NOW });
    fs.rmSync(path.join(folder, 'a.md'));
    write('MEMORY.md', '');
    const result = verifyPass({ folder, stateDir, stamp, homes: 'una regla que él dio hoy mismo', now: NOW });
    assert.deepEqual(result.problems, ['a.md was deleted without his approval (--approved a.md)']);
  });
});

test('verify names a file outside the write set that changed during the pass and leaves it alone', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n- [B](b.md) — b\n', 'a.md': note('user', 'a'), 'b.md': note('user', 'b') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW });
    write('b.md', note('user', 'another session wrote this'));
    const result = verifyPass({ folder, stateDir, stamp, homes: '', now: NOW });
    assert.deepEqual(result.problems, ['b.md changed outside the write set during the pass (another session wrote it?)']);
    assert.match(read('b.md'), /another session wrote this/);
  });
});

test('verify refuses while a reason the pass owns still holds, such as an orphan note', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a'), 'b.md': note('user', 'b') }, ({ folder, stateDir }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    const result = verifyPass({ folder, stateDir, stamp, homes: '', now: NOW });
    assert.deepEqual(result.problems, ['still due: orphan b.md']);
  });
});

test('a second plan is refused while a pass holds the lock, and allowed after verify releases it', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW });
    assert.throws(() => planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW + 1 }), (err) => err instanceof PassError && /a pass holds the lock: /.test(err.message));
    assert.equal(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW + 2 }).ok, true);
    assert.ok(planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW + 3 }).stamp);
  });
});

test('plan refuses a write-set name that leaves the memory folder', () => {
  withPass({ 'MEMORY.md': '' }, ({ folder, stateDir }) => {
    for (const name of ['../x.md', 'sub/x.md', 'x.txt']) {
      assert.throws(() => planPass({ folder, stateDir, writeSet: [name], now: NOW }), PassError, name);
    }
  });
});

test('undo keeps a note another session wrote after the pass, by name, and merges the index line by line', () => {
  const index = '- [A](a.md) — a long line about a\n';
  withPass({ 'MEMORY.md': index, 'a.md': note('user', 'a') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md', 'a.md', 'new.md'], now: NOW });
    write('MEMORY.md', '- [A](a.md) — a long line\n- [New](new.md) — n\n');
    write('a.md', note('user', 'a, about a'));
    write('new.md', note('user', 'n'));
    assert.equal(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }).ok, true);
    // After the pass: another session edits a.md and adds its own line to the index.
    write('a.md', note('user', 'edited later by another session'));
    write('MEMORY.md', `${read('MEMORY.md')}- [Later](later.md) — l\n`);
    write('later.md', note('user', 'l'));

    const undone = undoPass({ folder, stateDir, stamp, now: NOW });
    assert.deepEqual(undone.refused, ['a.md (written since the pass)']);
    assert.deepEqual(undone.removed, ['new.md']);
    assert.equal(read('a.md'), note('user', 'edited later by another session'));
    assert.equal(read('MEMORY.md'), `${index}- [Later](later.md) — l\n`);
    assert.ok(fs.existsSync(path.join(folder, 'later.md')));
  });
});

test('undo puts back a note the pass deleted', () => {
  const a = note('user', '"palabras suyas que vuelven intactas"');
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': a }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md', 'a.md'], now: NOW });
    fs.rmSync(path.join(folder, 'a.md'));
    write('MEMORY.md', '');
    verifyPass({ folder, stateDir, stamp, homes: 'palabras suyas que vuelven intactas', approved: ['a.md'], now: NOW });
    const undone = undoPass({ folder, stateDir, stamp, now: NOW });
    assert.deepEqual(undone.restored.sort(), ['MEMORY.md', 'a.md']);
    assert.equal(read('a.md'), a);
  });
});

test('undo before any verify is refused, since the after-state is not recorded', () => {
  withPass({ 'MEMORY.md': '', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW });
    assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), /run memory verify .+ first/);
  });
});

test('a refused verify still records the after-state, so undo works on a failed pass', () => {
  const a = note('user', 'a');
  withPass({ 'MEMORY.md': '- [A](a.md) — a 7\n', 'a.md': a }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [A](a.md) — a\n');
    assert.equal(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }).ok, false);
    undoPass({ folder, stateDir, stamp, now: NOW });
    assert.equal(read('MEMORY.md'), '- [A](a.md) — a 7\n');
    assert.ok(planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW + 1 }).stamp, 'undo releases the lock');
  });
});

test('only the ten newest snapshots are kept', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    for (let i = 0; i < 12; i++) {
      const { stamp } = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW + i * 1000 });
      verifyPass({ folder, stateDir, stamp, homes: '', now: NOW + i * 1000 + 1 });
    }
    assert.equal(fs.readdirSync(path.join(stateDir, 'snapshots')).length, 10);
  });
});
