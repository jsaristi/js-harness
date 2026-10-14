import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { install, recordOptionalFile, recordScheduledTask } from './lib/manifest.mjs';
import { staleManifestMessage } from './lib/project.mjs';
import { currentVersion } from './install.mjs';
import { resolveLatest, statusMain, updateMain, upgradeMain } from './update.mjs';

// T5: `status` now reads the project the current folder belongs to, and these tests run real `git`,
// so they must not pick up the host's git config (see project.test.mjs, T2e item 8).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-update-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
// The empty git config lives outside the repository, so it is removed with the suite.
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('resolveLatest reads a --source directory without spawning anything', () => {
  const dir = makeTmpDir('js-harness-src-');
  try {
    fs.writeFileSync(path.join(dir, 'js-harness-0.5.0.tgz'), '');
    const spawn = () => {
      throw new Error('must not spawn when --source is given');
    };
    const result = resolveLatest({ source: dir, pm: undefined }, {}, spawn);
    assert.equal(result.version, '0.5.0');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A package manager that answers anything it is asked: a version to `view`, success to an install. It
 * stands for the public registry the day somebody registers the name, and records what it was asked. */
function squattedRegistry() {
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push({ cmd, args });
    return { status: 0, stdout: '99.0.0\n', stderr: '' };
  };
  return { calls, spawn };
}

/** Runs one of the three commands and returns its exit code with everything it printed. */
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
  throw new Error('no process may be started here');
}

/** A stand-in for every process `upgrade` starts, in which the copy of js-harness on the path answers
 * `--version` with `version` (install-update T8). Each start is recorded in `calls`. */
function pathCopyAnswers(version, calls = []) {
  return (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: args.includes('--version') ? `${version}\n` : '', stderr: '' };
  };
}

/** A source folder that holds one tarball of `version`. */
function makeSource(version) {
  const dir = makeTmpDir('js-harness-src-');
  fs.writeFileSync(path.join(dir, `js-harness-${version}.tgz`), '');
  return dir;
}

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('resolveLatest starts no process and answers nothing when no source is named', () => {
  assert.equal(resolveLatest({ source: undefined, pm: 'node cli.js' }, { JS_HARNESS_PM: 'my-pm' }, noProcess), null);
});

