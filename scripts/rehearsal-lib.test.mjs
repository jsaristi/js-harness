import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REHEARSAL, ROWS, ALWAYS, FOREIGN_TOOLS, ENGRAM_CONTEXT_LIMIT, COST_STOP, PLANTED_RULE, importRowState,
  recordedPaths, restoreProblems, foreignProblems, engramRecoveryProblem, plantedRuleFiles, directiveProblem, costProblem,
} from './rehearsal-lib.mjs';

// No test here starts a process or touches the disk: every fact is handed in, and the platform is a parameter.

test('REHEARSAL walks each of the nine rows of 11.1, each step once, and proves the real home last', () => {
  const ids = REHEARSAL.map((step) => step.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(ROWS).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const [row, id] of Object.entries(ROWS)) assert.ok(ids.includes(id), `row ${row} names ${id}, which the walk lacks`);
  for (const id of ['guide', 'engram-start', 'engram-compact', 'import-row', 'directive', 'uninstall-project', 'uninstall-machine', 'recorded-paths', 'foreign-absent']) {
    assert.ok(ids.includes(id), `the walk lacks ${id}`);
  }
  assert.ok(ids.indexOf('uninstall-machine') > ids.indexOf('uninstall-project'));
  assert.ok(ids.indexOf('recorded-paths') > ids.indexOf('uninstall-machine'));
  assert.equal(ids.at(-1), 'real-home-after');
  assert.ok(ALWAYS.includes('real-home-after'));
  for (const step of REHEARSAL) assert.ok(Object.isFrozen(step) && step.title.length > 0);
});

test('recordedPaths finds every path a manifest records, at any depth, from its base, once each', () => {
  const machine = JSON.stringify({
    files: [{ path: 'C:\\s\\home\\.claude\\skills\\a\\SKILL.md' }],
    entries: [{ path: 'C:\\s\\home\\.claude\\settings.json', pointer: ['hooks'] }, { path: 'C:\\s\\home\\.claude\\settings.json' }],
    permissions: { path: 'C:\\S\\HOME\\.claude\\settings.json' },
    rulesBlock: { path: 'C:\\s\\home\\.claude\\CLAUDE.md', createdFile: true },
  });
  assert.deepEqual(recordedPaths(machine, 'C:\\s\\home', 'win32'), [
    'C:\\s\\home\\.claude\\CLAUDE.md',
    'C:\\s\\home\\.claude\\settings.json',
    'C:\\s\\home\\.claude\\skills\\a\\SKILL.md',
  ]);
  const project = JSON.stringify({ files: [{ path: 'AGENTS.md' }, { path: '.git/hooks/pre-push' }], dirs: [{ path: 'docs' }], settings: [{ path: '.claude/settings.local.json' }] });
  assert.deepEqual(recordedPaths(project, '/s/project', 'linux'), ['/s/project/.claude/settings.local.json', '/s/project/.git/hooks/pre-push', '/s/project/AGENTS.md', '/s/project/docs']);
});

test('recordedPaths reads nothing from a manifest that is missing or no JSON', () => {
  assert.deepEqual(recordedPaths(undefined, '/s', 'linux'), []);
  assert.deepEqual(recordedPaths('{', '/s', 'linux'), []);
});

test('restoreProblems passes a path gone or back to its bytes, and names each one left, changed or removed', () => {
  const before = { '/h/kept.json': 'aa', '/h/edited.json': 'bb', '/h/his.md': 'cc' };
  const after = { '/h/kept.json': 'aa', '/h/edited.json': 'b2', '/h/new.md': 'dd' };
  assert.deepEqual(restoreProblems(before, after, ['/h/kept.json', '/h/gone.md'], 'linux'), []);
  assert.deepEqual(restoreProblems(before, after, ['/h/kept.json', '/h/edited.json', '/h/his.md', '/h/new.md'], 'linux'), [
    'changed: /h/edited.json was there before the walk and its bytes differ',
    'removed: /h/his.md was there before the walk and is gone',
    'left: /h/new.md was written by the walk and is still there',
  ]);
});

test('restoreProblems takes a Windows path in any case as one file', () => {
  assert.deepEqual(restoreProblems({ 'c:\\h\\a.json': 'aa' }, { 'C:\\H\\A.json': 'aa' }, ['C:\\h\\A.JSON'], 'win32'), []);
});

