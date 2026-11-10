// `ticks --hook`, the session start's word on the heartbeat's three workshop ticks (odd/tasks/audit-u3-heartbeat-ticks.md):
// the age of what each tick leaves, the loop on record, the idea-watch row, and a hook that never fails a session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectSlug } from '../../bin/lib/sessions.mjs';
import { TICKS_STALE_HOURS, ticksMain } from './ticks.mjs';

const HOUR = 3600 * 1000;
// 2026-11-10 at 14:00 UTC: 2026-11-09 settled at 01:00 (two gate-max after midnight), 13 hours before.
const NOW = Date.parse('2026-11-10T14:00:00Z');

/** A home and a project folder with no git, so the project is the folder itself; `fn` gets them and a writer. */
async function withWorld(fn) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-ticks-'));
  const home = path.join(scratch, 'home');
  const cwd = path.join(scratch, 'project');
  fs.mkdirSync(cwd, { recursive: true });
  const slug = projectSlug(cwd);
  const write = (parts, text) => {
    const file = path.join(home, '.js-harness', ...parts);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const at = (ms) => `${new Date(ms).toISOString()}\n`;
  const set = {
    snapshot: (day) => write(['throughput', slug, `${day}.json`], '{}'),
    windows: (ms) => write(['channel', 'windows-daily', slug, 'asked'], at(ms)),
    host: (ms) => write(['channel', 'host-watch', slug, 'asked'], at(ms)),
    loop: (command) => write(['loops', slug, 'heartbeat.json'], JSON.stringify({ schema: 'js-harness.loop/v1', name: 'heartbeat', owner: 'o', pid: 1, createdAt: 1, startedAt: '2026-11-10T06:15:54.144Z', purpose: 'p', until: 'u', command, cwd })),
  };
  try {
    return await fn({ home, cwd, set });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

async function runTicks(argv, { home, cwd }, { now = NOW, ideas = async () => null, fileSystem } = {}) {
  const out = [];
  const err = [];
  const code = await ticksMain(argv, { cwd, env: {}, homedir: () => home, now: () => now, stdout: (line) => out.push(line), stderr: (line) => err.push(line), ideas, ...(fileSystem ? { fileSystem } : {}) });
  return { code, out, err };
}

const messageOf = (out) => {
  assert.equal(out.length, 1, `one line: ${out.join('\n')}`);
  return JSON.parse(out[0]).systemMessage;
};

test('a stale row against a home whose newest snapshot is two days old: the hook exits 0 and says it', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-08');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    const { code, out, err } = await runTicks(['--hook'], { home, cwd });
    assert.equal(code, 0);
    assert.deepEqual(err, []);
    const message = messageOf(out);
    assert.match(message, /throughput: the newest snapshot is 2026-11-08, and 2026-11-09, settled at 2026-11-10T01:00:00\.000Z, has none/);
    assert.match(message, /node workshop\/js-harness-workshop\.mjs loop heartbeat/);
    assert.doesNotMatch(message, /windows-daily|host-watch/);
  });
});

test('the same home read by hand prints each tick and exits 1 on the stale one', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-08');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    const { code, out } = await runTicks([], { home, cwd });
    assert.equal(code, 1);
    assert.ok(out.some((line) => /^STALE {2}throughput: /.test(line)), out.join('\n'));
    assert.ok(out.some((line) => /^ok {5}windows-daily: last read at 2026-11-10T13:00:00\.000Z/.test(line)), out.join('\n'));
    assert.ok(out.some((line) => /^ok {5}host-watch: last read at 2026-11-10T13:00:00\.000Z/.test(line)), out.join('\n'));
  });
});

test('a missing day still inside its grace is not stale: the heartbeat keeps it within minutes once it runs', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-08');
    // 2026-11-09 settled at 01:00 UTC; at 05:00 it has waited 4 hours, under the grace.
    const now = Date.parse('2026-11-10T05:00:00Z');
    set.windows(now - HOUR);
    set.host(now - HOUR);
    const { code, out } = await runTicks(['--hook'], { home, cwd }, { now });
    assert.equal(code, 0);
    assert.deepEqual(out, []);
  });
});

