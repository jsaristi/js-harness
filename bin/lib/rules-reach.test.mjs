import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diffRules, readListText, reachHook, rulesHookMain, rulesNotice } from './rules-reach.mjs';
import { writeRules } from './rules.mjs';

// The design is odd/tasks/rule-hierarchy.md, "Reach: the turn-start hook (T16f, first part)".

const pause = { id: 'context-pause', subject: 'the share of its context at which a session pauses', owner: 'sebastian', since: '2026-10-11', value: 88, unit: 'percent' };
const budget = { id: 'agents-budget', subject: 'the most estimated tokens AGENTS.md may hold', owner: 'project', since: '2026-10-15', value: 1500, unit: 'tokens' };
const prose = { id: 'one-home', subject: 'every rule has one home', owner: 'project', since: '2026-10-15', path: 'AGENTS.md', phrases: ['one home for every rule'] };

const harnessText = (list) => writeRules(list);
const projectText = (list) => `${JSON.stringify({ format: 1, rules: list }, null, 2)}\n`;

test('a list is read from the text git gives, in both shapes, and a hand-edited module is a fault', () => {
  assert.deepEqual(readListText(harnessText([pause, budget]), 'harness').rules.map((rule) => rule.id), ['agents-budget', 'context-pause']);
  const project = { id: 'tests-pass', subject: 'the tests pass', owner: 'project', since: '2026-10-15', sensor: 'test' };
  assert.deepEqual(readListText(projectText([project]), 'project').rules.map((rule) => rule.id), ['tests-pass']);
  assert.ok(readListText('export const RULES = [ { id: "x" } ];\n', 'harness').fault);
  assert.ok(readListText('not json', 'project').fault);
});

test('the difference of two lists is in four groups, by id, and a reorder or a change of source prints nothing', () => {
  const retiredPause = { ...pause, retired: '2026-10-16', successors: ['agents-budget'] };
  delete retiredPause.value;
  delete retiredPause.unit;
  const diff = diffRules([pause, prose], [{ ...budget }, retiredPause]);
  assert.deepEqual(diff.added.map((rule) => rule.id), ['agents-budget']);
  assert.deepEqual(diff.removed.map((rule) => rule.id), ['one-home']);
  assert.deepEqual(diff.retired.map((rule) => rule.id), ['context-pause']);
  assert.deepEqual(diff.changed, []);

  assert.equal(rulesNotice(diffRules([pause, budget], [budget, pause]), 'origin/main'), null);
  assert.equal(rulesNotice(diffRules([pause], [{ ...pause, since: '2026-10-12', subject: 'another subject' }]), 'origin/main'), null);
  const sensed = (sensor) => ({ id: 'tests-pass', subject: 'the tests pass', owner: 'project', since: '2026-10-15', sensor });
  assert.deepEqual(diffRules([sensed('test')], [sensed('lint')]).changed.map((change) => change.id), ['tests-pass']);
});

test('the notice gives main\'s declaration itself, one line a rule, and says the branch still reads the old ones', () => {
  const retiredBudget = { ...budget, retired: '2026-10-16', successors: ['context-pause'] };
  delete retiredBudget.value;
  delete retiredBudget.unit;
  const text = rulesNotice(diffRules([pause, budget, prose], [{ ...pause, value: 90 }, retiredBudget, { ...prose, phrases: ['a single home'] }]), 'origin/main');
  assert.equal(text, [
    'The rules on origin/main differ from this checkout\'s (3 rules):',
    '- agents-budget: retired; read context-pause instead',
    '- context-pause: 88 percent -> 90 percent',
    '- one-home: phrases ["one home for every rule"] -> ["a single home"]',
    'These are origin/main\'s; this branch\'s own checks still read the old ones until origin/main is merged into it.',
  ].join('\n'));
  assert.equal(
    rulesNotice(diffRules([], [budget]), 'main').split('\n')[1],
    '- agents-budget (new): 1500 tokens',
  );
  assert.equal(rulesNotice(diffRules([budget], []), 'main').split('\n')[1], '- agents-budget: no longer declared on main');
});

/** A scratch home and a project tree, a fake git that answers from `refs` (a ref name to the list at it), and a
 * record of the git calls made. `kind` places the list where the harness's checkout or a project keeps it. */
