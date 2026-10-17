import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installMain, syncMain, uninstallMain, currentVersion } from './install.mjs';
import { entryComponents, manifestPath, readManifest, recordOptionalFile, recordScheduledTask } from './lib/manifest.mjs';
import { gateDir, gateLockDir, takeGateLock } from './lib/gate-lock.mjs';
import { gateLogDir, gateRecord } from './lib/gate-log.mjs';
import { appendNotice, channelDir, newNotice, recordPath } from './lib/channel.mjs';
import { initProject } from './lib/project.mjs';
import { remoteDir, remoteFiles } from './lib/remote.mjs';
import { hygieneDir, journalPath, memoryLocation, purgeMarker } from './lib/memory-hygiene.mjs';
import { repoTemplate } from './lib/git-fixture.testkit.mjs';

// T3 (project-init): uninstallMain now spawns real `git` for its project-scope detection (see
// project.mjs's `gitTopLevel`/`resolveGitPath`) — isolate it from the host's global/system git
// config and from a git hook's own inherited GIT_DIR/GIT_INDEX_FILE, the same way
// bin/lib/project.test.mjs's `before` hook does (a pre-commit run of *that* suite broke `git
// worktree add` this exact way).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
// The empty git config lives outside the repository, so it is removed with the suite.
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

/** A program in the repository at `dir`, so the code map resolves on and `codegraph init` runs
 * (odd/tasks/on-demand-functions.md: an empty repository holds no code). */
function withProgram(dir) {
  fs.writeFileSync(path.join(dir, 'index.js'), '', 'utf8');
  return dir;
}

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-home-'));
}

/** What `git init` makes, made once and copied (`lib/git-fixture.testkit.mjs`): every empty repository here is the same. */
const emptyRepo = repoTemplate((dir) => {
  const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
});

function makeTmpProjectRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-project-'));
  emptyRepo(dir);
  return dir;
}

/** A spawn for `initProject` that runs `git` for real but never touches a real `codegraph` binary —
 * only needed to seed an initialized project fixture; `uninstallMain`'s own project-scope path never
 * spawns codegraph at all. */
function fakeCodegraphSpawn() {
  return (cmd, args, opts) => {
    if (cmd === 'git') return spawnSync('git', args, opts);
    if (opts?.cwd) fs.mkdirSync(path.join(opts.cwd, '.codegraph'), { recursive: true });
    return { status: 0, stdout: '', stderr: '' };
  };
}

function captureConsole(fn) {
  const outLines = [];
  const errLines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => outLines.push(String(line));
  console.error = (line) => errLines.push(String(line));
  return fn()
    .then((code) => ({ code, outLines, errLines }))
    .finally(() => {
      console.log = originalLog;
      console.error = originalError;
    });
}

test('currentVersion reads this package\'s own package.json version', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8'));
  assert.equal(currentVersion(), pkg.version);
});

