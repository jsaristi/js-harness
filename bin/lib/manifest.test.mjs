import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  components,
  entryComponents,
  sha256,
  manifestPath,
  readManifest,
  install,
  sync,
  uninstall,
  recordOptionalFile,
  forgetOptionalFile,
  installedVersion,
  recordScheduledTask,
  forgetScheduledTask,
  putOptionalRecordBack,
  putTaskRecordBack,
  scheduledTaskAction,
  lookAtScheduledTask,
  runSchtasks,
} from './manifest.mjs';
import { cachePath, writeCache } from './cache.mjs';
import { gateDir, gateLockDir, takeGateLock } from './gate-lock.mjs';
import { appendGateEvent, gateLogDir, gateRecord, readGateLog } from './gate-log.mjs';
import { appendNotice, appendRelief, channelDir, newNotice, recordPath, writeOpening } from './channel.mjs';

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
}

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

const [claudeHook, codexHook] = entryComponents;

test('sha256 is deterministic', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.notEqual(sha256('abc'), sha256('abd'));
});

test('install writes every component and records a manifest', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.files.length, components.length);

    for (const component of components) {
      const target = component.target(home);
      assert.ok(fs.existsSync(target), `expected ${target} to exist`);
      const content = fs.readFileSync(target, 'utf8');
      assert.equal(content, component.content('0.1.0'));
      // Every component is a skill: its frontmatter names it after the folder it is installed in.
      const frontmatter = /^---\nname: (.+)\ndescription: .+\n---\n/.exec(content);
      assert.equal(frontmatter?.[1], path.basename(path.dirname(target)), target);
    }

    const onDisk = readManifest(home);
    assert.deepEqual(onDisk, manifest);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install writes the Claude and Codex skill files at the documented paths', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    for (const host of ['.claude', '.codex']) {
      for (const skill of ['js-harness', 'js-harness-orchestrator']) {
        assert.ok(fs.existsSync(path.join(home, host, 'skills', skill, 'SKILL.md')), `${host} ${skill}`);
      }
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Other tests index the first two, so a new component goes after them.
test('the components are the two skills, each for Claude Code and for Codex, the first skill first', () => {
  assert.deepEqual(components.map((component) => component.id), ['claude-skill', 'codex-skill', 'claude-orchestrator-skill', 'codex-orchestrator-skill']);
  assert.equal(new Set(components.map((component) => component.target('home'))).size, components.length, 'no two components share a file');
});

