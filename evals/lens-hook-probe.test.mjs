// The lens flag parity probe (F8 S5, spec 4, odd/tasks/f8-s5-rules.md): what it plants, how it runs each arm and how it
// judges them, with the CLI and the loopback API replaced. The real run is `node evals/lens-hook-probe.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claudeArgs } from '../bin/lens-review.mjs';
import { HOOK_EVENTS, armArgs, judge, plantHome, probeEnv, runLensHookProbe } from './lens-hook-probe.mjs';

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lens-hook-probe-test-'));

test('the lens arm runs the lens\'s own arguments, and the plain arm the same without --safe-mode alone', () => {
  const lens = armArgs('lens', 'p.md', 's.json');
  assert.deepEqual(lens, claudeArgs('p.md', 's.json'));
  const plain = armArgs('plain', 'p.md', 's.json');
  assert.deepEqual(plain, lens.filter((arg) => arg !== '--safe-mode'));
  assert.ok(lens.includes('--safe-mode'));
  assert.throws(() => armArgs('other', 'p.md', 's.json'), /arm/);
});

test('the planted home holds a user hook for every event, each writing its own marker, and a user CLAUDE.md with the marker', () => {
  const root = scratch();
  try {
    const home = plantHome(root, 'plain', 'MARK-1234');
    const settings = JSON.parse(fs.readFileSync(path.join(home.config, 'settings.json'), 'utf8'));
    assert.deepEqual(Object.keys(settings.hooks).sort(), [...HOOK_EVENTS].sort());
    for (const event of HOOK_EVENTS) {
      const command = settings.hooks[event][0].hooks[0].command;
      assert.match(command, new RegExp(event));
      assert.ok(command.includes(home.marks.replace(/\\/g, '/')), command);
    }
    assert.match(fs.readFileSync(path.join(home.config, 'CLAUDE.md'), 'utf8'), /MARK-1234/);
    assert.ok(fs.statSync(home.work).isDirectory());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the environment points the CLI at the scratch config and the loopback API, with a dummy key and no login token', () => {
  const env = probeEnv({ PATH: 'p', CLAUDE_CODE_OAUTH_TOKEN: 'o', JS_HARNESS_EVAL_OAUTH_TOKEN: 'e', ANTHROPIC_API_KEY: 'real', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli' }, { config: 'C:/cfg', url: 'http://127.0.0.1:9' });
  assert.equal(env.CLAUDE_CONFIG_DIR, 'C:/cfg');
  assert.equal(env.ANTHROPIC_BASE_URL, 'http://127.0.0.1:9');
  assert.match(env.ANTHROPIC_API_KEY, /dummy/i);
  for (const name of ['CLAUDE_CODE_OAUTH_TOKEN', 'JS_HARNESS_EVAL_OAUTH_TOKEN', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']) assert.equal(env[name], undefined, name);
  assert.equal(env.PATH, 'p');
});

test('it passes only when the plain arm shows the planted hook and marker reach the run, and the lens arm shows neither', () => {
  const plain = { fired: ['SessionStart', 'UserPromptSubmit'], marker: true, requests: 2 };
  const lens = { fired: [], marker: false, requests: 2 };
  assert.equal(judge({ plain, lens }).pass, true);
  assert.match(judge({ plain, lens: { ...lens, fired: ['SessionEnd'] } }).reasons.join(' '), /lens arm fired SessionEnd/);
  assert.match(judge({ plain, lens: { ...lens, marker: true } }).reasons.join(' '), /lens arm sent the user CLAUDE.md/);
  assert.match(judge({ plain: { ...plain, fired: [] }, lens }).reasons.join(' '), /plain arm fired no hook/);
  assert.match(judge({ plain, lens: { ...lens, requests: 0 } }).reasons.join(' '), /lens arm reached no API/);
  assert.equal(judge({ plain: { ...plain, marker: false }, lens }).pass, true, 'the CLAUDE.md control is said, not required');
  assert.match(judge({ plain: { ...plain, marker: false }, lens }).notes.join(' '), /CLAUDE.md/);
});

test('a run plants two homes, runs each arm against the API, reads the markers and stops the API', async () => {
  const root = scratch();
  try {
    const ran = [];
    let stopped = false;
    const startApi = async () => ({ url: 'http://127.0.0.1:1', requests: () => ran.length, bodies: () => ran.map((call) => call.body), stop: () => { stopped = true; } });
    const run = (args, { cwd, env }) => {
      const arm = args.includes('--safe-mode') ? 'lens' : 'plain';
      const marks = path.join(path.dirname(cwd), 'marks');
      if (arm === 'plain') {
        fs.writeFileSync(path.join(marks, 'SessionStart'), 'x');
        ran.push({ body: `context ${fs.readFileSync(path.join(env.CLAUDE_CONFIG_DIR, 'CLAUDE.md'), 'utf8')}` });
      } else {
        ran.push({ body: 'no context' });
      }
      return { status: 1, stdout: '', stderr: '' };
    };
    const report = await runLensHookProbe({ root, startApi, run, nonce: 'MARK-5678' });
    assert.deepEqual(report.arms.plain.fired, ['SessionStart']);
    assert.equal(report.arms.plain.marker, true);
    assert.deepEqual(report.arms.lens.fired, []);
    assert.equal(report.arms.lens.marker, false);
    assert.equal(report.arms.lens.requests, 1);
    assert.equal(report.pass, true);
    assert.equal(stopped, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
