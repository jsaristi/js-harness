import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { localMinute, localZone } from './local-time.mjs';
import { SIGNIN_FIX, SIGNIN_READ_TIMEOUT_MS, SIGNIN_WARN_DAYS, readSigninExpiry, signinReading, signinRow } from './signin-expiry.mjs';

// Every answer here is made up: the real `claude auth status` names an account, so no test runs it.
const EXPIRES = '2026-11-23T16:11:04.604Z';
const END = Date.parse(EXPIRES);
const DAY = 86400000;
const HOUR = 3600000;
const WHEN = `${localMinute(END)} (${localZone(END)})`;

/** What `claude auth status` printed on 2026-11-11 (CLI 2.1.322), its keys kept and every value of the account made up. */
const answer = (over = {}) => ({
  loggedIn: true,
  authMethod: 'claude.ai',
  apiProvider: 'firstParty',
  analyticsDisabled: false,
  projectsDirectory: '/home/someone/.claude/projects',
  configDirectory: '/home/someone/.claude',
  loginExpiresAt: EXPIRES,
  email: 'someone@example.com',
  orgId: '00000000-0000-4000-8000-000000000000',
  orgName: 'An organisation',
  subscriptionType: 'max',
  storedClaudeAiLogin: true,
  planTier: 'a tier',
  ...over,
});
const printed = (object, status = 0) => ({ status, signal: null, stdout: `${JSON.stringify(object, null, 2)}\n`, stderr: '' });
const READ = { expiresAt: EXPIRES, stored: true, why: null };
const ROW = { id: 'claude-signin', version: null, installed: 'n/a', claude: 'ok', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} };

test('the margin is a week, in days', () => {
  assert.equal(SIGNIN_WARN_DAYS, 7);
});

test('the reader runs claude auth status and nothing else, bounded by its own time limit, with empty standard input', () => {
  for (const [platform, file, argv, shell] of [['linux', 'claude', ['auth', 'status'], false], ['win32', 'claude auth status', [], true]]) {
    const calls = [];
    const spawn = (...call) => {
      calls.push(call);
      return printed(answer());
    };
    assert.deepEqual(readSigninExpiry({ spawn, platform }), READ, platform);
    assert.equal(calls.length, 1, platform);
    assert.deepEqual(calls[0].slice(0, 2), [file, argv], platform);
    assert.deepEqual(calls[0][2], { encoding: 'utf8', shell, timeout: SIGNIN_READ_TIMEOUT_MS, input: '' }, platform);
  }
  assert.ok(SIGNIN_READ_TIMEOUT_MS > 6030, 'over the slowest reading measured on 2026-11-11');
});

test('a home that is not the user\'s own is not asked: no CLI runs, and the row is n/a with no note', () => {
  const calls = [];
  const spawn = (...call) => {
    calls.push(call);
    return printed(answer());
  };
  const real = path.resolve('signin-real-home');
  const reading = readSigninExpiry({ spawn, platform: 'linux', home: path.resolve('signin-fixture-home'), homedir: () => real });
  assert.deepEqual(reading, { expiresAt: null, stored: null, why: null, asked: false });
  assert.equal(calls.length, 0, 'the sign-in is the real home\'s: a fixture home never reads it');
  assert.deepEqual(signinRow(reading, END), { ...ROW, claude: 'n/a' });
  // The user's own home, however it is spelled, is asked.
  assert.deepEqual(readSigninExpiry({ spawn, platform: 'linux', home: path.join(real, 'sub', '..'), homedir: () => real }), READ);
  assert.equal(calls.length, 1);
});

test('the reading keeps the end date and whether a sign-in is stored, and nothing else of the answer', () => {
  const reading = signinReading(printed(answer()));
  assert.deepEqual(reading, READ);
  assert.doesNotMatch(JSON.stringify(reading), /someone|organisation|max|tier|00000000/);
});

test('a date printed without the stored flag is read, the flag not known', () => {
  const { storedClaudeAiLogin, ...rest } = answer();
  assert.deepEqual(signinReading(printed(rest)), { expiresAt: EXPIRES, stored: null, why: null });
});

test('a reader that cannot start the CLI, or whose spawn throws, says so and never throws', () => {
  const why = 'the claude command could not be started';
  assert.deepEqual(readSigninExpiry({ spawn: () => { throw new Error('spawn failed'); }, platform: 'linux' }), { expiresAt: null, stored: null, why });
  assert.deepEqual(readSigninExpiry({ spawn: () => ({ error: Object.assign(new Error('ENOENT'), { code: 'ENOENT' }), status: null }), platform: 'linux' }), { expiresAt: null, stored: null, why });
  assert.deepEqual(signinReading(null), { expiresAt: null, stored: null, why });
});

test('a CLI that does not answer in time is said with the limit', () => {
  for (const result of [{ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }, { status: null, error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) }]) {
    assert.deepEqual(signinReading(result), { expiresAt: null, stored: null, why: `claude auth status did not answer in ${SIGNIN_READ_TIMEOUT_MS / 1000} seconds` });
  }
});

test('an answer that is not a JSON object is said, with its exit when that is not 0: a missing CLI through a shell, or one that does not know the command', () => {
  assert.deepEqual(signinReading({ status: 1, signal: null, stdout: '', stderr: "'claude' is not recognized as an internal or external command" }), {
    expiresAt: null,
    stored: null,
    why: 'claude auth status ended with exit 1 and no JSON: the Claude CLI is not on the path, or does not know the command',
  });
  for (const stdout of ['Logged in as someone@example.com\n', '[]', '"text"', 'null']) {
    const reading = signinReading({ status: 0, signal: null, stdout, stderr: '' });
    assert.equal(reading.why, 'claude auth status answered no JSON object: the Claude CLI may be older than its JSON answer', stdout);
    assert.doesNotMatch(reading.why, /someone/);
  }
});

