import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { memoryMain } from './memory.mjs';

const note = (type) => `---\nname: x\ndescription: y\nmetadata:\n  type: ${type}\n---\n\nbody\n`;

/** A home and a project folder outside any repository, so the project is the folder itself. */
async function withProject(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-memory-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-memory-project-'));
  const slug = project.replace(/[^A-Za-z0-9]/g, '-');
  const folder = path.join(home, '.claude', 'projects', slug, 'memory');
  const journal = path.join(home, '.js-harness', 'memory-hygiene', slug, 'journal.jsonl');
  try {
    return await fn({ home, project, folder, journal });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
}

async function run(argv, deps) {
  const out = [];
  const err = [];
  const code = await memoryMain(argv, { ...deps, stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: Date.parse('2026-10-15T08:00:00Z') });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

test('status exits 1 and names each reason when a pass is due', async () => {
  await withProject(async ({ home, project, folder }) => {
    write(path.join(folder, 'MEMORY.md'), `- [a](a.md) — ${'x'.repeat(200)}\n`);
    write(path.join(folder, 'a.md'), note('feedback'));
    const { code, out } = await run(['status', '--cwd', project, '--home', home], {});
    assert.equal(code, 1);
    assert.match(out, /^memory hygiene: due$/m);
    assert.match(out, /^ {2}no-pass {2}no verified pass recorded yet$/m);
    assert.match(out, /^ {2}line-chars {2}1 line over 150 characters: 1$/m);
  });
});

test('status exits 0 and says nothing is due after a recent verified pass', async () => {
  await withProject(async ({ home, project, folder, journal }) => {
    write(path.join(folder, 'MEMORY.md'), '- [a](a.md) — hook\n');
    write(path.join(folder, 'a.md'), note('user'));
    write(journal, `${JSON.stringify({ kind: 'verify', at: '2026-10-14T08:00:00Z', indexBytes: 19, notes: ['a.md'] })}\n`);
    const { code, out } = await run(['status', '--cwd', project, '--home', home], {});
    assert.equal(code, 0);
    assert.match(out, /^memory hygiene: nothing due$/m);
  });
});

test('status --json gives the same state as data', async () => {
  await withProject(async ({ home, project, folder }) => {
    write(path.join(folder, 'MEMORY.md'), '- [a](a.md) — hook\n');
    write(path.join(folder, 'a.md'), note('user'));
    const { code, out } = await run(['status', '--cwd', project, '--home', home, '--json'], {});
    const data = JSON.parse(out);
    assert.equal(code, 1);
    assert.equal(data.due, true);
    assert.deepEqual(data.reasons.map((r) => r.id), ['no-pass']);
    assert.equal(data.index.bytes, Buffer.byteLength('- [a](a.md) — hook\n'));
    assert.equal(data.budgets.indexBytes, 4000);
  });
});

test('status with no memory folder exits 0 and says so', async () => {
  await withProject(async ({ home, project }) => {
    const { code, out } = await run(['status', '--cwd', project, '--home', home], {});
    assert.equal(code, 0);
    assert.match(out, /^memory hygiene: n\/a \(no memory folder at .+\)$/m);
  });
});

test('status --history prints the index bytes of each verified pass, oldest first', async () => {
  await withProject(async ({ home, project, folder, journal }) => {
    write(path.join(folder, 'MEMORY.md'), '- [a](a.md) — hook\n');
    write(path.join(folder, 'a.md'), note('user'));
    const entries = [
      { kind: 'verify', at: '2026-10-01T08:00:00Z', indexBytes: 10917, notes: ['a.md'] },
      { kind: 'plan', at: '2026-10-08T08:00:00Z', notes: [] },
      { kind: 'verify', at: '2026-10-08T09:00:00Z', indexBytes: 3120, notes: ['a.md'] },
    ];
    write(journal, `${entries.map((e) => JSON.stringify(e)).join('\n')}\n`);
    const { code, out } = await run(['status', '--cwd', project, '--home', home, '--history'], {});
    assert.equal(code, 0);
    assert.deepEqual(out.split('\n').filter((l) => l.startsWith('  2026')), ['  2026-10-01T08:00:00Z  index 10917 B  1 notes', '  2026-10-08T09:00:00Z  index 3120 B  1 notes']);
  });
});

test('plan, verify and undo: a pass journaled by the CLI, his words found in a feature document, then undone', async () => {
  await withProject(async ({ home, project, folder, journal }) => {
    const words = 'una regla suya que vive ahora en el documento';
    const before = `---\nmetadata:\n  type: feedback\n---\n\n"${words}"\n`;
    write(path.join(folder, 'MEMORY.md'), '- [A](a.md) — a\n- [B](b.md) — b\n');
    write(path.join(folder, 'a.md'), before);
    write(path.join(folder, 'b.md'), note('user'));
    write(path.join(project, 'odd', 'tasks', 'f.md'), `His words: "${words}".\n`);

    const planned = await run(['plan', 'MEMORY.md', 'a.md', '--cwd', project, '--home', home], {});
    assert.equal(planned.code, 0, planned.err);
    const stamp = /^memory pass ([0-9TZ]+) planned/m.exec(planned.out)[1];

    fs.rmSync(path.join(folder, 'a.md'));
    write(path.join(folder, 'MEMORY.md'), '- [B](b.md) — b\n');
    const refused = await run(['verify', stamp, '--cwd', project, '--home', home], {});
    assert.equal(refused.code, 1);
    assert.match(refused.out, /a\.md was deleted without his approval/);

    const verified = await run(['verify', stamp, '--approved', 'a.md', '--cwd', project, '--home', home], {});
    assert.equal(verified.code, 0, verified.out);
    assert.match(verified.out, /^memory pass .+ verified/m);
    assert.ok(fs.readFileSync(journal, 'utf8').includes('"kind":"verify"'));

    const undone = await run(['undo', stamp, '--cwd', project, '--home', home], {});
    assert.equal(undone.code, 0, undone.out);
    assert.equal(fs.readFileSync(path.join(folder, 'a.md'), 'utf8'), before);
  });
});

test('plan refuses while a pass holds the lock (exit 1), and verify of an unknown stamp exits 1', async () => {
  await withProject(async ({ home, project, folder }) => {
    write(path.join(folder, 'MEMORY.md'), '- [B](b.md) — b\n');
    write(path.join(folder, 'b.md'), note('user'));
    assert.equal((await run(['plan', 'b.md', '--cwd', project, '--home', home], {})).code, 0);
    const second = await run(['plan', 'b.md', '--cwd', project, '--home', home], {});
    assert.equal(second.code, 1);
    assert.match(second.err, /a pass holds the lock/);
    const unknown = await run(['verify', '20990101T000000000Z', '--cwd', project, '--home', home], {});
    assert.equal(unknown.code, 1);
    assert.match(unknown.err, /no snapshot 20990101T000000000Z/);
  });
});

test('an unknown subcommand, an unknown flag and a flag with no value are usage errors (exit 2)', async () => {
  await withProject(async ({ home, project }) => {
    for (const argv of [[], ['tidy'], ['status', '--fast'], ['status', '--cwd'], ['status', '--home', '--json'], ['plan'], ['verify'], ['undo', 'a', 'b'], ['status', 'extra'], ['verify', 's', '--approved']]) {
      const { code, err } = await run(argv, { cwd: project, home });
      assert.equal(code, 2, `argv ${JSON.stringify(argv)}`);
      assert.match(err, /Usage: js-harness memory status/);
    }
  });
});
