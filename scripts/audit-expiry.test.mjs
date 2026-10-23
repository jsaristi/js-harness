// Tests of scripts/audit-expiry.mjs. The script runs against temporary git repositories laid out like this one,
// with the day pinned by --today, so a test never depends on the clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewDates } from './audit-expiry.mjs';

const SCRIPT = fileURLToPath(new URL('./audit-expiry.mjs', import.meta.url));

/** A git repository holding `files` (path -> text), staged so `git ls-files` lists them; removed after `use`. */
function withRepo(files, use) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-expiry-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: root });
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    spawnSync('git', ['add', '-A'], { cwd: root });
    return use(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const run = (root, ...args) => spawnSync(process.execPath, [SCRIPT, '--cwd', root, ...args], { encoding: 'utf8' });

test('reviewDates finds each "Reviewed by <date>" of a text with its line', () => {
  assert.deepEqual(reviewDates('a\n- Cost: one. Reviewed by 2026-11-16.\nReviewed by 2026-01-02 and more'), [
    { line: 2, date: '2026-11-16' },
    { line: 3, date: '2026-01-02' },
  ]);
});

test('a date before today is a finding; today and later are not', () => {
  withRepo({ 'bin/lib/p.mjs': '// Reviewed by 2026-10-22.\n// Reviewed by 2026-10-23.\n// Reviewed by 2026-11-01.\n' }, (root) => {
    const result = run(root, '--today', '2026-10-23');
    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(result.stdout.trim().split('\n'), [
      'expired  bin/lib/p.mjs:1  reviewed by 2026-10-22, 1 day before 2026-10-23',
      '1 findings, 0 allowed',
    ]);
  });
});

test('only shipped files are read: tests and files outside bin/ are not', () => {
  withRepo(
    {
      'bin/a.test.mjs': '// Reviewed by 2020-01-01.\n',
      'bin/lib/b.testkit.mjs': '// Reviewed by 2020-01-01.\n',
      'docs/x.md': 'Reviewed by 2020-01-01.\n',
      'bin/ok.mjs': '// nothing\n',
    },
    (root) => {
      const result = run(root, '--today', '2026-10-23');
      assert.equal(result.status, 0, result.stdout);
      assert.equal(result.stdout.trim(), '0 findings, 0 allowed');
    },
  );
});

test('an allow entry hides its finding, and one that matches nothing is stale-allow', () => {
  withRepo({ 'bin/p.mjs': '// Reviewed by 2026-01-01.\n' }, (root) => {
    const allow = path.join(root, 'allow.json');
    fs.writeFileSync(allow, JSON.stringify([{ kind: 'expired', location: 'bin/p.mjs:1', why: 'renewed by its owner' }]));
    let result = run(root, '--today', '2026-10-23', '--allow', allow);
    assert.equal(result.status, 0, result.stdout);
    assert.equal(result.stdout.trim(), '0 findings, 1 allowed');
    fs.writeFileSync(allow, JSON.stringify([{ kind: 'expired', location: 'bin/q.mjs:9', why: 'gone' }]));
    result = run(root, '--today', '2026-10-23', '--allow', allow);
    assert.equal(result.status, 1);
    assert.deepEqual(result.stdout.trim().split('\n'), [
      'expired  bin/p.mjs:1  reviewed by 2026-01-01, 295 days before 2026-10-23',
      'stale-allow  bin/q.mjs:9  no expired finding at this location (gone)',
      '2 findings, 0 allowed',
    ]);
  });
});

test('--json prints the findings and the allowed count as one object', () => {
  withRepo({ 'bin/p.mjs': '// Reviewed by 2026-10-20.\n' }, (root) => {
    const result = run(root, '--today', '2026-10-23', '--json');
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout), {
      findings: [{ kind: 'expired', location: 'bin/p.mjs:1', detail: 'reviewed by 2026-10-20, 3 days before 2026-10-23' }],
      allowed: 0,
    });
  });
});

test('an allow-list named and missing, or not an array of entries, exits 2', () => {
  withRepo({ 'bin/p.mjs': '// Reviewed by 2026-01-01.\n' }, (root) => {
    let result = run(root, '--today', '2026-10-23', '--allow', path.join(root, 'none.json'));
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^cannot read the allow-list .*none\.json/);
    const allow = path.join(root, 'allow.json');
    for (const text of ['{ not json', '{"kind":"expired"}', '[{"kind":"expired","location":"bin/p.mjs:1"}]']) {
      fs.writeFileSync(allow, text);
      result = run(root, '--today', '2026-10-23', '--allow', allow);
      assert.equal(result.status, 2, text);
      assert.match(result.stderr, /^the allow-list .*allow\.json is not a JSON array of \{ kind, location, why \}/, text);
    }
  });
});

test('an unknown argument and a malformed --today exit 2', () => {
  let result = spawnSync(process.execPath, [SCRIPT, '--nope'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^unknown argument: --nope\n/);
  result = spawnSync(process.execPath, [SCRIPT, '--today', '23-10-2026'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--today takes a date as YYYY-MM-DD/);
});
