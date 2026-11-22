// The tests of `js-harness spend`: a session's transcript read by its path, its id or the caller's own id, each API
// message counted once however many lines repeat it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spendMain } from './spend.mjs';

const ID = '0cdab702-72bd-48e7-8a8e-0c38d4aca9c9';
const usage = { input_tokens: 2, output_tokens: 7, cache_read_input_tokens: 40000, cache_creation_input_tokens: 500 };
const line = (id, extra = {}) => JSON.stringify({ type: 'assistant', message: { id, model: 'claude-opus-5-5', usage }, ...extra });

/** A claude home in a scratch folder holding one project with session `ID`: one message on three lines, and one
 * sub-agent file. */
function scratch(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-spend-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'claude', 'projects', 'proj');
  fs.mkdirSync(path.join(project, ID, 'subagents'), { recursive: true });
  const file = path.join(project, `${ID}.jsonl`);
  fs.writeFileSync(file, `${[line('m1'), line('m1'), line('m1')].join('\n')}\n`);
  fs.writeFileSync(path.join(project, ID, 'subagents', 'agent-a1.jsonl'), `${line('s1')}\n`);
  return { root, project, file };
}

function run(argv, deps) {
  const out = [];
  const err = [];
  const code = spendMain(argv, { stdout: (text) => out.push(text), stderr: (text) => err.push(text), ...deps });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('a transcript path prints the main chain with the message counted once, and the sub-agents apart', (t) => {
  const { file } = scratch(t);
  const { code, out } = run([file, '--json'], {});
  assert.equal(code, 0);
  const spend = JSON.parse(out);
  assert.equal(spend.file, file);
  assert.deepEqual(spend.main, { calls: 1, cacheReadTokens: 40000, inputTokens: 2, outputTokens: 7, cacheWriteTokens: 500, lastContext: 40502, firstContext: 40502 });
  assert.deepEqual([spend.subagents.calls, spend.subagents.cacheReadTokens, spend.subagentFiles], [1, 40000, 1]);
});

test('the text names calls, cache-read and both contexts', (t) => {
  const { file } = scratch(t);
  const { code, out } = run([file], {});
  assert.equal(code, 0);
  assert.match(out, /main chain: 1 call; cache-read 40,000; input 2; output 7; cache-write 500/);
  assert.match(out, /context: last call 40,502; first call 40,502/);
  assert.match(out, /sub-agents \(1 file\): 1 call; cache-read 40,000/);
});

test('--self reads the transcript of the session the environment names, in the project folders', (t) => {
  const { project } = scratch(t);
  const { code, out } = run(['--self', '--json'], { env: { CLAUDE_CODE_SESSION_ID: ID }, projectDirs: () => [project] });
  assert.equal(code, 0);
  assert.equal(JSON.parse(out).id, ID);
  const byId = run([ID.slice(0, 8), '--json'], { env: {}, projectDirs: () => [project] });
  assert.equal(JSON.parse(byId.out).main.calls, 1);
});

test('a session that cannot be found, or no session named, is said and never printed as zeros', (t) => {
  const { project } = scratch(t);
  const none = run(['--self'], { env: {}, projectDirs: () => [project] });
  assert.equal(none.code, 2);
  assert.match(none.err, /CLAUDE_CODE_SESSION_ID/);
  const missing = run(['deadbeef'], { env: {}, projectDirs: () => [project] });
  assert.equal(missing.code, 1);
  assert.match(missing.err, /no transcript, or more than one, carries the session deadbeef/);
  assert.equal(run([], {}).code, 2);
  assert.equal(run([ID, '--self'], {}).code, 2);
  assert.equal(run(['--bogus'], {}).code, 2);
});

test('--self --line records the stop line of the session that runs it once, and the plain form names it', (t) => {
  const { root, project } = scratch(t);
  const env = { CLAUDE_CODE_SESSION_ID: ID, JS_HARNESS_HOME: path.join(root, 'home') };
  const recorded = run(['--self', '--line', '20M'], { env });
  assert.equal(recorded.code, 0);
  assert.match(recorded.out, /stop line 20,000,000 cache-read recorded for session/);
  assert.equal(run(['--self', '--line', '20M'], { env }).code, 0, 'the same line again changes nothing');
  for (const other of ['15M', '30M']) {
    const moved = run(['--self', '--line', other], { env });
    assert.equal(moved.code, 1, other);
    assert.match(moved.err, /recorded once: only the lead moves it/);
  }
  const shown = run(['--self'], { env, projectDirs: () => [project] });
  assert.match(shown.out, /stop line: 20,000,000 cache-read, recorded with --self --line; spent 80,000 of it/);
});

test("only a session whose app record carries a lead's title raises or lowers another session's line", (t) => {
  const { root } = scratch(t);
  const home = path.join(root, 'home');
  assert.equal(run(['--self', '--line', '20M'], { env: { CLAUDE_CODE_SESSION_ID: ID, JS_HARNESS_HOME: home } }).code, 0);
  const records = new Map([['11111111-2222-3333-4444-555555555555', { title: 'JH ORQ · orquestador F8' }], [ID, { title: 'JH 288 · work' }]]);
  const as = (caller) => ({ env: { CLAUDE_CODE_SESSION_ID: caller, JS_HARNESS_HOME: home }, readApp: () => records });
  const worker = run([ID, '--line', '30M', '--raise'], as(ID));
  assert.equal(worker.code, 1);
  assert.match(worker.err, /its own line/);
  const otherWorker = run([ID, '--line', '30M', '--raise'], { ...as('22222222-2222-3333-4444-555555555555'), readApp: () => new Map([...records, ['22222222-2222-3333-4444-555555555555', { title: 'JH 290 · work' }]]) });
  assert.equal(otherWorker.code, 1);
  assert.match(otherWorker.err, /only the lead/);
  const stranger = run([ID, '--line', '30M', '--raise'], { env: { JS_HARNESS_HOME: home }, readApp: () => records });
  assert.equal(stranger.code, 1, 'no session runs it');
  const raised = run([ID, '--line', '30M', '--raise'], as('11111111-2222-3333-4444-555555555555'));
  assert.equal(raised.code, 0, raised.err);
  assert.match(raised.out, /stop line 30,000,000 cache-read recorded for session .*moved from 20,000,000 by the lead/);
  assert.equal(run([ID.slice(0, 8), '--line', '30M', '--raise'], as('11111111-2222-3333-4444-555555555555')).code, 2, 'the whole id, never a short one');
  assert.equal(run(['--self', '--line', '30M', '--raise'], as('11111111-2222-3333-4444-555555555555')).code, 2, 'a raise names the session');
});

test('no session raises its own line, not even one titled as the lead', (t) => {
  const { root } = scratch(t);
  const home = path.join(root, 'home');
  const lead = '11111111-2222-3333-4444-555555555555';
  assert.equal(run(['--self', '--line', '20M'], { env: { CLAUDE_CODE_SESSION_ID: lead, JS_HARNESS_HOME: home } }).code, 0);
  const records = new Map([[lead, { title: 'JH ORQ · orquestador F8' }]]);
  const own = run([lead, '--line', '30M', '--raise'], { env: { CLAUDE_CODE_SESSION_ID: lead, JS_HARNESS_HOME: home }, readApp: () => records });
  assert.equal(own.code, 1);
  assert.match(own.err, /its own line/);
});

test('--line takes --self and a token count, and refuses a session not named by the host', (t) => {
  const { root } = scratch(t);
  const home = path.join(root, 'home');
  assert.equal(run([ID, '--line', '20M'], { env: { JS_HARNESS_HOME: home } }).code, 2);
  assert.equal(run(['--self', '--line', 'lots'], { env: { CLAUDE_CODE_SESSION_ID: ID, JS_HARNESS_HOME: home } }).code, 2);
  assert.equal(run(['--self', '--line'], { env: { CLAUDE_CODE_SESSION_ID: ID, JS_HARNESS_HOME: home } }).code, 2);
  assert.equal(run(['--self', '--line', '20M'], { env: { JS_HARNESS_HOME: home } }).code, 2);
  assert.equal(run(['--self', '--line', '20M'], { env: { CLAUDE_CODE_SESSION_ID: '../escape', JS_HARNESS_HOME: home } }).code, 1);
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
});
