import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendReading, newReading } from './channel.mjs';
import { agentOnlyWaits } from './merge-queue-refresh-now.mjs';

// Whether a session the land's refresh finds busy only waits, read from its transcript (agentOnlyWaits). Transcripts
// and the channel are written in a scratch home.
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const NOW = Date.parse('2026-10-29T17:00:00.000Z');
const at = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const base = (time, cwd = 'D:\\proj') => ({ timestamp: time, cwd, gitBranch: 'main', isSidechain: false });
const titled = (title) => ({ type: 'custom-title', customTitle: title, sessionId: 's' });
const call = (id, command, time) => ({ type: 'assistant', ...base(time), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'Bash', input: { command, description: 'made up', run_in_background: true } }] } });
const launched = (id, task, time) => ({ type: 'user', ...base(time), toolUseResult: { stdout: '', stderr: '', backgroundTaskId: task }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const waiting = (command, ...head) => [...head, call('t1', command, at(30)), launched('t1', 'b1', at(30))].map((entry) => JSON.stringify(entry)).join('\n') + '\n';

function machine() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-refresh-now-'));
  made.push(root);
  const claudeHome = path.join(root, 'claude');
  const home = path.join(root, 'harness');
  const write = (slug, id, text) => {
    fs.mkdirSync(path.join(claudeHome, 'projects', slug), { recursive: true });
    fs.writeFileSync(path.join(claudeHome, 'projects', slug, `${id}.jsonl`), text);
  };
  write('D--js-harness', 'main-1', waiting('js-harness wait --pr 674', titled('JH 86 · rules and evals')));
  write('D--js-harness--claude-worktrees-f8', 'tree-1', waiting('js-harness wait --notice-to 85', titled('JH 85 · follow-ups')));
  write('D--js-harness', 'phone-1', waiting('js-harness wait --main-has 1c6b6c2'));
  write('D--other', 'other-1', waiting('js-harness wait --pr 12', titled('JH 3 · other work')));
  // A worktree of another project: its channel is its main checkout's, read from the cwd its transcript ran in.
  write('D--other--claude-worktrees-x', 'other-2', waiting('js-harness wait --pr 13', { type: 'user', ...base(at(31), 'D:\\other\\.claude\\worktrees\\x'), origin: { kind: 'human' }, message: { role: 'user', content: 'go' } }, titled('JH 4 · other tree')));
  // A worktree of this project git no longer lists, its folder still there: this project's channel, by its cwd.
  write('D--js-harness--claude-worktrees-gone', 'gone-1', waiting('js-harness wait --pr 14', { type: 'user', ...base(at(31), 'D:\\js-harness\\.claude\\worktrees\\gone'), origin: { kind: 'human' }, message: { role: 'user', content: 'go' } }, titled('JH 5 · landed tree')));
  // A worktree of another project that is gone: its channel cannot be known.
  write('D--else--claude-worktrees-y', 'else-1', waiting('js-harness wait --pr 15', { type: 'user', ...base(at(31), 'D:\\else\\.claude\\worktrees\\y'), origin: { kind: 'human' }, message: { role: 'user', content: 'go' } }, titled('JH 6 · lost tree')));
  appendReading(home, 'D--js-harness', newReading({ at: at(40), reader: { id: 'phone-1' }, title: 'JH 84 · from the phone' }));
  return { claudeHome, home, here: { slug: 'D--js-harness', root: 'D:\\js-harness', dirs: [path.join(claudeHome, 'projects', 'D--js-harness'), path.join(claudeHome, 'projects', 'D--js-harness--claude-worktrees-f8')] } };
}

// JH 131 (odd/tasks/defect-trio.md, spec 3): the land's refresh reads a busy session's transcript by the id and folder
// claude agents gives, as JH 130's was on 2026-11-02 under D--js-harness--claude-worktrees-e3-answers.
test('agentOnlyWaits reads the transcript claude agents names, by its folder or by its id, and says no when it finds none', () => {
  const { claudeHome } = machine();
  const id = 'd7b86460-7e86-436a-90ca-adaad612aa80';
  const replied = { type: 'assistant', ...base(at(29)), message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Esperando.' }] } };
  const folder = path.join(claudeHome, 'projects', 'D--js-harness--claude-worktrees-e3-answers');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${id}.jsonl`), `${waiting('js-harness wait --notice-to 130')}${JSON.stringify(replied)}\n`);
  assert.equal(agentOnlyWaits({ sessionId: id, cwd: 'D:\\js-harness\\.claude\\worktrees\\e3-answers' }, { claudeHome }), true);
  assert.equal(agentOnlyWaits({ sessionId: id, cwd: 'D:\\moved' }, { claudeHome }), true, 'found by its id in another folder');
  // A transcript of open work and no reply after it is a session at work.
  assert.equal(agentOnlyWaits({ sessionId: 'main-1', cwd: 'D:\\js-harness' }, { claudeHome }), false);
  // None found, or no id that names a file: at work, since it cannot be read.
  for (const sessionId of ['ffffffff-0000-4000-8000-000000000000', '../D--js-harness/main-1', undefined]) {
    assert.equal(agentOnlyWaits({ sessionId, cwd: 'D:\\js-harness' }, { claudeHome }), false, String(sessionId));
  }
});
