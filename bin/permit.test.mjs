import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { permitMain, permitsDir, renewOwnLease } from './permit.mjs';
import { readNotices } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';

// Every test has a machine of its own in the temp folder: a harness home and a project folder. The project root is
// given, so no git runs; the clock and the wait between looks are fakes, so no test sleeps.

const LEAD = 'bbbbbbbb-2222-4222-8222-222222222222';
const WORKER = 'aaaaaaaa-1111-4111-8111-111111111111';
const START = Date.parse('2026-01-01T12:00:00.000Z');
const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');

function makeMachine() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-permit-'));
  const root = path.join(dir, 'proj');
  fs.mkdirSync(root, { recursive: true });
  return { dir, root, home: path.join(dir, 'user-home'), slug: projectSlug(root), clock: START };
}

function withMachine(body) {
  return async () => {
    const machine = makeMachine();
    try {
      await body(machine);
    } finally {
      fs.rmSync(machine.dir, { recursive: true, force: true });
    }
  };
}

/** Runs `permit` with `argv` on `machine`; `onLook` runs at each wait between looks, and the clock moves 2 s a look. */
async function run(machine, argv, { stdin = '', onLook = async () => {}, env = {} } = {}) {
  let out = '';
  let err = '';
  const code = await permitMain(argv, {
    home: machine.home,
    env,
    cwd: machine.root,
    projectRoot: () => machine.root,
    readStdin: () => stdin,
    stdout: (text) => { out += text; },
    stderr: (text) => { err += text; },
    now: () => new Date(machine.clock),
    sleep: async (ms) => { machine.clock += ms; await onLook(); },
  });
  return { code, out, err };
}

const request = (machine, overrides = {}) => JSON.stringify({
  session_id: WORKER,
  transcript_path: path.join(machine.dir, `${WORKER}.jsonl`),
  cwd: machine.root,
  permission_mode: 'bypassPermissions',
  hook_event_name: 'PermissionRequest',
  tool_name: 'Bash',
  tool_input: { command: 'mkdir -p D:/jh23-fp-scratch && node fp-build.mjs', description: 'Build the fixture' },
  ...overrides,
});

const pendingIds = async (machine) => (await run(machine, ['list', '--json'])).out.trim() === '' ? [] : JSON.parse((await run(machine, ['list', '--json'])).out).pending.map((item) => item.id);

const lease = (machine) => run(machine, ['lease', '--session', LEAD]);

test('with no lead holding the relay, a request answers nothing at once and records nothing', withMachine(async (machine) => {
  const { code, out } = await run(machine, ['--hook'], { stdin: request(machine) });
  assert.equal(code, 0);
  assert.equal(out, '');
  assert.equal(fs.existsSync(permitsDir(machine.home, machine.slug)), false);
  assert.deepEqual(readNotices(machine.home, machine.slug).notices, []);
}));

