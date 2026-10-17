import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractQuotes, lockLine, PassError, planPass, readLock, undoPass, verifyPass } from './memory-pass.mjs';
import { purgeMarker, readJournal } from './memory-hygiene.mjs';

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
    assert.throws(() => planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW + 1 }), (err) => err instanceof PassError && err.message.includes(stamp) && /memory verify or memory undo/.test(err.message));
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

// Codex's findings on 5397771..3fbfb31.
test('a second verify of a pass already verified is refused and leaves its after-state as it was', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW });
    assert.equal(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }).ok, true);
    write('a.md', note('user', 'written later by another session'));
    assert.throws(() => verifyPass({ folder, stateDir, stamp, homes: '', now: NOW + 1 }), /already verified/);
  });
});

test('undo keeps an index line another session removed after the pass removed, and a line it kept', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a old\n- [B](b.md) — b\n', 'a.md': note('user', 'a old'), 'b.md': note('user', 'b') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [A](a.md) — a\n- [B](b.md) — b\n');
    assert.equal(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }).ok, true);
    write('MEMORY.md', '- [A](a.md) — a\n');
    undoPass({ folder, stateDir, stamp, now: NOW });
    assert.equal(read('MEMORY.md'), '- [A](a.md) — a old\n', 'the pass\'s change is undone, the other session\'s removal of B stays');
  });
});

test('a number kept only inside a longer number counts as lost', () => {
  withPass({ 'MEMORY.md': '- [R](r.md) — pause at 88\n', 'r.md': note('user', 'since 1880') }, ({ folder, stateDir, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [R](r.md) — pause\n');
    assert.match(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }).problems.join('\n'), /lost "88"/);
  });
});

test('verify of a pass that no longer holds the lock is refused and leaves its after-state as it was', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n- [B](b.md) — b\n', 'a.md': note('user', 'a'), 'b.md': note('user', 'b') }, ({ folder, stateDir, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW });
    write('b.md', note('user', 'b written outside the write set'));
    assert.equal(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }).ok, false);
    write('b.md', note('user', 'b'));
    undoPass({ folder, stateDir, stamp, now: NOW });
    const afterFile = path.join(stateDir, 'snapshots', stamp, 'after.json');
    const recorded = fs.readFileSync(afterFile, 'utf8');
    planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW + 60_000 });
    write('a.md', note('user', 'a written by the next pass'));
    assert.throws(() => verifyPass({ folder, stateDir, stamp, homes: '', now: NOW + 60_000 }), /does not hold the lock/);
    assert.equal(fs.readFileSync(afterFile, 'utf8'), recorded);
  });
});

// T8 of odd/tasks/memory-hygiene.md: the lock fix of 2e082ca (verify only the pass that holds the lock) left two
// edges of the same rule. Undo wrote into the folder while another pass held the lock, and a lock that does not
// parse threw a SyntaxError that the command does not turn into its own refusal.

test('undo of an earlier pass while another pass holds the lock is refused, and the folder and the lock stay as they were', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, read, write }) => {
    const first = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW }).stamp;
    write('a.md', note('user', 'a written by the first pass'));
    assert.equal(verifyPass({ folder, stateDir, stamp: first, homes: '', now: NOW }).ok, true);
    const second = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW + 60_000 }).stamp;
    const lock = fs.readFileSync(path.join(stateDir, 'lock'), 'utf8');
    assert.throws(() => undoPass({ folder, stateDir, stamp: first, now: NOW + 60_000 }), (err) => err instanceof PassError && err.message.includes(second));
    assert.equal(read('a.md'), note('user', 'a written by the first pass'));
    assert.equal(fs.readFileSync(path.join(stateDir, 'lock'), 'utf8'), lock);
    assert.equal(readJournal(path.join(stateDir, 'journal.jsonl')).filter((entry) => entry.kind === 'undo').length, 0);
  });
});

test('undo of the pass that holds the lock still restores it and releases the lock', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW });
    write('a.md', note('user', 'a outside the rules'));
    write('MEMORY.md', '- [A](a.md) — a\n- extra\n');
    assert.equal(verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }).ok, false);
    undoPass({ folder, stateDir, stamp, now: NOW });
    assert.equal(read('a.md'), note('user', 'a'));
    assert.equal(fs.existsSync(path.join(stateDir, 'lock')), false);
  });
});

test('a lock that does not parse is a PassError naming the lock file, from plan, verify and undo alike', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW });
    const lock = path.join(stateDir, 'lock');
    fs.writeFileSync(lock, '{ half a lock');
    const named = (err) => err instanceof PassError && err.message.includes(lock);
    assert.throws(() => planPass({ folder, stateDir, writeSet: ['a.md'], now: NOW + 60_000 }), named);
    assert.throws(() => verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }), named);
    assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), named);
    fs.writeFileSync(lock, '{"pid":1}');
    assert.throws(() => verifyPass({ folder, stateDir, stamp, homes: '', now: NOW }), named);
  });
});

// ---- T10, the full uninstall (D7.4, D7.5) ----