test('sync rewrites components for the current version and updates the manifest', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const manifest = sync(home, '0.2.0');
    assert.equal(manifest.version, '0.2.0');
    for (const component of components) {
      const content = fs.readFileSync(component.target(home), 'utf8');
      assert.equal(content, component.content('0.2.0'));
    }
    assert.deepEqual(readManifest(home), manifest);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync removes a file that the current components no longer ship', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    // Simulate an older release that shipped one extra file no longer in `components`.
    const orphanPath = path.join(home, '.claude', 'skills', 'js-harness-old', 'SKILL.md');
    fs.mkdirSync(path.dirname(orphanPath), { recursive: true });
    fs.writeFileSync(orphanPath, 'stale content', 'utf8');
    const staleManifest = {
      version: '0.1.0',
      files: [...manifest.files, { path: orphanPath, sha256: sha256('stale content') }],
    };
    fs.writeFileSync(manifestPath(home), JSON.stringify(staleManifest, null, 2));

    sync(home, '0.2.0');

    assert.equal(fs.existsSync(orphanPath), false);
    assert.equal(fs.existsSync(path.dirname(orphanPath)), false, 'now-empty directory should be removed');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes unmodified files, keeps modified ones, and deletes the manifest', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const [claudeComponent, codexComponent] = components;
    // The user edited the codex copy; uninstall must keep it.
    fs.writeFileSync(codexComponent.target(home), 'user was here', 'utf8');

    const result = uninstall(home);

    assert.equal(fs.existsSync(claudeComponent.target(home)), false);
    assert.equal(fs.existsSync(codexComponent.target(home)), true);
    const untouched = components.filter((component) => component !== codexComponent).map((component) => component.target(home));
    for (const target of untouched) assert.equal(fs.existsSync(target), false, target);
    assert.deepEqual(result.removed, untouched);
    assert.deepEqual(result.kept, [codexComponent.target(home)]);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes now-empty directories it created', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    uninstall(home);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'js-harness')), false);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'skills', 'js-harness')), false);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'js-harness-orchestrator')), false);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'skills', 'js-harness-orchestrator')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall on a home with no manifest is a no-op', () => {
  const home = makeTmpHome();
  try {
    const result = uninstall(home);
    assert.deepEqual(result, { removed: [], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [] });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- the machine's gate lock: what `check` and `gate` write under the home, outside any manifest ---
// A gate removes its own files when it ends, and the folder `gate` with them. One that was killed leaves
// its holder's file, or its folder in line, until the next gate sweeps it; `uninstall` is the other way
// it goes, so that whatever the harness wrote under the home can be undone exactly.

/** What gates that were killed leave under `home`: the lock with its holder's file and the folder of a
 * gate in line, both last touched `secondsAgo`. */
function leftByKilledGates(home, secondsAgo = 3600) {
  const at = new Date(Date.now() - secondsAgo * 1000);
  const files = [path.join(gateLockDir(home), 'holder-4321-aaaaaaaaaaaa.json'), path.join(gateDir(home), 'wait-4322-bbbbbbbbbbbb', 'holder-4322-bbbbbbbbbbbb.json')];
  for (const [index, file] of files.entries()) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({ pid: 4321 + index, cwd: 'C:\\work\\dead', command: 'check', startedAt: at.toISOString(), waitingSince: at.toISOString() })}\n`);
    fs.utimesSync(file, at, at);
    fs.utimesSync(path.dirname(file), at, at);
  }
}

test('uninstall removes the folder of the gate lock and what a gate that was killed left in it', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    leftByKilledGates(home);
    const result = uninstall(home);
    assert.ok(result.removed.includes(gateDir(home)), result.removed.join('\n'));
    assert.deepEqual(result.gateKept, []);
    assert.equal(fs.existsSync(gateDir(home)), false);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'the now-empty .js-harness goes too');

    // An empty folder, which is what every gate left behind before a release removed it.
    install(home, '0.1.0');
    fs.mkdirSync(gateDir(home), { recursive: true });
    assert.ok(uninstall(home).removed.includes(gateDir(home)));
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    // And nothing is said of a folder that is not there.
    install(home, '0.1.0');
    assert.equal(uninstall(home).removed.includes(gateDir(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// `check` runs in a project with no machine install, so a home with no manifest can hold the lock's folder.
test('uninstall removes what a killed gate left under a home that has no manifest', () => {
  const home = makeTmpHome();
  try {
    leftByKilledGates(home);
    const result = uninstall(home);
    assert.deepEqual(result, { removed: [gateDir(home)], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [] });
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall leaves the folder of the gate lock while a live gate holds the lock or waits for it, and says whose gate it is', async () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321, beatMs: 0 });
    const held = uninstall(home);
    assert.deepEqual(held.gateKept, [{ path: gateDir(home), reason: 'in-use', pid: 4321, cwd: 'C:\\work\\one' }]);
    assert.equal(held.removed.includes(gateDir(home)), false);
    assert.equal(lock.lost(), false, 'the gate still holds its lock');
    // The rest of the install is undone all the same.
    assert.equal(fs.existsSync(manifestPath(home)), false);
    // The gate removes its own files, and the folder `gate`, when it ends; the uninstall that is run
    // again then finds nothing of the lock, and leaves no folder of the harness.
    lock.release();
    assert.equal(fs.existsSync(gateDir(home)), false);
    assert.deepEqual(uninstall(home).removed, []);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    // A gate in line and nobody holding the lock: read in the instant between a release and its take.
    const waiting = path.join(gateDir(home), 'wait-4250-cccccccccccc', 'holder-4250-cccccccccccc.json');
    fs.mkdirSync(path.dirname(waiting), { recursive: true });
    fs.writeFileSync(waiting, `${JSON.stringify({ pid: 4250, cwd: 'C:\\work\\two', command: 'check', waitingSince: new Date().toISOString() })}\n`);
    assert.deepEqual(uninstall(home).gateKept, [{ path: gateDir(home), reason: 'in-use', pid: 4250, cwd: 'C:\\work\\two' }]);
    assert.equal(fs.existsSync(waiting), true);

    // Once nothing has touched it for the stale time it is what a gate that died left, and it goes.
    const old = new Date(Date.now() - 3600 * 1000);
    fs.utimesSync(waiting, old, old);
    fs.utimesSync(path.dirname(waiting), old, old);
    const swept = uninstall(home);
    assert.deepEqual([swept.gateKept, swept.removed], [[], [gateDir(home)]]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps a folder of the gate lock it cannot remove, reports it with the error code, and still finishes', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    leftByKilledGates(home);
    const removeFile = (target, options) => {
      if (target === gateDir(home)) throw Object.assign(new Error('EPERM: operation not permitted, rmdir'), { code: 'EPERM' });
      fs.rmSync(target, options);
    };
    const result = uninstall(home, { removeFile });
    assert.deepEqual(result.gateKept, [{ path: gateDir(home), reason: 'unremovable', code: 'EPERM' }]);
    assert.equal(result.removed.includes(gateDir(home)), false);
    assert.equal(fs.existsSync(gateLockDir(home)), true);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest is removed all the same');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/** A seam of `uninstall` (`statFile`, `listDir`): the `real` call, but for `target`, which it refuses with
 * `code` as the system does for what it gives no access to. File permissions cannot be relied on to make
 * that happen on Windows. */
function refusedAt(target, real, code = 'EACCES') {
  return (asked, ...rest) => {
    if (asked === target) throw Object.assign(new Error(`${code}: permission denied, '${asked}'`), { code });
    return real(asked, ...rest);
  };
}

// Found in review, 2026-10-10: the folder was looked for with `existsSync`, which answers "not there" for
// one it could not look at. Uninstall then said there was nothing to remove and exited 0 over the lock's files.
test('uninstall keeps a folder of the gate lock it could not look at and reports it with the error code, with a manifest and without', () => {
  const home = makeTmpHome();
  try {
    const statFile = refusedAt(gateDir(home), fs.statSync);
    const notLookedAt = [{ path: gateDir(home), reason: 'unremovable', code: 'EACCES' }];

    install(home, '0.1.0');
    leftByKilledGates(home);
    const installed = uninstall(home, { statFile });
    assert.deepEqual(installed.gateKept, notLookedAt);
    assert.equal(installed.removed.includes(gateDir(home)), false);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest is removed all the same');

    const bare = uninstall(home, { statFile });
    assert.deepEqual(bare, { removed: [], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: notLookedAt, channelKept: [] });
    assert.equal(fs.existsSync(gateLockDir(home)), true, 'nothing of it was removed on a guess');

    // "Not there" is what the system says of the folder itself, or of a parent that is a file.
    for (const code of ['ENOENT', 'ENOTDIR']) {
      const result = uninstall(home, { statFile: refusedAt(gateDir(home), fs.statSync, code) });
      assert.deepEqual([result.removed, result.gateKept], [[], []], code);
    }
    assert.deepEqual(uninstall(home).removed, [gateDir(home)]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Found in the same review: the empty folders above what was removed are cleared with a listing, and a
// `.js-harness` that can be looked at and not listed made that throw, so the caller never got the result.
test('uninstall leaves a folder it cannot list where it is, and still returns what it removed and kept, with a manifest and without', () => {
  const home = makeTmpHome();
  try {
    const own = path.join(home, '.js-harness');
    const listDir = refusedAt(own, fs.readdirSync);
    const none = { kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [] };

    leftByKilledGates(home);
    assert.deepEqual(uninstall(home, { listDir }), { removed: [gateDir(home)], ...none });
    assert.equal(fs.existsSync(own), true, 'not known to be empty, so left');

    // With what could not be looked at as well: the two findings met in one home.
    leftByKilledGates(home);
    const statFile = refusedAt(gateDir(home), fs.statSync);
    assert.deepEqual(uninstall(home, { listDir, statFile }), { removed: [], ...none, gateKept: [{ path: gateDir(home), reason: 'unremovable', code: 'EACCES' }] });

    install(home, '0.1.0');
    const installed = uninstall(home, { listDir });
    assert.ok(installed.removed.includes(gateDir(home)), installed.removed.join('\n'));
    assert.deepEqual([fs.existsSync(manifestPath(home)), fs.existsSync(own)], [false, true]);

    // Nothing fails: the folder goes, as it always did.
    assert.deepEqual(uninstall(home), { removed: [], ...none });
    assert.equal(fs.existsSync(own), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- the gate log: what every gate appends under the home, outside any manifest ---
// A gate writes a line when it starts and one when it ends, in a folder of its own beside the lock's
// (`gate-log.mjs`). Unlike the lock's files nothing ever removes them: the log is there to be read after
// the gate. So `uninstall` is the only way it goes, and it goes whole, the rotated file included.

/** What a result of `uninstall` holds beside `removed` when nothing else was there to undo. */
const NOTHING_ELSE = { kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [] };

/** Every file and folder under `home`, as paths from it, in order: what "the home is as before" compares. */
const everythingUnder = (home) => fs.readdirSync(home, { recursive: true }).map(String).sort();

/** What gates leave in the log of `home`, written by the gates' own writer: one that ran and ended, and one
 * that was refused its turn, which finds the file past its bound and rotates it. So the folder holds both of
 * the files it can hold. */
function leftByGates(home) {
  const ran = gateRecord({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321 });
  ran.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  ran.end({ result: 'pass' });
  const refused = gateRecord({ home, cwd: 'C:\\work\\two', command: 'check', pid: 4322, append: (logHome, event) => appendGateEvent(logHome, event, { maxBytes: 0 }) });
  refused.refused({ reason: 'held', waitedMs: 0, waitedFor: [] });
  assert.deepEqual([ran.failure(), refused.failure()], [undefined, undefined]);
  assert.deepEqual(fs.readdirSync(gateLogDir(home)).sort(), ['log.1.jsonl', 'log.jsonl']);
}

test('uninstall removes the folder of the gate log whole, with a manifest and without, and the home is as it was before any gate', () => {
  const home = makeTmpHome();
  try {
    // A home as a user has it: a file of theirs, and the folders of the two hosts, which are the hosts' own
    // and stay when `uninstall` has taken out of them what `install` put in.
    fs.writeFileSync(path.join(home, 'theirs.txt'), 'theirs\n');
    for (const host of ['.claude', '.codex']) fs.mkdirSync(path.join(home, host));
    const before = everythingUnder(home);
    assert.deepEqual(before, ['.claude', '.codex', 'theirs.txt']);

    // `check` runs in a project with no machine install, so a home with no manifest holds the log as well.
    leftByGates(home);
    assert.deepEqual(uninstall(home), { removed: [gateLogDir(home)], ...NOTHING_ELSE });
    assert.equal(fs.existsSync(gateLogDir(home)), false);
    assert.deepEqual(everythingUnder(home), before);

    install(home, '0.1.0');
    leftByGates(home);
    const installed = uninstall(home);
    assert.ok(installed.removed.includes(gateLogDir(home)), installed.removed.join('\n'));
    assert.deepEqual(installed.gateKept, []);
    assert.equal(fs.existsSync(gateLogDir(home)), false);
    assert.deepEqual(everythingUnder(home), before);

    // With what a killed gate left of the lock and with the session channel: named after the lock's folder.
    leftByGates(home);
    leftByKilledGates(home);
    leftByNotify(home);
    assert.deepEqual(uninstall(home), { ...NOTHING_ELSE, removed: [gateDir(home), gateLogDir(home), channelDir(home)] });
    assert.deepEqual(everythingUnder(home), before);

    // And nothing is said of a folder that is not there.
    install(home, '0.1.0');
    assert.equal(uninstall(home).removed.includes(gateLogDir(home)), false);
    assert.deepEqual(everythingUnder(home), before);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// A gate that is alive has written its start and not yet its end. A log removed under it would be made
// again by that end line, and the folder `uninstall` said it removed would be back, holding half a gate.
test('uninstall keeps the gate log while a gate is alive, with the folder of its lock and in the same entry, and removes it once that gate has ended', async () => {
  for (const withManifest of [true, false]) {
    const home = makeTmpHome();
    try {
      if (withManifest) install(home, '0.1.0');
      const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321, beatMs: 0 });
      const gate = gateRecord({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321 });
      gate.start({ lock: 'own', waitedMs: 0, waitedFor: [] });

      const held = uninstall(home);
      assert.deepEqual(held.gateKept, [{ path: gateDir(home), reason: 'in-use', pid: 4321, cwd: 'C:\\work\\one', log: gateLogDir(home) }], String(withManifest));
      assert.deepEqual(held.removed.filter((removed) => [gateDir(home), gateLogDir(home)].includes(removed)), []);
      assert.equal(fs.existsSync(manifestPath(home)), false, 'the rest of the install is undone all the same');

      // The gate ends: its end line lands beside its start, in the folder that was left for it.
      gate.end({ result: 'pass' });
      assert.equal(gate.failure(), undefined);
      assert.deepEqual(readGateLog(home).events.map((event) => event.event), ['start', 'end']);
      lock.release();

      // The gate removed the lock's folder itself; the log is what is left, and the next uninstall takes it.
      assert.deepEqual(uninstall(home), { ...NOTHING_ELSE, removed: [gateLogDir(home)] });
      assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('uninstall says nothing of a gate log beside a live gate that has not written one', async () => {
  const home = makeTmpHome();
  try {
    // A gate writes its start when its sensors are about to run: one that has only just taken the lock, or
    // that runs under a switched-off log, has made no folder, and none is named.
    const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321, beatMs: 0 });
    assert.deepEqual(uninstall(home), { ...NOTHING_ELSE, removed: [], gateKept: [{ path: gateDir(home), reason: 'in-use', pid: 4321, cwd: 'C:\\work\\one' }] });
    lock.release();
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps a folder of the gate log it cannot look at or remove, reports it with the error code, and still finishes', async () => {
  const home = makeTmpHome();
  try {
    const kept = (code) => [{ path: gateLogDir(home), reason: 'unremovable', code }];
    const notRemoved = (folder) => (target, options) => {
      if (target === folder) throw Object.assign(new Error('EPERM: operation not permitted, rmdir'), { code: 'EPERM' });
      return fs.rmSync(target, options);
    };

    install(home, '0.1.0');
    leftByGates(home);
    leftByKilledGates(home);
    const installed = uninstall(home, { removeFile: notRemoved(gateLogDir(home)) });
    assert.deepEqual(installed.gateKept, kept('EPERM'));
    assert.equal(installed.removed.includes(gateLogDir(home)), false);
    assert.ok(installed.removed.includes(gateDir(home)), 'the folder of the lock goes all the same');
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest is removed all the same');

    const bare = uninstall(home, { statFile: refusedAt(gateLogDir(home), fs.statSync) });
    assert.deepEqual(bare, { ...NOTHING_ELSE, removed: [], gateKept: kept('EACCES') });
    assert.deepEqual(fs.readdirSync(gateLogDir(home)).sort(), ['log.1.jsonl', 'log.jsonl'], 'nothing of it was removed on a guess');

    // "Not there" is what the system says of the folder itself, or of a parent that is a file.
    for (const code of ['ENOENT', 'ENOTDIR']) {
      const result = uninstall(home, { statFile: refusedAt(gateLogDir(home), fs.statSync, code) });
      assert.deepEqual([result.removed, result.gateKept], [[], []], code);
    }

    // A folder of the lock that could not be removed was looked at first and holds no live gate, so the
    // log goes: it is kept for a gate that is alive, and for nothing else.
    leftByKilledGates(home);
    const lockStays = uninstall(home, { removeFile: notRemoved(gateDir(home)) });
    assert.deepEqual([lockStays.removed, lockStays.gateKept], [[gateLogDir(home)], [{ path: gateDir(home), reason: 'unremovable', code: 'EPERM' }]]);
    assert.deepEqual(uninstall(home).removed, [gateDir(home)]);

    // A live gate and a log that cannot be looked at: the lock's folder is in use, and the log is not said
    // to be kept with it on a guess. It is the failure it is, in an entry of its own.
    const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321, beatMs: 0 });
    leftByGates(home);
    assert.deepEqual(uninstall(home, { statFile: refusedAt(gateLogDir(home), fs.statSync) }).gateKept, [
      { path: gateDir(home), reason: 'in-use', pid: 4321, cwd: 'C:\\work\\one' },
      ...kept('EACCES'),
    ]);
    lock.release();
    assert.deepEqual(uninstall(home).removed, [gateLogDir(home)]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Found in review (Codex), 2026-10-11: a folder of the lock that could not be looked at was kept as one that
// could not be removed, and the log went as beside a folder that holds no live gate. Nobody had looked: a
// gate that was alive then wrote its end into a folder made again, without its start, after `uninstall`
// said the log was removed.
test('uninstall keeps the gate log when the folder of the lock could not be looked at, since nobody knows whether a gate is alive, and names it in that entry', async () => {
  for (const withManifest of [true, false]) {
    const home = makeTmpHome();
    try {
      if (withManifest) install(home, '0.1.0');
      const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321, beatMs: 0 });
      const gate = gateRecord({ home, cwd: 'C:\\work\\one', command: 'check', pid: 4321 });
      gate.start({ lock: 'own', waitedMs: 0, waitedFor: [] });

      const statFile = refusedAt(gateDir(home), fs.statSync);
      const unseen = uninstall(home, { statFile });
      assert.deepEqual(unseen.gateKept, [{ path: gateDir(home), reason: 'unremovable', code: 'EACCES', log: gateLogDir(home) }], String(withManifest));
      assert.deepEqual(unseen.removed.filter((removed) => [gateDir(home), gateLogDir(home)].includes(removed)), []);
      assert.equal(fs.existsSync(manifestPath(home)), false, 'the rest of the install is undone all the same');

      // The gate was alive: its end lands beside its start, in the folder that was left for it.
      gate.end({ result: 'pass' });
      assert.equal(gate.failure(), undefined);
      assert.deepEqual(readGateLog(home).events.map((event) => event.event), ['start', 'end']);

      // A log that could not be looked at either is the failure it is, in an entry of its own, and is not
      // said to be kept for a gate.
      assert.deepEqual(uninstall(home, { statFile: refusedAt(gateLogDir(home), statFile, 'EPERM') }).gateKept, [
        { path: gateDir(home), reason: 'unremovable', code: 'EACCES' },
        { path: gateLogDir(home), reason: 'unremovable', code: 'EPERM' },
      ]);

      // The gate has ended and removed the folder of its lock. Where that still cannot be looked at the log
      // is still kept, and where it can, nothing is there and the log goes, as it does after any gate.
      lock.release();
      assert.deepEqual(uninstall(home, { statFile }), { ...NOTHING_ELSE, removed: [], gateKept: [{ path: gateDir(home), reason: 'unremovable', code: 'EACCES', log: gateLogDir(home) }] });
      assert.deepEqual(uninstall(home), { ...NOTHING_ELSE, removed: [gateLogDir(home)] });
      assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

// --- the session channel: what `notify` writes under the home, outside any manifest ---
// The record of each project and the openings of its sessions are one folder, written by `notify` in a
// project with or without a machine install. Like the gate lock's folder nothing records it, and
// `uninstall` is how it goes. The relief file is not the channel's: it is the orchestrator's own log,
// which `notify --relief` only adds a line to, and it is left where it is.

/** What `notify` leaves under `home` for one project: a record with one notice and one opening. */
function leftByNotify(home, slug = 'C--proj') {
  const notice = newNotice({ at: '2026-01-01T12:00:00.000Z', from: null, to: 'orchestrator', kind: 'note', text: 'made up' });
  appendNotice(home, slug, notice);
  writeOpening(home, slug, { title: 'JH 5 · canal entre sesiones', text: 'made up', at: notice.at, from: null });
}

test('uninstall removes the folder of the session channel, with its records and openings, with a manifest and without', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    leftByNotify(home);
    leftByNotify(home, 'C--other');
    const installed = uninstall(home);
    assert.ok(installed.removed.includes(channelDir(home)), installed.removed.join('\n'));
    assert.deepEqual(installed.channelKept, []);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'the now-empty .js-harness goes too');

    // `notify` runs in a project with no machine install, so a home with no manifest can hold the folder.
    leftByNotify(home);
    leftByKilledGates(home);
    assert.deepEqual(uninstall(home), { removed: [gateDir(home), channelDir(home)], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [] });
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    // And nothing is said of a folder that is not there.
    install(home, '0.1.0');
    assert.equal(uninstall(home).removed.includes(channelDir(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall leaves the orchestrator\'s relief file where it is: it is a log, not something install or notify made up', () => {
  const home = makeTmpHome();
  try {
    leftByNotify(home);
    const relief = appendRelief(home, 'C--proj', 'made up', Date.now()).path;
    for (const withManifest of [true, false]) {
      if (withManifest) install(home, '0.1.0');
      leftByNotify(home);
      const result = uninstall(home);
      assert.ok(result.removed.includes(channelDir(home)), String(withManifest));
      assert.equal(result.removed.includes(relief), false);
      assert.equal(fs.existsSync(relief), true, `with a manifest: ${withManifest}`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps a folder of the session channel it cannot look at or remove, reports it with the error code, and still finishes', () => {
  const home = makeTmpHome();
  try {
    const kept = (code) => [{ path: channelDir(home), reason: 'unremovable', code }];
    const removeFile = (target, options) => {
      if (target === channelDir(home)) throw Object.assign(new Error('EPERM: operation not permitted, rmdir'), { code: 'EPERM' });
      return fs.rmSync(target, options);
    };

    install(home, '0.1.0');
    leftByNotify(home);
    const installed = uninstall(home, { removeFile });
    assert.deepEqual(installed.channelKept, kept('EPERM'));
    assert.equal(installed.removed.includes(channelDir(home)), false);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest is removed all the same');

    const bare = uninstall(home, { statFile: refusedAt(channelDir(home), fs.statSync) });
    assert.deepEqual(bare, { removed: [], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: kept('EACCES') });
    assert.equal(fs.existsSync(recordPath(home, 'C--proj')), true, 'nothing of it was removed on a guess');

    // "Not there" is what the system says of the folder itself, or of a parent that is a file.
    for (const code of ['ENOENT', 'ENOTDIR']) {
      const result = uninstall(home, { statFile: refusedAt(channelDir(home), fs.statSync, code) });
      assert.deepEqual([result.removed, result.channelKept], [[], []], code);
    }
    assert.deepEqual(uninstall(home).removed, [channelDir(home)]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/** A `listDir` seam for a folder that is listed as empty and cannot be removed: listing `target` puts a file
 * in it first and answers that it holds nothing, as when the file arrived between the listing and the
 * removal. The refusal is then the system's own, of a folder that is not empty. */
function filledWhenListed(target) {
  return (asked, ...rest) => {
    if (asked !== target) return fs.readdirSync(asked, ...rest);
    fs.writeFileSync(path.join(target, 'arrived-late.txt'), 'not ours', 'utf8');
    return [];
  };
}

/** The two ways a folder left empty stays where it is, each as what makes the `listDir` seam of `folder`. */
const LEFT_BEHIND = [
  ['a folder that cannot be listed', (folder) => refusedAt(folder, fs.readdirSync)],
  ['a folder listed as empty that cannot be removed', filledWhenListed],
];

// The other half of that finding had no test: the removal that fails, after a listing that worked.
test('uninstall leaves a folder it listed as empty and could not remove, and still returns what it removed', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const folder = path.dirname(components[0].target(home));
    const result = uninstall(home, { listDir: filledWhenListed(folder) });
    assert.deepEqual([result.removed, result.kept], [manifest.files.map((file) => file.path), []]);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the manifest is removed all the same');
    assert.deepEqual(fs.readdirSync(folder), ['arrived-late.txt'], 'the folder is left with what is in it');
    // What stopped it is the system, not the seam: this is the call that failed inside `uninstall`.
    assert.throws(() => fs.rmdirSync(folder), { code: 'ENOTEMPTY' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// `sync` shares that tidying: it threw there too before the same fix, and it is the caller's manifest that
// a throw would take.
test('sync returns its manifest when the folder a pruned file leaves cannot be listed, or cannot be removed', () => {
  for (const [what, seam] of LEFT_BEHIND) {
    const home = makeTmpHome();
    try {
      const installed = install(home, '0.1.0');
      // An older release shipped one more file, as in the test of the pruning above.
      const orphanPath = path.join(home, '.claude', 'skills', 'js-harness-old', 'SKILL.md');
      const folder = path.dirname(orphanPath);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(orphanPath, 'stale content', 'utf8');
      fs.writeFileSync(manifestPath(home), JSON.stringify({ ...installed, files: [...installed.files, { path: orphanPath, sha256: sha256('stale content') }] }, null, 2));

      const manifest = sync(home, '0.2.0', { listDir: seam(folder) });
      assert.equal(manifest.version, '0.2.0', what);
      assert.deepEqual(readManifest(home), manifest, what);
      assert.deepEqual([fs.existsSync(orphanPath), fs.existsSync(folder)], [false, true], `${what}: the file is pruned and its folder left`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

// --- T4: entry-level manifest records (install registers one hook entry per host) ---

test('entryComponents declare the SessionStart hook for Claude and Codex', () => {
  assert.equal(claudeHook.id, 'claude-hook');
  assert.deepEqual(claudeHook.pointer, ['hooks', 'SessionStart']);
  assert.deepEqual(claudeHook.target('/h'), path.join('/h', '.claude', 'settings.json'));
  assert.equal(codexHook.id, 'codex-hook');
  assert.deepEqual(codexHook.pointer, ['hooks', 'SessionStart']);
  assert.deepEqual(codexHook.target('/h'), path.join('/h', '.codex', 'hooks.json'));

  const entry = claudeHook.entry();
  assert.deepEqual(entry, {
    matcher: 'startup|resume',
    hooks: [{ type: 'command', command: 'js-harness doctor --hook', timeout: 10 }],
  });
  assert.deepEqual(codexHook.entry(), entry);
});

test('install creates a missing hook file from {} and records createdFile: true', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    assert.equal(manifest.entries.length, entryComponents.length);

    const claudeTarget = claudeHook.target(home);
    const data = readJson(claudeTarget);
    assert.deepEqual(data, { hooks: { SessionStart: [claudeHook.entry()] } });

    const record = manifest.entries.find((e) => e.path === claudeTarget);
    assert.equal(record.createdFile, true);
    assert.deepEqual(record.pointer, ['hooks', 'SessionStart']);
    assert.deepEqual(record.entry, claudeHook.entry());
    assert.equal(record.sha256, sha256(JSON.stringify(claudeHook.entry())));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install appends the hook entry to an existing file without disturbing other entries', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = {
      hooks: {
        SessionStart: [
          { matcher: 'startup|resume|clear|compact', hooks: [{ type: 'command', command: 'echo unrelated', timeout: 5 }] },
        ],
        Stop: [{ hooks: [{ type: 'command', command: 'echo stop', timeout: 5 }] }],
      },
    };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, 2)}\n`, 'utf8');

    const manifest = install(home, '0.1.0');

    const data = readJson(target);
    assert.equal(data.hooks.SessionStart.length, 2);
    assert.deepEqual(data.hooks.SessionStart[0], seeded.hooks.SessionStart[0]);
    assert.deepEqual(data.hooks.SessionStart[1], claudeHook.entry());
    assert.deepEqual(data.hooks.Stop, seeded.hooks.Stop);

    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.createdFile, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install preserves 2-space indent, trailing newline and CRLF line endings', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = { hooks: { SessionStart: [] } };
    const crlfText = `${JSON.stringify(seeded, null, 2)}\n`.replace(/\n/g, '\r\n');
    fs.writeFileSync(target, crlfText, 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.ok(raw.includes('\r\n'), 'expected CRLF line endings to be preserved');
    assert.ok(!/[^\r]\n/.test(raw), 'expected every newline to be preceded by \\r');
    assert.ok(raw.endsWith('\r\n'), 'expected the trailing newline to be preserved');
    assert.deepEqual(JSON.parse(raw), { hooks: { SessionStart: [claudeHook.entry()] } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install does not preserve a trailing newline when the original file had none', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ hooks: { SessionStart: [] } }, null, 2), 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.ok(!raw.endsWith('\n'), 'expected no trailing newline to be added');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install is idempotent: a second install adds no duplicate hook entry', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    const before = fs.readFileSync(target, 'utf8');

    const manifest = install(home, '0.1.0');

    const after = fs.readFileSync(target, 'utf8');
    assert.equal(after, before, 'a repeat install must not rewrite an already-correct file');
    const data = readJson(target);
    assert.equal(data.hooks.SessionStart.length, 1);
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.createdFile, true, 'createdFile must still be true on the second install');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install skips a malformed JSON hook file and reports it, without overwriting it', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'not json', 'utf8');

    const manifest = install(home, '0.1.0');

    assert.equal(fs.readFileSync(target, 'utf8'), 'not json', 'malformed file must be left untouched');
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
    assert.equal(record.reason, 'malformed JSON');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes exactly the deep-equal entry and leaves the rest of the file untouched', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = {
      hooks: {
        SessionStart: [
          { matcher: 'startup|resume|clear|compact', hooks: [{ type: 'command', command: 'echo unrelated', timeout: 5 }] },
        ],
      },
    };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, 2)}\n`, 'utf8');

    install(home, '0.1.0');
    const result = uninstall(home);

    assert.ok(result.entriesRemoved.includes(target));
    const data = readJson(target);
    assert.deepEqual(data, seeded);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall deletes a hook file it created once removing our entry leaves it empty', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    assert.ok(fs.existsSync(target));

    uninstall(home);

    assert.equal(fs.existsSync(target), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps a hook file untouched and reports it kept when the user removed our entry', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    const userEdited = { hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'user command', timeout: 1 }] }] } };
    fs.writeFileSync(target, JSON.stringify(userEdited, null, 2), 'utf8');

    const result = uninstall(home);

    assert.ok(result.entriesKept.includes(target));
    assert.deepEqual(readJson(target), userEdited);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync removes an entry a previous manifest had but the current components no longer declare', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const orphanTarget = path.join(home, '.some-other-host', 'config.json');
    fs.mkdirSync(path.dirname(orphanTarget), { recursive: true });
    const orphanEntry = { matcher: 'x', hooks: [] };
    fs.writeFileSync(orphanTarget, JSON.stringify({ hooks: { SessionStart: [orphanEntry] } }, null, 2), 'utf8');
    const staleManifest = {
      ...manifest,
      entries: [
        ...manifest.entries,
        {
          path: orphanTarget,
          pointer: ['hooks', 'SessionStart'],
          entry: orphanEntry,
          sha256: sha256(JSON.stringify(orphanEntry)),
          createdFile: false,
        },
      ],
    };
    fs.writeFileSync(manifestPath(home), JSON.stringify(staleManifest, null, 2));

    sync(home, '0.2.0');

    assert.deepEqual(readJson(orphanTarget), { hooks: { SessionStart: [] } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an old manifest without an entries field still loads for sync and uninstall', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const { entries, ...withoutEntries } = manifest;
    fs.writeFileSync(manifestPath(home), JSON.stringify(withoutEntries, null, 2));

    assert.doesNotThrow(() => sync(home, '0.2.0'));
    assert.doesNotThrow(() => uninstall(home));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall also removes the doctor cache and the now-empty .js-harness directory', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null });
    assert.ok(fs.existsSync(cachePath(home)));

    uninstall(home);

    assert.equal(fs.existsSync(cachePath(home)), false);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T4 native review follow-ups (lineage review-41e6050d1d54018f) ---

// R3-001: never overwrite a user value of an unexpected shape along the pointer path.

test('R3-001: install leaves the file untouched and reports skipped when an intermediate key is not an object', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const original = JSON.stringify({ hooks: 'not-an-object' });
    fs.writeFileSync(target, original, 'utf8');

    const manifest = install(home, '0.1.0');

    assert.equal(fs.readFileSync(target, 'utf8'), original, 'expected the file to be byte-for-byte untouched');
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-001: install leaves the file untouched and reports skipped when the leaf is not an array', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const original = JSON.stringify({ hooks: { SessionStart: 'oops' } });
    fs.writeFileSync(target, original, 'utf8');

    const manifest = install(home, '0.1.0');

    assert.equal(fs.readFileSync(target, 'utf8'), original, 'expected the file to be byte-for-byte untouched');
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-002: an fs failure on an entry target must not throw out of install/sync; the manifest must
// still be written for whatever was actually written, and createdFile survives a re-install.

test('R3-002: install reports an entry skipped without throwing when the target path is itself a directory', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(target, { recursive: true }); // a directory sits where the file should be

    let manifest;
    assert.doesNotThrow(() => {
      manifest = install(home, '0.1.0');
    });

    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
    // The other entry component (codex-hook) must still be written normally.
    const codexRecord = manifest.entries.find((e) => e.path === codexHook.target(home));
    assert.equal(codexRecord.skipped, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-002: install reports an entry skipped without throwing when the host directory is itself a plain file', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.rmSync(path.join(home, '.claude'), { recursive: true, force: true });
    fs.writeFileSync(path.join(home, '.claude'), 'this is a file, not a directory', 'utf8');

    let manifest;
    assert.doesNotThrow(() => {
      manifest = install(home, '0.1.0');
    });

    const target = claudeHook.target(home);
    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true);
    assert.equal(fs.readFileSync(path.join(home, '.claude'), 'utf8'), 'this is a file, not a directory');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-002: createdFile from a previous manifest survives a re-install where the entry target fails', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    assert.ok(fs.existsSync(target));
    // Simulate the target becoming unreachable between installs (e.g. replaced by a directory).
    fs.rmSync(target, { force: true });
    fs.mkdirSync(target, { recursive: true });

    const manifest = install(home, '0.1.0');

    const record = manifest.entries.find((e) => e.path === target);
    assert.equal(record.skipped, true, 'this install call could not reach the target');
    assert.equal(record.createdFile, true, 'createdFile must be carried forward from the previous manifest');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-003: uninstall deletes a file it created only when nothing but empty containers along our own
// pointer path remain; any other key, even an empty-valued one, keeps the file.

test('R3-003: uninstall keeps a hook file js-harness created when an unrelated key is left in the document', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const target = claudeHook.target(home);
    const data = readJson(target);
    data.unrelated = {}; // any other key, even an empty-valued one, must keep the file
    fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');

    const result = uninstall(home);

    assert.ok(fs.existsSync(target), 'expected the file to survive because of the unrelated key');
    assert.deepEqual(readJson(target), { hooks: { SessionStart: [] }, unrelated: {} });
    // R3-002 (accepted final review follow-up, lineage review-cef5637e2884c12a): the previous
    // assertion here (`!result.entriesRemoved.includes(target) || fs.existsSync(target)`) was
    // tautological — `fs.existsSync(target)` was already proven true above, so the whole expression
    // was true no matter what `entriesRemoved` held. The real, currently-true behavior it should
    // have proven is that removing our entry is still reported even though the file itself survives
    // (only the unrelated key keeps it on disk).
    assert.ok(
      result.entriesRemoved.includes(target),
      'expected the entry removal to be reported even though the file survives',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-005: preserve the original file's indentation (and its trailing-newline/CRLF handling) when
// rewriting, rather than always reformatting to 2 spaces.

test('R3-005: install preserves 4-space indentation when appending to an existing hook file', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = { hooks: { SessionStart: [] } };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, 4)}\n`, 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.equal(raw, `${JSON.stringify({ hooks: { SessionStart: [claudeHook.entry()] } }, null, 4)}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-005: install preserves tab indentation when appending to an existing hook file', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = { hooks: { SessionStart: [] } };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, '\t')}\n`, 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.equal(raw, `${JSON.stringify({ hooks: { SessionStart: [claudeHook.entry()] } }, null, '\t')}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-005: install keeps compact single-line JSON compact when appending', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ hooks: { SessionStart: [] } }), 'utf8');

    install(home, '0.1.0');

    const raw = fs.readFileSync(target, 'utf8');
    assert.equal(raw, JSON.stringify({ hooks: { SessionStart: [claudeHook.entry()] } }));
    assert.ok(!raw.includes('\n'), 'expected the rewritten file to stay on one line');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- Final review follow-ups (lineage review-cef5637e2884c12a) ---

// R3-001: a write failure on a component that was already installed must not let the manifest
// forget it — the previous `{ path, sha256 }` record is carried forward (marked `skipped`, with a
// `reason`) so uninstall can still find and remove the real file, and `sync` never treats a
// component that is still declared as "no longer shipped" just because this run could not
// (re)write it. The failure is injected through `deps.writeFile` (a seam) rather than real file
// permissions, since chmod is unreliable on Windows.

test('R3-001: install carries the previous file record forward when writing it fails, and reports it skipped', () => {
  const home = makeTmpHome();
  try {
    const manifest = install(home, '0.1.0');
    const [claudeComponent] = components;
    const target = claudeComponent.target(home);
    const previousRecord = manifest.files.find((f) => f.path === target);

    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };
    const next = install(home, '0.2.0', { writeFile: failingWriteFile });

    const record = next.files.find((f) => f.path === target);
    assert.deepEqual(record, {
      path: target,
      sha256: previousRecord.sha256,
      skipped: true,
      reason: 'EACCES: permission denied',
    });
    assert.equal(
      fs.readFileSync(target, 'utf8'),
      claudeComponent.content('0.1.0'),
      'the real file must be untouched by the failed write',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-001: sync does not delete a still-declared component whose write failed this run', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const [claudeComponent] = components;
    const target = claudeComponent.target(home);

    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };
    sync(home, '0.2.0', { writeFile: failingWriteFile });

    assert.ok(fs.existsSync(target), 'a component that is still declared must survive a failed rewrite');
    assert.equal(fs.readFileSync(target, 'utf8'), claudeComponent.content('0.1.0'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-001: install reports no record for a component that has never been written and just failed again', () => {
  const home = makeTmpHome();
  try {
    const [claudeComponent] = components;
    const target = claudeComponent.target(home);
    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw new Error('EACCES: permission denied');
      fs.writeFileSync(writeTarget, ...rest);
    };

    const manifest = install(home, '0.1.0', { writeFile: failingWriteFile });

    assert.equal(
      manifest.files.some((f) => f.path === target),
      false,
      'nothing to carry forward on a first-ever failure',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-005: uninstall preserves 4-space indentation when it rewrites (rather than deletes) the file', () => {
  const home = makeTmpHome();
  try {
    const target = claudeHook.target(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const seeded = {
      hooks: {
        SessionStart: [
          { matcher: 'startup|resume|clear|compact', hooks: [{ type: 'command', command: 'echo unrelated', timeout: 5 }] },
        ],
      },
    };
    fs.writeFileSync(target, `${JSON.stringify(seeded, null, 4)}\n`, 'utf8');

    install(home, '0.1.0');
    uninstall(home);

    const raw = fs.readFileSync(target, 'utf8');
    assert.equal(raw, `${JSON.stringify(seeded, null, 4)}\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The skill is what agents read to decide which command to run. Plain `status`/`sync`/`uninstall` act by
// location (on the project inside an initialized repository), so the machine forms must say `--global`.
test('the installed skill names the --global forms for the machine and the project-scope behavior of the plain ones', () => {
  const text = components[0].content('0.1.0');
  for (const command of ['status', 'sync', 'uninstall']) {
    assert.match(text, new RegExp(`js-harness ${command} --global`), command);
  }
  assert.match(text, /initialized repository/);
  assert.match(text, /refuse/);
  assert.doesNotMatch(text, /`js-harness (status|sync|uninstall)` /, 'no unqualified machine command left');
  assert.equal(components[1].content('0.1.0'), text, 'Claude and Codex read the same text');
});

// The skill is where an agent learns the review record exists; without it `codex-review` is only
// discoverable by reading the source.
test('the installed skill names codex-review and check --push', () => {
  const text = components[0].content('0.1.0');
  assert.match(text, /js-harness codex-review --base/);
  assert.match(text, /--unavailable/);
  assert.match(text, /js-harness check --push/);
  assert.match(text, /only check it runs/);
  assert.match(text, /default branch/);
});

// `check` waits by itself for the gate that runs on the machine; the skill is where an agent learns that it
// does, and the two flags that change how.
test('the installed skill names check as the gate of a commit, and how it waits for the gate that runs: --wait and --no-wait', () => {
  const text = components[0].content('0.1.0');
  const line = /^- `js-harness check` — (.+)$/m.exec(text)?.[1] ?? '';
  assert.match(line, /one gate at a time on the machine/);
  assert.match(line, /60 minutes at most \(`--wait <minutes>`\)/);
  assert.match(line, /refuses at once \(`--no-wait`\)/);
});

// The lock holds between gates; a whole test run or a batch of evals by hand is no gate, and beside one it
// costs the same. The skill is where an agent learns there is a command that puts such a run in line.
test('the installed skill names gate, the command that runs anything else heavy under the same lock', () => {
  const text = components[0].content('0.1.0');
  const line = /^- `js-harness gate -- <command>` — (.+)$/m.exec(text)?.[1] ?? '';
  assert.match(line, /not a commit's gate/);
  assert.match(line, /waits for its turn/);
  assert.match(line, /`--wait <minutes>`, `--no-wait`/);
  assert.match(line, /exit code is the command's/);
});

// The board is how a session learns what the others are doing; the first skill is where it learns the
// command exists.
test('the installed skill names sessions and its --watch', () => {
  const text = components[0].content('0.1.0');
  assert.match(text, /js-harness sessions/);
  assert.match(text, /--watch/);
});

// --- the orchestrator skill: read by a session that supervises the others, and by one that works next to others ---

test('the orchestrator skill is installed for Claude Code and for Codex with the same text, re-written by sync and removed by uninstall', () => {
  const home = makeTmpHome();
  try {
    const [, , claudeOrchestrator, codexOrchestrator] = components;
    assert.equal(claudeOrchestrator.target(home), path.join(home, '.claude', 'skills', 'js-harness-orchestrator', 'SKILL.md'));
    assert.equal(codexOrchestrator.target(home), path.join(home, '.codex', 'skills', 'js-harness-orchestrator', 'SKILL.md'));
    assert.equal(codexOrchestrator.content('0.1.0'), claudeOrchestrator.content('0.1.0'), 'Claude and Codex read the same text');

    install(home, '0.1.0');
    assert.equal(fs.readFileSync(claudeOrchestrator.target(home), 'utf8'), claudeOrchestrator.content('0.1.0'));
    fs.writeFileSync(codexOrchestrator.target(home), 'an older text', 'utf8');
    sync(home, '0.2.0');
    assert.equal(fs.readFileSync(codexOrchestrator.target(home), 'utf8'), codexOrchestrator.content('0.2.0'));

    const result = uninstall(home);
    assert.ok(result.removed.includes(claudeOrchestrator.target(home)) && result.removed.includes(codexOrchestrator.target(home)));
    assert.deepEqual(result.kept, []);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills')), false, 'no skill folder is left under the home');
    assert.equal(fs.existsSync(path.join(home, '.codex', 'skills')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the orchestrator skill has a one-line description a host can read, and names the commands an orchestrator runs', () => {
  const text = components[2].content('0.1.0');
  const frontmatter = /^---\nname: js-harness-orchestrator\ndescription: (.+)\n---\n/.exec(text);
  assert.ok(frontmatter, text.slice(0, 200));
  // A colon followed by a space, or a hash after one, would end or break the YAML value a host parses.
  assert.doesNotMatch(frontmatter[1], /: | #/);
  for (const command of ['js-harness sessions', 'js-harness sessions --watch', 'js-harness progress']) {
    assert.ok(text.includes(command), command);
  }
});

// Two gates at once was a rule each session kept by hand, from the board. `check` keeps it now, so the
// skill no longer asks for it: it says what a session still has to know, and what is still its own to keep.
test('the orchestrator skill no longer asks a session to keep by hand the rule that check keeps', () => {
  const text = components[2].content('0.1.0');
  assert.doesNotMatch(text, /never start a gate while another runs/);
  assert.doesNotMatch(text, /a gate is about to start/);
  // A whole test run of a session's own is no gate: the line names the command that puts it in line.
  assert.ok(text.includes("- Your commit's gate waits by itself while another runs: `Gates` in `js-harness sessions` says which runs and which wait. A whole test run of your own goes through `js-harness gate -- <command>`, which waits for its turn too.\n"));
  assert.doesNotMatch(text, /Start no whole test run/);
  assert.ok(text.includes('\n3. two gates run at once (a gate that waits for its turn is not one of them);\n'));
});

// The relief of an orchestrator is one prompt, always the same: it is in the skill as the block the user
// copies, and it leads the new session back to this skill.
test('the orchestrator skill carries its fixed opening prompt as its one fenced block, and the prompt names the skill', () => {
  const text = components[2].content('0.1.0');
  const blocks = [...text.matchAll(/^```\n([\s\S]*?)\n```$/gm)];
  assert.equal(blocks.length, 1);
  assert.match(blocks[0][1], /orchestrator/);
  assert.match(blocks[0][1], /js-harness-orchestrator/);
  // It ships to every user of the harness: it speaks of "the user", not of who wrote it.
  assert.doesNotMatch(text, /Sebasti/);
});

// --- optional files: written outside the components, on request (the login launcher of `remote start --at-login`) ---

/** A folder that is not ours (the Windows Startup folder in production) holding one optional file. */
function makeOptionalFile(home, content = '@echo off\r\nrem a launcher\r\n') {
  const dir = path.join(home, 'Startup');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'js-harness-remote-x.cmd');
  fs.writeFileSync(file, content);
  return { dir, file, content };
}

test('recordOptionalFile creates a manifest that says nothing is installed when there is none', () => {
  const home = makeTmpHome();
  try {
    const { file, content } = makeOptionalFile(home);
    const record = recordOptionalFile(home, file, content);
    assert.deepEqual(record, { path: file, sha256: sha256(content) });
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], optional: [record] });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('recordOptionalFile adds to an installed manifest without touching the rest, one record per path', () => {
  const home = makeTmpHome();
  try {
    const installed = install(home, '0.1.0');
    const { file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    assert.deepEqual(readManifest(home), { ...installed, optional: [{ path: file, sha256: sha256(content) }] });

    recordOptionalFile(home, file, 'other content');
    const other = path.join(home, 'Startup', 'js-harness-remote-y.cmd');
    recordOptionalFile(home, other, 'y');
    assert.deepEqual(readManifest(home).optional, [
      { path: file, sha256: sha256('other content') },
      { path: other, sha256: sha256('y') },
    ]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install and sync carry the optional files forward: never rewritten, dropped or pruned', () => {
  const home = makeTmpHome();
  try {
    const { file, content } = makeOptionalFile(home);
    const record = recordOptionalFile(home, file, content);

    const installed = install(home, '0.1.0');
    assert.equal(installed.version, '0.1.0');
    assert.deepEqual(installed.optional, [record]);
    assert.deepEqual(readManifest(home).optional, [record]);

    const synced = sync(home, '0.2.0');
    assert.deepEqual(synced.optional, [record], 'sync prunes files no component declares, and an optional file is not one of them');
    assert.deepEqual(readManifest(home).optional, [record]);
    assert.equal(fs.readFileSync(file, 'utf8'), content, 'the file itself is left as it was');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a manifest without an optional field still loads, and install does not add one', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    assert.equal(Object.hasOwn(readManifest(home), 'optional'), false);
    assert.equal(Object.hasOwn(sync(home, '0.2.0'), 'optional'), false);
    assert.doesNotThrow(() => uninstall(home));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes an optional file whose content is untouched, keeps an edited one, and leaves their folder', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const { dir, file, content } = makeOptionalFile(home);
    const edited = path.join(dir, 'js-harness-remote-edited.cmd');
    fs.writeFileSync(edited, 'as written');
    const gone = path.join(dir, 'js-harness-remote-gone.cmd');
    recordOptionalFile(home, file, content);
    recordOptionalFile(home, edited, 'as written');
    recordOptionalFile(home, gone, 'never there');
    fs.writeFileSync(edited, 'the user was here');

    const result = uninstall(home);

    assert.equal(fs.existsSync(file), false);
    assert.equal(fs.readFileSync(edited, 'utf8'), 'the user was here');
    assert.ok(result.removed.includes(file), 'reported with the removed files');
    assert.ok(result.kept.includes(edited), 'reported with the kept ones');
    assert.deepEqual(result.keptOptional, [{ path: edited, reason: 'edited' }], 'and with why it was kept');
    assert.equal(result.removed.includes(gone) || result.kept.includes(gone), false, 'a file that is gone is neither');
    assert.equal(fs.existsSync(manifestPath(home)), false);

    fs.rmSync(edited);
    assert.equal(fs.existsSync(dir), true, 'the folder is not ours, even empty');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall leaves the folder of an optional file even when removing it empties the folder', () => {
  const home = makeTmpHome();
  try {
    const { dir, file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    const result = uninstall(home);
    assert.deepEqual(result.removed, [file], 'a machine that never ran install still has its optional file undone');
    assert.deepEqual(fs.readdirSync(dir), []);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps an optional file it cannot read, reports it with the error code, and still finishes', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const { dir, file, content } = makeOptionalFile(home);
    const blocked = path.join(dir, 'js-harness-remote-blocked.cmd');
    fs.mkdirSync(blocked); // a folder where the file was recorded: it is there, and reading it fails
    recordOptionalFile(home, blocked, 'as written');
    recordOptionalFile(home, file, content);

    const result = uninstall(home);

    assert.ok(result.kept.includes(blocked), 'reported with the kept ones');
    assert.deepEqual(result.keptOptional, [{ path: blocked, reason: 'unreadable', code: 'EISDIR' }], 'not as one the user edited');
    assert.equal(fs.statSync(blocked).isDirectory(), true, 'and left as it is');
    assert.ok(result.removed.includes(file), 'the optional files after it are still undone');
    assert.equal(fs.existsSync(components[0].target(home)), false);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'the uninstall runs to its end: no manifest is left naming files that are gone');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps an optional file it read and matched but cannot remove, reports it with the error code, and still finishes', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const { dir, file, content } = makeOptionalFile(home);
    const locked = path.join(dir, 'js-harness-remote-locked.cmd');
    fs.writeFileSync(locked, 'as written');
    recordOptionalFile(home, locked, 'as written');
    recordOptionalFile(home, file, content);
    // Another program holds the file for an instant: the read succeeds, the hash matches, the removal fails.
    const removeFile = (target, ...rest) => {
      if (target === locked) throw Object.assign(new Error(`EBUSY: resource busy or locked, unlink '${locked}'`), { code: 'EBUSY' });
      fs.rmSync(target, ...rest);
    };

    const result = uninstall(home, { removeFile });

    assert.ok(result.kept.includes(locked), 'reported with the kept ones');
    assert.deepEqual(result.keptOptional, [{ path: locked, reason: 'unremovable', code: 'EBUSY' }]);
    assert.equal(fs.readFileSync(locked, 'utf8'), 'as written', 'and left as it is');
    assert.equal(result.removed.includes(locked), false);
    assert.ok(result.removed.includes(file), 'the optional files after it are still undone');
    assert.equal(fs.existsSync(components[0].target(home)), false, 'the components went through the same remover');
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall reports a failure that carries no error code as such, never as an edit', () => {
  const home = makeTmpHome();
  try {
    const { file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    const result = uninstall(home, {
      removeFile: () => {
        throw new Error('the remover failed');
      },
    });
    assert.deepEqual(result.keptOptional, [{ path: file, reason: 'unremovable', code: 'unknown error' }]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- a manifest that only records optional files (`version: null`): what each reader of the manifest does with it ---

test('installedVersion is the version install recorded, and null when nothing is installed: no manifest, or one that only records optional files', () => {
  const home = makeTmpHome();
  try {
    assert.equal(installedVersion(home), null);
    const { file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    assert.equal(installedVersion(home), null);
    install(home, '0.1.0');
    assert.equal(installedVersion(home), '0.1.0');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install and sync over a manifest that only records optional files do what they do with no manifest, and keep the record', () => {
  for (const run of [install, sync]) {
    const fresh = makeTmpHome();
    const home = makeTmpHome();
    try {
      const { file, content } = makeOptionalFile(home);
      const record = recordOptionalFile(home, file, content);

      const expected = run(fresh, '0.2.0');
      const manifest = run(home, '0.2.0');

      const relative = (base, list) => list.map((entry) => path.relative(base, entry.path));
      assert.equal(manifest.version, '0.2.0', run.name);
      assert.deepEqual(relative(home, manifest.files), relative(fresh, expected.files), `${run.name}: the same components`);
      assert.deepEqual(relative(home, manifest.entries), relative(fresh, expected.entries), `${run.name}: the same hook entries`);
      assert.deepEqual(manifest.optional, [record], run.name);
      assert.deepEqual(readManifest(home), manifest, run.name);
      assert.equal(fs.readFileSync(file, 'utf8'), content, `${run.name}: the optional file is left as it was`);
      for (const component of components) assert.ok(fs.existsSync(component.target(home)), run.name);
    } finally {
      fs.rmSync(fresh, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('uninstall over a manifest that only records optional files removes them and the manifest, and nothing else', () => {
  const home = makeTmpHome();
  try {
    const { file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    const others = path.join(home, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(others), { recursive: true });
    fs.writeFileSync(others, '{"hooks":{}}');

    assert.deepEqual(uninstall(home), { removed: [file], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [], channelKept: [] });
    assert.equal(fs.existsSync(manifestPath(home)), false);
    assert.equal(fs.readFileSync(others, 'utf8'), '{"hooks":{}}', 'no component or hook entry was recorded, so none is looked for');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall compares an optional file by its bytes, whatever its encoding', () => {
  const home = makeTmpHome();
  try {
    const bytes = Buffer.from([0x40, 0x65, 0xf1, 0xff, 0x0d, 0x0a]); // not valid UTF-8
    const { file } = makeOptionalFile(home, bytes);
    recordOptionalFile(home, file, bytes);
    assert.deepEqual(uninstall(home).removed, [file]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('forgetOptionalFile removes the record, and the manifest with it when nothing else was ever recorded', () => {
  const home = makeTmpHome();
  try {
    const { file, content } = makeOptionalFile(home);
    const other = path.join(home, 'Startup', 'js-harness-remote-y.cmd');
    recordOptionalFile(home, file, content);
    recordOptionalFile(home, other, 'y');

    assert.equal(forgetOptionalFile(home, other), true);
    assert.deepEqual(readManifest(home).optional, [{ path: file, sha256: sha256(content) }]);

    assert.equal(forgetOptionalFile(home, file), true);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'a manifest that records nothing is not left behind');
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nor its folder, when empty');
    assert.equal(fs.readFileSync(file, 'utf8'), content, 'forgetting a record never touches the file');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('forgetOptionalFile keeps the folder of the manifest when something else is in it', () => {
  const home = makeTmpHome();
  try {
    const { file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    fs.mkdirSync(path.join(home, '.js-harness', 'remote'));
    forgetOptionalFile(home, file);
    assert.deepEqual(fs.readdirSync(path.join(home, '.js-harness')), ['remote']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('forgetOptionalFile leaves an installed manifest exactly as it was before the record', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const before = fs.readFileSync(manifestPath(home), 'utf8');
    const { file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    assert.notEqual(fs.readFileSync(manifestPath(home), 'utf8'), before);
    assert.equal(forgetOptionalFile(home, file), true);
    assert.equal(fs.readFileSync(manifestPath(home), 'utf8'), before);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('forgetOptionalFile with no record, or no manifest, changes nothing', () => {
  const home = makeTmpHome();
  try {
    assert.equal(forgetOptionalFile(home, path.join(home, 'nothing.cmd')), false);
    assert.deepEqual(fs.readdirSync(home), [], 'no manifest is created to forget from');

    install(home, '0.1.0');
    const before = fs.readFileSync(manifestPath(home), 'utf8');
    assert.equal(forgetOptionalFile(home, path.join(home, 'nothing.cmd')), false);
    assert.equal(fs.readFileSync(manifestPath(home), 'utf8'), before);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- scheduled tasks: registered with Windows on request (the watchdog of `remote start --at-login`) ---

const TASK = {
  name: 'js-harness-remote-x',
  command: 'C:\\Windows\\System32\\conhost.exe',
  arguments: '--headless "C:\\Program Files\\nodejs\\node.exe" D:\\js-harness\\bin\\remote.mjs start --cwd D:\\work\\proj --name proj --watchdog',
};
const OTHER_TASK = { ...TASK, name: 'js-harness-remote-y', arguments: `${TASK.arguments} --spawn worktree` };

const xmlEscape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlUnescape = (text) => text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** What `schtasks /Query /TN <name> /XML` prints for a task whose action is `{ command, arguments }`: not the
 * document that registered it. Measured on 2026-10-06: declared as UTF-16, reordered (the actions last, the
 * triggers after the settings), with defaults and the user's id added. */
function queriedXml(name, action) {
  return [
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    `  <RegistrationInfo><Description>a task</Description><URI>\\${name}</URI></RegistrationInfo>`,
    '  <Principals><Principal id="Author"><UserId>S-1-5-21-1-2-3-1001</UserId><LogonType>InteractiveToken</LogonType></Principal></Principals>',
    '  <Settings><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><IdleSettings><Duration>PT10M</Duration><StopOnIdleEnd>true</StopOnIdleEnd></IdleSettings><Enabled>true</Enabled></Settings>',
    '  <Triggers><TimeTrigger><StartBoundary>2026-01-01T00:00:00</StartBoundary><Repetition><Interval>PT5M</Interval></Repetition></TimeTrigger></Triggers>',
    `  <Actions Context="Author"><Exec><Command>${xmlEscape(action.command)}</Command><Arguments>${xmlEscape(action.arguments)}</Arguments></Exec></Actions>`,
    '</Task>',
    '',
  ].join('\r\n');
}

/** A stand-in for `schtasks.exe` over a store of tasks, name to `{ command, arguments }`: it lists them among
 * Windows's own, prints one back as `queriedXml`, registers one from the XML file it is handed, deletes one, and
 * exits 1 for a task that is not there. `fail[verb]` (`list`, `read`, `create`, `delete`) is the exit code that
 * verb then ends with, having done nothing, or an error it throws. No test here may run the real program. */
function fakeSchtasks(tasks = {}) {
  const store = new Map(Object.entries(tasks).map(([name, action]) => [name, { command: action.command, arguments: action.arguments }]));
  const calls = [];
  const fail = {};
  const run = (args) => {
    calls.push(args);
    const value = (flag) => args[args.indexOf(flag) + 1];
    const verb = args[0] === '/Query' ? (args.includes('/XML') ? 'read' : 'list') : args[0].slice(1).toLowerCase();
    if (fail[verb] instanceof Error) throw fail[verb];
    if (fail[verb] !== undefined) return { status: fail[verb], stdout: '' };
    // Windows finds a task by its name whatever the case of its letters.
    const name = [...store.keys()].find((task) => task.toLowerCase() === value('/TN')?.toLowerCase()) ?? value('/TN');
    if (verb === 'list') {
      const rows = ['"TaskName","Next Run Time","Status"', '"\\Microsoft\\Windows\\Defrag\\ScheduledDefrag","N/A","Ready"', ...[...store.keys()].map((task) => `"\\${task}","06/10/2026 12:05:00","Ready"`)];
      return { status: 0, stdout: `${rows.join('\r\n')}\r\n` };
    }
    if (verb === 'read') return store.has(name) ? { status: 0, stdout: queriedXml(name, store.get(name)) } : { status: 1, stdout: '' };
    if (verb === 'delete') return store.delete(name) ? { status: 0, stdout: '' } : { status: 1, stdout: '' };
    if (verb === 'create') {
      if (store.has(name) && !args.includes('/F')) return { status: 1, stdout: '' };
      const xml = fs.readFileSync(value('/XML'), 'utf8');
      store.set(name, { command: xmlUnescape(/<Command>(.*?)<\/Command>/s.exec(xml)[1]), arguments: xmlUnescape(/<Arguments>(.*?)<\/Arguments>/s.exec(xml)[1]) });
      return { status: 0, stdout: '' };
    }
    throw new Error(`the fake schtasks does not know ${args.join(' ')}`);
  };
  return { run, store, calls, fail, mutations: () => calls.filter((args) => args[0] !== '/Query') };
}

const NEVER_RUN = () => { throw new Error('schtasks must not be run here'); };

test('recordScheduledTask keeps a task by name and by the command it runs, in an array of its own, and creates a manifest that says nothing is installed', () => {
  const home = makeTmpHome();
  try {
    const record = recordScheduledTask(home, { ...TASK, somethingElse: 'not recorded' });
    assert.deepEqual(record, TASK);
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], tasks: [TASK] }, 'a task is not a file: it is not in `optional`');
    assert.equal(installedVersion(home), null, 'and a manifest that only records a task still reads as not installed');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('recordScheduledTask adds to an installed manifest without touching the rest, one record per name', () => {
  const home = makeTmpHome();
  try {
    const installed = install(home, '0.1.0');
    const { file, content } = makeOptionalFile(home);
    const launcher = recordOptionalFile(home, file, content);
    recordScheduledTask(home, TASK);
    assert.deepEqual(readManifest(home), { ...installed, optional: [launcher], tasks: [TASK] });

    recordScheduledTask(home, { ...TASK, name: TASK.name.toUpperCase(), arguments: 'other arguments' });
    recordScheduledTask(home, OTHER_TASK);
    assert.deepEqual(readManifest(home).tasks, [{ ...TASK, name: TASK.name.toUpperCase(), arguments: 'other arguments' }, OTHER_TASK], 'Windows does not tell two task names apart by case');
    assert.deepEqual(readManifest(home).optional, [launcher]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install and sync carry the scheduled tasks forward untouched, run nothing, and add no field when there is none', () => {
  const home = makeTmpHome();
  const clean = makeTmpHome();
  try {
    recordScheduledTask(home, TASK);
    const installed = install(home, '0.1.0', { schtasks: NEVER_RUN });
    assert.equal(installed.version, '0.1.0');
    assert.deepEqual(installed.tasks, [TASK]);
    assert.deepEqual(readManifest(home).tasks, [TASK]);
    assert.equal(installed.files.length, install(clean, '0.1.0').files.length, 'over a manifest that only records a task, install does what it does with none');

    const synced = sync(home, '0.2.0', { schtasks: NEVER_RUN });
    assert.deepEqual(synced.tasks, [TASK], 'sync prunes what no component declares, and a task is not one of those');
    assert.deepEqual(readManifest(home).tasks, [TASK]);

    assert.equal(Object.hasOwn(readManifest(clean), 'tasks'), false);
    assert.equal(Object.hasOwn(sync(clean, '0.2.0'), 'tasks'), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(clean, { recursive: true, force: true });
  }
});

test('forgetScheduledTask removes the record, and the manifest with it only when nothing else is recorded: the last of the tasks and of the optional files', () => {
  const home = makeTmpHome();
  try {
    const { file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    recordScheduledTask(home, TASK);
    recordScheduledTask(home, OTHER_TASK);

    assert.equal(forgetScheduledTask(home, OTHER_TASK.name), true);
    assert.deepEqual(readManifest(home).tasks, [TASK]);
    assert.equal(forgetScheduledTask(home, TASK.name.toUpperCase()), true, 'by name, whatever its case');
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], optional: [{ path: file, sha256: sha256(content) }] }, 'the optional file is still recorded, with no empty `tasks` left');

    // The other way round: the last optional record goes while a task is still recorded.
    recordScheduledTask(home, TASK);
    assert.equal(forgetOptionalFile(home, file), true);
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], tasks: [TASK] }, 'forgetting the last optional file must not take the record of a task with it');

    assert.equal(forgetScheduledTask(home, TASK.name), true);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'a manifest that records nothing is not left behind');
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nor its folder, when empty');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('forgetScheduledTask leaves an installed manifest exactly as it was before the record, and changes nothing with no record or no manifest', () => {
  const home = makeTmpHome();
  try {
    assert.equal(forgetScheduledTask(home, TASK.name), false);
    assert.deepEqual(fs.readdirSync(home), [], 'no manifest is created to forget from');

    install(home, '0.1.0');
    const before = fs.readFileSync(manifestPath(home), 'utf8');
    assert.equal(forgetScheduledTask(home, TASK.name), false);
    assert.equal(fs.readFileSync(manifestPath(home), 'utf8'), before);
    recordScheduledTask(home, TASK);
    assert.notEqual(fs.readFileSync(manifestPath(home), 'utf8'), before);
    assert.equal(forgetScheduledTask(home, TASK.name), true);
    assert.equal(fs.readFileSync(manifestPath(home), 'utf8'), before);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Forgetting the last record tidies as `uninstall` does (`removeEmptyDirsUpTo`), and the record is gone by
// then: a throw from the tidying would say that nothing was forgotten.
test('forgetting the last record answers true and removes the manifest when its folder cannot be listed, or cannot be removed', () => {
  const forgetting = {
    forgetOptionalFile: (home, deps) => {
      const { file, content } = makeOptionalFile(home);
      recordOptionalFile(home, file, content);
      return forgetOptionalFile(home, file, deps);
    },
    forgetScheduledTask: (home, deps) => {
      recordScheduledTask(home, TASK);
      return forgetScheduledTask(home, TASK.name, deps);
    },
  };
  for (const [left, seam] of LEFT_BEHIND) {
    for (const [name, forget] of Object.entries(forgetting)) {
      const what = `${name}, ${left}`;
      const home = makeTmpHome();
      try {
        const own = path.dirname(manifestPath(home));
        assert.equal(forget(home, { listDir: seam(own) }), true, what);
        assert.deepEqual([fs.existsSync(manifestPath(home)), fs.existsSync(own)], [false, true], `${what}: the manifest goes and its folder is left`);
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    }
  }
});

// --- putting one record back: how `remote start --at-login` takes back its own two records when it fails halfway ---

/** `putOptionalRecordBack` and `putTaskRecordBack` over `home`, each with the array it keeps its record in (`key`),
 * what records its thing as it was before the command (`asBefore`) and as the command left it (`asAfter`), what
 * forgets it (`forget`), and the call itself (`put`). The task is put back under its name in another case than
 * the one it was recorded in: Windows does not tell the two apart. */
const PUT_BACK = {
  putOptionalRecordBack: (home, file = path.join(home, 'Startup', 'js-harness-remote-x.cmd')) => ({
    key: 'optional',
    asBefore: () => recordOptionalFile(home, file, 'the launcher before'),
    asAfter: () => recordOptionalFile(home, file, 'the launcher after'),
    forget: () => forgetOptionalFile(home, file),
    put: (record) => putOptionalRecordBack(home, file, record),
  }),
  putTaskRecordBack: (home) => ({
    key: 'tasks',
    asBefore: () => recordScheduledTask(home, TASK),
    asAfter: () => recordScheduledTask(home, { ...TASK, arguments: `${TASK.arguments} --spawn worktree` }),
    forget: () => forgetScheduledTask(home, TASK.name),
    put: (record) => putTaskRecordBack(home, TASK.name.toUpperCase(), record),
  }),
};

/** Runs `body` once for each of the two, over a home of its own; `what` names the one that failed. */
function eachPutBack(body) {
  for (const [what, over] of Object.entries(PUT_BACK)) {
    const home = makeTmpHome();
    try {
      body({ what, home, ...over(home) });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
}

/** What another project's `start --at-login` records meanwhile: a launcher and a task of its own, one in each array. */
function theyRecord(home) {
  recordOptionalFile(home, path.join(home, 'Startup', 'js-harness-remote-theirs.cmd'), 'their launcher');
  recordScheduledTask(home, { ...OTHER_TASK, name: 'js-harness-remote-theirs' });
}

test('putting back a record there was none of forgets the one that is there now, and only that one; with none there it changes nothing', () => {
  eachPutBack(({ what, home, key, asAfter, put }) => {
    assert.equal(put(undefined), false, `${what}: none before, none now`);
    assert.deepEqual(fs.readdirSync(home), [], `${what}: no manifest is created to forget from`);

    // The only record of the machine: the manifest goes with it, as when it is forgotten.
    asAfter();
    assert.equal(put(undefined), true, what);
    assert.equal(fs.existsSync(manifestPath(home)), false, `${what}: a manifest that records nothing is not left behind`);

    // Beside an install and what another project recorded meanwhile: all of that is as it was.
    install(home, '0.1.0');
    theyRecord(home);
    const before = fs.readFileSync(manifestPath(home), 'utf8');
    asAfter();
    assert.equal(readManifest(home)[key].length, 2, what);
    assert.equal(put(undefined), true, what);
    assert.equal(fs.readFileSync(manifestPath(home), 'utf8'), before, `${what}: only its own record went`);
    assert.equal(put(undefined), false, `${what}: and there is none left to forget`);
    assert.equal(fs.readFileSync(manifestPath(home), 'utf8'), before, what);
  });
});

test('putting back a record that is already what it was writes nothing: the manifest is not written again', () => {
  eachPutBack(({ what, home, asBefore, put }) => {
    install(home, '0.1.0');
    const was = asBefore();
    theyRecord(home);
    // On one line and dated long ago: any write would give the file back its two-space layout and today's date.
    const file = manifestPath(home);
    const longAgo = new Date('2020-01-01T00:00:00Z');
    fs.writeFileSync(file, JSON.stringify(readManifest(home)));
    fs.utimesSync(file, longAgo, longAgo);
    const seen = () => ({ bytes: fs.readFileSync(file, 'utf8'), mtimeMs: fs.statSync(file).mtimeMs });
    const before = seen();

    assert.equal(put({ ...was }), false, `${what}: equal by what it holds, not by being the same object`);
    assert.deepEqual(seen(), before, what);
  });
});

test('putting back a record that differs from what is there now replaces it where it is, and leaves what another project recorded meanwhile', () => {
  eachPutBack(({ what, home, key, asBefore, asAfter, put }) => {
    install(home, '0.1.0');
    const was = asBefore();
    theyRecord(home);
    const before = readManifest(home);
    const left = asAfter();
    assert.notDeepEqual(left, was, what);
    assert.deepEqual(readManifest(home)[key][0], left, what);

    assert.equal(put(was), true, what);
    assert.deepEqual(readManifest(home), before, `${what}: its own record is the earlier one again, in its place, and nothing else changed`);
  });
});

test('putting back a record that is missing now adds it again, beside what another project recorded meanwhile, and creates the manifest when there is none', () => {
  eachPutBack(({ what, home, key, asBefore, forget, put }) => {
    const was = asBefore();
    assert.equal(forget(), true, what);
    assert.equal(fs.existsSync(manifestPath(home)), false, what);
    assert.equal(put(was), true, `${what}: with no manifest`);
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], [key]: [was] }, what);

    forget();
    install(home, '0.1.0');
    theyRecord(home);
    const before = readManifest(home);
    assert.equal(put(was), true, `${what}: beside theirs`);
    assert.deepEqual(readManifest(home), { ...before, [key]: [...before[key], was] }, `${what}: theirs are as they were, and its own is back`);
  });
});

test('scheduledTaskAction reads the command and its arguments out of what schtasks prints back, whatever the order and the defaults around them', () => {
  const tricky = { command: 'C:\\R&D\\conhost.exe', arguments: '--headless "C:\\a b\\node.exe" x <y> & z' };
  assert.deepEqual(scheduledTaskAction(queriedXml('t', TASK)), { command: TASK.command, arguments: TASK.arguments });
  assert.deepEqual(scheduledTaskAction(queriedXml('t', tricky)), tricky, 'what XML escapes is read back as it was');
  assert.deepEqual(scheduledTaskAction('<Task><Actions><Exec><Command>a&#x26;b&#38;c</Command></Exec></Actions></Task>'), { command: 'a&b&c', arguments: '' }, 'no arguments is an empty string, and a numbered character is read');
  const exec = '<Exec><Command>a.exe</Command><Arguments>b</Arguments></Exec>';
  const notOurs = {
    'no action': '<Task><Actions Context="Author"></Actions></Task>',
    'two actions': `<Task><Actions Context="Author">${exec}${exec}</Actions></Task>`,
    'an action that is not a command': `<Task><Actions>${exec}<ComHandler><ClassId>{0}</ClassId></ComHandler></Actions></Task>`,
    'a command with no program': '<Task><Actions><Exec><Arguments>b</Arguments></Exec></Actions></Task>',
    'no document': '',
  };
  for (const [what, xml] of Object.entries(notOurs)) assert.equal(scheduledTaskAction(xml), null, what);
});

test('lookAtScheduledTask says absent only when the list of tasks ran and does not hold the name, and never changes anything', () => {
  const tasks = fakeSchtasks({ [TASK.name]: TASK, [`${TASK.name}y`]: OTHER_TASK });
  assert.deepEqual(lookAtScheduledTask(TASK.name, tasks.run), { found: 'present', action: { command: TASK.command, arguments: TASK.arguments } });
  assert.deepEqual(lookAtScheduledTask(TASK.name.toUpperCase(), tasks.run).found, 'present', 'by name, whatever its case');
  assert.deepEqual(lookAtScheduledTask('js-harness-remote', tasks.run), { found: 'absent' }, 'the start of another name is not that name');
  assert.deepEqual(lookAtScheduledTask('ScheduledDefrag', tasks.run), { found: 'absent' }, 'a task of that name in a folder is another task');
  assert.deepEqual(tasks.calls.at(-1), ['/Query', '/FO', 'CSV'], 'a task that is not listed is not asked for by name: that exit code says nothing');
  assert.deepEqual(tasks.mutations(), []);
});

test('lookAtScheduledTask answers unknown, with why, whenever it could not look: nothing then proves the task absent', () => {
  const cases = {
    'the list fails': [(tasks) => { tasks.fail.list = 1; }, /could not be listed .*exited 1/],
    'the task is listed and cannot be read': [(tasks) => { tasks.fail.read = 1; }, /listed and could not be read .*exited 1/],
    'schtasks cannot run': [(tasks) => { tasks.fail.list = new Error('schtasks.exe could not run: spawnSync ENOENT'); }, /could not run/],
  };
  for (const [what, [arrange, why]] of Object.entries(cases)) {
    const tasks = fakeSchtasks({ [TASK.name]: TASK });
    arrange(tasks);
    const look = lookAtScheduledTask(TASK.name, tasks.run);
    assert.equal(look.found, 'unknown', what);
    assert.match(look.why, why, what);
    assert.deepEqual(tasks.mutations(), [], what);
  }
  // Present, but not a task that runs one command: there is no action to compare.
  const odd = fakeSchtasks();
  odd.run = (args) => (args.includes('/XML') ? { status: 0, stdout: '<Task><Actions></Actions></Task>' } : { status: 0, stdout: `"\\${TASK.name}","N/A","Ready"\r\n` });
  assert.deepEqual(lookAtScheduledTask(TASK.name, odd.run), { found: 'present', action: null });
});

test('runSchtasks runs the schtasks.exe of the SystemRoot it is given, never one found on PATH, and gives back the exit code and what was printed', () => {
  const ran = [];
  const spawnSync = (file, args, options) => {
    ran.push({ file, args, options });
    return { status: 3, stdout: Buffer.from('caf\xe9\r\n', 'latin1'), stderr: Buffer.alloc(0) };
  };
  assert.deepEqual(runSchtasks(['/Query', '/FO', 'CSV'], { env: { systemroot: 'D:\\Win' }, spawnSync }), { status: 3, stdout: 'caf\xe9\r\n' });
  assert.equal(ran[0].file, 'D:\\Win\\System32\\schtasks.exe');
  assert.deepEqual(ran[0].args, ['/Query', '/FO', 'CSV']);
  assert.equal(ran[0].options.shell, undefined, 'no shell: the arguments are handed over as they are');
  assert.equal(ran[0].options.windowsHide, true);

  const utf16 = () => ({ status: 0, stdout: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<Task>ñ</Task>', 'utf16le')]) });
  assert.equal(runSchtasks(['/Query'], { env: { SystemRoot: 'C:\\Windows' }, spawnSync: utf16 }).stdout, '<Task>ñ</Task>', 'UTF-16 with its mark is read as UTF-16');

  for (const env of [{}, { SystemRoot: '' }, { SystemRoot: 'Windows' }, { PATH: 'C:\\Windows\\System32' }]) {
    assert.throws(() => runSchtasks(['/Query'], { env, spawnSync }), /SystemRoot/, JSON.stringify(env));
  }
  assert.equal(ran.length, 1, 'and nothing was run without it');
  const failed = () => ({ error: new Error('spawnSync schtasks.exe ENOENT'), status: null });
  assert.throws(() => runSchtasks(['/Query'], { env: { SystemRoot: 'C:\\Windows' }, spawnSync: failed }), /could not run.*ENOENT/);
});

/** A `SystemRoot` that holds no `schtasks.exe`: whatever is run from it does not start. */
const NO_WINDOWS = path.join(os.tmpdir(), 'js-harness-no-such-windows');

test('the real schtasks.exe is never run from a test: with nothing injected runSchtasks refuses before it looks at the environment, on any host', () => {
  // The environments handed over hold no schtasks.exe, so were this guard removed no real program would run: the
  // call would fail to find or to start one, with another message. And what is asked is only a read.
  const readOnly = ['/Query', '/TN', 'js-harness-no-such-task', '/XML'];
  for (const env of [{ SystemRoot: NO_WINDOWS }, {}, { PATH: process.env.PATH ?? '' }]) {
    assert.throws(() => runSchtasks(readOnly, { env }), /never run from a test/, JSON.stringify(Object.keys(env)));
  }
});

test('uninstall deletes a recorded task only while it still runs the recorded command, and says why it kept any other', () => {
  const home = makeTmpHome();
  try {
    const edited = { ...TASK, name: 'js-harness-remote-edited' };
    const gone = { ...TASK, name: 'js-harness-remote-gone' };
    const locked = { ...TASK, name: 'js-harness-remote-locked' };
    for (const task of [TASK, edited, gone, locked]) recordScheduledTask(home, task);
    const tasks = fakeSchtasks({ [TASK.name]: TASK, [edited.name]: { ...edited, arguments: '--headless calc.exe' }, [locked.name]: locked, 'not-recorded': TASK });
    const run = (args) => (args[0] === '/Delete' && args.includes(locked.name) ? { status: 5, stdout: '' } : tasks.run(args));

    const result = uninstall(home, { schtasks: run });

    assert.deepEqual(result.tasksRemoved, [TASK.name]);
    assert.deepEqual(result.tasksKept, [
      { name: edited.name, reason: 'edited' },
      { name: locked.name, reason: 'unremovable', why: `schtasks /Delete /TN ${locked.name} /F exited 5` },
    ], 'a task that is already gone just loses its record');
    assert.deepEqual([...tasks.store.keys()].sort(), [edited.name, locked.name, 'not-recorded'].sort(), 'only the task that still ran the recorded command is deleted');
    assert.deepEqual(tasks.mutations(), [['/Delete', '/TN', TASK.name, '/F']], 'and nothing else was asked of schtasks but to look');
    assert.deepEqual({ removed: result.removed, kept: result.kept }, { removed: [], kept: [] }, 'a task is not one of the files');

    // The task that could not be deleted is still registered and still fires, so its record stays, alone, in a
    // manifest that reads as not installed: the uninstall can be run again. The edited one is the user's now.
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], tasks: [locked] });
    assert.equal(installedVersion(home), null);
    const again = uninstall(home, { schtasks: tasks.run });
    assert.deepEqual({ tasksRemoved: again.tasksRemoved, tasksKept: again.tasksKept }, { tasksRemoved: [locked.name], tasksKept: [] });
    assert.equal(tasks.store.has(locked.name), false);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'and then nothing is left');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall never deletes a task it could not look at, and with no seam injected it cannot reach the real schtasks from a test', () => {
  const home = makeTmpHome();
  try {
    recordScheduledTask(home, TASK);
    const tasks = fakeSchtasks({ [TASK.name]: TASK });
    tasks.fail.list = 1;
    const result = uninstall(home, { schtasks: tasks.run });
    assert.deepEqual(result.tasksRemoved, []);
    assert.equal(result.tasksKept.length, 1);
    assert.deepEqual({ name: result.tasksKept[0].name, reason: result.tasksKept[0].reason }, { name: TASK.name, reason: 'unknown' });
    assert.match(result.tasksKept[0].why, /could not be listed/);
    assert.deepEqual(tasks.mutations(), []);
    assert.equal(tasks.store.has(TASK.name), true);
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], tasks: [TASK] }, 'still recorded: a second uninstall, or stop --at-login, can look again');

    const unguarded = uninstall(home);
    assert.equal(unguarded.tasksKept[0].reason, 'unknown');
    assert.match(unguarded.tasksKept[0].why, /never run from a test/);
    assert.deepEqual(readManifest(home).tasks, [TASK]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall runs schtasks only for a manifest that records a task', () => {
  const home = makeTmpHome();
  try {
    install(home, '0.1.0');
    const { file, content } = makeOptionalFile(home);
    recordOptionalFile(home, file, content);
    const result = uninstall(home, { schtasks: NEVER_RUN });
    assert.deepEqual({ tasksRemoved: result.tasksRemoved, tasksKept: result.tasksKept }, { tasksRemoved: [], tasksKept: [] });
    assert.ok(result.removed.includes(file));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
