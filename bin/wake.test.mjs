import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readNotices, writeOpening } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { wakeMain } from './wake.mjs';

const BOOT = '2026-10-15T04:52:00.000Z';
const at = (hour, minute) => `2026-10-15T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
const base = (time) => ({ timestamp: time, cwd: 'D:\\proj', gitBranch: 'main', isSidechain: false });
const line = (entry) => JSON.stringify(entry);
const titled = (title) => line({ type: 'custom-title', customTitle: title, sessionId: 's' });
const prompt = (text, time) => line({ type: 'user', ...base(time), origin: { kind: 'human' }, message: { role: 'user', content: text } });
const background = (id, task, command, time) => [
  line({ type: 'assistant', ...base(time), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'Bash', input: { command, run_in_background: true } }] } }),
  line({ type: 'user', ...base(time), toolUseResult: { stdout: '', stderr: '', backgroundTaskId: task }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } }),
];
const WAIT = 'js-harness wait --pr 162 --every 120 --for 60';

/** A project folder that is no repository, its sessions under a Claude home, and a harness home for the channel. */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-wake-'));
  const cwd = path.join(root, 'proj');
  const claudeHome = path.join(root, 'claude');
  const home = path.join(root, 'home');
  fs.mkdirSync(cwd, { recursive: true });
  const slug = projectSlug(cwd);
  const dir = path.join(claudeHome, 'projects', slug);
  fs.mkdirSync(dir, { recursive: true });
  const write = (id, lines) => fs.writeFileSync(path.join(dir, `${id}.jsonl`), lines.join('\n') + '\n');
  write('aaaa1111', [titled('JH 5 · canal'), prompt('go', at(4, 0)), ...background('t1', 'b1', WAIT, at(4, 30))]);
  write('bbbb2222', [titled('JH ORQ · proj'), prompt('lead', at(4, 50))]);
  write('cccc3333', [prompt('no title at all', at(4, 45))]);
  writeOpening(home, slug, { title: 'JH 5 · canal', text: 'You are JH 5.', at: at(4, 0), from: { host: 'h', id: 'x', source: 'test', title: 'JH ORQ · proj' } });
  const out = [];
  const err = [];
  const options = { cwd, stdout: (text) => out.push(text), stderr: (text) => err.push(text), env: { JS_HARNESS_HOME: home }, homedir: () => home, run: () => ({ status: 1, stdout: '', stderr: '' }), now: () => Date.parse(at(5, 0)) };
  const main = (...argv) => wakeMain(['--claude-home', claudeHome, '--boot-time', BOOT, ...argv], options);
  return { main, out, err, home, slug };
}

test('wake prints each session open before the boot, its opening and the waits the boot killed, and records nothing without --notify', async () => {
  const { main, out, home, slug } = fixture();
  assert.equal(await main(), 0);
  const text = out.join('\n');
  assert.match(text, /JH 5 · canal/);
  assert.match(text, /js-harness sessions --opening 'JH 5 · canal'/);
  assert.ok(text.includes(WAIT), text);
  assert.match(text, /JH ORQ · proj/);
  assert.match(text, /cccc3333/);
  assert.match(text, /no role to address a note to/);
  assert.match(text, /no note recorded: run with --notify/);
  assert.equal(readNotices(home, slug).notices.length, 0);
});

test('wake --notify leaves each titled session its note and the orchestrator the list, once per boot', async () => {
  const { main, out, home, slug } = fixture();
  assert.equal(await main('--notify'), 0);
  const notices = readNotices(home, slug).notices;
  const toFive = notices.filter((one) => one.to.role === 'work' && one.to.number === 5);
  const toLead = notices.filter((one) => one.to.role === 'orchestrator');
  assert.equal(toFive.length, 1);
  assert.ok(toFive[0].text.includes(WAIT), toFive[0].text);
  assert.match(toFive[0].text, /^The machine booted at 2026-10-15T04:52/);
  assert.equal(toFive[0].kind, 'note');
  // The orchestrator's own note says it was open and names whom to wake, and the session no note reaches.
  assert.equal(toLead.length, 2);
  const list = toLead.find((one) => /send_message/.test(one.text));
  assert.ok(list, toLead.map((one) => one.text).join('\n'));
  assert.match(list.text, /JH 5 · canal/);
  assert.match(list.text, /cccc3333/);
  assert.match(out.join('\n'), /3 notes recorded/);
  // A second run after the same boot, a few seconds off as an uptime reads it, records none.
  out.length = 0;
  assert.equal(await main('--notify'), 0);
  assert.equal(readNotices(home, slug).notices.length, notices.length);
  assert.match(out.join('\n'), /already recorded for this boot/);
});

test('wake with a --boot-time that is no time, or an unknown flag, exits 2 with usage and records nothing', async () => {
  const { home, slug, err } = fixture();
  const options = { stderr: (text) => err.push(text), stdout: () => {}, env: { JS_HARNESS_HOME: home }, homedir: () => home };
  assert.equal(await wakeMain(['--boot-time', 'yesterday'], options), 2);
  assert.equal(await wakeMain(['--bogus'], options), 2);
  assert.match(err.join('\n'), /js-harness wake/);
  assert.equal(readNotices(home, slug).notices.length, 0);
});