const markerOf = (stateDir) => purgeMarker(path.dirname(stateDir));

test('readLock never throws: no lock, a planned pass, an empty lock and a lock whose snapshot was never written', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    assert.equal(readLock(stateDir), null);
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    assert.deepEqual(readLock(stateDir), { stamp, pid: process.pid, manifest: true });
    fs.writeFileSync(path.join(stateDir, 'lock'), '');
    assert.deepEqual(readLock(stateDir), { stamp: null, pid: null, manifest: false });
    fs.writeFileSync(path.join(stateDir, 'lock'), JSON.stringify({ stamp: '20991231T000000000Z', pid: 4242 }));
    assert.deepEqual(readLock(stateDir), { stamp: '20991231T000000000Z', pid: 4242, manifest: false });
    fs.rmSync(path.join(stateDir, 'lock'));
    fs.mkdirSync(path.join(stateDir, 'lock'));
    assert.deepEqual(readLock(stateDir), { stamp: null, pid: null, manifest: false }, 'a lock that cannot be read is held');
    assert.equal(readLock(path.join(stateDir, 'journal.jsonl', 'x')), null, 'a state folder that is a file holds no lock');
  });
});

test('a held lock is refused with the line that can release it: verify or undo for a finished plan, remove the file for one that is not', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    assert.throws(() => planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW + 1000 }), (err) => err instanceof PassError && err.message.includes(stamp) && /memory verify or memory undo/.test(err.message));
    fs.writeFileSync(path.join(stateDir, 'lock'), JSON.stringify({ stamp: '20991231T000000000Z', pid: 4242 }));
    assert.throws(() => planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW + 2000 }), (err) => err instanceof PassError && err.message.includes(path.join(stateDir, 'lock')) && /holds no finished plan \(pid 4242\)/.test(err.message) && /remove the file/.test(err.message));
  });
});

test('a plan is refused while an uninstall holds the marker, and leaves no lock and no snapshot behind', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    const marker = markerOf(stateDir);
    fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: NOW }));
    try {
      assert.throws(() => planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW }), (err) => err instanceof PassError && err.message.includes(marker));
      assert.equal(fs.existsSync(path.join(stateDir, 'lock')), false);
      assert.equal(fs.existsSync(path.join(stateDir, 'snapshots')), false);
    } finally {
      fs.rmSync(marker, { force: true });
    }
  });
});

test('a refused undo of a pass still planned keeps that pass\'s lock: before verify, and while an uninstall holds the marker', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    const lock = path.join(stateDir, 'lock');
    assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), (err) => err instanceof PassError && /run memory verify/.test(err.message));
    assert.equal(fs.existsSync(lock), true, 'refused before verify');
    const marker = markerOf(stateDir);
    fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: NOW }));
    try {
      assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), (err) => err instanceof PassError && err.message.includes(marker));
      assert.equal(fs.existsSync(lock), true, 'refused by the marker');
    } finally {
      fs.rmSync(marker, { force: true });
    }
    assert.equal(verifyPass({ folder, stateDir, stamp, now: NOW }).ok, true, 'the pass can still be verified');
  });
});

test('an undo of a verified pass takes the lock: refused while an uninstall holds the marker, it writes nothing', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [A](a.md) — a\n');
    assert.equal(verifyPass({ folder, stateDir, stamp, now: NOW }).ok, true);
    const marker = markerOf(stateDir);
    fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: NOW }));
    try {
      assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), (err) => err instanceof PassError && err.message.includes(marker));
      assert.equal(read('MEMORY.md'), '- [A](a.md) — a\n');
      assert.equal(fs.existsSync(path.join(stateDir, 'lock')), false, 'the lock it took is released');
    } finally {
      fs.rmSync(marker, { force: true });
    }
    undoPass({ folder, stateDir, stamp, now: NOW });
    assert.equal(read('MEMORY.md'), '- [A](a.md) — a long line\n');
    assert.equal(fs.existsSync(path.join(stateDir, 'lock')), false, 'and released after an undo that ran');
  });
});

test('an undo from a damaged snapshot is refused by name before it writes anything', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [A](a.md) — a\n');
    verifyPass({ folder, stateDir, stamp, now: NOW });
    fs.rmSync(path.join(stateDir, 'snapshots', stamp, 'files', 'MEMORY.md'));
    assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), (err) => err instanceof PassError && /damaged/.test(err.message) && err.message.includes('MEMORY.md'));
    assert.equal(read('MEMORY.md'), '- [A](a.md) — a\n');
  });
});

test('lockLine of a lock released between the refused write and its reading says to run again, never throws', () => {
  assert.match(lockLine('/state', null), /released just now; run this again/);
});

test('an undo from a snapshot whose after-index is gone is refused as damaged, before it writes anything', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [A](a.md) — a\n');
    verifyPass({ folder, stateDir, stamp, now: NOW });
    fs.rmSync(path.join(stateDir, 'snapshots', stamp, 'after-index.txt'));
    assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), (err) => err instanceof PassError && /damaged/.test(err.message) && err.message.includes('after-index.txt'));
    assert.equal(read('MEMORY.md'), '- [A](a.md) — a\n');
  });
});

