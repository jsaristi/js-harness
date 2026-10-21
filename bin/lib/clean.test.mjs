// odd/tasks/clean.md: the scan of the regenerable leftovers, their deletion and its record, on a scratch home and a
// scratch temp folder only. The tools (npm, pnpm, go, uv, claude) are fakes that record what they were asked, so no
// test reads or deletes anything of the real machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  KIND_IDS,
  applyKinds,
  backgroundMeasure,
  startMeasure,
  cleanNotice,
  cleanRow,
  measureDue,
  readLog,
  readMeasure,
  refusal,
  scan,
  writeMeasure,
  CLEAN_EVERY_DAYS,
  CLEAN_THRESHOLD_BYTES,
} from './clean.mjs';
import { DAY, NOW, file, fixture } from './clean.testkit.mjs';

const kindOf = (kinds, id) => kinds.find((kind) => kind.id === id);
const pathsOf = (kinds, id) => (kindOf(kinds, id)?.items ?? []).map((item) => path.basename(item.path)).sort();

test('the scan lists every old Codex release but the current one and the one auto-update names', (t) => {
  const { deps } = fixture(t);
  const kinds = scan(deps);
  assert.deepEqual(pathsOf(kinds, 'codex-releases'), ['0.157.1-x86_64', '0.159.1-x86_64']);
  assert.equal(kindOf(kinds, 'codex-releases').bytes, 3000);
  assert.match(kindOf(kinds, 'codex-releases').why, /current/);
});

test('with no current Codex release to read, no release is listed', (t) => {
  const { deps, releases } = fixture(t);
  fs.rmSync(path.join(path.dirname(releases), 'current'), { recursive: false, force: true });
  assert.deepEqual(pathsOf(scan(deps), 'codex-releases'), []);
});

test('the scan lists the old Claude Code versions, keeping the highest and the running one', (t) => {
  const { deps } = fixture(t);
  assert.deepEqual(pathsOf(scan(deps), 'claude-versions'), ['2.1.296', '2.1.300']);
});

test('with the running Claude version unknown, no Claude version is listed', (t) => {
  const { deps } = fixture(t);
  const run = (command, args) => (command === 'claude' ? { status: 1, stdout: '' } : deps.run(command, args));
  assert.deepEqual(pathsOf(scan({ ...deps, run }), 'claude-versions'), []);
});

test('the scan lists the desktop app\'s old Code tab CLIs, keeping the highest', (t) => {
  const { deps } = fixture(t);
  assert.deepEqual(pathsOf(scan(deps), 'claude-desktop-cli'), ['2.1.299']);
});

test('the scan lists only the Codex staging entries older than the scratch age', (t) => {
  const { deps } = fixture(t);
  assert.deepEqual(pathsOf(scan(deps), 'codex-staging'), ['marketplace-upgrade-old']);
});

test('the scan lists the old tmp.* and js-harness-* scratch folders, never a new one, another name or a worktree', (t) => {
  const { deps } = fixture(t);
  assert.deepEqual(pathsOf(scan(deps), 'temp-scratch'), ['js-harness-home-old', 'tmp.oldOne']);
});

test('the package caches are listed only for the tools that answer, from the folder each names', (t) => {
  const { deps, npmCache, pnpmStore, uvCache } = fixture(t);
  const kinds = scan(deps);
  assert.equal(kindOf(kinds, 'go-modcache'), undefined);
  assert.deepEqual(kindOf(kinds, 'npm-cache').items.map((item) => item.path), [npmCache]);
  assert.deepEqual(kindOf(kinds, 'npm-cache').command, ['npm', 'cache', 'clean', '--force']);
  assert.equal(kindOf(kinds, 'npm-cache').bytes, 1200);
  assert.deepEqual(kindOf(kinds, 'pnpm-store').items.map((item) => item.path), [pnpmStore]);
  assert.equal(kindOf(kinds, 'pnpm-store').upTo, true);
  assert.deepEqual(kindOf(kinds, 'pnpm-store').command, ['pnpm', 'store', 'prune']);
  assert.deepEqual(kindOf(kinds, 'uv-cache').items.map((item) => item.path), [uvCache]);
  assert.deepEqual(kindOf(kinds, 'uv-cache').command, ['uv', 'cache', 'clean']);
});

test('every kind the scan returns is a known kind, and the scan writes nothing', (t) => {
  const { deps, home } = fixture(t);
  for (const kind of scan(deps)) assert.ok(KIND_IDS.includes(kind.id), kind.id);
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
});

