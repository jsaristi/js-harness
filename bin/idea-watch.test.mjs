import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ideaWatchMain } from './idea-watch.mjs';
import { RECORD, UPSTREAM } from './lib/idea-watch.mjs';
import { readManifest } from './lib/manifest.mjs';

// `js-harness idea-watch` (odd/tasks/idea-watch.md) through its main, in a temp home and project. git is handed in:
// no test fetches anything, and each records the calls it was given, in order, with what the manifest said then.

const TAGS = ['a\trefs/tags/v4.3.0', 'b\trefs/tags/v4.3.1', 'c\trefs/tags/v4.3.2', 'd\trefs/tags/v4.4.0', 'e\trefs/tags/v4.4.0-rc.1'].join('\n');
const SEEDED = '# gentle-ai update check\n\n## Releases read\n- v4.3.1 (read 2026-10-28): the full review.\n';

function world(record = SEEDED) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-idea-watch-'));
  const home = path.join(dir, 'home');
  const project = path.join(dir, 'project');
  fs.mkdirSync(home);
  if (record !== null) {
    fs.mkdirSync(path.join(project, 'odd', 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(project, RECORD), record);
  }
  const clone = path.join(home, '.js-harness', 'upstream', 'gentle-ai');
  return { dir, home, project, clone, remove: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** A git that answers ls-remote with TAGS, makes the clone's folder on clone, and gives `numstat` to a diff. */
function fakeGit(w, { numstat = '3\t1\tinternal/tui/model.go\0', fail = null } = {}) {
  const calls = [];
  const git = (args) => {
    calls.push({ args, recorded: readManifest(w.home)?.clones ?? [] });
    if (fail && args.includes(fail)) return { status: 128, stdout: '', stderr: `fatal: ${fail} failed` };
    if (args[0] === 'ls-remote') return { status: 0, stdout: TAGS, stderr: '' };
    if (args[0] === 'clone') fs.mkdirSync(args.at(-1), { recursive: true });
    if (args.includes('diff')) return { status: 0, stdout: numstat, stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  return { git, calls };
}

async function run(w, argv, deps = {}) {
  const out = [];
  const err = [];
  const code = await ideaWatchMain([...argv, '--project', w.project, '--home', w.home], {
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    now: () => new Date('2026-11-05T10:00:00Z'),
    env: {},
    ...deps,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('status counts the stable releases above the last one the record holds as read', async () => {
  const w = world();
  try {
    const { git, calls } = fakeGit(w);
    const { code, out } = await run(w, ['status'], { git });
    assert.equal(code, 0);
    assert.equal(out, '2 releases not yet read (the last read is v4.3.1): v4.3.2, v4.4.0');
    assert.deepEqual(calls.map((call) => call.args), [['ls-remote', '--tags', UPSTREAM]]);
  } finally {
    w.remove();
  }
});

test('status with nothing new says so, and a record that reads nothing counts every release', async () => {
  const w = world(`${SEEDED}- v4.3.2 (from v4.3.1, read 2026-11-05): ignore; 1 paths, all in ignored areas, +1 -0\n- v4.4.0 (from v4.3.2, read 2026-11-05): ignore; 1 paths, all in ignored areas, +1 -0\n`);
  try {
    assert.equal((await run(w, ['status'], { git: fakeGit(w).git })).out, '0 releases not yet read (the last read is v4.4.0)');
    fs.writeFileSync(path.join(w.project, RECORD), '# empty\n');
    assert.equal((await run(w, ['status'], { git: fakeGit(w).git })).out, '4 releases not yet read (none read yet): v4.3.0, v4.3.1, v4.3.2, v4.4.0');
  } finally {
    w.remove();
  }
});

test('draft records the clone before it fetches it, bare, then prints the oldest unread release against the last read', async () => {
  const w = world();
  try {
    const { git, calls } = fakeGit(w);
    const { code, out, err } = await run(w, ['draft'], { git });
    assert.equal(code, 0, err);
    const clone = calls.find((call) => call.args[0] === 'clone');
    assert.deepEqual(clone.args, ['clone', '--bare', '--quiet', UPSTREAM, w.clone]);
    assert.deepEqual(clone.recorded, [{ path: w.clone, url: UPSTREAM }], 'recorded before the clone was made');
    const diff = calls.find((call) => call.args.includes('diff'));
    assert.deepEqual(diff.args, ['-C', w.clone, 'diff', '--numstat', '-z', '--no-renames', 'v4.3.1', 'v4.3.2']);
    assert.match(out, /^### v4\.3\.2 \(from v4\.3\.1, read 2026-11-05\)$/m);
    assert.match(out, /^\| tui \|.*\| 1 \| \+3 -1 \| \? \|/m);
    assert.deepEqual(readManifest(w.home).clones, [{ path: w.clone, url: UPSTREAM }]);
  } finally {
    w.remove();
  }
});

test('draft over a clone already there fetches its tags instead of cloning, and --from and --to set the span', async () => {
  const w = world();
  try {
    fs.mkdirSync(w.clone, { recursive: true });
    const { git, calls } = fakeGit(w, { numstat: '1\t0\te2e/a_test.go\0' });
    const { code, out } = await run(w, ['draft', '--from', '4.3.0', '--to', '4.4.0'], { git });
    assert.equal(code, 0);
    assert.equal(calls.some((call) => call.args[0] === 'clone'), false);
    assert.ok(calls.some((call) => call.args.join(' ') === `-C ${w.clone} fetch --quiet --tags --force ${UPSTREAM}`));
    assert.ok(calls.some((call) => call.args.join(' ') === `-C ${w.clone} diff --numstat -z --no-renames v4.3.0 v4.4.0`));
    assert.equal(out, '- v4.4.0 (from v4.3.0, read 2026-11-05): ignore; 1 paths, all in ignored areas, +1 -0');
    assert.deepEqual(readManifest(w.home).clones, [{ path: w.clone, url: UPSTREAM }], 'a clone made before its record is recorded now');
  } finally {
    w.remove();
  }
});

test('draft with every release read prints that there is nothing to read, and fetches nothing', async () => {
  const w = world();
  try {
    const { git, calls } = fakeGit(w);
    const { code, out } = await run(w, ['draft', '--to', '4.3.1'], { git });
    assert.equal(code, 0);
    assert.equal(out, 'nothing to read: v4.3.1 is not above the last read, v4.3.1');
    assert.deepEqual(calls.map((call) => call.args[0]), ['ls-remote']);
  } finally {
    w.remove();
  }
});

test('a failed clone exits 1 with git\'s words, and its record stays so uninstall removes what it left', async () => {
  const w = world();
  try {
    const { git } = fakeGit(w, { fail: 'clone' });
    const { code, err } = await run(w, ['draft'], { git });
    assert.equal(code, 1);
    assert.match(err, /could not clone .*: fatal: clone failed/);
    assert.deepEqual(readManifest(w.home).clones, [{ path: w.clone, url: UPSTREAM }]);
  } finally {
    w.remove();
  }
});

test('a project with no record exits 1 and names the file; a failed ls-remote exits 1', async () => {
  const w = world(null);
  try {
    const none = await run(w, ['status'], { git: fakeGit(w).git });
    assert.equal(none.code, 1);
    assert.match(none.err, /no record of releases read: .*gentle-ai-update-check\.md/);
  } finally {
    w.remove();
  }
  const v = world();
  try {
    const offline = await run(v, ['status'], { git: fakeGit(v, { fail: 'ls-remote' }).git });
    assert.equal(offline.code, 1);
    assert.match(offline.err, /could not list the tags of .*: fatal: ls-remote failed/);
  } finally {
    v.remove();
  }
});

test('a usage error exits 2 with the usage: no verb, an unknown flag, a bad version', async () => {
  const w = world();
  try {
    for (const argv of [[], ['status', '--nope'], ['draft', '--to', 'latest']]) {
      const { code, err } = await run(w, argv, { git: fakeGit(w).git });
      assert.equal(code, 2, argv.join(' '));
      assert.match(err, /Usage: js-harness idea-watch/);
    }
  } finally {
    w.remove();
  }
});

test('ideaWatchHealth, which doctor reads: null with no record, the state with one, and a throw when the tags fail', async () => {
  const { ideaWatchHealth } = await import('./idea-watch.mjs');
  const none = world(null);
  try {
    assert.equal(ideaWatchHealth(none.project, { git: fakeGit(none).git }), null);
  } finally {
    none.remove();
  }
  const w = world();
  try {
    assert.deepEqual(ideaWatchHealth(w.project, { git: fakeGit(w).git }), { last: '4.3.1', unread: ['4.3.2', '4.4.0'] });
    assert.throws(() => ideaWatchHealth(w.project, { git: fakeGit(w, { fail: 'ls-remote' }).git }), /could not list the tags/);
  } finally {
    w.remove();
  }
});
