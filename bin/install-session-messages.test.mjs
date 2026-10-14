// T5 of odd/tasks/commands-and-doctor.md, through the commands: `install --accept-session-messages`
// sets `crossSessionInbound` to `accept` in Claude Code's user settings and says so, plain `install`
// never touches it, and `uninstall --global` puts back what was there and says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installMain, uninstallMain } from './install.mjs';

async function captured(main, argv, env) {
  const out = [];
  const err = [];
  const [log, error] = [console.log, console.error];
  console.log = (line) => out.push(String(line));
  console.error = (line) => err.push(String(line));
  try {
    return { code: await main(argv, env, { schtasks: () => ({ status: 1, stdout: '', stderr: '' }) }), out: out.join('\n'), err: err.join('\n') };
  } finally {
    console.log = log;
    console.error = error;
  }
}

function machine() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-session-messages-'));
  const settings = path.join(home, '.claude', 'settings.json');
  return { home, settings, setting: () => JSON.parse(fs.readFileSync(settings, 'utf8')).crossSessionInbound, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

test('plain install leaves the setting alone; with the flag it is accept and the output says so', async () => {
  const m = machine();
  try {
    fs.mkdirSync(path.dirname(m.settings), { recursive: true });
    fs.writeFileSync(m.settings, '{"crossSessionInbound":"hold"}');
    const plain = await captured(installMain, ['--home', m.home], {});
    assert.equal(plain.code, 0, plain.err);
    assert.equal(m.setting(), 'hold');
    assert.doesNotMatch(plain.out, /crossSessionInbound/);

    const asked = await captured(installMain, ['--home', m.home, '--accept-session-messages'], {});
    assert.equal(asked.code, 0, asked.err);
    assert.equal(m.setting(), 'accept');
    assert.ok(asked.out.includes(`set crossSessionInbound to "accept" in ${m.settings} (it was "hold"; uninstall puts back "hold")`), asked.out);

    const again = await captured(installMain, ['--accept-session-messages', '--home', m.home], {});
    assert.ok(again.out.includes(`crossSessionInbound is already "accept" in ${m.settings}`), again.out);

    const removed = await captured(uninstallMain, ['--global', '--home', m.home], {});
    assert.equal(removed.code, 0, removed.err);
    assert.equal(m.setting(), 'hold');
    assert.ok(removed.out.includes(`put crossSessionInbound back in ${m.settings}`), removed.out);
  } finally {
    m.done();
  }
});

test('a settings file it cannot take is said on stderr, exit 1, after the install itself', async () => {
  const m = machine();
  try {
    fs.mkdirSync(path.dirname(m.settings), { recursive: true });
    fs.writeFileSync(m.settings, '{ not json');
    const result = await captured(installMain, ['--home', m.home, '--accept-session-messages'], {});
    assert.equal(result.code, 1);
    assert.match(result.out, /^installed js-harness /);
    assert.ok(result.err.includes(`crossSessionInbound was not set: ${m.settings} is malformed JSON; set it there by hand`), result.err);
  } finally {
    m.done();
  }
});

test('uninstall keeps a value the user changed since, and says so', async () => {
  const m = machine();
  try {
    await captured(installMain, ['--home', m.home, '--accept-session-messages'], {});
    const data = JSON.parse(fs.readFileSync(m.settings, 'utf8'));
    fs.writeFileSync(m.settings, JSON.stringify({ ...data, crossSessionInbound: 'refuse' }));
    const removed = await captured(uninstallMain, ['--global', '--home', m.home], {});
    assert.equal(m.setting(), 'refuse');
    assert.ok(removed.out.includes(`kept crossSessionInbound in ${m.settings} (modified by you)`), removed.out);
  } finally {
    m.done();
  }
});
