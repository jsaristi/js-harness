import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIXED_LOAD_BUDGET, fixedLoadRow, measureFixedLoad } from './fixed-load.mjs';

function withFixture(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-fixed-load-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-fixed-load-cwd-'));
  try {
    fn(home, cwd);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

function slug(dir) {
  return path.resolve(dir).replace(/[^A-Za-z0-9]/g, '-');
}

function assistant(input, creation, read, timestamp = '2026-10-15T09:48:30.469Z') {
  const usage = { input_tokens: input, cache_creation_input_tokens: creation, cache_read_input_tokens: read };
  return { type: 'assistant', timestamp, message: { role: 'assistant', usage } };
}

/** Writes one transcript of `records` (objects or raw lines) for `project`, its mtime `minutesAgo` back. */
function transcript(home, project, id, records, minutesAgo) {
  const dir = path.join(home, '.claude', 'projects', slug(project));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.jsonl`);
  const lines = records.map((r) => (typeof r === 'string' ? r : JSON.stringify(r)));
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  const at = new Date(Date.now() - minutesAgo * 60_000);
  fs.utimesSync(file, at, at);
  return file;
}

const user = { type: 'user', message: { role: 'user', content: 'hello' } };

test('the first turn of each of the newest five sessions is input plus cache creation plus cache read', () => {
  withFixture((home, cwd) => {
    for (let i = 0; i < 6; i++) {
      // Session s0 is the newest; s5, the oldest and the smallest, is the sixth and is left out.
      const first = i === 5 ? assistant(1, 1000, 1000) : assistant(2, 50_000 + i * 1000, 55_000);
      transcript(home, cwd, `s${i}`, [user, first, assistant(2, 500, 200_000)], i + 1);
    }
    const { sessions, median } = measureFixedLoad({ home, cwd });
    assert.deepEqual(sessions.map((s) => s.id), ['s0', 's1', 's2', 's3', 's4']);
    assert.equal(sessions[0].tokens, 105_002);
    assert.equal(sessions[4].tokens, 109_002);
    assert.equal(sessions[0].at, '2026-10-15T09:48:30.469Z');
    assert.equal(median, 107_002);
  });
});

test('a session with no assistant turn yet, or a malformed line, is skipped without a throw', () => {
  withFixture((home, cwd) => {
    transcript(home, cwd, 'empty', [user, { type: 'system', content: '/context' }], 1);
    transcript(home, cwd, 'broken', ['{not json', user, assistant(2, 60_000, 50_000)], 2);
    const { sessions, median } = measureFixedLoad({ home, cwd });
    assert.deepEqual(sessions.map((s) => [s.id, s.tokens]), [['broken', 110_002]]);
    assert.equal(median, 110_002);
  });
});

test('a subagent record (sidechain) is not the session first turn', () => {
  withFixture((home, cwd) => {
    const side = { ...assistant(2, 5_000, 5_000), isSidechain: true };
    transcript(home, cwd, 'main', [user, side, assistant(2, 60_000, 50_000)], 1);
    assert.equal(measureFixedLoad({ home, cwd }).sessions[0].tokens, 110_002);
  });
});

test('from a worktree, the sessions of its main checkout are read too', () => {
  withFixture((home, cwd) => {
    const main = path.join(cwd, 'main');
    const worktree = path.join(cwd, 'wt');
    fs.mkdirSync(path.join(main, '.git', 'worktrees', 'wt'), { recursive: true });
    fs.mkdirSync(worktree);
    fs.writeFileSync(path.join(worktree, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'wt')}\n`);
    transcript(home, main, 'in-main', [user, assistant(2, 60_000, 50_000)], 2);
    transcript(home, worktree, 'in-wt', [user, assistant(2, 30_000, 33_000)], 1);
    const { sessions } = measureFixedLoad({ home, cwd: worktree });
    assert.deepEqual(sessions.map((s) => s.id), ['in-wt', 'in-main']);
  });
});

