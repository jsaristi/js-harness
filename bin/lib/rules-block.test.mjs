// T7 of odd/tasks/f8-s10-port.md: `install` writes his nine Rules lines (his answer D7) into the user's own
// `~/.claude/CLAUDE.md`, in a small recorded block, and `uninstall` takes out exactly that (his answer to question 99,
// G12). The text around the block is his or gentle-ai's and is never changed. Every test runs in a scratch home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, readManifest, uninstall } from './manifest.mjs';
import { RULES_LINES, rulesBody } from './rules-block.mjs';
import { markedBlock } from './project-template.mjs';
import { renameOver } from './atomic-write.mjs';

const fakeSchtasks = () => {
  throw new Error('no scheduled task is recorded here');
};

function machine() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rules-'));
  const file = path.join(home, '.claude', 'CLAUDE.md');
  const write = (text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const read = () => fs.readFileSync(file, 'utf8');
  const remove = (deps = {}) => uninstall(home, { schtasks: fakeSchtasks, ...deps });
  return { home, file, write, read, remove, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

const count = (text, part) => text.split(part).length - 1;

test('the lines are the nine of his answer D7, word for word as the root CLAUDE.md keeps them', () => {
  const claude = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'CLAUDE.md'), 'utf8').replace(/\r\n/g, '\n');
  const section = claude.slice(claude.indexOf('## Kept from the global file'), claude.indexOf('\nCodeGraph:'));
  const kept = section.split('\n').filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
  assert.equal(RULES_LINES.length, 9);
  assert.deepEqual(RULES_LINES, kept);
  assert.ok(rulesBody().startsWith('## Rules\n'));
});

test('in an empty home install writes the file with the block alone, and uninstall takes the file away', () => {
  const m = machine();
  try {
    const manifest = install(m.home, '1.0.0');
    assert.deepEqual(manifest.rulesHeld, { status: 'written', path: m.file });
    assert.equal(m.read(), `${markedBlock(rulesBody(), 'rules')}\n`);
    assert.deepEqual(readManifest(m.home).rulesBlock, { path: m.file, createdFile: true, separator: '' });
    const result = m.remove();
    assert.deepEqual(result.rulesBlock, { status: 'released', path: m.file });
    assert.equal(fs.existsSync(m.file), false);
  } finally {
    m.done();
  }
});

for (const [name, before] of [
  ['ends with a line end', '# gentle-ai\n\nIts own lines.\n'],
  ['ends without one', '# gentle-ai\n\nIts own lines.'],
  ['has CRLF line ends', '# gentle-ai\r\n\r\nIts own lines.\r\n'],
]) {
  test(`over a file that ${name}, install adds the block after its text and uninstall gives the file its bytes back`, () => {
    const m = machine();
    try {
      m.write(before);
      install(m.home, '1.0.0');
      const written = m.read();
      assert.ok(written.startsWith(before), 'the text before the block is kept as it was');
      assert.equal(count(written, '- Verify a claim before building on it.'), 1);
      if (before.includes('\r\n')) assert.equal(count(written, '\n'), count(written, '\r\n'), 'the block takes the file\'s line ends');
      assert.equal(readManifest(m.home).rulesBlock.createdFile, false);
      assert.equal(m.remove().rulesBlock.status, 'released');
      assert.equal(m.read(), before);
    } finally {
      m.done();
    }
  });
}

test('a repeat install finds the block there, writes nothing and keeps the first record', () => {
  const m = machine();
  try {
    m.write('# mine\n');
    install(m.home, '1.0.0');
    const first = m.read();
    const record = readManifest(m.home).rulesBlock;
    const again = install(m.home, '1.0.1');
    assert.deepEqual(again.rulesHeld, { status: 'already', path: m.file });
    assert.equal(m.read(), first);
    assert.deepEqual(readManifest(m.home).rulesBlock, record);
    m.remove();
    assert.equal(m.read(), '# mine\n');
  } finally {
    m.done();
  }
});

