import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readRecords, recordFolders } from './subagent-records.mjs';
import { projectSlug } from './sessions.mjs';

const SECRET = 'SECRET-PLANTED-5b1c';
const jsonl = (entries) => `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;

/** A config folder with the records of a main checkout and one worktree, and a third worktree with none; `run`
 * answers git as that main checkout. */
function makeConfig() {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-subagent-records-'));
  const main = path.join(config, 'project');
  const tree = path.join(config, 'project-tree');
  const bare = path.join(config, 'project-none');
  for (const folder of [main, tree]) fs.mkdirSync(path.join(config, 'projects', projectSlug(folder)), { recursive: true });
  const run = (command, args) => {
    if (args[0] === 'rev-parse') return { status: 0, stdout: `${path.join(main, '.git')}\n` };
    if (args[0] === 'worktree') return { status: 0, stdout: [main, tree, bare].map((folder) => `worktree ${folder}\nHEAD abc\n`).join('\n') };
    return { status: 1, stdout: '' };
  };
  return { config, main, tree, run, folder: (dir) => path.join(config, 'projects', projectSlug(dir)), cleanup: () => fs.rmSync(config, { recursive: true, force: true }) };
}

test('the record folders are the main checkout\'s and each worktree\'s that can be listed, under the config folder', () => {
  const made = makeConfig();
  try {
    const folders = recordFolders({ cwd: made.tree, env: { CLAUDE_CONFIG_DIR: made.config }, homedir: () => assert.fail('no home is read'), run: made.run });
    assert.deepEqual(folders, [made.folder(made.main), made.folder(made.tree)]);
    // git failing with output still in stdout: the folders of a failed listing are not read as worktrees.
    const failing = (command, args) => (args[0] === 'worktree' ? { status: 128, stdout: made.run(command, args).stdout } : made.run(command, args));
    assert.deepEqual(recordFolders({ cwd: made.main, env: { CLAUDE_CONFIG_DIR: made.config }, homedir: () => '', run: failing }), [made.folder(made.main)], 'no git: the folder of cwd alone');
  } finally {
    made.cleanup();
  }
});

test('the records read are the sessions\' usage in the window, their calls and each sub-agent\'s entries, with no text of a message', async () => {
  const made = makeConfig();
  try {
    const folder = made.folder(made.main);
    fs.writeFileSync(path.join(folder, 's1.jsonl'), [
      JSON.stringify({ type: 'assistant', timestamp: '2026-10-14T14:01:00Z', message: { id: 'p1', model: 'claude-opus-5-5', usage: { input_tokens: 300, output_tokens: 3 }, content: [{ type: 'tool_use', id: 't1', name: 'Agent', input: { description: SECRET, prompt: SECRET } }] } }),
      '{not json',
      JSON.stringify({ type: 'assistant', timestamp: '2026-10-13T14:01:00Z', message: { id: 'p0', model: 'claude-opus-5-5', usage: { input_tokens: 9999, output_tokens: 1 } } }),
      '',
    ].join('\n'));
    const agents = path.join(folder, 's1', 'subagents');
    fs.mkdirSync(agents, { recursive: true });
    fs.writeFileSync(path.join(agents, 'agent-a1.jsonl'), jsonl([{ type: 'assistant', timestamp: '2026-10-14T14:02:00Z', effort: 'high', message: { id: 'm1', model: 'claude-haiku-5-5', usage: { input_tokens: 100, output_tokens: 1 }, content: [{ type: 'text', text: SECRET }] } }]));
    fs.writeFileSync(path.join(agents, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'Explore', toolUseId: 't1' }));
    fs.writeFileSync(path.join(agents, 'agent-a2.jsonl'), jsonl([]));
    const read = await readRecords([folder], { since: 0, inWindow: (timestamp) => timestamp.startsWith('2026-10-14') });
    assert.equal(read.calls.has('t1'), true);
    assert.deepEqual([read.sessions.input, read.sessions.messages], [300, 1], 'the session\'s usage inside the window only, not the 9999 of the day before');
    assert.deepEqual(read.records.map(({ session, agentId, meta }) => [session, agentId, meta.agentType ?? null]).sort((x, y) => x[1].localeCompare(y[1])), [['s1', 'a1', 'Explore'], ['s1', 'a2', null]]);
    assert.deepEqual(read.records.find((one) => one.agentId === 'a1').entries, [{ type: 'assistant', timestamp: '2026-10-14T14:02:00Z', requestId: undefined, effort: 'high', message: { id: 'm1', model: 'claude-haiku-5-5', usage: { input_tokens: 100, output_tokens: 1 } } }]);
    assert.equal(JSON.stringify(read.records).includes(SECRET), false);
    const later = await readRecords([folder], { since: Date.now() + 3600_000, inWindow: () => true });
    assert.deepEqual(later.records, [], 'a file changed before `since` is not read');
  } finally {
    made.cleanup();
  }
});
