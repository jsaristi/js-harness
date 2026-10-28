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
    assert.equal(m.read(), `${markedBlock(rulesBody())}\n`);
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
    m.write(`${m.read().replace(markedBlock(rulesBody()), markedBlock('## Rules\n- An older line.\n'))}# added later\n`);
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
      if (file === m.file) throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
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