test('apply deletes the items of the confirmed kinds only, and records each deletion', (t) => {
  const { deps, home, releases, versions } = fixture(t);
  const kinds = scan(deps);
  const results = applyKinds(kinds.filter((kind) => kind.id === 'codex-releases'), deps);
  assert.deepEqual(fs.readdirSync(releases).sort(), ['0.161.0-x86_64', '0.162.0-x86_64']);
  assert.deepEqual(fs.readdirSync(versions).sort(), ['2.1.296', '2.1.300', '2.1.301', '2.1.302']);
  assert.equal(results.filter((entry) => entry.result === 'deleted').length, 2);
  const log = readLog(home);
  assert.equal(log.length, 2);
  for (const entry of log) {
    assert.equal(entry.kind, 'codex-releases');
    assert.equal(entry.result, 'deleted');
    assert.equal(entry.at, NOW.toISOString());
    assert.ok(entry.bytes > 0);
    assert.ok(entry.path.startsWith(releases));
  }
});

test('a folder in use fails whole, is recorded as failed and the rest go on', (t) => {
  const { deps, home, releases } = fixture(t);
  const kinds = scan(deps).filter((kind) => kind.id === 'codex-releases');
  const rename = (from, to) => {
    if (from.endsWith('0.157.1-x86_64')) throw Object.assign(new Error('resource busy'), { code: 'EBUSY' });
    fs.renameSync(from, to);
  };
  applyKinds(kinds, { ...deps, rename });
  assert.deepEqual(fs.readdirSync(releases).sort(), ['0.157.1-x86_64', '0.161.0-x86_64', '0.162.0-x86_64']);
  assert.ok(fs.existsSync(path.join(releases, '0.157.1-x86_64', 'codex.exe')));
  const log = readLog(home);
  assert.deepEqual(log.map((entry) => entry.result).sort(), ['deleted', 'failed']);
  assert.match(log.find((entry) => entry.result === 'failed').error, /EBUSY|busy/);
});

test('a package cache is cleaned through its own tool, and the record names the command and what it freed', (t) => {
  const { deps, home, npmCache, tools } = fixture(t);
  const kinds = scan(deps).filter((kind) => kind.id === 'npm-cache');
  applyKinds(kinds, deps);
  assert.ok(tools.calls.includes('npm cache clean --force'));
  assert.ok(fs.existsSync(npmCache), 'the cache folder itself is left to npm');
  const [entry] = readLog(home);
  assert.equal(entry.kind, 'npm-cache');
  assert.equal(entry.path, 'npm cache clean --force');
  assert.equal(entry.bytes, 1200);
  assert.equal(entry.result, 'deleted');
});

test('a cache inside a git worktree or holding a protected path is refused, and its tool is not run', (t) => {
  const { deps, home, root, tools } = fixture(t);
  const checkout = path.join(root, 'checkout');
  file(path.join(checkout, '.git'), 10);
  file(path.join(checkout, 'gomod', 'cache', 'm'), 400);
  const answers = { 'go env GOMODCACHE': path.join(checkout, 'gomod'), 'uv cache dir': home };
  const run = (command, args) => {
    const line = [command, ...args].join(' ');
    if (line in answers) return { status: 0, stdout: `${answers[line]}
` };
    return deps.run(command, args);
  };
  file(path.join(home, '.claude', 'projects', 'p', 't.jsonl'), 10);
  const kinds = scan({ ...deps, run }).filter((kind) => kind.id === 'go-modcache' || kind.id === 'uv-cache');
  assert.equal(kinds.length, 2);
  applyKinds(kinds, { ...deps, run });
  assert.ok(!tools.calls.includes('go clean -modcache'));
  assert.ok(!tools.calls.includes('uv cache clean'));
  const entries = readLog(home);
  assert.deepEqual(entries.map((entry) => [entry.kind, entry.result]).sort(), [['go-modcache', 'refused'], ['uv-cache', 'refused']]);
  assert.match(entries.find((entry) => entry.kind === 'go-modcache').error, /git worktree/);
  assert.match(entries.find((entry) => entry.kind === 'uv-cache').error, /Claude Code transcripts/);
  assert.ok(fs.existsSync(path.join(checkout, 'gomod', 'cache', 'm')));
});

test('a tool that fails is recorded as failed', (t) => {
  const { deps, home } = fixture(t);
  const kinds = scan(deps).filter((kind) => kind.id === 'uv-cache');
  const run = (command, args) => (command === 'uv' && args[1] === 'clean' ? { status: 2, stdout: '', stderr: 'locked' } : deps.run(command, args));
  applyKinds(kinds, { ...deps, run });
  assert.equal(readLog(home)[0].result, 'failed');
});

