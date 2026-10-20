// odd/tasks/clean.md, S3, S5, S6 and S8: `js-harness clean` as a person runs it, on a scratch home and temp folder
// with fake tools, so nothing of the real machine is read or deleted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanMain, USAGE } from './clean.mjs';
import { fixture } from './lib/clean.testkit.mjs';

const BIN = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));

/** Runs `cleanMain` on the fixture with its lines captured; `extra` overrides the deps. */
async function clean(argv, setup, extra = {}) {
  const out = [];
  const err = [];
  const code = await cleanMain(argv, {}, {
    scan: setup.deps,
    interactive: false,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    ...extra,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const names = (folder) => fs.readdirSync(folder).sort();

test('clean with no flags lists each kind with its reason, items, sizes and a total, and deletes nothing', async (t) => {
  const setup = fixture(t);
  const before = names(setup.releases);
  const { code, out } = await clean([], setup);
  assert.equal(code, 0);
  for (const id of ['codex-releases', 'claude-versions', 'claude-desktop-cli', 'codex-staging', 'temp-scratch', 'npm-cache', 'pnpm-store', 'uv-cache']) {
    assert.match(out, new RegExp(`^${id} `, 'm'), id);
  }
  assert.match(out, /0\.157\.1-x86_64/);
  assert.match(out, /up to/);
  assert.match(out, /^Total: /m);
  assert.match(out, /js-harness clean --apply/);
  assert.deepEqual(names(setup.releases), before);
  assert.ok(fs.existsSync(path.join(setup.home, '.js-harness', 'clean.json')), 'the list is also a measure');
});

test('clean --json prints the kinds as data', async (t) => {
  const setup = fixture(t);
  const { code, out } = await clean(['--json'], setup);
  assert.equal(code, 0);
  const data = JSON.parse(out);
  assert.ok(Array.isArray(data.kinds));
  assert.equal(typeof data.total, 'number');
  assert.ok(data.kinds.find((kind) => kind.id === 'codex-releases').items.length === 2);
});

test('clean --apply with no terminal and no --kind deletes nothing and exits 1', async (t) => {
  const setup = fixture(t);
  const before = names(setup.releases);
  const { code, err } = await clean(['--apply'], setup);
  assert.equal(code, 1);
  assert.match(err, /--kind/);
  assert.deepEqual(names(setup.releases), before);
  assert.equal(fs.existsSync(path.join(setup.home, '.js-harness', 'clean-log.jsonl')), false);
});

test('clean --apply --kind deletes only the kinds it names and records them; --log prints the record', async (t) => {
  const setup = fixture(t);
  const versionsBefore = names(setup.versions);
  const { code, out } = await clean(['--apply', '--kind', 'codex-releases'], setup);
  assert.equal(code, 0);
  assert.deepEqual(names(setup.releases), ['0.161.0-x86_64', '0.162.0-x86_64']);
  assert.deepEqual(names(setup.versions), versionsBefore);
  assert.match(out, /Deleted 2/);
  const log = await clean(['--log'], setup);
  assert.equal(log.code, 0);
  assert.match(log.out, /codex-releases/);
  assert.match(log.out, /0\.157\.1-x86_64/);
  assert.match(log.out, /deleted/);
});

test('clean --apply in a terminal asks y/N per kind and deletes only the yeses', async (t) => {
  const setup = fixture(t);
  const asked = [];
  const ask = async (question) => {
    asked.push(question);
    return question.includes('claude-versions');
  };
  const { code } = await clean(['--apply'], setup, { interactive: true, ask });
  assert.equal(code, 0);
  assert.ok(asked.length >= 5, 'one question per kind');
  assert.deepEqual(names(setup.versions), ['2.1.301', '2.1.302']);
  assert.equal(names(setup.releases).length, 4);
});

test('an unknown kind, an unknown flag and --kind without --apply are usage errors', async (t) => {
  const setup = fixture(t);
  for (const argv of [['--apply', '--kind', 'bogus'], ['--bogus'], ['--kind', 'codex-releases'], ['--apply', '--kind']]) {
    const { code, err } = await clean(argv, setup);
    assert.equal(code, 2, argv.join(' '));
    assert.match(err, /Usage: js-harness clean/);
  }
  assert.equal(names(setup.releases).length, 4);
});

test('clean --measure writes the measure and deletes nothing', async (t) => {
  const setup = fixture(t);
  fs.mkdirSync(path.join(setup.home, '.js-harness'), { recursive: true });
  const { code } = await clean(['--measure'], setup);
  assert.equal(code, 0);
  const measure = JSON.parse(fs.readFileSync(path.join(setup.home, '.js-harness', 'clean.json'), 'utf8'));
  assert.ok(measure.total > 0);
  assert.equal(names(setup.releases).length, 4);
});

test('clean --measure writes nothing when the harness home is gone', async (t) => {
  const setup = fixture(t);
  const { code } = await clean(['--measure'], setup);
  assert.equal(code, 0);
  assert.equal(fs.existsSync(path.join(setup.home, '.js-harness')), false);
});

test('js-harness clean --help prints the usage and runs nothing', () => {
  const result = spawnSync(process.execPath, [BIN, 'clean', '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.startsWith(USAGE.split('\n')[0]));
});