test('a block of an earlier version, unedited, is rendered with these lines, and text added after it stays', () => {
  const m = machine();
  try {
    m.write('# mine\n');
    install(m.home, '1.0.0');
    m.write(`${m.read().replace(markedBlock(rulesBody(), 'rules'), markedBlock('## Rules\n- An older line.\n', 'rules'))}# added later\n`);
    const again = install(m.home, '1.0.1');
    assert.deepEqual(again.rulesHeld, { status: 'updated', path: m.file });
    assert.equal(count(m.read(), '- An older line.'), 0);
    assert.equal(count(m.read(), `- ${RULES_LINES[0]}`), 1);
    m.remove();
    assert.equal(m.read(), '# mine\n# added later\n');
  } finally {
    m.done();
  }
});

test('a block whose lines he edited is his: install leaves it, and uninstall keeps it and says so', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    const edited = m.read().replace('- Verify a claim before building on it.\n', '- Verify a claim before building on it, always.\n');
    m.write(edited);
    assert.deepEqual(install(m.home, '1.0.1').rulesHeld, { status: 'edited', path: m.file });
    assert.equal(m.read(), edited);
    const result = m.remove();
    assert.deepEqual(result.rulesBlock, { status: 'edited', path: m.file });
    assert.equal(m.read(), edited);
    assert.equal(readManifest(m.home), null);
  } finally {
    m.done();
  }
});

test('a block he took out is written again by the next install, and uninstall still leaves his text', () => {
  const m = machine();
  try {
    m.write('# mine\n');
    install(m.home, '1.0.0');
    m.write('# mine\n# and more\n');
    assert.deepEqual(install(m.home, '1.0.1').rulesHeld, { status: 'written', path: m.file });
    assert.equal(m.remove().rulesBlock.status, 'released');
    assert.equal(m.read(), '# mine\n# and more\n');
  } finally {
    m.done();
  }
});

test('when the manifest cannot be written, the block install wrote is taken back', () => {
  const m = machine();
  try {
    m.write('# mine\n');
    fs.writeFileSync(path.join(m.home, '.js-harness'), 'a file where the manifest\'s folder goes');
    assert.throws(() => install(m.home, '1.0.0'));
    assert.equal(m.read(), '# mine\n');
  } finally {
    m.done();
  }
});

