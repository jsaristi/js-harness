// The `claude-signin` row of `doctor` (odd/tasks/signin-expiry-notice.md, S2): the days the stored claude.ai sign-in
// has left, read by the interactive report only. Every reading here is made up and handed in through `deps.signin`:
// no test runs `claude auth status`, which names an account. The home is an empty temp folder and every spawn fails,
// so the other rows read nothing of this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctorMain } from './doctor.mjs';
import { localMinute, localZone } from './lib/local-time.mjs';
import { SIGNED_OUT_FIX, SIGNIN_FIX } from './lib/signin-expiry.mjs';

const EXPIRES = '2026-11-23T16:11:04.604Z';
const WHEN = `${localMinute(Date.parse(EXPIRES))} (${localZone(Date.parse(EXPIRES))})`;
const READ = { expiresAt: EXPIRES, stored: true, why: null };
const noFetch = async () => {
  throw new Error('network disabled in tests');
};
const noSpawn = () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });

/** Runs `doctorMain` in a fresh empty home with the reading `signin` gives and the clock at `at`, and returns its
 * exit code, what it printed and the homes `signin` was asked for. */
async function runDoctor(argv, { signin, at }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-doctor-signin-'));
  const asked = [];
  let output = '';
  const original = console.log;
  console.log = (line) => {
    output += `${line}\n`;
  };
  try {
    const deps = {
      spawn: noSpawn,
      fetch: noFetch,
      now: () => new Date(at),
      signin: (given) => {
        asked.push(given);
        return signin();
      },
    };
    const code = await doctorMain([...argv, '--home', home, '--cwd', home, '--offline'], {}, deps);
    return { code, output, asked, home };
  } finally {
    console.log = original;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('doctor shows the claude-signin row ok far from the end, with the days left and the local date under Notes', async () => {
  const { code, output, asked, home } = await runDoctor([], { signin: () => READ, at: '2026-11-11T06:30:00.000Z' });
  assert.equal(code, 0);
  assert.match(output, /^claude-signin\s+n\/a\s+ok\s+n\/a\s+n\/a\s+n\/a$/m);
  assert.ok(output.includes(`\nNotes:\n  claude-signin: the claude.ai sign-in stored on this machine ends in 12 days, on ${WHEN}\n`), output);
  assert.doesNotMatch(output, /claude-signin \(claude\)/, 'outside the margin it is no gap');
  assert.deepEqual(asked, [home], 'the reader is asked once, for the home doctor was given');
});

test('doctor shows the row stale inside the margin, its fix saying who signs in and with what, in the table, under Fix and in --json', async () => {
  const at = '2026-11-17T16:11:04.604Z';
  const table = await runDoctor([], { signin: () => READ, at });
  assert.match(table.output, /^claude-signin\s+n\/a\s+stale\s+n\/a\s+n\/a\s+n\/a$/m);
  assert.ok(table.output.includes(`  claude-signin: the claude.ai sign-in stored on this machine ends in 6 days, on ${WHEN}\n`), table.output);
  assert.ok(table.output.includes(`  claude-signin (claude):\n    ${SIGNIN_FIX}\n    claude auth login\n`), table.output);
  assert.ok(table.output.indexOf('\nNotes:\n') < table.output.indexOf('\nFix:\n'), 'the notes come before the fixes');

  const json = await runDoctor(['--json'], { signin: () => READ, at });
  const row = JSON.parse(json.output).find((item) => item.id === 'claude-signin');
  assert.deepEqual(row, {
    id: 'claude-signin',
    version: null,
    installed: 'n/a',
    claude: 'stale',
    codex: 'n/a',
    project: 'n/a',
    upToDate: 'n/a',
    fix: { claude: [SIGNIN_FIX, 'claude auth login'] },
    expiresAt: EXPIRES,
    daysLeft: 6,
    note: `the claude.ai sign-in stored on this machine ends in 6 days, on ${WHEN}`,
    gaps: [{ dimension: 'claude', state: 'stale', fix: [SIGNIN_FIX, 'claude auth login'] }],
  });
});

test('doctor shows the row unknown, no gap, when the date cannot be read, and the note says why', async () => {
  const why = 'claude auth status prints no loginExpiresAt, which Claude Code prints from 2.1.318 on for a stored claude.ai sign-in: the Claude CLI is older, or signed in another way';
  const { code, output } = await runDoctor([], { signin: () => ({ expiresAt: null, stored: null, why }), at: '2026-11-11T06:30:00.000Z' });
  assert.equal(code, 0);
  assert.match(output, /^claude-signin\s+n\/a\s+unknown\s+n\/a\s+n\/a\s+n\/a$/m);
  assert.ok(output.includes(`  claude-signin: when the claude.ai sign-in stored on this machine ends cannot be read: ${why}\n`), output);
  assert.doesNotMatch(output, /claude-signin \(claude\)/);
});

test('doctor shows a CLI that is not signed in as a gap whose fix is the sign-in, under Notes and under Fix', async () => {
  const why = 'the Claude CLI says it is not signed in';
  const { code, output } = await runDoctor([], { signin: () => ({ expiresAt: null, stored: false, why, signedOut: true }), at: '2026-11-24T06:30:00.000Z' });
  assert.equal(code, 0);
  assert.match(output, /^claude-signin\s+n\/a\s+missing\s+n\/a\s+n\/a\s+n\/a$/m);
  assert.ok(output.includes(`  claude-signin: ${why}\n`), output);
  assert.ok(output.includes(`  claude-signin (claude):\n    ${SIGNED_OUT_FIX}\n    claude auth login\n`), output);
});

test('doctor shows the row unknown and still exits 0 when the reader throws', async () => {
  const { code, output } = await runDoctor([], {
    signin: () => {
      throw new Error('a reader that breaks');
    },
    at: '2026-11-11T06:30:00.000Z',
  });
  assert.equal(code, 0);
  assert.match(output, /^claude-signin\s+n\/a\s+unknown\s+n\/a\s+n\/a\s+n\/a$/m);
  assert.ok(output.includes('  claude-signin: when the claude.ai sign-in stored on this machine ends cannot be read: the reading failed\n'), output);
});

test('doctor shows the row n/a and prints no Notes for a home that is not asked', async () => {
  const { output } = await runDoctor([], { signin: () => ({ expiresAt: null, stored: null, why: null, asked: false }), at: '2026-11-11T06:30:00.000Z' });
  assert.match(output, /^claude-signin\s+n\/a\s+n\/a\s+n\/a\s+n\/a\s+n\/a$/m);
  assert.doesNotMatch(output, /^Notes:$/m, 'no row has a note');
});

test('the session-start hook never reads the sign-in: a reading takes seconds', async () => {
  const { code, asked } = await runDoctor(['--hook'], { signin: () => READ, at: '2026-11-17T16:11:04.604Z' });
  assert.equal(code, 0);
  assert.deepEqual(asked, []);
});

test('doctorCommand gives the claude-signin row its reader, asked for the home it was given', () => {
  const source = fs.readFileSync(new URL('./doctor.mjs', import.meta.url), 'utf8');
  assert.match(source, /signin: \(home\) => readSigninExpiry\(\{ home \}\)/);
});