test('a CLI that is not signed in says so, whatever its exit', () => {
  assert.deepEqual(signinReading(printed({ loggedIn: false, authMethod: 'none', apiProvider: 'firstParty' }, 1)), {
    expiresAt: null,
    stored: false,
    why: 'the Claude CLI says it is not signed in',
  });
});

test('a CLI signed in another way holds no stored claude.ai sign-in, and its method is named only when it reads as one', () => {
  const { loginExpiresAt, ...other } = answer({ storedClaudeAiLogin: false, authMethod: 'api_key' });
  assert.deepEqual(signinReading(printed(other)), { expiresAt: null, stored: false, why: 'the Claude CLI holds no stored claude.ai sign-in (it is signed in by api_key)' });
  assert.equal(signinReading(printed({ ...other, authMethod: 'a long text that is no method name\nwith a second line' })).why, 'the Claude CLI holds no stored claude.ai sign-in');
  // A stored flag that is false wins over a date printed beside it: that date is not a stored sign-in's.
  assert.equal(signinReading(printed(answer({ storedClaudeAiLogin: false }))).expiresAt, null);
});

test('a CLI that prints no end date is older than 2.1.318 or signed in another way, and that is said', () => {
  const { loginExpiresAt, storedClaudeAiLogin, ...old } = answer();
  const why = 'claude auth status prints no loginExpiresAt, which Claude Code prints from 2.1.318 on for a stored claude.ai sign-in: the Claude CLI is older, or signed in another way';
  assert.deepEqual(signinReading(printed(old)), { expiresAt: null, stored: null, why });
  assert.deepEqual(signinReading(printed({ ...old, storedClaudeAiLogin: true, loginExpiresAt: null })), { expiresAt: null, stored: true, why });
});

test('an end date that is no date is said, never guessed', () => {
  for (const loginExpiresAt of ['soon', 1795450264604, '', {}]) {
    assert.deepEqual(signinReading(printed(answer({ loginExpiresAt }))), { expiresAt: null, stored: true, why: 'claude auth status prints a loginExpiresAt that is not a date' }, JSON.stringify(loginExpiresAt));
  }
});

test('the row far from the end is ok, with the days left and the local date as its note', () => {
  const now = Date.parse('2026-11-11T06:30:00.000Z');
  assert.deepEqual(signinRow(READ, now), {
    ...ROW,
    expiresAt: EXPIRES,
    daysLeft: 12,
    note: `the claude.ai sign-in stored on this machine ends in 12 days, on ${WHEN}`,
  });
});

test('the row is a gap from the margin on, and its fix says who signs in and with what', () => {
  const edge = END - SIGNIN_WARN_DAYS * DAY;
  assert.equal(signinRow(READ, edge - 1).claude, 'ok', 'a millisecond before the margin');
  assert.deepEqual(signinRow(READ, edge), {
    ...ROW,
    claude: 'stale',
    expiresAt: EXPIRES,
    daysLeft: 7,
    note: `the claude.ai sign-in stored on this machine ends in 7 days, on ${WHEN}`,
    fix: { claude: [SIGNIN_FIX, 'claude auth login'] },
  });
  assert.match(SIGNIN_FIX, /^sign in again while you are at the machine/);
  assert.match(SIGNIN_FIX, /never signs in for you/);
});

test('under a day the row counts hours, then minutes, and one of each is singular', () => {
  const note = (left) => signinRow(READ, END - left).note;
  assert.equal(note(DAY + HOUR), `the claude.ai sign-in stored on this machine ends in 1 day, on ${WHEN}`);
  assert.equal(note(5 * HOUR + 59 * 60000), `the claude.ai sign-in stored on this machine ends in 5 hours, on ${WHEN}`);
  assert.equal(note(HOUR), `the claude.ai sign-in stored on this machine ends in 1 hour, on ${WHEN}`);
  assert.equal(note(12 * 60000 + 30000), `the claude.ai sign-in stored on this machine ends in 12 minutes, on ${WHEN}`);
  assert.equal(note(60000), `the claude.ai sign-in stored on this machine ends in 1 minute, on ${WHEN}`);
  assert.equal(note(59999), `the claude.ai sign-in stored on this machine ends in less than a minute, on ${WHEN}`);
  assert.equal(signinRow(READ, END - 5 * HOUR).daysLeft, 0);
});

test('past the end the row stays a gap and says when it ended', () => {
  const row = signinRow(READ, END + 2 * DAY + HOUR);
  assert.equal(row.claude, 'stale');
  assert.equal(row.daysLeft, -3);
  assert.equal(row.note, `the claude.ai sign-in stored on this machine ended on ${WHEN}`);
  assert.deepEqual(row.fix, { claude: [SIGNIN_FIX, 'claude auth login'] });
  assert.equal(signinRow(READ, END).note, `the claude.ai sign-in stored on this machine ended on ${WHEN}`, 'at the instant it ends');
});

test('a date that cannot be read is unknown, no gap, and the note says why', () => {
  const row = signinRow({ expiresAt: null, stored: false, why: 'the Claude CLI says it is not signed in' }, END);
  assert.deepEqual(row, { ...ROW, claude: 'unknown', note: 'when the claude.ai sign-in stored on this machine ends cannot be read: the Claude CLI says it is not signed in' });
  for (const nothing of [null, undefined, {}]) {
    assert.deepEqual(signinRow(nothing, END), { ...ROW, claude: 'unknown', note: 'when the claude.ai sign-in stored on this machine ends cannot be read: the reader gave nothing' });
  }
});
