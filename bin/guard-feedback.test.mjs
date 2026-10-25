// `js-harness guard`, for a feedback note of a project's Claude Code memory folder (odd/tasks/memory-feedback-home.md,
// S2): `--hook` refuses a Write or an Edit that leaves such a note naming no home of its rule in the repository, and
// `--memory <folder>` reports every note of a folder that does. On 2026-10-15 a session waited for him to type
// /compact because his newer rule lived only in a memory note while AGENTS.md said the old one.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { guardMain } from './guard.mjs';
import { RULES } from './lib/rules-data.mjs';
import { writeRules } from './lib/rules.mjs';

const NOTE = 'C:/Users/u/.claude/projects/D--proj/memory/compact-by-hand.md';
const AGENTS = '# proj\n\nHe never compacts by hand, here or away: near 88% of its window a session writes its state.\n';
const quiet = { code: 0, out: '', err: '' };

/** A memory note of type `type` whose body is `body`, with the front matter this host writes. */
const noteOf = (body, type = 'feedback') => `---\nname: compact-by-hand\ndescription: he never compacts by hand\nmetadata:\n  node_type: memory\n  type: ${type}\n---\n\n${body}\n`;

/** Runs `guard` with `args` on `payload` in a project whose rules file reads `rulesText` (null for none) and whose
 * AGENTS.md reads `agents` (null for none), the note on disk reading `onDisk` (null for none). */
async function guard(payload, { args = ['--hook'], rulesText = writeRules(RULES), agents = AGENTS, onDisk = null } = {}) {
  const out = [];
  const err = [];
  const missing = () => {
    throw Object.assign(new Error('no file'), { code: 'ENOENT' });
  };
  const code = await guardMain(args, {
    readStdin: () => JSON.stringify(payload),
    projectRoot: () => 'D:/project',
    readFile: (file) => {
      const name = file.replace(/\\/g, '/');
      if (name === 'D:/project/bin/lib/rules-data.mjs') return rulesText === null ? missing() : rulesText;
      if (name === 'D:/project/AGENTS.md') return agents === null ? missing() : agents;
      return fs.readFileSync(file, 'utf8');
    },
    readIndex: () => (onDisk === null ? missing() : onDisk),
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    testRun: () => assert.fail('gate lock read'),
    env: {},
    homedir: () => path.join(os.tmpdir(), 'js-harness-guard-feedback-no-home'),
  });
  return { code, out: out.join(''), err: err.join('') };
}

const write = (content, file = NOTE) => ({ tool_name: 'Write', tool_input: { file_path: file, content } });
const reasonOf = (result) => {
  const output = JSON.parse(result.out).hookSpecificOutput;
  assert.equal(output.permissionDecision, 'deny');
  return output.permissionDecisionReason;
};

test('a Write of a feedback note that names no home of its rule is denied, and the reason says how to cement it', async () => {
  const result = await guard(write(noteOf('He never compacts by hand; the lead sends the next prompt.')));
  assert.equal(result.code, 0);
  const reason = reasonOf(result);
  assert.match(reason, /^js-harness guard: compact-by-hand\.md is a feedback note/);
  assert.match(reason, /rule memory-feedback-home/);
  assert.match(reason, /js-harness rules change <id>/);
  assert.match(reason, /`rule:<id>`/);
  assert.match(reason, /AGENTS\.md "<phrase>"/);
});

