// T4b of odd/tasks/first-version.md: the release source. `status`, `update` and `upgrade` find the newest `vX.Y.Z` tag
// of the repository with the machine's git and `upgrade` installs that tag. Every repository here is a local one in a
// temporary folder, so no test reaches the network; the package manager is a stand-in that records what it is asked.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { statusMain, updateMain, upgradeMain, resolveLatest } from './update.mjs';
import { latestTag, tagSpec, DEFAULT_REPO } from './lib/version.mjs';
import { currentVersion } from './install.mjs';
import { install } from './lib/manifest.mjs';

// Run from a commit's hook, the suite would inherit GIT_DIR and its kin, and every `git` here would act on the
// repository being committed instead of its own temporary one; the host's config is left out the same way.
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_CONFIG_GLOBAL = path.join(os.tmpdir(), 'js-harness-release-tags-no-config');
});

const git = (cwd, ...args) => {
  const run = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

/** A local git repository with one commit and the given tags on it. */
function makeRepo(tags) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tags-'));
  git(dir, 'init', '-q');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'release');
  for (const tag of tags) git(dir, 'tag', tag);
  return dir;
}

async function runCommand(main, argv, env = {}, spawn = noProcess) {
  const out = [];
  const err = [];
  const original = { log: console.log, error: console.error };
  console.log = (line) => out.push(String(line));
  console.error = (line) => err.push(String(line));
  try {
    const code = await main(argv, env, spawn);
    return { code, out: out.join('\n'), err: err.join('\n') };
  } finally {
    Object.assign(console, original);
  }
}

function noProcess() {
  throw new Error('no package manager may be started here');
}

const fileSpec = (repo, tag) => `git+${pathToFileURL(repo).href}#${tag}`;

test('latestTag takes the highest tag named exactly vX.Y.Z and ignores every other', () => {
  const listing = [
    'aaa\trefs/tags/v1.9.0',
    'bbb\trefs/tags/v1.10.0',
    'ccc\trefs/tags/v2.0.0-rc.1',
    'ddd\trefs/tags/3.0.0',
    'eee\trefs/tags/v4.0',
    'fff\trefs/tags/v9.0.0^{}',
    'ggg\trefs/heads/v8.0.0',
    '',
  ].join('\n');
  assert.deepEqual(latestTag(listing), { version: '1.10.0', tag: 'v1.10.0' });
  assert.equal(latestTag(''), null);
  assert.equal(latestTag('aaa\trefs/tags/nightly\n'), null);
});

test('tagSpec names the default repository by its GitHub shorthand and any other by git+, an scp-style address as git+ssh, a folder as a file URL', () => {
  assert.equal(tagSpec(DEFAULT_REPO, 'v1.2.3'), 'github:jsaristi/js-harness#v1.2.3');
  assert.equal(tagSpec('https://example.com/x.git', 'v1.2.3'), 'git+https://example.com/x.git#v1.2.3');
  // An scp-style SSH address is a remote, not a folder: npm takes it under git+ssh:// with its colon.
  assert.equal(tagSpec('git@github.com:jsaristi/js-harness.git', 'v1.2.3'), 'git+ssh://git@github.com:jsaristi/js-harness.git#v1.2.3');
  const folder = path.join(os.tmpdir(), 'some repo');
  assert.equal(tagSpec(folder, 'v1.2.3'), `git+${pathToFileURL(folder).href}#v1.2.3`);
});

test('resolveLatest reads the newest release tag of a repository, and nothing from one with no release tag', () => {
  const tagged = makeRepo(['v1.0.0', 'v1.2.0', 'v1.1.0', 'nightly']);
  const untagged = makeRepo(['nightly']);
  try {
    assert.deepEqual(resolveLatest({ repo: tagged }), { version: '1.2.0', spec: fileSpec(tagged, 'v1.2.0') });
    assert.equal(resolveLatest({ repo: untagged }), null);
  } finally {
    fs.rmSync(tagged, { recursive: true, force: true });
    fs.rmSync(untagged, { recursive: true, force: true });
  }
});

test('status --global and update name a newer tag of the repository, from --repo or JS_HARNESS_REPO, and start no package manager', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tags-home-'));
  const repo = makeRepo(['v99.0.0']);
  try {
    install(home, currentVersion());
    const status = await runCommand(statusMain, ['--global', '--home', home, '--repo', repo]);
    assert.equal(status.code, 0, status.err);
    assert.match(status.out, /latest available: 99\.0\.0/);
    assert.match(status.out, /update available: 99\.0\.0/);

    const update = await runCommand(updateMain, [], { JS_HARNESS_REPO: repo });
    assert.equal(update.code, 0, update.err);
    assert.match(update.out, new RegExp(`update available: 99\\.0\\.0 \\(installed: ${currentVersion().replace(/\./g, '\\.')}\\)`));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('update says up to date when the newest tag is not newer than the running version', async () => {
  const repo = makeRepo([`v${currentVersion()}`, 'v0.0.1']);
  try {
    const { code, out } = await runCommand(updateMain, ['--repo', repo]);
    assert.equal(code, 0);
    assert.match(out, new RegExp(`up to date: ${currentVersion().replace(/\./g, '\\.')}`));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('upgrade installs the newest tag of the repository with the package manager, then syncs the installed copy', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tags-up-home-'));
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tags-up-prefix-'));
  const repo = makeRepo(['v99.0.0', 'v98.0.0']);
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push({ cmd, args });
    // The sync of the installed copy records the new version, as the real one would.
    if (args.includes('sync')) install(home, '99.0.0');
    return { status: 0, stdout: '', stderr: '' };
  };
  try {
    const { code, out, err } = await runCommand(upgradeMain, ['--repo', repo, '--home', home, '--prefix', prefix, '--pm', 'my-pm'], {}, spawn);
    assert.equal(code, 0, err);
    assert.match(out, /upgraded to 99\.0\.0/);
    assert.deepEqual(calls[0], { cmd: 'my-pm', args: ['install', '-g', fileSpec(repo, 'v99.0.0'), '--prefix', prefix] });
    assert.ok(calls[1].args.includes('sync'), JSON.stringify(calls[1]));
    assert.equal(calls.length, 2);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(prefix, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('a repository whose tags cannot be listed: status says unknown and why, update and upgrade exit 1 and install nothing', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tags-none-home-'));
  const missing = path.join(home, 'no-such-repository');
  try {
    install(home, currentVersion());
    const status = await runCommand(statusMain, ['--global', '--home', home, '--repo', missing]);
    assert.equal(status.code, 0);
    assert.match(status.out, /latest available: \(unknown: cannot list the tags of .*no-such-repository/);

    for (const main of [updateMain, upgradeMain]) {
      const run = await runCommand(main, ['--repo', missing, '--home', home]);
      assert.equal(run.code, 1, main.name);
      assert.match(run.err, /cannot list the tags of .*no-such-repository/, main.name);
      // The default repository is public since 2026-10-16: the line no longer claims it is private.
      assert.doesNotMatch(run.err, /the repository is private/, main.name);
      assert.match(run.err, /git needs to reach the repository, and a credential when it is private/, main.name);
      assert.match(run.err, /--source/, main.name);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('--source still wins over the repository when both are named', async () => {
  const repo = makeRepo(['v99.0.0']);
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tags-src-'));
  try {
    fs.writeFileSync(path.join(source, 'js-harness-50.0.0.tgz'), '');
    const { code, out } = await runCommand(updateMain, ['--repo', repo, '--source', source]);
    assert.equal(code, 0);
    assert.match(out, /update available: 50\.0\.0/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});
