import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendReading, newReading } from './channel.mjs';
import { openSessions } from './merge-queue-refresh-now.mjs';

// Whose waits `merge-queue --refresh-copy` stops (S5 of odd/tasks/lead-manual-steps.md): the installed copy is the
// machine's, so the sessions are read from every project's transcripts, and a session opened from the phone, whose
// transcript holds no title, is named by the opening it read. Transcripts and the channel are written in a scratch
// home.
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const NOW = Date.parse('2026-10-29T17:00:00.000Z');
const at = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const base = (time) => ({ timestamp: time, cwd: 'D:\\proj', gitBranch: 'main', isSidechain: false });
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
  appendReading(home, 'D--js-harness', newReading({ at: at(40), reader: { id: 'phone-1' }, title: 'JH 84 · from the phone' }));
  return { claudeHome, home, here: { slug: 'D--js-harness', dirs: [path.join(claudeHome, 'projects', 'D--js-harness'), path.join(claudeHome, 'projects', 'D--js-harness--claude-worktrees-f8')] } };
}

test("openSessions reads every project's open sessions, each with its channel's slug, a phone's named by its reading", () => {
  const found = openSessions({ ...machine(), now: () => NOW });
  const brief = found.map(({ title, slug, waits }) => [title, slug, waits]).sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(brief, [
    ['JH 3 · other work', 'D--other', ['js-harness wait --pr 12']],
    ['JH 84 · from the phone', 'D--js-harness', ['js-harness wait --main-has 1c6b6c2']],
    ['JH 85 · follow-ups', 'D--js-harness', ['js-harness wait --notice-to 85']],
    ['JH 86 · rules and evals', 'D--js-harness', ['js-harness wait --pr 674']],
  ]);
});

test('openSessions reads none when the projects folder is missing', () => {
  const { home, here } = machine();
  assert.deepEqual(openSessions({ claudeHome: path.join(home, 'none'), home, here, now: () => NOW }), []);
});