test('a request the lead allows is told to the orchestrator, waits, and is answered allow; the outcome is logged', withMachine(async (machine) => {
  await lease(machine);
  let looked = false;
  const { code, out } = await run(machine, ['--hook'], {
    stdin: request(machine),
    onLook: async () => {
      if (looked) return;
      looked = true;
      const [id] = await pendingIds(machine);
      assert.equal((await run(machine, ['allow', id], { env: { CLAUDE_CODE_SESSION_ID: LEAD } })).code, 0);
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } });
  const [notice] = readNotices(machine.home, machine.slug).notices;
  assert.equal(notice.kind, 'note');
  assert.equal(notice.to.role, 'orchestrator');
  assert.match(notice.text, /^permit \S+: aaaaaaaa asks Bash: mkdir -p D:\/jh23-fp-scratch && node fp-build\.mjs/);
  const log = fs.readFileSync(path.join(permitsDir(machine.home, machine.slug), 'log.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(log.map((entry) => entry.outcome), ['allow']);
  assert.deepEqual(await pendingIds(machine), []);
}));

test('a request the lead denies is answered deny with the lead\'s reason', withMachine(async (machine) => {
  await lease(machine);
  const { out } = await run(machine, ['--hook'], {
    stdin: request(machine),
    onLook: async () => {
      const [id] = await pendingIds(machine);
      if (id !== undefined) await run(machine, ['deny', id, '--reason', 'its work merged in PR 305'], { env: { CLAUDE_CODE_SESSION_ID: LEAD } });
    },
  });
  const { decision } = JSON.parse(out).hookSpecificOutput;
  assert.equal(decision.behavior, 'deny');
  assert.match(decision.message, /orchestrator denied.*its work merged in PR 305/);
}));

test('with no verdict in time the card goes to the user: nothing is answered, the timeout is logged, a late verdict is refused', withMachine(async (machine) => {
  await lease(machine);
  let id = null;
  const { out } = await run(machine, ['--hook'], { stdin: request(machine), onLook: async () => { id ??= (await pendingIds(machine))[0]; } });
  assert.equal(out, '');
  const log = fs.readFileSync(path.join(permitsDir(machine.home, machine.slug), 'log.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(log.map((entry) => entry.outcome), ['timeout']);
  const late = await run(machine, ['allow', id], { env: { CLAUDE_CODE_SESSION_ID: LEAD } });
  assert.equal(late.code, 1);
  assert.match(late.err, /its wait ended.*the user/);
}));

test('the lead\'s own request, or one after the lease ran out, is not relayed', withMachine(async (machine) => {
  await lease(machine);
  assert.equal((await run(machine, ['--hook'], { stdin: request(machine, { session_id: LEAD }) })).out, '');
  machine.clock += 41 * 60 * 1000;
  assert.equal((await run(machine, ['--hook'], { stdin: request(machine) })).out, '');
  assert.deepEqual(readNotices(machine.home, machine.slug).notices, []);
}));

test('the lease is the running session by default, and --off ends it', withMachine(async (machine) => {
  assert.equal((await run(machine, ['lease'], { env: { CLAUDE_CODE_SESSION_ID: LEAD } })).code, 0);
  assert.equal((await run(machine, ['--hook'], { stdin: request(machine, { session_id: LEAD }) })).out, '');
  assert.equal((await run(machine, ['lease', '--off'], { env: { CLAUDE_CODE_SESSION_ID: LEAD } })).code, 0);
  assert.equal((await run(machine, ['--hook'], { stdin: request(machine) })).out, '');
  assert.deepEqual(readNotices(machine.home, machine.slug).notices, []);
  const none = await run(machine, ['lease']);
  assert.equal(none.code, 2);
  assert.match(none.err, /--session/);
}));

test('list shows each pending request with its session, tool and command', withMachine(async (machine) => {
  await lease(machine);
  let listed = '';
  await run(machine, ['--hook'], { stdin: request(machine), onLook: async () => { listed ||= (await run(machine, ['list'])).out; } });
  assert.match(listed, /held by bbbbbbbb/);
  assert.match(listed, /aaaaaaaa {2}Bash {2}mkdir -p D:\/jh23-fp-scratch && node fp-build\.mjs/);
}));

test('deny takes a reason, and a verdict names a pending request', withMachine(async (machine) => {
  const noReason = await run(machine, ['deny', 'x1']);
  assert.equal(noReason.code, 2);
  assert.match(noReason.err, /--reason/);
  await lease(machine);
  const unknown = await run(machine, ['allow', 'x1'], { env: { CLAUDE_CODE_SESSION_ID: LEAD } });
  assert.equal(unknown.code, 1);
  assert.match(unknown.err, /no request x1/);
}));

test('only the session holding the relay gives a verdict: not another session, and not the one that asks', withMachine(async (machine) => {
  await lease(machine);
  const tries = [];
  const { out } = await run(machine, ['--hook'], {
    stdin: request(machine),
    onLook: async () => {
      if (tries.length > 0) return;
      const [id] = await pendingIds(machine);
      tries.push(await run(machine, ['allow', id], { env: { CLAUDE_CODE_SESSION_ID: WORKER } }));
      tries.push(await run(machine, ['allow', id], { env: { CLAUDE_CODE_SESSION_ID: 'cccccccc-3333-4333-8333-333333333333' } }));
      tries.push(await run(machine, ['allow', id]));
    },
  });
  assert.equal(out, '');
  assert.equal(tries.length, 3);
  for (const attempt of tries) {
    assert.equal(attempt.code, 1);
    assert.match(attempt.err, /only the session holding the relay/);
  }
}));

test('a lease another session holds is neither replaced nor ended without --take-over', withMachine(async (machine) => {
  await lease(machine);
  const other = { env: { CLAUDE_CODE_SESSION_ID: WORKER } };
  const replace = await run(machine, ['lease'], other);
  assert.equal(replace.code, 1);
  assert.match(replace.err, /bbbbbbbb holds the relay.*--take-over/);
  const off = await run(machine, ['lease', '--off'], other);
  assert.equal(off.code, 1);
  assert.match(off.err, /--take-over/);
  assert.match((await run(machine, ['list'])).out, /held by bbbbbbbb/);
  assert.equal((await run(machine, ['lease', '--take-over'], other)).code, 0);
  assert.match((await run(machine, ['list'])).out, /held by aaaaaaaa/);
  assert.equal((await run(machine, ['lease', '--session', LEAD], { env: { CLAUDE_CODE_SESSION_ID: LEAD } })).code, 1);
  machine.clock += 41 * 60 * 1000;
  assert.equal((await run(machine, ['lease', '--session', LEAD])).code, 0);
}));

// The arguments: a flag a subcommand does not know, or a value flag with no value, is refused with exit 2 before anything
// is written (bin/lib/args.mjs), so a typo never does what the user did not ask (`lease --of` took a 40-minute lease).
const LEASE_FILE = (machine) => path.join(permitsDir(machine.home, machine.slug), 'lease.json');
const LEAD_ENV = { env: { CLAUDE_CODE_SESSION_ID: LEAD } };

test('lease refuses a mistyped flag, a flag given where its value belongs, and a value flag with no value: nothing is written', withMachine(async (machine) => {
  const typo = await run(machine, ['lease', '--of'], LEAD_ENV);
  assert.equal(typo.code, 2);
  assert.equal(typo.out, '');
  assert.match(typo.err, /^js-harness permit: unknown argument: --of\n/);
  const taken = await run(machine, ['lease', '--session', '--take-over']);
  assert.equal(taken.code, 2);
  assert.equal(taken.out, '');
  assert.match(taken.err, /^js-harness permit: --session requires a value\n/);
  const minutes = await run(machine, ['lease', '--session', LEAD, '--minutes']);
  assert.equal(minutes.code, 2);
  assert.match(minutes.err, /^js-harness permit: --minutes requires a value\n/);
  const offWithSession = await run(machine, ['lease', '--off', '--session', LEAD]);
  assert.equal(offWithSession.code, 2);
  assert.match(offWithSession.err, /^js-harness permit: unknown argument: --session\n/);
  assert.equal(fs.existsSync(LEASE_FILE(machine)), false);
}));

test('lease --minutes sets the length of the lease', withMachine(async (machine) => {
  assert.equal((await run(machine, ['lease', '--session', LEAD, '--minutes', '5'])).code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(LEASE_FILE(machine), 'utf8')).until, new Date(START + 5 * 60 * 1000).toISOString());
}));

test('list refuses a flag it does not know rather than printing the plain list', withMachine(async (machine) => {
  const typo = await run(machine, ['list', '--jsn']);
  assert.equal(typo.code, 2);
  assert.equal(typo.out, '');
  assert.match(typo.err, /^js-harness permit: unknown argument: --jsn\n/);
  assert.equal((await run(machine, ['list', '--json'])).code, 0);
}));

test('the hook refuses a flag it does not know: it answers nothing, records no card and tells no orchestrator', withMachine(async (machine) => {
  await lease(machine);
  const { code, out, err } = await run(machine, ['--hook', '--zz-audit-sentinel'], { stdin: request(machine) });
  assert.equal(code, 2);
  assert.equal(out, '');
  assert.match(err, /^js-harness permit: unknown argument: --zz-audit-sentinel\n/);
  assert.equal(fs.existsSync(path.join(permitsDir(machine.home, machine.slug), 'requests')), false);
  assert.deepEqual(readNotices(machine.home, machine.slug).notices, []);
}));

test('allow takes no reason and a verdict takes one id: a typed reason is refused, never dropped', withMachine(async (machine) => {
  await lease(machine);
  let tried = false;
  const { out } = await run(machine, ['--hook'], {
    stdin: request(machine),
    onLook: async () => {
      if (tried) return;
      tried = true;
      const [id] = await pendingIds(machine);
      const withReason = await run(machine, ['allow', id, '--reason', 'its work merged'], LEAD_ENV);
      assert.equal(withReason.code, 2);
      assert.match(withReason.err, /^js-harness permit: unknown argument: --reason\n/);
      const extra = await run(machine, ['deny', id, 'its', '--reason', 'its work merged'], LEAD_ENV);
      assert.equal(extra.code, 2);
      assert.match(extra.err, /^js-harness permit: unknown argument: its\n/);
      assert.equal(fs.existsSync(path.join(permitsDir(machine.home, machine.slug), 'verdicts', `${id}.json`)), false);
      const noReason = await run(machine, ['deny', id, '--reason'], LEAD_ENV);
      assert.equal(noReason.code, 2);
      assert.match(noReason.err, /^js-harness permit: --reason requires a value\n/);
      assert.equal((await run(machine, ['deny', id, '--reason', 'its work merged in PR 305'], LEAD_ENV)).code, 0);
    },
  });
  assert.equal(JSON.parse(out).hookSpecificOutput.decision.behavior, 'deny');
}));

test('the public command answers nothing and exits 0 on a payload it cannot read', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-permit-cli-'));
  try {
    const result = spawnSync(process.execPath, [BIN, 'permit', '--hook'], { input: 'not json', encoding: 'utf8', env: { ...process.env, JS_HARNESS_HOME: home } });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// renewOwnLease (odd/tasks/harness-review.md, T3, S5a): `wait` renews the lease its own session holds, and only that.
const renewLease = (machine, session, everySeconds, now = machine.clock) => renewOwnLease({
  home: machine.home, cwd: machine.root, session, now: new Date(now), everySeconds, projectRoot: () => machine.root,
});
const leaseFileOf = (machine) => path.join(permitsDir(machine.home, machine.slug), 'lease.json');
const readLeaseText = (machine) => (fs.existsSync(leaseFileOf(machine)) ? fs.readFileSync(leaseFileOf(machine), 'utf8') : null);
const MINUTE = 60 * 1000;

function writeHeldLease(machine, session, until) {
  fs.mkdirSync(permitsDir(machine.home, machine.slug), { recursive: true });
  fs.writeFileSync(leaseFileOf(machine), `${JSON.stringify({ schema: 'js-harness.permit/v1', session, until: new Date(until).toISOString() })}\n`, 'utf8');
}

test('renewOwnLease moves the lease its session holds to now plus 40 minutes, or the interval plus 5 minutes when that is longer', withMachine(async (machine) => {
  writeHeldLease(machine, LEAD, START + 10 * MINUTE);
  assert.deepEqual(renewLease(machine, LEAD, 1200), { renewed: true, until: new Date(START + 40 * MINUTE).toISOString() });
  assert.deepEqual(JSON.parse(readLeaseText(machine)), { schema: 'js-harness.permit/v1', session: LEAD, until: new Date(START + 40 * MINUTE).toISOString() });
  const later = START + 30 * MINUTE;
  assert.equal(renewLease(machine, LEAD, 3600, later).renewed, true);
  assert.equal(JSON.parse(readLeaseText(machine)).until, new Date(later + 65 * MINUTE).toISOString());
}));

test('renewOwnLease never takes, creates or changes a lease another session holds, an expired lease, or none', withMachine(async (machine) => {
  writeHeldLease(machine, WORKER, START + 40 * MINUTE);
  const other = readLeaseText(machine);
  assert.deepEqual(renewLease(machine, LEAD, 1200), { renewed: false });
  assert.equal(readLeaseText(machine), other);

  writeHeldLease(machine, LEAD, START - MINUTE);
  const expired = readLeaseText(machine);
  assert.deepEqual(renewLease(machine, LEAD, 1200), { renewed: false });
  assert.equal(readLeaseText(machine), expired);

  fs.rmSync(leaseFileOf(machine));
  assert.deepEqual(renewLease(machine, LEAD, 1200), { renewed: false });
  assert.equal(readLeaseText(machine), null);

  assert.deepEqual(renewLease(machine, undefined, 1200), { renewed: false });
  assert.equal(readLeaseText(machine), null);
}));