test('resolveLatest answers nothing for a source folder that holds no tarball', () => {
  const dir = makeTmpDir('js-harness-src-empty-');
  try {
    assert.equal(resolveLatest({ source: dir }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('status --global with no source says no release is tagged yet and asks no package manager', async () => {
  const home = makeTmpDir('js-harness-status-home2-');
  const registry = squattedRegistry();
  try {
    install(home, currentVersion());
    const { code, out } = await runCommand(statusMain, ['--global', '--home', home], {}, registry.spawn);

    assert.equal(code, 0);
    assert.match(out, new RegExp(`installed package version: ${escaped(currentVersion())}`));
    assert.match(out, new RegExp(`manifest version: ${escaped(currentVersion())}`));
    assert.match(out, /latest available: \(no release is tagged yet\)/);
    assert.doesNotMatch(out, /update available/);
    assert.deepEqual(registry.calls, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('update with no source says no release is tagged yet, how to get the newest copy, and asks no package manager', async () => {
  const registry = squattedRegistry();
  const { code, out, err } = await runCommand(updateMain, [], {}, registry.spawn);

  assert.equal(code, 0);
  assert.match(out, /no release of js-harness is tagged yet/);
  assert.match(out, /npm i -g github:jsaristi\/js-harness/);
  assert.match(out, new RegExp(`installed: ${escaped(currentVersion())}`));
  assert.doesNotMatch(out, /update available/);
  assert.equal(err, '');
  assert.deepEqual(registry.calls, []);
});

// The defect this pins: `upgrade` asked the public registry for the name `js-harness`, which nobody holds,
// installed that name at the version it was answered, and ran the `sync` of what it had installed.
test('upgrade with no source installs nothing and runs no sync, whatever a registry would answer', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-nosource-');
  const registry = squattedRegistry();
  try {
    const { code, out, err } = await runCommand(upgradeMain, ['--home', home, '--pm', 'node cli.js'], {}, registry.spawn);

    assert.equal(code, 1);
    assert.match(err, /nothing was installed/);
    assert.match(err, /no release of js-harness is tagged yet/);
    assert.match(err, /npm i -g github:jsaristi\/js-harness/);
    assert.equal(out, '');
    assert.deepEqual(registry.calls, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('JS_HARNESS_SOURCE names a source as --source does', async () => {
  const source = makeSource('99.0.0');
  try {
    const { code, out } = await runCommand(updateMain, [], { JS_HARNESS_SOURCE: source });
    assert.equal(code, 0);
    assert.match(out, /update available: 99\.0\.0/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('a source folder with no tarball is not known, which is not the same as no release', async () => {
  const home = makeTmpDir('js-harness-status-home-empty-src-');
  const source = makeTmpDir('js-harness-src-empty-');
  try {
    const status = await runCommand(statusMain, ['--global', '--home', home, '--source', source]);
    assert.equal(status.code, 0);
    assert.match(status.out, /latest available: \(unknown\)/);

    const update = await runCommand(updateMain, ['--source', source]);
    assert.equal(update.code, 0);
    assert.match(update.out, /could not determine the latest version/);
    assert.doesNotMatch(update.out, /tagged/);

    const upgrade = await runCommand(upgradeMain, ['--source', source, '--home', home]);
    assert.equal(upgrade.code, 1);
    assert.match(upgrade.err, /could not determine the latest version to upgrade to/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('a source folder that is not there is said in a line: update and upgrade exit 1, status goes on', async () => {
  const home = makeTmpDir('js-harness-status-home-missing-src-');
  const missing = path.join(home, 'no-such-folder');
  try {
    const status = await runCommand(statusMain, ['--global', '--home', home, '--source', missing]);
    assert.equal(status.code, 0);
    assert.match(status.out, /latest available: \(unknown: cannot read the source folder .*no-such-folder: ENOENT\)/);

    for (const main of [updateMain, upgradeMain]) {
      const { code, out, err } = await runCommand(main, ['--source', missing, '--home', home]);
      assert.equal(code, 1, main.name);
      assert.match(err, /cannot read the source folder .*no-such-folder: ENOENT/, main.name);
      assert.equal(out, '', main.name);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('upgrade installs with --pm split in words, else JS_HARNESS_PM, else npm', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-pm-');
  const source = makeSource('99.0.0');
  const tarball = path.join(source, 'js-harness-99.0.0.tgz');
  const calls = [];
  // The install fails, so each run stops at its first process: the one this test reads.
  const spawn = (cmd, args) => {
    calls.push({ cmd, args });
    return { status: 3, stdout: '', stderr: '' };
  };
  try {
    const flag = await runCommand(upgradeMain, ['--source', source, '--home', home, '--pm', 'node cli.js'], { JS_HARNESS_PM: 'my-pm' }, spawn);
    const variable = await runCommand(upgradeMain, ['--source', source, '--home', home], { JS_HARNESS_PM: 'my-pm' }, spawn);
    const neither = await runCommand(upgradeMain, ['--source', source, '--home', home], {}, spawn);

    assert.deepEqual(calls, [
      { cmd: 'node', args: ['cli.js', 'install', '-g', tarball] },
      { cmd: 'my-pm', args: ['install', '-g', tarball] },
      { cmd: 'npm', args: ['install', '-g', tarball] },
    ]);
    for (const run of [flag, variable, neither]) {
      assert.equal(run.code, 3);
      assert.match(run.err, /upgrade failed: \S+ exited 3/);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgrade installs nothing when the source holds no release newer than the installed one', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-same-');
  const source = makeSource(currentVersion());
  try {
    const { code, out, err } = await runCommand(upgradeMain, ['--source', source, '--home', home]);

    assert.equal(code, 0);
    assert.match(out, new RegExp(`up to date: ${escaped(currentVersion())}`));
    assert.equal(err, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('statusMain reports no manifest when nothing is installed', async () => {
  const home = makeTmpDir('js-harness-status-home3-');
  try {
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      await statusMain(['--global', '--home', home], {}, noProcess);
    } finally {
      console.log = original;
    }
    assert.match(lines.join('\n'), /manifest version: \(not installed\)/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// `remote start --at-login` records its launcher in a manifest of its own making when nothing is installed: that
// manifest has a null version, which is not a version.
test('statusMain reports not installed for a manifest that only records an optional file', async () => {
  const home = makeTmpDir('js-harness-status-home4-');
  try {
    recordOptionalFile(home, path.join(home, 'launcher.cmd'), '@echo off\r\n');
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      await statusMain(['--global', '--home', home], {}, noProcess);
    } finally {
      console.log = original;
    }
    assert.match(lines.join('\n'), /manifest version: \(not installed\)/);
    assert.doesNotMatch(lines.join('\n'), /null/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('upgradeMain says not installed, not null, when the manifest it finds only records an optional file', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-optional-');
  const source = makeTmpDir('js-harness-upgrade-src-optional-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    recordOptionalFile(home, path.join(home, 'launcher.cmd'), '@echo off\r\n');
    const lines = [];
    const original = console.error;
    console.error = (line) => lines.push(String(line));
    let code;
    try {
      code = await upgradeMain(['--source', source, '--home', home], {}, pathCopyAnswers('0.9.0'));
    } finally {
      console.error = original;
    }
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /reports \(not installed\), not 0\.9\.0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

// The same manifest once `remote start --at-login` has also recorded its watchdog task, or with that record alone.
test('statusMain and upgradeMain say not installed for a manifest that only records a scheduled task', async () => {
  const home = makeTmpDir('js-harness-status-home-task-');
  const source = makeTmpDir('js-harness-upgrade-src-task-');
  const lines = [];
  const original = { log: console.log, error: console.error };
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    recordScheduledTask(home, { name: 'js-harness-remote-x', command: 'conhost.exe', arguments: '--headless node remote.mjs start --watchdog' });
    console.log = (line) => lines.push(String(line));
    console.error = (line) => lines.push(String(line));
    await statusMain(['--global', '--home', home], {}, noProcess);
    const code = await upgradeMain(['--source', source, '--home', home], {}, pathCopyAnswers('0.9.0'));
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /manifest version: \(not installed\)/);
    assert.match(lines.join('\n'), /reports \(not installed\), not 0\.9\.0/);
    assert.doesNotMatch(lines.join('\n'), /null/);
  } finally {
    Object.assign(console, original);
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('updateMain reports up to date when the source holds no newer version', async () => {
  const source = makeSource(currentVersion());
  try {
    const { code, out } = await runCommand(updateMain, ['--source', source]);
    assert.equal(code, 0);
    assert.match(out, /up to date/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('updateMain reports an update the source holds and still exits 0', async () => {
  const source = makeSource('99.0.0');
  try {
    const { code, out } = await runCommand(updateMain, ['--source', source]);
    assert.equal(code, 0);
    assert.match(out, /update available: 99\.0\.0/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain installs the resolved spec and syncs the newly installed binary (win32 layout)', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-');
  const prefix = makeTmpDir('js-harness-upgrade-prefix-');
  const source = makeTmpDir('js-harness-upgrade-src-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    const binDir = path.join(prefix, 'node_modules', 'js-harness', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'js-harness.mjs'), '// stub, never executed in this test');
    // The mocked spawn never actually runs sync, so seed the manifest it would have written.
    install(home, '0.9.0');

    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '', stderr: '' };
    };

    const code = await upgradeMain(
      ['--source', source, '--prefix', prefix, '--home', home],
      {},
      spawn,
      'win32',
    );

    assert.equal(code, 0);
    assert.equal(calls.length, 2, 'expected one install call and one sync call');
    assert.deepEqual(calls[0].args, [
      'install',
      '-g',
      path.join(source, 'js-harness-0.9.0.tgz'),
      '--prefix',
      prefix,
    ]);
    assert.equal(calls[1].args[0], path.join(binDir, 'js-harness.mjs'));
    // T4: --global, or the newly installed binary's sync would act on the project it runs in.
    assert.deepEqual(calls[1].args.slice(1), ['sync', '--home', home, '--global']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(prefix, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain uses the POSIX --prefix layout (lib/node_modules) for the synced bin', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-posix-');
  const prefix = makeTmpDir('js-harness-upgrade-prefix-posix-');
  const source = makeTmpDir('js-harness-upgrade-src-posix-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    const binDir = path.join(prefix, 'lib', 'node_modules', 'js-harness', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'js-harness.mjs'), '// stub, never executed in this test');
    install(home, '0.9.0');

    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '', stderr: '' };
    };

    const code = await upgradeMain(
      ['--source', source, '--prefix', prefix, '--home', home],
      {},
      spawn,
      'linux',
    );

    assert.equal(code, 0);
    assert.equal(calls[1].args[0], path.join(binDir, 'js-harness.mjs'));
    // T4: --global, or the newly installed binary's sync would act on the project it runs in.
    assert.deepEqual(calls[1].args.slice(1), ['sync', '--home', home, '--global']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(prefix, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

// install-update T8: with no --prefix the sync is run by whatever js-harness the shell finds, so that
// copy says its version first, and only the version just installed is let to sync.
test('upgradeMain asks the js-harness on the path its version, then runs its sync, both via a shell, when no --prefix is given', async () => {
  const home = makeTmpDir('js-harness-upgrade-home2-');
  const source = makeTmpDir('js-harness-upgrade-src2-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    // The stand-in never actually runs sync, so seed the manifest it would have written.
    install(home, '0.9.0');
    const calls = [];
    const code = await upgradeMain(['--source', source, '--home', home], {}, pathCopyAnswers('0.9.0', calls));
    assert.equal(code, 0);
    assert.equal(calls.length, 3, 'one install, one question, one sync');
    assert.deepEqual([calls[1].cmd, calls[1].args], ['js-harness', ['--version']]);
    assert.equal(calls[1].opts.shell, true, 'the question goes to the same copy the sync will run');
    assert.equal(calls[2].cmd, 'js-harness');
    assert.equal(calls[2].args[0], 'sync');
    assert.equal(calls[2].args[1], '--home');
    const expectedHome = process.platform === 'win32' ? `"${home}"` : `'${home}'`;
    assert.equal(calls[2].args[2], expectedHome, 'the home path must be quoted for the shell');
    assert.equal(calls[2].args[3], '--global');
    assert.equal(calls[2].opts.shell, true, 'shell is required so .cmd shims resolve on Windows');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

for (const [label, answer, said] of [
  [
    'answers another version',
    { status: 0, stdout: '0.1.0\n', stderr: '' },
    /the js-harness on the path is 0\.1\.0, not the upgraded 0\.9\.0/,
  ],
  [
    'does not know --version',
    { status: 2, stdout: '', stderr: 'Unknown command: --version\n\u001b[2J' },
    /the js-harness on the path did not answer --version, so it is not the upgraded 0\.9\.0/,
  ],
  [
    'answers something that is no version',
    { status: 0, stdout: '\u001b[2J0.9.0; rm -rf x\n', stderr: '' },
    /the js-harness on the path did not answer --version/,
  ],
  [
    'is not found',
    { status: null, error: new Error('spawn js-harness ENOENT'), stdout: '', stderr: '' },
    /the js-harness on the path did not answer --version/,
  ],
]) {
  test(`upgradeMain syncs nothing and exits 1 when the js-harness on the path ${label}`, async () => {
    const home = makeTmpDir('js-harness-upgrade-home-probe-');
    const source = makeSource('0.9.0');
    try {
      const calls = [];
      const spawn = (cmd, args, opts) => {
        calls.push({ cmd, args, opts });
        return args.includes('--version') ? answer : { status: 0, stdout: '', stderr: '' };
      };

      const { code, out, err } = await runCommand(upgradeMain, ['--source', source, '--home', home], {}, spawn);

      assert.equal(code, 1);
      assert.equal(calls.length, 2, 'the install and the question: no sync is started');
      assert.equal(calls.some((call) => call.args.includes('sync')), false);
      assert.match(err, said);
      assert.match(err, /0\.9\.0 was installed and nothing was synced/);
      assert.match(err, /js-harness sync --global/);
      // The install already happened: a second upgrade would say "up to date" and sync nothing, so it is
      // not offered as a way out (Codex's finding on the first version of this line).
      assert.doesNotMatch(err, /upgrade again|--prefix/);
      assert.doesNotMatch(`${out}${err}`, /\u001b|rm -rf|ENOENT|Unknown command/, 'none of the copy\'s own bytes are printed');
      assert.doesNotMatch(out, /upgraded to/);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(source, { recursive: true, force: true });
    }
  });
}

test('statusMain resolves home and source from JS_HARNESS_HOME / JS_HARNESS_SOURCE when the flags are absent', async () => {
  const home = makeTmpDir('js-harness-status-envhome-');
  const source = makeTmpDir('js-harness-status-envsource-');
  try {
    install(home, currentVersion());
    fs.writeFileSync(path.join(source, 'js-harness-7.0.0.tgz'), '');
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    const spawn = () => {
      throw new Error('must not spawn a package manager when JS_HARNESS_SOURCE is given');
    };
    try {
      await statusMain(['--global'], { JS_HARNESS_HOME: home, JS_HARNESS_SOURCE: source }, spawn);
    } finally {
      console.log = original;
    }
    const text = lines.join('\n');
    assert.match(text, new RegExp(`manifest version: ${currentVersion()}`));
    assert.match(text, /latest available: 7\.0\.0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain resolves --prefix from JS_HARNESS_PREFIX when the flag is absent', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-envprefix-');
  const prefix = makeTmpDir('js-harness-upgrade-prefix-envprefix-');
  const source = makeTmpDir('js-harness-upgrade-src-envprefix-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    const binDir = path.join(prefix, 'node_modules', 'js-harness', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'js-harness.mjs'), '// stub, never executed in this test');
    install(home, '0.9.0');

    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '', stderr: '' };
    };

    const code = await upgradeMain(
      ['--source', source, '--home', home],
      { JS_HARNESS_PREFIX: prefix },
      spawn,
      'win32',
    );

    assert.equal(code, 0);
    assert.equal(calls[1].args[0], path.join(binDir, 'js-harness.mjs'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(prefix, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain reports a mismatch and returns 1 when the synced manifest is not the upgraded version', async () => {
  const home = makeTmpDir('js-harness-upgrade-home-mismatch-');
  const source = makeTmpDir('js-harness-upgrade-src-mismatch-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    // No manifest written under home: the copy on the path said the right version, and its sync still
    // left another manifest. The check after the sync is the second proof.
    const spawn = pathCopyAnswers('0.9.0');
    const lines = [];
    const original = console.error;
    console.error = (line) => lines.push(String(line));
    let code;
    try {
      code = await upgradeMain(['--source', source, '--home', home], {}, spawn);
    } finally {
      console.error = original;
    }
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /not the upgraded one/);
    assert.match(lines.join('\n'), /js-harness sync/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain returns a non-zero code and skips sync when install fails', async () => {
  const home = makeTmpDir('js-harness-upgrade-home3-');
  const source = makeTmpDir('js-harness-upgrade-src3-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 1, stdout: '', stderr: 'boom' };
    };
    const code = await upgradeMain(['--source', source, '--home', home], {}, spawn);
    assert.equal(code, 1);
    assert.equal(calls.length, 1);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

// --- T5: `status` by location (project vs. machine), the "Command scope" rule ---

function makeRepo(prefix = 'js-harness-status-repo-') {
  const dir = makeTmpDir(prefix);
  const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
  return dir;
}

/** A repo `js-harness init` would leave, minus the files status never reads: `harness.json` pinning
 * `version`, and (with `manifest`) this clone's project manifest under the git dir. */
function makeProject({ version = currentVersion(), manifest = false } = {}) {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'harness.json'), `${JSON.stringify({ version }, null, 2)}\n`, 'utf8');
  if (manifest) {
    const dir = path.join(root, '.git', 'js-harness');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{}\n', 'utf8');
  }
  return root;
}

const noPackageManager = () => {
  throw new Error('project status must not spawn a package manager');
};

/** Runs `statusMain` and returns its exit code with everything it printed. */
async function runStatus(argv, env = {}, spawn = noProcess) {
  const out = [];
  const err = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => out.push(String(line));
  console.error = (line) => err.push(String(line));
  try {
    const code = await statusMain(argv, env, spawn);
    return { code, out: out.join('\n'), err: err.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function inDir(dir, fn) {
  const original = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(original);
  }
}

function snapshotTree(dir) {
  const out = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out[path.relative(dir, abs)] = fs.readFileSync(abs).toString('base64');
    }
  };
  walk(dir);
  return out;
}

test('status in an initialized project reports the root, both versions, the clone and the match', async () => {
  const root = makeProject({ version: currentVersion() });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 0, err);
    assert.ok(out.includes(path.basename(root)), `expected the project root in:\n${out}`);
    assert.match(out, new RegExp(`pinned version: ${currentVersion().replaceAll('.', '\\.')}`));
    assert.match(out, new RegExp(`running version: ${currentVersion().replaceAll('.', '\\.')}`));
    assert.match(out, /js-harness sync sets it up/, 'no manifest in this clone yet');
    assert.match(out, /pin and running version: match/);
    assert.doesNotMatch(out, /names the ways out/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status reports this clone as set up when its manifest exists', async () => {
  const root = makeProject({ manifest: true });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 0);
    assert.match(out, /this clone: set up/);
    assert.doesNotMatch(out, /sync sets it up/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status names the ways out, and still exits 0, when the pin differs from the running version', async () => {
  const root = makeProject({ version: '99.0.0' });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 0);
    assert.match(out, /pinned version: 99\.0\.0/);
    assert.match(out, /pin and running version: differ; js-harness sync names the ways out/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status from a subfolder of the project reports the project', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const sub = path.join(root, 'src', 'deep');
    fs.mkdirSync(sub, { recursive: true });
    const { code, out } = await runStatus(['--cwd', sub, '--home', home], {}, noPackageManager);

    assert.equal(code, 0);
    assert.match(out, /pinned version:/);
    assert.ok(out.includes(path.basename(root)));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status in a project writes nothing', async () => {
  const root = makeProject({ manifest: true });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const before = snapshotTree(root);
    const homeBefore = snapshotTree(home);

    await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.deepEqual(snapshotTree(root), before);
    assert.deepEqual(snapshotTree(home), homeBefore);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status in a project accepts --source/--pm/--prefix without using them', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code } = await runStatus(
      ['--cwd', root, '--home', home, '--source', '/nowhere', '--pm', 'nope', '--prefix', '/nowhere'],
      {},
      noPackageManager,
    );
    assert.equal(code, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status exits 1 with the sync message when harness.json has no usable pin', async () => {
  const root = makeProject({ version: 'latest' });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 1);
    assert.equal(out, '');
    assert.match(err, /cannot read the pin from .*harness\.json: its "version" is not a semver version/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// install-update T6: a harness.json written by hand, with no version, is a project with no pin.
test('status exits 0 in a project whose harness.json holds no version: no pin, how to pin one, nothing written', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{ "sameTree": "skip" }\n', 'utf8');
    const before = snapshotTree(root);

    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 0);
    assert.equal(err, '');
    assert.ok(out.includes(path.basename(root)));
    assert.match(out, /^pinned version: none$/m);
    assert.ok(out.includes(`running version: ${currentVersion()}`));
    assert.match(out, /^this clone: not set up; js-harness sync sets it up once a version is pinned$/m);
    assert.ok(out.includes(`add "version": "${currentVersion()}" to harness.json and commit it`), out);
    assert.doesNotMatch(out, /undefined|pin and running version:/);
    assert.deepEqual(snapshotTree(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status in a project with no pin says so in a clone that is set up too', async () => {
  const root = makeProject({ manifest: true });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{}\n', 'utf8');

    const { code, out } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 0);
    assert.match(out, /^pinned version: none$/m);
    assert.match(out, /^this clone: set up \(manifest: /m);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status exits 1 with the sync message for a stale manifest (harness.json gone)', async () => {
  const root = makeProject({ manifest: true });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    fs.rmSync(path.join(root, 'harness.json'));
    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 1);
    assert.equal(out, '');
    assert.match(err, /this clone was initialized before \(manifest: .*manifest\.json\) but harness\.json is missing/);
    assert.equal(
      err,
      staleManifestMessage(err.match(/\(manifest: (.*)\) but/)[1]),
      'the very message sync and init print',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status exits 1 naming init and --global for a repository that is not initialized', async () => {
  const root = makeRepo();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    for (const argv of [['--cwd', root], []]) {
      const { code, out, err } = await inDir(root, () => runStatus([...argv, '--home', home], {}, noPackageManager));
      assert.equal(code, 1);
      assert.equal(out, '');
      assert.match(err, /js-harness init/);
      assert.match(err, /js-harness status --global/);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status with an explicit --cwd that is not a project exits 1 instead of falling to the machine', async () => {
  const dir = makeTmpDir('js-harness-status-nongit-');
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out, err } = await runStatus(['--cwd', dir, '--home', home], {}, noPackageManager);
    assert.equal(code, 1);
    assert.equal(out, '');
    assert.match(err, /js-harness init/);
    assert.match(err, /js-harness status --global/);

    const missing = await runStatus(['--cwd', path.join(dir, 'missing'), '--home', home], {}, noPackageManager);
    assert.equal(missing.code, 1);
    assert.match(missing.err, /no such directory/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status with no --cwd, outside any git repository, is the machine status', async () => {
  const dir = makeTmpDir('js-harness-status-nongit-');
  const home = makeTmpDir('js-harness-status-home-');
  const source = makeSource('9.9.9');
  try {
    install(home, currentVersion());
    const { code, out } = await inDir(dir, () => runStatus(['--home', home, '--source', source]));

    assert.equal(code, 0);
    assert.match(out, new RegExp(`installed package version: ${currentVersion().replaceAll('.', '\\.')}`));
    assert.match(out, /manifest version: /);
    assert.match(out, /update available: 9\.9\.9/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('status with no --cwd, inside an initialized project, is the project status', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const { code, out } = await inDir(root, () => runStatus(['--home', home], {}, noPackageManager));
    assert.equal(code, 0);
    assert.match(out, /pinned version:/);
    assert.doesNotMatch(out, /manifest version:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status --global is the machine status even inside an initialized project', async () => {
  const root = makeProject();
  const home = makeTmpDir('js-harness-status-home-');
  try {
    install(home, currentVersion());
    const { code, out } = await inDir(root, () => runStatus(['--global', '--home', home], {}, noProcess));

    assert.equal(code, 0);
    assert.match(out, /installed package version: /);
    assert.match(out, /manifest version: /);
    assert.doesNotMatch(out, /pinned version:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('status rejects --global with --cwd, an unknown flag and a missing value with exit 2 and a usage line', async () => {
  const home = makeTmpDir('js-harness-status-home-');
  try {
    const cases = [
      [['--global', '--cwd', home, '--home', home], /--global cannot be combined with --cwd/],
      [['--home', home, '--bogus'], /unknown flag: --bogus/],
      [['--home', home, '--cwd'], /--cwd requires a value/],
      [['--home'], /--home requires a value/],
      [['--home', home, '--source', '--global'], /--source requires a value/],
    ];
    for (const [argv, message] of cases) {
      const { code, out, err } = await runStatus(argv, {}, noPackageManager);
      assert.equal(code, 2, argv.join(' '));
      assert.equal(out, '');
      assert.match(err, message);
      assert.match(err, /Usage: js-harness status \[--cwd <path>\] \[--home <path>\] \[--global\]/);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// `upgrade` refuses a flag it does not know since T1 of odd/tasks/commands-and-doctor.md
// (`bin/writing-flags.test.mjs`); `update` writes nothing and keeps ignoring one.
test('updateMain keeps ignoring flags it does not know (parsing unchanged)', async () => {
  const original = console.log;
  console.log = () => {};
  try {
    assert.equal(await updateMain(['--bogus', '--cwd'], {}, noProcess), 0);
  } finally {
    console.log = original;
  }
});

test('status never prints the bytes of a malformed harness.json (terminal escapes included)', async () => {
  const root = makeProject({ version: '1.0.0' });
  const home = makeTmpDir('js-harness-status-home-');
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{ "version": "\u001b[2J\u001b]0;pwned\u0007", oops', 'utf8');
    const { code, out, err } = await runStatus(['--cwd', root, '--home', home], {}, noPackageManager);

    assert.equal(code, 1);
    assert.match(err, /cannot read the pin from .*harness\.json: it is not valid JSON$/);
    assert.doesNotMatch(`${out}${err}`, /\u001b|\u0007/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