test('a file that cannot be read is skipped by install, and on uninstall it is a failure that stays recorded', () => {
  const m = machine();
  try {
    fs.mkdirSync(m.file, { recursive: true });
    const skipped = install(m.home, '1.0.0').rulesHeld;
    assert.equal(skipped.status, 'skipped');
    assert.match(skipped.reason, /^not readable \(/);
    assert.equal(readManifest(m.home).rulesBlock, undefined);
    fs.rmSync(m.file, { recursive: true });

    m.write('# mine\n');
    install(m.home, '1.0.0');
    const good = m.read();
    fs.rmSync(m.file);
    fs.mkdirSync(m.file);
    const failed = m.remove();
    assert.equal(failed.rulesBlock.status, 'failed');
    assert.ok(readManifest(m.home).rulesBlock, 'still recorded, for a run again');
    fs.rmSync(m.file, { recursive: true });
    m.write(good);
    assert.equal(m.remove().rulesBlock.status, 'released');
    assert.equal(m.read(), '# mine\n');
  } finally {
    m.done();
  }
});

test('a write that fails on uninstall keeps the record, so a second uninstall takes the block out', () => {
  const m = machine();
  try {
    m.write('# mine\n');
    install(m.home, '1.0.0');
    const writeFile = (file, ...rest) => {
      if (String(file).startsWith(m.file)) throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
      return fs.writeFileSync(file, ...rest);
    };
    assert.deepEqual(m.remove({ writeFile }).rulesBlock, { status: 'failed', path: m.file, code: 'EBUSY' });
    assert.ok(readManifest(m.home).rulesBlock);
    assert.equal(m.remove().rulesBlock.status, 'released');
    assert.equal(m.read(), '# mine\n');
  } finally {
    m.done();
  }
});

// The independent verifier of T7 (L20): uninstall never joins two of his lines, whatever came after the block, nor
// leaves a stray carriage return when the file's line ends changed since install.
for (const [name, before, after, expected] of [
  ['text added after a block put after a file with no line end', 'A', (t) => `${t}C\n`, 'A\nC\n'],
  ['CRLF text added after it', 'A\r\nB', (t) => `${t}C\r\n`, 'A\r\nB\r\nC\r\n'],
  ['his line ends turned to CRLF', 'A\n', (t) => t.replace(/\r?\n/g, '\r\n'), 'A\r\n'],
  ['his line ends turned to LF', 'A\r\nB', (t) => t.replace(/\r\n/g, '\n'), 'A\nB'],
]) {
  test(`uninstall joins none of his lines: ${name}`, () => {
    const m = machine();
    try {
      m.write(before);
      install(m.home, '1.0.0');
      m.write(after(m.read()));
      assert.equal(m.remove().rulesBlock.status, 'released');
      assert.equal(m.read(), expected);
    } finally {
      m.done();
    }
  });
}

test('a project block in his CLAUDE.md is not the Rules block: install adds its own and leaves the other as it is', () => {
  const m = machine();
  try {
    const project = markedBlock('## Working with the owner\n- A project line.\n');
    m.write(`# mine\n\n${project}\n`);
    install(m.home, '1.0.0');
    assert.ok(m.read().includes(project), 'the project block is untouched');
    assert.equal(count(m.read(), `- ${RULES_LINES[0]}`), 1);
    m.remove();
    assert.equal(m.read(), `# mine\n\n${project}\n`);
  } finally {
    m.done();
  }
});

test('a record edited by hand cannot take his text: an unknown separator or a createdFile that is not true is ignored', () => {
  const m = machine();
  try {
    m.write('keep me\n');
    install(m.home, '1.0.0');
    const file = path.join(m.home, '.js-harness', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    Object.assign(manifest.rulesBlock, { separator: 'keep me\n\n', createdFile: 'yes' });
    fs.writeFileSync(file, JSON.stringify(manifest));
    assert.equal(m.remove().rulesBlock.status, 'released');
    // The separator is read as none, so the blank line install put before the block stays: a line end, never his text.
    assert.equal(m.read(), 'keep me\n\n');
  } finally {
    m.done();
  }
});

// gentle-ai on T7's slice: his file is renamed into place as the manifest is, tried again while Windows holds it open.
test('the rename that puts his file in place is tried again while Windows holds it, and fails on the third refusal', () => {
  const held = (times) => {
    let calls = 0;
    return { rename: () => { calls += 1; if (calls <= times) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' }); }, calls: () => calls };
  };
  const brief = held(2);
  renameOver('a', 'b', { rename: brief.rename, pause: () => {}, platform: 'win32' });
  assert.equal(brief.calls(), 3);
  const stuck = held(3);
  assert.throws(() => renameOver('a', 'b', { rename: stuck.rename, pause: () => {}, platform: 'win32' }), { code: 'EBUSY' });
  const linux = held(1);
  assert.throws(() => renameOver('a', 'b', { rename: linux.rename, pause: () => {}, platform: 'linux' }), { code: 'EBUSY' });
});

test('install writes his file through a fresh sibling: a file already at a sibling\'s name is never written through', () => {
  const m = machine();
  try {
    m.write('# mine\n');
    fs.writeFileSync(`${m.file}.${process.pid}.tmp`, 'a stale file\n');
    install(m.home, '1.0.0');
    assert.equal(fs.readFileSync(`${m.file}.${process.pid}.tmp`, 'utf8'), 'a stale file\n');
    assert.deepEqual(fs.readdirSync(path.dirname(m.file)).filter((name) => name.startsWith('CLAUDE.md.')), [`CLAUDE.md.${process.pid}.tmp`]);
  } finally {
    m.done();
  }
});

test('a record that names another file is left as it is, said, and not kept', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    const file = path.join(m.home, '.js-harness', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.rulesBlock.path = path.join(m.home, 'elsewhere.md');
    fs.writeFileSync(file, JSON.stringify(manifest));
    const result = m.remove();
    assert.equal(result.rulesBlock.status, 'kept');
    assert.equal(result.rulesBlock.path, path.join(m.home, 'elsewhere.md'));
    assert.equal(readManifest(m.home)?.rulesBlock, undefined);
  } finally {
    m.done();
  }
});
