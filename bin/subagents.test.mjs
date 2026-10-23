import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { subagentsMain } from './subagents.mjs';
import { projectSlug } from './lib/sessions.mjs';

const BOGOTA = -300;
const NOW = Date.parse('2026-10-14T20:00:00Z'); // 15:00 in Bogotá
const SECRET = 'SECRET-PLANTED-7f3a';

const jsonl = (entries) => `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
const answer = (id, model, at, input, extra = {}) => ({ type: 'assistant', timestamp: at, effort: 'high', message: { id, model, usage: { input_tokens: input, output_tokens: 1 }, content: [{ type: 'text', text: SECRET }] }, ...extra });

/** A config folder whose project records hold one session that launched two sub-agents on 2026-10-14 and
 * one the day before, with the secret in every message and description; `run` answers git as a main
 * checkout with no other worktree. */
function makeRecords() {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-subagents-'));
  const main = path.join(config, 'project');
  const folder = path.join(config, 'projects', projectSlug(main));
  const agents = path.join(folder, 's1', 'subagents');
  fs.mkdirSync(agents, { recursive: true });
  fs.writeFileSync(path.join(folder, 's1.jsonl'), jsonl([
    { type: 'user', timestamp: '2026-10-14T14:00:00Z', message: { role: 'user', content: SECRET } },
    { type: 'assistant', timestamp: '2026-10-14T14:01:00Z', message: { id: 'p1', model: 'claude-opus-5-5', usage: { input_tokens: 300, output_tokens: 3 }, content: [
      { type: 'tool_use', id: 't1', name: 'Agent', input: { description: `Write ${SECRET}`, model: 'haiku', effort: 'high', prompt: SECRET } },
      { type: 'tool_use', id: 't2', name: 'Agent', input: { description: 'Map things', prompt: SECRET } },
    ] } },
    { type: 'assistant', timestamp: '2026-10-13T14:01:00Z', message: { id: 'p0', model: 'claude-opus-5-5', usage: { input_tokens: 9999, output_tokens: 1 } } },
  ]));
  const agent = (id, meta, entries) => {
    fs.writeFileSync(path.join(agents, `agent-${id}.jsonl`), jsonl(entries));
    fs.writeFileSync(path.join(agents, `agent-${id}.meta.json`), JSON.stringify(meta));
  };
  agent('a1', { agentType: 'general-purpose', description: `Write ${SECRET}`, toolUseId: 't1', model: 'haiku', effort: 'high' }, [answer('m1', 'claude-haiku-5-5', '2026-10-14T14:02:00Z', 100), answer('m1', 'claude-haiku-5-5', '2026-10-14T14:02:01Z', 100)]);
  agent('a2', { agentType: 'Explore', description: 'Map things', toolUseId: 't2', effort: 'high' }, [answer('m2', 'claude-opus-5-5', '2026-10-14T14:03:00Z', 100)]);
  agent('a0', { agentType: 'general-purpose', description: 'Fix old', toolUseId: 'gone', effort: 'high' }, [answer('m0', 'claude-haiku-5-5', '2026-10-13T14:03:00Z', 5000)]);
  const run = (command, args) => {
    if (args[0] === 'rev-parse') return { status: 0, stdout: `${path.join(main, '.git')}\n` };
    if (args[0] === 'worktree') return { status: 0, stdout: `worktree ${main}\nHEAD abc\nbranch refs/heads/main\n\n` };
    return { status: 1, stdout: '' };
  };
  return { config, main, run, cleanup: () => fs.rmSync(config, { recursive: true, force: true }) };
}

async function subagents(argv, records) {
  const out = [];
  const err = [];
  const code = await subagentsMain(argv, { CLAUDE_CONFIG_DIR: records.config }, {
    cwd: records.main, stdout: (line) => out.push(line), stderr: (line) => err.push(line), run: records.run, now: () => NOW, offsetMinutes: BOGOTA,
  });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

test('subagents counts the day\'s launches by role, model and efforts, with tokens and their share', async () => {
  const records = makeRecords();
  try {
    const { code, stdout, stderr } = await subagents([], records);
    assert.equal(code, 0, stderr);
    const lines = stdout.split('\n');
    assert.match(lines[0], /^Sub-agents, local day 2026-10-14 \(UTC-05:00\), 1 record folder; Claude records only, Codex not counted$/);
    assert.match(stdout, /^writer\s+claude-haiku-5-5\s+high\/high\s+1\s+100\s/m);
    assert.match(stdout, /^explorer\s+claude-opus-5-5\s+-\/high\s+1\s+100\s/m);
    assert.match(stdout, /^total\s+2\s+200\s/m);
    assert.match(stdout, /share of the day's tokens: input 40%/, 'sub-agents 200 of 500: the session\'s 300 of that day, not the 9999 of the day before');
    assert.match(stdout, /Read as other: 0; effort or model inherited from the session: 1; call not found: 0; carried over from the day before: 0/);
  } finally {
    records.cleanup();
  }
});

test('subagents keeps no text of any message or description, in its lines or its JSON', async () => {
  const records = makeRecords();
  try {
    for (const argv of [[], ['--json'], ['--days', '2', '--json']]) {
      const { code, stdout } = await subagents(argv, records);
      assert.equal(code, 0);
      assert.ok(!stdout.includes(SECRET), `${argv.join(' ')}: the planted text leaked`);
    }
  } finally {
    records.cleanup();
  }
});

// T6 of odd/tasks/harness-review.md, d1: JSON leaves U+2028 and U+2029 unescaped inside a string, and Node's readline
// ends a line at each, so the entry holding one did not parse and its launches were not counted.
test('an entry holding U+2028 or U+2029 inside a string is still counted', async () => {
  const records = makeRecords();
  try {
    const file = path.join(records.config, 'projects', projectSlug(records.main), 's1.jsonl');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(`"prompt":"${SECRET}"`, '"prompt":"one two three"'));
    assert.ok(fs.readFileSync(file, 'utf8').includes(' '), 'the record holds the separator raw');
    const { code, stdout } = await subagents(['--json'], records);
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.count.total.launches, 2);
    // The session's entry holding the Agent call is read: the call is found, so whether it inherited is known.
    assert.equal(parsed.launches.find((launch) => launch.agentId === 'a1').inherited, false);
  } finally {
    records.cleanup();
  }
});

test('--day and --days choose the local days counted', async () => {
  const records = makeRecords();
  try {
    const before = await subagents(['--day', '2026-10-13', '--json'], records);
    assert.deepEqual(JSON.parse(before.stdout).launches.map((launch) => launch.agentId), ['a0']);
    const both = await subagents(['--days', '2', '--json'], records);
    const parsed = JSON.parse(both.stdout);
    assert.deepEqual([parsed.from, parsed.to, parsed.count.total.launches], ['2026-10-13', '2026-10-14', 3]);
  } finally {
    records.cleanup();
  }
});

test('a bad flag is a usage error (exit 2), and a project with no records folder exits 1 saying so', async () => {
  const records = makeRecords();
  try {
    for (const argv of [['--days', '8'], ['--days', '0'], ['--day', '14-10-2026'], ['--day', '2026-02-30'], ['--day'], ['--what']]) {
      const { code, stderr } = await subagents(argv, records);
      assert.equal(code, 2, argv.join(' '));
      assert.match(stderr, /Usage: js-harness subagents/);
    }
    fs.rmSync(path.join(records.config, 'projects'), { recursive: true, force: true });
    const none = await subagents([], records);
    assert.equal(none.code, 1);
    assert.match(none.stderr, /no Claude Code records folder/);
    // A records "folder" that cannot be listed is none either, not an empty count.
    fs.mkdirSync(path.join(records.config, 'projects'), { recursive: true });
    fs.writeFileSync(path.join(records.config, 'projects', projectSlug(records.main)), 'not a folder');
    const unreadable = await subagents([], records);
    assert.equal(unreadable.code, 1);
    assert.match(unreadable.stderr, /no Claude Code records folder/);
  } finally {
    records.cleanup();
  }
});

test('subagents reads a day of another season at that season\'s offset, its launches and tokens (Codex, 2026-10-15)', async () => {
  // UTC-5 in winter, UTC-4 in summer; run in summer about a winter day. 04:30Z on the 16th is 23:30 of the 15th there.
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-subagents-'));
  try {
    const project = path.join(config, 'project');
    const folder = path.join(config, 'projects', projectSlug(path.resolve(project)));
    const agents = path.join(folder, 's1', 'subagents');
    fs.mkdirSync(agents, { recursive: true });
    fs.writeFileSync(path.join(folder, 's1.jsonl'), jsonl([{ type: 'assistant', timestamp: '2026-01-16T04:29:00Z', message: { id: 'p1', model: 'claude-opus-5-5', usage: { input_tokens: 300, output_tokens: 3 } } }]));
    fs.writeFileSync(path.join(agents, 'agent-w1.jsonl'), jsonl([answer('m1', 'claude-haiku-5-5', '2026-01-16T04:30:00Z', 100)]));
    fs.writeFileSync(path.join(agents, 'agent-w1.meta.json'), JSON.stringify({ agentType: 'general-purpose', description: 'Write it', effort: 'high' }));
    const out = [];
    const err = [];
    const deps = {
      cwd: project, stdout: (line) => out.push(line), stderr: (line) => err.push(line), run: () => ({ status: 128, stdout: '', stderr: '' }),
      now: () => Date.parse('2026-07-15T20:00:00.000Z'),
      offsetMinutes: (timestamp) => (timestamp < '2026-03-08T07:00:00.000Z' ? -300 : -240),
    };
    assert.equal(await subagentsMain(['--day', '2026-01-15'], { CLAUDE_CONFIG_DIR: config }, deps), 0, err.join('\n'));
    assert.match(out[0], /^Sub-agents, local day 2026-01-15 \(UTC-05:00\)/);
    out.length = 0;
    assert.equal(await subagentsMain(['--day', '2026-01-15', '--json'], { CLAUDE_CONFIG_DIR: config }, deps), 0);
    const parsed = JSON.parse(out.join('\n'));
    assert.equal(parsed.offsetMinutes, -300);
    assert.deepEqual(parsed.launches.map((launch) => [launch.agentId, launch.started]), [['w1', true]]);
    assert.equal(parsed.sessions.input, 300, 'the parent entry at 23:29 of the 15th is that day\'s, not the next');
  } finally {
    fs.rmSync(config, { recursive: true, force: true });
  }
});

test('subagents reads a day east of UTC from the files changed the day before, its first hours included', async () => {
  // UTC+2: local 00:30 of the 15th is 22:30Z on the 14th, and the file holding it was last written at 23:00Z there.
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-subagents-'));
  try {
    const project = path.join(config, 'project');
    const folder = path.join(config, 'projects', projectSlug(path.resolve(project)));
    const agents = path.join(folder, 's1', 'subagents');
    fs.mkdirSync(agents, { recursive: true });
    fs.writeFileSync(path.join(folder, 's1.jsonl'), jsonl([]));
    const file = path.join(agents, 'agent-e1.jsonl');
    fs.writeFileSync(file, jsonl([answer('m1', 'claude-haiku-5-5', '2026-01-14T22:30:00Z', 100)]));
    fs.writeFileSync(path.join(agents, 'agent-e1.meta.json'), JSON.stringify({ agentType: 'general-purpose', description: 'Write it', effort: 'high' }));
    const changed = new Date('2026-01-14T23:00:00Z');
    fs.utimesSync(file, changed, changed);
    const out = [];
    const code = await subagentsMain(['--day', '2026-01-15', '--json'], { CLAUDE_CONFIG_DIR: config }, {
      cwd: project, stdout: (line) => out.push(line), stderr: () => {}, run: () => ({ status: 128, stdout: '', stderr: '' }),
      now: () => Date.parse('2026-07-15T20:00:00.000Z'), offsetMinutes: () => 120,
    });
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out.join('\n')).launches.map((launch) => [launch.agentId, launch.started]), [['e1', true]]);
  } finally {
    fs.rmSync(config, { recursive: true, force: true });
  }
});
