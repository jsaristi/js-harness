import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install } from './lib/manifest.mjs';
import { currentVersion } from './install.mjs';
import { resolveLatest, resolveSpec, statusMain, updateMain, upgradeMain } from './update.mjs';

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeSpawnOk(stdout = '') {
  return () => ({ status: 0, stdout, stderr: '' });
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

test('resolveLatest asks the injected package manager and parses its stdout', () => {
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '9.9.9\n', stderr: '' };
  };
  const result = resolveLatest({ source: undefined, pm: 'node cli.js' }, {}, spawn);
  assert.equal(result.version, '9.9.9');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'node');
  assert.deepEqual(calls[0].args, ['cli.js', 'view', 'js-harness', 'version']);
});

test('resolveLatest falls back to JS_HARNESS_PM, then to npm', () => {
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push({ cmd, args });
    return { status: 0, stdout: '1.0.0', stderr: '' };
  };
  resolveLatest({ source: undefined, pm: undefined }, { JS_HARNESS_PM: 'my-pm' }, spawn);
  assert.equal(calls[0].cmd, 'my-pm');

  resolveLatest({ source: undefined, pm: undefined }, {}, spawn);
  assert.equal(calls[1].cmd, 'npm');
});

test('resolveLatest returns null when the package manager exits non-zero', () => {
  const spawn = () => ({ status: 1, stdout: '', stderr: 'not found' });
  assert.equal(resolveLatest({ source: undefined, pm: 'npm' }, {}, spawn), null);
});

test('resolveSpec uses the tarball path for --source, else name@version', () => {
  assert.equal(
    resolveSpec({ source: '/tmp/x', latest: { version: '0.2.0', file: '/tmp/x/js-harness-0.2.0.tgz' } }),
    '/tmp/x/js-harness-0.2.0.tgz',
  );
  assert.equal(resolveSpec({ source: undefined, latest: { version: '0.2.0', file: null } }), 'js-harness@0.2.0');
});

test('statusMain reports the manifest version and an available update', async () => {
  const home = makeTmpDir('js-harness-status-home2-');
  try {
    install(home, currentVersion());
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      await statusMain(['--home', home], {}, fakeSpawnOk('9.9.9'));
    } finally {
      console.log = original;
    }
    const text = lines.join('\n');
    assert.match(text, new RegExp(`installed package version: ${currentVersion()}`));
    assert.match(text, new RegExp(`manifest version: ${currentVersion()}`));
    assert.match(text, /latest available: 9\.9\.9/);
    assert.match(text, /update available: 9\.9\.9/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('statusMain reports no manifest when nothing is installed', async () => {
  const home = makeTmpDir('js-harness-status-home3-');
  try {
    const lines = [];
    const original = console.log;
    console.log = (line) => lines.push(String(line));
    try {
      await statusMain(['--home', home], {}, fakeSpawnOk(currentVersion()));
    } finally {
      console.log = original;
    }
    assert.match(lines.join('\n'), /manifest version: \(not installed\)/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('updateMain reports up to date when no newer version exists', async () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    const code = await updateMain([], {}, fakeSpawnOk(currentVersion()));
    assert.equal(code, 0);
  } finally {
    console.log = original;
  }
  assert.match(lines.join('\n'), /up to date/);
});

test('updateMain reports an available update and still exits 0', async () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    const code = await updateMain([], {}, fakeSpawnOk('99.0.0'));
    assert.equal(code, 0);
  } finally {
    console.log = original;
  }
  assert.match(lines.join('\n'), /update available: 99\.0\.0/);
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
    assert.deepEqual(calls[1].args.slice(1), ['sync', '--home', home]);
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
    assert.deepEqual(calls[1].args.slice(1), ['sync', '--home', home]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(prefix, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('upgradeMain spawns the PATH js-harness sync via a shell when no --prefix is given', async () => {
  const home = makeTmpDir('js-harness-upgrade-home2-');
  const source = makeTmpDir('js-harness-upgrade-src2-');
  try {
    fs.writeFileSync(path.join(source, 'js-harness-0.9.0.tgz'), '');
    // The mocked spawn never actually runs sync, so seed the manifest it would have written.
    install(home, '0.9.0');
    const calls = [];
    const spawn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { status: 0, stdout: '', stderr: '' };
    };
    const code = await upgradeMain(['--source', source, '--home', home], {}, spawn);
    assert.equal(code, 0);
    assert.equal(calls.length, 2, 'expected one install call and one sync call');
    assert.equal(calls[1].cmd, 'js-harness');
    assert.equal(calls[1].args[0], 'sync');
    assert.equal(calls[1].args[1], '--home');
    const expectedHome = process.platform === 'win32' ? `"${home}"` : `'${home}'`;
    assert.equal(calls[1].args[2], expectedHome, 'the home path must be quoted for the shell');
    assert.equal(calls[1].opts.shell, true, 'shell is required so .cmd shims resolve on Windows');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

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
      await statusMain([], { JS_HARNESS_HOME: home, JS_HARNESS_SOURCE: source }, spawn);
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
    // No manifest written under home: simulates sync silently running some other js-harness.
    const calls = [];
    const spawn = (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '', stderr: '' };
    };
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