test('every tick fresh: the hook prints nothing, and the hand run exits 0', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-08');
    set.snapshot('2026-11-09');
    set.windows(NOW - HOUR);
    set.host(NOW - 2 * HOUR);
    assert.deepEqual((await runTicks(['--hook'], { home, cwd })).out, []);
    assert.equal((await runTicks([], { home, cwd })).code, 0);
  });
});

test(`an asked file older than ${TICKS_STALE_HOURS} hours, or none, is a stale tick with its last read`, async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-09');
    set.windows(Date.parse('2026-11-03T02:18:40.158Z'));
    const message = messageOf((await runTicks(['--hook'], { home, cwd })).out);
    assert.match(message, /windows-daily: last read at 2026-11-03T02:18:40\.158Z/);
    assert.match(message, /host-watch: never read/);
    assert.doesNotMatch(message, /throughput/);
  });
});

test('no snapshot kept at all is a stale throughput tick', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    assert.match(messageOf((await runTicks(['--hook'], { home, cwd })).out), /throughput: no snapshot is kept/);
  });
});

test('a heartbeat on record that runs the product\'s command is named as the cause; the workshop\'s is not', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-01');
    set.loop(['js-harness', 'loop', 'heartbeat']);
    const product = messageOf((await runTicks(['--hook'], { home, cwd })).out);
    assert.match(product, /the heartbeat on record \(since 2026-11-10T06:15:54\.144Z\) runs js-harness loop heartbeat, the product's, which runs no tick/);
    set.loop(['node', 'workshop/js-harness-workshop.mjs', 'loop', 'heartbeat']);
    assert.doesNotMatch(messageOf((await runTicks(['--hook'], { home, cwd })).out), /on record/);
  });
});

test('the idea-watch row reaches the session start: an unread release is said, none or no record says nothing', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-09');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    const asked = [];
    const ideas = async (project) => {
      asked.push(project);
      return { last: '4.3.1', unread: ['4.4.0'] };
    };
    const message = messageOf((await runTicks(['--hook'], { home, cwd }, { ideas })).out);
    assert.match(message, /idea-watch: 1 release not yet read \(the last read is v4\.3\.1\): v4\.4\.0/);
    assert.deepEqual(asked, [cwd]);
    assert.deepEqual((await runTicks(['--hook'], { home, cwd }, { ideas: async () => ({ last: '4.4.0', unread: [] }) })).out, []);
    assert.deepEqual((await runTicks(['--hook'], { home, cwd }, { ideas: async () => null })).out, []);
  });
});

test('the hook never fails a session: a reading that throws is said in the message, never on stderr, and it exits 0', async () => {
  await withWorld(async ({ home, cwd, set }) => {
    set.snapshot('2026-11-09');
    set.windows(NOW - HOUR);
    set.host(NOW - HOUR);
    const broken = {
      readdirSync: () => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      },
      readFileSync: () => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      },
    };
    const ideas = async () => {
      throw new Error('could not list the tags');
    };
    const { code, out, err } = await runTicks(['--hook'], { home, cwd }, { fileSystem: broken, ideas });
    assert.equal(code, 0);
    assert.deepEqual(err, []);
    const message = messageOf(out);
    assert.match(message, /throughput: the snapshots could not be read \(EACCES\)/);
    assert.match(message, /windows-daily: could not be read \(EACCES\)/);
    assert.match(message, /idea-watch: could not be read \(could not list the tags\)/);
  });
});

test('--help prints the usage, and an argument it does not know is a usage error, with --hook too', async () => {
  await withWorld(async ({ home, cwd }) => {
    const help = await runTicks(['--help'], { home, cwd });
    assert.equal(help.code, 0);
    assert.match(help.out.join('\n'), /^Usage: node workshop\/js-harness-workshop\.mjs ticks/);
    for (const argv of [['--hours'], ['--hook', '--quiet']]) {
      const bad = await runTicks(argv, { home, cwd });
      assert.equal(bad.code, 2);
      assert.deepEqual(bad.out, []);
      assert.match(bad.err.join('\n'), /unknown argument/);
    }
  });
});