test('the row informs: the median first turn, its budget and one line per session; it never fails', () => {
  withFixture((home, cwd) => {
    transcript(home, cwd, 'a', [user, assistant(2, 40_000, 50_000)], 1);
    const row = fixedLoadRow(cwd, home);
    assert.equal(row.name, 'fixed load');
    assert.equal(row.info, true);
    assert.equal(row.pass, true);
    assert.equal(row.detail, `90002 tokens at the first turn, median of the latest 1 session (budget ${FIXED_LOAD_BUDGET})`);
    assert.equal(row.lines.length, 1);
    assert.match(row.lines[0], /^ +90002 {2}2026-10-15T09:48:30\.469Z {2}a$/);
  });
});

test('over the budget, the row carries a warning and still passes', () => {
  withFixture((home, cwd) => {
    transcript(home, cwd, 'a', [user, assistant(2, 60_000, 50_000)], 1);
    transcript(home, cwd, 'b', [user, assistant(2, 70_000, 50_000)], 2);
    const row = fixedLoadRow(cwd, home);
    assert.equal(row.pass, true);
    assert.match(row.detail, /^110002 tokens at the first turn, median of the latest 2 sessions/);
    assert.equal(row.lines.at(-1), `warning: the fixed load is over its budget of ${FIXED_LOAD_BUDGET} tokens (odd/tasks/fixed-load.md)`);
  });
});

test('with no transcript of the project, the row says so and passes', () => {
  withFixture((home, cwd) => {
    const row = fixedLoadRow(cwd, home);
    assert.equal(row.pass, true);
    assert.equal(row.detail, 'no session transcript of this project found');
    assert.deepEqual(row.lines, []);
  });
});

test('the budget is his 100 mil', () => {
  assert.equal(FIXED_LOAD_BUDGET, 100_000);
});

test('one headless run or one long first message does not move the median', () => {
  withFixture((home, cwd) => {
    const firsts = [20_000, 107_000, 108_000, 109_000, 190_000];
    firsts.forEach((tokens, i) => transcript(home, cwd, `s${i}`, [user, assistant(0, tokens, 0)], i + 1));
    assert.equal(measureFixedLoad({ home, cwd }).median, 108_000);
  });
});

test('a first turn after a line longer than one read, with characters cut across reads, is still found', () => {
  withFixture((home, cwd) => {
    // Far more than one 64 KiB read, in characters of two and four bytes, so reads end inside them.
    const long = { type: 'user', message: { role: 'user', content: 'ñ🙂'.repeat(40_000) } };
    transcript(home, cwd, 'long', [long, assistant(2, 60_000, 50_000)], 1);
    assert.equal(measureFixedLoad({ home, cwd }).sessions[0].tokens, 110_002);
  });
});

test('a transcript that cannot be read is skipped, and the row still informs', () => {
  withFixture((home, cwd) => {
    transcript(home, cwd, 'good', [user, assistant(2, 60_000, 50_000)], 2);
    // A directory named like a transcript: it opens on POSIX and fails at the read.
    fs.mkdirSync(path.join(home, '.claude', 'projects', slug(cwd), 'odd.jsonl'));
    const row = fixedLoadRow(cwd, home);
    assert.equal(row.pass, true);
    assert.match(row.detail, /^110002 tokens at the first turn, median of the latest 1 session /);
  });
});

test('a synthetic assistant record of the host is not the first turn', () => {
  withFixture((home, cwd) => {
    const synthetic = { ...assistant(0, 0, 0), message: { role: 'assistant', model: '<synthetic>', usage: { input_tokens: 0, output_tokens: 0 } } };
    transcript(home, cwd, 's', [user, synthetic, assistant(2, 60_000, 50_000)], 1);
    assert.equal(measureFixedLoad({ home, cwd }).sessions[0].tokens, 110_002);
  });
});

test('a record whose usage reports no input at all is not the first turn', () => {
  withFixture((home, cwd) => {
    // The host writes the turn it resumes after a compaction with zeros at the top and its real usage in
    // `iterations` (seen 2026-10-15 in a transcript of this project); measured, it would be a session of 0.
    const zero = assistant(0, 0, 0);
    zero.message.usage.iterations = [{ input_tokens: 2, cache_creation_input_tokens: 1117, cache_read_input_tokens: 465_288 }];
    transcript(home, cwd, 's', [user, zero, zero, assistant(2, 60_000, 50_000)], 1);
    assert.equal(measureFixedLoad({ home, cwd }).sessions[0].tokens, 110_002);
  });
});