// odd/tasks/behind-copy-guard.md, S1-S2: a copy behind the project's list holds the rule where the project declares it.
test('behind a project whose list declares the rule, a feedback note with no home is still denied, naming the update only where the rule differs', async () => {
  const changed = (id) => writeRules(RULES.map((rule) => (rule.id === id ? { ...rule, value: `${rule.value}-changed` } : rule)));
  const note = write(noteOf('He never compacts by hand; the lead sends the next prompt.'));
  const here = reasonOf(await guard(note));
  assert.equal(reasonOf(await guard(note, { rulesText: changed('session-title') })), here);
  const stale = reasonOf(await guard(note, { rulesText: changed('memory-feedback-home') }));
  assert.ok(stale.startsWith(here), stale);
  assert.match(stale, /declares rule memory-feedback-home otherwise than the project's bin\/lib\/rules-data\.mjs/);
  assert.deepEqual(await guard(note, { rulesText: writeRules(RULES.filter((rule) => rule.id !== 'memory-feedback-home')) }), quiet);
  // A note may point to a rule the project declares and the copy does not know yet (Codex, 2bbdd34): its home is there.
  const added = { ...RULES.find((rule) => rule.id === 'session-title'), id: 'brand-new-rule' };
  const pointer = write(noteOf('He never compacts by hand: `rule:brand-new-rule`.'));
  assert.deepEqual(await guard(pointer, { rulesText: writeRules([...RULES, added]) }), quiet);
  assert.match(reasonOf(await guard(pointer)), /names rule:brand-new-rule, which no live rule declares/);
});

test('a feedback note that names a declared rule passes, and one naming only an undeclared rule is denied, naming it', async () => {
  assert.deepEqual(await guard(write(noteOf('Read it in the harness: `rule:restart-announce`.'))), quiet);
  const undeclared = await guard(write(noteOf('Read it in the harness: `rule:compact-never-by-hand`.')));
  assert.match(reasonOf(undeclared), /names rule:compact-never-by-hand, which no live rule declares/);
});

test('a feedback note that quotes a phrase AGENTS.md holds passes; a phrase it lacks, or one too short, is denied', async () => {
  assert.deepEqual(await guard(write(noteOf('Cemented in AGENTS.md: "He never compacts by hand,\there or away"'))), quiet, 'whitespace squashed');
  assert.deepEqual(await guard(write(noteOf('AGENTS.md says “He never compacts by hand”.'))), quiet, 'curly quotes');
  reasonOf(await guard(write(noteOf('AGENTS.md: "the lead compacts it for him"'))));
  reasonOf(await guard(write(noteOf('AGENTS.md: "by hand"'))));
  reasonOf(await guard(write(noteOf('He said "He never compacts by hand, here or away".'))), 'the line names no AGENTS.md');
  reasonOf(await guard(write(noteOf('AGENTS.md: "He never compacts by hand"')), { agents: null }));
});

test('an Edit is judged by the note it leaves, read from disk', async () => {
  const bare = noteOf('He never compacts by hand.');
  const edit = (oldText, newText) => ({ tool_name: 'Edit', tool_input: { file_path: NOTE, old_string: oldText, new_string: newText } });
  assert.deepEqual(await guard(edit('by hand.', 'by hand: `rule:restart-announce`.'), { onDisk: bare }), quiet);
  reasonOf(await guard(edit('by hand.', 'by hand, ever.'), { onDisk: bare }));
  const pointed = noteOf('He never compacts by hand: `rule:restart-announce`.');
  reasonOf(await guard(edit(': `rule:restart-announce`.', '.'), { onDisk: pointed }));
});

test('other notes, the index, other files and a project that does not declare the rule pass, reading nothing', async () => {
  const untouched = { readFile: () => assert.fail('a file read'), projectRoot: () => assert.fail('git asked') };
  const calls = [
    write(noteOf('He never compacts by hand.', 'project')),
    write(noteOf('He is on the Max plan.', 'user')),
    write('He never compacts by hand.\n'),
    write(noteOf('He never compacts by hand.'), 'D:/proj/docs/compact-by-hand.md'),
    write(noteOf('He never compacts by hand.'), NOTE.replace('compact-by-hand.md', 'notes.txt')),
  ];
  for (const payload of calls) {
    const out = [];
    const code = await guardMain(['--hook'], { readStdin: () => JSON.stringify(payload), stdout: (t) => out.push(t), stderr: () => {}, readIndex: () => '', testRun: () => assert.fail('gate lock read'), ...untouched });
    assert.deepEqual({ code, out: out.join('') }, { code: 0, out: '' }, payload.tool_input.file_path);
  }
  assert.deepEqual(await guard(write(noteOf('He never compacts by hand.')), { rulesText: null }), quiet, 'a project that installs the harness');
  const custom = 'D:/claude-config/projects/D--proj/memory/compact-by-hand.md';
  const out = [];
  await guardMain(['--hook'], {
    readStdin: () => JSON.stringify(write(noteOf('He never compacts by hand.'), custom)),
    claudeConfigDir: 'D:/claude-config',
    projectRoot: () => 'D:/project',
    readFile: (file) => (file.replace(/\\/g, '/').endsWith('rules-data.mjs') ? writeRules(RULES) : AGENTS),
    readIndex: () => '',
    stdout: (t) => out.push(t),
    stderr: () => {},
  });
  assert.match(JSON.parse(out.join('')).hookSpecificOutput.permissionDecisionReason, /is a feedback note/, 'under CLAUDE_CONFIG_DIR');
});

test('guard --memory <folder> lists each feedback note with no home and exits 1, and exits 0 when every one has one', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-guard-memory-'));
  try {
    fs.writeFileSync(path.join(folder, 'MEMORY.md'), '- [A](a.md) — a\n');
    fs.writeFileSync(path.join(folder, 'homed.md'), noteOf('`rule:restart-announce`'));
    fs.writeFileSync(path.join(folder, 'plan.md'), noteOf('He is on the Max plan.', 'user'));
    fs.writeFileSync(path.join(folder, 'bare.md'), noteOf('He never compacts by hand.'));
    const found = await guard(null, { args: ['--memory', folder] });
    assert.equal(found.code, 1);
    assert.equal(found.out, 'bare.md: a feedback note that names no home of its rule in the repository\n');
    fs.writeFileSync(path.join(folder, 'bare.md'), noteOf('AGENTS.md: "He never compacts by hand"'));
    assert.deepEqual(await guard(null, { args: ['--memory', folder] }), { code: 0, out: 'every feedback note names its home (2 feedback notes)\n', err: '' });
    // A rule the project declares and this copy does not know yet is a home (odd/tasks/behind-copy-guard.md, L3).
    const added = writeRules([...RULES, { ...RULES.find((rule) => rule.id === 'session-title'), id: 'brand-new-rule' }]);
    fs.writeFileSync(path.join(folder, 'bare.md'), noteOf('He never compacts by hand: `rule:brand-new-rule`.'));
    assert.deepEqual(await guard(null, { args: ['--memory', folder], rulesText: added }), { code: 0, out: 'every feedback note names its home (2 feedback notes)\n', err: '' });
    assert.equal((await guard(null, { args: ['--memory', folder] })).out, 'bare.md: a feedback note that names no home of its rule in the repository\n');
    fs.writeFileSync(path.join(folder, 'bare.md'), noteOf('AGENTS.md: "He never compacts by hand"'));
    const off =await guard(null, { args: ['--memory', folder], rulesText: null });
    assert.deepEqual(off, { code: 0, out: 'rule memory-feedback-home is not in force in this project: nothing checked\n', err: '' });
    fs.mkdirSync(path.join(folder, 'folder.md'));
    const unreadable = await guard(null, { args: ['--memory', folder] });
    assert.equal(unreadable.code, 1);
    assert.match(unreadable.out, /^folder\.md: cannot be read \(EISDIR\), so its home is not known\n$/);
    const none = await guard(null, { args: ['--memory', path.join(folder, 'missing')] });
    assert.equal(none.code, 1);
    assert.match(none.err, /cannot read the memory folder/);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