test('foreignProblems names a program of gentle-ai, Orca or herdr on the PATH or among the commands run', () => {
  assert.deepEqual(FOREIGN_TOOLS, ['gentle-ai', 'orca', 'herdr']);
  assert.deepEqual(foreignProblems({ commands: [['git', 'push'], ['C:\\bin\\claude.cmd', 'mcp', 'list']], pathFiles: ['git.cmd', 'node.exe', 'orchestrate.cmd'] }), []);
  assert.deepEqual(foreignProblems({ commands: [['C:\\x\\gentle-ai.exe', 'review', 'start'], ['git', 'herdr']], pathFiles: ['Orca.CMD', 'gentle-ai'] }), [
    'the walk ran gentle-ai: C:\\x\\gentle-ai.exe review start',
    'the walk ran herdr: git herdr',
    'the walk\'s PATH holds orca: Orca.CMD',
    'the walk\'s PATH holds gentle-ai: gentle-ai',
  ]);
});

test('engramRecoveryProblem passes a hook output that holds the planted observation within the limit', () => {
  assert.equal(ENGRAM_CONTEXT_LIMIT, 16384);
  assert.equal(engramRecoveryProblem('## Memory\n- planted-s13-7f3a: the scratch fact\n', 'planted-s13-7f3a'), null);
  assert.match(engramRecoveryProblem('## Memory\n- nothing here\n', 'planted-s13-7f3a'), /does not hold the planted observation planted-s13-7f3a/);
  assert.match(engramRecoveryProblem(`planted-s13-7f3a ${'x'.repeat(16384)}`, 'planted-s13-7f3a'), /16401 bytes, past the 16384/);
  assert.match(engramRecoveryProblem('', 'planted-s13-7f3a'), /printed nothing/);
});

test('plantedRuleFiles writes the rule\'s phrase in a file of the project\'s own and declares it with no control', () => {
  const files = plantedRuleFiles();
  assert.deepEqual(Object.keys(files), ['docs/conventions.md', 'docs/rules.json']);
  assert.equal(files['docs/conventions.md'], `# Conventions\n\n- ${PLANTED_RULE.phrase}.\n`);
  const { format, rules } = JSON.parse(files['docs/rules.json']);
  assert.equal(format, 1);
  assert.deepEqual(rules, [{ id: PLANTED_RULE.id, subject: PLANTED_RULE.subject, since: PLANTED_RULE.since, path: 'docs/conventions.md', phrases: [PLANTED_RULE.phrase] }]);
  assert.equal('control' in rules[0], false);
});

test('directiveProblem passes only an exit 1 that names the planted rule\'s missing control', () => {
  const finding = `FAIL  rules  1 finding\n      rule "${PLANTED_RULE.id}": no control: it names a check, an eval case, a line, a protocol, a measurement or a dated owed (the project's baseline is 2026-10-29)\n`;
  assert.equal(directiveProblem({ code: 1, stdout: finding }), null);
  assert.match(directiveProblem({ code: 0, stdout: 'PASS  rules  1 rule of the project holds\n' }), /exited 0, not 1/);
  assert.match(directiveProblem({ code: 1, stdout: `FAIL  rules  1 finding\n      rule "${PLANTED_RULE.id}": AGENTS.md no longer holds the phrase\n` }), /does not name the missing control/);
});

test('importRowState reads the project cell of doctor\'s claude-import row, and absent when there is none', () => {
  assert.equal(importRowState(JSON.stringify([{ id: 'engram', project: 'ok' }, { id: 'claude-import', project: 'mismatch' }])), 'mismatch');
  assert.equal(importRowState(JSON.stringify([{ id: 'engram', project: 'ok' }])), 'absent');
  assert.equal(importRowState('not json'), 'absent');
});

test('costProblem stops a run past 1.5 times its estimate', () => {
  assert.equal(COST_STOP, 1.5);
  assert.equal(costProblem({ estimate: 2, actual: 3 }), null);
  assert.match(costProblem({ estimate: 2, actual: 3.1 }), /\$3\.10 is 1\.55 times the estimate of \$2\.00, past 1\.5/);
});