test('installMain writes the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    const code = await installMain(['--home', home]);
    assert.equal(code, 0);
    const manifest = readManifest(home);
    assert.equal(manifest.version, currentVersion());
    assert.ok(manifest.files.length > 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('installMain then uninstallMain give a Claude settings file with no hooks key its bytes back, indent and all', async () => {
  const home = makeTmpHome();
  try {
    const settings = path.join(home, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, `${JSON.stringify({ theme: 'dark' }, null, 4)}\n`, 'utf8');
    const seeded = fs.readFileSync(settings, 'utf8');

    assert.equal(await installMain(['--home', home]), 0);
    assert.equal(await uninstallMain(['--global', '--home', home]), 0);
    assert.equal(fs.readFileSync(settings, 'utf8'), seeded, 'the empty PostToolUse and SessionStart lists install made are taken back too');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain updates the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    // T4: pinned with --global so this machine test never depends on the project (if any) the test
    // runner's own cwd happens to sit in.
    const code = await syncMain(['--global', '--home', home]);
    assert.equal(code, 0);
    assert.equal(readManifest(home).version, currentVersion());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain removes the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    // T3b item 6, R3-uninstall-cwd-dependent-machine-tests: pinned with --global so this machine
    // test never depends on whatever project (if any) the test runner's own cwd happens to sit in.
    const code = await uninstallMain(['--global', '--home', home]);
    assert.equal(code, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('installMain resolves home from JS_HARNESS_HOME when --home is not given', async () => {
  const home = makeTmpHome();
  try {
    const code = await installMain([], { JS_HARNESS_HOME: home });
    assert.equal(code, 0);
    assert.equal(readManifest(home).version, currentVersion());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// `install` once took any word it did not know as nothing at all, so `js-harness install --help`, typed to read
// its flags, installed. The home of each case is a temp one through the environment: a case that did install
// would write there and never under the real home.
test('installMain refuses a word it does not know before it writes anything: exit 2, with the word and the usage', async () => {
  for (const argv of [['--help'], ['-h'], ['--dry-run'], ['now'], ['--global']]) {
    const home = makeTmpHome();
    try {
      for (const words of [argv, ['--home', home, ...argv], [...argv, '--home', home]]) {
        const { code, outLines, errLines } = await captureConsole(() => installMain(words, { JS_HARNESS_HOME: home }));
        assert.equal(code, 2, words.join(' '));
        assert.deepEqual(errLines, [`unknown flag: ${argv[0]}\n\nUsage: js-harness install [--home <path>] [--accept-session-messages]`], words.join(' '));
        assert.deepEqual(outLines, [], words.join(' '));
        assert.deepEqual(fs.readdirSync(home), [], `nothing is written for: ${words.join(' ')}`);
      }
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('installMain refuses --home with no path after it: exit 2, and nothing is written under the home of the environment', async () => {
  const home = makeTmpHome();
  try {
    for (const words of [['--home'], ['--home', '--home', home]]) {
      const { code, outLines, errLines } = await captureConsole(() => installMain(words, { JS_HARNESS_HOME: home }));
      assert.equal(code, 2, words.join(' '));
      assert.deepEqual(errLines, ['--home requires a value\n\nUsage: js-harness install [--home <path>] [--accept-session-messages]'], words.join(' '));
      assert.deepEqual(outLines, [], words.join(' '));
      assert.deepEqual(fs.readdirSync(home), [], `nothing is written for: ${words.join(' ')}`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-001 (accepted final review follow-up, lineage review-cef5637e2884c12a): a component write that
// fails on an already-installed target is reported to the user, not silently dropped. Injected
// through the `deps.writeFile` seam manifest.mjs's `install`/`sync` now accept (chmod is unreliable
// on Windows, so a real permission failure is not how this is simulated).

test('syncMain prints a stderr skip line when a component write fails, naming the path and reason', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const manifest = readManifest(home);
    const target = manifest.files[0].path;
    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };

    const errLines = [];
    const originalError = console.error;
    console.error = (line) => errLines.push(String(line));
    let code;
    try {
      code = await syncMain(['--global', '--home', home], process.env, { writeFile: failingWriteFile });
    } finally {
      console.error = originalError;
    }

    assert.equal(code, 0);
    assert.ok(
      errLines.includes(`skipped ${target}: EACCES: permission denied`),
      `expected a skip line for ${target}, got:\n${errLines.join('\n')}`,
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain counts only the files it actually wrote, not records carried forward after a failed write', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const total = readManifest(home).files.length;
    const target = readManifest(home).files[0].path;
    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };

    const outLines = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (line) => outLines.push(String(line));
    console.error = () => {};
    try {
      await syncMain(['--global', '--home', home], process.env, { writeFile: failingWriteFile });
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }

    assert.match(outLines[0], new RegExp(`\\(${total - 1} files\\)`));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain and uninstallMain also resolve home from JS_HARNESS_HOME when --home is not given', async () => {
  const home = makeTmpHome();
  try {
    await installMain([], { JS_HARNESS_HOME: home });
    const syncCode = await syncMain(['--global'], { JS_HARNESS_HOME: home });
    assert.equal(syncCode, 0);
    assert.equal(readManifest(home).version, currentVersion());

    // T3b item 6, R3-uninstall-cwd-dependent-machine-tests: pinned with --global (see above).
    const uninstallCode = await uninstallMain(['--global'], { JS_HARNESS_HOME: home });
    assert.equal(uninstallCode, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- optional files (the login launcher of `remote start --at-login`): recorded apart from the components ---

/** An optional file in a folder that stands in for the Windows Startup folder, recorded under `home`. */
function recordLauncher(home, name = 'js-harness-remote-x.cmd', content = '@echo off\r\n') {
  const dir = path.join(home, 'Startup');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return recordOptionalFile(home, file, content);
}

test('installMain and syncMain keep the record of an optional file, and the file', async () => {
  const home = makeTmpHome();
  try {
    const record = recordLauncher(home);
    assert.equal(readManifest(home).version, null, 'recorded on a machine where nothing is installed');

    const installed = await captureConsole(() => installMain(['--home', home]));
    assert.equal(installed.code, 0);
    assert.equal(readManifest(home).version, currentVersion());
    assert.deepEqual(readManifest(home).optional, [record]);

    const synced = await captureConsole(() => syncMain(['--global', '--home', home]));
    assert.equal(synced.code, 0);
    assert.deepEqual(readManifest(home).optional, [record]);
    assert.ok(fs.existsSync(record.path));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Session channel, T6: the entries go into the host files (the pause hook's too, in Claude Code's), so a line names the hook it registered.
test('installMain says which hook each entry it registers is, and uninstallMain takes every one back with the files it made', async () => {
  const home = makeTmpHome();
  try {
    const installed = await captureConsole(() => installMain(['--home', home]));
    assert.equal(installed.code, 0);
    const settings = path.join(home, '.claude', 'settings.json');
    const hooks = path.join(home, '.codex', 'hooks.json');
    // One line per declared entry, in declaration order, written from this file's own wording (not install's formatter).
    const registeredLines = entryComponents.map((component) => {
      const entry = component.entry();
      const command = entry.hooks[0].command;
      const matcher = typeof entry.matcher === 'string' ? `, matcher ${entry.matcher}` : '';
      return `registered hook entry in ${component.target(home)}: ${command} (${component.pointer.at(-1)}${matcher})`;
    });
    const actual = installed.outLines.filter((line) => line.startsWith('registered hook entry'));
    assert.deepEqual(actual, registeredLines);
    // The guard's line in full, its matcher included, as one literal.
    assert.ok(actual.includes(`registered hook entry in ${settings}: js-harness guard --hook || exit 0 (PreToolUse, matcher ^(Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash|Write|Edit|mcp__scheduled-tasks__create_scheduled_task|mcp__scheduled-tasks__update_scheduled_task|mcp__scheduled-tasks__run_scheduled_task|RemoteTrigger)$)`));
    const removed = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.equal(removed.code, 0);
    assert.deepEqual(removed.outLines.filter((line) => line.startsWith('removed hook entry from')).sort(), entryComponents.map((component) => `removed hook entry from ${component.target(home)}`).sort());
    assert.deepEqual([fs.existsSync(settings), fs.existsSync(hooks)], [false, false]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain reports an optional file with the removed files, and an edited one with the kept ones', async () => {
  const home = makeTmpHome();
  try {
    const untouched = recordLauncher(home);
    const edited = recordLauncher(home, 'js-harness-remote-y.cmd');
    fs.writeFileSync(edited.path, 'the user was here');

    const { code, outLines } = await captureConsole(() => uninstallMain(['--global', '--home', home]));

    assert.equal(code, 0);
    assert.ok(outLines.includes(`removed ${untouched.path}`), outLines.join('\n'));
    assert.ok(outLines.includes(`kept (modified by you) ${edited.path}`), outLines.join('\n'));
    assert.doesNotMatch(outLines.join('\n'), /nothing installed/, 'a home with only an optional file is not "nothing"');
    assert.equal(fs.existsSync(untouched.path), false);
    assert.equal(fs.readFileSync(edited.path, 'utf8'), 'the user was here');
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// A machine where only `remote start --at-login` ever wrote: its manifest has a null version.

test('syncMain --global over a manifest that only records an optional file installs as on a clean home, and keeps the record', async () => {
  const home = makeTmpHome();
  const clean = makeTmpHome();
  try {
    const record = recordLauncher(home);
    const synced = await captureConsole(() => syncMain(['--global', '--home', home]));
    const expected = await captureConsole(() => syncMain(['--global', '--home', clean]));

    assert.equal(synced.code, 0);
    assert.deepEqual(
      synced.outLines.map((line) => line.replaceAll(home, '<home>')),
      expected.outLines.map((line) => line.replaceAll(clean, '<home>')),
      'the same report as with no manifest at all',
    );
    assert.equal(readManifest(home).version, currentVersion());
    assert.equal(readManifest(home).files.length, readManifest(clean).files.length);
    assert.deepEqual(readManifest(home).optional, [record]);
    assert.ok(fs.existsSync(record.path));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(clean, { recursive: true, force: true });
  }
});

test('uninstallMain --global over a manifest that only records a file that is gone says nothing is installed, and removes the manifest', async () => {
  const home = makeTmpHome();
  try {
    const record = recordLauncher(home);
    fs.rmSync(record.path);
    const { code, outLines } = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.equal(code, 0);
    assert.deepEqual(outLines, [`nothing installed under ${home}`]);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The folder of the machine's gate lock is written by `check` and `gate`, outside any manifest. A gate
// that was killed leaves its files in it; uninstall removes them, unless a gate is alive in it right now.
test('uninstallMain removes what a killed gate left of the gate lock, with or without an install, and says so', async () => {
  const home = makeTmpHome();
  try {
    const old = new Date(Date.now() - 3600 * 1000);
    const leave = () => {
      const file = path.join(gateLockDir(home), 'holder-4321-aaaaaaaaaaaa.json');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify({ pid: 4321, cwd: 'C:\\work\\dead', command: 'check', startedAt: old.toISOString() })}\n`);
      fs.utimesSync(file, old, old);
    };
    await captureConsole(() => installMain(['--home', home]));
    leave();
    const installed = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.equal(installed.code, 0);
    assert.ok(installed.outLines.includes(`removed ${gateDir(home)}`), installed.outLines.join('\n'));
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    leave();
    const bare = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([bare.code, bare.outLines, bare.errLines], [0, [`removed ${gateDir(home)}`], []]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain leaves the gate lock of a gate that is alive, says whose it is and what removes it, and exits 0', async () => {
  const home = makeTmpHome();
  try {
    await captureConsole(() => installMain(['--home', home]));
    const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321, beatMs: 0 });
    try {
      const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home]));
      assert.equal(code, 0);
      assert.deepEqual(errLines, []);
      assert.ok(
        outLines.includes(
          `kept ${gateDir(home)}: a gate holds the machine's gate lock or waits for it right now (pid 4321, in C:\\work\\one); it removes its own files when it ends, and running js-harness uninstall --global again removes whatever is left`,
        ),
        outLines.join('\n'),
      );
      assert.doesNotMatch(outLines.join('\n'), /nothing installed/);
      assert.equal(lock.lost(), false);

      // With nothing else under the home, that line is still the whole of what is said.
      const again = await captureConsole(() => uninstallMain(['--global', '--home', home]));
      assert.deepEqual([again.code, again.outLines.length, again.outLines[0].startsWith(`kept ${gateDir(home)}: `)], [0, 1, true]);
    } finally {
      lock.release();
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain says that nothing more could be read of a live gate whose file names neither a pid nor a folder', async () => {
  const home = makeTmpHome();
  try {
    // A holder's file that beats and names nobody: no pid in its name, and no JSON in it.
    const file = path.join(gateLockDir(home), 'holder-unknown.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'not json');
    const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([code, errLines], [0, []]);
    assert.deepEqual(outLines, [
      `kept ${gateDir(home)}: a gate holds the machine's gate lock or waits for it right now (nothing more of it could be read); it removes its own files when it ends, and running js-harness uninstall --global again removes whatever is left`,
    ]);
    assert.equal(fs.existsSync(file), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain says a folder of the gate lock it could not remove was left, with the error code and what to do, and fails', async () => {
  const home = makeTmpHome();
  try {
    await captureConsole(() => installMain(['--home', home]));
    fs.mkdirSync(gateDir(home), { recursive: true });
    const removeFile = (target, options) => {
      if (target === gateDir(home)) throw Object.assign(new Error('EBUSY: resource busy or locked, rmdir'), { code: 'EBUSY' });
      fs.rmSync(target, options);
    };
    const { code, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { removeFile }));
    assert.equal(code, 1, 'a folder left behind is not a clean uninstall');
    assert.deepEqual(errLines, [`could not remove ${gateDir(home)} (EBUSY): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`]);
    assert.equal(fs.existsSync(manifestPath(home)), false);

    // One it could not even look at is said the same way, and is no "nothing installed" that exits 0.
    const statFile = (target) => {
      if (target === gateDir(home)) throw Object.assign(new Error('EACCES: permission denied, stat'), { code: 'EACCES' });
      return fs.statSync(target);
    };
    const unseen = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { statFile }));
    assert.deepEqual([unseen.code, unseen.outLines], [1, []]);
    assert.deepEqual(unseen.errLines, [`could not remove ${gateDir(home)} (EACCES): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The gate log is written by every gate, in a folder of its own beside the lock's. No gate removes it, so
// uninstall does, unless a gate is alive: that gate has yet to write its end, and the log is kept for it.

/** Writes into the log of `home` what a gate that began there writes, through the gates' own writer, and
 * returns the gate's record: its `end` is what a gate that is alive still has to write. */
function startedGate(home) {
  const gate = gateRecord({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321 });
  gate.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  assert.equal(gate.failure(), undefined);
  return gate;
}

test('uninstallMain removes the gate log, with or without an install, and says so', async () => {
  const home = makeTmpHome();
  try {
    await captureConsole(() => installMain(['--home', home]));
    startedGate(home).end({ result: 'pass' });
    const installed = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([installed.code, installed.errLines], [0, []]);
    assert.ok(installed.outLines.includes(`removed ${gateLogDir(home)}`), installed.outLines.join('\n'));
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    startedGate(home).end({ result: 'pass' });
    const bare = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([bare.code, bare.outLines, bare.errLines], [0, [`removed ${gateLogDir(home)}`], []]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain leaves the gate log of a gate that is alive, in the one line that says the gate lock is kept, and exits 0', async () => {
  const home = makeTmpHome();
  try {
    const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321, beatMs: 0 });
    const gate = startedGate(home);
    try {
      const held = await captureConsole(() => uninstallMain(['--global', '--home', home]));
      assert.deepEqual([held.code, held.errLines], [0, []]);
      assert.deepEqual(held.outLines, [
        `kept ${gateDir(home)} and ${gateLogDir(home)}: a gate holds the machine's gate lock or waits for it right now (pid 4321, in C:\\work\\one), and it has yet to write its end in the gate log; it removes its own files when it ends, and running js-harness uninstall --global again removes the log and whatever else is left`,
      ]);
      assert.equal(fs.existsSync(path.join(gateLogDir(home), 'log.jsonl')), true);
      gate.end({ result: 'pass' });
    } finally {
      lock.release();
    }
    // The gate has ended and removed its own files: the log is all that is left, and it goes.
    const after = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([after.code, after.outLines, after.errLines], [0, [`removed ${gateLogDir(home)}`], []]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain says a gate log it could not remove was left, with the error code and what to do, and fails', async () => {
  const home = makeTmpHome();
  try {
    await captureConsole(() => installMain(['--home', home]));
    startedGate(home).end({ result: 'pass' });
    const removeFile = (target, options) => {
      if (target === gateLogDir(home)) throw Object.assign(new Error('EBUSY: resource busy or locked, rmdir'), { code: 'EBUSY' });
      fs.rmSync(target, options);
    };
    const { code, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { removeFile }));
    assert.equal(code, 1, 'a folder left behind is not a clean uninstall');
    assert.deepEqual(errLines, [`could not remove ${gateLogDir(home)} (EBUSY): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`]);
    assert.equal(fs.existsSync(manifestPath(home)), false);
    assert.equal(fs.existsSync(path.join(gateLogDir(home), 'log.jsonl')), true);

    // One it could not even look at is said the same way, and is no "nothing installed" that exits 0.
    const statFile = (target) => {
      if (target === gateLogDir(home)) throw Object.assign(new Error('EACCES: permission denied, stat'), { code: 'EACCES' });
      return fs.statSync(target);
    };
    const unseen = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { statFile }));
    assert.deepEqual([unseen.code, unseen.outLines], [1, []]);
    assert.deepEqual(unseen.errLines, [`could not remove ${gateLogDir(home)} (EACCES): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Found in review (Codex), 2026-10-11: beside a folder of the lock that could not be looked at, the log was
// removed as if no gate were alive. Nobody had looked, so the log is kept, and the one line says both.
test('uninstallMain leaves the gate log beside a folder of the gate lock it could not look at, says why in the line of that folder, and fails', async () => {
  const home = makeTmpHome();
  try {
    const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321, beatMs: 0 });
    const gate = startedGate(home);
    const statFile = (target) => {
      if (target === gateDir(home)) throw Object.assign(new Error('EACCES: permission denied, stat'), { code: 'EACCES' });
      return fs.statSync(target);
    };
    try {
      const unseen = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { statFile }));
      assert.deepEqual([unseen.code, unseen.outLines], [1, []]);
      assert.deepEqual(unseen.errLines, [
        `could not remove ${gateDir(home)} (EACCES), and kept ${gateLogDir(home)} with it: the folder of the gate lock could not be looked at, so a gate may be alive that has yet to write its end in the gate log; both are still there and nothing records them; run js-harness uninstall --global again, or remove them by hand once no gate runs`,
      ]);
      assert.equal(fs.existsSync(path.join(gateLogDir(home), 'log.jsonl')), true);
      gate.end({ result: 'pass' });
    } finally {
      lock.release();
    }
    // Looked at again, there is no gate: the log is all that is left, and it goes.
    const after = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([after.code, after.outLines, after.errLines], [0, [`removed ${gateLogDir(home)}`], []]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The folder of the session channel is written by `notify`, outside any manifest, like the gate lock's.
// No process lives in it, so it is removed, or it could not be: there is no "kept for now".
test('uninstallMain removes the folder of the session channel, with or without an install, and says so', async () => {
  const home = makeTmpHome();
  try {
    const leave = () => appendNotice(home, 'C--proj', newNotice({ at: '2026-01-01T12:00:00.000Z', from: null, to: 'orchestrator', kind: 'note', text: 'made up' }));
    await captureConsole(() => installMain(['--home', home]));
    leave();
    const installed = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([installed.code, installed.errLines], [0, []]);
    assert.ok(installed.outLines.includes(`removed ${channelDir(home)}`), installed.outLines.join('\n'));
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    leave();
    const bare = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([bare.code, bare.outLines, bare.errLines], [0, [`removed ${channelDir(home)}`], []]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain says a folder of the session channel it could not remove was left, with the error code and what to do, and fails', async () => {
  const home = makeTmpHome();
  try {
    await captureConsole(() => installMain(['--home', home]));
    appendNotice(home, 'C--proj', newNotice({ at: '2026-01-01T12:00:00.000Z', from: null, to: 'orchestrator', kind: 'note', text: 'made up' }));
    const removeFile = (target, options) => {
      if (target === channelDir(home)) throw Object.assign(new Error('EBUSY: resource busy or locked, rmdir'), { code: 'EBUSY' });
      fs.rmSync(target, options);
    };
    const { code, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { removeFile }));
    assert.equal(code, 1, 'a folder left behind is not a clean uninstall');
    assert.deepEqual(errLines, [`could not remove ${channelDir(home)} (EBUSY): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`]);
    assert.equal(fs.existsSync(manifestPath(home)), false);
    assert.equal(fs.existsSync(recordPath(home, 'C--proj')), true);

    // One it could not even look at is said the same way, and is no "nothing installed" that exits 0.
    const statFile = (target) => {
      if (target === channelDir(home)) throw Object.assign(new Error('EACCES: permission denied, stat'), { code: 'EACCES' });
      return fs.statSync(target);
    };
    const unseen = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { statFile }));
    assert.deepEqual([unseen.code, unseen.outLines], [1, []]);
    assert.deepEqual(unseen.errLines, [`could not remove ${channelDir(home)} (EACCES): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain names the memory snapshots it keeps and what removes them, and says a folder of memory hygiene it could not remove', async () => {
  const home = makeTmpHome();
  try {
    const project = path.dirname(journalPath(home, 'C--proj'));
    fs.mkdirSync(path.join(project, 'snapshots', '20261015T120606108Z'), { recursive: true });
    fs.writeFileSync(journalPath(home, 'C--proj'), '');
    const kept = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([kept.code, kept.outLines, kept.errLines], [0, [
      `kept ${project}: 1 snapshot of a memory pass (20261015T120606108Z), the only copy of what that pass changed, with the project's journal; js-harness uninstall --global --full removes them`,
    ], []]);
    fs.rmSync(journalPath(home, 'C--proj'));
    const alone = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual(alone.outLines, [
      `kept ${project}: 1 snapshot of a memory pass (20261015T120606108Z), the only copy of what that pass changed; js-harness uninstall --global --full removes them`,
    ], 'no journal is named where there is none');

    fs.rmSync(path.join(project, 'snapshots'), { recursive: true });
    const removeFile = (target, options) => {
      if (target === hygieneDir(home)) throw Object.assign(new Error('EBUSY: resource busy or locked, rmdir'), { code: 'EBUSY' });
      fs.rmSync(target, options);
    };
    const busy = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { removeFile }));
    assert.deepEqual([busy.code, busy.outLines, busy.errLines], [1, [], [
      `could not remove ${hygieneDir(home)} (EBUSY): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`,
    ]]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// T10, the full uninstall (odd/tasks/memory-hygiene.md, D7).

/** A project folder of memory hygiene under `home` with one snapshot `stamp`, as `memory plan` leaves it. */
function snapshotOf(home, slug, stamp, manifest = { folder: 'C:/memory', writeSet: [], before: {} }) {
  const project = path.dirname(journalPath(home, slug));
  fs.mkdirSync(path.join(project, 'snapshots', stamp), { recursive: true });
  fs.writeFileSync(path.join(project, 'snapshots', stamp, 'manifest.json'), JSON.stringify(manifest));
  return project;
}

test('uninstallMain --global --full removes the memory snapshots and names each project with its stamps', async () => {
  const home = makeTmpHome();
  try {
    const project = snapshotOf(home, 'C--proj', '20261015T120606108Z');
    const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--global', '--full', '--home', home]));
    assert.deepEqual([code, outLines, errLines], [0, [
      `removed ${hygieneDir(home)}`,
      `removed ${project}: 1 snapshot of a memory pass (20261015T120606108Z)`,
    ], []]);
    assert.equal(fs.existsSync(hygieneDir(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('--full goes with --global only, exit 2, and stays an unknown flag of sync', async () => {
  const words = '--full removes the memory snapshots of the machine: it goes with --global';
  for (const argv of [['--full'], ['--full', '--cwd', os.tmpdir()]]) {
    const { code, errLines } = await captureConsole(() => uninstallMain(argv));
    assert.equal(code, 2, argv.join(' '));
    assert.ok(errLines[0].startsWith(`${words}\n\nUsage: js-harness uninstall`), errLines.join('\n'));
  }
  const value = await captureConsole(() => uninstallMain(['--global', '--home', '--full']));
  assert.deepEqual([value.code, value.errLines[0].split('\n')[0]], [2, '--home requires a value'], 'as before: a value is never a flag');
  for (const flag of ['--home', '--cwd']) {
    const inside = await captureConsole(() => uninstallMain(['--global', flag, '--full', path.join(os.tmpdir(), 'other')]));
    assert.deepEqual([inside.code, inside.errLines[0].split('\n')[0]], [2, `${flag} requires a value`], `${flag} --full is a missing value, not a full uninstall`);
  }
  const synced = await captureConsole(() => syncMain(['--global', '--full']));
  assert.equal(synced.code, 2);
  assert.ok(synced.errLines[0].startsWith('unknown flag: --full'), synced.errLines.join('\n'));
});

test('uninstallMain keeps a project under a memory pass with the line that can release its lock, exit 1, in either mode', async () => {
  // A space in the home, as in C:\Users\First Last: the line's commands still run as they are copied.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness cli home '));
  try {
    const planned = snapshotOf(home, 'C--planned', '20261015T120606108Z');
    fs.writeFileSync(path.join(planned, 'lock'), JSON.stringify({ stamp: '20261015T120606108Z', pid: 4242 }));
    const killed = path.dirname(journalPath(home, 'C--killed'));
    fs.mkdirSync(killed, { recursive: true });
    fs.writeFileSync(path.join(killed, 'lock'), JSON.stringify({ stamp: '20261016T090000000Z', pid: 4343 }));
    const lines = [
      `kept ${killed}: ${path.join(killed, 'lock')} holds no finished plan (pid 4343); if that process is not running, remove the file and uninstall again`,
      `kept ${planned}: a memory pass is planned (20261015T120606108Z) for the memory folder C:/memory; from that project's checkout run js-harness memory verify 20261015T120606108Z --home "${home}" or js-harness memory undo 20261015T120606108Z --home "${home}", then uninstall again`,
    ];
    const normal = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([normal.code, normal.outLines, normal.errLines], [1, [], lines]);
    const full = await captureConsole(() => uninstallMain(['--global', '--full', '--home', home]));
    assert.deepEqual([full.code, full.outLines, full.errLines], [1, [], [
      `kept ${hygieneDir(home)}: --full removes it in one piece, and a project in it is under a memory pass; nothing of it was removed`,
      ...lines,
    ]]);
    assert.equal(fs.existsSync(path.join(planned, 'snapshots', '20261015T120606108Z')), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain refuses while another uninstall holds the marker, names one a killed run left, and names a folder left aside', async () => {
  const home = makeTmpHome();
  try {
    snapshotOf(home, 'C--proj', '20261015T120606108Z');
    const marker = purgeMarker(hygieneDir(home));
    fs.writeFileSync(marker, JSON.stringify({ pid: 4242, startedAt: '2026-10-16T08:00:00.000Z' }));
    const live = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { alive: () => true }));
    assert.deepEqual([live.code, live.errLines], [1, [`kept ${hygieneDir(home)}: another uninstall is removing it (pid 4242, ${marker}); run js-harness uninstall --global again once it ends`]]);
    const stale = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { alive: () => false }));
    assert.deepEqual([stale.code, stale.errLines], [1, [`kept ${hygieneDir(home)}: ${marker} was left by an uninstall that ended before removing it (pid 4242); remove that file and run js-harness uninstall --global again`]]);
    fs.rmSync(marker);

    const failing = (target, options) => {
      if (path.basename(target).startsWith('memory-hygiene.purging-')) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
      return fs.rmSync(target, options);
    };
    const partial = await captureConsole(() => uninstallMain(['--global', '--full', '--home', home], {}, { removeFile: failing }));
    assert.deepEqual([partial.code, partial.errLines], [1, [`could not remove ${hygieneDir(home)} (EBUSY): it was put back under its name and may be partly removed; run js-harness uninstall --global --full again`]]);

    const aside = `${hygieneDir(home)}.purging-1-2`;
    fs.renameSync(hygieneDir(home), aside);
    const found = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual([found.code, found.errLines], [1, [`found ${aside}, left by an uninstall that stopped: rename it back to ${hygieneDir(home)} when there is none, else remove it`]]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the project uninstall names the memory snapshots its project keeps under the home, and what removes them', async () => {
  const root = withProgram(makeTmpProjectRepo());
  const home = makeTmpHome();
  try {
    assert.equal(initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' }).code, 0);
    const { slug } = memoryLocation({ home, project: root, run: (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8' }) });
    const project = snapshotOf(home, slug, '20261015T120606108Z');
    const { code, outLines } = await captureConsole(() => uninstallMain(['--cwd', root, '--home', home]));
    assert.equal(code, 0);
    assert.equal(outLines.at(-1), `kept ${project}: 1 snapshot of a memory pass of this project (20261015T120606108Z), under the machine's home; js-harness uninstall --global --full removes them`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain says an optional file it could not read was left, with the error code and what to do, and still removes the rest and the manifest', async () => {
  const home = makeTmpHome();
  try {
    await captureConsole(() => installMain(['--home', home]));
    const blocked = path.join(home, 'Startup', 'js-harness-remote-blocked.cmd');
    fs.mkdirSync(blocked, { recursive: true }); // a folder at the recorded path
    recordOptionalFile(home, blocked, 'as written');

    const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home]));

    assert.equal(code, 1, 'a file left behind and unrecorded is not a clean uninstall');
    const line = errLines.find((text) => text.includes(blocked));
    assert.ok(line, errLines.join('\n'));
    assert.match(line, /^could not read /);
    assert.match(line, /\(EISDIR\)/);
    assert.match(line, /no longer recorded/);
    assert.match(line, /remove it by hand/);
    assert.doesNotMatch(outLines.join('\n'), /modified by you/, 'nobody edited it');
    assert.ok(outLines.some((text) => text.startsWith('removed ') && text.endsWith('SKILL.md')), outLines.join('\n'));
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain says an optional file it could not remove was left, with the error code and what to do', async () => {
  const home = makeTmpHome();
  try {
    const locked = recordLauncher(home);
    const removeFile = (target, ...rest) => {
      if (target === locked.path) throw Object.assign(new Error(`EBUSY: resource busy or locked, unlink '${locked.path}'`), { code: 'EBUSY' });
      fs.rmSync(target, ...rest);
    };

    const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { removeFile }));

    assert.equal(code, 1, 'a file left behind and unrecorded is not a clean uninstall');
    assert.deepEqual(errLines, [
      `could not remove ${locked.path} (EBUSY): it is still there and no longer recorded, so nothing else will remove it; remove it by hand`,
    ]);
    assert.doesNotMatch(outLines.join('\n'), /modified by you|nothing installed/);
    assert.ok(fs.existsSync(locked.path));
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- scheduled tasks (the watchdog of `remote start --at-login`): recorded by name and by the command they run ---

const TASK = { name: 'js-harness-remote-x', command: 'C:\\Windows\\System32\\conhost.exe', arguments: '--headless node remote.mjs start --cwd D:\\proj --name proj --watchdog' };

/** A stand-in for `schtasks.exe` over `tasks` (name to `{ command, arguments }`): it lists them, prints one back
 * and deletes one, or exits `failing[verb]` instead (`list`, `read`, `delete`). No test here runs the real one. */
function fakeSchtasks(tasks, failing = {}) {
  const store = new Map(Object.entries(tasks));
  const deleted = [];
  const run = (args) => {
    const name = args[args.indexOf('/TN') + 1];
    const verb = args[0] === '/Query' ? (args.includes('/XML') ? 'read' : 'list') : args[0].slice(1).toLowerCase();
    if (failing[verb] !== undefined) return { status: failing[verb], stdout: '' };
    if (verb === 'list') return { status: 0, stdout: [...store.keys()].map((task) => `"\\${task}","N/A","Ready"`).join('\r\n') };
    if (verb === 'read') {
      const task = store.get(name);
      return task ? { status: 0, stdout: `<Task><Actions Context="Author"><Exec><Command>${task.command}</Command><Arguments>${task.arguments}</Arguments></Exec></Actions></Task>` } : { status: 1, stdout: '' };
    }
    if (verb === 'delete' && store.delete(name)) {
      deleted.push(name);
      return { status: 0, stdout: '' };
    }
    throw new Error(`the fake schtasks does not know ${args.join(' ')}`);
  };
  return { run, store, deleted };
}

test('installMain and syncMain keep the record of a scheduled task, and run no schtasks', async () => {
  const home = makeTmpHome();
  try {
    recordScheduledTask(home, TASK);
    const schtasks = () => { throw new Error('schtasks must not be run by install or sync'); };
    const installed = await captureConsole(() => installMain(['--home', home], {}, { schtasks }));
    assert.equal(installed.code, 0);
    assert.equal(readManifest(home).version, currentVersion());
    assert.deepEqual(readManifest(home).tasks, [TASK]);
    const synced = await captureConsole(() => syncMain(['--global', '--home', home], {}, { schtasks }));
    assert.equal(synced.code, 0);
    assert.deepEqual(readManifest(home).tasks, [TASK]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain deletes a recorded task that still runs the recorded command, and keeps one that was edited, saying how to delete it', async () => {
  const home = makeTmpHome();
  try {
    const edited = { ...TASK, name: 'js-harness-remote-y' };
    const gone = { ...TASK, name: 'js-harness-remote-z' };
    for (const task of [TASK, edited, gone]) recordScheduledTask(home, task);
    const tasks = fakeSchtasks({ [TASK.name]: TASK, [edited.name]: { ...edited, arguments: '--headless calc.exe' } });

    const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { schtasks: tasks.run }));

    assert.equal(code, 0, errLines.join('\n'));
    assert.deepEqual(errLines, []);
    assert.deepEqual(outLines, [
      `removed scheduled task ${TASK.name}`,
      `kept scheduled task ${edited.name} (modified by you): it is no longer recorded, and schtasks /Delete /TN ${edited.name} /F deletes it`,
    ], 'a home with only a task is not "nothing", and a task that is already gone is not reported');
    assert.deepEqual(tasks.deleted, [TASK.name]);
    assert.equal(tasks.store.has(edited.name), true);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain says a task it could not look at or delete was left, with how to look and how to delete it by hand, and fails', async () => {
  const cases = {
    'the tasks cannot be listed': [{ list: 1 }, /^could not look for scheduled task js-harness-remote-x \(.*could not be listed/],
    'the delete fails': [{ delete: 5 }, /^could not delete scheduled task js-harness-remote-x \(schtasks \/Delete \/TN js-harness-remote-x \/F exited 5\)/],
  };
  for (const [what, [failing, message]] of Object.entries(cases)) {
    const home = makeTmpHome();
    try {
      recordScheduledTask(home, TASK);
      const tasks = fakeSchtasks({ [TASK.name]: TASK }, failing);
      const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { schtasks: tasks.run }));
      assert.equal(code, 1, `${what}: a task left behind is not a clean uninstall`);
      assert.equal(errLines.length, 1, errLines.join('\n'));
      assert.match(errLines[0], message, what);
      assert.match(errLines[0], /it is still recorded/, what);
      assert.match(errLines[0], /js-harness uninstall --global.*again/, `${what}: it says the uninstall can be run again`);
      assert.match(errLines[0], /js-harness remote stop --at-login/, what);
      assert.ok(errLines[0].includes(`schtasks /Query /TN ${TASK.name}`), errLines[0]);
      assert.ok(errLines[0].includes(`schtasks /Delete /TN ${TASK.name} /F`), errLines[0]);
      assert.doesNotMatch(outLines.join('\n'), /modified by you|nothing installed/, what);
      assert.equal(tasks.store.has(TASK.name), true, what);
      assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], tasks: [TASK] }, `${what}: the record of the task that still fires is kept`);

      // Run again once schtasks answers: the task is deleted, and nothing is left.
      for (const verb of Object.keys(failing)) delete failing[verb];
      const again = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { schtasks: tasks.run }));
      assert.deepEqual({ code: again.code, out: again.outLines, err: again.errLines }, { code: 0, out: [`removed scheduled task ${TASK.name}`], err: [] }, what);
      assert.equal(fs.existsSync(manifestPath(home)), false, what);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('uninstallMain finds schtasks from the environment it is given and nowhere else, and never runs the real one from a test', async () => {
  const home = makeTmpHome();
  try {
    recordScheduledTask(home, TASK);
    // The program it would run is the one of the SystemRoot it was handed: seen through a spawnSync that runs nothing.
    const ran = [];
    const spawnSync = (file, args) => {
      ran.push([file, ...args]);
      return { status: 1, stdout: '' };
    };
    const given = await captureConsole(() => uninstallMain(['--global', '--home', home], { SystemRoot: 'Q:\\Given' }, { spawnSync }));
    assert.equal(given.code, 1);
    assert.deepEqual(ran, [['Q:\\Given\\System32\\schtasks.exe', '/Query', '/FO', 'CSV']]);

    // With nothing injected it refuses, whatever the environment says: one that names no Windows folder, and one
    // whose folder holds no schtasks.exe (so that nothing real could run even without the refusal).
    for (const env of [{}, { SystemRoot: path.join(os.tmpdir(), 'js-harness-no-such-windows') }]) {
      const { code, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home], env));
      assert.equal(code, 1);
      assert.match(errLines.join('\n'), /^could not look for scheduled task js-harness-remote-x \(the real schtasks\.exe is never run from a test/);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T3 (project-init): uninstallMain's scope routing — see project.mjs's uninstallProject and
// "T3 design" ---

test('uninstallMain rejects an unknown flag with usage and exit 2', async () => {
  const { code, errLines } = await captureConsole(() => uninstallMain(['--bogus']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('unknown flag: --bogus')));
  assert.ok(errLines.some((l) => l.includes('Usage: js-harness uninstall')));
});

test('uninstallMain rejects --cwd with no value, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => uninstallMain(['--cwd']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--cwd requires a value')));
});

test('uninstallMain rejects --home with no value, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => uninstallMain(['--home']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--home requires a value')));
});

test('uninstallMain rejects --global combined with --cwd, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => uninstallMain(['--global', '--cwd', '/tmp/whatever']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--global cannot be combined with --cwd')));
});

test('uninstallMain --cwd undoes the project and prints its own report', async () => {
  const root = withProgram(makeTmpProjectRepo());
  try {
    const initResult = initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);

    const { code, outLines } = await captureConsole(() => uninstallMain(['--cwd', root]));

    assert.equal(code, 0);
    assert.ok(outLines.includes('removed harness.json'));
    assert.ok(outLines.includes('removed AGENTS.md'));
    assert.ok(outLines.includes('removed .codegraph/'));
    assert.ok(outLines.some((l) => l.startsWith('removed manifest ')));
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uninstallMain --cwd reports a kept file on stderr with its reason', async () => {
  const root = makeTmpProjectRepo();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'edited by hand\n', 'utf8');

    const { code, errLines } = await captureConsole(() => uninstallMain(['--cwd', root]));

    assert.equal(code, 0); // a kept file is not a failure
    assert.ok(errLines.includes('kept AGENTS.md (changed since init)'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// An explicit `--cwd` names a project, so a folder that is not an initialized one is an error, never
// a silent fall-through to the machine: a second `uninstall --cwd <repo>` after the first one would
// otherwise remove the machine install.
for (const [label, makeCwd] of [
  ['outside any git repository', () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-notaproject-'))],
  ['in a git repository init never touched', makeTmpProjectRepo],
]) {
  test(`uninstallMain --cwd ${label} exits 1 and leaves the machine install alone`, async () => {
    const home = makeTmpHome();
    const cwd = makeCwd();
    try {
      await installMain(['--home', home]);

      const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--cwd', cwd, '--home', home]));

      assert.equal(code, 1);
      assert.equal(fs.existsSync(manifestPath(home)), true);
      assert.deepEqual(outLines, []);
      assert.ok(errLines.some((l) => l.includes('not an initialized project') && l.includes('--global')));
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('uninstallMain --global reaches the machine even from inside an initialized project, leaving it untouched', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    const initResult = initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' });
    assert.equal(initResult.code, 0);
    await installMain(['--home', home]);

    const originalCwd = process.cwd();
    process.chdir(root);
    let result;
    try {
      result = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    } finally {
      process.chdir(originalCwd);
    }

    assert.equal(result.code, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false); // the machine install was reached
    // The project itself is completely untouched.
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
    assert.ok(fs.existsSync(initResult.manifestPath));
    assert.ok(fs.existsSync(path.join(root, 'AGENTS.md')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/** Runs `fn` with `dir` as the process cwd, restoring the original cwd afterwards. */
async function inDir(dir, fn) {
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(originalCwd);
  }
}

// Sebastián's rule (roadmap, Decided: "Command scope"): with no flags, inside a git repository that
// is not an initialized project — a second `uninstall` in the same repo, say — `uninstall` refuses
// and names --global instead of removing the machine install.
test('uninstallMain with no flags inside an uninitialized git repository exits 1 and leaves the machine install alone', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);

    const { code, outLines, errLines } = await inDir(root, () => captureConsole(() => uninstallMain(['--home', home])));

    assert.equal(code, 1);
    assert.equal(fs.existsSync(manifestPath(home)), true);
    assert.deepEqual(outLines, []);
    assert.ok(errLines.some((l) => l.includes('not an initialized project') && l.includes('--global')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain run twice in the same project undoes it once, then refuses rather than reaching the machine', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    assert.equal(initProject(root, '0.1.0', { spawn: fakeCodegraphSpawn(), platform: 'linux' }).code, 0);
    await installMain(['--home', home]);

    const first = await inDir(root, () => captureConsole(() => uninstallMain(['--home', home])));
    const second = await inDir(root, () => captureConsole(() => uninstallMain(['--home', home])));

    assert.equal(first.code, 0);
    assert.equal(fs.existsSync(path.join(root, 'harness.json')), false);
    assert.equal(second.code, 1);
    assert.equal(fs.existsSync(manifestPath(home)), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain with no flags outside any git repository still undoes the machine install', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-nogit-'));
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);

    const { code } = await inDir(dir, () => captureConsole(() => uninstallMain(['--home', home])));

    assert.equal(code, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T4 (project-init): syncMain's scope routing — see project.mjs's syncProject and "T4 design" ---

/** A fresh clone of an initialized project: `harness.json` pinned to `version` and a committed
 * `AGENTS.md`, but no manifest, hook or `.codegraph/` in this clone. */
function makeTmpClone(version = currentVersion(), { agents = true } = {}) {
  const dir = makeTmpProjectRepo();
  fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify({ version }, null, 2) + '\n', 'utf8');
  if (agents) fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# committed\n', 'utf8');
  return dir;
}

const projectDeps = () => ({ spawn: fakeCodegraphSpawn(), platform: 'linux' });

test('syncMain rejects an unknown flag with usage and exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--bogus']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('unknown flag: --bogus')));
  assert.ok(errLines.some((l) => l.includes('Usage: js-harness sync')));
});

test('syncMain rejects --cwd with no value, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--cwd']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--cwd requires a value')));
});

test('syncMain rejects --home with no value, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--home']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--home requires a value')));
});

test('syncMain rejects --home followed by another flag, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--home', '--global']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--home requires a value')));
});

test('syncMain rejects --global combined with --cwd, exit 2', async () => {
  const { code, errLines } = await captureConsole(() => syncMain(['--global', '--cwd', '/tmp/whatever']));
  assert.equal(code, 2);
  assert.ok(errLines.some((l) => l.includes('--global cannot be combined with --cwd')));
});

test('syncMain --cwd sets a fresh clone up, prints what it wrote, and a second run says up to date', async () => {
  const root = withProgram(makeTmpClone());
  try {
    const first = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(first.code, 0);
    assert.ok(first.outLines.includes('wrote .git/hooks/pre-commit'));
    assert.ok(first.outLines.includes('ran codegraph init'));
    assert.ok(first.outLines.some((l) => l.startsWith('manifest: ')));
    assert.ok(first.errLines.includes('kept harness.json (committed)'));
    assert.ok(first.errLines.includes('kept AGENTS.md (committed)'));
    assert.ok(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')));

    const second = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(second.code, 0);
    assert.deepEqual(second.outLines, [`up to date at ${currentVersion()}`]);
    assert.deepEqual(second.errLines, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd reports a missing AGENTS.md as a skip on stderr and does not create it', async () => {
  const root = makeTmpClone(currentVersion(), { agents: false });
  try {
    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 0);
    assert.ok(errLines.some((l) => l.startsWith('AGENTS.md skipped: ')));
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd restores a gone hook and prints it', async () => {
  const root = makeTmpProjectRepo();
  try {
    assert.equal(initProject(root, currentVersion(), projectDeps()).code, 0);
    fs.rmSync(path.join(root, '.git', 'hooks', 'pre-commit'));

    const { code, outLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 0);
    assert.ok(outLines.includes('wrote .git/hooks/pre-commit'));
    assert.ok(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd reports a codegraph failure on stderr and still exits 0', async () => {
  const root = withProgram(makeTmpClone());
  try {
    const failing = (cmd, args, opts) =>
      cmd === 'git' ? spawnSync('git', args, opts) : { status: 1, stdout: '', stderr: 'codegraph exploded' };

    const { code, errLines } = await captureConsole(() =>
      syncMain(['--cwd', root], process.env, { spawn: failing, platform: 'linux' }),
    );

    assert.equal(code, 0);
    assert.ok(errLines.some((l) => l.startsWith('codegraph init failed: ') && l.includes('codegraph exploded')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain with a pin different from the running version writes nothing, exits 1 and names both ways out', async () => {
  const root = makeTmpClone('9.9.9');
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const machineManifest = fs.readFileSync(manifestPath(home));

    const { code, outLines, errLines } = await captureConsole(() =>
      syncMain(['--cwd', root, '--home', home], process.env, projectDeps()),
    );

    assert.equal(code, 1);
    assert.deepEqual(outLines, []);
    const message = errLines.join('\n');
    assert.match(message, /9\.9\.9/);
    assert.ok(message.includes(currentVersion()));
    // No version is tagged before 1.0.0: the message names no install by a tag, only what works today.
    assert.equal(message.includes('#v'), false, 'no version is tagged, so no command installs one by its tag');
    assert.match(message, /no version of js-harness is tagged yet/i);
    assert.ok(message.includes('install the newest copy on this machine (npm i -g github:jsaristi/js-harness, or the same with the package manager that installed it) and '), 'the newest copy is the one that can be installed, by whichever package manager put the old one there');
    assert.ok(message.includes(`set the pin to ${currentVersion()} in harness.json`));
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
    assert.deepEqual(fs.readFileSync(manifestPath(home)), machineManifest); // the machine install is untouched too
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// install-update T6: no version is no pin, not an unreadable file.
test('syncMain --cwd says there is nothing to move to, and how to pin, when harness.json holds no version', async () => {
  const root = makeTmpProjectRepo();
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{ "sameTree": "skip" }\n', 'utf8');

    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    const said = errLines.join('\n');
    assert.match(said, /harness\.json pins no version, so there is nothing to move this project to; nothing was written/);
    assert.ok(said.includes(`add "version": "${currentVersion()}" to harness.json and commit it`), said);
    assert.doesNotMatch(said, /cannot read the pin/);
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
    assert.equal(fs.readFileSync(path.join(root, 'harness.json'), 'utf8'), '{ "sameTree": "skip" }\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd names harness.json and exits 1 when it is not valid JSON', async () => {
  const root = makeTmpProjectRepo();
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{ not json', 'utf8');

    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => l.includes('harness.json') && l.includes('nothing was written')));
    assert.equal(fs.existsSync(path.join(root, '.git', 'js-harness')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd refuses a stale manifest with the same wording init uses, exit 1', async () => {
  const root = makeTmpProjectRepo();
  try {
    assert.equal(initProject(root, currentVersion(), projectDeps()).code, 0);
    fs.rmSync(path.join(root, 'harness.json'));

    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => l.includes('was initialized before') && l.includes('harness.json is missing')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd reports a malformed manifest, exit 1', async () => {
  const root = makeTmpProjectRepo();
  try {
    const initResult = initProject(root, currentVersion(), projectDeps());
    fs.writeFileSync(initResult.manifestPath, '{ not json', 'utf8');

    const { code, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => l.includes('is malformed')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// A manifest written by a newer copy holds what this one cannot undo (odd/tasks/on-demand-functions.md, slice 2):
// both commands refuse, say which copy wrote it, and touch nothing.
test('syncMain and uninstallMain --cwd refuse a project manifest of a newer format, exit 1', async () => {
  const root = makeTmpProjectRepo();
  try {
    const initResult = initProject(root, currentVersion(), projectDeps());
    const written = JSON.stringify({ ...initResult.manifest, format: 99 });
    fs.writeFileSync(initResult.manifestPath, written, 'utf8');

    for (const main of [() => syncMain(['--cwd', root], process.env, projectDeps()), () => uninstallMain(['--cwd', root])]) {
      const { code, errLines } = await captureConsole(main);
      assert.equal(code, 1);
      assert.ok(
        errLines.some((l) => l.includes('in format 99, and this copy reads format 1') && l.includes('run that version of js-harness')),
        errLines.join('\n'),
      );
    }
    assert.equal(fs.readFileSync(initResult.manifestPath, 'utf8'), written);
    assert.ok(fs.existsSync(path.join(root, 'harness.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd reports a failed write as "sync failed", says what was left behind, and exits 1', async () => {
  const root = makeTmpClone();
  try {
    const open = () => {
      throw new Error('ENOSPC: no space left on device');
    };

    const { code, errLines } = await captureConsole(() =>
      syncMain(['--cwd', root], process.env, { ...projectDeps(), open }),
    );

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => l.startsWith('sync failed: ') && l.includes('ENOSPC') && l.includes('nothing was left behind')));
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('syncMain --cwd with a directory that does not exist says so, exit 1', async () => {
  const missing = path.join(os.tmpdir(), 'js-harness-cli-sync-missing-dir');
  const { code, errLines } = await captureConsole(() => syncMain(['--cwd', missing]));
  assert.equal(code, 1);
  assert.ok(errLines.includes(`no such directory: ${missing}`));
});

// An explicit `--cwd` names a project, so a folder that is not an initialized one is an error, never
// a silent fall-through to the machine.
for (const [label, makeCwd] of [
  ['outside any git repository', () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-sync-notaproject-'))],
  ['in a git repository init never touched', makeTmpProjectRepo],
]) {
  test(`syncMain --cwd ${label} exits 1, names --global and leaves the machine install alone`, async () => {
    const home = makeTmpHome();
    const cwd = makeCwd();
    try {
      await installMain(['--home', home]);
      const before = fs.readFileSync(manifestPath(home));

      const { code, outLines, errLines } = await captureConsole(() => syncMain(['--cwd', cwd, '--home', home]));

      assert.equal(code, 1);
      assert.deepEqual(outLines, []);
      assert.ok(errLines.some((l) => l.includes('not an initialized project') && l.includes('--global')));
      assert.deepEqual(fs.readFileSync(manifestPath(home)), before);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('syncMain with no flags inside an uninitialized git repository exits 1 and names --global', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const before = fs.readFileSync(manifestPath(home));

    const { code, outLines, errLines } = await inDir(root, () => captureConsole(() => syncMain(['--home', home])));

    assert.equal(code, 1);
    assert.deepEqual(outLines, []);
    assert.ok(errLines.some((l) => l.includes('not an initialized project') && l.includes('--global')));
    assert.deepEqual(fs.readFileSync(manifestPath(home)), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain with no flags inside an initialized project syncs the project, not the machine', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    assert.equal(initProject(root, currentVersion(), projectDeps()).code, 0);
    fs.rmSync(path.join(root, '.git', 'hooks', 'pre-commit'));

    const { code, outLines } = await inDir(root, () =>
      captureConsole(() => syncMain(['--home', home], process.env, projectDeps())),
    );

    assert.equal(code, 0);
    assert.ok(outLines.includes('wrote .git/hooks/pre-commit'));
    assert.equal(fs.existsSync(manifestPath(home)), false); // nothing was installed on the machine
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain --global reaches the machine even from inside an initialized project, leaving it untouched', async () => {
  const root = makeTmpProjectRepo();
  const home = makeTmpHome();
  try {
    const initResult = initProject(root, currentVersion(), projectDeps());
    assert.equal(initResult.code, 0);
    fs.rmSync(path.join(root, '.git', 'hooks', 'pre-commit'));
    await installMain(['--home', home]);

    const { code, outLines } = await inDir(root, () => captureConsole(() => syncMain(['--global', '--home', home])));

    assert.equal(code, 0);
    assert.ok(outLines.some((l) => l.startsWith('synced js-harness ')));
    assert.equal(readManifest(home).version, currentVersion());
    // The project is completely untouched: the gone hook stays gone.
    assert.equal(fs.existsSync(path.join(root, '.git', 'hooks', 'pre-commit')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain with no flags outside any git repository still syncs the machine install', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-sync-nogit-'));
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);

    const { code, outLines } = await inDir(dir, () => captureConsole(() => syncMain(['--home', home])));

    assert.equal(code, 0);
    assert.ok(outLines.some((l) => l.startsWith('synced js-harness ')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain never prints the bytes of a malformed harness.json (terminal escapes included)', async () => {
  const root = makeTmpClone();
  try {
    fs.writeFileSync(path.join(root, 'harness.json'), '{ "version": "\u001b[2J\u001b]0;pwned\u0007", oops', 'utf8');
    const { code, outLines, errLines } = await captureConsole(() => syncMain(['--cwd', root], process.env, projectDeps()));

    assert.equal(code, 1);
    assert.ok(errLines.some((l) => /harness\.json: it is not valid JSON; nothing was written$/.test(l)));
    assert.doesNotMatch([...outLines, ...errLines].join('\n'), /\u001b|\u0007/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// The folder `js-harness remote` writes under the home is recorded by no manifest either. It is removed and said
// with the rest, or it is kept and the line says why and what to run: uninstall stops no process.
const SUPERVISOR = { pid: 4242, startedAt: 1700000000000, root: 'C:\\proj', name: 'proj' };

function leaveRemote(home, state = null) {
  const files = remoteFiles(home, 'proj-0123456789ab');
  fs.mkdirSync(remoteDir(home), { recursive: true });
  fs.writeFileSync(files.logPath, 'made up\n');
  fs.writeFileSync(files.stoppedPath, 'stopped on purpose\n');
  if (state !== null) fs.writeFileSync(files.statePath, `${JSON.stringify(state, null, 2)}\n`);
  return files;
}

test('uninstallMain removes the folder js-harness remote left, with or without an install, and says so', async () => {
  const home = makeTmpHome();
  try {
    const identify = () => [];
    await captureConsole(() => installMain(['--home', home]));
    leaveRemote(home);
    const installed = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { identify }));
    assert.deepEqual([installed.code, installed.errLines], [0, []]);
    assert.ok(installed.outLines.includes(`removed ${remoteDir(home)}`), installed.outLines.join('\n'));
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    leaveRemote(home, SUPERVISOR);
    const bare = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { identify }));
    assert.deepEqual([bare.code, bare.outLines, bare.errLines], [0, [`removed ${remoteDir(home)}`], []]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain says why it kept the remote folder and what to run, and fails: a server that runs, one it cannot tell, a task it kept, a folder it could not remove', async () => {
  const home = makeTmpHome();
  try {
    const dir = remoteDir(home);
    const run = (deps) => captureConsole(() => uninstallMain(['--global', '--home', home], {}, deps));

    const files = leaveRemote(home, SUPERVISOR);
    const running = await run({ identify: () => [{ pid: SUPERVISOR.pid, createdAt: SUPERVISOR.startedAt }] });
    assert.deepEqual([running.code, running.outLines], [1, []], 'a server left running is not a finished uninstall, and no "nothing installed"');
    assert.deepEqual(running.errLines, [
      `kept ${dir}: the remote server of C:\\proj is running (supervisor pid 4242), and uninstall stops no process; run js-harness remote stop in that project, then js-harness uninstall --global again`,
    ]);
    assert.equal(fs.existsSync(files.statePath), true);

    const unknown = await run({ identify: () => { throw new Error('made up'); } });
    assert.equal(unknown.code, 1);
    assert.deepEqual(unknown.errLines, [
      `kept ${dir}: it cannot be told whether a remote server still runs: the processes could not be listed (made up), so the supervisor recorded as pid 4242 may still be running; run js-harness uninstall --global again, or remove the folder by hand once you have checked that no remote server runs`,
    ]);

    const removeFile = (target, options) => {
      if (target === dir) throw Object.assign(new Error('EBUSY: resource busy or locked, rmdir'), { code: 'EBUSY' });
      fs.rmSync(target, options);
    };
    const locked = await run({ identify: () => [], removeFile });
    assert.equal(locked.code, 1);
    assert.deepEqual(locked.errLines, [`could not remove ${dir} (EBUSY): it is still there and nothing records it; remove it by hand, or run js-harness uninstall --global again`]);

    // Beside a task that was kept, the folder is kept for it and said after the task's own line.
    recordScheduledTask(home, TASK);
    const tasks = fakeSchtasks({ [TASK.name]: TASK }, { list: 1 });
    const beside = await run({ identify: () => [], schtasks: tasks.run });
    assert.equal(beside.code, 1);
    assert.equal(beside.errLines.length, 2, beside.errLines.join('\n'));
    assert.equal(
      beside.errLines[1],
      `kept ${dir}: the scheduled task ${TASK.name} is still registered, and the marker a stop left in that folder is what keeps it from starting the server again; run js-harness uninstall --global again once the task is gone`,
    );
    assert.equal(fs.existsSync(files.stoppedPath), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Codex review of 724e14f: the line of an edited task said "no longer recorded". Beside a remote folder that is
// kept for it the record stays, so that the next uninstall still knows the task and leaves the marker under it.
test('uninstallMain says a task the user edited stays recorded while the remote folder is kept for it, and fails', async () => {
  const home = makeTmpHome();
  try {
    recordScheduledTask(home, TASK);
    leaveRemote(home);
    const tasks = fakeSchtasks({ [TASK.name]: { ...TASK, arguments: '--headless calc.exe' } });
    const { code, outLines, errLines } = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { identify: () => [], schtasks: tasks.run }));
    assert.equal(code, 1);
    assert.deepEqual(outLines, [
      `kept scheduled task ${TASK.name} (modified by you): it stays recorded while the folder of js-harness remote is kept for it; schtasks /Delete /TN ${TASK.name} /F deletes it, and js-harness uninstall --global then removes what is left`,
    ]);
    assert.deepEqual(errLines, [
      `kept ${remoteDir(home)}: the scheduled task ${TASK.name} is still registered, and the marker a stop left in that folder is what keeps it from starting the server again; run js-harness uninstall --global again once the task is gone`,
    ]);
    assert.deepEqual(readManifest(home).tasks, [TASK]);
    assert.deepEqual(tasks.deleted, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain names the throughput snapshots it keeps, and the gentle-ai review starts beside them when there are any', async () => {
  const home = makeTmpHome();
  try {
    const folder = path.join(home, '.js-harness', 'throughput');
    fs.mkdirSync(path.join(folder, 'C--proj'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'C--proj', '2026-10-16.json'), '{}');
    const snapshots = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual(snapshots.outLines, [`kept ${folder}: 1 day snapshot of the throughput review, the only copy of the gates of days the gate log has rotated away; remove the folder by hand to drop them`]);
    fs.writeFileSync(path.join(folder, 'C--proj', 'review-starts.jsonl'), '');
    const starts = await captureConsole(() => uninstallMain(['--global', '--home', home]));
    assert.deepEqual(starts.outLines, [`kept ${folder}: 1 day snapshot of the throughput review, the only copy of the gates of days the gate log has rotated away, and the gentle-ai review starts of 1 project, the only record of when those reviews began; remove the folder by hand to drop them`]);
    // A folder that could not be listed is named with what it may hold.
    const listDir = (dir, ...rest) => (path.resolve(dir).startsWith(path.resolve(folder)) ? (() => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); })() : fs.readdirSync(dir, ...rest));
    const unlisted = await captureConsole(() => uninstallMain(['--global', '--home', home], {}, { listDir }));
    assert.deepEqual(unlisted.outLines, [`kept ${folder}: the day snapshots of the throughput review, the only copy of the gates of days the gate log has rotated away, and any gentle-ai review starts recorded there; remove the folder by hand to drop them`]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