test('refusal keeps the protected paths, anything inside a git worktree and anything off the kind\'s folder', (t) => {
  const { deps, home, releases, root } = fixture(t);
  const inRoot = { root: releases };
  const protectedPaths = [
    path.join(home, '.claude', 'projects'),
    path.join(home, '.claude', 'projects', 'D--p', 'a.jsonl'),
    path.join(home, '.engram'),
    path.join(home, '.js-harness'),
    path.join(home, '.js-harness', 'clean-log.jsonl'),
  ];
  for (const target of protectedPaths) assert.ok(refusal(target, { ...deps, root: path.dirname(target) }), target);
  assert.ok(refusal(home, { ...deps, root: path.dirname(home) }), 'a folder holding a protected path');
  assert.match(refusal(path.join(releases, '0.162.0-x86_64'), { ...deps, ...inRoot }), /current/);
  assert.match(refusal(path.join(root, 'elsewhere'), { ...deps, ...inRoot }), /known/);
  const repo = path.join(root, 'repo');
  file(path.join(repo, '.git', 'HEAD'), 5);
  file(path.join(repo, 'build', 'out'), 5);
  assert.match(refusal(path.join(repo, 'build'), { ...deps, root: repo }), /worktree/);
  assert.equal(refusal(path.join(releases, '0.157.1-x86_64'), { ...deps, ...inRoot }), null);
});

test('apply refuses an item the refusal names, records it and deletes nothing of it', (t) => {
  const { deps, home } = fixture(t);
  const projects = path.join(home, '.claude', 'projects');
  file(path.join(projects, 'D--p', 'a.jsonl'), 10);
  const forged = [{ id: 'temp-scratch', root: path.join(home, '.claude'), items: [{ path: projects, bytes: 10 }] }];
  applyKinds(forged, deps);
  assert.ok(fs.existsSync(path.join(projects, 'D--p', 'a.jsonl')));
  assert.equal(readLog(home)[0].result, 'refused');
});

test('the measure is due with none, after the interval, and not while one started within the hour', () => {
  const day = (days) => new Date(NOW.getTime() - days * DAY).toISOString();
  const now = () => NOW;
  assert.equal(CLEAN_EVERY_DAYS, 7);
  assert.equal(measureDue(null, now), true);
  assert.equal(measureDue({ measuredAt: day(8), total: 0 }, now), true);
  assert.equal(measureDue({ measuredAt: day(1), total: 0 }, now), false);
  assert.equal(measureDue({ measuredAt: day(8), total: 0, startedAt: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString() }, now), false);
  assert.equal(measureDue({ measuredAt: day(8), total: 0, startedAt: day(1) }, now), true);
});

test('the measure is written under the harness home and read back', (t) => {
  const { deps, home } = fixture(t);
  const kinds = scan(deps);
  writeMeasure(home, kinds, NOW);
  const measure = readMeasure(home);
  assert.equal(measure.measuredAt, NOW.toISOString());
  assert.equal(measure.total, kinds.filter((kind) => !kind.upTo).reduce((sum, kind) => sum + kind.bytes, 0));
  assert.deepEqual(measure.kinds.map((kind) => kind.id), kinds.map((kind) => kind.id));
  assert.ok(fs.existsSync(path.join(home, '.js-harness', 'clean.json')));
});

test('the clean row is a gap that recommends the clean once the total passes the threshold', (t) => {
  const { home } = fixture(t);
  assert.equal(CLEAN_THRESHOLD_BYTES, 2 * 1024 ** 3);
  const now = () => NOW;
  fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
  const write = (total) => fs.writeFileSync(path.join(home, '.js-harness', 'clean.json'), JSON.stringify({ measuredAt: NOW.toISOString(), total, kinds: [{ id: 'codex-releases', bytes: total }] }));
  write(3 * 1024 ** 3);
  const row = cleanRow({ home, now, start: null });
  assert.equal(row.id, 'clean');
  assert.equal(row.claude, 'stale');
  assert.match(row.fix.claude[0], /3\.0 GB/);
  assert.match(row.fix.claude[0], /js-harness clean/);
  assert.match(row.fix.claude[0], /--apply/);
  assert.match(cleanNotice(row), /3\.0 GB of leftovers to clean: js-harness clean/);
  write(1024 ** 3);
  const below = cleanRow({ home, now, start: null });
  assert.equal(below.claude, 'ok');
  assert.equal(cleanNotice(below), null);
});

test('the clean row starts the measure in the background when one is due, and records that it started', (t) => {
  const { home } = fixture(t);
  fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
  const started = [];
  const row = cleanRow({ home, now: () => NOW, start: (where) => started.push(where) });
  assert.deepEqual(started, [home]);
  assert.equal(row.claude, 'unknown');
  assert.equal(readMeasure(home).startedAt, NOW.toISOString());
  cleanRow({ home, now: () => NOW, start: (where) => started.push(where) });
  assert.equal(started.length, 1, 'a second session start within the hour starts none');
});

test('the background measure is only for the machine\'s own home, and off when JS_HARNESS_CLEAN_MEASURE is off', () => {
  assert.equal(backgroundMeasure({}, []), startMeasure);
  assert.equal(backgroundMeasure({ JS_HARNESS_CLEAN_MEASURE: 'off' }, []), null);
  assert.equal(backgroundMeasure({ JS_HARNESS_HOME: '/scratch' }, []), null);
  assert.equal(backgroundMeasure({}, ['--hook', '--home', '/scratch']), null);
});
