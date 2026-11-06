// T7 of odd/tasks/f8-s10-port.md: `install` writes his nine Rules lines (his answer D7) into the user's own
// `~/.claude/CLAUDE.md`, in a small recorded block, and `uninstall` takes out exactly that (his answer to question 99,
// G12). The text around the block is his or the global file's and is never changed. Every test runs in a scratch home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, readManifest, uninstall } from './manifest.mjs';
import { KEPT_GROUPS, RULES_LINES, rulesBody } from './rules-block.mjs';
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

// The diet's Appendix A.1 (docs/proposals/harness-diet.md), frozen: each line it keeps, quoted whole as "> <line>".
// Until F8 S2's T9 the root CLAUDE.md held a copy of these lines and the tests read it; once the global block loads
// in this repo too, that copy left, so the lines are held to A.1 where it quotes them, and the rest by a hash.
const appendixQuotes = () => {
  const diet = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'docs', 'proposals', 'harness-diet.md'), 'utf8').replace(/\r\n/g, '\n');
  const appendix = diet.slice(diet.indexOf('### A.1 The kept text'), diet.indexOf('## Appendix B'));
  return appendix.split('\n').filter((line) => line.startsWith('> ')).map((line) => line.slice(2));
};
const sha256 = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the lines are the nine of his answer D7: the five A.1 quotes there, and all nine as frozen at F8 S2', () => {
  const quoted = appendixQuotes();
  assert.equal(RULES_LINES.length, 9);
  assert.deepEqual(RULES_LINES.filter((line) => quoted.includes(line)), RULES_LINES.slice(4));
  // D7's four lines have no whole-line source left to read; a change to any of the nine changes this hash, on purpose.
  assert.equal(sha256(RULES_LINES), 'de629b60d88cad04a742e4cdfb1d4d2cd9208d3399608a8cf9a58a1c200fb3fb');
  assert.ok(rulesBody().startsWith('## Rules\n'));
});

// F8 S2, T13 (odd/tasks/f8-s2-removal.md, S10): every project keeps the rest of the diet's Appendix A.1 once the old stack's
// blocks leave his global file; graphify's own install writes its lines there, and engram's protocol comes from engram
// alone (row 11), so neither is repeated.
test('the kept groups are Appendix A.1\'s lines, word for word and in its order, and the block renders each after the nine', () => {
  const quoted = appendixQuotes();
  const lines = KEPT_GROUPS.flatMap((group) => group.lines);
  assert.equal(lines.length, 14);
  assert.deepEqual(lines.map((line) => quoted.indexOf(line)).filter((at) => at === -1), [], 'every kept line is quoted whole in A.1');
  const order = lines.map((line) => quoted.indexOf(line));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'the lines keep A.1\'s order');
  assert.deepEqual(KEPT_GROUPS.map((group) => group.title), ['CodeGraph', 'Delegation', 'Task Size and scratch', 'Remote operation authorization']);
  // The titles and the grouping as the root CLAUDE.md had them until T9 of F8 S2, frozen: a change is on purpose.
  assert.equal(sha256(KEPT_GROUPS), 'c24fea8df749d6446f376b1fc44cbf5ce439398a601fe72ca04c121bea21e579');
  const body = rulesBody();
  for (const { title, lines } of KEPT_GROUPS) assert.ok(body.includes(`\n${title}:\n${lines.map((line) => `- ${line}`).join('\n')}\n`), title);
  assert.ok(body.indexOf(`- ${RULES_LINES[8]}`) < body.indexOf('\nCodeGraph:'));
  assert.ok(!body.includes('graphify'));
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
  ['ends with a line end', '# other-tool\n\nIts own lines.\n'],
  ['ends without one', '# other-tool\n\nIts own lines.'],
  ['has CRLF line ends', '# other-tool\r\n\r\nIts own lines.\r\n'],
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

// A review of cca493e0..c7fe8137: the rollback's other path, a file install made, is taken away again.
test('when the manifest cannot be written, a CLAUDE.md install made is removed again', () => {
  const m = machine();
  try {
    fs.writeFileSync(path.join(m.home, '.js-harness'), 'a file where the manifest\'s folder goes');
    assert.throws(() => install(m.home, '1.0.0'));
    assert.equal(fs.existsSync(m.file), false);
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

// A review of T7's slice: his file is renamed into place as the manifest is, tried again while Windows holds it open.
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

// Codex on cca493e..b27d063, part 2: his CLAUDE.md as a link (into a dotfiles repository) stays a link, the block going
// into the file it names; a link to nothing is skipped; and the file keeps its mode.
const canLink = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-link-'));
  try {
    fs.writeFileSync(path.join(dir, 'a'), '');
    fs.symlinkSync(path.join(dir, 'a'), path.join(dir, 'b'), 'file');
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

test('his CLAUDE.md as a link stays a link: the block goes into the file it names and comes out of it', { skip: !canLink && 'this machine cannot make links' }, () => {
  const m = machine();
  try {
    const real = path.join(m.home, 'dotfiles', 'CLAUDE.md');
    fs.mkdirSync(path.dirname(real), { recursive: true });
    fs.writeFileSync(real, '# from dotfiles\n');
    fs.mkdirSync(path.dirname(m.file), { recursive: true });
    fs.symlinkSync(real, m.file, 'file');
    assert.equal(install(m.home, '1.0.0').rulesHeld.status, 'written');
    assert.ok(fs.lstatSync(m.file).isSymbolicLink(), 'still a link after install');
    assert.equal(count(fs.readFileSync(real, 'utf8'), `- ${RULES_LINES[0]}`), 1);
    assert.equal(m.remove().rulesBlock.status, 'released');
    assert.ok(fs.lstatSync(m.file).isSymbolicLink(), 'still a link after uninstall');
    assert.equal(fs.readFileSync(real, 'utf8'), '# from dotfiles\n');

    fs.rmSync(real);
    const dangling = install(m.home, '1.0.0').rulesHeld;
    assert.equal(dangling.status, 'skipped');
    assert.equal(fs.existsSync(real), false, 'nothing is written through a link to nothing');
  } finally {
    m.done();
  }
});

// A review of cca493e0..c7fe8137: a file install made, which he then moved into dotfiles behind a link, is emptied
// there; the link is not what goes.
test('a CLAUDE.md install made and he moved behind a link is emptied in the file it names, and the link stays', { skip: !canLink && 'this machine cannot make links' }, () => {
  const m = machine();
  try {
    assert.equal(install(m.home, '1.0.0').rulesHeld.status, 'written');
    const real = path.join(m.home, 'dotfiles', 'CLAUDE.md');
    fs.mkdirSync(path.dirname(real), { recursive: true });
    fs.renameSync(m.file, real);
    fs.symlinkSync(real, m.file, 'file');
    assert.equal(m.remove().rulesBlock.status, 'released');
    assert.ok(fs.lstatSync(m.file).isSymbolicLink(), 'still a link after uninstall');
    assert.equal(fs.readFileSync(real, 'utf8'), '');
  } finally {
    m.done();
  }
});

test('his CLAUDE.md keeps its mode through install and uninstall', { skip: process.platform === 'win32' && 'Windows keeps no Unix mode' }, () => {
  const m = machine();
  try {
    m.write('# private\n');
    fs.chmodSync(m.file, 0o600);
    install(m.home, '1.0.0');
    assert.equal(fs.statSync(m.file).mode & 0o777, 0o600);
    m.remove();
    assert.equal(fs.statSync(m.file).mode & 0o777, 0o600);
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