function machine({ kind = 'harness', refs = {}, base = 'origin/main', present = ['origin/HEAD', 'origin/main', 'main'] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-reach-'));
  const home = path.join(dir, 'home');
  const top = path.join(dir, 'project');
  const listPath = kind === 'harness' ? 'bin/lib/rules-data.mjs' : 'docs/rules.json';
  fs.mkdirSync(path.join(top, '.git'), { recursive: true });
  if (kind) {
    fs.mkdirSync(path.dirname(path.join(top, listPath)), { recursive: true });
    fs.writeFileSync(path.join(top, listPath), 'the working tree, which the hook does not read\n');
  }
  const calls = [];
  const text = (list) => (kind === 'harness' ? harnessText(list) : projectText(list));
  const git = (args) => {
    calls.push(args.join(' '));
    if (args[0] === 'for-each-ref') {
      const names = { 'origin/HEAD': 'refs/remotes/origin/HEAD', 'origin/main': 'refs/remotes/origin/main', main: 'refs/heads/main' };
      // A ref's commit stands for the list it holds, so a list moved on main is a main that moved.
      const sha = (ref) => crypto.createHash('sha1').update(JSON.stringify(refs[ref] ?? null)).digest('hex');
      return { status: 0, stdout: present.map((ref) => `${names[ref]} ${sha(ref)}\n`).join('') };
    }
    if (args[0] === 'merge-base') return { status: 0, stdout: 'BASE\n' };
    if (args[0] === 'show') {
      const [rev] = args[1].split(':');
      const list = refs[rev === 'BASE' ? base : rev];
      if (typeof list === 'string') return { status: 0, stdout: list };
      return list ? { status: 0, stdout: text(list) } : { status: 128, stdout: '', stderr: 'fatal: path does not exist' };
    }
    return { status: 1, stdout: '' };
  };
  const input = (event, extra = {}) => ({ hook_event_name: event, session_id: 'abcdef12-3456', cwd: path.join(top, 'bin'), ...extra });
  const run = (event, extra) => reachHook(input(event, extra), { home, git });
  const seen = () => path.join(home, '.js-harness', 'channel', 'rules-seen', 'abcdef12-3456.json');
  return { dir, home, top, calls, git, input, run, seen, refs, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('a project with no list gets nothing, and no git is started', () => {
  const m = machine({ kind: null });
  try {
    assert.equal(m.run('UserPromptSubmit').context, null);
    assert.deepEqual(m.calls, []);
    assert.equal(fs.existsSync(path.join(m.home, '.js-harness')), false);
  } finally {
    m.done();
  }
});

test('the first turn is told nothing when the merge base equals main, and a change on main is told once', () => {
  const m = machine({ refs: { 'origin/HEAD': [pause], BASE: [pause] }, base: 'BASE' });
  try {
    assert.equal(m.run('UserPromptSubmit').context, null);
    assert.ok(fs.existsSync(m.seen()), 'the first turn records what it was given');
    m.refs['origin/HEAD'] = [{ ...pause, value: 90 }];
    assert.match(m.run('UserPromptSubmit').context, /context-pause: 88 percent -> 90 percent/);
    assert.equal(m.run('UserPromptSubmit').context, null, 'told once');
  } finally {
    m.done();
  }
});

test('a turn after which main has not moved starts one git, and reads no list', () => {
  const m = machine({ refs: { 'origin/HEAD': [pause], BASE: [pause] }, base: 'BASE' });
  try {
    assert.equal(m.run('UserPromptSubmit').context, null);
    m.calls.length = 0;
    assert.equal(m.run('UserPromptSubmit').context, null);
    assert.deepEqual(m.calls.map((call) => call.split(' ')[0]), ['for-each-ref']);
  } finally {
    m.done();
  }
});

test('a session that moves to another project is compared there from its merge base, not from the last project\'s list', () => {
  const first = machine({ refs: { 'origin/HEAD': [pause, budget], BASE: [pause, budget] }, base: 'BASE' });
  const other = machine({ kind: 'project', refs: { 'origin/HEAD': [pause], BASE: [pause] }, base: 'BASE' });
  try {
    assert.equal(first.run('UserPromptSubmit').context, null);
    const moved = reachHook(other.input('UserPromptSubmit'), { home: first.home, git: other.git });
    assert.deepEqual(moved, { event: 'UserPromptSubmit', context: null });
  } finally {
    first.done();
    other.done();
  }
});

test('a list at the merge base that does not parse is a fault, and nothing is recorded', () => {
  const m = machine({ refs: { 'origin/HEAD': [pause], BASE: 'export const RULES = [ { id: "x" } ];\n' }, base: 'BASE' });
  try {
    const result = m.run('UserPromptSubmit');
    assert.equal(result.context, null);
    assert.match(result.fault, /not in the shape writeRules gives/);
    assert.equal(fs.existsSync(m.seen()), false);
  } finally {
    m.done();
  }
});

test('a branch that changed a rule itself is told nothing, since what is compared is its merge base', () => {
  const m = machine({ refs: { 'origin/HEAD': [pause], BASE: [pause] }, base: 'BASE' });
  try {
    // The working tree holds the branch's own value; the hook never reads it.
    fs.writeFileSync(path.join(m.top, 'bin/lib/rules-data.mjs'), harnessText([{ ...pause, value: 90 }]));
    assert.equal(m.run('UserPromptSubmit').context, null);
    assert.equal(m.run('SubagentStart', { agent_id: 'a1', agent_type: 'general-purpose' }).context, null);
  } finally {
    m.done();
  }
});

test('a compaction, a clear and a resume are told again from the merge base; a startup is not the hook\'s', () => {
  const m = machine({ refs: { 'origin/HEAD': [{ ...pause, value: 90 }], BASE: [pause] }, base: 'BASE' });
  try {
    assert.match(m.run('UserPromptSubmit').context, /88 percent -> 90 percent/);
    assert.equal(m.run('UserPromptSubmit').context, null);
    for (const source of ['compact', 'clear', 'resume']) {
      const result = m.run('SessionStart', { source });
      assert.match(result.context, /88 percent -> 90 percent/, source);
      assert.equal(result.event, 'SessionStart');
    }
    assert.equal(m.run('SessionStart', { source: 'startup' }).context, null);
  } finally {
    m.done();
  }
});

test('a sub-agent is told the difference and nothing is recorded; a sub-agent\'s session events are passed over', () => {
  const m = machine({ refs: { 'origin/HEAD': [{ ...pause, value: 90 }], BASE: [pause] }, base: 'BASE' });
  try {
    assert.match(m.run('SubagentStart', { agent_id: 'a1', agent_type: 'general-purpose' }).context, /88 percent -> 90 percent/);
    assert.equal(fs.existsSync(m.seen()), false);
    assert.equal(m.run('SessionStart', { source: 'compact', agent_id: 'a1' }).context, null);
    assert.equal(m.run('UserPromptSubmit', { agent_id: 'a1' }).context, null);
    assert.equal(fs.existsSync(m.seen()), false, 'a sub-agent never spends the session\'s notice');
    assert.match(m.run('UserPromptSubmit').context, /88 percent -> 90 percent/, 'the session is still told');
  } finally {
    m.done();
  }
});

test('a project\'s own docs/rules.json is compared the same way', () => {
  const sensed = (sensor) => ({ id: 'tests-pass', subject: 'the tests pass', owner: 'project', since: '2026-10-15', sensor });
  const m = machine({ kind: 'project', refs: { main: [sensed('lint')], BASE: [sensed('test')] }, base: 'BASE', present: ['main'] });
  try {
    assert.match(m.run('UserPromptSubmit').context, /^The rules on main differ/);
    assert.match(m.calls.find((call) => call.startsWith('show main:')), /docs\/rules\.json$/);
  } finally {
    m.done();
  }
});

test('every fault is said apart from the context, and a bad session id writes nothing', () => {
  const none = machine({ refs: {}, present: [] });
  try {
    const result = none.run('UserPromptSubmit');
    assert.equal(result.context, null);
    assert.match(result.fault, /no origin\/HEAD, origin\/main or main/);
  } finally {
    none.done();
  }
  const broken = machine({ refs: { 'origin/HEAD': [pause], BASE: [pause] }, base: 'BASE' });
  try {
    assert.equal(broken.run('UserPromptSubmit', { session_id: '../../evil' }).context, null);
    assert.equal(fs.existsSync(path.join(broken.home, '.js-harness')), false);
    broken.refs['origin/HEAD'] = undefined;
    const result = broken.run('UserPromptSubmit');
    assert.equal(result.context, null);
    assert.match(result.fault, /origin\/HEAD/);
  } finally {
    broken.done();
  }
});

test('the command answers in the hooks contract, and exits 0 on empty input, on a fault and on what is not JSON', async () => {
  const m = machine({ refs: { 'origin/HEAD': [{ ...pause, value: 90 }], BASE: [pause] }, base: 'BASE' });
  try {
    const out = [];
    const err = [];
    const io = (text, git = m.git) => ({ home: m.home, git, stdin: () => text, stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
    const noGit = () => assert.fail('no git is started');
    assert.equal(await rulesHookMain([], io('', noGit)), 0);
    assert.equal(await rulesHookMain([], io('not json', noGit)), 0);
    assert.deepEqual(out, []);

    assert.equal(await rulesHookMain([], io(JSON.stringify(m.input('SubagentStart', { agent_id: 'a1' })))), 0);
    assert.deepEqual(JSON.parse(out.pop()).hookSpecificOutput.hookEventName, 'SubagentStart');

    assert.equal(await rulesHookMain([], io(JSON.stringify(m.input('UserPromptSubmit')), () => ({ status: 128, stdout: '', stderr: 'boom' }))), 0);
    assert.deepEqual(out, [], 'a fault never reaches the context');
    assert.match(err.at(-1), /^js-harness rules --hook: /);

    assert.equal(await rulesHookMain(['--other'], io('')), 2, 'a flag it does not know is refused, never read');
  } finally {
    m.done();
  }
});
