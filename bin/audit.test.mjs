import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditMain } from './audit.mjs';
import { projectSlug } from './lib/sessions.mjs';

// A project folder and a Claude Code records folder for it, under a temporary home; git answers nothing, so the
// project is the folder itself and it has no worktree.
function fixture(t, transcripts) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  const records = path.join(home, 'claude', 'projects', projectSlug(path.resolve(project)));
  fs.mkdirSync(records, { recursive: true });
  for (const [name, entries] of Object.entries(transcripts)) {
    fs.writeFileSync(path.join(records, `${name}.jsonl`), `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
  }
  return { project, env: { CLAUDE_CONFIG_DIR: path.join(home, 'claude') } };
}

const reply = (timestamp, { text, tokens = 200000, tools = [] }) => ({
  type: 'assistant',
  timestamp,
  message: {
    model: 'claude-opus-5-5',
    usage: { input_tokens: 10, cache_read_input_tokens: tokens - 10, cache_creation_input_tokens: 0, output_tokens: 5 },
    content: [...(text === undefined ? [] : [{ type: 'text', text }]), ...tools],
  },
});
const send = (message) => ({ type: 'tool_use', id: 't1', name: 'mcp__ccd_session_mgmt__send_message', input: { session_id: 'local_x', message } });

async function run(argv, { project, env }) {
  const out = [];
  const err = [];
  const code = await auditMain(argv, env, {
    cwd: project,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    run: () => ({ status: 128, stdout: '', stderr: 'not a git repository' }),
    homedir: () => '/nowhere',
    now: () => Date.parse('2026-10-15T20:00:00.000Z'),
    offsetMinutes: 0,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const TRANSCRIPTS = {
  'aaaaaaaa-1111': [
    { type: 'custom-title', customTitle: 'JH 15 · audit' },
    reply('2026-10-15T08:06:30.000Z', { tools: [send('From JH 15, 08:06 local. Right hour.')] }),
    reply('2026-10-15T08:20:00.000Z', { tools: [send('From JH 15, 08:06 local. Wrong hour.')] }),
    reply('2026-10-15T08:21:00.000Z', { text: 'Contexto: 30 %.', tokens: 300000 }),
    reply('2026-10-15T08:22:00.000Z', { text: 'Contexto: 60 %.', tokens: 300000 }),
    // The day before: not today's.
    reply('2026-10-14T08:20:00.000Z', { tools: [send('From JH 15, 01:00 local. Yesterday.')] }),
  ],
  'bbbbbbbb-2222': [
    reply('2026-10-15T09:00:00.000Z', { text: 'Nothing to check here.' }),
  ],
};

test('audit prints, per session of the day, the messages, the stamped hours and the stated shares, with each wrong one at its line', async (t) => {
  const { code, out, err } = await run([], fixture(t, TRANSCRIPTS));
  assert.equal(err, '');
  assert.equal(code, 0);
  assert.match(out, /local day 2026-10-15 \(UTC\+00:00\)/);
  assert.match(out, /aaaaaaaa\s+JH 15 · audit\s+2\s+2\s+1\s+2\s+1/);
  assert.doesNotMatch(out, /bbbbbbbb/, 'a session with nothing to check is not listed');
  assert.match(out, /aaaaaaaa-1111:3\s+stamped 08:06, sent 08:20/);
  assert.match(out, /aaaaaaaa-1111:4\s+stated 30%, recorded 60%/);
  assert.doesNotMatch(out, /:5\s+stated/);
});

test('audit counts lines as the transcript writes them: a line separator inside a JSON string splits no line', async (t) => {
  // JSON leaves U+2028 and U+2029 unescaped, and Node's readline ends a line at each (seen in this project's records).
  const separator = String.fromCharCode(0x2028);
  const { code, out } = await run(['--json'], fixture(t, {
    'cccccccc-3333': [
      reply('2026-10-15T08:00:00.000Z', { text: `a quoted${separator}separator` }),
      reply('2026-10-15T08:20:00.000Z', { text: `Contexto: 30 %.${String.fromCharCode(0x2029)}`, tokens: 300000 }),
      reply('2026-10-15T08:20:00.000Z', { tools: [send('From JH 15, 08:06 local. Wrong hour.')] }),
    ],
  }));
  assert.equal(code, 0);
  const [session] = JSON.parse(out).sessions;
  assert.deepEqual(session.wrongShares, [{ line: 2, stated: 30, recorded: 60 }]);
  assert.deepEqual(session.wrongHours, [{ line: 3, stamped: '08:06', sent: '08:20' }]);
});

test('audit takes a share of the window the session\'s get_usage read gave, a read of the day before included, and names the sessions no read gave one', async (t) => {
  const usage = {
    type: 'user',
    timestamp: '2026-10-14T23:00:00.000Z',
    message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: [{ type: 'text', text: JSON.stringify({ context: { session: 'self', contextWindow: 300000 } }) }] }] },
  };
  const where = fixture(t, {
    'dddddddd-4444': [usage, reply('2026-10-15T08:00:00.000Z', { text: 'Contexto: 50 %.', tokens: 150000 })],
    'eeeeeeee-5555': [reply('2026-10-15T08:00:00.000Z', { text: 'Contexto: 50 %.', tokens: 150000 })],
  });
  const json = JSON.parse((await run(['--json'], where)).out);
  assert.deepEqual(json.sessions.map((s) => [s.session, s.windowRead, s.wrongShares.length]), [['dddddddd-4444', true, 0], ['eeeeeeee-5555', false, 1]]);
  const { out } = await run([], where);
  assert.match(out, /1 session whose window no get_usage read gave: its shares are taken of 500,000 tokens \(eeeeeeee\)/);
});

test('audit --json gives the same counts', async (t) => {
  const { code, out } = await run(['--json'], fixture(t, TRANSCRIPTS));
  assert.equal(code, 0);
  const data = JSON.parse(out);
  assert.equal(data.from, '2026-10-15');
  assert.deepEqual(data.sessions.map((s) => [s.session, s.title, s.messages, s.stamped, s.wrongHours.length, s.shares, s.wrongShares.length]), [
    ['aaaaaaaa-1111', 'JH 15 · audit', 2, 2, 1, 2, 1],
  ]);
});

test('audit --day reads another day', async (t) => {
  const { code, out } = await run(['--day', '2026-10-14', '--json'], fixture(t, TRANSCRIPTS));
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out).sessions.map((s) => [s.stamped, s.wrongHours.length]), [[1, 1]]);
});

test('audit refuses an unknown argument or a bad day with exit 2 and its usage', async (t) => {
  const where = fixture(t, TRANSCRIPTS);
  for (const argv of [['--nope'], ['--day', '2026-02-30'], ['--days', '9']]) {
    const { code, err } = await run(argv, where);
    assert.equal(code, 2, argv.join(' '));
    assert.match(err, /Usage: js-harness audit/);
  }
});

test('audit exits 1 when the project has no records folder', async (t) => {
  const where = fixture(t, {});
  fs.rmSync(path.join(where.env.CLAUDE_CONFIG_DIR, 'projects'), { recursive: true });
  const { code, err } = await run([], where);
  assert.equal(code, 1);
  assert.match(err, /no Claude Code records folder/);
});