test('an undo from a snapshot whose after-index no longer matches the after-state is refused, before it merges the index', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    write('MEMORY.md', '- [A](a.md) — a\n');
    verifyPass({ folder, stateDir, stamp, now: NOW });
    // Someone writes the index since, so undo would merge with the after-index, which is now cut short.
    write('MEMORY.md', '- [A](a.md) — a\n- [B](b.md) — b\n');
    fs.writeFileSync(path.join(stateDir, 'snapshots', stamp, 'after-index.txt'), '');
    assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), (err) => err instanceof PassError && /damaged/.test(err.message) && err.message.includes('after-index.txt'));
    assert.equal(read('MEMORY.md'), '- [A](a.md) — a\n- [B](b.md) — b\n');
  });
});

test('verify keeps the index after the pass byte for byte, so its hash is the one after.json records', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    // A byte that is not UTF-8 does not survive a round trip through a string.
    fs.writeFileSync(path.join(folder, 'MEMORY.md'), Buffer.concat([Buffer.from('- [A](a.md) — a '), Buffer.from([0xff]), Buffer.from('\n')]));
    verifyPass({ folder, stateDir, stamp, now: NOW });
    const dir = path.join(stateDir, 'snapshots', stamp);
    assert.deepEqual(fs.readFileSync(path.join(dir, 'after-index.txt')), fs.readFileSync(path.join(folder, 'MEMORY.md')));
  });
});

// Before b761aef, verify wrote the after-index as text: an index that was not UTF-8 came out with other bytes, so
// its hash is not the one after.json records, and the snapshot is not damaged for that.
const NOT_UTF8 = Buffer.concat([Buffer.from('- [A](a.md) — a '), Buffer.from([0xff]), Buffer.from('\n')]);
const asOldVerifyWroteIt = (stateDir, stamp, index) => fs.writeFileSync(path.join(stateDir, 'snapshots', stamp, 'after-index.txt'), index.toString('utf8'));

test('an undo from a snapshot an older verify wrote, of an index that is not UTF-8, restores it while the index is as the pass left it', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, read }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    fs.writeFileSync(path.join(folder, 'MEMORY.md'), NOT_UTF8);
    verifyPass({ folder, stateDir, stamp, now: NOW });
    asOldVerifyWroteIt(stateDir, stamp, NOT_UTF8);
    const result = undoPass({ folder, stateDir, stamp, now: NOW });
    assert.deepEqual(result.restored, ['MEMORY.md']);
    assert.equal(read('MEMORY.md'), '- [A](a.md) — a long line\n');
  });
});

test('an undo from such a snapshot, once the index is written since, is refused for that reason and writes nothing', () => {
  withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir, read, write }) => {
    const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
    fs.writeFileSync(path.join(folder, 'MEMORY.md'), NOT_UTF8);
    verifyPass({ folder, stateDir, stamp, now: NOW });
    asOldVerifyWroteIt(stateDir, stamp, NOT_UTF8);
    write('MEMORY.md', '- [A](a.md) — a\n- [B](b.md) — b\n');
    assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), (err) => err instanceof PassError
      && err.message === `snapshot ${stamp} was verified before the index was kept byte for byte, and its index is not UTF-8, or its after-index.txt was damaged since: either way it cannot be merged with the index written since; nothing was undone`);
    assert.equal(read('MEMORY.md'), '- [A](a.md) — a\n- [B](b.md) — b\n');
  });
});

// An after-index damaged after a verify can hold U+FFFD too (memory-hygiene T13). While the index is as the pass left
// it, an older copy is its text exactly, so any other is damaged; one that is not UTF-8 itself no text write made.
test('an after-index that holds U+FFFD but is not the text of the index the pass left is damaged, not older, and nothing is undone', () => {
  const damaged = {
    'another text': (index) => Buffer.from(index.toString('utf8').replace('a ', 'x ')),
    'bytes no text write makes': (index) => Buffer.concat([Buffer.from(index.toString('utf8')), Buffer.from([0xfe])]),
  };
  for (const [how, damage] of Object.entries(damaged)) {
    withPass({ 'MEMORY.md': '- [A](a.md) — a long line\n', 'a.md': note('user', 'a') }, ({ folder, stateDir }) => {
      const { stamp } = planPass({ folder, stateDir, writeSet: ['MEMORY.md'], now: NOW });
      fs.writeFileSync(path.join(folder, 'MEMORY.md'), NOT_UTF8);
      verifyPass({ folder, stateDir, stamp, now: NOW });
      fs.writeFileSync(path.join(stateDir, 'snapshots', stamp, 'after-index.txt'), damage(NOT_UTF8));
      assert.throws(() => undoPass({ folder, stateDir, stamp, now: NOW }), (err) => err instanceof PassError
        && err.message === `snapshot ${stamp} is damaged: after-index.txt is missing or changed; nothing was undone`, how);
      assert.deepEqual(fs.readFileSync(path.join(folder, 'MEMORY.md')), NOT_UTF8, how);
    });
  }
});
