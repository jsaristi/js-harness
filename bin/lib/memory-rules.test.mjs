import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MEMORY_RULES_FIX, memoryNoteType, memoryRulesState } from './memory-rules.mjs';
import { projectSlug } from './sessions.mjs';
import { PROTOCOLS } from './protocols-skill.mjs';

// Not a repository as far as the fake git says, so the project is the folder itself, as for Claude Code.
const noGit = () => ({ status: 128, stdout: '', stderr: 'not a git repository' });

function machine() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-memory-rules-'));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  const memory = path.join(home, '.claude', 'projects', projectSlug(project), 'memory');
  const note = (name, front) => {
    fs.mkdirSync(memory, { recursive: true });
    fs.writeFileSync(path.join(memory, name), `---\n${front}\n---\n\nThe body.\n`);
  };
  return { home, project, memory, note, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('the type is read from the front matter, at the top or under metadata as this host writes it', () => {
  assert.equal(memoryNoteType('---\nname: a\ntype: feedback\n---\nbody'), 'feedback');
  assert.equal(memoryNoteType('---\nname: a\nmetadata:\n  node_type: memory\n  type: project\n---\n'), 'project');
  assert.equal(memoryNoteType('---\r\nname: a\r\nmetadata:\r\n  type: reference\r\n---\r\n'), 'reference');
  // Outside the front matter, or with none, there is no type.
  assert.equal(memoryNoteType('---\nname: a\n---\ntype: feedback\n'), null);
  assert.equal(memoryNoteType('type: feedback\n'), null);
});

test('notes of type feedback and project are the gap, one line each; user and reference notes and the index are left', () => {
  const m = machine();
  try {
    m.note('rule-b.md', 'name: rule-b\nmetadata:\n  type: feedback');
    m.note('decision-a.md', 'name: decision-a\ntype: project');
    m.note('who.md', 'name: who\ntype: user');
    m.note('link.md', 'name: link\nmetadata:\n  type: reference');
    fs.writeFileSync(path.join(m.memory, 'MEMORY.md'), '- [Rule](rule-b.md) — type: feedback\n');
    fs.writeFileSync(path.join(m.memory, 'notes.txt'), 'type: feedback');
    const state = memoryRulesState({ home: m.home, project: m.project, spawn: noGit, env: {} });
    assert.deepEqual(state, { claude: 'stale', codex: 'n/a', lines: ['decision-a.md (project)', 'rule-b.md (feedback)'] });
  } finally {
    m.done();
  }
});

test('no such note is ok, no memory folder is n/a, and a folder that cannot be read is unknown', () => {
  const m = machine();
  try {
    assert.deepEqual(memoryRulesState({ home: m.home, project: m.project, spawn: noGit, env: {} }), { claude: 'n/a', codex: 'n/a', lines: [] });
    m.note('who.md', 'name: who\ntype: user');
    assert.deepEqual(memoryRulesState({ home: m.home, project: m.project, spawn: noGit, env: {} }), { claude: 'ok', codex: 'n/a', lines: [] });
    const boom = () => {
      throw new Error('made up');
    };
    assert.deepEqual(memoryRulesState({ home: m.home, project: m.project, spawn: boom, env: {} }), { claude: 'unknown', codex: 'n/a', lines: [] });
  } finally {
    m.done();
  }
});

test('from a linked worktree the notes are the main checkout\'s, where Claude Code keeps one memory for the repository', () => {
  const m = machine();
  try {
    m.note('rule.md', 'name: rule\ntype: feedback');
    const worktree = path.join(path.dirname(m.project), 'worktrees', 'feature');
    const common = path.join(m.project, '.git');
    const git = (command, args) => (args.includes('--git-common-dir') ? { status: 0, stdout: `${common}\n`, stderr: '' } : noGit());
    assert.deepEqual(memoryRulesState({ home: m.home, project: worktree, spawn: git, env: {} }).lines, ['rule.md (feedback)']);
  } finally {
    m.done();
  }
});

test('the fix names the protocol and the order of places, then the deletion of the note', () => {
  // The protocol's home is section 4 of the protocols skill (T16g); "recording a new rule" is the name it replaced.
  assert.ok(MEMORY_RULES_FIX.includes(`"${PROTOCOLS[3]}" of the js-harness-protocols skill`), MEMORY_RULES_FIX);
  assert.doesNotMatch(MEMORY_RULES_FIX, /recording a new rule/);
  assert.match(MEMORY_RULES_FIX, /delete the note/);
});

// Launch audit C-c-3: doctor's memory-rules row reads the folder the host writes, under CLAUDE_CONFIG_DIR when it is set.
test('the memory folder is read under CLAUDE_CONFIG_DIR when the host sets it', () => {
  const m = machine();
  try {
    const config = path.join(m.home, 'config');
    const memory = path.join(config, 'projects', projectSlug(m.project), 'memory');
    fs.mkdirSync(memory, { recursive: true });
    fs.writeFileSync(path.join(memory, 'rule.md'), '---\nname: rule\ntype: feedback\n---\n');
    const env = { CLAUDE_CONFIG_DIR: config };
    assert.deepEqual(memoryRulesState({ home: m.home, project: m.project, spawn: noGit, env }).lines, ['rule.md (feedback)']);
    assert.equal(memoryRulesState({ home: m.home, project: m.project, spawn: noGit, env: {} }).claude, 'n/a');
  } finally {
    m.done();
  }
});
